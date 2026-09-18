import { describe, expect, it, vi } from 'vitest'
import { QuantSkillsModelAccess, modelDiscoveryRequest } from '../src/model-access.ts'
import { isKimiCodeEndpoint, MODEL_SERVICES, suggestedModelProfile } from '../src/model-service-catalog.ts'
import { modelAllowedForAuto, MODEL_ACCESS_NS } from '../src/model-access-settings.ts'
import type { ModelConnectionDraft } from '../src/model-access-types.ts'

function harness(response: () => Promise<Response> = async () => Response.json({ data: [{ id: 'model-a' }] })) {
  const docs: Record<string, any> = { 'llm-pi-ai': { providers: { minimax: {
    apiKeyEnv: 'EXISTING_KEY', displayName: 'MiniMax', api: 'anthropic-messages', baseURL: 'https://api.minimaxi.com/anthropic',
    models: [{ id: 'model-a', input: ['text', 'image'], reasoningEfforts: ['low'] }],
  } } }, [MODEL_ACCESS_NS]: { connections: {} } }
  const secrets = new Map([['EXISTING_KEY', 'private-secret']])
  const mutate = vi.fn(async (ns: string, ops: any[]) => { for (const op of ops) {
    const [section, route] = op.path
    if (op.op === 'unset') delete docs[ns][section][route]
    else docs[ns][section][route] = op.value
  } })
  const ctx: any = {
    inject: (_: unknown, cb: any) => cb(ctx),
    settings: { register: vi.fn(), get: (ns: string) => docs[ns], mutate },
    credentials: { describe: async (ref: string) => ({ configured: secrets.has(ref) }), resolve: async (ref: string) => ({ value: secrets.get(ref) }),
      set: async (ref: string, value: string) => { secrets.set(ref, value) }, unset: async (ref: string) => { secrets.delete(ref) } },
    llm: { listModels: async () => [], stream: async function* () { yield { type: 'text-delta', text: 'OK' } } },
    get: (name: string) => name === 'settings' ? ctx.settings : undefined,
  }
  const fetch = vi.fn(response)
  const access = new QuantSkillsModelAccess(ctx, undefined, fetch as never)
  const draft: ModelConnectionDraft = { route: 'minimax', service: 'minimax', name: 'MiniMax', api: 'anthropic-messages',
    baseURL: 'https://api.minimaxi.com/anthropic', modelIds: ['model-a'], auto: true }
  return { access, draft, docs, secrets, fetch, ctx, mutate }
}

describe('native model connection contract', () => {
  it.each(['http://192.168.1.20:8080/v1', 'http://models.example.com/v1', 'https://models.example.com/v1'])(
    'verifies and saves an API key connection at %s', async baseURL => {
      const h = harness()
      const draft: ModelConnectionDraft = { service: 'custom', name: 'Custom test', api: 'openai-completions',
        baseURL, apiKey: 'custom-secret', modelIds: [], auto: false }
      const verified = await h.access.run({ action: 'verify', draft })
      expect(verified.verification?.state).toBe('verified')
      expect(h.fetch).toHaveBeenCalledWith(baseURL + '/models', expect.objectContaining({
        headers: { Authorization: 'Bearer custom-secret' }, redirect: 'error',
      }))
      const saved = await h.access.run({ action: 'save', draft })
      const connection = saved.connections.find(row => row.baseURL === baseURL)!
      expect(connection).toMatchObject({ configured: true, state: 'verified', modelIds: ['model-a'] })
      const profile = h.docs['llm-pi-ai'].providers[connection.route]
      expect(profile.baseURL).toBe(baseURL)
      expect(h.secrets.get(profile.apiKeyEnv)).toBe('custom-secret')
      expect(JSON.stringify(saved)).not.toContain('custom-secret')
    },
  )
  it.each(['ftp://models.example.com/v1', 'file:///models', 'http://user:password@models.example.com/v1',
    'http://models.example.com/v1?key=secret', 'http://models.example.com/v1#fragment'])(
    'rejects unsafe endpoint %s before sending credentials', async baseURL => {
      const h = harness()
      const draft = { ...h.draft, baseURL, apiKey: 'custom-secret' }
      const result = await h.access.run({ action: 'verify', draft })
      expect(result.verification?.code).toBe('endpoint')
      await expect(h.access.run({ action: 'save', draft })).rejects.toThrow()
      expect(h.fetch).not.toHaveBeenCalled()
      expect(h.secrets.size).toBe(1)
    },
  )
  it('requires key re-entry when changing a saved HTTPS endpoint to HTTP', async () => {
    const h = harness()
    const result = await h.access.run({ action: 'verify', draft: { ...h.draft,
      baseURL: h.draft.baseURL.replace('https:', 'http:') } })
    expect(result.verification?.code).toBe('credential-scope')
    expect(h.fetch).not.toHaveBeenCalled()
  })
  it('supports unauthenticated loopback servers without supplying a real credential', async () => {
    const h = harness()
    await h.access.run({ action: 'save', draft: { service: 'custom', name: 'Local test', api: 'openai-completions', baseURL: 'http://127.0.0.1:3201/v1', modelIds: ['model-a'], auto: false } })
    const profile = Object.values(h.docs['llm-pi-ai'].providers).find((p: any) => p.baseURL === 'http://127.0.0.1:3201/v1') as any
    expect(h.secrets.get(profile.apiKeyEnv)).toBe('local-no-auth')
    expect(h.secrets.get('EXISTING_KEY')).toBe('private-secret')
  })
  it('does not mark partial text followed by a terminal error as successful inference', async () => {
    const h = harness()
    h.ctx.llm.stream = async function* () {
      yield { type: 'text-delta', index: 0, text: 'partial' }
      yield { type: 'finish', reason: { kind: 'error', failure: { message: '401 private-secret', code: 'AUTH' } } }
    }
    const result = await h.access.run({ action: 'test', route: 'minimax', model: 'model-a' })
    expect(result.verification?.code).toBe('authentication')
    expect(result.verification?.state).toBe('failed')
    expect(JSON.stringify(result)).not.toContain('private-secret')
  })
  it('never admits blank persisted default placeholders to Auto', () => {
    const h = harness()
    expect(modelAllowedForAuto(h.ctx, '', '')).toBe(false)
    expect(modelAllowedForAuto(h.ctx, '   ', 'model-a')).toBe(false)
    expect(modelAllowedForAuto(h.ctx, 'minimax', '   ')).toBe(false)
  })
  it('fails closed for installed routes that were never verified and approved', () => {
    const h = harness()
    expect(h.docs['llm-pi-ai'].providers.minimax).toBeDefined()
    expect(modelAllowedForAuto(h.ctx, 'minimax', 'model-a')).toBe(false)
  })
  it('contains exactly nine manufacturer presets plus custom, without credentials or price claims', () => {
    expect(MODEL_SERVICES).toHaveLength(10)
    for (const service of MODEL_SERVICES.filter(item => item.variants.length)) {
      const request = modelDiscoveryRequest({ service: service.id, name: service.name, api: service.api, baseURL: service.variants[0]!.baseURL, modelIds: [], auto: true }, 'secret')
      expect(request.url).toMatch(/^https:/)
      expect(request.url).not.toContain('secret')
      expect(Object.values(request.headers)).toContain(service.api === 'anthropic-messages' ? 'secret' : 'Bearer secret')
      expect(service.recommendations?.every(model => model.source.startsWith('https://') && model.checkedAt === '2026-09-06')).toBe(true)
    }
    expect(MODEL_SERVICES.filter(service => !['codex-local', 'custom'].includes(service.id)).every(service => service.recommendations?.length)).toBe(true)
  })
  it('materializes trusted image input for exact visual recommendations across providers', () => {
    expect(suggestedModelProfile('deepseek', 'openai-completions', 'deepseek-v4-flash-vision-exp'))
      .toEqual({ id: 'deepseek-v4-flash-vision-exp', input: ['text', 'image'] })
    expect(suggestedModelProfile('google', 'openai-completions', 'gemini-3.8-flash'))
      .toEqual({ id: 'gemini-3.8-flash', input: ['text', 'image'] })
    expect(suggestedModelProfile('deepseek', 'openai-completions', 'deepseek-v4-flash'))
      .toEqual({ id: 'deepseek-v4-flash' })
    expect(suggestedModelProfile('custom', 'openai-completions', 'unverified-vision-name'))
      .toEqual({ id: 'unverified-vision-name' })
  })
  it('fills MiniMax thinking controls from the trusted preset after discovery and persists them', async () => {
    const h = harness(async () => Response.json({ data: [{ id: 'MiniMax-M3' }, { id: 'MiniMax-M2.7' }] }))
    const draft = { ...h.draft, modelIds: [] }
    const result = await h.access.run({ action: 'verify', draft })
    expect(result.verification?.modelProfiles).toEqual([
      expect.objectContaining({ id: 'MiniMax-M3', input: ['text', 'image'], reasoningEfforts: {
        off: null, low: 'low', medium: 'medium', high: 'high', max: 'max',
      } }),
      expect.objectContaining({ id: 'MiniMax-M2.7', input: ['text'], reasoningEfforts: { max: 'max' } }),
    ])
    await h.access.run({ action: 'save', draft: { ...draft, modelIds: result.verification!.modelIds } })
    expect(h.docs['llm-pi-ai'].providers.minimax.models).toEqual(result.verification?.modelProfiles)
    expect(h.docs['llm-pi-ai'].providers.minimax.catalogProvider).toBe('minimax-cn')
  })
  it('recognizes the official Kimi Code endpoint even when saved through the custom form', async () => {
    const ids = ['kimi-for-coding', 'kimi-for-coding-highspeed', 'k3', 'k3-256k']
    const h = harness(async () => Response.json({ data: ids.map(id => ({ id })) }))
    const draft: ModelConnectionDraft = { service: 'custom', name: 'Kimi Code', api: 'openai-completions',
      baseURL: 'https://api.kimi.com/coding/v1', apiKey: 'private-kimi-key', modelIds: [], auto: true }
    const result = await h.access.run({ action: 'verify', draft })
    expect(result.verification?.modelProfiles).toEqual([
      expect.objectContaining({ id: 'kimi-for-coding', input: ['text', 'image'], reasoningEfforts: { high: 'high' },
        compat: { supportsReasoningEffort: false } }),
      expect.objectContaining({ id: 'kimi-for-coding-highspeed', input: ['text', 'image'], reasoningEfforts: { high: 'high' },
        compat: { supportsReasoningEffort: false } }),
      expect.objectContaining({ id: 'k3', contextWindow: 1_048_576, input: ['text', 'image'], reasoningEfforts: {
        off: 'none', low: 'low', medium: 'high', high: 'high', xhigh: 'max', max: 'max',
      } }),
      expect.objectContaining({ id: 'k3-256k', contextWindow: 262_144, input: ['text', 'image'] }),
    ])
    await h.access.run({ action: 'save', draft: { ...draft, modelIds: ids } })
    const route = Object.keys(h.docs['llm-pi-ai'].providers).find(key => key.startsWith('custom-'))!
    expect(h.docs['llm-pi-ai'].providers[route].reasoning).toBe('high')
    expect(h.docs['llm-pi-ai'].providers[route].models).toEqual(result.verification?.modelProfiles)
  })
  it('does not trust lookalike hosts as Kimi Code', () => {
    expect(isKimiCodeEndpoint('openai-completions', 'https://api.kimi.com/coding/v1/')).toBe(true)
    expect(isKimiCodeEndpoint('openai-completions', 'https://api.kimi.com.evil.example/coding/v1')).toBe(false)
    expect(isKimiCodeEndpoint('openai-completions', 'https://api.kimi.com/coding/v1?next=evil')).toBe(false)
    expect(suggestedModelProfile('moonshot', 'openai-completions', 'k3', 'https://api.moonshot.cn/v1'))
      .toEqual({ id: 'k3' })
  })
  it('reads existing routes without exposing the stored key; preserves overrides on save', async () => {
    const h = harness()
    const before = structuredClone(h.docs['llm-pi-ai'].providers.minimax)
    expect(JSON.stringify(await h.access.run({ action: 'list' }))).not.toContain('private-secret')
    await h.access.run({ action: 'save', draft: h.draft })
    expect(h.docs['llm-pi-ai'].providers.minimax).toEqual({ ...before, catalogProvider: 'minimax-cn' })
    expect(h.secrets.size).toBe(1)
    expect(modelAllowedForAuto(h.ctx, 'minimax', 'model-a')).toBe(true)
    await h.access.run({ action: 'auto', route: 'minimax', enabled: false })
    expect(modelAllowedForAuto(h.ctx, 'minimax', 'model-a')).toBe(false)
  })
  it('persists the selected route default thinking level instead of dropping it', async () => {
    const h = harness()
    await h.access.run({ action: 'save', draft: { ...h.draft, reasoning: 'low' } })
    expect(h.docs['llm-pi-ai'].providers.minimax.reasoning).toBe('low')
    expect((await h.access.run({ action: 'list' })).connections.find(row => row.route === 'minimax')?.reasoning).toBe('low')
  })
  it('uses the injected settings and credentials scope, not the parent service context', async () => {
    const h = harness()
    const parent: any = {
      inject: (names: string[], callback: any) => {
        expect(names).toEqual(['settings', 'credentials'])
        callback(h.ctx)
      },
      llm: h.ctx.llm,
      get settings() { throw new Error('settings without inject') },
      get credentials() { throw new Error('credentials without inject') },
    }
    const access = new QuantSkillsModelAccess(parent, undefined, h.fetch as never)
    const listed = await access.run({ action: 'list' })
    expect(listed.connections[0]?.configured).toBe(true)
    await expect(access.run({ action: 'save', draft: h.draft })).resolves.toBeDefined()
  })
  it.each([401, 403, 402, 429, 503])('classifies HTTP %i without echoing provider errors or saving invalid credentials', async status => {
    const h = harness(async () => new Response('private-secret', { status }))
    const result = await h.access.run({ action: 'verify', draft: h.draft })
    expect(result.verification?.state).toBe('failed')
    expect(JSON.stringify(result)).not.toContain('private-secret')
    await expect(h.access.run({ action: 'save', draft: h.draft })).rejects.toThrow()
    expect(h.secrets.get('EXISTING_KEY')).toBe('private-secret')
  })
  it('does not send an existing key to a changed endpoint or follow redirects', async () => {
    const h = harness()
    const result = await h.access.run({ action: 'verify', draft: { ...h.draft, baseURL: 'https://other.example/v1' } })
    expect(result.verification?.code).toBe('credential-scope')
    expect(h.fetch).not.toHaveBeenCalled()
    await h.access.run({ action: 'verify', draft: h.draft })
    expect(h.fetch.mock.calls[0]?.[1]).toMatchObject({ redirect: 'error' })
  })
  it('allows manual IDs when discovery is unavailable but does not admit them to Auto before testing', async () => {
    const h = harness(async () => new Response('', { status: 404 }))
    const result = await h.access.run({ action: 'save', draft: h.draft })
    expect(result.connections[0]?.state).toBe('discovery-unavailable')
    expect(modelAllowedForAuto(h.ctx, 'minimax', 'model-a')).toBe(false)
    await h.access.run({ action: 'test', route: 'minimax', model: 'model-a' })
    expect(modelAllowedForAuto(h.ctx, 'minimax', 'model-a')).toBe(true)
    await expect(h.access.run({ action: 'test', route: 'minimax', model: 'unknown' })).rejects.toThrow()
  })
  it('keeps the existing credential on save failure', async () => {
    const h = harness()
    h.mutate.mockImplementation(async () => { throw new Error('disk full') })
    await expect(h.access.run({ action: 'save', draft: { ...h.draft, apiKey: 'new-private-key' } })).rejects.toThrow('保存失败')
    expect(h.secrets.size).toBe(1)
    expect(h.secrets.get('EXISTING_KEY')).toBe('private-secret')
  })
  it('revokes Auto admission for a model that fails real inference without exposing the raw error', async () => {
    const h = harness()
    await h.access.run({ action: 'save', draft: h.draft })
    h.ctx.llm.stream = async function* () { throw new Error('404 model not found private-secret') }
    const result = await h.access.run({ action: 'test', route: 'minimax', model: 'model-a' })
    expect(result.verification?.code).toBe('model-unavailable')
    expect(JSON.stringify(result)).not.toContain('private-secret')
    expect(modelAllowedForAuto(h.ctx, 'minimax', 'model-a')).toBe(false)
  })
  it('rejects empty advanced overrides without changing the existing connection', async () => {
    const h = harness()
    await expect(h.access.run({ action: 'save', draft: { ...h.draft, modelsJson: '[]' } })).rejects.toThrow('JSON')
    expect(h.docs['llm-pi-ai'].providers.minimax.models).toHaveLength(1)
  })
  it('returns a safe network failure without logging private exception text', async () => {
    const h = harness(async () => { throw new Error('private-secret') })
    const result = await h.access.run({ action: 'verify', draft: h.draft })
    expect(result.verification?.code).toBe('network')
    expect(JSON.stringify(result)).not.toContain('private-secret')
  })
  it('removes only the selected provider, retaining shared credentials and other settings', async () => {
    const h = harness()
    h.docs['llm-pi-ai'].providers.other = { models: [{ id: 'other' }] }
    await h.access.run({ action: 'remove', route: 'minimax' })
    expect(h.docs['llm-pi-ai'].providers.other).toBeDefined()
    expect(h.docs['llm-pi-ai'].providers.minimax).toBeUndefined()
    expect(h.secrets.has('EXISTING_KEY')).toBe(true)
  })
})
