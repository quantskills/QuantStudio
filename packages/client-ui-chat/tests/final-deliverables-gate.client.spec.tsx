// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { AssistantNodeView } from '../src/client/chat/AssistantNodeView.tsx'

vi.mock('../src/client/chat/AssistantMarkdown.tsx', () => ({ AssistantMarkdown: ({ blocks }: { blocks: { text: string }[] }) => <p>{blocks.map(block => block.text).join('')}</p> }))
afterEach(cleanup)

it('renders deliveries only for the closed turn closing answer, not streaming, earlier or interrupted messages', () => {
  const renderSlot = vi.fn(() => <aside>交付卡片</aside>)
  const makeProps = (closed: boolean, seq: number | undefined) => ({
    node: { data: { blocks: [{ kind: 'text', text: '结论\n```quantskills-deliverables\n{"version":1,"items":[{"path":"output/a.md","title":"报告","presentation":"card"}]}\n```' }], status: closed ? 'settled' : 'running', finalNode: seq === undefined ? undefined : { seq } }, location: { kind: 'turn', turn: { status: closed ? 'closed' : 'open' } } },
    useSession: (selector: (value: { sessionId: string }) => unknown) => selector({ sessionId: 's' }),
    useTurnData: () => ({ closing: { finalNode: { seq: 9 } } }),
    openFile: vi.fn(), fileMentions: () => undefined, renderMessageImages: () => null, t: (key: string) => key, renderSlot,
  }) as unknown as ComponentProps<typeof AssistantNodeView>
  const view = render(<AssistantNodeView {...makeProps(false, 9)}/> )
  expect(view.queryByText('交付卡片')).toBeNull()
  expect(view.container.textContent).not.toContain('quantskills-deliverables')
  view.rerender(<AssistantNodeView {...makeProps(true, 8)}/> )
  expect(renderSlot).not.toHaveBeenCalled()
  view.rerender(<AssistantNodeView {...makeProps(true, undefined)}/> )
  expect(renderSlot).not.toHaveBeenCalled()
  view.rerender(<AssistantNodeView {...makeProps(true, 9)}/> )
  expect(view.getByText('交付卡片')).toBeTruthy()
  expect(view.getByText('结论')).toBeTruthy()
})

it('recovers unmarked manifests only in the settled closing answer, including persisted history', () => {
  const text = '最终交付：\n```json\n{"version":1,"items":[{"path":"output/report.html","title":"策略研究报告","presentation":"interactive"}]}\n```'
  const renderSlot = vi.fn(() => <aside>策略研究报告卡片</aside>)
  const props = (status: string, finalSeq: number, closed = true) => ({
    node: { data: { blocks: [{ kind: 'text', text }], status, finalNode: { seq: finalSeq } }, location: { kind: 'turn', turn: { status: closed ? 'closed' : 'open' } } },
    useSession: (selector: (value: { sessionId: string }) => unknown) => selector({ sessionId: 'saved-session' }),
    useTurnData: () => ({ closing: { finalNode: { seq: 10 } } }),
    openFile: vi.fn(), fileMentions: () => undefined, renderMessageImages: () => null, t: (key: string) => key, renderSlot,
  }) as unknown as ComponentProps<typeof AssistantNodeView>
  const view = render(<AssistantNodeView {...props('running', 10, false)}/> )
  expect(view.container.textContent).toContain('```json')
  view.rerender(<AssistantNodeView {...props('settled', 9)}/> )
  expect(view.container.textContent).toContain('```json'); expect(renderSlot).not.toHaveBeenCalled()
  view.rerender(<AssistantNodeView {...props('interrupted', 10)}/> )
  expect(view.container.textContent).toContain('```json'); expect(renderSlot).not.toHaveBeenCalled()
  view.rerender(<AssistantNodeView {...props('settled', 10)}/> )
  expect(view.container.textContent).not.toContain('```json')
  expect(renderSlot).toHaveBeenCalledWith('conversation.chat.deliverables', expect.objectContaining({ items: [{ path: 'output/report.html', title: '策略研究报告', presentation: 'interactive' }] }), expect.anything())
  expect(view.getByText('策略研究报告卡片')).toBeTruthy()
})
