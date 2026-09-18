/** Host-only Jev evaluation for the account-bound futures research tool. */
import type { Context } from '@deepseek-ai/cordis';
import type { ContestService } from './contest-service.ts';
import type { ContestIdentity } from './contest-types.ts';
export declare function evaluateContestWithJev(ctx: Context, contest: ContestService, identity: ContestIdentity, input: {
    evidence: string;
    proposal: string;
}, signal: AbortSignal, request?: typeof fetch): Promise<{
    evaluatedAt: string;
    accountFetchedAt: string;
    legend: {
        evidence: {
            sufficient: string;
            incomplete: string;
            conflicting: string;
        };
        support: string[];
        risk: string;
    };
    note: string;
    model: "jev-1.13.0";
    answers: {
        evidence: {
            type: "choice";
            choice: "sufficient" | "incomplete" | "conflicting";
            confidence: number;
            probabilities: Record<"sufficient" | "incomplete" | "conflicting", number>;
        };
        support: {
            type: "score";
            score: number;
            confidence: number;
            probabilities: Record<"0" | "1" | "2" | "3", number>;
        };
        risk: {
            type: "noul";
            noul: number;
        };
    };
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
}>;
//# sourceMappingURL=contest-jev.d.ts.map