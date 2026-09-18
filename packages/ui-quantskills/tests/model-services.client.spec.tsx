// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QuantSkillsModelServices, type ModelAccess } from '../src/client/QuantSkillsModelServices.tsx'
import { MODEL_SERVICES } from '../../quantskills-session/src/model-service-catalog.ts'
afterEach(cleanup)

describe('native model services', () => {
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
