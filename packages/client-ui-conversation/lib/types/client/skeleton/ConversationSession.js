import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/** Strict per-session header/body content inserted into the resident conversation layout. */
import { useEffect } from 'react';
import clsx from 'clsx';
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
export function ConversationSessionHeader({ sessionId, useSession, useSessions, useConversation, useConversationViews, useStore, actions, renderSlot, open, t, }) {
    const tabs = useConversationViews(value => value);
    const selectedId = useStore(s => s.view);
    const active = resolveActiveView(tabs, selectedId);
    const ancestry = useSessions(s => deriveAncestry(s, sessionId), equalBreadcrumbs);
    const session = useSession(s => s);
    const conversation = useConversation(s => s);
    const hideChrome = session.blank && conversationPhase(session, conversation) === 'blank';
    return (_jsx("header", { "data-conversation-header": true, className: clsx(css.header, hideChrome && css.headerHidden), "aria-hidden": hideChrome || undefined, children: !hideChrome && (_jsxs(_Fragment, { children: [_jsxs("div", { className: css.titleRow, children: [_jsxs("div", { className: css.titleCluster, children: [_jsxs("nav", { className: css.crumbs, "aria-label": t('session.hierarchy'), children: [ancestry.map((summary, index) => {
                                            const last = index === ancestry.length - 1;
                                            const title = (_jsx("button", { type: "button", className: clsx(css.crumb, summary.subagent && css.crumbSubagent, last && css.crumbCurrent), disabled: last, onClick: () => { open(summary.id); }, children: summary.displayTitle }));
                                            const lineage = last || summary.subagent;
                                            const lineageOwner = {
                                                lineageSessionId: summary.id,
                                                displayTitle: summary.displayTitle,
                                                ...last ? {} : { openTitle: () => { open(summary.id); } },
                                            };
                                            return (_jsxs("span", { className: css.crumbSeg, children: [index > 0 && _jsx("span", { className: css.crumbSep, children: "/" }), lineage
                                                        ? summary.subagent
                                                            ? renderSlot('conversation.session.header.lineage', lineageOwner, { fallback: title })
                                                            : (_jsxs(_Fragment, { children: [title, renderSlot('conversation.session.header.lineage', lineageOwner, { fallback: null })] }))
                                                        : title] }, summary.id));
                                        }), ancestry.length === 0 && _jsx("span", { className: css.crumbCurrent, children: sessionId })] }), _jsx("div", { className: css.headerActions, children: renderSlot('conversation.session.header.actions', {}) })] }), _jsx("div", { className: css.headerUtilities, children: renderSlot('conversation.session.header.utilities', {}) })] }), tabs.length > 1 && (_jsx("div", { className: css.tabs, role: "tablist", children: tabs.map(viewTab => (_jsx("button", { type: "button", role: "tab", "aria-selected": viewTab.id === active?.id, className: clsx(css.tab, viewTab.id === active?.id && css.tabActive), onClick: () => { actions.setView(viewTab.id); }, children: viewTab.label }, viewTab.id))) }))] })) }));
}
/**
 * Renders the active Session view inside the resident scrollport and keeps
 * the input draft mirrored while blank Hero chrome is visible.
 * @param props - Strict Session input/store, view ledger, and render shares.
 * @returns the active view area, or null while the Session remains blank.
 */
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