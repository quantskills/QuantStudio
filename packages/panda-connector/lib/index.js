import { chmod, copyFile, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import z from "@deepseek-ai/schemastery";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { MAX_TIMER_DELAY_MS } from "@deepseek-ai/dsh-timeout";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { unzipSync } from "fflate";
import { extract } from "tar";
//#region lib/types/account.js
/** PandaData account validation and normalization. */
const VISUAL_PHONE_SEPARATOR = /[\s()-]/g;
const COUNTRY_CALLING_CODE = /^\+?[1-9]\d{0,2}$/;
const NATIONAL_NUMBER = /^\d{4,14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Fixed account-validation error which never includes the rejected value. */
var PandaAccountError = class extends Error {
	constructor() {
		super("The PandaData account is invalid.");
		this.name = "PandaAccountError";
	}
};
function nonBlank(value) {
	const normalized = value.trim();
	if (normalized.length === 0 || normalized.length > 320) throw new PandaAccountError();
	return normalized;
}
function assertNever(_value) {
	throw new PandaAccountError();
}
/**
* Normalize an explicit account form. Only `phone` receives the `+86` default;
* email and username values are never prefixed or otherwise reinterpreted.
* @param account - typed account form from the Remote request.
* @returns the SDK login value and its original account kind.
*/
function normalizePandaAccount(account) {
	switch (account.kind) {
		case "phone": {
			const rawCode = (account.countryCallingCode ?? "+86").trim();
			const withoutInternationalPrefix = rawCode.startsWith("00") ? rawCode.slice(2) : rawCode;
			if (!COUNTRY_CALLING_CODE.test(withoutInternationalPrefix)) throw new PandaAccountError();
			const code = `+${withoutInternationalPrefix.replace(/^\+/, "")}`;
			const nationalNumber = account.nationalNumber.replace(VISUAL_PHONE_SEPARATOR, "");
			if (!NATIONAL_NUMBER.test(nationalNumber) || code.length + nationalNumber.length > 16) throw new PandaAccountError();
			return {
				kind: "phone",
				login: `${code}${nationalNumber}`
			};
		}
		case "email": {
			const email = nonBlank(account.email);
			if (!EMAIL.test(email)) throw new PandaAccountError();
			return {
				kind: "email",
				login: email
			};
		}
		case "username": return {
			kind: "username",
			login: nonBlank(account.username)
		};
		default: return assertNever(account);
	}
}
//#endregion
//#region lib/types/credential-vault.js
/** OS-backed PandaData credential persistence kept private to the connector. */
const KEYRING_SERVICE = "DeepSeek Harness QuantSkills PandaData";
const KEYRING_ACCOUNT = "default";
const STORED_CREDENTIAL_SCHEMA_VERSION = 1;
/** Fixed failure that never includes native keyring diagnostics or credential material. */
var PandaCredentialVaultUnavailableError = class extends Error {
	constructor() {
		super("The operating-system credential store is unavailable.");
		this.name = "PandaCredentialVaultUnavailableError";
	}
};
function isRecord$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function decodeStoredCredential(raw) {
	let value;
	try {
		value = JSON.parse(raw);
	} catch {
		return;
	}
	if (!isRecord$1(value) || value.schemaVersion !== STORED_CREDENTIAL_SCHEMA_VERSION || !isRecord$1(value.account) || typeof value.account.login !== "string" || value.account.login.length === 0 || value.account.login.length > 320 || value.account.kind !== "phone" && value.account.kind !== "email" && value.account.kind !== "username" || typeof value.password !== "string" || value.password.length === 0 || value.password.length > 4096) return;
	return {
		schemaVersion: STORED_CREDENTIAL_SCHEMA_VERSION,
		account: {
			kind: value.account.kind,
			login: value.account.login
		},
		password: value.password
	};
}
/** Native OS keyring implementation loaded lazily so unsupported hosts can use memory-only login. */
var PandaOsCredentialVault = class {
	loadKeyring;
	entryPromise;
	/**
	* @param loadKeyring - lazy native-module loader; replaceable in isolated tests.
	*/
	constructor(loadKeyring = async () => import("@napi-rs/keyring")) {
		this.loadKeyring = loadKeyring;
	}
	/** @returns whether an OS keyring read succeeds. */
	async status() {
		try {
			await (await this.entry()).getPassword();
			return "available";
		} catch {
			return "unavailable";
		}
	}
	/** @returns the validated stored credential or `undefined`. */
	async read() {
		let entry;
		let raw;
		try {
			entry = await this.entry();
			raw = await entry.getPassword();
		} catch {
			throw new PandaCredentialVaultUnavailableError();
		}
		if (raw === void 0) return void 0;
		const value = decodeStoredCredential(raw);
		if (value !== void 0) return value;
		try {
			await entry.deletePassword();
		} catch {
			throw new PandaCredentialVaultUnavailableError();
		}
	}
	/** @param value - normalized account and write-only password. */
	async write(value) {
		try {
			await (await this.entry()).setPassword(JSON.stringify(value));
		} catch {
			throw new PandaCredentialVaultUnavailableError();
		}
	}
	/** Delete the underlying OS credential. */
	async delete() {
		try {
			await (await this.entry()).deletePassword();
		} catch {
			throw new PandaCredentialVaultUnavailableError();
		}
	}
	entry() {
		this.entryPromise ??= this.loadKeyring().then((module) => new module.AsyncEntry(KEYRING_SERVICE, KEYRING_ACCOUNT));
		return this.entryPromise.catch((error) => {
			this.entryPromise = void 0;
			throw error;
		});
	}
};
/**
* Create the connector-owned lazy native credential vault.
* @returns the connector's lazy native credential vault.
*/
function createPandaCredentialVault() {
	return new PandaOsCredentialVault();
}
//#endregion
//#region lib/types/compatibility.js
/** Audited PandaData SDK releases accepted by the QuantSkills plugin. */
const REQUIRED_CALLABLES = Object.freeze([
	"get_index_indicator",
	"get_index_weights",
	"get_margin",
	"get_market_data",
	"init_token",
	"is_authenticated"
]);
const MARKET_DATA_VALIDATION = Object.freeze({
	callable: "get_market_data",
	keywordArguments: Object.freeze({
		symbol: "000001.SZ",
		start_date: "20250102",
		end_date: "20250102",
		type: "stock"
	})
});
/** Fixed compatibility matrix; PyPI discovery can only select one of these exact wheels. */
const PANDA_SDK_COMPATIBILITY = Object.freeze([Object.freeze({
	version: "0.0.12",
	wheelURL: "https://files.pythonhosted.org/packages/91/b9/1660487a9f559925231091f4c88aac6d572e7c3e84b0ad9a372d8261f298/panda_data-0.0.12-py3-none-any.whl",
	wheelSha256: "b657a17daed0a11794e85e37e0d917ce42c77516fea7af0fc8977d54674b75b8",
	pythonMin: [3, 10],
	pythonMaxExclusive: [3, 13],
	requiredCallables: REQUIRED_CALLABLES,
	validationCall: MARKET_DATA_VALIDATION
}), Object.freeze({
	version: "0.0.14",
	wheelURL: "https://files.pythonhosted.org/packages/9e/c3/f074910e8e7809a2abc6d60124a4a4e4dd196e0bd2159416a41e30fd0c60/panda_data-0.0.14-py3-none-any.whl",
	wheelSha256: "514a50da95992aeb52ba53332ba825dd0dfd66c0793f59b6025f4e97ba6c2b59",
	pythonMin: [3, 10],
	pythonMaxExclusive: [3, 13],
	requiredCallables: REQUIRED_CALLABLES,
	validationCall: MARKET_DATA_VALIDATION
})]);
/**
* Resolve one exact supported SDK release.
* @param version - release selected from the compatibility matrix.
* @returns the immutable compatibility entry, or `undefined` when unsupported.
*/
function pandaSdkCompatibility(version) {
	return PANDA_SDK_COMPATIBILITY.find((entry) => entry.version === version);
}
//#endregion
//#region lib/types/managed-uv.js
/** Pinned, checksum-verified uv binary provisioning for managed PandaData Python. */
const UV_VERSION = "0.12.5";
const UV_RELEASE_ROOT = `https://releases.astral.sh/github/uv/releases/download/${UV_VERSION}`;
const UV_ARCHIVE_LIMIT = 80 * 1024 * 1024;
/** Pinned uv download, verification, or extraction failure. */
var ManagedUvError = class extends Error {
	name = "ManagedUvError";
};
const UV_ARCHIVES = Object.freeze({
	"win32-x64": Object.freeze({
		name: "uv-x86_64-pc-windows-msvc.zip",
		sha256: "4c4d49d8738847d9b71ba319e49a5688c93eac0fe6204b1df24e98528dddf39a",
		kind: "zip"
	}),
	"win32-arm64": Object.freeze({
		name: "uv-aarch64-pc-windows-msvc.zip",
		sha256: "724279317fee6e5fa8ad1908e4eba2bbe764ef1ece5b3f4597927b62b1fe562a",
		kind: "zip"
	}),
	"darwin-x64": Object.freeze({
		name: "uv-x86_64-apple-darwin.tar.gz",
		sha256: "b3b2137477cf96c9686ebfb71524614cec780c673fd73e59bce099aef02e70e8",
		kind: "tar.gz"
	}),
	"darwin-arm64": Object.freeze({
		name: "uv-aarch64-apple-darwin.tar.gz",
		sha256: "5bb0e5fe008a773c3dbcb97ff79cd89e1241464fe9d2f986d52ad8f1b037bd62",
		kind: "tar.gz"
	}),
	"linux-x64-gnu": Object.freeze({
		name: "uv-x86_64-unknown-linux-gnu.tar.gz",
		sha256: "68a509da24b06b4223a1c0175fb5eb5bc79342b76cbeff0cfe51ac3f5b17b6b2",
		kind: "tar.gz"
	}),
	"linux-arm64-gnu": Object.freeze({
		name: "uv-aarch64-unknown-linux-gnu.tar.gz",
		sha256: "9bf43b4d1a07665bf64d4c4e710930b382321a785e0eb10aac07f46471f86a31",
		kind: "tar.gz"
	}),
	"linux-x64-musl": Object.freeze({
		name: "uv-x86_64-unknown-linux-musl.tar.gz",
		sha256: "a4742988791c9aeae68c78150d6cba762062ad2a47e53738c2779d2b596bfcdb",
		kind: "tar.gz"
	}),
	"linux-arm64-musl": Object.freeze({
		name: "uv-aarch64-unknown-linux-musl.tar.gz",
		sha256: "8767a0e77f2cd45436401b1b42bf7e9ed5a4a91a74a5305d6fe93249d0f6dbc5",
		kind: "tar.gz"
	})
});
function platformKey() {
	if (process.platform !== "linux") return `${process.platform}-${process.arch}`;
	const report = process.report.getReport();
	return `linux-${process.arch}-${report.header?.glibcVersionRuntime === void 0 ? "musl" : "gnu"}`;
}
async function boundedDownload(url, signal) {
	const response = await fetch(url, {
		headers: { accept: "application/octet-stream" },
		signal
	});
	if (!response.ok || response.body === null) throw new ManagedUvError("uv download failed");
	const contentLength = Number(response.headers.get("content-length"));
	if (Number.isFinite(contentLength) && contentLength > UV_ARCHIVE_LIMIT) throw new ManagedUvError("uv archive exceeds the download limit");
	const chunks = [];
	let bytes = 0;
	const reader = response.body.getReader();
	for (;;) {
		const chunk = await reader.read();
		if (chunk.done) break;
		bytes += chunk.value.byteLength;
		if (bytes > UV_ARCHIVE_LIMIT) throw new ManagedUvError("uv archive exceeds the download limit");
		chunks.push(chunk.value);
	}
	const output = new Uint8Array(bytes);
	let offset = 0;
	for (const chunk of chunks) {
		output.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return output;
}
async function executableAt(path) {
	try {
		const info = await lstat(path);
		return info.isFile() && !info.isSymbolicLink();
	} catch {
		return false;
	}
}
async function removeOwnedStage(managerRoot, stage) {
	const root = resolve(managerRoot);
	const target = resolve(stage);
	const child = relative(root, target);
	if (child === "" || child.startsWith("..") || isAbsolute(child)) throw new Error("panda-connector: refused to remove a uv staging path outside the runtime root");
	await rm(target, {
		recursive: true,
		force: true
	});
}
/**
* Install or reuse the pinned uv binary for this operating system and architecture.
* @param managerRoot - connector-owned PandaData runtime root.
* @param signal - download and extraction lifetime.
* @returns absolute executable path without modifying PATH or shell profiles.
*/
async function resolveManagedUv(managerRoot, signal) {
	const key = platformKey();
	const archive = UV_ARCHIVES[key];
	if (archive === void 0) throw new ManagedUvError("uv has no pinned artifact for this platform");
	const executableName = process.platform === "win32" ? "uv.exe" : "uv";
	const finalRoot = join(managerRoot, "uv", UV_VERSION, key);
	const finalExecutable = join(finalRoot, executableName);
	if (await executableAt(finalExecutable)) return finalExecutable;
	await mkdir(managerRoot, {
		recursive: true,
		mode: 448
	});
	const stage = await mkdtemp(join(managerRoot, `.uv-stage-${randomUUID()}-`));
	try {
		const bytes = await boundedDownload(`${UV_RELEASE_ROOT}/${archive.name}`, signal);
		if (createHash("sha256").update(bytes).digest("hex") !== archive.sha256) throw new ManagedUvError("uv archive checksum mismatch");
		const installRoot = join(stage, "install");
		await mkdir(installRoot, {
			recursive: true,
			mode: 448
		});
		if (archive.kind === "zip") {
			const entries = unzipSync(bytes);
			const executable = Object.entries(entries).find(([path]) => basename(path) === executableName);
			if (executable === void 0) throw new ManagedUvError("uv archive has no executable");
			await writeFile(join(installRoot, executableName), executable[1], {
				flag: "wx",
				mode: 448
			});
		} else {
			const archivePath = join(stage, archive.name);
			await writeFile(archivePath, bytes, {
				flag: "wx",
				mode: 384
			});
			await extract({
				file: archivePath,
				cwd: installRoot,
				strip: 1
			});
		}
		const stagedExecutable = join(installRoot, executableName);
		if (!await executableAt(stagedExecutable)) throw new ManagedUvError("uv archive has no regular executable");
		await chmod(stagedExecutable, 448);
		await mkdir(join(managerRoot, "uv", UV_VERSION), {
			recursive: true,
			mode: 448
		});
		try {
			await rename(installRoot, finalRoot);
		} catch (error) {
			if (!await executableAt(finalExecutable)) throw error;
		}
		return finalExecutable;
	} catch (error) {
		if (error instanceof ManagedUvError) throw error;
		throw new ManagedUvError("uv provisioning failed", { cause: error });
	} finally {
		await removeOwnedStage(managerRoot, stage);
	}
}
//#endregion
//#region lib/types/worker.js
/** Private PandaData worker process client. */
/** Legacy SDK release eligible for first-run environment adoption. */
const PANDA_DATA_VERSION = "0.0.12";
const WORKER_FAILURE_CODES = /* @__PURE__ */ new Set([
	"invalid-request",
	"cancelled",
	"python-unavailable",
	"python-unsupported",
	"sdk-not-ready",
	"sdk-version-mismatch",
	"bootstrap-failed",
	"release-unavailable",
	"update-not-available",
	"update-failed",
	"repair-failed",
	"rollback-unavailable",
	"incompatible-api",
	"login-failed",
	"network-unavailable",
	"data-validation-failed",
	"credential-cleanup-failed",
	"logout-unsupported",
	"logout-failed",
	"execution-unavailable",
	"worker-failed"
]);
function isRunnerFailure(exitCode, stderr, rules) {
	if (exitCode === 0) return false;
	for (const rule of rules) {
		if (rule.allowedExitCodes !== void 0 && !rule.allowedExitCodes.includes(exitCode)) continue;
		const informationalLines = new Set((rule.informationalLines ?? []).map((line) => line.toLowerCase()));
		const fatalSignatures = rule.fatalSignatures.map((signature) => signature.trim().toLowerCase()).filter(Boolean);
		for (const line of stderr.split(/\r?\n/u)) {
			const lowered = line.toLowerCase();
			if (informationalLines.has(lowered)) continue;
			if (fatalSignatures.some((signature) => lowered.includes(signature))) return true;
		}
	}
	return false;
}
/** Fixed worker failure; stdout, stderr, exception text, and credentials stay private. */
var PandaWorkerError = class extends Error {
	code;
	/**
	* Create a redacted worker failure.
	* @param code - closed failure identifier safe to return through Remote.
	*/
	constructor(code) {
		super("The PandaData worker operation failed.");
		this.code = code;
		this.name = "PandaWorkerError";
	}
};
function isCapabilities$1(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	return typeof record.authentication === "boolean" && typeof record.marketData === "boolean" && typeof record.indexData === "boolean" && typeof record.marginData === "boolean";
}
function isWorkerResponse(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	return typeof record.ok === "boolean" && (typeof record.installedSdkVersion === "string" || record.installedSdkVersion === null) && typeof record.logoutSupported === "boolean" && typeof record.authenticated === "boolean" && typeof record.dataValidated === "boolean" && (typeof record.pythonVersion === "string" || record.pythonVersion === null) && (record.pythonSource === "configured" || record.pythonSource === "uv-managed") && Array.isArray(record.publicCallables) && record.publicCallables.every((value) => typeof value === "string") && (typeof record.apiFingerprint === "string" || record.apiFingerprint === null) && (record.capabilities === null || isCapabilities$1(record.capabilities)) && (record.code === void 0 || typeof record.code === "string" && WORKER_FAILURE_CODES.has(record.code));
}
function privatePython(runtimeRoot) {
	return process.platform === "win32" ? join(runtimeRoot, "Scripts", "python.exe") : join(runtimeRoot, "bin", "python");
}
function virtualEnvironmentPython(root) {
	return process.platform === "win32" ? join(root, "Scripts", "python.exe") : join(root, "bin", "python");
}
function configuredPythonCandidates(config) {
	const candidates = [];
	if (isAbsolute(config.pythonCommand)) candidates.push({
		command: config.pythonCommand,
		args: config.pythonArgs
	});
	if (config.activeVirtualEnvironment !== void 0) candidates.push({
		command: virtualEnvironmentPython(config.activeVirtualEnvironment),
		args: []
	});
	for (const name of [
		".venv",
		".ven",
		"venv"
	]) candidates.push({
		command: virtualEnvironmentPython(join(config.projectRoot, name)),
		args: []
	});
	if (!isAbsolute(config.pythonCommand)) candidates.push({
		command: config.pythonCommand,
		args: config.pythonArgs
	});
	const seen = /* @__PURE__ */ new Set();
	return candidates.filter(({ command }) => {
		const key = process.platform === "win32" ? command.toLowerCase() : command;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}
function operationFailure(operation) {
	if (operation === "bootstrap") return "bootstrap-failed";
	if (operation === "login") return "login-failed";
	if (operation === "logout") return "logout-failed";
	return "worker-failed";
}
/** One-shot stdin client for the bundled Python worker. */
var PandaWorkerClient = class {
	subprocess;
	config;
	workerPath = fileURLToPath(new URL("../worker/panda_worker.py", import.meta.url));
	runnerPath = fileURLToPath(new URL("../worker/panda_runner.py", import.meta.url));
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
		const launcher = existsSync(privatePython(runtimeRoot)) ? {
			executable: privatePython(runtimeRoot),
			args: []
		} : await this.resolveConfiguredPython(this.operationSignal(signal, this.config.operationTimeoutMs));
		return this.run({
			operation: "describe",
			requiredSdkVersion: sdkVersion,
			runtimeRoot,
			pythonSource
		}, launcher.executable, launcher.args, signal);
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
				operation: "bootstrap",
				requiredSdkVersion: sdkVersion,
				runtimeRoot,
				pythonSource: "configured",
				...wheelURL === void 0 ? {} : { wheelURL },
				...wheelSha256 === void 0 ? {} : { wheelSha256 }
			}, launcher.executable, launcher.args, signal);
		} catch (error) {
			if (!(error instanceof PandaWorkerError) || error.code !== "python-unavailable" && error.code !== "python-unsupported") throw error;
			const launcher = await this.resolveManagedPython(this.operationSignal(signal, this.config.bootstrapTimeoutMs));
			return this.run({
				operation: "bootstrap",
				requiredSdkVersion: sdkVersion,
				runtimeRoot,
				pythonSource: "uv-managed",
				...wheelURL === void 0 ? {} : { wheelURL },
				...wheelSha256 === void 0 ? {} : { wheelSha256 }
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
			operation: "login",
			requiredSdkVersion: sdkVersion,
			runtimeRoot,
			pythonSource,
			baseURL: this.config.baseURL,
			accountKind: account.kind,
			login: account.login,
			password,
			...validationCall === void 0 ? {} : { validationCall }
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
		return this.run({
			operation: "logout",
			requiredSdkVersion: sdkVersion,
			runtimeRoot,
			pythonSource
		}, privatePython(runtimeRoot), [], signal);
	}
	/**
	* Return the exact private runner invocation that the sandbox must wrap.
	* @param runtimeRoot - exact retained environment directory.
	* @returns Python runner argv without credential material.
	*/
	executionArgv(runtimeRoot) {
		return [
			privatePython(runtimeRoot),
			"-I",
			this.runnerPath
		];
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
				env: {
					PYTHONNOUSERSITE: "1",
					PYTHONUTF8: "1"
				},
				stdio: {
					stdin: { data: JSON.stringify({
						requiredSdkVersion: sdkVersion,
						baseURL: this.config.baseURL,
						accountKind: request.account.kind,
						login: request.account.login,
						password: request.password,
						scriptPath: request.scriptPath,
						args: request.args,
						workdir: request.workdir
					}) },
					stdout: { maxBytes: this.config.maxOutputBytes },
					stderr: { maxBytes: this.config.maxOutputBytes }
				},
				graceMs: this.config.terminateGraceMs,
				signal: active
			});
		} catch {
			throw new PandaWorkerError(active.aborted ? "cancelled" : "execution-unavailable");
		}
		try {
			const outcome = await handle.done;
			await handle.waitForExit();
			if (active.aborted) throw new PandaWorkerError("cancelled");
			const stdout = handle.collected.stdout?.readFrom(0);
			const stderr = handle.collected.stderr?.readFrom(0);
			if (stdout?.lossy === true || stderr?.lossy === true) throw new PandaWorkerError("worker-failed");
			const exitCode = outcome.exitCode ?? 1;
			if (isRunnerFailure(exitCode, stderr?.text ?? "", wrapped.runnerFailureRules)) throw new PandaWorkerError("execution-unavailable");
			return {
				exitCode,
				stdout: stdout?.text ?? "",
				stderr: stderr?.text ?? ""
			};
		} catch (error) {
			if (active.aborted) {
				handle.terminate();
				await handle.waitForExit();
				throw new PandaWorkerError("cancelled");
			}
			if (error instanceof PandaWorkerError) throw error;
			throw new PandaWorkerError("execution-unavailable");
		}
	}
	operationSignal(caller, timeoutMs) {
		const timeout = AbortSignal.timeout(timeoutMs);
		return caller === void 0 ? timeout : AbortSignal.any([caller, timeout]);
	}
	async resolveConfiguredPython(signal) {
		this.configuredPython ??= this.findConfiguredPython(signal);
		try {
			return await this.configuredPython;
		} catch (error) {
			this.configuredPython = void 0;
			throw error;
		}
	}
	async findConfiguredPython(signal) {
		for (const candidate of configuredPythonCandidates(this.config)) try {
			return {
				executable: await this.subprocess.resolveExecutable(candidate.command, void 0, signal),
				args: candidate.args
			};
		} catch {}
		throw new PandaWorkerError("python-unavailable");
	}
	async resolveManagedPython(signal) {
		this.managedPython ??= this.installManagedPython(signal);
		try {
			return await this.managedPython;
		} catch (error) {
			this.managedPython = void 0;
			throw error;
		}
	}
	async installManagedPython(signal) {
		let uv;
		try {
			uv = await resolveManagedUv(this.config.runtimeManagerRoot, signal);
		} catch (error) {
			if (!(error instanceof ManagedUvError)) throw error;
			throw new PandaWorkerError("python-unavailable");
		}
		const env = {
			UV_PYTHON_INSTALL_DIR: join(this.config.runtimeManagerRoot, "python"),
			UV_CACHE_DIR: join(this.config.runtimeManagerRoot, "uv-cache")
		};
		await this.runUtility([
			uv,
			"python",
			"install",
			this.config.managedPythonVersion,
			"--python-preference",
			"only-managed"
		], env, signal, false);
		const executable = (await this.runUtility([
			uv,
			"python",
			"find",
			this.config.managedPythonVersion,
			"--python-preference",
			"only-managed"
		], env, signal, true)).trim();
		if (executable === "") throw new PandaWorkerError("python-unavailable");
		return executable;
	}
	async runUtility(argv, env, signal, collect) {
		const handle = this.subprocess.spawn({
			argv,
			cwd: this.config.runtimeManagerRoot,
			env,
			stdio: {
				stdin: "ignore",
				stdout: { maxBytes: collect ? this.config.maxOutputBytes : 1024 },
				stderr: { maxBytes: 1024 }
			},
			graceMs: this.config.terminateGraceMs,
			signal
		});
		try {
			const outcome = await handle.done;
			await handle.waitForExit();
			if (signal.aborted || outcome.exitCode !== 0 || outcome.signal !== null) throw new PandaWorkerError("python-unavailable");
			if (!collect) return "";
			const output = handle.collected.stdout?.readFrom(0);
			if (output === void 0 || output.lossy) throw new PandaWorkerError("python-unavailable");
			return output.text;
		} catch (error) {
			if (signal.aborted) {
				handle.terminate();
				await handle.waitForExit();
			}
			if (error instanceof PandaWorkerError) throw error;
			throw new PandaWorkerError("python-unavailable");
		}
	}
	async run(request, launcher, launcherArgs, callerSignal) {
		const timeoutMs = request.operation === "bootstrap" ? this.config.bootstrapTimeoutMs : this.config.operationTimeoutMs;
		const signal = this.operationSignal(callerSignal, timeoutMs);
		const handle = this.subprocess.spawn({
			argv: [
				launcher,
				...launcherArgs,
				"-I",
				this.workerPath
			],
			cwd: dirname(this.workerPath),
			env: {
				PYTHONNOUSERSITE: "1",
				PYTHONUTF8: "1"
			},
			stdio: {
				stdin: { data: JSON.stringify(request) },
				stdout: { maxBytes: this.config.maxOutputBytes },
				stderr: { maxBytes: this.config.maxOutputBytes }
			},
			graceMs: this.config.terminateGraceMs,
			signal
		});
		try {
			const outcome = await handle.done;
			await handle.waitForExit();
			if (signal.aborted) throw new PandaWorkerError("cancelled");
			if (outcome.exitCode !== 0 || outcome.signal !== null) throw new PandaWorkerError(operationFailure(request.operation));
			const output = handle.collected.stdout?.readFrom(0);
			if (output === void 0 || output.lossy) throw new PandaWorkerError("worker-failed");
			let decoded;
			try {
				decoded = JSON.parse(output.text);
			} catch {
				throw new PandaWorkerError("worker-failed");
			}
			if (!isWorkerResponse(decoded)) throw new PandaWorkerError("worker-failed");
			if (!decoded.ok) throw new PandaWorkerError(decoded.code ?? operationFailure(request.operation));
			if (request.operation !== "describe" && decoded.installedSdkVersion !== request.requiredSdkVersion) throw new PandaWorkerError("sdk-version-mismatch");
			return decoded;
		} catch (error) {
			if (signal.aborted) {
				handle.terminate();
				await handle.waitForExit();
				throw new PandaWorkerError("cancelled");
			}
			if (error instanceof PandaWorkerError) throw error;
			throw new PandaWorkerError(operationFailure(request.operation));
		}
	}
};
//#endregion
//#region lib/types/runtime.js
/** Immutable PandaData environments, release discovery, activation, and rollback. */
const ACTIVATION_SCHEMA_VERSION = 2;
const RELEASE_BODY_LIMIT = 2 * 1024 * 1024;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const CANDIDATE_ID_PATTERN = /^\d+\.\d+\.\d+-[0-9a-f]{12}-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isCapabilities(value) {
	if (!isRecord(value)) return false;
	return typeof value.authentication === "boolean" && typeof value.marketData === "boolean" && typeof value.indexData === "boolean" && typeof value.marginData === "boolean";
}
function isEnvironment(value) {
	if (!isRecord(value)) return false;
	return typeof value.id === "string" && typeof value.root === "string" && typeof value.sdkVersion === "string" && (value.pythonSource === "configured" || value.pythonSource === "uv-managed") && typeof value.pythonVersion === "string" && typeof value.apiFingerprint === "string" && Array.isArray(value.publicCallables) && value.publicCallables.every((item) => typeof item === "string") && isCapabilities(value.capabilities) && typeof value.createdAt === "number";
}
function isActivationFile(value) {
	return isRecord(value) && value.schemaVersion === ACTIVATION_SCHEMA_VERSION && isEnvironment(value.active) && (value.previous === null || isEnvironment(value.previous)) && Array.isArray(value.retained) && value.retained.every(isEnvironment);
}
function uniqueEnvironments(environments) {
	const seen = /* @__PURE__ */ new Set();
	return environments.filter((environment) => {
		if (seen.has(environment.id)) return false;
		seen.add(environment.id);
		return true;
	});
}
function compareVersions(left, right) {
	const parse = (value) => value.split(/[.-]/u, 3).map((part) => Number(part));
	const leftParts = parse(left);
	const rightParts = parse(right);
	for (let index = 0; index < 3; index += 1) {
		const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
		if (difference !== 0) return difference;
	}
	return left.localeCompare(right);
}
function pythonCompatible(version, compatibility) {
	const match = /^(\d+)\.(\d+)(?:\.|$)/u.exec(version);
	if (match === null) return false;
	const candidate = [Number(match[1]), Number(match[2])];
	const compare = (left, right) => left[0] - right[0] || left[1] - right[1];
	return compare(candidate, compatibility.pythonMin) >= 0 && compare(candidate, compatibility.pythonMaxExclusive) < 0;
}
function releaseFile(value, version) {
	if (value.packagetype !== "bdist_wheel" || value.yanked === true) return void 0;
	if (typeof value.filename !== "string" || !value.filename.endsWith("-py3-none-any.whl")) return void 0;
	if (typeof value.url !== "string") return void 0;
	let url;
	try {
		url = new URL(value.url);
	} catch {
		return;
	}
	if (url.protocol !== "https:" || url.hostname !== "files.pythonhosted.org" || url.username !== "" || url.password !== "") return void 0;
	if (!isRecord(value.digests) || typeof value.digests.sha256 !== "string" || !SHA256_PATTERN.test(value.digests.sha256)) return void 0;
	return {
		version,
		wheelURL: url.href,
		wheelSha256: value.digests.sha256
	};
}
/**
* Parse one exact release from the PyPI JSON response.
* @param value - untrusted JSON response.
* @param requestedVersion - exact release or the index's current stable version.
* @returns validated wheel metadata.
*/
function parsePandaRelease(value, requestedVersion) {
	if (!isRecord(value) || !isRecord(value.info) || !isRecord(value.releases)) throw new PandaWorkerError("release-unavailable");
	const releases = value.releases;
	const compatible = requestedVersion === void 0 ? [...PANDA_SDK_COMPATIBILITY].filter((entry) => Array.isArray(releases[entry.version])).sort((left, right) => compareVersions(right.version, left.version))[0] : pandaSdkCompatibility(requestedVersion);
	if (compatible === void 0) throw new PandaWorkerError("release-unavailable");
	const version = compatible.version;
	const files = releases[version];
	if (!Array.isArray(files)) throw new PandaWorkerError("release-unavailable");
	for (const file of files) {
		if (!isRecord(file)) continue;
		const selected = releaseFile(file, version);
		if (selected?.wheelURL === compatible.wheelURL && selected.wheelSha256 === compatible.wheelSha256) return selected;
	}
	throw new PandaWorkerError("release-unavailable");
}
/** Managed PandaData runtime with candidate probing and pointer-only activation. */
var PandaRuntimeManager = class {
	worker;
	config;
	activation;
	latestRelease = null;
	lastUpdateCheckedAt = null;
	/**
	* Create a runtime manager around one worker client.
	* @param worker - one-shot Python process client.
	* @param config - validated storage and release discovery settings.
	*/
	constructor(worker, config) {
		this.worker = worker;
		this.config = config;
	}
	/**
	* Resolve one retained immutable environment by its durable identity.
	* @param environmentId - Session-recorded environment identity.
	* @returns the exact environment or `undefined` after external deletion/corruption.
	*/
	async environment(environmentId) {
		const activation = await this.loadActivation();
		if (activation === null) return void 0;
		return uniqueEnvironments([
			activation.active,
			...activation.previous === null ? [] : [activation.previous],
			...activation.retained
		]).find((candidate) => candidate.id === environmentId);
	}
	/**
	* Inspect the active environment without restoring SDK-owned authentication files.
	* @param signal - operation lifetime.
	* @returns current runtime state.
	*/
	async describe(signal) {
		const activation = await this.loadActivation();
		await this.cleanupOrphanedEnvironments(activation);
		if (activation === null) return this.status(null);
		const response = await this.worker.describeAt(activation.active.root, activation.active.sdkVersion, activation.active.pythonSource, signal);
		if (response.installedSdkVersion !== activation.active.sdkVersion) throw new PandaWorkerError("sdk-version-mismatch");
		const refreshed = this.environmentFromResponse(activation.active.id, activation.active.root, response, activation.active.createdAt);
		if (JSON.stringify(refreshed) !== JSON.stringify(activation.active)) {
			this.activation = {
				...activation,
				active: refreshed
			};
			await this.writeActivation(this.activation);
		}
		return this.status(response);
	}
	/**
	* Discover the current official SDK release without changing the active environment.
	* @param signal - operation lifetime.
	* @returns current runtime state with update metadata.
	*/
	async checkForUpdates(signal) {
		this.latestRelease = await this.fetchRelease(void 0, signal);
		this.lastUpdateCheckedAt = Date.now();
		return this.describe(signal);
	}
	/**
	* Install the latest official SDK into a new environment and activate it.
	* @param signal - operation lifetime.
	* @param credential - optional Host credential used for pre-activation data and execution verification.
	* @returns activated runtime state.
	*/
	async bootstrap(signal, credential) {
		const release = await this.fetchRelease(void 0, signal);
		this.latestRelease = release;
		this.lastUpdateCheckedAt = Date.now();
		return this.installCandidate(release, "bootstrap-failed", credential, signal);
	}
	/**
	* Activate the latest official SDK only when it is newer than the current release.
	* @param credential - Host credential used to validate the candidate before activation.
	* @param signal - operation lifetime.
	* @returns activated runtime state.
	*/
	async update(credential, signal) {
		const current = await this.loadActivation();
		if (current === null) return this.bootstrap(signal, credential);
		const release = await this.fetchRelease(void 0, signal);
		this.latestRelease = release;
		this.lastUpdateCheckedAt = Date.now();
		if (compareVersions(release.version, current.active.sdkVersion) <= 0) throw new PandaWorkerError("update-not-available");
		return this.installCandidate(release, "update-failed", credential, signal);
	}
	/**
	* Rebuild the active SDK release in a fresh environment.
	* @param credential - Host credential used to validate the candidate before activation.
	* @param signal - operation lifetime.
	* @returns activated replacement state.
	*/
	async repair(credential, signal) {
		const current = await this.loadActivation();
		if (current === null) throw new PandaWorkerError("sdk-not-ready");
		const release = await this.fetchRelease(current.active.sdkVersion, signal);
		return this.installCandidate(release, "repair-failed", credential, signal);
	}
	/**
	* Swap the active and previous immutable environments after probing the target.
	* @param credential - Host credential used to validate the target before pointer swap.
	* @param signal - operation lifetime.
	* @returns rolled-back runtime state.
	*/
	async rollback(credential, signal) {
		const current = await this.loadActivation();
		if (current?.previous === null || current === null) throw new PandaWorkerError("rollback-unavailable");
		const response = await this.worker.describeAt(current.previous.root, current.previous.sdkVersion, current.previous.pythonSource, signal);
		if (response.installedSdkVersion !== current.previous.sdkVersion) throw new PandaWorkerError("rollback-unavailable");
		let activeResponse = response;
		if (credential !== void 0) {
			const compatibility = pandaSdkCompatibility(current.previous.sdkVersion);
			if (compatibility === void 0) throw new PandaWorkerError("incompatible-api");
			const verified = await this.worker.loginAt(current.previous.root, current.previous.sdkVersion, current.previous.pythonSource, credential.account, credential.password, compatibility.validationCall, signal);
			if (!verified.authenticated) throw new PandaWorkerError("login-failed");
			if (!verified.dataValidated) throw new PandaWorkerError("data-validation-failed");
			activeResponse = verified;
		}
		const target = this.environmentFromResponse(current.previous.id, current.previous.root, response, current.previous.createdAt);
		if (credential !== void 0) await this.config.executionProbe(target, credential, signal);
		this.activation = {
			schemaVersion: ACTIVATION_SCHEMA_VERSION,
			active: target,
			previous: current.active,
			retained: current.retained
		};
		await this.writeActivation(this.activation);
		return this.status(activeResponse);
	}
	/**
	* Authenticate in the active environment for this one-shot worker.
	* @param account - normalized account identity.
	* @param password - write-only password.
	* @param validateDataRead - whether to execute the matrix-owned read-only onboarding request.
	* @param signal - operation lifetime.
	* @returns authenticated runtime state suitable for Host-owned credential replay.
	*/
	async login(account, password, validateDataRead = false, signal) {
		const current = await this.loadActivation();
		if (current === null) throw new PandaWorkerError("sdk-not-ready");
		const compatibility = pandaSdkCompatibility(current.active.sdkVersion);
		if (compatibility === void 0) throw new PandaWorkerError("incompatible-api");
		const response = await this.worker.loginAt(current.active.root, current.active.sdkVersion, current.active.pythonSource, account, password, validateDataRead ? compatibility.validationCall : void 0, signal);
		if (!response.authenticated) throw new PandaWorkerError("login-failed");
		if (validateDataRead && !response.dataValidated) throw new PandaWorkerError("data-validation-failed");
		return this.status(response);
	}
	/**
	* Clear credentials from every retained environment, then the active environment.
	* @param signal - operation lifetime.
	* @returns verified active runtime state.
	*/
	async logout(signal) {
		const current = await this.loadActivation();
		if (current === null) throw new PandaWorkerError("sdk-not-ready");
		const inactive = uniqueEnvironments([...current.previous === null ? [] : [current.previous], ...current.retained]).filter((environment) => environment.id !== current.active.id);
		for (const environment of inactive) await this.worker.logoutAt(environment.root, environment.sdkVersion, environment.pythonSource, signal);
		const active = await this.worker.logoutAt(current.active.root, current.active.sdkVersion, current.active.pythonSource, signal);
		return this.status(active);
	}
	async installCandidate(release, failureCode, credential, signal) {
		const current = await this.loadActivation();
		const id = `${release.version}-${release.wheelSha256.slice(0, 12)}-${randomUUID()}`;
		const root = resolve(this.config.managerRoot, "environments", id);
		try {
			await mkdir(root, { recursive: true });
			const response = await this.worker.bootstrapAt(root, release.version, release.wheelURL, release.wheelSha256, signal);
			this.assertCompatible(current?.active ?? null, response);
			let activeResponse = response;
			if (credential !== void 0) {
				const compatibility = pandaSdkCompatibility(release.version);
				if (compatibility === void 0) throw new PandaWorkerError("incompatible-api");
				const verified = await this.worker.loginAt(root, release.version, response.pythonSource, credential.account, credential.password, compatibility.validationCall, signal);
				if (!verified.authenticated) throw new PandaWorkerError("login-failed");
				if (!verified.dataValidated) throw new PandaWorkerError("data-validation-failed");
				activeResponse = verified;
			}
			const environment = this.environmentFromResponse(id, root, response, Date.now());
			if (credential !== void 0) await this.config.executionProbe(environment, credential, signal);
			await this.writeEnvironment(environment);
			this.activation = {
				schemaVersion: ACTIVATION_SCHEMA_VERSION,
				active: environment,
				previous: current?.active ?? null,
				retained: current === null ? [] : uniqueEnvironments([...current.previous === null ? [] : [current.previous], ...current.retained])
			};
			await this.writeActivation(this.activation);
			return this.status(activeResponse);
		} catch (error) {
			try {
				await this.removeOwnedCandidateRoot(root);
			} catch {}
			if (error instanceof PandaWorkerError) throw error;
			throw new PandaWorkerError(failureCode);
		}
	}
	async cleanupOrphanedEnvironments(activation) {
		const environmentsRoot = resolve(this.config.managerRoot, "environments");
		let entries;
		try {
			entries = await readdir(environmentsRoot, { withFileTypes: true });
		} catch (error) {
			if (isRecord(error) && error.code === "ENOENT") return;
			throw new PandaWorkerError("worker-failed");
		}
		const retainedRoots = new Set((activation === null ? [] : [
			activation.active,
			...activation.previous === null ? [] : [activation.previous],
			...activation.retained
		]).map((environment) => resolve(environment.root)));
		for (const entry of entries) {
			if (!CANDIDATE_ID_PATTERN.test(entry.name)) continue;
			const root = resolve(environmentsRoot, entry.name);
			if (retainedRoots.has(root)) continue;
			await this.removeOwnedCandidateRoot(root);
		}
	}
	async removeOwnedCandidateRoot(root) {
		const environmentsRoot = resolve(this.config.managerRoot, "environments");
		const resolvedRoot = resolve(root);
		const child = relative(environmentsRoot, resolvedRoot);
		if (child === "" || child.includes("/") || child.includes("\\") || !CANDIDATE_ID_PATTERN.test(child)) throw new PandaWorkerError("worker-failed");
		let stats;
		try {
			stats = await lstat(resolvedRoot);
		} catch (error) {
			if (isRecord(error) && error.code === "ENOENT") return;
			throw error;
		}
		if (stats.isSymbolicLink() || !stats.isDirectory()) {
			await unlink(resolvedRoot);
			return;
		}
		await rm(resolvedRoot, {
			recursive: true,
			force: true
		});
	}
	assertCompatible(active, candidate) {
		if (candidate.installedSdkVersion === null || candidate.pythonVersion === null || candidate.apiFingerprint === null || candidate.capabilities === null) throw new PandaWorkerError("incompatible-api");
		if (!Object.values(candidate.capabilities).every(Boolean)) throw new PandaWorkerError("incompatible-api");
		const compatibility = pandaSdkCompatibility(candidate.installedSdkVersion);
		if (compatibility === void 0 || !pythonCompatible(candidate.pythonVersion, compatibility) || compatibility.requiredCallables.some((name) => !candidate.publicCallables.includes(name))) throw new PandaWorkerError("incompatible-api");
		if (active === null) return;
		const candidateCallables = new Set(candidate.publicCallables);
		if (active.publicCallables.some((name) => !candidateCallables.has(name))) throw new PandaWorkerError("incompatible-api");
	}
	environmentFromResponse(id, root, response, createdAt) {
		if (response.installedSdkVersion === null || response.pythonVersion === null || response.apiFingerprint === null || response.capabilities === null) throw new PandaWorkerError("sdk-not-ready");
		return {
			id,
			root,
			sdkVersion: response.installedSdkVersion,
			pythonSource: response.pythonSource,
			pythonVersion: response.pythonVersion,
			apiFingerprint: response.apiFingerprint,
			publicCallables: [...response.publicCallables],
			capabilities: response.capabilities,
			createdAt
		};
	}
	async fetchRelease(version, callerSignal) {
		const timeout = AbortSignal.timeout(this.config.releaseTimeoutMs);
		const signal = callerSignal === void 0 ? timeout : AbortSignal.any([callerSignal, timeout]);
		let response;
		try {
			response = await fetch(this.config.releaseIndexURL, {
				signal,
				redirect: "error"
			});
		} catch {
			throw new PandaWorkerError(signal.aborted && callerSignal?.aborted === true ? "cancelled" : "release-unavailable");
		}
		if (!response.ok || response.url !== this.config.releaseIndexURL) throw new PandaWorkerError("release-unavailable");
		const declaredLength = response.headers.get("content-length");
		if (declaredLength !== null && Number(declaredLength) > RELEASE_BODY_LIMIT) throw new PandaWorkerError("release-unavailable");
		const body = new Uint8Array(await response.arrayBuffer());
		if (body.byteLength > RELEASE_BODY_LIMIT) throw new PandaWorkerError("release-unavailable");
		let value;
		try {
			value = JSON.parse(new TextDecoder().decode(body));
		} catch {
			throw new PandaWorkerError("release-unavailable");
		}
		return parsePandaRelease(value, version);
	}
	async loadActivation() {
		if (this.activation !== void 0) return this.activation;
		let contents;
		try {
			contents = await readFile(this.activationPath(), "utf8");
		} catch (error) {
			if (!isRecord(error) || error.code !== "ENOENT") throw new PandaWorkerError("worker-failed");
			return this.cacheActivation(await this.adoptLegacy());
		}
		let value;
		try {
			value = JSON.parse(contents);
		} catch {
			throw new PandaWorkerError("worker-failed");
		}
		if (!isActivationFile(value) || !this.isOwnedActivation(value)) throw new PandaWorkerError("worker-failed");
		return this.cacheActivation(value);
	}
	async adoptLegacy() {
		let response;
		try {
			response = await this.worker.describeAt(this.config.legacyRoot, PANDA_DATA_VERSION, "configured");
		} catch {
			return null;
		}
		if (response.installedSdkVersion !== "0.0.12") return null;
		const active = this.environmentFromResponse("legacy-0.0.12", this.config.legacyRoot, response, Date.now());
		const activation = {
			schemaVersion: ACTIVATION_SCHEMA_VERSION,
			active,
			previous: null,
			retained: []
		};
		await this.writeActivation(activation);
		return activation;
	}
	cacheActivation(activation) {
		this.activation = activation;
		return activation;
	}
	isOwnedActivation(activation) {
		return [
			activation.active,
			...activation.previous === null ? [] : [activation.previous],
			...activation.retained
		].every((environment) => this.isOwnedEnvironment(environment));
	}
	isOwnedEnvironment(environment) {
		const root = resolve(environment.root);
		if (root === resolve(this.config.legacyRoot)) return environment.id === `legacy-${PANDA_DATA_VERSION}`;
		const child = relative(resolve(this.config.managerRoot, "environments"), root);
		return child !== "" && !child.startsWith("..") && !isAbsolute(child);
	}
	status(response) {
		const active = this.activation?.active ?? null;
		const latest = this.latestRelease?.version ?? null;
		return {
			active,
			previous: this.activation?.previous ?? null,
			response,
			latestSdkVersion: latest,
			updateAvailable: active !== null && latest !== null && compareVersions(latest, active.sdkVersion) > 0,
			lastUpdateCheckedAt: this.lastUpdateCheckedAt
		};
	}
	activationPath() {
		return join(this.config.managerRoot, "active.json");
	}
	async writeEnvironment(environment) {
		await writeFile(join(environment.root, "runtime.json"), `${JSON.stringify(environment, null, 2)}\n`, {
			encoding: "utf8",
			flag: "wx"
		});
	}
	async writeActivation(activation) {
		await mkdir(this.config.managerRoot, { recursive: true });
		const target = this.activationPath();
		const temporary = join(this.config.managerRoot, `active.${randomUUID()}.tmp`);
		await writeFile(temporary, `${JSON.stringify(activation, null, 2)}\n`, {
			encoding: "utf8",
			flag: "wx"
		});
		try {
			await rename(temporary, target);
		} catch (error) {
			const code = isRecord(error) ? error.code : void 0;
			if (code !== "EEXIST" && code !== "EPERM") throw error;
			await unlink(target);
			await rename(temporary, target);
		}
	}
};
//#endregion
//#region lib/types/index.js
/** Host-only PandaData authentication and managed-runtime connector. */
var __runInitializers = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) if (kind === "field") initializers.unshift(_);
		else descriptor[key] = _;
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
/** Cordis plugin name for Loader diagnostics. */
const name = "panda-connector";
/** Host service required by the connector. */
const inject = ["sandbox", "subprocess"];
const DEFAULT_BASE_URL = "http://pandadata.pandaaiquant.com";
const DEFAULT_RELEASE_INDEX_URL = "https://pypi.org/pypi/panda_data/json";
const DEFAULT_OPERATION_TIMEOUT_MS = 3e4;
const DEFAULT_RELEASE_TIMEOUT_MS = 15e3;
const DEFAULT_BOOTSTRAP_TIMEOUT_MS = 12 * 6e4;
const DEFAULT_TERMINATE_GRACE_MS = 2e3;
const DEFAULT_MAX_OUTPUT_BYTES = 65536;
const DEFAULT_MANAGED_PYTHON_VERSION = "3.12";
const EXECUTION_PROBE_SUCCESS = "PANDADATA_EXECUTION_PROBE_OK";
const EXECUTION_PROBE_SOURCE = fileURLToPath(new URL("../worker/panda_execution_probe.py", import.meta.url));
/* v8 ignore next -- Windows and POSIX coverage lanes each exercise their native launcher default. */
const DEFAULT_PYTHON_COMMAND = process.platform === "win32" ? "py" : "python3";
/* v8 ignore next -- Windows and POSIX coverage lanes each exercise their native launcher arguments. */
const DEFAULT_PYTHON_ARGS = process.platform === "win32" ? ["-3.10"] : [];
const PLUGIN_PROJECT_ROOT = resolve(process.env.INIT_CWD ?? process.cwd());
/** Plugin configuration schema. */
const Config = z.object({
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
	maxOutputBytes: z.number().default(DEFAULT_MAX_OUTPUT_BYTES)
});
function executionBackend(confined) {
	const signatures = new Set(confined.runnerFailureRules.flatMap((rule) => rule.fatalSignatures).map((signature) => signature.trim().toLowerCase()));
	if (process.platform === "win32") return signatures.has("windows-acl-run:") ? "windows-acl" : null;
	if (process.platform === "darwin") return signatures.has("sandbox-exec:") ? "seatbelt" : null;
	if (process.platform === "linux") {
		if (signatures.has("bwrap:")) return "bwrap";
		if (signatures.has("landlock-run:")) return "landlock";
	}
	return null;
}
const FAILURE_MESSAGE = {
	"invalid-request": "Check the account form and password, then try again.",
	"cancelled": "The PandaData operation was cancelled.",
	"python-unavailable": "Neither the configured Python launcher nor the managed Python installer is available.",
	"python-unsupported": "PandaData requires Python 3.10 or newer.",
	"sdk-not-ready": "Install the private PandaData runtime before signing in.",
	"sdk-version-mismatch": "The active PandaData runtime does not match its activation record.",
	"bootstrap-failed": "The private PandaData runtime could not be installed.",
	"release-unavailable": "The official PandaData release index is unavailable or returned invalid metadata.",
	"update-not-available": "The active PandaData SDK is already current.",
	"update-failed": "The PandaData candidate failed verification; the active runtime was not changed.",
	"repair-failed": "The replacement PandaData environment failed verification; the active runtime was not changed.",
	"rollback-unavailable": "No verified previous PandaData environment is available.",
	"incompatible-api": "The candidate PandaData SDK is missing APIs required by the active runtime or QuantSkills.",
	"login-failed": "PandaData rejected the saved or supplied account credentials.",
	"data-validation-failed": "PandaData login succeeded, but the required read-only data check failed.",
	"credential-cleanup-failed": "PandaData login was not retained because the SDK credential file could not be removed.",
	"network-unavailable": "PandaData could not be reached; saved credentials were retained for retry.",
	"logout-unsupported": "The active PandaData SDK does not expose a reliable logout operation.",
	"logout-failed": "PandaData sign-out failed; the connector remains connected.",
	"execution-unavailable": "The PandaData runtime could not complete a confined read-only execution check on this host.",
	"worker-failed": "The private PandaData worker returned an invalid response."
};
function validateHttpURL(name, value, httpsOnly = false) {
	let url;
	try {
		url = new URL(value);
	} catch {
		throw new Error(`panda-connector: ${name} must be an HTTP(S) URL`);
	}
	if ((httpsOnly ? url.protocol !== "https:" : url.protocol !== "http:" && url.protocol !== "https:") || url.username !== "" || url.password !== "" || url.hash !== "") throw new Error(`panda-connector: ${name} must be a credential-free ${httpsOnly ? "HTTPS" : "HTTP(S)"} URL`);
	return url.href.replace(/\/$/u, "");
}
function validateConfig(config) {
	if (config.pythonCommand.trim().length === 0) throw new Error("panda-connector: pythonCommand must be non-empty");
	if (config.pythonArgs.some((value) => value.length === 0)) throw new Error("panda-connector: pythonArgs entries must be non-empty");
	if (!/^[0-9]+\.[0-9]+$/u.test(config.managedPythonVersion)) throw new Error("panda-connector: managedPythonVersion must be a major.minor release");
	for (const [key, value] of Object.entries({
		releaseTimeoutMs: config.releaseTimeoutMs,
		operationTimeoutMs: config.operationTimeoutMs,
		bootstrapTimeoutMs: config.bootstrapTimeoutMs,
		terminateGraceMs: config.terminateGraceMs,
		maxOutputBytes: config.maxOutputBytes
	})) if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`panda-connector: ${key} must be a positive integer`);
	const dshHome = resolveDshHome(config.dshHome);
	const managerRoot = resolve(dshHome, "runtimes", "pandadata");
	const activeVirtualEnvironment = process.env.VIRTUAL_ENV?.trim();
	return {
		worker: {
			pythonCommand: config.pythonCommand,
			pythonArgs: config.pythonArgs,
			projectRoot: PLUGIN_PROJECT_ROOT,
			...activeVirtualEnvironment === void 0 || !isAbsolute(activeVirtualEnvironment) ? {} : { activeVirtualEnvironment },
			runtimeManagerRoot: managerRoot,
			managedPythonVersion: config.managedPythonVersion,
			baseURL: validateHttpURL("baseURL", config.baseURL),
			operationTimeoutMs: config.operationTimeoutMs,
			bootstrapTimeoutMs: config.bootstrapTimeoutMs,
			terminateGraceMs: config.terminateGraceMs,
			maxOutputBytes: config.maxOutputBytes
		},
		managerRoot,
		legacyRoot: resolve(dshHome, "runtimes", `panda-data-${PANDA_DATA_VERSION}`),
		releaseIndexURL: validateHttpURL("releaseIndexURL", config.releaseIndexURL, true),
		releaseTimeoutMs: config.releaseTimeoutMs
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
			__esDecorate(this, null, _describe_decorators, {
				kind: "method",
				name: "describe",
				static: false,
				private: false,
				access: {
					has: (obj) => "describe" in obj,
					get: (obj) => obj.describe
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _checkForUpdates_decorators, {
				kind: "method",
				name: "checkForUpdates",
				static: false,
				private: false,
				access: {
					has: (obj) => "checkForUpdates" in obj,
					get: (obj) => obj.checkForUpdates
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _bootstrap_decorators, {
				kind: "method",
				name: "bootstrap",
				static: false,
				private: false,
				access: {
					has: (obj) => "bootstrap" in obj,
					get: (obj) => obj.bootstrap
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _update_decorators, {
				kind: "method",
				name: "update",
				static: false,
				private: false,
				access: {
					has: (obj) => "update" in obj,
					get: (obj) => obj.update
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _repair_decorators, {
				kind: "method",
				name: "repair",
				static: false,
				private: false,
				access: {
					has: (obj) => "repair" in obj,
					get: (obj) => obj.repair
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _rollback_decorators, {
				kind: "method",
				name: "rollback",
				static: false,
				private: false,
				access: {
					has: (obj) => "rollback" in obj,
					get: (obj) => obj.rollback
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _login_decorators, {
				kind: "method",
				name: "login",
				static: false,
				private: false,
				access: {
					has: (obj) => "login" in obj,
					get: (obj) => obj.login
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _logout_decorators, {
				kind: "method",
				name: "logout",
				static: false,
				private: false,
				access: {
					has: (obj) => "logout" in obj,
					get: (obj) => obj.logout
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		static inject = inject;
		static Config = Config;
		runtime = __runInitializers(this, _instanceExtraInitializers);
		worker;
		credentialVault;
		lifecycle = new AbortController();
		operationTail = Promise.resolve();
		phase = "not-ready";
		runtimeStatus = {
			active: null,
			previous: null,
			response: null,
			latestSdkVersion: null,
			updateAvailable: false,
			lastUpdateCheckedAt: null
		};
		sessionCredential;
		credentialPersistence = "unavailable";
		reconnectState = "idle";
		dataReadiness = "unchecked";
		validatedEnvironmentId;
		lastDataValidatedAt = null;
		executionReadiness = "unchecked";
		executionIsolation = null;
		executionBackend = null;
		executionEnvironmentId;
		lastExecutionCheckedAt = null;
		executionEvidence = /* @__PURE__ */ new Map();
		lastFailure = null;
		vaultAvailable = false;
		disposed = false;
		/**
		* Create the Host service and bind worker teardown to the Cordis scope.
		* @param ctx - Cordis context containing the subprocess capability.
		* @param config - resolved connector configuration.
		*/
		constructor(ctx, config) {
			super(ctx, "pandaConnector");
			const validated = validateConfig(config);
			this.worker = new PandaWorkerClient(ctx.subprocess, validated.worker);
			this.runtime = new PandaRuntimeManager(this.worker, {
				managerRoot: validated.managerRoot,
				legacyRoot: validated.legacyRoot,
				releaseIndexURL: validated.releaseIndexURL,
				releaseTimeoutMs: validated.releaseTimeoutMs,
				executionProbe: (environment, credential, signal) => this.probeEnvironment(environment, credential, signal)
			});
			this.credentialVault = createPandaCredentialVault();
			this.operationTail = this.restoreStoredCredential();
			ctx.effect(() => async () => this.disposeConnector(), "panda-connector.worker-lifecycle");
		}
		/**
		* Return the exact connected runtime identity to freeze into a Session.
		* @returns immutable binding for the active verified environment.
		*/
		runtimeBinding() {
			const active = this.runtimeStatus.active;
			if (this.phase !== "connected" || active === null || this.sessionCredential === void 0) throw new PandaWorkerError("login-failed");
			if (this.dataReadiness !== "verified" || this.validatedEnvironmentId !== active.id || this.executionReadiness !== "ready" || this.executionEnvironmentId !== active.id) throw new PandaWorkerError("execution-unavailable");
			return Object.freeze({
				environmentId: active.id,
				sdkVersion: active.sdkVersion,
				pythonVersion: active.pythonVersion,
				apiFingerprint: active.apiFingerprint
			});
		}
		/**
		* Verify that a Session-recorded environment remains retained and executable with Host credentials.
		* @param binding - exact runtime identity read from the Session log.
		*/
		async validateRuntimeBinding(binding) {
			return this.serialize(async () => {
				const credential = this.sessionCredential;
				if (credential === void 0) throw new PandaWorkerError("login-failed");
				const environment = await this.runtime.environment(binding.environmentId);
				if (environment === void 0 || environment.sdkVersion !== binding.sdkVersion || environment.pythonVersion !== binding.pythonVersion || environment.apiFingerprint !== binding.apiFingerprint) throw new PandaWorkerError("sdk-version-mismatch");
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
				if (credential === void 0) throw new PandaWorkerError("login-failed");
				const environment = await this.runtime.environment(request.binding.environmentId);
				if (environment === void 0 || environment.sdkVersion !== request.binding.sdkVersion || environment.pythonVersion !== request.binding.pythonVersion || environment.apiFingerprint !== request.binding.apiFingerprint) throw new PandaWorkerError("sdk-version-mismatch");
				try {
					return await this.worker.executeAt(environment.root, environment.sdkVersion, {
						scriptPath: request.scriptPath,
						args: request.args,
						workdir: request.workdir,
						account: credential.account,
						password: credential.password
					}, (argv) => this.confineExecution(argv, request.workspaceRoot, request.sessionId).wrapped, this.operationSignal(signal));
				} catch (error) {
					if (error instanceof PandaWorkerError) throw error;
					throw new PandaWorkerError("execution-unavailable");
				}
			});
		}
		/**
		* Inspect the active SDK and restore persisted authentication.
		* @param signal - Operation lifetime.
		* @returns Safe connector state.
		*/
		describe(signal) {
			return this.execute("describe", () => this.runtime.describe(this.operationSignal(signal)), true);
		}
		/**
		* Discover the latest official SDK release without changing the active environment.
		* @param signal - Operation lifetime.
		* @returns Update metadata.
		*/
		checkForUpdates(signal) {
			return this.execute("check-for-updates", () => this.runtime.checkForUpdates(this.operationSignal(signal)), true);
		}
		/**
		* Install the latest official SDK into a new private environment.
		* @param signal - Operation lifetime.
		* @returns Activated connector state.
		*/
		bootstrap(signal) {
			return this.execute("bootstrap", () => this.runtime.bootstrap(this.operationSignal(signal), this.sessionCredential), true);
		}
		/**
		* Upgrade through candidate verification and pointer-only activation.
		* @param signal - Operation lifetime.
		* @returns Activated connector state.
		*/
		update(signal) {
			return this.execute("update", () => this.runtime.update(this.candidateCredential(), this.operationSignal(signal)), true);
		}
		/**
		* Rebuild the active release without modifying the current environment in place.
		* @param signal - Operation lifetime.
		* @returns Repaired connector state.
		*/
		repair(signal) {
			return this.execute("repair", () => this.runtime.repair(this.candidateCredential(), this.operationSignal(signal)), true);
		}
		/**
		* Restore the previously verified immutable environment.
		* @param signal - Operation lifetime.
		* @returns Rolled-back connector state.
		*/
		rollback(signal) {
			return this.execute("rollback", () => this.runtime.rollback(this.candidateCredential(), this.operationSignal(signal)), true);
		}
		/**
		* Authenticate and retain replay material in the OS credential store when available.
		* @param request - explicit account form and write-only password.
		* @param signal - caller/connection lifetime.
		* @returns `connected` after the one-shot SDK login succeeds.
		*/
		login(request, signal) {
			return this.serialize(async () => {
				if (typeof request.password !== "string" || request.password.length === 0 || request.password.length > 4096) return this.failure("invalid-request", "login");
				try {
					const account = normalizePandaAccount(request.account);
					this.publish(await this.runtime.login(account, request.password, true, this.operationSignal(signal)));
					const credential = {
						schemaVersion: 1,
						account,
						password: request.password
					};
					const active = this.runtimeStatus.active;
					if (active === null) throw new PandaWorkerError("sdk-not-ready");
					await this.probeEnvironment(active, credential, this.operationSignal(signal));
					this.sessionCredential = credential;
					try {
						await this.credentialVault.write(credential);
						this.vaultAvailable = true;
						this.credentialPersistence = "os-keyring";
					} catch (error) {
						if (!(error instanceof PandaCredentialVaultUnavailableError)) throw error;
						this.vaultAvailable = false;
						this.credentialPersistence = "session-only";
					}
					this.reconnectState = "idle";
					this.lastFailure = null;
					return this.success();
				} catch (error) {
					const code = this.failureCode(error);
					if (code === "execution-unavailable" && this.sessionCredential === void 0) this.phase = "ready";
					return this.failure(code, code === "execution-unavailable" ? "execution-check" : "login");
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
				const persisted = this.credentialPersistence === "os-keyring";
				this.sessionCredential = void 0;
				this.reconnectState = "idle";
				let vaultFailure = false;
				if (persisted) try {
					await this.credentialVault.delete();
					this.vaultAvailable = true;
				} catch (error) {
					if (!(error instanceof PandaCredentialVaultUnavailableError)) throw error;
					this.vaultAvailable = false;
					vaultFailure = true;
				}
				this.credentialPersistence = this.vaultAvailable ? "os-keyring" : "unavailable";
				try {
					this.publish(await this.runtime.logout(this.operationSignal(signal)));
				} catch (error) {
					this.phase = this.runtimeStatus.active === null ? "not-ready" : "ready";
					return this.failure(vaultFailure ? "logout-failed" : this.failureCode(error), "logout");
				}
				this.phase = "ready";
				this.dataReadiness = "unchecked";
				this.validatedEnvironmentId = void 0;
				this.resetExecutionState();
				this.lastFailure = null;
				return vaultFailure ? this.failure("logout-failed", "logout") : this.success();
			});
		}
		/** Abort active work and drain the serialized lifecycle queue. @returns settlement after all work has drained. */
		async disposeConnector() {
			if (this.disposed) return this.operationTail;
			this.disposed = true;
			this.lifecycle.abort(/* @__PURE__ */ new Error("panda-connector disposed"));
			await this.operationTail;
		}
		execute(operationName, operation, replayCredential) {
			return this.serialize(async () => {
				try {
					this.publish(await operation());
					if (replayCredential) {
						const replayFailure = await this.replayCredential();
						if (replayFailure !== void 0) return this.failure(replayFailure, replayFailure === "execution-unavailable" ? "execution-check" : operationName);
					}
					if (operationName !== "describe" && operationName !== "check-for-updates") this.lastFailure = null;
					return this.success();
				} catch (error) {
					const code = this.failureCode(error);
					return this.failure(code, code === "execution-unavailable" ? "execution-check" : operationName);
				}
			});
		}
		candidateCredential() {
			if (this.sessionCredential === void 0) throw new PandaWorkerError("login-failed");
			return this.sessionCredential;
		}
		serialize(operation) {
			const run = this.operationTail.then(operation, operation);
			/* v8 ignore next -- Remote operations convert expected failures to results; this keeps programmer faults from poisoning the queue. */
			this.operationTail = run.then(() => void 0, () => void 0);
			return run;
		}
		operationSignal(caller) {
			return caller === void 0 ? this.lifecycle.signal : AbortSignal.any([this.lifecycle.signal, caller]);
		}
		async restoreStoredCredential() {
			try {
				const credential = await this.credentialVault.read();
				this.vaultAvailable = true;
				this.credentialPersistence = "os-keyring";
				if (credential === void 0 || this.disposed) return;
				this.sessionCredential = credential;
				const replayFailure = await this.replayCredential();
				if (replayFailure !== void 0) this.recordFailure(replayFailure === "execution-unavailable" ? "execution-check" : "login", replayFailure);
			} catch (error) {
				if (error instanceof PandaCredentialVaultUnavailableError) {
					this.vaultAvailable = false;
					this.credentialPersistence = "unavailable";
					return;
				}
				this.vaultAvailable = false;
				this.credentialPersistence = "unavailable";
			}
		}
		async replayCredential() {
			const credential = this.sessionCredential;
			if (credential === void 0 || this.disposed) return void 0;
			if (this.runtimeStatus.active === null) try {
				const described = await this.runtime.describe(this.operationSignal());
				this.publish(described);
			} catch (error) {
				const code = this.failureCode(error);
				if (code === "sdk-not-ready") return void 0;
				return code;
			}
			if (this.runtimeStatus.active === null) return void 0;
			this.reconnectState = "reconnecting";
			try {
				this.publish(await this.runtime.login(credential.account, credential.password, true, this.operationSignal()));
				const active = this.runtimeStatus.active;
				await this.probeEnvironment(active, credential, this.operationSignal());
				this.reconnectState = "idle";
				return;
			} catch (error) {
				const code = this.failureCode(error);
				if (code === "login-failed") {
					this.sessionCredential = void 0;
					this.reconnectState = "reauth-required";
					try {
						await this.credentialVault.delete();
						this.vaultAvailable = true;
						this.credentialPersistence = "os-keyring";
					} catch (vaultError) {
						if (!(vaultError instanceof PandaCredentialVaultUnavailableError)) throw vaultError;
						this.vaultAvailable = false;
						this.credentialPersistence = "unavailable";
					}
				} else this.reconnectState = "idle";
				if (code !== "execution-unavailable") this.phase = "ready";
				return code;
			}
		}
		confineExecution(argv, workspaceRoot, sessionId) {
			const confined = this.ctx.sandbox.confine(argv, {
				mode: "workspace-write",
				workspaceRoot,
				...sessionId === void 0 ? {} : { sessionId }
			});
			const backend = executionBackend(confined);
			if (backend === null) throw new PandaWorkerError("execution-unavailable");
			return {
				wrapped: {
					argv: confined.argv,
					runnerFailureRules: confined.runnerFailureRules
				},
				backend,
				isolation: confined.enforcement
			};
		}
		async probeEnvironment(environment, credential, signal) {
			const compatibility = pandaSdkCompatibility(environment.sdkVersion);
			if (compatibility === void 0) throw new PandaWorkerError("incompatible-api");
			let probeRoot;
			let confinement;
			try {
				const createdProbeRoot = await mkdtemp(join(tmpdir(), "dsh-panda-execution-"));
				probeRoot = createdProbeRoot;
				const scriptPath = join(createdProbeRoot, "panda_execution_probe.py");
				await copyFile(EXECUTION_PROBE_SOURCE, scriptPath);
				const preparedConfinement = this.confineExecution(this.worker.executionArgv(environment.root), createdProbeRoot, void 0);
				confinement = preparedConfinement;
				const cached = this.findExecutionEvidence(environment, preparedConfinement.backend);
				if (cached !== void 0) {
					this.applyExecutionEvidence(cached);
					return;
				}
				if (this.runtimeStatus.active?.id === environment.id) {
					this.executionReadiness = "unavailable";
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
					password: credential.password
				}, () => preparedConfinement.wrapped, signal);
				const marker = result.stdout.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean).at(-1);
				if (result.exitCode !== 0 || marker !== EXECUTION_PROBE_SUCCESS) throw new PandaWorkerError("execution-unavailable");
				const evidence = {
					environmentId: environment.id,
					apiFingerprint: environment.apiFingerprint,
					backend: preparedConfinement.backend,
					isolation: preparedConfinement.isolation,
					checkedAt: Date.now()
				};
				this.executionEvidence.set(this.executionEvidenceKey(evidence), evidence);
				this.applyExecutionEvidence(evidence);
			} catch (error) {
				if (this.runtimeStatus.active?.id === environment.id) {
					this.executionReadiness = "unavailable";
					this.executionEnvironmentId = environment.id;
					this.executionIsolation = confinement?.isolation ?? null;
					this.executionBackend = confinement?.backend ?? null;
					this.lastExecutionCheckedAt = Date.now();
				}
				if (error instanceof PandaWorkerError && error.code === "cancelled") throw error;
				throw new PandaWorkerError("execution-unavailable");
			} finally {
				if (probeRoot !== void 0) try {
					await rm(probeRoot, {
						recursive: true,
						force: true
					});
				} catch {}
			}
		}
		executionEvidenceKey(evidence) {
			return `${evidence.environmentId}\0${evidence.apiFingerprint}\0${evidence.backend}`;
		}
		findExecutionEvidence(environment, backend) {
			return this.executionEvidence.get(this.executionEvidenceKey({
				environmentId: environment.id,
				apiFingerprint: environment.apiFingerprint,
				backend
			}));
		}
		latestExecutionEvidence(environment) {
			return [...this.executionEvidence.values()].filter((evidence) => evidence.environmentId === environment.id && evidence.apiFingerprint === environment.apiFingerprint).sort((left, right) => right.checkedAt - left.checkedAt)[0];
		}
		applyExecutionEvidence(evidence) {
			if (this.runtimeStatus.active?.id !== evidence.environmentId) return;
			this.executionReadiness = "ready";
			this.executionEnvironmentId = evidence.environmentId;
			this.executionIsolation = evidence.isolation;
			this.executionBackend = evidence.backend;
			this.lastExecutionCheckedAt = evidence.checkedAt;
		}
		resetExecutionState() {
			this.executionReadiness = "unchecked";
			this.executionEnvironmentId = void 0;
			this.executionIsolation = null;
			this.executionBackend = null;
			this.lastExecutionCheckedAt = null;
		}
		publish(status) {
			/* v8 ignore next -- Worker completion rejects after lifecycle abort; this guard protects later implementation changes. */
			if (this.disposed) return;
			this.runtimeStatus = status;
			const response = status.response;
			const activeId = status.active?.id;
			if (response?.dataValidated === true && activeId !== void 0) {
				this.validatedEnvironmentId = activeId;
				this.dataReadiness = "verified";
				this.lastDataValidatedAt = Date.now();
			} else if (activeId !== this.validatedEnvironmentId) {
				this.validatedEnvironmentId = void 0;
				this.dataReadiness = "unchecked";
				this.lastDataValidatedAt = null;
			}
			const activeEvidence = status.active === null ? void 0 : this.latestExecutionEvidence(status.active);
			if (activeEvidence !== void 0) this.applyExecutionEvidence(activeEvidence);
			else if (activeId !== this.executionEnvironmentId) this.resetExecutionState();
			if (status.active === null || response?.installedSdkVersion !== status.active.sdkVersion) this.phase = "not-ready";
			else this.phase = response.authenticated ? "connected" : "ready";
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
				requiredSdkVersion: this.runtimeStatus.latestSdkVersion ?? active?.sdkVersion ?? "0.0.12",
				installedSdkVersion: active?.sdkVersion ?? null,
				latestSdkVersion: this.runtimeStatus.latestSdkVersion,
				updateAvailable: this.runtimeStatus.updateAvailable,
				rollbackSdkVersion: this.runtimeStatus.previous?.sdkVersion ?? null,
				pythonVersion: active?.pythonVersion ?? null,
				pythonSource: active?.pythonSource ?? null,
				apiFingerprint: active?.apiFingerprint ?? null,
				capabilities: active?.capabilities ?? null,
				lastUpdateCheckedAt: this.runtimeStatus.lastUpdateCheckedAt,
				logoutSupported: this.runtimeStatus.response?.logoutSupported ?? false
			};
		}
		success() {
			return {
				ok: true,
				state: this.state()
			};
		}
		failure(code, operation) {
			this.recordFailure(operation, code);
			if (operation === "login" && (code === "data-validation-failed" || code === "network-unavailable")) this.dataReadiness = "unavailable";
			return {
				ok: false,
				code,
				message: FAILURE_MESSAGE[code],
				state: this.state()
			};
		}
		recordFailure(operation, code) {
			this.lastFailure = {
				operation,
				code,
				occurredAt: Date.now()
			};
		}
		failureCode(error) {
			if (error instanceof PandaAccountError) return "invalid-request";
			if (error instanceof PandaWorkerError) return error.code;
			return "worker-failed";
		}
	};
})();
//#endregion
export { Config, PANDA_DATA_VERSION, PandaAccountError, PandaConnector, PandaConnector as default, PandaRuntimeManager, PandaWorkerClient, PandaWorkerError, inject, name, normalizePandaAccount, parsePandaRelease };
