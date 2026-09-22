import type { ContestAccess } from './contest.ts';
import { type FuturesProduct } from './jev-products.ts';
/** Official varieties metadata only; never resolves a delivery month or requests market quotes. */
export declare function parseVarieties(value: unknown): FuturesProduct[];
export declare function useJevProducts(access: NonNullable<ContestAccess['watch']>, connected: boolean): {
    catalog: readonly FuturesProduct[];
    message: string;
    loading: boolean;
    refresh: () => Promise<void>;
};
//# sourceMappingURL=jev-catalog.d.ts.map