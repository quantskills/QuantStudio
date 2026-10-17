/** Strict per-session header/body content inserted into the resident conversation layout. */
import type { ConversationSessionHeaderSlotProps, ConversationSessionSlotProps } from '../contract/slots.ts';
/** Full props composed from the strict session body contract. */
export type ConversationSessionProps = ConversationSessionSlotProps;
/** Full props composed from the strict session header contract. */
export type ConversationSessionHeaderProps = ConversationSessionHeaderSlotProps;
/**
 * Renders Session header chrome above the resident conversation scrollport.
 * @param props - Strict Session store, view ledger, navigation, render, and locale shares.
 * @returns the hidden blank-session header or visible title and tabs.
 */
export declare function ConversationSessionHeader({ sessionId, useSession, useSessions, useConversation, renderSlot, }: ConversationSessionHeaderProps): import("react").JSX.Element;
export declare function ConversationSession({ useSession, useConversation, useConversationViews, useInput, inputActions, useStore, actions, renderSlot, bindDraftMirror, }: ConversationSessionProps): import("react").JSX.Element | null;
//# sourceMappingURL=ConversationSession.d.ts.map