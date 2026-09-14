"""Sentiment and alternative-data factors (3 dimensions, daily frequency).

Factor list:
  1. news_sentiment      — external LLM sentiment score [-1, 1]
  2. lhb_flag            — dragon-tiger board appearance flag (0/1)
  3. block_trade_premium — block trade premium rate (weighted avg)

NOTE: news_sentiment requires external LLM pipeline to inject pre-computed
      sentiment scores via a CSV file. v0.1 defaults to NaN for this feature
      unless `--sentiment-file` is provided at runtime.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

SENTIMENT_FEATURE_NAMES: list[str] = [
    "news_sentiment",
    "lhb_flag",
    "block_trade_premium",
]
N_SENTIMENT_FEATURES: int = len(SENTIMENT_FEATURE_NAMES)


def compute_sentiment_features(
    lhb_df: pd.DataFrame,
    block_trade_df: pd.DataFrame,
    universe: list[str],
    news_sentiment_csv: str | None = None,
) -> pd.DataFrame:
    """Compute per-(symbol, date) sentiment/alternative features.

    Args:
        lhb_df: from get_lhb_list — dragon-tiger board appearances.
        block_trade_df: from get_block_trade — block trade records.
        universe: list of symbols to include.
        news_sentiment_csv: path to a CSV with columns [date, symbol, sentiment],
                            where sentiment ∈ [-1, 1]. If None, news_sentiment = NaN.

    Returns:
        DataFrame with columns [symbol, date] + SENTIMENT_FEATURE_NAMES.
    """
    uni_df = pd.DataFrame({"symbol": list(universe)})

    # --- LHB flag ---
    if not lhb_df.empty and "symbol" in lhb_df.columns and "date" in lhb_df.columns:
        lhb = lhb_df.copy()
        lhb["date"] = lhb["date"].astype(str)
        lhb["symbol"] = lhb["symbol"].astype(str)
        lhb["lhb_flag"] = 1
        lhb_feat = lhb[["symbol", "date", "lhb_flag"]].drop_duplicates()
    else:
        lhb_feat = pd.DataFrame(columns=["symbol", "date", "lhb_flag"])

    # --- Block trade premium ---
    if not block_trade_df.empty and "symbol" in block_trade_df.columns and "date" in block_trade_df.columns:
        bt = block_trade_df.copy()
        bt["date"] = bt["date"].astype(str)
        bt["symbol"] = bt["symbol"].astype(str)
        # Try to compute premium: (trade_price - close) / close
        premium_col = None
        for c in ["premium_rate", "premium", "discount_rate"]:
            if c in bt.columns:
                premium_col = c
                break
        if premium_col:
            bt["block_trade_premium"] = pd.to_numeric(bt[premium_col], errors="coerce")
        else:
            bt["block_trade_premium"] = 0.0
        bt_feat = bt.groupby(["symbol", "date"])["block_trade_premium"].mean().reset_index()
    else:
        bt_feat = pd.DataFrame(columns=["symbol", "date", "block_trade_premium"])

    # --- News sentiment (external) ---
    if news_sentiment_csv:
        try:
            news = pd.read_csv(news_sentiment_csv)
            news["date"] = news["date"].astype(str)
            news["symbol"] = news["symbol"].astype(str)
            news_feat = news[["symbol", "date", "news_sentiment"]].drop_duplicates()
        except Exception:
            news_feat = pd.DataFrame(columns=["symbol", "date", "news_sentiment"])
    else:
        news_feat = pd.DataFrame(columns=["symbol", "date", "news_sentiment"])

    # --- Merge all ---
    # Get all (symbol, date) pairs from the union of all source dates
    all_dates: set[str] = set()
    for df in (lhb_feat, bt_feat, news_feat):
        if not df.empty and "date" in df.columns:
            all_dates.update(df["date"].astype(str))

    if not all_dates:
        # No sentiment data at all
        result = uni_df.copy()
        result["date"] = ""
        for c in SENTIMENT_FEATURE_NAMES:
            result[c] = np.nan
        return result[["symbol", "date"] + SENTIMENT_FEATURE_NAMES]

    # Build a full grid
    rows = []
    for sym in universe:
        for d in sorted(all_dates):
            rows.append({"symbol": sym, "date": d})
    grid = pd.DataFrame(rows)

    # Merge each source
    for feat_df, col in [(lhb_feat, "lhb_flag"), (bt_feat, "block_trade_premium"),
                           (news_feat, "news_sentiment")]:
        if not feat_df.empty:
            grid = grid.merge(feat_df[["symbol", "date", col]], on=["symbol", "date"], how="left")

    # Fill missing flags
    if "lhb_flag" in grid.columns:
        grid["lhb_flag"] = grid["lhb_flag"].fillna(0).astype(int)
    else:
        grid["lhb_flag"] = 0

    for c in SENTIMENT_FEATURE_NAMES:
        if c not in grid.columns:
            grid[c] = np.nan

    return grid[["symbol", "date"] + SENTIMENT_FEATURE_NAMES].reset_index(drop=True)
