import { FlyRuntime } from '../packages/quantskills-session/lib/types/fly-runtime.js'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { setTimeout as delay } from 'node:timers/promises'
import assert from 'node:assert/strict'

const root = join(tmpdir(), 'quantstudio-fly-acceptance')
const runtime = new FlyRuntime(root, async () => { throw new Error('Acceptance test has no account or model access') })
console.log(`Isolated runtime: ${root}`)
try {
  if (!(await runtime.status()).installed) {
    await runtime.install()
    while ((await runtime.status()).installing) await delay(1000)
  }
  assert.equal((await runtime.status()).installed, true, (await runtime.status()).message)
  const blenderArgument = process.argv.indexOf('--blender')
  if (blenderArgument >= 0) {
    const selected = await runtime.request({ path: 'environment/config', body: { blender_path: process.argv[blenderArgument + 1] } })
    console.log('Using installed', selected.version, selected.blender)
  }
  const initial = await runtime.request({ path: 'state' })
  assert.equal(initial.control.trading, false)
  assert.ok(Array.isArray(initial.world.position))
  const asset = await runtime.request({ path: 'asset/default/home.glb' })
  assert.ok(asset.url.startsWith('data:model/gltf-binary;base64,'))
  await assert.rejects(runtime.request({ path: '../execute', body: {} }))
  await runtime.request({ path: 'oracle', body: { text: '验收：保留这条记忆，不调用模型。' } })
  console.log('Controller, original home asset, memory and route boundary passed.')
  if (process.argv.includes('--neural')) {
    await runtime.request({ path: 'environment/prepare', body: {} })
    let stage = '', state
    const deadline = Date.now() + 30 * 60_000
    do {
      await delay(2000)
      state = await runtime.request({ path: 'state' })
      const progress = state.environment.progress
      const next = `${progress.status}: ${progress.stage ?? ''}`
      if (next !== stage) { console.log(next, progress.message ?? ''); stage = next }
      assert.notEqual(progress.status, 'error', progress.message)
      assert.ok(Date.now() < deadline, 'Dependency preparation timed out')
    } while (state.environment.progress.status === 'running')
    assert.equal(state.environment.brain_ready, true)
    assert.equal(state.environment.blender_ready, true)
    await runtime.request({ path: 'control', body: { action: 'start' } })
    do {
      await delay(2000)
      state = await runtime.request({ path: 'state' })
      const next = `${state.neural.status}: ${state.neural.message ?? ''}`
      if (next !== stage) { console.log(next); stage = next }
      assert.notEqual(state.neural.status, 'error', state.neural.message)
      assert.ok(Date.now() < deadline, 'Brain startup timed out')
    } while (state.neural.status !== 'ready')
    await delay(12000)
    state = await runtime.request({ path: 'state' })
    assert.equal(state.control.trading, false)
    assert.ok(state.neural.life_controller)
    await runtime.request({ path: 'control', body: { action: 'checkpoint' } })
    console.log('Original MaleCNS/OpenFly brain is ready; actual life observations:', state.events.filter(e => e.kind === 'decision').length)
  }
  if (process.argv.includes('--scene')) {
    await runtime.request({ path: 'control', body: { action: 'pause' } })
    const state = await runtime.request({ path: 'state' })
    await runtime.request({ path: 'settings', body: { ...state.settings, scenes_daily: (state.usage.scenes ?? 0) + 1 } })
    const job = await runtime.request({ path: 'homes', body: { description: '隔离验收：空旷温室',
      plan: { name: '验收温室', decorations: [] } } })
    const deadline = Date.now() + 240000
    let current
    do {
      await delay(1000)
      current = (await runtime.request({ path: 'state' })).scene_jobs.find(item => item.id === job.id)
      assert.notEqual(current.status, 'failed', current.error)
      assert.ok(Date.now() < deadline, 'Blender scene build timed out')
    } while (current.status !== 'complete')
    const asset = await runtime.request({ path: `asset/${job.id}/home.glb` })
    assert.ok(asset.url.startsWith('data:model/gltf-binary;base64,'))
    await runtime.request({ path: 'homes/restore', body: { version: 'default' } })
    console.log('Blender built and validated a real GLB; original home restored. No model API used.')
  }
} finally { await runtime.dispose() }

const resumed = new FlyRuntime(root, async () => { throw new Error('Acceptance test has no account or model access') })
try {
  await resumed.resume()
  const state = await resumed.request({ path: 'state' })
  assert.equal(state.control.trading, false)
  assert.ok(state.events.some(e => e.kind === 'oracle' && e.payload.text.includes('验收：保留这条记忆')))
  if (process.argv.includes('--neural')) {
    const learning = await resumed.request({ path: 'learning' })
    assert.equal(learning.connectome_frozen, true)
    assert.ok(state.checkpoints.length > 0, 'Expected a saved neural checkpoint')
    await resumed.request({ path: 'control', body: { action: 'pause' } })
  }
  console.log('Host restart preserved memory and checkpoints; trading suggestions remain off.')
} finally { await resumed.dispose() }
