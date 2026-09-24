// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QuantSkillsModelServices, type ModelAccess } from '../src/client/QuantSkillsModelServices.tsx'
import { MODEL_SERVICES } from '../../quantskills-session/src/model-service-catalog.ts'
afterEach(cleanup)

describe('native model services', () => {
  it('configures the shared Jev key only in model services and never echoes it', async () => {
    const jevAccess = {
      settings: vi.fn(async () => ({ configured: false, writable: true, model: 'jev-1.13.0' })),
      configure: vi.fn(async () => ({ configured: true, writable: true, model: 'jev-1.13.0' })),
    }
    render(<QuantSkillsModelServices access={vi.fn(async () => ({ catalog: MODEL_SERVICES, connections: [] }))} jevAccess={jevAccess}/>)
    await waitFor(() => expect(screen.getByRole('button', { name: '测试并保存密钥' }).matches(':disabled')).toBe(true))
    await waitFor(() => expect(jevAccess.settings).toHaveBeenCalled())
    expect(screen.getByText(/比赛页的 Jev 盯盘与果蝇的 Jev 辅助共用此密钥/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Jev API Key'), { target: { value: 'test-private-candidate' } })
    await waitFor(() => expect(screen.getByRole('button', { name: '测试并保存密钥' }).matches(':disabled')).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: '测试并保存密钥' }))
    await screen.findByText('密钥已配置')
    expect(jevAccess.configure).toHaveBeenCalledExactlyOnceWith({ apiKey: 'test-private-candidate' })
    expect((screen.getByLabelText('Jev API Key') as HTMLInputElement).value).toBe('')
    expect(screen.getByLabelText('Jev API Key').getAttribute('type')).toBe('password')
    expect(document.body.textContent).not.toContain('test-private-candidate')
  })

  it('keeps saved Jev state after a failed key test and honors read-only credentials', async () => {
    const jevAccess = {
      settings: vi.fn(async () => ({ configured: true, writable: true, model: 'jev-1.13.0' })),
      configure: vi.fn(async () => { throw new Error('连接测试失败') }),
    }
    const view = render(<QuantSkillsModelServices jevAccess={jevAccess}/>)
    await screen.findByText('密钥已配置')
    fireEvent.click(screen.getByText('Jev · TypeSafe'))
    fireEvent.change(screen.getByLabelText('Jev API Key'), { target: { value: 'invalid-test-candidate' } })
    fireEvent.click(screen.getByRole('button', { name: '测试并保存密钥' }))
    await screen.findByText('连接测试失败')
    expect(screen.getByText('密钥已配置')).toBeTruthy()
    expect((screen.getByLabelText('Jev API Key') as HTMLInputElement).value).toBe('')
    const readonlyAccess = { ...jevAccess, settings: vi.fn(async () => ({ configured: true, writable: false, model: 'jev-1.13.0' })) }
    view.rerender(<QuantSkillsModelServices jevAccess={readonlyAccess}/>)
    await screen.findByText(/当前凭据只读/)
    expect(screen.getByLabelText('Jev API Key').matches(':disabled')).toBe(true)
  })

  it('selects the Jev translator from connected models without replacing the shared key', async () => {
    const translator = { provider: 'user-connected-route', model: 'user-model' }
    const jevAccess = {
      settings: vi.fn(async () => ({ configured: true, writable: true, model: 'jev-1.13.0', translationModels: [translator] })),
      configure: vi.fn(async () => ({ configured: true, writable: true, model: 'jev-1.13.0', translator, translationModels: [translator] })),
    }
    render(<QuantSkillsModelServices jevAccess={jevAccess}/>)
    await screen.findByText('密钥已配置')
    fireEvent.click(screen.getByText('Jev · TypeSafe'))
    fireEvent.change(screen.getByLabelText('中文专用翻译模型'), { target: { value: JSON.stringify(translator) } })
    fireEvent.click(screen.getByRole('button', { name: '保存翻译模型' }))
    await waitFor(() => expect(jevAccess.configure).toHaveBeenCalledExactlyOnceWith({ translator }))
  })

  it('refreshes Jev model choices after a connection is saved on the same page', async () => {
    const translator = { provider: 'new-route', model: 'new-model' }
    let saved = false
    const access = vi.fn<ModelAccess>(async request => { if (request.action === 'save') saved = true; return { catalog: MODEL_SERVICES, connections: [] } })
    const jevAccess = {
      settings: vi.fn(async () => ({ configured: true, writable: true, model: 'jev-1.13.0', translationModels: saved ? [translator] : [] })),
      configure: vi.fn(async () => ({ configured: true, writable: true, model: 'jev-1.13.0' })),
    }
    render(<QuantSkillsModelServices access={access} jevAccess={jevAccess}/>)
    await screen.findByText('密钥已配置')
    fireEvent.click(screen.getByText('Jev · TypeSafe'))
    expect(screen.queryByRole('option', { name: 'new-model · new-route' })).toBeNull()
    await waitFor(() => expect(screen.getByRole('button', { name: '添加模型服务' }).matches(':disabled')).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: '添加模型服务' }))
    fireEvent.click(screen.getByRole('button', { name: /自定义兼容服务/ }))
    fireEvent.change(screen.getByLabelText('服务地址'), { target: { value: 'https://example.com/v1' } })
    fireEvent.change(screen.getByLabelText(/模型 ID/), { target: { value: 'new-model' } })
    fireEvent.click(screen.getByRole('button', { name: '验证并保存' }))
    await screen.findByRole('option', { name: 'new-model · new-route' })
  })

  it('offers one searchable entry, preserves multiline manual IDs, and calls the typed service directly', async () => {
    const access = vi.fn<ModelAccess>(async () => ({ catalog: MODEL_SERVICES, connections: [] }))
    render(<QuantSkillsModelServices access={access}/>)
    await waitFor(() => expect((screen.getByRole('button', { name: '添加模型服务' }) as HTMLButtonElement).disabled).toBe(false))
    expect(screen.queryByText('从目录接入')).toBeNull()
    expect(screen.queryByText('自建接入')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '添加模型服务' }))
    fireEvent.change(screen.getByRole('textbox', { name: '搜索模型服务' }), { target: { value: 'custom' } })
    fireEvent.click(screen.getByRole('button', { name: /自定义/ }))
    fireEvent.change(screen.getByLabelText('服务地址'), { target: { value: 'http://192.168.1.20:1234/v1' } })
    expect((screen.getByLabelText('服务地址') as HTMLInputElement).checkValidity()).toBe(true)
    expect(screen.getByText(/HTTP 会明文传输/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('服务地址'), { target: { value: 'https://models.example.com/v1' } })
    expect(screen.queryByText(/HTTP 会明文传输/)).toBeNull()
    fireEvent.change(screen.getByLabelText('服务地址'), { target: { value: 'http://192.168.1.20:1234/v1' } })
    const ids = screen.getByLabelText(/模型 ID/)
    fireEvent.change(ids, { target: { value: 'model-a\n' } })
    expect((ids as HTMLTextAreaElement).value).toBe('model-a\n')
    fireEvent.change(ids, { target: { value: 'model-a\nmodel-b\n' } })
    expect(screen.getByText('高级设置').parentElement?.hasAttribute('open')).toBe(false)
    expect(screen.queryByRole('checkbox', { name: '参与 Auto' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '验证并保存' }))
    await waitFor(() => expect(access).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'save', draft: expect.objectContaining({ baseURL: 'http://192.168.1.20:1234/v1', modelIds: ['model-a', 'model-b'], auto: false }) })))
  })
  it('does not offer local login and reports Host errors', async () => {
    const access = vi.fn<ModelAccess>(async request => {
      if (request.action !== 'list') throw new Error('连接保存失败')
      return { catalog: MODEL_SERVICES, connections: [] }
    })
    render(<QuantSkillsModelServices access={access}/>)
    await waitFor(() => expect((screen.getByRole('button', { name: '添加模型服务' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: '添加模型服务' }))
    expect(screen.queryByRole('button', { name: /本机 Codex/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /自定义兼容服务/ }))
    expect(screen.getByLabelText('API 密钥')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '验证连接并获取模型' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', '连接保存失败')
  })
  it('fills model and reasoning capability templates without requiring raw JSON knowledge', async () => {
    const access = vi.fn<ModelAccess>(async () => ({ catalog: MODEL_SERVICES, connections: [] }))
    render(<QuantSkillsModelServices access={access}/>)
    await waitFor(() => expect((screen.getByRole('button', { name: '添加模型服务' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: '添加模型服务' }))
    fireEvent.click(screen.getByRole('button', { name: /自定义/ }))
    fireEvent.click(screen.getByRole('button', { name: '填入 ID 模板' }))
    expect((screen.getByLabelText(/模型 ID/) as HTMLTextAreaElement).value).toContain('your-model-id-fast')
    fireEvent.click(screen.getByText('高级设置'))
    fireEvent.click(screen.getByRole('button', { name: '按模型 ID 生成模板' }))
    const profiles = (screen.getByLabelText(/模型能力覆盖/) as HTMLTextAreaElement).value
    expect(profiles).toContain('"off": null')
    expect(profiles).toContain('"low": "low"')
    expect(profiles).toContain('"medium": "medium"')
    expect(profiles).toContain('"high": "high"')
    expect(screen.getByText(/对象表示支持思考开关与强度/)).toBeTruthy()
  })
  it('writes discovered MiniMax thinking capabilities into the advanced model JSON', async () => {
    const access = vi.fn<ModelAccess>(async request => request.action === 'verify'
      ? { catalog: MODEL_SERVICES, connections: [], verification: { state: 'verified', code: 'ok', message: 'ok',
        modelIds: ['MiniMax-M3'], modelProfiles: [{ id: 'MiniMax-M3', input: ['text', 'image'], reasoningEfforts: {
          off: null, low: 'low', medium: 'medium', high: 'high', max: 'max',
        } }] } }
      : { catalog: MODEL_SERVICES, connections: [] })
    render(<QuantSkillsModelServices access={access}/>)
    await waitFor(() => expect((screen.getByRole('button', { name: '添加模型服务' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: '添加模型服务' }))
    fireEvent.click(screen.getByRole('button', { name: /^MiniMax/ }))
    fireEvent.click(screen.getByRole('button', { name: '验证连接并获取模型' }))
    await waitFor(() => expect((screen.getByLabelText(/模型 ID/) as HTMLTextAreaElement).value).toBe('MiniMax-M3'))
    fireEvent.click(screen.getByText('高级设置'))
    const profiles = (screen.getByLabelText(/模型能力覆盖/) as HTMLTextAreaElement).value
    expect(profiles).toContain('"low": "low"')
    expect(profiles).toContain('"medium": "medium"')
    expect(profiles).toContain('"high": "high"')
  })
  it('shows unloaded vendor recommendations without making them routable model IDs', async () => {
    const access = vi.fn<ModelAccess>(async () => ({ catalog: MODEL_SERVICES, connections: [] }))
    render(<QuantSkillsModelServices access={access}/>)
    await waitFor(() => expect((screen.getByRole('button', { name: '添加模型服务' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: '添加模型服务' }))
    fireEvent.click(screen.getByRole('button', { name: /^DeepSeek/ }))
    expect(screen.getByRole('region', { name: '目录推荐模型' }).textContent).toContain('deepseek-v4-pro')
    expect((screen.getByLabelText(/模型 ID/) as HTMLTextAreaElement).value).toBe('')
    expect(screen.getByText(/推理测试可以进一步确认/)).toBeTruthy()
  })
  it('clears explicit thinking flags when returning to automatic detection', async () => {
    const access = vi.fn<ModelAccess>(async () => ({ catalog: MODEL_SERVICES, connections: [] }))
    render(<QuantSkillsModelServices access={access}/>)
    await waitFor(() => expect((screen.getByRole('button', { name: '添加模型服务' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: '添加模型服务' }))
    fireEvent.click(screen.getByRole('button', { name: /自定义兼容服务/ }))
    fireEvent.change(screen.getByLabelText(/模型 ID/), { target: { value: 'model-a' } })
    const select = screen.getByLabelText('model-a 思考能力')
    fireEvent.change(select, { target: { value: 'unsupported' } })
    expect((screen.getByLabelText(/模型能力覆盖/) as HTMLTextAreaElement).value).toContain('"reasoningEfforts": false')
    fireEvent.change(select, { target: { value: 'unknown' } })
    const profiles = JSON.parse((screen.getByLabelText(/模型能力覆盖/) as HTMLTextAreaElement).value)
    expect(profiles[0].reasoningEfforts).toBeUndefined()
    expect(profiles[0].compat.supportsReasoningEffort).toBeUndefined()
  })

})
