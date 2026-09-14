import { dirname, join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import z from "@deepseek-ai/schemastery";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { ListToolsResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { z as z$1 } from "zod";
//#region lib/types/data-category.js
const DATA_CATEGORIES = [
	"market",
	"news",
	"fundamental",
	"other"
];
function inferDataCategory(input) {
	if (input.category && DATA_CATEGORIES.includes(input.category)) return input.category;
	const classify = (text) => {
		if (/(?:^|[^a-z])(news|headline|article|announcement|notice)(?:[^a-z]|$)|新闻|资讯|快讯|公告|舆情/i.test(text)) return "news";
		if (/(?:^|[^a-z])(fina|financial|fundamental|balance|income|cashflow|valuation|dividend|shareholder|company|companies)(?:[^a-z]|$)|基本面|财务|财报|业绩|估值|股东|公司资料|企业名录|分红/i.test(text)) return "fundamental";
		if (/(?:^|[^a-z])(quote|quotes|price|prices|ohlcv|kline|tick|ticks|daily|minute|intraday|bar|bars|market|orderbook|trade|trades)(?:[^a-z]|$)|行情|价格|成交|盘口|逐笔|日线|分钟线|K线/i.test(text)) return "market";
	};
	const named = classify(input.source?.method ?? "") ?? classify(input.name);
	if (named) return named;
	const columns = new Set((input.columns ?? []).map((column) => column.toLowerCase()));
	if ([
		"headline",
		"news_title",
		"article_title",
		"新闻标题"
	].some((column) => columns.has(column)) || columns.has("title") && [
		"content",
		"url",
		"published_at",
		"pub_time"
	].some((column) => columns.has(column))) return "news";
	if ([...columns].some((column) => /^(bs_|is_|cfs_|roe|eps|revenue|net_profit|total_assets|equity_parent)/.test(column)) || [
		"营收",
		"净利润",
		"总资产"
	].some((column) => columns.has(column))) return "fundamental";
	if ([
		"close",
		"open",
		"last_price",
		"bid_price",
		"ask_price",
		"收盘价",
		"开盘价"
	].some((column) => columns.has(column))) return "market";
	return "other";
}
//#endregion
//#region lib/types/database.js
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 1e5;
const canonical = (value) => Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : value && typeof value === "object" ? `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}` : JSON.stringify(value) ?? "null";
const summary = ({ rows: _rows, raw: _raw, ...item }) => item;
function validId(id) {
	if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error("无效的数据集标识");
	return id;
}
function instant(value) {
	if (typeof value === "number" && /^\d{8}$/.test(String(value))) return instant(String(value));
	if (typeof value === "number") return value > 1e11 ? value : value > 1e9 ? value * 1e3 : NaN;
	if (typeof value !== "string" || !value.trim()) return NaN;
	const date = /^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : value;
	return Date.parse(date);
}
function boundary(value, end = false) {
	if (value === void 0 || value === "") return void 0;
	const date = instant(value);
	if (!Number.isFinite(date)) throw new Error("日期格式无效，请使用 YYYY-MM-DD 或 ISO 时间");
	return date + (end && /^\d{4}-\d{2}-\d{2}$/.test(value) ? 86399999 : 0);
}
const DATE_COLUMNS = [
	"published_at",
	"pub_time",
	"publish_time",
	"pub_date",
	"ann_date",
	"info_date",
	"trade_date",
	"date",
	"datetime",
	"time",
	"timestamp",
	"report_date",
	"end_date",
	"发布日期",
	"公告日期",
	"日期",
	"时间"
];
function detectDateColumn(rows, columns) {
	return DATE_COLUMNS.map((name) => columns.find((column) => column.toLowerCase() === name)).find((column) => column !== void 0 && rows.every((row) => Number.isFinite(instant(row[column]))));
}
/** RFC 4180 style quoting, including quoted newlines and escaped double quotes. */
function parseCsv(text) {
	const matrix = [];
	let row = [], cell = "", quoted = false;
	text = text.replace(/^\uFEFF/, "");
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (c === "\"") if (quoted && text[i + 1] === "\"") {
			cell += "\"";
			i++;
		} else if (quoted || cell === "") quoted = !quoted;
		else cell += c;
		else if (c === "," && !quoted) {
			row.push(cell);
			cell = "";
		} else if ((c === "\n" || c === "\r") && !quoted) {
			if (c === "\r" && text[i + 1] === "\n") i++;
			row.push(cell);
			if (row.some(Boolean)) matrix.push(row);
			row = [];
			cell = "";
		} else cell += c;
	}
	if (quoted) throw new Error("CSV 引号未闭合");
	row.push(cell);
	if (row.some(Boolean)) matrix.push(row);
	const headers = matrix.shift()?.map((h) => h.trim()) ?? [];
	if (!headers.length || headers.some((h) => !h) || new Set(headers).size !== headers.length) throw new Error("CSV 需要非空且不重复的列名");
	return matrix.map((values, i) => {
		if (values.length !== headers.length) throw new Error(`CSV 第 ${i + 2} 行列数不一致`);
		return Object.fromEntries(headers.map((h, j) => [h, values[j]]));
	});
}
function dataRows(raw) {
	if (typeof raw === "string") return dataRows(JSON.parse(raw));
	if (Array.isArray(raw)) {
		if (raw.every((item) => item !== null && typeof item === "object" && !Array.isArray(item))) return raw;
		throw new Error("JSON 必须是对象数组，或包含 data / rows / records 的对象");
	}
	if (raw && typeof raw === "object") {
		const obj = raw;
		if (obj.error || obj.isError === true || obj.success === false || obj.ok === false || obj.status === "error") throw new Error("数据源返回错误，未写入缓存");
		if (Array.isArray(obj.columns) && Array.isArray(obj.data) && obj.data.every(Array.isArray)) return obj.data.map((row) => Object.fromEntries(obj.columns.map((c, i) => [String(c), row[i]])));
		for (const key of [
			"data",
			"rows",
			"records",
			"result",
			"items"
		]) if (obj[key] !== void 0) return dataRows(obj[key]);
	}
	throw new Error("没有识别到表格数据；请检查接口返回格式");
}
var LocalDatabase = class {
	root;
	panda;
	now;
	tail = Promise.resolve();
	constructor(root, panda, now = Date.now) {
		this.root = root;
		this.panda = panda;
		this.now = now;
	}
	path(id) {
		return join(this.root, `${validId(id)}.json`);
	}
	async read(id) {
		const doc = JSON.parse(await readFile(this.path(id), "utf8"));
		return {
			...doc,
			category: inferDataCategory(doc)
		};
	}
	mutate(fn) {
		const job = this.tail.then(fn);
		this.tail = job.catch(() => {});
		return job;
	}
	async write(doc) {
		doc.bytes = Buffer.byteLength(JSON.stringify(doc));
		if (doc.bytes > MAX_BYTES) throw new Error("单个数据集不能超过 10 MB");
		await mkdir(this.root, { recursive: true });
		const temp = join(this.root, `${validId(doc.id)}.${randomUUID()}.tmp`);
		try {
			await writeFile(temp, JSON.stringify(doc), { flag: "wx" });
			await rename(temp, this.path(doc.id));
		} finally {
			await rm(temp, { force: true });
		}
		return doc;
	}
	async list() {
		await this.tail;
		await mkdir(this.root, { recursive: true });
		const items = [];
		for (const entry of await readdir(this.root, { withFileTypes: true })) if (entry.isFile() && /^[\w-]+\.json$/.test(entry.name)) items.push(summary(await this.read(entry.name.slice(0, -5))));
		return items.sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt));
	}
	async save(input, rows, id = randomUUID(), raw) {
		if (!input.name.trim() || input.name.length > 160) throw new Error("请输入 1–160 字的数据集名称");
		if (![
			"timeseries",
			"table",
			"auto"
		].includes(input.kind)) throw new Error("数据日期设置无效");
		if (input.category !== void 0 && !DATA_CATEGORIES.includes(input.category)) throw new Error("数据分类无效");
		if (!Number.isFinite(input.ttlSeconds) || input.ttlSeconds < 1 || input.ttlSeconds > 31536e3) throw new Error("缓存有效期应为 1 秒至 365 天");
		if (!rows.length || rows.length > MAX_ROWS) throw new Error("数据集需要 1–100000 行");
		const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
		if (columns.length > 500) throw new Error("最多支持 500 列");
		const dateColumn = input.dateColumn?.trim() || (input.kind !== "table" ? detectDateColumn(rows, columns) : void 0);
		const kind = input.kind === "auto" ? dateColumn ? "timeseries" : "table" : input.kind;
		let from, to;
		if (kind === "timeseries") {
			if (!dateColumn || !columns.includes(dateColumn)) throw new Error("按日期查询需要指定有效的日期列");
			const dates = rows.map((row) => instant(row[dateColumn]));
			if (dates.some((d) => !Number.isFinite(d))) throw new Error("日期列包含空值或无法识别的日期");
			from = new Date(Math.min(...dates)).toISOString();
			to = new Date(Math.max(...dates)).toISOString();
		}
		const doc = {
			...input,
			kind,
			category: inferDataCategory({
				...input,
				columns
			}),
			...dateColumn ? { dateColumn } : {},
			id,
			rows,
			columns,
			rowCount: rows.length,
			fetchedAt: new Date(this.now()).toISOString(),
			expiresAt: new Date(this.now() + input.ttlSeconds * 1e3).toISOString(),
			...from ? {
				from,
				to
			} : {},
			bytes: 0,
			...raw === void 0 ? {} : { raw }
		};
		return this.mutate(() => this.write(doc));
	}
	async import(input) {
		if (Buffer.byteLength(input.content) > MAX_BYTES) throw new Error("文件不能超过 10 MB");
		const rows = input.format === "csv" ? parseCsv(input.content) : dataRows(JSON.parse(input.content.replace(/^\uFEFF/, "")));
		return summary(await this.save({
			name: input.name,
			kind: input.kind,
			...input.category ? { category: input.category } : {},
			ttlSeconds: input.ttlSeconds,
			...input.dateColumn ? { dateColumn: input.dateColumn } : {},
			source: { kind: "file" }
		}, rows));
	}
	async sourceData(source, signal) {
		if (source.kind === "pandadata") {
			if (!source.method?.startsWith("get_")) throw new Error("PandaData 仅支持已查阅文档的 get_* 方法");
			return this.panda(source.method, source.params ?? {}, signal);
		}
		if (source.kind !== "http" || !source.url) throw new Error("本地导入数据需重新上传文件，不能在线刷新");
		const url = new URL(source.url);
		if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("请输入不含账号密码的 HTTP(S) 数据地址");
		const timeout = AbortSignal.timeout(3e4);
		const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
		if (!response.ok) throw new Error(`数据源返回 HTTP ${response.status}`);
		if (Number(response.headers.get("content-length")) > MAX_BYTES) {
			await response.body?.cancel();
			throw new Error("数据源返回超过 10 MB");
		}
		const reader = response.body?.getReader();
		if (!reader) throw new Error("数据源没有返回内容");
		const chunks = [];
		let bytes = 0;
		try {
			while (true) {
				const part = await reader.read();
				if (part.done) break;
				bytes += part.value.length;
				if (bytes > MAX_BYTES) throw new Error("数据源返回超过 10 MB");
				chunks.push(part.value);
			}
		} finally {
			await reader.cancel();
		}
		const text = Buffer.concat(chunks).toString("utf8").replace(/^\uFEFF/, "");
		return /csv/i.test(response.headers.get("content-type") ?? "") || /\.csv$/i.test(url.pathname) ? parseCsv(text) : JSON.parse(text);
	}
	async fetch(input, signal, id) {
		const raw = await this.sourceData(input.source, signal);
		return summary(await this.save(input, dataRows(raw), id));
	}
	async query(query, signal) {
		const from = boundary(query.from), to = boundary(query.to, true);
		if (from !== void 0 && to !== void 0 && from > to) throw new Error("开始日期不能晚于结束日期");
		const minRows = query.minRows ?? 1, limit = query.limit ?? 100, offset = query.offset ?? 0;
		if (![
			minRows,
			limit,
			offset
		].every(Number.isInteger) || minRows < 0 || minRows > MAX_ROWS || limit < 1 || limit > 5e3 || offset < 0) throw new Error("条数或分页参数无效（每页最多 5000 行）");
		let doc = await this.read(query.id), refreshed = false;
		const filtered = () => doc.rows.filter((row) => {
			if (from === void 0 && to === void 0) return true;
			const value = instant(row[doc.dateColumn ?? ""]);
			return (from === void 0 || value >= from) && (to === void 0 || value <= to);
		});
		const reasons = () => {
			const out = [];
			if (this.now() >= Date.parse(doc.expiresAt)) out.push("缓存已过期");
			if ((from !== void 0 || to !== void 0) && !doc.dateColumn) out.push("这份数据没有可用于范围查询的日期列");
			if (from !== void 0 && (!doc.from || Date.parse(doc.from) > from)) out.push("开始日期覆盖不足");
			if (to !== void 0 && (!doc.to || Date.parse(doc.to) < boundary(query.to))) out.push("结束日期覆盖不足");
			if (filtered().length < minRows) out.push(`可用行数不足 ${minRows}`);
			return out;
		};
		if (reasons().length && query.refresh !== false && doc.source.kind !== "file") {
			const input = {
				name: doc.name,
				kind: doc.kind,
				category: doc.category,
				source: doc.source,
				ttlSeconds: doc.ttlSeconds,
				...doc.dateColumn ? { dateColumn: doc.dateColumn } : {}
			};
			if (input.source.kind === "pandadata" && input.source.params) {
				const params = { ...input.source.params };
				if (query.from && "start_date" in params) params.start_date = /^\d{8}$/.test(String(params.start_date)) ? query.from.replaceAll("-", "") : query.from;
				if (query.to && "end_date" in params) params.end_date = /^\d{8}$/.test(String(params.end_date)) ? query.to.replaceAll("-", "") : query.to;
				if (typeof params.limit === "number") params.limit = Math.max(params.limit, minRows);
				input.source = {
					...input.source,
					params
				};
			}
			await this.fetch(input, signal, doc.id);
			doc = await this.read(doc.id);
			refreshed = true;
		}
		const missing = reasons(), rows = filtered();
		return {
			dataset: summary(doc),
			status: missing.length ? "insufficient" : refreshed ? "refreshed" : "hit",
			reasons: missing,
			rows: missing.length ? [] : rows.slice(offset, offset + limit),
			total: rows.length,
			...!missing.length && offset + limit < rows.length ? { nextOffset: offset + limit } : {}
		};
	}
	/** Preview is explicitly allowed to show stale rows, and always returns freshness metadata. */
	async preview(id) {
		const doc = await this.read(id);
		return {
			dataset: summary(doc),
			status: this.now() >= Date.parse(doc.expiresAt) ? "insufficient" : "hit",
			reasons: this.now() >= Date.parse(doc.expiresAt) ? ["缓存已过期"] : [],
			rows: doc.rows.slice(0, 100),
			total: doc.rowCount
		};
	}
	async remove(id) {
		await this.mutate(() => rm(this.path(id), { force: true }));
	}
	async categorize(id, category) {
		if (!DATA_CATEGORIES.includes(category)) throw new Error("数据分类无效");
		return this.mutate(async () => summary(await this.write({
			...await this.read(id),
			category
		})));
	}
	async cachedPanda(args, call) {
		const method = String(args.method ?? "");
		const params = typeof args.params_json === "string" ? JSON.parse(args.params_json) : args.params ?? {};
		const id = `panda-${createHash("sha256").update(canonical({
			method,
			params
		})).digest("hex").slice(0, 32)}`;
		let previous;
		try {
			previous = await this.read(id);
			if (previous.raw !== void 0 && this.now() < Date.parse(previous.expiresAt)) return previous.raw;
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
		const raw = await call();
		try {
			const rows = dataRows(raw);
			await this.save({
				name: method,
				source: {
					kind: "pandadata",
					method,
					params
				},
				kind: "auto",
				...previous ? { category: previous.category } : {},
				ttlSeconds: 300
			}, rows, id, raw);
		} catch {}
		return raw;
	}
};
//#endregion
//#region lib/types/browser.js
/** 用系统浏览器打开远端 OAuth 授权页。 */
/**
* Resolve a shell-free browser launch so OAuth query parameters stay intact.
* @param href - Complete authorization URL.
* @param platform - Runtime platform.
* @returns Executable and arguments passed directly to the operating system.
*/
function systemBrowserLaunch(href, platform = process.platform) {
	const url = new URL(href);
	if (platform === "win32") return {
		command: "rundll32.exe",
		args: ["url.dll,FileProtocolHandler", url.href]
	};
	return {
		command: platform === "darwin" ? "open" : "xdg-open",
		args: [url.href]
	};
}
/**
* 打开系统默认浏览器。失败时抛出不含 URL 查询串的错误。
* @param href - 完整授权 URL。
*/
function openSystemBrowser(href) {
	const launch = systemBrowserLaunch(href);
	spawn(launch.command, launch.args, {
		detached: true,
		stdio: "ignore",
		windowsHide: true
	}).unref();
}
//#endregion
//#region lib/types/callback-server.js
/** 本机回环回调，只接收 OAuth code，登录页仍在公网 MCP。 */
const SUCCESS_HTML = `<!doctype html><meta charset="utf-8"><title>PandaData</title>
<body style="font-family:sans-serif;padding:48px;line-height:1.5">
<p>授权码已收到。请关闭此窗口，返回 QuantSkills 查看连接状态。</p>
</body>`;
const FAILURE_HTML = `<!doctype html><meta charset="utf-8"><title>PandaData</title>
<body style="font-family:sans-serif;padding:48px;line-height:1.5">
<p>登录未完成。请关闭此窗口后在 QuantSkills 设置中重试。</p>
</body>`;
/**
* 在 127.0.0.1 随机端口监听 `/callback`。
*/
async function startOauthLoopback() {
	let settle;
	const pending = new Promise((resolve) => {
		settle = resolve;
	});
	const server = createServer((request, response) => {
		handleCallback(request, response, (result) => {
			settle?.(result);
			settle = void 0;
		});
	});
	await listenLoopback(server);
	const address = server.address();
	if (address === null || typeof address === "string") {
		server.close();
		throw new Error("PandaData MCP 无法绑定本机回环端口。");
	}
	return {
		redirectUrl: `http://127.0.0.1:${address.port}/callback`,
		waitForCode: async (signal) => {
			const abort = () => {
				settle?.({ error: /* @__PURE__ */ new Error("PandaData 登录已取消。") });
				settle = void 0;
			};
			if (signal?.aborted) abort();
			signal?.addEventListener("abort", abort, { once: true });
			try {
				const result = await pending;
				if (result.error !== void 0) throw result.error;
				if (result.code === void 0 || result.code.length === 0) throw new Error("PandaData 登录未返回授权码。");
				return result.code;
			} finally {
				signal?.removeEventListener("abort", abort);
			}
		},
		close: () => closeServer(server)
	};
}
function listenLoopback(server) {
	return new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			server.off("error", reject);
			resolve();
		});
	});
}
function closeServer(server) {
	return new Promise((resolve, reject) => {
		server.close((error) => {
			if (error) reject(error);
			else resolve();
		});
	});
}
function handleCallback(request, response, done) {
	const host = request.headers.host ?? "127.0.0.1";
	const url = new URL(request.url ?? "/", `http://${host}`);
	if (url.pathname !== "/callback") {
		response.writeHead(404).end();
		return;
	}
	const error = url.searchParams.get("error");
	const code = url.searchParams.get("code");
	if (error !== null || code === null || code.length === 0) {
		response.writeHead(400, { "content-type": "text/html; charset=utf-8" }).end(FAILURE_HTML);
		done({ error: /* @__PURE__ */ new Error("PandaData 登录未完成。") });
		return;
	}
	response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(SUCCESS_HTML);
	done({ code });
}
//#endregion
//#region lib/types/oauth-provider.js
/** MCP SDK 所需的 OAuthClientProvider：token 只进 OAuthStore。 */
/**
* 文件持久化的 MCP OAuth 客户端。
*/
var PandaMcpOAuthProvider = class {
	store;
	redirect;
	openAuthorization;
	constructor(store, redirect, openAuthorization) {
		this.store = store;
		this.redirect = redirect;
		this.openAuthorization = openAuthorization;
	}
	get redirectUrl() {
		return this.redirect;
	}
	get clientMetadata() {
		return {
			client_name: "QuantSkills DSH",
			redirect_uris: [this.redirect],
			grant_types: ["authorization_code", "refresh_token"],
			response_types: ["code"],
			token_endpoint_auth_method: "none"
		};
	}
	clientInformation() {
		return this.store.current().client;
	}
	async saveClientInformation(clientInformation) {
		await this.store.saveClient(clientInformation);
	}
	tokens() {
		return this.store.current().tokens;
	}
	async saveTokens(tokens) {
		await this.store.saveTokens(tokens);
	}
	async redirectToAuthorization(authorizationUrl) {
		await this.openAuthorization(authorizationUrl);
	}
	async saveCodeVerifier(codeVerifier) {
		await this.store.saveCodeVerifier(codeVerifier);
	}
	async codeVerifier() {
		const verifier = this.store.current().codeVerifier;
		if (verifier === void 0 || verifier.length === 0) throw new Error("PandaData MCP 缺少 PKCE verifier。");
		return verifier;
	}
	async invalidateCredentials(scope) {
		if (scope === "discovery") return;
		await this.store.clear(scope);
	}
};
//#endregion
//#region lib/types/oauth-store.js
/** 把 MCP OAuth 客户端信息和 token 写到 DSH home，不进日志或 Remote。 */
/**
* 读写 `$DSH_HOME/quantskills/panda-mcp/oauth.json`。
*/
var PandaMcpOAuthStore = class {
	filePath;
	snapshot = {};
	constructor(filePath) {
		this.filePath = filePath;
	}
	/** 从磁盘恢复；文件损坏则当作未登录。 */
	async load() {
		try {
			const raw = JSON.parse(await readFile(this.filePath, "utf8"));
			this.snapshot = {
				...raw.client === void 0 ? {} : { client: raw.client },
				...raw.tokens === void 0 ? {} : { tokens: raw.tokens },
				...raw.codeVerifier === void 0 ? {} : { codeVerifier: raw.codeVerifier }
			};
		} catch {
			this.snapshot = {};
		}
		return this.snapshot;
	}
	/** 当前内存快照。 */
	current() {
		return this.snapshot;
	}
	/** 是否已有 access token。 */
	hasAccessToken() {
		const token = this.snapshot.tokens?.access_token;
		return typeof token === "string" && token.length > 0;
	}
	async saveClient(client) {
		this.snapshot = {
			...this.snapshot,
			client
		};
		await this.persist();
	}
	async saveTokens(tokens) {
		this.snapshot = {
			...this.snapshot,
			tokens
		};
		await this.persist();
	}
	async saveCodeVerifier(codeVerifier) {
		this.snapshot = {
			...this.snapshot,
			codeVerifier
		};
		await this.persist();
	}
	async clear(scope = "all") {
		if (scope === "all") {
			this.snapshot = {};
			await rm(this.filePath, { force: true });
			return;
		}
		const next = { ...this.snapshot };
		if (scope === "client") delete next.client;
		if (scope === "tokens") delete next.tokens;
		if (scope === "verifier") delete next.codeVerifier;
		this.snapshot = next;
		if (next.client === void 0 && next.tokens === void 0 && next.codeVerifier === void 0) {
			await rm(this.filePath, { force: true });
			return;
		}
		await this.persist();
	}
	async persist() {
		await mkdir(dirname(this.filePath), { recursive: true });
		await writeFile(this.filePath, JSON.stringify(this.snapshot), {
			encoding: "utf8",
			mode: 384
		});
		await chmod(this.filePath, 384);
	}
};
/** OAuth 文件相对 DSH home 的路径。 */
function pandaMcpOAuthPath(dshHome) {
	return join(dshHome, "quantskills", "panda-mcp", "oauth.json");
}
//#endregion
//#region lib/types/public-name.js
/** 与 @deepseek-ai/dsh-mcp-client 相同的公开工具名规则。 */
const MAX_PUBLIC_NAME_LENGTH = 64;
const INVALID_NAME_CHARS = /[^A-Za-z0-9_-]/g;
const HASH_LENGTH = 12;
/**
* 由 (serverName, rawName) 得到模型可见工具名。
* @param serverName - 本地 MCP 命名空间。
* @param rawName - 远端 MCP 工具名。
*/
function publicToolName(serverName, rawName) {
	const joined = `mcp__${serverName}__${rawName}`;
	const normalized = joined.replace(INVALID_NAME_CHARS, "_");
	if (normalized === joined && normalized.length <= MAX_PUBLIC_NAME_LENGTH) return normalized;
	const hash = createHash("sha256").update(`${serverName}\0${rawName}`).digest("hex").slice(0, HASH_LENGTH);
	return `${normalized.slice(0, MAX_PUBLIC_NAME_LENGTH - HASH_LENGTH - 1)}_${hash}`;
}
//#endregion
//#region lib/types/types.js
/** 给 UI 和 Remote 用的 PandaData MCP 连接状态；永不包含 token。 @module @deepseek-ai/dsh-panda-mcp/types */
/** 公网 PandaData MCP 默认地址。 */
const DEFAULT_PANDA_MCP_URL = "https://pandadatamcp.pandaaiquant.com/mcp";
/** 模型可见工具的远端原始名称。 */
const PANDA_MCP_TOOL_NAMES = [
	"auth_status",
	"sdk_status",
	"list_methods",
	"search_methods",
	"get_method_doc",
	"call_pandadata"
];
//#endregion
//#region lib/types/tools.js
/** 把远端 MCP 工具注册到 ctx.tools；未登录时挂本地桩。 */
const RawCallToolResultSchema = z$1.record(z$1.string(), z$1.unknown());
const STUB_DESCRIPTIONS = {
	auth_status: "Report PandaData MCP OAuth session status. Does not open a login page.",
	sdk_status: "Report public PandaData MCP service status.",
	list_methods: "List documented PandaData get_* methods. Requires PandaData login.",
	search_methods: "Search documented PandaData methods. Requires PandaData login.",
	get_method_doc: "Return documentation for one PandaData method. Requires PandaData login.",
	call_pandadata: "Call a documented PandaData get_* method. Requires PandaData login."
};
/**
* 未登录时给模型看的固定错误。
*/
function reauthRequired(message = "请在 QuantSkills 设置的 PandaData 分区登录，不要向模型发送密码。") {
	return {
		ok: false,
		error: "reauth_required",
		message
	};
}
function stubParameters(name) {
	if (name === "search_methods") return {
		type: "object",
		additionalProperties: false,
		required: ["query"],
		properties: {
			query: { type: "string" },
			limit: { type: "integer" }
		}
	};
	if (name === "get_method_doc") return {
		type: "object",
		additionalProperties: false,
		required: ["method"],
		properties: {
			method: { type: "string" },
			include_example: { type: "boolean" },
			max_chars: { type: "integer" }
		}
	};
	if (name === "call_pandadata") return {
		type: "object",
		additionalProperties: false,
		required: ["method"],
		properties: {
			method: { type: "string" },
			params: { type: "object" },
			params_json: { type: "string" }
		}
	};
	if (name === "list_methods") return {
		type: "object",
		additionalProperties: false,
		properties: {
			category: { type: "string" },
			section: { type: "string" },
			limit: { type: "integer" },
			offset: { type: "integer" }
		}
	};
	if (name === "sdk_status") return {
		type: "object",
		additionalProperties: false,
		properties: { import_sdk: { type: "boolean" } }
	};
	return {
		type: "object",
		additionalProperties: false,
		properties: {}
	};
}
/**
* 注册未登录桩工具。数据类工具会触发 ensureAuthenticated。
*/
function registerStubTools(ctx, serverName, status, ensureAuthenticated, callWhenConnected) {
	const disposers = /* @__PURE__ */ new Map();
	for (const rawName of PANDA_MCP_TOOL_NAMES) {
		const publicName = publicToolName(serverName, rawName);
		const dispose = ctx.tools.register({
			name: publicName,
			description: STUB_DESCRIPTIONS[rawName],
			parameters: stubParameters(rawName),
			output: {
				schema: {
					type: "object",
					additionalProperties: true
				},
				render: (_args, value) => [{
					type: "text",
					text: JSON.stringify(value)
				}]
			},
			async execute(args, exec) {
				if (rawName === "auth_status") return status();
				if ((await ensureAuthenticated(exec.signal)).phase !== "connected") return reauthRequired();
				return callWhenConnected(rawName, typeof args === "object" && args !== null ? args : {}, exec.signal);
			}
		});
		disposers.set(publicName, dispose);
	}
	return disposers;
}
/**
* 从已连接 Client 同步远端工具列表。
*/
async function syncLiveTools(ctx, session, serverName, previous, onUnauthorized, aroundCall) {
	const definitions = /* @__PURE__ */ new Map();
	let cursor;
	do {
		const response = await session.client.request({
			method: "tools/list",
			...cursor === void 0 ? {} : { params: { cursor } }
		}, ListToolsResultSchema);
		for (const tool of response.tools) {
			const publicName = publicToolName(serverName, tool.name);
			if (definitions.has(publicName)) throw new Error(`panda-mcp(${serverName}): 远端重复列出工具 ${tool.name}`);
			definitions.set(publicName, tool);
		}
		cursor = response.nextCursor;
	} while (cursor !== void 0);
	for (const dispose of previous.values()) dispose();
	const disposers = /* @__PURE__ */ new Map();
	try {
		for (const [publicName, tool] of definitions) {
			const rawName = tool.name;
			const description = tool.description ?? "";
			const parameters = tool.inputSchema ?? {
				type: "object",
				additionalProperties: true
			};
			disposers.set(publicName, ctx.tools.register({
				name: publicName,
				description,
				parameters,
				output: {
					schema: {
						type: "object",
						additionalProperties: true
					},
					render: (_args, value) => [{
						type: "text",
						text: JSON.stringify(value)
					}]
				},
				async execute(args, exec) {
					const call = () => callLiveTool(session, rawName, args, exec.signal, onUnauthorized);
					return aroundCall ? aroundCall(rawName, args ?? {}, call) : call();
				}
			}));
		}
	} catch (error) {
		for (const dispose of disposers.values()) dispose();
		throw error;
	}
	return disposers;
}
/** 注销一整代工具。 */
function disposeTools(disposers) {
	for (const dispose of disposers.values()) dispose();
	disposers.clear();
}
async function callLiveTool(session, rawName, args, signal, onUnauthorized) {
	try {
		return mapCallResult(await session.client.request({
			method: "tools/call",
			params: {
				name: rawName,
				arguments: typeof args === "object" && args !== null ? args : {}
			}
		}, RawCallToolResultSchema, {
			...signal === void 0 ? {} : { signal },
			timeout: session.toolCallTimeoutMs
		}));
	} catch (error) {
		if (isUnauthorized(error)) {
			await onUnauthorized();
			return reauthRequired();
		}
		throw error;
	}
}
function mapCallResult(result) {
	if (result.isError === true) {
		const text = extractText(result.content);
		throw new Error(text.length === 0 ? "PandaData MCP 工具返回错误。" : text);
	}
	if (looksLikeReauth(result)) return reauthRequired(String(result.message ?? "需要重新登录 PandaData。"));
	if (Array.isArray(result.content)) {
		const structured = result.structuredContent;
		if (looksLikeReauth(structured)) return reauthRequired(String(structured.message ?? "需要重新登录 PandaData。"));
		if (structured !== void 0) return structured;
		const text = extractText(result.content);
		if (text.length === 0) return result;
		try {
			const parsed = JSON.parse(text);
			if (looksLikeReauth(parsed)) return reauthRequired(String(parsed.message ?? "需要重新登录 PandaData。"));
			return parsed;
		} catch {
			return { content: result.content };
		}
	}
	return result;
}
function extractText(content) {
	if (!Array.isArray(content)) return "";
	return content.map((block) => {
		if (typeof block === "object" && block !== null && "text" in block && typeof block.text === "string") return block.text;
		return "";
	}).filter((part) => part.length > 0).join("\n");
}
function looksLikeReauth(value) {
	return typeof value === "object" && value !== null && value.error === "reauth_required";
}
function isUnauthorized(error) {
	if (typeof error !== "object" || error === null) return false;
	const name = error.name;
	const message = String(error.message ?? "");
	return name === "UnauthorizedError" || message.includes("401") || /unauthorized/i.test(message);
}
/** 供已连接会话直接调用远端工具（桩工具登录成功后转发）。 */
async function callConnectedTool(session, rawName, args, signal, onUnauthorized) {
	return callLiveTool(session, rawName, args, signal, onUnauthorized);
}
//#endregion
//#region lib/types/index.js
/** QuantSkills Host：直连公网 PandaData MCP，OAuth 登录后把工具挂到 ctx.tools。 */
var __runInitializers = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) if (kind === "field") initializers.unshift(_);
		else descriptor[key] = _;
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
/** Cordis 插件名。 */
const name = "panda-mcp";
/** 工具注册与系统提示所依赖的服务。 */
const inject = [
	"tools",
	"agents",
	"systemPrompt"
];
const POLICY = `PandaData market data is available through remote MCP tools named mcp__pandadata__*.

Before fetching data, use quantskills_data_catalog to find locally cached datasets, then quantskills_data_query with the required date range and minRows. It refreshes stale or insufficient remote data once. Only use rows when status is hit or refreshed; insufficient is NOT usable data. Imported local files need re-import when insufficient. The database contains only user-configured sources. Never substitute a different vendor silently. PandaData table results are automatically cached for five minutes.

Workflow: mcp__pandadata__auth_status → mcp__pandadata__search_methods → mcp__pandadata__get_method_doc → mcp__pandadata__call_pandadata.
Read the method document before calling. Only documented get_* methods are allowed.

If a tool is missing, returns reauth_required, or fails with HTTP 401, stop and ask the user to open QuantSkills Settings → PandaData and click Login. Never ask for a password. Never retry login in a loop. Never switch to AkShare, Yahoo, Tushare, or any other data vendor unless the user explicitly names that vendor for the current task only.`;
/** Loader schema。 */
const Config = z.object({
	url: z.string().default(DEFAULT_PANDA_MCP_URL),
	serverName: z.string().default("pandadata"),
	dshHome: z.string().default(""),
	toolCallTimeoutMs: z.number().default(6e4),
	authTimeoutMs: z.number().default(3e5)
});
function authErrorHint(error) {
	if (!(error instanceof Error) || error.message.trim().length === 0) return "";
	return `（${error.message.replace(/\s+/g, " ").slice(0, 160)}）`;
}
function validateHttpUrl(value) {
	let parsed;
	try {
		parsed = new URL(value);
	} catch {
		throw new Error("panda-mcp: url 必须是 HTTPS 地址");
	}
	if (parsed.protocol !== "https:" || parsed.username !== "" || parsed.password !== "" || parsed.hash !== "") throw new Error("panda-mcp: url 必须是不含凭据的 HTTPS 地址");
	return parsed.href;
}
function createPandaMcpTransport(url, provider) {
	return new StreamableHTTPClientTransport(new URL(url), { authProvider: provider });
}
function createPandaMcpClient() {
	return new Client({
		name: "quantskills-dsh",
		version: "0.1.17"
	});
}
/** 默认：MCP SDK Streamable HTTP + OAuth。 */
async function connectPublicPandaMcp(args) {
	const provider = new PandaMcpOAuthProvider(args.store, args.redirectUrl, args.openAuthorization);
	const firstTransport = createPandaMcpTransport(args.url, provider);
	const firstClient = createPandaMcpClient();
	try {
		await firstClient.connect(firstTransport);
		return {
			client: firstClient,
			close: async () => {
				await firstClient.close();
			}
		};
	} catch (error) {
		if (!(error instanceof UnauthorizedError)) throw error;
	}
	const code = await args.waitForCode(args.signal);
	await firstTransport.finishAuth(code);
	try {
		await firstClient.close();
	} catch {}
	const transport = createPandaMcpTransport(args.url, provider);
	const client = createPandaMcpClient();
	await client.connect(transport);
	return {
		client,
		close: async () => {
			await client.close();
		}
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
			__esDecorate(this, null, _databaseList_decorators, {
				kind: "method",
				name: "databaseList",
				static: false,
				private: false,
				access: {
					has: (obj) => "databaseList" in obj,
					get: (obj) => obj.databaseList
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _databaseImport_decorators, {
				kind: "method",
				name: "databaseImport",
				static: false,
				private: false,
				access: {
					has: (obj) => "databaseImport" in obj,
					get: (obj) => obj.databaseImport
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _databaseFetch_decorators, {
				kind: "method",
				name: "databaseFetch",
				static: false,
				private: false,
				access: {
					has: (obj) => "databaseFetch" in obj,
					get: (obj) => obj.databaseFetch
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _databaseQuery_decorators, {
				kind: "method",
				name: "databaseQuery",
				static: false,
				private: false,
				access: {
					has: (obj) => "databaseQuery" in obj,
					get: (obj) => obj.databaseQuery
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _databasePreview_decorators, {
				kind: "method",
				name: "databasePreview",
				static: false,
				private: false,
				access: {
					has: (obj) => "databasePreview" in obj,
					get: (obj) => obj.databasePreview
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _databaseRefresh_decorators, {
				kind: "method",
				name: "databaseRefresh",
				static: false,
				private: false,
				access: {
					has: (obj) => "databaseRefresh" in obj,
					get: (obj) => obj.databaseRefresh
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _databaseRemove_decorators, {
				kind: "method",
				name: "databaseRemove",
				static: false,
				private: false,
				access: {
					has: (obj) => "databaseRemove" in obj,
					get: (obj) => obj.databaseRemove
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _databaseCategorize_decorators, {
				kind: "method",
				name: "databaseCategorize",
				static: false,
				private: false,
				access: {
					has: (obj) => "databaseCategorize" in obj,
					get: (obj) => obj.databaseCategorize
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _status_decorators, {
				kind: "method",
				name: "status",
				static: false,
				private: false,
				access: {
					has: (obj) => "status" in obj,
					get: (obj) => obj.status
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _authenticate_decorators, {
				kind: "method",
				name: "authenticate",
				static: false,
				private: false,
				access: {
					has: (obj) => "authenticate" in obj,
					get: (obj) => obj.authenticate
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _refresh_decorators, {
				kind: "method",
				name: "refresh",
				static: false,
				private: false,
				access: {
					has: (obj) => "refresh" in obj,
					get: (obj) => obj.refresh
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _logout_decorators, {
				kind: "method",
				name: "logout",
				static: false,
				private: false,
				access: {
					has: (obj) => "logout" in obj,
					get: (obj) => obj.logout
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		static inject = inject;
		static Config = Config;
		url = __runInitializers(this, _instanceExtraInitializers);
		serverName;
		authTimeoutMs;
		toolCallTimeoutMs;
		database;
		store;
		promptDisposers = /* @__PURE__ */ new Map();
		tools = /* @__PURE__ */ new Map();
		phase = "disconnected";
		message = "尚未登录 PandaData。";
		live;
		closeLive;
		authTail;
		connector;
		openAuthorization = (url) => {
			openSystemBrowser(url.href);
		};
		constructor(ctx, config) {
			super(ctx, "pandaMcp");
			this.url = validateHttpUrl(config.url ?? "https://pandadatamcp.pandaaiquant.com/mcp");
			this.serverName = config.serverName ?? "pandadata";
			if (!/^[A-Za-z0-9_-]{1,32}$/.test(this.serverName)) throw new Error("panda-mcp: serverName 必须匹配 [A-Za-z0-9_-]{1,32}");
			this.authTimeoutMs = config.authTimeoutMs ?? 3e5;
			this.toolCallTimeoutMs = config.toolCallTimeoutMs ?? 6e4;
			const specifiedHome = config.dshHome?.trim();
			this.store = new PandaMcpOAuthStore(pandaMcpOAuthPath(resolveDshHome(specifiedHome === void 0 || specifiedHome.length === 0 ? void 0 : specifiedHome)));
			this.database = new LocalDatabase(join(resolveDshHome(specifiedHome || void 0), "quantskills", "database"), async (method, params, signal) => {
				if (!this.live) await this.refresh(signal);
				if (!this.live) throw new Error("请先在设置中连接 PandaData");
				return callConnectedTool(this.live, "call_pandadata", {
					method,
					params
				}, signal, async () => {
					this.phase = "needs_auth";
					await this.store.clear("tokens");
					this.replaceWithStubs();
				});
			});
			this.installDatabaseTools();
			this.installPrompts();
			this.tools = this.mountStubs();
			ctx.effect(() => async () => {
				this.disposePrompts();
				disposeTools(this.tools);
				await this.closeLive?.();
			}, "panda-mcp.lifecycle");
			this.restoreExistingTokens();
		}
		databaseList(signal) {
			return this.database.list();
		}
		databaseImport(input, signal) {
			return this.database.import(input);
		}
		databaseFetch(input, signal) {
			return this.database.fetch(input, signal);
		}
		databaseQuery(input, signal) {
			return this.database.query(input, signal);
		}
		databasePreview(input, signal) {
			return this.database.preview(input.id);
		}
		databaseRefresh(input, signal) {
			return this.database.preview(input.id).then(({ dataset }) => this.database.fetch(dataset, signal, dataset.id));
		}
		databaseRemove(input, signal) {
			return this.database.remove(input.id);
		}
		databaseCategorize(input, signal) {
			return this.database.categorize(input.id, input.category);
		}
		installDatabaseTools() {
			const register = (name, description, properties, required, execute) => {
				this.ctx.effect(() => this.ctx.tools.register({
					name,
					description,
					parameters: {
						type: "object",
						properties,
						required,
						additionalProperties: false
					},
					output: {
						schema: {
							type: "object",
							additionalProperties: true
						},
						render: (_args, value) => [{
							type: "text",
							text: JSON.stringify(value)
						}]
					},
					execute: (args, exec) => execute(args, exec.signal)
				}), name);
			};
			register("quantskills_data_catalog", "List local cached datasets by research category (market: quotes/prices; news: news/announcements; fundamental: company financials/valuation; other), source, date coverage, row count and expiry. Category is independent of whether data has dates. Always check before fetching external data.", {}, [], () => this.database.list().then((datasets) => ({ datasets })));
			register("quantskills_data_query", "Read local data first. Refresh remote source once when stale or insufficient. Only consume rows if status is hit/refreshed. Do not use insufficient results; ask for source parameters or new import.", {
				id: { type: "string" },
				from: { type: "string" },
				to: { type: "string" },
				minRows: {
					type: "integer",
					minimum: 1
				},
				limit: {
					type: "integer",
					minimum: 1,
					maximum: 5e3
				},
				offset: {
					type: "integer",
					minimum: 0
				},
				refresh: { type: "boolean" }
			}, ["id"], (args, signal) => this.database.query(args, signal));
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
			return Promise.resolve(this.snapshot());
		}
		authenticate(signal) {
			return this.ensureAuthenticated(signal);
		}
		/** 用已保存 token 静默重连；没有 token 时只返回当前状态，不打开浏览器。 */
		async refresh(signal) {
			if (this.phase === "connected" && this.live !== void 0) return this.snapshot();
			await this.store.load();
			if (!this.store.hasAccessToken()) return this.snapshot();
			try {
				await this.connectLive({
					interactive: false,
					...signal === void 0 ? {} : { signal }
				});
			} catch {
				this.phase = "needs_auth";
				this.message = "已保存的 PandaData 登录已失效，请重新登录。";
				this.replaceWithStubs();
			}
			return this.snapshot();
		}
		async logout(signal) {
			await this.dropLive();
			await this.store.clear("all");
			this.phase = "disconnected";
			this.message = "已退出 PandaData 登录。";
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
				message: this.message
			};
		}
		async restoreExistingTokens() {
			await this.store.load();
			if (!this.store.hasAccessToken()) return;
			try {
				await this.connectLive({ interactive: false });
			} catch {
				this.phase = "needs_auth";
				this.message = "已保存的 PandaData 登录已失效，请重新登录。";
				this.replaceWithStubs();
			}
		}
		async ensureAuthenticated(signal) {
			if (this.phase === "connected" && this.live !== void 0) return this.snapshot();
			if (this.authTail !== void 0) return this.authTail;
			this.authTail = this.runAuthentication(signal).finally(() => {
				this.authTail = void 0;
			});
			return this.authTail;
		}
		async runAuthentication(signal) {
			if (this.store.hasAccessToken()) try {
				await this.connectLive({
					interactive: false,
					...signal === void 0 ? {} : { signal }
				});
				return this.snapshot();
			} catch {
				this.phase = "needs_auth";
			}
			this.phase = "authenticating";
			this.message = "正在打开 PandaData 登录页。";
			const controller = new AbortController();
			const timeout = setTimeout(() => {
				controller.abort();
			}, this.authTimeoutMs);
			const onAbort = () => {
				controller.abort();
			};
			signal?.addEventListener("abort", onAbort, { once: true });
			const loopback = await startOauthLoopback();
			try {
				await this.store.clear("client");
				await this.connectLive({
					interactive: true,
					redirectUrl: loopback.redirectUrl,
					waitForCode: () => loopback.waitForCode(controller.signal),
					signal: controller.signal
				});
				return this.snapshot();
			} catch (error) {
				this.phase = error instanceof UnauthorizedError || controller.signal.aborted ? "needs_auth" : "error";
				this.message = controller.signal.aborted ? "PandaData 登录已取消或超时。" : `PandaData 登录失败，请重试。${authErrorHint(error)}`;
				this.replaceWithStubs();
				return this.snapshot();
			} finally {
				clearTimeout(timeout);
				signal?.removeEventListener("abort", onAbort);
				await loopback.close();
			}
		}
		async connectLive(options) {
			await this.dropLive();
			const interactive = options?.interactive === true;
			const redirectUrl = options?.redirectUrl ?? "http://127.0.0.1/callback";
			const waitForCode = options?.waitForCode ?? (async () => {
				throw new UnauthorizedError("PandaData 登录需要浏览器授权。");
			});
			const openAuthorization = interactive ? this.openAuthorization : () => {
				throw new UnauthorizedError("PandaData 需要重新登录。");
			};
			const session = this.connector === void 0 ? await connectPublicPandaMcp({
				url: this.url,
				store: this.store,
				redirectUrl,
				openAuthorization,
				waitForCode,
				...options?.signal === void 0 ? {} : { signal: options.signal }
			}) : await this.connector.connect({
				url: this.url,
				store: this.store,
				redirectUrl,
				openAuthorization,
				...options?.signal === void 0 ? {} : { signal: options.signal }
			});
			this.live = {
				client: session.client,
				toolCallTimeoutMs: this.toolCallTimeoutMs
			};
			this.closeLive = session.close;
			const liveTools = await syncLiveTools(this.ctx, this.live, this.serverName, this.tools, async () => {
				this.phase = "needs_auth";
				this.message = "PandaData 登录已过期，请重新登录。";
				await this.store.clear("tokens");
				this.replaceWithStubs();
			}, (rawName, args, call) => rawName === "call_pandadata" ? this.database.cachedPanda(args, call) : call());
			this.tools = liveTools;
			this.phase = "connected";
			this.message = "已连接 PandaData MCP。";
		}
		async dropLive() {
			const close = this.closeLive;
			this.closeLive = void 0;
			this.live = void 0;
			if (close !== void 0) await close();
		}
		mountStubs() {
			return registerStubTools(this.ctx, this.serverName, () => this.snapshot(), (signal) => this.ensureAuthenticated(signal), async (rawName, args, signal) => {
				if (this.live === void 0) return {
					ok: false,
					error: "reauth_required",
					message: "尚未登录 PandaData。"
				};
				const call = () => callConnectedTool(this.live, rawName, args, signal, async () => {
					this.phase = "needs_auth";
					this.message = "PandaData 登录已过期，请重新登录。";
					await this.store.clear("tokens");
					this.replaceWithStubs();
				});
				return rawName === "call_pandadata" ? this.database.cachedPanda(args, call) : call();
			});
		}
		replaceWithStubs() {
			disposeTools(this.tools);
			this.tools = this.mountStubs();
		}
		installPrompts() {
			const maybeInstall = (agent) => {
				if (this.promptDisposers.has(agent)) return;
				this.promptDisposers.set(agent, agent.ctx.systemPrompt.section({
					name: "panda-mcp:policy",
					order: 70,
					text: () => POLICY.replaceAll("mcp__pandadata__", `mcp__${this.serverName}__`)
				}));
			};
			for (const agent of this.ctx.agents.list()) maybeInstall(agent);
			this.ctx.on("agent/created", ({ agent }) => {
				maybeInstall(agent);
			});
			this.ctx.on("agent/disposed", ({ agent }) => {
				this.promptDisposers.get(agent)?.();
				this.promptDisposers.delete(agent);
			});
		}
		disposePrompts() {
			for (const dispose of this.promptDisposers.values()) dispose();
			this.promptDisposers.clear();
		}
	};
})();
/** 测试辅助：默认公开工具名。 */
function pandaMcpPublicNames(serverName = "pandadata") {
	return PANDA_MCP_TOOL_NAMES.map((rawName) => publicToolName(serverName, rawName));
}
//#endregion
export { Config, DEFAULT_PANDA_MCP_URL, PANDA_MCP_TOOL_NAMES, PandaMcpGateway, PandaMcpGateway as default, PandaMcpOAuthStore, connectPublicPandaMcp, inject, name, pandaMcpOAuthPath, pandaMcpPublicNames, publicToolName, reauthRequired, startOauthLoopback };
