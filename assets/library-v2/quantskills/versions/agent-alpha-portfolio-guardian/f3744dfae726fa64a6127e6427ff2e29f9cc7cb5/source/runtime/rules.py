# -*- coding: utf-8 -*-
"""退休 / 重构 / 健康度规则引擎（聚合层唯一写决策）。"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional, Sequence, Tuple

SIGNAL_COARSE = {
    "keep": "neutral",
    "watch": "watch",
    "deweight": "avoid",
    "retire_candidate": "avoid",
    "rebuild_candidate": "avoid",
    "insufficient": "watch",
}

REASON_HELP = {
    "HALF_LIFE_LT_2": "IC 半衰期 < 2 日，信号保质期过短",
    "HALF_LIFE_2_5": "IC 半衰期处于 2–5 日观察带",
    "IC_FLAT_NOISE": "多期限 IC 接近噪声平台",
    "PRIMARY_SCORE_LOW": "主分低于退休阈值",
    "SIGN_REVERSAL": "IC 方向反转，期限口径可能错配",
    "HIGH_TO_FAST_DECAY": "高换手叠加快速衰减（伪 Alpha 特征）",
    "CROWDING_ELEVATED": "关联暴露拥挤度升高，需提高风险警惕",
    "CROWDING_CRITICAL": "关联暴露拥挤度关键，建议研究降权",
    "CAPITAL_DIVERGENT": "聪明钱多源资金分歧（旁证）",
    "PLATFORM_IC_POSITIVE": "存在正平台 IC，定义或期限或许可重构",
    "EVAL_GAP": "factor-evaluate 证据缺口",
    "DECAY_GAP": "factor-decay 证据缺口",
    "SAMPLE_INSUFFICIENT": "样本或依赖不足",
}


@dataclass
class FactorEvidence:
    factor_id: str
    factor_name: str
    primary_score: Optional[float] = None
    rank_ic: Optional[float] = None
    pearson_ic: Optional[float] = None
    ic_ir: Optional[float] = None
    turnover: Optional[float] = None
    monotonicity: Optional[float] = None
    mdd: Optional[float] = None
    half_life: Optional[float] = None
    half_life_ci_low: Optional[float] = None
    half_life_ci_high: Optional[float] = None
    recommended_rebalance: Optional[str] = None
    ic_by_horizon: Dict[int, float] = field(default_factory=dict)
    sign_reversal: bool = False
    platform_ic: Optional[float] = None
    decay_model: str = "nonparametric"
    crowding_level: str = "info"  # info|elevated|critical|easing
    capital_consensus: str = "no_data"  # aligned|divergent|no_data
    eval_ok: bool = False
    decay_ok: bool = False
    gap_notes: List[str] = field(default_factory=list)
    evidence_refs: List[str] = field(default_factory=list)


@dataclass
class Decision:
    health_status: str
    signal: str
    reasons: List[str] = field(default_factory=list)
    confidence: float = 0.5
    suggested_next_step: str = ""


def _finite(x: Optional[float]) -> bool:
    return x is not None and x == x and abs(x) != float("inf")


def _ic_noise(ev: FactorEvidence, abs_thr: float) -> bool:
    if not ev.ic_by_horizon:
        if _finite(ev.rank_ic) and abs(float(ev.rank_ic)) < abs_thr:
            return True
        return False
    vals = [abs(v) for v in ev.ic_by_horizon.values() if v == v]
    return bool(vals) and all(v < abs_thr for v in vals)


def decide_factor(ev: FactorEvidence, thresholds: Dict[str, Any]) -> Decision:
    hl_healthy = float(thresholds.get("half_life_healthy", 5.0))
    hl_fragile = float(thresholds.get("half_life_fragile", 2.0))
    score_retire = float(thresholds.get("primary_score_retire", -0.5))
    ic_noise_abs = float(thresholds.get("ic_noise_abs", 0.005))
    high_to = float(thresholds.get("high_turnover", 0.6))

    reasons: List[str] = []

    if not ev.eval_ok and not ev.decay_ok:
        reasons.extend(["SAMPLE_INSUFFICIENT", "EVAL_GAP", "DECAY_GAP"])
        return Decision(
            health_status="insufficient",
            signal="insufficient",
            reasons=reasons,
            confidence=0.2,
            suggested_next_step="证据不足：请补齐 evaluate/decay 输入后重跑，禁止据缺口编造结论。",
        )

    if not ev.eval_ok:
        reasons.append("EVAL_GAP")
    if not ev.decay_ok:
        reasons.append("DECAY_GAP")

    # 噪声失效 → 退休
    if ev.eval_ok and _ic_noise(ev, ic_noise_abs):
        reasons.append("IC_FLAT_NOISE")
        if _finite(ev.primary_score) and float(ev.primary_score) <= score_retire:
            reasons.append("PRIMARY_SCORE_LOW")
        return Decision(
            health_status="retire_candidate",
            signal="retire_candidate",
            reasons=reasons,
            confidence=0.75 if ev.decay_ok else 0.55,
            suggested_next_step="多窗 IC 接近噪声，建议研究移出候选池并保留复盘记录。",
        )

    if _finite(ev.primary_score) and float(ev.primary_score) <= score_retire:
        reasons.append("PRIMARY_SCORE_LOW")
        if _finite(ev.platform_ic) and float(ev.platform_ic) > ic_noise_abs:
            reasons.append("PLATFORM_IC_POSITIVE")
            return Decision(
                health_status="rebuild_candidate",
                signal="rebuild_candidate",
                reasons=reasons,
                confidence=0.65,
                suggested_next_step="主分偏弱但仍有平台 IC，建议研究调整定义/期限后再评估。",
            )
        return Decision(
            health_status="retire_candidate",
            signal="retire_candidate",
            reasons=reasons,
            confidence=0.7,
            suggested_next_step="主分持续偏低，建议研究移出候选池。",
        )

    # 符号反转 → 重构
    if ev.sign_reversal:
        reasons.append("SIGN_REVERSAL")
        return Decision(
            health_status="rebuild_candidate",
            signal="rebuild_candidate",
            reasons=reasons,
            confidence=0.7,
            suggested_next_step="IC 方向反转，建议研究调整持有期或再平衡频率后重评。",
        )

    fragile = False
    if _finite(ev.half_life) and float(ev.half_life) < hl_fragile:
        reasons.append("HALF_LIFE_LT_2")
        fragile = True
    if (
        _finite(ev.half_life)
        and float(ev.half_life) < hl_fragile
        and _finite(ev.turnover)
        and float(ev.turnover) >= high_to
    ):
        reasons.append("HIGH_TO_FAST_DECAY")
        return Decision(
            health_status="retire_candidate",
            signal="retire_candidate",
            reasons=reasons,
            confidence=0.8,
            suggested_next_step="高换手+极短半衰期，疑似伪 Alpha，建议研究移出候选池。",
        )

    if fragile or (
        _finite(ev.half_life) and hl_fragile <= float(ev.half_life) < hl_healthy
    ):
        if not fragile and _finite(ev.half_life):
            reasons.append("HALF_LIFE_2_5")

        status = "fragile" if fragile else "watch"
        signal = "deweight" if fragile else "watch"

        # 旁证升级
        if ev.crowding_level == "critical":
            reasons.append("CROWDING_CRITICAL")
        elif ev.crowding_level == "elevated":
            reasons.append("CROWDING_ELEVATED")
        if ev.capital_consensus == "divergent":
            reasons.append("CAPITAL_DIVERGENT")

        if fragile and ev.capital_consensus == "divergent" and ev.crowding_level in {
            "elevated",
            "critical",
        }:
            return Decision(
                health_status="retire_candidate",
                signal="retire_candidate",
                reasons=reasons,
                confidence=0.78,
                suggested_next_step="脆弱信号叠加拥挤与资金分歧旁证，建议研究降权并评估移出候选池。",
            )

        if fragile:
            return Decision(
                health_status=status,
                signal=signal,
                reasons=reasons,
                confidence=0.68,
                suggested_next_step="信号偏脆弱，建议研究降权并缩短监控周期。",
            )
        return Decision(
            health_status=status,
            signal=signal,
            reasons=reasons,
            confidence=0.6,
            suggested_next_step="进入观察带，建议持续监控半衰期与主分变化。",
        )

    # healthy 主干
    if ev.crowding_level == "critical":
        reasons.append("CROWDING_CRITICAL")
        return Decision(
            health_status="watch",
            signal="deweight",
            reasons=reasons,
            confidence=0.62,
            suggested_next_step="因子本身尚可，但关联暴露拥挤关键，建议研究降权并提高风险警惕。",
        )
    if ev.crowding_level == "elevated":
        reasons.append("CROWDING_ELEVATED")
        return Decision(
            health_status="watch",
            signal="watch",
            reasons=reasons,
            confidence=0.58,
            suggested_next_step="关联暴露拥挤度升高，建议纳入观察清单。",
        )
    if ev.capital_consensus == "divergent":
        reasons.append("CAPITAL_DIVERGENT")
        return Decision(
            health_status="watch",
            signal="watch",
            reasons=reasons,
            confidence=0.55,
            suggested_next_step="聪明钱资金分歧为旁证，建议关注但不据此单独下结论。",
        )

    return Decision(
        health_status="healthy",
        signal="keep",
        reasons=reasons or ["OK"],
        confidence=0.72 if ev.eval_ok and ev.decay_ok else 0.5,
        suggested_next_step="当前证据支持保留观察；非投资建议。",
    )


def build_matrix_row(
    as_of: str,
    ev: FactorEvidence,
    decision: Decision,
    *,
    data_version: str,
    update_time: str,
    source_mode: str,
) -> Dict[str, Any]:
    gaps = list(ev.gap_notes)
    if decision.signal == "insufficient" and not gaps:
        gaps.append("依赖缺口或样本不足")
    return {
        "as_of_date": as_of,
        "factor_id": ev.factor_id,
        "factor_name": ev.factor_name,
        "primary_score": ev.primary_score,
        "rank_ic": ev.rank_ic,
        "pearson_ic": ev.pearson_ic,
        "ic_ir": ev.ic_ir,
        "half_life": ev.half_life,
        "half_life_ci_low": ev.half_life_ci_low,
        "half_life_ci_high": ev.half_life_ci_high,
        "recommended_rebalance": ev.recommended_rebalance,
        "crowding_level": ev.crowding_level,
        "capital_consensus": ev.capital_consensus,
        "health_status": decision.health_status,
        "signal": decision.signal,
        "signal_coarse": SIGNAL_COARSE.get(decision.signal, "watch"),
        "confidence": decision.confidence,
        "gap_notes": "; ".join(gaps),
        "reasons": "|".join(decision.reasons),
        "data_version": data_version,
        "update_time": update_time,
        "source_mode": source_mode,
    }


def build_candidate_row(
    as_of: str,
    ev: FactorEvidence,
    decision: Decision,
) -> Optional[Dict[str, Any]]:
    if decision.signal not in {"deweight", "retire_candidate", "rebuild_candidate"}:
        return None
    return {
        "as_of_date": as_of,
        "factor_id": ev.factor_id,
        "factor_name": ev.factor_name,
        "action": decision.signal,
        "reasons": "|".join(decision.reasons),
        "reason_text": "; ".join(REASON_HELP.get(r, r) for r in decision.reasons if r != "OK"),
        "evidence_refs": "|".join(ev.evidence_refs),
        "suggested_next_step": decision.suggested_next_step,
        "alpha_research_ticket": (
            f"建议调研是否重建/晋升 alpha 定义: {ev.factor_id}"
            if decision.signal == "rebuild_candidate"
            else ""
        ),
    }


def map_crowding_scenario(scenario: str, risk_level: str = "") -> str:
    s = (scenario or "").lower()
    r = risk_level or ""
    if "升级" in r or "高" in r or "critical" in s or "升级" in s:
        if "高关注" in r or "critical" in s or "同步" in s:
            return "critical" if ("高" in r or "critical" in s) else "elevated"
        return "elevated"
    if "降级" in s or "easing" in s or "缓解" in s:
        return "easing"
    if "不足" in s or "insufficient" in s:
        return "info"
    if "crowding-watch" in s or "升级" in scenario:
        return "elevated"
    # risk_level heuristics from crowding snapshot
    if "高" in r:
        return "critical"
    if "关注" in r or "中" in r:
        return "elevated"
    return "info"


def l1_summary(rows: Sequence[Dict[str, Any]], as_of: str, source_mode: str) -> str:
    n = len(rows)
    counts: Dict[str, int] = {}
    for r in rows:
        counts[r["signal"]] = counts.get(r["signal"], 0) + 1
    parts = [f"{k}={v}" for k, v in sorted(counts.items())]
    return (
        f"截至 {as_of}（source_mode={source_mode}），组合 {n} 个因子健康度守卫完成："
        + "，".join(parts)
        + "。结论仅供研究参考。"
    )
