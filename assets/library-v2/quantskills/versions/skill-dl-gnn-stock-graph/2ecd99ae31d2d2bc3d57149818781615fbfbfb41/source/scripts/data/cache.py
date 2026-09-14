"""Local Parquet cache for panda_data API responses.

Each data source gets ONE cache file under scripts/data/cache/ — shared across
all index pools and date ranges.  The cache is append-only: each API call
merges new rows into the existing file (deduplicated by primary key).

Layout:
    scripts/data/cache/
    ├── factor.parquet
    ├── stock_post.parquet
    ├── index_daily.parquet
    ├── index_weights.parquet
    ├── industry_constituents.parquet
    ├── concept_constituents.parquet
    ├── top_holders.parquet
    ├── share_float.parquet
    ├── stock_status_change.parquet
    ├── fina_reports.parquet
    ├── lhb_list.parquet
    ├── block_trade.parquet
    └── trade_cal.parquet
"""
from __future__ import annotations

import os
import time
from pathlib import Path

import pandas as pd

# ---------------------------------------------------------------------------
# Path resolution
# ---------------------------------------------------------------------------
_CACHE_DIR = Path(__file__).resolve().parent / "cache"


def _cache_path(name: str) -> Path:
    """Return absolute path to a cache file. Ensures the directory exists."""
    _CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return _CACHE_DIR / f"{name}.parquet"


# ---------------------------------------------------------------------------
# Read / Write
# ---------------------------------------------------------------------------
def read_cache(name: str, start: str | None, end: str | None,
               date_col: str = "date",
               max_age_hours: int = 24) -> pd.DataFrame | None:
    """Read cached DataFrame filtered to [start, end] if fresh enough.

    Args:
        name: cache file base name (without path or extension).
        start: earliest date string (inclusive).  None means no lower bound.
        end:   latest date string (inclusive).    None means no upper bound.
        date_col: column name holding the date in the cached parquet.
        max_age_hours: skip cache if file mtime is older than this.

    Returns:
        Filtered DataFrame on cache hit, or None on miss / expired / empty file.
    """
    path = _cache_path(name)
    if not path.exists():
        return None

    # Freshness check
    if max_age_hours > 0:
        age_sec = time.time() - path.stat().st_mtime
        if age_sec > max_age_hours * 3600:
            return None

    try:
        df = pd.read_parquet(path)
    except Exception:
        return None

    if df.empty:
        return None

    # Date filtering
    if date_col is not None and date_col in df.columns:
        df[date_col] = df[date_col].astype(str)
        if start is not None:
            df = df[df[date_col] >= str(start)]
        if end is not None:
            df = df[df[date_col] <= str(end)]
    return df if not df.empty else None


def write_cache(name: str, df: pd.DataFrame,
                date_col: str = "date",
                dedup_cols: list[str] | None = None) -> None:
    """Write (or merge-append) a DataFrame to the cache file.

    If the cache file already exists, the new data is merged with the old —
    rows already present (matched by dedup_cols) are kept from the newer copy.

    Args:
        name:        cache file base name.
        df:          data to persist.
        date_col:    date-bearing column (cast to str before write).
        dedup_cols:  columns to use for deduplication.  Defaults to all
                     columns except ``date_col``.
    """
    if df is None or (hasattr(df, "empty") and df.empty):
        return

    path = _cache_path(name)
    df = df.copy()
    if date_col is not None and date_col in df.columns:
        df[date_col] = df[date_col].astype(str)

    if path.exists():
        try:
            existing = pd.read_parquet(path)
            if date_col is not None and date_col in existing.columns:
                existing[date_col] = existing[date_col].astype(str)
            combined = pd.concat([existing, df], ignore_index=True)
        except Exception:
            combined = df
    else:
        combined = df

    # Drop exact duplicate rows
    if dedup_cols is None:
        dedup_cols = [c for c in combined.columns if c != date_col] if date_col is not None else list(combined.columns)
    subset = [c for c in dedup_cols if c in combined.columns]
    if subset:
        combined = combined.drop_duplicates(subset=subset, keep="last")

    combined.to_parquet(path, index=False)


def clear_cache(name: str | None = None) -> None:
    """Delete one or all cache files.

    Args:
        name: specific cache name to delete, or None to wipe everything.
    """
    if name is not None:
        path = _cache_path(name)
        if path.exists():
            path.unlink()
    else:
        for path in _CACHE_DIR.glob("*.parquet"):
            path.unlink()
