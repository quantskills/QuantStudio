#!/usr/bin/env python3
"""Fetch and align A/H daily closes plus HKD/CNY history."""

from __future__ import annotations

import argparse
from pathlib import Path

from ah_sources import fetch_history_rows


def _format_live_error(exc: Exception) -> str:
    text = str(exc)
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
    ap.add_argument("--company", help="A/H company name used to resolve codes")
    ap.add_argument("--a-code")
    ap.add_argument("--h-code")
    ap.add_argument("--start-date", required=True)
    ap.add_argument("--end-date", required=True)
    ap.add_argument("--max-fx-stale-days", type=int, default=3)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    try:
        frame, _ = fetch_history_rows(
            company=args.company,
            a_code=args.a_code,
            h_code=args.h_code,
            start_date=args.start_date,
            end_date=args.end_date,
            max_fx_stale_days=args.max_fx_stale_days,
        )
    except Exception as exc:
        raise SystemExit(_format_live_error(exc)) from exc
    if frame.empty:
        raise SystemExit("no aligned observations after date/FX checks")

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(out, index=False, encoding="utf-8")
    print(f"wrote {len(frame)} aligned observations to {out}; A/H={frame.iloc[-1]['a_code']}/{frame.iloc[-1]['h_code']}")


if __name__ == "__main__":
    main()
