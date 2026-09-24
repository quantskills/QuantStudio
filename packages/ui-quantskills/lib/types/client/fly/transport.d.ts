import type { JsonValue } from '@deepseek-ai/dsh-util-values';
import type { FlyRequest, FlyRuntimeStatus } from '@deepseek-ai/dsh-quantskills-session/src/fly-runtime.ts';
export interface FlyAccess {
    status(): Promise<FlyRuntimeStatus>;
    install(input?: {
        blenderPath?: string;
    }): Promise<FlyRuntimeStatus>;
    request(input: FlyRequest): Promise<JsonValue>;
}
export declare function connectFlyTransport(value: FlyAccess): void;
export declare function flyApi<T>(path: string, body?: unknown): Promise<T>;
export declare function flyFetch(url: string, init?: RequestInit): Promise<Response>;
export declare function flyAsset(version: string, name: 'home.glb' | 'preview.png'): Promise<string>;
//# sourceMappingURL=transport.d.ts.map
