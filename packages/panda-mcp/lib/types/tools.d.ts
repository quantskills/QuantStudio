/** 把远端 MCP 工具注册到 ctx.tools；未登录时挂本地桩。 */
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Context } from '@deepseek-ai/cordis';
import { type PandaMcpReauthRequired, type PandaMcpStatus } from './types.ts';
/** 一次工具世代的注销函数。 */
export type ToolDisposers = Map<string, () => void>;
/** 调用已连接 MCP 会话。 */
export interface ConnectedMcpSession {
    readonly client: Client;
    readonly toolCallTimeoutMs: number;
}
/**
 * 未登录时给模型看的固定错误。
 */
export declare function reauthRequired(message?: string): PandaMcpReauthRequired;
/**
 * 注册未登录桩工具。数据类工具会触发 ensureAuthenticated。
 */
export declare function registerStubTools(ctx: Context, serverName: string, status: () => PandaMcpStatus, ensureAuthenticated: (signal?: AbortSignal) => Promise<PandaMcpStatus>, callWhenConnected: (rawName: string, args: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>): ToolDisposers;
/**
 * 从已连接 Client 同步远端工具列表。
 */
export declare function syncLiveTools(ctx: Context, session: ConnectedMcpSession, serverName: string, previous: ToolDisposers, onUnauthorized: () => Promise<void>, aroundCall?: (rawName: string, args: Record<string, unknown>, call: () => Promise<unknown>) => Promise<unknown>): Promise<ToolDisposers>;
/** 注销一整代工具。 */
export declare function disposeTools(disposers: ToolDisposers): void;
/** 供已连接会话直接调用远端工具（桩工具登录成功后转发）。 */
export declare function callConnectedTool(session: ConnectedMcpSession, rawName: string, args: Record<string, unknown>, signal: AbortSignal | undefined, onUnauthorized: () => Promise<void>): Promise<unknown>;
//# sourceMappingURL=tools.d.ts.map