import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { FlyRuntime } from '../src/fly-runtime.ts'

const roots: string[] = []
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (!resolve(root).startsWith(resolve(tmpdir()) + '\\')) throw new Error('测试目录不在临时目录内')
    await rm(root, { recursive: true, force: true })
  }
})

describe.skipIf(process.platform !== 'win32')('fly one-click preparation', () => {
  it('reuses an existing controller, verifies Blender before preparing the brain, and coalesces repeated clicks', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fly-install-')); roots.push(root)
    await mkdir(join(root, 'controller')); await writeFile(join(root, 'controller', '.ready'), '1')
    const runtime = new FlyRuntime(root, async () => null)
    const start = vi.spyOn(runtime as unknown as { start(): Promise<void> }, 'start').mockResolvedValue()
    const gate = Promise.withResolvers<void>()
    const request = vi.spyOn(runtime, 'request').mockImplementation(async ({ path }) => {
      if (path === 'state') { await gate.promise; return { environment: { brain_ready: true, blender_ready: true, progress: { status: 'ready' } } } }
      return { status: 'running' }
    })
    await runtime.install({ blenderPath: 'F:\\New Folder\\blender.exe' })
    await runtime.install()
    gate.resolve()
    await vi.waitFor(async () => { expect((await runtime.status()).installing).toBe(false) })
    expect(start).toHaveBeenCalledOnce()
    expect(request.mock.calls.map(([input]) => input.path)).toEqual(['environment/config', 'environment/prepare', 'state'])
    expect(request.mock.calls[0]?.[0].body).toEqual({ blender_path: 'F:\\New Folder\\blender.exe' })
    expect((await runtime.status()).message).toContain('已就绪')
    await runtime.dispose()
  })

  it('reports preparation errors and allows a retry', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fly-install-')); roots.push(root)
    await mkdir(join(root, 'controller')); await writeFile(join(root, 'controller', '.ready'), '1')
    const runtime = new FlyRuntime(root, async () => null)
    vi.spyOn(runtime as unknown as { start(): Promise<void> }, 'start').mockResolvedValue()
    let failed = false
    const request = vi.spyOn(runtime, 'request').mockImplementation(async ({ path }) => path === 'state'
      ? { environment: failed ? { brain_ready: true, blender_ready: true, progress: { status: 'ready' } }
        : { brain_ready: false, blender_ready: true, progress: { status: 'error', message: '数据校验失败' } } } : { status: 'running' })
    await runtime.install()
    await vi.waitFor(async () => { expect((await runtime.status()).message).toContain('数据校验失败') })
    failed = true
    await runtime.install()
    await vi.waitFor(async () => { expect((await runtime.status()).message).toContain('已就绪') })
    expect(request.mock.calls.filter(([input]) => input.path === 'environment/prepare')).toHaveLength(2)
    await runtime.dispose()
  })
})
