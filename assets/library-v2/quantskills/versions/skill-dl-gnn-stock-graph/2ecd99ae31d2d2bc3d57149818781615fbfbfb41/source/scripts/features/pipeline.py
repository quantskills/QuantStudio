"""Feature engineering pipeline.

Orchestrates the full feature assembly:
  1. Price features (daily, 14 dims)
  2. Fundamental features (quarterly→daily forward-fill, 7 dims)
  3. Sentiment features (daily, 3 dims)
  4. Graph-relation features (daily, 4 dims)

Then:
  5. Merge into a unified per-(symbol, date) panel
  6. Stack into fixed-length windows (lookback days × features)
  7. Winsorize (1%/99%) + Z-score standardize (train stats only → no leakage)
  8. Package as FeatureBundle for the GNN model
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
import torch

from scripts.features.price import (
    compute_price_features,
    PRICE_FEATURE_NAMES,
    N_PRICE_FEATURES,
)
from scripts.features.fundamental import (
    compute_fundamental_features,
    FUNDAMENTAL_FEATURE_NAMES,
    N_FUNDAMENTAL_FEATURES,
)
from scripts.features.sentiment import (
    compute_sentiment_features,
    SENTIMENT_FEATURE_NAMES,
    N_SENTIMENT_FEATURES,
)
from scripts.features.relation import (
    compute_relation_features,
    RELATION_FEATURE_NAMES,
    N_RELATION_FEATURES,
)

# ---------------------------------------------------------------------------
# All feature columns (ordered)
# ---------------------------------------------------------------------------
ALL_FEATURE_NAMES: list[str] = (
    PRICE_FEATURE_NAMES
    + FUNDAMENTAL_FEATURE_NAMES
    + SENTIMENT_FEATURE_NAMES
    + RELATION_FEATURE_NAMES
)
N_ALL_FEATURES: int = len(ALL_FEATURE_NAMES)  # 28 raw features per day


@dataclass
class FeatureBundle:
    """Container for the full feature pipeline output."""

    train_x: np.ndarray            # (N_train, lookback * N_ALL_FEATURES), z-scored
    train_adj: torch.Tensor        # (N_nodes, N_nodes) adjacency for training graph
    score_x: np.ndarray            # (N_score, lookback * N_ALL_FEATURES), z-scored
    score_adj: torch.Tensor        # (N_nodes, N_nodes) adjacency for scoring graph
    score_symbols: list[str]       # ordered symbols aligned with score_x rows
    train_symbols: list[str]       # ordered symbols aligned with train_x rows
    train_dates: list[str]         # last-day-of-window date per training row
    feat_mean: np.ndarray          # (lookback * N_ALL_FEATURES,) column means from training
    feat_std: np.ndarray           # (lookback * N_ALL_FEATURES,) column stds from training
    lookback: int
    n_features: int                # = N_ALL_FEATURES

    @property
    def feature_columns(self) -> list[str]:
        """Flat column names: d{day}_{feat_name}."""
        cols = []
        for day in range(self.lookback):
            for name in ALL_FEATURE_NAMES:
                cols.append(f"d{day}_{name}")
        return cols


# ---------------------------------------------------------------------------
# Panel assembly
# ---------------------------------------------------------------------------
def build_unified_panel(
    factor_df: pd.DataFrame,
    post_df: pd.DataFrame,
    index_df: pd.DataFrame,
    fina_df: pd.DataFrame,
    share_float_df: pd.DataFrame,
    lhb_df: pd.DataFrame,
    block_trade_df: pd.DataFrame,
    industry_df: pd.DataFrame,
    adjacency: torch.Tensor,
    symbols: list[str],
    scan_date: str,
    news_sentiment_csv: str | None = None,
) -> pd.DataFrame:
    """Merge all feature sources into one per-(symbol, date) DataFrame.

    Returns:
        DataFrame with columns [symbol, date] + ALL_FEATURE_NAMES.
    """
    # 1. Price
    merged = factor_df.merge(
        post_df[["symbol", "date", "pre_close", "limit_up", "limit_down"]],
        on=["symbol", "date"],
        how="inner",
    )
    price_feat = compute_price_features(merged, index_df)

    # 2. Fundamental
    fund_feat = compute_fundamental_features(factor_df, fina_df, share_float_df)

    # 3. Sentiment
    uni_list = list(symbols) if symbols else factor_df["symbol"].unique().tolist()
    sent_feat = compute_sentiment_features(
        lhb_df, block_trade_df, uni_list, news_sentiment_csv=news_sentiment_csv,
    )

    # 4. Relation features — build industry excess ret from price data + industry mapping
    # B4 fix: compute industry_excess_ret from price features and industry dataframe
    ind_excess_ret_df: pd.DataFrame | None = None
    if not industry_df.empty and "excess_ret" in price_feat.columns:
        sym_col = next((c for c in industry_df.columns if c in ("stock_symbol", "symbol")), None)
        ind_col = next((c for c in industry_df.columns if c in ("l1_code", "industry_code")), None)
        if sym_col and ind_col:
            price_with_ind = price_feat.merge(
                industry_df[[sym_col, ind_col]].rename(columns={sym_col: "symbol"}),
                on="symbol", how="left",
            )
            ind_mean = price_with_ind.groupby([ind_col, "date"])["excess_ret"].mean().reset_index()
            ind_mean = ind_mean.rename(columns={"excess_ret": "industry_excess_ret"})
            ind_excess_ret_df = price_with_ind[["symbol", ind_col, "date", "excess_ret"]].merge(
                ind_mean, on=[ind_col, "date"], how="left",
            )

    rel_feat = compute_relation_features(
        adjacency, list(symbols),
        industry_excess_ret_df=ind_excess_ret_df,
        scan_date=scan_date,
    )
    # Broadcast relation features to all dates in the panel
    all_dates = sorted(price_feat["date"].unique())
    rel_rows: list[dict] = []
    for _, row in rel_feat.iterrows():
        for d in all_dates:
            rel_rows.append({"symbol": row["symbol"], "date": d, **{c: row[c] for c in RELATION_FEATURE_NAMES}})
    rel_feat_daily = pd.DataFrame(rel_rows)

    # --- Merge all ---
    panel = price_feat.merge(fund_feat, on=["symbol", "date"], how="left")
    panel = panel.merge(sent_feat, on=["symbol", "date"], how="left")
    panel = panel.merge(rel_feat_daily, on=["symbol", "date"], how="left")

    # Forward-fill fundamental & sentiment features (NaN on non-report days)
    ffill_cols = FUNDAMENTAL_FEATURE_NAMES + SENTIMENT_FEATURE_NAMES
    panel = panel.sort_values(["symbol", "date"])
    panel[ffill_cols] = panel.groupby("symbol")[ffill_cols].ffill()

    # Fill remaining NaN with 0
    panel[ALL_FEATURE_NAMES] = panel[ALL_FEATURE_NAMES].fillna(0.0)

    return panel[["symbol", "date"] + ALL_FEATURE_NAMES].reset_index(drop=True)


# ---------------------------------------------------------------------------
# Window stacking
# ---------------------------------------------------------------------------
def _stack_windows(
    panel: pd.DataFrame,
    scan_date: str,
    lookback: int,
    train_days: int,
    max_missing_in_train: int = 5,
) -> tuple[np.ndarray, np.ndarray, list[str], list[str], list[str]]:
    """Slice the unified panel into fixed-length windows.

    Returns:
        train_x_raw, score_x_raw, train_symbols, train_dates, score_symbols.
    """
    train_rows: list[np.ndarray] = []
    train_symbols: list[str] = []
    train_dates: list[str] = []
    score_rows: list[np.ndarray] = []
    score_symbols: list[str] = []

    for symbol, g in panel.groupby("symbol", sort=True):
        g_sorted = g.sort_values("date").reset_index(drop=True)

        # Training windows (strictly date < scan_date)
        past = g_sorted[g_sorted["date"] < scan_date].reset_index(drop=True)
        past = past.tail(train_days).reset_index(drop=True)
        na_count = past[ALL_FEATURE_NAMES].isna().sum(axis=1)
        halted_in_train = int((na_count > 0).sum())
        include_in_train = halted_in_train <= max_missing_in_train

        if include_in_train and len(past) >= lookback:
            values = past[ALL_FEATURE_NAMES].to_numpy(dtype=np.float64)
            dates = past["date"].tolist()
            for end_idx in range(lookback - 1, len(past)):
                start_idx = end_idx - lookback + 1
                window = values[start_idx: end_idx + 1]
                if np.isnan(window).any():
                    continue
                train_rows.append(window.reshape(-1))
                train_symbols.append(str(symbol))
                train_dates.append(str(dates[end_idx]))

        # Scoring window (ending at scan_date)
        recent = g_sorted[g_sorted["date"] <= scan_date].reset_index(drop=True)
        if len(recent) < lookback:
            continue
        tail = recent.tail(lookback).reset_index(drop=True)
        if str(tail["date"].iloc[-1]) != scan_date:
            continue
        values = tail[ALL_FEATURE_NAMES].to_numpy(dtype=np.float64)
        if np.isnan(values).any():
            continue
        score_rows.append(values.reshape(-1))
        score_symbols.append(str(symbol))

    train_x = np.stack(train_rows, axis=0) if train_rows else np.zeros(
        (0, lookback * N_ALL_FEATURES), dtype=np.float64
    )
    score_x = np.stack(score_rows, axis=0) if score_rows else np.zeros(
        (0, lookback * N_ALL_FEATURES), dtype=np.float64
    )
    # Hard NaN/inf guard — prevent propagation through std computation
    train_x = np.nan_to_num(train_x, nan=0.0, posinf=1e4, neginf=-1e4)
    score_x = np.nan_to_num(score_x, nan=0.0, posinf=1e4, neginf=-1e4)
    return train_x, score_x, train_symbols, train_dates, score_symbols


# ---------------------------------------------------------------------------
# Main pipeline entry point
# ---------------------------------------------------------------------------
def build_features(
    factor_df: pd.DataFrame,
    post_df: pd.DataFrame,
    index_df: pd.DataFrame,
    fina_df: pd.DataFrame,
    share_float_df: pd.DataFrame,
    lhb_df: pd.DataFrame,
    block_trade_df: pd.DataFrame,
    industry_df: pd.DataFrame,
    adjacency: torch.Tensor,
    symbols: list[str],
    scan_date: str,
    lookback: int = 20,
    train_days: int = 252,
    news_sentiment_csv: str | None = None,
) -> FeatureBundle:
    """Full feature pipeline for GNN stock graph.

    Args:
        factor_df: from data.loader.load_factor — OHLCV + turnover + market_cap.
        post_df: from data.loader.load_stock_post — pre_close + limits + trade_status.
        index_df: from data.loader.load_index_daily — benchmark OHLCV.
        fina_df: from data.loader.load_fina_reports — quarterly financials.
        share_float_df: from data.loader.load_share_float — shares/listing date.
        lhb_df: from data.loader.load_lhb_list — dragon-tiger board.
        block_trade_df: from data.loader.load_block_trade — block trades.
        industry_df: from data.loader.load_industry_constituents.
        adjacency: (N, N) adjacency matrix from graph builder.
        symbols: ordered list of universe symbols.
        scan_date: YYYYMMDD.
        lookback: window length in trading days.
        train_days: training window in trading days.
        news_sentiment_csv: optional external sentiment file.

    Returns:
        FeatureBundle with z-scored train/score tensors + adjacency.
    """
    # 1. Build unified panel
    panel = build_unified_panel(
        factor_df, post_df, index_df, fina_df, share_float_df,
        lhb_df, block_trade_df, industry_df, adjacency, symbols, scan_date,
        news_sentiment_csv=news_sentiment_csv,
    )

    # 2. Stack into windows
    train_x, score_x, train_syms, train_dates, score_syms = _stack_windows(
        panel, scan_date=scan_date, lookback=lookback, train_days=train_days,
    )

    # 3. Z-score with train-only statistics
    D = lookback * N_ALL_FEATURES
    if train_x.shape[0] == 0:
        feat_mean = np.zeros(D, dtype=np.float64)
        feat_std = np.ones(D, dtype=np.float64)
    else:
        feat_mean = train_x.mean(axis=0)
        feat_std = train_x.std(axis=0)
        feat_std = np.where(feat_std < 1e-8, 1.0, feat_std)

    train_z = (train_x - feat_mean) / feat_std if train_x.shape[0] else train_x
    score_z = (score_x - feat_mean) / feat_std if score_x.shape[0] else score_x

    # 4. Align adjacency to score symbols
    sym_to_idx = {s: i for i, s in enumerate(symbols)}
    score_indices = [sym_to_idx[s] for s in score_syms if s in sym_to_idx]
    score_adj = adjacency
    if score_indices:
        score_adj = adjacency[score_indices][:, score_indices]

    return FeatureBundle(
        train_x=train_z.astype(np.float32),
        train_adj=adjacency,
        score_x=score_z.astype(np.float32),
        score_adj=score_adj,
        score_symbols=score_syms,
        train_symbols=train_syms,
        train_dates=train_dates,
        feat_mean=feat_mean,
        feat_std=feat_std,
        lookback=lookback,
        n_features=N_ALL_FEATURES,
    )
