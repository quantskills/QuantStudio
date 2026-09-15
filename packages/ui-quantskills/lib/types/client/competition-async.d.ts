/** Bound UI waiting without replaying the underlying operation. A timeout is not a server cancellation. */
export declare function waitForCompetition<T>(work: (signal: AbortSignal) => Promise<T>, label: string, timeout?: number, signal?: AbortSignal): Promise<T>;
interface CompetitionStatus {
    readonly enabled: boolean;
    readonly phase: string;
    readonly plans: readonly unknown[];
}
/** Shared only by the two competition surfaces; no ordinary-session polling or global state. */
export declare function useCompetitionState<S extends CompetitionStatus>(access: {
    status(sessionId?: string): Promise<S>;
}, sessionId?: string): {
    status: S | undefined;
    error: string;
    busy: string;
    run: (name: string, work: (signal: AbortSignal) => Promise<unknown>) => Promise<boolean>;
    refresh: () => Promise<void>;
};
export {};
//# sourceMappingURL=competition-async.d.ts.map