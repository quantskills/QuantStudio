from __future__ import annotations

import pandas as pd
import unittest

from scripts.derive_fundamental_factors import derive_fundamental_factors


class FundamentalFactorTests(unittest.TestCase):
    def test_derives_single_quarter_ttm_and_basic_quality_factors(self) -> None:
        panel = pd.DataFrame(
            {
                "symbol": ["000001.SZ"] * 5,
                "quarter": ["2023q1", "2023q2", "2023q3", "2023q4", "2024q1"],
                "as_of_date": ["20240501"] * 5,
                "is_revenue": [10.0, 30.0, 60.0, 100.0, 30.0],
                "is_n_income_attr_p": [1.0, 3.0, 6.0, 10.0, 3.0],
                "cfs_net_cash_operating": [2.0, 5.0, 9.0, 14.0, 4.0],
                "bs_total_assets": [50.0, 55.0, 60.0, 65.0, 70.0],
            }
        )

        result = derive_fundamental_factors(panel)
        q4_2023 = result.loc[result["quarter"] == "2023q4"].iloc[0]
        q1_2024 = result.loc[result["quarter"] == "2024q1"].iloc[0]

        self.assertEqual(result["is_revenue_q"].tolist(), [10.0, 20.0, 30.0, 40.0, 30.0])
        self.assertAlmostEqual(q4_2023["is_revenue_ttm"], 100.0)
        self.assertAlmostEqual(q4_2023["net_margin_ttm"], 0.1)
        self.assertAlmostEqual(q4_2023["cash_conversion_ttm"], 1.4)
        self.assertAlmostEqual(q4_2023["accruals_to_assets_ttm"], -4.0 / 65.0)
        self.assertAlmostEqual(q1_2024["is_revenue_ttm"], 120.0)
        self.assertAlmostEqual(q1_2024["roa_ttm"], 12.0 / 60.0)
        self.assertAlmostEqual(q1_2024["asset_turnover_ttm"], 120.0 / 60.0)
