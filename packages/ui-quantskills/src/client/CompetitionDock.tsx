import { useId, useState, type ReactNode } from 'react'
import css from './ContestPage.module.css'

/** Keep plan confirmation mounted and accessible even when account details are folded. */
export function CompetitionDock({ kind, label, title, subtitle, actions, children }: {
  kind: 'contest' | 'factor-contest'; label: string; title: ReactNode; subtitle: ReactNode;
  actions: ReactNode; children: ReactNode;
}) {
  const key = `quantskills:${kind}:dock-collapsed`
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(key) === 'true' } catch { return false }
  })
  const bodyId = useId()
  const toggle = () => {
    setCollapsed(!collapsed)
    try { localStorage.setItem(key, String(!collapsed)) } catch { /* storage may be disabled */ }
  }
  return <section className={css.conversation} aria-label={label} data-collapsed={collapsed}>
    <div className={css.conversationHeader}>
      <strong>{title}</strong>
      {!collapsed && <small>{subtitle}</small>}
      <div className={css.conversationControls}>
        {actions}
        <button type="button" aria-label={`${collapsed ? '展开' : '收起'}${label}`} aria-expanded={!collapsed}
          aria-controls={bodyId} onClick={toggle}>{collapsed ? '展开' : '收起'}</button>
      </div>
    </div>
    <div id={bodyId} className={css.conversationBody} hidden={collapsed}>{children}</div>
  </section>
}
