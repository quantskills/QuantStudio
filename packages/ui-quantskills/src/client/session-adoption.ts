import type { ISessions, SessionBinding, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** Hold a new session through setup until its view takes ownership. */
export interface AdoptedSession extends Disposable {
  readonly sessionId: SessionId
  readonly summary: SessionSummary
  readonly session: SessionBinding['session']
  release(): void
}

function cancellable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason)
    signal.addEventListener('abort', abort, { once: true })
    operation.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
    if (signal.aborted) abort()
  })
}

/** rc.2 catalog membership does not create a binding: acquire it explicitly. */
export async function adoptQuantSkillsSession(
  sessions: ISessions,
  id: SessionId,
  caller: AbortSignal,
  accept: (summary: SessionSummary) => boolean = () => true,
): Promise<AdoptedSession> {
  const deadline = new AbortController()
  const timer = setTimeout(() => deadline.abort(new Error('会话接入超时。请从会话列表打开已创建的会话，无需重复创建。')), 30_000)
  const signal = AbortSignal.any([caller, deadline.signal])
  let release: (() => void) | undefined
  try {
    signal.throwIfAborted()
    if (sessions.list.getSnapshot().byId[id] === undefined) {
      await cancellable(sessions.refresh(), signal)
    }
    signal.throwIfAborted()
    const reference = sessions.retain(id, { source: 'controllerOperation', signal })
    release = () => reference.release()
    const binding = await cancellable(reference.ready, signal)
    await cancellable(sessions.refreshProjections(id), signal)
    signal.throwIfAborted()
    const summary = sessions.list.getSnapshot().byId[id]
    if (summary === undefined || !accept(summary)) {
      throw new Error('会话配置未完成校验。请从会话列表重新打开，不要重复创建。')
    }
    return { sessionId: id, summary, session: binding.session, release, [Symbol.dispose]: release }
  } catch (error) {
    release?.()
    throw error
  } finally {
    clearTimeout(timer)
  }
}
