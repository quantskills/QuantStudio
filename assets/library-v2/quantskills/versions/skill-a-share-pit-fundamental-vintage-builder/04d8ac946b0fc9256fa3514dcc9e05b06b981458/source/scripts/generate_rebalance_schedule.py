from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

try:
    from .build_pit_panel import (
        PitBuildError,
        _normalize_date,
        initialize_panda_data,
        normalize_trading_calendar,
    )
except ImportError:
    from build_pit_panel import (
        PitBuildError,
        _normalize_date,
        initialize_panda_data,
        normalize_trading_calendar,
    )


def monthly_rebalance_dates(calendar: pd.DataFrame) -> pd.DataFrame:
    """Select the last trading day in every calendar month."""
    normalized = normalize_trading_calendar(calendar)
    trading_days = normalized.loc[normalized["is_trading_day"] == 1, ["date"]].copy()
    if trading_days.empty:
        raise PitBuildError("Trading calendar contains no trading days.")
    trading_days["month"] = trading_days["date"].str.slice(0, 6)
    return (
        trading_days.groupby("month", as_index=False)["date"]
        .max()
        .rename(columns={"date": "rebalance_date"})[["rebalance_date"]]
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a monthly last-trading-day rebalance schedule from Panda Data."
    )
    parser.add_argument("--start-date", required=True, help="Start date in YYYYMMDD format")
    parser.add_argument("--end-date", required=True, help="End date in YYYYMMDD format")
    parser.add_argument("--output", type=Path, required=True, help="Output rebalance-date CSV")
    parser.add_argument("--exchange", default="SH", help="Trading-calendar exchange, default: SH")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    start_date = _normalize_date(args.start_date)
    end_date = _normalize_date(args.end_date)
    if start_date > end_date:
        raise PitBuildError("start_date must not be later than end_date.")
    client = initialize_panda_data()
    calendar = client.get_trade_cal(
        start_date=start_date,
        end_date=end_date,
        exchange=args.exchange,
        is_trading_day=1,
    )
    schedule = monthly_rebalance_dates(calendar)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    schedule.to_csv(args.output, index=False, encoding="utf-8-sig")
    print(f"Wrote {len(schedule)} monthly rebalance dates to {args.output}")


if __name__ == "__main__":
    main()
