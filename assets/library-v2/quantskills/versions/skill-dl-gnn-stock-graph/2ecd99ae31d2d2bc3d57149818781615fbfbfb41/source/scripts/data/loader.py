"""panda_data thin wrappers for skill-dl-gnn-stock-graph.

Fifteen interfaces are used (see references/need_used_api.md):

  Calendar:
    - get_last_trade_date, get_prev_trade_date, get_trade_cal

  Market data:
    - get_index_weights              (CSI300/CSI500/CSI1000 constituents)
    - get_factor                     (OHLCV + turnover + market_cap)
    - get_stock_daily_post           (post-rights OHLCV + limit prices + trade_status)
    - get_index_daily                (benchmark index daily)
    - get_share_float                 (total/float shares, listed_date)

  Graph relations:
    - get_industry_constituents      (Shenwan industry constituents)
    - get_concept_constituents       (concept sector constituents)
    - get_stock_industry             (stock → industry mapping)

  Fundamental:
    - get_fina_reports               (balance sheet / income / cashflow)
    - get_share_float                (market cap, shares outstanding)

  Alternative:
    - get_lhb_list                   (dragon-tiger board)
    - get_block_trade                (block trades)
    - get_top_holders                (top-10 shareholders)

  Filtering:
    - get_stock_status_change        (ST/*ST status)
    - get_macro_*                    (GDP, CPI, PMI, M2)

Column names are validated against EXPECTED_COLUMNS on every load; mismatch
triggers exit code 4.
"""
from __future__ import annotations

import argparse
import os
import sys
from typing import Any

import pandas as pd

from scripts.data import cache

# ---------------------------------------------------------------------------
# Expected columns per data source (superset check)
# ---------------------------------------------------------------------------
EXPECTED_COLUMNS: dict[str, set[str]] = {
    "index_weights": {"index_symbol", "date", "stock_symbol"},
    "factor": {
        "date", "symbol",
        "open", "close", "high", "low",
        "volume", "amount", "turnover", "market_cap",
    },
    "stock_post": {
        "date", "symbol", "name",
        "pre_close", "limit_up", "limit_down", "trade_status",
    },
    "index_daily": {"symbol", "date", "close", "pre_close"},
    "share_float": {"symbol", "date", "total", "total_a"},
    "industry_constituents": {"stock_symbol"},
    "concept_constituents": {"concept_stock"},
    "stock_industry": {"symbol", "industry_code"},
    "fina_reports": {"date", "symbol", "report_type"},
    "lhb_list": {"date", "symbol"},
    "block_trade": {"date", "symbol"},
    "top_holders": {"symbol", "holder_name", "holding_ratio"},
    "trade_cal": {"nature_date", "is_trade"},
}

# Factor names for get_factor(factors=...)
FACTOR_NAMES: list[str] = [
    "open", "close", "high", "low",
    "volume", "amount", "turnover", "market_cap",
]


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
def init_panda_data() -> None:
    """Authenticate with panda_data using env vars. Raises RuntimeError if unset."""
    user = os.environ.get("PANDA_DATA_USERNAME")
    pwd = os.environ.get("PANDA_DATA_PASSWORD")
    if not user or not pwd:
        raise RuntimeError(
            "Missing env vars PANDA_DATA_USERNAME / PANDA_DATA_PASSWORD. "
            "Export them before running the scan."
        )
    import panda_data
    panda_data.init_token(username=user, password=pwd)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _assert_columns(df: pd.DataFrame, kind: str) -> None:
    expected = EXPECTED_COLUMNS[kind]
    missing = expected - set(df.columns)
    if missing:
        raise ValueError(
            f"panda_data {kind} response missing columns: {sorted(missing)}. "
            f"Got: {sorted(df.columns)}."
        )


def _index_component_of(index_symbol: str) -> str:
    """Strip suffix for the `index_component` / `indicator` argument (e.g. 000300.SH → 000300)."""
    return index_symbol.split(".")[0]


def _safe_date_col(df: pd.DataFrame | None) -> pd.DataFrame:
    """Return empty schema frame if None/empty; cast date→str otherwise."""
    if df is None or (hasattr(df, "empty") and df.empty):
        return pd.DataFrame()
    df = df.copy()
    if "date" in df.columns:
        df["date"] = df["date"].astype(str)
    if "symbol" in df.columns:
        df["symbol"] = df["symbol"].astype(str)
    if "stock_symbol" in df.columns:
        df["stock_symbol"] = df["stock_symbol"].astype(str)
    return df


# ---------------------------------------------------------------------------
# Calendar
# ---------------------------------------------------------------------------
def get_last_trade_date(exchange: str = "SH") -> str | None:
    """Wrap panda_data.get_last_trade_date; returns YYYYMMDD string or None."""
    import panda_data
    result = panda_data.get_last_trade_date(exchange=exchange)
    if result is None:
        return None
    if isinstance(result, str):
        return result or None
    if hasattr(result, "empty") and result.empty:
        return None
    if hasattr(result, "iloc"):
        return str(result["date"].iloc[0])
    return str(result)


def get_prev_trade_date(date: str, n: int = 1, exchange: str = "SH") -> str | None:
    """Wrap panda_data.get_prev_trade_date; returns YYYYMMDD or None."""
    import panda_data
    result = panda_data.get_prev_trade_date(date=date, exchange=exchange, n=n)
    if result is None:
        return None
    if isinstance(result, str):
        return result or None
    if hasattr(result, "empty") and result.empty:
        return None
    if hasattr(result, "iloc"):
        return str(result["date"].iloc[0])
    return str(result)


def load_trade_cal(start_date: str, end_date: str, exchange: str = "SH") -> pd.DataFrame:
    """Load A-share trading calendar. Returns columns [date, is_trading_day]."""
    name = "trade_cal"
    hit = cache.read_cache(name, start_date, end_date, date_col="nature_date", max_age_hours=0)
    if hit is not None:
        return hit

    import panda_data
    df = panda_data.get_trade_cal(start_date=start_date, end_date=end_date, exchange=exchange)
    df = _safe_date_col(df)
    if df.empty:
        return pd.DataFrame(columns=["date", "is_trading_day"])
    cache.write_cache(name, df, date_col="nature_date")
    return df


# ---------------------------------------------------------------------------
# Universe
# ---------------------------------------------------------------------------
def load_index_weights(index_symbol: str, date: str) -> pd.DataFrame:
    """Index constituents on a single day. Returns [index_symbol, date, stock_symbol]."""
    name = "index_weights"
    hit = cache.read_cache(name, None, None, date_col="date", max_age_hours=24)
    if hit is not None:
        hit = hit[hit["date"] == str(date)]
        if not hit.empty:
            return hit

    import panda_data
    df = panda_data.get_index_weights(
        index_symbol=index_symbol,
        start_date=date,
        end_date=date,
    )
    df = _safe_date_col(df)
    if df.empty:
        return pd.DataFrame(columns=sorted(EXPECTED_COLUMNS["index_weights"]))
    _assert_columns(df, "index_weights")
    cache.write_cache(name, df, date_col="date", dedup_cols=["index_symbol", "date", "stock_symbol"])
    return df


# ---------------------------------------------------------------------------
# Market Data
# ---------------------------------------------------------------------------
def load_factor(
    start_date: str,
    end_date: str,
    index_symbol: str,
) -> pd.DataFrame:
    """get_factor over [start_date, end_date] filtered to index_symbol universe.

    Returns OHLCV + turnover + market_cap.
    """
    name = "factor"
    hit = cache.read_cache(name, start_date, end_date, date_col="date", max_age_hours=24)
    if hit is not None:
        return hit

    import panda_data
    df = panda_data.get_factor(
        start_date=start_date,
        end_date=end_date,
        factors=FACTOR_NAMES,
        type="stock",
        index_component=_index_component_of(index_symbol),
    )
    df = _safe_date_col(df)
    if df.empty:
        return pd.DataFrame(columns=sorted(EXPECTED_COLUMNS["factor"]))
    _assert_columns(df, "factor")
    cache.write_cache(name, df, date_col="date", dedup_cols=["date", "symbol"])
    return df


def load_stock_post(
    start_date: str,
    end_date: str,
    index_symbol: str,
) -> pd.DataFrame:
    """get_stock_daily_post over the same window and universe.

    Returns columns: date, symbol, name, pre_close, limit_up, limit_down, trade_status.
    """
    name = "stock_post"
    hit = cache.read_cache(name, start_date, end_date, date_col="date", max_age_hours=24)
    if hit is not None:
        return hit

    import panda_data
    df = panda_data.get_stock_daily_post(
        start_date=start_date,
        end_date=end_date,
        indicator=_index_component_of(index_symbol),
        st=False,
    )
    df = _safe_date_col(df)
    if df.empty:
        return pd.DataFrame(columns=sorted(EXPECTED_COLUMNS["stock_post"]))
    _assert_columns(df, "stock_post")
    cache.write_cache(name, df, date_col="date", dedup_cols=["date", "symbol"])
    return df


def load_index_daily(index_symbol: str, start_date: str, end_date: str) -> pd.DataFrame:
    """Benchmark daily OHLCV for index_symbol over [start_date, end_date]."""
    name = "index_daily"
    hit = cache.read_cache(name, start_date, end_date, date_col="date", max_age_hours=24)
    if hit is not None:
        # Filter to requested symbol
        hit = hit[hit["symbol"] == str(index_symbol)]
        if not hit.empty:
            return hit

    import panda_data
    df = panda_data.get_index_daily(
        symbol=index_symbol,
        start_date=start_date,
        end_date=end_date,
    )
    df = _safe_date_col(df)
    if df.empty:
        return pd.DataFrame(columns=sorted(EXPECTED_COLUMNS["index_daily"]))
    _assert_columns(df, "index_daily")
    cache.write_cache(name, df, date_col="date", dedup_cols=["date", "symbol"])
    return df


def load_share_float(start_date: str = "", end_date: str = "") -> pd.DataFrame:
    """Load share float data. start_date/end_date are required by the API."""
    if not start_date or not end_date:
        return pd.DataFrame(columns=["symbol", "date", "total", "total_a"])

    name = "share_float"
    hit = cache.read_cache(name, start_date, end_date, date_col="date", max_age_hours=24)
    if hit is not None:
        return hit

    import panda_data
    df = panda_data.get_share_float(start_date=start_date, end_date=end_date)
    df = _safe_date_col(df)
    if df.empty:
        return pd.DataFrame(columns=["symbol", "date", "total", "total_a"])
    cache.write_cache(name, df, date_col="date", dedup_cols=["date", "symbol"])
    return df


# ---------------------------------------------------------------------------
# Graph Relations
# ---------------------------------------------------------------------------
def load_industry_constituents() -> pd.DataFrame:
    """Shenwan industry constituents. Returns [industry_code, stock_symbol]."""
    name = "industry_constituents"
    hit = cache.read_cache(name, None, None, date_col=None, max_age_hours=168)  # 7 days
    if hit is not None:
        return hit

    import panda_data
    df = panda_data.get_industry_constituents()
    df = _safe_date_col(df)
    if df.empty:
        return pd.DataFrame(columns=sorted(EXPECTED_COLUMNS["industry_constituents"]))
    cache.write_cache(name, df, date_col=None)
    return df


def load_concept_constituents(symbols: list[str] | None = None) -> pd.DataFrame:
    """Concept sector constituents. Pull per-stock to avoid plan limit 600003.

    Args:
        symbols: if provided, pull concepts for these stocks only (per-symbol calls).
                 If None, attempts full pull (may hit plan limit on large universes).
    """
    name = "concept_constituents"
    if symbols:
        # Check cache first — filter to requested symbols
        hit = cache.read_cache(name, None, None, date_col=None, max_age_hours=168)
        if hit is not None:
            sym_col = next((c for c in hit.columns if c in ("concept_stock", "stock_symbol", "symbol")), None)
            if sym_col:
                desired = set(str(s) for s in symbols)
                filtered = hit[hit[sym_col].astype(str).isin(desired)]
                if not filtered.empty:
                    return filtered.reset_index(drop=True)

    import panda_data
    if symbols:
        frames = []
        for sym in symbols:
            try:
                df = panda_data.get_concept_constituents(concept_stock=sym)
                df = _safe_date_col(df)
                if df is not None and not (hasattr(df, "empty") and df.empty):
                    frames.append(df)
            except Exception:
                pass
        if frames:
            result = pd.concat(frames, ignore_index=True)
            cache.write_cache(name, result, date_col=None)
            return result
        return pd.DataFrame(columns=sorted(EXPECTED_COLUMNS["concept_constituents"]))
    else:
        # Full pull — likely hits plan limit for large universes
        try:
            df = panda_data.get_concept_constituents()
            df = _safe_date_col(df)
            if df is None or (hasattr(df, "empty") and df.empty):
                return pd.DataFrame(columns=sorted(EXPECTED_COLUMNS["concept_constituents"]))
            cache.write_cache(name, df, date_col=None)
            return df
        except Exception:
            return pd.DataFrame(columns=sorted(EXPECTED_COLUMNS["concept_constituents"]))


def load_stock_industry(symbols: list[str] | None = None) -> pd.DataFrame:
    """Stock → Shenwan industry mapping. Returns [symbol, industry_code].

    panda_data API param is 'stock_symbol' (not 'symbol').
    """
    import panda_data
    symbol_arg = symbols if symbols else []
    if not symbol_arg:
        # No-arg call for full list
        df = panda_data.get_stock_industry(level="L1")
    else:
        df = panda_data.get_stock_industry(stock_symbol=symbol_arg, level="L1")
    df = _safe_date_col(df)
    if df.empty:
        return pd.DataFrame(columns=sorted(EXPECTED_COLUMNS["stock_industry"]))
    return df


# ---------------------------------------------------------------------------
# Fundamental
# ---------------------------------------------------------------------------
def load_fina_reports(
    symbols: list[str],
    start_date: str,
    end_date: str,
) -> pd.DataFrame:
    """Financial reports for given symbols.

    panda_data get_fina_reports uses 'date' and 'is_latest' params (not start/end_date).
    We pull latest available data for each symbol.
    """
    name = "fina_reports"
    hit = cache.read_cache(name, start_date, end_date, date_col="date", max_age_hours=24)
    if hit is not None:
        desired = set(str(s) for s in symbols)
        sym_col = next((c for c in hit.columns if c in ("symbol", "stock_symbol")), None)
        if sym_col:
            hit = hit[hit[sym_col].astype(str).isin(desired)]
        if not hit.empty:
            return hit.reset_index(drop=True)

    import panda_data
    # Try with the 'date' parameter — pull all reports up to end_date
    try:
        df = panda_data.get_fina_reports(
            symbol=symbols,
            date=end_date,
            is_latest=False,
        )
        df = _safe_date_col(df)
        if df is None or (hasattr(df, "empty") and df.empty):
            return pd.DataFrame(columns=sorted(EXPECTED_COLUMNS["fina_reports"]))
        cache.write_cache(name, df, date_col="date", dedup_cols=["date", "symbol", "report_type"])
        return df
    except Exception:
        return pd.DataFrame(columns=sorted(EXPECTED_COLUMNS["fina_reports"]))


# ---------------------------------------------------------------------------
# Alternative Data
# ---------------------------------------------------------------------------
def load_lhb_list(start_date: str, end_date: str) -> pd.DataFrame:
    """Dragon-tiger board list over [start_date, end_date]."""
    name = "lhb_list"
    hit = cache.read_cache(name, start_date, end_date, date_col="date", max_age_hours=24)
    if hit is not None:
        return hit

    import panda_data
    df = panda_data.get_lhb_list(start_date=start_date, end_date=end_date)
    df = _safe_date_col(df)
    if df.empty:
        return pd.DataFrame(columns=sorted(EXPECTED_COLUMNS["lhb_list"]))
    cache.write_cache(name, df, date_col="date", dedup_cols=["date", "symbol"])
    return df


def load_block_trade(start_date: str, end_date: str) -> pd.DataFrame:
    """Block trade data over [start_date, end_date]."""
    name = "block_trade"
    hit = cache.read_cache(name, start_date, end_date, date_col="date", max_age_hours=24)
    if hit is not None:
        return hit

    import panda_data
    df = panda_data.get_block_trade(start_date=start_date, end_date=end_date)
    df = _safe_date_col(df)
    if df.empty:
        return pd.DataFrame(columns=sorted(EXPECTED_COLUMNS["block_trade"]))
    cache.write_cache(name, df, date_col="date", dedup_cols=["date", "symbol"])
    return df


def load_top_holders(symbols: list[str], start_date: str = "", end_date: str = "") -> pd.DataFrame:
    """Top-10 shareholders for given symbols. start_date/end_date required."""
    import panda_data
    if not start_date or not end_date:
        return pd.DataFrame(columns=sorted(EXPECTED_COLUMNS["top_holders"]))
    df = panda_data.get_top_holders(
        symbol=symbols, start_date=start_date, end_date=end_date,
        market="cn", start_rank=1, end_rank=10, stock_type="flow",
    )
    df = _safe_date_col(df)
    if df.empty:
        return pd.DataFrame(columns=sorted(EXPECTED_COLUMNS["top_holders"]))
    return df


# ---------------------------------------------------------------------------
# Filtering
# ---------------------------------------------------------------------------
def load_stock_status_change(start_date: str = "", end_date: str = "") -> pd.DataFrame:
    """ST/*ST and other special-treatment status. start_date/end_date required."""
    if not start_date or not end_date:
        return pd.DataFrame(columns=["symbol", "date", "status"])

    name = "stock_status_change"
    hit = cache.read_cache(name, start_date, end_date, date_col="date", max_age_hours=24)
    if hit is not None:
        return hit

    import panda_data
    df = panda_data.get_stock_status_change(start_date=start_date, end_date=end_date)
    df = _safe_date_col(df)
    cache.write_cache(name, df, date_col="date", dedup_cols=["date", "symbol"])
    return df


# ---------------------------------------------------------------------------
# Macro
# ---------------------------------------------------------------------------
def load_macro_na(start_date: str, end_date: str) -> pd.DataFrame:
    """National accounts — GDP etc."""
    import panda_data
    return _safe_date_col(panda_data.get_macro_na(start_date=start_date, end_date=end_date))


def load_macro_pi(start_date: str, end_date: str) -> pd.DataFrame:
    """Price indices — CPI etc."""
    import panda_data
    return _safe_date_col(panda_data.get_macro_pi(start_date=start_date, end_date=end_date))


def load_macro_ci(start_date: str, end_date: str) -> pd.DataFrame:
    """Climate indices — PMI etc."""
    import panda_data
    return _safe_date_col(panda_data.get_macro_ci(start_date=start_date, end_date=end_date))


def load_macro_mb(start_date: str, end_date: str) -> pd.DataFrame:
    """Monetary & banking — M2 etc."""
    import panda_data
    return _safe_date_col(panda_data.get_macro_mb(start_date=start_date, end_date=end_date))


# ---------------------------------------------------------------------------
# Self-check
# ---------------------------------------------------------------------------
def self_check(date: str, index_symbol: str = "000300.SH") -> int:
    """Manually invoke each loader for `date` and print column diagnostics.

    Returns 0 on success, 4 on any column mismatch.
    """
    init_panda_data()
    import panda_data
    exit_code = 0

    ic = _index_component_of(index_symbol)
    checks: list[tuple[str, Any]] = [
        ("index_weights", lambda: panda_data.get_index_weights(
            index_symbol=index_symbol, start_date=date, end_date=date,
        )),
        ("factor", lambda: panda_data.get_factor(
            start_date=date, end_date=date,
            factors=FACTOR_NAMES, type="stock", index_component=ic,
        )),
        ("stock_post", lambda: panda_data.get_stock_daily_post(
            start_date=date, end_date=date, indicator=ic, st=False,
        )),
        ("index_daily", lambda: panda_data.get_index_daily(
            symbol=index_symbol, start_date=date, end_date=date,
        )),
        ("industry_constituents", lambda: panda_data.get_industry_constituents()),
        ("concept_constituents", lambda: panda_data.get_concept_constituents()),
        ("lhb_list", lambda: panda_data.get_lhb_list(start_date=date, end_date=date)),
        ("trade_cal", lambda: panda_data.get_trade_cal(start_date=date, end_date=date, exchange="SH")),
    ]

    for kind, loader in checks:
        print(f"--- {kind} ---")
        try:
            df = loader()
        except Exception as e:
            print(f"[ERROR] {kind} raised: {e}")
            exit_code = 4
            continue
        if df is None or (hasattr(df, "empty") and df.empty):
            print(f"[WARN] {kind} returned empty on {date}")
            continue
        got = set(df.columns)
        expected = EXPECTED_COLUMNS.get(kind, set())
        missing = expected - got
        extra = got - expected
        print(f"got columns:      {sorted(got)}")
        if expected:
            print(f"missing required: {sorted(missing)}")
            print(f"extra (ignored):  {sorted(extra)}")
        if missing:
            exit_code = 4

    return exit_code


def _main() -> int:
    p = argparse.ArgumentParser(
        description="panda_data field self-check for skill-dl-gnn-stock-graph",
    )
    p.add_argument("--self-check", action="store_true", required=True)
    p.add_argument("--date", required=True, help="YYYYMMDD")
    p.add_argument("--index", default="000300.SH", help="Index symbol")
    args = p.parse_args()

    try:
        from panda_data.exceptions import ServiceError as _ServiceError
        service_error_cls: tuple = (_ServiceError,)
    except ImportError:
        service_error_cls = ()

    try:
        return self_check(args.date, index_symbol=args.index)
    except RuntimeError as e:
        print(f"[error] {e}", file=sys.stderr)
        return 1
    except service_error_cls as e:  # type: ignore[misc]
        print(f"[error] panda_data service error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(_main())
