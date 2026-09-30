import tempfile
import unittest
from fly.statistics import statistics
from fly.store import Store
from fly.trade_receipts import commission


def fill(seq, price, volume, direction, offset, fee=None, day='20260929', **extra):
    return {'seq': seq, 'at': seq, 'decision_id': str(seq), 'payload': {
        'symbol': 'rb2701', 'product': 'rb', 'trade_id': str(seq), 'order_id': 'order-'+str(seq),
        'price': price, 'volume': volume, 'direction': direction, 'offset': offset,
        'trading_day': day, 'multiplier': 10, 'commission': fee, **extra}}


class StatisticsTests(unittest.TestCase):
    def stats(self, events, day='20260929', account=None, markets=None):
        return statistics(events, markets or [], account or {}, day)

    def test_partial_close_carries_opening_fees_without_double_deduction(self):
        events=[fill(1,100,3,'0','0',6),fill(2,110,1,'1','1',3),fill(3,90,2,'1','1',4)]
        result=self.stats(events)
        self.assertEqual([f['realized_net'] for f in result['fills']],[-208,95,None])
        self.assertEqual(result['summary']['realized_net'],-113)
        self.assertEqual(result['summary']['commission'],13)
        self.assertEqual(result['summary']['realized_gross'],-100)

    def test_cross_day_short_close_deducts_prior_day_open_cost(self):
        events=[fill(1,100,2,'1','0',8),fill(2,90,1,'0','4',3,day='20260930')]
        result=self.stats(events,'20260930')
        self.assertEqual(result['summary']['realized_net'],93)
        self.assertEqual(result['summary']['commission'],3)
        self.assertEqual(result['fills'][0]['opening_commission'],4)

    def test_today_close_skips_yesterday_lot_and_its_fee(self):
        events=[fill(1,100,1,'0','0',8),fill(2,110,1,'0','0',2,day='20260930'),fill(3,120,1,'1','3',3,day='20260930')]
        self.assertEqual(self.stats(events,'20260930')['summary']['realized_net'],95)

    def test_missing_open_close_fee_and_unmatched_opening_never_show_gross_as_net(self):
        for opening,closing in [(None,3),(2,None)]:
            result=self.stats([fill(1,100,1,'0','0',opening),fill(2,110,1,'1','1',closing)])
            self.assertEqual(result['summary']['realized_gross'],100)
            self.assertIsNone(result['summary']['realized_net'])
            self.assertEqual(result['summary']['pending_net_count'],1)
        self.assertIsNone(self.stats([fill(2,110,1,'1','1',3)])['summary']['realized_net'])

    def test_billed_zero_is_valid_and_account_commission_is_not_allocated(self):
        result=self.stats([fill(1,100,1,'0','0',0),fill(2,110,1,'1','1',0)],account={'official':{'Commission':999}})
        self.assertEqual(result['summary']['realized_net'],100)
        self.assertEqual(result['summary']['commission'],0)
        for value in (None,'',True,-1,float('nan'),float('inf')):
            self.assertIsNone(commission({'cost':value}))

    def test_real_counter_cost_matches_symbol_format_and_order_not_just_trade_id(self):
        events=[fill(1,100,1,'0','0'),fill(2,110,1,'1','1')]
        receipts=[{'contractCode':'RB2701.SHF','tradeId':str(n),'orderId':'order-'+str(n),'cost':fee,'tradeTime':'2026-09-29 21:25:02'} for n,fee in [(1,2),(2,3)]]
        result=self.stats(events,account={'trades':receipts})
        self.assertEqual(result['summary']['realized_net'],95)
        self.assertEqual(result['fills'][0]['time_source'],'counter')
        receipts[0]['orderId']='another-order'
        self.assertIsNone(self.stats(events,account={'trades':receipts})['summary']['realized_net'])

    def test_fifo_uses_execution_time_and_deduplicates_receipts(self):
        opened=fill(1,100,1,'0','0',2);closed=fill(2,110,1,'1','1',3)
        self.assertEqual(self.stats([closed,opened,closed])['summary']['realized_net'],95)
        self.assertEqual(self.stats([closed,opened,closed])['summary']['fill_count'],2)

    def test_live_multiplier_enables_position_valuation(self):
        result=self.stats([fill(1,100,1,'0','0',2)],markets=[{'symbol':'rb2701','product':'rb','price':110,'multiplier':10,'long':1,'short':0}])
        self.assertEqual(result['summary']['floating_gross'],100)

    def test_delayed_fee_enrichment_survives_restart_without_new_trade(self):
        with tempfile.TemporaryDirectory() as root:
            store=Store(root);event=fill(1,100,1,'0','0')
            store.event('trade',event['payload'],dedupe='test',at=1)
            store.enrich_trade_receipt('test',{'commission':2,'trade_time':'21:00:01','volume':99})
            store.enrich_trade_receipt('test',{'commission':None})
            recovered=Store(root).fills_since(0)
            self.assertEqual(len(recovered),1)
            self.assertEqual(recovered[0]['payload']['volume'],1)
            self.assertEqual(recovered[0]['payload']['commission'],2)
            self.assertEqual(self.stats(recovered+[fill(2,110,1,'1','1',3)])['summary']['realized_net'],95)


if __name__=='__main__':unittest.main()
