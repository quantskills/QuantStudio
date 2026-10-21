import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ISessions, SessionBinding, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { adoptQuantSkillsSession } from '../src/client/session-adoption.ts'

const id = 'session-new' as SessionId
function fixture() {
  const opening = Promise.withResolvers<SessionBinding>()
  const summary = { sessionId: id } as SessionSummary
  let listed = false
  let retained = false
  const binding = { sessionId: id, session: {} } as SessionBinding
  const release = vi.fn(() => { retained = false })
  const sessions = {
    list: { getSnapshot: () => ({ byId: listed ? { [id]: summary } : {} }) },
    binding: () => retained ? binding : undefined,
    refresh: vi.fn(async () => { listed = true }),
    refreshProjections: vi.fn(async () => {}),
    retain: vi.fn(() => { retained = true; return { ready: opening.promise, release } }),
  }
  return { sessions, opening, binding, release, port: sessions as unknown as ISessions }
}

afterEach(() => vi.useRealTimers())
describe('rc.2 session adoption', () => {
  it('acquires an unselected session instead of waiting for a binding that cannot exist', async () => {
    const f = fixture()
    expect(f.sessions.binding()).toBeUndefined()
    const result = adoptQuantSkillsSession(f.port, id, new AbortController().signal)
    await vi.waitFor(() => expect(f.sessions.retain).toHaveBeenCalledWith(id, expect.objectContaining({ source: 'controllerOperation' })))
    expect(f.release).not.toHaveBeenCalled()
    f.opening.resolve(f.binding)
    const adopted = await result
    expect(adopted.session).toBe(f.binding.session)
    expect(f.sessions.refreshProjections).toHaveBeenCalledWith(id)
    expect(f.release).not.toHaveBeenCalled()
    adopted[Symbol.dispose]()
    expect(f.release).toHaveBeenCalledOnce()
  })

  it('releases on exact-composition mismatch without publishing an unverified session', async () => {
    const f = fixture()
    f.opening.resolve(f.binding)
    await expect(adoptQuantSkillsSession(f.port, id, new AbortController().signal, () => false)).rejects.toThrow('配置未完成校验')
    expect(f.release).toHaveBeenCalledOnce()
  })

  it('releases when the initial history opening fails', async () => {
    const f = fixture()
    const opening = adoptQuantSkillsSession(f.port, id, new AbortController().signal)
    await vi.waitFor(() => expect(f.sessions.retain).toHaveBeenCalledOnce())
    f.opening.reject(new Error('history failed'))
    await expect(opening).rejects.toThrow('history failed')
    expect(f.release).toHaveBeenCalledOnce()
  })

  it('cancels an in-flight acquisition and does not retain after pre-cancellation', async () => {
    const f = fixture(), controller = new AbortController()
    const opening = adoptQuantSkillsSession(f.port, id, controller.signal)
    await vi.waitFor(() => expect(f.sessions.retain).toHaveBeenCalledOnce())
    controller.abort(new Error('cancelled'))
    await expect(opening).rejects.toThrow('cancelled')
    expect(f.release).toHaveBeenCalledOnce()
    const untouched = fixture()
    await expect(adoptQuantSkillsSession(untouched.port, id, controller.signal)).rejects.toThrow('cancelled')
    expect(untouched.sessions.refresh).not.toHaveBeenCalled()
    expect(untouched.sessions.retain).not.toHaveBeenCalled()
  })

  it('bounds a stalled catalog refresh and tells the user not to create a duplicate', async () => {
    vi.useFakeTimers()
    const f = fixture()
    f.sessions.refresh.mockImplementation(() => new Promise(() => {}))
    const rejected = expect(adoptQuantSkillsSession(f.port, id, new AbortController().signal)).rejects.toThrow('无需重复创建')
    await vi.advanceTimersByTimeAsync(30_000)
    await rejected
    expect(f.sessions.retain).not.toHaveBeenCalled()
  })
})
