# 📑 Report Replication

[简体中文](README.md) | **English**

> Turns a quantitative research report, paper, PDF, webpage, or text source into a complete research replication package: full translation → factor formula reconstruction → effectiveness validation → strategy code → real local backtest → delivery summary.

<p align="center">
  <img alt="pipeline" src="https://img.shields.io/badge/pipeline-6_stages-brightgreen">
  <img alt="metrics" src="https://img.shields.io/badge/metrics-IC%20%C2%B7%20RankIC%20%C2%B7%20ICIR%20%C2%B7%20Sharpe%20%C2%B7%20Calmar-blue">
  <img alt="backtest" src="https://img.shields.io/badge/backtest-bundled_local_engine-orange">
  <img alt="quality gate" src="https://img.shields.io/badge/quality_gate-quality__gate__check.py-red">
  <img alt="data" src="https://img.shields.io/badge/data-Pandadata-9cf">
  <img alt="license" src="https://img.shields.io/badge/license-GPLv3-blue">
</p>

---

## 📖 What is this

`report-replication` is a self-contained **Codex/Agent skill** for turning a quantitative research report, paper, PDF, webpage, or text source into a complete research replication package.

The default output root is:

```text
/home/coder/project/replication/report-replication
```

## ⚡ Replication Pipeline

```mermaid
flowchart LR
    S["📥 Report / paper / PDF<br/>webpage / text"] --> T1["1️⃣ Full translation<br/>01_translation"]
    T1 --> T2["2️⃣ AI summary +<br/>factor formula reconstruction<br/>02_factor_reproduction"]
    T2 --> T3["3️⃣ Factor validation<br/>HTML report<br/>03_factor_validation"]
    T3 --> T4["4️⃣ BACKTEST strategy code<br/>04_backtest_strategy"]
    T4 --> T5["5️⃣ Real backtest on the<br/>bundled engine<br/>local_backtest.py"]
    T5 --> T6["6️⃣ Delivery summary /<br/>failure report<br/>06_delivery"]
    T6 --> Q{"🚦 Quality gate<br/>quality_gate_check.py"}

    style S fill:#e3f2fd,stroke:#1976d2
    style T5 fill:#fff3e0,stroke:#f57c00
    style T6 fill:#e8f5e9,stroke:#388e3c
    style Q fill:#ffebee,stroke:#c62828
```

## 🚧 Boundaries

This skill should **not call other research or data skills** during these stages:

- Report translation.
- Factor formula reconstruction.
- Factor validation.
- Data preparation.
- BACKTEST strategy generation.
- BACKTEST execution.

## 🗃️ Data Rules

The default production data source is **Pandadata / the `panda_data` SDK**. When factor validation or BACKTEST needs daily market data, first run `scripts/pandadata_market_data.py` and save the cache plus metadata under `03_factor_validation/data_cache/`.

Credentials are loaded only from the current environment or `~/.pandadata/pandadata.env`: `DEFAULT_USERNAME`, `DEFAULT_PASSWORD`, and `JAVA_SERVICE_BASE_URL`. Do not write usernames, passwords, or tokens into the repository, reports, manifest, or logs.

Use user-provided files or other sources only when Pandadata does not cover the required dataset, and record the reason in `manifest.json`, the HTML report, and the delivery summary.

> 🚫 Do not use synthetic data, simulated market data, or random market data to prove factor effectiveness. Random factors with a fixed seed may only be used as negative controls against the same real return data.

## 📦 Output Layout

```text
/home/coder/project/replication/report-replication/{report_id}/
  01_translation/
    full_translation.md                 # full translation
  02_factor_reproduction/
    ai_summary_and_factor_formula.md    # AI summary & factor formula
    reference_implementation.py         # reference implementation
  03_factor_validation/
    factor_validation_report.html       # factor validation HTML report
    data/
      benchmark_comparison.csv
      backtest_alignment_audit.csv
    data_cache/
      pandadata_market_data.csv
      pandadata_market_data.csv.metadata.json
    charts/
  04_backtest_strategy/
    strategy.py                         # BACKTEST strategy
    config.json
    backtest_report.html                # backtest report
    backtest_report_raw.html
    backtest_logs/
      signal_log.jsonl
      equity_curve.csv
      performance_metrics.csv
      trades.csv
      position_return_detail.csv
  06_delivery/
    final_delivery_summary.md           # final delivery summary
  failure_report.md                     # failure report when blocked
  manifest.json
```

## 🧪 Factor Validation Requirements

The factor validation report should include:

| Dimension | Content |
|---|---|
| 📊 Data quality | Data coverage, missing values, outliers, factor distribution |
| 📈 IC family | IC, Rank IC, ICIR, annual IC, rolling IC |
| 💰 Portfolio performance | Quantile portfolio returns, long-short returns, cumulative net value, drawdown |
| 📐 Performance metrics | Annual return, annual volatility, Sharpe, Calmar, max drawdown, win rate, turnover |
| 🔀 Sample validation | IS/OOS/Walk-forward validation (or an explanation when data is insufficient) |
| 🛡️ Robustness | Parameter stability, transaction-cost sensitivity, reverse factor, random factor, simple benchmark comparison |
| 🔍 Factor audit | Data availability, signal lag, label construction, execution price, look-ahead checks, price-leakage checks, sample split, cost assumptions |
| 🧮 Alignment audit | Theoretical factor-validation curve vs the actual BACKTEST equity curve |

Chart image text must be English ASCII only; Chinese explanations should stay in the HTML text around each chart.

## 🧰 Helper Scripts

| Script | Purpose |
|---|---|
| `scripts/check_dependencies.py --install` | Check and auto-install Python dependencies (or `pip install -r requirements.txt`) |
| `scripts/create_project.py` | Create the standard output directory and `manifest.json` |
| `scripts/pandadata_market_data.py` | Download real Pandadata daily bars and write a backtest-ready CSV/Parquet plus metadata |
| `scripts/local_backtest.py {report_dir} --market-data xxx.csv` | Bundled local backtest engine; defaults to the Pandadata cache and expects `date`, `symbol`, `close` columns |
| `scripts/check_step5_strategy.py` | Check strategy, config, backtest report, signal log, equity curve, performance, and trades |
| `scripts/build_factor_report.py` | Build a standalone HTML factor-validation report skeleton from structured JSON metrics |
| `scripts/quality_gate_check.py` | Pre-delivery quality gate: RAG scorecard, benchmark comparison, alignment audit, per-chart explanations, log completeness, placeholder cleanup |

The backtest engine reads the signal log from `04_backtest_strategy/backtest_logs/signal_log.jsonl` by default.

### Pandadata Production Fetch Example

```bash
python scripts/pandadata_market_data.py \
  --asset-type stock \
  --symbols 000001.SZ 600000.SH \
  --start-date 20250101 \
  --end-date 20250131 \
  --output /home/coder/project/replication/report-replication/{report_id}/03_factor_validation/data_cache/pandadata_market_data.csv \
  --project-dir /home/coder/project/replication/report-replication/{report_id}

python scripts/local_backtest.py \
  /home/coder/project/replication/report-replication/{report_id} \
  --market-data /home/coder/project/replication/report-replication/{report_id}/03_factor_validation/data_cache/pandadata_market_data.csv
```

## 📚 Key References

```text
references/output_contract.md               # output contract
references/factor_validation_checklist.md   # factor validation checklist
references/factor_audit_and_robustness.md   # factor audit & robustness
references/backtest_engine.md               # backtest engine notes
references/data_sources.md                  # data source conventions
```

## ✅ Acceptance Criteria

Each report replication should verify:

1. The complete output structure was generated.
2. Real, traceable Pandadata data was used, or the reason Pandadata was insufficient was recorded.
3. Factor audit and robustness checks were completed.
4. BACKTEST strategy code was generated.
5. The bundled BACKTEST or a user-provided external BACKTEST actually ran, or a blocking reason was recorded.
6. A BACKTEST HTML report or failure logs were saved.
7. A final delivery summary or failure report was generated.

## 📜 License

This project is licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE).

## 🐼 PandaAI / QUANTSKILLS Community

<div align="center">
  <img src="https://raw.githubusercontent.com/quantskills/.github/main/profile/assets/pandaai-community-qr.jpg" alt="PandaAI community QR code" width="220">
  <br>
  <sub>Scan the QR code to join the PandaAI community for QUANTSKILLS skills, agent workflows, and quantitative research practice.</sub>
</div>
