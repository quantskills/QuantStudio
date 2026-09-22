import type { ContestWatchConfig } from './plugin-types.ts';
import { type FuturesProduct } from './jev-products.ts';
export { products } from './jev-products.ts';
export declare const exchanges: {
    readonly SHF: "\u4E0A\u6D77\u671F\u8D27\u4EA4\u6613\u6240";
    readonly DCE: "\u5927\u8FDE\u5546\u54C1\u4EA4\u6613\u6240";
    readonly CZC: "\u90D1\u5DDE\u5546\u54C1\u4EA4\u6613\u6240";
    readonly CFE: "\u4E2D\u56FD\u91D1\u878D\u671F\u8D27\u4EA4\u6613\u6240";
    readonly INE: "\u4E0A\u6D77\u56FD\u9645\u80FD\u6E90\u4EA4\u6613\u4E2D\u5FC3";
    readonly GFE: "\u5E7F\u5DDE\u671F\u8D27\u4EA4\u6613\u6240";
};
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
export declare function instrumentFor(symbol: string, catalog?: readonly FuturesProduct[]): Instrument;
export declare function configuredInstrument(config: ContestWatchConfig, catalog?: readonly FuturesProduct[]): Instrument;
export declare function withInstrument(config: ContestWatchConfig, instrument: Instrument): ContestWatchConfig;
export declare function withSymbol(config: ContestWatchConfig, symbol: string, catalog?: readonly FuturesProduct[]): ContestWatchConfig;
export declare function instrumentIssue(config: ContestWatchConfig, catalog?: readonly FuturesProduct[]): string | undefined;
/** Starting values for a simulation workflow, not an optimized or backtested strategy. */
export declare function rangeTemplate(symbol?: string): ContestWatchConfig;
export declare function makeTemplate(kind: TemplateKind, current: ContestWatchConfig): ContestWatchConfig;
//# sourceMappingURL=jev-templates.d.ts.map