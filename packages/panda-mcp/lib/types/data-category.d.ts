/** Research subject and storage shape are independent: financial reports can have dates. */
export type DataCategory = 'market' | 'news' | 'fundamental' | 'other';
export declare const DATA_CATEGORIES: readonly DataCategory[];
export declare function inferDataCategory(input: {
    name: string;
    category?: DataCategory;
    source?: {
        method?: string;
    };
    columns?: string[];
}): DataCategory;
//# sourceMappingURL=data-category.d.ts.map