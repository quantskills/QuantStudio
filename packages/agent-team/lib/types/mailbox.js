/** Durable Team mailbox admission, target-local dispatch, acknowledgement, and recovery. */
import { randomUUID } from 'node:crypto';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { SessionId } from '@deepseek-ai/dsh-session';
import { errorMessage, TeamError } from "./error.js";
import { resolveActiveMember } from "./roster.js";
import { messageAccepted } from "./session-message.js";
import { TeamId, TeamMessageId } from "./types.js";
/** Owns every process-local state transition for the durable Team mailbox. */
export class TeamMailbox {
    ctx;
    journal;
    roster;
    lifecycle;
    maxPendingMessagesPerMember;
    maxMessageBytes;
    dispatchTails = new Map();
    activeDispatches = new Map();
    inFlightMessages = new Set();
    inFlightDispatches = new Set();
    /**
     * @param ctx - Team service context with Agent, Session, persistence, and subagent services.
     * @param journal - authoritative Lead-log transaction owner.
     * @param roster - Team membership and member-name resolver.
     * @param lifecycle - shared Team runtime admission cutoff.
     * @param maxPendingMessagesPerMember - per-target queued-minus-delivered limit.
     * @param maxMessageBytes - maximum complete sender-framed delivery size.
     */
    constructor(ctx, journal, roster, lifecycle, maxPendingMessagesPerMember, maxMessageBytes) {
        this.ctx = ctx;
        this.journal = journal;
        this.roster = roster;
        this.lifecycle = lifecycle;
        this.maxPendingMessagesPerMember = maxPendingMessagesPerMember;
        this.maxMessageBytes = maxMessageBytes;
    }
    /**
     * Queue one durable peer message, then attempt immediate delivery.
     * @param caller - exact live sending Team member.
     * @param request - target name, content, scheduling mode, and pre-queue cancellation.
     * @returns durable message identity and immediate-delivery observation.
     */
    async send(caller, request) {
        if (this.lifecycle.disposed)
            throw new TeamError('Agent Teams service is disposing', 'TEAM_DISPOSED');
        const operation = this.sendAdmitted(caller, {
            ...request,
            signal: AbortSignal.any([request.signal, this.lifecycle.signal]),
        });
        return await this.trackDispatch(operation);
    }
    /**
     * Observe target-side durable receipts and checkpoint their Lead-log acknowledgement.
     * @param session - exact target Session receiving the event.
     * @param event - newly appended Session event.
     */
    observeSessionEvent(session, event) {
        if (this.lifecycle.disposed || event.type !== 'user/message' || event.data.source.kind !== 'team-message')
            return;
        const source = event.data.source;
        const acknowledgement = Promise.resolve().then(async () => {
            const root = this.ctx.agents.get(SessionId(source.teamId));
            if (root !== undefined)
                await this.checkpointDelivered(root, session, source.messageId);
        }).catch((error) => {
            this.ctx.logger.warn(`Team message "${source.messageId}" acknowledgement failed: ${errorMessage(error)}`);
        });
        void this.trackDispatch(acknowledgement);
    }
    /**
     * Retry durable pending messages relevant to one started Team member.
     * @param agent - newly started exact live Agent.
     * @param signal - shared runtime cancellation.
     */
    async recoverFor(agent, signal) {
        signal.throwIfAborted();
        const membership = this.roster.tryMembership(agent);
        if (membership === undefined)
            return;
        const state = this.journal.state(membership.root);
        const messages = [...state.messages.values()].filter(message => !state.delivered.has(message.id)
            && (membership.role === 'lead' || message.targetId === agent.id));
        for (const message of messages) {
            signal.throwIfAborted();
            if (membership.role === 'lead' && message.delivery === 'quiet'
                && message.targetId !== membership.root.id && this.ctx.agents.get(message.targetId) === undefined)
                continue;
            await this.tryDispatch(membership.root, message, signal);
        }
    }
    /**
     * Return admitted dispatch and acknowledgement operations captured for disposal.
     * @returns detached snapshot ordered only by Set insertion.
     */
    pendingDispatches() {
        return [...this.inFlightDispatches];
    }
    /** Queue and dispatch one mailbox item admitted before the disposal cutoff. */
    async sendAdmitted(caller, request) {
        const membership = this.roster.membership(caller);
        request.signal.throwIfAborted();
        const root = membership.root;
        const content = structuredClone(request.content);
        const queued = await this.journal.transact(root.id, async () => {
            request.signal.throwIfAborted();
            const state = this.journal.state(root);
            const target = resolveActiveMember(root, state, request.target);
            if (target.id === caller.id)
                throw new TeamError('a Team member cannot message itself', 'TEAM_SELF_MESSAGE');
            const pendingForTarget = [...state.messages.values()].filter(candidate => candidate.targetId === target.id && !state.delivered.has(candidate.id)).length;
            if (pendingForTarget >= this.maxPendingMessagesPerMember) {
                throw new TeamError(`teammate "${target.name}" has ${pendingForTarget} pending messages`, 'TEAM_MAILBOX_FULL');
            }
            const queued = {
                id: TeamMessageId(`team-message-${randomUUID()}`),
                senderId: caller.id,
                senderName: membership.name,
                targetId: target.id,
                delivery: request.delivery,
                content,
            };
            if (Buffer.byteLength(JSON.stringify(this.deliveryContent(queued)), 'utf8') > this.maxMessageBytes) {
                throw new TeamError(`team message exceeds ${this.maxMessageBytes} bytes`, 'TEAM_MESSAGE_TOO_LARGE');
            }
            await this.journal.appendAndFlush(root, 'team/message/queued', {
                version: 1,
                teamId: TeamId(root.id),
                message: queued,
            });
            // Register dispatch before releasing the root transaction so concurrent
            // senders enter the target-local queue in durable mailbox order.
            return { message: queued, dispatch: this.tryDispatch(root, queued, request.signal) };
        });
        const accepted = await queued.dispatch;
        return { messageId: queued.message.id, status: accepted ? 'accepted' : 'queued' };
    }
    /** Attempt one queued message exactly once in this process at a time. */
    tryDispatch(root, message, signal) {
        if (this.lifecycle.disposed)
            return Promise.resolve(false);
        if (this.inFlightMessages.has(message.id))
            return Promise.resolve(false);
        this.inFlightMessages.add(message.id);
        const operation = this.trackDispatch(this.tryDispatchAdmitted(root, message, AbortSignal.any([signal, this.lifecycle.signal])));
        const forget = () => {
            this.inFlightMessages.delete(message.id);
        };
        void operation.then(forget, forget);
        return operation;
    }
    /** Track one dispatch transaction through delivery admission or contained failure. */
    trackDispatch(operation) {
        this.inFlightDispatches.add(operation);
        void operation.then(() => {
            this.inFlightDispatches.delete(operation);
        }, () => {
            this.inFlightDispatches.delete(operation);
        });
        return operation;
    }
    /** Attempt one queued message admitted before the service lifecycle cutoff. */
    async tryDispatchAdmitted(root, message, signal) {
        const active = this.activeDispatches.get(message.targetId);
        const live = message.targetId === root.id ? root : this.ctx.agents.get(message.targetId);
        if (active !== undefined && live !== undefined && message.delivery === 'quiet'
            && this.messagePrecedes(root, message.id, active.id)) {
            return await this.dispatchOnce(root, message, signal);
        }
        return await this.serializeDispatch(message, () => this.dispatchOnce(root, message, signal));
    }
    /** Serialize delivery admission for one durable target in queued order. */
    async serializeDispatch(message, operation) {
        const targetId = message.targetId;
        const prior = this.dispatchTails.get(targetId) ?? Promise.resolve();
        const dispatch = async () => {
            this.activeDispatches.set(targetId, message);
            try {
                return await operation();
            }
            finally {
                this.activeDispatches.delete(targetId);
            }
        };
        /* v8 ignore next -- dispatch tails absorb rejection, so the recovery callback is a fail-safe backstop. */
        const run = prior.then(dispatch, dispatch);
        /* v8 ignore next -- dispatchOnce contains delivery failures and serializeDispatch itself does not throw. */
        const tail = run.then(() => undefined, () => undefined);
        this.dispatchTails.set(targetId, tail);
        try {
            return await run;
        }
        finally {
            if (this.dispatchTails.get(targetId) === tail)
                this.dispatchTails.delete(targetId);
        }
    }
    /** Attempt one queued delivery after target-local ordering admits it. */
    async dispatchOnce(root, message, signal) {
        try {
            const target = message.targetId === root.id ? root : this.ctx.agents.get(message.targetId);
            if (target !== undefined && this.targetRecorded(target.session, message.id)) {
                return await this.checkpointDelivered(root, target.session, message.id);
            }
            const source = {
                kind: 'team-message',
                teamId: TeamId(root.id),
                messageId: message.id,
                senderId: message.senderId,
                senderName: message.senderName,
            };
            const content = this.deliveryContent(message);
            if (message.targetId === root.id) {
                const input = createUserMessage({ content, source });
                if (message.delivery === 'wakeup') {
                    root.followup(input);
                    return await this.checkpointDelivered(root, root.session, message.id);
                }
                root.inject(input);
                return await this.checkpointDelivered(root, root.session, message.id);
            }
            if (message.delivery === 'quiet') {
                if (target === undefined)
                    return false;
                target.inject(createUserMessage({ content, source }));
                return await this.checkpointDelivered(root, target.session, message.id);
            }
            if (target === undefined) {
                const recorded = await this.persistedTargetRecorded(message.targetId, message.id, signal);
                if (recorded === undefined)
                    return false;
                if (recorded) {
                    await this.markDelivered(root, message.id, message.targetId);
                    return true;
                }
            }
            await this.ctx.subagents.followup(root, message.targetId, content, { source, signal });
            return target === undefined
                ? true
                : await this.checkpointDelivered(root, target.session, message.id);
        }
        catch (error) {
            this.ctx.logger.warn(`team message "${message.id}" remains queued: ${errorMessage(error)}`);
            return false;
        }
    }
    /** Whether `left` was durably queued before `right` in one Lead log. */
    messagePrecedes(root, left, right) {
        const ids = [...this.journal.state(root).messages.keys()];
        return ids.indexOf(left) < ids.indexOf(right);
    }
    /** Flush one live target receipt before the Lead records its delivered edge. */
    async checkpointDelivered(root, target, messageId) {
        await this.ctx.sessions.flush(target);
        if (!this.targetRecorded(target, messageId))
            return false;
        await this.markDelivered(root, messageId, target.id);
        return true;
    }
    /** Record delivery unless the acknowledgement already exists. */
    async markDelivered(root, messageId, targetId) {
        await this.journal.transact(root.id, async () => {
            const state = this.journal.state(root);
            if (state.delivered.has(messageId))
                return;
            const queued = state.messages.get(messageId);
            if (queued === undefined || queued.targetId !== targetId)
                return;
            await this.journal.appendAndFlush(root, 'team/message/delivered', {
                version: 1,
                teamId: TeamId(root.id),
                messageId,
                targetId,
            });
        });
    }
    /** Whether a target Session already contains the durable message identity. */
    targetRecorded(session, messageId) {
        const suffix = session.events.slice(session.header.seedLength ?? 0);
        return messageAccepted(suffix, message => message.source.kind === 'team-message'
            && message.source.messageId === messageId);
    }
    /** Frame peer content with stable sender and message identity for the receiving model. */
    deliveryContent(message) {
        return [
            { type: 'text', text: `Team message ${message.id} from ${message.senderName}:` },
            ...structuredClone(message.content),
        ];
    }
    /** Inspect an inactive target before cold resume; uncertainty keeps the mailbox queued. */
    async persistedTargetRecorded(targetId, messageId, signal) {
        try {
            const stored = await this.ctx.sessionPersistence.inspect(targetId, signal);
            const suffix = stored.events.slice(stored.meta.seedLength ?? 0);
            return messageAccepted(suffix, message => message.source.kind === 'team-message'
                && message.source.messageId === messageId);
        }
        catch (error) {
            this.ctx.logger.warn(`cannot inspect Team message target "${targetId}": ${errorMessage(error)}`);
            return undefined;
        }
    }
}
//# sourceMappingURL=mailbox.js.map