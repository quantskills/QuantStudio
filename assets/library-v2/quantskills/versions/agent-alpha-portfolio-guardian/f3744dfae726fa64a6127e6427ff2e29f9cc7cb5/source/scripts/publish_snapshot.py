# -*- coding: utf-8 -*-
"""验收通过后固化发布态快照。"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = Path(__file__).resolve().parent
for p in (str(ROOT), str(SCRIPTS)):
    if p not in sys.path:
        sys.path.insert(0, p)

from validate_report import validate_run_dir

PUBLISH_FILES = [
    "runtime_report.md",
    "health_matrix.csv",
    "health_matrix.parquet",
    "retire_rebuild_candidates.csv",
    "crowding_alerts.json",
    "ic_decay_curves.json",
    "agent_snapshot.json",
    "run_summary.json",
    "validation.json",
    "handoff_card.md",
    "pandadata_redline.json",
    "trade_calendar.json",
]


def publish(run_dir: Path, publish_root: Path) -> Path:
    result = validate_run_dir(run_dir)
    if not result["ok"]:
        raise SystemExit(f"validate failed, refuse publish: {result['errors']}")

    from runtime.pandadata_gate import is_pandadata_source

    snap = json.loads((run_dir / "agent_snapshot.json").read_text(encoding="utf-8"))
    mode = snap.get("source_mode") or "live"
    as_of = snap.get("as_of_date") or "unknown"
    if mode == "live" and not is_pandadata_source(snap.get("data_source")):
        raise SystemExit("refuse publish: live data_source must be Pandadata")
    if mode == "mock":
        print("[WARN] publishing mock snapshot")

    dest = publish_root / str(as_of) / str(snap.get("data_version") or "unversioned")
    dest.mkdir(parents=True, exist_ok=True)

    for name in PUBLISH_FILES:
        src = run_dir / name
        if src.exists():
            shutil.copy2(src, dest / name)
    charts = run_dir / "charts"
    if charts.exists():
        shutil.copytree(charts, dest / "charts", dirs_exist_ok=True)

    from runtime.paths import portable_ref

    meta = {
        # 发布目录自描述；来源 run 用可移植引用，避免写入他机绝对路径
        "published_from": portable_ref(run_dir),
        "as_of_date": as_of,
        "source_mode": mode,
        "data_version": snap.get("data_version"),
        "update_time": snap.get("update_time")
        or json.loads((run_dir / "run_summary.json").read_text(encoding="utf-8")).get(
            "update_time"
        ),
    }
    (dest / "publish_meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return dest


def main(argv: Optional[list] = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--from", dest="run_from", required=True)
    parser.add_argument(
        "--to",
        dest="publish_root",
        default=str(ROOT / "reports" / "publish"),
    )
    args = parser.parse_args(argv)
    run_dir = Path(args.run_from)
    if not run_dir.is_absolute():
        run_dir = (ROOT / run_dir).resolve()
    dest = publish(run_dir, Path(args.publish_root))
    print(f"[OK] published → {dest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
