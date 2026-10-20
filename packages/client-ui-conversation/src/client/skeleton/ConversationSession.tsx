/** Strict per-session header/body content inserted into the resident conversation layout. */

import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
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
  selectView, renderSlot, open, t,
}: ConversationSessionHeaderProps) {
  const tabs = useConversationViews(value => value)
  const selectedId = useStore(s => s.view)
  const active = resolveActiveView(tabs, selectedId)
  const ancestry = useSessions(s => deriveAncestry(s, sessionId), equalBreadcrumbs)
  const [seat, setSeat] = useState<HTMLElement | null>(null)
  const seatRef = useRef<HTMLElement | null>(null)
  const header = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const scope = header.current?.closest('[data-conversation-surface]')
    if (scope === undefined || scope === null) { seatRef.current = null; setSeat(null); return }
    const sync = () => {
      const next = [...scope.querySelectorAll<HTMLElement>('[data-composer-subagents]')]
        .find(element => element.dataset.composerSubagents === sessionId) ?? null
      // Avoid publishing unchanged state from our own portal DOM mutations.
      if (seatRef.current !== next) { seatRef.current = next; setSeat(next) }
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(scope, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-composer-subagents'] })
    return () => { observer.disconnect() }
  }, [sessionId])
  const current = ancestry.at(-1)
  const lineage = hideChrome || current === undefined ? null : current.subagent ? (
    <nav className={css.crumbs} aria-label={t('session.hierarchy')}>
      {ancestry.map((summary, index) => {
        const last = index === ancestry.length - 1
        const title = last
          ? <span className={clsx(css.crumb, css.crumbSubagent, css.crumbCurrent)}>{summary.displayTitle}</span>
          : <button type="button" className={clsx(css.crumb, summary.subagent && css.crumbSubagent)}
              onClick={() => { open(summary.id) }}>{summary.displayTitle}</button>
        return <span key={summary.id} className={css.crumbSeg}>
          {index > 0 && <span className={css.crumbSep}>/</span>}
          {summary.subagent ? renderSlot('conversation.session.header.lineage', {
            lineageSessionId: summary.id, displayTitle: summary.displayTitle,
            ...last ? {} : { openTitle: () => { open(summary.id) } },
          }, { fallback: title }) : title}
        </span>
      })}
    </nav>
  ) : renderSlot(
    'conversation.session.header.lineage',
    { lineageSessionId: current.id, displayTitle: current.displayTitle },
    { fallback: null },
  )
  return (
    <>
      <header ref={header} data-conversation-header hidden />
      {!hideChrome && <div data-conversation-controls className={css.sessionControls}>
        {tabs.length > 1 && <div className={css.sessionViews} role="tablist" data-conversation-tabs="" aria-label={t('session.views')}>
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
          {seat === null ? lineage : null}
        </div>
      </div>}
      {hideChrome && <div className={css.sessionActions} data-conversation-header-corner="">
        {renderSlot('conversation.session.header.corner', {})}
      </div>}
      {seat !== null && lineage !== null ? createPortal(lineage, seat) : null}
    </>
  )
}

export function ConversationSession(props: ConversationSessionProps) {
  return <DefaultConversationViews {...props} />
}
