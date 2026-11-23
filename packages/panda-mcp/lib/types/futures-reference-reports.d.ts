import type { FuturesExchange, FuturesSource } from './futures-reference-types.ts';
type ReportKind = 'quotes' | 'settlement' | 'contracts';
export type ReportRow = Record<string, unknown>;
export type Report = {
    rows: ReportRow[];
    source: FuturesSource;
};
export declare const pandaFuturesUrl = "https://www.pandaaiquant.com/docs/strategy/futures";
export declare function tradingDay(value: unknown): string | null;
export declare function beijingTime(date: string, time: string): string | null;
export declare function sourceFor(date: string, status: FuturesSource['status'], cutoff: string | null, url?: string | null, provider?: FuturesSource['provider']): FuturesSource;
export declare class FuturesReports {
    private readonly fetch;
    private readonly archive?;
    constructor(fetch: typeof globalThis.fetch, archive?: string | undefined);
    private cached;
    read(exchange: FuturesExchange, kind: ReportKind, date: string, cutoff: string | null, signal?: AbortSignal): Promise<Report>;
}
export {};
//# sourceMappingURL=futures-reference-reports.d.ts.map