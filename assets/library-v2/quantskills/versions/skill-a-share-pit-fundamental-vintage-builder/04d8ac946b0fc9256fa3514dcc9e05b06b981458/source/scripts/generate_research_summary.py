from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd


def quarter_index(value: object) -> int:
    try:
        year_text, quarter_text = str(value).lower().split("q")
        year = int(year_text)
        quarter = int(quarter_text)
    except (AttributeError, ValueError) as exc:
        raise ValueError(f"Invalid quarter {value!r}; use YYYYqN.") from exc
    if quarter not in {1, 2, 3, 4}:
        raise ValueError(f"Invalid quarter {value!r}; use YYYYq1 through YYYYq4.")
    return year * 4 + quarter - 1


def format_date(value: object) -> str:
    text = str(value)
    if len(text) == 8 and text.isdigit():
        return f"{text[:4]}-{text[4:6]}-{text[6:]}"
    return text


def format_yi(value: object) -> str:
    number = pd.to_numeric(pd.Series([value]), errors="coerce").iloc[0]
    if pd.isna(number):
        return "-"
    return f"{number / 100_000_000:,.1f} 亿"


def format_percent(value: object) -> str:
    number = pd.to_numeric(pd.Series([value]), errors="coerce").iloc[0]
    if pd.isna(number):
        return "-"
    return f"{number:.1%}"


def format_number(value: object) -> str:
    number = pd.to_numeric(pd.Series([value]), errors="coerce").iloc[0]
    if pd.isna(number):
        return "-"
    return f"{number:.2f}"


def latest_rows(factors: pd.DataFrame) -> tuple[str, pd.DataFrame]:
    required = {"symbol", "quarter", "as_of_date"}
    missing = required.difference(factors.columns)
    if missing:
        raise ValueError(f"Factor panel is missing required columns: {', '.join(sorted(missing))}.")
    as_of_dates = factors["as_of_date"].dropna().astype(str)
    if as_of_dates.empty:
        raise ValueError("Factor panel contains no as_of_date values.")
    latest_date = as_of_dates.max()
    latest = factors.loc[factors["as_of_date"].astype(str) == latest_date].copy()
    latest["_quarter_index"] = latest["quarter"].map(quarter_index)
    latest = (
        latest.sort_values(["symbol", "_quarter_index"])
        .groupby("symbol", as_index=False, group_keys=False)
        .tail(1)
        .sort_values("symbol")
    )
    return latest_date, latest


def value(row: pd.Series, column: str) -> object:
    return row[column] if column in row.index else None


def build_research_summary(
    factors: pd.DataFrame,
    audit: dict[str, object] | None,
    factors_path: Path,
    audit_path: Path | None,
    pit_panel_path: Path | None = None,
    schedule_path: Path | None = None,
) -> str:
    latest_date, latest = latest_rows(factors)
    all_dates = factors["as_of_date"].dropna().astype(str)
    first_date = all_dates.min()
    symbols = sorted(latest["symbol"].astype(str).tolist())
    lines = ["# A 股财务因子回测数据摘要", "", "## 结论"]

    if audit is None:
        lines.append("- **PIT 状态：未确认。** 未提供审计报告，无法确认调仓日覆盖和时点可用性。")
    elif audit.get("valid") is True:
        warning_count = int(audit.get("warnings", 0))
        suffix = f"，另有 {warning_count} 条提示" if warning_count else ""
        lines.append(f"- **PIT 数据校验通过。** 未发现未来可用数据或缺失调仓快照{suffix}。")
    else:
        error_count = int(audit.get("errors", 0))
        lines.append(f"- **PIT 数据存在风险。** 审计发现 {error_count} 条错误；回测结果不应直接采信。")

    lines.extend(
        [
            f"- 覆盖 `{format_date(first_date)}` 至 `{format_date(latest_date)}`，共 {all_dates.nunique()} 个调仓时点、{len(symbols)} 只股票。",
            f"- 最后调仓日为 `{format_date(latest_date)}`；表中展示的是当时实际可用的最新报告期，而非今天看到的最新财报。",
            "",
            "## 最后调仓日的可用财务快照",
            "",
            "| 股票 | 当时最新报告期 | 近12个月营收 | 近12个月归母净利润 | 净利率 | 营收同比 | 利润同比 | ROA |",
            "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
        ]
    )
    for _, row in latest.iterrows():
        lines.append(
            "| {symbol} | {quarter} | {revenue} | {income} | {margin} | {revenue_yoy} | {income_yoy} | {roa} |".format(
                symbol=row["symbol"],
                quarter=row["quarter"],
                revenue=format_yi(value(row, "is_revenue_ttm")),
                income=format_yi(value(row, "is_n_income_attr_p_ttm")),
                margin=format_percent(value(row, "net_margin_ttm")),
                revenue_yoy=format_percent(value(row, "revenue_ttm_yoy")),
                income_yoy=format_percent(value(row, "net_income_ttm_yoy")),
                roa=format_percent(value(row, "roa_ttm")),
            )
        )

    lines.extend(["", "## 如何理解", ""])
    for _, row in latest.iterrows():
        lines.append(
            f"- `{row['symbol']}`：当时可用最新报告为 `{row['quarter']}`；"
            f"净利率 {format_percent(value(row, 'net_margin_ttm'))}，"
            f"现金含量 {format_number(value(row, 'cash_conversion_ttm'))}，"
            f"资产周转率 {format_number(value(row, 'asset_turnover_ttm'))}。"
        )
    lines.extend(
        [
            "",
            "## 边界",
            "",
            "- 本摘要仅用于回测研究的数据准备，不构成投资建议或买卖结论。",
            "- PIT 校验解决财报时点和修订泄漏，不解决幸存者偏差、交易成本、复权处理或模型过拟合。",
            "",
            "## 数据文件",
            "",
            f"- 因子面板：`{factors_path}`",
        ]
    )
    if pit_panel_path:
        lines.append(f"- PIT 财务面板：`{pit_panel_path}`")
    if schedule_path:
        lines.append(f"- 调仓日表：`{schedule_path}`")
    if audit_path:
        lines.append(f"- 审计报告：`{audit_path}`")
    return "\n".join(lines) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a readable Chinese summary for an A-share PIT factor dataset."
    )
    parser.add_argument("--factors", type=Path, required=True, help="Derived fundamental-factor CSV")
    parser.add_argument("--audit", type=Path, help="Optional PIT audit JSON")
    parser.add_argument("--pit-panel", type=Path, help="Optional PIT panel CSV for the artifact list")
    parser.add_argument("--schedule", type=Path, help="Optional rebalance-date CSV for the artifact list")
    parser.add_argument("--output", type=Path, required=True, help="Output Markdown path")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    factors = pd.read_csv(args.factors, dtype={"symbol": str, "quarter": str, "as_of_date": str})
    audit = json.loads(args.audit.read_text(encoding="utf-8")) if args.audit else None
    summary = build_research_summary(
        factors, audit, args.factors, args.audit, args.pit_panel, args.schedule
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(summary, encoding="utf-8")
    print(f"Wrote research summary to {args.output}")


if __name__ == "__main__":
    main()
