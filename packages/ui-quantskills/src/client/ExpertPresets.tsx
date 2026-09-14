import { useRef, useState, type ReactNode } from 'react'
import { EXPERT_PRESETS, PRESET_GROUPS, findPresetExpert, presetRequest, type ExpertPreset } from './expert-presets.ts'
import type { QuantSkillsAgentCreateRequest, QuantSkillsAgentDefinition } from './plugin-types.ts'
import type { QuantSkillsInstalledVersion } from './types.ts'
import css from './ExpertPresets.module.css'

export interface ExpertPresetsProps {
  definitions: readonly QuantSkillsAgentDefinition[]
  versions: readonly QuantSkillsInstalledVersion[]
  ready: boolean
  icon?: ReactNode
  create(request: QuantSkillsAgentCreateRequest): Promise<QuantSkillsAgentDefinition>
  start(definition: QuantSkillsAgentDefinition): Promise<unknown>
  open(definition: QuantSkillsAgentDefinition): void
}

export function ExpertPresets(props: ExpertPresetsProps) {
  const [group, setGroup] = useState<'all' | ExpertPreset['group']>('all')
  const [created, setCreated] = useState<QuantSkillsAgentDefinition[]>([])
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('')
  const locked = useRef(false)
  const definitions = [...props.definitions, ...created]
  const savedCount = EXPERT_PRESETS.filter(item => findPresetExpert(item, definitions)).length
  const ensure = async (preset: ExpertPreset) => {
    const existing = findPresetExpert(preset, definitions)
    if (existing) return existing
    const saved = await props.create(presetRequest(preset, props.versions))
    setCreated(current => [...current.filter(item => item.agentId !== saved.agentId), saved])
    return saved
  }
  const run = async (id: string, task: () => Promise<void>) => {
    if (locked.current || !props.ready) return
    locked.current = true; setBusy(id); setError(''); setMessage('')
    try { await task() } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败，请重试。已保存的专家会保留。') }
    finally { locked.current = false; setBusy('') }
  }
  return <section className={css.library} aria-label="推荐专家库">
    <header className={css.header}><div><h2>选一位专家，开始工作</h2><p>投资研究、量化研究与日常办公共 20 位，保存后可在「我的创建」中修改、收藏或加入专家团。</p></div>
      <button disabled={!props.ready || !!busy || savedCount === EXPERT_PRESETS.length} onClick={() => void run('all', async () => {
        for (const preset of EXPERT_PRESETS) await ensure(preset)
        setMessage(`${EXPERT_PRESETS.length} 位专家已保存，可在这里开始对话，也可到「我的创建」继续配置。`)
      })}>{busy === 'all' ? '正在添加…' : savedCount === EXPERT_PRESETS.length ? '已全部添加' : '添加全部专家'}</button>
    </header>
    <div className={css.filters} aria-label="专家用途">{([['all', `全部 ${EXPERT_PRESETS.length}`], ...Object.entries(PRESET_GROUPS).map(([id, label]) => [id, `${label} ${EXPERT_PRESETS.filter(item => item.group === id).length}`])] as [typeof group, string][]).map(([id, label]) => <button key={id} aria-pressed={group === id} onClick={() => setGroup(id)}>{label}</button>)}<span>已添加 {savedCount} / {EXPERT_PRESETS.length}</span></div>
    {error && <p className={css.error} role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <div className={css.grid}>{EXPERT_PRESETS.filter(preset => group === 'all' || preset.group === group).map(preset => {
      const saved = findPresetExpert(preset, definitions), count = presetRequest(preset, props.versions).versionIds.length
      return <article key={preset.id} data-group={preset.group} aria-label={preset.name}>
        <div className={css.title}>{props.icon}<div><small>{PRESET_GROUPS[preset.group]}{preset.id === 'quant-research' ? ' · 不知道选谁，从这里开始' : ''}</small><h3>{preset.name}</h3></div></div>
        <p className={css.summary}>{preset.summary}</p>
        <blockquote><small>试试这样问</small>{preset.example}</blockquote>
        <p className={css.output}><b>交付</b>{preset.output}</p>
        <small className={css.status}>{saved ? `已保存 · ${saved.skills.length} 个绑定技能` : `${count} 个已安装技能可绑定 · 其余按任务检查`}</small>
        <footer><button className={css.primary} disabled={!props.ready || !!busy} onClick={() => void run(preset.id, async () => { await props.start(await ensure(preset)) })}>{busy === preset.id ? '正在准备…' : '开始新对话'}</button>
          {saved ? <button disabled={!!busy} onClick={() => props.open(saved)}>查看配置</button> : <button disabled={!props.ready || !!busy} onClick={() => void run(preset.id, async () => { await ensure(preset); setMessage(`${preset.name}已添加到「我的创建」。`) })}>添加专家</button>}</footer>
      </article>
    })}</div>
    <p className={css.note}>沿用当前模型，使用有限权限。首次使用会保存专家并绑定现有相关技能；数据连接和可用范围会在实际任务中核验。</p>
  </section>
}
