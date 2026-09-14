/** Compact PandaData MCP status and connection control for QuantSkills conversation surfaces. */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { HeroAccessoryOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PandaMcpStatus } from './plugin-types.ts'
import type { QuantSkillsConversationBrandInjected } from './QuantSkillsBrand.tsx'
import { pandaMcpPhaseLabel, pandaMcpSignal } from './panda-mcp-presentation.ts'
import pandaMarkUrl from './assets/pandaai-mark.png'
import css from './QuantSkillsApp.module.css'

/** Host and QuantSkills state required by the composer PandaData control. */
export interface QuantSkillsPandaMcpControlInjected extends QuantSkillsConversationBrandInjected {
  status: () => Promise<PandaMcpStatus>
  authenticate: () => Promise<PandaMcpStatus>
  refresh: () => Promise<PandaMcpStatus>
  logout: () => Promise<PandaMcpStatus>
}

/** Complete props for the composer PandaData integration control. */
export type QuantSkillsPandaMcpControlProps = PropsRuntime<'conversation.input.left'>
  & InjectFace<QuantSkillsPandaMcpControlInjected>

/** Complete props for the blank-session Hero PandaData integration control. */
export type QuantSkillsPandaMcpHeroControlProps = HeroAccessoryOwnerProps
  & InjectFace<QuantSkillsPandaMcpControlInjected>

interface QuantSkillsPandaMcpSurfaceProps {
  visible: boolean
  status: QuantSkillsPandaMcpControlInjected['status']
  authenticate: QuantSkillsPandaMcpControlInjected['authenticate']
  refresh: QuantSkillsPandaMcpControlInjected['refresh']
  logout: QuantSkillsPandaMcpControlInjected['logout']
}

function QuantSkillsPandaMcpSurface({
  visible, status, authenticate, refresh, logout,
}: QuantSkillsPandaMcpSurfaceProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [snapshot, setSnapshot] = useState<PandaMcpStatus>()
  const [statusError, setStatusError] = useState<string>()
  const [actionError, setActionError] = useState<string>()
  const [busy, setBusy] = useState(false)

  const poll = useCallback(async (): Promise<void> => {
    try {
      setSnapshot(await status())
      setStatusError(undefined)
    } catch (cause: unknown) {
      setStatusError(cause instanceof Error ? cause.message : '无法读取 PandaData 连接状态。')
    }
  }, [status])

  useEffect(() => {
    if (!visible) return
    void poll()
    const timer = window.setInterval(() => { void poll() }, open ? 4_000 : 10_000)
    return () => { window.clearInterval(timer) }
  }, [visible, open, poll])

  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent): void => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false)
    }
    const escape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss, true)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss, true)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  if (!visible) return null
  const phase = snapshot?.phase ?? 'disconnected'
  const connected = phase === 'connected'
  const enabled = phase !== 'disconnected'
  const signal = pandaMcpSignal(phase)
  const label = pandaMcpPhaseLabel(phase)
  const error = actionError ?? statusError
  const run = async (action: () => Promise<PandaMcpStatus>): Promise<void> => {
    setBusy(true)
    setActionError(undefined)
    try {
      setSnapshot(await action())
      setStatusError(undefined)
    } catch (cause: unknown) {
      setActionError(cause instanceof Error ? cause.message : 'PandaData 操作失败。')
      await poll()
    } finally {
      setBusy(false)
    }
  }

  return <div ref={rootRef} className={css.pandaMcpControl}>
    <button
      type="button"
      className={css.pandaMcpTrigger}
      aria-label={`PandaData MCP：${label}`}
      aria-haspopup="dialog"
      aria-expanded={open}
      title={`PandaData MCP：${label}`}
      onClick={() => { setOpen(current => !current) }}
    >
      <img src={pandaMarkUrl} alt="" aria-hidden="true"/>
      <span className={css.pandaMcpSignal} data-signal={signal} aria-hidden="true" />
    </button>
    {open && <section className={css.pandaMcpPopover} role="dialog" aria-label="PandaData MCP 连接">
      <header>
        <span>
          <img src={pandaMarkUrl} alt="" aria-hidden="true" />
          <strong>PandaData MCP</strong>
        </span>
        <button
          type="button"
          role="switch"
          aria-label="启用 PandaData MCP"
          aria-checked={enabled}
          className={css.pandaMcpSwitch}
          disabled={busy || phase === 'authenticating'}
          onClick={() => { void run(enabled ? logout : authenticate) }}
        ><span aria-hidden="true" /></button>
      </header>
      <div className={css.pandaMcpState} role="status">
        <span className={css.pandaMcpSignal} data-signal={signal} aria-hidden="true" />
        <strong>{label}</strong>
      </div>
      <p role={error === undefined ? undefined : 'alert'}>
        {error ?? snapshot?.message ?? '连接后即可在会话中调用 PandaData 数据能力。'}
      </p>
      <button
        type="button"
        className={css.pandaMcpAction}
        disabled={busy || (phase === 'authenticating' && !snapshot?.authorizationUrl)}
        onClick={() => { void run(connected ? refresh : authenticate) }}
      >{snapshot?.authorizationUrl ? '继续 PandaData 授权' : busy || phase === 'authenticating' ? '连接中…' : connected ? '刷新连接' : '连接 PandaData'}</button>
    </section>}
  </div>
}

/** Render PandaData beside the blank-session preset selector. */
export function QuantSkillsPandaMcpHeroControl({
  mode, useView, status, authenticate, refresh, logout,
}: QuantSkillsPandaMcpHeroControlProps) {
  const pluginConversationOpen = useView(state => state.pluginOpen && state.pluginConversationOpen)
  return <QuantSkillsPandaMcpSurface
    visible={mode === 'standalone' || pluginConversationOpen}
    status={status}
    authenticate={authenticate}
    refresh={refresh}
    logout={logout}
  />
}

/** Render PandaData in the composer after conversation activity begins. */
export function QuantSkillsPandaMcpControl({
  mode, useView, useConversation, session, status, authenticate, refresh, logout,
}: QuantSkillsPandaMcpControlProps) {
  const conversation = useConversation(state => state)
  const pluginConversationOpen = useView(state => state.pluginOpen && state.pluginConversationOpen)
  const started = conversation.activeTargets.size > 0
    || session.promptAttempted || session.running
    || (!session.blank && !session.awaitingFirstTurn)
  return <QuantSkillsPandaMcpSurface
    visible={(mode === 'standalone' || pluginConversationOpen) && started}
    status={status}
    authenticate={authenticate}
    refresh={refresh}
    logout={logout}
  />
}
