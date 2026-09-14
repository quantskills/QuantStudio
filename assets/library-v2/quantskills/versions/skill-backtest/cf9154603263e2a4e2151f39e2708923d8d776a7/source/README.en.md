# skill-backtest

[简体中文](./README.md) | [English](./README.en.md)

Not a backtest framework, but a **standard protocol for cross-section long-only backtesting**: T+1 open execution, Top equal weight, 15bp two-way fee, limit-up/down exclusion, 4-panel diagnostic chart, 5-item health check.

`role: skill` `output: NAV + diagnostic charts` `paradigm: cross-section long-only`

---

`skill-backtest` is the **cross-section long-only backtest Skill** provided by PandaAI Quant Skills. It standardizes the chain "signal → real-money NAV curve": unified execution assumptions, unified fees, unified diagnostics — so backtests of different factors are comparable.

## 🎯 What This Skill Solves

Backtests are bug-prone, and bugs always make backtests look better:

- Using `close[T]` as T-day execution price → Sharpe goes to the moon
- Not excluding limit-up/down → returns from un-buyable trades
- No fees → high-turnover strategies pretend to make money
- Backtesting 2018 with currently-alive stocks → survivorship bias
- T+0 assumption on A-shares → not achievable in live

This Skill **locks all these assumptions**, plus a **5-item health check**:

- Holding count stable near Top X%
- Daily turnover ≈ 2/H
- Sharpe ≈ IC_IR × 0.3 ~ 0.5
- MDD between -20% and -40%
- Full-position time > 80%

Any item failing → suspect a bug, don't trust the result.

## ⚡ Backtest Protocol

| Item | Standard |
|---|---|
| Selection | Daily Top 10% by signal cross-section rank |
| Entry | T+1 open |
| Exit | T+1+H open |
| Sizing | Equal weight (Top N split equally) |
| Overlap | 1/H capital rebalanced daily (rolling sleeves) |
| Cannot buy | `trade_status==1` or `close >= limit_up*0.99` |
| Cannot sell | `trade_status==1` or `close <= limit_down*1.01` |
| Fee | 15 bp two-way |
| Capital | Infinite, no market impact |

## 🗃️ Input Requirements

Market panel must contain:

```
date, symbol, open, close, high, low, volume,
trade_status, limit_up, limit_down
```

Cross-market adjustments: US stocks have no limit-up/down — use proxies like `gap_open > 5%`; futures by product. See `references/assumptions.md`.

## 📦 Repository Layout

```
skill-backtest/
├── SKILL.md
├── README.md / README.en.md
├── references/
│   ├── assumptions.md                  # Standard assumptions (A-share / US / futures)
│   ├── algorithm.md                    # Rolling-sleeve backtest core algorithm
│   ├── diagnostic-charts.md            # 4-panel / 6-panel chart skeleton
│   ├── health-check.md                 # 5-item health check + diagnostic flow
│   └── anti-patterns.md                # 10 anti-patterns + danger signals
└── agents/
    ├── openai.yaml
    ├── cursor-rule.mdc
    └── portable-loader.md
```

## 🚀 Quick Start

Drop `skill-backtest/` into your Agent's skills directory. Auto-loaded on triggers ("backtest / NAV plot / benchmark comparison").

## 📊 Standard Diagnostic Chart (4-panel baseline)

```
┌─────────────────────┬─────────────────────┐
│ ① NAV curve         │ ② Cumulative IC     │
│   strategy vs bench │   cum daily rank IC │
├─────────────────────┼─────────────────────┤
│ ③ Quantile returns  │ ④ Drawdown          │
│   Q1 ~ Q5 bars      │   underwater curve  │
└─────────────────────┴─────────────────────┘
```

Advanced 6-panel: add monthly heatmap + turnover timeline. See `references/diagnostic-charts.md`.

## 🧪 5-Item Health Check (mandatory after backtest)

| Check | Expected | If failed |
|---|---|---|
| Holding count | ≈ Top X% | universe wrong / limit-up filter too strict |
| Turnover | ≈ 2/H | signal noise-dominated |
| Sharpe vs IC_IR | Sharpe ≈ IC_IR × 0.3 ~ 0.5 | close-as-price / no fees / T+0 |
| MDD | -20% ~ -40% | < 5% almost certainly look-ahead |
| Full position time | > 80% | too many NaN in signal |

## 🧭 Relation to Other PandaAI Quant Skills

| Repository | Purpose |
|---|---|
| skill-factor-mine | Propose + modify code |
| skill-factor-evaluate | Score factor (includes simplified backtest) |
| **skill-backtest** (this) | Detailed backtest + diagnostics + benchmark |
| skill-ic-analysis | No NAV, only IC decay |
| skill-factor-debug | Diagnose backtest anomalies |
| skill-factor-review | Whole library backtest review |

## 📜 Project Status & Boundaries

- **Status**: Community Project, not officially reviewed / certified / endorsed
- **Data Source**: This repository ships no market data. Users must supply their own market panel; data legality and licensing are the user's responsibility
- **Core Assumptions**: T+1 open execution, Top 10% equal weight, 15bp two-way fee; infinite capital, no market impact
- **Known Limitations**: No call auction slippage / shorting constraints / large-order impact simulated; no dividend / split / corporate action handling
- **Risk Boundary**: Backtest NAV reflects simulated returns under historical data + assumptions only, not future performance, **not equivalent to live-attainable returns**
- **Usage**: For quantitative research, education, and methodology reference only. **Does not constitute investment advice, trading signals, or profit guarantees of any form**

## 📜 License

This repository is licensed under the GNU General Public License v3.0. See LICENSE.

Copyright (C) 2026 QuantSkills.

## 🐼 PandaAI / QUANTSKILLS Community

<div align="center">
  <img src="https://raw.githubusercontent.com/quantskills/.github/main/profile/assets/pandaai-community-qr.jpg" alt="PandaAI community QR code" width="220">
  <br>
  <sub>Scan the QR code to join the PandaAI community for QUANTSKILLS skills, agent workflows, and quantitative research practice.</sub>
</div>
