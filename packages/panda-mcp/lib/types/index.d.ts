/** QuantSkills Host：直连公网 PandaData MCP，OAuth 登录后把工具挂到 ctx.tools。 */
import { type DataImport, type DataFetch, type DataQuery, type DataSummary, type DataResult, type DataCategory } from './database.ts';
export type { DataImport, DataFetch, DataQuery, DataSummary, DataResult, DataSource, DataCategory } from './database.ts';
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { PandaMcpOAuthStore } from './oauth-store.ts';
import { type PandaMcpStatus } from './types.ts';
export type * from './types.ts';
export { DEFAULT_PANDA_MCP_URL, PANDA_MCP_TOOL_NAMES } from './types.ts';
export { publicToolName } from './public-name.ts';
export { reauthRequired } from './tools.ts';
export { PandaMcpOAuthStore, pandaMcpOAuthPath } from './oauth-store.ts';
export { startOauthLoopback } from './callback-server.ts';
/** Cordis 插件名。 */
export declare const name = "panda-mcp";
/** 工具注册与系统提示所依赖的服务。 */
export declare const inject: string[];
/** 可测试的 MCP 会话工厂。 */
export interface PandaMcpSessionConnector {
    connect(args: {
        url: string;
        store: PandaMcpOAuthStore;
        redirectUrl: string;
        openAuthorization: (url: URL) => void | Promise<void>;
        signal?: AbortSignal;
    }): Promise<{
        client: Client;
        close: () => Promise<void>;
    }>;
}
/** Loader 配置。 */
export interface Config {
    readonly url?: string;
    readonly serverName?: string;
    readonly dshHome?: string;
    readonly toolCallTimeoutMs?: number;
    readonly authTimeoutMs?: number;
    readonly publicOrigin?: string;
    readonly callbackPort?: number;
}
/** Loader schema。 */
export declare const Config: z<Config>;
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** 公网 PandaData MCP 客户端。 */
        pandaMcp: PandaMcpGateway;
    }
}
/** 默认：MCP SDK Streamable HTTP + OAuth。 */
export declare function connectPublicPandaMcp(args: {
    url: string;
    store: PandaMcpOAuthStore;
    redirectUrl: string;
    openAuthorization: (url: URL) => void | Promise<void>;
    waitForCode: (signal?: AbortSignal) => Promise<string>;
    signal?: AbortSignal;
    state?: string;
}): Promise<{
    client: Client;
    close: () => Promise<void>;
}>;
/** 公网 PandaData MCP 网关。 */
export declare class PandaMcpGateway extends TypertRemoteService {
    static inject: string[];
    static Config: z<Config>;
    private readonly url;
    private readonly serverName;
    private readonly authTimeoutMs;
    private readonly toolCallTimeoutMs;
    private readonly database;
    private readonly store;
    private readonly promptDisposers;
    private tools;
    private phase;
    private message;
    private live;
    private closeLive;
    private authTail;
    private readonly publicOrigin;
    private readonly callbackPort;
    private authorizationUrl;
    private authorizationReady;
    private resolveAuthorization;
    private authController;
    private connector;
    private openAuthorization;
    constructor(ctx: Context, config: Config);
    databaseList(signal?: AbortSignal): Promise<DataSummary[]>;
    databaseImport(input: DataImport, signal?: AbortSignal): Promise<DataSummary>;
    databaseFetch(input: DataFetch, signal?: AbortSignal): Promise<DataSummary>;
    databaseQuery(input: DataQuery, signal?: AbortSignal): Promise<DataResult>;
    databasePreview(input: {
        id: string;
    }, signal?: AbortSignal): Promise<DataResult>;
    databaseRefresh(input: {
        id: string;
    }, signal?: AbortSignal): Promise<DataSummary>;
    databaseRemove(input: {
        id: string;
    }, signal?: AbortSignal): Promise<void>;
    databaseCategorize(input: {
        id: string;
        category: DataCategory;
    }, signal?: AbortSignal): Promise<DataSummary>;
    private installDatabaseTools;
    /** 测试替换会话工厂。 */
    useConnector(connector: PandaMcpSessionConnector): void;
    /** 测试替换打开浏览器。 */
    useOpenAuthorization(openAuthorization: (url: URL) => void | Promise<void>): void;
    status(signal?: AbortSignal): Promise<PandaMcpStatus>;
    authenticate(signal?: AbortSignal): Promise<PandaMcpStatus>;
    /** 用已保存 token 静默重连；没有 token 时只返回当前状态，不打开浏览器。 */
    refresh(signal?: AbortSignal): Promise<PandaMcpStatus>;
    logout(signal?: AbortSignal): Promise<PandaMcpStatus>;
    private snapshot;
    private restoreExistingTokens;
    ensureAuthenticated(signal?: AbortSignal): Promise<PandaMcpStatus>;
    private runAuthentication;
    private connectLive;
    private dropLive;
    private mountStubs;
    private replaceWithStubs;
    private installPrompts;
    private disposePrompts;
}
export default PandaMcpGateway;
/** 测试辅助：默认公开工具名。 */
export declare function pandaMcpPublicNames(serverName?: string): string[];
//# sourceMappingURL=index.d.ts.map