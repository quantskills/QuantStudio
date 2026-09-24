"""Normalize native SSQUANT period bars; never resample them inside the fly."""
from datetime import datetime, timezone, timedelta
import math

TZ = timezone(timedelta(hours=8))


def timestamp(value):
    if isinstance(value, (float, int)):
        number = float(value)
        if number > 1e14: number /= 1e9
        elif number > 1e11: number /= 1e3
        return number
    stamp = datetime.fromisoformat(str(value).replace('Z','+00:00'))
    if stamp.tzinfo is None: stamp = stamp.replace(tzinfo=TZ)
    return stamp.timestamp()


def bars_key(product, minutes=1):
    # Preserve the historical minute cache, without interpreting it as N minutes.
    return 'bars:'+product+(f':{minutes}m' if minutes != 1 else '')


def merge_bars(previous, incoming, *, now=None, timestamps_are_close=False, limit=500, minutes=1):
    now = datetime.now(timezone.utc).timestamp() if now is None else now
    result = {}
    for raw in [*previous, *incoming]:
        at = timestamp(raw.get('datetime', raw.get('timestamp')))
        if not math.isfinite(at) or at + (0 if timestamps_are_close else minutes*60) > now:
            continue
        row = {key:float(raw.get(key,0)) for key in ('open','high','low','close','volume')}
        if not all(math.isfinite(v) for v in row.values()):
            raise ValueError('行情包含无效数字')
        if min(row[k] for k in ('open','high','low','close')) <= 0 or row['volume'] < 0:
            raise ValueError('行情价格或成交量无效')
        if row['low'] > min(row['open'],row['close']) or row['high'] < max(row['open'],row['close']) or row['low'] > row['high']:
            raise ValueError('行情高低价不一致')
        row['datetime'] = datetime.fromtimestamp(at, timezone.utc).isoformat()
        result[at] = row
    keys=sorted(result)
    return [result[key] for key in (keys[-limit:] if limit else keys)]


def readiness(bars, quote_at, now=None, minutes=1):
    now = datetime.now(timezone.utc).timestamp() if now is None else now
    if len(bars) != 500: return 'history_incomplete'
    if not quote_at or not 0 <= now-quote_at <= 10: return 'quote_stale'
    if not 0 <= now-timestamp(bars[-1]['datetime']) <= max(180,minutes*120): return 'bars_stale'
    return 'ready'


def needs_history(bars, product, minutes=1):
    """REST supplies missing history; SimNow supplies ongoing market updates.

    An old but intact 500-bar window during lunch/overnight is not a request
    trigger. A later live bar exposes missed session minutes and requests repair.
    """
    return len(bars)<500 or missing_minutes(bars,product,minutes)>0


def history_since(bars, product, minutes=1):
    """A persisted complete window only needs its tail or its first missing span."""
    if len(bars)<500:return None
    for left,right in zip(bars,bars[1:]):
        if missing_minutes([left,right],product,minutes):return left['datetime']
    return bars[-1]['datetime']


def history_delay(products, minutes, now):
    moment=datetime.fromtimestamp(now,TZ)
    # Session hours and weekends; no holiday calendar is assumed.
    active=any(session_key(now,p) is not None for p in products)
    weekend=moment.weekday()==6 or (moment.weekday()==5 and moment.hour>=3)
    if not active or weekend:return 300
    return minutes*60-now%(minutes*60)+2


def session_key(at, product):
    """Session boundaries prevent lunch/night/weekend gaps becoming fake bars.

    Coverage across separate sessions is supplied by SSQUANT history. Within a
    session, missing minutes are never interpolated and block new decisions.
    """
    moment=datetime.fromtimestamp(at,TZ);minute=moment.hour*60+moment.minute
    periods=[(570,690),(780,900)] if product in ('IF','IM') else [(540,615),(630,690),(810,900)]
    for index,(start,end) in enumerate(periods):
        if start<=minute<end:return (moment.date().isoformat(),index)
    if product in ('IF','IM'):return None
    end=150 if product in ('au','ag','sc') else 0
    if minute>=1260 and (end or minute<1380):return (moment.date().isoformat(),'night')
    if end and minute<end:return ((moment-timedelta(days=1)).date().isoformat(),'night')
    return None


def missing_minutes(bars,product,minutes=1):
    """Count missing native-period bars (legacy function name retained)."""
    step=minutes*60
    count=0
    for left,right in zip(bars,bars[1:]):
        a,b=timestamp(left['datetime']),timestamp(right['datetime'])
        key=session_key(a,product);other=session_key(b,product)
        if key is None or other is None:continue
        if key==other:
            count+=max(0,int((b-a)/step)-1)
            if (b-a)%step:count+=1
        else:
            # Check both session edges, including across weekends/holidays.
            # Do not invent a holiday calendar or synthesize closed-market bars.
            cursor=a+step
            while cursor<b and session_key(cursor,product)==key:
                count+=1;cursor+=step
            cursor=b-step
            while cursor>a and session_key(cursor,product)==other:
                count+=1;cursor-=step
            # A whole skipped intraday session is also a hole, not a lunch break.
            if key[0]==other[0]:
                for cursor in range(int(a+step),int(b),step):
                    middle=session_key(cursor,product)
                    if middle is not None and middle not in (key,other):count+=1
    return count
