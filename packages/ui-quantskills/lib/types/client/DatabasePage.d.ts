import type { DataCategory, DataSummary, DataImport, DataFetch, DataQuery, DataResult } from '@deepseek-ai/dsh-panda-mcp';
export interface DatabaseAccess {
    list(): Promise<DataSummary[]>;
    import(input: DataImport): Promise<DataSummary>;
    fetch(input: DataFetch): Promise<DataSummary>;
    preview(id: string): Promise<DataResult>;
    query(input: DataQuery): Promise<DataResult>;
    refresh(id: string): Promise<DataSummary>;
    remove(id: string): Promise<void>;
    categorize(id: string, category: DataCategory): Promise<DataSummary>;
}
export declare function DatabasePage({ access }: {
    access?: DatabaseAccess | undefined;
}): import("react").JSX.Element;
//# sourceMappingURL=DatabasePage.d.ts.map