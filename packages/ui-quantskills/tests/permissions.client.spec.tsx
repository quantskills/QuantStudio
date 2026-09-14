// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PermissionSelect } from '../../client-ui-conversation/src/client/skeleton/PermissionSelect.tsx'
import type { PermissionSelectProps } from '../../client-ui-conversation/src/client/skeleton/PermissionSelect.tsx'
import { en, zh } from '../../client-ui-conversation/src/client/locales.ts'

afterEach(cleanup)

const t = ((key: string, params?: Record<string, unknown>) => {
  let text = (zh as Record<string, string>)[key] ?? key
  for (const [name, value] of Object.entries(params ?? {})) text = text.replace(`{${name}}`, String(value))
  return text
}) as PermissionSelectProps['t']

const value = {
  currentValue: 'workspace-write',
  options: [
    { value: 'read-only', name: en['access.preset.readOnly'] },
    { value: 'workspace-write', name: en['access.preset.workspaceWrite'] },
    { value: 'danger-full-access', name: en['access.preset.fullAccess'] },
  ],
} as NonNullable<PermissionSelectProps['value']>

describe('QuantSkills permission display', () => {
  it('shows the three Chinese labels while preserving the selected permission command', async () => {
    const command = vi.fn(async () => true)
    render(<PermissionSelect value={value} locked={false} command={command} t={t} />)
    fireEvent.click(screen.getByRole('button', { name: '访问模式，当前：有限权限' }))
    expect(screen.getByRole('menuitem', { name: '只读权限' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: '有限权限' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: '完全权限' })).toBeTruthy()
    fireEvent.click(screen.getByRole('menuitem', { name: '只读权限' }))
    await waitFor(() => expect(command).toHaveBeenCalledWith('/permission read-only'))
  })

  it('still requires acknowledgement before sending the full access command', async () => {
    const command = vi.fn(async () => true)
    render(<PermissionSelect value={value} locked={false} command={command} t={t} />)
    fireEvent.click(screen.getByRole('button', { name: '访问模式，当前：有限权限' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '完全权限' }))
    expect(command).not.toHaveBeenCalled()
    const confirm = screen.getByRole('button', { name: '启用完全权限' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: '我已了解风险，并愿意继续' }))
    expect(confirm.disabled).toBe(false)
    fireEvent.click(confirm)
    await waitFor(() => expect(command).toHaveBeenCalledWith('/permission danger-full-access'))
  })

  it('preserves host configured labels and leaves locked permissions disabled', () => {
    const customized = { ...value, options: [{ value: 'workspace-write', name: '研究沙盒' }] }
    render(<PermissionSelect value={customized} locked command={vi.fn(async () => true)} t={t} />)
    const trigger = screen.getByRole('button', { name: '访问模式，当前：研究沙盒' }) as HTMLButtonElement
    expect(trigger.disabled).toBe(true)
  })
})
