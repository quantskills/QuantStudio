"""Human-confirmed contest proposals and causal receipt feedback."""
import time
from datetime import datetime
from . import bridge
from .history import bars_key, readiness, missing_minutes, timestamp, TZ
from .trade_filters import opening_filter
from .settlement import Settlement


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
    for product, feed in result['feeds'].items():
        organism.store.put('feed:' + product, feed)
    organism.store.put('connect_requested', False)
    organism.connection = {'status': 'ready', 'message': '比赛账户已连接 · 果蝇仅生成待确认交易计划'}
    plans = result['plans']
    mapping = organism.store.get('contest_plans', {})
    owned_orders = {}
    for plan in plans:
        decision_id = mapping.get(plan['id'])
        if not decision_id: continue
        parameters = plan['details']['parameters']
        decision = organism.store.decision(decision_id)
        if not decision: continue
        product = decision['product']
        organism.store.put('execution_status:' + product, {'status': plan['status'],
            'message': plan['summary'], 'plan_id': plan['id'], 'decision_id': decision_id, 'at': time.time()})
        for fill in plan.get('fills', []):
            owned_orders[fill['orderId']] = 'fly-contest'
            at = timestamp(fill['time'])
            symbol = decision.get('symbol') or parameters['contractCode'].split('.')[0]
            matching = next((t for t in result['account'].get('trades', []) if t.get('trade_id') == fill['tradeId'] and t.get('order_id') == fill['orderId']), {})
            day = matching.get('trading_day') or datetime.fromtimestamp(at, TZ).strftime('%Y%m%d')
            organism.store.event('trade', {'product': product, 'symbol': symbol,
                'trade_id': fill['tradeId'], 'trading_day': day, 'order_id': fill['orderId'],
                'price': fill['price'], 'volume': fill['volume'], 'direction': '0' if parameters['side'] == 'buy' else '1',
                'offset': '0' if parameters['offset'] == 'open' else '1', 'runtime_id': 'fly-contest',
                'at': at, 'multiplier': result['feeds'].get(product, {}).get('multiplier', 0)},
                actor='counter', decision_id=decision_id, dedupe='contest-fill:' + fill['id'], at=at)
            if parameters['offset'] != 'open':
                organism.store.put('last_close:' + product, max(at, organism.store.get('last_close:' + product, 0)))
    snapshot = result['account']
    for trade in snapshot.get('trades', []):
        trade['runtime_id'] = owned_orders.get(trade.get('order_id'), '')
    Settlement(organism.store).observe(snapshot, {'fly-contest'})
    if organism.neural.get('status') == 'ready':
        for reward in organism.store.get('trade_reward_outbox', []):
            if reward['decision_id'] not in organism.sent_rewards:
                organism.reward('trade', reward['decision_id'], reward['reward'], reward['evidence'])
                organism.sent_rewards.add(reward['decision_id'])
    from .analytics import record_account_sample
    record_account_sample(organism.store, snapshot, identity['accountId'])
    if organism.control.get('trading'):
        propose(organism, identity)


def propose(organism, identity):
    for instrument in organism.settings.instruments:
        product = instrument.product
        decision = organism.store.get('signal:' + product)
        if not decision or decision['decision_id'] == organism.store.get('consumed:' + product): continue
        organism.store.put('consumed:' + product, decision['decision_id'])
        action = decision['choice']['action']
        if action == 'WAIT': continue
        choice = decision['choice']
        current, target = choice.get('current_position',0), choice.get('target_position',0)
        reducing = bool(current and (current*target<=0 or abs(target)<abs(current)))
        try:
            if organism.control.get('close_only') and not reducing:
                raise ValueError('当前仅生成平仓计划')
            if not 0 <= time.time() - decision['input_at'] <= 15:
                raise ValueError('神经信号已过期，等待新决策')
            if decision.get('symbol', '').lower() != instrument.symbol.lower():
                raise ValueError('决策合约与当前设置不一致')
            feed = organism.store.get('feed:' + product, {})
            bars = organism.store.get(bars_key(product, organism.settings.trade_period_minutes), [])
            if readiness(bars, feed.get('quote_at', 0), minutes=organism.settings.trade_period_minutes) != 'ready' or missing_minutes(bars, product, organism.settings.trade_period_minutes):
                raise ValueError('历史窗口不完整或行情过期')
            if feed.get('inflight'): raise ValueError('账户已有待处理计划或委托')
            if not reducing and organism.settings.cost_filter_multiplier:
                raise ValueError('比赛接口缺少完整手续费参数，请关闭成本过滤或补齐数据')
            filter_decision = {**decision,'choice':{**choice,'action':'CLOSE'}} if reducing else decision
            filtered, trace = opening_filter(organism.store.get('trade_filter:' + product, {}), filter_decision,
                organism.settings.model_dump(), product, time.time(), organism.store.get('last_close:' + product, 0), None)
            organism.store.put_many({'trade_filter:' + product: filtered, 'trade_filter_status:' + product: trace})
            if not trace['allowed']: raise ValueError(trace['reason'])
            result = bridge.call('prepare', {'identity': identity, 'decision': decision,
                'instrument': instrument.model_dump(), 'limits': {'target': organism.settings.target_notional,
                'total': organism.settings.total_notional, 'loss': organism.settings.loss_limit}})
            mapping = organism.store.get('contest_plans', {})
            mapping[result['id']] = decision['decision_id']
            organism.store.put('contest_plans', mapping)
            organism.store.put('execution_status:' + product, {'status': 'prepared', 'message': '计划已生成，等待你逐笔确认',
                'plan_id': result['id'], 'decision_id': decision['decision_id'], 'at': time.time()})
            organism.store.event('execution_gate', {'product': product, 'message': '计划已生成，等待人工确认',
                'plan_id': result['id']}, actor='execution', decision_id=decision['decision_id'])
        except ValueError as exc:
            organism.store.put('execution_status:' + product, {'status': 'blocked', 'message': str(exc),
                'decision_id': decision['decision_id'], 'at': time.time()})
            organism.store.event('execution_gate', {'product': product, 'message': str(exc)},
                actor='execution', decision_id=decision['decision_id'])
