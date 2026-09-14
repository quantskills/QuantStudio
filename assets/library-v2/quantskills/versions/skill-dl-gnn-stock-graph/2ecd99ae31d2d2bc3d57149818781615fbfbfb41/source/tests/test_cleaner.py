"""Test data cleaner module."""
import numpy as np
import pandas as pd
from scripts.data import cleaner


def make_test_df() -> pd.DataFrame:
    """Create a minimal test panel."""
    return pd.DataFrame({
        "symbol": ["000001.SZ", "000001.SZ", "000001.SZ", "600519.SH", "600519.SH"],
        "date": ["20250102", "20250103", "20250106", "20250102", "20250103"],
        "open": [10.0, 10.5, 10.3, 1800.0, 1810.0],
        "close": [10.2, 10.8, 10.1, 1810.0, 1820.0],
        "high": [10.3, 10.9, 10.5, 1820.0, 1830.0],
        "low": [9.9, 10.2, 10.0, 1790.0, 1800.0],
        "volume": [1e6, 1.2e6, 0.8e6, 5e5, 5.5e5],
        "amount": [1.02e7, 1.3e7, 0.81e7, 9.05e8, 1.0e9],
        "turnover": [0.02, 0.025, 0.018, 0.005, 0.0055],
        "pre_close": [9.9, 10.2, 10.8, 1790.0, 1810.0],
        "limit_up": [11.0, 11.2, 11.8, 1980.0, 1990.0],
        "limit_down": [9.0, 9.2, 9.8, 1620.0, 1630.0],
        "trade_status": [0, 0, 1, 0, 0],
    })


class TestFFillSuspended:
    def test_ffill_replaces_suspended(self):
        df = make_test_df()
        result = cleaner.ffill_suspended_prices(df)
        # Row 2 (index) should have ffill'd prices from row 1
        suspended = result[result["trade_status"] == 1]
        assert len(suspended) == 1
        # close should be 10.8 (ffill from previous row)
        assert abs(suspended["close"].iloc[0] - 10.8) < 0.01


class TestWinsorize:
    def test_winsorize_clips(self):
        s = pd.Series([0.0, 1.0, 2.0, 3.0, 100.0])
        result = cleaner.winsorize_series(s, lower=0.2, upper=0.8)
        # 100 should be clipped
        assert result.max() < 100.0

    def test_winsorize_features(self):
        df = pd.DataFrame({"a": [1.0, 2.0, 3.0, 100.0], "b": [5.0, 6.0, 7.0, 8.0]})
        result = cleaner.winsorize_features(df, ["a"])
        assert result["a"].max() < 100.0
        assert result["b"].max() == 8.0  # unchanged


class TestFilterST:
    def test_filter_st(self):
        df = make_test_df()
        status = pd.DataFrame({"symbol": ["000001.SZ"], "name": ["*ST股票"]})
        result = cleaner.filter_st_stocks(df, status)
        assert "000001.SZ" not in result["symbol"].values


class TestFilterNewListings:
    def test_filter_recent(self):
        df = make_test_df()
        float_df = pd.DataFrame({
            "symbol": ["000001.SZ", "600519.SH"],
            "listed_date": ["20250101", "20010827"],
        })
        result = cleaner.filter_new_listings(df, float_df, min_days=60, scan_date="20250130")
        # 000001.SZ listed 20250101, only 29 days → filtered out
        assert "000001.SZ" not in result["symbol"].values
        assert "600519.SH" in result["symbol"].values


class TestCleanPipeline:
    def test_pipeline_runs(self):
        df = make_test_df()
        result = cleaner.clean_pipeline(df)
        assert isinstance(result, pd.DataFrame)
        assert len(result) > 0
