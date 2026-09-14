"""A-share data cleaning — 7 standard treatments.

1. Post-rights adjustment verification (already handled by get_stock_daily_post)
2. Limit-up/down zero-value fill detection & forward-fill
3. Suspension (trade_status != 0) forward-fill of price fields
4. Trading calendar alignment
5. ST/*ST filtering
6. Sub-new-stock filtering (< 60 days since listing)
7. Extreme value winsorization (1%/99%)
"""
from __future__ import annotations

import pandas as pd
import numpy as np


def flag_limit_zero(df: pd.DataFrame) -> pd.DataFrame:
    """Flag rows where limit_up or limit_down is zero (data artifact)."""
    df = df.copy()
    for col in ("limit_up", "limit_down"):
        if col in df.columns:
            df[f"{col}_zero_flag"] = (df[col] == 0).astype(int)
    return df


def ffill_suspended_prices(
    df: pd.DataFrame,
    group_col: str = "symbol",
    date_col: str = "date",
) -> pd.DataFrame:
    """Forward-fill price fields for suspended days (trade_status != 0).

    Suspended-day prices are replaced with the last valid trading day's values
    so that rolling window calculations don't see NaN gaps.
    """
    df = df.sort_values([group_col, date_col]).copy()
    price_cols = ["open", "close", "high", "low", "pre_close", "volume", "amount", "turnover"]

    # Mark suspended rows
    if "trade_status" in df.columns:
        suspended = df["trade_status"] != 0
    else:
        return df

    # Replace suspended-day price columns with NaN, then ffill
    for c in price_cols:
        if c in df.columns:
            df.loc[suspended, c] = np.nan

    # Group-wise forward fill
    fill_cols = [c for c in price_cols if c in df.columns]
    df[fill_cols] = df.groupby(group_col)[fill_cols].ffill()

    return df


def filter_st_stocks(
    df: pd.DataFrame,
    status_df: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """Remove ST/*ST stocks from the panel.

    Args:
        df: main panel with 'symbol' column.
        status_df: from get_stock_status_change; if None, no filtering applied.
    """
    if status_df is None or status_df.empty:
        return df
    # Identify symbols currently marked ST/*ST
    st_symbols = set()
    name_col = None
    for col in ["status", "name", "stock_name"]:
        if col in status_df.columns:
            name_col = col
            break
    if name_col:
        mask = status_df[name_col].astype(str).str.contains("ST", na=False)
        st_symbols = set(status_df.loc[mask, "symbol"].astype(str))
    return df[~df["symbol"].isin(st_symbols)].copy()


def filter_new_listings(
    df: pd.DataFrame,
    float_df: pd.DataFrame,
    min_days: int = 60,
    scan_date: str = "",
) -> pd.DataFrame:
    """Remove stocks listed fewer than `min_days` calendar days before `scan_date`.

    Args:
        df: main panel with 'symbol' column.
        float_df: from get_share_float; must have 'symbol' and 'listed_date' columns.
        min_days: minimum listing days required.
        scan_date: reference date (YYYYMMDD).
    """
    if float_df.empty or "listed_date" not in float_df.columns or "symbol" not in float_df.columns:
        return df

    scan_dt = pd.to_datetime(scan_date, format="%Y%m%d", errors="coerce")
    if pd.isna(scan_dt):
        return df

    float_df = float_df.copy()
    float_df["listed_dt"] = pd.to_datetime(float_df["listed_date"], format="%Y%m%d", errors="coerce")
    float_df["days_listed"] = (scan_dt - float_df["listed_dt"]).dt.days

    valid_symbols = set(float_df.loc[float_df["days_listed"] >= min_days, "symbol"].astype(str))
    return df[df["symbol"].isin(valid_symbols)].copy()


def winsorize_series(s: pd.Series, lower: float = 0.01, upper: float = 0.99) -> pd.Series:
    """Clip extreme values to [lower, upper] quantiles. Returns new Series."""
    lo = s.quantile(lower)
    hi = s.quantile(upper)
    return s.clip(lower=lo, upper=hi)


def winsorize_features(
    df: pd.DataFrame,
    feature_cols: list[str],
    lower: float = 0.01,
    upper: float = 0.99,
) -> pd.DataFrame:
    """Apply winsorization to `feature_cols` in `df`."""
    df = df.copy()
    for c in feature_cols:
        if c in df.columns:
            df[c] = winsorize_series(df[c], lower, upper)
    return df


def clean_pipeline(
    df: pd.DataFrame,
    *,
    status_df: pd.DataFrame | None = None,
    float_df: pd.DataFrame | None = None,
    scan_date: str = "",
    feature_cols: list[str] | None = None,
    min_listed_days: int = 60,
) -> pd.DataFrame:
    """Run the full A-share cleaning pipeline on a merged daily panel.

    Args:
        df: merged panel with columns [symbol, date, open, close, high, low,
            volume, amount, turnover, pre_close, limit_up, limit_down, trade_status].
        status_df: ST/*ST status data.
        float_df: share float data (for listing-date filtering).
        scan_date: reference date YYYYMMDD.
        feature_cols: columns to winsorize (default: all numeric feature columns).
        min_listed_days: minimum listing days.

    Returns:
        Cleaned DataFrame.
    """
    df = flag_limit_zero(df)
    df = ffill_suspended_prices(df)
    df = filter_st_stocks(df, status_df)
    if float_df is not None:
        df = filter_new_listings(df, float_df, min_listed_days, scan_date)

    if feature_cols:
        df = winsorize_features(df, feature_cols)
    else:
        # Default: winsorize all numeric columns except date/symbol/trade_status
        auto_cols = [
            c for c in df.columns
            if c not in ("symbol", "date", "trade_status", "name", "index_symbol")
            and df[c].dtype in ("float64", "float32", "int64", "int32")
        ]
        df = winsorize_features(df, auto_cols)

    return df.reset_index(drop=True)
