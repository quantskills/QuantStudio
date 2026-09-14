/** QuantSkills generic-file uploader mounted in the stock conversation tool row. */

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { QuantSkillsSessionFileAttachment } from './plugin-types.ts'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './QuantSkillsApp.module.css'

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

/** Upload selected files and append only their durable references to the current draft. */
export function QuantSkillsAttachmentControl({
  sessionId, controller, upload, appendDraft,
}: QuantSkillsAttachmentControlProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | undefined>()
  const choose = useCallback((): void => {
    if (!busy) inputRef.current?.click()
  }, [busy])
  useEffect(() => controller.register(sessionId, choose), [controller, sessionId, choose])
  const changed = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    if (files.length === 0) return
    setBusy(true)
    setStatus(`正在上传 ${String(files.length)} 个文件`)
    try {
      const attached: QuantSkillsSessionFileAttachment[] = []
      for (const file of files) {
        const data = await readCanonicalBase64(file)
        attached.push(await upload(sessionId, file, data))
      }
      const rows = attached.map(item => [
        `- ${item.file.name}`,
        `媒体类型 ${item.file.mediaType}`,
        `附件 id ${item.file.attachmentId}`,
        parsingLabel(item),
      ].join('；'))
      appendDraft(sessionId, [
        '',
        '[QuantSkills 附件]',
        ...rows,
        '需要读取可用文本时，请使用 quantskills_read_attachment，并传入上面的附件 id。',
      ].join('\n'))
      setStatus(`已附加 ${String(attached.length)} 个文件`)
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : '附件上传失败')
    } finally {
      setBusy(false)
    }
  }
  return <>
    <input
      ref={inputRef}
      className={css.attachmentInput}
      type="file"
      multiple
      tabIndex={-1}
      aria-hidden
      onChange={(event) => { void changed(event) }}
    />
    {status && <span className={css.attachmentStatus} role="status">{status}</span>}
  </>
}
