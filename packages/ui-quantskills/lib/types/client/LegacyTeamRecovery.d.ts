import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store';
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client';
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots';
import type { LegacyTeamRecoveryResult } from '@deepseek-ai/dsh-quantskills-session/types';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
export interface LegacyTeamRecoveryInjected {
    hooks: {
        sessions: ObservableSnapshot<SessionListState>;
    };
    recover: (sessionId: SessionId, continuePending: boolean) => Promise<LegacyTeamRecoveryResult>;
}
/** A distinct user continuation; viewing or restoring a Team never delivers historical messages. */
export declare function LegacyTeamRecovery({ useSessions, recover }: InjectFace<LegacyTeamRecoveryInjected>): import("react").JSX.Element | null;
//# sourceMappingURL=LegacyTeamRecovery.d.ts.map