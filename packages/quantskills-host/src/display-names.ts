/** Stable localized display-name resolution for trusted QuantSkills catalog assets. */

import type {
  QuantSkillsAssetKind,
  QuantSkillsDisplayNames,
  QuantSkillsDisplayNameSource,
} from './types.ts'

const HAN_PATTERN = /[\u3400-\u9fff]/u
const LEADING_SUMMARY_VERB = /^(?:使用|通过|基于|面向|提供|构建|执行|用于|从|按|用|在|以|将|把)\s*/u
const CODE_TOKEN_PATTERN = /^(?:a|b|f|g|s|v)?\d+[a-z]?$/u
const SUMMARY_NAME_MAX_GRAPHEMES = 22
const CHINESE_GRAPHEMES = new Intl.Segmenter('zh-CN', { granularity: 'grapheme' })

const EXACT_NAMES: Readonly<Record<string, string>> = Object.freeze({
  'skill-a-share-market-risk-radar': 'A股市场风险雷达',
  'skill-a-share-pit-fundamental-vintage-builder': 'A股时点基本面数据构建器',
  'skill-ag-futures-seasonality': '农产品期货季节性分析',
  'skill-alpha-f5-member-position-concentration': '会员持仓集中度分析',
  'skill-a1-lhb-tracking': '龙虎榜跟踪',
  'skill-jq-to-panda-converter': '聚宽转 PandaAI 策略转换器',
  'agent-market-regime-monitor': '市场状态监控智能体',
})

const PHRASES: Readonly<Record<string, string>> = Object.freeze({
  'a-share': 'A股',
  'ag-futures': '农产品期货',
  'market-regime': '市场状态',
  'member-position': '会员持仓',
  'auto-stop-loss-take-profit': '自动止盈止损',
  'brinson-performance-attribution': 'Brinson 绩效归因',
  'capital-flow': '资金流',
  'dalio-all-weather': '达利欧全天候',
  'gaetano-crux': 'Gaetano / Crux',
  'gao-shanwen': '高善文',
  'northbound-margin': '北向与融资资金',
  'sec-edgar': 'SEC EDGAR',
  'smart-money': '聪明钱',
  'tearsheet-report': '绩效报告',
  'risk-radar': '风险雷达',
  'to-panda': '转 PandaAI',
})

const TOKENS: Readonly<Record<string, string>> = Object.freeze({
  a: 'A股',
  agent: '智能体',
  alpha: '因子',
  action: '行动',
  adjustment: '调整',
  ai: 'AI',
  alert: '预警',
  all: '全部',
  alphas: '因子',
  alpha101: 'Alpha101',
  alpha191: 'Alpha191',
  altdata: '另类数据',
  anomaly: '异常',
  analysis: '分析',
  analyzer: '分析器',
  analyst: '分析师',
  api: 'API',
  arbitrage: '套利',
  attribution: '归因',
  audit: '审计',
  auditor: '审计器',
  avoidance: '规避',
  backtest: '回测',
  backtesting: '回测',
  beta: 'Beta',
  bias: '偏差',
  blend: '融合',
  break: '突变',
  block: '模块',
  brief: '简报',
  brinson: 'Brinson',
  buffett: '巴菲特',
  builder: '构建器',
  build: '构建',
  buyback: '回购',
  calibration: '校准',
  calendar: '日历',
  capital: '资金',
  carry: 'Carry',
  catcher: '捕捉器',
  cb: '可转债',
  change: '变化',
  check: '检查',
  checkup: '体检',
  commodity: '商品',
  concept: '概念',
  concentration: '集中度分析',
  consensus: '共识',
  contrarian: '逆向',
  converter: '转换器',
  corporate: '公司',
  correlation: '相关性',
  cost: '成本',
  cross: '跨市场',
  crossover: '交叉',
  crowding: '拥挤度',
  crux: 'Crux',
  cta: 'CTA',
  daily: '每日',
  data: '数据',
  decay: '衰减',
  debate: '辩论',
  debug: '调试',
  decision: '决策',
  deepview: '深度观察',
  derivatives: '衍生品',
  directional: '方向性',
  dossier: '档案',
  dividend: '股息',
  divergence: '背离',
  dl: '深度学习',
  doc: '文档',
  driven: '驱动',
  earnings: '盈利',
  edgar: 'EDGAR',
  equity: '股票',
  ensemble: '集成',
  evaluate: '评估',
  evaluation: '评估',
  evaluator: '评估器',
  event: '事件',
  events: '事件',
  evidence: '证据',
  evolution: '演化',
  execution: '执行',
  experiment: '实验',
  exposure: '暴露',
  etf: 'ETF',
  factormad: 'FactorMAD',
  factor: '因子',
  factory: '工厂',
  family: '家族',
  fin: '金融',
  flow: '资金流',
  forecast: '预测',
  for: '',
  forward: '前向',
  fund: '基金',
  fundamental: '基本面',
  futures: '期货',
  fx: '外汇',
  gaetano: 'Gaetano',
  generation: '生成',
  generator: '生成器',
  global: '全球',
  gnn: '图神经网络',
  graham: '格雷厄姆',
  graph: '图谱',
  grouped: '分组',
  guided: '引导',
  harvester: '采集器',
  hk: '港股',
  holder: '持有人',
  hotmoney: '游资',
  hpo: '超参数优化',
  ic: 'IC',
  idea: '创意',
  index: '指数',
  insider: '内部人',
  institutional: '机构',
  intraday: '日内',
  investment: '投资',
  jq: '聚宽',
  keynes: '凯恩斯',
  klarman: '卡拉曼',
  lab: '实验室',
  leak: '泄漏',
  liangshuyuan: '量枢院',
  limitup: '涨停',
  liquidity: '流动性',
  listing: '上市',
  loss: '止损',
  lhb: '龙虎榜',
  ma: '均线',
  macro: '宏观',
  main: '主力',
  manager: '管理器',
  margin: '融资',
  market: '市场',
  mason: 'Mason',
  memory: '记忆',
  mental: '心智',
  metrics: '指标',
  microstructure: '微观结构',
  mine: '挖掘',
  miner: '挖掘器',
  mining: '挖掘',
  ml: '机器学习',
  moat: '护城河',
  model: '模型',
  monitor: '监控',
  momentum: '动量',
  money: '资金',
  munger: '芒格',
  ncav: '净流动资产价值',
  news: '新闻',
  nowcast: '即时预测',
  numerical: '数值',
  oil: '原油',
  online: '在线',
  opinion: '观点',
  optimize: '优化',
  option: '期权',
  options: '期权',
  orthogonalize: '正交化',
  overseas: '海外',
  overfit: '过拟合',
  oversold: '超卖',
  panda: 'PandaAI',
  pandaai: 'PandaAI',
  pandadata: 'PandaData',
  pair: '配对',
  pairs: '配对',
  paper: '论文',
  parity: '平价',
  pattern: '模式',
  pit: '时点',
  pnl: '盈亏',
  pool: '池',
  portfolio: '组合',
  position: '持仓',
  post: '盘后',
  profit: '止盈',
  profiler: '画像器',
  quality: '质量',
  quant: '量化',
  quantspace: 'QuantSpace',
  qbti: 'QBTI',
  quote: '报价',
  radar: '雷达',
  ranking: '排名',
  rates: '利率',
  rebalance: '再平衡',
  rebound: '反弹',
  refinancing: '再融资',
  regime: '状态',
  registry: '注册表',
  regulatory: '监管',
  replication: '复现',
  report: '报告',
  residual: '残差',
  return: '收益',
  reversal: '反转',
  reverse: '反向',
  review: '复盘',
  revision: '修正',
  roll: '滚动',
  rolling: '滚动',
  research: '研究',
  risk: '风险',
  rotation: '轮动',
  sage: 'SAGE',
  scan: '扫描',
  scanner: '扫描器',
  screener: '筛选器',
  seasonality: '季节性分析',
  season: '财报季',
  series: '序列',
  sector: '行业',
  sec: 'SEC',
  selection: '选择',
  serenity: 'Serenity',
  sentiment: '情绪',
  share: '股',
  signal: '信号',
  simons: '西蒙斯',
  skill: 'Skill',
  skew: '偏度',
  special: '特殊',
  ssquant: 'SSQuant',
  stability: '稳定性',
  stat: '统计',
  statistical: '统计',
  stock: '股票',
  strategy: '策略',
  stress: '压力',
  structure: '结构',
  study: '研究',
  survivorship: '幸存者偏差',
  situations: '机会',
  take: '',
  tasks: '任务',
  tearsheet: '绩效报告',
  template: '模板',
  term: '期限',
  test: '测试',
  time: '时间',
  to: '转',
  tracker: '跟踪器',
  tracking: '跟踪',
  trade: '交易',
  trader: '交易研究',
  trading: '交易',
  transaction: '交易',
  trend: '趋势',
  universe: '股票池',
  us: '美股',
  usa: '美国',
  valuation: '估值',
  validator: '验证器',
  vintage: '历史版本',
  vol: '波动率',
  volume: '成交量',
  walk: '步进',
  warehouse: '数据仓库',
  weather: '天气',
  workflow: '工作流',
  wrapper: '封装器',
  x: 'X平台',
  xingtai: '形态',
  yield: '收益率',
})

/** Catalog fields that may contribute to one immutable display-name projection. */
export interface QuantSkillsDisplayNameInput {
  readonly assetId: string
  readonly kind: QuantSkillsAssetKind
  readonly title?: string
  readonly titleZh?: string
  readonly titleEn?: string
  readonly aliases?: readonly string[]
  readonly summaryZh?: string
  readonly summaryEn?: string
  readonly nameSource?: QuantSkillsDisplayNameSource
}

/** Complete display metadata tied to one catalog asset id and commit. */
export interface ResolvedQuantSkillsDisplayName {
  readonly displayNames: QuantSkillsDisplayNames
  readonly aliases: readonly string[]
  readonly nameSource: QuantSkillsDisplayNameSource
}

/**
 * Resolve stable localized names during catalog intake.
 * @param input - validated catalog identity and optional publication metadata.
 * @returns localized names, searchable aliases, and their origin.
 */
export function resolveQuantSkillsDisplayName(
  input: QuantSkillsDisplayNameInput,
): ResolvedQuantSkillsDisplayName {
  const genericTitle = optionalText(input.title)
  const publishedZh = optionalText(input.titleZh)
    ?? (genericTitle !== undefined && containsHan(genericTitle) ? genericTitle : undefined)
  const publishedEn = optionalText(input.titleEn)
    ?? (genericTitle !== undefined && !containsHan(genericTitle) ? genericTitle : undefined)
  const generated = publishedZh ?? deriveChineseName(input.assetId, input.kind, input.summaryZh)
  const zhCN = generated ?? input.assetId
  const en = publishedEn ?? deriveEnglishName(input.assetId)
  const aliases = uniqueText([
    ...(input.aliases ?? []),
    ...(genericTitle === undefined || genericTitle === zhCN || genericTitle === en ? [] : [genericTitle]),
  ])
  const nameSource = publishedZh !== undefined
    ? input.nameSource ?? 'catalog'
    : generated !== undefined
      ? 'generated'
      : 'asset-id'
  return Object.freeze({
    displayNames: Object.freeze({ zhCN, ...(en === undefined ? {} : { en }) }),
    aliases: Object.freeze(aliases),
    nameSource,
  })
}

/**
 * Read the first Chinese Markdown H1 from an installed declaration.
 * @param declaration - exact installed `SKILL.md` or `AGENTS.md` text.
 * @returns normalized Chinese heading, or undefined when the H1 is absent or English-only.
 */
export function extractChineseDeclarationTitle(declaration: string): string | undefined {
  for (const line of declaration.split(/\r?\n/u)) {
    const match = /^#\s+(.+?)\s*$/u.exec(line)
    if (match === null) continue
    const heading = match[1]?.replace(/\s*[（(][^()（）]*[）)]\s*$/u, '').trim()
    return heading !== undefined && heading !== '' && containsHan(heading) ? heading : undefined
  }
  return undefined
}

function deriveChineseName(assetId: string, kind: QuantSkillsAssetKind, summaryZh?: string): string | undefined {
  const exact = EXACT_NAMES[assetId]
  if (exact !== undefined) return exact
  const translated = translateAssetId(assetId, kind)
  if (translated !== undefined) return translated
  const summary = optionalText(summaryZh)
  if (summary === undefined || !containsHan(summary)) return undefined
  const clause = summary
    .replace(/[`*_#]/gu, '')
    .split(/[，。；;：:\n]/u, 1)[0]
    ?.replace(LEADING_SUMMARY_VERB, '')
    .trim()
  if (clause === undefined || clause === '' || !containsHan(clause)) return undefined
  const shortened = Array.from(CHINESE_GRAPHEMES.segment(clause), entry => entry.segment)
    .slice(0, SUMMARY_NAME_MAX_GRAPHEMES)
    .join('')
    .trim()
  if (kind === 'agent' && !/(?:智能体|助手|Agent)$/u.test(shortened)) return `${shortened}智能体`
  return shortened
}

function translateAssetId(assetId: string, kind: QuantSkillsAssetKind): string | undefined {
  const prefix = `${kind}-`
  const source = assetId.startsWith(prefix) ? assetId.slice(prefix.length) : assetId
  const parts = source.split('-')
  const translated: string[] = []
  for (let index = 0; index < parts.length;) {
    const five = parts.slice(index, index + 5).join('-')
    const four = parts.slice(index, index + 4).join('-')
    const three = parts.slice(index, index + 3).join('-')
    const two = parts.slice(index, index + 2).join('-')
    const phrase = PHRASES[five] ?? PHRASES[four] ?? PHRASES[three] ?? PHRASES[two]
    if (phrase !== undefined) {
      translated.push(phrase)
      index += PHRASES[five] === phrase ? 5 : PHRASES[four] === phrase ? 4 : PHRASES[three] === phrase ? 3 : 2
      continue
    }
    const token = parts[index]
    if (token === undefined) break
    if (CODE_TOKEN_PATTERN.test(token)) {
      index += 1
      continue
    }
    const value = TOKENS[token]
    if (value === undefined) return undefined
    if (value === '') {
      index += 1
      continue
    }
    translated.push(value)
    index += 1
  }
  if (translated.length === 0) return undefined
  const title = translated.join('').replace(/智能体智能体$/u, '智能体')
  return kind === 'agent' && !title.endsWith('智能体') ? `${title}智能体` : title
}

function deriveEnglishName(assetId: string): string | undefined {
  const source = assetId.replace(/^(?:skill|agent)-/u, '')
  if (source === '') return undefined
  return source.split('-').map(token => token === 'a' ? 'A' : token.toUpperCase() === token
    ? token
    : `${token.slice(0, 1).toUpperCase()}${token.slice(1)}`).join(' ')
}

function optionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized === undefined || normalized === '' ? undefined : normalized
}

function uniqueText(values: readonly string[]): string[] {
  const result: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const normalized = value.trim()
    if (normalized === '' || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }
  return result
}

function containsHan(value: string): boolean {
  return HAN_PATTERN.test(value)
}
