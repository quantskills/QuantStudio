"""Test calendar utilities."""
import pytest
from scripts.data import calendar


class TestTradingDaysBetween:
    def test_empty_range(self):
        """No trading days in an invalid range."""
        # Mock: loader returns empty
        import scripts.data.loader as L
        orig = L.load_trade_cal
        try:
            import pandas as pd
            L.load_trade_cal = lambda s, e, ex="SH": pd.DataFrame(columns=["date", "is_trading_day"])
            result = calendar.trading_days_between("20250101", "20250101")
            assert result == []
        finally:
            L.load_trade_cal = orig


class TestPrevTradingDates:
    def test_returns_list(self):
        """prev_trading_dates returns a list of strings."""
        result = calendar.prev_trading_dates("20250110", n=0)
        assert isinstance(result, list)
        assert len(result) == 0


class TestIsTradingDay:
    def test_false_on_empty(self):
        """is_trading_day returns False when calendar is empty."""
        import scripts.data.loader as L
        orig = L.load_trade_cal
        try:
            import pandas as pd
            L.load_trade_cal = lambda s, e, ex="SH": pd.DataFrame()
            assert calendar.is_trading_day("20250101") is False
        finally:
            L.load_trade_cal = orig
