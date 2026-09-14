/** Immutable PandaData environments, release discovery, activation, and rollback. */

import { randomUUID } from 'node:crypto'
import type { Dirent } from 'node:fs'
import { lstat, mkdir, readFile, readdir, rename, rm, unlink, writeFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import type { NormalizedPandaAccount } from './account.ts'
import type { PandaPythonSource, PandaSdkCapabilities } from './types.ts'
import {
  PANDA_SDK_COMPATIBILITY,
  pandaSdkCompatibility,
  type PandaSdkCompatibility,
} from './compatibility.ts'
import {
  PANDA_DATA_VERSION,
  PandaWorkerError,
  type PandaWorkerClient,
  type PandaWorkerResponse,
} from './worker.ts'

const ACTIVATION_SCHEMA_VERSION = 2
const RELEASE_BODY_LIMIT = 2 * 1024 * 1024
const SHA256_PATTERN = /^[0-9a-f]{64}$/
const CANDIDATE_ID_PATTERN = /^\d+\.\d+\.\d+-[0-9a-f]{12}-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u

/** Exact wheel selected from the official package index. */
export interface PandaRelease {
  readonly version: string
  readonly wheelURL: string
  readonly wheelSha256: string
}

/** Immutable environment recorded in the activation pointer. */
export interface PandaRuntimeEnvironment {
  readonly id: string
  readonly root: string
  readonly sdkVersion: string
  readonly pythonSource: PandaPythonSource
  readonly pythonVersion: string
  readonly apiFingerprint: string
  readonly publicCallables: readonly string[]
  readonly capabilities: PandaSdkCapabilities
  readonly createdAt: number
}

/** Runtime state used by the Host connector projection. */
export interface PandaRuntimeStatus {
  readonly active: PandaRuntimeEnvironment | null
  readonly previous: PandaRuntimeEnvironment | null
  readonly response: PandaWorkerResponse | null
  readonly latestSdkVersion: string | null
  readonly updateAvailable: boolean
  readonly lastUpdateCheckedAt: number | null
}

/** Credential used only to verify a candidate before pointer activation. */
export interface PandaRuntimeCredential {
  readonly account: NormalizedPandaAccount
  readonly password: string
}

interface ActivationFile {
  readonly schemaVersion: typeof ACTIVATION_SCHEMA_VERSION
  readonly active: PandaRuntimeEnvironment
  readonly previous: PandaRuntimeEnvironment | null
  readonly retained: readonly PandaRuntimeEnvironment[]
}

interface PandaRuntimeConfig {
  readonly managerRoot: string
  readonly legacyRoot: string
  readonly releaseIndexURL: string
  readonly releaseTimeoutMs: number
  /** Host-owned end-to-end probe run before an authenticated environment becomes active. */
  readonly executionProbe: (
    environment: PandaRuntimeEnvironment,
    credential: PandaRuntimeCredential,
    signal?: AbortSignal,
  ) => Promise<void>
}

interface ReleaseFile {
  readonly filename?: unknown
  readonly packagetype?: unknown
  readonly url?: unknown
  readonly yanked?: unknown
  readonly digests?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCapabilities(value: unknown): value is PandaSdkCapabilities {
  if (!isRecord(value)) return false
  return typeof value.authentication === 'boolean'
    && typeof value.marketData === 'boolean'
    && typeof value.indexData === 'boolean'
    && typeof value.marginData === 'boolean'
}

function isEnvironment(value: unknown): value is PandaRuntimeEnvironment {
  if (!isRecord(value)) return false
  return typeof value.id === 'string'
    && typeof value.root === 'string'
    && typeof value.sdkVersion === 'string'
    && (value.pythonSource === 'configured' || value.pythonSource === 'uv-managed')
    && typeof value.pythonVersion === 'string'
    && typeof value.apiFingerprint === 'string'
    && Array.isArray(value.publicCallables)
    && value.publicCallables.every(item => typeof item === 'string')
    && isCapabilities(value.capabilities)
    && typeof value.createdAt === 'number'
}

function isActivationFile(value: unknown): value is ActivationFile {
  return isRecord(value)
    && value.schemaVersion === ACTIVATION_SCHEMA_VERSION
    && isEnvironment(value.active)
    && (value.previous === null || isEnvironment(value.previous))
    && Array.isArray(value.retained)
    && value.retained.every(isEnvironment)
}

function uniqueEnvironments(environments: readonly PandaRuntimeEnvironment[]): readonly PandaRuntimeEnvironment[] {
  const seen = new Set<string>()
  return environments.filter((environment) => {
    if (seen.has(environment.id)) return false
    seen.add(environment.id)
    return true
  })
}

function compareVersions(left: string, right: string): number {
  const parse = (value: string): readonly number[] => value.split(/[.-]/u, 3).map(part => Number(part))
  const leftParts = parse(left)
  const rightParts = parse(right)
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    if (difference !== 0) return difference
  }
  return left.localeCompare(right)
}

function pythonCompatible(version: string, compatibility: PandaSdkCompatibility): boolean {
  const match = /^(\d+)\.(\d+)(?:\.|$)/u.exec(version)
  if (match === null) return false
  const candidate: readonly [number, number] = [Number(match[1]), Number(match[2])]
  const compare = (left: readonly [number, number], right: readonly [number, number]): number =>
    left[0] - right[0] || left[1] - right[1]
  return compare(candidate, compatibility.pythonMin) >= 0
    && compare(candidate, compatibility.pythonMaxExclusive) < 0
}

function releaseFile(value: ReleaseFile, version: string): PandaRelease | undefined {
  if (value.packagetype !== 'bdist_wheel' || value.yanked === true) return undefined
  if (typeof value.filename !== 'string' || !value.filename.endsWith('-py3-none-any.whl')) return undefined
  if (typeof value.url !== 'string') return undefined
  let url: URL
  try {
    url = new URL(value.url)
  } catch {
    return undefined
  }
  if (url.protocol !== 'https:' || url.hostname !== 'files.pythonhosted.org' || url.username !== '' || url.password !== '') return undefined
  if (!isRecord(value.digests) || typeof value.digests.sha256 !== 'string' || !SHA256_PATTERN.test(value.digests.sha256)) return undefined
  return { version, wheelURL: url.href, wheelSha256: value.digests.sha256 }
}

/**
 * Parse one exact release from the PyPI JSON response.
 * @param value - untrusted JSON response.
 * @param requestedVersion - exact release or the index's current stable version.
 * @returns validated wheel metadata.
 */
export function parsePandaRelease(value: unknown, requestedVersion?: string): PandaRelease {
  if (!isRecord(value) || !isRecord(value.info) || !isRecord(value.releases)) throw new PandaWorkerError('release-unavailable')
  const releases = value.releases
  const compatible = requestedVersion === undefined
    ? [...PANDA_SDK_COMPATIBILITY]
      .filter(entry => Array.isArray(releases[entry.version]))
      .sort((left, right) => compareVersions(right.version, left.version))[0]
    : pandaSdkCompatibility(requestedVersion)
  if (compatible === undefined) throw new PandaWorkerError('release-unavailable')
  const version = compatible.version
  const files = releases[version]
  if (!Array.isArray(files)) throw new PandaWorkerError('release-unavailable')
  for (const file of files) {
    if (!isRecord(file)) continue
    const selected = releaseFile(file, version)
    if (selected?.wheelURL === compatible.wheelURL && selected.wheelSha256 === compatible.wheelSha256) return selected
  }
  throw new PandaWorkerError('release-unavailable')
}

/** Managed PandaData runtime with candidate probing and pointer-only activation. */
export class PandaRuntimeManager {
  private activation: ActivationFile | null | undefined
  private latestRelease: PandaRelease | null = null
  private lastUpdateCheckedAt: number | null = null

  /**
   * Create a runtime manager around one worker client.
   * @param worker - one-shot Python process client.
   * @param config - validated storage and release discovery settings.
   */
  constructor(private readonly worker: PandaWorkerClient, private readonly config: PandaRuntimeConfig) {}

  /**
   * Resolve one retained immutable environment by its durable identity.
   * @param environmentId - Session-recorded environment identity.
   * @returns the exact environment or `undefined` after external deletion/corruption.
   */
  async environment(environmentId: string): Promise<PandaRuntimeEnvironment | undefined> {
    const activation = await this.loadActivation()
    if (activation === null) return undefined
    return uniqueEnvironments([
      activation.active,
      ...(activation.previous === null ? [] : [activation.previous]),
      ...activation.retained,
    ]).find(candidate => candidate.id === environmentId)
  }

  /**
   * Inspect the active environment without restoring SDK-owned authentication files.
   * @param signal - operation lifetime.
   * @returns current runtime state.
   */
  async describe(signal?: AbortSignal): Promise<PandaRuntimeStatus> {
    const activation = await this.loadActivation()
    await this.cleanupOrphanedEnvironments(activation)
    if (activation === null) return this.status(null)
    const response = await this.worker.describeAt(
      activation.active.root,
      activation.active.sdkVersion,
      activation.active.pythonSource,
      signal,
    )
    if (response.installedSdkVersion !== activation.active.sdkVersion) throw new PandaWorkerError('sdk-version-mismatch')
    const refreshed = this.environmentFromResponse(activation.active.id, activation.active.root, response, activation.active.createdAt)
    if (JSON.stringify(refreshed) !== JSON.stringify(activation.active)) {
      this.activation = { ...activation, active: refreshed }
      await this.writeActivation(this.activation)
    }
    return this.status(response)
  }

  /**
   * Discover the current official SDK release without changing the active environment.
   * @param signal - operation lifetime.
   * @returns current runtime state with update metadata.
   */
  async checkForUpdates(signal?: AbortSignal): Promise<PandaRuntimeStatus> {
    this.latestRelease = await this.fetchRelease(undefined, signal)
    this.lastUpdateCheckedAt = Date.now()
    return this.describe(signal)
  }

  /**
   * Install the latest official SDK into a new environment and activate it.
   * @param signal - operation lifetime.
   * @param credential - optional Host credential used for pre-activation data and execution verification.
   * @returns activated runtime state.
   */
  async bootstrap(signal?: AbortSignal, credential?: PandaRuntimeCredential): Promise<PandaRuntimeStatus> {
    const release = await this.fetchRelease(undefined, signal)
    this.latestRelease = release
    this.lastUpdateCheckedAt = Date.now()
    return this.installCandidate(release, 'bootstrap-failed', credential, signal)
  }

  /**
   * Activate the latest official SDK only when it is newer than the current release.
   * @param credential - Host credential used to validate the candidate before activation.
   * @param signal - operation lifetime.
   * @returns activated runtime state.
   */
  async update(credential?: PandaRuntimeCredential, signal?: AbortSignal): Promise<PandaRuntimeStatus> {
    const current = await this.loadActivation()
    if (current === null) return this.bootstrap(signal, credential)
    const release = await this.fetchRelease(undefined, signal)
    this.latestRelease = release
    this.lastUpdateCheckedAt = Date.now()
    if (compareVersions(release.version, current.active.sdkVersion) <= 0) throw new PandaWorkerError('update-not-available')
    return this.installCandidate(release, 'update-failed', credential, signal)
  }

  /**
   * Rebuild the active SDK release in a fresh environment.
   * @param credential - Host credential used to validate the candidate before activation.
   * @param signal - operation lifetime.
   * @returns activated replacement state.
   */
  async repair(credential?: PandaRuntimeCredential, signal?: AbortSignal): Promise<PandaRuntimeStatus> {
    const current = await this.loadActivation()
    if (current === null) throw new PandaWorkerError('sdk-not-ready')
    const release = await this.fetchRelease(current.active.sdkVersion, signal)
    return this.installCandidate(release, 'repair-failed', credential, signal)
  }

  /**
   * Swap the active and previous immutable environments after probing the target.
   * @param credential - Host credential used to validate the target before pointer swap.
   * @param signal - operation lifetime.
   * @returns rolled-back runtime state.
   */
  async rollback(credential?: PandaRuntimeCredential, signal?: AbortSignal): Promise<PandaRuntimeStatus> {
    const current = await this.loadActivation()
    if (current?.previous === null || current === null) throw new PandaWorkerError('rollback-unavailable')
    const response = await this.worker.describeAt(
      current.previous.root,
      current.previous.sdkVersion,
      current.previous.pythonSource,
      signal,
    )
    if (response.installedSdkVersion !== current.previous.sdkVersion) throw new PandaWorkerError('rollback-unavailable')
    let activeResponse = response
    if (credential !== undefined) {
      const compatibility = pandaSdkCompatibility(current.previous.sdkVersion)
      if (compatibility === undefined) throw new PandaWorkerError('incompatible-api')
      const verified = await this.worker.loginAt(
        current.previous.root,
        current.previous.sdkVersion,
        current.previous.pythonSource,
        credential.account,
        credential.password,
        compatibility.validationCall,
        signal,
      )
      if (!verified.authenticated) throw new PandaWorkerError('login-failed')
      if (!verified.dataValidated) throw new PandaWorkerError('data-validation-failed')
      activeResponse = verified
    }
    const target = this.environmentFromResponse(current.previous.id, current.previous.root, response, current.previous.createdAt)
    if (credential !== undefined) await this.config.executionProbe(target, credential, signal)
    this.activation = {
      schemaVersion: ACTIVATION_SCHEMA_VERSION,
      active: target,
      previous: current.active,
      retained: current.retained,
    }
    await this.writeActivation(this.activation)
    return this.status(activeResponse)
  }

  /**
   * Authenticate in the active environment for this one-shot worker.
   * @param account - normalized account identity.
   * @param password - write-only password.
   * @param validateDataRead - whether to execute the matrix-owned read-only onboarding request.
   * @param signal - operation lifetime.
   * @returns authenticated runtime state suitable for Host-owned credential replay.
   */
  async login(
    account: NormalizedPandaAccount,
    password: string,
    validateDataRead = false,
    signal?: AbortSignal,
  ): Promise<PandaRuntimeStatus> {
    const current = await this.loadActivation()
    if (current === null) throw new PandaWorkerError('sdk-not-ready')
    const compatibility = pandaSdkCompatibility(current.active.sdkVersion)
    if (compatibility === undefined) throw new PandaWorkerError('incompatible-api')
    const response = await this.worker.loginAt(
      current.active.root,
      current.active.sdkVersion,
      current.active.pythonSource,
      account,
      password,
      validateDataRead ? compatibility.validationCall : undefined,
      signal,
    )
    if (!response.authenticated) throw new PandaWorkerError('login-failed')
    if (validateDataRead && !response.dataValidated) throw new PandaWorkerError('data-validation-failed')
    return this.status(response)
  }

  /**
   * Clear credentials from every retained environment, then the active environment.
   * @param signal - operation lifetime.
   * @returns verified active runtime state.
   */
  async logout(signal?: AbortSignal): Promise<PandaRuntimeStatus> {
    const current = await this.loadActivation()
    if (current === null) throw new PandaWorkerError('sdk-not-ready')
    const inactive = uniqueEnvironments([
      ...(current.previous === null ? [] : [current.previous]),
      ...current.retained,
    ]).filter(environment => environment.id !== current.active.id)
    for (const environment of inactive) {
      await this.worker.logoutAt(environment.root, environment.sdkVersion, environment.pythonSource, signal)
    }
    const active = await this.worker.logoutAt(current.active.root, current.active.sdkVersion, current.active.pythonSource, signal)
    return this.status(active)
  }

  private async installCandidate(
    release: PandaRelease,
    failureCode: 'bootstrap-failed' | 'update-failed' | 'repair-failed',
    credential?: PandaRuntimeCredential,
    signal?: AbortSignal,
  ): Promise<PandaRuntimeStatus> {
    const current = await this.loadActivation()
    const id = `${release.version}-${release.wheelSha256.slice(0, 12)}-${randomUUID()}`
    const root = resolve(this.config.managerRoot, 'environments', id)
    try {
      await mkdir(root, { recursive: true })
      const response = await this.worker.bootstrapAt(root, release.version, release.wheelURL, release.wheelSha256, signal)
      this.assertCompatible(current?.active ?? null, response)
      let activeResponse = response
      if (credential !== undefined) {
        const compatibility = pandaSdkCompatibility(release.version)
        if (compatibility === undefined) throw new PandaWorkerError('incompatible-api')
        const verified = await this.worker.loginAt(
          root,
          release.version,
          response.pythonSource,
          credential.account,
          credential.password,
          compatibility.validationCall,
          signal,
        )
        if (!verified.authenticated) throw new PandaWorkerError('login-failed')
        if (!verified.dataValidated) throw new PandaWorkerError('data-validation-failed')
        activeResponse = verified
      }
      const environment = this.environmentFromResponse(id, root, response, Date.now())
      if (credential !== undefined) await this.config.executionProbe(environment, credential, signal)
      await this.writeEnvironment(environment)
      this.activation = {
        schemaVersion: ACTIVATION_SCHEMA_VERSION,
        active: environment,
        previous: current?.active ?? null,
        retained: current === null
          ? []
          : uniqueEnvironments([
            ...(current.previous === null ? [] : [current.previous]),
            ...current.retained,
          ]),
      }
      await this.writeActivation(this.activation)
      return this.status(activeResponse)
    } catch (error: unknown) {
      try {
        await this.removeOwnedCandidateRoot(root)
      } catch {
        /* Candidate cleanup must not replace the original actionable failure; describe retries orphan cleanup. */
      }
      if (error instanceof PandaWorkerError) throw error
      throw new PandaWorkerError(failureCode)
    }
  }

  private async cleanupOrphanedEnvironments(activation: ActivationFile | null): Promise<void> {
    const environmentsRoot = resolve(this.config.managerRoot, 'environments')
    let entries: Dirent[]
    try {
      entries = await readdir(environmentsRoot, { withFileTypes: true })
    } catch (error: unknown) {
      if (isRecord(error) && error.code === 'ENOENT') return
      throw new PandaWorkerError('worker-failed')
    }
    const retainedRoots = new Set((activation === null
      ? []
      : [activation.active, ...(activation.previous === null ? [] : [activation.previous]), ...activation.retained])
      .map(environment => resolve(environment.root)))
    for (const entry of entries) {
      if (!CANDIDATE_ID_PATTERN.test(entry.name)) continue
      const root = resolve(environmentsRoot, entry.name)
      if (retainedRoots.has(root)) continue
      await this.removeOwnedCandidateRoot(root)
    }
  }

  private async removeOwnedCandidateRoot(root: string): Promise<void> {
    const environmentsRoot = resolve(this.config.managerRoot, 'environments')
    const resolvedRoot = resolve(root)
    const child = relative(environmentsRoot, resolvedRoot)
    if (child === '' || child.includes('/') || child.includes('\\')
      || !CANDIDATE_ID_PATTERN.test(child)) throw new PandaWorkerError('worker-failed')
    let stats
    try {
      stats = await lstat(resolvedRoot)
    } catch (error: unknown) {
      if (isRecord(error) && error.code === 'ENOENT') return
      throw error
    }
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      await unlink(resolvedRoot)
      return
    }
    await rm(resolvedRoot, { recursive: true, force: true })
  }

  private assertCompatible(active: PandaRuntimeEnvironment | null, candidate: PandaWorkerResponse): void {
    if (candidate.installedSdkVersion === null || candidate.pythonVersion === null
      || candidate.apiFingerprint === null || candidate.capabilities === null) throw new PandaWorkerError('incompatible-api')
    if (!Object.values(candidate.capabilities).every(Boolean)) throw new PandaWorkerError('incompatible-api')
    const compatibility = pandaSdkCompatibility(candidate.installedSdkVersion)
    if (compatibility === undefined
      || !pythonCompatible(candidate.pythonVersion, compatibility)
      || compatibility.requiredCallables.some(name => !candidate.publicCallables.includes(name))) {
      throw new PandaWorkerError('incompatible-api')
    }
    if (active === null) return
    const candidateCallables = new Set(candidate.publicCallables)
    if (active.publicCallables.some(name => !candidateCallables.has(name))) throw new PandaWorkerError('incompatible-api')
  }

  private environmentFromResponse(id: string, root: string, response: PandaWorkerResponse, createdAt: number): PandaRuntimeEnvironment {
    if (response.installedSdkVersion === null || response.pythonVersion === null
      || response.apiFingerprint === null || response.capabilities === null) throw new PandaWorkerError('sdk-not-ready')
    return {
      id, root, sdkVersion: response.installedSdkVersion, pythonSource: response.pythonSource,
      pythonVersion: response.pythonVersion, apiFingerprint: response.apiFingerprint,
      publicCallables: [...response.publicCallables], capabilities: response.capabilities, createdAt,
    }
  }

  private async fetchRelease(version: string | undefined, callerSignal?: AbortSignal): Promise<PandaRelease> {
    const timeout = AbortSignal.timeout(this.config.releaseTimeoutMs)
    const signal = callerSignal === undefined ? timeout : AbortSignal.any([callerSignal, timeout])
    let response: Response
    try {
      response = await fetch(this.config.releaseIndexURL, { signal, redirect: 'error' })
    } catch {
      throw new PandaWorkerError(signal.aborted && callerSignal?.aborted === true ? 'cancelled' : 'release-unavailable')
    }
    if (!response.ok || response.url !== this.config.releaseIndexURL) throw new PandaWorkerError('release-unavailable')
    const declaredLength = response.headers.get('content-length')
    if (declaredLength !== null && Number(declaredLength) > RELEASE_BODY_LIMIT) throw new PandaWorkerError('release-unavailable')
    const body = new Uint8Array(await response.arrayBuffer())
    if (body.byteLength > RELEASE_BODY_LIMIT) throw new PandaWorkerError('release-unavailable')
    let value: unknown
    try {
      value = JSON.parse(new TextDecoder().decode(body))
    } catch {
      throw new PandaWorkerError('release-unavailable')
    }
    return parsePandaRelease(value, version)
  }

  private async loadActivation(): Promise<ActivationFile | null> {
    if (this.activation !== undefined) return this.activation
    let contents: string
    try {
      contents = await readFile(this.activationPath(), 'utf8')
    } catch (error: unknown) {
      if (!isRecord(error) || error.code !== 'ENOENT') throw new PandaWorkerError('worker-failed')
      return this.cacheActivation(await this.adoptLegacy())
    }
    let value: unknown
    try {
      value = JSON.parse(contents)
    } catch {
      throw new PandaWorkerError('worker-failed')
    }
    if (!isActivationFile(value) || !this.isOwnedActivation(value)) throw new PandaWorkerError('worker-failed')
    return this.cacheActivation(value)
  }

  private async adoptLegacy(): Promise<ActivationFile | null> {
    let response: PandaWorkerResponse
    try {
      response = await this.worker.describeAt(this.config.legacyRoot, PANDA_DATA_VERSION, 'configured')
    } catch {
      return null
    }
    if (response.installedSdkVersion !== PANDA_DATA_VERSION) return null
    const active = this.environmentFromResponse('legacy-0.0.12', this.config.legacyRoot, response, Date.now())
    const activation: ActivationFile = {
      schemaVersion: ACTIVATION_SCHEMA_VERSION,
      active,
      previous: null,
      retained: [],
    }
    await this.writeActivation(activation)
    return activation
  }

  private cacheActivation(activation: ActivationFile | null): ActivationFile | null {
    this.activation = activation
    return activation
  }

  private isOwnedActivation(activation: ActivationFile): boolean {
    return [activation.active, ...(activation.previous === null ? [] : [activation.previous]), ...activation.retained]
      .every(environment => this.isOwnedEnvironment(environment))
  }

  private isOwnedEnvironment(environment: PandaRuntimeEnvironment): boolean {
    const root = resolve(environment.root)
    if (root === resolve(this.config.legacyRoot)) return environment.id === `legacy-${PANDA_DATA_VERSION}`
    const environmentsRoot = resolve(this.config.managerRoot, 'environments')
    const child = relative(environmentsRoot, root)
    return child !== '' && !child.startsWith('..') && !isAbsolute(child)
  }

  private status(response: PandaWorkerResponse | null): PandaRuntimeStatus {
    const active = this.activation?.active ?? null
    const latest = this.latestRelease?.version ?? null
    return {
      active,
      previous: this.activation?.previous ?? null,
      response,
      latestSdkVersion: latest,
      updateAvailable: active !== null && latest !== null && compareVersions(latest, active.sdkVersion) > 0,
      lastUpdateCheckedAt: this.lastUpdateCheckedAt,
    }
  }

  private activationPath(): string {
    return join(this.config.managerRoot, 'active.json')
  }

  private async writeEnvironment(environment: PandaRuntimeEnvironment): Promise<void> {
    await writeFile(join(environment.root, 'runtime.json'), `${JSON.stringify(environment, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
  }

  private async writeActivation(activation: ActivationFile): Promise<void> {
    await mkdir(this.config.managerRoot, { recursive: true })
    const target = this.activationPath()
    const temporary = join(this.config.managerRoot, `active.${randomUUID()}.tmp`)
    await writeFile(temporary, `${JSON.stringify(activation, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
    try {
      await rename(temporary, target)
    } catch (error: unknown) {
      const code = isRecord(error) ? error.code : undefined
      if (code !== 'EEXIST' && code !== 'EPERM') throw error
      await unlink(target)
      await rename(temporary, target)
    }
  }
}
