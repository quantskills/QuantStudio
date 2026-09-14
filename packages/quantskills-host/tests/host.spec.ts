import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import { SettingsProvider, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import SubprocessRuntime from '@deepseek-ai/dsh-subprocess'
import type {
  SubprocessHandle,
  SubprocessOutputRead,
  SubprocessSpawnSpec,
  SubprocessTerminalHandle,
  SubprocessTerminalSpawnSpec,
} from '@deepseek-ai/dsh-subprocess'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import QuantSkillsHostGateway, { type Config } from '../src/index.ts'

const applicationVersion = JSON.parse(await readFile(new URL('../../../package.json', import.meta.url), 'utf8')).version as string

const catalogUrl = 'https://raw.githubusercontent.com/quantskills/quantskills/main/site/catalog.json'
const commit = 'a'.repeat(40)
const snapshot = `sha256:${'b'.repeat(64)}`
const declaration = [
  '---',
  'name: skill-safe-example',
  'description: Safe example Skill.',
  '---',
  'Use the exact installed commit.',
  '',
].join('\n')

const homes: string[] = []
const contexts: Context[] = []

class MemorySettings extends SettingsProvider {
  readonly writable = true
  protected load(): Promise<Record<string, unknown>> { return Promise.resolve({}) }
  protected persist(_ns: SettingsNamespace, _section: Record<string, unknown>): Promise<void> {
    return Promise.resolve()
  }
}

afterEach(async () => {
  vi.unstubAllGlobals()
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  await Promise.all(homes.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

interface CatalogTestAsset {
  assetId: string
  kind: 'skill' | 'agent'
  declaration: 'SKILL.md' | 'AGENTS.md'
  requires?: readonly string[]
}

function catalogResponse(asset: CatalogTestAsset = {
  assetId: 'skill-safe-example', kind: 'skill', declaration: 'SKILL.md',
}): Response {
  return catalogAssetsResponse([asset])
}

function catalogAssetsResponse(assets: readonly CatalogTestAsset[]): Response {
  const response = new Response(JSON.stringify({
    snapshot_id: snapshot,
    taxonomy: {
      categories: {
        '02': {
          label_en: 'Factor R&D Toolbox',
          label_zh: '因子研发工具箱',
          subcategories: [],
        },
      },
    },
    assets: assets.map(asset => ({
      catalog_status: 'approved',
      name: asset.assetId,
      project_type: asset.kind,
      url: `https://github.com/quantskills/${asset.assetId}`,
      commit_sha: commit,
      declaration_file: asset.declaration,
      requires: asset.requires ?? [],
    })),
  }), { status: 200, headers: { 'content-type': 'application/json' } })
  Object.defineProperty(response, 'url', { value: catalogUrl })
  return response
}

function notModifiedResponse(): Response {
  const response = new Response(null, { status: 304 })
  Object.defineProperty(response, 'url', { value: catalogUrl })
  return response
}

function read(text: () => string): { readFrom(fromByte: number): SubprocessOutputRead } {
  return {
    readFrom(fromByte) {
      const value = text()
      return {
        text: value.slice(fromByte),
        nextOffset: Buffer.byteLength(value),
        lossy: false,
      }
    },
  }
}

class FakeGitSubprocess extends SubprocessRuntime {
  readonly specs: SubprocessSpawnSpec[] = []
  readonly declarations = new Map<string, { readonly name: 'SKILL.md' | 'AGENTS.md'; readonly content: string }>()
  private readonly repositories = new Map<string, string>()
  private readonly localDrafts = new Map<string, string>()
  private readonly localTrees = new Map<string, string>()
  readonly failedFetchRepositories = new Set<string>()
  readonly blockedFetchRepositories = new Set<string>()
  blockedCommand?: string
  declarationName = 'SKILL.md'
  declarationContent = declaration
  objectOverride?: string
  repositoryOrigin = 'https://github.com/quantskills/QuantStudio.git'
  repositoryBranch = 'main'
  repositoryDirty = ''
  repositoryAheadBy = 0
  repositoryBehindBy = 2
  repositoryHead = 'c'.repeat(40)
  repositoryRemoteHead = 'd'.repeat(40)
  repositoryRoot?: string

  resolveExecutable(): Promise<string> {
    return Promise.resolve('C:\\managed\\git.exe')
  }

  spawn(spec: SubprocessSpawnSpec): SubprocessHandle {
    this.specs.push(spec)
    let stdout = ''
    let stderr = ''
    const done = Promise.resolve().then(async () => {
      spec.signal?.throwIfAborted()
      const repositoryUpdate = this.repositoryRoot === spec.cwd
      const command = spec.argv.find(value => [
        'init', 'remote', 'fetch', 'rev-parse', 'config', 'branch', 'status', 'rev-list', 'merge', 'install',
        'add', 'write-tree', 'ls-tree', 'commit-tree', 'checkout',
      ].includes(value))
      if (command === this.blockedCommand) await waitForAbort(spec.signal)
      if (command === 'fetch' && this.blockedFetchRepositories.has(this.repositories.get(spec.cwd) ?? '')) {
        await waitForAbort(spec.signal)
      }
      if (command === 'fetch' && this.failedFetchRepositories.has(this.repositories.get(spec.cwd) ?? '')) {
        stderr = 'simulated repository transport failure'
        return { exitCode: 1, signal: null } as const
      }
      if (command === 'init') {
        const target = spec.argv.at(-1)!
        await mkdir(spec.argv.includes('--bare') ? target : join(target, '.git'), { recursive: true })
      } else if (command === 'remote') {
        this.repositories.set(spec.cwd, spec.argv.at(-1)!)
      } else if (command === 'rev-parse') {
        if (repositoryUpdate && spec.argv.includes('--show-toplevel')) stdout = `${spec.cwd}\n`
        else if (repositoryUpdate && spec.argv.includes('HEAD^{commit}')) stdout = `${this.repositoryHead}\n`
        else if (repositoryUpdate && spec.argv.includes('FETCH_HEAD^{commit}')) stdout = `${this.repositoryRemoteHead}\n`
        else stdout = `${commit}\n`
      } else if (command === 'config') {
        stdout = `${this.repositoryOrigin}\n`
      } else if (command === 'branch') {
        stdout = `${this.repositoryBranch}\n`
      } else if (command === 'status') {
        stdout = this.repositoryDirty
      } else if (command === 'rev-list') {
        stdout = `${String(this.repositoryAheadBy)}\t${String(this.repositoryBehindBy)}\n`
      } else if (command === 'merge') {
        if (repositoryUpdate) this.repositoryHead = this.repositoryRemoteHead
      } else if (command === 'add') {
        const repository = gitArgument(spec.argv, '--git-dir=')
        const workTree = gitArgument(spec.argv, '--work-tree=')
        if (repository !== undefined && workTree !== undefined) this.localDrafts.set(repository, workTree)
      } else if (command === 'write-tree') {
        const repository = gitArgument(spec.argv, '--git-dir=')
        if (repository !== undefined) {
          const selected = await this.localDeclaration(repository)
          const files = await this.localFiles(repository)
          const tree = createHash('sha1').update(`tree\0${selected.content}${JSON.stringify(files)}`).digest('hex')
          this.localTrees.set(repository, tree)
          stdout = `${tree}\n`
        }
      } else if (command === 'ls-tree') {
        const repository = gitArgument(spec.argv, '--git-dir=')
        const selected = repository === undefined
          ? this.selectedDeclaration(spec.cwd)
          : await this.localDeclaration(repository)
        const object = this.objectOverride ?? gitObject(selected.content)
        stdout = repository === undefined ? `100644 blob ${object} ${Buffer.byteLength(selected.content)}\t${selected.name}\0`
          : (await this.localFiles(repository)).map(file => `100644 blob ${gitObject(file.content)} ${Buffer.byteLength(file.content)}\t${file.name}\0`).join('')
      } else if (command === 'commit-tree') {
        const repository = gitArgument(spec.argv, '--git-dir=')
        const tree = repository === undefined ? commit : this.localTrees.get(repository) ?? commit
        stdout = `${createHash('sha1').update(`commit\0${tree}`).digest('hex')}\n`
      } else if (command === 'checkout') {
        const repository = gitArgument(spec.argv, '--git-dir=')
        if (repository === undefined) {
          const selected = this.selectedDeclaration(spec.cwd)
          await writeFile(join(spec.cwd, selected.name), selected.content)
        } else {
          const workTree = gitArgument(spec.argv, '--work-tree=')
          if (workTree === undefined) throw new Error('local checkout has no work tree')
          for (const file of await this.localFiles(repository)) {
            await mkdir(dirname(join(workTree, file.name)), { recursive: true })
            await writeFile(join(workTree, file.name), file.content)
          }
        }
      }
      return { exitCode: 0, signal: null } as const
    }).catch((error: unknown) => {
      stderr = error instanceof Error ? error.message : String(error)
      throw error
    })
    return {
      pid: this.specs.length,
      stdin: undefined,
      stdout: undefined,
      stderr: undefined,
      collected: { stdout: read(() => stdout), stderr: read(() => stderr) },
      done,
      terminate() {},
      waitForExit: () => Promise.resolve(true),
    }
  }

  spawnTerminal(_spec: SubprocessTerminalSpawnSpec): Promise<SubprocessTerminalHandle> {
    return Promise.reject(new Error('not used'))
  }

  private selectedDeclaration(cwd: string): { readonly name: string; readonly content: string } {
    const repository = this.repositories.get(cwd)
    const assetId = repository?.split('/').at(-1)
    return (assetId === undefined ? undefined : this.declarations.get(assetId)) ?? {
      name: this.declarationName,
      content: this.declarationContent,
    }
  }

  private async localFiles(repository: string): Promise<{ name: string; content: string }[]> {
    const root = this.localDrafts.get(repository)!
    const files: { name: string; content: string }[] = []
    const visit = async (prefix: string): Promise<void> => {
      for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
        const name = prefix ? `${prefix}/${entry.name}` : entry.name
        if (entry.isDirectory()) await visit(name)
        else if (entry.isFile()) files.push({ name, content: await readFile(join(root, name), 'utf8') })
      }
    }
    await visit('')
    return files.sort((a, b) => a.name.localeCompare(b.name))
  }

  private async localDeclaration(repository: string): Promise<{ readonly name: 'SKILL.md' | 'AGENTS.md'; readonly content: string }> {
    const draftRoot = this.localDrafts.get(repository)
    if (draftRoot === undefined) throw new Error('local draft was not added')
    const name = existsSync(join(draftRoot, 'SKILL.md')) ? 'SKILL.md' : 'AGENTS.md'
    return { name, content: await readFile(join(draftRoot, name), 'utf8') }
  }
}

function gitArgument(argv: readonly string[], prefix: string): string | undefined {
  return argv.find(value => value.startsWith(prefix))?.slice(prefix.length)
}

function gitObject(content: string): string {
  return createHash('sha1')
    .update(`blob ${Buffer.byteLength(content)}\0`)
    .update(content)
    .digest('hex')
}

function waitForAbort(signal?: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    if (signal?.aborted === true) {
      reject(abortError(signal))
      return
    }
    signal?.addEventListener('abort', () => { reject(abortError(signal)) }, { once: true })
  })
}

function abortError(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new Error('operation aborted')
}

async function harness(home?: string, overrides: Partial<Config> = {}): Promise<{
  ctx: Context
  gateway: QuantSkillsHostGateway
  subprocess: FakeGitSubprocess
  home: string
}> {
  const dshHome = home ?? await mkdtemp(join(tmpdir(), 'dsh-quantskills-host-'))
  if (home === undefined) homes.push(dshHome)
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(SkillRegistry)
  await ctx.plugin(FakeGitSubprocess)
  await ctx.plugin(MemorySettings)
  await ctx.plugin(QuantSkillsHostGateway, {
    dshHome,
    catalogUrl,
    maxCatalogBytes: 64 * 1024,
    maxCatalogAssets: 10,
    readmeTimeoutMs: 5_000,
    maxReadmeBytes: 64 * 1024,
    maxGitOutputBytes: 64 * 1024,
    maxFiles: 10,
    maxTotalBytes: 64 * 1024,
    maxFileBytes: 32 * 1024,
    maxDepth: 8,
    maxPathBytes: 256,
    ...overrides,
  })
  await ctx.plugin(InvariantRegistry, { enabled: true })
  return {
    ctx,
    gateway: ctx.get('quantSkillsHost') as QuantSkillsHostGateway,
    subprocess: ctx.get('subprocess') as FakeGitSubprocess,
    home: dshHome,
  }
}

describe('QuantSkills Host gateway', () => {
  it('uninstalls discovery durably, retains exact bindings, and reinstalls without another download', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(catalogResponse())))
    const first = await harness()
    const catalog = await first.gateway.catalog()
    const request = { assetId: catalog.assets[0]!.assetId, observedSnapshotId: catalog.snapshotId, observedCommit: catalog.assets[0]!.commit }
    const installed = await first.gateway.install(request)
    await first.gateway.uninstallAsset({ assetId: installed.assetId })
    await expect(first.gateway.list()).resolves.toEqual({ versions: [] })
    expect((await first.ctx.skills.list()).some(skill => skill.name === installed.assetId)).toBe(false)
    await expect(first.gateway.resolveInstalledSkill(installed.versionId)).resolves.toMatchObject({ version: installed })
    await expect(first.gateway.uninstallAsset({ assetId: '../outside' })).rejects.toThrow()
    await first.ctx.fiber.dispose()
    contexts.splice(contexts.indexOf(first.ctx), 1)
    const restarted = await harness(first.home)
    await expect(restarted.gateway.list()).resolves.toEqual({ versions: [] })
    await restarted.gateway.catalog()
    const before = restarted.subprocess.specs.length
    await expect(restarted.gateway.install(request)).resolves.toEqual(installed)
    expect(restarted.subprocess.specs).toHaveLength(before)
    await expect(restarted.ctx.skills.get(installed.assetId)).resolves.toMatchObject({ provider: 'quantskills-host' })
    await expect(restarted.gateway.list()).resolves.toEqual({ versions: [installed] })
  })
  it('publishes cancellable catalog, list, and asset installation Remotes', async () => {
    const { gateway } = await harness()
    expect(gateway.typertRemote).toMatchObject({
      serviceKey: 'quantSkillsHost', namespace: 'quantSkills',
    })
    expect(remoteMethods(gateway)).toEqual([
      { method: 'catalog', invocation: { kind: 'direct' } },
      { method: 'catalogSyncStatus', invocation: { kind: 'direct' } },
      { method: 'list', invocation: { kind: 'direct' } },
      { method: 'uninstallAsset', invocation: { kind: 'direct' } },
      { method: 'applicationUpdateStatus', invocation: { kind: 'direct' } },
      { method: 'applicationUpdateCheck', invocation: { kind: 'direct' } },
      { method: 'applicationUpdateStart', invocation: { kind: 'direct' } },
      { method: 'assetReadme', invocation: { kind: 'direct' } },
      { method: 'install', exportName: 'installAsset', invocation: { kind: 'direct' } },
      { method: 'agentTemplate', invocation: { kind: 'direct' } },
      { method: 'manualSkillRead', invocation: { kind: 'direct' } },
      { method: 'manualSkillSave', invocation: { kind: 'direct' } },
    ])
  })

  it('accepts one explicit update check and reuses it for concurrent requests', async () => {
    const { gateway, subprocess } = await harness()
    subprocess.repositoryRoot = await realpath(process.cwd())
    subprocess.blockedCommand = 'rev-parse'

    expect(gateway.applicationUpdateStatus()).toMatchObject({ state: 'idle', currentVersion: applicationVersion })
    expect(gateway.applicationUpdateCheck({ source: 'github' })).toMatchObject({
      accepted: 'started', status: { state: 'checking', source: 'github' },
    })
    expect(gateway.applicationUpdateCheck({ source: 'github' })).toMatchObject({
      accepted: 'reused', status: { state: 'checking', source: 'github' },
    })
  })

  it('does not contact GitHub for application updates during Host initialization', async () => {
    const { gateway, subprocess } = await harness()

    expect(gateway.applicationUpdateStatus()).toMatchObject({ state: 'idle', currentVersion: applicationVersion })
    expect(subprocess.specs.some(spec => spec.argv.includes('ls-remote'))).toBe(false)
    expect(subprocess.specs.some(spec => spec.argv.includes('FETCH_HEAD^{commit}'))).toBe(false)
  })

  it('reads the real repository README from the exact catalog commit', async () => {
    const rawUrl = `https://raw.githubusercontent.com/quantskills/skill-safe-example/${commit}/README.md`
    const markdown = '# 安全示例\n\n## 专业能力\n\n- 使用固定版本说明。\n'
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url === catalogUrl) return Promise.resolve(catalogResponse())
      const response = new Response(markdown, { status: 200, headers: { 'content-type': 'text/plain' } })
      Object.defineProperty(response, 'url', { value: rawUrl })
      return Promise.resolve(response)
    })
    vi.stubGlobal('fetch', fetch)
    const { gateway } = await harness()

    const result = await gateway.assetReadme({
      assetId: 'skill-safe-example' as Parameters<typeof gateway.assetReadme>[0]['assetId'],
      observedSnapshotId: snapshot as Parameters<typeof gateway.assetReadme>[0]['observedSnapshotId'],
      observedCommit: commit as Parameters<typeof gateway.assetReadme>[0]['observedCommit'],
    })

    expect(result).toEqual({
      assetId: 'skill-safe-example', commit, path: 'README.md', markdown,
    })
    expect(fetch.mock.calls.at(-1)?.[0]).toBe(rawUrl)
  })

  it('rejects a README that exceeds its configured response bound', async () => {
    const rawUrl = `https://raw.githubusercontent.com/quantskills/skill-safe-example/${commit}/README.md`
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url === catalogUrl) return Promise.resolve(catalogResponse())
      const response = new Response('oversized', { status: 200, headers: { 'content-length': '9' } })
      Object.defineProperty(response, 'url', { value: rawUrl })
      return Promise.resolve(response)
    }))
    const { gateway } = await harness(undefined, { maxReadmeBytes: 8 })

    await expect(gateway.assetReadme({
      assetId: 'skill-safe-example' as Parameters<typeof gateway.assetReadme>[0]['assetId'],
      observedSnapshotId: snapshot as Parameters<typeof gateway.assetReadme>[0]['observedSnapshotId'],
      observedCommit: commit as Parameters<typeof gateway.assetReadme>[0]['observedCommit'],
    })).rejects.toMatchObject({ code: 'ASSET_README_INVALID' })
  })

  it('serves one validated process cache immediately while ETag revalidation continues', async () => {
    const first = catalogResponse()
    first.headers.set('etag', 'W/"catalog-v1"')
    let finishRevalidation: (() => void) | undefined
    const requestHeaders: Headers[] = []
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestHeaders.push(new Headers(init?.headers))
      if (requestHeaders.length === 1) return first
      await new Promise<void>((resolve) => { finishRevalidation = resolve })
      return notModifiedResponse()
    })
    vi.stubGlobal('fetch', fetch)
    const { gateway } = await harness()

    const initial = await gateway.catalog()
    const unchanged = await gateway.catalog()

    expect(initial).toMatchObject({
      snapshotId: snapshot,
      refreshAfterMs: 300_000,
      sync: { mode: 'manual', state: 'idle' },
    })
    expect(unchanged).toEqual(initial)
    expect(requestHeaders[0]?.get('if-none-match')).toBeNull()
    await vi.waitFor(() => { expect(fetch).toHaveBeenCalledTimes(2) })
    expect(requestHeaders[1]?.get('if-none-match')).toBe('W/"catalog-v1"')
    finishRevalidation?.()
    await vi.waitFor(() => { expect(finishRevalidation).toBeDefined() })
  })

  it('uses an outbound event stream as a hint and publishes only the revalidated trusted catalog', async () => {
    const eventsUrl = 'https://events.quantskills.example/catalog'
    let streamController: ReadableStreamDefaultController<Uint8Array> | undefined
    const eventResponse = new Response(new ReadableStream<Uint8Array>({
      start(controller) { streamController = controller },
    }), { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } })
    Object.defineProperty(eventResponse, 'url', { value: eventsUrl })
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url === eventsUrl) return Promise.resolve(eventResponse)
      if (url === catalogUrl) return Promise.resolve(catalogResponse())
      return Promise.reject(new Error(`unexpected URL ${url}`))
    })
    vi.stubGlobal('fetch', fetch)
    const { ctx, gateway } = await harness(undefined, {
      catalogEventsUrl: eventsUrl,
      catalogEventsReconnectMs: 60_000,
    })
    const snapshots: unknown[] = []
    ctx.on('quantskills/catalog-updated', (value) => { snapshots.push(value) })
    await vi.waitFor(() => {
      expect(gateway.catalogSyncStatus()).toMatchObject({ mode: 'event-stream', state: 'connected' })
    })

    streamController?.enqueue(new TextEncoder().encode('event: catalog.updated\ndata: {"snapshot":"next"}\n\n'))

    await vi.waitFor(() => { expect(snapshots).toHaveLength(1) })
    expect(snapshots[0]).toMatchObject({
      snapshotId: snapshot,
      sync: { mode: 'event-stream', state: 'connected' },
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('does not admit a 304 response without a validated ETag cache', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(notModifiedResponse())))
    const { gateway } = await harness()

    await expect(gateway.catalog()).rejects.toMatchObject({ code: 'CATALOG_FETCH_FAILED' })
  })

  it('does not let an older concurrent response replace the newest validated ETag', async () => {
    const olderResponse = catalogResponse()
    olderResponse.headers.set('etag', '"catalog-older"')
    const newerResponse = catalogResponse()
    newerResponse.headers.set('etag', '"catalog-newer"')
    let releaseOlder: ((response: Response) => void) | undefined
    const older = new Promise<Response>((resolve) => { releaseOlder = resolve })
    const requestHeaders: Headers[] = []
    let request = 0
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      requestHeaders.push(new Headers(init?.headers))
      request += 1
      if (request === 1) return older
      if (request === 2) return Promise.resolve(newerResponse)
      return Promise.resolve(notModifiedResponse())
    }))
    const { gateway } = await harness()

    const first = gateway.catalog()
    await vi.waitFor(() => { expect(request).toBe(1) })
    await gateway.catalog()
    releaseOlder?.(olderResponse)
    await first
    await gateway.catalog()

    expect(requestHeaders[2]?.get('if-none-match')).toBe('"catalog-newer"')
  })

  it('installs an exact catalog commit through argv-only Git and persists Host truth', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(catalogResponse())))
    const first = await harness()
    const catalog = await first.gateway.catalog()
    const installed = await first.gateway.install({
      assetId: catalog.assets[0]!.assetId,
      observedSnapshotId: catalog.snapshotId,
      observedCommit: catalog.assets[0]!.commit,
    })

    expect(installed).toMatchObject({
      versionId: `skill-safe-example@${commit}`,
      assetId: 'skill-safe-example',
      commit,
      declaration: 'SKILL.md',
      exposure: 'skill-registry',
    })
    const versionRoot = join(first.home, 'quantskills', 'versions', 'skill-safe-example', commit)
    const canonicalVersionRoot = await realpath(versionRoot)
    expect(await readFile(join(versionRoot, 'source', 'SKILL.md'), 'utf8')).toBe(declaration)
    expect(existsSync(join(versionRoot, 'source', '.git'))).toBe(false)
    await expect(first.ctx.skills.list()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'skill-safe-example', provider: 'quantskills-host' }),
    ]))
    await expect(first.ctx.skills.get('skill-safe-example')).resolves.toMatchObject({
      name: 'skill-safe-example',
      provider: 'quantskills-host',
      content: 'Use the exact installed commit.',
      resourceBase: { kind: 'directory', path: join(canonicalVersionRoot, 'source') },
    })
    await expect(first.gateway.resolveInstalledSkill(installed.versionId)).resolves.toMatchObject({
      version: { versionId: installed.versionId, exposure: 'skill-registry' },
      definition: {
        name: 'skill-safe-example',
        content: 'Use the exact installed commit.',
        resourceBase: { kind: 'directory', path: join(canonicalVersionRoot, 'source') },
      },
    })
    await expect(first.gateway.matchInstalledSkillResource(join(canonicalVersionRoot, 'source'))).resolves.toEqual({
      version: installed,
      resourceBase: join(canonicalVersionRoot, 'source'),
    })
    await expect(first.gateway.matchInstalledSkillResource(canonicalVersionRoot)).resolves.toBeUndefined()
    expect(first.subprocess.specs.map(spec => spec.argv)).toEqual(expect.arrayContaining([
      expect.arrayContaining(['fetch', '--depth=1', '--no-tags', 'origin', commit]),
      expect.arrayContaining(['checkout', '--detach', '--force', commit]),
    ]))
    const checkout = first.subprocess.specs.find(spec => spec.argv.includes('checkout'))
    expect(checkout?.argv).toEqual(expect.arrayContaining([
      '-c', 'core.autocrlf=false', '-c', 'core.eol=lf',
    ]))
    for (const spec of first.subprocess.specs) {
      expect(spec.argv[0]).toBe('C:\\managed\\git.exe')
      expect(spec.env).toMatchObject({ GIT_TERMINAL_PROMPT: '0', GIT_ALLOW_PROTOCOL: 'https' })
    }

    const before = first.subprocess.specs.length
    await expect(first.gateway.install({
      assetId: catalog.assets[0]!.assetId,
      observedSnapshotId: catalog.snapshotId,
      observedCommit: catalog.assets[0]!.commit,
    })).resolves.toEqual(installed)
    expect(first.subprocess.specs).toHaveLength(before)
    await first.ctx.fiber.dispose()
    contexts.splice(contexts.indexOf(first.ctx), 1)

    const restarted = await harness(first.home)
    await expect(restarted.gateway.list()).resolves.toEqual({ versions: [installed] })
    await expect(restarted.ctx.skills.get('skill-safe-example')).resolves.toMatchObject({
      provider: 'quantskills-host',
      content: 'Use the exact installed commit.',
    })
  })

  it('falls back from the approved GitHub asset repository to the matching Gitee mirror', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(catalogResponse())))
    const { gateway, subprocess } = await harness()
    subprocess.failedFetchRepositories.add('https://github.com/quantskills/skill-safe-example')
    const catalog = await gateway.catalog()

    await expect(gateway.install({
      assetId: catalog.assets[0]!.assetId,
      observedSnapshotId: catalog.snapshotId,
      observedCommit: catalog.assets[0]!.commit,
    })).resolves.toMatchObject({ assetId: 'skill-safe-example', commit })

    expect(subprocess.specs.map(spec => spec.argv)).toEqual(expect.arrayContaining([
      expect.arrayContaining([
        'remote', 'set-url', 'origin', 'https://gitee.com/quantskills/skill-safe-example.git',
      ]),
    ]))
    expect(subprocess.specs.filter(spec => spec.argv.includes('fetch'))).toHaveLength(2)
  })

  it('bounds a stalled GitHub asset fetch before trying the matching Gitee mirror', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(catalogResponse())))
    const { gateway, subprocess } = await harness(undefined, { githubFetchTimeoutMs: 5 })
    subprocess.blockedFetchRepositories.add('https://github.com/quantskills/skill-safe-example')
    const catalog = await gateway.catalog()

    await expect(gateway.install({
      assetId: catalog.assets[0]!.assetId,
      observedSnapshotId: catalog.snapshotId,
      observedCommit: catalog.assets[0]!.commit,
    })).resolves.toMatchObject({ assetId: 'skill-safe-example', commit })

    const fetches = subprocess.specs.filter(spec => spec.argv.includes('fetch'))
    expect(fetches).toHaveLength(2)
    expect(fetches[0]?.signal?.aborted).toBe(true)
    expect(subprocess.specs.map(spec => spec.argv)).toEqual(expect.arrayContaining([
      expect.arrayContaining([
        'remote', 'set-url', 'origin', 'https://gitee.com/quantskills/skill-safe-example.git',
      ]),
    ]))
  })

  it('validates and publishes an unchanged local draft into the separate authored store', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(catalogResponse())))
    const first = await harness()
    const draftRoot = join(first.home, 'workspace', 'quantskills-drafts', 'skill', 'skill-local-example')
    await mkdir(draftRoot, { recursive: true })
    const localDeclaration = [
      '---',
      'name: skill-local-example',
      'description: Local immutable example.',
      '---',
      'Use only the local draft.',
      '',
    ].join('\n')
    await writeFile(join(draftRoot, 'SKILL.md'), localDeclaration)

    const prepared = await first.gateway.prepareAuthoredDraft({ draftRoot, kind: 'skill' })
    expect(prepared).toMatchObject({
      assetId: 'skill-local-example',
      kind: 'skill',
      declaration: 'SKILL.md',
      fileCount: 1,
      requires: [],
    })
    expect(await first.gateway.list()).toEqual({ versions: [] })

    const installed = await first.gateway.publishAuthoredDraft({
      draftRoot,
      kind: 'skill',
      expectedTreeDigest: prepared.treeDigest,
    })
    expect(installed).toMatchObject({
      assetId: 'skill-local-example',
      origin: 'local-authoring',
      repository: 'local-authoring:skill-local-example',
      treeDigest: prepared.treeDigest,
      exposure: 'skill-registry',
    })
    const authoredRoot = join(first.home, 'quantskills', 'authored', 'skill-local-example', installed.commit)
    expect(await readFile(join(authoredRoot, 'source', 'SKILL.md'), 'utf8')).toBe(localDeclaration)
    expect(existsSync(join(first.home, 'quantskills', 'versions', 'skill-local-example', installed.commit))).toBe(false)
    await expect(first.gateway.resolveInstalledSkill(installed.versionId)).resolves.toMatchObject({
      version: { origin: 'local-authoring' },
      definition: { content: 'Use only the local draft.' },
    })

    await first.ctx.fiber.dispose()
    contexts.splice(contexts.indexOf(first.ctx), 1)
    const restarted = await harness(first.home)
    await expect(restarted.gateway.list()).resolves.toEqual({ versions: [installed] })
    await expect(restarted.ctx.skills.get('skill-local-example')).resolves.toMatchObject({
      provider: 'quantskills-host',
      content: 'Use only the local draft.',
    })
  })

  it('rejects local publication when the draft changed or conflicts with an official asset id', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(catalogResponse())))
    const { gateway, home } = await harness()
    const changedRoot = join(home, 'workspace', 'quantskills-drafts', 'skill-changing')
    await mkdir(changedRoot, { recursive: true })
    await writeFile(join(changedRoot, 'SKILL.md'), [
      '---', 'name: skill-changing', 'description: Original.', '---', 'Original body.', '',
    ].join('\n'))
    const prepared = await gateway.prepareAuthoredDraft({ draftRoot: changedRoot, kind: 'skill' })
    await writeFile(join(changedRoot, 'SKILL.md'), [
      '---', 'name: skill-changing', 'description: Changed.', '---', 'Changed body.', '',
    ].join('\n'))
    await expect(gateway.publishAuthoredDraft({
      draftRoot: changedRoot,
      kind: 'skill',
      expectedTreeDigest: prepared.treeDigest,
    })).rejects.toMatchObject({ code: 'INSTALL_INVALID_TREE' })

    const conflictingRoot = join(home, 'workspace', 'quantskills-drafts', 'official-conflict')
    await mkdir(conflictingRoot, { recursive: true })
    await writeFile(join(conflictingRoot, 'SKILL.md'), declaration)
    await expect(gateway.prepareAuthoredDraft({
      draftRoot: conflictingRoot,
      kind: 'skill',
    })).rejects.toMatchObject({ code: 'INSTALL_INVALID_TREE' })
  })

  it('rejects stale Client observations before spawning Git', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(catalogResponse())))
    const { gateway, subprocess } = await harness()
    await expect(gateway.install({
      assetId: 'skill-safe-example' as never,
      observedSnapshotId: `sha256:${'0'.repeat(64)}` as never,
      observedCommit: commit as never,
    })).rejects.toMatchObject({ code: 'CATALOG_STALE' })
    expect(subprocess.specs).toHaveLength(0)
  })

  it('adapts Agent assets into validated editable templates without false Skill registration', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(catalogResponse({
      assetId: 'agent-safe-example', kind: 'agent', declaration: 'AGENTS.md',
    }))))
    const { gateway, subprocess, ctx, home } = await harness()
    subprocess.declarationName = 'AGENTS.md'
    subprocess.declarationContent = [
      '---',
      'name: agent-safe-example',
      'description: |-',
      '  Safe example Agent.',
      '  Preserves multiline descriptions.',
      'summary_en: unrelated: metadata',
      '---',
      '# Safe Agent',
      'Use evidence and create a report.',
      '',
    ].join('\n')
    const installed = await gateway.install({
      assetId: 'agent-safe-example' as never,
      observedSnapshotId: snapshot as never,
      observedCommit: commit as never,
    })
    expect(installed).toMatchObject({ assetId: 'agent-safe-example', exposure: 'agent-template' })
    await expect(ctx.skills.get('agent-safe-example')).resolves.toBeUndefined()
    const template = await gateway.agentTemplate(installed.versionId)
    expect(template).toMatchObject({
      version: { versionId: installed.versionId, exposure: 'agent-template' },
      name: 'agent-safe-example',
      description: 'Safe example Agent.\nPreserves multiline descriptions.',
      requires: [],
    })
    expect(template.instructions).toContain('Use evidence and create a report.')
    await expect(gateway.resolveInstalledResource(installed.versionId)).resolves.toEqual({
      version: installed,
      resourceBase: join(await realpath(home), 'quantskills', 'versions', 'agent-safe-example', commit, 'source'),
    })
    await expect(gateway.matchInstalledSkillResource(
      join(await realpath(home), 'quantskills', 'versions', 'agent-safe-example', commit, 'source'),
    )).resolves.toBeUndefined()
    await expect(gateway.resolveInstalledSkill(`agent-safe-example@${commit}` as never))
      .rejects.toMatchObject({ code: 'INSTALLED_VERSION_NOT_SKILL' })
  })

  it('installs approved Agent Skill dependencies before publishing the template', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(catalogAssetsResponse([
      {
        assetId: 'agent-safe-example', kind: 'agent', declaration: 'AGENTS.md',
        requires: ['skill-required-example'],
      },
      { assetId: 'skill-required-example', kind: 'skill', declaration: 'SKILL.md' },
    ]))))
    const { gateway, subprocess, ctx } = await harness()
    subprocess.declarations.set('agent-safe-example', {
      name: 'AGENTS.md',
      content: [
        '---',
        'name: agent-safe-example',
        'description: Safe composed Agent.',
        'metadata:',
        '  requires: [required-example]',
        '  summary_en: Example dependency adapter: accepts native project references.',
        '---',
        'Use the approved dependency.',
        '',
      ].join('\n'),
    })
    subprocess.declarations.set('skill-required-example', {
      name: 'SKILL.md',
      content: [
        '---',
        'name: skill-required-example',
        'description: Required example Skill.',
        '---',
        'Provide dependency evidence.',
        '',
      ].join('\n'),
    })

    const installed = await gateway.install({
      assetId: 'agent-safe-example' as never,
      observedSnapshotId: snapshot as never,
      observedCommit: commit as never,
    })

    const versions = (await gateway.list()).versions
    expect(versions.some(version => version.assetId === 'skill-required-example'
      && version.exposure === 'skill-registry')).toBe(true)
    expect(versions.some(version => version.assetId === 'agent-safe-example'
      && version.exposure === 'agent-template')).toBe(true)
    await expect(ctx.skills.get('skill-required-example')).resolves.toMatchObject({
      provider: 'quantskills-host',
    })
    await expect(gateway.agentTemplate(installed.versionId)).resolves.toMatchObject({
      requires: ['skill-required-example'],
    })
  })

  it('installs approved dependencies declared only by a native Agent document', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(catalogAssetsResponse([
      { assetId: 'agent-safe-example', kind: 'agent', declaration: 'AGENTS.md' },
      { assetId: 'skill-pandadata-api', kind: 'skill', declaration: 'SKILL.md' },
    ]))))
    const { gateway, subprocess } = await harness()
    subprocess.declarations.set('agent-safe-example', {
      name: 'AGENTS.md',
      content: [
        '---',
        'name: agent-safe-example',
        'description: Safe native Agent.',
        'metadata:',
        '  requires: [skill-pandadata-api]',
        '---',
        'Use the declared dependency.',
        '',
      ].join('\n'),
    })
    subprocess.declarations.set('skill-pandadata-api', {
      name: 'SKILL.md',
      content: [
        '---',
        'name: pandadata-api',
        'description: Standard prefixed-repository Skill.',
        '---',
        'Provide dependency evidence.',
        '',
      ].join('\n'),
    })

    const installed = await gateway.install({
      assetId: 'agent-safe-example' as never,
      observedSnapshotId: snapshot as never,
      observedCommit: commit as never,
    })

    expect((await gateway.list()).versions).toEqual(expect.arrayContaining([
      expect.objectContaining({ assetId: 'skill-pandadata-api', exposure: 'skill-registry' }),
      expect.objectContaining({ assetId: 'agent-safe-example', exposure: 'agent-template' }),
    ]))
    await expect(gateway.resolveInstalledSkill(`skill-pandadata-api@${commit}` as never)).resolves.toMatchObject({
      definition: { name: 'pandadata-api', provider: 'quantskills-host' },
    })
    await expect(gateway.agentTemplate(installed.versionId)).resolves.toMatchObject({
      requires: ['skill-pandadata-api'],
    })
  })

  it('rejects checkout bytes that do not match the admitted Git blob', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(catalogResponse())))
    const { gateway, subprocess, home } = await harness()
    subprocess.objectOverride = 'f'.repeat(40)
    await expect(gateway.install({
      assetId: 'skill-safe-example' as never,
      observedSnapshotId: snapshot as never,
      observedCommit: commit as never,
    })).rejects.toMatchObject({ code: 'INSTALL_INVALID_TREE' })
    expect(existsSync(join(home, 'quantskills', 'versions', 'skill-safe-example', commit))).toBe(false)
  })

  it('does not leave a partial version when installation is cancelled', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(catalogResponse())))
    const { gateway, subprocess, home } = await harness()
    subprocess.blockedCommand = 'fetch'
    const controller = new AbortController()
    const installing = gateway.install({
      assetId: 'skill-safe-example' as never,
      observedSnapshotId: snapshot as never,
      observedCommit: commit as never,
    }, controller.signal)
    await vi.waitFor(() => {
      expect(subprocess.specs.some(spec => spec.argv.includes('fetch'))).toBe(true)
    })
    controller.abort(new Error('cancelled by test'))
    await expect(installing).rejects.toThrow('cancelled by test')
    expect(existsSync(join(home, 'quantskills', 'versions', 'skill-safe-example', commit))).toBe(false)
    await expect(readdir(join(home, 'quantskills', 'staging'))).resolves.toEqual([])
  })
})

it('manually edits exact skill versions, preserves supporting files and rejects stale saves', async () => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(catalogResponse())))
  const { gateway, home } = await harness()
  const draftRoot = join(home, 'manual-test-source')
  await mkdir(draftRoot, { recursive: true })
  const markdown = '---\nname: skill-manual-test\ndescription: Local skill.\n---\nOriginal instructions.\n'
  await writeFile(join(draftRoot, 'SKILL.md'), markdown)
  await writeFile(join(draftRoot, 'helper.py'), 'print(42)')
  const prepared = await gateway.prepareAuthoredDraft({ draftRoot, kind: 'skill' })
  const first = await gateway.publishAuthoredDraft({ draftRoot, kind: 'skill', expectedTreeDigest: prepared.treeDigest })
  expect(await gateway.manualSkillRead(first.versionId)).toBe(markdown)
  const changed = markdown.replace('Original instructions.', 'Updated instructions.')
  const second = await gateway.manualSkillSave({ mode: 'edit', sourceVersionId: first.versionId, markdown: changed })
  expect(second.versionId).not.toBe(first.versionId)
  const installed = await gateway.resolveInstalledSkill(second.versionId)
  if (installed.definition.resourceBase?.kind !== 'directory') throw new Error('Expected local source')
  expect(await readFile(join(installed.definition.resourceBase.path, 'helper.py'), 'utf8')).toBe('print(42)')
  await expect(gateway.manualSkillSave({ mode: 'edit', sourceVersionId: first.versionId, markdown: markdown.replace('Original', 'Conflicting') })).rejects.toThrow()
  expect(await gateway.manualSkillRead(second.versionId)).toBe(changed)
})
