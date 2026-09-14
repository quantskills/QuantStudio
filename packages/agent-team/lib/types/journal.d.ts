/** Serialized Team transactions over the exact live Lead Session log. */
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { Context } from '@deepseek-ai/cordis';
import type { SessionEventMap, SessionId } from '@deepseek-ai/dsh-session';
import type { TeamFoldState } from './fold.ts';
type MutableTeamEventType = 'team/member' | 'team/task' | 'team/message/queued' | 'team/message/delivered';
/** Owns per-Lead transaction order and committed Team event publication. */
export declare class TeamJournal {
    private readonly ctx;
    private readonly onCommit;
    private readonly tails;
    /**
     * @param ctx - Team service context with the injected Session service.
     * @param onCommit - synchronous notification after the Team event flush succeeds.
     */
    constructor(ctx: Context, onCommit: (root: Agent) => void);
    /**
     * Fold authoritative Team state for one exact live Lead.
     * @param root - exact live Team Lead.
     * @returns current replay state selected by the Lead Team id.
     */
    state(root: Agent): TeamFoldState;
    /**
     * Serialize one Lead's asynchronous mutation operation.
     * @param rootId - Lead Session identity selecting the transaction queue.
     * @param operation - complete read-check-append operation.
     * @returns the operation result.
     */
    transact<T>(rootId: SessionId, operation: () => Promise<T>): Promise<T>;
    /**
     * Append and checkpoint one root-owned Team event before publication.
     * @param root - exact live Lead whose Session owns the event.
     * @param type - Team event discriminant.
     * @param data - payload correlated with the event type.
     */
    appendAndFlush<T extends MutableTeamEventType>(root: Agent, type: T, data: SessionEventMap[T]): Promise<void>;
}
export {};
//# sourceMappingURL=journal.d.ts.map