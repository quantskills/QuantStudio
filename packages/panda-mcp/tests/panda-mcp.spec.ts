import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import PandaMcpGateway, {
  pandaMcpPublicNames,
  type PandaMcpSessionConnector,
} from '../src/index.ts'
import { publicToolName } from '../src/public-name.ts'
import { systemBrowserLaunch } from '../src/browser.ts'
import { PandaMcpOAuthStore, pandaMcpOAuthPath } from '../src/oauth-store.ts'
import { PANDA_MCP_TOOL_NAMES } from '../src/types.ts'

const roots: string[] = []
const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

interface FakeTool {
  readonly name: string
  readonly description: string
  readonly parameters?: Record<string, unknown>
  execute(args: unknown, exec: { signal?: AbortSignal }): Promise<unknown>
}

function tempHome(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-panda-mcp-'))
  roots.push(root)
  return root
}

function fakeClient(options: {
  call?: (name: string, args: Record<string, unknown>) => unknown
}): Client {
  const call = options.call ?? ((name) => ({ ok: true, method: name }))
  return {
    request: async (request: { method: string; params?: { name?: string; arguments?: Record<string, unknown>; cursor?: string } }) => {
      if (request.method === 'tools/list') {
        return {
          tools: PANDA_MCP_TOOL_NAMES.map(name => ({
            name,
            description: name,
            inputSchema: { type: 'object', additionalProperties: true },
          })),
        }
      }
      if (request.method === 'tools/call') {
        const name = request.params?.name ?? ''
        const args = request.params?.arguments ?? {}
        const value = call(name, args)
        if (value instanceof Error) throw value
        if (typeof value === 'object' && value !== null && 'content' in value) return value
        return { content: [{ type: 'text', text: JSON.stringify(value) }] }
      }
      throw new Error(`unexpected MCP method ${request.method}`)
    },
  } as Client
}

async function setup(options: {
  connector?: PandaMcpSessionConnector
  openAuthorization?: (url: URL) => void | Promise<void>
} = {}) {
  const dshHome = tempHome()
  const registered = new Map<string, FakeTool>()
  const ctx = new Context()
  contexts.push(ctx)
  ctx.provide('tools', {
    register(definition: FakeTool) {
      if (registered.has(definition.name)) throw new Error(`duplicate tool ${definition.name}`)
      registered.set(definition.name, definition)
      return () => {
        if (registered.get(definition.name) === definition) registered.delete(definition.name)
      }
    },
  } as never)
  ctx.provide('agents', { list: () => [] } as never)
  ctx.provide('systemPrompt', { section: () => () => {} } as never)
  await ctx.plugin(PandaMcpGateway, { dshHome, authTimeoutMs: 5_000 })
  if (options.connector !== undefined) ctx.pandaMcp.useConnector(options.connector)
  if (options.openAuthorization !== undefined) ctx.pandaMcp.useOpenAuthorization(options.openAuthorization)
  await ctx.pandaMcp.status()
  return { ctx, dshHome, registered }
}

async function execute(registered: Map<string, FakeTool>, name: string, args: unknown = {}) {
  const tool = registered.get(name)
  if (tool === undefined) throw new Error(`missing tool ${name}`)
  return tool.execute(args, {})
}

describe('panda-mcp', () => {
  it('preserves OAuth query parameters when Windows opens the browser', () => {
    const href = 'https://pandadatamcp.pandaaiquant.com/authorize?response_type=code&client_id=quantskills&code_challenge=pkce&code_challenge_method=S256'
    expect(systemBrowserLaunch(href, 'win32')).toEqual({
      command: 'rundll32.exe',
      args: ['url.dll,FileProtocolHandler', href],
    })
  })

  it('keeps public names in the mcp-client contract', () => {
    expect(publicToolName('pandadata', 'call_pandadata')).toBe('mcp__pandadata__call_pandadata')
    expect(pandaMcpPublicNames()).toEqual(PANDA_MCP_TOOL_NAMES.map(name => `mcp__pandadata__${name}`))
  })

  it('never includes tokens or passwords in status', async () => {
    const { ctx } = await setup()
    const status = await ctx.pandaMcp.status()
    const encoded = JSON.stringify(status)
    expect(encoded).not.toMatch(/access_token|refresh_token|password|jwt/i)
    expect(status.phase).toBe('disconnected')
    expect(status).toEqual({
      ok: true,
      phase: 'disconnected',
      url: 'https://pandadatamcp.pandaaiquant.com/mcp',
      toolCount: status.toolCount,
      toolNames: pandaMcpPublicNames(),
      message: status.message,
    })
  })

  it('registers stub tools while disconnected and leaves auth_status offline', async () => {
    const opened: string[] = []
    const { ctx, registered } = await setup({
      openAuthorization: (url) => { opened.push(url.href) },
      connector: {
        connect: async () => {
          throw new Error('auth_status must not connect')
        },
      },
    })
    const status = await ctx.pandaMcp.status()
    expect(status.phase).toBe('disconnected')
    expect(status.toolNames).toEqual(pandaMcpPublicNames())
    expect(status.url).toBe('https://pandadatamcp.pandaaiquant.com/mcp')
    for (const [name, required] of [
      ['search_methods', 'query'],
      ['get_method_doc', 'method'],
      ['call_pandadata', 'method'],
    ] as const) {
      expect(registered.get(`mcp__pandadata__${name}`)?.parameters).toMatchObject({
        type: 'object',
        required: [required],
        properties: { [required]: { type: 'string' } },
      })
    }
    const auth = await execute(registered, 'mcp__pandadata__auth_status')
    expect(auth).toMatchObject({ ok: true, phase: 'disconnected' })
    expect(opened).toEqual([])
  })

  it('reuses stub names safely when a saved-token refresh cannot reach the MCP service', async () => {
    const { ctx, dshHome, registered } = await setup({
      connector: {
        connect: async () => {
          throw new Error('PandaData MCP is offline')
        },
      },
    })
    const store = new PandaMcpOAuthStore(pandaMcpOAuthPath(dshHome))
    await store.saveTokens({ access_token: 'saved-access-token', token_type: 'Bearer' })

    await expect(ctx.pandaMcp.refresh()).resolves.toMatchObject({ phase: 'needs_auth' })
    expect([...registered.keys()].filter(name => name.startsWith('mcp__'))).toEqual(pandaMcpPublicNames())
    expect(registered.has('quantskills_data_catalog')).toBe(true)
    expect(registered.has('quantskills_data_query')).toBe(true)
  })

  it('opens OAuth on first data-tool call and exposes remote tools after login', async () => {
    const opened: string[] = []
    let calls = 0
    const { ctx, registered, dshHome } = await setup({
      openAuthorization: (url) => { opened.push(url.href) },
      connector: {
        connect: async ({ openAuthorization, store }) => {
          await openAuthorization(new URL('https://pandadatamcp.pandaaiquant.com/authorize?login=1'))
          await store.saveTokens({ access_token: 'mcp-access-secret', token_type: 'Bearer' })
          return {
            client: fakeClient({
              call: (name, args) => {
                calls += 1
                return { ok: true, method: name, query: args.query ?? null }
              },
            }),
            close: async () => {},
          }
        },
      },
    })

    const search = await execute(registered, 'mcp__pandadata__search_methods', { query: '行情' })
    expect(opened).toHaveLength(1)
    expect(opened[0]).toContain('https://pandadatamcp.pandaaiquant.com/authorize')
    expect(search).toMatchObject({ ok: true, method: 'search_methods', query: '行情' })
    const status = await ctx.pandaMcp.status()
    expect(status.phase).toBe('connected')
    expect(status.toolNames).toContain('mcp__pandadata__call_pandadata')
    expect(JSON.stringify(status)).not.toContain('mcp-access-secret')
    expect(JSON.stringify(status)).not.toContain('password')
    expect(calls).toBe(1)

    const call = await execute(registered, 'mcp__pandadata__call_pandadata', { method: 'get_stock_daily' })
    expect(call).toMatchObject({ ok: true, method: 'call_pandadata' })
    expect(calls).toBe(2)
    expect(pandaMcpOAuthPath(dshHome)).toContain('panda-mcp')
  })

  it('exposes real cache reads to AI after both MCP tool synchronization and logout', async () => {
    let calls = 0
    const { ctx, registered } = await setup({
      openAuthorization: () => {},
      connector: { connect: async ({ store }) => {
        await store.saveTokens({ access_token: 'test-token', token_type: 'Bearer' })
        return { client: fakeClient({ call: () => { calls++; return { data: [{ date: '2026-09-10', close: 12 }] } } }), close: async () => {} }
      } },
    })
    await ctx.pandaMcp.authenticate()
    await execute(registered, 'mcp__pandadata__call_pandadata', { method: 'get_daily', params: { symbol: 'TEST' } })
    await execute(registered, 'mcp__pandadata__call_pandadata', { method: 'get_daily', params: { symbol: 'TEST' } })
    expect(calls).toBe(1)
    const catalog = await execute(registered, 'quantskills_data_catalog') as { datasets: { id: string }[] }
    expect(catalog.datasets).toHaveLength(1)
    await ctx.pandaMcp.logout()
    const result = await execute(registered, 'quantskills_data_query', { id: catalog.datasets[0]!.id, minRows: 1 })
    expect(result).toMatchObject({ status: 'hit', rows: [{ date: '2026-09-10', close: 12 }] })
    expect(calls).toBe(1)
  })

  it('returns reauth_required once on 401 and does not retry the same call', async () => {
    let calls = 0
    const { ctx, registered } = await setup({
      openAuthorization: () => {},
      connector: {
        connect: async () => ({
          client: fakeClient({
            call: () => {
              calls += 1
              const error = new Error('HTTP 401')
              error.name = 'UnauthorizedError'
              return error
            },
          }),
          close: async () => {},
        }),
      },
    })
    await ctx.pandaMcp.authenticate()
    const result = await execute(registered, 'mcp__pandadata__call_pandadata', { method: 'get_stock_daily' })
    expect(result).toMatchObject({ ok: false, error: 'reauth_required' })
    expect(calls).toBe(1)
    expect((await ctx.pandaMcp.status()).phase).toBe('needs_auth')
  })

  it('surfaces remote reauth_required without looping', async () => {
    let calls = 0
    const { registered } = await setup({
      openAuthorization: () => {},
      connector: {
        connect: async () => ({
          client: fakeClient({
            call: () => {
              calls += 1
              return { error: 'reauth_required', message: 'login again' }
            },
          }),
          close: async () => {},
        }),
      },
    })
    const result = await execute(registered, 'mcp__pandadata__list_methods')
    expect(result).toMatchObject({ ok: false, error: 'reauth_required' })
    expect(calls).toBe(1)
  })

  it('lets authenticate open OAuth from settings without collecting a password', async () => {
    const opened: string[] = []
    const { ctx } = await setup({
      openAuthorization: (url) => { opened.push(url.href) },
      connector: {
        connect: async ({ openAuthorization }) => {
          await openAuthorization(new URL('https://pandadatamcp.pandaaiquant.com/authorize'))
          return { client: fakeClient({}), close: async () => {} }
        },
      },
    })
    const status = await ctx.pandaMcp.authenticate()
    expect(status.phase).toBe('connected')
    expect(opened).toHaveLength(1)
    await ctx.pandaMcp.logout()
    expect((await ctx.pandaMcp.status()).phase).toBe('disconnected')
  })

  it('re-registers the OAuth client for each loopback callback port', async () => {
    let registeredClient: unknown = 'not-observed'
    const { ctx } = await setup({
      openAuthorization: () => {},
      connector: {
        connect: async ({ store }) => {
          registeredClient = store.current().client
          return { client: fakeClient({}), close: async () => {} }
        },
      },
    })
    const store = (ctx.pandaMcp as unknown as { store: PandaMcpOAuthStore }).store
    await store.saveClient({ client_id: 'stale-loopback-client' })
    expect((await ctx.pandaMcp.authenticate()).phase).toBe('connected')
    expect(registeredClient).toBeUndefined()
  })

  it('lets refresh reconnect from saved tokens without opening a browser', async () => {
    const opened: string[] = []
    const { ctx, dshHome } = await setup({
      openAuthorization: (url) => { opened.push(url.href) },
      connector: {
        connect: async () => ({ client: fakeClient({}), close: async () => {} }),
      },
    })
    const store = new PandaMcpOAuthStore(pandaMcpOAuthPath(dshHome))
    await store.saveTokens({ access_token: 'mcp-access-secret', token_type: 'Bearer' })
    const status = await ctx.pandaMcp.refresh()
    expect(status.phase).toBe('connected')
    expect(opened).toHaveLength(0)
  })

  it('persists OAuth tokens on disk at 0600 and never in status', async () => {
    const dshHome = tempHome()
    const store = new PandaMcpOAuthStore(pandaMcpOAuthPath(dshHome))
    await store.saveTokens({ access_token: 'mcp-access-secret', refresh_token: 'mcp-refresh-secret', token_type: 'Bearer' })
    const reloaded = new PandaMcpOAuthStore(pandaMcpOAuthPath(dshHome))
    await reloaded.load()
    expect(reloaded.hasAccessToken()).toBe(true)
    await reloaded.clear('all')
    await reloaded.load()
    expect(reloaded.hasAccessToken()).toBe(false)
  })

  it('clears the live session on logout', async () => {
    const { ctx } = await setup({
      openAuthorization: () => {},
      connector: {
        connect: async ({ store }) => {
          await store.saveTokens({ access_token: 'mcp-access-secret', token_type: 'Bearer' })
          return { client: fakeClient({}), close: async () => {} }
        },
      },
    })
    expect((await ctx.pandaMcp.authenticate()).phase).toBe('connected')
    expect(JSON.stringify(await ctx.pandaMcp.status())).not.toContain('mcp-access-secret')
    expect((await ctx.pandaMcp.logout()).phase).toBe('disconnected')
  })
})
