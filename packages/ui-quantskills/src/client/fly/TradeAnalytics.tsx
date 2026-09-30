import { products } from '@deepseek-ai/dsh-quantskills-session/contracts'
import { flyFetch } from './transport.ts'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowClockwise, ArrowDown, ChartLine, SlidersHorizontal, CalendarBlank, CaretDown, Info } from '@phosphor-icons/react'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import ResizableNativeTable from './FlyTable.tsx'
import './trade-analytics.css'
import { useChartPalette, type ChartPalette } from './useChartPalette'
import { installChartPointerCoordinates } from './chart-pointer'

type Period = 'raw' | '1m' | '3m' | '5m' | '1h' | '1d'
type DetailView = 'fills' | 'periods' | 'activity' | 'trader'
type NetPnl = { realized_net: number | null; cumulative_net: number | null; realized_equity: number | null }
type Sample = NetPnl & { day: string; at: number; Balance: number; CloseProfit: number | null; Commission: number | null; drawdown: number; drawdown_pct: number | null; day_net: number | null; source: string; gap_before: boolean }
type Bucket = NetPnl & { at: number; label: string; day: string; observed_at: number | null; Balance: number | null; drawdown: number | null; worst_drawdown: number | null; sample_count: number; fill_count: number; closing_fills: number; win_rate: number | null; realized_gross: number | null; cumulative_gross: number | null; gap_before: boolean; contains_gap: boolean }
type Gap = { from: number; to: number; seconds: number }
type Close = { trading_day: string; seq: number; at: number; time: string; time_source: string; symbol: string; trade_id: string; realized_gross: number | null; cumulative_gross: number | null }
type Fill = Close & { direction: string; offset: string; volume: number; price: number }
type Product = { symbol: string; product: string; fill_count: number; realized_gross: number | null }
type Analytics = {
  day: string; start_day: string; end_day: string; period: Period; days: string[]; generated_at: number; account_at: number | null; account_stale: boolean
  official: { Balance: number | null; CloseProfit: number | null; PositionProfit: number | null; Commission: number | null; day_net: number | null }
  summary: { fills: number; closing_fills: number; matched_closes: number; unmatched_closes: number; wins: number; losses: number; breakeven: number; win_rate: number | null; profit_factor: number | null; realized_gross: number | null; max_drawdown: number | null; max_drawdown_pct: number | null }
  coverage: { samples: number; first_at: number | null; last_at: number | null; gaps: number; observation_samples: number; cash_flow_unknown: boolean; cash_flow_changed: boolean; pnl_samples?: number; pnl_first_at?: number | null }
  equity: Sample[]; realized_curve: Close[]; products: Product[]; fills: Fill[]; note: string
  periods: Bucket[]; gaps: Gap[]; period_summary: { recorded_days: number; realized_net: number | null; day_net: number | null; CloseProfit: number | null; PositionProfit: number | null; Commission: number | null }
  equity_baseline: { value: number | null; at: number | null; method: string }
}
const periodNames: Record<Period, string> = { raw: '原始采样', '1m': '1 分钟', '3m': '3 分钟', '5m': '5 分钟', '1h': '1 小时', '1d': '日线' }
const dateInput = (day: string) => `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6)}`
const moveDay = (day: string, offset: number) => { const d = new Date(`${dateInput(day)}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10).replace(/-/g, '') }
const names: Record<string, string> = Object.fromEntries(products.flatMap(p => [[p.product, p.name], [p.product.toUpperCase(), p.name]]))
const fmt = (v: number | null | undefined, digits = 2) => v == null ? '—' : v.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
const money = (v: number | null | undefined) => `${v != null && v > 0 ? '+' : ''}${fmt(v)}`
const clock = (at: number | null) => at == null ? '尚未记录' : new Date(at * 1000).toLocaleTimeString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' })
const stamp = (at: number | null) => at == null ? '尚未记录' : new Date(at * 1000).toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' })
const tone = (value: number | null | undefined) => value == null || value === 0 ? '' : value > 0 ? 'positive' : 'negative'

function baseOption(colors: ChartPalette): EChartsOption {
  return {
    animation: false, backgroundColor: 'transparent', color: [colors.equity, colors.profit, colors.loss],
    textStyle: { fontFamily: 'Inter, "Microsoft YaHei", sans-serif', color: colors.text, fontSize: 11 },
    aria: { enabled: true },
    tooltip: { trigger: 'axis', renderMode: 'richText', backgroundColor: colors.surface, borderColor: colors.grid, textStyle: { color: colors.text, fontSize: 11 }, valueFormatter: value => typeof value === 'number' ? fmt(value) : String(value ?? '—') },
    grid: { left: 15, right: 23, top: 25, bottom: 25, containLabel: true },
    xAxis: { type: 'category', axisLine: { lineStyle: { color: colors.grid } }, axisTick: { show: false }, axisLabel: { color: colors.muted, hideOverlap: true } },
    yAxis: { type: 'value', scale: true, axisLabel: { color: colors.muted }, splitLine: { lineStyle: { color: colors.grid, type: 'dashed' } } },
  }
}

function equityOption(points: (Sample | Bucket)[], field: 'Balance' | 'drawdown' | 'cumulative_net' | 'realized_equity', period: Period, bridge: boolean, gaps: Gap[], multiDay: boolean, colors: ChartPalette): EChartsOption {
  // Old snapshots may contain balances only. Keep interior gaps, but start the
  // net chart at its first actual P&L observation instead of hours of nulls.
  if (field === 'cumulative_net' || field === 'realized_equity') {
    const start = points.findIndex(p => p[field] != null)
    if (start >= 0) points = points.slice(start)
    gaps = gaps.filter(g => points[0] && g.from >= points[0].at)
  }
  const data: [number, number | null][] = []
  const bridges: [number, number | null][] = []
  let previous: (Sample | Bucket) | undefined
  points.forEach(p => {
    if (p.gap_before && previous) {
      data.push([(previous.at + p.at) * 500, null])
      if (bridge) bridges.push([previous.at * 1000, previous[field]], [p.at * 1000, p[field]], [p.at * 1000, null])
    }
    data.push([p.at * 1000, p[field]])
    if (p[field] != null) previous = p
  })
  return {
    ...baseOption(colors),
    grid: { left: 18, right: 25, top: 25, bottom: 54, containLabel: true },
    xAxis: { type: 'time', minInterval: period === '1d' ? 86400000 : 0, axisLine: { lineStyle: { color: colors.grid } }, axisLabel: { color: colors.muted, hideOverlap: true, formatter: value => period === '1d' ? new Date(Number(value)).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }) : `${multiDay ? new Date(Number(value)).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })+'\n' : ''}${clock(Number(value) / 1000)}` } },
    yAxis: { type: 'value', scale: field !== 'cumulative_net',
      ...(field === 'realized_equity' ? { min: ({ min, max }: { min: number; max: number }) => min - Math.max((max - min) * .1, Math.abs(max) * .00001, 1), max: ({ min, max }: { min: number; max: number }) => max + Math.max((max - min) * .1, Math.abs(max) * .00001, 1) } : {}),
      axisLabel: { color: colors.muted, formatter: value => field === 'Balance' ? `${(value / 10000).toFixed(2)}万` : fmt(value, 0) }, splitLine: { lineStyle: { color: colors.grid, type: 'dashed' } } },
    dataZoom: [{ type: 'inside', zoomOnMouseWheel: 'ctrl' }, { type: 'slider', height: 17, bottom: 8, borderColor: colors.grid, textStyle: { color: colors.muted }, fillerColor: colors.grid, handleStyle: { color: colors.equity } }],
    series: [{ name: field === 'Balance' ? '账户权益（元）' : field === 'realized_equity' ? '固定基准＋累计平仓净盈亏（元）' : field === 'cumulative_net' ? '累计平仓净盈亏（已扣手续费 / 元）' : '距采样峰值（元）', type: 'line', data, step: field === 'cumulative_net' || field === 'realized_equity' ? 'end' : false, connectNulls: false, smooth: false, showSymbol: true, symbolSize: points.length < 3 ? 7 : 3,
      lineStyle: { width: 2, color: field !== 'drawdown' ? colors.equity : colors.loss }, itemStyle: { color: field !== 'drawdown' ? colors.equity : colors.loss },
      areaStyle: { color: field !== 'drawdown' ? colors.equity : colors.loss, opacity: .08 },
      markArea: ['raw', '1m', '3m', '5m'].includes(period) ? { silent: true, itemStyle: { color: colors.warning, opacity: .1 }, label: { color: colors.warning, fontSize: 10 }, data: gaps.map(g => [{ name: '无采样', xAxis: g.from * 1000 }, { xAxis: g.to * 1000 }]) } : { data: [] } },
      { name: '缺口连接（非采样）', type: 'line', data: bridges, connectNulls: false, showSymbol: false, lineStyle: { type: 'dashed', color: colors.warning, width: 1.5 }, itemStyle: { color: colors.warning } }],
  }
}

function Chart({ title, subtitle, option, empty, controls }: { title: string; subtitle: string; option: EChartsOption; empty?: string | undefined; controls?: ReactNode }) {
  const host = useRef<HTMLDivElement>(null)
  const instance = useRef<echarts.ECharts>()
  useEffect(() => {
    if (!host.current || empty) return
    const chart = echarts.init(host.current, undefined, { renderer: 'canvas' })
    const removePointerCoordinates = installChartPointerCoordinates(host.current, () => ({
      element: chart.getZr().painter.getViewportRoot(), width: chart.getWidth(), height: chart.getHeight(),
    }))
    instance.current = chart
    const resize = new ResizeObserver(() => chart.resize())
    resize.observe(host.current)
    return () => { removePointerCoordinates(); resize.disconnect(); chart.dispose(); instance.current = undefined }
  }, [empty])
  useEffect(() => { instance.current?.setOption(option, { replaceMerge: ['series'] }) }, [option, empty])
  return <section className={`fv-analysis-chart${empty ? ' is-empty' : ''}`}>
    <header><div><h3>{title}</h3><p>{subtitle}</p></div>{controls}</header>
    {/* ECharts owns the canvas host's children; never reuse it for React's empty state. */}
    {empty ? <div key="empty" className="fv-analysis-empty"><ChartLine size={28} weight="light" aria-hidden="true"/><strong>暂无可绘制数据</strong><p>{empty}</p></div> : <div key="chart" className="fv-analysis-canvas" ref={host} role="img" aria-label={`${title}。${subtitle}`} />}
  </section>
}

export function TradeAnalytics({ active, traderDetails }: { active: boolean; traderDetails?: ReactNode }) {
  const { ref: paletteRef, palette: colors } = useChartPalette()
  const [data, setData] = useState<Analytics>()
  const [range, setRange] = useState({ start: '', end: '' })
  const [draft, setDraft] = useState({ start: '', end: '' })
  const [period, setPeriod] = useState<Period>('1m')
  const [bridge, setBridge] = useState(false)
  const [preset, setPreset] = useState('单日')
  const [customDates, setCustomDates] = useState(false)
  const [displaySettings, setDisplaySettings] = useState(false)
  const [detailView, setDetailView] = useState<DetailView>('fills')
  const detailId = useId()
  const [curve, setCurve] = useState<'net' | 'equity' | 'drawdown'>('net')
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [page, setPage] = useState(0)
  const [bucketPage, setBucketPage] = useState(0)
  const applyRange = (start: string, end: string, selection = '自定义') => {
    if (!start || !end || start > end) { setError('请选择有效日期范围，开始日期不能晚于结束日期'); return }
    if (start < moveDay(end, -366)) { setError('每次最多查看一年，请缩小日期范围'); return }
    setRange({ start, end }); setDraft({ start, end }); setPage(0); setBucketPage(0); setData(undefined); setError(''); setPreset(selection); setCustomDates(false)
  }
  useEffect(() => {
    if (!active) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    const controller = new AbortController()
    const refresh = async () => {
      try {
        const query = new URLSearchParams({ period, start_day: range.start, end_day: range.end })
        const response = await flyFetch(`/api/fly/v2/analytics?${query}`, { signal: controller.signal })
        if (!response.ok) throw new Error('交易分析暂时无法刷新')
        const result = await response.json() as Analytics
        if (!stopped) { setData(result); setError(''); setDraft(d => d.start && d.end ? d : { start: result.start_day, end: result.end_day }) }
      } catch (e) { if (!stopped) setError(e instanceof Error ? e.message : '连接暂不可用') }
      if (!stopped) timer = setTimeout(() => void refresh(), 15000)
    }
    void refresh()
    return () => { stopped = true; clearTimeout(timer); controller.abort() }
  }, [range, period, active, reload])
  const charts = useMemo(() => {
    if (!data) return null
    const s = data.summary
    const products = data.products
    const closes = data.realized_curve
    const raw = data.period === 'raw'
    const groups = data.periods
    const categories = raw ? closes.map(c => `${c.time}\n${c.symbol}`) : groups.map(g => g.label)
    const equity = raw ? data.equity : groups.filter(g => g.Balance != null)
    const drawdown = raw ? data.equity : groups.filter(g => g.worst_drawdown != null).map(g => ({ ...g, drawdown: g.worst_drawdown }))
    const base = baseOption(colors)
    return {
      equity: equityOption(equity, 'Balance', data.period, bridge, data.gaps, data.start_day !== data.end_day, colors), drawdown: equityOption(drawdown, 'drawdown', data.period, bridge, data.gaps, data.start_day !== data.end_day, colors),
      products: { ...base, xAxis: { ...base.xAxis, axisLabel: { color: colors.muted, interval: 0, fontSize: 10 }, data: products.map(p => `${p.product}\n${names[p.product] || p.product}`) }, series: [{ name: '已实现毛盈亏（元）', type: 'bar', barMaxWidth: 38, data: products.map(p => ({ value: p.realized_gross, itemStyle: { color: (p.realized_gross ?? 0) >= 0 ? colors.profit : colors.loss, borderRadius: [4, 4, 0, 0] } })), label: { show: true, position: 'top', color: colors.text, fontSize: 10, formatter: p => typeof p.value === 'number' ? fmt(p.value, 0) : '—' } }] } as EChartsOption,
      cumulative: equityOption(equity, 'cumulative_net', data.period, bridge, data.gaps, data.start_day !== data.end_day, colors),
      realizedEquity: equityOption(equity, 'realized_equity', data.period, bridge, data.gaps, data.start_day !== data.end_day, colors),
      distribution: { ...base, xAxis: [], yAxis: [], tooltip: { ...base.tooltip, trigger: 'item' }, legend: { bottom: 15, textStyle: { color: colors.text } }, series: [{ name: '平仓成交笔数', type: 'pie', radius: ['45%', '68%'], center: ['50%', '44%'], label: { color: colors.text, formatter: '{b}\n{c} 笔' }, data: [{ name: '盈利', value: s.wins, itemStyle: { color: colors.profit } }, { name: '亏损', value: s.losses, itemStyle: { color: colors.loss } }, { name: '持平', value: s.breakeven, itemStyle: { color: colors.muted } }].filter(p => p.value > 0) }] } as EChartsOption,
      closes: { ...base, xAxis: { ...base.xAxis, data: categories }, series: [{ name: raw ? '本次平仓毛盈亏（元）' : '周期平仓毛盈亏（元）', type: 'bar', barMaxWidth: 32, data: (raw ? closes : groups).map(c => ({ value: c.realized_gross, itemStyle: { color: (c.realized_gross ?? 0) >= 0 ? colors.profit : colors.loss } })) }] } as EChartsOption,
      activity: { ...base, xAxis: { ...base.xAxis, data: groups.map(g => g.label) }, yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: colors.grid } } }, series: [{ name: '成交笔数', type: 'bar', data: groups.map(g => g.fill_count), itemStyle: { color: colors.blue }, barMaxWidth: 30 }] } as EChartsOption,
    }
  }, [data, bridge, colors])
  const s = data?.summary
  const detailTabs: { key: DetailView; label: string }[] = [
    { key: 'fills', label: '成交明细' },
    ...(data?.period !== 'raw' ? [{ key: 'periods' as const, label: '周期统计' }] : []),
    { key: 'activity', label: '成交节奏' },
    ...(traderDetails ? [{ key: 'trader' as const, label: '当日盈亏' }] : []),
  ]
  const selectedDetail = detailTabs.some(t => t.key === detailView) ? detailView : 'fills'
  const exportData = () => {
    if (!data) return
    const rows: (string | number | null)[][] = [['类别', '交易日', '时间（上海）', '合约', '数值（元）', '来源或口径']]
    data.equity.forEach(p => rows.push(['原始权益', p.day, new Date(p.at * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }), '', p.Balance, p.source === 'counter' ? '正式柜台快照' : '历史验收观测（记录时间）']))
    data.equity.forEach(p => rows.push(['累计平仓净盈亏', p.day, stamp(p.at), '', p.cumulative_net, `整个 PandaAI 模拟赛 账户；按有记录交易日累计；当日平仓盈亏 ${fmt(p.CloseProfit)} − 当日手续费 ${fmt(p.Commission)}；不含浮盈`]))
    data.equity.forEach(p => rows.push(['平仓权益曲线', p.day, stamp(p.at), '', p.realized_equity, `固定基准 ${fmt(data.equity_baseline?.value)} ＋ 累计平仓净盈亏；已扣手续费；非账户实时权益`]))
    data.realized_curve.forEach(c => rows.push(['平仓毛盈亏', c.trading_day, c.time, c.symbol, c.realized_gross, `${c.time_source === 'counter' ? '柜台时间' : '回报接收时间'}；成交 ${c.trade_id}；未扣费用`]))
    data.products.forEach(p => rows.push(['品种毛盈亏', `${data.start_day}—${data.end_day}`, '', p.symbol, p.realized_gross, 'AI 交易员成交；未扣费用']))
    data.periods.forEach(g => { rows.push([`${periodNames[data.period]}末次权益`, g.day, g.label, '', g.Balance, `真实采样 ${g.sample_count} 条；末次观测 ${stamp(g.observed_at)}`]); rows.push([`${periodNames[data.period]}毛盈亏`, g.day, g.label, '', g.realized_gross, `成交 ${g.fill_count} 笔；平仓 ${g.closing_fills} 笔；毛胜率 ${fmt(g.win_rate)}%`]) })
    data.periods.forEach(g => rows.push([`${periodNames[data.period]}累计平仓净盈亏`, g.day, g.label, '', g.cumulative_net, `整个 PandaAI 模拟赛 账户；已扣开平仓手续费；不含浮盈；末次观测 ${stamp(g.observed_at)}`]))
    data.periods.forEach(g => rows.push([`${periodNames[data.period]}平仓权益曲线`, g.day, g.label, '', g.realized_equity, `固定基准 ${fmt(data.equity_baseline?.value)} ＋ 累计平仓净盈亏；非账户实时权益`]))
    rows.push(['累计平仓净盈亏', `${data.start_day}—${data.end_day}`, stamp(data.account_at), '', data.period_summary.realized_net, `整个 PandaAI 模拟赛 账户；${data.period_summary.recorded_days} 个有记录交易日；已扣开平仓手续费；不含浮盈`])
    rows.push(['有记录交易日净收益', `${data.start_day}—${data.end_day}`, stamp(data.account_at), '', data.period_summary.day_net, `累计 ${data.period_summary.recorded_days} 个有记录交易日的末次日内净收益；含持仓浮盈亏`])
    const csv = rows.map(row => row.map(v => `"${String(v ?? '').replace(/^[=+@]/, "'$&").replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = `小果-交易分析-${data.start_day}-${data.end_day}-${data.period}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <section ref={paletteRef} className="fv-analysis" aria-label="交易分析看板">
    <header className="fv-analysis-heading">
      <div><h2>交易表现</h2><p>账户收益与交易员表现，一处查看。</p></div>
      <div className="fv-analysis-tools">
        <button type="button" onClick={() => setReload(v => v + 1)}><ArrowClockwise size={15} aria-hidden="true"/>刷新</button>
        <button type="button" disabled={!data} onClick={exportData}><ArrowDown size={15} aria-hidden="true"/>导出 CSV</button>
      </div>
    </header>
    <div className="fv-analysis-controls">
      <div className="fv-analysis-toolbar">
        <div className="fv-analysis-presets" role="group" aria-label="交易日期范围">
          {(['单日', '近 7 日', '近 30 日', '全部记录'] as const).map((label, index) => <button type="button" key={label} aria-pressed={preset === label} disabled={!data} onClick={() => {
            if (!data) return
            const end = data.days[0] || data.day
            const earliest = data.days[data.days.length - 1] || end
            const offset = [0, 6, 29, -1][index]!
            applyRange(offset < 0 ? (earliest < moveDay(end, -366) ? moveDay(end, -366) : earliest) : moveDay(end, -offset), end, label)
          }}>{label}</button>)}
        </div>
        <button className="fv-analysis-date-button" type="button" aria-expanded={customDates} onClick={() => setCustomDates(v => !v)}>
          <CalendarBlank size={15} aria-hidden="true"/>{data ? data.start_day === data.end_day ? dateInput(data.start_day) : `${dateInput(data.start_day)} — ${dateInput(data.end_day)}` : '自定义日期'}<CaretDown size={12} aria-hidden="true"/>
        </button>
        <div className="fv-analysis-display">
          <label>周期<select aria-label="图表周期" value={period} onChange={e => { setPeriod(e.target.value as Period); setBucketPage(0); setData(undefined) }}>{(Object.keys(periodNames) as Period[]).map(p => <option key={p} value={p}>{periodNames[p]}</option>)}</select></label>
          <button type="button" aria-label="图表显示设置" aria-expanded={displaySettings} onClick={() => setDisplaySettings(v => !v)}><SlidersHorizontal size={17} aria-hidden="true"/></button>
        </div>
      </div>
      {customDates && <form className="fv-date-range" onSubmit={e => {
        e.preventDefault()
        const values = new FormData(e.currentTarget)
        applyRange(String(values.get('start') || '').replace(/-/g, ''), String(values.get('end') || '').replace(/-/g, ''))
      }}>
        <label>开始交易日<input name="start" required type="date" aria-label="开始交易日" value={draft.start ? dateInput(draft.start) : ''} onChange={e => setDraft(d => ({ ...d, start: e.target.value.replace(/-/g, '') }))}/></label>
        <span>至</span><label>结束交易日<input name="end" required type="date" aria-label="结束交易日" value={draft.end ? dateInput(draft.end) : ''} onChange={e => setDraft(d => ({ ...d, end: e.target.value.replace(/-/g, '') }))}/></label>
        <button className="fv-analysis-apply" type="submit">应用日期</button><button type="button" onClick={() => setCustomDates(false)}>取消</button>
      </form>}
      {displaySettings && <div className="fv-analysis-display-settings"><label>权益缺口<select aria-label="权益缺口显示" value={bridge ? 'bridge' : 'break'} onChange={e => setBridge(e.target.value === 'bridge')}><option value="break">保留空白</option><option value="bridge">虚线连接（非采样）</option></select></label><span>只调整曲线显示，不改变统计结果。</span></div>}
    </div>
    {error && <div className="fv-analysis-alert" role="status">{error}{data ? '，以下保留上次成功结果。' : ''}</div>}
    {!data || !s || !charts ? <div className="fv-analysis-empty" role="status"><ChartLine size={28} aria-hidden="true"/><p>{error ? '暂未读取到分析数据，请稍后刷新。' : '正在读取账户权益与成交记录…'}</p></div> : <>
      <div className="fv-analysis-metrics">
        <div><span>账户平仓净盈亏</span><strong className={data.period_summary.realized_net == null ? 'is-pending' : tone(data.period_summary.realized_net)}>{data.period_summary.realized_net == null ? '待补齐' : money(data.period_summary.realized_net)}</strong><small>已扣开平仓手续费 · 不含浮盈</small></div>
        <div><span>账户区间净收益</span><strong className={data.period_summary.day_net == null ? 'is-pending' : tone(data.period_summary.day_net)}>{data.period_summary.day_net == null ? '待补齐' : money(data.period_summary.day_net)}</strong><small>已扣费 · 含浮盈 · {data.period_summary.recorded_days} 个有记录交易日</small></div>
        <div><span>账户最大回撤</span><strong>{fmt(s.max_drawdown)}</strong><small>{fmt(s.max_drawdown_pct, 3)}% · 按原始采样计算</small></div>
        <div><span>交易员平仓胜率</span><strong>{fmt(s.win_rate, 1)}{s.win_rate != null && <em>%</em>}</strong><small>未扣费 · {s.wins} 盈 / {s.losses} 亏 / {s.breakeven} 平</small></div>
      </div>
      <details className="fv-analysis-quality">
        <summary><span><Info size={15} aria-hidden="true"/>{data.period_summary.realized_net == null ? '部分收益数据待补齐' : '数据与统计口径'}{data.gaps.length > 0 && ` · ${data.gaps.length} 段采样缺口`}</span><span>{s.fills} 笔成交 · 金额单位：元<CaretDown size={13} aria-hidden="true"/></span></summary>
        <div className="fv-analysis-quality-body">
          <p>账户指标包含其他策略和手工交易；品种贡献与胜率只统计 AI 交易员。缺少平仓盈亏或手续费时显示“待补齐”，不按零计算。</p>
          <p>{data.coverage.samples} 个权益采样 · {stamp(data.coverage.first_at)} — {stamp(data.coverage.last_at)}。{s.unmatched_closes > 0 && ` ${s.unmatched_closes} 笔平仓缺少配对数据，未计入胜率。`}{data.coverage.observation_samples > 0 && ` ${data.coverage.observation_samples} 条为历史验收观测，使用记录时间。`}{data.coverage.cash_flow_changed && ' 检测到出入金变化，回撤会受影响。'}</p>
          {data.coverage.pnl_samples != null && data.coverage.pnl_samples < data.coverage.samples && <p>部分历史快照未记录盈亏分项。{data.coverage.pnl_first_at != null ? `完整盈亏记录始于 ${stamp(data.coverage.pnl_first_at)}，此前曲线保留空白；当日汇总使用最新完整数据。` : '当前范围没有完整的账户盈亏快照；已有成交仍可在下方查看。'}</p>}
          {data.gaps.map(g => <p key={g.from}>缺口：{stamp(g.from)} → {stamp(g.to)} · {Math.floor(g.seconds / 60)} 分 {Math.round(g.seconds % 60)} 秒</p>)}
          {data.gaps.length > 0 && <p>缺口期间未记录到权益快照。虚线只连接已知端点，不生成采样，也不改变统计结果。</p>}
          <p>{data.note}</p>
        </div>
      </details>
      <div className="fv-analysis-main">
        <Chart title={curve === 'net' ? '累计平仓净盈亏' : curve === 'equity' ? '平仓权益曲线' : '账户回撤'}
          subtitle={(curve === 'net' ? '整个账户 · 已扣开平仓手续费 · 不含浮盈' : curve === 'equity' ? `固定基准 ${fmt(data.equity_baseline?.value)} 元 ＋ 累计平仓净盈亏 · 已扣费` : '距采样峰值的回撤 · 未调整出入金 · 元') + (curve !== 'drawdown' && data.coverage.pnl_samples != null && data.coverage.pnl_samples < data.coverage.samples && data.coverage.pnl_first_at != null ? ` · 完整记录始于 ${clock(data.coverage.pnl_first_at)}` : '')}
          option={curve === 'net' ? charts.cumulative : curve === 'equity' ? charts.realizedEquity : charts.drawdown}
          empty={curve === 'net' ? (!data.equity.some(p => p.cumulative_net != null) ? '所选范围的历史快照缺少盈亏分项，无法还原累计净收益；可查看有完整记录的单日。' : undefined) : curve === 'equity' ? (!data.equity.some(p => p.realized_equity != null) ? '所选范围首个交易日缺少完整盈亏快照，无法确定权益基准；已有成交可在下方查看。' : undefined) : data.equity.length < 2 ? '至少需要两个真实权益采样。' : undefined}
          controls={<div className="fv-analysis-curve-switch" role="group" aria-label="收益曲线类型">{([['net', '净盈亏'], ['equity', '平仓权益'], ['drawdown', '回撤']] as const).map(([key, label]) => <button type="button" key={key} aria-pressed={curve === key} onClick={() => setCurve(key)}>{label}</button>)}</div>}/>
        <section className="fv-analysis-reconcile">
          <h3>收益拆解</h3><p>整个比赛账户 · {data.period_summary.recorded_days} 个有记录交易日</p>
          <dl>
            <div><dt>平仓盈亏<span>扣费前</span></dt><dd className={tone(data.period_summary.CloseProfit)}>{money(data.period_summary.CloseProfit)}</dd></div>
            <div><dt>减：开仓与平仓手续费</dt><dd>{fmt(data.period_summary.Commission)}</dd></div>
            <div className="total"><dt>平仓净盈亏<span>已扣手续费</span></dt><dd className={tone(data.period_summary.realized_net)}>{money(data.period_summary.realized_net)}</dd></div>
            <div><dt>加：持仓浮盈亏</dt><dd className={tone(data.period_summary.PositionProfit)}>{money(data.period_summary.PositionProfit)}</dd></div>
            <div className="total"><dt>区间净收益</dt><dd className={tone(data.period_summary.day_net)}>{money(data.period_summary.day_net)}</dd></div>
          </dl><small>按有记录交易日累计；缺失项目显示 —。</small>
        </section>
      </div>
      <div className="fv-analysis-section-heading"><h3>成交分析</h3><span>仅 AI 交易员 · 以下为扣费前统计</span></div>
      <div className="fv-analysis-secondary">
        <Chart title="品种盈亏贡献" subtitle="已配对平仓成交 · 未扣手续费" option={charts.products} empty={!s.fills ? '所选范围尚无 AI 交易员成交。' : undefined}/>
        <Chart title="平仓胜负分布" subtitle={`${s.matched_closes} 笔已配对 · 毛利润 / 毛亏损 ${fmt(s.profit_factor)}`} option={charts.distribution} empty={!s.matched_closes ? '尚无可配对的平仓成交。' : undefined}/>
      </div>
      <section className="fv-analysis-ledger" aria-label="交易明细">
        <header className="fv-ledger-heading"><h3>交易明细</h3><span title="每 15 秒读取已保存的分析记录">更新于 {clock(data.generated_at)}</span></header>
        <div className="fv-ledger-tabs" role="tablist" aria-label="明细视图">
          {detailTabs.map(({ key, label }, index) => <button type="button" key={key} id={`${detailId}-${key}`} role="tab" aria-selected={selectedDetail === key} aria-controls={`${detailId}-panel`} tabIndex={selectedDetail === key ? 0 : -1} onClick={() => setDetailView(key)} onKeyDown={e => {
            const next = e.key === 'ArrowRight' ? (index + 1) % detailTabs.length : e.key === 'ArrowLeft' ? (index + detailTabs.length - 1) % detailTabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? detailTabs.length - 1 : -1
            if (next < 0) return
            e.preventDefault(); setDetailView(detailTabs[next]!.key)
            e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
          }}>{label}{key === 'fills' && <span>{s.fills}</span>}</button>)}
        </div>
        <div className="fv-ledger-panel" id={`${detailId}-panel`} role="tabpanel" aria-labelledby={`${detailId}-${selectedDetail}`} tabIndex={0}>
          {selectedDetail !== 'trader' && <div className="fv-ledger-context"><span>{dateInput(data.start_day)}{data.start_day !== data.end_day && ` — ${dateInput(data.end_day)}`}{selectedDetail !== 'fills' && ` · ${periodNames[data.period]}`}</span><span>{selectedDetail === 'periods' ? `${data.periods.length} 个有记录周期 · ` : ''}AI 交易员 · 盈亏未扣手续费</span></div>}
          {selectedDetail === 'fills' && <>
            <div className="fv-statistics-scroll"><ResizableNativeTable resizeStorageKey="fly-analysis-fills"><thead><tr><th>时间</th><th>合约</th><th>动作</th><th>手数</th><th>成交价</th><th>平仓毛盈亏</th><th>成交编号</th></tr></thead><tbody>{data.fills.slice(page * 20, page * 20 + 20).map(f => <tr key={f.seq}><td>{data.start_day !== data.end_day && <small>{dateInput(f.trading_day)}</small>}{f.time}{f.time_source !== 'counter' && <small>回报时间</small>}</td><td>{f.symbol}</td><td>{f.offset === '0' ? (f.direction === '0' ? '开多' : '开空') : (f.direction === '0' ? '平空' : '平多')}</td><td>{f.volume}</td><td>{fmt(f.price)}</td><td className={tone(f.realized_gross)}>{money(f.realized_gross)}</td><td>{f.trade_id}</td></tr>)}{!data.fills.length && <tr><td colSpan={7} className="fv-ledger-empty">所选范围暂无成交记录</td></tr>}</tbody></ResizableNativeTable></div><div className="fv-statistics-pagination"><span>{s.fills} 笔 · 第 {page + 1} / {Math.max(1, Math.ceil(s.fills / 20))} 页</span><button type="button" disabled={!page} onClick={() => setPage(p => p - 1)}>上一页</button><button type="button" disabled={(page + 1) * 20 >= s.fills} onClick={() => setPage(p => p + 1)}>下一页</button></div>
          </>}
          {selectedDetail === 'periods' && <>
            <div className="fv-statistics-scroll"><ResizableNativeTable resizeStorageKey="fly-analysis-periods"><thead><tr><th>周期 / 交易日</th><th>末次真实权益</th><th>周期最深回撤</th><th>成交 / 平仓笔数</th><th>平仓毛盈亏</th><th>毛胜率</th><th>采样情况</th></tr></thead><tbody>{data.periods.slice(bucketPage * 20, bucketPage * 20 + 20).map(g => <tr key={`${g.day}-${g.at}`}><td>{g.label}<small>交易日 {dateInput(g.day)}</small></td><td>{fmt(g.Balance)}{g.observed_at != null && <small>{stamp(g.observed_at)}</small>}</td><td>{fmt(g.worst_drawdown == null ? null : -g.worst_drawdown)}</td><td>{g.fill_count} / {g.closing_fills}</td><td className={tone(g.realized_gross)}>{money(g.realized_gross)}</td><td>{fmt(g.win_rate, 1)}%</td><td>{g.sample_count} 条{g.contains_gap && <small>含采样缺口</small>}{!g.sample_count && <small>权益未知</small>}</td></tr>)}{!data.periods.length && <tr><td colSpan={7} className="fv-ledger-empty">所选范围暂无周期记录</td></tr>}</tbody></ResizableNativeTable></div><div className="fv-statistics-pagination"><span>第 {bucketPage + 1} / {Math.max(1, Math.ceil(data.periods.length / 20))} 页</span><button type="button" disabled={!bucketPage} onClick={() => setBucketPage(p => p - 1)}>上一页</button><button type="button" disabled={(bucketPage + 1) * 20 >= data.periods.length} onClick={() => setBucketPage(p => p + 1)}>下一页</button></div>
            <p className="fv-ledger-note">权益与回撤为整个比赛账户的采样；成交与毛盈亏仅统计 AI 交易员。{data.period === '1d' && '日线为各交易日末次观测，非正式日终结算。'}</p>
          </>}
          {selectedDetail === 'activity' && <div className="fv-analysis-secondary fv-ledger-charts">
            <Chart title={data.period === 'raw' ? '逐次平仓结果' : '周期平仓盈亏'} subtitle="平仓毛盈亏 · 未扣手续费 / 元" option={charts.closes} empty={!s.closing_fills ? '等待第一笔平仓成交。' : undefined}/>
            {data.period !== 'raw' && <Chart title="周期成交笔数" subtitle="开仓和平仓均计入" option={charts.activity} empty={!s.fills ? '所选范围尚无成交。' : undefined}/>}
          </div>}
          {selectedDetail === 'trader' && <><p className="fv-ledger-note fv-ledger-scope">当日柜台数据，独立于上方日期范围。平仓净盈亏已扣对应开仓与平仓手续费。</p>{traderDetails}</>}
        </div>
      </section>
    </>}
  </section>
}
