// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FlyPage } from '../src/client/FlyPage.tsx'
import type { FlyAccess } from '../src/client/fly/transport.ts'
import type { ContestAccess } from '../src/client/contest.ts'
import type { ContestPlan, ContestStatus } from '../src/client/plugin-types.ts'

vi.mock('../src/client/fly/FlyV2Page.tsx', () => ({ default: ({ tradePlans, openContest, openModelSettings }: { tradePlans?: import('react').ReactNode; openContest?: () => void; openModelSettings?: () => void }) => <div>果蝇家园<button onClick={openContest}>比赛账户</button><button onClick={openModelSettings}>前往模型服务配置 Jev</button>{tradePlans}</div> }))
afterEach(cleanup)
const ready = { supported: true, installed: true, installing: false, running: true, message: '' }
const access = (): FlyAccess => ({ status: vi.fn(async () => ready), install: vi.fn(async () => ready), request: vi.fn(async () => ({})) })

describe('fly entry and manual confirmation', () => {
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
    const button = await screen.findByRole('button', { name: '一键准备果蝇' })
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false))
    fireEvent.click(button)
    await screen.findByText('果蝇家园')
    expect(api.install).toHaveBeenCalledExactlyOnceWith({ blenderPath: '' })
  })

  it('reports a stalled runtime read instead of loading forever', async () => {
    vi.useFakeTimers()
    try {
      const api = access()
      vi.mocked(api.status).mockImplementation(() => new Promise(() => {}))
      render(<FlyPage access={api} openContest={() => {}} />)
      await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
      expect(screen.getByRole('alert').textContent).toContain('果蝇状态读取响应超时')
    } finally { vi.useRealTimers() }
  })

  it('shows only fly plans and executes once after an explicit confirmation click', async () => {
    const identity = { accountId: 'a', contestId: 'c' }
    const plan: ContestPlan = { id: 'p', sessionId: 'fly:decision', identity, operation: 'place_order',
      createdAt: Date.now(), expiresAt: Date.now() + 60000, summary: '果蝇 rb2610 开多 1 手',
      details: { parameters: { contractCode: 'rb2610', side: 'buy', offset: 'open', volume: 1 } }, clientRequestId: 'r', status: 'prepared' }
    const status: ContestStatus = { enabled: true, phase: 'connected', identity, updateAvailable: false, message: '',
      plans: [plan, { ...plan, id: 'other', sessionId: 'chat', summary: '其他策略计划' }] }
    const contest = { status: vi.fn(async () => status), execute: vi.fn(async () => ({ ...plan, status: 'queued' as const })),
      reconcile: vi.fn(async () => plan), dismiss: vi.fn(async () => status) } as unknown as ContestAccess
    render(<FlyPage access={access()} contest={contest} openContest={() => {}} />)
    fireEvent.click(await screen.findByText(plan.summary))
    expect(screen.queryByText('其他策略计划')).toBeNull()
    expect(contest.execute).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '确认执行这笔交易' }))
    await waitFor(() => expect(contest.execute).toHaveBeenCalledExactlyOnceWith(plan))
  })
})
