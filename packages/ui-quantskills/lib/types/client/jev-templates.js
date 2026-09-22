import { futuresProduct, futuresExchanges, futuresContractPattern } from '@deepseek-ai/dsh-quantskills-session/contracts';
import { products } from "./jev-products.js";
export { products } from "./jev-products.js";
export const exchanges = futuresExchanges;
export const templates = [
    { id: 'range', name: '区间回归', description: '识别上下沿，等待回升或回落确认' },
    { id: 'trend', name: '趋势回调', description: '确认均线方向，等待回踩后恢复' },
    { id: 'breakout', name: '突破跟随', description: '等待收盘突破前高或前低，限制追价' },
];
export function instrumentFor(symbol, catalog = products) {
    const product = futuresProduct(symbol) ?? (symbol ? '' : 'rb');
    const preset = catalog.find(item => item.product === product);
    return { product, exchange: preset?.exchange ?? 'SHF', tickSize: preset?.tickSize ?? 0 };
}
export function configuredInstrument(config, catalog = products) {
    const inferred = instrumentFor(config.symbol, catalog);
    return config.instrument ?? { ...inferred, exchange: config.autoHistory?.exchange ?? inferred.exchange,
        tickSize: config.rangeRules?.tickSize ?? config.signalRules?.tickSize ?? inferred.tickSize };
}
export function withInstrument(config, instrument) {
    const oldTick = config.instrument?.tickSize ?? config.rangeRules?.tickSize ?? config.signalRules?.tickSize;
    const oldProduct = config.instrument?.product ?? futuresProduct(config.symbol);
    const sameMarket = oldProduct === instrument.product && (config.instrument?.exchange ?? config.autoHistory?.exchange ?? instrument.exchange) === instrument.exchange;
    return { ...config, instrument, builtInTemplate: config.builtInTemplate === 'rb-range' && config.rangeRules ? 'range' : config.builtInTemplate,
        symbol: futuresProduct(config.symbol) === instrument.product.toLowerCase() ? config.symbol : '', history: sameMarket ? config.history : undefined,
        autoHistory: config.autoHistory ? { ...config.autoHistory, exchange: instrument.exchange } : undefined,
        maxSpread: Number(((oldTick ? (config.maxSpread ?? oldTick * 2) / oldTick : 2) * instrument.tickSize).toPrecision(12)),
        ...(config.rangeRules ? { rangeRules: { ...config.rangeRules, tickSize: instrument.tickSize } } : {}),
        ...(config.signalRules ? { signalRules: { ...config.signalRules, tickSize: instrument.tickSize } } : {}) };
}
export function withSymbol(config, symbol, catalog = products) {
    // Do not select a different market for intermediate keystrokes (e.g. I -> IF -> IF2612).
    const product = futuresProduct(symbol);
    if (!product || product === config.instrument?.product.toLowerCase())
        return { ...config, symbol, history: undefined };
    const preset = catalog.find(item => item.product === product);
    // Preserve metadata filled before a contract, including during incomplete keystrokes.
    const pending = !config.instrument?.product && config.instrument;
    const instrument = pending && (!preset || (pending.tickSize > 0 && pending.exchange === preset.exchange))
        ? { ...pending, product } : preset ? instrumentFor(symbol, catalog) : { product, exchange: config.instrument?.exchange ?? 'SHF', tickSize: 0 };
    return { ...withInstrument(config, instrument), symbol };
}
export function instrumentIssue(config, catalog = products) {
    if (!futuresContractPattern.test(config.symbol))
        return '请输入实际交割合约，例如 m2701、MA701、IF2612 或 l2610F。';
    const product = futuresProduct(config.symbol), instrument = configuredInstrument(config, catalog), known = catalog.find(item => item.product === product);
    if (known && !known.enabled)
        return `${known.name}（${known.product.toUpperCase()}）在柜台品种目录中未启用，请先同步目录或联系比赛服务。`;
    if (instrument.product.toLowerCase() !== product)
        return '合约与所选品种不一致，请重新选择品种或填写实际合约。';
    if (known && known.exchange !== instrument.exchange)
        return `该品种属于${exchanges[known.exchange]}，请核对交易所。`;
    if (!Number.isFinite(instrument.tickSize) || instrument.tickSize <= 0)
        return '请填写该合约的最小价格变动（tick），必须大于 0。';
    return undefined;
}
/** Starting values for a simulation workflow, not an optimized or backtested strategy. */
export function rangeTemplate(symbol = '') {
    const instrument = instrumentFor(symbol);
    return { symbol, instrument, builtInTemplate: 'range', strategyName: '区间回归', volume: 1, intervalSeconds: 3, decisionIntervalSeconds: 30, decisionMode: 'jev',
        durationMinutes: 120, minConfidence: .8, maxEquityDrop: 1000, maxPlans: 3, openingCooldownSeconds: 300, minSamples: 8, allowedSide: 'both',
        autoHistory: { exchange: instrument.exchange, barSeconds: 60 }, maxSpread: instrument.tickSize * 2,
        instructions: '以区间回归为研究方向，结合已完成 K 线、实时快照、持仓和成本评估机会。自主模式中区间边界、触碰和回升阈值仅作参考，由你综合判断；严格模式遵守程序条件。历史不足时分析缺口，不新开仓。不加仓、不直接反手。',
        actionCriteria: { hold: '综合证据不足或持仓更适合继续保持时观望。', open_long: '空仓，综合判断价格向区间中上部回归的依据足够时评估开多；下沿回升是参考信号。',
            open_short: '空仓，综合判断价格向区间中下部回归的依据足够时评估开空；上沿回落是参考信号。', close_long: '持有多头，综合浮动盈亏、区间失效和退出参考判断是否平多。', close_short: '持有空头，综合浮动盈亏、区间失效和退出参考判断是否平空。' },
        rangeRules: { lookbackBars: 30, tickSize: instrument.tickSize, minWidthTicks: 8, minTouches: 2, edgeFraction: .2, reboundTicks: 2,
            roundTripCostTicks: 2, minRewardCostRatio: 2, stopLossTicks: 8, takeProfitTicks: 12 } };
}
export function makeTemplate(kind, current) {
    const base = { ...withInstrument(rangeTemplate(current.symbol), current.instrument ?? instrumentFor(current.symbol)), decisionMode: current.decisionMode ?? 'jev' };
    if (kind === 'range')
        return base;
    const common = { ...base, rangeRules: undefined, builtInTemplate: undefined };
    if (kind === 'blank')
        return { ...common, customStrategy: true, strategyName: '我的策略', instructions: '',
            actionCriteria: { hold: '', open_long: '', open_short: '', close_long: '', close_short: '' } };
    const trend = kind === 'trend';
    return { ...common, builtInTemplate: kind, strategyName: trend ? '趋势回调' : '突破跟随',
        signalRules: { kind, lookbackBars: 30, tickSize: base.instrument.tickSize, fastBars: 5, slowBars: 20, pullbackTicks: 4, reboundTicks: 2,
            bufferTicks: 2, maxChaseTicks: 8, roundTripCostTicks: 2, minRewardCostRatio: 2, stopLossTicks: 8, takeProfitTicks: 16 },
        instructions: (trend ? '以趋势回调为研究方向，参考快慢均线、价格结构、回踩恢复和实时变化综合判断方向及机会。' : '以突破跟随为研究方向，参考已完成 K 线、此前高低点、突破延续和追价成本综合判断机会。')
            + '自主模式中数值阈值和程序信号仅作参考，不因单项未达阈值直接放弃评估；严格模式遵守程序条件。历史不足时分析缺口，不新开仓。不加仓、不直接反手。',
        actionCriteria: { hold: '综合证据不足、风险成本不合适或维持持仓更合理时观望。',
            open_long: trend ? '空仓，综合趋势延续、回踩恢复和成本判断开多是否合理。' : '空仓，综合向上突破的有效性、延续性与追价成本判断开多是否合理。',
            open_short: trend ? '空仓，综合下行延续、反弹转弱和成本判断开空是否合理。' : '空仓，综合向下突破的有效性、延续性与追价成本判断开空是否合理。',
            close_long: '持有多头，止损、目标或策略失效等退出条件满足时评估平多。', close_short: '持有空头，止损、目标或策略失效等退出条件满足时评估平空。' } };
}
//# sourceMappingURL=jev-templates.js.map