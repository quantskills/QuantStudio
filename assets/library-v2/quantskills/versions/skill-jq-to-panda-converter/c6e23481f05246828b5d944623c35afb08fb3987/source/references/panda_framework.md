# PandaAI 策略框架文档

> 基于 PandaAI 官方文档（community/article/117）整理，更新时间：2025-06-23

---

## 一、框架概述

PandaAI 策略为**事件驱动型**，需要实现框架约定的事件回调方法。回测、仿真、实盘共用同一套代码。

策略头部必须引用内置 API：

```python
from panda_backtest.api.api import *
```

---

## 二、MODE 双模式架构（期货特有）

通过 `MODE` 变量兼容性能模式和通用模式。

```python
MODE = 'backtest'   # 性能模式：回测速度提升数倍，仅支持回测
MODE = 'live'       # 通用模式：兼容回测、仿真、实盘，速度稍慢
```

**核心思想：**
- `backtest` 模式：`before_trading` 从预加载内存查表，零网络请求
- `live` 模式：`before_trading` 每天查 `panda_data` 获取主力合约
- `handle_data` 两种模式**完全一致**

---

## 三、策略生命周期函数

### 1. `initialize(context)` — 策略初始化（必选）

只在策略启动时运行一次。设置账户、参数、缓存变量。

```python
def initialize(context):
    context.account = '5588'              # 期货账号（回测固定 5588，仿真自动替换）
    context.mode = MODE                    # 赋值 MODE 到 context
    
    # ----- 策略参数 -----
    context.products = ['RB']             # 关注的品种列表
    context.short_window = 5
    context.long_window = 20
    
    # ----- 状态变量（跨 bar 维护） -----
    context.historical_prices = {}
    
    # ----- MODE 模式固定变量 -----
    context.today_dominant = {}            # {品种: symbol}，每天刷新
    context.contract_mul = {}              # {symbol: 乘数}
    context._dominant_map = {}             # {(品种, 日期): symbol} 预加载
    context._mul_map = {}                  # {symbol: 乘数} 预加载
    
    if context.mode == 'backtest':
        _preload_all_data(context)
```

### 2. `before_trading(context)` — 开盘前（可选）

**期货**：按 MODE 分发更新主力合约和乘数（交易日调用）
**股票**：可在此准备股票池

```python
# ---- 开盘前运行时间 ----
# 股票：8:30
# 期货：20:30

def before_trading(context):
    today = str(context.now)
    context.today_dominant = {}
    context.contract_mul = {}
    
    if context.mode == 'backtest':
        for product in context.products:
            symbol = context._dominant_map.get((product, today))
            if symbol:
                context.today_dominant[product] = symbol
                context.contract_mul[symbol] = context._mul_map.get(symbol, 1.0)
    else:
        try:
            dom_df = panda_data.get_future_dominant(
                underlying_symbol=context.products,
                start_date=today, end_date=today
            )
            if dom_df is not None and not dom_df.empty:
                for _, row in dom_df.iterrows():
                    context.today_dominant[row['underlying_symbol']] = row['symbol']
        except Exception:
            pass
        symbols = list(context.today_dominant.values())
        if symbols:
            try:
                mul_df = panda_data.get_future_list(
                    symbol=symbols, fields=["symbol", "contract_multiplier"]
                )
                if mul_df is not None and not mul_df.empty:
                    for _, row in mul_df.iterrows():
                        context.contract_mul[row['symbol']] = float(row['contract_multiplier'])
            except Exception:
                pass
    
    # 订阅当日主力合约行情
    symbols = list(context.today_dominant.values())
    if symbols:
        sub_future_symbol(symbols)
```

### 3. `handle_data(context, data)` — 策略核心逻辑（必选）

每根 bar 执行一次。**日线**：每日一次；**分钟**：每分钟一次。

**⚠️ 重要约束：**
- `handle_data` 中**禁止**调用 `panda_data` 等网络请求
- `handle_data` 中**禁止**高频 `print`（日志只在 `after_trading` 打印）
- `handle_data` 中**只读** `context.contract_mul` 缓存的合约乘数

```python
def handle_data(context, data):
    # 运行时间：股票 9:30~15:00，期货 9:00~15:00
    
    # 1. 获取期货账户
    futures_account = context.future_account_dict.get(context.account)
    if not futures_account:
        return
    
    # 2. 遍历当日主力合约（标准写法）
    for product, symbol in context.today_dominant.items():
        try:
            bar = data[symbol]
        except Exception:
            continue
        if not bar or bar.close <= 0:
            continue
        
        close_price = bar.close
        open_price = bar.open
        high_price = bar.high
        low_price = bar.low
        volume = bar.volume
        
        # 从缓存读取合约乘数（禁止调 panda_data）
        mul = context.contract_mul.get(symbol, 1.0)
        
        # 3. 获取持仓
        positions = futures_account.positions
        if symbol in list(positions.keys()):
            position = positions[symbol]
            buy_qty = position.buy_quantity        # 多头持仓
            sell_qty = position.sell_quantity       # 空头持仓
        
        # 4. 策略核心逻辑（计算指标 → 判断信号 → 下单）
        # buy_open(context.account, symbol, 1, style=MarketOrderStyle)
```

### 4. `after_trading(context)` — 收盘后（可选）

每天15:30调用一次（仅交易日）。**日志只在此函数打印。**

```python
def after_trading(context):
    futures_account = context.future_account_dict.get(context.account)
    if futures_account:
        pos_count = sum(1 for p in futures_account.positions.values()
                        if p.buy_quantity > 0 or p.sell_quantity > 0)
        print(f"[{context.now}] 权益={futures_account.total_value:.0f} 持仓={pos_count}个 "
              f"盈亏={futures_account.holding_pnl:.0f}")
```

---

## 四、回调函数（可选）

| 函数 | 触发时机 | 参数 |
|------|---------|------|
| `on_stock_trade_rtn(context, order)` | 股票报单成交 | order: Order对象 |
| `stock_order_cancel(context, order)` | 股票撤单 | order: Order对象 |
| `on_future_trade_rtn(context, order)` | 期货报单成交 | order: Order对象 |
| `future_order_cancel(context, order)` | 期货撤单 | order: Order对象 |

Order 对象字段：

| 字段 | 类型 | 描述 |
|------|------|------|
| `order_id` | str | 订单唯一标识 |
| `order_book_id` | str | 合约 |
| `side` | int | 买卖方向（1买 2卖） |
| `effect` | int | 开平方向（0开 1平，仅期货） |
| `price` | double | 价格（限价单） |
| `quantity` | int | 下单数量 |
| `filled_quantity` | int | 已成交数量 |
| `unfilled_quantity` | int | 剩余数量 |
| `status` | int | 状态（1未成交 2已成交 3已撤 -1拒单） |
| `message` | str | 订单信息 |

---

## 五、核心对象模型

### 5.1 context 对象（全局上下文）

```python
# 内置变量
context.now                       # str, 当前日期(yyyyMMdd)
context.trade_date                # str, 交易日期
context.trade_time                # str, 交易时间
context.portfolio_dict            # dict, 收益信息（key=account, value=Portfolio）
context.stock_account_dict        # dict, 股票账户（key=account, value=StockAccount）
context.future_account_dict       # dict, 期货账户（key=account, value=FutureAccount）
context.sub_future_symbol_list    # set, 订阅的期货合约
context.sub_stock_symbol_list     # set, 订阅的股票合约
context.run_info.start_date       # 回测起始日期
context.run_info.end_date         # 回测结束日期
```

### 5.2 Bar 对象（行情）

```python
bar = data['000001.SZ']          # 股票
bar = data['AU2002.SHF']         # 期货

bar.symbol    # 合约
bar.open      # 开盘价
bar.high      # 最高价
bar.low       # 最低价
bar.close     # 收盘价
bar.settle    # 结算价（期货）
bar.last      # 最新价
bar.volume    # 成交量
bar.oi        # 持仓量（期货）
bar.turnover  # 成交金额
```

### 5.3 StockAccount 对象（股票账户）

```python
stock_account = context.stock_account_dict['15032863']

stock_account.total_value     # 总权益
stock_account.cash            # 可用资金
stock_account.frozen_cash     # 冻结资金
stock_account.market_value    # 持仓市值
stock_account.positions       # dict {symbol: StockPositions}
```

### 5.4 StockPosition 对象（股票持仓）

```python
pos = stock_account.positions['000001.SZ']

pos.order_book_id    # 合约代码
pos.quantity         # 持仓数量
pos.sellable         # 可卖数量
pos.market_value     # 持仓市值
pos.avg_price        # 持仓均价
pos.pnl              # 持仓盈亏
```

### 5.5 FutureAccount 对象（期货账户）

```python
futures_account = context.future_account_dict['5588']

futures_account.total_value       # 总权益
futures_account.cash              # 可用资金
futures_account.frozen_cash       # 冻结资金
futures_account.holding_pnl       # 持仓盈亏
futures_account.realized_pnl      # 平仓盈亏
futures_account.margin            # 保证金
futures_account.transaction_cost  # 手续费
futures_account.positions         # dict {symbol: FuturePositions}
```

### 5.6 FuturePosition 对象（期货持仓）

```python
pos = futures_account.positions['AU2601.SHF']

# 多头信息
pos.buy_quantity                 # 多头持仓
pos.buy_today_quantity           # 多头今日持仓
pos.closable_buy_quantity        # 多头可平持仓
pos.buy_margin                   # 多头保证金
pos.buy_pnl                      # 多头累计收益
pos.buy_avg_open_price           # 多头开仓均价
pos.buy_avg_holding_price        # 多头持仓均价
pos.buy_transaction_cost         # 多头手续费

# 空头信息
pos.sell_quantity                # 空头持仓
pos.sell_today_quantity          # 空头今日持仓
pos.closable_sell_quantity       # 空头可平持仓
pos.sell_margin                  # 空头保证金
pos.sell_pnl                     # 空头累计收益
pos.sell_avg_open_price          # 空头开仓均价
pos.sell_avg_holding_price       # 空头持仓均价
pos.sell_transaction_cost        # 空头手续费

# 汇总信息
pos.pnl                          # 总盈亏
pos.daily_pnl                    # 当日盈亏
pos.holding_pnl                  # 持仓盈亏
pos.realized_pnl                 # 已实现盈亏
pos.transaction_cost             # 总手续费
pos.margin                       # 总保证金
pos.market_value                 # 持仓市值
```

---

## 六、交易函数

### 6.1 股票交易

| 函数 | 描述 |
|------|------|
| `order_shares(account, symbol, amount, style)` | 指定股数下单（正数买入，负数卖出） |
| `target_stock_group_order(account, symbol_dict)` | 目标持仓下单（1分钟内调整为指定持仓） |
| `cancel_order(account, order_id)` | 撤单 |

**style 参数：**
- `MarketOrderStyle` — 市价单，立即成交
- `LimitOrderStyle(price)` — 限价单，需指定价格

**账号：** 回测股票使用 `'15032863'`

```python
# 市价买入100股平安银行
order_shares('15032863', '000001.SZ', 100, style=MarketOrderStyle)

# 市价卖出100股平安银行
order_shares('15032863', '000001.SZ', -100, style=MarketOrderStyle)

# 限价买入
order_shares('15032863', '000001.SZ', 100, style=LimitOrderStyle(12.89))

# 目标持仓（调整为指定股数）
target_stock_group_order('15032863', {'000001.SZ': 1000, '600000.SH': 500})
```

### 6.2 期货交易

| 函数 | 描述 |
|------|------|
| `buy_open(account, symbol, amount, style)` | 买入开仓 |
| `sell_open(account, symbol, amount, style)` | 卖出开仓 |
| `buy_close(account, symbol, amount, style)` | 买入平仓（平空头） |
| `sell_close(account, symbol, amount, style)` | 卖出平仓（平多头） |
| `target_future_group_order(account, long_dict, short_dict)` | 目标持仓下单 |
| `cancel_future_order(account, order_id)` | 撤单 |

**账号：** 回测期货使用 `'5588'`（仿真自动替换为真实账号）

```python
# 市价买入开仓
buy_open('5588', 'AG2002.SHF', 1, style=MarketOrderStyle)

# 市价卖出开仓
sell_open('5588', 'AG2002.SHF', 1, style=MarketOrderStyle)

# 买入平仓（平空头）
buy_close('5588', 'AG2002.SHF', 1, style=MarketOrderStyle)

# 卖出平仓（平多头）
sell_close('5588', 'AG2002.SHF', 1, style=MarketOrderStyle)

# 限价单
buy_open('5588', 'AU2002.SHF', 1, style=LimitOrderStyle(428.0))

# 目标持仓（同时指定多头和空头）
target_future_group_order('5588', {'AG2505.SHF': 1}, {'A2505.DCE': 1})
```

---

## 七、数据查询 API（panda_data）

**注意：** 以下 API **只能在 `initialize` 和 `before_trading` 中调用**，不能在 `handle_data` 中调用。

```python
import panda_data

# 获取主力合约映射
panda_data.get_future_dominant(
    underlying_symbol=['AU', 'AG'],
    start_date='20250101',
    end_date='20250131'
)

# 获取合约信息（含乘数）
panda_data.get_future_list(
    symbol=['AU2601.SHF'],
    fields=['symbol', 'contract_multiplier']
)

# 获取行情数据
panda_data.get_market_data(
    symbol='000001.SZ',
    start_date='20250101',
    end_date='20250131',
    type='stock',
    fields=['close', 'high', 'low', 'volume']
)

# 获取因子数据
panda_data.get_factor(
    start_date='20250101',
    end_date='20250131',
    symbol='000001.SZ',
    factors=['pe_ratio', 'pb_ratio'],
    type='stock'
)

# 获取股票详情
panda_data.get_stock_detail(
    symbol='',
    fields=['symbol'],
    market='cn',
    status=1
)

# 获取交易日历
panda_data.get_trading_calendar(start_date, end_date)
```

---

## 八、期货策略标准模板（7 部分结构）

```python
# =====================================================================
# 第一部分：导入和全局常量
# =====================================================================
from panda_backtest.api.api import *
import panda_data
import numpy as np

MODE = 'backtest'
PRODUCTS = ['AU', 'AG', 'CU', 'AL', 'ZN', 'RB', 'HC', 'I', 'BU', 'TA', 'PP', 'MA', 'M', 'P', 'SR']

# =====================================================================
# 第二部分：工具函数
# =====================================================================
def _safe_date(d):
    if d is None: return None
    s = str(d).replace('-', '')
    digits = ''.join(c for c in s if c.isdigit())
    return digits[:8] if len(digits) >= 8 else None

# =====================================================================
# 第三部分：数据预加载（仅 backtest 模式使用）
# =====================================================================
def _preload_all_data(context):
    # 预加载全区间主力合约映射和合约乘数
    # 填充 context._dominant_map 和 context._mul_map
    pass

# =====================================================================
# 第四部分：策略初始化
# =====================================================================
def initialize(context):
    context.account = '5588'
    context.mode = MODE
    # ... 策略参数 ...
    context.today_dominant = {}
    context.contract_mul = {}
    if context.mode == 'backtest':
        _preload_all_data(context)

# =====================================================================
# 第五部分：开盘前数据准备
# =====================================================================
def before_trading(context):
    # 按 MODE 分发，更新 today_dominant 和 contract_mul
    pass

# =====================================================================
# 第六部分：策略核心逻辑（handle_data）
# =====================================================================
def handle_data(context, data):
    # 遍历 today_dominant，计算信号，下单
    pass

# =====================================================================
# 第七部分：收盘后汇总
# =====================================================================
def after_trading(context):
    # 打印日志
    pass
```

**编写自定义策略只需修改：**
1. `PRODUCTS` 列表 → 你的交易品种
2. `initialize` 中的策略参数
3. `handle_data` 中的信号计算和下单逻辑
4. 其他部分保持不变

---

## 九、变量命名规范（期货 MODE 模式）

| 变量 | 含义 | 赋值位置 |
|------|------|---------|
| `products` | 品种列表 ['AU'] | `initialize` |
| `today_dominant` | 当日主力 {品种: symbol} | `before_trading` 每天更新 |
| `contract_mul` | 当日乘数 {symbol: float} | `before_trading` 每天更新 |
| `_dominant_map` | 预加载主力 {(品种,日期): symbol} | `_preload_all_data` |
| `_mul_map` | 预加载乘数 {symbol: float} | `_preload_all_data` |

---

## 十、重要注意事项

1. **引用路径**：回测 `from panda_backtest.api.api import *`，仿真/实盘 `from panda_trading.trading_common.api.api import *`
2. **`handle_data` 中禁止**：调用 `panda_data` 网络请求、高频 `print`
3. **日志只在 `after_trading` 打印**（每天一次）
4. **日期格式**：统一使用 `yyyyMMdd`（如 `20250101`）
5. **异常处理**：对所有 API 调用和对象访问加 `try-except`
6. **`positions` 访问**：使用 `list(positions.keys())` 获取持仓列表，`positions.items()` 遍历
7. **订阅行情**：期货合约切换后需重新 `sub_future_symbol(symbols)`
8. **沪深市场**：深交所 `.SZ`，上交所 `.SH`
