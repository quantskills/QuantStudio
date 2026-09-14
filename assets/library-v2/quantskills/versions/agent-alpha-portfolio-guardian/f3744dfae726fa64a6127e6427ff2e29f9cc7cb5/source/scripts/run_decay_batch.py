# -*- coding: utf-8 -*-
"""批量获取 / 构造 DecayReport（桥接 skill-factor-decay）。"""
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


def _normalize_decay(raw: Dict[str, Any], factor_id: str, factor_name: str) -> Dict[str, Any]:
    ic_decay = raw.get("ic_decay") or {}
    horizons = ic_decay.get("horizons") or raw.get("horizons") or []
    ic_means = ic_decay.get("ic_means") or raw.get("ic_means") or []
    half = raw.get("half_life") or {}
    days = half.get("days", raw.get("half_life_days"))
    ci = half.get("ci_95") or raw.get("half_life_ci") or [None, None]
    if isinstance(ci, dict):
        ci = [ci.get("ci_lower"), ci.get("ci_upper")]
    rec = raw.get("recommendation") or {}
    points = []
    for h, ic in zip(horizons, ic_means):
        points.append(
            {
                "horizon": int(h),
                "ic_mean": float(ic) if ic is not None else None,
                "ic_sign": (1 if (ic or 0) >= 0 else -1) if ic is not None else 0,
            }
        )
    ic_by_h = {int(p["horizon"]): p["ic_mean"] for p in points if p["ic_mean"] is not None}

    # sign reversal heuristic
    sign_reversal = bool(raw.get("sign_reversal"))
    if not sign_reversal and 1 in ic_by_h and 20 in ic_by_h:
        a, b = ic_by_h[1], ic_by_h[20]
        if a is not None and b is not None and a * b < 0 and abs(a) > 0.005 and abs(b) > 0.005:
            sign_reversal = True

    platform = raw.get("platform_ic")
    if platform is None and ic_means:
        platform = ic_means[-1]

    return {
        "factor_id": factor_id,
        "factor_name": factor_name,
        "ok": days is not None or bool(points),
        "half_life": days,
        "half_life_ci_low": ci[0] if len(ci) > 0 else None,
        "half_life_ci_high": ci[1] if len(ci) > 1 else None,
        "recommended_rebalance": str(
            rec.get("rebalance_frequency_days") or raw.get("recommended_rebalance") or ""
        ),
        "quality": rec.get("quality"),
        "model": ic_decay.get("model") or raw.get("model") or "nonparametric",
        "points": points,
        "ic_by_horizon": ic_by_h,
        "sign_reversal": sign_reversal,
        "platform_ic": platform,
        "source": raw.get("source", "decay_report"),
        "raw": raw,
    }


def _mock_decay(factor_id: str, factor_name: str, horizons: List[int]) -> Dict[str, Any]:
    seed = sum(ord(c) for c in factor_id) % 97
    # F003/reversal → short half-life; F001 medium; F002 longer
    if "reversal" in factor_name or factor_id.endswith("3"):
        hl, ic0 = 1.5, -0.02
        sign_rev = True
    elif "lowvol" in factor_name or factor_id.endswith("2"):
        hl, ic0 = 12.0, 0.035
        sign_rev = False
    else:
        hl, ic0 = 6.0, 0.028
        sign_rev = False

    points = []
    ic_means = []
    for h in horizons:
        if sign_rev:
            # negative short, positive long
            ic = -0.02 * math.exp(-h / 3.0) + 0.015 * (1 - math.exp(-h / 15.0))
        else:
            ic = ic0 * math.exp(-h / (hl / math.log(2)))
        ic = round(ic, 5)
        ic_means.append(ic)
        points.append({"horizon": h, "ic_mean": ic, "ic_sign": 1 if ic >= 0 else -1})

    raw = {
        "factor_id": factor_id,
        "factor_name": factor_name,
        "ic_decay": {
            "horizons": horizons,
            "ic_means": ic_means,
            "model": "nonparametric" if sign_rev else "exponential",
        },
        "half_life": {
            "days": hl,
            "ci_95": [max(0.5, hl * 0.7), hl * 1.4],
            "method": "mock",
        },
        "recommendation": {
            "rebalance_frequency_days": 1 if hl < 2 else (5 if hl < 10 else 10),
            "quality": "poor" if hl < 2 else ("good" if hl >= 5 else "moderate"),
        },
        "sign_reversal": sign_rev,
        "platform_ic": ic_means[-1],
        "source": "mock",
    }
    return _normalize_decay(raw, factor_id, factor_name)


def decay_one(
    factor: Dict[str, Any], *, horizons: List[int], source_mode: str
) -> Dict[str, Any]:
    fid = factor["factor_id"]
    name = factor["name"]
    path = factor.get("decay_report_path")
    if path:
        raw = _load_json(Path(path))
        if raw:
            out = _normalize_decay(raw, fid, name)
            out["report_path"] = str(path)
            return out

    sig = factor.get("signal_path")
    if sig:
        side = Path(sig).with_name(Path(sig).stem + "_decay.json")
        raw = _load_json(side)
        if raw:
            out = _normalize_decay(raw, fid, name)
            out["report_path"] = str(side)
            return out

    if source_mode == "mock":
        out = _mock_decay(fid, name, horizons)
        out["report_path"] = None
        return out

    return {
        "factor_id": fid,
        "factor_name": name,
        "ok": False,
        "gap": "missing DecayReport; provide decay_report_path or run skill-factor-decay",
        "points": [],
        "source": "gap",
    }


def decay_batch(
    factors: List[Dict[str, Any]], *, horizons: List[int], source_mode: str
) -> List[Dict[str, Any]]:
    return [decay_one(f, horizons=horizons, source_mode=source_mode) for f in factors]


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Batch DecayReport bridge")
    parser.add_argument("--portfolio", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args(argv)

    from runtime.config_loader import load_portfolio

    cfg = load_portfolio(args.portfolio)
    reports = decay_batch(
        cfg["factors"],
        horizons=[int(x) for x in cfg["horizon_decay"]],
        source_mode=cfg["source_mode"],
    )
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(reports, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] wrote {len(reports)} decay reports → {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
