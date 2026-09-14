# PandaAI Strategy Configuration Format

## Overview

PandaAI strategies use a JSON configuration file as the primary definition. The Python trading logic is embedded within the JSON via `strategy_content` and `trade_template`.

## Full Schema

```json
{
  "strategy_group": "strategy group name (default: '默认分组')",
  "strategy_name": "Unique strategy name",
  "strategy_description": "Brief description of the strategy",
  "strategy_status": 1,
  "run_type": "backtest",           // "backtest" or "simulation" or "real"
  "strategy_type": "stock",         // "stock" for stock trading
  "start_date": "2023-01-01",       // Backtest start
  "end_date": "2023-12-31",         // Backtest end
  "init_cash": 10000000,            // Initial capital (¥)
  "trade_freq": "daily",            // "daily" for daily bars
  "freq_type": "every_bar",         // "every_bar", "week_day", "month_day", "time"
  "freq_value": null,               // null for every_bar, 1-5 for weekday, 1-31 for month day
  "stockpool_type": "index",        // "index", "industry", "concept", "custom"
  "stockpool_stock": ["000300.XSHG"],
  "extra_params": "{}",             // Optional extra parameters (JSON string)
  "trade_template": [
    {
      "type": "buy",               // "buy", "sell", "close"
      "name": "交易条件名称",
      "condition": "Python expression evaluating to True/False",
      "amount": 0.0,               // Shares or factor (see amount semantics below)
      "price": 0.0,                // 0 = market price, >0 = limit price
      "sort_index": 1,             // Execution order (lower runs first)
      "pro_code": "000001.XSHE"    // Stock code to trade
    }
  ],
  "strategy_content": "import pandas as pd\n... Python code ...\n",
  "strategy_extra_content": "import...",
  "strategy_describe": "Description",
  "keep": "{}"                     // JSON string; data preserved across executions
}
```

## Key Fields Explained

### Timing: trade_freq + freq_type + freq_value

| Desired schedule | `trade_freq` | `freq_type` | `freq_value` | Notes |
|---|---|---|---|---|
| Every trading day | `daily` | `every_bar` | `null` | Most common for daily strategies |
| Every Monday | `daily` | `week_day` | `1` | Monday = 1, Tuesday = 2... |
| Every 5th trading day | `daily` | `month_day` | `5` | Trading day of month |
| Every 10 minutes | `minute` | `every_bar` | `null` | Minute-level frequency |

### trade_template: type + amount semantics

**type = "buy"** (买入):
- `amount` = number of shares to buy (positive integer)
- `amount` = 0.x (fraction, e.g., 0.5) = buy using x% of current available cash
- If condition is True, executes the buy

**type = "sell"** (卖出):
- `amount` = number of shares to sell (positive integer)
- `amount` = 0.x (fraction, e.g., 0.3) = sell x% of current position
- If condition is True, executes the sell

**type = "close"** (清仓):
- Sells ALL shares of the specified stock
- `amount` and `price` are ignored
- If condition is True, closes the entire position

### condition expressions

Conditions are Python expressions evaluated in the context where:
- `keep` — A dict carrying state between executions
- `date` — Current execution date string
- Variables defined in `strategy_content` are also accessible
- Return value should be boolean

Examples:
```python
"keep.get('signal_buy', False) == True"
"close_ma5 > close_ma10"
"ma5 > ma20 and close > ma5"
"vol_ratio > 1.5 and price > ma20"
```

### strategy_content: The Trading Logic

This is the Python code that runs before `trade_template` conditions are checked. It should:

1. Import necessary libraries (`pandas`, `numpy`, etc.)
2. Fetch market data via `get_price(pro_code, '1d', count=N)`
3. Compute signals (MA, RSI, factor scores, etc.)
4. Store signal results in `keep` dict for `trade_template` to reference

The `get_price()` function in PandaAI returns a pandas DataFrame with columns:
```python
['open', 'high', 'low', 'close', 'volume', 'pre_close']
# Sorted by date ascending (earliest first, latest last)
```

**IMPORTANT**: The `strategy_content` code runs on each execution tick. Variables computed here can be referenced by `trade_template` conditions.

### keep: Cross-execution State

`keep` is a dict that is preserved across strategy runs. Use it to:
- Store indicator values from previous periods
- Track cumulative metrics
- Pass computed signals to `trade_template`

```python
keep['ma5'] = current_ma5
keep['signal_buy'] = buy_condition
keep['signal_sell'] = sell_condition
```

## Complete Minimal Example

```json
{
  "strategy_group": "默认分组",
  "strategy_name": "MA5_MA20_Cross_{timestamp}",
  "strategy_description": "5日均线上穿20日均线买入，下穿卖出",
  "strategy_status": 1,
  "run_type": "backtest",
  "strategy_type": "stock",
  "start_date": "2023-01-01",
  "end_date": "2023-12-31",
  "init_cash": 10000000,
  "trade_freq": "daily",
  "freq_type": "every_bar",
  "freq_value": null,
  "stockpool_type": "index",
  "stockpool_stock": ["000300.XSHG"],
  "trade_template": [
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
      "name": "死叉卖出",
      "condition": "keep.get('signal_sell', False) == True",
      "amount": 0,
      "price": 0,
      "sort_index": 2,
      "pro_code": "000001.XSHE"
    }
  ],
  "strategy_content": "import pandas as pd\n\nk_data = get_price(pro_code, '1d', count=20)\nif len(k_data) < 20:\n    keep['signal_buy'] = False\n    keep['signal_sell'] = False\nelse:\n    closes = k_data['close'].values\n    ma5 = closes[-5:].mean()\n    ma20 = closes.mean()\n    current_price = closes[-1]\n    keep['signal_buy'] = (current_price > ma5 and ma5 > ma20)\n    keep['signal_sell'] = (current_price < ma5 or ma5 < ma20)\n    print(f'Price={current_price:.2f} MA5={ma5:.2f} MA20={ma20:.2f}')\n",
  "strategy_extra_content": "",
  "strategy_describe": "策略描述",
  "keep": "{}"
}
```

## Notes & Caveats

1. **`pro_code` vs `security`**: In PandaAI, stock codes are used directly. The `.XSHG`/`.XSHE` suffix convention from JoinQuant is preserved where appropriate.

2. **Board lot rounding**: PandaAI handles board lot (100 shares = 一手) rounding automatically. You can specify exact share counts.

3. **Fractional amounts**: Using `0.95` as amount with `type: "buy"` means "use 95% of available cash to buy". This is the PandaAI equivalent of JQ's `order_value(security, cash * 0.95)`.

4. **No explicit short selling**: PandaAI stock strategies are long-only by default.

5. **Multiple stocks**: For multi-stock strategies, either:
   - Define a separate `trade_template` entry per stock with hardcoded `pro_code`
   - Or use the stockpool to define the universe and handle selection in `strategy_content`

6. **`strategy_content` execution context**: The `pro_code` variable is available in `strategy_content` when the strategy is run for a specific stock. For multi-stock strategies, iterate within strategy_content.

7. **Time zones**: PandaAI uses UTC+8 (Beijing time), matching JoinQuant's convention.
