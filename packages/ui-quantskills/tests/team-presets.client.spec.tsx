// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TeamPresets } from '../src/client/TeamPresets.tsx'
import { TEAM_PRESETS, saveTeamPresets, teamDescription, teamPresetRequest, type TeamPresetAccess } from '../src/client/team-presets.ts'
import { EXPERT_PRESETS, presetRequest } from '../src/client/expert-presets.ts'
import type { QuantSkillsAgentCreateRequest, QuantSkillsAgentDefinition, QuantSkillsAgentTeamDefinition } from '../src/client/plugin-types.ts'

afterEach(cleanup)
const makeExpert = (request: QuantSkillsAgentCreateRequest) => ({ ...request, agentId: `agent-${crypto.randomUUID()}`, revision: 3, skills: [], createdAt: 1, updatedAt: 1 }) as QuantSkillsAgentDefinition
function access(): TeamPresetAccess {
  const definitions: QuantSkillsAgentDefinition[] = [], teams: QuantSkillsAgentTeamDefinition[] = []
  return { definitions, teams, versions: [], createExpert: vi.fn(async request => makeExpert(request)),
    createTeam: vi.fn(async request => ({ ...request, teamId: `agent-team-${crypto.randomUUID()}`, revision: 1,
      lead: definitions.find(item => item.agentId === request.leadAgentId)!, members: request.members.map(member => ({ ...member, agent: definitions.find(item => item.agentId === member.agentId)! })), createdAt: 1, updatedAt: 1 }) as QuantSkillsAgentTeamDefinition),
    savedExpert: expert => definitions.push(expert), savedTeam: team => teams.push(team),
  }
}
describe('practical team presets', () => {
  it('has bounded workflows, separate lead and members, and compatible saved revisions', () => {
    const experts = EXPERT_PRESETS.map(preset => makeExpert(presetRequest(preset, [])))
    expect(TEAM_PRESETS).toHaveLength(9)
    for (const preset of TEAM_PRESETS) {
      const request = teamPresetRequest(preset, experts)
      expect(teamDescription(preset).length).toBeLessThanOrEqual(4000)
      expect(request.leadAgentRevision).toBe(3)
      expect(new Set([request.leadAgentId, ...request.members.map(member => member.agentId)]).size).toBe(request.members.length + 1)
      for (const member of request.members) {
        expect(member.name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        expect(member.agentRevision).toBe(3)
        expect(member.context).toBe('fresh')
        expect(member.model).toEqual({ kind: 'default' })
      }
    }
  })
  it('creates each shared expert only once across all four teams', async () => {
    const api = access(); const saved = await saveTeamPresets(TEAM_PRESETS, api)
    expect(saved).toHaveLength(9); expect(api.createExpert).toHaveBeenCalledTimes(18); expect(api.createTeam).toHaveBeenCalledTimes(9)
    await saveTeamPresets(TEAM_PRESETS, api)
    expect(api.createExpert).toHaveBeenCalledTimes(18); expect(api.createTeam).toHaveBeenCalledTimes(9)
  })
  it('keeps edited team snapshots unchanged', async () => {
    const api = access(); const [saved] = await saveTeamPresets([TEAM_PRESETS[0]!], api)
    const edited = { ...saved!, name: '我的公司研究团', revision: 5 }
    const result = await saveTeamPresets([TEAM_PRESETS[0]!], { ...api, teams: [edited], definitions: [] })
    expect(result[0]).toBe(edited); expect(api.createTeam).toHaveBeenCalledTimes(1)
  })
  it('refuses incompatible permissions without modifying an expert', () => {
    const experts = EXPERT_PRESETS.map(preset => makeExpert(presetRequest(preset, [])))
    const financial = experts.find(item => item.name === '财报解读专家')!
    expect(() => teamPresetRequest(TEAM_PRESETS[0]!, experts.map(item => item === financial ? { ...item, permission: 'read-only' } : item))).toThrow('权限不同')
    expect(financial.permission).toBe('workspace-write')
  })
  it('retains partial success and resumes without duplicate teams', async () => {
    const api = access(), create = api.createTeam; let failed = false
    api.createTeam = vi.fn(async request => { if (request.name === '每日市场研究团' && !failed) { failed = true; throw new Error('暂时失败') }; return create(request) })
    await expect(saveTeamPresets(TEAM_PRESETS, api)).rejects.toThrow('暂时失败')
    expect(api.teams).toHaveLength(1)
    await saveTeamPresets(TEAM_PRESETS, api)
    expect(api.teams).toHaveLength(9); expect(api.createExpert).toHaveBeenCalledTimes(18); expect(api.createTeam).toHaveBeenCalledTimes(10)
  })
  it('starts the saved team and retains it when session startup fails', async () => {
    const api = access(), start = vi.fn().mockRejectedValueOnce(new Error('暂时无法启动')).mockResolvedValue(undefined)
    // The UI receives immutable projections; publish new expert rows only into this fake host store.
    const hostExperts: QuantSkillsAgentDefinition[] = []
    const createExpert = vi.fn(async (request: QuantSkillsAgentCreateRequest) => { const saved = makeExpert(request); hostExperts.push(saved); return saved })
    const createTeam = vi.fn(async request => ({ ...request, teamId: `agent-team-${crypto.randomUUID()}`, revision: 1, lead: hostExperts.find(item => item.agentId === request.leadAgentId)!, members: request.members.map((member: { agentId: string }) => ({ ...member, agent: hostExperts.find(item => item.agentId === member.agentId)! })), createdAt: 1, updatedAt: 1 }) as QuantSkillsAgentTeamDefinition)
    render(<TeamPresets {...api} createExpert={createExpert} createTeam={createTeam} ready start={start} open={vi.fn()}/>)
    const card = within(screen.getByRole('article', { name: '公司深度研究团' }))
    fireEvent.click(card.getByRole('button', { name: '开始团队会话' })); await screen.findByRole('alert')
    fireEvent.click(card.getByRole('button', { name: '开始团队会话' }))
    await waitFor(() => expect(start).toHaveBeenCalledTimes(2))
    expect(createExpert).toHaveBeenCalledTimes(4); expect(createTeam).toHaveBeenCalledTimes(1)
  })
})
