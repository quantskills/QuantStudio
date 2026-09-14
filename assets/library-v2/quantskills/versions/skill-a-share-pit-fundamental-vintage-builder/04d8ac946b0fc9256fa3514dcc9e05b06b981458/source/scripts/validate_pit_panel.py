from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd


REQUIRED_COLUMNS = {
    "symbol",
    "quarter",
    "disclosure_date",
    "available_date",
    "as_of_date",
    "vintage_type",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate a Point-in-Time fundamental CSV.")
    parser.add_argument("path", type=Path, help="PIT snapshot CSV path")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    panel = pd.read_csv(args.path, dtype=str)
    missing = REQUIRED_COLUMNS.difference(panel.columns)
    errors: list[str] = []
    if missing:
        errors.append(f"Missing required columns: {', '.join(sorted(missing))}")
    else:
        for column in ("disclosure_date", "available_date", "as_of_date"):
            parsed = pd.to_datetime(panel[column], format="%Y%m%d", errors="coerce")
            invalid = ~panel[column].str.fullmatch(r"\d{8}") | parsed.isna()
            if invalid.any():
                errors.append(f"Invalid YYYYMMDD values in {column}: {int(invalid.sum())}")
        if (panel["available_date"] <= panel["disclosure_date"]).any():
            errors.append("available_date must be strictly later than disclosure_date")
        if (panel["available_date"] > panel["as_of_date"]).any():
            errors.append("Snapshot contains values unavailable on its as_of_date")
        if panel.duplicated(["symbol", "quarter", "as_of_date"]).any():
            errors.append("Panel contains more than one vintage for a symbol-quarter-as_of_date")
        if (panel["vintage_type"] != "formal_report").any():
            errors.append("vintage_type must be formal_report in the first release")

    result = {"path": str(args.path), "rows": len(panel), "valid": not errors, "errors": errors}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
