import type { Context } from '@deepseek-ai/cordis';
import type { ContestWatchConfig, ContestWatchDataset, ContestWatchHistory } from './contest-watch-types.ts';
/** Classify without exposing raw provider messages, URLs or credentials. */
export declare function historyFailure(error: unknown, stage: string): {
    issue: string;
    diagnostic: {
        stage: string;
        code: "AUTH_REQUIRED" | "TIMEOUT" | "RATE_LIMIT" | "NETWORK" | "INVALID_DATA" | "READ_FAILED";
        retryable: boolean;
    };
};
export declare function watchDatasets(ctx: Context): Promise<ContestWatchDataset[]>;
export declare function prepareWatchHistory(ctx: Context, input: {
    symbol: string;
    barSeconds: number;
}, signal?: AbortSignal): Promise<NonNullable<ContestWatchConfig['history']>>;
export declare function watchHistory(ctx: Context, config: ContestWatchConfig, signal: AbortSignal): Promise<ContestWatchHistory>;
//# sourceMappingURL=contest-watch-history.d.ts.map