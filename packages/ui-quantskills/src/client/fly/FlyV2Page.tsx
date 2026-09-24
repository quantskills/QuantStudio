import { GearSixIcon } from '@phosphor-icons/react'
import { futuresProduct, futuresContractPattern, products } from '@deepseek-ai/dsh-quantskills-session/contracts'
import { FlyInstruments } from './FlyInstruments.tsx'
import { ActionDialog } from '../ActionDialog.tsx'
import { FlyMarketView } from './FlyMarketView.tsx'
import { TradingGuide } from '../TradingGuide.tsx'
import { flyFetch } from './transport.ts'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import FlyHomeV2, { type BodyState } from './FlyHomeV2'
import { FlyReplayLab } from './FlyReplay.tsx'
import './fly-v2.css'
import { collapseNeuralWaits } from './flyJournal'
import { LifeTrace, lifeGoals } from './LifeTrace'
import { type TradeMarket } from './TradeLoop'
import { TradeStatistics } from './TradeStatistics'
import { TradeLearning } from './TradeLearning'
import { TradeAnalytics } from './TradeAnalytics'
import { RuntimeContinuity, type Continuity } from './RuntimeContinuity'
import { TradeFilterControls, type TradeFilterSettings } from './TradeFilterControls'
import { waitForCompetition } from '../competition-async.ts'
import type { ContestAccess } from '../contest.ts'
import type { ContestStatus } from '../plugin-types.ts'
import './fly-workspace.css'
import { FlyHistory, useRetryCountdown, type HistoryStatus } from './FlyHistory.tsx'

type Settings = TradeFilterSettings & { instruments: { product: string; symbol: string; exchange: string }[]; name: string; account: string; target_notional: number; total_notional: number; loss_limit: number; jev_daily_calls: number; ai_daily_calls: number; scenes_daily: number; model_calls_unlimited: boolean; ai_provider: string; jev_provider: 'typesafe'; jev_enabled: boolean; learning: boolean; life_validation: boolean; onboarding_complete: boolean }
type Event = { seq: number; at: number; actor: string; kind: string; decision_id: string; payload: Record<string, any>; merged_count?: number }
type Market = TradeMarket & { product: string; symbol?: string; price?: number; count: number; readiness: string; chart: number[]; long: number; short: number; history_source?: { at?: number | null; error?: string }; allocation?: { lots: number; target_notional: number; actual_notional: number; deviation_pct: number } }
type Status = Continuity & { history?: HistoryStatus; binding?: { identity: { contestId: string; accountId: string } } | null; trade_events?: Event[]; history_error?: string; connection?: { status: string; message: string; retry_at?: number | null; updated_at?: number }; name: string; settings: Settings; control: { paused: boolean; trading: boolean; close_only?: boolean }; neural: { status: string; message?: string; total_spikes?: number; activity?: Record<string, number>; sim_ms?: number; updates?: Record<string, number>; life_controller?: {interface: string; readout_neurons: number}; motor_controller?: {interface: string; readout_neurons: number}; motor?: {drive: number; turn: number; confidence: number; active_readout_neurons: number; reason: string}; sensory?: {visible_food: number; sector: number} }; world: BodyState; home: { name: string }; home_version: string; markets: Market[]; usage: Record<string, number>; events: Event[]; account?: Record<string, any>; runtime?: Record<string, any>; accounts: { name: string }[]; checkpoints: string[]; environment: { blender: string; brain_ready: boolean; blender_ready: boolean; progress: { status: string; stage?: string; message?: string; done?: number; total?: number } }; onboarding: boolean; versions: { id: string; name: string }[]; scene_jobs: { id: string; status: string; description: string; error?: string; attempt: number }[] }
const goals: Record<string, string> = { idle: '没有有效目标', forage: '神经感知与取食', observe: '观察市场', explore: '探索家园', eat: '享用果实', rest: '主动休息', interact: '物件互动' }
const actions: Record<string, string> = { turning: '按神经输出转向', avoiding: '碰撞边界已拦截，等待神经避障', idle: '等待有效神经运动信号', flying: '正在飞行', eating: '正在取食', resting: '正在休息', watching: '正在观察', touching: '正在互动', exploring: '正在探索' }
const environmentNames: Record<string, string> = { daylight: '日光', breeze: '微风', quiet: '安静', dew: '露水', replenish: '补充果实' }
const actors: Record<string, string> = { fly: '果蝇决定', jev: 'Jev 辅助', user: '用户影响', counter: '柜台回报', language_ai: '语言 AI', execution: '交易执行', system: '系统', reporter: '事实报告', scene_builder: '家园构建' }
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
  if (e.kind === 'model_call') return `${p.provider === 'codex_cli' ? 'Codex CLI' : p.provider === 'jev' ? (p.service_provider === 'vercel' ? 'Jev · Vercel' : 'Jev · TypeSafe') : '语言 AI'} · ${p.status === 'ok' ? '调用完成' : '调用未完成'}${p.reason ? ' · ' + p.reason : ''}`
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

export default function FlyV2Page({ active, contest, openContest, openModelSettings, preparing = false, prepareMessage, onPrepare, tradePlans }: {
  openContest?: (() => void) | undefined; tradePlans?: ReactNode; active: boolean; contest?: Pick<ContestAccess, 'query' | 'status' | 'mode' | 'connect'> | undefined; openModelSettings?: (() => void) | undefined; preparing?: boolean; prepareMessage?: string | undefined; onPrepare?: ((blenderPath: string) => Promise<unknown>) | undefined
}) {
  const [status, setStatus] = useState<Status>()
  const [tab, setTab] = useState<'dashboard' | 'home' | 'talk' | 'replay' | 'analysis'>('dashboard')
  const [error, setError] = useState(''); const [pending, setPending] = useState(false)
  const [setupError, setSetupError] = useState('')
  const connectionCooldown = useRetryCountdown(status?.connection?.retry_at)
  const [blenderPath, setBlenderPath] = useState('')
  const [setup, setSetup] = useState(false); const [step, setStep] = useState(2)
  const [details, setDetails] = useState(false), [selected, setSelected] = useState(''), [startReview, setStartReview] = useState(false)
  const reviewed = useRef('')
  const [contestStatus, setContestStatus] = useState<ContestStatus>(), [contestError, setContestError] = useState('')
  const contestRevision = useRef(0)
  const accountKey = contestStatus?.enabled && contestStatus.phase === 'connected' && contestStatus.identity ? JSON.stringify(contestStatus.identity) : ''
  const [draft, setDraft] = useState<Settings>()
  const [models, setModels] = useState<{ profiles: { provider_id: string; label: string; configured: boolean }[]; jev_configured: boolean; jev_providers: { id: string; label: string; model: string; configured: boolean }[] }>()
  const [oracle, setOracle] = useState(''); const [description, setDescription] = useState('')
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
        const result = await waitForCompetition(() => api<Status>('state'), '果蝇家园状态读取', 15_000)
        if (!disposed) {
          setStatus(result)
          if (!loaded.current) { loaded.current = true; setDraft(result.settings); setSetup(false); setBlenderPath(result.environment.blender) }
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
  async function control(action: string, version = '') { await api('control', { action, version }) }
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
  function openSetup() { if (status) setDraft(structuredClone(status.settings)); setSetupError(''); setSetup(true); setStep(status?.environment.brain_ready ? 2 : 0) }
  function checkInstruments(): boolean {
    const invalid = draft?.instruments.filter(item => !futuresContractPattern.test(item.symbol.trim())) ?? []
    if (!invalid.length) return true
    setSetupError(`请为已选品种填写实际合约代码（如 rb2610），或取消勾选：${invalid.map(item => names[item.product] || item.product).join('、')}`)
    setStep(2)
    return false
  }
  if (!status) return <div className="fv-page fv-loading"><div className="fv-orbit">✦</div><h2>正在连接小果的世界</h2><p>{error || '恢复个体、记忆与家园…'}</p></div>
  const s = status
  const running = !s.control.paused && s.neural.status === 'ready'
    const events = collapseNeuralWaits(s.events).filter(e => filter === 'all' || e.actor === filter).reverse()
  const waiting = s.world.wait_reason
  const motionText = waiting ? waiting.message + (waiting.recovery_seconds != null ? `（约 ${waiting.recovery_seconds} 秒）` : '') : actions[s.world.action]
  const issueList = (value: Settings) => {
    const issues: { key: string; label: string; step: number }[] = []
    if (!s.environment.brain_ready) issues.push({ key: 'environment', label: '准备神经运行环境', step: 0 })
    if (!(accountKey || (s.binding && s.connection?.status !== 'needs_auth'))) issues.push({ key: 'account', label: '连接比赛账户', step: 2 })
    if (!value.instruments.length || value.instruments.some(i => !futuresContractPattern.test(i.symbol) || futuresProduct(i.symbol) !== i.product.toLowerCase())) issues.push({ key: 'instruments', label: '选择品种并填写有效实际合约', step: 2 })
    for (const [key, label, max] of [['target_notional', '每品种名义上限', 100000000], ['total_notional', '总名义占用上限', 500000000], ['loss_limit', '账户损失上限', 100000000]] as const) {
      if (!Number.isFinite(value[key]) || value[key] < 0) issues.push({ key, label: `设置${label}（0 表示不额外限制）`, step: 2 })
      else if (value[key] > max) issues.push({ key, label: `${label}不能超过 ${max.toLocaleString('zh-CN')} 元`, step: 2 })
    }
    if (value.total_notional > 0 && value.target_notional > value.total_notional) issues.push({ key: 'total_notional', label: '总名义占用上限不能小于每品种名义上限', step: 2 })
    return issues
  }
  const missing = issueList(s.settings), draftIssues = draft ? issueList(draft) : []
  const canStart = !s.settings.life_validation && !missing.length
  function configureAt(index: number) { openSetup(); setStep(index) }
  function checkSetup() {
    if (!checkInstruments()) return false
    if (!s.environment.brain_ready) { setSetupError('请先准备神经运行环境'); setStep(0); return false }
    if (!draft?.life_validation && draftIssues.length) {
      setSetupError(draftIssues.map(i => i.label).join('；')); setStep(draftIssues[0]!.step)
      return false
    }
    return true
  }
  async function saveSetup(later = false) {
    if (!draft || (later ? !checkInstruments() : !checkSetup())) return
    await api('settings', { ...draft, onboarding_complete: !later })
    if (!later && !draft.life_validation && (s.onboarding || s.settings.life_validation)) await control('trade')
    else if (!later && s.onboarding) await control('start')
    setSetup(false); setTab('dashboard')
  }
  const guide = <TradingGuide compact name="果蝇" steps={[
      { title: '准备运行环境', status: s.environment.brain_ready ? '神经环境已就绪' : '运行环境待准备', ready: s.environment.brain_ready,
        body: '打开设置，点击「一键准备果蝇」，等待下载、校验和神经环境准备完成。第一次想先熟悉界面，可以关闭「生成交易选择」，只体验生活；以后可随时回到设置开启。',
        note: '安装需要网络与本机磁盘空间，按进度提示等待。语言模型、Jev 和 AI 造景都是可选辅助，不是果蝇生成交易建议的必填项。', action: { label: '检查运行环境与用途', run: () => configureAt(0) } },
      { title: '连接账户与合约', status: s.settings.instruments.length ? `已保存 ${s.settings.instruments.length} 个合约 · 仍需核对行情` : '账户与合约待设置',
        body: '在设置中连接期货模拟赛账户，再选择品种并核对实际合约月份。可搜索全部品种或手动填写其他合约。初次先选一个熟悉的品种，便于观察行情、信号与回执是否连贯。',
        note: '实时报价来自比赛柜台，历史数据需先到「设置 → PandaData」连接授权。合约代码示例不代表当前可交易月份。名义金额不是保证金；额外风险上限填 0 表示不额外限制，请根据模拟账户资金设置。', action: { label: '设置账户、合约与限额', run: () => configureAt(2) } },
      { title: '完成设置并观察', status: s.control.trading ? s.connection?.status === 'ready' ? '交易建议已启用' : '已启用 · 等待行情' : '交易建议未启用', ready: s.control.trading && s.connection?.status === 'ready',
        body: '到「核对配置」核对配置，然后完成设置。首次启用交易选择会连接行情并开始生成建议；以后修改设置只保存，回到交易页按运行按钮启用。先观察行情就绪、神经信号和计划状态。',
        note: '无需为了出单打开 Jev 辅助：果蝇由神经读出生成交易建议，Jev 在这里辅助生活环境。独立的 Jev 持续盯盘在比赛页。语言模型测试、Jev 和造景会产生相应 API 用量。', action: { label: '检查完成前的配置', run: () => configureAt(3) } },
      { title: '确认计划与暂停', status: '每笔交易由你确认',
        body: '进入交易页的「待确认交易计划」，核对账户、合约、方向、手数和价格后确认或取消。提交后看柜台回执与成交记录，交易分析用于复查实际结果。没有信号时等待也是正常状态。',
        note: '「暂停交易建议」只停止新建议，不撤单、不平仓。关闭浏览器不代表后台停止；要停止请使用页面控制，并检查已有委托和持仓。', action: { label: '查看交易状态与计划', run: showTrading } },
    ]} troubleshooting={[
      { title: '环境一直准备中或下载失败', body: '查看设置里的准备阶段和错误提示，确认网络可用后点击重试。已有 Blender 可以填写本机路径并验证；不要在安装进行中反复启动。' },
      { title: '账户已连接，行情仍未就绪', body: '核对实际合约月份、柜台是否开放该合约及当前是否交易时段。在比赛页查同一合约的最新行情，再看果蝇历史数据诊断。PandaData 授权和比赛账户授权互不替代。' },
      { title: '没有计划，或者额度不足', body: '先看是否开启交易建议、行情与神经状态是否就绪，再检查信号、冷却、待确认计划及柜台保证金。名义上限低于一手合约所需名义金额时可能无法开仓，不要盲目把上限清零。' },
    ]}/>
  const currentMarket = s.markets.find(m => m.product === selected) ?? s.markets[0]
  const reviewConfig = () => JSON.stringify(s.settings)
  function startSuggestions() {
    if (reviewed.current !== reviewConfig()) setStartReview(true)
    else void run(() => control('trade'))
  }
  return <div className="fv-page fv-workspace">
    <header className="fv-header"><div className="fv-identity"><div className="fv-avatar" aria-hidden="true">✦</div><div><h1>果蝇交易员<span>{s.name} · 从神经信号到待确认计划</span></h1></div></div><div className="fv-header-actions">{guide}<button type="button" aria-label="果蝇运行设置" onClick={openSetup}><GearSixIcon size={20}/></button>{tab === 'home' && <button type="button" disabled={pending} onClick={() => void run(() => control(s.control.paused ? 'start' : 'pause'))}>{s.control.paused ? '唤醒小果' : '暂停个体'}</button>}</div></header>
    <nav className="fv-nav" aria-label="果蝇栏目">{[['dashboard', '交易'], ['home', '生活'], ['analysis', '表现'], ['talk', '记录']].map(([key, label]) => <button type="button" className={tab === key ? 'selected' : ''} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key as typeof tab)} key={key}>{label}</button>)}</nav>
    {error && <div role="alert" className="fv-error">{error}<button type="button" onClick={() => setError('')}>关闭</button></div>}
    {s.persistence?.ok === false && <div role="alert" className="fv-error">存档异常 · 暂停新增开仓。{s.persistence.error}<button type="button" onClick={() => setDetails(true)}>查看诊断</button></div>}
    {s.neural.message && s.neural.status !== 'ready' && <p className="fv-runtime-note" role="status">{s.neural.message}</p>}
    {s.history_error && <div role="alert" className="fv-error">历史数据读取失败：{s.history_error}<button type="button" onClick={() => setDetails(true)}>检查历史数据</button></div>}
    {tab === 'dashboard' && <>
      <div className="fv-launch-row" ref={tradingRef} tabIndex={-1}>
        <label>观察合约<select aria-label="观察合约" value={currentMarket?.product ?? s.settings.instruments[0]?.product ?? ''} onChange={e => setSelected(e.target.value)}><option value="" disabled>尚未选择合约</option>{s.settings.instruments.map(i => <option key={i.product} value={i.product}>{i.symbol || i.product}</option>)}</select></label>
        <button type="button" className="fv-contract-settings" onClick={() => configureAt(2)}>管理合约{ s.settings.instruments.length > 1 ? ` · ${s.settings.instruments.length}` : '' }</button>
        <div className="fv-launch-summary"><strong>{s.settings.trade_period_minutes || 1} 分钟决策 · 每笔计划由你确认</strong><span>单品种名义上限 {s.settings.target_notional ? `¥${fmt(s.settings.target_notional)}` : '未额外限制'} · 损失上限 {s.settings.loss_limit ? `¥${fmt(s.settings.loss_limit)}` : '未额外限制'}</span></div>
        <button type="button" className={s.control.trading ? 'fv-pause' : 'fv-primary'} disabled={pending} onClick={() => {
          if (s.control.trading) void run(() => control('observe'))
          else if (!canStart) configureAt(s.settings.life_validation ? 0 : missing[0]!.step)
          else startSuggestions()
        }}>{pending ? '处理中…' : s.control.trading ? '暂停交易建议' : canStart ? '开始观察' : '继续配置'}</button>
      </div>
      {!!missing.length && <div className="fv-setup-needed" role="status"><strong>开始前，补齐必要设置</strong><span>{missing.map(i => i.label).join(' · ')}</span><button type="button" onClick={() => configureAt(missing[0]!.step)}>继续设置 →</button></div>}
      {s.control.trading && s.connection?.status !== 'ready' && <div className="fv-runtime-note" role="status">{s.connection?.message || '等待比赛行情恢复，暂不生成新计划。'}<button type="button" onClick={() => setDetails(true)}>检查连接</button></div>}
      <FlyMarketView market={currentMarket} observing={!s.control.trading} onDetails={() => setDetails(true)}/>
      <section className="fv-plans-focus" aria-label="待确认交易计划">{tradePlans || <><h2>待确认交易计划</h2><p>暂无计划。有有效信号后在这里核对。</p></>}</section>
      {s.account?.official && <div className="fv-account-strip" aria-label="账户上次快照"><div><small>账户权益 · 上次快照</small><strong>{fmt(s.account.official.Balance)}</strong></div><div><small>可用资金</small><strong>{fmt(s.account.official.Available)}</strong></div><div><small>累计手续费</small><strong>{fmt(s.account.official.Commission)}</strong></div></div>}
      <div className="fv-workspace-health"><span>个体{ s.control.paused ? '已暂停' : '运行中' } · 建议{s.control.trading ? s.control.close_only ? '仅平仓' : '已启用' : '已暂停'}</span><span>存档{s.persistence?.ok === false ? '异常' : s.persistence?.ok ? '已保存' : '待确认'}</span><button type="button" onClick={() => setDetails(true)}>连接与诊断 ↗</button></div>
    </>}
    {tab === 'home' && <><details className="fv-data-details"><summary>生活反馈与神经活动</summary><LifeTrace trace={s.world.life_trace} previous={s.world.last_life_feedback} /><p>生活学习 {s.neural.updates?.life || 0} 次 · 神经累计 {fmt((s.neural.sim_ms || 0) / 1000)} 秒</p><div className="fv-actions"><button type="button" onClick={() => setTab('replay')}>事件回放</button><button type="button" disabled={pending || !running} onClick={() => void run(() => control('checkpoint'))}>保存检查点</button></div></details><div className="fv-section-line"><div><h2>{s.home.name}</h2><p>它的空间，它正在发生的生活</p></div><span className="fv-pill">{goals[s.world.goal]} · {motionText}</span></div><div className="fv-home-layout"><div className="fv-home-stage"><FlyHomeV2 body={s.world} version={s.home_version} paused={!running} /><div className="fv-home-footer"><div><small>当前位置</small><strong>{s.world.position.map(v => v.toFixed(1)).join(' / ')}</strong></div><div><small>环境事件</small><strong>{({ daylight: '柔和日光', breeze: '微风', quiet: '安静时刻', dew: '花园露水' } as Record<string, string>)[s.world.event]}</strong></div><div><small>精力</small><strong>{Math.round(s.world.energy * 100)}%</strong></div></div></div><aside className="fv-home-editor"><span className="fv-kicker">MAKE IT A HOME</span><h2>为它创造一个世界</h2><p>用中文描述空间。AI 助手与 Blender 会完成生成、检查和装入。</p><textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={3000} placeholder="例如：一座温暖的苔藓花园，有果实、叶片睡床和一张小小的行情桌。" /><button type="button" className="fv-primary" disabled={pending || !description.trim()} onClick={() => void run(async () => { await api('homes', { description }); setDescription('') })}>创造家园 ↗</button><small className="fv-note">使用首次设置中选择的 QuantStudio 模型。造景失败时保留当前家园。</small><hr /><h3>家园版本</h3><select aria-label="选择家园版本" value={s.home_version} onChange={e => void run(async () => { await api('homes/restore', { version: e.target.value }) })}><option value="default">默认 · 晨光温室</option>{s.versions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select>{s.scene_jobs.slice(-3).reverse().map(j => <div className="fv-job" key={j.id}><b>{({ planning: '规划场景', building: 'Blender 构建中', checking: '检查交互与模型', complete: '家园已载入', failed: '生成未完成' } as Record<string, string>)[j.status]}</b><small>{j.description}</small>{j.error && <p>{j.error}</p>}</div>)}</aside></div></>}
    {tab === 'talk' && <div className="fv-talk-layout"><section className="fv-oracle"><span className="fv-kicker">A MESSAGE FROM ABOVE</span><h2>给小果一条神谕</h2><p>信息、建议和长期偏好会进入记忆。<br />因果验证期间，神谕保存为记忆，不直接改动作分数。</p><textarea value={oracle} onChange={e => setOracle(e.target.value)} maxLength={2000} placeholder="今天也去花园里探索一下吧。" /><button type="button" className="fv-primary" disabled={pending || !oracle.trim()} onClick={() => void run(async () => { await api('oracle', { text: oracle }); setOracle('') })}>送入记忆</button><small className="fv-note">暂停和交易额度请使用独立控制按钮。</small><hr /><h3>最近发生了什么</h3><button type="button" disabled={pending} onClick={() => void run(async () => setReport((await api<{ text: string }>('report', {})).text))}>生成事实报告</button>{report && <p className="fv-report">{report}</p>}</section><section className="fv-journal"><header><h2>生活与交易记录</h2><select aria-label="记录来源" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">所有来源</option>{Object.entries(actors).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></header>{events.length ? events.map(e => <article key={e.seq}><div className={`fv-event-dot ${e.actor}`} /><div><div className="fv-event-meta"><b>{actors[e.actor] || e.actor}</b><time>{new Date(e.at * 1000).toLocaleTimeString()}</time><small>#{e.seq}</small></div><p>{eventText(e)}</p>{e.decision_id && <small className="fv-note">决策 {e.decision_id.slice(0, 12)}</small>}</div></article>) : <div className="fv-empty">唤醒后，这里会记录它的选择与经历。</div>}</section></div>}
    {tab === 'analysis' && <><TradeStatistics/><TradeAnalytics active={active}/><details className="fv-data-details"><summary>学习反馈</summary><TradeLearning/></details></>}
    {tab === 'replay' && <FlyReplayLab active={active} />}
    {details && <ActionDialog drawer title="果蝇行情与运行详情" busy={pending} onClose={() => setDetails(false)}>
      {openContest && <button type="button" onClick={() => { setDetails(false); openContest() }}>打开比赛账户与回执</button>}
      <RuntimeContinuity status={s} />
      <div className="fv-runtime-note" role="status" aria-label="比赛行情连接状态"><strong>{s.connection?.status === 'ready' ? '比赛行情已连接' : s.connection?.status === 'connecting' ? '正在连接比赛行情' : s.connection?.status === 'waiting' ? '行情暂不可用 · 自动恢复中' : '比赛行情未连接'}</strong>
        {s.connection?.message && <p>{s.connection.message}</p>}
        {connectionCooldown > 0 && <p>冷却中，{connectionCooldown} 秒后自动重试。</p>}
        {s.connection?.updated_at && <small>最近同步：{new Date(s.connection.updated_at * 1000).toLocaleString('zh-CN', { hour12: false })}</small>}
        {!['ready', 'waiting'].includes(s.connection?.status || '') && <button type="button" disabled={pending || s.connection?.status === 'connecting' || connectionCooldown > 0 || !s.settings.instruments.length} onClick={() => void run(async () => {
          await connectContestAccount()
          const result = await api<{ connection: NonNullable<Status['connection']> }>('control', { action: 'connect' })
          setStatus(current => current ? { ...current, connection: result.connection } : current)
        })}>{pending || s.connection?.status === 'connecting' ? '正在连接…' : s.connection?.status === 'needs_auth' ? '重新连接比赛行情' : '连接比赛行情'}</button>}
        {!s.settings.instruments.length && <p>先在「行情配置」保存实际合约，再连接行情。</p>}
      </div>
      <FlyHistory history={s.history} error={s.history_error} markets={s.markets} enabled={!!s.binding && !!s.settings.instruments.length} onRefresh={async () => {
        const result = await waitForCompetition(() => api<{ history: HistoryStatus }>('control', { action: 'history' }), '历史数据获取', 15_000)
        setStatus(current => current ? { ...current, history: result.history } : current)
      }} />
<details className="fv-data-details"><summary>交易控制与高级参数</summary><p>暂停建议不会撤销已提交委托；仅平仓模式仍需逐笔确认。</p><div className="fv-actions">{s.control.trading && <button type="button" disabled={pending} aria-pressed={!!s.control.close_only} onClick={() => void run(() => control(s.control.close_only ? 'trade' : 'close_only'))}>{s.control.close_only ? '恢复开仓' : '本轮只平仓'}</button>}</div></details>
    </ActionDialog>}
    {setup && draft && <ActionDialog drawer title="果蝇运行设置" busy={pending} onClose={() => setSetup(false)}><div className="fv-setup-content">
      <nav className="fv-steps" aria-label="设置栏目">{[{ label: '本次运行', i: 2 }, { label: '环境', i: 0 }, { label: '模型辅助', i: 1 }, { label: '核对配置', i: 3 }].map(({label,i}) => <button type="button" key={i} className={step === i ? 'current' : ''} aria-current={step === i ? 'step' : undefined} onClick={() => setStep(i)}>{label}</button>)}</nav>
      {s.control.trading && <p className="fv-runtime-note">交易建议正在运行。暂停后可更改合约与运行参数。</p>}
      <fieldset className="fv-settings-fields" disabled={pending || s.control.trading}>
      {step === 0 && <div className="fv-setup-body"><label className="fv-checkbox"><input type="checkbox" checked={!draft.life_validation} onChange={e => setDraft({ ...draft, life_validation: !e.target.checked })} />生成交易选择</label><p>默认开启。完成交易配置后生成待确认计划；关闭后仅体验生活。</p><p>点击准备后自动下载并校验专用 Python 与 MaleCNS；优先复用你选择的本机 Blender，未配置时下载专用版本。数据保存在用户目录，升级不会清空。</p><div className="fv-check-row"><span>专用 Python 与 MaleCNS</span><b>{s.environment.brain_ready ? '已就绪' : preparing || s.environment.progress.status === 'running' ? '准备中' : '尚未准备'}</b></div><div className="fv-check-row"><span>Blender</span><b>{s.environment.blender_ready ? '已就绪' : '尚未准备'}</b></div><details className="fv-data-details"><summary>复用本机 Blender（可选）</summary><label>已有 Blender 安装路径<input aria-label="已有 Blender 安装路径" value={blenderPath} onChange={e => setBlenderPath(e.target.value)} placeholder="安装目录或 blender.exe 的完整路径" /></label><button type="button" disabled={pending || !blenderPath.trim() || s.environment.progress.status === 'running'} onClick={() => void run(async () => { await api('environment/config', { blender_path: blenderPath.trim() }) })}>验证并使用本机 Blender</button><small>{s.environment.blender}</small></details><div className="fv-actions"><button type="button" className="fv-primary" disabled={pending || preparing || s.environment.progress.status === 'running' || (s.environment.brain_ready && s.environment.blender_ready)} onClick={() => void run(async () => { if (!onPrepare) throw new Error('准备服务未连接'); await onPrepare(blenderPath.trim()) })}>{preparing || s.environment.progress.status === 'running' ? '正在准备…' : s.environment.brain_ready && s.environment.blender_ready ? '运行环境已就绪' : '一键准备果蝇 / 重试'}</button></div><p role="status">{s.environment.progress.status === 'error' ? `准备失败：${s.environment.progress.message || '请重试'}` : s.environment.brain_ready && s.environment.blender_ready ? '运行环境已就绪，可继续配置账户与合约。' : s.environment.progress.stage ? `${s.environment.progress.stage} ${s.environment.progress.message || ''}` : prepareMessage || '尚未开始；点击上方按钮准备。'}</p>{!!s.environment.progress.total && <progress value={s.environment.progress.done} max={s.environment.progress.total} />}</div>}
      {step === 1 && <div className="fv-setup-body"><label>QuantStudio 已接入模型<select value={draft.ai_provider} onChange={e => setDraft({ ...draft, ai_provider: e.target.value })}><option value="">暂不启用语言辅助</option>{(models?.profiles || []).map(m => <option key={m.provider_id} value={m.provider_id}>{m.label}</option>)}</select></label><button type="button" disabled={pending || !draft.ai_provider || draft.ai_provider !== s.settings.ai_provider} onClick={() => void run(async () => { await api('models/test', {}); setSetupError('已保存的语言模型连接成功') })}>测试已保存模型</button><p>切换模型请先保存。测试只使用已保存模型，并计入每日调用次数。</p><div className="fv-check-row"><span>Jev · 统一模型服务</span><b>{models?.jev_configured ? '已配置' : 'API Key 未配置'}</b></div><p>Jev API Key 请在「设置 → 模型服务 → Jev」中配置，与比赛页共用。</p>{openModelSettings && <button type="button" onClick={() => { setSetup(false); openModelSettings() }}>前往模型服务配置 Jev</button>}<label className="fv-checkbox"><input type="checkbox" checked={draft.jev_enabled} onChange={e => setDraft({ ...draft, jev_enabled: e.target.checked })} />启用 Jev 生活环境辅助</label><button type="button" disabled={pending || !models?.jev_configured} onClick={() => void run(async () => { await api('jev/test', {}); setSetupError('Jev 连接成功') })}>测试 Jev 连接</button><p>Jev 辅助生活环境，果蝇神经读出决定交易建议。独立的 Jev 盯盘仍在比赛页。</p><details><summary>生活辅助用量</summary><label className="fv-checkbox"><input type="checkbox" checked={draft.model_calls_unlimited} onChange={e => setDraft({ ...draft, model_calls_unlimited: e.target.checked })} />语言 AI、Jev 与造景不限调用次数</label><small className="fv-note">仍统计实际用量；果蝇神经运行没有每日次数上限。</small><div className="fv-form-grid">{[['ai_daily_calls', '语言 AI / 日'], ['jev_daily_calls', 'Jev 调用 / 日'], ['scenes_daily', '造景次数 / 日']].map(([key = '', label]) => <label key={key}>{label}<input aria-label={label} type="number" min="0" disabled={draft.model_calls_unlimited} value={draft[key as keyof Settings] as number} onChange={e => setDraft({ ...draft, [key]: Math.max(0, Number(e.target.value)) })} /></label>)}</div></details></div>}
      {step === 2 && <div className="fv-setup-body"><fieldset><legend>比赛账户与合约</legend><div className="fv-check-row"><span>比赛账户</span><b>{accountKey ? '账户已连接' : !contest ? '比赛服务不可用' : contestStatus ? '账户未连接' : '正在读取账户状态…'}</b></div>{!accountKey && <button type="button" disabled={pending || !contest} onClick={() => void run(connectContestAccount)}>{accountKey ? '比赛账户已连接' : pending ? '正在连接账户…' : '连接比赛账户'}</button>}{contestError && <p role="alert">{contestError}</p>}<FlyInstruments instruments={draft.instruments} contest={contest} accountKey={accountKey} invalid={!!setupError} onChange={instruments => { setSetupError(''); setDraft(current => current ? { ...current, instruments: typeof instruments === 'function' ? instruments(current.instruments) : instruments } : current) }} /></fieldset><p>按神经信号生成待确认计划，手数受账户与下方额度约束。</p><details><summary>风险与额度 · 查看已保存上限</summary><div className="fv-form-grid">{[['target_notional', '每品种名义上限 ¥'], ['total_notional', '总名义占用上限 ¥'], ['loss_limit', '账户损失上限 ¥']].map(([key = '', label]) => <label key={key}>{label}<input type="number" min="0" aria-label={label} aria-invalid={!draft.life_validation && !!setupError && draftIssues.some(i => i.key === key)} disabled={draft.model_calls_unlimited && ['ai_daily_calls', 'jev_daily_calls', 'scenes_daily'].includes(key)} value={draft[key as keyof Settings] as number} onChange={e => setDraft({ ...draft, [key]: Math.max(0, Number(e.target.value)) })} />{!draft.life_validation && !!setupError && draftIssues.some(i => i.key === key) && <small className="fv-field-help">{draftIssues.find(i => i.key === key)?.label}</small>}</label>)}</div><p>0 表示不额外限制。已设置的上限继续生效，比赛账户自身规则始终有效。</p></details><TradeFilterControls settings={draft} onDraftChange={value => setDraft({ ...draft, ...value })} onApply={async () => {}}/></div>}
      {step === 3 && <div className="fv-setup-body"><h3>核对本次配置</h3><p>{draft.instruments.map(i => i.symbol).join(' / ') || '未选择合约'}</p><p>单品种名义上限 {draft.target_notional || '不额外限制'} · 总名义占用 {draft.total_notional || '不额外限制'} · 损失上限 {draft.loss_limit || '不额外限制'}</p><p>{draft.life_validation ? '仅体验生活' : '生成待确认计划'} · {draft.trade_period_minutes || 1} 分钟决策。停止建议不会撤单或平仓。</p>{!draft.life_validation && <div className="fv-setup-checks"><strong>{draftIssues.length ? '还有交易配置需要补齐' : '交易配置已齐全'}</strong>{draftIssues.map(issue => <button type="button" key={issue.key} onClick={() => { setSetupError(issue.label); setStep(issue.step) }}>{issue.label} ↗</button>)}</div>}<label>给它一个名字<input maxLength={24} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label><p>关闭网页后，QuantStudio 后台仍运行时它会继续生活。<br />退出应用后停止；重启恢复记忆与此前的交易启停状态；主动暂停后不会自动启动。</p></div>}
      </fieldset>
      {setupError && <p role="alert" className="fv-error">{setupError}</p>}
      <div className="qs-drawer-footer"><button type="button" disabled={pending} onClick={() => setSetup(false)}>取消</button><button type="button" className="fv-primary" disabled={pending || s.control.trading} onClick={() => {
        if (step !== 3 && (s.onboarding || s.settings.life_validation !== draft.life_validation)) { if (checkSetup()) setStep(3) }
        else void run(() => saveSetup())
      }}>{pending ? '保存中…' : step === 3 && s.onboarding ? draft.life_validation ? '完成并进入生活' : '完成并开始观察' : s.onboarding ? '核对并继续' : '保存配置'}</button></div>
    </div></ActionDialog>}
    {startReview && <ActionDialog title="核对本次观察" busy={pending} onClose={() => setStartReview(false)}>
      <p><strong>{s.settings.instruments.map(i => i.symbol).join(' / ')}</strong> · {s.settings.trade_period_minutes || 1} 分钟决策</p><p>每品种名义上限：{s.settings.target_notional ? fmt(s.settings.target_notional) : '不额外限制'} 元<br/>总名义占用上限：{s.settings.total_notional ? fmt(s.settings.total_notional) : '不额外限制'} 元<br/>账户损失上限：{s.settings.loss_limit ? fmt(s.settings.loss_limit) : '不额外限制'} 元</p>
      <p>开始后连接行情并生成建议，每笔计划仍由你确认。暂停建议保留生活，不撤单、不平仓。{s.settings.jev_enabled || s.settings.ai_provider ? '已开启模型辅助，调用产生 API 用量。' : ''}</p>
      <div className="qs-drawer-footer"><button type="button" onClick={() => setStartReview(false)}>返回</button><button type="button" data-primary onClick={() => { reviewed.current = reviewConfig(); setStartReview(false); void run(() => control('trade')) }}>确认并开始观察</button></div>
    </ActionDialog>}

  </div>
}
