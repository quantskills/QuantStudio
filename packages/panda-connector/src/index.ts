/** Host-only PandaData authentication and managed-runtime connector. */

import { copyFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import type { ConfinedArgv, SandboxEnforcement } from '@deepseek-ai/dsh-sandbox'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { normalizePandaAccount, PandaAccountError } from './account.ts'
import {
  createPandaCredentialVault,
  PandaCredentialVaultUnavailableError,
  type PandaCredentialVault,
  type PandaStoredCredential,
} from './credential-vault.ts'
import { pandaSdkCompatibility } from './compatibility.ts'
import {
  PandaRuntimeManager,
  type PandaRuntimeCredential,
  type PandaRuntimeEnvironment,
  type PandaRuntimeStatus,
} from './runtime.ts'
import { PANDA_DATA_VERSION, PandaWorkerClient, PandaWorkerError } from './worker.ts'
import type { PandaExecutionArgv, PandaScriptExecutionResult, PandaWorkerConfig } from './worker.ts'
import type {
  PandaConnectionPhase,
  PandaConnectionState,
  PandaConnectorFailure,
  PandaConnectorFailureCode,
  PandaConnectorFailureRecord,
  PandaConnectorOperation,
  PandaConnectorResult,
  PandaExecutionBackend,
  PandaExecutionIsolation,
  PandaLoginRequest,
  PandaRuntimeBinding,
} from './types.ts'

export { normalizePandaAccount, PandaAccountError } from './account.ts'
export { PandaRuntimeManager, parsePandaRelease } from './runtime.ts'
export type { PandaRelease, PandaRuntimeEnvironment, PandaRuntimeStatus } from './runtime.ts'
export { PANDA_DATA_VERSION, PandaWorkerClient, PandaWorkerError } from './worker.ts'
export type * from './types.ts'
export type { NormalizedPandaAccount } from './account.ts'
export type { PandaProcessRuntime, PandaWorkerConfig, PandaWorkerResponse } from './worker.ts'

/** Cordis plugin name for Loader diagnostics. */
export const name = 'panda-connector'
/** Host service required by the connector. */
export const inject = ['sandbox', 'subprocess']

/** Host-only execution request whose paths were authorized against one Session workspace. */
export interface PandaPythonExecutionRequest {
  readonly binding: PandaRuntimeBinding
  readonly sessionId: SessionId
  readonly workspaceRoot: string
  readonly scriptPath: string
  readonly args: readonly string[]
  readonly workdir: string
}

const DEFAULT_BASE_URL = 'http://pandadata.pandaaiquant.com'
const DEFAULT_RELEASE_INDEX_URL = 'https://pypi.org/pypi/panda_data/json'
const DEFAULT_OPERATION_TIMEOUT_MS = 30_000
const DEFAULT_RELEASE_TIMEOUT_MS = 15_000
const DEFAULT_BOOTSTRAP_TIMEOUT_MS = 12 * 60_000
const DEFAULT_TERMINATE_GRACE_MS = 2_000
const DEFAULT_MAX_OUTPUT_BYTES = 65_536
const DEFAULT_MANAGED_PYTHON_VERSION = '3.12'
const EXECUTION_PROBE_SUCCESS = 'PANDADATA_EXECUTION_PROBE_OK'
const EXECUTION_PROBE_SOURCE = fileURLToPath(new URL('../worker/panda_execution_probe.py', import.meta.url))
/* v8 ignore next -- Windows and POSIX coverage lanes each exercise their native launcher default. */
const DEFAULT_PYTHON_COMMAND = process.platform === 'win32' ? 'py' : 'python3'
/* v8 ignore next -- Windows and POSIX coverage lanes each exercise their native launcher arguments. */
const DEFAULT_PYTHON_ARGS = process.platform === 'win32' ? ['-3.10'] : []
const PLUGIN_PROJECT_ROOT = resolve(process.env.INIT_CWD ?? process.cwd())

/** Connector process, release discovery, and private-runtime configuration. */
export interface Config {
  /** Python launcher resolved through `ctx.subprocess`. */
  pythonCommand?: string
  /** Launcher arguments placed before the bundled worker path. */
  pythonArgs?: string[]
  /** Python release installed into the connector-owned runtime directory by uv. */
  managedPythonVersion?: string
  /** Optional DSH home override; all private runtimes live below it. */
  dshHome?: string
  /** PandaData service root passed to `panda_data.init_token`. */
  baseURL?: string
  /** Official PyPI-compatible release index used for SDK discovery. */
  releaseIndexURL?: string
  /** Release-index request deadline. */
  releaseTimeoutMs?: number
  /** Login, logout, and describe deadline. */
  operationTimeoutMs?: number
  /** Private-environment creation and SDK installation deadline. */
  bootstrapTimeoutMs?: number
  /** Process-tree termination grace. */
  terminateGraceMs?: number
  /** Per-stream retained worker output bound; stderr remains private. */
  maxOutputBytes?: number
}

/** Plugin configuration schema. */
export const Config: z<Config> = z.object({
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
})

type ResolvedConfig = Required<Omit<Config, 'dshHome'>> & Pick<Config, 'dshHome'>

interface PandaExecutionEvidence {
  readonly environmentId: string
  readonly apiFingerprint: string
  readonly backend: PandaExecutionBackend
  readonly isolation: PandaExecutionIsolation
  readonly checkedAt: number
}

interface PandaExecutionConfinement {
  readonly wrapped: PandaExecutionArgv
  readonly backend: PandaExecutionBackend
  readonly isolation: SandboxEnforcement
}

function executionBackend(confined: ConfinedArgv): PandaExecutionBackend | null {
  const signatures = new Set(confined.runnerFailureRules
    .flatMap(rule => rule.fatalSignatures)
    .map(signature => signature.trim().toLowerCase()))
  if (process.platform === 'win32') return signatures.has('windows-acl-run:') ? 'windows-acl' : null
  if (process.platform === 'darwin') return signatures.has('sandbox-exec:') ? 'seatbelt' : null
  if (process.platform === 'linux') {
    if (signatures.has('bwrap:')) return 'bwrap'
    if (signatures.has('landlock-run:')) return 'landlock'
  }
  return null
}

const FAILURE_MESSAGE: Record<PandaConnectorFailureCode, string> = {
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
}

interface ValidatedConfig {
  readonly worker: PandaWorkerConfig
  readonly managerRoot: string
  readonly legacyRoot: string
  readonly releaseIndexURL: string
  readonly releaseTimeoutMs: number
}

function validateHttpURL(name: string, value: string, httpsOnly = false): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`panda-connector: ${name} must be an HTTP(S) URL`)
  }
  if ((httpsOnly ? url.protocol !== 'https:' : url.protocol !== 'http:' && url.protocol !== 'https:')
    || url.username !== '' || url.password !== '' || url.hash !== '') {
    throw new Error(`panda-connector: ${name} must be a credential-free ${httpsOnly ? 'HTTPS' : 'HTTP(S)'} URL`)
  }
  return url.href.replace(/\/$/u, '')
}

function validateConfig(config: ResolvedConfig): ValidatedConfig {
  if (config.pythonCommand.trim().length === 0) throw new Error('panda-connector: pythonCommand must be non-empty')
  if (config.pythonArgs.some(value => value.length === 0)) throw new Error('panda-connector: pythonArgs entries must be non-empty')
  if (!/^[0-9]+\.[0-9]+$/u.test(config.managedPythonVersion)) throw new Error('panda-connector: managedPythonVersion must be a major.minor release')
  for (const [key, value] of Object.entries({
    releaseTimeoutMs: config.releaseTimeoutMs,
    operationTimeoutMs: config.operationTimeoutMs,
    bootstrapTimeoutMs: config.bootstrapTimeoutMs,
    terminateGraceMs: config.terminateGraceMs,
    maxOutputBytes: config.maxOutputBytes,
  })) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`panda-connector: ${key} must be a positive integer`)
  }
  const dshHome = resolveDshHome(config.dshHome)
  const managerRoot = resolve(dshHome, 'runtimes', 'pandadata')
  const activeVirtualEnvironment = process.env.VIRTUAL_ENV?.trim()
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
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host-owned PandaData authentication and managed-runtime connector. */
    pandaConnector: PandaConnector
  }
}

/** Serialized PandaData lifecycle service exported through Typert Remote. */
export class PandaConnector extends TypertRemoteService {
  static inject = inject
  static Config = Config

  private readonly runtime: PandaRuntimeManager
  private readonly worker: PandaWorkerClient
  private readonly credentialVault: PandaCredentialVault
  private readonly lifecycle = new AbortController()
  private operationTail: Promise<void> = Promise.resolve()
  private phase: PandaConnectionPhase = 'not-ready'
  private runtimeStatus: PandaRuntimeStatus = {
    active: null, previous: null, response: null, latestSdkVersion: null,
    updateAvailable: false, lastUpdateCheckedAt: null,
  }
  private sessionCredential: PandaStoredCredential | undefined
  private credentialPersistence: PandaConnectionState['credentialPersistence'] = 'unavailable'
  private reconnectState: PandaConnectionState['reconnectState'] = 'idle'
  private dataReadiness: PandaConnectionState['dataReadiness'] = 'unchecked'
  private validatedEnvironmentId: string | undefined
  private lastDataValidatedAt: number | null = null
  private executionReadiness: PandaConnectionState['executionReadiness'] = 'unchecked'
  private executionIsolation: PandaExecutionIsolation | null = null
  private executionBackend: PandaExecutionBackend | null = null
  private executionEnvironmentId: string | undefined
  private lastExecutionCheckedAt: number | null = null
  private readonly executionEvidence = new Map<string, PandaExecutionEvidence>()
  private lastFailure: PandaConnectorFailureRecord | null = null
  private vaultAvailable = false
  private disposed = false

  /**
   * Create the Host service and bind worker teardown to the Cordis scope.
   * @param ctx - Cordis context containing the subprocess capability.
   * @param config - resolved connector configuration.
   */
  constructor(ctx: Context, config: ResolvedConfig) {
    super(ctx, 'pandaConnector')
    const validated = validateConfig(config)
    this.worker = new PandaWorkerClient(ctx.subprocess, validated.worker)
    this.runtime = new PandaRuntimeManager(this.worker, {
      managerRoot: validated.managerRoot,
      legacyRoot: validated.legacyRoot,
      releaseIndexURL: validated.releaseIndexURL,
      releaseTimeoutMs: validated.releaseTimeoutMs,
      executionProbe: (environment, credential, signal) => this.probeEnvironment(environment, credential, signal),
    })
    this.credentialVault = createPandaCredentialVault()
    this.operationTail = this.restoreStoredCredential()
    ctx.effect(() => async () => this.disposeConnector(), 'panda-connector.worker-lifecycle')
  }

  /**
   * Return the exact connected runtime identity to freeze into a Session.
   * @returns immutable binding for the active verified environment.
   */
  runtimeBinding(): PandaRuntimeBinding {
    const active = this.runtimeStatus.active
    if (this.phase !== 'connected' || active === null || this.sessionCredential === undefined) throw new PandaWorkerError('login-failed')
    if (this.dataReadiness !== 'verified' || this.validatedEnvironmentId !== active.id
      || this.executionReadiness !== 'ready' || this.executionEnvironmentId !== active.id) {
      throw new PandaWorkerError('execution-unavailable')
    }
    return Object.freeze({
      environmentId: active.id,
      sdkVersion: active.sdkVersion,
      pythonVersion: active.pythonVersion,
      apiFingerprint: active.apiFingerprint,
    })
  }

  /**
   * Verify that a Session-recorded environment remains retained and executable with Host credentials.
   * @param binding - exact runtime identity read from the Session log.
   */
  async validateRuntimeBinding(binding: PandaRuntimeBinding): Promise<void> {
    return this.serialize(async () => {
      const credential = this.sessionCredential
      if (credential === undefined) throw new PandaWorkerError('login-failed')
      const environment = await this.runtime.environment(binding.environmentId)
      if (environment === undefined
        || environment.sdkVersion !== binding.sdkVersion
        || environment.pythonVersion !== binding.pythonVersion
        || environment.apiFingerprint !== binding.apiFingerprint) {
        throw new PandaWorkerError('sdk-version-mismatch')
      }
      await this.probeEnvironment(environment, credential, this.operationSignal())
    })
  }

  /**
   * Execute one authorized script through the exact Session runtime and an available Host confinement backend.
   * @param request - immutable runtime identity and canonical Host-authorized paths.
   * @param signal - execution lifetime.
   * @returns bounded process outcome without credential material.
   */
  executePython(request: PandaPythonExecutionRequest, signal?: AbortSignal): Promise<PandaScriptExecutionResult> {
    return this.serialize(async () => {
      const credential = this.sessionCredential
      if (credential === undefined) throw new PandaWorkerError('login-failed')
      const environment = await this.runtime.environment(request.binding.environmentId)
      if (environment === undefined
        || environment.sdkVersion !== request.binding.sdkVersion
        || environment.pythonVersion !== request.binding.pythonVersion
        || environment.apiFingerprint !== request.binding.apiFingerprint) {
        throw new PandaWorkerError('sdk-version-mismatch')
      }
      try {
        return await this.worker.executeAt(
          environment.root,
          environment.sdkVersion,
          {
            scriptPath: request.scriptPath,
            args: request.args,
            workdir: request.workdir,
            account: credential.account,
            password: credential.password,
          },
          argv => this.confineExecution(argv, request.workspaceRoot, request.sessionId).wrapped,
          this.operationSignal(signal),
        )
      } catch (error: unknown) {
        if (error instanceof PandaWorkerError) throw error
        throw new PandaWorkerError('execution-unavailable')
      }
    })
  }

  /**
   * Inspect the active SDK and restore persisted authentication.
   * @param signal - Operation lifetime.
   * @returns Safe connector state.
   */
  @Remote
  describe(signal?: AbortSignal): Promise<PandaConnectorResult> {
    return this.execute('describe', () => this.runtime.describe(this.operationSignal(signal)), true)
  }

  /**
   * Discover the latest official SDK release without changing the active environment.
   * @param signal - Operation lifetime.
   * @returns Update metadata.
   */
  @Remote
  checkForUpdates(signal?: AbortSignal): Promise<PandaConnectorResult> {
    return this.execute('check-for-updates', () => this.runtime.checkForUpdates(this.operationSignal(signal)), true)
  }

  /**
   * Install the latest official SDK into a new private environment.
   * @param signal - Operation lifetime.
   * @returns Activated connector state.
   */
  @Remote
  bootstrap(signal?: AbortSignal): Promise<PandaConnectorResult> {
    return this.execute('bootstrap', () => this.runtime.bootstrap(this.operationSignal(signal), this.sessionCredential), true)
  }

  /**
   * Upgrade through candidate verification and pointer-only activation.
   * @param signal - Operation lifetime.
   * @returns Activated connector state.
   */
  @Remote
  update(signal?: AbortSignal): Promise<PandaConnectorResult> {
    return this.execute('update', () => this.runtime.update(this.candidateCredential(), this.operationSignal(signal)), true)
  }

  /**
   * Rebuild the active release without modifying the current environment in place.
   * @param signal - Operation lifetime.
   * @returns Repaired connector state.
   */
  @Remote
  repair(signal?: AbortSignal): Promise<PandaConnectorResult> {
    return this.execute('repair', () => this.runtime.repair(this.candidateCredential(), this.operationSignal(signal)), true)
  }

  /**
   * Restore the previously verified immutable environment.
   * @param signal - Operation lifetime.
   * @returns Rolled-back connector state.
   */
  @Remote
  rollback(signal?: AbortSignal): Promise<PandaConnectorResult> {
    return this.execute('rollback', () => this.runtime.rollback(this.candidateCredential(), this.operationSignal(signal)), true)
  }

  /**
   * Authenticate and retain replay material in the OS credential store when available.
   * @param request - explicit account form and write-only password.
   * @param signal - caller/connection lifetime.
   * @returns `connected` after the one-shot SDK login succeeds.
   */
  @Remote
  login(request: PandaLoginRequest, signal?: AbortSignal): Promise<PandaConnectorResult> {
    return this.serialize(async () => {
      if (typeof request.password !== 'string' || request.password.length === 0 || request.password.length > 4096) return this.failure('invalid-request', 'login')
      try {
        const account = normalizePandaAccount(request.account)
        this.publish(await this.runtime.login(account, request.password, true, this.operationSignal(signal)))
        const credential: PandaStoredCredential = {
          schemaVersion: 1,
          account,
          password: request.password,
        }
        const active = this.runtimeStatus.active
        if (active === null) throw new PandaWorkerError('sdk-not-ready')
        await this.probeEnvironment(active, credential, this.operationSignal(signal))
        this.sessionCredential = credential
        try {
          await this.credentialVault.write(credential)
          this.vaultAvailable = true
          this.credentialPersistence = 'os-keyring'
        } catch (error: unknown) {
          if (!(error instanceof PandaCredentialVaultUnavailableError)) throw error
          this.vaultAvailable = false
          this.credentialPersistence = 'session-only'
        }
        this.reconnectState = 'idle'
        this.lastFailure = null
        return this.success()
      } catch (error: unknown) {
        const code = this.failureCode(error)
        if (code === 'execution-unavailable' && this.sessionCredential === undefined) this.phase = 'ready'
        return this.failure(code, code === 'execution-unavailable' ? 'execution-check' : 'login')
      }
    })
  }

  /**
   * Clear Host-owned replay material and ask every retained SDK environment to log out.
   * @param signal - Operation lifetime.
   * @returns Verified disconnected state.
   */
  @Remote
  logout(signal?: AbortSignal): Promise<PandaConnectorResult> {
    return this.serialize(async () => {
      const persisted = this.credentialPersistence === 'os-keyring'
      this.sessionCredential = undefined
      this.reconnectState = 'idle'
      let vaultFailure = false
      if (persisted) {
        try {
          await this.credentialVault.delete()
          this.vaultAvailable = true
        } catch (error: unknown) {
          if (!(error instanceof PandaCredentialVaultUnavailableError)) throw error
          this.vaultAvailable = false
          vaultFailure = true
        }
      }
      this.credentialPersistence = this.vaultAvailable ? 'os-keyring' : 'unavailable'
      try {
        this.publish(await this.runtime.logout(this.operationSignal(signal)))
      } catch (error: unknown) {
        this.phase = this.runtimeStatus.active === null ? 'not-ready' : 'ready'
        return this.failure(vaultFailure ? 'logout-failed' : this.failureCode(error), 'logout')
      }
      this.phase = 'ready'
      this.dataReadiness = 'unchecked'
      this.validatedEnvironmentId = undefined
      this.resetExecutionState()
      this.lastFailure = null
      return vaultFailure ? this.failure('logout-failed', 'logout') : this.success()
    })
  }

  /** Abort active work and drain the serialized lifecycle queue. @returns settlement after all work has drained. */
  async disposeConnector(): Promise<void> {
    if (this.disposed) return this.operationTail
    this.disposed = true
    this.lifecycle.abort(new Error('panda-connector disposed'))
    await this.operationTail
  }

  private execute(
    operationName: PandaConnectorOperation,
    operation: () => Promise<PandaRuntimeStatus>,
    replayCredential: boolean,
  ): Promise<PandaConnectorResult> {
    return this.serialize(async () => {
      try {
        this.publish(await operation())
        if (replayCredential) {
          const replayFailure = await this.replayCredential()
          if (replayFailure !== undefined) {
            return this.failure(replayFailure, replayFailure === 'execution-unavailable' ? 'execution-check' : operationName)
          }
        }
        if (operationName !== 'describe' && operationName !== 'check-for-updates') this.lastFailure = null
        return this.success()
      } catch (error: unknown) {
        const code = this.failureCode(error)
        return this.failure(code, code === 'execution-unavailable' ? 'execution-check' : operationName)
      }
    })
  }

  private candidateCredential(): PandaRuntimeCredential {
    if (this.sessionCredential === undefined) throw new PandaWorkerError('login-failed')
    return this.sessionCredential
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.operationTail.then(operation, operation)
    /* v8 ignore next -- Remote operations convert expected failures to results; this keeps programmer faults from poisoning the queue. */
    this.operationTail = run.then(() => undefined, () => undefined)
    return run
  }

  private operationSignal(caller?: AbortSignal): AbortSignal {
    return caller === undefined ? this.lifecycle.signal : AbortSignal.any([this.lifecycle.signal, caller])
  }

  private async restoreStoredCredential(): Promise<void> {
    try {
      const credential = await this.credentialVault.read()
      this.vaultAvailable = true
      this.credentialPersistence = 'os-keyring'
      if (credential === undefined || this.disposed) return
      this.sessionCredential = credential
      const replayFailure = await this.replayCredential()
      if (replayFailure !== undefined) this.recordFailure(replayFailure === 'execution-unavailable' ? 'execution-check' : 'login', replayFailure)
    } catch (error: unknown) {
      if (error instanceof PandaCredentialVaultUnavailableError) {
        this.vaultAvailable = false
        this.credentialPersistence = 'unavailable'
        return
      }
      this.vaultAvailable = false
      this.credentialPersistence = 'unavailable'
    }
  }

  private async replayCredential(): Promise<PandaConnectorFailureCode | undefined> {
    const credential = this.sessionCredential
    if (credential === undefined || this.disposed) return undefined
    if (this.runtimeStatus.active === null) {
      try {
        const described = await this.runtime.describe(this.operationSignal())
        this.publish(described)
      } catch (error: unknown) {
        const code = this.failureCode(error)
        if (code === 'sdk-not-ready') return undefined
        return code
      }
    }
    if (this.runtimeStatus.active === null) return undefined
    this.reconnectState = 'reconnecting'
    try {
      this.publish(await this.runtime.login(
        credential.account,
        credential.password,
        true,
        this.operationSignal(),
      ))
      const active = this.runtimeStatus.active
      await this.probeEnvironment(active, credential, this.operationSignal())
      this.reconnectState = 'idle'
      return undefined
    } catch (error: unknown) {
      const code = this.failureCode(error)
      if (code === 'login-failed') {
        this.sessionCredential = undefined
        this.reconnectState = 'reauth-required'
        try {
          await this.credentialVault.delete()
          this.vaultAvailable = true
          this.credentialPersistence = 'os-keyring'
        } catch (vaultError: unknown) {
          if (!(vaultError instanceof PandaCredentialVaultUnavailableError)) throw vaultError
          this.vaultAvailable = false
          this.credentialPersistence = 'unavailable'
        }
      } else {
        this.reconnectState = 'idle'
      }
      if (code !== 'execution-unavailable') this.phase = 'ready'
      return code
    }
  }

  private confineExecution(argv: readonly string[], workspaceRoot: string, sessionId?: SessionId): PandaExecutionConfinement {
    const confined = this.ctx.sandbox.confine(argv, {
      mode: 'workspace-write',
      workspaceRoot,
      ...(sessionId === undefined ? {} : { sessionId }),
    })
    const backend = executionBackend(confined)
    if (backend === null) throw new PandaWorkerError('execution-unavailable')
    return {
      wrapped: { argv: confined.argv, runnerFailureRules: confined.runnerFailureRules },
      backend,
      isolation: confined.enforcement,
    }
  }

  private async probeEnvironment(
    environment: PandaRuntimeEnvironment,
    credential: PandaRuntimeCredential,
    signal?: AbortSignal,
  ): Promise<void> {
    const compatibility = pandaSdkCompatibility(environment.sdkVersion)
    if (compatibility === undefined) throw new PandaWorkerError('incompatible-api')
    let probeRoot: string | undefined
    let confinement: PandaExecutionConfinement | undefined
    try {
      const createdProbeRoot = await mkdtemp(join(tmpdir(), 'dsh-panda-execution-'))
      probeRoot = createdProbeRoot
      const scriptPath = join(createdProbeRoot, 'panda_execution_probe.py')
      await copyFile(EXECUTION_PROBE_SOURCE, scriptPath)
      const preparedConfinement = this.confineExecution(this.worker.executionArgv(environment.root), createdProbeRoot, undefined)
      confinement = preparedConfinement
      const cached = this.findExecutionEvidence(environment, preparedConfinement.backend)
      if (cached !== undefined) {
        this.applyExecutionEvidence(cached)
        return
      }
      if (this.runtimeStatus.active?.id === environment.id) {
        this.executionReadiness = 'unavailable'
        this.executionEnvironmentId = environment.id
        this.executionIsolation = preparedConfinement.isolation
        this.executionBackend = preparedConfinement.backend
        this.lastExecutionCheckedAt = Date.now()
      }
      const result = await this.worker.executeAt(
        environment.root,
        environment.sdkVersion,
        {
          scriptPath,
          args: [JSON.stringify(compatibility.validationCall)],
          workdir: createdProbeRoot,
          account: credential.account,
          password: credential.password,
        },
        () => preparedConfinement.wrapped,
        signal,
      )
      const marker = result.stdout.split(/\r?\n/u).map(line => line.trim()).filter(Boolean).at(-1)
      if (result.exitCode !== 0 || marker !== EXECUTION_PROBE_SUCCESS) {
        throw new PandaWorkerError('execution-unavailable')
      }
      const evidence: PandaExecutionEvidence = {
        environmentId: environment.id,
        apiFingerprint: environment.apiFingerprint,
        backend: preparedConfinement.backend,
        isolation: preparedConfinement.isolation,
        checkedAt: Date.now(),
      }
      this.executionEvidence.set(this.executionEvidenceKey(evidence), evidence)
      this.applyExecutionEvidence(evidence)
    } catch (error: unknown) {
      if (this.runtimeStatus.active?.id === environment.id) {
        this.executionReadiness = 'unavailable'
        this.executionEnvironmentId = environment.id
        this.executionIsolation = confinement?.isolation ?? null
        this.executionBackend = confinement?.backend ?? null
        this.lastExecutionCheckedAt = Date.now()
      }
      if (error instanceof PandaWorkerError && error.code === 'cancelled') throw error
      throw new PandaWorkerError('execution-unavailable')
    } finally {
      if (probeRoot !== undefined) {
        try {
          await rm(probeRoot, { recursive: true, force: true })
        } catch {
          /* The probe workspace contains only the public script; cleanup failure must not replace execution evidence. */
        }
      }
    }
  }

  private executionEvidenceKey(evidence: Pick<PandaExecutionEvidence, 'environmentId' | 'apiFingerprint' | 'backend'>): string {
    return `${evidence.environmentId}\0${evidence.apiFingerprint}\0${evidence.backend}`
  }

  private findExecutionEvidence(
    environment: PandaRuntimeEnvironment,
    backend: PandaExecutionBackend,
  ): PandaExecutionEvidence | undefined {
    return this.executionEvidence.get(this.executionEvidenceKey({
      environmentId: environment.id,
      apiFingerprint: environment.apiFingerprint,
      backend,
    }))
  }

  private latestExecutionEvidence(environment: PandaRuntimeEnvironment): PandaExecutionEvidence | undefined {
    return [...this.executionEvidence.values()]
      .filter(evidence => evidence.environmentId === environment.id && evidence.apiFingerprint === environment.apiFingerprint)
      .sort((left, right) => right.checkedAt - left.checkedAt)[0]
  }

  private applyExecutionEvidence(evidence: PandaExecutionEvidence): void {
    if (this.runtimeStatus.active?.id !== evidence.environmentId) return
    this.executionReadiness = 'ready'
    this.executionEnvironmentId = evidence.environmentId
    this.executionIsolation = evidence.isolation
    this.executionBackend = evidence.backend
    this.lastExecutionCheckedAt = evidence.checkedAt
  }

  private resetExecutionState(): void {
    this.executionReadiness = 'unchecked'
    this.executionEnvironmentId = undefined
    this.executionIsolation = null
    this.executionBackend = null
    this.lastExecutionCheckedAt = null
  }

  private publish(status: PandaRuntimeStatus): void {
    /* v8 ignore next -- Worker completion rejects after lifecycle abort; this guard protects later implementation changes. */
    if (this.disposed) return
    this.runtimeStatus = status
    const response = status.response
    const activeId = status.active?.id
    if (response?.dataValidated === true && activeId !== undefined) {
      this.validatedEnvironmentId = activeId
      this.dataReadiness = 'verified'
      this.lastDataValidatedAt = Date.now()
    } else if (activeId !== this.validatedEnvironmentId) {
      this.validatedEnvironmentId = undefined
      this.dataReadiness = 'unchecked'
      this.lastDataValidatedAt = null
    }
    const activeEvidence = status.active === null ? undefined : this.latestExecutionEvidence(status.active)
    if (activeEvidence !== undefined) this.applyExecutionEvidence(activeEvidence)
    else if (activeId !== this.executionEnvironmentId) this.resetExecutionState()
    if (status.active === null || response?.installedSdkVersion !== status.active.sdkVersion) this.phase = 'not-ready'
    else this.phase = response.authenticated ? 'connected' : 'ready'
  }

  private state(): PandaConnectionState {
    const active = this.runtimeStatus.active
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
    }
  }

  private success(): PandaConnectorResult {
    return { ok: true, state: this.state() }
  }

  private failure(code: PandaConnectorFailureCode, operation: PandaConnectorOperation): PandaConnectorFailure {
    this.recordFailure(operation, code)
    if (operation === 'login' && (code === 'data-validation-failed' || code === 'network-unavailable')) {
      this.dataReadiness = 'unavailable'
    }
    return { ok: false, code, message: FAILURE_MESSAGE[code], state: this.state() }
  }

  private recordFailure(operation: PandaConnectorOperation, code: PandaConnectorFailureCode): void {
    this.lastFailure = { operation, code, occurredAt: Date.now() }
  }

  private failureCode(error: unknown): PandaConnectorFailureCode {
    if (error instanceof PandaAccountError) return 'invalid-request'
    if (error instanceof PandaWorkerError) return error.code
    return 'worker-failed'
  }
}

export default PandaConnector
