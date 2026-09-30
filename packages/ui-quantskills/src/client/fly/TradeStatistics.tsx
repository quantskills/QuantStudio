import { useState } from 'react'
import ResizableNativeTable from './FlyTable.tsx'
import { useTradeStatistics, type StatisticValue as Value, type TradeFill as Fill } from './useTradeStatistics.ts'

const fmt = (v: Value | undefined) => v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('zh-CN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
const pnl = (v: Value) => <span className={v == null || v === 0 ? '' : v > 0 ? 'fv-profit' : 'fv-loss'}>{v != null && v > 0 ? '+' : ''}{fmt(v)}</span>
const action = (f: Fill) => f.offset === '0' ? (f.direction === '0' ? '买入开多' : '卖出开空') : `${f.direction === '0' ? '买入平空' : '卖出平多'}${f.offset === '3' ? ' · 平今' : f.offset === '4' ? ' · 平昨' : ''}`

export function TradeStatistics({ initialTab = 'summary' }: { initialTab?: 'summary' | 'fills' } = {}) {
  const { data, error } = useTradeStatistics()
  const [tab, setTab] = useState<'summary' | 'fills'>(initialTab)
  const [symbol, setSymbol] = useState('')
  const [page, setPage] = useState(0)
  if (!data) return <div className="fv-empty">{error || '正在读取柜台成交与持仓…'}</div>
  const fills = data.fills.filter(f => !symbol || f.symbol === symbol)
  const pages = Math.max(1, Math.ceil(fills.length / 20)); const shownPage = Math.min(page, pages - 1)
  return <section className="fv-trade-statistics" aria-label="成交与盈亏统计">
    <div className="fv-statistics-caption">PandaAI 模拟赛 · 统计日期 {data.day} · 金额单位：元 · 每 5 秒刷新</div>
    {error && <p role="status" className="fv-runtime-note">{error}，以下保留上次数据。</p>}
    <div className="fv-pnl-cards">
      <div><small>AI 交易员平仓净盈亏</small><strong>{pnl(data.summary.realized_net)}</strong></div>
      <div><small>AI 交易员浮盈估算</small><strong>{pnl(data.summary.floating_gross)}</strong></div>
      <div><small>确认成交笔数</small><strong>{data.summary.fill_count}</strong></div>
    </div>
    <div className="fv-statistics-toolbar">
      <button type="button" aria-pressed={tab === 'summary'} onClick={() => setTab('summary')}>盈亏汇总</button>
      <button type="button" aria-pressed={tab === 'fills'} onClick={() => setTab('fills')}>成交明细（{data.fills.length}）</button>
      {tab === 'fills' && <select aria-label="成交合约筛选" value={symbol} onChange={e => { setSymbol(e.target.value); setPage(0) }}><option value="">全部合约</option>{data.rows.map(r => <option key={r.symbol}>{r.symbol}</option>)}</select>}
    </div>
    <div className="fv-statistics-scroll">
      {tab === 'summary' ? <ResizableNativeTable resizeStorageKey="fly-pnl-summary"><thead><tr><th>合约</th><th>开仓 / 平仓手数</th><th>当前持仓</th><th>持仓均价</th><th>最新价</th><th>平仓净盈亏</th><th>手续费</th><th>浮盈估算</th><th>合计毛盈亏</th></tr></thead><tbody>{data.rows.map(r => <tr key={r.symbol}>
        <td><button type="button" className="fv-contract-link" onClick={() => { setSymbol(r.symbol); setPage(0); setTab('fills') }}>{r.symbol}</button></td>
        <td>{r.opening_lots} / {r.closing_lots}</td><td>{r.long || r.short ? `多 ${r.long} / 空 ${r.short}` : '空仓'}</td>
        <td>{r.long ? fmt(r.long_entry) : r.short ? fmt(r.short_entry) : '—'}</td><td>{fmt(r.last_price)}{r.valuation_stale && <small>末次报价</small>}</td>
        <td>{pnl(r.realized_net)}{r.pending_net_count > 0 && <small>{r.pending_net_count} 笔待核算</small>}</td><td>{fmt(r.commission)}</td><td>{pnl(r.floating_gross)}{!r.position_reconciled && <small>持仓核对中</small>}</td><td>{pnl(r.total_gross)}</td>
      </tr>)}</tbody></ResizableNativeTable> : <ResizableNativeTable resizeStorageKey="fly-fill-details"><thead><tr><th>时间</th><th>合约</th><th>成交操作</th><th>手数</th><th>成交价</th><th>平仓净盈亏</th><th>手续费</th><th>成交编号</th><th>决策编号</th></tr></thead><tbody>{fills.slice(shownPage * 20, (shownPage + 1) * 20).map(f => <tr key={f.seq}>
        <td>{f.time}{f.time_source === 'receipt' && <small>回报时间</small>}</td><td>{f.symbol}</td><td>{action(f)}</td><td>{f.volume}</td><td>{fmt(f.price)}</td><td>{f.offset === '0' ? '—' : f.realized_net == null ? '待核算' : pnl(f.realized_net)}{f.unmatched_closing_lots > 0 && <small>缺少开仓记录</small>}</td><td>{f.commission == null ? '待回报' : fmt(f.commission)}</td><td title={f.order}>{f.trade_id}</td><td title={f.decision_id}>{f.decision_id.slice(0, 10) || '待核对'}</td>
      </tr>)}{!fills.length && <tr><td colSpan={9}>所选合约暂无柜台成交记录</td></tr>}</tbody></ResizableNativeTable>}
    </div>
    {tab === 'fills' && <div className="fv-statistics-pagination"><span>{fills.length} 笔 · 第 {shownPage + 1} / {pages} 页</span><button type="button" disabled={shownPage === 0} onClick={() => setPage(shownPage - 1)}>上一页</button><button type="button" disabled={shownPage + 1 >= pages} onClick={() => setPage(shownPage + 1)}>下一页</button></div>}
    <small className="fv-note">平仓净盈亏已扣对应开仓与平仓手续费；当日手续费包含尚未平仓的开仓费用。浮盈与合计毛盈亏为扣费前估算。</small>
    <details className="fv-data-details"><summary>比赛账户汇总与统计口径</summary><div className="fv-pnl-cards">
      <div><small>柜台账户权益</small><strong>{fmt(data.official.Balance)}</strong></div>
      <div><small>柜台今日净盈亏</small><strong>{pnl(data.official.day_net)}</strong></div>
      <div><small>柜台今日手续费</small><strong>{fmt(data.official.Commission)}</strong></div>
    </div><small className="fv-note">{data.note} 柜台今日净盈亏＝柜台平仓盈亏＋持仓盈亏－手续费；报价与柜台刷新时间不同，数值可能暂有差异。</small></details>
  </section>
}
