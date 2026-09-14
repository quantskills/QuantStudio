/** Agent Teams service façade over roster, mailbox, task, and runtime lifecycle owners. */
import { Context, Service } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { TeamMembership } from './roster.ts';
import { TeamTaskId } from './types.ts';
import type { Config, CreateTeamTaskRequest, SendTeamMessageRequest, SendTeamMessageResult, SpawnTeammateRequest, SpawnTeammateResult, TeamMemberView, TeamTaskView, TeamWaitResult, UpdateTeamTaskRequest } from './types.ts';
export type * from './types.ts';
export type { TeamMembership } from './roster.ts';
export { TeamId, TeamMessageId, TeamTaskId } from './types.ts';
export { TeamError } from './error.ts';
export { foldTeam } from './fold.ts';
declare module '@deepseek-ai/cordis' {
    interface Context {
        agentTeams: TeamService;
    }
}
/** Agent Teams service backed by the exact live Lead Session log. */
export declare class TeamService extends Service {
    static inject: string[];
    static Config: z<Config>;
    /** Validated deployment limits used by every Team operation. */
    private readonly config;
    private readonly activity;
    private readonly lifecycle;
    private readonly journal;
    private readonly roster;
    private readonly mailbox;
    private readonly tasks;
    constructor(ctx: Context, config?: Config);
    /**
     * Resolve one exact live Agent's Team role.
     * @param agent - exact live Agent used as the authority credential.
     * @returns its root, Team identity, role, and model-facing name.
     */
    membership(agent: Agent): TeamMembership;
    /**
     * List the runtime-enriched roster visible to one Team member.
     * @param agent - exact live Team member.
     * @returns Lead and teammate rows in creation order.
     */
    listMembers(agent: Agent): TeamMemberView[];
    /**
     * Create one named, continuable direct child of the Team Lead.
     * @param caller - exact live Lead Agent.
     * @param request - immutable name, description, prompt, context mode, provider, and cancellation.
     * @returns the active roster row.
     */
    spawnTeammate(caller: Agent, request: SpawnTeammateRequest): Promise<SpawnTeammateResult>;
    /**
     * Queue one durable peer message, then attempt immediate delivery.
     * @param caller - exact live sending Team member.
     * @param request - target name, content, scheduling mode, and pre-queue cancellation.
     * @returns durable message identity and immediate-delivery observation.
     */
    sendMessage(caller: Agent, request: SendTeamMessageRequest): Promise<SendTeamMessageResult>;
    /**
     * Create one unowned pending task in the Team Lead log.
     * @param caller - exact live Team member creating the task.
     * @param request - task text, blockers, and advisory write scopes.
     * @returns the revision-one task view.
     */
    createTask(caller: Agent, request: CreateTeamTaskRequest): Promise<TeamTaskView>;
    /**
     * Return one task, including a deleted tombstone.
     * @param caller - exact live Team member reading the task.
     * @param id - Team-local task identity.
     * @returns the latest task value and derived readiness diagnostics.
     */
    getTask(caller: Agent, id: TeamTaskId): TeamTaskView;
    /**
     * List current non-deleted tasks in numeric creation order.
     * @param caller - exact live Team member reading the board.
     * @returns detached current task views.
     */
    listTasks(caller: Agent): TeamTaskView[];
    /**
     * Compare-and-set one authorized task transition.
     * @param caller - exact live Team member authorizing the mutation.
     * @param request - task identity, expected revision, action, and action fields.
     * @returns the committed next task revision.
     */
    updateTask(caller: Agent, request: UpdateTeamTaskRequest): Promise<TeamTaskView>;
    /**
     * Wait for the next Team-domain or member-status change.
     * @param caller - exact live Team member waiting for activity.
     * @param timeoutMs - bounded wait duration from ten seconds through one hour.
     * @param signal - caller cancellation for the wait only.
     * @returns one observed change or a timeout result.
     */
    waitForChange(caller: Agent, timeoutMs: number, signal: AbortSignal): Promise<TeamWaitResult>;
    /**
     * Interrupt one live teammate turn without clearing its pending inbox.
     * @param caller - exact live Lead Agent.
     * @param targetName - durable teammate name.
     * @returns the target status sampled before cancellation.
     */
    interrupt(caller: Agent, targetName: string): {
        previousStatus: 'running' | 'idle' | 'inactive';
    };
    /**
     * Resolve a caller without throwing, used by scoped-tool installation and observers.
     * @param agent - candidate exact live Agent.
     * @returns Team membership, or undefined for non-Team subagents and stale identities.
     */
    tryMembership(agent: Agent): TeamMembership | undefined;
    /** Queue one contained recovery pass after publication has unwound. */
    private scheduleRecovery;
    /** Reconcile roster provisioning before retrying that member's pending mailbox. */
    private recoverFor;
    /** Stop Team-owned live branches and release every waiter before service disposal completes. */
    private disposeRuntime;
}
export default TeamService;
//# sourceMappingURL=index.d.ts.map