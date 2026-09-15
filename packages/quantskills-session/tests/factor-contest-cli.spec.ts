import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { afterEach, expect, it, vi } from 'vitest'
import type { SubprocessRuntime, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import { factorRuntimeDirectory, OfficialFactorRuntime } from '../src/factor-contest-cli.ts'

const roots: string[] = []
afterEach(async () => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'factor-cli-auth-')); roots.push(root)
  const spawn = vi.fn((spec: SubprocessSpawnSpec) => ({ done: Promise.resolve({ exitCode: 0 }), terminate: vi.fn(), waitForExit: async () => {},
    collected: { stdout: { readFrom: () => ({ lossy: false, text: JSON.stringify({ success: true, balance: { computingPower: 20 }, nested: { token: 'must-not-leak', phone: 'private' }, argv: spec.argv[0] }) }) } } }))
  const runtime = new OfficialFactorRuntime(() => ({ spawn } as unknown as SubprocessRuntime), root)
  return { root, runtime, spawn }
}
it.skipIf(process.platform !== 'win32')('installs and runs long-path environments in the same short isolated directory', async () => {
  const f = await fixture()
  vi.stubEnv('LOCALAPPDATA', f.root)
  const logical = join(f.root, 'deep-workspace-'.repeat(10), 'runtime-1')
  const physical = factorRuntimeDirectory(logical)
  expect(physical.length).toBeLessThan(logical.length)
  expect(factorRuntimeDirectory(logical)).toBe(physical)
  expect(factorRuntimeDirectory(logical + '-other-home')).not.toBe(physical)
  const spawn = vi.fn((spec: SubprocessSpawnSpec) => ({ done: Promise.resolve({ exitCode: 0 }), terminate: vi.fn(), waitForExit: async () => {},
    collected: { stdout: { readFrom: () => ({ lossy: false, text: spec.argv.includes('-c')
      ? spec.argv.at(-1)?.includes('metadata') ? '0.1.7' : 'ok'
      : JSON.stringify({ success: true }) }) } } }))
  const runtime = new OfficialFactorRuntime(() => ({ spawn, resolveExecutable: async () => 'python.exe' } as unknown as SubprocessRuntime), f.root)
  await runtime.install(logical, '0.1.7', new AbortController().signal)
  expect(spawn.mock.calls.some(([spec]) => spec.argv.includes('venv') && spec.argv.at(-1) === physical)).toBe(true)
  await mkdir(join(physical, 'Scripts'), { recursive: true })
  await writeFile(join(physical, 'Scripts/python.exe'), '')
  await runtime.cli(logical, ['balance'], new AbortController().signal)
  expect(spawn.mock.calls.at(-1)?.[0]).toMatchObject({ cwd: physical,
    argv: [join(physical, 'Scripts/python.exe'), '-m', 'cli', '--config', join(f.root, 'config.json'), '--json', 'balance'] })
  await rm(join(physical, 'Scripts/python.exe'))
  await runtime.cli(logical, ['balance'], new AbortController().signal)
  expect(spawn.mock.calls.at(-1)?.[0].cwd).toBe(logical)
})
it('uses the official password protocol without including credentials in process arguments', async () => {
  const f = await fixture()
  const fetch = vi.fn(async (url: string) => new Response(JSON.stringify({ code: '200', data: url.endsWith('/login/pw') ? 'private-token' : { id: 'user1' } })))
  vi.stubGlobal('fetch', fetch)
  expect(await f.runtime.login({ phone: '13800000000', password: 'secret-password' }, new AbortController().signal)).toBe('user1')
  const calls = fetch.mock.calls as unknown as [string, RequestInit][]
  expect(calls[0]?.[0]).toBe('https://www.pandaaiquant.com/pandaApi/login/pw')
  expect(JSON.parse(String(calls[0]?.[1].body))).toEqual({ phone: '13800000000', password: createHash('md5').update('secret-password').digest('hex'), countryCode: '86' })
  expect(JSON.parse(await readFile(join(f.root, 'config.json'), 'utf8'))).toEqual({ gateway_url: 'https://www.pandaaiquant.com/pandaApi', token: 'private-token', uid: 'user1' })
  expect(f.spawn).not.toHaveBeenCalled()
  await f.runtime.logout(); await expect(f.runtime.identity(new AbortController().signal)).rejects.toThrow('失效')
})
it('passes config and JSON flags before the CLI command and filters sensitive output fields', async () => {
  const f = await fixture()
  const result = await f.runtime.cli(f.root, ['balance'], new AbortController().signal)
  expect(result).toMatchObject({ success: true, balance: { computingPower: 20 }, nested: {} })
  expect(f.spawn.mock.calls[0]?.[0].argv).toEqual([expect.stringMatching(/python(?:\.exe)?$/), '-m', 'cli', '--config', join(f.root, 'config.json'), '--json', 'balance'])
  expect(f.spawn.mock.calls[0]?.[0].env).toMatchObject({ PYTHONPATH: undefined, PYTHONHOME: undefined })
})
it('sends authenticated arena mutations only to the official origin with their stable idempotency key', async () => {
  const f = await fixture()
  const fetch = vi.fn(async (url: string) => new Response(JSON.stringify({ code: '200', data: url.endsWith('/login/pw') ? 'private-token' : url.endsWith('/user/info') ? { id: 'user1' } : { pool_id: 'p1', token: 'secret' } })))
  vi.stubGlobal('fetch', fetch)
  const signal = new AbortController().signal
  await f.runtime.login({ phone: '13800000000', password: 'pass' }, signal)
  expect(await f.runtime.arena('/factorPool/pools/p1/submit', signal, { method: 'POST', key: 'plan-id' })).toEqual({ pool_id: 'p1' })
  const calls = fetch.mock.calls as unknown as [string, RequestInit][]
  expect(calls.at(-1)).toEqual(['https://api.pandaaiquant.com/factorPool/pools/p1/submit', expect.objectContaining({ method: 'POST', redirect: 'error', headers: expect.objectContaining({ Authorization: 'private-token', 'Idempotency-Key': 'plan-id' }) })])
  await expect(f.runtime.arena('https://other.invalid', signal)).rejects.toThrow('无效')
})
it('redacts upstream errors and distinguishes rejected mutations from ambiguous responses', async () => {
  const f = await fixture()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: 'INVALID_PARAMETER', message: 'password=secret' }), { status: 400 })))
  await expect(f.runtime.login({ phone: '13800000000', password: 'pass' }, new AbortController().signal)).rejects.toMatchObject({ rejected: true, message: expect.not.stringContaining('secret') })
})
