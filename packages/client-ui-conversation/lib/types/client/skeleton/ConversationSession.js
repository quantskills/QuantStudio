import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/** Strict per-session header/body content inserted into the resident conversation layout. */
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
 * Renders Session header chrome above the resident conversation scrollport.
 * @param props - Strict Session store, view ledger, navigation, render, and locale shares.
 * @returns Session navigation controls, with title and tabs after conversation starts.
 */
export function ConversationSessionHeader({ sessionId, hideChrome, useSessions, useConversationViews, useStore, renderSlot, open, selectView, t, }) {
    const tabs = useConversationViews(value => value);
    const selectedId = useStore(s => s.view);
    const active = resolveActiveView(tabs, selectedId);
    const ancestry = useSessions(s => deriveAncestry(s, sessionId), equalBreadcrumbs);
    const showTabs = !hideChrome && tabs.length > 1;
    return (_jsx(_Fragment, { children: _jsxs("div", { className: css.titleRow, children: [!hideChrome && (_jsxs(_Fragment, { children: [_jsxs("div", { className: css.titleCluster, children: [_jsxs("nav", { className: css.crumbs, "aria-label": t('session.hierarchy'), children: [ancestry.map((summary, index) => {
                                            const last = index === ancestry.length - 1;
                                            // The current crumb has no navigation, so it is plain text
                                            // rather than a disabled button: on darwin desktop a button
                                            // would subtract itself from the header's drag row (ui-web
                                            // base.css) and leave the title inert for dragging too.
                                            const title = last
                                                ? (_jsx("span", { className: clsx(css.crumb, summary.subagent && css.crumbSubagent, css.crumbCurrent), children: summary.displayTitle }))
                                                : (_jsx("button", { type: "button", className: clsx(css.crumb, summary.subagent && css.crumbSubagent), onClick: () => { open(summary.id); }, children: summary.displayTitle }));
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
                                        }), ancestry.length === 0 && _jsx("span", { className: css.crumbCurrent, children: sessionId })] }), _jsx("div", { className: css.headerActions, children: renderSlot('conversation.session.header.actions', {}) })] }), showTabs && (_jsx("div", { className: css.tabs, role: "tablist", "data-conversation-tabs": "", children: tabs.map(viewTab => (_jsx("button", { type: "button", role: "tab", "aria-selected": viewTab.id === active?.id, className: clsx(css.tab, viewTab.id === active?.id && css.tabActive), onClick: () => { selectView(viewTab.id); }, children: viewTab.label }, viewTab.id))) })), _jsx("div", { className: css.headerUtilities, children: renderSlot('conversation.session.header.utilities', {}) })] })), _jsx("div", { className: css.headerCorner, "data-conversation-header-corner": "", children: renderSlot('conversation.session.header.corner', {}) })] }) }));
}
/**
 * Renders the active Session view inside the resident scrollport and keeps
 * the input draft mirrored while blank Hero chrome is visible.
 * @param props - Strict Session input/store, view ledger, and render shares.
 * @returns the active view area, or null while the Session remains blank.
 */
export function ConversationSession(props) {
    return _jsx(DefaultConversationViews, { ...props });
}
//# sourceMappingURL=ConversationSession.js.map