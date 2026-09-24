"""Authoritative, replayable home simulation. Coordinates use Three.js Y-up."""
import copy
import math

FOOD_REGROW_SECONDS = 60.  # simulated ecology, independent of neural decisions

DEFAULT_HOME = {
    'name': '晨光温室', 'bounds': [-3.4, 3.4, -2.4, 2.4], 'floor_height': .23,
    'obstacles': [
        {'x': 0, 'z': -.8, 'width': 3.1, 'depth': 1.22, 'height': 1.15},
        {'x': 0, 'z': -1.2, 'width': 1.76, 'depth': .18, 'height': 2.25},
        {'x': 1.1, 'z': -1.05, 'width': .45, 'depth': .4, 'height': 2.3},
        {'x': -2.3, 'z': .7, 'width': 1.18, 'depth': .92, 'height': .75},
        {'x': -2.3, 'z': .3, 'width': 1.18, 'depth': .2, 'height': 1.43},
        {'x': -2.85, 'z': .72, 'width': .18, 'depth': .9, 'height': 1.11},
        {'x': -1.75, 'z': .72, 'width': .18, 'depth': .9, 'height': 1.11},
        {'x': -1.25, 'z': 1.1, 'width': .8, 'depth': .8, 'height': .94},
        {'x': 2.85, 'z': -1.62, 'width': .8, 'depth': .8, 'height': 1.98},
        {'x': -3.12, 'z': -1.64, 'width': .75, 'depth': .75, 'height': 1.86},
        {'x': 3.08, 'z': 1.82, 'width': .55, 'depth': .55, 'height': 1.36},
    ],
    'objects': [
        {'id': 'market', 'kind': 'observe', 'name': '行情工作台', 'position': [0, 1.35, -.35]},
        {'id': 'fruit', 'kind': 'eat', 'name': '果盘', 'position': [-1.25, 1.12, 1.1]},
        {'id': 'nest', 'kind': 'rest', 'name': '沙发休息处', 'position': [-2.3, .93, .8]},
        {'id': 'plant', 'kind': 'interact', 'name': '露水花园', 'position': [2.28, 1, -1.6]},
    ],
}


class World:
    def __init__(self, state=None, home=None):
        self.home = copy.deepcopy(home or DEFAULT_HOME)
        self.state = {'position': [0, self.home.get('floor_height',0)+.2, 1.7], 'goal': 'rest', 'action': 'idle', 'energy': .8,
                      'hunger': .2, 'curiosity': .6, 'stress': .1, 'decision_id': '', 'path': [], 'elapsed': 0,
                      'visited': [], 'event': 'daylight', 'target': None, 'yaw':0.,'food_stock':{},
                      'motor_remaining':0.,'effect':None,'effect_remaining':0.,'food_regrowth':{}}
        if state:
            self.state.update({k:v for k,v in state.items() if k != 'rng'})
        for obj in self.home['objects']:
            if obj['kind']=='eat' and self.state['food_stock'].get(obj['id'],1)<=0:
                self.state['food_regrowth'].setdefault(obj['id'],FOOD_REGROW_SECONDS)

    def snapshot(self):
        return {**copy.deepcopy(self.state), 'rng':None}  # legacy checkpoint field

    def waiting_status(self):
        s=self.state
        if s.get('controller')!='retinal-motor-1':return None
        if s.get('life_controller'):
            if s.get('life_episode') and s['goal'] in ('eat','rest','explore'):return None
            return {'code':'awaiting_neural_step','message':'等待下一轮生活神经感知；当前没有有效行动指令'}
        food=[o for o in self.home['objects'] if o['kind']=='eat']
        if not food:return {'code':'no_food_objects','message':'家园没有可取食物件，请添加果盘'}
        if all(s['food_stock'].get(o['id'],1)<=0 for o in food):
            remaining=min(s['food_regrowth'].get(o['id'],FOOD_REGROW_SECONDS) for o in food)
            return {'code':'food_depleted','message':'果盘已吃空，等待果实重新成熟','recovery_seconds':math.ceil(remaining)}
        motor=s.get('motor',{})
        if not motor:return {'code':'awaiting_neural_step','message':'食物已就绪，等待下一次神经感知'}
        if motor.get('drive'):
            return None if s['motor_remaining']>0 else {'code':'awaiting_neural_step','message':'等待下一次神经运动指令'}
        reason=motor.get('reason')
        message=('有食物，但神经响应未匹配运动标定' if reason=='unrecognized_activity' else
                 '有食物，但运动读出没有放电' if reason=='output_disconnected' else '食物已就绪，神经输出暂未形成方向指令')
        return {'code':reason or 'no_directional_readout','message':message}

    def tick_ecology(self,dt):
        s=self.state;recovered=[]
        for obj in self.home['objects']:
            if obj['kind']!='eat' or s['food_stock'].get(obj['id'],1)>0:continue
            remaining=max(0,s['food_regrowth'].get(obj['id'],FOOD_REGROW_SECONDS)-dt)
            s['food_regrowth'][obj['id']]=remaining
            if remaining==0:
                s['food_stock'][obj['id']]=1;s['food_regrowth'].pop(obj['id'],None)
                recovered.append({'id':obj['id'],'name':obj['name']})
        if recovered:return {'kind':'environment_recovery','source':'world','objects':recovered,
                             'mechanism':'timed_food_regrowth','growth_seconds':FOOD_REGROW_SECONDS}

    def clear(self, point):
        x,y,z = point
        b = self.home['bounds']
        if not (b[0]+.12 <= x <= b[1]-.12 and b[2]+.12 <= z <= b[3]-.12 and self.home.get('floor_height',0)+.15 <= y <= 3): return False
        return not any(abs(x-o['x']) < o['width']/2+.12 and abs(z-o['z']) < o['depth']/2+.12
                       and y < o['height']+.15 for o in self.home['obstacles'])

    def path(self, start, end):
        # Fly above obstacles, then land on validated affordances. Each segment
        # is sampled, so the body cannot tunnel through geometry.
        altitude = max(1.8, start[1], end[1], *[o['height']+.3 for o in self.home['obstacles']])
        if altitude > 3: return []
        points = [[start[0],altitude,start[2]], [end[0],altitude,end[2]], end]
        previous = start
        for point in points:
            distance = math.dist(previous,point)
            for step in range(1,max(2,math.ceil(distance/.08))+1):
                t = min(1,step/max(2,math.ceil(distance/.08)))
                if not self.clear([a+(b-a)*t for a,b in zip(previous,point)]): return []
            previous = point
        return points

    def select(self, goal, decision_id, target_id=None):
        """Legacy replay helper; the live neural controller never calls this."""
        objects = [o for o in self.home['objects'] if o['kind']==goal]
        if target_id: objects = [o for o in objects if o['id']==target_id]
        if goal == 'explore':
            b=self.home['bounds'];points=[[x,2.7,z] for x in (b[0]+.4,b[1]-.4) for z in (b[2]+.4,b[3]-.4)]
            points=[p for p in points if self.path(self.state['position'],p)]
            if not points:return False
            target={'id':'explore','position':max(points,key=lambda p:math.dist(p,self.state['position']))}
        elif objects: target=min(objects,key=lambda o:(math.dist(o['position'],self.state['position']),o['id']))
        else: return False
        path = self.path(self.state['position'], target['position'])
        if not path: return False
        self.state.update(goal=goal,decision_id=decision_id,target=target['id'],path=path,action='flying',elapsed=0)
        return True

    def enable_neural_control(self):
        self.state.update(controller='retinal-motor-1',path=[],decision_id='',motor_remaining=0.,action='idle',target=None,elapsed=0)
        self.state.pop('life_episode',None)

    def apply_life(self,message):
        from .life_body import begin
        return begin(self,message)

    def finish_life(self,reason):
        from .life_body import finish
        return finish(self,reason)

    def apply_motor(self,command,decision_id):
        values=[command.get(k) for k in ('turn','elevation','drive','confidence')]
        if command.get('controller')!='retinal-motor-1' or any(not isinstance(v,(int,float)) or not math.isfinite(v) for v in values):
            raise ValueError('神经运动指令无效')
        if not (-math.pi<=values[0]<=math.pi and -.7<=values[1]<=.7 and 0<=values[2]<=1 and 0<=values[3]<=1):
            raise ValueError('神经运动指令越界')
        s=self.state
        s.update(controller='retinal-motor-1',motor=dict(command),motor_remaining=1.,decision_id=decision_id,
                 desired_yaw=s['yaw']+command['turn'],path=[],goal='forage' if command['drive'] else 'rest',target=None)

    def apply_environment(self,event,source,decision_id,now):
        if event not in ('daylight','breeze','quiet','dew','replenish'):raise ValueError('未允许的环境事件')
        s=self.state;before=s['event']
        if event=='replenish':
            changed=any(s['food_stock'].get(o['id'],1)<=0 for o in self.home['objects'] if o['kind']=='eat')
            if changed:s['food_stock']={};s['food_regrowth']={}
        else:
            changed=before!=event
            if changed:s['event']=event
        effect={'event':event,'before':before,'after':s['event'],'status':'applied' if changed else 'no_change',
                'source':source,'decision_id':decision_id,'at':now,'duration_seconds':30 if changed else 0}
        if changed:s.update(effect=effect,effect_remaining=30.)
        return effect

    def tick_motor(self,dt):
        s=self.state
        if s['motor_remaining']<=0 or not s.get('motor',{}).get('drive'):
            s.update(action='idle',target=None);return None
        s['motor_remaining']=max(0,s['motor_remaining']-dt)
        command=s['motor'];angle=math.atan2(math.sin(s['desired_yaw']-s['yaw']),math.cos(s['desired_yaw']-s['yaw']))
        s['yaw']+=max(-1.8*dt,min(1.8*dt,angle))
        s['action']='turning' if abs(angle)>.25 else 'flying'
        move=.42*dt if abs(angle)<.4 else 0.
        dy=command['elevation']*.6*dt
        feeding_allowed=not s.get('life_controller') or s['goal']=='eat'
        if feeding_allowed and any(o['kind']=='eat' and s['food_stock'].get(o['id'],1)>0 and math.dist(o['position'],s['position'])<.3 for o in self.home['objects']):
            move=0.;dy=0.  # physical contact stabilizes feeding, only while neural drive remains active
        start=s['position'];candidate=[start[0]+math.sin(s['yaw'])*move,max(self.home.get('floor_height',0)+.16,min(2.9,start[1]+dy)),start[2]-math.cos(s['yaw'])*move]
        if self.clear(candidate):s['position']=candidate;s['motor_blocked']=False
        else:
            # Local flight stabilizer: no target coordinates and no autonomous
            # horizontal route. Only an active neural command permits ascent.
            raised=[start[0],min(2.9,start[1]+.45*dt),start[2]]
            if not s.get('life_controller') and self.clear(raised):s['position']=raised
            elif s.get('life_controller'):
                # Preserve only safe components already commanded. In particular,
                # a blocked descent must not also block forward motion over a
                # ledge. No ascent or horizontal steering is invented here.
                vertical=[start[0],candidate[1],start[2]]
                horizontal=[candidate[0],start[1],candidate[2]]
                if move and self.clear(horizontal):s['position']=horizontal
                elif dy and self.clear(vertical):s['position']=vertical
            s['motor_blocked']=True;s['action']='avoiding'
        contact=next((o for o in self.home['objects'] if feeding_allowed and o['kind']=='eat' and s['food_stock'].get(o['id'],1)>0 and math.dist(o['position'],s['position'])<.3),None)
        if not contact:s['elapsed']=0.;return None
        s['action']='eating';s['target']=contact['id'];s['elapsed']+=dt
        if s['elapsed']<.8:return None
        s['food_stock'][contact['id']]=0;s['food_regrowth'][contact['id']]=FOOD_REGROW_SECONDS
        s['hunger']=max(0,s['hunger']-.35);s['energy']=min(1,s['energy']+.12);s['elapsed']=0.
        return {'decision_id':s['decision_id'],'reward':.1,'outcome':'neural_contact_feeding','target':contact['id'],
                'evidence':{'contact_distance':math.dist(contact['position'],s['position']),'neural_sector':command['sector'],'neural_drive':command['drive']}}

    def tick(self, dt):
        dt = max(0,min(.25,dt));s=self.state
        s['hunger']=min(1,s['hunger']+dt*.0007)
        s['energy']=max(0,s['energy']-dt*.0005)
        s['curiosity']=min(1,s['curiosity']+dt*.0005)
        s['effect_remaining']=max(0,s.get('effect_remaining',0)-dt)
        if s.get('controller')=='retinal-motor-1':
            recovered=self.tick_ecology(dt)
            if s.get('life_controller'):
                from .life_body import tick
                # Ecology and body both advance; queue the ecology receipt when
                # a decision outcome completes on the same tick.
                result=tick(self,dt)
                if recovered:s.setdefault('environment_receipts',[]).append(recovered)
                return result or (s.get('environment_receipts') or [None]).pop(0)
            return recovered or self.tick_motor(dt)
        if not s['decision_id']: return None
        if s['path']:
            point=s['path'][0];distance=math.dist(s['position'],point)
            if distance < .04: s['position']=point;s['path'].pop(0)
            else:
                step=min(1,dt*.85/distance)
                candidate=[a+(b-a)*step for a,b in zip(s['position'],point)]
                if not self.clear(candidate):
                    result={'decision_id':s['decision_id'],'reward':-.2,'outcome':'路径受阻'}
                    s.update(path=[],action='idle',decision_id='');return result
                s['position']=candidate
            return None
        s['action'] = {'eat':'eating','rest':'resting','observe':'watching','interact':'touching','explore':'exploring'}[s['goal']]
        s['elapsed']+=dt
        if s['elapsed'] < 4: return None
        reward=.04
        if s['goal']=='eat': reward=s['hunger']*.5;s['hunger']=max(0,s['hunger']-.35)
        elif s['goal']=='rest': reward=(1-s['energy'])*.5;s['energy']=min(1,s['energy']+.3);s['stress']*=.8
        elif s['goal'] in ('explore','interact'): reward=s['curiosity']*.25;s['curiosity']*=.7
        if s['target'] not in s['visited']: s['visited']=(s['visited']+[s['target']])[-64:];reward+=.05
        result={'decision_id':s['decision_id'],'reward':reward,'outcome':s['action'],'target':s['target']}
        s.update(decision_id='',action='idle')
        return result
