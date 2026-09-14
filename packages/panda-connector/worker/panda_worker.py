"""Private one-request PandaData runtime worker.

The worker emits exactly one bounded JSON response. Installer output,
credentials, tokens, account identifiers, and SDK exceptions remain private.
"""

from __future__ import annotations

import contextlib
import importlib.metadata
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from typing import Any
from urllib.parse import urlsplit


VERSION_PATTERN = re.compile(r"^[0-9]+\.[0-9]+\.[0-9]+(?:[a-zA-Z0-9.-]+)?$")
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")


def private_python(runtime_root: str) -> Path:
    if os.name == "nt":
        return Path(runtime_root) / "Scripts" / "python.exe"
    return Path(runtime_root) / "bin" / "python"


def fixed_response(
    ok: bool,
    installed: str | None,
    logout_supported: bool,
    python_source: str,
    code: str | None = None,
    authenticated: bool = False,
    data_validated: bool = False,
    python_version: str | None = None,
    public_callables: list[str] | None = None,
    api_fingerprint: str | None = None,
    capabilities: dict[str, bool] | None = None,
) -> dict[str, Any]:
    response: dict[str, Any] = {
        "ok": ok,
        "installedSdkVersion": installed,
        "logoutSupported": logout_supported,
        "authenticated": authenticated,
        "dataValidated": data_validated,
        "pythonVersion": python_version,
        "pythonSource": python_source,
        "publicCallables": public_callables or [],
        "apiFingerprint": api_fingerprint,
        "capabilities": capabilities,
    }
    if code is not None:
        response["code"] = code
    return response


def run_probe(python: Path, required: str, python_source: str) -> dict[str, Any]:
    if not python.is_file():
        return fixed_response(True, None, False, python_source)
    source = r'''
import hashlib
import importlib.metadata
import json
import platform
import panda_data
from panda_data import auth_manager

version = importlib.metadata.version("panda_data")
callables = sorted(name for name in dir(panda_data) if not name.startswith("_") and callable(getattr(panda_data, name, None)))
clear_auth = getattr(panda_data, "clear_auth", None) or getattr(auth_manager, "clear_auth", None)
is_authenticated = getattr(panda_data, "is_authenticated", None) or getattr(auth_manager, "is_authenticated", None)
authenticated = False
try:
    authenticated = bool(is_authenticated()) if callable(is_authenticated) else False
except Exception:
    authenticated = False
capabilities = {
    "authentication": callable(getattr(panda_data, "init_token", None)) and callable(is_authenticated),
    "marketData": callable(getattr(panda_data, "get_market_data", None)),
    "indexData": callable(getattr(panda_data, "get_index_indicator", None)) and callable(getattr(panda_data, "get_index_weights", None)),
    "marginData": callable(getattr(panda_data, "get_margin", None)),
}
print(json.dumps({
    "version": version,
    "python": platform.python_version(),
    "logout": callable(clear_auth) and callable(is_authenticated),
    "authenticated": authenticated,
    "callables": callables,
    "fingerprint": hashlib.sha256("\n".join(callables).encode("utf-8")).hexdigest(),
    "capabilities": capabilities,
}, separators=(",", ":")))
'''
    completed = subprocess.run(
        [str(python), "-I", "-c", source],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        encoding="utf-8",
        timeout=30,
        check=False,
    )
    if completed.returncode != 0:
        return fixed_response(True, None, False, python_source)
    try:
        value = json.loads(completed.stdout)
    except (TypeError, ValueError):
        return fixed_response(True, None, False, python_source)
    version = value.get("version")
    python_version = value.get("python")
    callables = value.get("callables")
    fingerprint = value.get("fingerprint")
    capabilities = value.get("capabilities")
    if (
        not isinstance(version, str)
        or not isinstance(python_version, str)
        or not isinstance(callables, list)
        or not all(isinstance(item, str) for item in callables)
        or not isinstance(fingerprint, str)
        or not isinstance(capabilities, dict)
        or not all(isinstance(capabilities.get(name), bool) for name in ("authentication", "marketData", "indexData", "marginData"))
    ):
        return fixed_response(True, None, False, python_source)
    exact = version == required
    return fixed_response(
        True,
        version,
        bool(value.get("logout")) if exact else False,
        python_source,
        authenticated=bool(value.get("authenticated")) if exact else False,
        python_version=python_version,
        public_callables=callables,
        api_fingerprint=fingerprint,
        capabilities=capabilities,
    )


def describe(request: dict[str, Any]) -> dict[str, Any]:
    return run_probe(
        private_python(request["runtimeRoot"]),
        request["requiredSdkVersion"],
        request["pythonSource"],
    )


def package_requirement(request: dict[str, Any]) -> str:
    required = request["requiredSdkVersion"]
    wheel_url = request.get("wheelURL")
    wheel_sha256 = request.get("wheelSha256")
    if wheel_url is None and wheel_sha256 is None:
        return f"panda_data=={required}"
    if not isinstance(wheel_url, str) or not isinstance(wheel_sha256, str):
        raise ValueError("wheel")
    parsed = urlsplit(wheel_url)
    if (
        parsed.scheme != "https"
        or parsed.hostname != "files.pythonhosted.org"
        or parsed.username is not None
        or parsed.password is not None
        or not SHA256_PATTERN.fullmatch(wheel_sha256)
    ):
        raise ValueError("wheel")
    return f"{wheel_url}#sha256={wheel_sha256}"


def bootstrap(request: dict[str, Any]) -> dict[str, Any]:
    python_source = request["pythonSource"]
    if sys.version_info < (3, 10):
        return fixed_response(False, None, False, python_source, "python-unsupported")
    required = request["requiredSdkVersion"]
    runtime_root = request["runtimeRoot"]
    python = private_python(runtime_root)
    status = run_probe(python, required, python_source)
    if status["installedSdkVersion"] == required:
        return status
    Path(runtime_root).parent.mkdir(parents=True, exist_ok=True)
    if not python.is_file():
        created = subprocess.run(
            [sys.executable, "-I", "-m", "venv", runtime_root],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=180,
            check=False,
        )
        if created.returncode != 0 or not python.is_file():
            return fixed_response(False, status["installedSdkVersion"], False, python_source, "bootstrap-failed")
    try:
        requirement = package_requirement(request)
    except ValueError:
        return fixed_response(False, status["installedSdkVersion"], False, python_source, "bootstrap-failed")
    installed_process = subprocess.run(
        [
            str(python), "-I", "-m", "pip", "install",
            "--disable-pip-version-check", "--no-input", requirement,
        ],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        timeout=600,
        check=False,
    )
    if installed_process.returncode != 0:
        return fixed_response(False, status["installedSdkVersion"], False, python_source, "bootstrap-failed")
    status = run_probe(python, required, python_source)
    if status["installedSdkVersion"] != required:
        return fixed_response(False, status["installedSdkVersion"], False, python_source, "sdk-version-mismatch")
    capabilities = status["capabilities"]
    if not isinstance(capabilities, dict) or not all(capabilities.values()):
        return fixed_response(False, required, False, python_source, "incompatible-api")
    return status


def auth_operations(sdk: Any) -> tuple[Any | None, Any | None]:
    """Resolve authentication operations, including releases with export omissions."""
    clear_auth = getattr(sdk, "clear_auth", None)
    is_authenticated = getattr(sdk, "is_authenticated", None)
    if callable(clear_auth) and callable(is_authenticated):
        return clear_auth, is_authenticated
    try:
        from panda_data import auth_manager
    except Exception:
        return None, None
    return getattr(auth_manager, "clear_auth", None), getattr(auth_manager, "is_authenticated", None)


def network_failure(error: BaseException) -> bool:
    """Classify transport failures without returning upstream exception text."""
    current: BaseException | None = error
    visited: set[int] = set()
    for _ in range(8):
        if current is None or id(current) in visited:
            return False
        visited.add(id(current))
        error_type = type(current)
        if (
            error_type.__module__.startswith(("requests", "urllib3", "httpx", "httpcore", "socket"))
            or error_type.__name__ in {
                "TimeoutError", "ConnectionError", "ConnectError", "ReadTimeout", "ConnectTimeout",
            }
        ):
            return True
        current = current.__cause__ or current.__context__
    return False


def clear_sdk_auth(sdk: Any) -> bool:
    """Remove the SDK-owned credential file after one-shot authentication."""
    clear_auth, _ = auth_operations(sdk)
    if not callable(clear_auth):
        return False
    try:
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            clear_auth()
    except Exception:
        return False
    return True


def validate_read(request: dict[str, Any], sdk: Any, status: dict[str, Any]) -> dict[str, Any] | None:
    """Execute the matrix-owned bounded read request after explicit login."""
    validation = request.get("validationCall")
    if validation is None:
        return None
    if not isinstance(validation, dict) or set(validation) != {"callable", "keywordArguments"}:
        return fixed_response(False, request["requiredSdkVersion"], status["logoutSupported"], request["pythonSource"], "data-validation-failed")
    keyword_arguments = validation.get("keywordArguments")
    if (
        validation.get("callable") != "get_market_data"
        or not isinstance(keyword_arguments, dict)
        or set(keyword_arguments) != {"symbol", "start_date", "end_date", "type"}
        or not isinstance(keyword_arguments.get("symbol"), str)
        or not re.fullmatch(r"[0-9]{6}\.(?:SZ|SH)", keyword_arguments["symbol"])
        or not isinstance(keyword_arguments.get("start_date"), str)
        or not re.fullmatch(r"[0-9]{8}", keyword_arguments["start_date"])
        or not isinstance(keyword_arguments.get("end_date"), str)
        or not re.fullmatch(r"[0-9]{8}", keyword_arguments["end_date"])
        or keyword_arguments.get("type") != "stock"
    ):
        return fixed_response(False, request["requiredSdkVersion"], status["logoutSupported"], request["pythonSource"], "data-validation-failed")
    callable_value = getattr(sdk, "get_market_data", None)
    if not callable(callable_value):
        return fixed_response(False, request["requiredSdkVersion"], status["logoutSupported"], request["pythonSource"], "incompatible-api")
    try:
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            callable_value(**keyword_arguments)
    except Exception as error:
        code = "network-unavailable" if network_failure(error) else "data-validation-failed"
        return fixed_response(False, request["requiredSdkVersion"], status["logoutSupported"], request["pythonSource"], code)
    return None


def current_sdk(required: str, python_source: str) -> tuple[Any | None, dict[str, Any]]:
    try:
        installed = importlib.metadata.version("panda_data")
    except importlib.metadata.PackageNotFoundError:
        return None, fixed_response(False, None, False, python_source, "sdk-not-ready")
    if installed != required:
        return None, fixed_response(False, installed, False, python_source, "sdk-version-mismatch")
    try:
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            import panda_data
    except Exception:
        return None, fixed_response(False, installed, False, python_source, "sdk-not-ready")
    clear_auth, is_authenticated = auth_operations(panda_data)
    return panda_data, fixed_response(True, installed, callable(clear_auth) and callable(is_authenticated), python_source)


def login(request: dict[str, Any]) -> dict[str, Any]:
    required = request["requiredSdkVersion"]
    python_source = request["pythonSource"]
    sdk, status = current_sdk(required, python_source)
    if sdk is None:
        return status
    if request.get("accountKind") not in {"phone", "email", "username"}:
        return fixed_response(False, required, status["logoutSupported"], python_source, "login-failed")
    username = request.get("login")
    password = request.get("password")
    base_url = request.get("baseURL")
    request["login"] = None
    request["password"] = None
    if not all(isinstance(value, str) and value for value in (username, password, base_url)):
        return fixed_response(False, required, status["logoutSupported"], python_source, "login-failed")
    probe = run_probe(private_python(request["runtimeRoot"]), required, python_source)
    if probe["installedSdkVersion"] != required:
        return probe
    try:
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            sdk.init_token(username=username, password=password, base_url=base_url)
    except Exception as error:
        code = "network-unavailable" if network_failure(error) else "login-failed"
        clear_sdk_auth(sdk)
        return fixed_response(False, required, status["logoutSupported"], python_source, code)
    finally:
        username = None
        password = None
    _, is_authenticated = auth_operations(sdk)
    authenticated = callable(is_authenticated)
    if authenticated:
        try:
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                authenticated = bool(is_authenticated())
        except Exception:
            authenticated = False
    if not authenticated:
        clear_sdk_auth(sdk)
        return fixed_response(False, required, status["logoutSupported"], python_source, "login-failed")
    validation_failure = validate_read(request, sdk, status)
    cleaned = clear_sdk_auth(sdk)
    if validation_failure is not None:
        return validation_failure
    if not cleaned:
        return fixed_response(False, required, status["logoutSupported"], python_source, "credential-cleanup-failed")
    return {
        **probe,
        "authenticated": True,
        "dataValidated": request.get("validationCall") is not None,
    }


def logout(request: dict[str, Any]) -> dict[str, Any]:
    required = request["requiredSdkVersion"]
    python_source = request["pythonSource"]
    sdk, status = current_sdk(required, python_source)
    if sdk is None:
        return status
    clear_auth, is_authenticated = auth_operations(sdk)
    if not callable(clear_auth) or not callable(is_authenticated):
        return fixed_response(False, required, False, python_source, "logout-unsupported")
    try:
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            clear_auth()
            still_authenticated = bool(is_authenticated())
    except Exception:
        return fixed_response(False, required, True, python_source, "logout-failed")
    if still_authenticated:
        return fixed_response(False, required, True, python_source, "logout-failed")
    return run_probe(private_python(request["runtimeRoot"]), required, python_source)


def main() -> int:
    try:
        raw = sys.stdin.buffer.read(65_537)
        if len(raw) > 65_536:
            raise ValueError("oversize")
        request = json.loads(raw.decode("utf-8"))
        if not isinstance(request, dict):
            raise ValueError("request")
        required = request.get("requiredSdkVersion")
        if not isinstance(required, str) or not VERSION_PATTERN.fullmatch(required):
            raise ValueError("version")
        runtime_root = request.get("runtimeRoot")
        if not isinstance(runtime_root, str) or not Path(runtime_root).is_absolute():
            raise ValueError("runtime")
        python_source = request.get("pythonSource")
        if python_source not in {"configured", "uv-managed"}:
            raise ValueError("python_source")
        operation = request.get("operation")
        if operation == "login":
            base_url = request.get("baseURL")
            parsed_url = urlsplit(base_url) if isinstance(base_url, str) else None
            if (
                parsed_url is None
                or parsed_url.scheme not in {"http", "https"}
                or not parsed_url.netloc
                or parsed_url.username is not None
                or parsed_url.password is not None
            ):
                raise ValueError("base_url")
        if operation == "describe":
            response = describe(request)
        elif operation == "bootstrap":
            response = bootstrap(request)
        elif operation == "login":
            response = login(request)
        elif operation == "logout":
            response = logout(request)
        else:
            response = fixed_response(False, None, False, python_source, "worker-failed")
    except Exception:
        source = request.get("pythonSource") if isinstance(locals().get("request"), dict) else "configured"
        if source not in {"configured", "uv-managed"}:
            source = "configured"
        response = fixed_response(False, None, False, source, "worker-failed")
    sys.stdout.write(json.dumps(response, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
