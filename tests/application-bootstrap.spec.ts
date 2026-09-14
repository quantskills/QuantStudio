import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  commitPendingState,
  acquireLaunchLock,
  managedVersionPath,
  parseArguments,
  parseApplicationState,
  readPort,
  recoverApplicationState,
  rejectPendingState,
  repairApplicationState,
  windowsLauncherSource,
} from '../scripts/application-bootstrap.mjs'

const first = 'a'.repeat(40)
const second = 'b'.repeat(40)
const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('stable application bootstrap', () => {
  it('installs a source-independent entry and configuration under DSH_HOME', async () => {
    const home = await mkdtemp(join(tmpdir(), 'quantskills-bootstrap-'))
    roots.push(home)
    const pnpmCli = process.env.npm_execpath ?? process.execPath

    const result = spawnSync(process.execPath, ['./scripts/install-application-bootstrap.mjs'], {
      cwd: resolve('.'),
      env: {
        ...process.env,
        DSH_HOME: home,
        QUANTSKILLS_SKIP_DESKTOP_SHORTCUT: '1',
        QUANTSKILLS_SKIP_MANAGED_SEED: '1',
        npm_execpath: pnpmCli,
      },
      encoding: 'utf8',
      windowsHide: true,
    })

    expect(result.status, result.stderr).toBe(0)
    const bootstrap = join(home, 'quantskills', 'application', 'bootstrap')
    expect((await stat(join(bootstrap, 'launcher.mjs'))).isFile()).toBe(true)
    expect((await stat(join(bootstrap, 'quantskills.ico'))).isFile()).toBe(true)
    const config = JSON.parse(await readFile(join(bootstrap, 'config.json'), 'utf8')) as {
      fallbackSourceRoot?: string
      pnpmCli?: string
    }
    expect(config.fallbackSourceRoot).toBe(resolve('.'))
    expect(config.pnpmCli).toBe(resolve(pnpmCli))
  })

  it('accepts clean local launch URLs and legacy authenticated URLs, and reopens a running Host at its root', () => {
    const source = windowsLauncherSource('C:\\dsh-home\\quantskills\\application\\bootstrap', {
      nodeExecutable: 'C:\\node.exe',
      defaultPort: 3198,
    })

    expect(source).toContain('function Get-QuantSkillsLaunchUrl')
    expect(source).toContain('Get-Content -LiteralPath $stdoutPath -Raw -ErrorAction Stop')
    const pattern = source.match(/\[regex\]::Matches\(\$source, '([^']+)'\)/)?.[1]
    expect(pattern).toBeDefined()
    const launchLine = new RegExp(pattern!)
    expect(launchLine.exec('dsh web: http://127.0.0.1:3198/')?.[1]).toBe('http://127.0.0.1:3198/')
    expect(launchLine.exec('dsh web: http://127.0.0.1:3198/?token=legacy')?.[1]).toBe('http://127.0.0.1:3198/?token=legacy')
    expect(source).toContain('Invoke-WebRequest -Uri "http://127.0.0.1:$appPort/"')
    expect(source).toContain('[int]$_.Exception.Response.StatusCode -eq 401')
    expect(source).toContain('if ($alreadyRunning) { $launchUrl = "http://127.0.0.1:$appPort/" }')
    expect(source).toContain('Start-Process -FilePath $edgePath -ArgumentList "--app=$launchUrl"')
  })

  it('commits a healthy pending version and retains exactly one rollback pointer', () => {
    const next = commitPendingState(parseApplicationState({
      schemaVersion: 1,
      active: first,
      pending: second,
      failedCandidates: [{ commit: second, failedAt: 1, errorCode: 'old' }],
    }))

    expect(next).toEqual({
      schemaVersion: 1,
      active: second,
      previous: first,
      failedCandidates: [],
    })
  })

  it('clears a failed pending version without changing the active version', () => {
    const next = rejectPendingState(parseApplicationState({
      schemaVersion: 1,
      active: first,
      pending: second,
      failedCandidates: [],
    }), 'APPLICATION_STARTUP_HEALTH_FAILED', 100)

    expect(next).toEqual({
      schemaVersion: 1,
      active: first,
      failedCandidates: [{
        commit: second,
        failedAt: 100,
        errorCode: 'APPLICATION_STARTUP_HEALTH_FAILED',
      }],
    })
  })

  it('rejects malformed state and version path traversal', () => {
    expect(() => parseApplicationState({ schemaVersion: 1, pending: '../escape', failedCandidates: [] })).toThrow()
    expect(() => managedVersionPath(resolve('versions'), '../escape')).toThrow()
  })

  it('forwards Host arguments after launcher-only arguments and validates the port', () => {
    expect(parseArguments([
      '--source-root', 'C:\\source', '--', '--port', '3198', '--no-open', '--log-level', 'debug',
    ])).toEqual({
      sourceRoot: 'C:\\source',
      hostArgs: ['--port', '3198', '--no-open', '--log-level', 'debug'],
    })
    expect(readPort(['--port', '3198', '--no-open'], 3097)).toBe(3198)
    expect(() => readPort(['--port', '../escape'], 3097)).toThrow()
  })

  it('rejects a second live launcher and recovers a stale launch lock', async () => {
    const root = await mkdtemp(join(tmpdir(), 'quantskills-launch-lock-'))
    roots.push(root)
    const lockPath = join(root, 'launch.lock')
    const lock = await acquireLaunchLock(lockPath, 3198)
    await expect(acquireLaunchLock(lockPath, 3198)).rejects.toThrow(/already starting or running/u)
    await lock.close()
    await writeFile(lockPath, `${JSON.stringify({ pid: 2_147_483_647, startedAt: 0, port: 3198 })}\n`)
    const recovered = await acquireLaunchLock(lockPath, 3198)
    await recovered.close()
  })

  it('recovers corrupt pointers from managed versions and promotes a valid rollback', async () => {
    const root = await mkdtemp(join(tmpdir(), 'quantskills-state-recovery-'))
    roots.push(root)
    const versions = join(root, 'versions')
    await mkdir(versions)
    for (const commit of [first, second]) {
      const version = join(versions, commit)
      await mkdir(version)
      await writeFile(join(version, 'package.json'), '{"name":"@quantskills/dsh-plugin"}\n')
      await writeFile(join(version, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n')
    }
    const recovered = await recoverApplicationState(versions)
    expect(new Set([recovered.active, recovered.previous])).toEqual(new Set([first, second]))

    await rm(join(versions, recovered.active!), { recursive: true, force: true })
    const repaired = await repairApplicationState(recovered, versions)
    expect(repaired.active).toBe(recovered.previous)
    expect(repaired.previous).toBeUndefined()
  })
})
