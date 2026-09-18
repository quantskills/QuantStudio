import { useEffect, useRef, useState } from 'react'
import { ActionDialog } from './ActionDialog.tsx'
import type { ContestPlan, ContestStatus } from './plugin-types.ts'
import { asRecord, contestTime, display, planStates, type ContestAccess } from './contest.ts'
import css from './ContestPage.module.css'
import { waitForCompetition } from './competition-async.ts'

function executionPrice(plan: ContestPlan): string {
  if (plan.operation !== 'place_order') return ''
  const parameters = asRecord(plan.details.parameters)
  const label = parameters.offset === 'open' ? '开仓成交均价' : parameters.offset === 'close' ? '平仓成交均价' : '成交均价'
  const volume = plan.fills?.reduce((sum, fill) => sum + fill.volume, 0) ?? 0
  if (!volume) return `${label}：${['prepared', 'cancelled'].includes(plan.status) ? '—（未执行）' : '待核对'}`
  const average = plan.fills!.reduce((sum, fill) => sum + fill.price * fill.volume, 0) / volume
  return `${label}：${average.toLocaleString('zh-CN', { maximumFractionDigits: 6 })} · 已记录成交 ${volume}/${display(parameters.volume)} 手`
}

export function ContestPlans({ status, access, refresh, compact = false, autoOpen = false }: {
  status: ContestStatus; access: ContestAccess; refresh(): Promise<void>; compact?: boolean; autoOpen?: boolean
}) {
  const [selected, setSelected] = useState<string>()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const locked = useRef(false)
  const controller = useRef<AbortController | undefined>(undefined), generation = useRef(0), submitted = useRef(new Set<string>())
  const [returned, setReturned] = useState<{ source: ContestPlan | undefined; value: ContestPlan }>()
  const seen = useRef(new Set<string>())
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [])
  useEffect(() => {
    if (!status.enabled) { setSelected(undefined); setBusy(false); locked.current = false }
    return () => { generation.current++; controller.current?.abort() }
  }, [status.enabled])
  const original = status.plans.find(plan => plan.id === selected)
  const plan = returned?.value.id === original?.id && (original === returned?.source || original?.status === 'prepared') ? returned?.value : original
  const ready = status.enabled && status.phase === 'connected'
  const pending = status.plans.filter(plan => plan.status === 'prepared' && plan.expiresAt > now)
  const newest = pending.at(-1)?.id
  useEffect(() => {
    if (!autoOpen || !ready || !newest || seen.current.has(newest)) return
    seen.current.add(newest); setSelected(newest); setError(undefined)
  }, [autoOpen, ready, newest])
  const work = async (task: () => Promise<ContestPlan | void>, submission?: ContestPlan, verificationId?: string) => {
    if (locked.current) return
    if (submission && submitted.current.has(submission.id)) return
    if (submission) submitted.current.add(submission.id)
    const current = generation.current
    controller.current = new AbortController()
    locked.current = true; setBusy(true); setError(undefined)
    try {
      const result = await waitForCompetition(task, '比赛计划操作', 60_000, controller.current.signal)
      if (current === generation.current && result) {
        // Only a serialized, read-only server check can release an uncertain submission.
        if (result.id === verificationId && result.status === 'prepared' && !result.operationId) submitted.current.delete(result.id)
        setReturned({ source: original, value: result })
      }
    } catch (error) {
      if (current === generation.current) setError(`${error instanceof Error ? error.message : '操作未完成。'}${submission ? '本次确认结果待核实，请勿重复提交。' : ''}`)
    } finally {
      if (current === generation.current) {
        locked.current = false; setBusy(false)
        void waitForCompetition(refresh, '比赛状态读取', 15_000).catch(error => {
          if (current === generation.current) setError(previous => previous || (error instanceof Error ? error.message : '请刷新状态。'))
        })
      }
    }
  }
  const list = <>
    {status.plans.length === 0 ? <p className={css.muted}>研究方案经你选择后，预演计划会出现在这里。</p>
      : [...status.plans].reverse().slice(0, 30).map(item => <button className={css.planRow} type="button" key={item.id} disabled={busy}
        onClick={() => { setSelected(item.id); setError(undefined) }}>
        <span><strong>{item.summary}</strong><small>{contestTime(item.createdAt)}</small>{item.operation === 'place_order' && <small>{executionPrice(item)}</small>}</span>
        <span>{item.status === 'prepared' && item.expiresAt <= now ? '已过期' : planStates[item.status]}</span>
      </button>)}
  </>
  return <section className={css.plans} data-compact={compact || undefined} aria-label="比赛交易计划">
    {compact ? <button type="button" onClick={() => { if (newest) setSelected(newest); else setHistoryOpen(true) }}>比赛计划{pending.length ? ` · ${pending.length} 笔待确认` : ''}</button>
      : <><h2>交易计划与回执</h2>{list}</>}
    {compact && historyOpen && !plan && status.enabled && <ActionDialog title="比赛计划与回执" onClose={() => setHistoryOpen(false)}>{list}</ActionDialog>}
    {plan && status.enabled && <ActionDialog title="确认比赛交易计划" busy={busy} error={error} onClose={() => setSelected(undefined)}>
      <PlanDetails plan={plan}/>
      <p role="status">{plan.status === 'prepared' && plan.expiresAt <= now ? '计划已过期，请回到研究会话重新预演。' : planStates[plan.status]}</p>
      {plan.result && <p className={css.muted}>柜台回报：{display(plan.result.message ?? plan.result.status)}{plan.operationId ? ` · 操作号 ${plan.operationId}` : ''}</p>}
      <footer className={css.actions}>
        {plan.status === 'prepared' && <>
          <button type="button" disabled={busy || submitted.current.has(plan.id)} onClick={() => { void work(async () => { await access.dismiss(plan); return { ...plan, status: 'cancelled' } }) }}>取消计划</button>
          <button type="button" data-primary disabled={busy || !ready || plan.expiresAt <= now || submitted.current.has(plan.id)}
            onClick={() => { void work(() => access.execute(plan), plan) }}>{busy ? '正在提交…' : '确认执行这笔交易'}</button>
          {submitted.current.has(plan.id) && !busy && <button type="button" onClick={() => { void work(() => access.reconcile(plan), undefined, plan.id) }}>只读核对确认结果</button>}
        </>}
        {['executing', 'queued', 'submitted', 'unknown', 'partial'].includes(plan.status) && <button type="button" data-primary disabled={busy || !ready}
          onClick={() => { void work(() => access.reconcile(plan), undefined, plan.id) }}>{busy ? '查询中…' : '查询柜台回执'}</button>}
        {plan.operation === 'place_order' && plan.operationId && ['completed', 'failed', 'expired'].includes(plan.status)
          && (plan.fills?.reduce((sum, fill) => sum + fill.volume, 0) ?? 0) < Number(asRecord(plan.details.parameters).volume) && <button type="button" disabled={busy || !ready}
          onClick={() => { void work(() => access.reconcile(plan), undefined, plan.id) }}>{busy ? '查询中…' : '核对成交价格'}</button>}
      </footer>
    </ActionDialog>}
  </section>
}

function PlanDetails({ plan }: { plan: ContestPlan }) {
  const parameters = asRecord(plan.details.parameters), quote = asRecord(plan.details.marketQuote)
  return <div className={css.planDetails}>
    <h3>{plan.summary}</h3>
    <dl><dt>仿真账户</dt><dd>{plan.identity.accountId}</dd><dt>赛事编号</dt><dd>{plan.identity.contestId}</dd>
      {plan.operation === 'place_order' ? <>
        <dt>实际合约</dt><dd>{display(parameters.contractCode)}</dd>
        <dt>手数</dt><dd>{display(parameters.volume)} 手</dd>
        <dt>委托价格</dt><dd>{parameters.price === undefined ? '市价 IOC' : `${display(parameters.price)} · 限价 GFD`}</dd>
        <dt>实际成交</dt><dd>{executionPrice(plan)}</dd>
        <dt>参考最新价</dt><dd>{quote.ready === false ? '暂无行情快照' : display(quote.latestPrice)}</dd>
        <dt>行情时间</dt><dd>{display(quote.quoteTime)}</dd>
      </> : <><dt>委托号</dt><dd>{display(parameters.orderId)}</dd><dt>实际合约</dt><dd>{display(quote.contractCode)}</dd>
        <dt>方向</dt><dd>{display(quote.tradeDirectionText)}</dd><dt>未成交手数</dt><dd>{Number(quote.volume ?? quote.quantity ?? 0) - Number(quote.filledVolume ?? quote.filledQuantity ?? 0)}</dd></>}
      <dt>计划有效期至</dt><dd>{contestTime(plan.expiresAt)}（上海）</dd>
    </dl>
    {plan.fills?.length ? <p className={css.muted}>成交价来源：按委托号匹配的柜台成交明细，按成交手数加权。已记录成交编号：{plan.fills.map(fill => fill.tradeId).join('、')}。</p> : null}
    <p className={css.muted}>执行使用这份冻结计划。修改参数需要重新预演。</p>
  </div>
}
