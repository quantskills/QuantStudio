import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store';
import type { QuantSkillsAgentCreateRequest, QuantSkillsAgentDefinition, QuantSkillsAgentDeleteRequest, QuantSkillsAgentSessionArchiveItem, QuantSkillsAgentSessionCreateRequest, QuantSkillsAgentSessionCreateResult, QuantSkillsAgentUpdateRequest, QuantSkillsAgentTeamCreateRequest, QuantSkillsAgentTeamDefinition, QuantSkillsAgentTeamDeleteRequest, QuantSkillsAgentTeamSessionArchiveItem, QuantSkillsAgentTeamSessionCreateRequest, QuantSkillsAgentTeamSessionCreateResult, QuantSkillsAgentTeamUpdateRequest } from './plugin-types.ts';
import type { QuantSkillsAgentsSnapshot } from './types.ts';
/** Typed user Agent methods contributed by the QuantSkills Host Remote. */
export interface QuantSkillsAgentsPort {
    sources?: () => Promise<NonNullable<QuantSkillsAgentsSnapshot['librarySources']>>;
    list: () => Promise<readonly QuantSkillsAgentDefinition[]>;
    sessions: () => Promise<readonly QuantSkillsAgentSessionArchiveItem[]>;
    create: (request: QuantSkillsAgentCreateRequest) => Promise<QuantSkillsAgentDefinition>;
    update: (request: QuantSkillsAgentUpdateRequest) => Promise<QuantSkillsAgentDefinition>;
    delete: (request: QuantSkillsAgentDeleteRequest) => Promise<void>;
    start: (request: QuantSkillsAgentSessionCreateRequest) => Promise<QuantSkillsAgentSessionCreateResult>;
    teamList: () => Promise<readonly QuantSkillsAgentTeamDefinition[]>;
    teamSessions: () => Promise<readonly QuantSkillsAgentTeamSessionArchiveItem[]>;
    teamCreate: (request: QuantSkillsAgentTeamCreateRequest) => Promise<QuantSkillsAgentTeamDefinition>;
    teamUpdate: (request: QuantSkillsAgentTeamUpdateRequest) => Promise<QuantSkillsAgentTeamDefinition>;
    teamDelete: (request: QuantSkillsAgentTeamDeleteRequest) => Promise<void>;
    teamStart: (request: QuantSkillsAgentTeamSessionCreateRequest) => Promise<QuantSkillsAgentTeamSessionCreateResult>;
}
/** Observable controller over durable user Agents and their authoritative Session archives. */
export declare class QuantSkillsAgentsController {
    private readonly host;
    /** Current Host projection for framework selector hooks. */
    readonly source: ObservableSnapshot<QuantSkillsAgentsSnapshot>;
    private readonly listeners;
    private snapshot;
    private revision;
    /**
     * @param host - typed Host Remote adapter.
     */
    constructor(host: QuantSkillsAgentsPort);
    /** Keep successful capability reads even when an unrelated history request fails. */
    refresh(): Promise<void>;
    /**
     * Create a durable user Agent and refresh Host truth.
     * @param request - complete editable Agent fields.
     * @returns the committed definition.
     */
    create(request: QuantSkillsAgentCreateRequest): Promise<QuantSkillsAgentDefinition>;
    /**
     * Update a durable user Agent and refresh Host truth.
     * @param request - complete fields plus optimistic revision.
     * @returns the committed next revision.
     */
    update(request: QuantSkillsAgentUpdateRequest): Promise<QuantSkillsAgentDefinition>;
    /**
     * Delete a durable user Agent and refresh Host truth.
     * @param request - identity and optimistic revision.
     */
    delete(request: QuantSkillsAgentDeleteRequest): Promise<void>;
    /**
     * Start one immutable Agent Session and refresh its archives.
     * @param request - fresh Session id and exact Agent revision.
     * @returns the Host-created Session result.
     */
    start(request: QuantSkillsAgentSessionCreateRequest): Promise<QuantSkillsAgentSessionCreateResult>;
    /**
     * Create a durable Agent Team from exact saved Agent revisions.
     * @param request - Team name, goal, Lead revision, and member revisions.
     * @returns the Host-saved Team definition.
     */
    createTeam(request: QuantSkillsAgentTeamCreateRequest): Promise<QuantSkillsAgentTeamDefinition>;
    /**
     * Replace a durable Agent Team through optimistic revision matching.
     * @param request - replacement composition and observed Team revision.
     * @returns the updated Host-saved Team definition.
     */
    updateTeam(request: QuantSkillsAgentTeamUpdateRequest): Promise<QuantSkillsAgentTeamDefinition>;
    /**
     * Delete a saved Agent Team without deleting its logged Team Sessions.
     * @param request - Team identity and observed revision.
     */
    deleteTeam(request: QuantSkillsAgentTeamDeleteRequest): Promise<void>;
    /**
     * Start one immutable Team Lead Session and refresh Team archives.
     * @param request - fresh Session identity and exact Team revision.
     * @returns the Host-created Team Session result.
     */
    startTeam(request: QuantSkillsAgentTeamSessionCreateRequest): Promise<QuantSkillsAgentTeamSessionCreateResult>;
    private publish;
    private listen;
}
//# sourceMappingURL=agents.d.ts.map