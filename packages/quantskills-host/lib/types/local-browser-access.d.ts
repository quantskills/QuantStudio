interface BrowserRequest {
    readonly headers: Headers | Readonly<Record<string, string | readonly string[] | undefined>>;
    readonly method?: string | undefined;
    readonly url?: string | undefined;
    readonly socket?: {
        readonly remoteAddress?: string;
        readonly localAddress?: string;
        readonly localPort?: number;
    };
}
interface BrowserResponse {
    writeHead(status: number, headers?: Readonly<Record<string, string>>): unknown;
    end(body?: string): unknown;
}
/** Public Connection boundary; no dependency on its private credentials or token. */
export interface LocalBrowserConnection {
    requestRejection(request: BrowserRequest): 401 | 403 | undefined;
    authorizeIndex(request: BrowserRequest, response: BrowserResponse): boolean;
    authenticatedUrl(baseUrl: string): string;
}
/** Require the actual transport to be local; forwarded headers cannot grant access. */
export declare function isDirectLocalBrowserRequest(request: BrowserRequest): boolean;
/** Adapt only this Connection instance, retaining DSH's Host/Origin fence and remote authentication. */
export declare function installLocalBrowserAccess(connection: LocalBrowserConnection): () => void;
export {};
//# sourceMappingURL=local-browser-access.d.ts.map