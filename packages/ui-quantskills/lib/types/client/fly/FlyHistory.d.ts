export type HistoryStatus = {
    status: string;
    last_success_at?: number | null;
    retry_at?: number | null;
    source?: string;
    blocked?: boolean;
};
export declare function useRetryCountdown(retryAt?: number | null): number;
export type HistoryMarket = {
    product: string;
    symbol?: string;
    count: number;
    history_source?: {
        at?: number | null;
        error?: string;
    };
};
export declare const marketReadiness: Record<string, string>;
export declare function FlyHistory({ history, error, markets, enabled, onRefresh }: {
    history?: HistoryStatus | undefined;
    error?: string | undefined;
    markets: HistoryMarket[];
    enabled: boolean;
    onRefresh(): Promise<void>;
}): import("react").JSX.Element;
//# sourceMappingURL=FlyHistory.d.ts.map