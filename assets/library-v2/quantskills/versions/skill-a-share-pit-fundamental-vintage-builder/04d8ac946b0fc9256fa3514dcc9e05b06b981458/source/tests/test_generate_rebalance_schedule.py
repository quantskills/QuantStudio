from __future__ import annotations

import pandas as pd
import unittest

from scripts.generate_rebalance_schedule import monthly_rebalance_dates


class RebalanceScheduleTests(unittest.TestCase):
    def test_selects_the_last_trading_day_of_each_month(self) -> None:
        calendar = pd.DataFrame(
            {
                "date": ["20210128", "20210129", "20210226", "20210330", "20210331"],
                "is_trading_day": [1, 1, 1, 1, 1],
            }
        )

        result = monthly_rebalance_dates(calendar)

        self.assertEqual(result["rebalance_date"].tolist(), ["20210129", "20210226", "20210331"])
