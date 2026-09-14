#!/usr/bin/env python
"""Download real daily market data from Pandadata for report-replication.

The output is normalized for scripts/local_backtest.py and keeps a sidecar
metadata file with provider, symbols, sample period, and adjustment assumptions.
Credentials are loaded from DEFAULT_USERNAME / DEFAULT_PASSWORD /
JAVA_SERVICE_BASE_URL or ~/.pandadata/pandadata.env. Credential values are never
printed or written to project artifacts.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import shlex
import sys
from pathlib import Path
from typing import Any

import pandas as pd


DEFAULT_BASE_URL = "http://pandadata.pandaaiquant.com"
DEFAULT_ENV_FILE = Path.home() / ".pandadata" / "pandadata.env"

METHOD_BY_ASSET_TYPE = {
    "stock": "get_stock_daily",
    "index": "get_index_daily",
    "future": "get_future_daily",
    "hk": "get_hk_daily",
    "us": "get_us_daily",
}

CORE_COLUMNS = ["date", "symbol", "open", "high", "low", "close", "volume", "amount", "pre_close"]


class PandadataDownloadError(RuntimeError):
    """Raised when Pandadata data cannot be downloaded or normalized."""


def parse_env_assignment(line: str) -> tuple[str, str] | None:
    stripped = line.strip()
    if not stripped or stripped.startswith("#"):
        return None

    try:
        parts = shlex.split(stripped, posix=True)
    except ValueError:
        return None
    if not parts:
        return None
    if parts[0] == "export":
        parts = parts[1:]
    if not parts or "=" not in parts[0]:
        return None

    key, value = parts[0].split("=", 1)
    key = key.strip()
    if not key:
        return None
    return key, value


def load_env_file(path: Path, override: bool = False) -> bool:
    if not path.exists():
        return False

    for line in path.read_text(encoding="utf-8").splitlines():
        parsed = parse_env_assignment(line)
        if not parsed:
            continue
        key, value = parsed
        if override or key not in os.environ:
            os.environ[key] = value
    return True


def credentials_from_env() -> tuple[str, str, str]:
    return (
        os.getenv("DEFAULT_USERNAME", ""),
        os.getenv("DEFAULT_PASSWORD", ""),
        os.getenv("JAVA_SERVICE_BASE_URL", DEFAULT_BASE_URL),
    )


def init_pandadata(env_file: Path):
    if sys.version_info < (3, 10):
        raise PandadataDownloadError("panda_data==0.0.9 requires Python 3.10 or newer.")

    try:
        import panda_data  # noqa: PLC0415
    except ModuleNotFoundError as exc:
        if exc.name and exc.name != "panda_data":
            raise PandadataDownloadError(
                f"panda_data runtime dependency is missing: {exc.name}. "
                "Run `python scripts/check_dependencies.py --install` with Python 3.10+ first."
            ) from exc
        raise PandadataDownloadError(
            "panda_data is not installed. Run `python scripts/check_dependencies.py --install` "
            "with Python 3.10+ first."
        ) from exc

    load_env_file(env_file)
    username, password, base_url = credentials_from_env()
    if not username or not password or not base_url:
        raise PandadataDownloadError(
            "Missing Pandadata credentials. Set DEFAULT_USERNAME / DEFAULT_PASSWORD / "
            f"JAVA_SERVICE_BASE_URL or create {env_file} with skill-pandadata-api setup_runtime.py."
        )

    try:
        panda_data.init_token(username=username, password=password, base_url=base_url)
    except Exception as exc:  # pragma: no cover - live SDK exception types vary.
        raise PandadataDownloadError("Pandadata login failed; refresh local credentials and retry.") from exc
    return panda_data, base_url


def parse_api_date(value: str) -> dt.date:
    text = value.strip()
    for fmt in ("%Y%m%d", "%Y-%m-%d"):
        try:
            return dt.datetime.strptime(text, fmt).date()
        except ValueError:
            pass
    raise argparse.ArgumentTypeError(f"invalid date {value!r}; use YYYYMMDD or YYYY-MM-DD")


def api_date(value: dt.date) -> str:
    return value.strftime("%Y%m%d")


def iso_date(value: Any) -> str | None:
    if value is None:
        return None
    parsed = pd.to_datetime(value, errors="coerce")
    if pd.isna(parsed):
        return None
    return parsed.strftime("%Y-%m-%d")


def split_symbols(values: list[str]) -> list[str]:
    symbols: list[str] = []
    for value in values:
        for item in value.split(","):
            item = item.strip()
            if item:
                symbols.append(item)
    seen: set[str] = set()
    unique = []
    for symbol in symbols:
        if symbol not in seen:
            seen.add(symbol)
            unique.append(symbol)
    if not unique:
        raise argparse.ArgumentTypeError("at least one symbol is required")
    return unique


def split_fields(values: list[str] | None) -> list[str]:
    if not values:
        return []
    fields: list[str] = []
    for value in values:
        fields.extend(item.strip() for item in value.split(",") if item.strip())
    return fields


def chunk_ranges(start: dt.date, end: dt.date, max_days: int) -> list[tuple[dt.date, dt.date]]:
    if end < start:
        raise argparse.ArgumentTypeError("end date must be on or after start date")

    ranges = []
    cursor = start
    while cursor <= end:
        chunk_end = min(end, cursor + dt.timedelta(days=max_days - 1))
        ranges.append((cursor, chunk_end))
        cursor = chunk_end + dt.timedelta(days=1)
    return ranges


def result_to_frame(result: Any) -> pd.DataFrame:
    if isinstance(result, pd.DataFrame):
        return result.copy()
    if result is None:
        return pd.DataFrame()
    try:
        return pd.DataFrame(result)
    except Exception as exc:  # pragma: no cover - defensive for SDK changes.
        raise PandadataDownloadError(f"cannot convert Pandadata result to DataFrame: {type(result).__name__}") from exc


def fetch_data(args: argparse.Namespace) -> tuple[pd.DataFrame, dict[str, Any]]:
    panda_data, base_url = init_pandadata(args.env_file)
    method_name = METHOD_BY_ASSET_TYPE[args.asset_type]
    method = getattr(panda_data, method_name, None)
    if method is None:
        raise PandadataDownloadError(f"panda_data.{method_name} is unavailable in this SDK.")

    symbols = split_symbols(args.symbols)
    fields = split_fields(args.fields)
    chunks = chunk_ranges(args.start_date, args.end_date, args.max_days_per_call)

    frames = []
    calls = []
    for chunk_start, chunk_end in chunks:
        params: dict[str, Any] = {
            "symbol": symbols,
            "start_date": api_date(chunk_start),
            "end_date": api_date(chunk_end),
            "fields": fields,
        }
        if args.asset_type == "stock":
            params["indicator"] = args.indicator
            params["st"] = args.include_st

        frame = result_to_frame(method(**params))
        frames.append(frame)
        calls.append(
            {
                "method": method_name,
                "start_date": params["start_date"],
                "end_date": params["end_date"],
                "rows": int(len(frame)),
            }
        )

    raw = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
    metadata = {
        "provider": "Pandadata",
        "sdk": "panda_data",
        "method": method_name,
        "base_url": base_url,
        "asset_type": args.asset_type,
        "symbols": symbols,
        "start_date": api_date(args.start_date),
        "end_date": api_date(args.end_date),
        "frequency": "daily",
        "adjustment": args.adjustment,
        "fields": fields,
        "include_st": args.include_st if args.asset_type == "stock" else None,
        "indicator": args.indicator if args.asset_type == "stock" else None,
        "max_days_per_call": args.max_days_per_call,
        "calls": calls,
        "fetched_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "credentials": {
            "source": "environment or env file",
            "env_file": str(args.env_file),
            "secret_values_recorded": False,
        },
    }
    return raw, metadata


def normalize_market_data(raw: pd.DataFrame, args: argparse.Namespace, metadata: dict[str, Any]) -> pd.DataFrame:
    if raw.empty:
        raise PandadataDownloadError("Pandadata returned no rows for the requested symbols and dates.")

    missing = [col for col in ("date", "symbol", "close") if col not in raw.columns]
    if missing:
        raise PandadataDownloadError(f"Pandadata result missing required columns: {missing}")

    out = raw.copy()
    out["date"] = out["date"].map(iso_date)
    out["symbol"] = out["symbol"].astype(str)
    out["close"] = pd.to_numeric(out["close"], errors="coerce")
    for col in ("open", "high", "low", "volume", "amount", "pre_close"):
        if col in out.columns:
            out[col] = pd.to_numeric(out[col], errors="coerce")

    before = len(out)
    out = out.dropna(subset=["date", "symbol", "close"])
    dropped_missing = before - len(out)
    dropped_nonpositive = 0
    if args.drop_nonpositive_close:
        before_positive = len(out)
        out = out[out["close"] > 0].copy()
        dropped_nonpositive = before_positive - len(out)

    out = out.drop_duplicates(["date", "symbol"], keep="last")
    out = out.sort_values(["symbol", "date"]).reset_index(drop=True)
    if out.empty:
        raise PandadataDownloadError("all rows were removed during market-data normalization.")

    for col in CORE_COLUMNS:
        if col not in out.columns:
            out[col] = pd.NA
    ordered = CORE_COLUMNS + [col for col in out.columns if col not in CORE_COLUMNS]
    out = out[ordered]

    metadata["raw_rows"] = int(len(raw))
    metadata["normalized_rows"] = int(len(out))
    metadata["dropped_missing_required"] = int(dropped_missing)
    metadata["dropped_nonpositive_close"] = int(dropped_nonpositive)
    metadata["columns"] = list(out.columns)
    metadata["output"] = str(args.output)
    metadata["metadata_output"] = str(args.metadata_output)
    return out


def write_market_data(frame: pd.DataFrame, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    suffix = output.suffix.lower()
    if suffix in {".parquet", ".pq"}:
        frame.to_parquet(output, index=False)
    else:
        frame.to_csv(output, index=False, encoding="utf-8-sig")


def update_manifest(project_dir: Path, metadata: dict[str, Any]) -> None:
    manifest_path = project_dir / "manifest.json"
    if not manifest_path.exists():
        return
    manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
    data_source = {
        "provider": metadata["provider"],
        "sdk": metadata["sdk"],
        "method": metadata["method"],
        "asset_type": metadata["asset_type"],
        "symbols": metadata["symbols"],
        "sample_period": [metadata["start_date"], metadata["end_date"]],
        "frequency": metadata["frequency"],
        "adjustment": metadata["adjustment"],
        "local_path": metadata["output"],
        "metadata_path": metadata["metadata_output"],
        "fetched_at": metadata["fetched_at"],
        "missing_value_handling": {
            "dropped_missing_required": metadata.get("dropped_missing_required", 0),
            "dropped_nonpositive_close": metadata.get("dropped_nonpositive_close", 0),
        },
        "credential_values_recorded": False,
    }
    manifest.setdefault("data_sources", []).append(data_source)
    manifest.setdefault("run_history", []).append(
        {
            "stage": "pandadata_market_data",
            "status": "ran",
            "provider": "Pandadata",
            "method": metadata["method"],
            "output": metadata["output"],
            "rows": metadata["normalized_rows"],
            "fetched_at": metadata["fetched_at"],
        }
    )
    manifest.setdefault("parameters", {})["pandadata_market_data"] = {
        "asset_type": metadata["asset_type"],
        "symbols": metadata["symbols"],
        "start_date": metadata["start_date"],
        "end_date": metadata["end_date"],
        "adjustment": metadata["adjustment"],
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asset-type", choices=sorted(METHOD_BY_ASSET_TYPE), default="stock")
    parser.add_argument("--symbols", nargs="+", required=True, help="Symbols, comma-separated or space-separated.")
    parser.add_argument("--start-date", required=True, type=parse_api_date, help="YYYYMMDD or YYYY-MM-DD.")
    parser.add_argument("--end-date", required=True, type=parse_api_date, help="YYYYMMDD or YYYY-MM-DD.")
    parser.add_argument("--fields", nargs="*", help="Optional Pandadata fields. Defaults to all fields.")
    parser.add_argument("--indicator", default="", help="Stock pool indicator for get_stock_daily; empty means all.")
    parser.add_argument("--exclude-st", dest="include_st", action="store_false", help="Exclude ST stocks for stock data.")
    parser.set_defaults(include_st=True)
    parser.add_argument(
        "--adjustment",
        default="none",
        choices=["none"],
        help="Adjustment rule recorded in provenance. Current downloader writes Pandadata raw daily prices.",
    )
    parser.add_argument("--keep-nonpositive-close", dest="drop_nonpositive_close", action="store_false")
    parser.set_defaults(drop_nonpositive_close=True)
    parser.add_argument("--max-days-per-call", type=int, default=1825)
    parser.add_argument("--env-file", type=Path, default=DEFAULT_ENV_FILE)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--metadata-output", type=Path)
    parser.add_argument("--project-dir", type=Path, help="Optional report project directory whose manifest.json should be updated.")
    args = parser.parse_args()

    args.env_file = args.env_file.expanduser().resolve()
    args.output = args.output.expanduser().resolve()
    args.metadata_output = (
        args.metadata_output.expanduser().resolve()
        if args.metadata_output
        else args.output.with_suffix(args.output.suffix + ".metadata.json")
    )
    if args.project_dir:
        args.project_dir = args.project_dir.expanduser().resolve()
    if args.max_days_per_call <= 0 or args.max_days_per_call > 1825:
        parser.error("--max-days-per-call must be between 1 and 1825")
    return args


def main() -> int:
    args = parse_args()
    try:
        raw, metadata = fetch_data(args)
        normalized = normalize_market_data(raw, args, metadata)
        write_market_data(normalized, args.output)
        args.metadata_output.parent.mkdir(parents=True, exist_ok=True)
        args.metadata_output.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        if args.project_dir:
            update_manifest(args.project_dir, metadata)
    except Exception as exc:
        print(f"[pandadata_market_data] ERROR: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 2

    print(
        json.dumps(
            {
                "ok": True,
                "provider": "Pandadata",
                "asset_type": metadata["asset_type"],
                "method": metadata["method"],
                "symbols": metadata["symbols"],
                "rows": metadata["normalized_rows"],
                "output": metadata["output"],
                "metadata_output": metadata["metadata_output"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
