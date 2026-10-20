/** Exercise installed rc.2 artifacts, never source aliases, with disposable data only. */
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { Context } from '@deepseek-ai/cordis'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import FileSystem from '@deepseek-ai/dsh-fs-local'
import Subprocess from '@deepseek-ai/dsh-subprocess-local'
import Sandbox from '@deepseek-ai/dsh-sandbox-local'
import SandboxPolicy from '@deepseek-ai/dsh-sandbox-policy'
import SessionProjections from '@deepseek-ai/dsh-session-projection'
import NodeRuntime from '@deepseek-ai/dsh-ptc-runtime-node'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { JsonStorageBackend } from '@deepseek-ai/dsh-storage-json'
import { scheduleDomain, createEveryScheduleRecord, ScheduleId } from '@deepseek-ai/dsh-schedule'
import { HttpFetchProvider } from '@deepseek-ai/dsh-web-fetch-http'
import { DeepSeekSearchProvider } from '@deepseek-ai/dsh-web-search-deepseek'
import { afterEach, expect, it, vi } from 'vitest'

const roots: string[] = [], contexts: Context[] = []
afterEach(async () => {
  vi.unstubAllGlobals()
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
})
async function directory() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'qs-rc2-contract-')))
  roots.push(root); return root
}
it('executes persistent PTC, separates owners, reports errors and releases retained memory', async () => {
  const cwd = await directory(), ctx = new Context(); contexts.push(ctx)
  await ctx.plugin(SessionStore)
  await ctx.plugin(FileSystem)
  await ctx.plugin(Subprocess)
  await ctx.plugin(Sandbox, {})
  await ctx.plugin(SessionProjections)
  await ctx.plugin(SandboxPolicy, { mode: 'danger-full-access', workspaceRoot: cwd })
  await ctx.plugin(NodeRuntime, { executionMode: 'persistent-in-memory' })
  const owner = {}, runtime = ctx.ptcRuntime
  const run = (program: string, stateOwner = owner) => runtime.run(runtime.resolve({ program, bindings: [], cwd, stateOwner }))
  expect((await run('let retained = 40;')).error).toBeUndefined()
  expect((await run('retained += 2; retained')).value).toBe(42)
  expect((await run('typeof retained', {})).value).toBe('undefined')
  expect((await run('throw new Error("isolated failure")')).error?.message).toContain('isolated failure')
  expect((await run('retained')).value).toBe(42)
  await runtime.release(owner)
  expect((await run('typeof retained')).value).toBe('undefined')
}, 30000)

it('persists schedule status, session binding and deletion without starting a scheduler', async () => {
  const root = await directory()
  const open = async () => {
    const ctx = new Context(); contexts.push(ctx)
    await ctx.plugin(Storage)
    const backend = new JsonStorageBackend(root)
    ctx.storage.backend.register('json', backend)
    const domain = await new DomainFacility(ctx, { backend: 'json' }).open(scheduleDomain)
    ctx.effect(() => async () => { await domain.close(); await backend.close() })
    return { ctx, tasks: domain.table('tasks') }
  }
  const record = createEveryScheduleRecord(ScheduleId('fixture'), 'No execution', 300, 0, 'No execution')
  const task = { sessionId: SessionId('fixture-session'), record, status: 'inactive' as const }
  const first = await open()
  await first.tasks.put(record.id, task); await first.ctx.fiber.dispose()
  const second = await open()
  expect(second.tasks.get(record.id)).toEqual(task)
  await second.tasks.put(record.id, { ...task, status: 'active' }); await second.ctx.fiber.dispose()
  const third = await open()
  expect(third.tasks.get(record.id)?.status).toBe('active')
  await third.tasks.delete(record.id); await third.ctx.fiber.dispose()
  const fourth = await open()
  expect([...fourth.tasks.entries()]).toEqual([])
  expect(() => createEveryScheduleRecord(ScheduleId('bad'), 'Invalid', -1, 0, 'Invalid')).toThrow()
})

it('fetches a pinned local fixture and reports unsupported content, cancellation and private-address refusal', async () => {
  const server = createServer((request, response) => {
    response.setHeader('content-type', request.url === '/binary' ? 'application/octet-stream' : 'text/plain')
    response.end('isolated fetch result')
  })
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done))
  const port = (server.address() as { port: number }).port
  const limits = { maxResponseBytes: 1000, maxBodyChars: 1000, timeoutMs: 3000, maxRedirects: 0, userAgent: 'QS-fixture' }
  // The exported resolver seam is test-local. The default resolver remains protected.
  const fixture = new HttpFetchProvider(limits, async () => [{ address: '127.0.0.1', family: 4 }])
  try {
    const url = `http://127.0.0.1:${port}`
    expect(JSON.stringify(await fixture.fetch({ url }))).toContain('isolated fetch result')
    await expect(fixture.fetch({ url: url + '/binary' })).rejects.toMatchObject({ code: 'WEB_UNSUPPORTED_CONTENT_TYPE' })
    await expect(fixture.fetch({ url }, AbortSignal.abort())).rejects.toMatchObject({ code: 'WEB_ABORTED' })
    await expect(new HttpFetchProvider(limits).fetch({ url })).rejects.toThrow()
  } finally {
    server.closeAllConnections(); await new Promise<void>(done => server.close(() => done()))
  }
})

it('maps structured search results and surfaces service failures instead of inventing results', async () => {
  const provider = new DeepSeekSearchProvider(() => ({
    apiKey: 'fixture-only', baseURL: 'https://search.invalid/v1', model: 'fixture',
    apiVersion: '2023-06-01', maxTokens: 100, maxUses: 1,
  }))
  const transport = vi.fn(async () => new Response(JSON.stringify({ content: [{
    type: 'web_search_tool_result', content: [{ type: 'web_search_result', url: 'https://example.invalid/fixture', title: 'Fixture' }],
  }] }), { status: 200, headers: { 'content-type': 'application/json' } }))
  vi.stubGlobal('fetch', transport)
  expect((await provider.search({ query: 'fixture' })).sources).toEqual([{ url: 'https://example.invalid/fixture', title: 'Fixture' }])
  transport.mockImplementationOnce(async () => new Response('unavailable', { status: 503 }))
  await expect(provider.search({ query: 'fixture' })).rejects.toThrow()
  await expect(provider.search({ query: 'fixture' }, AbortSignal.abort())).rejects.toThrow()
  expect(transport).toHaveBeenCalledTimes(2)
})
