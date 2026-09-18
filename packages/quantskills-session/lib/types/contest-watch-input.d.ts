import type { ContestWatchEvidence } from './contest-watch-types.ts';
/** UI labels are replaced with English definitions and typed facts, never model-translated on every tick. */
export declare function englishEvidence(evidence: ContestWatchEvidence, datasetId?: string): {
    history: {
        source: string;
        readFailed: boolean;
        hasWarning: boolean;
        barSeconds: number;
        count: number;
        from?: number;
        to?: number;
        fetchedAt?: number;
        diagnostic?: {
            stage: string;
            code: string;
            retryable: boolean;
        };
    };
    checks: {
        id: string;
        state: "unknown" | "pass" | "fail";
        enforcement: "hard" | "reference" | undefined;
        actions: import("./contest-watch-types.ts").ContestWatchAction[];
        facts: Record<string, string | number | boolean | null> | undefined;
        definition: string;
    }[];
    evaluatedAt: number;
    decisionMode?: "jev" | "strict";
    features: {
        quoteWindowSeconds: number;
        quoteCount: number;
        lower: number | null;
        upper: number | null;
        widthTicks: number | null;
        lowerTouches: number;
        upperTouches: number;
        location: number | null;
        reboundTicks: number | null;
        pullbackTicks: number | null;
        spreadTicks: number | null;
        longRewardCostRatio: number | null;
        shortRewardCostRatio: number | null;
    };
    allowedActions: import("./contest-watch-types.ts").ContestWatchAction[];
};
//# sourceMappingURL=contest-watch-input.d.ts.map