import { CaretRightIcon, PlusIcon } from '@phosphor-icons/react'
import { products } from '@deepseek-ai/dsh-quantskills-session/contracts'
import type { MarketView } from './FlyMarketView.tsx'

const actions: Record<string, string> = { WAIT: '等待信号', LONG: '目标做多', SHORT: '目标做空', CLOSE: '平仓' }
const readiness: Record<string, string> = { history_incomplete: '历史不足', history_gap: '分钟线缺口', quote_stale: '等待新报价', bars_stale: '分钟线过期' }
export function FlyContractList({ markets, selected, trading, onSelect, onManage }: {
  markets: MarketView[]; selected: string | undefined; trading: boolean; onSelect(product: string): void; onManage(): void
}) {
  return <section className="qs-contract-overview" aria-label="交易合约">
    <header><h2>交易合约 <small>{markets.length} 个已配置</small></h2><button type="button" onClick={onManage}><PlusIcon size={15}/>管理合约</button></header>
    <div className="qs-contract-list">{markets.map(market => {
      const values = (market.chart ?? []).filter(Number.isFinite).slice(-36)
      const low = Math.min(...values), high = Math.max(...values), range = high - low || 1
      const name = products.find(item => item.product.toLowerCase() === market.product.toLowerCase())?.name
      const state = !trading ? '已暂停' : market.execution?.status === 'reconciling' ? '成交后核对持仓' : market.readiness !== 'ready' ? readiness[market.readiness] || '等待行情' : market.decision_status?.status === 'running' ? '模型分析中' : market.decision_status?.status === 'error' ? '模型调用未完成' : market.decision ? actions[market.decision.choice.action] || '等待决策' : '等待决策'
      return <button type="button" className="qs-contract-row" key={market.product} aria-label={`查看合约 ${market.symbol || market.product}`} aria-pressed={selected === market.product} onClick={() => onSelect(market.product)}>
        <span><strong>{name || market.product.toUpperCase()}</strong><small>{market.symbol || market.product}</small></span>
        <span className="qs-contract-price">{market.price != null && Number.isFinite(market.price) ? market.price.toLocaleString('zh-CN', { maximumFractionDigits: 4 }) : '—'}</span>
        <span className="qs-contract-spark">{values.length > 1 ? <svg viewBox="0 0 100 30" aria-hidden="true"><polyline points={values.map((v, i) => `${i / (values.length - 1) * 100},${high === low ? 15 : 26 - (v - low) / range * 22}`).join(' ')}/></svg> : '行情待同步'}</span>
        <span className="qs-contract-position">{market.quote_at ? `多 ${market.long ?? 0} / 空 ${market.short ?? 0} 手` : '持仓待同步'}</span><span className="qs-contract-state">{state}</span><CaretRightIcon size={14}/>
      </button>
    })}{!markets.length && <p>添加实际合约后，在这里同时查看行情与运行状态。</p>}</div>
  </section>
}
