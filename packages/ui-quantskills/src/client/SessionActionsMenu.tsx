import { useId, useLayoutEffect, useRef, useState } from 'react'
import { ArchiveBoxIcon, DotsThreeVerticalIcon, PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react'
import css from './SessionActionsMenu.module.css'

/** The top layer keeps the menu clear of the scrollable conversation sidebar. */
export function SessionActionsMenu({ title, running, onRename, onArchive, onRemove }: {
  title: string
  running: boolean
  onRename?: (() => void) | undefined
  onArchive?: (() => void) | undefined
  onRemove(): void
}) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const id = useId()
  const close = (restoreFocus = false) => {
    if (restoreFocus) trigger.current?.focus({ preventScroll: true })
    setOpen(false)
  }
  useLayoutEffect(() => {
    if (!open) return
    const menu = panel.current!
    // JSDOM does not implement popovers. Production browsers render in the top layer.
    if (typeof menu.showPopover === 'function') { menu.setAttribute('popover', 'manual'); menu.showPopover() }
    const anchor = trigger.current!.getBoundingClientRect()
    const bounds = menu.getBoundingClientRect()
    const scale = menu.offsetWidth > 0 ? bounds.width / menu.offsetWidth : 1
    const left = Math.max(8, Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - 8))
    const top = anchor.bottom + 6 + bounds.height <= window.innerHeight - 8
      ? anchor.bottom + 6 : Math.max(8, anchor.top - bounds.height - 6)
    menu.style.left = `${left / scale}px`
    menu.style.top = `${top / scale}px`
    menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true })
    const dismiss = (event: PointerEvent) => {
      if (!menu.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true) }
    }
    const leave = (event: Event) => { if (!menu.contains(event.target as Node)) close() }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape, true)
    window.addEventListener('resize', leave)
    document.addEventListener('scroll', leave, true)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape, true)
      window.removeEventListener('resize', leave)
      document.removeEventListener('scroll', leave, true)
    }
  }, [open])
  const choose = (action: () => void) => { close(true); action() }
  return <div className={css.root}>
    <button ref={trigger} type="button" className={css.trigger} title="会话操作"
      aria-label={`会话操作 ${title}`} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => setOpen(!open)}
      onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true) } }}>
      <DotsThreeVerticalIcon size={21} weight="bold"/>
    </button>
    {open && <div ref={panel} id={id} role="menu" aria-label={`会话操作 ${title}`} className={css.menu}
      onBlur={event => { if (event.relatedTarget && event.relatedTarget !== trigger.current && !event.currentTarget.contains(event.relatedTarget)) close() }}
      onKeyDown={event => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
        const current = items.indexOf(document.activeElement as HTMLButtonElement)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
          : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
        items[next]?.focus()
      }}>
      {onRename && <button type="button" role="menuitem" aria-label={`重命名会话 ${title}`} onClick={() => choose(onRename)}><PencilSimpleIcon size={17}/>重命名</button>}
      {onArchive && <button type="button" role="menuitem" aria-label={`归档会话 ${title}`} disabled={running} onClick={() => choose(onArchive)}><ArchiveBoxIcon size={17}/>归档</button>}
      <div className={css.separator}/>
      <button type="button" role="menuitem" className={css.danger} aria-label={`删除会话 ${title}`} disabled={running} onClick={() => choose(onRemove)}><TrashIcon size={17}/>删除</button>
      {running && <small>运行中，请先停止再归档或删除</small>}
    </div>}
  </div>
}
