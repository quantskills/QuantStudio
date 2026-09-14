"""Risk monitoring for A-share GNN strategy.

Four dimensions:
  1. Market risk — VIX proxy, market breadth, index drawdown
  2. Liquidity risk — turnover collapse, spread widening
  3. Systemic risk — GNN-identified contagion paths in the financial network
  4. Concentration risk — single-stock position limit enforcement
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def market_risk_check(
    index_df: pd.DataFrame,
    lookback: int = 20,
    max_drawdown_threshold: float = 0.10,
) -> dict:
    """Check market-level risk signals.

    Args:
        index_df: daily benchmark OHLCV with columns [date, close, pre_close].
        lookback: rolling window for volatility computation.
        max_drawdown_threshold: if recent drawdown exceeds this, flag risk.

    Returns:
        Dict with risk flags: {is_high_vol, is_drawdown, vol_percentile, max_dd_20d}.
    """
    if index_df.empty:
        return {"is_high_vol": False, "is_drawdown": False, "vol_percentile": 0.5, "max_dd_20d": 0.0}

    df = index_df.sort_values("date").copy()
    df["ret"] = df["close"].astype(float) / df["pre_close"].astype(float) - 1.0
    df["vol_20d"] = df["ret"].rolling(lookback, min_periods=5).std()

    # Recent volatility percentile
    recent_vol = df["vol_20d"].dropna()
    if len(recent_vol) > 0:
        latest_vol = recent_vol.iloc[-1]
        vol_pct = (recent_vol < latest_vol).mean()
        is_high_vol = vol_pct > 0.8
    else:
        vol_pct = 0.5
        is_high_vol = False

    # Max drawdown over last 20 days
    close_arr = df["close"].astype(float).to_numpy()
    if len(close_arr) >= lookback:
        recent = close_arr[-lookback:]
        peak = np.maximum.accumulate(recent)
        dd = (recent - peak) / peak
        max_dd = float(np.min(dd))
        is_drawdown = max_dd < -max_drawdown_threshold
    else:
        max_dd = 0.0
        is_drawdown = False

    return {
        "is_high_vol": is_high_vol,
        "is_drawdown": is_drawdown,
        "vol_percentile": float(vol_pct),
        "max_dd_20d": float(max_dd),
    }


def liquidity_risk_check(
    factor_df: pd.DataFrame,
    lookback: int = 5,
    turnover_threshold: float = 0.001,  # 0.1% minimum daily turnover
) -> dict:
    """Check liquidity risk per stock.

    Args:
        factor_df: daily factor panel with [symbol, date, turnover].
        lookback: rolling window for average turnover.
        turnover_threshold: stocks below this avg turnover are flagged.

    Returns:
        Dict with {symbol: is_illiquid} and aggregate flag.
    """
    if factor_df.empty or "turnover" not in factor_df.columns:
        return {"illiquid_count": 0, "illiquid_symbols": [], "is_liquidity_crisis": False}

    df = factor_df.copy()
    df["turnover"] = pd.to_numeric(df["turnover"], errors="coerce")
    df["avg_turnover"] = df.groupby("symbol")["turnover"].transform(
        lambda x: x.rolling(lookback, min_periods=1).mean()
    )

    latest_date = df["date"].max()
    latest = df[df["date"] == latest_date]
    illiquid = latest[latest["avg_turnover"] < turnover_threshold]
    illiquid_symbols = illiquid["symbol"].tolist()

    total = latest["symbol"].nunique()
    crisis = len(illiquid_symbols) / max(total, 1) > 0.3  # >30% illiquid = crisis

    return {
        "illiquid_count": len(illiquid_symbols),
        "illiquid_symbols": illiquid_symbols,
        "is_liquidity_crisis": crisis,
    }


def concentration_check(
    positions: dict[str, float],  # symbol → position_value
    total_nav: float,
    max_single: float = 0.05,
) -> dict:
    """Check single-stock concentration.

    Args:
        positions: symbol → current market value.
        total_nav: total portfolio NAV.
        max_single: max allowed fraction per stock.

    Returns:
        Dict with {over_concentrated: [...], max_weight, violation_count}.
    """
    violations: list[str] = []
    max_weight = 0.0
    for sym, value in positions.items():
        weight = value / max(total_nav, 1.0)
        max_weight = max(max_weight, weight)
        if weight > max_single:
            violations.append(sym)

    return {
        "over_concentrated": violations,
        "max_weight": float(max_weight),
        "violation_count": len(violations),
        "is_concentrated": len(violations) > 0,
    }


def systemic_risk_from_graph(
    adjacency: np.ndarray,
    symbols: list[str],
    top_n: int = 10,
) -> dict:
    """Identify systemically important nodes from the graph structure.

    Uses eigenvector centrality as a proxy for systemic importance:
    nodes that are highly connected to other highly-connected nodes are
    potential contagion channels.

    Args:
        adjacency: (N, N) symmetric normalized adjacency.
        symbols: ordered list of symbols.
        top_n: number of top systemic nodes to return.

    Returns:
        Dict with {top_systemic_symbols, centrality_scores}.
    """
    N = len(symbols)
    if N == 0 or adjacency.size == 0:
        return {"top_systemic_symbols": [], "centrality_scores": {}}

    # Power iteration for eigenvector centrality
    v = np.ones(N, dtype=np.float64) / N
    A = adjacency
    for _ in range(50):
        v_new = A @ v
        norm = np.linalg.norm(v_new)
        if norm < 1e-10:
            break
        v_new = v_new / norm
        if np.abs(v_new - v).sum() < 1e-8:
            v = v_new
            break
        v = v_new

    # Sort by centrality descending
    scores = {symbols[i]: float(np.abs(v[i])) for i in range(N)}
    sorted_pairs = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    top_systemic = [sym for sym, _ in sorted_pairs[:top_n]]

    return {
        "top_systemic_symbols": top_systemic,
        "centrality_scores": dict(sorted_pairs[:top_n]),
    }
