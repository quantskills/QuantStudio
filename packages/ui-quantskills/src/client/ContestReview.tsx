import { useEffect, useRef, useState } from 'react'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { ContestInspection, QuantSkillsPlainSessionBinding } from './plugin-types.ts'
import { ActionDialog } from './ActionDialog.tsx'
import { ContestPlans } from './ContestPlans.tsx'
import { CompetitionDock } from './CompetitionDock.tsx'
import { ContestTable } from './ContestPage.tsx'
import { asRecord, contestTime, display, useContest, type ContestAccess } from './contest.ts'
import css from './ContestPage.module.css'
import { waitForCompetition } from './competition-async.ts'

export interface ContestReviewInjected { hooks: { sessions: ObservableSnapshot<SessionListState> }; access: ContestAccess; openContest(): void }

/** Normal sessions never mount a contest poller or load account context. */
export function ContestReview({ useSessions, access, openContest }: InjectFace<ContestReviewInjected>) {
  const session = useSessions(state => state.current ? state.byId[state.current] : undefined)
  const binding = session?.projectionValues?.quantSkillsPlainSession
  if (!session || binding?.purpose !== 'contest') return null
  return <SessionContestReview key={session.id} sessionId={session.id} binding={binding} running={session.running} access={access} openContest={openContest}/>
}

function SessionContestReview({ sessionId, binding, running, access, openContest }: {
  sessionId: string; binding: QuantSkillsPlainSessionBinding; running: boolean; access: ContestAccess; openContest(): void
}) {
  const { status, refresh, error, busy, run } = useContest(access, sessionId)
  const [inspection, setInspection] = useState<ContestInspection>(), [inspectionError, setInspectionError] = useState('')
  const [checking, setChecking] = useState(false), [details, setDetails] = useState(false), [symbol, setSymbol] = useState('')
  const reads = useRef(0)
  const controller = useRef<AbortController | undefined>(undefined)
  const identity = binding.contest!
  const matches = status?.identity?.accountId === identity.accountId && status?.identity?.contestId === identity.contestId
  const ready = Boolean(status?.enabled && status.phase === 'connected' && matches)
  const inspect = async () => {
    const id = ++reads.current
    controller.current?.abort(); controller.current = new AbortController()
    setChecking(true); setInspectionError('')
    try {
      const next = await waitForCompetition(signal => access.inspect(sessionId, signal), '账户巡检', 30_000, controller.current.signal)
      if (reads.current === id && next.identity.accountId === identity.accountId && next.identity.contestId === identity.contestId) setInspection(next)
    } catch (error) { if (reads.current === id) setInspectionError(error instanceof Error ? error.message : '账户巡检未完成。') }
    finally { if (reads.current === id) setChecking(false) }
  }
  useEffect(() => {
    setInspection(undefined); setInspectionError(''); setChecking(false)
    if (ready) void inspect()
    return () => { reads.current++; controller.current?.abort() }
  }, [ready, sessionId, access])
  const research = (text: string) => { void run('research', () => access.requestResearch(sessionId, text)) }
  const account = asRecord(inspection?.account.data)
  return <CompetitionDock kind="contest" label="比赛专用对话"
    title={<>仿真比赛 · {binding.contestConversation === 'topic' ? '专题研究' : binding.contestConversation === 'main' ? '账户主对话' : '比赛研究'}</>}
    subtitle={<>「巅峰交易者」全国期货模拟赛 · 账户 {identity.accountId} · {identity.contestId}</>}
    actions={<>
      <button type="button" onClick={openContest}>比赛工作台</button>
      {ready && status && <ContestPlans status={status} access={access} refresh={refresh} compact autoOpen={!running}/>}
    </>}>
    {!status ? <p role="status">读取比赛状态…</p> : !ready ? <p role="status">{!status.enabled ? '比赛模式已关闭，普通会话照常使用。已提交委托仍由柜台处理。'
      : !matches && status.phase === 'connected' ? '当前登录账户与本会话不一致，请回比赛工作台进入对应账户主对话。' : '请在比赛工作台连接并验证账户。'}</p> : <>
      <div className={css.inspection} aria-live="polite">
        {checking && <span>正在只读巡检账户…</span>}
        {inspection && <><span>动态权益 {display(account.equity ?? account.totalProfit)} · 可用资金 {display(account.availableFunds)}</span>
          <p>{inspection.summary.join(' ')}</p><small>快照：{contestTime(inspection.fetchedAt)}（上海），分析与预演前重新核对。</small></>}
        {inspectionError && <p role="alert">{inspectionError}</p>}
      </div>
      <div className={css.conversationActions}>
        <button type="button" disabled={checking} onClick={() => { void inspect() }}>刷新巡检</button>
        <button type="button" disabled={!inspection} onClick={() => setDetails(true)}>账户详情</button>
        <button type="button" disabled={running || Boolean(busy)} onClick={() => research('请先巡检我的比赛账户，再研究现有持仓。展示数据时间、依据和候选方案，暂不生成交易预演。')}>研究持仓</button>
        <button type="button" disabled={running || Boolean(busy)} onClick={() => research('请复盘今天的比赛交易，对照本账户计划、委托、成交和结算，列出待核实事项。不要生成新订单。')}>今日复盘</button>
      </div>
      <form className={css.symbolResearch} onSubmit={event => { event.preventDefault(); if (symbol.trim() && !running && !busy) research(`请研究比赛品种/合约 ${symbol.trim()}，先巡检账户并核对数据覆盖与时间，再给依据和候选方案，暂不生成交易预演。`) }}>
        <input aria-label="研究品种或合约" value={symbol} maxLength={80} placeholder="研究品种或合约，例如 rb2610" onChange={event => setSymbol(event.target.value)}/>
        <button type="submit" disabled={!symbol.trim() || running || Boolean(busy)}>研究品种</button>
      </form>
      {details && inspection && <ActionDialog title="比赛账户巡检" wide onClose={() => setDetails(false)}>
        <p>账户 {identity.accountId} · {contestTime(inspection.fetchedAt)}（上海）</p>
        <h3>资金</h3><ContestTable value={inspection.account.data}/>
        <h3>持仓</h3><ContestTable value={inspection.positions.data}/>
        <h3>活动委托</h3><ContestTable value={inspection.openOrders.data}/>
        <p>待处理计划 {inspection.pendingPlans.length} 笔。当前会话计划可在“比赛计划”查看，其他会话计划可在比赛工作台查看。</p>
      </ActionDialog>}
    </>}
    {error && <p role="alert">{error}</p>}
  </CompetitionDock>
}
