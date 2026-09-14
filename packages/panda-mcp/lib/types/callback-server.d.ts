/** 本机回环回调，只接收 OAuth code，登录页仍在公网 MCP。 */
import { type Server } from 'node:http';
/** 一次 OAuth 回环监听。 */
export interface PandaMcpLoopback {
    readonly redirectUrl: string;
    waitForCode(signal?: AbortSignal): Promise<string>;
    close(): Promise<void>;
}
/**
 * 在 127.0.0.1 随机端口监听 `/callback`。
 */
export declare function startOauthLoopback(): Promise<PandaMcpLoopback>;
/** 测试辅助：解析回环地址。 */
export declare function loopbackPort(server: Server): number;
//# sourceMappingURL=callback-server.d.ts.map