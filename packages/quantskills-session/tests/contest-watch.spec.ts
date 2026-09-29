import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ContestWatcher, decideWithJev, watchAccount, watchQuote, watchSpread } from '../src/contest-watch.ts'
import { ContestCliError } from '../src/contest-cli.ts'
import { ContestQuotaError } from '../src/contest-rate-budget.ts'
import { watchAssessments } from '../src/contest-watch-evaluation.ts'
import type { ContestService } from '../src/contest-service.ts'
import type { ContestInspection, ContestPlan } from '../src/contest-types.ts'
import type { ContestWatchConfig, ContestWatchDecision } from '../src/contest-watch-types.ts'
import { makeTemplate, rangeTemplate } from '../../ui-quantskills/src/client/jev-templates.ts'
import { products } from '../../ui-quantskills/src/client/jev-products.ts'

const identity = { accountId: 'watch-account', contestId: 'watch-contest' }
const assessments = Object.fromEntries(Object.entries(watchAssessments).map(([key, value]) => {
  const options = Object.keys(value.criteria)
  return [key, { type: 'choice', choice: options[0], confidence: 1, probabilities: Object.fromEntries(options.map((option, i) => [option, i ? 0 : 1])) }]
}))
const config: ContestWatchConfig = { symbol: 'rb2610', volume: 1, intervalSeconds: 60, durationMinutes: 120,
  minConfidence: 0.8, maxEquityDrop: 1000, maxPlans: 2, instructions: 'Test constraint: hold when evidence is insufficient.' }
const roots: string[] = [], watchers: ContestWatcher[] = []
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-18T02:00:00Z')) })
afterEach(async () => { for (const w of watchers.splice(0)) w.dispose(); vi.useRealTimers(); for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })
function snapshot(): ContestInspection { return { identity, fetchedAt: Date.now(), account: { data: { equity: 1000000 }, fetchedAt: Date.now() },
  positions: { data: [], fetchedAt: Date.now() }, openOrders: { data: [], fetchedAt: Date.now() }, pendingPlans: [], summary: [] } }
async function fixture(gateway?: unknown) {
  const root = await mkdtemp(join(tmpdir(), 'jev-watch-')); roots.push(root)
  let data = snapshot(), currentQuote: unknown
  const ctx = { get: (name: string) => name === 'pandaMcp' ? gateway : ({ describe: async () => ({ configured: true }), resolve: async () => ({ value: 'test-secret' }) }) } as unknown as Context
  const inspect = vi.fn(async () => data), query = vi.fn(async () => ({ data: currentQuote ?? { ready: true, contractCode: 'rb2610', latestPrice: 3000, quoteTime: new Date().toISOString() }, fetchedAt: Date.now() }))
  const prepare = vi.fn(async (request: { sessionId: string }) => {
    const plan: ContestPlan = { id: 'frozen-plan', sessionId: request.sessionId, identity, operation: 'place_order', createdAt: Date.now(), expiresAt: Date.now() + 60000,
      summary: 'test plan', details: { parameters: { contractCode: config.symbol } }, clientRequestId: 'test-request', status: 'prepared' }
    data = { ...data, pendingPlans: [plan] }; return plan
  })
  const execute = vi.fn(), dismiss = vi.fn(async () => { data = { ...data, pendingPlans: [] }; return {} })
  const contest = { root, status: vi.fn(async () => ({ identity, plans: data.pendingPlans })), researchIdentity: vi.fn(async () => identity), inspect, observe: inspect, query, prepare, execute, dismiss, reconcile: vi.fn(async () => ({})) } as unknown as ContestService
  const decide = vi.fn(async (): Promise<ContestWatchDecision> => ({ action: 'open_long', confidence: 0.9, probabilities: { hold: 0.05, open_long: 0.9, open_short: 0.05 }, model: 'jev-1.13.0', time: Date.now() }))
  const watcher = new ContestWatcher(ctx, contest, decide); watchers.push(watcher)
  const settle = () => (watcher as unknown as { decisionTask?: Promise<void> }).decisionTask
  const step = async () => { vi.setSystemTime(Date.now() + 60000); await watcher.tick(); await settle() }
  const warm = async (count = 8) => { for (let i = 0; i < count; i++) await step() }
  return { watcher, ctx, contest, decide, inspect, query, prepare, execute, dismiss, warm, step, settle,
    setSnapshot: (value: ContestInspection) => { data = value }, setQuote: (value: unknown) => { currentQuote = value } }
}

describe('Jev execution modes', () => {
  it('samples and decides for every selected market without mixing prices or price units', async () => {
    const f = await fixture()
    const rb = { product: 'rb', exchange: 'SHF' as const, tickSize: 1 }, au = { product: 'au', exchange: 'SHF' as const, tickSize: .02 }
    const multi = { ...config, instrument: rb, maxSpread: 2, contracts: [{ symbol: 'rb2610', instrument: rb }, { symbol: 'au2612', instrument: au }] }
    f.query.mockImplementation(async (request: any) => ({ data: { contractCode: request.symbol, latestPrice: request.symbol === 'rb2610' ? 3000 : 800, bidPrice1: request.symbol === 'rb2610' ? 3000 : 800, askPrice1: request.symbol === 'rb2610' ? 3001 : 800.02, quoteTime: new Date().toISOString() }, fetchedAt: Date.now() }))
    f.decide.mockImplementation(async () => ({ action: 'hold', confidence: 1, probabilities: { hold: 1 }, model: 'jev-1.13.0', time: Date.now() }))
    await f.watcher.start(multi)
    await f.warm(16)
    const calls = (f.decide.mock.calls as unknown[][]).map(call => ({ config: call[1] as ContestWatchConfig, samples: call[2] as { price: number }[] }))
    expect(calls.map(call => call.config.symbol)).toEqual(['rb2610', 'au2612'])
    expect(calls[0]!.samples.every(sample => sample.price === 3000)).toBe(true)
    expect(calls[1]!.samples.every(sample => sample.price === 800)).toBe(true)
    expect(calls[1]!.config.maxSpread).toBe(.04)
    const state = await f.watcher.status()
    expect(state.config?.contracts).toEqual(multi.contracts)
    expect(state.markets?.map(market => [market.symbol, market.sampleCount, market.analyses?.length])).toEqual([['rb2610', 8, 1], ['au2612', 8, 1]])
    const count = f.query.mock.calls.length
    await f.watcher.stop(); await f.step()
    expect(f.query).toHaveBeenCalledTimes(count)
    expect(f.prepare).not.toHaveBeenCalled()
    expect(f.execute).not.toHaveBeenCalled()
  })
  it('keeps delayed decisions attached to their market and discards a response after stopping all markets', async () => {
    const f = await fixture(), rb = { product: 'rb', exchange: 'SHF' as const, tickSize: 1 }, ma = { product: 'ma', exchange: 'CZC' as const, tickSize: 1 }
    f.query.mockImplementation(async (request: any) => ({ data: { contractCode: request.symbol, latestPrice: request.symbol === 'rb2610' ? 3000 : 2200, quoteTime: new Date().toISOString() }, fetchedAt: Date.now() }))
    let respond!: (value: ContestWatchDecision) => void
    f.decide.mockImplementation(() => new Promise(resolve => { respond = resolve }))
    await f.watcher.start({ ...config, instrument: rb, contracts: [{ symbol: 'rb2610', instrument: rb }, { symbol: 'MA701', instrument: ma }] })
    await f.warm(14)
    vi.setSystemTime(Date.now() + 60000); await f.watcher.tick()
    expect(f.decide).toHaveBeenCalledOnce()
    for (let i = 0; i < 2; i++) { vi.setSystemTime(Date.now() + 3000); await f.watcher.tick() }
    expect(f.decide).toHaveBeenCalledOnce()
    expect((await f.watcher.status()).markets?.map(item => item.sampleCount)).toEqual([10, 7])
    respond({ action: 'hold', confidence: 1, probabilities: { hold: 1 }, model: 'jev-1.13.0', time: Date.now() }); await f.settle()
    vi.setSystemTime(Date.now() + 3000); await f.watcher.tick()
    expect(f.decide).toHaveBeenCalledTimes(2)
    expect((f.decide.mock.calls as unknown[][]).map(call => (call[1] as ContestWatchConfig).symbol)).toEqual(['rb2610', 'MA701'])
    expect((f.decide.mock.calls as unknown[][])[1]![2]).toEqual(expect.arrayContaining([expect.objectContaining({ price: 2200 })]))
    await f.watcher.stop()
    respond({ action: 'open_long', confidence: 1, probabilities: { open_long: 1 }, model: 'jev-1.13.0', time: Date.now() }); await f.settle()
    expect((await f.watcher.status()).running).toBe(false)
    expect(f.prepare).not.toHaveBeenCalled()
    expect(f.execute).not.toHaveBeenCalled()
  })
  it('submits each selected contract through automatic execution with separate positions', async () => {
    const f = await fixture(), rb = { product: 'rb', exchange: 'SHF' as const, tickSize: 1 }, ma = { product: 'ma', exchange: 'CZC' as const, tickSize: 1 }
    f.query.mockImplementation(async (request: any) => ({ data: { contractCode: request.symbol, latestPrice: request.symbol === 'rb2610' ? 3000 : 2200, quoteTime: new Date().toISOString() }, fetchedAt: Date.now() }))
    f.decide.mockImplementation(async (...args: any[]) => {
      const action = args[3].allowed.includes('open_long') ? 'open_long' : 'hold'
      return { action, confidence: 1, probabilities: { [action]: 1 }, model: 'jev-1.13.0', time: Date.now() }
    })
    const positions: Record<string, unknown>[] = [], pending = new Map<string, any>(), submitted: string[] = []
    f.prepare.mockImplementation(async (request: any) => {
      const plan: ContestPlan = { id: `plan-${request.order.symbol}`, sessionId: request.sessionId, identity, operation: 'place_order', createdAt: Date.now(), expiresAt: Date.now() + 60000, summary: 'test automatic plan', details: { parameters: { contractCode: request.order.symbol } }, clientRequestId: request.order.symbol, status: 'prepared' }
      pending.set(plan.id, request.order)
      f.setSnapshot({ ...snapshot(), positions: { data: positions, fetchedAt: Date.now() }, pendingPlans: [plan] })
      return plan
    })
    f.execute.mockImplementation(async (id, _session, beforeSubmit) => {
      await beforeSubmit()
      const order = pending.get(id)!
      submitted.push(order.symbol)
      positions.push({ contractCode: order.symbol, direction: 'long', position: 1, closable: 1, openPrice: order.symbol === 'rb2610' ? 3000 : 2200 })
      f.setSnapshot({ ...snapshot(), positions: { data: [...positions], fetchedAt: Date.now() } })
      return { status: 'submitted' }
    })
    await f.watcher.start({ ...config, executionMode: 'automatic', openingCooldownSeconds: 0, instrument: rb, contracts: [{ symbol: 'rb2610', instrument: rb }, { symbol: 'MA701', instrument: ma }] }, 'automatic-orders-v1')
    await f.warm(18)
    expect(submitted).toEqual(['rb2610', 'MA701'])
    expect(f.execute).toHaveBeenCalledTimes(2)
    expect((await f.watcher.status()).openingPlanCount).toBe(2)
    await f.watcher.stop(); await f.step()
    expect(submitted).toHaveLength(2)
  })
  it('keeps a market with missing quotes from starving another selected market', async () => {
    const f = await fixture()
    const rb = { product: 'rb', exchange: 'SHF' as const, tickSize: 1 }, au = { product: 'au', exchange: 'SHF' as const, tickSize: .02 }
    f.query.mockImplementation(async (request: any) => ({ data: request.symbol === 'rb2610' ? { ready: false } : { contractCode: request.symbol, latestPrice: 800, quoteTime: new Date().toISOString() }, fetchedAt: Date.now() }))
    f.decide.mockImplementation(async () => ({ action: 'hold', confidence: 1, probabilities: { hold: 1 }, model: 'jev-1.13.0', time: Date.now() }))
    await f.watcher.start({ ...config, instrument: rb, contracts: [{ symbol: 'rb2610', instrument: rb }, { symbol: 'au2612', instrument: au }] })
    await f.warm(16)
    const state = await f.watcher.status()
    expect(state.running).toBe(true)
    expect(state.markets?.map(item => item.sampleCount)).toEqual([0, 8])
    expect(f.decide).toHaveBeenCalledOnce()
    expect((f.decide.mock.calls as unknown[][])[0]![1]).toMatchObject({ symbol: 'au2612' })
  })
  it('rejects duplicate or mismatched additional contracts before touching the account', async () => {
    const f = await fixture(), instrument = { product: 'rb', exchange: 'SHF' as const, tickSize: 1 }
    for (const symbol of ['RB2610', 'au2612', 'rb']) {
      await expect(f.watcher.start({ ...config, instrument, contracts: [{ symbol: 'rb2610', instrument }, { symbol, instrument }] })).rejects.toThrow()
    }
    expect(f.inspect).not.toHaveBeenCalled()
    expect(f.query).not.toHaveBeenCalled()
  })
  it('creates plans for different contracts under one shared opening limit and preserves configuration on restart', async () => {
    const f = await fixture(), rb = { product: 'rb', exchange: 'SHF' as const, tickSize: 1 }, au = { product: 'au', exchange: 'SHF' as const, tickSize: .02 }
    const multi = { ...config, instrument: rb, openingCooldownSeconds: 0, maxPlans: 2, contracts: [{ symbol: 'rb2610', instrument: rb }, { symbol: 'au2612', instrument: au }] }
    f.query.mockImplementation(async (request: any) => ({ data: { contractCode: request.symbol, latestPrice: request.symbol === 'rb2610' ? 3000 : 800, quoteTime: new Date().toISOString() }, fetchedAt: Date.now() }))
    let openedRb = false
    f.decide.mockImplementation(async (...args: any[]) => {
      const hold = args[1].symbol === 'rb2610' && openedRb
      if (args[1].symbol === 'rb2610') openedRb = true
      return { action: hold ? 'hold' : 'open_long', confidence: 1, probabilities: { hold: hold ? 1 : 0, open_long: hold ? 0 : 1 }, model: 'jev-1.13.0', time: Date.now() }
    })
    f.prepare.mockImplementation(async (request: any) => {
      const plan = { id: `plan-${request.order.symbol}`, sessionId: request.sessionId, identity, operation: 'place_order' as const, createdAt: Date.now(), expiresAt: Date.now() + 60000, summary: 'test', details: { parameters: { contractCode: request.order.symbol } }, clientRequestId: request.order.symbol, status: 'prepared' as const }
      f.setSnapshot({ ...snapshot(), pendingPlans: [plan] }); return plan
    })
    await f.watcher.start(multi); await f.warm(15)
    expect(f.prepare).toHaveBeenCalledTimes(1)
    f.setSnapshot(snapshot()); await f.warm(3)
    expect(f.prepare.mock.calls.map(call => (call[0] as any).order.symbol)).toEqual(['rb2610', 'au2612'])
    f.setSnapshot(snapshot()); await f.warm(4)
    expect(f.prepare).toHaveBeenCalledTimes(2)
    expect((await f.watcher.status()).openingPlanCount).toBe(2)
    await f.watcher.stop()
    const restored = new ContestWatcher(f.ctx, f.contest, f.decide); watchers.push(restored)
    const status = await restored.status()
    expect(status.running).toBe(false)
    expect(status.config?.contracts).toEqual(multi.contracts)
    expect(status.markets?.map(item => item.sampleCount)).toEqual([0, 0])
    expect(f.execute).not.toHaveBeenCalled()
  })
  it('keeps watching when the local trading budget is full and re-evaluates after release', async () => {
    const f = await fixture()
    f.prepare.mockRejectedValueOnce(new ContestQuotaError('trade', 60))
    await f.watcher.start(config)
    await f.warm()
    expect(await f.watcher.status()).toMatchObject({ running: true, nextDecisionAt: Date.now() + 60000, planCount: 0 })
    expect((await f.watcher.status()).message).toContain('额度恢复后重新判断')
    expect(f.execute).not.toHaveBeenCalled()
    const count = f.decide.mock.calls.length
    await f.step()
    expect(f.decide).toHaveBeenCalledTimes(count + 1)
    expect(await f.watcher.status()).toMatchObject({ running: true, planCount: 1 })
  })
  it('performs one full startup inspection and uses account observations while sampling', async () => {
    const f = await fixture()
    const observe = vi.fn(async () => snapshot())
    f.contest.observe = observe
    await f.watcher.start(config)
    expect(f.contest.researchIdentity).not.toHaveBeenCalled()
    expect(f.inspect).toHaveBeenCalledOnce()
    await f.step()
    expect(observe).toHaveBeenCalledOnce()
    expect(f.inspect).toHaveBeenCalledOnce()
  })

  it('keeps a failed startup stopped and publishes the server cooldown', async () => {
    const f = await fixture()
    f.inspect.mockRejectedValueOnce(new ContestCliError('rate_limit_exceeded', '接口限流', 90))
    await expect(f.watcher.start(config)).rejects.toThrow('接口限流')
    expect(await f.watcher.status()).toMatchObject({ running: false, nextRetryAt: Date.now() + 90000 })
    expect(f.decide).not.toHaveBeenCalled()
    expect(f.execute).not.toHaveBeenCalled()
  })
  it('requires fresh risk consent to start automatic execution, including a saved template', async () => {
    const f = await fixture()
    const automatic = { ...config, executionMode: 'automatic' as const }
    await expect(f.watcher.start(automatic)).rejects.toThrow('风险')
    await expect(f.watcher.start(automatic, 'old-version')).rejects.toThrow('风险')
    expect(f.prepare).not.toHaveBeenCalled()
    expect(f.execute).not.toHaveBeenCalled()
    expect((await f.watcher.start(config)).config?.executionMode).toBe('manual')
  })

  it('executes the frozen plan automatically only after run-scoped consent', async () => {
    const f = await fixture()
    f.execute.mockImplementation(async (_id, _session, beforeSubmit) => { await beforeSubmit(); return { status: 'submitted' } })
    const state = await f.watcher.start({ ...config, executionMode: 'automatic' }, 'automatic-orders-v1')
    expect(state.executionAuthorization).toMatchObject({ version: 'automatic-orders-v1', runId: state.runId })
    await f.warm()
    expect(f.prepare.mock.calls[0]?.[0]).toMatchObject({ order: { symbol: 'rb2610', volume: 1 } })
    expect(f.execute).toHaveBeenCalledOnce()
    expect((await f.watcher.status()).analyses?.at(-1)).toMatchObject({ planStatus: 'submitted' })
    await f.watcher.tick(); await f.settle()
    expect(f.execute).toHaveBeenCalledOnce()
  })

  it('stopping between plan preparation and submission prevents an automatic order', async () => {
    const f = await fixture(), submitted = vi.fn()
    f.execute.mockImplementation(async (_id, _session, beforeSubmit) => {
      await f.watcher.stop(); await beforeSubmit(); submitted(); return { status: 'submitted' }
    })
    await f.watcher.start({ ...config, executionMode: 'automatic' }, 'automatic-orders-v1'); await f.warm()
    expect(submitted).not.toHaveBeenCalled()
    expect(f.dismiss).toHaveBeenCalled()
    expect((await f.watcher.status()).running).toBe(false)
  })

  it('cannot reuse consent after stopping and restarting the same automatic configuration', async () => {
    const f = await fixture(), automatic = { ...config, executionMode: 'automatic' as const }
    await f.watcher.start(automatic, 'automatic-orders-v1'); await f.watcher.stop()
    await expect(f.watcher.start(automatic)).rejects.toThrow('风险')
    expect(f.execute).not.toHaveBeenCalled()
  })
})

describe('Jev manual watcher', () => {
  it('accepts every futures product without a server whitelist and routes history to its exact contract', async () => {
    const databaseFetch = vi.fn(async () => ({ id: 'all-products-history' }))
    const f = await fixture({ databaseList: async () => [], databaseFetch })
    for (const row of products) {
      const symbol = row.product.replace('_f', '') + (row.exchange === 'CZC' ? '701' : '2701') + (row.product.endsWith('_f') ? 'F' : '')
      const state = await f.watcher.start(rangeTemplate(symbol))
      expect(state.config?.symbol).toBe(symbol)
      expect(databaseFetch).toHaveBeenLastCalledWith(expect.objectContaining({ source: expect.objectContaining({ params: expect.objectContaining({ symbol: symbol.toUpperCase() + '.' + row.exchange }) }) }), expect.any(AbortSignal))
      await f.watcher.stop()
    }
    expect(f.decide).not.toHaveBeenCalled()
    expect(f.prepare).not.toHaveBeenCalled()
    expect(f.execute).not.toHaveBeenCalled()
  })
  it('continues exit decisions during opening cooldown and after the opening quota is exhausted', async () => {
    const f = await fixture()
    await f.watcher.start({ ...config, maxPlans: 1 }); await f.warm()
    const openedAt = Date.now()
    f.setSnapshot({ ...snapshot(), positions: { data: [{ contractCode: 'RB2610.SHF', direction: 'long', position: 1, closable: 1, openPrice: 3000 }], fetchedAt: Date.now() } })
    f.decide.mockImplementation(async () => ({ action: 'close_long', confidence: .9, probabilities: { hold: .1, close_long: .9 }, model: 'jev-1.13.0', time: Date.now() }))
    await f.step()
    expect(Date.now() - openedAt).toBeLessThan(300000)
    expect(f.decide).toHaveBeenCalledTimes(2)
    expect(f.decide.mock.calls.at(-1)?.[3]).toMatchObject({ volume: 1, entryPrice: 3000, allowed: ['hold', 'close_long'] })
    expect(f.prepare.mock.calls.at(-1)?.[0]).toMatchObject({ order: { offset: 'close', direction: 'sell', volume: 1 } })
    expect(await f.watcher.status()).toMatchObject({ running: true, planCount: 2, openingPlanCount: 1 })
    f.setSnapshot(snapshot()); await f.step()
    expect(f.prepare).toHaveBeenCalledTimes(2)
    expect((await f.watcher.status()).message).toContain('开仓计划上限')
    expect(f.execute).not.toHaveBeenCalled()
  })
  it('applies configurable cooldown only to a new opening, with zero disabling it', async () => {
    for (const cooldown of [0, 120]) {
      const f = await fixture()
      await f.watcher.start({ ...config, openingCooldownSeconds: cooldown } as ContestWatchConfig); await f.warm()
      f.setSnapshot(snapshot()); await f.step()
      expect(f.prepare).toHaveBeenCalledTimes(cooldown ? 1 : 2)
      if (cooldown) { await f.step(); expect(f.prepare).toHaveBeenCalledTimes(2) }
      expect(f.execute).not.toHaveBeenCalled()
    }
  })
  it('rejects invalid opening cooldowns and persists the default', async () => {
    const f = await fixture()
    for (const openingCooldownSeconds of [-1, .5, 3601]) await expect(f.watcher.start({ ...config, openingCooldownSeconds } as ContestWatchConfig)).rejects.toThrow()
    await f.watcher.start(config)
    expect((await f.watcher.status()).config).toMatchObject({ openingCooldownSeconds: 300 })
  })
  it('refreshes the cached flat account immediately after a plan resolves and can close a short', async () => {
    const f = await fixture()
    await f.watcher.start({ ...config, intervalSeconds: 3, decisionIntervalSeconds: 3 }); await f.warm()
    const inspections = f.inspect.mock.calls.length
    f.setSnapshot({ ...snapshot(), positions: { data: [{ contractCode: 'RB2610.SHF', direction: 'short', position: 1, closable: 1, openPrice: 3000 }], fetchedAt: Date.now() } })
    f.decide.mockImplementation(async () => ({ action: 'close_short', confidence: .9, probabilities: { hold: .1, close_short: .9 }, model: 'jev-1.13.0', time: Date.now() }))
    vi.setSystemTime(Date.now() + 3000); await f.watcher.tick(); await f.settle()
    expect(f.inspect.mock.calls.length).toBeGreaterThan(inspections)
    expect(f.decide.mock.calls.at(-1)?.[3]).toMatchObject({ volume: 1, allowed: ['hold', 'close_short'] })
    expect(f.prepare.mock.calls.at(-1)?.[0]).toMatchObject({ order: { offset: 'close', direction: 'buy', volume: 1 } })
    expect(await f.watcher.status()).toMatchObject({ openingPlanCount: 1, planCount: 2 })
    expect(f.execute).not.toHaveBeenCalled()
  })
  it('starts every default on a user-selected product with its own rules and tick', async () => {
    for (const kind of ['range', 'trend', 'breakout'] as const) {
      const fetchHistory = vi.fn(async () => ({ id: 'gold-history' }))
      const f = await fixture({ databaseList: async () => [], databaseFetch: fetchHistory })
      const template = makeTemplate(kind, rangeTemplate('au2612'))
      await f.watcher.start(template)
      expect(fetchHistory).toHaveBeenCalledWith(expect.objectContaining({ source: expect.objectContaining({ params: expect.objectContaining({ symbol: 'AU2612.SHF' }) }) }), expect.any(AbortSignal))
      expect((await f.watcher.status()).config?.instrument).toMatchObject({ product: 'au', tickSize: .02 })
      expect(f.execute).not.toHaveBeenCalled()
      await f.watcher.stop()
    }
  })
  it('saves templates without a contract but requires one to start, rejecting mismatched rules and incomplete blank strategies', async () => {
    const f = await fixture(), base = rangeTemplate()
    await f.watcher.saveTemplate({ name: '趋势模板', config: makeTemplate('trend', base) })
    expect((await f.watcher.templates())[0]!.config.symbol).toBe('')
    await expect(f.watcher.start(makeTemplate('trend', base))).rejects.toThrow('实际合约')
    const trend = makeTemplate('trend', rangeTemplate('au2612'))
    await expect(f.watcher.start({ ...trend, instrument: { ...trend.instrument!, exchange: 'DCE' } })).rejects.toThrow('交易所')
    await expect(f.watcher.start({ ...trend, signalRules: { ...trend.signalRules!, tickSize: 1 } })).rejects.toThrow('tick')
    await expect(f.watcher.start({ ...trend, signalRules: { ...trend.signalRules!, fastBars: 20 } })).rejects.toThrow('策略条件')
    await expect(f.watcher.start({ ...trend, signalRules: undefined })).rejects.toThrow('策略条件')
    const blank = makeTemplate('blank', base)
    await expect(f.watcher.saveTemplate({ name: '我的策略', config: blank })).rejects.toThrow('五种动作标准')
    blank.instructions = '只根据我提供的数据判断。'
    blank.actionCriteria = { hold: '其他情形观望', open_long: '上涨且有回踩', open_short: '下跌且有反弹', close_long: '多头条件失效', close_short: '空头条件失效' }
    await f.watcher.saveTemplate({ name: '我的策略', config: blank })
    const reopened = new ContestWatcher(f.ctx, f.contest, f.decide); watchers.push(reopened)
    expect((await reopened.templates()).find(item => item.name === '我的策略')?.config).toMatchObject({ customStrategy: true, instructions: blank.instructions, actionCriteria: blank.actionCriteria })
    expect(f.prepare).not.toHaveBeenCalled(); expect(f.execute).not.toHaveBeenCalled()
  })
  it('automatically prepares matching PandaData history before starting a template', async () => {
    const databaseFetch = vi.fn(async () => ({ id: 'prepared-history' }))
    const f = await fixture({ databaseList: async () => [], databaseFetch })
    await f.watcher.start({ ...config, builtInTemplate: 'rb-range', autoHistory: { exchange: 'SHF', barSeconds: 60 } })
    expect(databaseFetch).toHaveBeenCalledWith(expect.objectContaining({ source: expect.objectContaining({ params: expect.objectContaining({ symbol: 'RB2610.SHF', frequency: '1m' }) }) }), expect.any(AbortSignal))
    expect(await f.watcher.status()).toMatchObject({ running: true, config: { history: { datasetId: 'prepared-history', refresh: true } } })
    expect(f.execute).not.toHaveBeenCalled()
  })
  it('does not start after a history preparation failure or silently apply the RB template to a different product', async () => {
    const f = await fixture({ databaseList: async () => [], databaseFetch: async () => { throw Error('offline') } })
    await expect(f.watcher.start({ ...config, autoHistory: { exchange: 'SHF', barSeconds: 60 } })).rejects.toThrow('PandaData')
    expect((await f.watcher.status()).running).toBe(false)
    await expect(f.watcher.start({ ...config, symbol: 'au2612', builtInTemplate: 'rb-range', autoHistory: { exchange: 'SHF', barSeconds: 60 } })).rejects.toThrow('适用于螺纹钢')
    expect(f.prepare).not.toHaveBeenCalled()
  })
  it('cancels startup while automatic history is being prepared', async () => {
    let finish!: (value: { id: string }) => void
    const databaseFetch = vi.fn(() => new Promise<{ id: string }>(resolve => { finish = resolve }))
    const f = await fixture({ databaseList: async () => [], databaseFetch })
    const starting = f.watcher.start({ ...config, autoHistory: { exchange: 'SHF', barSeconds: 60 } })
    const rejected = expect(starting).rejects.toThrow()
    await vi.waitFor(() => expect(databaseFetch).toHaveBeenCalledOnce())
    await f.watcher.stop(); finish({ id: 'late-history' }); await rejected
    expect((await f.watcher.status()).running).toBe(false); expect(f.decide).not.toHaveBeenCalled()
  })
  it('persists complete custom templates, serializes saves and updates an existing name without carrying stale dataset IDs', async () => {
    const f = await fixture()
    await Promise.all([f.watcher.saveTemplate({ name: '早盘', config }), f.watcher.saveTemplate({ name: '午后', config: { ...config, decisionIntervalSeconds: 45 } })])
    const reopened = new ContestWatcher(f.ctx, f.contest, f.decide); watchers.push(reopened)
    expect((await reopened.templates()).map(x => x.name)).toEqual(['早盘', '午后'])
    await f.watcher.saveTemplate({ name: '早盘', config: { ...config, volume: 2, builtInTemplate: 'rb-range', autoHistory: { exchange: 'SHF', barSeconds: 60 } } })
    const saved = (await f.watcher.templates()).find(x => x.name === '早盘')!
    expect(saved.config).toMatchObject({ volume: 2, strategyName: '早盘', autoHistory: { exchange: 'SHF', barSeconds: 60 } })
    expect(saved.config.builtInTemplate).toBeUndefined(); expect(await f.watcher.templates()).toHaveLength(2)
    await expect(f.watcher.saveTemplate({ name: ' ', config })).rejects.toThrow('模板名称')
    await expect(f.watcher.saveTemplate({ name: 'bad', config: { ...config, volume: 0 } })).rejects.toThrow('有效参数')
  })
  const rangeRules = { lookbackBars: 20, tickSize: 1, minWidthTicks: 8, minTouches: 2, edgeFraction: .2, reboundTicks: 2, roundTripCostTicks: 1, minRewardCostRatio: 2, stopLossTicks: 8, takeProfitTicks: 10 }
  it('requests a real model assessment for missing history in Jev mode, without opening a position', async () => {
    const f = await fixture()
    f.decide.mockImplementation(async () => ({ action: 'hold', confidence: 1, probabilities: { hold: 1 }, model: 'jev-1.13.0', time: Date.now() }))
    await f.watcher.start({ ...config, decisionMode: 'jev', rangeRules }); await f.warm()
    expect(f.decide).toHaveBeenCalledOnce()
    expect(f.decide.mock.calls[0]?.[3]).toMatchObject({ allowed: ['hold'] })
    expect(f.prepare).not.toHaveBeenCalled(); expect(f.execute).not.toHaveBeenCalled()
    expect((await f.watcher.status()).analyses![0]!.decision?.action).toBe('hold')
  })
  it('lets Jev select an opening despite unmet strategy references and still rechecks hard limits', async () => {
    const columns = { time: 'time', symbol: 'symbol', open: 'open', high: 'high', low: 'low', close: 'close' }
    const dataset = { id: 'bars', name: 'test', kind: 'timeseries', category: 'market', columns: Object.values(columns), source: { kind: 'local' }, fetchedAt: new Date().toISOString() }
    const gateway = { databaseList: async () => [dataset], databaseQuery: async () => ({ status: 'ok', dataset, total: 20,
      rows: Array.from({ length: 20 }, (_, i) => ({ symbol: 'rb2610', time: Date.now() - (20 - i) * 60000, open: 3000, close: 3000, low: 2990, high: 3010 })) }) }
    const f = await fixture(gateway)
    f.decide.mockImplementation(async () => ({ action: 'open_long', confidence: .9, probabilities: { hold: .05, open_long: .9, open_short: .05 }, model: 'jev-1.13.0', time: Date.now(),
      assessments: { regime: { choice: 'range', confidence: 1, probabilities: { range: 1 } }, fit: { choice: 'contradicted', confidence: 1, probabilities: { contradicted: 1 } }, blocker: { choice: 'entry_not_met', confidence: 1, probabilities: { entry_not_met: 1 } } } }))
    await f.watcher.start({ ...config, decisionMode: 'jev', rangeRules, history: { datasetId: 'bars', barSeconds: 60, timeMeaning: 'close', refresh: false, columns } }); await f.warm()
    expect(f.decide).toHaveBeenCalledOnce(); expect(f.prepare).toHaveBeenCalledOnce(); expect(f.execute).not.toHaveBeenCalled()
    expect((await f.watcher.status()).analyses![0]!.evidence?.checks.find(item => item.id === 'rebound')).toMatchObject({ state: 'fail', enforcement: 'reference' })
    expect((await f.watcher.status()).analyses![0]).toMatchObject({ planStatus: 'prepared', reviewNotes: [expect.stringContaining('独立分项判断不一致')] })
    const blocked = await fixture(gateway)
    await blocked.watcher.start({ ...config, decisionMode: 'jev', rangeRules, maxSpread: 1, history: { datasetId: 'bars', barSeconds: 60, timeMeaning: 'close', refresh: false, columns } }); await blocked.warm()
    expect(blocked.decide).toHaveBeenCalledOnce(); expect(blocked.prepare).not.toHaveBeenCalled()
  })
  it('starts analysis with an unavailable automatic source and recovers history on a later retry', async () => {
    let available = false
    const columns = { time: 'datetime', symbol: 'symbol', open: 'open', high: 'high', low: 'low', close: 'close' }
    const dataset = { id: 'recovered', name: 'Panda bars', kind: 'timeseries', category: 'market', columns: Object.values(columns), source: { kind: 'pandadata', method: 'get_future_min', params: { frequency: '1m' } }, fetchedAt: new Date().toISOString() }
    const gateway = { databaseList: async () => available ? [dataset] : [], databaseFetch: vi.fn(async () => { if (!available) throw Error('offline'); return dataset }),
      databaseQuery: async () => ({ status: 'ok', dataset, total: 20, rows: Array.from({ length: 20 }, (_, i) => ({ symbol: 'rb2610', datetime: Date.now() - (21 - i) * 60000, open: 3000, close: 3000, high: 3010, low: 2990 })) }) }
    const f = await fixture(gateway)
    f.decide.mockImplementation(async () => ({ action: 'hold', confidence: 1, probabilities: { hold: 1 }, model: 'jev-1.13.0', time: Date.now() }))
    await f.watcher.start({ ...config, decisionMode: 'jev', rangeRules, autoHistory: { exchange: 'SHF', barSeconds: 60 } })
    expect((await f.watcher.status()).running).toBe(true)
    await f.warm(); expect(f.decide).toHaveBeenCalledOnce(); expect(f.prepare).not.toHaveBeenCalled()
    const limited = (await f.watcher.status()).analyses!.at(-1)!
    expect(limited.outcome).toContain('受限观望')
    expect(limited.outcome).toContain('置信度不适用')
    expect(limited.outcome).not.toContain('100.0%')
    expect(limited.decision?.confidence).toBe(1)
    available = true; await f.step()
    expect((await f.watcher.status()).config?.history?.datasetId).toBe('recovered')
    expect((await f.watcher.status()).analyses!.at(-1)!.allowedActions).toContain('open_long')
    expect(f.execute).not.toHaveBeenCalled()
  })
  it('sends advisory checks, raw data and hard limits, and rejects forbidden model choices even in Jev mode', async () => {
    const f = await fixture(), input = { ...config, decisionMode: 'jev' as const, rangeRules }
    const request = vi.fn<typeof fetch>(async () => Response.json({ model: 'jev-1.13.0', answers: { ...assessments, action: { type: 'choice', choice: 'hold', confidence: 1, probabilities: { hold: 1 } } } }))
    await expect(decideWithJev(f.ctx, input, [], watchAccount(snapshot(), input), new AbortController().signal, request)).resolves.toMatchObject({ action: 'hold' })
    const sent = JSON.parse(request.mock.calls[0]![1]!.body as string)
    expect(sent.state.strategy.decisionMode).toBe('jev'); expect(sent.state.strategy.numericRulesRole).toContain('not hard entry gates')
    expect(sent.state.hardLimits.allowedActions).toEqual(['hold'])
    expect(Object.keys(sent.questions.action.criteria)).toEqual(['hold'])
    expect(sent.state.evidence.checks.find((item: { id: string }) => item.id === 'history')).toMatchObject({ enforcement: 'hard', state: 'fail' })
    request.mockResolvedValueOnce(Response.json({ model: 'jev-1.13.0', answers: { ...assessments, action: { type: 'choice', choice: 'open_long', confidence: 1, probabilities: { open_long: 1 } } } }))
    await expect(decideWithJev(f.ctx, input, [], watchAccount(snapshot(), input), new AbortController().signal, request)).rejects.toThrow('不允许的动作')
  })
  it('records missing required history as a program gate without inventing a model hold or making an API call', async () => {
    const f = await fixture(); await f.watcher.start({ ...config, rangeRules }); await f.warm()
    expect(f.decide).not.toHaveBeenCalled(); expect(f.prepare).not.toHaveBeenCalled()
    const round = (await f.watcher.status()).analyses![0]!
    expect(round.decision).toBeUndefined(); expect(round.outcome).toContain('未请求 Jev')
    expect(round.evidence?.checks.find(item => item.id === 'history')).toMatchObject({ state: 'fail' })
    expect((await f.watcher.status()).running).toBe(true)
  })
  it('blocks an opening decision that conflicts with the model assessments', async () => {
    const f = await fixture()
    f.decide.mockResolvedValue({ action: 'open_long', confidence: .99, probabilities: { hold: .01, open_long: .99, open_short: 0 }, model: 'jev-1.13.0', time: Date.now(),
      assessments: { regime: { choice: 'range', confidence: 1, probabilities: { range: 1 } }, fit: { choice: 'insufficient', confidence: 1, probabilities: { insufficient: 1 } }, blocker: { choice: 'data_missing', confidence: 1, probabilities: { data_missing: 1 } } } })
    await f.watcher.start(config); await f.warm()
    expect(f.prepare).not.toHaveBeenCalled(); expect((await f.watcher.status()).analyses![0]!.outcome).toContain('冲突')
  })
  it('rechecks numeric rules on the latest quote before freezing any plan', async () => {
    const columns = { time: 'time', symbol: 'symbol', open: 'open', high: 'high', low: 'low', close: 'close' }
    const dataset = { id: 'bars', name: 'test', kind: 'timeseries', category: 'market', columns: Object.values(columns), source: { kind: 'local' }, fetchedAt: new Date().toISOString() }
    const gateway = { databaseList: async () => [dataset], databaseQuery: async () => ({ status: 'ok', dataset, total: 20,
      rows: Array.from({ length: 20 }, (_, i) => ({ symbol: 'RB2610.SHF', time: Date.now() - (20 - i) * 60000, open: 3008, close: 3008, low: i % 4 === 0 ? 2998 : 3006, high: i % 4 === 2 ? 3018 : 3010 })) }) }
    const f = await fixture(gateway)
    let calls = 0
    f.query.mockImplementation(async () => { const price = ++calls === 7 ? 2998 : calls > 8 ? 3025 : 3000; return { data: { ready: true, contractCode: 'rb2610', latestPrice: price, bidPrice1: price - 1, askPrice1: price, quoteTime: new Date().toISOString() }, fetchedAt: Date.now() } })
    await f.watcher.start({ ...config, builtInTemplate: 'rb-range', rangeRules, history: { datasetId: 'bars', barSeconds: 60, timeMeaning: 'close', refresh: false, columns } }); await f.warm()
    expect(f.decide).toHaveBeenCalledOnce(); expect(f.prepare).not.toHaveBeenCalled()
    expect((await f.watcher.status()).analyses![0]!.outcome).toContain('最新行情已不满足')
  })
  it('enforces side and spread limits without blocking the exit of an existing position', async () => {
    expect(watchSpread({ ...config, maxSpread: .04 }, { time: Date.now(), price: 100.02, bid: 100, ask: 100.04 })).toBe(true)
    expect(watchAccount(snapshot(), { ...config, allowedSide: 'long_only' }).allowed).toEqual(['hold', 'open_long'])
    const held = { ...snapshot(), positions: { data: [{ contractCode: 'rb2610', direction: 'short', volume: 1, closable: 1 }], fetchedAt: Date.now() } }
    expect(watchAccount(held, { ...config, allowedSide: 'long_only' }).allowed).toEqual(['hold', 'close_short'])
    expect(watchSpread({ ...config, maxSpread: 2 }, { time: Date.now(), price: 3000 })).toBe(false)
    expect(watchSpread({ ...config, maxSpread: 2 }, { time: Date.now(), price: 3000, bid: 2999, ask: 3001 })).toBe(true)
    const f = await fixture(); await f.watcher.start({ ...config, maxSpread: 1 }); await f.warm(7)
    f.setQuote({ ready: true, contractCode: 'rb2610', latestPrice: 3000, bidPrice1: 2998, askPrice1: 3002, quoteTime: new Date(Date.now() + 60000).toISOString() })
    await f.step(); expect(f.prepare).not.toHaveBeenCalled()
    expect((await f.watcher.status()).analyses?.[0]?.allowedActions).toEqual(['hold'])
  })
  it('uses the configured minimum sample count and forwards custom criteria and reference material', async () => {
    const f = await fixture(); await f.watcher.start({ ...config, minSamples: 10 }); await f.warm(9)
    expect(f.decide).not.toHaveBeenCalled(); await f.step(); expect(f.decide).toHaveBeenCalledOnce()
    const request = vi.fn<typeof fetch>(async () => Response.json({ model: 'jev-1.13.0', answers: { ...assessments, action: { type: 'choice', choice: 'hold', confidence: 1, probabilities: { hold: 1, open_long: 0 } } }, usage: { input_tokens: 812, output_tokens: 21 } }))
    const custom = { ...config, strategyName: 'Custom rebound', allowedSide: 'long_only' as const, actionCriteria: { open_long: 'Open long only on supplied rebound evidence', close_long: 'Exit when the rebound fails' }, referenceMaterial: '2026-09-18 custom strategy notes' }
    const result = await decideWithJev(f.ctx, custom, [], watchAccount(snapshot(), custom), new AbortController().signal, request)
    const sent = JSON.parse(request.mock.calls[0]![1]!.body as string)
    expect(sent.questions.action.criteria).toMatchObject({ open_long: custom.actionCriteria.open_long })
    expect(sent.questions.action.criteria).not.toHaveProperty('open_short')
    expect(Object.keys(sent.state.strategy.actionCriteria)).toHaveLength(5)
    expect(sent.state.strategy.actionCriteria.close_long).toBe(custom.actionCriteria.close_long)
    expect(sent.state.strategy.name).toBe(custom.strategyName)
    expect(sent.state.dataSummary.barTimeMeaning).toBe('close')
    expect(sent.state.referenceMaterial).toBe(custom.referenceMaterial)
    expect(sent.questions.action.instructions).toContain(config.instructions)
    expect(result.usage).toEqual({ input_tokens: 812, output_tokens: 21 })
  })
  it('increases backoff for repeated failures but never retries an unconfirmed plan mutation', async () => {
    const f = await fixture(); await f.watcher.start(config)
    f.inspect.mockRejectedValueOnce(new ContestCliError('timeout', 'timeout')); await f.step()
    f.inspect.mockRejectedValueOnce(new ContestCliError('network_error', 'network'))
    vi.setSystemTime(Date.now() + 30000); await f.watcher.tick()
    expect((await f.watcher.status()).nextRetryAt).toBe(Date.now() + 60000)
    vi.setSystemTime(Date.now() + 60000); await f.watcher.tick(); await f.warm(6)
    f.prepare.mockRejectedValueOnce(new ContestCliError('rate_limit_exceeded', 'rate limit'))
    await f.step()
    expect((await f.watcher.status()).running).toBe(false)
    await f.step(); expect(f.prepare).toHaveBeenCalledOnce(); expect(f.execute).not.toHaveBeenCalled()
  })
  it('uses thirty seconds for repeated read rate limits and honors longer server waits', async () => {
    const f = await fixture(); await f.watcher.start(config)
    vi.setSystemTime(Date.now() + 30000)
    for (const delay of [30, 30, 90]) {
      f.inspect.mockRejectedValueOnce(new ContestCliError('rate_limit_exceeded', 'limited', delay))
      await f.watcher.tick()
      expect((await f.watcher.status()).nextRetryAt).toBe(Date.now() + delay * 1000)
      vi.setSystemTime(Date.now() + delay * 1000)
    }
    expect(f.execute).not.toHaveBeenCalled()
  })

  it('samples every three seconds without repeating account inspection each tick', async () => {
    const f = await fixture(); await f.watcher.start({ ...config, intervalSeconds: 3 })
    for (let i = 0; i < 7; i++) { vi.setSystemTime(Date.now() + 3000); await f.watcher.tick() }
    expect(f.query).toHaveBeenCalledTimes(7); expect(f.inspect).toHaveBeenCalledTimes(1)
    vi.setSystemTime(Date.now() + 9000); await f.watcher.tick(); await f.settle()
    expect(f.inspect.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
  it('backs off read-only rate limits without retaining stale samples, then resumes', async () => {
    const f = await fixture(); await f.watcher.start(config); await f.warm(2)
    f.inspect.mockRejectedValueOnce(new ContestCliError('rate_limit_exceeded', '柜台限流'))
    await f.step()
    const failed = await f.watcher.status()
    expect(failed).toMatchObject({ running: true, phase: 'waiting_quote', sampleCount: 0, nextRetryAt: Date.now() + 30000 })
    const calls = f.inspect.mock.calls.length
    vi.setSystemTime(Date.now() + 3000); await f.watcher.tick()
    expect(f.inspect).toHaveBeenCalledTimes(calls)
    vi.setSystemTime(Date.now() + 27000); await f.watcher.tick()
    expect(await f.watcher.status()).toMatchObject({ running: true, sampleCount: 1 })
    expect(f.execute).not.toHaveBeenCalled()
  })
  it('is off by default, warms up, freezes one plan and waits for human confirmation without executing', async () => {
    const f = await fixture()
    await f.watcher.tick(); expect(f.inspect).not.toHaveBeenCalled()
    await f.watcher.start({ ...config, maxPlans: 1 }); await f.warm(7)
    expect(f.decide).not.toHaveBeenCalled()
    await f.step(); expect(f.prepare).toHaveBeenCalledOnce()
    expect(f.prepare.mock.calls[0]![0]).toMatchObject({ operation: 'place_order', order: { symbol: 'rb2610', volume: 1, direction: 'buy', offset: 'open' } })
    await f.step()
    expect((await f.watcher.status()).running).toBe(true)
    expect(f.prepare).toHaveBeenCalledOnce(); expect(f.execute).not.toHaveBeenCalled()
    expect((await f.watcher.status()).message).toContain('等待计划确认')
  })
  it('validates configuration and refuses startup with open orders', async () => {
    const f = await fixture()
    await expect(f.watcher.start({ ...config, symbol: '黄金' })).rejects.toThrow('实际合约')
    f.setSnapshot({ ...snapshot(), openOrders: { data: [{ orderId: 'open' }], fetchedAt: Date.now() } })
    await expect(f.watcher.start(config)).rejects.toThrow('活动委托')
    expect(f.decide).not.toHaveBeenCalled()
  })
  it('accepts three-second sampling and an independent decision interval, rejecting two seconds', async () => {
    const f = await fixture()
    await expect(f.watcher.start({ ...config, intervalSeconds: 2 })).rejects.toThrow('采样及决策间隔')
    await expect(f.watcher.start({ ...config, decisionIntervalSeconds: 2 })).rejects.toThrow('采样及决策间隔')
    await f.watcher.start({ ...config, intervalSeconds: 3, decisionIntervalSeconds: 30 })
    f.decide.mockImplementation(async () => ({ action: 'hold', confidence: 1, probabilities: { hold: 1 }, model: 'jev-1.13.0', time: Date.now() }))
    for (let i = 0; i < 8; i++) { vi.setSystemTime(Date.now() + 3000); await f.watcher.tick(); await f.settle() }
    expect(f.decide).toHaveBeenCalledTimes(1)
    const first = Date.now()
    for (let i = 0; i < 9; i++) { vi.setSystemTime(Date.now() + 3000); await f.watcher.tick(); await f.settle() }
    expect(f.decide).toHaveBeenCalledTimes(1)
    expect((await f.watcher.status()).nextDecisionAt).toBe(first + 30000)
    vi.setSystemTime(Date.now() + 3000); await f.watcher.tick(); await f.settle()
    expect(f.decide).toHaveBeenCalledTimes(2)
    expect((await f.watcher.status()).sampleCount).toBe(18)
  })
  it('keeps sampling during a slow decision, keeps one decision in flight and retains its input window', async () => {
    const f = await fixture(); await f.watcher.start({ ...config, intervalSeconds: 3, decisionIntervalSeconds: 3 }); await f.warm(7)
    let finish!: (value: ContestWatchDecision) => void
    f.decide.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    vi.setSystemTime(Date.now() + 3000); await f.watcher.tick()
    const pending = f.settle()
    for (let i = 0; i < 3; i++) { vi.setSystemTime(Date.now() + 3000); await f.watcher.tick() }
    expect(f.decide).toHaveBeenCalledTimes(1)
    expect(await f.watcher.status()).toMatchObject({ sampleCount: 11, phase: 'deciding', analyses: [{ sampleCount: 8 }] })
    finish({ action: 'hold', confidence: 1, probabilities: { hold: 1 }, model: 'jev-1.13.0', time: Date.now() }); await pending
    const record = (await f.watcher.status()).analyses![0]!
    expect(record.responseAt! - record.startedAt).toBe(9000)
    expect(record.outcome).toContain('未生成交易计划')
    expect(f.execute).not.toHaveBeenCalled()
  })
  it('discards a decision if the independent sampler lost valid data during analysis', async () => {
    const f = await fixture(); await f.watcher.start(config); await f.warm(7)
    let finish!: (value: ContestWatchDecision) => void
    f.decide.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    vi.setSystemTime(Date.now() + 60000); await f.watcher.tick(); const pending = f.settle()
    f.setQuote({ ready: false }); vi.setSystemTime(Date.now() + 3000); await f.watcher.tick()
    finish({ action: 'open_long', confidence: 1, probabilities: { open_long: 1 }, model: 'jev-1.13.0', time: Date.now() }); await pending
    expect(f.prepare).not.toHaveBeenCalled()
    expect((await f.watcher.status()).analyses?.[0]?.outcome).toContain('已丢弃')
    expect((await f.watcher.status()).sampleCount).toBe(0)
  })
  it('prevents configuration changes while a watcher is running', async () => {
    const f = await fixture(); await f.watcher.start(config)
    await expect(f.watcher.configure({ apiKey: 'candidate' })).rejects.toThrow('请先停止盯盘')
  })
  it('does not create a plan for low confidence or an explicit hold', async () => {
    const f = await fixture(); await f.watcher.start(config)
    f.decide.mockImplementation(async () => ({ action: 'hold', confidence: 1, probabilities: { hold: 1 }, model: 'jev-1.13.0', time: Date.now() }))
    await f.warm(); expect(f.prepare).not.toHaveBeenCalled()
    f.decide.mockImplementation(async () => ({ action: 'open_long', confidence: 0.6, probabilities: { open_long: 0.6 }, model: 'jev-1.13.0', time: Date.now() }))
    await f.step(); expect(f.prepare).not.toHaveBeenCalled()
    expect((await f.watcher.status()).analyses!.at(-1)).toMatchObject({ planStatus: 'candidate', outcome: expect.stringContaining('未达到计划门槛 80%') })
  })
  it('clears samples for stale or mismatched quotes and ignores repeated timestamps', async () => {
    const f = await fixture(); await f.watcher.start(config); await f.warm(4)
    f.setQuote({ ready: true, contractCode: 'rb2610', latestPrice: 3000, quoteTime: new Date().toISOString() })
    await f.step(); expect((await f.watcher.status()).sampleCount).toBe(4)
    f.setQuote({ ready: true, contractCode: 'au2612', latestPrice: 3000, quoteTime: new Date().toISOString() })
    await f.step(); expect((await f.watcher.status()).sampleCount).toBe(0)
    expect(f.decide).not.toHaveBeenCalled()
  })
  it('accumulates the actual contest quote format instead of reporting fresh quotes as unavailable', async () => {
    const f = await fixture(); await f.watcher.start(config)
    vi.setSystemTime(new Date('2026-09-18T02:10:51.107Z'))
    f.setQuote({ ready: true, contractCode: 'rb2610', symbol: 'rb2610.SHF', latestPrice: 3043,
      bidPrice1: 3042, askPrice1: 3044, tradeDate: '20260918', time: '101050', quoteTime: '2026-09-18 101050' })
    await f.watcher.tick()
    expect(await f.watcher.status()).toMatchObject({ running: true, sampleCount: 1, message: '采样中：1/8 个有效行情快照。' })
    expect(f.decide).not.toHaveBeenCalled(); expect(f.execute).not.toHaveBeenCalled()
  })
  it('samples complete quote responses without the optional ready flag', async () => {
    const f = await fixture(); await f.watcher.start(config)
    f.setQuote({ contractCode: 'rb2610', latestPrice: 3000, quoteTime: new Date().toISOString() })
    await f.watcher.tick()
    expect(await f.watcher.status()).toMatchObject({ running: true, phase: 'sampling', sampleCount: 1 })
    expect(f.decide).not.toHaveBeenCalled(); expect(f.execute).not.toHaveBeenCalled()
  })
  it('explains unavailable quotes and resumes sampling when valid data returns', async () => {
    const f = await fixture(); await f.watcher.start(config); await f.warm(2)
    f.setQuote({ ready: true, contractCode: 'rb2610', latestPrice: 3000, quoteTime: '2026-09-18 100000' })
    await f.step()
    expect(await f.watcher.status()).toMatchObject({ running: true, phase: 'waiting_quote', sampleCount: 0, lastQuoteCheckedAt: Date.now() })
    expect((await f.watcher.status()).message).toContain('超过 90 秒')
    f.setQuote(undefined); await f.step()
    expect(await f.watcher.status()).toMatchObject({ phase: 'sampling', sampleCount: 1, lastQuoteCheckedAt: Date.now() })
    expect(f.decide).not.toHaveBeenCalled(); expect(f.execute).not.toHaveBeenCalled()
  })
  it('pauses on equity drawdown, account failure and unknown receipts', async () => {
    const f = await fixture(); await f.watcher.start(config)
    f.setSnapshot({ ...snapshot(), account: { data: { equity: 998999 }, fetchedAt: Date.now() } })
    await f.step(); expect((await f.watcher.status()).running).toBe(false)
    expect((await f.watcher.status()).message).toContain('权益回落')
    f.setSnapshot(snapshot()); await f.watcher.start(config)
    f.inspect.mockRejectedValueOnce(new Error('账户不一致'))
    await f.step(); expect((await f.watcher.status()).message).toContain('账户不一致')
    f.setSnapshot(snapshot()); await f.watcher.start(config)
    f.setSnapshot({ ...snapshot(), pendingPlans: [{ status: 'unknown' } as ContestPlan] })
    await f.step(); expect((await f.watcher.status()).message).toContain('待核实回执')
    expect(f.prepare).not.toHaveBeenCalled()
  })
  it('does not revive a stopped watcher when a late Jev response arrives', async () => {
    const f = await fixture(); await f.watcher.start(config); await f.warm(7)
    let finish!: (value: ContestWatchDecision) => void
    f.decide.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const ticking = f.step()
    await vi.waitFor(() => expect(finish).toBeDefined())
    expect((await f.watcher.status()).phase).toBe('deciding')
    await f.watcher.stop()
    finish({ action: 'open_long', confidence: 1, probabilities: { open_long: 1 }, model: 'jev-1.13.0', time: Date.now() })
    await ticking
    expect(f.prepare).not.toHaveBeenCalled(); expect((await f.watcher.status()).running).toBe(false)
  })
  it('invalidates an already prepared plan when stopped', async () => {
    const f = await fixture(); await f.watcher.start(config); await f.warm()
    const runId = (await f.watcher.status()).runId
    await f.watcher.stop(); expect(f.dismiss).toHaveBeenCalledWith('frozen-plan', runId)
    expect(f.execute).not.toHaveBeenCalled()
  })
  it('rechecks positions after Jev returns instead of opening over a changed position', async () => {
    const f = await fixture(); await f.watcher.start(config); await f.warm(7)
    f.decide.mockImplementationOnce(async () => {
      f.setSnapshot({ ...snapshot(), positions: { data: [{ contractCode: 'RB2610.SHF', direction: 'long', volume: 1, closable: 1 }], fetchedAt: Date.now() } })
      return { action: 'open_long', confidence: 1, probabilities: { open_long: 1 }, model: 'jev-1.13.0', time: Date.now() }
    })
    await f.step(); expect(f.prepare).not.toHaveBeenCalled()
  })
  it('stays stopped after Host restart and retains the audit log', async () => {
    const f = await fixture(); await f.watcher.start(config); await f.warm(2); f.watcher.dispose()
    const restarted = new ContestWatcher(f.ctx, f.contest, f.decide); watchers.push(restarted)
    const status = await restarted.status()
    expect(status.running).toBe(false); expect(status.message).toContain('未自动恢复')
    expect(status.events.length).toBeGreaterThan(0)
    await restarted.tick(); expect(f.decide).not.toHaveBeenCalled()
  })
  it('never overlaps polling iterations', async () => {
    const f = await fixture(); await f.watcher.start(config)
    let finish!: (value: ContestInspection) => void
    f.inspect.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const tick = f.step(); await f.watcher.tick()
    finish(snapshot()); await tick
    expect(f.query).toHaveBeenCalledOnce()
  })
  it('rejects a second start and cancels a plan returned after stop', async () => {
    const f = await fixture(); await f.watcher.start(config)
    await expect(f.watcher.start(config)).rejects.toThrow('重复启动')
    await f.warm(7)
    let finish!: (plan: ContestPlan) => void
    f.prepare.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const ticking = f.step()
    await vi.waitFor(() => expect(finish).toBeDefined())
    const runId = (await f.watcher.status()).runId!
    await f.watcher.stop()
    finish({ id: 'late-plan', sessionId: runId } as ContestPlan)
    await ticking
    expect(f.dismiss).toHaveBeenCalledWith('late-plan', runId)
    expect((await f.watcher.status()).running).toBe(false)
    expect(f.execute).not.toHaveBeenCalled()
  })
  it('stops at the configured deadline without a decision or plan', async () => {
    const f = await fixture(); await f.watcher.start({ ...config, durationMinutes: 5 })
    await f.warm(5)
    expect((await f.watcher.status()).running).toBe(false)
    expect(f.decide).not.toHaveBeenCalled(); expect(f.prepare).not.toHaveBeenCalled()
  })
})

describe('Jev decision boundary', () => {
  it.each([
    [{ ready: false }, '尚未就绪'], [{ ready: 'true' }, '就绪标记'],
    [{ latestPrice: 0 }, '有效最新价'], [{ quoteTime: undefined }, '未返回行情时间'],
    [{ quoteTime: '2026-09-18 09:58:00' }, '超过 90 秒'], [{ contractCode: 'rb2611' }, '不符'],
  ])('still rejects invalid quote facts without relying on ready: %s', (change, cause) => {
    const result = watchQuote({ contractCode: 'rb2610', latestPrice: 3000, quoteTime: '2026-09-18 10:00:00', ...change }, 'rb2610')
    expect(result.quote).toBeUndefined(); expect(result.issue).toContain(cause)
  })
  it('recognizes exchange-qualified positions and refuses mismatched or ambiguous contracts', () => {
    const cfg = { ...config, symbol: 'ag2612', instrument: { product: 'ag', exchange: 'SHF' as const, tickSize: 1 } }
    const held = (rows: unknown[]) => ({ ...snapshot(), positions: { data: rows, fetchedAt: Date.now() } })
    const position = { contractCode: 'AG2612.SHF', direction: 'long', position: 1, closable: 1, openPrice: 16299 }
    expect(watchAccount(held([position]), cfg)).toMatchObject({ volume: 1, entryPrice: 16299, allowed: ['hold', 'close_long'] })
    expect(watchAccount(held([{ ...position, direction: 'short' }]), cfg).allowed).toEqual(['hold', 'close_short'])
    expect(watchAccount(held([{ ...position, closable: 0 }]), cfg).allowed).toEqual(['hold'])
    expect(watchAccount(held([{ ...position, contractCode: 'AG2611.SHF' }]), cfg).allowed).toContain('open_long')
    expect(() => watchAccount(held([{ ...position, contractCode: 'AG2612.DCE' }]), cfg)).toThrow('交易所')
    expect(() => watchAccount(held([{ ...position, contractCode: 'AG2612.UNKNOWN' }]), cfg)).toThrow('合约')
    expect(() => watchAccount(held([position, { ...position, contractCode: 'ag2612' }]), cfg)).toThrow('多条持仓')
    expect(watchQuote({ ready: true, contractCode: 'AG2612.SHF', latestPrice: 16299, quoteTime: new Date().toISOString() }, 'ag2612').quote).toBeDefined()
    expect(watchQuote({ ready: true, contractCode: 'AG2612.DCE', latestPrice: 16299, quoteTime: new Date().toISOString() }, 'ag2612', Date.now(), 'SHF').issue).toContain('不符')
  })
  it('handles Shanghai timestamps and refuses absent or oversized positions', () => {
    expect(watchQuote({ ready: true, contractCode: 'rb2610', latestPrice: 3000, quoteTime: '2026-09-18 10:00:00' }, 'rb2610').quote?.time).toBe(Date.now())
    expect(watchQuote({ ready: true, contractCode: 'rb2610', latestPrice: 0, quoteTime: '2026-09-18 10:00:00' }, 'rb2610').issue).toContain('有效最新价')
    expect(() => watchAccount({ ...snapshot(), positions: { data: [{ contractCode: 'rb2610', direction: 'long', volume: 2, closable: 2 }], fetchedAt: Date.now() } }, config)).toThrow('持仓超出')
  })
  it.each([
    ['2026-09-18 100000', 0], ['2026-09-18 100000.123', 123],
    ['2026-09-18 10:00:00', 0], ['2026-09-18T10:00:00+08:00', 0], ['2026-09-18T02:00:00Z', 0],
  ])('interprets %s in the exchange timezone', (quoteTime, offset) => {
    expect(watchQuote({ ready: true, contractCode: 'rb2610', latestPrice: 3000, quoteTime }, 'rb2610').quote?.time).toBe(Date.now() + offset)
  })
  it.each([
    [{ ready: false }, '尚未就绪'], [{ contractCode: 'au2612' }, '合约与 rb2610 不符'],
    [{ quoteTime: undefined }, '未返回行情时间'], [{ quoteTime: '2026-09-18 106000' }, '时间格式'],
    [{ quoteTime: '2026-09-18 100006' }, '超前超过 5 秒'], [{ quoteTime: '2026-09-18 095829' }, '超过 90 秒'],
    [{ latestPrice: Infinity }, '有效最新价'],
  ])('rejects invalid quote facts with a specific cause: %s', (change, cause) => {
    const result = watchQuote({ ready: true, contractCode: 'rb2610', latestPrice: 3000, quoteTime: '2026-09-18 100000', ...change }, 'rb2610')
    expect(result.quote).toBeUndefined(); expect(result.issue).toContain(cause)
  })
  it('validates permitted actions and never leaks upstream failures', async () => {
    const f = await fixture(), account = watchAccount(snapshot(), config), signal = new AbortController().signal
    const request = vi.fn<typeof fetch>(async () => Response.json({ model: 'jev-1.13.0', answers: { ...assessments, action: { type: 'choice', choice: 'hold', confidence: 1, probabilities: { hold: 1, open_long: 0, open_short: 0 } } } }))
    await expect(decideWithJev(f.ctx, config, [], account, signal, request)).resolves.toMatchObject({ action: 'hold' })
    expect(request.mock.calls[0]![1]!.body).not.toContain('test-secret')
    request.mockResolvedValueOnce(Response.json({ model: 'jev-1.13.0', answers: { ...assessments, action: { type: 'choice', choice: 'close_long', confidence: 1, probabilities: { close_long: 1 } } } }))
    await expect(decideWithJev(f.ctx, config, [], account, signal, request)).rejects.toThrow('不允许的动作')
    request.mockResolvedValueOnce(new Response('test-secret', { status: 401 }))
    await expect(decideWithJev(f.ctx, config, [], account, signal, request)).rejects.toThrow('HTTP 401')
  })
})
