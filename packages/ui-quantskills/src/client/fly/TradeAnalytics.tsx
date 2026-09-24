import { products } from '@deepseek-ai/dsh-quantskills-session/contracts'
import { flyFetch } from './transport.ts'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import ResizableNativeTable from './FlyTable.tsx'
import './trade-analytics.css'
import { useChartPalette, type ChartPalette } from './useChartPalette'

type Period = 'raw' | '1m' | '3m' | '5m' | '1h' | '1d'
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
  coverage: { samples: number; first_at: number | null; last_at: number | null; gaps: number; observation_samples: number; cash_flow_unknown: boolean; cash_flow_changed: boolean }
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
    yAxis: { type: 'value', scale: field !== 'cumulative_net', axisLabel: { color: colors.muted, formatter: value => field === 'Balance' || field === 'realized_equity' ? `${(value / 10000).toFixed(2)}万` : fmt(value, 0) }, splitLine: { lineStyle: { color: colors.grid, type: 'dashed' } } },
    dataZoom: [{ type: 'inside', zoomOnMouseWheel: 'ctrl' }, { type: 'slider', height: 17, bottom: 8, borderColor: colors.grid, textStyle: { color: colors.muted }, fillerColor: colors.grid, handleStyle: { color: colors.equity } }],
    series: [{ name: field === 'Balance' ? '账户权益（元）' : field === 'realized_equity' ? '固定基准＋累计平仓净盈亏（元）' : field === 'cumulative_net' ? '累计平仓净盈亏（已扣手续费 / 元）' : '距采样峰值（元）', type: 'line', data, step: field === 'cumulative_net' || field === 'realized_equity' ? 'end' : false, connectNulls: false, smooth: false, showSymbol: true, symbolSize: points.length < 3 ? 7 : 3,
      lineStyle: { width: 2, color: field !== 'drawdown' ? colors.equity : colors.loss }, itemStyle: { color: field !== 'drawdown' ? colors.equity : colors.loss },
      areaStyle: { color: field !== 'drawdown' ? colors.equity : colors.loss, opacity: .08 },
      markArea: ['raw', '1m', '3m', '5m'].includes(period) ? { silent: true, itemStyle: { color: colors.warning, opacity: .1 }, label: { color: colors.warning, fontSize: 10 }, data: gaps.map(g => [{ name: '无采样', xAxis: g.from * 1000 }, { xAxis: g.to * 1000 }]) } : { data: [] } },
      { name: '缺口连接（非采样）', type: 'line', data: bridges, connectNulls: false, showSymbol: false, lineStyle: { type: 'dashed', color: colors.warning, width: 1.5 }, itemStyle: { color: colors.warning } }],
  }
}

function Chart({ title, subtitle, option, empty, wide = false }: { title: string; subtitle: string; option: EChartsOption; empty?: string | undefined; wide?: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  const instance = useRef<echarts.ECharts>()
  useEffect(() => {
    if (!host.current || empty) return
    const chart = echarts.init(host.current, undefined, { renderer: 'canvas' })
    instance.current = chart
    const resize = new ResizeObserver(() => chart.resize())
    resize.observe(host.current)
    return () => { resize.disconnect(); chart.dispose(); instance.current = undefined }
  }, [empty])
  useEffect(() => { instance.current?.setOption(option, { replaceMerge: ['series'] }) }, [option, empty])
  return <section className={`fv-analysis-chart ${wide ? 'wide' : ''}`}>
    <header><h3>{title}</h3><p>{subtitle}</p></header>
    {empty ? <div className="fv-analysis-empty">{empty}</div> : <div className="fv-analysis-canvas" ref={host} role="img" aria-label={`${title}。${subtitle}`} />}
  </section>
}

export function TradeAnalytics({ active }: { active: boolean }) {
  const { ref: paletteRef, palette: colors } = useChartPalette()
  const [data, setData] = useState<Analytics>()
  const [range, setRange] = useState({ start: '', end: '' })
  const [draft, setDraft] = useState({ start: '', end: '' })
  const [period, setPeriod] = useState<Period>('1m')
  const [bridge, setBridge] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [page, setPage] = useState(0)
  const [bucketPage, setBucketPage] = useState(0)
  const applyRange = (start: string, end: string) => {
    if (!start || !end || start > end) { setError('请选择有效日期范围，开始日期不能晚于结束日期'); return }
    if (start < moveDay(end, -366)) { setError('每次最多查看一年，请缩小日期范围'); return }
    setRange({ start, end }); setDraft({ start, end }); setPage(0); setBucketPage(0); setData(undefined)
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
  const exportData = () => {
    if (!data) return
    const rows: (string | number | null)[][] = [['类别', '交易日', '时间（上海）', '合约', '数值（元）', '来源或口径']]
    data.equity.forEach(p => rows.push(['原始权益', p.day, new Date(p.at * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }), '', p.Balance, p.source === 'counter' ? '正式柜台快照' : '历史验收观测（记录时间）']))
    data.equity.forEach(p => rows.push(['累计平仓净盈亏', p.day, stamp(p.at), '', p.cumulative_net, `整个 PandaAI 模拟赛 账户；按有记录交易日累计；当日平仓盈亏 ${fmt(p.CloseProfit)} − 当日手续费 ${fmt(p.Commission)}；不含浮盈`]))
    data.equity.forEach(p => rows.push(['平仓权益曲线', p.day, stamp(p.at), '', p.realized_equity, `固定基准 ${fmt(data.equity_baseline?.value)} ＋ 累计平仓净盈亏；已扣手续费；非账户实时权益`]))
    data.realized_curve.forEach(c => rows.push(['平仓毛盈亏', c.trading_day, c.time, c.symbol, c.realized_gross, `${c.time_source === 'counter' ? '柜台时间' : '回报接收时间'}；成交 ${c.trade_id}；未扣费用`]))
    data.products.forEach(p => rows.push(['品种毛盈亏', `${data.start_day}—${data.end_day}`, '', p.symbol, p.realized_gross, '果蝇成交；未扣费用']))
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
    <header className="fv-analysis-heading"><div><span className="fv-kicker">TRADING ANALYTICS</span><h2>每一次交易，留下怎样的结果</h2><p>平仓盈亏、盈亏来源与成交表现 · PandaAI 模拟赛</p></div><div className="fv-analysis-tools"><button type="button" onClick={() => setReload(v => v + 1)}>刷新</button><button type="button" disabled={!data} onClick={exportData}>导出 CSV ↗</button></div></header>
    <div className="fv-analysis-controls">
      <div className="fv-period-switch" aria-label="图表周期">{(Object.keys(periodNames) as Period[]).map(p => <button type="button" key={p} aria-pressed={period === p} onClick={() => { if (p === period) return; setPeriod(p); setBucketPage(0); setData(undefined) }}>{periodNames[p]}</button>)}</div>
      <div className="fv-date-range"><label>开始交易日<input type="date" aria-label="开始交易日" value={draft.start ? dateInput(draft.start) : ''} onChange={e => setDraft(d => ({ ...d, start: e.target.value.replace(/-/g, '') }))} /></label><span>—</span><label>结束交易日<input type="date" aria-label="结束交易日" value={draft.end ? dateInput(draft.end) : ''} onChange={e => setDraft(d => ({ ...d, end: e.target.value.replace(/-/g, '') }))} /></label><button type="button" onClick={() => applyRange(draft.start, draft.end)}>应用日期</button></div>
      <div className="fv-analysis-presets">{[['单日', 0], ['近 7 日', 6], ['近 30 日', 29], ['全部记录', -1]].map(([label, n]) => <button type="button" key={label} disabled={!data} onClick={() => { if (!data) return; const end = data.days[0] || data.day; const earliest = data.days[data.days.length - 1] || end; applyRange(Number(n) < 0 ? (earliest < moveDay(end, -366) ? moveDay(end, -366) : earliest) : moveDay(end, -Number(n)), end) }}>{label}</button>)}<label>账户回撤缺口<select aria-label="权益缺口显示" value={bridge ? 'bridge' : 'break'} onChange={e => setBridge(e.target.value === 'bridge')}><option value="break">保留空白</option><option value="bridge">虚线连接（非采样）</option></select></label></div>
    </div>
    {error && <div className="fv-analysis-alert" role="status">{error}{data ? '，以下保留上次成功结果。' : '，请检查后台连接。'}</div>}
    {!data || !s || !charts ? <div className="fv-analysis-empty">正在读取账户权益与成交记录…</div> : <>
      <div className="fv-analysis-metrics">
        <div><span>累计平仓净盈亏</span><strong className={tone(data.period_summary.realized_net)}>{money(data.period_summary.realized_net)}</strong><small>整个账户 · 已扣开平仓手续费 · 不含浮盈 · 元</small></div>
        <div><span>有记录交易日净收益</span><strong className={tone(data.period_summary.day_net)}>{money(data.period_summary.day_net)}</strong><small>{data.period_summary.recorded_days} 个交易日 · 已扣费 · 含浮盈 · 元</small></div>
        <div><span>账户采样最大回撤</span><strong>{fmt(s.max_drawdown)}</strong><small>{fmt(s.max_drawdown_pct, 3)}% · 未调整出入金</small></div>
        <div><span>平仓成交胜率 · 毛收益</span><strong>{fmt(s.win_rate, 1)}<em>%</em></strong><small>{s.wins} 盈 / {s.losses} 亏 / {s.breakeven} 平 · {s.matched_closes} 笔已配对</small></div>
      </div>
      <div className="fv-analysis-coverage"><span className="fv-analysis-dot" /><p>{data.coverage.samples ? <><b>{data.coverage.samples} 个权益采样</b> · {stamp(data.coverage.first_at)}—{stamp(data.coverage.last_at)} · {data.coverage.gaps} 处间隔断线{data.coverage.observation_samples > 0 && ` · ${data.coverage.observation_samples} 条历史验收观测，使用记录时间`}</> : '尚无该交易日的权益采样；后台收到新柜台快照后自动记录。'}<small>{periodNames[data.period]} · {data.period === 'raw' ? data.coverage.samples : data.periods.filter(g => g.Balance != null).length} 个权益点；回撤按原始采样计算。{s.unmatched_closes > 0 && ` ${s.unmatched_closes} 笔平仓缺少配对数据，不计入胜率。`}{data.coverage.cash_flow_changed && ' 检测到出入金变化，原始权益回撤会受影响。'}</small></p><span>{s.fills} 笔成交</span></div>
      {data.gaps.length > 0 && <details className="fv-analysis-gaps"><summary>账户回撤数据：{data.gaps.length} 段权益快照缺失</summary>{data.gaps.map(g => <p key={g.from}>{stamp(g.from)} → {stamp(g.to)} · {Math.floor(g.seconds / 60)} 分 {Math.round(g.seconds % 60)} 秒</p>)}<small>这段时间未记录到权益快照，无法还原其间浮盈浮亏。虚线仅连接已知端点，不生成采样，也不改变统计结果。小时、日线仍会标明周期内包含缺口。</small></details>}
      {data.period === '1d' && <p className="fv-analysis-footnote">日线按柜台交易日归档，夜盘跟随所属交易日。当前 {data.periods.filter(g => g.Balance != null).length} 个交易日有权益观测；每个交易日一个末次观测点，不把盘中快照当作正式日终结算。</p>}
      <div className="fv-analysis-grid">
        <Chart title="平仓权益曲线" subtitle={`${periodNames[data.period]} · 固定基准 ${fmt(data.equity_baseline?.value)} 元 ＋ 累计平仓净盈亏 · 已扣手续费 · 不含浮盈变化及后续出入金`} option={charts.realizedEquity} empty={!data.equity.some(p => p.realized_equity != null) ? '等待可以确定基准权益及手续费的柜台快照。' : undefined} wide />
        <Chart title="累计平仓净盈亏" subtitle={`${periodNames[data.period]} · 整个 PandaAI 模拟赛 账户 · 平仓盈亏 − 已发生开平仓手续费 · 不含浮盈 · 按有记录交易日累计 · 元`} option={charts.cumulative} empty={!data.equity.some(p => p.cumulative_net != null) ? '等待包含平仓盈亏和手续费的柜台快照；缺失费用不按零计算。' : undefined} wide />
        <Chart title="账户回撤" subtitle={`${data.period === 'raw' ? '距原始采样峰值' : '周期内最深原始采样回撤'} · 单位：元`} option={charts.drawdown} empty={data.equity.length < 2 ? '至少需要两个真实权益采样。' : undefined} />
        <Chart title="品种盈亏贡献" subtitle="所选日期范围内的果蝇毛盈亏 · 不分摊账户手续费" option={charts.products} empty={!s.fills ? '该交易日尚无果蝇成交。' : undefined} />
        <Chart title="平仓胜负分布" subtitle={`以已配对平仓成交计数；不是手数或完整持仓周期 · 毛利润 / 毛亏损 ${fmt(s.profit_factor)}`} option={charts.distribution} empty={!s.matched_closes ? '尚无可配对的平仓成交。' : undefined} />
        <Chart title={data.period === 'raw' ? '逐次平仓结果' : '周期平仓盈亏'} subtitle={`${periodNames[data.period]} · 每个柱形对应该周期的平仓毛盈亏 / 元`} option={charts.closes} empty={!s.closing_fills ? '等待第一笔平仓成交。' : undefined} />
        {data.period !== 'raw' && <Chart title="周期成交笔数" subtitle={`${periodNames[data.period]} · 开仓和平仓均计入 · 按回报接收时间汇总`} option={charts.activity} empty={!s.fills ? '所选范围尚无成交。' : undefined} />}
        <section className="fv-analysis-reconcile"><span className="fv-kicker">ACCOUNT RECONCILIATION</span><h3>收益从哪里来</h3><p>{dateInput(data.start_day)}—{dateInput(data.end_day)} · {data.period_summary.recorded_days} 个有记录交易日</p><dl><div><dt>柜台平仓盈亏</dt><dd className={tone(data.period_summary.CloseProfit)}>{money(data.period_summary.CloseProfit)}</dd></div><div><dt>− 开仓及平仓手续费</dt><dd>{fmt(data.period_summary.Commission)}</dd></div><div className="total"><dt>＝ 平仓净盈亏（主曲线）</dt><dd className={tone(data.period_summary.realized_net)}>{money(data.period_summary.realized_net)}</dd></div><div><dt>＋ 持仓浮盈亏</dt><dd>{money(data.period_summary.PositionProfit)}</dd></div><div className="total"><dt>有记录交易日净收益</dt><dd className={tone(data.period_summary.day_net)}>{money(data.period_summary.day_net)}</dd></div></dl><small>整个 PandaAI 模拟赛 账户口径，其他策略或手工交易也会计入。果蝇成交另计的毛盈亏为 {money(s.realized_gross)} 元。</small></section>
      </div>
      <p className="fv-analysis-footnote">{data.note} 图表每 15 秒读取已保存数据；柜台刷新频率独立于页面。更新时间 {clock(data.generated_at)}。</p>
      {data.period !== 'raw' && <details className="fv-analysis-details"><summary>查看 {periodNames[data.period]} 周期统计 · {data.periods.length} 个有记录周期</summary><div className="fv-statistics-scroll"><ResizableNativeTable resizeStorageKey="fly-analysis-periods"><thead><tr><th>周期 / 交易日</th><th>末次真实权益</th><th>周期最深回撤</th><th>成交 / 平仓笔数</th><th>平仓毛盈亏</th><th>毛胜率</th><th>采样情况</th></tr></thead><tbody>{data.periods.slice(bucketPage * 20, bucketPage * 20 + 20).map(g => <tr key={`${g.day}-${g.at}`}><td>{g.label}<small>交易日 {dateInput(g.day)}</small></td><td>{fmt(g.Balance)}{g.observed_at != null && <small>{stamp(g.observed_at)}</small>}</td><td>{fmt(g.worst_drawdown == null ? null : -g.worst_drawdown)}</td><td>{g.fill_count} / {g.closing_fills}</td><td className={tone(g.realized_gross)}>{money(g.realized_gross)}</td><td>{fmt(g.win_rate, 1)}%</td><td>{g.sample_count} 条{g.contains_gap && <small>含采样缺口</small>}{!g.sample_count && <small>权益未知</small>}</td></tr>)}</tbody></ResizableNativeTable></div><div className="fv-statistics-pagination"><span>第 {bucketPage + 1} / {Math.max(1, Math.ceil(data.periods.length / 20))} 页</span><button type="button" disabled={!bucketPage} onClick={() => setBucketPage(p => p - 1)}>上一页</button><button type="button" disabled={(bucketPage + 1) * 20 >= data.periods.length} onClick={() => setBucketPage(p => p + 1)}>下一页</button></div></details>}
      <details className="fv-analysis-details"><summary>查看所选范围的 {s.fills} 笔成交明细</summary><div className="fv-statistics-scroll"><ResizableNativeTable resizeStorageKey="fly-analysis-fills"><thead><tr><th>时间</th><th>合约</th><th>动作</th><th>手数</th><th>成交价</th><th>平仓毛盈亏</th><th>成交编号</th></tr></thead><tbody>{data.fills.slice(page * 20, page * 20 + 20).map(f => <tr key={f.seq}><td>{data.start_day !== data.end_day && <small>{dateInput(f.trading_day)}</small>}{f.time}{f.time_source !== 'counter' && <small>回报时间</small>}</td><td>{f.symbol}</td><td>{f.offset === '0' ? (f.direction === '0' ? '开多' : '开空') : (f.direction === '0' ? '平空' : '平多')}</td><td>{f.volume}</td><td>{fmt(f.price)}</td><td className={tone(f.realized_gross)}>{money(f.realized_gross)}</td><td>{f.trade_id}</td></tr>)}</tbody></ResizableNativeTable></div><div className="fv-statistics-pagination"><span>{s.fills} 笔 · 第 {page + 1} / {Math.max(1, Math.ceil(s.fills / 20))} 页</span><button type="button" disabled={!page} onClick={() => setPage(p => p - 1)}>上一页</button><button type="button" disabled={(page + 1) * 20 >= s.fills} onClick={() => setPage(p => p + 1)}>下一页</button></div></details>
    </>}
  </section>
}
