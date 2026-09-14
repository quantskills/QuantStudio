import { describe, expect, it, vi } from 'vitest'
import type {
  QuantSkillsAgentDefinition, QuantSkillsAgentId, QuantSkillsAgentSessionArchiveItem,
  QuantSkillsAgentSessionCreateRequest, QuantSkillsAgentTeamDefinition, QuantSkillsAgentTeamId,
  QuantSkillsAgentTeamSessionArchiveItem, QuantSkillsAgentTeamSessionCreateRequest, QuantSkillsAssetId,
  QuantSkillsCommitSha, QuantSkillsInstalledVersionId, QuantSkillsTreeDigest,
} from '@deepseek-ai/dsh-api-remotes/client'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { QuantSkillsAgentsController, type QuantSkillsAgentsPort } from '../src/client/agents.ts'

const definition: QuantSkillsAgentDefinition = {
  agentId: 'agent-research' as QuantSkillsAgentId,
  revision: 1,
  name: '量化研究助理',
  role: '根据用户目标完成可复现的量化研究。',
  mode: 'dynamic',
  permission: 'workspace-write',
  skills: [{
    assetId: 'skill-five-day-momentum' as QuantSkillsAssetId,
    versionId: 'skill-five-day-momentum@aaaaaaaaaaaa' as QuantSkillsInstalledVersionId,
    commit: 'a'.repeat(40) as QuantSkillsCommitSha,
    treeDigest: 'b'.repeat(64) as QuantSkillsTreeDigest,
  }],
  createdAt: 1,
  updatedAt: 2,
}

const archive: QuantSkillsAgentSessionArchiveItem = {
  sessionId: 'session-agent' as SessionId,
  agent: definition,
  createdAt: 3,
  updatedAt: 4,
  title: '动量研究',
  archived: false,
  running: false,
  runState: 'completed',
}

const team: QuantSkillsAgentTeamDefinition = {
  teamId: 'agent-team-11111111-1111-4111-8111-111111111111' as QuantSkillsAgentTeamId,
  revision: 1,
  name: '量化研究团队',
  description: '由 Lead 协调一个独立验证成员。',
  lead: definition,
  leadModel: { kind: 'default' },
  members: [{
    name: 'validator',
    context: 'fresh',
    agent: { ...definition, agentId: 'agent-validator' as QuantSkillsAgentId },
    model: { kind: 'fixed', selection: { provider: 'deepseek', model: 'deepseek-chat' } },
  }],
  createdAt: 5,
  updatedAt: 6,
}

const teamArchive: QuantSkillsAgentTeamSessionArchiveItem = {
  sessionId: 'session-team' as SessionId,
  team,
  createdAt: 7,
  updatedAt: 8,
  title: '团队研究',
  archived: false,
  running: false,
  runState: 'completed',
}

function host(overrides: Partial<QuantSkillsAgentsPort> = {}): QuantSkillsAgentsPort {
  return {
    list: vi.fn(async () => [definition]),
    sessions: vi.fn(async () => [archive]),
    create: vi.fn(async () => definition),
    update: vi.fn(async () => ({ ...definition, revision: 2 })),
    delete: vi.fn(async () => {}),
    start: vi.fn(async (request: QuantSkillsAgentSessionCreateRequest) => ({
      sessionId: request.sessionId,
      agent: definition,
    })),
    teamList: vi.fn(async () => [team]),
    teamSessions: vi.fn(async () => [teamArchive]),
    teamCreate: vi.fn(async () => team),
    teamUpdate: vi.fn(async () => ({ ...team, revision: 2 })),
    teamDelete: vi.fn(async () => {}),
    teamStart: vi.fn(async (request: QuantSkillsAgentTeamSessionCreateRequest) => ({
      sessionId: request.sessionId,
      team,
    })),
    ...overrides,
  }
}

describe('QuantSkillsAgentsController', () => {
  it('projects only Host definitions and independent 专家 Session archives', async () => {
    const controller = new QuantSkillsAgentsController(host())

    await controller.refresh()

    expect(controller.source.getSnapshot()).toMatchObject({
      phase: 'ready',
      definitions: [definition],
      archives: [archive],
      teams: [team],
      teamArchives: [teamArchive],
    })
  })

  it('refreshes Host truth after every mutation', async () => {
    const port = host()
    const controller = new QuantSkillsAgentsController(port)
    const fields = {
      name: definition.name,
      role: definition.role,
      mode: definition.mode,
      versionIds: definition.skills.map(skill => skill.versionId),
    }

    await controller.create(fields)
    await controller.update({ ...fields, agentId: definition.agentId, expectedRevision: 1 })
    await controller.start({
      sessionId: archive.sessionId,
      agentId: definition.agentId,
      expectedRevision: 2,
    })
    await controller.delete({ agentId: definition.agentId, expectedRevision: 2 })
    const teamFields = {
      name: team.name,
      description: team.description,
      leadAgentId: team.lead.agentId,
      leadAgentRevision: team.lead.revision,
      leadModel: team.leadModel,
      members: team.members.map(member => ({
        name: member.name,
        context: member.context,
        agentId: member.agent.agentId,
        agentRevision: member.agent.revision,
        model: member.model,
      })),
    }
    await controller.createTeam(teamFields)
    await controller.updateTeam({ ...teamFields, teamId: team.teamId, expectedRevision: 1 })
    await controller.startTeam({
      sessionId: teamArchive.sessionId,
      teamId: team.teamId,
      expectedRevision: 2,
    })
    await controller.deleteTeam({ teamId: team.teamId, expectedRevision: 2 })

    expect(port.create).toHaveBeenCalledWith(fields)
    expect(port.update).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 1 }))
    expect(port.start).toHaveBeenCalledWith(expect.objectContaining({ sessionId: archive.sessionId }))
    expect(port.delete).toHaveBeenCalledWith({ agentId: definition.agentId, expectedRevision: 2 })
    expect(port.teamCreate).toHaveBeenCalledWith(teamFields)
    expect(port.teamUpdate).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 1 }))
    expect(port.teamStart).toHaveBeenCalledWith(expect.objectContaining({ sessionId: teamArchive.sessionId }))
    expect(port.teamDelete).toHaveBeenCalledWith({ teamId: team.teamId, expectedRevision: 2 })
    expect(port.list).toHaveBeenCalledTimes(8)
    expect(port.sessions).toHaveBeenCalledTimes(8)
    expect(port.teamList).toHaveBeenCalledTimes(8)
    expect(port.teamSessions).toHaveBeenCalledTimes(8)
  })

  it('keeps the previous Host projection as stale when refresh fails', async () => {
    const list = vi.fn<QuantSkillsAgentsPort['list']>()
      .mockResolvedValueOnce([definition])
      .mockRejectedValueOnce(new Error('transport detail'))
    const controller = new QuantSkillsAgentsController(host({ list }))

    await controller.refresh()
    await controller.refresh()

    expect(controller.source.getSnapshot()).toMatchObject({
      phase: 'stale',
      definitions: [definition],
      archives: [archive],
      error: '无法从宿主读取 QuantSkills 专家，请稍后重试。',
    })
  })
})
