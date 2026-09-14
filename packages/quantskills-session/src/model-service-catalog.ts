import type { ModelRecommendationRole, ModelServiceDefinition, ModelServiceRecommendation } from './model-access-types.ts'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'

const checkedAt = '2026-09-06'
const recommendation = (name: string, roles: ModelRecommendationRole[], summary: string, source: string,
  options: Pick<ModelServiceRecommendation, 'exactId' | 'lifecycle'> = { exactId: true, lifecycle: 'stable' }): ModelServiceRecommendation => ({
  name, roles, summary, source, checkedAt, exactId: options.exactId,
  ...(options.lifecycle === undefined ? {} : { lifecycle: options.lifecycle }),
})

/** Official endpoint and public model-directory contracts checked 2026-09-06. No credentials or inferred prices. */
export const MODEL_SERVICES: ModelServiceDefinition[] = [
  { id: 'openai', name: 'OpenAI', api: 'openai-responses', discovery: true,
    variants: [{ id: 'global', name: 'API', baseURL: 'https://api.openai.com/v1', catalogProvider: 'openai' }],
    docs: 'https://developers.openai.com/api/docs/models', recommendations: [
      recommendation('gpt-5.6-luna', ['economy', 'low-latency'], '低延迟、成本敏感的日常任务候选。', 'https://developers.openai.com/api/docs/models'),
      recommendation('gpt-5.6-terra', ['balanced', 'coding'], '通用开发与标准任务候选。', 'https://developers.openai.com/api/docs/models'),
      recommendation('gpt-5.6-sol', ['frontier', 'coding', 'long-context'], '复杂开发与长上下文候选。', 'https://developers.openai.com/api/docs/models'),
      recommendation('gpt-6-astra', ['frontier', 'coding', 'vision', 'long-context'], '最高强度复杂任务候选。', 'https://developers.openai.com/api/docs/models'),
    ] },
  { id: 'anthropic', name: 'Anthropic', api: 'anthropic-messages', discovery: true,
    variants: [{ id: 'global', name: 'API', baseURL: 'https://api.anthropic.com', catalogProvider: 'anthropic' }],
    docs: 'https://platform.claude.com/docs/en/about-claude/models/overview', recommendations: [
      recommendation('claude-haiku-4-5-20251001', ['economy', 'low-latency'], '快速日常任务候选。', 'https://platform.claude.com/docs/en/about-claude/models/overview'),
      recommendation('claude-sonnet-5', ['balanced', 'coding', 'vision', 'long-context'], '通用开发与分析候选。', 'https://platform.claude.com/docs/en/about-claude/models/overview'),
      recommendation('claude-opus-5', ['frontier', 'coding', 'vision', 'long-context'], '复杂推理与开发候选。', 'https://platform.claude.com/docs/en/about-claude/models/overview'),
    ] },
  { id: 'google', name: 'Google', api: 'openai-completions', discovery: true,
    variants: [{ id: 'global', name: 'Gemini API', baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai', catalogProvider: 'google' }],
    docs: 'https://ai.google.dev/gemini-api/docs/openai', recommendations: [
      recommendation('gemini-3.8-flash', ['balanced', 'coding', 'vision', 'long-context', 'low-latency'], '多模态和长上下文的快速候选。', 'https://ai.google.dev/gemini-api/docs/models'),
    ] },
  { id: 'deepseek', name: 'DeepSeek', api: 'openai-completions', discovery: true,
    variants: [{ id: 'global', name: 'API', baseURL: 'https://api.deepseek.com/v1', catalogProvider: 'deepseek' }],
    docs: 'https://api-docs.deepseek.com/api/list-models', recommendations: [
      recommendation('deepseek-v4-flash', ['economy', 'coding', 'low-latency'], '快速开发与日常任务候选。', 'https://api-docs.deepseek.com/quick_start/pricing/'),
      recommendation('deepseek-v4-pro', ['frontier', 'coding', 'long-context'], '复杂开发与分析候选。', 'https://api-docs.deepseek.com/quick_start/pricing/'),
      recommendation('deepseek-v4-flash-vision-exp', ['economy', 'vision', 'coding', 'low-latency'], '实验性经济型视觉任务候选。', 'https://api-docs.deepseek.com/quick_start/pricing/', { exactId: true, lifecycle: 'experimental' }),
    ] },
  { id: 'qwen', name: '通义千问', api: 'openai-completions', discovery: true,
    variants: [
      { id: 'cn', name: '中国内地 · 按量 API', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
      { id: 'sg', name: '新加坡 · 按量 API', baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1' },
    ], docs: 'https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope', recommendations: [
      recommendation('qwen3-coder-next', ['economy', 'coding'], '代码任务候选。', 'https://help.aliyun.com/zh/model-studio/models'),
      recommendation('qwen3.7-plus', ['balanced', 'coding', 'vision', 'long-context'], '通用、多模态和长上下文候选。', 'https://help.aliyun.com/zh/model-studio/models'),
    ] },
  { id: 'doubao', name: '豆包', api: 'openai-completions', discovery: false,
    variants: [{ id: 'cn', name: '火山方舟 · 北京', baseURL: 'https://ark.cn-beijing.volces.com/api/v3' }],
    docs: 'https://www.volcengine.com/docs/82379/2549861', recommendations: [
      recommendation('Doubao-Seed-2.1-pro', ['frontier', 'coding', 'vision', 'long-context'], '厂商模型系列；实际调用需填写火山方舟推理接入点 ID。', 'https://www.volcengine.com/docs/82379/2549861', { exactId: false, lifecycle: 'stable' }),
      recommendation('Doubao-Seed-2.1-lite', ['economy', 'balanced', 'low-latency'], '厂商模型系列；实际调用需填写火山方舟推理接入点 ID。', 'https://www.volcengine.com/docs/82379/2549861', { exactId: false, lifecycle: 'stable' }),
    ] },
  { id: 'zhipu', name: '智谱', api: 'openai-completions', discovery: false,
    variants: [{ id: 'cn', name: '通用 API（非 Coding 套餐）', baseURL: 'https://open.bigmodel.cn/api/paas/v4' }],
    docs: 'https://docs.bigmodel.cn/cn/guide/develop/http/introduction', recommendations: [
      recommendation('glm-5.1-highspeed', ['balanced', 'coding', 'low-latency'], '低延迟开发候选。', 'https://docs.bigmodel.cn/cn/guide/start/model-overview'),
      recommendation('glm-5.2', ['frontier', 'coding', 'long-context'], '复杂开发与分析候选。', 'https://docs.bigmodel.cn/cn/guide/start/model-overview'),
    ] },
  { id: 'moonshot', name: 'Moonshot / Kimi', api: 'openai-completions', discovery: true,
    variants: [
      { id: 'cn', name: '中国内地 API', baseURL: 'https://api.moonshot.cn/v1', catalogProvider: 'moonshotai-cn' },
      { id: 'coding-cn', name: 'Kimi Code 会员 API', baseURL: 'https://api.kimi.com/coding/v1' },
    ],
    docs: 'https://www.kimi.com/code/docs/en/kimi-code/models.html', recommendations: [
      recommendation('kimi-k2.6', ['frontier', 'coding', 'vision', 'long-context'], '复杂开发、多模态和长上下文候选。', 'https://platform.kimi.com/docs/models'),
      recommendation('k3', ['frontier', 'coding', 'vision', 'long-context'], 'Kimi Code 复杂开发、多模态和超长上下文候选。', 'https://www.kimi.com/code/docs/en/kimi-code/models.html'),
      recommendation('k3-256k', ['balanced', 'coding', 'vision', 'long-context'], 'Kimi Code 标准开发、多模态和长上下文候选。', 'https://www.kimi.com/code/docs/en/kimi-code/models.html'),
      recommendation('kimi-for-coding', ['balanced', 'coding', 'vision'], 'Kimi Code 通用开发候选，固定开启思考。', 'https://www.kimi.com/code/docs/en/kimi-code/models.html'),
      recommendation('kimi-for-coding-highspeed', ['economy', 'coding', 'vision', 'low-latency'], 'Kimi Code 低延迟开发候选，固定开启思考。', 'https://www.kimi.com/code/docs/en/kimi-code/models.html'),
    ] },
  { id: 'minimax', name: 'MiniMax', api: 'anthropic-messages', discovery: true,
    variants: [
      { id: 'cn', name: '中国内地（API / Token Plan）', baseURL: 'https://api.minimaxi.com/anthropic', catalogProvider: 'minimax-cn' },
      { id: 'global', name: '国际（API / Token Plan）', baseURL: 'https://api.minimax.io/anthropic', catalogProvider: 'minimax' },
    ], docs: 'https://platform.minimax.io/docs/api-reference/models/anthropic/list-models', recommendations: [
      recommendation('MiniMax-M2.7-highspeed', ['economy', 'coding', 'low-latency'], '快速开发候选。', 'https://platform.minimax.io/docs/release-notes/models'),
      recommendation('MiniMax-M2.7', ['economy', 'balanced', 'coding', 'long-context'], '经济型标准开发与长上下文候选。', 'https://platform.minimax.io/docs/release-notes/models'),
      recommendation('MiniMax-M3', ['frontier', 'coding', 'vision', 'long-context'], '复杂开发与多模态候选。', 'https://platform.minimax.io/docs/release-notes/models'),
    ] },
  { id: 'custom', name: '自定义兼容服务', api: 'openai-completions', discovery: true, variants: [], docs: '' },
]

/**
 * Trusted capability declarations that a bare `/models` response cannot carry.
 * MiniMax M3 uses adaptive thinking on the wire. The product keeps its common
 * strength vocabulary so users can choose a portable intent while the provider
 * adapter performs the vendor-specific mapping.
 */
export function isKimiCodeEndpoint(api: string, baseURL: string | undefined): boolean {
  if (api !== 'openai-completions' || !baseURL) return false
  try {
    const url = new URL(baseURL)
    return url.protocol === 'https:' && url.hostname === 'api.kimi.com'
      && url.pathname.replace(/\/+$/, '') === '/coding/v1'
      && !url.username && !url.password && !url.search && !url.hash
  } catch { return false }
}

const KIMI_CODE_IDS = new Set(['k3', 'k3-256k', 'kimi-for-coding', 'kimi-for-coding-highspeed'])

/** Default route strength for an official endpoint whose documented models reason by default. */
export function suggestedRouteReasoning(api: string, baseURL: string | undefined, ids: readonly string[]): string | undefined {
  return isKimiCodeEndpoint(api, baseURL) && ids.some(id => KIMI_CODE_IDS.has(id)) ? 'high' : undefined
}

export function suggestedModelProfile(service: string, api: string, id: string, baseURL?: string): Record<string, JsonValue> {
  const recommendation = MODEL_SERVICES.find(item => item.id === service)?.recommendations
    ?.find(item => item.exactId && item.name === id)
  // Kimi Code capabilities belong to its dedicated membership endpoint, not
  // every Moonshot-compatible endpoint that happens to return the same ID.
  const trustedInput = recommendation?.roles.includes('vision') === true && !KIMI_CODE_IDS.has(id) ? ['text', 'image'] : undefined
  if (isKimiCodeEndpoint(api, baseURL) && (id === 'k3' || id === 'k3-256k')) return {
    id,
    contextWindow: id === 'k3' ? 1_048_576 : 262_144,
    input: ['text', 'image'],
    reasoningEfforts: { off: 'none', low: 'low', medium: 'high', high: 'high', xhigh: 'max', max: 'max' },
    compat: { supportsReasoningEffort: true },
  }
  if (isKimiCodeEndpoint(api, baseURL) && (id === 'kimi-for-coding' || id === 'kimi-for-coding-highspeed')) return {
    id,
    contextWindow: 262_144,
    input: ['text', 'image'],
    reasoningEfforts: { high: 'high' },
    // K2.7 Code is always-thinking. Expose that state to selectors without
    // inventing K3's adjustable reasoning_effort wire contract for this model.
    compat: { supportsReasoningEffort: false },
  }
  if (service === 'minimax' && api === 'anthropic-messages' && id === 'MiniMax-M3') return {
    id,
    input: ['text', 'image'],
    reasoningEfforts: { off: null, low: 'low', medium: 'medium', high: 'high', max: 'max' },
    compat: { forceAdaptiveThinking: true },
  }
  if (service === 'minimax' && api === 'anthropic-messages' && /^MiniMax-M2(?:\.\d+)?(?:-highspeed)?$/.test(id)) return {
    id,
    input: ['text'],
    reasoningEfforts: { max: 'max' },
  }
  return { id, ...(trustedInput === undefined ? {} : { input: trustedInput }) }
}
