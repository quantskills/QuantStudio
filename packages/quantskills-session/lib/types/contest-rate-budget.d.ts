import { ContestCliError } from './contest-cli.ts';
export type ContestRequestBucket = 'query' | 'trade';
export type ContestRequestHistory = Record<ContestRequestBucket, number[]>;
export declare const CONTEST_REQUEST_LIMITS: {
    readonly query: 60;
    readonly trade: 10;
};
export declare const CONTEST_REQUEST_WINDOW_MS = 60000;
export declare class ContestQuotaError extends ContestCliError {
    readonly bucket: ContestRequestBucket;
    readonly local = true;
    constructor(bucket: ContestRequestBucket, seconds: number);
}
/** Count HTTP calls made by the CLI commands QS uses, not just user clicks.
 * doctor performs both account and mandate reads; dry-run POST /orders is
 * conservatively charged to the trading bucket, just like plan create/execute.
 * Public metadata/install/update and local logout do not use either quota.
 */
export declare function contestRequestCost(args: readonly string[]): {
    bucket: ContestRequestBucket;
    count: number;
} | undefined;
export declare function reserveContestRequests(history: ContestRequestHistory, args: readonly string[], now?: number): void;
//# sourceMappingURL=contest-rate-budget.d.ts.map