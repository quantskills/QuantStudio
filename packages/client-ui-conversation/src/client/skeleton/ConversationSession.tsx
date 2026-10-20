/** Strict per-session header/body content inserted into the resident conversation layout. */

import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {
  ConversationSessionHeaderSlotProps, ConversationSessionSlotProps,
} from '../contract/slots.ts'
import { resolveActiveView } from '../view-selection.ts'
import { DefaultConversationViews } from './DefaultConversationViews.tsx'
import css from './ConversationRoot.module.css'

/** Full props composed from the strict session body contract. */
export type ConversationSessionProps = ConversationSessionSlotProps

/** Full props composed from the strict session header contract. */
export type ConversationSessionHeaderProps = ConversationSessionHeaderSlotProps

interface Breadcrumb {
  readonly id: SessionId
  readonly displayTitle: string
  readonly subagent: boolean
}

function deriveAncestry(list: SessionListState, id: SessionId): readonly Breadcrumb[] {
  const chain: Breadcrumb[] = []
  const seen = new Set<SessionId>()
  let cursor: SessionId | undefined = id
  while (cursor !== undefined) {
    if (seen.has(cursor)) break
    seen.add(cursor)
    const summary: SessionSummary | undefined = list.byId[cursor]
    if (summary === undefined) break
    chain.unshift({
      id: summary.id,
      displayTitle: summary.displayTitle,
      subagent: summary.origin === 'subagent',
    })
    if (summary.origin !== 'subagent') break
    cursor = summary.parentId
  }
  return chain
}

function equalBreadcrumbs(left: readonly Breadcrumb[], right: readonly Breadcrumb[]): boolean {
  return left.length === right.length
    && left.every((item, index) => {
      const other = right.at(index)
      return other !== undefined && item.id === other.id && item.displayTitle === other.displayTitle
    })
}

/**
 * Keeps session actions and view navigation reachable without the title bar.
 * @param props - Strict Session store, view ledger, navigation, render, and locale shares.
 * @returns Session navigation controls, with title and tabs after conversation starts.
 */
export function ConversationSessionHeader({
  sessionId, hideChrome, useSessions, useConversationViews, useStore,
  selectView, renderSlot, t,
}: ConversationSessionHeaderProps) {
  const tabs = useConversationViews(value => value)
  const selectedId = useStore(s => s.view)
  const active = resolveActiveView(tabs, selectedId)
  const ancestry = useSessions(s => deriveAncestry(s, sessionId), equalBreadcrumbs)
  const [seat, setSeat] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => {
    const next = document.querySelector('[data-composer-subagents]')
    setSeat(current => current === next ? current : next instanceof HTMLElement ? next : null)
  })
  const current = ancestry.at(-1)
  const lineage = hideChrome || current === undefined ? null : renderSlot(
    'conversation.session.header.lineage',
    { lineageSessionId: current.id, displayTitle: current.displayTitle },
    { fallback: null },
  )
  return (
    <>
      <header data-conversation-header hidden />
      {!hideChrome && <div data-conversation-controls className={css.sessionControls}>
        {tabs.length > 1 && <div className={css.sessionViews} role="tablist" aria-label={t('session.views')}>
          {tabs.map(viewTab => <button
            key={viewTab.id}
            type="button"
            role="tab"
            aria-selected={viewTab.id === active?.id}
            className={css.sessionViewTab}
            onClick={() => { selectView(viewTab.id) }}
          >{viewTab.label}</button>)}
        </div>}
        <div className={css.sessionActions}>
          {renderSlot('conversation.session.header.actions', {})}
          {renderSlot('conversation.session.header.utilities', {})}
          {renderSlot('conversation.session.header.corner', {})}
        </div>
      </div>}
      {seat !== null && lineage !== null ? createPortal(lineage, seat) : null}
    </>
  )
}

export function ConversationSession(props: ConversationSessionProps) {
  return <DefaultConversationViews {...props} />
}
