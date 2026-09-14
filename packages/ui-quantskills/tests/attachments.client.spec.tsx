// @vitest-environment jsdom

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
    useSession: vi.fn() as never,
    useProjection: vi.fn() as never,
    useInput: vi.fn() as never,
    inputActions: {} as never,
    session: {} as never,
    input: {} as never,
    ...overrides,
  } as QuantSkillsAttachmentControlProps
}

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
})
