"""Stock selector — TopK and threshold-based selection from GNN scores.

Two strategies:
  1. TopK: pick the K stocks with the highest predicted scores.
  2. Threshold: only pick stocks with score >= min_score, then rank top-K.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def select_top_k(
    scores: np.ndarray,
    symbols: list[str],
    top_k: int = 30,
    min_score: float | None = None,
) -> pd.DataFrame:
    """TopK stock selection from GNN predicted scores.

    Args:
        scores: (N,) float32 predicted return scores.
        symbols: (N,) list of stock codes aligned with scores.
        top_k: number of stocks to select.
        min_score: if set, filter out stocks with score < min_score before ranking.

    Returns:
        DataFrame with columns [rank, symbol, score], sorted by score descending.
    """
    df = pd.DataFrame({"symbol": list(symbols), "score": scores.astype(float)})

    # NaN guard
    df = df.dropna(subset=["score"])

    # Threshold filter
    if min_score is not None:
        df = df[df["score"] >= min_score]

    if df.empty:
        return pd.DataFrame(columns=["rank", "symbol", "score"])

    # Sort descending
    df = df.sort_values("score", ascending=False).head(top_k).reset_index(drop=True)
    df["rank"] = range(1, len(df) + 1)
    return df[["rank", "symbol", "score"]]
