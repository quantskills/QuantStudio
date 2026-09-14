from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from backtest import run  # noqa: E402


def _two_asset_case() -> tuple[pd.DatetimeIndex, pd.DataFrame, pd.DataFrame]:
    dates = pd.bdate_range("2026-01-05", periods=5)
    returns = pd.DataFrame(
        {
            "stock": [0.0, np.log(1.10), np.log(1.10), 0.0, 0.0],
            "bond": [0.0, 0.0, 0.0, 0.0, 0.0],
        },
        index=dates,
    )
    targets = pd.DataFrame(
        {
            "stock": [0.5, 0.5, 0.5, 0.8, 0.8],
            "bond": [0.5, 0.5, 0.5, 0.2, 0.2],
        },
        index=dates,
    )
    return dates, returns, targets


def test_backtest_rejects_mismatched_asset_columns_with_runtime_error():
    dates, returns, targets = _two_asset_case()
    targets = targets.rename(columns={"bond": "different_asset"})

    with pytest.raises(ValueError, match="columns must match"):
        run(returns, targets)


def test_holdings_drift_between_target_changes_without_free_daily_reset():
    dates, returns, targets = _two_asset_case()

    result = run(returns, targets, cost_bps=0.0)

    expected_after_first_return = pd.Series(
        {"stock": 0.55 / 1.05, "bond": 0.50 / 1.05}
    )
    pd.testing.assert_series_equal(
        result.weights_used.loc[dates[2]],
        expected_after_first_return,
        check_names=False,
        rtol=1e-12,
        atol=1e-12,
    )
    assert result.turnover.loc[dates[2]] == 0.0


def test_target_change_executes_next_day_and_cost_uses_drifted_holdings():
    dates, returns, targets = _two_asset_case()

    result = run(returns, targets, cost_bps=100.0)

    drifted_stock = 0.5 * 1.10 * 1.10 / (0.5 * 1.10 * 1.10 + 0.5)
    expected_turnover = (
        abs(0.8 - drifted_stock) + abs(0.2 - (1.0 - drifted_stock))
    )

    assert result.turnover.loc[dates[3]] == 0.0
    assert np.isclose(
        result.turnover.loc[dates[4]],
        expected_turnover,
        rtol=1e-12,
        atol=1e-12,
    )
    assert np.isclose(
        result.daily_return.loc[dates[4]],
        -expected_turnover * 100.0 / 1e4,
        rtol=1e-12,
        atol=1e-12,
    )


def test_explicit_quarter_decision_rebalances_unchanged_target_after_drift():
    dates = pd.bdate_range("2026-01-05", periods=6)
    returns = pd.DataFrame(
        {
            "stock": [0.0, np.log(1.10), np.log(1.10), 0.0, 0.0, 0.0],
            "bond": [0.0] * 6,
        },
        index=dates,
    )
    targets = pd.DataFrame(
        {"stock": [0.5] * 6, "bond": [0.5] * 6},
        index=dates,
    )
    decision_dates = pd.DatetimeIndex([dates[0], dates[3]])

    result = run(
        returns,
        targets,
        cost_bps=0.0,
        decision_dates=decision_dates,
        turnover_threshold=0.05,
    )

    expected_execution_dates = pd.DatetimeIndex([dates[1], dates[4]])
    pd.testing.assert_index_equal(
        result.executed_rebalance_dates,
        expected_execution_dates,
    )
    assert result.turnover.loc[dates[4]] > 0.05
    assert np.isclose(result.weights_used.loc[dates[4], "stock"], 0.5)


def test_backtest_rejects_invalid_cost_and_turnover_threshold():
    dates, returns, targets = _two_asset_case()

    for invalid in (-0.1, np.nan, np.inf, -np.inf):
        with pytest.raises(ValueError, match="cost_bps"):
            run(returns, targets, cost_bps=invalid)
        with pytest.raises(ValueError, match="turnover_threshold"):
            run(returns, targets, turnover_threshold=invalid)


def test_evaluation_start_preserves_warmup_drift_but_excludes_warmup_returns():
    dates = pd.bdate_range("2026-01-05", periods=6)
    returns = pd.DataFrame(
        {
            "stock": [0.0, np.log(1.10), np.log(1.10), 0.0, 0.0, 0.0],
            "bond": [0.0] * 6,
        },
        index=dates,
    )
    targets = pd.DataFrame(
        {"stock": [0.5] * 6, "bond": [0.5] * 6},
        index=dates,
    )

    result = run(
        returns,
        targets,
        cost_bps=0.0,
        decision_dates=pd.DatetimeIndex([dates[0]]),
        evaluation_start=dates[3],
    )

    assert result.daily_return.index[0] == dates[3]
    assert result.metrics["start"] == str(dates[3].date())
    assert result.weights_used.loc[dates[3], "stock"] > 0.5
