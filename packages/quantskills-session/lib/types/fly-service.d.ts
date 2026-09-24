import type { Context } from '@deepseek-ai/cordis';
import { z } from 'zod';
import type { JsonValue } from '@deepseek-ai/dsh-util-values';
import type { ContestService } from './contest-service.ts';
import { FlyRuntime, type FlyRequest } from './fly-runtime.ts';
export declare const flyInstrumentSchema: z.ZodObject<{
    product: z.ZodString;
    symbol: z.ZodString;
    exchange: z.ZodEnum<{
        SHF: "SHF";
        DCE: "DCE";
        CZC: "CZC";
        CFE: "CFE";
        INE: "INE";
        GFE: "GFE";
    }>;
}, z.core.$strip>;
export declare function flyQuoteTime(value: unknown): number;
export declare class FlyService {
    private readonly ctx;
    private readonly contest;
    private readonly watcherRunning;
    readonly runtime: FlyRuntime;
    private readonly specs;
    private readonly history;
    private observation?;
    private proposalTail;
    private riskTail;
    private readonly reconciled;
    constructor(ctx: Context, contest: ContestService, root: string, watcherRunning: () => Promise<boolean>);
    request(input: FlyRequest): Promise<JsonValue>;
    private identity;
    private spec;
    private callback;
    private market;
    private bars;
    private prepare;
    private equityPeak;
    private language;
    private jev;
}
//# sourceMappingURL=fly-service.d.ts.map
