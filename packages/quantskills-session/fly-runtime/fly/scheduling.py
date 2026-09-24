"""Fair selection of fresh per-instrument neural observations."""
from .history import readiness, missing_minutes, timestamp, bars_key
from .trade_filters import filter_config, config_key


def next_trade(store, products, seen, cursor, now):
    settings = store.get('settings', {})
    cfg = filter_config(settings)
    minutes=cfg['trade_period_minutes']
    for offset in range(len(products)):
        index=(cursor+offset)%len(products);product=products[index]
        feed=store.get('feed:'+product,{})
        bars=store.get(bars_key(product,minutes),[])
        if readiness(bars,feed.get('quote_at',0),now,minutes)!='ready' or now-feed.get('at',0)>10:continue
        if feed.get('inflight') or (feed.get('long') and feed.get('short')):continue
        if missing_minutes(bars,product,minutes):continue
        bar=bars[-1]['datetime']
        if not 0<=now-timestamp(bar)-cfg['trade_period_minutes']*60<cfg['trade_period_minutes']*60:continue
        key=str(feed.get('symbol'))+':'+bar+':'+config_key(cfg)
        if key==seen.get(product):continue
        seen[product]=key
        sizing={**feed.get('sizing',{}),'current_position':int(feed.get('long',0)-feed.get('short',0))}
        notional=float(feed.get('price',0))*float(feed.get('multiplier',0))
        if settings.get('target_notional',0)>0 and notional>0:
            for side in ('long_capacity','short_capacity'):
                if sizing.get(side) is not None:sizing[side]=min(sizing[side],int(settings['target_notional']/notional))
        if settings.get('total_notional',0)>0 and notional>0:
            occupied=feed.get('occupied_notional')
            for side in ('long_capacity','short_capacity'):
                if sizing.get(side) is not None:
                    held_lots=feed.get('long' if side=='long_capacity' else 'short',0)
                    extra=int(max(0,settings['total_notional']-occupied)/notional) if occupied is not None else 0
                    sizing[side]=min(sizing[side],held_lots+extra)
        return {'head':'trade','product':product,'symbol':feed['symbol'],'bars':bars,'input_key':key,
                'filter_config':cfg,'signal_bar':bar,
                'sizing':sizing,
                'held':1 if feed.get('long') else -1 if feed.get('short') else 0},(index+1)%len(products)
    return None,cursor


def next_turn(store, products, seen, cursor, trade_streak, now, life_ready):
    # Life uses the same persistent brain. Reserve a turn after a market round,
    # even when inference takes longer than the arrival interval of new bars.
    if life_ready and trade_streak>=len(products):
        return {'head':'life'},cursor,0
    request,cursor=next_trade(store,products,seen,cursor,now)
    if request:return request,cursor,trade_streak+1
    if life_ready:return {'head':'life'},cursor,0
    return None,cursor,trade_streak
