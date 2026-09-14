# -*- coding: utf-8 -*-
"""桥接 agent-crowding-risk-monitor 产物 → 组合层拥挤警示。"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _find_default_snapshot() -> Optional[Path]:
    env = os.environ.get("CROWDING_RISK_MONITOR_ROOT")
    candidates = []
    if env:
        candidates.append(Path(env) / "outputs" / "live" / "agent_snapshot.json")
    candidates.append(
        ROOT.parent / "agent-crowding-risk-monitor" / "outputs" / "live" / "agent_snapshot.json"
    )
    for p in candidates:
        if p.exists():
            return p
    return None


def _load_json(path: Optional[Path]) -> Optional[Dict[str, Any]]:
    if path and path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return None


def build_alerts(
    *,
    cfg: Dict[str, Any],
    factor_ids: List[str],
    source_mode: str,
) -> Dict[str, Any]:
    from runtime.config_loader import collect_exposure_symbols
    from runtime.rules import map_crowding_scenario

    crowding_cfg = cfg.get("crowding") or {}
    if not crowding_cfg.get("enabled", True):
        return {"ok": True, "alerts": [], "gap": None, "snapshot_path": None}

    exposures = collect_exposure_symbols(cfg) or ["portfolio"]
    snap_path = crowding_cfg.get("snapshot_path")

    # mock：仅当显式指定 snapshot_path 时读真实快照，否则用合成警示
    if source_mode == "mock" and not snap_path:
        theme = next((e for e in exposures if "." in e), exposures[0])
        # 默认 info，避免样例全员被拥挤旁证盖成 watch；显式 snapshot 可测 elevated/critical
        alerts = [
            {
                "theme_or_symbol": theme,
                "level": "info",
                "scenario": "延续（mock）",
                "linked_factor_ids": list(factor_ids),
                "source_snapshot": None,
                "counter_evidence_note": "mock 旁证：未绑定真实 crowding 快照",
                "risk_level": "低",
            }
        ]
        return {
            "ok": True,
            "alerts": alerts,
            "gap": None,
            "snapshot_path": None,
            "source": "mock",
        }

    path = Path(snap_path) if snap_path else _find_default_snapshot()
    if path and not path.is_absolute():
        path = (ROOT / path).resolve()

    snap = _load_json(path)

    if snap is None:
        return {
            "ok": False,
            "alerts": [
                {
                    "theme_or_symbol": "portfolio",
                    "level": "info",
                    "scenario": "证据不足",
                    "linked_factor_ids": list(factor_ids),
                    "source_snapshot": None,
                    "counter_evidence_note": "未找到 crowding agent_snapshot.json",
                    "risk_level": "",
                }
            ],
            "gap": "crowding snapshot missing",
            "snapshot_path": str(path) if path else None,
            "source": "gap",
        }

    risk_level = str(snap.get("risk_level") or "")
    state = str(snap.get("state") or snap.get("scorecard", {}).get("state") or "")
    level = map_crowding_scenario(state, risk_level)
    scenario = state or risk_level or "延续"
    symbol = (
        (snap.get("scorecard") or {}).get("symbol")
        or (exposures[0] if exposures else "market")
    )
    linked = list(factor_ids)
    alerts = [
        {
            "theme_or_symbol": symbol,
            "level": level,
            "scenario": scenario,
            "linked_factor_ids": linked,
            "source_snapshot": str(path),
            "counter_evidence_note": "详见 crowding counter_evidence / decision_matrix",
            "risk_level": risk_level,
            "scorecard": snap.get("scorecard"),
        }
    ]
    # 额外挂载 exposure（去重，跳过已作为主 symbol 的项）
    seen = {str(symbol)}
    for theme in exposures:
        if str(theme) in seen:
            continue
        seen.add(str(theme))
        alerts.append(
            {
                "theme_or_symbol": theme,
                "level": level,
                "scenario": f"继承组合拥挤情景: {scenario}",
                "linked_factor_ids": linked,
                "source_snapshot": str(path),
                "counter_evidence_note": "主题级细分需 crowding 专项重跑",
                "risk_level": risk_level,
            }
        )
    return {"ok": True, "alerts": alerts, "gap": None, "snapshot_path": str(path), "source": "crowding"}


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--portfolio", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args(argv)

    from runtime.config_loader import load_portfolio

    cfg = load_portfolio(args.portfolio)
    fids = [f["factor_id"] for f in cfg["factors"]]
    payload = build_alerts(cfg=cfg, factor_ids=fids, source_mode=cfg["source_mode"])
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] crowding alerts → {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
