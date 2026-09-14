/** 把远端 MCP 工具注册到 ctx.tools；未登录时挂本地桩。 */

import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { ListToolsResultSchema } from '@modelcontextprotocol/sdk/types.js'
import type { Context } from '@deepseek-ai/cordis'
import { z as zod } from 'zod'
import type {} from '@deepseek-ai/dsh-tools'
import { publicToolName } from './public-name.ts'
import {
  PANDA_MCP_TOOL_NAMES,
  type PandaMcpReauthRequired,
  type PandaMcpStatus,
  type PandaMcpToolName,
} from './types.ts'

const RawCallToolResultSchema = zod.record(zod.string(), zod.unknown())

/** 一次工具世代的注销函数。 */
export type ToolDisposers = Map<string, () => void>

/** 调用已连接 MCP 会话。 */
export interface ConnectedMcpSession {
  readonly client: Client
  readonly toolCallTimeoutMs: number
}

const STUB_DESCRIPTIONS: Record<PandaMcpToolName, string> = {
  auth_status: 'Report PandaData MCP OAuth session status. Does not open a login page.',
  sdk_status: 'Report public PandaData MCP service status.',
  list_methods: 'List documented PandaData get_* methods. Requires PandaData login.',
  search_methods: 'Search documented PandaData methods. Requires PandaData login.',
  get_method_doc: 'Return documentation for one PandaData method. Requires PandaData login.',
  call_pandadata: 'Call a documented PandaData get_* method. Requires PandaData login.',
}

/**
 * 未登录时给模型看的固定错误。
 */
export function reauthRequired(message = '请在 QuantSkills 设置的 PandaData 分区登录，不要向模型发送密码。'): PandaMcpReauthRequired {
  return { ok: false, error: 'reauth_required', message }
}

function stubParameters(name: PandaMcpToolName): Record<string, unknown> {
  if (name === 'search_methods') {
    return {
      type: 'object',
      additionalProperties: false,
      required: ['query'],
      properties: {
        query: { type: 'string' },
        limit: { type: 'integer' },
      },
    }
  }
  if (name === 'get_method_doc') {
    return {
      type: 'object',
      additionalProperties: false,
      required: ['method'],
      properties: {
        method: { type: 'string' },
        include_example: { type: 'boolean' },
        max_chars: { type: 'integer' },
      },
    }
  }
  if (name === 'call_pandadata') {
    return {
      type: 'object',
      additionalProperties: false,
      required: ['method'],
      properties: {
        method: { type: 'string' },
        params: { type: 'object' },
        params_json: { type: 'string' },
      },
    }
  }
  if (name === 'list_methods') {
    return {
      type: 'object',
      additionalProperties: false,
      properties: {
        category: { type: 'string' },
        section: { type: 'string' },
        limit: { type: 'integer' },
        offset: { type: 'integer' },
      },
    }
  }
  if (name === 'sdk_status') {
    return {
      type: 'object',
      additionalProperties: false,
      properties: { import_sdk: { type: 'boolean' } },
    }
  }
  return { type: 'object', additionalProperties: false, properties: {} }
}

/**
 * 注册未登录桩工具。数据类工具会触发 ensureAuthenticated。
 */
export function registerStubTools(
  ctx: Context,
  serverName: string,
  status: () => PandaMcpStatus,
  ensureAuthenticated: (signal?: AbortSignal) => Promise<PandaMcpStatus>,
  callWhenConnected: (rawName: string, args: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>,
): ToolDisposers {
  const disposers: ToolDisposers = new Map()
  for (const rawName of PANDA_MCP_TOOL_NAMES) {
    const publicName = publicToolName(serverName, rawName)
    const dispose = ctx.tools.register({
      name: publicName,
      description: STUB_DESCRIPTIONS[rawName],
      parameters: stubParameters(rawName),
      output: {
        schema: { type: 'object', additionalProperties: true },
        render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value) }],
      },
      async execute(args: unknown, exec: { signal?: AbortSignal }) {
        if (rawName === 'auth_status') return status()
        const next = await ensureAuthenticated(exec.signal)
        if (next.phase !== 'connected') return reauthRequired()
        const payload = typeof args === 'object' && args !== null ? args as Record<string, unknown> : {}
        return callWhenConnected(rawName, payload, exec.signal)
      },
    } as never)
    disposers.set(publicName, dispose)
  }
  return disposers
}

/**
 * 从已连接 Client 同步远端工具列表。
 */
export async function syncLiveTools(
  ctx: Context,
  session: ConnectedMcpSession,
  serverName: string,
  previous: ToolDisposers,
  onUnauthorized: () => Promise<void>,
  aroundCall?: (rawName: string, args: Record<string, unknown>, call: () => Promise<unknown>) => Promise<unknown>,
): Promise<ToolDisposers> {
  const definitions = new Map<string, unknown>()
  let cursor: string | undefined
  do {
    const response = await session.client.request({
      method: 'tools/list',
      ...cursor === undefined ? {} : { params: { cursor } },
    }, ListToolsResultSchema)
    for (const tool of response.tools) {
      const publicName = publicToolName(serverName, tool.name)
      if (definitions.has(publicName)) {
        throw new Error(`panda-mcp(${serverName}): 远端重复列出工具 ${tool.name}`)
      }
      definitions.set(publicName, tool)
    }
    cursor = response.nextCursor
  } while (cursor !== undefined)

  for (const dispose of previous.values()) dispose()
  const disposers: ToolDisposers = new Map()
  try {
    for (const [publicName, tool] of definitions) {
      const rawName = (tool as { name: string }).name
      const description = (tool as { description?: string }).description ?? ''
      const parameters = (tool as { inputSchema?: Record<string, unknown> }).inputSchema ?? {
        type: 'object',
        additionalProperties: true,
      }
      disposers.set(publicName, ctx.tools.register({
        name: publicName,
        description,
        parameters,
        output: {
          schema: { type: 'object', additionalProperties: true },
          render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value) }],
        },
        async execute(args: unknown, exec: { signal?: AbortSignal }) {
          const call = () => callLiveTool(session, rawName, args, exec.signal, onUnauthorized)
          return aroundCall ? aroundCall(rawName, (args ?? {}) as Record<string, unknown>, call) : call()
        },
      } as never))
    }
  } catch (error) {
    for (const dispose of disposers.values()) dispose()
    throw error
  }
  return disposers
}

/** 注销一整代工具。 */
export function disposeTools(disposers: ToolDisposers): void {
  for (const dispose of disposers.values()) dispose()
  disposers.clear()
}

async function callLiveTool(
  session: ConnectedMcpSession,
  rawName: string,
  args: unknown,
  signal: AbortSignal | undefined,
  onUnauthorized: () => Promise<void>,
): Promise<unknown> {
  try {
    const result = await session.client.request({
      method: 'tools/call',
      params: {
        name: rawName,
        arguments: typeof args === 'object' && args !== null ? args : {},
      },
    }, RawCallToolResultSchema, {
      ...signal === undefined ? {} : { signal },
      timeout: session.toolCallTimeoutMs,
    })
    return mapCallResult(result)
  } catch (error) {
    if (isUnauthorized(error)) {
      await onUnauthorized()
      return reauthRequired()
    }
    throw error
  }
}

function mapCallResult(result: Record<string, unknown>): unknown {
  if (result.isError === true) {
    const text = extractText(result.content)
    throw new Error(text.length === 0 ? 'PandaData MCP 工具返回错误。' : text)
  }
  if (looksLikeReauth(result)) return reauthRequired(String(result.message ?? '需要重新登录 PandaData。'))
  if (Array.isArray(result.content)) {
    const structured = result.structuredContent
    if (looksLikeReauth(structured)) return reauthRequired(String((structured as { message?: string }).message ?? '需要重新登录 PandaData。'))
    if (structured !== undefined) return structured
    const text = extractText(result.content)
    if (text.length === 0) return result
    try {
      const parsed = JSON.parse(text) as unknown
      if (looksLikeReauth(parsed)) {
        return reauthRequired(String((parsed as { message?: string }).message ?? '需要重新登录 PandaData。'))
      }
      return parsed
    } catch {
      return { content: result.content }
    }
  }
  return result
}

function extractText(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .map((block) => {
      if (typeof block === 'object' && block !== null && 'text' in block && typeof block.text === 'string') {
        return block.text
      }
      return ''
    })
    .filter(part => part.length > 0)
    .join('\n')
}

function looksLikeReauth(value: unknown): boolean {
  return typeof value === 'object' && value !== null && (value as { error?: unknown }).error === 'reauth_required'
}

function isUnauthorized(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const name = (error as { name?: string }).name
  const message = String((error as { message?: string }).message ?? '')
  return name === 'UnauthorizedError' || message.includes('401') || /unauthorized/i.test(message)
}

/** 供已连接会话直接调用远端工具（桩工具登录成功后转发）。 */
export async function callConnectedTool(
  session: ConnectedMcpSession,
  rawName: string,
  args: Record<string, unknown>,
  signal: AbortSignal | undefined,
  onUnauthorized: () => Promise<void>,
): Promise<unknown> {
  return callLiveTool(session, rawName, args, signal, onUnauthorized)
}
