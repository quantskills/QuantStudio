/** Opt-in contest lifecycle and durable, single-use confirmation plans. */
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write';
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths';
import { z } from 'zod';
import { ContestCliError, record, transientContestCodes, versionAtLeast } from "./contest-cli.js";
import { contestFillSchema, mergePlanFills, planOrderId } from "./contest-fills.js";
import { contestContractParts, futuresContractPattern, sameContestContract } from "./contest-contract.js";
const identitySchema = z.object({ accountId: z.string().min(1), contestId: z.string().min(1) });
const planSchema = z.object({
    id: z.string().min(1), sessionId: z.string().min(1), identity: identitySchema,
    operation: z.enum(['place_order', 'cancel_order']), createdAt: z.number(), expiresAt: z.number(),
    summary: z.string(), details: z.record(z.string(), z.json()), clientRequestId: z.string().uuid(),
    status: z.enum(['prepared', 'executing', 'queued', 'submitted', 'completed', 'partial', 'failed', 'expired', 'unknown', 'cancelled']),
    operationId: z.string().optional(), result: z.record(z.string(), z.json()).optional(),
    fills: z.array(contestFillSchema).optional(),
});
const stateSchema = z.object({
    enabled: z.boolean(), runtime: z.string().uuid().optional(), version: z.string().optional(),
    identity: identitySchema.optional(), plans: z.array(planSchema).max(1000),
});
const openStates = new Set(['executing', 'queued', 'submitted', 'unknown']);
const operationStates = new Set(['queued', 'submitted', 'completed', 'partial', 'failed', 'expired', 'unknown']);
const orderSchema = z.object({
    symbol: z.string().trim().min(1).max(32).regex(/^[\p{Script=Han}a-zA-Z0-9]+$/u),
    direction: z.enum(['buy', 'sell']), offset: z.enum(['open', 'close']),
    volume: z.number().int().positive().max(100000), price: z.number().finite().positive().optional(),
}).strict();
export function sameContest(a, b) {
    return a !== undefined && b !== undefined && a.accountId === b.accountId && a.contestId === b.contestId;
}
export function contestQueryArgs(input) {
    const query = z.object({ kind: z.enum(['account', 'positions', 'open-orders', 'orders', 'trades', 'ranking', 'ranking-me', 'settlements', 'quote', 'varieties']),
        symbol: z.string().trim().min(1).max(32).regex(/^[\p{Script=Han}a-zA-Z0-9]+$/u).optional(),
        date: z.string().regex(/^(today|\d{4}-\d{2}-\d{2})$/).optional(), lastId: z.string().regex(/^\d+$/).optional(), board: z.enum(['live', 'settled']).optional(),
    }).strict().parse(input);
    if (query.kind === 'quote') {
        if (!query.symbol)
            throw new Error('请输入一个明确品种或实际合约。');
        return ['quote', query.symbol];
    }
    if (query.kind === 'open-orders')
        return ['orders', '--status', 'open', '--count', '200'];
    const args = [query.kind];
    if (query.kind === 'ranking' || query.kind === 'ranking-me')
        args.push('--board-type', query.board ?? 'live');
    if (query.kind === 'orders' || query.kind === 'trades') {
        args.push('--count', '50');
        if (query.date)
            args.push('--date', query.date);
        if (query.lastId)
            args.push('--last-id', query.lastId);
    }
    return args;
}
export class ContestService {
    cli;
    root;
    state = { enabled: false, plans: [] };
    loaded;
    tail = Promise.resolve();
    saving = Promise.resolve();
    controller = new AbortController();
    phase = 'disconnected';
    message = '';
    latestVersion;
    ready = false;
    generation = 0;
    currentRules = '';
    lastInspection;
    checkingUpdate;
    constructor(cli, dshHome) {
        this.cli = cli;
        this.root = join(resolveDshHome(dshHome), 'quantskills', 'contest');
    }
    load() {
        return this.loaded ??= (async () => {
            try {
                const text = await readFile(join(this.root, 'state.json'), 'utf8');
                if (text.length > 4 * 1024 * 1024)
                    throw new Error('比赛记录超过大小限制。');
                this.state = stateSchema.parse(JSON.parse(text));
                for (const plan of this.state.plans)
                    if (plan.status === 'executing')
                        plan.status = 'unknown';
            }
            catch (error) {
                if (record(error).code !== 'ENOENT')
                    throw error;
            }
        })();
    }
    save() {
        const content = JSON.stringify(this.state);
        const next = this.saving.catch(() => { }).then(() => writeFileAtomic(join(this.root, 'state.json'), content, { mode: 0o600, dirMode: 0o700 }));
        this.saving = next;
        return next;
    }
    exclusive(work) {
        const next = this.tail.catch(() => { }).then(async () => { await this.load(); return work(); });
        this.tail = next;
        return next;
    }
    assertEnabled() {
        if (!this.state.enabled)
            throw new Error('比赛模式已关闭，请在比赛页开启。');
    }
    runtime() {
        if (!this.state.runtime)
            throw new Error('请先连接比赛，完成 CLI 安装与授权。');
        return join(this.root, 'runtimes', this.state.runtime);
    }
    async run(args, signal) {
        this.assertEnabled();
        const generation = this.generation;
        const active = signal ? AbortSignal.any([this.controller.signal, signal]) : this.controller.signal;
        active.throwIfAborted();
        const result = await this.cli.run(this.runtime(), args, active);
        if (generation !== this.generation)
            throw new Error('比赛模式已切换，本次操作已中止。');
        active.throwIfAborted();
        this.assertEnabled();
        return result;
    }
    async status(sessionId) {
        await this.load();
        const plans = this.state.plans.filter(plan => (!sessionId || plan.sessionId === sessionId) && sameContest(plan.identity, this.state.identity))
            .map(plan => ({ ...plan, status: plan.status === 'prepared' && plan.expiresAt <= Date.now() ? 'expired' : plan.status }));
        return structuredClone({ enabled: this.state.enabled, phase: this.state.enabled ? this.phase : 'off',
            ...(this.state.version ? { cliVersion: this.state.version } : {}), ...(this.latestVersion ? { latestVersion: this.latestVersion } : {}),
            updateAvailable: Boolean(this.latestVersion && this.state.version && !versionAtLeast(this.state.version, this.latestVersion)),
            ...(this.state.identity ? { identity: this.state.identity } : {}), message: this.message, plans });
    }
    async setEnabled(enabled) {
        if (typeof enabled !== 'boolean')
            throw new Error('比赛模式开关无效。');
        await this.load();
        if (enabled === this.state.enabled)
            return this.status();
        this.state.enabled = enabled;
        this.generation++;
        this.ready = false;
        delete this.lastInspection;
        this.controller.abort();
        this.controller = new AbortController();
        for (const plan of this.state.plans)
            if (plan.status === 'prepared')
                plan.status = 'cancelled';
        this.phase = 'disconnected';
        this.message = enabled ? '点击连接比赛完成授权。' : '比赛模式已关闭。已提交的委托继续由赛事柜台处理，可在官网查看。';
        await this.save();
        return this.status();
    }
    async connect() {
        return this.exclusive(async () => {
            this.assertEnabled();
            const generation = this.generation;
            try {
                if (!this.state.runtime)
                    await this.install();
                let me;
                try {
                    me = record((await this.run(['whoami'])).data);
                }
                catch (error) {
                    if (!(error instanceof ContestCliError) || !['login_required', 'unauthorized', 'invalid_grant', 'token_expired'].includes(error.code))
                        throw error;
                    me = { loggedIn: false };
                }
                if (me.loggedIn !== true) {
                    this.phase = 'authenticating';
                    this.message = '请在打开的 PandaAI 官网完成登录和授权。';
                    await this.run(['login']);
                }
                await this.validateIdentity();
                await this.refreshFills().catch(() => { });
                this.message = '比赛账户已连接。';
            }
            catch (error) {
                this.ready = false;
                if (generation === this.generation) {
                    this.phase = 'error';
                    this.message = error instanceof Error ? error.message : '比赛连接失败。';
                }
                throw error;
            }
            return this.status();
        });
    }
    async install() {
        this.phase = 'installing';
        this.message = '正在准备官方比赛 CLI 和交易规则…';
        const id = randomUUID(), generation = this.generation;
        const installed = await this.cli.install(join(this.root, 'runtimes', id), this.controller.signal);
        this.assertEnabled();
        if (generation !== this.generation)
            throw new Error('比赛模式已切换，请重新连接。');
        this.state.runtime = id;
        this.state.version = installed.version;
        this.currentRules = installed.rules;
        await this.save();
    }
    async validateAccount(expected, signal) {
        const me = record((await this.run(['whoami'], signal)).data);
        const identity = { accountId: String(me.accountId ?? ''), contestId: String(me.contestId ?? '') };
        const scopes = String(me.scope ?? '').split(/\s+/);
        if (me.loggedIn !== true || !identity.accountId || !identity.contestId || !scopes.includes('futures:read') || !scopes.includes('futures:trade')) {
            this.ready = false;
            throw new Error('请在赛事官网完成报名并授权比赛账户，随后重新连接。');
        }
        if (expected && !sameContest(expected, identity)) {
            this.ready = false;
            this.phase = 'disconnected';
            delete this.lastInspection;
            throw new Error('当前账户与此比赛会话不一致，请从比赛页重新连接对应账户。');
        }
        if (!sameContest(identity, this.state.identity)) {
            delete this.lastInspection;
            for (const plan of this.state.plans)
                if (plan.status === 'prepared')
                    plan.status = 'cancelled';
        }
        this.state.identity = identity;
        return identity;
    }
    async validateIdentity(expected, signal) {
        const identity = await this.validateAccount(expected, signal);
        const spec = record((await this.run(['agent', 'describe'], signal)).data);
        if (!this.state.version || typeof spec.minimumCliVersion !== 'string' || !versionAtLeast(this.state.version, spec.minimumCliVersion)) {
            this.ready = false;
            throw new Error('比赛 CLI 低于服务端最低版本，请在比赛页更新。');
        }
        const doctor = record((await this.run(['doctor'], signal)).data);
        if (doctor.allOk !== true) {
            delete this.lastInspection;
            const failed = Array.isArray(doctor.checks) ? doctor.checks.map(record).filter(check => check.ok !== true) : [];
            const codes = failed.map(check => typeof check.detail === 'string' ? /^([a-z_0-9]+):/.exec(check.detail)?.[1] ?? '' : '');
            if (codes.length && codes.every(code => transientContestCodes.has(code))) {
                const code = codes.find(value => value === 'rate_limit_exceeded' || value === 'http_429') ?? codes[0];
                throw new ContestCliError(code, `比赛自检暂不可用（${code}）；稍后重试，不代表账户失效。`);
            }
            this.ready = false;
            const names = [...new Set(failed.map(check => ['本地凭证', '交易通道', '交易授权'].includes(String(check.name)) ? String(check.name) : '未知检查项'))];
            throw new Error(`比赛自检未通过：${names.join('、') || '未返回完整检查结果'}。请检查官网授权及账户状态后重新连接。`);
        }
        this.assertEnabled();
        this.ready = true;
        this.phase = 'connected';
        await this.save();
        return identity;
    }
    async researchIdentity(expected) {
        return this.exclusive(async () => { this.assertReady(expected); return this.validateIdentity(expected ?? this.state.identity); });
    }
    assertReady(expected) {
        this.assertEnabled();
        if (!this.ready || !this.state.identity)
            throw new Error('请先在比赛页连接并验证账户。');
        if (expected && !sameContest(this.state.identity, expected))
            throw new Error('比赛账户已切换，请开始新比赛会话。');
    }
    async rules() {
        await this.load();
        if (!this.state.runtime)
            return '';
        this.currentRules = await readFile(join(this.runtime(), '.codex/skills/panda-trading/SKILL.md'), 'utf8');
        return this.currentRules;
    }
    isEnabled() { return this.state.enabled; }
    rulesText() { return this.currentRules; }
    /** Read contract metadata for the account-bound fly adapter; never places an order. */
    async contractSpec(symbol, identity, signal) {
        if (!/^[a-zA-Z]{1,3}\d{3,4}$/.test(symbol))
            throw new Error('请填写实际合约。');
        return this.exclusive(async () => {
            this.assertReady(identity);
            return this.run(['contract-spec', symbol], signal);
        });
    }
    async query(input, expected, signal) {
        const args = contestQueryArgs(input);
        return this.exclusive(async () => {
            this.assertReady(expected);
            if (input.kind === 'varieties' && !versionAtLeast(this.state.version ?? '', '0.1.23'))
                throw new Error('同步柜台品种需要比赛 CLI 0.1.23 或以上，请在比赛页检查更新；本地品种目录和手动配置仍可使用。');
            const result = await this.run(args, signal);
            if (input.kind === 'trades')
                await this.recordFills(result.data);
            return result;
        });
    }
    async recordFills(rows) {
        let changed = false;
        for (const plan of this.state.plans)
            if (sameContest(plan.identity, this.state.identity))
                changed = mergePlanFills(plan, rows) || changed;
        if (changed)
            await this.save();
    }
    async refreshFills(plan) {
        const candidates = (plan ? [plan] : this.state.plans).filter(item => sameContest(item.identity, this.state.identity) && planOrderId(item));
        if (!candidates.length)
            return;
        // One bounded recent page; older executions can be backfilled by browsing trade-history pages.
        await this.recordFills((await this.run(['trades', '--count', '200'])).data);
    }
    async inspect(identity, signal) {
        return this.inspectAccount(identity, signal, true);
    }
    /** Background observations still verify account ownership; order paths use full inspect(). */
    async observe(identity, signal) {
        return this.inspectAccount(identity, signal, false);
    }
    async inspectAccount(identity, signal, full) {
        return this.exclusive(async () => {
            this.assertReady(identity);
            if (full)
                await this.validateIdentity(identity, signal);
            else
                await this.validateAccount(identity, signal);
            const account = await this.run(['account'], signal);
            const positions = await this.run(['positions'], signal);
            const openOrders = await this.run(['orders', '--status', 'open', '--count', '200'], signal);
            if (!account.data || typeof account.data !== 'object' || Array.isArray(account.data)
                || !Array.isArray(positions.data) || !Array.isArray(openOrders.data))
                throw new Error('账户巡检数据不完整，请重新查询。');
            const pendingPlans = this.state.plans.filter(plan => sameContest(plan.identity, identity)
                && (openStates.has(plan.status) || (plan.status === 'prepared' && plan.expiresAt > Date.now())));
            const summary = [`当前有 ${positions.data.length} 条持仓、${openOrders.data.length}${openOrders.data.length === 200 ? ' 条以上' : ' 条'}活动委托。`];
            if (openOrders.data.length)
                summary.push('存在活动委托；账户变化以柜台后续回报为准。');
            if (pendingPlans.some(plan => openStates.has(plan.status)))
                summary.push('有尚未核实完成的操作，请先查询回执，不要重发。');
            else if (pendingPlans.length)
                summary.push('有待确认计划；请核对有效期后再决定是否执行。');
            else
                summary.push('当前没有待处理的交易计划。');
            this.lastInspection = { identity, fetchedAt: Date.now(), account, positions, openOrders, pendingPlans: structuredClone(pendingPlans), summary };
            return structuredClone(this.lastInspection);
        });
    }
    inspection(identity) {
        return this.state.enabled && this.ready && sameContest(this.state.identity, identity)
            && sameContest(this.lastInspection?.identity, identity) ? structuredClone(this.lastInspection) : undefined;
    }
    async checkUpdate() {
        if (this.checkingUpdate)
            return this.checkingUpdate;
        const checking = (async () => {
            await this.load();
            this.assertEnabled();
            const result = record((await this.run(['update', '--check'])).data);
            if (typeof result.latestVersion !== 'string')
                throw new Error('无法读取比赛 CLI 最新版本。');
            this.latestVersion = result.latestVersion;
            return this.status();
        })();
        this.checkingUpdate = checking;
        try {
            return await checking;
        }
        finally {
            if (this.checkingUpdate === checking)
                delete this.checkingUpdate;
        }
    }
    async update() {
        return this.exclusive(async () => {
            this.assertEnabled();
            if (this.state.plans.some(plan => openStates.has(plan.status) || (plan.status === 'prepared' && plan.expiresAt > Date.now())))
                throw new Error('请先处理待确认计划或查询未完成的交易回执，再更新。');
            const me = record((await this.run(['whoami'])).data);
            if (me.loggedIn === true) {
                const orders = (await this.run(['orders', '--status', 'open', '--count', '1'])).data;
                if (!Array.isArray(orders) || orders.length > 0)
                    throw new Error('存在活动委托或无法确认挂单状态，暂缓更新。');
            }
            else if (this.state.identity)
                throw new Error('请先重新登录，确认挂单状态后再更新。');
            const previous = { runtime: this.state.runtime, version: this.state.version, rules: this.currentRules };
            try {
                await this.install();
                if (me.loggedIn === true)
                    await this.validateIdentity(this.state.identity);
                else
                    this.phase = 'disconnected';
                this.message = '比赛 CLI 已更新，交易连接和规则已重新加载。';
            }
            catch (error) {
                if (previous.runtime)
                    this.state.runtime = previous.runtime;
                if (previous.version)
                    this.state.version = previous.version;
                this.currentRules = previous.rules;
                this.ready = false;
                this.phase = 'error';
                this.message = '更新未完成，已保留原版本，请重新连接。';
                await this.save();
                throw error;
            }
            return this.status();
        });
    }
    async disconnect() {
        return this.exclusive(async () => {
            this.assertEnabled();
            if (this.state.plans.some(plan => openStates.has(plan.status)))
                throw new Error('请先查询未完成的交易回执，再退出账户。');
            await this.run(['logout']);
            this.ready = false;
            this.phase = 'disconnected';
            delete this.state.identity;
            delete this.lastInspection;
            for (const plan of this.state.plans)
                if (plan.status === 'prepared')
                    plan.status = 'cancelled';
            this.message = '已退出比赛账户。';
            await this.save();
            return this.status();
        });
    }
    async prepare(input, identity, signal) {
        return this.exclusive(async () => {
            this.assertReady(identity);
            await this.validateIdentity(identity);
            if (this.state.plans.some(plan => openStates.has(plan.status)))
                throw new Error('请先查询未完成的交易回执，再生成新计划。');
            let parameters;
            let summary;
            let quote = {};
            if (input.operation === 'place_order') {
                const order = orderSchema.parse(input.order);
                let symbol = order.symbol, expectedContract = order.symbol;
                const positions = (await this.run(['positions'], signal)).data;
                if (!Array.isArray(positions))
                    throw new Error('持仓查询失败，无法预演。');
                if (order.offset === 'close') {
                    const matches = positions.map(record).filter(item => sameContestContract(item.contractCode, order.symbol)
                        && item.direction === (order.direction === 'sell' ? 'long' : 'short'));
                    if (matches.length > 1)
                        throw new Error('实际合约存在多条同方向持仓，请核对交易所与持仓后再预演。');
                    const position = matches[0];
                    if (!position || Number(position.closable ?? position.sellable ?? 0) < order.volume)
                        throw new Error('实际合约的可平手数不足，请刷新持仓。');
                    // Keep the counter's casing for its CLI, removing only the recognized exchange suffix.
                    expectedContract = String(position.contractCode);
                    symbol = contestContractParts(position.contractCode)[1];
                }
                const args = ['order', '--symbol', symbol, '--direction', order.direction, '--offset', order.offset, '--volume', String(order.volume), '--dry-run'];
                if (order.price !== undefined)
                    args.push('--price', String(order.price));
                const preview = record((await this.run(args, signal)).data);
                if (preview.wouldSucceed !== true)
                    throw new Error('交易预演未通过，请检查合约、手数、价格和可用资金。');
                quote = record(preview.marketQuote);
                const contract = preview.contractCode ?? record(preview.order).contractCode ?? quote.contractCode ?? quote.symbol ?? symbol;
                if (typeof contract !== 'string' || !futuresContractPattern.test(contract))
                    throw new Error('预演未返回实际合约，请填写完整合约代码后重试。');
                if (contestContractParts(expectedContract) && (!sameContestContract(contract, expectedContract)
                    || (quote.contractCode !== undefined && !sameContestContract(quote.contractCode, expectedContract)))) {
                    throw new Error('预演返回的合约或交易所与请求不符，请核对后重试。');
                }
                parameters = { contractCode: contract, side: order.direction, offset: order.offset, volume: order.volume,
                    ...(order.price === undefined ? {} : { price: order.price }) };
                summary = `${contract} ${order.offset === 'open' ? '开' : '平'}${(order.offset === 'open') === (order.direction === 'buy') ? '多' : '空'} ${order.volume} 手 · ${order.price === undefined ? '市价 IOC' : `限价 ${order.price} GFD`}`;
            }
            else if (input.operation === 'cancel_order') {
                if (!input.orderId || input.orderId.length > 100)
                    throw new Error('请选择一个有效的活动委托。');
                const open = (await this.run(['orders', '--status', 'open', '--count', '200'], signal)).data;
                const order = Array.isArray(open) ? open.map(record).find(item => String(item.orderId) === input.orderId) : undefined;
                if (!order)
                    throw new Error('该委托已不在当前挂单中，请刷新。');
                parameters = { orderId: input.orderId };
                summary = `撤销 ${String(order.contractCode ?? '')} 委托 ${input.orderId}`;
                quote = order;
            }
            else
                throw new Error('首版只支持单笔下单和单笔撤单。');
            const response = record((await this.run(['plan', 'create', '--operation', input.operation, '--parameters', JSON.stringify(parameters)], signal)).data);
            const expiresAt = typeof response.expiresAt === 'number' ? response.expiresAt : Date.parse(String(response.expiresAt));
            if (typeof response.planId !== 'string' || !Number.isFinite(expiresAt) || expiresAt <= Date.now())
                throw new Error('服务端没有返回有效的冻结计划。');
            this.assertReady(identity);
            // Old cards become unexecutable when a replacement is prepared in this session.
            for (const plan of this.state.plans)
                if (plan.sessionId === input.sessionId && plan.status === 'prepared')
                    plan.status = 'cancelled';
            const plan = { id: response.planId, sessionId: input.sessionId, identity, operation: input.operation,
                createdAt: Date.now(), expiresAt, summary, details: { ...response, parameters, marketQuote: quote }, clientRequestId: randomUUID(), status: 'prepared' };
            this.state.plans = this.state.plans.filter(plan => openStates.has(plan.status) || plan.status === 'prepared' || plan.createdAt > Date.now() - 30 * 86400_000).slice(-899);
            this.state.plans.push(plan);
            await this.save();
            return structuredClone(plan);
        });
    }
    async execute(id, sessionId) {
        return this.exclusive(async () => {
            const plan = this.findPlan(id, sessionId);
            this.assertReady(plan.identity);
            if (plan.status !== 'prepared')
                return structuredClone(plan);
            if (plan.expiresAt <= Date.now()) {
                plan.status = 'expired';
                await this.save();
                throw new Error('计划已过期，请重新预演并确认。');
            }
            await this.validateIdentity(plan.identity);
            if (plan.status !== 'prepared' || plan.expiresAt <= Date.now())
                throw new Error('计划已失效，请重新预演。');
            // Persist intent BEFORE submission. A crash or lost reply must never cause a second order.
            plan.status = 'executing';
            await this.save();
            try {
                const result = record((await this.run(['plan', 'execute', plan.id, '--client-request-id', plan.clientRequestId, '--yes'])).data);
                plan.result = result;
                if (typeof result.operationId === 'string')
                    plan.operationId = result.operationId;
                plan.status = operationStates.has(String(result.status)) ? result.status : 'unknown';
            }
            catch {
                plan.status = 'unknown';
            }
            await this.save();
            // Optional price lookup must never downgrade a successful submission or replay it.
            await this.refreshFills(plan).catch(() => { });
            return structuredClone(plan);
        });
    }
    async dismiss(id, sessionId) {
        return this.exclusive(async () => {
            const plan = this.findPlan(id, sessionId);
            if (plan.status === 'prepared') {
                plan.status = 'cancelled';
                await this.save();
            }
            return this.status(sessionId);
        });
    }
    findPlan(id, sessionId) {
        const plan = this.state.plans.find(plan => plan.id === id && plan.sessionId === sessionId);
        if (!plan)
            throw new Error('没有找到此会话的交易计划。');
        return plan;
    }
    async reconcile(id, sessionId) {
        return this.exclusive(async () => {
            const plan = this.findPlan(id, sessionId);
            this.assertReady(plan.identity);
            if (!plan.operationId) {
                const current = record((await this.run(['plan', 'show', plan.id])).data);
                if (typeof current.operationId === 'string')
                    plan.operationId = current.operationId;
                if (current.status === 'expired' || current.status === 'failed')
                    plan.status = current.status;
            }
            if (plan.operationId) {
                const result = record((await this.run(['operation', 'show', plan.operationId])).data);
                plan.result = result;
                plan.status = operationStates.has(String(result.status)) ? result.status : 'unknown';
            }
            await this.save();
            await this.refreshFills(plan).catch(() => { });
            return structuredClone(plan);
        });
    }
    dispose() { this.controller.abort(); }
}
//# sourceMappingURL=contest-service.js.map