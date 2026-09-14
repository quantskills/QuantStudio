# Feature & Data Field Guide

## Price-Volume Features (14 dimensions, daily)

| # | Feature | PandaData API | Formula / Source Field |
|---|---|---|---|
| 1 | `ret` | `get_stock_daily_post` | `close / pre_close - 1` |
| 2 | `log_vol` | `get_stock_daily_post` | `log(volume + 1)` |
| 3 | `amplitude` | `get_stock_daily_post` | `(high - low) / pre_close` |
| 4 | `turnover` | `get_factor` | `turnover` (as reported) |
| 5 | `gap` | `get_stock_daily_post` | `open / pre_close - 1` |
| 6 | `dist_limit_up` | `get_stock_daily_post` | `(limit_up - close) / close` |
| 7 | `dist_limit_down` | `get_stock_daily_post` | `(close - limit_down) / close` |
| 8 | `excess_ret` | `get_stock_daily_post` + `get_index_daily` | `ret_stock - ret_index` |
| 9 | `mom_5d` | `get_stock_daily_post` | `close / close_lag5 - 1` |
| 10 | `mom_20d` | `get_stock_daily_post` | `close / close_lag20 - 1` |
| 11 | `volatility_20d` | `get_stock_daily_post` | `std(ret, 20)` population std |
| 12 | `macd` | `get_stock_daily_post` | EMA12(close) - EMA26(close) |
| 13 | `rsi` | `get_stock_daily_post` | 100 - 100/(1 + avg_gain_14 / avg_loss_14) |
| 14 | `money_flow` | `get_factor` | `amount / amount_lag5 - 1` |

## Fundamental Features (7 dimensions, quarterly → daily forward-filled)

| # | Feature | PandaData API | Formula / Source Field |
|---|---|---|---|
| 1 | `pe_ttm` | `get_fina_reports` + `get_factor` | `market_cap / net_profit_ttm`. TTM EPS: Q1-Q3 = current YTD + prior annual − prior same-quarter YTD; Q4 = annual EPS. All components must be visible by the decision date. |
| 2 | `pb` | `get_fina_reports` + `get_share_float` | `market_cap / book_value`. Book value = `bs_total_hldr_eqy_exc_min_int`. |
| 3 | `roe_ttm` | `get_fina_reports` | `is_n_income_attr_p / avg(bs_total_hldr_eqy_exc_min_int_current, bs_total_hldr_eqy_exc_min_int_prior)` |
| 4 | `market_cap` | `get_factor` | `market_cap` (as reported, total market capitalization) |
| 5 | `revenue_growth_yoy` | `get_fina_reports` | `is_revenue_current / is_revenue_same_quarter_prior - 1` |
| 6 | `profit_growth_yoy` | `get_fina_reports` | `is_n_income_attr_p_current / is_n_income_attr_p_same_quarter_prior - 1` |
| 7 | `debt_ratio` | `get_fina_reports` | `bs_total_liab / bs_total_assets` |

## Sentiment Features (3 dimensions, daily)

| # | Feature | PandaData API | Formula / Source Field |
|---|---|---|---|
| 1 | `news_sentiment` | External LLM (via `--sentiment-file CSV`) | Score ∈ [-1, 1]. NaN when not available. |
| 2 | `lhb_flag` | `get_lhb_list` | `1` if symbol appears in that day's dragon-tiger board list, `0` otherwise. |
| 3 | `block_trade_premium` | `get_block_trade` | `(block_trade_price / close - 1)`. NaN when no block trade that day. |

## Macro Features (4 dimensions, monthly/quarterly → daily forward-filled)

| # | Feature | PandaData API | Formula / Source Field |
|---|---|---|---|
| 1 | `gdp_yoy` | `get_macro_na` | GDP YoY growth rate (as reported) |
| 2 | `cpi_yoy` | `get_macro_pi` | CPI YoY change (as reported) |
| 3 | `pmi` | `get_macro_ci` | Manufacturing PMI (as reported) |
| 4 | `m2_yoy` | `get_macro_mb` | M2 YoY growth rate (as reported) |

## Relational Features (4 dimensions, computed from graph)

| # | Feature | Data Source | Formula |
|---|---|---|---|
| 1 | `degree_centrality` | Adjacency matrix | Sum of weighted edges per node |
| 2 | `pagerank` | Adjacency matrix | PageRank algorithm (damping=0.85) |
| 3 | `dtw_similarity_mean` | DTW distance matrix | Mean DTW similarity to Top-20 nearest neighbors |
| 4 | `industry_excess_ret` | `get_industry_constituents` + `get_stock_daily_post` | Mean excess return of all stocks in the same Shenwan L1 industry |

## Data Window Conventions

| Data Type | Lookback | Update Frequency | Forward-Fill |
|---|---|---|---|
| Price-Volume | 20 trading days | Daily | Up to 5 days for trading halts |
| Fundamental | 8 quarters | Quarterly (report announcement date) | To each trading day until next report |
| Sentiment | 20 trading days | Daily | NaN (no forward-fill) |
| Macro | 20 quarters | Monthly/Quarterly | To each trading day until next release |
| Relational | Per training window | Per training window | Recalculated per window |

## Feature Preprocessing

1. **Panel Assembly**: All features aligned to the same `(date, symbol)` index via trading calendar.
2. **Winsorize**: 1st and 99th percentiles computed on training set; values beyond these bounds are clipped.
3. **Z-score Standardization**: `(x - μ_train) / σ_train` using training-set statistics only. No lookahead.
4. **Window Stacking**: Price-volume features are stacked across the 20-day lookback: each stock-day sample = 20 × 14 = 280 dimensions from price, plus 7 fundamental + 3 sentiment + 4 macro + 4 relational = 298 total input dimensions.

## Missing Data Conventions

| Scenario | Handling |
|---|---|
| Trading halt (≤ 5 days) | Forward-fill from last valid observation |
| Trading halt (> 5 days) | Leave as NaN; stock excluded from that day's graph |
| No quarterly report yet | Forward-fill from previous quarter |
| No sentiment data | Leave as NaN (not zero-filled) |
| Limit-up/down with zero volume | Zero-value flag; feature computed from limit price |
| Newly listed (< 60 days) | Stock excluded entirely |
| ST/*ST status | Stock excluded entirely |

## Date Conventions

- All dates are `YYYYMMDD` strings.
- Stock codes include exchange suffix: `.SH` for Shanghai, `.SZ` for Shenzhen.
- API date range parameters accept at most 5 years per call for daily data, 20 quarters for `get_fina_reports`.
- Training set cut: `date < T` where T is the scan/prediction date.
