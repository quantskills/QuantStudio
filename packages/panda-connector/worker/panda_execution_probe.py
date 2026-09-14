"""Bounded read-only PandaData call used by the Host execution readiness probe."""

from __future__ import annotations

import contextlib
import io
import json
import sys
from typing import NoReturn


SUCCESS_MARKER = "PANDADATA_EXECUTION_PROBE_OK"


def fail(message: str) -> NoReturn:
    print(message, file=sys.stderr)
    raise SystemExit(1)


def main() -> int:
    if len(sys.argv) != 2:
        fail("PandaData execution probe request is invalid.")
    try:
        request = json.loads(sys.argv[1])
    except Exception:
        fail("PandaData execution probe request is invalid.")
    if not isinstance(request, dict):
        fail("PandaData execution probe request is invalid.")
    callable_name = request.get("callable")
    keyword_arguments = request.get("keywordArguments")
    if callable_name != "get_market_data" or not isinstance(keyword_arguments, dict):
        fail("PandaData execution probe request is unsupported.")
    try:
        import panda_data
    except Exception:
        fail("PandaData SDK is unavailable in the probe runtime.")
    target = getattr(panda_data, callable_name, None)
    if not callable(target):
        fail("PandaData execution probe API is unavailable.")
    try:
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            result = target(**keyword_arguments)
    except Exception:
        fail("PandaData execution probe request failed.")
    if result is None:
        fail("PandaData execution probe returned no result.")
    print(SUCCESS_MARKER)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
