import { CaretDownIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import './JevSettings.css'

export function JevSettingsDisclosure({ title, description, icon, badge, open, children, compact = false }: {
  title: string; description?: string; icon: ReactNode; badge?: string; open?: boolean; children: ReactNode; compact?: boolean
}) {
  return <details className="qs-jev-settings-disclosure" data-compact={compact || undefined} open={open}>
    <summary>
      <span className="qs-jev-disclosure-icon" aria-hidden="true">{icon}</span>
      <span className="qs-jev-disclosure-copy"><strong>{title}</strong>{description && <small>{description}</small>}</span>
      {badge && <span className="qs-jev-disclosure-badge">{badge}</span>}
      <CaretDownIcon className="qs-jev-disclosure-chevron" size={16} aria-hidden="true"/>
    </summary>
    <div className="qs-jev-disclosure-body">{children}</div>
  </details>
}
