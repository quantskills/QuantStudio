"""Growth × inflation regime classification.

Defaults are fully explicit and recorded in every research artifact:
63 trading-day macro changes, 60 trading-day majority smoothing, and
20 trading-day hysteresis.  CPI and GDP observations have already received
their separate publication-lag approximations in ``data_layer``.  The
diagnostics frame retains raw changes, smoothed states, hysteresis states, and
the final quadrant.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np
import pandas as pd


Quadrant = Literal["Q1_growUp_infUp",     # 增长↑ 通胀↑
                   "Q2_growUp_infDn",     # 增长↑ 通胀↓
                   "Q3_growDn_infUp",     # 增长↓ 通胀↑（滞胀）
                   "Q4_growDn_infDn"]     # 增长↓ 通胀↓


QUADRANT_LABELS = {
    "Q1_growUp_infUp": "增长↑通胀↑（过热）",
    "Q2_growUp_infDn": "增长↑通胀↓（复苏）",
    "Q3_growDn_infUp": "增长↓通胀↑（滞胀）",
    "Q4_growDn_infDn": "增长↓通胀↓（衰退）",
}

DEFAULT_LONG_CHANGE_DAYS = 63
DEFAULT_SMOOTH_WINDOW = 60
DEFAULT_MIN_HOLD_DAYS = 20


@dataclass
class RegimeResult:
    quadrant: pd.Series          # 每个交易日的象限标签
    growth_up: pd.Series         # bool
    inflation_up: pd.Series      # bool
    diagnostics: pd.DataFrame    # 含 cpi_yoy, gdp_yoy, cpi_diff, gdp_diff


def _majority_vote(raw: pd.Series, window: int) -> pd.Series:
    """
    过去 window 天中 True 的比例 >0.5 判为 True。
    返回 boolean series，起始不足窗口的位置为 NaN。
    """
    x = raw.astype("float")  # True→1, False→0, NaN 保持
    mean = x.rolling(window=window, min_periods=max(3, window // 3)).mean()
    return (mean > 0.5).astype("boolean").where(mean.notna())


def _hysteresis(sig: pd.Series, min_hold: int) -> pd.Series:
    """
    磁滞过滤：新方向必须与当前不同并**已经**保持了 min_hold 天，才真正切换。
    实现：从头扫，维护 current；只有 sig 与 current 不同且过去 min_hold 天
    全都是 sig 的新值时才切。
    """
    out = pd.Series(index=sig.index, dtype="boolean")
    current: bool | None = None
    for i, t in enumerate(sig.index):
        v = sig.iloc[i]
        if pd.isna(v):
            out.iloc[i] = current if current is not None else pd.NA
            continue
        v = bool(v)
        if current is None:
            current = v
        elif v != current:
            lo = max(0, i - min_hold + 1)
            window_vals = sig.iloc[lo:i + 1]
            if window_vals.notna().all() and (window_vals.astype(bool) == v).all():
                current = v
        out.iloc[i] = current
    return out


def classify(macro_daily: pd.DataFrame,
              cpi_col: str = "cpi_yoy",
              gdp_col: str = "gdp_yoy",
              long_change_days: int = DEFAULT_LONG_CHANGE_DAYS,
              smooth_window: int = DEFAULT_SMOOTH_WINDOW,
              min_hold_days: int = DEFAULT_MIN_HOLD_DAYS) -> RegimeResult:
    """
    输入: align_macro_to_daily 输出的 DataFrame（交易日 index，含 cpi_yoy/gdp_yoy）
    输出: RegimeResult

    参数（v2 抗噪声）：
      long_change_days: 计算长期变化用的回看天数，默认 63 交易日（≈3M）
      smooth_window:    多数投票窗口
      min_hold_days:    磁滞——新方向必须持续多少天才切换
    """
    for name, value in (
        ("long_change_days", long_change_days),
        ("smooth_window", smooth_window),
        ("min_hold_days", min_hold_days),
    ):
        if value <= 0:
            raise ValueError(f"{name} must be positive")

    df = macro_daily.copy()
    for col in (cpi_col, gdp_col):
        if col not in df.columns:
            df[col] = np.nan

    # 1) 长期变化 — 抗单月公布抖动
    cpi_change = df[cpi_col] - df[cpi_col].shift(long_change_days)
    gdp_change = df[gdp_col] - df[gdp_col].shift(long_change_days)

    # 2) 原始方向信号
    raw_inflation_up = (cpi_change >= 0).astype("boolean").where(cpi_change.notna())
    raw_growth_up = (gdp_change >= 0).astype("boolean").where(gdp_change.notna())

    # 3) 多数投票平滑
    smooth_inflation = _majority_vote(raw_inflation_up, smooth_window)
    smooth_growth = _majority_vote(raw_growth_up, smooth_window)

    # 4) 磁滞
    inflation_up = _hysteresis(smooth_inflation, min_hold_days)
    growth_up = _hysteresis(smooth_growth, min_hold_days)

    def _lab(g_up: bool, i_up: bool) -> Quadrant:
        if g_up and i_up:
            return "Q1_growUp_infUp"
        if g_up and not i_up:
            return "Q2_growUp_infDn"
        if (not g_up) and i_up:
            return "Q3_growDn_infUp"
        return "Q4_growDn_infDn"

    labels = []
    for g, i in zip(growth_up.tolist(), inflation_up.tolist()):
        if pd.isna(g) or pd.isna(i):
            labels.append(np.nan)
        else:
            labels.append(_lab(bool(g), bool(i)))
    quadrant = pd.Series(labels, index=df.index, name="quadrant")

    diagnostics = pd.DataFrame({
        cpi_col: df[cpi_col],
        gdp_col: df[gdp_col],
        "cpi_long_change": cpi_change,
        "gdp_long_change": gdp_change,
        "raw_inflation_up": raw_inflation_up,
        "raw_growth_up": raw_growth_up,
        "smooth_inflation_up": smooth_inflation,
        "smooth_growth_up": smooth_growth,
        "inflation_up": inflation_up,
        "growth_up": growth_up,
        "quadrant": quadrant,
    })
    return RegimeResult(quadrant=quadrant,
                         growth_up=growth_up,
                         inflation_up=inflation_up,
                         diagnostics=diagnostics)


def current_quadrant(regime: RegimeResult) -> tuple[str, str]:
    """返回最新的 (象限 key, 中文说明)。"""
    q = regime.quadrant.dropna()
    if q.empty:
        return "unknown", "宏观数据不足以判定"
    key = q.iloc[-1]
    return key, QUADRANT_LABELS.get(key, key)
