from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).parent))
from fly.models import Settings
from fly.service import FlyManager, Organism
from fly.settlement import Settlement
from fly.analytics import record_account_sample
from fly.contest import sync
from unittest.mock import patch
from fly.history import merge_bars, timestamp
from fly.bridge import equal_notional_lots
from server import dispatch


class RuntimeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.manager = FlyManager(self.temp.name)
        self.addCleanup(self.temp.cleanup)
        self.addCleanup(self.manager.close)

    def test_no_execution_route(self):
        with self.assertRaisesRegex(ValueError, '未知果蝇接口'):
            dispatch(self.manager, 'execute', {'plan_id': 'fake'})

    def test_blender_configuration_rejects_other_programs(self):
        with self.assertRaisesRegex(ValueError,'Blender'):
            dispatch(self.manager,'environment/config',{'blender_path':sys.executable})

    def test_restart_disables_trading_but_preserves_memory(self):
        item = self.manager.get('local')
        item.store.put('memory', {'message': 'saved'})
        item.control.update(paused=True, trading=True)
        item.store.put('control', item.control)
        item.close()
        reopened = Organism(self.manager, 'local')
        self.manager.instances['local'] = reopened
        self.assertFalse(reopened.control['trading'])
        self.assertEqual(reopened.store.get('memory'), {'message': 'saved'})

    def test_settings_require_actual_matching_contracts(self):
        with self.assertRaises(ValueError):
            dispatch(self.manager, 'settings', {**Settings().model_dump(), 'instruments': [{'product':'au','symbol':'rb2610','exchange':'SHF'}]})
        with self.assertRaises(ValueError):
            dispatch(self.manager, 'settings', {**Settings().model_dump(), 'instruments': [{'product':'rb','symbol':'rb2610','exchange':'SHF'}] * 2})

    def test_default_home_has_real_binary_asset(self):
        result = dispatch(self.manager, 'asset/default/home.glb')
        self.assertTrue(result['url'].startswith('data:model/gltf-binary;base64,'))
        with self.assertRaises(ValueError): dispatch(self.manager, 'asset/../../credentials')

    def test_market_window_excludes_unfinished_bars(self):
        bar = {'datetime':1200, 'open':10, 'high':12, 'low':9, 'close':11, 'volume':3}
        self.assertEqual(merge_bars([], [bar], now=1259), [])
        self.assertEqual(len(merge_bars([], [bar], now=1260)), 1)

    def test_allocations_use_integer_lots_and_include_multiplier(self):
        result = equal_notional_lots(40000, 3300, 10)
        self.assertEqual(result['lots'], 1)
        self.assertEqual(result['multiplier'], 10)
        with self.assertRaises(ValueError): equal_notional_lots(40000, 0, 10)

    def test_status_does_not_invent_account_data_or_neural_activity(self):
        state = dispatch(self.manager, 'state')
        self.assertIsNone(state['account'])
        self.assertEqual(state['neural']['status'], 'stopped')
        self.assertEqual(state['markets'], [])
        self.assertFalse(state['control']['trading'])

    def test_rewards_require_explicit_complete_account_evidence(self):
        store = self.manager.get('local').store
        snapshot = {'official': {'Balance':1000000,'Commission':0,'TradingDay':'20260923'},
                    'official_sync': {'stale':False}, 'official_updated_at':'2026-09-23T02:00:00Z'}
        self.assertEqual(Settlement(store).observe(snapshot, {'fly-contest'}), [])
        self.assertIsNone(store.get('settlement_baseline'))
        self.assertTrue(any(e['kind']=='learning_deferred' for e in store.recent()))
        self.assertTrue(record_account_sample(store, {**snapshot,'trading_account_id':'a'}, 'a', now=timestamp(snapshot['official_updated_at'])))

    def test_only_complete_owned_flat_cycle_produces_a_reward(self):
        store = self.manager.get('local').store
        snapshot = {'official':{'Balance':1000000,'Commission':0,'Deposit':0,'Withdraw':0,'TradingDay':'20260923'},
                    'official_sync':{'stale':False},'reward_evidence_complete':True,
                    'official_updated_at':'2026-09-23T02:00:00Z','trades':[],'official_positions':[]}
        settlement = Settlement(store)
        self.assertEqual(settlement.observe(snapshot,{'fly-contest'}),[])
        trade = {'symbol':'RB2610.SHF','trading_day':'20260923','trade_id':'t','runtime_id':'fly-contest'}
        store.event('trade',{**trade,'symbol':'rb2610'},decision_id='d',at=timestamp('2026-09-23T02:01:00Z'))
        snapshot.update(trades=[trade],official_updated_at='2026-09-23T02:02:00Z')
        snapshot['official'].update(Balance=1000100,Commission=5)
        rewards = settlement.observe(snapshot,{'fly-contest'})
        self.assertEqual(len(rewards),1)
        self.assertEqual(rewards[0]['decision_id'],'d')
        self.assertEqual(rewards[0]['evidence']['pnl_after_fees'],100)
        self.assertEqual(settlement.observe(snapshot,{'fly-contest'}),[])

    def test_verified_fills_keep_actual_time_and_import_once(self):
        item = self.manager.get('local')
        item.store.put('contest_plans', {'plan':'decision'})
        item.store.event('decision', {'product':'rb'}, decision_id='decision')
        result = {'identity':{'accountId':'a','contestId':'c'}, 'feeds':{'rb':{'symbol':'rb2610','multiplier':10}},
          'account':{'official':{},'trades':[]}, 'plans':[{'id':'plan','status':'completed','summary':'filled',
          'details':{'parameters':{'contractCode':'rb2610','side':'sell','offset':'close'}},
          'fills':[{'id':'f','tradeId':'t','orderId':'o','time':'2026-09-22T02:00:00Z','price':3300,'volume':1}]}]}
        with patch('fly.contest.bridge.call', return_value=result):
            sync(item); sync(item)
        events = item.store.fills_since(0)
        self.assertEqual(len(events),1)
        self.assertEqual(events[0]['payload']['trading_day'],'20260922')
        self.assertEqual(events[0]['at'],events[0]['payload']['at'])
        self.assertEqual(item.store.get('last_close:rb'),events[0]['at'])


if __name__ == '__main__': unittest.main()
