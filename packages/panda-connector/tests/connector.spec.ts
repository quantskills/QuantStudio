import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess'
import { SandboxProvider, type ConfinedArgv, type SandboxPolicy } from '@deepseek-ai/dsh-sandbox'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import type {
  SubprocessHandle,
  SubprocessOutputRead,
  SubprocessSpawnSpec,
  SubprocessTerminalHandle,
  SubprocessTerminalSpawnSpec,
} from '@deepseek-ai/dsh-subprocess'

const vaultState = vi.hoisted(() => ({
  stored: undefined as {
    schemaVersion: 1
    account: { kind: 'phone' | 'email' | 'username'; login: string }
    password: string
  } | undefined,
  available: true,
  failWrite: false,
  failDelete: false,
}))

vi.mock('../src/credential-vault.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/credential-vault.ts')>()
  return {
    ...actual,
    createPandaCredentialVault: () => ({
      status: async () => vaultState.available ? 'available' as const : 'unavailable' as const,
      read: async () => {
        if (!vaultState.available) throw new actual.PandaCredentialVaultUnavailableError()
        return vaultState.stored
      },
      write: async (value: typeof vaultState.stored) => {
        if (!vaultState.available || vaultState.failWrite) throw new actual.PandaCredentialVaultUnavailableError()
        vaultState.stored = value
      },
      delete: async () => {
        if (!vaultState.available || vaultState.failDelete) throw new actual.PandaCredentialVaultUnavailableError()
        vaultState.stored = undefined
      },
    }),
  }
})

import PandaConnector, { Config as PandaConnectorConfig, PANDA_DATA_VERSION } from '../src/index.ts'
import { pandaSdkCompatibility } from '../src/compatibility.ts'

interface WorkerReply {
  readonly ok: boolean
  readonly installedSdkVersion: string | null
  readonly logoutSupported: boolean
  readonly authenticated?: boolean
  readonly dataValidated?: boolean
  readonly pythonVersion?: string | null
  readonly pythonSource?: 'configured' | 'uv-managed'
  readonly publicCallables?: readonly string[]
  readonly apiFingerprint?: string | null
  readonly capabilities?: {
    readonly authentication: boolean
    readonly marketData: boolean
    readonly indexData: boolean
    readonly marginData: boolean
  } | null
  readonly code?: string
}

interface ExecutionReply {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

interface Deferred<T> {
  readonly promise: Promise<T>
  resolve(value: T): void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((accept) => { resolve = accept })
  return { promise, resolve }
}

const ready: WorkerReply = {
  ok: true,
  installedSdkVersion: PANDA_DATA_VERSION,
  logoutSupported: false,
  authenticated: false,
  dataValidated: false,
  pythonVersion: '3.11.9',
  pythonSource: 'configured',
  publicCallables: ['get_index_indicator', 'get_index_weights', 'get_margin', 'get_market_data', 'init_token', 'is_authenticated'],
  apiFingerprint: 'test-api-fingerprint',
  capabilities: { authentication: true, marketData: true, indexData: true, marginData: true },
}

const expectedExecutionBackend = process.platform === 'win32' ? 'windows-acl' : process.platform === 'darwin' ? 'seatbelt' : 'bwrap'
const expectedRunnerSignature = process.platform === 'win32' ? 'windows-acl-run: ' : process.platform === 'darwin' ? 'sandbox-exec: ' : 'bwrap: '

const releaseIndexURL = 'https://pypi.org/pypi/panda_data/json'

describe('Panda connector configuration', () => {
  it('defaults the managed fallback runtime to Python 3.12', () => {
    const result = PandaConnectorConfig['~standard'].validate({})
    if (result instanceof Promise) throw new TypeError('Panda connector configuration validation must remain synchronous')

    expect(result.value).toMatchObject({ managedPythonVersion: '3.12' })
  })
})

function stubRelease(version = '0.0.14'): void {
  const compatible = pandaSdkCompatibility(version)
  if (compatible === undefined) throw new Error(`missing test compatibility entry for ${version}`)
  const value = {
    info: { version },
    releases: {
      [version]: [{
        filename: `panda_data-${version}-py3-none-any.whl`,
        packagetype: 'bdist_wheel',
        url: compatible.wheelURL,
        yanked: false,
        digests: { sha256: compatible.wheelSha256 },
      }],
    },
  }
  const body = new TextEncoder().encode(JSON.stringify(value))
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    url: releaseIndexURL,
    headers: new Headers({ 'content-length': String(body.byteLength) }),
    arrayBuffer: async () => body.buffer,
  }))
}

class FakeSubprocess extends SubprocessRuntime {
  readonly specs: SubprocessSpawnSpec[] = []
  readonly operations: string[] = []
  readonly waits: number[] = []
  readonly terminations: number[] = []
  readonly replies: Array<WorkerReply | Promise<WorkerReply> | Error> = []
  readonly executionReplies: Array<ExecutionReply | Error> = []

  async resolveExecutable(command: string): Promise<string> {
    return `C:/resolved/${command}.exe`
  }

  spawn(spec: SubprocessSpawnSpec): SubprocessHandle {
    this.specs.push(spec)
    const index = this.specs.length - 1
    const data = spec.stdio.stdin === 'ignore' || spec.stdio.stdin === 'pipe'
      ? '{}'
      : spec.stdio.stdin.data
    const request = JSON.parse(data) as { operation?: string }
    if (request.operation === undefined) {
      const reply = this.executionReplies.shift() ?? {
        exitCode: 0,
        stdout: 'PANDADATA_EXECUTION_PROBE_OK\n',
        stderr: '',
      }
      if (reply instanceof Error) throw reply
      const stdout = (): SubprocessOutputRead => ({
        text: reply.stdout,
        nextOffset: Buffer.byteLength(reply.stdout),
        lossy: false,
      })
      const stderr = (): SubprocessOutputRead => ({
        text: reply.stderr,
        nextOffset: Buffer.byteLength(reply.stderr),
        lossy: false,
      })
      const done = Promise.resolve({ exitCode: reply.exitCode, signal: null })
      return {
        pid: index + 1,
        stdin: undefined,
        stdout: undefined,
        stderr: undefined,
        collected: { stdout: { readFrom: stdout }, stderr: { readFrom: stderr } },
        done,
        terminate: () => { this.terminations.push(index) },
        waitForExit: async () => {
          this.waits.push(index)
          await done
          return true
        },
      }
    }
    this.operations.push(request.operation)
    const reply = this.replies.shift() ?? ready
    if (reply instanceof Error) throw reply
    let output = ''
    let terminated = false
    const abort = new Promise<WorkerReply>((resolve) => {
      spec.signal?.addEventListener('abort', () => {
        terminated = true
        resolve({ ok: false, installedSdkVersion: null, logoutSupported: false, authenticated: false, code: 'cancelled' })
      }, { once: true })
    })
    const selected = spec.signal === undefined
      ? Promise.resolve(reply)
      : Promise.race([Promise.resolve(reply), abort])
    const done = selected.then((value) => {
      output = JSON.stringify({ ...ready, ...value })
      return terminated
        ? { exitCode: null, signal: 'SIGTERM' as const }
        : { exitCode: 0, signal: null }
    })
    const read = (): SubprocessOutputRead => ({
      text: output,
      nextOffset: Buffer.byteLength(output),
      lossy: false,
    })
    return {
      pid: index + 1,
      stdin: undefined,
      stdout: undefined,
      stderr: undefined,
      collected: { stdout: { readFrom: read }, stderr: { readFrom: read } },
      done,
      terminate: () => {
        terminated = true
        this.terminations.push(index)
      },
      waitForExit: async () => {
        this.waits.push(index)
        await done
        return true
      },
    }
  }

  async spawnTerminal(_spec: SubprocessTerminalSpawnSpec): Promise<SubprocessTerminalHandle> {
    throw new Error('not used')
  }
}

class FakeSandbox extends SandboxProvider {
  trustedBackend = true

  override confine(argv: readonly string[], _policy: SandboxPolicy): ConfinedArgv {
    const runnerFailureRules = !this.trustedBackend
      ? [{ fatalSignatures: ['unknown-runner: '] }]
      : process.platform === 'win32'
        ? [{ allowedExitCodes: [127], fatalSignatures: ['windows-acl-run: '] }]
        : process.platform === 'darwin'
          ? [{ fatalSignatures: ['sandbox-exec: '] }]
          : [{ fatalSignatures: ['bwrap: '] }]
    return { argv: [...argv], enforcement: process.platform === 'win32' ? 'partial' : 'full', denialSignatures: [], runnerFailureRules }
  }
}

const contexts: Context[] = []
const testHomes: string[] = []

afterEach(async () => {
  vi.unstubAllGlobals()
  vaultState.stored = undefined
  vaultState.available = true
  vaultState.failWrite = false
  vaultState.failDelete = false
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  await Promise.all(testHomes.splice(0).map(async (path) => {
    if (!path.startsWith(tmpdir())) throw new Error('refusing to remove a non-temporary PandaData test home')
    await rm(path, { recursive: true, force: true })
  }))
})

async function harness(options: {
  stored?: typeof vaultState.stored
  replies?: readonly (WorkerReply | Promise<WorkerReply> | Error)[]
} = {}): Promise<{ ctx: Context; subprocess: FakeSubprocess; connector: PandaConnector; dshHome: string }> {
  vaultState.stored = options.stored
  const dshHome = await mkdtemp(join(tmpdir(), 'dsh-panda-connector-'))
  testHomes.push(dshHome)
  const environmentRoot = join(dshHome, 'runtimes', 'pandadata', 'environments', 'test-active')
  const python = process.platform === 'win32'
    ? join(environmentRoot, 'Scripts', 'python.exe')
    : join(environmentRoot, 'bin', 'python')
  await mkdir(dirname(python), { recursive: true })
  await writeFile(python, '')
  const activation = {
    schemaVersion: 2,
    active: {
      id: 'test-active', root: environmentRoot, sdkVersion: PANDA_DATA_VERSION,
      pythonSource: 'configured', pythonVersion: '3.11.9', apiFingerprint: 'test-api-fingerprint',
      publicCallables: ready.publicCallables, capabilities: ready.capabilities, createdAt: 1,
    },
    previous: null,
    retained: [],
  }
  await mkdir(join(dshHome, 'runtimes', 'pandadata'), { recursive: true })
  await writeFile(join(dshHome, 'runtimes', 'pandadata', 'active.json'), JSON.stringify(activation))
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(FakeSandbox)
  await ctx.plugin(FakeSubprocess)
  const subprocess = ctx.subprocess as FakeSubprocess
  subprocess.replies.push(...(options.replies ?? []))
  await ctx.plugin(PandaConnector, {
    pythonCommand: 'python',
    pythonArgs: [],
    dshHome,
    baseURL: 'https://data.example.test',
    operationTimeoutMs: 60_000,
    bootstrapTimeoutMs: 60_000,
    terminateGraceMs: 100,
    maxOutputBytes: 4096,
  })
  return { ctx, subprocess, connector: ctx.pandaConnector, dshHome }
}

async function expectInvalidConfig(overrides: Record<string, unknown>): Promise<void> {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(FakeSandbox)
  await ctx.plugin(FakeSubprocess)
  await expect(ctx.plugin(PandaConnector, {
    pythonCommand: 'python',
    pythonArgs: [],
    dshHome: 'C:/dsh-test-home',
    baseURL: 'https://data.example.test',
    operationTimeoutMs: 60_000,
    bootstrapTimeoutMs: 60_000,
    terminateGraceMs: 100,
    maxOutputBytes: 4096,
    ...overrides,
  })).rejects.toThrow(/^panda-connector:/)
}

describe('PandaConnector', () => {
  it('publishes the managed PandaData lifecycle Remotes', async () => {
    const { connector } = await harness()
    expect(connector.typertRemote).toMatchObject({
      serviceKey: 'pandaConnector',
      namespace: 'pandaConnector',
    })
    expect(remoteMethods(connector)).toEqual([
      { method: 'describe', invocation: { kind: 'direct' } },
      { method: 'checkForUpdates', invocation: { kind: 'direct' } },
      { method: 'bootstrap', invocation: { kind: 'direct' } },
      { method: 'update', invocation: { kind: 'direct' } },
      { method: 'repair', invocation: { kind: 'direct' } },
      { method: 'rollback', invocation: { kind: 'direct' } },
      { method: 'login', invocation: { kind: 'direct' } },
      { method: 'logout', invocation: { kind: 'direct' } },
    ])
  })

  it('sends normalized phone, email, and username identities only through one-shot stdin', async () => {
    const { connector, subprocess } = await harness()
    const password = 'panda-password-DO-NOT-LEAK'
    await connector.login({ account: { kind: 'phone', nationalNumber: '138 0013 8000' }, password })
    await connector.login({ account: { kind: 'email', email: 'person@example.com' }, password })
    await connector.login({ account: { kind: 'username', username: 'plain-user' }, password })

    const requests = subprocess.specs.map((spec) => {
      expect(spec.stdio.stdin).not.toBe('ignore')
      expect(spec.stdio.stdin).not.toBe('pipe')
      return JSON.parse((spec.stdio.stdin as { data: string }).data) as Record<string, unknown>
    }).filter(request => request.operation === 'login')
    expect(requests.map(request => [request.accountKind, request.login])).toEqual([
      ['phone', '+8613800138000'],
      ['email', 'person@example.com'],
      ['username', 'plain-user'],
    ])
    expect(requests.map(request => request.validationCall)).toEqual([
      pandaSdkCompatibility(PANDA_DATA_VERSION)!.validationCall,
      pandaSdkCompatibility(PANDA_DATA_VERSION)!.validationCall,
      pandaSdkCompatibility(PANDA_DATA_VERSION)!.validationCall,
    ])
    for (const spec of subprocess.specs) {
      const nonStdin = { ...spec, stdio: { ...spec.stdio, stdin: '<one-shot>' } }
      expect(JSON.stringify(nonStdin)).not.toContain(password)
      expect(JSON.stringify(spec.argv)).not.toContain('person@example.com')
      expect(JSON.stringify(spec.env)).not.toContain(password)
    }
  })

  it('publishes connected only after the worker succeeds', async () => {
    const { connector, subprocess } = await harness()
    const pending = deferred<WorkerReply>()
    subprocess.replies.push(pending.promise)
    const login = connector.login({
      account: { kind: 'username', username: 'waiting-user' },
      password: 'waiting-password',
    })
    await Promise.resolve()
    pending.resolve({ ...ready, authenticated: true, dataValidated: true })
    await expect(login).resolves.toMatchObject({
      ok: true,
      state: {
        phase: 'connected', dataReadiness: 'verified', executionReadiness: 'ready',
        executionBackend: expectedExecutionBackend,
        executionIsolation: process.platform === 'win32' ? 'partial' : 'full', lastFailure: null,
      },
    })

    subprocess.replies.push({
      ok: false,
      installedSdkVersion: PANDA_DATA_VERSION,
      logoutSupported: false,
      code: 'login-failed',
    })
    const failed = await connector.login({
      account: { kind: 'username', username: 'private-account' },
      password: 'private-password',
    })
    expect(failed).toMatchObject({ ok: false, code: 'login-failed', state: { phase: 'connected' } })
    expect(JSON.stringify(failed)).not.toContain('private-account')
    expect(JSON.stringify(failed)).not.toContain('private-password')
  })

  it('accepts the Host sandbox isolation level and preserves ordinary script failures', async () => {
    const { connector, subprocess, dshHome } = await harness()
    subprocess.replies.push({ ...ready, authenticated: true, dataValidated: true })
    await expect(connector.login({
      account: { kind: 'username', username: 'execution-user' },
      password: 'execution-password',
    })).resolves.toMatchObject({ ok: true, state: { executionReadiness: 'ready' } })

    const workspaceRoot = join(dshHome, 'workspace')
    const scriptPath = join(workspaceRoot, 'script.py')
    await mkdir(workspaceRoot, { recursive: true })
    await writeFile(scriptPath, 'raise SystemExit(2)\n')
    subprocess.executionReplies.push({ exitCode: 2, stdout: '', stderr: 'script failed\n' })

    const binding = connector.runtimeBinding()
    const probeCount = subprocess.specs.filter((spec) => {
      if (spec.stdio.stdin === 'ignore' || spec.stdio.stdin === 'pipe') return false
      return (JSON.parse(spec.stdio.stdin.data) as { operation?: string }).operation === undefined
    }).length
    await connector.validateRuntimeBinding(binding)
    expect(subprocess.specs.filter((spec) => {
      if (spec.stdio.stdin === 'ignore' || spec.stdio.stdin === 'pipe') return false
      return (JSON.parse(spec.stdio.stdin.data) as { operation?: string }).operation === undefined
    })).toHaveLength(probeCount)

    await expect(connector.executePython({
      binding,
      sessionId: 'panda-execution-test' as never,
      workspaceRoot,
      scriptPath,
      args: [],
      workdir: workspaceRoot,
    })).resolves.toEqual({ exitCode: 2, stdout: '', stderr: 'script failed\n' })
  })

  it('fails closed on sandbox runner failure without retaining a new credential', async () => {
    const { connector, subprocess } = await harness()
    subprocess.replies.push({ ...ready, authenticated: true, dataValidated: true })
    subprocess.executionReplies.push({ exitCode: 127, stdout: '', stderr: `${expectedRunnerSignature}probe failed\n` })

    await expect(connector.login({
      account: { kind: 'username', username: 'runner-failure-user' },
      password: 'runner-failure-password',
    })).resolves.toMatchObject({
      ok: false,
      code: 'execution-unavailable',
      state: {
        phase: 'ready',
        executionReadiness: 'unavailable',
        executionBackend: expectedExecutionBackend,
        lastFailure: { operation: 'execution-check', code: 'execution-unavailable' },
      },
    })
    expect(vaultState.stored).toBeUndefined()
  })

  it('fails closed when the Panda adapter cannot identify the selected runner', async () => {
    const { ctx, connector, subprocess } = await harness()
    const sandbox = ctx.sandbox as FakeSandbox
    sandbox.trustedBackend = false
    subprocess.replies.push({ ...ready, authenticated: true, dataValidated: true })

    await expect(connector.login({
      account: { kind: 'username', username: 'unknown-runner-user' },
      password: 'unknown-runner-password',
    })).resolves.toMatchObject({
      ok: false,
      code: 'execution-unavailable',
      state: { executionReadiness: 'unavailable', executionBackend: null },
    })
  })

  it('fails the execution check when the probe does not emit its fixed success marker', async () => {
    const { connector, subprocess } = await harness()
    subprocess.replies.push({ ...ready, authenticated: true, dataValidated: true })
    subprocess.executionReplies.push({ exitCode: 0, stdout: '', stderr: '' })

    await expect(connector.login({
      account: { kind: 'username', username: 'empty-probe-user' },
      password: 'empty-probe-password',
    })).resolves.toMatchObject({
      ok: false,
      code: 'execution-unavailable',
      state: { executionReadiness: 'unavailable', executionBackend: expectedExecutionBackend },
    })
  })

  it('discovers and activates the latest SDK only after candidate and credential probes pass', async () => {
    const { connector, subprocess } = await harness()
    stubRelease()
    subprocess.replies.push(ready)
    await expect(connector.checkForUpdates()).resolves.toMatchObject({
      ok: true,
      state: { installedSdkVersion: PANDA_DATA_VERSION, latestSdkVersion: '0.0.14', updateAvailable: true },
    })
    subprocess.replies.push({ ...ready, authenticated: true, dataValidated: true })
    await expect(connector.login({
      account: { kind: 'username', username: 'update-user' },
      password: 'update-password',
    })).resolves.toMatchObject({ ok: true, state: { phase: 'connected' } })
    const candidate = { ...ready, installedSdkVersion: '0.0.14', logoutSupported: true }
    subprocess.replies.push(
      candidate,
      { ...candidate, authenticated: true, dataValidated: true },
      { ...candidate, authenticated: true, dataValidated: true },
    )
    await expect(connector.update()).resolves.toMatchObject({
      ok: true,
      state: {
        phase: 'connected', installedSdkVersion: '0.0.14', rollbackSdkVersion: PANDA_DATA_VERSION,
        logoutSupported: true, dataReadiness: 'verified', lastFailure: null,
      },
    })
    const candidateRequests = subprocess.specs.map((spec) => {
      if (spec.stdio.stdin === 'ignore' || spec.stdio.stdin === 'pipe') return undefined
      return JSON.parse(spec.stdio.stdin.data) as { operation?: string; validationCall?: unknown }
    }).filter(request => request?.operation === 'login')
    expect(candidateRequests.at(-2)?.validationCall).toEqual(pandaSdkCompatibility('0.0.14')!.validationCall)

    subprocess.replies.push(candidate, {
      ok: false,
      installedSdkVersion: '0.0.14',
      logoutSupported: true,
      code: 'data-validation-failed',
    })
    await expect(connector.repair()).resolves.toMatchObject({
      ok: false,
      code: 'data-validation-failed',
      state: { phase: 'connected', installedSdkVersion: '0.0.14' },
    })

    subprocess.replies.push({
      ok: false,
      installedSdkVersion: null,
      logoutSupported: false,
      code: 'bootstrap-failed',
    })
    await expect(connector.bootstrap()).resolves.toMatchObject({ ok: false, code: 'bootstrap-failed', state: { installedSdkVersion: '0.0.14' } })
  })

  it('replays an OS-keyring credential into a fresh worker during Host startup', async () => {
    const { connector, subprocess } = await harness({
      stored: {
        schemaVersion: 1,
        account: { kind: 'username', login: 'restored-user' },
        password: 'restored-password',
      },
      replies: [
        ready, { ...ready, authenticated: true, dataValidated: true, logoutSupported: true },
        ready, { ...ready, authenticated: true, dataValidated: true, logoutSupported: true },
      ],
    })
    await expect(connector.describe()).resolves.toMatchObject({
      ok: true, state: {
        phase: 'connected', installedSdkVersion: PANDA_DATA_VERSION,
        credentialPersistence: 'os-keyring', reconnectState: 'idle',
      },
    })
    expect(subprocess.operations).toEqual(['describe', 'login', 'describe', 'login'])
    const replayRequests = subprocess.specs.map((spec) => {
      if (spec.stdio.stdin === 'ignore' || spec.stdio.stdin === 'pipe') return {}
      return JSON.parse(spec.stdio.stdin.data) as Record<string, unknown>
    }).filter(request => request.operation === 'login')
    expect(replayRequests).toHaveLength(2)
    expect(replayRequests.every(request =>
      JSON.stringify(request.validationCall) === JSON.stringify(pandaSdkCompatibility(PANDA_DATA_VERSION)!.validationCall))).toBe(true)
    for (const spec of subprocess.specs) {
      expect(JSON.stringify(spec.argv)).not.toContain('restored-password')
      expect(JSON.stringify(spec.env)).not.toContain('restored-password')
    }
  })

  it('keeps a successful login in Host memory when the OS keyring write fails', async () => {
    vaultState.failWrite = true
    const { connector, subprocess } = await harness()
    subprocess.replies.push({ ...ready, authenticated: true, dataValidated: true })

    await expect(connector.login({
      account: { kind: 'username', username: 'session-user' },
      password: 'session-password',
    })).resolves.toMatchObject({
      ok: true,
      state: { phase: 'connected', credentialPersistence: 'session-only', reconnectState: 'idle' },
    })
    expect(vaultState.stored).toBeUndefined()

    subprocess.replies.push(ready, { ...ready, authenticated: true, dataValidated: true })
    await expect(connector.describe()).resolves.toMatchObject({ ok: true, state: { phase: 'connected' } })
  })

  it('does not retain credentials when the explicit read-only onboarding check fails', async () => {
    const { connector, subprocess } = await harness()
    subprocess.replies.push({
      ...ready,
      ok: false,
      authenticated: false,
      code: 'data-validation-failed',
    })

    await expect(connector.login({
      account: { kind: 'username', username: 'unverified-user' },
      password: 'unverified-password',
    })).resolves.toMatchObject({
      ok: false,
      code: 'data-validation-failed',
      state: { phase: 'not-ready' },
    })
    expect(vaultState.stored).toBeUndefined()
  })

  it('retains saved credentials after network failure and removes rejected credentials', async () => {
    const stored = {
      schemaVersion: 1 as const,
      account: { kind: 'username' as const, login: 'saved-user' },
      password: 'saved-password',
    }
    const networkFailure: WorkerReply = {
      ok: false, installedSdkVersion: PANDA_DATA_VERSION,
      logoutSupported: false, authenticated: false, code: 'network-unavailable',
    }
    const networkHarness = await harness({
      stored,
      replies: [ready, networkFailure, ready, networkFailure],
    })
    await expect(networkHarness.connector.describe()).resolves.toMatchObject({
      ok: false,
      code: 'network-unavailable',
      state: { credentialPersistence: 'os-keyring', reconnectState: 'idle' },
    })
    expect(vaultState.stored).toEqual(stored)
    await networkHarness.ctx.fiber.dispose()
    contexts.splice(contexts.indexOf(networkHarness.ctx), 1)

    const rejectedHarness = await harness({
      stored,
      replies: [ready, {
        ok: false, installedSdkVersion: PANDA_DATA_VERSION,
        logoutSupported: false, authenticated: false, code: 'login-failed',
      }, ready],
    })
    await expect(rejectedHarness.connector.describe()).resolves.toMatchObject({
      ok: true,
      state: { phase: 'ready', credentialPersistence: 'os-keyring', reconnectState: 'reauth-required' },
    })
    expect(vaultState.stored).toBeUndefined()
  })

  it('serializes login and logout and refuses to fake unsupported logout', async () => {
    const { connector, subprocess } = await harness()
    const first = deferred<WorkerReply>()
    subprocess.replies.push(first.promise, {
      ok: false,
      installedSdkVersion: PANDA_DATA_VERSION,
      logoutSupported: false,
      code: 'logout-unsupported',
    })
    const login = connector.login({
      account: { kind: 'username', username: 'serial-user' },
      password: 'serial-password',
    })
    const logout = connector.logout()
    await vi.waitFor(() => { expect(subprocess.operations).toEqual(['login']) })
    first.resolve({ ...ready, authenticated: true, dataValidated: true })
    await expect(login).resolves.toMatchObject({ ok: true, state: { phase: 'connected' } })
    await expect(logout).resolves.toMatchObject({
      ok: false,
      code: 'logout-unsupported',
      state: { phase: 'ready' },
    })
    expect(subprocess.operations).toEqual(['login', 'logout'])
  })

  it('publishes ready only after the worker verifies logout', async () => {
    const { connector, subprocess } = await harness()
    subprocess.replies.push({ ...ready, authenticated: true, dataValidated: true })
    await connector.login({
      account: { kind: 'username', username: 'logout-user' },
      password: 'logout-password',
    })
    subprocess.replies.push({ ...ready, logoutSupported: true, authenticated: false })
    await expect(connector.logout()).resolves.toMatchObject({
      ok: true,
      state: { phase: 'ready', logoutSupported: true },
    })
  })

  it('cancels active work during disposal, waits for process exit, and never publishes late connected', async () => {
    const { ctx, connector, subprocess } = await harness()
    const never = deferred<WorkerReply>()
    subprocess.replies.push(never.promise)
    const login = connector.login({
      account: { kind: 'username', username: 'dispose-user' },
      password: 'dispose-password',
    })
    await vi.waitFor(() => { expect(subprocess.operations).toEqual(['login']) })
    await ctx.fiber.dispose()
    contexts.splice(contexts.indexOf(ctx), 1)
    await expect(login).resolves.toMatchObject({
      ok: false,
      code: 'cancelled',
      state: { phase: 'not-ready' },
    })
    expect(subprocess.terminations).toEqual([0])
    expect(subprocess.waits.length).toBeGreaterThan(0)
    never.resolve(ready)
    await Promise.resolve()
    expect((await connector.describe()).state.phase).not.toBe('connected')
    await connector.disposeConnector()
  })

  it('returns fixed validation failures without spawning a worker', async () => {
    const { connector, subprocess } = await harness()
    const result = await connector.login({
      account: { kind: 'phone', nationalNumber: '+8613800138000' },
      password: 'not-retained',
    })
    expect(result).toMatchObject({ ok: false, code: 'invalid-request' })
    expect(subprocess.specs).toHaveLength(0)
    expect(JSON.stringify(result)).not.toContain('+8613800138000')
    expect(JSON.stringify(result)).not.toContain('not-retained')

    await expect(connector.login({
      account: { kind: 'username', username: 'blank-password' },
      password: '',
    })).resolves.toMatchObject({ ok: false, code: 'invalid-request' })
    await expect(connector.login({
      account: { kind: 'username', username: 'long-password' },
      password: 'x'.repeat(4097),
    })).resolves.toMatchObject({ ok: false, code: 'invalid-request' })
    await expect(connector.login({
      account: { kind: 'username', username: 'non-string-password' },
      password: 42,
    } as never)).resolves.toMatchObject({ ok: false, code: 'invalid-request' })
    expect(subprocess.specs).toHaveLength(0)
  })

  it('maps unexpected worker failures to fixed text', async () => {
    const { connector, subprocess } = await harness()
    const upstreamSecret = 'upstream-secret-detail'
    subprocess.replies.push(new Error(upstreamSecret))
    const result = await connector.login({
      account: { kind: 'username', username: 'private-user' },
      password: 'private-password',
    })
    expect(result).toMatchObject({ ok: false, code: 'worker-failed' })
    expect(JSON.stringify(result)).not.toContain(upstreamSecret)
  })

  it('retains the exact failure across describe and update checks while keeping data readiness separate', async () => {
    const { connector, subprocess } = await harness()
    subprocess.replies.push({
      ...ready,
      ok: false,
      code: 'network-unavailable',
    })
    await expect(connector.login({
      account: { kind: 'username', username: 'offline-user' },
      password: 'offline-password',
    })).resolves.toMatchObject({
      ok: false,
      code: 'network-unavailable',
      state: {
        phase: 'not-ready',
        dataReadiness: 'unavailable',
        lastFailure: { operation: 'login', code: 'network-unavailable' },
      },
    })

    subprocess.replies.push(ready)
    await expect(connector.describe()).resolves.toMatchObject({
      ok: true,
      state: {
        phase: 'ready',
        dataReadiness: 'unchecked',
        lastFailure: { operation: 'login', code: 'network-unavailable' },
      },
    })

    stubRelease()
    subprocess.replies.push(ready)
    await expect(connector.checkForUpdates()).resolves.toMatchObject({
      ok: true,
      state: {
        dataReadiness: 'unchecked',
        lastFailure: { operation: 'login', code: 'network-unavailable' },
      },
    })
  })

  it('rejects worker responses that omit the data-validation result', async () => {
    const { connector, subprocess } = await harness()
    subprocess.replies.push({
      ...ready,
      dataValidated: undefined,
    } as unknown as WorkerReply)

    await expect(connector.describe()).resolves.toMatchObject({
      ok: false,
      code: 'worker-failed',
    })
  })

  it('fails at load for invalid process, URL, and bound configuration', async () => {
    await expectInvalidConfig({ pythonCommand: ' ' })
    await expectInvalidConfig({ pythonArgs: ['valid', ''] })
    await expectInvalidConfig({ baseURL: ':not-a-url' })
    await expectInvalidConfig({ baseURL: 'ftp://data.example.test' })
    await expectInvalidConfig({ baseURL: 'https://user@data.example.test' })
    await expectInvalidConfig({ baseURL: 'https://:password@data.example.test' })
    await expectInvalidConfig({ operationTimeoutMs: 1.5 })
    await expectInvalidConfig({ operationTimeoutMs: 0 })
  })
})
