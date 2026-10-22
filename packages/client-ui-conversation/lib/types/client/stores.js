/** Per-session Conversation store shared by the shell body and header. */
import { defineStore } from '@deepseek-ai/dsh-client-store';
import { parseStoredDraft } from "./draft.js";
const CONVERSATION_STORE_KEY = 'dsh.conversation';
/**
 * Declare per-session draft persistence and View selection.
 * @returns the store handle.
 */
export function createConversationStore() {
    return defineStore({
        init: () => ({ draft: '', view: null, viewRequest: null }),
        persist: CONVERSATION_STORE_KEY,
        actions: {
            setDraft: (d, text) => { d.draft = text; },
            setView: (d, view) => { d.view = view; },
            openView: (d, view, focus) => {
                d.view = view;
                d.viewRequest = { view, focus };
            },
            completeViewRequest: (d) => { d.viewRequest = null; },
        },
    });
}
/**
 * Read a Session's draft before its input source is published to React.
 * @param sessionId - Session-scoped persistence suffix.
 * @returns saved semantic content, or an empty document when storage is absent or invalid.
 */
export function readConversationDraft(sessionId) {
    const empty = { text: '', references: [] };
    if (typeof localStorage === 'undefined')
        return empty;
    try {
        const raw = localStorage.getItem(`${CONVERSATION_STORE_KEY}.${sessionId}`);
        if (raw === null)
            return empty;
        const stored = JSON.parse(raw);
        if (typeof stored !== 'object' || stored === null || !('draft' in stored))
            return empty;
        return parseStoredDraft(stored.draft) ?? empty;
    }
    catch (_error) {
        // Unavailable browser storage or malformed JSON has no usable saved draft.
        return empty;
    }
}
/**
 * Read the persisted View preference before the Slot store is materialized.
 * @param sessionId - Session-scoped persistence suffix.
 * @returns the preferred View id, or null when storage has no usable value.
 */
export function readConversationViewPreference(sessionId) {
    if (typeof localStorage === 'undefined')
        return null;
    try {
        const raw = localStorage.getItem(`${CONVERSATION_STORE_KEY}.${sessionId}`);
        if (raw === null)
            return null;
        const stored = JSON.parse(raw);
        if (typeof stored !== 'object' || stored === null || !('view' in stored))
            return null;
        return typeof stored.view === 'string' ? stored.view : null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=stores.js.map