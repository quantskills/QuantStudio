import type { ConversationSessionSlotProps } from '../contract/slots.ts';
/**
 * Renders the active Session view inside the resident scrollport and keeps
 * the input draft persisted while blank Hero chrome is visible.
 * @param props - Strict Session input/store, view ledger, and render shares.
 * @returns the active view area, or null while the Session remains blank.
 */
export declare function DefaultConversationViews({ view, useSession, useConversation, useConversationViews, inputActions, useStore, actions, renderSlot, bindDraftPersistence, openView, useInspectCall, }: ConversationSessionSlotProps): import("react").JSX.Element | null;
//# sourceMappingURL=DefaultConversationViews.d.ts.map