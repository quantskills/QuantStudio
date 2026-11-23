import type { FuturesExchange, FuturesProduct, HistoricalFuturesRule } from './futures-reference-types.ts';
export declare const products: FuturesProduct[];
export declare const historicalRules: (HistoricalFuturesRule & {
    exchange: FuturesExchange;
    product: string;
})[];
//# sourceMappingURL=futures-reference-catalog.d.ts.map