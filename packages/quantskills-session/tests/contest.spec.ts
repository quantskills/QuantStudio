import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContestService, contestQueryArgs } from '../src/contest-service.ts'
import { ContestCliError, parseCliOutput, type ContestCli } from '../src/contest-cli.ts'
import type { ContestData } from '../src/contest-types.ts'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'

const roots: string[] = []
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })
const identity = { accountId: 'acct-1', contestId: 'contest-1' }
const order = { symbol: 'rb2610', direction: 'buy' as const, offset: 'open' as const, volume: 1 }
const data = (value: JsonValue): ContestData => ({ data: value, fetchedAt: Date.now() })
async function fixture() {
  const home = await mkdtemp(join(tmpdir(), 'quantstudio-contest-')); roots.push(home)
  let current = identity, serial = 0
  const run = vi.fn<ContestCli['run']>(async (_runtime, args) => {
    if (args[0] === 'whoami') return data({ loggedIn: true, ...current, scope: 'futures:read futures:trade' })
    if (args[0] === 'agent') return data({ minimumCliVersion: '0.1.9' })
    if (args[0] === 'account') return data({ equity: 1000000 })
    if (args[0] === 'doctor') return data({ allOk: true })
    if (args[0] === 'positions') return data([{ contractCode: 'rb2610', direction: 'long', volume: 1, closable: 1 }])
    if (args[0] === 'orders') return data([])
    if (args[0] === 'order') return data({ wouldSucceed: true, contractCode: 'rb2610', marketQuote: { ready: true, contractCode: 'rb2610', latestPrice: 3250, quoteTime: '2026-09-15 10:00:00' } })
    if (args[0] === 'plan' && args[1] === 'create') return data({ planId: `plan-${++serial}`, expiresAt: Date.now() + 60_000 })
    if (args[0] === 'plan' && args[1] === 'execute') return data({ operationId: 'op-1', status: 'queued' })
    if (args[0] === 'plan' && args[1] === 'show') return data({ operationId: 'op-1', status: 'executing' })
    if (args[0] === 'operation') return data({ operationId: 'op-1', status: 'completed' })
    if (args[0] === 'update') return data({ latestVersion: '0.1.20' })
    return data({})
  })
  const cli: ContestCli = { run, install: vi.fn(async () => ({ version: '0.1.19', rules: 'name: panda-trading' })) }
  const service = new ContestService(cli, home)
  const connect = async () => { await service.setEnabled(true); await service.connect(); run.mockClear() }
  return { service, cli, run, connect, home, switchAccount: () => { current = { accountId: 'acct-2', contestId: 'contest-1' } } }
}

describe('contest is opt-in and independent of ordinary sessions', () => {
  it.each([
    [{ contractCode: 'rb2611', direction: 'long', closable: 1 }],
    [{ contractCode: 'RB2610.SHF', direction: 'short', closable: 1 }],
    [{ contractCode: 'RB2610.SHF', direction: 'long', closable: 0 }],
    [{ contractCode: 'RB2610.SHF', direction: 'long', closable: 1 }, { contractCode: 'rb2610.DCE', direction: 'long', closable: 1 }],
  ])('rejects unmatched, unavailable or ambiguous closing positions: %j', async (...positions) => {
    const f = await fixture(); await f.connect()
    const base = f.run.getMockImplementation()!
    f.run.mockImplementation((runtime, args, signal) => args[0] === 'positions' ? Promise.resolve(data(positions)) : base(runtime, args, signal))
    await expect(f.service.prepare({ operation: 'place_order', sessionId: 's1', order: { ...order, symbol: 'RB2610', offset: 'close', direction: 'sell' } }, identity)).rejects.toThrow(/可平手数不足|多条同方向持仓/)
    expect(f.run.mock.calls.some(([, args]) => ['order', 'plan'].includes(args[0]!))).toBe(false)
  })
  it.each(['rb2611', 'RB2610.DCE'])('rejects a closing preview for a different contract or exchange: %s', async quoteContract => {
    const f = await fixture(); await f.connect()
    const base = f.run.getMockImplementation()!
    f.run.mockImplementation((runtime, args, signal) => args[0] === 'positions'
      ? Promise.resolve(data([{ contractCode: 'RB2610.SHF', direction: 'long', closable: 1 }]))
      : args[0] === 'order' ? Promise.resolve(data({ wouldSucceed: true, contractCode: 'rb2610', marketQuote: { contractCode: quoteContract } }))
        : base(runtime, args, signal))
    await expect(f.service.prepare({ operation: 'place_order', sessionId: 's1', order: { ...order, offset: 'close', direction: 'sell' } }, identity)).rejects.toThrow('合约或交易所与请求不符')
    expect(f.run.mock.calls.some(([, args]) => args[0] === 'plan')).toBe(false)
  })
  it('preserves transient doctor failures and permits a later fresh inspection', async () => {
    const f = await fixture(); await f.connect()
    const base = f.run.getMockImplementation()!
    f.run.mockImplementation((runtime, args, signal) => args[0] === 'doctor'
      ? Promise.resolve(data({ allOk: false, checks: [{ name: '交易通道', ok: false, detail: 'rate_limit_exceeded: upstream secret' }] })) : base(runtime, args, signal))
    await expect(f.service.inspect(identity)).rejects.toMatchObject({ code: 'rate_limit_exceeded' })
    f.run.mockImplementation(base)
    await expect(f.service.inspect(identity)).resolves.toMatchObject({ identity })
  })
  it('does not retry a revoked mandate even when another check is rate limited', async () => {
    const f = await fixture(); await f.connect()
    const base = f.run.getMockImplementation()!
    f.run.mockImplementation((runtime, args, signal) => args[0] === 'doctor'
      ? Promise.resolve(data({ allOk: false, checks: [{ name: '交易通道', ok: false, detail: 'rate_limit_exceeded: secret' }, { name: '交易授权', ok: false, detail: '已到期' }] })) : base(runtime, args, signal))
    await expect(f.service.inspect(identity)).rejects.toThrow('交易授权')
    await expect(f.service.query({ kind: 'account' })).rejects.toThrow('连接并验证')
  })
  it('cancels an obsolete data read so a foreground connection can leave the queue', async () => {
    const f = await fixture(); await f.connect()
    const base = f.run.getMockImplementation()!, controller = new AbortController()
    let reading = false
    f.run.mockImplementation((runtime, args, signal) => args[0] === 'account' ? new Promise((_resolve, reject) => {
      reading = true; signal!.addEventListener('abort', () => reject(signal!.reason), { once: true })
    }) : base(runtime, args, signal))
    const query = f.service.query({ kind: 'account' }, undefined, controller.signal).catch(error => error)
    await vi.waitFor(() => expect(reading).toBe(true))
    const connecting = f.service.connect()
    controller.abort()
    expect(await query).toBeInstanceOf(Error)
    await expect(connecting).resolves.toMatchObject({ phase: 'connected' })
    await expect(f.service.query({ kind: 'positions' }, undefined, controller.signal)).rejects.toThrow()
    expect(f.run.mock.calls.some(([, args]) => args[0] === 'positions')).toBe(false)
  })
  it('does not queue foreground connection behind a slow background update check', async () => {
    const f = await fixture(); await f.connect()
    const base = f.run.getMockImplementation()!
    let finish!: (value: ContestData) => void
    f.run.mockImplementation((runtime, args, signal) => args[0] === 'update' ? new Promise(resolve => { finish = resolve }) : base(runtime, args, signal))
    const checking = f.service.checkUpdate()
    await vi.waitFor(() => expect(finish).toBeDefined())
    let connected = false
    const connecting = f.service.connect().then(() => { connected = true })
    try { await vi.waitFor(() => expect(connected).toBe(true), { timeout: 500 }) }
    finally { finish(data({ latestVersion: '0.1.20' })); await checking; await connecting }
  })
  it('inspects only the bound account with read-only commands and drops context on disable or account change', async () => {
    const f = await fixture(); await f.connect()
    const snapshot = await f.service.inspect(identity)
    expect(snapshot).toMatchObject({ identity, account: { data: { equity: 1000000 } }, positions: { data: [{ contractCode: 'rb2610' }] }, openOrders: { data: [] }, pendingPlans: [] })
    expect(f.run.mock.calls.every(([, args]) => ['whoami', 'agent', 'doctor', 'account', 'positions', 'orders'].includes(args[0]!))).toBe(true)
    expect(f.service.inspection({ ...identity, accountId: 'other' })).toBeUndefined()
    f.switchAccount()
    await expect(f.service.inspect(identity)).rejects.toThrow('不一致')
    await f.service.connect()
    expect(f.service.inspection(identity)).toBeUndefined()
    await f.service.setEnabled(false)
    expect(f.service.inspection(identity)).toBeUndefined()
    await expect(f.service.inspect(identity)).rejects.toThrow('比赛模式已关闭')
  })
  it('does not install, authenticate, or call the CLI on construction/status/off queries', async () => {
    const f = await fixture()
    expect(await f.service.status()).toMatchObject({ enabled: false, phase: 'off', plans: [] })
    await expect(f.service.query({ kind: 'account' })).rejects.toThrow('比赛模式已关闭')
    await expect(f.service.connect()).rejects.toThrow('比赛模式已关闭')
    expect(f.cli.install).not.toHaveBeenCalled(); expect(f.run).not.toHaveBeenCalled()
    await f.service.setEnabled(true)
    expect(f.cli.install).not.toHaveBeenCalled(); expect(f.run).not.toHaveBeenCalled()
  })
  it('cancels old plans when turned off, including after enabling again', async () => {
    const f = await fixture(); await f.connect()
    const plan = await f.service.prepare({ operation: 'place_order', sessionId: 's1', order }, identity)
    await f.service.setEnabled(false)
    await expect(f.service.execute(plan.id, 's1')).rejects.toThrow('比赛模式已关闭')
    await f.service.setEnabled(true); await f.service.connect()
    expect((await f.service.execute(plan.id, 's1')).status).toBe('cancelled')
    expect(f.run.mock.calls.filter(([, args]) => args[0] === 'plan' && args[1] === 'execute')).toHaveLength(0)
  })
  it('persists mode and plans, but requires a fresh connection after restart', async () => {
    const f = await fixture(); await f.connect()
    const plan = await f.service.prepare({ operation: 'place_order', sessionId: 's1', order }, identity)
    const restored = new ContestService(f.cli, f.home)
    expect((await restored.status()).plans[0]?.id).toBe(plan.id)
    await expect(restored.query({ kind: 'account' })).rejects.toThrow('连接并验证')
    expect(await readFile(join(f.home, 'quantskills/contest/state.json'), 'utf8')).not.toContain('accessToken')
  })
  it('reopens official authorization when a saved login has expired', async () => {
    const f = await fixture(); await f.connect()
    f.run.mockRejectedValueOnce(new ContestCliError('login_required', 'Expired'))
    await f.service.connect()
    expect(f.run.mock.calls.some(([, args]) => args[0] === 'login')).toBe(true)
    expect((await f.service.status()).phase).toBe('connected')
  })
})

describe('frozen plan execution', () => {
  it('records matched actual fills after reconciliation and preserves them after restart', async () => {
    const f = await fixture(); await f.connect()
    const p = await f.service.prepare({ operation: 'place_order', sessionId: 's1', order: { ...order, volume: 3 } }, identity)
    const base = f.run.getMockImplementation()!
    const fills = [1, 2].map((volume, i) => ({ id: `fill-${i}`, tradeId: String(i), orderId: 'actual-order', contractCode: 'RB2610.SHF', side: 'buy', offset: 'open', volume, price: 3200 + i * 3, tradeTime: new Date().toISOString() }))
    f.run.mockImplementation(async (...args) => args[1][0] === 'operation'
      ? data({ operationId: 'op-1', status: 'completed', latestOrder: { orderId: 'actual-order', filledQuantity: 3 } })
      : args[1][0] === 'trades' ? data([...fills, fills[0]!, { ...fills[0]!, id: 'other', orderId: 'other-order', price: 9999 }]) : base(...args))
    await f.service.execute(p.id, 's1')
    const result = await f.service.reconcile(p.id, 's1')
    expect(result.fills).toHaveLength(2)
    expect(result.fills?.map(fill => fill.price)).toEqual([3200, 3203])
    await f.service.reconcile(p.id, 's1')
    expect((await f.service.status()).plans[0]?.fills).toHaveLength(2)
    const restored = new ContestService(f.cli, f.home)
    expect((await restored.status()).plans[0]?.fills).toEqual(result.fills)
    expect(f.run.mock.calls.filter(([, args]) => args[0] === 'plan' && args[1] === 'execute')).toHaveLength(1)
  })
  it('backfills historical completed plans on reconnect without substituting a quote on read failure', async () => {
    const f = await fixture(); await f.connect()
    const p = await f.service.prepare({ operation: 'place_order', sessionId: 's1', order }, identity)
    const base = f.run.getMockImplementation()!
    let available = false
    f.run.mockImplementation(async (...args) => {
      if (args[1][0] === 'operation') return data({ operationId: 'op-1', status: 'completed', latestOrder: { orderId: 'actual-order', filledQuantity: 1 } })
      if (args[1][0] === 'trades') { if (!available) throw Error('offline'); return data([{ id: 'fill-1', tradeId: '1', orderId: 'actual-order', contractCode: 'RB2610.SHF', side: 'buy', offset: 'open', volume: 1, price: 3240, tradeTime: new Date().toISOString() }]) }
      return base(...args)
    })
    await f.service.execute(p.id, 's1')
    const completed = await f.service.reconcile(p.id, 's1')
    expect(completed.status).toBe('completed'); expect(completed.fills).toBeUndefined()
    available = true; await f.service.connect()
    expect((await f.service.status()).plans[0]?.fills?.[0]?.price).toBe(3240)
    expect(f.run.mock.calls.filter(([, args]) => args[0] === 'plan' && args[1] === 'execute')).toHaveLength(1)
  })
  it('serializes rapid confirmations and submits exactly once with a stable idempotency key', async () => {
    const f = await fixture(); await f.connect()
    const plan = await f.service.prepare({ operation: 'place_order', sessionId: 's1', order }, identity)
    expect(f.run.mock.calls.find(([, args]) => args[0] === 'order')?.[1]).toContain('--dry-run')
    const results = await Promise.all([f.service.execute(plan.id, 's1'), f.service.execute(plan.id, 's1')])
    expect(results.map(x => x.status)).toEqual(['queued', 'queued'])
    const calls = f.run.mock.calls.filter(([, args]) => args[0] === 'plan' && args[1] === 'execute')
    expect(calls).toHaveLength(1)
    expect(calls[0]?.[1]).toEqual(['plan', 'execute', plan.id, '--client-request-id', plan.clientRequestId, '--yes'])
    expect((await f.service.reconcile(plan.id, 's1')).status).toBe('completed')
  })
  it('does not replay an order after a lost response, including after a restart', async () => {
    const f = await fixture(); await f.connect()
    const plan = await f.service.prepare({ operation: 'place_order', sessionId: 's1', order }, identity)
    const base = f.run.getMockImplementation()!
    f.run.mockImplementation(async (...args) => {
      if (args[1][0] === 'plan' && args[1][1] === 'execute') throw new Error('timeout')
      return base(...args)
    })
    expect((await f.service.execute(plan.id, 's1')).status).toBe('unknown')
    const restored = new ContestService(f.cli, f.home); await restored.connect()
    expect((await restored.execute(plan.id, 's1')).status).toBe('unknown')
    expect(f.run.mock.calls.filter(([, args]) => args[0] === 'plan' && args[1] === 'execute')).toHaveLength(1)
    expect((await restored.reconcile(plan.id, 's1')).status).toBe('completed')
  })
  it('rejects another session and a changed account', async () => {
    const f = await fixture(); await f.connect()
    const plan = await f.service.prepare({ operation: 'place_order', sessionId: 's1', order }, identity)
    await expect(f.service.execute(plan.id, 's2')).rejects.toThrow('此会话')
    f.switchAccount()
    await expect(f.service.execute(plan.id, 's1')).rejects.toThrow('账户与此比赛会话不一致')
  })
  it('rejects invalid volume and excessive closes before making a plan', async () => {
    const f = await fixture(); await f.connect()
    await expect(f.service.prepare({ operation: 'place_order', sessionId: 's1', order: { ...order, volume: -1 } }, identity)).rejects.toThrow()
    await expect(f.service.prepare({ operation: 'place_order', sessionId: 's1', order: { ...order, offset: 'close', direction: 'sell', volume: 2 } }, identity)).rejects.toThrow('可平手数不足')
    expect(f.run.mock.calls.some(([, args]) => args[0] === 'plan')).toBe(false)
  })
  it('prevents updates while a plan awaits confirmation', async () => {
    const f = await fixture(); await f.connect()
    await f.service.prepare({ operation: 'place_order', sessionId: 's1', order }, identity)
    await expect(f.service.update()).rejects.toThrow('待确认计划')
    expect(f.cli.install).toHaveBeenCalledTimes(1)
  })
  it('allows an obsolete client to update after checking active orders', async () => {
    const f = await fixture(); await f.connect()
    const base = f.run.getMockImplementation()!
    f.run.mockImplementation(async (...args) => args[1][0] === 'agent' ? data({ minimumCliVersion: '0.1.20' }) : base(...args))
    await expect(f.service.connect()).rejects.toThrow('最低版本')
    vi.mocked(f.cli.install).mockResolvedValueOnce({ version: '0.1.20', rules: 'new rules' })
    expect(await f.service.update()).toMatchObject({ cliVersion: '0.1.20', phase: 'connected' })
    expect(f.service.rulesText()).toBe('new rules')
  })
  it('blocks update when there is an active order, even without a local plan', async () => {
    const f = await fixture(); await f.connect()
    const base = f.run.getMockImplementation()!
    f.run.mockImplementation(async (...args) => args[1][0] === 'orders' ? data([{ orderId: 'live-order' }]) : base(...args))
    await expect(f.service.update()).rejects.toThrow('活动委托')
    expect(f.cli.install).toHaveBeenCalledTimes(1)
  })
  it('rejects a plan that expires during account validation before submission', async () => {
    const f = await fixture(); await f.connect()
    const plan = await f.service.prepare({ operation: 'place_order', sessionId: 's1', order }, identity)
    const original = Date.now
    const base = f.run.getMockImplementation()!
    f.run.mockImplementation(async (...args) => {
      const result = await base(...args)
      if (args[1][0] === 'doctor') Date.now = () => plan.expiresAt + 1
      return result
    })
    try { await expect(f.service.execute(plan.id, 's1')).rejects.toThrow('失效') } finally { Date.now = original }
    expect(f.run.mock.calls.some(([, args]) => args[0] === 'plan' && args[1] === 'execute')).toBe(false)
  })
  it('drops late query results when the mode was switched off and back on', async () => {
    const f = await fixture(); await f.connect()
    let resolve!: (value: ContestData) => void
    f.run.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const result = f.service.query({ kind: 'account' })
    await vi.waitFor(() => expect(resolve).toBeTypeOf('function'))
    await f.service.setEnabled(false); await f.service.setEnabled(true)
    resolve(data({ equity: 123 }))
    await expect(result).rejects.toThrow('比赛模式已切换')
  })
})

describe('CLI contract', () => {
  it('uses explicit today and active-order queries, and retains pagination metadata', () => {
    expect(contestQueryArgs({ kind: 'orders', date: 'today', lastId: '123' })).toEqual(['orders', '--count', '50', '--date', 'today', '--last-id', '123'])
    expect(contestQueryArgs({ kind: 'open-orders' })).toEqual(['orders', '--status', 'open', '--count', '200'])
    expect(parseCliOutput('{"ok":true,"data":[],"meta":{"hasMore":true,"nextLastId":123}}').meta?.nextLastId).toBe(123)
  })
  it('redacts nested credentials and never reflects raw upstream errors', () => {
    const result = parseCliOutput('{"ok":true,"data":{"accessToken":"secret","nested":{"password":"secret","accountId":"a1"}}}')
    expect(JSON.stringify(result)).not.toContain('secret')
    expect(() => parseCliOutput('{"ok":false,"error":{"code":"market_closed","message":"token secret"}}')).toThrow('休市')
    expect(() => parseCliOutput('private credentials')).toThrow('无法解析')
  })
})


it('serializes read-only confirmation recovery behind a failed pre-submit check', async () => {
  const f = await fixture(); await f.connect()
  const p = await f.service.prepare({ sessionId: 'session1', operation: 'place_order', order }, identity)
  const base = f.run.getMockImplementation()!
  let release!: () => void
  f.run.mockImplementationOnce(async () => { await new Promise<void>(resolve => { release = resolve }); throw new Error('identity read failed') })
  const confirming = f.service.execute(p.id, 'session1').catch(error => error)
  await vi.waitFor(() => expect(release).toBeDefined())
  expect((await f.service.status()).plans[0]?.status).toBe('prepared')
  f.run.mockImplementation((runtime, args, signal) => args[0] === 'plan' && args[1] === 'show'
    ? Promise.resolve(data({ status: 'prepared' })) : base(runtime, args, signal))
  let verified = false
  const verification = f.service.reconcile(p.id, 'session1').then(result => { verified = true; return result })
  await new Promise(resolve => setTimeout(resolve, 10))
  expect(verified).toBe(false)
  release(); await confirming
  await expect(verification).resolves.toMatchObject({ id: p.id, status: 'prepared' })
  expect(f.run.mock.calls.some(([, args]) => args[0] === 'plan' && args[1] === 'execute')).toBe(false)
  await f.service.dismiss(p.id, 'session1')
  expect((await f.service.status()).plans[0]?.status).toBe('cancelled')
})
