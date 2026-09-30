import tempfile
import unittest

from fly.analytics import save_sample, trading_analytics
from fly.history import timestamp
from fly.store import Store


class AnalyticsPnlTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.store = Store(self.tmp.name)

    def sample(self, date, values):
        at = timestamp(date)
        official = {'TradingDay': date[:10].replace('-', ''), **values}
        self.assertTrue(save_sample(self.store, 'test', official, at, observed_at=at,
                                    source='counter', sample_key=date))

    def result(self, start='20260930', end='20260930', period='1m'):
        return trading_analytics(self.store, [], {}, 'test', end,
                                 start_day=start, end_day=end, period=period)

    def test_valid_later_sample_restores_totals_and_baseline_without_filling_old_points(self):
        self.sample('2026-09-30T09:00:00+08:00', {'Balance': 5000000, 'Commission': 20})
        self.sample('2026-09-30T09:01:00+08:00', {'Balance': 5006746.83,
                    'CloseProfit': 5555, 'PositionProfit': 3895, 'Commission': 489.05})
        r = self.result()
        self.assertAlmostEqual(r['period_summary']['realized_net'], 5065.95)
        self.assertAlmostEqual(r['period_summary']['day_net'], 8960.95)
        self.assertAlmostEqual(r['equity_baseline']['value'], 4997785.88)
        self.assertIsNone(r['equity'][0]['realized_equity'])
        self.assertAlmostEqual(r['equity'][1]['realized_equity'], 5002851.83)
        self.assertAlmostEqual(r['periods'][-1]['realized_equity'], 5002851.83)
        self.assertEqual(r['coverage']['pnl_samples'], 1)

    def test_repeated_day_totals_and_trading_day_rollover_are_not_double_counted(self):
        self.sample('2026-09-29T14:58:00+08:00', {'Balance': 1110, 'CloseProfit': 100, 'PositionProfit': 20, 'Commission': 10})
        self.sample('2026-09-29T14:59:00+08:00', {'Balance': 1120, 'CloseProfit': 120, 'PositionProfit': 10, 'Commission': 10})
        self.sample('2026-09-30T09:00:00+08:00', {'Balance': 1115, 'CloseProfit': 0, 'PositionProfit': 0, 'Commission': 5})
        r = self.result('20260929')
        self.assertEqual(r['period_summary']['realized_net'], 105)
        self.assertEqual(r['period_summary']['day_net'], 115)
        self.assertEqual(r['equity'][-1]['realized_equity'], 1105)

    def test_missing_prior_day_is_not_silently_dropped_from_range_totals(self):
        self.sample('2026-09-29T09:00:00+08:00', {'Balance': 1000})
        self.sample('2026-09-30T09:00:00+08:00', {'Balance': 1090, 'CloseProfit': 100, 'PositionProfit': 0, 'Commission': 10})
        r = self.result('20260929')
        self.assertIsNone(r['period_summary']['realized_net'])
        self.assertIsNone(r['equity_baseline']['value'])
        self.assertIsNone(r['equity'][-1]['realized_equity'])
        self.assertEqual(self.result()['period_summary']['realized_net'], 90)

    def test_missing_fees_do_not_become_zero_or_net_profit(self):
        self.sample('2026-09-30T09:00:00+08:00', {'Balance': 1100, 'CloseProfit': 100, 'PositionProfit': 0})
        r = self.result()
        self.assertIsNone(r['period_summary']['realized_net'])
        self.assertIsNone(r['equity'][0]['realized_equity'])


if __name__ == '__main__':
    unittest.main()
