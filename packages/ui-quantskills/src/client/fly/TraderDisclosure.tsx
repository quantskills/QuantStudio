import { CaretRightIcon, ChartLineIcon, ReceiptIcon, WalletIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'

const icons = { market: ChartLineIcon, plans: ReceiptIcon, account: WalletIcon }

export function TraderDisclosure({ kind, title, description, status, tone = 'neutral', open, id, children }: {
  kind: keyof typeof icons
  title: string
  description: string
  status: ReactNode
  tone?: 'neutral' | 'ready' | 'attention'
  open?: boolean | undefined
  id?: string | undefined
  children: ReactNode
}) {
  const Icon = icons[kind]
  return <details className="qs-trader-disclosure" data-kind={kind} open={open} id={id}>
    <summary>
      <span className="qs-trader-disclosure-icon" aria-hidden="true"><Icon size={21}/></span>
      <span className="qs-trader-disclosure-copy"><strong>{title}</strong><span>{description}</span></span>
      <span className="qs-trader-disclosure-status" data-tone={tone}>{status}</span>
      <CaretRightIcon className="qs-trader-disclosure-chevron" size={16} aria-hidden="true"/>
    </summary>
    <div className="qs-trader-disclosure-content">{children}</div>
  </details>
}
