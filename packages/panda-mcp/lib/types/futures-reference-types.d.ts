export type FuturesExchange = 'SHFE' | 'INE' | 'DCE' | 'CZCE' | 'CFFEX' | 'GFEX';
export interface FuturesProduct {
    exchange: FuturesExchange;
    product: string;
    name: string;
    currentCategory: string;
    tickSize: number;
    tickText: string;
    multiplier: number;
    tradingUnit: string;
    sourceUrl: string;
    sourceSha256: string;
    coverage: {
        quoteDays: number;
        quoteFrom: string | null;
        quoteThrough: string | null;
        feeDays: number;
        feeFrom: string | null;
        feeThrough: string | null;
    };
}
export interface FuturesCatalog {
    snapshotDate: string;
    exchanges: {
        id: FuturesExchange;
        name: string;
    }[];
    products: FuturesProduct[];
}
export interface FuturesReferenceQuery {
    exchange: FuturesExchange;
    symbol: string;
    date?: string;
    cutoff?: string;
}
export interface HistoricalFuturesRule {
    validFrom: string;
    validThrough: string;
    tickSize: number;
    multiplier: number;
    sourceUrl: string;
    historicalSector?: string;
    sectorSourceUrl?: string;
}
export interface FuturesSource {
    status: 'available' | 'missing' | 'unsupported' | 'no_contract' | 'login_required' | 'error';
    url: string | null;
    provider: 'exchange' | 'pandadata';
    reportDate: string;
    sha256: string | null;
    sourceUpdatedAt: string | null;
    firstPublishedAt: null;
    cutoff: 'visible' | 'after_cutoff' | 'unknown' | null;
}
export interface FuturesQuote {
    openInterest: number | null;
    volume: number | null;
    settlement: number | null;
}
export interface FuturesContractTerms {
    listedDate: string | null;
    lastTradingDate: string | null;
    deliveryStart: string | null;
    deliveryEnd: string | null;
}
interface FuturesFee {
    yuanPerLot: number;
    rate: number;
}
export interface FuturesFees {
    open: FuturesFee;
    closePrevious: FuturesFee;
    closeToday: FuturesFee;
    marginLong: number | null;
    marginShort: number | null;
}
export interface FuturesReferenceResult {
    product: FuturesProduct;
    catalogDate: string;
    date: string | null;
    contract: string | null;
    main: {
        contract: string;
        method: 'after_close' | 'pandadata';
    } | null;
    quote: FuturesQuote | null;
    quoteSource: FuturesSource | null;
    fees: FuturesFees | null;
    feeSource: FuturesSource | null;
    historicalRule: HistoricalFuturesRule | null;
    contractTerms: FuturesContractTerms | null;
    contractSource: FuturesSource | null;
}
export {};
//# sourceMappingURL=futures-reference-types.d.ts.map