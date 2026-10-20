// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PluginSettings } from '../src/client/PluginSettings.tsx'

afterEach(cleanup)

it('routes community discovery and modifications to the official manager', () => {
  const open = vi.fn()
  render(<PluginSettings openManager={open} />)
  fireEvent.click(screen.getByRole('button', { name: '打开插件管理' }))
  expect(open).toHaveBeenCalledOnce()
  expect(screen.getByRole('region', { name: '社区市场' }).textContent).toContain('来源与配置会保留')
  expect(screen.getByRole('region', { name: '社区市场' }).textContent).toContain('统一由插件管理器处理')
})

it('reports a failed native navigation without exposing a second installer', () => {
  render(<PluginSettings openManager={() => { throw new Error('panel unloaded') }} />)
  fireEvent.click(screen.getByRole('button', { name: '打开插件管理' }))
  expect(screen.getByRole('alert').textContent).toContain('暂时无法打开')
})

it('does not offer an unusable navigation when the official panel is absent', () => {
  render(<PluginSettings />)
  expect((screen.getByRole('button', { name: '打开插件管理' }) as HTMLButtonElement).disabled).toBe(true)
})
