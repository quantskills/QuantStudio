/** Shared Team task DAG commands and runtime-enriched views. */
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { TeamMembership } from './roster.ts';
import type { TeamJournal } from './journal.ts';
import { TeamTaskId } from './types.ts';
import type { CreateTeamTaskRequest, TeamTaskView, UpdateTeamTaskRequest } from './types.ts';
/** Owns Team task limits, authorization, transitions, and derived views. */
export declare class TeamTaskBoard {
    private readonly journal;
    private readonly maxTasks;
    /**
     * @param journal - authoritative Lead-log transaction owner.
     * @param maxTasks - maximum non-deleted tasks retained by one Team.
     */
    constructor(journal: TeamJournal, maxTasks: number);
    /**
     * Create one unowned pending task in the Team Lead log.
     * @param membership - exact caller membership resolved by the Team roster.
     * @param request - task text, blockers, and advisory write scopes.
     * @returns the revision-one task view.
     */
    create(membership: TeamMembership, request: CreateTeamTaskRequest): Promise<TeamTaskView>;
    /**
     * Return one task, including a deleted tombstone.
     * @param membership - exact caller membership resolved by the Team roster.
     * @param id - Team-local task identity.
     * @returns the latest task value and derived readiness diagnostics.
     */
    get(membership: TeamMembership, id: TeamTaskId): TeamTaskView;
    /**
     * List current non-deleted tasks in numeric creation order.
     * @param membership - exact caller membership resolved by the Team roster.
     * @returns detached current task views.
     */
    list(membership: TeamMembership): TeamTaskView[];
    /**
     * Compare-and-set one authorized task transition.
     * @param caller - exact live Team member authorizing the mutation.
     * @param membership - caller role and exact live Lead.
     * @param request - task identity, expected revision, action, and action fields.
     * @returns the committed next task revision.
     */
    update(caller: Agent, membership: TeamMembership, request: UpdateTeamTaskRequest): Promise<TeamTaskView>;
    /** Validate and de-duplicate dependency ids against the current task graph. */
    private dependencies;
    /** Normalize and de-duplicate task write scopes. */
    private writeScopes;
    /** Map shared task-graph validation onto stable command error codes. */
    private assertTaskGraph;
    /** Whether all current blockers completed. */
    private taskReady;
    /** Remove an optional owner field under exactOptionalPropertyTypes. */
    private withoutOwner;
    /**
     * Build one task view with owner name, readiness, and advisory write overlaps.
     * A committing caller may pass its pre-append fold because `task` supplies the
     * new value explicitly; owner names, blocker readiness, and other task scopes
     * do not change when that snapshot is appended.
     */
    private taskView;
}
//# sourceMappingURL=task-board.d.ts.map