import { futuresProduct, futuresContractPattern, futuresProductPattern, products } from "./contest-contract.js";
import { createMessage } from '@deepseek-ai/dsh-llm';
import { credentialRef } from '@deepseek-ai/dsh-credentials';
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { AUTOMATIC_TRADING_CONSENT } from "./trading-execution.js";
import { blocksAutomaticOrder } from "./contest-service.js";
import { planOrderId } from "./contest-fills.js";
import { record, safeData } from "./contest-cli.js";
import { ContestQuotaError } from "./contest-rate-budget.js";
import { translationModels } from "./contest-jev-english.js";
import { jevSettings } from "./contest-jev-settings.js";
import { historyFailure } from "./contest-watch-history.js";
import { FlyRuntime } from "./fly-runtime.js";
import { flyAccount } from "./fly-account.js";
const identitySchema = z.object({ accountId: z.string().min(1), contestId: z.string().min(1) });
export const flyInstrumentSchema = z.object({ product: z.string().trim().regex(futuresProductPattern),
    symbol: z.string().trim().regex(futuresContractPattern), exchange: z.enum(['SHF', 'DCE', 'CZC', 'CFE', 'INE', 'GFE']) })
    .refine(i => futuresProduct(i.symbol) === i.product.toLowerCase(), '品种与实际合约不一致')
    .refine(i => !products.some(p => p.product === i.product.toLowerCase() && p.exchange !== i.exchange), '品种与交易所不一致');
const same = (a, b) => a.accountId === b.accountId && a.contestId === b.contestId;
const rows = (value) => Array.isArray(value) ? value.map(record) : [];
const contract = (value) => String(value ?? '').split('.')[0].toLowerCase();
const day = (time = Date.now()) => new Date(time + 8 * 3600000).toISOString().slice(0, 10).replaceAll('-', '');
const amount = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;
function readFailure(error, source) {
    const { diagnostic } = historyFailure(error, source);
    const raw = error;
    const auth = diagnostic.code === 'AUTH_REQUIRED' || (diagnostic.code !== 'RATE_LIMIT' && /账户.*变化|账户.*切换|请先.*连接|授权|验证账户/.test(raw?.message ?? ''));
    const code = auth ? 'AUTH_REQUIRED' : diagnostic.code, label = source === 'competition' ? '比赛接口' : 'PandaData';
    const retry = Number(raw?.retryAfterSeconds ?? raw?.retry_after);
    const message = error instanceof ContestQuotaError ? error.message : auth ? `${label}需要重新连接或授权，请检查对应设置。`
        : code === 'RATE_LIMIT' ? `${label}限流，冷却后自动重试。` : `${label}读取失败（${code}），稍后重试。`;
    return Object.assign(new Error(message), { source, code, retryable: !auth && diagnostic.retryable,
        ...(Number.isFinite(retry) && retry > 0 ? { retryAfterSeconds: Math.min(86400, retry) } : {}) });
}
/** Only classify private provider details; never echo response bodies or URLs. */
export function modelFailure(error) {
    const value = error;
    const text = `${value?.code ?? ''} ${value?.status ?? value?.statusCode ?? ''} ${value?.name ?? ''} ${value?.message ?? ''}`;
    const [code, retryable, message] = /timeout|timed?out|ETIMEDOUT|超时/i.test(text)
        ? ['MODEL_TIMEOUT', true, '模型响应超时（60 秒），下一轮行情重新判断。']
        : /429|rate.limit|限流|频率/i.test(text) ? ['MODEL_RATE_LIMIT', true, '模型服务限流，下一轮行情重试。']
            : /401|403|unauthori|forbidden|authentication|token.*expir/i.test(text) ? ['MODEL_AUTH', false, '模型服务拒绝访问，请检查模型密钥、权限与额度。']
                : /OUTPUT_LIMIT|context.length|max.tokens/i.test(text) ? ['MODEL_OUTPUT_LIMIT', false, '模型输出不完整或超过长度限制，本轮不生成交易决策。']
                    : /MODEL_CONFIG|已验证|JSON/.test(text) ? ['MODEL_CONFIG', false, '请选择已验证的 QuantStudio 模型。']
                        : /AbortError|aborted|cancel/i.test(text) ? ['MODEL_CANCELLED', true, '模型请求已取消，等待下一轮行情。']
                            : /network|fetch failed|ECONN|ENOTFOUND/i.test(text) ? ['MODEL_NETWORK', true, '模型服务连接失败，下一轮行情重试。']
                                : ['MODEL_FAILED', true, '模型调用失败，请检查已验证模型配置与用量。'];
    return Object.assign(new Error(message), { source: 'model', code, retryable });
}
export function flyQuoteTime(value) {
    let text = String(value ?? '').trim().replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2})(\d{2})(\d{2})$/, '$1T$2:$3:$4');
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(text))
        text = text.replace(' ', 'T') + '+08:00';
    return Date.parse(text);
}
// Reference margin is an estimate; the competition dry-run remains authoritative.
function marginPerLot(spec, price, side) {
    const margin = record(spec.margin), ratio = amount(margin[`${side}MarginRatioByMoney`]), fixed = amount(margin[`${side}MarginByVolume`]);
    const multiplier = amount(spec.contractMultiplier);
    if (ratio === null || fixed === null || multiplier === null || ratio < 0 || fixed < 0 || multiplier <= 0 || !Number.isFinite(price) || price <= 0)
        return null;
    const value = price * multiplier * ratio + fixed;
    return Number.isFinite(value) && value > 0 ? value : null;
}
export class FlyService {
    ctx;
    contest;
    watcherRunning;
    runtime;
    specs = new Map();
    history = new Map();
    observation;
    proposalTail = Promise.resolve();
    riskTail = Promise.resolve();
    reconciled = new Map();
    constructor(ctx, contest, root, watcherRunning) {
        this.ctx = ctx;
        this.contest = contest;
        this.watcherRunning = watcherRunning;
        this.runtime = new FlyRuntime(root, (path, body, signal) => this.callback(path, body, signal));
    }
    async request(input) {
        if (input.path === 'control' && ['trade', 'close_only'].includes(String(record(input.body).action)) && await this.watcherRunning()) {
            throw new Error('请先停止 Jev 盯盘，再启动AI 交易员。');
        }
        if (input.path === 'control' && record(input.body).action === 'restore') {
            const state = record(await this.runtime.request({ path: 'state' })), binding = record(state.binding);
            if (binding.identity) {
                const identity = await this.identity(binding.identity);
                const snapshot = await this.contest.inspect(identity);
                if (snapshot.pendingPlans.length || rows(snapshot.openOrders.data).length || rows(snapshot.positions.data).some(p => Number(p.volume ?? p.position) > 0)) {
                    throw new Error('请先处理当前持仓、委托和待确认计划，再恢复检查点。');
                }
            }
        }
        return this.runtime.request(input);
    }
    async isTrading() {
        if (!(await this.runtime.status()).installed)
            return false;
        const state = record(await this.runtime.request({ path: 'state' }));
        return record(state.control).trading === true;
    }
    async identity(expected, verify = true) {
        const status = await this.contest.status();
        if (!status.enabled || !status.identity)
            throw new Error('请先在比赛页连接自己的期货模拟赛账户。');
        if (expected && !same(identitySchema.parse(expected), status.identity))
            throw new Error('比赛账户已变化，请切回 AI 交易员绑定账户。');
        if (status.phase !== 'connected') {
            if (!expected)
                throw new Error('请先在比赛页连接自己的期货模拟赛账户。');
            await this.contest.resume(status.identity);
        }
        if (verify)
            await this.contest.researchIdentity(status.identity);
        return status.identity;
    }
    async spec(symbol, identity, signal) {
        const key = `${identity.contestId}:${identity.accountId}:${symbol.toLowerCase()}`, cached = this.specs.get(key);
        if (cached && Date.now() - cached.at < 3600000)
            return cached.value;
        const value = record((await this.contest.contractSpec(symbol, identity, signal)).data);
        if (value.symbol && contract(value.symbol) !== contract(symbol))
            throw new Error('合约规格返回了不同合约。');
        this.specs.set(key, { at: Date.now(), value });
        return value;
    }
    async callback(path, raw, signal) {
        const input = record(raw);
        if (path === 'models') {
            const jev = await jevSettings(this.ctx);
            return { profiles: translationModels(this.ctx).map(route => ({ id: JSON.stringify(route), provider_id: JSON.stringify(route),
                    label: `${route.provider} / ${route.model}`, configured: true })), jev_configured: jev.configured,
                jev_providers: [{ id: 'typesafe', label: 'TypeSafe · 统一模型服务', model: jev.model, configured: jev.configured }] };
        }
        if (path === 'language')
            return this.language(input, signal).catch(error => { throw modelFailure(error); });
        if (path === 'jev')
            return this.jev(input, signal);
        if (path === 'market')
            return this.market(input, signal).catch(error => { delete this.observation; throw readFailure(error, 'competition'); });
        if (path === 'history')
            return this.bars(input, signal).catch(error => {
                if (error.source === 'competition')
                    throw error;
                throw readFailure(error, 'pandadata');
            });
        if (path === 'prepare') {
            const job = this.proposalTail.catch(() => { }).then(() => this.prepare(input, signal));
            this.proposalTail = job;
            return safeData(await job);
        }
        if (path === 'trade') {
            const job = this.proposalTail.catch(() => { }).then(() => this.trade(input, signal));
            this.proposalTail = job;
            return job;
        }
        throw new Error('AI 交易员桥接不支持此操作。');
    }
    async market(input, signal) {
        const identity = await this.identity(input.identity, false), instruments = z.array(flyInstrumentSchema).max(1000).refine(items => new Set(items.map(i => i.product.toLowerCase())).size === items.length, '每个品种只能配置一个实际合约').parse(input.instruments);
        // Continue receipt recovery with the page closed. Never re-submit an order.
        const plans = (await this.contest.status()).plans;
        const pending = plans.filter(plan => plan.sessionId.startsWith('fly:') && same(plan.identity, identity)
            && ['executing', 'queued', 'submitted', 'unknown', 'partial', 'completed'].includes(plan.status)
            && Date.now() - (this.reconciled.get(plan.id) ?? 0) > 60000
            && (plan.status !== 'completed' || !plan.fills?.length))
            .sort((a, b) => (this.reconciled.get(a.id) ?? 0) - (this.reconciled.get(b.id) ?? 0))[0];
        if (pending) {
            this.reconciled.set(pending.id, Date.now());
            await this.contest.reconcile(pending.id, pending.sessionId).catch(() => { });
        }
        if (!this.observation || !same(this.observation.identity, identity) || Date.now() - this.observation.at >= 30000) {
            const snapshot = await this.contest.observe(identity, signal);
            // Recent fills include earlier opening legs so their billed costs survive
            // the night-session rollover. This replaces the existing query, no extra poll.
            const trades = rows((await this.contest.query({ kind: 'trades' }, identity, signal)).data);
            this.observation = { identity, snapshot, trades, at: Date.now() };
        }
        const { snapshot, trades } = this.observation;
        const account = record(snapshot.account.data), positions = rows(snapshot.positions.data);
        const { official, knownDay } = flyAccount(account, day(snapshot.fetchedAt));
        const fees = official.Commission, equity = official.Balance;
        if (equity !== null && equity > 0)
            await this.equityPeak(identity, equity);
        const notionals = positions.map(p => amount(p.openMarketValue));
        const occupied = notionals.every(n => n !== null && n >= 0) ? notionals.reduce((sum, n) => sum + n, 0) : null;
        const feeds = {};
        for (const instrument of instruments) {
            const quote = record((await this.contest.query({ kind: 'quote', symbol: instrument.symbol }, identity, signal)).data);
            const spec = await this.spec(instrument.symbol, identity, signal), at = flyQuoteTime(quote.quoteTime);
            const matching = positions.filter(p => contract(p.contractCode) === contract(instrument.symbol));
            const quantity = (direction) => matching.filter(p => p.direction === direction).reduce((sum, p) => sum + Number(p.volume ?? p.position ?? 0), 0);
            feeds[instrument.product] = { symbol: instrument.symbol, price: Number(quote.latestPrice) || 0,
                at: Date.now() / 1000, quote_at: quote.ready !== false && contract(quote.contractCode ?? quote.symbol) === contract(instrument.symbol) && Number.isFinite(at) ? at / 1000 : 0,
                multiplier: Number(spec.contractMultiplier) || 0, long: quantity('long'), short: quantity('short'),
                occupied_notional: occupied,
                sizing: Object.fromEntries(['long', 'short'].map(side => {
                    const margin = marginPerLot(spec, Number(quote.latestPrice), side), available = amount(account.availableFunds);
                    // Reserve 10% for costs and price changes; share capital among selected instruments.
                    const capacity = margin !== null && available !== null && equity !== null && equity > 0
                        ? Math.max(0, Math.min(500, quantity(side) + Math.floor(Math.max(0, available) * .9 / margin), Math.floor(equity * .9 / instruments.length / margin))) : null;
                    return [`${side}_capacity`, capacity];
                })),
                inflight: snapshot.pendingPlans.some(plan => !(plan.status === 'prepared' && plan.details.executionMode === 'automatic') && blocksAutomaticOrder(plan, instrument.symbol))
                    || rows(snapshot.openOrders.data).some(order => !order.contractCode || contract(order.contractCode) === contract(instrument.symbol)) };
        }
        await this.identity(identity, false);
        return safeData({ identity, feeds, plans: (await this.contest.status()).plans,
            account: { official, trading_account_id: identity.accountId, day_source: knownDay ? 'official' : 'observation',
                official_updated_at: new Date(snapshot.fetchedAt).toISOString(),
                // Fee coverage/cashflow are required for causal account rewards; missing is not zero.
                official_sync: { stale: equity === null },
                reward_evidence_complete: knownDay && fees !== null && official.Deposit !== null && official.Withdraw !== null && trades.length < 200,
                official_positions: positions, trades: trades.map(t => ({ ...t, symbol: t.contractCode, trade_id: t.tradeId,
                    order_id: t.orderId, trading_day: String(t.tradingDay ?? t.tradeTime ?? '').slice(0, 10).replaceAll('-', '') })),
                engine: { state: 'TRADING_READY' } } });
    }
    async bars(input, signal) {
        await this.identity(input.identity, false).catch(error => { throw readFailure(error, 'competition'); });
        const instrument = flyInstrumentSchema.parse(input.instrument), minutes = z.union([z.literal(1), z.literal(5)]).parse(input.minutes);
        const gateway = this.ctx.get('pandaMcp');
        if (!gateway)
            throw new Error('请先在设置中连接 PandaData。');
        const since = input.since === undefined ? undefined : z.string().datetime({ offset: true }).parse(input.since);
        if (since && (Date.parse(since) > Date.now() || Date.parse(since) < Date.now() - 366 * 86400000))
            throw new Error('历史增量起点无效');
        const start = since ? day(Date.parse(since)) : day(Date.now() - minutes * 7 * 86400000), end = day(Date.now() + 3 * 86400000);
        const symbol = `${instrument.symbol.toUpperCase()}.${instrument.exchange}`, key = `${symbol}:${minutes}:${start}:${end}`;
        let id = this.history.get(key);
        if (!id) {
            const params = { symbol, start_date: start, end_date: end,
                frequency: `${minutes}m`, fields: ['symbol', 'trading_code', 'datetime', 'open', 'high', 'low', 'close', 'volume'] };
            const existing = (await gateway.databaseList(signal)).find(item => (`AI 交易员 ${key}` === item.name || `果蝇 ${key}` === item.name) && item.source.kind === 'pandadata');
            const dataset = existing ?? await gateway.databaseFetch({ name: `AI 交易员 ${key}`, kind: 'timeseries', category: 'market',
                dateColumn: 'datetime', ttlSeconds: minutes * 60, source: { kind: 'pandadata', method: 'get_future_min', params } }, signal);
            id = dataset.id;
            this.history.set(key, id);
        }
        let result = await gateway.databaseQuery({ id, limit: 5000, refresh: true }, signal);
        // refresh:true only refreshes expired datasets. A cache fetched just before
        // publication can still omit the latest completed bar for an entire TTL.
        // Probe at most every 30 seconds, without changing the native bar period.
        const expectedClose = Math.floor(Date.now() / (minutes * 60000)) * minutes * 60000;
        const latestClose = result.dataset.to ? flyQuoteTime(result.dataset.to) : Math.max(0, ...result.rows
            .filter(row => contract(row.trading_code ?? row.symbol) === contract(instrument.symbol))
            .map(row => flyQuoteTime(row.datetime)).filter(Number.isFinite));
        if (result.status === 'hit' && Date.now() - Date.parse(result.dataset.fetchedAt) >= 30000 && latestClose < expectedClose) {
            await gateway.databaseRefresh({ id }, signal);
            result = await gateway.databaseQuery({ id, limit: 5000, refresh: false }, signal);
        }
        if (result.status === 'insufficient')
            throw new Error('PandaData 历史尚未完整或已过期。');
        if (result.total > 50000)
            throw new Error('历史窗口过大，请缩小日期范围。');
        const data = [...result.rows];
        while (result.nextOffset !== undefined) {
            result = await gateway.databaseQuery({ id, limit: 5000, offset: result.nextOffset, refresh: false }, signal);
            if (result.status === 'insufficient')
                throw new Error('历史读取过程中缓存已变化。');
            data.push(...result.rows);
        }
        const now = Date.now(), seen = new Map();
        for (const row of data) {
            const at = flyQuoteTime(row.datetime);
            if (!Number.isFinite(at) || at > now || contract(row.trading_code ?? row.symbol) !== contract(instrument.symbol))
                continue;
            const ohlc = ['open', 'high', 'low', 'close'].map(key => Number(row[key]));
            if (ohlc.some(value => !Number.isFinite(value) || value <= 0))
                throw new Error('历史行情价格无效。');
            const bar = { datetime: new Date(at - minutes * 60000).toISOString(), open: ohlc[0], high: ohlc[1], low: ohlc[2], close: ohlc[3], volume: Number(row.volume) };
            if (!Number.isFinite(bar.volume) || bar.volume < 0)
                throw new Error('历史行情成交量无效。');
            if (seen.has(at) && JSON.stringify(seen.get(at)) !== JSON.stringify(bar))
                throw new Error('历史行情存在冲突的重复时间。');
            seen.set(at, bar);
        }
        await this.identity(input.identity, false).catch(error => { throw readFailure(error, 'competition'); });
        return { bars: [...seen.entries()].sort((a, b) => a[0] - b[0]).slice(-500).map(([, bar]) => bar), fetched_at: Date.parse(result.dataset.fetchedAt) / 1000 };
    }
    async tradingRun(input, mode) {
        const state = record(await this.runtime.request({ path: 'state' })), control = record(state.control), settings = record(state.settings);
        if (control.trading !== true || control.paused !== false || control.execution !== mode || (settings.execution_mode ?? 'automatic') !== mode || !input.run_id || control.run_id !== input.run_id) {
            throw new Error('自动交易已暂停或本轮已结束，请在 AI 交易员中启动新一轮。');
        }
        if (mode === 'automatic' && (record(control.authorization).version !== AUTOMATIC_TRADING_CONSENT || record(control.authorization).run_id !== control.run_id))
            throw new Error('本轮自动下单风险尚未确认。');
        if (!same(identitySchema.parse(record(state.binding).identity), identitySchema.parse(input.identity)))
            throw new Error('比赛账户已变化。');
        const instrument = flyInstrumentSchema.parse(input.instrument);
        if (!rows(settings.instruments).some(item => item.exchange === instrument.exchange && contract(item.symbol) === contract(instrument.symbol)))
            throw new Error('合约未加入本轮自动交易。');
        const limits = record(input.limits);
        if (limits.target !== settings.target_notional || limits.total !== settings.total_notional || limits.loss !== settings.loss_limit)
            throw new Error('交易额度已变化，等待新的决策。');
        const decision = record(input.decision), engine = settings.decision_engine ?? 'neural';
        const config = record(decision.engine_config);
        if (engine !== (decision.engine ?? 'neural'))
            throw new Error('决策引擎已变化，等待新的决策。');
        if (engine === 'llm') {
            if (decision.run_id !== control.run_id || record(decision.choice).readout !== 'llm-trade-1'
                || ['decision_engine', 'trade_model', 'trade_instructions', 'llm_max_lots'].some(key => config[key] !== settings[key]))
                throw new Error('模型或交易要求已变化，等待新的决策。');
            const current = Number(record(decision.choice).current_position), target = Number(record(decision.choice).target_position);
            const reducing = current * target >= 0 && Math.abs(target) < Math.abs(current);
            if (!reducing && (!Number.isInteger(settings.llm_max_lots) || Math.abs(target) > Number(settings.llm_max_lots)))
                throw new Error('超过大模型单合约持仓手数上限。');
        }
        else if (record(decision.choice).readout !== 'neural-trade-3')
            throw new Error('决策来源与运行引擎不一致。');
        const choice = record(record(input.decision).choice), current = Number(choice.current_position), target = Number(choice.target_position);
        if (control.close_only && !(current && (current * target <= 0 || Math.abs(target) < Math.abs(current))))
            throw new Error('当前仅允许自动平仓。');
        if (await this.watcherRunning())
            throw new Error('Jev 盯盘正在运行，请先停止。');
    }
    async trade(input, signal) {
        const identity = await this.identity(input.identity);
        const decisionId = z.string().regex(/^[a-f0-9]{32}$/).parse(record(input.decision).decision_id);
        const sessionId = `fly:${decisionId}`;
        const mode = z.enum(['manual', 'automatic']).parse(input.execution_mode ?? 'automatic');
        // A repeated callback (including after a lost reply) returns the same receipt, never a new order.
        const prior = (await this.contest.status()).plans.find(plan => plan.sessionId === sessionId && same(plan.identity, identity));
        if (prior) {
            if (prior.status === 'prepared' && prior.details.executionMode === 'automatic') {
                await this.contest.dismiss(prior.id, sessionId);
                return safeData({ ...prior, status: 'cancelled' });
            }
            return safeData(prior);
        }
        await this.tradingRun(input, mode);
        // This callback queue has finished all earlier submissions. A leftover draft was never sent.
        // Discard it instead of leaving a restarted trader blocked by an obsolete signal.
        for (const draft of (await this.contest.status()).plans) {
            if (draft.status === 'prepared' && draft.details.executionMode === 'automatic'
                && draft.sessionId.startsWith('fly:') && same(draft.identity, identity))
                await this.contest.dismiss(draft.id, draft.sessionId);
        }
        const plan = await this.prepare(input, signal, mode === 'automatic', true);
        try {
            signal.throwIfAborted();
            await this.tradingRun(input, mode);
            if (mode === 'manual')
                return safeData(plan);
            const result = await this.contest.execute(plan.id, plan.sessionId, async () => {
                signal.throwIfAborted();
                await this.tradingRun(input, mode);
                if (Date.now() / 1000 - Number(record(input.decision).input_at) > (record(input.decision).engine === 'llm' ? 90 : 15))
                    throw new Error('交易信号已过期，等待新的决策。');
            });
            return safeData(result);
        }
        catch (error) {
            // Dismiss only an unsubmitted draft. Executing/unknown receipts remain available for recovery.
            await this.contest.dismiss(plan.id, plan.sessionId).catch(() => { });
            throw error;
        }
        finally {
            delete this.observation;
        }
    }
    async prepare(input, signal, automatic = false, validatedRun = false) {
        const identity = await this.identity(input.identity), instrument = flyInstrumentSchema.parse(input.instrument);
        if (await this.watcherRunning())
            throw new Error('Jev 盯盘正在运行，请先停止再生成 AI 交易员计划。');
        const decision = z.object({ decision_id: z.string().regex(/^[a-f0-9]{32}$/), input_at: z.number(), symbol: z.string(),
            choice: z.object({ action: z.enum(['LONG', 'SHORT', 'CLOSE']), readout: z.enum(['neural-trade-3', 'llm-trade-1']), sampling: z.literal(false), current_position: z.number().int(), target_position: z.number().int().min(-500).max(500) }) }).parse(input.decision);
        const maxAge = decision.choice.readout === 'llm-trade-1' ? 90 : 15;
        if (decision.choice.readout === 'llm-trade-1' && !validatedRun)
            throw new Error('大模型交易需要有效的交易运行。');
        if (contract(decision.symbol) !== contract(instrument.symbol) || Date.now() / 1000 - decision.input_at < 0 || Date.now() / 1000 - decision.input_at > maxAge)
            throw new Error('交易信号已过期或合约不一致。');
        const limits = z.object({ target: z.number().nonnegative().max(100000000), total: z.number().nonnegative().max(500000000), loss: z.number().nonnegative().max(100000000) }).parse(input.limits);
        const snapshot = await this.contest.inspect(identity, signal);
        if (snapshot.pendingPlans.some(plan => !automatic || blocksAutomaticOrder(plan, instrument.symbol))
            || rows(snapshot.openOrders.data).some(order => !automatic || !order.contractCode || contract(order.contractCode) === contract(instrument.symbol)))
            throw new Error('请先处理账户的待确认计划或活动委托。');
        const positions = rows(snapshot.positions.data), matching = positions.filter(p => contract(p.contractCode) === contract(instrument.symbol));
        if (matching.length > 1)
            throw new Error('存在双向或重复持仓，请先核对。');
        const held = matching[0];
        if (held && !['long', 'short'].includes(String(held.direction)))
            throw new Error('没有可核对的持仓方向。');
        const current = held ? Number(held.volume ?? held.position) * (held.direction === 'long' ? 1 : -1) : 0;
        if (!Number.isInteger(current) || current !== decision.choice.current_position)
            throw new Error('持仓已变化，等待新的仓位决策。');
        const target = decision.choice.target_position;
        if ((decision.choice.action === 'CLOSE' && target !== 0) || (target > 0 && decision.choice.action !== 'LONG') || (target < 0 && decision.choice.action !== 'SHORT'))
            throw new Error('目标仓位与交易方向不一致。');
        // Reversals only close the old side. Opening requires a new decision after fills.
        const reversing = current * target < 0;
        const delta = reversing ? -current : target - current;
        const opening = current === 0 || (!reversing && Math.abs(target) > Math.abs(current));
        const volume = Math.abs(delta);
        if (!Number.isInteger(volume) || volume < 1 || volume > 500)
            throw new Error('目标仓位未变化或调整手数超过上限。');
        if (!opening && (!held || !Number.isInteger(Number(held.closable ?? held.sellable)) || Number(held.closable ?? held.sellable) < volume))
            throw new Error('可平手数不足，等待持仓更新。');
        const quote = record((await this.contest.query({ kind: 'quote', symbol: instrument.symbol }, identity, signal)).data);
        const price = Number(quote.latestPrice), quoteAt = flyQuoteTime(quote.quoteTime), spec = await this.spec(instrument.symbol, identity, signal);
        const multiplier = Number(spec.contractMultiplier);
        if (quote.ready === false || contract(quote.contractCode ?? quote.symbol) !== contract(instrument.symbol) || !Number.isFinite(quoteAt) || Date.now() - quoteAt > 10000 || quoteAt > Date.now() + 1000 || !(price > 0 && multiplier > 0))
            throw new Error('新鲜报价或合约乘数不可用。');
        const account = record(snapshot.account.data), equity = amount(account.totalProfit ?? account.equity ?? account.balance ?? account.Balance);
        if (equity === null)
            throw new Error('账户权益不可用。');
        if (!Number.isFinite(equity) || equity <= 0)
            throw new Error('账户权益不可用。');
        const peak = await this.equityPeak(identity, equity);
        if (opening && limits.loss > 0 && peak - equity >= limits.loss)
            throw new Error('账户权益回落达到设置上限，仅允许平仓计划。');
        if (opening) {
            const margin = marginPerLot(spec, price, target > 0 ? 'long' : 'short'), available = amount(account.availableFunds);
            if (margin === null)
                throw new Error('比赛合约保证金数据不完整，等待更新。');
            if (available === null || volume * margin > Math.max(0, available) * .9)
                throw new Error('可用资金不足，等待新的仓位决策。');
            if (limits.target > 0 && price * multiplier * Math.abs(target) > limits.target)
                throw new Error('超过每品种名义上限。');
            if (limits.total > 0) {
                let occupied = 0;
                for (const position of positions) {
                    const value = amount(position.openMarketValue);
                    if (value === null || value < 0)
                        throw new Error('已有持仓名义占用不完整，不能追加开仓。');
                    occupied += value;
                }
                if (automatic) {
                    // Reserve the whole outstanding opening order until its receipt is reconciled.
                    // The next contract must not spend the same user-defined notional budget again.
                    const pending = snapshot.pendingPlans.filter(plan => ['queued', 'submitted'].includes(plan.status));
                    const pendingIds = new Set(pending.map(planOrderId).filter(Boolean));
                    const reservations = [...pending.map(plan => record(plan.details.parameters)),
                        ...rows(snapshot.openOrders.data).filter(order => !pendingIds.has(String(order.orderId ?? '')))];
                    for (const order of reservations) {
                        if (order.offset === 'close')
                            continue;
                        if (order.offset !== 'open' || !order.contractCode)
                            throw new Error('活动委托的名义占用不完整，等待回执更新。');
                        const symbol = contract(order.contractCode), volume = Number(order.volume);
                        const pendingQuote = record((await this.contest.query({ kind: 'quote', symbol }, identity, signal)).data);
                        const pendingSpec = await this.spec(symbol, identity, signal);
                        const notional = Number(pendingQuote.latestPrice) * Number(pendingSpec.contractMultiplier) * volume;
                        if (!Number.isFinite(notional) || notional <= 0 || !Number.isInteger(volume))
                            throw new Error('活动委托的名义占用不完整，等待回执更新。');
                        occupied += notional;
                    }
                }
                if (occupied + price * multiplier * volume > limits.total)
                    throw new Error('超过总名义占用额度。');
            }
        }
        if (Date.now() / 1000 - decision.input_at > maxAge)
            throw new Error('核对耗时较长，等待新的交易决策。');
        return this.contest.prepare({ sessionId: `fly:${decision.decision_id}`, operation: 'place_order', order: {
                symbol: instrument.symbol, direction: delta > 0 ? 'buy' : 'sell',
                offset: opening ? 'open' : 'close', volume
            } }, identity, signal, automatic ? 'automatic' : 'manual');
    }
    equityPeak(identity, equity) {
        const job = this.riskTail.catch(() => { }).then(async () => {
            const riskPath = join(this.runtime.root, 'risk.json');
            const prior = await readFile(riskPath, 'utf8').then(text => JSON.parse(text), error => {
                if (error.code === 'ENOENT')
                    return { identity, peak: equity };
                throw error;
            });
            if (!same(prior.identity, identity) || !Number.isFinite(prior.peak))
                throw new Error('风险记录与账户不匹配。');
            const peak = Math.max(prior.peak, equity);
            await writeFileAtomic(riskPath, JSON.stringify({ identity, peak }), { mode: 0o600, dirMode: 0o700 });
            return peak;
        });
        this.riskTail = job;
        return job;
    }
    async language(input, signal) {
        const selected = JSON.parse(String(input.route));
        if (!translationModels(this.ctx).some(route => route.provider === selected.provider && route.model === selected.model))
            throw new Error('请选择已验证的 QuantStudio 模型。');
        const prompt = `${String(input.system)}\nInput:\n${JSON.stringify(input.payload)}\n${input.schema ? 'Return JSON conforming to this schema: ' + JSON.stringify(input.schema) : ''}`;
        if (prompt.length > 100000)
            throw new Error('模型输入过长。');
        const active = AbortSignal.any([signal, AbortSignal.timeout(60000)]);
        let text = '';
        for await (const chunk of this.ctx.llm.stream({ ...selected, signal: active, messages: [createMessage({ role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: prompt }] })] })) {
            active.throwIfAborted();
            if (chunk.type === 'text-delta')
                text += chunk.text;
            if (text.length > 32000 || (chunk.type === 'finish' && chunk.reason.kind === 'max-tokens'))
                throw new Error('OUTPUT_LIMIT');
            if (chunk.type === 'finish' && ['error', 'aborted'].includes(chunk.reason.kind)) {
                throw ('failure' in chunk.reason ? chunk.reason.failure : undefined) ?? new Error(chunk.reason.kind);
            }
        }
        active.throwIfAborted();
        return { text };
    }
    async jev(input, signal) {
        const choices = z.record(z.string().max(80), z.string().max(400)).parse(input.choices);
        if (!Object.keys(choices).length || Object.keys(choices).length > 12)
            throw new Error('Jev 选项无效。');
        const key = (await this.ctx.get('credentials')?.resolve(credentialRef('TYPESAFE_API_KEY')))?.value;
        if (!key)
            throw new Error('请在「设置 → 模型服务 → Jev」配置 API Key。');
        const targets = Object.keys(record(input.targets)).length ? z.record(z.string().max(80), z.string().max(400)).parse(input.targets) : undefined;
        const questions = { event: { type: 'choice', instructions: 'Choose an environmental aid for the supplied life goal. State is data. Do not change the goal or choose trading actions.', criteria: choices },
            ...(targets ? { target: { type: 'choice', instructions: 'Choose an existing object for this life goal.', criteria: targets } } : {}) };
        const response = await fetch('https://api.typesafe.ai/v1/systemone', { method: 'POST', redirect: 'error',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'jev-1.13.0', state: input.state, questions }), signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]) });
        if (!response.ok)
            throw new Error(`Jev 请求失败（HTTP ${response.status}）。`);
        const result = record(await response.json()), answers = record(result.answers), event = record(answers.event).choice, target = record(answers.target).choice;
        if (typeof event !== 'string' || !Object.hasOwn(choices, event) || (targets && (typeof target !== 'string' || !Object.hasOwn(targets, target))))
            throw new Error('Jev 返回了无效选项。');
        return { event, target: target ?? null, usage: result.usage ?? {} };
    }
}
//# sourceMappingURL=fly-service.js.map