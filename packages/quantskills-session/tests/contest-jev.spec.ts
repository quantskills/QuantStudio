import type { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { evaluateContestWithJev } from '../src/contest-jev.ts'
import type { ContestService } from '../src/contest-service.ts'

const identity = { accountId: 'test-account', contestId: 'test-contest' }
const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })
const input = { evidence: 'Synthetic test: current quote only; historical data and risk limits are missing.', proposal: 'Consider one long futures contract; no user authorization.' }
const response = () => ({ model: 'jev-1.13.0', answers: {
  evidence: { type: 'choice', choice: 'incomplete', confidence: 0.9, probabilities: { sufficient: 0.01, incomplete: 0.98, conflicting: 0.01 } },
  support: { type: 'score', score: 0.2, confidence: 0.7, probabilities: { '0': 0.8, '1': 0.2, '2': 0, '3': 0 } },
  risk: { type: 'noul', noul: 0.95 },
}, usage: { input_tokens: 800, output_tokens: 100 }, secret: 'must be stripped' })
function fixture() {
  const resolve = vi.fn(async () => ({ value: 'test-secret-never-print' }))
  const ctx = { get: () => ({ resolve }) } as unknown as Context
  const inspect = vi.fn(async () => ({ fetchedAt: Date.now(), account: { data: { equity: 1000000 } }, positions: { data: [] }, openOrders: { data: [] } }))
  const researchIdentity = vi.fn(async () => identity)
  const root = mkdtempSync(join(tmpdir(), 'jev-research-')); roots.push(root)
  const contest = { root, inspect, researchIdentity } as unknown as ContestService
  const request = vi.fn<typeof fetch>(async () => Response.json(response()))
  const controller = new AbortController()
  const evaluate = () => evaluateContestWithJev(ctx, contest, identity, input, controller.signal, request)
  return { ctx, contest, inspect, researchIdentity, resolve, request, controller, evaluate }
}

describe('Jev futures research evaluation', () => {
  it('sends a fresh bound-account snapshot only to TypeSafe, and returns validated research results', async () => {
    const f = fixture(), result = await f.evaluate()
    expect(f.inspect).toHaveBeenCalledWith(identity, f.controller.signal)
    expect(f.resolve).toHaveBeenCalledWith('TYPESAFE_API_KEY')
    const [url, options] = f.request.mock.calls[0]!
    expect(url).toBe('https://api.typesafe.ai/v1/systemone')
    expect(options).toMatchObject({ redirect: 'error', method: 'POST', headers: { Authorization: 'Bearer test-secret-never-print' } })
    const sent = JSON.parse(options!.body as string)
    expect(sent).toMatchObject({ model: 'jev-1.13.0', state: { ...input, account: { equity: 1000000 } } })
    expect(sent.questions).toHaveProperty('risk')
    expect(options!.body).not.toContain('test-secret')
    expect(options!.body).not.toContain('test-account')
    expect(result.answers.evidence.choice).toBe('incomplete')
    expect(result.note).toContain('不是交易胜率')
    expect(result).not.toHaveProperty('secret')
    expect(f.researchIdentity).toHaveBeenCalledWith(identity)
  })
  it('refuses disabled, disconnected or mismatched accounts before contacting TypeSafe', async () => {
    const f = fixture()
    f.inspect.mockRejectedValue(new Error('比赛模式已关闭'))
    await expect(f.evaluate()).rejects.toThrow('比赛模式已关闭')
    expect(f.request).not.toHaveBeenCalled()
  })
  it('discards a result if the bound account becomes invalid during evaluation', async () => {
    const f = fixture()
    f.researchIdentity.mockRejectedValue(new Error('比赛账户已切换'))
    await expect(f.evaluate()).rejects.toThrow('比赛账户已切换')
  })
  it('rejects unconfigured credentials and hides credential provider errors', async () => {
    const f = fixture()
    f.resolve.mockResolvedValue({ value: '' })
    await expect(f.evaluate()).rejects.toThrow('尚未配置 Jev')
    f.resolve.mockRejectedValue(new Error('test-secret-never-print'))
    await expect(f.evaluate()).rejects.toThrow('无法读取 Jev 凭据')
    expect(f.inspect).not.toHaveBeenCalled()
    expect(f.request).not.toHaveBeenCalled()
  })
  it('does not echo upstream error bodies or network errors', async () => {
    const f = fixture()
    f.request.mockResolvedValue(new Response('test-secret-never-print', { status: 401 }))
    await expect(f.evaluate()).rejects.toThrow('Jev 请求失败（HTTP 401）')
    f.request.mockRejectedValue(new Error('test-secret-never-print'))
    await expect(f.evaluate()).rejects.toThrow('Jev 连接失败')
  })
  it.each(['missing', 'out-of-range', 'bad-distribution'])('rejects %s answers rather than suggesting an action', async kind => {
    const f = fixture(), body = response()
    if (kind === 'missing') delete (body.answers as Partial<typeof body.answers>).risk
    if (kind === 'out-of-range') body.answers.support.score = 99
    if (kind === 'bad-distribution') body.answers.evidence.probabilities.incomplete = 0.1
    f.request.mockResolvedValue(Response.json(body))
    await expect(f.evaluate()).rejects.toThrow('无效的评估结果')
  })
  it('rejects oversized input before querying or transmitting account data', async () => {
    const f = fixture()
    await expect(evaluateContestWithJev(f.ctx, f.contest, identity, { ...input, evidence: 'x'.repeat(12001) }, f.controller.signal, f.request)).rejects.toThrow('最多 12000')
    expect(f.inspect).not.toHaveBeenCalled()
    expect(f.request).not.toHaveBeenCalled()
  })
  it('propagates cancellation to the request and never returns the late response', async () => {
    const f = fixture()
    f.request.mockImplementation(async (_url, options) => {
      f.controller.abort()
      expect(options!.signal!.aborted).toBe(true)
      return Response.json(response())
    })
    await expect(f.evaluate()).rejects.toThrow()
    expect(f.researchIdentity).not.toHaveBeenCalled()
  })
})
