import { ArrowLeftIcon, ArrowRightIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { useTradeStatistics, type StatisticValue } from './useTradeStatistics.ts'

export type TraderActivity = { id: string | number; at: number; title: string; detail: string }
const money = (value: StatisticValue | undefined) => value == null || !Number.isFinite(value) ? '—'
  : `${value > 0 ? '+' : ''}${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const tone = (value: StatisticValue | undefined) => value == null || value === 0 ? '' : value > 0 ? 'fv-profit' : 'fv-loss'

export function TraderOverview({ activities, onRecords, onManage }: {
  activities: TraderActivity[]; onRecords: () => void; onManage: () => void
}) {
  const [selectedDay, setSelectedDay] = useState('')
  const { data, error } = useTradeStatistics(selectedDay)
  const [view, setView] = useState<'positions' | 'fills'>('positions')
  const [symbol, setSymbol] = useState('')
  const [page, setPage] = useState(0)
  const fills = data?.fills.filter(fill => !symbol || fill.symbol === symbol) ?? []
  const commission = !symbol ? data?.summary.commission : !data || fills.some(fill => fill.commission == null)
    ? null : fills.reduce((total, fill) => total + (fill.commission ?? 0), 0)
  const pages = Math.max(1, Math.ceil(fills.length / 20)), shownPage = Math.min(page, pages - 1)
  const positions = data?.rows.filter(row => row.long > 0 || row.short > 0) ?? []
  const unresolved = positions.filter(row => !row.position_reconciled || row.floating_gross == null).length
  const stale = positions.some(row => row.valuation_stale)
  const day = data?.day.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3')
  return <section className="qs-trader-overview" aria-label="交易员概览">
    {error && <p role="status" className="fv-runtime-note">{error}{data ? '，以下保留上次统计。' : '，恢复后自动更新。'}</p>}
    <dl className="qs-trader-metrics">
      <div><dt>平仓净盈亏</dt><dd className={tone(data?.summary.realized_net)}>{money(data?.summary.realized_net)}<small>元</small></dd><p>{data?.summary.pending_net_count ? `${data.summary.pending_net_count} 笔待核算 · 暂不汇总` : '已扣对应开仓与平仓手续费'}</p></div>
      <div><dt>持仓浮盈 · 估算</dt><dd className={tone(data?.summary.floating_gross)}>{money(data?.summary.floating_gross)}<small>元</small></dd><p>{unresolved ? `${unresolved} 个合约待估值` : stale ? '按末次报价估算' : '按开仓价与报价估算'}</p></div>
      <div><dt>{selectedDay ? '所选日期成交' : '当日成交'}</dt><dd>{data?.summary.fill_count ?? '—'}<small>笔</small></dd><p>{day ? `${data?.date_basis === 'trading_day' ? '交易日' : '统计日期'} ${day}` : '正在读取成交记录'}</p></div>
    </dl>
    <div className="qs-trader-summary-grid" data-view={view}>
      {view === 'positions' ? <section className="qs-trader-positions" aria-label="当前持仓">
        <header><h2>当前持仓</h2><span>{data ? `${positions.length} 个合约` : '读取中'}</span><button type="button" className="qs-overview-link" onClick={onManage}>管理合约</button></header>
        <div className="qs-positions-scroll">
          <table><thead><tr><th scope="col">合约</th><th scope="col">方向</th><th scope="col">手数</th><th scope="col">浮盈</th></tr></thead>
            <tbody>{positions.map(row => <tr key={row.symbol}>
              <th scope="row">{row.symbol}</th>
              <td><span className="qs-position-side">{row.long && row.short ? '多 / 空' : row.long ? '多' : '空'}</span></td>
              <td>{row.long && row.short ? `${row.long} / ${row.short}` : row.long || row.short}</td>
              <td><span className={tone(row.floating_gross)}>{money(row.floating_gross)}</span>{!row.position_reconciled ? <small>持仓核对中</small> : row.floating_gross == null ? <small>等待估值</small> : row.valuation_stale && <small>末次报价</small>}</td>
            </tr>)}{!positions.length && <tr><td colSpan={4} className="qs-position-empty">{data ? '当前空仓，成交后会显示在这里。' : error ? '暂时无法读取持仓' : '正在读取持仓…'}</td></tr>}</tbody>
          </table>
        </div>
        <button type="button" className="qs-overview-link qs-overview-more" onClick={() => setView('fills')}>查看成交记录<ArrowRightIcon size={16}/></button>
      </section> : <section className="qs-trader-fills" aria-label="成交明细">
        <header><h2>成交明细</h2><span>{data ? `${fills.length} 笔` : '读取中'}</span></header>
        <div className="qs-fills-toolbar"><span>{symbol ? '所选合约手续费' : '手续费合计'} <strong>{commission == null ? '待核算' : `${commission.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 元`}</strong></span>
          <input type="date" aria-label="成交日期" value={selectedDay || day || ''} onChange={e => { setSelectedDay(e.target.value); setPage(0) }}/>
          <select aria-label="成交合约筛选" value={symbol} onChange={e => { setSymbol(e.target.value); setPage(0) }}><option value="">全部合约</option>{data?.rows.map(row => <option key={row.symbol} value={row.symbol}>{row.symbol}</option>)}</select>
        </div>
        <div className="qs-positions-scroll qs-fills-scroll" tabIndex={0} role="region" aria-label="成交明细，可横向滚动">
          <table><thead><tr><th scope="col">时间</th><th scope="col">合约</th><th scope="col">操作</th><th scope="col">手数</th><th scope="col">成交价</th><th scope="col">手续费</th><th scope="col">平仓净盈亏<small className="qs-fills-fee-note">已扣开仓及平仓手续费</small></th></tr></thead>
            <tbody>{fills.slice(shownPage * 20, (shownPage + 1) * 20).map(fill => <tr key={fill.seq}>
              <td title={`${fill.time}${fill.time_source === 'receipt' ? ' · 回报时间' : ''}`}>{fill.time.match(/\d{2}:\d{2}:\d{2}/)?.[0] ?? fill.time}</td><th scope="row">{fill.symbol}</th>
              <td>{fill.offset === '0' ? fill.direction === '0' ? '开多' : '开空' : fill.direction === '0' ? '平空' : '平多'}{fill.offset === '3' ? ' · 今' : fill.offset === '4' ? ' · 昨' : ''}</td><td>{fill.volume}</td><td>{fill.price.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
              <td>{fill.commission == null ? '待回报' : fill.commission.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
              <td title={fill.offset !== '0' && fill.opening_commission != null ? `已扣开仓手续费 ${fill.opening_commission.toFixed(4)} 元及本笔平仓手续费` : undefined}><span className={tone(fill.realized_net)}>{fill.offset === '0' ? '—' : fill.realized_net == null ? '待核算' : money(fill.realized_net)}</span>{fill.unmatched_closing_lots > 0 && <small>缺少开仓记录</small>}</td>
            </tr>)}{!fills.length && <tr><td colSpan={7} className="qs-position-empty">{data ? '当前合约暂无成交' : '正在读取成交…'}</td></tr>}</tbody>
          </table>
        </div>
        {pages > 1 && <div className="fv-statistics-pagination"><span>第 {shownPage + 1} / {pages} 页</span><button type="button" disabled={shownPage === 0} onClick={() => setPage(shownPage - 1)}>上一页</button><button type="button" disabled={shownPage + 1 >= pages} onClick={() => setPage(shownPage + 1)}>下一页</button></div>}
        <p className="qs-fills-note">净盈亏已扣对应开仓与平仓手续费。费用或开仓记录不全时显示「待核算」。</p>
        <button type="button" className="qs-overview-link qs-overview-more" onClick={() => { setView('positions'); setSelectedDay('') }}><ArrowLeftIcon size={16}/>返回持仓</button>
      </section>}
      {view === 'positions' && <section className="qs-trader-activity" aria-label="最近动作">
        <header><h2>最近动作</h2></header>
        {activities.length ? <ol>{activities.slice(0, 3).map(item => <li key={item.id}>
          <time dateTime={new Date(item.at * 1000).toISOString()}>{new Date(item.at * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' })}</time>
          <div><strong>{item.title}</strong><p title={item.detail}>{item.detail}</p></div>
        </li>)}</ol> : <p className="qs-activity-empty">还没有交易动作，启动后在这里查看。</p>}
        <button type="button" className="qs-overview-link qs-overview-more" onClick={onRecords}>查看工作记录<ArrowRightIcon size={16}/></button>
      </section>}
    </div>
  </section>
}
