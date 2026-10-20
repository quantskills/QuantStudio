// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PluginSettings } from '../src/client/PluginSettings.tsx'

afterEach(cleanup)

it('keeps official management accessible when the legacy community section is unavailable', () => {
  const open = vi.fn()
  render(<PluginSettings openManager={open} />)
  fireEvent.click(screen.getByRole('button', { name: '打开插件管理' }))
  expect(open).toHaveBeenCalledOnce()
  expect(screen.getByRole('status').textContent).toContain('已安装的插件与配置保持不变')
})

it('preserves a loaded community section and reports a failed native navigation', () => {
  render(<PluginSettings openManager={() => { throw new Error('panel unloaded') }} community={<p>Community catalog</p>} />)
  expect(screen.getByText('Community catalog')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '打开插件管理' }))
  expect(screen.getByRole('alert').textContent).toContain('暂时无法打开')
})

it('does not offer an unusable navigation when the official panel is absent', () => {
  render(<PluginSettings />)
  expect((screen.getByRole('button', { name: '打开插件管理' }) as HTMLButtonElement).disabled).toBe(true)
})
