// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  QuantSkillsPandaMcpControl, QuantSkillsPandaMcpHeroControl,
  type QuantSkillsPandaMcpControlProps, type QuantSkillsPandaMcpHeroControlProps,
} from '../src/client/QuantSkillsPandaMcpControl.tsx'
import type { PandaMcpStatus } from '../src/client/plugin-types.ts'

afterEach(cleanup)
afterEach(() => vi.restoreAllMocks())

const status = (phase: PandaMcpStatus['phase']): PandaMcpStatus => ({
  ok: true,
  phase,
  url: 'https://pandadatamcp.pandaaiquant.com/mcp',
  toolCount: phase === 'connected' ? 6 : 0,
  toolNames: [],
  message: phase === 'connected' ? 'PandaData MCP 已连接。' : 'PandaData MCP 尚未连接。',
})

const conversation = {
  views: { get: () => undefined },
  activeTargets: new Set<string>(),
}

const session = (started: boolean) => ({
  blank: !started,
  awaitingFirstTurn: !started,
  promptAttempted: started,
  running: false,
})

describe('PandaData MCP composer control', () => {
  it('keeps a login error visible across successful status polls and clears it on retry', async () => {
    let poll: (() => void) | undefined
    const originalInterval = window.setInterval.bind(window)
    vi.spyOn(window, 'setInterval').mockImplementation((callback, delay) => {
      if (delay === 4_000 || delay === 10_000) { poll = callback as () => void; return 123 }
      return originalInterval(callback, delay)
    })
    const readStatus = vi.fn(async () => status('needs_auth'))
    const authenticate = vi.fn().mockRejectedValueOnce(new Error('登录请求失败：HTTP 502')).mockResolvedValueOnce(status('connected'))
    render(<QuantSkillsPandaMcpHeroControl {...({
      mode: 'standalone',
      useView: () => true,
      status: readStatus,
      authenticate,
      refresh: vi.fn(async () => status('connected')),
      logout: vi.fn(async () => status('disconnected')),
    } as unknown as QuantSkillsPandaMcpHeroControlProps)} />)
    fireEvent.click(await screen.findByRole('button', { name: 'PandaData MCP：需要登录' }))
    fireEvent.click(screen.getByRole('button', { name: '连接 PandaData' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('HTTP 502'))
    const before = readStatus.mock.calls.length
    await act(async () => { poll?.() })
    await waitFor(() => expect(readStatus.mock.calls.length).toBeGreaterThan(before))
    expect(screen.getByRole('alert').textContent).toContain('HTTP 502')
    fireEvent.click(screen.getByRole('button', { name: '连接 PandaData' }))
    await screen.findByRole('button', { name: 'PandaData MCP：已连接' })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows the green connected state and disconnects through the slide switch', async () => {
    const logout = vi.fn(async () => status('disconnected'))
    render(<QuantSkillsPandaMcpControl {...({
      mode: 'standalone',
      useView: (select: (state: { pluginOpen: boolean; pluginConversationOpen: boolean }) => unknown) => select({
        pluginOpen: true,
        pluginConversationOpen: true,
      }),
      useConversation: (select: (state: typeof conversation) => unknown) => select(conversation),
      session: session(true),
      status: vi.fn(async () => status('connected')),
      authenticate: vi.fn(async () => status('authenticating')),
      refresh: vi.fn(async () => status('connected')),
      logout,
    } as unknown as QuantSkillsPandaMcpControlProps)} />)

    await screen.findByRole('button', { name: 'PandaData MCP：已连接' })
    expect(screen.getByRole('button', { name: 'PandaData MCP：已连接' }).querySelector('img')?.getAttribute('src')).toContain('pandaai-mark.png')
    fireEvent.click(screen.getByRole('button', { name: 'PandaData MCP：已连接' }))
    const toggle = screen.getByRole('switch', { name: '启用 PandaData MCP' })
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('status').textContent).toContain('已连接')

    fireEvent.click(toggle)
    await waitFor(() => { expect(logout).toHaveBeenCalledTimes(1) })
    await waitFor(() => { expect(toggle.getAttribute('aria-checked')).toBe('false') })
  })

  it('keeps the composer control hidden while the Session is still blank', () => {
    const readStatus = vi.fn(async () => status('connected'))
    render(<QuantSkillsPandaMcpControl {...({
      mode: 'standalone',
      useView: (select: (state: { pluginOpen: boolean; pluginConversationOpen: boolean }) => unknown) => select({
        pluginOpen: true,
        pluginConversationOpen: true,
      }),
      useConversation: (select: (state: typeof conversation) => unknown) => select(conversation),
      session: session(false),
      status: readStatus,
      authenticate: vi.fn(async () => status('authenticating')),
      refresh: vi.fn(async () => status('connected')),
      logout: vi.fn(async () => status('disconnected')),
    } as unknown as QuantSkillsPandaMcpControlProps)} />)

    expect(screen.queryByRole('button', { name: /PandaData MCP/u })).toBeNull()
    expect(readStatus).not.toHaveBeenCalled()
  })

  it('shows connection status beside the blank-session Hero preset', async () => {
    const readStatus = vi.fn(async () => status('connected'))
    render(<QuantSkillsPandaMcpHeroControl {...({
      mode: 'standalone',
      useView: (select: (state: { pluginOpen: boolean; pluginConversationOpen: boolean }) => unknown) => select({
        pluginOpen: true,
        pluginConversationOpen: true,
      }),
      status: readStatus,
      authenticate: vi.fn(async () => status('authenticating')),
      refresh: vi.fn(async () => status('connected')),
      logout: vi.fn(async () => status('disconnected')),
    } as unknown as QuantSkillsPandaMcpHeroControlProps)} />)

    await screen.findByRole('button', { name: 'PandaData MCP：已连接' })
    expect(readStatus).toHaveBeenCalledTimes(1)
  })
})
