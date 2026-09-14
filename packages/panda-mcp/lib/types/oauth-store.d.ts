/** 把 MCP OAuth 客户端信息和 token 写到 DSH home，不进日志或 Remote。 */
import type { OAuthClientInformationMixed, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
/** 磁盘上的 OAuth 快照。 */
export interface PandaMcpOAuthSnapshot {
    readonly client?: OAuthClientInformationMixed;
    readonly tokens?: OAuthTokens;
    readonly codeVerifier?: string;
}
/**
 * 读写 `$DSH_HOME/quantskills/panda-mcp/oauth.json`。
 */
export declare class PandaMcpOAuthStore {
    private readonly filePath;
    private snapshot;
    constructor(filePath: string);
    /** 从磁盘恢复；文件损坏则当作未登录。 */
    load(): Promise<PandaMcpOAuthSnapshot>;
    /** 当前内存快照。 */
    current(): PandaMcpOAuthSnapshot;
    /** 是否已有 access token。 */
    hasAccessToken(): boolean;
    saveClient(client: OAuthClientInformationMixed): Promise<void>;
    saveTokens(tokens: OAuthTokens): Promise<void>;
    saveCodeVerifier(codeVerifier: string): Promise<void>;
    clear(scope?: 'all' | 'client' | 'tokens' | 'verifier'): Promise<void>;
    private persist;
}
/** OAuth 文件相对 DSH home 的路径。 */
export declare function pandaMcpOAuthPath(dshHome: string): string;
//# sourceMappingURL=oauth-store.d.ts.map