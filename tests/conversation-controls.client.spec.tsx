// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ConversationSessionHeader, type ConversationSessionHeaderProps } from '../packages/client-ui-conversation/src/client/skeleton/ConversationSession.tsx'
import { AuthoringReview } from '../packages/ui-quantskills/src/client/AuthoringReview.tsx'

afterEach(cleanup)

function headerProps(options: { selectedView?: string; kind?: 'skill' | 'agent' | 'team'; blank?: boolean } = {}): ConversationSessionHeaderProps {
  const session = {
    id: 'parent', displayTitle: '创作', blank: options.blank ?? false, running: false,
    projectionValues: { quantSkillsAuthoringPending: {
      kind: options.kind ?? 'skill', toolCallId: 'prepared', treeDigest: 'sha256:123',
      name: '研究助手', description: '生成每日研究报告', members: [],
    } },
  }
  const list = { current: 'parent', ids: ['parent'], byId: { parent: session } }
  return {
    sessionId: 'parent', useSession: (select: (state: typeof session) => unknown) => select(session),
    useSessions: (select: (state: typeof list) => unknown) => select(list),
    useConversation: (select: (state: { activeTargets: Set<string> }) => unknown) => select({ activeTargets: new Set() }),
    useConversationViews: (select: (state: { id: string; label: string }[]) => unknown) => select([{ id: 'chat', label: '聊天' }, { id: 'trajectory', label: '轨迹' }]),
    useStore: (select: (state: { view: string }) => unknown) => select({ view: options.selectedView ?? 'chat' }),
    actions: { setView: vi.fn() }, renderSlot: () => null, open: vi.fn(), t: (key: string) => key,
  } as unknown as ConversationSessionHeaderProps
}

it.each(['skill', 'agent', 'team'] as const)('keeps prepared %s confirmation reachable and commits the reviewed draft', async kind => {
  const props = headerProps({ kind })
  const commit = vi.fn(async () => ({ kind }))
  const openLibrary = vi.fn()
  props.renderSlot = ((name: string) => name === 'conversation.session.header.actions'
    ? <AuthoringReview useSessions={props.useSessions as never} commit={commit as never} start={vi.fn()} openLibrary={openLibrary} focusComposer={vi.fn()} />
    : null) as never
  render(<ConversationSessionHeader {...props} />)
  fireEvent.click(screen.getByRole('button', { name: '确认生成', exact: true }))
  await waitFor(() => expect(openLibrary).toHaveBeenCalledWith(kind))
  expect(commit).toHaveBeenCalledWith('parent', 'prepared', 'sha256:123')
})

it('lets a session viewing trajectory switch back to chat', () => {
  const props = headerProps({ selectedView: 'trajectory' })
  render(<ConversationSessionHeader {...props} />)
  expect(screen.getByRole('tab', { name: '轨迹' }).getAttribute('aria-selected')).toBe('true')
  fireEvent.click(screen.getByRole('tab', { name: '聊天' }))
  expect(props.actions.setView).toHaveBeenCalledWith('chat')
})

it('falls back to chat when a persisted view no longer exists', () => {
  render(<ConversationSessionHeader {...headerProps({ selectedView: 'removed-view' })} />)
  expect(screen.getByRole('tab', { name: '聊天' }).getAttribute('aria-selected')).toBe('true')
})

it('mounts action and utility controls while keeping subagents in the composer', () => {
  const seat = document.createElement('div')
  seat.setAttribute('data-composer-subagents', '')
  document.body.append(seat)
  try {
    const props = headerProps()
    props.renderSlot = ((name: string) => name.endsWith('.actions') ? <button>收藏会话</button>
      : name.endsWith('.utilities') ? <button>会话菜单</button>
        : name.endsWith('.lineage') ? <button>子智能体</button> : null) as never
    const view = render(<ConversationSessionHeader {...props} />)
    expect(view.container.querySelector('[data-conversation-controls]')?.contains(screen.getByRole('button', { name: '收藏会话' }))).toBe(true)
    expect(screen.getByRole('button', { name: '会话菜单' })).toBeTruthy()
    expect(seat.contains(screen.getByRole('button', { name: '子智能体' }))).toBe(true)
  } finally { seat.remove() }
})

it('keeps blank conversations free of session controls', () => {
  const view = render(<ConversationSessionHeader {...headerProps({ blank: true })} />)
  expect(view.container.querySelector('[data-conversation-controls]')).toBeNull()
})
