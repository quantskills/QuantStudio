/** MCP SDK 所需的 OAuthClientProvider：token 只进 OAuthStore。 */
import { randomUUID } from 'node:crypto';
/**
 * 文件持久化的 MCP OAuth 客户端。
 */
export class PandaMcpOAuthProvider {
    store;
    redirect;
    openAuthorization;
    oauthState;
    constructor(store, redirect, openAuthorization, oauthState = randomUUID()) {
        this.store = store;
        this.redirect = redirect;
        this.openAuthorization = openAuthorization;
        this.oauthState = oauthState;
    }
    get redirectUrl() {
        return this.redirect;
    }
    get clientMetadata() {
        return {
            client_name: 'QuantSkills',
            redirect_uris: [this.redirect],
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            token_endpoint_auth_method: 'none',
        };
    }
    clientInformation() {
        return this.store.current().client;
    }
    state() { return this.oauthState; }
    async saveClientInformation(clientInformation) {
        await this.store.saveClient(clientInformation);
    }
    tokens() {
        return this.store.current().tokens;
    }
    async saveTokens(tokens) {
        await this.store.saveTokens(tokens);
    }
    async redirectToAuthorization(authorizationUrl) {
        await this.openAuthorization(authorizationUrl);
    }
    async saveCodeVerifier(codeVerifier) {
        await this.store.saveCodeVerifier(codeVerifier);
    }
    async codeVerifier() {
        const verifier = this.store.current().codeVerifier;
        if (verifier === undefined || verifier.length === 0)
            throw new Error('PandaData MCP 缺少 PKCE verifier。');
        return verifier;
    }
    async invalidateCredentials(scope) {
        if (scope === 'discovery')
            return;
        await this.store.clear(scope);
    }
}
//# sourceMappingURL=oauth-provider.js.map