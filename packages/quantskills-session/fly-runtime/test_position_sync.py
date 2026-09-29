import copy
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest

sys.path.insert(0, str(Path(__file__).parent))
from fly.store import Store
from fly.position_sync import reconcile_positions


class PositionSyncTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.o = SimpleNamespace(store=Store(Path(self.tmp.name)))
        self.o.store.event('decision', {'decision_id':'d','product':'ao',
            'choice':{'current_position':0,'target_position':2}}, decision_id='d')
        self.result = {'account':{'trades':[]}, 'feeds':{
            'ao':{'symbol':'ao2701','long':0,'short':0,'inflight':False},
            'rb':{'symbol':'rb2701','long':0,'short':0,'inflight':False}},
            'plans':[{'id':'p','sessionId':'fly:d','status':'completed',
                'details':{'parameters':{'contractCode':'AO2701.SHF','side':'buy','offset':'open'}},
                'fills':[{'id':'f','tradeId':'t','time':'2026-09-29T06:37:43Z','volume':1}]}]}

    def test_fill_missing_from_positions_blocks_only_affected_contract(self):
        reconcile_positions(self.o,self.result)
        self.assertTrue(self.result['feeds']['ao']['inflight'])
        self.assertEqual(self.result['feeds']['ao']['long'],0)
        self.assertEqual(self.result['feeds']['ao']['position_sync']['expected'],1)
        self.assertFalse(self.result['feeds']['rb']['inflight'])
        self.assertEqual(self.o.store.get('execution_status:ao')['status'],'reconciling')

    def test_position_catches_up_and_ack_survives_restart_and_later_manual_close(self):
        self.result['feeds']['ao']['long']=1
        reconcile_positions(self.o,self.result)
        self.assertFalse(self.result['feeds']['ao']['inflight'])
        self.o.store=Store(Path(self.tmp.name))
        self.result['feeds']['ao']['long']=0
        reconcile_positions(self.o,self.result)
        self.assertFalse(self.result['feeds']['ao']['inflight'])

    def test_partial_fill_growth_requires_new_position_acknowledgement(self):
        self.result['feeds']['ao']['long']=1
        reconcile_positions(self.o,self.result)
        self.result['plans'][0]['fills'].append({'id':'f2','tradeId':'t2','time':'2026-09-29T06:37:44Z','volume':1})
        reconcile_positions(self.o,self.result)
        self.assertTrue(self.result['feeds']['ao']['inflight'])
        self.assertEqual(self.result['feeds']['ao']['position_sync']['expected'],2)

    def test_later_official_close_explains_zero_position(self):
        self.result['account']['trades']=[{'symbol':'AO2701.SHF','trade_id':'close','side':'sell',
            'tradeTime':'2026-09-29T06:38:00Z','volume':1}]
        reconcile_positions(self.o,self.result)
        self.assertFalse(self.result['feeds']['ao']['inflight'])

    def test_short_closing_fill_requires_zero_not_more_short(self):
        self.o.store.event('decision',{'decision_id':'d','product':'ao','choice':{'current_position':-1}},decision_id='d')
        self.result['plans'][0]['details']['parameters']['offset']='close'
        self.result['feeds']['ao']['short']=1
        fresh=copy.deepcopy(self.result)
        reconcile_positions(self.o,self.result)
        self.assertEqual(self.result['feeds']['ao']['position_sync']['expected'],0)
        fresh['feeds']['ao']['short']=0
        reconcile_positions(self.o,fresh)
        self.assertFalse(fresh['feeds']['ao']['inflight'])


if __name__=='__main__': unittest.main()
