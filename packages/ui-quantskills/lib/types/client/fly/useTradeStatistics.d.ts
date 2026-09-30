export type StatisticValue = number | null;
type BilledStatistics = {
    realized_net: StatisticValue;
    commission: StatisticValue;
    pending_net_count: number;
};
export type PositionRow = BilledStatistics & {
    symbol: string;
    product: string;
    fill_count: number;
    opening_lots: number;
    closing_lots: number;
    long: number;
    short: number;
    long_entry: StatisticValue;
    short_entry: StatisticValue;
    last_price: StatisticValue;
    realized_gross: StatisticValue;
    floating_gross: StatisticValue;
    total_gross: StatisticValue;
    position_reconciled: boolean;
    valuation_stale: boolean;
};
export type TradeFill = {
    seq: number;
    symbol: string;
    time: string;
    time_source: string;
    direction: string;
    offset: string;
    volume: number;
    price: number;
    realized_gross: StatisticValue;
    realized_net: StatisticValue;
    commission: StatisticValue;
    opening_commission: StatisticValue;
    trade_id: string;
    order: string;
    decision_id: string;
    unmatched_closing_lots: number;
};
export type TradeStatisticsData = {
    day: string;
    date_basis: 'trading_day' | 'calendar';
    account_day: string;
    rows: PositionRow[];
    fills: TradeFill[];
    summary: BilledStatistics & {
        fill_count: number;
        realized_gross: StatisticValue;
        floating_gross: StatisticValue;
    };
    official: {
        Balance: StatisticValue;
        Commission: StatisticValue;
        day_net: StatisticValue;
    };
    note: string;
};
export declare function useTradeStatistics(day?: string): {
    data: TradeStatisticsData | undefined;
    error: string;
};
export {};
//# sourceMappingURL=useTradeStatistics.d.ts.map