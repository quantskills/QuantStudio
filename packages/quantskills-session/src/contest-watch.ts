/** A Host-owned watcher that prepares plans; it never submits a trade. */
import { createHash, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { z } from 'zod'
import { ContestCliError, record, transientContestCodes } from './contest-cli.ts'
import { contestContractParts as contractParts, sameContestContract as sameSymbol, futuresContractPattern, futuresProductPattern, futuresProduct } from './contest-contract.ts'
import { configureJev } from './contest-jev-settings.ts'
import { auditedJevFetch, jevUsageSchema } from './contest-jev-audit.ts'
import { historySchema, rangeRulesSchema, signalRulesSchema, watchEvidence } from './contest-watch-evidence.ts'
import { prepareWatchHistory, watchHistory } from './contest-watch-history.ts'
import { parseAssessments, watchAssessments } from './contest-watch-evaluation.ts'
import { defaultActionCriteria, upgradeWatchStrategy, watchStrategyWarnings } from './contest-watch-strategy.ts'
import { englishJevBody, englishJevInput } from './contest-jev-english.ts'
import { englishEvidence } from './contest-watch-input.ts'
import type { ContestService } from './contest-service.ts'
import type { ContestInspection, ContestOrder } from './contest-types.ts'
import type { ContestWatchAction, ContestWatchAnalysis, ContestWatchConfig, ContestWatchDecision, ContestWatchEvidence, ContestWatchHistory, ContestWatchQuote, ContestWatchStatus, ContestWatchTemplate } from './contest-watch-types.ts'

const configObject = z.object({
  symbol: z.string().trim().regex(futuresContractPattern), volume: z.number().int().min(1).max(100),
  intervalSeconds: z.number().int().min(3).max(86400), decisionIntervalSeconds: z.number().int().min(3).max(86400).default(30),
  openingCooldownSeconds: z.number().int().min(0).max(3600).default(300),
  decisionMode: z.enum(['jev', 'strict']).optional(),
  durationMinutes: z.number().int().min(5).max(1440),
  minConfidence: z.number().min(0.5).max(1), maxEquityDrop: z.number().positive().finite(),
  maxPlans: z.number().int().min(1).max(100), instructions: z.string().trim().min(1).max(2000),
  strategyName: z.string().trim().min(1).max(80).optional(),
  actionCriteria: z.object({ hold: z.string().trim().min(1).max(1000).optional(), open_long: z.string().trim().min(1).max(1000).optional(),
    open_short: z.string().trim().min(1).max(1000).optional(), close_long: z.string().trim().min(1).max(1000).optional(), close_short: z.string().trim().min(1).max(1000).optional() }).strict().optional(),
  referenceMaterial: z.string().max(12000).optional(), allowedSide: z.enum(['both', 'long_only', 'short_only']).optional(),
  minSamples: z.number().int().min(8).max(60).optional(), maxSpread: z.number().finite().min(0).optional(),
  history: historySchema.optional(), rangeRules: rangeRulesSchema.optional(), signalRules: signalRulesSchema.optional(), customStrategy: z.boolean().optional(),
  builtInTemplate: z.enum(['rb-range', 'range', 'trend', 'breakout']).optional(),
  instrument: z.object({ product: z.string().regex(futuresProductPattern), exchange: z.enum(['SHF', 'DCE', 'CZC', 'CFE', 'INE', 'GFE']), tickSize: z.number().finite().positive() }).strict().optional(),
  autoHistory: z.object({ exchange: z.enum(['SHF', 'DCE', 'CZC', 'CFE', 'INE', 'GFE']), barSeconds: z.union([z.literal(60), z.literal(300)]) }).strict().optional(),
}).strict()
const consistentConfig = (config: ContestWatchConfig) => {
  if (config.rangeRules && config.signalRules) return false
  if (config.builtInTemplate === 'range' && !config.rangeRules) return false
  if ((config.builtInTemplate === 'trend' || config.builtInTemplate === 'breakout') && config.signalRules?.kind !== config.builtInTemplate) return false
  if (config.customStrategy && (config.rangeRules || config.signalRules || actions.some(action => !config.actionCriteria?.[action]?.trim()))) return false
  const instrument = config.instrument, rules = config.rangeRules ?? config.signalRules
  return !instrument || ((!config.symbol || futuresProduct(config.symbol) === instrument.product.toLowerCase())
    && (!config.autoHistory || config.autoHistory.exchange === instrument.exchange) && (!rules || rules.tickSize === instrument.tickSize))
}
const configSchema = configObject.refine(consistentConfig)
const templateConfigSchema = configObject.extend({ symbol: z.string().trim().refine(value => !value || futuresContractPattern.test(value)) }).refine(consistentConfig)
const actions = ['hold', 'open_long', 'open_short', 'close_long', 'close_short'] as const
const labels: Record<ContestWatchAction, string> = { hold: '观望', open_long: '开多', open_short: '开空', close_long: '平多', close_short: '平空' }
type Quote = ContestWatchQuote
const numeric = (value: unknown): number => typeof value === 'number' ? value : NaN

/** Quotes without an explicit timezone are exchange-local Shanghai timestamps. */
export function watchQuote(value: unknown, symbol: string, now = Date.now(), exchange?: string): { quote: Quote; issue?: never } | { quote?: never; issue: string } {
  const row = record(value), text = row.quoteTime
  // The public quote contract guarantees price/time/contract fields, not a `ready` flag.
  // Explicit unavailability still blocks sampling; omission must pass every quote check below.
  if (row.ready === false) return { issue: `比赛柜台行情尚未就绪（${symbol}）；请在比赛页「最新行情」核对同一合约，系统将继续重试。` }
  if (row.ready !== undefined && row.ready !== true) return { issue: '比赛柜台返回了无法识别的行情就绪标记；请检查比赛 CLI 版本与行情接口。' }
  if (!sameSymbol(row.contractCode ?? row.symbol, symbol, exchange)) return { issue: `行情合约与 ${symbol} 不符；请检查实际合约配置。` }
  if (typeof text !== 'string') return { issue: '柜台未返回行情时间；等待完整行情。' }
  // The contest CLI also returns e.g. "2026-09-18 101050" (HHmmss).
  const normalized = text.replace(/^(\d{4}-\d{2}-\d{2})[ T](\d{2})(\d{2})(\d{2})(\.\d+)?$/, '$1T$2:$3:$4$5')
  const iso = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(normalized) ? normalized.replace(' ', 'T') + '+08:00' : normalized
  const time = Date.parse(iso), price = numeric(row.latestPrice)
  if (!Number.isFinite(time)) return { issue: '无法识别柜台行情时间格式；请检查行情接口。' }
  if (time > now + 5000) return { issue: '行情时间超前超过 5 秒；请检查本机时钟与柜台时间。' }
  if (now - time > 90000) return { issue: '行情已超过 90 秒未更新；休市时等待开盘，交易时段请检查行情连接。' }
  if (!Number.isFinite(price) || !(price > 0)) return { issue: '柜台未返回有效最新价；等待有效报价。' }
  return { quote: { time, price, ...(numeric(row.bidPrice1) > 0 ? { bid: numeric(row.bidPrice1) } : {}), ...(numeric(row.askPrice1) > 0 ? { ask: numeric(row.askPrice1) } : {}) } }
}

/** Fail closed on ambiguous positions, missing account facts or exceeded limits. */
export function watchAccount(snapshot: ContestInspection, config: ContestWatchConfig, baseline?: number) {
  const account = record(snapshot.account.data), equity = numeric(account.equity ?? account.totalProfit)
  if (!(equity > 0)) throw new Error('无法确认动态权益，盯盘已暂停。')
  if (baseline !== undefined && baseline - equity >= config.maxEquityDrop) throw new Error('已触及权益回落停止线；请人工检查持仓。')
  if (!Array.isArray(snapshot.positions.data) || !Array.isArray(snapshot.openOrders.data)) throw new Error('持仓或挂单数据不完整。')
  const exchange = config.instrument?.exchange ?? config.autoHistory?.exchange
  const rows = snapshot.positions.data.map(record).filter(row => {
    if (!contractParts(row.contractCode)) throw new Error('持仓合约代码无法识别，需核对后再开始盯盘。')
    if (!sameSymbol(row.contractCode, config.symbol)) return false
    if (!sameSymbol(row.contractCode, config.symbol, exchange)) throw new Error('持仓交易所与盯盘配置不符，请核对合约。')
    return true
  })
  if (rows.length > 1) throw new Error('所选合约存在多条持仓，需人工处理后再开始盯盘。')
  const row = rows[0], volume = row ? numeric(row.volume ?? row.position ?? row.quantity) : 0
  const closable = row ? numeric(row.closable ?? row.sellable) : 0
  if (!Number.isInteger(volume) || volume < 0 || volume > config.volume
    || (row && (!['long', 'short'].includes(String(row.direction)) || !Number.isInteger(closable) || closable < 0 || closable > volume))) {
    throw new Error('持仓超出授权手数或方向、可平量不明确。')
  }
  let allowed: ContestWatchAction[] = volume === 0 ? ['hold', 'open_long', 'open_short']
    : closable > 0 ? ['hold', row!.direction === 'long' ? 'close_long' : 'close_short'] : ['hold']
  if (config.allowedSide === 'long_only') allowed = allowed.filter(action => action !== 'open_short')
  if (config.allowedSide === 'short_only') allowed = allowed.filter(action => action !== 'open_long')
  const entry = numeric(row?.openPrice ?? row?.avgPrice)
  return { equity, volume, closable, direction: row?.direction ?? 'flat', allowed, hasOpenOrders: snapshot.openOrders.data.length > 0, fetchedAt: snapshot.fetchedAt,
    ...(Number.isFinite(entry) && entry > 0 ? { entryPrice: entry } : {}) }
}

export function watchSpread(config: ContestWatchConfig, quote: Quote): boolean {
  return !config.maxSpread || (quote.bid !== undefined && quote.ask !== undefined && quote.ask >= quote.bid
    && quote.ask - quote.bid <= config.maxSpread + Math.max(Math.abs(quote.ask), Math.abs(quote.bid)) * Number.EPSILON * 8)
}

export async function decideWithJev(ctx: Context, config: ContestWatchConfig, samples: Quote[], account: ReturnType<typeof watchAccount>,
  signal: AbortSignal, request: typeof fetch = fetch, context?: { evidence: ContestWatchEvidence; history: ContestWatchHistory; root?: string }): Promise<ContestWatchDecision> {
  let key: string | undefined
  try { key = (await ctx.get('credentials')?.resolve(credentialRef('TYPESAFE_API_KEY')))?.value }
  catch { throw new Error('无法读取 Jev 凭据。') }
  if (!key) throw new Error('未配置 TYPESAFE_API_KEY。')
  const history = context?.history ?? { source: '未提供历史 K 线', barSeconds: 60, bars: [], issue: 'Only locally sampled quotes are available.' }
  const evidence = context?.evidence ?? watchEvidence(config, samples, account, history)
  const allowed = account.allowed.filter(action => evidence.allowedActions.includes(action) && (!action.startsWith('open_') || !config.maxSpread || (samples.at(-1) && watchSpread(config, samples.at(-1)!))))
  const english = await englishJevInput(ctx, { instructions: config.instructions, name: config.strategyName ?? 'Custom strategy', referenceMaterial: config.referenceMaterial ?? '',
    criteria: { ...defaultActionCriteria, ...Object.fromEntries(Object.entries(config.actionCriteria ?? {}).filter(([, value]) => value)) } }, signal, context?.root)
  const allCriteria = english.criteria
  const criteria = Object.fromEntries(allowed.map(action => [action, allCriteria[action]]))
  const active = AbortSignal.any([signal, AbortSignal.timeout(30000)])
  active.throwIfAborted()
  const englishBody = englishJevBody({ model: 'jev-1.13.0', state: { contract: config.symbol, userConstraints: english.instructions, referenceMaterial: english.referenceMaterial,
        strategy: { name: english.name, decisionMode: config.decisionMode ?? 'strict', userGoal: english.instructions, actionCriteria: allCriteria, numericRules: config.rangeRules ?? config.signalRules ?? null,
          numericRulesRole: config.decisionMode === 'jev' ? 'Strategy references, not hard entry gates. Make your own evidence-based judgment.' : 'Enforced program entry gates.',
          version: createHash('sha256').update(JSON.stringify(config)).digest('hex').slice(0, 12) },
        hardLimits: { allowedActions: allowed, allowedSide: config.allowedSide ?? 'both', lotLimit: config.volume, maxSpread: config.maxSpread ?? 0,
          equityDropStop: config.maxEquityDrop,
          missingHistoryBlocksNewPositions: evidence.checks.some(check => check.id === 'history' && check.enforcement === 'hard'), humanConfirmationRequired: true },
        planPolicy: { minConfidence: config.minConfidence, humanConfirmationRequired: true, instruction: 'Select the best permitted action; the host applies this confidence threshold after your judgment.' },
        dataSummary: { barSeconds: history.barSeconds, barTimeMeaning: 'close', completedBars: evidence.history.count,
          historyValid: evidence.checks.find(check => check.id === 'history')?.state === 'pass', snapshotCount: samples.length,
          quoteWindowSeconds: evidence.features.quoteWindowSeconds, latestQuote: samples.at(-1) ?? null },
        evidence: englishEvidence(evidence, config.history?.datasetId), historicalBars: history.bars.filter(bar => bar.time <= evidence.evaluatedAt).slice(-(config.rangeRules?.lookbackBars ?? config.signalRules?.lookbackBars ?? 60)),
        lotLimit: config.volume, equityDropStop: config.maxEquityDrop, account, observedQuoteSnapshots: samples,
        evaluatedAt: Date.now(), dataLimit: 'Quote snapshots are NOT historical bars. Only historicalBars contains supplied completed bars; an empty array means unavailable. No external news is supplied. Use only observed evidence. Cost inputs are user assumptions, not guaranteed fills.' },
      questions: { ...watchAssessments, action: { type: 'choice', instructions: 'Choose ONE permitted futures simulation action using `strategy`, raw historicalBars, observedQuoteSnapshots, `evidence` and `account`. In jev mode, judge the opportunity yourself: numeric thresholds and reference checks are advisory, and an unmet reference alone must not preempt your assessment. In strict mode, hard strategy checks must pass. Always obey hardLimits and enforcement=hard checks. With incomplete history, evaluate the data gap and any permitted position exit; never open a new position. If only hold is permitted, return hold while independently assessing market, fit and blocker from the available data. Never invent observations or future returns. Questions are independent. A human must confirm each plan. User strategy: ' + english.instructions, criteria } } })
  let response: Response
  try {
    response = await request('https://api.typesafe.ai/v1/systemone', { method: 'POST', redirect: 'error', signal: active,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: englishBody,
    })
  } catch { throw new Error(active.aborted ? 'Jev 决策已取消或超时。' : 'Jev 连接失败。') }
  if (!response.ok) throw new Error(`Jev 请求失败（HTTP ${response.status}）。`)
  let body: unknown
  try { body = await response.json() } catch { throw new Error('Jev 响应无法解析。') }
  active.throwIfAborted()
  const parsed = z.object({ model: z.literal('jev-1.13.0'), answers: z.object({ action: z.object({ type: z.literal('choice'),
    choice: z.enum(actions), confidence: z.number().min(0).max(1), probabilities: z.record(z.string(), z.number().min(0).max(1)),
  }) }) }).safeParse(body)
  if (!parsed.success) throw new Error('Jev 决策不完整或无效。')
  const assessments = parseAssessments(record(body).answers)
  const answer = parsed.data.answers.action, keys = Object.keys(answer.probabilities)
  if (!allowed.includes(answer.choice) || keys.length !== allowed.length || keys.some(key => !allowed.includes(key as ContestWatchAction))
    || Math.abs(Object.values(answer.probabilities).reduce((a, b) => a + b, 0) - 1) > 0.01
    || answer.probabilities[answer.choice]! < Math.max(...Object.values(answer.probabilities))) throw new Error('Jev 返回了当前账户不允许的动作或无效概率。')
  const usage = jevUsageSchema.safeParse(record(body).usage)
  return { action: answer.choice, confidence: answer.confidence, probabilities: answer.probabilities, model: parsed.data.model, time: Date.now(), assessments, ...(usage.success ? { usage: usage.data } : {}) }
}

export class ContestWatcher {
  private templateWriting: Promise<unknown> = Promise.resolve()
  private async readTemplates(): Promise<ContestWatchTemplate[]> {
    try {
      const text = await readFile(join(this.contest.root, 'jev-templates.json'), 'utf8')
      if (text.length > 600000) throw new Error('模板文件过大。')
      return z.array(z.object({ name: z.string().trim().min(1).max(80), config: templateConfigSchema })).max(20).parse(JSON.parse(text)).map(item => ({ ...item, config: upgradeWatchStrategy(item.config) }))
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw new Error('已保存模板无法读取，请检查本机模板文件。') }
  }
  async templates(): Promise<ContestWatchTemplate[]> { await this.templateWriting.catch(() => {}); return this.readTemplates() }
  saveTemplate(input: ContestWatchTemplate): Promise<ContestWatchTemplate[]> {
    const operation = this.templateWriting.catch(() => {}).then(async () => {
      const parsed = z.object({ name: z.string().trim().min(1).max(80), config: templateConfigSchema }).strict().safeParse(input)
      if (!parsed.success) throw new Error('请填写模板名称、策略目标和有效参数；空白策略须补齐五种动作标准，品种、交易所与 tick 须一致。')
      const items = await this.readTemplates(), item = { ...parsed.data, config: upgradeWatchStrategy(parsed.data.config) }
      delete item.config.builtInTemplate
      item.config.strategyName = item.name
      if (item.config.autoHistory) delete item.config.history
      const next = [...items.filter(value => value.name !== item.name), item]
      if (next.length > 20) throw new Error('最多保存 20 个模板；使用已有名称可更新该模板。')
      await writeFileAtomic(join(this.contest.root, 'jev-templates.json'), JSON.stringify(next), { mode: 0o600, dirMode: 0o700 })
      return next
    })
    this.templateWriting = operation
    return operation
  }
  private state: ContestWatchStatus = { running: false, message: '尚未启动盯盘。', sampleCount: 0, planCount: 0, events: [] }
  private loading: Promise<void> | undefined
  private writing: Promise<void> = Promise.resolve()
  private controller = new AbortController()
  private timer: ReturnType<typeof setTimeout> | undefined
  private working = false
  private decisionTask: Promise<void> | undefined
  private configuring = false
  private sampleGeneration = 0
  private starting = false
  private stopping: Promise<ContestWatchStatus> | undefined
  private samples: Quote[] = []
  private lastPlanAt = 0
  private pendingPlanObserved = false
  private accountSnapshot: ContestInspection | undefined
  private accountCheckedAt = 0
  private retryCount = 0
  private historyCache: { at: number; value: ContestWatchHistory } | undefined
  constructor(private readonly ctx: Context, private readonly contest: ContestService,
    private readonly decide: typeof decideWithJev = decideWithJev) {}
  private async load() {
    await (this.loading ??= (async () => {
      try {
        const text = await readFile(join(this.contest.root, 'jev-watch.json'), 'utf8')
        if (text.length > 512000) throw new Error('盯盘记录过大。')
        const saved = JSON.parse(text) as ContestWatchStatus
        if (!saved || !Array.isArray(saved.events)) throw new Error('盯盘记录无效。')
        const upgraded = saved.config && upgradeWatchStrategy(saved.config)
        this.state = { ...saved, running: false, sampleCount: 0, samples: [],
          ...(upgraded ? { config: { ...upgraded, decisionIntervalSeconds: upgraded.decisionIntervalSeconds ?? 30, openingCooldownSeconds: upgraded.openingCooldownSeconds ?? 300 },
            strategyNotices: [...(upgraded !== saved.config ? ['已升级旧版内置策略说明；频率、参数与风控保持原值。'] : []), ...watchStrategyWarnings(upgraded)] } : {}),
          analyses: (saved.analyses ?? []).slice(-20).map(item => item.finishedAt ? item : { ...item, finishedAt: Date.now(), outcome: '服务已重启，本轮分析已中断。' }), events: saved.events.slice(-100),
          message: saved.running ? '服务已重启，盯盘未自动恢复；请检查待确认计划后手动启动。' : saved.message }
        delete this.state.nextDecisionAt
        delete this.state.openingCooldownUntil
        delete this.state.nextRetryAt
      } catch (error) { if (record(error).code !== 'ENOENT') throw error }
    })())
  }
  private save() {
    const text = JSON.stringify(this.state)
    const next = this.writing.catch(() => {}).then(() => writeFileAtomic(join(this.contest.root, 'jev-watch.json'), text, { mode: 0o600, dirMode: 0o700 }))
    this.writing = next; return next
  }
  private note(message: string) {
    this.state.message = message
    if (this.state.events.at(-1)?.message !== message) this.state.events = [...this.state.events, { time: Date.now(), message }].slice(-100)
  }
  async status(): Promise<ContestWatchStatus> { await this.load(); return structuredClone(this.state) }
  async configure(input: { apiKey?: string; translator?: { provider: string; model: string } }) {
    await this.load()
    if (this.state.running || this.starting || this.stopping || this.decisionTask || this.configuring) throw new Error('请先停止盯盘并等待当前操作结束，再配置 Jev。')
    this.configuring = true
    try { return await configureJev(this.ctx, input, auditedJevFetch(this.contest.root, 'connection-test'), this.contest.root) } finally { this.configuring = false }
  }
  async start(input: ContestWatchConfig): Promise<ContestWatchStatus> {
    await this.load()
    if (this.state.running || this.starting || this.stopping || this.working || this.decisionTask || this.configuring) throw new Error('盯盘或配置操作仍在运行，请勿重复启动。')
    if (typeof input?.symbol !== 'string' || !futuresContractPattern.test(input.symbol.trim())) throw new Error('请填写实际合约（如 m2701、MA701、IF2612、l2610F），不能使用品种简称或主力连续代码。')
    const tick = input.instrument?.tickSize ?? input.rangeRules?.tickSize ?? input.signalRules?.tickSize
    if (tick !== undefined && (!Number.isFinite(tick) || tick <= 0)) throw new Error('请填写该合约的最小价格变动（tick），必须大于 0；品种目录未提供参数时请按合约规格填写。')
    const parsed = configSchema.safeParse(input)
    if (!parsed.success) throw new Error('请检查实际合约、品种交易所及 tick、3–86400 秒的采样及决策间隔、0–3600 秒的开仓冷却、风控和策略条件；空白策略须填写目标及五种动作标准。')
    if (parsed.data.builtInTemplate === 'rb-range' && (!/^rb\d{4}$/i.test(parsed.data.symbol) || (parsed.data.autoHistory && parsed.data.autoHistory.exchange !== 'SHF'))) throw new Error('内置区间模板适用于螺纹钢 rb 合约。其他品种请在微调中核对交易所、tick 与成本，并保存为自己的模板。')
    this.starting = true
    const controller = new AbortController(); this.controller = controller
    try {
      const credential = await this.ctx.get('credentials')?.describe(credentialRef('TYPESAFE_API_KEY'))
      if (!credential?.configured) throw new Error('请在「设置 → 模型服务 → Jev」配置 API Key。')
      const identity = await this.contest.researchIdentity()
      const snapshot = await this.contest.inspect(identity, controller.signal), config = upgradeWatchStrategy(parsed.data)
      const account = watchAccount(snapshot, config)
      if (snapshot.pendingPlans.length || account.hasOpenOrders) throw new Error('请先处理待确认计划、未完成回执和活动委托。')
      let historyIssue: string | undefined
      if (config.autoHistory) {
        try { config.history = await prepareWatchHistory(this.ctx, { symbol: `${config.symbol.toUpperCase()}.${config.autoHistory.exchange}`, barSeconds: config.autoHistory.barSeconds }, controller.signal) }
        catch (error) {
          controller.signal.throwIfAborted()
          if (config.decisionMode !== 'jev') throw error
          delete config.history; historyIssue = error instanceof Error ? error.message : '历史行情准备失败。'
        }
      }
      controller.signal.throwIfAborted()
      const now = Date.now()
      this.state = { running: true, message: '', config, strategyNotices: watchStrategyWarnings(config), identity, runId: `jev-watch-${randomUUID()}`, startedAt: now,
        expiresAt: now + config.durationMinutes * 60000, equityBaseline: account.equity, sampleCount: 0, planCount: 0, openingPlanCount: 0, phase: 'sampling', samples: [], analyses: [], events: [] }
      this.samples = []; this.lastPlanAt = 0; this.pendingPlanObserved = false; this.sampleGeneration++
      this.historyCache = historyIssue ? { at: now, value: { source: 'PandaData', barSeconds: config.autoHistory!.barSeconds, bars: [], issue: historyIssue } } : undefined
      this.accountSnapshot = snapshot; this.accountCheckedAt = now; this.state.accountCheckedAt = now; this.retryCount = 0
      this.note(`已启动；先积累 ${config.minSamples ?? 8} 个有效行情快照，再由 Jev 决策。所有计划均需逐笔确认。`)
      if (historyIssue) this.note(`${historyIssue} 已进入 Jev 分析模式，历史恢复前禁止新开仓；继续采样并定期重试历史数据。`)
      await this.save()
      if (controller.signal.aborted) this.state.running = false
      else this.schedule(0)
      return structuredClone(this.state)
    } finally { this.starting = false }
  }
  private schedule(delay: number) {
    if (!this.state.running) return
    this.timer = setTimeout(() => { void this.tick().catch(() => { this.state.running = false; this.controller.abort(); this.note('盯盘状态无法保存，已停止。') }) }, Math.max(0, Math.min(delay, this.state.expiresAt! - Date.now())))
    this.timer.unref?.()
  }
  async stop(reason = '盯盘已停止；已提交的委托仍需在比赛计划中核对。'): Promise<ContestWatchStatus> {
    this.controller.abort(); clearTimeout(this.timer)
    return this.stopping ??= this.finishStop(reason).finally(() => { this.stopping = undefined })
  }
  private async finishStop(reason: string): Promise<ContestWatchStatus> {
    await this.load(); this.state.running = false; delete this.state.nextDecisionAt; delete this.state.nextRetryAt; delete this.state.openingCooldownUntil; this.note(reason)
    const { lastPlanId, runId } = this.state
    await this.save()
    if (lastPlanId && runId) {
      try { await this.contest.dismiss(lastPlanId, runId) }
      catch { this.note('盯盘已停止；计划状态未能核对，请在比赛计划中人工检查。'); await this.save() }
    }
    return structuredClone(this.state)
  }
  private retryRead(error: unknown): boolean {
    if (!(error instanceof ContestCliError) || !transientContestCodes.has(error.code)) return false
    const seconds = Math.min(300, 30 * 2 ** Math.min(this.retryCount++, 4))
    this.accountSnapshot = undefined; this.samples = []; this.sampleGeneration++
    this.state.samples = []; this.state.sampleCount = 0; this.state.phase = 'waiting_quote'
    this.state.nextRetryAt = Date.now() + seconds * 1000
    this.note(`柜台读取暂不可用（${error.code}）；${seconds} 秒后重试，恢复后重新积累样本。`)
    return true
  }
  async tick(): Promise<void> {
    if (!this.state.running || this.working) return
    clearTimeout(this.timer)
    this.working = true
    const started = Date.now(), signal = this.controller.signal, config = this.state.config!, identity = this.state.identity!, runId = this.state.runId!
    const check = () => { signal.throwIfAborted(); if (!this.state.running || this.state.runId !== runId) throw new Error('盯盘已停止。') }
    try {
      check()
      if (Date.now() >= this.state.expiresAt!) { await this.stop('已达到本次运行时长，盯盘停止。'); return }
      if (Date.now() < (this.state.nextRetryAt ?? 0)) return
      const local = await this.contest.status(); check()
      const pendingPlans = local.plans.filter(plan => ['prepared', 'executing', 'queued', 'submitted', 'unknown'].includes(plan.status))
      const plansResolved = this.pendingPlanObserved && pendingPlans.length === 0
      this.pendingPlanObserved = pendingPlans.length > 0
      if (!this.accountSnapshot || plansResolved || Date.now() - this.accountCheckedAt >= 30000) {
        this.accountSnapshot = await this.contest.inspect(identity, signal); check()
        this.accountCheckedAt = Date.now(); this.state.accountCheckedAt = this.accountCheckedAt
      }
      const snapshot = { ...this.accountSnapshot, pendingPlans }
      const account = watchAccount(snapshot, config, this.state.equityBaseline)
      const unresolved = snapshot.pendingPlans.find(plan => ['executing', 'queued', 'submitted', 'unknown'].includes(plan.status))
      if (unresolved) {
        if (unresolved.status === 'unknown') throw new Error('存在待核实回执，盯盘已暂停；请勿重复下单。')
        this.sampleGeneration++
        this.state.phase = 'waiting_plan'
        await this.contest.reconcile(unresolved.id, unresolved.sessionId); check()
        this.note('等待已提交计划的回执；暂不生成新计划。'); return
      }
      if (snapshot.pendingPlans.length || account.hasOpenOrders) { this.sampleGeneration++; this.state.phase = 'waiting_plan'; this.note('等待计划确认、取消或活动委托处理；暂不生成新计划。'); return }
      if (account.volume === 0 && (this.state.openingPlanCount ?? 0) >= config.maxPlans) {
        this.state.phase = 'sampling'; this.note('已达到本次开仓计划上限；继续检查持仓，已有持仓仍可评估平仓。'); return
      }
      const data = await this.contest.query({ kind: 'quote', symbol: config.symbol }, identity, signal); check()
      if (Date.now() < (this.state.nextRetryAt ?? 0)) return
      this.retryCount = 0; delete this.state.nextRetryAt
      this.state.lastQuoteCheckedAt = Date.now()
      const { quote, issue } = watchQuote(data.data, config.symbol, Date.now(), config.instrument?.exchange ?? config.autoHistory?.exchange)
      if (!quote) { this.samples = []; this.sampleGeneration++; this.state.samples = []; this.state.sampleCount = 0; this.state.phase = 'waiting_quote'; this.note(`${issue} 有效行情恢复后重新积累样本。`); return }
      const previous = this.samples.at(-1)
      if (previous && quote.time <= previous.time) { if (!this.decisionTask) { this.state.phase = 'waiting_quote'; this.note('行情时间未更新，等待下一次有效快照。') } return }
      if (previous && quote.time - previous.time > (config.intervalSeconds * 3 + 90) * 1000) { this.samples = []; this.sampleGeneration++ }
      this.samples = [...this.samples, quote].slice(-60); this.state.sampleCount = this.samples.length
      this.state.samples = this.samples
      if (this.decisionTask) return
      this.state.phase = 'sampling'
      if (this.samples.length < (config.minSamples ?? 8)) { this.note(`采样中：${this.samples.length}/${config.minSamples ?? 8} 个有效行情快照。`); return }
      if (account.volume === 0 && this.lastPlanAt && Date.now() < (this.state.openingCooldownUntil ?? 0)) { this.note('开仓冷却期内，继续采样；持仓平仓判断不受影响。'); return }
      if (Date.now() < (this.state.nextDecisionAt ?? 0)) { this.note('继续采样，等待下一次 Jev 决策。'); return }
      if (Date.now() >= this.state.expiresAt!) { await this.stop('已达到本次运行时长，盯盘停止。'); return }
      this.decisionTask = this.analyze(account, this.samples, this.sampleGeneration).catch(() => {
        this.state.running = false; this.controller.abort(); clearTimeout(this.timer); this.note('盯盘状态无法保存，已停止。')
      }).finally(() => { this.decisionTask = undefined })
    } catch (error) {
      if (!signal.aborted && !this.retryRead(error)) { this.state.running = false; this.controller.abort(); this.note(error instanceof Error ? error.message : '盯盘失败，已暂停。') }
    } finally {
      try { await this.save() } finally { this.working = false }
      if (this.state.running && this.state.runId === runId && !signal.aborted) this.schedule(Math.max(0, (this.state.nextRetryAt ?? started + config.intervalSeconds * 1000) - Date.now()))
    }
  }
  private async analyze(account: ReturnType<typeof watchAccount>, samples: Quote[], generation: number): Promise<void> {
    const signal = this.controller.signal, config = this.state.config!, identity = this.state.identity!, runId = this.state.runId!
    const check = () => { signal.throwIfAborted(); if (!this.state.running || this.state.runId !== runId) throw new Error('盯盘已停止。') }
    const analysis: ContestWatchAnalysis = { id: randomUUID(), startedAt: Date.now(), sampleCount: samples.length,
      strategyName: config.strategyName ?? '自定义策略', strategyVersion: createHash('sha256').update(JSON.stringify(config)).digest('hex').slice(0, 12),
      fromTime: samples[0]!.time, toTime: samples.at(-1)!.time, price: samples.at(-1)!.price, allowedActions: [...account.allowed], outcome: '等待 Jev 响应。' }
    this.state.analyses = [...(this.state.analyses ?? []), analysis].slice(-20)
    this.state.nextDecisionAt = analysis.startedAt + (config.decisionIntervalSeconds ?? 30) * 1000
    this.state.phase = 'deciding'; this.note('Jev 正在分析已采集的行情快照；行情采样继续运行。')
    const finish = (message: string) => { analysis.outcome = message; this.note(message) }
    let preparing = false
    try {
      if (!this.historyCache || Date.now() - this.historyCache.at >= (this.historyCache.value.issue ? 30000 : 60000)) {
        let value: ContestWatchHistory
        try {
          if (config.autoHistory && !config.history) config.history = await prepareWatchHistory(this.ctx, { symbol: `${config.symbol.toUpperCase()}.${config.autoHistory.exchange}`, barSeconds: config.autoHistory.barSeconds }, signal)
          value = await watchHistory(this.ctx, config, signal); check()
        } catch (error) {
          check()
          if (config.decisionMode !== 'jev') throw error
          value = { source: 'PandaData', barSeconds: config.autoHistory?.barSeconds ?? 60, bars: [], issue: error instanceof Error ? error.message : '历史行情读取失败。' }
        }
        this.historyCache = { at: Date.now(), value }
      }
      const history = this.historyCache.value, evidence = watchEvidence(config, samples, account, history)
      analysis.evidence = evidence; analysis.allowedActions = evidence.allowedActions
      if (generation !== this.sampleGeneration) { finish('准备资料期间状态变化，等待重新采样。'); return }
      if (config.decisionMode !== 'jev' && evidence.allowedActions.every(action => action === 'hold')) {
        finish('程序条件未满足，未请求 Jev：' + (evidence.checks.filter(item => item.actions.length && item.state !== 'pass').slice(0, 3).map(item => `${item.label}（${item.detail}）`).join('；') || '当前账户或价差约束不允许新动作。') + ' 完整条件见本轮检查。')
        return
      }
      const decision = await this.decide(this.ctx, config, samples, { ...account, allowed: evidence.allowedActions }, signal, auditedJevFetch(this.contest.root, 'watch'), { evidence, history, root: this.contest.root }); check()
      analysis.responseAt = Date.now(); analysis.decision = decision; this.state.lastDecision = decision
      if (Date.now() >= this.state.expiresAt!) { await this.stop('已达到本次运行时长，盯盘停止。'); analysis.outcome = '运行时长已到，本次决策未生成计划。'; return }
      if (generation !== this.sampleGeneration) { finish('分析期间行情或账户状态变化，本次结果已丢弃，等待有效样本。'); return }
      this.state.phase = 'checking'
      analysis.planStatus = decision.action === 'hold' ? 'hold' : 'candidate'
      analysis.reviewNotes = watchStrategyWarnings(config)
      if (decision.action.startsWith('open_') && decision.assessments && (decision.assessments.fit.choice !== 'supported' || decision.assessments.blocker.choice !== 'none')) {
        analysis.reviewNotes.push('最终动作与独立分项判断不一致，请在确认计划前复核。')
        if (config.decisionMode !== 'jev') { analysis.planStatus = 'blocked'; finish('Jev 动作与分项判断冲突，本轮不生成开仓计划；请查看分项输出。'); return }
      }
      if (decision.action === 'hold' && Object.keys(decision.probabilities).length === 1) {
        analysis.planStatus = 'restricted'
        const reason = evidence.checks.filter(item => item.enforcement === 'hard' && item.actions.length && item.state !== 'pass').map(item => `${item.label}（${item.detail}）`).join('；') || '当前账户或价差约束不允许其他动作。'
        finish(`受限观望 · 置信度不适用：${reason}；本轮只有观望可选，未生成交易计划。`); return
      }
      if (decision.action === 'hold') { finish('Jev 主动选择观望；本轮未生成交易计划。'); return }
      if (decision.confidence < config.minConfidence) { finish(`候选建议：${labels[decision.action]}；置信度 ${(decision.confidence * 100).toFixed(1)}% 未达到计划门槛 ${(config.minConfidence * 100).toFixed(0)}%，未生成可执行计划。`); return }
      analysis.planStatus = 'blocked'
      const fresh = await this.contest.inspect(identity, signal); check()
      this.accountSnapshot = fresh; this.accountCheckedAt = Date.now(); this.state.accountCheckedAt = this.accountCheckedAt
      const current = watchAccount(fresh, config, this.state.equityBaseline)
      if (current.hasOpenOrders || fresh.pendingPlans.length || !current.allowed.includes(decision.action)) { finish('账户状态已变化，放弃本次决策，等待重新采样。'); return }
      const latest = watchQuote((await this.contest.query({ kind: 'quote', symbol: config.symbol }, identity, signal)).data, config.symbol, Date.now(), config.instrument?.exchange ?? config.autoHistory?.exchange); check()
      this.state.lastQuoteCheckedAt = Date.now()
      if (!latest.quote) { this.state.phase = 'waiting_quote'; finish(`生成计划前：${latest.issue} 本次不操作。`); return }
      if (generation !== this.sampleGeneration || Date.now() - decision.time > 60000 || Date.now() >= this.state.expiresAt!) { finish('生成计划前行情状态变化或决策已过期，本次不操作。'); return }
      const opening = decision.action.startsWith('open_')
      if (opening && ((this.state.openingPlanCount ?? 0) >= config.maxPlans || Date.now() < (this.state.openingCooldownUntil ?? 0))) { finish('开仓冷却或开仓计划数量限制，本次不生成开仓计划。'); return }
      if (opening && !watchSpread(config, latest.quote)) { finish('最新买卖价差不满足开仓上限，本次不生成计划。'); return }
      const verified = watchEvidence(config, [...samples.filter(item => item.time < latest.quote.time), latest.quote].slice(-60), current, history)
      if (!verified.allowedActions.includes(decision.action)) { finish('最新行情已不满足程序条件（数据有效性或严格规则），本次不生成计划。'); return }
      const order: ContestOrder = { symbol: config.symbol, volume: opening ? config.volume : Math.min(config.volume, current.closable),
        direction: ['open_long', 'close_short'].includes(decision.action) ? 'buy' : 'sell', offset: opening ? 'open' : 'close' }
      preparing = true
      const plan = await this.contest.prepare({ sessionId: runId, operation: 'place_order', order }, identity, signal)
      if (signal.aborted || !this.state.running || this.state.runId !== runId || generation !== this.sampleGeneration || Date.now() >= this.state.expiresAt!) {
        await this.contest.dismiss(plan.id, runId); analysis.outcome = '生成期间运行状态发生变化，计划已取消。'; return
      }
      if (!sameSymbol(record(plan.details.parameters).contractCode, config.symbol, config.instrument?.exchange ?? config.autoHistory?.exchange)) {
        await this.contest.dismiss(plan.id, runId); throw new Error('预演合约与盯盘合约不符，计划已取消。')
      }
      this.state.lastPlanId = plan.id; this.state.planCount++; this.lastPlanAt = Date.now()
      this.pendingPlanObserved = true
      if (opening) this.state.openingPlanCount = (this.state.openingPlanCount ?? 0) + 1
      this.state.openingCooldownUntil = this.lastPlanAt + (config.openingCooldownSeconds ?? 300) * 1000
      analysis.planId = plan.id
      analysis.planStatus = 'prepared'
      this.state.phase = 'waiting_plan'
      finish(`Jev ${labels[decision.action]}，已生成计划 ${plan.id}；请在比赛计划中核对并确认。`)
    } catch (error) {
      analysis.outcome = signal.aborted ? '盯盘已停止，本轮分析已取消。' : error instanceof Error ? error.message : 'Jev 分析失败，已暂停。'
      if (!signal.aborted && !preparing && this.retryRead(error)) analysis.outcome = this.state.message
      else if (!signal.aborted) { this.state.running = false; this.controller.abort(); clearTimeout(this.timer); this.note(analysis.outcome) }
    } finally {
      analysis.finishedAt = Date.now()
      if (this.state.phase === 'checking' || this.state.phase === 'deciding') this.state.phase = 'sampling'
      await this.save()
    }
  }
  dispose(): void { this.controller.abort(); clearTimeout(this.timer) }
}
