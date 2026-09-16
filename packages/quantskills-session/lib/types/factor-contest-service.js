import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write';
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths';
import { z } from 'zod';
import { record, safeData, versionAtLeast } from "./contest-cli.js";
import { sameContest } from "./contest-service.js";
import { FactorApiError } from "./factor-contest-cli.js";
import { FACTOR_CONTEST_ID } from "./factor-contest-types.js";
const id = z.string().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/);
const cycle = z.number().int().min(1).max(10);
const batchSchema = z.object({ hypothesis: z.string().trim().min(1).max(2000), maxRuns: z.number().int().min(1).max(50),
    creditThreshold: z.number().finite().positive().max(1_000_000), startDate: z.string().regex(/^\d{8}$/), endDate: z.string().regex(/^\d{8}$/), cycle,
}).strict().refine(b => {
    const date = (s) => new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}T00:00:00Z`);
    const a = date(b.startDate), end = date(b.endDate);
    return Number.isFinite(+a) && Number.isFinite(+end) && a.toISOString().slice(0, 10).replaceAll('-', '') === b.startDate
        && end.toISOString().slice(0, 10).replaceAll('-', '') === b.endDate && +end >= +a
        && +end < Date.UTC(a.getUTCFullYear() + 3, a.getUTCMonth(), a.getUTCDate());
}, '回测日期必须有效且区间不得超过三年。');
const candidateSchema = z.object({ requestId: id, name: z.string().trim().min(1).max(100),
    formula: z.string().trim().min(1).max(16000).optional(), code: z.string().trim().min(1).max(32000).optional(), direction: z.union([z.literal(0), z.literal(1)]),
}).strict().refine(v => Boolean(v.formula) !== Boolean(v.code), '公式和代码必须且只能提供一项。');
const actionSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('budget'), batch: batchSchema }).strict(),
    z.object({ kind: z.literal('create-pool'), name: z.string().trim().min(2).max(30), style: z.string().trim().max(50), cycle }).strict(),
    z.object({ kind: z.literal('update-pool'), name: z.string().trim().min(2).max(30), style: z.string().trim().max(50), cycle: cycle.optional() }).strict(),
    z.object({ kind: z.literal('add-factor'), workflowId: id }).strict(),
    z.object({ kind: z.literal('replace-factor'), factorId: id, workflowId: id }).strict(),
    z.object({ kind: z.literal('remove-factor'), factorId: id }).strict(), z.object({ kind: z.literal('submit-pool') }).strict(),
]);
const identitySchema = z.object({ accountId: id, contestId: z.literal(FACTOR_CONTEST_ID) });
const planSchema = z.object({ id: z.string().uuid(), sessionId: id, identity: identitySchema, action: actionSchema, summary: z.string(),
    snapshot: z.json(), snapshotHash: z.string(), createdAt: z.number(), expiresAt: z.number(),
    status: z.enum(['prepared', 'executing', 'completed', 'failed', 'unknown', 'cancelled', 'expired']), result: z.json().optional() });
const budgetSchema = z.object({ hypothesis: z.string(), maxRuns: z.number().int().positive(), creditThreshold: z.number().positive(),
    startDate: z.string(), endDate: z.string(), cycle, id: z.string().uuid(), sessionId: id, identity: identitySchema,
    runsUsed: z.number().int().nonnegative(), creditsUsed: z.number().nonnegative(), baseline: z.number().finite(), status: z.enum(['active', 'stopped', 'exhausted', 'unknown']) });
const runSchema = z.object({ id, budgetId: z.string().uuid(), sessionId: id, identity: identitySchema, candidate: candidateSchema,
    workflowId: id.optional(), runId: id.optional(), createdAt: z.number(), status: z.enum(['creating', 'running', 'completed', 'failed', 'unknown']), result: z.json().optional() });
const stateSchema = z.object({ enabled: z.boolean(), runtime: z.string().uuid().optional(), version: z.string().optional(), identity: identitySchema.optional(),
    plans: z.array(planSchema).max(1000), budgets: z.array(budgetSchema).max(1000), runs: z.array(runSchema).max(2000) });
const summaries = { budget: '授权一批因子研究', 'create-pool': '创建比赛因子池', 'update-pool': '修改因子池设置',
    'add-factor': '将工作流加入比赛因子池', 'replace-factor': '更新参赛因子工作流', 'remove-factor': '删除参赛因子', 'submit-pool': '正式提交因子池参赛' };
function hash(value) {
    const stable = (v) => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object'
        ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
    return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}
function poolSnapshot(value) {
    if (value === null)
        return null;
    const p = record(value);
    return safeData({ pool_id: p.pool_id, name: p.name, style_tag: p.style_tag, status: p.status, cycle: p.rebalance_cycle_days,
        cycle_locked: p.cycle_locked, settling: p.settling, submitted_at: p.submitted_at, ready_factor_count: p.ready_factor_count,
        modification_window: record(p.modification_window).open,
        factors: Array.isArray(p.factors) ? p.factors.map(f => {
            const item = record(f);
            return { id: item.factor_instance_id, name: item.factor_name, workflow: item.workflow_id, direction: item.direction, revision: item.revision, status: item.status, can_edit: item.can_edit, can_delete: item.can_delete };
        }) : [] });
}
/** Keep journals small; full analysis remains available through the read-only result query. */
function receipt(value) {
    if (JSON.stringify(value).length <= 64_000)
        return value;
    const v = record(value);
    return safeData({ success: v.success, status: v.status, factor_id: v.factor_id, factor_run_id: v.factor_run_id,
        billing: v.billing, duration_seconds: v.duration_seconds, start_time: v.start_time, end_time: v.end_time,
        message: '完整分析较大，记录保留运行回执；请使用回测编号查询完整结果。' });
}
export class FactorContestService {
    runtime;
    root;
    state = { enabled: false, plans: [], budgets: [], runs: [] };
    loaded;
    tail = Promise.resolve();
    saving = Promise.resolve();
    controller = new AbortController();
    generation = 0;
    ready = false;
    phase = 'disconnected';
    message = '';
    latestVersion;
    inspection;
    constructor(runtime, dshHome) {
        this.runtime = runtime;
        this.root = join(resolveDshHome(dshHome), 'quantskills', 'factor-contest');
    }
    load() {
        return this.loaded ??= (async () => {
            try {
                const text = await readFile(join(this.root, 'state.json'), 'utf8');
                if (text.length > 16 * 1024 * 1024)
                    throw new Error('因子比赛记录过大。');
                this.state = stateSchema.parse(JSON.parse(text));
                for (const p of this.state.plans)
                    if (p.status === 'executing')
                        p.status = 'unknown';
                for (const r of this.state.runs)
                    if (r.status === 'running' || r.status === 'creating')
                        r.status = 'unknown';
                // Budget authorizations never silently resume spending after an application restart.
                for (const b of this.state.budgets)
                    if (b.status === 'active')
                        b.status = 'stopped';
            }
            catch (error) {
                if (record(error).code !== 'ENOENT')
                    throw error;
            }
        })();
    }
    save() {
        const text = JSON.stringify(this.state);
        if (text.length > 16 * 1024 * 1024)
            throw new Error('因子比赛本地记录已达容量上限，请先备份并整理记录；未继续提交新操作。');
        const next = this.saving.catch(() => { }).then(() => writeFileAtomic(join(this.root, 'state.json'), text, { mode: 0o600, dirMode: 0o700 }));
        this.saving = next;
        return next;
    }
    exclusive(work) {
        const next = this.tail.catch(() => { }).then(async () => { await this.load(); return work(); });
        this.tail = next;
        return next;
    }
    assertReady(expected) {
        if (!this.state.enabled)
            throw new Error('因子比赛模式已关闭。');
        if (!this.ready || !this.state.identity)
            throw new Error('请先连接并验证因子比赛账户。');
        if (expected && !sameContest(expected, this.state.identity))
            throw new Error('此对话绑定其他因子账户，请从比赛页进入对应对话。');
    }
    async call(work, signal) {
        if (!this.state.enabled)
            throw new Error('因子比赛模式已关闭。');
        const generation = this.generation;
        const active = signal ? AbortSignal.any([this.controller.signal, signal]) : this.controller.signal;
        active.throwIfAborted();
        const result = await work(active);
        active.throwIfAborted();
        if (generation !== this.generation)
            throw new Error('因子比赛状态已切换，本次操作已中止。');
        return result;
    }
    cli(args, signal) {
        if (!this.state.runtime)
            throw new Error('请先安装因子 CLI。');
        return this.call(s => this.runtime.cli(join(this.root, 'runtimes', this.state.runtime), args, s), signal);
    }
    arena(path, signal) { return this.call(s => this.runtime.arena(path, s), signal); }
    async verify(expected, signal) {
        const accountId = await this.call(s => this.runtime.identity(s), signal);
        const identity = { accountId, contestId: FACTOR_CONTEST_ID };
        if ((expected && !sameContest(identity, expected)) || (this.state.identity && !sameContest(identity, this.state.identity))) {
            this.ready = false;
            this.invalidate();
            throw new Error('因子登录账户已改变，请重新连接并进入新账户对话。');
        }
        return identity;
    }
    invalidate() {
        this.generation++;
        this.ready = false;
        delete this.inspection;
        this.controller.abort();
        this.controller = new AbortController();
        for (const p of this.state.plans)
            if (p.status === 'prepared')
                p.status = 'cancelled';
        for (const b of this.state.budgets)
            if (b.status === 'active')
                b.status = 'stopped';
    }
    isEnabled() { return this.state.enabled; }
    async status(sessionId) {
        await this.load();
        const matches = (v) => sameContest(v.identity, this.state.identity) && (!sessionId || v.sessionId === sessionId);
        return structuredClone({ enabled: this.state.enabled, phase: this.state.enabled ? this.phase : 'off', message: this.message,
            ...(this.state.version ? { cliVersion: this.state.version } : {}), ...(this.latestVersion ? { latestVersion: this.latestVersion } : {}),
            updateAvailable: Boolean(this.state.version && this.latestVersion && !versionAtLeast(this.state.version, this.latestVersion)),
            ...(this.state.identity ? { identity: this.state.identity } : {}), ...(this.inspection ? { inspection: this.inspection } : {}),
            plans: this.state.plans.filter(matches).map(p => ({ ...p, status: p.status === 'prepared' && p.expiresAt <= Date.now() ? 'expired' : p.status })),
            budgets: this.state.budgets.filter(matches), runs: this.state.runs.filter(matches) });
    }
    async mode(enabled) {
        if (typeof enabled !== 'boolean')
            throw new Error('模式开关无效。');
        await this.load();
        if (enabled !== this.state.enabled) {
            this.state.enabled = enabled;
            this.invalidate();
            this.phase = 'disconnected';
            this.message = enabled ? '连接因子账户后开始研究。' : '已停止本应用的因子操作；平台已启动回测和参赛因子池继续运行。';
            await this.save();
        }
        return this.status();
    }
    async connect(credentials) {
        return this.exclusive(async () => {
            if (!this.state.enabled)
                throw new Error('请先开启因子比赛模式。');
            this.invalidate();
            const generation = this.generation;
            try {
                if (!this.state.runtime)
                    await this.install();
                const accountId = credentials ? await this.call(s => this.runtime.login(z.object({ phone: z.string().regex(/^\d{6,20}$/), password: z.string().min(1).max(256) }).strict().parse(credentials), s))
                    : await this.call(s => this.runtime.identity(s));
                this.state.identity = { accountId, contestId: FACTOR_CONTEST_ID };
                this.ready = true;
                this.phase = 'connected';
                this.message = '因子账户已连接。报名及身份资料在赛事官网完成。';
                await this.save();
            }
            catch (error) {
                if (generation === this.generation) {
                    this.ready = false;
                    this.phase = 'error';
                    this.message = error instanceof Error ? error.message : '连接失败。';
                }
                throw error;
            }
            return this.status();
        });
    }
    async disconnect() {
        await this.load();
        this.invalidate();
        this.phase = 'disconnected';
        this.message = '已退出因子账户。';
        return this.exclusive(async () => { await this.runtime.logout(); delete this.state.identity; await this.save(); return this.status(); });
    }
    async install() {
        this.phase = 'installing';
        this.message = '正在安装独立的 PandaAI 因子 CLI…';
        const version = await this.call(s => this.runtime.latest(s)), runtime = randomUUID();
        await this.call(s => this.runtime.install(join(this.root, 'runtimes', runtime), version, s));
        this.state.runtime = runtime;
        this.state.version = version;
        this.latestVersion = version;
        await this.save();
    }
    async checkUpdate() {
        await this.load();
        this.latestVersion = await this.call(s => this.runtime.latest(s));
        return this.status();
    }
    async update() {
        return this.exclusive(async () => {
            if (this.state.plans.some(p => (p.status === 'prepared' && p.expiresAt > Date.now()) || ['executing', 'unknown'].includes(p.status)) || this.state.budgets.some(b => b.status === 'active')
                || this.state.runs.some(r => ['creating', 'running', 'unknown'].includes(r.status)))
                throw new Error('请先处理待确认操作、批次和未核实回测，再更新 CLI。');
            this.ready = false;
            try {
                await this.install();
                this.phase = 'disconnected';
                this.message = 'CLI 已更新，请检查连接。';
            }
            catch (error) {
                this.phase = 'error';
                this.message = '更新失败，原 CLI 版本保留；请检查连接。';
                throw error;
            }
            return this.status();
        });
    }
    async researchIdentity(expected) {
        return this.exclusive(async () => { this.assertReady(expected); return this.verify(expected ?? this.state.identity); });
    }
    async balance(signal) {
        const value = record((await this.cli(['balance'], signal)).balance).computingPower;
        if ((typeof value !== 'string' && typeof value !== 'number') || !Number.isFinite(Number(value)) || Number(value) < 0)
            throw new Error('无法核实算力余额，停止启动新回测。');
        return Number(value);
    }
    async pool(signal) {
        try {
            return await this.arena('/factorPool/pools', signal);
        }
        catch (error) {
            if (error instanceof FactorApiError && error.code === 'POOL_NOT_FOUND')
                return null;
            throw error;
        }
    }
    async inspectCurrent(signal) {
        const identity = await this.verify(this.state.identity, signal);
        const balance = await this.balance(signal), registration = await this.arena('/factorArena/me/registration-state', signal), pool = await this.pool(signal);
        this.inspection = { identity, fetchedAt: Date.now(), balance, registration, pool };
        return structuredClone(this.inspection);
    }
    async inspect(expected, signal) {
        return this.exclusive(async () => { this.assertReady(expected); return this.inspectCurrent(signal); });
    }
    async query(input, expected, signal) {
        const request = z.object({ kind: z.enum(['pool', 'workflows', 'scores', 'factor-info', 'factor-result', 'factors']), id: id.optional(), page: z.number().int().min(1).max(1000).optional() }).strict().parse(input);
        return this.exclusive(async () => {
            this.assertReady(expected);
            await this.verify(expected ?? this.state.identity, signal);
            if (request.kind === 'pool')
                return this.pool(signal);
            if (request.kind === 'workflows')
                return this.arena(`/factorPool/workflows?page=${request.page ?? 1}&page_size=50`, signal);
            if (request.kind === 'scores') {
                const poolId = id.parse(record(await this.pool(signal)).pool_id);
                return this.arena(`/factorPool/pools/${poolId}/scores`, signal);
            }
            if (request.kind === 'factors')
                return this.cli(['factor_list', '--no-detail', '--limit', '50', '--page', String(request.page ?? 1)], signal);
            return this.cli([request.kind === 'factor-info' ? 'factor_info' : 'factor_result', id.parse(request.id)], signal);
        });
    }
    async snapshot(action) {
        const p = await this.pool();
        return { pool: poolSnapshot(p), ...('workflowId' in action ? { workflow: await this.cli(['factor_info', action.workflowId]) } : {}) };
    }
    validatePoolAction(action, value) {
        const p = record(value);
        if (action.kind === 'create-pool') {
            if (value !== null)
                throw new Error('已有比赛因子池，请刷新。');
            return;
        }
        id.parse(p.pool_id);
        if (!['draft', 'active'].includes(String(p.status)) || p.settling !== false)
            throw new Error('因子池当前不可修改，请等待提交或结算结束。');
        const factors = Array.isArray(p.factors) ? p.factors.map(record) : [];
        if (action.kind === 'update-pool' && action.cycle !== undefined && p.cycle_locked !== false && action.cycle !== p.rebalance_cycle_days)
            throw new Error('正式提交后的调仓周期已锁定。');
        if (action.kind === 'submit-pool' && (p.status !== 'draft' || Number(p.ready_factor_count) < 5 || !Number.isFinite(Number(p.ready_factor_count))))
            throw new Error('至少需要 5 只就绪因子，且因子池尚未正式提交。');
        if (action.kind === 'add-factor' && factors.length >= 50)
            throw new Error('因子池已达 50 只上限。');
        if (action.kind === 'remove-factor' || action.kind === 'replace-factor') {
            const factor = factors.find(f => f.factor_instance_id === action.factorId);
            if (!factor)
                throw new Error('目标因子已不存在，请刷新。');
            if ((p.submitted_at !== null && record(p.modification_window).open !== true)
                || factor[action.kind === 'remove-factor' ? 'can_delete' : 'can_edit'] === false)
                throw new Error('当前因子不可修改或删除，请等待赛事修改窗口。');
        }
    }
    async prepare(sessionId, input, expected) {
        id.parse(sessionId);
        const action = actionSchema.parse(input);
        return this.exclusive(async () => {
            this.assertReady(expected);
            const inspection = await this.inspectCurrent();
            if (this.state.plans.some(p => sameContest(p.identity, inspection.identity) && ['executing', 'unknown'].includes(p.status)))
                throw new Error('请先核实此前的赛事操作回执。');
            if (action.kind === 'budget') {
                if (this.state.runs.some(r => sameContest(r.identity, inspection.identity) && ['creating', 'running', 'unknown'].includes(r.status)))
                    throw new Error('请先核实未完成的回测记录。');
                if (this.state.budgets.some(b => b.status === 'active' && sameContest(b.identity, inspection.identity)))
                    throw new Error('请先停止当前研究批次。');
                if (inspection.balance <= 0)
                    throw new Error('算力余额不足。');
                const p = record(inspection.pool);
                if (p.cycle_locked === true && p.rebalance_cycle_days !== action.batch.cycle)
                    throw new Error('研究周期必须与已锁定的比赛因子池一致。');
            }
            else
                this.validatePoolAction(action, inspection.pool);
            if (this.state.plans.length >= 1000)
                throw new Error('操作记录已达上限，请整理比赛记录。');
            const snapshot = await this.snapshot(action);
            const plan = { id: randomUUID(), sessionId, identity: inspection.identity, action, summary: summaries[action.kind], snapshot,
                snapshotHash: hash(snapshot), createdAt: Date.now(), expiresAt: Date.now() + 10 * 60_000, status: 'prepared' };
            this.state.plans.push(plan);
            await this.save();
            return structuredClone(plan);
        });
    }
    async confirm(planId, sessionId) {
        return this.exclusive(async () => {
            const p = this.state.plans.find(p => p.id === planId && p.sessionId === sessionId);
            if (!p)
                throw new Error('确认计划不存在。');
            this.assertReady(p.identity);
            if (p.status !== 'prepared')
                throw new Error('该计划已处理，请勿重复确认。');
            if (p.expiresAt <= Date.now()) {
                p.status = 'expired';
                await this.save();
                throw new Error('计划已过期，请重新生成。');
            }
            const inspection = await this.inspectCurrent();
            if (hash(await this.snapshot(p.action)) !== p.snapshotHash) {
                p.status = 'expired';
                await this.save();
                throw new Error('因子池或工作流已变化，请重新生成确认计划。');
            }
            if (p.action.kind === 'budget') {
                if (this.state.budgets.some(b => b.status === 'active' && sameContest(b.identity, p.identity))
                    || this.state.runs.some(r => sameContest(r.identity, p.identity) && ['creating', 'running', 'unknown'].includes(r.status)))
                    throw new Error('存在研究批次或未核实回测。');
                if (inspection.balance <= 0)
                    throw new Error('算力余额不足。');
                this.state.budgets.push({ ...p.action.batch, id: p.id, sessionId, identity: p.identity, baseline: inspection.balance, runsUsed: 0, creditsUsed: 0, status: 'active' });
                p.status = 'completed';
                p.result = { budgetId: p.id, message: '预算已授权；等待在本会话继续研究。' };
                await this.save();
                return structuredClone(p);
            }
            this.validatePoolAction(p.action, inspection.pool);
            const mutation = this.mutation(p.action, record(inspection.pool).pool_id);
            p.status = 'executing';
            await this.save();
            try {
                p.result = await this.call(s => this.runtime.arena(mutation.path, s, { ...mutation, key: p.id }));
                p.status = 'completed';
            }
            catch (error) {
                p.status = error instanceof FactorApiError && error.rejected ? 'failed' : 'unknown';
                p.result = { message: p.status === 'failed' ? error.message : '提交结果待核实，请查询因子池并核对，勿重复提交。' };
            }
            await this.save();
            if (p.status === 'completed' && this.state.enabled && this.ready) {
                const generation = this.generation;
                void this.inspect(p.identity, AbortSignal.timeout(30_000)).catch(() => {
                    if (generation === this.generation)
                        this.message = '操作已完成，账户快照尚未刷新，请手动刷新核对。';
                });
            }
            return structuredClone(p);
        });
    }
    mutation(a, poolId) {
        if (a.kind === 'create-pool')
            return { path: '/factorPool/pools', method: 'POST', body: { name: a.name, style_tag: a.style || null, rebalance_cycle_days: a.cycle } };
        const base = `/factorPool/pools/${id.parse(poolId)}`;
        if (a.kind === 'update-pool')
            return { path: base, method: 'POST', body: { name: a.name, style_tag: a.style || null, ...(a.cycle === undefined ? {} : { rebalance_cycle_days: a.cycle }) } };
        if (a.kind === 'submit-pool')
            return { path: `${base}/submit`, method: 'POST' };
        if (a.kind === 'add-factor')
            return { path: `${base}/factors`, method: 'POST', body: { workflow_id: a.workflowId } };
        return { path: `${base}/factors/${a.factorId}`, method: a.kind === 'remove-factor' ? 'DELETE' : 'POST',
            ...(a.kind === 'replace-factor' ? { body: { workflow_id: a.workflowId } } : {}) };
    }
    async dismiss(planId, sessionId) {
        return this.exclusive(async () => {
            const p = this.state.plans.find(p => p.id === planId && p.sessionId === sessionId);
            if (!p || !sameContest(p.identity, this.state.identity) || p.status !== 'prepared')
                throw new Error('无法取消此计划。');
            p.status = 'cancelled';
            await this.save();
        });
    }
    async stopBudget(budgetId) {
        await this.load();
        const b = this.state.budgets.find(b => b.id === budgetId && sameContest(b.identity, this.state.identity));
        if (!b)
            throw new Error('批次不存在。');
        if (b.status === 'active')
            b.status = 'stopped';
        await this.save();
    }
    async runCandidate(sessionId, budgetId, input, expected, signal) {
        const candidate = candidateSchema.parse(input);
        return this.exclusive(async () => {
            this.assertReady(expected);
            await this.verify(expected);
            const prior = this.state.runs.find(r => r.candidate.requestId === candidate.requestId && r.budgetId === budgetId && r.sessionId === sessionId);
            if (prior) {
                if (hash(safeData(prior.candidate)) !== hash(safeData(candidate)))
                    throw new Error('请求编号已用于其他因子。');
                return structuredClone(prior);
            }
            const b = this.state.budgets.find(b => b.id === budgetId && b.sessionId === sessionId && sameContest(b.identity, expected));
            if (!b || b.status !== 'active')
                throw new Error('请先在确认卡授权本会话研究批次。');
            if (this.state.runs.some(r => sameContest(r.identity, expected) && ['creating', 'running', 'unknown'].includes(r.status)))
                throw new Error('已有未完成回测，不能重复启动。');
            const pool = record(await this.pool());
            if (pool.cycle_locked === true && pool.rebalance_cycle_days !== b.cycle)
                throw new Error('比赛调仓周期已改变，请重新授权研究批次。');
            const balance = await this.balance();
            b.creditsUsed += Math.max(0, b.baseline - balance);
            b.baseline = balance;
            if (b.runsUsed >= b.maxRuns || b.creditsUsed >= b.creditThreshold || balance <= 0) {
                b.status = 'exhausted';
                await this.save();
                throw new Error('研究次数或算力停止阈值已到，未启动新回测。');
            }
            if (this.state.runs.length >= 2000)
                throw new Error('回测记录已达上限。');
            if (b.status !== 'active')
                throw new Error('批次已停止。');
            const r = { id: randomUUID(), budgetId, sessionId, identity: expected, candidate, createdAt: Date.now(), status: 'creating' };
            this.state.runs.push(r);
            b.runsUsed++;
            await this.save();
            try {
                const created = await this.cli(['factor_create', candidate.formula ? '--formula' : '--code', candidate.formula ?? candidate.code,
                    '--name', candidate.name, '--start-date', b.startDate, '--end-date', b.endDate, '--adjustment-cycle', String(b.cycle), '--group-number', '10', '--factor-direction', String(candidate.direction)], signal);
                r.workflowId = id.parse(created.factor_id);
                await this.save();
                if (b.status !== 'active') {
                    r.status = 'failed';
                    r.result = { message: '批次已停止；仅创建工作流，没有启动回测。' };
                    await this.save();
                    return structuredClone(r);
                }
                r.status = 'running';
                await this.save();
                r.result = receipt(await this.cli(['factor_run', r.workflowId, '--timeout', '600'], signal));
                const result = record(r.result);
                if (typeof result.factor_run_id === 'string')
                    r.runId = id.parse(result.factor_run_id);
                r.status = result.success === true ? 'completed' : ['FAILED', 'BILLING_STOP'].includes(String(result.status)) ? 'failed' : 'unknown';
                const after = await this.balance();
                b.creditsUsed += Math.max(0, b.baseline - after);
                b.baseline = after;
                if (r.status === 'unknown')
                    b.status = 'unknown';
                else if (b.status === 'active' && (b.runsUsed >= b.maxRuns || b.creditsUsed >= b.creditThreshold))
                    b.status = 'exhausted';
            }
            catch {
                r.status = 'unknown';
                b.status = 'unknown';
                r.result = { message: '创建或回测结果待核实。次数已保留，停止本批次；请核对记录，勿重发。' };
            }
            await this.save();
            return structuredClone(r);
        });
    }
    async reconcileRun(runId) {
        return this.exclusive(async () => {
            const r = this.state.runs.find(r => r.id === runId && sameContest(r.identity, this.state.identity));
            if (!r)
                throw new Error('回测记录不存在。');
            this.assertReady(r.identity);
            await this.verify(r.identity);
            if (!r.workflowId)
                throw new Error('创建回执丢失，请到官网核对是否存在该名称工作流；本应用不会重发。');
            if (!r.runId) {
                const info = await this.cli(['factor_info', r.workflowId]);
                if (typeof info.last_run_id === 'string' && info.last_run_id)
                    r.runId = id.parse(info.last_run_id);
            }
            if (!r.runId)
                throw new Error('尚不能确认平台运行编号，请稍后核对；本应用不会重新启动。');
            const result = await this.cli(['factor_result', r.runId]);
            r.result = receipt(result);
            if ([2, 3, 6].includes(Number(result.status))) {
                r.status = Number(result.status) === 2 ? 'completed' : 'failed';
                const b = this.state.budgets.find(b => b.id === r.budgetId);
                if (b) {
                    const balance = await this.balance();
                    b.creditsUsed += Math.max(0, b.baseline - balance);
                    b.baseline = balance;
                    if (b.status === 'unknown')
                        b.status = 'stopped';
                }
            }
            await this.save();
            return structuredClone(r);
        });
    }
    async reconcilePlan(planId) {
        return this.exclusive(async () => {
            const p = this.state.plans.find(p => p.id === planId && sameContest(p.identity, this.state.identity));
            if (!p)
                throw new Error('没有待核实的赛事操作。');
            this.assertReady(p.identity);
            await this.verify(p.identity);
            // This runs behind confirm() in the same queue, unlike status(). A prepared
            // plan here proves that prior confirmation finished without submitting.
            if (p.status !== 'unknown')
                return structuredClone({ ...p,
                    status: p.status === 'prepared' && p.expiresAt <= Date.now() ? 'expired' : p.status });
            if (p.action.kind === 'budget')
                throw new Error('预算状态待核实，请勿重复确认。');
            const pool = await this.pool(), current = record(pool), a = p.action;
            const factors = Array.isArray(current.factors) ? current.factors.map(record) : [];
            const original = record(record(p.snapshot).pool);
            const originalFactors = Array.isArray(original.factors) ? original.factors.map(record) : [];
            const samePool = current.pool_id === original.pool_id;
            const observed = a.kind === 'create-pool' ? current.name === a.name && current.rebalance_cycle_days === a.cycle
                : samePool && (a.kind === 'submit-pool' ? current.submitted_at != null && ['active', 'submitting'].includes(String(current.status))
                    : a.kind === 'remove-factor' ? !factors.some(f => f.factor_instance_id === a.factorId)
                        : a.kind === 'add-factor' ? factors.some(f => f.workflow_id === a.workflowId)
                            : a.kind === 'replace-factor' ? factors.some(f => f.factor_instance_id === a.factorId && f.workflow_id === a.workflowId
                                && Number(f.revision) > Number(originalFactors.find(old => old.id === a.factorId)?.revision))
                                : current.name === a.name && (current.style_tag ?? '') === a.style && (a.cycle === undefined || current.rebalance_cycle_days === a.cycle));
            p.result = { message: observed ? '只读查询已观察到目标状态；没有重新发送操作。' : '尚不能确认目标状态，请继续核对官网；没有重新发送操作。', pool };
            if (observed)
                p.status = 'completed';
            await this.save();
            return structuredClone(p);
        });
    }
    dispose() { this.controller.abort(); }
}
//# sourceMappingURL=factor-contest-service.js.map