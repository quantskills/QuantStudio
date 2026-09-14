import { randomUUID, createHash } from 'node:crypto';
import { credentialRef } from '@deepseek-ai/dsh-credentials';
import s from '@deepseek-ai/schemastery';
import { z } from 'zod';
import { MODEL_SERVICES, suggestedModelProfile, suggestedRouteReasoning } from "./model-service-catalog.js";
import { MODEL_ACCESS_NS } from "./model-access-settings.js";
import { createMessage } from '@deepseek-ai/dsh-llm';
const NS = 'llm-pi-ai';
const routeSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);
const reasoningSchema = z.enum(['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']);
const draftSchema = z.object({
    route: routeSchema.optional(), service: z.enum(MODEL_SERVICES.map(item => item.id)),
    name: z.string().trim().min(1), baseURL: z.string(), api: z.enum(['openai-completions', 'openai-responses', 'anthropic-messages', 'google-generative-ai', 'codex-local']),
    apiKey: z.string().optional(), modelIds: z.array(z.string().trim().min(1)), auto: z.boolean(), reasoning: reasoningSchema.optional(), modelsJson: z.string().optional(),
});
const failed = (code, message) => ({ state: 'failed', code, message, modelIds: [] });
const unavailable = () => ({ state: 'discovery-unavailable', code: 'discovery', message: '此服务未提供可用的模型发现接口。可以填写模型 ID 保存，再用推理测试验证（可能消耗额度）。', modelIds: [] });
/** Sanitized endpoint contract. Never redirects credentials or copies them into query strings. */
export function modelDiscoveryRequest(draft, key) {
    const url = new URL(draft.baseURL);
    if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' &&
        !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
        throw new Error('invalid endpoint');
    }
    const base = url.href.replace(/\/$/, '');
    if (draft.api === 'anthropic-messages')
        return {
            url: base + (base.endsWith('/v1') ? '/models' : '/v1/models'),
            headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        };
    if (draft.api === 'google-generative-ai')
        return { url: base + '/models', headers: { 'x-goog-api-key': key } };
    return { url: base + '/models', headers: key ? { Authorization: 'Bearer ' + key } : {} };
}
/** Host-only credential/config orchestrator. No DOM bridge and no second credential store. */
export class QuantSkillsModelAccess {
    ctx;
    request;
    tail = Promise.resolve();
    services;
    proofs = new Map();
    constructor(ctx, _codexExecutable, request = fetch) {
        this.ctx = ctx;
        this.request = request;
        ctx.inject(['settings', 'credentials'], scope => {
            this.services = scope;
            scope.settings.register(MODEL_ACCESS_NS, s.object({
                connections: s.dict(s.object({
                    service: s.string(), auto: s.boolean(), state: s.string(), message: s.string(), verifiedModels: s.array(s.string()),
                })).default({}),
            }));
        });
    }
    profiles() {
        return this.connected.settings.get(NS)?.providers ?? {};
    }
    get connected() {
        if (!this.services)
            throw new Error('模型设置或凭据服务尚未就绪，请重新连接 Host。');
        return this.services;
    }
    policies() {
        return this.connected.settings.get(MODEL_ACCESS_NS)?.connections ?? {};
    }
    fingerprint(draft) {
        const prior = draft.route ? this.profiles()[draft.route] : undefined;
        return createHash('sha256').update(JSON.stringify({ ...draft, name: undefined, auto: undefined, modelsJson: undefined,
            modelIds: undefined, prior })).digest('hex');
    }
    async policy(route, value) {
        await this.connected.settings.mutate(MODEL_ACCESS_NS, [{ op: 'set', path: ['connections', route], value }]);
    }
    async connections() {
        const policies = this.policies();
        const rows = [];
        for (const [route, profile] of Object.entries(this.profiles())) {
            const service = policies[route]?.service ?? MODEL_SERVICES.find(entry => entry.id === route || entry.variants.some(v => v.baseURL === profile.baseURL))?.id ?? 'custom';
            let configured = false;
            if (profile.apiKeyEnv) {
                configured = (await this.connected.credentials.describe(credentialRef(profile.apiKeyEnv))).configured;
            }
            let ids = profile.models?.flatMap(model => typeof model.id === 'string' ? [model.id] : []) ?? [];
            if (ids.length === 0) {
                try {
                    ids = (await this.ctx.llm.listModels(route)).map(model => model.id);
                }
                catch { /* Keep saved connection manageable. */ }
            }
            rows.push({ route, service, name: profile.displayName ?? route, baseURL: profile.baseURL ?? MODEL_SERVICES.find(item => item.id === service)?.variants[0]?.baseURL ?? '',
                api: profile.api ?? MODEL_SERVICES.find(item => item.id === service)?.api ?? 'openai-completions',
                configured, auto: policies[route]?.auto ?? true, modelIds: ids,
                modelsJson: JSON.stringify(profile.models ?? ids.map(id => ({ id })), null, 2),
                ...profile.reasoning === undefined ? {} : { reasoning: profile.reasoning },
                state: policies[route]?.state ?? 'saved', message: policies[route]?.message ?? '已保存；尚未通过本页连接验证。' });
        }
        return rows;
    }
    async verify(draft) {
        const prior = draft.route ? this.profiles()[draft.route] : undefined;
        // A saved key can only be reused with exactly its saved endpoint/protocol.
        // Moving a connection to another endpoint requires explicit key entry.
        if (!draft.apiKey && prior && ((prior.baseURL ?? draft.baseURL) !== draft.baseURL || (prior.api ?? draft.api) !== draft.api)) {
            return failed('credential-scope', '修改地址或协议后请重新填写密钥；不会将原密钥发送到新地址。');
        }
        let key = draft.apiKey;
        if (!key && prior?.apiKeyEnv)
            key = (await this.connected.credentials.resolve(credentialRef(prior.apiKeyEnv)))?.value;
        if (!key && draft.service !== 'custom')
            return failed('authentication', '请填写 API 密钥，或检查已保存密钥是否仍可用。');
        let request;
        try {
            request = modelDiscoveryRequest(draft, key ?? '');
        }
        catch {
            return failed('endpoint', '地址必须为 HTTPS（本机服务可使用 HTTP），不能携带用户名、密码或查询参数。');
        }
        if (MODEL_SERVICES.find(item => item.id === draft.service)?.discovery === false)
            return unavailable();
        try {
            const modelIds = [];
            const seen = new Set();
            let url = request.url;
            const signal = AbortSignal.timeout(20000);
            while (!seen.has(url)) {
                seen.add(url);
                const response = await this.request(url, { headers: request.headers, redirect: 'error', signal });
                if (response.status === 401 || response.status === 403)
                    return failed('authentication', '鉴权失败，请检查密钥、区域和套餐权限。');
                if (response.status === 402)
                    return failed('quota', '服务额度不足，请检查账单。');
                if (response.status === 429)
                    return failed('rate-limit', '服务限流或额度不足，请在厂商控制台确认后重试。');
                if ([404, 405, 501].includes(response.status))
                    return unavailable();
                if (!response.ok)
                    return failed('network', '服务暂时不可用（HTTP ' + response.status + '），请稍后重试。');
                const data = await response.json();
                if (!Array.isArray(data.data) && !Array.isArray(data.models))
                    return failed('protocol', '返回内容不是受支持的模型目录格式；请检查地址和协议。');
                modelIds.push(...(data.data ?? []).flatMap(model => typeof model.id === 'string' ? [model.id] : []), ...(data.models ?? []).flatMap(model => typeof model.name === 'string' ? [model.name.replace(/^models\//, '')] : []));
                const next = new URL(request.url);
                if (data.has_more && data.last_id)
                    next.searchParams.set('after_id', data.last_id);
                else if (data.nextPageToken)
                    next.searchParams.set('pageToken', data.nextPageToken);
                else
                    break;
                url = next.href;
            }
            if (modelIds.length === 0)
                return unavailable();
            const uniqueIds = [...new Set(modelIds)];
            const overrides = prior?.modelOverrides;
            return { state: 'verified', code: 'ok', message: '连接与模型发现通过。目录不代表每个模型均支持对话或工具；可用推理测试单独确认。',
                modelIds: uniqueIds, modelProfiles: uniqueIds.map(id => this.modelProfile(draft, id, prior?.models?.find(model => model.id === id) ?? overrides?.[id])) };
        }
        catch {
            return failed('network', '连接失败或超时，请检查网络、地址和代理；未跟随重定向发送密钥。');
        }
    }
    /** Writes serialize across tabs so stale connection forms cannot drop other providers. */
    async run(input) {
        const run = this.tail.then(() => this.execute(input));
        this.tail = run.catch(() => { });
        return run;
    }
    async execute(input) {
        let verification;
        if (!['list', 'verify', 'save', 'remove', 'auto', 'test'].includes(input.action))
            throw new Error('未知模型接入操作。');
        const draft = input.draft ? draftSchema.safeParse(input.draft) : undefined;
        if (draft && !draft.success)
            throw new Error('连接信息格式不正确，请检查必填字段。');
        if (input.action === 'verify' || input.action === 'save') {
            if (!draft?.success)
                throw new Error('请提供连接信息。');
            const value = draft.data;
            const proof = this.fingerprint(value);
            for (const [key, entry] of this.proofs)
                if (entry.expires <= Date.now())
                    this.proofs.delete(key);
            verification = input.action === 'verify' ? await this.verify(value) : this.proofs.get(proof)?.result ?? await this.verify(value);
            this.proofs.set(proof, { result: verification, expires: Date.now() + 300000 });
            if (input.action === 'verify' && value.route && (this.profiles()[value.route] || value.route === 'codex-local')) {
                const prior = this.policies()[value.route];
                // A draft edit must not change the live connection's status.
                const saved = this.profiles()[value.route];
                if (value.route === 'codex-local' || (saved?.baseURL === value.baseURL && saved?.api === value.api && !value.apiKey)) {
                    await this.policy(value.route, { service: value.service, auto: prior?.auto ?? true, state: verification.state,
                        message: verification.message, verifiedModels: verification.modelIds });
                }
            }
            if (input.action === 'save')
                await this.save(value, verification);
        }
        else if (input.action !== 'list') {
            const route = routeSchema.safeParse(input.route);
            if (!route.success)
                throw new Error('连接不存在。');
            const existing = (await this.connections()).find(item => item.route === route.data);
            if (!existing)
                throw new Error('连接不存在。');
            const prior = this.policies()[route.data] ?? { service: existing.service, auto: existing.auto, state: 'saved', message: existing.message, verifiedModels: [] };
            if (input.action === 'remove') {
                if (route.data === 'codex-local')
                    throw new Error('本机 Codex 由 Host 启动配置提供，可关闭参与 Auto；本页不改写全局 Codex 配置。');
                // Never delete shared credentials; remove only this configured route.
                await this.policy(route.data, { ...prior, auto: false });
                try {
                    await this.connected.settings.mutate(NS, [{ op: 'unset', path: ['providers', route.data] }]);
                }
                catch {
                    await this.policy(route.data, prior).catch(() => { });
                    throw new Error('移除失败，原连接仍保留。请检查设置存储后重试。');
                }
            }
            else if (input.action === 'auto') {
                if (typeof input.enabled !== 'boolean')
                    throw new Error('缺少 Auto 开关值。');
                // Explicitly managing an unverified legacy route requires verification before re-entry.
                await this.policy(route.data, { ...prior, auto: input.enabled });
            }
            else {
                const model = input.model;
                if (!model || !existing.modelIds.includes(model))
                    throw new Error('请选择该连接中已保存的模型。');
                try {
                    let answered = false;
                    for await (const chunk of this.ctx.llm.stream({ provider: route.data, model,
                        messages: [createMessage({ role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'Reply with OK only.' }] })],
                        signal: AbortSignal.timeout(60000),
                    })) {
                        if (chunk.type === 'text-delta' && chunk.text)
                            answered = true;
                        if (chunk.type === 'finish' && (chunk.reason.kind === 'error' || chunk.reason.kind === 'aborted')) {
                            throw new Error(chunk.reason.failure.message);
                        }
                    }
                    if (!answered)
                        throw new Error('empty');
                    verification = { state: 'verified', code: 'ok', message: '所选模型的真实推理测试通过。', modelIds: [model] };
                    await this.policy(route.data, { ...prior, state: 'verified', message: verification.message, verifiedModels: [...new Set([...prior.verifiedModels, model])] });
                }
                catch (cause) {
                    const detail = cause instanceof Error ? cause.message : '';
                    verification = /401|403|auth|api.?key/i.test(detail) ? failed('authentication', '推理鉴权失败，请检查密钥和模型访问权限。')
                        : /402|429|quota|credit|balance|rate.?limit/i.test(detail) ? failed('quota', '推理额度不足或服务限流，请在厂商控制台确认。')
                            : /404|model.*(?:not found|unavailable|invalid)/i.test(detail) ? failed('model-unavailable', '所选模型不可用，请检查模型 ID 或访问权限。')
                                : /network|fetch|timeout|abort|connect/i.test(detail) ? failed('network', '推理连接失败或超时，请检查网络后重试。')
                                    : failed('inference', '推理测试未完成，请检查服务协议和模型支持情况。未回传厂商原始错误以避免泄露凭据。');
                    const verifiedModels = prior.verifiedModels.filter(id => id !== model);
                    await this.policy(route.data, { ...prior, state: verifiedModels.length ? prior.state : 'failed', message: verification.message, verifiedModels });
                }
            }
        }
        return { catalog: structuredClone(MODEL_SERVICES), connections: await this.connections(), ...(verification ? { verification } : {}) };
    }
    async save(draft, verification) {
        const route = draft.route ?? (draft.service === 'codex-local' ? 'codex-local' : draft.service + '-' + randomUUID().slice(0, 8));
        if (draft.service === 'codex-local') {
            if (verification.state !== 'verified')
                throw new Error(verification.message);
            await this.policy(route, { service: draft.service, auto: draft.auto, state: verification.state, message: verification.message, verifiedModels: verification.modelIds });
            return;
        }
        // Do not quietly save invalid credentials/network failures as connected.
        if (verification.state === 'failed')
            throw new Error(verification.message);
        const prior = this.profiles()[route];
        const ids = draft.modelIds.length ? draft.modelIds : verification.modelIds;
        if (!ids.length)
            throw new Error('请补充至少一个模型 ID；没有模型发现接口不代表服务不可用。');
        const overrides = prior?.modelOverrides;
        let models = ids.map(id => this.modelProfile(draft, id, prior?.models?.find(model => model.id === id) ?? overrides?.[id]));
        if (draft.modelsJson !== undefined) {
            try {
                const parsed = JSON.parse(draft.modelsJson);
                if (!Array.isArray(parsed) || parsed.length !== new Set(ids).size || new Set(parsed.map(model => model?.id)).size !== parsed.length || parsed.some(model => !model || typeof model.id !== 'string' || !ids.includes(model.id)))
                    throw new Error('shape');
                models = parsed;
            }
            catch {
                throw new Error('高级模型配置必须是包含有效 id 的 JSON 数组。');
            }
        }
        // pi-ai requires a nonempty key even for a loopback server without auth.
        // A synthetic value is used only after unauthenticated local discovery succeeds;
        // it never replaces an existing credential or applies to a remote endpoint.
        const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(draft.baseURL).hostname);
        const apiKey = draft.apiKey || (loopback && !prior?.apiKeyEnv ? 'local-no-auth' : undefined);
        const createdRef = apiKey ? credentialRef('QS_MODEL_' + randomUUID().replaceAll('-', '_').toUpperCase()) : undefined;
        const catalogProvider = MODEL_SERVICES.find(item => item.id === draft.service)?.variants
            .find(variant => variant.baseURL === draft.baseURL)?.catalogProvider;
        const reasoning = draft.reasoning || prior?.reasoning || suggestedRouteReasoning(draft.api, draft.baseURL, ids);
        const profile = { ...prior, displayName: draft.name, baseURL: draft.baseURL, api: draft.api, models,
            ...(reasoning ? { reasoning } : {}),
            ...(catalogProvider ? { catalogProvider } : {}),
            ...(createdRef ? { apiKeyEnv: createdRef } : {}) };
        if (!catalogProvider)
            delete profile.catalogProvider;
        delete profile.modelOverrides;
        const priorPolicy = this.policies()[route];
        try {
            if (createdRef)
                await this.connected.credentials.set(createdRef, apiKey);
            // Policy is committed first: a new route cannot transiently enter Auto before admission.
            await this.policy(route, { service: draft.service, auto: draft.auto, state: verification.state,
                message: verification.message, verifiedModels: verification.modelIds.filter(id => ids.includes(id)) });
            await this.connected.settings.mutate(NS, [{ op: 'set', path: ['providers', route], value: profile }]);
        }
        catch {
            await this.connected.settings.mutate(MODEL_ACCESS_NS, priorPolicy
                ? [{ op: 'set', path: ['connections', route], value: priorPolicy }]
                : [{ op: 'unset', path: ['connections', route] }]).catch(() => { });
            if (createdRef)
                await this.connected.credentials.unset(createdRef).catch(() => { });
            throw new Error('连接保存失败，未替换原有模型凭据。请检查配置与保险库状态后重试。');
        }
    }
    /** Fill only missing catalog facts; explicit saved overrides always win. */
    modelProfile(draft, id, existing) {
        const suggested = suggestedModelProfile(draft.service, draft.api, id, draft.baseURL);
        if (!existing)
            return suggested;
        const next = { ...suggested, ...existing, id };
        if (Array.isArray(existing.input) && existing.input.length === 0 && Array.isArray(suggested['input']))
            next.input = suggested['input'];
        if (existing.reasoningEfforts === undefined || (typeof existing.reasoningEfforts === 'object' && existing.reasoningEfforts !== null
            && !Array.isArray(existing.reasoningEfforts) && Object.keys(existing.reasoningEfforts).length === 0)) {
            if (suggested['reasoningEfforts'] !== undefined)
                next.reasoningEfforts = suggested['reasoningEfforts'];
        }
        if (suggested['compat'] && typeof suggested['compat'] === 'object' && existing.compat && typeof existing.compat === 'object') {
            next.compat = { ...suggested['compat'], ...existing.compat };
        }
        return next;
    }
}
//# sourceMappingURL=model-access.js.map