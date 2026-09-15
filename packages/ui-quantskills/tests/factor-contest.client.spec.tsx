// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import { bindSnapshotSelector } from './bind-snapshot.ts'
import { FactorContestPage } from '../src/client/FactorContestPage.tsx'
import { FactorPlans } from '../src/client/FactorPlans.tsx'
import { FactorContestReview } from '../src/client/FactorContestReview.tsx'
import { CompetitionHub } from '../src/client/CompetitionHub.tsx'
import type { FactorContestAccess } from '../src/client/factor-contest.ts'
import type { FactorContestStatus, FactorPlan } from '../src/client/plugin-types.ts'

afterEach(() => { cleanup(); sessionStorage.clear(); vi.useRealTimers() })
const identity = { accountId: 'u1', contestId: 'pandaai-fourth-factor' }
function plan(): FactorPlan { return { id: 'p1', sessionId: 's1', identity, createdAt: Date.now(), expiresAt: Date.now() + 600000, status: 'prepared', summary: '授权一批因子研究', snapshot: {}, snapshotHash: 'x',
  action: { kind: 'budget', batch: { hypothesis: '低换手反转', maxRuns: 5, creditThreshold: 10, cycle: 5, startDate: '20240101', endDate: '20241231' } } } }
function fixture(initial: Partial<FactorContestStatus> = {}) {
  let state: FactorContestStatus = { enabled: false, phase: 'off', updateAvailable: false, message: '', plans: [], budgets: [], runs: [], ...initial }
  const inspection = { identity, fetchedAt: Date.now(), balance: 100, registration: {}, pool: { pool_id: 'pool1', name: '测试池', status: 'draft', rebalance_cycle_days: 5, ready_factor_count: 5, active_factor_count: 0, modification_window: { open: false }, factors: [] } }
  const access: FactorContestAccess = {
    status: vi.fn(async () => state), mode: vi.fn(async enabled => { state = { ...state, enabled, phase: enabled ? 'disconnected' : 'off' }; return state }),
    connect: vi.fn(async () => { state = { ...state, phase: 'connected', identity, inspection }; return state }), disconnect: vi.fn(async () => { state = { ...state, phase: 'disconnected' }; return state }),
    checkUpdate: vi.fn(async () => state), update: vi.fn(async () => state), inspect: vi.fn(async () => inspection), query: vi.fn(async () => ({ items: [] })),
    prepare: vi.fn(async action => { const p = { ...plan(), action }; state = { ...state, plans: [p] }; return p }),
    confirm: vi.fn(async p => { const confirmed = { ...p, status: 'completed' as const }; state = { ...state, plans: [confirmed] }; return confirmed }),
    dismiss: vi.fn(async () => {}), stopBudget: vi.fn(async () => {}), reconcileRun: vi.fn(async () => ({} as never)), reconcilePlan: vi.fn(async () => plan()),
    startResearch: vi.fn(async () => {}), requestResearch: vi.fn(async () => {}),
  }
  return { access, state: () => state, set: (change: Partial<FactorContestStatus>) => { state = { ...state, ...change } }, inspection }
}
describe('factor workbench', () => {
  it('cancels a pending dashboard inspection before checking the connection', async () => {
    const f = fixture({ enabled: true, phase: 'connected', identity })
    let signal!: AbortSignal
    vi.mocked(f.access.inspect).mockImplementationOnce((_session, s) => { signal = s!; return new Promise(() => {}) })
    render(<FactorContestPage access={f.access}/>)
    await waitFor(() => expect(f.access.inspect).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: '检查连接' }))
    await waitFor(() => expect(signal.aborted).toBe(true))
  })
  it('recovers from a stalled inspection without blocking navigation or connection', async () => {
    vi.useFakeTimers()
    const f = fixture({ enabled: true, phase: 'connected', identity })
    let signal!: AbortSignal
    vi.mocked(f.access.inspect).mockImplementationOnce((_session, s) => { signal = s!; return new Promise(() => {}) })
    render(<FactorContestPage access={f.access}/>)
    await act(async () => {})
    await act(async () => { await vi.advanceTimersByTimeAsync(30000) })
    expect(signal.aborted).toBe(true)
    expect(screen.getByRole('alert').textContent).toContain('响应超时')
    expect((screen.getByRole('button', { name: '检查连接' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: '刷新当前数据' }))
    await act(async () => {})
    expect(screen.queryByRole('alert')).toBeNull()
  })
  it('allows closing a timed-out confirmation without authorizing the same batch twice', async () => {
    vi.useFakeTimers()
    const pending = plan(), f = fixture({ enabled: true, phase: 'connected', identity, plans: [pending] })
    vi.mocked(f.access.confirm).mockImplementation(() => new Promise(() => {}))
    render(<FactorPlans status={f.state()} access={f.access} refresh={async () => {}}/>)
    fireEvent.click(screen.getByRole('button', { name: /授权一批因子研究/ }))
    fireEvent.click(screen.getByRole('button', { name: '确认授权本批次' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(60000) })
    expect(screen.getByRole('alert').textContent).toContain('请勿重复提交')
    expect((screen.getByRole('button', { name: '确认授权本批次' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '关闭确认因子比赛操作' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(f.access.confirm).toHaveBeenCalledTimes(1)
  })
  it('loads the newly selected tab while an older read is pending without locking connection controls', async () => {
    const f = fixture({ enabled: true, phase: 'connected', identity })
    let finish!: (value: typeof f.inspection) => void
    vi.mocked(f.access.inspect).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    vi.mocked(f.access.query).mockResolvedValue({ items: [{ workflow_id: 'fresh-workflow', name: '最新工作流', selectable: true }] })
    render(<FactorContestPage access={f.access}/>)
    await waitFor(() => expect(f.access.inspect).toHaveBeenCalled())
    expect((screen.getByRole('button', { name: '检查连接' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('tab', { name: '可入池工作流' }))
    await screen.findByText('最新工作流')
    await act(async () => { finish(f.inspection) })
    expect(screen.getByText('最新工作流')).toBeTruthy()
  })
  it('is opt-in and does not log in or inspect an account just by opening the page', async () => {
    const f = fixture(); render(<FactorContestPage access={f.access}/>)
    const toggle = await screen.findByRole('switch', { name: '因子比赛模式' })
    await waitFor(() => expect((toggle as HTMLButtonElement).disabled).toBe(false))
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(f.access.connect).not.toHaveBeenCalled(); expect(f.access.inspect).not.toHaveBeenCalled(); expect(f.access.query).not.toHaveBeenCalled()
    fireEvent.click(toggle); await screen.findByRole('button', { name: '登录并连接' })
    expect(f.access.connect).not.toHaveBeenCalled()
  })
  it('clears the password field after submitting and enters the dedicated AI session', async () => {
    const f = fixture({ enabled: true, phase: 'disconnected' }); render(<FactorContestPage access={f.access}/>)
    fireEvent.click(await screen.findByRole('button', { name: '登录并连接' }))
    fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '13800000000' } }); fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'private-password' } })
    fireEvent.click(screen.getByRole('button', { name: '连接因子账户' }))
    await waitFor(() => expect(f.access.connect).toHaveBeenCalledWith({ phone: '13800000000', password: 'private-password' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '连接 PandaAI 因子账户' })).toBeNull())
    expect(document.body.textContent).not.toContain('private-password')
    await waitFor(() => expect((screen.getByRole('button', { name: '进入 AI 因子助手' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: '进入 AI 因子助手' })); await waitFor(() => expect(f.access.startResearch).toHaveBeenCalledOnce())
  })
  it('can disable while a connection is pending and discards its late UI result', async () => {
    const f = fixture({ enabled: true, phase: 'disconnected' }); let resolve!: (value: FactorContestStatus) => void
    vi.mocked(f.access.connect).mockImplementation(() => new Promise(r => { resolve = r }))
    render(<FactorContestPage access={f.access}/>); fireEvent.click(await screen.findByRole('button', { name: '检查连接' }))
    await waitFor(() => expect(resolve).toBeDefined()); fireEvent.click(screen.getByRole('switch', { name: '因子比赛模式' }))
    await screen.findByText('从因子想法到正式参赛')
    await act(async () => { resolve({ ...f.state(), enabled: true, phase: 'connected', identity }) })
    expect(screen.queryByRole('button', { name: '进入 AI 因子助手' })).toBeNull()
  })
  it('prepares a submission but never confirms automatically', async () => {
    const f = fixture({ enabled: true, phase: 'connected', identity }); f.set({ inspection: f.inspection })
    render(<FactorContestPage access={f.access}/>); const submit = await screen.findByRole('button', { name: '准备正式参赛' })
    await waitFor(() => expect((submit as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(submit)
    await waitFor(() => expect(f.access.prepare).toHaveBeenCalledWith({ kind: 'submit-pool' }))
    expect(f.access.confirm).not.toHaveBeenCalled()
  })
  it('switches between competitions without connecting either automatically', async () => {
    const f = fixture(); render(<CompetitionHub factorAccess={f.access}/>)
    fireEvent.click(screen.getByRole('button', { name: '第四届因子大赛' }))
    await screen.findByRole('switch', { name: '因子比赛模式' })
    fireEvent.click(screen.getByRole('button', { name: '期货模拟赛' }))
    expect(screen.queryByRole('switch', { name: '因子比赛模式' })).toBeNull(); expect(f.access.connect).not.toHaveBeenCalled()
  })
})
describe('factor confirmation cards', () => {
  it('shows a completed confirmation without waiting for a stalled status refresh', async () => {
    const f = fixture({ enabled: true, phase: 'connected', identity, plans: [plan()] })
    render(<FactorPlans status={f.state()} access={f.access} refresh={() => new Promise(() => {})}/>)
    fireEvent.click(screen.getByRole('button', { name: /授权一批因子研究/ }))
    fireEvent.click(screen.getByRole('button', { name: '确认授权本批次' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: '确认授权本批次' })).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: '关闭确认因子比赛操作' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(f.access.confirm).toHaveBeenCalledOnce()
  })
  it('shows the budget limitation and sends one confirmation despite double clicking', async () => {
    const f = fixture({ enabled: true, phase: 'connected', identity, plans: [plan()] })
    let finish!: (p: FactorPlan) => void
    vi.mocked(f.access.confirm).mockImplementation(() => new Promise(r => { finish = r }))
    render(<FactorPlans status={f.state()} access={f.access} refresh={async () => {}}/>)
    fireEvent.click(screen.getByRole('button', { name: /授权一批因子研究/ }))
    expect(screen.getByText(/已启动的回测可能越过阈值/)).toBeTruthy()
    const confirm = screen.getByRole('button', { name: '确认授权本批次' }); fireEvent.click(confirm); fireEvent.click(confirm)
    expect(f.access.confirm).toHaveBeenCalledOnce()
    await act(async () => { finish({ ...plan(), status: 'completed' }) })
  })
  it('disables confirmation when the identity differs or the plan expires', () => {
    const f = fixture({ enabled: true, phase: 'connected', identity: { ...identity, accountId: 'different' }, plans: [plan()] })
    render(<FactorPlans status={f.state()} access={f.access} refresh={async () => {}}/>); fireEvent.click(screen.getByRole('button', { name: /授权一批/ }))
    expect((screen.getByRole('button', { name: '确认授权本批次' }) as HTMLButtonElement).disabled).toBe(true)
    expect(f.access.confirm).not.toHaveBeenCalled()
  })
  it('closes the confirmation when factor mode turns off', () => {
    const f = fixture({ enabled: true, phase: 'connected', identity, plans: [plan()] })
    const view = render(<FactorPlans status={f.state()} access={f.access} refresh={async () => {}}/>)
    fireEvent.click(screen.getByRole('button', { name: /授权一批/ })); f.set({ enabled: false, phase: 'off' })
    view.rerender(<FactorPlans status={f.state()} access={f.access} refresh={async () => {}}/>)
    expect(screen.queryByRole('dialog', { name: '确认因子比赛操作' })).toBeNull()
  })
})
describe('factor conversation isolation', () => {
  const sessions = (purpose: string) => createSnapshotStore<SessionListState>({ current: 's1', byId: { s1: { id: 's1', running: false,
    projectionValues: { quantSkillsPlainSession: { purpose, ...(purpose === 'factor-contest' ? { factorContest: identity } : {}) } } } } } as unknown as SessionListState)
  it.each(['ordinary', 'contest'])('never reads factor credentials or state in %s conversations', purpose => {
    const f = fixture({ enabled: true, phase: 'connected', identity }); render(<FactorContestReview useSessions={bindSnapshotSelector(sessions(purpose))} access={f.access} openContest={() => {}}/>)
    expect(f.access.status).not.toHaveBeenCalled(); expect(f.access.inspect).not.toHaveBeenCalled()
  })
  it('inspects on entry, and requires a user action to start research', async () => {
    const f = fixture({ enabled: true, phase: 'connected', identity })
    render(<FactorContestReview useSessions={bindSnapshotSelector(sessions('factor-contest'))} access={f.access} openContest={() => {}}/>)
    await screen.findByText(/算力 100/); expect(f.access.inspect).toHaveBeenCalledExactlyOnceWith('s1', expect.any(AbortSignal)); expect(f.access.requestResearch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '继续预算内研究' }))
    await waitFor(() => expect(f.access.requestResearch).toHaveBeenCalledWith('s1', expect.stringContaining('已授权预算')))
  })
  it('drops late inspection data after switching to an ordinary conversation', async () => {
    const f = fixture({ enabled: true, phase: 'connected', identity }), source = sessions('factor-contest')
    let finish!: (data: typeof f.inspection) => void
    vi.mocked(f.access.inspect).mockImplementation(() => new Promise(r => { finish = r }))
    render(<FactorContestReview useSessions={bindSnapshotSelector(source)} access={f.access} openContest={() => {}}/>)
    await waitFor(() => expect(finish).toBeDefined())
    act(() => source.set(sessions('ordinary').getSnapshot()))
    await act(async () => { finish(f.inspection) })
    expect(screen.queryByRole('region', { name: '因子比赛专用对话' })).toBeNull()
    expect(screen.queryByText(/算力 100/)).toBeNull()
  })
})
