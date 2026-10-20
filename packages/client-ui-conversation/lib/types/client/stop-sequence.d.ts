/** Two independent Escape presses addressed to one Conversation occurrence and live turn. */
import type { SessionId } from '@deepseek-ai/dsh-session/types';
/** Freshly resolved cancellation target; occurrence and region preserve focus ownership. */
export interface StopTarget {
    readonly sessionId: SessionId;
    readonly turn: number;
    /** Materialized Session binding identity; replacement invalidates an earlier press. */
    readonly generation: object;
    readonly region: Element;
    readonly cancel: () => void;
}
/** One short-lived first press, cleared before an accepted cancellation runs. */
export declare class StopSequence {
    private readonly intervalMs;
    private readonly release;
    private first;
    private timer;
    /**
     * @param intervalMs - validated maximum time between independent presses.
     * @param release - releases observations retained by the pending first press.
     */
    constructor(intervalMs: number, release: () => void);
    /** Clear the first press and its expiry timer. */
    reset(): void;
    /**
     * Accept one eligible, non-repeated Escape against freshly resolved current state.
     * @param target - live turn and actual focused input region.
     * @returns whether this press requested cancellation.
     */
    press(target: StopTarget): boolean;
}
//# sourceMappingURL=stop-sequence.d.ts.map