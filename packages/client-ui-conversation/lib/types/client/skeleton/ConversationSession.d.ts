/** Strict per-session header/body content inserted into the resident conversation layout. */
import type { ConversationSessionHeaderSlotProps, ConversationSessionSlotProps } from '../contract/slots.ts';
/** Full props composed from the strict session body contract. */
export type ConversationSessionProps = ConversationSessionSlotProps;
/** Full props composed from the strict session header contract. */
export type ConversationSessionHeaderProps = ConversationSessionHeaderSlotProps;
/**
 * Keeps session actions and view navigation reachable without the title bar.
 * @param props - Strict Session store, view ledger, navigation, render, and locale shares.
 * @returns Session navigation controls, with title and tabs after conversation starts.
 */
export declare function ConversationSessionHeader({ sessionId, hideChrome, useSessions, useConversationViews, useStore, selectView, renderSlot, open, t, }: ConversationSessionHeaderProps): import("react").JSX.Element;
export declare function ConversationSession(props: ConversationSessionProps): import("react").JSX.Element;
//# sourceMappingURL=ConversationSession.d.ts.map