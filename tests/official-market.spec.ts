import { afterEach, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import { Context } from '@deepseek-ai/cordis'
import Market from '@deepseek-ai/dsh-plugin-market'
import { composeEntries, loadOverlayPatches } from '@deepseek-ai/dsh-app-boot'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const contexts: Context[] = [], servers: Server[] = []
afterEach(async () => {
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
  for (const server of servers.splice(0)) { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())) }
})

it('loads the pinned community index only with the optional bundle and preserves user index configuration', () => {
  const require = createRequire(import.meta.url)
  const file = join(dirname(require.resolve('@deepseek-ai/dsh-experimental-plugin-market-bundle/package.json')), 'cordis.patch.yml')
  const patches = loadOverlayPatches('test', file)
  const bundled = composeEntries([patches]).find(row => row.id === 'plugin-market')
  expect(bundled?.config).toEqual({ indexes: ['https://cdn.jsdelivr.net/npm/dsh-plugin-catalog@2026.1020.8394/index.json'] })
  const overridden = composeEntries([patches, [{ id: 'plugin-market', config: { indexes: ['https://example.invalid/private-index.json'] } }]])
  expect(overridden.find(row => row.id === 'plugin-market')?.config).toEqual({ indexes: ['https://example.invalid/private-index.json'] })
})

it('browses and paginates official Discover with explicit errors, compatible install targets and service remount', async () => {
  let hits = 0, broken = false
  const document = { format: 1, title: 'Isolated market', plugins: ['first', 'second'].map(name => ({
    name: `qs-fixture-${name}`, title: name, versions: [{ version: '1.0.0', publishTimestamp: 1, source: { type: 'npm' } }],
  })) }
  const server = createServer((_request, response) => {
    hits++; response.setHeader('content-type', 'application/json')
    response.end(broken ? '{"format":99}' : JSON.stringify(document))
  })
  servers.push(server)
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done))
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/index.json`
  async function mount() {
    const ctx = new Context(); contexts.push(ctx)
    ctx.provide('pluginManager', { listBundles: async () => [], listVersionExemptions: () => ({ exemptions: {} }) } as never)
    await ctx.plugin(Market, { indexes: [url], fetchTimeoutMs: 1000, maxBytes: 65536, cacheTtlMs: 60000 })
    return ctx
  }
  let ctx = await mount()
  const query = { sort: { kind: 'index' as const }, offset: 0, limit: 1 }
  const page = await ctx.pluginMarket.search(url, query)
  expect(page).toMatchObject({ total: 2, nextOffset: 1 })
  expect(page.entries[0]).toMatchObject({ name: 'qs-fixture-first', versions: [{ install: { spec: 'qs-fixture-first@1.0.0' } }] })
  expect((await ctx.pluginMarket.search(url, { ...query, offset: 1, fetchedAt: page.fetchedAt })).entries[0]?.name).toBe('qs-fixture-second')
  expect(hits).toBe(1)
  await expect(ctx.pluginMarket.search(url, { ...query, limit: 0 })).rejects.toMatchObject({ code: 'plugin-market/invalid-query' })
  await expect(ctx.pluginMarket.search(url + '?other', query)).rejects.toMatchObject({ code: 'plugin-market/unknown-index' })
  broken = true
  await expect(ctx.pluginMarket.search(url, { ...query, refresh: true })).rejects.toMatchObject({ code: 'plugin-market/invalid-index' })
  expect(ctx.pluginMarket.listIndexes()[0]?.error).toBeTruthy()
  await ctx.fiber.dispose(); contexts.splice(contexts.indexOf(ctx), 1)
  broken = false; ctx = await mount()
  expect(ctx.pluginMarket.listIndexes()).toEqual([{ url }])
  expect((await ctx.pluginMarket.search(url, query)).total).toBe(2)
})
