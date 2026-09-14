from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Iterable, Mapping

import pandas as pd


DEFAULT_FIELDS = [
    "is_revenue",
    "is_n_income_attr_p",
    "bs_total_assets",
    "cfs_net_cash_operating",
]
REQUIRED_REPORT_COLUMNS = {"symbol", "quarter", "date"}
MACOS_KEYCHAIN_SERVICE = "skill-a-share-pit-fundamental-vintage-builder"
MACOS_KEYCHAIN_USERNAME_ACCOUNT = "PANDA_DATA_USERNAME"
MACOS_KEYCHAIN_PASSWORD_ACCOUNT = "PANDA_DATA_PASSWORD"


class PitBuildError(ValueError):
    """Raised when a Point-in-Time data invariant cannot be met."""


def _quarter_to_index(value: str) -> int:
    try:
        year_text, quarter_text = value.lower().split("q")
        year = int(year_text)
        quarter = int(quarter_text)
    except (AttributeError, ValueError) as exc:
        raise PitBuildError(f"Invalid quarter: {value!r}. Use YYYYqN.") from exc
    if quarter not in {1, 2, 3, 4}:
        raise PitBuildError(f"Invalid quarter: {value!r}. Use YYYYq1 through YYYYq4.")
    return year * 4 + quarter - 1


def _index_to_quarter(value: int) -> str:
    return f"{value // 4}q{value % 4 + 1}"


def _normalize_date(value: object) -> str:
    text = str(value).strip()
    if len(text) == 8 and text.isdigit():
        return text
    parsed = pd.to_datetime(text, errors="coerce")
    if pd.isna(parsed):
        raise PitBuildError(f"Invalid date: {value!r}. Use YYYYMMDD.")
    return parsed.strftime("%Y%m%d")


def _normalize_date_column(frame: pd.DataFrame, column: str) -> pd.DataFrame:
    normalized = frame.copy()
    if column not in normalized.columns:
        raise PitBuildError(f"Missing required column: {column}")
    if normalized[column].isna().any():
        raise PitBuildError(f"Column {column} contains missing dates.")
    normalized[column] = normalized[column].map(_normalize_date)
    return normalized


def normalize_trading_calendar(calendar: pd.DataFrame) -> pd.DataFrame:
    """Adapt the SDK's current calendar schema to the builder's stable contract."""
    date_column = "date" if "date" in calendar.columns else "nature_date"
    flag_column = "is_trading_day" if "is_trading_day" in calendar.columns else "is_trade"
    missing = [
        name
        for name, column in (("date/nature_date", date_column), ("is_trading_day/is_trade", flag_column))
        if column not in calendar.columns
    ]
    if missing:
        raise PitBuildError(f"Unsupported trading-calendar schema: missing {', '.join(missing)}")
    normalized = calendar[[date_column, flag_column]].rename(
        columns={date_column: "date", flag_column: "is_trading_day"}
    )
    normalized["is_trading_day"] = pd.to_numeric(
        normalized["is_trading_day"], errors="raise"
    ).astype(int)
    return _normalize_date_column(normalized, "date")


def split_quarter_range(start_quarter: str, end_quarter: str) -> list[tuple[str, str]]:
    """Split an inclusive quarter interval into Panda Data's 20-quarter limit."""
    start = _quarter_to_index(start_quarter)
    end = _quarter_to_index(end_quarter)
    if start > end:
        raise PitBuildError("start_quarter must not be later than end_quarter.")

    chunks: list[tuple[str, str]] = []
    cursor = start
    while cursor <= end:
        chunk_end = min(cursor + 19, end)
        chunks.append((_index_to_quarter(cursor), _index_to_quarter(chunk_end)))
        cursor = chunk_end + 1
    return chunks


def select_as_of_vintages(reports: pd.DataFrame, as_of_date: str) -> pd.DataFrame:
    """Keep the latest disclosure visible on or before an as-of date per report period."""
    missing = REQUIRED_REPORT_COLUMNS.difference(reports.columns)
    if missing:
        raise PitBuildError(f"Missing required report columns: {', '.join(sorted(missing))}")

    as_of = _normalize_date(as_of_date)
    normalized = _normalize_date_column(reports, "date")
    visible = normalized.loc[normalized["date"] <= as_of].copy()
    if visible.empty:
        return visible
    _reject_ambiguous_vintages(visible, "date")
    return (
        visible.sort_values(["symbol", "quarter", "date"])
        .groupby(["symbol", "quarter"], as_index=False, group_keys=False)
        .tail(1)
        .sort_values(["symbol", "quarter"])
        .reset_index(drop=True)
    )


def _reject_ambiguous_vintages(reports: pd.DataFrame, disclosure_column: str) -> None:
    """Fail closed when the API cannot order conflicting same-day report versions."""
    deduplicated = reports.drop_duplicates()
    ambiguous = deduplicated.loc[
        deduplicated.duplicated(["symbol", "quarter", disclosure_column], keep=False)
    ]
    if ambiguous.empty:
        return
    examples = (
        ambiguous[["symbol", "quarter", disclosure_column]]
        .drop_duplicates()
        .head(5)
        .to_dict("records")
    )
    raise PitBuildError(
        "Ambiguous report vintages share the same symbol, quarter, and disclosure date. "
        f"A stable version identifier or publication timestamp is required. Examples: {examples}"
    )


def build_available_dates(reports: pd.DataFrame, trading_days: pd.DataFrame) -> pd.DataFrame:
    """Map disclosures to the next trading day under the conservative T+1 convention."""
    normalized_reports = _normalize_date_column(reports, "date")
    normalized_calendar = _normalize_date_column(trading_days, "date")
    if "is_trading_day" in normalized_calendar.columns:
        normalized_calendar = normalized_calendar.loc[
            normalized_calendar["is_trading_day"].astype(int) == 1
        ]
    dates = sorted(normalized_calendar["date"].unique().tolist())
    if not dates:
        raise PitBuildError("Trading calendar contains no trading days.")

    available_dates: list[str] = []
    for disclosure_date in normalized_reports["date"]:
        next_dates = [date for date in dates if date > disclosure_date]
        if not next_dates:
            raise PitBuildError(
                f"No trading day after disclosure date {disclosure_date}. Extend the calendar window."
            )
        available_dates.append(next_dates[0])

    result = normalized_reports.copy()
    result["disclosure_date"] = result.pop("date")
    result["available_date"] = available_dates
    return result


def build_pit_snapshot(
    reports: pd.DataFrame, trading_days: pd.DataFrame, as_of_date: str
) -> pd.DataFrame:
    """Build one conservative Point-in-Time snapshot for a fixed research date."""
    as_of = _normalize_date(as_of_date)
    missing = REQUIRED_REPORT_COLUMNS.difference(reports.columns)
    if missing:
        raise PitBuildError(f"Missing required report columns: {', '.join(sorted(missing))}")
    normalized_reports = _normalize_date_column(reports, "date")
    visible = normalized_reports.loc[normalized_reports["date"] <= as_of].copy()
    if visible.empty:
        return visible

    dated = build_available_dates(visible, trading_days)
    tradable = dated.loc[dated["available_date"] <= as_of].copy()
    if tradable.empty:
        return tradable
    _reject_ambiguous_vintages(tradable, "disclosure_date")
    return (
        tradable.sort_values(["symbol", "quarter", "disclosure_date"])
        .groupby(["symbol", "quarter"], as_index=False, group_keys=False)
        .tail(1)
        .assign(as_of_date=as_of, vintage_type="formal_report")
        .sort_values(["symbol", "quarter"])
        .reset_index(drop=True)
    )


def build_pit_panels(
    reports: pd.DataFrame, trading_days: pd.DataFrame, as_of_dates: Iterable[str]
) -> pd.DataFrame:
    """Build a long PIT panel with one snapshot for every rebalance date."""
    normalized_dates = sorted({_normalize_date(value) for value in as_of_dates})
    if not normalized_dates:
        raise PitBuildError("Provide at least one as_of_date.")
    snapshots = [
        build_pit_snapshot(reports, trading_days, as_of_date) for as_of_date in normalized_dates
    ]
    non_empty = [snapshot for snapshot in snapshots if not snapshot.empty]
    if not non_empty:
        return pd.DataFrame()
    return pd.concat(non_empty, ignore_index=True).sort_values(
        ["as_of_date", "symbol", "quarter"]
    ).reset_index(drop=True)


def calendar_end_date(as_of_date: str) -> str:
    """Leave room to map an as-of-day disclosure to its next trading day."""
    return (pd.to_datetime(_normalize_date(as_of_date), format="%Y%m%d") + pd.Timedelta(days=21)).strftime(
        "%Y%m%d"
    )


def read_windows_user_environment(names: Iterable[str]) -> dict[str, str]:
    """Read persisted user variables so a fresh login works without a shell restart."""
    if sys.platform != "win32":
        return {}
    try:
        import winreg

        environment_key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment")
    except OSError:
        return {}

    values: dict[str, str] = {}
    try:
        for name in names:
            try:
                value, _ = winreg.QueryValueEx(environment_key, name)
            except FileNotFoundError:
                continue
            if isinstance(value, str) and value.strip():
                values[name] = value.strip()
    finally:
        winreg.CloseKey(environment_key)
    return values


def read_macos_keychain_environment() -> dict[str, str]:
    """Read validated credentials from the current macOS user's login keychain."""
    if sys.platform != "darwin":
        return {}

    values: dict[str, str] = {}
    for account in (MACOS_KEYCHAIN_USERNAME_ACCOUNT, MACOS_KEYCHAIN_PASSWORD_ACCOUNT):
        result = subprocess.run(
            [
                "security",
                "find-generic-password",
                "-w",
                "-s",
                MACOS_KEYCHAIN_SERVICE,
                "-a",
                account,
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode == 0 and result.stdout.strip():
            values[account] = result.stdout.strip()
    return values


def read_persisted_panda_data_environment(names: Iterable[str]) -> dict[str, str]:
    """Read platform-native stored credentials without putting secrets in output."""
    if sys.platform == "win32":
        return read_windows_user_environment(names)
    if sys.platform == "darwin":
        return read_macos_keychain_environment()
    return {}


def resolve_panda_data_credentials(
    environment: Mapping[str, str] | None = None,
    persisted_environment: Mapping[str, str] | None = None,
) -> tuple[str, str]:
    """Prefer current-process variables, then platform-native persisted values."""
    environment = os.environ if environment is None else environment
    credential_names = (
        "PANDA_DATA_USERNAME",
        "PANDADATA_USERNAME",
        "PANDA_DATA_PASSWORD",
        "PANDADATA_PASSWORD",
    )
    persisted_environment = (
        read_persisted_panda_data_environment(credential_names)
        if persisted_environment is None
        else persisted_environment
    )

    def first_value(names: Iterable[str]) -> str:
        for name in names:
            value = str(environment.get(name, "")).strip()
            if value:
                return value
        for name in names:
            value = str(persisted_environment.get(name, "")).strip()
            if value:
                return value
        return ""

    return (
        first_value(("PANDA_DATA_USERNAME", "PANDADATA_USERNAME")),
        first_value(("PANDA_DATA_PASSWORD", "PANDADATA_PASSWORD")),
    )


def initialize_panda_data() -> object:
    """Initialize the Panda Data client without exposing credentials in output."""
    try:
        import panda_data
    except ModuleNotFoundError as exc:
        raise PitBuildError("panda_data is not installed in the active Python environment.") from exc

    username, password = resolve_panda_data_credentials()
    if not username or not password:
        raise PitBuildError(
            "Run the platform-specific Panda Data login launcher first, or set "
            "PANDA_DATA_USERNAME and PANDA_DATA_PASSWORD before running this script."
        )
    panda_data.init_token(username, password)
    return panda_data


def fetch_historical_reports(
    panda_data: object,
    symbols: list[str],
    start_quarter: str,
    end_quarter: str,
    fields: list[str],
) -> pd.DataFrame:
    """Fetch every retained formal-report vintage in API-safe quarter chunks."""
    frames: list[pd.DataFrame] = []
    for chunk_start, chunk_end in split_quarter_range(start_quarter, end_quarter):
        frame = panda_data.get_fina_reports(
            symbol=symbols,
            start_quarter=chunk_start,
            end_quarter=chunk_end,
            fields=fields,
            is_latest=False,
        )
        if not frame.empty:
            frames.append(frame)
    if not frames:
        return pd.DataFrame(columns=["symbol", "quarter", "date", *fields])
    return pd.concat(frames, ignore_index=True).drop_duplicates().reset_index(drop=True)


def fetch_trading_days(panda_data: object, start_date: str, end_date: str, exchange: str) -> pd.DataFrame:
    calendar = panda_data.get_trade_cal(
        start_date=start_date,
        end_date=end_date,
        exchange=exchange,
        is_trading_day=1,
    )
    return normalize_trading_calendar(calendar)


def build_live_snapshot(
    symbols: list[str],
    start_quarter: str,
    end_quarter: str,
    as_of_date: str,
    fields: list[str],
    exchange: str,
) -> pd.DataFrame:
    return build_live_panels(
        symbols, start_quarter, end_quarter, [as_of_date], fields, exchange
    )


def build_live_panels(
    symbols: list[str],
    start_quarter: str,
    end_quarter: str,
    as_of_dates: Iterable[str],
    fields: list[str],
    exchange: str,
) -> pd.DataFrame:
    normalized_dates = sorted({_normalize_date(value) for value in as_of_dates})
    if not normalized_dates:
        raise PitBuildError("Provide at least one as_of_date.")
    client = initialize_panda_data()
    reports = fetch_historical_reports(client, symbols, start_quarter, end_quarter, fields)
    if reports.empty:
        return reports
    calendar_start = _normalize_date(reports["date"].min())
    calendar = fetch_trading_days(
        client, calendar_start, calendar_end_date(normalized_dates[-1]), exchange
    )
    return build_pit_panels(reports, calendar, normalized_dates)


def _parse_fields(value: str) -> list[str]:
    fields = [field.strip() for field in value.split(",") if field.strip()]
    if not fields:
        raise argparse.ArgumentTypeError("Provide at least one financial field.")
    return fields


def load_as_of_dates(path: Path) -> list[str]:
    try:
        schedule = pd.read_csv(path, dtype=str)
    except (OSError, pd.errors.ParserError) as exc:
        raise PitBuildError(f"Could not read as-of-date schedule {path}: {exc}") from exc
    column = "rebalance_date" if "rebalance_date" in schedule.columns else "date"
    if column not in schedule.columns:
        raise PitBuildError("As-of-date schedule must contain rebalance_date or date.")
    try:
        return sorted({_normalize_date(value) for value in schedule[column].dropna().tolist()})
    except PitBuildError as exc:
        raise PitBuildError(f"Invalid as-of-date schedule {path}: {exc}") from exc


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a conservative A-share Point-in-Time formal-report snapshot."
    )
    parser.add_argument("--symbols", nargs="+", required=True, help="A-share symbols, e.g. 000001.SZ")
    parser.add_argument("--start-quarter", required=True, help="Inclusive start quarter, e.g. 2021q1")
    parser.add_argument("--end-quarter", required=True, help="Inclusive end quarter, e.g. 2025q4")
    as_of_group = parser.add_mutually_exclusive_group(required=True)
    as_of_group.add_argument("--as-of-date", help="Research date in YYYYMMDD format")
    as_of_group.add_argument(
        "--as-of-dates", type=Path, help="CSV with rebalance_date or date in YYYYMMDD format"
    )
    parser.add_argument("--output", type=Path, required=True, help="Output CSV path")
    parser.add_argument("--fields", type=_parse_fields, default=DEFAULT_FIELDS)
    parser.add_argument("--exchange", default="SH", help="Trading-calendar exchange, default: SH")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    as_of_dates = [args.as_of_date] if args.as_of_date else load_as_of_dates(args.as_of_dates)
    snapshot = build_live_panels(
        symbols=args.symbols,
        start_quarter=args.start_quarter,
        end_quarter=args.end_quarter,
        as_of_dates=as_of_dates,
        fields=args.fields,
        exchange=args.exchange,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    snapshot.to_csv(args.output, index=False, encoding="utf-8-sig")
    metadata = {
        "as_of_dates": sorted({_normalize_date(value) for value in as_of_dates}),
        "availability_convention": "next_trading_day_after_disclosure",
        "source": "panda_data.get_fina_reports(is_latest=False)",
        "rows": len(snapshot),
        "symbols": args.symbols,
        "fields": args.fields,
    }
    if len(metadata["as_of_dates"]) == 1:
        metadata["as_of_date"] = metadata["as_of_dates"][0]
    args.output.with_suffix(".metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Wrote {len(snapshot)} rows to {args.output}")


if __name__ == "__main__":
    main()
