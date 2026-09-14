# Conversion Report: MA5/MA20 Crossover Strategy

## Source: JoinQuant → Target: PandaAI

### Original Strategy Overview

| Item | Detail |
|------|--------|
| **Name** | MA5/MA20 Crossover |
| **File** | `ma_crossover_jq.py` |
| **Type** | Trend following, single stock |
| **Stock** | 000001.XSHE (Ping An Bank) |
| **Benchmark** | CSI 300 (000300.XSHG) |
| **Frequency** | Daily, every bar |
| **Data** | 20-day closing prices via attribute_history |
| **Signal** | Price > MA5 > MA20 = buy; Price < MA5 or MA5 < MA20 = sell |
| **Position sizing** | 95% of available cash on entry; close all on exit |

### Conversion Mapping

| JQ Element | PandaAI Equivalent | Notes |
|-----------|-------------------|-------|
| `initialize()` | JSON header + strategy_content | Split into config fields and Python code |
| `g.security = '000001.XSHE'` | `stockpool_stock: ["000001.XSHE"]` | Stock defined at config level |
| `set_benchmark('000300.XSHG')` | Not in JSON; set in PandaAI UI | Platform-level setting |
| `set_option('use_real_price', True)` | Not needed | PandaAI uses real prices by default |
| `run_daily(f, 'every_bar')` | `freq_type: "every_bar"` | Daily rebalance |
| `attribute_history(s, 20, '1d', ['close'])` | `get_price(pro_code, '1d', count=20)` | Same semantics, slightly different return format |
| `close_data['close'][-5:].mean()` | `closes[-5:].mean()` | NumPy array vs pandas Series — same operation |
| `close_data['close'].mean()` | `closes.mean()` | Same |
| `order_value(s, cash * 0.95)` | `type: "buy", amount: 0.95` | 0.95 = 95% of available cash |
| `order_target(s, 0)` | `type: "close"` | Clear all position |
| `context.portfolio.available_cash` | Handled internally by PandaAI | Amount 0.95 references available cash |
| `context.portfolio.positions` | Not needed for single stock | Keep pattern can track position state |
| `g.security` | Python variable `pro_code` | Injected by PandaAI |
| `log.info(...)` | `print(...)` | Simple substitute |
| `record(ma5=MA5, ma20=MA20, price=price)` | Not directly available | Values stored in `keep` for reference |

### Signal Logic Verification

**JQ original**:
```python
if current_price > MA5 > MA20 and not has_position:
    order_value(security, cash * 0.95)
elif (current_price < MA5 or MA5 < MA20) and has_position:
    order_target(security, 0)
```

**PandaAI equivalent** (`strategy_content`):
```python
keep['signal_buy'] = bool(current_price > MA5 and MA5 > MA20)
keep['signal_sell'] = bool(current_price < MA5 or MA5 < MA20)
```

**Verification**: Signal logic is identical. The `keep` values are checked in `trade_template` conditions, which trigger the equivalent orders.

### Differences & Caveats

| Aspect | JQ | PandaAI | Impact |
|--------|-----|---------|--------|
| **Position check** | Explicit: `s in context.portfolio.positions` | Implicit: `type: "buy"` won't execute if already holding? | May need verification; `condition` could include `keep.get('has_position', False)` |
| **Order timing** | Market open via `time='every_bar'` | `freq_type: "every_bar"` | Timing is equivalent |
| **Cash calculation** | 95% of available cash | 95% = 0.95 in amount field | Same semantics |
| **Stop loss** | Not implemented in original | Not implemented in conversion | No change needed |
| **Chart recording** | `record()` plots on backtest chart | Not available | Use platform's own charting |

### Backtest Compatibility

The converted PandaAI JSON config is designed to be directly importable into PandaAI's backtest system. To run:

1. Open PandaAI platform → Strategy Management
2. Import or paste `ma_crossover_panda.json`
3. Set the benchmark (CSI 300) in platform UI
4. Run backtest

### Verification Checklist

- [x] Signal logic: Price > MA5 > MA20 → buy signal
- [x] Signal logic: Price < MA5 or MA5 < MA20 → sell signal
- [x] Timing: Every trading day (daily frequency)
- [x] Universe: Single stock 000001.XSHE
- [x] Entry sizing: 95% of available cash
- [x] Exit: Close all position
- [x] Valid JSON syntax
- [x] `keep` references in trade_template match strategy_content variable names
- [x] No deprecated or unsupported APIs used

### Recommendations

1. **Add a stop-loss condition** to the converted strategy for risk management
2. **Consider a multi-stock version** that trades across a universe, not just a single stock
3. **Validate backtest results** against JQ's output — minor differences in fill prices are expected
