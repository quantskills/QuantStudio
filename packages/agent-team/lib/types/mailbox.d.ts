/** Durable Team mailbox admission, target-local dispatch, acknowledgement, and recovery. */
import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session';
import type { TeamJournal } from './journal.ts';
import type { TeamRuntimeLifecycle } from './lifecycle.ts';
import type { TeamRoster } from './roster.ts';
import type { SendTeamMessageRequest, SendTeamMessageResult } from './types.ts';
/** Owns every process-local state transition for the durable Team mailbox. */
export declare class TeamMailbox {
    private readonly ctx;
    private readonly journal;
    private readonly roster;
    private readonly lifecycle;
    private readonly maxPendingMessagesPerMember;
    private readonly maxMessageBytes;
    private readonly dispatchTails;
    private readonly activeDispatches;
    private readonly inFlightMessages;
    private readonly inFlightDispatches;
    /**
     * @param ctx - Team service context with Agent, Session, persistence, and subagent services.
     * @param journal - authoritative Lead-log transaction owner.
     * @param roster - Team membership and member-name resolver.
     * @param lifecycle - shared Team runtime admission cutoff.
     * @param maxPendingMessagesPerMember - per-target queued-minus-delivered limit.
     * @param maxMessageBytes - maximum complete sender-framed delivery size.
     */
    constructor(ctx: Context, journal: TeamJournal, roster: TeamRoster, lifecycle: TeamRuntimeLifecycle, maxPendingMessagesPerMember: number, maxMessageBytes: number);
    /**
     * Queue one durable peer message, then attempt immediate delivery.
     * @param caller - exact live sending Team member.
     * @param request - target name, content, scheduling mode, and pre-queue cancellation.
     * @returns durable message identity and immediate-delivery observation.
     */
    send(caller: Agent, request: SendTeamMessageRequest): Promise<SendTeamMessageResult>;
    /**
     * Observe target-side durable receipts and checkpoint their Lead-log acknowledgement.
     * @param session - exact target Session receiving the event.
     * @param event - newly appended Session event.
     */
    observeSessionEvent(session: Session, event: SessionEvent): void;
    /**
     * Retry durable pending messages relevant to one started Team member.
     * @param agent - newly started exact live Agent.
     * @param signal - shared runtime cancellation.
     */
    recoverFor(agent: Agent, signal: AbortSignal): Promise<void>;
    /**
     * Return admitted dispatch and acknowledgement operations captured for disposal.
     * @returns detached snapshot ordered only by Set insertion.
     */
    pendingDispatches(): readonly Promise<unknown>[];
    /** Queue and dispatch one mailbox item admitted before the disposal cutoff. */
    private sendAdmitted;
    /** Attempt one queued message exactly once in this process at a time. */
    private tryDispatch;
    /** Track one dispatch transaction through delivery admission or contained failure. */
    private trackDispatch;
    /** Attempt one queued message admitted before the service lifecycle cutoff. */
    private tryDispatchAdmitted;
    /** Serialize delivery admission for one durable target in queued order. */
    private serializeDispatch;
    /** Attempt one queued delivery after target-local ordering admits it. */
    private dispatchOnce;
    /** Whether `left` was durably queued before `right` in one Lead log. */
    private messagePrecedes;
    /** Flush one live target receipt before the Lead records its delivered edge. */
    private checkpointDelivered;
    /** Record delivery unless the acknowledgement already exists. */
    private markDelivered;
    /** Whether a target Session already contains the durable message identity. */
    private targetRecorded;
    /** Frame peer content with stable sender and message identity for the receiving model. */
    private deliveryContent;
    /** Inspect an inactive target before cold resume; uncertainty keeps the mailbox queued. */
    private persistedTargetRecorded;
}
//# sourceMappingURL=mailbox.d.ts.map