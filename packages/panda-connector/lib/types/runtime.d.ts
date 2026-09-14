/** Immutable PandaData environments, release discovery, activation, and rollback. */
import type { NormalizedPandaAccount } from './account.ts';
import type { PandaPythonSource, PandaSdkCapabilities } from './types.ts';
import { type PandaWorkerClient, type PandaWorkerResponse } from './worker.ts';
/** Exact wheel selected from the official package index. */
export interface PandaRelease {
    readonly version: string;
    readonly wheelURL: string;
    readonly wheelSha256: string;
}
/** Immutable environment recorded in the activation pointer. */
export interface PandaRuntimeEnvironment {
    readonly id: string;
    readonly root: string;
    readonly sdkVersion: string;
    readonly pythonSource: PandaPythonSource;
    readonly pythonVersion: string;
    readonly apiFingerprint: string;
    readonly publicCallables: readonly string[];
    readonly capabilities: PandaSdkCapabilities;
    readonly createdAt: number;
}
/** Runtime state used by the Host connector projection. */
export interface PandaRuntimeStatus {
    readonly active: PandaRuntimeEnvironment | null;
    readonly previous: PandaRuntimeEnvironment | null;
    readonly response: PandaWorkerResponse | null;
    readonly latestSdkVersion: string | null;
    readonly updateAvailable: boolean;
    readonly lastUpdateCheckedAt: number | null;
}
/** Credential used only to verify a candidate before pointer activation. */
export interface PandaRuntimeCredential {
    readonly account: NormalizedPandaAccount;
    readonly password: string;
}
interface PandaRuntimeConfig {
    readonly managerRoot: string;
    readonly legacyRoot: string;
    readonly releaseIndexURL: string;
    readonly releaseTimeoutMs: number;
    /** Host-owned end-to-end probe run before an authenticated environment becomes active. */
    readonly executionProbe: (environment: PandaRuntimeEnvironment, credential: PandaRuntimeCredential, signal?: AbortSignal) => Promise<void>;
}
/**
 * Parse one exact release from the PyPI JSON response.
 * @param value - untrusted JSON response.
 * @param requestedVersion - exact release or the index's current stable version.
 * @returns validated wheel metadata.
 */
export declare function parsePandaRelease(value: unknown, requestedVersion?: string): PandaRelease;
/** Managed PandaData runtime with candidate probing and pointer-only activation. */
export declare class PandaRuntimeManager {
    private readonly worker;
    private readonly config;
    private activation;
    private latestRelease;
    private lastUpdateCheckedAt;
    /**
     * Create a runtime manager around one worker client.
     * @param worker - one-shot Python process client.
     * @param config - validated storage and release discovery settings.
     */
    constructor(worker: PandaWorkerClient, config: PandaRuntimeConfig);
    /**
     * Resolve one retained immutable environment by its durable identity.
     * @param environmentId - Session-recorded environment identity.
     * @returns the exact environment or `undefined` after external deletion/corruption.
     */
    environment(environmentId: string): Promise<PandaRuntimeEnvironment | undefined>;
    /**
     * Inspect the active environment without restoring SDK-owned authentication files.
     * @param signal - operation lifetime.
     * @returns current runtime state.
     */
    describe(signal?: AbortSignal): Promise<PandaRuntimeStatus>;
    /**
     * Discover the current official SDK release without changing the active environment.
     * @param signal - operation lifetime.
     * @returns current runtime state with update metadata.
     */
    checkForUpdates(signal?: AbortSignal): Promise<PandaRuntimeStatus>;
    /**
     * Install the latest official SDK into a new environment and activate it.
     * @param signal - operation lifetime.
     * @param credential - optional Host credential used for pre-activation data and execution verification.
     * @returns activated runtime state.
     */
    bootstrap(signal?: AbortSignal, credential?: PandaRuntimeCredential): Promise<PandaRuntimeStatus>;
    /**
     * Activate the latest official SDK only when it is newer than the current release.
     * @param credential - Host credential used to validate the candidate before activation.
     * @param signal - operation lifetime.
     * @returns activated runtime state.
     */
    update(credential?: PandaRuntimeCredential, signal?: AbortSignal): Promise<PandaRuntimeStatus>;
    /**
     * Rebuild the active SDK release in a fresh environment.
     * @param credential - Host credential used to validate the candidate before activation.
     * @param signal - operation lifetime.
     * @returns activated replacement state.
     */
    repair(credential?: PandaRuntimeCredential, signal?: AbortSignal): Promise<PandaRuntimeStatus>;
    /**
     * Swap the active and previous immutable environments after probing the target.
     * @param credential - Host credential used to validate the target before pointer swap.
     * @param signal - operation lifetime.
     * @returns rolled-back runtime state.
     */
    rollback(credential?: PandaRuntimeCredential, signal?: AbortSignal): Promise<PandaRuntimeStatus>;
    /**
     * Authenticate in the active environment for this one-shot worker.
     * @param account - normalized account identity.
     * @param password - write-only password.
     * @param validateDataRead - whether to execute the matrix-owned read-only onboarding request.
     * @param signal - operation lifetime.
     * @returns authenticated runtime state suitable for Host-owned credential replay.
     */
    login(account: NormalizedPandaAccount, password: string, validateDataRead?: boolean, signal?: AbortSignal): Promise<PandaRuntimeStatus>;
    /**
     * Clear credentials from every retained environment, then the active environment.
     * @param signal - operation lifetime.
     * @returns verified active runtime state.
     */
    logout(signal?: AbortSignal): Promise<PandaRuntimeStatus>;
    private installCandidate;
    private cleanupOrphanedEnvironments;
    private removeOwnedCandidateRoot;
    private assertCompatible;
    private environmentFromResponse;
    private fetchRelease;
    private loadActivation;
    private adoptLegacy;
    private cacheActivation;
    private isOwnedActivation;
    private isOwnedEnvironment;
    private status;
    private activationPath;
    private writeEnvironment;
    private writeActivation;
}
export {};
//# sourceMappingURL=runtime.d.ts.map