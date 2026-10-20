/** Bounded compatibility helpers over the new handle-based persistence API. */
import type { SessionPersistence, SessionInspection } from '@deepseek-ai/dsh-session-persistence';
import type { SessionHeader, SessionId } from '@deepseek-ai/dsh-session';
export declare function inspectSession(persistence: SessionPersistence, id: SessionId, signal?: AbortSignal): Promise<SessionInspection>;
export declare function listSessionHeaders(persistence: SessionPersistence, signal?: AbortSignal): Promise<SessionHeader[]>;
//# sourceMappingURL=session-storage.d.ts.map