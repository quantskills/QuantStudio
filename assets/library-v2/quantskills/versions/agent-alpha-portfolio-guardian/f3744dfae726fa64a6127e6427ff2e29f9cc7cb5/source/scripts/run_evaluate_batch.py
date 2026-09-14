# -*- coding: utf-8 -*-
"""批量获取 / 构造 ScoreReport（桥接 skill-factor-evaluate）。

优先顺序：
1. 因子配置中的 score_report_path
2. 同目录旁路 JSON（{signal_stem}_score.json）
3. mock 模式：确定性合成报告（标注 source_mode=mock）
4. live 且无报告：返回缺口，不编造
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _load_json(path: Path) -> Optional[Dict[str, Any]]:
    if path and path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return None


def _normalize_score_report(raw: Dict[str, Any], factor_id: str, factor_name: str) -> Dict[str, Any]:
    primary = raw.get("primary_score", raw.get("score"))
    diagnostics = raw.get("diagnostics") or raw.get("metrics") or {}
    return {
        "factor_id": factor_id,
        "factor_name": factor_name,
        "primary_score": primary,
        "rank_ic": raw.get("rank_ic", diagnostics.get("rank_ic")),
        "pearson_ic": raw.get("pearson_ic", diagnostics.get("pearson_ic")),
        "ic_ir": raw.get("ic_ir", diagnostics.get("rank_ic_ir", diagnostics.get("ic_ir"))),
        "sharpe": raw.get("sharpe", diagnostics.get("sharpe")),
        "ann_return": raw.get("ann_return", diagnostics.get("annual_ret")),
        "mdd": raw.get("mdd", diagnostics.get("max_dd", diagnostics.get("mdd"))),
        "monotonicity": raw.get("monotonicity", diagnostics.get("monotonicity")),
        "turnover": raw.get("turnover", diagnostics.get("ann_turnover", diagnostics.get("turnover"))),
        "horizon": raw.get("horizon"),
        "period": raw.get("period"),
        "ok": primary is not None,
        "source": raw.get("source", "score_report"),
        "raw": raw,
    }


def _mock_score(factor_id: str, factor_name: str, horizon: int) -> Dict[str, Any]:
    # 确定性画像：覆盖 keep / watch / retire 三类样例
    name = factor_name.lower()
    if "lowvol" in name or factor_id.endswith("2"):
        primary, rank_ic, turnover = 0.55, 0.032, 0.28
        ic_ir, sharpe = 1.4, 0.9
    elif "reversal" in name or factor_id.endswith("3"):
        primary, rank_ic, turnover = 0.05, 0.008, 0.72
        ic_ir, sharpe = 0.4, 0.2
    else:
        primary, rank_ic, turnover = 0.25, 0.018, 0.45
        ic_ir, sharpe = 0.8, 0.5
    return _normalize_score_report(
        {
            "primary_score": primary,
            "rank_ic": rank_ic,
            "pearson_ic": round(rank_ic * 0.8, 4),
            "ic_ir": ic_ir,
            "sharpe": sharpe,
            "ann_return": round(max(primary, 0) * 0.2, 3),
            "mdd": -0.15,
            "monotonicity": 0.7 if primary > 0.2 else 0.35,
            "turnover": turnover,
            "horizon": horizon,
            "period": "mock",
            "source": "mock",
            "components": {
                "ic_term": round(primary * 0.2, 4),
                "note": "synthetic ScoreReport for guardian self-test",
            },
        },
        factor_id,
        factor_name,
    )


def evaluate_one(factor: Dict[str, Any], *, horizon: int, source_mode: str) -> Dict[str, Any]:
    fid = factor["factor_id"]
    name = factor["name"]
    path = factor.get("score_report_path")
    if path:
        raw = _load_json(Path(path))
        if raw:
            out = _normalize_score_report(raw, fid, name)
            out["report_path"] = str(path)
            return out

    sig = factor.get("signal_path")
    if sig:
        side = Path(sig).with_name(Path(sig).stem + "_score.json")
        raw = _load_json(side)
        if raw:
            out = _normalize_score_report(raw, fid, name)
            out["report_path"] = str(side)
            return out

    if source_mode == "mock":
        out = _mock_score(fid, name, horizon)
        out["report_path"] = None
        return out

    return {
        "factor_id": fid,
        "factor_name": name,
        "ok": False,
        "gap": "missing ScoreReport; provide score_report_path or run skill-factor-evaluate",
        "source": "gap",
    }


def evaluate_batch(factors: List[Dict[str, Any]], *, horizon: int, source_mode: str) -> List[Dict[str, Any]]:
    return [evaluate_one(f, horizon=horizon, source_mode=source_mode) for f in factors]


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Batch ScoreReport bridge")
    parser.add_argument("--portfolio", required=True)
    parser.add_argument("--output", required=True, help="JSON output path")
    args = parser.parse_args(argv)

    from runtime.config_loader import load_portfolio

    cfg = load_portfolio(args.portfolio)
    reports = evaluate_batch(
        cfg["factors"], horizon=int(cfg["horizon_eval"]), source_mode=cfg["source_mode"]
    )
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(reports, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] wrote {len(reports)} score reports → {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
