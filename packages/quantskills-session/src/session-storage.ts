/** Bounded compatibility helpers over the new handle-based persistence API. */
import type { SessionPersistence, SessionInspection } from '@deepseek-ai/dsh-session-persistence'
import type { SessionHeader, SessionId } from '@deepseek-ai/dsh-session'

export async function inspectSession(persistence: SessionPersistence, id: SessionId, signal?: AbortSignal): Promise<SessionInspection> {
  const handle = await persistence.open(id, 'read', signal ? { signal } : undefined)
  try {
    const { events } = await handle.read(0, undefined, signal ? { signal } : undefined)
    return { meta: handle.header, inheritedEventCount: handle.inheritedEventCount, events }
  } finally { await handle.close() }
}

export async function listSessionHeaders(persistence: SessionPersistence, signal?: AbortSignal): Promise<SessionHeader[]> {
  return (await persistence.list(signal ? { signal } : undefined)).map(item => item.header)
}
