import { parse, parseDocument } from "yaml";
import { constants, createReadStream } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { chmod, cp, lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rename, rm, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { Service } from "@deepseek-ai/cordis";
import s from "@deepseek-ai/schemastery";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { z } from "zod";
import { Buffer as Buffer$1 } from "node:buffer";
import { isSkillName } from "@deepseek-ai/dsh-skill";
import { isIP } from "node:net";
//#region lib/types/error.js
/** Host-owned failure carrying a stable non-secret error code. */
var QuantSkillsHostError = class extends Error {
	/** Stable non-secret failure category. */
	code;
	/**
	* @param message - non-secret explanation suitable for a trusted Client.
	* @param code - stable failure category.
	* @param options - optional causal error retained only on the Host.
	*/
	constructor(message, code, options) {
		super(message, options);
		this.name = "QuantSkillsHostError";
		this.code = code;
	}
};
//#endregion
//#region lib/types/display-names.js
/** Stable localized display-name resolution for trusted QuantSkills catalog assets. */
const HAN_PATTERN = /[\u3400-\u9fff]/u;
const LEADING_SUMMARY_VERB = /^(?:使用|通过|基于|面向|提供|构建|执行|用于|从|按|用|在|以|将|把)\s*/u;
const CODE_TOKEN_PATTERN = /^(?:a|b|f|g|s|v)?\d+[a-z]?$/u;
const SUMMARY_NAME_MAX_GRAPHEMES = 22;
const CHINESE_GRAPHEMES = new Intl.Segmenter("zh-CN", { granularity: "grapheme" });
const EXACT_NAMES = Object.freeze({
	"skill-a-share-market-risk-radar": "A股市场风险雷达",
	"skill-a-share-pit-fundamental-vintage-builder": "A股时点基本面数据构建器",
	"skill-ag-futures-seasonality": "农产品期货季节性分析",
	"skill-alpha-f5-member-position-concentration": "会员持仓集中度分析",
	"skill-a1-lhb-tracking": "龙虎榜跟踪",
	"skill-jq-to-panda-converter": "聚宽转 PandaAI 策略转换器",
	"agent-market-regime-monitor": "市场状态监控智能体"
});
const PHRASES = Object.freeze({
	"a-share": "A股",
	"ag-futures": "农产品期货",
	"market-regime": "市场状态",
	"member-position": "会员持仓",
	"auto-stop-loss-take-profit": "自动止盈止损",
	"brinson-performance-attribution": "Brinson 绩效归因",
	"capital-flow": "资金流",
	"dalio-all-weather": "达利欧全天候",
	"gaetano-crux": "Gaetano / Crux",
	"gao-shanwen": "高善文",
	"northbound-margin": "北向与融资资金",
	"sec-edgar": "SEC EDGAR",
	"smart-money": "聪明钱",
	"tearsheet-report": "绩效报告",
	"risk-radar": "风险雷达",
	"to-panda": "转 PandaAI"
});
const TOKENS = Object.freeze({
	a: "A股",
	agent: "智能体",
	alpha: "因子",
	action: "行动",
	adjustment: "调整",
	ai: "AI",
	alert: "预警",
	all: "全部",
	alphas: "因子",
	alpha101: "Alpha101",
	alpha191: "Alpha191",
	altdata: "另类数据",
	anomaly: "异常",
	analysis: "分析",
	analyzer: "分析器",
	analyst: "分析师",
	api: "API",
	arbitrage: "套利",
	attribution: "归因",
	audit: "审计",
	auditor: "审计器",
	avoidance: "规避",
	backtest: "回测",
	backtesting: "回测",
	beta: "Beta",
	bias: "偏差",
	blend: "融合",
	break: "突变",
	block: "模块",
	brief: "简报",
	brinson: "Brinson",
	buffett: "巴菲特",
	builder: "构建器",
	build: "构建",
	buyback: "回购",
	calibration: "校准",
	calendar: "日历",
	capital: "资金",
	carry: "Carry",
	catcher: "捕捉器",
	cb: "可转债",
	change: "变化",
	check: "检查",
	checkup: "体检",
	commodity: "商品",
	concept: "概念",
	concentration: "集中度分析",
	consensus: "共识",
	contrarian: "逆向",
	converter: "转换器",
	corporate: "公司",
	correlation: "相关性",
	cost: "成本",
	cross: "跨市场",
	crossover: "交叉",
	crowding: "拥挤度",
	crux: "Crux",
	cta: "CTA",
	daily: "每日",
	data: "数据",
	decay: "衰减",
	debate: "辩论",
	debug: "调试",
	decision: "决策",
	deepview: "深度观察",
	derivatives: "衍生品",
	directional: "方向性",
	dossier: "档案",
	dividend: "股息",
	divergence: "背离",
	dl: "深度学习",
	doc: "文档",
	driven: "驱动",
	earnings: "盈利",
	edgar: "EDGAR",
	equity: "股票",
	ensemble: "集成",
	evaluate: "评估",
	evaluation: "评估",
	evaluator: "评估器",
	event: "事件",
	events: "事件",
	evidence: "证据",
	evolution: "演化",
	execution: "执行",
	experiment: "实验",
	exposure: "暴露",
	etf: "ETF",
	factormad: "FactorMAD",
	factor: "因子",
	factory: "工厂",
	family: "家族",
	fin: "金融",
	flow: "资金流",
	forecast: "预测",
	for: "",
	forward: "前向",
	fund: "基金",
	fundamental: "基本面",
	futures: "期货",
	fx: "外汇",
	gaetano: "Gaetano",
	generation: "生成",
	generator: "生成器",
	global: "全球",
	gnn: "图神经网络",
	graham: "格雷厄姆",
	graph: "图谱",
	grouped: "分组",
	guided: "引导",
	harvester: "采集器",
	hk: "港股",
	holder: "持有人",
	hotmoney: "游资",
	hpo: "超参数优化",
	ic: "IC",
	idea: "创意",
	index: "指数",
	insider: "内部人",
	institutional: "机构",
	intraday: "日内",
	investment: "投资",
	jq: "聚宽",
	keynes: "凯恩斯",
	klarman: "卡拉曼",
	lab: "实验室",
	leak: "泄漏",
	liangshuyuan: "量枢院",
	limitup: "涨停",
	liquidity: "流动性",
	listing: "上市",
	loss: "止损",
	lhb: "龙虎榜",
	ma: "均线",
	macro: "宏观",
	main: "主力",
	manager: "管理器",
	margin: "融资",
	market: "市场",
	mason: "Mason",
	memory: "记忆",
	mental: "心智",
	metrics: "指标",
	microstructure: "微观结构",
	mine: "挖掘",
	miner: "挖掘器",
	mining: "挖掘",
	ml: "机器学习",
	moat: "护城河",
	model: "模型",
	monitor: "监控",
	momentum: "动量",
	money: "资金",
	munger: "芒格",
	ncav: "净流动资产价值",
	news: "新闻",
	nowcast: "即时预测",
	numerical: "数值",
	oil: "原油",
	online: "在线",
	opinion: "观点",
	optimize: "优化",
	option: "期权",
	options: "期权",
	orthogonalize: "正交化",
	overseas: "海外",
	overfit: "过拟合",
	oversold: "超卖",
	panda: "PandaAI",
	pandaai: "PandaAI",
	pandadata: "PandaData",
	pair: "配对",
	pairs: "配对",
	paper: "论文",
	parity: "平价",
	pattern: "模式",
	pit: "时点",
	pnl: "盈亏",
	pool: "池",
	portfolio: "组合",
	position: "持仓",
	post: "盘后",
	profit: "止盈",
	profiler: "画像器",
	quality: "质量",
	quant: "量化",
	quantspace: "QuantSpace",
	qbti: "QBTI",
	quote: "报价",
	radar: "雷达",
	ranking: "排名",
	rates: "利率",
	rebalance: "再平衡",
	rebound: "反弹",
	refinancing: "再融资",
	regime: "状态",
	registry: "注册表",
	regulatory: "监管",
	replication: "复现",
	report: "报告",
	residual: "残差",
	return: "收益",
	reversal: "反转",
	reverse: "反向",
	review: "复盘",
	revision: "修正",
	roll: "滚动",
	rolling: "滚动",
	research: "研究",
	risk: "风险",
	rotation: "轮动",
	sage: "SAGE",
	scan: "扫描",
	scanner: "扫描器",
	screener: "筛选器",
	seasonality: "季节性分析",
	season: "财报季",
	series: "序列",
	sector: "行业",
	sec: "SEC",
	selection: "选择",
	serenity: "Serenity",
	sentiment: "情绪",
	share: "股",
	signal: "信号",
	simons: "西蒙斯",
	skill: "Skill",
	skew: "偏度",
	special: "特殊",
	ssquant: "SSQuant",
	stability: "稳定性",
	stat: "统计",
	statistical: "统计",
	stock: "股票",
	strategy: "策略",
	stress: "压力",
	structure: "结构",
	study: "研究",
	survivorship: "幸存者偏差",
	situations: "机会",
	take: "",
	tasks: "任务",
	tearsheet: "绩效报告",
	template: "模板",
	term: "期限",
	test: "测试",
	time: "时间",
	to: "转",
	tracker: "跟踪器",
	tracking: "跟踪",
	trade: "交易",
	trader: "交易研究",
	trading: "交易",
	transaction: "交易",
	trend: "趋势",
	universe: "股票池",
	us: "美股",
	usa: "美国",
	valuation: "估值",
	validator: "验证器",
	vintage: "历史版本",
	vol: "波动率",
	volume: "成交量",
	walk: "步进",
	warehouse: "数据仓库",
	weather: "天气",
	workflow: "工作流",
	wrapper: "封装器",
	x: "X平台",
	xingtai: "形态",
	yield: "收益率"
});
/**
* Resolve stable localized names during catalog intake.
* @param input - validated catalog identity and optional publication metadata.
* @returns localized names, searchable aliases, and their origin.
*/
function resolveQuantSkillsDisplayName(input) {
	const genericTitle = optionalText$1(input.title);
	const publishedZh = optionalText$1(input.titleZh) ?? (genericTitle !== void 0 && containsHan(genericTitle) ? genericTitle : void 0);
	const publishedEn = optionalText$1(input.titleEn) ?? (genericTitle !== void 0 && !containsHan(genericTitle) ? genericTitle : void 0);
	const generated = publishedZh ?? deriveChineseName(input.assetId, input.kind, input.summaryZh);
	const zhCN = generated ?? input.assetId;
	const en = publishedEn ?? deriveEnglishName(input.assetId);
	const aliases = uniqueText([...input.aliases ?? [], ...genericTitle === void 0 || genericTitle === zhCN || genericTitle === en ? [] : [genericTitle]]);
	const nameSource = publishedZh !== void 0 ? input.nameSource ?? "catalog" : generated !== void 0 ? "generated" : "asset-id";
	return Object.freeze({
		displayNames: Object.freeze({
			zhCN,
			...en === void 0 ? {} : { en }
		}),
		aliases: Object.freeze(aliases),
		nameSource
	});
}
/**
* Read the first Chinese Markdown H1 from an installed declaration.
* @param declaration - exact installed `SKILL.md` or `AGENTS.md` text.
* @returns normalized Chinese heading, or undefined when the H1 is absent or English-only.
*/
function extractChineseDeclarationTitle(declaration) {
	for (const line of declaration.split(/\r?\n/u)) {
		const match = /^#\s+(.+?)\s*$/u.exec(line);
		if (match === null) continue;
		const heading = match[1]?.replace(/\s*[（(][^()（）]*[）)]\s*$/u, "").trim();
		return heading !== void 0 && heading !== "" && containsHan(heading) ? heading : void 0;
	}
}
function deriveChineseName(assetId, kind, summaryZh) {
	const exact = EXACT_NAMES[assetId];
	if (exact !== void 0) return exact;
	const translated = translateAssetId(assetId, kind);
	if (translated !== void 0) return translated;
	const summary = optionalText$1(summaryZh);
	if (summary === void 0 || !containsHan(summary)) return void 0;
	const clause = summary.replace(/[`*_#]/gu, "").split(/[，。；;：:\n]/u, 1)[0]?.replace(LEADING_SUMMARY_VERB, "").trim();
	if (clause === void 0 || clause === "" || !containsHan(clause)) return void 0;
	const shortened = Array.from(CHINESE_GRAPHEMES.segment(clause), (entry) => entry.segment).slice(0, SUMMARY_NAME_MAX_GRAPHEMES).join("").trim();
	if (kind === "agent" && !/(?:智能体|助手|Agent)$/u.test(shortened)) return `${shortened}智能体`;
	return shortened;
}
function translateAssetId(assetId, kind) {
	const prefix = `${kind}-`;
	const parts = (assetId.startsWith(prefix) ? assetId.slice(prefix.length) : assetId).split("-");
	const translated = [];
	for (let index = 0; index < parts.length;) {
		const five = parts.slice(index, index + 5).join("-");
		const four = parts.slice(index, index + 4).join("-");
		const three = parts.slice(index, index + 3).join("-");
		const two = parts.slice(index, index + 2).join("-");
		const phrase = PHRASES[five] ?? PHRASES[four] ?? PHRASES[three] ?? PHRASES[two];
		if (phrase !== void 0) {
			translated.push(phrase);
			index += PHRASES[five] === phrase ? 5 : PHRASES[four] === phrase ? 4 : PHRASES[three] === phrase ? 3 : 2;
			continue;
		}
		const token = parts[index];
		if (token === void 0) break;
		if (CODE_TOKEN_PATTERN.test(token)) {
			index += 1;
			continue;
		}
		const value = TOKENS[token];
		if (value === void 0) return void 0;
		if (value === "") {
			index += 1;
			continue;
		}
		translated.push(value);
		index += 1;
	}
	if (translated.length === 0) return void 0;
	const title = translated.join("").replace(/智能体智能体$/u, "智能体");
	return kind === "agent" && !title.endsWith("智能体") ? `${title}智能体` : title;
}
function deriveEnglishName(assetId) {
	const source = assetId.replace(/^(?:skill|agent)-/u, "");
	if (source === "") return void 0;
	return source.split("-").map((token) => token === "a" ? "A" : token.toUpperCase() === token ? token : `${token.slice(0, 1).toUpperCase()}${token.slice(1)}`).join(" ");
}
function optionalText$1(value) {
	const normalized = value?.trim();
	return normalized === void 0 || normalized === "" ? void 0 : normalized;
}
function uniqueText(values) {
	const result = [];
	const seen = /* @__PURE__ */ new Set();
	for (const value of values) {
		const normalized = value.trim();
		if (normalized === "" || seen.has(normalized)) continue;
		seen.add(normalized);
		result.push(normalized);
	}
	return result;
}
function containsHan(value) {
	return HAN_PATTERN.test(value);
}
//#endregion
//#region lib/types/catalog.js
/** Trusted QuantSkills catalog download and validation. */
const SNAPSHOT_PATTERN = /^sha256:[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const ASSET_PATTERN$2 = /^(?:skill|agent)-[a-z0-9](?:[a-z0-9_-]{0,98}[a-z0-9])?$/;
const OFFICIAL_CATALOG_PATTERN = /^https:\/\/raw\.githubusercontent\.com\/quantskills\/quantskills\/(?:main|[a-f0-9]{40})\/site\/catalog\.json$/;
const taxonomyLabelSchema = z.object({
	label_en: z.string().min(1),
	label_zh: z.string().min(1)
});
const subcategorySchema = taxonomyLabelSchema.extend({ id: z.string().min(1) });
const categorySchema = taxonomyLabelSchema.extend({ subcategories: z.array(subcategorySchema) });
const envelopeSchema = z.object({
	snapshot_id: z.string(),
	taxonomy: z.object({ categories: z.record(z.string(), categorySchema) }),
	assets: z.array(z.unknown())
});
const statusSchema = z.looseObject({ catalog_status: z.string() });
const approvedAssetSchema = z.object({
	catalog_status: z.literal("approved"),
	name: z.string(),
	project_type: z.enum(["skill", "agent"]),
	url: z.string(),
	commit_sha: z.string(),
	declaration_file: z.string(),
	title: z.string().optional(),
	title_zh: z.string().optional(),
	title_en: z.string().optional(),
	aliases: z.array(z.string()).max(100).optional(),
	name_source: z.enum([
		"catalog",
		"declaration",
		"generated",
		"asset-id"
	]).optional(),
	category: z.string().optional(),
	subcategory: z.string().optional(),
	description: z.string().optional(),
	health: z.string().optional(),
	validation_level: z.string().optional(),
	requires: z.array(z.string()).optional(),
	summary_en: z.string().optional(),
	summary_zh: z.string().optional()
});
/**
* Assert that one configured catalog URL names the official publication.
* @param value - configured raw catalog URL.
*/
function validateCatalogUrl(value) {
	if (!OFFICIAL_CATALOG_PATTERN.test(value)) throw new QuantSkillsHostError("Catalog URL must name the official QuantSkills publication.", "CATALOG_INVALID");
}
/**
* Convert an approved repository URL into its canonical trusted form.
* @param value - catalog-provided repository URL.
* @param expectedName - catalog asset id that must equal the repository name.
* @returns the canonical HTTPS repository URL.
*/
function validateRepositoryUrl(value, expectedName) {
	let url;
	try {
		url = new URL(value);
	} catch (error) {
		throw new QuantSkillsHostError("Catalog repository URL is invalid.", "CATALOG_INVALID", { cause: error });
	}
	const match = /^\/quantskills\/([a-z0-9][a-z0-9_-]*)$/.exec(url.pathname);
	if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port !== "" || url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "" || match?.[1] !== expectedName) throw new QuantSkillsHostError("Catalog repository must be an exact quantskills GitHub HTTPS URL.", "CATALOG_INVALID");
	return `https://github.com/quantskills/${expectedName}`;
}
/**
* Parse and validate a trusted catalog response, returning approved assets only.
* @param value - decoded JSON value from the bounded official response.
* @param limits - configured catalog item bounds.
* @returns the immutable approved projection.
*/
function parseCatalogDocument(value, limits) {
	const envelope = envelopeSchema.safeParse(value);
	if (!envelope.success || !SNAPSHOT_PATTERN.test(envelope.data.snapshot_id)) throw new QuantSkillsHostError("QuantSkills catalog envelope is invalid.", "CATALOG_INVALID");
	if (envelope.data.assets.length > limits.maxAssets) throw new QuantSkillsHostError("QuantSkills catalog exceeds the configured asset limit.", "CATALOG_INVALID");
	const categories = parseCategories(envelope.data.taxonomy.categories);
	const categoryIndex = new Map(categories.map((category) => [category.id, category]));
	const assets = [];
	const seen = /* @__PURE__ */ new Set();
	for (const candidate of envelope.data.assets) {
		const status = statusSchema.safeParse(candidate);
		if (!status.success) continue;
		if (status.data.catalog_status !== "approved") continue;
		const parsed = approvedAssetSchema.safeParse(candidate);
		if (!parsed.success) continue;
		const item = parsed.data;
		const declaration = item.project_type === "skill" ? "SKILL.md" : "AGENTS.md";
		if (!ASSET_PATTERN$2.test(item.name) || !item.name.startsWith(`${item.project_type}-`) || !COMMIT_PATTERN.test(item.commit_sha) || item.declaration_file !== declaration) continue;
		const category = item.category === void 0 ? void 0 : categoryIndex.get(item.category);
		if (item.category !== void 0 && category === void 0 || item.subcategory !== void 0 && (category === void 0 || !category.subcategories.some((entry) => entry.id === item.subcategory))) continue;
		if (item.requires?.some((requirement) => !ASSET_PATTERN$2.test(requirement)) === true) continue;
		const requires = item.requires?.map((requirement) => requirement);
		const title = optionalText(item.title);
		const description = optionalText(item.description);
		const health = optionalText(item.health);
		const validationLevel = optionalText(item.validation_level);
		const summaryEn = optionalText(item.summary_en);
		const summaryZh = optionalText(item.summary_zh);
		const titleZh = optionalText(item.title_zh);
		const titleEn = optionalText(item.title_en);
		const display = resolveQuantSkillsDisplayName({
			assetId: item.name,
			kind: item.project_type,
			...title === void 0 ? {} : { title },
			...titleZh === void 0 ? {} : { titleZh },
			...titleEn === void 0 ? {} : { titleEn },
			...item.aliases === void 0 ? {} : { aliases: item.aliases },
			...summaryZh === void 0 ? {} : { summaryZh },
			...summaryEn === void 0 ? {} : { summaryEn },
			...item.name_source === void 0 ? {} : { nameSource: item.name_source }
		});
		if (seen.has(item.name)) continue;
		let repository;
		try {
			repository = validateRepositoryUrl(item.url, item.name);
		} catch (error) {
			if (error instanceof QuantSkillsHostError && error.code === "CATALOG_INVALID") continue;
			throw error;
		}
		seen.add(item.name);
		assets.push(Object.freeze({
			assetId: item.name,
			kind: item.project_type,
			repository,
			commit: item.commit_sha,
			declaration,
			...display,
			...title === void 0 ? {} : { title },
			...item.category === void 0 ? {} : { category: item.category },
			...item.subcategory === void 0 ? {} : { subcategory: item.subcategory },
			...description === void 0 ? {} : { description },
			...health === void 0 ? {} : { health },
			...validationLevel === void 0 ? {} : { validationLevel },
			...requires === void 0 ? {} : { requires: Object.freeze(requires) },
			...summaryEn === void 0 ? {} : { summaryEn },
			...summaryZh === void 0 ? {} : { summaryZh }
		}));
	}
	return Object.freeze({
		snapshotId: envelope.data.snapshot_id,
		categories,
		assets: Object.freeze(assets)
	});
}
function parseCategories(input) {
	const categories = Object.entries(input).map(([id, category]) => {
		if (id.length === 0) throw new QuantSkillsHostError("QuantSkills taxonomy category id is invalid.", "CATALOG_INVALID");
		const seen = /* @__PURE__ */ new Set();
		const subcategories = category.subcategories.map((subcategory) => {
			if (seen.has(subcategory.id)) throw new QuantSkillsHostError("QuantSkills taxonomy contains a duplicate subcategory.", "CATALOG_INVALID");
			seen.add(subcategory.id);
			return Object.freeze({
				id: subcategory.id,
				labelEn: subcategory.label_en,
				labelZh: subcategory.label_zh
			});
		}).sort((left, right) => left.id.localeCompare(right.id));
		return Object.freeze({
			id,
			labelEn: category.label_en,
			labelZh: category.label_zh,
			subcategories: Object.freeze(subcategories)
		});
	});
	categories.sort((left, right) => left.id.localeCompare(right.id));
	return Object.freeze(categories);
}
function optionalText(value) {
	return value === void 0 || value.trim() === "" ? void 0 : value;
}
/**
* Read a response body without allowing an omitted or false Content-Length to bypass the cap.
* @param response - successful official catalog response.
* @param maxBytes - maximum complete response bytes.
* @returns the decoded JSON value.
*/
async function readCatalogResponse(response, maxBytes) {
	const declared = response.headers.get("content-length");
	if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) throw new QuantSkillsHostError("QuantSkills catalog exceeds the configured byte limit.", "CATALOG_INVALID");
	if (response.body === null) throw new QuantSkillsHostError("QuantSkills catalog response has no body.", "CATALOG_FETCH_FAILED");
	const reader = response.body.getReader();
	const chunks = [];
	let bytes = 0;
	try {
		while (true) {
			const next = await reader.read();
			if (next.done) break;
			bytes += next.value.byteLength;
			if (bytes > maxBytes) {
				await reader.cancel();
				throw new QuantSkillsHostError("QuantSkills catalog exceeds the configured byte limit.", "CATALOG_INVALID");
			}
			chunks.push(next.value);
		}
	} finally {
		reader.releaseLock();
	}
	const body = new Uint8Array(bytes);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}
	try {
		return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
	} catch (error) {
		if (error instanceof QuantSkillsHostError) throw error;
		throw new QuantSkillsHostError("QuantSkills catalog is not valid UTF-8 JSON.", "CATALOG_INVALID", { cause: error });
	}
}
//#endregion
//#region lib/types/tree.js
/** Git tree validation for immutable QuantSkills installations. */
const TREE_LINE = /^([0-7]{6}) (blob|commit) ([a-f0-9]{40}) +(-|\d+)\t([\s\S]+)$/;
const WINDOWS_DEVICE = /^(?:con|prn|aux|nul|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])(?:\..*)?$/i;
const CONTROL = /[\u0000-\u001f\u007f]/;
function invalid$1(message) {
	throw new QuantSkillsHostError(message, "INSTALL_INVALID_TREE");
}
function limit(message) {
	throw new QuantSkillsHostError(message, "INSTALL_LIMIT_EXCEEDED");
}
function validateSegment(segment) {
	if (segment === "" || segment === "." || segment === ".." || segment.toLowerCase() === ".git" || segment.endsWith(".") || segment.endsWith(" ") || segment.includes(":") || WINDOWS_DEVICE.test(segment)) invalid$1("QuantSkills tree contains a path that is unsafe on supported hosts.");
}
/**
* Parse bounded `git ls-tree -rlz --full-tree` output and reject unsafe trees.
* @param output - complete, non-lossy NUL-delimited Git output.
* @param declaration - exact root declaration required by the catalog kind.
* @param limits - configured complete-tree bounds.
* @returns the validated entries and deterministic tree digest.
*/
function validateGitTree(output, declaration, limits) {
	const records = output.split("\0");
	if (records.at(-1) !== "") invalid$1("QuantSkills Git tree output is incomplete.");
	records.pop();
	const entries = [];
	const pathNodes = /* @__PURE__ */ new Map();
	let totalBytes = 0;
	for (const record of records) {
		const match = TREE_LINE.exec(record);
		if (match === null) invalid$1("QuantSkills Git tree contains an unsupported entry.");
		const [, mode, type, object, size, path] = match;
		if (mode === "120000" || mode === "160000" || type === "commit") invalid$1("QuantSkills Git tree may not contain symlinks or submodules.");
		if (mode !== "100644" && mode !== "100755" || type !== "blob" || size === "-" || object === void 0 || path === void 0) invalid$1("QuantSkills Git tree may contain regular files only.");
		if (path.startsWith("/") || path.includes("\\") || path.includes("�") || CONTROL.test(path) || path !== path.normalize("NFC")) invalid$1("QuantSkills Git tree contains an invalid path encoding.");
		const segments = path.split("/");
		if (segments.length > limits.maxDepth) limit("QuantSkills Git tree exceeds the configured path depth.");
		if (Buffer$1.byteLength(path, "utf8") > limits.maxPathBytes) limit("QuantSkills Git tree exceeds the configured path byte limit.");
		for (const segment of segments) validateSegment(segment);
		for (let index = 0; index < segments.length; index++) {
			const original = segments.slice(0, index + 1).join("/");
			const kind = index === segments.length - 1 ? "file" : "directory";
			const key = original.normalize("NFC").toLowerCase();
			const prior = pathNodes.get(key);
			if (prior !== void 0 && (prior.original !== original || prior.kind !== kind)) invalid$1("QuantSkills Git tree contains a case-folding or normalization collision.");
			pathNodes.set(key, {
				original,
				kind
			});
		}
		const bytes = Number(size);
		if (!Number.isSafeInteger(bytes) || bytes < 0) invalid$1("QuantSkills Git tree contains an invalid blob size.");
		if (bytes > limits.maxFileBytes) limit("QuantSkills Git tree contains a file above the configured byte limit.");
		totalBytes += bytes;
		if (!Number.isSafeInteger(totalBytes) || totalBytes > limits.maxTotalBytes) limit("QuantSkills Git tree exceeds the configured total byte limit.");
		entries.push({
			mode,
			object,
			bytes,
			path
		});
		if (entries.length > limits.maxFiles) limit("QuantSkills Git tree exceeds the configured file-count limit.");
	}
	if (!entries.some((entry) => entry.path === declaration)) invalid$1(`QuantSkills Git tree is missing root declaration ${declaration}.`);
	const hash = createHash("sha256");
	for (const entry of [...entries].sort((left, right) => Buffer$1.compare(Buffer$1.from(left.path), Buffer$1.from(right.path)))) hash.update(`${entry.mode}\0${entry.object}\0${entry.bytes}\0${entry.path}\0`);
	return Object.freeze({
		entries: Object.freeze(entries),
		fileCount: entries.length,
		totalBytes,
		treeDigest: `sha256:${hash.digest("hex")}`
	});
}
//#endregion
//#region lib/types/prompt-form.js
/** Parser for optional, non-executable QuantSkills `qsh-form` v1 metadata. */
const MAX_FORM_BYTES = 16 * 1024;
const MAX_FIELDS = 12;
const FIELD_KEY = /^[a-z0-9_]{1,32}$/;
const JSON_NUMBER_STRING = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const FORM_BLOCK = /^```json qsh-form[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/m;
const FORM_TAG = /{{\s*([#/^]?)\s*([a-zA-Z0-9_]+)\s*}}/g;
const FIELD_TYPES = /* @__PURE__ */ new Set([
	"text",
	"textarea",
	"select",
	"date",
	"number"
]);
const RESERVED_KEYS = /* @__PURE__ */ new Set(["task", "attachments"]);
/**
* Parse the first optional `qsh-form` block without changing the surrounding declaration.
* @param source - complete Skill or Agent instruction body.
* @returns a ready or invalid form result, or `undefined` when no form is declared.
*/
function parseQuantSkillsPromptForm(source) {
	const match = FORM_BLOCK.exec(source);
	if (match === null) return void 0;
	if (Buffer.byteLength(match[0], "utf8") > MAX_FORM_BYTES) return invalid("qsh-form exceeds the 16 KiB limit.");
	let input;
	try {
		input = JSON.parse(match[1] ?? "");
	} catch {
		return invalid("qsh-form must contain valid JSON.");
	}
	if (!isRecord$2(input)) return invalid("qsh-form root must be an object.");
	if (input.version !== 1) return invalid("qsh-form version must equal 1.");
	const adapted = adaptPromptFormV1(input);
	const task = parseTask(adapted.input.task);
	if (typeof task === "string") return invalid(task);
	const fields = parseFields(adapted.input.fields);
	if (typeof fields === "string") return invalid(fields);
	if (typeof adapted.input.prompt_template !== "string" || adapted.input.prompt_template.trim() === "") return invalid("qsh-form prompt_template must be a non-empty string.");
	const templateError = validateTemplate(adapted.input.prompt_template, fields);
	if (templateError !== void 0) return invalid(templateError);
	const form = Object.freeze({
		version: 1,
		...task === void 0 ? {} : { task },
		fields,
		promptTemplate: adapted.input.prompt_template
	});
	return Object.freeze({
		status: "ready",
		form,
		...adapted.adaptations.length === 0 ? {} : { adaptations: adapted.adaptations }
	});
}
function adaptPromptFormV1(input) {
	if (!Array.isArray(input.fields)) return {
		input,
		adaptations: Object.freeze([])
	};
	const adaptations = [];
	let changed = false;
	const fields = input.fields.map((field) => {
		if (!isRecord$2(field) || field.type !== "number" || typeof field.key !== "string" || !FIELD_KEY.test(field.key) || RESERVED_KEYS.has(field.key) || typeof field.default !== "string" || !JSON_NUMBER_STRING.test(field.default)) return field;
		const defaultValue = Number(field.default);
		if (!Number.isFinite(defaultValue)) return field;
		changed = true;
		adaptations.push(Object.freeze({
			code: "number-default-string",
			fieldKey: field.key
		}));
		return Object.freeze({
			...field,
			default: defaultValue
		});
	});
	return Object.freeze({
		input: changed ? Object.freeze({
			...input,
			fields: Object.freeze(fields)
		}) : input,
		adaptations: Object.freeze(adaptations)
	});
}
function parseTask(input) {
	if (input === void 0) return void 0;
	if (!isRecord$2(input)) return "qsh-form task must be an object.";
	if (input.placeholder !== void 0 && typeof input.placeholder !== "string") return "qsh-form task.placeholder must be a string.";
	if (input.required !== void 0 && typeof input.required !== "boolean") return "qsh-form task.required must be a boolean.";
	return Object.freeze({
		...input.placeholder === void 0 ? {} : { placeholder: input.placeholder },
		...input.required === void 0 ? {} : { required: input.required }
	});
}
function parseFields(input) {
	if (input === void 0) return Object.freeze([]);
	if (!Array.isArray(input)) return "qsh-form fields must be an array.";
	if (input.length > MAX_FIELDS) return `qsh-form fields may contain at most ${String(MAX_FIELDS)} entries.`;
	const keys = /* @__PURE__ */ new Set();
	const fields = [];
	for (let index = 0; index < input.length; index++) {
		const parsed = parseField(input[index], index, keys);
		if (typeof parsed === "string") return parsed;
		fields.push(parsed);
	}
	return Object.freeze(fields);
}
function parseField(input, index, keys) {
	const path = `qsh-form fields[${String(index)}]`;
	if (!isRecord$2(input)) return `${path} must be an object.`;
	if (typeof input.key !== "string" || !FIELD_KEY.test(input.key) || RESERVED_KEYS.has(input.key)) return `${path}.key must match ${String(FIELD_KEY)} and cannot be task or attachments.`;
	if (keys.has(input.key)) return `${path}.key duplicates ${JSON.stringify(input.key)}.`;
	keys.add(input.key);
	if (typeof input.type !== "string" || !FIELD_TYPES.has(input.type)) return `${path}.type must be text, textarea, select, date, or number.`;
	const type = input.type;
	const label = input.label === void 0 ? input.key : input.label;
	if (typeof label !== "string" || label.trim() === "") return `${path}.label must be a non-empty string.`;
	if (input.required !== void 0 && typeof input.required !== "boolean") return `${path}.required must be a boolean.`;
	if (input.placeholder !== void 0 && typeof input.placeholder !== "string") return `${path}.placeholder must be a string.`;
	if (input.help !== void 0 && typeof input.help !== "string") return `${path}.help must be a string.`;
	const defaultValue = input.default;
	if (defaultValue !== void 0 && (type === "number" ? typeof defaultValue !== "number" || !Number.isFinite(defaultValue) : typeof defaultValue !== "string")) return `${path}.default does not match field type ${type}.`;
	const options = parseOptions(type, input.options, path);
	if (typeof options === "string") return options;
	if (type === "select" && defaultValue !== void 0 && !options?.some((option) => option.value === defaultValue)) return `${path}.default must match one declared option.`;
	return Object.freeze({
		key: input.key,
		label,
		type,
		...input.required === void 0 ? {} : { required: input.required },
		...input.placeholder === void 0 ? {} : { placeholder: input.placeholder },
		...input.help === void 0 ? {} : { help: input.help },
		...defaultValue === void 0 ? {} : { default: defaultValue },
		...options === void 0 ? {} : { options }
	});
}
function parseOptions(type, input, path) {
	if (type !== "select") return input === void 0 ? void 0 : `${path}.options is only valid for select fields.`;
	if (!Array.isArray(input) || input.length === 0) return `${path}.options must be a non-empty array.`;
	const options = [];
	for (let index = 0; index < input.length; index++) {
		const option = input[index];
		if (!isRecord$2(option) || typeof option.value !== "string" || typeof option.label !== "string") return `${path}.options[${String(index)}] must contain string value and label fields.`;
		options.push(Object.freeze({
			value: option.value,
			label: option.label
		}));
	}
	return Object.freeze(options);
}
function validateTemplate(template, fields) {
	const allowed = /* @__PURE__ */ new Set([...RESERVED_KEYS, ...fields.map((field) => field.key)]);
	const stack = [];
	let last = 0;
	for (const tag of template.matchAll(FORM_TAG)) {
		const tagIndex = tag.index;
		const between = template.slice(last, tagIndex);
		const tagEnd = tagIndex + tag[0].length;
		if (between.includes("{{") || between.includes("}}") || template[tagIndex - 1] === "{" || template[tagEnd] === "}") return "qsh-form prompt_template contains an unsupported Mustache tag.";
		const marker = tag[1] ?? "";
		const name = tag[2] ?? "";
		if (!allowed.has(name)) return `qsh-form prompt_template references undeclared variable ${JSON.stringify(name)}.`;
		if (marker === "#" || marker === "^") stack.push(name);
		if (marker === "/" && stack.pop() !== name) return "qsh-form prompt_template contains unbalanced sections.";
		last = tagEnd;
	}
	if (template.slice(last).includes("{{") || template.includes("}}", last)) return "qsh-form prompt_template contains an unsupported Mustache tag.";
	if (stack.length > 0) return "qsh-form prompt_template contains unbalanced sections.";
}
function invalid(reason) {
	return Object.freeze({
		status: "invalid",
		reason
	});
}
function isRecord$2(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
//#endregion
//#region lib/types/skill-provider.js
/** `ctx.skills` provider for Host-committed QuantSkills versions. */
const PROVIDER_NAME = "quantskills-host";
const PROVIDER_RANK = 50;
/**
* Parse one standard DSH Skill declaration from an exact checked-out commit.
* @param raw - complete UTF-8 `SKILL.md` text.
* @returns validated discovery metadata and instruction body.
*/
function parseQuantSkillsSkill(raw) {
	const parsed = parseFrontmatter(raw);
	if (parsed === void 0) throw new Error("SKILL.md requires YAML frontmatter");
	const name = requiredString(parsed.data, "name");
	const description = requiredString(parsed.data, "description");
	if (!isSkillName(name)) throw new Error(`SKILL.md contains invalid skill name "${name}"`);
	const whenToUse = optionalString(parsed.data, "whenToUse");
	const metadata = optionalRecord(parsed.data, "metadata");
	const promptForm = parseQuantSkillsPromptForm(parsed.body);
	return Object.freeze({
		name,
		description,
		...whenToUse === void 0 ? {} : { whenToUse },
		invocation: parseInvocationPolicy(parsed.data),
		...metadata === void 0 ? {} : { metadata: Object.freeze(metadata) },
		content: parsed.body.trim(),
		...promptForm === void 0 ? {} : { promptForm }
	});
}
/**
* Check the catalog identity accepted for one standard Skill declaration.
* @param assetId - approved repository and installation identity.
* @param declarationName - name parsed from the root `SKILL.md`.
* @returns whether the declaration uses the asset id or its standard name without one `skill-` repository prefix.
*/
function matchesQuantSkillsSkillName(assetId, declarationName) {
	return declarationName === assetId || assetId.startsWith("skill-") && declarationName === assetId.slice(6);
}
/** Provider that exposes the latest committed version of every installed Skill. */
var QuantSkillsInstalledSkillProvider = class {
	locations;
	name = PROVIDER_NAME;
	/**
	* @param locations - reads the current Host-committed Skill locations.
	*/
	constructor(locations) {
		this.locations = locations;
	}
	/**
	* Project installed declarations into registry candidates.
	* @param options - caller cancellation for manifest and declaration reads.
	* @returns candidates backed by immutable Host version directories.
	*/
	async list(options) {
		const candidates = [];
		for (const location of await this.locations(options.signal)) {
			options.signal?.throwIfAborted();
			const parsed = await readParsedSkill(location, options.signal);
			assertAssetName(location, parsed);
			candidates.push(toCandidate(location, parsed));
		}
		return Object.freeze(candidates);
	}
	/**
	* Load the exact declaration selected during discovery.
	* @param candidate - provider-owned installed-version locator.
	* @param options - caller cancellation for the declaration read.
	* @returns the complete installed Skill definition.
	*/
	async get(candidate, options) {
		const location = candidate.locator;
		const parsed = await readParsedSkill(location, options.signal);
		assertAssetName(location, parsed);
		return Object.freeze({
			...projectSkill(location, parsed),
			content: parsed.content
		});
	}
};
function toCandidate(location, parsed) {
	return Object.freeze({
		...projectSkill(location, parsed),
		rank: PROVIDER_RANK,
		locator: Object.freeze({ ...location })
	});
}
function projectSkill(location, parsed) {
	return {
		name: parsed.name,
		description: parsed.description,
		...parsed.whenToUse === void 0 ? {} : { whenToUse: parsed.whenToUse },
		invocation: parsed.invocation,
		source: PROVIDER_NAME,
		provider: PROVIDER_NAME,
		resourceBase: {
			kind: "directory",
			path: location.resourceBase
		},
		path: location.declarationPath,
		...parsed.metadata === void 0 ? {} : { metadata: parsed.metadata }
	};
}
async function readParsedSkill(location, signal) {
	signal?.throwIfAborted();
	const raw = await readFile(location.declarationPath, {
		encoding: "utf8",
		signal
	});
	signal?.throwIfAborted();
	return parseQuantSkillsSkill(raw);
}
/**
* Load one exact Host-installed Skill location as a complete immutable definition.
* @param location - exact committed version location returned by the Host store.
* @param signal - optional caller cancellation for the declaration read.
* @returns the parsed Skill definition pinned to that location.
*/
async function loadQuantSkillsInstalledSkill(location, signal) {
	const parsed = await readParsedSkill(location, signal);
	assertAssetName(location, parsed);
	return Object.freeze({
		...projectSkill(location, parsed),
		content: parsed.content
	});
}
function assertAssetName(location, parsed) {
	if (!matchesQuantSkillsSkillName(location.assetId, parsed.name)) throw new Error(`installed Skill name "${parsed.name}" does not match asset "${location.assetId}"`);
}
function parseFrontmatter(raw) {
	const firstLineEnd = raw.indexOf("\n");
	if (firstLineEnd < 0 || raw.slice(0, firstLineEnd).replace(/\r$/, "") !== "---") return void 0;
	const start = firstLineEnd + 1;
	let lineStart = start;
	while (lineStart <= raw.length) {
		const nextNewline = raw.indexOf("\n", lineStart);
		const lineEnd = nextNewline < 0 ? raw.length : nextNewline;
		if (raw.slice(lineStart, lineEnd).replace(/\r$/, "") === "---") {
			const parsed = parse(raw.slice(start, lineStart));
			if (!isRecord$1(parsed)) return void 0;
			return {
				data: parsed,
				body: raw.slice(nextNewline < 0 ? raw.length : nextNewline + 1)
			};
		}
		if (nextNewline < 0) return void 0;
		lineStart = nextNewline + 1;
	}
}
function requiredString(data, key) {
	const value = data[key];
	if (typeof value !== "string" || value.trim() === "") throw new Error(`SKILL.md requires frontmatter field "${key}"`);
	return value;
}
function optionalString(data, key) {
	const value = data[key];
	return typeof value === "string" && value.length > 0 ? value : void 0;
}
function optionalRecord(data, key) {
	const value = data[key];
	return isRecord$1(value) ? value : void 0;
}
function parseInvocationPolicy(data) {
	for (const [legacy, canonical] of [
		["disableModelInvocation", "disable-model-invocation"],
		["modelInvocable", "disable-model-invocation"],
		["userInvocable", "user-invocable"]
	]) if (Object.hasOwn(data, legacy)) throw new Error(`frontmatter field "${legacy}" is unsupported; use "${canonical}"`);
	return {
		modelInvocable: frontmatterBoolean(data, "disable-model-invocation") !== true,
		userInvocable: frontmatterBoolean(data, "user-invocable") !== false
	};
}
function frontmatterBoolean(data, key) {
	if (!Object.hasOwn(data, key)) return void 0;
	const value = data[key];
	if (typeof value === "boolean") return value;
	const normalized = typeof value === "string" ? value.toLowerCase() : value;
	if (normalized === 1 || [
		"1",
		"true",
		"yes",
		"on"
	].includes(String(normalized))) return true;
	if (normalized === 0 || [
		"0",
		"false",
		"no",
		"off"
	].includes(String(normalized))) return false;
	throw new TypeError(`frontmatter field "${key}" must be a boolean`);
}
function isRecord$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
//#endregion
//#region lib/types/agent-template.js
/** Parser for standard QuantSkills `AGENTS.md` declarations. */
const ASSET_PATTERN$1 = /^agent-[a-z0-9](?:[a-z0-9_-]{0,98}[a-z0-9])?$/;
const SKILL_PATTERN = /^skill-[a-z0-9](?:[a-z0-9_-]{0,98}[a-z0-9])?$/;
const metadataSchema = z.object({ requires: z.array(z.string().regex(/^(?:skill-)?[a-z0-9](?:[a-z0-9_-]{0,98}[a-z0-9])?$/)).max(32).optional() }).loose();
const frontmatterSchema = z.object({
	name: z.string().regex(ASSET_PATTERN$1),
	description: z.string().min(1).max(4e3),
	metadata: metadataSchema.optional(),
	quantSkills: metadataSchema.optional()
}).loose();
/**
* Parse and validate one standard QuantSkills Agent declaration.
* @param raw - complete UTF-8 `AGENTS.md` text.
* @returns validated template metadata and instruction body.
*/
function parseQuantSkillsAgent(raw) {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]+)$/.exec(raw);
	if (match === null) throw new Error("AGENTS.md requires YAML frontmatter and an instruction body");
	const parsed = frontmatterSchema.parse(parse(projectFrontmatter(match[1] ?? "")));
	const instructions = (match[2] ?? "").trim();
	if (instructions === "") throw new Error("AGENTS.md instruction body is empty");
	const requires = (parsed.quantSkills?.requires ?? parsed.metadata?.requires ?? []).map((value) => value.startsWith("skill-") ? value : `skill-${value}`);
	if (requires.some((value) => !SKILL_PATTERN.test(value))) throw new Error("AGENTS.md contains an invalid Skill dependency");
	const promptForm = parseQuantSkillsPromptForm(instructions);
	return Object.freeze({
		name: parsed.name,
		description: parsed.description,
		instructions,
		requires: Object.freeze(requires.map((value) => value)),
		...promptForm === void 0 ? {} : { promptForm }
	});
}
function projectFrontmatter(input) {
	const lines = input.split(/\r?\n/);
	const projected = [];
	const emittedSections = /* @__PURE__ */ new Set();
	let section;
	let requirementIndent;
	let scalarBlock = false;
	for (const line of lines) {
		const topLevel = /^(name|description|metadata|quantSkills):(?:\s*(.*))?$/.exec(line);
		if (topLevel !== null) {
			requirementIndent = void 0;
			scalarBlock = false;
			const key = topLevel[1];
			if (key === "metadata" || key === "quantSkills") section = key;
			else {
				section = void 0;
				const value = topLevel[2]?.trim() ?? "";
				projected.push(`${key}: ${yamlScalar(value)}`);
				scalarBlock = key === "description" && /^[>|]/.test(value);
			}
			continue;
		}
		if (scalarBlock) {
			if (line.trim() === "" || /^\s+/.test(line)) {
				projected.push(line);
				continue;
			}
			scalarBlock = false;
		}
		if (section === void 0) continue;
		const requirement = /^(\s+)requires:\s*(.*)$/.exec(line);
		if (requirement !== null) {
			if (!emittedSections.has(section)) {
				projected.push(`${section}:`);
				emittedSections.add(section);
			}
			requirementIndent = requirement[1]?.length;
			projected.push(line);
			continue;
		}
		const indent = /^(\s+)/.exec(line)?.[1]?.length ?? 0;
		if (requirementIndent !== void 0 && indent > requirementIndent) projected.push(line);
	}
	return projected.join("\n");
}
function yamlScalar(value) {
	if (value.startsWith("\"") || value.startsWith("'") || /^[>|]/.test(value)) return value;
	return JSON.stringify(value);
}
//#endregion
//#region lib/types/readme.js
/** Bounded, fixed-commit QuantSkills repository README transport. */
/**
* Build the only upstream URL accepted for an approved asset README.
* @param assetId - catalog-approved repository identity.
* @param commit - catalog-approved exact commit.
* @returns exact official raw `README.md` URL.
*/
function quantSkillsReadmeUrl(assetId, commit) {
	return `https://raw.githubusercontent.com/quantskills/${assetId}/${commit}/README.md`;
}
/**
* Decode one README response without allowing omitted Content-Length to bypass the cap.
* @param response - successful exact raw README response.
* @param maxBytes - maximum complete Markdown bytes.
* @returns non-empty UTF-8 Markdown source.
*/
async function readQuantSkillsReadmeResponse(response, maxBytes) {
	const declared = response.headers.get("content-length");
	if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) throw new QuantSkillsHostError("QuantSkills README exceeds the configured byte limit.", "ASSET_README_INVALID");
	if (response.body === null) throw new QuantSkillsHostError("QuantSkills README response has no body.", "ASSET_README_FETCH_FAILED");
	const reader = response.body.getReader();
	const chunks = [];
	let bytes = 0;
	try {
		while (true) {
			const next = await reader.read();
			if (next.done) break;
			bytes += next.value.byteLength;
			if (bytes > maxBytes) {
				await reader.cancel();
				throw new QuantSkillsHostError("QuantSkills README exceeds the configured byte limit.", "ASSET_README_INVALID");
			}
			chunks.push(next.value);
		}
	} finally {
		reader.releaseLock();
	}
	const body = new Uint8Array(bytes);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}
	let markdown;
	try {
		markdown = new TextDecoder("utf-8", { fatal: true }).decode(body);
	} catch (error) {
		throw new QuantSkillsHostError("QuantSkills README is not valid UTF-8.", "ASSET_README_INVALID", { cause: error });
	}
	if (markdown.trim() === "") throw new QuantSkillsHostError("QuantSkills README is empty.", "ASSET_README_INVALID");
	return markdown;
}
/** User-selectable official mirrors for release discovery and candidate download. */
const OFFICIAL_APPLICATION_REPOSITORIES = Object.freeze({
	github: "https://github.com/quantskills/QuantStudio.git",
	gitee: "https://gitee.com/quantskills/QuantStudio.git"
});
/** Branch admitted by the application updater. */
const OFFICIAL_APPLICATION_BRANCH = "main";
/** Internal switch used by isolated candidate smoke tests. */
const DISABLE_APPLICATION_UPDATE_ENV = "QUANTSKILLS_DISABLE_APPLICATION_UPDATE";
const SHA_PATTERN$1 = /^[a-f0-9]{40}$/;
const STABLE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const STATE_SCHEMA_VERSION = 1;
const STATE_FILE = "state.json";
const storedStateSchema = z.object({
	schemaVersion: z.literal(STATE_SCHEMA_VERSION),
	active: z.string().regex(SHA_PATTERN$1).optional(),
	pending: z.string().regex(SHA_PATTERN$1).optional(),
	previous: z.string().regex(SHA_PATTERN$1).optional(),
	failedCandidates: z.array(z.object({
		commit: z.string().regex(SHA_PATTERN$1),
		failedAt: z.number().int().nonnegative(),
		errorCode: z.string()
	})).max(20).default([])
});
/**
* Prepare immutable official candidates without mutating the running checkout.
* The stable launcher is the only component that activates or rolls back a candidate.
*/
var QuantSkillsApplicationUpdater = class {
	root;
	versions;
	staging;
	statePath;
	repositoryRoot;
	commands;
	now;
	lifetime = new AbortController();
	state = emptyState();
	status = Object.freeze({ state: "idle" });
	task;
	/**
	* @param options - managed paths, current source path, and Host command adapter.
	*/
	constructor(options) {
		this.root = resolve(options.applicationRoot);
		this.versions = join(this.root, "versions");
		this.staging = join(this.root, "staging");
		this.statePath = join(this.root, STATE_FILE);
		this.repositoryRoot = resolve(options.repositoryRoot);
		this.commands = options.commands;
		this.now = options.now ?? Date.now;
	}
	/** Prepare private managed directories and recover readable durable state. */
	async initialize() {
		await mkdir(this.root, {
			recursive: true,
			mode: 448
		});
		await Promise.all([ensureRealDirectory(this.root, this.versions), ensureRealDirectory(this.root, this.staging)]);
		try {
			this.state = await readApplicationState(this.statePath);
		} catch (error) {
			this.state = emptyState();
			await writeApplicationState(this.statePath, this.state);
			this.status = Object.freeze({
				state: "failed",
				errorCode: "APPLICATION_UPDATE_STATE_CORRUPT"
			});
			return;
		}
		const currentVersion = await this.readCurrentVersion();
		const candidateVersion = this.state.pending === void 0 ? void 0 : await readPackageVersion(ownedCommitPath(this.versions, this.state.pending));
		this.status = this.state.pending === void 0 ? Object.freeze({
			state: "idle",
			...currentVersion === void 0 ? {} : { currentVersion },
			...this.state.active === void 0 ? {} : { currentCommit: this.state.active }
		}) : Object.freeze({
			state: "ready",
			...currentVersion === void 0 ? {} : { currentVersion },
			...this.state.active === void 0 ? {} : { currentCommit: this.state.active },
			...candidateVersion === void 0 ? {} : { candidateVersion },
			candidateCommit: this.state.pending
		});
	}
	/** @returns current in-memory state without filesystem or network I/O. */
	getStatus() {
		return {
			...this.status,
			...this.releaseNotes === void 0 ? {} : { releaseNotes: this.releaseNotes }
		};
	}
	releaseNotes;
	/**
	* Start a user-requested official version check without downloading a candidate.
	* @param source - official Git service selected by the user.
	* @returns immediate started-or-reused acknowledgement.
	*/
	check(source) {
		if (this.task !== void 0) return Object.freeze({
			accepted: "reused",
			status: this.status
		});
		this.releaseNotes = void 0;
		this.status = Object.freeze({
			state: "checking",
			source,
			...this.status.currentVersion === void 0 ? {} : { currentVersion: this.status.currentVersion },
			...this.state.active === void 0 ? {} : { currentCommit: this.state.active }
		});
		const task = this.checkForUpdate(source, this.lifetime.signal).catch((error) => this.recordFailure(error)).finally(() => {
			this.task = void 0;
		});
		this.task = task;
		return Object.freeze({
			accepted: "started",
			status: this.status
		});
	}
	/** Prepare the version found by the latest completed user check. */
	start() {
		if (this.task !== void 0) return Object.freeze({
			accepted: "reused",
			status: this.status
		});
		if (this.status.state !== "available" || this.status.candidateCommit === void 0 || this.status.candidateVersion === void 0 || this.status.source === void 0) throw new QuantSkillsHostError("Check for an official QuantSkills update before preparing it.", "APPLICATION_UPDATE_NOT_AVAILABLE");
		const candidateVersion = this.status.candidateVersion;
		const candidateCommit = this.status.candidateCommit;
		const source = this.status.source;
		const currentVersion = this.status.currentVersion;
		const currentCommit = this.status.currentCommit;
		const checkedAt = this.status.checkedAt ?? this.now();
		this.status = preparationStatus("fetching", source, currentVersion, currentCommit, candidateVersion, candidateCommit, checkedAt);
		const task = this.prepareCandidate(source, candidateVersion, candidateCommit, currentVersion, currentCommit, checkedAt, this.lifetime.signal).catch((error) => this.recordFailure(error)).finally(() => {
			this.task = void 0;
		});
		this.task = task;
		return Object.freeze({
			accepted: "started",
			status: this.status
		});
	}
	/** Abort preparation and wait for its command tree to settle. */
	async dispose() {
		this.lifetime.abort(/* @__PURE__ */ new Error("quantskills application updater is disposing"));
		await this.task?.catch(() => void 0);
	}
	async checkForUpdate(source, signal) {
		this.state = await readApplicationState(this.statePath);
		const inspection = await this.inspectSource(source, signal);
		const checkedAt = this.now();
		if (inspection.blocked !== void 0) {
			this.status = Object.freeze({
				state: "blocked",
				source,
				...inspection.currentVersion === void 0 ? {} : { currentVersion: inspection.currentVersion },
				...inspection.currentCommit === void 0 ? {} : { currentCommit: inspection.currentCommit },
				checkedAt,
				errorCode: inspection.blocked
			});
			return;
		}
		const release = await this.readLatestOfficialRelease(source, signal);
		const currentCommit = this.state.active ?? inspection.currentCommit;
		const currentVersion = await this.readCurrentVersion() ?? inspection.currentVersion;
		const pendingVersion = this.state.pending === void 0 ? void 0 : await readPackageVersion(ownedCommitPath(this.versions, this.state.pending));
		if (this.state.pending === release.commit && pendingVersion === release.version) {
			this.releaseNotes = await this.readReleaseNotes(source, release, signal);
			this.status = Object.freeze({
				state: "ready",
				source,
				...currentVersion === void 0 ? {} : { currentVersion },
				...currentCommit === void 0 ? {} : { currentCommit },
				candidateVersion: release.version,
				candidateCommit: release.commit,
				checkedAt
			});
			return;
		}
		if (currentVersion !== void 0 && compareVersions(currentVersion, release.version) >= 0) {
			this.status = Object.freeze({
				state: "current",
				source,
				currentVersion,
				...currentCommit === void 0 ? {} : { currentCommit },
				checkedAt
			});
			return;
		}
		this.releaseNotes = await this.readReleaseNotes(source, release, signal);
		this.status = Object.freeze({
			state: "available",
			source,
			...currentVersion === void 0 ? {} : { currentVersion },
			...currentCommit === void 0 ? {} : { currentCommit },
			candidateVersion: release.version,
			candidateCommit: release.commit,
			checkedAt
		});
	}
	async inspectSource(source, signal) {
		let repositoryRoot;
		try {
			repositoryRoot = (await this.commands.runGit(["rev-parse", "--show-toplevel"], this.repositoryRoot, signal)).trim();
			repositoryRoot = await realpath(repositoryRoot);
		} catch (_notGitOrBrokenGitMetadata) {
			signal.throwIfAborted();
			const currentVersion = await readPackageVersion(this.repositoryRoot);
			return { ...currentVersion === void 0 ? {} : { currentVersion } };
		}
		const currentVersion = await readPackageVersion(repositoryRoot);
		const sourceVersion = currentVersion === void 0 ? {} : { currentVersion };
		let origin;
		try {
			origin = (await this.commands.runGit([
				"config",
				"--get",
				"remote.origin.url"
			], repositoryRoot, signal)).trim();
		} catch (_missingOrigin) {
			signal.throwIfAborted();
			return {
				...sourceVersion,
				blocked: "APPLICATION_UPDATE_DEVELOPMENT_REMOTE"
			};
		}
		if (!isOfficialApplicationRepository(origin)) return {
			...sourceVersion,
			blocked: "APPLICATION_UPDATE_DEVELOPMENT_REMOTE"
		};
		const currentCommit = (await this.commands.runGit(["rev-parse", "HEAD^{commit}"], repositoryRoot, signal)).trim();
		if (!SHA_PATTERN$1.test(currentCommit)) throw new QuantSkillsHostError("The current application commit is invalid.", "APPLICATION_UPDATE_CHECK_FAILED");
		const managedSource = isOwnedPath(repositoryRoot, this.versions);
		const branch = (await this.commands.runGit(["branch", "--show-current"], repositoryRoot, signal)).trim();
		if (!managedSource && !["main", "v2"].includes(branch) || managedSource && branch !== "" && !["main", "v2"].includes(branch)) return {
			...sourceVersion,
			currentCommit,
			blocked: "APPLICATION_UPDATE_DEVELOPMENT_BRANCH"
		};
		if ((await this.commands.runGit([
			"status",
			"--porcelain=v1",
			"--untracked-files=normal"
		], repositoryRoot, signal)).trim() !== "") return {
			...sourceVersion,
			currentCommit,
			blocked: "APPLICATION_UPDATE_DEVELOPMENT_DIRTY"
		};
		if (managedSource) return {
			...sourceVersion,
			currentCommit
		};
		await this.commands.runGit([
			"fetch",
			"--quiet",
			"--no-tags",
			OFFICIAL_APPLICATION_REPOSITORIES[source],
			OFFICIAL_APPLICATION_BRANCH
		], repositoryRoot, signal);
		const latestCommit = (await this.commands.runGit(["rev-parse", "FETCH_HEAD^{commit}"], repositoryRoot, signal)).trim();
		if (!SHA_PATTERN$1.test(latestCommit)) throw new QuantSkillsHostError("The official application commit is invalid.", "APPLICATION_UPDATE_CHECK_FAILED");
		const comparison = (await this.commands.runGit([
			"rev-list",
			"--left-right",
			"--count",
			"HEAD...FETCH_HEAD"
		], repositoryRoot, signal)).trim().match(/^(\d+)\s+(\d+)$/u);
		if (comparison === null) throw new QuantSkillsHostError("The application history comparison was invalid.", "APPLICATION_UPDATE_CHECK_FAILED");
		const ahead = Number(comparison[1]);
		const behind = Number(comparison[2]);
		if (ahead > 0 && behind > 0) return {
			...sourceVersion,
			currentCommit,
			blocked: "APPLICATION_UPDATE_DEVELOPMENT_DIVERGED"
		};
		if (ahead > 0) return {
			...sourceVersion,
			currentCommit,
			blocked: "APPLICATION_UPDATE_DEVELOPMENT_AHEAD"
		};
		return {
			...sourceVersion,
			currentCommit
		};
	}
	async readLatestOfficialRelease(source, signal) {
		const release = (await this.readOfficialReleases(source, signal)).toSorted((left, right) => compareVersions(right.version, left.version))[0];
		if (release === void 0) throw new QuantSkillsHostError("No official stable application release was found.", "APPLICATION_UPDATE_CHECK_FAILED");
		return release;
	}
	async readReleaseNotes(source, release, signal) {
		const metadata = join(this.root, "release-metadata.git");
		await mkdir(metadata, { recursive: true });
		await this.commands.runGit([
			"init",
			"--bare",
			"--quiet"
		], metadata, signal);
		await this.commands.runGit([
			"fetch",
			"--quiet",
			"--depth=1",
			"--no-tags",
			OFFICIAL_APPLICATION_REPOSITORIES[source],
			`refs/tags/v${release.version}`
		], metadata, signal);
		if ((await this.commands.runGit(["rev-parse", "FETCH_HEAD^{commit}"], metadata, signal)).trim() !== release.commit) throw new QuantSkillsHostError("The release changed during discovery.", "APPLICATION_UPDATE_CHECK_FAILED");
		try {
			const text = await this.commands.runGit(["show", `${release.commit}:RELEASE.json`], metadata, signal);
			return z.object({
				version: z.literal(release.version),
				changes: z.array(z.string().min(1).max(300)).min(1).max(20)
			}).parse(JSON.parse(text)).changes;
		} catch (error) {
			signal.throwIfAborted();
			return [];
		}
	}
	async readOfficialReleases(source, signal) {
		return parseOfficialReleases(await this.commands.runGit([
			"ls-remote",
			"--tags",
			OFFICIAL_APPLICATION_REPOSITORIES[source],
			"refs/tags/v*"
		], this.root, signal));
	}
	async readCurrentVersion() {
		if (this.state.active === void 0) return await readPackageVersion(this.repositoryRoot);
		return await readPackageVersion(ownedCommitPath(this.versions, this.state.active));
	}
	async prepareCandidate(source, candidateVersion, commit, currentVersion, currentCommit, checkedAt, signal) {
		const staging = ownedCommitPath(this.staging, `${commit}.partial`);
		const version = ownedCommitPath(this.versions, commit);
		const release = (await this.readOfficialReleases(source, signal)).find((candidate) => candidate.version === candidateVersion);
		if (release === void 0) throw new QuantSkillsHostError("The selected official release is no longer published.", "APPLICATION_UPDATE_CHECK_FAILED");
		if (release.version !== candidateVersion || release.commit !== commit) throw new QuantSkillsHostError("The selected official release changed after the update check.", "APPLICATION_UPDATE_CHECK_FAILED");
		this.status = preparationStatus("fetching", source, currentVersion, currentCommit, candidateVersion, commit, checkedAt);
		if (await isDirectory(version)) await this.validateCandidate(version, candidateVersion, commit, signal);
		else {
			await rm(staging, {
				recursive: true,
				force: true
			});
			try {
				await this.commands.runGit([
					"clone",
					"-c",
					"core.longpaths=true",
					"-c",
					"core.autocrlf=false",
					"--quiet",
					"--no-tags",
					"--single-branch",
					"--branch",
					OFFICIAL_APPLICATION_BRANCH,
					"--no-checkout",
					OFFICIAL_APPLICATION_REPOSITORIES[source],
					staging
				], this.root, signal);
				await this.commands.runGit([
					"checkout",
					"--quiet",
					"--detach",
					commit
				], staging, signal);
			} catch (error) {
				signal.throwIfAborted();
				throw new QuantSkillsHostError("Unable to download the official QuantSkills application candidate.", "APPLICATION_UPDATE_DOWNLOAD_FAILED", { cause: error });
			}
			await this.validateCandidate(staging, candidateVersion, commit, signal);
			this.status = preparationStatus("installing", source, currentVersion, currentCommit, candidateVersion, commit, checkedAt);
			try {
				await this.commands.runPnpm(["install", "--frozen-lockfile"], staging, signal, { [DISABLE_APPLICATION_UPDATE_ENV]: "1" });
			} catch (error) {
				signal.throwIfAborted();
				throw new QuantSkillsHostError("Unable to install the locked candidate dependencies.", "APPLICATION_UPDATE_INSTALL_FAILED", { cause: error });
			}
			this.status = preparationStatus("verifying", source, currentVersion, currentCommit, candidateVersion, commit, checkedAt);
			try {
				await this.commands.runPnpm(["run", "check"], staging, signal, { [DISABLE_APPLICATION_UPDATE_ENV]: "1" });
				await this.commands.runPnpm(["run", "ci:smoke"], staging, signal, { [DISABLE_APPLICATION_UPDATE_ENV]: "1" });
			} catch (error) {
				signal.throwIfAborted();
				throw new QuantSkillsHostError("The official QuantSkills application candidate failed verification.", "APPLICATION_UPDATE_VERIFY_FAILED", { cause: error });
			}
			await rename(staging, version);
		}
		this.state = Object.freeze({
			...this.state,
			pending: commit,
			failedCandidates: this.state.failedCandidates.filter((candidate) => candidate.commit !== commit)
		});
		await writeApplicationState(this.statePath, this.state);
		this.status = Object.freeze({
			state: "ready",
			source,
			...currentVersion === void 0 ? {} : { currentVersion },
			...currentCommit === void 0 ? {} : { currentCommit },
			candidateVersion,
			candidateCommit: commit,
			checkedAt
		});
	}
	async validateCandidate(candidate, candidateVersion, commit, signal) {
		const canonical = await realpath(candidate);
		const [canonicalVersions, canonicalStaging] = await Promise.all([realpath(this.versions), realpath(this.staging)]);
		if (!isOwnedPath(canonical, canonicalVersions) && !isOwnedPath(canonical, canonicalStaging)) throw new QuantSkillsHostError("The application candidate escaped managed storage.", "APPLICATION_UPDATE_PATH_INVALID");
		const actualCommit = (await this.commands.runGit(["rev-parse", "HEAD^{commit}"], canonical, signal)).trim();
		const origin = (await this.commands.runGit([
			"config",
			"--get",
			"remote.origin.url"
		], canonical, signal)).trim();
		if (actualCommit !== commit || !isOfficialApplicationRepository(origin)) throw new QuantSkillsHostError("The application candidate identity is invalid.", "APPLICATION_UPDATE_VERIFY_FAILED");
		const manifest = JSON.parse(await readFile(join(canonical, "package.json"), "utf8"));
		if (!isRecord(manifest) || manifest.name !== "@quantskills/dsh-plugin" || manifest.version !== candidateVersion || !isRecord(manifest.repository) || typeof manifest.repository.url !== "string" || normalizeRepository(manifest.repository.url) !== normalizeRepository("https://github.com/quantskills/QuantStudio.git")) throw new QuantSkillsHostError("The application package identity is invalid.", "APPLICATION_UPDATE_VERIFY_FAILED");
		const lock = await lstat(join(canonical, "pnpm-lock.yaml"));
		if (!lock.isFile() || lock.isSymbolicLink()) throw new QuantSkillsHostError("The application candidate has no regular lock file.", "APPLICATION_UPDATE_VERIFY_FAILED");
	}
	async recordFailure(error) {
		if (this.lifetime.signal.aborted) return;
		const errorCode = error instanceof QuantSkillsHostError ? error.code : "APPLICATION_UPDATE_CHECK_FAILED";
		const previousStatus = this.status;
		const candidateCommit = previousStatus.candidateCommit;
		const candidateVersion = previousStatus.candidateVersion;
		const failureStatus = Object.freeze({
			state: "failed",
			...previousStatus.source === void 0 ? {} : { source: previousStatus.source },
			...previousStatus.currentVersion === void 0 ? {} : { currentVersion: previousStatus.currentVersion },
			...previousStatus.currentCommit === void 0 ? {} : { currentCommit: previousStatus.currentCommit },
			...candidateVersion === void 0 ? {} : { candidateVersion },
			...candidateCommit === void 0 ? {} : { candidateCommit },
			checkedAt: this.now(),
			errorCode
		});
		if (candidateCommit !== void 0) {
			this.state = Object.freeze({
				...this.state,
				failedCandidates: Object.freeze([...this.state.failedCandidates.filter((candidate) => candidate.commit !== candidateCommit).slice(-18), {
					commit: candidateCommit,
					failedAt: this.now(),
					errorCode
				}])
			});
			await writeApplicationState(this.statePath, this.state).catch(() => void 0);
		}
		this.status = failureStatus;
	}
};
function emptyState() {
	return Object.freeze({
		schemaVersion: 1,
		failedCandidates: Object.freeze([])
	});
}
async function readApplicationState(path) {
	try {
		const parsed = storedStateSchema.parse(JSON.parse(await readFile(path, "utf8")));
		return Object.freeze({
			schemaVersion: 1,
			...parsed.active === void 0 ? {} : { active: parsed.active },
			...parsed.pending === void 0 ? {} : { pending: parsed.pending },
			...parsed.previous === void 0 ? {} : { previous: parsed.previous },
			failedCandidates: Object.freeze(parsed.failedCandidates.map((candidate) => Object.freeze(candidate)))
		});
	} catch (error) {
		if (isMissing$1(error)) return emptyState();
		throw error;
	}
}
async function writeApplicationState(path, state) {
	const temp = join(dirname(path), `.state-${randomUUID()}.tmp`);
	await writeFile(temp, `${JSON.stringify(state, null, 2)}\n`, {
		encoding: "utf8",
		mode: 384,
		flag: "wx"
	});
	await rename(temp, path);
}
async function ensureRealDirectory(parent, child) {
	await mkdir(child, {
		recursive: true,
		mode: 448
	});
	const canonicalParent = await realpath(parent);
	const canonicalChild = await realpath(child);
	const info = await lstat(canonicalChild);
	if (!info.isDirectory() || info.isSymbolicLink() || !isOwnedPath(canonicalChild, canonicalParent)) throw new QuantSkillsHostError("The application directory escaped managed storage.", "APPLICATION_UPDATE_PATH_INVALID");
}
function ownedCommitPath(parent, name) {
	const path = resolve(parent, name);
	if (!isOwnedPath(path, parent)) throw new QuantSkillsHostError("The application version path escaped managed storage.", "APPLICATION_UPDATE_PATH_INVALID");
	return path;
}
function isOwnedPath(path, parent) {
	const child = relative(resolve(parent), resolve(path));
	return child !== "" && !child.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && child !== ".." && !isAbsolute(child);
}
async function isDirectory(path) {
	try {
		const info = await lstat(path);
		return info.isDirectory() && !info.isSymbolicLink();
	} catch (error) {
		if (isMissing$1(error)) return false;
		throw error;
	}
}
function normalizeRepository(value) {
	return value.trim().replace(/^git\+/u, "").replace(/\/$/u, "").replace(/\.git$/u, "");
}
function isOfficialApplicationRepository(value) {
	const normalized = normalizeRepository(value);
	return [
		...Object.values(OFFICIAL_APPLICATION_REPOSITORIES),
		"https://github.com/songshuquant/QuantStudio.git",
		"https://github.com/quantskills/quantskills-dsh-plugin.git",
		"https://github.com/songshuquant/quantskills-dsh-plugin.git",
		"https://gitee.com/quantskills/quantskills-dsh-plugin.git"
	].some((repository) => normalizeRepository(repository) === normalized);
}
async function readPackageVersion(root) {
	try {
		const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
		if (!isRecord(manifest) || typeof manifest.version !== "string") return void 0;
		return parseVersion(manifest.version) === void 0 ? void 0 : manifest.version;
	} catch (error) {
		if (isMissing$1(error) || error instanceof SyntaxError) return void 0;
		throw error;
	}
}
function parseOfficialReleases(output) {
	const tags = /* @__PURE__ */ new Map();
	for (const line of output.split(/\r?\n/u)) {
		const [commit, reference] = line.trim().split(/\s+/u);
		if (commit === void 0 || reference === void 0 || !SHA_PATTERN$1.test(commit)) continue;
		const match = reference.match(/^refs\/tags\/v([^\^]+)(\^\{\})?$/u);
		const version = match?.[1];
		if (version === void 0 || !STABLE_VERSION_PATTERN.test(version)) continue;
		const existing = tags.get(version) ?? {};
		tags.set(version, match?.[2] === void 0 ? {
			...existing,
			direct: commit
		} : {
			...existing,
			peeled: commit
		});
	}
	return Object.freeze([...tags].flatMap(([version, commits]) => {
		const commit = commits.peeled ?? commits.direct;
		return commit === void 0 ? [] : [Object.freeze({
			version,
			commit
		})];
	}));
}
function parseVersion(value) {
	const match = value.match(VERSION_PATTERN);
	if (match === null) return void 0;
	const [major, minor, patch] = match.slice(1, 4).map((component) => Number(component));
	if (major === void 0 || minor === void 0 || patch === void 0 || ![
		major,
		minor,
		patch
	].every(Number.isSafeInteger)) return void 0;
	return {
		major,
		minor,
		patch,
		prerelease: match[4]?.split(".") ?? []
	};
}
function compareVersions(leftValue, rightValue) {
	const left = parseVersion(leftValue);
	const right = parseVersion(rightValue);
	if (left === void 0 || right === void 0) throw new QuantSkillsHostError("The application version is invalid.", "APPLICATION_UPDATE_CHECK_FAILED");
	for (const key of [
		"major",
		"minor",
		"patch"
	]) if (left[key] !== right[key]) return left[key] - right[key];
	if (left.prerelease.length === 0 || right.prerelease.length === 0) return left.prerelease.length === right.prerelease.length ? 0 : left.prerelease.length === 0 ? 1 : -1;
	for (let index = 0; index < Math.max(left.prerelease.length, right.prerelease.length); index += 1) {
		const leftPart = left.prerelease[index];
		const rightPart = right.prerelease[index];
		if (leftPart === void 0 || rightPart === void 0) return leftPart === rightPart ? 0 : leftPart === void 0 ? -1 : 1;
		if (leftPart === rightPart) continue;
		const leftNumeric = /^\d+$/u.test(leftPart);
		const rightNumeric = /^\d+$/u.test(rightPart);
		if (leftNumeric && rightNumeric) return Number(leftPart) - Number(rightPart);
		if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
		return leftPart.localeCompare(rightPart);
	}
	return 0;
}
function preparationStatus(phase, source, currentVersion, currentCommit, candidateVersion, candidateCommit, checkedAt) {
	return Object.freeze({
		state: "preparing",
		phase,
		source,
		...currentVersion === void 0 ? {} : { currentVersion },
		...currentCommit === void 0 ? {} : { currentCommit },
		candidateVersion,
		candidateCommit,
		checkedAt
	});
}
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isMissing$1(error) {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
}
//#endregion
//#region lib/types/local-browser-access.js
function header(request, name) {
	if (request.headers instanceof Headers) return request.headers.get(name) ?? void 0;
	const value = request.headers[name];
	return typeof value === "string" ? value : void 0;
}
function loopback(address) {
	if (!address) return false;
	if (address === "::1") return true;
	const ipv4 = address.startsWith("::ffff:") ? address.slice(7) : address;
	return isIP(ipv4) === 4 && ipv4.startsWith("127.");
}
function localAuthority(value) {
	if (!value || !/^(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::[1-9]\d{0,4})?$/i.test(value)) return;
	try {
		const url = new URL(`http://${value}`);
		if (url.hostname === "localhost" || url.hostname === "[::1]" || loopback(url.hostname)) return url;
	} catch {}
}
/** Require the actual transport to be local; forwarded headers cannot grant access. */
function isDirectLocalBrowserRequest(request) {
	const authority = localAuthority(header(request, "host"));
	if (!authority || !loopback(request.socket?.remoteAddress) || !loopback(request.socket?.localAddress)) return false;
	if (request.socket?.localPort !== Number(authority.port || 80)) return false;
	for (const name of [
		"forwarded",
		"x-forwarded-for",
		"x-forwarded-host",
		"x-forwarded-proto"
	]) if (request.headers instanceof Headers ? request.headers.has(name) : request.headers[name] !== void 0) return false;
	return true;
}
/** Adapt only this Connection instance, retaining DSH's Host/Origin fence and remote authentication. */
function installLocalBrowserAccess(connection) {
	const prior = {
		requestRejection: Object.getOwnPropertyDescriptor(connection, "requestRejection"),
		authorizeIndex: Object.getOwnPropertyDescriptor(connection, "authorizeIndex"),
		authenticatedUrl: Object.getOwnPropertyDescriptor(connection, "authenticatedUrl")
	};
	const originalRejection = connection.requestRejection;
	const originalIndex = connection.authorizeIndex;
	const originalUrl = connection.authenticatedUrl;
	const replacements = {
		requestRejection(request) {
			const rejection = originalRejection.call(connection, request);
			return rejection === 401 && isDirectLocalBrowserRequest(request) ? void 0 : rejection;
		},
		authorizeIndex(request, response) {
			if (isDirectLocalBrowserRequest(request)) {
				if (originalRejection.call(connection, request) === 403) {
					response.writeHead(403, {
						"cache-control": "no-store",
						"content-type": "text/plain; charset=utf-8"
					});
					response.end(request.method === "HEAD" ? void 0 : "forbidden");
					return false;
				}
				const url = new URL(request.url ?? "/", "http://localhost");
				if (url.searchParams.has("token")) {
					url.searchParams.delete("token");
					response.writeHead(303, {
						location: `${url.pathname}${url.search}`,
						"cache-control": "no-store",
						"referrer-policy": "no-referrer"
					});
					response.end();
					return false;
				}
				return true;
			}
			return originalIndex.call(connection, request, response);
		},
		authenticatedUrl(baseUrl) {
			const url = new URL(baseUrl);
			if (url.protocol === "http:" && !url.username && !url.password && localAuthority(url.host)) {
				url.pathname = "/";
				url.search = "";
				url.hash = "";
				return url.href;
			}
			return originalUrl.call(connection, baseUrl);
		}
	};
	for (const key of Object.keys(replacements)) Object.defineProperty(connection, key, {
		configurable: true,
		writable: true,
		value: replacements[key]
	});
	return () => {
		for (const key of Object.keys(replacements)) {
			if (Object.getOwnPropertyDescriptor(connection, key)?.value !== replacements[key]) continue;
			const descriptor = prior[key];
			if (descriptor) Object.defineProperty(connection, key, descriptor);
			else Reflect.deleteProperty(connection, key);
		}
	};
}
//#endregion
//#region lib/types/index.js
/** Trusted QuantSkills catalog gateway and immutable fixed-commit Host installer. */
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
const DEFAULT_CATALOG_URL = "https://raw.githubusercontent.com/quantskills/quantskills/main/site/catalog.json";
const QUANTSKILLS_GITEE_ORGANIZATION = "https://gitee.com/quantskills";
const SHA_PATTERN = /^[a-f0-9]{40}$/;
const ASSET_PATTERN = /^(?:skill|agent)-[a-z0-9](?:[a-z0-9_-]{0,98}[a-z0-9])?$/;
function signalAborted(signal) {
	return signal.aborted;
}
const ETAG_PATTERN = /^(?:W\/)?\x22[\x21\x23-\x7e]{0,200}\x22$/;
const MANIFEST_NAME = "manifest.json";
const MANIFEST_SCHEMA_VERSION = 1;
const MAX_CATALOG_EVENT_BUFFER_BYTES = 64 * 1024;
const manifestSchema = z.object({
	schemaVersion: z.literal(MANIFEST_SCHEMA_VERSION),
	versionId: z.string(),
	assetId: z.string(),
	kind: z.enum(["skill", "agent"]),
	repository: z.string(),
	commit: z.string(),
	declaration: z.enum(["SKILL.md", "AGENTS.md"]),
	treeDigest: z.string(),
	fileCount: z.number().int().nonnegative(),
	totalBytes: z.number().int().nonnegative(),
	installedAt: z.number().int().nonnegative(),
	exposure: z.enum(["skill-registry", "agent-template"]),
	origin: z.enum(["catalog", "local-authoring"]).default("catalog")
});
function validateCatalogEventsUrl(value) {
	let parsed;
	try {
		parsed = new URL(value);
	} catch (error) {
		throw new TypeError("QuantSkills catalog event URL must be an absolute HTTPS URL.", { cause: error });
	}
	const localDevelopment = parsed.protocol === "http:" && (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost" || parsed.hostname === "::1");
	if (parsed.protocol !== "https:" && !localDevelopment || parsed.username !== "" || parsed.password !== "" || parsed.hash !== "") throw new TypeError("QuantSkills catalog event URL must be HTTPS without credentials or a fragment.");
	return parsed.href;
}
function catalogEtag(response) {
	const etag = response.headers.get("etag");
	return etag !== null && ETAG_PATTERN.test(etag) ? etag : void 0;
}
function installedVersionId(assetId, commit) {
	return `${assetId}@${commit}`;
}
function isExists(error) {
	return error instanceof Error && "code" in error && (error.code === "EEXIST" || error.code === "ENOTEMPTY");
}
function isMissing(error) {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
}
async function ensurePrivateChild(parent, name) {
	const parentReal = await realpath(parent);
	const target = join(parentReal, name);
	try {
		await mkdir(target, { mode: 448 });
	} catch (error) {
		if (!isExists(error)) throw error;
	}
	const info = await lstat(target);
	if (!info.isDirectory() || info.isSymbolicLink()) throw new QuantSkillsHostError("QuantSkills managed directory is not a real directory.", "INSTALL_WRITE_FAILED");
	await chmod(target, 448);
	const canonical = await realpath(target);
	if (dirname(canonical) !== parentReal) throw new QuantSkillsHostError("QuantSkills managed directory escaped its parent.", "INSTALL_WRITE_FAILED");
	return canonical;
}
async function prepareRoots(configuredHome) {
	const selected = resolveDshHome(configuredHome);
	await mkdir(selected, {
		recursive: true,
		mode: 448
	});
	const home = await realpath(selected);
	const root = await ensurePrivateChild(home, "quantskills");
	return {
		home,
		root,
		versions: await ensurePrivateChild(root, "versions"),
		authored: await ensurePrivateChild(root, "authored"),
		staging: await ensurePrivateChild(root, "staging")
	};
}
async function removeOwnedPath(path, parent) {
	const target = resolve(path);
	const owner = resolve(parent);
	const rel = relative(owner, target);
	if (rel === "" || rel.startsWith("..") || resolve(owner, rel) !== target) throw new QuantSkillsHostError("Refused to remove a path outside the owned staging directory.", "INSTALL_WRITE_FAILED");
	let info;
	try {
		info = await lstat(target);
	} catch (error) {
		if (isMissing(error)) return;
		throw error;
	}
	if (info.isSymbolicLink()) await unlink(target);
	else if (info.isDirectory()) await rm(target, { recursive: true });
	else await unlink(target);
}
async function writeManifest(path, manifest) {
	const handle = await open(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 384);
	try {
		await handle.writeFile(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
		await handle.sync();
	} finally {
		await handle.close();
	}
}
function parseManifest(value) {
	const parsed = manifestSchema.safeParse(value);
	if (!parsed.success || !ASSET_PATTERN.test(parsed.data.assetId) || !SHA_PATTERN.test(parsed.data.commit) || parsed.data.versionId !== `${parsed.data.assetId}@${parsed.data.commit}` || parsed.data.repository !== (parsed.data.origin === "catalog" ? `https://github.com/quantskills/${parsed.data.assetId}` : `local-authoring:${parsed.data.assetId}`) || parsed.data.declaration !== (parsed.data.kind === "skill" ? "SKILL.md" : "AGENTS.md") || parsed.data.exposure !== (parsed.data.kind === "skill" ? "skill-registry" : "agent-template") || !/^sha256:[a-f0-9]{64}$/.test(parsed.data.treeDigest)) throw new QuantSkillsHostError("QuantSkills installation manifest is corrupt.", "INSTALL_RECORD_CORRUPT");
	return Object.freeze({
		...parsed.data,
		versionId: parsed.data.versionId,
		assetId: parsed.data.assetId,
		commit: parsed.data.commit,
		treeDigest: parsed.data.treeDigest
	});
}
async function readManifest(versionRoot) {
	const path = join(versionRoot, MANIFEST_NAME);
	const metadata = await lstat(path);
	if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 64 * 1024) throw new QuantSkillsHostError("QuantSkills installation manifest is corrupt.", "INSTALL_RECORD_CORRUPT");
	let value;
	try {
		value = JSON.parse(await readFile(path, "utf8"));
	} catch (error) {
		throw new QuantSkillsHostError("QuantSkills installation manifest is corrupt.", "INSTALL_RECORD_CORRUPT", { cause: error });
	}
	return parseManifest(value);
}
function publicManifest(manifest) {
	const { schemaVersion: _schemaVersion, ...version } = manifest;
	return Object.freeze(version);
}
/** Remote Host service that owns catalog freshness checks and installed-version truth. */
let QuantSkillsHostGateway = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _catalog_decorators;
	let _catalogSyncStatus_decorators;
	let _list_decorators;
	let _uninstallAsset_decorators;
	let _applicationUpdateStatus_decorators;
	let _applicationUpdateCheck_decorators;
	let _applicationUpdateStart_decorators;
	let _assetReadme_decorators;
	let _install_decorators;
	let _agentTemplate_decorators;
	let _manualSkillRead_decorators;
	let _manualSkillSave_decorators;
	return class QuantSkillsHostGateway extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_catalog_decorators = [Remote("catalog")];
			_catalogSyncStatus_decorators = [Remote("catalogSyncStatus")];
			_list_decorators = [Remote("list")];
			_uninstallAsset_decorators = [Remote("uninstallAsset")];
			_applicationUpdateStatus_decorators = [Remote("applicationUpdateStatus")];
			_applicationUpdateCheck_decorators = [Remote("applicationUpdateCheck")];
			_applicationUpdateStart_decorators = [Remote("applicationUpdateStart")];
			_assetReadme_decorators = [Remote("assetReadme")];
			_install_decorators = [Remote("installAsset")];
			_agentTemplate_decorators = [Remote("agentTemplate")];
			_manualSkillRead_decorators = [Remote("manualSkillRead")];
			_manualSkillSave_decorators = [Remote("manualSkillSave")];
			__esDecorate(this, null, _catalog_decorators, {
				kind: "method",
				name: "catalog",
				static: false,
				private: false,
				access: {
					has: (obj) => "catalog" in obj,
					get: (obj) => obj.catalog
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _catalogSyncStatus_decorators, {
				kind: "method",
				name: "catalogSyncStatus",
				static: false,
				private: false,
				access: {
					has: (obj) => "catalogSyncStatus" in obj,
					get: (obj) => obj.catalogSyncStatus
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _list_decorators, {
				kind: "method",
				name: "list",
				static: false,
				private: false,
				access: {
					has: (obj) => "list" in obj,
					get: (obj) => obj.list
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _uninstallAsset_decorators, {
				kind: "method",
				name: "uninstallAsset",
				static: false,
				private: false,
				access: {
					has: (obj) => "uninstallAsset" in obj,
					get: (obj) => obj.uninstallAsset
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _applicationUpdateStatus_decorators, {
				kind: "method",
				name: "applicationUpdateStatus",
				static: false,
				private: false,
				access: {
					has: (obj) => "applicationUpdateStatus" in obj,
					get: (obj) => obj.applicationUpdateStatus
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _applicationUpdateCheck_decorators, {
				kind: "method",
				name: "applicationUpdateCheck",
				static: false,
				private: false,
				access: {
					has: (obj) => "applicationUpdateCheck" in obj,
					get: (obj) => obj.applicationUpdateCheck
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _applicationUpdateStart_decorators, {
				kind: "method",
				name: "applicationUpdateStart",
				static: false,
				private: false,
				access: {
					has: (obj) => "applicationUpdateStart" in obj,
					get: (obj) => obj.applicationUpdateStart
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _assetReadme_decorators, {
				kind: "method",
				name: "assetReadme",
				static: false,
				private: false,
				access: {
					has: (obj) => "assetReadme" in obj,
					get: (obj) => obj.assetReadme
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _install_decorators, {
				kind: "method",
				name: "install",
				static: false,
				private: false,
				access: {
					has: (obj) => "install" in obj,
					get: (obj) => obj.install
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _agentTemplate_decorators, {
				kind: "method",
				name: "agentTemplate",
				static: false,
				private: false,
				access: {
					has: (obj) => "agentTemplate" in obj,
					get: (obj) => obj.agentTemplate
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _manualSkillRead_decorators, {
				kind: "method",
				name: "manualSkillRead",
				static: false,
				private: false,
				access: {
					has: (obj) => "manualSkillRead" in obj,
					get: (obj) => obj.manualSkillRead
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _manualSkillSave_decorators, {
				kind: "method",
				name: "manualSkillSave",
				static: false,
				private: false,
				access: {
					has: (obj) => "manualSkillSave" in obj,
					get: (obj) => obj.manualSkillSave
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
		static inject = ["subprocess", "skills"];
		static Config = s.object({
			localBrowserAccess: s.boolean().default(true),
			dshHome: s.string(),
			catalogUrl: s.string().default(DEFAULT_CATALOG_URL),
			catalogTimeoutMs: s.number().step(1).min(1).default(15e3),
			catalogRefreshMs: s.number().step(1).min(1).default(3e5),
			catalogEventsUrl: s.string(),
			catalogEventsReconnectMs: s.number().step(1).min(1).default(5e3),
			maxCatalogBytes: s.number().step(1).min(1).default(8 * 1024 * 1024),
			maxCatalogAssets: s.number().step(1).min(1).default(1e4),
			readmeTimeoutMs: s.number().step(1).min(1).default(15e3),
			maxReadmeBytes: s.number().step(1).min(1).default(1024 * 1024),
			gitCommand: s.string().default("git"),
			pnpmCommand: s.string().default("pnpm"),
			repositoryRoot: s.string().default(process.cwd()),
			githubFetchTimeoutMs: s.number().step(1).min(1).default(1e4),
			gitGraceMs: s.number().step(1).min(1).default(5e3),
			maxGitOutputBytes: s.number().step(1).min(1).default(16 * 1024 * 1024),
			maxFiles: s.number().step(1).min(1).default(1e4),
			maxTotalBytes: s.number().step(1).min(1).default(512 * 1024 * 1024),
			maxFileBytes: s.number().step(1).min(1).default(128 * 1024 * 1024),
			maxDepth: s.number().step(1).min(1).default(32),
			maxPathBytes: s.number().step(1).min(1).default(1024)
		});
		resolved = __runInitializers(this, _instanceExtraInitializers);
		configuredHome;
		roots;
		gitPath;
		pnpmPath;
		applicationUpdater;
		accepting = true;
		lifetime = new AbortController();
		operations = /* @__PURE__ */ new Set();
		skillProviderControl;
		catalogCache;
		catalogRequestRevision = 0;
		syncStatus;
		/**
		* @param ctx - Host context carrying the managed subprocess runtime.
		* @param config - catalog, Git, and complete-tree bounds.
		*/
		constructor(ctx, config) {
			super(ctx, "quantSkillsHost", { namespace: "quantSkills" });
			if (config.localBrowserAccess !== false) ctx.inject(["connection"], (connectionCtx) => {
				connectionCtx.effect(() => installLocalBrowserAccess(connectionCtx.get("connection")), "quantskills: direct local browser access");
			});
			const catalogUrl = config.catalogUrl ?? DEFAULT_CATALOG_URL;
			validateCatalogUrl(catalogUrl);
			const catalogEventsUrl = config.catalogEventsUrl === void 0 ? void 0 : validateCatalogEventsUrl(config.catalogEventsUrl);
			this.configuredHome = config.dshHome;
			this.resolved = Object.freeze({
				catalogUrl,
				catalogTimeoutMs: config.catalogTimeoutMs ?? 15e3,
				catalogRefreshMs: config.catalogRefreshMs ?? 3e5,
				...catalogEventsUrl === void 0 ? {} : { catalogEventsUrl },
				catalogEventsReconnectMs: config.catalogEventsReconnectMs ?? 5e3,
				maxCatalogBytes: config.maxCatalogBytes ?? 8 * 1024 * 1024,
				maxCatalogAssets: config.maxCatalogAssets ?? 1e4,
				readmeTimeoutMs: config.readmeTimeoutMs ?? 15e3,
				maxReadmeBytes: config.maxReadmeBytes ?? 1024 * 1024,
				gitCommand: config.gitCommand ?? "git",
				pnpmCommand: config.pnpmCommand ?? "pnpm",
				repositoryRoot: resolve(config.repositoryRoot ?? process.cwd()),
				githubFetchTimeoutMs: config.githubFetchTimeoutMs ?? 1e4,
				gitGraceMs: config.gitGraceMs ?? 5e3,
				maxGitOutputBytes: config.maxGitOutputBytes ?? 16 * 1024 * 1024,
				tree: Object.freeze({
					maxFiles: config.maxFiles ?? 1e4,
					maxTotalBytes: config.maxTotalBytes ?? 512 * 1024 * 1024,
					maxFileBytes: config.maxFileBytes ?? 128 * 1024 * 1024,
					maxDepth: config.maxDepth ?? 32,
					maxPathBytes: config.maxPathBytes ?? 1024
				})
			});
			this.syncStatus = Object.freeze(catalogEventsUrl === void 0 ? {
				mode: "manual",
				state: "idle"
			} : {
				mode: "event-stream",
				state: "connecting"
			});
		}
		/** Prepare managed roots and resolve Git before the service becomes injectable. */
		async *[Service.init]() {
			this.roots = await prepareRoots(this.configuredHome);
			this.gitPath = await this.ctx.subprocess.resolveExecutable(this.resolved.gitCommand);
			this.pnpmPath = await this.ctx.subprocess.resolveExecutable(this.resolved.pnpmCommand);
			this.applicationUpdater = new QuantSkillsApplicationUpdater({
				applicationRoot: join(this.roots.root, "application"),
				repositoryRoot: this.resolved.repositoryRoot,
				commands: {
					runGit: (args, cwd, signal) => this.runGit(args, cwd, signal),
					runPnpm: (args, cwd, signal, environment) => this.runPnpm(args, cwd, signal, environment)
				}
			});
			await this.applicationUpdater.initialize();
			const disposeSkillProvider = this.ctx.skills.registerProvider((control) => {
				this.skillProviderControl = control;
				return new QuantSkillsInstalledSkillProvider((signal) => this.listInstalledSkillLocations(signal));
			});
			if (this.resolved.catalogEventsUrl !== void 0) {
				const stream = this.runCatalogEventLoop(this.lifetime.signal);
				this.operations.add(stream);
				stream.finally(() => {
					this.operations.delete(stream);
				});
			}
			yield async () => {
				this.accepting = false;
				this.lifetime.abort(/* @__PURE__ */ new Error("quantskills-host: service is disposing"));
				disposeSkillProvider();
				this.skillProviderControl = void 0;
				this.catalogCache = void 0;
				await this.applicationUpdater?.dispose();
				this.applicationUpdater = void 0;
				await Promise.allSettled(this.operations);
			};
		}
		/**
		* Read the approved official catalog without making a validated process cache wait on GitHub.
		* @param signal - optional caller cancellation for the initial or background fetch.
		* @returns a bounded, validated point-in-time snapshot.
		*/
		catalog(signal) {
			const cached = this.catalogCache;
			if (cached === void 0) return this.runOperation((active) => this.fetchCatalog(active), signal);
			this.runOperation((active) => this.fetchCatalog(active), signal).catch(() => {
				if (!signal?.aborted && !this.lifetime.signal.aborted) this.ctx.logger.warn("QuantSkills catalog revalidation failed; serving the last validated process snapshot.");
			});
			return Promise.resolve(this.withSyncStatus(cached.snapshot));
		}
		/**
		* Read the current event-driven catalog delivery state.
		* @returns Host-owned connection state for the configured relay.
		*/
		catalogSyncStatus() {
			return this.syncStatus;
		}
		/**
		* List versions with a complete Host publication record.
		* @param signal - optional caller cancellation.
		* @returns immutable installed versions sorted by asset and commit.
		*/
		list(signal) {
			return this.runOperation((active) => this.listCommitted(active), signal);
		}
		/** Remove a catalog asset from discovery while retaining immutable versions for existing sessions. */
		uninstallAsset(request, signal) {
			return this.runOperation(async (active) => {
				if (!ASSET_PATTERN.test(request.assetId)) throw new Error("无效的能力标识。");
				if (!(await this.readCommittedManifests(active)).some((item) => item.assetId === request.assetId && item.origin === "catalog")) throw new Error("未找到已安装的公共能力，请刷新列表后重试。");
				const root = await ensurePrivateChild(this.requireRoots().versions, request.assetId);
				active.throwIfAborted();
				try {
					const file = await open(join(root, ".uninstalled"), "wx", 384);
					try {
						await file.writeFile("Uninstalled; retained for existing session bindings.\n");
						await file.sync();
					} finally {
						await file.close();
					}
				} catch (error) {
					if (!isExists(error)) throw error;
				}
				this.skillProviderControl?.invalidate();
			}, signal);
		}
		/** @returns the current background application-update state without network I/O. */
		applicationUpdateStatus() {
			return this.requireApplicationUpdater().getStatus();
		}
		/**
		* Start a user-requested official version check without downloading an update.
		* @param request - explicit Git service selected by the user.
		* @returns immediate started-or-reused acknowledgement.
		*/
		applicationUpdateCheck(request) {
			return this.requireApplicationUpdater().check(request.source);
		}
		/**
		* Prepare the version selected by the user's latest completed check.
		* @returns immediate started-or-reused acknowledgement.
		*/
		applicationUpdateStart() {
			return this.requireApplicationUpdater().start();
		}
		/**
		* Read the repository's real README at the exact commit shown by the Client.
		* @param request - catalog-bound asset identity and exact observed commit.
		* @param signal - optional caller cancellation propagated to both catalog and README fetches.
		* @returns bounded UTF-8 Markdown from the approved repository version.
		*/
		assetReadme(request, signal) {
			return this.runOperation((active) => this.readAssetReadme(request, active), signal);
		}
		/**
		* Re-fetch the catalog, enforce the Client's observed snapshot and commit,
		* and atomically publish one validated immutable version.
		* @param request - catalog-bound asset identity and exact observed commit.
		* @param signal - optional caller cancellation propagated to fetch and Git.
		* @returns the Host-committed installation record.
		*/
		install(request, signal) {
			return this.runOperation((active) => this.installResolved(request, active), signal);
		}
		/**
		* Resolve one exact installed Skill for a session-scoped provider.
		* @param versionId - Host-issued immutable installed-version identity.
		* @param signal - optional caller cancellation.
		* @returns the validated manifest and complete exact-version definition.
		* @throws when the version is absent, stored-only, or corrupt.
		*/
		resolveInstalledSkill(versionId, signal) {
			return this.runOperation(async (active) => {
				const manifest = (await this.readCommittedManifests(active)).find((candidate) => candidate.versionId === versionId);
				if (manifest === void 0) throw new QuantSkillsHostError("Installed QuantSkills version was not found.", "INSTALLED_VERSION_NOT_FOUND");
				if (manifest.exposure !== "skill-registry" || manifest.kind !== "skill") throw new QuantSkillsHostError("Installed QuantSkills version is not a registry-visible Skill.", "INSTALLED_VERSION_NOT_SKILL");
				const resourceBase = this.versionSource(manifest);
				const definition = await loadQuantSkillsInstalledSkill(Object.freeze({
					assetId: manifest.assetId,
					versionId: manifest.versionId,
					declarationPath: join(resourceBase, manifest.declaration),
					resourceBase
				}), active);
				const promptForm = parseQuantSkillsPromptForm(definition.content);
				return Object.freeze({
					version: publicManifest(manifest),
					definition,
					...promptForm === void 0 ? {} : { promptForm }
				});
			}, signal);
		}
		/**
		* Resolve the immutable source directory for one exact installed version.
		* This same-process Host method lets trusted consumers authorize legacy files without
		* projecting the Host filesystem path through the remote Agent-template response.
		* @param versionId - Host-issued immutable installed-version identity.
		* @param signal - optional caller cancellation.
		* @returns the validated public manifest and its immutable source directory.
		*/
		resolveInstalledResource(versionId, signal) {
			return this.runOperation(async (active) => {
				const manifest = (await this.readCommittedManifests(active)).find((candidate) => candidate.versionId === versionId);
				if (manifest === void 0) throw new QuantSkillsHostError("Installed QuantSkills version was not found.", "INSTALLED_VERSION_NOT_FOUND");
				return Object.freeze({
					version: publicManifest(manifest),
					resourceBase: this.versionSource(manifest)
				});
			}, signal);
		}
		/**
		* Match one model-visible resource directory to an exact installed registry Skill.
		* This same-process lookup lets trusted Session consumers validate durable `skill`
		* tool results without exposing the installed-version root through RPC.
		* @param resourceBase - directory rendered by the successful Skill tool result.
		* @param signal - optional caller cancellation.
		* @returns the exact Skill manifest and source directory, or undefined when no installation matches.
		*/
		matchInstalledSkillResource(resourceBase, signal) {
			return this.runOperation(async (active) => {
				const manifest = (await this.readCommittedManifests(active)).find((candidate) => candidate.kind === "skill" && candidate.exposure === "skill-registry" && this.versionSource(candidate) === resourceBase);
				if (manifest === void 0) return void 0;
				return Object.freeze({
					version: publicManifest(manifest),
					resourceBase
				});
			}, signal);
		}
		/**
		* Resolve one exact installed Agent as an editable user-Agent template.
		* @param versionId - Host-issued immutable installed-version identity.
		* @param signal - optional caller cancellation.
		* @returns validated Agent metadata, instructions, and exact dependency identities.
		*/
		agentTemplate(versionId, signal) {
			return this.runOperation(async (active) => {
				const manifest = (await this.readCommittedManifests(active)).find((candidate) => candidate.versionId === versionId);
				if (manifest === void 0) throw new QuantSkillsHostError("Installed QuantSkills version was not found.", "INSTALLED_VERSION_NOT_FOUND");
				if (manifest.exposure !== "agent-template" || manifest.kind !== "agent") throw new QuantSkillsHostError("Installed QuantSkills version is not an Agent template.", "INSTALLED_VERSION_NOT_AGENT");
				const parsed = parseQuantSkillsAgent(await readFile(join(this.versionSource(manifest), manifest.declaration), {
					encoding: "utf8",
					signal: active
				}));
				if (parsed.name !== manifest.assetId) throw new QuantSkillsHostError("Installed QuantSkills Agent declaration is corrupt.", "INSTALL_RECORD_CORRUPT");
				return Object.freeze({
					version: publicManifest(manifest),
					...parsed
				});
			}, signal);
		}
		/**
		* Validate one Workspace-local authoring draft through the same Git-tree admission used by catalog installs.
		* @param request - draft directory and declaration family.
		* @param signal - optional caller cancellation.
		* @returns content identity and validated declaration metadata without publishing files.
		*/
		async prepareAuthoredDraft(request, signal) {
			return this.runOperation(async (active) => {
				const materialized = await this.materializeAuthoredDraft(request, active);
				try {
					return materialized.draft;
				} finally {
					await removeOwnedPath(materialized.staging, this.requireRoots().staging).catch(() => {});
				}
			}, signal);
		}
		/**
		* Publish one unchanged Workspace-local authoring draft as an immutable local Git version.
		* @param request - prepared draft and expected tree digest.
		* @param signal - optional caller cancellation.
		* @returns committed local installation visible to exact-version resolvers.
		*/
		authoredWrite = Promise.resolve();
		async publishAuthoredDraft(request, signal) {
			return this.runOperation((active) => {
				const write = this.authoredWrite.catch(() => {}).then(async () => {
					active.throwIfAborted();
					const materialized = await this.materializeAuthoredDraft(request, active);
					let published = false;
					try {
						if (materialized.draft.treeDigest !== request.expectedTreeDigest) throw new QuantSkillsHostError("QuantSkills authoring draft changed after it was prepared.", "INSTALL_INVALID_TREE");
						if (request.expectedBaseVersionId !== void 0) {
							const versions = (await this.readCommittedManifests(active)).filter((item) => item.assetId === materialized.manifest.assetId);
							const duplicate = versions.find((item) => item.origin === "local-authoring" && item.treeDigest === request.expectedTreeDigest);
							if (duplicate) {
								await this.confirmExposure(duplicate, active);
								return publicManifest(duplicate);
							}
							const latest = versions.sort((a, b) => b.installedAt - a.installedAt || b.versionId.localeCompare(a.versionId))[0];
							if (request.expectedBaseVersionId === null && latest || request.expectedBaseVersionId !== null && (latest?.origin !== "local-authoring" || latest.versionId !== request.expectedBaseVersionId)) throw new QuantSkillsHostError("技能已被修改，或名称已被使用。请保留草稿，重新打开最新版本后核对。", "INSTALL_INVALID_TREE");
						}
						const target = join(await ensurePrivateChild(this.requireRoots().authored, materialized.manifest.assetId), materialized.manifest.commit);
						try {
							await rename(materialized.payload, target);
							published = true;
							await this.confirmExposure(materialized.manifest, active);
							return publicManifest(materialized.manifest);
						} catch (error) {
							if (!isExists(error)) throw error;
							const existing = await readManifest(target);
							await assertStoredSource(target, existing);
							if (existing.treeDigest !== request.expectedTreeDigest || existing.origin !== "local-authoring") throw new QuantSkillsHostError("Local QuantSkills version identity conflicts with stored content.", "INSTALL_RECORD_CORRUPT");
							await this.confirmExposure(existing, active);
							return publicManifest(existing);
						}
					} finally {
						if (!published) await removeOwnedPath(materialized.payload, materialized.staging).catch(() => {});
						await removeOwnedPath(materialized.staging, this.requireRoots().staging).catch(() => {});
					}
				});
				this.authoredWrite = write;
				return write;
			}, signal);
		}
		/** Save a manual declaration through the same admission and immutable publication as AI creation. */
		async manualSkillRead(versionId, signal) {
			return this.runOperation(async (active) => {
				const source = (await this.readCommittedManifests(active)).find((item) => item.versionId === versionId);
				if (!source || source.kind !== "skill") throw new QuantSkillsHostError("技能版本不可用。", "INSTALLED_VERSION_NOT_FOUND");
				const location = this.versionSource(source);
				await assertStoredSource(dirname(location), source);
				return readFile(join(location, "SKILL.md"), {
					encoding: "utf8",
					signal: active
				});
			}, signal);
		}
		manualSkillSave(request, signal) {
			return this.runOperation(async (active) => {
				const input = z.object({
					markdown: z.string().min(1).max(512e3),
					mode: z.enum([
						"create",
						"edit",
						"copy"
					]),
					sourceVersionId: z.string().optional(),
					copyAssetId: z.string().regex(/^skill-[a-z0-9]+(?:-[a-z0-9]+)*$/).optional()
				}).strict().parse(request);
				if (input.mode === "copy") {
					if (!input.copyAssetId) throw new QuantSkillsHostError("个人副本缺少新标识，请重新打开编辑器。", "INSTALL_INVALID_TREE");
					const header = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(input.markdown);
					if (!header) throw new QuantSkillsHostError("SKILL.md 缺少声明元信息。", "INSTALL_INVALID_TREE");
					const document = parseDocument(header[1]);
					if (document.errors.length) throw new QuantSkillsHostError("SKILL.md 声明格式有误，请检查 YAML。", "INSTALL_INVALID_TREE");
					document.set("name", input.copyAssetId);
					input.markdown = `---\n${document.toString()}---\n${input.markdown.slice(header[0].length)}`;
				}
				const parsed = parseQuantSkillsSkill(input.markdown);
				if (!parsed.content.trim()) throw new QuantSkillsHostError("请填写技能的执行说明。", "INSTALL_INVALID_TREE");
				const assetId = parsed.name.startsWith("skill-") ? parsed.name : `skill-${parsed.name}`;
				const source = (await this.readCommittedManifests(active)).find((item) => item.versionId === input.sourceVersionId);
				if (input.mode === "create" ? input.sourceVersionId !== void 0 : !source || source.kind !== "skill") throw new QuantSkillsHostError("原技能版本不可用，请重新选择。", "INSTALLED_VERSION_NOT_FOUND");
				if (input.mode === "edit" && (source?.origin !== "local-authoring" || source.assetId !== assetId)) throw new QuantSkillsHostError("公共技能不能直接修改；请另存为我的技能。编辑时不能改变技能标识。", "INSTALL_INVALID_TREE");
				if (input.mode === "copy" && source?.assetId === assetId) throw new QuantSkillsHostError("个人副本需要新的技能标识。", "INSTALL_INVALID_TREE");
				const staging = await mkdtemp(join(this.requireRoots().staging, "manual-skill-"));
				const draft = join(staging, "source");
				try {
					if (source) await cp(this.versionSource(source), draft, {
						recursive: true,
						dereference: false,
						errorOnExist: true,
						force: false
					});
					else await mkdir(draft, { mode: 448 });
					const declaration = join(draft, "SKILL.md");
					const existing = await lstat(declaration).catch((error) => {
						if (error.code === "ENOENT") return void 0;
						throw error;
					});
					if (existing && (!existing.isFile() || existing.isSymbolicLink())) throw new QuantSkillsHostError("技能声明文件不安全，未保存。", "INSTALL_INVALID_TREE");
					await unlink(declaration).catch((error) => {
						if (error.code !== "ENOENT") throw error;
					});
					const file = await open(declaration, "wx", 384);
					try {
						await file.writeFile(input.markdown, "utf8");
					} finally {
						await file.close();
					}
					const prepared = await this.prepareAuthoredDraft({
						draftRoot: draft,
						kind: "skill"
					}, active);
					return await this.publishAuthoredDraft({
						draftRoot: draft,
						kind: "skill",
						expectedTreeDigest: prepared.treeDigest,
						expectedBaseVersionId: input.mode === "edit" ? source.versionId : null
					}, active);
				} finally {
					await removeOwnedPath(staging, this.requireRoots().staging);
				}
			}, signal);
		}
		async materializeAuthoredDraft(request, signal) {
			const draftRoot = await realpath(request.draftRoot);
			const draftInfo = await lstat(draftRoot);
			if (!draftInfo.isDirectory() || draftInfo.isSymbolicLink()) throw new QuantSkillsHostError("QuantSkills authoring draft is not a real directory.", "INSTALL_INVALID_TREE");
			const roots = this.requireRoots();
			const staging = await mkdtemp(join(roots.staging, "authoring-"));
			await chmod(staging, 448);
			const templateRoot = await ensurePrivateChild(staging, "git-template");
			const repository = await ensurePrivateChild(staging, "repository.git");
			const payload = await ensurePrivateChild(staging, "payload");
			const source = await ensurePrivateChild(payload, "source");
			try {
				await this.runGit([
					"init",
					"--quiet",
					"--bare",
					repository
				], staging, signal, templateRoot);
				const gitScope = [`--git-dir=${repository}`, `--work-tree=${draftRoot}`];
				await this.runGit([
					...gitScope,
					"add",
					"--force",
					"--all",
					"--",
					"."
				], staging, signal, templateRoot);
				const treeObject = (await this.runGit([...gitScope, "write-tree"], staging, signal, templateRoot)).trim();
				if (!SHA_PATTERN.test(treeObject)) throw new QuantSkillsHostError("Git did not produce an exact local draft tree.", "INSTALL_GIT_FAILED");
				const declaration = request.kind === "skill" ? "SKILL.md" : "AGENTS.md";
				const tree = validateGitTree(await this.runGit([
					`--git-dir=${repository}`,
					"ls-tree",
					"-rlz",
					"--full-tree",
					treeObject
				], staging, signal, templateRoot), declaration, this.resolved.tree);
				const commit = (await this.runGit([
					`--git-dir=${repository}`,
					"-c",
					"user.name=QuantSkills Local Authoring",
					"-c",
					"user.email=local-authoring@quantskills.invalid",
					"commit-tree",
					treeObject,
					"-m",
					"QuantSkills local authoring snapshot"
				], staging, signal, templateRoot, {
					GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z",
					GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z"
				})).trim();
				if (!SHA_PATTERN.test(commit)) throw new QuantSkillsHostError("Git did not produce an exact local authoring commit.", "INSTALL_GIT_FAILED");
				await this.runGit([
					`--git-dir=${repository}`,
					`--work-tree=${source}`,
					"checkout",
					"--quiet",
					"--force",
					commit,
					"--",
					"."
				], staging, signal, templateRoot);
				await this.verifyCheckout(source, tree.entries, signal);
				let assetId;
				let requires;
				if (request.kind === "skill") {
					const parsed = parseQuantSkillsSkill(await readFile(join(source, declaration), {
						encoding: "utf8",
						signal
					}));
					const normalized = parsed.name.startsWith("skill-") ? parsed.name : `skill-${parsed.name}`;
					if (!ASSET_PATTERN.test(normalized)) throw new QuantSkillsHostError("Local SKILL.md name is not a valid QuantSkills asset identity.", "INSTALL_INVALID_TREE");
					assetId = normalized;
					requires = Object.freeze([]);
				} else {
					const parsed = parseQuantSkillsAgent(await readFile(join(source, declaration), {
						encoding: "utf8",
						signal
					}));
					assetId = parsed.name;
					requires = parsed.requires;
				}
				if ((await this.fetchCatalog(signal)).assets.some((asset) => asset.assetId === assetId)) throw new QuantSkillsHostError("Local QuantSkills asset id conflicts with the official catalog.", "INSTALL_INVALID_TREE");
				const installed = await this.readCommittedManifests(signal);
				for (const required of requires) if (!installed.some((candidate) => candidate.assetId === required && candidate.kind === "skill")) throw new QuantSkillsHostError(`Local QuantSkills Agent requires an uninstalled Skill: ${required}.`, "INSTALL_INVALID_TREE");
				const typedCommit = commit;
				const manifest = Object.freeze({
					schemaVersion: MANIFEST_SCHEMA_VERSION,
					versionId: installedVersionId(assetId, typedCommit),
					assetId,
					kind: request.kind,
					repository: `local-authoring:${assetId}`,
					commit: typedCommit,
					declaration,
					treeDigest: tree.treeDigest,
					fileCount: tree.fileCount,
					totalBytes: tree.totalBytes,
					installedAt: Date.now(),
					exposure: request.kind === "skill" ? "skill-registry" : "agent-template",
					origin: "local-authoring"
				});
				await writeManifest(join(payload, MANIFEST_NAME), manifest);
				return Object.freeze({
					draft: Object.freeze({
						assetId,
						kind: request.kind,
						declaration,
						treeDigest: tree.treeDigest,
						fileCount: tree.fileCount,
						totalBytes: tree.totalBytes,
						requires
					}),
					manifest,
					payload,
					staging
				});
			} catch (error) {
				await removeOwnedPath(staging, roots.staging).catch(() => {});
				if (error instanceof QuantSkillsHostError) throw error;
				throw new QuantSkillsHostError("Unable to validate the local QuantSkills draft.", "INSTALL_WRITE_FAILED", { cause: error });
			}
		}
		runOperation(operation, caller) {
			if (!this.accepting) return Promise.reject(/* @__PURE__ */ new Error("quantskills-host: service is disposing"));
			const signal = caller === void 0 ? this.lifetime.signal : AbortSignal.any([this.lifetime.signal, caller]);
			const result = Promise.resolve().then(() => {
				signal.throwIfAborted();
				return operation(signal);
			});
			this.operations.add(result);
			return result.finally(() => {
				this.operations.delete(result);
			});
		}
		async fetchCatalog(signal) {
			const requestRevision = ++this.catalogRequestRevision;
			const cached = this.catalogCache;
			const timeout = AbortSignal.timeout(this.resolved.catalogTimeoutMs);
			const combined = AbortSignal.any([signal, timeout]);
			let response;
			try {
				response = await fetch(this.resolved.catalogUrl, {
					method: "GET",
					redirect: "error",
					cache: "no-store",
					signal: combined,
					headers: {
						accept: "application/json, text/plain;q=0.9",
						...cached?.etag === void 0 ? {} : { "if-none-match": cached.etag }
					}
				});
			} catch (error) {
				signal.throwIfAborted();
				throw new QuantSkillsHostError(timeout.aborted ? "QuantSkills catalog request timed out." : "Unable to fetch the QuantSkills catalog.", "CATALOG_FETCH_FAILED", { cause: error });
			}
			signal.throwIfAborted();
			if (response.url !== this.resolved.catalogUrl) throw new QuantSkillsHostError("QuantSkills catalog response was not the trusted publication.", "CATALOG_FETCH_FAILED");
			if (response.status === 304) {
				if (cached === void 0 || cached.etag === void 0) throw new QuantSkillsHostError("QuantSkills catalog returned an unusable not-modified response.", "CATALOG_FETCH_FAILED");
				return this.withSyncStatus(cached.snapshot);
			}
			if (!response.ok) throw new QuantSkillsHostError("QuantSkills catalog response was not the trusted publication.", "CATALOG_FETCH_FAILED");
			const limits = {
				maxBytes: this.resolved.maxCatalogBytes,
				maxAssets: this.resolved.maxCatalogAssets
			};
			const parsed = parseCatalogDocument(await readCatalogResponse(response, limits.maxBytes), limits);
			const snapshot = Object.freeze({
				...parsed,
				refreshAfterMs: this.resolved.catalogRefreshMs
			});
			const etag = catalogEtag(response);
			if (requestRevision === this.catalogRequestRevision) this.catalogCache = Object.freeze({
				snapshot,
				...etag === void 0 ? {} : { etag }
			});
			const published = this.withSyncStatus(snapshot);
			if (cached?.snapshot.snapshotId !== snapshot.snapshotId) this.ctx.emit("quantskills/catalog-updated", published);
			return published;
		}
		withSyncStatus(snapshot) {
			return Object.freeze({
				...snapshot,
				sync: this.syncStatus
			});
		}
		publishSyncStatus(status) {
			this.syncStatus = Object.freeze(status);
			this.ctx.emit("quantskills/catalog-sync-status", this.syncStatus);
		}
		async runCatalogEventLoop(signal) {
			let connectedOnce = false;
			while (!signal.aborted) {
				this.publishSyncStatus(Object.freeze({
					mode: "event-stream",
					state: connectedOnce ? "reconnecting" : "connecting"
				}));
				try {
					await this.consumeCatalogEvents(signal);
				} catch (_eventStreamUnavailable) {
					if (signalAborted(signal)) return;
					this.publishSyncStatus(Object.freeze({
						mode: "event-stream",
						state: "error",
						error: "目录事件连接暂不可用，正在重连。"
					}));
				}
				if (signalAborted(signal)) return;
				connectedOnce = true;
				try {
					await setTimeout(this.resolved.catalogEventsReconnectMs, void 0, { signal });
				} catch (_serviceDisposing) {
					return;
				}
			}
		}
		async consumeCatalogEvents(signal) {
			const url = this.resolved.catalogEventsUrl;
			if (url === void 0) return;
			const response = await fetch(url, {
				method: "GET",
				redirect: "error",
				cache: "no-store",
				signal,
				headers: { accept: "text/event-stream" }
			});
			if (!response.ok || response.url !== url || !response.headers.get("content-type")?.toLowerCase().startsWith("text/event-stream") || response.body === null) throw new Error("QuantSkills catalog event relay returned an invalid response.");
			const connectedAt = Date.now();
			this.publishSyncStatus(Object.freeze({
				mode: "event-stream",
				state: "connected",
				connectedAt
			}));
			const reader = response.body.getReader();
			const cancelReader = () => {
				reader.cancel(signal.reason).catch(() => void 0);
			};
			signal.addEventListener("abort", cancelReader, { once: true });
			const decoder = new TextDecoder();
			let buffer = "";
			let eventName = "";
			let hasData = false;
			const dispatch = async () => {
				if (!hasData || eventName !== "" && eventName !== "catalog" && eventName !== "catalog.updated") {
					eventName = "";
					hasData = false;
					return;
				}
				const eventReceivedAt = Date.now();
				this.publishSyncStatus(Object.freeze({
					mode: "event-stream",
					state: "connected",
					connectedAt,
					eventReceivedAt
				}));
				await this.fetchCatalog(signal);
				eventName = "";
				hasData = false;
			};
			try {
				while (!signal.aborted) {
					const chunk = await reader.read();
					if (chunk.done) throw new Error("QuantSkills catalog event relay closed the stream.");
					buffer += decoder.decode(chunk.value, { stream: true });
					if (Buffer.byteLength(buffer, "utf8") > MAX_CATALOG_EVENT_BUFFER_BYTES) throw new Error("QuantSkills catalog event exceeded the allowed buffer.");
					let newline = buffer.indexOf("\n");
					while (newline >= 0) {
						const rawLine = buffer.slice(0, newline);
						buffer = buffer.slice(newline + 1);
						const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
						if (line === "") await dispatch();
						else if (!line.startsWith(":")) {
							const separator = line.indexOf(":");
							const field = separator < 0 ? line : line.slice(0, separator);
							if (field === "event") eventName = line.slice(separator + 1).trimStart();
							else if (field === "data") hasData = true;
						}
						newline = buffer.indexOf("\n");
					}
				}
			} finally {
				signal.removeEventListener("abort", cancelReader);
			}
		}
		requireRoots() {
			if (this.roots === void 0) throw new Error("quantskills-host: managed roots are not initialized");
			return this.roots;
		}
		versionRoot(manifest) {
			return join(manifest.origin === "catalog" ? this.requireRoots().versions : this.requireRoots().authored, manifest.assetId, manifest.commit);
		}
		versionSource(manifest) {
			return join(this.versionRoot(manifest), "source");
		}
		requireGitPath() {
			if (this.gitPath === void 0) throw new Error("quantskills-host: Git executable is not initialized");
			return this.gitPath;
		}
		requirePnpmPath() {
			if (this.pnpmPath === void 0) throw new Error("quantskills-host: pnpm executable is not initialized");
			return this.pnpmPath;
		}
		requireApplicationUpdater() {
			if (this.applicationUpdater === void 0) throw new Error("quantskills-host: application updater is not initialized");
			return this.applicationUpdater;
		}
		async listCommitted(signal) {
			const versions = await Promise.all((await this.readActiveManifests(signal)).map(async (manifest) => {
				const declarationPath = join(this.versionSource(manifest), manifest.declaration);
				let declaration;
				try {
					declaration = await readFile(declarationPath, {
						encoding: "utf8",
						signal
					});
				} catch (error) {
					throw new QuantSkillsHostError("Installed QuantSkills declaration cannot be read.", "INSTALL_RECORD_CORRUPT", { cause: error });
				}
				const declarationTitleZh = extractChineseDeclarationTitle(declaration);
				return Object.freeze({
					...publicManifest(manifest),
					...declarationTitleZh === void 0 ? {} : { declarationTitleZh }
				});
			}));
			versions.sort((left, right) => left.versionId.localeCompare(right.versionId));
			return Object.freeze({ versions: Object.freeze(versions) });
		}
		async readCommittedManifests(signal) {
			const versions = [];
			for (const store of [{
				path: this.requireRoots().versions,
				origin: "catalog"
			}, {
				path: this.requireRoots().authored,
				origin: "local-authoring"
			}]) for (const assetEntry of await readdir(store.path, { withFileTypes: true })) {
				signal?.throwIfAborted();
				if (!assetEntry.isDirectory() || assetEntry.isSymbolicLink() || !ASSET_PATTERN.test(assetEntry.name)) throw new QuantSkillsHostError("QuantSkills versions directory contains an invalid entry.", "INSTALL_RECORD_CORRUPT");
				const assetRoot = join(store.path, assetEntry.name);
				for (const versionEntry of await readdir(assetRoot, { withFileTypes: true })) {
					signal?.throwIfAborted();
					if (store.origin === "catalog" && versionEntry.name === ".uninstalled" && versionEntry.isFile() && !versionEntry.isSymbolicLink()) continue;
					if (!versionEntry.isDirectory() || versionEntry.isSymbolicLink() || !SHA_PATTERN.test(versionEntry.name)) throw new QuantSkillsHostError("QuantSkills asset directory contains an invalid version entry.", "INSTALL_RECORD_CORRUPT");
					const versionRoot = join(assetRoot, versionEntry.name);
					const manifest = await readManifest(versionRoot);
					if (manifest.assetId !== assetEntry.name || manifest.commit !== versionEntry.name || manifest.origin !== store.origin) throw new QuantSkillsHostError("QuantSkills installation path disagrees with its manifest.", "INSTALL_RECORD_CORRUPT");
					await assertStoredSource(versionRoot, manifest);
					versions.push(manifest);
				}
			}
			return versions;
		}
		async listInstalledSkillLocations(signal) {
			const active = /* @__PURE__ */ new Map();
			for (const manifest of await this.readActiveManifests(signal)) {
				if (manifest.exposure !== "skill-registry") continue;
				const prior = active.get(manifest.assetId);
				if (prior === void 0 || prior.installedAt < manifest.installedAt || prior.installedAt === manifest.installedAt && prior.versionId.localeCompare(manifest.versionId) < 0) active.set(manifest.assetId, manifest);
			}
			return Object.freeze([...active.values()].map((manifest) => {
				const resourceBase = this.versionSource(manifest);
				return Object.freeze({
					assetId: manifest.assetId,
					versionId: manifest.versionId,
					declarationPath: join(resourceBase, manifest.declaration),
					resourceBase
				});
			}));
		}
		async installResolved(request, signal) {
			const catalog = await this.fetchCatalog(signal);
			if (catalog.snapshotId !== request.observedSnapshotId) throw new QuantSkillsHostError("QuantSkills catalog changed; refresh before installing.", "CATALOG_STALE");
			const asset = catalog.assets.find((candidate) => candidate.assetId === request.assetId);
			if (asset === void 0) throw new QuantSkillsHostError("Approved QuantSkills asset was not found.", "ASSET_NOT_FOUND");
			if (asset.commit !== request.observedCommit) throw new QuantSkillsHostError("QuantSkills asset commit changed; refresh before installing.", "CATALOG_STALE");
			const visiting = /* @__PURE__ */ new Set();
			return this.installCatalogAssetWithDependencies(catalog, asset, visiting, signal);
		}
		async readAssetReadme(request, signal) {
			const catalog = await this.fetchCatalog(signal);
			if (catalog.snapshotId !== request.observedSnapshotId) throw new QuantSkillsHostError("QuantSkills catalog changed; refresh before reading details.", "CATALOG_STALE");
			const asset = catalog.assets.find((candidate) => candidate.assetId === request.assetId);
			if (asset === void 0) throw new QuantSkillsHostError("Approved QuantSkills asset was not found.", "ASSET_NOT_FOUND");
			if (asset.commit !== request.observedCommit) throw new QuantSkillsHostError("QuantSkills asset commit changed; refresh before reading details.", "CATALOG_STALE");
			const url = quantSkillsReadmeUrl(asset.assetId, asset.commit);
			const timeout = AbortSignal.timeout(this.resolved.readmeTimeoutMs);
			const combined = AbortSignal.any([signal, timeout]);
			let response;
			try {
				response = await fetch(url, {
					method: "GET",
					redirect: "error",
					cache: "no-store",
					signal: combined,
					headers: { accept: "text/markdown, text/plain;q=0.9" }
				});
			} catch (error) {
				signal.throwIfAborted();
				throw new QuantSkillsHostError(timeout.aborted ? "QuantSkills README request timed out." : "Unable to fetch the QuantSkills README.", "ASSET_README_FETCH_FAILED", { cause: error });
			}
			signal.throwIfAborted();
			if (response.url !== url) throw new QuantSkillsHostError("QuantSkills README response was not the approved fixed-commit document.", "ASSET_README_FETCH_FAILED");
			if (response.status === 404) throw new QuantSkillsHostError("QuantSkills repository has no README.md at this commit.", "ASSET_README_NOT_FOUND");
			if (!response.ok) throw new QuantSkillsHostError("Unable to fetch the QuantSkills README.", "ASSET_README_FETCH_FAILED");
			const markdown = await readQuantSkillsReadmeResponse(response, this.resolved.maxReadmeBytes);
			return Object.freeze({
				assetId: asset.assetId,
				commit: asset.commit,
				path: "README.md",
				markdown
			});
		}
		async installCatalogAssetWithDependencies(catalog, asset, visiting, signal) {
			if (visiting.has(asset.assetId)) throw new QuantSkillsHostError("QuantSkills catalog contains a dependency cycle.", "CATALOG_INVALID");
			visiting.add(asset.assetId);
			try {
				for (const requiredId of asset.requires ?? []) {
					const required = this.resolveApprovedSkillDependency(catalog, requiredId);
					await this.installCatalogAssetWithDependencies(catalog, required, visiting, signal);
				}
				return await this.installCatalogAsset(asset, catalog, visiting, signal);
			} finally {
				visiting.delete(asset.assetId);
			}
		}
		async installCatalogAsset(asset, catalog, visiting, signal) {
			const roots = this.requireRoots();
			const target = join(await ensurePrivateChild(roots.versions, asset.assetId), asset.commit);
			try {
				const existing = await readManifest(target);
				await assertStoredSource(target, existing);
				if (asset.kind === "agent") {
					const declared = await this.validateAgentDeclaration(join(target, "source"), asset.assetId, signal);
					await this.installDeclaredAgentDependencies(catalog, declared, visiting, signal);
				}
				await this.confirmExposure(existing, signal);
				return publicManifest(existing);
			} catch (error) {
				if (!isMissing(error)) throw error;
			}
			const staging = await mkdtemp(join(roots.staging, "install-"));
			await chmod(staging, 448);
			const templateRoot = await ensurePrivateChild(staging, "git-template");
			const payload = await ensurePrivateChild(staging, "payload");
			const source = join(payload, "source");
			let published = false;
			try {
				await this.runGit([
					"init",
					"--quiet",
					`--template=${templateRoot}`,
					source
				], staging, signal);
				await this.runGit([
					"remote",
					"add",
					"origin",
					asset.repository
				], source, signal, templateRoot);
				const githubTimeout = AbortSignal.timeout(this.resolved.githubFetchTimeoutMs);
				try {
					await this.runGit([
						"fetch",
						"--quiet",
						"--depth=1",
						"--no-tags",
						"origin",
						asset.commit
					], source, AbortSignal.any([signal, githubTimeout]), templateRoot);
				} catch (error) {
					signal.throwIfAborted();
					const gitFailed = error instanceof QuantSkillsHostError && error.code === "INSTALL_GIT_FAILED";
					if (!githubTimeout.aborted && !gitFailed) throw error;
					await this.runGit([
						"remote",
						"set-url",
						"origin",
						`${QUANTSKILLS_GITEE_ORGANIZATION}/${asset.assetId}.git`
					], source, signal, templateRoot);
					await this.runGit([
						"fetch",
						"--quiet",
						"--depth=1",
						"--no-tags",
						"origin",
						asset.commit
					], source, signal, templateRoot);
				}
				if ((await this.runGit(["rev-parse", "FETCH_HEAD^{commit}"], source, signal, templateRoot)).trim() !== asset.commit) throw new QuantSkillsHostError("Git did not resolve the catalog commit exactly.", "INSTALL_GIT_FAILED");
				const tree = validateGitTree(await this.runGit([
					"ls-tree",
					"-rlz",
					"--full-tree",
					asset.commit
				], source, signal, templateRoot), asset.declaration, this.resolved.tree);
				await this.runGit([
					"checkout",
					"--quiet",
					"--detach",
					"--force",
					asset.commit
				], source, signal, templateRoot);
				await this.verifyCheckout(source, tree.entries, signal);
				await removeOwnedPath(join(source, ".git"), source);
				if (asset.kind === "skill") await this.validateSkillDeclaration(source, asset.assetId, signal);
				else {
					const declared = await this.validateAgentDeclaration(source, asset.assetId, signal);
					await this.installDeclaredAgentDependencies(catalog, declared, visiting, signal);
				}
				const manifest = Object.freeze({
					schemaVersion: MANIFEST_SCHEMA_VERSION,
					versionId: installedVersionId(asset.assetId, asset.commit),
					assetId: asset.assetId,
					kind: asset.kind,
					repository: asset.repository,
					commit: asset.commit,
					declaration: asset.declaration,
					treeDigest: tree.treeDigest,
					fileCount: tree.fileCount,
					totalBytes: tree.totalBytes,
					installedAt: Date.now(),
					exposure: asset.kind === "skill" ? "skill-registry" : "agent-template",
					origin: "catalog"
				});
				await writeManifest(join(payload, MANIFEST_NAME), manifest);
				signal.throwIfAborted();
				try {
					await rename(payload, target);
					published = true;
					await this.confirmExposure(manifest, signal);
					return publicManifest(manifest);
				} catch (error) {
					if (!isExists(error)) throw error;
					const existing = await readManifest(target);
					await assertStoredSource(target, existing);
					await this.confirmExposure(existing, signal);
					return publicManifest(existing);
				}
			} catch (error) {
				signal.throwIfAborted();
				if (error instanceof QuantSkillsHostError) throw error;
				throw new QuantSkillsHostError("Unable to publish the QuantSkills asset version.", "INSTALL_WRITE_FAILED", { cause: error });
			} finally {
				if (!published) await removeOwnedPath(payload, staging).catch(() => {});
				await removeOwnedPath(staging, roots.staging).catch(() => {});
			}
		}
		async runGit(args, cwd, signal, hooksPath, environment) {
			const prefix = hooksPath === void 0 ? [] : [
				"-c",
				"core.autocrlf=false",
				"-c",
				"core.eol=lf",
				"-c",
				`core.hooksPath=${hooksPath}`
			];
			const handle = this.ctx.subprocess.spawn({
				argv: [
					this.requireGitPath(),
					...prefix,
					...args
				],
				cwd,
				stdio: {
					stdin: "ignore",
					stdout: { maxBytes: this.resolved.maxGitOutputBytes },
					stderr: { maxBytes: this.resolved.maxGitOutputBytes }
				},
				graceMs: this.resolved.gitGraceMs,
				signal,
				env: {
					GIT_TERMINAL_PROMPT: "0",
					GIT_CONFIG_NOSYSTEM: "1",
					GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
					GIT_ALLOW_PROTOCOL: "https",
					...environment
				}
			});
			const outcome = await handle.done;
			signal.throwIfAborted();
			const stdout = handle.collected.stdout?.readFrom(0);
			const stderr = handle.collected.stderr?.readFrom(0);
			this.assertCompleteGitOutput(stdout, "stdout");
			this.assertCompleteGitOutput(stderr, "stderr");
			if (outcome.exitCode !== 0 || outcome.signal !== null) {
				const detail = stderr?.text.trim();
				throw new QuantSkillsHostError(detail === void 0 || detail === "" ? "Git command failed." : `Git command failed: ${detail}`, "INSTALL_GIT_FAILED");
			}
			return stdout?.text ?? "";
		}
		async runPnpm(args, cwd, signal, environment) {
			const handle = this.ctx.subprocess.spawn({
				argv: [this.requirePnpmPath(), ...args],
				cwd,
				stdio: {
					stdin: "ignore",
					stdout: { maxBytes: this.resolved.maxGitOutputBytes },
					stderr: { maxBytes: this.resolved.maxGitOutputBytes }
				},
				graceMs: this.resolved.gitGraceMs,
				signal,
				env: environment
			});
			const outcome = await handle.done;
			signal.throwIfAborted();
			const stdout = handle.collected.stdout?.readFrom(0);
			const stderr = handle.collected.stderr?.readFrom(0);
			if (stdout === void 0 || stdout.lossy || stderr === void 0 || stderr.lossy) throw new Error("pnpm output exceeded its configured complete-output limit");
			if (outcome.exitCode !== 0 || outcome.signal !== null) {
				const detail = stderr.text.trim();
				throw new Error(detail === "" ? "pnpm command failed" : detail);
			}
		}
		assertCompleteGitOutput(output, name) {
			if (output === void 0 || output.lossy) throw new QuantSkillsHostError(`Git ${name} exceeded its configured complete-output limit.`, "INSTALL_LIMIT_EXCEEDED");
		}
		async verifyCheckout(source, entries, signal) {
			for (const entry of entries) {
				signal.throwIfAborted();
				const path = join(source, ...entry.path.split("/"));
				const info = await lstat(path);
				if (!info.isFile() || info.isSymbolicLink() || info.size !== entry.bytes) throw new QuantSkillsHostError("Checked-out QuantSkills files disagree with the validated Git tree.", "INSTALL_INVALID_TREE");
				if (await gitBlobObject(path, entry.bytes, signal) !== entry.object) throw new QuantSkillsHostError("Checked-out QuantSkills content disagrees with the validated Git tree.", "INSTALL_INVALID_TREE");
			}
		}
		async validateSkillDeclaration(source, assetId, signal) {
			try {
				if (!matchesQuantSkillsSkillName(assetId, parseQuantSkillsSkill(await readFile(join(source, "SKILL.md"), {
					encoding: "utf8",
					signal
				})).name)) throw new Error("SKILL.md name does not match its catalog asset identity");
			} catch (error) {
				signal.throwIfAborted();
				throw new QuantSkillsHostError("QuantSkills SKILL.md is not discoverable by the Skill registry.", "INSTALL_INVALID_TREE", { cause: error });
			}
		}
		async validateAgentDeclaration(source, assetId, signal) {
			try {
				const parsed = parseQuantSkillsAgent(await readFile(join(source, "AGENTS.md"), {
					encoding: "utf8",
					signal
				}));
				if (parsed.name !== assetId) throw new Error("AGENTS.md name does not match its catalog asset id");
				return parsed.requires;
			} catch (error) {
				signal.throwIfAborted();
				throw new QuantSkillsHostError("QuantSkills AGENTS.md is not a valid Agent template.", "INSTALL_INVALID_TREE", { cause: error });
			}
		}
		async installDeclaredAgentDependencies(catalog, declared, visiting, signal) {
			for (const requiredId of declared) {
				const required = this.resolveApprovedSkillDependency(catalog, requiredId);
				await this.installCatalogAssetWithDependencies(catalog, required, visiting, signal);
			}
		}
		resolveApprovedSkillDependency(catalog, assetId) {
			const asset = catalog.assets.find((candidate) => candidate.assetId === assetId);
			if (asset === void 0) throw new QuantSkillsHostError("Approved QuantSkills dependency was not found.", "ASSET_NOT_FOUND");
			if (asset.kind !== "skill") throw new QuantSkillsHostError("QuantSkills Agent dependencies must be approved Skills.", "CATALOG_INVALID");
			return asset;
		}
		async confirmExposure(manifest, signal) {
			if (manifest.origin === "catalog") await unlink(join(await ensurePrivateChild(this.requireRoots().versions, manifest.assetId), ".uninstalled")).catch((error) => {
				if (!isMissing(error)) throw error;
			});
			if (manifest.exposure === "agent-template") return;
			this.skillProviderControl?.invalidate();
			const resourceBase = this.versionSource(manifest);
			const parsed = parseQuantSkillsSkill(await readFile(join(resourceBase, manifest.declaration), {
				encoding: "utf8",
				signal
			}));
			const skill = await this.ctx.skills.get(parsed.name, { signal });
			if (skill?.provider !== "quantskills-host" || skill.path !== join(resourceBase, manifest.declaration) || skill.resourceBase?.kind !== "directory" || skill.resourceBase.path !== resourceBase) throw new QuantSkillsHostError("Installed QuantSkills Skill is not visible through the Skill registry.", "INSTALL_EXPOSURE_FAILED");
		}
		async readActiveManifests(signal) {
			const manifests = await this.readCommittedManifests(signal);
			const active = await Promise.all(manifests.map(async (manifest) => {
				if (manifest.origin !== "catalog") return true;
				try {
					await lstat(join(this.requireRoots().versions, manifest.assetId, ".uninstalled"));
					return false;
				} catch (error) {
					if (isMissing(error)) return true;
					throw error;
				}
			}));
			return manifests.filter((_, index) => active[index]);
		}
	};
})();
async function gitBlobObject(path, expectedBytes, signal) {
	const hash = createHash("sha1");
	hash.update(`blob ${expectedBytes}\0`);
	let bytes = 0;
	const stream = createReadStream(path, { signal });
	for await (const chunk of stream) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		bytes += buffer.length;
		hash.update(buffer);
	}
	signal.throwIfAborted();
	if (bytes !== expectedBytes) throw new QuantSkillsHostError("Checked-out QuantSkills file changed during verification.", "INSTALL_INVALID_TREE");
	return hash.digest("hex");
}
async function assertStoredSource(versionRoot, manifest) {
	try {
		const source = await lstat(join(versionRoot, "source"));
		const declaration = await lstat(join(versionRoot, "source", manifest.declaration));
		if (!source.isDirectory() || source.isSymbolicLink() || !declaration.isFile() || declaration.isSymbolicLink()) throw new Error("installed source is not a real directory with a regular declaration");
	} catch (error) {
		if (error instanceof QuantSkillsHostError) throw error;
		throw new QuantSkillsHostError("QuantSkills installed source is corrupt.", "INSTALL_RECORD_CORRUPT", { cause: error });
	}
}
//#endregion
export { QuantSkillsHostError, QuantSkillsHostGateway, QuantSkillsHostGateway as default };
