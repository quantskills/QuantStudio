# Changelog

All notable changes to `skill-dl-gnn-stock-graph` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [0.1.0] — 2026-08-01

### Added (Initial Release)

- **Multi-layer heterogeneous graph construction**:
  - Explicit edges: Shenwan L1/L2/L3 industry, concept sectors, institutional co-holdings (equity)
  - Implicit edges: Pearson return correlation, DTW similarity (Granger causality stub)
  - Weighted adjacency with symmetric normalization
  - Symbol-to-index mapper

- **Dual GNN model architecture**:
  - `GATs_ts`: RNN (GRU/LSTM) + Multi-head Graph Attention Network + MLP prediction head
  - `MF-IAMGCN`: Stacked GCN + MIDAS mixed-frequency alignment + Cross-temporal attention
  - Both models implemented in pure PyTorch (no torch_geometric dependency)
  - Training loop with EarlyStopping, gradient clipping, device auto-detection (CUDA/MPS/CPU)
  - Per-symbol train/val split (no temporal leakage)

- **Five-dimensional feature engineering** (28 dimensions per trading day):
  - Price-volume (14 dims): ret, log_vol, amplitude, turnover, gap, limit distance, excess_ret, mom_5d/20d, volatility_20d, MACD, RSI, money_flow
  - Fundamental (7 dims): PE_TTM, PB, ROE_TTM, market_cap, revenue/profit YoY growth, debt_ratio
  - Sentiment (3 dims): news_sentiment (external LLM), dragon-tiger board flag, block trade premium
  - Macro (4 dims): GDP YoY, CPI YoY, PMI, M2 YoY
  - Relational (4 dims): degree_centrality, PageRank, DTW similarity mean, industry excess return
  - Pipeline: panel assembly → 20-day window stacking → Winsorize (1%/99%) → Z-score standardization (train-only stats, no lookahead)

- **A-share data cleaning pipeline** (7 treatments):
  - Post-rights adjustment verification
  - Limit-up/down zero-value flagging
  - Suspension forward-fill
  - ST/*ST filtering
  - Sub-new-stock filtering (< 60 days listed)
  - Trading calendar alignment
  - Extreme value Winsorization

- **Stock selection strategy**:
  - TopK selection by predicted score (descending)
  - Optional minimum-score threshold filter
  - RankNet pairwise ranking loss (v0.2 planned)

- **Backtest engine**:
  - Daily rebalance, equal-weight allocation
  - T+1 settlement enforcement
  - Price limit buy/sell restriction (±10% main board, ±20% ChiNext/STAR)
  - Realistic costs: 0.03% commission, 0.1% stamp tax (sell only), 0.1% slippage
  - Metrics: annualized return, volatility, max drawdown, Sharpe, Sortino, Calmar, Information Ratio, win rate, turnover

- **Risk monitoring** (4 dimensions):
  - Market risk (volatility percentile, drawdown detection)
  - Liquidity risk (turnover collapse flagging)
  - Systemic risk (eigenvector centrality from graph structure)
  - Concentration risk (single-stock position limit enforcement)

- **Output**:
  - CSV: ranked stock picks with score, sector, market cap, daily return
  - Markdown: human-readable report with sector distribution, model diagnostics, graph summary

- **Data layer**:
  - 15 `panda_data` API wrappers with column-level validation
  - A-share trading calendar utilities
  - Field self-check (`--self-check`) for schema drift detection

- **Testing**:
  - 52 unit tests across 6 test files
  - Coverage: data cleaning, graph construction, feature engineering, model layers/architectures/training, strategy selection, backtest engine, trading rules, risk monitoring, no-future-leak

- **Documentation**:
  - `SKILL.md` — full architecture specification
  - `README.md` / `README.en.md` — bilingual project overview
  - `INSTALL.md` — multi-platform install guide (Claude Code / Codex / Cursor / Hermes / OpenClaw)
  - `references/need_used_api.md` — API reference
  - `config/model_config.yaml` — centralized hyperparameters

- **Release files**: LICENSE (GPL-3.0), CHANGELOG.md, skill.json, requirements.txt, .gitignore

### Known Limitations (v0.1.0)

- News sentiment requires external LLM injection (panda_data has no text API); defaults to NaN
- Supply chain relations have no direct data source; disabled by default
- Granger causality O(N²·T); disabled by default
- Concept constituent full-pull may hit plan limit 600003; per-stock sampling used
- Daily rebalance only; no intraday execution
- MF-IAMGCN end-to-end verified but not fully hyperparameter-tuned
- No model checkpoint persistence (retrained from scratch each run)

### Changed (post v0.1.0)

- **Concept sampling**: now samples top 30 stocks by index weight (was alphabetical top 50); falls back to alphabetical if weights unavailable. Graceful degradation on per-stock pull failure.
- **Training reproducibility**: `torch.set_num_threads(1)` added to `train.set_seed()` to eliminate CPU multi-threading non-determinism. Same seed now produces identical TopK results.
- **Silent degradation guard**: `train_model()` now emits `RuntimeWarning` when `targets=None`, preventing silent zero-degradation.
