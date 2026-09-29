import { useEffect, useRef, useState } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionDeletionPreview } from '@deepseek-ai/dsh-quantskills-session/types'
import { ArchiveBoxIcon, ArrowCounterClockwiseIcon, TrashIcon } from '@phosphor-icons/react'
import { ActionDialog } from './ActionDialog.tsx'
import { SessionActionsMenu } from './SessionActionsMenu.tsx'
import css from './ArchivedSessions.module.css'

export interface ArchivedSession {
  sessionId: SessionId
  title: string
  kind: 'plain' | 'skill' | 'agent' | 'team'
  updatedAt: number
  running: boolean
}
export interface SessionHistoryAccess {
  list(): Promise<readonly ArchivedSession[]>
  archive(ids: readonly SessionId[]): Promise<void>
  remove(ids: readonly SessionId[]): Promise<void>
  restore(id: SessionId): Promise<void>
  files?: SessionFileDeletionAccess
}
export interface SessionFileDeletionAccess {
  preview(ids: readonly SessionId[]): Promise<readonly SessionDeletionPreview[]>
  remove(previews: readonly SessionDeletionPreview[]): Promise<void>
}
const labels = { plain: '普通会话', skill: '技能', agent: '专家', team: '专家团' }
const message = (error: unknown) => error instanceof Error ? error.message : '操作失败，请重试。'

export function DeleteSessionConfirmation({ title, busy, error, onClose, onConfirm, heading = '删除会话？', confirmLabel = '会话删除', retainedRunningCount = 0, ids, filesAccess, onComplete }: {
  title: string; busy: boolean; error?: string | undefined; onClose(): void; onConfirm(): void
  heading?: string; confirmLabel?: string; retainedRunningCount?: number
  ids?: readonly SessionId[] | undefined; filesAccess?: SessionFileDeletionAccess | undefined; onComplete?: (() => void) | undefined
}) {
  const [previews, setPreviews] = useState<readonly SessionDeletionPreview[]>()
  const [loading, setLoading] = useState(false)
  const [filesError, setFilesError] = useState<string>()
  const defaultButton = useRef<HTMLButtonElement>(null)
  const reviewingFiles = Boolean(previews)
  // Focus after the native dialog opens; reviewing files defaults to going back.
  useEffect(() => { defaultButton.current?.focus() }, [reviewingFiles])
  const disabled = busy || loading
  const preview = async () => {
    if (!filesAccess || !ids) return
    setLoading(true); setFilesError(undefined)
    try { setPreviews(await filesAccess.preview(ids)) } catch (cause) { setFilesError(message(cause)) }
    finally { setLoading(false) }
  }
  const complete = async () => {
    if (!filesAccess || !previews) return
    setLoading(true); setFilesError(undefined)
    try { await filesAccess.remove(previews); onComplete?.(); onClose() }
    catch (cause) { setFilesError(message(cause)); setPreviews(undefined) }
    finally { setLoading(false) }
  }
  const files = previews?.flatMap(preview => preview.files) ?? []
  const retained = previews?.flatMap(preview => preview.retained) ?? []
  return <ActionDialog title={previews ? '再次确认完整删除' : heading} busy={disabled} error={filesError ?? error} onClose={onClose}>
    <p>「{title}」的对话记录及子任务记录将被永久删除，无法恢复。</p>
    {previews ? <>
      <p>{files.length ? `完整删除还会永久删除以下 ${files.length} 个生成文件，文件删除后无法恢复。请核对清单后再确认。` : '未找到可安全清理的生成文件。本次仅删除会话记录，工作区文件保留。'}</p>
      {files.length > 0 && <ul className={css.fileList}>{files.map(file => <li key={file.path}><code>{file.path}</code><small>{Math.max(1, Math.ceil(file.bytes / 1024))} KB</small></li>)}</ul>}
      {retained.length > 0 && <details className={css.retained}><summary>{retained.length} 个文件或路径将保留</summary><ul>{retained.map((file, index) => <li key={index}><code>{file.path}</code><small>{file.reason}</small></li>)}</ul></details>}
      <p>上传文件、工作区原有文件、其他会话引用的文件，以及已创建的技能、专家和专家团会保留。不会清空整个工作区。</p>
    </> : <p>默认「会话删除」仅删除会话记录，保留生成文件。选择「完整删除」后，需要核对文件清单并再次确认。已创建的技能、专家、专家团会保留。</p>}
    {retainedRunningCount > 0 && <p>{retainedRunningCount} 个运行中的会话会保留。</p>}
    <footer className={css.actions}>
      <button type="button" disabled={disabled} onClick={onClose}>取消</button>
      {previews ? <>
        <button key="back" ref={defaultButton} type="button" disabled={disabled} onClick={() => setPreviews(undefined)}>返回</button>
        <button key="confirm-full" type="button" className={css.danger} disabled={disabled} onClick={() => { void complete() }}>{loading ? '正在删除…' : '确认完整删除'}</button>
      </> : <>
        {filesAccess && ids && <button key="preview-full" type="button" disabled={disabled} onClick={() => { void preview() }}>{loading ? '正在核对文件…' : '完整删除'}</button>}
        <button key="session-only" ref={defaultButton} type="button" className={css.primary} disabled={disabled} onClick={onConfirm}>{busy ? '正在删除…' : confirmLabel}</button>
      </>}
    </footer>
  </ActionDialog>
}

export function ArchiveSessionConfirmation({ title, busy, error, onClose, onConfirm }: {
  title: string; busy: boolean; error?: string | undefined; onClose(): void; onConfirm(): void
}) {
  return <ActionDialog title="归档会话？" busy={busy} error={error} onClose={onClose}>
    <p>{title}将从当前会话列表移出，对话记录会保留。</p>
    <p>之后可在「设置 → 归档会话」中查看或恢复，继续原来的对话。</p>
    <footer className={css.actions}>
      <button type="button" disabled={busy} onClick={onClose}>取消</button>
      <button type="button" className={css.primary} disabled={busy} onClick={onConfirm}>{busy ? '正在归档…' : '确认归档'}</button>
    </footer>
  </ActionDialog>
}

/** Cards and the conversation sidebar share the same compact action menu. */
export function SessionHistoryMenu({ id, title, running, access }: {
  id: SessionId; title: string; running: boolean; access: SessionHistoryAccess | undefined
}) {
  const [archiving, setArchiving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  if (!access) return null
  const archive = async () => {
    setBusy(true); setError(undefined)
    try { await access.archive([id]); setArchiving(false) } catch (cause) { setError(message(cause)) }
    finally { setBusy(false) }
  }
  const remove = async () => {
    setBusy(true); setError(undefined)
    try { await access.remove([id]); setDeleting(false) } catch (cause) { setError(message(cause)) }
    finally { setBusy(false) }
  }
  return <>
    <SessionActionsMenu title={title} running={running}
      onArchive={() => { setArchiving(true); setError(undefined) }}
      onRemove={() => { setDeleting(true); setError(undefined) }}/>
    {archiving && <ArchiveSessionConfirmation title={`「${title}」`} busy={busy} error={error}
      onClose={() => setArchiving(false)} onConfirm={() => { void archive() }}/>}
    {deleting && <DeleteSessionConfirmation title={title} busy={busy} error={error}
      ids={[id]} filesAccess={access.files}
      onClose={() => setDeleting(false)} onConfirm={() => { void remove() }}/>}
  </>
}

export function ArchivedSessions({ access }: { access: SessionHistoryAccess | undefined }) {
  const [rows, setRows] = useState<readonly ArchivedSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<ArchivedSession>()
  const reload = async () => {
    if (!access) { setLoading(false); setError('归档服务暂不可用，请重新加载应用。'); return }
    setLoading(true); setError(undefined)
    try { setRows(await access.list()) } catch (cause) { setError(message(cause)) }
    finally { setLoading(false) }
  }
  useEffect(() => { void reload() }, [access])
  const change = async (row: ArchivedSession, action: 'restore' | 'delete') => {
    if (!access) return
    setBusy(true); setError(undefined); setNotice('')
    try {
      if (action === 'restore') await access.restore(row.sessionId)
      else await access.remove([row.sessionId])
      setRows(previous => previous.filter(item => item.sessionId !== row.sessionId))
      setPending(undefined)
      setNotice(action === 'restore' ? '已恢复，可在会话列表继续原来的对话。' : '会话已永久删除。')
    } catch (cause) { setError(message(cause)) }
    finally { setBusy(false) }
  }
  const filtered = rows.filter(row => `${row.title} ${labels[row.kind]}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  return <div className={css.archives}>
    <header><div><h2>归档会话 <span>{rows.length}</span></h2><p>归档保留完整对话。恢复后可继续，永久删除后无法找回。</p></div>
      <button type="button" disabled={loading || busy} onClick={() => { void reload() }}>刷新</button></header>
    <input className={css.search} aria-label="搜索归档会话" placeholder="搜索会话名称或类型" value={search} onChange={event => setSearch(event.target.value)}/>
    {error && !pending && <p role="alert" className={css.error}>{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {loading ? <p role="status">正在读取归档…</p> : filtered.length === 0 ? <div className={css.empty}>
      <ArchiveBoxIcon size={35}/><h3>{search ? '没有匹配的归档会话' : '暂无归档会话'}</h3>
      <p>{search ? '试试其他名称或会话类型。' : '在会话的操作菜单中选择“归档”，即可在这里管理。'}</p>
    </div> : <ul className={css.list}>{filtered.map(row => <li key={row.sessionId}>
      <ArchiveBoxIcon size={23}/><div className={css.description}><b>{row.title}</b><small>{labels[row.kind]} · {new Date(row.updatedAt).toLocaleString('zh-CN')}</small></div>
      <div className={css.actions}>
        <button type="button" disabled={busy || row.running} onClick={() => { void change(row, 'restore') }} aria-label={`恢复 ${row.title}`}><ArrowCounterClockwiseIcon size={17}/>恢复</button>
        <button type="button" disabled={busy || row.running} onClick={() => { setPending(row); setError(undefined) }} aria-label={`会话删除 ${row.title}`}><TrashIcon size={17}/>删除</button>
      </div>
    </li>)}</ul>}
    {pending && <DeleteSessionConfirmation title={pending.title} busy={busy} error={error}
      ids={[pending.sessionId]} filesAccess={access?.files} onComplete={() => { void reload() }}
      onClose={() => setPending(undefined)} onConfirm={() => { void change(pending, 'delete') }}/>}
  </div>
}
