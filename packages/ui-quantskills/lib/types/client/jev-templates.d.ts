import type { ContestWatchConfig } from './plugin-types.ts';
export declare const templates: readonly [{
    readonly id: "range";
    readonly name: "区间回归";
    readonly description: "识别上下沿，等待回升或回落确认";
}, {
    readonly id: "trend";
    readonly name: "趋势回调";
    readonly description: "确认均线方向，等待回踩后恢复";
}, {
    readonly id: "breakout";
    readonly name: "突破跟随";
    readonly description: "等待收盘突破前高或前低，限制追价";
}];
export type TemplateKind = typeof templates[number]['id'] | 'blank';
export type Instrument = NonNullable<ContestWatchConfig['instrument']>;
export declare const products: readonly [{
    readonly product: "rb";
    readonly name: "螺纹钢";
    readonly exchange: "SHF";
    readonly tickSize: 1;
}, {
    readonly product: "au";
    readonly name: "黄金";
    readonly exchange: "SHF";
    readonly tickSize: 0.02;
}, {
    readonly product: "ag";
    readonly name: "白银";
    readonly exchange: "SHF";
    readonly tickSize: 1;
}, {
    readonly product: "al";
    readonly name: "铝";
    readonly exchange: "SHF";
    readonly tickSize: 5;
}];
export declare const exchanges: {
    readonly SHF: "上海期货交易所";
    readonly DCE: "大连商品交易所";
    readonly CZC: "郑州商品交易所";
    readonly CFE: "中国金融期货交易所";
    readonly INE: "上海国际能源交易中心";
    readonly GFE: "广州期货交易所";
};
export declare function instrumentFor(symbol: string): Instrument;
export declare function withInstrument(config: ContestWatchConfig, instrument: Instrument): ContestWatchConfig;
export declare function withSymbol(config: ContestWatchConfig, symbol: string): ContestWatchConfig;
/** Starting values for a simulation workflow, not an optimized or backtested strategy. */
export declare function rangeTemplate(symbol?: string): ContestWatchConfig;
export declare function makeTemplate(kind: TemplateKind, current: ContestWatchConfig): ContestWatchConfig;
//# sourceMappingURL=jev-templates.d.ts.map