import type { ReactNode } from 'react';
import type { PendingSubmission } from '@deepseek-ai/dsh-api-session-controller/client';
import type { PropsRenderFactories } from '@deepseek-ai/dsh-client-ui-slots';
import type { ChatNodeOwnerProps, ChatNodeViewProps, ChatViewSlotProps } from '../contract/slots.ts';
/**
 * Render one Host-authoritative pending steering item with the same visual
 * language as its eventual durable transcript node.
 * @param props - pending content, authorized image loader, and Factory/locale seats.
 * @returns the pending steering bubble.
 */
export declare function PendingSteeringBubble({ content, loadImage, renderFactorySlot, t }: {
    content: readonly unknown[];
    renderFactorySlot: PropsRenderFactories['renderFactorySlot'];
    t: ChatViewSlotProps['t'];
} & Pick<ChatNodeOwnerProps, 'loadImage'>): ReactNode;
/**
 * Render one local transcript or steering submission echo with the same
 * visual language and surface marker as the Host occurrence that replaces
 * it: draft text plus object-URL previews, visible from the submit click
 * until the durable `user/message` or steering occurrence renders.
 * @param props - the pending submission, authorized image loader, and render seats.
 * @returns the echoed user bubble.
 */
export declare function PendingSubmissionBubble({ submission, loadImage, renderFactorySlot, t }: {
    submission: PendingSubmission;
    renderFactorySlot: PropsRenderFactories['renderFactorySlot'];
    t: ChatViewSlotProps['t'];
} & Pick<ChatNodeOwnerProps, 'loadImage'>): ReactNode;
/** User and admitted-steering keyed Chat renderer. */
export declare const UserMessageNodeView: import("react").NamedExoticComponent<ChatNodeViewProps<"user" | "steering">>;
/** Injected-context keyed Chat renderer. */
export declare const ContextMessageNodeView: import("react").NamedExoticComponent<ChatNodeViewProps<"context">>;
/** Automatic compaction keyed Chat renderer. */
export declare const CompactionNodeView: import("react").NamedExoticComponent<ChatNodeViewProps<"compaction">>;
/** Correlated retry-chain keyed Chat renderer. */
export declare const RetryNodeView: import("react").NamedExoticComponent<ChatNodeViewProps<"model-retry">>;
/** Terminal turn-error keyed Chat renderer. */
export declare const TurnErrorNodeView: import("react").NamedExoticComponent<ChatNodeViewProps<"turn-error">>;
/** Max-tokens turn-end notice keyed Chat renderer. */
export declare const TurnMaxTokensNodeView: import("react").NamedExoticComponent<ChatNodeViewProps<"turn-max-tokens">>;
/** Explicit unknown-surface keyed Chat renderer. */
export declare const UnknownNodeView: import("react").NamedExoticComponent<ChatNodeViewProps<"unknown">>;
//# sourceMappingURL=MessageItem.d.ts.map