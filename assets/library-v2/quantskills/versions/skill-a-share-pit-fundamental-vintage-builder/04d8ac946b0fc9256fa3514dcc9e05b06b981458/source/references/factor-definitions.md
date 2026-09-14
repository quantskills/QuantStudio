# Fundamental Factor Definitions

The derivation script expects the cumulative formal-report fields `is_revenue`, `is_n_income_attr_p`, `cfs_net_cash_operating`, and the balance-sheet field `bs_total_assets`.

## Single-Quarter and TTM Rules

- `*_q`: Q1 equals the reported year-to-date value. Q2-Q4 equal the current cumulative value minus the immediately previous fiscal quarter in the same PIT partition.
- `*_ttm`: Sum of four consecutive `*_q` values. A missing or non-consecutive quarter produces `NaN`, never an inferred value.
- Groups are independent for each `symbol` and `as_of_date`, so a later report revision cannot leak into an earlier snapshot.

## Factor Library

| Field | Formula | Interpretation |
| --- | --- | --- |
| `net_margin_ttm` | `is_n_income_attr_p_ttm / is_revenue_ttm` | TTM profitability |
| `cash_conversion_ttm` | `cfs_net_cash_operating_ttm / is_n_income_attr_p_ttm` | Cash realization of accounting earnings |
| `accruals_to_assets_ttm` | `(is_n_income_attr_p_ttm - cfs_net_cash_operating_ttm) / bs_total_assets` | End-asset-scaled accrual intensity |
| `roa_ttm` | `is_n_income_attr_p_ttm / average(total assets, assets four quarters ago)` | TTM return on assets |
| `asset_turnover_ttm` | `is_revenue_ttm / average(total assets, assets four quarters ago)` | TTM asset efficiency |
| `revenue_ttm_yoy` | `is_revenue_ttm / lag_4(is_revenue_ttm) - 1` | TTM revenue growth |
| `net_income_ttm_yoy` | `is_n_income_attr_p_ttm / lag_4(is_n_income_attr_p_ttm) - 1` | TTM earnings growth |

`roa_ttm`, `asset_turnover_ttm`, and the two growth fields require the exact four-quarter lag. They remain `NaN` until sufficient consecutive PIT-visible history exists. The definitions are generic industrial-company conventions; interpret financial-sector issuers separately.
