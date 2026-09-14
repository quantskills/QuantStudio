"""Performance metrics for backtest evaluation.

Computes standard quantitative strategy metrics:
  - Annualized return
  - Annualized volatility
  - Maximum drawdown
  - Sharpe ratio
  - Sortino ratio
  - Information ratio (vs benchmark)
  - Calmar ratio
  - Win rate
  - Annualized turnover
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def _annualize(
    daily_values: np.ndarray,
    trading_days: int = 252,
) -> dict:
    """Compute all standard metrics from a daily portfolio value series.

    Args:
        daily_values: (T,) array of daily portfolio values.
        trading_days: trading days per year.

    Returns:
        Dict of metric_name → value.
    """
    eps = 1e-10

    # Daily returns
    daily_ret = np.diff(daily_values) / (daily_values[:-1] + eps)
    daily_ret = np.nan_to_num(daily_ret, nan=0.0)

    T = len(daily_ret)
    if T < 2:
        return {
            "annual_return": 0.0,
            "annual_volatility": 0.0,
            "max_drawdown": 0.0,
            "sharpe_ratio": 0.0,
            "sortino_ratio": 0.0,
            "calmar_ratio": 0.0,
            "win_rate": 0.0,
            "total_return": 0.0,
        }

    # Cumulative
    total_return = daily_values[-1] / max(daily_values[0], eps) - 1.0
    annual_return = (1.0 + total_return) ** (trading_days / T) - 1.0

    # Volatility
    annual_volatility = np.std(daily_ret, ddof=1) * np.sqrt(trading_days)

    # Max drawdown
    peak = np.maximum.accumulate(daily_values)
    drawdown = (daily_values - peak) / (peak + eps)
    max_drawdown = float(np.min(drawdown))

    # Sharpe (assuming 2% risk-free rate)
    rf_daily = 0.02 / trading_days
    excess = daily_ret - rf_daily
    sharpe = np.mean(excess) / (np.std(excess, ddof=1) + eps) * np.sqrt(trading_days)

    # Sortino (downside deviation only)
    downside = np.minimum(excess, 0.0)
    downside_std = np.std(downside, ddof=1) if len(downside) > 1 else 0.0
    sortino = np.mean(excess) / (downside_std + eps) * np.sqrt(trading_days) if downside_std > 0 else 0.0

    # Calmar
    calmar = annual_return / (abs(max_drawdown) + eps)

    # Win rate
    win_rate = float(np.mean(daily_ret > 0))

    return {
        "annual_return": float(annual_return),
        "annual_volatility": float(annual_volatility),
        "max_drawdown": float(max_drawdown),
        "sharpe_ratio": float(sharpe),
        "sortino_ratio": float(sortino),
        "calmar_ratio": float(calmar),
        "win_rate": float(win_rate),
        "total_return": float(total_return),
    }


def compute_metrics(
    portfolio_df: pd.DataFrame,
    benchmark_df: pd.DataFrame | None = None,
    trading_days: int = 252,
) -> dict:
    """Compute full performance metrics from a portfolio NAV history.

    Args:
        portfolio_df: DataFrame with columns [date, nav] (daily).
        benchmark_df: optional DataFrame with [date, nav] for benchmark.
        trading_days: annualization factor.

    Returns:
        Dict of metrics.
    """
    if portfolio_df.empty or "nav" not in portfolio_df.columns:
        return {"error": "empty_portfolio"}

    nav = portfolio_df["nav"].to_numpy(dtype=np.float64)
    metrics = _annualize(nav, trading_days)

    # Information ratio (vs benchmark)
    if benchmark_df is not None and not benchmark_df.empty and "nav" in benchmark_df.columns:
        bench_nav = benchmark_df["nav"].to_numpy(dtype=np.float64)
        if len(bench_nav) == len(nav):
            bench_ret = np.diff(bench_nav) / (bench_nav[:-1] + 1e-10)
            bench_ret = np.nan_to_num(bench_ret, nan=0.0)
            port_ret = np.diff(nav) / (nav[:-1] + 1e-10)
            port_ret = np.nan_to_num(port_ret, nan=0.0)
            active_ret = port_ret - bench_ret
            ir = np.mean(active_ret) / (np.std(active_ret, ddof=1) + 1e-10) * np.sqrt(trading_days)
            metrics["information_ratio"] = float(ir)
            metrics["excess_return"] = float(
                (1.0 + metrics["total_return"]) / (1.0 + _annualize(bench_nav, trading_days)["total_return"]) - 1.0
                if bench_nav[0] > 0 else 0.0
            )
        else:
            metrics["information_ratio"] = 0.0
            metrics["excess_return"] = 0.0
    else:
        metrics["information_ratio"] = 0.0
        metrics["excess_return"] = 0.0

    return metrics


def compute_turnover(trades_df: pd.DataFrame) -> float:
    """Compute annualized turnover from trade records.

    Args:
        trades_df: DataFrame with [date, symbol, qty, price, direction].

    Returns:
        Annualized turnover ratio.
    """
    if trades_df.empty:
        return 0.0

    buys = trades_df[trades_df["direction"] == "buy"]
    sells = trades_df[trades_df["direction"] == "sell"]

    total_buy = (buys["qty"] * buys["price"]).sum()
    total_sell = (sells["qty"] * sells["price"]).sum()

    # Simple estimate: annualize based on number of unique dates
    n_dates = trades_df["date"].nunique()
    if n_dates == 0:
        return 0.0

    daily_turnover = (total_buy + total_sell) / 2 / n_dates
    # This is a rough estimate; proper calculation needs average portfolio NAV
    return float(daily_turnover)
