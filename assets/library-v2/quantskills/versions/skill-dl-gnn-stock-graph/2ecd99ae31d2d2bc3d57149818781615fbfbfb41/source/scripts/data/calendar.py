"""A-share trading calendar utilities.

Provides trading-day-aware date arithmetic for window construction.
All date walks use the official exchange calendar, not natural-day math.

Actual panda_data `get_trade_cal` response columns:
  - nature_date : str (YYYYMMDD) — 自然日期
  - is_trade    : int (1=交易日, 0=非交易日)
  - exchange, next_trade_date, pretrade_date
"""
from __future__ import annotations

import pandas as pd

from scripts.data import loader


def trading_days_between(start: str, end: str, exchange: str = "SH") -> list[str]:
    """Return all trading days in [start, end] (inclusive)."""
    cal = loader.load_trade_cal(start, end, exchange)
    if cal.empty:
        return []
    date_col = "nature_date" if "nature_date" in cal.columns else "date"
    trade_col = "is_trade" if "is_trade" in cal.columns else "is_trading_day"
    trading = cal[cal[trade_col] == 1] if trade_col in cal.columns else cal
    return sorted(trading[date_col].astype(str).tolist())


def prev_trading_dates(
    date: str,
    n: int,
    exchange: str = "SH",
) -> list[str]:
    """Return the `n` most recent trading days strictly before `date`.

    Uses get_prev_trade_date in a loop — efficient for small n (< 500).
    For large n, prefer load_trade_cal directly.
    """
    out: list[str] = []
    cursor = date
    for _ in range(n):
        prev = loader.get_prev_trade_date(cursor, n=1, exchange=exchange)
        if prev is None:
            break
        out.append(prev)
        cursor = prev
    return out


def is_trading_day(date: str, exchange: str = "SH") -> bool:
    """Check whether `date` is a trading day."""
    cal = loader.load_trade_cal(date, date, exchange)
    if cal.empty:
        return False
    date_col = "nature_date" if "nature_date" in cal.columns else "date"
    trade_col = "is_trade" if "is_trade" in cal.columns else "is_trading_day"
    row = cal[cal[date_col] == date]
    if row.empty:
        return False
    return int(row[trade_col].iloc[0]) == 1
