export type TradeMarket = {
    product: string;
    symbol?: string;
    count: number;
    period_minutes?: number;
    readiness: string;
    long: number;
    short: number;
    decision?: {
        decision_id: string;
        input_at: number;
        choice: {
            action: string;
            reason: string;
            sampling: boolean;
            current_position?: number;
            target_position?: number;
        };
        trade_response?: Record<string, {
            value: number;
            active: number;
            neurons: number;
        }>;
    };
    execution?: {
        decision_id: string;
        status: string;
        message: string;
    };
    pending?: {
        decision_id: string;
        filled: number;
        terminal: boolean;
    };
    signal_filter?: {
        period_minutes: number;
        required: number;
        confirmed: number;
        allowed: boolean;
        reason: string;
        margin?: number;
        cost?: {
            known: boolean;
            room_cost_ratio?: number;
            source?: string;
        };
    };
    history_source?: {
        source: string;
        message?: string;
    };
};
export declare function TradeLoop({ markets, observing }: {
    markets: TradeMarket[];
    observing: boolean;
}): import("react").JSX.Element;
//# sourceMappingURL=TradeLoop.d.ts.map