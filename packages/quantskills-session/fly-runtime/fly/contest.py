"""Automatic contest orders through the host CLI and causal receipt feedback."""
import time
from datetime import datetime
from . import bridge
from .history import bars_key, readiness, missing_minutes, timestamp, TZ
from .trade_filters import opening_filter
from .settlement import Settlement
from .llm_trading import MAX_AGE, engine_config
from .position_sync import reconcile_positions
from .trade_receipts import commission, receipt_index, matched_receipt

def receipt_message(status, result=None):
    if status=='failed' and isinstance(result,dict):
        failure=result.get('result',result)
        if isinstance(failure,dict):
            detail=failure.get('message')
            if isinstance(detail,str) and detail.strip():return '委托提交失败 · '+detail.strip()[:400]
    return {'prepared': '等待逐笔确认', 'executing': '正在提交委托', 'queued': '委托已排队，等待柜台回执',
            'submitted': '委托已提交，等待成交', 'completed': '委托已处理，成交以柜台回执为准',
            'partial': '部分成交，继续核对回执', 'unknown': '提交结果待核对，系统不会重复下单',
            'failed': '委托提交失败', 'expired': '委托已过期', 'cancelled': '委托未提交，已取消'}.get(status, '委托状态待核对')


def sync(organism):
    binding = organism.store.get('binding')
    payload = {'identity': binding.get('identity') if binding else None,
               'instruments': [i.model_dump() for i in organism.settings.instruments]}
    result = bridge.call('market', payload)
    identity = result['identity']
    if binding and binding['identity'] != identity:
        organism.control['trading'] = False
        organism.store.put('control', organism.control)
        raise ValueError('比赛账户已变化；原个体保持旧账户归属，请切回原账户')
    organism.manager.accounts = [{'name': identity['accountId']}]
    if not binding:
        binding = {'identity': identity, 'account_id': identity['accountId'],
                   'account': identity['accountId'], 'instruments': payload['instruments']}
        organism.store.put('binding', binding)
    organism.account_cache = result['account']
    organism.store.put('connect_requested', False)
    organism.connection = {'status': 'ready', 'message': '比赛账户已连接 · ' + ('CLI 自动下单' if organism.settings.execution_mode == 'automatic' else '逐笔确认后下单')}
    plans = result['plans']
    mapping = organism.store.get('contest_plans', {})
    owned_orders = {}
    receipts = receipt_index(result['account'].get('trades', []))
    for plan in plans:
        decision_id = mapping.get(plan['id'])
        if not decision_id and plan.get('sessionId', '').startswith('fly:'):
            decision_id = plan['sessionId'][4:]
            if organism.store.decision(decision_id):
                mapping[plan['id']] = decision_id
                organism.store.put('contest_plans', mapping)
        if not decision_id: continue
        parameters = plan['details']['parameters']
        decision = organism.store.decision(decision_id)
        if not decision: continue
        product = decision['product']
        organism.store.put('execution_status:' + product, {'status': plan['status'],
            'message': receipt_message(plan['status'],plan.get('result')) + ' · ' + plan['summary'], 'plan_id': plan['id'], 'decision_id': decision_id, 'at': time.time()})
        for fill in plan.get('fills', []):
            owned_orders[fill['orderId']] = 'fly-contest'
            at = timestamp(fill['time'])
            symbol = decision.get('symbol') or parameters['contractCode'].split('.')[0]
            matching = matched_receipt(receipts, {**fill, 'symbol': symbol})
            billed = {'commission': commission(matching), 'trade_time': matching.get('trade_time') or matching.get('tradeTime') or fill['time']}
            day = matching.get('trading_day') or datetime.fromtimestamp(at, TZ).strftime('%Y%m%d')
            organism.store.event('trade', {'product': product, 'symbol': symbol,
                'trade_id': fill['tradeId'], 'trading_day': day, 'order_id': fill['orderId'],
                'price': fill['price'], 'volume': fill['volume'], 'direction': '0' if parameters['side'] == 'buy' else '1',
                'offset': '0' if parameters['offset'] == 'open' else '1', 'runtime_id': 'fly-contest',
                'at': at, 'multiplier': result['feeds'].get(product, {}).get('multiplier', 0), **billed},
                actor='counter', decision_id=decision_id, dedupe='contest-fill:' + fill['id'], at=at)
            organism.store.enrich_trade_receipt('contest-fill:' + fill['id'], billed)
            if parameters['offset'] != 'open':
                organism.store.put('last_close:' + product, max(at, organism.store.get('last_close:' + product, 0)))
    reconcile_positions(organism, result)
    organism.store.put_many({'feed:' + product: feed for product, feed in result['feeds'].items()})
    snapshot = result['account']
    for trade in snapshot.get('trades', []):
        trade['runtime_id'] = owned_orders.get(trade.get('order_id'), '')
    Settlement(organism.store).observe(snapshot, {'fly-contest'})
    if organism.neural.get('status') == 'ready':
        for reward in organism.store.get('trade_reward_outbox', []):
            if (organism.store.decision(reward['decision_id']) or {}).get('engine') == 'llm': continue
            if reward['decision_id'] not in organism.sent_rewards:
                organism.reward('trade', reward['decision_id'], reward['reward'], reward['evidence'])
                organism.sent_rewards.add(reward['decision_id'])
    from .analytics import record_account_sample
    record_account_sample(organism.store, snapshot, identity['accountId'])
    if organism.control.get('trading'):
        propose(organism, identity)


def propose(organism, identity):
    for instrument in organism.settings.instruments:
        if not organism.control.get('trading') or organism.control.get('paused') or organism.control.get('execution') != organism.settings.execution_mode: break
        product = instrument.product
        decision = organism.store.get('signal:' + product)
        if not decision or decision['decision_id'] == organism.store.get('consumed:' + product): continue
        # A slow model may finish between quote polls. Keep its still-valid
        # decision pending until fresh quotes arrive, without sending an order.
        quote_at=organism.store.get('feed:'+product,{}).get('quote_at',0)
        max_age=MAX_AGE if decision.get('engine')=='llm' else 15
        if decision.get('choice',{}).get('action')!='WAIT' and 0<=time.time()-decision.get('input_at',0)<=max_age and not 0<=time.time()-quote_at<=10:continue
        organism.store.put('consumed:' + product, decision['decision_id'])
        if decision.get('engine', 'neural') != organism.settings.decision_engine: continue
        if decision.get('engine') == 'llm' and decision.get('engine_config') != engine_config(organism.settings): continue
        action = decision['choice']['action']
        if action == 'WAIT': continue
        choice = decision['choice']
        current, target = choice.get('current_position',0), choice.get('target_position',0)
        reducing = bool(current and (current*target<=0 or abs(target)<abs(current)))
        try:
            if organism.control.get('close_only') and not reducing:
                raise ValueError('当前仅允许自动平仓')
            if not 0 <= time.time() - decision['input_at'] <= (MAX_AGE if decision.get('engine') == 'llm' else 15):
                raise ValueError('交易信号已过期，等待新决策')
            if decision.get('symbol', '').lower() != instrument.symbol.lower():
                raise ValueError('决策合约与当前设置不一致')
            feed = organism.store.get('feed:' + product, {})
            bars = organism.store.get(bars_key(product, organism.settings.trade_period_minutes), [])
            if readiness(bars, feed.get('quote_at', 0), minutes=organism.settings.trade_period_minutes) != 'ready' or missing_minutes(bars, product, organism.settings.trade_period_minutes):
                raise ValueError('历史窗口不完整或行情过期')
            if feed.get('inflight'): raise ValueError((feed.get('position_sync') or {}).get('message') or '账户已有待处理计划或委托')
            if not reducing and organism.settings.cost_filter_multiplier:
                raise ValueError('比赛接口缺少完整手续费参数，请关闭成本过滤或补齐数据')
            filter_decision = {**decision,'choice':{**choice,'action':'CLOSE'}} if reducing else decision
            filtered, trace = opening_filter(organism.store.get('trade_filter:' + product, {}), filter_decision,
                organism.settings.model_dump(), product, time.time(), organism.store.get('last_close:' + product, 0), None)
            organism.store.put_many({'trade_filter:' + product: filtered, 'trade_filter_status:' + product: trace})
            if not trace['allowed']: raise ValueError(trace['reason'])
            result = bridge.call('trade', {'identity': identity, 'decision': decision, 'run_id': organism.control.get('run_id'),
                'execution_mode': organism.settings.execution_mode, 'instrument': instrument.model_dump(), 'limits': {'target': organism.settings.target_notional,
                'total': organism.settings.total_notional, 'loss': organism.settings.loss_limit}})
            mapping = organism.store.get('contest_plans', {})
            mapping[result['id']] = decision['decision_id']
            organism.store.put('contest_plans', mapping)
            status = result['status']
            if status not in ('failed','cancelled','expired'):
                # Prevent a second decision from using the pre-order position
                # before the next official account/receipt synchronization.
                organism.store.put('feed:' + product, {**feed, 'inflight': True})
            message = receipt_message(status,result.get('result'))
            organism.store.put('execution_status:' + product, {'status': status, 'message': message,
                'plan_id': result['id'], 'decision_id': decision['decision_id'], 'at': time.time()})
            organism.store.event('execution_gate', {'product': product, 'message': message, 'status': status,
                'plan_id': result['id']}, actor='execution', decision_id=decision['decision_id'])
        except ValueError as exc:
            organism.store.put('execution_status:' + product, {'status': 'blocked', 'message': str(exc),
                'decision_id': decision['decision_id'], 'at': time.time()})
            organism.store.event('execution_gate', {'product': product, 'message': str(exc)},
                actor='execution', decision_id=decision['decision_id'])
