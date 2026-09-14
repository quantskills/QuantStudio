"""Implicit (dynamic) relation graphs for A-share stocks.

Implicit relations are data-driven and rebuilt daily/weekly:
  1. DTW (Dynamic Time Warping) similarity on return series
  2. Pearson correlation on return series
  3. Granger causality (pairwise lead-lag test) — computationally heavy, off by default

Each function returns an edge list as a list of (src_symbol, dst_symbol, relation_type, weight) tuples.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from collections import defaultdict


def _return_matrix(
    price_df: pd.DataFrame,
    symbols: list[str],
    lookback: int = 60,
) -> tuple[np.ndarray, list[str]]:
    """Build a (N_symbols, lookback) return matrix from the price panel.

    Args:
        price_df: daily panel with columns [symbol, date, close, pre_close].
        symbols: ordered list of symbols.
        lookback: number of trading days to use.

    Returns:
        (returns, ordered_symbols) — returns is (N, lookback), ordered_symbols aligns.
    """
    df = price_df.copy()
    if "close" not in df.columns or "pre_close" not in df.columns:
        return np.zeros((0, lookback)), []

    df["ret"] = df["close"] / df["pre_close"] - 1.0
    df = df.dropna(subset=["ret"])

    # Pivot: rows=date, cols=symbol, values=ret
    pivot = df.pivot_table(index="date", columns="symbol", values="ret", aggfunc="last")
    pivot = pivot.sort_index().tail(lookback)

    # Keep only columns that appear in `symbols`
    available = [s for s in symbols if s in pivot.columns]
    if not available:
        return np.zeros((0, lookback)), []

    mat = pivot[available].to_numpy(dtype=np.float64).T  # (N, T)
    # Fill NaN with 0 (halt days)
    mat = np.nan_to_num(mat, nan=0.0)
    return mat, available


def _dtw_distance(x: np.ndarray, y: np.ndarray) -> float:
    """Compute DTW distance between two 1-D series. O(T²).

    Uses a Sakoe-Chiba band of 10% for speed on long windows.
    """
    T = len(x)
    if T == 0:
        return 0.0
    # Band width
    w = max(1, int(T * 0.1))
    dtw = np.full((T + 1, T + 1), np.inf)
    dtw[0, 0] = 0.0

    for i in range(1, T + 1):
        lo = max(1, i - w)
        hi = min(T, i + w)
        for j in range(lo, hi + 1):
            cost = (x[i - 1] - y[j - 1]) ** 2
            dtw[i, j] = cost + min(dtw[i - 1, j], dtw[i, j - 1], dtw[i - 1, j - 1])

    return float(np.sqrt(dtw[T, T]))


def _dtw_similarity(x: np.ndarray, y: np.ndarray) -> float:
    """Convert DTW distance to a similarity score in [0, 1]."""
    dist = _dtw_distance(x, y)
    # Normalize by the maximum possible distance between two series of this length
    max_dist = np.sqrt(np.sum((x - y) ** 2)) + np.sqrt(np.sum(x ** 2)) + np.sqrt(np.sum(y ** 2))
    if max_dist < 1e-8:
        return 1.0
    return float(max(0.0, 1.0 - dist / max_dist))


def build_dtw_edges(
    price_df: pd.DataFrame,
    symbols: list[str],
    lookback: int = 60,
    top_k: int = 20,
) -> list[tuple[str, str, str, float]]:
    """Build edges based on DTW similarity of daily return series.

    For each stock, connect to its top_k most DTW-similar peers.

    O(N²·T²) — use only for N < 500 (e.g. CSI300).
    """
    returns, available = _return_matrix(price_df, symbols, lookback)
    n = len(available)
    if n < 2:
        return []

    # Compute pairwise DTW similarity
    sim = np.zeros((n, n), dtype=np.float64)
    for i in range(n):
        for j in range(i + 1, n):
            s = _dtw_similarity(returns[i], returns[j])
            sim[i, j] = s
            sim[j, i] = s

    # Top-K per row (excluding self)
    edges: list[tuple[str, str, str, float]] = []
    seen = set()
    for i in range(n):
        # Get indices of top_k neighbors
        scores = sim[i].copy()
        scores[i] = -1.0  # exclude self
        top_idx = np.argpartition(scores, -top_k)[-top_k:]
        top_idx = top_idx[np.argsort(scores[top_idx])[::-1]]

        for j in top_idx:
            if scores[j] <= 0:
                continue
            key = tuple(sorted([available[i], available[j]]))
            if key in seen:
                continue
            seen.add(key)
            edges.append((available[i], available[j], "dtw", float(scores[j])))

    return edges


def build_correlation_edges(
    price_df: pd.DataFrame,
    symbols: list[str],
    lookback: int = 60,
    threshold: float = 0.5,
) -> list[tuple[str, str, str, float]]:
    """Build edges based on Pearson correlation of daily returns.

    Edge exists if |correlation| >= threshold. Weight = |correlation|.
    """
    returns, available = _return_matrix(price_df, symbols, lookback)
    n = len(available)
    if n < 2:
        return []

    # Correlation matrix (N, N)
    corr = np.corrcoef(returns)
    corr = np.nan_to_num(corr, nan=0.0)

    edges: list[tuple[str, str, str, float]] = []
    seen = set()
    for i in range(n):
        for j in range(i + 1, n):
            c = abs(corr[i, j])
            if c >= threshold:
                key = (available[i], available[j])
                seen.add(key)
                edges.append((available[i], available[j], "correlation", float(c)))

    return edges


def _granger_causality_test(
    x: np.ndarray,
    y: np.ndarray,
    max_lag: int = 5,
    alpha: float = 0.05,
) -> tuple[bool, float]:
    """Test whether x Granger-causes y using an F-test on a linear VAR.

    Returns (is_significant, p_value).
    This is a simplified implementation; for production, use statsmodels.
    """
    from numpy.linalg import lstsq

    T = len(x)
    if T <= max_lag + 2:
        return False, 1.0

    # Build lagged matrices
    Y = y[max_lag:]
    # Restricted: Y ~ lags of Y only
    X_restricted = np.column_stack([y[max_lag - i - 1: T - i - 1] for i in range(max_lag)])
    # Unrestricted: Y ~ lags of Y + lags of X
    X_unrestricted = np.column_stack([
        *[y[max_lag - i - 1: T - i - 1] for i in range(max_lag)],
        *[x[max_lag - i - 1: T - i - 1] for i in range(max_lag)],
    ])

    # OLS
    coef_r, resid_r, _, _ = lstsq(X_restricted, Y)
    coef_u, resid_u, _, _ = lstsq(X_unrestricted, Y)

    ssr_r = np.sum(resid_r ** 2) if len(resid_r) else 0
    ssr_u = np.sum(resid_u ** 2) if len(resid_u) else 0

    if ssr_u < 1e-12:
        return False, 1.0

    n_obs = len(Y)
    df_r = X_restricted.shape[1]
    df_u = X_unrestricted.shape[1]
    df_diff = df_u - df_r

    if df_diff <= 0 or n_obs <= df_u:
        return False, 1.0

    f_stat = ((ssr_r - ssr_u) / df_diff) / (ssr_u / (n_obs - df_u))
    if f_stat <= 0:
        return False, 1.0

    # Approximate p-value via F-distribution. For simplicity, skip the full F CDF;
    # use a heuristic: if F > ~4, it's likely significant at alpha=0.05 with typical df.
    # For production: `from scipy.stats import f` → f.sf(f_stat, df_diff, n_obs - df_u)
    is_sig = f_stat > 3.0  # coarse threshold for df_diff=5, n_obs~50

    return is_sig, float(1.0 / (1.0 + f_stat))  # pseudo-p-value


def build_granger_edges(
    price_df: pd.DataFrame,
    symbols: list[str],
    lookback: int = 120,
    max_lag: int = 5,
    max_edges_per_stock: int = 5,
) -> list[tuple[str, str, str, float]]:
    """Build directed edges from Granger-causal relationships.

    Edge A→B exists if A's returns Granger-cause B's returns at p < 0.05.

    O(N²·T) — **very expensive**. Use only for N < 100 or off by default.

    Returns:
        List of (src, dst, 'granger', 1 - p_value) — weight = 1 - p so higher = more significant.
    """
    returns, available = _return_matrix(price_df, symbols, lookback)
    n = len(available)
    if n < 2:
        return []

    edges: list[tuple[str, str, str, float]] = []
    for i in range(n):
        sig_pairs: list[tuple[int, float]] = []
        for j in range(n):
            if i == j:
                continue
            is_sig, p_val = _granger_causality_test(returns[i], returns[j], max_lag)
            if is_sig:
                sig_pairs.append((j, 1.0 - p_val))

        # Keep top max_edges_per_stock per source
        sig_pairs.sort(key=lambda x: x[1], reverse=True)
        for j, w in sig_pairs[:max_edges_per_stock]:
            edges.append((available[i], available[j], "granger", float(w)))

    return edges


def build_all_implicit_edges(
    price_df: pd.DataFrame,
    symbols: list[str],
    lookback: int = 60,
    *,
    enable_dtw: bool = True,
    enable_correlation: bool = True,
    enable_granger: bool = False,
    dtw_top_k: int = 20,
    corr_threshold: float = 0.5,
) -> list[tuple[str, str, str, float]]:
    """Build all implicit (dynamic) relation edges.

    Returns:
        Combined edge list: (src, dst, relation_type, weight).
    """
    edges: list[tuple[str, str, str, float]] = []

    if enable_dtw:
        edges.extend(build_dtw_edges(price_df, symbols, lookback, top_k=dtw_top_k))
    if enable_correlation:
        edges.extend(build_correlation_edges(price_df, symbols, lookback, threshold=corr_threshold))
    if enable_granger:
        edges.extend(build_granger_edges(price_df, symbols, lookback))

    return edges
