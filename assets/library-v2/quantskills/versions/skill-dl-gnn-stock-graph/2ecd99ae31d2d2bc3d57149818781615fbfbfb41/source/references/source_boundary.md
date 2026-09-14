# Source Boundary

Production inputs are restricted to PandaData A-share APIs:

## Allowed Data Sources

### Calendar
- `get_last_trade_date`
- `get_prev_trade_date`
- `get_trade_cal`

### Market Data
- `get_index_weights`
- `get_factor`
- `get_stock_daily_post`
- `get_index_daily`

### Graph Relations
- `get_industry_constituents`
- `get_concept_constituents`
- `get_stock_industry`

### Fundamental
- `get_fina_reports` (balance_sheet, income, cashflow)
- `get_share_float`

### Alternative Data
- `get_lhb_list`
- `get_block_trade`
- `get_top_holders`

### Filtering
- `get_stock_status_change`

### Macro
- `get_macro_na`, `get_macro_pi`, `get_macro_ci`, `get_macro_mb`

## Prohibited Data Sources

The following are not accepted as production evidence:

- AkShare, Tushare, or any third-party financial data API
- Manually edited spreadsheets or CSV files (except `--sentiment-file` for external LLM scores)
- Current-only web values or live-scraped pages
- Caller-supplied financial snapshots (must go through the PandaData API layer)
- Any data source that does not provide point-in-time versioning

## External Injections

- **LLM News Sentiment**: PandaData has no news text API. Sentiment scores (`news_sentiment`) must be injected via `--sentiment-file CSV` with columns `date, symbol, score`. The file is treated as external research input, not PandaData evidence.
- **Supply Chain Relations**: No direct data source available. Explicit supply chain edges are disabled by default in v0.1.

## Reproducibility

PandaData is an online service. Reproducibility requires retaining:

- Generated CSV output (`output/gnn_picks_YYYYMMDD.csv`)
- Generated Markdown report (`output/gnn_picks_YYYYMMDD.md`)
- Trained model checkpoint (`output/{model}_{date}_model.pt`) if persistence is enabled
- The exact CLI invocation with `--seed`, `--date`, `--model`, `--train_days`, `--lookback`, `--epochs`

Without these artifacts, a past run cannot be bit-exactly reproduced because:

- PandaData API responses reflect the latest available data (e.g., restated financials)
- PyTorch floating-point operations are not bit-deterministic across hardware or software versions
- Live market data at the time of the run is not versioned or snapshotted by the PandaData service

`config/model_config.yaml` is the canonical source of hyperparameters. Reproducing a run requires the same config file version used in the original invocation.

## Model Checkpoints

Model checkpoints (`.pt` files) are large binary artifacts. They should not be committed to Git. The `.gitignore` excludes `models/` and `output/`. Checkpoints are identified by `{model}_{date}_model.pt` and carry no versioning metadata beyond the filename.

## Safety

Credentials are read from environment variables (`PANDA_DATA_USERNAME`, `PANDA_DATA_PASSWORD`) and removed from the process environment after loading. Never place credentials, raw private data, model checkpoints, or generated full-market datasets in Git.
