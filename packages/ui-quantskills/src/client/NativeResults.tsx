/** QS result facts live inside the official dock; file navigation belongs to DSH. */
import { useEffect, useState } from 'react'
import { ArrowClockwise, DownloadSimple, FileText, FolderOpen } from '@phosphor-icons/react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import { parseFileAddress } from '@deepseek-ai/dsh-util-workspace-path'
import type { QuantSkillsPreparedResultArtifact } from './result-data.ts'
import { projectQuantSkillsResults } from './result-data.ts'
import type { QuantSkillsResultPreview } from './plugin-types.ts'
import { artifactResourceUrl } from './artifact-resource.ts'
import { InteractiveHtml } from './InteractiveHtml.tsx'
import css from './NativeResults.module.css'

// Host limits each preparation request, not the total number of session results.
const RESULT_PREPARE_BATCH_SIZE = 100

export interface NativeResultsInjected {
  listFiles: (signal: AbortSignal) => Promise<readonly QuantSkillsPreparedResultArtifact[]>
  prepareFiles: (paths: readonly string[], signal: AbortSignal) => Promise<readonly QuantSkillsPreparedResultArtifact[]>
  openFile: (path: string) => void
  openWorkspace: () => void
  downloadFile: (path: string) => void
}

export function NativeResults({ sessionId, useSession, useSessions, useChat, listFiles, prepareFiles, openFile, openWorkspace, downloadFile }:
  PropsRuntime<'sidebar.right.pane.tab'> & InjectFace<NativeResultsInjected>) {
  const running = useSession(state => state.running)
  const title = useSessions(state => state.byId[sessionId]?.displayTitle ?? '本次对话')
  const candidatePaths = useChat(snapshot => JSON.stringify(projectQuantSkillsResults(snapshot).files.map(file => file.path)))
  const [revision, setRevision] = useState(0)
  const [files, setFiles] = useState<readonly QuantSkillsPreparedResultArtifact[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [openFailed, setOpenFailed] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setFiles([])
    const paths = JSON.parse(candidatePaths) as string[]
    const results = new Map<string, QuantSkillsPreparedResultArtifact>()
    let failed = false
    const read = async (load: () => Promise<readonly QuantSkillsPreparedResultArtifact[]>) => {
      try {
        const value = await load()
        if (controller.signal.aborted) return
        for (const file of value) {
          // A failed duplicate must not hide a file another read successfully verified.
          if (file.status !== 'unavailable' || !results.has(file.path) || results.get(file.path)?.status === 'unavailable') results.set(file.path, file)
        }
        setFiles([...results.values()])
      } catch {
        failed = true
      }
    }
    const prepare = async () => {
      for (let offset = 0; offset < paths.length && !controller.signal.aborted; offset += RESULT_PREPARE_BATCH_SIZE) {
        await read(() => prepareFiles(paths.slice(offset, offset + RESULT_PREPARE_BATCH_SIZE), controller.signal))
      }
    }
    void Promise.all([read(() => listFiles(controller.signal)), prepare()]).then(() => {
      if (!controller.signal.aborted) setStatus(failed ? 'error' : 'ready')
    })
    return () => controller.abort()
  }, [sessionId, listFiles, prepareFiles, candidatePaths, running, revision])
  const uniqueFiles = [...new Map(files.map(file => [file.path, file])).values()]
  const available = uniqueFiles.filter(file => file.status !== 'unavailable')
  return <section className={css.results} aria-label="本对话结果">
    <header className={css.header}>
      <div><strong>{title}</strong><span>{running ? '进行中 · 完成后更新文件' : '本对话的交付文件'}</span></div>
      <button type="button" title="刷新结果" aria-label="刷新结果" onClick={() => setRevision(n => n + 1)}><ArrowClockwise size={16}/></button>
      <button type="button" title="浏览工作区" aria-label="浏览工作区" onClick={openWorkspace}><FolderOpen size={16}/></button>
    </header>
    <div className={css.list}>
      {status === 'loading' && <p role="status">正在读取文件…</p>}
      {status === 'error' && <p role="alert">{files.length > 0 ? '部分结果未能读取，已保留成功结果，请刷新重试。' : '暂时无法读取结果，请刷新重试。'}</p>}
      {status === 'ready' && files.length === 0 && <p>生成报告、图表或文件后，会显示在这里。</p>}
      {uniqueFiles.map(file => <div className={css.file} key={file.path}>
        <button type="button" title={file.path} disabled={file.status === 'unavailable'} onClick={() => {
          setOpenFailed(false)
          try { openFile(file.path) } catch { setOpenFailed(true) }
        }}><FileText size={18}/><span><b>{file.path.replaceAll('\\', '/').split('/').at(-1)}</b><small>{file.status === 'unavailable' ? file.reason ?? '文件不可用' : file.path}</small></span></button>
        {file.status !== 'unavailable' && <button type="button" title="下载原文件" aria-label={`下载 ${file.path}`} onClick={() => downloadFile(file.path)}><DownloadSimple size={16}/></button>}
      </div>)}
      {openFailed && <p role="alert">暂时无法打开预览，请重试。</p>}
    </div>
    {available.length > 0 && <footer className={css.footer}>
      <span>{available.length} 个文件</span>
    </footer>}
  </section>
}

export interface NativeMediaInjected {
  previewFile: (sessionId: string, path: string, signal?: AbortSignal) => Promise<QuantSkillsResultPreview>
}

/** Preserve QS media and isolated HTML within the official tab lifecycle. */
export function NativeResultMedia({ useTabInfo, previewFile }: PropsRuntime<'sidebar.right.pane.tab'> & InjectFace<NativeMediaInjected>) {
  const { tab } = useTabInfo()
  const file = parseFileAddress(tab.contentId)
  const sessionId = file?.scope === 'session' ? file.sessionId : undefined
  const path = file?.path
  const [attempt, setAttempt] = useState(0)
  const [media, setMedia] = useState<{ kind: 'audio' | 'video'; url: string } | { kind: 'html'; source: string }>()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    setMedia(undefined); setFailed(false)
    if (sessionId === undefined || path === undefined) { setFailed(true); return }
    void previewFile(sessionId, path, controller.signal).then(async value => {
      if (controller.signal.aborted) return
      if (value.kind === 'text' && value.mediaType === 'text/html') {
        setMedia({ kind: 'html', source: value.text }); return
      }
      if (value.kind === 'resource' && value.presentation === 'text' && value.mediaType === 'text/html') {
        const response = await fetch(artifactResourceUrl(value.url), { signal: controller.signal, credentials: 'same-origin', redirect: 'error' })
        if (!response.ok) throw new Error('Failed to read HTML report')
        const source = await response.text()
        if (!controller.signal.aborted) setMedia({ kind: 'html', source })
        return
      }
      if (value.kind !== 'resource' || (value.presentation !== 'video' && value.presentation !== 'audio')) throw new Error('Unsupported media')
      setMedia({ kind: value.presentation, url: artifactResourceUrl(value.url) })
    }).catch(() => { if (!controller.signal.aborted) setFailed(true) })
    return () => controller.abort()
  }, [sessionId, path, tab.navigation.revision, previewFile, attempt])
  return <section className={css.media} aria-label="文件预览">
    <header className={css.header}><span title={path}>{path}</span><button type="button" aria-label="刷新预览" onClick={() => setAttempt(n => n + 1)}><ArrowClockwise size={16}/></button></header>
    {failed ? <p role="alert">暂时无法预览，请重新加载。</p> : !media ? <p role="status">正在读取文件…</p>
      : media.kind === 'html' ? <InteractiveHtml source={media.source} title={path ?? 'HTML 报告'} className={css.html}/>
      : media.kind === 'video' ? <video key={`${tab.contentId}:${attempt}`} src={media.url} controls playsInline preload="metadata" onError={() => setFailed(true)}/>
        : <audio key={`${tab.contentId}:${attempt}`} src={media.url} controls preload="metadata" onError={() => setFailed(true)}/>}
  </section>
}
