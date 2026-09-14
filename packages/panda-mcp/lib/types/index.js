/** QuantSkills Host：直连公网 PandaData MCP，OAuth 登录后把工具挂到 ctx.tools。 */
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import { join } from 'node:path';
import { LocalDatabase } from "./database.js";
import z from '@deepseek-ai/schemastery';
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { openSystemBrowser } from "./browser.js";
import { startOauthLoopback } from "./callback-server.js";
import { PandaMcpOAuthProvider } from "./oauth-provider.js";
import { PandaMcpOAuthStore, pandaMcpOAuthPath } from "./oauth-store.js";
import { publicToolName } from "./public-name.js";
import { callConnectedTool, disposeTools, registerStubTools, syncLiveTools, } from "./tools.js";
import { DEFAULT_PANDA_MCP_URL, PANDA_MCP_TOOL_NAMES, } from "./types.js";
export { DEFAULT_PANDA_MCP_URL, PANDA_MCP_TOOL_NAMES } from "./types.js";
export { publicToolName } from "./public-name.js";
export { reauthRequired } from "./tools.js";
export { PandaMcpOAuthStore, pandaMcpOAuthPath } from "./oauth-store.js";
export { startOauthLoopback } from "./callback-server.js";
/** Cordis 插件名。 */
export const name = 'panda-mcp';
/** 工具注册与系统提示所依赖的服务。 */
export const inject = ['tools', 'agents', 'systemPrompt'];
const POLICY = `PandaData market data is available through remote MCP tools named mcp__pandadata__*.

Before fetching data, use quantskills_data_catalog to find locally cached datasets, then quantskills_data_query with the required date range and minRows. It refreshes stale or insufficient remote data once. Only use rows when status is hit or refreshed; insufficient is NOT usable data. Imported local files need re-import when insufficient. The database contains only user-configured sources. Never substitute a different vendor silently. PandaData table results are automatically cached for five minutes.

Workflow: mcp__pandadata__auth_status → mcp__pandadata__search_methods → mcp__pandadata__get_method_doc → mcp__pandadata__call_pandadata.
Read the method document before calling. Only documented get_* methods are allowed.

If a tool is missing, returns reauth_required, or fails with HTTP 401, stop and ask the user to open QuantSkills Settings → PandaData and click Login. Never ask for a password. Never retry login in a loop. Never switch to AkShare, Yahoo, Tushare, or any other data vendor unless the user explicitly names that vendor for the current task only.`;
/** Loader schema。 */
export const Config = z.object({
    url: z.string().default(DEFAULT_PANDA_MCP_URL),
    serverName: z.string().default('pandadata'),
    dshHome: z.string().default(''),
    toolCallTimeoutMs: z.number().default(60_000),
    authTimeoutMs: z.number().default(300_000),
    publicOrigin: z.string().default(''),
    callbackPort: z.number().default(3197),
});
function authErrorHint(error) {
    if (!(error instanceof Error) || error.message.trim().length === 0)
        return '';
    return `（${error.message.replace(/\s+/g, ' ').slice(0, 160)}）`;
}
function validateHttpUrl(value) {
    let parsed;
    try {
        parsed = new URL(value);
    }
    catch {
        throw new Error('panda-mcp: url 必须是 HTTPS 地址');
    }
    if (parsed.protocol !== 'https:' || parsed.username !== '' || parsed.password !== '' || parsed.hash !== '') {
        throw new Error('panda-mcp: url 必须是不含凭据的 HTTPS 地址');
    }
    return parsed.href;
}
function createPandaMcpTransport(url, provider) {
    return new StreamableHTTPClientTransport(new URL(url), { authProvider: provider });
}
function createPandaMcpClient() {
    return new Client({ name: 'quantskills', version: '0.1.31' });
}
/** 默认：MCP SDK Streamable HTTP + OAuth。 */
export async function connectPublicPandaMcp(args) {
    const provider = new PandaMcpOAuthProvider(args.store, args.redirectUrl, args.openAuthorization, args.state);
    const firstTransport = createPandaMcpTransport(args.url, provider);
    const firstClient = createPandaMcpClient();
    try {
        await firstClient.connect(firstTransport);
        return {
            client: firstClient,
            close: async () => {
                await firstClient.close();
            },
        };
    }
    catch (error) {
        if (!(error instanceof UnauthorizedError))
            throw error;
    }
    const code = await args.waitForCode(args.signal);
    await firstTransport.finishAuth(code);
    try {
        await firstClient.close();
    }
    catch {
        // SDK 在 initialize 失败时已经 void close()，这里只是避免泄漏。
    }
    // 第一次 connect 已经 start() 过 transport，且 Client.close 是 fire-and-forget。
    // 必须换新 Client + 新 Transport，否则会 Already connected / already started。
    const transport = createPandaMcpTransport(args.url, provider);
    const client = createPandaMcpClient();
    await client.connect(transport);
    return {
        client,
        close: async () => {
            await client.close();
        },
    };
}
/** 公网 PandaData MCP 网关。 */
let PandaMcpGateway = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _databaseList_decorators;
    let _databaseImport_decorators;
    let _databaseFetch_decorators;
    let _databaseQuery_decorators;
    let _databasePreview_decorators;
    let _databaseRefresh_decorators;
    let _databaseRemove_decorators;
    let _databaseCategorize_decorators;
    let _status_decorators;
    let _authenticate_decorators;
    let _refresh_decorators;
    let _logout_decorators;
    return class PandaMcpGateway extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _databaseList_decorators = [Remote];
            _databaseImport_decorators = [Remote];
            _databaseFetch_decorators = [Remote];
            _databaseQuery_decorators = [Remote];
            _databasePreview_decorators = [Remote];
            _databaseRefresh_decorators = [Remote];
            _databaseRemove_decorators = [Remote];
            _databaseCategorize_decorators = [Remote];
            _status_decorators = [Remote];
            _authenticate_decorators = [Remote];
            _refresh_decorators = [Remote];
            _logout_decorators = [Remote];
            __esDecorate(this, null, _databaseList_decorators, { kind: "method", name: "databaseList", static: false, private: false, access: { has: obj => "databaseList" in obj, get: obj => obj.databaseList }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _databaseImport_decorators, { kind: "method", name: "databaseImport", static: false, private: false, access: { has: obj => "databaseImport" in obj, get: obj => obj.databaseImport }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _databaseFetch_decorators, { kind: "method", name: "databaseFetch", static: false, private: false, access: { has: obj => "databaseFetch" in obj, get: obj => obj.databaseFetch }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _databaseQuery_decorators, { kind: "method", name: "databaseQuery", static: false, private: false, access: { has: obj => "databaseQuery" in obj, get: obj => obj.databaseQuery }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _databasePreview_decorators, { kind: "method", name: "databasePreview", static: false, private: false, access: { has: obj => "databasePreview" in obj, get: obj => obj.databasePreview }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _databaseRefresh_decorators, { kind: "method", name: "databaseRefresh", static: false, private: false, access: { has: obj => "databaseRefresh" in obj, get: obj => obj.databaseRefresh }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _databaseRemove_decorators, { kind: "method", name: "databaseRemove", static: false, private: false, access: { has: obj => "databaseRemove" in obj, get: obj => obj.databaseRemove }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _databaseCategorize_decorators, { kind: "method", name: "databaseCategorize", static: false, private: false, access: { has: obj => "databaseCategorize" in obj, get: obj => obj.databaseCategorize }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _status_decorators, { kind: "method", name: "status", static: false, private: false, access: { has: obj => "status" in obj, get: obj => obj.status }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _authenticate_decorators, { kind: "method", name: "authenticate", static: false, private: false, access: { has: obj => "authenticate" in obj, get: obj => obj.authenticate }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _refresh_decorators, { kind: "method", name: "refresh", static: false, private: false, access: { has: obj => "refresh" in obj, get: obj => obj.refresh }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _logout_decorators, { kind: "method", name: "logout", static: false, private: false, access: { has: obj => "logout" in obj, get: obj => obj.logout }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        static inject = inject;
        static Config = Config;
        url = __runInitializers(this, _instanceExtraInitializers);
        serverName;
        authTimeoutMs;
        toolCallTimeoutMs;
        database;
        store;
        promptDisposers = new Map();
        tools = new Map();
        phase = 'disconnected';
        message = '尚未登录 PandaData。';
        live;
        closeLive;
        authTail;
        publicOrigin;
        callbackPort;
        authorizationUrl;
        authorizationReady;
        resolveAuthorization;
        authController;
        connector;
        openAuthorization = (url) => openSystemBrowser(url.href);
        constructor(ctx, config) {
            super(ctx, 'pandaMcp');
            this.url = validateHttpUrl(config.url ?? DEFAULT_PANDA_MCP_URL);
            const origin = config.publicOrigin?.trim() || process.env.QUANTSKILLS_PUBLIC_URL?.trim();
            if (origin) {
                const parsed = new URL(validateHttpUrl(origin));
                if (parsed.pathname !== '/' || parsed.search)
                    throw new Error('PandaData publicOrigin 必须是 HTTPS 站点来源。');
                this.publicOrigin = parsed.origin;
            }
            this.callbackPort = config.callbackPort ?? 3197;
            if (!Number.isInteger(this.callbackPort) || this.callbackPort < 0 || this.callbackPort > 65535)
                throw new Error('PandaData callbackPort 无效。');
            this.serverName = config.serverName ?? 'pandadata';
            if (!/^[A-Za-z0-9_-]{1,32}$/.test(this.serverName)) {
                throw new Error('panda-mcp: serverName 必须匹配 [A-Za-z0-9_-]{1,32}');
            }
            this.authTimeoutMs = config.authTimeoutMs ?? 300_000;
            this.toolCallTimeoutMs = config.toolCallTimeoutMs ?? 60_000;
            const specifiedHome = config.dshHome?.trim();
            this.store = new PandaMcpOAuthStore(pandaMcpOAuthPath(resolveDshHome(specifiedHome === undefined || specifiedHome.length === 0 ? undefined : specifiedHome)));
            this.database = new LocalDatabase(join(resolveDshHome(specifiedHome || undefined), 'quantskills', 'database'), async (method, params, signal) => {
                if (!this.live)
                    await this.refresh(signal);
                if (!this.live)
                    throw new Error('请先在设置中连接 PandaData');
                return callConnectedTool(this.live, 'call_pandadata', { method, params }, signal, async () => { this.phase = 'needs_auth'; await this.store.clear('tokens'); this.replaceWithStubs(); });
            });
            this.installDatabaseTools();
            this.installPrompts();
            this.tools = this.mountStubs();
            ctx.effect(() => async () => {
                this.authController?.abort();
                await this.authTail;
                this.disposePrompts();
                disposeTools(this.tools);
                await this.closeLive?.();
            }, 'panda-mcp.lifecycle');
            void this.restoreExistingTokens();
        }
        databaseList(signal) { void signal; return this.database.list(); }
        databaseImport(input, signal) { void signal; return this.database.import(input); }
        databaseFetch(input, signal) { return this.database.fetch(input, signal); }
        databaseQuery(input, signal) { return this.database.query(input, signal); }
        databasePreview(input, signal) { void signal; return this.database.preview(input.id); }
        databaseRefresh(input, signal) { return this.database.preview(input.id).then(({ dataset }) => this.database.fetch(dataset, signal, dataset.id)); }
        databaseRemove(input, signal) { void signal; return this.database.remove(input.id); }
        databaseCategorize(input, signal) { void signal; return this.database.categorize(input.id, input.category); }
        installDatabaseTools() {
            const register = (name, description, properties, required, execute) => {
                this.ctx.effect(() => this.ctx.tools.register({ name, description, parameters: { type: 'object', properties, required, additionalProperties: false }, output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] }, execute: (args, exec) => execute(args, exec.signal) }), name);
            };
            register('quantskills_data_catalog', 'List local cached datasets by research category (market: quotes/prices; news: news/announcements; fundamental: company financials/valuation; other), source, date coverage, row count and expiry. Category is independent of whether data has dates. Always check before fetching external data.', {}, [], () => this.database.list().then(datasets => ({ datasets })));
            register('quantskills_data_query', 'Read local data first. Refresh remote source once when stale or insufficient. Only consume rows if status is hit/refreshed. Do not use insufficient results; ask for source parameters or new import.', { id: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' }, minRows: { type: 'integer', minimum: 1 }, limit: { type: 'integer', minimum: 1, maximum: 5000 }, offset: { type: 'integer', minimum: 0 }, refresh: { type: 'boolean' } }, ['id'], (args, signal) => this.database.query(args, signal));
        }
        /** 测试替换会话工厂。 */
        useConnector(connector) {
            this.connector = connector;
        }
        /** 测试替换打开浏览器。 */
        useOpenAuthorization(openAuthorization) {
            this.openAuthorization = openAuthorization;
        }
        status(signal) {
            void signal;
            return Promise.resolve(this.snapshot());
        }
        authenticate(signal) {
            const completion = this.ensureAuthenticated(this.publicOrigin ? undefined : signal);
            return this.publicOrigin && this.authorizationReady
                ? Promise.race([completion, this.authorizationReady.then(() => this.snapshot())])
                : completion;
        }
        /** 用已保存 token 静默重连；没有 token 时只返回当前状态，不打开浏览器。 */
        async refresh(signal) {
            if (this.phase === 'connected' && this.live !== undefined)
                return this.snapshot();
            await this.store.load();
            if (!this.store.hasAccessToken())
                return this.snapshot();
            try {
                await this.connectLive({
                    interactive: false,
                    ...signal === undefined ? {} : { signal },
                });
            }
            catch {
                this.phase = 'needs_auth';
                this.message = '已保存的 PandaData 登录已失效，请重新登录。';
                this.replaceWithStubs();
            }
            return this.snapshot();
        }
        async logout(signal) {
            void signal;
            this.authController?.abort();
            await this.authTail;
            await this.dropLive();
            await this.store.clear('all');
            this.phase = 'disconnected';
            this.message = '已退出 PandaData 登录。';
            this.replaceWithStubs();
            return this.snapshot();
        }
        snapshot() {
            return {
                ok: true,
                phase: this.phase,
                url: this.url,
                toolCount: this.tools.size,
                toolNames: [...this.tools.keys()],
                message: this.message,
                ...(this.phase === 'authenticating' && this.authorizationUrl ? { authorizationUrl: this.authorizationUrl } : {}),
            };
        }
        async restoreExistingTokens() {
            await this.store.load();
            if (!this.store.hasAccessToken())
                return;
            try {
                await this.connectLive({ interactive: false });
            }
            catch {
                this.phase = 'needs_auth';
                this.message = '已保存的 PandaData 登录已失效，请重新登录。';
                this.replaceWithStubs();
            }
        }
        async ensureAuthenticated(signal) {
            if (this.phase === 'connected' && this.live !== undefined)
                return this.snapshot();
            if (this.authTail !== undefined)
                return this.authTail;
            this.authTail = this.runAuthentication(signal).finally(() => {
                this.authTail = undefined;
            });
            return this.authTail;
        }
        async runAuthentication(signal) {
            this.authorizationUrl = undefined;
            this.authorizationReady = new Promise(resolve => { this.resolveAuthorization = resolve; });
            if (this.store.hasAccessToken()) {
                try {
                    await this.connectLive({
                        interactive: false,
                        ...signal === undefined ? {} : { signal },
                    });
                    return this.snapshot();
                }
                catch {
                    this.phase = 'needs_auth';
                }
            }
            this.phase = 'authenticating';
            this.message = '正在打开 PandaData 登录页。';
            const controller = new AbortController();
            this.authController = controller;
            const timeout = setTimeout(() => { controller.abort(); }, this.authTimeoutMs);
            const onAbort = () => { controller.abort(); };
            signal?.addEventListener('abort', onAbort, { once: true });
            let loopback;
            try {
                loopback = await startOauthLoopback(this.publicOrigin ? { publicOrigin: this.publicOrigin, port: this.callbackPort } : {});
                // Dynamic registration binds the client to this loopback port.
                await this.store.clear('client');
                await this.connectLive({
                    interactive: true,
                    redirectUrl: loopback.redirectUrl,
                    waitForCode: () => loopback.waitForCode(controller.signal),
                    state: loopback.state,
                    signal: controller.signal,
                });
                return this.snapshot();
            }
            catch (error) {
                this.phase = error instanceof UnauthorizedError || controller.signal.aborted ? 'needs_auth' : 'error';
                this.message = controller.signal.aborted
                    ? 'PandaData 登录已取消或超时。'
                    : `PandaData 登录失败，请重试。${authErrorHint(error)}`;
                this.replaceWithStubs();
                return this.snapshot();
            }
            finally {
                clearTimeout(timeout);
                signal?.removeEventListener('abort', onAbort);
                this.authorizationUrl = undefined;
                this.authController = undefined;
                await loopback?.close();
            }
        }
        async connectLive(options) {
            await this.dropLive();
            const interactive = options?.interactive === true;
            const redirectUrl = options?.redirectUrl ?? 'http://127.0.0.1/callback';
            const waitForCode = options?.waitForCode ?? (async () => {
                throw new UnauthorizedError('PandaData 登录需要浏览器授权。');
            });
            const openAuthorization = interactive
                ? (url) => {
                    if (!this.publicOrigin)
                        return this.openAuthorization(url);
                    this.authorizationUrl = url.href;
                    this.message = '请在浏览器中完成 PandaData 授权。';
                    this.resolveAuthorization?.();
                }
                : () => { throw new UnauthorizedError('PandaData 需要重新登录。'); };
            const session = this.connector === undefined
                ? await connectPublicPandaMcp({
                    url: this.url,
                    store: this.store,
                    redirectUrl,
                    openAuthorization,
                    waitForCode,
                    ...(options?.state === undefined ? {} : { state: options.state }),
                    ...options?.signal === undefined ? {} : { signal: options.signal },
                })
                : await this.connector.connect({
                    url: this.url,
                    store: this.store,
                    redirectUrl,
                    openAuthorization,
                    ...options?.signal === undefined ? {} : { signal: options.signal },
                });
            this.live = { client: session.client, toolCallTimeoutMs: this.toolCallTimeoutMs };
            this.closeLive = session.close;
            const liveTools = await syncLiveTools(this.ctx, this.live, this.serverName, this.tools, async () => {
                this.phase = 'needs_auth';
                this.message = 'PandaData 登录已过期，请重新登录。';
                await this.store.clear('tokens');
                this.replaceWithStubs();
            }, (rawName, args, call) => rawName === 'call_pandadata' ? this.database.cachedPanda(args, call) : call());
            this.tools = liveTools;
            this.phase = 'connected';
            this.message = '已连接 PandaData MCP。';
        }
        async dropLive() {
            const close = this.closeLive;
            this.closeLive = undefined;
            this.live = undefined;
            if (close !== undefined)
                await close();
        }
        mountStubs() {
            return registerStubTools(this.ctx, this.serverName, () => this.snapshot(), (signal) => this.ensureAuthenticated(signal), async (rawName, args, signal) => {
                if (this.live === undefined)
                    return { ok: false, error: 'reauth_required', message: '尚未登录 PandaData。' };
                const call = () => callConnectedTool(this.live, rawName, args, signal, async () => {
                    this.phase = 'needs_auth';
                    this.message = 'PandaData 登录已过期，请重新登录。';
                    await this.store.clear('tokens');
                    this.replaceWithStubs();
                });
                return rawName === 'call_pandadata' ? this.database.cachedPanda(args, call) : call();
            });
        }
        replaceWithStubs() {
            disposeTools(this.tools);
            this.tools = this.mountStubs();
        }
        installPrompts() {
            const maybeInstall = (agent) => {
                if (this.promptDisposers.has(agent))
                    return;
                this.promptDisposers.set(agent, agent.ctx.systemPrompt.section({
                    name: 'panda-mcp:policy',
                    order: 70,
                    text: () => POLICY.replaceAll('mcp__pandadata__', `mcp__${this.serverName}__`),
                }));
            };
            for (const agent of this.ctx.agents.list())
                maybeInstall(agent);
            this.ctx.on('agent/created', ({ agent }) => { maybeInstall(agent); });
            this.ctx.on('agent/disposed', ({ agent }) => {
                this.promptDisposers.get(agent)?.();
                this.promptDisposers.delete(agent);
            });
        }
        disposePrompts() {
            for (const dispose of this.promptDisposers.values())
                dispose();
            this.promptDisposers.clear();
        }
    };
})();
export { PandaMcpGateway };
export default PandaMcpGateway;
/** 测试辅助：默认公开工具名。 */
export function pandaMcpPublicNames(serverName = 'pandadata') {
    return PANDA_MCP_TOOL_NAMES.map(rawName => publicToolName(serverName, rawName));
}
//# sourceMappingURL=index.js.map