# Methodology Freeze

Model version: `0.1.0`.

## Training Window

- The training window spans `train_days` calendar days before the scan date T, defaulting to 252 trading days.
- Train/validation split is **per symbol**, not per time step — the same stock's data never appears in both train and validation sets. This prevents temporal leakage across symbols.
- All features used in training strictly observe `date < T`. No feature, label, or graph edge is constructed from data on or after T.

## Feature Pipeline

### Price-Volume (14 dimensions, daily, 20-day lookback)
- All price data sourced from `get_stock_daily_post` (post-rights-adjusted).
- Features: `ret`, `log_vol`, `amplitude`, `turnover`, `gap`, `dist_limit_up`, `dist_limit_down`, `excess_ret`, `mom_5d`, `mom_20d`, `volatility_20d`, `macd`, `rsi`, `money_flow`.
- A 20-day lookback window produces 280 dimensions (20 × 14) per stock per day.
- Missing values from trading halts are forward-filled up to 5 days; gaps longer than 5 days are left as NaN.

### Fundamental (7 dimensions, quarterly, forward-filled to daily)
- Sourced from `get_fina_reports` (balance_sheet, income, cashflow) and `get_factor` (market_cap).
- TTM values are computed point-in-time: each date T only uses report versions announced on or before T.
- Forward-filled from the latest quarterly report to each trading day.
- `if_adjusted=0` identifies a filing's current-period value; `if_adjusted=1` a comparative restatement. The latest visible version is used.

### Sentiment (3 dimensions, daily, external injection)
- `news_sentiment` requires external LLM processing (panda_data has no news text API); defaults to NaN in v0.1.
- `lhb_flag` sourced from `get_lhb_list`.
- `block_trade_premium` sourced from `get_block_trade`.
- NaN sentiment features do not halt the pipeline; models are trained with NaN-aware handling.

### Macro (4 dimensions, monthly/quarterly, forward-filled)
- Sourced from `get_macro_na`, `get_macro_pi`, `get_macro_ci`, `get_macro_mb`.
- Forward-filled from the latest release date to each trading day.

### Relational (4 dimensions, computed from graph structure)
- `degree_centrality`, `pagerank` computed from the adjacency matrix.
- `dtw_similarity_mean` average over DTW Top-K neighbors.
- `industry_excess_ret` from `get_industry_constituents` + `get_stock_daily_post`.
- Graph features are recomputed per training window — no lookahead.

### Standardization
- Winsorize at 1%/99% quantiles, computed on training set only.
- Z-score standardization using training-set mean and standard deviation (not full-sample).
- Both statistics are saved per feature column and applied identically to validation data.

## Graph Construction

### Explicit Edges (deterministic, no lookahead)
- **Shenwan Industry** (L1/L2/L3): two stocks in the same industry share an edge. L3 weight > L2 > L1, reflecting finer co-movement.
- **Concept Sectors**: two stocks in the same concept share an edge.
- **Institutional Co-holdings**: two stocks held by the same top-10 institutional holder share an edge.

### Implicit Edges (data-driven, computed per window)
- **DTW Top-K** (K=20): dynamic time warping on return sequences; top 20 most similar stocks per node.
- **Pearson Threshold** (>0.5): return correlation above 0.5 over the training window.
- **Granger Causality** (O(N²·T)): disabled by default in v0.1 due to computational cost.

### Adjacency Normalization
- Multi-graph edges are aggregated into a single weighted adjacency matrix.
- Symmetric normalization: D^{-1/2} A D^{-1/2} or equivalent row-normalization.

### Node Limit
- Maximum 500 nodes per graph. CSI300 alone fits; CSI300 + CSI500 combined (~800) requires sharded training.

## Model Architectures

### GATs_ts (default)
Frozen at: 2-layer GRU (hidden=64) → 4-head GAT (hidden=32 per head, output=128) → MLP head [64, 32] → single-score prediction.

### MF-IAMGCN
Frozen at: 3 stacked GCN layers (64 dim) for daily branch + MLP → MIDAS alignment for quarterly branch → 4-head cross-temporal attention (64 dim) → MLP prediction head.

### Training
- Optimizer: Adam, learning rate from `config/model_config.yaml`.
- EarlyStopping: patience=20 epochs on validation loss.
- Gradient clipping: max_norm=1.0.
- Device: auto-detection (CUDA > MPS > CPU).

## Reproducibility

- `--seed 42` produces identical TopK order across two runs on the same machine.
- Reproducibility requires identical: seed, training window, model config, data API response snapshots.
- Full-bit reproducibility across different machines or dates is not guaranteed due to floating-point non-determinism in PyTorch GPU operations and changing API data.

## Fail-Closed Principle

- NaN or missing features at inference time cause the stock to be excluded (not interpolated).
- API failures during `scan.py` execution halt the run with an error code (not silently skipped).
- Graph construction failures (e.g., empty adjacency for a stock) exclude that stock with a diagnostic message.
- Training failures (e.g., all features NaN for a window) abort the run.

## No Future Function

- `test_no_future_leak.py` (if present) or `tests/test_model.py` verifies: training set uses strictly `date < T`.
- Backtest respects T+1: positions from T's prediction are entered at T+1 open, exited at T+2 open (or later).
- Model checkpoint does not encode future price information — it encodes learned graph structure and feature patterns.

## v0.1.0 Known Limitations

- News sentiment requires external LLM injection (panda_data has no text API); defaults to NaN.
- Supply chain relations have no direct data source; disabled by default.
- Granger causality O(N²·T); disabled by default.
- Concept constituent full-pull may hit plan limit 600003; per-stock sampling used.
- Daily rebalance only; no intraday execution.
- MF-IAMGCN end-to-end verified but not fully hyperparameter-tuned.
- No model checkpoint persistence across runs (retrained from scratch each invocation).
- Maximum 500 nodes per graph; larger universes require sharding.
