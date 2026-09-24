"""Authenticated loopback access to the QuantStudio host. No order execution API."""
import json
import os
import urllib.error
import urllib.request
import math


class BridgeError(ValueError):
    def __init__(self, message, source='host', code='READ_FAILED', retryable=True, retry_after=None):
        super().__init__(message)
        self.source=source;self.code=code;self.retryable=retryable;self.retry_after=retry_after


def retry_state(previous, error, now, source):
    failures=previous.get('failures',0)+1
    delay=min(300,30*2**min(failures-1,4))
    specified=getattr(error,'retry_after',None)
    if isinstance(specified,(int,float)) and math.isfinite(specified) and specified>0:delay=max(delay,specified)
    blocked=not getattr(error,'retryable',True)
    return {'failures':failures,'retry_at':None if blocked else now+delay,'blocked':blocked,
            'source':getattr(error,'source',source),'code':getattr(error,'code','READ_FAILED')}


def call(path, payload=None):
    request = urllib.request.Request(os.environ['QUANTSTUDIO_FLY_BRIDGE'] + '/' + path,
        data=json.dumps(payload or {}, ensure_ascii=False, allow_nan=False).encode(),
        headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + os.environ['QUANTSTUDIO_FLY_TOKEN']})
    try:
        with urllib.request.urlopen(request, timeout=125) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        try: detail = json.loads(exc.read(16384))
        except ValueError: detail = {}
        raise BridgeError(detail.get('error','宿主请求失败'), detail.get('source','host'), detail.get('code','READ_FAILED'),
                          detail.get('retryable',True), detail.get('retry_after')) from None


def equal_notional_lots(target, price, multiplier):
    import math
    if not all(math.isfinite(v) and v > 0 for v in (target, price, multiplier)):
        raise ValueError('名义额度、价格或乘数无效')
    lots = int(target / (price * multiplier))
    actual = lots * price * multiplier
    return {'lots': lots, 'target_notional': target, 'actual_notional': actual, 'multiplier': multiplier,
            'deviation_pct': (actual - target) / target * 100}
