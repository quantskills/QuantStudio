/** 把 MCP OAuth 客户端信息和 token 写到 DSH home，不进日志或 Remote。 */

import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { OAuthClientInformationMixed, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js'

/** 磁盘上的 OAuth 快照。 */
export interface PandaMcpOAuthSnapshot {
  readonly client?: OAuthClientInformationMixed
  readonly tokens?: OAuthTokens
  readonly codeVerifier?: string
}

/**
 * 读写 `$DSH_HOME/quantskills/panda-mcp/oauth.json`。
 */
export class PandaMcpOAuthStore {
  private snapshot: PandaMcpOAuthSnapshot = {}

  constructor(private readonly filePath: string) {}

  /** 从磁盘恢复；文件损坏则当作未登录。 */
  async load(): Promise<PandaMcpOAuthSnapshot> {
    try {
      const raw = JSON.parse(await readFile(this.filePath, 'utf8')) as PandaMcpOAuthSnapshot
      this.snapshot = {
        ...raw.client === undefined ? {} : { client: raw.client },
        ...raw.tokens === undefined ? {} : { tokens: raw.tokens },
        ...raw.codeVerifier === undefined ? {} : { codeVerifier: raw.codeVerifier },
      }
    } catch {
      this.snapshot = {}
    }
    return this.snapshot
  }

  /** 当前内存快照。 */
  current(): PandaMcpOAuthSnapshot {
    return this.snapshot
  }

  /** 是否已有 access token。 */
  hasAccessToken(): boolean {
    const token = this.snapshot.tokens?.access_token
    return typeof token === 'string' && token.length > 0
  }

  async saveClient(client: OAuthClientInformationMixed): Promise<void> {
    this.snapshot = { ...this.snapshot, client }
    await this.persist()
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    this.snapshot = { ...this.snapshot, tokens }
    await this.persist()
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    this.snapshot = { ...this.snapshot, codeVerifier }
    await this.persist()
  }

  async clear(scope: 'all' | 'client' | 'tokens' | 'verifier' = 'all'): Promise<void> {
    if (scope === 'all') {
      this.snapshot = {}
      await rm(this.filePath, { force: true })
      return
    }
    const next = { ...this.snapshot }
    if (scope === 'client') delete next.client
    if (scope === 'tokens') delete next.tokens
    if (scope === 'verifier') delete next.codeVerifier
    this.snapshot = next
    if (next.client === undefined && next.tokens === undefined && next.codeVerifier === undefined) {
      await rm(this.filePath, { force: true })
      return
    }
    await this.persist()
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(this.snapshot), { encoding: 'utf8', mode: 0o600 })
    await chmod(this.filePath, 0o600)
  }
}

/** OAuth 文件相对 DSH home 的路径。 */
export function pandaMcpOAuthPath(dshHome: string): string {
  return join(dshHome, 'quantskills', 'panda-mcp', 'oauth.json')
}
