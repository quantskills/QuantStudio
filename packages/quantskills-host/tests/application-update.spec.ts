import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  OFFICIAL_APPLICATION_REPOSITORIES,
  OFFICIAL_APPLICATION_REPOSITORY,
  QuantSkillsApplicationUpdater,
  type QuantSkillsApplicationUpdateCommands,
} from '../src/application-update.ts'

const current = 'a'.repeat(40)
const latest = 'b'.repeat(40)
const releaseTag = 'c'.repeat(40)
const prerelease = 'd'.repeat(40)
const currentVersion = '0.1.15'
const latestVersion = '0.1.17'
const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

class FakeCommands implements QuantSkillsApplicationUpdateCommands {
  readonly pnpm: { readonly args: readonly string[]; readonly environment?: Readonly<Record<string, string>> }[] = []
  readonly git: { readonly args: readonly string[]; readonly cwd: string }[] = []
  source: 'git' | 'not-git' = 'git'
  dirty = ''
  ahead = 0
  behind = 1
  failPnpm?: string
  repositoryRoot = ''
  candidateRepository = OFFICIAL_APPLICATION_REPOSITORY
  tagOutput = [
    `${releaseTag}\trefs/tags/v${latestVersion}`,
    `${latest}\trefs/tags/v${latestVersion}^{}`,
    `${prerelease}\trefs/tags/v0.2.0-rc.1`,
  ].join('\n')

  async runGit(args: readonly string[], cwd: string): Promise<string> {
    this.git.push({ args, cwd })
    if (args[0] === 'init') return ''
    if (args[0] === 'show') return JSON.stringify({ version: latestVersion, changes: ['新增版本提示与变更说明', '保留用户个人资产'] })
    if (cwd.endsWith('release-metadata.git') && args[0] === 'fetch') return ''
    if (cwd.endsWith('release-metadata.git') && args.includes('FETCH_HEAD^{commit}')) return `${latest}\n`
    if (args[0] === 'ls-remote') return `${this.tagOutput}\n`
    if (args[0] === 'clone') {
      const target = args.at(-1)
      if (target === undefined) throw new Error('clone target missing')
      this.candidateRepository = args.at(-2) ?? OFFICIAL_APPLICATION_REPOSITORY
      await mkdir(target, { recursive: true })
      await writeFile(join(target, 'package.json'), JSON.stringify({
        name: '@quantskills/dsh-plugin',
        version: latestVersion,
        repository: { url: OFFICIAL_APPLICATION_REPOSITORY },
      }))
      await writeFile(join(target, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n')
      return ''
    }
    if (cwd === this.repositoryRoot) {
      if (this.source === 'not-git' && args.includes('--show-toplevel')) throw new Error('not a repository')
      if (args.includes('--show-toplevel')) return `${this.repositoryRoot}\n`
      if (args[0] === 'config') return `${OFFICIAL_APPLICATION_REPOSITORY}\n`
      if (args[0] === 'branch') return 'main\n'
      if (args[0] === 'status') return this.dirty
      if (args.includes('HEAD^{commit}')) return `${current}\n`
      if (args.includes('FETCH_HEAD^{commit}')) return `${latest}\n`
      if (args[0] === 'fetch') return ''
      if (args[0] === 'rev-list') return `${String(this.ahead)}\t${String(this.behind)}\n`
    }
    if (args.includes('HEAD^{commit}')) return `${latest}\n`
    if (args[0] === 'config') return `${this.candidateRepository}\n`
    if (args[0] === 'checkout') return ''
    throw new Error(`unexpected git command: ${args.join(' ')}`)
  }

  runPnpm(
    args: readonly string[],
    _cwd: string,
    _signal: AbortSignal,
    environment?: Readonly<Record<string, string>>,
  ): Promise<void> {
    this.pnpm.push({ args, ...(environment === undefined ? {} : { environment }) })
    if (this.failPnpm !== undefined && args.join(' ') === this.failPnpm) {
      return Promise.reject(new Error('simulated pnpm failure'))
    }
    return Promise.resolve()
  }
}

async function fixture(sourceVersion = currentVersion): Promise<{
  readonly updater: QuantSkillsApplicationUpdater
  readonly commands: FakeCommands
  readonly root: string
}> {
  const root = await mkdtemp(join(tmpdir(), 'quantskills-application-update-'))
  roots.push(root)
  const repositoryRoot = join(root, 'source')
  await mkdir(repositoryRoot)
  await writeFile(join(repositoryRoot, 'package.json'), JSON.stringify({ version: sourceVersion }))
  const commands = new FakeCommands()
  commands.repositoryRoot = await realpath(repositoryRoot)
  const updater = new QuantSkillsApplicationUpdater({
    applicationRoot: join(root, 'application'),
    repositoryRoot: commands.repositoryRoot,
    commands,
  })
  await updater.initialize()
  return { updater, commands, root }
}

async function waitForTerminal(updater: QuantSkillsApplicationUpdater): Promise<void> {
  await vi.waitFor(() => {
    expect(['current', 'available', 'ready', 'blocked', 'failed']).toContain(updater.getStatus().state)
  })
}

describe('managed application updater', () => {
  it('returns candidate release notes and leaves personal data byte-for-byte unchanged during preparation', async () => {
    const { updater, commands, root } = await fixture()
    const personal = root
    const content = JSON.stringify({ agents: [{ name: '我的自建专家' }], teams: ['我的专家团'], messages: ['私人会话'], apiKey: 'test-only-placeholder' })
    await writeFile(join(personal, 'assets.json'), content)
    updater.check('github')
    await waitForTerminal(updater)
    expect(updater.getStatus().releaseNotes).toContain('保留用户个人资产')
    updater.start()
    await waitForTerminal(updater)
    expect(updater.getStatus().state).toBe('ready')
    expect(await readFile(join(personal, 'assets.json'), 'utf8')).toBe(content)
    expect(commands.git.find(command => command.args[0] === 'clone')?.args).toContain('core.longpaths=true')
  })
  it('migrates a non-Git installation into a verified pending version', async () => {
    const { updater, commands, root } = await fixture()
    commands.source = 'not-git'

    expect(updater.check('github').accepted).toBe('started')
    await waitForTerminal(updater)

    expect(updater.getStatus()).toMatchObject({
      state: 'available', currentVersion, candidateVersion: latestVersion, candidateCommit: latest,
    })
    expect(commands.pnpm).toEqual([])

    expect(updater.start().accepted).toBe('started')
    await waitForTerminal(updater)

    expect(updater.getStatus()).toMatchObject({
      state: 'ready', currentVersion, candidateVersion: latestVersion, candidateCommit: latest,
    })
    expect(commands.pnpm.map(entry => entry.args.join(' '))).toEqual([
      'install --frozen-lockfile', 'run check', 'run ci:smoke',
    ])
    expect(commands.pnpm.every(entry => entry.environment?.QUANTSKILLS_DISABLE_APPLICATION_UPDATE === '1')).toBe(true)
    const state = JSON.parse(await readFile(join(root, 'application', 'state.json'), 'utf8')) as { pending?: string }
    expect(state.pending).toBe(latest)
  })

  it('checks and prepares the exact release from the user-selected Gitee mirror', async () => {
    const { updater, commands } = await fixture()
    commands.source = 'not-git'

    expect(updater.check('gitee').accepted).toBe('started')
    await waitForTerminal(updater)

    expect(updater.getStatus()).toMatchObject({
      state: 'available', source: 'gitee', candidateVersion: latestVersion, candidateCommit: latest,
    })
    expect(commands.git).toContainEqual(expect.objectContaining({
      args: ['ls-remote', '--tags', OFFICIAL_APPLICATION_REPOSITORIES.gitee, 'refs/tags/v*'],
    }))

    expect(updater.start().accepted).toBe('started')
    await waitForTerminal(updater)

    expect(updater.getStatus()).toMatchObject({
      state: 'ready', source: 'gitee', candidateVersion: latestVersion, candidateCommit: latest,
    })
    expect(commands.git.some(entry => entry.args[0] === 'clone'
      && entry.args.includes(OFFICIAL_APPLICATION_REPOSITORIES.gitee))).toBe(true)
  })

  it('protects a dirty development checkout without creating a candidate', async () => {
    const { updater, commands } = await fixture()
    commands.dirty = ' M packages/quantskills-host/src/index.ts\n'

    updater.check('github')
    await waitForTerminal(updater)

    expect(updater.getStatus(), JSON.stringify(commands.git, null, 2)).toMatchObject({
      state: 'blocked', errorCode: 'APPLICATION_UPDATE_DEVELOPMENT_DIRTY', currentCommit: current,
    })
    expect(commands.pnpm).toEqual([])
  })

  it('reuses one in-flight task and reports verification failure without changing the active version', async () => {
    const { updater, commands, root } = await fixture()
    commands.failPnpm = 'run check'

    expect(updater.check('github').accepted).toBe('started')
    expect(updater.check('github').accepted).toBe('reused')
    await waitForTerminal(updater)
    expect(updater.getStatus()).toMatchObject({
      state: 'available', currentVersion, candidateVersion: latestVersion, candidateCommit: latest,
    })

    expect(updater.start().accepted).toBe('started')
    expect(updater.start().accepted).toBe('reused')
    await waitForTerminal(updater)

    expect(updater.getStatus()).toMatchObject({
      state: 'failed', candidateVersion: latestVersion, candidateCommit: latest,
      errorCode: 'APPLICATION_UPDATE_VERIFY_FAILED',
    })
    const state = JSON.parse(await readFile(join(root, 'application', 'state.json'), 'utf8')) as {
      pending?: string
      failedCandidates: readonly { commit: string }[]
    }
    expect(state.pending).toBeUndefined()
    expect(state.failedCandidates.at(-1)?.commit).toBe(latest)
  })

  it('rejects candidate preparation until a user-requested check finds a new version', async () => {
    const { updater, commands } = await fixture()

    expect(() => updater.start()).toThrowError(expect.objectContaining({
      code: 'APPLICATION_UPDATE_NOT_AVAILABLE',
    }))
    expect(commands.git).toEqual([])
    expect(commands.pnpm).toEqual([])
  })

  it('does not treat an untagged main commit as a newer application version', async () => {
    const { updater, commands } = await fixture(latestVersion)

    updater.check('github')
    await waitForTerminal(updater)

    expect(updater.getStatus()).toMatchObject({
      state: 'current', currentVersion: latestVersion, currentCommit: current,
    })
    expect(commands.pnpm).toEqual([])
  })

  it('recovers a corrupt state file and keeps the updater available for a later retry', async () => {
    const root = await mkdtemp(join(tmpdir(), 'quantskills-application-update-corrupt-'))
    roots.push(root)
    const applicationRoot = join(root, 'application')
    const repositoryRoot = join(root, 'source')
    await mkdir(applicationRoot, { recursive: true })
    await mkdir(repositoryRoot)
    await writeFile(join(applicationRoot, 'state.json'), '{invalid')
    const commands = new FakeCommands()
    commands.repositoryRoot = repositoryRoot
    const updater = new QuantSkillsApplicationUpdater({ applicationRoot, repositoryRoot, commands })

    await updater.initialize()

    expect(updater.getStatus()).toEqual({ state: 'failed', errorCode: 'APPLICATION_UPDATE_STATE_CORRUPT' })
    expect(JSON.parse(await readFile(join(applicationRoot, 'state.json'), 'utf8'))).toEqual({
      schemaVersion: 1, failedCandidates: [],
    })
  })
})
