/** Official-manager selection persistence. No model, account, device or task is invoked. */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { boot, initProfile, OPTIONAL_BUNDLES, OFFICIAL_ON_DEMAND_CATALOG, resolveBundleDir } from '@deepseek-ai/dsh-app-boot'
import PluginManager from '@deepseek-ai/dsh-plugin-manager'

const require = createRequire(import.meta.url)
const root = await realpath(await mkdtemp(join(tmpdir(), 'qs-optional-settings-')))
const dir = join(root, 'profiles/web'), anchor = require.resolve('@deepseek-ai/dsh/package.json')
let ctx, passed = false
try {
  initProfile(dir, [])
  const config = join(root, 'manager.yml')
  await writeFile(config, '- id: manager\n  name: cordis:manager\n')
  const profile = { name: 'web', dir, installAnchor: anchor, cwd: root, home: root,
    patchPath: join(dir, 'cordis.patch.yml'), overlays: [], telemetryDisabledEnv: undefined, startedBundles: [] }
  const start = async () => boot('isolated-settings', config, [], context => {
    context.provide('profileContext', profile); context.loader.builtins.manager = PluginManager
  })
  ctx = await start()
  const onDemand = []
  for (const { packageName } of OFFICIAL_ON_DEMAND_CATALOG) {
    const item = (await ctx.pluginManager.listBundles()).find(row => row.name === packageName)
    assert.equal(item?.enabled, false)
    assert.equal(item?.installed, false)
    assert.deepEqual(item?.installTarget, { spec: `${packageName}@0.2.1-rc.2`, version: '0.2.1-rc.2' })
    onDemand.push({ name: packageName, spec: item.installTarget.spec, defaultNotInstalled: true })
  }
  const manifest = async () => JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
  const selected = async () => (await manifest()).dsh.profile.bundles
  const saved = result => assert.ok(['applied', 'restart-required'].includes(result.application), JSON.stringify(result))
  const results = []
  for (const name of OPTIONAL_BUNDLES) {
    assert.equal((await ctx.pluginManager.listBundles()).find(row => row.name === name)?.enabled, false)
    const bundle = resolveBundleDir('ci', name, anchor, dir)
    assert.equal(JSON.parse(await readFile(join(bundle, 'package.json'), 'utf8')).version, '0.2.1-rc.2')
    saved(await ctx.pluginManager.setBundleEnabled(name, true))
    saved(await ctx.pluginManager.setBundleEnabled(name, true))
    assert.equal((await selected()).filter(item => item === name).length, 1)
    results.push({ name, defaultDisabled: true, enabled: true, repeatIsIdempotent: true })
  }
  const beforeError = await readFile(join(dir, 'package.json'), 'utf8')
  assert.equal((await ctx.pluginManager.setBundleEnabled('@quantskills/absent-fixture', true)).application, 'failed')
  assert.equal(await readFile(join(dir, 'package.json'), 'utf8'), beforeError)
  // Recreate the actual service over the saved on-disk Profile, with no HMR shortcut.
  await ctx.fiber.dispose(); ctx = await start()
  for (const row of results) {
    assert.equal((await ctx.pluginManager.listBundles()).find(item => item.name === row.name)?.enabled, true)
    saved(await ctx.pluginManager.setBundleEnabled(row.name, false))
    saved(await ctx.pluginManager.setBundleEnabled(row.name, false))
    row.persistedAcrossServiceRestart = true; row.disabled = true
  }
  await ctx.fiber.dispose(); ctx = await start()
  assert.deepEqual(await selected(), [])
  for (const name of OPTIONAL_BUNDLES) assert.equal((await ctx.pluginManager.listBundles()).find(row => row.name === name)?.enabled, false)
  passed = true
  console.log(JSON.stringify({ result: 'passed', runtime: '0.2.1-rc.2', scope: 'official-manager-on-disk-settings',
    invalidSelectionPreservesProfile: true, externalCapabilitiesExecuted: false, onDemand, results }))
} finally {
  await ctx?.fiber.dispose()
  if (passed) {
    if (dirname(root) !== await realpath(tmpdir())) throw new Error('Unexpected fixture path')
    await rm(root, { recursive: true, force: true })
  } else console.error('Optional selection fixture retained: ' + root)
}
