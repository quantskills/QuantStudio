"""Engineered life sensors and deterministic readout of a frozen connectome.

Five scalar channels occupy artificial retinal UV bands. They are NOT claimed
to be endogenous hunger, sleep or goal circuits. Only downstream lamina spike
counts enter the goal readout. Geometry is available only to sensory encoding.
"""
import hashlib
import json
import math
from pathlib import Path
import numpy as np

try:
    from .neural_motor import perceive, sector, stimulus, NEURAL_MS
except ImportError:
    from neural_motor import perceive, sector, stimulus, NEURAL_MS

VERSION = 'life-readout-1'
CHANNELS = ('food', 'hunger', 'fatigue', 'obstacle', 'novelty')
LEVELS = np.array([0., .25, .5, .75, 1.])


def clear(home, point, margin=.14):
    x,y,z=point;b=home['bounds']
    return (b[0]+margin<=x<=b[1]-margin and b[2]+margin<=z<=b[3]-margin
            and not any(abs(x-o['x'])<o['width']/2+margin and abs(z-o['z'])<o['depth']/2+margin
                        and y<o['height']+margin for o in home['obstacles']))


def sense(world, home):
    code, food=perceive(world,home)
    position=world['position'];yaw=world.get('yaw',0.)
    distance=next((d for d in (.2,.4,.6,.8) if not clear(home,
        [position[0]+math.sin(yaw)*d,position[1],position[2]-math.cos(yaw)*d])),None)
    values={'food':float(bool(code)), 'hunger':float(world['hunger']),
            'fatigue':1-float(world['energy']), 'obstacle':1. if distance is not None or world.get('motor_blocked',False) else 0.,
            'novelty':float(world['curiosity'])}
    return {'values':values,'visible_food':food['visible_food'],'food_sector':code,
            'obstacle_distance':distance,'contact_blocked':bool(world.get('motor_blocked',False)),'source':'engineered_world_sensors',
            'engineering_inputs':list(CHANNELS),'encoding':'artificial_retinal_uv_bands',
            'note':'几何食物/障碍探测；饥饿、疲劳和探索需求是工程模拟，非已识别生物回路'}


def navigation(goal, neural_values, world, home):
    """Select an attended sensory cue; motor decoder never receives geometry."""
    if goal not in ('eat','explore'):return 0,{'cue':'none'}
    position=np.asarray(world['position']);yaw=world.get('yaw',0.)
    if neural_values.get('obstacle',0)>.3:
        # Sample free space as a simulated range sensor. The chosen cue must
        # still propagate through retinal synapses and the motor readout.
        ahead=position+np.array([math.sin(yaw)*.8,0,-math.cos(yaw)*.8])
        b=home['bounds'];boundary=not (b[0]+.14<=ahead[0]<=b[1]-.14 and b[2]+.14<=ahead[2]<=b[3]-.14)
        return sector(math.pi/2 if boundary else 0,.65 if not boundary else 0),{'cue':'obstacle_escape','range_sensor':True}
    if goal=='eat':
        code,meta=perceive(world,home);return code,{'cue':'food',**meta}
    b=home['bounds'];visits=world.get('explore_visits',{})
    candidates=[(f'{i}:{j}',[x,2.7,z]) for i,x in enumerate((b[0]+.65,b[1]-.65))
                for j,z in enumerate((b[2]+.65,b[3]-.65))]
    candidates=[(key,p) for key,p in candidates if clear(home,p)]
    if not candidates:return 0,{'cue':'no_exploration_space'}
    key,target=min(candidates,key=lambda item:(visits.get(item[0],0),math.dist(position,item[1]),item[0]))
    delta=np.asarray(target)-position
    bearing=math.atan2(float(delta[0]),float(-delta[2]))-yaw
    elevation=math.atan2(float(delta[1]),max(.01,float(np.linalg.norm(delta[[0,2]]))))
    return sector(bearing,elevation),{'cue':'novel_landmark','landmark':key,'position':target,
                                     'note':'工程视觉注意：较少访问的家园地标'}


class LifeChannels:
    def __init__(self, brain, root, progress=lambda **_:None):
        eye=brain.eye_map();self.bins16=np.minimum(4,(eye.uv_r16[:,0]*5).astype(int))
        self.bins8=np.minimum(4,(eye.uv_r8[:,0]*5).astype(int))
        lam=np.asarray(brain.populations['lamina']);adj=np.zeros((5,brain.n))
        for ids,bins in ((brain.r16,self.bins16),(brain.r8,self.bins8)):
            for src,ch in zip(ids,bins):
                edges=slice(brain.kernel.ptr[src],brain.kernel.ptr[src+1])
                np.add.at(adj[ch],brain.kernel.post[edges],np.abs(brain.kernel.weight[edges]))
        assignment=adj[:,lam].argmax(0);total=adj[:,lam].sum(0)
        self.groups=[lam[(assignment==ch)&(adj[ch,lam]>.95*np.maximum(total,1e-12))] for ch in range(5)]
        if min(map(len,self.groups))<50:raise ValueError('生活神经通道缺少可辨识的下游读出')
        self.identity={'version':VERSION,'graph_sha256':hashlib.file_digest(open(brain.graph_path,'rb'),'sha256').hexdigest(),
                       'parameters':brain.parameters(),'groups_sha256':hashlib.sha256(b''.join(g.tobytes() for g in self.groups)).hexdigest(),
                       'encoding':'five_retinal_bands_luminance_0_or_0.15_plus_0.4x','neural_ms':NEURAL_MS}
        path=Path(root)/'life-calibration.npz'
        if path.exists():
            with np.load(path,allow_pickle=False) as saved:
                if json.loads(str(saved['identity']))==self.identity:
                    self.rates=saved['rates'];self._validate();return
        rates=[]
        for index,level in enumerate(LEVELS):
            brain.reset();samples=[]
            for rep in range(3):
                result=brain.observe(self.encode(dict.fromkeys(CHANNELS,float(level))),NEURAL_MS)
                if rep:samples.append([float(result.counts[g].mean()) for g in self.groups])
            rates.append(np.mean(samples,axis=0));progress(done=index+1,total=5,stage='life')
        self.rates=np.asarray(rates);self._validate();path.parent.mkdir(parents=True,exist_ok=True)
        temporary=path.with_suffix('.partial')
        with temporary.open('wb') as out:np.savez_compressed(out,identity=json.dumps(self.identity,sort_keys=True),rates=self.rates)
        temporary.replace(path)

    def _validate(self):
        if self.rates.shape!=(5,5) or not np.isfinite(self.rates).all() or not (np.diff(self.rates,axis=0)<0).all():
            raise ValueError('生活通道标定不单调或已损坏，拒绝启用')

    def encode(self, values, disconnect=()):
        from openfly.interfaces import Stimulus
        values=np.array([0 if k in disconnect else float(values[k]) for k in CHANNELS])
        if not np.isfinite(values).all():raise ValueError('生活感觉输入无效')
        luminance=np.where(values<=.05,0,.15+.4*np.clip(values,0,1))
        return Stimulus(r16=luminance[self.bins16].astype(np.float32),r8=luminance[self.bins8].astype(np.float32))

    def decode(self, counts):
        values={};trace={}
        for i,(name,group) in enumerate(zip(CHANNELS,self.groups)):
            spikes=np.asarray(counts)[group];mean=float(spikes.mean());active=int(np.count_nonzero(spikes))
            valid=bool(np.isfinite(spikes).all() and active>0 and mean>=self.rates[-1,i]*.4 and mean<=self.rates[0,i]*1.25)
            value=float(np.interp(mean,self.rates[::-1,i],LEVELS[::-1])) if valid else 0.
            # Reject cross-channel leakage close to the dark response.
            if value<.1:value=0.
            values[name]=value
            trace[name]={'value':value,'mean_spikes':mean,'active':active,'neurons':len(group),'valid':valid}
        return values,trace

    def describe(self):
        return {**self.identity,'calibration_sha256':hashlib.sha256(self.rates.tobytes()).hexdigest(),
                'readout_neurons':sum(map(len,self.groups)),'channels':dict(zip(CHANNELS,map(len,self.groups))),
                'connectome_learning':False,'random_action_sampling':False,
                'interface':'工程多通道感觉 → 冻结连接组 → 确定性可学习目标读出；非天然目标回路重建'}


class LifeReadout:
    """Deterministic contextual value learning; no random initialization/actions.

    Initial drive competition is an explicit engineering prior. Only observed
    outcome rewards update readout values; input/connection weights stay frozen.
    """
    actions=('eat','rest','explore')
    def __init__(self):
        self.weights=np.zeros((3,5));self.updates=0;self.pending={};self.applied=set()

    def choose(self, values, decision_id):
        x=np.array([values[k] for k in CHANNELS],float)
        if not np.isfinite(x).all() or ((x<0)|(x>1)).any():raise ValueError('神经生活特征无效')
        food,hunger,fatigue,obstacle,novelty=x
        drives=np.array([1.5*hunger*food,1.3*fatigue,.8*novelty*(1-.6*fatigue)*(1-.5*hunger)])
        available=np.array([food>.2 and hunger>.1,fatigue>.1,novelty>.1])
        expected=self.weights@x
        scores=drives*(1+np.clip(expected,-.65,.65));scores[~available]=0
        index=int(np.argmax(scores));action=self.actions[index] if scores[index]>.08 else 'idle'
        if action!='idle':self.pending[decision_id]={'x':x.tolist(),'index':index,'expected':float(expected[index])}
        while len(self.pending)>2048:self.pending.pop(next(iter(self.pending)))
        return {'action':action,'scores':dict(zip(self.actions,scores.tolist())),
                'drives':dict(zip(self.actions,drives.tolist())),'expected_rewards':dict(zip(self.actions,expected.tolist())),
                'sampling':False,'readout':VERSION,'learning_scope':'readout_only','connectome_frozen':True}

    def feedback(self, decision_id, reward, enabled=True):
        if not np.isfinite(reward):raise ValueError('反馈必须是已发生的有限结果')
        if decision_id in self.applied or decision_id not in self.pending:return False
        record=self.pending.pop(decision_id);self.applied.add(decision_id)
        if not enabled:return False
        x=np.array(record['x']);i=record['index'];error=float(np.clip(reward,-1,1))-float(self.weights[i]@x)
        self.weights[i]+= .12*error*x/max(1,float(x@x))
        self.weights=np.clip(self.weights,-1,1);self.updates+=1;return True

    def state(self):
        return {'version':VERSION,'weights':self.weights.tolist(),'updates':self.updates,'pending':self.pending,
                'applied':sorted(self.applied)[-10000:]}

    def restore(self,state):
        weights=np.asarray(state['weights'],float)
        if state['version']!=VERSION or weights.shape!=(3,5) or not np.isfinite(weights).all():raise ValueError('生活读出检查点不兼容')
        self.weights=weights;self.updates=int(state['updates']);self.pending=state['pending'];self.applied=set(state['applied'])


def observe_life(brain,motor,channels,life,world,home,decision_id,*,input_cut=(),output_cut=(),motor_cut=False):
    """Shared production/experiment path. Cuts are never exposed in live APIs."""
    sensory=sense(world,home)
    observed=brain.observe(channels.encode(sensory['values'],disconnect=input_cut),NEURAL_MS)
    counts=observed.counts.copy()
    for name in output_cut:counts[channels.groups[CHANNELS.index(name)]]=0
    values,response=channels.decode(counts);choice=life.choose(values,decision_id)
    code,nav=navigation(choice['action'],values,world,home)
    movement=brain.observe(stimulus(brain,code),NEURAL_MS)
    command=motor.decode(np.zeros_like(movement.counts) if motor_cut else movement.counts)
    # Held-out continuous intact responses match above .86. Partial retinal
    # lesions can alias a wrong motor sector near .76; reject that margin in
    # the new life controller. No geometric/random fallback is permitted.
    if command['drive'] and command['confidence']<.8:
        command=motor.command(0,command['confidence'],'unrecognized_activity',command['active_readout_neurons'])
    if choice['action'] not in ('eat','explore'):command=motor.command(0,command['confidence'],'no_motor_goal',0)
    return {'choice':choice,'motor':command,'sensory':sensory,'life_response':response,'navigation':nav,
            'total_spikes':int(observed.counts.sum()+movement.counts.sum()),'goal_spikes':int(observed.counts.sum()),
            'motor_spikes':int(movement.counts.sum()),'sim_ms':movement.sim_ms,
            'compute_seconds':observed.compute_seconds+movement.compute_seconds,
            'activity':{k:v for k,v in brain.population_rates(observed.counts,NEURAL_MS).items() if k in ('DN','MBON','KC','R1-R6','lamina')},
            'response_hash':hashlib.sha256(counts.tobytes()+movement.counts.tobytes()).hexdigest(),
            'experiment':{'input_cut':list(input_cut),'output_cut':list(output_cut),'motor_cut':motor_cut}}
