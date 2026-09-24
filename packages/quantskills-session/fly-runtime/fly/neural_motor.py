"""Deterministic, calibrated neural visual-motor interface (engineering model).

The sensor projects food into coarse egocentric retinal sectors. The decoder
receives ONLY spikes from annotated L1/L2/L3/L5 neurons, never world coordinates,
needs, an oracle bias, or a chosen target. This is not a recovered fly circuit.
"""
import hashlib
import json
import math
from pathlib import Path
import numpy as np

VERSION = 'retinal-motor-1'
NEURAL_MS = 200
YAW_BINS = 12
ELEVATIONS = (-.65, 0., .65)


def sector(yaw, elevation):
    yaw_index=int(math.floor((yaw % (2*math.pi))/(2*math.pi/YAW_BINS)+.5)) % YAW_BINS
    level=min(range(3),key=lambda i:abs(ELEVATIONS[i]-elevation))
    return 1+level*YAW_BINS+yaw_index


def angles(code):
    return (code-1)%YAW_BINS*2*math.pi/YAW_BINS,ELEVATIONS[(code-1)//YAW_BINS]


def perceive(world,home):
    """Coarse panoramic food detector. Geometry belongs to sensing, not decoding.

    Detection is an explicit simulated sensor, not image recognition learned by
    the connectome. All visible food cues compete by projected angular size.
    """
    position=np.asarray(world['position'],float);cues=[]
    for obj in home['objects']:
        if obj['kind']!='eat' or world.get('food_stock',{}).get(obj['id'],1)<=0:continue
        delta=np.asarray(obj['position'],float)-position
        distance=float(np.linalg.norm(delta))
        yaw=math.atan2(float(delta[0]),float(-delta[2]))-world.get('yaw',0.)
        elevation=math.atan2(float(delta[1]),max(.01,float(np.linalg.norm(delta[[0,2]]))))
        cues.append((1/max(.1,distance)**2,obj['id'],yaw,elevation,distance))
    if not cues:return 0,{'sensor':'coarse_food_retina','visible_food':0,'sector':0}
    # Stable tie break; no random target selection. This is retinal salience.
    cue=sorted(cues,key=lambda c:(-c[0],c[1]))[0]
    code=sector(cue[2],cue[3])
    return code,{'sensor':'coarse_food_retina','visible_food':len(cues),'sector':code,
                 'bearing_degrees':round(math.degrees(cue[2])%360,1),'elevation_degrees':round(math.degrees(cue[3]),1)}


def stimulus(brain,code):
    from openfly.interfaces import Stimulus
    eye=brain.eye_map()
    def sample(uv):
        result=np.full(len(uv),.28 if code else 0.,dtype=np.float32)
        if code:
            yaw,elevation=angles(code)
            a=(uv[:,0]-.5)*2*np.pi
            delta=np.arctan2(np.sin(a-yaw),np.cos(a-yaw))
            vertical=(.5-uv[:,1])*np.pi
            result+=.72*np.exp(-.5*(delta/.4)**2-.5*((vertical-elevation)/.45)**2)
        return result
    return Stimulus(r16=sample(eye.uv_r16),r8=sample(eye.uv_r8))


class NeuralMotor:
    def __init__(self,brain,root,progress=lambda **_:None):
        # A first-stage visual reflex, not a claim of recovered descending motor
        # circuits. Retinal input propagates through the actual connectome into
        # these annotated lamina neurons; no direct drive is added by this code.
        self.ids=np.asarray(brain.populations['lamina'])
        graph_hash=hashlib.file_digest(open(brain.graph_path,'rb'),'sha256').hexdigest()
        self.identity={'version':VERSION,'graph_sha256':graph_hash,'parameters':brain.parameters(),
                       'ids_sha256':hashlib.sha256(self.ids.tobytes()).hexdigest(),'neural_ms':NEURAL_MS,
                       'sensory_protocol':'food_feature_panorama_v2','decoder':'nearest_whitened_spike_pattern_v2'}
        self.path=Path(root)/'motor-calibration.npz'
        if self.path.exists():
            with np.load(self.path,allow_pickle=False) as saved:
                if json.loads(str(saved['identity']))==self.identity:
                    self.templates=saved['templates'];self.codes=saved['codes'];self.scale=saved['scale']
                    self._validate();return
        rows=[];codes=[]
        for code in range(1+YAW_BINS*3):
            brain.reset()
            for repetition in range(3):
                observed=brain.observe(stimulus(brain,code),NEURAL_MS)
                rows.append(observed.counts[self.ids].astype(float));codes.append(code)
            progress(done=code+1,total=1+YAW_BINS*3)
        raw=np.asarray(rows);self.scale=np.maximum(raw.std(axis=0),1)
        self.templates=raw/self.scale;self.codes=np.asarray(codes,dtype=int)
        self._validate();self.path.parent.mkdir(parents=True,exist_ok=True)
        temporary=self.path.with_suffix('.partial')
        with temporary.open('wb') as out:
            np.savez_compressed(out,identity=json.dumps(self.identity,sort_keys=True),templates=self.templates,codes=self.codes,scale=self.scale)
        temporary.replace(self.path)

    def _validate(self):
        if (self.templates.shape!=(111,len(self.ids)) or self.scale.shape!=(len(self.ids),) or self.codes.shape!=(111,)
                or not np.isfinite(self.templates).all() or not np.isfinite(self.scale).all() or not (self.scale>0).all()
                or not np.array_equal(np.unique(self.codes),np.arange(37))):
            raise ValueError('神经运动标定损坏')

    def decode(self,counts):
        counts=np.asarray(counts);x=counts[self.ids]/self.scale
        if not np.isfinite(x).all():raise ValueError('神经运动输入无效')
        if not np.any(x):return self.command(0,0.,'output_disconnected',0)
        distances=np.linalg.norm(self.templates-x,axis=1)
        best=int(np.argmin(distances));code=int(self.codes[best]);distance=float(distances[best]/max(1,np.linalg.norm(self.templates[best])))
        confidence=max(0,1-distance)
        # Unfamiliar activity cannot silently fall back to a geometric controller.
        if distance>.25:return self.command(0,confidence,'unrecognized_activity',int(np.count_nonzero(x)))
        return self.command(code,confidence,'neural_readout',int(np.count_nonzero(x)))

    @staticmethod
    def command(code,confidence,reason,active):
        yaw,elevation=angles(code) if code else (0.,0.)
        return {'controller':VERSION,'sector':code,'turn':math.atan2(math.sin(yaw),math.cos(yaw)),
                'elevation':elevation,'drive':float(bool(code)),'confidence':confidence,'reason':reason,
                'active_readout_neurons':active,'sampling':False}

    def describe(self):
        calibration_hash=hashlib.sha256(self.templates.tobytes()+self.scale.tobytes()+self.codes.tobytes()).hexdigest()
        return {**self.identity,'calibration_sha256':calibration_hash,'readout_neurons':len(self.ids),'population':'L1/L2/L3/L5',
                'interface':'视觉神经反射验证；工程感觉接口与运动读出，尚非下行运动回路重建',
                'policy':'deterministic_neural_template','random_action_sampling':False}
