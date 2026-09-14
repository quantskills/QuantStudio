import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PandaRuntimeManager, parsePandaRelease, type PandaRuntimeEnvironment } from '../src/runtime.ts'
import { PandaWorkerError, type PandaWorkerClient, type PandaWorkerResponse } from '../src/worker.ts'
import { pandaSdkCompatibility } from '../src/compatibility.ts'

const testRoots: string[] = []

function response(version: string): PandaWorkerResponse {
  return {
    ok: true,
    installedSdkVersion: version,
    logoutSupported: true,
    authenticated: false,
    dataValidated: false,
    pythonVersion: '3.11.9',
    pythonSource: 'configured',
    publicCallables: [
      'get_index_daily', 'get_lhb_list', 'get_index_indicator', 'get_index_weights',
      'get_margin', 'get_market_data', 'init_token', 'is_authenticated',
    ],
    apiFingerprint: `${version}-fingerprint`,
    capabilities: {
      authentication: true,
      marketData: true,
      indexData: true,
      marginData: true,
    },
  }
}

function generatedId(version: string, suffix: string): string {
  return `${version}-${'a'.repeat(12)}-00000000-0000-4000-8000-${suffix.padStart(12, '0')}`
}

function environment(root: string, id: string, version: string): PandaRuntimeEnvironment {
  const probe = response(version)
  return {
    id,
    root,
    sdkVersion: version,
    pythonSource: 'configured',
    pythonVersion: probe.pythonVersion!,
    apiFingerprint: probe.apiFingerprint!,
    publicCallables: probe.publicCallables,
    capabilities: probe.capabilities!,
    createdAt: 1,
  }
}

async function runtimeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-panda-runtime-'))
  testRoots.push(root)
  return root
}

function worker(overrides: Partial<PandaWorkerClient> = {}): PandaWorkerClient {
  return {
    describeAt: vi.fn(),
    bootstrapAt: vi.fn(),
    loginAt: vi.fn(),
    logoutAt: vi.fn(),
    ...overrides,
  } as unknown as PandaWorkerClient
}

function manager(
  root: string,
  client: PandaWorkerClient,
  executionProbe: ConstructorParameters<typeof PandaRuntimeManager>[1]['executionProbe'] = async () => undefined,
): PandaRuntimeManager {
  return new PandaRuntimeManager(client, {
    managerRoot: join(root, 'manager'),
    legacyRoot: join(root, 'legacy'),
    releaseIndexURL: 'https://pypi.org/pypi/panda_data/json',
    releaseTimeoutMs: 1_000,
    executionProbe,
  })
}

async function writeActivation(
  root: string,
  active: PandaRuntimeEnvironment,
  previous: PandaRuntimeEnvironment | null = null,
  retained: readonly PandaRuntimeEnvironment[] = [],
): Promise<void> {
  await mkdir(join(root, 'manager'), { recursive: true })
  await writeFile(join(root, 'manager', 'active.json'), JSON.stringify({
    schemaVersion: 2,
    active,
    previous,
    retained,
  }))
}

function stubRelease(version = '0.0.14'): void {
  const compatible = pandaSdkCompatibility(version)!
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
    url: 'https://pypi.org/pypi/panda_data/json',
    headers: new Headers({ 'content-length': String(body.byteLength) }),
    arrayBuffer: async () => body.buffer,
  }))
}

afterEach(async () => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  await Promise.all(testRoots.splice(0).map(async (root) => {
    const resolved = resolve(root)
    const temporary = resolve(tmpdir())
    if (!resolved.startsWith(`${temporary}\\`) && !resolved.startsWith(`${temporary}/`)) {
      throw new Error(`refusing to remove non-temporary test path: ${resolved}`)
    }
    await rm(resolved, { recursive: true, force: true })
  }))
})

describe('PandaRuntimeManager', () => {
  it('accepts one exact non-yanked official universal wheel', () => {
    const compatible = pandaSdkCompatibility('0.0.14')!
    expect(parsePandaRelease({
      info: { version: '0.0.14' },
      releases: {
        '0.0.14': [{
          filename: 'panda_data-0.0.14-py3-none-any.whl',
          packagetype: 'bdist_wheel',
          url: compatible.wheelURL,
          yanked: false,
          digests: { sha256: compatible.wheelSha256 },
        }],
      },
    })).toEqual({
      version: '0.0.14',
      wheelURL: compatible.wheelURL,
      wheelSha256: compatible.wheelSha256,
    })
  })

  it.each([
    ['a yanked wheel', true, 'https://files.pythonhosted.org/packages/ab/panda_data.whl', 'a'.repeat(64)],
    ['an untrusted host', false, 'https://packages.example.test/panda_data.whl', 'a'.repeat(64)],
    ['an invalid digest', false, 'https://files.pythonhosted.org/packages/ab/panda_data.whl', 'not-a-sha'],
  ])('rejects %s', (_label, yanked, url, sha256) => {
    expect(() => parsePandaRelease({
      info: { version: '0.0.14' },
      releases: {
        '0.0.14': [{
          filename: 'panda_data-0.0.14-py3-none-any.whl',
          packagetype: 'bdist_wheel',
          url,
          yanked,
          digests: { sha256 },
        }],
      },
    })).toThrow(PandaWorkerError)
  })

  it('fails loud for a malformed activation file instead of adopting a legacy runtime', async () => {
    const root = await runtimeRoot()
    await mkdir(join(root, 'manager'), { recursive: true })
    await writeFile(join(root, 'manager', 'active.json'), '{not-json')
    const describeAt = vi.fn()
    const client = worker({ describeAt })

    await expect(manager(root, client).describe()).rejects.toMatchObject({ code: 'worker-failed' })
    expect(describeAt).not.toHaveBeenCalled()
  })

  it('rejects activation environments outside the owned runtime directories', async () => {
    const root = await runtimeRoot()
    await mkdir(join(root, 'manager'), { recursive: true })
    const outside = environment(join(root, 'outside'), 'outside', '0.0.14')
    await writeFile(join(root, 'manager', 'active.json'), JSON.stringify({
      schemaVersion: 2,
      active: outside,
      previous: null,
      retained: [],
    }))
    const describeAt = vi.fn()
    const client = worker({ describeAt })

    await expect(manager(root, client).describe()).rejects.toMatchObject({ code: 'worker-failed' })
    expect(describeAt).not.toHaveBeenCalled()
  })

  it('clears every rollback and retained credential before clearing the active runtime', async () => {
    const root = await runtimeRoot()
    const environmentsRoot = join(root, 'manager', 'environments')
    const active = environment(join(environmentsRoot, 'active'), 'active', '0.0.14')
    const previous = environment(join(environmentsRoot, 'previous'), 'previous', '0.0.13')
    const retained = environment(join(environmentsRoot, 'retained'), 'retained', '0.0.12')
    await mkdir(join(root, 'manager'), { recursive: true })
    await writeFile(join(root, 'manager', 'active.json'), JSON.stringify({
      schemaVersion: 2,
      active,
      previous,
      retained: [retained, previous],
    }))
    const logoutAt = vi.fn(async (_root: string, version: string) => response(version))
    const client = worker({ logoutAt })

    await expect(manager(root, client).logout()).resolves.toMatchObject({
      active: { id: 'active' },
      response: { authenticated: false },
    })
    expect(logoutAt.mock.calls.map(call => call[0])).toEqual([
      previous.root,
      retained.root,
      active.root,
    ])
  })

  it.each([
    'network-unavailable',
    'data-validation-failed',
    'credential-cleanup-failed',
  ] as const)('preserves %s and removes the failed update candidate', async (code) => {
    const root = await runtimeRoot()
    const environmentsRoot = join(root, 'manager', 'environments')
    const active = environment(join(environmentsRoot, 'active'), 'active', '0.0.12')
    await mkdir(active.root, { recursive: true })
    await writeActivation(root, active)
    stubRelease()
    const bootstrapAt = vi.fn(async (candidateRoot: string) => {
      await writeFile(join(candidateRoot, 'install-marker'), 'candidate')
      return response('0.0.14')
    })
    const loginAt = vi.fn(async () => { throw new PandaWorkerError(code) })
    const runtime = manager(root, worker({ bootstrapAt, loginAt }))

    await expect(runtime.update({
      account: { kind: 'username', login: 'runtime-user' },
      password: 'runtime-password',
    })).rejects.toMatchObject({ code })

    expect(await readdir(environmentsRoot)).toEqual(['active'])
  })

  it('keeps the active pointer and removes a candidate when its execution probe fails', async () => {
    const root = await runtimeRoot()
    const environmentsRoot = join(root, 'manager', 'environments')
    const active = environment(join(environmentsRoot, 'active'), 'active', '0.0.12')
    await mkdir(active.root, { recursive: true })
    await writeActivation(root, active)
    stubRelease()
    const candidate = response('0.0.14')
    const executionProbe = vi.fn(async () => { throw new PandaWorkerError('execution-unavailable') })
    const runtime = manager(root, worker({
      bootstrapAt: vi.fn(async (candidateRoot: string) => {
        await writeFile(join(candidateRoot, 'install-marker'), 'candidate')
        return candidate
      }),
      loginAt: vi.fn(async () => ({ ...candidate, authenticated: true, dataValidated: true })),
    }), executionProbe)

    await expect(runtime.update({
      account: { kind: 'username', login: 'runtime-user' },
      password: 'runtime-password',
    })).rejects.toMatchObject({ code: 'execution-unavailable' })

    const activation = JSON.parse(await readFile(join(root, 'manager', 'active.json'), 'utf8')) as { active: { id: string } }
    expect(activation.active.id).toBe('active')
    expect(await readdir(environmentsRoot)).toEqual(['active'])
    expect(executionProbe).toHaveBeenCalledOnce()
  })

  it('keeps the active pointer when the rollback target execution probe fails', async () => {
    const root = await runtimeRoot()
    const environmentsRoot = join(root, 'manager', 'environments')
    const active = environment(join(environmentsRoot, 'active'), 'active', '0.0.14')
    const previous = environment(join(environmentsRoot, 'previous'), 'previous', '0.0.12')
    await Promise.all([mkdir(active.root, { recursive: true }), mkdir(previous.root, { recursive: true })])
    await writeActivation(root, active, previous)
    const executionProbe = vi.fn(async () => { throw new PandaWorkerError('execution-unavailable') })
    const runtime = manager(root, worker({
      describeAt: vi.fn(async () => response('0.0.12')),
      loginAt: vi.fn(async () => ({ ...response('0.0.12'), authenticated: true, dataValidated: true })),
    }), executionProbe)

    await expect(runtime.rollback({
      account: { kind: 'username', login: 'runtime-user' },
      password: 'runtime-password',
    })).rejects.toMatchObject({ code: 'execution-unavailable' })

    const activation = JSON.parse(await readFile(join(root, 'manager', 'active.json'), 'utf8')) as { active: { id: string } }
    expect(activation.active.id).toBe('active')
    expect(executionProbe).toHaveBeenCalledOnce()
  })

  it('removes generated orphan candidates during describe while retaining every activated environment', async () => {
    const root = await runtimeRoot()
    const environmentsRoot = join(root, 'manager', 'environments')
    const active = environment(join(environmentsRoot, generatedId('0.0.14', '1')), generatedId('0.0.14', '1'), '0.0.14')
    const previous = environment(join(environmentsRoot, generatedId('0.0.13', '2')), generatedId('0.0.13', '2'), '0.0.13')
    const retained = environment(join(environmentsRoot, generatedId('0.0.12', '3')), generatedId('0.0.12', '3'), '0.0.12')
    const orphan = generatedId('0.0.14', '4')
    const incomplete = generatedId('0.0.14', '5')
    await Promise.all([
      active.root,
      previous.root,
      retained.root,
      join(environmentsRoot, orphan),
      join(environmentsRoot, incomplete),
      join(environmentsRoot, 'user-owned-directory'),
    ].map(path => mkdir(path, { recursive: true })))
    await writeFile(join(environmentsRoot, orphan, 'runtime.json'), '{}')
    await writeActivation(root, active, previous, [retained])
    const describeAt = vi.fn(async () => response('0.0.14'))

    await expect(manager(root, worker({ describeAt })).describe()).resolves.toMatchObject({
      active: { id: active.id },
      previous: { id: previous.id },
    })

    expect((await readdir(environmentsRoot)).sort()).toEqual([
      active.id,
      previous.id,
      retained.id,
      'user-owned-directory',
    ].sort())
  })

  it('returns the credential-validation response and retains the replaced runtime for rollback', async () => {
    const root = await runtimeRoot()
    const environmentsRoot = join(root, 'manager', 'environments')
    const active = environment(join(environmentsRoot, 'active'), 'active', '0.0.12')
    await mkdir(active.root, { recursive: true })
    await writeActivation(root, active)
    stubRelease()
    const candidate = response('0.0.14')
    const verified = { ...candidate, authenticated: true, dataValidated: true }
    const executionProbe = vi.fn(async () => undefined)
    const runtime = manager(root, worker({
      bootstrapAt: vi.fn(async () => candidate),
      loginAt: vi.fn(async () => verified),
    }), executionProbe)

    await expect(runtime.update({
      account: { kind: 'username', login: 'runtime-user' },
      password: 'runtime-password',
    })).resolves.toMatchObject({
      active: { sdkVersion: '0.0.14' },
      previous: { id: 'active', sdkVersion: '0.0.12' },
      response: { authenticated: true, dataValidated: true },
    })
    expect(executionProbe).toHaveBeenCalledOnce()
  })

  it('rejects an authenticated login that did not complete the requested data validation', async () => {
    const root = await runtimeRoot()
    const active = environment(join(root, 'manager', 'environments', 'active'), 'active', '0.0.12')
    await mkdir(active.root, { recursive: true })
    await writeActivation(root, active)
    const runtime = manager(root, worker({
      loginAt: vi.fn(async () => ({ ...response('0.0.12'), authenticated: true, dataValidated: false })),
    }))

    await expect(runtime.login(
      { kind: 'username', login: 'runtime-user' },
      'runtime-password',
      true,
    )).rejects.toMatchObject({ code: 'data-validation-failed' })
  })
})
