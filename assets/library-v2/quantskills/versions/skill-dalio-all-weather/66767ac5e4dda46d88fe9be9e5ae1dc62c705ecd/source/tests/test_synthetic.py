"""Offline synthetic tests for data, regime, target, and backtest contracts."""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

_HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(_HERE.parent / "scripts"))

import data_layer  # noqa: E402
import portfolio   # noqa: E402
from data_layer import align_macro_to_daily  # noqa: E402
from regime import classify                  # noqa: E402
from portfolio import (                       # noqa: E402
    build_weights, BASE_ALLOCATION)
from backtest import run as run_backtest      # noqa: E402


# 固定种子构造 12 年日频合成数据
def _make_synth():
    rng = np.random.default_rng(20260712)
    dates = pd.bdate_range("2014-01-02", "2026-06-30")
    n = len(dates)
    # 五类资产：不同 μ 与 σ；股票波动最高，商品次之，长债最低
    mu = np.array([0.00035, 0.00015, 0.00010, 0.00025, 0.00030])
    sig = np.array([0.014,   0.004,   0.003,   0.010,   0.012])
    R = rng.normal(mu, sig, size=(n, 5))
    cols = ["stock", "bond_long", "bond_mid", "gold", "commodity"]
    returns = pd.DataFrame(R, index=dates, columns=cols)

    # 合成宏观月频（月末公布）
    months = pd.date_range("2013-01-31", "2026-05-31", freq="ME")
    cpi = pd.DataFrame({
        "date": months,
        "cpi_yoy": 2 + np.sin(np.linspace(0, 8, len(months))) + rng.normal(0, 0.3, len(months)),
    })
    gdp = pd.DataFrame({
        "date": months,
        "gdp_yoy": 5 + np.cos(np.linspace(0, 6, len(months))) + rng.normal(0, 0.4, len(months)),
    })
    return returns, cpi, gdp


def test_macro_publication_lags_are_cpi_15_and_gdp_30_days():
    trading_days = pd.bdate_range("2020-02-03", "2020-03-31")
    cpi = pd.DataFrame({
        "date": pd.to_datetime(["2020-01-31", "2020-02-29"]),
        "cpi_yoy": [1.0, 2.0],
    })
    gdp = pd.DataFrame({
        "date": pd.to_datetime(["2020-01-31", "2020-02-29"]),
        "gdp_yoy": [10.0, 20.0],
    })

    aligned = align_macro_to_daily(cpi, gdp, trading_days)

    assert pd.isna(aligned.loc["2020-02-14", "cpi_yoy"])
    assert aligned.loc["2020-02-17", "cpi_yoy"] == 1.0
    assert aligned.loc["2020-03-13", "cpi_yoy"] == 1.0
    assert aligned.loc["2020-03-16", "cpi_yoy"] == 2.0
    assert pd.isna(aligned.loc["2020-02-28", "gdp_yoy"])
    assert aligned.loc["2020-03-02", "gdp_yoy"] == 10.0
    assert aligned.loc["2020-03-27", "gdp_yoy"] == 10.0
    assert aligned.loc["2020-03-30", "gdp_yoy"] == 20.0


def test_extract_macro_series_handles_real_pandadata_schema():
    raw = pd.DataFrame({
        "symbol": ["PI0000047", "PI0000001", "PI0000047"],
        "period_date": ["20240229", "20240229", "20240131"],
        "data_value": [0.7, -0.1, 0.8],
    })

    result = data_layer.extract_macro_series(
        raw, symbol="PI0000047", value_name="cpi_yoy"
    )

    assert list(result.columns) == ["date", "cpi_yoy"]
    assert result["date"].tolist() == [
        pd.Timestamp("2024-01-31"), pd.Timestamp("2024-02-29")
    ]
    assert result["cpi_yoy"].tolist() == [0.8, 0.7]


def test_interest_rate_fetch_requires_an_explicit_symbol(monkeypatch):
    calls = []

    class FakePandaData:
        @staticmethod
        def get_macro_ir(**kwargs):
            calls.append(kwargs)
            return pd.DataFrame()

    monkeypatch.setattr(data_layer, "_pd_module", lambda: FakePandaData)
    monkeypatch.setattr(
        data_layer,
        "_cached",
        lambda fn_name, loader, **kwargs: loader(),
    )

    with pytest.raises(ValueError, match="symbol"):
        data_layer.fetch_macro_ir("20250101", "20251231")

    data_layer.fetch_macro_ir(
        "20250101", "20251231", symbol="IR_EXPLICIT"
    )
    assert calls == [{
        "symbol": "IR_EXPLICIT",
        "start_date": "20250101",
        "end_date": "20251231",
    }]


def test_pandadata_fetch_retries_three_times_without_logging_parameters(
        tmp_path, monkeypatch, caplog):
    calls = []
    sleeps = []
    secret_symbol = "DO-NOT-LOG-THIS-SYMBOL"

    class FakePandaData:
        @staticmethod
        def get_index_daily(**kwargs):
            calls.append(kwargs)
            if len(calls) < 3:
                raise TimeoutError("temporary outage")
            return pd.DataFrame({
                "trade_date": ["20250102"],
                "close": [100.0],
            })

    monkeypatch.setattr(data_layer, "_pd_module", lambda: FakePandaData)
    monkeypatch.setattr(data_layer, "_cache_dir", lambda: tmp_path)
    monkeypatch.setattr(
        data_layer.time,
        "sleep",
        lambda seconds: sleeps.append(seconds),
    )

    result = data_layer.fetch_index_daily(
        secret_symbol,
        "20250101",
        "20250131",
    )

    assert len(calls) == 3
    assert sleeps == [0.25, 0.5]
    assert not result.empty
    assert secret_symbol not in caplog.text


def test_pandadata_fetch_stops_after_three_failures(
        tmp_path, monkeypatch):
    calls = []

    class FakePandaData:
        @staticmethod
        def get_index_daily(**kwargs):
            calls.append(kwargs)
            raise TimeoutError("temporary outage")

    monkeypatch.setattr(data_layer, "_pd_module", lambda: FakePandaData)
    monkeypatch.setattr(data_layer, "_cache_dir", lambda: tmp_path)
    monkeypatch.setattr(data_layer.time, "sleep", lambda seconds: None)

    with pytest.raises(TimeoutError, match="temporary outage"):
        data_layer.fetch_index_daily(
            "000300.SH",
            "20250101",
            "20250131",
        )

    assert len(calls) == 3


def test_basket_returns_use_fallback_before_etf_inception(monkeypatch):
    dates = pd.bdate_range("2020-01-01", periods=140)
    index_df = pd.DataFrame({
        "trade_date": dates,
        "close": 100 * np.exp(np.linspace(0, 0.12, len(dates))),
    })
    etf_dates = dates[-80:]
    etf_df = pd.DataFrame({
        "trade_date": etf_dates,
        "close": 10 * np.exp(np.linspace(0, 0.08, len(etf_dates))),
    })
    monkeypatch.setattr(data_layer, "fetch_fund_daily", lambda *args, **kwargs: etf_df)
    monkeypatch.setattr(data_layer, "fetch_index_daily", lambda *args, **kwargs: index_df)
    basket = data_layer.AssetBasket(
        name="test", etfs=("ETF",), indexes=("INDEX",)
    )

    returns, used = data_layer.load_basket_returns(
        basket, "20200101", "20201231"
    )

    assert returns.loc[dates[10]:dates[40]].notna().all()
    assert returns.loc[dates[-50]:].notna().all()
    assert "idx:INDEX" in used
    assert "etf:ETF" in used


def test_basket_returns_prefer_close_over_pre_close_ratio(monkeypatch):
    dates = pd.bdate_range("2025-01-02", periods=40)
    close = 100.0 * np.power(1.001, np.arange(len(dates)))
    close[20:] = close[20:] / 2.0
    pre_close = close / 1.001
    frame = pd.DataFrame({
        "trade_date": dates,
        "close": close,
        "pre_close": pre_close,
    })
    monkeypatch.setattr(
        data_layer, "fetch_fund_daily", lambda *args, **kwargs: frame
    )
    basket = data_layer.AssetBasket(name="test", etfs=("ETF",))

    returns, used = data_layer.load_basket_returns(
        basket, "20250101", "20251231"
    )

    assert np.isclose(returns.loc[dates[20]], np.log(1.001), atol=1e-12)
    assert "close/pre_close" in used


def test_data_fallback_logs_only_remote_error_type(monkeypatch, caplog):
    secret_detail = "credential-like-third-party-detail"

    def fail(*args, **kwargs):
        raise RuntimeError(secret_detail)

    monkeypatch.setattr(data_layer, "fetch_fund_daily", fail)
    basket = data_layer.AssetBasket(name="test", etfs=("ETF",))

    data_layer.load_basket_returns(basket, "20250101", "20251231")

    assert secret_detail not in caplog.text
    assert "RuntimeError" in caplog.text


def test_futures_fallback_symbols_include_exchange_suffixes():
    assert data_layer.BASKETS["bond_long"].futures == ("T_DOMINANT.CFE",)
    assert data_layer.BASKETS["bond_mid"].futures == ("TF_DOMINANT.CFE",)
    assert data_layer.BASKETS["gold"].futures == ("AU_DOMINANT.SHF",)
    assert data_layer.BASKETS["commodity"].futures == (
        "CU_DOMINANT.SHF", "M_DOMINANT.DCE",
    )


def test_bond_index_fallback_uses_verified_broad_treasury_index():
    assert data_layer.BASKETS["bond_long"].indexes == ("000012.SH",)
    assert data_layer.BASKETS["bond_mid"].indexes == ("000012.SH",)


def test_build_asset_returns_fails_when_a_core_asset_is_missing(monkeypatch):
    dates = pd.bdate_range("2025-01-02", periods=100)

    def fake_load(basket, start, end):
        if basket.name == "commodity":
            return pd.Series(dtype=float), ""
        return pd.Series(0.001, index=dates), f"idx:{basket.name}"

    monkeypatch.setattr(data_layer, "load_basket_returns", fake_load)

    with pytest.raises(RuntimeError, match="commodity"):
        data_layer.build_asset_returns("20250101", "20251231")


def test_build_asset_returns_all_missing_has_clear_coverage_error(monkeypatch):
    monkeypatch.setattr(
        data_layer,
        "load_basket_returns",
        lambda basket, start, end: (pd.Series(dtype=float), ""),
    )

    with pytest.raises(RuntimeError, match="missing required assets"):
        data_layer.build_asset_returns("20250101", "20251231")


def test_build_asset_returns_fails_when_core_asset_coverage_is_too_low(
        monkeypatch):
    dates = pd.bdate_range("2025-01-02", periods=100)

    def fake_load(basket, start, end):
        values = pd.Series(0.001, index=dates)
        if basket.name == "gold":
            values = values.iloc[-50:]
        return values, f"idx:{basket.name}"

    monkeypatch.setattr(data_layer, "load_basket_returns", fake_load)

    with pytest.raises(RuntimeError, match="gold"):
        data_layer.build_asset_returns("20250101", "20251231")


def test_build_asset_returns_records_validated_coverage(monkeypatch):
    dates = pd.bdate_range("2025-01-02", periods=100)

    def fake_load(basket, start, end):
        values = pd.Series(0.001, index=dates)
        if basket.name == "gold":
            values = values.iloc[-90:]
        return values, f"idx:{basket.name} [close_diff]"

    monkeypatch.setattr(data_layer, "load_basket_returns", fake_load)

    returns, _ = data_layer.build_asset_returns(
        "20250101", "20251231"
    )

    assert returns.attrs["asset_coverage"]["gold"] == 0.9
    assert not returns.isna().any().any()


def test_classic_all_weather_base_allocation_is_exact():
    expected = pd.Series({
        "stock": 0.30,
        "bond_long": 0.40,
        "bond_mid": 0.15,
        "gold": 0.075,
        "commodity": 0.075,
    })
    pd.testing.assert_series_equal(BASE_ALLOCATION, expected)


def test_quarterly_weights_use_previous_days_sixty_day_volatility():
    returns, cpi, gdp = _make_synth()
    macro = align_macro_to_daily(cpi, gdp, returns.index)
    regime = classify(macro)
    wr = build_weights(
        returns, regime.quadrant, rebalance="Q", vol_window=60,
    )
    eligible = [d for d in wr.scheduled_rebalance_dates
                if returns.index.get_loc(d) >= 60 and d in wr.rebalance_dates]
    assert eligible
    day = eligible[0]
    pos = returns.index.get_loc(day)
    vol = returns.iloc[pos - 60:pos].std()
    quadrant = regime.quadrant.loc[day]
    from portfolio import QUADRANT_TILT
    base = QUADRANT_TILT.get(quadrant, BASE_ALLOCATION)
    expected = portfolio.inverse_volatility_weights(base, vol)
    pd.testing.assert_series_equal(
        wr.daily_weights.loc[day], expected,
        check_names=False, rtol=1e-10, atol=1e-12,
    )


def test_quarterly_schedule_contains_only_completed_quarter_ends():
    dates = pd.bdate_range("2023-01-02", "2023-07-10")
    returns = pd.DataFrame(
        0.001,
        index=dates,
        columns=["stock", "bond_long", "bond_mid", "gold", "commodity"],
    )
    quadrants = pd.Series("Q2_growUp_infDn", index=dates)

    result = build_weights(
        returns,
        quadrants,
        rebalance="Q",
        vol_window=60,
    )

    expected = pd.DatetimeIndex(
        pd.to_datetime(["2023-03-31", "2023-06-30"])
    )
    pd.testing.assert_index_equal(
        result.scheduled_rebalance_dates,
        expected,
        exact=True,
    )


def test_partial_first_quarter_never_creates_a_first_day_target():
    dates = pd.bdate_range("2023-02-15", "2023-07-10")
    returns = pd.DataFrame(
        0.001,
        index=dates,
        columns=["stock", "bond_long", "bond_mid", "gold", "commodity"],
    )
    quadrants = pd.Series("Q2_growUp_infDn", index=dates)

    result = build_weights(
        returns,
        quadrants,
        rebalance="Q",
        observation_start="20230215",
        observation_end="20230710",
    )

    assert dates[0] not in result.decision_dates
    assert pd.Timestamp("2023-03-31") not in result.scheduled_rebalance_dates
    pd.testing.assert_index_equal(
        result.scheduled_rebalance_dates,
        pd.DatetimeIndex([pd.Timestamp("2023-06-30")]),
    )
    assert result.daily_weights.loc[: "2023-06-29"].isna().all().all()


def test_truncated_final_quarter_is_not_accepted_even_when_near_calendar_end():
    dates = pd.bdate_range("2023-01-02", "2023-09-27")
    returns = pd.DataFrame(
        0.001,
        index=dates,
        columns=["stock", "bond_long", "bond_mid", "gold", "commodity"],
    )
    quadrants = pd.Series("Q2_growUp_infDn", index=dates)

    result = build_weights(
        returns,
        quadrants,
        rebalance="Q",
        observation_start="20230101",
        observation_end="20230927",
    )

    assert pd.Timestamp("2023-09-27") not in result.scheduled_rebalance_dates
    assert result.scheduled_rebalance_dates.max() == pd.Timestamp("2023-06-30")


def test_final_quarter_is_accepted_only_after_natural_period_end_is_confirmed():
    dates = pd.bdate_range("2023-01-02", "2023-09-28")
    returns = pd.DataFrame(
        0.001,
        index=dates,
        columns=["stock", "bond_long", "bond_mid", "gold", "commodity"],
    )
    quadrants = pd.Series("Q2_growUp_infDn", index=dates)

    unconfirmed = build_weights(
        returns,
        quadrants,
        rebalance="Q",
        observation_start="20230101",
        observation_end="20230928",
    )
    confirmed = build_weights(
        returns,
        quadrants,
        rebalance="Q",
        observation_start="20230101",
        observation_end="20230930",
    )

    assert pd.Timestamp("2023-09-28") not in unconfirmed.scheduled_rebalance_dates
    assert pd.Timestamp("2023-09-28") in confirmed.scheduled_rebalance_dates


def test_each_quarter_end_emits_a_decision_even_when_target_is_unchanged():
    dates = pd.bdate_range("2023-01-02", "2023-12-29")
    returns = pd.DataFrame(
        0.001,
        index=dates,
        columns=["stock", "bond_long", "bond_mid", "gold", "commodity"],
    )
    quadrants = pd.Series("Q2_growUp_infDn", index=dates)

    result = build_weights(returns, quadrants, rebalance="Q")

    expected_quarter_ends = pd.DatetimeIndex(
        pd.to_datetime(
            ["2023-03-31", "2023-06-30", "2023-09-29", "2023-12-29"]
        )
    )
    pd.testing.assert_index_equal(
        result.scheduled_rebalance_dates,
        expected_quarter_ends,
    )
    pd.testing.assert_index_equal(
        result.decision_dates,
        result.rebalance_dates,
    )
    assert expected_quarter_ends.difference(result.rebalance_dates).empty


def test_final_quarter_end_tolerates_exchange_holiday_gap():
    dates = pd.bdate_range("2023-01-02", "2023-09-28")
    returns = pd.DataFrame(
        0.001,
        index=dates,
        columns=["stock", "bond_long", "bond_mid", "gold", "commodity"],
    )
    quadrants = pd.Series("Q2_growUp_infDn", index=dates)

    result = build_weights(
        returns,
        quadrants,
        rebalance="Q",
        observation_start="20230101",
        observation_end="20230930",
    )

    assert pd.Timestamp("2023-09-28") in result.scheduled_rebalance_dates


def test_regime_classify_returns_all_four_quadrants():
    returns, cpi, gdp = _make_synth()
    macro = align_macro_to_daily(cpi, gdp, returns.index)
    result = classify(macro)
    qs = set(result.quadrant.dropna().unique())
    # 因为 CPI/GDP 都是正弦波，12 年内一定会走过 4 个象限
    assert len(qs) == 4, f"应覆盖 4 个象限，实际: {qs}"


def test_regime_diagnostics_record_smoothing_and_hysteresis_states():
    returns, cpi, gdp = _make_synth()
    macro = align_macro_to_daily(cpi, gdp, returns.index)

    result = classify(macro)

    assert {
        "cpi_long_change",
        "gdp_long_change",
        "raw_inflation_up",
        "raw_growth_up",
        "smooth_inflation_up",
        "smooth_growth_up",
        "inflation_up",
        "growth_up",
        "quadrant",
    }.issubset(result.diagnostics.columns)


@pytest.mark.parametrize(
    ("kwargs", "parameter"),
    [
        ({"long_change_days": 0}, "long_change_days"),
        ({"smooth_window": 0}, "smooth_window"),
        ({"min_hold_days": 0}, "min_hold_days"),
    ],
)
def test_regime_rejects_nonpositive_windows(kwargs, parameter):
    dates = pd.bdate_range("2025-01-02", periods=10)
    macro = pd.DataFrame(
        {"cpi_yoy": 1.0, "gdp_yoy": 5.0},
        index=dates,
    )

    with pytest.raises(ValueError, match=parameter):
        classify(macro, **kwargs)


def test_weights_reject_nonpositive_volatility_window():
    dates = pd.bdate_range("2025-01-02", periods=10)
    returns = pd.DataFrame(
        0.001,
        index=dates,
        columns=["stock", "bond_long", "bond_mid", "gold", "commodity"],
    )
    quadrants = pd.Series("Q2_growUp_infDn", index=dates)

    with pytest.raises(ValueError, match="vol_window"):
        build_weights(returns, quadrants, vol_window=0)


def test_default_risk_budget_is_named_inverse_volatility():
    assert portfolio.DEFAULT_VOL_WINDOW == 60
    assert portfolio.ALLOCATION_METHOD == "inverse_volatility"
    assert callable(portfolio.inverse_volatility_weights)


def test_inverse_volatility_gives_lower_weight_to_higher_vol():
    base = pd.Series({"stock": 0.3, "bond_long": 0.4,
                       "bond_mid": 0.15, "gold": 0.075, "commodity": 0.075})
    vols = pd.Series({"stock": 0.014, "bond_long": 0.004,
                       "bond_mid": 0.003, "gold": 0.010, "commodity": 0.012})
    w = portfolio.inverse_volatility_weights(base, vols)
    assert np.isclose(w.sum(), 1.0)
    # 高波动的 stock 应该被压制，得到的权重 < 基准 0.3
    assert w["stock"] < 0.3
    # 低波动的 bond_mid 得到相对更多权重
    assert w["bond_mid"] > 0.15


def test_risk_contribution_diagnostic_uses_full_covariance():
    weights = pd.Series({"stock": 0.5, "bond": 0.5})
    covariance = pd.DataFrame(
        [[0.04, 0.0], [0.0, 0.01]],
        index=weights.index,
        columns=weights.index,
    )

    diagnostic = portfolio.risk_contribution_diagnostic(
        weights, covariance
    )

    assert np.isclose(diagnostic["by_asset"]["stock"], 0.8)
    assert np.isclose(diagnostic["by_asset"]["bond"], 0.2)
    assert np.isclose(diagnostic["max_contribution"], 0.8)
    assert np.isclose(diagnostic["herfindahl"], 0.68)


def test_risk_contribution_diagnostic_marks_incomplete_covariance_unavailable():
    weights = pd.Series({"stock": 0.5, "bond": 0.5})
    covariance = pd.DataFrame(
        np.nan,
        index=weights.index,
        columns=weights.index,
    )

    diagnostic = portfolio.risk_contribution_diagnostic(
        weights, covariance
    )

    assert diagnostic["max_contribution"] is None
    assert diagnostic["herfindahl"] is None
    assert diagnostic["unavailable_reason"] == "incomplete_covariance"


def test_weights_change_only_on_rebalance_dates():
    returns, cpi, gdp = _make_synth()
    macro = align_macro_to_daily(cpi, gdp, returns.index)
    regime = classify(macro)
    wr = build_weights(returns, regime.quadrant, rebalance="Q")
    dw = wr.daily_weights
    changes = (dw.diff().abs().sum(axis=1) > 1e-10)
    # 变化日应是再平衡日的子集（考虑首日初始化也算）
    non_reb_changes = changes.index[changes] .difference(wr.rebalance_dates)
    # 允许首日
    non_reb_changes = non_reb_changes[non_reb_changes != dw.index[0]]
    assert len(non_reb_changes) == 0, \
        f"权重在非再平衡日发生变化：{non_reb_changes[:5]}"


def test_regime_switch_is_recorded_but_does_not_trade_by_default():
    dates = pd.bdate_range("2023-01-02", "2023-07-10")
    returns = pd.DataFrame(
        np.tile(
            [0.001, 0.0002, 0.0001, 0.0005, 0.0007],
            (len(dates), 1),
        ),
        index=dates,
        columns=["stock", "bond_long", "bond_mid", "gold", "commodity"],
    )
    switch_day = pd.Timestamp("2023-05-15")
    quadrants = pd.Series("Q2_growUp_infDn", index=dates)
    quadrants.loc[switch_day:] = "Q4_growDn_infDn"

    result = build_weights(
        returns,
        quadrants,
        rebalance="Q",
    )

    assert switch_day in result.quadrant_switch_dates
    assert switch_day not in result.rebalance_dates


def test_backtest_no_lookahead():
    returns, cpi, gdp = _make_synth()
    macro = align_macro_to_daily(cpi, gdp, returns.index)
    regime = classify(macro)
    wr = build_weights(returns, regime.quadrant, rebalance="Q")
    result = run_backtest(
        returns,
        wr.daily_weights,
        regime.quadrant,
        cost_bps=5.0,
        decision_dates=wr.rebalance_dates,
    )
    first_decision = wr.rebalance_dates[0]
    first_position = returns.index.get_loc(first_decision)
    execution_day = returns.index[first_position + 1]

    np.testing.assert_allclose(
        result.weights_used.loc[first_decision].values,
        0.0,
        atol=1e-12,
    )
    np.testing.assert_allclose(
        result.weights_used.loc[execution_day].values,
        wr.daily_weights.loc[first_decision].values,
        atol=1e-12,
    )


def test_backtest_metrics_and_by_quadrant():
    returns, cpi, gdp = _make_synth()
    macro = align_macro_to_daily(cpi, gdp, returns.index)
    regime = classify(macro)
    wr = build_weights(returns, regime.quadrant, rebalance="Q")
    result = run_backtest(returns, wr.daily_weights, regime.quadrant,
                           cost_bps=5.0)
    for k in ("cagr", "ann_return", "ann_vol", "sharpe", "max_drawdown"):
        assert k in result.metrics
    assert not result.by_quadrant.empty
    assert set(result.by_quadrant.columns) >= {"ann_return", "ann_vol", "days"}
    # 净值必须为正
    assert result.equity.min() > 0


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
