import type { Context } from '@deepseek-ai/cordis';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import type { PropsLocale, PropsRenderFactories, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { QueueAction } from '@deepseek-ai/dsh-api-session-controller/types';
import type { MessageId } from '@deepseek-ai/dsh-llm/brand';
/** Queue operations injected by the session-scoped registration. */
export interface QueueDockInjected {
    updateQueue: (itemId: MessageId, action: QueueAction) => Promise<void>;
    notify: (level: 'info' | 'error', text: string) => void;
    /** Resolve one durable queued image into a session-scoped browser URL. */
    loadImage: (attachment: ImageAttachmentRef) => Promise<string>;
}
/** Full props of a dock entry: InputZone owner share + session standard kit + global seat + the locale seat. */
export type QueueDockProps = PropsRuntime<'conversation.input.dock'> & QueueDockInjected & PropsLocale<'conversation'> & PropsRenderFactories;
/**
 * Queue strip: one item renders directly; multiple items default to a
 * collapsible count header; an empty queue renders nothing. Local queued submissions
 * show sending status and disabled actions until their Host queue rows arrive.
 */
export declare function QueueDock({ useSession, useProjection, updateQueue, notify, loadImage, renderFactorySlot, t }: QueueDockProps): import("react").JSX.Element | null;
/** Registers queue actions backed by the session-scoped conversation service. */
export declare const queueDockEntry: {
    name: string;
    inject: string[];
    apply(ctx: Context): void;
};
//# sourceMappingURL=QueueDock.d.ts.map