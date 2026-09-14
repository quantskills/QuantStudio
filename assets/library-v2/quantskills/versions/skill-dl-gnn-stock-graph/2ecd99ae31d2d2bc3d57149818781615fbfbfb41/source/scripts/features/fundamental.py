"""Fundamental factors (7 dimensions, quarterly frequency).

Factor list:
  1. pe_ttm            — trailing P/E ratio
  2. pb                — P/B ratio
  3. roe_ttm           — trailing ROE (net_income_ttm / equity)
  4. market_cap        — total market cap (from get_factor)
  5. revenue_growth_yoy — YoY revenue growth
  6. profit_growth_yoy  — YoY net profit growth
  7. debt_ratio         — total liabilities / total assets

All fundamental data is LOW FREQUENCY (quarterly) and must be forward-filled to
daily frequency for mixed-frequency modeling.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

FUNDAMENTAL_FEATURE_NAMES: list[str] = [
    "pe_ttm",
    "pb",
    "roe_ttm",
    "market_cap",
    "revenue_growth_yoy",
    "profit_growth_yoy",
    "debt_ratio",
]
N_FUNDAMENTAL_FEATURES: int = len(FUNDAMENTAL_FEATURE_NAMES)


def compute_fundamental_features(
    factor_df: pd.DataFrame,
    fina_df: pd.DataFrame,
    share_float_df: pd.DataFrame,
) -> pd.DataFrame:
    """Compute per-(symbol, date) fundamental features.

    Args:
        factor_df: from get_factor — provides market_cap daily.
        fina_df: from get_fina_reports — provides balance sheet, income, cashflow.
        share_float_df: from get_share_float — provides total_shares, float_shares.

    Returns:
        DataFrame with columns [symbol, date] + FUNDAMENTAL_FEATURE_NAMES.
        Values are forward-filled from the most recent quarter.
    """
    # --- Daily market_cap from factor ---
    daily = factor_df[["symbol", "date", "market_cap"]].copy()
    daily["date"] = daily["date"].astype(str)
    daily["symbol"] = daily["symbol"].astype(str)
    daily["market_cap"] = pd.to_numeric(daily["market_cap"], errors="coerce")

    # --- Financial reports ---
    if fina_df is None:
        fina_df = pd.DataFrame()
    if share_float_df is None:
        share_float_df = pd.DataFrame()

    if fina_df.empty or "date" not in fina_df.columns or "symbol" not in fina_df.columns:
        daily["pe_ttm"] = np.nan
        daily["pb"] = np.nan
        daily["roe_ttm"] = np.nan
        daily["revenue_growth_yoy"] = np.nan
        daily["profit_growth_yoy"] = np.nan
        daily["debt_ratio"] = np.nan
        return daily[["symbol", "date"] + FUNDAMENTAL_FEATURE_NAMES]

    fina = fina_df.copy()
    fina["date"] = fina["date"].astype(str)
    fina["symbol"] = fina["symbol"].astype(str)

    # Map common column names (panda_data may return Chinese or English names)
    COL_MAP = {
        # Revenue
        "revenue": ["revenue", "operating_revenue", "total_revenue", "营业收入"],
        "total_revenue": ["revenue", "operating_revenue", "total_revenue", "营业收入"],
        # Net profit
        "net_profit": ["net_profit", "net_income", "profit_attributable", "净利润", "归属母公司净利润"],
        # Total assets
        "total_assets": ["total_assets", "总资产"],
        # Total liabilities
        "total_liabilities": ["total_liabilities", "总负债"],
        # Equity
        "total_equity": ["total_equity", "shareholders_equity", "equity", "所有者权益", "股东权益"],
    }

    def _find_col(df: pd.DataFrame, candidates: list[str]) -> str | None:
        for c in candidates:
            if c in df.columns:
                return c
        return None

    # Extract quarterly data
    rev_col = _find_col(fina, COL_MAP["revenue"])
    profit_col = _find_col(fina, COL_MAP["net_profit"])
    asset_col = _find_col(fina, COL_MAP["total_assets"])
    liab_col = _find_col(fina, COL_MAP["total_liabilities"])
    equity_col = _find_col(fina, COL_MAP["total_equity"])

    # Build quarterly panel
    q_cols = ["symbol", "date"]
    for name, col in [("revenue", rev_col), ("net_profit", profit_col),
                       ("total_assets", asset_col), ("total_liabilities", liab_col),
                       ("total_equity", equity_col)]:
        if col:
            fina[name] = pd.to_numeric(fina[col], errors="coerce")
            q_cols.append(name)

    quarterly = fina[q_cols].drop_duplicates(subset=["symbol", "date"]).sort_values(["symbol", "date"])

    # --- Merge quarterly into daily by forward-fill ---
    daily = daily.sort_values(["symbol", "date"])
    daily = daily.merge(quarterly, on=["symbol", "date"], how="left")

    # Forward-fill quarterly data within each symbol
    ffill_cols = [c for c in quarterly.columns if c not in ("symbol", "date")]
    daily[ffill_cols] = daily.groupby("symbol")[ffill_cols].ffill()

    # --- Compute ratios ---
    if "total_equity" in daily.columns:
        # ROE TTM = net_profit (last 4Q sum) / equity
        daily["net_profit_4q"] = daily.groupby("symbol")["net_profit"].transform(
            lambda x: x.rolling(4, min_periods=1).sum()
        )
        daily["roe_ttm"] = daily["net_profit_4q"] / daily["total_equity"].where(daily["total_equity"] > 0, np.nan)

    if "total_liabilities" in daily.columns and "total_assets" in daily.columns:
        daily["debt_ratio"] = daily["total_liabilities"] / daily["total_assets"].where(daily["total_assets"] > 0, np.nan)

    if "revenue" in daily.columns:
        daily["revenue_4q"] = daily.groupby("symbol")["revenue"].transform(
            lambda x: x.rolling(4, min_periods=1).sum()
        )
        daily["revenue_4q_lag"] = daily.groupby("symbol")["revenue_4q"].shift(4)
        daily["revenue_growth_yoy"] = daily["revenue_4q"] / daily["revenue_4q_lag"].where(daily["revenue_4q_lag"] > 0, np.nan) - 1.0

    if "net_profit" in daily.columns:
        daily["profit_4q_lag"] = daily.groupby("symbol")["net_profit_4q"].shift(4)
        daily["profit_growth_yoy"] = daily["net_profit_4q"] / daily["profit_4q_lag"].where(daily["profit_4q_lag"] > 0, np.nan) - 1.0

    # PE TTM ≈ market_cap / net_profit_4q
    if "net_profit_4q" in daily.columns and "market_cap" in daily.columns:
        daily["pe_ttm"] = daily["market_cap"] / daily["net_profit_4q"].where(daily["net_profit_4q"] > 0, np.nan)

    # PB ≈ market_cap / total_equity
    if "total_equity" in daily.columns and "market_cap" in daily.columns:
        daily["pb"] = daily["market_cap"] / daily["total_equity"].where(daily["total_equity"] > 0, np.nan)

    # --- Mark non-report dates as NaN for non-daily features ---
    # (pe_ttm, pb, roe_ttm, growth rates only update on report dates; daily market_cap is valid daily)
    # We keep forward-filled values — this is correct for "latest available data".

    # Ensure all FUNDAMENTAL_FEATURE_NAMES columns exist
    for c in FUNDAMENTAL_FEATURE_NAMES:
        if c not in daily.columns:
            daily[c] = np.nan

    return daily[["symbol", "date"] + FUNDAMENTAL_FEATURE_NAMES].reset_index(drop=True)
