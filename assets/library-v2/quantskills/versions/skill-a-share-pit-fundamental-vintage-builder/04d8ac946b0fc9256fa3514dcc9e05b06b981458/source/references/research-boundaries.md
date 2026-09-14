# Research Boundaries

## Data Source And Entitlement

Live inputs are obtained through the user's authorized `panda_data` Python SDK account. This repository contains scripts and schemas only; it does not include Panda Data credentials, API keys, vendor datasets, or private research files. Use of Panda Data remains subject to the user's subscription, permissions, and the provider's terms.

The Skill calls `get_fina_reports(is_latest=False)` for retained formal-report versions and `get_trade_cal` for trading-day mapping. The available SDK behavior is recorded in [data-contract.md](data-contract.md). Do not represent the resulting data as independently verified corporate disclosure data.

## Method Assumptions

| Item | Current convention |
| --- | --- |
| Data scope | A-share formal financial reports only |
| Version selection | Latest retained report version disclosed on or before each research cutoff |
| Usability timing | First trading day strictly after the disclosure date (T+1) |
| Rebalance timing | Daily cutoff date supplied by the user; no intraday publication timestamp is assumed |
| Missing values | Preserved as missing, never silently converted to zero |
| Same-date conflict | Fail closed if different versions share symbol, quarter, and disclosure date |

## User-Controlled Parameters

- `symbols`: security identifiers to include.
- `start-quarter` and `end-quarter`: historical report window in `YYYYqN` form.
- `as-of-date` or `as-of-dates`: one research cutoff or a rebalance schedule.
- Requested financial fields and factor definitions.
- Rebalance schedule: a supplied file or generated monthly final trading dates.

Record parameter values in output metadata and retain the lineage fields `quarter`, `disclosure_date`, `available_date`, `as_of_date`, and `vintage_type` beside every downstream factor value.

## Known Limits

- Disclosure dates do not include verified intraday publication timestamps; T+1 is conservative but cannot model same-day tradability.
- The report-version history is only as complete and accurate as the SDK response and the user's entitlement.
- A PIT financial panel does not construct a historical security universe or preserve delisting returns. Use a dedicated survivorship/universe workflow when that is required.
- Corporate actions, adjusted prices, trading suspensions, price limits, liquidity, borrow availability, transaction costs, taxes, and execution timing are outside this Skill.
- Single-quarter and TTM derivations can be unavailable when source fields or consecutive quarters are missing.
- The Python static audit detects specified patterns, not all possible forms of data leakage or semantic errors.

## Risk Boundary

Outputs are research artifacts, not investment research recommendations, trading signals, portfolio instructions, or performance forecasts. Historical validation does not guarantee future performance. Validate data entitlements, strategy assumptions, risk controls, and execution constraints independently before any real-world use.
