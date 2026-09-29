import json
import tempfile
import threading
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch, Mock

from fly.llm_trading import ModelTrader, parse_answer, engine_config, infer
from fly.models import Settings
from fly.store import Store
from fly.service import Organism, FlyManager
from fly.trade_filters import opening_filter, filter_config


class ModelTradingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.settings = Settings(decision_engine='llm', trade_model='{"provider":"test","model":"mock"}',
                                 instruments=[dict(product='rb', symbol='rb2610', exchange='SHF')])
        self.o = SimpleNamespace(settings=self.settings, store=Store(Path(self.temp.name)), lock=threading.RLock(),
                                 closed=False, control=dict(trading=True, paused=False, run_id='one'), account_cache={}, request_execution=Mock())
        self.trader = ModelTrader(self.o)
        self.request = dict(head='trade', product='rb', symbol='rb2610', decision_id='a'*32, input_at=time.time(),
                            sizing=dict(current_position=0, long_capacity=5, short_capacity=5), bars=[], quote={},
                            close_only=False, signal_bar='2026-09-28T09:59:00+08:00', filter_config=filter_config({}))

    def tearDown(self):
        self.temp.cleanup()

    def answer(self, **changes):
        return json.dumps(dict(symbol='rb2610', action='LONG', target_position=1, reason='趋势延续', **changes), ensure_ascii=False)

    def run_model(self, text=None, side_effect=None):
        generation = (self.o.control['run_id'], self.settings.model_dump_json())
        self.trader.jobs['rb'] = self.request['decision_id']
        with patch('fly.llm_trading.bridge.call', return_value={'text': text or self.answer()}, side_effect=side_effect):
            self.trader.run(self.request, self.settings.model_copy(deep=True), generation, {})

    def test_valid_decision_is_audited_and_uses_original_observation_time(self):
        self.run_model()
        signal = self.o.store.get('signal:rb')
        self.assertEqual(signal['choice']['readout'], 'llm-trade-1')
        self.assertEqual(signal['engine_config'], engine_config(self.settings))
        self.assertEqual(signal['input_at'], self.request['input_at'])
        self.assertEqual(signal['run_id'], 'one')
        self.assertEqual(self.o.store.decision('a'*32), signal)
        self.assertEqual(self.o.store.usage()['trade_model'], 1)
        self.o.request_execution.assert_called_once()

    def test_compact_model_input_preserves_all_market_values_and_constraints(self):
        self.request['bars']=[dict(datetime=f'2026-09-29T06:{i%60:02d}:00+00:00',open=100+i/100,
                                  high=101+i/100,low=99+i/100,close=100.5+i/100,volume=i*10) for i in range(65)]
        self.request['quote']={'price':101.12,'quote_at':time.time()}
        with patch('fly.llm_trading.bridge.call',return_value={'text':self.answer()}) as call:
            infer(self.request,self.settings,{'official':{'Balance':100000}})
        payload=call.call_args.args[1]['payload']
        restored=[dict(zip(payload['bar_columns'],row)) for row in payload['bars']]
        self.assertEqual(restored,self.request['bars'][-60:])
        self.assertEqual(payload['quote'],self.request['quote'])
        self.assertEqual(payload['sizing'],self.request['sizing'])
        self.assertEqual(payload['max_lots'],self.settings.llm_max_lots)
        self.assertLess(len(json.dumps(payload['bars'])),len(json.dumps(restored)))

    def test_invalid_outputs_never_become_signals(self):
        good = json.loads(self.answer())
        for change in [dict(symbol='cu2611'), dict(target_position=2), dict(target_position=True),
                       dict(target_position='1'), dict(action='WAIT'), dict(action='CLOSE', target_position=0),
                       dict(action='SHORT'), dict(tool='order')]:
            with self.subTest(change=change):
                with self.assertRaises(ValueError):
                    parse_answer(json.dumps({**good, **change}), self.request, self.settings)
        self.run_model('not JSON')
        self.assertIsNone(self.o.store.get('signal:rb'))
        self.assertEqual(self.o.store.get('model_status:rb')['status'], 'error')

    def test_reduce_existing_larger_holding_and_wait(self):
        self.request['sizing']['current_position'] = 5
        for action, target in [('LONG', 3), ('WAIT', 5), ('CLOSE', 0)]:
            value = dict(symbol='rb2610', action=action, target_position=target, reason='持仓管理')
            self.assertEqual(parse_answer(json.dumps(value), self.request, self.settings)['target_position'], target)

    def test_no_opening_without_capacity(self):
        self.request['sizing'].pop('long_capacity')
        with self.assertRaises(ValueError): parse_answer(self.answer(), self.request, self.settings)

    def test_late_result_discarded_after_pause_change_engine_or_new_run(self):
        for change in ['pause', 'engine', 'run', 'prompt']:
            with self.subTest(change=change):
                self.o.control.update(trading=True, run_id='one')
                self.o.settings = self.settings.model_copy(deep=True)
                def respond(*_):
                    if change == 'pause': self.o.control['trading'] = False
                    if change == 'run': self.o.control['run_id'] = 'two'
                    if change == 'engine': self.o.settings.decision_engine = 'neural'
                    if change == 'prompt': self.o.settings.trade_instructions = '新要求'
                    return {'text': self.answer()}
                self.run_model(side_effect=respond)
                self.assertIsNone(self.o.store.get('signal:rb'))
                self.assertEqual(self.o.store.get('model_status:rb')['status'], 'discarded')

    def test_expiry_and_daily_budget_never_fall_back_to_neural(self):
        self.request['input_at'] -= 91
        self.run_model()
        self.assertIsNone(self.o.store.get('signal:rb'))
        self.assertIn('过期', self.o.store.get('model_status:rb')['message'])
        self.settings.trade_daily_calls = 1
        with patch('fly.llm_trading.infer') as infer:
            self.run_model()
            infer.assert_not_called()

    def test_multicontract_scheduler_caps_concurrency_and_skips_busy_contracts(self):
        self.o.settings = Settings(**{**self.settings.model_dump(), 'instruments': [
            dict(product=p, symbol=p+'2610', exchange='SHF') for p in ['rb', 'cu', 'ag', 'au']]})
        for i in self.o.settings.instruments:
            self.o.store.put('feed:'+i.product, dict(symbol=i.symbol))
            self.o.store.put('meta:bars:'+i.product, dict(symbol=i.symbol))
        # Use the real bar-key format rather than substituting the scheduler's selection logic.
        from fly.history import bars_key
        for i in self.o.settings.instruments:
            self.o.store.put('meta:'+bars_key(i.product,1), dict(symbol=i.symbol))
        def choose(store, products, seen, cursor, now, busy=()):
            p=next(p for p in products if p not in busy)
            return {**self.request, 'product':p, 'symbol':p+'2610'}, 0
        with patch('fly.llm_trading.next_trade', side_effect=choose) as pick, patch('fly.llm_trading.threading.Thread') as worker:
            self.trader.tick(time.time())
            self.assertEqual(worker.call_count, 3)
            self.assertEqual(len(self.trader.jobs), 3)
            self.trader.tick(time.time())
            self.assertEqual(worker.call_count, 3)
            self.assertEqual(pick.call_count, 3)

    def test_llm_start_needs_no_neural_dependencies(self):
        with patch.object(Organism, 'loop'):
            manager = FlyManager(Path(self.temp.name)/'manager')
            o = manager.get('test')
        try:
            o.configure(self.settings)
            with patch.object(o, 'dependencies', side_effect=AssertionError('must not load neural')), patch.object(o, 'request_connection'):
                o.command('trade', execution_consent='automatic-orders-v1')
            self.assertTrue(o.control['trading'])
            self.assertIsNone(o.process)
            with self.assertRaises(ValueError): o.configure(self.settings.model_copy(update={'trade_instructions':'changed'}))
        finally:
            o.close()

    def test_automatic_run_requires_new_consent_and_manual_run_does_not(self):
        with patch.object(Organism, 'loop'):
            manager = FlyManager(Path(self.temp.name)/'modes')
            o = manager.get('test')
        try:
            o.configure(self.settings)
            with patch.object(o, 'request_connection'):
                with self.assertRaisesRegex(ValueError, '风险'): o.command('trade')
                self.assertFalse(o.control.get('trading'))
                o.command('trade', execution_consent='automatic-orders-v1')
                first_run = o.control['run_id']
                self.assertEqual(o.control['authorization']['run_id'], first_run)
                with self.assertRaisesRegex(ValueError, '暂停'):
                    o.configure(self.settings.model_copy(update={'execution_mode':'manual'}))
                o.command('observe')
                with self.assertRaisesRegex(ValueError, '风险'): o.command('trade')
                o.configure(self.settings.model_copy(update={'execution_mode':'manual'}))
                o.command('trade')
                self.assertTrue(o.control['trading'])
                self.assertEqual(o.control['execution'], 'manual')
                self.assertIsNone(o.control['authorization'])
                self.assertNotEqual(o.control['run_id'], first_run)
        finally:
            o.close()

    def test_llm_confirmation_does_not_require_invented_neural_scores(self):
        from fly.history import timestamp
        cfg = filter_config(dict(signal_confirmations=2))
        decision = {**self.request, 'engine':'llm', 'filter_config':cfg, 'choice':{'action':'LONG'}}
        state, trace = opening_filter({}, decision, cfg, 'rb', timestamp(decision['signal_bar'])+65)
        self.assertEqual(trace['confirmed'], 1)
        self.assertFalse(trace['allowed'])
        decision['signal_bar'] = '2026-09-28T10:00:00+08:00'
        state, trace = opening_filter(state, decision, cfg, 'rb', timestamp(decision['signal_bar'])+65)
        self.assertTrue(trace['allowed'])


if __name__ == '__main__': unittest.main()
