"""Charts from persisted counter observations and owned fills; no synthetic equity."""
from datetime import datetime
import json
import time

from .history import timestamp, TZ
from .statistics import number, statistics
from .store import encode
from .models import PRODUCTS

ACCOUNT_FIELDS = ('Balance', 'Available', 'CloseProfit', 'PositionProfit', 'Commission', 'Deposit', 'Withdraw')
GAP_SECONDS = 180


def save_sample(store, account_id, official, at, *, observed_at, source, sample_key, provenance=''):
    """Internal importer shared with the live recorder, never exposed as a write API."""
    day = str(official.get('TradingDay', ''))
    if len(day) != 8 or not day.isdigit():
        return False
    try:
        datetime.strptime(day, '%Y%m%d')
    except ValueError:
        return False
    values = {key: number(official.get(key)) for key in ACCOUNT_FIELDS}
    if not account_id or values['Balance'] is None or number(at) is None or number(observed_at) is None:
        return False
    if source not in ('counter', 'acceptance_observation') or not sample_key:
        return False
    values['provenance'] = provenance
    with store.connect() as db:
        result = db.execute('INSERT OR IGNORE INTO equity_samples VALUES(?,?,?,?,?,?,?)',
                            (account_id, day, at, observed_at, source, sample_key, encode(values)))
        return bool(result.rowcount)


def record_account_sample(store, snapshot, account_id, now=None):
    """Persist once per fresh official update, independent of the browser lifecycle."""
    now = time.time() if now is None else now
    # Preserve multiplier evidence when active contracts roll or allocation is disabled.
    contracts = store.get('analytics_contracts', {})
    updated = dict(contracts)
    for product in PRODUCTS:
        feed = store.get('feed:' + product, {})
        multiplier = number(feed.get('multiplier'))
        if feed.get('symbol') and multiplier is not None and multiplier > 0:
            updated[feed['symbol']] = {'symbol': feed['symbol'], 'product': product, 'allocation': {'multiplier': multiplier}}
    if updated != contracts:
        store.put('analytics_contracts', updated)
    if snapshot.get('trading_account_id') != account_id or snapshot.get('official_sync', {}).get('stale', True):
        return False
    try:
        at = timestamp(snapshot.get('official_updated_at'))
    except (ValueError, TypeError):
        return False
    if number(at) is None or not -60 <= now - at <= GAP_SECONDS:
        return False
    return save_sample(store, account_id, snapshot.get('official') or {}, at, observed_at=now,
                       source='counter', sample_key=f'counter:{at:.6f}')


def aggregate_periods(equity, fills, period):
    """Last real observation per bucket; absent observations never become flat equity."""
    groups = {}
    def bucket(at, day):
        if period == '1d':
            return day, datetime.strptime(day, '%Y%m%d').replace(tzinfo=TZ).timestamp(), day[:4]+'-'+day[4:6]+'-'+day[6:]
        step = {'1m': 60, '3m': 180, '5m': 300, '1h': 3600}[period]
        start = int(at // step) * step
        label = datetime.fromtimestamp(start, TZ).strftime('%m-%d %H:%M')
        return (day, start), start, label
    def group(at, day):
        key, start, label = bucket(at, day)
        return groups.setdefault(key, {'at': start, 'label': label, 'day': day, 'samples': [], 'fills': []})
    for sample in equity:
        group(sample['at'], sample['day'])['samples'].append(sample)
    for fill in fills:
        group(fill['at'], fill['trading_day'])['fills'].append(fill)
    result = []
    cumulative = 0.
    last_sample = None
    for g in sorted(groups.values(), key=lambda g: (g['at'], g['day'])):
        samples = g.pop('samples')
        trades = g.pop('fills')
        closed = [t for t in trades if t['offset'] != '0']
        known = [t['realized_gross'] for t in closed if t['realized_gross'] is not None]
        gross = sum(known) if len(known) == len(closed) else None
        cumulative = cumulative + gross if cumulative is not None and gross is not None else None
        last = samples[-1] if samples else None
        # Intraday gaps remain visible; daily aggregation does not call weekends outages.
        gap_before = bool(samples and last_sample and samples[0]['day'] == last_sample['day']
                          and samples[0]['at'] - last_sample['at'] > GAP_SECONDS)
        g.update(sample_count=len(samples), fill_count=len(trades), closing_fills=len(closed),
                 wins=sum(p > 0 for p in known), losses=sum(p < 0 for p in known), breakeven=sum(p == 0 for p in known),
                 win_rate=sum(p > 0 for p in known) / len(known) * 100 if known else None,
                 realized_gross=gross, cumulative_gross=cumulative, Balance=last['Balance'] if last else None,
                 observed_at=last['at'] if last else None, day_net=last['day_net'] if last else None,
                 realized_net=last['realized_net'] if last else None,
                 cumulative_net=last['cumulative_net'] if last else None,
                 realized_equity=last['realized_equity'] if last else None,
                 drawdown=last['drawdown'] if last else None,
                 worst_drawdown=min(s['drawdown'] for s in samples) if samples else None,
                 contains_gap=any(s['gap_before'] for s in samples), gap_before=gap_before)
        if last:
            last_sample = last
        result.append(g)
    return result


def trading_analytics(store, markets, account, account_id, day, *, period='raw', start_day=None, end_day=None):
    start_day = start_day or day
    end_day = end_day or day
    events = store.fills_since(0)
    contracts = dict(store.get('analytics_contracts', {}))
    for market in markets:
        if not market.get('symbol'):
            continue
        merged = {**contracts.get(market['symbol'], {}), **market}
        if not (market.get('allocation') or {}).get('multiplier'):
            merged['allocation'] = contracts.get(market['symbol'], {}).get('allocation')
        contracts[market['symbol']] = merged
    stats = statistics(events, list(contracts.values()), account, start_day, end_day)
    with store.connect() as db:
        samples = [{**dict(row), **json.loads(row['payload'])} for row in db.execute(
            'SELECT * FROM equity_samples WHERE account_id=? AND day>=? AND day<=? ORDER BY at,observed_at', (account_id, start_day, end_day))]
        days = {row[0] for row in db.execute('SELECT DISTINCT day FROM equity_samples WHERE account_id=?', (account_id,))}
    days.update(str(e['payload'].get('trading_day', '')) for e in events)
    days.add(day)
    equity = []
    peak = None
    max_drawdown = 0.
    max_drawdown_pct = None
    previous = None
    previous_day = None
    gaps = []
    cash_flows = set()
    cash_flow_unknown = False
    daily_net = {}
    for sample in samples:
        balance = sample['Balance']
        peak = balance if peak is None else max(peak, balance)
        drawdown = balance - peak
        pct = drawdown / peak * 100 if peak > 0 else None
        max_drawdown = max(max_drawdown, -drawdown)
        if pct is not None:
            max_drawdown_pct = max(max_drawdown_pct or 0., -pct)
        cash_flow_unknown |= sample['Deposit'] is None or sample['Withdraw'] is None
        if sample['Deposit'] is not None and sample['Withdraw'] is not None:
            cash_flows.add(sample['Deposit'] - sample['Withdraw'])
        parts = [sample[k] for k in ('CloseProfit', 'PositionProfit', 'Commission')]
        net = parts[0] + parts[1] - parts[2] if all(v is not None for v in parts) else None
        # CTP Commission is account-wide and includes opening fees. Never deduct
        # it from the fly's owned FIFO P&L or infer a per-fill fee allocation.
        realized_net = parts[0] - parts[2] if parts[0] is not None and parts[2] is not None else None
        daily_net[sample['day']] = realized_net
        # Counters reset at TradingDay rollover (including the prior night's
        # session). Replace each day's cumulative value rather than summing
        # snapshots, and never turn a missing fee observation into zero.
        cumulative_net = sum(daily_net.values()) if all(v is not None for v in daily_net.values()) else None
        gap = previous is not None and previous_day == sample['day'] and sample['at'] - previous > GAP_SECONDS
        if gap:
            gaps.append({'from': previous, 'to': sample['at'], 'seconds': sample['at'] - previous})
        equity.append({k: sample[k] for k in ('day', 'at', 'observed_at', 'source', 'Balance', 'Available', 'CloseProfit',
                                            'PositionProfit', 'Commission', 'provenance')})
        equity[-1].update(drawdown=drawdown, drawdown_pct=pct, day_net=net,
                          realized_net=realized_net, cumulative_net=cumulative_net,
                          gap_before=gap)
        previous = sample['at']
        previous_day = sample['day']
    # A fixed baseline makes the realized-equity chart independent of later
    # floating P&L and cash flows. It is a derived curve, not live account equity.
    first = equity[0] if equity else None
    baseline = first['Balance'] - first['day_net'] if first and first['day_net'] is not None else None
    for point in equity:
        point['realized_equity'] = baseline + point['cumulative_net'] if baseline is not None and point['cumulative_net'] is not None else None
    # Receipt order is retained: TradingDay is not the calendar date of night-session trades.
    fills = sorted(stats['fills'], key=lambda f: (f['at'], f['seq']))
    closed = [f for f in fills if f['offset'] != '0']
    cumulative = 0.
    realized_curve = []
    for fill in closed:
        gross = fill['realized_gross']
        cumulative = cumulative + gross if cumulative is not None and gross is not None else None
        realized_curve.append({**fill, 'cumulative_gross': cumulative})
    known = [f['realized_gross'] for f in closed if f['realized_gross'] is not None]
    wins = sum(v > 0 for v in known)
    losses = sum(v < 0 for v in known)
    gains = sum(v for v in known if v > 0)
    loss = -sum(v for v in known if v < 0)
    latest = equity[-1] if equity else None
    # Historical days never borrow today's live account P&L.
    current = (account.get('official') or {}) if str((account.get('official') or {}).get('TradingDay', '')) == end_day else {}
    official = {k: latest[k] if latest else number(current.get(k)) for k in ACCOUNT_FIELDS[:5]}
    parts = [official[k] for k in ('CloseProfit', 'PositionProfit', 'Commission')]
    official['day_net'] = parts[0] + parts[1] - parts[2] if all(v is not None for v in parts) else None
    account_at = latest['at'] if latest else None
    daily = {}
    for sample in equity:
        daily[sample['day']] = sample
    def recorded_sum(field):
        values = [s[field] for s in daily.values()]
        return sum(values) if values and all(v is not None for v in values) else None
    period_summary = {'recorded_days': len(daily), 'day_net': recorded_sum('day_net'),
                      'realized_net': recorded_sum('realized_net'),
                      'CloseProfit': recorded_sum('CloseProfit'), 'PositionProfit': recorded_sum('PositionProfit'),
                      'Commission': recorded_sum('Commission')}
    products = {}
    for row in stats['rows']:
        entry = products.setdefault(row['product'], {'product': row['product'], 'symbols': [], 'fill_count': 0,
            'opening_lots': 0, 'closing_lots': 0, 'realized_gross': 0., 'unmatched_closing_lots': 0})
        entry['symbols'].append(row['symbol'])
        for field in ('fill_count', 'opening_lots', 'closing_lots', 'unmatched_closing_lots'):
            entry[field] += row[field]
        entry['realized_gross'] = entry['realized_gross'] + row['realized_gross'] if entry['realized_gross'] is not None and row['realized_gross'] is not None else None
    for entry in products.values():
        entry['symbol'] = ' / '.join(entry.pop('symbols'))
    return {
        'day': end_day, 'start_day': start_day, 'end_day': end_day, 'period': period,
        'days': sorted((d for d in days if len(d) == 8 and d.isdigit()), reverse=True),
        'generated_at': time.time(), 'account_at': account_at,
        'account_stale': account_at is None or time.time() - account_at > GAP_SECONDS,
        'official': official, 'equity': equity, 'realized_curve': realized_curve, 'fills': fills,
        'periods': aggregate_periods(equity, fills, period) if period != 'raw' else [],
        'period_summary': period_summary, 'gaps': gaps,
        'equity_baseline': {'value': baseline, 'at': first['at'] if first else None,
                            'method': '首条柜台权益减去该条当日净收益反推固定基准；不叠加后续出入金'},
        'products': sorted(products.values(), key=lambda p: PRODUCTS.index(p['product']) if p['product'] in PRODUCTS else len(PRODUCTS)),
        'summary': {
            'fills': len(fills), 'closing_fills': len(closed), 'matched_closes': len(known),
            'unmatched_closes': len(closed) - len(known), 'wins': wins, 'losses': losses,
            'breakeven': len(known) - wins - losses,
            'win_rate': wins / len(known) * 100 if known else None,
            'profit_factor': gains / loss if loss else None,
            'realized_gross': stats['summary']['realized_gross'],
            'max_drawdown': max_drawdown if len(samples) > 1 else None,
            'max_drawdown_pct': max_drawdown_pct if len(samples) > 1 else None,
        },
        'coverage': {'samples': len(samples), 'first_at': equity[0]['at'] if equity else None,
                     'last_at': account_at, 'gaps': sum(p['gap_before'] for p in equity),
                     'observation_samples': sum(p['source'] == 'acceptance_observation' for p in equity),
                     'cash_flow_unknown': cash_flow_unknown, 'cash_flow_changed': len(cash_flows) > 1},
        'note': '累计平仓净盈亏＝柜台平仓盈亏－已发生手续费（含开仓和平仓费用），不含持仓浮盈亏；'
                '平仓权益曲线＝首条快照反推的固定基准＋累计平仓净盈亏，不含后续浮盈变化或出入金，非实时账户总权益。'
                '按有记录交易日的末次值累计，不重复累加日内快照；缺少平仓盈亏或手续费时净值显示未知。'
                '曲线、权益、费用与净收益为整个 PandaAI 模拟赛账户，包含其他策略和手工交易；'
                '品种盈亏和胜率仅统计果蝇已配对的平仓成交，未扣费用，不虚构逐笔手续费。'
                '回撤始终使用范围内原始采样计算，不随图表周期降低精度，未调整出入金。'
                '分钟和小时按上海时间分桶，成交使用柜台成交时间；日线优先使用柜台交易日，缺失时按观测日期归桶，取末次观测，不代表已结算日终值。'
                '范围净收益累加有记录交易日的末次柜台日内净盈亏；无记录日期不补零。缺口虚线仅连接端点，不参与统计。',
    }
