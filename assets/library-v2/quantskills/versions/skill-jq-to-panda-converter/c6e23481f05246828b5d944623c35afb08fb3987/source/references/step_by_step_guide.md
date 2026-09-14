# Step-by-Step Conversion Guide

This guide walks through converting a concrete JoinQuant strategy to PandaAI format using the **MA5/MA20 Crossover** strategy as the running example.

## Step 1: Parse the JQ Strategy

Start with the complete JQ strategy and identify all components.

**Sample JQ Strategy:**
```python
import jqdata

def initialize(context):
    g.security = '000001.XSHE'
    set_benchmark('000300.XSHG')
    set_option('use_real_price', True)
    run_daily(market_open, time='every_bar')
    g.stop_loss = 0.95  # 5% stop loss

def market_open(context):
    security = g.security
    close_data = attribute_history(security, 20, '1d', ['close'])
    cash = context.portfolio.available_cash
    
    # Compute averages
    MA5 = close_data['close'][-5:].mean()
    MA20 = close_data['close'].mean()
    current_price = close_data['close'][-1]
    
    # Buy signal: price above both MA5 and MA20
    if current_price > MA5 > MA20 and security not in context.portfolio.positions:
        order_value(security, cash * 0.95)
        log.info("买入 %s, 价格: %.2f" % (security, current_price))
    
    # Sell signal: below MA5 or MA20
    elif current_price < MA5 or MA5 < MA20:
        if security in context.portfolio.positions:
            order_target(security, 0)
            log.info("卖出 %s, 价格: %.2f" % (security, current_price))
    
    record(ma5=MA5, ma20=MA20, price=current_price)
```

## Step 2: Identify Components

From the strategy above, extract:

| Component | Value |
|-----------|-------|
| **Stock** | `000001.XSHE` (Ping An Bank) |
| **Benchmark** | CSI 300 (`000300.XSHG`) |
| **Data source** | 20-day closing prices |
| **Signal** | Mean-reversion crossover: MA5 > MA20 = bullish, MA5 < MA20 = bearish |
| **Entry condition** | `current_price > MA5 > MA20` |
| **Exit condition** | `current_price < MA5` or `MA5 < MA20` |
| **Entry sizing** | 95% of available cash (order_value pattern) |
| **Exit sizing** | Close all (order_target to 0) |
| **Frequency** | Every trading day |
| **Global state** | `g.security`, `g.stop_loss` |
| **Logging** | `log.info` to print, `record` for charting |
| **Stop loss** | 5% (declared but not fully implemented—note caveat) |

## Step 3: Map to PandaAI Configuration

### 3a: Determine JSON header fields

```json
{
  "strategy_group": "趋势跟踪",
  "strategy_name": "MA5_MA20_Cross_000001",
  "strategy_description": "5日均线上穿20日均线买入，下穿卖出。标的:平安银行(000001.XSHE)",
  "strategy_status": 1,
  "run_type": "backtest",
  "strategy_type": "stock",
  "start_date": "2023-01-01",
  "end_date": "2023-12-31",
  "init_cash": 10000000,
  "trade_freq": "daily",
  "freq_type": "every_bar",
  "freq_value": null,
  "stockpool_type": "custom",
  "stockpool_stock": ["000001.XSHE"]
}
```

### 3b: Build strategy_content (signal computation)

The JQ's `market_open` function logic → PandaAI `strategy_content`:

```python
import pandas as pd

# Fetch 20 days of daily kline data
k_data = get_price(pro_code, '1d', count=20)

if len(k_data) < 20:
    keep['signal_buy'] = False
    keep['signal_sell'] = False
else:
    closes = k_data['close'].values
    MA5 = closes[-5:].mean()            # Last 5 closes
    MA20 = closes.mean()                 # All 20 closes
    current_price = closes[-1]
    
    # Entry: price > MA5 > MA20 (golden cross equivalent)
    keep['signal_buy'] = bool(current_price > MA5 and MA5 > MA20)
    
    # Exit: price < MA5 or MA5 < MA20 (death cross equivalent)
    keep['signal_sell'] = bool(current_price < MA5 or MA5 < MA20)
    
    # Keep values for logging
    keep['MA5'] = float(f"{MA5:.2f}")
    keep['MA20'] = float(f"{MA20:.2f}")
    keep['price'] = float(f"{current_price:.2f}")
    
    print(f"[{date}] Price={current_price:.2f} MA5={MA5:.2f} MA20={MA20:.2f} "
          f"Buy={keep['signal_buy']} Sell={keep['signal_sell']}")
```

### 3c: Build trade_template (execution rules)

| JQ order | PandaAI trade_template entry |
|----------|------------------------------|
| `order_value(s, cash * 0.95)` | Buy with 95% cash |
| `order_target(s, 0)` | Close all position |

```json
{
  "trade_template": [
    {
      "type": "buy",
      "name": "金叉买入 (MA5上穿MA20)",
      "condition": "keep.get('signal_buy', False) == True",
      "amount": 0.95,
      "price": 0,
      "sort_index": 1,
      "pro_code": "000001.XSHE"
    },
    {
      "type": "close",
      "name": "死叉卖出 (MA5下穿MA20)",
      "condition": "keep.get('signal_sell', False) == True",
      "amount": 0,
      "price": 0,
      "sort_index": 2,
      "pro_code": "000001.XSHE"
    }
  ]
}
```

## Step 4: Handle Special Cases / Caveats

### Stop Loss (g.stop_loss = 0.95)

The JQ strategy declares `g.stop_loss = 0.95` but doesn't implement it. Document this:

**In conversion_report.md**: "The original strategy declares stop_loss=5% but the sell logic doesn't reference it. No change needed in converted strategy."

If stop loss logic is actually needed, it would be:
```python
# In strategy_content:
avg_cost = keep.get('avg_cost_000001', current_price)
if avg_cost > 0 and current_price / avg_cost < 0.95:
    keep['signal_stop_loss'] = True
```

### record(ma5, ma20, price)

JQ's `record()` is used for charting during backtests. PandaAI doesn't have an exact equivalent. Document as:

"JQ's `record()` function was used to plot MA5/MA20/price on the backtest chart. In PandaAI, this data can be logged via the strategy's built-in logging or by keeping values in `keep` for analysis."

## Step 5: Verify the Output

Checklist:

- [ ] Signal logic: Same conditions produce same buy/sell decisions
- [ ] Timing: Strategy runs every trading day
- [ ] Stock universe: Only trades `000001.XSHE`
- [ ] Position sizing: Buy uses 95% of cash (equivalent to JQ's `order_value(security, cash * 0.95)`)
- [ ] Exit: Close all position on sell signal (equivalent to JQ's `order_target(security, 0)`)
- [ ] JSON is valid
- [ ] `strategy_content` imports are correct
- [ ] `keep` references in `trade_template` conditions match variable names in `strategy_content`

## Common Conversion Pitfalls

| Issue | JQ | PandaAI | Resolution |
|-------|-----|---------|------------|
| **Board lots** | `order()` accepts any integer | Accepts any integer | PandaAI should handle rounding |
| **Multi-stock ordering** | `order_target_value(s, v)` per stock | Complex mapping | Use loop in `strategy_content` |
| **Index constituents at date** | `get_index_stocks(idx, date)` | Static list in JSON | Accept small difference |
| **Position check** | `s in context.portfolio.positions` | `keep['position']` tracking | Track via keep |
| **Minute frequency** | `run_daily` with `every_bar` at minute freq | `trade_freq: 'minute'` | Change trade_freq |
| **min_commission** | `set_order_cost` | Not configurable | Use PandaAI defaults |
