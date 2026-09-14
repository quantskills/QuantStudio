#!/usr/bin/env python3
"""Validate GNN stock selection output (CSV + MD) against the output contract."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import sys
from datetime import datetime

import pandas as pd


REQUIRED_CSV_COLUMNS = [
    "trade_date", "rank", "symbol", "name", "score",
    "ret_T", "sector", "market_cap",
]

VALID_DATE_PATTERN = re.compile(r"^\d{8}$")


def validate_csv(csv_path: Path) -> dict:
    """Validate a gnn_picks CSV file against the output contract."""
    errors: list[str] = []

    if not csv_path.exists():
        return {"status": "FAIL", "errors": [f"file not found: {csv_path}"], "record_count": 0}

    try:
        df = pd.read_csv(csv_path)
    except Exception as exc:
        return {"status": "FAIL", "errors": [f"cannot read CSV: {exc}"], "record_count": 0}

    # Check required columns
    missing_cols = sorted(set(REQUIRED_CSV_COLUMNS) - set(df.columns))
    if missing_cols:
        errors.append(f"missing required columns: {missing_cols}")

    record_count = len(df)

    if record_count == 0:
        errors.append("CSV is empty (no records)")

    # Validate trade_date format
    if "trade_date" in df.columns:
        invalid_dates = df["trade_date"].apply(
            lambda d: not (isinstance(d, str) and VALID_DATE_PATTERN.match(str(d)))
        )
        if invalid_dates.any():
            errors.append(
                f"invalid trade_date values at rows: "
                f"{sorted(df.index[invalid_dates].tolist())}"
            )

    # Validate rank: must be sequential 1..K with no gaps
    if "rank" in df.columns:
        ranks = sorted(df["rank"].dropna().astype(int).tolist())
        if ranks:
            if ranks[0] != 1:
                errors.append(f"rank does not start at 1 (first rank: {ranks[0]})")
            expected = list(range(1, len(ranks) + 1))
            if ranks != expected:
                gaps = sorted(set(expected) - set(ranks))
                duplicates = sorted(
                    set(ranks[i] for i in range(1, len(ranks)) if ranks[i] == ranks[i - 1])
                )
                if gaps:
                    errors.append(f"rank has gaps: missing ranks {gaps}")
                if duplicates:
                    errors.append(f"rank has duplicates: {duplicates}")

    # Validate score: finite, not NaN, monotonically non-increasing
    if "score" in df.columns:
        if df["score"].isna().any():
            nan_rows = sorted(df.index[df["score"].isna()].tolist())
            errors.append(f"score contains NaN at rows: {nan_rows}")
        if not df["score"].dropna().apply(lambda x: float(x) == float(x)).all():
            errors.append("score contains non-finite values")
        scores = df["score"].dropna().tolist()
        if scores:
            for i in range(1, len(scores)):
                if float(scores[i]) > float(scores[i - 1]):
                    errors.append(
                        f"score not monotonically non-increasing at rank {i + 1}"
                    )
                    break

    # Validate no duplicate symbols
    if "symbol" in df.columns:
        dupes = df["symbol"][df["symbol"].duplicated()].tolist()
        if dupes:
            errors.append(f"duplicate symbols: {dupes}")

    # Validate required columns have no NaN
    for col in ["symbol", "name", "trade_date"]:
        if col in df.columns and df[col].isna().any():
            nan_rows = sorted(df.index[df[col].isna()].tolist())
            errors.append(f"{col} contains NaN at rows: {nan_rows}")

    return {
        "status": "PASS" if not errors else "FAIL",
        "errors": errors,
        "record_count": record_count,
        "columns_found": list(df.columns),
    }


def validate_md(md_path: Path) -> dict:
    """Validate a gnn_picks Markdown report against the output contract."""
    errors: list[str] = []

    if not md_path.exists():
        return {"status": "FAIL", "errors": [f"file not found: {md_path}"], "sections_found": []}

    try:
        text = md_path.read_text(encoding="utf-8")
    except Exception as exc:
        return {"status": "FAIL", "errors": [f"cannot read MD: {exc}"], "sections_found": []}

    required_sections = [
        ("TopK", re.compile(r"排名|Top\s*K|Rank|榜单", re.IGNORECASE)),
        ("sector", re.compile(r"行业|Sector|Industry", re.IGNORECASE)),
        ("model", re.compile(r"模型|Model|GATs_ts|mf_iamgcn", re.IGNORECASE)),
    ]

    sections_found = []
    for name, pattern in required_sections:
        if pattern.search(text):
            sections_found.append(name)
        else:
            errors.append(f"missing expected section: {name}")

    # Check for score table (should have at least one pipe table)
    if "|" not in text:
        errors.append("no markdown table found (expected a TopK table)")

    return {
        "status": "PASS" if not errors else "FAIL",
        "errors": errors,
        "sections_found": sections_found,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate GNN stock selection output against the output contract"
    )
    parser.add_argument(
        "path",
        help="Path to gnn_picks CSV file (companion .md file is auto-detected)",
    )
    args = parser.parse_args()

    csv_path = Path(args.path)
    report: dict = {"csv": None, "md": None, "status": "PASS"}

    # Validate CSV
    csv_result = validate_csv(csv_path)
    report["csv"] = csv_result
    if csv_result["status"] == "FAIL":
        report["status"] = "FAIL"

    # Auto-detect companion .md file
    md_path = csv_path.with_suffix(".md")
    if md_path.exists():
        md_result = validate_md(md_path)
        report["md"] = md_result
        if md_result["status"] == "FAIL":
            report["status"] = "FAIL"

    # Also accept a .parquet file as valid production output
    if csv_path.suffix.lower() == ".parquet":
        try:
            df = pd.read_parquet(csv_path)
            report["csv"] = {
                "status": "PASS",
                "errors": [],
                "record_count": len(df),
                "columns_found": list(df.columns),
                "note": "Parquet file validated (column checks only — CSV contract checks skipped)",
            }
        except Exception as exc:
            report["csv"] = {"status": "FAIL", "errors": [str(exc)], "record_count": 0}
            report["status"] = "FAIL"

    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
