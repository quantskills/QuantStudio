from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import pandadata_security as security  # noqa: E402


def test_python_runtime_supports_311_and_312_only():
    assert security._validate_python_runtime((3, 11, 0)) == "3.11.0"
    assert security._validate_python_runtime((3, 12, 9)) == "3.12.9"

    with pytest.raises(security.PandaDataSecurityError, match="Python >=3.11"):
        security._validate_python_runtime((3, 10, 14))
    with pytest.raises(security.PandaDataSecurityError, match="<3.13"):
        security._validate_python_runtime((3, 13, 0))


def test_provider_https_endpoint_is_explicit_and_query_free(monkeypatch):
    monkeypatch.delenv("PANDADATA_BASE_URL", raising=False)
    monkeypatch.setenv("JAVA_SERVICE_BASE_URL", "https://legacy.example.test")

    with pytest.raises(security.PandaDataSecurityError, match="service provider"):
        security._validate_transport(security._base_url())

    for bad in (
        "http://data.example.test",
        "https://user:password@data.example.test",
        "https://data.example.test/api?token=secret",
        "https://data.example.test/api#fragment",
    ):
        with pytest.raises(security.PandaDataSecurityError):
            security._validate_transport(bad)


def test_tls_probe_uses_verified_context_and_server_name(monkeypatch):
    observed = {}

    class FakeRawSocket:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

    class FakeTlsSocket(FakeRawSocket):
        def version(self):
            return "TLSv1.3"

        def getpeercert(self):
            return {"notAfter": "Dec 31 23:59:59 2030 GMT"}

    class FakeContext:
        check_hostname = False
        verify_mode = None

        def wrap_socket(self, raw_socket, *, server_hostname):
            observed["raw_socket"] = raw_socket
            observed["server_hostname"] = server_hostname
            observed["check_hostname"] = self.check_hostname
            observed["verify_mode"] = self.verify_mode
            return FakeTlsSocket()

    context = FakeContext()
    monkeypatch.setattr(security.ssl, "create_default_context", lambda: context)

    def fake_connection(address, timeout):
        observed["address"] = address
        observed["timeout"] = timeout
        return FakeRawSocket()

    monkeypatch.setattr(security.socket, "create_connection", fake_connection)

    result = security._probe_tls(
        "https://data.example.test:8443/api", timeout=2.5
    )

    assert observed["address"] == ("data.example.test", 8443)
    assert observed["timeout"] == 2.5
    assert observed["server_hostname"] == "data.example.test"
    assert observed["check_hostname"] is True
    assert observed["verify_mode"] == security.ssl.CERT_REQUIRED
    assert result["tls_version"] == "TLSv1.3"
    assert result["certificate_not_after"] == "Dec 31 23:59:59 2030 GMT"


def test_startup_health_check_reports_readiness_without_secrets(monkeypatch):
    secret = "must-never-appear"
    modules = tuple(SimpleNamespace() for _ in range(5))
    monkeypatch.setenv(
        "PANDADATA_BASE_URL", "https://provider.example.test/api"
    )
    monkeypatch.setenv("PANDADATA_TOKEN", secret)
    monkeypatch.setattr(security, "_sdk_modules", lambda: modules)
    monkeypatch.setattr(
        security,
        "_probe_tls",
        lambda base_url, timeout: {
            "tls_version": "TLSv1.3",
            "certificate_not_after": "2030-12-31",
        },
    )

    report = security.startup_health_check(timeout=3.0)

    assert report["status"] == "ok"
    assert report["endpoint"] == "https://provider.example.test/api"
    assert report["auth_mode"] == "token"
    assert report["tls_version"] == "TLSv1.3"
    assert secret not in repr(report)
