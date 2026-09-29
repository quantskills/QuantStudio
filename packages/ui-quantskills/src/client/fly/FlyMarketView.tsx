import { TradeLoop, type TradeMarket } from './TradeLoop.tsx'
import { TradingPriceChart } from '../TradingPriceChart.tsx'

export type MarketView = TradeMarket & { price?: number; chart?: number[]; quote_at?: number; last_bar?: string }
/** A view of received market data only; an empty or stale feed is never animated as live. */
export function FlyMarketView({ market, observing, onDetails, automatic = true }: { automatic?: boolean; market?: MarketView | undefined; observing: boolean; onDetails(): void }) {
  const prices = (market?.chart ?? []).filter(Number.isFinite)
  const low = Math.min(...prices), high = Math.max(...prices)
  const value = market?.price != null && Number.isFinite(market.price) ? market.price.toLocaleString('zh-CN', { maximumFractionDigits: 4 }) : '—'
  return <div className="fv-focus-grid">
    <section className="fv-market-focus" aria-label="当前合约行情"><header><div><small>{market?.readiness === 'ready' ? '当前行情' : '末次报价 · 等待有效行情'}</small><h2>{market?.symbol || '选择一个实际合约'}</h2></div><strong className="fv-market-price">{value}</strong></header>
      {prices.length > 1 ? <TradingPriceChart prices={prices} label={`${market?.symbol} 已接收价格曲线，最低 ${low}，最高 ${high}`}/> : <div className="fv-market-empty"><span>等待行情</span><p>有效报价到达后，在这里查看价格变化。</p></div>}
      <footer><span>{market?.period_minutes || 1} 分钟收盘价 · {market?.count ?? 0} 根</span><span>{market?.quote_at ? `多 ${market.long ?? 0} / 空 ${market.short ?? 0} 手` : '持仓待同步'}</span></footer>
      {market?.quote_at && <small className="fv-quote-time">报价时间 {new Date(market.quote_at * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}（上海）</small>}
    </section>
    <aside className="fv-reason-focus" aria-label="当前决策状态"><small>当前进展</small><TradeLoop markets={market ? [market] : []} observing={observing} automatic={automatic}/><button type="button" onClick={onDetails}>行情与运行详情 ↗</button></aside>
  </div>
}
