import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess';
import type { JsonValue } from '@deepseek-ai/dsh-util-values';
import type { FactorCredentials } from './factor-contest-types.ts';
export declare class FactorApiError extends Error {
    readonly code: string;
    readonly rejected: boolean;
    constructor(code: string, rejected?: boolean);
}
export interface FactorRuntime {
    install(runtime: string, version: string, signal: AbortSignal): Promise<string>;
    latest(signal: AbortSignal): Promise<string>;
    login(credentials: FactorCredentials, signal: AbortSignal): Promise<string>;
    identity(signal: AbortSignal): Promise<string>;
    logout(): Promise<void>;
    cli(runtime: string, args: readonly string[], signal: AbortSignal): Promise<Record<string, JsonValue>>;
    arena(path: string, signal: AbortSignal, mutation?: {
        method: 'POST' | 'DELETE';
        key: string;
        body?: JsonValue;
    }): Promise<JsonValue>;
}
export declare class OfficialFactorRuntime implements FactorRuntime {
    private readonly processes;
    private readonly authHome;
    constructor(processes: () => SubprocessRuntime, authHome: string);
    private configPath;
    private python;
    private process;
    latest(signal: AbortSignal): Promise<string>;
    install(runtime: string, version: string, signal: AbortSignal): Promise<string>;
    private json;
    login(credentials: FactorCredentials, signal: AbortSignal): Promise<string>;
    private auth;
    identity(signal: AbortSignal): Promise<string>;
    logout(): Promise<void>;
    cli(runtime: string, args: readonly string[], signal: AbortSignal): Promise<Record<string, JsonValue>>;
    arena(path: string, signal: AbortSignal, mutation?: {
        method: 'POST' | 'DELETE';
        key: string;
        body?: JsonValue;
    }): Promise<JsonValue>;
}
//# sourceMappingURL=factor-contest-cli.d.ts.map