import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { ContestService } from '../src/contest-service.ts'
import { FlyService, flyInstrumentSchema, flyQuoteTime } from '../src/fly-service.ts'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'

const active: { root: string; service: FlyService }[] = []
afterEach(async () => { vi.unstubAllGlobals(); for (const item of active.splice(0)) { item.service.runtime.dispose(); await rm(item.root, { recursive: true, force: true }) } })
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'fly-test-'))
  const identity = { accountId: 'account-a', contestId: 'futures' }
  const state = { enabled: true, phase: 'connected', identity, plans: [] as unknown[] }
  const snapshot = { identity, fetchedAt: Date.now(), account: { data: { equity: 1000000, availableFunds: 100000 } }, positions: { data: [] as unknown[] }, openOrders: { data: [] as unknown[] }, pendingPlans: [] as unknown[] }
  const quote = { ready: true, contractCode: 'rb2610', latestPrice: 3300, quoteTime: new Date().toISOString() }
  const spec = { symbol: 'rb2610', contractMultiplier: 10, margin: { longMarginRatioByMoney: 0.1, shortMarginRatioByMoney: 0.1, longMarginByVolume: 0, shortMarginByVolume: 0 } }
  const prepare = vi.fn(async (input: unknown) => ({ id: 'plan-1', input, status: 'prepared' }))
  const execute = vi.fn()
  const mock = { status: async () => state, researchIdentity: vi.fn(async () => identity), inspect: async () => snapshot, observe: vi.fn(async () => snapshot),
    resume: vi.fn(async () => { state.phase = 'connected' }),
    query: vi.fn(async (request: { kind: string }) => ({ data: request.kind === 'quote' ? quote : [] })),
    contractSpec: async () => ({ data: spec }), prepare, execute,
    reconcile: vi.fn(async () => ({})) }
  const watcher = vi.fn(async () => false)
  const ctx = { get: vi.fn<(...args: unknown[]) => unknown>(() => undefined) }
  const service = new FlyService(ctx as unknown as Context, mock as unknown as ContestService, root, watcher)
  active.push({ root, service })
  const call = (path: string, body: unknown) => (service as unknown as { callback(path: string, input: unknown, signal: AbortSignal): Promise<JsonValue> }).callback(path, body, new AbortController().signal)
  const input = { identity, instrument: { product: 'rb', symbol: 'rb2610', exchange: 'SHF' },
    limits: { target: 40000, total: 100000, loss: 1000 },
    decision: { decision_id: 'a'.repeat(32), input_at: Date.now() / 1000, symbol: 'rb2610', choice: { action: 'LONG', readout: 'neural-trade-3', sampling: false, current_position: 0, target_position: 1 } } }
  return { service, mock, snapshot, state, quote, prepare, execute, watcher, call, input, ctx, spec }
}

describe('fly contest bridge', () => {
  it('revalidates a persisted binding after restart before reading market data', async () => {
    const f = await fixture(); f.state.phase = 'disconnected'
    await f.call('market', { identity: f.input.identity, instruments: [f.input.instrument] })
    expect(f.mock.resume).toHaveBeenCalledExactlyOnceWith(f.input.identity)
    expect(f.mock.observe).toHaveBeenCalledOnce()
    expect(f.execute).not.toHaveBeenCalled()
  })
  it('shares background account snapshots without running full identity diagnostics per quote', async () => {
    const f = await fixture()
    for (let i = 0; i < 3; i++) await f.call('market', { identity: f.input.identity, instruments: [f.input.instrument] })
    expect(f.mock.observe).toHaveBeenCalledTimes(1)
    expect(f.mock.researchIdentity).not.toHaveBeenCalled()
    expect(f.mock.query.mock.calls.filter(([request]) => request.kind === 'trades')).toHaveLength(1)
    expect(f.mock.query.mock.calls.filter(([request]) => request.kind === 'quote')).toHaveLength(3)
  })
  it('fetches a narrow history range from a persisted cursor without competition diagnostics', async () => {
    const f = await fixture(), since = new Date(Date.now() - 600_000).toISOString()
    const dataset = { id: 'history' }
    const gateway = { databaseList: vi.fn(async () => []), databaseFetch: vi.fn(async () => dataset),
      databaseQuery: vi.fn(async () => ({ status: 'hit', rows: [], total: 0, dataset: { fetchedAt: new Date().toISOString() } })) }
    f.ctx.get.mockReturnValue(gateway)
    await f.call('history', { identity: f.input.identity, instrument: f.input.instrument, minutes: 5, since })
    const source = gateway.databaseFetch.mock.calls[0] as unknown as [{ source: { params: { start_date: string; frequency: string } }; ttlSeconds: number }]
    expect(source[0].source.params.start_date).toBe(new Date(Date.parse(since) + 8 * 3600000).toISOString().slice(0, 10).replaceAll('-', ''))
    expect(source[0].source.params.frequency).toBe('5m')
    expect(source[0].ttlSeconds).toBe(300)
    expect(f.mock.researchIdentity).not.toHaveBeenCalled()
  })
  it('distinguishes history rate limits from competition connection failures', async () => {
    const f = await fixture()
    f.state.enabled = false
    await expect(f.call('history', { identity: f.input.identity, instrument: f.input.instrument, minutes: 1 })).rejects.toMatchObject({ source: 'competition' })
    f.state.enabled = true
    f.ctx.get.mockReturnValue({ databaseList: async () => [], databaseFetch: async () => { throw Object.assign(new Error('HTTP 429'), { retryAfterSeconds: 120 }) } })
    await expect(f.call('history', { identity: f.input.identity, instrument: f.input.instrument, minutes: 1 })).rejects.toMatchObject({ source: 'pandadata', code: 'RATE_LIMIT', retryAfterSeconds: 120 })
  })
  it('lists and calls the user-connected verified QuantStudio model through the existing provider', async () => {
    const f = await fixture(), route = { provider: 'my-provider', model: 'my-model' }
    const stream = vi.fn(async function* () { yield { type: 'text-delta', text: 'ready' } })
    Object.assign(f.ctx, { llm: { stream } })
    f.ctx.get.mockImplementation(key => key === 'settings' ? { get: () => ({ connections: {
      'my-provider': { state: 'verified', verifiedModels: ['my-model'] },
      'pending-provider': { state: 'saved', verifiedModels: ['pending-model'] },
    } }) } : key === 'credentials' ? { describe: async () => ({ configured: true }) } : undefined)
    expect(await f.call('models', {})).toMatchObject({ profiles: [{ provider_id: JSON.stringify(route), label: 'my-provider / my-model' }], jev_configured: true })
    expect(await f.call('language', { route: JSON.stringify(route), system: 'Test', payload: {} })).toEqual({ text: 'ready' })
    expect(stream).toHaveBeenCalledWith(expect.objectContaining(route))
    await expect(f.call('language', { route: JSON.stringify({ provider: 'pending-provider', model: 'pending-model' }) })).rejects.toThrow('模型调用失败')
    expect(stream).toHaveBeenCalledTimes(1)
  })

  it('directs missing Jev credentials to the unified settings page', async () => {
    const f = await fixture()
    await expect(f.call('jev', { choices: { quiet: 'rest' } })).rejects.toThrow('设置 → 模型服务 → Jev')
  })

  it('creates an account-bound market IOC plan without executing it', async () => {
    const f = await fixture()
    expect(await f.call('prepare', f.input)).toMatchObject({ id: 'plan-1', status: 'prepared' })
    expect(f.prepare).toHaveBeenCalledWith(expect.objectContaining({ sessionId: `fly:${'a'.repeat(32)}`,
      order: { symbol: 'rb2610', direction: 'buy', offset: 'open', volume: 1 } }), f.input.identity, expect.any(AbortSignal))
    expect(f.execute).not.toHaveBeenCalled()
  })
  it('reads dynamic equity from the actual competition totalProfit field', async () => {
    const f = await fixture()
    Object.assign(f.snapshot.account.data, { equity: undefined, totalProfit: 1000000 })
    expect(await f.call('market', { identity: f.input.identity, instruments: [f.input.instrument] })).toMatchObject({
      account: { official: { Balance: 1000000 }, official_sync: { stale: false } },
      feeds: { rb: { sizing: { long_capacity: 27 } } }
    })
    await f.call('prepare', f.input)
    expect(f.prepare).toHaveBeenCalledOnce()
  })
  it('derives side-specific capacity from reference margin and available funds', async () => {
    const f = await fixture()
    f.spec.margin.shortMarginRatioByMoney = 0.2
    const result = await f.call('market', { identity: f.input.identity, instruments: [f.input.instrument] })
    expect(result).toMatchObject({ feeds: { rb: { sizing: { long_capacity: 27, short_capacity: 13 }, occupied_notional: 0 } } })
  })
  it('retains both optional notional limits for additions', async () => {
    const f = await fixture()
    Object.assign(f.input.decision.choice, { current_position: 1, target_position: 2 })
    f.snapshot.positions.data.push({ contractCode: 'rb2610', direction: 'long', volume: 1, closable: 1, openMarketValue: 33000 })
    await expect(f.call('prepare', f.input)).rejects.toThrow('每品种名义上限')
    f.input.limits.target = 0; f.input.limits.total = 40000
    await expect(f.call('prepare', f.input)).rejects.toThrow('总名义占用')
    expect(f.prepare).not.toHaveBeenCalled()
  })
  it('has no bridge route for order execution', async () => {
    const f = await fixture()
    await expect(f.call('execute', { planId: 'plan-1' })).rejects.toThrow('不支持')
    expect(f.execute).not.toHaveBeenCalled()
  })
  it('refuses a changed account before reading quotes or creating plans', async () => {
    const f = await fixture(); f.state.identity = { ...f.state.identity, accountId: 'other' }
    await expect(f.call('prepare', f.input)).rejects.toThrow('账户已变化')
    expect(f.mock.query).not.toHaveBeenCalled(); expect(f.prepare).not.toHaveBeenCalled()
  })
  it.each(['plan', 'order'])('refuses an outstanding %s', async kind => {
    const f = await fixture()
    if (kind === 'plan') f.snapshot.pendingPlans.push({ id: 'existing' })
    else f.snapshot.openOrders.data.push({ orderId: 'existing' })
    await expect(f.call('prepare', f.input)).rejects.toThrow('待确认计划或活动委托')
    expect(f.prepare).not.toHaveBeenCalled()
  })
  it('rejects stale quotes and signals rather than refreshing timestamps', async () => {
    const f = await fixture(); f.quote.quoteTime = new Date(Date.now() - 11000).toISOString()
    await expect(f.call('prepare', f.input)).rejects.toThrow('新鲜报价')
    f.input.decision.input_at -= 20
    await expect(f.call('prepare', f.input)).rejects.toThrow('交易信号已过期')
    expect(f.prepare).not.toHaveBeenCalled()
  })
  it.each([[2, 5, 'buy', 'open', 3], [5, 2, 'sell', 'close', 3], [2, -3, 'sell', 'close', 2], [-2, -4, 'sell', 'open', 2], [-4, -1, 'buy', 'close', 3]])('adjusts %s to %s with only the required delta', async (current, target, direction, offset, volume) => {
    const f = await fixture(); f.input.limits = { target: 0, total: 0, loss: 0 }
    f.snapshot.positions.data.push({ contractCode: 'rb2610', direction: current > 0 ? 'long' : 'short', volume: Math.abs(current), closable: Math.abs(current) })
    Object.assign(f.input.decision.choice, { current_position: current, target_position: target, action: target > 0 ? 'LONG' : 'SHORT' })
    await f.call('prepare', f.input)
    expect(f.prepare).toHaveBeenCalledWith(expect.objectContaining({ order: { symbol: 'rb2610', direction, offset, volume } }), f.input.identity, expect.any(AbortSignal))
    expect(f.execute).not.toHaveBeenCalled()
  })
  it('rejects a position changed since the decision', async () => {
    const f = await fixture(); f.snapshot.positions.data.push({ contractCode: 'rb2610', direction: 'long', volume: 1, closable: 1 })
    await expect(f.call('prepare', f.input)).rejects.toThrow('持仓已变化')
    expect(f.prepare).not.toHaveBeenCalled()
  })
  it('accepts zero optional limits but rechecks funds and margin before opening', async () => {
    const f = await fixture(); f.input.limits = { target: 0, total: 0, loss: 0 }
    await f.call('prepare', f.input)
    f.snapshot.account.data.availableFunds = 1
    await expect(f.call('prepare', f.input)).rejects.toThrow('可用资金')
    expect(f.prepare).toHaveBeenCalledTimes(1)
  })
  it('withholds opening with missing margin but permits a reduction', async () => {
    const f = await fixture(); (f.spec.margin as any).longMarginRatioByMoney = null
    await expect(f.call('prepare', f.input)).rejects.toThrow('保证金')
    f.snapshot.positions.data.push({ contractCode: 'rb2610', direction: 'long', volume: 2, closable: 2 })
    Object.assign(f.input.decision.choice, { current_position: 2, target_position: 1 })
    await f.call('prepare', f.input)
    expect(f.prepare).toHaveBeenCalledTimes(1)
  })
  it('blocks reductions beyond closable inventory', async () => {
    const f = await fixture(); f.snapshot.positions.data.push({ contractCode: 'rb2610', direction: 'long', volume: 3, closable: 1 })
    Object.assign(f.input.decision.choice, { current_position: 3, target_position: 0, action: 'CLOSE' })
    await expect(f.call('prepare', f.input)).rejects.toThrow('可平手数')
    expect(f.prepare).not.toHaveBeenCalled()
  })
  it('blocks concurrent Jev strategy ownership', async () => {
    const f = await fixture(); f.watcher.mockResolvedValue(true)
    await expect(f.call('prepare', f.input)).rejects.toThrow('Jev 盯盘')
    await expect(f.service.request({ path: 'control', body: { action: 'trade' } })).rejects.toThrow('先停止')
    expect(f.prepare).not.toHaveBeenCalled()
  })
  it('preserves the equity peak and blocks opening beyond the loss limit', async () => {
    const f = await fixture(); await f.call('prepare', f.input)
    f.snapshot.account.data.equity -= 1500
    await expect(f.call('prepare', f.input)).rejects.toThrow('权益回落')
    expect(f.prepare).toHaveBeenCalledTimes(1)
  })
  it('does not infer missing position notional or permit zero-lot plans', async () => {
    const f = await fixture(); f.input.limits.target = 100
    await expect(f.call('prepare', f.input)).rejects.toThrow('每品种名义上限')
    f.input.limits.target = 40000
    f.snapshot.positions.data.push({ contractCode: 'au2612', direction: 'long', volume: 1 })
    await expect(f.call('prepare', f.input)).rejects.toThrow('名义占用不完整')
  })
  it('validates actual contracts and complete Beijing quote timestamps', () => {
    expect(flyInstrumentSchema.safeParse({ product: 'au', symbol: 'rb2610', exchange: 'SHF' }).success).toBe(false)
    expect(flyInstrumentSchema.safeParse({ product: 'rb', symbol: 'rb2610', exchange: 'CFE' }).success).toBe(false)
    expect(flyQuoteTime('2026-09-23 101050')).toBe(Date.parse('2026-09-23T10:10:50+08:00'))
    expect(Number.isNaN(flyQuoteTime('10:10:50'))).toBe(true)
  })
  it('records fresh equity while withholding rewards when fee and cashflow evidence is absent', async () => {
    const f = await fixture()
    expect(await f.call('market', { identity: f.input.identity, instruments: [f.input.instrument] })).toMatchObject({
      account: { trading_account_id: 'account-a', official: { Balance: 1000000, Commission: null, Deposit: null },
        official_sync: { stale: false }, reward_evidence_complete: false, day_source: 'observation' } })
    f.snapshot.account.data.equity -= 1500
    await expect(f.call('prepare', f.input)).rejects.toThrow('权益回落')
    expect(f.execute).not.toHaveBeenCalled()
  })
  it('recovers only owned receipts in the background without repeating submission', async () => {
    const f = await fixture()
    f.state.plans.push({ id: 'mine', sessionId: 'fly:abc', identity: f.input.identity, status: 'unknown' },
      { id: 'other', sessionId: 'normal-chat', identity: f.input.identity, status: 'unknown' })
    const input = { identity: f.input.identity, instruments: [f.input.instrument] }
    await f.call('market', input); await f.call('market', input)
    expect(f.mock.reconcile).toHaveBeenCalledTimes(1)
    expect(f.mock.reconcile).toHaveBeenCalledWith('mine', 'fly:abc')
    expect(f.execute).not.toHaveBeenCalled()
  })
  it('blocks checkpoint restoration while the bound account still has exposure', async () => {
    const f = await fixture()
    vi.spyOn(f.service.runtime, 'request').mockResolvedValue({ binding: { identity: f.input.identity } })
    f.snapshot.positions.data.push({ contractCode: 'rb2610', volume: 1 })
    await expect(f.service.request({ path: 'control', body: { action: 'restore', version: 'abc' } })).rejects.toThrow('先处理当前持仓')
    expect(f.service.runtime.request).toHaveBeenCalledExactlyOnceWith({ path: 'state' })
  })
  it('uses the configured Jev credential without sending an empty target question', async () => {
    const f = await fixture()
    f.ctx.get.mockImplementation(key => key === 'credentials' ? { resolve: async () => ({ value: 'test-only-key' }) } : undefined)
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ answers: { event: { choice: 'quiet' } } }) }))
    vi.stubGlobal('fetch', fetch)
    expect(await f.call('jev', { state: { goal: 'rest' }, choices: { quiet: '安静' }, targets: {} })).toMatchObject({ event: 'quiet', target: null })
    const sent = JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(sent.model).toBe('jev-1.13.0')
    expect(sent.questions.target).toBeUndefined()
    expect(f.execute).not.toHaveBeenCalled()
  })
})


it.each([
  ['cu','cu2612','SHF'], ['ma','MA701','CZC'], ['TL','TL2612','CFE'],
  ['lc','lc2611','GFE'], ['ec','ec2612','INE'], ['l_f','l2610F','DCE'], ['xyz','xyz2701','GFE'],
])('routes %s actual contracts through both quote and PandaData history', async (product,symbol,exchange) => {
  const f = await fixture()
  Object.assign(f.quote,{contractCode:symbol}); Object.assign(f.spec,{symbol})
  const instrument = {product,symbol,exchange}
  const result = await f.call('market',{identity:f.input.identity,instruments:[instrument]}) as any
  expect(result.feeds[product].symbol).toBe(symbol)
  expect(f.mock.query).toHaveBeenCalledWith({kind:'quote',symbol},f.input.identity,expect.any(AbortSignal))
  const fetch = vi.fn(async () => ({id:'history'}))
  f.ctx.get.mockReturnValue({databaseList:async () => [],databaseFetch:fetch,databaseQuery:async () => ({status:'hit',rows:[],total:0,dataset:{fetchedAt:new Date().toISOString()}})})
  await f.call('history',{identity:f.input.identity,instrument,minutes:1})
  expect(fetch).toHaveBeenCalledWith(expect.objectContaining({source:expect.objectContaining({params:expect.objectContaining({symbol:symbol.toUpperCase()+'.'+exchange})})}),expect.anything())
  expect(f.execute).not.toHaveBeenCalled()
})
