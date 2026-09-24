"""Owned fill statistics, with explicit gross P&L and account-level fees."""
from collections import defaultdict
from datetime import datetime
import math


def number(value):
    try:
        value=float(value)
        return value if math.isfinite(value) else None
    except (TypeError,ValueError):return None


def statistics(events, markets, account, day, end_day=None):
    market_by_symbol={m['symbol']:m for m in markets if m.get('symbol')}
    rows={};books=defaultdict(list);details=[];seen=set()
    def row_for(symbol,product):
        if symbol not in rows:rows[symbol]={'symbol':symbol,'product':product,'opening_lots':0,'closing_lots':0,'fill_count':0,'realized_gross':0.,'unmatched_closing_lots':0}
        return rows[symbol]
    for m in markets:
        if m.get('symbol'):row_for(m['symbol'],m['product'])
    counter={(str(t.get('trading_day','')),str(t.get('instrument_id',t.get('symbol',''))),str(t.get('trade_id','')).strip()):t for t in account.get('trades',[])}
    for e in events:
        p=e['payload'];symbol=p['symbol'];trading_day=str(p.get('trading_day',''));trade_id=str(p.get('trade_id','')).strip()
        key=(trading_day,symbol,trade_id)
        if not trade_id or key in seen:continue
        seen.add(key)
        row=row_for(symbol,p['product']);market=market_by_symbol.get(symbol,{})
        multiplier=number(p.get('multiplier')) or number((market.get('allocation') or {}).get('multiplier'))
        price=number(p.get('price'));volume=int(p.get('volume',0));direction=str(p.get('direction',''));offset=str(p.get('offset',''))
        if price is None or volume<=0 or direction not in ('0','1'):continue
        opening=offset=='0';gross=None;unmatched=0
        if opening:books[symbol].append({'volume':volume,'price':price,'direction':direction,'day':trading_day})
        else:
            remaining=volume;gross=0.
            for lot in books[symbol]:
                if lot['direction']==direction or not lot['volume']:continue
                if offset=='3' and lot['day']!=trading_day:continue
                if offset=='4' and lot['day']==trading_day:continue
                used=min(remaining,lot['volume']);lot['volume']-=used;remaining-=used
                if multiplier is not None:gross+=used*(price-lot['price'])*(1 if lot['direction']=='0' else -1)*multiplier
                if not remaining:break
            unmatched=remaining
            if unmatched or multiplier is None:gross=None
        if not day<=trading_day<=(end_day or day):continue
        row['fill_count']+=1;row['opening_lots' if opening else 'closing_lots']+=volume
        row['unmatched_closing_lots']+=unmatched
        if not opening:
            row['realized_gross']=row['realized_gross']+gross if row['realized_gross'] is not None and gross is not None else None
        receipt=counter.get(key,{})
        details.append({'seq':e['seq'],'at':e['at'],'symbol':symbol,'product':p['product'],'trading_day':trading_day,
                        'time':receipt.get('trade_time') or p.get('trade_time') or datetime.fromtimestamp(e['at']).strftime('%H:%M:%S'),
                        'time_source':'counter' if receipt.get('trade_time') or p.get('trade_time') else 'receipt',
                        'direction':direction,'offset':offset,'price':price,'volume':volume,'realized_gross':gross,
                        'trade_id':trade_id,'order':p.get('order',''),'decision_id':e['decision_id'],'unmatched_closing_lots':unmatched})
    for symbol,row in rows.items():
        market=market_by_symbol.get(symbol,{})
        longs=[lot for lot in books[symbol] if lot['volume'] and lot['direction']=='0']
        shorts=[lot for lot in books[symbol] if lot['volume'] and lot['direction']=='1']
        long_qty=sum(lot['volume'] for lot in longs);short_qty=sum(lot['volume'] for lot in shorts)
        actual_long=market.get('long',long_qty);actual_short=market.get('short',short_qty)
        reconciled=actual_long==long_qty and actual_short==short_qty
        price=number(market.get('price'));multiplier=number((market.get('allocation') or {}).get('multiplier'))
        floating=0. if not long_qty and not short_qty else None
        if price is not None and multiplier is not None:
            floating=sum(lot['volume']*(price-lot['price'])*(1 if lot['direction']=='0' else -1)*multiplier for lot in longs+shorts)
        if not reconciled:floating=None
        row.update(long=actual_long,short=actual_short,
                   long_entry=sum(l['price']*l['volume'] for l in longs)/long_qty if long_qty and reconciled else None,
                   short_entry=sum(l['price']*l['volume'] for l in shorts)/short_qty if short_qty and reconciled else None,
                   last_price=price,quote_at=market.get('quote_at'),valuation_stale=market.get('readiness')=='quote_stale',
                   floating_gross=floating,total_gross=row['realized_gross']+floating if row['realized_gross'] is not None and floating is not None else None,
                   position_reconciled=reconciled)
    def total(field):
        values=[r[field] for r in rows.values()]
        return sum(values) if all(v is not None for v in values) else None
    official={k:number((account.get('official') or {}).get(k)) for k in ('Balance','Available','Commission','CloseProfit','PositionProfit')}
    parts=[official[k] for k in ('CloseProfit','PositionProfit','Commission')]
    official['day_net']=parts[0]+parts[1]-parts[2] if all(v is not None for v in parts) else None
    return {'day':day,'account_day':str((account.get('official') or {}).get('TradingDay','')),
            'rows':list(rows.values()),'fills':list(reversed(details)),
            'summary':{k:total(k) for k in ('fill_count','opening_lots','closing_lots','realized_gross','floating_gross','total_gross')},
            'official':official,'account_updated_at':account.get('official_updated_at'),
            'note':'已实现毛盈亏按果蝇成交配对计算；浮盈按开仓价与末次报价估算，未扣费用。手续费和柜台净盈亏属于整个账户，不向品种虚构分摊；持仓包含跨日延续仓位。'}
