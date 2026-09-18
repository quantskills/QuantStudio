import type { Context } from '@deepseek-ai/cordis';
import type { ContestService } from './contest-service.ts';
import type { ContestInspection } from './contest-types.ts';
import type { ContestWatchAction, ContestWatchConfig, ContestWatchDecision, ContestWatchEvidence, ContestWatchHistory, ContestWatchQuote, ContestWatchStatus, ContestWatchTemplate } from './contest-watch-types.ts';
type Quote = ContestWatchQuote;
/** Quotes without an explicit timezone are exchange-local Shanghai timestamps. */
export declare function watchQuote(value: unknown, symbol: string, now?: number, exchange?: string): {
    quote: Quote;
    issue?: never;
} | {
    quote?: never;
    issue: string;
};
/** Fail closed on ambiguous positions, missing account facts or exceeded limits. */
export declare function watchAccount(snapshot: ContestInspection, config: ContestWatchConfig, baseline?: number): {
    entryPrice?: number;
    equity: number;
    volume: number;
    closable: number;
    direction: string | number | boolean | import("@deepseek-ai/dsh-util-values").JsonValue[] | {
        [key: string]: import("@deepseek-ai/dsh-util-values").JsonValue;
    };
    allowed: ContestWatchAction[];
    hasOpenOrders: boolean;
    fetchedAt: number;
};
export declare function watchSpread(config: ContestWatchConfig, quote: Quote): boolean;
export declare function decideWithJev(ctx: Context, config: ContestWatchConfig, samples: Quote[], account: ReturnType<typeof watchAccount>, signal: AbortSignal, request?: typeof fetch, context?: {
    evidence: ContestWatchEvidence;
    history: ContestWatchHistory;
    root?: string;
}): Promise<ContestWatchDecision>;
export declare class ContestWatcher {
    private readonly ctx;
    private readonly contest;
    private readonly decide;
    private templateWriting;
    private readTemplates;
    templates(): Promise<ContestWatchTemplate[]>;
    saveTemplate(input: ContestWatchTemplate): Promise<ContestWatchTemplate[]>;
    private state;
    private loading;
    private writing;
    private controller;
    private timer;
    private working;
    private decisionTask;
    private configuring;
    private sampleGeneration;
    private starting;
    private stopping;
    private samples;
    private lastPlanAt;
    private pendingPlanObserved;
    private accountSnapshot;
    private accountCheckedAt;
    private retryCount;
    private historyCache;
    constructor(ctx: Context, contest: ContestService, decide?: typeof decideWithJev);
    private load;
    private save;
    private note;
    status(): Promise<ContestWatchStatus>;
    configure(input: {
        apiKey?: string;
        translator?: {
            provider: string;
            model: string;
        };
    }): Promise<import("./contest-watch-types.ts").ContestJevSettings>;
    start(input: ContestWatchConfig): Promise<ContestWatchStatus>;
    private schedule;
    stop(reason?: string): Promise<ContestWatchStatus>;
    private finishStop;
    private retryRead;
    tick(): Promise<void>;
    private analyze;
    dispose(): void;
}
export {};
//# sourceMappingURL=contest-watch.d.ts.map