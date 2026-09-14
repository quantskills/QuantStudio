/** 给 UI 和 Remote 用的 PandaData MCP 连接状态；永不包含 token。 @module @deepseek-ai/dsh-panda-mcp/types */

/** Host 持有的连接阶段。 */
export type PandaMcpPhase = 'disconnected' | 'authenticating' | 'connected' | 'needs_auth' | 'error'

/** 可安全展示的远端 MCP 状态。 */
export interface PandaMcpStatus {
  readonly ok: true
  readonly phase: PandaMcpPhase
  readonly url: string
  readonly toolCount: number
  readonly toolNames: readonly string[]
  readonly message: string
}

/** 未登录或网关要求重新授权时返回给模型的固定错误。 */
export interface PandaMcpReauthRequired {
  readonly ok: false
  readonly error: 'reauth_required'
  readonly message: string
}

/** 公网 PandaData MCP 默认地址。 */
export const DEFAULT_PANDA_MCP_URL = 'https://pandadatamcp.pandaaiquant.com/mcp'

/** 模型可见工具的远端原始名称。 */
export const PANDA_MCP_TOOL_NAMES = [
  'auth_status',
  'sdk_status',
  'list_methods',
  'search_methods',
  'get_method_doc',
  'call_pandadata',
] as const

export type PandaMcpToolName = (typeof PANDA_MCP_TOOL_NAMES)[number]

export type { DataSummary, DataImport, DataFetch, DataQuery, DataResult, DataSource, DataCategory } from './database.ts'
