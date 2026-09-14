from __future__ import annotations

import pandas as pd
import unittest
from subprocess import CompletedProcess
from unittest.mock import patch

from scripts.build_pit_panel import (
    PitBuildError,
    build_available_dates,
    build_pit_panels,
    build_pit_snapshot,
    calendar_end_date,
    normalize_trading_calendar,
    read_macos_keychain_environment,
    resolve_panda_data_credentials,
    select_as_of_vintages,
    split_quarter_range,
)


class PitPanelTests(unittest.TestCase):
    def test_select_as_of_vintages_keeps_latest_visible_version_per_quarter(self) -> None:
        reports = pd.DataFrame(
            {
                "symbol": ["000001.SZ", "000001.SZ", "000001.SZ", "000001.SZ"],
                "quarter": ["2023q4", "2023q4", "2024q1", "2024q1"],
                "date": ["20240301", "20240415", "20240420", "20240510"],
                "is_revenue": [100.0, 101.0, 30.0, 31.0],
            }
        )

        result = select_as_of_vintages(reports, "20240419")

        self.assertEqual(
            result[["quarter", "date", "is_revenue"]].to_dict("records"),
            [{"quarter": "2023q4", "date": "20240415", "is_revenue": 101.0}],
        )

    def test_build_available_dates_uses_next_trading_day_after_disclosure(self) -> None:
        reports = pd.DataFrame(
            {
                "symbol": ["000001.SZ", "000001.SZ"],
                "quarter": ["2023q4", "2024q1"],
                "date": ["20240419", "20240420"],
            }
        )
        trading_days = pd.DataFrame(
            {"date": ["20240419", "20240422", "20240423"], "is_trading_day": [1, 1, 1]}
        )

        result = build_available_dates(reports, trading_days)

        self.assertEqual(result["available_date"].tolist(), ["20240422", "20240422"])

    def test_build_available_dates_rejects_unresolved_disclosure_dates(self) -> None:
        reports = pd.DataFrame(
            {"symbol": ["000001.SZ"], "quarter": ["2024q1"], "date": ["20240423"]}
        )
        trading_days = pd.DataFrame({"date": ["20240422"], "is_trading_day": [1]})

        with self.assertRaisesRegex(PitBuildError, "No trading day after disclosure date"):
            build_available_dates(reports, trading_days)

    def test_build_pit_snapshot_excludes_same_day_disclosure_until_next_trade_day(self) -> None:
        reports = pd.DataFrame(
            {
                "symbol": ["000001.SZ", "000001.SZ"],
                "quarter": ["2023q4", "2023q4"],
                "date": ["20240415", "20240419"],
                "is_revenue": [100.0, 101.0],
            }
        )
        trading_days = pd.DataFrame(
            {"date": ["20240415", "20240416", "20240419", "20240422"], "is_trading_day": [1, 1, 1, 1]}
        )

        result = build_pit_snapshot(reports, trading_days, "20240419")

        self.assertEqual(result["is_revenue"].tolist(), [100.0])
        self.assertEqual(result["available_date"].tolist(), ["20240416"])

    def test_build_pit_snapshot_rejects_conflicting_versions_on_the_same_disclosure_date(self) -> None:
        reports = pd.DataFrame(
            {
                "symbol": ["000001.SZ", "000001.SZ"],
                "quarter": ["2023q4", "2023q4"],
                "date": ["20240415", "20240415"],
                "is_revenue": [100.0, 200.0],
            }
        )
        trading_days = pd.DataFrame({"date": ["20240416"], "is_trading_day": [1]})

        with self.assertRaisesRegex(PitBuildError, "Ambiguous report vintages"):
            build_pit_snapshot(reports, trading_days, "20240419")

    def test_build_pit_panels_builds_a_long_panel_for_each_rebalance_date(self) -> None:
        reports = pd.DataFrame(
            {
                "symbol": ["000001.SZ", "000001.SZ"],
                "quarter": ["2023q4", "2023q4"],
                "date": ["20240415", "20240425"],
                "is_revenue": [100.0, 110.0],
            }
        )
        trading_days = pd.DataFrame(
            {"date": ["20240416", "20240419", "20240426", "20240430"], "is_trading_day": [1, 1, 1, 1]}
        )

        result = build_pit_panels(reports, trading_days, ["20240419", "20240430"])

        self.assertEqual(result["as_of_date"].tolist(), ["20240419", "20240430"])
        self.assertEqual(result["is_revenue"].tolist(), [100.0, 110.0])

    def test_split_quarter_range_uses_chunks_of_at_most_twenty_quarters(self) -> None:
        self.assertEqual(
            split_quarter_range("2020q1", "2025q4"),
            [("2020q1", "2024q4"), ("2025q1", "2025q4")],
        )

    def test_calendar_end_date_leaves_a_buffer_after_as_of_date(self) -> None:
        self.assertEqual(calendar_end_date("20240419"), "20240510")

    def test_normalize_trading_calendar_adapts_sdk_field_names(self) -> None:
        raw_calendar = pd.DataFrame(
            {
                "nature_date": [20240419, 20240420, 20240422],
                "is_trade": [1, 0, 1],
                "exchange": ["SH", "SH", "SH"],
            }
        )

        result = normalize_trading_calendar(raw_calendar)

        self.assertEqual(result.to_dict("records"), [
            {"date": "20240419", "is_trading_day": 1},
            {"date": "20240420", "is_trading_day": 0},
            {"date": "20240422", "is_trading_day": 1},
        ])

    def test_resolve_credentials_prefers_current_process_over_persisted_values(self) -> None:
        username, password = resolve_panda_data_credentials(
            environment={"PANDA_DATA_USERNAME": "current-user", "PANDA_DATA_PASSWORD": "current-password"},
            persisted_environment={"PANDA_DATA_USERNAME": "saved-user", "PANDA_DATA_PASSWORD": "saved-password"},
        )

        self.assertEqual((username, password), ("current-user", "current-password"))

    def test_resolve_credentials_uses_persisted_values_when_process_values_are_missing(self) -> None:
        username, password = resolve_panda_data_credentials(
            environment={},
            persisted_environment={"PANDA_DATA_USERNAME": "saved-user", "PANDA_DATA_PASSWORD": "saved-password"},
        )

        self.assertEqual((username, password), ("saved-user", "saved-password"))

    @patch("scripts.build_pit_panel.sys.platform", "darwin")
    @patch("scripts.build_pit_panel.subprocess.run")
    def test_read_macos_keychain_environment_reads_both_credential_entries(self, run_mock: object) -> None:
        run_mock.side_effect = [
            CompletedProcess(args=[], returncode=0, stdout="saved-user\n"),
            CompletedProcess(args=[], returncode=0, stdout="saved-password\n"),
        ]

        result = read_macos_keychain_environment()

        self.assertEqual(result, {
            "PANDA_DATA_USERNAME": "saved-user",
            "PANDA_DATA_PASSWORD": "saved-password",
        })
