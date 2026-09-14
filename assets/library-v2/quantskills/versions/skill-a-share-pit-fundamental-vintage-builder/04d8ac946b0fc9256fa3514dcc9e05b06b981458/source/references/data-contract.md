# Data Contract

## Verified Primary Interface

`panda_data.get_fina_reports` was runtime-verified with the following contract:

- `start_quarter` and `end_quarter` use `YYYYqN`.
- A single request accepts at most 20 quarters.
- `is_latest=False` returns retained disclosure versions, including multiple rows for the same `symbol` and `quarter` with different `date` values.
- `date=<YYYYMMDD>` applies an as-of cutoff and returns no later disclosure versions.
- Requested financial fields are returned with `symbol`, `quarter`, and `date`.

`panda_data.get_trade_cal` was runtime-verified to return `nature_date` and `is_trade` in the current SDK. The builder normalizes these to `date` and `is_trading_day`. Do not request documented `date` / `is_trading_day` through its `fields` argument: that parameter combination currently returns an empty table.

## Secondary Interfaces

| Method | Role | First-release treatment |
| --- | --- | --- |
| `get_trade_cal` | Trading-day mapping | Required for conservative T+1 availability |
| `get_audit_opinion` | Audit-quality label | Optional, report separately from primary financial panel |
| `get_fina_forecast` | Earnings forecast | Auxiliary only until historical vintage/as-of semantics are verified |
| `get_fina_performance` | Performance bulletin | Auxiliary only until historical vintage/as-of semantics are verified |

## Availability Formula

```text
eligible_versions(T) = {v | disclosure_date(v) <= T and available_date(v) <= T}
available_date(v) = first trading day strictly after disclosure_date(v)
PIT(symbol, quarter, T) = latest disclosure version in eligible_versions(T)
```

The strict inequality prevents a same-day disclosure from entering a daily signal without a verified publication timestamp.

## Data Quality Rules

- Preserve `NaN`; do not fill absent accounting fields with zero.
- Preserve financial-sector fields even when they do not match industrial-company schemas.
- Do not mix report-period end dates with disclosure or availability dates.
- Treat a newer value for the same report period as a separate vintage until the as-of selection step.
- Record the requested symbols, fields, quarter window, as-of date, row count, and availability convention in output metadata.
