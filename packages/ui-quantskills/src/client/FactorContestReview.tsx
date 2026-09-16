import { useEffect, useRef, useState } from 'react'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { FactorInspection, QuantSkillsPlainSessionBinding } from './plugin-types.ts'
import { useFactorContest, type FactorContestAccess } from './factor-contest.ts'
import { FactorPlans } from './FactorPlans.tsx'
import { CompetitionDock } from './CompetitionDock.tsx'
import { asRecord, contestTime, display } from './contest.ts'
import css from './ContestPage.module.css'
import { waitForCompetition } from './competition-async.ts'

export interface FactorReviewInjected { hooks: { sessions: ObservableSnapshot<SessionListState> }; access: FactorContestAccess; openContest(): void }
export function FactorContestReview({ useSessions, access, openContest }: InjectFace<FactorReviewInjected>) {
  const session = useSessions(s => s.current ? s.byId[s.current] : undefined), binding = session?.projectionValues?.quantSkillsPlainSession
  if (!session || binding?.purpose !== 'factor-contest') return null
  return <SessionFactorReview key={session.id} sessionId={session.id} binding={binding} running={session.running} access={access} openContest={openContest}/>
}
function SessionFactorReview({ sessionId, binding, running, access, openContest }: {
  sessionId: string; binding: QuantSkillsPlainSessionBinding; running: boolean; access: FactorContestAccess; openContest(): void
}) {
  const { status, error, busy, run, refresh } = useFactorContest(access, sessionId)
  const [inspection, setInspection] = useState<FactorInspection>(), [inspectError, setInspectError] = useState(''), serial = useRef(0)
  const [retry, setRetry] = useState(0)
  const identity = binding.factorContest!
  const ready = status?.enabled && status.phase === 'connected' && status.identity?.accountId === identity.accountId && status.identity?.contestId === identity.contestId
  useEffect(() => {
    const current = ++serial.current
    const controller = new AbortController()
    setInspection(undefined); setInspectError('')
    if (ready) void waitForCompetition(signal => access.inspect(sessionId, signal), '因子账户巡检', 30_000, controller.signal).then(next => { if (serial.current === current && next.identity.accountId === identity.accountId && next.identity.contestId === identity.contestId) setInspection(next) })
      .catch(e => { if (serial.current === current) setInspectError(e instanceof Error ? e.message : '巡检失败。') })
    return () => { serial.current++; controller.abort() }
  }, [ready, access, sessionId, retry])
  return <CompetitionDock kind="factor-contest" label="因子比赛专用对话"
    title={<>第四届因子大赛 · {binding.contestConversation === 'topic' ? '专题研究' : '账户主对话'}</>}
    subtitle={<>账户 {identity.accountId}</>}
    actions={<><button type="button" onClick={openContest}>因子比赛工作台</button>
      {ready && status && <FactorPlans status={status} access={access} refresh={refresh} compact/>}</>}>
    {!ready ? <p role="status">请在比赛工作台开启因子模式并连接本对话对应账户。</p> : <>
      <p>{inspection ? `算力 ${display(inspection.balance)} · 因子池 ${display(asRecord(inspection.pool).name)} · 快照 ${contestTime(inspection.fetchedAt)}` : inspectError ? '因子账户巡检未完成。' : '正在只读巡检因子账户…'}</p>
      {inspectError && <button type="button" onClick={() => setRetry(value => value + 1)}>重试账户巡检</button>}
      <div className={css.conversationActions}><button type="button" disabled={running || Boolean(busy)} onClick={() => { void run('research', () => access.requestResearch(sessionId, '请先巡检因子账户并说明比赛因子池状态，再帮我制定一批因子研究计划。先确定假设、日期、周期、运行次数和算力停止阈值，等待预算确认。')) }}>制定研究计划</button>
        <button type="button" disabled={running || Boolean(busy)} onClick={() => { void run('research', () => access.requestResearch(sessionId, '请读取本会话已授权预算与回测记录，继续预算内的因子研究。遇到未知回执停止，不重复启动；没有有效预算时先说明。')) }}>继续预算内研究</button>
        <button type="button" disabled={running || Boolean(busy)} onClick={() => { void run('research', () => access.requestResearch(sessionId, '请复盘本账户已有因子回测结果，比较样本内外表现、多头超额和换手，筛选可入池候选。只做研究，不启动新回测或提交参赛。')) }}>复盘与筛选</button>
        {status?.budgets.filter(b => b.status === 'active').map(b => <button type="button" key={b.id} onClick={() => { void run('stop', () => access.stopBudget(b.id)) }}>停止批次（{b.runsUsed}/{b.maxRuns} 次）</button>)}</div>
    </>}{(error || inspectError) && <p role="alert">{error || inspectError}</p>}
  </CompetitionDock>
}
