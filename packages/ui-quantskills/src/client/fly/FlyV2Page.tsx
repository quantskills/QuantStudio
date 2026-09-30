import { GearSixIcon, RobotIcon } from '@phosphor-icons/react'
import { futuresProduct, futuresContractPattern, products } from '@deepseek-ai/dsh-quantskills-session/contracts'
import { TradingEngineSettings, type TradingEngineConfig } from './TradingEngineSettings.tsx'
import { FlyInstruments } from './FlyInstruments.tsx'
import { TradingSettingsNavigation } from '../TradingNavigation.tsx'
import { ExecutionModeChoice, ExecutionDisclosure, AUTOMATIC_TRADING_CONSENT, type TradingExecutionMode } from '../TradingExecution.tsx'
import { ActionDialog } from '../ActionDialog.tsx'
import { FlyMarketView } from './FlyMarketView.tsx'
import { FlyContractList } from './FlyContractList.tsx'
import { TradingGuide } from '../TradingGuide.tsx'
import { flyFetch } from './transport.ts'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { BodyState } from './FlyHomeV2'
import { FlyReplayLab } from './FlyReplay.tsx'
import './fly-v2.css'
import { collapseNeuralWaits } from './flyJournal'
import { lifeGoals } from './LifeTrace'
import { type TradeMarket } from './TradeLoop'
import { TradeStatistics } from './TradeStatistics'
import { TraderOverview, type TraderActivity } from './TraderOverview.tsx'
import { TradeLearning } from './TradeLearning'
import { TradeAnalytics } from './TradeAnalytics'
import { RuntimeContinuity, type Continuity } from './RuntimeContinuity'
import { TradeFilterControls, type TradeFilterSettings } from './TradeFilterControls'
import { waitForCompetition } from '../competition-async.ts'
import type { ContestAccess } from '../contest.ts'
import type { ContestStatus } from '../plugin-types.ts'
import './fly-workspace.css'
import './trader-overview.css'
import { FlyHistory, useRetryCountdown, type HistoryStatus } from './FlyHistory.tsx'

type Settings = TradingEngineConfig & TradeFilterSettings & { execution_mode?: TradingExecutionMode; instruments: { product: string; symbol: string; exchange: string }[]; name: string; account: string; target_notional: number; total_notional: number; loss_limit: number; jev_daily_calls: number; ai_daily_calls: number; scenes_daily: number; model_calls_unlimited: boolean; ai_provider: string; jev_provider: 'typesafe'; jev_enabled: boolean; learning: boolean; life_validation: boolean; onboarding_complete: boolean }
type Event = { seq: number; at: number; actor: string; kind: string; decision_id: string; payload: Record<string, any>; merged_count?: number }
type Market = TradeMarket & { product: string; symbol?: string; price?: number; count: number; readiness: string; chart: number[]; long: number; short: number; history_source?: { at?: number | null; error?: string }; allocation?: { lots: number; target_notional: number; actual_notional: number; deviation_pct: number } }
type Status = Continuity & { history?: HistoryStatus; binding?: { identity: { contestId: string; accountId: string } } | null; trade_events?: Event[]; history_error?: string; connection?: { status: string; message: string; retry_at?: number | null; updated_at?: number }; name: string; settings: Settings; control: { paused: boolean; trading: boolean; close_only?: boolean }; neural: { status: string; message?: string; total_spikes?: number; activity?: Record<string, number>; sim_ms?: number; updates?: Record<string, number>; life_controller?: {interface: string; readout_neurons: number}; motor_controller?: {interface: string; readout_neurons: number}; motor?: {drive: number; turn: number; confidence: number; active_readout_neurons: number; reason: string}; sensory?: {visible_food: number; sector: number} }; world: BodyState; home: { name: string }; home_version: string; markets: Market[]; usage: Record<string, number>; events: Event[]; account?: Record<string, any>; runtime?: Record<string, any>; accounts: { name: string }[]; checkpoints: string[]; environment: { brain_ready: boolean; progress: { status: string; stage?: string; message?: string; done?: number; total?: number } }; onboarding: boolean; versions: { id: string; name: string }[]; scene_jobs: { id: string; status: string; description: string; error?: string; attempt: number }[] }
const goals: Record<string, string> = { idle: '没有有效目标', forage: '神经感知与取食', observe: '观察市场', explore: '探索家园', eat: '享用果实', rest: '主动休息', interact: '物件互动' }
const environmentNames: Record<string, string> = { daylight: '日光', breeze: '微风', quiet: '安静', dew: '露水', replenish: '补充果实' }
const actors: Record<string, string> = { fly: 'AI 交易员决定', jev: 'Jev 辅助', user: '用户影响', counter: '柜台回报', language_ai: '语言 AI', execution: '交易执行', system: '系统', reporter: '事实报告', scene_builder: '家园构建' }
const names: Record<string, string> = Object.fromEntries(products.map(p => [p.exchange === 'CFE' ? p.product.toUpperCase() : p.product, p.name]))
const fmt = (v?: number | null) => v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await flyFetch(`/api/fly/v2/${path}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const result = await response.json(); if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : '请求未完成，请检查输入')
  return result
}
function eventText(e: Event) {
  const p = e.payload
  if (e.kind === 'model_call' && p.provider === 'jev' && p.status === 'ok') return p.purpose === 'connection_test' ? 'Jev 连接测试通过' : `Jev 返回建议：${environmentNames[p.event] || p.event}；实际效果见执行记录`
  if (e.kind === 'model_call') return `${p.provider === 'codex_cli' ? 'Codex CLI' : p.provider === 'jev' ? (p.service_provider === 'vercel' ? 'Jev · Vercel' : 'Jev · TypeSafe') : p.provider === 'trade_model' ? '交易模型' : '语言 AI'} · ${p.status === 'ok' ? '调用完成' : '调用未完成'}${p.reason ? ' · ' + p.reason : ''}`
  if (e.kind === 'oracle_interpretation' && p.application === 'memory_only') return `神谕 #${p.source_seq} 已存入偏好记忆；当前运动闭环不直接改动作分数`
  if (e.kind === 'decision' && p.life_response) return `神经目标：${lifeGoals[p.choice.action] || p.choice.action} · ${p.motor.drive ? '已形成运动指令' : p.choice.action === 'rest' ? '恢复精力' : '身体停留'} · 读出层选择，无随机抽签`
  if (e.kind === 'reward' && p.evidence?.outcome === 'life_episode') return `${lifeGoals[p.evidence.goal]}完成 · 移动 ${Number(p.evidence.distance).toFixed(2)} m · 取食 ${p.evidence.meals.length} 次 · 反馈 ${Number(p.reward).toFixed(3)}`
  if (e.kind === 'decision' && p.motor) return p.motor.drive ? `神经运动：${p.motor.turn < -.1 ? '左转' : p.motor.turn > .1 ? '右转' : '向前'} · ${p.motor.active_readout_neurons} 个读出神经元放电` : `${p.wait_reason?.message || (p.sensory?.visible_food === 0 ? '果盘已吃空，没有食物线索' : '神经响应暂未形成运动指令')}${e.merged_count ? `（合并最近 ${e.merged_count} 次感知）` : ''}`
  if (e.kind === 'oracle_interpretation') return `${p.interpreter === 'language_ai' ? '语言模型' : '本地关键词'}已理解神谕 #${p.source_seq}，形成生活偏好`
  if (e.kind === 'life_interrupted') return p.reason
  if (e.kind === 'decision') return p.head === 'life' ? `选择${goals[p.choice.action] || p.choice.action}` : `${p.product} · ${({ WAIT: '等待', LONG: '开多', SHORT: '开空', CLOSE: '平仓' } as Record<string, string>)[p.choice.action] || p.choice.action}`
  if (e.kind === 'execution_gate') return `${p.product} · ${p.message}`
  if (e.kind === 'trade') return `${p.symbol} · ${p.volume} 手 · 成交价 ${p.price}`
  if (e.kind === 'oracle') return p.text
  if (e.kind === 'environment_assistance') return p.status === 'not_applied' ? `Jev 未执行：${p.reason}` : p.status === 'no_change' ? `Jev 无新变化：已经是${environmentNames[p.event] || p.event}${p.cached ? '（复用缓存）' : ''}` : `Jev 已执行：${environmentNames[p.before] || p.before || ''} → ${environmentNames[p.event] || p.event}${p.target ? ' · 物件 ' + p.target : ''}${p.cached ? '（复用缓存）' : ''}`
  if (e.kind === 'environment_recovery') return `家园环境：${(p.objects || []).map((o: {name: string}) => o.name).join('、')}的果实重新成熟；等待神经重新感知`
  if (e.kind === 'report') return p.text
  if (e.kind === 'reward' && p.evidence?.outcome === 'neural_contact_feeding') return `接触取食完成 · ${p.evidence.target} · 已记录神经动作与接触位置`
  if (e.kind === 'reward') return `${p.head === 'life' ? '生活' : '交易'}反馈 ${Number(p.reward).toFixed(3)} · ${p.evidence?.outcome || '柜台结果'}`
  if (e.kind === 'learning_deferred') return p.reason
  if (e.kind === 'learning_update') return p.applied ? (p.scope === 'life_readout_only' ? '生活读出层已学习实际反馈；连接组冻结' : '决策层已学习这次反馈') : (p.reason || '反馈已记录，参数保持冻结')
  return p.message || p.error || p.description || p.action || ({ checkpoint_saved: '检查点已保存', organism_started: '个体开始运行', binding_created: '比赛账户已绑定' } as Record<string, string>)[e.kind] || e.kind
}

export default function FlyV2Page({ active, contest, openContest, openModelSettings, preparing = false, prepareMessage, onPrepare, tradePlans, initialTab = 'dashboard' }: {
  initialTab?: 'dashboard' | 'analysis' | 'talk';
  openContest?: (() => void) | undefined; tradePlans?: ReactNode; active: boolean; contest?: Pick<ContestAccess, 'query' | 'status' | 'mode' | 'connect'> | undefined; openModelSettings?: (() => void) | undefined; preparing?: boolean; prepareMessage?: string | undefined; onPrepare?: (() => Promise<unknown>) | undefined
}) {
  const [status, setStatus] = useState<Status>()
  const [tab, setTab] = useState<'dashboard' | 'talk' | 'replay' | 'analysis'>(initialTab)
  const [error, setError] = useState(''); const [pending, setPending] = useState(false)
  const [setupError, setSetupError] = useState('')
  const connectionCooldown = useRetryCountdown(status?.connection?.retry_at)
  const [setup, setSetup] = useState(false); const [step, setStep] = useState(2)
  const [details, setDetails] = useState(false), [selected, setSelected] = useState(''), [startReview, setStartReview] = useState(false)
  const [marketOpen, setMarketOpen] = useState(false)
  const [riskAccepted, setRiskAccepted] = useState(false)
  useEffect(() => setRiskAccepted(false), [JSON.stringify(status?.settings), JSON.stringify(status?.binding)])
  const [contestStatus, setContestStatus] = useState<ContestStatus>(), [contestError, setContestError] = useState('')
  const contestRevision = useRef(0)
  const accountKey = contestStatus?.enabled && contestStatus.phase === 'connected' && contestStatus.identity ? JSON.stringify(contestStatus.identity) : ''
  const [draft, setDraft] = useState<Settings>()
  const [models, setModels] = useState<{ profiles: { provider_id: string; label: string; configured: boolean }[]; jev_configured: boolean; jev_providers: { id: string; label: string; model: string; configured: boolean }[] }>()
  const [oracle, setOracle] = useState('')
  const [report, setReport] = useState(''); const [filter, setFilter] = useState('all')
  const loaded = useRef(false)
  const tradingRef = useRef<HTMLDivElement>(null)
  function showTrading() {
    setTab('dashboard')
    requestAnimationFrame(() => { tradingRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); tradingRef.current?.focus({ preventScroll: true }) })
  }
  useEffect(() => {
    if (!active || !setup || !contest) return
    const revision = ++contestRevision.current, controller = new AbortController()
    setContestStatus(undefined); setContestError('')
    void waitForCompetition(() => contest.status(), '比赛账户状态读取', 15_000, controller.signal)
      .then(value => { if (revision === contestRevision.current) setContestStatus(value) })
      .catch(error => { if (revision === contestRevision.current) setContestError(String(error).replace(/^(?:Error|RemoteFailure): /, '')) })
    return () => { contestRevision.current++; controller.abort() }
  }, [active, setup, contest])
  useEffect(() => {
    if (!active) return
    let disposed = false; let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const result = await waitForCompetition(() => api<Status>('state'), 'AI 交易员状态读取', 15_000)
        if (!disposed) {
          setStatus(result)
          if (!loaded.current) { loaded.current = true; setDraft(result.settings); setSetup(false) }
        }
      } catch (error) { if (!disposed) setError(String(error)) }
      finally { if (!disposed) timer = setTimeout(() => void poll(), 1000) }
    }
    void poll()
    void api<typeof models>('models').then(value => { if (!disposed) setModels(value) }).catch(error => { if (!disposed) setError(String(error)) })
    return () => { disposed = true; clearTimeout(timer) }
  }, [active])
  async function run(fn: () => Promise<unknown>) {
    setPending(true); setError(''); setSetupError(''); try { await fn() } catch (e) {
      const message = String(e).replace(/^(?:Error|RemoteFailure): /, '')
      if (setup) setSetupError(message); else setError(message)
    } finally { setPending(false) }
  }
  async function control(action: string, version = '', execution_consent?: string) { await api('control', { action, version, ...(execution_consent ? { execution_consent } : {}) }) }
  async function connectContestAccount() {
    if (!contest) throw new Error('比赛账户服务尚未连接，请重启 QuantStudio。')
    const revision = ++contestRevision.current
    setContestError('')
    const result = await waitForCompetition(async signal => {
      const current = await contest.status()
      signal.throwIfAborted()
      if (current.enabled && current.phase === 'connected' && current.identity) return current
      if (!current.enabled) await contest.mode(true)
      signal.throwIfAborted()
      return contest.connect()
    }, '比赛账户连接', 600_000)
    if (revision !== contestRevision.current) return
    setContestStatus(result)
    if (!result.enabled || result.phase !== 'connected' || !result.identity) throw new Error(result.message || '比赛账户尚未连接完成，请重试。')
  }
  function openSetup() { if (status) setDraft(structuredClone(status.settings)); setSetupError(''); setSetup(true); setStep(5) }
  function checkInstruments(): boolean {
    const invalid = draft?.instruments.filter(item => !futuresContractPattern.test(item.symbol.trim())) ?? []
    if (!invalid.length) return true
    setSetupError(`请为已选品种填写实际合约代码（如 rb2610），或取消勾选：${invalid.map(item => names[item.product] || item.product).join('、')}`)
    setStep(2)
    return false
  }
  if (!status) return <div className="fv-page fv-loading"><div className="fv-orbit">✦</div><h2>正在连接 AI 交易员</h2><p>{error || '恢复交易状态…'}</p></div>
  const s = status
  const isLLM = s.settings.decision_engine === 'llm'
  const executionMode = s.settings.execution_mode ?? 'automatic'
  const automatic = executionMode === 'automatic'
    const events = collapseNeuralWaits(s.events).filter(e => filter === 'all' || e.actor === filter).reverse()
  const issueList = (value: Settings) => {
    const issues: { key: string; label: string; step: number }[] = []
    if (value.decision_engine !== 'llm' && !s.environment.brain_ready) issues.push({ key: 'environment', label: '准备神经运行环境', step: 0 })
    if (value.decision_engine === 'llm') {
      if (!value.trade_model || (models && !models.profiles.some(m => m.provider_id === value.trade_model))) issues.push({ key: 'trade_model', label: '选择可用的交易模型', step: 5 })
      if (!value.trade_instructions?.trim()) issues.push({ key: 'trade_instructions', label: '填写交易要求', step: 5 })
      if (!Number.isInteger(value.llm_max_lots) || (value.llm_max_lots ?? 0) < 1 || (value.llm_max_lots ?? 0) > 500) issues.push({ key: 'llm_max_lots', label: '单合约手数须为 1–500 的整数', step: 5 })
      if (!Number.isInteger(value.trade_daily_calls) || (value.trade_daily_calls ?? -1) < 0 || (value.trade_daily_calls ?? 0) > 100000) issues.push({ key: 'trade_daily_calls', label: '模型调用上限须为 0–100000 的整数', step: 5 })
    }
    if (!(accountKey || (s.binding && s.connection?.status !== 'needs_auth'))) issues.push({ key: 'account', label: '连接比赛账户', step: 2 })
    if (!value.instruments.length || value.instruments.some(i => !futuresContractPattern.test(i.symbol) || futuresProduct(i.symbol) !== i.product.toLowerCase())) issues.push({ key: 'instruments', label: '选择品种并填写有效实际合约', step: 2 })
    for (const [key, label, max] of [['target_notional', '每品种名义上限', 100000000], ['total_notional', '总名义占用上限', 500000000], ['loss_limit', '账户损失上限', 100000000]] as const) {
      if (!Number.isFinite(value[key]) || value[key] < 0) issues.push({ key, label: `设置${label}（0 表示不额外限制）`, step: 4 })
      else if (value[key] > max) issues.push({ key, label: `${label}不能超过 ${max.toLocaleString('zh-CN')} 元`, step: 4 })
    }
    if (value.total_notional > 0 && value.target_notional > value.total_notional) issues.push({ key: 'total_notional', label: '总名义占用上限不能小于每品种名义上限', step: 4 })
    return issues
  }
  const missing = issueList(s.settings), draftIssues = draft ? issueList(draft) : []
  const canStart = !s.settings.life_validation && !missing.length
  function configureAt(index: number) { openSetup(); setStep(index) }
  function checkSetup() {
    if (!checkInstruments()) return false
    if (draft?.decision_engine !== 'llm' && !s.environment.brain_ready) { setSetupError('请先准备神经运行环境'); setStep(0); return false }
    if (!draft?.life_validation && draftIssues.length) {
      setSetupError(draftIssues.map(i => i.label).join('；')); setStep(draftIssues[0]!.step)
      return false
    }
    return true
  }
  async function saveSetup(later = false) {
    if (!draft || (later ? !checkInstruments() : !checkSetup())) return
    const saved = await api<Settings>('settings', { ...draft, onboarding_complete: !later })
    setStatus({ ...s, settings: saved }); setDraft(saved)
    if (!later && !draft.life_validation && (s.onboarding || s.settings.life_validation)) { setRiskAccepted(false); setStartReview(true) }
    else if (!later && s.onboarding) await control('start')
    setSetup(false); setTab('dashboard')
  }
  const guide = <TradingGuide compact name="AI 交易员" steps={[
      { title: '选择决策方式', status: isLLM ? '使用 QS 大模型' : s.environment.brain_ready ? '神经环境已就绪' : '运行环境待准备', ready: isLLM ? !!s.settings.trade_model : s.environment.brain_ready,
        body: '打开「交易设置 → 决策引擎」。大模型模式选择 QS 已配置的模型，再写几句交易要求；神经模式先准备本地神经环境。两种引擎都支持逐笔确认或自动下单。',
        note: '大模型模式直接使用 QS 模型服务，无需安装神经依赖。', action: { label: '选择决策方式', run: () => configureAt(5) } },
      { title: '连接账户与合约', status: s.settings.instruments.length ? `已保存 ${s.settings.instruments.length} 个合约 · 仍需核对行情` : '账户与合约待设置',
        body: '在设置中连接期货模拟赛账户，再选择品种并核对实际合约月份。可搜索全部品种或手动填写其他合约。初次先选一个熟悉的品种，便于观察行情、信号与回执是否连贯。',
        note: '实时报价来自比赛柜台，历史数据需先到「设置 → PandaData」连接授权。合约代码示例不代表当前可交易月份。名义金额不是保证金；额外风险上限填 0 表示不额外限制，请根据模拟账户资金设置。', action: { label: '设置账户、合约与限额', run: () => configureAt(2) } },
      { title: '启动自动交易', status: s.control.trading ? s.connection?.status === 'ready' ? '自动交易已启用' : '已启用 · 等待行情' : '自动交易未启用', ready: s.control.trading && s.connection?.status === 'ready',
        body: '在「运行与额度」选择执行方式。完成设置后核对启动范围；自动下单须确认风险。修改设置只保存，回到交易页启动。先观察行情就绪、决策原因和回执状态。',
        note: '按所选引擎生成决策。大模型会产生 API 用量，调用失败会显示原因并等待下一轮，不会切换成神经信号。独立的 Jev 盯盘仍在比赛页。', action: { label: '检查完成前的配置', run: () => configureAt(3) } },
      { title: '查看回执与暂停', status: automatic ? '信号触发后自动提交' : '信号触发后等待确认',
        body: '信号满足条件后，逐笔确认模式等待你核对计划；自动模式通过 CLI 提交。在「交易计划与回执」查看合约、手数与成交。',
        note: '「暂停自动交易」停止后续新委托，不撤单、不平仓。关闭浏览器不代表后台停止；要停止请使用页面控制，并检查已有委托和持仓。', action: { label: '查看交易状态与计划', run: showTrading } },
    ]} troubleshooting={[
      { title: '环境一直准备中或下载失败', body: '神经模式可在「运行环境」查看准备进度，下载失败后重试会复用已校验文件。使用大模型时无需准备神经环境。' },
      { title: '账户已连接，行情仍未就绪', body: '核对实际合约月份、柜台是否开放该合约及当前是否交易时段。在比赛页查同一合约的最新行情，再看AI 交易员历史数据诊断。PandaData 授权和比赛账户授权互不替代。' },
      { title: '没有计划，或者额度不足', body: '先看是否开启自动交易、行情与决策引擎是否就绪，再检查信号、冷却、未完成委托及柜台保证金。名义上限低于一手合约所需名义金额时可能无法开仓，不要盲目把上限清零。' },
    ]}/>
  const displayedMarkets = s.settings.instruments.map(item => s.markets.find(m => m.product === item.product && (!m.symbol || m.symbol.toLowerCase() === item.symbol.toLowerCase()))
    ?? { ...item, count: 0, readiness: 'waiting', long: 0, short: 0, chart: [] })
  const currentMarket = displayedMarkets.find(m => m.product === selected) ?? displayedMarkets[0]
  const activities: TraderActivity[] = [...new Map([...s.events, ...(s.trade_events || [])].map(e => [e.seq, e])).values()]
    .filter(e => (e.kind === 'decision' && e.payload.product && e.payload.head !== 'life') || e.kind === 'trade' || e.kind === 'execution_gate' || (e.kind === 'model_call' && e.payload.provider === 'trade_model' && e.payload.status !== 'ok'))
    .sort((a, b) => b.at - a.at || b.seq - a.seq).slice(0, 3).map(e => {
      const p = e.payload
      const symbol = p.symbol || displayedMarkets.find(m => m.product === p.product)?.symbol || p.product || ''
      const title = e.kind === 'trade' ? '柜台已成交' : e.kind === 'execution_gate' ? '执行进展' : e.kind === 'model_call' ? '模型调用未完成'
        : ({ WAIT: '继续观察', LONG: '目标做多', SHORT: '目标做空', CLOSE: '平仓决策' } as Record<string, string>)[p.choice?.action] || '交易决策'
      const detail = e.kind === 'trade' ? `${p.volume} 手 · 成交价 ${fmt(p.price)}`
        : p.choice?.reason || p.wait_reason?.message || p.message || p.reason || eventText(e)
      return { id: e.seq, at: e.at, title, detail: [symbol, detail].filter(Boolean).join(' · ') }
    })
  const runningLabel = s.control.trading ? s.control.close_only ? '仅平仓运行中' : automatic ? '自动交易中' : '生成计划中' : automatic ? '自动交易已暂停' : '计划生成已暂停'
  function startTrading() { setRiskAccepted(false); setStartReview(true) }
  const navigation = <nav className="fv-nav qs-trader-sections" aria-label="AI 交易员栏目">{[['dashboard', '交易'], ['analysis', '表现'], ['talk', '记录']].map(([key, label]) => <button type="button" className={tab === key ? 'selected' : ''} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key as typeof tab)} key={key}>{label}</button>)}</nav>
  return <div className="fv-page fv-workspace qs-workspace-refined qs-trader-dashboard">
    <header className="fv-header qs-trader-identity-header"><div className="fv-identity"><div className="fv-avatar" aria-hidden="true"><RobotIcon size={30} weight="duotone"/></div><div><div className="qs-trader-name-line"><h1>{s.name || 'AI 交易员'}</h1><span className="qs-trader-running" data-running={s.control.trading}><span className="qs-state-dot" data-active={s.control.trading}/>{runningLabel}</span></div><p className="qs-trader-subtitle">{isLLM ? '大模型' : '神经模型'} · {s.settings.trade_period_minutes || 1} 分钟 · {s.settings.instruments.length} 个合约</p></div></div><div className="fv-header-actions"><button type="button" aria-label="AI 交易员运行设置" onClick={openSetup}><GearSixIcon size={18}/><span>编辑</span></button>
      <button type="button" className={s.control.trading ? 'fv-pause' : 'fv-primary'} disabled={pending} onClick={() => {
        if (s.control.trading) void run(() => control('observe'))
        else if (!canStart) configureAt(s.settings.life_validation ? 4 : missing[0]!.step)
        else startTrading()
      }}>{pending ? '处理中…' : s.control.trading ? (automatic ? '暂停自动交易' : '暂停生成计划') : canStart ? (automatic ? '开始自动交易' : '开始生成计划') : '继续配置'}</button>
    </div></header>
    <div className="qs-trader-navigation">{navigation}{guide}</div>
    {error && <div role="alert" className="fv-error">{error}<button type="button" onClick={() => setError('')}>关闭</button></div>}
    {s.persistence?.ok === false && <div role="alert" className="fv-error">存档异常 · 暂停新增开仓。{s.persistence.error}<button type="button" onClick={() => setDetails(true)}>查看诊断</button></div>}
    {s.neural.message && s.neural.status !== 'ready' && <p className="fv-runtime-note" role="status">{s.neural.message}</p>}
    {s.history_error && <div role="alert" className="fv-error">历史数据读取失败：{s.history_error}<button type="button" onClick={() => setDetails(true)}>检查历史数据</button></div>}
    {tab === 'dashboard' && <>
      {!!missing.length && <div className="fv-setup-needed" role="status"><strong>开始前，补齐必要设置</strong><span>{missing.map(i => i.label).join(' · ')}</span><button type="button" onClick={() => configureAt(missing[0]!.step)}>继续设置 →</button></div>}
      {s.control.trading && s.connection?.status !== 'ready' && <div className="fv-runtime-note" role="status">{s.connection?.message || '等待比赛行情恢复，暂不生成新计划。'}<button type="button" onClick={() => setDetails(true)}>检查连接</button></div>}
      <div ref={tradingRef} tabIndex={-1} className="qs-trader-overview-anchor"><TraderOverview activities={activities} onRecords={() => setTab('talk')} onManage={() => configureAt(2)}/></div>
      <details className="qs-trader-market-fold">
        <summary>行情与连接 <span>· {displayedMarkets.filter(m => m.readiness === 'ready').length}/{displayedMarkets.length} 就绪</span></summary>
        <FlyContractList markets={displayedMarkets} selected={currentMarket?.product} trading={s.control.trading && !s.control.paused} onSelect={product => { setSelected(product); setMarketOpen(true) }} onManage={() => configureAt(2)}/>
        <div className="qs-trader-connection-actions"><button type="button" onClick={() => setDetails(true)}>连接与诊断 ↗</button><span>存档{s.persistence?.ok === false ? '异常' : s.persistence?.ok ? '已保存' : '待确认'}</span></div>
      </details>
      <section className="fv-plans-focus" aria-label="交易计划与回执">{tradePlans || <details><summary>交易计划与回执</summary><p>{automatic ? '暂无委托。有有效信号后自动提交，回执显示在这里。' : '暂无计划。有有效信号后生成计划，核对并确认后才会下单。'}</p></details>}</section>
      {s.account?.official && <details className="qs-trader-account-fold"><summary>比赛账户 <span>· 权益 {fmt(s.account.official.Balance)} 元</span></summary><div className="fv-account-strip" aria-label="账户上次快照"><div><small>账户权益 · 上次快照</small><strong>{fmt(s.account.official.Balance)}</strong></div><div><small>可用资金</small><strong>{fmt(s.account.official.Available)}</strong></div><div><small>当日手续费</small><strong>{fmt(s.account.official.Commission)}</strong></div></div></details>}
    </>}
    {tab === 'talk' && <div className="fv-talk-layout"><section className="fv-oracle"><span className="fv-kicker">A MESSAGE FROM ABOVE</span><h2>给交易员留一条记录</h2><p>信息、建议和长期偏好会进入记忆。<br />因果验证期间，神谕保存为记忆，不直接改动作分数。</p><textarea value={oracle} onChange={e => setOracle(e.target.value)} maxLength={2000} placeholder="记录你的观察与长期偏好。" /><button type="button" className="fv-primary" disabled={pending || !oracle.trim()} onClick={() => void run(async () => { await api('oracle', { text: oracle }); setOracle('') })}>送入记忆</button><small className="fv-note">暂停和交易额度请使用独立控制按钮。</small><hr /><h3>最近发生了什么</h3><button type="button" disabled={pending} onClick={() => void run(async () => setReport((await api<{ text: string }>('report', {})).text))}>生成事实报告</button>{report && <p className="fv-report">{report}</p>}</section><section className="fv-journal"><header><h2>运行与交易记录</h2><select aria-label="记录来源" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">所有来源</option>{Object.entries(actors).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></header>{events.length ? events.map(e => <article key={e.seq}><div className={`fv-event-dot ${e.actor}`} /><div><div className="fv-event-meta"><b>{actors[e.actor] || e.actor}</b><time>{new Date(e.at * 1000).toLocaleTimeString()}</time><small>#{e.seq}</small></div><p>{eventText(e)}</p>{e.decision_id && <small className="fv-note">决策 {e.decision_id.slice(0, 12)}</small>}</div></article>) : <div className="fv-empty">唤醒后，这里会记录它的选择与经历。</div>}</section></div>}
    {tab === 'analysis' && <><TradeStatistics/><TradeAnalytics active={active}/>{!isLLM && <details className="fv-data-details"><summary>学习反馈</summary><TradeLearning/></details>}</>}
    {tab === 'replay' && <FlyReplayLab active={active} />}
    {marketOpen && <ActionDialog drawer title={`${currentMarket?.symbol || '合约'} · 行情与决策`} onClose={() => setMarketOpen(false)}>
      <FlyMarketView automatic={automatic} market={currentMarket} observing={!s.control.trading} onDetails={() => { setMarketOpen(false); setDetails(true) }}/>
    </ActionDialog>}
    {details && <ActionDialog drawer title="AI 交易员行情与运行详情" busy={pending} onClose={() => setDetails(false)}>
      {openContest && <button type="button" onClick={() => { setDetails(false); openContest() }}>打开比赛账户与回执</button>}
      <RuntimeContinuity status={s} />{isLLM && <p>交易模型今日调用 {s.usage.trade_model || 0} 次{s.settings.trade_daily_calls ? ` / 上限 ${s.settings.trade_daily_calls}` : ' · 不限次数'}。每个合约独立分析，最多同时分析 3 个。</p>}
      <div className="fv-runtime-note" role="status" aria-label="比赛行情连接状态"><strong>{s.connection?.status === 'ready' ? '比赛行情已连接' : s.connection?.status === 'connecting' ? '正在连接比赛行情' : s.connection?.status === 'waiting' ? '行情暂不可用 · 自动恢复中' : '比赛行情未连接'}</strong>
        {s.connection?.message && <p>{s.connection.message}</p>}
        {connectionCooldown > 0 && <p>冷却中，{connectionCooldown} 秒后自动重试。</p>}
        {s.connection?.updated_at && <small>最近同步：{new Date(s.connection.updated_at * 1000).toLocaleString('zh-CN', { hour12: false })}</small>}
        {!['ready', 'waiting'].includes(s.connection?.status || '') && <button type="button" disabled={pending || s.connection?.status === 'connecting' || connectionCooldown > 0 || !s.settings.instruments.length} onClick={() => void run(async () => {
          await connectContestAccount()
          const result = await api<{ connection: NonNullable<Status['connection']> }>('control', { action: 'connect' })
          setStatus(current => current ? { ...current, connection: result.connection } : current)
        })}>{pending || s.connection?.status === 'connecting' ? '正在连接…' : s.connection?.status === 'needs_auth' ? '重新连接比赛行情' : '连接比赛行情'}</button>}
        {!s.settings.instruments.length && <p>先在「设置 → 账户与合约」保存实际合约，再连接行情。</p>}
      </div>
      <FlyHistory history={s.history} error={s.history_error} markets={s.markets} enabled={!!s.binding && !!s.settings.instruments.length} onRefresh={async () => {
        const result = await waitForCompetition(() => api<{ history: HistoryStatus }>('control', { action: 'history' }), '历史数据获取', 15_000)
        setStatus(current => current ? { ...current, history: result.history } : current)
      }} />
<details className="fv-data-details"><summary>交易控制与高级参数</summary><p>暂停自动交易不会撤销已提交委托；仅平仓模式自动提交减仓委托。</p><div className="fv-actions">{s.control.trading && <button type="button" disabled={pending} aria-pressed={!!s.control.close_only} onClick={() => void run(() => control(s.control.close_only ? 'trade' : 'close_only'))}>{s.control.close_only ? '恢复开仓' : '本轮只平仓'}</button>}</div></details>
    </ActionDialog>}
    {setup && draft && <ActionDialog settings title="AI 交易员运行设置" busy={pending} onClose={() => setSetup(false)}>
      <div className="qs-settings-form"><div className="qs-settings-layout">
      <TradingSettingsNavigation<number> current={step} onChange={setStep} items={[
        { id: 5, title: '决策引擎', detail: draft.decision_engine === 'llm' ? '大模型 · 交易要求' : '神经模型 · 本地运行' },
        { id: 2, title: '账户与合约', detail: `${draft.instruments.length} 个已选合约` },
        { id: 4, title: '运行与额度', detail: '交易开关与金额上限' },
        { id: 0, title: '运行环境', detail: s.environment.brain_ready ? '神经环境已就绪' : '准备运行环境' },
        { id: 3, title: '配置摘要', detail: '名称与本次设置' },
      ]}/>
      <div className="qs-settings-content fv-setup-content">
      <div className="qs-settings-intro"><h3>{({5: '决策引擎', 2: '账户与合约', 4: '运行与额度', 0: '运行环境', 3: '配置摘要'} as Record<number, string>)[step]}</h3><p>{({5: '选择谁来判断行情，执行仍由比赛 CLI 完成。', 2: '添加想交易的品种，填写各自的实际月份合约。', 4: '选择逐笔确认或自动下单，并设置本次交易额度。', 0: '神经模式需要本地依赖；大模型交易无需安装神经依赖。', 3: '查看已选合约和运行方式。'} as Record<number, string>)[step]}</p></div>
      {s.control.trading && <p className="fv-runtime-note">交易正在运行。暂停后可更改合约与运行参数。</p>}
      <fieldset className="fv-settings-fields" disabled={pending || s.control.trading}>
      {step === 5 && <TradingEngineSettings available={!!s.settings.decision_engine} value={draft} models={models?.profiles || []} onChange={value => setDraft({ ...draft, ...value })} openModels={openModelSettings ? () => { setSetup(false); openModelSettings() } : undefined}/>}
      {step === 0 && draft.decision_engine === 'llm' && <p>大模型交易使用当前基础运行环境，已就绪。下方神经依赖只在使用神经交易员时需要。</p>}
      {step === 0 && <div className="fv-setup-body">
        <p>使用神经模式时，下载并校验专用 Python 与 MaleCNS。依赖保存在用户目录。</p>
        <div className="fv-check-row"><span>专用 Python 与 MaleCNS</span><b>{s.environment.brain_ready ? '已就绪' : preparing || s.environment.progress.status === 'running' ? '准备中' : '尚未准备'}</b></div>
        <div className="fv-actions"><button type="button" className="fv-primary"
          disabled={pending || preparing || s.environment.progress.status === 'running' || s.environment.brain_ready}
          onClick={() => void run(async () => { if (!onPrepare) throw new Error('准备服务未连接'); await onPrepare() })}>
          {preparing || s.environment.progress.status === 'running' ? '正在准备…' : s.environment.brain_ready ? '神经环境已就绪' : '准备神经环境 / 重试'}
        </button></div>
        <p role="status">{s.environment.brain_ready ? '神经环境已就绪，可继续配置账户与合约。'
          : s.environment.progress.status === 'error' ? `准备失败：${s.environment.progress.message || '请重试'}`
          : s.environment.progress.stage ? `${s.environment.progress.stage} ${s.environment.progress.message || ''}`
          : prepareMessage || '尚未开始；使用神经模式时点击上方按钮准备。'}</p>
        {!!s.environment.progress.total && <progress value={s.environment.progress.done} max={s.environment.progress.total} />}
      </div>}
      {step === 2 && <div className="fv-setup-body"><fieldset><legend>比赛账户与合约</legend><div className="fv-check-row"><span>比赛账户</span><b>{accountKey ? '账户已连接' : !contest ? '比赛服务不可用' : contestStatus ? '账户未连接' : '正在读取账户状态…'}</b></div>{!accountKey && <button type="button" disabled={pending || !contest} onClick={() => void run(connectContestAccount)}>{accountKey ? '比赛账户已连接' : pending ? '正在连接账户…' : '连接比赛账户'}</button>}{contestError && <p role="alert">{contestError}</p>}<FlyInstruments instruments={draft.instruments} contest={contest} accountKey={accountKey} invalid={!!setupError} onChange={instruments => { setSetupError(''); setDraft(current => current ? { ...current, instruments: typeof instruments === 'function' ? instruments(current.instruments) : instruments } : current) }} /></fieldset></div>}
      {step === 4 && <div className="fv-setup-body"><ExecutionModeChoice value={draft.execution_mode ?? 'automatic'} disabled={pending || s.control.trading} onChange={execution_mode => setDraft({ ...draft, execution_mode })}/><label className="fv-checkbox"><input type="checkbox" checked={!draft.life_validation} onChange={e => setDraft({ ...draft, life_validation: !e.target.checked })} />启用交易功能</label><p>按所选执行方式处理交易计划；关闭后不生成交易计划。</p><section className="qs-settings-group"><div className="fv-form-grid">{[['target_notional', '每品种名义上限 ¥'], ['total_notional', '总名义占用上限 ¥'], ['loss_limit', '账户损失上限 ¥']].map(([key = '', label]) => <label key={key}>{label}<input type="number" min="0" aria-label={label} aria-invalid={!draft.life_validation && !!setupError && draftIssues.some(i => i.key === key)} disabled={draft.model_calls_unlimited && ['ai_daily_calls', 'jev_daily_calls', 'scenes_daily'].includes(key)} value={draft[key as keyof Settings] as number} onChange={e => setDraft({ ...draft, [key]: Math.max(0, Number(e.target.value)) })} />{!draft.life_validation && !!setupError && draftIssues.some(i => i.key === key) && <small className="fv-field-help">{draftIssues.find(i => i.key === key)?.label}</small>}</label>)}</div><p>0 表示不额外限制。已设置的上限继续生效，比赛账户自身规则始终有效。</p></section><TradeFilterControls decisionEngine={draft.decision_engine} settings={draft} onDraftChange={value => setDraft({ ...draft, ...value })} onApply={async () => {}}/></div>}
      {step === 3 && <div className="fv-setup-body"><h3>核对本次配置</h3><p>{draft.decision_engine === 'llm' ? '大模型交易员' : '神经交易员'}{draft.decision_engine === 'llm' && ` · 每合约最多 ${draft.llm_max_lots} 手`}</p><p>{draft.instruments.map(i => i.symbol).join(' / ') || '未选择合约'}</p><p>单品种名义上限 {draft.target_notional || '不额外限制'} · 总名义占用 {draft.total_notional || '不额外限制'} · 损失上限 {draft.loss_limit || '不额外限制'}</p><p>{draft.life_validation ? '交易功能已关闭' : draft.execution_mode === 'manual' ? '逐笔确认后下单' : 'CLI 自动下单'} · {draft.trade_period_minutes || 1} 分钟决策。暂停后不再提交新委托，已有委托与持仓保留。</p>{!draft.life_validation && <div className="fv-setup-checks"><strong>{draftIssues.length ? '还有交易配置需要补齐' : '交易配置已齐全'}</strong>{draftIssues.map(issue => <button type="button" key={issue.key} onClick={() => { setSetupError(issue.label); setStep(issue.step) }}>{issue.label} ↗</button>)}</div>}<label>给它一个名字<input maxLength={24} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label><p>关闭网页后，QuantStudio 后台仍运行时交易员会按当前启停状态继续运行。<br />退出应用后停止；重启恢复记忆与此前的交易启停状态；主动暂停后不会自动启动。</p></div>}
      </fieldset>
      {setupError && <p role="alert" className="fv-error">{setupError}</p>}
      </div></div><div className="qs-settings-footer"><span>{s.onboarding ? '首次设置' : s.settings.life_validation && !draft.life_validation ? '保存后将启用自动交易' : '更改后应用于下一次运行'}</span><button type="button" disabled={pending} onClick={() => setSetup(false)}>取消</button><button type="button" className="fv-primary" disabled={pending || s.control.trading} onClick={() => {
        if (step !== 3 && (s.onboarding || s.settings.life_validation !== draft.life_validation)) { if (checkSetup()) setStep(3) }
        else void run(() => saveSetup())
      }}>{pending ? '保存中…' : step === 3 && s.onboarding ? draft.life_validation ? '完成配置' : '保存并核对启动' : s.onboarding ? '核对并继续' : '保存配置'}</button></div>
    </div></ActionDialog>}
    {startReview && <ActionDialog title={automatic ? '启动自动交易' : '启动逐笔确认'} busy={pending} onClose={() => setStartReview(false)}>
      <p><strong>{s.settings.instruments.map(i => i.symbol).join(' / ')}</strong> · {s.settings.trade_period_minutes || 1} 分钟决策</p><p>每品种名义上限：{s.settings.target_notional ? fmt(s.settings.target_notional) : '不额外限制'} 元<br/>总名义占用上限：{s.settings.total_notional ? fmt(s.settings.total_notional) : '不额外限制'} 元<br/>账户损失上限：{s.settings.loss_limit ? fmt(s.settings.loss_limit) : '不额外限制'} 元</p>
      <p>模拟赛账户 {s.binding?.identity.accountId || s.settings.account} · {isLLM ? '大模型决策' : '神经信号'} · {automatic ? '自动下单' : '逐笔确认'}</p>
      <ExecutionDisclosure mode={executionMode} accepted={riskAccepted} onChange={setRiskAccepted}/>
      <div className="qs-drawer-footer"><button type="button" onClick={() => setStartReview(false)}>返回</button><button type="button" data-primary disabled={pending || (automatic && !riskAccepted)} onClick={() => { setStartReview(false); void run(() => control('trade', '', automatic && riskAccepted ? AUTOMATIC_TRADING_CONSENT : undefined)) }}>{automatic ? '确认并开始自动交易' : '确认并开始生成计划'}</button></div>
    </ActionDialog>}

  </div>
}
