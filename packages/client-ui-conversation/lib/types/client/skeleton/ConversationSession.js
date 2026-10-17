import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/** Strict per-session header/body content inserted into the resident conversation layout. */
import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { conversationPhase } from "../contract/snapshot.js";
import css from './ConversationRoot.module.css';
const DEFAULT_VIEW_ID = 'chat';
/** Resolve a persisted selection, then registered Chat, without choosing another View. */
function resolveActiveView(tabs, selectedId) {
    const selected = selectedId === null ? undefined : tabs.find(view => view.id === selectedId);
    return selected ?? tabs.find(view => view.id === DEFAULT_VIEW_ID);
}
function deriveAncestry(list, id) {
    const chain = [];
    const seen = new Set();
    let cursor = id;
    while (cursor !== undefined) {
        if (seen.has(cursor))
            break;
        seen.add(cursor);
        const summary = list.byId[cursor];
        if (summary === undefined)
            break;
        chain.unshift({
            id: summary.id,
            displayTitle: summary.displayTitle,
            subagent: summary.origin === 'subagent',
        });
        if (summary.origin !== 'subagent')
            break;
        cursor = summary.parentId;
    }
    return chain;
}
function equalBreadcrumbs(left, right) {
    return left.length === right.length
        && left.every((item, index) => {
            const other = right.at(index);
            return other !== undefined && item.id === other.id && item.displayTitle === other.displayTitle;
        });
}
/**
 * Renders Session header chrome above the resident conversation scrollport.
 * @param props - Strict Session store, view ledger, navigation, render, and locale shares.
 * @returns the hidden blank-session header or visible title and tabs.
 */
export function ConversationSessionHeader({ sessionId, useSession, useSessions, useConversation, renderSlot, }) {
    const ancestry = useSessions(s => deriveAncestry(s, sessionId), equalBreadcrumbs);
    const session = useSession(s => s);
    const conversation = useConversation(s => s);
    const hideChrome = session.blank && conversationPhase(session, conversation) === 'blank';
    const [seat, setSeat] = useState(null);
    useLayoutEffect(() => {
        const next = document.querySelector('[data-composer-subagents]');
        setSeat(current => current === next ? current : next instanceof HTMLElement ? next : null);
    });
    const current = ancestry.at(-1);
    const lineage = hideChrome || current === undefined ? null : renderSlot('conversation.session.header.lineage', { lineageSessionId: current.id, displayTitle: current.displayTitle }, { fallback: null });
    return (_jsxs(_Fragment, { children: [_jsx("header", { "data-conversation-header": true, hidden: true, className: css.headerHidden }), seat !== null && lineage !== null ? createPortal(lineage, seat) : null] }));
}
export function ConversationSession({ useSession, useConversation, useConversationViews, useInput, inputActions, useStore, actions, renderSlot, bindDraftMirror, }) {
    const tabs = useConversationViews(value => value);
    const selectedId = useStore(s => s.view);
    const active = resolveActiveView(tabs, selectedId);
    const session = useSession(s => s);
    const conversation = useConversation(s => s);
    const inputState = useInput(s => s);
    const storedDraft = useStore(s => s.draft);
    const viewRequest = useStore(s => s.viewRequest ?? null);
    useEffect(() => {
        if (inputState.draft === '' && storedDraft !== '')
            inputActions.setDraft(storedDraft);
        const unmirror = bindDraftMirror(actions.setDraft);
        return () => { unmirror(); };
        // Mount-only (deps pinned to inputActions): later store writes come from
        // the machine mirror, not this seed effect.
    }, [inputActions]);
    if (session.blank && conversationPhase(session, conversation) === 'blank')
        return null;
    return (_jsx("div", { className: css.viewArea, children: active !== undefined && renderSlot('conversation.view', {
            viewRequest,
            openView: actions.openView,
            completeViewRequest: actions.completeViewRequest,
        }, { only: active.id }) }));
}
//# sourceMappingURL=ConversationSession.js.map