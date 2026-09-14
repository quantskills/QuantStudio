# JoinQuant (聚宽) API Patterns Reference

## Overview

This file exhaustively documents the JoinQuant Python API patterns found in strategies, their semantics, and how to map them to PandaAI.

## 1. Strategy Framework Functions

### 1.1 initialize(context)

**JQ semantics**: Called once at strategy start. Sets up global state, configures platform options, registers scheduled functions.

**Typical contents**:
```python
def initialize(context):
    g.security = '000001.XSHE'                 # Global variable
    set_benchmark('000300.XSHG')               # Benchmark
    set_option('use_real_price', True)          # Real price mode
    run_daily(market_open, time='every_bar')    # Schedule main function
    g.stocks = get_index_stocks('000300.XSHG')  # Stock universe
```

**PandaAI mapping**: `strategy_content` block runs once at init. Configuration is split between JSON fields and the `strategy_content` Python code.

| JQ element | PandaAI mapping |
|-----------|-----------------|
| `g.variable = value` | Python variable in `strategy_content` or `keep` JSON field |
| `set_benchmark(value)` | Not directly configurable; benchmark is set in PandaAI platform UI |
| `set_option(...)` | Not needed; PandaAI uses real prices by default |
| `run_daily(func, time)` | `freq_type`: `'every_bar'`, `'week_day'`, `'month_day'` + `freq_value` |
| `run_weekly(func, weekday, time)` | `freq_type: 'week_day'`, `freq_value: <weekday>` |
| `run_monthly(func, tradingday, time)` | `freq_type: 'month_day'`, `freq_value: <tradingday>` |
| Stock universe setup | `stockpool_type` + `stockpool_stock` JSON fields |

### 1.2 handle_data(context, data)

**JQ semantics**: Called on every bar (daily or minute depending on frequency). `data` parameter provides current market snapshot.

**PandaAI mapping**: The signal computation logic that would be in `handle_data` goes into `strategy_content` as Python code. The execution timing is controlled by JSON `freq_type`/`freq_value`. The `trade_template` JSON array defines the conditions for executing trades.

**Key difference**: In PandaAI, `trade_template` conditions reference computed signal values from `strategy_content`. The "handle_data" logic split into two parts:
1. Signal computation (Python code in `strategy_content`)
2. Trade execution rules (declarative in `trade_template` JSON)

### 1.3 before_trading_start(context) / after_trading_end(context)

**JQ semantics**: Called before market open (9:00) and after market close.

**PandaAI mapping**: For PandaAI, initialization of day-level state goes in `strategy_content` (runs at start). Post-market logic can be added but is not commonly used.

## 2. Data Fetching APIs

### 2.1 attribute_history(security, count, unit, fields, ...)

**JQ signature**: `attribute_history(security, count, unit='1d', fields=['close', 'high', 'low', 'open', 'volume'], skip_paused=False, df=True, fq='pre')`

**Returns**: pandas DataFrame with `fields` as columns, indexed by datetime.

**Example**:
```python
close_data = attribute_history(security, 5, '1d', ['close'])
MA5 = close_data['close'].mean()
current_price = close_data['close'][-1]
```

**PandaAI mapping**: In the `strategy_content` Python code:
```python
# Equivalent: get daily kline data for the stock
k_data = get_price(pro_code, '1d', count=5)
# k_data is a DataFrame with columns: ['open','high','low','close','volume','pre_close']
# Note: k_data is sorted by date ascending
MA5 = k_data['close'].mean()
current_price = k_data['close'].iloc[-1]  # Most recent close
```

**Watch out**: `attribute_history` returns data where `[-1]` is the **most recent** value. `get_price` in PandaAI returns data sorted by date ascending (earliest first), so `iloc[-1]` gives the most recent.

### 2.2 history(count, unit, field, ...)

**JQ signature**: `history(count, unit='1d', field='close', security_list=None, skip_paused=False, fq='pre')`

**Returns**: Returns data for **multiple** securities at once. Returns a DataFrame with securities as columns and dates as index (if security_list is a list) or a dict if not specified.

**PandaAI mapping**: Fetch data per security or use the `get_price` function inside `strategy_content` for multiple stocks:
```python
# For a list of stocks in your universe
prices_df = pd.DataFrame()
for stock in g.stocks:
    k_data = get_price(stock, '1d', count=5)
    prices_df[stock] = k_data['close']
```

### 2.3 get_price(security, start_date=None, end_date=None, frequency='daily', fields=None, skip_paused=False, fq='pre', count=None, panel=True, fill_paused=True)

**JQ signature**: Flexible historical data function supporting date ranges or count-based queries.

**PandaAI mapping**: PandaAI's own `get_price()` function serves the equivalent purpose:
```python
# Count-based (similar to attribute_history)
k_data = get_price(pro_code, '1d', count=30)

# Date-range based
k_data = get_price(pro_code, '1d', start_date='2023-01-01')
```

### 2.4 get_fundamentals(query_object, date=None, statDate=None)

**JQ semantics**: Queries financial data (balance sheet, income statement, valuation indicators) using SQLAlchemy query syntax.

**Typical usage**:
```python
# Get stocks with PE < 20 and PB < 2
q = query(
    valuation.code, valuation.pe_ratio, valuation.pb_ratio,
    indicator.roe, indicator.market_cap
).filter(
    valuation.pe_ratio < 20,
    valuation.pb_ratio < 2,
    indicator.roe > 0.1
).order_by(
    valuation.market_cap.desc()
)
df = get_fundamentals(q)
```

**PandaAI mapping**: Fundamental data is fetched via `get_fundamentals()` inside `strategy_content`:
```python
# Equivalent in PandaAI strategy_content
fund_df = get_fundamentals(pro_code, 'pe_ttm', 'pb')
# Returns a dict or DataFrame with fundamental indicators
```

**Note**: The exact financial indicators available may differ between platforms. Common indicators like PE, PB, ROE, market cap are generally available. Complex queries with multiple table joins may need to be broken into multiple calls.

### 2.5 get_fundamentals_continuously(query_object, date_list)

**JQ semantics**: Similar to `get_fundamentals` but returns data for multiple dates.

## 3. Stock Universe APIs

### 3.1 get_index_stocks(index_symbol, date=None)

**JQ**: `get_index_stocks('000300.XSHG')` → returns list of stock codes in CSI 300

**PandaAI**: In JSON config, set:
```json
{
  "stockpool_type": "index",
  "stockpool_stock": ["000300.XSHG"]
}
```
Or specify individual stocks directly in `stockpool_stock`.

### 3.2 get_industry_stocks(industry_code, date=None)

**JQ**: `get_industry_stocks('A01')` → stocks in a specific industry

**PandaAI**: For industry-based screening, pre-compute the stock list or define in `stockpool_stock`.

### 3.3 get_concept_stocks(concept_code, date=None)

**JQ**: `get_concept_stocks('GN001')` → stocks in a concept/theme

### 3.4 get_security_info(security)

**JQ**: Gets basic info about a security (name, start date, end date, type).

## 4. Order / Execution APIs

### 4.1 order(security, amount, ...)

**JQ signature**: `order(security, amount, style=None, side='long', pindex=0, close_today=False)`
- `amount > 0` = buy, `amount < 0` = sell
- `style` = None (market order), `LimitOrderStyle(limit_price)`, etc.

**PandaAI mapping**: In `trade_template`:
```json
{
  "type": "buy",
  "name": "买入信号触发",
  "condition": "signal_buy == True",
  "amount": 1000,
  "price": 0,
  "sort_index": 1,
  "pro_code": "000001.XSHE"
}
```
Where `signal_buy` is a boolean variable computed in `strategy_content`.
- `type`: `"buy"`, `"sell"`, or `"close"`
- `condition`: Python expression referencing variables from `strategy_content`
- `amount`: positive = shares to buy/sell. `0.0` means "use condition logic"
- `price`: `0` = market price (市价单)
- `pro_code`: Stock code in PandaAI format

### 4.2 order_value(security, value, ...)

**JQ**: Buys/sells a value (in RMB) worth of shares. e.g., `order_value('000001.XSHE', 10000)` buys ¥10,000 worth of stock.

**JQ semantics**: Converts value to shares: `shares = floor(value / price)`.

**PandaAI mapping**: Not directly supported as a field. In `strategy_content`, compute shares:
```python
# Original JQ: order_value('000001.XSHE', cash)
# In PandaAI strategy_content, pre-compute and set amount:
current_price = k_data['close'].iloc[-1]
buy_shares = int(cash / current_price) // 100 * 100  # Round to board lot
# Then use buy_shares in trade_template condition
```

### 4.3 order_target(security, amount, ...)

**JQ**: Orders to reach a target number of shares. `order_target('000001.XSHE', 0)` → sell all.
`order_target('000001.XSHE', 1000)` → adjust to exactly 1000 shares.

**PandaAI mapping**: Use `type: "close"` to sell all shares. For target position:
```python
# Compute needed shares in strategy_content
current_position = keep.get('position', 0)
current_price = k_data['close'].iloc[-1]
target_shares = 1000
diff = target_shares - current_position
# Then reference diff in trade_template condition
```

### 4.4 order_target_value(security, value, ...)

**JQ**: Orders to reach a target total value of shares. `order_target_value('000001.XSHE', 0)` → sell all.

## 5. Portfolio / Position APIs

### 5.1 context.portfolio

**JQ**:
```python
context.portfolio.available_cash      # Available cash
context.portfolio.total_value          # Total portfolio value
context.portfolio.positions           # Dict of positions
context.portfolio.returns              # Cumulative return
```

**PandaAI mapping**: In `strategy_content`, portfolio state is managed through `keep`:
```python
# PandaAI equivalent - keep data is preserved across executions
available_cash = keep.get('available_cash', init_cash)
```

### 5.2 context.portfolio.positions[security]

**JQ**:
```python
pos = context.portfolio.positions['000001.XSHE']
pos.total_amount        # Total shares (including frozen)
pos.closeable_amount    # Sellable shares
pos.value               # Market value
pos.avg_cost            # Average cost basis
pos.p_price             # Previous trading day's close
pos.price               # Current price
```

**PandaAI mapping**: Position tracking in `strategy_content` via `keep`:
```python
# Store positions in keep dict
position = keep.get('position_' + pro_code, 0)
avg_cost = keep.get('avg_cost_' + pro_code, 0.0)

# Update after each trade
# (PandaAI manages this internally - strategy_content just defines the signal)
```

## 6. Common Technical Patterns in JQ Strategies

### Pattern A: Moving Average Crossover

**JQ code**:
```python
def initialize(context):
    g.security = '000001.XSHE'
    set_benchmark('000300.XSHG')
    set_option('use_real_price', True)
    run_daily(market_open, time='every_bar')

def market_open(context):
    security = g.security
    close_data = attribute_history(security, 20, '1d', ['close'])
    MA5 = close_data['close'][-5:].mean()
    MA20 = close_data['close'].mean()
    current_price = close_data['close'][-1]
    cash = context.portfolio.available_cash

    if current_price > MA5 and MA5 > MA20 and security not in context.portfolio.positions:
        order_value(security, cash * 0.95)
        log.info("Buy %s at price %s" % (security, current_price))
    elif current_price < MA5 or MA5 < MA20:
        if security in context.portfolio.positions:
            order_target(security, 0)
            log.info("Sell %s at price %s" % (security, current_price))
```

**PandaAI equivalent** (`strategy_content`):
```python
# strategy_content for PandaAI
# This code runs at each rebalance interval
import pandas as pd

# Get market data
k_data = get_price(pro_code, '1d', count=20)
if len(k_data) < 20:
    signal_buy = False
    signal_sell = False
else:
    closes = k_data['close'].values
    MA5 = closes[-5:].mean()
    MA20 = closes.mean()
    current_price = closes[-1]
    
    signal_buy = (current_price > MA5 and MA5 > MA20)
    signal_sell = (current_price < MA5 or MA5 < MA20)

keep['signal_buy'] = signal_buy
keep['signal_sell'] = signal_sell
print(f"[{date}] Price={current_price:.2f} MA5={MA5:.2f} MA20={MA20:.2f} Buy={signal_buy} Sell={signal_sell}")
```

**PandaAI equivalent** (`trade_template`):
```json
[
  {
    "type": "buy",
    "name": "金叉买入",
    "condition": "keep.get('signal_buy', False) == True",
    "amount": 0.95,
    "price": 0,
    "sort_index": 1,
    "pro_code": "000001.XSHE"
  },
  {
    "type": "close",
    "name": "死叉清仓",
    "condition": "keep.get('signal_sell', False) == True",
    "amount": 0,
    "price": 0,
    "sort_index": 2,
    "pro_code": "000001.XSHE"
  }
]
```

### Pattern B: Factor-based Multi-stock Selection

**JQ code**:
```python
def initialize(context):
    set_benchmark('000300.XSHG')
    g.stocks = get_index_stocks('000300.XSHG')
    run_monthly(rebalance, 1)

def rebalance(context):
    # Filter by fundamental factors
    q = query(
        valuation.code, valuation.pe_ratio, valuation.pb_ratio,
        indicator.roe, indicator.market_cap
    ).filter(
        valuation.pe_ratio > 0,
        valuation.pe_ratio < 30,
        indicator.roe > 0.1
    ).order_by(indicator.roe.desc()).limit(20)
    
    df = get_fundamentals(q)
    buy_list = df['code'].values
    
    # Sell positions not in buy list
    for stock in context.portfolio.positions:
        if stock not in buy_list:
            order_target(stock, 0)
    
    # Buy new stocks
    for stock in buy_list:
        order_target_value(stock, context.portfolio.available_cash / len(buy_list))
```

**PandaAI equivalent**: The factor-based multi-stock pattern is the most complex conversion. Use `strategy_content` to build the stock list, then individual trade conditions per stock.

## 7. JQ API → PandaAI Equivalent Table

| JQ API | PandaAI equivalent | Notes |
|--------|-------------------|-------|
| `attribute_history(s, c, u, f)` | `get_price(pro_code, u, count=c)[f]` | Same semantics, API rename |
| `history(c, u, f, s_list)` | Loop: `get_price(s, u, count=c)[f]` | Multi-stock → loop |
| `get_price(s, sd, ed, f)` | `get_price(pro_code, '1d', start_date=sd)` | Similar but with platform adaptation |
| `get_fundamentals(q)` | `get_fundamentals(pro_code, ...)` | Simpler interface in PandaAI |
| `get_index_stocks(idx)` | `stockpool_type: 'index'` | JSON config level |
| `get_industry_stocks(ind)` | `stockpool_stock: [...]` | Pre-compute list |
| `order(s, amt)` | `trade_template[].amount` | Declarative in JSON |
| `order_value(s, val)` | Pre-compute in strategy_content | Not a direct field |
| `order_target(s, 0)` | `type: 'close'` | Clear all position |
| `run_daily(f, 'every_bar')` | `freq_type: 'every_bar'` | Daily rebalance |
| `run_weekly(f, 1, t)` | `freq_type: 'week_day', freq_value: 1` | Monday schedule |
| `run_monthly(f, 1, t)` | `freq_type: 'month_day', freq_value: 1` | 1st trading day |
| `context.portfolio.available_cash` | `keep.get('cash_available', init_cash)` | Track in keep |
| `g.variable` | Python variable in strategy_content | Global state |
| `log.info(msg)` | `print(msg)` | Simple logging |
| `record(name=value)` | `print(f"RECORD: {name}={value}")` | Manual equivalent |
| `set_benchmark(idx)` | Set in PandaAI platform UI | Not in config JSON |
| `set_option(...)` | Not needed | PandaAI defaults |
| `is_st_stock(s)` | Check suffix in code | `.XSHG`/`.XSHE` |
