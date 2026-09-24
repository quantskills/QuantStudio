"""Engineering market senses -> frozen retinal circuit -> deterministic readout.

This is NOT a biological financial circuit or a validated profitable strategy.
The five calibrated retinal bands are shared with life sensing at separate times;
only measured downstream spike responses reach the action scorer. No RNG, raw
price, language model, or account equity enters that scorer.
"""
import hashlib
import numpy as np
try:
    from .neural_life import CHANNELS, LifeReadout
except ImportError:
    from neural_life import CHANNELS, LifeReadout

VERSION = 'neural-trade-3'
SENSES = ('fast_up', 'fast_down', 'slow_up', 'slow_down', 'volatility')


def market_senses(bars, minutes=1, product=None):
    if len(bars) != 500:
        raise ValueError('交易感知需要恰好 500 根目标周期已完成 K 线')
    candles = bars
    closes = np.array([b['close'] for b in candles], float)
    if not np.isfinite(closes).all() or (closes <= 0).any():
        raise ValueError('交易价格无效')
    returns = np.diff(np.log(closes))
    scale = max(float(np.std(returns)), 1e-6)
    fast = float(np.tanh(returns[-8:].sum() / (scale * np.sqrt(8) * 2)))
    slow = float(np.tanh(returns[-32:].sum() / (scale * np.sqrt(32) * 2)))
    volatility = float(np.clip(np.std(returns[-32:]) / scale / 3, 0, 1))
    values = dict(zip(SENSES, (max(0, fast), max(0, -fast), max(0, slow), max(0, -slow), volatility)))
    return {'values': values, 'bars': 500, 'period_minutes': minutes, 'period_bars': len(candles),
            'first_bar': candles[0]['datetime'], 'last_bar': candles[-1]['datetime'],
            'source': 'engineered_market_sensors', 'encoding': 'five_calibrated_retinal_bands',
            'bar_source': 'pandadata_native_period',
            'note': f'PandaData 原生 {minutes} 分钟 K 线，最新 500 根完整周期；8/32 根周期变化与波动投射到人工视网膜通道；不是天然交易感觉'}


class TradeReadout(LifeReadout):
    actions = ('LONG', 'SHORT', 'CLOSE')

    def choose(self, values, decision_id, *, held=0, valid=True, sizing=None):
        x = np.array([values[k] for k in SENSES], float)
        if not np.isfinite(x).all() or ((x < 0) | (x > 1)).any() or held not in (-1, 0, 1):
            raise ValueError('交易神经读出无效')
        up = .65*x[0] + .35*x[2]
        down = .65*x[1] + .35*x[3]
        drives = np.array([up, down, down if held == 1 else up if held == -1 else 0.])
        expected = self.weights @ x
        scores = drives * (1 + np.clip(expected, -.65, .65))
        wait = .18 + .28*x[4]
        if held:
            # Same-side evidence can increase or reduce exposure; opposite evidence closes first.
            scores[1 if held == 1 else 0] = 0
        else:
            scores[2] = 0
        if not valid:
            scores[:] = 0
        index = int(np.argmax(scores))
        # Equal competing evidence abstains; list order cannot select a side.
        action = self.actions[index] if scores[index] > wait and np.count_nonzero(np.isclose(scores, scores[index], atol=.02)) == 1 else 'WAIT'
        sizing = sizing or {}
        current = int(sizing.get('current_position', held))
        target = current
        reason = '神经响应无效，等待' if not valid else '神经证据不足，保持仓位'
        if action == 'CLOSE':
            target = 0
            reason = '反向神经证据占优，先平仓；成交后重新决策'
        elif action in ('LONG', 'SHORT'):
            capacity = sizing.get('long_capacity' if action == 'LONG' else 'short_capacity')
            if capacity is None:
                action = 'WAIT'
                reason = '等待比赛账户可用资金和完整保证金数据'
            else:
                edge = max(0., float(scores[index]) - max(wait, float(np.max(np.delete(scores,index)))))
                fraction = min(1., edge / max(float(scores[index]), 1e-9)) * (1-float(x[4]))
                target = int(np.floor(max(0,capacity) * fraction)) * (1 if action == 'LONG' else -1)
                if target == current:
                    action = 'WAIT'
                    reason = '目标仓位未变化，保持仓位'
                elif target == 0:
                    if current:
                        action = 'CLOSE'
                        reason = '神经强度对应不足一手，退出当前仓位'
                    else:
                        action = 'WAIT'
                        reason = '可用资金与信号强度对应不足一手，等待'
                else:
                    reason = f'神经优势与波动读出决定资金比例 {fraction:.0%}，目标 {abs(target)} 手'
        if action != 'WAIT':
            self.pending[decision_id] = {'x': x.tolist(), 'index': self.actions.index(action), 'expected': float(expected[self.actions.index(action)])}
        return {'action': action, 'current_position': current, 'target_position': target, 'sizing': sizing, 'scores': {**dict(zip(self.actions, scores.tolist())), 'WAIT': float(wait)},
                'drives': dict(zip(self.actions, drives.tolist())), 'expected_rewards': dict(zip(self.actions, expected.tolist())),
                'readout': VERSION, 'sampling': False, 'connectome_frozen': True, 'learning_scope': 'trade_readout_only',
                'reason': reason,
                'engineering_prior': '显式趋势读出规则，尚未验证交易有效性'}

    def state(self):
        return {**super().state(), 'version': VERSION, 'applied':sorted(self.applied)}

    def restore(self, state):
        if state['version'] not in (VERSION, 'neural-trade-2'):
            raise ValueError('交易读出检查点版本不兼容')
        super().restore({**state, 'version': super().state()['version']})


def observe_trade(brain, channels, readout, bars, decision_id, *, held=0, sizing=None, input_cut=False, output_cut=False, minutes=1, product=None):
    sensory = market_senses(bars, minutes, product)
    encoded = dict(zip(CHANNELS, sensory['values'].values()))
    stimulus = channels.encode(encoded, disconnect=CHANNELS if input_cut else ())
    observations = [brain.observe(stimulus, 200) for _ in range(3)]
    counts = (observations[1].counts.astype(float) + observations[2].counts) / 2
    if output_cut:
        counts[:] = 0
    decoded, trace = channels.decode(counts)
    values = dict(zip(SENSES, (decoded[k] for k in CHANNELS)))
    response = dict(zip(SENSES, (trace[k] for k in CHANNELS)))
    choice = readout.choose(values, decision_id, held=held, sizing=sizing, valid=all(t['valid'] for t in response.values()))
    return {'choice': choice, 'market_sensory': sensory, 'trade_response': response,
            'response_hash': hashlib.sha256(counts.tobytes()).hexdigest(),
            'total_spikes': int(sum(o.counts.sum() for o in observations)), 'sim_ms': observations[-1].sim_ms,
            'compute_seconds': sum(o.compute_seconds for o in observations),
            'activity': {k:v for k,v in brain.population_rates(counts, 200).items() if k in ('DN','MBON','KC','R1-R6','lamina')},
            'experiment': {'input_cut': input_cut, 'output_cut': output_cut}}
