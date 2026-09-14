/** Host-only PandaData authentication and managed-runtime connector. */
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import z from '@deepseek-ai/schemastery';
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths';
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { normalizePandaAccount, PandaAccountError } from "./account.js";
import { createPandaCredentialVault, PandaCredentialVaultUnavailableError, } from "./credential-vault.js";
import { pandaSdkCompatibility } from "./compatibility.js";
import { PandaRuntimeManager, } from "./runtime.js";
import { PANDA_DATA_VERSION, PandaWorkerClient, PandaWorkerError } from "./worker.js";
export { normalizePandaAccount, PandaAccountError } from "./account.js";
export { PandaRuntimeManager, parsePandaRelease } from "./runtime.js";
export { PANDA_DATA_VERSION, PandaWorkerClient, PandaWorkerError } from "./worker.js";
/** Cordis plugin name for Loader diagnostics. */
export const name = 'panda-connector';
/** Host service required by the connector. */
export const inject = ['sandbox', 'subprocess'];
const DEFAULT_BASE_URL = 'http://pandadata.pandaaiquant.com';
const DEFAULT_RELEASE_INDEX_URL = 'https://pypi.org/pypi/panda_data/json';
const DEFAULT_OPERATION_TIMEOUT_MS = 30_000;
const DEFAULT_RELEASE_TIMEOUT_MS = 15_000;
const DEFAULT_BOOTSTRAP_TIMEOUT_MS = 12 * 60_000;
const DEFAULT_TERMINATE_GRACE_MS = 2_000;
const DEFAULT_MAX_OUTPUT_BYTES = 65_536;
const DEFAULT_MANAGED_PYTHON_VERSION = '3.12';
const EXECUTION_PROBE_SUCCESS = 'PANDADATA_EXECUTION_PROBE_OK';
const EXECUTION_PROBE_SOURCE = fileURLToPath(new URL('../worker/panda_execution_probe.py', import.meta.url));
/* v8 ignore next -- Windows and POSIX coverage lanes each exercise their native launcher default. */
const DEFAULT_PYTHON_COMMAND = process.platform === 'win32' ? 'py' : 'python3';
/* v8 ignore next -- Windows and POSIX coverage lanes each exercise their native launcher arguments. */
const DEFAULT_PYTHON_ARGS = process.platform === 'win32' ? ['-3.10'] : [];
const PLUGIN_PROJECT_ROOT = resolve(process.env.INIT_CWD ?? process.cwd());
/** Plugin configuration schema. */
export const Config = z.object({
    pythonCommand: z.string().default(DEFAULT_PYTHON_COMMAND),
    pythonArgs: z.array(String).default(DEFAULT_PYTHON_ARGS),
    managedPythonVersion: z.string().default(DEFAULT_MANAGED_PYTHON_VERSION),
    dshHome: z.string(),
    baseURL: z.string().default(DEFAULT_BASE_URL),
    releaseIndexURL: z.string().default(DEFAULT_RELEASE_INDEX_URL),
    releaseTimeoutMs: z.number().max(MAX_TIMER_DELAY_MS).default(DEFAULT_RELEASE_TIMEOUT_MS),
    operationTimeoutMs: z.number().max(MAX_TIMER_DELAY_MS).default(DEFAULT_OPERATION_TIMEOUT_MS),
    bootstrapTimeoutMs: z.number().max(MAX_TIMER_DELAY_MS).default(DEFAULT_BOOTSTRAP_TIMEOUT_MS),
    terminateGraceMs: z.number().max(MAX_TIMER_DELAY_MS).default(DEFAULT_TERMINATE_GRACE_MS),
    maxOutputBytes: z.number().default(DEFAULT_MAX_OUTPUT_BYTES),
});
function executionBackend(confined) {
    const signatures = new Set(confined.runnerFailureRules
        .flatMap(rule => rule.fatalSignatures)
        .map(signature => signature.trim().toLowerCase()));
    if (process.platform === 'win32')
        return signatures.has('windows-acl-run:') ? 'windows-acl' : null;
    if (process.platform === 'darwin')
        return signatures.has('sandbox-exec:') ? 'seatbelt' : null;
    if (process.platform === 'linux') {
        if (signatures.has('bwrap:'))
            return 'bwrap';
        if (signatures.has('landlock-run:'))
            return 'landlock';
    }
    return null;
}
const FAILURE_MESSAGE = {
    'invalid-request': 'Check the account form and password, then try again.',
    'cancelled': 'The PandaData operation was cancelled.',
    'python-unavailable': 'Neither the configured Python launcher nor the managed Python installer is available.',
    'python-unsupported': 'PandaData requires Python 3.10 or newer.',
    'sdk-not-ready': 'Install the private PandaData runtime before signing in.',
    'sdk-version-mismatch': 'The active PandaData runtime does not match its activation record.',
    'bootstrap-failed': 'The private PandaData runtime could not be installed.',
    'release-unavailable': 'The official PandaData release index is unavailable or returned invalid metadata.',
    'update-not-available': 'The active PandaData SDK is already current.',
    'update-failed': 'The PandaData candidate failed verification; the active runtime was not changed.',
    'repair-failed': 'The replacement PandaData environment failed verification; the active runtime was not changed.',
    'rollback-unavailable': 'No verified previous PandaData environment is available.',
    'incompatible-api': 'The candidate PandaData SDK is missing APIs required by the active runtime or QuantSkills.',
    'login-failed': 'PandaData rejected the saved or supplied account credentials.',
    'data-validation-failed': 'PandaData login succeeded, but the required read-only data check failed.',
    'credential-cleanup-failed': 'PandaData login was not retained because the SDK credential file could not be removed.',
    'network-unavailable': 'PandaData could not be reached; saved credentials were retained for retry.',
    'logout-unsupported': 'The active PandaData SDK does not expose a reliable logout operation.',
    'logout-failed': 'PandaData sign-out failed; the connector remains connected.',
    'execution-unavailable': 'The PandaData runtime could not complete a confined read-only execution check on this host.',
    'worker-failed': 'The private PandaData worker returned an invalid response.',
};
function validateHttpURL(name, value, httpsOnly = false) {
    let url;
    try {
        url = new URL(value);
    }
    catch {
        throw new Error(`panda-connector: ${name} must be an HTTP(S) URL`);
    }
    if ((httpsOnly ? url.protocol !== 'https:' : url.protocol !== 'http:' && url.protocol !== 'https:')
        || url.username !== '' || url.password !== '' || url.hash !== '') {
        throw new Error(`panda-connector: ${name} must be a credential-free ${httpsOnly ? 'HTTPS' : 'HTTP(S)'} URL`);
    }
    return url.href.replace(/\/$/u, '');
}
function validateConfig(config) {
    if (config.pythonCommand.trim().length === 0)
        throw new Error('panda-connector: pythonCommand must be non-empty');
    if (config.pythonArgs.some(value => value.length === 0))
        throw new Error('panda-connector: pythonArgs entries must be non-empty');
    if (!/^[0-9]+\.[0-9]+$/u.test(config.managedPythonVersion))
        throw new Error('panda-connector: managedPythonVersion must be a major.minor release');
    for (const [key, value] of Object.entries({
        releaseTimeoutMs: config.releaseTimeoutMs,
        operationTimeoutMs: config.operationTimeoutMs,
        bootstrapTimeoutMs: config.bootstrapTimeoutMs,
        terminateGraceMs: config.terminateGraceMs,
        maxOutputBytes: config.maxOutputBytes,
    })) {
        if (!Number.isSafeInteger(value) || value <= 0)
            throw new Error(`panda-connector: ${key} must be a positive integer`);
    }
    const dshHome = resolveDshHome(config.dshHome);
    const managerRoot = resolve(dshHome, 'runtimes', 'pandadata');
    const activeVirtualEnvironment = process.env.VIRTUAL_ENV?.trim();
    return {
        worker: {
            pythonCommand: config.pythonCommand,
            pythonArgs: config.pythonArgs,
            projectRoot: PLUGIN_PROJECT_ROOT,
            ...(activeVirtualEnvironment === undefined || !isAbsolute(activeVirtualEnvironment)
                ? {}
                : { activeVirtualEnvironment }),
            runtimeManagerRoot: managerRoot,
            managedPythonVersion: config.managedPythonVersion,
            baseURL: validateHttpURL('baseURL', config.baseURL),
            operationTimeoutMs: config.operationTimeoutMs,
            bootstrapTimeoutMs: config.bootstrapTimeoutMs,
            terminateGraceMs: config.terminateGraceMs,
            maxOutputBytes: config.maxOutputBytes,
        },
        managerRoot,
        legacyRoot: resolve(dshHome, 'runtimes', `panda-data-${PANDA_DATA_VERSION}`),
        releaseIndexURL: validateHttpURL('releaseIndexURL', config.releaseIndexURL, true),
        releaseTimeoutMs: config.releaseTimeoutMs,
    };
}
/** Serialized PandaData lifecycle service exported through Typert Remote. */
let PandaConnector = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _describe_decorators;
    let _checkForUpdates_decorators;
    let _bootstrap_decorators;
    let _update_decorators;
    let _repair_decorators;
    let _rollback_decorators;
    let _login_decorators;
    let _logout_decorators;
    return class PandaConnector extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _describe_decorators = [Remote];
            _checkForUpdates_decorators = [Remote];
            _bootstrap_decorators = [Remote];
            _update_decorators = [Remote];
            _repair_decorators = [Remote];
            _rollback_decorators = [Remote];
            _login_decorators = [Remote];
            _logout_decorators = [Remote];
            __esDecorate(this, null, _describe_decorators, { kind: "method", name: "describe", static: false, private: false, access: { has: obj => "describe" in obj, get: obj => obj.describe }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _checkForUpdates_decorators, { kind: "method", name: "checkForUpdates", static: false, private: false, access: { has: obj => "checkForUpdates" in obj, get: obj => obj.checkForUpdates }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _bootstrap_decorators, { kind: "method", name: "bootstrap", static: false, private: false, access: { has: obj => "bootstrap" in obj, get: obj => obj.bootstrap }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _update_decorators, { kind: "method", name: "update", static: false, private: false, access: { has: obj => "update" in obj, get: obj => obj.update }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _repair_decorators, { kind: "method", name: "repair", static: false, private: false, access: { has: obj => "repair" in obj, get: obj => obj.repair }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _rollback_decorators, { kind: "method", name: "rollback", static: false, private: false, access: { has: obj => "rollback" in obj, get: obj => obj.rollback }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _login_decorators, { kind: "method", name: "login", static: false, private: false, access: { has: obj => "login" in obj, get: obj => obj.login }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _logout_decorators, { kind: "method", name: "logout", static: false, private: false, access: { has: obj => "logout" in obj, get: obj => obj.logout }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        static inject = inject;
        static Config = Config;
        runtime = __runInitializers(this, _instanceExtraInitializers);
        worker;
        credentialVault;
        lifecycle = new AbortController();
        operationTail = Promise.resolve();
        phase = 'not-ready';
        runtimeStatus = {
            active: null, previous: null, response: null, latestSdkVersion: null,
            updateAvailable: false, lastUpdateCheckedAt: null,
        };
        sessionCredential;
        credentialPersistence = 'unavailable';
        reconnectState = 'idle';
        dataReadiness = 'unchecked';
        validatedEnvironmentId;
        lastDataValidatedAt = null;
        executionReadiness = 'unchecked';
        executionIsolation = null;
        executionBackend = null;
        executionEnvironmentId;
        lastExecutionCheckedAt = null;
        executionEvidence = new Map();
        lastFailure = null;
        vaultAvailable = false;
        disposed = false;
        /**
         * Create the Host service and bind worker teardown to the Cordis scope.
         * @param ctx - Cordis context containing the subprocess capability.
         * @param config - resolved connector configuration.
         */
        constructor(ctx, config) {
            super(ctx, 'pandaConnector');
            const validated = validateConfig(config);
            this.worker = new PandaWorkerClient(ctx.subprocess, validated.worker);
            this.runtime = new PandaRuntimeManager(this.worker, {
                managerRoot: validated.managerRoot,
                legacyRoot: validated.legacyRoot,
                releaseIndexURL: validated.releaseIndexURL,
                releaseTimeoutMs: validated.releaseTimeoutMs,
                executionProbe: (environment, credential, signal) => this.probeEnvironment(environment, credential, signal),
            });
            this.credentialVault = createPandaCredentialVault();
            this.operationTail = this.restoreStoredCredential();
            ctx.effect(() => async () => this.disposeConnector(), 'panda-connector.worker-lifecycle');
        }
        /**
         * Return the exact connected runtime identity to freeze into a Session.
         * @returns immutable binding for the active verified environment.
         */
        runtimeBinding() {
            const active = this.runtimeStatus.active;
            if (this.phase !== 'connected' || active === null || this.sessionCredential === undefined)
                throw new PandaWorkerError('login-failed');
            if (this.dataReadiness !== 'verified' || this.validatedEnvironmentId !== active.id
                || this.executionReadiness !== 'ready' || this.executionEnvironmentId !== active.id) {
                throw new PandaWorkerError('execution-unavailable');
            }
            return Object.freeze({
                environmentId: active.id,
                sdkVersion: active.sdkVersion,
                pythonVersion: active.pythonVersion,
                apiFingerprint: active.apiFingerprint,
            });
        }
        /**
         * Verify that a Session-recorded environment remains retained and executable with Host credentials.
         * @param binding - exact runtime identity read from the Session log.
         */
        async validateRuntimeBinding(binding) {
            return this.serialize(async () => {
                const credential = this.sessionCredential;
                if (credential === undefined)
                    throw new PandaWorkerError('login-failed');
                const environment = await this.runtime.environment(binding.environmentId);
                if (environment === undefined
                    || environment.sdkVersion !== binding.sdkVersion
                    || environment.pythonVersion !== binding.pythonVersion
                    || environment.apiFingerprint !== binding.apiFingerprint) {
                    throw new PandaWorkerError('sdk-version-mismatch');
                }
                await this.probeEnvironment(environment, credential, this.operationSignal());
            });
        }
        /**
         * Execute one authorized script through the exact Session runtime and an available Host confinement backend.
         * @param request - immutable runtime identity and canonical Host-authorized paths.
         * @param signal - execution lifetime.
         * @returns bounded process outcome without credential material.
         */
        executePython(request, signal) {
            return this.serialize(async () => {
                const credential = this.sessionCredential;
                if (credential === undefined)
                    throw new PandaWorkerError('login-failed');
                const environment = await this.runtime.environment(request.binding.environmentId);
                if (environment === undefined
                    || environment.sdkVersion !== request.binding.sdkVersion
                    || environment.pythonVersion !== request.binding.pythonVersion
                    || environment.apiFingerprint !== request.binding.apiFingerprint) {
                    throw new PandaWorkerError('sdk-version-mismatch');
                }
                try {
                    return await this.worker.executeAt(environment.root, environment.sdkVersion, {
                        scriptPath: request.scriptPath,
                        args: request.args,
                        workdir: request.workdir,
                        account: credential.account,
                        password: credential.password,
                    }, argv => this.confineExecution(argv, request.workspaceRoot, request.sessionId).wrapped, this.operationSignal(signal));
                }
                catch (error) {
                    if (error instanceof PandaWorkerError)
                        throw error;
                    throw new PandaWorkerError('execution-unavailable');
                }
            });
        }
        /**
         * Inspect the active SDK and restore persisted authentication.
         * @param signal - Operation lifetime.
         * @returns Safe connector state.
         */
        describe(signal) {
            return this.execute('describe', () => this.runtime.describe(this.operationSignal(signal)), true);
        }
        /**
         * Discover the latest official SDK release without changing the active environment.
         * @param signal - Operation lifetime.
         * @returns Update metadata.
         */
        checkForUpdates(signal) {
            return this.execute('check-for-updates', () => this.runtime.checkForUpdates(this.operationSignal(signal)), true);
        }
        /**
         * Install the latest official SDK into a new private environment.
         * @param signal - Operation lifetime.
         * @returns Activated connector state.
         */
        bootstrap(signal) {
            return this.execute('bootstrap', () => this.runtime.bootstrap(this.operationSignal(signal), this.sessionCredential), true);
        }
        /**
         * Upgrade through candidate verification and pointer-only activation.
         * @param signal - Operation lifetime.
         * @returns Activated connector state.
         */
        update(signal) {
            return this.execute('update', () => this.runtime.update(this.candidateCredential(), this.operationSignal(signal)), true);
        }
        /**
         * Rebuild the active release without modifying the current environment in place.
         * @param signal - Operation lifetime.
         * @returns Repaired connector state.
         */
        repair(signal) {
            return this.execute('repair', () => this.runtime.repair(this.candidateCredential(), this.operationSignal(signal)), true);
        }
        /**
         * Restore the previously verified immutable environment.
         * @param signal - Operation lifetime.
         * @returns Rolled-back connector state.
         */
        rollback(signal) {
            return this.execute('rollback', () => this.runtime.rollback(this.candidateCredential(), this.operationSignal(signal)), true);
        }
        /**
         * Authenticate and retain replay material in the OS credential store when available.
         * @param request - explicit account form and write-only password.
         * @param signal - caller/connection lifetime.
         * @returns `connected` after the one-shot SDK login succeeds.
         */
        login(request, signal) {
            return this.serialize(async () => {
                if (typeof request.password !== 'string' || request.password.length === 0 || request.password.length > 4096)
                    return this.failure('invalid-request', 'login');
                try {
                    const account = normalizePandaAccount(request.account);
                    this.publish(await this.runtime.login(account, request.password, true, this.operationSignal(signal)));
                    const credential = {
                        schemaVersion: 1,
                        account,
                        password: request.password,
                    };
                    const active = this.runtimeStatus.active;
                    if (active === null)
                        throw new PandaWorkerError('sdk-not-ready');
                    await this.probeEnvironment(active, credential, this.operationSignal(signal));
                    this.sessionCredential = credential;
                    try {
                        await this.credentialVault.write(credential);
                        this.vaultAvailable = true;
                        this.credentialPersistence = 'os-keyring';
                    }
                    catch (error) {
                        if (!(error instanceof PandaCredentialVaultUnavailableError))
                            throw error;
                        this.vaultAvailable = false;
                        this.credentialPersistence = 'session-only';
                    }
                    this.reconnectState = 'idle';
                    this.lastFailure = null;
                    return this.success();
                }
                catch (error) {
                    const code = this.failureCode(error);
                    if (code === 'execution-unavailable' && this.sessionCredential === undefined)
                        this.phase = 'ready';
                    return this.failure(code, code === 'execution-unavailable' ? 'execution-check' : 'login');
                }
            });
        }
        /**
         * Clear Host-owned replay material and ask every retained SDK environment to log out.
         * @param signal - Operation lifetime.
         * @returns Verified disconnected state.
         */
        logout(signal) {
            return this.serialize(async () => {
                const persisted = this.credentialPersistence === 'os-keyring';
                this.sessionCredential = undefined;
                this.reconnectState = 'idle';
                let vaultFailure = false;
                if (persisted) {
                    try {
                        await this.credentialVault.delete();
                        this.vaultAvailable = true;
                    }
                    catch (error) {
                        if (!(error instanceof PandaCredentialVaultUnavailableError))
                            throw error;
                        this.vaultAvailable = false;
                        vaultFailure = true;
                    }
                }
                this.credentialPersistence = this.vaultAvailable ? 'os-keyring' : 'unavailable';
                try {
                    this.publish(await this.runtime.logout(this.operationSignal(signal)));
                }
                catch (error) {
                    this.phase = this.runtimeStatus.active === null ? 'not-ready' : 'ready';
                    return this.failure(vaultFailure ? 'logout-failed' : this.failureCode(error), 'logout');
                }
                this.phase = 'ready';
                this.dataReadiness = 'unchecked';
                this.validatedEnvironmentId = undefined;
                this.resetExecutionState();
                this.lastFailure = null;
                return vaultFailure ? this.failure('logout-failed', 'logout') : this.success();
            });
        }
        /** Abort active work and drain the serialized lifecycle queue. @returns settlement after all work has drained. */
        async disposeConnector() {
            if (this.disposed)
                return this.operationTail;
            this.disposed = true;
            this.lifecycle.abort(new Error('panda-connector disposed'));
            await this.operationTail;
        }
        execute(operationName, operation, replayCredential) {
            return this.serialize(async () => {
                try {
                    this.publish(await operation());
                    if (replayCredential) {
                        const replayFailure = await this.replayCredential();
                        if (replayFailure !== undefined) {
                            return this.failure(replayFailure, replayFailure === 'execution-unavailable' ? 'execution-check' : operationName);
                        }
                    }
                    if (operationName !== 'describe' && operationName !== 'check-for-updates')
                        this.lastFailure = null;
                    return this.success();
                }
                catch (error) {
                    const code = this.failureCode(error);
                    return this.failure(code, code === 'execution-unavailable' ? 'execution-check' : operationName);
                }
            });
        }
        candidateCredential() {
            if (this.sessionCredential === undefined)
                throw new PandaWorkerError('login-failed');
            return this.sessionCredential;
        }
        serialize(operation) {
            const run = this.operationTail.then(operation, operation);
            /* v8 ignore next -- Remote operations convert expected failures to results; this keeps programmer faults from poisoning the queue. */
            this.operationTail = run.then(() => undefined, () => undefined);
            return run;
        }
        operationSignal(caller) {
            return caller === undefined ? this.lifecycle.signal : AbortSignal.any([this.lifecycle.signal, caller]);
        }
        async restoreStoredCredential() {
            try {
                const credential = await this.credentialVault.read();
                this.vaultAvailable = true;
                this.credentialPersistence = 'os-keyring';
                if (credential === undefined || this.disposed)
                    return;
                this.sessionCredential = credential;
                const replayFailure = await this.replayCredential();
                if (replayFailure !== undefined)
                    this.recordFailure(replayFailure === 'execution-unavailable' ? 'execution-check' : 'login', replayFailure);
            }
            catch (error) {
                if (error instanceof PandaCredentialVaultUnavailableError) {
                    this.vaultAvailable = false;
                    this.credentialPersistence = 'unavailable';
                    return;
                }
                this.vaultAvailable = false;
                this.credentialPersistence = 'unavailable';
            }
        }
        async replayCredential() {
            const credential = this.sessionCredential;
            if (credential === undefined || this.disposed)
                return undefined;
            if (this.runtimeStatus.active === null) {
                try {
                    const described = await this.runtime.describe(this.operationSignal());
                    this.publish(described);
                }
                catch (error) {
                    const code = this.failureCode(error);
                    if (code === 'sdk-not-ready')
                        return undefined;
                    return code;
                }
            }
            if (this.runtimeStatus.active === null)
                return undefined;
            this.reconnectState = 'reconnecting';
            try {
                this.publish(await this.runtime.login(credential.account, credential.password, true, this.operationSignal()));
                const active = this.runtimeStatus.active;
                await this.probeEnvironment(active, credential, this.operationSignal());
                this.reconnectState = 'idle';
                return undefined;
            }
            catch (error) {
                const code = this.failureCode(error);
                if (code === 'login-failed') {
                    this.sessionCredential = undefined;
                    this.reconnectState = 'reauth-required';
                    try {
                        await this.credentialVault.delete();
                        this.vaultAvailable = true;
                        this.credentialPersistence = 'os-keyring';
                    }
                    catch (vaultError) {
                        if (!(vaultError instanceof PandaCredentialVaultUnavailableError))
                            throw vaultError;
                        this.vaultAvailable = false;
                        this.credentialPersistence = 'unavailable';
                    }
                }
                else {
                    this.reconnectState = 'idle';
                }
                if (code !== 'execution-unavailable')
                    this.phase = 'ready';
                return code;
            }
        }
        confineExecution(argv, workspaceRoot, sessionId) {
            const confined = this.ctx.sandbox.confine(argv, {
                mode: 'workspace-write',
                workspaceRoot,
                ...(sessionId === undefined ? {} : { sessionId }),
            });
            const backend = executionBackend(confined);
            if (backend === null)
                throw new PandaWorkerError('execution-unavailable');
            return {
                wrapped: { argv: confined.argv, runnerFailureRules: confined.runnerFailureRules },
                backend,
                isolation: confined.enforcement,
            };
        }
        async probeEnvironment(environment, credential, signal) {
            const compatibility = pandaSdkCompatibility(environment.sdkVersion);
            if (compatibility === undefined)
                throw new PandaWorkerError('incompatible-api');
            let probeRoot;
            let confinement;
            try {
                const createdProbeRoot = await mkdtemp(join(tmpdir(), 'dsh-panda-execution-'));
                probeRoot = createdProbeRoot;
                const scriptPath = join(createdProbeRoot, 'panda_execution_probe.py');
                await copyFile(EXECUTION_PROBE_SOURCE, scriptPath);
                const preparedConfinement = this.confineExecution(this.worker.executionArgv(environment.root), createdProbeRoot, undefined);
                confinement = preparedConfinement;
                const cached = this.findExecutionEvidence(environment, preparedConfinement.backend);
                if (cached !== undefined) {
                    this.applyExecutionEvidence(cached);
                    return;
                }
                if (this.runtimeStatus.active?.id === environment.id) {
                    this.executionReadiness = 'unavailable';
                    this.executionEnvironmentId = environment.id;
                    this.executionIsolation = preparedConfinement.isolation;
                    this.executionBackend = preparedConfinement.backend;
                    this.lastExecutionCheckedAt = Date.now();
                }
                const result = await this.worker.executeAt(environment.root, environment.sdkVersion, {
                    scriptPath,
                    args: [JSON.stringify(compatibility.validationCall)],
                    workdir: createdProbeRoot,
                    account: credential.account,
                    password: credential.password,
                }, () => preparedConfinement.wrapped, signal);
                const marker = result.stdout.split(/\r?\n/u).map(line => line.trim()).filter(Boolean).at(-1);
                if (result.exitCode !== 0 || marker !== EXECUTION_PROBE_SUCCESS) {
                    throw new PandaWorkerError('execution-unavailable');
                }
                const evidence = {
                    environmentId: environment.id,
                    apiFingerprint: environment.apiFingerprint,
                    backend: preparedConfinement.backend,
                    isolation: preparedConfinement.isolation,
                    checkedAt: Date.now(),
                };
                this.executionEvidence.set(this.executionEvidenceKey(evidence), evidence);
                this.applyExecutionEvidence(evidence);
            }
            catch (error) {
                if (this.runtimeStatus.active?.id === environment.id) {
                    this.executionReadiness = 'unavailable';
                    this.executionEnvironmentId = environment.id;
                    this.executionIsolation = confinement?.isolation ?? null;
                    this.executionBackend = confinement?.backend ?? null;
                    this.lastExecutionCheckedAt = Date.now();
                }
                if (error instanceof PandaWorkerError && error.code === 'cancelled')
                    throw error;
                throw new PandaWorkerError('execution-unavailable');
            }
            finally {
                if (probeRoot !== undefined) {
                    try {
                        await rm(probeRoot, { recursive: true, force: true });
                    }
                    catch {
                        /* The probe workspace contains only the public script; cleanup failure must not replace execution evidence. */
                    }
                }
            }
        }
        executionEvidenceKey(evidence) {
            return `${evidence.environmentId}\0${evidence.apiFingerprint}\0${evidence.backend}`;
        }
        findExecutionEvidence(environment, backend) {
            return this.executionEvidence.get(this.executionEvidenceKey({
                environmentId: environment.id,
                apiFingerprint: environment.apiFingerprint,
                backend,
            }));
        }
        latestExecutionEvidence(environment) {
            return [...this.executionEvidence.values()]
                .filter(evidence => evidence.environmentId === environment.id && evidence.apiFingerprint === environment.apiFingerprint)
                .sort((left, right) => right.checkedAt - left.checkedAt)[0];
        }
        applyExecutionEvidence(evidence) {
            if (this.runtimeStatus.active?.id !== evidence.environmentId)
                return;
            this.executionReadiness = 'ready';
            this.executionEnvironmentId = evidence.environmentId;
            this.executionIsolation = evidence.isolation;
            this.executionBackend = evidence.backend;
            this.lastExecutionCheckedAt = evidence.checkedAt;
        }
        resetExecutionState() {
            this.executionReadiness = 'unchecked';
            this.executionEnvironmentId = undefined;
            this.executionIsolation = null;
            this.executionBackend = null;
            this.lastExecutionCheckedAt = null;
        }
        publish(status) {
            /* v8 ignore next -- Worker completion rejects after lifecycle abort; this guard protects later implementation changes. */
            if (this.disposed)
                return;
            this.runtimeStatus = status;
            const response = status.response;
            const activeId = status.active?.id;
            if (response?.dataValidated === true && activeId !== undefined) {
                this.validatedEnvironmentId = activeId;
                this.dataReadiness = 'verified';
                this.lastDataValidatedAt = Date.now();
            }
            else if (activeId !== this.validatedEnvironmentId) {
                this.validatedEnvironmentId = undefined;
                this.dataReadiness = 'unchecked';
                this.lastDataValidatedAt = null;
            }
            const activeEvidence = status.active === null ? undefined : this.latestExecutionEvidence(status.active);
            if (activeEvidence !== undefined)
                this.applyExecutionEvidence(activeEvidence);
            else if (activeId !== this.executionEnvironmentId)
                this.resetExecutionState();
            if (status.active === null || response?.installedSdkVersion !== status.active.sdkVersion)
                this.phase = 'not-ready';
            else
                this.phase = response.authenticated ? 'connected' : 'ready';
        }
        state() {
            const active = this.runtimeStatus.active;
            return {
                phase: this.phase,
                credentialPersistence: this.credentialPersistence,
                reconnectState: this.reconnectState,
                dataReadiness: this.dataReadiness,
                lastDataValidatedAt: this.lastDataValidatedAt,
                executionReadiness: this.executionReadiness,
                executionIsolation: this.executionIsolation,
                executionBackend: this.executionBackend,
                lastExecutionCheckedAt: this.lastExecutionCheckedAt,
                lastFailure: this.lastFailure,
                requiredSdkVersion: this.runtimeStatus.latestSdkVersion ?? active?.sdkVersion ?? PANDA_DATA_VERSION,
                installedSdkVersion: active?.sdkVersion ?? null,
                latestSdkVersion: this.runtimeStatus.latestSdkVersion,
                updateAvailable: this.runtimeStatus.updateAvailable,
                rollbackSdkVersion: this.runtimeStatus.previous?.sdkVersion ?? null,
                pythonVersion: active?.pythonVersion ?? null,
                pythonSource: active?.pythonSource ?? null,
                apiFingerprint: active?.apiFingerprint ?? null,
                capabilities: active?.capabilities ?? null,
                lastUpdateCheckedAt: this.runtimeStatus.lastUpdateCheckedAt,
                logoutSupported: this.runtimeStatus.response?.logoutSupported ?? false,
            };
        }
        success() {
            return { ok: true, state: this.state() };
        }
        failure(code, operation) {
            this.recordFailure(operation, code);
            if (operation === 'login' && (code === 'data-validation-failed' || code === 'network-unavailable')) {
                this.dataReadiness = 'unavailable';
            }
            return { ok: false, code, message: FAILURE_MESSAGE[code], state: this.state() };
        }
        recordFailure(operation, code) {
            this.lastFailure = { operation, code, occurredAt: Date.now() };
        }
        failureCode(error) {
            if (error instanceof PandaAccountError)
                return 'invalid-request';
            if (error instanceof PandaWorkerError)
                return error.code;
            return 'worker-failed';
        }
    };
})();
export { PandaConnector };
export default PandaConnector;
//# sourceMappingURL=index.js.map