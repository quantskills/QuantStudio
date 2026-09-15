import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess';
import type { ContestData } from './contest-types.ts';
import type { JsonValue } from '@deepseek-ai/dsh-util-values';
export declare const CONTEST_PACKAGE = "@chongqingliangyunzhijing/contest-cli";
export declare const CONTEST_ORIGIN = "https://www.pandaaiquant.com";
export interface ContestCli {
    run(runtime: string, args: readonly string[], signal: AbortSignal): Promise<ContestData>;
    install(runtime: string, signal: AbortSignal): Promise<{
        version: string;
        rules: string;
    }>;
}
export declare class ContestCliError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export declare function record(value: unknown): Record<string, JsonValue>;
/** Remove credential fields even if upstream adds them to a response. */
export declare function safeData(value: unknown): JsonValue;
export declare function parseCliOutput(text: string): ContestData;
export declare function versionAtLeast(version: string, minimum: string): boolean;
export declare class OfficialContestCli implements ContestCli {
    private readonly processes;
    private readonly authHome;
    constructor(processes: () => SubprocessRuntime, authHome: string);
    private process;
    run(runtime: string, args: readonly string[], signal: AbortSignal): Promise<ContestData>;
    install(runtime: string, signal: AbortSignal): Promise<{
        version: string;
        rules: string;
    }>;
}
//# sourceMappingURL=contest-cli.d.ts.map