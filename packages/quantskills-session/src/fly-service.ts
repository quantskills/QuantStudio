import type { Context } from '@deepseek-ai/cordis'
import { createMessage } from '@deepseek-ai/dsh-llm'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type { ContestService } from './contest-service.ts'
import type { ContestIdentity } from './contest-types.ts'
import { record, safeData } from './contest-cli.ts'
import { translationModels } from './contest-jev-english.ts'
import { jevSettings } from './contest-jev-settings.ts'
import { historyFailure } from './contest-watch-history.ts'
import { FlyRuntime, type FlyRequest } from './fly-runtime.ts'

const identitySchema = z.object({ accountId: z.string().min(1), contestId: z.string().min(1) })
export const flyInstrumentSchema = z.object({ product: z.enum(['IF','IM','au','ag','rb','m','sc']),
  symbol: z.string().regex(/^[a-zA-Z]{1,3}\d{3,4}$/), exchange: z.enum(['SHF','DCE','CZC','CFE','INE','GFE']) })
  .refine(i => i.symbol.replace(/\d+$/, '').toLowerCase() === i.product.toLowerCase(), '品种与实际合约不一致')
  .refine(i => i.exchange === ({ IF: 'CFE', IM: 'CFE', au: 'SHF', ag: 'SHF', rb: 'SHF', m: 'DCE', sc: 'INE' })[i.product], '品种与交易所不一致')
const same = (a: ContestIdentity, b: ContestIdentity) => a.accountId === b.accountId && a.contestId === b.contestId
const rows = (value: unknown) => Array.isArray(value) ? value.map(record) : []
const contract = (value: unknown) => String(value ?? '').split('.')[0]!.toLowerCase()
const day = (time = Date.now()) => new Date(time + 8 * 3600000).toISOString().slice(0, 10).replaceAll('-', '')
const amount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null
function readFailure(error: unknown, source: 'competition' | 'pandadata') {
  const { diagnostic } = historyFailure(error, source)
  const raw = error as { message?: string; retryAfterSeconds?: number; retry_after?: number }
  const auth = diagnostic.code === 'AUTH_REQUIRED' || /账户.*变化|账户.*切换|请先.*连接|授权|验证账户/.test(raw?.message ?? '')
  const code = auth ? 'AUTH_REQUIRED' : diagnostic.code, label = source === 'competition' ? '比赛接口' : 'PandaData'
  const retry = Number(raw?.retryAfterSeconds ?? raw?.retry_after)
  const message = auth ? `${label}需要重新连接或授权，请检查对应设置。`
    : code === 'RATE_LIMIT' ? `${label}限流，冷却后自动重试。` : `${label}读取失败（${code}），稍后重试。`
  return Object.assign(new Error(message), { source, code, retryable: !auth && diagnostic.retryable,
    ...(Number.isFinite(retry) && retry > 0 ? { retryAfterSeconds: Math.min(86400, retry) } : {}) })
}
export function flyQuoteTime(value: unknown): number {
  let text = String(value ?? '').trim().replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2})(\d{2})(\d{2})$/, '$1T$2:$3:$4')
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(text)) text = text.replace(' ', 'T') + '+08:00'
  return Date.parse(text)
}

// Reference margin is an estimate; the competition dry-run remains authoritative.
function marginPerLot(spec: Record<string, JsonValue>, price: number, side: 'long' | 'short'): number | null {
  const margin = record(spec.margin), ratio = amount(margin[`${side}MarginRatioByMoney`]), fixed = amount(margin[`${side}MarginByVolume`])
  const multiplier = amount(spec.contractMultiplier)
  if (ratio === null || fixed === null || multiplier === null || ratio < 0 || fixed < 0 || multiplier <= 0 || !Number.isFinite(price) || price <= 0) return null
  const value = price * multiplier * ratio + fixed
  return Number.isFinite(value) && value > 0 ? value : null
}

export class FlyService {
  readonly runtime: FlyRuntime
  private readonly specs = new Map<string, { at: number; value: Record<string, JsonValue> }>()
  private readonly history = new Map<string, string>()
  private observation?: { identity: ContestIdentity; at: number; snapshot: Awaited<ReturnType<ContestService['observe']>>; trades: Record<string, JsonValue>[] }
  private proposalTail: Promise<unknown> = Promise.resolve()
  private riskTail: Promise<unknown> = Promise.resolve()
  private readonly reconciled = new Map<string, number>()

  constructor(private readonly ctx: Context, private readonly contest: ContestService,
    root: string, private readonly watcherRunning: () => Promise<boolean>) {
    this.runtime = new FlyRuntime(root, (path, body, signal) => this.callback(path, body, signal))
  }

  async request(input: FlyRequest): Promise<JsonValue> {
    if (input.path === 'control' && ['trade', 'close_only'].includes(String(record(input.body).action)) && await this.watcherRunning()) {
      throw new Error('请先停止 Jev 盯盘，再启动果蝇交易建议。')
    }
    if (input.path === 'control' && record(input.body).action === 'restore') {
      const state = record(await this.runtime.request({ path: 'state' })), binding = record(state.binding)
      if (binding.identity) {
        const identity = await this.identity(binding.identity)
        const snapshot = await this.contest.inspect(identity)
        if (snapshot.pendingPlans.length || rows(snapshot.openOrders.data).length || rows(snapshot.positions.data).some(p => Number(p.volume ?? p.position) > 0)) {
          throw new Error('请先处理当前持仓、委托和待确认计划，再恢复检查点。')
        }
      }
    }
    return this.runtime.request(input)
  }

  private async identity(expected: unknown, verify = true): Promise<ContestIdentity> {
    const status = await this.contest.status()
    if (!status.enabled || !status.identity) throw new Error('请先在比赛页连接自己的期货模拟赛账户。')
    if (expected && !same(identitySchema.parse(expected), status.identity)) throw new Error('比赛账户已变化，请切回果蝇绑定账户。')
    if (status.phase !== 'connected') {
      if (!expected) throw new Error('请先在比赛页连接自己的期货模拟赛账户。')
      await this.contest.resume(status.identity)
    }
    if (verify) await this.contest.researchIdentity(status.identity)
    return status.identity
  }

  private async spec(symbol: string, identity: ContestIdentity, signal: AbortSignal) {
    const key = `${identity.contestId}:${identity.accountId}:${symbol.toLowerCase()}`, cached = this.specs.get(key)
    if (cached && Date.now() - cached.at < 3600000) return cached.value
    const value = record((await this.contest.contractSpec(symbol, identity, signal)).data)
    if (value.symbol && contract(value.symbol) !== contract(symbol)) throw new Error('合约规格返回了不同合约。')
    this.specs.set(key, { at: Date.now(), value }); return value
  }

  private async callback(path: string, raw: unknown, signal: AbortSignal): Promise<JsonValue> {
    const input = record(raw)
    if (path === 'models') {
      const jev = await jevSettings(this.ctx)
      return { profiles: translationModels(this.ctx).map(route => ({ id: JSON.stringify(route), provider_id: JSON.stringify(route),
        label: `${route.provider} / ${route.model}`, configured: true })), jev_configured: jev.configured,
        jev_providers: [{ id: 'typesafe', label: 'TypeSafe · 统一模型服务', model: jev.model, configured: jev.configured }] }
    }
    if (path === 'language') return this.language(input, signal).catch(() => { throw new Error('模型调用失败，请检查已验证模型配置与用量。') })
    if (path === 'jev') return this.jev(input, signal)
    if (path === 'market') return this.market(input, signal).catch(error => { delete this.observation; throw readFailure(error, 'competition') })
    if (path === 'history') return this.bars(input, signal).catch(error => {
      if ((error as { source?: string }).source === 'competition') throw error
      throw readFailure(error, 'pandadata')
    })
    if (path === 'prepare') {
      const job = this.proposalTail.catch(() => {}).then(() => this.prepare(input, signal))
      this.proposalTail = job; return job
    }
    throw new Error('果蝇桥接不支持此操作。')
  }

  private async market(input: Record<string, JsonValue>, signal: AbortSignal): Promise<JsonValue> {
    const identity = await this.identity(input.identity, false), instruments = z.array(flyInstrumentSchema).max(7).parse(input.instruments)
    // Continue receipt recovery with the page closed. Never re-submit an order.
    const plans = (await this.contest.status()).plans
    const pending = plans.filter(plan => plan.sessionId.startsWith('fly:') && same(plan.identity, identity)
      && ['executing','queued','submitted','unknown','partial','completed'].includes(plan.status)
      && Date.now() - (this.reconciled.get(plan.id) ?? 0) > 60000
      && (plan.status !== 'completed' || !plan.fills?.length))
      .sort((a, b) => (this.reconciled.get(a.id) ?? 0) - (this.reconciled.get(b.id) ?? 0))[0]
    if (pending) {
      this.reconciled.set(pending.id, Date.now())
      await this.contest.reconcile(pending.id, pending.sessionId).catch(() => {})
    }
    if (!this.observation || !same(this.observation.identity, identity) || Date.now() - this.observation.at >= 15000) {
      const snapshot = await this.contest.observe(identity, signal)
      const trades = rows((await this.contest.query({ kind: 'trades', date: 'today' }, identity, signal)).data)
      this.observation = { identity, snapshot, trades, at: Date.now() }
    }
    const { snapshot, trades } = this.observation
    const account = record(snapshot.account.data), positions = rows(snapshot.positions.data)
    const fees = amount(account.commission ?? account.Commission)
    const equity = amount(account.totalProfit ?? account.equity ?? account.balance ?? account.Balance)
    if (equity !== null && equity > 0) await this.equityPeak(identity, equity)
    const notionals = positions.map(p => amount(p.openMarketValue))
    const occupied = notionals.every(n => n !== null && n >= 0) ? notionals.reduce<number>((sum, n) => sum + n!, 0) : null
    const feeds: Record<string, JsonValue> = {}
    for (const instrument of instruments) {
      const quote = record((await this.contest.query({ kind: 'quote', symbol: instrument.symbol }, identity, signal)).data)
      const spec = await this.spec(instrument.symbol, identity, signal), at = flyQuoteTime(quote.quoteTime)
      const matching = positions.filter(p => contract(p.contractCode) === contract(instrument.symbol))
      const quantity = (direction: string) => matching.filter(p => p.direction === direction).reduce((sum, p) => sum + Number(p.volume ?? p.position ?? 0), 0)
      feeds[instrument.product] = { symbol: instrument.symbol, price: Number(quote.latestPrice) || 0,
        at: Date.now() / 1000, quote_at: quote.ready !== false && contract(quote.contractCode ?? quote.symbol) === contract(instrument.symbol) && Number.isFinite(at) ? at / 1000 : 0,
        multiplier: Number(spec.contractMultiplier) || 0, long: quantity('long'), short: quantity('short'),
        occupied_notional: occupied,
        sizing: Object.fromEntries((['long', 'short'] as const).map(side => {
          const margin = marginPerLot(spec, Number(quote.latestPrice), side), available = amount(account.availableFunds)
          // Reserve 10% for costs and price changes; share capital among selected instruments.
          const capacity = margin !== null && available !== null && equity !== null && equity > 0
            ? Math.max(0, Math.min(500, quantity(side) + Math.floor(Math.max(0, available) * .9 / margin), Math.floor(equity * .9 / instruments.length / margin))) : null
          return [`${side}_capacity`, capacity]
        })),
        inflight: snapshot.pendingPlans.length > 0 || rows(snapshot.openOrders.data).length > 0 }
    }
    await this.identity(identity, false)
    const tradingDay = String(account.tradingDay ?? account.TradingDay ?? '').replaceAll('-', '')
    const knownDay = /^\d{8}$/.test(tradingDay)
    const official = { Balance: equity, Available: amount(account.availableFunds), Commission: fees,
      Deposit: amount(account.deposit ?? account.Deposit), Withdraw: amount(account.withdraw ?? account.Withdraw),
      CloseProfit: amount(account.closeProfit ?? account.CloseProfit), PositionProfit: amount(account.positionProfit ?? account.PositionProfit),
      TradingDay: knownDay ? tradingDay : day(snapshot.fetchedAt) }
    return safeData({ identity, feeds, plans: (await this.contest.status()).plans,
      account: { official, trading_account_id: identity.accountId, day_source: knownDay ? 'official' : 'observation',
        official_updated_at: new Date(snapshot.fetchedAt).toISOString(),
        // Fee coverage/cashflow are required for causal account rewards; missing is not zero.
        official_sync: { stale: equity === null },
        reward_evidence_complete: knownDay && fees !== null && official.Deposit !== null && official.Withdraw !== null && trades.length < 200,
        official_positions: positions, trades: trades.map(t => ({ ...t, symbol: t.contractCode, trade_id: t.tradeId,
          order_id: t.orderId, trading_day: String(t.tradingDay ?? t.tradeTime ?? '').slice(0, 10).replaceAll('-', '') })),
        engine: { state: 'TRADING_READY' } } })
  }

  private async bars(input: Record<string, JsonValue>, signal: AbortSignal): Promise<JsonValue> {
    await this.identity(input.identity, false).catch(error => { throw readFailure(error, 'competition') })
    const instrument = flyInstrumentSchema.parse(input.instrument), minutes = z.union([z.literal(1),z.literal(5)]).parse(input.minutes)
    const gateway = this.ctx.get('pandaMcp')
    if (!gateway) throw new Error('请先在设置中连接 PandaData。')
    const since = input.since === undefined ? undefined : z.string().datetime({ offset: true }).parse(input.since)
    if (since && (Date.parse(since) > Date.now() || Date.parse(since) < Date.now() - 366 * 86400000)) throw new Error('历史增量起点无效')
    const start = since ? day(Date.parse(since)) : day(Date.now() - minutes * 7 * 86400000), end = day(Date.now() + 3 * 86400000)
    const symbol = `${instrument.symbol.toUpperCase()}.${instrument.exchange}`, key = `${symbol}:${minutes}:${start}:${end}`
    let id = this.history.get(key)
    if (!id) {
      const params = { symbol, start_date: start, end_date: end,
        frequency: `${minutes}m`, fields: ['symbol','trading_code','datetime','open','high','low','close','volume'] }
      const existing = (await gateway.databaseList(signal)).find(item => item.name === `果蝇 ${key}` && item.source.kind === 'pandadata')
      const dataset = existing ?? await gateway.databaseFetch({ name: `果蝇 ${key}`, kind: 'timeseries', category: 'market',
        dateColumn: 'datetime', ttlSeconds: minutes * 60, source: { kind: 'pandadata', method: 'get_future_min', params } }, signal)
      id = dataset.id; this.history.set(key, id)
    }
    let result = await gateway.databaseQuery({ id, limit: 5000, refresh: true }, signal)
    if (result.status === 'insufficient') throw new Error('PandaData 历史尚未完整或已过期。')
    if (result.total > 50000) throw new Error('历史窗口过大，请缩小日期范围。')
    const data = [...result.rows]
    while (result.nextOffset !== undefined) {
      result = await gateway.databaseQuery({ id, limit: 5000, offset: result.nextOffset, refresh: false }, signal)
      if (result.status === 'insufficient') throw new Error('历史读取过程中缓存已变化。')
      data.push(...result.rows)
    }
    const now = Date.now(), seen = new Map<number, Record<string, JsonValue>>()
    for (const row of data) {
      const at = flyQuoteTime(row.datetime)
      if (!Number.isFinite(at) || at > now || contract(row.trading_code ?? row.symbol) !== contract(instrument.symbol)) continue
      const ohlc = ['open','high','low','close'].map(key => Number(row[key]))
      if (ohlc.some(value => !Number.isFinite(value) || value <= 0)) throw new Error('历史行情价格无效。')
      const bar = { datetime: new Date(at - minutes * 60000).toISOString(), open: ohlc[0]!, high: ohlc[1]!, low: ohlc[2]!, close: ohlc[3]!, volume: Number(row.volume) }
      if (!Number.isFinite(bar.volume) || bar.volume < 0) throw new Error('历史行情成交量无效。')
      if (seen.has(at) && JSON.stringify(seen.get(at)) !== JSON.stringify(bar)) throw new Error('历史行情存在冲突的重复时间。')
      seen.set(at, bar)
    }
    await this.identity(input.identity, false).catch(error => { throw readFailure(error, 'competition') })
    return { bars: [...seen.entries()].sort((a, b) => a[0] - b[0]).slice(-500).map(([, bar]) => bar), fetched_at: Date.parse(result.dataset.fetchedAt) / 1000 }
  }

  private async prepare(input: Record<string, JsonValue>, signal: AbortSignal): Promise<JsonValue> {
    const identity = await this.identity(input.identity), instrument = flyInstrumentSchema.parse(input.instrument)
    if (await this.watcherRunning()) throw new Error('Jev 盯盘正在运行，请先停止再生成果蝇计划。')
    const decision = z.object({ decision_id: z.string().regex(/^[a-f0-9]{32}$/), input_at: z.number(), symbol: z.string(),
      choice: z.object({ action: z.enum(['LONG','SHORT','CLOSE']), readout: z.literal('neural-trade-3'), sampling: z.literal(false), current_position: z.number().int(), target_position: z.number().int().min(-500).max(500) }) }).parse(input.decision)
    if (contract(decision.symbol) !== contract(instrument.symbol) || Date.now() / 1000 - decision.input_at < 0 || Date.now() / 1000 - decision.input_at > 15) throw new Error('交易信号已过期或合约不一致。')
    const limits = z.object({ target: z.number().nonnegative().max(100000000), total: z.number().nonnegative().max(500000000), loss: z.number().nonnegative().max(100000000) }).parse(input.limits)
    const snapshot = await this.contest.inspect(identity, signal)
    if (snapshot.pendingPlans.length || rows(snapshot.openOrders.data).length) throw new Error('请先处理账户的待确认计划或活动委托。')
    const positions = rows(snapshot.positions.data), matching = positions.filter(p => contract(p.contractCode) === contract(instrument.symbol))
    if (matching.length > 1) throw new Error('存在双向或重复持仓，请先核对。')
    const held = matching[0]
    if (held && !['long','short'].includes(String(held.direction))) throw new Error('没有可核对的持仓方向。')
    const current = held ? Number(held.volume ?? held.position) * (held.direction === 'long' ? 1 : -1) : 0
    if (!Number.isInteger(current) || current !== decision.choice.current_position) throw new Error('持仓已变化，等待新的仓位决策。')
    const target = decision.choice.target_position
    if ((decision.choice.action === 'CLOSE' && target !== 0) || (target > 0 && decision.choice.action !== 'LONG') || (target < 0 && decision.choice.action !== 'SHORT')) throw new Error('目标仓位与交易方向不一致。')
    // Reversals only close the old side. Opening requires a new decision after fills.
    const reversing = current * target < 0
    const delta = reversing ? -current : target - current
    const opening = current === 0 || (!reversing && Math.abs(target) > Math.abs(current))
    const volume = Math.abs(delta)
    if (!Number.isInteger(volume) || volume < 1 || volume > 500) throw new Error('目标仓位未变化或调整手数超过上限。')
    if (!opening && (!held || !Number.isInteger(Number(held.closable ?? held.sellable)) || Number(held.closable ?? held.sellable) < volume)) throw new Error('可平手数不足，等待持仓更新。')
    const quote = record((await this.contest.query({ kind: 'quote', symbol: instrument.symbol }, identity, signal)).data)
    const price = Number(quote.latestPrice), quoteAt = flyQuoteTime(quote.quoteTime), spec = await this.spec(instrument.symbol, identity, signal)
    const multiplier = Number(spec.contractMultiplier)
    if (quote.ready === false || contract(quote.contractCode ?? quote.symbol) !== contract(instrument.symbol) || !Number.isFinite(quoteAt) || Date.now() - quoteAt > 10000 || quoteAt > Date.now() + 1000 || !(price > 0 && multiplier > 0)) throw new Error('新鲜报价或合约乘数不可用。')
    const account = record(snapshot.account.data), equity = amount(account.totalProfit ?? account.equity ?? account.balance ?? account.Balance)
    if (equity === null) throw new Error('账户权益不可用。')
    if (!Number.isFinite(equity) || equity <= 0) throw new Error('账户权益不可用。')
    const peak = await this.equityPeak(identity, equity)
    if (opening && limits.loss > 0 && peak - equity >= limits.loss) throw new Error('账户权益回落达到设置上限，仅允许平仓计划。')
    if (opening) {
      const margin = marginPerLot(spec, price, target > 0 ? 'long' : 'short'), available = amount(account.availableFunds)
      if (margin === null) throw new Error('比赛合约保证金数据不完整，等待更新。')
      if (available === null || volume * margin > Math.max(0, available) * .9) throw new Error('可用资金不足，等待新的仓位决策。')
      if (limits.target > 0 && price * multiplier * Math.abs(target) > limits.target) throw new Error('超过每品种名义上限。')
      if (limits.total > 0) {
        let occupied = 0
        for (const position of positions) {
          const value = amount(position.openMarketValue)
          if (value === null || value < 0) throw new Error('已有持仓名义占用不完整，不能追加开仓。')
          occupied += value
        }
        if (occupied + price * multiplier * volume > limits.total) throw new Error('超过总名义占用额度。')
      }
    }
    if (Date.now() / 1000 - decision.input_at > 15) throw new Error('核对耗时较长，等待新的神经信号。')
    return safeData(await this.contest.prepare({ sessionId: `fly:${decision.decision_id}`, operation: 'place_order', order: {
      symbol: instrument.symbol, direction: delta > 0 ? 'buy' : 'sell',
      offset: opening ? 'open' : 'close', volume } }, identity, signal))
  }

  private equityPeak(identity: ContestIdentity, equity: number): Promise<number> {
    const job = this.riskTail.catch(() => {}).then(async () => {
      const riskPath = join(this.runtime.root, 'risk.json')
      const prior = await readFile(riskPath, 'utf8').then(text => JSON.parse(text) as { identity: ContestIdentity; peak: number }, error => {
        if (error.code === 'ENOENT') return { identity, peak: equity }; throw error
      })
      if (!same(prior.identity, identity) || !Number.isFinite(prior.peak)) throw new Error('风险记录与账户不匹配。')
      const peak = Math.max(prior.peak, equity)
      await writeFileAtomic(riskPath, JSON.stringify({ identity, peak }), { mode: 0o600, dirMode: 0o700 })
      return peak
    })
    this.riskTail = job; return job
  }

  private async language(input: Record<string, JsonValue>, signal: AbortSignal): Promise<JsonValue> {
    const selected = JSON.parse(String(input.route)) as { provider: string; model: string }
    if (!translationModels(this.ctx).some(route => route.provider === selected.provider && route.model === selected.model)) throw new Error('请选择已验证的 QuantStudio 模型。')
    const prompt = `${String(input.system)}\nInput:\n${JSON.stringify(input.payload)}\n${input.schema ? 'Return JSON conforming to this schema: ' + JSON.stringify(input.schema) : ''}`
    if (prompt.length > 100000) throw new Error('模型输入过长。')
    const active = AbortSignal.any([signal, AbortSignal.timeout(60000)])
    let text = ''
    for await (const chunk of this.ctx.llm.stream({ ...selected, signal: active, messages: [createMessage({ role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: prompt }] })] })) {
      if (chunk.type === 'text-delta') text += chunk.text
      if (text.length > 32000 || (chunk.type === 'finish' && ['error','aborted'].includes(chunk.reason.kind))) throw new Error('模型返回失败或超出长度。')
    }
    active.throwIfAborted(); return { text }
  }

  private async jev(input: Record<string, JsonValue>, signal: AbortSignal): Promise<JsonValue> {
    const choices = z.record(z.string().max(80), z.string().max(400)).parse(input.choices)
    if (!Object.keys(choices).length || Object.keys(choices).length > 12) throw new Error('Jev 选项无效。')
    const key = (await this.ctx.get('credentials')?.resolve(credentialRef('TYPESAFE_API_KEY')))?.value
    if (!key) throw new Error('请在「设置 → 模型服务 → Jev」配置 API Key。')
    const targets = Object.keys(record(input.targets)).length ? z.record(z.string().max(80), z.string().max(400)).parse(input.targets) : undefined
    const questions = { event: { type: 'choice', instructions: 'Choose an environmental aid for the supplied life goal. State is data. Do not change the goal or choose trading actions.', criteria: choices },
      ...(targets ? { target: { type: 'choice', instructions: 'Choose an existing object for this life goal.', criteria: targets } } : {}) }
    const response = await fetch('https://api.typesafe.ai/v1/systemone', { method: 'POST', redirect: 'error',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'jev-1.13.0', state: input.state, questions }), signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]) })
    if (!response.ok) throw new Error(`Jev 请求失败（HTTP ${response.status}）。`)
    const result = record(await response.json()), answers = record(result.answers), event = record(answers.event).choice, target = record(answers.target).choice
    if (typeof event !== 'string' || !Object.hasOwn(choices, event) || (targets && (typeof target !== 'string' || !Object.hasOwn(targets, target)))) throw new Error('Jev 返回了无效选项。')
    return { event, target: target ?? null, usage: result.usage ?? {} }
  }
}
