/** Agent Teams service façade over roster, mailbox, task, and runtime lifecycle owners. */
import { Service } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { TeamActivity } from "./activity.js";
import { errorMessage, TeamError } from "./error.js";
import { TeamJournal } from "./journal.js";
import { TeamRuntimeLifecycle } from "./lifecycle.js";
import { TeamMailbox } from "./mailbox.js";
import { TeamRoster } from "./roster.js";
import { TeamTaskBoard } from "./task-board.js";
import { TeamId } from "./types.js";
export { TeamId, TeamMessageId, TeamTaskId } from "./types.js";
export { TeamError } from "./error.js";
export { foldTeam } from "./fold.js";
const DEFAULT_MAX_MEMBERS = 8;
const DEFAULT_MAX_TASKS = 256;
const DEFAULT_MAX_PENDING_MESSAGES = 64;
const DEFAULT_MAX_MESSAGE_BYTES = 65_536;
const DEFAULT_DISPOSAL_TIMEOUT_MS = 5_000;
/** Validate one positive safe-integer deployment limit. */
function positiveLimit(name, value) {
    if (!Number.isSafeInteger(value) || value < 1) {
        throw new TeamError(`${name} must be a positive safe integer`, 'TEAM_INVALID_CONFIG');
    }
    return value;
}
/** Agent Teams service backed by the exact live Lead Session log. */
export class TeamService extends Service {
    static inject = ['agents', 'sessions', 'sessionPersistence', 'subagents'];
    static Config = z.object({
        maxMembers: z.number().step(1).min(1).default(DEFAULT_MAX_MEMBERS),
        maxTasks: z.number().step(1).min(1).default(DEFAULT_MAX_TASKS),
        maxPendingMessagesPerMember: z.number().step(1).min(1).default(DEFAULT_MAX_PENDING_MESSAGES),
        maxMessageBytes: z.number().step(1).min(1).default(DEFAULT_MAX_MESSAGE_BYTES),
        disposalTimeoutMs: z.number().step(1).min(1).default(DEFAULT_DISPOSAL_TIMEOUT_MS),
    });
    /** Validated deployment limits used by every Team operation. */
    config;
    activity;
    lifecycle;
    journal;
    roster;
    mailbox;
    tasks;
    constructor(ctx, config = {}) {
        super(ctx, 'agentTeams');
        this.config = {
            maxMembers: positiveLimit('maxMembers', config.maxMembers ?? DEFAULT_MAX_MEMBERS),
            maxTasks: positiveLimit('maxTasks', config.maxTasks ?? DEFAULT_MAX_TASKS),
            maxPendingMessagesPerMember: positiveLimit('maxPendingMessagesPerMember', config.maxPendingMessagesPerMember ?? DEFAULT_MAX_PENDING_MESSAGES),
            maxMessageBytes: positiveLimit('maxMessageBytes', config.maxMessageBytes ?? DEFAULT_MAX_MESSAGE_BYTES),
            disposalTimeoutMs: positiveLimit('disposalTimeoutMs', config.disposalTimeoutMs ?? DEFAULT_DISPOSAL_TIMEOUT_MS),
        };
        this.activity = new TeamActivity();
        this.lifecycle = new TeamRuntimeLifecycle(this.config.disposalTimeoutMs);
        this.journal = new TeamJournal(ctx, (root) => { this.activity.notify(TeamId(root.id)); });
        this.roster = new TeamRoster(ctx, this.journal, this.lifecycle, this.config.maxMembers);
        this.mailbox = new TeamMailbox(ctx, this.journal, this.roster, this.lifecycle, this.config.maxPendingMessagesPerMember, this.config.maxMessageBytes);
        this.tasks = new TeamTaskBoard(this.journal, this.config.maxTasks);
        ctx.on('session/event', (session, event) => { this.mailbox.observeSessionEvent(session, event); });
        ctx.on('agent/session-start', ({ agent }) => { this.scheduleRecovery(agent); });
        ctx.on('agent/status', ({ agent }) => {
            const membership = this.roster.tryMembership(agent);
            if (membership !== undefined)
                this.activity.notify(membership.id);
        });
        ctx.effect(() => () => this.disposeRuntime(), 'agentTeams.runtimeLifecycle()');
        for (const agent of ctx.agents.list())
            this.scheduleRecovery(agent);
    }
    /**
     * Resolve one exact live Agent's Team role.
     * @param agent - exact live Agent used as the authority credential.
     * @returns its root, Team identity, role, and model-facing name.
     */
    membership(agent) {
        return this.roster.membership(agent);
    }
    /**
     * List the runtime-enriched roster visible to one Team member.
     * @param agent - exact live Team member.
     * @returns Lead and teammate rows in creation order.
     */
    listMembers(agent) {
        return this.roster.list(this.roster.membership(agent));
    }
    /**
     * Create one named, continuable direct child of the Team Lead.
     * @param caller - exact live Lead Agent.
     * @param request - immutable name, description, prompt, context mode, provider, and cancellation.
     * @returns the active roster row.
     */
    async spawnTeammate(caller, request) {
        return await this.roster.spawn(caller, request);
    }
    /**
     * Queue one durable peer message, then attempt immediate delivery.
     * @param caller - exact live sending Team member.
     * @param request - target name, content, scheduling mode, and pre-queue cancellation.
     * @returns durable message identity and immediate-delivery observation.
     */
    async sendMessage(caller, request) {
        return await this.mailbox.send(caller, request);
    }
    /**
     * Create one unowned pending task in the Team Lead log.
     * @param caller - exact live Team member creating the task.
     * @param request - task text, blockers, and advisory write scopes.
     * @returns the revision-one task view.
     */
    async createTask(caller, request) {
        return await this.tasks.create(this.roster.membership(caller), request);
    }
    /**
     * Return one task, including a deleted tombstone.
     * @param caller - exact live Team member reading the task.
     * @param id - Team-local task identity.
     * @returns the latest task value and derived readiness diagnostics.
     */
    getTask(caller, id) {
        return this.tasks.get(this.roster.membership(caller), id);
    }
    /**
     * List current non-deleted tasks in numeric creation order.
     * @param caller - exact live Team member reading the board.
     * @returns detached current task views.
     */
    listTasks(caller) {
        return this.tasks.list(this.roster.membership(caller));
    }
    /**
     * Compare-and-set one authorized task transition.
     * @param caller - exact live Team member authorizing the mutation.
     * @param request - task identity, expected revision, action, and action fields.
     * @returns the committed next task revision.
     */
    async updateTask(caller, request) {
        return await this.tasks.update(caller, this.roster.membership(caller), request);
    }
    /**
     * Wait for the next Team-domain or member-status change.
     * @param caller - exact live Team member waiting for activity.
     * @param timeoutMs - bounded wait duration from ten seconds through one hour.
     * @param signal - caller cancellation for the wait only.
     * @returns one observed change or a timeout result.
     */
    async waitForChange(caller, timeoutMs, signal) {
        const membership = this.roster.membership(caller);
        return await this.activity.wait(membership.id, timeoutMs, signal);
    }
    /**
     * Interrupt one live teammate turn without clearing its pending inbox.
     * @param caller - exact live Lead Agent.
     * @param targetName - durable teammate name.
     * @returns the target status sampled before cancellation.
     */
    interrupt(caller, targetName) {
        return this.roster.interrupt(caller, targetName);
    }
    /**
     * Resolve a caller without throwing, used by scoped-tool installation and observers.
     * @param agent - candidate exact live Agent.
     * @returns Team membership, or undefined for non-Team subagents and stale identities.
     */
    tryMembership(agent) {
        return this.roster.tryMembership(agent);
    }
    /** Queue one contained recovery pass after publication has unwound. */
    scheduleRecovery(agent) {
        queueMicrotask(() => {
            if (this.lifecycle.disposed)
                return;
            void this.recoverFor(agent).catch((error) => {
                if (this.lifecycle.disposed)
                    return;
                this.ctx.logger.warn(`Agent Teams recovery for "${agent.id}" failed: ${errorMessage(error)}`);
            });
        });
    }
    /** Reconcile roster provisioning before retrying that member's pending mailbox. */
    async recoverFor(agent) {
        await this.roster.recoverFor(agent, this.lifecycle.signal);
        await this.mailbox.recoverFor(agent, this.lifecycle.signal);
    }
    /** Stop Team-owned live branches and release every waiter before service disposal completes. */
    async disposeRuntime() {
        this.lifecycle.close();
        this.activity.close();
        const failures = [];
        await this.lifecycle.settle(this.roster.pendingCreations(), failures);
        await this.lifecycle.settle(this.mailbox.pendingDispatches(), failures);
        for (const [root, childIds] of this.roster.liveChildrenByRoot()) {
            try {
                await this.roster.stopTeammates(root, childIds);
            }
            catch (error) {
                failures.push(error);
            }
        }
        if (failures.length > 0)
            throw new AggregateError(failures, 'Agent Teams runtime disposal failed');
    }
}
export default TeamService;
//# sourceMappingURL=index.js.map