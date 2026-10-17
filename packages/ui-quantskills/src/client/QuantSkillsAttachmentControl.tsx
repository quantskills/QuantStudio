/** QuantSkills generic-file uploader mounted in the stock conversation tool row. */

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import type { QuantSkillsSessionFileAttachment } from './plugin-types.ts'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './QuantSkillsApp.module.css'

/** Dropped non-image files dispatched by the stock composer. */
export const COMPOSER_FILE_EVENT = 'qs-composer-files'

/** Session-addressed bridge from the shared composer launcher to the hidden native file input. */
export class QuantSkillsAttachmentController {
  private readonly openers = new Map<SessionId, () => void>()

  /** Register the currently mounted file input for one Session. */
  register(sessionId: SessionId, open: () => void): () => void {
    this.openers.set(sessionId, open)
    return () => {
      if (this.openers.get(sessionId) === open) this.openers.delete(sessionId)
    }
  }

  /** Open the native file chooser for the addressed Session when its composer is mounted. */
  open(sessionId: SessionId): boolean {
    const open = this.openers.get(sessionId)
    if (open === undefined) return false
    open()
    return true
  }
}

/** Application callbacks required by the generic-file input control. */
export interface QuantSkillsAttachmentControlInjected {
  controller: QuantSkillsAttachmentController
  upload: (sessionId: SessionId, file: File, data: string) => Promise<QuantSkillsSessionFileAttachment>
  appendDraft: (sessionId: SessionId, text: string) => void
  editDraft: (sessionId: SessionId, update: (draft: string) => string) => void
}

interface ComposerFileChip {
  readonly id: string
  readonly name: string
}

const FILE_HEADER = '[QuantSkills 附件]'
const FILE_HINT = '需要读取可用文本时，请使用 quantskills_read_attachment，并传入上面的附件 id。'

function fileReference(line: string): ComposerFileChip | undefined {
  const match = /^- (.+)；媒体类型 [^；]+；附件 id (sha256:[a-f0-9]{64})；.+$/.exec(line)
  return match?.[1] && match[2] ? { name: match[1], id: match[2] } : undefined
}

/** The draft is authoritative, including restored drafts and failed submissions. */
function draftFileChips(draft: string): readonly ComposerFileChip[] {
  const chips = new Map<string, ComposerFileChip>()
  for (const line of draft.split('\n')) {
    const chip = fileReference(line)
    if (chip !== undefined) chips.set(chip.id, chip)
  }
  return [...chips.values()]
}

/** Complete framework and application props for the generic-file input control. */
export type QuantSkillsAttachmentControlProps = PropsRuntime<'conversation.input.left'>
  & InjectFace<QuantSkillsAttachmentControlInjected>

function readCanonicalBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => { reject(reader.error ?? new Error(`Cannot read ${file.name}.`)) }
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error(`Cannot encode ${file.name}.`))
        return
      }
      const comma = reader.result.indexOf(',')
      if (comma < 0) {
        reject(new Error(`Cannot encode ${file.name}.`))
        return
      }
      resolve(reader.result.slice(comma + 1))
    }
    reader.readAsDataURL(file)
  })
}

function parsingLabel(attached: QuantSkillsSessionFileAttachment): string {
  switch (attached.parsing.status) {
    case 'ready': return attached.parsing.kind === 'utf8-text'
      ? '文本可读取'
      : `${attached.parsing.kind} 可提取文本`
    case 'unsupported': return `已保留，暂不支持解析：${attached.parsing.reason}`
    case 'failed': return `已保留，解析失败：${attached.parsing.reason}`
  }
}

function referenceLine(item: QuantSkillsSessionFileAttachment): string {
  return [
    `- ${item.file.name}`,
    `媒体类型 ${item.file.mediaType}`,
    `附件 id ${item.file.attachmentId}`,
    parsingLabel(item),
  ].join('；')
}

/** Upload selected files and append only their durable references to the current draft. */
export function QuantSkillsAttachmentControl({
  sessionId, controller, upload, appendDraft, editDraft, useInput,
}: QuantSkillsAttachmentControlProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const anchorRef = useRef<HTMLSpanElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | undefined>()
  const draft = useInput(state => state.draft)
  const chips = useMemo(() => draftFileChips(draft), [draft])
  const [card, setCard] = useState<HTMLElement | null>(null)
  const choose = useCallback((): void => {
    if (!busy) inputRef.current?.click()
  }, [busy])
  useEffect(() => controller.register(sessionId, choose), [controller, sessionId, choose])
  useEffect(() => {
    const found = anchorRef.current?.closest('[data-composer-card]')
    if (found instanceof HTMLElement) setCard(found)
  }, [])
  useEffect(() => {
    if (card === null) return
    if (chips.length > 0) card.setAttribute('data-composer-files', 'true')
    else card.removeAttribute('data-composer-files')
    return () => { card.removeAttribute('data-composer-files') }
  }, [card, chips.length])
  const attach = useCallback(async (files: readonly File[]): Promise<void> => {
    if (files.length === 0) return
    setBusy(true)
    setStatus(`正在上传 ${String(files.length)} 个文件`)
    try {
      const attached: QuantSkillsSessionFileAttachment[] = []
      for (const file of files) {
        const data = await readCanonicalBase64(file)
        attached.push(await upload(sessionId, file, data))
      }
      const rows = attached.map(referenceLine)
      appendDraft(sessionId, [
        '',
        FILE_HEADER,
        ...rows,
        FILE_HINT,
      ].join('\n'))
      setStatus(`已附加 ${String(attached.length)} 个文件`)
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : '附件上传失败')
    } finally {
      setBusy(false)
    }
  }, [appendDraft, sessionId, upload])
  useEffect(() => {
    const onFiles = (event: Event): void => {
      const detail = (event as CustomEvent<{ sessionId?: string, files?: File[] }>).detail
      if (detail?.sessionId !== sessionId || detail.files === undefined || detail.files.length === 0) return
      void attach(detail.files)
    }
    window.addEventListener(COMPOSER_FILE_EVENT, onFiles)
    return () => { window.removeEventListener(COMPOSER_FILE_EVENT, onFiles) }
  }, [attach, sessionId])
  const changed = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    void attach(files)
  }
  const removeChip = (chip: ComposerFileChip): void => {
    editDraft(sessionId, current => current.split('\n')
      .filter(line => fileReference(line)?.id !== chip.id).join('\n')
      .replaceAll(`${FILE_HEADER}\n${FILE_HINT}`, '')
      .replace(/\n{3,}/g, '\n\n').trimEnd())
  }
  const chipRow = chips.length === 0 ? null : (
    <div className={css.composerFileChips} data-composer-file-chips="">
      {chips.map(chip => (
        <span key={chip.id} className={css.composerFileChip}>
          <span>{chip.name}</span>
          <button type="button" aria-label={`移除文件 ${chip.name}`} onClick={() => { removeChip(chip) }}>×</button>
        </span>
      ))}
    </div>
  )
  return <>
    <span ref={anchorRef} hidden />
    {card !== null && chipRow !== null ? createPortal(chipRow, card) : chipRow}
    <input
      ref={inputRef}
      className={css.attachmentInput}
      type="file"
      multiple
      tabIndex={-1}
      aria-hidden
      onChange={changed}
    />
    {status && <span className={css.attachmentStatus} role="status">{status}</span>}
  </>
}
