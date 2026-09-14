from __future__ import annotations

from pathlib import Path
import unittest

import pandas as pd

from scripts.generate_research_summary import build_research_summary


class ResearchSummaryTests(unittest.TestCase):
    def test_summarizes_validation_latest_report_and_key_factors_in_plain_language(self) -> None:
        factors = pd.DataFrame(
            {
                "symbol": ["000021.SZ", "000021.SZ", "600519.SH"],
                "quarter": ["2025q2", "2025q3", "2025q3"],
                "as_of_date": ["20251231", "20251231", "20251231"],
                "is_revenue_ttm": [15000000000.0, 15253324701.18, 178576728057.51],
                "is_n_income_attr_p_ttm": [1000000000.0, 1024696846.04, 90027341015.29],
                "net_margin_ttm": [0.06, 0.0671785899, 0.5041381483],
                "revenue_ttm_yoy": [0.07, 0.0783597469, 0.0809638860],
                "net_income_ttm_yoy": [0.10, 0.1922587721, 0.0887935938],
                "cash_conversion_ttm": [1.1, 2.4830729395, 0.9579213062],
                "roa_ttm": [0.03, 0.0361373584, 0.3043989357],
            }
        )
        audit = {"valid": True, "errors": 0, "warnings": 1, "rebalance_dates": ["20210129", "20251231"]}

        summary = build_research_summary(
            factors,
            audit,
            Path("outputs/factors.csv"),
            Path("outputs/audit.json"),
        )

        self.assertIn("PIT 数据校验通过", summary)
        self.assertIn("2025-12-31", summary)
        self.assertIn("2025q3", summary)
        self.assertIn("152.5 亿", summary)
        self.assertIn("50.4%", summary)
        self.assertIn("仅用于回测研究", summary)
