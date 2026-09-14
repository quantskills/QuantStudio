#!/usr/bin/env python3
"""Look up A/H codes by company name from the local pair universe."""

from __future__ import annotations

import argparse
import json

from ah_lookup import format_candidates, rank_rows
from ah_sources import load_pair_universe, resolve_pair


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("query", help="Company name, partial company name, A code, or H code")
    ap.add_argument("--top", type=int, default=5)
    ap.add_argument("--json", dest="json_path")
    args = ap.parse_args()

    rows = load_pair_universe()
    matches = rank_rows(args.query, rows, limit=args.top)
    payload = {"query": args.query, "candidates": format_candidates(matches)}
    try:
        best, _ = resolve_pair(args.query, rows, limit=args.top)
        payload["best_match"] = format_candidates([best])[0]
    except ValueError as e:
        payload["warning"] = str(e)

    text = json.dumps(payload, ensure_ascii=False, indent=2)
    if args.json_path:
        with open(args.json_path, "w", encoding="utf-8") as f:
            f.write(text + "\n")
    print(text)


if __name__ == "__main__":
    main()
