# Data Sources

The bundled fetchers use the public `panda_data` SDK package, plus the HKMA public FX endpoint.

The A/H identity map is stored in `references/pair_universe.csv`. It contains identifiers only and is not a cached price snapshot.

If `PANDA_DATA_USERNAME` / `PANDA_DATA_PASSWORD` are present in the environment or a local `.env`, the live PandaData client will use them automatically.

## Current A/H comparison

`panda_data.get_stock_daily(...)` uses an empty symbol list and the latest trade date for the market-wide A-share scan.

Use the latest available daily close for A-share prices.

## H-share history

`panda_data.get_hk_daily(...)` uses the same market-wide, single-date request shape for the H-share side.

Use unadjusted closes for contemporaneous premium comparison.

## A-share history

`panda_data.get_stock_daily(...)`

Use unadjusted closes to match the H-side raw-price convention.

## Current / historical HKD/CNY

HKMA public endpoint:

`https://api.hkma.gov.hk/public/market-data-and-statistics/monthly-statistical-bulletin/er-ir/er-eeri-daily`

The API returns HKD per CNY. Invert it to get CNY per HKD before calculating the premium.

## Data-source limitations

- The A/H universe is anchored to the repository pair list and may need periodic refresh.
- Daily closes are monitoring data, not execution-grade intraday quotes.
- FX is end-of-day, not an executable spot quote.
- Historical A/H prices can contain suspensions and corporate-action effects.
