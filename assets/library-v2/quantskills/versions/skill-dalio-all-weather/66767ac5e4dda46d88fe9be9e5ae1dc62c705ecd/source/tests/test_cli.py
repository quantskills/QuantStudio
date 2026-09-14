from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import cli  # noqa: E402
import pandadata_security as security  # noqa: E402


@pytest.fixture(autouse=True)
def _provider_tls_is_healthy(monkeypatch):
    monkeypatch.setattr(
        security,
        "_probe_tls",
        lambda base_url, timeout=5.0: {
            "tls_version": "TLSv1.3",
            "certificate_not_after": "Dec 31 23:59:59 2030 GMT",
        },
    )


def test_default_credential_file_is_user_level_only():
    assert cli._env_candidates() == [Path.home() / ".pandadata.env"]


def test_load_dotenv_reads_file_without_overwriting_existing_env(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "PANDADATA_USER=test_user\nPANDADATA_PASSWORD=from_file\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("PANDADATA_PASSWORD", "already_set")
    monkeypatch.delenv("PANDADATA_USER", raising=False)

    loaded = cli._load_dotenv([env_file])

    assert loaded == env_file
    assert os.environ["PANDADATA_USER"] == "test_user"
    assert os.environ["PANDADATA_PASSWORD"] == "already_set"


def test_load_dotenv_ignores_unrelated_keys(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "PANDADATA_USER=test_user\nUNRELATED_DANGEROUS_KEY=must_not_load\n",
        encoding="utf-8",
    )
    monkeypatch.delenv("PANDADATA_USER", raising=False)
    monkeypatch.delenv("UNRELATED_DANGEROUS_KEY", raising=False)

    cli._load_dotenv([env_file])

    assert os.environ["PANDADATA_USER"] == "test_user"
    assert "UNRELATED_DANGEROUS_KEY" not in os.environ


def test_output_date_uses_data_end_not_runtime_today(monkeypatch):
    monkeypatch.setenv("ALLW_TODAY", "20990101")
    assert cli._date_tag("2026-07-10") == "20260710"


def test_frame_fingerprint_is_deterministic_and_data_sensitive():
    import pandas as pd

    frame = pd.DataFrame({"x": [1.0, 2.0]},
                         index=pd.to_datetime(["2026-01-01", "2026-01-02"]))
    first = cli._frame_fingerprint(frame)
    second = cli._frame_fingerprint(frame.copy())
    changed = frame.copy()
    changed.iloc[1, 0] = 3.0

    assert first == second
    assert first != cli._frame_fingerprint(changed)


def test_run_metadata_records_all_material_defaults():
    import pandas as pd

    args = SimpleNamespace(start="20180101", end="20260710",
                           rebalance="Q", vol_window=60, cost_bps=5.0,
                           turnover_threshold=0.05,
                           rebalance_on_regime_change=False)
    frame = pd.DataFrame(
        {
            "stock": [1.0],
            "bond_long": [1.0],
            "bond_mid": [1.0],
            "gold": [1.0],
            "commodity": [1.0],
        },
        index=pd.to_datetime(["2018-01-02"]),
    )
    meta = cli._build_run_metadata(
        args,
        "20260710",
        frame,
        frame,
        {"stock": "etf:510300.SH [close/pre_close]"},
        data_start="20161127",
        actual_eval_start="20180102",
    )
    config = meta["run_config"]

    for key in [
        "turnover_threshold", "vol_min_periods", "vol_floor",
        "cpi_publication_lag_days", "gdp_publication_lag_days",
        "regime_long_change_days", "regime_smooth_window",
        "regime_hysteresis_days", "allocation_method",
        "rebalance_on_regime_change", "return_method",
        "cost_convention", "requested_start", "data_start",
        "actual_eval_start", "cpi_symbol", "gdp_symbol",
        "base_allocation", "quadrant_tilt", "asset_baskets",
    ]:
        assert key in config
    assert config["cpi_publication_lag_days"] == 15
    assert config["gdp_publication_lag_days"] == 30
    assert config["regime_long_change_days"] == 63
    assert config["regime_smooth_window"] == 60
    assert config["regime_hysteresis_days"] == 20
    assert config["allocation_method"] == "inverse_volatility"
    assert "panda_data" in meta["software"]
    assert meta["software"]["skill_version"]
    assert len(meta["software"]["source_sha256"]) == 64
    assert meta["run_id"]
    assert meta["data_quality"]["minimum_asset_coverage"] == 0.8
    assert set(meta["data_quality"]["asset_coverage"]) == {
        "stock", "bond_long", "bond_mid", "gold", "commodity",
    }
    assert any("不构成实盘许可" in item for item in meta["limitations"])


def test_warmup_start_is_400_calendar_days_before_requested_start():
    import pandas as pd

    requested = pd.Timestamp("2025-01-01")
    data_start = pd.Timestamp(cli._warmup_start("20250101"))

    assert requested - data_start == pd.Timedelta(days=400)


def test_run_id_is_deterministic_and_changes_with_material_parameters():
    base = SimpleNamespace(
        start="20180101",
        rebalance="Q",
        vol_window=60,
        cost_bps=5.0,
        turnover_threshold=0.05,
        rebalance_on_regime_change=False,
    )
    changed = SimpleNamespace(**{**vars(base), "cost_bps": 10.0})

    first = cli._build_run_id(base, "20260710")
    second = cli._build_run_id(base, "20260710")
    different = cli._build_run_id(changed, "20260710")

    assert first == second
    assert first != different
    assert "v60" in first
    assert "c5" in first


def test_cli_rejects_invalid_backtest_parameters_before_execution():
    parser = cli.build_parser()

    for invalid in ("-1", "nan", "inf", "-inf"):
        with pytest.raises(SystemExit):
            parser.parse_args([
                "backtest", "--start", "20200101",
                "--cost-bps", invalid,
            ])
        with pytest.raises(SystemExit):
            parser.parse_args([
                "backtest", "--start", "20200101",
                "--turnover-threshold", invalid,
            ])
    with pytest.raises(SystemExit):
        parser.parse_args([
            "backtest", "--start", "20200101", "--vol-window", "0",
        ])


def test_interest_rate_diagnostic_requires_explicit_cli_symbol():
    args = cli.build_parser().parse_args([
        "diagnose-regime",
        "--start", "20200101",
        "--end", "20251231",
        "--ir-symbol", "IR_EXPLICIT",
    ])

    assert args.ir_symbol == "IR_EXPLICIT"


def test_backtest_command_uses_warmup_and_parameterized_output_directory(
        tmp_path, monkeypatch):
    import numpy as np
    import pandas as pd

    args = SimpleNamespace(
        start="20200101",
        end="20201231",
        rebalance="Q",
        vol_window=60,
        cost_bps=5.0,
        turnover_threshold=0.05,
        rebalance_on_regime_change=False,
    )
    calls = []

    def fake_load_all(start, end):
        calls.append((start, end))
        dates = pd.bdate_range(start, end)
        dates = dates[dates != pd.Timestamp("2020-01-01")]
        rng = np.random.default_rng(7)
        returns = pd.DataFrame(
            rng.normal(0.0001, 0.005, size=(len(dates), 5)),
            index=dates,
            columns=[
                "stock", "bond_long", "bond_mid", "gold", "commodity",
            ],
        )
        macro = pd.DataFrame(
            {
                "cpi_yoy": np.sin(np.arange(len(dates)) / 80),
                "gdp_yoy": np.cos(np.arange(len(dates)) / 90),
            },
            index=dates,
        )
        used = {
            name: f"idx:{name} [close/pre_close]"
            for name in returns.columns
        }
        return returns, macro, used

    monkeypatch.setattr(cli, "load_all", fake_load_all)
    monkeypatch.setattr(cli, "_out_dir", lambda: tmp_path)
    monkeypatch.setattr(cli, "_plot_backtest", lambda result, out: None)

    rc = cli.cmd_backtest(args)

    assert rc == 0
    assert calls == [(cli._warmup_start(args.start), args.end)]
    run_id = cli._build_run_id(args, args.end)
    output = tmp_path / f"backtest_20201231_{run_id}"
    assert output.is_dir()
    metadata = json.loads(
        (output / "metrics.json").read_text(encoding="utf-8")
    )
    assert metadata["run_config"]["requested_start"] == "20200101"
    assert metadata["run_config"]["data_start"] == cli._warmup_start(
        args.start
    )
    assert metadata["run_config"]["actual_eval_start"] == "20200102"
    assert metadata["start"] == "2020-01-02"
    report = (output / "report.md").read_text(encoding="utf-8")
    assert "RESEARCH_ONLY" in "\n".join(report.splitlines()[:5])
    assert "不可直接用于实盘" in "\n".join(report.splitlines()[:8])
    assert "L1" in report
    assert "风险贡献" in report
    assert "decision_dates.csv" in report
    assert "target_weights.csv" in report
    decisions = pd.read_csv(output / "decision_dates.csv")
    targets = pd.read_csv(output / "target_weights.csv")
    assert list(decisions.columns) == [
        "decision_date", "next_common_trading_date",
    ]
    assert {
        "decision_date", "next_common_trading_date",
        "stock", "bond_long", "bond_mid", "gold", "commodity",
    }.issubset(targets.columns)
    assert not decisions.empty
    assert len(targets) == len(decisions)
    observed_execution = decisions.dropna(
        subset=["next_common_trading_date"]
    )
    assert (
        pd.to_datetime(observed_execution["next_common_trading_date"])
        > pd.to_datetime(observed_execution["decision_date"])
    ).all()
    assert decisions["next_common_trading_date"].isna().sum() == 1


def test_skill_docs_describe_strict_quarter_confirmation_and_audit_exports():
    for filename in ("SKILL.md", "README.md"):
        text = (ROOT / filename).read_text(encoding="utf-8")
        assert "decision_dates.csv" in text
        assert "target_weights.csv" in text
        assert "完整季度" in text
        assert "自然季末" in text


def test_existing_output_with_different_fingerprint_is_never_overwritten(
        tmp_path):
    output = tmp_path / "backtest_existing"
    output.mkdir()
    original = {
        "run_id": "same-parameters",
        "data_fingerprint": {
            "returns_sha256": "old-returns",
            "macro_sha256": "old-macro",
        },
        "software": {"source_sha256": "old-source"},
    }
    metrics = output / "metrics.json"
    metrics.write_text(json.dumps(original), encoding="utf-8")

    incoming = {
        "run_id": "same-parameters",
        "data_fingerprint": {
            "returns_sha256": "new-returns",
            "macro_sha256": "old-macro",
        },
        "software": {"source_sha256": "old-source"},
    }

    with pytest.raises(RuntimeError, match="fingerprint"):
        cli._prepare_run_output_dir(output, incoming)

    assert json.loads(metrics.read_text(encoding="utf-8")) == original


def test_current_allocation_outputs_risk_contribution_diagnostic(
        tmp_path, monkeypatch):
    import numpy as np
    import pandas as pd

    dates = pd.bdate_range("2025-01-02", periods=180)
    rng = np.random.default_rng(11)
    returns = pd.DataFrame(
        rng.normal(0.0001, 0.005, size=(len(dates), 5)),
        index=dates,
        columns=["stock", "bond_long", "bond_mid", "gold", "commodity"],
    )
    macro = pd.DataFrame(
        {
            "cpi_yoy": np.sin(np.arange(len(dates)) / 40),
            "gdp_yoy": np.cos(np.arange(len(dates)) / 45),
        },
        index=dates,
    )
    used = {name: f"idx:{name} [close_diff]" for name in returns.columns}
    monkeypatch.setattr(
        cli, "load_all", lambda start, end: (returns, macro, used)
    )
    monkeypatch.setattr(cli, "_out_dir", lambda: tmp_path)

    rc = cli.cmd_current_allocation(
        SimpleNamespace(start="20250101", end="20250910")
    )

    assert rc == 0
    output = pd.read_csv(
        tmp_path / "allocation_20250910.csv",
        index_col=0,
    )
    assert "risk_contribution_60d" in output.columns
    assert "risk_concentration_max" in output.columns
    assert set(output["research_status"]) == {"RESEARCH_ONLY"}
    assert np.isclose(output["risk_contribution_60d"].sum(), 1.0)
    metadata = json.loads(
        (tmp_path / "allocation_20250910_metadata.json").read_text(
            encoding="utf-8"
        )
    )
    assert metadata["config"]["long_change_days"] == 63
    assert metadata["config"]["smooth_window"] == 60
    assert metadata["config"]["hysteresis_days"] == 20
    assert metadata["config"]["cpi_publication_lag_days"] == 15
    assert metadata["config"]["gdp_publication_lag_days"] == 30
    assert metadata["data_fingerprint"]["returns_sha256"]
    assert metadata["software"]["source_sha256"]


def test_regime_diagnostic_fetches_only_explicit_ir_symbol_and_records_metadata(
        tmp_path, monkeypatch):
    import numpy as np
    import pandas as pd

    dates = pd.bdate_range("2024-01-02", periods=180)
    returns = pd.DataFrame(
        0.001,
        index=dates,
        columns=["stock", "bond_long", "bond_mid", "gold", "commodity"],
    )
    macro = pd.DataFrame(
        {
            "cpi_yoy": np.sin(np.arange(len(dates)) / 30),
            "gdp_yoy": np.cos(np.arange(len(dates)) / 35),
        },
        index=dates,
    )
    ir_calls = []

    monkeypatch.setattr(
        cli,
        "load_all",
        lambda start, end: (returns, macro, {}),
    )

    def fake_fetch_ir(start, end, symbol=None):
        ir_calls.append((start, end, symbol))
        return pd.DataFrame(
            {"period_date": ["20240131"], "data_value": [2.5]}
        )

    monkeypatch.setattr(cli, "fetch_macro_ir", fake_fetch_ir, raising=False)
    monkeypatch.setattr(cli, "_out_dir", lambda: tmp_path)
    monkeypatch.setattr(cli, "_plot_regime", lambda regime, out: None)
    args = SimpleNamespace(
        start="20240101",
        end="20240910",
        ir_symbol="IR_EXPLICIT",
    )

    rc = cli.cmd_diagnose_regime(args)

    assert rc == 0
    assert ir_calls == [("20240101", "20240910", "IR_EXPLICIT")]
    output = tmp_path / "diagnose_20240910"
    assert (output / "interest_rate_diagnostic.csv").is_file()
    diagnostics = pd.read_csv(output / "diagnostics.csv")
    interest = pd.read_csv(output / "interest_rate_diagnostic.csv")
    assert set(diagnostics["research_status"]) == {"RESEARCH_ONLY"}
    assert set(interest["research_status"]) == {"RESEARCH_ONLY"}
    metadata = json.loads(
        (output / "diagnostics_metadata.json").read_text(encoding="utf-8")
    )
    assert metadata["config"]["ir_symbol"] == "IR_EXPLICIT"
    assert metadata["config"]["long_change_days"] == 63
    assert metadata["config"]["smooth_window"] == 60
    assert metadata["config"]["hysteresis_days"] == 20
    assert metadata["software"]["source_sha256"]
    assert metadata["data_fingerprint"]["macro_sha256"]


def test_check_login_fails_when_credentials_are_missing(monkeypatch, capsys):
    monkeypatch.setattr(cli, "_load_dotenv", lambda candidates=None: None)
    monkeypatch.delenv("PANDADATA_USER", raising=False)
    monkeypatch.delenv("PANDADATA_PASSWORD", raising=False)
    monkeypatch.delenv("PANDA_USERNAME", raising=False)
    monkeypatch.delenv("PANDA_PASSWORD", raising=False)

    rc = cli.cmd_check_login(SimpleNamespace())

    output = capsys.readouterr().out
    assert rc != 0
    assert "缺少" in output


def test_health_check_reports_safely(monkeypatch, capsys):
    secret = "must-never-appear"
    monkeypatch.setenv("PANDADATA_TOKEN", secret)
    monkeypatch.setattr(
        cli,
        "startup_health_check",
        lambda **kwargs: {
            "status": "ok",
            "python": "3.11.9",
            "endpoint": "https://provider.example.test/api",
            "sdk": "compatible",
            "auth_mode": "token",
            "tls_version": "TLSv1.3",
            "certificate_not_after": "2030-12-31",
        },
    )

    rc = cli.cmd_health_check(
        SimpleNamespace(timeout=3.0, transport_only=False)
    )

    output = capsys.readouterr().out
    assert rc == 0
    assert "OK" in output
    assert secret not in output


def test_check_login_calls_login_and_never_prints_secret(monkeypatch, capsys):
    secret = "do-not-print-this"
    calls = []

    def fake_session(module, *, username, password, token):
        calls.append((username, password, token))
        return "token-value"

    monkeypatch.setattr(cli, "establish_session", fake_session)
    monkeypatch.setenv("PANDADATA_USER", "test_user")
    monkeypatch.setenv("PANDADATA_PASSWORD", secret)

    rc = cli.cmd_check_login(SimpleNamespace())

    output = capsys.readouterr().out
    assert rc == 0
    assert calls == [("test_user", secret, "")]
    assert secret not in output
    assert "OK" in output


def test_check_login_reports_remote_failure_without_secret(monkeypatch, capsys):
    secret = "do-not-print-this"

    def fake_session(module, **kwargs):
        raise RuntimeError("invalid credentials")

    monkeypatch.setattr(cli, "establish_session", fake_session)
    monkeypatch.setenv("PANDADATA_USER", "test_user")
    monkeypatch.setenv("PANDADATA_PASSWORD", secret)

    rc = cli.cmd_check_login(SimpleNamespace())

    output = capsys.readouterr().out
    assert rc != 0
    assert secret not in output
    assert "FAIL" in output


def test_login_retries_transient_failure(monkeypatch):
    calls = []

    def fake_session(module, *, username, password, token):
        calls.append((username, password, token))
        if len(calls) < 3:
            raise RuntimeError("temporary timeout")
        return "token-value"

    monkeypatch.setattr(cli, "establish_session", fake_session)
    monkeypatch.setattr(cli.time, "sleep", lambda seconds: None)
    monkeypatch.setenv("PANDADATA_USER", "test_user")
    monkeypatch.setenv("PANDADATA_PASSWORD", "do-not-print-this")

    assert cli._login() == "token-value"
    assert len(calls) == 3


def test_login_rejects_http(monkeypatch):
    class FakePandaData:
        @staticmethod
        def init_token(**kwargs):
            return "must-not-be-used"

    monkeypatch.setitem(sys.modules, "panda_data", FakePandaData)
    monkeypatch.setenv("PANDADATA_USER", "test_user")
    monkeypatch.setenv("PANDADATA_PASSWORD", "test_password")
    monkeypatch.setenv(
        "PANDADATA_BASE_URL", "http://data.example.test"
    )
    monkeypatch.delenv("PANDADATA_TOKEN", raising=False)

    with pytest.raises(
        RuntimeError, match="https://"
    ):
        cli._login()


def test_login_uses_memory_only_auth_and_token_only_data_client(
        tmp_path, monkeypatch):
    import panda_data
    import panda_data.auth_manager as auth_manager
    import panda_data.client as panda_client

    calls = []
    monkeypatch.setattr(auth_manager, "_user_json_dir", str(tmp_path))

    def fake_init_token(username="", password="", base_url=None, **kwargs):
        auth_manager.save_auth_state(
            username,
            password,
            base_url or "",
            "token-value",
            3600,
        )
        return "token-value"

    def fake_init(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(
            config=SimpleNamespace(
                username="",
                password="",
                verify_ssl=kwargs["verify_ssl"],
            )
        )

    monkeypatch.setattr(panda_data, "init_token", fake_init_token)
    monkeypatch.setattr(panda_client, "init", fake_init)
    monkeypatch.setenv("PANDADATA_USER", "test_user")
    monkeypatch.setenv("PANDADATA_PASSWORD", "test_password")
    monkeypatch.setenv(
        "PANDADATA_BASE_URL", "https://data.example.test"
    )
    monkeypatch.delenv("PANDADATA_TOKEN", raising=False)

    assert cli._login() == "token-value"
    assert not (tmp_path / "user.json").exists()
    assert calls[-1]["username"] == ""
    assert calls[-1]["password"] == ""
    assert calls[-1]["verify_ssl"] is True
    assert auth_manager.get_username() == ""
    assert auth_manager.get_password() is None
    assert auth_manager.re_login() is False


def test_login_accepts_ephemeral_token_without_password(
        tmp_path, monkeypatch):
    import panda_data
    import panda_data.auth_manager as auth_manager
    import panda_data.client as panda_client

    calls = []
    monkeypatch.setattr(auth_manager, "_user_json_dir", str(tmp_path))
    monkeypatch.setattr(
        panda_data,
        "init_token",
        lambda **kwargs: pytest.fail("password login must not run"),
    )
    def fake_init(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(
            config=SimpleNamespace(
                username="",
                password="",
                verify_ssl=kwargs["verify_ssl"],
            )
        )

    monkeypatch.setattr(panda_client, "init", fake_init)
    monkeypatch.delenv("PANDADATA_USER", raising=False)
    monkeypatch.delenv("PANDADATA_PASSWORD", raising=False)
    monkeypatch.setenv("PANDADATA_TOKEN", "ephemeral-token")
    monkeypatch.setenv(
        "PANDADATA_BASE_URL", "https://data.example.test"
    )

    assert cli._login() == "ephemeral-token"
    assert not (tmp_path / "user.json").exists()
    assert calls[-1]["username"] == ""
    assert calls[-1]["password"] == ""
    assert calls[-1]["verify_ssl"] is True


def test_main_runs_login_before_data_command(monkeypatch):
    calls = []
    monkeypatch.setattr(cli, "_load_dotenv", lambda candidates=None: None)
    monkeypatch.setattr(cli, "_login", lambda: calls.append("login") or "ok")
    monkeypatch.setattr(
        cli,
        "cmd_current_allocation",
        lambda args: calls.append("command") or 0,
    )

    rc = cli.main(["current-allocation"])

    assert rc == 0
    assert calls == ["login", "command"]


def test_main_fails_closed_before_data_access(monkeypatch, capsys):
    secret = "must-never-appear"
    monkeypatch.setattr(cli, "_load_dotenv", lambda candidates=None: None)
    monkeypatch.setattr(
        cli,
        "_login",
        lambda: (_ for _ in ()).throw(RuntimeError(secret)),
    )
    monkeypatch.setattr(
        cli,
        "cmd_current_allocation",
        lambda args: pytest.fail("data command must not run"),
    )

    rc = cli.main(["current-allocation"])

    output = capsys.readouterr()
    assert rc != 0
    assert secret not in output.out + output.err


def test_login_guards_ignore_existing_sdk_credential_file(
        tmp_path, monkeypatch):
    import panda_data.auth_manager as auth_manager
    import panda_data.readers.future_reader as future_reader
    import panda_data.transport.http as transport
    from pandadata_security import (
        PandaDataSecurityError,
        _RejectRedirects,
        _install_memory_only_guards,
    )
    from urllib.error import HTTPError
    from urllib.request import Request

    marker = '{"encrypted_credentials":"must-not-be-read"}'
    credential_file = tmp_path / "user.json"
    credential_file.write_text(marker, encoding="utf-8")
    legacy_clear_auth = auth_manager.clear_auth
    monkeypatch.setattr(auth_manager, "_user_json_dir", str(tmp_path))
    _install_memory_only_guards(
        auth_manager, transport, future_reader
    )

    assert auth_manager.get_decrypted_credentials() is None
    assert auth_manager.re_login() is False
    assert transport._auth_auto_login() is False
    assert transport._auth_re_login() is False
    legacy_clear_auth()
    assert credential_file.read_text(encoding="utf-8") == marker
    with pytest.raises(PandaDataSecurityError):
        future_reader.download_future_research_report(
            symbol="CU", date="20260710", pub="test"
        )
    client = transport.HTTPClient(transport.HTTPClientConfig(
        base_url="https://data.example.test"
    ))
    redirect_guard = next(
        item for item in client._opener.handlers
        if isinstance(item, _RejectRedirects)
    )
    for target in (
        "http://data.example.test/downgrade",
        "https://other.example.test/cross-origin",
    ):
        with pytest.raises(HTTPError):
            redirect_guard.redirect_request(
                Request("https://data.example.test/source"),
                None,
                302,
                "Found",
                {},
                target,
            )
    monkeypatch.setattr(
        client, "_get_token_file_path", lambda: str(credential_file)
    )
    client.close()
    assert credential_file.read_text(encoding="utf-8") == marker
