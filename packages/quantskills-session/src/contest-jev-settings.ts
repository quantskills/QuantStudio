import type { Context } from '@deepseek-ai/cordis'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { z } from 'zod'
import type { ContestJevSettings } from './contest-watch-types.ts'
import { readTranslator, saveTranslator, translationModels, type JevTranslator } from './contest-jev-english.ts'

const ref = credentialRef('TYPESAFE_API_KEY')
const model = 'jev-1.13.0'

export async function jevSettings(ctx: Context, root?: string): Promise<ContestJevSettings> {
  let configured = false, writable = false
  try {
    const info = await ctx.get('credentials')?.describe(ref)
    configured = info?.configured ?? false; writable = info?.writable ?? false
  } catch { throw new Error('无法读取 Jev 配置，请检查本机凭据服务。') }
  return { configured, writable, model, ...(root ? { translator: await readTranslator(root), translationModels: translationModels(ctx) } : {}) }
}

/** A supplied key is saved only after a real, synthetic connection test succeeds. */
export async function configureJev(ctx: Context, input: { apiKey?: string; translator?: JevTranslator }, request: typeof fetch = fetch, root?: string): Promise<ContestJevSettings> {
  const parsed = z.object({ apiKey: z.string().trim().min(1).max(4096).regex(/^[^\s\x00-\x1f\x7f]+$/).optional(), translator: z.object({ provider: z.string(), model: z.string() }).strict().optional() }).strict().safeParse(input)
  if (!parsed.success) throw new Error('请填写有效的 Jev API Key，不含空格或换行。')
  if (parsed.data.translator) {
    if (!root || parsed.data.apiKey) throw new Error('请单独保存翻译模型。')
    await saveTranslator(ctx, root, parsed.data.translator)
    return { ...await jevSettings(ctx, root), message: '专用翻译模型已保存；不会修改 Auto 开关。' }
  }
  const settings = await jevSettings(ctx, root), provider = ctx.get('credentials')
  if (!provider) throw new Error('本机凭据服务不可用。')
  if (parsed.data.apiKey && !settings.writable) throw new Error('当前密钥来自只读配置，请在对应环境变量中修改。')
  let key = parsed.data.apiKey
  if (!key) {
    try { key = (await provider.resolve(ref))?.value } catch { throw new Error('无法读取已保存的 Jev 密钥。') }
  }
  if (!key) throw new Error('请先填写 Jev API Key。')
  const started = Date.now()
  let response: Response
  try {
    response = await request('https://api.typesafe.ai/v1/systemone', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, state: { purpose: 'Synthetic connection test. No account or market data.' },
        questions: { connection: { type: 'choice', instructions: 'For this connection test, select ready.', criteria: { ready: 'Connection test received.', unavailable: 'Unable to answer the test.' } } } }),
    })
  } catch { throw new Error('Jev 连接失败或超时，请检查网络后重试。') }
  if (!response.ok) throw new Error(`Jev 测试失败（HTTP ${response.status}），请检查密钥、额度或稍后重试。`)
  let body: unknown
  try { body = await response.json() } catch { throw new Error('Jev 测试响应无法解析。') }
  const result = z.object({ model: z.literal(model), answers: z.object({ connection: z.object({ type: z.literal('choice'), choice: z.literal('ready'),
    confidence: z.number().min(0).max(1), probabilities: z.object({ ready: z.number().min(0).max(1), unavailable: z.number().min(0).max(1) }) }) }) }).safeParse(body)
  if (!result.success) throw new Error('Jev 未返回有效的连接测试结果。')
  if (parsed.data.apiKey) {
    try { await provider.set(ref, parsed.data.apiKey) } catch { throw new Error('连接成功，但密钥未能保存；请检查本机凭据库。') }
  }
  return { ...await jevSettings(ctx, root), testedAt: Date.now(), latencyMs: Date.now() - started,
    message: parsed.data.apiKey ? '连接成功，密钥已保存到本机。' : '已保存的 Jev 连接测试成功。' }
}
