"""Owned FIFO fills: closed P&L deducts matched opening and closing fees."""
from collections import defaultdict
from datetime import datetime
import math
from .trade_receipts import commission, receipt_index, matched_receipt


def number(value):
    try:
        value=float(value)
        return value if math.isfinite(value) else None
    except (TypeError,ValueError):return None


def statistics(events, markets, account, day, end_day=None):
    market_by_symbol={m['symbol']:m for m in markets if m.get('symbol')}
    rows={};books=defaultdict(list);details=[];seen=set()
    def row_for(symbol,product):
        if symbol not in rows:rows[symbol]={'symbol':symbol,'product':product,'opening_lots':0,'closing_lots':0,'fill_count':0,'realized_gross':0.,'realized_net':0.,'commission':0.,'pending_net_count':0,'unmatched_closing_lots':0}
        return rows[symbol]
    for m in markets:
        if m.get('symbol'):row_for(m['symbol'],m['product'])
    counter=receipt_index(account.get('trades',[]))
    for e in sorted(events,key=lambda e:(e['at'],e['seq'])):
        p=e['payload'];symbol=p['symbol'];trading_day=str(p.get('trading_day',''));trade_id=str(p.get('trade_id','')).strip()
        key=(trading_day,symbol,trade_id,p.get('order_id',p.get('order','')))
        if not trade_id or key in seen:continue
        seen.add(key)
        row=row_for(symbol,p['product']);market=market_by_symbol.get(symbol,{})
        multiplier=number(p.get('multiplier')) or number(market.get('multiplier')) or number((market.get('allocation') or {}).get('multiplier'))
        if multiplier is not None and multiplier<=0:multiplier=None
        price=number(p.get('price'));volume=int(p.get('volume',0));direction=str(p.get('direction',''));offset=str(p.get('offset',''))
        if price is None or volume<=0 or direction not in ('0','1'):continue
        receipt=matched_receipt(counter,p)
        fee=commission(receipt)
        if fee is None:fee=commission(p)
        opening=offset=='0';gross=None;unmatched=0;opening_fee=0.;net=None
        if opening:books[symbol].append({'volume':volume,'price':price,'direction':direction,'day':trading_day,'fee_per_lot':fee/volume if fee is not None else None})
        else:
            remaining=volume;gross=0.
            for lot in books[symbol]:
                if lot['direction']==direction or not lot['volume']:continue
                if offset=='3' and lot['day']!=trading_day:continue
                if offset=='4' and lot['day']==trading_day:continue
                used=min(remaining,lot['volume']);lot['volume']-=used;remaining-=used
                opening_fee=opening_fee+used*lot['fee_per_lot'] if opening_fee is not None and lot['fee_per_lot'] is not None else None
                if multiplier is not None:gross+=used*(price-lot['price'])*(1 if lot['direction']=='0' else -1)*multiplier
                if not remaining:break
            unmatched=remaining
            if unmatched or multiplier is None:gross=None
            if gross is not None and fee is not None and opening_fee is not None:net=round(gross-fee-opening_fee,8)
        if not day<=trading_day<=(end_day or day):continue
        row['fill_count']+=1;row['opening_lots' if opening else 'closing_lots']+=volume
        row['unmatched_closing_lots']+=unmatched
        row['commission']=row['commission']+fee if row['commission'] is not None and fee is not None else None
        if not opening:
            row['realized_gross']=row['realized_gross']+gross if row['realized_gross'] is not None and gross is not None else None
            row['realized_net']=row['realized_net']+net if row['realized_net'] is not None and net is not None else None
            row['pending_net_count']+=int(net is None)
        details.append({'seq':e['seq'],'at':e['at'],'symbol':symbol,'product':p['product'],'trading_day':trading_day,
                        'time':receipt.get('trade_time') or receipt.get('tradeTime') or p.get('trade_time') or datetime.fromtimestamp(e['at']).strftime('%H:%M:%S'),
                        'time_source':'counter' if receipt.get('trade_time') or receipt.get('tradeTime') or p.get('trade_time') else 'receipt',
                        'direction':direction,'offset':offset,'price':price,'volume':volume,'realized_gross':gross,
                        'commission':fee,'opening_commission':None if opening else opening_fee,'realized_net':net,
                        'trade_id':trade_id,'order':p.get('order_id',p.get('order','')),'decision_id':e['decision_id'],'unmatched_closing_lots':unmatched})
    for symbol,row in rows.items():
        market=market_by_symbol.get(symbol,{})
        longs=[lot for lot in books[symbol] if lot['volume'] and lot['direction']=='0']
        shorts=[lot for lot in books[symbol] if lot['volume'] and lot['direction']=='1']
        long_qty=sum(lot['volume'] for lot in longs);short_qty=sum(lot['volume'] for lot in shorts)
        actual_long=market.get('long',long_qty);actual_short=market.get('short',short_qty)
        reconciled=actual_long==long_qty and actual_short==short_qty
        price=number(market.get('price'));multiplier=number(market.get('multiplier')) or number((market.get('allocation') or {}).get('multiplier'))
        floating=0. if not long_qty and not short_qty else None
        if price is not None and price>0 and multiplier is not None and multiplier>0:
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
        return round(sum(values),8) if all(v is not None for v in values) else None
    official={k:number((account.get('official') or {}).get(k)) for k in ('Balance','Available','Commission','CloseProfit','PositionProfit')}
    parts=[official[k] for k in ('CloseProfit','PositionProfit','Commission')]
    official['day_net']=parts[0]+parts[1]-parts[2] if all(v is not None for v in parts) else None
    return {'day':day,'date_basis':'trading_day' if account.get('day_source')=='official' else 'calendar',
            'account_day':str((account.get('official') or {}).get('TradingDay','')),
            'rows':list(rows.values()),'fills':list(reversed(details)),
            'summary':{k:total(k) for k in ('fill_count','opening_lots','closing_lots','realized_gross','realized_net','commission','pending_net_count','floating_gross','total_gross')},
            'official':official,'account_updated_at':account.get('official_updated_at'),
            'note':'平仓净盈亏＝成交配对毛盈亏－对应开仓手续费－平仓手续费；分批平仓按手数分配开仓手续费，跨日保留成本。手续费列为该笔柜台实际费用，当日手续费包含未平仓的开仓费用；资料不全时净盈亏待核算。浮盈未扣费用。柜台汇总属于整个账户，可能包含其他策略。'}
