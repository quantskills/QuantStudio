import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { ContestService } from '../src/contest-service.ts'
import { FlyService } from '../src/fly-service.ts'
import type { ContestCli } from '../src/contest-cli.ts'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup() })
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'fly-automatic-'))
  const identity = { accountId: 'test', contestId: 'simulation' }
  const instruments = [{ product: 'rb', symbol: 'rb2610', exchange: 'SHF' }, { product: 'cu', symbol: 'cu2611', exchange: 'SHF' }]
  const runtimeState = { binding: { identity }, control: { paused: false, trading: true, execution: 'automatic', run_id: 'run-1', close_only: false, authorization: { version: 'automatic-orders-v1', run_id: 'run-1' } },
    settings: { execution_mode: 'automatic', instruments, target_notional: 0, total_notional: 0, loss_limit: 0 } }
  let serial = 0, receipt = 'submitted', orderRows: JsonValue[] = [], clockOffset = 0
  const data = (data: JsonValue) => ({ data, fetchedAt: Date.now() })
  const run = vi.fn<ContestCli['run']>(async (_runtime, args) => {
    if (args[0] === 'whoami') return data({ loggedIn: true, ...identity, scope: 'futures:read futures:trade' })
    if (args[0] === 'agent') return data({ minimumCliVersion: '0.1.9' })
    if (args[0] === 'doctor') return data({ allOk: true })
    if (args[0] === 'account') return data({ equity: 1000000, availableFunds: 900000 })
    if (args[0] === 'positions' || args[0] === 'trades') return data([])
    if (args[0] === 'orders') return data(orderRows)
    if (args[0] === 'quote') return data({ ready: true, contractCode: args[1]!, latestPrice: 3300, quoteTime: new Date(Date.now() - clockOffset).toISOString() })
    if (args[0] === 'order') { const symbol = args[args.indexOf('--symbol') + 1]!; return data({ wouldSucceed: true, contractCode: symbol, marketQuote: { contractCode: symbol } }) }
    if (args[0] === 'plan' && args[1] === 'create') return data({ planId: `plan-${++serial}`, expiresAt: Date.now() + 60000 })
    if (args[0] === 'plan' && args[1] === 'execute') return data({ operationId: `op-${args[2]}`, status: receipt })
    return data({})
  })
  const contest = new ContestService({ run, install: async () => ({ version: '0.1.23', rules: 'test' }) }, root)
  await contest.setEnabled(true); await contest.connect()
  vi.spyOn(contest, 'contractSpec').mockImplementation(async symbol => data({ symbol, contractMultiplier: 10,
    margin: { longMarginRatioByMoney: .1, shortMarginRatioByMoney: .1, longMarginByVolume: 0, shortMarginByVolume: 0 } }))
  const service = new FlyService({ get: () => undefined } as unknown as Context, contest, root, async () => false)
  vi.spyOn(service.runtime, 'request').mockImplementation(async () => structuredClone(runtimeState))
  cleanups.push(async () => { service.runtime.dispose(); contest.dispose(); await rm(root, { recursive: true, force: true }) })
  const input = (index = 0, id = 'a') => ({ identity, instrument: instruments[index], run_id: 'run-1', limits: { target: 0, total: 0, loss: 0 },
    decision: { decision_id: id.repeat(32), symbol: instruments[index]!.symbol, input_at: Date.now() / 1000,
      choice: { action: 'LONG', readout: 'neural-trade-3', sampling: false, current_position: 0, target_position: 1 } } })
  const call = (body = input()) => (service as unknown as { callback(path: string, body: unknown, signal: AbortSignal): Promise<any> }).callback('trade', body, new AbortController().signal)
  const executions = () => run.mock.calls.filter(([, args]) => args[0] === 'plan' && args[1] === 'execute')
  run.mockClear()
  return { service, contest, run, runtimeState, call, input, executions, setReceipt: (value: string) => receipt = value,
    setOrders: (rows: JsonValue[]) => orderRows = rows, staleQuote: () => clockOffset = 11000 }
}

it('runs the actual contest service dry-run/create/execute chain without a user-confirm route', async () => {
  const f = await fixture()
  const result = await f.call()
  expect(result).toMatchObject({ status: 'submitted', details: { executionMode: 'automatic', parameters: { contractCode: 'rb2610', side: 'buy', offset: 'open', volume: 1 } } })
  expect(f.executions()).toHaveLength(1)
  expect(f.executions()[0]![1]).toEqual(['plan', 'execute', result.id, '--client-request-id', result.clientRequestId, '--yes'])
  expect(f.run.mock.calls.some(([, args]) => args[0] === 'order' && args.includes('--dry-run'))).toBe(true)
})

it('manual mode prepares one idempotent plan and submits only when the user executes it', async () => {
  const f = await fixture()
  f.runtimeState.settings.execution_mode = f.runtimeState.control.execution = 'manual'
  const input = { ...f.input(), execution_mode: 'manual' }
  const plan = await f.call(input)
  expect(plan.status).toBe('prepared')
  expect(plan.details.executionMode).not.toBe('automatic')
  expect(f.executions()).toHaveLength(0)
  expect((await f.call(input)).id).toBe(plan.id)
  expect((await f.contest.status()).plans[0]?.status).toBe('prepared')
  await f.contest.execute(plan.id, plan.sessionId)
  expect(f.executions()).toHaveLength(1)
})

it('manual mode also accepts model targets without silently executing', async () => {
  const f = await modelFixture()
  f.runtimeState.settings.execution_mode = f.runtimeState.control.execution = 'manual'
  expect(await f.call({ ...f.modelInput(), execution_mode: 'manual' })).toMatchObject({ status: 'prepared' })
  expect(f.executions()).toHaveLength(0)
})

it.each(['missing', 'old-run', 'changed-mode'])('rejects automatic orders with %s consent or scope', async kind => {
  const f = await fixture()
  if (kind === 'missing') f.runtimeState.control.authorization.version = ''
  if (kind === 'old-run') f.runtimeState.control.authorization.run_id = 'old-run'
  if (kind === 'changed-mode') f.runtimeState.settings.execution_mode = 'manual'
  await expect(f.call()).rejects.toThrow()
  expect(f.executions()).toHaveLength(0)
})

it('blocks the manual confirmation route from executing an automatic draft', async () => {
  const f = await fixture()
  const plan = await f.contest.prepare({ sessionId: 'auto-test', operation: 'place_order',
    order: { symbol: 'rb2610', direction: 'buy', offset: 'open', volume: 1 } }, f.runtimeState.binding.identity, undefined, 'automatic')
  await expect(f.contest.execute(plan.id, plan.sessionId)).rejects.toThrow('已授权运行')
  expect(f.executions()).toHaveLength(0)
})

it('rechecks execution mode immediately before CLI submission', async () => {
  const f = await fixture(), original = f.contest.prepare.bind(f.contest)
  vi.spyOn(f.contest, 'prepare').mockImplementation(async (...args) => {
    const plan = await original(...args); f.runtimeState.settings.execution_mode = 'manual'; return plan
  })
  await expect(f.call()).rejects.toThrow()
  expect(f.executions()).toHaveLength(0)
  expect((await f.contest.status()).plans[0]?.status).toBe('cancelled')
})

it('serializes different contracts but permits their known orders to coexist', async () => {
  const f = await fixture()
  const [first, second] = await Promise.all([f.call(), f.call(f.input(1, 'b'))])
  expect([first.status, second.status]).toEqual(['submitted', 'submitted'])
  expect(f.executions()).toHaveLength(2)
  await expect(f.call(f.input(0, 'c'))).rejects.toThrow('待确认计划或活动委托')
  expect(f.executions()).toHaveLength(2)
})

it('never resubmits the same decision, including concurrent callbacks', async () => {
  const f = await fixture(), input = f.input()
  const [a, b] = await Promise.all([f.call(input), f.call(input)])
  expect(a.id).toBe(b.id); expect(f.executions()).toHaveLength(1)
})

it('discards an orphan automatic draft before processing a fresh decision', async () => {
  const f = await fixture()
  const old = await f.contest.prepare({ sessionId: `fly:${'c'.repeat(32)}`, operation: 'place_order',
    order: { symbol: 'rb2610', direction: 'buy', offset: 'open', volume: 1 } }, f.runtimeState.binding.identity, undefined, 'automatic')
  expect(await f.call()).toMatchObject({ status: 'submitted' })
  expect((await f.contest.status()).plans.find(plan => plan.id === old.id)?.status).toBe('cancelled')
  expect(f.executions()).toHaveLength(1)
})

it('reserves the total notional budget across outstanding contracts', async () => {
  const f = await fixture()
  f.runtimeState.settings.total_notional = 50000
  const first = f.input(), second = f.input(1, 'b')
  first.limits.total = second.limits.total = 50000
  expect(await f.call(first)).toMatchObject({ status: 'submitted' })
  await expect(f.call(second)).rejects.toThrow('超过总名义占用额度')
  expect(f.executions()).toHaveLength(1)
})

it('does not permanently block a contract after a terminal partial IOC receipt', async () => {
  const f = await fixture()
  f.setReceipt('partial')
  expect(await f.call()).toMatchObject({ status: 'partial' })
  f.setReceipt('submitted')
  expect(await f.call(f.input(0, 'b'))).toMatchObject({ status: 'submitted' })
  expect(f.executions()).toHaveLength(2)
})

it('keeps an uncertain CLI outcome for reconciliation rather than another submission', async () => {
  const f = await fixture(), base = f.run.getMockImplementation()!
  f.run.mockImplementation((runtime, args, signal) => args[0] === 'plan' && args[1] === 'execute'
    ? Promise.reject(new Error('lost response')) : base(runtime, args, signal))
  const input = f.input()
  expect(await f.call(input)).toMatchObject({ status: 'unknown' })
  expect(await f.call(input)).toMatchObject({ status: 'unknown' })
  await expect(f.call(f.input(1, 'b'))).rejects.toThrow('待确认计划或活动委托')
  expect(f.executions()).toHaveLength(1)
})

it('cancels an unsubmitted draft when paused during preparation', async () => {
  const f = await fixture(), original = f.contest.prepare.bind(f.contest)
  vi.spyOn(f.contest, 'prepare').mockImplementation(async (...args) => {
    const plan = await original(...args); f.runtimeState.control.trading = false; return plan
  })
  await expect(f.call()).rejects.toThrow('自动交易已暂停')
  expect(f.executions()).toHaveLength(0)
  expect((await f.contest.status()).plans[0]?.status).toBe('cancelled')
})

it.each(['legacy', 'paused', 'run', 'contract', 'limits', 'closeOnly', 'quote'])('rejects a changed or inactive %s before submitting', async kind => {
  const f = await fixture(), input = f.input()
  if (kind === 'legacy') f.runtimeState.control.execution = 'manual'
  if (kind === 'paused') f.runtimeState.control.trading = false
  if (kind === 'run') f.runtimeState.control.run_id = 'new-run'
  if (kind === 'contract') f.runtimeState.settings.instruments = []
  if (kind === 'limits') f.runtimeState.settings.loss_limit = 100
  if (kind === 'closeOnly') f.runtimeState.control.close_only = true
  if (kind === 'quote') f.staleQuote()
  await expect(f.call(input)).rejects.toThrow()
  expect(f.executions()).toHaveLength(0)
})

async function modelFixture() {
  const f = await fixture()
  const config = { decision_engine: 'llm', trade_model: JSON.stringify({ provider: 'test', model: 'mock' }), trade_instructions: '顺势，最多一手', llm_max_lots: 1 }
  Object.assign(f.runtimeState.settings, config)
  const input = (index = 0, id = 'a') => {
    const source = f.input(index, id)
    return { ...source, decision: { ...source.decision, engine: 'llm', run_id: 'run-1', engine_config: { ...config },
      input_at: Date.now() / 1000 - 30, choice: { ...source.decision.choice, readout: 'llm-trade-1' } } }
  }
  return { ...f, modelInput: input }
}

it('executes validated model targets through the same idempotent CLI chain for multiple contracts', async () => {
  const f = await modelFixture(), a = f.modelInput(), b = f.modelInput(1, 'b')
  expect(await f.call(a)).toMatchObject({ status: 'submitted', details: { parameters: { volume: 1 } } })
  expect(await f.call(b)).toMatchObject({ status: 'submitted' })
  await f.call(a)
  expect(f.executions()).toHaveLength(2)
})

it.each(['engine', 'instructions', 'model', 'lots', 'expired', 'run', 'readout', 'quote'])('blocks a model decision with changed %s', async kind => {
  const f = await modelFixture(), input = f.modelInput()
  if (kind === 'engine') Object.assign(f.runtimeState.settings, { decision_engine: 'neural' })
  if (kind === 'instructions') input.decision.engine_config.trade_instructions = '旧要求'
  if (kind === 'model') input.decision.engine_config.trade_model = 'old'
  if (kind === 'lots') input.decision.choice.target_position = 2
  if (kind === 'expired') input.decision.input_at -= 61
  if (kind === 'run') input.decision.run_id = 'previous'
  if (kind === 'readout') input.decision.choice.readout = 'neural-trade-3'
  if (kind === 'quote') f.staleQuote()
  await expect(f.call(input)).rejects.toThrow()
  expect(f.executions()).toHaveLength(0)
})

it('rechecks model instructions after preparing an order, before the CLI execute', async () => {
  const f = await modelFixture(), original = f.contest.prepare.bind(f.contest)
  vi.spyOn(f.contest, 'prepare').mockImplementation(async (...args) => {
    const plan = await original(...args)
    Object.assign(f.runtimeState.settings, { trade_instructions: '已修改' })
    return plan
  })
  await expect(f.call(f.modelInput())).rejects.toThrow('模型或交易要求已变化')
  expect(f.executions()).toHaveLength(0)
})
