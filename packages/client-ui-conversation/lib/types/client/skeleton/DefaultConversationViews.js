import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect } from 'react';
import { conversationPhase } from "../contract/snapshot.js";
import { resolveActiveView } from "../view-selection.js";
import css from './ConversationRoot.module.css';
/**
 * Renders the active Session view inside the resident scrollport and keeps
 * the input draft persisted while blank Hero chrome is visible.
 * @param props - Strict Session input/store, view ledger, and render shares.
 * @returns the active view area, or null while the Session remains blank.
 */
export function DefaultConversationViews({ view, useSession, useConversation, useConversationViews, inputActions, useStore, actions, renderSlot, bindDraftPersistence, openView, useInspectCall, }) {
    const tabs = useConversationViews(value => value);
    const inspectCall = useInspectCall(value => value);
    const selectedId = useStore(s => s.view);
    const active = resolveActiveView(tabs, selectedId);
    const session = useSession(s => s);
    const conversation = useConversation(s => s);
    const viewRequest = useStore(s => s.viewRequest ?? null);
    useEffect(() => {
        const unbindDraftPersistence = bindDraftPersistence(actions.setDraft);
        inputActions.persistDraft();
        return () => { unbindDraftPersistence(); };
        // The Session input owns content before this persistence writer is attached.
    }, [inputActions]);
    if (session.blank && conversationPhase(session, conversation) === 'blank')
        return null;
    const viewId = view ?? active?.id;
    return (_jsx("div", { className: css.viewArea, children: viewId !== undefined && renderSlot('conversation.view', {
            inspectCall,
            viewRequest,
            openView,
            completeViewRequest: actions.completeViewRequest,
        }, { only: viewId }) }));
}
//# sourceMappingURL=DefaultConversationViews.js.map