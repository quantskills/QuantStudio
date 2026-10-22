/** Per-session Conversation store shared by the shell body and header. */
import { type EngineStoreHandle } from '@deepseek-ai/dsh-client-store';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { ConversationStoreState } from './contract/views.ts';
import type { DraftInput, DraftSnapshot } from './contract/draft-editor.ts';
/** Declared write set for the Conversation shell. */
type ConversationActions = {
    setDraft: (draft: ConversationStoreState, text: DraftInput) => void;
    setView: (draft: ConversationStoreState, view: string) => void;
    openView: (draft: ConversationStoreState, view: string, focus: string) => void;
    completeViewRequest: (draft: ConversationStoreState) => void;
};
/**
 * Declare per-session draft persistence and View selection.
 * @returns the store handle.
 */
export declare function createConversationStore(): EngineStoreHandle<ConversationStoreState, ConversationActions>;
/**
 * Read a Session's draft before its input source is published to React.
 * @param sessionId - Session-scoped persistence suffix.
 * @returns saved semantic content, or an empty document when storage is absent or invalid.
 */
export declare function readConversationDraft(sessionId: SessionId): DraftSnapshot;
/**
 * Read the persisted View preference before the Slot store is materialized.
 * @param sessionId - Session-scoped persistence suffix.
 * @returns the preferred View id, or null when storage has no usable value.
 */
export declare function readConversationViewPreference(sessionId: SessionId): string | null;
export {};
//# sourceMappingURL=stores.d.ts.map