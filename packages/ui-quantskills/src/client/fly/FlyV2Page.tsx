import { flyFetch } from './transport.ts'
import { useEffect, useRef, useState } from 'react'
import ResizableNativeTable from './FlyTable.tsx'
import FlyHomeV2, { type BodyState } from './FlyHomeV2'
import { FlyReplayLab } from './FlyReplay.tsx'
import './fly-v2.css'
import { collapseNeuralWaits } from './flyJournal'
import { LifeTrace, lifeGoals } from './LifeTrace'
import { TradeLoop, type TradeMarket } from './TradeLoop'
import { TradeStatistics } from './TradeStatistics'
import { TradeLearning } from './TradeLearning'
import { TradeAnalytics } from './TradeAnalytics'
import { RuntimeContinuity, type Continuity } from './RuntimeContinuity'
import { TradeFilterControls, type TradeFilterSettings } from './TradeFilterControls'
import { waitForCompetition } from '../competition-async.ts'
import type { ContestAccess } from '../contest.ts'
import type { ContestStatus } from '../plugin-types.ts'
import { FlyHistory, useRetryCountdown, type HistoryStatus } from './FlyHistory.tsx'

type Settings = TradeFilterSettings & { instruments: { product: string; symbol: string; exchange: string }[]; name: string; account: string; target_notional: number; total_notional: number; loss_limit: number; jev_daily_calls: number; ai_daily_calls: number; scenes_daily: number; model_calls_unlimited: boolean; ai_provider: string; jev_provider: 'typesafe'; jev_enabled: boolean; learning: boolean; life_validation: boolean; onboarding_complete: boolean }
type Layout = { id: string; width: number; height: number }
type Event = { seq: number; at: number; actor: string; kind: string; decision_id: string; payload: Record<string, any>; merged_count?: number }
type Market = TradeMarket & { product: string; symbol?: string; price?: number; count: number; readiness: string; chart: number[]; long: number; short: number; history_source?: { at?: number | null; error?: string }; allocation?: { lots: number; target_notional: number; actual_notional: number; deviation_pct: number } }
type Status = Continuity & { history?: HistoryStatus; binding?: { identity: { contestId: string; accountId: string } } | null; trade_events?: Event[]; history_error?: string; connection?: { status: string; message: string; retry_at?: number | null; updated_at?: number }; name: string; settings: Settings; control: { paused: boolean; trading: boolean; close_only?: boolean }; neural: { status: string; message?: string; total_spikes?: number; activity?: Record<string, number>; sim_ms?: number; updates?: Record<string, number>; life_controller?: {interface: string; readout_neurons: number}; motor_controller?: {interface: string; readout_neurons: number}; motor?: {drive: number; turn: number; confidence: number; active_readout_neurons: number; reason: string}; sensory?: {visible_food: number; sector: number} }; world: BodyState; home: { name: string }; home_version: string; markets: Market[]; usage: Record<string, number>; events: Event[]; account?: Record<string, any>; runtime?: Record<string, any>; accounts: { name: string }[]; layout: Layout[]; checkpoints: string[]; environment: { blender: string; brain_ready: boolean; blender_ready: boolean; progress: { status: string; stage?: string; message?: string; done?: number; total?: number } }; onboarding: boolean; versions: { id: string; name: string }[]; scene_jobs: { id: string; status: string; description: string; error?: string; attempt: number }[] }
const labels: Record<string, string> = { trade_learning: '交易反馈学习', statistics: '成交与盈亏统计', life_trace: '生活因果链', markets: '市场观察', positions: '持仓与等价值', orders: '委托回报', trades: '确认成交', equity: '账户权益', intent: '当前目标', neural: '神经活动', learning: '学习与检查点', usage: '模型用量' }
const goals: Record<string, string> = { idle: '没有有效目标', forage: '神经感知与取食', observe: '观察市场', explore: '探索家园', eat: '享用果实', rest: '主动休息', interact: '物件互动' }
const actions: Record<string, string> = { turning: '按神经输出转向', avoiding: '碰撞边界已拦截，等待神经避障', idle: '等待有效神经运动信号', flying: '正在飞行', eating: '正在取食', resting: '正在休息', watching: '正在观察', touching: '正在互动', exploring: '正在探索' }
const environmentNames: Record<string, string> = { daylight: '日光', breeze: '微风', quiet: '安静', dew: '露水', replenish: '补充果实' }
const actors: Record<string, string> = { fly: '果蝇决定', jev: 'Jev 辅助', user: '用户影响', counter: '柜台回报', language_ai: '语言 AI', execution: '交易执行', system: '系统', reporter: '事实报告', scene_builder: '家园构建' }
const names: Record<string, string> = { IF: '沪深 300', IM: '中证 1000', au: '黄金', ag: '白银', rb: '螺纹', m: '豆粕', sc: '原油' }
const fmt = (v?: number | null) => v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await flyFetch(`/api/fly/v2/${path}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const result = await response.json(); if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : '请求未完成，请检查输入')
  return result
}
function contractCode(data: unknown, product: string): string {
  const row = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : {}
  const raw = row.contractCode ?? row.symbol
  const code = typeof raw === 'string' ? raw.split('.')[0]!.trim() : ''
  if (!new RegExp(`^${product}[0-9]{4}$`, 'i').test(code)) throw new Error('比赛行情未返回该品种的实际合约代码。')
  return product + code.slice(product.length)
}
function deliveryMonths(product: string, main: string): string[] {
  const year = Number(main.slice(product.length, -2)), month = Number(main.slice(-2))
  return Array.from({ length: 13 }, (_, offset) => {
    const date = new Date(Date.UTC(2000 + year, month - 1 + offset, 1))
    return `${product}${String(date.getUTCFullYear() % 100).padStart(2, '0')}${String(date.getUTCMonth() + 1).padStart(2, '0')}`
  }).filter(code => code !== main)
}
function FlyInstrumentContract({ product, label, symbol, invalid, contest, accountKey, onSymbolChange }: {
  product: string; label: string; symbol: string; invalid: boolean; contest?: Pick<ContestAccess, 'query'> | undefined; accountKey: string
  onSymbolChange: (value: string, onlyIfEmpty?: boolean) => void
}) {
  const [main, setMain] = useState(''), [message, setMessage] = useState(''), [checking, setChecking] = useState(false)
  const request = useRef(0)
  useEffect(() => {
    setMain(''); setChecking(false)
    if (!contest || !accountKey) { setMessage('先点击上方「连接比赛账户」，无需填写合约。也可手动填写实际合约。'); return }
    const controller = new AbortController(), id = ++request.current
    setChecking(true); setMessage('正在查询当前主力合约…')
    void waitForCompetition(signal => contest.query({ kind: 'quote', symbol: product }, signal), '主力合约查询', 30_000, controller.signal)
      .then(result => { if (id !== request.current) return; const code = contractCode(result.data, product); setMain(code); onSymbolChange(code, true); setMessage(`当前主力 ${code} · 来自比赛行情`) })
      .catch(error => { if (id === request.current) setMessage(`主力查询失败：${String(error).replace(/^(?:Error|RemoteFailure): /, '')} 可手动填写实际合约。`) })
      .finally(() => { if (id === request.current) setChecking(false) })
    return () => { request.current++; controller.abort() }
  }, [contest, product, accountKey])
  async function selectMonth(code: string) {
    if (!code) return
    if (code === main) { onSymbolChange(code); setMessage(`当前主力 ${code} · 来自比赛行情`); return }
    if (!contest) return
    const id = ++request.current
    setChecking(true); setMessage(`正在核对 ${code}…`)
    try {
      const result = await waitForCompetition(signal => contest.query({ kind: 'quote', symbol: code }, signal), '月份合约查询', 30_000)
      if (id !== request.current) return
      if ((result.data && typeof result.data === 'object' && !Array.isArray(result.data) && result.data.ready === false) || contractCode(result.data, product).toLowerCase() !== code.toLowerCase()) throw new Error('比赛行情未确认该月份合约。')
      onSymbolChange(code); setMessage(`${code} 已由比赛行情确认`)
    } catch (error) { if (id === request.current) setMessage(`${code} 无法确认：${String(error).replace(/^(?:Error|RemoteFailure): /, '')}`) }
    finally { if (id === request.current) setChecking(false) }
  }
  const months = main ? deliveryMonths(product, main) : []
  return <div className="fv-contract-choice"><input aria-label={`${label}实际合约`} aria-invalid={invalid} placeholder="填写实际合约代码" value={symbol} onChange={e => { request.current++; setChecking(false); onSymbolChange(e.target.value.trim()); setMessage('手动填写的合约将在交易前核对。') }} /><select aria-label={`${label}合约月份`} value={[main, ...months].includes(symbol) ? symbol : ''} disabled={!main || checking} onChange={e => void selectMonth(e.target.value)}><option value="">选择合约月份</option>{main && <option value={main}>主力 · {main}</option>}{months.map(code => <option key={code} value={code}>{code} · 候选月份</option>)}</select><small role="status">{message || '选择品种后查询主力合约'}</small></div>
}
function Spark({ data }: { data: number[] }) {
  if (data.length < 2) return <div className="fv-no-chart">等待真实分钟线</div>
  const min = Math.min(...data), span = Math.max(.01, Math.max(...data) - min)
  return <svg className="fv-spark" viewBox="0 0 200 60" preserveAspectRatio="none" aria-label={`最近 ${data.length} 根收盘价`}><polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={data.map((v, i) => `${i / (data.length - 1) * 200},${55 - (v - min) / span * 48}`).join(' ')} /></svg>
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

export default function FlyV2Page({ active, contest, openModelSettings, preparing = false, prepareMessage, onPrepare }: {
  active: boolean; contest?: Pick<ContestAccess, 'query' | 'status' | 'mode' | 'connect'> | undefined; openModelSettings?: (() => void) | undefined; preparing?: boolean; prepareMessage?: string | undefined; onPrepare?: ((blenderPath: string) => Promise<unknown>) | undefined
}) {
  const [status, setStatus] = useState<Status>()
  const [tab, setTab] = useState<'dashboard' | 'home' | 'talk' | 'replay' | 'analysis'>('dashboard')
  const [error, setError] = useState(''); const [pending, setPending] = useState(false)
  const [setupError, setSetupError] = useState('')
  const connectionCooldown = useRetryCountdown(status?.connection?.retry_at)
  const [blenderPath, setBlenderPath] = useState('')
  const [setup, setSetup] = useState(false); const [step, setStep] = useState(0)
  const [contestStatus, setContestStatus] = useState<ContestStatus>(), [contestError, setContestError] = useState('')
  const contestRevision = useRef(0)
  const accountKey = contestStatus?.enabled && contestStatus.phase === 'connected' && contestStatus.identity ? JSON.stringify(contestStatus.identity) : ''
  const [draft, setDraft] = useState<Settings>()
  const [models, setModels] = useState<{ profiles: { provider_id: string; label: string; configured: boolean }[]; jev_configured: boolean; jev_providers: { id: string; label: string; model: string; configured: boolean }[] }>()
  const [edit, setEdit] = useState(false); const [layout, setLayout] = useState<Layout[]>([])
  const [oracle, setOracle] = useState(''); const [description, setDescription] = useState('')
  const [report, setReport] = useState(''); const [filter, setFilter] = useState('all')
  const loaded = useRef(false); const dragging = useRef('')
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
          if (!loaded.current) { loaded.current = true; setDraft(result.settings); setLayout(result.layout); setSetup(result.onboarding); setBlenderPath(result.environment.blender) }
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
  async function finishLayout() { await api('layout', layout); setEdit(false) }
  function openSetup() { if (status) setDraft(status.settings); setSetupError(''); setSetup(true); setStep(0) }
  function checkInstruments(): boolean {
    const invalid = draft?.instruments.filter(item => !/^[A-Za-z]{1,3}[0-9]{3,4}$/.test(item.symbol.trim())) ?? []
    if (!invalid.length) return true
    setSetupError(`请为已选品种填写实际合约代码（如 rb2610），或取消勾选：${invalid.map(item => names[item.product] || item.product).join('、')}`)
    setStep(2)
    return false
  }
  if (!status) return <div className="fv-page fv-loading"><div className="fv-orbit">✦</div><h2>正在连接小果的世界</h2><p>{error || '恢复个体、记忆与家园…'}</p></div>
  const s = status
  const running = !s.control.paused && s.neural.status === 'ready'
  const account = s.account?.official || {}
  const events = collapseNeuralWaits(s.events).filter(e => filter === 'all' || e.actor === filter).reverse()
  const waiting = s.world.wait_reason
  const motionText = waiting ? waiting.message + (waiting.recovery_seconds != null ? `（约 ${waiting.recovery_seconds} 秒）` : '') : actions[s.world.action]
  function widget(id: string) {
    if (id === 'trade_learning') return <TradeLearning />
    if (id === 'statistics') return <TradeStatistics />
    if (id === 'life_trace') return <LifeTrace trace={s.world.life_trace} previous={s.world.last_life_feedback} />
    if (id === 'markets') return <div className="fv-markets">{s.markets.map(m => <div className="fv-market" key={m.product}><div><strong>{m.product}</strong><span>{names[m.product]}</span></div><b>{fmt(m.price)}</b><Spark data={m.chart} /><small>{m.symbol || '等待具体合约'} · {m.count}/500</small><em className={m.readiness === 'ready' ? 'ready' : ''}>{({ ready: '行情就绪', history_incomplete: '等待历史补齐', history_gap: '分钟线有缺口', quote_stale: '等待新鲜报价', bars_stale: '等待分钟线' } as Record<string, string>)[m.readiness]}</em></div>)}</div>
    if (id === 'intent') return <><span className="fv-kicker">当前选择</span><h2 className="fv-goal">{waiting?.code === 'food_depleted' ? '等待果实成熟' : goals[s.world.goal]}</h2><p>{motionText}</p><div className="fv-states">{[['energy', '精力'], ['hunger', '饥饿'], ['curiosity', '好奇'], ['stress', '压力']].map(([key = '', label]) => <div key={key}><span>{label}</span><meter min="0" max="1" value={s.world[key as keyof BodyState] as number} /><small>{Math.round((s.world[key as keyof BodyState] as number) * 100)}%</small></div>)}</div><small className="fv-note">模拟内部状态 · 来源于活动消耗、取食和休息反馈</small></>
    if (id === 'neural') return <><div className="fv-stat"><strong>{fmt(s.neural.total_spikes)}</strong><span>全网放电（含背景驱动）</span></div>{s.neural.motor_controller && <div className="fv-neural-proof"><b>{s.neural.life_controller ? '神经生活读出 · 无动作抽签' : '视觉神经反射 · 无动作抽签'}</b><p>工程感觉 → L1/L2/L3/L5 放电 → 目标与运动读出</p><span>读出活跃 {s.neural.motor?.active_readout_neurons || 0} / {s.neural.motor_controller.readout_neurons} 个</span><p>标定匹配度 {Math.round((s.neural.motor?.confidence || 0) * 100)}% · 可见食物 {s.neural.sensory?.visible_food || 0}</p><small>感觉、目标竞争和运动接口有工程设定；尚未重建天然目标及下行运动回路。匹配度不是神经占比。</small></div>}<div className="fv-rate-list">{Object.entries(s.neural.activity || {}).map(([k, v]) => <div key={k}><span>{k}</span><b>{v.toFixed(2)} Hz</b></div>)}</div><small className="fv-note">MaleCNS 连接组冻结 · 神经累计 {fmt((s.neural.sim_ms || 0) / 1000)} 秒<br />视觉动画采用独立时钟</small></>
    if (id === 'positions') return <ResizableNativeTable resizeStorageKey="fly-v2-positions"><thead><tr><th>品种</th><th>多 / 空</th><th>目标名义</th><th>实际 / 偏差</th></tr></thead><tbody>{s.markets.map(m => <tr key={m.product}><td>{m.product}</td><td>{m.long} / {m.short}</td><td>{fmt(s.settings.target_notional)}</td><td>{m.allocation ? `${fmt(m.allocation.actual_notional)} / ${m.allocation.deviation_pct.toFixed(1)}%` : '等待报价'}</td></tr>)}</tbody></ResizableNativeTable>
    if (id === 'trades' || id === 'orders') {
      const rows = (s.trade_events || s.events).filter(e => id === 'trades' ? e.kind === 'trade' : ['order_return', 'order_submitted', 'order_error', 'order_unknown', 'execution_gate'].includes(e.kind)).reverse()
      return rows.length ? <div className="fv-mini-events">{rows.map(e => <div key={e.seq}><time>{new Date(e.at * 1000).toLocaleTimeString()}</time><span>{eventText(e)}</span><small>#{e.seq} · {e.decision_id.slice(0, 8)}</small></div>)}</div> : <div className="fv-empty"><span>◌</span><p>{id === 'trades' ? '暂无柜台确认成交' : '暂无委托记录'}</p><small>实际回报到达后会显示在这里</small></div>
    }
    if (id === 'equity') return <><div className="fv-stat"><strong>{fmt(account.balance ?? account.Balance)}</strong><span>柜台账户权益</span></div><p>总名义占用上限 ¥{fmt(s.settings.total_notional)}</p><p>损失上限 ¥{fmt(s.settings.loss_limit)}</p><small className="fv-note">账户状态：{s.account?.engine?.state || '未连接'}</small></>
    if (id === 'learning') return <><div className="fv-learning-badges"><span>{s.settings.learning ? '生活目标：读出层学习' : '生活目标：读出层冻结'}</span><span>确定性神经交易读出 v2</span></div><p>本版生活读出更新 <b>{s.neural.updates?.life || 0}</b> 次 · 交易更新 <b>{s.neural.updates?.trade || 0}</b> 次</p><div className="fv-actions"><button type="button" disabled={pending} onClick={() => void run(async () => { await api('settings', { ...s.settings, learning: !s.settings.learning }) })}>{s.settings.learning ? '冻结学习' : '恢复学习'}</button><button type="button" disabled={pending || !running} onClick={() => void run(() => control('checkpoint'))}>保存检查点</button></div><select aria-label="恢复学习检查点" defaultValue="" disabled={pending || !s.control.paused} onChange={e => { if (e.target.value) void run(() => control('restore', e.target.value)); e.target.value = '' }}><option value="">暂停后恢复检查点</option>{s.checkpoints.slice().reverse().map(v => <option key={v} value={v}>{v}</option>)}</select><small className="fv-note">奖励按已发生结果记账；未验证全脑学习或意识。</small></>
    return <><div className="fv-rate-list">{[['ai', '语言 AI', s.settings.ai_daily_calls], ['jev', 'Jev 辅助', s.settings.jev_daily_calls], ['scenes', '家园生成', s.settings.scenes_daily]].map(([key, label, max]) => <div key={key}><span>{label}</span><b>{s.usage[String(key)] || 0} 次 · {s.settings.model_calls_unlimited ? '不限次数' : `上限 ${max} 次`}</b></div>)}</div><small className="fv-note">今日果蝇自动调用，失败请求计数。<br />不含 AI 助手其他对话；未估算服务费用。</small><button type="button" onClick={openSetup}>调整额度</button></>
  }
  return <div className="fv-page">
    <header className="fv-header"><div className="fv-identity"><div className="fv-avatar">✦</div><div><div className="fv-kicker">QuantStudio · AUTONOMOUS LIFE</div><h1>{s.name}<span>一只持续感知的数字果蝇</span></h1></div></div><div className="fv-header-actions"><span className={`fv-status ${running ? 'on' : ''}`}><i />{running ? '生活进行中' : s.neural.status === 'loading' ? '神经模型启动中' : '已暂停'}</span><button type="button" onClick={openSetup}>设置</button><button type="button" className="fv-primary" disabled={pending} onClick={() => void run(() => control(s.control.paused ? 'start' : 'pause'))}>{s.control.paused ? '唤醒小果' : '暂停个体'}</button></div></header>
    {!s.environment.brain_ready && <div className="fv-runtime-note" role="status">专用 Python 与 MaleCNS 尚未准备。{preparing ? prepareMessage : '打开设置，点击「一键准备果蝇」后自动下载并校验。'} <button type="button" onClick={openSetup}>打开环境设置</button></div>}
    <nav className="fv-nav" aria-label="果蝇栏目">{[['dashboard', '看板', '01'], ['home', '家园', '02'], ['talk', '交流', '03'], ['analysis', '交易分析', '04']].map(([key, label, number]) => <button type="button" className={tab === key ? 'selected' : ''} onClick={() => setTab(key as typeof tab)} key={key}><small>{number}</small>{label}</button>)}<div className="fv-nav-right"><span>{s.control.trading ? (s.control.close_only ? 'PANDAAI · 本轮只平仓' : 'PANDAAI · 交易建议') : 'PANDAAI · 观察模式'}</span><button type="button" onClick={() => setTab('replay')}>事件回放 ↗</button></div></nav>
    <RuntimeContinuity status={s} />
    <TradeFilterControls settings={s.settings} onApply={value => api('trade-filters', value)} />
    {error && <div role="alert" className="fv-error">{error}<button type="button" onClick={() => setError('')}>关闭</button></div>}
    {s.neural.message && <p className="fv-runtime-note">{s.neural.message}</p>}
    {tab === 'dashboard' && <><div className="fv-section-line"><div><h2>观察它，也观察市场</h2><p>已选品种 · {s.settings.trade_period_minutes || 1} 分钟 · PandaData 原生周期 · 各 500 根已完成 K 线</p></div><div className="fv-actions"><button type="button" disabled={pending} onClick={() => { openSetup(); setStep(2) }}>行情配置</button><button type="button" disabled={pending || s.settings.life_validation} onClick={() => void run(() => control(s.control.trading ? 'observe' : 'trade'))}>{s.settings.life_validation ? '生活验证期间仅观察' : s.control.trading ? '停止交易建议' : '开始生成待确认计划'}</button>{layout.some(item => item.id === 'trade_learning') && <button type="button" onClick={() => document.getElementById('fly-trade-learning')?.scrollIntoView({ block: 'start', behavior: 'smooth' })}>查看交易学习</button>}<button type="button" onClick={() => { if (edit) void run(finishLayout); else setEdit(true) }}>{edit ? '完成布局' : '编辑看板'}</button></div></div>
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
      {s.control.trading && <div className="fv-actions"><button type="button" disabled={pending} onClick={() => void run(() => control(s.control.close_only ? 'trade' : 'close_only'))}>{s.control.close_only ? '恢复开仓' : '本轮只平仓'}</button><small className="fv-note">{s.control.close_only ? '暂停新增仓位，已有仓位仍由神经模型选择平仓时机；全账户平仓后结算学习反馈。' : '结束本轮新增开仓后，可以等待现有仓位平仓并验证学习反馈。'}</small></div>}
      <TradeLoop markets={s.markets} observing={!s.control.trading} />
      {edit && <div className="fv-layout-tools"><span>拖动标题排序 · 右下角调高 · 选择卡片宽度</span><select aria-label="添加看板组件" value="" onChange={e => setLayout([...layout, { id: e.target.value, width: 6, height: 280 }])}><option value="">＋ 添加组件</option>{Object.keys(labels).filter(k => !layout.some(x => x.id === k)).map(k => <option key={k} value={k}>{labels[k]}</option>)}</select><button type="button" onClick={() => void run(async () => { await api('layout', layout); setEdit(false) })}>保存布局</button><button type="button" onClick={() => void run(async () => setLayout(await api<Layout[]>('layout/reset', {})))}>恢复默认</button></div>}
      <div className="fv-grid">{layout.map(item => <section className={`fv-widget ${edit ? 'editing' : ''}`} style={{ gridColumn: `span ${item.width}`, height: item.height }} key={item.id} onDragOver={e => { if (edit) e.preventDefault() }} onDrop={() => { const next = layout.filter(x => x.id !== dragging.current), moved = layout.find(x => x.id === dragging.current); if (moved) { next.splice(Math.max(0, next.findIndex(x => x.id === item.id)), 0, moved); setLayout(next) } }} onPointerUp={e => { if (edit) { const height = Math.round(e.currentTarget.getBoundingClientRect().height); if (height !== item.height) setLayout(layout.map(x => x.id === item.id ? { ...x, height: Math.max(180, Math.min(800, height)) } : x)) } }}><header draggable={edit} onDragStart={() => { dragging.current = item.id }}><h3>{edit ? '⠿ ' : ''}{labels[item.id]}</h3>{edit && <div><select aria-label={`${labels[item.id]}宽度`} value={item.width} onChange={e => setLayout(layout.map(x => x.id === item.id ? { ...x, width: Number(e.target.value) } : x))}>{[3, 4, 6, 8, 12].map(v => <option key={v} value={v}>{v}/12</option>)}</select><button type="button" aria-label={`移除${labels[item.id]}`} onClick={() => setLayout(layout.filter(x => x.id !== item.id))}>×</button></div>}</header><div className="fv-widget-content">{widget(item.id)}</div></section>)}</div></>}
    {tab === 'home' && <><div className="fv-section-line"><div><h2>{s.home.name}</h2><p>它的空间，它正在发生的生活</p></div><span className="fv-pill">{goals[s.world.goal]} · {motionText}</span></div><div className="fv-home-layout"><div className="fv-home-stage"><FlyHomeV2 body={s.world} version={s.home_version} paused={!running} /><div className="fv-home-footer"><div><small>当前位置</small><strong>{s.world.position.map(v => v.toFixed(1)).join(' / ')}</strong></div><div><small>环境事件</small><strong>{({ daylight: '柔和日光', breeze: '微风', quiet: '安静时刻', dew: '花园露水' } as Record<string, string>)[s.world.event]}</strong></div><div><small>精力</small><strong>{Math.round(s.world.energy * 100)}%</strong></div></div></div><aside className="fv-home-editor"><span className="fv-kicker">MAKE IT A HOME</span><h2>为它创造一个世界</h2><p>用中文描述空间。AI 助手与 Blender 会完成生成、检查和装入。</p><textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={3000} placeholder="例如：一座温暖的苔藓花园，有果实、叶片睡床和一张小小的行情桌。" /><button type="button" className="fv-primary" disabled={pending || !description.trim()} onClick={() => void run(async () => { await api('homes', { description }); setDescription('') })}>创造家园 ↗</button><small className="fv-note">使用首次设置中选择的 QuantStudio 模型。造景失败时保留当前家园。</small><hr /><h3>家园版本</h3><select aria-label="选择家园版本" value={s.home_version} onChange={e => void run(async () => { await api('homes/restore', { version: e.target.value }) })}><option value="default">默认 · 晨光温室</option>{s.versions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select>{s.scene_jobs.slice(-3).reverse().map(j => <div className="fv-job" key={j.id}><b>{({ planning: '规划场景', building: 'Blender 构建中', checking: '检查交互与模型', complete: '家园已载入', failed: '生成未完成' } as Record<string, string>)[j.status]}</b><small>{j.description}</small>{j.error && <p>{j.error}</p>}</div>)}</aside></div></>}
    {tab === 'talk' && <div className="fv-talk-layout"><section className="fv-oracle"><span className="fv-kicker">A MESSAGE FROM ABOVE</span><h2>给小果一条神谕</h2><p>信息、建议和长期偏好会进入记忆。<br />因果验证期间，神谕保存为记忆，不直接改动作分数。</p><textarea value={oracle} onChange={e => setOracle(e.target.value)} maxLength={2000} placeholder="今天也去花园里探索一下吧。" /><button type="button" className="fv-primary" disabled={pending || !oracle.trim()} onClick={() => void run(async () => { await api('oracle', { text: oracle }); setOracle('') })}>送入记忆</button><small className="fv-note">暂停和交易额度请使用独立控制按钮。</small><hr /><h3>最近发生了什么</h3><button type="button" disabled={pending} onClick={() => void run(async () => setReport((await api<{ text: string }>('report', {})).text))}>生成事实报告</button>{report && <p className="fv-report">{report}</p>}</section><section className="fv-journal"><header><h2>生活与交易记录</h2><select aria-label="记录来源" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">所有来源</option>{Object.entries(actors).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></header>{events.length ? events.map(e => <article key={e.seq}><div className={`fv-event-dot ${e.actor}`} /><div><div className="fv-event-meta"><b>{actors[e.actor] || e.actor}</b><time>{new Date(e.at * 1000).toLocaleTimeString()}</time><small>#{e.seq}</small></div><p>{eventText(e)}</p>{e.decision_id && <small className="fv-note">决策 {e.decision_id.slice(0, 12)}</small>}</div></article>) : <div className="fv-empty">唤醒后，这里会记录它的选择与经历。</div>}</section></div>}
    {tab === 'analysis' && <TradeAnalytics active={active} />}
    {tab === 'replay' && <FlyReplayLab active={active} />}
    {setup && draft && <div className="fv-modal-backdrop"><section className="fv-setup" role="dialog" aria-modal="true" aria-label="果蝇首次设置"><header><div><span className="fv-kicker">WELCOME HOME · {step + 1} / 4</span><h2>{['准备它的身体与世界', '连接你已有的模型', '设定可用额度', '一切从这里开始'][step]}</h2></div><button type="button" onClick={() => setSetup(false)} aria-label="关闭设置">×</button></header><div className="fv-steps">{['环境', '模型', '额度', '进入'].map((label, i) => <button type="button" className={step === i ? 'current' : ''} key={label} onClick={() => setStep(i)}>{i + 1} {label}</button>)}</div>
      {step === 0 && <div className="fv-setup-body"><p>点击准备后自动下载并校验专用 Python 与 MaleCNS；优先复用你选择的本机 Blender，未配置时下载专用版本。数据保存在用户目录，升级不会清空。</p><div className="fv-check-row"><span>专用 Python 与 MaleCNS</span><b>{s.environment.brain_ready ? '已就绪' : preparing || s.environment.progress.status === 'running' ? '准备中' : '尚未准备'}</b></div><div className="fv-check-row"><span>Blender</span><b>{s.environment.blender_ready ? '已就绪' : '尚未准备'}</b></div><label>已有 Blender 安装路径<input aria-label="已有 Blender 安装路径" value={blenderPath} onChange={e => setBlenderPath(e.target.value)} placeholder="安装目录或 blender.exe 的完整路径" /></label><button type="button" disabled={pending || !blenderPath.trim() || s.environment.progress.status === 'running'} onClick={() => void run(async () => { await api('environment/config', { blender_path: blenderPath.trim() }) })}>验证并使用本机 Blender</button><small>{s.environment.blender}</small><button type="button" className="fv-primary" disabled={pending || preparing || s.environment.progress.status === 'running' || (s.environment.brain_ready && s.environment.blender_ready)} onClick={() => void run(async () => { if (!onPrepare) throw new Error('准备服务未连接'); await onPrepare(blenderPath.trim()) })}>{preparing || s.environment.progress.status === 'running' ? '正在准备…' : '一键准备果蝇 / 重试'}</button><p role="status">{s.environment.progress.status === 'error' ? `准备失败：${s.environment.progress.message || '请重试'}` : s.environment.progress.stage ? `${s.environment.progress.stage} ${s.environment.progress.message || ''}` : prepareMessage || '尚未开始；点击上方按钮准备。'}</p>{!!s.environment.progress.total && <progress value={s.environment.progress.done} max={s.environment.progress.total} />}</div>}
      {step === 1 && <div className="fv-setup-body"><label>QuantStudio 已接入模型<select value={draft.ai_provider} onChange={e => setDraft({ ...draft, ai_provider: e.target.value })}><option value="">暂不启用语言辅助</option>{(models?.profiles || []).map(m => <option key={m.provider_id} value={m.provider_id}>{m.label}</option>)}</select></label><button type="button" disabled={pending || !draft.ai_provider} onClick={() => void run(async () => { await api('settings', draft); await api('models/test', {}); setError('语言模型连接成功') })}>测试语言模型连接</button><p>列表来自「设置 → 模型服务」中你接入并验证成功的模型，直接复用原有连接和密钥。测试计入果蝇每日调用次数。</p><div className="fv-check-row"><span>Jev · 统一模型服务</span><b>{models?.jev_configured ? '已配置' : 'API Key 未配置'}</b></div><p>Jev API Key 请在「设置 → 模型服务 → Jev」中配置，与比赛页共用。</p>{openModelSettings && <button type="button" onClick={openModelSettings}>前往模型服务配置 Jev</button>}<label className="fv-checkbox"><input type="checkbox" checked={draft.jev_enabled} onChange={e => setDraft({ ...draft, jev_enabled: e.target.checked })} />启用 Jev 生活环境辅助</label><button type="button" disabled={pending || !models?.jev_configured} onClick={() => void run(async () => { await api('settings', draft); await api('jev/test', {}); setError('Jev 连接成功') })}>测试 Jev 连接</button><p>Jev 辅助生活环境，果蝇神经读出决定交易建议。独立的 Jev 盯盘仍在比赛页。</p></div>}
      {step === 2 && <div className="fv-setup-body"><label className="fv-checkbox"><input type="checkbox" checked={draft.model_calls_unlimited} onChange={e => setDraft({ ...draft, model_calls_unlimited: e.target.checked })} />语言 AI、Jev 与造景不限调用次数</label><small className="fv-note">仍统计实际用量；果蝇神经运行没有每日次数上限。</small><div className="fv-form-grid">{[['ai_daily_calls', '语言 AI / 日'], ['jev_daily_calls', 'Jev 调用 / 日'], ['scenes_daily', '造景次数 / 日'], ['target_notional', '每品种目标名义金额 ¥'], ['total_notional', '总名义占用上限 ¥'], ['loss_limit', '账户损失上限 ¥']].map(([key = '', label]) => <label key={key}>{label}<input type="number" min="0" disabled={draft.model_calls_unlimited && ['ai_daily_calls', 'jev_daily_calls', 'scenes_daily'].includes(key)} value={draft[key as keyof Settings] as number} onChange={e => setDraft({ ...draft, [key]: Math.max(0, Number(e.target.value)) })} /></label>)}</div><fieldset><legend>观察的实际合约</legend><div className="fv-check-row"><span>1 · 连接比赛账户</span><b>{accountKey ? '账户已连接' : !contest ? '比赛服务不可用' : contestStatus ? '账户未连接' : '正在读取账户状态…'}</b></div><p>连接账户无需实际合约。首次连接会打开比赛授权页，完成后自动查询已选品种的主力。</p><button type="button" disabled={pending || !!accountKey || !contest} onClick={() => void run(connectContestAccount)}>{accountKey ? '比赛账户已连接' : pending ? '正在连接账户…' : '连接比赛账户'}</button>{contestError && <p role="alert">{contestError}</p>}<p>2 · 勾选品种，自动填入当前主力；其他月份选择后核对。保存配置后，在看板单独点击「连接比赛行情」。仅体验生活可跳过连接。</p>{Object.entries(names).map(([product, label]) => {
          const configured = draft.instruments.find(i => i.product === product)
          const exchange = ({ IF: 'CFE', IM: 'CFE', au: 'SHF', ag: 'SHF', rb: 'SHF', m: 'DCE', sc: 'INE' } as Record<string, string>)[product]!
          return <div key={product} className="fv-instrument"><label><input type="checkbox" checked={!!configured} onChange={e => { setSetupError(''); setDraft({ ...draft, instruments: e.target.checked ? [...draft.instruments, { product, symbol: '', exchange }] : draft.instruments.filter(i => i.product !== product) }) }} />{label} · {product}</label>{configured && <FlyInstrumentContract product={product} label={label} symbol={configured.symbol} invalid={!!setupError && !/^[A-Za-z]{1,3}[0-9]{3,4}$/.test(configured.symbol)} contest={contest} accountKey={accountKey} onSymbolChange={(value, onlyIfEmpty) => { setSetupError(''); setDraft(current => current ? { ...current, instruments: current.instruments.map(item => item.product === product && (!onlyIfEmpty || !item.symbol.trim()) ? { ...item, symbol: value } : item) } : current) }} />}</div>
        })}</fieldset><label className="fv-checkbox"><input type="checkbox" checked={draft.life_validation} onChange={e => setDraft({ ...draft, life_validation: e.target.checked })} />仅验证生活（不生成交易选择）</label><p>交易额度为 0 时只观察。整数手造成的等价值偏差会显示在看板。</p><small className="fv-note">模型用量按调用次数统计，不是服务商账单。</small></div>}
      {step === 3 && <div className="fv-setup-body"><div className="fv-welcome-star">✦</div><label>给它一个名字<input maxLength={24} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label><p>关闭网页后，QuantStudio 后台仍运行时它会继续生活。<br />退出应用后停止；重启恢复记忆，交易建议保持关闭。</p><p>它的神经连接组保持冻结，在线学习发生在决策读出层。内部状态是模拟变量。</p></div>}
      {setupError && <p role="alert" className="fv-error">{setupError}</p>}
      <footer><button type="button" onClick={() => { setSetupError(''); if (step > 0) setStep(step - 1); else setSetup(false) }}>{step ? '上一步' : '稍后设置'}</button><button type="button" className="fv-primary" disabled={pending || (step === 3 && (!s.environment.brain_ready || !s.environment.blender_ready))} onClick={() => { if (step >= 2 && !checkInstruments()) return; if (step < 3) { setSetupError(''); setStep(step + 1) } else void run(async () => { await api('settings', { ...draft, onboarding_complete: true }); if (s.onboarding) { await control('start'); setTab('home') }; setSetup(false) }) }}>{step < 3 ? '下一步' : s.onboarding ? '进入家园' : '保存配置'}</button></footer></section></div>}
  </div>
}
