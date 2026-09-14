import { StarIcon } from '@phosphor-icons/react'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { QuantSkillsViewState } from './store.ts'
import type { QuantSkillsAgentsSnapshot, QuantSkillsSessionsSnapshot } from './types.ts'
import css from './QuantSkillsApp.module.css'

export interface SessionFavoriteInjected {
  hooks: { sessions: ObservableSnapshot<SessionListState>; view: ObservableSnapshot<QuantSkillsViewState>; agents: ObservableSnapshot<QuantSkillsAgentsSnapshot>; skills: ObservableSnapshot<QuantSkillsSessionsSnapshot> }
  toggle: (ids: string[]) => void
}

/** Favorite the owning capability, so every future session can reuse it. */
export function SessionFavorite({ useSessions, useView, useAgents, useSkills, toggle }: InjectFace<SessionFavoriteInjected>) {
  const current = useSessions(state => state.current)
  const agent = useAgents(state => state.archives.find(item => item.sessionId === current)?.agent)
  const team = useAgents(state => state.teamArchives.find(item => item.sessionId === current)?.team)
  const skill = useSkills(state => state.archives.find(item => item.sessionId === current)?.binding)
  const favorites = useView(state => state.favoriteAssetIds)
  const writable = useView(state => state.settingsWritable)
  const internal = useAgents(state => state.librarySources?.some(item => item.id === agent?.agentId && item.source === 'internal'))
  const id = team ? `team:${team.teamId}` : agent && !internal ? `agent:${agent.agentId}` : skill?.assetId
  if (!id) return null
  const active = favorites.includes(id)
  return <button type="button" className={css.reviewTrigger} aria-label={active ? '取消收藏当前能力' : '收藏当前能力'} aria-pressed={active} disabled={!writable}
    title="收藏后，可在收藏栏继续对话或开始新任务" onClick={() => toggle(active ? favorites.filter(item => item !== id) : [...favorites, id])}>
    <StarIcon weight={active ? 'fill' : 'regular'}/>{active ? '已收藏' : '收藏'}
  </button>
}
