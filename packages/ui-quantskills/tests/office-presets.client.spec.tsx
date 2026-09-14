// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ExpertPresets } from '../src/client/ExpertPresets.tsx'
import { TeamPresets } from '../src/client/TeamPresets.tsx'
import { OFFICE_EXPERT_PRESETS, OFFICE_TEAM_PRESETS } from '../src/client/office-presets.ts'
import { expertRole, presetRequest } from '../src/client/expert-presets.ts'
import { saveTeamPresets, teamDescription } from '../src/client/team-presets.ts'
import type { QuantSkillsAgentDefinition, QuantSkillsAgentTeamDefinition } from '../src/client/plugin-types.ts'
afterEach(cleanup)
it('shows all ten office experts without requiring investment skills', () => {
  render(<ExpertPresets ready definitions={[]} versions={[]} create={vi.fn()} start={vi.fn()} open={vi.fn()}/>)
  fireEvent.click(screen.getByRole('button', { name: '日常办公 10' }))
  expect(screen.getAllByRole('article')).toHaveLength(10)
  for (const preset of OFFICE_EXPERT_PRESETS) {
    expect(screen.getByRole('article', { name: preset.name })).toBeTruthy()
    expect(presetRequest(preset, []).versionIds).toEqual([])
    expect(expertRole(preset)).not.toContain('quantskills_data_catalog')
    expect(expertRole(preset)).toContain('可点击 Markdown 相对路径链接')
  }
})
it('filters all five office teams and preserves task-specific instructions', () => {
  render(<TeamPresets ready definitions={[]} teams={[]} versions={[]} createExpert={vi.fn()} createTeam={vi.fn()} start={vi.fn()} open={vi.fn()}/>)
  fireEvent.click(screen.getByRole('button', { name: '日常办公 5' }))
  expect(screen.getAllByRole('article')).toHaveLength(5)
  for (const preset of OFFICE_TEAM_PRESETS) {
    expect(screen.getByRole('article', { name: preset.name })).toBeTruthy()
    expect(teamDescription(preset)).not.toContain('财报公告时点')
    expect(teamDescription(preset)).toContain('依赖满足后再派发下一步')
  }
})
it('saves five real team requests with shared office experts only once and retries idempotently', async () => {
  const definitions: QuantSkillsAgentDefinition[] = [], teams: QuantSkillsAgentTeamDefinition[] = []
  const access = { definitions, teams, versions: [],
    createExpert: vi.fn(async request => ({ ...request, agentId: `a-${definitions.length}`, revision: 1, skills: [] }) as QuantSkillsAgentDefinition),
    createTeam: vi.fn(async request => ({ ...request, teamId: `t-${teams.length}`, revision: 1 }) as QuantSkillsAgentTeamDefinition),
    savedExpert: (expert: QuantSkillsAgentDefinition) => { definitions.push(expert) },
    savedTeam: (team: QuantSkillsAgentTeamDefinition) => { teams.push(team) },
  }
  await saveTeamPresets(OFFICE_TEAM_PRESETS, access)
  await saveTeamPresets(OFFICE_TEAM_PRESETS, access)
  expect(access.createExpert).toHaveBeenCalledTimes(8)
  expect(access.createTeam).toHaveBeenCalledTimes(5)
  for (const [request] of access.createTeam.mock.calls) {
    const ids = [request.leadAgentId, ...request.members.map(member => member.agentId)]
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every(id => definitions.some(expert => expert.agentId === id))).toBe(true)
  }
})
