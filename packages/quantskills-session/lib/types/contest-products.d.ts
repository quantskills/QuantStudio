import type { FuturesExchange } from './contest-contract.ts';
export interface FuturesProduct {
    product: string;
    name: string;
    exchange: FuturesExchange;
    tickSize: number;
    enabled: boolean;
}
export declare const catalogCheckedAt = "2026-09-22";
export declare const catalogVersion = "85304a41f174e4a8";
export declare const products: readonly FuturesProduct[];
//# sourceMappingURL=contest-products.d.ts.map
