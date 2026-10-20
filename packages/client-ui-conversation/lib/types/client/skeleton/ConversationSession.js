import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/** Strict per-session header/body content inserted into the resident conversation layout. */
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
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
export function ConversationSessionHeader({ sessionId, hideChrome, useSessions, useConversationViews, useStore, selectView, renderSlot, open, t, }) {
    const tabs = useConversationViews(value => value);
    const selectedId = useStore(s => s.view);
    const active = resolveActiveView(tabs, selectedId);
    const ancestry = useSessions(s => deriveAncestry(s, sessionId), equalBreadcrumbs);
    const [seat, setSeat] = useState(null);
    const seatRef = useRef(null);
    const header = useRef(null);
    useLayoutEffect(() => {
        const scope = header.current?.closest('[data-conversation-surface]');
        if (scope === undefined || scope === null) {
            seatRef.current = null;
            setSeat(null);
            return;
        }
        const sync = () => {
            const next = [...scope.querySelectorAll('[data-composer-subagents]')]
                .find(element => element.dataset.composerSubagents === sessionId) ?? null;
            // Avoid publishing unchanged state from our own portal DOM mutations.
            if (seatRef.current !== next) {
                seatRef.current = next;
                setSeat(next);
            }
        };
        sync();
        const observer = new MutationObserver(sync);
        observer.observe(scope, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-composer-subagents'] });
        return () => { observer.disconnect(); };
    }, [sessionId]);
    const current = ancestry.at(-1);
    const lineage = hideChrome || current === undefined ? null : current.subagent ? (_jsx("nav", { className: css.crumbs, "aria-label": t('session.hierarchy'), children: ancestry.map((summary, index) => {
            const last = index === ancestry.length - 1;
            const title = last
                ? _jsx("span", { className: clsx(css.crumb, css.crumbSubagent, css.crumbCurrent), children: summary.displayTitle })
                : _jsx("button", { type: "button", className: clsx(css.crumb, summary.subagent && css.crumbSubagent), onClick: () => { open(summary.id); }, children: summary.displayTitle });
            return _jsxs("span", { className: css.crumbSeg, children: [index > 0 && _jsx("span", { className: css.crumbSep, children: "/" }), summary.subagent ? renderSlot('conversation.session.header.lineage', {
                        lineageSessionId: summary.id, displayTitle: summary.displayTitle,
                        ...last ? {} : { openTitle: () => { open(summary.id); } },
                    }, { fallback: title }) : title] }, summary.id);
        }) })) : renderSlot('conversation.session.header.lineage', { lineageSessionId: current.id, displayTitle: current.displayTitle }, { fallback: null });
    return (_jsxs(_Fragment, { children: [_jsx("header", { ref: header, "data-conversation-header": true, hidden: true }), !hideChrome && _jsxs("div", { "data-conversation-controls": true, className: css.sessionControls, children: [tabs.length > 1 && _jsx("div", { className: css.sessionViews, role: "tablist", "data-conversation-tabs": "", "aria-label": t('session.views'), children: tabs.map(viewTab => _jsx("button", { type: "button", role: "tab", "aria-selected": viewTab.id === active?.id, className: css.sessionViewTab, onClick: () => { selectView(viewTab.id); }, children: viewTab.label }, viewTab.id)) }), _jsxs("div", { className: css.sessionActions, children: [renderSlot('conversation.session.header.actions', {}), renderSlot('conversation.session.header.utilities', {}), renderSlot('conversation.session.header.corner', {}), seat === null ? lineage : null] })] }), hideChrome && _jsx("div", { className: css.sessionActions, "data-conversation-header-corner": "", children: renderSlot('conversation.session.header.corner', {}) }), seat !== null && lineage !== null ? createPortal(lineage, seat) : null] }));
}
export function ConversationSession(props) {
    return _jsx(DefaultConversationViews, { ...props });
}
//# sourceMappingURL=ConversationSession.js.map