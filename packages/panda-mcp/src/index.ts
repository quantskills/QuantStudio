/** QuantSkills Host：直连公网 PandaData MCP，OAuth 登录后把工具挂到 ctx.tools。 */

import { join } from 'node:path'
import { LocalDatabase, type DataImport, type DataFetch, type DataQuery, type DataSummary, type DataResult, type DataCategory } from './database.ts'
export type { DataImport, DataFetch, DataQuery, DataSummary, DataResult, DataSource, DataCategory } from './database.ts'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-tools'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { openSystemBrowser } from './browser.ts'
import { startOauthLoopback, type PandaMcpLoopback } from './callback-server.ts'
import { PandaMcpOAuthProvider } from './oauth-provider.ts'
import { PandaMcpOAuthStore, pandaMcpOAuthPath } from './oauth-store.ts'
import { publicToolName } from './public-name.ts'
import {
  callConnectedTool,
  disposeTools,
  registerStubTools,
  syncLiveTools,
  type ConnectedMcpSession,
  type ToolDisposers,
} from './tools.ts'
import {
  DEFAULT_PANDA_MCP_URL,
  PANDA_MCP_TOOL_NAMES,
  type PandaMcpPhase,
  type PandaMcpStatus,
} from './types.ts'

export type * from './types.ts'
export { DEFAULT_PANDA_MCP_URL, PANDA_MCP_TOOL_NAMES } from './types.ts'
export { publicToolName } from './public-name.ts'
export { reauthRequired } from './tools.ts'
export { PandaMcpOAuthStore, pandaMcpOAuthPath } from './oauth-store.ts'
export { startOauthLoopback } from './callback-server.ts'

/** Cordis 插件名。 */
export const name = 'panda-mcp'
/** 工具注册与系统提示所依赖的服务。 */
export const inject = ['tools', 'agents', 'systemPrompt']

const POLICY = `PandaData market data is available through remote MCP tools named mcp__pandadata__*.

Before fetching data, use quantskills_data_catalog to find locally cached datasets, then quantskills_data_query with the required date range and minRows. It refreshes stale or insufficient remote data once. Only use rows when status is hit or refreshed; insufficient is NOT usable data. Imported local files need re-import when insufficient. The database contains only user-configured sources. Never substitute a different vendor silently. PandaData table results are automatically cached for five minutes.

Workflow: mcp__pandadata__auth_status → mcp__pandadata__search_methods → mcp__pandadata__get_method_doc → mcp__pandadata__call_pandadata.
Read the method document before calling. Only documented get_* methods are allowed.

If a tool is missing, returns reauth_required, or fails with HTTP 401, stop and ask the user to open QuantSkills Settings → PandaData and click Login. Never ask for a password. Never retry login in a loop. Never switch to AkShare, Yahoo, Tushare, or any other data vendor unless the user explicitly names that vendor for the current task only.`

/** 可测试的 MCP 会话工厂。 */
export interface PandaMcpSessionConnector {
  connect(args: {
    url: string
    store: PandaMcpOAuthStore
    redirectUrl: string
    openAuthorization: (url: URL) => void | Promise<void>
    signal?: AbortSignal
  }): Promise<{ client: Client; close: () => Promise<void> }>
}

/** Loader 配置。 */
export interface Config {
  readonly url?: string
  readonly serverName?: string
  readonly dshHome?: string
  readonly toolCallTimeoutMs?: number
  readonly authTimeoutMs?: number
  readonly publicOrigin?: string
  readonly callbackPort?: number
}

/** Loader schema。 */
export const Config: z<Config> = z.object({
  url: z.string().default(DEFAULT_PANDA_MCP_URL),
  serverName: z.string().default('pandadata'),
  dshHome: z.string().default(''),
  toolCallTimeoutMs: z.number().default(60_000),
  authTimeoutMs: z.number().default(300_000),
  publicOrigin: z.string().default(''),
  callbackPort: z.number().default(3197),
})

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** 公网 PandaData MCP 客户端。 */
    pandaMcp: PandaMcpGateway
  }
}

function authErrorHint(error: unknown): string {
  if (!(error instanceof Error) || error.message.trim().length === 0) return ''
  return `（${error.message.replace(/\s+/g, ' ').slice(0, 160)}）`
}

function validateHttpUrl(value: string): string {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('panda-mcp: url 必须是 HTTPS 地址')
  }
  if (parsed.protocol !== 'https:' || parsed.username !== '' || parsed.password !== '' || parsed.hash !== '') {
    throw new Error('panda-mcp: url 必须是不含凭据的 HTTPS 地址')
  }
  return parsed.href
}

function createPandaMcpTransport(url: string, provider: PandaMcpOAuthProvider): StreamableHTTPClientTransport {
  return new StreamableHTTPClientTransport(new URL(url), { authProvider: provider })
}

function createPandaMcpClient(): Client {
  return new Client({ name: 'quantskills', version: '0.1.31' })
}

/** 默认：MCP SDK Streamable HTTP + OAuth。 */
export async function connectPublicPandaMcp(args: {
  url: string
  store: PandaMcpOAuthStore
  redirectUrl: string
  openAuthorization: (url: URL) => void | Promise<void>
  waitForCode: (signal?: AbortSignal) => Promise<string>
  signal?: AbortSignal
  state?: string
}): Promise<{ client: Client; close: () => Promise<void> }> {
  const provider = new PandaMcpOAuthProvider(args.store, args.redirectUrl, args.openAuthorization, args.state)
  const firstTransport = createPandaMcpTransport(args.url, provider)
  const firstClient = createPandaMcpClient()
  try {
    await firstClient.connect(firstTransport as never)
    return {
      client: firstClient,
      close: async () => {
        await firstClient.close()
      },
    }
  } catch (error) {
    if (!(error instanceof UnauthorizedError)) throw error
  }
  const code = await args.waitForCode(args.signal)
  await firstTransport.finishAuth(code)
  try {
    await firstClient.close()
  } catch {
    // SDK 在 initialize 失败时已经 void close()，这里只是避免泄漏。
  }
  // 第一次 connect 已经 start() 过 transport，且 Client.close 是 fire-and-forget。
  // 必须换新 Client + 新 Transport，否则会 Already connected / already started。
  const transport = createPandaMcpTransport(args.url, provider)
  const client = createPandaMcpClient()
  await client.connect(transport as never)
  return {
    client,
    close: async () => {
      await client.close()
    },
  }
}

/** 公网 PandaData MCP 网关。 */
export class PandaMcpGateway extends TypertRemoteService {
  static inject = inject
  static Config = Config

  private readonly url: string
  private readonly serverName: string
  private readonly authTimeoutMs: number
  private readonly toolCallTimeoutMs: number
  private readonly database: LocalDatabase
  private readonly store: PandaMcpOAuthStore
  private readonly promptDisposers = new Map<Agent, () => void>()
  private tools: ToolDisposers = new Map()
  private phase: PandaMcpPhase = 'disconnected'
  private message = '尚未登录 PandaData。'
  private live: ConnectedMcpSession | undefined
  private closeLive: (() => Promise<void>) | undefined
  private authTail: Promise<PandaMcpStatus> | undefined
  private readonly publicOrigin: string | undefined
  private readonly callbackPort: number
  private authorizationUrl: string | undefined
  private authorizationReady: Promise<void> | undefined
  private resolveAuthorization: (() => void) | undefined
  private authController: AbortController | undefined
  private connector: PandaMcpSessionConnector | undefined
  private openAuthorization: (url: URL) => void | Promise<void> = (url) => openSystemBrowser(url.href)

  constructor(ctx: Context, config: Config) {
    super(ctx, 'pandaMcp')
    this.url = validateHttpUrl(config.url ?? DEFAULT_PANDA_MCP_URL)
    const origin = config.publicOrigin?.trim() || process.env.QUANTSKILLS_PUBLIC_URL?.trim()
    if (origin) {
      const parsed = new URL(validateHttpUrl(origin))
      if (parsed.pathname !== '/' || parsed.search) throw new Error('PandaData publicOrigin 必须是 HTTPS 站点来源。')
      this.publicOrigin = parsed.origin
    }
    this.callbackPort = config.callbackPort ?? 3197
    if (!Number.isInteger(this.callbackPort) || this.callbackPort < 0 || this.callbackPort > 65535) throw new Error('PandaData callbackPort 无效。')
    this.serverName = config.serverName ?? 'pandadata'
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(this.serverName)) {
      throw new Error('panda-mcp: serverName 必须匹配 [A-Za-z0-9_-]{1,32}')
    }
    this.authTimeoutMs = config.authTimeoutMs ?? 300_000
    this.toolCallTimeoutMs = config.toolCallTimeoutMs ?? 60_000
    const specifiedHome = config.dshHome?.trim()
    this.store = new PandaMcpOAuthStore(pandaMcpOAuthPath(resolveDshHome(
      specifiedHome === undefined || specifiedHome.length === 0 ? undefined : specifiedHome,
    )))
    this.database = new LocalDatabase(join(resolveDshHome(specifiedHome || undefined), 'quantskills', 'database'), async (method, params, signal) => {
      if (!this.live) await this.refresh(signal)
      if (!this.live) throw new Error('请先在设置中连接 PandaData')
      return callConnectedTool(this.live, 'call_pandadata', { method, params }, signal, async () => { this.phase = 'needs_auth'; await this.store.clear('tokens'); this.replaceWithStubs() })
    })
    this.installDatabaseTools()
    this.installPrompts()
    this.tools = this.mountStubs()
    ctx.effect(() => async () => {
      this.authController?.abort()
      await this.authTail
      this.disposePrompts()
      disposeTools(this.tools)
      await this.closeLive?.()
    }, 'panda-mcp.lifecycle')
    void this.restoreExistingTokens()
  }

  @Remote
  databaseList(signal?: AbortSignal): Promise<DataSummary[]> { void signal; return this.database.list() }
  @Remote
  databaseImport(input: DataImport, signal?: AbortSignal): Promise<DataSummary> { void signal; return this.database.import(input) }
  @Remote
  databaseFetch(input: DataFetch, signal?: AbortSignal): Promise<DataSummary> { return this.database.fetch(input, signal) }
  @Remote
  databaseQuery(input: DataQuery, signal?: AbortSignal): Promise<DataResult> { return this.database.query(input, signal) }
  @Remote
  databasePreview(input: { id: string }, signal?: AbortSignal): Promise<DataResult> { void signal; return this.database.preview(input.id) }
  @Remote
  databaseRefresh(input: { id: string }, signal?: AbortSignal): Promise<DataSummary> { return this.database.preview(input.id).then(({ dataset }) => this.database.fetch(dataset, signal, dataset.id)) }
  @Remote
  databaseRemove(input: { id: string }, signal?: AbortSignal): Promise<void> { void signal; return this.database.remove(input.id) }
  @Remote
  databaseCategorize(input: { id: string; category: DataCategory }, signal?: AbortSignal): Promise<DataSummary> { void signal; return this.database.categorize(input.id, input.category) }

  private installDatabaseTools(): void {
    const register = <Args,>(name: string, description: string, properties: Record<string, unknown>, required: string[], execute: (args: Args, signal?: AbortSignal) => Promise<unknown>) => {
      this.ctx.effect(() => this.ctx.tools.register({ name, description, parameters: { type: 'object', properties, required, additionalProperties: false }, output: { schema: { type: 'object', additionalProperties: true }, render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value) }] }, execute: (args: unknown, exec: { signal?: AbortSignal }) => execute(args as Args, exec.signal) } as never), name)
    }
    register('quantskills_data_catalog', 'List local cached datasets by research category (market: quotes/prices; news: news/announcements; fundamental: company financials/valuation; other), source, date coverage, row count and expiry. Category is independent of whether data has dates. Always check before fetching external data.', {}, [], () => this.database.list().then(datasets => ({ datasets })))
    register('quantskills_data_query', 'Read local data first. Refresh remote source once when stale or insufficient. Only consume rows if status is hit/refreshed. Do not use insufficient results; ask for source parameters or new import.', { id: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' }, minRows: { type: 'integer', minimum: 1 }, limit: { type: 'integer', minimum: 1, maximum: 5000 }, offset: { type: 'integer', minimum: 0 }, refresh: { type: 'boolean' } }, ['id'], (args: DataQuery, signal) => this.database.query(args, signal))
  }

  /** 测试替换会话工厂。 */
  useConnector(connector: PandaMcpSessionConnector): void {
    this.connector = connector
  }

  /** 测试替换打开浏览器。 */
  useOpenAuthorization(openAuthorization: (url: URL) => void | Promise<void>): void {
    this.openAuthorization = openAuthorization
  }

  @Remote
  status(signal?: AbortSignal): Promise<PandaMcpStatus> {
    void signal
    return Promise.resolve(this.snapshot())
  }

  @Remote
  authenticate(signal?: AbortSignal): Promise<PandaMcpStatus> {
    const completion = this.ensureAuthenticated(this.publicOrigin ? undefined : signal)
    return this.publicOrigin && this.authorizationReady
      ? Promise.race([completion, this.authorizationReady.then(() => this.snapshot())])
      : completion
  }

  /** 用已保存 token 静默重连；没有 token 时只返回当前状态，不打开浏览器。 */
  @Remote
  async refresh(signal?: AbortSignal): Promise<PandaMcpStatus> {
    if (this.phase === 'connected' && this.live !== undefined) return this.snapshot()
    await this.store.load()
    if (!this.store.hasAccessToken()) return this.snapshot()
    try {
      await this.connectLive({
        interactive: false,
        ...signal === undefined ? {} : { signal },
      })
    } catch {
      this.phase = 'needs_auth'
      this.message = '已保存的 PandaData 登录已失效，请重新登录。'
      this.replaceWithStubs()
    }
    return this.snapshot()
  }

  @Remote
  async logout(signal?: AbortSignal): Promise<PandaMcpStatus> {
    void signal
    this.authController?.abort()
    await this.authTail
    await this.dropLive()
    await this.store.clear('all')
    this.phase = 'disconnected'
    this.message = '已退出 PandaData 登录。'
    this.replaceWithStubs()
    return this.snapshot()
  }

  private snapshot(): PandaMcpStatus {
    return {
      ok: true,
      phase: this.phase,
      url: this.url,
      toolCount: this.tools.size,
      toolNames: [...this.tools.keys()],
      message: this.message,
      ...(this.phase === 'authenticating' && this.authorizationUrl ? { authorizationUrl: this.authorizationUrl } : {}),
    }
  }

  private async restoreExistingTokens(): Promise<void> {
    await this.store.load()
    if (!this.store.hasAccessToken()) return
    try {
      await this.connectLive({ interactive: false })
    } catch {
      this.phase = 'needs_auth'
      this.message = '已保存的 PandaData 登录已失效，请重新登录。'
      this.replaceWithStubs()
    }
  }

  async ensureAuthenticated(signal?: AbortSignal): Promise<PandaMcpStatus> {
    if (this.phase === 'connected' && this.live !== undefined) return this.snapshot()
    if (this.authTail !== undefined) return this.authTail
    this.authTail = this.runAuthentication(signal).finally(() => {
      this.authTail = undefined
    })
    return this.authTail
  }

  private async runAuthentication(signal?: AbortSignal): Promise<PandaMcpStatus> {
    this.authorizationUrl = undefined
    this.authorizationReady = new Promise(resolve => { this.resolveAuthorization = resolve })
    if (this.store.hasAccessToken()) {
      try {
        await this.connectLive({
          interactive: false,
          ...signal === undefined ? {} : { signal },
        })
        return this.snapshot()
      } catch {
        this.phase = 'needs_auth'
      }
    }
    this.phase = 'authenticating'
    this.message = '正在打开 PandaData 登录页。'
    const controller = new AbortController()
    this.authController = controller
    const timeout = setTimeout(() => { controller.abort() }, this.authTimeoutMs)
    const onAbort = (): void => { controller.abort() }
    signal?.addEventListener('abort', onAbort, { once: true })
    let loopback: PandaMcpLoopback | undefined
    try {
      loopback = await startOauthLoopback(this.publicOrigin ? { publicOrigin: this.publicOrigin, port: this.callbackPort } : {})
      // Dynamic registration binds the client to this loopback port.
      await this.store.clear('client')
      await this.connectLive({
        interactive: true,
        redirectUrl: loopback.redirectUrl,
        waitForCode: () => loopback!.waitForCode(controller.signal),
        state: loopback.state,
        signal: controller.signal,
      })
      return this.snapshot()
    } catch (error) {
      this.phase = error instanceof UnauthorizedError || controller.signal.aborted ? 'needs_auth' : 'error'
      this.message = controller.signal.aborted
        ? 'PandaData 登录已取消或超时。'
        : `PandaData 登录失败，请重试。${authErrorHint(error)}`
      this.replaceWithStubs()
      return this.snapshot()
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', onAbort)
      this.authorizationUrl = undefined
      this.authController = undefined
      await loopback?.close()
    }
  }

  private async connectLive(options?: {
    interactive?: boolean
    redirectUrl?: string
    waitForCode?: (signal?: AbortSignal) => Promise<string>
    signal?: AbortSignal
    state?: string
  }): Promise<void> {
    await this.dropLive()
    const interactive = options?.interactive === true
    const redirectUrl = options?.redirectUrl ?? 'http://127.0.0.1/callback'
    const waitForCode = options?.waitForCode ?? (async () => {
      throw new UnauthorizedError('PandaData 登录需要浏览器授权。')
    })
    const openAuthorization = interactive
      ? (url: URL) => {
        if (!this.publicOrigin) return this.openAuthorization(url)
        this.authorizationUrl = url.href
        this.message = '请在浏览器中完成 PandaData 授权。'
        this.resolveAuthorization?.()
      }
      : () => { throw new UnauthorizedError('PandaData 需要重新登录。') }
    const session = this.connector === undefined
      ? await connectPublicPandaMcp({
        url: this.url,
        store: this.store,
        redirectUrl,
        openAuthorization,
        waitForCode,
        ...(options?.state === undefined ? {} : { state: options.state }),
        ...options?.signal === undefined ? {} : { signal: options.signal },
      })
      : await this.connector.connect({
        url: this.url,
        store: this.store,
        redirectUrl,
        openAuthorization,
        ...options?.signal === undefined ? {} : { signal: options.signal },
      })
    this.live = { client: session.client, toolCallTimeoutMs: this.toolCallTimeoutMs }
    this.closeLive = session.close
    const liveTools = await syncLiveTools(
      this.ctx,
      this.live,
      this.serverName,
      this.tools,
      async () => {
        this.phase = 'needs_auth'
        this.message = 'PandaData 登录已过期，请重新登录。'
        await this.store.clear('tokens')
        this.replaceWithStubs()
      },
      (rawName, args, call) => rawName === 'call_pandadata' ? this.database.cachedPanda(args, call) : call(),
    )
    this.tools = liveTools
    this.phase = 'connected'
    this.message = '已连接 PandaData MCP。'
  }

  private async dropLive(): Promise<void> {
    const close = this.closeLive
    this.closeLive = undefined
    this.live = undefined
    if (close !== undefined) await close()
  }

  private mountStubs(): ToolDisposers {
    return registerStubTools(
      this.ctx,
      this.serverName,
      () => this.snapshot(),
      (signal) => this.ensureAuthenticated(signal),
      async (rawName, args, signal) => {
        if (this.live === undefined) return { ok: false, error: 'reauth_required', message: '尚未登录 PandaData。' }
        const call = () => callConnectedTool(this.live!, rawName, args, signal, async () => {
          this.phase = 'needs_auth'
          this.message = 'PandaData 登录已过期，请重新登录。'
          await this.store.clear('tokens')
          this.replaceWithStubs()
        })
        return rawName === 'call_pandadata' ? this.database.cachedPanda(args, call) : call()
      },
    )
  }

  private replaceWithStubs(): void {
    disposeTools(this.tools)
    this.tools = this.mountStubs()
  }

  private installPrompts(): void {
    const maybeInstall = (agent: Agent): void => {
      if (this.promptDisposers.has(agent)) return
      this.promptDisposers.set(agent, agent.ctx.systemPrompt.section({
        name: 'panda-mcp:policy',
        order: 70,
        text: () => POLICY.replaceAll('mcp__pandadata__', `mcp__${this.serverName}__`),
      }))
    }
    for (const agent of this.ctx.agents.list()) maybeInstall(agent)
    this.ctx.on('agent/created', ({ agent }) => { maybeInstall(agent) })
    this.ctx.on('agent/disposed', ({ agent }) => {
      this.promptDisposers.get(agent)?.()
      this.promptDisposers.delete(agent)
    })
  }

  private disposePrompts(): void {
    for (const dispose of this.promptDisposers.values()) dispose()
    this.promptDisposers.clear()
  }
}

export default PandaMcpGateway

/** 测试辅助：默认公开工具名。 */
export function pandaMcpPublicNames(serverName = 'pandadata'): string[] {
  return PANDA_MCP_TOOL_NAMES.map(rawName => publicToolName(serverName, rawName))
}
