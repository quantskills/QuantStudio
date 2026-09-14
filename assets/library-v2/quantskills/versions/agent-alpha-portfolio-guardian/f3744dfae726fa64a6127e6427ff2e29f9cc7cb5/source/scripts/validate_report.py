# -*- coding: utf-8 -*-
"""时点 + 结构门禁。"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

FORBIDDEN = ("买入", "卖出", "必涨", "仓位提到")
REQUIRED_FILES = [
    "runtime_report.md",
    "health_matrix.csv",
    "crowding_alerts.json",
    "retire_rebuild_candidates.csv",
    "ic_decay_curves.json",
    "agent_snapshot.json",
    "run_summary.json",
]


def validate_run_dir(run_dir: Path) -> Dict[str, Any]:
    errors: List[str] = []
    warnings: List[str] = []

    for name in REQUIRED_FILES:
        if not (run_dir / name).exists():
            errors.append(f"missing file: {name}")

    report = run_dir / "runtime_report.md"
    if report.exists():
        text = report.read_text(encoding="utf-8")
        if "免责声明" not in text and "不构成任何投资建议" not in text:
            errors.append("runtime_report missing disclaimer")
        for bad in FORBIDDEN:
            # 允许出现在「禁止用语说明」之外的正文
            if bad in text:
                # 候选建议里不应出现
                errors.append(f"forbidden phrase in report: {bad}")
        for section in ("健康度矩阵", "拥挤", "退休", "衰减", "方法来源"):
            if section not in text:
                warnings.append(f"report section soft-miss: {section}")

    # matrix uniqueness
    import pandas as pd

    mat_path = run_dir / "health_matrix.csv"
    df = None
    matrix_modes: set[str] = set()
    if mat_path.exists():
        df = pd.read_csv(mat_path)
        for col in (
            "as_of_date",
            "factor_id",
            "signal",
            "health_status",
            "data_version",
            "source_mode",
            "gap_notes",
        ):
            if col not in df.columns:
                errors.append(f"health_matrix missing column: {col}")
        if {"as_of_date", "factor_id", "data_version"}.issubset(df.columns):
            dup = df.duplicated(subset=["as_of_date", "factor_id", "data_version"]).sum()
            if dup:
                errors.append(f"health_matrix primary key duplicates: {dup}")
        if "signal" in df.columns:
            bad_insufficient = df[
                (df["signal"] == "insufficient")
                & (df["gap_notes"].fillna("").astype(str).str.len() == 0)
            ]
            if len(bad_insufficient):
                errors.append("insufficient rows must carry gap_notes")

        if "source_mode" in df.columns and "data_version" in df.columns:
            matrix_modes = set(str(x) for x in df["source_mode"].dropna().unique())
            for _, row in df.iterrows():
                row_mode = str(row["source_mode"])
                ver = str(row["data_version"])
                if row_mode == "mock" and "mock" not in ver:
                    warnings.append(
                        f"mock row without mock version prefix: {row['factor_id']}"
                    )
                if row_mode == "live" and "mock" in ver:
                    errors.append(f"live row uses mock version: {row['factor_id']}")

    snap = run_dir / "agent_snapshot.json"
    snap_obj: Dict[str, Any] = {}
    if snap.exists():
        snap_obj = json.loads(snap.read_text(encoding="utf-8"))
        if not snap_obj.get("as_of_date"):
            errors.append("agent_snapshot missing as_of_date")
        # 产物包路径应相对 run_dir，禁止残留绝对路径
        for key, val in (snap_obj.get("paths") or {}).items():
            s = str(val)
            if ":\\" in s or s.startswith("/") or s.startswith("~"):
                errors.append(f"agent_snapshot.paths[{key}] must be pack-relative, got={s!r}")

    cal_path = run_dir / "trade_calendar.json"
    if not cal_path.exists():
        warnings.append("missing trade_calendar.json")
    else:
        try:
            cal = json.loads(cal_path.read_text(encoding="utf-8"))
            if cal.get("ok") is False:
                errors.append(
                    "trade_calendar not ok: " + "; ".join(cal.get("errors") or [])
                )
        except Exception as exc:  # noqa: BLE001
            errors.append(f"invalid trade_calendar.json: {exc}")

    from runtime.pandadata_gate import is_pandadata_source

    redline_path = run_dir / "pandadata_redline.json"
    mode = str(snap_obj.get("source_mode") or "")
    if "live" in matrix_modes:
        mode = "live"
    elif "degraded" in matrix_modes and mode != "live":
        mode = mode or "degraded"
    elif not mode and matrix_modes:
        mode = next(iter(matrix_modes))

    if mode in {"live", "degraded"}:
        if not redline_path.exists():
            errors.append(f"{mode}: missing pandadata_redline.json")
        else:
            rl = json.loads(redline_path.read_text(encoding="utf-8"))
            if mode == "live" and not rl.get("ok", False):
                errors.append(f"data source check failed: {rl.get('errors')}")
        ds = snap_obj.get("data_source")
        if mode == "live" and not is_pandadata_source(ds):
            errors.append(f"live data_source must be Pandadata, got={ds!r}")

    if mode == "mock" and is_pandadata_source(snap_obj.get("data_source")):
        if snap_obj.get("synthetic") is not True:
            errors.append("mock data_source should not be Pandadata")

    charts_ok = (run_dir / "charts" / "ic_decay_family.png").exists() or (
        run_dir / "charts" / "ic_decay_ascii.txt"
    ).exists()
    if not charts_ok:
        warnings.append("no IC decay chart or ASCII fallback")

    ok = len(errors) == 0
    return {
        "ok": ok,
        "errors": errors,
        "warnings": warnings,
        # 相对产物包根；调用方持有绝对 run_dir
        "run_dir": ".",
    }


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("run_dir", nargs="?", help="reports/runtime_out/<run_id>")
    parser.add_argument("--json-out", default=None)
    args = parser.parse_args(argv)

    if not args.run_dir:
        print("usage: validate_report.py <run_dir>", file=sys.stderr)
        return 2
    run_dir = Path(args.run_dir)
    if not run_dir.is_absolute():
        run_dir = (ROOT / run_dir).resolve()
    result = validate_run_dir(run_dir)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if args.json_out:
        Path(args.json_out).write_text(
            json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
