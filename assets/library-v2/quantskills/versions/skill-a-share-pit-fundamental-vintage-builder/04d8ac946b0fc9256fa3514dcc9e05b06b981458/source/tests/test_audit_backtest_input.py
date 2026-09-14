from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

import pandas as pd

from scripts.audit_backtest_input import audit_backtest_inputs


def write_panel(path: Path, as_of_dates: list[str]) -> None:
    rows = []
    for as_of_date in as_of_dates:
        rows.append(
            {
                "symbol": "000001.SZ",
                "quarter": "2023q4",
                "disclosure_date": "20240315",
                "available_date": "20240318",
                "as_of_date": as_of_date,
                "vintage_type": "formal_report",
                "is_revenue": "100.0",
            }
        )
    pd.DataFrame(rows).to_csv(path, index=False)


class BacktestInputAuditTests(unittest.TestCase):
    def test_audit_flags_missing_rebalance_snapshot_and_future_looking_code(self) -> None:
        with TemporaryDirectory() as directory:
            directory_path = Path(directory)
            panel_path = directory_path / "panel.csv"
            rebalance_path = directory_path / "rebalance.csv"
            code_path = directory_path / "factor.py"
            write_panel(panel_path, ["20240419"])
            pd.DataFrame({"rebalance_date": ["20240419", "20240430"]}).to_csv(
                rebalance_path, index=False
            )
            code_path.write_text(
                "reports = panda_data.get_fina_reports(symbol='000001.SZ', is_latest=True)\n"
                "future_value = factor.shift(-1)\n",
                encoding="utf-8",
            )

            report = audit_backtest_inputs(panel_path, rebalance_path, [code_path])

        codes = {finding["code"] for finding in report["findings"]}
        self.assertIn("MISSING_REBALANCE_SNAPSHOT", codes)
        self.assertIn("CURRENT_LATEST_FINANCIALS", codes)
        self.assertIn("NEGATIVE_SHIFT", codes)
        self.assertFalse(report["valid"])

    def test_audit_accepts_complete_schedule_and_safe_factor_code(self) -> None:
        with TemporaryDirectory() as directory:
            directory_path = Path(directory)
            panel_path = directory_path / "panel.csv"
            rebalance_path = directory_path / "rebalance.csv"
            code_path = directory_path / "factor.py"
            write_panel(panel_path, ["20240419", "20240430"])
            pd.DataFrame({"rebalance_date": ["20240419", "20240430"]}).to_csv(
                rebalance_path, index=False
            )
            code_path.write_text(
                "panel = panel.loc[panel['available_date'] <= panel['as_of_date']].copy()\n"
                "factor = panel['is_revenue'].rolling(4).mean()\n",
                encoding="utf-8",
            )

            report = audit_backtest_inputs(panel_path, rebalance_path, [code_path])

        self.assertTrue(report["valid"])
        self.assertEqual(report["errors"], 0)
