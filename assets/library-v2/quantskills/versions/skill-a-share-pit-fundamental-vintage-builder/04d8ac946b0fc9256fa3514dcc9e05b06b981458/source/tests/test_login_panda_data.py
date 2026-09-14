from __future__ import annotations

import pandas as pd
import unittest
from unittest.mock import patch

from scripts.build_pit_panel import PitBuildError
from scripts.login_panda_data import normalize_username, persist_credentials, verify_connection


class FakePandaDataClient:
    def __init__(self, calendar: pd.DataFrame) -> None:
        self.calendar = calendar
        self.calls: list[dict[str, object]] = []

    def get_trade_cal(self, **kwargs: object) -> pd.DataFrame:
        self.calls.append(kwargs)
        return self.calendar


class PandaDataLoginTests(unittest.TestCase):
    def test_normalize_username_adds_86_prefix_only_when_missing(self) -> None:
        self.assertEqual(normalize_username("18137325640"), "8618137325640")
        self.assertEqual(normalize_username(" 8618137325640 "), "8618137325640")

    def test_verify_connection_runs_a_small_calendar_query(self) -> None:
        client = FakePandaDataClient(pd.DataFrame({"nature_date": [20240102]}))

        verify_connection(client)

        self.assertEqual(client.calls, [{
            "start_date": "20240102",
            "end_date": "20240110",
            "exchange": "SH",
            "is_trading_day": 1,
        }])

    def test_verify_connection_rejects_empty_response(self) -> None:
        client = FakePandaDataClient(pd.DataFrame())

        with self.assertRaisesRegex(PitBuildError, "no trading-calendar records"):
            verify_connection(client)

    @patch("scripts.login_panda_data.persist_macos_keychain_credentials")
    @patch("scripts.login_panda_data.sys.platform", "darwin")
    def test_persist_credentials_uses_keychain_on_macos(self, persist_mock: object) -> None:
        store = persist_credentials("saved-user", "saved-password")

        self.assertEqual(store, "macOS login keychain")
        persist_mock.assert_called_once_with("saved-user", "saved-password")
