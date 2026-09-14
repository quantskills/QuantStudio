import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { artifactResourceUrl } from './artifact-resource.ts'
import css from './PdfPreview.module.css'

let workerUrl: string | undefined
async function pdfLibrary() {
  const [pdf, source] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?raw')])
  workerUrl ??= URL.createObjectURL(new Blob([source.default], { type: 'text/javascript' }))
  pdf.GlobalWorkerOptions.workerSrc = workerUrl
  return pdf
}

/** Render one page at a time; never run document JavaScript or load remote resources. */
export function PdfPreview({ url, title, className }: { url: string; title: string; className?: string | undefined }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [document, setDocument] = useState<PDFDocumentProxy>()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let live = true
    let task: ReturnType<typeof import('pdfjs-dist').getDocument> | undefined
    setDocument(undefined); setPage(1); setStatus('loading')
    void pdfLibrary().then(pdf => {
      if (!live) return
      task = pdf.getDocument({ url: artifactResourceUrl(url), enableXfa: false,
        useSystemFonts: true, isOffscreenCanvasSupported: false })
      return task.promise.then(value => { if (live) setDocument(value) })
    }).catch((error: unknown) => {
      console.warn('QuantSkills PDF load:', error instanceof Error ? error.message.slice(0,500) : String(error))
      if (live) setStatus('error')
    })
    return () => { live = false; void task?.destroy().catch(() => {}) }
  }, [url, attempt])
  useEffect(() => {
    if (!document || !canvas.current) return
    let live = true
    let rendering: RenderTask | undefined
    const element = canvas.current
    setStatus('loading')
    void document.getPage(page).then(async value => {
      if (!live) return
      const base = value.getViewport({ scale: 1 })
      const scale = Math.min(1.5, 1200 / base.width, Math.sqrt(4_000_000 / (base.width * base.height)))
      const viewport = value.getViewport({ scale })
      element.width = Math.ceil(viewport.width); element.height = Math.ceil(viewport.height)
      const context = element.getContext('2d')
      if (!context) throw new Error('Canvas unavailable')
      rendering = value.render({ canvas: element, canvasContext: context, viewport })
      await rendering.promise
      if (live) setStatus('ready')
    }).catch((error: unknown) => {
      if (live) {
        console.warn('QuantSkills PDF render:', error instanceof Error ? error.message.slice(0,500) : String(error))
        setStatus('error')
      }
    })
    return () => { live = false; rendering?.cancel() }
  }, [document, page])
  return <div title={title} className={`${css.viewer} ${className ?? ''}`}>
    <div className={css.toolbar}>
      <button type="button" aria-label={`${title} 上一页`} disabled={!document || page === 1} onClick={() => setPage(n => n - 1)}>上一页</button>
      <span>{document ? `${page} / ${document.numPages}` : 'PDF'}</span>
      <button type="button" aria-label={`${title} 下一页`} disabled={!document || page === document.numPages} onClick={() => setPage(n => n + 1)}>下一页</button>
    </div>
    {status === 'loading' && <p role="status">正在绘制 PDF…</p>}
    {status === 'error' && <p role="status">PDF 预览暂不可用，可下载原文件。<button type="button" onClick={() => setAttempt(n => n + 1)}>重试</button></p>}
    <canvas ref={canvas} hidden={status !== 'ready'} role="img" aria-label={`${title} 第 ${page} 页`}/>
  </div>
}
