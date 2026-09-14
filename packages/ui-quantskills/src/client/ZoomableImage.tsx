import { useCallback, useEffect, useId, useRef, useState, type ImgHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import css from './ZoomableImage.module.css'

type Size = { width: number; height: number }
type View = { scale: number; x: number; y: number; fit: boolean }
const initialView: View = { scale: 1, x: 0, y: 0, fit: true }
const fitScale = (image: Size, area: Size) => Math.min(1, Math.max(1, area.width - 48) / image.width, Math.max(1, area.height - 48) / image.height)
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
function constrain(view: View, image: Size, area: Size): View {
  const x = Math.max(0, (image.width * view.scale - area.width) / 2 + 24)
  const y = Math.max(0, (image.height * view.scale - area.height) / 2 + 24)
  return { ...view, x: clamp(view.x, -x, x), y: clamp(view.y, -y, y) }
}

/** Shared by inline deliveries and the workbench; the viewer escapes scaled panels. */
export function ZoomableImage({ alt = '', className, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [expanded, setExpanded] = useState(false)
  return <>
    <img {...props} alt={alt} className={`${className ?? ''} ${css.thumbnail}`} tabIndex={0} aria-haspopup="dialog" title="双击放大图片；也可按 Enter 打开"
      onDoubleClick={event => { event.currentTarget.focus(); setExpanded(true) }}
      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setExpanded(true) } }}/>
    {expanded && props.src && createPortal(<ImageViewer src={props.src} title={alt || '图片'} onClose={() => setExpanded(false)}/>, document.body)}
  </>
}

function ImageViewer({ src, title, onClose }: { src: string; title: string; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null), stage = useRef<HTMLDivElement>(null)
  const titleId = useId(), hintId = useId()
  const [natural, setNatural] = useState<Size>({ width: 1, height: 1 })
  const [area, setArea] = useState<Size>({ width: 1, height: 1 })
  const [view, setView] = useState<View>(initialView), [ready, setReady] = useState(false), [failed, setFailed] = useState(false)
  const drag = useRef<{ id: number; x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  useEffect(() => {
    const element = dialog.current!, trigger = document.activeElement
    if (typeof element.showModal === 'function') element.showModal()
    else element.setAttribute('open', '')
    return () => { element.close?.(); if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus() }
  }, [])
  useEffect(() => {
    const measure = () => {
      const bounds = stage.current!.getBoundingClientRect(), next = { width: bounds.width, height: bounds.height }
      setArea(next)
      setView(current => current.fit ? { ...initialView, scale: fitScale(natural, next) } : constrain(current, natural, next))
    }
    measure()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : undefined
    observer?.observe(stage.current!)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [natural])
  const zoom = useCallback((factor: number, x = 0, y = 0) => {
    if (!ready) return
    setView(current => {
      const scale = clamp(current.scale * factor, Math.min(.1, fitScale(natural, area)), 16), ratio = scale / current.scale
      return constrain({ scale, x: x - (x - current.x) * ratio, y: y - (y - current.y) * ratio, fit: false }, natural, area)
    })
  }, [ready, natural, area])
  const fit = () => setView({ ...initialView, scale: fitScale(natural, area) })
  useEffect(() => {
    const element = stage.current!
    const wheel = (event: WheelEvent) => {
      event.preventDefault(); event.stopPropagation()
      const bounds = element.getBoundingClientRect()
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? bounds.height : 1)
      zoom(Math.exp(-clamp(delta, -300, 300) * .0025), event.clientX - bounds.left - bounds.width / 2, event.clientY - bounds.top - bounds.height / 2)
    }
    // React delegates wheel listeners passively; bind locally to keep the page still.
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [zoom])
  return <dialog ref={dialog} className={css.viewer} aria-labelledby={titleId} aria-describedby={hintId} aria-modal="true"
    onCancel={event => { event.preventDefault(); onClose() }} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
      else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1.25) }
      else if (event.key === '-') { event.preventDefault(); zoom(.8) }
      else if (event.key === '0') { event.preventDefault(); fit() }
    }}>
    <header className={css.toolbar}>
      <h2 id={titleId}>{title}</h2>
      <div className={css.controls}>
        <button type="button" disabled={!ready} aria-label="缩小图片" onClick={() => zoom(.8)}>−</button>
        <output aria-label="图片缩放比例">{Math.round(view.scale * 100)}%</output>
        <button type="button" disabled={!ready} aria-label="放大图片" onClick={() => zoom(1.25)}>＋</button>
        <button type="button" disabled={!ready} onClick={fit}>适应窗口</button>
        <button type="button" disabled={!ready} onClick={() => setView({ ...initialView, fit: false })}>原始尺寸</button>
        <button type="button" aria-label="关闭图片预览" onClick={onClose}>×</button>
      </div>
    </header>
    <div ref={stage} className={css.stage} data-dragging={dragging || undefined} role="region" aria-label="图片缩放画布"
      onDoubleClick={() => view.fit ? setView({ ...initialView, fit: false }) : fit()}
      onPointerDown={event => {
        if (event.button !== 0 || !ready) return
        event.preventDefault(); stage.current?.focus(); event.currentTarget.setPointerCapture?.(event.pointerId)
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY }; setDragging(true)
      }} onPointerMove={event => {
        const previous = drag.current
        if (!previous || previous.id !== event.pointerId) return
        const dx = event.clientX - previous.x, dy = event.clientY - previous.y
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
        setView(current => constrain({ ...current, x: current.x + dx, y: current.y + dy, fit: false }, natural, area))
      }} onPointerUp={event => { if (drag.current?.id === event.pointerId) { drag.current = null; setDragging(false); event.currentTarget.releasePointerCapture?.(event.pointerId) } }}
      onPointerCancel={() => { drag.current = null; setDragging(false) }} onLostPointerCapture={() => { drag.current = null; setDragging(false) }} tabIndex={0}>
      {failed ? <p role="alert">图片暂时无法加载，请关闭后重试。</p> : <>
        {!ready && <p role="status">正在加载图片…</p>}
        <img src={src} alt={title} draggable={false} className={css.fullImage} data-ready={ready || undefined}
          style={{ width: natural.width, height: natural.height, transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
          onLoad={event => { const image = event.currentTarget; setNatural({ width: image.naturalWidth || 1, height: image.naturalHeight || 1 }); setReady(true) }}
          onError={() => { setFailed(true); setReady(false) }}/>
      </>}
    </div>
    <footer id={hintId}>滚轮缩放 · 拖动查看 · 双击切换原图 / 适应窗口 · Esc 关闭</footer>
  </dialog>
}
