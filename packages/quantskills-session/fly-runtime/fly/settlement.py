"""Causal portfolio-cycle rewards from official contest account snapshots.

CTP trade callbacks do not normally contain per-fill fees. We therefore settle
only an exclusively owned, fully closed trading cycle using actual account
equity and commission, and disclose shared cycle credit instead of inventing
fees for individual fills. External trades or cash flows defer learning.
"""
import math
import time
from .history import timestamp


def value(record,lower,upper):return float(record.get(lower,record.get(upper,0)) or 0)


def trade_key(record):
    symbol=str(record.get('symbol','')).split('.')[0].lower()
    return '|'.join((str(record.get('trading_day','')),symbol,str(record.get('trade_id',''))))


def account_trade(record):
    return {**record,'symbol':record.get('instrument_id',record.get('symbol',''))}


def occupied(positions):
    return any(any(float(p.get(k,0) or 0) for k in ('long_today','long_yd','short_today','short_yd','Position','position','volume','long_position','short_position')) for p in positions)


class Settlement:
    def __init__(self,store):self.store=store

    def observe(self,snapshot,owned_runtime_ids):
        official=snapshot.get('official') or {}
        if not official or snapshot.get('official_sync',{}).get('stale',True):return []
        if not snapshot.get('reward_evidence_complete',False):
            self.store.event('learning_deferred',{'reason':'等待完整的柜台交易日、手续费、出入金及成交证据；缺失项不按零计算'},dedupe='missing-contest-reward-evidence')
            self.store.put('settlement_baseline',None)
            return []
        balance=value(official,'balance','Balance');commission=value(official,'commission','Commission')
        if not math.isfinite(balance) or balance<=0 or not math.isfinite(commission):return []
        at=snapshot.get('official_updated_at')
        try:at=timestamp(at)
        except (ValueError,TypeError):return []
        trades=[account_trade(t) for t in snapshot.get('trades',[])]
        ids={trade_key(t) for t in trades}
        baseline=self.store.get('settlement_baseline')
        state={'balance':balance,'commission':commission,'deposit':value(official,'deposit','Deposit'),
               'withdraw':value(official,'withdraw','Withdraw'),'ids':sorted(ids),'at':at,'day':official.get('TradingDay')}
        positions=snapshot.get('official_positions',[])
        if not baseline:
            if not occupied(positions):self.store.put('settlement_baseline',state)
            return []
        if at<=baseline['at']:return []
        if baseline.get('day')!=state['day']:
            if not occupied(positions):self.store.put('settlement_baseline',state)
            return []
        new=[t for t in trades if trade_key(t) not in baseline['ids']]
        if not new:
            if not occupied(positions):self.store.put('settlement_baseline',state)
            return []
        if occupied(positions):return []
        if any(str(t.get('runtime_id') or '') not in owned_runtime_ids for t in new) or state['deposit']!=baseline['deposit'] or state['withdraw']!=baseline['withdraw']:
            self.store.event('learning_deferred',{'reason':'账户存在其他交易归属或资金变动，不能将收益归给果蝇'})
            self.store.put('settlement_baseline',state);return []
        events=self.store.fills_since(baseline['at'])
        fills={trade_key(e['payload']):e for e in events if e['kind']=='trade' and e['at']>=baseline['at']}
        if any(trade_key(t) not in fills for t in new):return []
        linked=[fills[trade_key(t)] for t in new]
        if any(not e['decision_id'] for e in linked) or at<max(e['at'] for e in linked):return []
        decision_ids=sorted({e['decision_id'] for e in linked})
        pnl=balance-baseline['balance'];fees=commission-baseline['commission']
        if fees<0:
            self.store.event('learning_deferred',{'reason':'跨结算手续费重置，保留成交但不拼接奖励'})
            self.store.put('settlement_baseline',state);return []
        denominator=baseline['balance']
        reward=max(-1,min(1,pnl/denominator*100))/len(decision_ids)
        evidence={'outcome':'账户平仓周期已结算','pnl_after_fees':pnl,'actual_account_commission':fees,
                  'normalization_equity':denominator,'from':baseline['at'],'to':at,'trade_ids':[t['trade_id'] for t in new],
                  'decision_ids':decision_ids,'credit':'同一平仓周期各决策平分已实现净结果；不虚构每笔手续费'}
        rewards=[{'decision_id':key,'reward':reward,'evidence':evidence} for key in decision_ids]
        # Durable outbox is replayed after restart; neural checkpoints carry
        # applied IDs. Baseline and feedback must advance in one transaction.
        self.store.put_many({'settlement_baseline':state,'trade_reward_outbox':self.store.get('trade_reward_outbox',[])+rewards})
        return rewards
