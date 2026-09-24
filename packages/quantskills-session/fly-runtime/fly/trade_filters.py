"""Auditable execution filters; no price-derived trading direction or random choice."""
import json
import math

try:
    from .history import timestamp, session_key
except ImportError:
    from history import timestamp, session_key


DEFAULTS = {'trade_period_minutes': 1, 'signal_confirmations': 1, 'min_signal_margin': 0.,
            'reentry_cooldown_minutes': 0, 'cost_filter_multiplier': 0.}


def filter_config(settings):
    settings = settings if isinstance(settings, dict) else {}
    return {k: type(v)(settings.get(k, v)) for k, v in DEFAULTS.items()}


def config_key(settings):
    return json.dumps(filter_config(settings), sort_keys=True, separators=(',', ':'))


def cost_estimate(config, price, bid, ask, bars):
    """Local contract metadata estimate, explicitly separate from counter fees.

    Take the larger close/close-today fee and allow two extra slippage ticks.
    Fixed-per-lot fields may be reference-price conversions of rate fields;
    using their maximum avoids double charging them while remaining cautious.
    """
    def value(key):
        try:
            v = float(config[key])
            return v if math.isfinite(v) and v >= 0 else None
        except (KeyError, TypeError, ValueError):
            return None
    multiplier, tick = value('contract_multiplier'), value('price_tick')
    if not multiplier or not tick or not all(math.isfinite(v) for v in (price, bid, ask)) or price <= 0 or bid <= 0 or ask < bid:
        return {'known': False, 'reason': '合约乘数、盘口或价格无效'}
    fees = []
    for rate, fixed in [('commission', 'commission_per_lot'), ('commission_close', 'commission_close_per_lot'),
                        ('commission_close_today', 'commission_close_today_per_lot')]:
        r, f = value(rate), value(fixed)
        if r is None and f is None:
            return {'known': False, 'reason': '开仓、平仓或平今费用参数缺失'}
        fees.append(max(r * price * multiplier if r is not None else 0., f if f is not None else 0.))
    if len(bars) < 15:
        return {'known': False, 'reason': '完整周期不足，无法估计波动空间'}
    ranges = [max(b['high'] - b['low'], abs(b['high'] - a['close']), abs(b['low'] - a['close']))
              for a, b in zip(bars[-15:-1], bars[-14:])]
    atr = sum(ranges) / len(ranges)
    fee = fees[0] + max(fees[1:])
    cost = fee + (ask - bid + 2 * tick) * multiplier
    if not math.isfinite(atr) or atr < 0 or not math.isfinite(cost) or cost <= 0:
        return {'known': False, 'reason': '波动或费用估计无效'}
    return {'known': True, 'roundtrip_fee_per_lot': fee, 'cost_per_lot': cost,
            'atr_price': atr, 'room_per_lot': atr * multiplier, 'room_cost_ratio': atr * multiplier / cost,
            'source': 'SSQUANT 合约费用参数估算（取平仓/平今较高值），非柜台账单', 'slippage_ticks': 2}


def opening_filter(previous, decision, settings, product, now, last_close_at=0, cost=None):
    """Return a persisted confirmation state and trace for this neural decision.

    A replay cannot count as another confirmation. WAIT, weak evidence, a
    session gap, configuration change or contract change resets the streak.
    Closing decisions do not wait for opening confirmation/cooldown/cost gates.
    """
    cfg = filter_config(settings)
    enabled = cfg != DEFAULTS
    choice = decision['choice']
    action = choice['action']
    bar = decision.get('signal_bar')
    key = config_key(settings)
    state = {'config': key, 'symbol': decision.get('symbol'), 'bar': bar, 'action': action, 'count': 0}
    trace = {'decision_id': decision['decision_id'], 'period_minutes': cfg['trade_period_minutes'],
             'required': cfg['signal_confirmations'], 'confirmed': 0, 'allowed': False, 'cost': cost}
    def result(reason, allowed=False):
        trace.update(reason=reason, allowed=allowed, confirmed=state['count'])
        return state, trace
    if not enabled:
        return state, {**trace, 'allowed': True, 'reason': '开仓过滤未启用'}
    if decision.get('filter_config') != cfg or not bar:
        return result('周期或过滤设置已变化，等待新设置下的神经决策')
    try:
        at = timestamp(bar)
    except (TypeError, ValueError):
        return result('信号周期时间无效')
    if not math.isfinite(at) or at + cfg['trade_period_minutes'] * 60 > now:
        return result('信号周期尚未完整结束')
    if now-at-cfg['trade_period_minutes']*60 >= cfg['trade_period_minutes']*60:
        return result('完整周期信号已过期，连续开仓确认已重置')
    if action == 'CLOSE':
        return result('神经平仓选择不受开仓确认、冷却和成本过滤限制', True)
    if action == 'WAIT':
        return result('神经选择等待，连续开仓确认已重置')
    scores = choice.get('scores', {})
    try:
        values = [float(scores[k]) for k in ('LONG', 'SHORT', 'CLOSE', 'WAIT')]
        if not all(math.isfinite(v) for v in values):
            raise ValueError()
        margin = float(scores[action]) - max(float(v) for k, v in scores.items() if k != action)
    except (KeyError, TypeError, ValueError):
        return result('神经分数证据缺失，暂不开仓')
    trace['margin'] = margin
    if margin < cfg['min_signal_margin']:
        return result(f'神经分数领先 {margin:.3f}，低于 {cfg["min_signal_margin"]:.3f}')
    same = previous.get('config') == key and previous.get('symbol') == decision.get('symbol')
    if same and previous.get('bar') == bar:
        state = dict(previous)
        return result('该完整周期已处理，不重复确认或开仓')
    adjacent = (same and previous.get('bar') and timestamp(previous['bar']) + cfg['trade_period_minutes'] * 60 == at
                and session_key(timestamp(previous['bar']), product) == session_key(at, product))
    state['count'] = previous.get('count', 0) + 1 if adjacent and previous.get('action') == action else 1
    state['count'] = min(state['count'], cfg['signal_confirmations'])
    remaining = max(0., last_close_at + cfg['reentry_cooldown_minutes'] * 60 - now) if last_close_at else 0.
    trace['cooldown_remaining'] = remaining
    if remaining:
        state['count'] = 0
        return result(f'平仓后开仓冷却中，还需 {math.ceil(remaining)} 秒')
    if cfg['cost_filter_multiplier'] > 0:
        if not cost or not cost.get('known'):
            state['count'] = 0
            return result('成本参数不完整，暂停新增开仓；' + (cost or {}).get('reason', '等待成本估计'))
        if cost['room_cost_ratio'] < cfg['cost_filter_multiplier']:
            state['count'] = 0
            return result(f'近期波动空间/估算成本 {cost["room_cost_ratio"]:.2f}，低于 {cfg["cost_filter_multiplier"]:.2f}')
    if state['count'] < cfg['signal_confirmations']:
        return result(f'同向开仓信号确认 {state["count"]}/{cfg["signal_confirmations"]}，等待下一个完整周期')
    return result('同向确认、神经分差、开仓冷却和成本过滤通过', True)
