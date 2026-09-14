/** MCP SDK 所需的 OAuthClientProvider：token 只进 OAuthStore。 */
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type { OAuthClientInformationMixed, OAuthClientMetadata, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { PandaMcpOAuthStore } from './oauth-store.ts';
/** 打开授权页的回调。 */
export type OpenAuthorization = (url: URL) => void | Promise<void>;
/**
 * 文件持久化的 MCP OAuth 客户端。
 */
export declare class PandaMcpOAuthProvider implements OAuthClientProvider {
    private readonly store;
    private readonly redirect;
    private readonly openAuthorization;
    constructor(store: PandaMcpOAuthStore, redirect: string, openAuthorization: OpenAuthorization);
    get redirectUrl(): string;
    get clientMetadata(): OAuthClientMetadata;
    clientInformation(): OAuthClientInformationMixed | undefined;
    saveClientInformation(clientInformation: OAuthClientInformationMixed): Promise<void>;
    tokens(): OAuthTokens | undefined;
    saveTokens(tokens: OAuthTokens): Promise<void>;
    redirectToAuthorization(authorizationUrl: URL): Promise<void>;
    saveCodeVerifier(codeVerifier: string): Promise<void>;
    codeVerifier(): Promise<string>;
    invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery'): Promise<void>;
}
//# sourceMappingURL=oauth-provider.d.ts.map