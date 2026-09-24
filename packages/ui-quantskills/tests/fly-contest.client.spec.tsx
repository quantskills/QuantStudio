// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FlyContestPanel } from '../src/client/FlyContestPanel.tsx'
import type { FlyAccess } from '../src/client/fly/transport.ts'
import type { ContestStatus } from '../src/client/plugin-types.ts'

afterEach(() => { cleanup(); vi.useRealTimers() })
const identity = { contestId: 'futures', accountId: 'account-a' }
const contest: ContestStatus = { enabled: true, phase: 'connected', identity, plans: [], updateAvailable: false, message: '' }
const state = { name: '小果', binding: { identity }, settings: { instruments: [{ symbol: 'rb2610' }], life_validation: false },
  connection: { status: 'ready', message: '已连接' }, history: { status: 'idle' },
  markets: [{ product: 'rb', symbol: 'rb2610', count: 300, readiness: 'history_incomplete', long: 1, short: 0, quote_at: Date.now() / 1000 }],
  control: { trading: false }, environment: { brain_ready: true, blender_ready: true, progress: { status: 'ready' } } }
const runtime = { supported: true, installed: true, running: true, installing: false, message: '已就绪' }

describe('fly module in the futures competition', () => {
  it('shows only its account-matched plans and confirmed fills, without executing an order', async () => {
    const plan = { id: 'fly-plan', sessionId: 'fly:decision', identity, operation: 'place_order' as const,
      status: 'prepared' as const, createdAt: Date.now(), expiresAt: Date.now() + 60000, summary: '果蝇开多 1 手', details: {}, clientRequestId: 'r' }
    const other = { ...plan, id: 'other-plan', sessionId: 'chat', summary: '人工计划' }
    const request = vi.fn(async ({ path }: { path: string }) => path === 'state' ? state : {
      summary: { fill_count: 1, realized_gross: 120 }, fills: [{ seq: 1, time: '09:30:00', symbol: 'rb2610', direction: '0', offset: '0', volume: 1, price: 3300, trade_id: 'fly-fill' }], note: '' })
    const access = { status: vi.fn(async () => runtime), install: vi.fn(), request } as unknown as FlyAccess
    const openFly = vi.fn()
    render(<FlyContestPanel access={access} contest={{ ...contest, plans: [plan, other] }} openFly={openFly}/>)
    const toggle = screen.getByRole('button', { name: /果蝇交易员.*展开/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    await screen.findByText('+120.00')
    expect(screen.queryByRole('button', { name: '查看并确认计划' })).toBeNull()
    fireEvent.click(toggle)
    await screen.findByText('fly-fill')
    expect(screen.getByText('果蝇开多 1 手', { exact: false })).toBeTruthy()
    expect(screen.queryByText('人工计划')).toBeNull()
    expect(screen.getByText('+120.00')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '查看并确认计划' }))
    expect(openFly).toHaveBeenCalledOnce()
    expect(request.mock.calls.every(([input]) => input.path === 'state' || input.path === 'statistics')).toBe(true)
  })

  it('hides trade data and actions when the fly belongs to another contest account', async () => {
    const request = vi.fn(async () => ({ ...state, binding: { identity: { ...identity, accountId: 'account-b' } } }))
    const access = { status: vi.fn(async () => runtime), install: vi.fn(), request } as unknown as FlyAccess
    render(<FlyContestPanel access={access} contest={contest} openFly={() => {}} />)
    await screen.findByText(/此果蝇属于另一个比赛账户/)
    expect(screen.queryByText('当日柜台成交')).toBeNull()
    expect(screen.queryByRole('button', { name: '开始生成待确认计划' })).toBeNull()
    expect(request).not.toHaveBeenCalledWith({ path: 'statistics' })
  })

  it('opens the shared preparation page instead of keeping another setup form', async () => {
    const access = { status: vi.fn(async () => ({ ...runtime, installed: false, running: false })),
      install: vi.fn(async () => ({ ...runtime, installed: false, running: false, installing: true })), request: vi.fn() } as unknown as FlyAccess
    const openFly = vi.fn()
    render(<FlyContestPanel access={access} contest={contest} openFly={openFly} />)
    const button = await screen.findByRole('button', { name: '准备果蝇交易员' })
    fireEvent.click(button)
    expect(openFly).toHaveBeenCalledOnce()
    expect(access.install).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('updates summary while collapsed and hides old account data immediately on switching accounts', async () => {
    vi.useFakeTimers()
    let count = 1
    const request = vi.fn(async ({ path }: { path: string }) => path === 'state' ? state : { summary: { fill_count: count, realized_gross: count * 100 }, fills: [], note: '' })
    const access = { status: vi.fn(async () => runtime), request } as unknown as FlyAccess
    const view = render(<FlyContestPanel access={access} contest={contest} openFly={() => {}} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(screen.getByText('+100.00')).toBeTruthy()
    count = 2
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(screen.getByText('+200.00')).toBeTruthy()
    expect(screen.getByRole('button', { name: /果蝇交易员.*展开/ }).getAttribute('aria-expanded')).toBe('false')
    view.rerender(<FlyContestPanel access={access} contest={{ ...contest, identity: { ...identity, accountId: 'b' } }} openFly={() => {}} />)
    expect(screen.queryByText('+200.00')).toBeNull()
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(screen.getByText(/此果蝇属于另一个比赛账户/)).toBeTruthy()
  })

  it.each(['ready', 'waiting'])('uses the shared history job when the quote connection is %s', async connection => {
    const request = vi.fn(async ({ path }: { path: string }) => path === 'state' ? { ...state, connection: { status: connection, message: '行情连接状态' } } : path === 'control' ? { history: { status: 'running' } } : { summary: { fill_count: 0, realized_gross: null }, fills: [], note: '' })
    const access = { status: vi.fn(async () => runtime), request } as unknown as FlyAccess
    render(<FlyContestPanel access={access} contest={contest} openFly={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /果蝇交易员.*展开/ }))
    const button = await screen.findByRole('button', { name: '获取历史数据' })
    fireEvent.click(button)
    await waitFor(() => expect(request).toHaveBeenCalledWith({ path: 'control', body: { action: 'history' } }))
    expect(screen.getByRole('button', { name: '正在获取历史数据…' }).matches(':disabled')).toBe(true)
    expect(screen.getByText('1 / 0')).toBeTruthy()
  })
})
