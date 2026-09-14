/** Durable local data catalog. Cached responses retain their source and coverage. */
import type { JsonValue } from '@deepseek-ai/dsh-util-values';
import { type DataCategory } from './data-category.ts';
export type { DataCategory } from './data-category.ts';
export interface DataSource {
    kind: 'file' | 'http' | 'pandadata';
    url?: string;
    method?: string;
    params?: Record<string, JsonValue>;
    filename?: string;
}
export interface DataImport {
    name: string;
    format: 'csv' | 'json';
    content: string;
    kind: 'timeseries' | 'table' | 'auto';
    category?: DataCategory;
    dateColumn?: string;
    ttlSeconds: number;
}
export interface DataFetch {
    name: string;
    source: DataSource;
    kind: 'timeseries' | 'table' | 'auto';
    category?: DataCategory;
    dateColumn?: string;
    ttlSeconds: number;
}
export interface DataSummary extends DataFetch {
    id: string;
    kind: 'timeseries' | 'table';
    category: DataCategory;
    columns: string[];
    rowCount: number;
    fetchedAt: string;
    expiresAt: string;
    from?: string;
    to?: string;
    bytes: number;
}
export interface DataQuery {
    id: string;
    from?: string;
    to?: string;
    minRows?: number;
    limit?: number;
    offset?: number;
    refresh?: boolean;
}
export interface DataResult {
    dataset: DataSummary;
    status: 'hit' | 'refreshed' | 'insufficient';
    reasons: string[];
    rows: Record<string, JsonValue>[];
    total: number;
    nextOffset?: number;
}
export type PandaDataCall = (method: string, params: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>;
/** RFC 4180 style quoting, including quoted newlines and escaped double quotes. */
export declare function parseCsv(text: string): Record<string, unknown>[];
export declare function dataRows(raw: unknown): Record<string, unknown>[];
export declare class LocalDatabase {
    private readonly root;
    private readonly panda;
    private readonly now;
    private tail;
    constructor(root: string, panda: PandaDataCall, now?: () => number);
    private path;
    private read;
    private mutate;
    private write;
    list(): Promise<DataSummary[]>;
    private save;
    import(input: DataImport): Promise<DataSummary>;
    private sourceData;
    fetch(input: DataFetch, signal?: AbortSignal, id?: string): Promise<DataSummary>;
    query(query: DataQuery, signal?: AbortSignal): Promise<DataResult>;
    /** Preview is explicitly allowed to show stale rows, and always returns freshness metadata. */
    preview(id: string): Promise<DataResult>;
    remove(id: string): Promise<void>;
    categorize(id: string, category: DataCategory): Promise<DataSummary>;
    cachedPanda(args: Record<string, unknown>, call: () => Promise<unknown>): Promise<unknown>;
}
//# sourceMappingURL=database.d.ts.map