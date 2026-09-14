# -*- coding: utf-8 -*-
"""全链路编排：校验 → 扇出 → 聚合 → 写出 → 门禁。"""
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))


def run(
    portfolio: str | Path,
    *,
    output_dir: Optional[str | Path] = None,
    skip_validate: bool = False,
) -> Dict[str, Any]:
    from runtime.config_loader import load_portfolio
    from runtime.writers import write_report_pack
    from run_evaluate_batch import evaluate_batch
    from run_decay_batch import decay_batch
    from run_crowding_bridge import build_alerts
    from run_smart_money_sample import sample_consensus
    from aggregate_health import aggregate
    from validate_report import validate_run_dir

    from runtime.pandadata_gate import PandadataRedLineError, enforce_live_red_line
    from runtime.paths import portable_ref
    from runtime.trade_calendar import enforce_as_of_calendar

    cfg = load_portfolio(portfolio)
    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    if output_dir:
        run_dir = Path(output_dir)
        if not run_dir.is_absolute():
            run_dir = (ROOT / run_dir).resolve()
    else:
        run_dir = ROOT / "reports" / "runtime_out" / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    try:
        redline = enforce_live_red_line(cfg)
    except PandadataRedLineError as e:
        fail_dir = run_dir
        fail_dir.mkdir(parents=True, exist_ok=True)
        (fail_dir / "pandadata_redline.json").write_text(
            json.dumps(
                {"ok": False, "errors": [str(e)], "data_source": "Pandadata"},
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        raise SystemExit(f"data source check failed: {e}") from e

    cal = enforce_as_of_calendar(cfg)
    (run_dir / "trade_calendar.json").write_text(
        json.dumps(cal, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    if not cal.get("ok", False):
        raise SystemExit(
            "as_of trade calendar check failed: " + "; ".join(cal.get("errors") or [])
        )
    as_of = cfg["as_of"]

    (run_dir / "pandadata_redline.json").write_text(
        json.dumps(redline, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # 1-2 契约已在 load_portfolio；信号文件存在性检查
    gaps_pre = list(redline.get("warnings") or [])
    for w in cal.get("warnings") or []:
        if w not in gaps_pre:
            gaps_pre.append(w)
    if cfg["source_mode"] == "live":
        for fac in cfg["factors"]:
            sp = fac.get("signal_path")
            srp = fac.get("score_report_path")
            drp = fac.get("decay_report_path")
            if not srp and not drp and (not sp or not Path(sp).exists()):
                gaps_pre.append(
                    f"{fac['factor_id']}: live 缺少 signal/report，将标 insufficient"
                )

    # 3-4 扇出 evaluate / decay
    scores = evaluate_batch(
        cfg["factors"], horizon=int(cfg["horizon_eval"]), source_mode=cfg["source_mode"]
    )
    decays = decay_batch(
        cfg["factors"],
        horizons=[int(x) for x in cfg["horizon_decay"]],
        source_mode=cfg["source_mode"],
    )
    (run_dir / "deps").mkdir(exist_ok=True)
    (run_dir / "deps" / "score_reports.json").write_text(
        json.dumps(scores, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (run_dir / "deps" / "decay_reports.json").write_text(
        json.dumps(decays, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # 5-6 crowding + smart money
    fids = [f["factor_id"] for f in cfg["factors"]]
    crowding = build_alerts(cfg=cfg, factor_ids=fids, source_mode=cfg["source_mode"])
    smart = sample_consensus(cfg=cfg, source_mode=cfg["source_mode"])
    (run_dir / "deps" / "crowding.json").write_text(
        json.dumps(crowding, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (run_dir / "deps" / "smart_money.json").write_text(
        json.dumps(smart, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # 7 聚合
    agg = aggregate(
        cfg=cfg,
        score_reports=scores,
        decay_reports=decays,
        crowding_payload=crowding,
        smart_payload=smart,
    )
    for g in gaps_pre:
        if g not in agg["gaps"]:
            agg["gaps"].append(g)

    run_summary = {
        "run_id": run_dir.name,
        "portfolio": portable_ref(
            cfg.get("_config_arg") or cfg.get("_config_path")
        ),
        "as_of": agg["as_of"],
        "source_mode": agg["source_mode"],
        "data_source": cfg.get("data_source") or "Pandadata",
        "pandadata_redline": redline,
        "trade_calendar": cal,
        "data_version": agg["data_version"],
        "update_time": agg["update_time"],
        "rules_version": agg["rules_version"],
        "universe": cfg["universe"],
        "horizon_eval": cfg["horizon_eval"],
        "n_factors": len(cfg["factors"]),
        "gaps": agg["gaps"],
        "l1": agg["l1"],
    }

    # 先占位 validation，写出后再跑
    validation = {"ok": None, "pending": True}
    paths = write_report_pack(
        run_dir,
        matrix=agg["matrix"],
        candidates=agg["candidates"],
        alerts=agg["alerts"],
        curves=agg["curves"],
        l1=agg["l1"],
        gaps=agg["gaps"],
        run_summary=run_summary,
        validation=validation,
        rules_version=agg["rules_version"],
        data_version=agg["data_version"],
        source_mode=agg["source_mode"],
        as_of=agg["as_of"],
        deps_index={
            "score_reports": "deps/score_reports.json",
            "decay_reports": "deps/decay_reports.json",
            "crowding": "deps/crowding.json",
            "smart_money": "deps/smart_money.json",
            "skill_docs": [
                "skill-factor-evaluate/SKILL.md",
                "skill-factor-decay/SKILL.md",
                "agent-crowding-risk-monitor/AGENTS.md",
                "skill-smart-money-profiler/SKILL.md",
            ],
        },
    )

    if not skip_validate:
        validation = validate_run_dir(run_dir)
        (run_dir / "validation.json").write_text(
            json.dumps(validation, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    else:
        validation = {"ok": True, "skipped": True}

    # 历史面板库：仅 live/degraded 入账（失败不阻断主链路）
    panel_stats: Dict[str, Any]
    if cfg["source_mode"] in {"live", "degraded"}:
        try:
            from runtime.panel_store import append_from_run

            panel_stats = append_from_run(run_dir)
        except Exception as exc:  # noqa: BLE001
            panel_stats = {"ok": False, "error": str(exc)}
    else:
        panel_stats = {
            "ok": True,
            "skipped": True,
            "reason": "panel store only accepts live/degraded",
            "n_appended": 0,
        }
    (run_dir / "panel_store.json").write_text(
        json.dumps(panel_stats, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    return {
        "run_dir": str(run_dir),
        "paths": paths,
        "l1": agg["l1"],
        "validation": validation,
        "source_mode": agg["source_mode"],
        "data_version": agg["data_version"],
        "gaps": agg["gaps"],
        "panel_store": panel_stats,
    }
