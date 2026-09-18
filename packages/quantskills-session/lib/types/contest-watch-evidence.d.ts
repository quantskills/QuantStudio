/** Deterministic facts and gates. This module never calls a model or a trading endpoint. */
import { z } from 'zod';
import type { ContestWatchAction, ContestWatchBar, ContestWatchConfig, ContestWatchEvidence, ContestWatchHistory, ContestWatchQuote } from './contest-watch-types.ts';
export declare const historySchema: z.ZodObject<{
    datasetId: z.ZodString;
    barSeconds: z.ZodUnion<readonly [z.ZodLiteral<60>, z.ZodLiteral<300>]>;
    timeMeaning: z.ZodEnum<{
        open: "open";
        close: "close";
    }>;
    refresh: z.ZodBoolean;
    columns: z.ZodObject<{
        time: z.ZodString;
        symbol: z.ZodString;
        open: z.ZodString;
        high: z.ZodString;
        low: z.ZodString;
        close: z.ZodString;
    }, z.core.$strict>;
}, z.core.$strict>;
export declare const rangeRulesSchema: z.ZodObject<{
    lookbackBars: z.ZodNumber;
    tickSize: z.ZodNumber;
    minWidthTicks: z.ZodNumber;
    minTouches: z.ZodNumber;
    edgeFraction: z.ZodNumber;
    reboundTicks: z.ZodNumber;
    roundTripCostTicks: z.ZodNumber;
    minRewardCostRatio: z.ZodNumber;
    stopLossTicks: z.ZodNumber;
    takeProfitTicks: z.ZodNumber;
}, z.core.$strict>;
export declare const signalRulesSchema: z.ZodObject<{
    kind: z.ZodEnum<{
        trend: "trend";
        breakout: "breakout";
    }>;
    lookbackBars: z.ZodNumber;
    tickSize: z.ZodNumber;
    roundTripCostTicks: z.ZodNumber;
    minRewardCostRatio: z.ZodNumber;
    stopLossTicks: z.ZodNumber;
    takeProfitTicks: z.ZodNumber;
    fastBars: z.ZodNumber;
    slowBars: z.ZodNumber;
    pullbackTicks: z.ZodNumber;
    reboundTicks: z.ZodNumber;
    bufferTicks: z.ZodNumber;
    maxChaseTicks: z.ZodNumber;
}, z.core.$strict>;
/** All normalized bar times are close times. Ambiguous timestamps are rejected. */
export declare function normalizeWatchBars(rows: Record<string, unknown>[], config: NonNullable<ContestWatchConfig['history']>, symbol: string, now?: number): ContestWatchBar[];
type Account = {
    allowed: ContestWatchAction[];
    direction: unknown;
    entryPrice?: number | undefined;
};
export declare function watchEvidence(config: ContestWatchConfig, samples: ContestWatchQuote[], account: Account, history: ContestWatchHistory, now?: number): ContestWatchEvidence;
export {};
//# sourceMappingURL=contest-watch-evidence.d.ts.map