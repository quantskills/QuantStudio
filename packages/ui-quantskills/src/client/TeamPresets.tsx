import { useRef, useState, type ReactNode } from 'react'
import { TEAM_PRESETS, expertPresetById, findPresetTeam, saveTeamPresets, type TeamPreset, type TeamPresetAccess } from './team-presets.ts'
import type { QuantSkillsAgentDefinition, QuantSkillsAgentTeamDefinition } from './plugin-types.ts'
import css from './ExpertPresets.module.css'
import { PRESET_GROUPS } from './expert-presets.ts'

export interface TeamPresetsProps extends Omit<TeamPresetAccess, 'savedExpert' | 'savedTeam'> {
  ready: boolean
  icon?: ReactNode
  start(team: QuantSkillsAgentTeamDefinition): Promise<unknown>
  open(team: QuantSkillsAgentTeamDefinition): void
}

export function TeamPresets(props: TeamPresetsProps) {
  const [group, setGroup] = useState<'all' | TeamPreset['group']>('all')
  const [experts, setExperts] = useState<QuantSkillsAgentDefinition[]>([])
  const [created, setCreated] = useState<QuantSkillsAgentTeamDefinition[]>([])
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('')
  const locked = useRef(false)
  const teams = [...props.teams, ...created]
  const count = TEAM_PRESETS.filter(preset => findPresetTeam(preset, teams)).length
  const ensure = (presets: readonly TeamPreset[]) => saveTeamPresets(presets, { ...props, definitions: [...props.definitions, ...experts], teams,
    savedExpert: expert => setExperts(current => [...current, expert]), savedTeam: team => setCreated(current => [...current, team]),
  })
  const run = async (id: string, task: () => Promise<void>) => {
    if (locked.current || !props.ready) return
    locked.current = true; setBusy(id); setError(''); setMessage('')
    try { await task() } catch (cause) { setError(`${cause instanceof Error ? cause.message : '保存失败，请重试。'} 已保存的专家和专家团会保留。`) }
    finally { locked.current = false; setBusy('') }
  }
  return <section className={css.library} aria-label="推荐专家团库">
    <header className={css.header}><div><h2>分工明确，一起完成工作</h2><p>覆盖投资研究、量化研究和日常办公，按任务安排协作顺序。保存后可在「我的创建」调整成员、模型和流程。</p></div>
      <button disabled={!props.ready || !!busy || count === TEAM_PRESETS.length} onClick={() => void run('all', async () => { await ensure(TEAM_PRESETS); setMessage(`${TEAM_PRESETS.length} 个专家团已保存，可以开始团队会话。`) })}>{busy === 'all' ? '正在添加…' : count === TEAM_PRESETS.length ? '已全部添加' : '添加全部专家团'}</button>
    </header>
    <div className={css.filters} aria-label="专家团用途">{(['all', ...Object.keys(PRESET_GROUPS)] as (typeof group)[]).map(id => <button key={id} aria-pressed={group === id} onClick={() => setGroup(id)}>{id === 'all' ? '全部' : PRESET_GROUPS[id]} {TEAM_PRESETS.filter(item => id === 'all' || item.group === id).length}</button>)}<span>已添加 {count} / {TEAM_PRESETS.length}</span></div>
    {error && <p className={css.error} role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <div className={`${css.grid} ${css.teamGrid}`}>{TEAM_PRESETS.filter(preset => group === 'all' || preset.group === group).map(preset => {
      const saved = findPresetTeam(preset, teams)
      return <article key={preset.id} data-group={preset.group} aria-label={preset.name}>
        <div className={css.title}>{props.icon}<div><small>{PRESET_GROUPS[preset.group]} · {preset.members.length + 1} 位专家协作</small><h3>{preset.name}</h3></div></div>
        <p className={css.summary}>{preset.summary}</p>
        <div className={css.roster}><b>负责人 · {expertPresetById(preset.lead).name}</b>{preset.members.map(member => <span key={member.expert}>{expertPresetById(member.expert).name}</span>)}</div>
        <blockquote><small>试试这样问</small>{preset.example}</blockquote>
        <details className={css.teamSteps}><summary>查看分工与流程</summary><ol>{preset.stages.map(stage => <li key={stage}>{stage}</li>)}</ol>{preset.members.map(member => <p key={member.expert}><b>{expertPresetById(member.expert).name}：</b>{member.responsibility}</p>)}</details>
        <p className={css.output}><b>交付</b>{preset.output}</p>
        <small className={css.status}>{saved ? '已保存 · 成员与技能版本已固定' : '自动复用已有专家，缺少的预设专家会一并添加'}</small>
        <footer><button className={css.primary} disabled={!props.ready || !!busy} onClick={() => void run(preset.id, async () => { const [team] = await ensure([preset]); if (team) await props.start(team) })}>{busy === preset.id ? '正在准备…' : '开始团队会话'}</button>
          {saved ? <button disabled={!!busy} onClick={() => props.open(saved)}>查看配置</button> : <button disabled={!props.ready || !!busy} onClick={() => void run(preset.id, async () => { await ensure([preset]); setMessage(`${preset.name}已添加到「我的创建」。`) })}>添加专家团</button>}</footer>
      </article>
    })}</div>
    <p className={css.note}>每次按你的具体任务协作；每日市场研究团不会自动创建定时安排。成员默认使用独立上下文和会话默认模型。</p>
  </section>
}
