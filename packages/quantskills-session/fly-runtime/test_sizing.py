import unittest
from fly.neural_trade import TradeReadout, SENSES

class SizingTests(unittest.TestCase):
    def choose(self, up, down=0, volatility=0, current=0, capacity=20):
        return TradeReadout().choose(dict(zip(SENSES,[up,down,up,down,volatility])), 'test', held=(1 if current>0 else -1 if current<0 else 0), sizing={'current_position':current,'long_capacity':capacity,'short_capacity':capacity})
    def test_strength_changes_target_lots(self):
        self.assertGreater(self.choose(1)['target_position'], self.choose(.4)['target_position'])
    def test_volatility_reduces_target(self):
        self.assertGreater(self.choose(1)['target_position'], self.choose(1,volatility=.8)['target_position'])
    def test_add_reduce_reverse(self):
        self.assertGreater(self.choose(1,current=1)['target_position'],1)
        self.assertLess(self.choose(.4,current=15)['target_position'],15)
        self.assertEqual(self.choose(0,1,current=3)['target_position'],0)
        self.assertEqual(self.choose(0,1,current=3)['action'],'CLOSE')
    def test_wait_retains_inventory(self):
        self.assertEqual(self.choose(.1,.1,current=3)['target_position'],3)
    def test_missing_capacity_never_opens(self):
        self.assertEqual(self.choose(1,capacity=None)['action'],'WAIT')
        self.assertEqual(self.choose(0,1,current=3,capacity=None)['action'],'CLOSE')
    def test_migrates_prior_checkpoint(self):
        model=TradeReadout(); state=model.state(); state['version']='neural-trade-2'
        model.restore(state)
        self.assertEqual(model.state()['version'],'neural-trade-3')

    def test_legacy_feedback_replay_survives_upgrade(self):
        import tempfile
        from pathlib import Path
        from fly.store import Store, atomic_json
        from fly.learning_report import learning_report
        with tempfile.TemporaryDirectory() as temp:
            store=Store(temp); model=TradeReadout(); values=[1,0,1,0,0]
            model.pending['old']={'x':values,'index':0,'expected':0.}
            model.feedback('old',.2)
            store.event('decision',{'choice':{'readout':'neural-trade-2','action':'LONG'},
                                   'trade_response':{k:{'value':v} for k,v in zip(SENSES,values)}},decision_id='old')
            store.event('learning_update',{'scope':'trade_readout_only','applied':True,'reward':.2},decision_id='old')
            atomic_json(Path(temp)/'checkpoints/latest.json',{'version':'abc'})
            atomic_json(Path(temp)/'checkpoints/abc/policy.json',{'trade_readout':model.state()})
            self.assertTrue(learning_report(store,'20260924')['checkpoint']['replay_matches'])
