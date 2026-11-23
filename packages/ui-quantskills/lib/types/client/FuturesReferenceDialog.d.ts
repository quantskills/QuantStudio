import type { FuturesCatalog, FuturesReferenceQuery, FuturesReferenceResult } from '@deepseek-ai/dsh-panda-mcp/types';
export interface FuturesReferenceAccess {
    catalog(): Promise<FuturesCatalog>;
    query(input: FuturesReferenceQuery): Promise<FuturesReferenceResult>;
}
export declare function FuturesReferenceDialog({ access, close }: {
    access: FuturesReferenceAccess;
    close(): void;
}): import("react").JSX.Element;
//# sourceMappingURL=FuturesReferenceDialog.d.ts.map