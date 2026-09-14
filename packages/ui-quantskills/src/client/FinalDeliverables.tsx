import { useEffect, useState } from 'react'
import { ArrowUpRight, DownloadSimple, FileText, CaretDown, CaretRight } from '@phosphor-icons/react'
import type { FinalDeliverable, FinalDeliverablesOwnerProps } from '@deepseek-ai/dsh-client-ui-chat/client'
import type { QuantSkillsResultPreview } from '@deepseek-ai/dsh-quantskills-session/types'
import { InteractiveHtml } from './InteractiveHtml.tsx'
import { PdfPreview } from './PdfPreview.tsx'
import { ZoomableImage } from './ZoomableImage.tsx'
import { artifactResourceUrl } from './artifact-resource.ts'
import css from './FinalDeliverables.module.css'

export interface FinalDeliverablesInjected {
  previewFile: (path: string) => Promise<QuantSkillsResultPreview>
  openWorkbench: (path: string) => void
  downloadFile?: ((path: string) => void) | undefined
}
type PreviewState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; value: QuantSkillsResultPreview }
const sizeLabel = (n: number): string => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`
function Delivery({ item, previewFile, openWorkbench, downloadFile }: { item: FinalDeliverable } & FinalDeliverablesInjected) {
  const inlinePreview = /\.(png|jpe?g|gif|webp|svg|html?|mp[34]|wav|ogg|webm|m4a|pdf)$/i.test(item.path)
  const [expanded, setExpanded] = useState(/\.(png|jpe?g|gif|webp|html?|mp[34]|wav|ogg|webm|m4a)$/i.test(item.path))
  const [state, setState] = useState<PreviewState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [mediaFailed, setMediaFailed] = useState(false)
  useEffect(() => {
    if (!expanded) return
    let live = true
    setState({ status: 'loading' }); setMediaFailed(false)
    void Promise.resolve().then(() => previewFile(item.path)).then(value => {
      if (live) setState(value.path === item.path ? { status: 'ready', value } : { status: 'error' })
    }, () => { if (live) setState({ status: 'error' }) })
    return () => { live = false }
  }, [item.path, previewFile, expanded, attempt])
  const value = state.status === 'ready' ? state.value : undefined
  let resource: string | undefined
  if (value?.kind === 'resource') { try { resource = artifactResourceUrl(value.url) } catch { /* Recoverable preview error. */ } }
  const image = value?.kind === 'binary' && value.mediaType.startsWith('image/') ? `data:${value.mediaType};base64,${value.data}`
    : value?.kind === 'resource' && value.presentation === 'image' ? resource : undefined
  const html = value?.kind === 'text' && value.mediaType === 'text/html' ? value.text : undefined
  const title = item.title
  return <article className={`${css.card} ${item.presentation === 'interactive' ? css.interactive : ''}`} data-delivery-path={item.path}>
    <header className={css.header}>
      <button className={css.toggle} type="button" aria-expanded={inlinePreview ? expanded : undefined} onClick={() => inlinePreview ? setExpanded(!expanded) : openWorkbench(item.path)} title={inlinePreview ? title : `在右侧打开 ${title}`}>
        {inlinePreview ? expanded ? <CaretDown size={16}/> : <CaretRight size={16}/> : <ArrowUpRight size={16}/>}<FileText size={18}/><span>{title}</span>
      </button>
      <button className={css.open} type="button" aria-label={`在右侧展开 ${title}`} onClick={() => openWorkbench(item.path)} title="在右侧展开"><ArrowUpRight size={18}/></button>
      {downloadFile && <button className={css.open} type="button" aria-label={`下载 ${title}`} onClick={() => downloadFile(item.path)} title="下载原文件"><DownloadSimple size={18}/></button>}
    </header>
    {expanded && <div className={css.body}>
      {state.status === 'loading' ? <p role="status">正在读取预览…</p>
        : state.status === 'error' || mediaFailed || (value?.kind === 'resource' && !resource) ? <div className={css.feedback} role="status">暂时无法预览。<button type="button" onClick={() => setAttempt(n => n + 1)}>重试</button></div>
          : html !== undefined ? <InteractiveHtml source={html} title={`${title} 交互预览`} className={css.frame}/>
            : image ? <ZoomableImage className={css.image} src={image} loading="lazy" alt={title} onError={() => setMediaFailed(true)}/>
              : value?.kind === 'resource' && value.presentation === 'audio' ? <audio key={attempt} className={css.audio} controls preload="none" aria-label={title} src={resource} onError={() => setMediaFailed(true)}/>
                : value?.kind === 'resource' && value.presentation === 'video' ? <video key={attempt} className={css.video} controls playsInline preload="none" aria-label={title} src={resource} onError={() => setMediaFailed(true)}/>
                  : value?.kind === 'resource' && value.presentation === 'pdf' && resource ? <PdfPreview key={attempt} className={css.frame} title={`${title} PDF 预览`} url={resource}/>
                    : <p>在右侧查看完整内容，或下载原文件。</p>}
      {value && <p className={css.caption}>{item.path.split('.').at(-1)?.toUpperCase()} · {sizeLabel(value.bytes)}{html !== undefined ? ' · 可交互，外部网络已隔离' : ''}</p>}
    </div>}
  </article>
}
export function FinalDeliverables({ items, openWorkbench, previewFile, downloadFile }: FinalDeliverablesOwnerProps & FinalDeliverablesInjected) {
  const [limit, setLimit] = useState(6)
  return <section className={css.deliveries} aria-label="本轮交付">
    {items.slice(0, limit).map(item => <Delivery key={item.path} item={item} openWorkbench={openWorkbench} previewFile={previewFile} downloadFile={downloadFile}/>)}
    {items.length > limit && <button type="button" className={css.more} onClick={() => setLimit(n => n + 6)}>显示更多文件（还有 {items.length - limit} 个）</button>}
  </section>
}
