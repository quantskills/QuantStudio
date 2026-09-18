import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { englishJevBody, englishJevInput, readTranslator, saveTranslator } from '../src/contest-jev-english.ts'
import { decideWithJev } from '../src/contest-watch.ts'
import { watchAssessments } from '../src/contest-watch-evaluation.ts'
import { configureJev } from '../src/contest-jev-settings.ts'
import { makeTemplate, rangeTemplate } from '../../ui-quantskills/src/client/jev-templates.ts'

const roots: string[] = [], route = { provider: 'verified-route', model: 'DeepSeek-V4-Flash' }
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })
async function fixture(output = '["Only trade RB2610, no more than 1 lot.","Close long below 3000."]') {
  const root = await mkdtemp(join(tmpdir(), 'jev-english-')); roots.push(root)
  const policy = { service: 'custom', auto: false, state: 'verified', verifiedModels: [route.model] }
  const stream = vi.fn(async function* () { yield { type: 'text-delta', text: output }; yield { type: 'finish', reason: { kind: 'stop' } } })
  const ctx = { get: (name: string) => name === 'settings' ? { get: () => ({ connections: { [route.provider]: policy } }) } : { describe: async () => ({ configured: true, writable: true }), resolve: async () => ({ value: 'test-secret' }) }, llm: { stream } } as unknown as Context
  return { root, ctx, stream, policy }
}
describe('English-only Jev input', () => {
  it('sends all three builtins in English including every action and check without a translation request', async () => {
    const f = await fixture()
    for (const kind of ['range', 'trend', 'breakout'] as const) {
      const config = makeTemplate(kind, rangeTemplate('ag2612'))
      const answers = Object.fromEntries(Object.entries(watchAssessments).map(([key, question]) => {
        const keys = Object.keys(question.criteria)
        return [key, { type: 'choice', choice: keys[0], confidence: 1, probabilities: Object.fromEntries(keys.map((value, i) => [value, i ? 0 : 1])) }]
      }))
      const request = vi.fn<typeof fetch>(async () => Response.json({ model: 'jev-1.13.0', answers: { ...answers, action: { type: 'choice', choice: 'hold', confidence: 1, probabilities: { hold: 1 } } } }))
      await decideWithJev(f.ctx, config, [], { equity: 1000000, volume: 0, closable: 0, direction: 'flat', allowed: ['hold', 'open_long', 'open_short'], hasOpenOrders: false, fetchedAt: Date.now() }, new AbortController().signal, request)
      const body = request.mock.calls[0]![1]!.body as string, payload = JSON.parse(body)
      expect(body).not.toMatch(/\p{Script=Han}/u)
      expect(Object.keys(payload.state.strategy.actionCriteria)).toHaveLength(5)
      expect(payload.state.planPolicy.minConfidence).toBe(.8)
      expect(payload.state.hardLimits).not.toHaveProperty('minPlanConfidence')
      expect(config.instructions).toContain('自主模式')
    }
    expect(f.stream).not.toHaveBeenCalled()
  })
  it('translates custom text once per content and selected model while retaining originals and Auto=false', async () => {
    const f = await fixture(), source = { instructions: '只交易 RB2610，不超过 1 手。', criteria: ['低于 3000 平多。'], timestamp: 123 }
    await saveTranslator(f.ctx, f.root, route)
    expect(await readTranslator(f.root)).toEqual(route)
    const result = await englishJevInput(f.ctx, source, new AbortController().signal, f.root)
    expect(result).toEqual({ instructions: 'Only trade RB2610, no more than 1 lot.', criteria: ['Close long below 3000.'], timestamp: 123 })
    expect(source.instructions).toContain('不超过'); expect(f.policy.auto).toBe(false)
    expect(f.stream).toHaveBeenCalledWith(expect.objectContaining(route))
    await englishJevInput(f.ctx, source, new AbortController().signal, f.root)
    expect(f.stream).toHaveBeenCalledOnce()
  })
  it.each(['["只观望"]', '["Trade 10 lots."]', 'not json', '["Hold", "Extra"]'])('rejects invalid or numerically changed translations: %s', async output => {
    const f = await fixture(output); await saveTranslator(f.ctx, f.root, route)
    await expect(englishJevInput(f.ctx, { text: '最多 1 手' }, new AbortController().signal, f.root)).rejects.toThrow('本轮未请求 Jev')
  })
  it('requires explicit translation selection and revalidates the selected route', async () => {
    const f = await fixture()
    await expect(englishJevInput(f.ctx, '用户中文', new AbortController().signal, f.root)).rejects.toThrow('专用翻译模型')
    await saveTranslator(f.ctx, f.root, route); f.policy.state = 'failed'
    await expect(englishJevInput(f.ctx, '用户中文', new AbortController().signal, f.root)).rejects.toThrow('专用翻译模型')
    expect(f.stream).not.toHaveBeenCalled()
    expect(() => englishJevBody({ evidence: '遗漏中文' })).toThrow('未转换')
  })
  it('persists dedicated translation selection without a TypeSafe request', async () => {
    const f = await fixture(), request = vi.fn<typeof fetch>()
    const result = await configureJev(f.ctx, { translator: route }, request, f.root)
    expect(result.translator).toEqual(route)
    expect(result.translationModels).toContainEqual(route)
    expect(f.policy.auto).toBe(false)
    expect(request).not.toHaveBeenCalled()
  })
  it('honors cancellation and never returns an untranslated fallback', async () => {
    const f = await fixture(), controller = new AbortController(); controller.abort()
    await expect(englishJevInput(f.ctx, '中文', controller.signal)).rejects.toThrow()
    expect(f.stream).not.toHaveBeenCalled()
  })
})
