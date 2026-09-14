import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from ah_sources import fetch_current_snapshot_rows


class FakePandaData:
    def __init__(self):
        self.calls = []

    def get_last_trade_date(self, **kwargs):
        self.calls.append(("get_last_trade_date", kwargs))
        return "20260807"

    def get_stock_daily(self, **kwargs):
        self.calls.append(("get_stock_daily", kwargs))
        symbols = kwargs["symbol"] or ["600000.SH"]
        return pd.DataFrame(
            {
                "symbol": symbols,
                "date": ["20260807"] * len(symbols),
                "close": [10.0] * len(symbols),
            }
        )

    def get_hk_daily(self, **kwargs):
        self.calls.append(("get_hk_daily", kwargs))
        symbols = kwargs["symbol"] or ["1800.HK"]
        return pd.DataFrame(
            {
                "symbol": symbols,
                "date": ["20260807"] * len(symbols),
                "close": [8.0] * len(symbols),
            }
        )


class TestAHSources(unittest.TestCase):
    PAIRS = [
        {
            "company": "Example Co",
            "a_code": "600000",
            "h_code": "01800",
            "名称": "Example Co",
            "A股代码": "600000",
            "H股代码": "01800",
        },
    ]

    def test_market_scan_uses_empty_symbols_and_latest_date(self):
        sdk = FakePandaData()
        with (
            patch("ah_sources.load_pair_universe", return_value=self.PAIRS),
            patch("ah_sources.load_panda_sdk", return_value=sdk),
            patch("ah_sources.latest_hkd_cny", return_value=(0.92, "2026-08-07", 1.087)),
        ):
            rows, warnings = fetch_current_snapshot_rows()

        self.assertFalse(warnings)
        self.assertEqual(len(rows), 1)
        stock_call = sdk.calls[1][1]
        hk_call = sdk.calls[2][1]
        self.assertEqual(stock_call["symbol"], [])
        self.assertEqual(hk_call["symbol"], [])
        self.assertEqual(stock_call["start_date"], "20260807")
        self.assertEqual(stock_call["end_date"], "20260807")
        self.assertEqual(hk_call["start_date"], "20260807")
        self.assertEqual(hk_call["end_date"], "20260807")
        self.assertEqual(stock_call["fields"], ["symbol", "date", "close"])
        self.assertEqual(hk_call["fields"], ["symbol", "date", "close"])

    def test_company_scan_uses_only_resolved_symbols(self):
        sdk = FakePandaData()
        with (
            patch("ah_sources.load_pair_universe", return_value=self.PAIRS),
            patch("ah_sources.load_panda_sdk", return_value=sdk),
            patch("ah_sources.latest_hkd_cny", return_value=(0.92, "2026-08-07", 1.087)),
        ):
            fetch_current_snapshot_rows(company="Example Co")

        self.assertEqual(sdk.calls[1][1]["symbol"], ["600000.SH"])
        self.assertEqual(sdk.calls[2][1]["symbol"], ["1800.HK"])


if __name__ == "__main__":
    unittest.main()
