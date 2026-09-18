/** Deterministic facts and gates. This module never calls a model or a trading endpoint. */
import { z } from 'zod';
const column = z.string().trim().min(1).max(100);
export const historySchema = z.object({ datasetId: z.string().regex(/^[\w-]{1,100}$/), barSeconds: z.union([z.literal(60), z.literal(300)]),
    timeMeaning: z.enum(['open', 'close']), refresh: z.boolean(), columns: z.object({ time: column, symbol: column, open: column, high: column, low: column, close: column }).strict() }).strict();
export const rangeRulesSchema = z.object({ lookbackBars: z.number().int().min(10).max(240), tickSize: z.number().finite().positive(),
    minWidthTicks: z.number().finite().positive(), minTouches: z.number().int().min(2).max(10), edgeFraction: z.number().min(.05).max(.4),
    reboundTicks: z.number().finite().positive(), roundTripCostTicks: z.number().finite().positive(), minRewardCostRatio: z.number().min(1).max(20),
    stopLossTicks: z.number().finite().positive(), takeProfitTicks: z.number().finite().positive() }).strict();
export const signalRulesSchema = z.object({ kind: z.enum(['trend', 'breakout']), lookbackBars: z.number().int().min(10).max(240), tickSize: z.number().finite().positive(),
    roundTripCostTicks: z.number().finite().positive(), minRewardCostRatio: z.number().min(1).max(20), stopLossTicks: z.number().finite().positive(), takeProfitTicks: z.number().finite().positive(),
    fastBars: z.number().int().min(2).max(120), slowBars: z.number().int().min(3).max(239), pullbackTicks: z.number().finite().positive(), reboundTicks: z.number().finite().positive(),
    bufferTicks: z.number().finite().positive(), maxChaseTicks: z.number().finite().positive(),
}).strict().refine(r => r.kind === 'trend' ? r.fastBars < r.slowBars && r.slowBars < r.lookbackBars : r.bufferTicks < r.maxChaseTicks);
/** All normalized bar times are close times. Ambiguous timestamps are rejected. */
export function normalizeWatchBars(rows, config, symbol, now = Date.now()) {
    const { columns: c, barSeconds } = config;
    const bars = [];
    for (const row of rows) {
        const contract = String(row[c.symbol] ?? '').replace(/\.(SHF|DCE|CZC|CFE|INE|GFE)$/i, '');
        if (contract.toLowerCase() !== symbol.toLowerCase())
            continue;
        const raw = row[c.time];
        let time = typeof raw === 'number' ? raw > 1e11 ? raw : raw * 1000 : NaN;
        if (typeof raw === 'string' && /^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)?$/.test(raw)) {
            time = Date.parse(raw.replace(' ', 'T') + (/(Z|[+-]\d\d:\d\d)$/.test(raw) ? '' : '+08:00'));
        }
        if (!Number.isFinite(time))
            throw new Error('K 线时间格式无效；请使用带秒的时间或 Unix 时间戳。');
        if (config.timeMeaning === 'open')
            time += barSeconds * 1000;
        if (time > now)
            continue; // A forming/future bar is never evidence.
        const values = [c.open, c.high, c.low, c.close].map(key => typeof row[key] === 'number' ? row[key] : typeof row[key] === 'string' && String(row[key]).trim() ? Number(row[key]) : NaN);
        const [open, high, low, close] = values;
        if (!values.every(value => Number.isFinite(value) && value > 0) || high < Math.max(open, close, low) || low > Math.min(open, close))
            throw new Error('K 线 OHLC 数据无效。');
        bars.push({ time, open, high, low, close });
    }
    bars.sort((a, b) => a.time - b.time);
    if (bars.some((bar, i) => i > 0 && bar.time === bars[i - 1].time))
        throw new Error('同一合约存在重复 K 线时间。');
    return bars;
}
const show = (value) => value === null ? '未知' : Number(value.toFixed(3)).toString();
/** Close-labelled bars must touch both sides of a known intraday recess exactly. */
function historyContinuity(bars, barSeconds, config) {
    const exchange = config.autoHistory?.exchange ?? config.instrument?.exchange;
    const breaks = exchange === 'CFE' ? [[690, 780]] : exchange && ['SHF', 'INE', 'DCE', 'CZC', 'GFE'].includes(exchange) ? [[615, 630], [690, 810]] : [];
    const step = barSeconds * 1000, day = 86400000, offset = 8 * 3600000;
    let recesses = 0;
    for (let i = 1; i < bars.length; i++) {
        const previous = bars[i - 1].time, current = bars[i].time;
        if (current - previous === step)
            continue;
        const midnight = Math.floor((previous + offset) / day) * day - offset;
        if (breaks.some(([end, restart]) => previous === midnight + end * 60000 && current === midnight + restart * 60000 + step)) {
            recesses++;
            continue;
        }
        const stamp = (time) => new Date(time + offset).toISOString().slice(0, 19).replace('T', ' ');
        return { valid: false, detail: `K 线衔接异常：${stamp(previous)} → ${stamp(current)}；交易时段缺失或非已验证的日内休市衔接` };
    }
    return { valid: true, detail: `交易时段连续${recesses ? `（跨过 ${recesses} 次正常日内休市）` : ''}` };
}
export function watchEvidence(config, samples, account, history, now = Date.now()) {
    const rules = config.rangeRules, signal = config.signalRules, params = rules ?? signal, quote = samples.at(-1), bars = history.bars.filter(bar => bar.time <= now).slice(-(params?.lookbackBars ?? 60));
    const lastBar = bars.at(-1), checks = [];
    const opens = ['open_long', 'open_short'];
    const add = (id, label, passed, detail, actions = opens) => checks.push({ id, label, state: passed === null ? 'unknown' : passed ? 'pass' : 'fail', detail, actions });
    const boundaryBars = signal?.kind === 'breakout' ? bars.slice(0, -1) : bars;
    const lower = boundaryBars.length ? Math.min(...boundaryBars.map(bar => bar.low)) : null, upper = boundaryBars.length ? Math.max(...boundaryBars.map(bar => bar.high)) : null;
    const width = lower === null || upper === null ? null : upper - lower;
    const tick = params?.tickSize, recent = samples.slice(-3);
    const location = quote && lower !== null && width ? (quote.price - lower) / width : null;
    const spreadTicks = tick && quote?.ask !== undefined && quote.bid !== undefined && quote.ask >= quote.bid ? (quote.ask - quote.bid) / tick : null;
    const reboundTicks = tick && quote && recent.length >= 3 ? (quote.price - Math.min(...recent.map(x => x.price))) / tick : null;
    const pullbackTicks = tick && quote && recent.length >= 3 ? (Math.max(...recent.map(x => x.price)) - quote.price) / tick : null;
    const episodes = (side) => {
        let count = 0, touching = false;
        for (const bar of bars) {
            const hit = width !== null && (side === 'low' ? bar.low <= lower + width * .1 : bar.high >= upper - width * .1);
            if (hit && !touching)
                count++;
            touching = hit;
        }
        return count;
    };
    const lowerTouches = episodes('low'), upperTouches = episodes('high');
    const costTicks = params && spreadTicks !== null ? params.roundTripCostTicks + spreadTicks : null;
    const longRewardCostRatio = signal && costTicks ? signal.takeProfitTicks / costTicks : rules && costTicks && quote && upper !== null ? Math.min((upper - quote.price) / rules.tickSize, rules.takeProfitTicks) / costTicks : null;
    const shortRewardCostRatio = signal && costTicks ? signal.takeProfitTicks / costTicks : rules && costTicks && quote && lower !== null ? Math.min((quote.price - lower) / rules.tickSize, rules.takeProfitTicks) / costTicks : null;
    const continuity = historyContinuity(bars, history.barSeconds, config);
    const historyReady = !history.issue && Boolean(lastBar) && now - lastBar.time <= Math.max(90000, history.barSeconds * 2000)
        && bars.length >= (params?.lookbackBars ?? 10) && continuity.valid;
    add('history', '历史 K 线覆盖与时效', historyReady, history.issue ?? `${bars.length}/${params?.lookbackBars ?? 10} 根已完成 K 线；${continuity.detail}；末根距现在 ${lastBar ? Math.round((now - lastBar.time) / 1000) : '未知'} 秒（上限 ${Math.max(90, history.barSeconds * 2)} 秒）`, params || config.customStrategy || config.decisionMode === 'jev' ? opens : []);
    checks.at(-1).facts = { requiredBars: params?.lookbackBars ?? 10, completedBars: bars.length, continuous: continuity.valid,
        lastBarAgeSeconds: lastBar ? (now - lastBar.time) / 1000 : null, maxAgeSeconds: Math.max(90, history.barSeconds * 2), readFailed: Boolean(history.issue) };
    if (config.maxSpread) {
        const spread = quote?.ask !== undefined && quote.bid !== undefined && quote.ask >= quote.bid ? quote.ask - quote.bid : null;
        add('spread', '开仓买卖价差', spread === null ? null : spread <= config.maxSpread + Math.max(Math.abs(quote.ask), Math.abs(quote.bid)) * Number.EPSILON * 8, `当前 ${spread === null ? '未知' : show(spread)}，上限 ${config.maxSpread}（价格单位）`, opens);
    }
    if (rules) {
        add('width', '区间宽度', historyReady && width !== null ? width / rules.tickSize + 1e-8 >= rules.minWidthTicks : null, `${show(width === null ? null : width / rules.tickSize)} tick，要求 ≥ ${rules.minWidthTicks}`);
        add('touches', '上下沿独立触碰', historyReady ? lowerTouches >= rules.minTouches && upperTouches >= rules.minTouches : null, `下沿 ${lowerTouches} / 上沿 ${upperTouches} 次，各要求 ≥ ${rules.minTouches}；容差为区间宽度 10%，连续触碰只算一次`);
        add('inside', '未突破区间', historyReady && location !== null ? location >= 0 && location <= 1 : null, `区间 ${show(lower)}–${show(upper)}，最新价 ${quote?.price ?? '未知'}`);
        add('long_edge', '接近下沿', historyReady && location !== null ? location >= 0 && location <= rules.edgeFraction + 1e-8 : null, `位置 ${show(location)}，要求 0–${rules.edgeFraction}`, ['open_long']);
        add('short_edge', '接近上沿', historyReady && location !== null ? location + 1e-8 >= 1 - rules.edgeFraction && location <= 1 : null, `位置 ${show(location)}，要求 ${1 - rules.edgeFraction}–1`, ['open_short']);
        add('rebound', '回升确认', reboundTicks === null ? null : reboundTicks + 1e-8 >= rules.reboundTicks, `最近 3 个快照回升 ${show(reboundTicks)} tick，要求 ≥ ${rules.reboundTicks}`, ['open_long']);
        add('pullback', '回落确认', pullbackTicks === null ? null : pullbackTicks + 1e-8 >= rules.reboundTicks, `最近 3 个快照回落 ${show(pullbackTicks)} tick，要求 ≥ ${rules.reboundTicks}`, ['open_short']);
        for (const [side, ratio] of [['long', longRewardCostRatio], ['short', shortRewardCostRatio]]) {
            add(`${side}_cost`, side === 'long' ? '多头目标空间 / 成本' : '空头目标空间 / 成本', ratio === null ? null : ratio + 1e-8 >= rules.minRewardCostRatio, `${show(ratio)}，要求 ≥ ${rules.minRewardCostRatio}；成本=点差+每手双边手续费与滑点 ${rules.roundTripCostTicks} tick（假设）`, [side === 'long' ? 'open_long' : 'open_short']);
        }
        if (account.direction !== 'flat') {
            const pnl = quote && account.entryPrice !== undefined ? (quote.price - account.entryPrice) / rules.tickSize * (account.direction === 'long' ? 1 : -1) : null;
            add('exit', '持仓退出条件', pnl === null ? null : pnl <= -rules.stopLossTicks || pnl >= rules.takeProfitTicks || (historyReady && location !== null && (location < 0 || location > 1)), `未计成本浮动 ${show(pnl)} tick；止损 ${rules.stopLossTicks} / 目标 ${rules.takeProfitTicks} tick，或区间突破；仅提示待确认平仓`, []);
        }
    }
    if (signal) {
        let invalidLong = false, invalidShort = false;
        if (signal.kind === 'trend') {
            const mean = (count, offset = 0) => bars.slice(-count - offset, offset ? -offset : undefined).reduce((sum, bar) => sum + bar.close, 0) / count;
            const fast = mean(signal.fastBars), slow = mean(signal.slowBars), previousSlow = mean(signal.slowBars, 1);
            const recentBars = bars.slice(-3), tolerance = signal.pullbackTicks * signal.tickSize;
            invalidLong = fast <= slow;
            invalidShort = fast >= slow;
            add('long_trend', '上行趋势', historyReady ? fast > slow && slow > previousSlow : null, `快均线 ${show(fast)} / 慢均线 ${show(slow)} / 前一慢均线 ${show(previousSlow)}`, ['open_long']);
            add('short_trend', '下行趋势', historyReady ? fast < slow && slow < previousSlow : null, `快均线 ${show(fast)} / 慢均线 ${show(slow)} / 前一慢均线 ${show(previousSlow)}`, ['open_short']);
            for (const check of checks.filter(item => item.id.endsWith('_trend')))
                check.facts = { fastSma: historyReady ? fast : null, slowSma: historyReady ? slow : null, previousSlowSma: historyReady ? previousSlow : null };
            add('long_pullback', '回踩后恢复', historyReady && quote ? recentBars.some(bar => Math.abs(bar.low - fast) <= tolerance) && recentBars.every(bar => bar.low >= slow - tolerance) && lastBar.close >= fast && quote.price >= fast && quote.price <= fast + tolerance : null, `最近 3 根 K 线回踩快均线，收盘及最新价恢复；最新价距快均线不超过 ${signal.pullbackTicks} tick`, ['open_long']);
            add('short_pullback', '反弹后转弱', historyReady && quote ? recentBars.some(bar => Math.abs(bar.high - fast) <= tolerance) && recentBars.every(bar => bar.high <= slow + tolerance) && lastBar.close <= fast && quote.price <= fast && quote.price >= fast - tolerance : null, `最近 3 根 K 线反弹到快均线，收盘及最新价转弱；最新价距快均线不超过 ${signal.pullbackTicks} tick`, ['open_short']);
            add('rebound', '回升确认', reboundTicks === null ? null : reboundTicks + 1e-8 >= signal.reboundTicks, `${show(reboundTicks)} tick，要求 ≥ ${signal.reboundTicks}`, ['open_long']);
            add('pullback', '回落确认', pullbackTicks === null ? null : pullbackTicks + 1e-8 >= signal.reboundTicks, `${show(pullbackTicks)} tick，要求 ≥ ${signal.reboundTicks}`, ['open_short']);
        }
        else {
            const buffer = signal.bufferTicks * signal.tickSize, chase = signal.maxChaseTicks * signal.tickSize;
            add('long_breakout', '收盘突破前高', historyReady && upper !== null && quote ? lastBar.close >= upper + buffer && quote.price >= upper + buffer : null, `前 ${signal.lookbackBars - 1} 根最高 ${show(upper)}；末根收盘与最新价均须高出 ${signal.bufferTicks} tick`, ['open_long']);
            add('short_breakout', '收盘跌破前低', historyReady && lower !== null && quote ? lastBar.close <= lower - buffer && quote.price <= lower - buffer : null, `前 ${signal.lookbackBars - 1} 根最低 ${show(lower)}；末根收盘与最新价均须低出 ${signal.bufferTicks} tick`, ['open_short']);
            add('long_chase', '多头追价限制', historyReady && upper !== null && quote ? quote.price - upper <= chase : null, `距前高不超过 ${signal.maxChaseTicks} tick`, ['open_long']);
            add('short_chase', '空头追价限制', historyReady && lower !== null && quote ? lower - quote.price <= chase : null, `距前低不超过 ${signal.maxChaseTicks} tick`, ['open_short']);
            invalidLong = Boolean(quote && upper !== null && quote.price < upper);
            invalidShort = Boolean(quote && lower !== null && quote.price > lower);
        }
        add('cost', '目标空间 / 成本', longRewardCostRatio === null ? null : longRewardCostRatio + 1e-8 >= signal.minRewardCostRatio, `${show(longRewardCostRatio)}，要求 ≥ ${signal.minRewardCostRatio}；目标 ${signal.takeProfitTicks} tick /（点差 + 手续费及滑点假设 ${signal.roundTripCostTicks} tick）`);
        if (account.direction !== 'flat') {
            const pnl = quote && account.entryPrice !== undefined ? (quote.price - account.entryPrice) / signal.tickSize * (account.direction === 'long' ? 1 : -1) : null;
            add('exit', '持仓退出条件', pnl === null ? null : pnl <= -signal.stopLossTicks || pnl >= signal.takeProfitTicks || (historyReady && (account.direction === 'long' ? invalidLong : invalidShort)), `未计成本浮动 ${show(pnl)} tick；止损 ${signal.stopLossTicks} / 目标 ${signal.takeProfitTicks} tick，或趋势/突破失效；仅提示待确认平仓`, []);
        }
    }
    for (const check of checks)
        check.enforcement = check.actions.length && (['history', 'spread'].includes(check.id) || config.decisionMode !== 'jev') ? 'hard' : 'reference';
    return { evaluatedAt: now, decisionMode: config.decisionMode ?? 'strict', history: { source: history.source, barSeconds: history.barSeconds, count: bars.length,
            ...(bars[0] ? { from: bars[0].time, to: lastBar.time } : {}), ...(history.fetchedAt ? { fetchedAt: history.fetchedAt } : {}), ...(history.issue ? { issue: history.issue } : {}),
            ...(history.warning ? { warning: history.warning } : {}), ...(history.diagnostic ? { diagnostic: history.diagnostic } : {}) },
        features: { quoteCount: samples.length, quoteWindowSeconds: quote && samples[0] ? (quote.time - samples[0].time) / 1000 : 0,
            lower, upper, widthTicks: width !== null && tick ? width / tick : null, lowerTouches, upperTouches, location, reboundTicks, pullbackTicks, spreadTicks, longRewardCostRatio, shortRewardCostRatio }, checks,
        allowedActions: account.allowed.filter(action => !checks.some(check => check.enforcement === 'hard' && check.actions.includes(action) && check.state !== 'pass')) };
}
//# sourceMappingURL=contest-watch-evidence.js.map