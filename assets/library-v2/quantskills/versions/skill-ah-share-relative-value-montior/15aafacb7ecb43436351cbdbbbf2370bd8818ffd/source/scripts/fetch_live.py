#!/usr/bin/env python3
"""Fetch a current A/H snapshot using PandaData plus HKMA FX."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

from ah_sources import fetch_current_snapshot_rows


def _format_live_error(exc: Exception) -> str:
    text = str(exc)
    if "HKMA FX" in text:
        if "timed out" in text.lower():
            return (
                "live data unavailable in this environment: HKMA FX request timed out. "
                "Check network access to the HKMA endpoint and retry."
            )
        return f"live data unavailable in this environment: {text}"
    if "200003" in text or "token格式" in text.lower():
        return (
            "live data unavailable in this environment: PandaData returned a token format error. "
            "Check that login credentials are valid and that the base URL points to the PandaData service."
        )
    if "200002" in text or "未登录" in text or "expired" in text.lower():
        return (
            "live data unavailable in this environment: PandaData authentication is required. "
            "Set PANDA_DATA_USERNAME / PANDA_DATA_PASSWORD in the environment or a local .env."
        )
    if "timed out" in text.lower():
        return (
            "live data unavailable in this environment: PandaData request timed out. "
            "Check VPN, firewall, proxy, or service latency."
        )
    if "10013" in text or "permission" in text.lower() or "socket" in text.lower():
        return (
            "live data unavailable in this environment: PandaData network access is blocked on this machine. "
            "Check VPN, firewall, or proxy settings."
        )
    return f"live data unavailable in this environment: {exc}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--company", help="Filter the snapshot by company name")
    args = ap.parse_args()

    try:
        rows, warnings = fetch_current_snapshot_rows(company=args.company)
    except Exception as exc:
        raise SystemExit(_format_live_error(exc)) from exc
    if not rows:
        raise SystemExit("no matching A/H rows found")

    fields = [
        "company",
        "h_code",
        "h_price_hkd",
        "h_date",
        "a_code",
        "a_price_cny",
        "a_date",
        "fx_hkd_cny",
        "fx_source_date",
        "fx_quote_hkd_per_cny",
        "quote_note",
    ]
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)

    message = f"wrote {len(rows)} rows to {out}; HKMA FX date={rows[-1]['fx_source_date']}"
    if warnings:
        message += f"; warnings={len(warnings)}"
    print(message)


if __name__ == "__main__":
    main()
