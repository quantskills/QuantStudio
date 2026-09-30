import { GearSixIcon, WaveformIcon, PencilSimpleIcon, CaretDownIcon, CaretRightIcon, StackIcon, SlidersHorizontalIcon, TimerIcon, QuestionIcon, ListBulletsIcon, ArrowUpRightIcon, InfoIcon, ArrowsClockwiseIcon, FloppyDiskIcon, BrainIcon, PlugsConnectedIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ContestWatchConfig, ContestWatchStatus, ContestWatchTemplate } from './plugin-types.ts'
import type { ContestAccess } from './contest.ts'
import { contestTime } from './contest.ts'
import { waitForCompetition } from './competition-async.ts'
import { JevUsage } from './JevUsage.tsx'
import { JevStrategy } from './JevStrategy.tsx'
import { JevEvidenceSettings } from './JevEvidenceSettings.tsx'
import { ContestWatchVisuals } from './ContestWatchVisuals.tsx'
import { instrumentIssue, makeTemplate, rangeTemplate, templates as builtIns, withInstrument, selectedContracts, type TemplateKind } from './jev-templates.ts'
import { useJevProducts } from './jev-catalog.ts'
import { JevInstrument } from './JevInstrument.tsx'
import { JevSettingsDisclosure } from './JevSettingsDisclosure.tsx'
import { TradingSettingsNavigation } from './TradingNavigation.tsx'
import { ExecutionModeChoice, ExecutionDisclosure, AUTOMATIC_TRADING_CONSENT } from './TradingExecution.tsx'
import { ActionDialog } from './ActionDialog.tsx'
import { TradingGuide } from './TradingGuide.tsx'
import css from './ContestPage.module.css'
import './JevWorkspace.css'

const initial = rangeTemplate()
const phases = { sampling: '正在盯盘 · 采样中', waiting_quote: '正在盯盘 · 等待行情', deciding: '正在盯盘 · Jev 分析中', checking: '正在盯盘 · 风控检查', waiting_plan: '正在盯盘 · 等待计划处理' }
const fields = [
  ['volume', '手数及持仓上限', 1, 100, 1], ['intervalSeconds', '采样间隔（秒）', 3, 86400, 1], ['decisionIntervalSeconds', '决策间隔（秒）', 3, 86400, 1],
  ['durationMinutes', '运行时长（分钟）', 5, 1440, 1], ['minConfidence', '计划置信度下限', 0.5, 1, 0.01],
  ['maxEquityDrop', '权益回落停止线（元）', 1, undefined, 1], ['maxPlans', '本次开仓计划上限', 1, 100, 1],
  ['openingCooldownSeconds', '开仓冷却时间（秒，0 不冷却）', 0, 3600, 1],
  ['minSamples', '最少有效快照', 8, 60, 1], ['maxSpread', '开仓最大买卖价差（价格单位，0 不限制）', 0, undefined, 0.01],
] as const

export function ContestWatch({ access, connected = true, openModelSettings, plans, onSummary, accountId }: { accountId?: string | undefined; onSummary?: ((value: { label: string; active: boolean }) => void) | undefined; access: NonNullable<ContestAccess['watch']>; connected?: boolean; plans?: ReactNode; openModelSettings?: (() => void) | undefined }) {
  const [settingsOpen, setSettingsOpen] = useState(false), [diagnostics, setDiagnostics] = useState(false), [review, setReview] = useState(false)
  const [quickSettings, setQuickSettings] = useState(false)
  const savedDraft = useRef<ContestWatchConfig>(initial)
  const [riskAccepted, setRiskAccepted] = useState(false)
  const { catalog, message: catalogMessage, loading: catalogLoading, refresh: refreshCatalog } = useJevProducts(access, connected)
  const [status, setStatus] = useState<ContestWatchStatus>(), [config, setConfig] = useState(initial)
  const [busy, setBusy] = useState(''), [error, setError] = useState('')
  useEffect(() => setRiskAccepted(false), [accountId, JSON.stringify(config)])
  const [templates, setTemplates] = useState<ContestWatchTemplate[]>([]), [templateName, setTemplateName] = useState(''), [templateMessage, setTemplateMessage] = useState('')
  const [saving, setSaving] = useState(false), [previousConfig, setPreviousConfig] = useState<ContestWatchConfig>()
  const [creating, setCreating] = useState(false), [newKind, setNewKind] = useState<TemplateKind>('range'), [newName, setNewName] = useState('')
  const [statusError, setStatusError] = useState('')
  const [configured, setConfigured] = useState<boolean>(), [connectionError, setConnectionError] = useState('')
  const [historyBusy, setHistoryBusy] = useState(false)
  const [refreshingSettings, setRefreshingSettings] = useState(false)
  const [settingsSection, setSettingsSection] = useState<'contract' | 'strategy' | 'limits' | 'advanced' | 'connection'>('contract')
  const settingsContent = useRef<HTMLDivElement>(null)
  useEffect(() => { if (settingsOpen) settingsContent.current?.scrollTo?.({ top: 0 }) }, [settingsOpen, settingsSection])
  function openSettings(target: 'connection' | 'launcher' | 'review' | 'strategy' = 'launcher') {
    savedDraft.current = structuredClone(config)
    setSettingsSection(target === 'connection' ? 'connection' : target === 'review' ? 'limits' : target === 'strategy' ? 'strategy' : 'contract')
    setSettingsOpen(true)
  }
  function openQuickSettings() { savedDraft.current = structuredClone(config); setQuickSettings(true); setError('') }
  function cancelSettings() { setConfig(savedDraft.current); setSettingsOpen(false); setQuickSettings(false); setError(''); setCreating(false) }
  function reveal(target: 'connection' | 'launcher' | 'review') { openSettings(target) }
  function requestStart() {
    const issue = instrumentIssue(config, catalog)
    if (issue) { setError(issue); openSettings(); return }
    setRiskAccepted(false); setReview(true)
  }
  const hydrated = useRef(false), epoch = useRef(0), pending = useRef(false)
  useEffect(() => {
    let disposed = false
    void access.templates().then(items => { if (!disposed) setTemplates(items) }).catch(() => { if (!disposed) setTemplateMessage('模板列表读取失败，请重新进入页面；内置模板仍可使用。') })
    void waitForCompetition(() => access.settings(), 'Jev 配置').then(value => { if (!disposed) setConfigured(value.configured) })
      .catch(failure => { if (!disposed) setConnectionError(failure instanceof Error ? failure.message : 'Jev 配置读取失败。') })
    return () => { disposed = true }
  }, [access])
  useEffect(() => {
    let disposed = false, timer: ReturnType<typeof setTimeout> | undefined
    const poll = async () => {
      const version = epoch.current
      try {
        if (pending.current) return
        const next = await waitForCompetition(() => access.status(), 'Jev 盯盘状态')
        if (disposed || version !== epoch.current || pending.current) return
        setStatus(next); setStatusError('')
        if (!hydrated.current) {
          if (next.config) { const restored = next.running || next.config.contracts || next.config.autoHistory || next.config.rangeRules || next.config.signalRules || next.config.customStrategy ? { ...next.config, decisionIntervalSeconds: next.config.decisionIntervalSeconds ?? 30 } : rangeTemplate(next.config.symbol); setPreviousConfig(next.config); setConfig(restored); savedDraft.current = structuredClone(restored) }
          hydrated.current = true
        }
      } catch (failure) {
        if (!disposed && version === epoch.current) setStatusError(failure instanceof Error ? failure.message : '盯盘状态读取失败。')
      } finally { if (!disposed) timer = setTimeout(() => { void poll() }, 3000) }
    }
    void poll()
    return () => { disposed = true; clearTimeout(timer); epoch.current++ }
  }, [access])
  const run = async (action: 'start' | 'stop', executionConsent?: string) => {
    if (action === 'start' && pending.current) return
    if (action === 'start') { const issue = instrumentIssue(config, catalog); if (issue) { setError(issue); return } }
    const version = ++epoch.current
    pending.current = true; setBusy(action); setError('')
    try {
      const next = await waitForCompetition(() => action === 'start' ? executionConsent ? access.start(config, executionConsent) : access.start(config) : access.stop(), action === 'start' ? '启动 Jev 盯盘' : '停止 Jev 盯盘', 120000)
      if (version === epoch.current) { setStatus(next); setStatusError(''); if (next.config) setConfig(next.config) }
    } catch (failure) {
      if (version === epoch.current) { setError(failure instanceof Error ? failure.message : '盯盘操作失败。') }
    } finally { if (version === epoch.current) { pending.current = false; setBusy('') } }
  }
  const [clock, setClock] = useState(Date.now())
  useEffect(() => {
    setClock(Date.now())
    if (!status?.nextRetryAt || status.nextRetryAt <= Date.now()) return
    const timer = setInterval(() => { setClock(Date.now()); if (Date.now() >= status.nextRetryAt!) clearInterval(timer) }, 1000)
    return () => clearInterval(timer)
  }, [status?.nextRetryAt])
  const retrySeconds = Math.max(0, Math.ceil(((status?.nextRetryAt ?? 0) - clock) / 1000))
  const locked = Boolean(!status || status.running || busy || historyBusy || saving)
  const saveTemplate = async () => {
    if (locked) return
    setSaving(true); setTemplateMessage('')
    try {
      const items = await access.saveTemplate({ name: templateName.trim() || '我的策略', config })
      setTemplates(items); const saved = items.at(-1)!
      setConfig(saved.config); setTemplateName(saved.name); setTemplateMessage('已保存至本机，同名模板会更新；重开页面后仍可使用。')
    } catch (failure) { setTemplateMessage(failure instanceof Error ? failure.message : '模板保存失败。') }
    finally { setSaving(false) }
  }
  function chooseTemplate(value: string) {
          const saved = templates.find(item => `saved:${item.name}` === value)
          if (saved) {
            const applied = config.symbol && config.instrument ? { ...withInstrument(structuredClone(saved.config), config.instrument), symbol: config.symbol, contracts: config.contracts } : structuredClone(saved.config)
            if (saved.config.symbol.toLowerCase() !== applied.symbol.toLowerCase()) applied.history = undefined
            setConfig(applied); setTemplateName(saved.name)
          } else { setConfig(makeTemplate(value as TemplateKind, config)); setTemplateName('') }
          setCreating(false); setError('')
  }
  const contractsLabel = selectedContracts(config, catalog).map(item => item.symbol || item.instrument.product.toUpperCase() + '（待填合约）').join(' / ')
  const active = Boolean(status?.running && !statusError && !busy)
  const rules = config.rangeRules ?? config.signalRules
  const phase = statusError ? 'unknown' : busy || !status ? 'pending' : status.running ? status.phase ?? 'sampling' : 'stopped'
  const label = statusError ? '连接中断 · 状态待确认' : busy === 'stop' ? '正在停止盯盘' : busy === 'start' ? '正在启动盯盘'
    : !status ? '正在读取盯盘状态' : status.running ? phases[status.phase ?? 'sampling'] : '盯盘未运行'
  useEffect(() => { onSummary?.({ label, active }) }, [onSummary, label, active])
  const guide = <TradingGuide compact triggerIcon={<QuestionIcon size={17} aria-hidden="true"/>} name="JEV" steps={[
      { title: '连接账户与模型', status: !connected ? '比赛账户待连接' : configured ? '账户已连接 · 密钥已配置' : '模型配置待核验', ready: connected && configured === true,
        body: '先在本页上方连接期货模拟赛账户，再到「设置 → 模型服务 → Jev」填写 TypeSafe API Key，点击测试并保存。比赛账户授权、Jev 密钥、PandaData 历史数据授权是三项独立配置。',
        note: 'Jev 连接测试会产生一次小型 API 请求。使用自定义中文策略时，还需要在同一设置页选择已验证的中文翻译模型；内置模板可先直接体验。', action: { label: '查看模型配置入口', run: () => reveal('connection') } },
      { title: '选择模板与合约', status: instrumentIssue(config, catalog) ? '合约参数待核对' : '合约格式已检查', ready: !instrumentIssue(config, catalog),
        body: '第一次先选一个内置模板和一个熟悉的品种，再填写实际月份合约。可以搜索六个交易所的品种，也可以选择其他品种／自定义。核对交易所和最小价格变动 tick。',
        note: '品种代码不等于实际合约。示例 rb2610 只是格式示例，需换成当前柜台开放的月份；选对品种不代表该月份一定有行情。', action: { label: '选择模板和实际合约', run: () => reveal('launcher') } },
      { title: '核对额度与行情', status: status?.running ? '正在运行，请先停止再调整' : '启动前由你核对',
        body: '检查手数、运行时长、决策间隔、最大开仓计划数与权益回落停止线。初次可以保留内置模板的 1 手设置，按自己的模拟账户资金核对。首次先到「设置 → PandaData」连接授权，再在「高级设置 → 历史行情与策略条件」检查数据准备状态。',
        note: '实时报价来自比赛柜台，历史 K 线来自 PandaData 或手动资料。Jev 自主决策及翻译可能产生 API 用量；历史不足时不会新开仓。权益停止线只暂停盯盘，不自动平仓。', action: { label: '检查参数与历史行情', run: () => reveal('review') } },
      { title: '运行与确认计划', status: label, ready: active,
        body: '配置核对后，点击「开始盯盘」。先等待有效行情与采样，再看 Jev 分析和运行记录。逐笔确认模式会生成待确认计划，在「比赛计划」核对后执行；自动下单模式在启动时确认风险，随后自动提交。',
        note: '是否自动下单由执行方式决定；已提交不等于已成交。停止盯盘不会撤销已提交委托或清空持仓；停止后仍要检查挂单、持仓与柜台回执。', action: { label: '查看运行区域', run: () => reveal('launcher') } },
    ]} troubleshooting={[
      { title: '已授权 PandaData，为什么还在等待行情？', body: '先在本页「最新行情」核对同一实际合约的价格与时间，再检查比赛账户、合约月份及交易时段。PandaData 的历史授权不代表比赛柜台已经提供实时报价。休市时不要通过改参数强行启动。' },
      { title: '一直没有计划，是不是没运行？', body: '看状态和运行记录：可能正在积累样本、没有满足策略条件、处于冷却期，或已有待处理计划。先处理原计划，再看风控和历史诊断；不要为了出单盲目降低限制。' },
      { title: '密钥填好仍不能启动，或提示历史数据不足？', body: '返回模型服务测试并保存 Jev 密钥，再刷新配置状态。历史数据不足时在「高级设置 → 历史行情与策略条件」查看诊断并准备历史数据；检查 PandaData 授权或补充手动资料。不要把 API Key 填进策略内容。' },
    ]}/>
  return <section className={`${css.assistant} ${css.watchWorkbench} qs-jev-workspace qs-workspace-refined`} aria-label="Jev 持续盯盘">
    <header className="qs-workspace-heading"><div className="qs-workspace-identity"><span className="qs-workspace-avatar"><WaveformIcon size={25}/></span><div><h2>JEV 盯盘</h2><p>把交易想法交给 JEV，持续跟踪市场。</p></div></div>
      <div className="qs-workspace-actions"><button type="button" aria-label="Jev 运行设置" onClick={openQuickSettings}><GearSixIcon size={18}/><span>设置</span></button>
      <button type="button" data-primary={!status?.running || undefined} disabled={busy === 'stop' || (!status?.running && busy !== 'start' && (locked || !connected || !configured || retrySeconds > 0))}
        onClick={() => status?.running || busy === 'start' ? void run('stop') : requestStart()}>{busy === 'stop' ? '停止中…' : busy === 'start' ? '取消启动' : status?.running ? '停止盯盘' : retrySeconds ? `冷却中 · ${retrySeconds} 秒` : '开始盯盘'}</button>
      </div></header>
    {error && !settingsOpen && !quickSettings && <p className={css.error} role="alert">{error}</p>}
    {retrySeconds > 0 && <p role="status" className="qs-compact-alert">比赛接口限流，{retrySeconds} 秒后可重试。各比赛入口共用冷却时间，无需重新授权。{status?.running ? '盯盘保持等待，冷却后自动继续采样。' : '本次盯盘尚未启动。'}</p>}
    {statusError && <p className={css.error} role="alert">{statusError}</p>}
    {connectionError && <p className={css.error} role="alert">{connectionError}</p>}
    {(!connected || configured !== true) && <div className="qs-compact-alert" role="status"><span>{!connected ? '请先连接比赛账户' : configured === undefined ? '正在核验模型配置' : 'Jev 密钥待配置'}</span><button type="button" onClick={() => openSettings('connection')}>检查连接</button></div>}
    <div className="qs-strategy-strip">
      <div><small>我的盯盘要求</small><p>{config.instructions || '用自己的话描述想观察的行情、入场与退出条件。'}</p></div>
      <button type="button" onClick={openQuickSettings}>修改<PencilSimpleIcon size={15}/></button>
    </div>
    <details className="qs-jev-status" aria-label="盯盘状态" data-phase={phase} data-active={active}>
      <summary>
        <span className="qs-jev-status-label" role="status"><i aria-hidden="true"/>{label}</span>
        <span className="qs-jev-status-meta"><span>{contractsLabel || '待选择合约'}</span><span>每 {config.decisionIntervalSeconds ?? 30} 秒判断</span></span>
        <span className="qs-jev-status-toggle">状态详情<CaretDownIcon size={15} aria-hidden="true"/></span>
      </summary>
      <div className="qs-jev-status-body"><p>{statusError ? '暂时无法确认盯盘状态，正在重试连接。' : status?.message ?? '读取盯盘状态…'}</p>{phase === 'waiting_quote' && <p>实时报价来自比赛柜台，PandaData 用于历史 K 线；PandaData 已授权不代表柜台已返回有效报价。请在比赛页「最新行情」核对{status?.config?.symbol ? ` ${status.config.symbol} ` : '同一合约'}的价格与时间。</p>}
        {status?.lastQuoteCheckedAt && <small>最近行情检查：{contestTime(status.lastQuoteCheckedAt)}{status.running && status.config ? ` · 采样间隔 ${status.config.intervalSeconds} 秒` : ''}</small>}
        {status?.nextRetryAt && status.running && <p>柜台重试时间：{contestTime(status.nextRetryAt)}，等待期间不请求 Jev。</p>}
        {status?.accountCheckedAt && <small>最近账户巡检：{contestTime(status.accountCheckedAt)}</small>}
      </div>
    </details>

    <ContestWatchVisuals status={status} active={active} config={config}/>
    <section className="qs-jev-run-panel" aria-label="本次运行配置">
      <header><h3>本次运行</h3><div className="qs-jev-plan-counts" aria-label="计划统计">
        <span>开仓计划 <strong>{status ? status.openingPlanCount ?? status.planCount : '—'}<small> / {status?.config?.maxPlans ?? config.maxPlans}</small></strong></span>
        <span>总计划 <strong>{status?.planCount ?? '—'}</strong></span>
      </div></header>
      <div className="qs-jev-run-settings">
        <button type="button" aria-label="选择实际合约" onClick={() => openSettings()}><StackIcon size={19} aria-hidden="true"/><span><small>实际合约</small><strong>{contractsLabel || '选择交易合约'}</strong></span><CaretRightIcon size={14} aria-hidden="true"/></button>
        <button type="button" onClick={() => openSettings('strategy')}><SlidersHorizontalIcon size={19} aria-hidden="true"/><span><small>交易策略</small><strong>{config.strategyName || '自定义'}</strong></span><CaretRightIcon size={14} aria-hidden="true"/></button>
        <button type="button" onClick={() => openSettings('review')}><TimerIcon size={19} aria-hidden="true"/><span><small>额度与时长</small><strong>单笔 {config.volume} 手<span className="qs-jev-setting-separator">·</span>{config.durationMinutes} 分钟</strong></span><CaretRightIcon size={14} aria-hidden="true"/></button>
        <button type="button" onClick={openQuickSettings}><GearSixIcon size={19} aria-hidden="true"/><span><small>执行方式</small><strong>{config.executionMode === 'automatic' ? '自动下单' : '逐笔确认'}</strong></span><CaretRightIcon size={14} aria-hidden="true"/></button>
      </div>
      {status?.running && ((status.openingCooldownUntil && status.openingCooldownUntil > Date.now()) || status.nextDecisionAt) ? <div className="qs-jev-run-timing" role="status">
        {status.openingCooldownUntil && status.openingCooldownUntil > Date.now() && <span>开仓冷却至 {contestTime(status.openingCooldownUntil)}（不影响平仓判断）</span>}
        {status.nextDecisionAt && <span>下次决策最早 {contestTime(status.nextDecisionAt)}（需有效样本、无待处理计划）</span>}
      </div> : null}
      <footer><div className="qs-jev-support-actions">{guide}<button type="button" onClick={() => setDiagnostics(true)}><ListBulletsIcon size={17} aria-hidden="true"/>运行记录与诊断<ArrowUpRightIcon size={13} aria-hidden="true"/></button></div><span className="qs-jev-stop-note"><InfoIcon size={15} aria-hidden="true"/>停止盯盘不撤单、不平仓</span></footer>
    </section>
    {plans && <div className="qs-watch-plans">{plans}</div>}
    {status?.strategyNotices?.map(note => <p key={note} className={css.jevFine}>{note}</p>)}
    {quickSettings && <ActionDialog title="Jev 运行设置" dismissOnBackdrop busy={!!busy} onClose={cancelSettings}>
      <form className="qs-quick-config" onSubmit={event => {
        event.preventDefault()
        if (locked) return
        const issue = instrumentIssue(config, catalog)
        if (issue || !config.instructions.trim()) { setError(issue || '请描述盯盘要求。'); return }
        setQuickSettings(false); setError('')
      }}>
        <p>描述入场、退出和等待条件，作为 JEV 的判断依据。</p>
        {status?.running && <p>正在运行，停止盯盘后可修改参数。</p>}
        <fieldset disabled={locked}><JevInstrument compact config={config} onChange={setConfig} catalog={catalog} quote={access.quote} accountKey={connected ? accountId || status?.identity?.accountId || 'connected' : ''}/>
          <label>研究目标和约束<textarea rows={4} required maxLength={2000} value={config.instructions} onChange={event => setConfig({ ...config, instructions: event.target.value })}/></label>
          <ExecutionModeChoice value={config.executionMode ?? 'manual'} disabled={locked} onChange={executionMode => setConfig({ ...config, executionMode })}/>
        </fieldset>
        <div className="qs-quick-config-summary">单笔上限 {config.volume} 手 · 每 {config.decisionIntervalSeconds ?? 30} 秒判断 · 运行 {config.durationMinutes} 分钟</div>
        <button type="button" className="qs-config-advanced" onClick={() => { setQuickSettings(false); setSettingsSection('strategy'); setSettingsOpen(true) }}>模板、额度与高级设置 ↗</button>
        {error && <p className={css.error} role="alert">{error}</p>}
        <footer><button type="button" onClick={cancelSettings}>取消</button><button type="submit" data-primary disabled={locked}>应用本次配置</button></footer>
      </form>
    </ActionDialog>}
    {settingsOpen && <ActionDialog settings title="Jev 运行设置" busy={!!busy || historyBusy || saving} onClose={cancelSettings}>
      <form noValidate className="qs-settings-form qs-jev-settings-form" onSubmit={event => {
        event.preventDefault()
        if (!locked) { const issue = instrumentIssue(config, catalog); if (issue) { setError(issue); setSettingsSection('contract') } else { setSettingsOpen(false); setError('') } }
      }}>
        <div className="qs-settings-layout">
          <TradingSettingsNavigation<typeof settingsSection> current={settingsSection} onChange={setSettingsSection} items={[
            { id: 'contract', title: '交易合约', detail: contractsLabel || '勾选品种与月份' },
            { id: 'strategy', title: '交易策略', detail: '模板与文字指令' },
            { id: 'limits', title: '运行与额度', detail: '手数、时长与停止条件' },
            { id: 'advanced', title: '高级设置', detail: '行情与判断参数' },
            { id: 'connection', title: '模型连接', detail: configured ? 'Jev 已配置' : '检查连接状态' },
          ]}/>
          <div className="qs-settings-content" ref={settingsContent}>
            {status?.running && <p className="qs-settings-notice">正在运行，停止盯盘后可修改参数。</p>}
            <section hidden={settingsSection !== 'connection'} aria-label="模型连接">
              <div className="qs-settings-intro"><h3>模型连接</h3><p>统一使用 QuantStudio 中配置的 Jev 服务。</p></div>
      <div className="qs-jev-connection-card"><header><span className="qs-jev-disclosure-icon"><PlugsConnectedIcon size={22} aria-hidden="true"/></span><div><strong>Jev</strong><small>jev-1.13.0</small></div><span className="qs-jev-connection-state" data-ready={configured === true}>{configured === undefined ? '待核验' : configured ? '密钥已配置' : '待配置'}</span></header>
      <p>Jev · {configured === undefined ? '配置状态待确认' : configured ? 'API Key 已配置' : 'API Key 未配置'}。API Key 请在「设置 → 模型服务 → Jev」中配置，与 AI 交易员的模型辅助共用。</p>
      <div className="qs-jev-connection-actions">
      {openModelSettings && <button type="button" onClick={() => { cancelSettings(); openModelSettings() }}>前往模型服务配置 Jev</button>}
      <button type="button" disabled={refreshingSettings} onClick={async () => {
        setRefreshingSettings(true); setConnectionError('')
        try { setConfigured((await waitForCompetition(() => access.settings(), 'Jev 配置')).configured) }
        catch (failure) { setConnectionError(failure instanceof Error ? failure.message : '配置读取失败，请重试。') }
        finally { setRefreshingSettings(false) }
      }}>刷新配置状态</button>
      </div>
      {connectionError && <p className={css.error} role="alert">{connectionError}</p>}
      </div>
            </section>
            <fieldset className="qs-settings-fields" disabled={locked}>
              <section hidden={settingsSection !== 'contract'} aria-label="交易合约设置">
                <div className="qs-settings-intro"><h3>选择盯盘品种</h3><p>可勾选多个品种，为每个品种选择实际月份合约。</p></div>
                <div className="qs-jev-contract-editor"><JevInstrument compact config={config} onChange={setConfig} catalog={catalog} quote={access.quote} accountKey={connected ? accountId || status?.identity?.accountId || 'connected' : ''}/></div>
                <JevSettingsDisclosure title="品种目录与同步" description="查看目录状态，从比赛柜台同步可交易品种" icon={<ArrowsClockwiseIcon size={19}/>}><p>{catalogMessage}</p>
                  {access.varieties && <button type="button" disabled={!connected || catalogLoading} onClick={() => { void refreshCatalog() }}>{catalogLoading ? '正在同步…' : '同步柜台品种'}</button>}
                  <p>支持全部期货品种，也可填写自定义合约。实际可交易月份以柜台为准。</p>
                </JevSettingsDisclosure>
              </section>
              <section hidden={settingsSection !== 'strategy'} aria-label="交易策略设置">
                <div className="qs-settings-intro"><h3>告诉 JEV 怎么盯盘</h3><p>选择模板，或用自己的话描述入场、退出和等待条件。</p></div>
                <div className="qs-jev-strategy-editor">
        <div className="qs-template-picker"><label>运行模板<select aria-label="运行模板" value={config.builtInTemplate === 'rb-range' ? 'range' : config.builtInTemplate || `saved:${config.strategyName}`} onChange={event => chooseTemplate(event.target.value)}>
          {builtIns.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          {templates.map(item => <option key={item.name} value={`saved:${item.name}`}>{item.name}</option>)}
          {!config.builtInTemplate && !templates.some(item => item.name === config.strategyName) && <option value={`saved:${config.strategyName}`}>{config.strategyName || '自定义配置'}</option>}
        </select></label>
        <button type="button" className={css.jevReuse} onClick={() => { setCreating(true); setNewName(''); setError('') }}>＋ 新建模板</button></div>
        {creating && <section className={css.jevCreator} aria-label="新建模板">
          <label>新模板名称<input maxLength={80} value={newName} placeholder="例如 我的午后策略" onChange={event => setNewName(event.target.value)}/></label>
          <label>创建方式<select value={newKind} onChange={event => setNewKind(event.target.value as TemplateKind)}>
            {builtIns.map(item => <option key={item.id} value={item.id}>基于{item.name}</option>)}<option value="blank">从空白创建</option>
          </select></label>
          <p>{newKind === 'blank' ? '运行参数已预填；请填写策略目标和五种动作标准，再保存。' : '复制完整参数和条件，修改后保存即可使用。'}</p>
          <button type="button" disabled={!newName.trim()} onClick={() => {
            const name = newName.trim()
            if (templates.some(item => item.name === name)) { setError('已有同名模板，请换个名称，或选择原模板进行修改。'); return }
            setConfig({ ...makeTemplate(newKind, config), builtInTemplate: undefined, strategyName: name }); setTemplateName(name); setSettingsSection('strategy'); setCreating(false); setError(''); setTemplateMessage('正在编辑新模板，完成后点击「保存为我的模板」。')
          }}>创建并编辑</button><button type="button" onClick={() => setCreating(false)}>取消</button>
        </section>}
        {previousConfig && <button type="button" className={css.jevReuse} onClick={() => { setConfig(structuredClone(previousConfig)); setTemplateName('') }}>载入上次运行配置</button>}

                  <JevStrategy config={config} onChange={setConfig}/>
                  <JevSettingsDisclosure title="判断方式" description="选择由 JEV 综合判断，或先按程序规则筛选" badge={config.decisionMode === 'jev' ? 'Jev 自主决策' : '严格规则'} icon={<BrainIcon size={19}/>}>
                  <label>决策方式<select value={config.decisionMode ?? 'strict'} onChange={event => setConfig({ ...config, decisionMode: event.target.value as 'jev' | 'strict' })}><option value="jev">Jev 自主决策（推荐）</option><option value="strict">严格规则模式</option></select></label>
                  <p className="qs-settings-note">{config.decisionMode === 'jev' ? '历史不足也会请求分析并产生用量，但不允许新开仓。策略作为参考，由 Jev 判断机会。' : '严格规则模式：程序条件先筛选，全部可交易动作被拦截时不请求 Jev。'}</p>
                  </JevSettingsDisclosure>
                </div>
                <JevSettingsDisclosure title="另存为我的模板" description="将当前策略与运行参数保存到本机，方便下次使用" icon={<FloppyDiskIcon size={19}/>}>
          <div className={css.jevSaveTemplate}><label>保存模板名称<input maxLength={80} placeholder="例如 我的午后区间" value={templateName} onChange={event => setTemplateName(event.target.value)}/></label>
            <button type="button" onClick={() => { void saveTemplate() }}>{saving ? '保存中…' : '保存为我的模板'}</button></div>
          <p className={css.jevFine}>同名保存会更新已有模板，可不填实际合约先保存。换品种时核对交易所、tick 与成本；启动前必须填写柜台支持的实际合约。</p>
                </JevSettingsDisclosure>
              </section>
              <section hidden={settingsSection !== 'limits'} aria-label="运行与额度设置">
                <div className="qs-settings-intro"><h3>运行与额度</h3><p>设置本次盯盘的范围与执行方式。</p></div><ExecutionModeChoice value={config.executionMode ?? 'manual'} disabled={locked} onChange={executionMode => setConfig({ ...config, executionMode })}/>
                <div className="qs-settings-group qs-settings-grid">
                  {fields.filter(([key]) => ['volume', 'durationMinutes', 'maxEquityDrop', 'maxPlans', 'decisionIntervalSeconds'].includes(key)).map(([key, label, min, max, step]) => <label key={key}>{label}<input type="number" required min={min} max={max} step={step} value={config[key] ?? initial[key] ?? ''} onChange={event => setConfig({ ...config, [key]: Number(event.target.value) })}/></label>)}
                  <label>允许开仓方向<select value={config.allowedSide ?? 'both'} onChange={event => setConfig({ ...config, allowedSide: event.target.value as 'both' | 'long_only' | 'short_only' })}><option value="both">多空均可</option><option value="long_only">只开多</option><option value="short_only">只开空</option></select></label>
                </div><p className="qs-settings-note">运行到期或触及权益停止线会停止盯盘，不会自动撤单或平仓。</p>
              </section>
              <section hidden={settingsSection !== 'advanced'} aria-label="高级设置">
                <div className="qs-settings-intro"><h3>高级设置</h3><p>通常可沿用模板。需要调整行情准备或信号筛选时再修改。</p></div>
                <div className="qs-settings-group qs-settings-grid">
                  {fields.filter(([key]) => !['volume', 'durationMinutes', 'maxEquityDrop', 'maxPlans', 'decisionIntervalSeconds'].includes(key)).map(([key, label, min, max, step]) => <label key={key}>{label}<input type="number" required min={min} max={max} step={step} value={config[key] ?? initial[key] ?? ''} onChange={event => setConfig({ ...config, [key]: Number(event.target.value) })}/></label>)}
                </div>
                <JevEvidenceSettings access={access} config={config} onChange={setConfig} onBusy={setHistoryBusy}/>
                <p className="qs-settings-note">{rules ? `成本假设：每手双边手续费及滑点 ${rules.roundTripCostTicks} tick，另计实际点差。` : '使用文字策略作为判断依据。'}冷却只限制下一次开仓，平仓仍按决策间隔评估。</p>
              </section>
            </fieldset>
            {templateMessage && <p role="status">{templateMessage}</p>}
            {error && <p className={css.error} role="alert">{error}</p>}
          </div>
        </div>
        <div className="qs-settings-footer"><span>仅应用配置，不会启动盯盘</span><button type="button" disabled={!!busy || historyBusy || saving} onClick={cancelSettings}>取消</button><button type="submit" data-primary disabled={locked}>应用本次配置</button></div>
      </form>
    </ActionDialog>}
    {diagnostics && <ActionDialog drawer className="qs-support-drawer" title="Jev 运行记录与诊断" onClose={() => setDiagnostics(false)}><JevUsage access={access} events={status?.events}/></ActionDialog>}
    {review && <ActionDialog title="核对本次盯盘" busy={!!busy} onClose={() => setReview(false)}>
      <p><strong>{contractsLabel} · {config.strategyName}</strong></p><p>账户 {accountId || status?.identity?.accountId || '当前已连接模拟赛账户'} · {config.executionMode === 'automatic' ? '自动下单' : '逐笔确认'}</p><p>每笔最多 {config.volume} 手 · {config.durationMinutes} 分钟 · 最多 {config.maxPlans} 个开仓计划</p>
      <p>所选合约共用策略、开仓计划总上限与权益停止线；行情轮询，分别判断。</p><p>权益回落 {config.maxEquityDrop} 元暂停。调用 TypeSafe 会产生 API 用量；停止不撤单、不平仓。</p>
      <ExecutionDisclosure mode={config.executionMode ?? 'manual'} accepted={riskAccepted} onChange={setRiskAccepted}/>
      <div className="qs-drawer-footer"><button type="button" onClick={() => setReview(false)}>返回</button><button type="button" data-primary disabled={!!busy || (config.executionMode === 'automatic' && !riskAccepted)} onClick={() => { setReview(false); void run('start', config.executionMode === 'automatic' && riskAccepted ? AUTOMATIC_TRADING_CONSENT : undefined) }}>{config.executionMode === 'automatic' ? '授权并开始自动下单' : '确认并开始盯盘'}</button></div>
    </ActionDialog>}
  </section>
}
