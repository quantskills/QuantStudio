/** One-shot Team change waiters independent of durable state projection. */
import type { TeamId, TeamWaitResult } from './types.ts';
/** Owns current Team change waiters and releases each at most once. */
export declare class TeamActivity {
    private readonly waiters;
    private closed;
    /**
     * Wait for one later Team-domain or member-status change.
     * @param id - Team whose next edge wakes the caller.
     * @param timeoutMs - bounded wait duration from ten seconds through one hour.
     * @param signal - caller cancellation for this wait only.
     * @returns whether the wait ended by timeout.
     */
    wait(id: TeamId, timeoutMs: number, signal: AbortSignal): Promise<TeamWaitResult>;
    /**
     * Wake and remove every current waiter for one Team.
     * @param id - Team whose current waiters observe the change.
     */
    notify(id: TeamId): void;
    /** Close admission and wake every current waiter during runtime disposal. */
    close(): void;
}
//# sourceMappingURL=activity.d.ts.map