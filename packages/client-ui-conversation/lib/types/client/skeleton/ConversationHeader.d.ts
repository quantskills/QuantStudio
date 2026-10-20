import type { ConversationHeaderProps } from '../contract/slots.ts';
/**
 * Keeps global navigation available before a Session exists.
 * @param props - Optional Session sources and authorized header slots.
 * @returns The persistent header with any selected Session's title and views.
 */
export declare function ConversationHeader({ sessionId, useSession, useConversation, renderSlot }: ConversationHeaderProps): import("react").JSX.Element;
//# sourceMappingURL=ConversationHeader.d.ts.map