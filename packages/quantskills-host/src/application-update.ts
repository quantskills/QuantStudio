/** Managed QuantSkills application candidate preparation and durable update state. */

import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { QuantSkillsHostError } from './error.ts'
import type {
  QuantSkillsApplicationUpdatePhase,
  QuantSkillsApplicationUpdateSource,
  QuantSkillsApplicationUpdateStartResult,
  QuantSkillsApplicationUpdateStatus,
  QuantSkillsHostErrorCode,
} from './types.ts'

/** Canonical package identity retained in every application manifest. */
export const OFFICIAL_APPLICATION_REPOSITORY = 'https://github.com/quantskills/QuantStudio.git'

/** User-selectable official mirrors for release discovery and candidate download. */
export const OFFICIAL_APPLICATION_REPOSITORIES: Readonly<Record<QuantSkillsApplicationUpdateSource, string>> = Object.freeze({
  github: OFFICIAL_APPLICATION_REPOSITORY,
  gitee: 'https://gitee.com/quantskills/QuantStudio.git',
})

/** Branch admitted by the application updater. */
export const OFFICIAL_APPLICATION_BRANCH = 'main'

/** Internal switch used by isolated candidate smoke tests. */
export const DISABLE_APPLICATION_UPDATE_ENV = 'QUANTSKILLS_DISABLE_APPLICATION_UPDATE'

const SHA_PATTERN = /^[a-f0-9]{40}$/
const STABLE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
const STATE_SCHEMA_VERSION = 1
const STATE_FILE = 'state.json'

const storedStateSchema = z.object({
  schemaVersion: z.literal(STATE_SCHEMA_VERSION),
  active: z.string().regex(SHA_PATTERN).optional(),
  pending: z.string().regex(SHA_PATTERN).optional(),
  previous: z.string().regex(SHA_PATTERN).optional(),
  failedCandidates: z.array(z.object({
    commit: z.string().regex(SHA_PATTERN),
    failedAt: z.number().int().nonnegative(),
    errorCode: z.string(),
  })).max(20).default([]),
})

/** Durable fields shared with the stable bootstrap launcher. */
export interface QuantSkillsApplicationState {
  readonly schemaVersion: 1
  readonly active?: string
  readonly pending?: string
  readonly previous?: string
  readonly failedCandidates: readonly {
    readonly commit: string
    readonly failedAt: number
    readonly errorCode: string
  }[]
}

/** Controlled command execution supplied by the Host subprocess capability. */
export interface QuantSkillsApplicationUpdateCommands {
  /**
   * Run Git with prompts and non-HTTPS transports disabled.
   * @param args - fixed updater-selected Git arguments.
   * @param cwd - validated working directory.
   * @param signal - updater lifetime cancellation.
   * @returns complete stdout.
   */
  runGit(args: readonly string[], cwd: string, signal: AbortSignal): Promise<string>
  /**
   * Run the pinned package manager without an interactive terminal.
   * @param args - fixed updater-selected pnpm arguments.
   * @param cwd - validated candidate directory.
   * @param signal - updater lifetime cancellation.
   * @param environment - explicit validation-only environment values.
   */
  runPnpm(
    args: readonly string[],
    cwd: string,
    signal: AbortSignal,
    environment?: Readonly<Record<string, string>>,
  ): Promise<void>
}

/** Construction values owned by the Host composition. */
export interface QuantSkillsApplicationUpdaterOptions {
  readonly applicationRoot: string
  readonly repositoryRoot: string
  readonly commands: QuantSkillsApplicationUpdateCommands
  readonly now?: () => number
}

interface SourceInspection {
  readonly currentCommit?: string
  readonly currentVersion?: string
  readonly blocked?: QuantSkillsHostErrorCode
}

interface OfficialApplicationRelease {
  readonly version: string
  readonly commit: string
}

/**
 * Prepare immutable official candidates without mutating the running checkout.
 * The stable launcher is the only component that activates or rolls back a candidate.
 */
export class QuantSkillsApplicationUpdater {
  private readonly root: string
  private readonly versions: string
  private readonly staging: string
  private readonly statePath: string
  private readonly repositoryRoot: string
  private readonly commands: QuantSkillsApplicationUpdateCommands
  private readonly now: () => number
  private readonly lifetime = new AbortController()
  private state: QuantSkillsApplicationState = emptyState()
  private status: QuantSkillsApplicationUpdateStatus = Object.freeze({ state: 'idle' })
  private task: Promise<void> | undefined

  /**
   * @param options - managed paths, current source path, and Host command adapter.
   */
  constructor(options: QuantSkillsApplicationUpdaterOptions) {
    this.root = resolve(options.applicationRoot)
    this.versions = join(this.root, 'versions')
    this.staging = join(this.root, 'staging')
    this.statePath = join(this.root, STATE_FILE)
    this.repositoryRoot = resolve(options.repositoryRoot)
    this.commands = options.commands
    this.now = options.now ?? Date.now
  }

  /** Prepare private managed directories and recover readable durable state. */
  async initialize(): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 })
    await Promise.all([
      ensureRealDirectory(this.root, this.versions),
      ensureRealDirectory(this.root, this.staging),
    ])
    try {
      this.state = await readApplicationState(this.statePath)
    } catch (error) {
      this.state = emptyState()
      await writeApplicationState(this.statePath, this.state)
      this.status = Object.freeze({ state: 'failed', errorCode: 'APPLICATION_UPDATE_STATE_CORRUPT' })
      return
    }
    const currentVersion = await this.readCurrentVersion()
    const candidateVersion = this.state.pending === undefined
      ? undefined
      : await readPackageVersion(ownedCommitPath(this.versions, this.state.pending))
    this.status = this.state.pending === undefined
      ? Object.freeze({
          state: 'idle',
          ...(currentVersion === undefined ? {} : { currentVersion }),
          ...(this.state.active === undefined ? {} : { currentCommit: this.state.active }),
        })
      : Object.freeze({
          state: 'ready',
          ...(currentVersion === undefined ? {} : { currentVersion }),
          ...(this.state.active === undefined ? {} : { currentCommit: this.state.active }),
          ...(candidateVersion === undefined ? {} : { candidateVersion }),
          candidateCommit: this.state.pending,
        })
  }

  /** @returns current in-memory state without filesystem or network I/O. */
  getStatus(): QuantSkillsApplicationUpdateStatus {
    return { ...this.status, ...(this.releaseNotes === undefined ? {} : { releaseNotes: this.releaseNotes }) }
  }

  private releaseNotes: readonly string[] | undefined

  /**
   * Start a user-requested official version check without downloading a candidate.
   * @param source - official Git service selected by the user.
   * @returns immediate started-or-reused acknowledgement.
   */
  check(source: QuantSkillsApplicationUpdateSource): QuantSkillsApplicationUpdateStartResult {
    if (this.task !== undefined) {
      return Object.freeze({ accepted: 'reused', status: this.status })
    }
    this.releaseNotes = undefined
    this.status = Object.freeze({
      state: 'checking',
      source,
      ...(this.status.currentVersion === undefined ? {} : { currentVersion: this.status.currentVersion }),
      ...(this.state.active === undefined ? {} : { currentCommit: this.state.active }),
    })
    const task = this.checkForUpdate(source, this.lifetime.signal)
      .catch((error: unknown) => this.recordFailure(error))
      .finally(() => { this.task = undefined })
    this.task = task
    return Object.freeze({ accepted: 'started', status: this.status })
  }

  /** Prepare the version found by the latest completed user check. */
  start(): QuantSkillsApplicationUpdateStartResult {
    if (this.task !== undefined) {
      return Object.freeze({ accepted: 'reused', status: this.status })
    }
    if (this.status.state !== 'available' || this.status.candidateCommit === undefined
      || this.status.candidateVersion === undefined || this.status.source === undefined) {
      throw new QuantSkillsHostError(
        'Check for an official QuantSkills update before preparing it.',
        'APPLICATION_UPDATE_NOT_AVAILABLE',
      )
    }
    const candidateVersion = this.status.candidateVersion
    const candidateCommit = this.status.candidateCommit
    const source = this.status.source
    const currentVersion = this.status.currentVersion
    const currentCommit = this.status.currentCommit
    const checkedAt = this.status.checkedAt ?? this.now()
    this.status = preparationStatus(
      'fetching', source, currentVersion, currentCommit, candidateVersion, candidateCommit, checkedAt,
    )
    const task = this.prepareCandidate(
      source,
      candidateVersion,
      candidateCommit,
      currentVersion,
      currentCommit,
      checkedAt,
      this.lifetime.signal,
    ).catch((error: unknown) => this.recordFailure(error))
      .finally(() => { this.task = undefined })
    this.task = task
    return Object.freeze({ accepted: 'started', status: this.status })
  }

  /** Abort preparation and wait for its command tree to settle. */
  async dispose(): Promise<void> {
    this.lifetime.abort(new Error('quantskills application updater is disposing'))
    await this.task?.catch(() => undefined)
  }

  private async checkForUpdate(source: QuantSkillsApplicationUpdateSource, signal: AbortSignal): Promise<void> {
    this.state = await readApplicationState(this.statePath)
    const inspection = await this.inspectSource(source, signal)
    const checkedAt = this.now()
    if (inspection.blocked !== undefined) {
      this.status = Object.freeze({
        state: 'blocked',
        source,
        ...(inspection.currentVersion === undefined ? {} : { currentVersion: inspection.currentVersion }),
        ...(inspection.currentCommit === undefined ? {} : { currentCommit: inspection.currentCommit }),
        checkedAt,
        errorCode: inspection.blocked,
      })
      return
    }
    const release = await this.readLatestOfficialRelease(source, signal)
    const currentCommit = this.state.active ?? inspection.currentCommit
    const currentVersion = await this.readCurrentVersion() ?? inspection.currentVersion
    const pendingVersion = this.state.pending === undefined
      ? undefined
      : await readPackageVersion(ownedCommitPath(this.versions, this.state.pending))
    if (this.state.pending === release.commit && pendingVersion === release.version) {
      this.releaseNotes = await this.readReleaseNotes(source, release, signal)
      this.status = Object.freeze({
        state: 'ready',
        source,
        ...(currentVersion === undefined ? {} : { currentVersion }),
        ...(currentCommit === undefined ? {} : { currentCommit }),
        candidateVersion: release.version,
        candidateCommit: release.commit,
        checkedAt,
      })
      return
    }
    if (currentVersion !== undefined && compareVersions(currentVersion, release.version) >= 0) {
      this.status = Object.freeze({
        state: 'current',
        source,
        currentVersion,
        ...(currentCommit === undefined ? {} : { currentCommit }),
        checkedAt,
      })
      return
    }
    this.releaseNotes = await this.readReleaseNotes(source, release, signal)
    this.status = Object.freeze({
      state: 'available',
      source,
      ...(currentVersion === undefined ? {} : { currentVersion }),
      ...(currentCommit === undefined ? {} : { currentCommit }),
      candidateVersion: release.version,
      candidateCommit: release.commit,
      checkedAt,
    })
  }

  private async inspectSource(
    source: QuantSkillsApplicationUpdateSource,
    signal: AbortSignal,
  ): Promise<SourceInspection> {
    let repositoryRoot: string
    try {
      repositoryRoot = (await this.commands.runGit(
        ['rev-parse', '--show-toplevel'], this.repositoryRoot, signal,
      )).trim()
      repositoryRoot = await realpath(repositoryRoot)
    } catch (_notGitOrBrokenGitMetadata) {
      signal.throwIfAborted()
      const currentVersion = await readPackageVersion(this.repositoryRoot)
      return { ...(currentVersion === undefined ? {} : { currentVersion }) }
    }
    const currentVersion = await readPackageVersion(repositoryRoot)
    const sourceVersion = currentVersion === undefined ? {} : { currentVersion }
    let origin: string
    try {
      origin = (await this.commands.runGit(
        ['config', '--get', 'remote.origin.url'], repositoryRoot, signal,
      )).trim()
    } catch (_missingOrigin) {
      signal.throwIfAborted()
      return { ...sourceVersion, blocked: 'APPLICATION_UPDATE_DEVELOPMENT_REMOTE' }
    }
    if (!isOfficialApplicationRepository(origin)) {
      return { ...sourceVersion, blocked: 'APPLICATION_UPDATE_DEVELOPMENT_REMOTE' }
    }
    const currentCommit = (await this.commands.runGit(
      ['rev-parse', 'HEAD^{commit}'], repositoryRoot, signal,
    )).trim()
    if (!SHA_PATTERN.test(currentCommit)) {
      throw new QuantSkillsHostError('The current application commit is invalid.', 'APPLICATION_UPDATE_CHECK_FAILED')
    }
    const managedSource = isOwnedPath(repositoryRoot, this.versions)
    const branch = (await this.commands.runGit(['branch', '--show-current'], repositoryRoot, signal)).trim()
    if ((!managedSource && !['main', 'v2'].includes(branch)) || (managedSource && branch !== '' && !['main', 'v2'].includes(branch))) {
      return { ...sourceVersion, currentCommit, blocked: 'APPLICATION_UPDATE_DEVELOPMENT_BRANCH' }
    }
    const dirty = (await this.commands.runGit(
      ['status', '--porcelain=v1', '--untracked-files=normal'], repositoryRoot, signal,
    )).trim()
    if (dirty !== '') return { ...sourceVersion, currentCommit, blocked: 'APPLICATION_UPDATE_DEVELOPMENT_DIRTY' }
    if (managedSource) return { ...sourceVersion, currentCommit }
    await this.commands.runGit(
      ['fetch', '--quiet', '--no-tags', OFFICIAL_APPLICATION_REPOSITORIES[source], OFFICIAL_APPLICATION_BRANCH],
      repositoryRoot,
      signal,
    )
    const latestCommit = (await this.commands.runGit(
      ['rev-parse', 'FETCH_HEAD^{commit}'], repositoryRoot, signal,
    )).trim()
    if (!SHA_PATTERN.test(latestCommit)) {
      throw new QuantSkillsHostError('The official application commit is invalid.', 'APPLICATION_UPDATE_CHECK_FAILED')
    }
    const comparison = (await this.commands.runGit(
      ['rev-list', '--left-right', '--count', 'HEAD...FETCH_HEAD'], repositoryRoot, signal,
    )).trim().match(/^(\d+)\s+(\d+)$/u)
    if (comparison === null) {
      throw new QuantSkillsHostError('The application history comparison was invalid.', 'APPLICATION_UPDATE_CHECK_FAILED')
    }
    const ahead = Number(comparison[1])
    const behind = Number(comparison[2])
    if (ahead > 0 && behind > 0) {
      return { ...sourceVersion, currentCommit, blocked: 'APPLICATION_UPDATE_DEVELOPMENT_DIVERGED' }
    }
    if (ahead > 0) {
      return { ...sourceVersion, currentCommit, blocked: 'APPLICATION_UPDATE_DEVELOPMENT_AHEAD' }
    }
    return { ...sourceVersion, currentCommit }
  }

  private async readLatestOfficialRelease(
    source: QuantSkillsApplicationUpdateSource,
    signal: AbortSignal,
  ): Promise<OfficialApplicationRelease> {
    const releases = await this.readOfficialReleases(source, signal)
    const release = releases.toSorted((left, right) => compareVersions(right.version, left.version))[0]
    if (release === undefined) {
      throw new QuantSkillsHostError('No official stable application release was found.', 'APPLICATION_UPDATE_CHECK_FAILED')
    }
    return release
  }

  private async readReleaseNotes(source: QuantSkillsApplicationUpdateSource, release: OfficialApplicationRelease, signal: AbortSignal): Promise<readonly string[]> {
    const metadata = join(this.root, 'release-metadata.git')
    await mkdir(metadata, { recursive: true })
    await this.commands.runGit(['init', '--bare', '--quiet'], metadata, signal)
    await this.commands.runGit(['fetch', '--quiet', '--depth=1', '--no-tags', OFFICIAL_APPLICATION_REPOSITORIES[source], `refs/tags/v${release.version}`], metadata, signal)
    const actual = (await this.commands.runGit(['rev-parse', 'FETCH_HEAD^{commit}'], metadata, signal)).trim()
    if (actual !== release.commit) throw new QuantSkillsHostError('The release changed during discovery.', 'APPLICATION_UPDATE_CHECK_FAILED')
    try {
      const text = await this.commands.runGit(['show', `${release.commit}:RELEASE.json`], metadata, signal)
      const notes = z.object({ version: z.literal(release.version), changes: z.array(z.string().min(1).max(300)).min(1).max(20) }).parse(JSON.parse(text))
      return notes.changes
    } catch (error) {
      signal.throwIfAborted()
      // Older official releases may not contain a structured release summary.
      return []
    }
  }

  private async readOfficialReleases(
    source: QuantSkillsApplicationUpdateSource,
    signal: AbortSignal,
  ): Promise<readonly OfficialApplicationRelease[]> {
    const output = await this.commands.runGit(
      ['ls-remote', '--tags', OFFICIAL_APPLICATION_REPOSITORIES[source], 'refs/tags/v*'],
      this.root,
      signal,
    )
    return parseOfficialReleases(output)
  }

  private async readCurrentVersion(): Promise<string | undefined> {
    if (this.state.active === undefined) return await readPackageVersion(this.repositoryRoot)
    return await readPackageVersion(ownedCommitPath(this.versions, this.state.active))
  }

  private async prepareCandidate(
    source: QuantSkillsApplicationUpdateSource,
    candidateVersion: string,
    commit: string,
    currentVersion: string | undefined,
    currentCommit: string | undefined,
    checkedAt: number,
    signal: AbortSignal,
  ): Promise<void> {
    const staging = ownedCommitPath(this.staging, `${commit}.partial`)
    const version = ownedCommitPath(this.versions, commit)
    const release = (await this.readOfficialReleases(source, signal))
      .find(candidate => candidate.version === candidateVersion)
    if (release === undefined) {
      throw new QuantSkillsHostError(
        'The selected official release is no longer published.',
        'APPLICATION_UPDATE_CHECK_FAILED',
      )
    }
    if (release.version !== candidateVersion || release.commit !== commit) {
      throw new QuantSkillsHostError(
        'The selected official release changed after the update check.',
        'APPLICATION_UPDATE_CHECK_FAILED',
      )
    }
    this.status = preparationStatus(
      'fetching', source, currentVersion, currentCommit, candidateVersion, commit, checkedAt,
    )
    if (await isDirectory(version)) {
      await this.validateCandidate(version, candidateVersion, commit, signal)
    } else {
      await rm(staging, { recursive: true, force: true })
      try {
        await this.commands.runGit([
          'clone', '-c', 'core.longpaths=true', '-c', 'core.autocrlf=false', '--quiet', '--no-tags', '--single-branch', '--branch', OFFICIAL_APPLICATION_BRANCH,
          '--no-checkout', OFFICIAL_APPLICATION_REPOSITORIES[source], staging,
        ], this.root, signal)
        await this.commands.runGit(['checkout', '--quiet', '--detach', commit], staging, signal)
      } catch (error) {
        signal.throwIfAborted()
        throw new QuantSkillsHostError(
          'Unable to download the official QuantSkills application candidate.',
          'APPLICATION_UPDATE_DOWNLOAD_FAILED',
          { cause: error },
        )
      }
      await this.validateCandidate(staging, candidateVersion, commit, signal)
      this.status = preparationStatus(
        'installing', source, currentVersion, currentCommit, candidateVersion, commit, checkedAt,
      )
      try {
        await this.commands.runPnpm(['install', '--frozen-lockfile'], staging, signal, {
          [DISABLE_APPLICATION_UPDATE_ENV]: '1',
        })
      } catch (error) {
        signal.throwIfAborted()
        throw new QuantSkillsHostError(
          'Unable to install the locked candidate dependencies.',
          'APPLICATION_UPDATE_INSTALL_FAILED',
          { cause: error },
        )
      }
      this.status = preparationStatus(
        'verifying', source, currentVersion, currentCommit, candidateVersion, commit, checkedAt,
      )
      try {
        await this.commands.runPnpm(['run', 'check'], staging, signal, {
          [DISABLE_APPLICATION_UPDATE_ENV]: '1',
        })
        await this.commands.runPnpm(['run', 'ci:smoke'], staging, signal, {
          [DISABLE_APPLICATION_UPDATE_ENV]: '1',
        })
      } catch (error) {
        signal.throwIfAborted()
        throw new QuantSkillsHostError(
          'The official QuantSkills application candidate failed verification.',
          'APPLICATION_UPDATE_VERIFY_FAILED',
          { cause: error },
        )
      }
      await rename(staging, version)
    }
    this.state = Object.freeze({
      ...this.state,
      pending: commit,
      failedCandidates: this.state.failedCandidates.filter(candidate => candidate.commit !== commit),
    })
    await writeApplicationState(this.statePath, this.state)
    this.status = Object.freeze({
      state: 'ready',
      source,
      ...(currentVersion === undefined ? {} : { currentVersion }),
      ...(currentCommit === undefined ? {} : { currentCommit }),
      candidateVersion,
      candidateCommit: commit,
      checkedAt,
    })
  }

  private async validateCandidate(
    candidate: string,
    candidateVersion: string,
    commit: string,
    signal: AbortSignal,
  ): Promise<void> {
    const canonical = await realpath(candidate)
    const [canonicalVersions, canonicalStaging] = await Promise.all([
      realpath(this.versions),
      realpath(this.staging),
    ])
    if (!isOwnedPath(canonical, canonicalVersions) && !isOwnedPath(canonical, canonicalStaging)) {
      throw new QuantSkillsHostError('The application candidate escaped managed storage.', 'APPLICATION_UPDATE_PATH_INVALID')
    }
    const actualCommit = (await this.commands.runGit(['rev-parse', 'HEAD^{commit}'], canonical, signal)).trim()
    const origin = (await this.commands.runGit(['config', '--get', 'remote.origin.url'], canonical, signal)).trim()
    if (actualCommit !== commit || !isOfficialApplicationRepository(origin)) {
      throw new QuantSkillsHostError('The application candidate identity is invalid.', 'APPLICATION_UPDATE_VERIFY_FAILED')
    }
    const manifest = JSON.parse(await readFile(join(canonical, 'package.json'), 'utf8')) as unknown
    if (!isRecord(manifest) || manifest.name !== '@quantskills/dsh-plugin' || manifest.version !== candidateVersion
      || !isRecord(manifest.repository) || typeof manifest.repository.url !== 'string'
      || normalizeRepository(manifest.repository.url) !== normalizeRepository(OFFICIAL_APPLICATION_REPOSITORY)) {
      throw new QuantSkillsHostError('The application package identity is invalid.', 'APPLICATION_UPDATE_VERIFY_FAILED')
    }
    const lock = await lstat(join(canonical, 'pnpm-lock.yaml'))
    if (!lock.isFile() || lock.isSymbolicLink()) {
      throw new QuantSkillsHostError('The application candidate has no regular lock file.', 'APPLICATION_UPDATE_VERIFY_FAILED')
    }
  }

  private async recordFailure(error: unknown): Promise<void> {
    if (this.lifetime.signal.aborted) return
    const errorCode = error instanceof QuantSkillsHostError
      ? error.code
      : 'APPLICATION_UPDATE_CHECK_FAILED'
    const previousStatus = this.status
    const candidateCommit = previousStatus.candidateCommit
    const candidateVersion = previousStatus.candidateVersion
    const failureStatus = Object.freeze({
      state: 'failed',
      ...(previousStatus.source === undefined ? {} : { source: previousStatus.source }),
      ...(previousStatus.currentVersion === undefined ? {} : { currentVersion: previousStatus.currentVersion }),
      ...(previousStatus.currentCommit === undefined ? {} : { currentCommit: previousStatus.currentCommit }),
      ...(candidateVersion === undefined ? {} : { candidateVersion }),
      ...(candidateCommit === undefined ? {} : { candidateCommit }),
      checkedAt: this.now(),
      errorCode,
    } satisfies QuantSkillsApplicationUpdateStatus)
    if (candidateCommit !== undefined) {
      this.state = Object.freeze({
        ...this.state,
        failedCandidates: Object.freeze([
          ...this.state.failedCandidates.filter(candidate => candidate.commit !== candidateCommit).slice(-18),
          { commit: candidateCommit, failedAt: this.now(), errorCode },
        ]),
      })
      await writeApplicationState(this.statePath, this.state).catch(() => undefined)
    }
    this.status = failureStatus
  }
}

function emptyState(): QuantSkillsApplicationState {
  return Object.freeze({ schemaVersion: 1, failedCandidates: Object.freeze([]) })
}

async function readApplicationState(path: string): Promise<QuantSkillsApplicationState> {
  try {
    const parsed = storedStateSchema.parse(JSON.parse(await readFile(path, 'utf8')))
    return Object.freeze({
      schemaVersion: 1,
      ...(parsed.active === undefined ? {} : { active: parsed.active }),
      ...(parsed.pending === undefined ? {} : { pending: parsed.pending }),
      ...(parsed.previous === undefined ? {} : { previous: parsed.previous }),
      failedCandidates: Object.freeze(parsed.failedCandidates.map(candidate => Object.freeze(candidate))),
    })
  } catch (error) {
    if (isMissing(error)) return emptyState()
    throw error
  }
}

async function writeApplicationState(path: string, state: QuantSkillsApplicationState): Promise<void> {
  const temp = join(dirname(path), `.state-${randomUUID()}.tmp`)
  await writeFile(temp, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
  await rename(temp, path)
}

async function ensureRealDirectory(parent: string, child: string): Promise<void> {
  await mkdir(child, { recursive: true, mode: 0o700 })
  const canonicalParent = await realpath(parent)
  const canonicalChild = await realpath(child)
  const info = await lstat(canonicalChild)
  if (!info.isDirectory() || info.isSymbolicLink() || !isOwnedPath(canonicalChild, canonicalParent)) {
    throw new QuantSkillsHostError('The application directory escaped managed storage.', 'APPLICATION_UPDATE_PATH_INVALID')
  }
}

function ownedCommitPath(parent: string, name: string): string {
  const path = resolve(parent, name)
  if (!isOwnedPath(path, parent)) {
    throw new QuantSkillsHostError('The application version path escaped managed storage.', 'APPLICATION_UPDATE_PATH_INVALID')
  }
  return path
}

function isOwnedPath(path: string, parent: string): boolean {
  const child = relative(resolve(parent), resolve(path))
  return child !== '' && !child.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
    && child !== '..' && !isAbsolute(child)
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    const info = await lstat(path)
    return info.isDirectory() && !info.isSymbolicLink()
  } catch (error) {
    if (isMissing(error)) return false
    throw error
  }
}

function normalizeRepository(value: string): string {
  return value.trim().replace(/^git\+/u, '').replace(/\/$/u, '').replace(/\.git$/u, '')
}

function isOfficialApplicationRepository(value: string): boolean {
  const normalized = normalizeRepository(value)
  return [...Object.values(OFFICIAL_APPLICATION_REPOSITORIES),
    'https://github.com/songshuquant/QuantStudio.git',
    'https://github.com/quantskills/quantskills-dsh-plugin.git',
    'https://github.com/songshuquant/quantskills-dsh-plugin.git',
    'https://gitee.com/quantskills/quantskills-dsh-plugin.git',
  ]
    .some(repository => normalizeRepository(repository) === normalized)
}

async function readPackageVersion(root: string): Promise<string | undefined> {
  try {
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as unknown
    if (!isRecord(manifest) || typeof manifest.version !== 'string') return undefined
    return parseVersion(manifest.version) === undefined ? undefined : manifest.version
  } catch (error) {
    if (isMissing(error) || error instanceof SyntaxError) return undefined
    throw error
  }
}

function parseOfficialReleases(output: string): readonly OfficialApplicationRelease[] {
  const tags = new Map<string, { direct?: string; peeled?: string }>()
  for (const line of output.split(/\r?\n/u)) {
    const [commit, reference] = line.trim().split(/\s+/u)
    if (commit === undefined || reference === undefined || !SHA_PATTERN.test(commit)) continue
    const match = reference.match(/^refs\/tags\/v([^\^]+)(\^\{\})?$/u)
    const version = match?.[1]
    if (version === undefined || !STABLE_VERSION_PATTERN.test(version)) continue
    const existing = tags.get(version) ?? {}
    tags.set(version, match?.[2] === undefined ? { ...existing, direct: commit } : { ...existing, peeled: commit })
  }
  return Object.freeze([...tags].flatMap(([version, commits]) => {
    const commit = commits.peeled ?? commits.direct
    return commit === undefined ? [] : [Object.freeze({ version, commit })]
  }))
}

interface ParsedVersion {
  readonly major: number
  readonly minor: number
  readonly patch: number
  readonly prerelease: readonly string[]
}

function parseVersion(value: string): ParsedVersion | undefined {
  const match = value.match(VERSION_PATTERN)
  if (match === null) return undefined
  const [major, minor, patch] = match.slice(1, 4).map(component => Number(component))
  if (major === undefined || minor === undefined || patch === undefined
    || ![major, minor, patch].every(Number.isSafeInteger)) return undefined
  return { major, minor, patch, prerelease: match[4]?.split('.') ?? [] }
}

function compareVersions(leftValue: string, rightValue: string): number {
  const left = parseVersion(leftValue)
  const right = parseVersion(rightValue)
  if (left === undefined || right === undefined) {
    throw new QuantSkillsHostError('The application version is invalid.', 'APPLICATION_UPDATE_CHECK_FAILED')
  }
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (left[key] !== right[key]) return left[key] - right[key]
  }
  if (left.prerelease.length === 0 || right.prerelease.length === 0) {
    return left.prerelease.length === right.prerelease.length ? 0 : left.prerelease.length === 0 ? 1 : -1
  }
  for (let index = 0; index < Math.max(left.prerelease.length, right.prerelease.length); index += 1) {
    const leftPart = left.prerelease[index]
    const rightPart = right.prerelease[index]
    if (leftPart === undefined || rightPart === undefined) return leftPart === rightPart ? 0 : leftPart === undefined ? -1 : 1
    if (leftPart === rightPart) continue
    const leftNumeric = /^\d+$/u.test(leftPart)
    const rightNumeric = /^\d+$/u.test(rightPart)
    if (leftNumeric && rightNumeric) return Number(leftPart) - Number(rightPart)
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1
    return leftPart.localeCompare(rightPart)
  }
  return 0
}

function preparationStatus(
  phase: QuantSkillsApplicationUpdatePhase,
  source: QuantSkillsApplicationUpdateSource,
  currentVersion: string | undefined,
  currentCommit: string | undefined,
  candidateVersion: string,
  candidateCommit: string,
  checkedAt: number,
): QuantSkillsApplicationUpdateStatus {
  return Object.freeze({
    state: 'preparing',
    phase,
    source,
    ...(currentVersion === undefined ? {} : { currentVersion }),
    ...(currentCommit === undefined ? {} : { currentCommit }),
    candidateVersion,
    candidateCommit,
    checkedAt,
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
