# Data Contract

## Historical pair CSV

Required columns:

| column | type | meaning |
|---|---|---|
| `date` | YYYY-MM-DD | common A/H observation date |
| `a_price_cny` | positive float | raw A-share close in CNY |
| `h_price_hkd` | positive float | raw H-share close in HKD |
| `fx_hkd_cny` | positive float | CNY per 1 HKD |

Optional columns:

| column | meaning |
|---|---|
| `fx_source_date` | date of the fixing used |
| `fx_stale_days` | calendar days between price date and FX source date |
| `a_volume` | A-share volume |
| `h_volume` | H-share volume |

Do not include a row if only one venue traded that day unless the workflow explicitly models stale-price risk outside this skill.

## Snapshot CSV

Required:

`company,h_code,h_price_hkd,a_code,a_price_cny,fx_hkd_cny`

Optional:

`h_change_pct,a_change_pct,source_ratio,source_premium_pct,fx_bid,fx_ask`

`source_premium_pct` is diagnostic only. The scanner recomputes premium independently.

## Share-ratio convention

`--share-ratio` = H-share economic units equivalent to one A-share unit. Default `1.0`.

## Missing values

- Reject rows with missing/non-positive A price, H price, or FX.
- Deduplicate historical dates by keeping the last row and emit a warning.
- Never silently replace missing A/H prices with neighboring dates.
