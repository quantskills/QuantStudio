/** Panda readiness gate for every QuantSkills-owned launch. */
import type { PandaConnectionSnapshot } from './types.ts';
interface PandaTaskGatePort {
    /** Refresh the Host connector projection before a gated launch. */
    describe: () => Promise<void>;
    /** Prepare the managed runtime on the first Panda-dependent launch. */
    bootstrap: () => Promise<void>;
    /** Return the latest published connector projection. */
    connection: () => PandaConnectionSnapshot;
}
interface PandaTaskGatePolicy {
    /** Return whether a blocked launch should resume after login. */
    resumeAfterLogin: () => boolean;
}
type PandaTaskIntervention = 'login' | 'runtime';
/** User-actionable failure for a launch blocked by the configured Panda login policy. */
export declare class PandaLoginRequiredError extends Error {
    constructor(message?: string);
}
/** User-actionable failure for a launch blocked by PandaData execution readiness. */
export declare class PandaRuntimeRequiredError extends Error {
    constructor(message?: string);
}
/**
 * Hold at most one QuantSkills launch and resume it only after the Host
 * connector publishes authenticated, data-verified, executable state.
 */
export declare class PandaTaskGate {
    private readonly port;
    private readonly policy;
    private readonly requestIntervention;
    private readonly clearPending;
    private pending;
    private disposed;
    /**
     * @param port - connector refresh and state reads.
     * @param policy - current durable preference reads.
     * @param requestIntervention - opens login or runtime repair and publishes the pending label.
     * @param clearPending - clears the pending label after settlement.
     */
    constructor(port: PandaTaskGatePort, policy: PandaTaskGatePolicy, requestIntervention: (label: string, target: PandaTaskIntervention) => void, clearPending: () => void);
    /**
     * Run only when authentication, read-only data, and script execution are ready.
     * @param label - user-facing description of the blocked launch.
     * @param task - exact launch operation to run once.
     * @returns the launch result.
     */
    run<T>(label: string, task: () => Promise<T>): Promise<T>;
    /** Resume the pending launch after the connector publishes login success. */
    connectionChanged(): void;
    /**
     * Cancel the pending launch without affecting any task already running.
     * @param reason - user-actionable cancellation reason.
     */
    cancel(reason?: PandaLoginRequiredError): void;
    /** Reject pending work and refuse future launches. */
    dispose(): void;
}
export {};
//# sourceMappingURL=panda-task-gate.d.ts.map