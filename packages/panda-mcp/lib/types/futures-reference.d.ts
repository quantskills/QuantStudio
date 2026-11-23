import { type PandaDataCall } from './database.ts';
import type { FuturesCatalog, FuturesReferenceQuery, FuturesReferenceResult } from './futures-reference-types.ts';
export declare const futuresCatalog: FuturesCatalog;
export declare class FuturesReference {
    private readonly reports;
    private readonly panda;
    constructor(options?: {
        fetch?: typeof globalThis.fetch;
        archive?: string;
        panda?: PandaDataCall;
    });
    private vendorQuote;
    query(input: FuturesReferenceQuery, signal?: AbortSignal): Promise<FuturesReferenceResult>;
}
//# sourceMappingURL=futures-reference.d.ts.map