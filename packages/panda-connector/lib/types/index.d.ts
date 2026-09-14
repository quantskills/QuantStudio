/** Host-only PandaData authentication and managed-runtime connector. */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { SessionId } from '@deepseek-ai/dsh-session';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { PandaScriptExecutionResult } from './worker.ts';
import type { PandaConnectorResult, PandaLoginRequest, PandaRuntimeBinding } from './types.ts';
export { normalizePandaAccount, PandaAccountError } from './account.ts';
export { PandaRuntimeManager, parsePandaRelease } from './runtime.ts';
export type { PandaRelease, PandaRuntimeEnvironment, PandaRuntimeStatus } from './runtime.ts';
export { PANDA_DATA_VERSION, PandaWorkerClient, PandaWorkerError } from './worker.ts';
export type * from './types.ts';
export type { NormalizedPandaAccount } from './account.ts';
export type { PandaProcessRuntime, PandaWorkerConfig, PandaWorkerResponse } from './worker.ts';
/** Cordis plugin name for Loader diagnostics. */
export declare const name = "panda-connector";
/** Host service required by the connector. */
export declare const inject: string[];
/** Host-only execution request whose paths were authorized against one Session workspace. */
export interface PandaPythonExecutionRequest {
    readonly binding: PandaRuntimeBinding;
    readonly sessionId: SessionId;
    readonly workspaceRoot: string;
    readonly scriptPath: string;
    readonly args: readonly string[];
    readonly workdir: string;
}
/** Connector process, release discovery, and private-runtime configuration. */
export interface Config {
    /** Python launcher resolved through `ctx.subprocess`. */
    pythonCommand?: string;
    /** Launcher arguments placed before the bundled worker path. */
    pythonArgs?: string[];
    /** Python release installed into the connector-owned runtime directory by uv. */
    managedPythonVersion?: string;
    /** Optional DSH home override; all private runtimes live below it. */
    dshHome?: string;
    /** PandaData service root passed to `panda_data.init_token`. */
    baseURL?: string;
    /** Official PyPI-compatible release index used for SDK discovery. */
    releaseIndexURL?: string;
    /** Release-index request deadline. */
    releaseTimeoutMs?: number;
    /** Login, logout, and describe deadline. */
    operationTimeoutMs?: number;
    /** Private-environment creation and SDK installation deadline. */
    bootstrapTimeoutMs?: number;
    /** Process-tree termination grace. */
    terminateGraceMs?: number;
    /** Per-stream retained worker output bound; stderr remains private. */
    maxOutputBytes?: number;
}
/** Plugin configuration schema. */
export declare const Config: z<Config>;
type ResolvedConfig = Required<Omit<Config, 'dshHome'>> & Pick<Config, 'dshHome'>;
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** Host-owned PandaData authentication and managed-runtime connector. */
        pandaConnector: PandaConnector;
    }
}
/** Serialized PandaData lifecycle service exported through Typert Remote. */
export declare class PandaConnector extends TypertRemoteService {
    static inject: string[];
    static Config: z<Config>;
    private readonly runtime;
    private readonly worker;
    private readonly credentialVault;
    private readonly lifecycle;
    private operationTail;
    private phase;
    private runtimeStatus;
    private sessionCredential;
    private credentialPersistence;
    private reconnectState;
    private dataReadiness;
    private validatedEnvironmentId;
    private lastDataValidatedAt;
    private executionReadiness;
    private executionIsolation;
    private executionBackend;
    private executionEnvironmentId;
    private lastExecutionCheckedAt;
    private readonly executionEvidence;
    private lastFailure;
    private vaultAvailable;
    private disposed;
    /**
     * Create the Host service and bind worker teardown to the Cordis scope.
     * @param ctx - Cordis context containing the subprocess capability.
     * @param config - resolved connector configuration.
     */
    constructor(ctx: Context, config: ResolvedConfig);
    /**
     * Return the exact connected runtime identity to freeze into a Session.
     * @returns immutable binding for the active verified environment.
     */
    runtimeBinding(): PandaRuntimeBinding;
    /**
     * Verify that a Session-recorded environment remains retained and executable with Host credentials.
     * @param binding - exact runtime identity read from the Session log.
     */
    validateRuntimeBinding(binding: PandaRuntimeBinding): Promise<void>;
    /**
     * Execute one authorized script through the exact Session runtime and an available Host confinement backend.
     * @param request - immutable runtime identity and canonical Host-authorized paths.
     * @param signal - execution lifetime.
     * @returns bounded process outcome without credential material.
     */
    executePython(request: PandaPythonExecutionRequest, signal?: AbortSignal): Promise<PandaScriptExecutionResult>;
    /**
     * Inspect the active SDK and restore persisted authentication.
     * @param signal - Operation lifetime.
     * @returns Safe connector state.
     */
    describe(signal?: AbortSignal): Promise<PandaConnectorResult>;
    /**
     * Discover the latest official SDK release without changing the active environment.
     * @param signal - Operation lifetime.
     * @returns Update metadata.
     */
    checkForUpdates(signal?: AbortSignal): Promise<PandaConnectorResult>;
    /**
     * Install the latest official SDK into a new private environment.
     * @param signal - Operation lifetime.
     * @returns Activated connector state.
     */
    bootstrap(signal?: AbortSignal): Promise<PandaConnectorResult>;
    /**
     * Upgrade through candidate verification and pointer-only activation.
     * @param signal - Operation lifetime.
     * @returns Activated connector state.
     */
    update(signal?: AbortSignal): Promise<PandaConnectorResult>;
    /**
     * Rebuild the active release without modifying the current environment in place.
     * @param signal - Operation lifetime.
     * @returns Repaired connector state.
     */
    repair(signal?: AbortSignal): Promise<PandaConnectorResult>;
    /**
     * Restore the previously verified immutable environment.
     * @param signal - Operation lifetime.
     * @returns Rolled-back connector state.
     */
    rollback(signal?: AbortSignal): Promise<PandaConnectorResult>;
    /**
     * Authenticate and retain replay material in the OS credential store when available.
     * @param request - explicit account form and write-only password.
     * @param signal - caller/connection lifetime.
     * @returns `connected` after the one-shot SDK login succeeds.
     */
    login(request: PandaLoginRequest, signal?: AbortSignal): Promise<PandaConnectorResult>;
    /**
     * Clear Host-owned replay material and ask every retained SDK environment to log out.
     * @param signal - Operation lifetime.
     * @returns Verified disconnected state.
     */
    logout(signal?: AbortSignal): Promise<PandaConnectorResult>;
    /** Abort active work and drain the serialized lifecycle queue. @returns settlement after all work has drained. */
    disposeConnector(): Promise<void>;
    private execute;
    private candidateCredential;
    private serialize;
    private operationSignal;
    private restoreStoredCredential;
    private replayCredential;
    private confineExecution;
    private probeEnvironment;
    private executionEvidenceKey;
    private findExecutionEvidence;
    private latestExecutionEvidence;
    private applyExecutionEvidence;
    private resetExecutionState;
    private publish;
    private state;
    private success;
    private failure;
    private recordFailure;
    private failureCode;
}
export default PandaConnector;
//# sourceMappingURL=index.d.ts.map