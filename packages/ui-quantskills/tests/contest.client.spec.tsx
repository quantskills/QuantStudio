// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContestPage } from '../src/client/ContestPage.tsx'
import { ContestPlans } from '../src/client/ContestPlans.tsx'
import { ContestReview } from '../src/client/ContestReview.tsx'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import { bindSnapshotSelector } from './bind-snapshot.ts'
import type { ContestAccess } from '../src/client/contest.ts'
import type { ContestData, ContestPlan, ContestStatus, QuantSkillsPlainSessionArchiveItem } from '../src/client/plugin-types.ts'
afterEach(() => { cleanup(); vi.useRealTimers() })

const identity = { accountId: 'account-1', contestId: 'contest-1' }
function plan(): ContestPlan { return { id: 'plan-1', sessionId: 'session-1', identity, operation: 'place_order', createdAt: Date.now(), expiresAt: Date.now() + 60_000,
  summary: 'rb2610 开多 1 手 · 市价 IOC', details: { parameters: { contractCode: 'rb2610', volume: 1 }, marketQuote: { latestPrice: 3250, quoteTime: '2026-09-15 10:00:00' } }, clientRequestId: 'request-1', status: 'prepared' } }
function api(initial: Partial<ContestStatus> = {}) {
  let current: ContestStatus = { enabled: false, phase: 'off', updateAvailable: false, message: '', plans: [], ...initial }
  const access: ContestAccess = {
    status: vi.fn(async () => current), mode: vi.fn(async enabled => { current = { ...current, enabled, phase: enabled ? 'disconnected' : 'off' }; return current }),
    connect: vi.fn(async () => { current = { ...current, phase: 'connected', identity }; return current }),
    disconnect: vi.fn(async () => { current = { ...current, phase: 'disconnected' }; return current }),
    checkUpdate: vi.fn(async () => current), update: vi.fn(async () => current), query: vi.fn(async () => ({ data: { equity: 1000000 }, fetchedAt: Date.now() })),
    execute: vi.fn(async selected => { const result = { ...selected, status: 'queued' as const }; current = { ...current, plans: [result] }; return result }),
    dismiss: vi.fn(async () => current), reconcile: vi.fn(async selected => selected), startResearch: vi.fn(async () => {}),
    inspect: vi.fn(async () => ({ identity, fetchedAt: Date.now(), account: { data: { equity: 1000000 }, fetchedAt: Date.now() },
      positions: { data: [], fetchedAt: Date.now() }, openOrders: { data: [], fetchedAt: Date.now() }, pendingPlans: [], summary: ['当前没有待处理的交易计划。'] })),
    requestResearch: vi.fn(async () => {}),
  }
  return { access, status: () => current, set: (value: Partial<ContestStatus>) => { current = { ...current, ...value } } }
}

describe('contest mode interaction', () => {
  it('shows volume-weighted opening fills in history and never uses the quote as an execution price', async () => {
    const completed: ContestPlan = { ...plan(), status: 'completed', operationId: 'op-1', details: { ...plan().details, parameters: { contractCode: 'rb2610', side: 'buy', offset: 'open', volume: 3 } },
      fills: [{ id: 'f1', tradeId: 't1', orderId: 'o1', volume: 1, price: 3200, time: new Date().toISOString() }, { id: 'f2', tradeId: 't2', orderId: 'o1', volume: 2, price: 3203, time: new Date().toISOString() }] }
    const cancelled = { ...completed, id: 'cancelled', status: 'cancelled' as const, fills: undefined }
    const f = api({ enabled: true, phase: 'connected', identity, plans: [completed, cancelled] })
    render(<ContestPlans status={f.status()} access={f.access} refresh={async () => {}}/>)
    expect(screen.getByText('开仓成交均价：3,202 · 已记录成交 3/3 手')).toBeTruthy()
    expect(screen.getByText('开仓成交均价：—（未执行）')).toBeTruthy()
    fireEvent.click(screen.getByText('开仓成交均价：3,202 · 已记录成交 3/3 手'))
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByText('开仓成交均价：3,202 · 已记录成交 3/3 手')).toBeTruthy()
    expect(dialog.getByText(/成交价来源/)).toBeTruthy()
    expect(dialog.queryByText('核对成交价格')).toBeNull()
    expect(f.access.execute).not.toHaveBeenCalled()
  })
  it('offers read-only price lookup for completed plans with missing fills', async () => {
    const p = { ...plan(), status: 'completed' as const, operationId: 'op-1' }
    const f = api({ enabled: true, phase: 'connected', identity, plans: [p] })
    render(<ContestPlans status={f.status()} access={f.access} refresh={async () => {}}/>)
    fireEvent.click(screen.getByText('成交均价：待核对'))
    fireEvent.click(screen.getByRole('button', { name: '核对成交价格' }))
    await waitFor(() => expect(f.access.reconcile).toHaveBeenCalledWith(p))
    expect(f.access.execute).not.toHaveBeenCalled()
  })
  it('cancels a pending dashboard read before checking the connection', async () => {
    const f = api({ enabled: true, phase: 'connected', identity })
    let signal!: AbortSignal
    vi.mocked(f.access.query).mockImplementationOnce((_query, s) => { signal = s!; return new Promise(() => {}) })
    render(<ContestPage access={f.access}/>)
    await waitFor(() => expect(f.access.query).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: '检查连接' }))
    await waitFor(() => expect(signal.aborted).toBe(true))
  })
  it('unlocks a timed-out data read for retry and aborts the expired request', async () => {
    vi.useFakeTimers()
    const f = api({ enabled: true, phase: 'connected', identity })
    let signal!: AbortSignal
    vi.mocked(f.access.query).mockImplementationOnce((_query, s) => { signal = s!; return new Promise(() => {}) })
    render(<ContestPage access={f.access}/>)
    await act(async () => {})
    await act(async () => { await vi.advanceTimersByTimeAsync(30000) })
    expect(signal.aborted).toBe(true)
    expect(screen.getByRole('alert').textContent).toContain('响应超时')
    const retry = screen.getByRole('button', { name: '刷新数据' }) as HTMLButtonElement
    expect(retry.disabled).toBe(false)
    fireEvent.click(retry)
    await act(async () => {})
    expect(screen.getByText('1,000,000')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })
  it('allows closing a timed-out confirmation without allowing a duplicate trade', async () => {
    vi.useFakeTimers()
    const pending = { ...plan(), expiresAt: Date.now() + 600000 }
    const f = api({ enabled: true, phase: 'connected', identity, plans: [pending] })
    vi.mocked(f.access.execute).mockImplementation(() => new Promise(() => {}))
    render(<ContestPlans status={f.status()} access={f.access} refresh={async () => {}}/>)
    fireEvent.click(screen.getByRole('button', { name: /rb2610/ }))
    fireEvent.click(screen.getByRole('button', { name: '确认执行这笔交易' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(60000) })
    expect(screen.getByRole('alert').textContent).toContain('请勿重复提交')
    expect((screen.getByRole('button', { name: '确认执行这笔交易' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: '取消计划' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '关闭确认比赛交易计划' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(f.access.execute).toHaveBeenCalledTimes(1)
  })
  it('starts off, never connects or fetches account data until explicitly connected', async () => {
    const f = api(); render(<ContestPage access={f.access}/>)
    const toggle = await screen.findByRole('switch', { name: '比赛模式' })
    await waitFor(() => expect((toggle as HTMLButtonElement).disabled).toBe(false))
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(f.access.connect).not.toHaveBeenCalled(); expect(f.access.query).not.toHaveBeenCalled()
    fireEvent.click(toggle)
    fireEvent.click(await screen.findByRole('button', { name: '连接比赛' }))
    await screen.findByRole('button', { name: '进入 AI 交易助手' })
    expect(f.access.connect).toHaveBeenCalledTimes(1)
    fireEvent.click(toggle)
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('false'))
    expect(screen.queryByRole('button', { name: '进入 AI 交易助手' })).toBeNull()
    expect(screen.queryByRole('tablist')).toBeNull()
  })
  it('lets the user turn the mode off during a slow login', async () => {
    const f = api({ enabled: true, phase: 'disconnected' })
    let finish!: (value: ContestStatus) => void
    vi.mocked(f.access.connect).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    render(<ContestPage access={f.access}/>)
    fireEvent.click(await screen.findByRole('button', { name: '连接比赛' }))
    fireEvent.click(screen.getByRole('switch', { name: '比赛模式' }))
    await waitFor(() => expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false'))
    await act(async () => finish({ ...f.status(), enabled: true, phase: 'connected' }))
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false')
  })
  it('discards the previous tab response when it arrives after the current query', async () => {
    const f = api({ enabled: true, phase: 'connected', identity })
    let old!: (value: ContestData) => void
    vi.mocked(f.access.query).mockImplementation(input => input.kind === 'account' ? new Promise(resolve => { old = resolve })
      : Promise.resolve({ data: [{ contractCode: 'au2612', volume: 2 }], fetchedAt: Date.now() }))
    render(<ContestPage access={f.access}/>)
    fireEvent.click(await screen.findByRole('tab', { name: '持仓' }))
    await screen.findByRole('cell', { name: 'au2612' })
    await act(async () => old({ data: { equity: 777777 }, fetchedAt: Date.now() }))
    expect(screen.getByRole('cell', { name: 'au2612' })).toBeTruthy()
    expect(screen.queryByText('777,777')).toBeNull()
  })
  it('uses explicit today for records and the active-order endpoint for current orders', async () => {
    const f = api({ enabled: true, phase: 'connected', identity }); render(<ContestPage access={f.access}/>)
    fireEvent.click(await screen.findByRole('tab', { name: '委托记录' }))
    await waitFor(() => expect(f.access.query).toHaveBeenCalledWith({ kind: 'orders', date: 'today' }, expect.any(AbortSignal)))
    fireEvent.click(screen.getByRole('tab', { name: '当前挂单' }))
    await waitFor(() => expect(f.access.query).toHaveBeenCalledWith({ kind: 'open-orders' }, expect.any(AbortSignal)))
  })
  it('shows the AI entry before connection, then starts one dedicated conversation on a click', async () => {
    const f = api({ enabled: true, phase: 'disconnected' })
    render(<ContestPage access={f.access}/>)
    const entry = await screen.findByRole('button', { name: '进入 AI 交易助手' })
    expect((entry as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('连接比赛账户后，即可进入 AI 交易助手。')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '连接比赛' }))
    await waitFor(() => expect((entry as HTMLButtonElement).disabled).toBe(false))
    let finish!: () => void
    vi.mocked(f.access.startResearch).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    fireEvent.click(entry); fireEvent.click(entry)
    expect(f.access.startResearch).toHaveBeenCalledTimes(1)
    expect(f.access.execute).not.toHaveBeenCalled()
    expect(screen.getByRole('list', { name: 'AI 交易步骤' })).toBeTruthy()
    await act(async () => finish())
    fireEvent.click(screen.getByRole('button', { name: '新建专题对话' }))
    expect(f.access.startResearch).toHaveBeenLastCalledWith(true, expect.any(AbortSignal))
    await act(async () => finish())
  })
  it('keeps a conversation launch failure visible on the contest page', async () => {
    const f = api({ enabled: true, phase: 'connected', identity })
    vi.mocked(f.access.startResearch).mockRejectedValue(new Error('无法建立比赛对话，请重试。'))
    render(<ContestPage access={f.access}/>)
    fireEvent.click(await screen.findByRole('button', { name: '进入 AI 交易助手' }))
    expect((await screen.findByRole('alert')).textContent).toContain('无法建立比赛对话，请重试。')
    await waitFor(() => expect((screen.getByRole('button', { name: '进入 AI 交易助手' }) as HTMLButtonElement).disabled).toBe(false))
  })
  it('continues only the latest unarchived competition conversation for the connected account', async () => {
    const f = api({ enabled: true, phase: 'connected', identity }), openResearch = vi.fn()
    const archive = (id: string, time: number, binding: QuantSkillsPlainSessionArchiveItem['binding'], archived = false): QuantSkillsPlainSessionArchiveItem => ({
      sessionId: id as QuantSkillsPlainSessionArchiveItem['sessionId'], title: id, binding, createdAt: 1, updatedAt: time, archived, running: false, runState: 'idle',
    })
    const owned = { purpose: 'contest' as const, contest: identity }
    const sessions = [archive('old', 10, owned), archive('latest', 20, owned), archive('archived', 50, owned, true),
      archive('ordinary', 60, { purpose: 'ordinary' }), archive('other-account', 70, { ...owned, contest: { ...identity, accountId: 'other' } }),
      archive('other-contest', 80, { ...owned, contest: { ...identity, contestId: 'other' } })]
    const view = render(<ContestPage access={f.access} researchSessions={sessions} openResearch={openResearch}/>)
    fireEvent.click(await screen.findByRole('button', { name: '继续最近对话' }))
    expect(openResearch).toHaveBeenCalledExactlyOnceWith('latest')
    expect(f.access.startResearch).not.toHaveBeenCalled()
    view.rerender(<ContestPage access={f.access} researchSessions={sessions.slice(2)} openResearch={openResearch}/>)
    expect(screen.queryByRole('button', { name: '继续最近对话' })).toBeNull()
  })
  it('presents the reported account fields in Chinese and omits empty trading-mode arrays', async () => {
    const f = api({ enabled: true, phase: 'connected', identity })
    vi.mocked(f.access.query).mockResolvedValue({ fetchedAt: Date.now(), data: {
      startCapital: 5000000, staticProfit: 0, frozenCapital: 0, positionPnl: 0, marketValue: 0, tradeDate: 20260915,
      tradingModes: [], tradingModeLabels: [],
    } })
    render(<ContestPage access={f.access}/>)
    await screen.findByText('初始资金')
    expect(screen.getByText('冻结资金')).toBeTruthy(); expect(screen.getByText('交易日')).toBeTruthy()
    expect(screen.getByText('2026-09-15')).toBeTruthy(); expect(screen.queryByText('[]')).toBeNull()
    expect(screen.queryByText('startCapital')).toBeNull(); expect(screen.queryByText('交易模式')).toBeNull()
  })
})

describe('competition conversation isolation', () => {
  const sessions = (purpose: 'ordinary' | 'contest', account = identity) => createSnapshotStore<SessionListState>({
    current: 'session-1', byId: { 'session-1': { id: 'session-1', running: false,
      projectionValues: { quantSkillsPlainSession: { purpose, ...(purpose === 'contest' ? { contest: account } : {}) } } } },
  } as unknown as SessionListState)
  it('mounts no contest calls or controls in an ordinary session even when contest mode is on', async () => {
    const f = api({ enabled: true, phase: 'connected', identity })
    render(<ContestReview useSessions={bindSnapshotSelector(sessions('ordinary'))} access={f.access} openContest={() => {}}/>)
    expect(screen.queryByRole('region', { name: '比赛专用对话' })).toBeNull()
    expect(f.access.status).not.toHaveBeenCalled(); expect(f.access.inspect).not.toHaveBeenCalled()
  })
  it('inspects on entry and sends research shortcuts only to the competition conversation', async () => {
    const f = api({ enabled: true, phase: 'connected', identity })
    render(<ContestReview useSessions={bindSnapshotSelector(sessions('contest'))} access={f.access} openContest={() => {}}/>)
    await screen.findByText('当前没有待处理的交易计划。')
    expect(f.access.inspect).toHaveBeenCalledExactlyOnceWith('session-1', expect.any(AbortSignal))
    expect(f.access.requestResearch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '研究持仓' }))
    await waitFor(() => expect(f.access.requestResearch).toHaveBeenCalledWith('session-1', expect.stringContaining('研究现有持仓')))
    await waitFor(() => expect((screen.getByRole('button', { name: '今日复盘' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: '今日复盘' }))
    await waitFor(() => expect(f.access.requestResearch).toHaveBeenCalledWith('session-1', expect.stringContaining('复盘今天')))
    await waitFor(() => expect((screen.getByRole('button', { name: '今日复盘' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.change(screen.getByRole('textbox', { name: '研究品种或合约' }), { target: { value: 'rb2610' } })
    fireEvent.click(screen.getByRole('button', { name: '研究品种' }))
    await waitFor(() => expect(f.access.requestResearch).toHaveBeenCalledWith('session-1', expect.stringContaining('rb2610')))
    fireEvent.click(screen.getByRole('button', { name: '账户详情' }))
    await screen.findByRole('dialog', { name: '比赛账户巡检' })
    expect(f.access.execute).not.toHaveBeenCalled()
  })
  it('does not show another account context or offer research after switching accounts', async () => {
    const f = api({ enabled: true, phase: 'connected', identity: { ...identity, accountId: 'different' } })
    render(<ContestReview useSessions={bindSnapshotSelector(sessions('contest'))} access={f.access} openContest={() => {}}/>)
    await screen.findByText(/当前登录账户与本会话不一致/)
    expect(f.access.inspect).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: '研究持仓' })).toBeNull()
  })
  it('discards a slow contest inspection after the user switches to an ordinary session', async () => {
    const f = api({ enabled: true, phase: 'connected', identity }), source = sessions('contest')
    const snapshot = await f.access.inspect('session-1')
    vi.mocked(f.access.inspect).mockClear()
    let finish!: (value: typeof snapshot) => void
    vi.mocked(f.access.inspect).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    render(<ContestReview useSessions={bindSnapshotSelector(source)} access={f.access} openContest={() => {}}/>)
    await waitFor(() => expect(f.access.inspect).toHaveBeenCalledOnce())
    act(() => source.set(sessions('ordinary').getSnapshot()))
    await act(async () => finish(snapshot))
    expect(screen.queryByText('当前没有待处理的交易计划。')).toBeNull()
    expect(screen.queryByRole('region', { name: '比赛专用对话' })).toBeNull()
    expect(f.access.requestResearch).not.toHaveBeenCalled()
  })
})

describe('contest confirmation cards', () => {
  it('shows the returned receipt and lets the user close the dialog while status refresh is stalled', async () => {
    const p = plan(), f = api({ enabled: true, phase: 'connected', identity, plans: [p] })
    render(<ContestPlans status={f.status()} access={f.access} refresh={() => new Promise(() => {})} compact autoOpen/>)
    fireEvent.click(await screen.findByRole('button', { name: '确认执行这笔交易' }))
    await screen.findByText('已排队 · 尚未成交')
    expect(screen.queryByRole('button', { name: '确认执行这笔交易' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '关闭确认比赛交易计划' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(f.access.execute).toHaveBeenCalledOnce()
  })
  it('requires one explicit click and blocks rapid repeat submission', async () => {
    const p = plan(), f = api({ enabled: true, phase: 'connected', identity, plans: [p] })
    let finish!: (value: ContestPlan) => void
    vi.mocked(f.access.execute).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    render(<ContestPlans status={f.status()} access={f.access} refresh={async () => {}} compact autoOpen/>)
    const dialog = await screen.findByRole('dialog', { name: '确认比赛交易计划' })
    expect(f.access.execute).not.toHaveBeenCalled()
    expect(within(dialog).getByText('2026-09-15 10:00:00')).toBeTruthy()
    const confirm = within(dialog).getByRole('button', { name: '确认执行这笔交易' })
    fireEvent.click(confirm); fireEvent.click(confirm)
    expect(f.access.execute).toHaveBeenCalledTimes(1)
    expect(f.access.execute).toHaveBeenCalledWith(p)
    await act(async () => finish({ ...p, status: 'queued' }))
  })
  it('does not offer execution for expired or unknown plans', async () => {
    const p = { ...plan(), expiresAt: Date.now() - 1 }, f = api({ enabled: true, phase: 'connected', plans: [p] })
    const view = render(<ContestPlans status={f.status()} access={f.access} refresh={async () => {}}/>)
    fireEvent.click(screen.getByRole('button', { name: /rb2610/ }))
    expect((screen.getByRole('button', { name: '确认执行这笔交易' }) as HTMLButtonElement).disabled).toBe(true)
    f.set({ plans: [{ ...p, status: 'unknown' }] }); view.rerender(<ContestPlans status={f.status()} access={f.access} refresh={async () => {}}/>)
    expect(screen.queryByRole('button', { name: '确认执行这笔交易' })).toBeNull()
    expect(screen.getByRole('button', { name: '查询柜台回执' })).toBeTruthy()
  })
  it('dismisses a confirmation when competition mode turns off', async () => {
    const f = api({ enabled: true, phase: 'connected', plans: [plan()] })
    const view = render(<ContestPlans status={f.status()} access={f.access} refresh={async () => {}} compact autoOpen/>)
    await screen.findByRole('dialog')
    f.set({ enabled: false, phase: 'off' }); view.rerender(<ContestPlans status={f.status()} access={f.access} refresh={async () => {}} compact autoOpen/>)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(f.access.execute).not.toHaveBeenCalled()
  })
  it('only opens a new plan after research finishes; dismissing does not reopen it', async () => {
    const f = api({ enabled: true, phase: 'connected', plans: [plan()] })
    const view = render(<ContestPlans status={f.status()} access={f.access} refresh={async () => {}} compact autoOpen={false}/>)
    expect(screen.queryByRole('dialog')).toBeNull()
    view.rerender(<ContestPlans status={f.status()} access={f.access} refresh={async () => {}} compact autoOpen/>)
    fireEvent.click(await screen.findByRole('button', { name: '关闭确认比赛交易计划' }))
    view.rerender(<ContestPlans status={{ ...f.status() }} access={f.access} refresh={async () => {}} compact autoOpen/>)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})


it('restores cancellation and explicit retry after read-only reconciliation confirms an unsubmitted plan', async () => {
  const p = plan(), f = api({ enabled: true, phase: 'connected', identity, plans: [p] })
  vi.mocked(f.access.execute).mockRejectedValue(new Error('交易通道自检未通过。'))
  vi.mocked(f.access.reconcile).mockResolvedValue(p)
  render(<ContestPlans status={f.status()} access={f.access} refresh={async () => {}}/>)
  fireEvent.click(screen.getByRole('button', { name: /rb2610/ }))
  fireEvent.click(screen.getByRole('button', { name: '确认执行这笔交易' }))
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: '只读核对确认结果' }))
  await waitFor(() => expect(f.access.reconcile).toHaveBeenCalledOnce())
  await act(async () => {})
  expect((screen.getByRole('button', { name: '取消计划' }) as HTMLButtonElement).disabled).toBe(false)
  expect((screen.getByRole('button', { name: '确认执行这笔交易' }) as HTMLButtonElement).disabled).toBe(false)
  expect(f.access.execute).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: '确认执行这笔交易' }))
  await act(async () => {})
  expect(f.access.execute).toHaveBeenCalledTimes(2)
})


it('keeps a timed-out submission locked across polling and failed verification', async () => {
  vi.useFakeTimers()
  const pending = { ...plan(), expiresAt: Date.now() + 600000 }
  const f = api({ enabled: true, phase: 'connected', identity, plans: [pending] })
  vi.mocked(f.access.execute).mockImplementation(() => new Promise(() => {}))
  vi.mocked(f.access.reconcile).mockRejectedValue(new Error('核对服务暂不可用'))
  const { rerender } = render(<ContestPlans status={f.status()} access={f.access} refresh={async () => {}}/>)
  fireEvent.click(screen.getByRole('button', { name: /rb2610/ }))
  fireEvent.click(screen.getByRole('button', { name: '确认执行这笔交易' }))
  await act(async () => { await vi.advanceTimersByTimeAsync(60000) })
  rerender(<ContestPlans status={structuredClone(f.status())} access={f.access} refresh={async () => {}}/>)
  expect((screen.getByRole('button', { name: '确认执行这笔交易' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '只读核对确认结果' }))
  await act(async () => {})
  expect((screen.getByRole('button', { name: '确认执行这笔交易' }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('button', { name: '取消计划' }) as HTMLButtonElement).disabled).toBe(true)
  expect(f.access.execute).toHaveBeenCalledOnce()
})

it('does not restore submission after verification returns an unknown outcome', async () => {
  const pending = plan(), f = api({ enabled: true, phase: 'connected', identity, plans: [pending] })
  vi.mocked(f.access.execute).mockRejectedValue(new Error('响应丢失'))
  vi.mocked(f.access.reconcile).mockResolvedValue({ ...pending, status: 'unknown' })
  render(<ContestPlans status={f.status()} access={f.access} refresh={async () => {}}/>)
  fireEvent.click(screen.getByRole('button', { name: /rb2610/ }))
  fireEvent.click(screen.getByRole('button', { name: '确认执行这笔交易' }))
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: '只读核对确认结果' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: '确认执行这笔交易' })).toBeNull())
  expect(screen.queryByRole('button', { name: '取消计划' })).toBeNull()
  expect(f.access.execute).toHaveBeenCalledOnce()
})
