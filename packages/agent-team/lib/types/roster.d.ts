/** Team membership, continuable-child provisioning, and roster-owned teardown. */
import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { SessionId } from '@deepseek-ai/dsh-session';
import type { TeamFoldState } from './fold.ts';
import type { TeamJournal } from './journal.ts';
import type { TeamRuntimeLifecycle } from './lifecycle.ts';
import { TeamId } from './types.ts';
import type { SpawnTeammateRequest, SpawnTeammateResult, TeamMemberView } from './types.ts';
/** Caller identity inside one implicit Team. */
export interface TeamMembership {
    readonly root: Agent;
    readonly id: TeamId;
    readonly role: 'lead' | 'teammate';
    readonly name: string;
}
/**
 * Resolve one active Team member by model-facing name, including the Lead pseudo-row.
 * @param root - exact live Team Lead.
 * @param state - current Team fold.
 * @param rawName - candidate member name.
 * @returns resolved durable id and normalized name.
 */
export declare function resolveActiveMember(root: Agent, state: TeamFoldState, rawName: string): {
    id: SessionId;
    name: string;
};
/** Owns Team identities and the lifecycle of rostered continuable children. */
export declare class TeamRoster {
    private readonly ctx;
    private readonly journal;
    private readonly lifecycle;
    private readonly maxMembers;
    private readonly inFlightCreations;
    /**
     * @param ctx - Team service context with Agent, Session, persistence, and subagent services.
     * @param journal - authoritative Lead-log transaction owner.
     * @param lifecycle - shared Team runtime admission cutoff.
     * @param maxMembers - maximum immutable roster entries per Team.
     */
    constructor(ctx: Context, journal: TeamJournal, lifecycle: TeamRuntimeLifecycle, maxMembers: number);
    /**
     * Resolve one exact live Agent's Team role.
     * @param agent - exact live Agent used as the authority credential.
     * @returns its root, Team identity, role, and model-facing name.
     */
    membership(agent: Agent): TeamMembership;
    /**
     * Resolve a caller without throwing for scoped installation and lifecycle observers.
     * @param agent - candidate exact live Agent.
     * @returns Team membership, or undefined for non-Team subagents and stale identities.
     */
    tryMembership(agent: Agent): TeamMembership | undefined;
    /**
     * List the runtime-enriched roster visible to one Team member.
     * @param membership - exact caller membership resolved by this roster.
     * @returns Lead and teammate rows in creation order.
     */
    list(membership: TeamMembership): TeamMemberView[];
    /**
     * Create one named, continuable direct child of the Team Lead.
     * @param caller - exact live Lead Agent.
     * @param request - immutable name, description, prompt, context mode, provider, and cancellation.
     * @returns the active roster row.
     */
    spawn(caller: Agent, request: SpawnTeammateRequest): Promise<SpawnTeammateResult>;
    /**
     * Return admitted creation operations captured for ordered disposal.
     * @returns detached snapshot ordered only by Set insertion.
     */
    pendingCreations(): readonly Promise<unknown>[];
    /**
     * Reconcile provisioning state when one Team member Session starts.
     * @param agent - newly started exact live Agent.
     * @param signal - shared runtime cancellation.
     */
    recoverFor(agent: Agent, signal: AbortSignal): Promise<void>;
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
     * Group exact live roster children by their current Lead for runtime teardown.
     * @returns each live Lead and the roster child ids currently in the Agent registry.
     */
    liveChildrenByRoot(): Map<Agent, SessionId[]>;
    /**
     * Release exact teammate Activations through the continuation lifecycle owner.
     * @param root - exact live Team Lead authorizing release.
     * @param childIds - selected roster child ids.
     */
    stopTeammates(root: Agent, childIds: readonly SessionId[]): Promise<void>;
    /** Perform one creation admitted before the Team runtime disposal cutoff. */
    private spawnAdmitted;
    /** Flush the accepted initial inbox item before the Lead can commit `active`. */
    private checkpointInitialPrompt;
    /** Settle provisioning-only members from their independently durable child Sessions. */
    private reconcileProvisioning;
    /** Build one runtime member row after successful creation. */
    private memberView;
    /** Validate a never-reused model-facing teammate name. */
    private memberName;
    /** Append one terminal provisioning edge unless recovery already settled it. */
    private settleProvisioning;
    /** Whether a Session's own suffix identifies a provider-owned subagent child. */
    private subagentDescriptor;
}
//# sourceMappingURL=roster.d.ts.map