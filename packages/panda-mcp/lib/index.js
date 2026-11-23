import { dirname, join } from "node:path";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
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
//#region packages/panda-mcp/lib/types/data-category.js
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
//#region packages/panda-mcp/lib/types/database.js
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
var TruncatedPreview = class extends Error {
	constructor() {
		super("数据源返回被截断的预览，请缩小查询日期范围；未写入缓存");
	}
};
function dataRows(raw) {
	if (typeof raw === "string") return dataRows(JSON.parse(raw));
	if (Array.isArray(raw)) {
		if (raw.every((item) => item !== null && typeof item === "object" && !Array.isArray(item))) return raw;
		throw new Error("JSON 必须是对象数组，或包含 data / rows / records 的对象");
	}
	if (raw && typeof raw === "object") {
		const obj = raw;
		if (obj.error || obj.isError === true || obj.success === false || obj.ok === false || obj.status === "error") throw new Error("数据源返回错误，未写入缓存");
		if (obj.truncated === true) throw new TruncatedPreview();
		const matrix = obj.rows ?? obj.data;
		if (Array.isArray(obj.columns) && Array.isArray(matrix) && matrix.every(Array.isArray)) {
			const columns = obj.columns;
			if (!columns.length || columns.some((c) => typeof c !== "string" || !c.trim()) || new Set(columns).size !== columns.length || matrix.some((row) => row.length !== columns.length)) throw new Error("表格列名或行列数不一致，未写入缓存");
			return matrix.map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
		}
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
	async sourceRows(source, signal, budget = { remaining: 64 }) {
		signal?.throwIfAborted();
		if (--budget.remaining < 0) throw new Error("PandaData 历史分段请求过多，请缩小日期范围；未写入缓存");
		const raw = await this.sourceData(source, signal);
		signal?.throwIfAborted();
		try {
			return dataRows(raw);
		} catch (error) {
			if (!(error instanceof TruncatedPreview) || source.kind !== "pandadata" || source.method !== "get_future_min") throw error;
			const start = String(source.params?.start_date ?? ""), end = String(source.params?.end_date ?? "");
			if (!/^\d{8}$/.test(start) || !/^\d{8}$/.test(end)) throw error;
			const first = instant(start), last = instant(end), day = 864e5;
			if (!Number.isFinite(first) || !Number.isFinite(last) || first >= last) throw error;
			const middle = first + Math.floor((last - first) / day / 2) * day;
			const date = (time) => new Date(time).toISOString().slice(0, 10).replaceAll("-", "");
			const left = await this.sourceRows({
				...source,
				params: {
					...source.params,
					end_date: date(middle)
				}
			}, signal, budget);
			const right = await this.sourceRows({
				...source,
				params: {
					...source.params,
					start_date: date(middle + day)
				}
			}, signal, budget);
			if (left.length + right.length > MAX_ROWS) throw new Error("历史数据超过 100000 行，请缩小日期范围；未写入缓存");
			return [...left, ...right];
		}
	}
	async fetch(input, signal, id) {
		if (input.source.rollingDay) {
			if (input.source.kind !== "pandadata" || input.source.method !== "get_future_min") throw new Error("随日期更新仅支持 PandaData 期货分钟行情");
			const day = (offset) => new Date(this.now() + 8 * 36e5 + offset * 864e5).toISOString().slice(0, 10).replaceAll("-", "");
			input = {
				...input,
				source: {
					...input.source,
					params: {
						...input.source.params,
						start_date: day(0),
						end_date: day(3)
					}
				}
			};
		}
		const rows = await this.sourceRows(input.source, signal);
		return summary(await this.save(input, rows, id));
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
//#region packages/panda-mcp/lib/types/futures-reference-catalog.js
const products = [
	{
		"exchange": "CFFEX",
		"product": "IC",
		"name": "中证500股指",
		"currentCategory": "金融",
		"tickSize": .2,
		"tickText": "0.2点",
		"multiplier": 200,
		"tradingUnit": "每点200元",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E9%87%91%E8%9E%8D&twoLevelVariety=%E4%B8%AD%E8%AF%81500%E8%82%A1%E6%8C%87",
		"sourceSha256": "4d41bde5d2e808e6d9f49c9abd8f4b40a87d9be16eee9f00a5c414971caf9f4c",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 10,
			"feeFrom": "2026-05-18",
			"feeThrough": "2026-10-19"
		}
	},
	{
		"exchange": "CFFEX",
		"product": "IF",
		"name": "沪深300股指",
		"currentCategory": "金融",
		"tickSize": .2,
		"tickText": "0.2点",
		"multiplier": 300,
		"tradingUnit": "每点300元",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E9%87%91%E8%9E%8D&twoLevelVariety=%E6%B2%AA%E6%B7%B1300%E8%82%A1%E6%8C%87",
		"sourceSha256": "8272dc9e7023893f3c3a61a5a68f59a05bfd05af6928a70093581e30aa5cd691",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 10,
			"feeFrom": "2026-05-18",
			"feeThrough": "2026-10-19"
		}
	},
	{
		"exchange": "CFFEX",
		"product": "IH",
		"name": "上证50股指",
		"currentCategory": "金融",
		"tickSize": .2,
		"tickText": "0.2点",
		"multiplier": 300,
		"tradingUnit": "每点300元",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E9%87%91%E8%9E%8D&twoLevelVariety=%E4%B8%8A%E8%AF%8150%E8%82%A1%E6%8C%87",
		"sourceSha256": "f21d7714f59fe7e4ecd80f2f2693f49f1f844f37d8d3f5aeac0b7a0b9840947a",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 10,
			"feeFrom": "2026-05-18",
			"feeThrough": "2026-10-19"
		}
	},
	{
		"exchange": "CFFEX",
		"product": "IM",
		"name": "中证1000股指",
		"currentCategory": "金融",
		"tickSize": .2,
		"tickText": "0.2点",
		"multiplier": 200,
		"tradingUnit": "每点人民币200元",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E9%87%91%E8%9E%8D&twoLevelVariety=%E4%B8%AD%E8%AF%811000%E8%82%A1%E6%8C%87",
		"sourceSha256": "1e646284d21b630bf06eb1cdc45d8163f967d40ea8ec4b7fa781e3fe2e962adc",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 10,
			"feeFrom": "2026-05-18",
			"feeThrough": "2026-10-19"
		}
	},
	{
		"exchange": "CFFEX",
		"product": "T",
		"name": "10年期国债",
		"currentCategory": "金融",
		"tickSize": .005,
		"tickText": "0.005元",
		"multiplier": 1e4,
		"tradingUnit": "面值为100万元人民币、票面利率为3%的名义长期国债",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E9%87%91%E8%9E%8D&twoLevelVariety=10%E5%B9%B4%E6%9C%9F%E5%9B%BD%E5%80%BA",
		"sourceSha256": "d1ceed71738f902536e6b59b6b8d5397ba4c6552c28738d916df42c03cd6911b",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 10,
			"feeFrom": "2026-05-18",
			"feeThrough": "2026-10-19"
		}
	},
	{
		"exchange": "CFFEX",
		"product": "TF",
		"name": "5年期国债",
		"currentCategory": "金融",
		"tickSize": .005,
		"tickText": "0.005元",
		"multiplier": 1e4,
		"tradingUnit": "面值为100万元人民币、票面利率为3%的名义中期国债",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E9%87%91%E8%9E%8D&twoLevelVariety=5%E5%B9%B4%E6%9C%9F%E5%9B%BD%E5%80%BA",
		"sourceSha256": "10d4d1a62184c451639a359ece9e8832ee69533d6cbfc8289007beacbdc37743",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 10,
			"feeFrom": "2026-05-18",
			"feeThrough": "2026-10-19"
		}
	},
	{
		"exchange": "CFFEX",
		"product": "TL",
		"name": "30年期国债",
		"currentCategory": "金融",
		"tickSize": .01,
		"tickText": "0.01元",
		"multiplier": 1e4,
		"tradingUnit": "面值为100万元人民币、票面利率为3%的名义超长期国债",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E9%87%91%E8%9E%8D&twoLevelVariety=30%E5%B9%B4%E6%9C%9F%E5%9B%BD%E5%80%BA",
		"sourceSha256": "f86fac0aa2f8341ef26e4fe26f204a45ebabba00173c7bd6b92d1bb754a77214",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 10,
			"feeFrom": "2026-05-18",
			"feeThrough": "2026-10-19"
		}
	},
	{
		"exchange": "CFFEX",
		"product": "TS",
		"name": "2年期国债",
		"currentCategory": "金融",
		"tickSize": .002,
		"tickText": "0.002元",
		"multiplier": 2e4,
		"tradingUnit": "面值为200万元人民币、票面利率为3%的名义中短期国债",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E9%87%91%E8%9E%8D&twoLevelVariety=2%E5%B9%B4%E6%9C%9F%E5%9B%BD%E5%80%BA",
		"sourceSha256": "6040c561929f907f3053364f07e56196117a4d8dbe025da880707f6aae645aa9",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 10,
			"feeFrom": "2026-05-18",
			"feeThrough": "2026-10-19"
		}
	},
	{
		"exchange": "CZCE",
		"product": "AP",
		"name": "苹果",
		"currentCategory": "农产品",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 10,
		"tradingUnit": "10吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E5%86%9C%E4%BA%A7%E5%93%81&twoLevelVariety=%E8%8B%B9%E6%9E%9C",
		"sourceSha256": "dba4d0c5b4d478f68966193872c9be7914363fd7ccce2f4974b0c12c3250f01f",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "CZCE",
		"product": "CF",
		"name": "棉花",
		"currentCategory": "农产品",
		"tickSize": 5,
		"tickText": "5元/吨",
		"multiplier": 5,
		"tradingUnit": "5吨/手（公定重量）",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E5%86%9C%E4%BA%A7%E5%93%81&twoLevelVariety=%E6%A3%89%E8%8A%B1",
		"sourceSha256": "bc3e84f5033b506e1a812c1a5577e947a1997af35489ce54dde95d9f70fb112a",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "CZCE",
		"product": "CJ",
		"name": "红枣",
		"currentCategory": "农产品",
		"tickSize": 5,
		"tickText": "5元/吨",
		"multiplier": 5,
		"tradingUnit": "5吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E5%86%9C%E4%BA%A7%E5%93%81&twoLevelVariety=%E7%BA%A2%E6%9E%A3",
		"sourceSha256": "d80874e49f18c49168672bfdb22b093f0516263d0f6107a51284d24a9681eef3",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "CZCE",
		"product": "CY",
		"name": "棉纱",
		"currentCategory": "农产品",
		"tickSize": 5,
		"tickText": "5元/吨",
		"multiplier": 5,
		"tradingUnit": "5吨/手（公定重量）",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E5%86%9C%E4%BA%A7%E5%93%81&twoLevelVariety=%E6%A3%89%E7%BA%B1",
		"sourceSha256": "3f180a998ff0d99284d6522c0d41e47283a06f136a573a286671a42c59d39adc",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "CZCE",
		"product": "FG",
		"name": "玻璃",
		"currentCategory": "能源化工",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 20,
		"tradingUnit": "20吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%83%BD%E6%BA%90%E5%8C%96%E5%B7%A5&twoLevelVariety=%E7%8E%BB%E7%92%83",
		"sourceSha256": "9b6b634a5df108e310c06cf98e7eb65eb32b143f2e3cfe8f7a31ce35dbbe7df6",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "CZCE",
		"product": "JR",
		"name": "粳稻",
		"currentCategory": "农产品",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 20,
		"tradingUnit": "20吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E5%86%9C%E4%BA%A7%E5%93%81&twoLevelVariety=%E7%B2%B3%E7%A8%BB",
		"sourceSha256": "ca9d0dd2132518444b12eca6655540fe06f8d02237eeafc300cba6a7e5b78ef7",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "CZCE",
		"product": "LR",
		"name": "晚籼稻",
		"currentCategory": "农产品",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 20,
		"tradingUnit": "20吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E5%86%9C%E4%BA%A7%E5%93%81&twoLevelVariety=%E6%99%9A%E7%B1%BC%E7%A8%BB",
		"sourceSha256": "f7c763f31fe12c49763d44847c6d0d8670348b1e72dda8706de49d049c8b34aa",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "CZCE",
		"product": "MA",
		"name": "甲醇",
		"currentCategory": "能源化工",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 10,
		"tradingUnit": "10吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%83%BD%E6%BA%90%E5%8C%96%E5%B7%A5&twoLevelVariety=%E7%94%B2%E9%86%87",
		"sourceSha256": "eea168861a43ba73176b32c595753a4006ef9b25d715481d32ee6ff52d68d34a",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "CZCE",
		"product": "OI",
		"name": "菜籽油",
		"currentCategory": "农产品",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 10,
		"tradingUnit": "10吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E5%86%9C%E4%BA%A7%E5%93%81&twoLevelVariety=%E8%8F%9C%E7%B1%BD%E6%B2%B9",
		"sourceSha256": "20ddfef2f283df9a0bb03f7658a8c842ad00c3ccca7953d53e6f51e874031c7b",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "CZCE",
		"product": "PF",
		"name": "短纤",
		"currentCategory": "能源化工",
		"tickSize": 2,
		"tickText": "2元/吨",
		"multiplier": 5,
		"tradingUnit": "5吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%83%BD%E6%BA%90%E5%8C%96%E5%B7%A5&twoLevelVariety=%E7%9F%AD%E7%BA%A4",
		"sourceSha256": "c56dd3cd394c67fe4f13dcc3455f579bb5ec466c0be272cc8a0686d3d768f425",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "CZCE",
		"product": "PK",
		"name": "花生",
		"currentCategory": "农产品",
		"tickSize": 2,
		"tickText": "2元/吨",
		"multiplier": 5,
		"tradingUnit": "5吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E5%86%9C%E4%BA%A7%E5%93%81&twoLevelVariety=%E8%8A%B1%E7%94%9F",
		"sourceSha256": "87977fbf4452533a4ccd6a6e3cb71077cb3eae20d1c65110c33caf3f9479de38",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "CZCE",
		"product": "PL",
		"name": "丙烯",
		"currentCategory": "能源化工",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 20,
		"tradingUnit": "20吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%83%BD%E6%BA%90%E5%8C%96%E5%B7%A5&twoLevelVariety=%E4%B8%99%E7%83%AF",
		"sourceSha256": "b69b95ccc5204fd7309117e1af8b319ae32d174089af1bf5a2cf8ada9a09bd15",
		"coverage": {
			"quoteDays": 0,
			"quoteFrom": null,
			"quoteThrough": null,
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "CZCE",
		"product": "PM",
		"name": "普麦",
		"currentCategory": "农产品",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 50,
		"tradingUnit": "50吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E5%86%9C%E4%BA%A7%E5%93%81&twoLevelVariety=%E6%99%AE%E9%BA%A6",
		"sourceSha256": "3fd09f3528ba7d4020a01927276f79a2cc04d2424f8807d2ff472a95faa79c96",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "CZCE",
		"product": "PR",
		"name": "瓶片",
		"currentCategory": "能源化工",
		"tickSize": 2,
		"tickText": "2元/吨",
		"multiplier": 15,
		"tradingUnit": "15吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%83%BD%E6%BA%90%E5%8C%96%E5%B7%A5&twoLevelVariety=%E7%93%B6%E7%89%87",
		"sourceSha256": "72c2fbfc73a5df3be0a5e4a55cab7407dfaface0826f0f42472d9aa31a1d623f",
		"coverage": {
			"quoteDays": 198,
			"quoteFrom": "2024-08-30",
			"quoteThrough": "2025-06-30",
			"feeDays": 198,
			"feeFrom": "2024-08-30",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "CZCE",
		"product": "PX",
		"name": "对二甲苯",
		"currentCategory": "能源化工",
		"tickSize": 2,
		"tickText": "2元/吨",
		"multiplier": 5,
		"tradingUnit": "5吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%83%BD%E6%BA%90%E5%8C%96%E5%B7%A5&twoLevelVariety=%E5%AF%B9%E4%BA%8C%E7%94%B2%E8%8B%AF",
		"sourceSha256": "dd05bdc23fb5138cfe12b178516fee339af1e0b9672bbb2572bd3e0a10d8c69f",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "CZCE",
		"product": "RI",
		"name": "早籼稻",
		"currentCategory": "农产品",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 20,
		"tradingUnit": "20吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E5%86%9C%E4%BA%A7%E5%93%81&twoLevelVariety=%E6%97%A9%E7%B1%BC%E7%A8%BB",
		"sourceSha256": "4b22c5d4db704294deef8a2f7ebd333b27adc59cbad0a8fc54d04bde8cbf633d",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "CZCE",
		"product": "RM",
		"name": "菜籽粕",
		"currentCategory": "农产品",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 10,
		"tradingUnit": "10吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E5%86%9C%E4%BA%A7%E5%93%81&twoLevelVariety=%E8%8F%9C%E7%B1%BD%E7%B2%95",
		"sourceSha256": "09b961a422fd899aeee72cedbccd91199a4edc34dc2f2a520492d101dbee41b0",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "CZCE",
		"product": "RS",
		"name": "油菜籽",
		"currentCategory": "农产品",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 10,
		"tradingUnit": "10吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E5%86%9C%E4%BA%A7%E5%93%81&twoLevelVariety=%E6%B2%B9%E8%8F%9C%E7%B1%BD",
		"sourceSha256": "d300cdabe7e3f707afb04ec310d4077c2ee46a4b0a44350429ce12a320099317",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "CZCE",
		"product": "SA",
		"name": "纯碱",
		"currentCategory": "能源化工",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 20,
		"tradingUnit": "20吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%83%BD%E6%BA%90%E5%8C%96%E5%B7%A5&twoLevelVariety=%E7%BA%AF%E7%A2%B1",
		"sourceSha256": "53484fb5aaae2f50564f494d1c8dc60a974dc039bc6755e1913539156be3bb72",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "CZCE",
		"product": "SF",
		"name": "硅铁",
		"currentCategory": "黑色金属",
		"tickSize": 2,
		"tickText": "2元/吨",
		"multiplier": 5,
		"tradingUnit": "5吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E9%BB%91%E8%89%B2%E9%87%91%E5%B1%9E&twoLevelVariety=%E7%A1%85%E9%93%81",
		"sourceSha256": "ea692b0787335b8d799cfe54bdf11104cf51ec65e8f4df717a55721693f291b5",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "CZCE",
		"product": "SH",
		"name": "烧碱",
		"currentCategory": "能源化工",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 30,
		"tradingUnit": "30吨/手（干吨重量）",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%83%BD%E6%BA%90%E5%8C%96%E5%B7%A5&twoLevelVariety=%E7%83%A7%E7%A2%B1",
		"sourceSha256": "9d8f28dc54065c6201dc194193f1e1abf18bd4328da88378a7472f9e2473fe97",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "CZCE",
		"product": "SM",
		"name": "锰硅",
		"currentCategory": "黑色金属",
		"tickSize": 2,
		"tickText": "2元/吨",
		"multiplier": 5,
		"tradingUnit": "5吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E9%BB%91%E8%89%B2%E9%87%91%E5%B1%9E&twoLevelVariety=%E9%94%B0%E7%A1%85",
		"sourceSha256": "e26f7f69d6c7c3cc1f52be18197f701ec46e2dafe73ef8f2c3f4528d133febaf",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "CZCE",
		"product": "SO",
		"name": "葵花籽油",
		"currentCategory": "农产品",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 20,
		"tradingUnit": "20吨/手",
		"sourceUrl": "https://www.czce.com.cn/cn/content_file/flfg/zcjywgz/pzxz/2026/11/cd4d36000a5d4b63aecb80aeaa914efc.pdf",
		"sourceSha256": "",
		"coverage": {
			"quoteDays": 0,
			"quoteFrom": null,
			"quoteThrough": null,
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "CZCE",
		"product": "SR",
		"name": "白糖",
		"currentCategory": "农产品",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 10,
		"tradingUnit": "10吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E5%86%9C%E4%BA%A7%E5%93%81&twoLevelVariety=%E7%99%BD%E7%B3%96",
		"sourceSha256": "a786c3ec2f2e64aad6a2c0220eed74113de35571a4ae6fce8bfedda1fd4fb0fd",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "CZCE",
		"product": "TA",
		"name": "PTA",
		"currentCategory": "能源化工",
		"tickSize": 2,
		"tickText": "2元/吨",
		"multiplier": 5,
		"tradingUnit": "5吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%83%BD%E6%BA%90%E5%8C%96%E5%B7%A5&twoLevelVariety=PTA",
		"sourceSha256": "71c1ec896d128f14aca0465b833a314c7e0b0c9cccbc070d39654709b69b1ed1",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "CZCE",
		"product": "UR",
		"name": "尿素",
		"currentCategory": "能源化工",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 20,
		"tradingUnit": "20吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%83%BD%E6%BA%90%E5%8C%96%E5%B7%A5&twoLevelVariety=%E5%B0%BF%E7%B4%A0",
		"sourceSha256": "ed046682b007f1d10b803d8425756316501d7bd8373854d6a4d6eec1f9ea1df8",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "CZCE",
		"product": "WH",
		"name": "强麦",
		"currentCategory": "农产品",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 20,
		"tradingUnit": "20吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E5%86%9C%E4%BA%A7%E5%93%81&twoLevelVariety=%E5%BC%BA%E9%BA%A6",
		"sourceSha256": "82cc2802a48e8e97ddcf45f919947b6040278f0b3d9a479472975a099af83b2d",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "CZCE",
		"product": "ZC",
		"name": "动力煤",
		"currentCategory": "能源化工",
		"tickSize": .2,
		"tickText": "0.2元/吨",
		"multiplier": 100,
		"tradingUnit": "100吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%83%BD%E6%BA%90%E5%8C%96%E5%B7%A5&twoLevelVariety=%E5%8A%A8%E5%8A%9B%E7%85%A4",
		"sourceSha256": "d4b104c61d88c96acd11ade6e5712dbc6bde66b49a47a5fc967415319551e575",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "DCE",
		"product": "A",
		"name": "黄大豆1号",
		"currentCategory": "农产品",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 10,
		"tradingUnit": "10吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E5%86%9C%E4%BA%A7%E5%93%81&twoLevelVariety=%E9%BB%84%E5%A4%A7%E8%B1%861%E5%8F%B7",
		"sourceSha256": "0818efe0e9cce52eb03dbe43a68d50a3d8ec3517d2ff9c5b32ce5deeaa1b8e31",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "DCE",
		"product": "B",
		"name": "黄大豆2号",
		"currentCategory": "农产品",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 10,
		"tradingUnit": "10吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E5%86%9C%E4%BA%A7%E5%93%81&twoLevelVariety=%E9%BB%84%E5%A4%A7%E8%B1%862%E5%8F%B7",
		"sourceSha256": "d9530b070af104ecdbbdeaf5592d0e96c921352518d59ef5de4890ad4d554c5e",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "DCE",
		"product": "BB",
		"name": "胶合板",
		"currentCategory": "农产品",
		"tickSize": .05,
		"tickText": "0.05元/张",
		"multiplier": 500,
		"tradingUnit": "500张/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E5%86%9C%E4%BA%A7%E5%93%81&twoLevelVariety=%E8%83%B6%E5%90%88%E6%9D%BF",
		"sourceSha256": "ec5afe7b40f27e0ef6c5cb244e0f0df8e9417e55e381f77a227ef4704c9ddd27",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "DCE",
		"product": "BZ",
		"name": "纯苯",
		"currentCategory": "能源化工",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 30,
		"tradingUnit": "30吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%83%BD%E6%BA%90%E5%8C%96%E5%B7%A5&twoLevelVariety=%E7%BA%AF%E8%8B%AF",
		"sourceSha256": "c28e603170b49bdde0def3c3efb08a94625f01d995c2908c3607eae1f6f2dcd2",
		"coverage": {
			"quoteDays": 0,
			"quoteFrom": null,
			"quoteThrough": null,
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "DCE",
		"product": "C",
		"name": "玉米",
		"currentCategory": "农产品",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 10,
		"tradingUnit": "10吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E5%86%9C%E4%BA%A7%E5%93%81&twoLevelVariety=%E7%8E%89%E7%B1%B3",
		"sourceSha256": "244c202055a918a71e1795e14c6985cd3dc7bbb6b528f19e0d17a32d18f27ca7",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "DCE",
		"product": "CS",
		"name": "玉米淀粉",
		"currentCategory": "农产品",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 10,
		"tradingUnit": "10吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E5%86%9C%E4%BA%A7%E5%93%81&twoLevelVariety=%E7%8E%89%E7%B1%B3%E6%B7%80%E7%B2%89",
		"sourceSha256": "0bf2b71b3a65f1311f92b66a048f41d32fcf72bb5397eb0a155c09b68ee8210f",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "DCE",
		"product": "EB",
		"name": "苯乙烯",
		"currentCategory": "能源化工",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 5,
		"tradingUnit": "5吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%83%BD%E6%BA%90%E5%8C%96%E5%B7%A5&twoLevelVariety=%E8%8B%AF%E4%B9%99%E7%83%AF",
		"sourceSha256": "2479fc35847800103f4c27d1b3955ade111b9e90336098922bc226867081d10c",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "DCE",
		"product": "EG",
		"name": "乙二醇",
		"currentCategory": "能源化工",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 10,
		"tradingUnit": "10吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%83%BD%E6%BA%90%E5%8C%96%E5%B7%A5&twoLevelVariety=%E4%B9%99%E4%BA%8C%E9%86%87",
		"sourceSha256": "71a6ca61d37492be6b9c30108f026580414e281259944c3897540ebe0be8a15e",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "DCE",
		"product": "FB",
		"name": "纤维板",
		"currentCategory": "农产品",
		"tickSize": .5,
		"tickText": "0.5元/立方米",
		"multiplier": 10,
		"tradingUnit": "10立方米/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E5%86%9C%E4%BA%A7%E5%93%81&twoLevelVariety=%E7%BA%A4%E7%BB%B4%E6%9D%BF",
		"sourceSha256": "f3750fb6b89972c005c35941675cfef9fecf15ebebb0c646ced42e6420c2d65b",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "DCE",
		"product": "I",
		"name": "铁矿石",
		"currentCategory": "黑色金属",
		"tickSize": .5,
		"tickText": "0.5元/吨",
		"multiplier": 100,
		"tradingUnit": "100吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E9%BB%91%E8%89%B2%E9%87%91%E5%B1%9E&twoLevelVariety=%E9%93%81%E7%9F%BF%E7%9F%B3",
		"sourceSha256": "0b57245c1fafc67eede3fcf10a726e0eaa9cd4a4cdcdc03fcd721a6837a1623f",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "DCE",
		"product": "J",
		"name": "焦炭",
		"currentCategory": "黑色金属",
		"tickSize": .5,
		"tickText": "0.5元/吨",
		"multiplier": 100,
		"tradingUnit": "100吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E9%BB%91%E8%89%B2%E9%87%91%E5%B1%9E&twoLevelVariety=%E7%84%A6%E7%82%AD",
		"sourceSha256": "bb483d95d8f282e20a244d374c6c648f88ad673a93f8ec970ff91bf93f786bf6",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "DCE",
		"product": "JD",
		"name": "鸡蛋",
		"currentCategory": "农产品",
		"tickSize": 1,
		"tickText": "1元/500千克",
		"multiplier": 10,
		"tradingUnit": "5吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E5%86%9C%E4%BA%A7%E5%93%81&twoLevelVariety=%E9%B8%A1%E8%9B%8B",
		"sourceSha256": "90676aa94ccf9fceb8b13522a810eac5d67185d91184bb71573ec50723bbe6fc",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "DCE",
		"product": "JM",
		"name": "焦煤",
		"currentCategory": "黑色金属",
		"tickSize": .5,
		"tickText": "0.5元/吨",
		"multiplier": 60,
		"tradingUnit": "60吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E9%BB%91%E8%89%B2%E9%87%91%E5%B1%9E&twoLevelVariety=%E7%84%A6%E7%85%A4",
		"sourceSha256": "876cbeb2b7362b576856af6a5d7d21edf7b891fb7340daa42a672673d8a723dd",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "DCE",
		"product": "L",
		"name": "聚乙烯",
		"currentCategory": "能源化工",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 5,
		"tradingUnit": "5吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%83%BD%E6%BA%90%E5%8C%96%E5%B7%A5&twoLevelVariety=%E8%81%9A%E4%B9%99%E7%83%AF",
		"sourceSha256": "c3e07fe53e5d1e43a6512f7a45387593bc727d3f2ee7f1c5ed5ab8797eb00587",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "DCE",
		"product": "LF",
		"name": "聚乙烯月均价",
		"currentCategory": "能源化工",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 5,
		"tradingUnit": "5吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%83%BD%E6%BA%90%E5%8C%96%E5%B7%A5&twoLevelVariety=%E8%81%9A%E4%B9%99%E7%83%AF%E6%9C%88%E5%9D%87%E4%BB%B7",
		"sourceSha256": "47af5f4a09729b67cb7dd1dd8182f517608b3c082e4fcbf60bde9f79a9679697",
		"coverage": {
			"quoteDays": 0,
			"quoteFrom": null,
			"quoteThrough": null,
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "DCE",
		"product": "LG",
		"name": "原木",
		"currentCategory": "农产品",
		"tickSize": .5,
		"tickText": "0.5元/立方米",
		"multiplier": 90,
		"tradingUnit": "90立方米/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E5%86%9C%E4%BA%A7%E5%93%81&twoLevelVariety=%E5%8E%9F%E6%9C%A8",
		"sourceSha256": "8b2ca43f176be4bd481f35ea3b27576c41cf8b028755a236931c539613e5f9ab",
		"coverage": {
			"quoteDays": 149,
			"quoteFrom": "2024-11-18",
			"quoteThrough": "2025-06-30",
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "DCE",
		"product": "LH",
		"name": "生猪",
		"currentCategory": "农产品",
		"tickSize": 5,
		"tickText": "5元/吨",
		"multiplier": 16,
		"tradingUnit": "16吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E5%86%9C%E4%BA%A7%E5%93%81&twoLevelVariety=%E7%94%9F%E7%8C%AA",
		"sourceSha256": "5d77f7259e1d91819bde939d8506513619101a93c2f1650dcf3149433a5ffb04",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "DCE",
		"product": "M",
		"name": "豆粕",
		"currentCategory": "农产品",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 10,
		"tradingUnit": "10吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E5%86%9C%E4%BA%A7%E5%93%81&twoLevelVariety=%E8%B1%86%E7%B2%95",
		"sourceSha256": "8ac0cda1a38dda25e07c60bb23d31a4ea910b39525c5a422ea0c85c20a11ff64",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "DCE",
		"product": "P",
		"name": "棕榈油",
		"currentCategory": "农产品",
		"tickSize": 2,
		"tickText": "2元/吨",
		"multiplier": 10,
		"tradingUnit": "10吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E5%86%9C%E4%BA%A7%E5%93%81&twoLevelVariety=%E6%A3%95%E6%A6%88%E6%B2%B9",
		"sourceSha256": "046666a5d6537e6eee07fe1af5dad88f5c84097a4f49ef5fe3ea92dcab35f810",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "DCE",
		"product": "PG",
		"name": "液化石油气",
		"currentCategory": "能源化工",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 20,
		"tradingUnit": "20吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%83%BD%E6%BA%90%E5%8C%96%E5%B7%A5&twoLevelVariety=%E6%B6%B2%E5%8C%96%E7%9F%B3%E6%B2%B9%E6%B0%94",
		"sourceSha256": "99d44374ebeeb1c8af907382ee026947a6d566878c1ff69756328f7c2dc5a43a",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "DCE",
		"product": "PP",
		"name": "聚丙烯",
		"currentCategory": "能源化工",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 5,
		"tradingUnit": "5吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%83%BD%E6%BA%90%E5%8C%96%E5%B7%A5&twoLevelVariety=%E8%81%9A%E4%B8%99%E7%83%AF",
		"sourceSha256": "b942a972538f0fa9c4d438776907b76b9b6e185ce9f878d0be8ad74aeae8a7ff",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "DCE",
		"product": "PPF",
		"name": "聚丙烯月均价",
		"currentCategory": "能源化工",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 5,
		"tradingUnit": "5吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%83%BD%E6%BA%90%E5%8C%96%E5%B7%A5&twoLevelVariety=%E8%81%9A%E4%B8%99%E7%83%AF%E6%9C%88%E5%9D%87%E4%BB%B7",
		"sourceSha256": "ed26e1c6d45f7c853a5b2575e4bd5cff7bdeb74847133ce2cb2d3835c60b95a1",
		"coverage": {
			"quoteDays": 0,
			"quoteFrom": null,
			"quoteThrough": null,
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "DCE",
		"product": "RR",
		"name": "粳米",
		"currentCategory": "农产品",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 10,
		"tradingUnit": "10吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E5%86%9C%E4%BA%A7%E5%93%81&twoLevelVariety=%E7%B2%B3%E7%B1%B3",
		"sourceSha256": "dd305a4fcdcb076eeb4d6670bef364e3866185aa4fdf97f84a68031f7dc4a065",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "DCE",
		"product": "V",
		"name": "聚氯乙烯",
		"currentCategory": "能源化工",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 5,
		"tradingUnit": "5吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%83%BD%E6%BA%90%E5%8C%96%E5%B7%A5&twoLevelVariety=%E8%81%9A%E6%B0%AF%E4%B9%99%E7%83%AF",
		"sourceSha256": "56e18e721af64fc1f222220cae101295bb51e8aa6ab755ede91cd534ae4f5a3c",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "DCE",
		"product": "VF",
		"name": "聚氯乙烯月均价",
		"currentCategory": "能源化工",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 5,
		"tradingUnit": "5吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%83%BD%E6%BA%90%E5%8C%96%E5%B7%A5&twoLevelVariety=%E8%81%9A%E6%B0%AF%E4%B9%99%E7%83%AF%E6%9C%88%E5%9D%87%E4%BB%B7",
		"sourceSha256": "11b8a0e74287ece94c81489744f8f2473eedc4c0d1d09f34b453eef7bd8ff104",
		"coverage": {
			"quoteDays": 0,
			"quoteFrom": null,
			"quoteThrough": null,
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "DCE",
		"product": "Y",
		"name": "豆油",
		"currentCategory": "农产品",
		"tickSize": 2,
		"tickText": "2元/吨",
		"multiplier": 10,
		"tradingUnit": "10吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E5%86%9C%E4%BA%A7%E5%93%81&twoLevelVariety=%E8%B1%86%E6%B2%B9",
		"sourceSha256": "312246251e79f5207a937bb4e6fb7bc8316a6d9681de4be0d86d248787f98c3a",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "GFEX",
		"product": "LC",
		"name": "碳酸锂",
		"currentCategory": "有色金属",
		"tickSize": 50,
		"tickText": "50元/吨",
		"multiplier": 1,
		"tradingUnit": "1吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E6%9C%89%E8%89%B2%E9%87%91%E5%B1%9E&twoLevelVariety=%E7%A2%B3%E9%85%B8%E9%94%82",
		"sourceSha256": "e6ed8f7e704a97252095a986255187ae015762d623a7b00d0928be6f2d53ed96",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "GFEX",
		"product": "PD",
		"name": "钯",
		"currentCategory": "贵金属",
		"tickSize": .05,
		"tickText": "0.05元/克",
		"multiplier": 1e3,
		"tradingUnit": "1000克/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%B4%B5%E9%87%91%E5%B1%9E&twoLevelVariety=%E9%92%AF",
		"sourceSha256": "0a1e793d28eaccae80bede1e103dee620bcf010898ab4e87e7e7169aebe31b54",
		"coverage": {
			"quoteDays": 0,
			"quoteFrom": null,
			"quoteThrough": null,
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "GFEX",
		"product": "PS",
		"name": "多晶硅",
		"currentCategory": "有色金属",
		"tickSize": 5,
		"tickText": "5元/吨",
		"multiplier": 3,
		"tradingUnit": "3吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E6%9C%89%E8%89%B2%E9%87%91%E5%B1%9E&twoLevelVariety=%E5%A4%9A%E6%99%B6%E7%A1%85",
		"sourceSha256": "fcbf00be486e3e1ded8d1fdafea7ca1c6e8b19d11a6a284e56a87babbcde6c6f",
		"coverage": {
			"quoteDays": 121,
			"quoteFrom": "2024-12-26",
			"quoteThrough": "2025-06-30",
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "GFEX",
		"product": "PT",
		"name": "铂",
		"currentCategory": "贵金属",
		"tickSize": .05,
		"tickText": "0.05元/克",
		"multiplier": 1e3,
		"tradingUnit": "1000克/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%B4%B5%E9%87%91%E5%B1%9E&twoLevelVariety=%E9%93%82",
		"sourceSha256": "a895e57926b69bc8dfeb9a13187dc3289cad2a2e1e8e7fef44e2815994791c5d",
		"coverage": {
			"quoteDays": 0,
			"quoteFrom": null,
			"quoteThrough": null,
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "GFEX",
		"product": "SI",
		"name": "工业硅",
		"currentCategory": "有色金属",
		"tickSize": 5,
		"tickText": "5元/吨",
		"multiplier": 5,
		"tradingUnit": "5吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E6%9C%89%E8%89%B2%E9%87%91%E5%B1%9E&twoLevelVariety=%E5%B7%A5%E4%B8%9A%E7%A1%85",
		"sourceSha256": "1546016798033d91c5cf007e7ae7921eecae602c1bd0927a4cea3b8502bafb42",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "INE",
		"product": "BC",
		"name": "铜(BC)",
		"currentCategory": "有色金属",
		"tickSize": 10,
		"tickText": "10元（人民币）/吨",
		"multiplier": 5,
		"tradingUnit": "5吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E6%9C%89%E8%89%B2%E9%87%91%E5%B1%9E&twoLevelVariety=%E9%93%9C%28BC%29",
		"sourceSha256": "c0ebbc2f6f6dd2491353347d2513d1880d242ff91034196c38da4b71d4916233",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "INE",
		"product": "EC",
		"name": "集运指数（欧线）",
		"currentCategory": "商品指数",
		"tickSize": .5,
		"tickText": "0.5点",
		"multiplier": 50,
		"tradingUnit": "每点50元",
		"sourceUrl": "https://www.ine.cn/products/futures/index_f/",
		"sourceSha256": "",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "INE",
		"product": "LU",
		"name": "低硫燃料油",
		"currentCategory": "能源化工",
		"tickSize": 1,
		"tickText": "1元（人民币）/吨",
		"multiplier": 10,
		"tradingUnit": "10吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%83%BD%E6%BA%90%E5%8C%96%E5%B7%A5&twoLevelVariety=%E4%BD%8E%E7%A1%AB%E7%87%83%E6%96%99%E6%B2%B9",
		"sourceSha256": "edb973e3ee475f042f0e18993401dc41647bb3ddc9480b8434896e4ecadce0e5",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "INE",
		"product": "NR",
		"name": "20号胶",
		"currentCategory": "能源化工",
		"tickSize": 5,
		"tickText": "5元（人民币）/吨",
		"multiplier": 10,
		"tradingUnit": "10吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%83%BD%E6%BA%90%E5%8C%96%E5%B7%A5&twoLevelVariety=20%E5%8F%B7%E8%83%B6",
		"sourceSha256": "fe33908c5f22b466355c6045d6a8d21cde33f5c02efab9bead022afec026cdf7",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "INE",
		"product": "SC",
		"name": "原油",
		"currentCategory": "能源化工",
		"tickSize": .1,
		"tickText": "0.1元（人民币）/桶",
		"multiplier": 1e3,
		"tradingUnit": "1000桶/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%83%BD%E6%BA%90%E5%8C%96%E5%B7%A5&twoLevelVariety=%E5%8E%9F%E6%B2%B9",
		"sourceSha256": "d2982a93f6307dc8ba062b81d5c9a6c50901917383b4944176f56c94d0759b7e",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "SHFE",
		"product": "AD",
		"name": "铸造铝合金",
		"currentCategory": "有色金属",
		"tickSize": 5,
		"tickText": "5元/吨",
		"multiplier": 10,
		"tradingUnit": "10吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E6%9C%89%E8%89%B2%E9%87%91%E5%B1%9E&twoLevelVariety=%E9%93%B8%E9%80%A0%E9%93%9D%E5%90%88%E9%87%91",
		"sourceSha256": "af00f31112e4e863352215e2d1875c02c2e56c698cb62e9397375f899a9c0c93",
		"coverage": {
			"quoteDays": 15,
			"quoteFrom": "2025-06-10",
			"quoteThrough": "2025-06-30",
			"feeDays": 15,
			"feeFrom": "2025-06-10",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "SHFE",
		"product": "AG",
		"name": "白银",
		"currentCategory": "贵金属",
		"tickSize": 1,
		"tickText": "1元/千克",
		"multiplier": 15,
		"tradingUnit": "15千克/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%B4%B5%E9%87%91%E5%B1%9E&twoLevelVariety=%E7%99%BD%E9%93%B6",
		"sourceSha256": "76d7803c366566b9a1e7df10f8b601508cf2489e4a166cf766264e03623e0f52",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "SHFE",
		"product": "AL",
		"name": "铝",
		"currentCategory": "有色金属",
		"tickSize": 5,
		"tickText": "5元/吨",
		"multiplier": 5,
		"tradingUnit": "5吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E6%9C%89%E8%89%B2%E9%87%91%E5%B1%9E&twoLevelVariety=%E9%93%9D",
		"sourceSha256": "adf4497c20024d32043b86cafd32a1301709cfa26ce9bb1abd251850573c6d04",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "SHFE",
		"product": "AO",
		"name": "氧化铝",
		"currentCategory": "有色金属",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 20,
		"tradingUnit": "20吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E6%9C%89%E8%89%B2%E9%87%91%E5%B1%9E&twoLevelVariety=%E6%B0%A7%E5%8C%96%E9%93%9D",
		"sourceSha256": "8a81298c2eb54e97040effb485b314defd47761680f406b87e6c43142e62b5cd",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "SHFE",
		"product": "AU",
		"name": "黄金",
		"currentCategory": "贵金属",
		"tickSize": .02,
		"tickText": "0.02元/克",
		"multiplier": 1e3,
		"tradingUnit": "1000克/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%B4%B5%E9%87%91%E5%B1%9E&twoLevelVariety=%E9%BB%84%E9%87%91",
		"sourceSha256": "0f09d38e2e294b410e0feba7626f7be81bc60a8c99dc5089814c9be6bf960c63",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "SHFE",
		"product": "BR",
		"name": "合成橡胶",
		"currentCategory": "能源化工",
		"tickSize": 5,
		"tickText": "5元/吨",
		"multiplier": 5,
		"tradingUnit": "5吨/手",
		"sourceUrl": "https://www.shfe.com.cn/products/futures/energyandchemical/br_f/",
		"sourceSha256": "",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "SHFE",
		"product": "BU",
		"name": "石油沥青",
		"currentCategory": "能源化工",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 10,
		"tradingUnit": "10吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%83%BD%E6%BA%90%E5%8C%96%E5%B7%A5&twoLevelVariety=%E7%9F%B3%E6%B2%B9%E6%B2%A5%E9%9D%92",
		"sourceSha256": "d6fd43825c78e6878b3cbea8997db142e27cccb6c147f98b487d9d125617d42e",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "SHFE",
		"product": "CU",
		"name": "铜",
		"currentCategory": "有色金属",
		"tickSize": 10,
		"tickText": "10元/吨",
		"multiplier": 5,
		"tradingUnit": "5吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E6%9C%89%E8%89%B2%E9%87%91%E5%B1%9E&twoLevelVariety=%E9%93%9C",
		"sourceSha256": "b46121e5460304011410027b1c40e67966711fca39b043b28f1dc87e56453e38",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "SHFE",
		"product": "FU",
		"name": "燃料油",
		"currentCategory": "能源化工",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 10,
		"tradingUnit": "10吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%83%BD%E6%BA%90%E5%8C%96%E5%B7%A5&twoLevelVariety=%E7%87%83%E6%96%99%E6%B2%B9",
		"sourceSha256": "455a703da20792c185935f6107a22e17ab0aeaf7d69a7fb6e0a6d2ada9fa60d7",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "SHFE",
		"product": "HC",
		"name": "热轧卷板",
		"currentCategory": "黑色金属",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 10,
		"tradingUnit": "10吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E9%BB%91%E8%89%B2%E9%87%91%E5%B1%9E&twoLevelVariety=%E7%83%AD%E8%BD%A7%E5%8D%B7%E6%9D%BF",
		"sourceSha256": "a92bb08ea0e727ba767bb393478d0c27f55ac1b86b28cf9d4e4f069c0df2ef54",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "SHFE",
		"product": "NI",
		"name": "镍",
		"currentCategory": "有色金属",
		"tickSize": 10,
		"tickText": "10元/吨",
		"multiplier": 1,
		"tradingUnit": "1吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E6%9C%89%E8%89%B2%E9%87%91%E5%B1%9E&twoLevelVariety=%E9%95%8D",
		"sourceSha256": "28a17d959f7bb98fcbbb7e9a51824d7e96d94ffb0693a311e52f9da87c1b145c",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "SHFE",
		"product": "OP",
		"name": "胶版印刷纸",
		"currentCategory": "能源化工",
		"tickSize": 2,
		"tickText": "2元/吨",
		"multiplier": 40,
		"tradingUnit": "40吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%83%BD%E6%BA%90%E5%8C%96%E5%B7%A5&twoLevelVariety=%E8%83%B6%E7%89%88%E5%8D%B0%E5%88%B7%E7%BA%B8",
		"sourceSha256": "da38dfd97f4a604ddf9e9758a7a282ab259cca3bf06230987a42d10ff9514f7a",
		"coverage": {
			"quoteDays": 0,
			"quoteFrom": null,
			"quoteThrough": null,
			"feeDays": 0,
			"feeFrom": null,
			"feeThrough": null
		}
	},
	{
		"exchange": "SHFE",
		"product": "PB",
		"name": "铅",
		"currentCategory": "有色金属",
		"tickSize": 5,
		"tickText": "5元/吨",
		"multiplier": 5,
		"tradingUnit": "5吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E6%9C%89%E8%89%B2%E9%87%91%E5%B1%9E&twoLevelVariety=%E9%93%85",
		"sourceSha256": "5f0ee1bac9dfd1841eb422be05cda16d7fc2ab594ea40b9050a9ae0e17928aa9",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "SHFE",
		"product": "RB",
		"name": "螺纹钢",
		"currentCategory": "黑色金属",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 10,
		"tradingUnit": "10吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E9%BB%91%E8%89%B2%E9%87%91%E5%B1%9E&twoLevelVariety=%E8%9E%BA%E7%BA%B9%E9%92%A2",
		"sourceSha256": "8737cc5384dc9e9c4df40da2fb665173c1d1067cdfb693216886013a73c2a7db",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "SHFE",
		"product": "RU",
		"name": "天然橡胶",
		"currentCategory": "能源化工",
		"tickSize": 5,
		"tickText": "5元/吨",
		"multiplier": 10,
		"tradingUnit": "10吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%83%BD%E6%BA%90%E5%8C%96%E5%B7%A5&twoLevelVariety=%E5%A4%A9%E7%84%B6%E6%A9%A1%E8%83%B6",
		"sourceSha256": "b9888365c4133f99cfc3b993b69e60e41ef066bc7bc8ee1e0c5953c39a7ba7e2",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "SHFE",
		"product": "SN",
		"name": "锡",
		"currentCategory": "有色金属",
		"tickSize": 10,
		"tickText": "10元/吨",
		"multiplier": 1,
		"tradingUnit": "1吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E6%9C%89%E8%89%B2%E9%87%91%E5%B1%9E&twoLevelVariety=%E9%94%A1",
		"sourceSha256": "9caa1dbf348c172ec75dd4ec8ed5f8682dcb54f4b7ac450db6452d4bb99d27ed",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "SHFE",
		"product": "SP",
		"name": "纸浆",
		"currentCategory": "能源化工",
		"tickSize": 2,
		"tickText": "2元/吨",
		"multiplier": 10,
		"tradingUnit": "10吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E8%83%BD%E6%BA%90%E5%8C%96%E5%B7%A5&twoLevelVariety=%E7%BA%B8%E6%B5%86",
		"sourceSha256": "71c654223732515c1d50c63b2565ee5145d13a8dd83e973fcc45656e636b70d1",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "SHFE",
		"product": "SS",
		"name": "不锈钢",
		"currentCategory": "黑色金属",
		"tickSize": 5,
		"tickText": "5元/吨",
		"multiplier": 5,
		"tradingUnit": "5吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E9%BB%91%E8%89%B2%E9%87%91%E5%B1%9E&twoLevelVariety=%E4%B8%8D%E9%94%88%E9%92%A2",
		"sourceSha256": "5102f6f3db2db626be3e3c8cbade797a49713c51cb40364f070dd440cca202d4",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "SHFE",
		"product": "WR",
		"name": "线材",
		"currentCategory": "黑色金属",
		"tickSize": 1,
		"tickText": "1元/吨",
		"multiplier": 10,
		"tradingUnit": "10吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E9%BB%91%E8%89%B2%E9%87%91%E5%B1%9E&twoLevelVariety=%E7%BA%BF%E6%9D%90",
		"sourceSha256": "6599b425b8083c5ff92950c17940116da6e2921aa8d5efaca2aba68bc05e4a2e",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	},
	{
		"exchange": "SHFE",
		"product": "ZN",
		"name": "锌",
		"currentCategory": "有色金属",
		"tickSize": 5,
		"tickText": "5元/吨",
		"multiplier": 5,
		"tradingUnit": "5吨/手",
		"sourceUrl": "https://www.cfachina.org/report/api/fwzc/varieties/findVarieties?varietyType=1&oneLevelVariety=%E6%9C%89%E8%89%B2%E9%87%91%E5%B1%9E&twoLevelVariety=%E9%94%8C",
		"sourceSha256": "443fc9faf76d7f6e981c11985d506ce4d97d72107311f4fcba2e21b64b69505e",
		"coverage": {
			"quoteDays": 359,
			"quoteFrom": "2024-01-02",
			"quoteThrough": "2025-06-30",
			"feeDays": 359,
			"feeFrom": "2024-01-02",
			"feeThrough": "2025-06-30"
		}
	}
];
const historicalRules = [
	{
		"exchange": "SHFE",
		"product": "CU",
		"validFrom": "2024-01-02",
		"validThrough": "2025-06-30",
		"tickSize": 10,
		"multiplier": 5,
		"sourceUrl": "https://www.shfe.com.cn/products/futures/metal/nonferrousmetal/cu_f/standard_cu_f/202312/t20231205_331277.html",
		"historicalSector": "工业金属",
		"sectorSourceUrl": "https://tsite.shfe.com.cn/upload/20230725/1690269679648.pdf"
	},
	{
		"exchange": "SHFE",
		"product": "AL",
		"validFrom": "2024-01-02",
		"validThrough": "2025-06-30",
		"tickSize": 5,
		"multiplier": 5,
		"sourceUrl": "https://www.shfe.com.cn/upload/20190919/1568880174521.pdf",
		"historicalSector": "工业金属",
		"sectorSourceUrl": "https://tsite.shfe.com.cn/upload/20230725/1690269679648.pdf"
	},
	{
		"exchange": "SHFE",
		"product": "ZN",
		"validFrom": "2024-01-02",
		"validThrough": "2025-06-30",
		"tickSize": 5,
		"multiplier": 5,
		"sourceUrl": "https://www.shfe.com.cn/products/futures/metal/nonferrousmetal/zn_f/standard_zn_f/202312/t20231205_309038.html",
		"historicalSector": "工业金属",
		"sectorSourceUrl": "https://tsite.shfe.com.cn/upload/20230725/1690269679648.pdf"
	},
	{
		"exchange": "INE",
		"product": "EC",
		"validFrom": "2024-01-02",
		"validThrough": "2025-06-30",
		"tickSize": .1,
		"multiplier": 50,
		"sourceUrl": "https://www.ine.cn/index/othercontents/2023_EC/manual.pdf"
	},
	{
		"exchange": "CZCE",
		"product": "SO",
		"validFrom": "2026-11-12",
		"validThrough": "2026-11-23",
		"tickSize": 1,
		"multiplier": 20,
		"sourceUrl": "https://www.czce.com.cn/cn/content_file/flfg/zcjywgz/pzxz/2026/11/cd4d36000a5d4b63aecb80aeaa914efc.pdf"
	}
];
//#endregion
//#region packages/panda-mcp/lib/types/futures-reference-reports.js
const pandaFuturesUrl = "https://www.pandaaiquant.com/docs/strategy/futures";
function tradingDay(value) {
	const match = /^(\d{4})(\d{2})(\d{2})$|^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());
	if (!match) return null;
	const iso = (match[1] ? match.slice(1, 4) : match.slice(4, 7)).join("-");
	const stamp = new Date(iso);
	return Number.isFinite(stamp.getTime()) && stamp.toISOString().slice(0, 10) === iso ? iso : null;
}
function beijingTime(date, time) {
	const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(time);
	return match ? `${date}T${match[1]}:${match[2]}:${match[3] ?? "00"}+08:00` : null;
}
function sourceFor(date, status, cutoff, url = null, provider = "exchange") {
	return {
		status,
		url,
		provider,
		reportDate: date,
		sha256: null,
		sourceUpdatedAt: null,
		firstPublishedAt: null,
		cutoff: cutoff ? "unknown" : null
	};
}
function specification(exchange, kind, day) {
	if (exchange === "SHFE" || exchange === "INE") {
		const base = exchange === "SHFE" ? "https://www.shfe.com.cn" : "https://www.ine.cn";
		const [path, key] = {
			quotes: ["tradedata/future/dailydata/kx", "o_curinstrument"],
			settlement: ["busiparamdata/future/Settlement", "Settlement"],
			contracts: ["busiparamdata/future/ContractBaseInfo", "ContractBaseInfo"]
		}[kind];
		return {
			url: `${base}/data/${path}${day}.dat`,
			key,
			extension: "json",
			format: "shanghai"
		};
	}
	if (exchange === "CZCE" && kind !== "contracts") {
		const name = kind === "quotes" ? "FutureDataDaily" : "FutureDataClearParams";
		const key = kind === "quotes" ? "期货每日行情表" : "期货结算参数表";
		return {
			url: `https://www.czce.com.cn/cn/DFSStaticFiles/Future/${day.slice(0, 4)}/${day}/${name}.txt`,
			key,
			extension: "txt",
			format: "zhengzhou"
		};
	}
	if (exchange === "CFFEX" && kind !== "contracts") {
		const path = kind === "quotes" ? "hqsj/rtj" : "jscs";
		const key = kind === "quotes" ? "合约代码" : "期货合约结算业务参数表";
		return {
			url: `http://www.cffex.com.cn/sj/${path}/${day.slice(0, 6)}/${day.slice(-2)}/${day}_1.csv`,
			key,
			extension: "csv",
			format: "cffex"
		};
	}
	return null;
}
function reportText(raw) {
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(raw);
	} catch {
		return new TextDecoder("gb18030", { fatal: true }).decode(raw);
	}
}
function decodeReport(raw, spec, kind, date) {
	const content = reportText(raw);
	if (spec.format === "shanghai") {
		const report = JSON.parse(content);
		const rows = report[spec.key];
		if (tradingDay(report.report_date) !== date || !Array.isArray(rows) || !rows.every((row) => row && typeof row === "object" && !Array.isArray(row))) throw new Error("Unexpected Shanghai report date or schema");
		const match = /^(\d{8}) (\d{2}:\d{2}:\d{2})$/.exec(String(report.update_date ?? "").trim());
		const updatedDate = match && tradingDay(match[1]);
		return {
			rows,
			updated: updatedDate && updatedDate >= date ? beijingTime(updatedDate, match[2]) : null
		};
	}
	const [title = "", ...lines] = content.trim().split(/\r?\n/);
	if (spec.format === "zhengzhou") {
		const header = lines.shift()?.split("|").map((value) => value.trim());
		if (!title.includes(spec.key) || !title.includes(date) || !header?.includes("合约代码")) throw new Error("Unexpected Zhengzhou report date or schema");
		if (!(kind === "quotes" ? [
			"持仓量",
			"成交量(手)",
			"今结算"
		] : [
			"交易手续费",
			"手续费收取方式",
			"日内平今仓交易手续费",
			"交易保证金率(%)"
		]).every((column) => header.includes(column))) throw new Error("Missing Zhengzhou report columns");
		return {
			rows: lines.filter((line) => line.includes("|")).map((line) => {
				const cells = line.split("|");
				if (cells.length !== header.length) throw new Error("Unexpected Zhengzhou row length");
				return Object.fromEntries(header.map((key, index) => [key, cells[index].trim()]));
			}),
			updated: null
		};
	}
	if (kind === "settlement" && (!title.includes(spec.key) || !title.includes(date.replaceAll("-", "")))) throw new Error("Unexpected CFFEX settlement bulletin");
	const optionsStart = lines.findIndex((line) => line.trimStart().startsWith("期权合约结算业务参数表"));
	const csv = kind === "quotes" ? content : (optionsStart === -1 ? lines : lines.slice(0, optionsStart)).join("\n");
	if (!(kind === "quotes" ? [
		spec.key,
		"持仓量",
		"成交量",
		"今结算"
	] : [
		"期货合约",
		"交易手续费标准",
		"平今仓收取率",
		"合约多头保证金标准",
		"合约空头保证金标准"
	]).every((field) => csv.split(/\r?\n/, 1)[0]?.split(",").includes(field))) throw new Error("Unexpected CFFEX report schema");
	return {
		rows: parseCsv(csv),
		updated: null
	};
}
async function boundedBody(response) {
	const reader = response.body?.getReader();
	if (!reader) throw new Error("Empty exchange response");
	const limit = 4 * 1024 * 1024;
	const chunks = [];
	let size = 0;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) return Buffer.concat(chunks, size);
			size += value.byteLength;
			if (size > limit) throw new Error("Exchange report exceeds size limit");
			chunks.push(value);
		}
	} finally {
		await reader.cancel().catch(() => {});
	}
}
var FuturesReports = class {
	fetch;
	archive;
	constructor(fetch, archive) {
		this.fetch = fetch;
		this.archive = archive;
	}
	async cached(exchange, kind, filename) {
		if (!this.archive) return void 0;
		try {
			return await readFile(join(this.archive, exchange, kind, filename));
		} catch (error) {
			if (error.code === "ENOENT") return void 0;
			throw error;
		}
	}
	async read(exchange, kind, date, cutoff, signal) {
		const day = date.replaceAll("-", "");
		const spec = specification(exchange, kind, day);
		const vendorArchive = !spec && kind === "quotes" && (exchange === "DCE" || exchange === "GFEX");
		const source = sourceFor(date, spec || vendorArchive ? "missing" : "unsupported", cutoff, spec?.url ?? (vendorArchive ? "https://www.pandaaiquant.com/docs/strategy/futures" : null), vendorArchive ? "pandadata" : "exchange");
		if (!spec && !vendorArchive) return {
			rows: [],
			source
		};
		try {
			let raw = await this.cached(exchange, kind, `${day}.${spec?.extension ?? "csv"}`);
			if (spec && !raw) {
				const timeout = AbortSignal.timeout(12e3);
				const response = await this.fetch(spec.url, {
					redirect: "error",
					signal: signal ? AbortSignal.any([signal, timeout]) : timeout
				});
				if (!response.ok) {
					await response.body?.cancel();
					return {
						rows: [],
						source: {
							...source,
							status: [404, 410].includes(response.status) ? "missing" : "error"
						}
					};
				}
				raw = await boundedBody(response);
			}
			if (!raw) return {
				rows: [],
				source
			};
			const { rows, updated } = spec ? decodeReport(raw, spec, kind, date) : {
				rows: parseCsv(reportText(raw)),
				updated: null
			};
			if (!spec && rows.some((row) => row.exchange !== exchange || tradingDay(row.date) !== date)) throw new Error("Unexpected PandaData snapshot date or exchange");
			return {
				rows,
				source: {
					...source,
					status: "available",
					sha256: createHash("sha256").update(raw).digest("hex"),
					sourceUpdatedAt: updated,
					cutoff: cutoff && updated ? updated <= cutoff ? "visible" : "after_cutoff" : source.cutoff
				}
			};
		} catch {
			signal?.throwIfAborted();
			return {
				rows: [],
				source: {
					...source,
					status: "error"
				}
			};
		}
	}
};
//#endregion
//#region packages/panda-mcp/lib/types/futures-reference.js
const futuresCatalog = {
	snapshotDate: "2026-11-23",
	exchanges: [
		{
			id: "SHFE",
			name: "上海期货交易所"
		},
		{
			id: "INE",
			name: "上海国际能源交易中心"
		},
		{
			id: "DCE",
			name: "大连商品交易所"
		},
		{
			id: "CZCE",
			name: "郑州商品交易所"
		},
		{
			id: "CFFEX",
			name: "中国金融期货交易所"
		},
		{
			id: "GFEX",
			name: "广州期货交易所"
		}
	],
	products
};
const vendorExchanges = {
	SHFE: "SHF",
	INE: "INE",
	DCE: "DCE",
	CZCE: "CZC",
	CFFEX: "CFE",
	GFEX: "GFE"
};
const productByCode = new Map(products.map((product) => [`${product.exchange}/${product.product}`, product]));
const codeText = (value) => String(value ?? "").trim().toUpperCase();
const decimal = (value) => {
	const text = String(value ?? "").trim().replaceAll(",", "");
	const result = Number(text);
	return text && Number.isFinite(result) ? result : null;
};
function contractCode(exchange, value) {
	const [contract = "", suffix, ...rest] = codeText(value).split(".");
	if (rest.length || suffix !== void 0 && suffix !== vendorExchanges[exchange] && suffix !== exchange) return null;
	const match = /^([A-Z]+)(\d{3,4})(F?)$/.exec(contract);
	if (!match || match[2]?.length !== (exchange === "CZCE" ? 3 : 4)) return null;
	const month = Number(match[2].slice(-2));
	const product = match[1] + match[3];
	if (month < 1 || month > 12 || !productByCode.has(`${exchange}/${product}`)) return null;
	return {
		contract,
		product
	};
}
function quoteFrom(row, exchange) {
	const read = (code, interest, volume, settlement) => ({
		code,
		quote: {
			openInterest: decimal(interest),
			volume: decimal(volume),
			settlement: decimal(settlement)
		}
	});
	if (exchange === "SHFE" || exchange === "INE") return read(codeText(row.PRODUCTGROUPID) + codeText(row.DELIVERYMONTH), row.OPENINTEREST, row.VOLUME, row.SETTLEMENTPRICE);
	if (exchange === "CZCE") return read(row["合约代码"], row["持仓量"], row["成交量(手)"], row["今结算"]);
	if (exchange === "CFFEX") return read(row["合约代码"], row["持仓量"], row["成交量"], row["今结算"]);
	return read(row.contract ?? row.symbol, row.open_interest, row.volume, row.settlement);
}
function takeQuoteRows(exchange, product, report) {
	const quotes = /* @__PURE__ */ new Map();
	for (const row of report.rows) {
		const { code, quote } = quoteFrom(row, exchange);
		const parsed = contractCode(exchange, code);
		if (parsed?.product !== product) continue;
		if (quotes.has(parsed.contract)) {
			report.source.status = "error";
			return /* @__PURE__ */ new Map();
		}
		if (Object.values(quote).some((value) => value !== null)) quotes.set(parsed.contract, quote);
	}
	return quotes;
}
function researchMain(quotes) {
	return [...quotes].filter(([, row]) => (row.openInterest ?? 0) > 0 && row.volume !== null && row.volume >= 0 && row.settlement).sort(([a, left], [b, right]) => right.openInterest - left.openInterest || right.volume - left.volume || a.localeCompare(b))[0]?.[0] ?? null;
}
function requiredNumber(value) {
	const number = decimal(value);
	if (number === null || number < 0) throw new Error("Missing or invalid settlement number");
	return number;
}
function percentage(value) {
	return requiredNumber(String(value ?? "").trim().replace(/%$/, "")) / 100;
}
function splitFee(value, mode) {
	const amount = requiredNumber(value);
	if (mode === "绝对值") return {
		yuanPerLot: amount,
		rate: 0
	};
	if (mode === "比例值") return {
		yuanPerLot: 0,
		rate: amount / 1e4
	};
	throw new Error("Unsupported settlement fee unit");
}
function feesFrom(exchange, row) {
	let open, closeToday, marginLong, marginShort;
	if (exchange === "CZCE") {
		open = splitFee(row["交易手续费"], row["手续费收取方式"]);
		closeToday = splitFee(row["日内平今仓交易手续费"], row["手续费收取方式"]);
		marginLong = marginShort = percentage(row["交易保证金率(%)"]);
	} else {
		let discount;
		if (exchange === "CFFEX") {
			const text = String(row["交易手续费标准"] ?? "").trim();
			const match = /^(?:万分之(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)元\/手)$/.exec(text);
			if (!match) throw new Error("Unsupported CFFEX fee unit");
			open = match[1] ? splitFee(match[1], "比例值") : splitFee(match[2], "绝对值");
			discount = percentage(row["平今仓收取率"]);
			marginLong = percentage(row["合约多头保证金标准"]);
			marginShort = percentage(row["合约空头保证金标准"]);
		} else {
			open = {
				yuanPerLot: requiredNumber(row.TRADEFEEUNIT),
				rate: requiredNumber(row.TRADEFEERATION)
			};
			discount = requiredNumber(row.DISCOUNTRATE);
			marginLong = requiredNumber(row.SPEC_LONGMARGINRATIO);
			marginShort = requiredNumber(row.SPEC_SHORTMARGINRATIO);
		}
		closeToday = {
			yuanPerLot: open.yuanPerLot * discount,
			rate: open.rate * discount
		};
	}
	if (Math.max(marginLong, marginShort) > 1) throw new Error("Margin must be a fraction");
	return {
		open,
		closePrevious: { ...open },
		closeToday,
		marginLong: marginLong || null,
		marginShort: marginShort || null
	};
}
function forContract(report, rows, decode) {
	if (report.source.status !== "available") return null;
	if (!rows.length) {
		report.source.status = "no_contract";
		return null;
	}
	try {
		if (rows.length !== 1) throw new Error("Duplicate contract report rows");
		return decode(rows[0]);
	} catch {
		report.source.status = "error";
		return null;
	}
}
function termsFrom(row) {
	return {
		listedDate: tradingDay(row.OPENDATE),
		lastTradingDate: tradingDay(row.EXPIREDATE),
		deliveryStart: tradingDay(row.STARTDELIVDATE),
		deliveryEnd: tradingDay(row.ENDDELIVDATE)
	};
}
var FuturesReference = class {
	reports;
	panda;
	constructor(options = {}) {
		this.reports = new FuturesReports(options.fetch ?? globalThis.fetch, options.archive);
		this.panda = options.panda;
	}
	async vendorQuote(exchange, product, date, cutoff, explicit, signal) {
		const source = sourceFor(date, "no_contract", cutoff, pandaFuturesUrl, "pandadata");
		const report = {
			rows: [],
			source
		};
		const day = date.replaceAll("-", "");
		const dates = {
			start_date: day,
			end_date: day
		};
		let main = null;
		if (!this.panda) {
			source.status = "login_required";
			return {
				report,
				main
			};
		}
		try {
			const call = async (method, params) => {
				const raw = await this.panda(method, params, signal);
				if (raw && typeof raw === "object" && "error" in raw && raw.error === "reauth_required") {
					source.status = "login_required";
					return [];
				}
				return dataRows(raw);
			};
			if (!explicit) {
				const mapping = (await call("get_future_dominant", {
					underlying_symbol: product,
					...dates
				})).filter((row) => tradingDay(row.date) === date && codeText(row.underlying_symbol) === product);
				if (mapping.length > 1) throw new Error("Ambiguous PandaData mapping");
				const parsed = contractCode(exchange, mapping[0]?.symbol);
				if (mapping.length && parsed?.product !== product) throw new Error("Unexpected PandaData contract");
				main = parsed?.contract ?? null;
			}
			const contract = explicit ?? main;
			if (contract) {
				const symbol = `${contract}.${vendorExchanges[exchange]}`;
				report.rows = (await call("get_future_daily", {
					symbol,
					...dates,
					fields: [
						"symbol",
						"date",
						"open_interest",
						"volume",
						"settlement"
					]
				})).filter((row) => tradingDay(row.date) === date && codeText(row.symbol) === symbol);
				if (report.rows.length) source.status = "available";
			}
		} catch {
			signal?.throwIfAborted();
			source.status = "error";
		}
		return {
			report,
			main
		};
	}
	async query(input, signal) {
		if (!futuresCatalog.exchanges.some((exchange) => exchange.id === input?.exchange)) throw new Error("请选择有效的期货交易所");
		const { exchange } = input;
		const parsed = contractCode(exchange, input.symbol);
		const product = productByCode.get(`${exchange}/${parsed?.product ?? codeText(input.symbol)}`);
		if (!product) throw new Error("该交易所没有此品种或合约代码。郑商所合约请使用三位年月代码。");
		const date = input.date === void 0 ? null : tradingDay(input.date);
		if (input.date !== void 0 && !date) throw new Error("交易日格式无效，请使用 YYYY-MM-DD");
		let cutoff = null;
		if (input.cutoff !== void 0) {
			const [day, clock, ...rest] = typeof input.cutoff === "string" ? input.cutoff.replace(/\+08:00$/, "").split("T") : [];
			const cutoffDay = tradingDay(day);
			cutoff = cutoffDay && clock && !rest.length ? beijingTime(cutoffDay, clock) : null;
			if (!date || !cutoff) throw new Error("可见时点核验需指定交易日和有效的北京时间");
		}
		const result = {
			product,
			catalogDate: futuresCatalog.snapshotDate,
			date,
			contract: parsed?.contract ?? null,
			main: null,
			quote: null,
			quoteSource: null,
			fees: null,
			feeSource: null,
			historicalRule: null,
			contractTerms: null,
			contractSource: null
		};
		if (!date) return result;
		const rule = historicalRules.find((item) => item.exchange === exchange && item.product === product.product && item.validFrom <= date && date <= item.validThrough);
		if (rule) {
			const { exchange: _exchange, product: _product, ...historicalRule } = rule;
			result.historicalRule = historicalRule;
		}
		let [quotesReport, feeReport, contractReport] = await Promise.all([
			this.reports.read(exchange, "quotes", date, cutoff, signal),
			this.reports.read(exchange, "settlement", date, cutoff, signal),
			this.reports.read(exchange, "contracts", date, cutoff, signal)
		]);
		const canRecalculateMain = quotesReport.source.status === "available";
		if ((exchange === "DCE" || exchange === "GFEX") && quotesReport.source.status === "missing") {
			const { report, main } = await this.vendorQuote(exchange, product.product, date, cutoff, result.contract, signal);
			quotesReport = report;
			if (main) result.main = {
				contract: main,
				method: "pandadata"
			};
		}
		const quotes = takeQuoteRows(exchange, product.product, quotesReport);
		if (canRecalculateMain && quotesReport.source.status === "available") {
			const main = researchMain(quotes);
			if (main) result.main = {
				contract: main,
				method: "after_close"
			};
		}
		result.contract ??= result.main?.contract ?? null;
		const contract = result.contract;
		result.quoteSource = quotesReport.source;
		result.quote = contract ? quotes.get(contract) ?? null : null;
		if (!result.quote && quotesReport.source.status === "available") quotesReport.source.status = "no_contract";
		result.fees = forContract(feeReport, contract ? feeReport.rows.filter((row) => codeText(row.INSTRUMENTID ?? row["合约代码"] ?? row["期货合约"]) === contract) : [], (row) => {
			if ((exchange === "SHFE" || exchange === "INE") && tradingDay(row.TRADINGDAY) !== date) throw new Error("Wrong settlement date");
			return feesFrom(exchange, row);
		});
		result.feeSource = feeReport.source;
		if (exchange === "INE" && contract && contractReport.source.status !== "available") {
			const combined = await this.reports.read("SHFE", "contracts", date, cutoff, signal);
			if (combined.source.status === "available") contractReport = combined;
		}
		const termRows = contract ? contractReport.rows.filter((row) => {
			const venue = codeText(row.EXCHANGEID);
			return codeText(row.INSTRUMENTID) === contract && (venue === exchange || exchange === "INE" && venue === "SHFE");
		}) : [];
		result.contractTerms = forContract(contractReport, termRows, (row) => {
			if (tradingDay(row.TRADINGDAY) !== date) throw new Error("Wrong contract report date");
			return termsFrom(row);
		});
		result.contractSource = contractReport.source;
		return result;
	}
};
//#endregion
//#region packages/panda-mcp/lib/types/browser.js
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
	return new Promise((resolve, reject) => {
		const child = spawn(launch.command, launch.args, {
			detached: true,
			stdio: "ignore",
			windowsHide: true
		});
		child.once("error", () => reject(/* @__PURE__ */ new Error("无法打开本机浏览器，请使用 QuantSkills 网页授权。")));
		child.once("exit", (code) => code === 0 ? resolve() : reject(/* @__PURE__ */ new Error("本机浏览器启动失败，请使用 QuantSkills 网页授权。")));
		child.unref();
	});
}
//#endregion
//#region packages/panda-mcp/lib/types/callback-server.js
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
async function startOauthLoopback(options = {}) {
	const state = randomUUID();
	let settle;
	const pending = new Promise((resolve) => {
		settle = resolve;
	});
	const server = createServer((request, response) => {
		handleCallback(request, response, state, options.publicOrigin, (result) => {
			settle?.(result);
			settle = void 0;
		});
	});
	await listenLoopback(server, options.port ?? 0);
	const address = server.address();
	if (address === null || typeof address === "string") {
		server.close();
		throw new Error("PandaData MCP 无法绑定本机回环端口。");
	}
	return {
		redirectUrl: options.publicOrigin === void 0 ? `http://127.0.0.1:${address.port}/callback` : `${options.publicOrigin}/api/quantskills/panda-oauth/callback`,
		state,
		localCallbackUrl: `http://127.0.0.1:${address.port}/callback`,
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
function listenLoopback(server, port) {
	return new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(port, "127.0.0.1", () => {
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
function handleCallback(request, response, state, returnOrigin, done) {
	const url = new URL(request.url ?? "/", "http://127.0.0.1");
	if (request.method !== "GET" || url.pathname !== "/callback") {
		response.writeHead(404).end();
		return;
	}
	const receivedState = Buffer.from(url.searchParams.get("state") ?? "");
	const expectedState = Buffer.from(state);
	if (receivedState.length !== expectedState.length || !timingSafeEqual(receivedState, expectedState)) {
		response.writeHead(403).end("Invalid OAuth state");
		return;
	}
	const error = url.searchParams.get("error");
	const code = url.searchParams.get("code");
	if (error !== null || code === null || code.length === 0) {
		response.writeHead(400, { "content-type": "text/html; charset=utf-8" }).end(FAILURE_HTML);
		done({ error: /* @__PURE__ */ new Error("PandaData 登录未完成。") });
		return;
	}
	if (returnOrigin !== void 0) response.writeHead(303, {
		location: returnOrigin + "/",
		"cache-control": "no-store",
		"referrer-policy": "no-referrer"
	}).end();
	else response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(SUCCESS_HTML);
	done({ code });
}
//#endregion
//#region packages/panda-mcp/lib/types/oauth-provider.js
/** MCP SDK 所需的 OAuthClientProvider：token 只进 OAuthStore。 */
/**
* 文件持久化的 MCP OAuth 客户端。
*/
var PandaMcpOAuthProvider = class {
	store;
	redirect;
	openAuthorization;
	oauthState;
	constructor(store, redirect, openAuthorization, oauthState = randomUUID()) {
		this.store = store;
		this.redirect = redirect;
		this.openAuthorization = openAuthorization;
		this.oauthState = oauthState;
	}
	get redirectUrl() {
		return this.redirect;
	}
	get clientMetadata() {
		return {
			client_name: "QuantSkills",
			redirect_uris: [this.redirect],
			grant_types: ["authorization_code", "refresh_token"],
			response_types: ["code"],
			token_endpoint_auth_method: "none"
		};
	}
	clientInformation() {
		return this.store.current().client;
	}
	state() {
		return this.oauthState;
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
//#region packages/panda-mcp/lib/types/oauth-store.js
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
//#region packages/panda-mcp/lib/types/public-name.js
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
//#region packages/panda-mcp/lib/types/types.js
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
//#region packages/panda-mcp/lib/types/tools.js
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
//#region packages/panda-mcp/lib/types/index.js
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

For domestic futures contract specifications, dated exchange settlement fees, and publication evidence, use quantskills_futures_reference. Keep catalog specifications separate from verified historical rules. Missing historical fees must not be treated as zero. Report version timestamps and after-close research main contracts do not establish when a vendor mapping was first published.

Workflow: mcp__pandadata__auth_status → mcp__pandadata__search_methods → mcp__pandadata__get_method_doc → mcp__pandadata__call_pandadata.
Read the method document before calling. Only documented get_* methods are allowed.

If a tool is missing, returns reauth_required, or fails with HTTP 401, stop and ask the user to open QuantSkills Settings → PandaData and click Login. Never ask for a password. Never retry login in a loop. Never switch to AkShare, Yahoo, Tushare, or any other data vendor unless the user explicitly names that vendor for the current task only.`;
/** Loader schema。 */
const Config = z.object({
	url: z.string().default(DEFAULT_PANDA_MCP_URL),
	serverName: z.string().default("pandadata"),
	dshHome: z.string().default(""),
	toolCallTimeoutMs: z.number().default(6e4),
	authTimeoutMs: z.number().default(3e5),
	publicOrigin: z.string().default(""),
	callbackPort: z.number().default(3197)
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
		name: "quantskills",
		version: "0.1.31"
	});
}
/** 默认：MCP SDK Streamable HTTP + OAuth。 */
async function connectPublicPandaMcp(args) {
	const provider = new PandaMcpOAuthProvider(args.store, args.redirectUrl, args.openAuthorization, args.state);
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
	let _futuresReferenceCatalog_decorators;
	let _futuresReferenceQuery_decorators;
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
			_futuresReferenceCatalog_decorators = [Remote];
			_futuresReferenceQuery_decorators = [Remote];
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
			__esDecorate(this, null, _futuresReferenceCatalog_decorators, {
				kind: "method",
				name: "futuresReferenceCatalog",
				static: false,
				private: false,
				access: {
					has: (obj) => "futuresReferenceCatalog" in obj,
					get: (obj) => obj.futuresReferenceCatalog
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _futuresReferenceQuery_decorators, {
				kind: "method",
				name: "futuresReferenceQuery",
				static: false,
				private: false,
				access: {
					has: (obj) => "futuresReferenceQuery" in obj,
					get: (obj) => obj.futuresReferenceQuery
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
		futuresReference;
		store;
		promptDisposers = /* @__PURE__ */ new Map();
		tools = /* @__PURE__ */ new Map();
		phase = "disconnected";
		message = "尚未登录 PandaData。";
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
			super(ctx, "pandaMcp");
			this.url = validateHttpUrl(config.url ?? "https://pandadatamcp.pandaaiquant.com/mcp");
			const origin = config.publicOrigin?.trim() || process.env.QUANTSKILLS_PUBLIC_URL?.trim();
			if (origin) {
				const parsed = new URL(validateHttpUrl(origin));
				if (parsed.pathname !== "/" || parsed.search) throw new Error("PandaData publicOrigin 必须是 HTTPS 站点来源。");
				this.publicOrigin = parsed.origin;
			}
			this.callbackPort = config.callbackPort ?? 3197;
			if (!Number.isInteger(this.callbackPort) || this.callbackPort < 0 || this.callbackPort > 65535) throw new Error("PandaData callbackPort 无效。");
			this.serverName = config.serverName ?? "pandadata";
			if (!/^[A-Za-z0-9_-]{1,32}$/.test(this.serverName)) throw new Error("panda-mcp: serverName 必须匹配 [A-Za-z0-9_-]{1,32}");
			this.authTimeoutMs = config.authTimeoutMs ?? 3e5;
			this.toolCallTimeoutMs = config.toolCallTimeoutMs ?? 6e4;
			const specifiedHome = config.dshHome?.trim();
			this.store = new PandaMcpOAuthStore(pandaMcpOAuthPath(resolveDshHome(specifiedHome === void 0 || specifiedHome.length === 0 ? void 0 : specifiedHome)));
			const dataHome = join(resolveDshHome(specifiedHome || void 0), "quantskills");
			const panda = async (method, params, signal) => {
				if (!this.live) await this.refresh(signal);
				if (!this.live) return reauthRequired();
				return callConnectedTool(this.live, "call_pandadata", {
					method,
					params
				}, signal, async () => {
					this.phase = "needs_auth";
					await this.store.clear("tokens");
					this.replaceWithStubs();
				});
			};
			this.database = new LocalDatabase(join(dataHome, "database"), async (method, params, signal) => {
				const result = await panda(method, params, signal);
				if (result && typeof result === "object" && "error" in result && result.error === "reauth_required") throw new Error("请先在设置中连接 PandaData");
				return result;
			});
			this.futuresReference = new FuturesReference({
				archive: process.env.QUANTSTUDIO_FUTURES_REFERENCE_ARCHIVE?.trim() || join(dataHome, "futures-reference", "archive"),
				panda
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
		futuresReferenceCatalog(signal) {
			return Promise.resolve(futuresCatalog);
		}
		futuresReferenceQuery(input, signal) {
			return this.futuresReference.query(input, signal);
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
			register("quantskills_futures_reference", "Look up a domestic futures product or exact contract. Omit date for the catalog snapshot. With a trading date, return verified historical rules, daily quotes, exchange open/close/close-today fees and evidence when available. Rates are fractions of notional plus yuan per lot. Optional Beijing cutoff checks report version availability only. Missing data and unknown first publication are explicit.", {
				exchange: {
					type: "string",
					enum: futuresCatalog.exchanges.map((exchange) => exchange.id)
				},
				symbol: {
					type: "string",
					description: "Product or exchange contract, e.g. CU, CU2505, MA509, L2505F"
				},
				date: {
					type: "string",
					description: "Trading date in YYYY-MM-DD"
				},
				cutoff: {
					type: "string",
					description: "Beijing time in YYYY-MM-DDTHH:mm:ss"
				}
			}, ["exchange", "symbol"], (args, signal) => this.futuresReferenceQuery(args, signal));
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
			const completion = this.ensureAuthenticated(this.publicOrigin ? void 0 : signal);
			return this.publicOrigin && this.authorizationReady ? Promise.race([completion, this.authorizationReady.then(() => this.snapshot())]) : completion;
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
			this.authController?.abort();
			await this.authTail;
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
				message: this.message,
				...this.phase === "authenticating" && this.authorizationUrl ? { authorizationUrl: this.authorizationUrl } : {}
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
			this.authorizationUrl = void 0;
			this.authorizationReady = new Promise((resolve) => {
				this.resolveAuthorization = resolve;
			});
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
			this.authController = controller;
			const timeout = setTimeout(() => {
				controller.abort();
			}, this.authTimeoutMs);
			const onAbort = () => {
				controller.abort();
			};
			signal?.addEventListener("abort", onAbort, { once: true });
			let loopback;
			try {
				loopback = await startOauthLoopback(this.publicOrigin ? {
					publicOrigin: this.publicOrigin,
					port: this.callbackPort
				} : {});
				await this.store.clear("client");
				await this.connectLive({
					interactive: true,
					redirectUrl: loopback.redirectUrl,
					waitForCode: () => loopback.waitForCode(controller.signal),
					state: loopback.state,
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
				this.authorizationUrl = void 0;
				this.authController = void 0;
				await loopback?.close();
			}
		}
		async connectLive(options) {
			await this.dropLive();
			const interactive = options?.interactive === true;
			const redirectUrl = options?.redirectUrl ?? "http://127.0.0.1/callback";
			const waitForCode = options?.waitForCode ?? (async () => {
				throw new UnauthorizedError("PandaData 登录需要浏览器授权。");
			});
			const openAuthorization = interactive ? (url) => {
				if (!this.publicOrigin) return this.openAuthorization(url);
				this.authorizationUrl = url.href;
				this.message = "请在浏览器中完成 PandaData 授权。";
				this.resolveAuthorization?.();
			} : () => {
				throw new UnauthorizedError("PandaData 需要重新登录。");
			};
			const session = this.connector === void 0 ? await connectPublicPandaMcp({
				url: this.url,
				store: this.store,
				redirectUrl,
				openAuthorization,
				waitForCode,
				...options?.state === void 0 ? {} : { state: options.state },
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
