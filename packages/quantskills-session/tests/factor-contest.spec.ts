import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import { FactorContestService } from '../src/factor-contest-service.ts'
import { FactorApiError, type FactorRuntime } from '../src/factor-contest-cli.ts'
import { FACTOR_CONTEST_ID, type FactorPlanAction } from '../src/factor-contest-types.ts'

const homes: string[] = []
afterEach(async () => { vi.useRealTimers(); for (const home of homes.splice(0)) await rm(home, { recursive: true, force: true }) })
const identity = { accountId: 'u1', contestId: FACTOR_CONTEST_ID }
const budget: FactorPlanAction = { kind: 'budget', batch: { hypothesis: '低换手反转，检验分年稳定性', maxRuns: 2, creditThreshold: 3, startDate: '20240101', endDate: '20241231', cycle: 5 } }
const candidate = { requestId: 'candidate-1', name: '反转', formula: '-RANK(CLOSE/DELAY(CLOSE,20))', direction: 1 as const }
function draft() { return { pool_id: 'pool1', name: '测试池', style_tag: null, status: 'draft', cycle_locked: false, settling: false, rebalance_cycle_days: 5,
  submitted_at: null, ready_factor_count: 5, active_factor_count: 0, modification_window: { open: false },
  factors: Array.from({ length: 5 }, (_, i) => ({ factor_instance_id: `f${i}`, workflow_id: `w${i}`, revision: 1, can_edit: true, can_delete: true, status: 'ready' })) } }
async function fixture() {
  const home = await mkdtemp(join(tmpdir(), 'quantstudio-factor-')); homes.push(home)
  let account = 'u1', balance = 100, pool: JsonValue = draft(), count = 0, content = candidate.formula
  const cli = vi.fn<FactorRuntime['cli']>(async (_runtime, args) => {
    if (args[0] === 'balance') return { success: true, balance: { computingPower: balance } }
    if (args[0] === 'factor_create') return { success: true, factor_id: `created${++count}` }
    if (args[0] === 'factor_run') { balance -= 2; return { success: true, status: 'SUCCESS', factor_run_id: `run${count}` } }
    if (args[0] === 'factor_info') return { success: true, content, last_run_id: `run${count}`, _id: args[1]! }
    if (args[0] === 'factor_result') return { success: true, status: 2 }
    return { success: true, factors: [] }
  })
  const arena = vi.fn<FactorRuntime['arena']>(async (path, _signal, mutation) => {
    if (mutation) return { accepted: true }
    if (path === '/factorPool/pools') { if (pool === null) throw new FactorApiError('POOL_NOT_FOUND'); return structuredClone(pool) }
    if (path === '/factorArena/me/registration-state') return { currentStatus: 'approved' }
    return { items: [] }
  })
  const runtime: FactorRuntime = { cli, arena, install: vi.fn(async (_path, version) => version), latest: vi.fn(async () => '0.1.7'),
    login: vi.fn(async () => account), identity: vi.fn(async () => account), logout: vi.fn(async () => {}) }
  const service = new FactorContestService(runtime, home)
  const connect = async () => { await service.mode(true); await service.connect(); cli.mockClear(); arena.mockClear() }
  const authorize = async (action = budget) => { const plan = await service.prepare('session1', action, identity); await service.confirm(plan.id, 'session1'); return plan.id }
  return { home, service, runtime, cli, arena, connect, authorize, setPool: (p: JsonValue) => { pool = p }, setAccount: (a: string) => { account = a },
    setBalance: (v: number) => { balance = v }, setContent: (v: string) => { content = v }, mutations: () => arena.mock.calls.filter(([, , mutation]) => mutation) }
}
describe('factor contest lifecycle and isolation', () => {
  it('is off without installing or inheriting any credentials', async () => {
    const f = await fixture()
    expect(await f.service.status()).toMatchObject({ enabled: false, phase: 'off', runs: [] })
    await expect(f.service.query({ kind: 'pool' })).rejects.toThrow('已关闭')
    expect(f.runtime.install).not.toHaveBeenCalled(); expect(f.cli).not.toHaveBeenCalled(); expect(f.runtime.identity).not.toHaveBeenCalled()
  })
  it('installs a private runtime and never stores login credentials in research state', async () => {
    const f = await fixture(); await f.service.mode(true); await f.service.connect({ phone: '13800000000', password: 'private-password' })
    expect(f.runtime.install).toHaveBeenCalledWith(expect.stringContaining('factor-contest'), '0.1.7', expect.any(AbortSignal))
    const text = await readFile(join(f.home, 'quantskills/factor-contest/state.json'), 'utf8')
    expect(text).not.toContain('private-password'); expect(text).not.toContain('13800000000')
    expect(await f.service.status()).toMatchObject({ identity, phase: 'connected' })
  })
  it('rejects bound-account mismatches and never moves an old session to the new account', async () => {
    const f = await fixture(); await f.connect(); f.setAccount('u2')
    await expect(f.service.inspect(identity)).rejects.toThrow('已改变')
    await f.service.connect()
    await expect(f.service.query({ kind: 'pool' }, identity)).rejects.toThrow('其他因子账户')
    expect((await f.service.status()).identity?.accountId).toBe('u2')
  })
  it('disabling invalidates plans and stops budgets immediately', async () => {
    const f = await fixture(); await f.connect(); await f.authorize()
    const p = await f.service.prepare('session1', { kind: 'submit-pool' }, identity)
    await f.service.mode(false)
    expect(await f.service.status()).toMatchObject({ phase: 'off', plans: expect.arrayContaining([expect.objectContaining({ id: p.id, status: 'cancelled' })]), budgets: [expect.objectContaining({ status: 'stopped' })] })
    await expect(f.service.confirm(p.id, 'session1')).rejects.toThrow('已关闭')
    expect(f.mutations()).toHaveLength(0)
  })
  it('requires reconnection and fresh authorization after restart', async () => {
    const f = await fixture(); await f.connect(); await f.authorize()
    const restored = new FactorContestService(f.runtime, f.home)
    expect((await restored.status()).budgets[0]?.status).toBe('stopped')
    await expect(restored.inspect()).rejects.toThrow('连接并验证')
  })
  it('can turn off during installation without installing a late connected identity', async () => {
    const f = await fixture(); await f.service.mode(true)
    let release!: () => void
    vi.mocked(f.runtime.install).mockImplementation(async () => { await new Promise<void>(r => { release = r }); return '0.1.7' })
    const connecting = f.service.connect(); const rejected = expect(connecting).rejects.toThrow()
    await vi.waitFor(() => expect(release).toBeDefined()); await f.service.mode(false); release(); await rejected
    expect(await f.service.status()).toMatchObject({ enabled: false, phase: 'off' })
    expect(f.runtime.identity).not.toHaveBeenCalled()
  })
})
describe('confirmed research budgets', () => {
  it('cannot run before approval, from another session, or with an altered request', async () => {
    const f = await fixture(); await f.connect()
    const p = await f.service.prepare('session1', budget, identity)
    await expect(f.service.runCandidate('session1', p.id, candidate, identity)).rejects.toThrow('授权')
    await f.service.confirm(p.id, 'session1')
    await expect(f.service.runCandidate('session2', p.id, candidate, identity)).rejects.toThrow('授权')
    await f.service.runCandidate('session1', p.id, candidate, identity)
    await expect(f.service.runCandidate('session1', p.id, { ...candidate, formula: 'CLOSE' }, identity)).rejects.toThrow('其他因子')
  })
  it('reserves once before a run and deduplicates concurrent requests', async () => {
    const f = await fixture(); await f.connect(); const id = await f.authorize()
    const results = await Promise.all([f.service.runCandidate('session1', id, candidate, identity), f.service.runCandidate('session1', id, candidate, identity)])
    expect(results[0]).toEqual(results[1]); expect(f.cli.mock.calls.filter(([, a]) => a[0] === 'factor_run')).toHaveLength(1)
    expect((await f.service.status()).budgets[0]?.runsUsed).toBe(1)
    expect(f.cli).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining(['--adjustment-cycle', '5', '--start-date', '20240101', '--group-number', '10']), expect.any(AbortSignal))
  })
  it('stops further runs after the observed credit threshold, including an overshooting run', async () => {
    const f = await fixture(); await f.connect(); const id = await f.authorize()
    await f.service.runCandidate('session1', id, candidate, identity)
    await f.service.runCandidate('session1', id, { ...candidate, requestId: 'candidate-2' }, identity)
    expect((await f.service.status()).budgets[0]).toMatchObject({ creditsUsed: 4, runsUsed: 2, status: 'exhausted' })
    await expect(f.service.runCandidate('session1', id, { ...candidate, requestId: 'candidate-3' }, identity)).rejects.toThrow('授权')
  })
  it('enforces the run ceiling even when the credit threshold is not reached', async () => {
    const f = await fixture(); await f.connect(); const id = await f.authorize({ kind: 'budget', batch: { ...budget.batch, maxRuns: 1, creditThreshold: 100 } })
    await f.service.runCandidate('session1', id, candidate, identity)
    await expect(f.service.runCandidate('session1', id, { ...candidate, requestId: 'new' }, identity)).rejects.toThrow('授权')
    expect(f.cli.mock.calls.filter(([, a]) => a[0] === 'factor_run')).toHaveLength(1)
  })
  it('keeps past observed spending when balance increases', async () => {
    const f = await fixture(); await f.connect(); const id = await f.authorize()
    await f.service.runCandidate('session1', id, candidate, identity); f.setBalance(200)
    await f.service.runCandidate('session1', id, { ...candidate, requestId: 'new' }, identity)
    expect((await f.service.status()).budgets[0]?.creditsUsed).toBe(4)
  })
  it('stops after uncertain CLI output and reconciles without starting again', async () => {
    const f = await fixture(); await f.connect(); const id = await f.authorize()
    const original = f.cli.getMockImplementation()!
    f.cli.mockImplementation(async (...args) => args[1][0] === 'factor_run' ? { success: false, status: 'TIMEOUT', factor_run_id: 'run1' } : original(...args))
    expect((await f.service.runCandidate('session1', id, candidate, identity)).status).toBe('unknown')
    await expect(f.service.prepare('session1', budget, identity)).rejects.toThrow('未完成')
    expect((await f.service.reconcileRun((await f.service.status()).runs[0]!.id)).status).toBe('completed')
    expect((await f.service.status()).budgets[0]?.status).toBe('stopped')
    expect(f.cli.mock.calls.filter(([, a]) => a[0] === 'factor_run')).toHaveLength(1)
  })
  it('finds the run ID from the official flat factor_info envelope after a lost reply', async () => {
    const f = await fixture(); await f.connect(); const id = await f.authorize()
    const original = f.cli.getMockImplementation()!
    f.cli.mockImplementation(async (...args) => { if (args[1][0] === 'factor_run') throw new Error('lost response'); return original(...args) })
    await f.service.runCandidate('session1', id, candidate, identity)
    expect(await f.service.reconcileRun((await f.service.status()).runs[0]!.id)).toMatchObject({ runId: 'run1', status: 'completed' })
  })
  it('honors a stop requested during workflow creation, without launching paid analysis', async () => {
    const f = await fixture(); await f.connect(); const id = await f.authorize()
    const original = f.cli.getMockImplementation()!; let release!: () => void
    f.cli.mockImplementation(async (...args) => { if (args[1][0] === 'factor_create') await new Promise<void>(r => { release = r }); return original(...args) })
    const running = f.service.runCandidate('session1', id, candidate, identity)
    await vi.waitFor(() => expect(release).toBeDefined()); await f.service.stopBudget(id); release()
    expect((await running).status).toBe('failed'); expect(f.cli.mock.calls.some(([, a]) => a[0] === 'factor_run')).toBe(false)
  })
  it('assigns distinct record IDs when two batches reuse the same candidate request ID', async () => {
    const f = await fixture(); await f.connect(); const firstBudget = await f.authorize()
    const first = await f.service.runCandidate('session1', firstBudget, candidate, identity)
    await f.service.stopBudget(firstBudget)
    const secondBudget = await f.authorize(), second = await f.service.runCandidate('session1', secondBudget, candidate, identity)
    expect(first.id).not.toBe(second.id); expect(first.workflowId).not.toBe(second.workflowId)
    expect((await f.service.reconcileRun(second.id)).workflowId).toBe(second.workflowId)
  })
  it('keeps a large analysis out of the durable journal while preserving its queryable run ID', async () => {
    const f = await fixture(); await f.connect(); const id = await f.authorize(), original = f.cli.getMockImplementation()!
    f.cli.mockImplementation(async (...args) => args[1][0] === 'factor_run' ? { success: true, status: 'SUCCESS', factor_run_id: 'large-run', results: { chart: 'x'.repeat(100000) } } : original(...args))
    const result = await f.service.runCandidate('session1', id, candidate, identity)
    expect(result).toMatchObject({ runId: 'large-run', status: 'completed' })
    expect(JSON.stringify(result.result).length).toBeLessThan(1000)
    expect((await readFile(join(f.home, 'quantskills/factor-contest/state.json'), 'utf8')).length).toBeLessThan(10000)
  })
  it.each([{ startDate: '20240230' }, { endDate: '20280101' }, { cycle: 11 }, { maxRuns: 0 }, { creditThreshold: -1 }])('rejects invalid budget %j before any platform request', async change => {
    const f = await fixture(); await f.connect(); f.cli.mockClear(); f.arena.mockClear()
    await expect(f.service.prepare('session1', { kind: 'budget', batch: { ...budget.batch, ...change } }, identity)).rejects.toThrow()
    expect(f.cli).not.toHaveBeenCalled(); expect(f.arena).not.toHaveBeenCalled()
  })
})
describe('factor pool confirmations', () => {
  it('freezes an operation and uses its plan UUID as the idempotency key exactly once', async () => {
    const f = await fixture(); await f.connect(); const plan = await f.service.prepare('session1', { kind: 'submit-pool' }, identity)
    expect(f.mutations()).toHaveLength(0)
    const results = await Promise.allSettled([f.service.confirm(plan.id, 'session1'), f.service.confirm(plan.id, 'session1')])
    expect(results.map(r => r.status).sort()).toEqual(['fulfilled', 'rejected'])
    expect(f.mutations()).toHaveLength(1)
    expect(f.mutations()[0]).toEqual(['/factorPool/pools/pool1/submit', expect.any(AbortSignal), expect.objectContaining({ method: 'POST', key: plan.id })])
  })
  it('rejects wrong-session and stale confirmations', async () => {
    const f = await fixture(); await f.connect(); const p = await f.service.prepare('session1', { kind: 'submit-pool' }, identity)
    await expect(f.service.confirm(p.id, 'session2')).rejects.toThrow('不存在')
    f.setPool({ ...draft(), rebalance_cycle_days: 3 })
    await expect(f.service.confirm(p.id, 'session1')).rejects.toThrow('已变化')
    expect(f.mutations()).toHaveLength(0)
  })
  it('invalidates confirmation if the selected workflow code changed', async () => {
    const f = await fixture(); await f.connect(); const p = await f.service.prepare('session1', { kind: 'add-factor', workflowId: 'research1' }, identity)
    f.setContent('changed formula')
    await expect(f.service.confirm(p.id, 'session1')).rejects.toThrow('已变化')
    expect(f.mutations()).toHaveLength(0)
  })
  it('enforces the expiry at the Host', async () => {
    const f = await fixture(); await f.connect(); const p = await f.service.prepare('session1', { kind: 'submit-pool' }, identity)
    vi.spyOn(Date, 'now').mockReturnValue(p.expiresAt + 1)
    try { await expect(f.service.confirm(p.id, 'session1')).rejects.toThrow('过期') } finally { vi.restoreAllMocks() }
    expect(f.mutations()).toHaveLength(0)
  })
  it('enforces locked cycles, factor count, window and status', async () => {
    const f = await fixture(); await f.connect()
    f.setPool({ ...draft(), status: 'active', cycle_locked: true, submitted_at: '2026-09-01' })
    await expect(f.service.prepare('session1', { kind: 'update-pool', name: '更新池', style: '', cycle: 3 }, identity)).rejects.toThrow('锁定')
    await expect(f.service.prepare('session1', { kind: 'remove-factor', factorId: 'f0' }, identity)).rejects.toThrow('窗口')
    await expect(f.service.prepare('session1', { kind: 'budget', batch: { ...budget.batch, cycle: 3 } }, identity)).rejects.toThrow('周期')
    f.setPool({ ...draft(), ready_factor_count: 4 })
    await expect(f.service.prepare('session1', { kind: 'submit-pool' }, identity)).rejects.toThrow('5 只')
    f.setPool({ ...draft(), settling: true })
    await expect(f.service.prepare('session1', { kind: 'add-factor', workflowId: 'w8' }, identity)).rejects.toThrow('不可修改')
  })
  it('creates a pool and sends exact protocol field names', async () => {
    const f = await fixture(); await f.connect(); f.setPool(null)
    const p = await f.service.prepare('session1', { kind: 'create-pool', name: '低换手池', style: '反转', cycle: 5 }, identity)
    await f.service.confirm(p.id, 'session1')
    expect(f.mutations()[0]?.[2]?.body).toEqual({ name: '低换手池', style_tag: '反转', rebalance_cycle_days: 5 })
  })
  it('does not retry ambiguous submissions; reads back the target state instead', async () => {
    const f = await fixture(); await f.connect(); const p = await f.service.prepare('session1', { kind: 'submit-pool' }, identity)
    const original = f.arena.getMockImplementation()!
    f.arena.mockImplementation(async (...args) => { if (args[2]) throw new Error('network'); return original(...args) })
    expect((await f.service.confirm(p.id, 'session1')).status).toBe('unknown')
    await expect(f.service.prepare('session1', { kind: 'submit-pool' }, identity)).rejects.toThrow('核实')
    f.setPool({ ...draft(), status: 'submitting', submitted_at: '2026-09-15' })
    expect((await f.service.reconcilePlan(p.id)).status).toBe('completed'); expect(f.mutations()).toHaveLength(1)
  })
  it('records a definitive rejection and allows a corrected fresh plan', async () => {
    const f = await fixture(); await f.connect(); const p = await f.service.prepare('session1', { kind: 'submit-pool' }, identity)
    const original = f.arena.getMockImplementation()!
    f.arena.mockImplementation(async (...args) => { if (args[2]) throw new FactorApiError('INVALID_PARAMETER', true); return original(...args) })
    expect((await f.service.confirm(p.id, 'session1')).status).toBe('failed')
    await expect(f.service.prepare('session1', { kind: 'submit-pool' }, identity)).resolves.toMatchObject({ status: 'prepared' })
  })
  it('does not mistake an unchanged workflow for an acknowledged replacement', async () => {
    const f = await fixture(); await f.connect(); const p = await f.service.prepare('session1', { kind: 'replace-factor', factorId: 'f0', workflowId: 'w0' }, identity)
    const original = f.arena.getMockImplementation()!
    f.arena.mockImplementation(async (...args) => { if (args[2]) throw new Error('lost'); return original(...args) })
    await f.service.confirm(p.id, 'session1')
    expect((await f.service.reconcilePlan(p.id)).status).toBe('unknown')
    const changed = draft(); changed.factors[0]!.revision = 2; f.setPool(changed)
    expect((await f.service.reconcilePlan(p.id)).status).toBe('completed')
  })
  it('blocks CLI updates while budget or unknown records remain', async () => {
    const f = await fixture(); await f.connect(); await f.authorize()
    await expect(f.service.update()).rejects.toThrow('先处理')
    expect(f.runtime.install).toHaveBeenCalledTimes(1)
  })
})
