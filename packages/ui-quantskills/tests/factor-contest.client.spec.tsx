// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import { bindSnapshotSelector } from './bind-snapshot.ts'
import { FactorContestPage } from '../src/client/FactorContestPage.tsx'
import { FactorPlans } from '../src/client/FactorPlans.tsx'
import { FactorWorkflowUpdate } from '../src/client/FactorWorkflowUpdate.tsx'
import { FactorContestReview } from '../src/client/FactorContestReview.tsx'
import { CompetitionHub } from '../src/client/CompetitionHub.tsx'
import type { FactorContestAccess } from '../src/client/factor-contest.ts'
import type { FactorContestStatus, FactorPlan } from '../src/client/plugin-types.ts'

afterEach(() => { cleanup(); sessionStorage.clear(); vi.useRealTimers() })
it('reports a known stale plan as expired rather than claiming an unknown submission', async () => {
  const p = plan(), f = fixture({ enabled: true, phase: 'connected', identity, plans: [p] })
  vi.mocked(f.access.confirm).mockRejectedValue(new Error('因子池或工作流已变化，请重新生成确认计划。'))
  const refresh = vi.fn(async () => {})
  const view = render(<FactorPlans status={f.state()} access={f.access} refresh={refresh}/>)
  fireEvent.click(screen.getByRole('button', { name: /授权一批因子研究/ }))
  fireEvent.click(screen.getByRole('button', { name: '确认授权本批次' }))
  await screen.findByRole('alert')
  f.set({ plans: [{ ...p, status: 'expired' }] })
  view.rerender(<FactorPlans status={f.state()} access={f.access} refresh={refresh}/>)
  expect(screen.getByRole('alert').textContent).toBe('因子池或工作流已变化，请重新生成确认计划。')
  expect(screen.queryByRole('button', { name: '确认授权本批次' })).toBeNull()
})
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
  it('only offers a platform-approved version of the selected factor, never unrelated workflow IDs', async () => {
    const f = fixture(), submit = vi.fn()
    vi.mocked(f.access.query).mockResolvedValue({ items: [
      { workflow_id: 'current', factor_instance_id: 'factor1', action: 'none', action_enabled: false },
      { workflow_id: 'other', factor_instance_id: 'factor2', action: 'update', action_enabled: true },
    ] })
    render(<FactorWorkflowUpdate factorId="factor1" workflowId="current" access={f.access} busy={false} submit={submit}/>)
    await screen.findByText('当前已是最新版本，没有新的成功运行快照。')
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('button', { name: '使用此版本生成确认计划' })).toBeNull()
    expect(submit).not.toHaveBeenCalled()
  })
  it('shows an unsubmitted validating pool and enables submission once five candidates are ready', async () => {
    const f = fixture({ enabled: true, phase: 'connected', identity })
    vi.mocked(f.access.inspect).mockResolvedValue({ ...f.inspection, pool: { ...f.inspection.pool, status: 'validating', cycle_locked: false, submitted_at: null } })
    render(<FactorContestPage access={f.access}/>)
    await screen.findByText('因子校验中')
    expect(screen.queryByText('尚未创建因子池')).toBeNull()
    expect((screen.getByRole('button', { name: '准备正式参赛' }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('shows a fresh pool response even while status still contains an older inspection', async () => {
    const f = fixture({ enabled: true, phase: 'connected', identity })
    f.set({ inspection: { ...f.inspection, fetchedAt: 1, pool: null } })
    vi.mocked(f.access.inspect).mockResolvedValue({ ...f.inspection, fetchedAt: 2, pool: { ...f.inspection.pool, name: '真实的新快照' } })
    render(<FactorContestPage access={f.access}/>)
    await screen.findByText('真实的新快照')
    expect(screen.queryByText('还没有比赛因子池')).toBeNull()
    expect(screen.getByRole('button', { name: '修改因子池设置' })).toBeTruthy()
  })
  it('does not offer pool mutations while the first inspection is pending or failed', async () => {
    const f = fixture({ enabled: true, phase: 'connected', identity })
    vi.mocked(f.access.inspect).mockRejectedValueOnce(new Error('账户巡检失败'))
    render(<FactorContestPage access={f.access}/>)
    await screen.findByText('账户巡检失败')
    expect(screen.queryByRole('button', { name: '创建因子池' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '刷新当前数据' }))
    await screen.findByRole('button', { name: '修改因子池设置' })
    expect(screen.queryByText('账户巡检失败')).toBeNull()
  })
  it('stops pagination at the actual last page and restores the prior page', async () => {
    const f = fixture({ enabled: true, phase: 'connected', identity })
    vi.mocked(f.access.query).mockImplementation(async query => ({ total: 51, items: Array.from({ length: query.page === 2 ? 1 : 50 }, (_, i) =>
      ({ workflow_id: 'w' + (query.page === 2 ? 50 : i), name: '候选 ' + (query.page === 2 ? 50 : i), selectable: true })) }))
    render(<FactorContestPage access={f.access}/>)
    fireEvent.click(await screen.findByRole('tab', { name: '可入池工作流' }))
    await screen.findByText('候选 0')
    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    await screen.findByText('候选 50')
    expect((screen.getByRole('button', { name: '下一页' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByText('候选 0')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '上一页' }))
    await screen.findByText('候选 0')
    expect(screen.queryByText('候选 50')).toBeNull()
  })
  it('reads factor definitions and their actual run IDs from the official CLI list', async () => {
    const f = fixture({ enabled: true, phase: 'connected', identity })
    vi.mocked(f.access.query).mockImplementation(async query => query.kind === 'factors'
      ? { success: true, total: 1, factors: [{ _id: 'workflow-21', name: '低换手反转', last_run_id: 'run-33' }] }
      : query.kind === 'factor-info' ? { content: 'CLOSE/DELAY(CLOSE,20)' } : { Rank_IC: 0.061 })
    render(<FactorContestPage access={f.access}/>)
    fireEvent.click(await screen.findByRole('tab', { name: '全部研究因子' }))
    fireEvent.click(await screen.findByRole('button', { name: '查看因子定义' }))
    await screen.findByText('CLOSE/DELAY(CLOSE,20)')
    fireEvent.click(screen.getByRole('button', { name: '关闭因子详情与回测结果' }))
    fireEvent.click(screen.getByRole('button', { name: '查看回测结果' }))
    await screen.findByText('0.061')
    expect(f.access.query).toHaveBeenCalledWith({ kind: 'factor-result', id: 'run-33' }, expect.any(AbortSignal))
  })
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
    fireEvent.click(await screen.findByRole('button', { name: '账户与设置' }))
    const toggle = await screen.findByRole('switch', { name: '因子比赛模式' })
    await waitFor(() => expect((toggle as HTMLButtonElement).disabled).toBe(false))
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(f.access.connect).not.toHaveBeenCalled(); expect(f.access.inspect).not.toHaveBeenCalled(); expect(f.access.query).not.toHaveBeenCalled()
    fireEvent.click(toggle)
    fireEvent.click(screen.getByRole('button', { name: '关闭因子账户与设置' }))
    await screen.findByRole('button', { name: '登录并连接' })
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
    await waitFor(() => expect(resolve).toBeDefined())
    fireEvent.click(screen.getByRole('button', { name: '账户与设置' }))
    fireEvent.click(screen.getByRole('switch', { name: '因子比赛模式' }))
    fireEvent.click(screen.getByRole('button', { name: '关闭因子账户与设置' }))
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
    await screen.findByRole('button', { name: '开启因子比赛' })
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
  it('refreshes the conversation summary after model tools publish a newer account inspection', async () => {
    vi.useFakeTimers()
    const f = fixture({ enabled: true, phase: 'connected', identity })
    render(<FactorContestReview useSessions={bindSnapshotSelector(sessions('factor-contest'))} access={f.access} openContest={() => {}}/>)
    await act(async () => {})
    expect(screen.getByText(/算力 100/)).toBeTruthy()
    f.set({ inspection: { ...f.inspection, fetchedAt: f.inspection.fetchedAt + 1000, balance: 98 } })
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(screen.getByText(/算力 98/)).toBeTruthy()
    expect(screen.queryByText(/算力 100/)).toBeNull()
  })
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


it('restores cancellation and explicit retry only after serialized verification of a pre-submit failure', async () => {
  const f = fixture({ enabled: true, phase: 'connected', identity, plans: [plan()] })
  vi.mocked(f.access.confirm).mockRejectedValue(new Error('算力余额不足。'))
  const { rerender } = render(<FactorPlans status={f.state()} access={f.access} refresh={async () => {}}/>)
  fireEvent.click(screen.getByRole('button', { name: /授权一批因子研究/ }))
  fireEvent.click(screen.getByRole('button', { name: '确认授权本批次' }))
  await screen.findByRole('alert')
  rerender(<FactorPlans status={structuredClone(f.state())} access={f.access} refresh={async () => {}}/>)
  fireEvent.click(screen.getByRole('button', { name: '只读核对确认结果' }))
  await act(async () => {})
  expect((screen.getByRole('button', { name: '取消计划' }) as HTMLButtonElement).disabled).toBe(false)
  expect((screen.getByRole('button', { name: '确认授权本批次' }) as HTMLButtonElement).disabled).toBe(false)
  expect(f.access.confirm).toHaveBeenCalledOnce()
  expect(f.access.reconcilePlan).toHaveBeenCalledExactlyOnceWith('p1')
  fireEvent.click(screen.getByRole('button', { name: '确认授权本批次' }))
  await act(async () => {})
  expect(f.access.confirm).toHaveBeenCalledTimes(2)
})


it('keeps a timed-out submission locked across polling and failed verification', async () => {
  vi.useFakeTimers()
  const pending = { ...plan(), expiresAt: Date.now() + 600000 }
  const f = fixture({ enabled: true, phase: 'connected', identity, plans: [pending] })
  vi.mocked(f.access.confirm).mockImplementation(() => new Promise(() => {}))
  vi.mocked(f.access.reconcilePlan).mockRejectedValue(new Error('核对服务暂不可用'))
  const { rerender } = render(<FactorPlans status={f.state()} access={f.access} refresh={async () => {}}/>)
  fireEvent.click(screen.getByRole('button', { name: /授权一批因子研究/ }))
  fireEvent.click(screen.getByRole('button', { name: '确认授权本批次' }))
  await act(async () => { await vi.advanceTimersByTimeAsync(60000) })
  rerender(<FactorPlans status={structuredClone(f.state())} access={f.access} refresh={async () => {}}/>)
  expect((screen.getByRole('button', { name: '确认授权本批次' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '只读核对确认结果' }))
  await act(async () => {})
  expect((screen.getByRole('button', { name: '确认授权本批次' }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('button', { name: '取消计划' }) as HTMLButtonElement).disabled).toBe(true)
  expect(f.access.confirm).toHaveBeenCalledOnce()
})

it('does not restore submission after verification returns an unknown outcome', async () => {
  const pending = plan(), f = fixture({ enabled: true, phase: 'connected', identity, plans: [pending] })
  vi.mocked(f.access.confirm).mockRejectedValue(new Error('响应丢失'))
  vi.mocked(f.access.reconcilePlan).mockResolvedValue({ ...pending, status: 'unknown' })
  render(<FactorPlans status={f.state()} access={f.access} refresh={async () => {}}/>)
  fireEvent.click(screen.getByRole('button', { name: /授权一批因子研究/ }))
  fireEvent.click(screen.getByRole('button', { name: '确认授权本批次' }))
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: '只读核对确认结果' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: '确认授权本批次' })).toBeNull())
  expect(screen.queryByRole('button', { name: '取消计划' })).toBeNull()
  expect(f.access.confirm).toHaveBeenCalledOnce()
})
