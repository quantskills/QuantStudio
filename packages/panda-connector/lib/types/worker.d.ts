/** Private PandaData worker process client. */
import type { RunnerFailureRule } from '@deepseek-ai/dsh-sandbox';
import type { SubprocessHandle, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess';
import type { PandaConnectorFailureCode, PandaPythonSource, PandaSdkCapabilities } from './types.ts';
import type { NormalizedPandaAccount } from './account.ts';
import type { PandaSdkValidationCall } from './compatibility.ts';
/** Legacy SDK release eligible for first-run environment adoption. */
export declare const PANDA_DATA_VERSION = "0.0.12";
/** Process and storage configuration resolved by the Host plugin. */
export interface PandaWorkerConfig {
    /** Configured system Python launcher used before the managed fallback. */
    readonly pythonCommand: string;
    /** Arguments inserted immediately after the configured Python launcher. */
    readonly pythonArgs: readonly string[];
    /** QuantSkills source root inspected for conventional project virtual environments. */
    readonly projectRoot: string;
    /** Absolute virtual environment inherited from the Host process, when present. */
    readonly activeVirtualEnvironment?: string;
    /** Connector-owned directory for managed Python downloads and caches. */
    readonly runtimeManagerRoot: string;
    /** Python release selected when the configured launcher is unavailable or unsupported. */
    readonly managedPythonVersion: string;
    /** PandaData service root passed only to the login worker. */
    readonly baseURL: string;
    /** Deadline for describe, login, and logout operations. */
    readonly operationTimeoutMs: number;
    /** Deadline for private-environment creation and package installation. */
    readonly bootstrapTimeoutMs: number;
    /** Grace period before process-tree termination escalates. */
    readonly terminateGraceMs: number;
    /** Maximum retained bytes for each worker output stream. */
    readonly maxOutputBytes: number;
}
/** Host-only request for one credential-injected PandaData script execution. */
export interface PandaScriptExecutionRequest {
    readonly scriptPath: string;
    readonly args: readonly string[];
    readonly workdir: string;
    readonly account: NormalizedPandaAccount;
    readonly password: string;
}
/** Bounded process outcome returned by the private PandaData bootstrap. */
export interface PandaScriptExecutionResult {
    readonly exitCode: number;
    readonly stdout: string;
    readonly stderr: string;
}
/** Sandbox wrapper facts required to distinguish runner failure from script failure. */
export interface PandaExecutionArgv {
    readonly argv: readonly string[];
    readonly runnerFailureRules: readonly RunnerFailureRule[];
}
/** Validated result emitted by the bundled one-shot Python worker. */
export interface PandaWorkerResponse {
    readonly ok: boolean;
    readonly installedSdkVersion: string | null;
    readonly logoutSupported: boolean;
    readonly authenticated: boolean;
    /** True only when this worker completed the compatibility-matrix read-only request. */
    readonly dataValidated: boolean;
    readonly pythonVersion: string | null;
    readonly pythonSource: PandaPythonSource;
    readonly publicCallables: readonly string[];
    readonly apiFingerprint: string | null;
    readonly capabilities: PandaSdkCapabilities | null;
    readonly code?: PandaConnectorFailureCode;
}
/** Fixed worker failure; stdout, stderr, exception text, and credentials stay private. */
export declare class PandaWorkerError extends Error {
    readonly code: PandaConnectorFailureCode;
    /**
     * Create a redacted worker failure.
     * @param code - closed failure identifier safe to return through Remote.
     */
    constructor(code: PandaConnectorFailureCode);
}
/** Spawn surface used by the process client and test doubles. */
export interface PandaProcessRuntime {
    /**
     * Resolve a configured launcher without inheriting credential material.
     * @param command - executable name or path.
     * @param env - optional resolver environment.
     * @param signal - resolution lifetime.
     * @returns absolute executable path.
     */
    resolveExecutable(command: string, env?: Readonly<Record<string, string>>, signal?: AbortSignal): Promise<string>;
    /**
     * Start a one-shot worker process.
     * @param spec - subprocess request with bounded streams and lifetime signal.
     * @returns handle used to await and terminate the process tree.
     */
    spawn(spec: SubprocessSpawnSpec): SubprocessHandle;
}
/** One-shot stdin client for the bundled Python worker. */
export declare class PandaWorkerClient {
    private readonly subprocess;
    private readonly config;
    private readonly workerPath;
    private readonly runnerPath;
    private configuredPython;
    private managedPython;
    /**
     * Create a worker client over the Host subprocess capability.
     * @param subprocess - process-tree runtime or a test double.
     * @param config - validated private-runtime configuration.
     */
    constructor(subprocess: PandaProcessRuntime, config: PandaWorkerConfig);
    /**
     * Inspect one immutable private environment.
     * @param runtimeRoot - absolute environment directory.
     * @param sdkVersion - exact SDK release expected in the environment.
     * @param pythonSource - interpreter origin recorded for the environment.
     * @param signal - operation lifetime.
     * @returns validated worker response.
     */
    describeAt(runtimeRoot: string, sdkVersion: string, pythonSource: PandaPythonSource, signal?: AbortSignal): Promise<PandaWorkerResponse>;
    /**
     * Create one candidate environment and install an exact, hash-verified SDK wheel.
     * @param runtimeRoot - new immutable environment directory.
     * @param sdkVersion - exact SDK release to install.
     * @param wheelURL - official wheel URL selected from the release index.
     * @param wheelSha256 - expected wheel SHA-256 digest.
     * @param signal - operation lifetime.
     * @returns verified candidate response.
     */
    bootstrapAt(runtimeRoot: string, sdkVersion: string, wheelURL: string | undefined, wheelSha256: string | undefined, signal?: AbortSignal): Promise<PandaWorkerResponse>;
    /**
     * Authenticate inside one active environment.
     * @param runtimeRoot - active environment directory.
     * @param sdkVersion - active SDK release.
     * @param pythonSource - interpreter origin recorded for the environment.
     * @param account - normalized explicit account form.
     * @param password - write-only PandaData password.
     * @param validationCall - matrix-owned read-only request for explicit first-login verification.
     * @param signal - operation lifetime.
     * @returns validated worker response.
     */
    loginAt(runtimeRoot: string, sdkVersion: string, pythonSource: PandaPythonSource, account: NormalizedPandaAccount, password: string, validationCall?: PandaSdkValidationCall, signal?: AbortSignal): Promise<PandaWorkerResponse>;
    /**
     * Clear authentication inside one retained environment.
     * @param runtimeRoot - environment directory.
     * @param sdkVersion - installed SDK release.
     * @param pythonSource - interpreter origin recorded for the environment.
     * @param signal - operation lifetime.
     * @returns validated worker response.
     */
    logoutAt(runtimeRoot: string, sdkVersion: string, pythonSource: PandaPythonSource, signal?: AbortSignal): Promise<PandaWorkerResponse>;
    /**
     * Return the exact private runner invocation that the sandbox must wrap.
     * @param runtimeRoot - exact retained environment directory.
     * @returns Python runner argv without credential material.
     */
    executionArgv(runtimeRoot: string): readonly string[];
    /**
     * Execute one workspace-authorized script in an exact immutable runtime.
     * @param runtimeRoot - exact retained environment directory.
     * @param sdkVersion - exact SDK version recorded by the Session.
     * @param request - validated script paths, args, and Host-owned replay material.
     * @param argvWrapper - sandbox wrapper and runner-failure rules applied before spawn.
     * @param signal - execution lifetime.
     * @returns bounded stdout, stderr, and exit status.
     */
    executeAt(runtimeRoot: string, sdkVersion: string, request: PandaScriptExecutionRequest, argvWrapper: (argv: readonly string[]) => PandaExecutionArgv, signal?: AbortSignal): Promise<PandaScriptExecutionResult>;
    private operationSignal;
    private resolveConfiguredPython;
    private findConfiguredPython;
    private resolveManagedPython;
    private installManagedPython;
    private runUtility;
    private run;
}
//# sourceMappingURL=worker.d.ts.map