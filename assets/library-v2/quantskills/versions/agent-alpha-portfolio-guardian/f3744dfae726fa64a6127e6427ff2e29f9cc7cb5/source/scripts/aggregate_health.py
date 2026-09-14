# -*- coding: utf-8 -*-
"""聚合 evaluate/decay/crowding/smart-money → 四件套中间态。"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from runtime import (
    DATA_VERSION_PREFIX_DEGRADED,
    DATA_VERSION_PREFIX_LIVE,
    DATA_VERSION_PREFIX_MOCK,
)
from runtime.rules import (
    FactorEvidence,
    build_candidate_row,
    build_matrix_row,
    decide_factor,
    l1_summary,
)


def _version(source_mode: str, rules_version: str) -> str:
    if source_mode == "mock":
        prefix = DATA_VERSION_PREFIX_MOCK
    elif source_mode == "degraded":
        prefix = DATA_VERSION_PREFIX_DEGRADED
    else:
        prefix = DATA_VERSION_PREFIX_LIVE
    return f"{prefix}+{rules_version}"


def _factor_crowding_level(fid: str, alerts: List[Dict[str, Any]]) -> str:
    levels = []
    order = {"info": 0, "easing": 1, "elevated": 2, "critical": 3}
    for a in alerts:
        linked = a.get("linked_factor_ids") or []
        if fid in linked or not linked:
            levels.append(a.get("level") or "info")
    if not levels:
        return "info"
    return max(levels, key=lambda x: order.get(x, 0))


def aggregate(
    *,
    cfg: Dict[str, Any],
    score_reports: List[Dict[str, Any]],
    decay_reports: List[Dict[str, Any]],
    crowding_payload: Dict[str, Any],
    smart_payload: Dict[str, Any],
) -> Dict[str, Any]:
    as_of = cfg["as_of"]
    source_mode = cfg["source_mode"]
    rules_version = cfg["rules_version"]
    thresholds = cfg["thresholds"]
    data_version = _version(source_mode, rules_version)
    update_time = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    score_by = {r["factor_id"]: r for r in score_reports}
    decay_by = {r["factor_id"]: r for r in decay_reports}
    alerts = list(crowding_payload.get("alerts") or [])
    fac_cons = smart_payload.get("factor_consensus") or {}

    matrix: List[Dict[str, Any]] = []
    candidates: List[Dict[str, Any]] = []
    curves: Dict[str, List[Dict[str, Any]]] = {}
    gaps: List[str] = []

    if crowding_payload.get("gap"):
        gaps.append(f"crowding: {crowding_payload['gap']}")
    if smart_payload.get("gap"):
        gaps.append(f"smart_money: {smart_payload['gap']}")

    # degraded 标记
    effective_mode = source_mode
    if source_mode == "live" and (crowding_payload.get("gap") or smart_payload.get("gap")):
        # 不强制改全局 mode；单行 gap_notes 体现
        pass

    for fac in cfg["factors"]:
        fid = fac["factor_id"]
        sc = score_by.get(fid) or {}
        dc = decay_by.get(fid) or {}
        gap_notes: List[str] = []
        refs: List[str] = []
        if sc.get("report_path"):
            refs.append(str(sc["report_path"]))
        if dc.get("report_path"):
            refs.append(str(dc["report_path"]))
        if crowding_payload.get("snapshot_path"):
            refs.append(str(crowding_payload["snapshot_path"]))

        if not sc.get("ok"):
            gap_notes.append(sc.get("gap") or "evaluate missing")
        if not dc.get("ok"):
            gap_notes.append(dc.get("gap") or "decay missing")

        ev = FactorEvidence(
            factor_id=fid,
            factor_name=fac["name"],
            primary_score=sc.get("primary_score"),
            rank_ic=sc.get("rank_ic"),
            pearson_ic=sc.get("pearson_ic"),
            ic_ir=sc.get("ic_ir"),
            turnover=sc.get("turnover"),
            monotonicity=sc.get("monotonicity"),
            mdd=sc.get("mdd"),
            half_life=dc.get("half_life"),
            half_life_ci_low=dc.get("half_life_ci_low"),
            half_life_ci_high=dc.get("half_life_ci_high"),
            recommended_rebalance=str(dc.get("recommended_rebalance") or "") or None,
            ic_by_horizon={int(k): float(v) for k, v in (dc.get("ic_by_horizon") or {}).items()},
            sign_reversal=bool(dc.get("sign_reversal")),
            platform_ic=dc.get("platform_ic"),
            decay_model=str(dc.get("model") or "nonparametric"),
            crowding_level=_factor_crowding_level(fid, alerts),
            capital_consensus=str(fac_cons.get(fid) or "no_data"),
            eval_ok=bool(sc.get("ok")),
            decay_ok=bool(dc.get("ok")),
            gap_notes=gap_notes,
            evidence_refs=refs,
        )
        decision = decide_factor(ev, thresholds)
        row = build_matrix_row(
            as_of,
            ev,
            decision,
            data_version=data_version,
            update_time=update_time,
            source_mode=effective_mode if (ev.eval_ok or ev.decay_ok) else (
                "degraded" if source_mode == "live" else source_mode
            ),
        )
        matrix.append(row)
        cand = build_candidate_row(as_of, ev, decision)
        if cand:
            candidates.append(cand)
        curves[fid] = list(dc.get("points") or [])
        for g in gap_notes:
            gaps.append(f"{fid}: {g}")

    # 若 live 全部失败 → 框架模式
    if source_mode == "live" and all(r["signal"] == "insufficient" for r in matrix):
        effective_mode = "degraded"
        for r in matrix:
            r["source_mode"] = "degraded"
        data_version = _version("degraded", rules_version)

    l1 = l1_summary(matrix, as_of, effective_mode)
    return {
        "as_of": as_of,
        "source_mode": effective_mode,
        "data_version": data_version,
        "update_time": update_time,
        "rules_version": rules_version,
        "l1": l1,
        "matrix": matrix,
        "candidates": candidates,
        "alerts": alerts,
        "curves": curves,
        "gaps": sorted(set(gaps)),
    }


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--portfolio", required=True)
    parser.add_argument("--scores", required=True)
    parser.add_argument("--decays", required=True)
    parser.add_argument("--crowding", required=True)
    parser.add_argument("--smart-money", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args(argv)

    from runtime.config_loader import load_portfolio

    cfg = load_portfolio(args.portfolio)
    payload = aggregate(
        cfg=cfg,
        score_reports=json.loads(Path(args.scores).read_text(encoding="utf-8")),
        decay_reports=json.loads(Path(args.decays).read_text(encoding="utf-8")),
        crowding_payload=json.loads(Path(args.crowding).read_text(encoding="utf-8")),
        smart_payload=json.loads(Path(args.smart_money).read_text(encoding="utf-8")),
    )
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] aggregate → {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
