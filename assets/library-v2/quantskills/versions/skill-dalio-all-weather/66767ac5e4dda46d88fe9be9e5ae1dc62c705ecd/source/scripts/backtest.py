"""Offline portfolio backtest with delayed decisions and drifting holdings."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass
class BacktestResult:
    equity: pd.Series
    daily_return: pd.Series
    weights_used: pd.DataFrame
    turnover: pd.Series
    metrics: dict
    by_quadrant: pd.DataFrame
    executed_rebalance_dates: pd.DatetimeIndex


def run(returns: pd.DataFrame, target_weights: pd.DataFrame,
        quadrant_series: pd.Series | None = None,
        cost_bps: float = 5.0,
        decision_dates: pd.DatetimeIndex | None = None,
        turnover_threshold: float = 0.0,
        evaluation_start: str | pd.Timestamp | None = None) -> BacktestResult:
    """
    Backtest daily log returns.

    A target observed after day ``t`` closes can only trade on the next row.
    Between trades, holdings drift with asset returns.  Turnover is the L1
    distance between the pre-trade drifting holdings and the new target.
    ``cost_bps`` is charged once per unit of that L1 turnover.
    """
    if not np.isfinite(cost_bps) or cost_bps < 0:
        raise ValueError("cost_bps must be finite and nonnegative")
    if not np.isfinite(turnover_threshold) or turnover_threshold < 0:
        raise ValueError(
            "turnover_threshold must be finite and nonnegative"
        )
    if not returns.columns.equals(target_weights.columns):
        raise ValueError("returns and target_weights columns must match")

    idx = returns.index.intersection(target_weights.index)
    ret = returns.loc[idx].fillna(0.0)
    targets = target_weights.loc[idx].ffill().fillna(0.0)
    simple_asset_returns = np.expm1(ret)

    weights_used = pd.DataFrame(0.0, index=idx, columns=ret.columns)
    turnover = pd.Series(0.0, index=idx, name="turnover")
    net_return = pd.Series(0.0, index=idx, name="net_return")

    current = pd.Series(0.0, index=ret.columns, dtype=float)
    previous_target: pd.Series | None = None
    pending_target: pd.Series | None = None
    executed_dates: list[pd.Timestamp] = []
    explicit_decisions = (
        set(pd.DatetimeIndex(decision_dates).intersection(idx))
        if decision_dates is not None
        else None
    )

    for t in idx:
        if pending_target is not None:
            proposed_turnover = float(
                (pending_target - current).abs().sum()
            )
            if proposed_turnover >= turnover_threshold:
                turnover.loc[t] = proposed_turnover
                current = pending_target.copy()
                executed_dates.append(t)
            pending_target = None

        weights_used.loc[t] = current
        gross_return = float(
            (current * simple_asset_returns.loc[t]).sum()
        )
        trading_cost = float(turnover.loc[t] * (cost_bps / 1e4))
        net_return.loc[t] = gross_return - trading_cost

        gross_multiplier = 1.0 + gross_return
        if current.sum() > 0 and gross_multiplier > 0:
            current = (
                current * (1.0 + simple_asset_returns.loc[t])
                / gross_multiplier
            )

        target = targets.loc[t]
        if explicit_decisions is None:
            target_changed = (
                previous_target is None
                or not np.allclose(
                    target.to_numpy(),
                    previous_target.to_numpy(),
                    rtol=0.0,
                    atol=1e-12,
                )
            )
            create_decision = target_changed
        else:
            create_decision = t in explicit_decisions
        if create_decision:
            pending_target = target.copy()
        previous_target = target.copy()

    if evaluation_start is not None:
        evaluation_timestamp = pd.Timestamp(evaluation_start)
        idx = idx[idx >= evaluation_timestamp]
        weights_used = weights_used.loc[idx]
        turnover = turnover.loc[idx]
        net_return = net_return.loc[idx]
        executed_dates = [
            date for date in executed_dates if date >= evaluation_timestamp
        ]

    equity = (1.0 + net_return).cumprod()

    def _cagr(eq: pd.Series) -> float:
        if len(eq) < 2:
            return 0.0
        years = (eq.index[-1] - eq.index[0]).days / 365.25
        if years <= 0:
            return 0.0
        return eq.iloc[-1] ** (1 / years) - 1

    ann_ret = net_return.mean() * 252
    ann_vol = net_return.std() * np.sqrt(252)
    sharpe = ann_ret / ann_vol if ann_vol > 0 else 0.0
    drawdown = equity / equity.cummax() - 1
    metrics = {
        "start": str(idx.min().date()) if len(idx) else "",
        "end": str(idx.max().date()) if len(idx) else "",
        "n_days": int(len(idx)),
        "cagr": float(_cagr(equity)),
        "ann_return": float(ann_ret),
        "ann_vol": float(ann_vol),
        "sharpe": float(sharpe),
        "max_drawdown": float(drawdown.min()) if len(drawdown) else 0.0,
        "avg_turnover_annual": float(
            turnover.sum() * (252 / len(idx))
        ) if len(idx) else 0.0,
        "cost_bps": float(cost_bps),
    }

    if quadrant_series is not None and not quadrant_series.empty:
        quadrant = quadrant_series.reindex(idx).ffill()
        by_quadrant = net_return.groupby(quadrant).agg(
            ann_return=lambda s: s.mean() * 252,
            ann_vol=lambda s: s.std() * np.sqrt(252),
            days=lambda s: len(s),
        )
    else:
        by_quadrant = pd.DataFrame()

    return BacktestResult(
        equity=equity,
        daily_return=net_return,
        weights_used=weights_used,
        turnover=turnover,
        metrics=metrics,
        by_quadrant=by_quadrant,
        executed_rebalance_dates=pd.DatetimeIndex(executed_dates),
    )
