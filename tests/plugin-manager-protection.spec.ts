import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { boot, initProfile, loadProfileDirectory, readProfilePatches, type ProfileContext } from '@deepseek-ai/dsh-app-boot'
import PluginManager from '@deepseek-ai/dsh-plugin-manager'
import type { Context } from '@deepseek-ai/cordis'

const fixtures: { home: string; ctx?: Context }[] = []
afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    await fixture.ctx?.fiber.dispose()
    await rm(fixture.home, { recursive: true, force: true })
  }
})

async function fixture(ownedComponent = false) {
  const home = await mkdtemp(join(tmpdir(), 'qs-manager-policy-'))
  const cleanup: { home: string; ctx?: Context } = { home }
  fixtures.push(cleanup)
  const dir = join(home, 'profiles', 'test'), anchor = join(home, 'package.json')
  await writeFile(anchor, '{"name":"isolated-installation","dependencies":{}}')
  initProfile(dir, ['manager', '@quantskills/dsh-plugin', 'user-addon'])
  for (const name of ['manager', '@quantskills/dsh-plugin', 'user-addon']) {
    const root = join(dir, 'node_modules', name)
    await mkdir(root, { recursive: true })
    await writeFile(join(root, 'package.json'), JSON.stringify({ name, version: '1.0.0', dsh: { bundle: { patch: './cordis.patch.yml' } } }))
    const rows = name === 'manager' ? [{ id: 'manager', name: 'cordis:manager' }]
      : name === '@quantskills/dsh-plugin' && ownedComponent ? [{ id: 'owned-service', name: 'cordis:owned' }] : []
    await writeFile(join(root, 'cordis.patch.yml'), JSON.stringify([{ insert: rows }]))
  }
  const manifestPath = join(dir, 'package.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  manifest.dependencies = { '@quantskills/dsh-plugin': '1.0.0', 'user-addon': '1.0.0' }
  await writeFile(manifestPath, JSON.stringify(manifest))
  await writeFile(join(dir, 'cordis.yml'), '[]\n')
  const profile: ProfileContext = { name: 'test', dir, installAnchor: anchor, cwd: home, home,
    patchPath: join(dir, 'cordis.patch.yml'), overlays: [], telemetryDisabledEnv: undefined,
    startedBundles: loadProfileDirectory('test', dir, anchor).layers.map(layer => layer.packageName) }
  const ctx = await boot('test', join(dir, 'cordis.yml'), readProfilePatches('test', profile), ctx => {
    cleanup.ctx = ctx
    ctx.provide('profileContext', profile)
    ctx.loader.builtins.manager = PluginManager
    ctx.loader.builtins.owned = { apply() {} }
  })
  return { manager: ctx.pluginManager, manifestPath }
}

it('keeps the QS application bundle read-only even when its patch is empty', async () => {
  const { manager, manifestPath } = await fixture()
  const before = await readFile(manifestPath, 'utf8')
  expect((await manager.listBundles()).find(item => item.name === '@quantskills/dsh-plugin'))
    .toMatchObject({ readOnlyReason: 'management-required', removable: false, enabled: true })
  expect(await manager.setBundleEnabled('@quantskills/dsh-plugin', false)).toMatchObject({ application: 'failed', changed: false })
  expect(await manager.removeBundle('@quantskills/dsh-plugin')).toMatchObject({ application: 'failed', changed: false })
  expect(await readFile(manifestPath, 'utf8')).toBe(before)
  expect(await manager.setBundleEnabled('user-addon', false)).toMatchObject({ changed: true })
})

it('also protects upstream services mounted by the application bundle', async () => {
  const { manager, manifestPath } = await fixture(true)
  const before = await readFile(manifestPath, 'utf8')
  const row = (await manager.listPlugins()).find(item => item.moduleName === 'cordis:owned')!
  expect(row).toMatchObject({ readOnlyReason: 'management-required' })
  expect(await manager.setPluginEnabled(row.entryId, false)).toMatchObject({ application: 'failed', changed: false })
  expect(await readFile(manifestPath, 'utf8')).toBe(before)
})

it('refuses direct application/core replacement before any package manager runs', async () => {
  const { manager, manifestPath } = await fixture()
  const before = await readFile(manifestPath, 'utf8')
  const run = vi.spyOn(manager as unknown as { runPnpm: (...args: unknown[]) => Promise<unknown> }, 'runPnpm')
    .mockRejectedValue(new Error('Package manager must not run'))
  for (const spec of ['@quantskills/dsh-plugin@9.0.0', '@deepseek-ai/dsh-quantskills-host@9.0.0']) {
    expect(await manager.installBundle(spec)).toMatchObject({ application: 'failed', changed: false, error: { code: 'management-required' } })
  }
  expect(run).not.toHaveBeenCalled()
  expect(await readFile(manifestPath, 'utf8')).toBe(before)
})
