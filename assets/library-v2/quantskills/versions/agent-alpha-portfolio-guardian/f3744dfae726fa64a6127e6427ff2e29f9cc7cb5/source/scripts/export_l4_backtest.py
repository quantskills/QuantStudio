# -*- coding: utf-8 -*-
"""将回测产物导出为 SCI 风格 L4 HTML（内嵌数据，可离线打开）。

用法：
  python scripts/export_l4_backtest.py --run-dir reports/backtest/20260802_225209
  python scripts/export_l4_backtest.py --run-dir reports/samples/backtest_mock --output reports/samples/backtest_mock/l4.html

库调用：
  from export_l4_backtest import export_l4_backtest, build_payload_from_run
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "templates" / "l4_backtest.html"
BEGIN = "<!-- BACKTEST_EMBEDDED_DATA_BEGIN -->"
END = "<!-- BACKTEST_EMBEDDED_DATA_END -->"


def _read_csv(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        return []
    df = pd.read_csv(path)
    # NaN → null
    return json.loads(df.to_json(orient="records", force_ascii=False))


def build_payload_from_run(run_dir: str | Path) -> Dict[str, Any]:
    """从回测输出目录组装前端 payload。"""
    rd = Path(run_dir)
    if not rd.is_absolute():
        rd = ROOT / rd
    if not rd.exists():
        raise FileNotFoundError(f"backtest run_dir not found: {rd}")

    summary_path = rd / "summary.json"
    if summary_path.exists():
        summary = json.loads(summary_path.read_text(encoding="utf-8"))
    else:
        summary = {}
        acc_path = rd / "accuracy.json"
        if acc_path.exists():
            summary["accuracy"] = json.loads(acc_path.read_text(encoding="utf-8"))

    from runtime.paths import portable_ref

    meta = dict(summary.get("meta") or {})
    if "portfolio" in meta:
        meta["portfolio"] = portable_ref(meta["portfolio"])

    payload: Dict[str, Any] = {
        "meta": meta,
        "portfolio_stats": summary.get("portfolio_stats") or {},
        "accuracy": summary.get("accuracy") or {},
        "buckets": _read_csv(rd / "bucket_stats.csv"),
        "equity": _read_csv(rd / "keep_equity.csv"),
        "rolling": _read_csv(rd / "rolling_oos.csv"),
        "generated": datetime.now().isoformat(timespec="seconds"),
        # L4 嵌在产物包内，锚点即为本目录
        "run_dir": ".",
    }
    return payload


def embed_payload(html_path: Path, payload: Dict[str, Any]) -> None:
    text = html_path.read_text(encoding="utf-8")
    # 必须用函数替换：字符串替换里 \\ 会被 re.sub 再吃一层，弄坏 Windows 路径 JSON
    dumped = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    # 自检：写入前必须能 round-trip
    json.loads(dumped)
    block = (
        f"{BEGIN}\n"
        f'<script type="application/json" id="backtest-embedded-data">'
        f"{dumped}"
        f"</script>\n"
        f"{END}"
    )
    pat = re.compile(
        re.escape(BEGIN) + r".*?" + re.escape(END),
        flags=re.DOTALL,
    )
    if not pat.search(text):
        raise ValueError(f"embed markers not found in {html_path}")
    html_path.write_text(pat.sub(lambda _m: block, text), encoding="utf-8")


def export_l4_backtest(
    run_dir: str | Path,
    output: Optional[str | Path] = None,
    *,
    template: Optional[str | Path] = None,
) -> Dict[str, str]:
    """写出 L4 HTML，返回路径字典。"""
    rd = Path(run_dir)
    if not rd.is_absolute():
        rd = ROOT / rd
    out = Path(output) if output else rd / "l4.html"
    if not out.is_absolute():
        out = ROOT / out
    out.parent.mkdir(parents=True, exist_ok=True)

    tmpl = Path(template) if template else TEMPLATE
    if not tmpl.is_absolute():
        tmpl = ROOT / tmpl
    if not tmpl.exists():
        raise FileNotFoundError(f"L4 template missing: {tmpl}")

    if out.resolve() != tmpl.resolve():
        shutil.copy2(tmpl, out)

    payload = build_payload_from_run(rd)
    embed_payload(out, payload)

    # 可选旁路 JSON，便于调试
    jp = out.with_suffix(".data.json")
    jp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    return {"l4_html": str(out), "payload_json": str(jp), "run_dir": str(rd)}


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description="Export guardian backtest L4 HTML")
    p.add_argument("--run-dir", required=True, help="回测产物目录")
    p.add_argument("--output", default="", help="默认 <run-dir>/l4.html")
    p.add_argument("--template", default=str(TEMPLATE))
    args = p.parse_args(argv)
    paths = export_l4_backtest(
        args.run_dir,
        output=args.output or None,
        template=args.template,
    )
    print(f"[OK] l4 → {paths['l4_html']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
