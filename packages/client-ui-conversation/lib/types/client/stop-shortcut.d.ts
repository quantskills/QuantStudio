/** Fixed Escape routing into the current Conversation turn's scoped cancellation. */
import type { ISessions, SessionBinding } from '@deepseek-ai/dsh-api-session-controller/client';
import type { Shortcuts } from '@deepseek-ai/dsh-client-shortcuts/client';
import type { UiSession } from '@deepseek-ai/dsh-client-ui-session/client';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store';
/**
 * Subscribe fixed input to the same Session cancellation used by the stop button.
 * @param shortcuts - window keyboard arbitration and validated sequence interval.
 * @param sessions - live Session identities and lifecycle sources.
 * @param openTurn - stable current-turn source for a live Session binding.
 * @param uiSession - current pending-interaction status.
 * @param cancel - scoped stop operation that preserves Queue and reports failures.
 * @returns disposer releasing the input subscription, pending watches and expiry timer.
 */
export declare function installStopShortcut(shortcuts: Shortcuts, sessions: ISessions, openTurn: (binding: SessionBinding) => ObservableSnapshot<number | undefined>, uiSession: UiSession, cancel: (sessionId: SessionId) => void): () => void;
//# sourceMappingURL=stop-shortcut.d.ts.map