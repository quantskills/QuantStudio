import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Resident conversation navigation and Session-specific header content. */
import clsx from 'clsx';
import { conversationPhase } from "../contract/snapshot.js";
import css from './ConversationRoot.module.css';
/**
 * Keeps global navigation available before a Session exists.
 * @param props - Optional Session sources and authorized header slots.
 * @returns The persistent header with any selected Session's title and views.
 */
export function ConversationHeader({ sessionId, useSession, useConversation, renderSlot }) {
    const session = useSession(s => s);
    const conversation = useConversation(s => s);
    const blank = session === undefined || conversation === undefined
        || (session.blank && conversationPhase(session, conversation) === 'blank');
    return (_jsxs("header", { className: clsx(css.header, blank && css.headerBlank, sessionId === undefined && css.headerSessionless), "data-window-drag": true, children: [_jsx("div", { className: css.headerLeading, "data-conversation-header-leading": "", children: renderSlot('conversation.header.leading', {}) }), sessionId === undefined
                ? _jsx("div", { className: css.titleRow })
                : renderSlot('conversation.session.header', { hideChrome: blank })] }));
}
//# sourceMappingURL=ConversationHeader.js.map