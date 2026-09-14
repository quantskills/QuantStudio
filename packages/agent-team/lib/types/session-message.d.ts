/** Durable Session-message acceptance checks shared by provisioning and mailbox recovery. */
import type { UserMessage } from '@deepseek-ai/dsh-llm';
import type { SessionEvent } from '@deepseek-ai/dsh-session';
/**
 * Test whether one message is model-visible or still durably pending.
 * @param events - one Session's non-inherited event suffix.
 * @param predicate - identity check for the accepted message.
 * @returns whether history or the current inbox contains a match.
 */
export declare function messageAccepted(events: readonly SessionEvent[], predicate: (message: UserMessage) => boolean): boolean;
//# sourceMappingURL=session-message.d.ts.map