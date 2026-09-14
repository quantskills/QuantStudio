// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  QuantSkillsPandaMcpControl, QuantSkillsPandaMcpHeroControl,
  type QuantSkillsPandaMcpControlProps, type QuantSkillsPandaMcpHeroControlProps,
} from '../src/client/QuantSkillsPandaMcpControl.tsx'
import type { PandaMcpStatus } from '../src/client/plugin-types.ts'

afterEach(cleanup)

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
