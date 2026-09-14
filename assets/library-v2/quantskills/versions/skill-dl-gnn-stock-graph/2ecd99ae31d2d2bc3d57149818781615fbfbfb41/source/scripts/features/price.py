"""Price-volume factors (14 dimensions, daily frequency).

Factor list:
  1. ret             — daily return: close/pre_close - 1
  2. log_vol         — log(volume + 1)
  3. amplitude       — (high - low) / pre_close
  4. turnover        — turnover rate
  5. gap             — open/pre_close - 1
  6. dist_limit_up   — (limit_up - close) / close
  7. dist_limit_down — (close - limit_down) / close
  8. excess_ret      — ret - index_ret
  9. mom_5d          — 5-day momentum
  10. mom_20d        — 20-day momentum
  11. volatility_20d  — 20-day rolling std of ret
  12. macd           — MACD (EMA12 - EMA26)
  13. rsi            — 14-day RSI
  14. money_flow     — 5-day amount change ratio
"""
from __future__ import annotations

import numpy as np
import pandas as pd

PRICE_FEATURE_NAMES: list[str] = [
    "ret",
    "log_vol",
    "amplitude",
    "turnover",
    "gap",
    "dist_limit_up",
    "dist_limit_down",
    "excess_ret",
    "mom_5d",
    "mom_20d",
    "volatility_20d",
    "macd",
    "rsi",
    "money_flow",
]
N_PRICE_FEATURES: int = len(PRICE_FEATURE_NAMES)


def _ema(series: np.ndarray, span: int) -> np.ndarray:
    """Exponential moving average. Returns same-length array (NaN where not enough data)."""
    alpha = 2.0 / (span + 1)
    out = np.full_like(series, np.nan, dtype=np.float64)
    if len(series) == 0:
        return out
    out[0] = series[0]
    for i in range(1, len(series)):
        out[i] = alpha * series[i] + (1 - alpha) * out[i - 1]
    return out


def compute_price_features(
    stock_df: pd.DataFrame,
    index_df: pd.DataFrame,
) -> pd.DataFrame:
    """Compute per-(symbol, date) price-volume features.

    Args:
        stock_df: merged panel with columns
            [symbol, date, open, close, high, low, volume, amount, turnover,
             pre_close, limit_up, limit_down].
        index_df: benchmark index panel with columns [date, close, pre_close].

    Returns:
        DataFrame with columns [symbol, date] + PRICE_FEATURE_NAMES.
    """
    df = stock_df.copy()

    # ------------------------------
    # Numeric casts
    # ------------------------------
    num_cols = [
        "open", "close", "high", "low", "volume", "amount",
        "turnover", "pre_close", "limit_up", "limit_down",
    ]
    for c in num_cols:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")

    # ------------------------------
    # Static daily features (1-8)
    # ------------------------------
    pc = df["pre_close"].where(df["pre_close"] > 0, np.nan)
    df["ret"] = df["close"] / pc - 1.0
    df["log_vol"] = np.log(df["volume"].clip(lower=0.0) + 1.0)
    df["amplitude"] = (df["high"] - df["low"]) / pc
    df["gap"] = df["open"] / pc - 1.0
    df["dist_limit_up"] = (df["limit_up"] - df["close"]) / df["close"].where(df["close"] > 0, np.nan)
    df["dist_limit_down"] = (df["close"] - df["limit_down"]) / df["close"].where(df["close"] > 0, np.nan)
    # turnover already present; keep as-is

    # ------------------------------
    # Index return → excess_ret (8)
    # ------------------------------
    idx = index_df[["date", "close", "pre_close"]].copy()
    for c in ["close", "pre_close"]:
        idx[c] = pd.to_numeric(idx[c], errors="coerce")
    idx_pc = idx["pre_close"].where(idx["pre_close"] > 0, np.nan)
    idx["index_ret"] = idx["close"] / idx_pc - 1.0
    df = df.merge(idx[["date", "index_ret"]], on="date", how="left")
    df["excess_ret"] = df["ret"] - df["index_ret"]

    # ------------------------------
    # Rolling features (9-14) — per symbol
    # ------------------------------
    df = df.sort_values(["symbol", "date"]).reset_index(drop=True)

    for sym, g in df.groupby("symbol", sort=False):
        g = g.sort_values("date")
        idx_mask = g.index

        ret_s = g["ret"]
        close_s = g["close"]

        # mom_5d
        df.loc[idx_mask, "mom_5d"] = close_s / close_s.shift(5) - 1.0

        # mom_20d
        df.loc[idx_mask, "mom_20d"] = close_s / close_s.shift(20) - 1.0

        # volatility_20d
        df.loc[idx_mask, "volatility_20d"] = ret_s.rolling(20, min_periods=5).std()

        # MACD
        close_arr = close_s.to_numpy(dtype=np.float64)
        ema12 = _ema(close_arr, 12)
        ema26 = _ema(close_arr, 26)
        macd_line = ema12 - ema26
        df.loc[idx_mask, "macd"] = macd_line / close_arr  # normalize by price

        # RSI (14-day)
        delta = ret_s.to_numpy(dtype=np.float64)
        gain = np.where(delta > 0, delta, 0.0)
        loss = np.where(delta < 0, -delta, 0.0)
        avg_gain = pd.Series(gain).rolling(14, min_periods=14).mean().to_numpy()
        avg_loss = pd.Series(loss).rolling(14, min_periods=14).mean().to_numpy()
        with np.errstate(divide="ignore", invalid="ignore"):
            rs = np.where(avg_loss > 0, avg_gain / avg_loss, 0.0)
        rsi_vals = np.where(avg_loss > 0, 100.0 - 100.0 / (1.0 + rs), 50.0)
        df.loc[idx_mask, "rsi"] = rsi_vals

        # money_flow
        amt = g["amount"] if "amount" in g.columns else pd.Series(np.nan, index=g.index)
        df.loc[idx_mask, "money_flow"] = (amt / amt.shift(5) - 1.0).values

    # Fill NaN in rolling features (early rows don't have enough history)
    for c in ["mom_5d", "mom_20d", "volatility_20d", "macd", "rsi", "money_flow"]:
        if c in df.columns:
            df[c] = df[c].fillna(0.0)

    # Keep only needed columns
    keep = ["symbol", "date"] + PRICE_FEATURE_NAMES
    return df[keep].reset_index(drop=True)
