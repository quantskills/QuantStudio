# GNN Deep Graph Neural Network · A-Share Quantitative Stock Selection

Use this skill when you need GNN-based quantitative stock selection for the A-share market. Supports multi-layer heterogeneous graphs (Shenwan L1/L2/L3 industries + concept sectors + institutional holdings + DTW similarity + Pearson correlation), dual GNN architectures (GATs_ts + MF-IAMGCN), five-dimensional feature engineering (price-volume / fundamental / sentiment / macro / relational), TopK stock selection, and a complete A-share backtest engine (T+1 settlement, price limit simulation, commission + stamp tax + slippage).

## ⚠️ Disclaimer

- **Research & Educational Use Only**: This skill is a quantitative trading research tool and does NOT constitute investment advice, financial advice, or trading recommendations of any kind.
- **No Guaranteed Returns**: Backtest or simulation results do not represent actual trading performance. Past performance does not predict future results. Users assume all trading risks.
- **Risk Boundaries**: This tool does not account for market liquidity, price limits, trading halts, slippage, or auction sessions. Generated stock selection signals may be unfillable or result in losses. GNN model predictions carry inherent uncertainty and should not be the sole basis for trading decisions.
- **No Official Endorsement**: This is a QuantSkills community project. It has not been professionally audited or certified by any regulatory body.

## Directory Structure

```
├── SKILL.md                                ← Skill specification
├── README.md                               ← Chinese README
├── README.en.md                            ← This file
├── LICENSE                                 ← GPL-3.0
├── INSTALL.md                              ← Multi-platform install guide
├── requirements.txt                        ← Dependency declaration
├── skill.json                              ← Skill metadata
├── config/
│   └── model_config.yaml                   ← Centralized model hyperparameters
├── scripts/
│   ├── scan.py                             ← Main CLI entry (single-day + backtest)
│   ├── report.py                           ← CSV + Markdown report emitter
│   ├── data/                               ← Data layer (panda_data wrappers + calendar + cleaner)
│   ├── graph/                              ← Graph layer (explicit/implicit edges + builder)
│   ├── features/                           ← Feature engineering (price/fundamental/sentiment/relation + pipeline)
│   ├── model/                              ← GNN models (GAT/GCN layers, GATs_ts, MF-IAMGCN, training loop)
│   ├── strategy/                           ← Strategy layer (TopK selector + RankNet)
│   ├── backtest/                           ← Backtest (engine + trading rules + metrics)
│   └── risk/                               ← Risk monitoring (market/liquidity/systemic/concentration)
├── tests/                                  ← 52 unit tests (all passing)
└── references/
    └── need_used_api.md                    ← panda_data API reference
```

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Set environment variables
export PANDA_DATA_USERNAME=<your_username>
export PANDA_DATA_PASSWORD=<your_password>

# 3. Field self-check (first use)
python3 -m scripts.data.loader --self-check --date 20260729

# 4. Run unit tests
python3 -m pytest tests/ -v

# 5. Single-day stock selection (~6-10s)
python3 scripts/scan.py --date 20260731 --model gats_ts --train_days 120 --epochs 10 --top_k 10

# 6. Quick end-to-end smoke test
python3 scripts/_e2e_smoke.py --date 20260731 --epochs 5
```

## Core Design

1. **Multi-layer Heterogeneous Graph**: Shenwan L1/L2/L3 three-tier industry edges + concept sectors + institutional co-holdings + DTW morphological similarity + Pearson return correlation. Finer industry granularity yields stronger co-movement signals.

2. **Dual Model Architecture**: GATs_ts (RNN + Dynamic Graph Attention Network, literature reports +28.9% annualized excess over CSI300) + MF-IAMGCN (Mixed-Frequency Inter-temporal Attention Multi-GCN, supports daily price + quarterly fundamental data via MIDAS alignment).

3. **Five-Dimensional Features**: Price-volume (14 dims, daily) + Fundamental (7 dims, quarterly→daily forward-filled) + Sentiment (3 dims, dragon-tiger board / block trades / external LLM) + Macro (4 dims, GDP/CPI/PMI/M2) + Relational (4 dims, centrality/Pagerank/DTW mean/industry excess return). Full Winsorize + Z-score pipeline with strict no-lookahead-bias.

4. **A-Share Cleaning Pipeline**: Post-rights verification → limit-up/down zero-value flagging → suspension forward-fill → ST/*ST filtering → sub-new-stock filtering (< 60 days listed) → trading calendar alignment → extreme-value Winsorization.

5. **Complete Backtest Engine**: T+1 settlement, price limit buy/sell restrictions, real trading costs (0.03% commission + 0.1% stamp tax on sells + 0.1% slippage), equal-weight allocation, daily rebalancing. Outputs Sharpe/Sortino/Calmar/Information Ratio/Max Drawdown/Annualized Turnover.

## Supported Runtimes

| Platform | Install Guide |
|---|---|
| Claude Code | `INSTALL.md` § Claude Code |
| Codex (OpenAI) | `INSTALL.md` § Codex |
| Cursor | `INSTALL.md` § Cursor |
| Hermes | `INSTALL.md` § Hermes |
| OpenClaw | `INSTALL.md` § OpenClaw |

## Verification Status

- scan.py runs independently ✅
- 52 unit tests all passing ✅
- panda_data field self-check passed (8/8 interface columns aligned) ✅
- End-to-end stock selection verified (GATs_ts, CSI300, 300 stocks, 10 epochs, 6-10s) ✅
- Training reproducibility (same seed → same TopK) ✅
- Backtest T+1/price limits/costs simulated ✅
- No lookahead bias (training set strictly `date < T`) ✅

## Limitations & Future Work

| Limitation | Detail | Plan |
|---|---|---|
| CSI300 only verified | CSI500/CSI1000 API adapted but not E2E tested | v0.2 |
| News sentiment requires external LLM | panda_data has no text API; sentiment defaults to NaN | Integrate LLM sentiment pipeline |
| No supply chain data source | Supply chain edges disabled by default | Integrate external database |
| Granger causality O(N²·T) | Computationally heavy, disabled by default | GPU batch testing |
| Daily rebalance only | No intraday execution | v0.2 sub-daily |
| Concept API has plan limits | Full concept pull may return error 600003 | Per-stock pull (top 30 by index weight), graceful degradation |

## Dependencies

- Python 3.10+
- PyTorch 2.0+ (GNN inference + training)
- panda_data (financial market data, account required)
- pandas, numpy, scikit-learn, pyyaml
- pytest (testing)

## License

GPL-3.0 — See [LICENSE](LICENSE)
