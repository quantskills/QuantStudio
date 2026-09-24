"""Read-only, owner-scoped learning evidence from durable events and checkpoints.

Historical comparisons are only published when replaying the recorded feedback
with the production readout reproduces the saved weights and update count.
Nothing here calls the brain, submits an order, or changes the running policy.
"""
import copy
from datetime import datetime
import hashlib
import json
import numpy as np
from .neural_trade import TradeReadout, SENSES, VERSION


def checkpoint_policy(root):
    try:
        version=json.loads((root/'checkpoints/latest.json').read_text('utf-8'))['version']
        if not isinstance(version,str) or not version.isalnum():return None,None
        state=json.loads((root/'checkpoints'/version/'policy.json').read_text('utf-8'))['trade_readout']
        model=TradeReadout();model.restore(state)
        return version,state
    except (OSError,ValueError,KeyError,TypeError):return None,None


def learning_report(store, day, worker_updates=None):
    with store.connect() as db:
        events=[{**dict(r),'payload':json.loads(r['payload'])} for r in db.execute(
            "SELECT * FROM events WHERE kind='trade' OR (kind='learning_update' AND json_extract(payload,'$.scope')='trade_readout_only') OR kind='checkpoint_resumed' ORDER BY seq")]
        saved=db.execute("SELECT value FROM state WHERE key='trade_reward_outbox'").fetchone()
        outbox=json.loads(saved[0]) if saved else []
        ids={e['decision_id'] for e in events if e['kind']=='learning_update'} | {r['decision_id'] for r in outbox}
        decisions={}
        for key in ids:
            row=db.execute("SELECT payload FROM events WHERE kind='decision' AND decision_id=? ORDER BY seq DESC LIMIT 1",(key,)).fetchone()
            if row:decisions[key]=json.loads(row[0])
    version,saved_policy=checkpoint_policy(store.root)
    applied=[e for e in events if e['kind']=='learning_update' and e['payload'].get('applied')]
    fills=[e for e in events if e['kind']=='trade']
    by_decision={}
    for e in fills:by_decision.setdefault(e['decision_id'],[]).append(e)
    replay=TradeReadout();steps={};complete=True
    for e in applied:
        key=e['decision_id'];d=decisions.get(key,{})
        try:
            if key in steps or d['choice']['readout'] not in (VERSION,'neural-trade-2'):raise ValueError('incomplete history')
            x=[float(d['trade_response'][sense]['value']) for sense in SENSES]
            if not all(np.isfinite(x)) or any(v<0 or v>1 for v in x):raise ValueError('invalid features')
            before=copy.deepcopy(replay.state())
            replay.pending[key]={'x':x,'index':replay.actions.index(d['choice']['action']),'expected':0.}
            if not replay.feedback(key,e['payload']['reward']):raise ValueError('duplicate update')
            steps[key]={'before':before,'after':copy.deepcopy(replay.state()),'at':e['at'],'seq':e['seq']}
        except (KeyError,TypeError,ValueError):complete=False;break
    verified=bool(complete and saved_policy and saved_policy['updates']==replay.updates
                  and set(steps)<=set(saved_policy['applied'])
                  and np.allclose(replay.weights,np.asarray(saved_policy['weights']),rtol=0,atol=1e-12))
    # A worker ahead of the last checkpoint is shown as awaiting persistence.
    saved_current=bool(verified and (worker_updates is None or worker_updates==saved_policy['updates']))
    groups={}
    for item in outbox:
        evidence=item['evidence']
        identity=json.dumps([evidence['from'],evidence['to'],sorted(evidence['decision_ids'])])
        group=groups.setdefault(identity,{'evidence':evidence,'rewards':{}})
        group['rewards'][item['decision_id']]=item['reward']
    cycles=[];days=set()
    for identity,group in groups.items():
        evidence=group['evidence'];keys=set(evidence['decision_ids'])
        owned=[e for e in fills if e['decision_id'] in keys]
        trading_days={str(e['payload'].get('trading_day','')) for e in owned}-{''}
        cycle_day=max(trading_days) if trading_days else datetime.fromtimestamp(evidence['to']).strftime('%Y%m%d')
        days.add(cycle_day)
        if cycle_day!=day:continue
        learned=[e for e in applied if e['decision_id'] in keys]
        unique_learned={e['decision_id'] for e in learned}
        first_applied={e['decision_id']:e['seq'] for e in learned}
        ignored=[e for e in events if e['kind']=='learning_update' and not e['payload'].get('applied')
                 and e['decision_id'] in first_applied and e['seq']>first_applied[e['decision_id']]]
        resumed=any(e['kind']=='checkpoint_resumed' and learned and e['at']>max(l['at'] for l in learned) for e in events)
        linked=bool(owned and {e['payload']['trade_id'].strip() for e in owned}=={str(k).strip() for k in evidence['trade_ids']}
                    and keys=={e['decision_id'] for e in owned}
                    and all(decisions.get(k,{}).get('choice',{}).get('sampling') is False for k in keys))
        cycle_steps=[steps[k] for k in keys if k in steps]
        can_compare=verified and len(cycle_steps)==len(keys) and all(decisions.get(k,{}).get('choice',{}).get('readout')==VERSION for k in keys)
        before=min(cycle_steps,key=lambda s:s['seq'])['before'] if can_compare else None
        after=max(cycle_steps,key=lambda s:s['seq'])['after'] if can_compare else None
        comparisons=[];weights=[];delta=None
        if can_compare:
            left=TradeReadout();left.restore(before)
            right=TradeReadout();right.restore(after)
            delta=float(np.linalg.norm(right.weights-left.weights))
            weights=[{'action':action,'before':left.weights[i].tolist(),'after':right.weights[i].tolist(),
                      'delta':(right.weights[i]-left.weights[i]).tolist()} for i,action in enumerate(left.actions)]
        for key in sorted(keys,key=lambda k:steps.get(k,{}).get('seq',0)):
            d=decisions.get(key,{});receipts=by_decision.get(key,[])
            row={'decision_id':key,'symbol':d.get('symbol',''),'action':d.get('choice',{}).get('action',''),
                 'reward':group['rewards'].get(key),'learned':key in unique_learned,
                 'learned_at':steps.get(key,{}).get('at'),'trade_ids':[e['payload']['trade_id'].strip() for e in receipts],
                 'before_score':None,'after_score':None,'before_choice':None,'after_choice':None}
            if can_compare and receipts:
                fill=receipts[0]['payload'];held=0 if fill['offset']=='0' else 1 if fill['direction']=='1' else -1
                values={sense:d['trade_response'][sense]['value'] for sense in SENSES}
                a=left.choose(values,key,held=held,sizing=d['choice'].get('sizing'));b=right.choose(values,key,held=held,sizing=d['choice'].get('sizing'))
                row.update(before_score=a['scores'][row['action']],after_score=b['scores'][row['action']],
                           before_choice=a['action'],after_choice=b['action'])
            comparisons.append(row)
        cycles.append({'id':hashlib.sha256(identity.encode()).hexdigest()[:16],'day':cycle_day,
                       'settled_at':evidence['to'],'net_pnl':evidence['pnl_after_fees'],
                       'commission':evidence['actual_account_commission'],'fill_count':len(owned),'decision_count':len(keys),
                       'learned_count':len(unique_learned),'ignored_replays':len(ignored),
                       'credit':evidence['credit'],'rewards':comparisons,'weights':weights,'weight_delta_l2':delta,
                       'changed_choices':sum(r['before_choice']!=r['after_choice'] for r in comparisons) if can_compare else None,
                       'checks':{'fills_linked':linked,'feedback_applied':bool(keys and keys==unique_learned),
                                 'checkpoint_matches':saved_current and can_compare,
                                 'restart_deduplicated':bool(resumed and {e['decision_id'] for e in ignored}>=keys and saved_current)}})
    return {'day':day,'days':sorted(days|{day},reverse=True),'cycles':sorted(cycles,key=lambda c:c['settled_at'],reverse=True),
            'checkpoint':{'version':version,'updates':saved_policy['updates'] if saved_policy else None,
                          'replay_matches':verified,'current':saved_current},
            'worker_updates':worker_updates,'scope':'trade_readout_only','connectome_frozen':True,
            'note':'同一周期的净收益共同反馈给实际成交决策；盈利周期内亏损交易也会收到共同的正反馈。评分对照复用历史神经输入，不会下单，也不表示胜率已经提升。'}
