import { useEffect, useId, useRef, type ReactNode } from 'react'
import css from './ActionDialog.module.css'

/** Native modal: top-layer rendering, inert background and browser focus containment. */
export function ActionDialog({ title, children, busy = false, error, wide = false, onClose }: {
  title: string; children: ReactNode; busy?: boolean; error?: string | undefined; wide?: boolean; onClose(): void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current!
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    // DOM-only test runners do not implement showModal; browsers always use the top layer.
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
    return () => {
      if (typeof dialog.close === 'function') dialog.close()
      if (trigger?.isConnected) trigger.focus()
    }
  }, [])
  return <dialog ref={ref} className={css.dialog} data-wide={wide || undefined} aria-labelledby={titleId} aria-modal="true" aria-busy={busy}
    onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); return }
      if (event.key !== 'Tab') return
      const items = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')]
        .filter(element => element.getClientRects().length > 0 && !element.closest('[hidden]'))
      const first = items[0], last = items.at(-1)
      if (!first || !last) { event.preventDefault(); return }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }}
    onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <header className={css.header}><h2 id={titleId}>{title}</h2>
      <button type="button" aria-label={`关闭${title}`} disabled={busy} onClick={onClose}>×</button>
    </header>
    <div className={css.body}>
      {children}
      {error && <p role="alert" className={css.error}>{error}</p>}
    </div>
  </dialog>
}
