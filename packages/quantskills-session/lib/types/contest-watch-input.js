const definitions = {
    history: 'Completed bars must cover the lookback, be fresh and continuous within trading sessions.',
    spread: 'Current ask minus bid must not exceed maxSpread, in price units.',
    width: 'Range width in ticks must reach minWidthTicks.',
    touches: 'Independent touches on each edge must reach minTouches. Edge tolerance is 10% of range width; consecutive touches count once.',
    inside: 'Latest price is inside the historical range.',
    long_edge: 'Range location is between 0 and edgeFraction.', short_edge: 'Range location is between 1 minus edgeFraction and 1.',
    rebound: 'Rise from the minimum of the last 3 snapshots reaches reboundTicks.', pullback: 'Fall from the maximum of the last 3 snapshots reaches reboundTicks.',
    long_cost: 'Long reward / total cost reaches minRewardCostRatio.', short_cost: 'Short reward / total cost reaches minRewardCostRatio.',
    cost: 'Target reward / total cost reaches minRewardCostRatio. Total cost includes observed spread and assumed round-trip fees and slippage.',
    long_trend: 'Fast SMA exceeds slow SMA, and slow SMA exceeds its previous value.', short_trend: 'Fast SMA is below slow SMA, and slow SMA is below its previous value.',
    long_pullback: 'One of the last 3 bar lows touches the fast SMA within pullbackTicks; all lows stay above slow SMA minus tolerance; last close and current price recover above fast SMA, with current price within tolerance.',
    short_pullback: 'One of the last 3 bar highs touches the fast SMA within pullbackTicks; all highs stay below slow SMA plus tolerance; last close and current price fall below fast SMA, with current price within tolerance.',
    long_breakout: 'Last close and current price exceed the preceding bars high by bufferTicks.', short_breakout: 'Last close and current price fall below the preceding bars low by bufferTicks.',
    long_chase: 'Current price is no more than maxChaseTicks above the preceding high.', short_chase: 'Current price is no more than maxChaseTicks below the preceding low.',
    exit: 'Assess unrealized P/L before costs against stopLossTicks and takeProfitTicks, or strategy invalidation. Exits require a human-confirmed plan.',
};
/** UI labels are replaced with English definitions and typed facts, never model-translated on every tick. */
export function englishEvidence(evidence, datasetId) {
    const { source: _source, issue, warning, ...history } = evidence.history;
    return { ...evidence, history: { ...history, source: datasetId ?? 'not_configured', readFailed: Boolean(issue), hasWarning: Boolean(warning) },
        checks: evidence.checks.map(({ id, state, enforcement, actions, facts }) => ({ id, state, enforcement, actions, facts, definition: definitions[id] ?? id })) };
}
//# sourceMappingURL=contest-watch-input.js.map