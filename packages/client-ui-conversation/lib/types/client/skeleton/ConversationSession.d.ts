/** Strict per-session header/body content inserted into the resident conversation layout. */
import type { ConversationSessionHeaderSlotProps, ConversationSessionSlotProps } from '../contract/slots.ts';
/** Full props composed from the strict session body contract. */
export type ConversationSessionProps = ConversationSessionSlotProps;
/** Full props composed from the strict session header contract. */
export type ConversationSessionHeaderProps = ConversationSessionHeaderSlotProps;
/**
 * Keeps session actions and view navigation reachable without the title bar.
 * @param props - Strict Session store, view ledger, navigation, render, and locale shares.
 * @returns compact controls and the composer-mounted subagent catalog.
 */
export declare function ConversationSessionHeader({ sessionId, useSession, useSessions, useConversation, useConversationViews, useStore, actions, renderSlot, t, }: ConversationSessionHeaderProps): import("react").JSX.Element;
export declare function ConversationSession({ useSession, useConversation, useConversationViews, useInput, inputActions, useStore, actions, renderSlot, bindDraftMirror, }: ConversationSessionProps): import("react").JSX.Element | null;
//# sourceMappingURL=ConversationSession.d.ts.map