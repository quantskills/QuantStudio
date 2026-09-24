"""Physical outcomes for neural life decisions; no target selection or RNG here."""
import copy
import math

EPISODE_SECONDS=2.5


def begin(world, message):
    s=world.state;goal=message['choice']['action']
    if goal not in ('eat','rest','explore','idle'):raise ValueError('未知生活目标')
    previous=finish(world,'superseded')
    world.apply_motor(message['motor'],message['decision_id'])
    s.update(life_controller='life-readout-1',goal=goal,motor_remaining=EPISODE_SECONDS,elapsed=0.)
    food=[o for o in world.home['objects'] if o['kind']=='eat' and s['food_stock'].get(o['id'],1)>0]
    target=min(food,key=lambda o:math.dist(s['position'],o['position'])) if food else None
    s['life_episode']={'decision_id':message['decision_id'],'goal':goal,'remaining':EPISODE_SECONDS,
        'before':{k:copy.deepcopy(s[k]) for k in ('position','hunger','energy','curiosity')},
        'food_position':target['position'][:] if target else None,'meals':[],'blocked_seconds':0.,'distance':0.,'active_seconds':0.,
        'landmark':message.get('navigation',{}).get('landmark'),'landmark_position':message.get('navigation',{}).get('position')}
    s['life_trace']={'decision_id':message['decision_id'],'perception':message['sensory'],
        'response':message['life_response'],'choice':message['choice'],'motor':message['motor'],
        'navigation':message.get('navigation',{}),'feedback':None}
    return previous


def finish(world, reason='completed'):
    s=world.state;episode=s.pop('life_episode',None)
    if not episode:return None
    before=episode['before'];goal=episode['goal']
    after={k:copy.deepcopy(s[k]) for k in before}
    reward=0.
    if goal=='eat':
        reward=2*max(0,before['hunger']-s['hunger'])
        if episode['food_position']:
            reward+=.1*(math.dist(before['position'],episode['food_position'])-math.dist(s['position'],episode['food_position']))
    elif goal=='rest':reward=4*max(0,s['energy']-before['energy'])
    elif goal=='explore':reward=2*max(0,before['curiosity']-s['curiosity'])+.02*episode['distance']
    reward-=.02*episode['blocked_seconds']
    feedback={'decision_id':episode['decision_id'],'reward':reward,'outcome':'life_episode','goal':goal,
              'reason':reason,'before':before,'after':after,'active_seconds':episode['active_seconds'],
              'distance':episode['distance'],'meals':episode['meals'],'blocked_seconds':episode['blocked_seconds'],
              'reward_scope':'工程生活反馈：已发生的取食、恢复、移动和碰撞；无未来数据'}
    if s.get('life_trace',{}).get('decision_id')==episode['decision_id']:s['life_trace']['feedback']=feedback
    s['last_life_feedback']=feedback
    return feedback


def tick(world, dt):
    s=world.state;episode=s.get('life_episode')
    if not episode:s.update(action='idle',motor_remaining=0.);return None
    active_dt=min(dt,episode['remaining']);episode['remaining']=max(0,episode['remaining']-dt)
    episode['active_seconds']+=active_dt;goal=episode['goal'];start=s['position'][:]
    if goal=='rest':
        # Rest is an accepted neural goal. A missing/expired command never
        # receives this restoration, even when the body happens to be still.
        s.update(action='resting',target=None,motor_remaining=0.)
        s['energy']=min(1,s['energy']+.012*active_dt);s['stress']=max(0,s['stress']-.001*active_dt)
    elif goal in ('eat','explore'):
        event=world.tick_motor(active_dt)
        if event and event.get('outcome')=='neural_contact_feeding':episode['meals'].append(event)
        distance=math.dist(start,s['position']);episode['distance']+=distance
        if s.get('motor_blocked'):episode['blocked_seconds']+=active_dt
        s['energy']=max(0,s['energy']-.002*active_dt)
        if goal=='explore' and distance>0:
            s['curiosity']=max(0,s['curiosity']-.025*distance)
            if episode['landmark_position'] and math.dist(s['position'],episode['landmark_position'])<.4:
                visits=s.setdefault('explore_visits',{});key=episode['landmark']
                if not episode.get('landmark_reached'):visits[key]=visits.get(key,0)+1;episode['landmark_reached']=True
    else:s.update(action='idle',motor_remaining=0.)
    if episode['remaining']<=0:
        s.update(motor_remaining=0.)
        return finish(world)
    return None
