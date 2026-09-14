import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { WorkspaceId, type Workspace } from '@deepseek-ai/dsh-workspace'
import {
  QuantSkillsWorkspaceResolver,
  resolveQuantSkillsManagedPath,
} from '../src/managed-workspace.ts'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('QuantSkills managed Workspace path', () => {
  it('uses the Windows Documents known folder', async () => {
    const calls: Array<[string, readonly string[]]> = []
    const path = await resolveQuantSkillsManagedPath({
      platform: 'win32',
      runCommand: (command, args) => {
        calls.push([command, args])
        return Promise.resolve({ stdout: 'D:\\Redirected Documents\r\n', stderr: '' })
      },
    })
    expect(path).toBe('D:\\Redirected Documents\\QuantSkills')
    expect(calls).toHaveLength(1)
    expect(calls[0]?.[0]).toBe('powershell.exe')
  })

  it('uses macOS Documents without touching the filesystem', async () => {
    await expect(resolveQuantSkillsManagedPath({ platform: 'darwin', home: '/Users/ada' }))
      .resolves.toBe('/Users/ada/Documents/QuantSkills')
  })

  it('reads Linux XDG Documents and falls back to the home directory', async () => {
    await expect(resolveQuantSkillsManagedPath({
      platform: 'linux',
      home: '/home/ada',
      env: {},
      readTextFile: () => Promise.resolve('XDG_DOCUMENTS_DIR="$HOME/Shared Documents"\n'),
    })).resolves.toBe('/home/ada/Shared Documents/QuantSkills')
    await expect(resolveQuantSkillsManagedPath({
      platform: 'linux',
      home: '/home/ada',
      env: {},
      readTextFile: () => Promise.reject(Object.assign(new Error('missing'), { code: 'ENOENT' })),
    })).resolves.toBe('/home/ada/QuantSkills')
  })
})

describe('QuantSkills managed Workspace resolution', () => {
  it('is read-only during status and single-flights concurrent creation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-quantskills-workspace-'))
    roots.push(root)
    const managed = join(root, 'Documents', 'QuantSkills')
    const workspaces: Workspace[] = []
    let creates = 0
    const registry = {
      list: () => [...workspaces],
      get: (id: ReturnType<typeof WorkspaceId>) => workspaces.find(workspace => workspace.id === id),
      create: async (path: string, title?: string) => {
        creates += 1
        const canonical = await realpath(path)
        const workspace = {
          id: WorkspaceId(`workspace-${String(creates)}`),
          path: canonical,
          title: title ?? 'QuantSkills',
          status: () => Promise.resolve('ok' as const),
        } as Workspace
        workspaces.push(workspace)
        return workspace
      },
    }
    const resolver = new QuantSkillsWorkspaceResolver(registry as never, () => Promise.resolve(managed))
    await expect(resolver.status()).resolves.toMatchObject({ managedPath: managed, preferredMissing: false })
    await expect(realpath(managed)).rejects.toMatchObject({ code: 'ENOENT' })
    const [left, right] = await Promise.all([resolver.resolve(), resolver.resolve()])
    expect(left.workspace.workspaceId).toBe(right.workspace.workspaceId)
    expect(creates).toBe(1)
  })

  it('uses a valid preference and recovers a stale one to the managed Workspace', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-quantskills-preference-'))
    roots.push(root)
    const preferredPath = join(root, 'preferred')
    const managedPath = join(root, 'managed')
    await mkdir(preferredPath)
    const preferredId = WorkspaceId('preferred')
    const staleId = WorkspaceId('stale')
    const preferred = {
      id: preferredId,
      path: await realpath(preferredPath),
      title: 'Research',
      status: () => Promise.resolve('ok' as const),
    } as Workspace
    const workspaces: Workspace[] = [preferred]
    const registry = {
      list: () => [...workspaces],
      get: (id: ReturnType<typeof WorkspaceId>) => workspaces.find(workspace => workspace.id === id),
      create: async (path: string, title?: string) => {
        const workspace = {
          id: WorkspaceId('managed'),
          path: await realpath(path),
          title: title ?? 'QuantSkills',
          status: () => Promise.resolve('ok' as const),
        } as Workspace
        workspaces.push(workspace)
        return workspace
      },
    }
    const resolver = new QuantSkillsWorkspaceResolver(registry as never, () => Promise.resolve(managedPath))
    await expect(resolver.resolve(preferredId)).resolves.toMatchObject({ source: 'preferred', workspace: { workspaceId: preferredId } })
    await expect(resolver.resolve(staleId)).resolves.toMatchObject({
      source: 'managed',
      recoveredPreferredWorkspaceId: staleId,
    })
  })

  it('adopts an existing registration, recreates its directory, and does not duplicate it', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-quantskills-adopt-'))
    roots.push(root)
    const managedPath = join(root, 'QuantSkills')
    const registeredPath = join(await realpath(root), 'QuantSkills')
    const managedId = WorkspaceId('managed-existing')
    const existing = {
      id: managedId,
      path: registeredPath,
      title: 'QuantSkills',
      status: async () => {
        try {
          await realpath(managedPath)
          return 'ok' as const
        } catch {
          return 'missing-dir' as const
        }
      },
    } as Workspace
    const create = async (): Promise<Workspace> => { throw new Error('must not create a duplicate registration') }
    const resolver = new QuantSkillsWorkspaceResolver({
      list: () => [existing],
      get: () => existing,
      create,
    } as never, () => Promise.resolve(managedPath))

    await expect(resolver.status()).resolves.toEqual({
      managedPath,
      preferredMissing: false,
    })
    await expect(resolver.resolve()).resolves.toMatchObject({
      source: 'managed', workspace: { workspaceId: managedId },
    })
    await expect(realpath(managedPath)).resolves.toBe(registeredPath)
    await expect(resolver.status()).resolves.toMatchObject({
      managedWorkspace: { workspaceId: managedId },
    })
  })

  it('uses a deterministic suffix when another path already owns the default title', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-quantskills-title-'))
    roots.push(root)
    const managedPath = join(root, 'managed')
    const other = {
      id: WorkspaceId('other'), path: join(root, 'other'), title: 'QuantSkills',
      status: () => Promise.resolve('ok' as const),
    } as Workspace
    let createdTitle: string | undefined
    const resolver = new QuantSkillsWorkspaceResolver({
      list: () => [other],
      get: () => undefined,
      create: async (path: string, title?: string) => {
        createdTitle = title
        return {
          id: WorkspaceId('managed'), path: await realpath(path), title: title ?? '',
          status: () => Promise.resolve('ok' as const),
        } as Workspace
      },
    } as never, () => Promise.resolve(managedPath))

    await resolver.resolve()
    expect(createdTitle).toBe('QuantSkills (2)')
  })

  it('reports file conflicts and permission failures without registering a Workspace', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-quantskills-failure-'))
    roots.push(root)
    const filePath = join(root, 'QuantSkills')
    await writeFile(filePath, 'occupied')
    const create = async (): Promise<Workspace> => { throw new Error('registration must follow directory creation') }
    const registry = { list: () => [], get: () => undefined, create }
    const fileResolver = new QuantSkillsWorkspaceResolver(
      registry as never, () => Promise.resolve(filePath), process.platform,
    )
    await expect(fileResolver.resolve()).rejects.toMatchObject({ code: 'EEXIST' })

    const permissionError = Object.assign(new Error('denied'), { code: 'EACCES' })
    const deniedResolver = new QuantSkillsWorkspaceResolver(
      registry as never,
      () => Promise.resolve(join(root, 'denied')),
      process.platform,
      () => Promise.reject(permissionError),
    )
    await expect(deniedResolver.resolve()).rejects.toBe(permissionError)
  })
})
