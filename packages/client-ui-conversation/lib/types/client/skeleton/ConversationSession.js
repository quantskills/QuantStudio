import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/** Strict per-session header/body content inserted into the resident conversation layout. */
import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { resolveActiveView } from "../view-selection.js";
import { DefaultConversationViews } from "./DefaultConversationViews.js";
import css from './ConversationRoot.module.css';
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
 * Keeps session actions and view navigation reachable without the title bar.
 * @param props - Strict Session store, view ledger, navigation, render, and locale shares.
 * @returns Session navigation controls, with title and tabs after conversation starts.
 */
export function ConversationSessionHeader({ sessionId, hideChrome, useSessions, useConversationViews, useStore, selectView, renderSlot, t, }) {
    const tabs = useConversationViews(value => value);
    const selectedId = useStore(s => s.view);
    const active = resolveActiveView(tabs, selectedId);
    const ancestry = useSessions(s => deriveAncestry(s, sessionId), equalBreadcrumbs);
    const [seat, setSeat] = useState(null);
    useLayoutEffect(() => {
        const next = document.querySelector('[data-composer-subagents]');
        setSeat(current => current === next ? current : next instanceof HTMLElement ? next : null);
    });
    const current = ancestry.at(-1);
    const lineage = hideChrome || current === undefined ? null : renderSlot('conversation.session.header.lineage', { lineageSessionId: current.id, displayTitle: current.displayTitle }, { fallback: null });
    return (_jsxs(_Fragment, { children: [_jsx("header", { "data-conversation-header": true, hidden: true }), !hideChrome && _jsxs("div", { "data-conversation-controls": true, className: css.sessionControls, children: [tabs.length > 1 && _jsx("div", { className: css.sessionViews, role: "tablist", "aria-label": t('session.views'), children: tabs.map(viewTab => _jsx("button", { type: "button", role: "tab", "aria-selected": viewTab.id === active?.id, className: css.sessionViewTab, onClick: () => { selectView(viewTab.id); }, children: viewTab.label }, viewTab.id)) }), _jsxs("div", { className: css.sessionActions, children: [renderSlot('conversation.session.header.actions', {}), renderSlot('conversation.session.header.utilities', {}), renderSlot('conversation.session.header.corner', {})] })] }), seat !== null && lineage !== null ? createPortal(lineage, seat) : null] }));
}
export function ConversationSession(props) {
    return _jsx(DefaultConversationViews, { ...props });
}
//# sourceMappingURL=ConversationSession.js.map