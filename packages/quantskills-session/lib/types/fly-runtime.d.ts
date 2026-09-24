import type { JsonValue } from '@deepseek-ai/dsh-util-values';
export interface FlyRuntimeStatus {
    supported: boolean;
    installed: boolean;
    running: boolean;
    installing: boolean;
    message: string;
}
export interface FlyRequest {
    path: string;
    body?: JsonValue;
}
export declare class FlyRuntime {
    readonly root: string;
    private readonly callback;
    private child;
    private bridge;
    private port;
    private starting;
    private installing;
    private message;
    private readonly lifetime;
    private readonly token;
    readonly python: string;
    constructor(root: string, callback: (path: string, body: unknown, signal: AbortSignal) => Promise<JsonValue>);
    status(): Promise<FlyRuntimeStatus>;
    resume(): Promise<void>;
    install(input?: {
        blenderPath?: string;
    }): Promise<FlyRuntimeStatus>;
    private process;
    private prepare;
    private start;
    private open;
    request(input: FlyRequest): Promise<JsonValue>;
    dispose(): Promise<void>;
}
//# sourceMappingURL=fly-runtime.d.ts.map
