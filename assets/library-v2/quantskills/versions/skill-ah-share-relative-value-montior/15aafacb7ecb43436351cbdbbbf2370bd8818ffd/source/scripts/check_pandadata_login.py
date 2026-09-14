#!/usr/bin/env python3
"""Minimal PandaData login probe."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from ah_sources import _load_optional_env_files, _panda_service_root, load_panda_sdk


def _mask(value: str, keep: int = 3) -> str:
    if not value:
        return "<empty>"
    if len(value) <= keep * 2:
        return value[0] + "***" + value[-1]
    return value[:keep] + "***" + value[-keep:]


def main() -> int:
    parser = argparse.ArgumentParser(description="Test PandaData login only.")
    parser.add_argument("--username", help="Defaults to PANDA_DATA_USERNAME or DEFAULT_USERNAME")
    parser.add_argument("--password", help="Defaults to PANDA_DATA_PASSWORD or DEFAULT_PASSWORD")
    args = parser.parse_args()

    _load_optional_env_files()

    username = args.username or os.getenv("PANDA_DATA_USERNAME") or os.getenv("DEFAULT_USERNAME") or ""
    password = args.password or os.getenv("PANDA_DATA_PASSWORD") or os.getenv("DEFAULT_PASSWORD") or ""
    if not username or not password:
        raise SystemExit(
            "missing credentials: set PANDA_DATA_USERNAME / PANDA_DATA_PASSWORD in .env or environment"
        )
    if args.username:
        os.environ["PANDA_DATA_USERNAME"] = args.username
    if args.password:
        os.environ["PANDA_DATA_PASSWORD"] = args.password

    base_url = _panda_service_root()
    print(f"base_url={base_url}")
    print(f"username={_mask(username)}")

    try:
        sdk = load_panda_sdk()
    except Exception as exc:
        raise SystemExit(f"login_failed: {type(exc).__name__}: {exc}") from exc

    print("login_ok=true")
    print(f"sdk={type(sdk).__name__}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
