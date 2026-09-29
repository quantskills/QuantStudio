"""Wait for official positions to reflect fills; never substitute inferred holdings."""
from .history import timestamp


def contract(value):
    return str(value or '').split('.')[0].lower()


def reconcile_positions(organism, result):
    latest = {}
    mapping = organism.store.get('contest_plans', {})
    for plan in result['plans']:
        decision_id = mapping.get(plan['id']) or plan.get('sessionId', '').removeprefix('fly:')
        decision = organism.store.decision(decision_id)
        fills = plan.get('fills', [])
        if not decision or not fills or 'current_position' not in decision.get('choice', {}):
            continue
        product = decision['product']
        feed = result['feeds'].get(product)
        parameters = plan['details']['parameters']
        if not feed or contract(feed.get('symbol')) != contract(parameters.get('contractCode')):
            continue
        at = max(timestamp(fill['time']) for fill in fills)
        if product not in latest or at > latest[product][0]:
            latest[product] = (at, plan, decision)

    for product, (at, plan, decision) in latest.items():
        fills = plan['fills']
        # Partial fills may grow after a previous position acknowledgement.
        signature = sorted((str(fill['id']), fill['volume']) for fill in fills)
        signature = [list(item) for item in signature]
        key = 'position_ack:' + plan['id']
        if organism.store.get(key) == signature:
            continue
        parameters = plan['details']['parameters']
        expected = decision['choice']['current_position'] + sum(fill['volume'] for fill in fills) * (1 if parameters['side'] == 'buy' else -1)
        # Account activity after this fill may legitimately close/change it.
        own_ids = {str(fill['tradeId']) for fill in fills}
        for trade in result['account'].get('trades', []):
            if contract(trade.get('symbol', trade.get('contractCode'))) != contract(parameters['contractCode']):
                continue
            if str(trade.get('trade_id', trade.get('tradeId'))) in own_ids:
                continue
            if trade.get('side') not in ('buy', 'sell') or not trade.get('tradeTime'):
                continue
            if timestamp(trade['tradeTime']) >= at:
                expected += trade['volume'] * (1 if trade['side'] == 'buy' else -1)
        feed = result['feeds'][product]
        actual = feed.get('long', 0) - feed.get('short', 0)
        if actual == expected and not (feed.get('long') and feed.get('short')):
            organism.store.put(key, signature)
            continue
        message = f'已收到成交回执，等待柜台持仓同步（预期净持仓 {expected} 手，柜台返回 {actual} 手）'
        feed['inflight'] = True
        feed['position_sync'] = {'plan_id': plan['id'], 'expected': expected, 'reported': actual, 'message': message}
        organism.store.put('execution_status:' + product, {'status': 'reconciling', 'message': message,
            'plan_id': plan['id'], 'decision_id': decision['decision_id'], 'at': at})
