"""Regressions for late native bars and multi-contract polling; no live APIs."""
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from fly.history import bars_key, readiness, session_key, timestamp
from fly.scheduling import next_trade
from fly.store import Store


class MarketSchedulingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.store = Store(Path(self.temp.name))
        self.now = timestamp('2026-09-29T14:08:04+08:00')

    def market(self, product='cu', age=124, minutes=1):
        end = self.now-age
        times = []
        at = end
        while len(times) < 500:
            if session_key(at, product) is not None: times.append(at)
            at -= minutes*60
        bars = [dict(datetime=datetime.fromtimestamp(t, timezone.utc).isoformat(),
                     open=100, high=102, low=99, close=101, volume=10) for t in reversed(times)]
        self.store.put('settings', {'trade_period_minutes': minutes})
        self.store.put(bars_key(product, minutes), bars)
        self.store.put('feed:'+product, dict(symbol=product+'2611', at=self.now-1, quote_at=self.now-3,
                       long=0, short=0, sizing={'long_capacity': 1, 'short_capacity': 1}))
        return bars

    def test_bar_published_after_old_cutoff_reaches_decision_once(self):
        bars = self.market()
        self.assertEqual(readiness(bars, self.now-3, self.now), 'ready')
        seen = {}
        request, cursor = next_trade(self.store, ['cu'], seen, 0, self.now)
        self.assertIsNotNone(request)
        self.assertEqual(request['signal_bar'], bars[-1]['datetime'])
        self.assertIsNone(next_trade(self.store, ['cu'], seen, cursor, self.now+1)[0])

    def test_unfinished_or_overage_bars_never_trigger(self):
        for age in (30, -60, 181, 244):
            with self.subTest(age=age):
                self.market(age=age)
                self.assertIsNone(next_trade(self.store, ['cu'], {}, 0, self.now)[0])

    def test_stale_quotes_and_history_gaps_still_block(self):
        bars = self.market()
        feed = self.store.get('feed:cu')
        self.store.put('feed:cu', {**feed, 'quote_at': self.now-11})
        self.assertIsNone(next_trade(self.store, ['cu'], {}, 0, self.now)[0])
        self.store.put('feed:cu', feed)
        bars[-2] = bars[-3]
        self.store.put('bars:cu', bars)
        self.assertIsNone(next_trade(self.store, ['cu'], {}, 0, self.now)[0])

    def test_five_minute_bars_use_native_period_and_cannot_be_unfinished(self):
        self.now = timestamp('2026-09-29T14:10:04+08:00')
        self.market(age=304, minutes=5)
        self.assertIsNotNone(next_trade(self.store, ['cu'], {}, 0, self.now)[0])
        for age in (244, 601):
            self.market(age=age, minutes=5)
            self.assertIsNone(next_trade(self.store, ['cu'], {}, 0, self.now)[0])

    def test_all_contracts_get_a_turn_despite_publication_lag(self):
        products = ['cu', 'a', 'ag', 'au', 'ao', 'bb', 'br']
        for p in products: self.market(p)
        seen, selected, cursor = {}, [], 0
        for _ in products:
            request, cursor = next_trade(self.store, products, seen, cursor, self.now)
            self.assertIsNotNone(request)
            selected.append(request['product'])
        self.assertEqual(selected, products)
        self.assertIsNone(next_trade(self.store, products, seen, cursor, self.now)[0])

    def test_busy_jobs_do_not_shift_rotation_or_starve_later_contracts(self):
        products=['cu','a','ag','au','ao','bb','br']
        for p in products:self.market(p)
        seen,busy,selected,cursor={},set(),[],0
        for _ in range(3):
            req,cursor=next_trade(self.store,products,seen,cursor,self.now,busy=busy)
            selected.append(req['product']);busy.add(req['product'])
        self.assertEqual(selected,['cu','a','ag'])
        # A quick first job finishes while the other two remain in flight.
        busy.remove('cu')
        # Even with a new bar for the first contract, continue at the next slot.
        seen.pop('cu')
        req,cursor=next_trade(self.store,products,seen,cursor,self.now,busy=busy)
        self.assertEqual(req['product'],'au')
        busy.add('au')
        req,_=next_trade(self.store,products,seen,cursor,self.now,busy=busy)
        self.assertEqual(req['product'],'ao')


if __name__ == '__main__': unittest.main()
