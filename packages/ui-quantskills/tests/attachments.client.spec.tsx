// @vitest-environment jsdom

import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import {
  QuantSkillsAttachmentControl, QuantSkillsAttachmentController,
  type QuantSkillsAttachmentControlProps,
} from '../src/client/QuantSkillsAttachmentControl.tsx'

const sessionId = 'session-attachment' as SessionId

afterEach(cleanup)

function props(overrides: Partial<QuantSkillsAttachmentControlProps> = {}): QuantSkillsAttachmentControlProps {
  return {
    sessionId,
    controller: new QuantSkillsAttachmentController(),
    upload: vi.fn<QuantSkillsAttachmentControlProps['upload']>(async (_id, file) => ({
      file: {
        attachmentId: `sha256:${'a'.repeat(64)}` as never,
        mediaType: file.type,
        bytes: file.size,
        name: file.name,
      },
      parsing: { status: 'ready' as const, kind: 'utf8-text' as const },
      attachedAt: 1,
    })),
    appendDraft: vi.fn(),
    editDraft: vi.fn(),
    useSession: vi.fn() as never,
    useProjection: vi.fn() as never,
    useInput: ((select: (state: { draft: string }) => unknown) => select({ draft: '' })) as never,
    inputActions: {} as never,
    session: {} as never,
    input: {} as never,
    ...overrides,
  } as QuantSkillsAttachmentControlProps
}

function Composer({ control, initialDraft = '' }: {
  control: QuantSkillsAttachmentControlProps
  initialDraft?: string
}) {
  const [draft, setDraft] = useState(initialDraft)
  return <div data-composer-card="">
    <QuantSkillsAttachmentControl {...control}
      useInput={((select: (state: { draft: string }) => unknown) => select({ draft })) as never}
      appendDraft={(id, text) => {
        control.appendDraft(id, text)
        setDraft(value => value + text)
      }}
      editDraft={(id, update) => {
        control.editDraft(id, update)
        setDraft(update)
      }} />
    <textarea aria-label="草稿" value={draft} onChange={event => setDraft(event.target.value)} />
    <button onClick={() => setDraft('')}>发送成功</button>
  </div>
}

const reference = `\n[QuantSkills 附件]\n- notes.txt；媒体类型 text/plain；附件 id sha256:${'a'.repeat(64)}；文本可读取\n需要读取可用文本时，请使用 quantskills_read_attachment，并传入上面的附件 id。`

describe('QuantSkills generic-file composer control', () => {
  it('uploads complete file bytes and appends only the durable reference to the draft', async () => {
    const upload = vi.fn(async (_id: typeof sessionId, file: File, _data: string) => ({
      file: {
        attachmentId: `sha256:${'b'.repeat(64)}` as never,
        mediaType: file.type,
        bytes: file.size,
        name: file.name,
      },
      parsing: { status: 'ready' as const, kind: 'utf8-text' as const },
      attachedAt: 2,
    }))
    const appendDraft = vi.fn()
    const view = render(<QuantSkillsAttachmentControl {...props({ upload, appendDraft })}/>)
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['a,b\n1,2\n'], 'factor.csv', { type: 'text/csv' })

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => { expect(appendDraft).toHaveBeenCalledTimes(1) })
    expect(upload).toHaveBeenCalledWith(sessionId, file, btoa('a,b\n1,2\n'))
    expect(appendDraft.mock.calls[0]?.[1]).toContain(`sha256:${'b'.repeat(64)}`)
    expect(appendDraft.mock.calls[0]?.[1]).not.toContain('a,b\n1,2')
    expect(screen.getByRole('status').textContent).toBe('已附加 1 个文件')
  })

  it('reports Host refusal without changing the draft', async () => {
    const appendDraft = vi.fn()
    const upload = vi.fn(async () => { throw new Error('Session attachment limit exceeded.') })
    const view = render(<QuantSkillsAttachmentControl {...props({ upload, appendDraft })}/>)
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files: [new File(['x'], 'x.bin')] } })

    await waitFor(() => { expect(screen.getByRole('status').textContent).toBe('Session attachment limit exceeded.') })
    expect(appendDraft).not.toHaveBeenCalled()
  })

  it('uploads a non-image dropped on the composer and shows its name', async () => {
    const upload = vi.fn(async (_id: typeof sessionId, file: File) => ({
      file: {
        attachmentId: `sha256:${'c'.repeat(64)}` as never,
        mediaType: file.type,
        bytes: file.size,
        name: file.name,
      },
      parsing: { status: 'unsupported' as const, reason: 'binary' },
      attachedAt: 3,
    }))
    const appendDraft = vi.fn()
    render(<Composer control={props({ upload, appendDraft })} />)
    const file = new File(['%PDF'], 'strategy.pdf', { type: 'application/pdf' })
    window.dispatchEvent(new CustomEvent('qs-composer-files', { detail: { sessionId, files: [file] } }))
    await waitFor(() => { expect(appendDraft).toHaveBeenCalledTimes(1) })
    expect(appendDraft.mock.calls[0]?.[1]).toContain(`sha256:${'c'.repeat(64)}`)
    expect(screen.getByText('strategy.pdf')).toBeTruthy()
  })

  it('clears the chip and composer attachment spacing after a successful send', async () => {
    const view = render(<Composer control={props()} />)
    fireEvent.change(view.container.querySelector('input[type="file"]')!, {
      target: { files: [new File(['content'], 'notes.txt', { type: 'text/plain' })] },
    })
    await screen.findByRole('button', { name: '移除文件 notes.txt' })
    expect(view.container.querySelector('[data-composer-files]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '发送成功' }))
    expect(screen.queryByRole('button', { name: '移除文件 notes.txt' })).toBeNull()
    expect(view.container.querySelector('[data-composer-files]')).toBeNull()
  })

  it('restores chips from a saved draft and follows manual reference removal', () => {
    render(<Composer control={props()} initialDraft={`请分析${reference}`} />)
    expect(screen.getByRole('button', { name: '移除文件 notes.txt' })).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: '草稿' }), { target: { value: '请分析' } })
    expect(screen.queryByRole('button', { name: '移除文件 notes.txt' })).toBeNull()
  })

  it('deduplicates chips and removes all references without deleting the user message', () => {
    render(<Composer control={props()} initialDraft={`请分析${reference}${reference}`} />)
    expect(screen.getAllByRole('button', { name: '移除文件 notes.txt' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '移除文件 notes.txt' }))
    expect((screen.getByRole('textbox', { name: '草稿' }) as HTMLTextAreaElement).value).toBe('请分析')
    expect(screen.queryByRole('button', { name: '移除文件 notes.txt' })).toBeNull()
  })

  it('reads the active session draft instead of retaining the previous session files', () => {
    const first = props({ useInput: ((select: (state: { draft: string }) => unknown) => select({ draft: reference })) as never })
    const view = render(<QuantSkillsAttachmentControl {...first} />)
    expect(screen.getByRole('button', { name: '移除文件 notes.txt' })).toBeTruthy()
    view.rerender(<QuantSkillsAttachmentControl {...props({ sessionId: 'other-session' as SessionId })} />)
    expect(screen.queryByRole('button', { name: '移除文件 notes.txt' })).toBeNull()
    view.rerender(<QuantSkillsAttachmentControl {...first} />)
    expect(screen.getByRole('button', { name: '移除文件 notes.txt' })).toBeTruthy()
  })

  it('removes the empty attachment block after a draft is pasted with paragraph spacing', () => {
    render(<Composer control={props()} initialDraft={`请分析${reference.replaceAll('\n', '\n\n')}\n\n保留这段补充说明`} />)
    fireEvent.click(screen.getByRole('button', { name: '移除文件 notes.txt' }))
    const draft = (screen.getByRole('textbox', { name: '草稿' }) as HTMLTextAreaElement).value
    expect(draft).toBe('请分析\n\n保留这段补充说明')
    expect(screen.queryByRole('button', { name: '移除文件 notes.txt' })).toBeNull()
  })
})
