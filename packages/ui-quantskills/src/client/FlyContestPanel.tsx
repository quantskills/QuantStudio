import { useEffect, useId, useRef, useState } from 'react'
import type { FlyRuntimeStatus } from '@deepseek-ai/dsh-quantskills-session/src/fly-runtime.ts'
import type { ContestStatus } from './plugin-types.ts'
import type { FlyAccess } from './fly/transport.ts'
import { FlyHistory, marketReadiness, type HistoryMarket, type HistoryStatus } from './fly/FlyHistory.tsx'
import { contestTime } from './contest.ts'
import { waitForCompetition } from './competition-async.ts'
import css from './ContestPage.module.css'

type FlyState = {
  name: string
  binding?: { identity?: { contestId: string; accountId: string } } | null
  settings: { instruments: { symbol: string }[]; life_validation: boolean }
  control: { trading: boolean; close_only?: boolean }
  connection?: { status: string; message: string }
  history?: HistoryStatus; history_error?: string
  markets?: (HistoryMarket & { readiness: string; long?: number; short?: number; quote_at?: number })[]
  environment: { brain_ready: boolean; blender_ready: boolean; progress: { status: string; message?: string } }
}
type Fill = { seq: number; time: string; symbol: string; direction: string; offset: string; volume: number; price: number; trade_id: string }
type Statistics = { summary: { fill_count: number; realized_gross: number | null }; fills: Fill[]; note: string }

export function sameFlyContest(state: FlyState | undefined, contest: ContestStatus | undefined): boolean {
  const own = state?.binding?.identity, current = contest?.identity
  return contest?.phase === 'connected' && !!own && !!current
    && own.contestId === current.contestId && own.accountId === current.accountId
}

const amount = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : `${value > 0 ? '+' : ''}${value.toLocaleString('zh-CN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`
const fillAction = (fill: Fill) => fill.offset === '0' ? (fill.direction === '0' ? '开多' : '开空') : fill.direction === '0' ? '平空' : '平多'

export function FlyContestPanel({ access, contest, openFly }: { access?: FlyAccess | undefined; contest?: ContestStatus | undefined; openFly(): void }) {
  const [expanded, setExpanded] = useState(false), contentId = useId(), revision = useRef(0)
  const [runtime, setRuntime] = useState<FlyRuntimeStatus>()
  const [snapshot, setSnapshot] = useState<{ state: FlyState; statistics?: Statistics | undefined; at: number }>()
  const [error, setError] = useState('')
  useEffect(() => {
    if (!access) return
    let disposed = false, timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      const version = revision.current
      try {
        const next = await waitForCompetition(() => access.status(), '果蝇运行状态', 15_000)
        if (disposed || version !== revision.current) return
        setRuntime(next)
        if (next.installed && next.running) {
          const state = await waitForCompetition(() => access.request({ path: 'state' }), '果蝇交易状态', 15_000) as FlyState
          const statistics = sameFlyContest(state, contest)
            ? await waitForCompetition(() => access.request({ path: 'statistics' }), '果蝇成交统计', 15_000) as Statistics : undefined
          if (disposed || version !== revision.current) return
          setSnapshot({ state, statistics, at: Date.now() })
        } else setSnapshot(undefined)
        setError('')
      } catch (cause) { if (!disposed && version === revision.current) setError(cause instanceof Error ? cause.message : '果蝇状态暂不可用') }
      finally { if (!disposed) timer = setTimeout(() => void poll(), 3000) }
    }
    void poll(); return () => { disposed = true; revision.current++; clearTimeout(timer) }
  }, [access, contest?.phase, contest?.identity?.accountId, contest?.identity?.contestId])
  const state = snapshot?.state, statistics = snapshot?.statistics
  const matched = sameFlyContest(state, contest)
  const pending = matched ? contest?.plans.filter(plan => plan.sessionId.startsWith('fly:') && plan.identity.accountId === contest.identity?.accountId
    && plan.identity.contestId === contest.identity?.contestId && plan.status === 'prepared') ?? [] : []
  const ready = Boolean(state?.environment.brain_ready && state.environment.blender_ready)
  const preparing = runtime?.installing || state?.environment.progress.status === 'running'
  const mode = state?.control.trading ? state.control.close_only ? '仅生成平仓计划' : '交易建议运行中' : state?.settings.life_validation ? '生活验证 · 观察中' : '观察中'
  const message = !access ? '果蝇服务尚未连接，请重启 QuantStudio。' : !runtime || (runtime.installed && runtime.running && !state) ? '正在读取果蝇状态…'
    : !runtime.supported ? '当前果蝇版本支持 Windows。' : !ready ? preparing ? '运行环境正在准备，可进入果蝇交易员查看进度。' : '运行环境尚未准备，进入果蝇交易员可一键准备。'
    : contest?.phase !== 'connected' ? '请先在上方连接比赛账户。'
    : state?.binding && !matched ? '此果蝇属于另一个比赛账户。请切回原账户后查看交易，不会混用两边的成交。'
    : !matched ? '进入果蝇设置选择实际合约并连接比赛行情。' : `${state?.name || '小果'} · ${mode} · ${state?.connection?.message || '账户状态待确认'}`
  return <section className={`${css.assistant} ${css.flyModule}`} aria-label="果蝇交易员比赛模块">
    <div className={css.assistantHeading}><div><span className={css.eyebrow}>FLY / 期货模拟交易</span><h2><button type="button" className={css.watchToggle} aria-expanded={expanded} aria-controls={contentId}
      onClick={() => setExpanded(value => !value)}>果蝇交易员 <span>{expanded ? '▾ 收起' : '▸ 展开'}</span></button></h2><p>{message}</p></div>
      <button type="button" onClick={openFly}>{runtime && (!runtime.installed || state) && !ready && !preparing ? '准备果蝇交易员' : '进入果蝇交易员'}</button></div>
    {matched && <div className={css.flySummary} aria-label="果蝇交易摘要"><span>{error ? '状态待同步' : mode}</span><span>待确认 <b>{pending.length}</b></span><span>当日成交 <b>{statistics?.summary.fill_count ?? '—'}</b></span><span>当日已实现毛盈亏 <b>{amount(statistics?.summary.realized_gross)}</b></span></div>}
    {error && <p className={css.error} role="alert">同步失败，{snapshot ? `当前为 ${contestTime(snapshot.at)} 的数据。` : '暂无法读取数据。'}{error}</p>}
    <div id={contentId} hidden={!expanded}>
      {matched ? <div className={css.flyActivity}>
        <small>与果蝇交易员共用实时状态，每 3 秒同步；最近同步 {snapshot ? contestTime(snapshot.at) : '—'}。每笔计划仍需你逐笔确认。</small>
        <FlyHistory history={state?.history} error={state?.history_error} markets={state?.markets ?? []}
          enabled={!!access && !!state?.settings.instruments.length} onRefresh={async () => {
            if (!access) return
            const version = ++revision.current
            const result = await waitForCompetition(() => access.request({ path: 'control', body: { action: 'history' } }), '历史数据获取', 15_000) as { history: HistoryStatus }
            if (version === revision.current) setSnapshot(current => current ? { ...current, state: { ...current.state, history: result.history } } : current)
          }} />
        <div className={css.flyList}><h3>合约行情与比赛账户持仓</h3>{state?.markets?.length ? <div className={css.tableWrap}><table><thead><tr><th>实际合约</th><th>行情状态</th><th>多头 / 空头（手）</th></tr></thead><tbody>{state.markets.map(market => <tr key={market.product}><td>{market.symbol || market.product}</td><td>{marketReadiness[market.readiness] || '状态待确认'}</td><td>{market.quote_at ? `${market.long ?? '—'} / ${market.short ?? '—'}` : '待同步'}</td></tr>)}</tbody></table></div> : <p>尚未选择实际合约，请进入果蝇设置。</p>}<small>持仓为所选合约的比赛账户持仓，可能包含其他策略或手工交易。</small></div>
        <div className={css.flyList}><h3>待确认计划</h3>{pending.length ? <>{pending.slice(0, 5).map(plan => <p key={plan.id}>{plan.summary} · {contestTime(plan.createdAt)}</p>)}<button type="button" onClick={openFly}>查看并确认计划</button></> : <p>暂无果蝇待确认计划。</p>}</div>
        <div className={css.flyList}><h3>果蝇当日最近成交</h3>{statistics?.fills.length ? <div className={css.tableWrap}><table><thead><tr><th>时间</th><th>合约</th><th>操作</th><th>手数</th><th>成交价</th><th>成交编号</th></tr></thead><tbody>{statistics.fills.slice(0, 5).map(fill => <tr key={fill.seq}><td>{fill.time}</td><td>{fill.symbol}</td><td>{fillAction(fill)}</td><td>{fill.volume}</td><td>{fill.price}</td><td>{fill.trade_id}</td></tr>)}</tbody></table></div> : <p>{statistics ? '暂无归属于果蝇的柜台确认成交。' : '成交统计待同步。'}</p>}</div>
        <small>{statistics?.note || '盈亏仅按果蝇确认成交计算毛额；账户整体费用与净盈亏在上方比赛账户数据查看。'}</small>
      </div> : <div className={css.flyConnection}><p>{state?.environment.progress.message || runtime?.message || message}</p><p>安装、合约配置及交易建议控制在果蝇交易员中统一管理。</p></div>}
    </div>
  </section>
}
