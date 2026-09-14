/** Private PandaData worker process client. */
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ManagedUvError, resolveManagedUv } from "./managed-uv.js";
/** Legacy SDK release eligible for first-run environment adoption. */
export const PANDA_DATA_VERSION = '0.0.12';
const WORKER_FAILURE_CODES = new Set([
    'invalid-request', 'cancelled', 'python-unavailable', 'python-unsupported',
    'sdk-not-ready', 'sdk-version-mismatch', 'bootstrap-failed', 'release-unavailable',
    'update-not-available', 'update-failed', 'repair-failed', 'rollback-unavailable',
    'incompatible-api', 'login-failed', 'network-unavailable',
    'data-validation-failed',
    'credential-cleanup-failed',
    'logout-unsupported', 'logout-failed', 'execution-unavailable', 'worker-failed',
]);
function isRunnerFailure(exitCode, stderr, rules) {
    if (exitCode === 0)
        return false;
    for (const rule of rules) {
        if (rule.allowedExitCodes !== undefined && !rule.allowedExitCodes.includes(exitCode))
            continue;
        const informationalLines = new Set((rule.informationalLines ?? []).map(line => line.toLowerCase()));
        const fatalSignatures = rule.fatalSignatures.map(signature => signature.trim().toLowerCase()).filter(Boolean);
        for (const line of stderr.split(/\r?\n/u)) {
            const lowered = line.toLowerCase();
            if (informationalLines.has(lowered))
                continue;
            if (fatalSignatures.some(signature => lowered.includes(signature)))
                return true;
        }
    }
    return false;
}
/** Fixed worker failure; stdout, stderr, exception text, and credentials stay private. */
export class PandaWorkerError extends Error {
    code;
    /**
     * Create a redacted worker failure.
     * @param code - closed failure identifier safe to return through Remote.
     */
    constructor(code) {
        super('The PandaData worker operation failed.');
        this.code = code;
        this.name = 'PandaWorkerError';
    }
}
function isCapabilities(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const record = value;
    return typeof record.authentication === 'boolean'
        && typeof record.marketData === 'boolean'
        && typeof record.indexData === 'boolean'
        && typeof record.marginData === 'boolean';
}
function isWorkerResponse(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const record = value;
    return typeof record.ok === 'boolean'
        && (typeof record.installedSdkVersion === 'string' || record.installedSdkVersion === null)
        && typeof record.logoutSupported === 'boolean'
        && typeof record.authenticated === 'boolean'
        && typeof record.dataValidated === 'boolean'
        && (typeof record.pythonVersion === 'string' || record.pythonVersion === null)
        && (record.pythonSource === 'configured' || record.pythonSource === 'uv-managed')
        && Array.isArray(record.publicCallables)
        && record.publicCallables.every(value => typeof value === 'string')
        && (typeof record.apiFingerprint === 'string' || record.apiFingerprint === null)
        && (record.capabilities === null || isCapabilities(record.capabilities))
        && (record.code === undefined
            || (typeof record.code === 'string' && WORKER_FAILURE_CODES.has(record.code)));
}
function privatePython(runtimeRoot) {
    return process.platform === 'win32'
        ? join(runtimeRoot, 'Scripts', 'python.exe')
        : join(runtimeRoot, 'bin', 'python');
}
function virtualEnvironmentPython(root) {
    return process.platform === 'win32'
        ? join(root, 'Scripts', 'python.exe')
        : join(root, 'bin', 'python');
}
function configuredPythonCandidates(config) {
    const candidates = [];
    if (isAbsolute(config.pythonCommand)) {
        candidates.push({ command: config.pythonCommand, args: config.pythonArgs });
    }
    if (config.activeVirtualEnvironment !== undefined) {
        candidates.push({ command: virtualEnvironmentPython(config.activeVirtualEnvironment), args: [] });
    }
    for (const name of ['.venv', '.ven', 'venv']) {
        candidates.push({ command: virtualEnvironmentPython(join(config.projectRoot, name)), args: [] });
    }
    if (!isAbsolute(config.pythonCommand)) {
        candidates.push({ command: config.pythonCommand, args: config.pythonArgs });
    }
    const seen = new Set();
    return candidates.filter(({ command }) => {
        const key = process.platform === 'win32' ? command.toLowerCase() : command;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
function operationFailure(operation) {
    if (operation === 'bootstrap')
        return 'bootstrap-failed';
    if (operation === 'login')
        return 'login-failed';
    if (operation === 'logout')
        return 'logout-failed';
    return 'worker-failed';
}
/** One-shot stdin client for the bundled Python worker. */
export class PandaWorkerClient {
    subprocess;
    config;
    workerPath = fileURLToPath(new URL('../worker/panda_worker.py', import.meta.url));
    runnerPath = fileURLToPath(new URL('../worker/panda_runner.py', import.meta.url));
    configuredPython;
    managedPython;
    /**
     * Create a worker client over the Host subprocess capability.
     * @param subprocess - process-tree runtime or a test double.
     * @param config - validated private-runtime configuration.
     */
    constructor(subprocess, config) {
        this.subprocess = subprocess;
        this.config = config;
    }
    /**
     * Inspect one immutable private environment.
     * @param runtimeRoot - absolute environment directory.
     * @param sdkVersion - exact SDK release expected in the environment.
     * @param pythonSource - interpreter origin recorded for the environment.
     * @param signal - operation lifetime.
     * @returns validated worker response.
     */
    async describeAt(runtimeRoot, sdkVersion, pythonSource, signal) {
        const launcher = existsSync(privatePython(runtimeRoot))
            ? { executable: privatePython(runtimeRoot), args: [] }
            : await this.resolveConfiguredPython(this.operationSignal(signal, this.config.operationTimeoutMs));
        return this.run({ operation: 'describe', requiredSdkVersion: sdkVersion, runtimeRoot, pythonSource }, launcher.executable, launcher.args, signal);
    }
    /**
     * Create one candidate environment and install an exact, hash-verified SDK wheel.
     * @param runtimeRoot - new immutable environment directory.
     * @param sdkVersion - exact SDK release to install.
     * @param wheelURL - official wheel URL selected from the release index.
     * @param wheelSha256 - expected wheel SHA-256 digest.
     * @param signal - operation lifetime.
     * @returns verified candidate response.
     */
    async bootstrapAt(runtimeRoot, sdkVersion, wheelURL, wheelSha256, signal) {
        try {
            const launcher = await this.resolveConfiguredPython(this.operationSignal(signal, this.config.bootstrapTimeoutMs));
            return await this.run({
                operation: 'bootstrap', requiredSdkVersion: sdkVersion, runtimeRoot,
                pythonSource: 'configured',
                ...(wheelURL === undefined ? {} : { wheelURL }),
                ...(wheelSha256 === undefined ? {} : { wheelSha256 }),
            }, launcher.executable, launcher.args, signal);
        }
        catch (error) {
            if (!(error instanceof PandaWorkerError)
                || (error.code !== 'python-unavailable' && error.code !== 'python-unsupported'))
                throw error;
            const launcher = await this.resolveManagedPython(this.operationSignal(signal, this.config.bootstrapTimeoutMs));
            return this.run({
                operation: 'bootstrap', requiredSdkVersion: sdkVersion, runtimeRoot,
                pythonSource: 'uv-managed',
                ...(wheelURL === undefined ? {} : { wheelURL }),
                ...(wheelSha256 === undefined ? {} : { wheelSha256 }),
            }, launcher, [], signal);
        }
    }
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
    loginAt(runtimeRoot, sdkVersion, pythonSource, account, password, validationCall, signal) {
        return this.run({
            operation: 'login', requiredSdkVersion: sdkVersion, runtimeRoot, pythonSource,
            baseURL: this.config.baseURL, accountKind: account.kind, login: account.login, password,
            ...(validationCall === undefined ? {} : { validationCall }),
        }, privatePython(runtimeRoot), [], signal);
    }
    /**
     * Clear authentication inside one retained environment.
     * @param runtimeRoot - environment directory.
     * @param sdkVersion - installed SDK release.
     * @param pythonSource - interpreter origin recorded for the environment.
     * @param signal - operation lifetime.
     * @returns validated worker response.
     */
    logoutAt(runtimeRoot, sdkVersion, pythonSource, signal) {
        return this.run({ operation: 'logout', requiredSdkVersion: sdkVersion, runtimeRoot, pythonSource }, privatePython(runtimeRoot), [], signal);
    }
    /**
     * Return the exact private runner invocation that the sandbox must wrap.
     * @param runtimeRoot - exact retained environment directory.
     * @returns Python runner argv without credential material.
     */
    executionArgv(runtimeRoot) {
        return [privatePython(runtimeRoot), '-I', this.runnerPath];
    }
    /**
     * Execute one workspace-authorized script in an exact immutable runtime.
     * @param runtimeRoot - exact retained environment directory.
     * @param sdkVersion - exact SDK version recorded by the Session.
     * @param request - validated script paths, args, and Host-owned replay material.
     * @param argvWrapper - sandbox wrapper and runner-failure rules applied before spawn.
     * @param signal - execution lifetime.
     * @returns bounded stdout, stderr, and exit status.
     */
    async executeAt(runtimeRoot, sdkVersion, request, argvWrapper, signal) {
        const active = this.operationSignal(signal, this.config.bootstrapTimeoutMs);
        const wrapped = argvWrapper(this.executionArgv(runtimeRoot));
        let handle;
        try {
            handle = this.subprocess.spawn({
                argv: wrapped.argv,
                cwd: request.workdir,
                env: { PYTHONNOUSERSITE: '1', PYTHONUTF8: '1' },
                stdio: {
                    stdin: {
                        data: JSON.stringify({
                            requiredSdkVersion: sdkVersion,
                            baseURL: this.config.baseURL,
                            accountKind: request.account.kind,
                            login: request.account.login,
                            password: request.password,
                            scriptPath: request.scriptPath,
                            args: request.args,
                            workdir: request.workdir,
                        }),
                    },
                    stdout: { maxBytes: this.config.maxOutputBytes },
                    stderr: { maxBytes: this.config.maxOutputBytes },
                },
                graceMs: this.config.terminateGraceMs,
                signal: active,
            });
        }
        catch {
            throw new PandaWorkerError(active.aborted ? 'cancelled' : 'execution-unavailable');
        }
        try {
            const outcome = await handle.done;
            await handle.waitForExit();
            if (active.aborted)
                throw new PandaWorkerError('cancelled');
            const stdout = handle.collected.stdout?.readFrom(0);
            const stderr = handle.collected.stderr?.readFrom(0);
            if (stdout?.lossy === true || stderr?.lossy === true)
                throw new PandaWorkerError('worker-failed');
            const exitCode = outcome.exitCode ?? 1;
            if (isRunnerFailure(exitCode, stderr?.text ?? '', wrapped.runnerFailureRules)) {
                throw new PandaWorkerError('execution-unavailable');
            }
            return {
                exitCode,
                stdout: stdout?.text ?? '',
                stderr: stderr?.text ?? '',
            };
        }
        catch (error) {
            if (active.aborted) {
                handle.terminate();
                await handle.waitForExit();
                throw new PandaWorkerError('cancelled');
            }
            if (error instanceof PandaWorkerError)
                throw error;
            throw new PandaWorkerError('execution-unavailable');
        }
    }
    operationSignal(caller, timeoutMs) {
        const timeout = AbortSignal.timeout(timeoutMs);
        return caller === undefined ? timeout : AbortSignal.any([caller, timeout]);
    }
    async resolveConfiguredPython(signal) {
        this.configuredPython ??= this.findConfiguredPython(signal);
        try {
            return await this.configuredPython;
        }
        catch (error) {
            this.configuredPython = undefined;
            throw error;
        }
    }
    async findConfiguredPython(signal) {
        for (const candidate of configuredPythonCandidates(this.config)) {
            try {
                const executable = await this.subprocess.resolveExecutable(candidate.command, undefined, signal);
                return { executable, args: candidate.args };
            }
            catch {
                // An unavailable candidate delegates to the next bounded local launcher.
            }
        }
        throw new PandaWorkerError('python-unavailable');
    }
    async resolveManagedPython(signal) {
        this.managedPython ??= this.installManagedPython(signal);
        try {
            return await this.managedPython;
        }
        catch (error) {
            this.managedPython = undefined;
            throw error;
        }
    }
    async installManagedPython(signal) {
        let uv;
        try {
            uv = await resolveManagedUv(this.config.runtimeManagerRoot, signal);
        }
        catch (error) {
            if (!(error instanceof ManagedUvError))
                throw error;
            throw new PandaWorkerError('python-unavailable');
        }
        const env = {
            UV_PYTHON_INSTALL_DIR: join(this.config.runtimeManagerRoot, 'python'),
            UV_CACHE_DIR: join(this.config.runtimeManagerRoot, 'uv-cache'),
        };
        await this.runUtility([uv, 'python', 'install', this.config.managedPythonVersion, '--python-preference', 'only-managed'], env, signal, false);
        const result = await this.runUtility([uv, 'python', 'find', this.config.managedPythonVersion, '--python-preference', 'only-managed'], env, signal, true);
        const executable = result.trim();
        if (executable === '')
            throw new PandaWorkerError('python-unavailable');
        return executable;
    }
    async runUtility(argv, env, signal, collect) {
        const handle = this.subprocess.spawn({
            argv, cwd: this.config.runtimeManagerRoot, env,
            stdio: {
                stdin: 'ignore',
                stdout: { maxBytes: collect ? this.config.maxOutputBytes : 1_024 },
                stderr: { maxBytes: 1_024 },
            },
            graceMs: this.config.terminateGraceMs, signal,
        });
        try {
            const outcome = await handle.done;
            await handle.waitForExit();
            if (signal.aborted || outcome.exitCode !== 0 || outcome.signal !== null)
                throw new PandaWorkerError('python-unavailable');
            if (!collect)
                return '';
            const output = handle.collected.stdout?.readFrom(0);
            if (output === undefined || output.lossy)
                throw new PandaWorkerError('python-unavailable');
            return output.text;
        }
        catch (error) {
            if (signal.aborted) {
                handle.terminate();
                await handle.waitForExit();
            }
            if (error instanceof PandaWorkerError)
                throw error;
            throw new PandaWorkerError('python-unavailable');
        }
    }
    async run(request, launcher, launcherArgs, callerSignal) {
        const timeoutMs = request.operation === 'bootstrap' ? this.config.bootstrapTimeoutMs : this.config.operationTimeoutMs;
        const signal = this.operationSignal(callerSignal, timeoutMs);
        const handle = this.subprocess.spawn({
            argv: [launcher, ...launcherArgs, '-I', this.workerPath],
            cwd: dirname(this.workerPath), env: { PYTHONNOUSERSITE: '1', PYTHONUTF8: '1' },
            stdio: {
                stdin: { data: JSON.stringify(request) },
                stdout: { maxBytes: this.config.maxOutputBytes }, stderr: { maxBytes: this.config.maxOutputBytes },
            },
            graceMs: this.config.terminateGraceMs, signal,
        });
        try {
            const outcome = await handle.done;
            await handle.waitForExit();
            if (signal.aborted)
                throw new PandaWorkerError('cancelled');
            if (outcome.exitCode !== 0 || outcome.signal !== null)
                throw new PandaWorkerError(operationFailure(request.operation));
            const output = handle.collected.stdout?.readFrom(0);
            if (output === undefined || output.lossy)
                throw new PandaWorkerError('worker-failed');
            let decoded;
            try {
                decoded = JSON.parse(output.text);
            }
            catch {
                throw new PandaWorkerError('worker-failed');
            }
            if (!isWorkerResponse(decoded))
                throw new PandaWorkerError('worker-failed');
            if (!decoded.ok)
                throw new PandaWorkerError(decoded.code ?? operationFailure(request.operation));
            if (request.operation !== 'describe' && decoded.installedSdkVersion !== request.requiredSdkVersion)
                throw new PandaWorkerError('sdk-version-mismatch');
            return decoded;
        }
        catch (error) {
            if (signal.aborted) {
                handle.terminate();
                await handle.waitForExit();
                throw new PandaWorkerError('cancelled');
            }
            if (error instanceof PandaWorkerError)
                throw error;
            throw new PandaWorkerError(operationFailure(request.operation));
        }
    }
}
//# sourceMappingURL=worker.js.map