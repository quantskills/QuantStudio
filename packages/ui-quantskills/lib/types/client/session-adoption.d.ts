import type { ISessions, SessionBinding, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
/** Hold a new session through setup until its view takes ownership. */
export interface AdoptedSession extends Disposable {
    readonly sessionId: SessionId;
    readonly summary: SessionSummary;
    readonly session: SessionBinding['session'];
    release(): void;
}
/** rc.2 catalog membership does not create a binding: acquire it explicitly. */
export declare function adoptQuantSkillsSession(sessions: ISessions, id: SessionId, caller: AbortSignal, accept?: (summary: SessionSummary) => boolean): Promise<AdoptedSession>;
//# sourceMappingURL=session-adoption.d.ts.map