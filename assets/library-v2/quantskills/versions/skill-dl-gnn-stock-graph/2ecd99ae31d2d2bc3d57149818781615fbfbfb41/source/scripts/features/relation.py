"""Graph-relation features (4 dimensions, daily frequency).

Factor list:
  1. degree_centrality    — normalized node degree in the combined graph
  2. pagerank             — PageRank centrality score
  3. dtw_similarity_mean  — mean DTW similarity to all peers
  4. industry_excess_ret  — mean excess return of stocks in the same industry
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import torch

RELATION_FEATURE_NAMES: list[str] = [
    "degree_centrality",
    "pagerank",
    "dtw_similarity_mean",
    "industry_excess_ret",
]
N_RELATION_FEATURES: int = len(RELATION_FEATURE_NAMES)


def _pagerank_numpy(A: np.ndarray, alpha: float = 0.85, max_iter: int = 100) -> np.ndarray:
    """Simple PageRank on a dense (N, N) adjacency matrix."""
    N = A.shape[0]
    if N == 0:
        return np.array([])
    out = np.ones(N, dtype=np.float64) / N
    deg = A.sum(axis=1)
    # Transition matrix: M_ij = A_ij / deg_i (if deg_i > 0)
    deg_safe = np.where(deg > 0, deg, 1.0)
    M = A / deg_safe[:, None]

    for _ in range(max_iter):
        new_out = alpha * (M.T @ out) + (1 - alpha) / N
        if np.abs(new_out - out).sum() < 1e-8:
            break
        out = new_out
    return out


def compute_relation_features(
    adjacency: torch.Tensor,
    symbols: list[str],
    dtw_similarities: dict[str, float] | None = None,
    industry_excess_ret_df: pd.DataFrame | None = None,
    scan_date: str = "",
) -> pd.DataFrame:
    """Compute per-symbol graph-relation features for a given date.

    Args:
        adjacency: (N, N) weighted adjacency matrix from graph builder.
        symbols: ordered list of symbols matching adjacency rows/cols.
        dtw_similarities: dict {symbol: mean_dtw_similarity} if precomputed.
        industry_excess_ret_df: DataFrame with [symbol, industry_code, excess_ret]
                                for the scan date.
        scan_date: YYYYMMDD (for filtering industry_excess_ret_df).

    Returns:
        DataFrame with columns [symbol] + RELATION_FEATURE_NAMES.
    """
    A = adjacency.numpy()
    N = len(symbols)
    df = pd.DataFrame({"symbol": symbols})

    if N == 0 or A.size == 0:
        for c in RELATION_FEATURE_NAMES:
            df[c] = np.nan
        return df

    # 1. Degree centrality
    degrees = A.sum(axis=1)
    df["degree_centrality"] = degrees / max(degrees.max(), 1.0)

    # 2. PageRank
    pr = _pagerank_numpy(A)
    df["pagerank"] = pr

    # 3. DTW similarity mean
    if dtw_similarities:
        df["dtw_similarity_mean"] = df["symbol"].map(dtw_similarities).fillna(0.0)
    else:
        df["dtw_similarity_mean"] = 0.0

    # 4. Industry excess return
    if industry_excess_ret_df is not None and not industry_excess_ret_df.empty:
        ind_df = industry_excess_ret_df.copy()
        if "date" in ind_df.columns and scan_date:
            ind_df = ind_df[ind_df["date"] == scan_date]
        if "symbol" in ind_df.columns and "excess_ret" in ind_df.columns:
            if "industry_code" in ind_df.columns:
                # Average excess_ret per industry
                ind_mean = ind_df.groupby("industry_code")["excess_ret"].mean().reset_index()
                ind_mean.columns = ["industry_code", "industry_excess_ret"]
                ind_df = ind_df.merge(ind_mean, on="industry_code", how="left")
                df = df.merge(ind_df[["symbol", "industry_excess_ret"]], on="symbol", how="left")
            else:
                df = df.merge(ind_df[["symbol", "excess_ret"]], on="symbol", how="left")
                df["industry_excess_ret"] = df["excess_ret"]
                df.drop(columns=["excess_ret"], inplace=True)

    if "industry_excess_ret" not in df.columns:
        df["industry_excess_ret"] = 0.0

    # Fill NaN
    for c in RELATION_FEATURE_NAMES:
        if c in df.columns:
            df[c] = df[c].fillna(0.0)
        else:
            df[c] = 0.0

    return df[["symbol"] + RELATION_FEATURE_NAMES].reset_index(drop=True)
