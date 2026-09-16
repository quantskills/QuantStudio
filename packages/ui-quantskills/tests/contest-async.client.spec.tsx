// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useContest } from '../src/client/contest.ts'
import { useFactorContest } from '../src/client/factor-contest.ts'

afterEach(() => { cleanup(); vi.useRealTimers() })
const disconnected = { enabled: true, phase: 'disconnected' as const, message: '', updateAvailable: false, plans: [], budgets: [], runs: [] }
const connected = { ...disconnected, phase: 'connected' as const, identity: { accountId: 'a1', contestId: 'c1' } }

describe.each([['futures', useContest], ['factor', useFactorContest]] as const)('%s contest async recovery', (_name, useState) => {
  it('shows a completed connection immediately even if the following status refresh never returns', async () => {
    const access = { status: vi.fn(async () => disconnected), reconcile: vi.fn() }
    const { result } = renderHook(() => useState(access as never))
    await act(async () => {})
    access.status.mockImplementation(() => new Promise(() => {}))
    let completed = false
    await act(async () => { void result.current.run('connect', async () => connected).then(() => { completed = true }) })
    expect(result.current.status?.phase).toBe('connected')
    expect(result.current.busy).toBe('')
    expect(completed).toBe(true)
  })

  it('keeps slow polling responses instead of replacing them before they can render', async () => {
    vi.useFakeTimers()
    const access = { status: vi.fn(() => new Promise(resolve => { setTimeout(() => resolve(connected), 3000) })), reconcile: vi.fn() }
    const { result } = renderHook(() => useState(access as never))
    await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
    expect(result.current.status?.phase).toBe('connected')
    // No second status read should overlap the first slow read.
    expect(access.status.mock.calls.length).toBeLessThanOrEqual(3)
  })

  it('clears a temporary status failure when a later refresh succeeds', async () => {
    const access = { status: vi.fn().mockRejectedValueOnce(new Error('临时断线')).mockResolvedValue(connected), reconcile: vi.fn() }
    const { result } = renderHook(() => useState(access as never))
    await act(async () => {})
    expect(result.current.error).toBe('临时断线')
    await act(async () => { await result.current.refresh() })
    expect(result.current.status?.phase).toBe('connected')
    expect(result.current.error).toBeFalsy()
  })

  it('recovers from a status timeout and keeps an action failure visible across successful polls', async () => {
    vi.useFakeTimers()
    const access = { status: vi.fn().mockImplementationOnce(() => new Promise(() => {})).mockResolvedValue(connected), reconcile: vi.fn() }
    const { result } = renderHook(() => useState(access as never))
    await act(async () => { await vi.advanceTimersByTimeAsync(15000) })
    expect(result.current.error).toContain('响应超时')
    await act(async () => { await result.current.refresh() })
    expect(result.current.status?.phase).toBe('connected')
    expect(result.current.error).toBe('')
    await act(async () => { await result.current.run('research', async () => { throw new Error('无法打开对话') }) })
    await act(async () => { await result.current.refresh() })
    expect(result.current.error).toBe('无法打开对话')
    expect(result.current.busy).toBe('')
  })

  it('aborts the old surface action and ignores its late result when the conversation changes', async () => {
    const access = { status: vi.fn(async () => disconnected), reconcile: vi.fn() }
    const { result, rerender } = renderHook(({ sessionId }) => useState(access as never, sessionId), { initialProps: { sessionId: 'old' } })
    await act(async () => {})
    let finish!: (value: typeof connected) => void, signal!: AbortSignal, completed: boolean | undefined
    act(() => { void result.current.run('research', s => { signal = s; return new Promise(resolve => { finish = resolve }) }).then(ok => { completed = ok }) })
    rerender({ sessionId: 'new' })
    await act(async () => {})
    expect(signal.aborted).toBe(true)
    expect(completed).toBe(false)
    await act(async () => { finish(connected) })
    expect(result.current.status?.phase).toBe('disconnected')
    expect(result.current.busy).toBe('')
  })
})
