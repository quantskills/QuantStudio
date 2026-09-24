"""One MaleCNS process; this process has no account credentials or order API."""
import hashlib
import json
import os
from pathlib import Path
import sys
import time

# Windows embeddable Python deliberately omits the script directory from sys.path.
sys.path.insert(0,str(Path(__file__).resolve().parent))
from neural_motor import NeuralMotor
from neural_life import LifeChannels, LifeReadout, observe_life
from neural_trade import TradeReadout, observe_trade, VERSION as TRADE_VERSION
from store import atomic_json


def emit(**data):
    print(json.dumps(data,ensure_ascii=False,allow_nan=False),flush=True)


def main():
    from openfly.neural.brain import Brain
    root=Path(sys.argv[1]);root.mkdir(parents=True,exist_ok=True)
    brain=Brain(plastic=False)
    motor=NeuralMotor(brain,root.parent,progress=lambda **values:emit(kind='calibration',**values))
    channels=LifeChannels(brain,root.parent,progress=lambda **values:emit(kind='calibration',**values))
    life=LifeReadout()
    # Preserve old opaque checkpoint fields for rollback, without constructing
    # or invoking either of the retired random actor-critic heads.
    legacy={}
    trade=TradeReadout()

    def save_readouts():
        # Commit learned parameters before acknowledging the reward. A crash
        # between three-minute brain snapshots must not forget learned updates.
        atomic_json(root/'readouts.json',{'life_readout':life.state(),'trade_readout':trade.state()})

    def restore(version):
        if not version.isalnum(): raise ValueError('检查点标识无效')
        folder=root/version
        state=json.loads((folder/'policy.json').read_text('utf-8'))
        if state.get('motor') and state['motor']!=motor.describe():raise ValueError('神经运动标定版本与检查点不兼容')
        legacy.clear();legacy.update({k:state[k] for k in ('life','trade') if k in state})
        if state.get('life_channels') and state['life_channels']!=channels.describe():raise ValueError('生活感觉标定与检查点不兼容')
        if state.get('life_readout'):life.restore(state['life_readout'])
        else:life.restore(LifeReadout().state())
        trade.restore(state.get('trade_readout') or TradeReadout().state())
        brain.restore(str(folder/'brain.npz'))

    def checkpoint():
        version=f'{time.time_ns():x}'
        folder=root/version;folder.mkdir()
        brain.checkpoint(str(folder/'brain.npz'))
        with (folder/'brain.npz').open('rb+') as handle:os.fsync(handle.fileno())
        atomic_json(folder/'policy.json',{**legacy,'motor':motor.describe(),
                    'life_channels':channels.describe(),'life_readout':life.state(),'trade_readout':trade.state()})
        atomic_json(root/'latest.json',{'version':version})
        emit(kind='checkpoint',version=version,updates={'life':life.updates,'trade':trade.updates})

    if (root/'latest.json').exists(): restore(json.loads((root/'latest.json').read_text(encoding='utf-8'))['version'])
    else:brain.reset()
    if (root/'readouts.json').exists():
        learned=json.loads((root/'readouts.json').read_text('utf-8'))
        life.restore(learned['life_readout']);trade.restore(learned['trade_readout'])
    emit(kind='ready',neurons=brain.n,edges=brain.edges,plastic=False,sim_ms=brain.sim_ms,
         updates={'life':life.updates,'trade':trade.updates},life_controller=channels.describe(),
         trade_controller={'version':TRADE_VERSION,'readout_neurons':channels.describe()['readout_neurons'],
                           'random_action_sampling':False,'connectome_frozen':True},
         provenance={'engine':'OpenFly fd4b06ba0d32fa76965672777e5811da7d9171eb',
                     'graph_sha256':hashlib.file_digest(open(brain.graph_path,'rb'),'sha256').hexdigest(),
                     'parameters':brain.parameters()},motor_controller=motor.describe())
    for line in sys.stdin:
        request=json.loads(line);kind=request['kind']
        if kind=='checkpoint': checkpoint();continue
        if kind=='stop': checkpoint();break
        if kind=='restore': restore(request['version']);save_readouts();emit(kind='restored',version=request['version']);continue
        if kind=='abandon':
            (life if request['head']=='life' else trade).pending.pop(request['decision_id'],None)
            emit(kind='abandoned',decision_id=request['decision_id']);continue
        if kind=='reward':
            if request['head']=='life':
                applied=life.feedback(request['decision_id'],request['reward'],enabled=request['learning'])
                save_readouts()
                emit(kind='learned',decision_id=request['decision_id'],applied=applied,scope='life_readout_only',connectome_frozen=True,
                     reason='' if applied else '学习已冻结' if not request['learning'] else '没有可学习的有效目标或反馈已处理',
                     reward=request['reward'],updates={'life':life.updates,'trade':trade.updates});continue
            decision=request.get('decision') or {}
            if request['decision_id'] not in trade.pending and request['decision_id'] not in trade.applied and decision.get('trade_response'):
                from neural_trade import SENSES
                action=decision['choice']['action']
                if action in trade.actions:
                    trade.pending[request['decision_id']]={'x':[decision['trade_response'][k]['value'] for k in SENSES],
                                                         'index':trade.actions.index(action),'expected':0.}
            applied=trade.feedback(request['decision_id'],request['reward'],enabled=request['learning'])
            save_readouts()
            emit(kind='learned',decision_id=request['decision_id'],applied=applied,
                 scope='trade_readout_only',connectome_frozen=True,
                 reward=request['reward'],updates={'life':life.updates,'trade':trade.updates});continue
        if kind!='observe': raise ValueError('未知神经指令')
        head=request['head']
        if head=='life':
            outcome=observe_life(brain,motor,channels,life,request['world'],request['home'],request['decision_id'])
            emit(kind='decision',head=head,decision_id=request['decision_id'],input_at=request['input_at'],
                 input_hash=hashlib.sha256(json.dumps(request,sort_keys=True).encode()).hexdigest(),**outcome)
            continue
        if head=='trade':
            outcome=observe_trade(brain,channels,trade,request['bars'],request['decision_id'],held=request.get('held',0),
                                  minutes=request.get('filter_config',{}).get('trade_period_minutes',1),product=request['product'])
            emit(kind='decision',head=head,decision_id=request['decision_id'],product=request['product'],symbol=request['symbol'],
                 input_key=request['input_key'],input_at=request['input_at'],
                 filter_config=request.get('filter_config'),signal_bar=request.get('signal_bar'),
                 input_hash=hashlib.sha256(json.dumps(request,sort_keys=True).encode()).hexdigest(),**outcome)


if __name__=='__main__':
    try: main()
    except Exception as exc:
        emit(kind='error',message=f'{type(exc).__name__}: {exc}')
        raise
