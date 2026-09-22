/** Actual delivery contracts, including DCE monthly-average contracts (e.g. l2610F). */
export declare const futuresContractPattern: RegExp;
export declare const futuresProductPattern: RegExp;
export declare const futuresExchanges: {
    readonly SHF: "上海期货交易所";
    readonly DCE: "大连商品交易所";
    readonly CZC: "郑州商品交易所";
    readonly CFE: "中国金融期货交易所";
    readonly INE: "上海国际能源交易中心";
    readonly GFE: "广州期货交易所";
};
export type FuturesExchange = keyof typeof futuresExchanges;
/** Compare actual futures contracts without losing an explicit exchange or the monthly-average suffix. */
export declare const contestContractParts: (value: unknown) => RegExpExecArray | null;
export declare function futuresProduct(symbol: string): string | undefined;
export declare function sameContestContract(a: unknown, b: string, exchange?: string): boolean;
//# sourceMappingURL=contest-contract.d.ts.map