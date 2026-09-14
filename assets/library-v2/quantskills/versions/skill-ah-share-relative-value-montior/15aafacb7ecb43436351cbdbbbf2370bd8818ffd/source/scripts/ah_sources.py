#!/usr/bin/env python3
"""Shared data access helpers for the A/H relative value skill."""

from __future__ import annotations

import csv
import json
import os
import sys
import time
import urllib.request
from datetime import date, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable

import pandas as pd

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from ah_lookup import resolve_best_match


ROOT = SCRIPT_DIR.parents[0]

HKMA_FX_URL = (
    "https://api.hkma.gov.hk/public/market-data-and-statistics/"
    "monthly-statistical-bulletin/er-ir/er-eeri-daily"
)

def _load_optional_env_files() -> None:
    for candidate in (ROOT / ".env", ROOT / ".env.local"):
        if not candidate.exists():
            continue
        try:
            for raw_line in candidate.read_text(encoding="utf-8-sig").splitlines():
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip("'").strip('"')
                if key and key not in os.environ:
                    os.environ[key] = value
        except Exception:
            continue


def _panda_service_root() -> str:
    base = (
        os.getenv("PANDA_DATA_BASE_URL")
        or os.getenv("JAVA_SERVICE_BASE_URL")
        or os.getenv("HTTP_SERVICE_BASE_URL")
        or "http://pandadata.pandaaiquant.com"
    )
    base = base.rstrip("/")
    if base.endswith("/pandaData"):
        base = base[: -len("/pandaData")]
    return base


@lru_cache(maxsize=1)
def load_panda_sdk():
    """Return the panda_data module after initializing auth."""
    _load_optional_env_files()
    import panda_data

    username = os.getenv("PANDA_DATA_USERNAME") or os.getenv("DEFAULT_USERNAME") or ""
    password = os.getenv("PANDA_DATA_PASSWORD") or os.getenv("DEFAULT_PASSWORD") or ""
    if not username or not password:
        raise RuntimeError(
            "PandaData authentication is required. Set PANDA_DATA_USERNAME / PANDA_DATA_PASSWORD "
            "in the environment or a local .env."
        )

    base_url = (
        os.getenv("PANDA_DATA_BASE_URL")
        or os.getenv("JAVA_SERVICE_BASE_URL")
        or os.getenv("HTTP_SERVICE_BASE_URL")
    )
    if base_url:
        panda_data.init_token(username=username, password=password, base_url=base_url.rstrip("/"))
    else:
        panda_data.init_token(username=username, password=password)
    return panda_data


def _pair_universe_candidates() -> list[Path]:
    return [
        ROOT / "references" / "pair_universe.csv",
        ROOT / "data" / "ah_pairs.csv",
    ]


def load_pair_universe() -> list[dict[str, Any]]:
    for candidate in _pair_universe_candidates():
        if not candidate.exists():
            continue
        with candidate.open(newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            rows: list[dict[str, Any]] = []
            for raw in reader:
                company = str(raw.get("company", "") or raw.get("名称", "")).strip()
                a_code = str(raw.get("a_code", "") or raw.get("A股代码", "")).strip()
                h_code = str(raw.get("h_code", "") or raw.get("H股代码", "")).strip()
                if not company or not a_code or not h_code:
                    continue
                row = dict(raw)
                row["company"] = company
                row["a_code"] = a_code
                row["h_code"] = h_code
                row["名称"] = company
                row["A股代码"] = a_code
                row["H股代码"] = h_code
                rows.append(row)
            if rows:
                return rows
    raise FileNotFoundError("找不到 A/H 配对基准文件；需要 references/pair_universe.csv 或 data/ah_pairs.csv")


def resolve_pair(query: str, rows: list[dict[str, Any]] | None = None, limit: int = 5):
    universe = rows if rows is not None else load_pair_universe()
    return resolve_best_match(query, universe, limit=limit)


def normalize_hk_code(code: str) -> str:
    text = str(code or "").strip()
    if not text:
        return text
    if text.upper().endswith(".HK"):
        text = text[:-3]
    digits = "".join(ch for ch in text if ch.isdigit())
    return digits.zfill(5)


def normalize_hk_symbol(code: str) -> str:
    digits = normalize_hk_code(code).lstrip("0") or "0"
    return f"{digits}.HK"


def hk_code_key(code: str) -> str:
    digits = normalize_hk_code(code).lstrip("0")
    return digits or "0"


def normalize_a_code(code: str) -> str:
    text = str(code or "").strip()
    if not text:
        return text
    upper = text.upper()
    if upper.endswith(".SH") or upper.endswith(".SZ"):
        return upper
    digits = text.zfill(6)
    if digits.startswith(("5", "6", "9", "688", "689")):
        return f"{digits}.SH"
    return f"{digits}.SZ"


def _read_json(url: str) -> dict[str, Any]:
    with urllib.request.urlopen(url, timeout=30) as req:
        payload = json.loads(req.read().decode("utf-8"))
    if isinstance(payload, dict):
        return payload
    raise ValueError("HKMA FX response is not a JSON object")


def _extract_records(payload: dict[str, Any]) -> list[dict[str, Any]]:
    result = payload.get("result") if isinstance(payload.get("result"), dict) else payload
    if not isinstance(result, dict):
        return []
    for key in ("records", "data", "datas", "items"):
        value = result.get(key)
        if isinstance(value, list):
            return [row for row in value if isinstance(row, dict)]
        if isinstance(value, dict):
            for nested_key in ("records", "data", "items"):
                nested = value.get(nested_key)
                if isinstance(nested, list):
                    return [row for row in nested if isinstance(row, dict)]
    return []


def _extract_total_size(payload: dict[str, Any]) -> int | None:
    result = payload.get("result") if isinstance(payload.get("result"), dict) else payload
    if not isinstance(result, dict):
        return None
    value = result.get("datasize")
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


@lru_cache(maxsize=1)
def load_hkma_fx_frame() -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        payload = _read_json(f"{HKMA_FX_URL}?offset={offset}")
        batch = _extract_records(payload)
        if not batch:
            break
        rows.extend(batch)
        total = _extract_total_size(payload)
        if total is not None and len(rows) >= total:
            break
        offset += len(batch)
    if not rows:
        raise RuntimeError("HKMA FX API did not return any records")
    frame = pd.DataFrame.from_records(rows)
    if "end_of_day" not in frame.columns or "cny" not in frame.columns:
        raise RuntimeError(f"HKMA FX API response missing expected columns: {list(frame.columns)}")
    frame = frame.copy()
    frame["end_of_day"] = pd.to_datetime(frame["end_of_day"], errors="coerce")
    frame["cny"] = pd.to_numeric(frame["cny"], errors="coerce")
    frame = frame.dropna(subset=["end_of_day", "cny"]).sort_values("end_of_day").reset_index(drop=True)
    frame["fx_hkd_cny"] = 1.0 / frame["cny"]
    frame["fx_source_date"] = frame["end_of_day"].dt.strftime("%Y-%m-%d")
    return frame


def latest_hkd_cny() -> tuple[float, str, float]:
    frame = load_hkma_fx_frame()
    row = frame.iloc[-1]
    return float(row["fx_hkd_cny"]), str(row["fx_source_date"]), float(row["cny"])


def hkd_cny_history(start_date: str, end_date: str) -> pd.DataFrame:
    frame = load_hkma_fx_frame().copy()
    start = pd.to_datetime(start_date, errors="raise")
    end = pd.to_datetime(end_date, errors="raise")
    frame = frame[(frame["end_of_day"] >= start) & (frame["end_of_day"] <= end)].copy()
    frame["date"] = frame["end_of_day"].dt.strftime("%Y-%m-%d")
    return frame[["date", "fx_source_date", "fx_hkd_cny", "cny"]].rename(columns={"cny": "fx_quote_hkd_per_cny"})


def _date_window(end: datetime | date | None = None, days: int = 14) -> tuple[str, str]:
    end_dt = pd.Timestamp(end or date.today()).normalize()
    start_dt = end_dt - pd.Timedelta(days=days)
    return start_dt.strftime("%Y%m%d"), end_dt.strftime("%Y%m%d")


def _latest_trade_date(client: Any) -> str:
    try:
        if hasattr(client, "get_last_trade_date"):
            value = client.get_last_trade_date(exchange="SH")
            if value:
                return str(value)
    except Exception:
        pass
    return datetime.now().strftime("%Y%m%d")


def _current_window(client: Any, lookback_days: int) -> tuple[str, str]:
    end = _latest_trade_date(client)
    if lookback_days <= 0:
        return end, end
    return _date_window(pd.to_datetime(end), days=lookback_days)


def _panda_call(client: Any, method_name: str, **kwargs: Any) -> pd.DataFrame:
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            result = getattr(client, method_name)(**kwargs)
            if result is None or not isinstance(result, pd.DataFrame):
                raise RuntimeError(f"PandaData {method_name} returned an invalid response")
            return result
        except Exception as exc:
            last_error = exc
            if attempt < 2:
                time.sleep(1 << attempt)
    raise RuntimeError(f"PandaData {method_name} failed: {type(last_error).__name__}: {last_error}") from last_error


def _pick_column(frame: pd.DataFrame, names: Iterable[str]) -> str:
    for name in names:
        if name in frame.columns:
            return name
    raise KeyError(f"missing expected columns {list(names)}; available={list(frame.columns)}")


def _latest_rows(frame: pd.DataFrame, *, symbol_col: str = "symbol") -> pd.DataFrame:
    if frame.empty:
        return frame
    date_col = _pick_column(frame, ("date", "datetime", "trade_date"))
    out = frame.copy()
    out[date_col] = pd.to_datetime(out[date_col], errors="coerce")
    out = out.dropna(subset=[date_col])
    out = out.sort_values([symbol_col, date_col]).drop_duplicates(subset=[symbol_col], keep="last")
    return out.reset_index(drop=True)


def _coerce_float(value: Any) -> float:
    return float(pd.to_numeric(pd.Series([value]), errors="coerce").iloc[0])


def _normalize_ymd(value: str) -> str:
    return pd.to_datetime(value, errors="raise").strftime("%Y%m%d")


def fetch_current_snapshot_rows(company: str | None = None, *, lookback_days: int = 0) -> tuple[list[dict[str, Any]], list[str]]:
    universe = load_pair_universe()
    if company:
        best, _ = resolve_pair(company, universe)
        universe = [row for row in universe if row["company"] == best.company and row["a_code"] == best.a_code and row["h_code"] == best.h_code]

    sdk = load_panda_sdk()
    start, end = _current_window(sdk, lookback_days)
    a_codes = sorted({normalize_a_code(row["a_code"]) for row in universe if str(row.get("a_code", "")).strip()})
    h_codes = sorted({normalize_hk_symbol(row["h_code"]) for row in universe if str(row.get("h_code", "")).strip()})

    if not a_codes or not h_codes:
        raise RuntimeError("pair universe is empty")

    a_symbols: list[str] = a_codes if company else []
    h_symbols: list[str] = h_codes if company else []
    fields = ["symbol", "date", "close"]
    a_frame = _panda_call(
        sdk,
        "get_stock_daily",
        symbol=a_symbols,
        start_date=start,
        end_date=end,
        fields=fields,
    )
    h_frame = _panda_call(
        sdk,
        "get_hk_daily",
        symbol=h_symbols,
        start_date=start,
        end_date=end,
        fields=fields,
    )
    a_latest = _latest_rows(a_frame)
    h_latest = _latest_rows(h_frame)

    a_code_col = _pick_column(a_latest, ("symbol",))
    h_code_col = _pick_column(h_latest, ("symbol",))
    a_date_col = _pick_column(a_latest, ("date", "datetime", "trade_date"))
    h_date_col = _pick_column(h_latest, ("date", "datetime", "trade_date"))

    a_price_col = _pick_column(a_latest, ("close", "收盘", "收盤", "latest", "last"))
    h_price_col = _pick_column(h_latest, ("close", "收盘", "收盤", "latest", "last"))

    a_lookup = {
        normalize_a_code(row[a_code_col]): row
        for _, row in a_latest.iterrows()
        if str(row.get(a_code_col, "")).strip()
    }
    h_lookup = {
        hk_code_key(row[h_code_col]): row
        for _, row in h_latest.iterrows()
        if str(row.get(h_code_col, "")).strip()
    }

    try:
        fx_rate, fx_date, fx_quote = latest_hkd_cny()
    except Exception as exc:
        raise RuntimeError(f"HKMA FX request failed: {type(exc).__name__}: {exc}") from exc
    rows: list[dict[str, Any]] = []
    warnings: list[str] = []
    for row in universe:
        a_row = a_lookup.get(normalize_a_code(str(row["a_code"])))
        h_row = h_lookup.get(hk_code_key(row["h_code"]))
        if a_row is None or h_row is None:
            warnings.append(f"skip {row['company']}: missing A/H quote in PandaData")
            continue

        a_price = _coerce_float(a_row[a_price_col])
        h_price = _coerce_float(h_row[h_price_col])
        if pd.isna(a_price) or pd.isna(h_price):
            warnings.append(f"skip {row['company']}: invalid A/H close in PandaData")
            continue

        rows.append(
            {
                "company": row["company"],
                "h_code": normalize_hk_code(str(row["h_code"])),
                "h_price_hkd": h_price,
                "h_date": pd.Timestamp(h_row[h_date_col]).strftime("%Y-%m-%d"),
                "a_code": str(row["a_code"]),
                "a_price_cny": a_price,
                "a_date": pd.Timestamp(a_row[a_date_col]).strftime("%Y-%m-%d"),
                "fx_hkd_cny": fx_rate,
                "fx_source_date": fx_date,
                "fx_quote_hkd_per_cny": fx_quote,
                "quote_note": "PandaData daily closes; FX from HKMA end-of-day data",
            }
        )
    return rows, warnings


def fetch_history_rows(
    *,
    company: str | None = None,
    a_code: str | None = None,
    h_code: str | None = None,
    start_date: str,
    end_date: str,
    max_fx_stale_days: int = 3,
) -> tuple[pd.DataFrame, list[str]]:
    universe = load_pair_universe()
    query = company or a_code or h_code
    if query and (not company or not a_code or not h_code):
        best, _ = resolve_pair(query, universe)
        company = company or best.company
        a_code = a_code or best.a_code
        h_code = h_code or best.h_code
    if not company or not a_code or not h_code:
        raise SystemExit("provide --company or both --a-code and --h-code")

    sdk = load_panda_sdk()
    start = _normalize_ymd(start_date)
    end = _normalize_ymd(end_date)
    a_frame = sdk.get_stock_daily(
        symbol=[normalize_a_code(str(a_code))],
        start_date=start,
        end_date=end,
    )
    h_frame = sdk.get_hk_daily(
        symbol=[normalize_hk_symbol(str(h_code))],
        start_date=start,
        end_date=end,
    )

    a_date_col = _pick_column(a_frame, ("date", "datetime", "trade_date"))
    h_date_col = _pick_column(h_frame, ("date", "datetime", "trade_date"))
    a_close_col = _pick_column(a_frame, ("close", "收盘", "收盤", "latest", "last"))
    h_close_col = _pick_column(h_frame, ("close", "收盘", "收盤", "latest", "last"))
    a_vol_col = next((c for c in ("volume", "vol") if c in a_frame.columns), None)
    h_vol_col = next((c for c in ("volume", "vol") if c in h_frame.columns), None)

    a = a_frame[[c for c in [a_date_col, a_close_col, a_vol_col] if c is not None]].copy()
    a[a_date_col] = pd.to_datetime(a[a_date_col], errors="coerce")
    a = a.dropna(subset=[a_date_col, a_close_col]).rename(columns={a_date_col: "date", a_close_col: "a_price_cny"})
    if a_vol_col:
        a = a.rename(columns={a_vol_col: "a_volume"})

    h = h_frame[[c for c in [h_date_col, h_close_col, h_vol_col] if c is not None]].copy()
    h[h_date_col] = pd.to_datetime(h[h_date_col], errors="coerce")
    h = h.dropna(subset=[h_date_col, h_close_col]).rename(columns={h_date_col: "date", h_close_col: "h_price_hkd"})
    if h_vol_col:
        h = h.rename(columns={h_vol_col: "h_volume"})

    a["date"] = pd.to_datetime(a["date"], errors="coerce").dt.normalize().astype("datetime64[ns]")
    h["date"] = pd.to_datetime(h["date"], errors="coerce").dt.normalize().astype("datetime64[ns]")
    prices = a.merge(h, on="date", how="inner").sort_values("date").reset_index(drop=True)
    if prices.empty:
        raise RuntimeError("no aligned A/H trading dates returned by PandaData")

    fx = hkd_cny_history(start, end)
    fx["date"] = pd.to_datetime(fx["date"], errors="coerce").dt.normalize().astype("datetime64[ns]")
    fx = fx.dropna(subset=["date", "fx_hkd_cny"]).sort_values("date").reset_index(drop=True)
    merged = pd.merge_asof(
        prices.sort_values("date"),
        fx[["date", "fx_source_date", "fx_hkd_cny"]],
        on="date",
        direction="backward",
    )
    merged["fx_stale_days"] = (merged["date"] - pd.to_datetime(merged["fx_source_date"], errors="coerce")).dt.days
    merged = merged[(merged["fx_stale_days"] >= 0) & (merged["fx_stale_days"] <= max_fx_stale_days)]
    merged = merged.dropna(subset=["a_price_cny", "h_price_hkd", "fx_hkd_cny"])
    merged["date"] = merged["date"].dt.strftime("%Y-%m-%d")
    merged["fx_source_date"] = pd.to_datetime(merged["fx_source_date"], errors="coerce").dt.strftime("%Y-%m-%d")
    merged["company"] = company
    merged["a_code"] = str(a_code)
    merged["h_code"] = normalize_hk_code(str(h_code))
    cols = [
        c
        for c in [
            "company",
            "a_code",
            "h_code",
            "date",
            "a_price_cny",
            "h_price_hkd",
            "fx_hkd_cny",
            "fx_source_date",
            "fx_stale_days",
            "a_volume",
            "h_volume",
        ]
        if c in merged.columns
    ]
    return merged[cols].reset_index(drop=True), []
