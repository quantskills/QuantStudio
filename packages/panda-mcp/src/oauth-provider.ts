/** MCP SDK 所需的 OAuthClientProvider：token 只进 OAuthStore。 */

import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js'
import type { PandaMcpOAuthStore } from './oauth-store.ts'

/** 打开授权页的回调。 */
export type OpenAuthorization = (url: URL) => void | Promise<void>

/**
 * 文件持久化的 MCP OAuth 客户端。
 */
export class PandaMcpOAuthProvider implements OAuthClientProvider {
  constructor(
    private readonly store: PandaMcpOAuthStore,
    private readonly redirect: string,
    private readonly openAuthorization: OpenAuthorization,
  ) {}

  get redirectUrl(): string {
    return this.redirect
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: 'QuantSkills DSH',
      redirect_uris: [this.redirect],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }
  }

  clientInformation(): OAuthClientInformationMixed | undefined {
    return this.store.current().client
  }

  async saveClientInformation(clientInformation: OAuthClientInformationMixed): Promise<void> {
    await this.store.saveClient(clientInformation)
  }

  tokens(): OAuthTokens | undefined {
    return this.store.current().tokens
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    await this.store.saveTokens(tokens)
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    await this.openAuthorization(authorizationUrl)
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    await this.store.saveCodeVerifier(codeVerifier)
  }

  async codeVerifier(): Promise<string> {
    const verifier = this.store.current().codeVerifier
    if (verifier === undefined || verifier.length === 0) throw new Error('PandaData MCP 缺少 PKCE verifier。')
    return verifier
  }

  async invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery'): Promise<void> {
    if (scope === 'discovery') return
    await this.store.clear(scope)
  }
}
