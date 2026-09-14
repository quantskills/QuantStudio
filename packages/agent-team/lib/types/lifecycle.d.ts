/** Shared admission cutoff and bounded settlement for the Team runtime. */
/** Owns the single Team runtime cancellation fact and disposal timeout. */
export declare class TeamRuntimeLifecycle {
    private readonly disposalTimeoutMs;
    private readonly controller;
    /**
     * @param disposalTimeoutMs - maximum wait for one disposal settlement operation.
     */
    constructor(disposalTimeoutMs: number);
    /** Signal aborted exactly when Team runtime admission closes. */
    get signal(): AbortSignal;
    /** Whether Team runtime admission is closed. */
    get disposed(): boolean;
    /** The exact cancellation reason used to distinguish expected disposal rejection. */
    get reason(): unknown;
    /** Whether a rejection is the runtime cancellation, directly or through an Error cause chain. */
    private isCancellation;
    /** Close Team runtime admission and cancel admitted interruptible work. */
    close(): void;
    /**
     * Await admitted operations and retain failures other than runtime cancellation.
     * @param operations - admitted operations captured after the admission cutoff.
     * @param failures - aggregate destination for unexpected rejection or timeout.
     */
    settle(operations: readonly Promise<unknown>[], failures: unknown[]): Promise<void>;
    /**
     * Bound one runtime settlement operation.
     * @param operation - settlement that may otherwise block HMR or process shutdown.
     * @returns the operation result.
     */
    withTimeout<T>(operation: Promise<T>): Promise<T>;
}
//# sourceMappingURL=lifecycle.d.ts.map