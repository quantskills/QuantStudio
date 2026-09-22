import { useEffect, useId, useRef, useState } from 'react'
import type { ContestWatchConfig, ContestWatchStatus, ContestWatchTemplate } from './plugin-types.ts'
import type { ContestAccess } from './contest.ts'
import { contestTime } from './contest.ts'
import { waitForCompetition } from './competition-async.ts'
import { JevConnection } from './JevConnection.tsx'
import { JevUsage } from './JevUsage.tsx'
import { JevStrategy } from './JevStrategy.tsx'
import { JevEvidenceSettings } from './JevEvidenceSettings.tsx'
import { ContestWatchVisuals } from './ContestWatchVisuals.tsx'
import { instrumentIssue, makeTemplate, rangeTemplate, templates as builtIns, withInstrument, type TemplateKind } from './jev-templates.ts'
import { useJevProducts } from './jev-catalog.ts'
import { JevInstrument } from './JevInstrument.tsx'
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

export function ContestWatch({ access, connected = true }: { access: NonNullable<ContestAccess['watch']>; connected?: boolean }) {
  const { catalog, message: catalogMessage, loading: catalogLoading, refresh: refreshCatalog } = useJevProducts(access, connected)
  const [expanded, setExpanded] = useState(true), contentId = useId()
  const [status, setStatus] = useState<ContestWatchStatus>(), [config, setConfig] = useState(initial)
  const [tuning, setTuning] = useState(false), [busy, setBusy] = useState(''), [error, setError] = useState('')
  const [templates, setTemplates] = useState<ContestWatchTemplate[]>([]), [templateName, setTemplateName] = useState(''), [templateMessage, setTemplateMessage] = useState('')
  const [saving, setSaving] = useState(false), [previousConfig, setPreviousConfig] = useState<ContestWatchConfig>()
  const [creating, setCreating] = useState(false), [newKind, setNewKind] = useState<TemplateKind>('range'), [newName, setNewName] = useState('')
  const [statusError, setStatusError] = useState('')
  const [configured, setConfigured] = useState(false), [keyBusy, setKeyBusy] = useState(false)
  const [historyBusy, setHistoryBusy] = useState(false)
  const hydrated = useRef(false), epoch = useRef(0), pending = useRef(false)
  useEffect(() => {
    let disposed = false
    void access.templates().then(items => { if (!disposed) setTemplates(items) }).catch(() => { if (!disposed) setTemplateMessage('模板列表读取失败，请重新进入页面；内置模板仍可使用。') })
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
          if (next.config) { setPreviousConfig(next.config); setConfig(next.running || next.config.autoHistory || next.config.rangeRules || next.config.signalRules || next.config.customStrategy ? { ...next.config, decisionIntervalSeconds: next.config.decisionIntervalSeconds ?? 30 } : rangeTemplate(next.config.symbol)) }
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
  const locked = Boolean(!status || status.running || busy || keyBusy || historyBusy || saving)
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
  const active = Boolean(status?.running && !statusError && !busy)
  const rules = config.rangeRules ?? config.signalRules
  const phase = statusError ? 'unknown' : busy || !status ? 'pending' : status.running ? status.phase ?? 'sampling' : 'stopped'
  const label = statusError ? '连接中断 · 状态待确认' : busy === 'stop' ? '正在停止盯盘' : busy === 'start' ? '正在启动盯盘'
    : !status ? '正在读取盯盘状态' : status.running ? phases[status.phase ?? 'sampling'] : '盯盘未运行'
  return <section className={`${css.assistant} ${css.watchWorkbench}`} aria-label="Jev 持续盯盘">
    <div className={css.assistantHeading}>
      <div><span className={css.jevCaption}>JEV / 期货模拟交易</span><h2><button type="button" className={css.watchToggle} aria-expanded={expanded} aria-controls={contentId}
        onClick={() => setExpanded(value => !value)}>Jev 持续盯盘 <span>{expanded ? '▾ 收起' : '▸ 展开'}</span></button></h2>
        <p>{expanded ? '选一个模板即可开始，想调整时再展开微调。每笔交易仍由你确认。' : label}</p></div>
      {(status?.running || busy === 'start') && <button type="button" disabled={busy === 'stop'} onClick={() => { void run('stop') }}>{busy === 'stop' ? '停止中…' : '停止盯盘'}</button>}
    </div>
    <div id={contentId} hidden={!expanded}>
    <JevConnection access={access} disabled={Boolean(status?.running || busy || saving || historyBusy)} onConfigured={setConfigured} onBusy={setKeyBusy}/>
    {error && <p className={css.error} role="alert">{error}</p>}
    {statusError && <p className={css.error} role="alert">{statusError}</p>}
    <div className={css.watchStatus} role="status" data-phase={phase} data-active={active}>
      <span className={css.watchIndicator} aria-hidden="true"/>
      <div><strong>{label}</strong><p>{statusError ? '暂时无法确认盯盘状态，正在重试连接。' : status?.message ?? '读取盯盘状态…'}</p>
        {phase === 'waiting_quote' && <p>实时报价来自比赛柜台，PandaData 用于历史 K 线；PandaData 已授权不代表柜台已返回有效报价。请在比赛页「最新行情」核对{status?.config?.symbol ? ` ${status.config.symbol} ` : '同一合约'}的价格与时间。</p>}
        {status?.lastQuoteCheckedAt && <small>最近行情检查：{contestTime(status.lastQuoteCheckedAt)}{status.running && status.config ? ` · 采样间隔 ${status.config.intervalSeconds} 秒` : ''}</small>}
        {status?.nextRetryAt && status.running && <p>柜台重试时间：{contestTime(status.nextRetryAt)}，等待期间不请求 Jev。</p>}
        {status?.accountCheckedAt && <small>最近账户巡检：{contestTime(status.accountCheckedAt)}</small>}
      </div>
    </div>
    <form noValidate onSubmit={event => { event.preventDefault(); if (!locked && configured && connected) void run('start') }}>
      <fieldset className={css.jevLauncher} disabled={locked}>
        <legend>选择运行模板</legend>
        <div className={css.jevTemplateGrid}>
          {builtIns.map(item => <button key={item.id} type="button" className={css.jevTemplateCard} aria-pressed={config.builtInTemplate === item.id || (item.id === 'range' && config.builtInTemplate === 'rb-range')}
            onClick={() => { setConfig(makeTemplate(item.id, config)); setTemplateName(''); setCreating(false); setError('') }}>
            <span className={css.jevCaption}>内置模板 · 品种可选</span><strong>{item.name}</strong><span>{item.description}</span><small>1 分钟行情 · 默认 1 手 · 每笔确认</small>
          </button>)}
          {templates.map(item => <button key={item.name} type="button" className={css.jevTemplateCard} aria-pressed={!config.builtInTemplate && config.strategyName === item.name}
            onClick={() => { const saved = structuredClone(item.config), applied = config.symbol && config.instrument ? { ...withInstrument(saved, config.instrument), symbol: config.symbol } : saved;
              if (saved.symbol.toLowerCase() !== applied.symbol.toLowerCase()) applied.history = undefined
              setConfig(applied); setTemplateName(item.name); setCreating(false); setError('') }}>
            <span className={css.jevCaption}>我的模板</span><strong>{item.name}</strong><span>{item.config.volume} 手 · {item.config.decisionIntervalSeconds ?? 30} 秒决策 · 品种可选</span>
          </button>)}
        </div>
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
          <JevInstrument config={config} onChange={setConfig} catalog={catalog}/>
          <div className={css.jevRunSummary}><strong>{config.strategyName ?? '自定义配置'} · 每笔最多 {config.volume} 手</strong>
            <span>{config.decisionIntervalSeconds ?? 30} 秒决策 · 运行 {config.durationMinutes} 分钟 · 最多 {config.maxPlans} 个开仓计划</span>
            <span>权益回落 {config.maxEquityDrop} 元暂停 · {config.autoHistory ? 'PandaData 行情自动准备' : '使用手动行情配置'}</span>
          </div>
          {!status?.running && <button type="submit" data-primary disabled={!config.symbol || !configured || !connected}>{busy === 'start' ? '正在准备行情并启动…' : '开始盯盘'}</button>}
        </div>
        <div className={css.jevCatalogTools}><span>{catalogMessage}</span>
          {access.varieties && <button type="button" disabled={!connected || catalogLoading} onClick={() => { void refreshCatalog() }}>{catalogLoading ? '正在同步…' : '同步柜台品种'}</button>}
          <span>自动识别交易所并预填 tick；合约月份由你填写。预填参数可修改，实际行情与交易以柜台为准。</span>
        </div>
        <details className={css.jevControls} open={tuning} onToggle={event => setTuning(event.currentTarget.open)}><summary>微调模板<span>频率、风控、策略与行情</span></summary>
        <p className={css.jevFine}>{config.decisionMode === 'jev' ? '策略条件作为参考发送给 Jev，由模型判断机会。历史不足也会请求分析并产生用量，但不允许新开仓；账户、方向、手数和风控限制仍生效。' : '严格规则模式：程序条件先筛选，全部可交易动作被拦截时不请求 Jev。旧配置沿用此模式，可在上方切换。'}</p>
        <p className={css.jevFine}>{rules ? '成本假设：每手双边手续费及滑点 ' + rules.roundTripCostTicks + ' tick，另计实际点差。默认值是可修改的模拟参数，未经收益回测。' : '使用自定义文字策略；行情有效后由 Jev 按你填写的条件判断。'}</p>
          <div className={css.watchFields}>
            {fields.map(([key, label, min, max, step]) => <label key={key}>{label}<input type="number" required min={min} max={max} step={step} value={key === 'openingCooldownSeconds' ? config[key] ?? 300 : config[key]}
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
      {!configured && <p className={css.jevFine}>首次使用：在上方配置 Jev 密钥，后续无需重复填写。</p>}
      {!connected && <p className={css.jevFine}>先连接上方比赛账户，再开始盯盘。</p>}
      <p className={css.jevFine}>开始后向 TypeSafe 发送策略、行情与持仓摘要并产生 API 用量。权益停止线仅暂停盯盘，不自动清仓；每笔计划仍由你确认。</p>
    </form>
    {status?.strategyNotices?.map(note => <p key={note} className={css.jevFine}>{note}</p>)}
    {(status?.running || status?.analyses?.length) ? <ContestWatchVisuals status={status} active={active}/> : null}
    <details className={css.jevHistory}><summary>接口用量与诊断</summary><JevUsage access={access}/></details>
    {status && <div className={css.watchSummary}>
      <span>本次开仓计划 {status.openingPlanCount ?? status.planCount}/{status.config?.maxPlans ?? '—'} · 总计划 {status.planCount}</span>
      {status.running && status.openingCooldownUntil && status.openingCooldownUntil > Date.now() && <span>开仓冷却至 {contestTime(status.openingCooldownUntil)}（不影响平仓判断）</span>}
      {status.running && status.nextDecisionAt && <span>下次决策最早 {contestTime(status.nextDecisionAt)}（需有效样本、无待处理计划）</span>}
    </div>}
    {status?.events.length ? <details><summary>运行记录（{status.events.length}）</summary><ol className={css.watchLog}>
      {[...status.events].reverse().map((entry, index) => <li key={`${entry.time}-${index}`}><time>{contestTime(entry.time)}</time> {entry.message}</li>)}
    </ol></details> : null}
    </div>
  </section>
}
