// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ModelStartup } from '../src/client/ModelStartup.tsx'
import type { ModelAccess } from '../src/client/QuantSkillsModelServices.tsx'
import { MODEL_SERVICES } from '../../quantskills-session/src/model-service-catalog.ts'
const empty = { catalog: MODEL_SERVICES, connections: [] }
const configured = { ...empty, connections: [{ route: 'custom-a', name: 'Local', service: 'custom', baseURL: 'http://localhost:1234/v1', api: 'openai-completions', configured: true, auto: false, modelIds: ['model-a'], modelsJson: '[]', state: 'saved', message: '' }] }
afterEach(cleanup)
it('opens service selection on startup and dismisses only for this launch', async () => {
  const access = vi.fn<ModelAccess>(async () => empty)
  const { rerender, unmount } = render(<ModelStartup access={access}/>)
  await screen.findByRole('dialog', { name: '配置大模型' })
  expect(screen.getByRole('textbox', { name: '搜索模型服务' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '稍后设置' }))
  rerender(<ModelStartup access={async () => empty}/>)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(access).toHaveBeenCalledTimes(1)
  unmount()
  render(<ModelStartup access={access}/>)
  await screen.findByRole('dialog')
})
it('recognizes legacy configured connections without demanding a fresh verification', async () => {
  const access = vi.fn<ModelAccess>(async () => configured)
  render(<ModelStartup access={access}/>)
  await waitFor(() => expect(access).toHaveBeenCalledTimes(1))
  expect(screen.queryByRole('dialog')).toBeNull()
})
it('does not mistake a directory or a route without credentials for a usable configuration', async () => {
  render(<ModelStartup access={async () => ({ ...configured, connections: configured.connections.map(c => ({ ...c, configured: false })) })}/>)
  await screen.findByRole('dialog', { name: '配置大模型' })
})
it('reports a failed check separately and retries without overwriting settings', async () => {
  const access = vi.fn<ModelAccess>().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(configured)
  render(<ModelStartup access={access}/>)
  expect((await screen.findByRole('alert')).textContent).toContain('无法检查')
  expect(screen.queryByText(/还没有配置大模型/)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '重新检查' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(access.mock.calls.every(([request]) => request.action === 'list')).toBe(true)
})
it('keeps failed saves editable and continues after a successful save', async () => {
  let saved = false
  const access = vi.fn<ModelAccess>(async request => {
    if (request.action === 'list') return empty
    if (!saved) { saved = true; throw new Error('鉴权失败') }
    return configured
  })
  render(<ModelStartup access={access}/>)
  fireEvent.click(await screen.findByRole('button', { name: /自定义兼容服务/ }))
  fireEvent.change(screen.getByLabelText('服务地址'), { target: { value: 'http://localhost:1234/v1' } })
  fireEvent.change(screen.getByLabelText(/模型 ID/), { target: { value: 'model-a' } })
  fireEvent.click(screen.getByRole('button', { name: '验证并保存' }))
  expect((await screen.findByRole('alert')).textContent).toContain('鉴权失败')
  fireEvent.click(screen.getByRole('button', { name: '验证并保存' }))
  fireEvent.click(await screen.findByRole('button', { name: '开始使用' }))
  expect(screen.queryByRole('dialog')).toBeNull()
})
