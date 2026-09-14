#!/usr/bin/env python3
"""Run the current A/H market scan end to end."""

from __future__ import annotations

import argparse
import locale
import subprocess
import sys
from pathlib import Path


def _decode_output(data: bytes | None) -> str:
    if not data:
        return ""
    encodings = []
    preferred = locale.getpreferredencoding(False)
    if preferred:
        encodings.append(preferred)
    encodings.extend(["utf-8", "cp936", "gbk", "mbcs"])
    seen: set[str] = set()
    for encoding in encodings:
        key = encoding.lower()
        if key in seen:
            continue
        seen.add(key)
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def _run_step(cmd: list[str]) -> None:
    result = subprocess.run(cmd, check=False, capture_output=True)
    stdout = _decode_output(result.stdout)
    stderr = _decode_output(result.stderr)
    if stdout:
        print(stdout, end="")
    if result.returncode != 0:
        message = stderr.strip() or stdout.strip() or "subprocess failed"
        raise SystemExit(message)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--company", help="Optional company-name filter for a single-company current scan")
    args = ap.parse_args()

    script_dir = Path(__file__).resolve().parent
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    snapshot = out_dir / "ah_snapshot.csv"
    report_json = out_dir / "ah_snapshot_report.json"
    report_md = out_dir / "ah_snapshot_report.md"

    fetch_cmd = [sys.executable, str(script_dir / "fetch_live.py"), "--out", str(snapshot)]
    if args.company:
        fetch_cmd.extend(["--company", args.company])
    _run_step(fetch_cmd)

    scan_cmd = [
        sys.executable,
        str(script_dir / "scan_snapshot.py"),
        str(snapshot),
        "--json",
        str(report_json),
        "--md",
        str(report_md),
    ]
    _run_step(scan_cmd)

    print(f"snapshot: {snapshot}")
    print(f"json: {report_json}")
    print(f"md: {report_md}")


if __name__ == "__main__":
    main()
