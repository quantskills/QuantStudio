# 🧩 JoinQuant → PandaAI Strategy Converter

[简体中文](README.md) | **English**

> Migrate quantitative trading strategies from JoinQuant (聚宽) to PandaAI (盘达) by understanding strategy intent — not line-by-line translation. Outputs runnable PandaAI JSON strategy configs.

## 📖 What This Is

Converts JoinQuant Python strategies to PandaAI JSON configuration format. Understands the original strategy's trading logic, signal construction, execution rules, and stock universe, then rebuilds everything in PandaAI's declarative format.

**Input**: JoinQuant strategy (.py)
**Output**: PandaAI JSON config + conversion report

## 🚀 Quick Start

```text
Convert this JoinQuant MA crossover strategy to PandaAI format
```

## 📦 Directory Layout

Same as README.md.

## 📐 Constraints

| Constraint | Description |
|---|---|
| 🌐 JQ-specific API limits | Some JoinQuant APIs have no PandaAI equivalent. Convert strategy logic instead. |
| 🚫 No framework function translation | `run_daily/run_weekly/run_monthly` → JSON config fields, not Python functions |
| ⚠️ Signal semantics first | Ensure equivalent trading signals, not exact API syntax |
| 📋 Consistent parameters | Explicit start_date, end_date, init_cash |
| 🔄 State migration | `g.` object → `keep` field or Python variables |

## ⚠️ Disclaimer

Research methodology tool. Does not guarantee identical backtest results between platforms.

## 📜 License

GPL-3.0.
