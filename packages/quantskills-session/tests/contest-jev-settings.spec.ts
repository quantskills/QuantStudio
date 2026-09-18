import type { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { configureJev, jevSettings } from '../src/contest-jev-settings.ts'

function fixture() {
  let saved = 'old-private-key'
  const credentials = { describe: vi.fn(async () => ({ configured: Boolean(saved), writable: true })),
    resolve: vi.fn(async () => ({ value: saved })), set: vi.fn(async (_ref: unknown, key: string) => { saved = key }) }
  const ctx = { get: () => credentials } as unknown as Context
  const request = vi.fn<typeof fetch>(async () => Response.json({ model: 'jev-1.13.0', answers: { connection: {
    type: 'choice', choice: 'ready', confidence: 1, probabilities: { ready: 1, unavailable: 0 },
  } } }))
  return { ctx, credentials, request }
}
describe('Jev user configuration', () => {
  it('tests a supplied key before saving and returns only safe status fields', async () => {
    const f = fixture()
    expect(await jevSettings(f.ctx)).toEqual({ configured: true, writable: true, model: 'jev-1.13.0' })
    const result = await configureJev(f.ctx, { apiKey: 'new-private-key' }, f.request)
    expect(f.credentials.set).toHaveBeenCalledWith('TYPESAFE_API_KEY', 'new-private-key')
    expect(f.request.mock.invocationCallOrder[0]).toBeLessThan(f.credentials.set.mock.invocationCallOrder[0]!)
    expect(JSON.stringify(result)).not.toContain('private-key')
    expect(result).toMatchObject({ configured: true, testedAt: expect.any(Number), latencyMs: expect.any(Number) })
    expect(f.request.mock.calls[0]?.[1]?.body).not.toContain('private-key')
    expect(f.request.mock.calls[0]?.[0]).toBe('https://api.typesafe.ai/v1/systemone')
    expect(f.request.mock.calls[0]?.[1]?.redirect).toBe('error')
  })
  it('tests an existing connection without writing or revealing its key', async () => {
    const f = fixture(); const result = await configureJev(f.ctx, {}, f.request)
    expect(f.credentials.set).not.toHaveBeenCalled()
    expect(result.message).toContain('已保存')
    expect(JSON.stringify(result)).not.toContain('old-private-key')
  })
  it('preserves the old key and sanitizes upstream and storage errors', async () => {
    const f = fixture()
    f.request.mockResolvedValueOnce(new Response('secret echoed upstream', { status: 401 }))
    await expect(configureJev(f.ctx, { apiKey: 'replacement' }, f.request)).rejects.toThrow('HTTP 401')
    expect(f.credentials.set).not.toHaveBeenCalled()
    f.request.mockRejectedValueOnce(new Error('secret echoed upstream'))
    await expect(configureJev(f.ctx, { apiKey: 'replacement' }, f.request)).rejects.toThrow('连接失败或超时')
    f.credentials.set.mockRejectedValueOnce(new Error('secret echoed by provider'))
    await expect(configureJev(f.ctx, { apiKey: 'replacement' }, f.request)).rejects.toThrow('密钥未能保存')
  })
  it('rejects blank keys, read-only storage and malformed responses', async () => {
    const f = fixture()
    await expect(configureJev(f.ctx, { apiKey: ' ' }, f.request)).rejects.toThrow('有效的 Jev API Key')
    expect(f.request).not.toHaveBeenCalled()
    f.credentials.describe.mockResolvedValueOnce({ configured: true, writable: false })
    await expect(configureJev(f.ctx, { apiKey: 'replacement' }, f.request)).rejects.toThrow('只读配置')
    expect(f.request).not.toHaveBeenCalled()
    f.request.mockResolvedValueOnce(Response.json({ model: 'unknown' }))
    await expect(configureJev(f.ctx, { apiKey: 'replacement' }, f.request)).rejects.toThrow('有效的连接测试结果')
    expect(f.credentials.set).not.toHaveBeenCalled()
  })
})
