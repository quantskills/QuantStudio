import { capabilityDisplayName } from '@deepseek-ai/dsh-quantskills-session/display'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type {
  QuantSkillsAgentCreateRequest, QuantSkillsAgentDefinition, QuantSkillsAgentDeleteRequest,
  QuantSkillsAgentSessionArchiveItem, QuantSkillsAgentSessionCreateRequest,
  QuantSkillsAgentSessionCreateResult, QuantSkillsAgentUpdateRequest,
  QuantSkillsAgentTeamCreateRequest, QuantSkillsAgentTeamDefinition, QuantSkillsAgentTeamDeleteRequest,
  QuantSkillsAgentTeamSessionArchiveItem, QuantSkillsAgentTeamSessionCreateRequest,
  QuantSkillsAgentTeamSessionCreateResult, QuantSkillsAgentTeamUpdateRequest,
} from './plugin-types.ts'
import type { QuantSkillsAgentsSnapshot } from './types.ts'

/** Typed user Agent methods contributed by the QuantSkills Host Remote. */
export interface QuantSkillsAgentsPort {
  sources?: () => Promise<NonNullable<QuantSkillsAgentsSnapshot['librarySources']>>
  list: () => Promise<readonly QuantSkillsAgentDefinition[]>
  sessions: () => Promise<readonly QuantSkillsAgentSessionArchiveItem[]>
  create: (request: QuantSkillsAgentCreateRequest) => Promise<QuantSkillsAgentDefinition>
  update: (request: QuantSkillsAgentUpdateRequest) => Promise<QuantSkillsAgentDefinition>
  delete: (request: QuantSkillsAgentDeleteRequest) => Promise<void>
  start: (request: QuantSkillsAgentSessionCreateRequest) => Promise<QuantSkillsAgentSessionCreateResult>
  teamList: () => Promise<readonly QuantSkillsAgentTeamDefinition[]>
  teamSessions: () => Promise<readonly QuantSkillsAgentTeamSessionArchiveItem[]>
  teamCreate: (request: QuantSkillsAgentTeamCreateRequest) => Promise<QuantSkillsAgentTeamDefinition>
  teamUpdate: (request: QuantSkillsAgentTeamUpdateRequest) => Promise<QuantSkillsAgentTeamDefinition>
  teamDelete: (request: QuantSkillsAgentTeamDeleteRequest) => Promise<void>
  teamStart: (request: QuantSkillsAgentTeamSessionCreateRequest) => Promise<QuantSkillsAgentTeamSessionCreateResult>
}

/** Observable controller over durable user Agents and their authoritative Session archives. */
export class QuantSkillsAgentsController {
  /** Current Host projection for framework selector hooks. */
  readonly source: ObservableSnapshot<QuantSkillsAgentsSnapshot>
  private readonly listeners = new Set<() => void>()
  private snapshot: QuantSkillsAgentsSnapshot = {
    phase: 'loading',
    definitions: [],
    archives: [],
    teams: [],
    teamArchives: [],
  }
  private revision = 0

  /**
   * @param host - typed Host Remote adapter.
   */
  constructor(private readonly host: QuantSkillsAgentsPort) {
    this.source = {
      getSnapshot: () => this.snapshot,
      subscribe: listener => this.listen(listener),
    }
  }

  /** Keep successful capability reads even when an unrelated history request fails. */
  async refresh(): Promise<void> {
    const revision = ++this.revision
    const hadProjection = this.snapshot.refreshedAt !== undefined
    const { error: _error, ...current } = this.snapshot
    this.publish({ ...current, phase: hadProjection ? this.snapshot.phase : 'loading' })
    try {
      const [definitions, archives, teams, teamArchives, sources] = await Promise.allSettled([
        Promise.resolve().then(() => this.host.list()),
        Promise.resolve().then(() => this.host.sessions()),
        Promise.resolve().then(() => this.host.teamList()),
        Promise.resolve().then(() => this.host.teamSessions()),
        Promise.resolve().then(() => this.host.sources?.() ?? []),
      ])
      if (revision !== this.revision) return
      const definitionsReady = definitions.status === 'fulfilled' && teams.status === 'fulfilled'
      const errors = [
        definitions.status === 'rejected' ? '无法从宿主读取 QuantSkills 专家，请稍后重试。' : '',
        teams.status === 'rejected' ? '专家团 列表读取失败，请重试。' : '',
        archives.status === 'rejected' ? '专家 会话历史读取失败；已保存能力仍可使用。' : '',
        teamArchives.status === 'rejected' ? 'Team 会话历史读取失败；已保存能力仍可使用。' : '',
        sources.status === 'rejected' ? '来源信息读取失败；未确认内容可在历史内容中查看。' : '',
      ].filter(Boolean)
      this.publish({
        phase: definitionsReady ? 'ready' : hadProjection ? 'stale' : 'error',
        definitionsPhase: definitions.status === 'fulfilled' ? 'ready'
          : this.snapshot.definitionsPhase === 'ready' || this.snapshot.definitionsPhase === 'stale' ? 'stale' : 'error',
        teamsPhase: teams.status === 'fulfilled' ? 'ready'
          : this.snapshot.teamsPhase === 'ready' || this.snapshot.teamsPhase === 'stale' ? 'stale' : 'error',
        definitions: definitions.status === 'fulfilled' ? definitions.value.map(displayAgent) : this.snapshot.definitions,
        archives: archives.status === 'fulfilled' ? archives.value.map(item => ({ ...item, agent: displayAgent(item.agent) })) : this.snapshot.archives,
        teams: teams.status === 'fulfilled' ? teams.value.map(displayTeam) : this.snapshot.teams,
        teamArchives: teamArchives.status === 'fulfilled' ? teamArchives.value.map(item => ({ ...item, team: displayTeam(item.team) })) : this.snapshot.teamArchives,
        librarySources: sources.status === 'fulfilled' ? sources.value : this.snapshot.librarySources ?? [],
        refreshedAt: Date.now(),
        ...(errors.length ? { error: errors.join(' ') } : {}),
      })
    } catch (cause) {
      if (revision !== this.revision) return
      console.error('[quantskills-agents] refresh failed', cause)
      this.publish({
        ...this.snapshot,
        phase: hadProjection ? 'stale' : 'error',
        error: '无法从宿主读取 QuantSkills 专家，请稍后重试。',
      })
    }
  }

  /**
   * Create a durable user Agent and refresh Host truth.
   * @param request - complete editable Agent fields.
   * @returns the committed definition.
   */
  async create(request: QuantSkillsAgentCreateRequest): Promise<QuantSkillsAgentDefinition> {
    const created = await this.host.create(request)
    await this.refresh()
    return created
  }

  /**
   * Update a durable user Agent and refresh Host truth.
   * @param request - complete fields plus optimistic revision.
   * @returns the committed next revision.
   */
  async update(request: QuantSkillsAgentUpdateRequest): Promise<QuantSkillsAgentDefinition> {
    const updated = await this.host.update(request)
    await this.refresh()
    return updated
  }

  /**
   * Delete a durable user Agent and refresh Host truth.
   * @param request - identity and optimistic revision.
   */
  async delete(request: QuantSkillsAgentDeleteRequest): Promise<void> {
    await this.host.delete(request)
    await this.refresh()
  }

  /**
   * Start one immutable Agent Session and refresh its archives.
   * @param request - fresh Session id and exact Agent revision.
   * @returns the Host-created Session result.
   */
  async start(request: QuantSkillsAgentSessionCreateRequest): Promise<QuantSkillsAgentSessionCreateResult> {
    const created = await this.host.start(request)
    await this.refresh()
    return created
  }

  /**
   * Create a durable Agent Team from exact saved Agent revisions.
   * @param request - Team name, goal, Lead revision, and member revisions.
   * @returns the Host-saved Team definition.
   */
  async createTeam(request: QuantSkillsAgentTeamCreateRequest): Promise<QuantSkillsAgentTeamDefinition> {
    const created = await this.host.teamCreate(request)
    await this.refresh()
    return created
  }

  /**
   * Replace a durable Agent Team through optimistic revision matching.
   * @param request - replacement composition and observed Team revision.
   * @returns the updated Host-saved Team definition.
   */
  async updateTeam(request: QuantSkillsAgentTeamUpdateRequest): Promise<QuantSkillsAgentTeamDefinition> {
    const updated = await this.host.teamUpdate(request)
    await this.refresh()
    return updated
  }

  /**
   * Delete a saved Agent Team without deleting its logged Team Sessions.
   * @param request - Team identity and observed revision.
   */
  async deleteTeam(request: QuantSkillsAgentTeamDeleteRequest): Promise<void> {
    await this.host.teamDelete(request)
    await this.refresh()
  }

  /**
   * Start one immutable Team Lead Session and refresh Team archives.
   * @param request - fresh Session identity and exact Team revision.
   * @returns the Host-created Team Session result.
   */
  async startTeam(
    request: QuantSkillsAgentTeamSessionCreateRequest,
  ): Promise<QuantSkillsAgentTeamSessionCreateResult> {
    const created = await this.host.teamStart(request)
    await this.refresh()
    return created
  }

  private publish(snapshot: QuantSkillsAgentsSnapshot): void {
    this.snapshot = snapshot
    for (const listener of this.listeners) listener()
  }

  private listen(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { void this.listeners.delete(listener) }
  }
}

function displayAgent<T extends { name: string; role: string }>(agent: T): T {
  return { ...agent, name: capabilityDisplayName(agent.name, agent.role) }
}
function displayTeam<T extends QuantSkillsAgentTeamDefinition>(team: T): T {
  return { ...team, name: capabilityDisplayName(team.name, team.description), lead: displayAgent(team.lead), members: team.members.map(member => ({ ...member, agent: displayAgent(member.agent) })) }
}
