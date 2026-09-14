from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd


FLOW_FIELDS = ("is_revenue", "is_n_income_attr_p", "cfs_net_cash_operating")
ASSET_FIELD = "bs_total_assets"
REQUIRED_COLUMNS = {"symbol", "quarter", "as_of_date", *FLOW_FIELDS, ASSET_FIELD}


class FundamentalDerivationError(ValueError):
    """Raised when a panel cannot support deterministic fundamental derivation."""


def quarter_index(value: object) -> int:
    try:
        year_text, quarter_text = str(value).lower().split("q")
        year = int(year_text)
        quarter = int(quarter_text)
    except (AttributeError, ValueError) as exc:
        raise FundamentalDerivationError(f"Invalid quarter {value!r}; use YYYYqN.") from exc
    if quarter not in {1, 2, 3, 4}:
        raise FundamentalDerivationError(f"Invalid quarter {value!r}; use YYYYq1 through YYYYq4.")
    return year * 4 + quarter - 1


def safe_divide(numerator: pd.Series, denominator: pd.Series) -> pd.Series:
    denominator = denominator.where(denominator != 0)
    return numerator / denominator


def derive_single_quarter_values(frame: pd.DataFrame, field: str) -> pd.Series:
    values = pd.to_numeric(frame[field], errors="coerce")
    result = pd.Series(index=frame.index, dtype="float64")
    for _, group in frame.groupby(["symbol", "as_of_date"], sort=False):
        group = group.sort_values("_quarter_index")
        previous_values = values.loc[group.index].shift(1)
        previous_indices = group["_quarter_index"].shift(1)
        consecutive = previous_indices.eq(group["_quarter_index"] - 1)
        first_quarter = group["_quarter_number"].eq(1)
        group_values = values.loc[group.index]
        single_quarter = group_values.where(first_quarter, group_values - previous_values)
        single_quarter = single_quarter.where(first_quarter | consecutive)
        result.loc[group.index] = single_quarter
    return result


def trailing_four_quarters(frame: pd.DataFrame, field: str) -> pd.Series:
    result = pd.Series(index=frame.index, dtype="float64")
    for _, group in frame.groupby(["symbol", "as_of_date"], sort=False):
        group = group.sort_values("_quarter_index")
        values = pd.to_numeric(group[field], errors="coerce")
        indices = group["_quarter_index"].tolist()
        for position in range(3, len(group)):
            window = values.iloc[position - 3 : position + 1]
            expected_indices = list(range(indices[position] - 3, indices[position] + 1))
            if indices[position - 3 : position + 1] == expected_indices and window.notna().all():
                result.loc[group.index[position]] = window.sum()
    return result


def exact_quarter_lag(frame: pd.DataFrame, field: str, quarters: int) -> pd.Series:
    result = pd.Series(index=frame.index, dtype="float64")
    for _, group in frame.groupby(["symbol", "as_of_date"], sort=False):
        group = group.sort_values("_quarter_index")
        values = pd.to_numeric(group[field], errors="coerce")
        index_to_value = dict(zip(group["_quarter_index"], values, strict=True))
        result.loc[group.index] = [
            index_to_value.get(index - quarters, float("nan"))
            for index in group["_quarter_index"]
        ]
    return result


def derive_fundamental_factors(panel: pd.DataFrame) -> pd.DataFrame:
    missing = REQUIRED_COLUMNS.difference(panel.columns)
    if missing:
        raise FundamentalDerivationError(
            f"Panel is missing required fields: {', '.join(sorted(missing))}."
        )
    result = panel.copy()
    result["_quarter_index"] = result["quarter"].map(quarter_index)
    result["_quarter_number"] = result["_quarter_index"] % 4 + 1
    result = result.sort_values(["symbol", "as_of_date", "_quarter_index"]).reset_index(drop=True)

    for field in FLOW_FIELDS:
        result[f"{field}_q"] = derive_single_quarter_values(result, field)
        result[f"{field}_ttm"] = trailing_four_quarters(result, f"{field}_q")

    revenue_ttm = result["is_revenue_ttm"]
    net_income_ttm = result["is_n_income_attr_p_ttm"]
    cash_flow_ttm = result["cfs_net_cash_operating_ttm"]
    assets = pd.to_numeric(result[ASSET_FIELD], errors="coerce")
    prior_year_assets = exact_quarter_lag(result, ASSET_FIELD, 4)
    average_assets = (assets + prior_year_assets) / 2
    result["net_margin_ttm"] = safe_divide(net_income_ttm, revenue_ttm)
    result["cash_conversion_ttm"] = safe_divide(cash_flow_ttm, net_income_ttm)
    result["accruals_to_assets_ttm"] = safe_divide(net_income_ttm - cash_flow_ttm, assets)
    result["roa_ttm"] = safe_divide(net_income_ttm, average_assets)
    result["asset_turnover_ttm"] = safe_divide(revenue_ttm, average_assets)
    result["revenue_ttm_yoy"] = safe_divide(
        revenue_ttm - exact_quarter_lag(result, "is_revenue_ttm", 4),
        exact_quarter_lag(result, "is_revenue_ttm", 4),
    )
    result["net_income_ttm_yoy"] = safe_divide(
        net_income_ttm - exact_quarter_lag(result, "is_n_income_attr_p_ttm", 4),
        exact_quarter_lag(result, "is_n_income_attr_p_ttm", 4),
    )
    return result.drop(columns=["_quarter_index", "_quarter_number"])


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Derive single-quarter, TTM, and basic A-share fundamental factors from a PIT panel."
    )
    parser.add_argument("--input", type=Path, required=True, help="PIT panel CSV")
    parser.add_argument("--output", type=Path, required=True, help="Derived-factor CSV")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    panel = pd.read_csv(args.input, dtype={"symbol": str, "quarter": str, "as_of_date": str})
    result = derive_fundamental_factors(panel)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    result.to_csv(args.output, index=False, encoding="utf-8-sig")
    metadata = {
        "input": str(args.input),
        "rows": len(result),
        "single_quarter_fields": [f"{field}_q" for field in FLOW_FIELDS],
        "ttm_fields": [f"{field}_ttm" for field in FLOW_FIELDS],
        "factor_fields": [
            "net_margin_ttm",
            "cash_conversion_ttm",
            "accruals_to_assets_ttm",
            "roa_ttm",
            "asset_turnover_ttm",
            "revenue_ttm_yoy",
            "net_income_ttm_yoy",
        ],
    }
    args.output.with_suffix(".metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Wrote {len(result)} rows to {args.output}")


if __name__ == "__main__":
    main()
