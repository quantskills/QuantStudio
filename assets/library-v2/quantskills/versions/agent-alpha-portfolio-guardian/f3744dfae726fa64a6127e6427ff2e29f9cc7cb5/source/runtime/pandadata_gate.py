# -*- coding: utf-8 -*-
"""数据来源校验：正式输入须溯源到 Pandadata（可经依赖 Skill 产物或缓存）。"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

ALLOWED_SOURCE_TOKENS = (
    "pandadata",
    "panda_data",
    "pandaai",
    "panda ai",
)

ALLOWED_VIA_SKILLS = (
    "skill-factor-evaluate",
    "factor-evaluate",
    "skill-factor-decay",
    "factor-decay",
    "agent-crowding-risk-monitor",
    "crowding-risk-monitor",
    "skill-smart-money-profiler",
    "smart-money-profiler",
)

FORBIDDEN_SOURCE_HINTS = (
    "yahoo",
    "tushare",
    "akshare",
    "eastmoney",
    "wind",
    "bloomberg",
    "joinquant",
    "ricequant",
    "baostock",
    "csv_import",
    "excel",
    "manual",
    "unknown",
)

ALLOWED_DELIVERY = (
    "api",
    "cache",
    "snapshot",
    "offline_cache",
    "via_skill",
    "skill",
    "",
)


class PandadataRedLineError(RuntimeError):
    pass


def _env_cred() -> Tuple[Optional[str], Optional[str]]:
    user = os.environ.get("PANDA_DATA_USERNAME") or os.environ.get("PANDADATA_USERNAME")
    pwd = os.environ.get("PANDA_DATA_PASSWORD") or os.environ.get("PANDADATA_PASSWORD")
    if user and str(user).startswith("YOUR_"):
        user = None
    if pwd and str(pwd).startswith("YOUR_"):
        pwd = None
    return user, pwd


def has_pandadata_credentials() -> bool:
    u, p = _env_cred()
    return bool(u and p)


def normalize_source(value: Any) -> str:
    return str(value or "").strip().lower()


def is_pandadata_source(value: Any) -> bool:
    s = normalize_source(value)
    if not s:
        return False
    if any(bad in s for bad in FORBIDDEN_SOURCE_HINTS):
        return False
    return any(tok in s for tok in ALLOWED_SOURCE_TOKENS)


def read_provenance(path: Optional[Path]) -> Dict[str, Any]:
    if not path:
        return {}
    p = Path(path)
    if not p.exists():
        return {}
    side = p.parent / f"{p.name}.provenance.json"
    if side.exists():
        try:
            return json.loads(side.read_text(encoding="utf-8"))
        except Exception:
            return {"_error": f"invalid provenance file: {side}"}
    if p.suffix.lower() == ".json":
        try:
            obj = json.loads(p.read_text(encoding="utf-8"))
            if isinstance(obj, dict):
                return {
                    "data_source": obj.get("data_source") or obj.get("source"),
                    "delivery": obj.get("delivery") or obj.get("fetch_mode"),
                    "via_skill": obj.get("via_skill") or obj.get("provider_skill"),
                    "data_asof": obj.get("data_asof") or obj.get("as_of_date"),
                    "method": obj.get("method"),
                    "embedded": True,
                }
        except Exception:
            return {}
    return {}


def check_artifact_provenance(path: Optional[Path], *, label: str) -> Tuple[List[str], bool]:
    if not path:
        return [], False
    p = Path(path)
    if not p.exists():
        return [], False
    prov = read_provenance(p)
    if prov.get("_error"):
        return [f"{label}: {prov['_error']}"], False
    src = prov.get("data_source") or prov.get("source")
    if not src:
        return [f"{label}: missing data_source → {p}"], False
    if not is_pandadata_source(src):
        return [f"{label}: unsupported data_source={src!r} → {p}"], False
    delivery = normalize_source(prov.get("delivery") or prov.get("fetch_mode") or "cache")
    if delivery and delivery not in ALLOWED_DELIVERY:
        return [f"{label}: unsupported delivery={delivery!r} → {p}"], False
    via = normalize_source(prov.get("via_skill") or prov.get("provider_skill") or "")
    if via:
        allowed = {normalize_source(x) for x in ALLOWED_VIA_SKILLS}
        if not any(a in via or via in a for a in allowed):
            return [f"{label}: unsupported via_skill={via!r} → {p}"], False
    return [], True


def _iter_configured_artifacts(cfg: Dict[str, Any]) -> List[Tuple[str, Optional[Path]]]:
    out: List[Tuple[str, Optional[Path]]] = []
    for fac in cfg.get("factors") or []:
        fid = fac.get("factor_id")
        for key, label in (
            ("signal_path", f"{fid}.signal"),
            ("score_report_path", f"{fid}.score_report"),
            ("decay_report_path", f"{fid}.decay_report"),
        ):
            out.append((label, fac.get(key)))
    crowding = cfg.get("crowding") or {}
    for key in ("snapshot_path", "scorecard_path"):
        out.append((f"crowding.{key}", crowding.get(key)))
    sm = cfg.get("smart_money") or {}
    out.append(("smart_money.sample_path", sm.get("sample_path")))
    return out


def enforce_live_red_line(cfg: Dict[str, Any]) -> Dict[str, Any]:
    mode = str(cfg.get("source_mode") or "").lower()
    errors: List[str] = []
    warnings: List[str] = []
    cache_hits = 0

    if mode == "mock":
        return {
            "ok": True,
            "mode": "mock",
            "errors": [],
            "warnings": ["mock run"],
            "credentials": has_pandadata_credentials(),
            "pandadata_cache_hits": 0,
        }

    if mode not in {"live", "degraded"}:
        errors.append(f"unknown source_mode={mode}")

    declared = cfg.get("data_source") or (cfg.get("data") or {}).get("source")
    if mode == "live":
        if not declared:
            errors.append("portfolio.data_source is required")
        elif not is_pandadata_source(declared):
            errors.append(f"unsupported portfolio.data_source={declared!r}")

    for label, path in _iter_configured_artifacts(cfg):
        errs, ok_art = check_artifact_provenance(path, label=label)
        errors.extend(errs)
        if ok_art:
            cache_hits += 1

    require_api = bool((cfg.get("data") or {}).get("require_live_api"))
    if mode == "live":
        if cache_hits == 0 and not has_pandadata_credentials():
            errors.append(
                "no dependency outputs/cache with data_source=Pandadata, "
                "and PANDA_DATA credentials are missing"
            )
        if require_api and not has_pandadata_credentials():
            errors.append("require_live_api=true but credentials missing")

    banned_keys = [
        k
        for k in cfg.keys()
        if any(b in str(k).lower() for b in ("tushare", "akshare", "yahoo", "wind", "bloomberg"))
    ]
    if banned_keys:
        errors.append(f"unsupported data source keys: {banned_keys}")

    result = {
        "ok": len(errors) == 0,
        "mode": mode,
        "errors": errors,
        "warnings": warnings,
        "credentials": has_pandadata_credentials(),
        "pandadata_cache_hits": cache_hits,
    }
    if errors and mode == "live":
        raise PandadataRedLineError("; ".join(errors))
    return result
