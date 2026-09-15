import { useEffect, useRef, useState } from 'react'
import type { FactorContestStatus } from './plugin-types.ts'
import { ActionDialog } from './ActionDialog.tsx'
import { asRecord, contestTime, display } from './contest.ts'
import { factorStates, type FactorContestAccess } from './factor-contest.ts'
import css from './ContestPage.module.css'
import factorCss from './FactorContestPage.module.css'
import { FactorDataView } from './FactorDataView.tsx'

export function FactorPlans({ status, access, refresh, compact = false }: { status: FactorContestStatus; access: FactorContestAccess; refresh(): Promise<void>; compact?: boolean }) {
  const [selected, select] = useState<string>(), [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const active = useRef(false), generation = useRef(0)
  useEffect(() => () => { generation.current++ }, [])
  const plan = status.plans.find(p => p.id === selected)
  const ready = status.enabled && status.phase === 'connected'
  useEffect(() => { if (!ready) { select(undefined); setOpen(false); generation.current++ } }, [ready])
  const perform = async (work: () => Promise<unknown>) => {
    if (active.current) return
    const current = generation.current
    active.current = true; setBusy(true); setError('')
    try { await work(); if (current === generation.current) await refresh() }
    catch (e) { if (current === generation.current) setError(e instanceof Error ? e.message : '操作未完成。') }
    finally { active.current = false; if (current === generation.current) setBusy(false) }
  }
  const list = <div className={css.plans}>
    {status.plans.length === 0 ? <p className={css.muted}>暂无计划。向 AI 提出研究目标，或在因子池选择参赛操作。</p> : [...status.plans].reverse().slice(0, 50).map(p =>
      <button key={p.id} className={css.planRow} type="button" onClick={() => { select(p.id); setError('') }}>
        <span><strong>{p.summary}</strong><small>{contestTime(p.createdAt)}</small></span><span>{factorStates[p.status]}</span>
      </button>)}
  </div>
  const action = plan?.action, pool = asRecord(asRecord(plan?.snapshot).pool)
  return <div className={css.plans} data-compact={compact}>
    {compact ? <button type="button" onClick={() => setOpen(true)}>因子计划（{status.plans.filter(p => p.status === 'prepared').length}）</button> : <><h2>操作计划与确认</h2>{list}</>}
    {compact && open && !plan && <ActionDialog title="因子计划" wide onClose={() => setOpen(false)}>{list}</ActionDialog>}
    {plan && action && <ActionDialog title="确认因子比赛操作" wide onClose={() => { if (!busy) select(undefined) }}>
      <div className={css.planDetails}>
        <h3>{plan.summary}</h3>
        <dl><dt>比赛</dt><dd>第四届因子大赛</dd><dt>账户</dt><dd>{plan.identity.accountId}</dd><dt>状态</dt><dd>{factorStates[plan.status]}</dd>
          <dt>有效期至</dt><dd>{contestTime(plan.expiresAt)}</dd></dl>
        {action.kind === 'budget' ? <>
          <p>{action.batch.hypothesis}</p><dl><dt>最多运行</dt><dd>{action.batch.maxRuns} 次</dd><dt>算力停止阈值</dt><dd>{action.batch.creditThreshold}</dd>
            <dt>回测区间</dt><dd>{action.batch.startDate} — {action.batch.endDate}</dd><dt>调仓周期</dt><dd>{action.batch.cycle} 个交易日</dd></dl>
          <p className={css.error}>运行次数是硬上限。算力阈值仅阻止追加回测；已启动的回测可能越过阈值。关闭模式或停止批次不会取消平台已启动任务。</p>
          {plan.status === 'completed' && <p>预算已授权。回到本对话发送“继续研究”，AI 即可在此预算内运行。</p>}
        </> : <>
          <dl><dt>因子池</dt><dd>{'name' in action ? action.name : display(pool.name)}</dd><dt>统一周期</dt><dd>{'cycle' in action && action.cycle !== undefined ? action.cycle : display(pool.cycle)} 个交易日</dd>
            {'style' in action && <><dt>风格</dt><dd>{action.style || '未设置'}</dd></>}
            {'workflowId' in action && <><dt>工作流</dt><dd>{action.workflowId}</dd></>}
            {'factorId' in action && <><dt>目标因子</dt><dd>{action.factorId}</dd></>}
          </dl>
          {action.kind === 'submit-pool' && <p className={css.error}>正式提交后，统一调仓周期将锁定。请核对池内因子及周期；提交受理后仍需等待赛事初始化。</p>}
          {action.kind === 'submit-pool' && Array.isArray(pool.factors) && <FactorDataView value={pool.factors.map(f => {
            const item = asRecord(f); return { factor_name: item.name, workflow_id: item.workflow, direction: item.direction, revision: item.revision }
          })}/>}
          {action.kind === 'remove-factor' && <p className={css.error}>删除后有效因子不足 5 只，可能影响当月计分。已产生的历史数据按赛事规则处理。</p>}
          <details><summary>核对因子池与工作流快照</summary><pre className={factorCss.json}>{JSON.stringify(plan.snapshot, null, 2)}</pre></details>
        </>}
        {plan.result !== undefined && <pre className={factorCss.json}>{JSON.stringify(plan.result, null, 2)}</pre>}
        {error && <p role="alert" className={css.error}>{error}</p>}
        <div className={css.actions}>
          {plan.status === 'prepared' && <><button type="button" data-primary disabled={busy || !ready || plan.expiresAt <= Date.now()
            || plan.identity.accountId !== status.identity?.accountId || plan.identity.contestId !== status.identity?.contestId}
            onClick={() => { void perform(() => access.confirm(plan)) }}>{action.kind === 'budget' ? '确认授权本批次' : '确认执行此操作'}</button>
            <button type="button" disabled={busy} onClick={() => { void perform(() => access.dismiss(plan)) }}>取消计划</button></>}
          {plan.status === 'unknown' && <button type="button" disabled={busy || !ready} onClick={() => { void perform(() => access.reconcilePlan(plan.id)) }}>只读核对结果</button>}
        </div>
      </div>
    </ActionDialog>}
  </div>
}
