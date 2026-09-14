from __future__ import annotations

import argparse
import ast
import json
from pathlib import Path
from typing import Any

import pandas as pd


REQUIRED_PANEL_COLUMNS = {
    "symbol",
    "quarter",
    "disclosure_date",
    "available_date",
    "as_of_date",
    "vintage_type",
}
DATE_COLUMNS = ("disclosure_date", "available_date", "as_of_date")


def make_finding(
    severity: str,
    code: str,
    message: str,
    path: Path | None = None,
    line: int | None = None,
) -> dict[str, Any]:
    finding: dict[str, Any] = {"severity": severity, "code": code, "message": message}
    if path is not None:
        finding["path"] = str(path)
    if line is not None:
        finding["line"] = line
    return finding


def invalid_dates(frame: pd.DataFrame, column: str) -> pd.Series:
    return pd.to_datetime(frame[column], format="%Y%m%d", errors="coerce").isna()


def audit_panel(panel_path: Path) -> tuple[pd.DataFrame, list[dict[str, Any]]]:
    findings: list[dict[str, Any]] = []
    try:
        panel = pd.read_csv(panel_path, dtype=str)
    except (OSError, pd.errors.ParserError) as exc:
        return pd.DataFrame(), [
            make_finding("error", "PANEL_READ_FAILED", f"Could not read panel: {exc}", panel_path)
        ]

    missing = REQUIRED_PANEL_COLUMNS.difference(panel.columns)
    if missing:
        findings.append(
            make_finding(
                "error",
                "MISSING_PANEL_COLUMNS",
                f"Panel is missing required columns: {', '.join(sorted(missing))}.",
                panel_path,
            )
        )
        return panel, findings

    valid_dates = True
    for column in DATE_COLUMNS:
        invalid = invalid_dates(panel, column)
        if invalid.any():
            findings.append(
                make_finding(
                    "error",
                    "INVALID_DATE",
                    f"Column {column} contains {int(invalid.sum())} invalid YYYYMMDD dates.",
                    panel_path,
                )
            )
            valid_dates = False
    if not valid_dates:
        return panel, findings

    if (panel["available_date"] <= panel["disclosure_date"]).any():
        findings.append(
            make_finding(
                "error",
                "INVALID_AVAILABILITY_DATE",
                "available_date must be strictly later than disclosure_date.",
                panel_path,
            )
        )
    if (panel["available_date"] > panel["as_of_date"]).any():
        findings.append(
            make_finding(
                "error",
                "FUTURE_AVAILABLE_VALUE",
                "Panel contains values unavailable on their as_of_date.",
                panel_path,
            )
        )
    if panel.duplicated(["symbol", "quarter", "as_of_date"]).any():
        findings.append(
            make_finding(
                "error",
                "DUPLICATE_PANEL_VINTAGE",
                "Panel contains more than one vintage for a symbol-quarter-as_of_date.",
                panel_path,
            )
        )
    if (panel["vintage_type"] != "formal_report").any():
        findings.append(
            make_finding(
                "error",
                "UNSUPPORTED_VINTAGE_TYPE",
                "This audit only accepts formal_report rows in the first release.",
                panel_path,
            )
        )
    return panel, findings


def audit_rebalance_dates(
    panel: pd.DataFrame, rebalance_dates_path: Path
) -> tuple[list[str], list[dict[str, Any]]]:
    findings: list[dict[str, Any]] = []
    try:
        schedule = pd.read_csv(rebalance_dates_path, dtype=str)
    except (OSError, pd.errors.ParserError) as exc:
        return [], [
            make_finding("error", "REBALANCE_SCHEDULE_READ_FAILED", f"Could not read schedule: {exc}", rebalance_dates_path)
        ]

    column = "rebalance_date" if "rebalance_date" in schedule.columns else "date"
    if column not in schedule.columns:
        return [], [
            make_finding(
                "error",
                "MISSING_REBALANCE_DATE_COLUMN",
                "Schedule must contain rebalance_date or date.",
                rebalance_dates_path,
            )
        ]

    dates = schedule[column].fillna("").str.strip()
    parsed = pd.to_datetime(dates, format="%Y%m%d", errors="coerce")
    if parsed.isna().any():
        findings.append(
            make_finding(
                "error",
                "INVALID_REBALANCE_DATE",
                f"Schedule contains {int(parsed.isna().sum())} invalid YYYYMMDD dates.",
                rebalance_dates_path,
            )
        )
        return [], findings
    if dates.duplicated().any():
        findings.append(
            make_finding(
                "error",
                "DUPLICATE_REBALANCE_DATE",
                "Schedule contains duplicate rebalance dates.",
                rebalance_dates_path,
            )
        )

    schedule_dates = sorted(dates.tolist())
    panel_dates = set(panel["as_of_date"].tolist()) if "as_of_date" in panel.columns else set()
    missing_snapshots = sorted(set(schedule_dates).difference(panel_dates))
    if missing_snapshots:
        findings.append(
            make_finding(
                "error",
                "MISSING_REBALANCE_SNAPSHOT",
                f"Panel has no as_of_date snapshot for: {', '.join(missing_snapshots)}.",
                rebalance_dates_path,
            )
        )
    extra_snapshots = sorted(panel_dates.difference(schedule_dates))
    if extra_snapshots:
        findings.append(
            make_finding(
                "warning",
                "UNSCHEDULED_PANEL_SNAPSHOT",
                f"Panel contains as_of_date values absent from schedule: {', '.join(extra_snapshots)}.",
                rebalance_dates_path,
            )
        )
    return schedule_dates, findings


def dotted_name(node: ast.AST) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        parent = dotted_name(node.value)
        return f"{parent}.{node.attr}" if parent else node.attr
    return ""


def constant_value(node: ast.AST) -> Any:
    if isinstance(node, ast.Constant):
        return node.value
    if (
        isinstance(node, ast.UnaryOp)
        and isinstance(node.op, ast.USub)
        and isinstance(node.operand, ast.Constant)
        and isinstance(node.operand.value, (int, float))
    ):
        return -node.operand.value
    return None


def audit_factor_code(code_path: Path) -> list[dict[str, Any]]:
    try:
        source = code_path.read_text(encoding="utf-8")
    except OSError as exc:
        return [make_finding("error", "FACTOR_CODE_READ_FAILED", f"Could not read code: {exc}", code_path)]
    try:
        tree = ast.parse(source, filename=str(code_path))
    except SyntaxError as exc:
        return [
            make_finding(
                "error",
                "FACTOR_CODE_PARSE_FAILED",
                f"Could not parse Python code: {exc.msg}.",
                code_path,
                exc.lineno,
            )
        ]

    findings: list[dict[str, Any]] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        name = dotted_name(node.func)
        if name.endswith("get_fina_reports"):
            is_latest = next((keyword.value for keyword in node.keywords if keyword.arg == "is_latest"), None)
            if constant_value(is_latest) is True:
                findings.append(
                    make_finding(
                        "error",
                        "CURRENT_LATEST_FINANCIALS",
                        "get_fina_reports(is_latest=True) uses today's latest report version in a historical workflow.",
                        code_path,
                        node.lineno,
                    )
                )
            elif is_latest is None:
                findings.append(
                    make_finding(
                        "warning",
                        "UNSPECIFIED_FINANCIAL_VINTAGE",
                        "get_fina_reports does not explicitly set is_latest=False.",
                        code_path,
                        node.lineno,
                    )
                )
        if name.endswith("shift"):
            periods = node.args[0] if node.args else next(
                (keyword.value for keyword in node.keywords if keyword.arg == "periods"), None
            )
            if isinstance(constant_value(periods), (int, float)) and constant_value(periods) < 0:
                findings.append(
                    make_finding(
                        "error",
                        "NEGATIVE_SHIFT",
                        "Negative shift reads a future row and can leak future information.",
                        code_path,
                        node.lineno,
                    )
                )
        if name.endswith("bfill") or name.endswith("backfill"):
            findings.append(
                make_finding(
                    "warning",
                    "BACKFILL_RISK",
                    "Backfilling may use a later observation. Verify the fill direction is valid for each signal date.",
                    code_path,
                    node.lineno,
                )
            )
        if name.endswith("merge_asof"):
            direction = next((keyword.value for keyword in node.keywords if keyword.arg == "direction"), None)
            if constant_value(direction) == "forward":
                findings.append(
                    make_finding(
                        "warning",
                        "FORWARD_ASOF_MERGE_RISK",
                        "merge_asof(direction='forward') can attach future observations.",
                        code_path,
                        node.lineno,
                    )
                )
    return findings


def audit_backtest_inputs(
    panel_path: Path, rebalance_dates_path: Path, factor_code_paths: list[Path]
) -> dict[str, Any]:
    panel, findings = audit_panel(panel_path)
    schedule_dates, schedule_findings = audit_rebalance_dates(panel, rebalance_dates_path)
    findings.extend(schedule_findings)
    if factor_code_paths:
        for code_path in factor_code_paths:
            findings.extend(audit_factor_code(code_path))
    else:
        findings.append(
            make_finding(
                "warning",
                "FACTOR_CODE_NOT_PROVIDED",
                "Only panel and rebalance-date checks were completed; factor-code leakage was not audited.",
            )
        )

    errors = sum(finding["severity"] == "error" for finding in findings)
    warnings = sum(finding["severity"] == "warning" for finding in findings)
    return {
        "valid": errors == 0,
        "errors": errors,
        "warnings": warnings,
        "panel_path": str(panel_path),
        "panel_rows": len(panel),
        "rebalance_dates": schedule_dates,
        "factor_code_paths": [str(path) for path in factor_code_paths],
        "findings": findings,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audit a PIT factor panel, rebalance schedule, and Python factor code."
    )
    parser.add_argument("--panel", type=Path, required=True, help="PIT factor input CSV")
    parser.add_argument("--rebalance-dates", type=Path, required=True, help="CSV with rebalance_date or date")
    parser.add_argument("--factor-code", type=Path, nargs="*", default=[], help="Python factor/backtest files")
    parser.add_argument("--output", type=Path, help="Optional JSON report path")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    report = audit_backtest_inputs(args.panel, args.rebalance_dates, args.factor_code)
    payload = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(payload, encoding="utf-8")
    print(payload)
    if not report["valid"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
