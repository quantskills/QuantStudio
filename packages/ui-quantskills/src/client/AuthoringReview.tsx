import { useEffect, useState } from 'react'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { QuantSkillsAuthoringCommitResult, SessionId } from './plugin-types.ts'
import { ActionDialog } from './ActionDialog.tsx'
import { CapabilityIcon } from './CapabilityIcon.tsx'
import css from './QuantSkillsApp.module.css'

export interface AuthoringReviewInjected {
  hooks: { sessions: ObservableSnapshot<SessionListState> }
  commit: (sessionId: SessionId, callId: string, digest: string) => Promise<QuantSkillsAuthoringCommitResult>
  start: (result: QuantSkillsAuthoringCommitResult) => Promise<void>
  openLibrary: (kind: QuantSkillsAuthoringCommitResult['kind']) => void
  focusComposer: () => void
}

/** Always mounted in the session header, independent of collapsed tool history. */
export function AuthoringReview({ useSessions, commit, start, focusComposer, openLibrary }: InjectFace<AuthoringReviewInjected>) {
  const session = useSessions(state => state.current === undefined ? undefined : state.byId[state.current])
  const projected = session?.projectionValues?.quantSkillsAuthoringPending
  const [dismissed, setDismissed] = useState<string>()
  const [reopened, setReopened] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [launch, setLaunch] = useState(false)
  const [saved, setSaved] = useState<{ key: string; sessionId: SessionId; draft: NonNullable<typeof projected>; result: QuantSkillsAuthoringCommitResult }>()
  const [completed, setCompleted] = useState<SessionId>()
  const pending = projected ?? (saved?.sessionId === session?.id ? saved?.draft : undefined)
  const identity = session?.id + ':' + pending?.toolCallId
  useEffect(() => { setLaunch(false); setError(undefined) }, [identity])
  if (!session || !pending) return session?.id === completed ? <span role="status" className={css.reviewTrigger}>已生成 · 已加入我的创建</span> : null
  const key = session.id + ':' + pending.toolCallId + ':' + pending.treeDigest
  const visible = !session.running && (dismissed !== key || reopened === key)
  const label = pending.kind === 'skill' ? '技能' : pending.kind === 'agent' ? '专家' : '专家团'
  const close = () => { setDismissed(key); setReopened(undefined); setError(undefined); setLaunch(false); setSaved(undefined) }
  const confirm = async () => {
    setBusy(true); setError(undefined)
    try {
      const result = saved?.key === key ? saved.result : await commit(session.id, pending.toolCallId, pending.treeDigest)
      setSaved({ key, sessionId: session.id, draft: pending, result })
      if (launch) await start(result)
      setCompleted(session.id)
      close()
      if (!launch) openLibrary(result.kind)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '暂时无法生成，请重试。')
    } finally { setBusy(false) }
  }
  return <>
    <button type="button" className={css.reviewTrigger} disabled={session.running}
      onClick={() => { setReopened(key); setError(undefined) }}>待确认 · {label}</button>
    {visible && <ActionDialog title={'确认生成' + label} busy={busy} error={error} onClose={close}>
      <div className={css.reviewIdentity}><CapabilityIcon kind={pending.kind} size={34}/>
        <div><small>已准备就绪</small><h3>{pending.name}</h3></div></div>
      <p>{pending.description}</p>
      {pending.members.length > 0 && <details className={css.reviewDetails}>
        <summary>查看团队分工 · {pending.members.length} 位成员</summary>
        <ul>{pending.members.map((member, i) => <li key={i}>{member}</li>)}</ul>
      </details>}
      <label className={css.reviewLaunch}><input type="checkbox" checked={launch} disabled={busy}
        onChange={event => { setLaunch(event.target.checked) }}/>生成后立即开始使用</label>
      <footer>
        <button type="button" disabled={busy} onClick={() => { close(); focusComposer() }}>继续调整</button>
        <button type="button" data-primary disabled={busy} onClick={() => { void confirm() }}>
          {busy ? '正在处理…' : saved?.key === key ? '重试启动' : launch ? '生成并开始' : '确认生成'}</button>
      </footer>
    </ActionDialog>}
  </>
}
