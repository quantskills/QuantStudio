import { GearSixIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ContestWatchConfig, ContestWatchStatus, ContestWatchTemplate } from './plugin-types.ts'
import type { ContestAccess } from './contest.ts'
import { contestTime } from './contest.ts'
import { waitForCompetition } from './competition-async.ts'
import { JevUsage } from './JevUsage.tsx'
import { JevStrategy } from './JevStrategy.tsx'
import { JevEvidenceSettings } from './JevEvidenceSettings.tsx'
import { ContestWatchVisuals } from './ContestWatchVisuals.tsx'
import { instrumentIssue, makeTemplate, rangeTemplate, templates as builtIns, withInstrument, type TemplateKind } from './jev-templates.ts'
import { useJevProducts } from './jev-catalog.ts'
import { JevInstrument } from './JevInstrument.tsx'
import { ActionDialog } from './ActionDialog.tsx'
import { TradingGuide } from './TradingGuide.tsx'
import css from './ContestPage.module.css'

const initial = rangeTemplate()
const phases = { sampling: '正在盯盘 · 采样中', waiting_quote: '正在盯盘 · 等待行情', deciding: '正在盯盘 · Jev 分析中', checking: '正在盯盘 · 风控检查', waiting_plan: '正在盯盘 · 等待计划处理' }
const fields = [
  ['volume', '手数及持仓上限', 1, 100, 1], ['intervalSeconds', '采样间隔（秒）', 3, 86400, 1], ['decisionIntervalSeconds', '决策间隔（秒）', 3, 86400, 1],
  ['durationMinutes', '运行时长（分钟）', 5, 1440, 1], ['minConfidence', '计划置信度下限', 0.5, 1, 0.01],
  ['maxEquityDrop', '权益回落停止线（元）', 1, undefined, 1], ['maxPlans', '本次开仓计划上限', 1, 100, 1],
  ['openingCooldownSeconds', '开仓冷却时间（秒，0 不冷却）', 0, 3600, 1],
  ['minSamples', '最少有效快照', 8, 60, 1], ['maxSpread', '开仓最大买卖价差（价格单位，0 不限制）', 0, undefined, 0.01],
] as const

export function ContestWatch({ access, connected = true, openModelSettings, plans }: { access: NonNullable<ContestAccess['watch']>; connected?: boolean; plans?: ReactNode; openModelSettings?: (() => void) | undefined }) {
  const [settingsOpen, setSettingsOpen] = useState(false), [diagnostics, setDiagnostics] = useState(false), [review, setReview] = useState(false)
  const savedDraft = useRef<ContestWatchConfig>(initial), reviewed = useRef('')
  const { catalog, message: catalogMessage, loading: catalogLoading, refresh: refreshCatalog } = useJevProducts(access, connected)
  const [status, setStatus] = useState<ContestWatchStatus>(), [config, setConfig] = useState(initial)
  const [tuning, setTuning] = useState(false), [busy, setBusy] = useState(''), [error, setError] = useState('')
  const [templates, setTemplates] = useState<ContestWatchTemplate[]>([]), [templateName, setTemplateName] = useState(''), [templateMessage, setTemplateMessage] = useState('')
  const [saving, setSaving] = useState(false), [previousConfig, setPreviousConfig] = useState<ContestWatchConfig>()
  const [creating, setCreating] = useState(false), [newKind, setNewKind] = useState<TemplateKind>('range'), [newName, setNewName] = useState('')
  const [statusError, setStatusError] = useState('')
  const [configured, setConfigured] = useState<boolean>(), [connectionError, setConnectionError] = useState('')
  const [historyBusy, setHistoryBusy] = useState(false)
  const [refreshingSettings, setRefreshingSettings] = useState(false)
  const launcherRef = useRef<HTMLFieldSetElement>(null)
  const connectionRef = useRef<HTMLDivElement>(null)
  const reviewRef = useRef<HTMLDetailsElement>(null)
  function openSettings(target: 'connection' | 'launcher' | 'review' = 'launcher') {
    savedDraft.current = structuredClone(config)
    setSettingsOpen(true)
    setTuning(target === 'review')
    requestAnimationFrame(() => {
      const element = target === 'connection' ? connectionRef.current : target === 'review' ? reviewRef.current : launcherRef.current
      if (target === 'connection') { const disclosure = connectionRef.current?.closest('details'); if (disclosure) disclosure.open = true }
      element?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
    })
  }
  function cancelSettings() { setConfig(savedDraft.current); setSettingsOpen(false); setError(''); setCreating(false) }
  function reveal(target: 'connection' | 'launcher' | 'review') { openSettings(target) }
  function requestStart() {
    const issue = instrumentIssue(config, catalog)
    if (issue) { setError(issue); openSettings(); return }
    if (reviewed.current !== JSON.stringify(config)) setReview(true)
    else void run('start')
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
          if (next.config) { const restored = next.running || next.config.autoHistory || next.config.rangeRules || next.config.signalRules || next.config.customStrategy ? { ...next.config, decisionIntervalSeconds: next.config.decisionIntervalSeconds ?? 30 } : rangeTemplate(next.config.symbol); setPreviousConfig(next.config); setConfig(restored); savedDraft.current = structuredClone(restored) }
          hydrated.current = true
        }
      } catch (failure) {
        if (!disposed && version === epoch.current) setStatusError(failure instanceof Error ? failure.message : '盯盘状态读取失败。')
      } finally { if (!disposed) timer = setTimeout(() => { void poll() }, 3000) }
    }
    void poll()
    return () => { disposed = true; clearTimeout(timer); epoch.current++ }
  }, [access])
  const run = async (action: 'start' | 'stop') => {
    if (action === 'start' && pending.current) return
    if (action === 'start') { const issue = instrumentIssue(config, catalog); if (issue) { setError(issue); return } }
    const version = ++epoch.current
    pending.current = true; setBusy(action); setError('')
    try {
      const next = await waitForCompetition(() => action === 'start' ? access.start(config) : access.stop(), action === 'start' ? '启动 Jev 盯盘' : '停止 Jev 盯盘', 120000)
      if (version === epoch.current) { setStatus(next); setStatusError(''); if (next.config) setConfig(next.config); setTuning(false) }
    } catch (failure) {
      if (version === epoch.current) { setError(failure instanceof Error ? failure.message : '盯盘操作失败。'); setTuning(true) }
    } finally { if (version === epoch.current) { pending.current = false; setBusy('') } }
  }
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
            const applied = config.symbol && config.instrument ? { ...withInstrument(structuredClone(saved.config), config.instrument), symbol: config.symbol } : structuredClone(saved.config)
            if (saved.config.symbol.toLowerCase() !== applied.symbol.toLowerCase()) applied.history = undefined
            setConfig(applied); setTemplateName(saved.name)
          } else { setConfig(makeTemplate(value as TemplateKind, config)); setTemplateName('') }
          setCreating(false); setError('')
  }
  const active = Boolean(status?.running && !statusError && !busy)
  const rules = config.rangeRules ?? config.signalRules
  const phase = statusError ? 'unknown' : busy || !status ? 'pending' : status.running ? status.phase ?? 'sampling' : 'stopped'
  const label = statusError ? '连接中断 · 状态待确认' : busy === 'stop' ? '正在停止盯盘' : busy === 'start' ? '正在启动盯盘'
    : !status ? '正在读取盯盘状态' : status.running ? phases[status.phase ?? 'sampling'] : '盯盘未运行'
  const guide = <TradingGuide compact name="JEV" steps={[
      { title: '连接账户与模型', status: !connected ? '比赛账户待连接' : configured ? '账户已连接 · 密钥已配置' : '模型配置待核验', ready: connected && configured === true,
        body: '先在本页上方连接期货模拟赛账户，再到「设置 → 模型服务 → Jev」填写 TypeSafe API Key，点击测试并保存。比赛账户授权、Jev 密钥、PandaData 历史数据授权是三项独立配置。',
        note: 'Jev 连接测试会产生一次小型 API 请求。使用自定义中文策略时，还需要在同一设置页选择已验证的中文翻译模型；内置模板可先直接体验。', action: { label: '查看模型配置入口', run: () => reveal('connection') } },
      { title: '选择模板与合约', status: instrumentIssue(config, catalog) ? '合约参数待核对' : '合约格式已检查', ready: !instrumentIssue(config, catalog),
        body: '第一次先选一个内置模板和一个熟悉的品种，再填写实际月份合约。可以搜索六个交易所的品种，也可以选择其他品种／自定义。核对交易所和最小价格变动 tick。',
        note: '品种代码不等于实际合约。示例 rb2610 只是格式示例，需换成当前柜台开放的月份；选对品种不代表该月份一定有行情。', action: { label: '选择模板和实际合约', run: () => reveal('launcher') } },
      { title: '核对额度与行情', status: status?.running ? '正在运行，请先停止再调整' : '启动前由你核对',
        body: '检查手数、运行时长、决策间隔、最大开仓计划数与权益回落停止线。初次可以保留内置模板的 1 手设置，按自己的模拟账户资金核对。首次先到「设置 → PandaData」连接授权，再在「微调模板 → 历史行情与策略条件」检查数据准备状态。',
        note: '实时报价来自比赛柜台，历史 K 线来自 PandaData 或手动资料。Jev 自主决策及翻译可能产生 API 用量；历史不足时不会新开仓。权益停止线只暂停盯盘，不自动平仓。', action: { label: '检查参数与历史行情', run: () => reveal('review') } },
      { title: '运行与确认计划', status: label, ready: active,
        body: '配置核对后，点击「开始盯盘」。先等待有效行情与采样，再看 Jev 分析和运行记录。有机会时生成待确认计划：展开本页「比赛详情」，在「交易计划与回执」核对账户、合约、方向、手数及价格，再决定确认或取消。',
        note: '开始盯盘不等于下单，已提交也不等于已成交。停止盯盘不会撤销已提交委托或清空持仓；停止后仍要检查挂单、持仓与柜台回执。', action: { label: '查看运行区域', run: () => reveal('launcher') } },
    ]} troubleshooting={[
      { title: '已授权 PandaData，为什么还在等待行情？', body: '先在本页「最新行情」核对同一实际合约的价格与时间，再检查比赛账户、合约月份及交易时段。PandaData 的历史授权不代表比赛柜台已经提供实时报价。休市时不要通过改参数强行启动。' },
      { title: '一直没有计划，是不是没运行？', body: '看状态和运行记录：可能正在积累样本、没有满足策略条件、处于冷却期，或已有待处理计划。先处理原计划，再看风控和历史诊断；不要为了出单盲目降低限制。' },
      { title: '密钥填好仍不能启动，或提示历史数据不足？', body: '返回模型服务测试并保存 Jev 密钥，再刷新配置状态。历史数据不足时在「微调模板 → 历史行情与策略条件」查看诊断并准备历史数据；检查 PandaData 授权或补充手动资料。不要把 API Key 填进策略内容。' },
    ]}/>
  return <section className={`${css.assistant} ${css.watchWorkbench} qs-jev-workspace`} aria-label="Jev 持续盯盘">
    <header className="qs-workspace-heading"><div><h2>Jev 持续盯盘</h2><p>持续观察行情，有机会时生成待确认计划。</p></div>
      <div className="qs-workspace-actions">{guide}<button type="button" aria-label="Jev 运行设置" onClick={() => openSettings()}><GearSixIcon size={20}/></button></div></header>
    {error && !settingsOpen && <p className={css.error} role="alert">{error}</p>}
    {statusError && <p className={css.error} role="alert">{statusError}</p>}
    {connectionError && <p className={css.error} role="alert">{connectionError}</p>}
    {(!connected || configured !== true) && <div className="qs-compact-alert" role="status"><span>{!connected ? '请先连接比赛账户' : configured === undefined ? '正在核验模型配置' : 'Jev 密钥待配置'}</span><button type="button" onClick={() => openSettings('connection')}>检查连接</button></div>}
    <div className="qs-launch-row">
      <div className="qs-launch-field"><span>实际合约</span><button type="button" aria-label="选择实际合约" onClick={() => openSettings()}>{config.symbol || '选择期货合约'} ⌄</button></div>
      <label>当前模板<select aria-label="当前运行模板" disabled={locked} value={config.builtInTemplate === 'rb-range' ? 'range' : config.builtInTemplate || `saved:${config.strategyName}`} onChange={event => chooseTemplate(event.target.value)}>{builtIns.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}{templates.map(item => <option key={item.name} value={`saved:${item.name}`}>{item.name}</option>)}{!config.builtInTemplate && !templates.some(item => item.name === config.strategyName) && <option value={`saved:${config.strategyName}`}>{config.strategyName || '自定义配置'}</option>}</select></label>
      <div className="qs-launch-summary"><strong>每笔最多 {config.volume} 手 · {config.decisionIntervalSeconds ?? 30} 秒决策</strong>运行 {config.durationMinutes} 分钟 · 最多 {config.maxPlans} 个开仓计划</div>
      <button type="button" data-primary={!status?.running || undefined} disabled={busy === 'stop' || (!status?.running && busy !== 'start' && (locked || !connected || !configured))}
        onClick={() => status?.running || busy === 'start' ? void run('stop') : requestStart()}>{busy === 'stop' ? '停止中…' : busy === 'start' ? '取消启动' : status?.running ? '停止盯盘' : '开始盯盘'}</button>
    </div>
    <div className={css.watchStatus} role="status" data-phase={phase} data-active={active}>
      <span className={css.watchIndicator} aria-hidden="true"/>
      <div><strong>{label}</strong><p>{statusError ? '暂时无法确认盯盘状态，正在重试连接。' : status?.message ?? '读取盯盘状态…'}</p>
        <details><summary>状态详情</summary>{phase === 'waiting_quote' && <p>实时报价来自比赛柜台，PandaData 用于历史 K 线；PandaData 已授权不代表柜台已返回有效报价。请在比赛页「最新行情」核对{status?.config?.symbol ? ` ${status.config.symbol} ` : '同一合约'}的价格与时间。</p>}
        {status?.lastQuoteCheckedAt && <small>最近行情检查：{contestTime(status.lastQuoteCheckedAt)}{status.running && status.config ? ` · 采样间隔 ${status.config.intervalSeconds} 秒` : ''}</small>}
        {status?.nextRetryAt && status.running && <p>柜台重试时间：{contestTime(status.nextRetryAt)}，等待期间不请求 Jev。</p>}
        {status?.accountCheckedAt && <small>最近账户巡检：{contestTime(status.accountCheckedAt)}</small>}
        </details>
      </div>
    </div>

    <ContestWatchVisuals status={status} active={active}/>
    {plans && <div className="qs-watch-plans">{plans}</div>}
    {status?.strategyNotices?.map(note => <p key={note} className={css.jevFine}>{note}</p>)}
    {status && <div className={css.watchSummary}>
      <span>本次开仓计划 {status.openingPlanCount ?? status.planCount}/{status.config?.maxPlans ?? '—'} · 总计划 {status.planCount}</span>
      {status.running && status.openingCooldownUntil && status.openingCooldownUntil > Date.now() && <span>开仓冷却至 {contestTime(status.openingCooldownUntil)}（不影响平仓判断）</span>}
      {status.running && status.nextDecisionAt && <span>下次决策最早 {contestTime(status.nextDecisionAt)}（需有效样本、无待处理计划）</span>}
    </div>}

    <div className={css.watchSummary}><span>逐笔确认 · 停止盯盘不撤单、不平仓</span><button type="button" onClick={() => setDiagnostics(true)}>运行记录与诊断 ↗</button></div>
    {settingsOpen && <ActionDialog drawer title="Jev 运行设置" busy={!!busy || historyBusy || saving} onClose={cancelSettings}>
      {status?.running && <p className={css.jevFine}>正在运行，停止盯盘后可修改参数。</p>}
    <details className="qs-connection-settings" open={configured !== true}><summary>模型连接 · {configured ? '已配置' : '待核验'}</summary><div className={css.jevConnectionBody} ref={connectionRef} tabIndex={-1}>
      <p>Jev · {configured === undefined ? '配置状态待确认' : configured ? 'API Key 已配置' : 'API Key 未配置'}。API Key 请在「设置 → 模型服务 → Jev」中配置，与果蝇共用。</p>
      {openModelSettings && <button type="button" onClick={() => { cancelSettings(); openModelSettings() }}>前往模型服务配置 Jev</button>}
      <button type="button" disabled={refreshingSettings} onClick={async () => {
        setRefreshingSettings(true); setConnectionError('')
        try { setConfigured((await waitForCompetition(() => access.settings(), 'Jev 配置')).configured) }
        catch (failure) { setConnectionError(failure instanceof Error ? failure.message : '配置读取失败，请重试。') }
        finally { setRefreshingSettings(false) }
      }}>刷新配置状态</button>
      {connectionError && <p className={css.error} role="alert">{connectionError}</p>}
    </div></details>
    <form noValidate onSubmit={event => { event.preventDefault(); if (!locked) { const issue = instrumentIssue(config, catalog); if (issue) setError(issue); else { setSettingsOpen(false); setError('') } } }}>
      <fieldset className={css.jevLauncher} disabled={locked} ref={launcherRef} tabIndex={-1}>
        <legend>选择运行模板</legend>
        <label>运行模板<select aria-label="运行模板" value={config.builtInTemplate === 'rb-range' ? 'range' : config.builtInTemplate || `saved:${config.strategyName}`} onChange={event => chooseTemplate(event.target.value)}>
          {builtIns.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          {templates.map(item => <option key={item.name} value={`saved:${item.name}`}>{item.name}</option>)}
          {!config.builtInTemplate && !templates.some(item => item.name === config.strategyName) && <option value={`saved:${config.strategyName}`}>{config.strategyName || '自定义配置'}</option>}
        </select></label>
        <button type="button" className={css.jevReuse} onClick={() => { setCreating(true); setNewName(''); setError('') }}>＋ 新建模板</button>
        {creating && <section className={css.jevCreator} aria-label="新建模板">
          <label>新模板名称<input maxLength={80} value={newName} placeholder="例如 我的午后策略" onChange={event => setNewName(event.target.value)}/></label>
          <label>创建方式<select value={newKind} onChange={event => setNewKind(event.target.value as TemplateKind)}>
            {builtIns.map(item => <option key={item.id} value={item.id}>基于{item.name}</option>)}<option value="blank">从空白创建</option>
          </select></label>
          <p>{newKind === 'blank' ? '运行参数已预填；请填写策略目标和五种动作标准，再保存。' : '复制完整参数和条件，修改后保存即可使用。'}</p>
          <button type="button" disabled={!newName.trim()} onClick={() => {
            const name = newName.trim()
            if (templates.some(item => item.name === name)) { setError('已有同名模板，请换个名称，或选择原模板进行修改。'); return }
            setConfig({ ...makeTemplate(newKind, config), builtInTemplate: undefined, strategyName: name }); setTemplateName(name); setTuning(true); setCreating(false); setError(''); setTemplateMessage('正在编辑新模板，完成后点击「保存为我的模板」。')
          }}>创建并编辑</button><button type="button" onClick={() => setCreating(false)}>取消</button>
        </section>}
        {previousConfig && <button type="button" className={css.jevReuse} onClick={() => { setConfig(structuredClone(previousConfig)); setTemplateName('') }}>载入上次运行配置</button>}
        <div className={css.jevQuickStart}>
          <label>决策方式<select value={config.decisionMode ?? 'strict'} onChange={event => setConfig({ ...config, decisionMode: event.target.value as 'jev' | 'strict' })}>
            <option value="jev">Jev 自主决策（推荐）</option><option value="strict">严格规则模式</option>
          </select></label>
          <JevInstrument compact config={config} onChange={setConfig} catalog={catalog}/>
          <div className={css.jevRunSummary}><strong>{config.strategyName ?? '自定义配置'} · 每笔最多 {config.volume} 手</strong>
            <span>{config.decisionIntervalSeconds ?? 30} 秒决策 · 运行 {config.durationMinutes} 分钟 · 最多 {config.maxPlans} 个开仓计划</span>
            <span>权益回落 {config.maxEquityDrop} 元暂停 · {config.autoHistory ? 'PandaData 行情自动准备' : '使用手动行情配置'}</span>
          </div>

        </div>
        <div className={css.jevCatalogTools}><span>{catalogMessage}</span>
          {access.varieties && <button type="button" disabled={!connected || catalogLoading} onClick={() => { void refreshCatalog() }}>{catalogLoading ? '正在同步…' : '同步柜台品种'}</button>}
          <span>自动识别交易所并预填 tick；合约月份由你填写。预填参数可修改，实际行情与交易以柜台为准。</span>
        </div>
        <details className={css.jevControls} ref={reviewRef} tabIndex={-1} open={tuning} onToggle={event => setTuning(event.currentTarget.open)}><summary>微调模板<span>频率、风控、策略与行情</span></summary>
        <p className={css.jevFine}>{config.decisionMode === 'jev' ? '策略条件作为参考发送给 Jev，由模型判断机会。历史不足也会请求分析并产生用量，但不允许新开仓；账户、方向、手数和风控限制仍生效。' : '严格规则模式：程序条件先筛选，全部可交易动作被拦截时不请求 Jev。旧配置沿用此模式，可在上方切换。'}</p>
        <p className={css.jevFine}>{rules ? '成本假设：每手双边手续费及滑点 ' + rules.roundTripCostTicks + ' tick，另计实际点差。默认值是可修改的模拟参数，未经收益回测。' : '使用自定义文字策略；行情有效后由 Jev 按你填写的条件判断。'}</p>
          <div className={css.watchFields}>
            {fields.map(([key, label, min, max, step]) => <label key={key}>{label}<input type="number" required min={min} max={max} step={step} value={config[key] ?? initial[key] ?? ''}
              onChange={event => setConfig({ ...config, [key]: Number(event.target.value) })}/></label>)}
            <label>允许开仓方向<select value={config.allowedSide ?? 'both'} onChange={event => setConfig({ ...config, allowedSide: event.target.value as 'both' | 'long_only' | 'short_only' })}>
              <option value="both">多空均可</option><option value="long_only">只开多</option><option value="short_only">只开空</option>
            </select></label>
            <JevEvidenceSettings access={access} config={config} onChange={setConfig} onBusy={setHistoryBusy}/>
            <JevStrategy config={config} onChange={setConfig}/>
          </div>
          <p className={css.jevFine}>冷却从每次生成计划起计时，仅限制下一次开仓；平仓按决策间隔评估，不占开仓名额。运行到期或触及权益停止线仍会停止盯盘，平仓计划仍需确认。</p>
          <div className={css.jevSaveTemplate}><label>保存模板名称<input maxLength={80} placeholder="例如 我的午后区间" value={templateName} onChange={event => setTemplateName(event.target.value)}/></label>
            <button type="button" onClick={() => { void saveTemplate() }}>{saving ? '保存中…' : '保存为我的模板'}</button></div>
          <p className={css.jevFine}>同名保存会更新已有模板，可不填实际合约先保存。换品种时核对交易所、tick 与成本；启动前必须填写柜台支持的实际合约。</p>
        </details>
      </fieldset>
      {templateMessage && <p className={css.jevFine}>{templateMessage}</p>}
      {!configured && <p className={css.jevFine}>首次使用：请在「设置 → 模型服务 → Jev」配置 API Key，后续无需重复填写。</p>}
      {!connected && <p className={css.jevFine}>先连接上方比赛账户，再开始盯盘。</p>}
      <p className={css.jevFine}>开始后向 TypeSafe 发送策略、行情与持仓摘要并产生 API 用量。权益停止线仅暂停盯盘，不自动清仓；每笔计划仍由你确认。</p>
      {error && <p className={css.error} role="alert">{error}</p>}
      <div className="qs-drawer-footer"><button type="button" disabled={!!busy || historyBusy || saving} onClick={cancelSettings}>取消</button><button type="submit" data-primary disabled={locked}>应用本次配置</button></div>
    </form>
    </ActionDialog>}
    {diagnostics && <ActionDialog drawer title="Jev 运行记录与诊断" onClose={() => setDiagnostics(false)}><JevUsage access={access}/>
    {status?.events.length ? <details><summary>运行记录（{status.events.length}）</summary><ol className={css.watchLog}>
      {[...status.events].reverse().map((entry, index) => <li key={`${entry.time}-${index}`}><time>{contestTime(entry.time)}</time> {entry.message}</li>)}
    </ol></details> : null}

    </ActionDialog>}
    {review && <ActionDialog title="核对本次盯盘" busy={!!busy} onClose={() => setReview(false)}>
      <p><strong>{config.symbol} · {config.strategyName}</strong></p><p>每笔最多 {config.volume} 手 · {config.durationMinutes} 分钟 · 最多 {config.maxPlans} 个开仓计划</p>
      <p>权益回落 {config.maxEquityDrop} 元暂停。调用 TypeSafe 会产生 API 用量；每笔计划仍由你确认，停止不撤单或平仓。</p>
      <div className="qs-drawer-footer"><button type="button" onClick={() => setReview(false)}>返回</button><button type="button" data-primary onClick={() => { reviewed.current = JSON.stringify(config); setReview(false); void run('start') }}>确认并开始盯盘</button></div>
    </ActionDialog>}
  </section>
}
