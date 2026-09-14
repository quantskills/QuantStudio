"""Credential-injected runner for one sandboxed PandaData script."""

from __future__ import annotations

import json
import os
import runpy
import sys
from pathlib import Path
from typing import NoReturn


def fail(message: str, exit_code: int = 1) -> NoReturn:
    print(message, file=sys.stderr)
    raise SystemExit(exit_code)


def clear_sdk_auth(sdk: object) -> bool:
    """Remove SDK-owned credential persistence before the runner exits."""
    clear_auth = getattr(sdk, "clear_auth", None)
    if not callable(clear_auth):
        try:
            from panda_data import auth_manager
        except Exception:
            return False
        clear_auth = getattr(auth_manager, "clear_auth", None)
    if not callable(clear_auth):
        return False
    try:
        clear_auth()
    except Exception:
        return False
    return True


def main() -> int:
    try:
        # `-I` (isolated) implies -E, so PYTHONUTF8 from the Host is ignored and
        # on non-UTF-8 Windows locales stdin would decode the Host's UTF-8 JSON
        # as GBK, mangling non-ASCII script/workdir paths. Force UTF-8.
        sys.stdin.reconfigure(encoding="utf-8")
    except Exception:
        pass
    try:
        request = json.load(sys.stdin)
    except Exception:
        fail("PandaData execution request is invalid.")
    if not isinstance(request, dict):
        fail("PandaData execution request is invalid.")
    required = request.get("requiredSdkVersion")
    base_url = request.get("baseURL")
    login = request.get("login")
    password = request.get("password")
    script_value = request.get("scriptPath")
    workdir_value = request.get("workdir")
    args = request.get("args")
    if not all(isinstance(value, str) and value for value in (required, base_url, login, password, script_value, workdir_value)):
        fail("PandaData execution request is invalid.")
    if not isinstance(args, list) or not all(isinstance(value, str) for value in args):
        fail("PandaData execution request is invalid.")
    request["login"] = None
    request["password"] = None
    script = Path(script_value).resolve(strict=True)
    workdir = Path(workdir_value).resolve(strict=True)
    if not script.is_file() or not workdir.is_dir():
        fail("PandaData execution paths are unavailable.")
    try:
        import panda_data
        from importlib.metadata import version
    except Exception:
        fail("PandaData SDK is unavailable in the bound runtime.")
    if version("panda_data") != required:
        fail("PandaData SDK does not match the Session runtime binding.")
    init_token = getattr(panda_data, "init_token", None)
    is_authenticated = getattr(panda_data, "is_authenticated", None)
    if not callable(is_authenticated):
        # Mirror panda_worker.py: panda_data 0.0.12 lists is_authenticated in
        # __all__ but only exports it from panda_data.auth_manager.
        try:
            from panda_data import auth_manager
        except Exception:
            auth_manager = None
        if auth_manager is not None:
            is_authenticated = getattr(auth_manager, "is_authenticated", None)
    if not callable(init_token) or not callable(is_authenticated):
        fail("PandaData authentication API is unavailable.")
    try:
        # The sandbox confines writes to the workspace and the invocation's
        # private TEMP; the SDK's default user.json location (inside the
        # immutable runtime tree) is not writable from this runner, and
        # init_token's save_auth_state would otherwise abort the login.
        # Redirect encrypted-credential persistence to TEMP: the windows-acl
        # runner rewrites TEMP to the per-invocation private directory and
        # removes it after the child exits, so no second credential store
        # survives the run.
        from panda_data import auth_manager as _auth_manager
        _temp_dir = os.environ.get("TEMP") or os.environ.get("TMP")
        if _temp_dir:
            _auth_manager._user_json_dir = _temp_dir
    except Exception:
        pass
    try:
        init_token(login, password, base_url=base_url)
        if not bool(is_authenticated()):
            fail("PandaData authentication failed.")
    except SystemExit:
        clear_sdk_auth(panda_data)
        raise
    except Exception:
        clear_sdk_auth(panda_data)
        fail("PandaData authentication failed.")
    finally:
        login = None
        password = None
    os.chdir(workdir)
    sys.argv = [str(script), *args]
    exit_code = 0
    try:
        runpy.run_path(str(script), run_name="__main__")
    except SystemExit as error:
        if error.code in (None, 0):
            exit_code = 0
        elif isinstance(error.code, int):
            exit_code = error.code
        else:
            print(str(error.code), file=sys.stderr)
            exit_code = 1
    except Exception as error:
        print(f"{type(error).__name__}: {error}", file=sys.stderr)
        exit_code = 1
    if not clear_sdk_auth(panda_data):
        print("PandaData credential cleanup failed.", file=sys.stderr)
        return 1
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
