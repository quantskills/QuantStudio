import { useEffect, useState } from 'react'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { LegacyTeamRecoveryResult } from '@deepseek-ai/dsh-quantskills-session/types'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { selectedSession } from './selected-session.ts'
import { ActionDialog } from './ActionDialog.tsx'
import css from './QuantSkillsApp.module.css'

export interface LegacyTeamRecoveryInjected {
  hooks: { sessions: ObservableSnapshot<SessionListState> }
  recover: (sessionId: SessionId, continuePending: boolean) => Promise<LegacyTeamRecoveryResult>
}

/** A distinct user continuation; viewing or restoring a Team never delivers historical messages. */
export function LegacyTeamRecovery({ useSessions, recover }: InjectFace<LegacyTeamRecoveryInjected>) {
  const session = useSessions(state => { const id = selectedSession(state); return id === undefined ? undefined : state.byId[id] })
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false)
  const [result, setResult] = useState<LegacyTeamRecoveryResult>(), [error, setError] = useState<string>()
  useEffect(() => { setOpen(false); setResult(undefined); setError(undefined) }, [session?.id])
  if (!session?.projectionValues?.quantSkillsAgentTeamSession) return null
  const inspect = async (continuePending: boolean) => {
    setBusy(true); setError(undefined)
    try { setResult(await recover(session.id, continuePending)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '历史消息核对失败。') }
    finally { setBusy(false) }
  }
  return <>
    <button type="button" className={css.reviewTrigger} disabled={session.running}
      onClick={() => { setOpen(true); void inspect(false) }}>旧团队消息</button>
    {open && <ActionDialog title="核对旧团队消息" busy={busy} error={error} onClose={() => { setOpen(false) }}>
      <p>已接收的消息不会重发。只有确认未接收的消息，才会在你点击继续后交给原成员处理；这可能恢复团队任务并调用原配置的模型。</p>
      {result && <div role="status"><p>已投递 {result.delivered} · 待恢复 {result.pending} · 待确认 {result.uncertain}</p>
        {result.unknownEvents > 0 && <p>另有 {result.unknownEvents} 条未知历史事件，原文已保留，需人工核对。</p>}
        {result.uncertain > 0 && <p>接收记录缺失、矛盾或投递中断的消息不会自动补发。</p>}</div>}
      <footer><button type="button" disabled={busy} onClick={() => { setOpen(false) }}>关闭</button>
        <button type="button" data-primary disabled={busy || !result?.pending} onClick={() => { void inspect(true) }}>继续待恢复消息</button></footer>
    </ActionDialog>}
  </>
}
