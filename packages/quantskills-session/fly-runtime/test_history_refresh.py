import threading
import time
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
from fly.service import FlyManager
from fly.models import Settings
from fly import bridge
from fly.history import history_since, history_delay, timestamp
from server import dispatch


class HistoryRefreshTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.manager = FlyManager(temp.name)
        self.addCleanup(temp.cleanup)
        self.addCleanup(self.manager.close)
        with patch('fly.service.Organism.loop'):
            self.item = self.manager.get('local')
        self.item.store.put('binding', {'identity': {'contestId': 'c', 'accountId': 'a'}})
        self.item.configure(Settings(instruments=[{'product': 'rb', 'symbol': 'rb2610', 'exchange': 'SHF'},
                                                  {'product': 'au', 'symbol': 'au2612', 'exchange': 'SHF'}]))

    def wait_history(self):
        deadline = time.monotonic() + 3
        while self.item.history_status['status'] == 'running' and time.monotonic() < deadline:
            time.sleep(.01)
        self.assertNotEqual(self.item.history_status['status'], 'running')

    def test_manual_and_automatic_requests_share_one_background_job(self):
        entered, release = threading.Event(), threading.Event()
        def fetch(*args):
            entered.set()
            self.assertTrue(release.wait(3))
            return {'bars': []}
        with patch('fly.service.bridge.call', side_effect=fetch) as call:
            try:
                result = dispatch(self.manager, 'control', {'action': 'history'})
                self.assertEqual(result['history']['status'], 'running')
                self.assertTrue(entered.wait(1))
                dispatch(self.manager, 'control', {'action': 'history'})
                self.item.request_history()
                self.assertEqual(call.call_count, 1)
                dispatch(self.manager, 'control', {'action': 'pause'})
                self.assertEqual(dispatch(self.manager, 'state')['history']['status'], 'running')
            finally:
                release.set()
                self.wait_history()
            self.assertEqual(call.call_count, 2)
        self.assertEqual(self.item.history_status['status'], 'complete')
        self.assertGreater(self.item.store.get('history_source:rb:1m')['at'], 0)

    def test_failure_keeps_last_success_and_continues_other_contracts(self):
        self.item.store.put('history_source:rb:1m', {'symbol': 'rb2610', 'at': 123})
        with patch('fly.service.bridge.call', side_effect=[ValueError('PandaData 授权失效'), {'bars': []}]):
            self.item.request_history()
            self.wait_history()
        failed = self.item.store.get('history_source:rb:1m')
        self.assertEqual(failed['at'], 123)
        self.assertIn('授权失效', failed['error'])
        self.assertGreater(self.item.store.get('history_source:au:1m')['at'], 123)
        self.assertEqual(self.item.history_status['status'], 'cooldown')
        after_retry=self.item.history_status['retry_at']+1
        with patch('fly.service.bridge.call', return_value={'bars': []}), patch('fly.service.time.time',return_value=after_retry):
            self.item.request_history()
            self.wait_history()
        self.assertEqual(self.item.history_status['status'], 'complete')
        self.assertFalse(self.item.store.get('history_error'))
        self.assertFalse(self.item.store.get('history_source:rb:1m').get('error'))

    def test_requires_binding_and_contracts(self):
        self.item.store.put('binding', None)
        with self.assertRaisesRegex(ValueError, '比赛账户'):
            dispatch(self.manager, 'control', {'action': 'history'})
        self.item.store.put('binding', {'identity': {'contestId': 'c', 'accountId': 'a'}})
        self.item.configure(Settings())
        with self.assertRaisesRegex(ValueError, '实际合约'):
            dispatch(self.manager, 'control', {'action': 'history'})

    def test_contract_change_during_fetch_does_not_write_old_results(self):
        def fetch(*args):
            self.item.configure(Settings(instruments=[{'product': 'rb', 'symbol': 'rb2611', 'exchange': 'SHF'}]))
            return {'bars': []}
        with patch('fly.service.bridge.call', side_effect=fetch), patch.object(self.item.store, 'merge_market_bars') as merge:
            self.item.request_history()
            self.wait_history()
            merge.assert_not_called()
        self.assertEqual(self.item.history_status['status'], 'cooldown')

    def test_changed_contract_does_not_display_old_history_or_success_time(self):
        self.item.store.put('bars:rb', [{'datetime': 123, 'close': 12}])
        self.item.store.put('meta:bars:rb', {'symbol': 'rb2610'})
        self.item.store.put('history_source:rb:1m', {'symbol': 'rb2610', 'at': 123})
        self.item.configure(Settings(instruments=[{'product': 'rb', 'symbol': 'rb2611', 'exchange': 'SHF'}]))
        state = self.item.status()
        self.assertEqual(state['markets'][0]['symbol'], 'rb2611')
        self.assertEqual(state['markets'][0]['count'], 0)
        self.assertIsNone(state['markets'][0]['history_source'].get('at'))
        self.assertIsNone(state['history']['last_success_at'])

    def test_rate_limit_stops_other_contracts_and_manual_requests_respect_retry_after(self):
        with patch('fly.service.bridge.call', side_effect=bridge.BridgeError('PandaData 限流', source='pandadata', code='RATE_LIMIT', retry_after=120)) as call:
            self.item.request_history(); self.wait_history()
            self.assertEqual(call.call_count, 1)
            self.assertEqual(self.item.history_status['source'], 'pandadata')
            self.assertGreaterEqual(self.item.history_status['retry_at'], time.time()+119)
            self.item.request_history(); self.item.request_history(manual=False)
            self.assertEqual(call.call_count, 1)

    def test_connect_clicks_are_idempotent_and_respect_cooldown(self):
        self.item.connection={'status':'ready','message':'已连接'}
        with patch('fly.service.sync_contest') as sync:
            self.item.request_connection()
            sync.assert_not_called()
        self.item.connection={'status':'waiting'}
        with patch('fly.service.sync_contest', side_effect=bridge.BridgeError('比赛接口限流', source='competition', code='RATE_LIMIT', retry_after=90)) as sync:
            self.item.sync_counter()
            self.item.request_connection(); self.item.sync_counter()
            self.assertEqual(sync.call_count, 1)
            self.assertGreaterEqual(self.item.connection['retry_at'], time.time()+89)

    def test_incremental_cursor_uses_last_bar_or_first_gap_and_preserves_period(self):
        bars=[{'datetime': '2026-09-24T09:30:00+08:00'}]*499+[{'datetime': '2026-09-24T09:31:00+08:00'}]
        self.assertEqual(history_since(bars,'IF'),bars[-1]['datetime'])
        bars[-1]['datetime']='2026-09-24T09:33:00+08:00'
        self.assertEqual(history_since(bars,'IF'),bars[0]['datetime'])
        self.assertIsNone(history_since(bars[:499],'IF'))
        self.assertEqual(history_delay(['IF'],5,timestamp('2026-09-24T10:01:00+08:00')),242)
        self.assertEqual(history_delay(['IF'],1,timestamp('2026-09-24T12:00:00+08:00')),300)

    def test_persisted_window_is_used_for_next_request(self):
        last='2026-09-24T09:31:00+08:00'
        bars=[{'datetime': '2026-09-24T09:30:00+08:00'}]*499+[{'datetime': last}]
        self.item.store.put('meta:bars:rb', {'symbol':'rb2610'})
        self.item.store.put('bars:rb',bars)
        with patch('fly.service.time.time',return_value=timestamp('2026-09-24T10:00:00+08:00')), patch('fly.service.bridge.call',return_value={'bars': []}) as call, patch.object(self.item.store,'merge_market_bars'):
            self.item.request_history();self.wait_history()
            self.assertEqual(call.call_args_list[0].args[1]['since'],last)
            self.assertNotIn('since',call.call_args_list[1].args[1])

    def test_auth_failure_does_not_loop_and_rate_limit_backoff_increases(self):
        first=bridge.retry_state({},bridge.BridgeError('limit'),100,'pandadata')
        second=bridge.retry_state(first,bridge.BridgeError('limit'),130,'pandadata')
        self.assertEqual(first['retry_at'],130)
        self.assertEqual(second['retry_at'],190)
        with patch('fly.service.bridge.call',side_effect=bridge.BridgeError('重新授权',source='pandadata',code='AUTH_REQUIRED',retryable=False)) as call:
            self.item.request_history();self.wait_history()
            self.item.request_history(manual=False)
            self.assertEqual(call.call_count,1)
            self.assertTrue(self.item.history_status['blocked'])


if __name__ == '__main__':
    unittest.main()
