"""Fail-closed PandaData startup and session security.

The upstream SDK currently defaults to HTTP and can persist recoverable
credentials. This adapter requires a provider-operated HTTPS endpoint,
verifies its certificate before login, disables SDK disk-based re-login,
and reinitializes the data client with token-only authentication.
"""
from __future__ import annotations

import importlib
import math
import os
import socket
import ssl
import sys
import tempfile
from typing import Any
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler


EMPTY_CREDENTIAL = ""
MIN_PYTHON = (3, 11)
MAX_PYTHON_EXCLUSIVE = (3, 13)
DEFAULT_HEALTH_TIMEOUT = 5.0
MAX_HEALTH_TIMEOUT = 30.0


class PandaDataSecurityError(RuntimeError):
    """Raised when a PandaData session cannot meet the security contract."""


class _RejectRedirects(HTTPRedirectHandler):
    """Reject redirects so credentials and tokens cannot change origin."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise HTTPError(
            req.full_url,
            code,
            "PandaData security policy rejects HTTP redirects",
            headers,
            fp,
        )


def _validate_python_runtime(version_info=None) -> str:
    """Validate the supported Python range and return a display version."""
    raw = version_info or sys.version_info[:3]
    version = tuple(int(part) for part in raw[:3])
    display = ".".join(str(part) for part in version)
    if version[:2] < MIN_PYTHON:
        raise PandaDataSecurityError(
            "Python >=3.11 is required for this skill"
        )
    if version[:2] >= MAX_PYTHON_EXCLUSIVE:
        raise PandaDataSecurityError(
            "This release supports Python >=3.11 and <3.13"
        )
    return display


def _base_url() -> str:
    """Return only the explicitly configured provider endpoint."""
    return os.environ.get("PANDADATA_BASE_URL", "").strip().rstrip("/")


def _validate_transport(base_url: str) -> str:
    """Require an unambiguous provider-operated HTTPS endpoint."""
    parsed = urlparse(base_url)
    if parsed.scheme.lower() != "https" or not parsed.hostname:
        raise PandaDataSecurityError(
            "PANDADATA_BASE_URL must be a complete https:// endpoint supplied "
            "by the PandaData service provider"
        )
    if parsed.username or parsed.password:
        raise PandaDataSecurityError(
            "PANDADATA_BASE_URL must not contain a username or password"
        )
    if parsed.query or parsed.fragment:
        raise PandaDataSecurityError(
            "PANDADATA_BASE_URL must not contain a query or fragment"
        )
    if any(character.isspace() for character in parsed.netloc):
        raise PandaDataSecurityError(
            "PANDADATA_BASE_URL contains invalid whitespace"
        )
    try:
        parsed.port
    except ValueError as exc:
        raise PandaDataSecurityError(
            "PANDADATA_BASE_URL contains an invalid port"
        ) from exc
    return base_url


def _validate_timeout(timeout: float) -> float:
    try:
        value = float(timeout)
    except (TypeError, ValueError) as exc:
        raise PandaDataSecurityError(
            "Health-check timeout must be a number"
        ) from exc
    if not math.isfinite(value) or not 0.1 <= value <= MAX_HEALTH_TIMEOUT:
        raise PandaDataSecurityError(
            "Health-check timeout must be between 0.1 and 30 seconds"
        )
    return value


def _probe_tls(
    base_url: str, *, timeout: float = DEFAULT_HEALTH_TIMEOUT
) -> dict[str, str]:
    """Verify DNS, TCP, hostname, certificate chain, and TLS negotiation."""
    base_url = _validate_transport(base_url)
    timeout = _validate_timeout(timeout)
    parsed = urlparse(base_url)
    hostname = parsed.hostname
    port = parsed.port or 443
    context = ssl.create_default_context()
    context.check_hostname = True
    context.verify_mode = ssl.CERT_REQUIRED

    try:
        with socket.create_connection((hostname, port), timeout=timeout) as raw:
            with context.wrap_socket(raw, server_hostname=hostname) as secure:
                tls_version = secure.version() or "unknown"
                certificate = secure.getpeercert()
    except (OSError, ssl.SSLError) as exc:
        raise PandaDataSecurityError(
            "PandaData provider HTTPS health check failed "
            f"({type(exc).__name__})"
        ) from None

    if not certificate:
        raise PandaDataSecurityError(
            "PandaData provider did not present a verifiable certificate"
        )
    return {
        "tls_version": tls_version,
        "certificate_not_after": str(certificate.get("notAfter", "unknown")),
    }


def _sdk_modules() -> tuple[Any, Any, Any, Any, Any]:
    try:
        auth_manager = importlib.import_module("panda_data.auth_manager")
        client_module = importlib.import_module("panda_data.client")
        token_module = importlib.import_module("panda_data.readers.init_token")
        transport_module = importlib.import_module("panda_data.transport.http")
        future_module = importlib.import_module(
            "panda_data.readers.future_reader"
        )
    except Exception as exc:
        raise PandaDataSecurityError(
            "Installed panda_data is incompatible with the secure adapter"
        ) from exc

    required = (
        (auth_manager, "save_auth_state"),
        (auth_manager, "_persist_credentials"),
        (auth_manager, "_read_persisted_credentials"),
        (client_module, "init"),
        (transport_module, "_auth_auto_login"),
        (transport_module, "_auth_re_login"),
        (transport_module.HTTPClient, "_delete_token_file"),
        (future_module, "download_future_research_report"),
    )
    if any(not callable(getattr(module, name, None)) for module, name in required):
        raise PandaDataSecurityError(
            "Installed panda_data is incompatible with the secure adapter"
        )
    if not hasattr(token_module, "init_client"):
        raise PandaDataSecurityError(
            "Installed panda_data cannot isolate the data client from passwords"
        )
    return (
        auth_manager,
        client_module,
        token_module,
        transport_module,
        future_module,
    )


def _auth_mode() -> str:
    token = os.environ.get("PANDADATA_TOKEN", "").strip()
    username = (
        os.environ.get("PANDADATA_USER")
        or os.environ.get("PANDADATA_MOBILE")
        or os.environ.get("PANDADATA_USERNAME")
        or os.environ.get("PANDA_USERNAME")
        or ""
    ).strip()
    password = os.environ.get("PANDADATA_PASSWORD", "").strip()
    if token:
        return "token"
    if username and password:
        return "account"
    return "missing"


def _preflight(timeout: float):
    python_version = _validate_python_runtime()
    endpoint = _validate_transport(_base_url())
    modules = _sdk_modules()
    tls = _probe_tls(endpoint, timeout=timeout)
    return python_version, endpoint, modules, tls


def startup_health_check(
    *,
    timeout: float = DEFAULT_HEALTH_TIMEOUT,
    require_credentials: bool = True,
) -> dict[str, str]:
    """Run the startup checks and return a secret-free readiness report."""
    python_version, endpoint, _modules, tls = _preflight(timeout)
    auth_mode = _auth_mode()
    if require_credentials and auth_mode == "missing":
        raise PandaDataSecurityError(
            "Set PANDADATA_TOKEN or both PANDADATA_USER and "
            "PANDADATA_PASSWORD"
        )
    return {
        "status": "ok",
        "python": python_version,
        "endpoint": endpoint,
        "sdk": "compatible",
        "auth_mode": auth_mode,
        **tls,
    }


def _install_memory_only_guards(
    auth_manager: Any,
    transport_module: Any,
    future_module: Any,
) -> None:
    """Disable credential persistence and disk re-login process-wide."""

    def _do_not_persist(*args, **kwargs) -> None:
        return None

    def _do_not_read(*args, **kwargs) -> None:
        return None

    def _do_not_relogin(*args, **kwargs) -> bool:
        return False

    def _do_not_delete(*args, **kwargs) -> None:
        return None

    def _disabled_disk_feature(*args, **kwargs):
        raise PandaDataSecurityError(
            "The memory-only session disables third-party report downloads "
            "that depend on user.json"
        )

    isolated_path = os.path.join(
        tempfile.gettempdir(),
        f"quantskills-pandadata-disabled-{os.getpid()}",
        "user.json",
    )

    current_build_opener = transport_module.build_opener
    if not getattr(current_build_opener, "_quantskills_guarded", False):

        def _secure_build_opener(*handlers):
            return current_build_opener(_RejectRedirects(), *handlers)

        _secure_build_opener._quantskills_guarded = True
        transport_module.build_opener = _secure_build_opener

    auth_manager._persist_credentials = _do_not_persist
    auth_manager._read_persisted_credentials = _do_not_read
    auth_manager._get_user_json_path = lambda: isolated_path
    auth_manager.auto_login_from_disk = _do_not_relogin
    auth_manager.re_login = _do_not_relogin
    transport_module._auth_auto_login = _do_not_relogin
    transport_module._auth_re_login = _do_not_relogin
    transport_module.HTTPClient._delete_token_file = _do_not_delete
    future_module.download_future_research_report = _disabled_disk_feature


def establish_session(
    panda_data_module: Any,
    *,
    username: str = "",
    password: str = "",
    token: str = "",
    health_timeout: float = DEFAULT_HEALTH_TIMEOUT,
) -> str:
    """Create a verified, memory-only, token-authenticated session."""
    _python, base_url, modules, _tls = _preflight(health_timeout)
    username = (username or "").strip()
    password = (password or "").strip()
    token = (token or "").strip()
    if not token and (not username or not password):
        raise PandaDataSecurityError(
            "A temporary token or complete PandaData account is required"
        )

    (
        auth_manager,
        client_module,
        token_module,
        transport_module,
        future_module,
    ) = modules
    _install_memory_only_guards(auth_manager, transport_module, future_module)
    original_init_client = token_module.init_client

    def _do_not_persist(*args, **kwargs) -> None:
        return None

    token_module.init_client = _do_not_persist
    try:
        if token:
            session_token = token
            expires_in = 14400
        else:
            session_token = panda_data_module.init_token(
                username=username,
                password=password,
                base_url=base_url,
            )
            expires_in = int(auth_manager.get_token_ttl())
        if not session_token:
            raise PandaDataSecurityError(
                "PandaData did not return a valid token"
            )
        auth_manager.save_auth_state(
            username=EMPTY_CREDENTIAL,
            password=EMPTY_CREDENTIAL,
            base_url=base_url,
            token=session_token,
            expires_in=expires_in,
        )

        config_module = importlib.import_module("panda_data.config")
        sdk_config = config_module.get_config()
        sdk_config["DEFAULT_USERNAME"] = EMPTY_CREDENTIAL
        sdk_config["DEFAULT_PASSWORD"] = EMPTY_CREDENTIAL
        client = client_module.init(
            username=EMPTY_CREDENTIAL,
            password=EMPTY_CREDENTIAL,
            base_url=base_url,
            verify_ssl=True,
        )
        client_config = getattr(client, "config", None)
        if (
            getattr(client_config, "username", "")
            or getattr(client_config, "password", "")
            or getattr(client_config, "verify_ssl", True) is not True
        ):
            raise PandaDataSecurityError(
                "PandaData client did not preserve token-only verified TLS"
            )
        return str(session_token)
    finally:
        token_module.init_client = original_init_client
