"""Target construction for the A-share All Weather research model.

The default method is ``normalize(regime_base / trailing_60d_volatility)``.
It is a base-weighted inverse-volatility risk budget, not strict ERC.
Ex-post covariance risk contributions are reported separately.

By default, targets are formed only at completed period ends.  Regime changes
are recorded but do not create an extra target unless explicitly enabled.
Every target uses returns through t-1 and can trade no earlier than t+1.
Actual holding drift, turnover thresholds, and trading costs belong to the
backtest module.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd


# ---- 默认象限基准权重（A 股五类资产） ----------------------------------
# 每个象限里，五类资产的偏好权重（未做波动率归一化的）。
# Bridgewater 经典比例：30/40/15/7.5/7.5，四个象限做偏移。
DEFAULT_BASE_ALLOCATION = pd.Series(
    {"stock": 0.30, "bond_long": 0.40, "bond_mid": 0.15,
     "gold": 0.075, "commodity": 0.075})

DEFAULT_QUADRANT_TILT = {
    # 增长↑通胀↑(过热)：偏商品/黄金，减长债
    "Q1_growUp_infUp": pd.Series(
        {"stock": 0.25, "bond_long": 0.20, "bond_mid": 0.15,
         "gold": 0.20, "commodity": 0.20}),
    # 增长↑通胀↓(复苏)：偏股票
    "Q2_growUp_infDn": pd.Series(
        {"stock": 0.40, "bond_long": 0.30, "bond_mid": 0.15,
         "gold": 0.075, "commodity": 0.075}),
    # 增长↓通胀↑(滞胀)：偏黄金、减股
    "Q3_growDn_infUp": pd.Series(
        {"stock": 0.15, "bond_long": 0.25, "bond_mid": 0.20,
         "gold": 0.25, "commodity": 0.15}),
    # 增长↓通胀↓(衰退)：偏长债、减商品
    "Q4_growDn_infDn": pd.Series(
        {"stock": 0.20, "bond_long": 0.50, "bond_mid": 0.20,
         "gold": 0.05, "commodity": 0.05}),
}

# 兼容旧接口
BASE_ALLOCATION = DEFAULT_BASE_ALLOCATION
QUADRANT_TILT = DEFAULT_QUADRANT_TILT

DEFAULT_VOL_MIN_PERIODS = 20
DEFAULT_VOL_WINDOW = 60
DEFAULT_VOL_FLOOR = 1e-4
DEFAULT_TURNOVER_THRESHOLD = 0.05
ALLOCATION_METHOD = "inverse_volatility"


@dataclass
class AllocationConfig:
    """
    资产配置的完整参数化容器。跨市场复用时替换其字段即可。
    - base:     无象限信号时的默认权重（Series，index=资产名）
    - tilts:    dict[quadrant_key, Series]，各象限的偏好权重
    """
    base: pd.Series = field(default_factory=lambda: DEFAULT_BASE_ALLOCATION.copy())
    tilts: dict[str, pd.Series] = field(
        default_factory=lambda: {k: v.copy() for k, v in DEFAULT_QUADRANT_TILT.items()})

    def assets(self) -> list[str]:
        return list(self.base.index)


# ---- 波动率倒数加权 -----------------------------------------------------

def realized_vol(returns: pd.DataFrame, window: int = DEFAULT_VOL_WINDOW,
                 min_periods: int = DEFAULT_VOL_MIN_PERIODS) -> pd.DataFrame:
    """滚动实现波动率（日度对数收益的滚动 std）。"""
    if window <= 0:
        raise ValueError("window must be positive")
    if min_periods <= 0:
        raise ValueError("min_periods must be positive")
    effective_min_periods = min(window, min_periods)
    return returns.rolling(
        window=window,
        min_periods=effective_min_periods,
    ).std()


def inverse_volatility_weights(
        base: pd.Series,
        vols: pd.Series,
        floor: float = DEFAULT_VOL_FLOOR) -> pd.Series:
    """
    输入某一天的 base 权重与该天的波动率（Series，index=资产名）。
    返回归一化后的目标权重（总和 = 1）。
    """
    v = vols.reindex(base.index).astype(float).fillna(vols.mean())
    v = v.clip(lower=floor)
    inv_v = 1.0 / v
    raw = base * inv_v
    if raw.sum() == 0 or np.isnan(raw.sum()):
        # 极端情况下退化到 base
        return base / base.sum()
    return raw / raw.sum()


def risk_contribution_diagnostic(
        weights: pd.Series,
        covariance: pd.DataFrame) -> dict:
    """
    Report ex-post covariance risk contributions.

    This is a diagnostic only; the default allocation remains the simpler
    base-weighted inverse-volatility method.
    """
    assets = list(weights.index)
    w = weights.reindex(assets).astype(float)
    cov = covariance.reindex(index=assets, columns=assets).astype(float)
    if cov.isna().any().any() or w.isna().any():
        return {
            "by_asset": {},
            "max_contribution": None,
            "herfindahl": None,
            "unavailable_reason": "incomplete_covariance",
        }

    marginal = cov.dot(w)
    portfolio_variance = float(w.dot(marginal))
    if not np.isfinite(portfolio_variance) or portfolio_variance <= 0:
        contributions = pd.Series(np.nan, index=assets, dtype=float)
    else:
        contributions = w * marginal / portfolio_variance

    finite = contributions.dropna()
    return {
        "by_asset": {
            name: float(value)
            for name, value in contributions.items()
        },
        "max_contribution": (
            float(finite.abs().max()) if not finite.empty else None
        ),
        "herfindahl": (
            float((finite ** 2).sum()) if not finite.empty else None
        ),
    }


# ---- 目标权重时间序列 ---------------------------------------------------

@dataclass
class WeightsResult:
    daily_weights: pd.DataFrame
    decision_dates: pd.DatetimeIndex
    scheduled_rebalance_dates: pd.DatetimeIndex
    quadrant_switch_dates: pd.DatetimeIndex
    used_quadrants: pd.Series

    @property
    def rebalance_dates(self) -> pd.DatetimeIndex:
        """Compatibility alias for target decision dates."""
        return self.decision_dates


def _scheduled_rebalance_dates(
        index: pd.DatetimeIndex,
        rebalance: str,
        *,
        observation_start: str | pd.Timestamp | None = None,
        observation_end: str | pd.Timestamp | None = None,
) -> pd.DatetimeIndex:
    """Return last common dates only for demonstrably complete periods.

    A later period proves the preceding period ended.  For the boundary
    periods, explicit observation bounds prove the requested data window
    covered the natural period; without bounds, only exact pandas business
    boundaries are inferred.  No calendar-day proximity tolerance is used.
    """
    if rebalance not in {"W", "M", "Q"}:
        raise ValueError("rebalance must be one of W, M, Q")
    if index.empty:
        return pd.DatetimeIndex([])

    calendar = pd.DatetimeIndex(index).sort_values().unique()
    period_index = calendar.to_period(rebalance)
    unique_periods = period_index.unique()
    explicit_start = (
        pd.Timestamp(observation_start).normalize()
        if observation_start is not None else None
    )
    explicit_end = (
        pd.Timestamp(observation_end).normalize()
        if observation_end is not None else None
    )
    confirmed: list[pd.Timestamp] = []

    for position, period in enumerate(unique_periods):
        dates_in_period = calendar[period_index == period]
        period_start = period.start_time.normalize()
        period_end = period.end_time.normalize()

        if position > 0:
            start_is_confirmed = True
        elif explicit_start is not None:
            start_is_confirmed = explicit_start <= period_start
        else:
            inferred_first_business_day = pd.offsets.BDay().rollforward(
                period_start
            )
            start_is_confirmed = dates_in_period[0] == inferred_first_business_day

        if position < len(unique_periods) - 1:
            end_is_confirmed = True
        elif explicit_end is not None:
            end_is_confirmed = explicit_end >= period_end
        else:
            inferred_last_business_day = pd.offsets.BDay().rollback(period_end)
            end_is_confirmed = dates_in_period[-1] == inferred_last_business_day

        if start_is_confirmed and end_is_confirmed:
            confirmed.append(dates_in_period[-1])

    return pd.DatetimeIndex(confirmed)


def build_weights(returns: pd.DataFrame,
                  quadrant_series: pd.Series,
                  rebalance: str = "Q",
                  vol_window: int = DEFAULT_VOL_WINDOW,
                  rebalance_on_regime_change: bool = False,
                  allocation: Optional[AllocationConfig] = None,
                  observation_start: str | pd.Timestamp | None = None,
                  observation_end: str | pd.Timestamp | None = None,
                  ) -> WeightsResult:
    """
    生成日度目标权重序列。

    默认只在计划期末形成新目标。象限切换会被记录，但只有显式打开
    ``rebalance_on_regime_change`` 才会在切换日形成额外目标。目标在下一
    交易日执行；实际持仓换手门槛由 backtest.run 处理。

    参数：
      rebalance:           'Q' 季末 / 'M' 月末 / 'W' 周末
      vol_window:          实现波动率窗口
      allocation:          AllocationConfig，None 时用默认 A 股配置
      observation_start:   查询窗口起点，用于确认首个期间是否完整
      observation_end:     查询窗口终点，用于确认最后期间是否完整
    """
    if vol_window <= 0:
        raise ValueError("vol_window must be positive")
    if returns.empty:
        return WeightsResult(pd.DataFrame(), pd.DatetimeIndex([]),
                             pd.DatetimeIndex([]), pd.DatetimeIndex([]),
                             pd.Series(dtype=object))
    if allocation is None:
        allocation = AllocationConfig()

    assets = returns.columns.tolist()
    base_full = allocation.base.reindex(assets).fillna(0.0)
    if base_full.sum() > 0:
        base_full = base_full / base_full.sum()

    vols = realized_vol(returns, window=vol_window)

    # 计划再平衡日：每期期末
    scheduled = _scheduled_rebalance_dates(
        returns.index,
        rebalance,
        observation_start=observation_start,
        observation_end=observation_end,
    )

    weights = pd.DataFrame(index=returns.index, columns=assets, dtype=float)
    quadrants_used: dict[pd.Timestamp, str] = {}
    executed_dates: list[pd.Timestamp] = []
    quadrant_switch: list[pd.Timestamp] = []

    current_w: Optional[pd.Series] = None
    last_quadrant: Optional[str] = None

    for t in returns.index:
        q_t = quadrant_series.get(t) if quadrant_series is not None else None
        q_t = q_t if isinstance(q_t, str) else None

        quadrant_changed = (q_t is not None and last_quadrant is not None
                            and q_t != last_quadrant)
        if quadrant_changed:
            quadrant_switch.append(t)

        candidate_rebalance = (
            t in scheduled
            or (
                current_w is not None
                and rebalance_on_regime_change
                and quadrant_changed
            )
        )

        if candidate_rebalance:
            tilt = allocation.tilts.get(q_t) if q_t is not None else None
            base = tilt.reindex(assets).fillna(0.0) if tilt is not None else base_full
            if base.sum() > 0:
                base = base / base.sum()
            # 用 t 日之前的波动率
            v_t = vols.shift(1).loc[t] if t in vols.index else vols.iloc[-1]
            proposed = inverse_volatility_weights(base, v_t)

            # These are decision dates.  The backtest applies the turnover
            # threshold to the actual drifting holdings on the next day.
            current_w = proposed
            executed_dates.append(t)
            quadrants_used[t] = q_t or "unknown"

        weights.loc[t] = current_w.values if current_w is not None else np.nan
        if q_t is not None:
            last_quadrant = q_t

    return WeightsResult(
        daily_weights=weights,
        decision_dates=pd.DatetimeIndex(executed_dates),
        scheduled_rebalance_dates=scheduled,
        quadrant_switch_dates=pd.DatetimeIndex(quadrant_switch),
        used_quadrants=pd.Series(quadrants_used, name="quadrant"),
    )
