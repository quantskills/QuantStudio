import { createPortal } from 'react-dom'
import { agentLibrarySource, skillLibraryAssets } from './capability-library.ts'
import { EXPERT_PRESETS, PRESET_GROUPS, findPresetExpert, type ExpertPreset } from './expert-presets.ts'
import { TEAM_PRESETS, findPresetTeam, type TeamPreset } from './team-presets.ts'
import pickerCss from './CapabilityLibraryPicker.module.css'
import { CapabilityIcon } from './CapabilityIcon.tsx'
/** Session-resident QuantSkills chips and the taxonomy/frequent capability picker. */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type {
  QuantSkillsAgentDefinition, QuantSkillsAgentTeamDefinition, QuantSkillsAgentSessionBinding, QuantSkillsPromptFormCapability,
  QuantSkillsPromptFormListResult, QuantSkillsPromptFormRenderRequest, QuantSkillsSessionBinding,
  QuantSkillsSessionFileAttachment,
} from './plugin-types.ts'
import {
  createSnapshotStore, type ObservableSnapshot, type SnapshotStore,
} from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  CheckIcon as Check,
  PlusIcon as Plus,  SlidersHorizontalIcon as Sliders, XIcon as X, StackIcon,
} from '@phosphor-icons/react'
import type {
  QuantSkillsAgentsSnapshot, QuantSkillsAsset, QuantSkillsCatalogSnapshot, QuantSkillsSessionsSnapshot,
} from './types.ts'
import type { QuantSkillsAttachmentController } from './QuantSkillsAttachmentControl.tsx'
import css from './QuantSkillsApp.module.css'

/** Root views opened from the shared composer plus menu. */
export type QuantSkillsCapabilityPickerMode = 'catalog' | 'frequent'

/** Observable picker state shared by the slash source and overlay component. */
export interface QuantSkillsCapabilityPickerState {
  readonly open: boolean
  readonly sessionId?: SessionId
  readonly mode: QuantSkillsCapabilityPickerMode
}

/** Small controller that opens the session-scoped picker without touching draft text. */
export class QuantSkillsCapabilityPickerController {
  readonly source: SnapshotStore<QuantSkillsCapabilityPickerState> = createSnapshotStore({
    open: false,
    mode: 'catalog',
  })

  /** Open one root view for the addressed Session. */
  open(sessionId: SessionId, mode: QuantSkillsCapabilityPickerMode): void {
    this.source.set({ open: true, sessionId, mode })
  }

  /** Close the picker while retaining its last root for a stable next open. */
  close(): void {
    const current = this.source.getSnapshot()
    if (!current.open) return
    this.source.set({ ...current, open: false })
  }
}

/** Register the two top-level ability rows shown before composer commands. */
export function quantSkillsLauncherSource(
  picker: QuantSkillsCapabilityPickerController,
  attachments: QuantSkillsAttachmentController,
): InputTriggerSource {
  return {
    trigger: '/',
    name: 'quantskills',
    launcher: true,
    order: -20,
    showGroupTitle: false,
    candidates: (_session, request) => Promise.resolve(request.query === ''
      ? Object.freeze([
        Object.freeze({
          name: '文件',
          description: '从本机添加到当前会话',
          icon: 'file',
          value: 'attachment',
          section: '添加',
        }),
        Object.freeze({
          name: 'QuantSkills',
          description: '选择技能、专家或专家团',
          icon: 'folder',
          value: 'catalog',
          section: '能力',
        }),
        Object.freeze({
          name: '常用',
          description: '常用技能、专家与专家团',
          icon: 'session',
          value: 'frequent',
          section: '能力',
        }),
      ])
      : Object.freeze([])),
    onPick: ({ candidate, session }) => {
      if (candidate.value === 'attachment') {
        return attachments.open(session.sessionId) ? 'handled' : undefined
      }
      const mode = candidate.value
      if (mode !== 'catalog' && mode !== 'frequent') return undefined
      picker.open(session.sessionId, mode)
      return 'handled'
    },
  }
}

/** Business actions and observable data used by the taxonomy picker. */
export interface QuantSkillsCapabilityPickerInjected {
  readonly picker: ObservableSnapshot<QuantSkillsCapabilityPickerState>
  readonly catalog: ObservableSnapshot<QuantSkillsCatalogSnapshot>
  readonly sessions: ObservableSnapshot<QuantSkillsSessionsSnapshot>
  readonly agents: ObservableSnapshot<QuantSkillsAgentsSnapshot>
  readonly close: () => void
  readonly toggleSkill: (
    sessionId: SessionId,
    asset: QuantSkillsAsset,
    attached: QuantSkillsSessionBinding | undefined,
  ) => Promise<void>
  readonly openCatalogAgent: (asset: QuantSkillsAsset) => Promise<void>
  readonly openUserAgent: (definition: QuantSkillsAgentDefinition) => Promise<void>
  readonly openUserTeam: (definition: QuantSkillsAgentTeamDefinition) => Promise<void>
  readonly openExpertPreset: (preset: ExpertPreset) => Promise<void>
  readonly openTeamPreset: (preset: TeamPreset) => Promise<void>
}

/** Complete props for the overlay picker. */
export type QuantSkillsCapabilityPickerProps = PropsRuntime<'conversation.input.overlay'>
  & InjectFace<QuantSkillsCapabilityPickerInjected>

function useObservableSnapshot<T>(source: ObservableSnapshot<T>): T {
  return useSyncExternalStore(
    listener => source.subscribe(listener),
    () => source.getSnapshot(),
  )
}

/** Resolve legacy imported 专家 IDs to the current catalog title without replacing user names. */
function presentAgent(
  definition: Pick<QuantSkillsAgentDefinition, 'name' | 'sourceVersionId'>,
  assets: readonly QuantSkillsAsset[],
): { readonly displayName: string; readonly sourceAsset?: QuantSkillsAsset } {
  const sourceAssetId = definition.sourceVersionId?.split('@', 1)[0]
  const sourceAsset = assets.find(asset => asset.name === sourceAssetId)
  return {
    displayName: sourceAsset !== undefined && definition.name === sourceAsset.name
      ? sourceAsset.title
      : definition.name,
    ...(sourceAsset === undefined ? {} : { sourceAsset }),
  }
}

type PickerSource = 'mine' | 'recommended' | 'installed' | 'discover' | 'frequent'
type PickerKind = 'all' | 'skill' | 'agent' | 'agent-team'
type CapabilityRow = {
  id: string; kind: Exclude<PickerKind, 'all'>; name: string; description: string; category: string; subcategory?: string
  asset?: QuantSkillsAsset; expert?: QuantSkillsAgentDefinition; team?: QuantSkillsAgentTeamDefinition
  expertPreset?: ExpertPreset; teamPreset?: TeamPreset
}
const SOURCE_LABELS: Record<PickerSource, string> = { mine: '我创建的', recommended: '推荐的', installed: '已安装', discover: '发现的', frequent: '常用' }
const KIND_LABELS: Record<PickerKind, string> = { all: '全部', skill: '技能', agent: '专家', 'agent-team': '专家团' }

/** Local provenance and public recommendations remain separate, including private-only skills. */
export function capabilityLibraryRows(source: PickerSource, catalog: QuantSkillsCatalogSnapshot, agents: QuantSkillsAgentsSnapshot, sessions: QuantSkillsSessionsSnapshot): CapabilityRow[] {
  const assetRow = (asset: QuantSkillsAsset): CapabilityRow => ({ id: `asset:${asset.name}`, kind: asset.projectType, name: asset.title, description: asset.summary || asset.description || asset.name, category: asset.category || 'custom', subcategory: asset.subcategory, asset })
  const expertRow = (expert: QuantSkillsAgentDefinition): CapabilityRow => ({ id: `agent:${expert.agentId}`, kind: 'agent', name: presentAgent(expert, catalog.assets).displayName, description: expert.role.replace(/<!--[^]*?-->/g, '').split('\n').find(line => line.trim()) || `${expert.skills.length} 个技能`, category: EXPERT_PRESETS.find(preset => findPresetExpert(preset, [expert]))?.group ?? 'custom', expert })
  const teamRow = (team: QuantSkillsAgentTeamDefinition): CapabilityRow => ({ id: `team:${team.teamId}`, kind: 'agent-team', name: team.name, description: team.description.replace(/<!--[^]*?-->/g, '').split('\n').find(line => line.trim()) || `${team.members.length + 1} 位专家协作`, category: TEAM_PRESETS.find(preset => findPresetTeam(preset, [team]))?.group ?? 'custom', team })
  const sourceFor = (id: string, version?: string) => agentLibrarySource(id, version, agents.librarySources ?? [], catalog)
  if (source === 'discover') return catalog.assets.map(assetRow)
  if (source === 'recommended') {
    const recommendedSkills = new Set(EXPERT_PRESETS.flatMap(preset => preset.skills))
    return [
      ...catalog.assets.filter(asset => asset.projectType === 'skill' && recommendedSkills.has(asset.name)).map(assetRow),
      ...EXPERT_PRESETS.map(preset => ({ id: `expert-preset:${preset.id}`, kind: 'agent' as const, name: preset.name, description: preset.summary, category: preset.group, expertPreset: preset })),
      ...TEAM_PRESETS.map(preset => ({ id: `team-preset:${preset.id}`, kind: 'agent-team' as const, name: preset.name, description: preset.summary, category: preset.group, teamPreset: preset })),
    ]
  }
  if (source === 'frequent') {
    const available = [...skillLibraryAssets(catalog, 'mine'), ...skillLibraryAssets(catalog, 'installed'), ...catalog.assets]
    return [
      ...sessions.frequent.flatMap(item => { const asset = available.find(asset => asset.name === item.assetId && asset.projectType === 'skill'); return asset ? [assetRow(asset)] : [] }),
      ...agents.definitions.filter(expert => agents.archives.some(item => item.agent.agentId === expert.agentId)).map(expertRow),
      ...agents.teams.filter(team => agents.teamArchives.some(item => item.team.teamId === team.teamId)).map(teamRow),
    ]
  }
  return [
    ...skillLibraryAssets(catalog, source).map(assetRow),
    ...agents.definitions.filter(expert => sourceFor(expert.agentId, expert.sourceVersionId) === source).map(expertRow),
    ...agents.teams.filter(team => sourceFor(team.teamId) === source).map(teamRow),
  ]
}

/** Search and filter every capability without changing the current draft. */
export function QuantSkillsCapabilityPicker({
  sessionId, useProjection, picker, catalog, sessions, agents,
  close, toggleSkill, openCatalogAgent, openUserAgent, openUserTeam, openExpertPreset, openTeamPreset,
}: QuantSkillsCapabilityPickerProps) {
  const pickerState = useObservableSnapshot(picker), catalogState = useObservableSnapshot(catalog)
  const sessionsState = useObservableSnapshot(sessions), agentsState = useObservableSnapshot(agents)
  const resident = useProjection('quantSkillsResidentSkills') ?? []
  const rootRef = useRef<HTMLDialogElement>(null), searchRef = useRef<HTMLInputElement>(null), locked = useRef(false)
  const [source, setSource] = useState<PickerSource>('mine'), [kind, setKind] = useState<PickerKind>('all')
  const [category, setCategory] = useState('all'), [subcategory, setSubcategory] = useState('all'), [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string>(), [error, setError] = useState<string>()
  const visible = pickerState.open && pickerState.sessionId === sessionId
  useEffect(() => {
    if (!visible) return
    setSource(pickerState.mode === 'frequent' ? 'frequent' : 'mine'); setKind('all'); setCategory('all'); setSubcategory('all'); setQuery(''); setError(undefined)
    const dialog = rootRef.current!, previous = document.activeElement
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '')
    searchRef.current?.focus()
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close() } }
    dialog.addEventListener('keydown', escape)
    return () => { dialog.removeEventListener('keydown', escape); dialog.close?.(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus() }
  }, [visible, pickerState.mode, close])
  const rows = useMemo(() => capabilityLibraryRows(source, catalogState, agentsState, sessionsState), [source, catalogState, agentsState, sessionsState])
  const typedRows = rows.filter(row => kind === 'all' || row.kind === kind)
  const categories = [...new Set(typedRows.map(row => row.category))]
  const categoryLabel = (id: string) => catalogState.categories.find(item => item.id === id)?.label ?? PRESET_GROUPS[id as keyof typeof PRESET_GROUPS] ?? '自定义'
  const selectedCategory = catalogState.categories.find(item => item.id === category)
  const filtered = typedRows.filter(row => (category === 'all' || row.category === category)
    && (subcategory === 'all' || row.subcategory === subcategory)
    && `${row.name} ${row.description} ${row.asset?.name ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const loading = source === 'discover' ? catalogState.phase === 'loading' : source !== 'recommended' && (agentsState.phase === 'loading' || catalogState.installedPhase === 'loading')
  const sourceError = source === 'discover' ? catalogState.catalogError : source !== 'recommended' ? agentsState.error ?? catalogState.installedError : undefined
  if (!visible) return null
  const invoke = async (row: CapabilityRow) => {
    if (locked.current) return
    locked.current = true; setBusyId(row.id); setError(undefined)
    try {
      if (row.asset) {
        if (row.asset.projectType === 'skill') await toggleSkill(sessionId, row.asset, resident.find(binding => binding.assetId === row.asset!.name))
        else await openCatalogAgent(row.asset)
      } else if (row.expert) await openUserAgent(row.expert)
      else if (row.team) await openUserTeam(row.team)
      else if (row.expertPreset) await openExpertPreset(row.expertPreset)
      else if (row.teamPreset) await openTeamPreset(row.teamPreset)
      close()
    } catch (reason) { setError(reason instanceof Error ? reason.message : '操作失败，请重试。') }
    finally { locked.current = false; setBusyId(undefined) }
  }
  const changeSource = (next: PickerSource) => { setSource(next); setCategory('all'); setSubcategory('all'); setError(undefined) }
  return createPortal(<dialog ref={rootRef} className={pickerCss.dialog} aria-label="QuantSkills 能力选择器" onCancel={event => { event.preventDefault(); close() }} onClick={event => {
    if (event.target !== event.currentTarget) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close()
  }}>
    <header className={pickerCss.header}><div><h2>选择能力</h2><p>技能加载到当前会话，专家与专家团开启独立会话。</p></div><button type="button" aria-label="关闭 QuantSkills 菜单" onClick={close}><X size={20}/></button></header>
    <div className={pickerCss.sources} role="group" aria-label="能力来源">{(Object.keys(SOURCE_LABELS) as PickerSource[]).map(id => <button type="button" key={id} aria-pressed={source === id} onClick={() => changeSource(id)}>{SOURCE_LABELS[id]}</button>)}</div>
    <div className={pickerCss.kinds} role="group" aria-label="能力类型">{(Object.keys(KIND_LABELS) as PickerKind[]).map(id => <button type="button" key={id} aria-pressed={kind === id} onClick={() => { setKind(id); setCategory('all'); setSubcategory('all') }}>{KIND_LABELS[id]} <span>{rows.filter(row => id === 'all' || row.kind === id).length}</span></button>)}</div>
    <div className={pickerCss.filters}><input ref={searchRef} type="search" aria-label="搜索能力" placeholder="搜索名称、用途或关键词" value={query} onChange={event => setQuery(event.target.value)}/><select aria-label="能力分类" value={category} onChange={event => { setCategory(event.target.value); setSubcategory('all') }}><option value="all">全部分类</option>{categories.map(id => <option key={id} value={id}>{categoryLabel(id)}</option>)}</select>{!!selectedCategory?.subcategories.length && <select aria-label="能力子分类" value={subcategory} onChange={event => setSubcategory(event.target.value)}><option value="all">全部子分类</option>{selectedCategory.subcategories.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>}</div>
    <section className={pickerCss.results} aria-label="具体能力" aria-busy={!!busyId}>
      {filtered.map(row => {
        const attached = row.kind === 'skill' && resident.some(binding => binding.assetId === row.asset?.name)
        return <button type="button" className={pickerCss.result} key={row.id} disabled={!!busyId} onClick={() => void invoke(row)}>
          <CapabilityIcon kind={row.kind} size={23}/><span className={pickerCss.copy}><strong>{row.name}</strong><span>{row.description}</span><small>{KIND_LABELS[row.kind]} · {categoryLabel(row.category)}{attached ? ' · 已加载' : ''}</small></span><span className={pickerCss.action}>{busyId === row.id ? '正在准备…' : attached ? <><Check size={14}/>移除</> : row.kind === 'skill' ? '加载' : row.kind === 'agent-team' ? '开始团队会话' : '开始对话'}</span>
        </button>
      })}
      {loading && !filtered.length && <p className={pickerCss.empty} role="status">正在读取能力库…</p>}
      {!loading && !filtered.length && <div className={pickerCss.empty}><strong>{query.trim() ? '没有找到匹配的能力' : source === 'discover' && kind === 'agent-team' ? '公开目录暂未提供专家团' : '这里还没有可选能力'}</strong><p>{query.trim() ? '试试其他名称或关键词。' : source === 'mine' ? '你创建的技能、专家和专家团会显示在这里，也可以先使用推荐能力。' : source === 'discover' && kind === 'agent-team' ? '可以从推荐专家团开始，或使用你创建的专家团。' : '切换来源或分类，查看更多能力。'}</p>{!query.trim() && source !== 'recommended' && <button type="button" onClick={() => changeSource('recommended')}>查看推荐</button>}</div>}
    </section>
    {(error || sourceError) && <p className={pickerCss.error} role="alert">{error || sourceError}</p>}
    <footer className={pickerCss.footer}><span>{SOURCE_LABELS[source]} · {filtered.length} 项</span><span>{source === 'recommended' ? '首次使用会保存专家配置；已有配置会复用。' : source === 'discover' ? '未安装的能力会先安装，再打开。' : '当前输入内容会保留。'}</span></footer>
  </dialog>, document.body)
}

/** Business callback needed by the resident chips. */
export interface QuantSkillsResidentControlInjected {
  readonly catalog: ObservableSnapshot<QuantSkillsCatalogSnapshot>
  readonly detach: (sessionId: SessionId, assetId: string) => Promise<void>
  readonly openPicker: (sessionId: SessionId) => void
  readonly listPromptForms: (sessionId: SessionId) => Promise<QuantSkillsPromptFormListResult>
  readonly renderPromptForm: (request: QuantSkillsPromptFormRenderRequest) => Promise<string>
  readonly fillDraft: (sessionId: SessionId, text: string) => void
  readonly runPrompt: (sessionId: SessionId, text: string) => void
}

/** Complete props for resident capability chips inside the composer tool row. */
export type QuantSkillsResidentControlProps = PropsRuntime<'conversation.input.left'>
  & InjectFace<QuantSkillsResidentControlInjected>

function promptFormStatus(form: QuantSkillsPromptFormCapability | undefined): string {
  const promptForm = form?.promptForm
  if (promptForm === undefined) return ''
  if (promptForm.status === 'invalid') return ' · 参数不可用'
  if ((promptForm.adaptations?.length ?? 0) > 0) return ' · 已兼容旧格式'
  return ''
}

/** Show the Session's resident 专家 and 技能 set with one-click 技能 removal. */
export function QuantSkillsResidentControl({
  sessionId, useProjection, catalog, detach, openPicker, listPromptForms, renderPromptForm,
  fillDraft, runPrompt,
}: QuantSkillsResidentControlProps) {
  const resident = useProjection('quantSkillsResidentSkills') ?? []
  const agent: QuantSkillsAgentSessionBinding | null | undefined = useProjection('quantSkillsAgentSession')
  const attachments: readonly QuantSkillsSessionFileAttachment[] = useProjection('quantSkillsAttachments') ?? []
  const catalogState = useObservableSnapshot(catalog)
  const agentDisplayName = agent == null ? undefined : presentAgent(agent, catalogState.assets).displayName
  const [busy, setBusy] = useState<string>()
  const [open, setOpen] = useState(false)
  const [parameterOpen, setParameterOpen] = useState(false)
  const [forms, setForms] = useState<readonly QuantSkillsPromptFormCapability[]>([])
  const [formsLoading, setFormsLoading] = useState(false)
  const [selectedVersionId, setSelectedVersionId] = useState<string>()
  const [task, setTask] = useState('')
  const [values, setValues] = useState<Readonly<Record<string, string>>>({})
  const [error, setError] = useState<string>()
  const rootRef = useRef<HTMLDivElement>(null)
  const residentKey = resident.map(binding => binding.versionId).join('|')
  const agentKey = agent == null ? '' : `${agent.agentId}:${String(agent.revision)}:${agent.sourceVersionId ?? ''}`
  const selectedForm = forms.find(form => form.versionId === selectedVersionId)
  const readyForms = forms.filter(form => form.promptForm.status === 'ready')

  useEffect(() => {
    if (!open && !parameterOpen) return
    const dismiss = (event: PointerEvent): void => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false)
        setParameterOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false)
        setParameterOpen(false)
      }
    }
    document.addEventListener('pointerdown', dismiss, true)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', dismiss, true)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open, parameterOpen])
  useEffect(() => {
    if (!open && !parameterOpen) return
    let current = true
    setFormsLoading(true)
    void listPromptForms(sessionId).then((result) => {
      if (!current) return
      setForms(result.forms)
      setSelectedVersionId(selected => result.forms.some(form => form.versionId === selected)
        ? selected
        : (result.forms.find(form => form.promptForm.status === 'ready') ?? result.forms[0])?.versionId)
      setError(undefined)
    }).catch((reason: unknown) => {
      if (current) setError(reason instanceof Error ? reason.message : '无法读取参数表单')
    }).finally(() => {
      if (current) setFormsLoading(false)
    })
    return () => { current = false }
  }, [open, parameterOpen, sessionId, residentKey, agentKey, listPromptForms])
  useEffect(() => {
    const selected = forms.find(form => form.versionId === selectedVersionId)
    if (selected?.promptForm.status !== 'ready') {
      setTask('')
      setValues({})
      return
    }
    setTask('')
    setValues(Object.fromEntries(selected.promptForm.form.fields.map(field => [
      field.key,
      field.default === undefined ? '' : String(field.default),
    ])))
  }, [selectedVersionId, sessionId])
  const capabilityCount = resident.length + (agent == null ? 0 : 1)
  const formLabel = (form: QuantSkillsPromptFormCapability): string => catalogState.assets
    .find(asset => asset.name === form.assetId)?.title ?? form.assetId
  const invokeForm = async (action: 'fill' | 'run'): Promise<void> => {
    if (selectedForm?.promptForm.status !== 'ready') return
    setBusy(`form:${action}`)
    setError(undefined)
    try {
      const text = await renderPromptForm({
        sessionId,
        versionId: selectedForm.versionId,
        task,
        values,
      })
      if (action === 'run') runPrompt(sessionId, text)
      else fillDraft(sessionId, text)
      setParameterOpen(false)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : '参数渲染失败')
    } finally {
      setBusy(undefined)
    }
  }
  return (
    <div ref={rootRef} className={css.residentCapabilities}>
      <button
        type="button"
        className={css.residentCapabilitySummary}
        aria-label={`本会话已加载 ${String(capabilityCount)} 项能力`}
        title={`已加载 ${String(capabilityCount)} 项能力 · 点击管理`}
        aria-haspopup="dialog"
        aria-expanded={open || parameterOpen}
        onClick={() => { setOpen(value => !value); setParameterOpen(false); setError(undefined) }}
      >
        <StackIcon size={20} weight="duotone" aria-hidden="true"/>
        <b aria-hidden="true" data-empty={capabilityCount === 0 || undefined}>{capabilityCount > 99 ? '99+' : capabilityCount}</b>
      </button>
      {open && <section className={css.residentCapabilityMenu} role="dialog" aria-label="本会话已加载能力">
        <header><span><b>本会话能力</b><small>常驻当前上下文，可随时热插拔 技能</small></span></header>
        <div>
          {resident.length === 0 && agent == null && <p className={css.residentCapabilityEmpty}>
            当前会话还没有加载 技能 或 专家。
          </p>}
          {agent != null && <article title={`专家 版本 ${String(agent.revision)}`}>
            <span className={css.residentCapabilityIcon}><CapabilityIcon kind="agent" size={15} bare/></span>
            <span><b>{agentDisplayName}</b><small>会话专家 · 随会话固定{promptFormStatus(forms.find(form => form.versionId === agent.sourceVersionId))}</small></span>
          </article>}
          {resident.map((binding) => {
            const label = catalogState.assets.find(asset => asset.name === binding.assetId)?.title ?? binding.assetId
            const form = forms.find(candidate => candidate.versionId === binding.versionId)
            return <article key={binding.versionId} title={`${binding.assetId} · ${binding.commit.slice(0, 12)}`}>
              <span className={css.residentCapabilityIcon}><CapabilityIcon kind="skill" size={15} bare/></span>
              <span><b>{label}</b><small>{binding.assetId}{promptFormStatus(form)}</small></span>
              <button
                type="button"
                aria-label={`卸载 ${label}`}
                disabled={busy === binding.assetId}
                onClick={() => {
                  setBusy(binding.assetId)
                  setError(undefined)
                  void detach(sessionId, binding.assetId).catch((reason: unknown) => {
                    setError(reason instanceof Error ? reason.message : '无法卸载 技能')
                  }).finally(() => { setBusy(undefined) })
                }}
              ><X size={13}/><span>{busy === binding.assetId ? '处理中' : '移除'}</span></button>
            </article>
          })}
        </div>
        <footer>
          {error !== undefined && <small role="alert">{error}</small>}
          {readyForms.length > 0 && <button type="button" onClick={() => {
            setSelectedVersionId(selected => readyForms.some(form => form.versionId === selected)
              ? selected
              : readyForms[0]?.versionId)
            setOpen(false)
            setParameterOpen(true)
            setError(undefined)
          }}><Sliders size={14}/>参数</button>}
          <button type="button" onClick={() => { setOpen(false); openPicker(sessionId) }}><Plus size={14}/>添加技能、专家或专家团</button>
        </footer>
      </section>}
      {parameterOpen && <section className={css.promptFormDrawer} role="dialog" aria-label="QuantSkills 参数">
        <header>
          <span><b>参数</b><small>可选快捷输入；自然语言对话仍可直接使用能力</small></span>
          <button type="button" aria-label="关闭参数面板" onClick={() => { setParameterOpen(false) }}><X size={15}/></button>
        </header>
        <div className={css.promptFormBody}>
          {formsLoading && <p className={css.promptFormHint}>正在读取当前会话参数…</p>}
          {!formsLoading && forms.length > 1 && <label className={css.promptFormField}>
            <span>能力</span>
            <select aria-label="参数能力" value={selectedVersionId ?? ''} onChange={(event) => { setSelectedVersionId(event.target.value) }}>
              {forms.map(form => <option key={form.versionId} value={form.versionId}>{formLabel(form)}{form.promptForm.status === 'invalid' ? '（参数不可用）' : ''}</option>)}
            </select>
          </label>}
          {selectedForm?.promptForm.status === 'invalid' && <div className={css.promptFormInvalid} role="alert">
            <b>参数不可用</b><span>{selectedForm.promptForm.reason}</span><small>能力正文仍按原文常驻，可继续自然语言对话。</small>
          </div>}
          {selectedForm?.promptForm.status === 'ready' && <>
            {(selectedForm.promptForm.adaptations?.length ?? 0) > 0 && <p className={css.promptFormHint} role="status">
              已兼容旧格式：数字参数默认值已安全转换，原始能力文件未修改。
            </p>}
            <label className={css.promptFormField}>
              <span>任务{selectedForm.promptForm.form.task?.required === true && <em>必填</em>}</span>
              <textarea
                aria-label="参数任务"
                value={task}
                placeholder={selectedForm.promptForm.form.task?.placeholder ?? '描述你希望 AI 完成的任务'}
                onChange={(event) => { setTask(event.target.value) }}
              />
            </label>
            {selectedForm.promptForm.form.fields.map(field => <label key={field.key} className={css.promptFormField}>
              <span>{field.label}{field.required === true && <em>必填</em>}</span>
              {field.type === 'textarea'
                ? <textarea aria-label={`参数 ${field.label}`} value={values[field.key] ?? ''} placeholder={field.placeholder} onChange={(event) => { setValues(current => ({ ...current, [field.key]: event.target.value })) }}/>
                : field.type === 'select'
                  ? <select aria-label={`参数 ${field.label}`} value={values[field.key] ?? ''} onChange={(event) => { setValues(current => ({ ...current, [field.key]: event.target.value })) }}>
                    {!field.required && <option value="">不指定</option>}
                    {field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  : <input
                    aria-label={`参数 ${field.label}`}
                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                    value={values[field.key] ?? ''}
                    placeholder={field.placeholder}
                    onChange={(event) => { setValues(current => ({ ...current, [field.key]: event.target.value })) }}
                  />}
              {field.help !== undefined && <small>{field.help}</small>}
            </label>)}
            <section className={css.promptFormAttachments} aria-label="当前附件">
              <span>附件 <b>{attachments.length}</b></span>
              {attachments.length === 0
                ? <small>当前会话没有附件</small>
                : <ul>{attachments.map(attachment => <li key={attachment.file.attachmentId}>{attachment.file.name}</li>)}</ul>}
            </section>
          </>}
          {!formsLoading && forms.length === 0 && <p className={css.promptFormHint}>当前加载能力没有声明 qsh-form。</p>}
          {error !== undefined && <p className={css.promptFormError} role="alert">{error}</p>}
        </div>
        {selectedForm?.promptForm.status === 'ready' && <footer>
          <button type="button" disabled={busy !== undefined} onClick={() => { void invokeForm('fill') }}>填入输入框</button>
          <button type="button" disabled={busy !== undefined} onClick={() => { void invokeForm('run') }}>{busy === 'form:run' ? '正在运行…' : '应用并运行'}</button>
        </footer>}
      </section>}
    </div>
  )
}
