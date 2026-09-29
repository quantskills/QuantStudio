// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FlyPage } from '../src/client/FlyPage.tsx'
import type { FlyAccess } from '../src/client/fly/transport.ts'
import type { ContestAccess } from '../src/client/contest.ts'
import type { ContestPlan, ContestStatus } from '../src/client/plugin-types.ts'

vi.mock('../src/client/fly/FlyV2Page.tsx', () => ({ default: ({ tradePlans, openContest, openModelSettings, onOpenLife }: { onOpenLife?: () => void; tradePlans?: import('react').ReactNode; openContest?: () => void; openModelSettings?: () => void }) => <div>AI 交易员家园<button onClick={onOpenLife}>生活</button><button onClick={openContest}>比赛账户</button><button onClick={openModelSettings}>前往模型服务配置 Jev</button>{tradePlans}</div> }))
vi.mock('../src/client/fly/LifeGarden.tsx', () => ({ LifeGarden: () => <div>独立生命花园</div> }))
afterEach(cleanup)
const ready = { supported: true, installed: true, installing: false, running: true, message: '' }
const access = (): FlyAccess => ({ status: vi.fn(async () => ready), install: vi.fn(async () => ready), request: vi.fn(async () => ({})) })

describe('fly entry and automatic receipts', () => {
  it('allows a manual plan to execute only after the user confirms that plan', async () => {
    const identity = { accountId: 'a', contestId: 'c' }
    const plan: ContestPlan = { id: 'manual', sessionId: 'fly:manual-decision', identity, operation: 'place_order',
      createdAt: Date.now(), expiresAt: Date.now() + 60000, summary: 'AI 交易员 rb2610 待确认',
      details: { executionMode: 'manual', parameters: { contractCode: 'rb2610', side: 'buy', offset: 'open', volume: 1 } }, clientRequestId: 'r', status: 'prepared' }
    const status: ContestStatus = { enabled: true, phase: 'connected', identity, updateAvailable: false, message: '', plans: [plan] }
    const contest = { status: vi.fn(async () => status), execute: vi.fn(async () => ({ ...plan, status: 'queued' as const })),
      reconcile: vi.fn(async () => plan), dismiss: vi.fn(async () => status) } as unknown as ContestAccess
    render(<FlyPage access={access()} contest={contest}/>)
    fireEvent.click(await screen.findByText(plan.summary))
    expect(contest.execute).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '确认执行这笔交易' }))
    await waitFor(() => expect(contest.execute).toHaveBeenCalledExactlyOnceWith(plan))
  })
  it('opens model services separately from the competition account', async () => {
    const openModelSettings = vi.fn(), openContest = vi.fn()
    render(<FlyPage access={access()} openContest={openContest} openModelSettings={openModelSettings}/>)
    fireEvent.click(await screen.findByRole('button', { name: '前往模型服务配置 Jev' }))
    expect(openModelSettings).toHaveBeenCalledOnce()
    expect(openContest).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '比赛账户' }))
    expect(openContest).toHaveBeenCalledOnce()
    expect(screen.queryByLabelText('Jev API Key')).toBeNull()
  })

  it('prepares the isolated runtime from the entry page', async () => {
    const api = access()
    vi.mocked(api.status).mockResolvedValue({ ...ready, installed: false })
    render(<FlyPage access={api} openContest={() => {}} />)
    const button = await screen.findByRole('button', { name: '准备交易环境' })
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false))
    fireEvent.click(button)
    await screen.findByText('AI 交易员家园')
    expect(api.install).toHaveBeenCalledExactlyOnceWith({ neural: false })
  })

  it('reports a stalled runtime read instead of loading forever', async () => {
    vi.useFakeTimers()
    try {
      const api = access()
      vi.mocked(api.status).mockImplementation(() => new Promise(() => {}))
      render(<FlyPage access={api} openContest={() => {}} />)
      await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
      expect(screen.getByRole('alert').textContent).toContain('AI 交易员状态读取响应超时')
    } finally { vi.useRealTimers() }
  })

  it('shows only account-matched fly receipts without per-order confirmation', async () => {
    const identity = { accountId: 'a', contestId: 'c' }
    const plan: ContestPlan = { id: 'p', sessionId: 'fly:decision', identity, operation: 'place_order',
      createdAt: Date.now(), expiresAt: Date.now() + 60000, summary: 'AI 交易员 rb2610 开多 1 手',
      details: { executionMode: 'automatic', parameters: { contractCode: 'rb2610', side: 'buy', offset: 'open', volume: 1 } }, clientRequestId: 'r', status: 'prepared' }
    const status: ContestStatus = { enabled: true, phase: 'connected', identity, updateAvailable: false, message: '',
      plans: [plan, { ...plan, id: 'other', sessionId: 'chat', summary: '其他策略计划' },
        { ...plan, id: 'other-account', identity: { ...identity, accountId: 'another' }, summary: '其他账户委托' }] }
    const contest = { status: vi.fn(async () => status), execute: vi.fn(async () => ({ ...plan, status: 'queued' as const })),
      reconcile: vi.fn(async () => plan), dismiss: vi.fn(async () => status) } as unknown as ContestAccess
    render(<FlyPage access={access()} contest={contest} openContest={() => {}} />)
    fireEvent.click(await screen.findByText(plan.summary))
    expect(screen.queryByText('其他策略计划')).toBeNull()
    expect(contest.execute).not.toHaveBeenCalled()
    expect(screen.queryByText('其他账户委托')).toBeNull()
    expect(screen.queryByRole('button', { name: '确认执行这笔交易' })).toBeNull()
    expect(screen.getByText('自动交易回执')).toBeTruthy()
  })
})

  it('opens life without any installed runtime or account, and stops status polling', async () => {
    vi.useFakeTimers()
    try {
      const api = access()
      vi.mocked(api.status).mockResolvedValue({ ...ready, installed: false })
      render(<FlyPage access={api} openContest={() => {}} />)
      await act(async () => {})
      fireEvent.click(screen.getByRole('button', { name: '生活', exact: true }))
      expect(screen.getByText('独立生命花园')).toBeTruthy()
      vi.mocked(api.status).mockClear()
      await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
      expect(api.status).not.toHaveBeenCalled()
      expect(api.install).not.toHaveBeenCalled()
      expect(api.request).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: '交易', exact: true }))
      expect(screen.queryByText('独立生命花园')).toBeNull()
      expect(api.status).toHaveBeenCalledOnce()
    } finally { vi.useRealTimers() }
  })

  it('keeps life accessible even when the host service is unavailable', () => {
    render(<FlyPage openContest={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '生活', exact: true }))
    expect(screen.getByText('独立生命花园')).toBeTruthy()
  })
