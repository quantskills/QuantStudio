# -*- coding: utf-8 -*-
"""加载并校验 portfolio.yaml。"""
from __future__ import annotations

from copy import deepcopy
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml

ROOT = Path(__file__).resolve().parent.parent

DEFAULT_THRESHOLDS = {
    "half_life_healthy": 5.0,
    "half_life_fragile": 2.0,
    "primary_score_retire": -0.5,
    "ic_noise_abs": 0.005,
    "high_turnover": 0.6,
}


def _resolve(path: Optional[str], base: Path) -> Optional[Path]:
    if not path:
        return None
    p = Path(path)
    if not p.is_absolute():
        p = (base / p).resolve()
    return p


def load_portfolio(path: str | Path) -> Dict[str, Any]:
    # 保留调用方原始入参（相对路径可直接写入可移植摘要）
    config_arg = str(path)
    cfg_path = Path(path)
    if not cfg_path.is_absolute():
        cfg_path = (ROOT / cfg_path).resolve()
    if not cfg_path.exists():
        raise FileNotFoundError(f"portfolio config not found: {cfg_path}")

    with cfg_path.open("r", encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}

    cfg = deepcopy(raw)
    cfg["_config_arg"] = config_arg
    cfg["_config_path"] = str(cfg_path)
    cfg["_config_dir"] = str(cfg_path.parent)

    cfg.setdefault("universe", "000300.SH")
    cfg.setdefault("horizon_eval", 5)
    cfg.setdefault("horizon_decay", [1, 3, 5, 10, 20])
    cfg.setdefault("source_mode", "live")
    cfg.setdefault("data_source", "Pandadata")
    cfg.setdefault("rules_version", "guardian-rules-v0.1")
    cfg.setdefault("factors", [])
    cfg.setdefault("crowding", {"enabled": True})
    cfg.setdefault("smart_money", {"enabled": True, "mode": "consensus", "top_n_symbols": 10})

    from runtime.pandadata_gate import is_pandadata_source

    ds = cfg.get("data_source")
    if cfg.get("source_mode") == "live" and ds and not is_pandadata_source(ds):
        raise ValueError(f"unsupported data_source={ds!r}")
    th = dict(DEFAULT_THRESHOLDS)
    th.update(cfg.get("thresholds") or {})
    cfg["thresholds"] = th

    if not cfg.get("as_of"):
        cfg["as_of"] = date.today().isoformat()

    mode = str(cfg["source_mode"]).lower()
    if mode not in {"live", "mock", "degraded"}:
        raise ValueError(f"invalid source_mode: {mode}")
    cfg["source_mode"] = mode

    factors: List[Dict[str, Any]] = []
    for i, fac in enumerate(cfg["factors"]):
        if not isinstance(fac, dict):
            raise ValueError(f"factors[{i}] must be a mapping")
        fid = fac.get("factor_id") or f"F{i+1:03d}"
        item = {
            "factor_id": str(fid),
            "name": str(fac.get("name") or fid),
            "signal_path": _resolve(fac.get("signal_path"), ROOT),
            "score_report_path": _resolve(fac.get("score_report_path"), ROOT),
            "decay_report_path": _resolve(fac.get("decay_report_path"), ROOT),
            "exposure_symbols": list(fac.get("exposure_symbols") or []),
        }
        factors.append(item)
    if not factors:
        raise ValueError("portfolio.factors must be non-empty")
    cfg["factors"] = factors

    # 强制同一评估口径
    ids = [f["factor_id"] for f in factors]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate factor_id in portfolio")

    return cfg


def collect_exposure_symbols(cfg: Dict[str, Any]) -> List[str]:
    seen = set()
    out: List[str] = []
    for theme in (cfg.get("crowding") or {}).get("themes") or []:
        if theme and theme not in seen:
            seen.add(theme)
            out.append(str(theme))
    for fac in cfg["factors"]:
        for sym in fac.get("exposure_symbols") or []:
            if sym and sym not in seen:
                seen.add(sym)
                out.append(str(sym))
    return out
