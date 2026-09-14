# skill-factor-evaluate

[简体中文](./README.md) | [English](./README.en.md)

Not a backtest engine, but a **single-factor scoring Skill**: dual IC + Sharpe + MDD + monotonicity + turnover → normalized weighted primary score.

`role: skill` `output: ScoreReport` `paradigm: pooled cross-section`

---

`skill-factor-evaluate` is the **factor evaluation Skill** provided by PandaAI Quant Skills. Given a cross-section signal `[date × symbol]`, it outputs a complete health report: cross-section validity / risk-adjusted return / robustness / turnover cost, with a comparable composite score from a normalized weighted formula.

It does **not** replace your project's `primary_score()` — instead, it tells the AI Agent to **always call the project's implementation** to preserve evaluation consistency.

## 🎯 What This Skill Solves

A single IC number can't tell you if a factor is good:

- High IC but negative Sharpe → classic IC-farming trap
- High IC but huge MDD → live trading disaster
- Average overall IC but small-cap IC=0.08, large-cap IC=0 → capacity-limited
- Beautiful IC but Pearson IC much lower than rank IC → magnitude distortion

This Skill enforces **7 metrics** and a **6-panel breakdown report**:

- rank IC + Pearson IC (dual comparison)
- IC_IR
- Sharpe + annual return + max drawdown
- 5/10-quantile monotonicity
- Annual turnover

## ⚡ Evaluation Pipeline

```
1. Validate signal contract (size / mean / std / NaN ratio)
2. Compute rank IC + Pearson IC time series
3. Run long-only backtest: T+1 open buy Top 10%, equal weight, 15bp two-way fee, T+1+H sell
4. Compute quantile monotonicity (5 or 10 buckets)
5. Compute annual turnover
6. Apply primary score formula → output ScoreReport
```

## 🧮 Primary Score Formula (Normalized Weighted v2)

```
score = 0.20 * ic_term       # cross-section validity
      + 0.30 * shp_term      # Sharpe
      + 0.30 * ret_term      # annual return
      + 0.20 * mdd_term      # max drawdown
      + 0.10 * mono_term     # monotonicity
      + 0.10 * turn_term     # turnover penalty
```

Each component is normalized to ~[-2, +2], and the overall score is also ~[-2, +2]. See `references/primary-score.md`.

## 🗃️ Input Requirements

- Signal: `[date × symbol]` float DataFrame, cross-section z-scored
- Market panel: with `open` / `close` / `high` / `low` / `volume`
- HORIZON: must match the signal's declared holding period

## 📦 Repository Layout

```
skill-factor-evaluate/
├── SKILL.md
├── README.md / README.en.md
├── references/
│   ├── metrics.md                      # 7 metrics + generic implementation
│   ├── dual-ic.md                      # rank vs Pearson diagnostic table
│   ├── primary-score.md                # Normalized weighted formula + reweighting guide
│   ├── report-format.md                # Standard 6-panel report template
│   └── anti-patterns.md                # 10 anti-patterns + danger signals
└── agents/
    ├── openai.yaml
    ├── cursor-rule.mdc
    └── portable-loader.md
```

## 🚀 Quick Start

Drop `skill-factor-evaluate/` into your Agent's skills directory. Auto-loaded when triggers fire ("evaluate factor / score factor / factor score").

Also usable via `agents/portable-loader.md` in plain ChatGPT.

## 📄 Report Output Format

```
=== Factor Evaluate Report ===
Factor    : f_amihud_20
Horizon   : 5d
Period    : 2021-12-04 → 2024-12-03 (val, 3.0y)

Score                : +0.4123    (v2 formula)
├─ IC term  (0.20)  :  0.42       rank_ic_ir=2.1
├─ Shp term (0.30)  :  0.85       sharpe=0.85
├─ Ret term (0.30)  :  0.62       annual_ret=18.6%
├─ MDD term (0.20)  :  0.47       max_dd=-22.3%
├─ Mono     (0.10)  :  0.78       monotonicity=0.78
└─ Turn pen (0.10)  : -0.12       ann_turnover=33.5

Diagnostics (not in score):
  rank IC mean      : +0.038
  pearson IC mean   : +0.029     ← rank > pearson, magnitude distortion
  IC > 0 ratio      : 62%
```

## 🧭 Relation to Other PandaAI Quant Skills

| Repository | Purpose |
|---|---|
| skill-factor-mine | Propose single-point hypothesis → modify code |
| **skill-factor-evaluate** (this) | Score the modified factor |
| skill-backtest | Detailed backtest (NAV / quantiles / monthly heatmap / benchmark) |
| skill-ic-analysis | IC multi-dim diagnostics (decay / subsample / Jaccard / timeline) |
| skill-factor-debug | Diagnose scoring anomalies |
| skill-factor-review | Whole library review |

## 📜 Project Status & Boundaries

- **Status**: Community Project, not officially reviewed / certified / endorsed
- **Data Source**: This repository ships no market data. Users must supply their own market panel; data legality and licensing are the user's responsibility
- **Core Assumptions**: T+1 open execution, Top 10% equal weight, 15bp two-way fee; A-share limit-up/down + suspension exclusion; HORIZON ∈ (1, 3, 5, 10, 20)
- **Known Limitations**: Default primary score formula targets long-only mid-frequency strategies; other use cases need reweighting (see `references/primary-score.md`)
- **Risk Boundary**: score reflects statistical performance under historical data + assumptions only, not future performance
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
