import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store';
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client';
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots';
import type { QuantSkillsAuthoringCommitResult, SessionId } from './plugin-types.ts';
export interface AuthoringReviewInjected {
    hooks: {
        sessions: ObservableSnapshot<SessionListState>;
    };
    commit: (sessionId: SessionId, callId: string, digest: string) => Promise<QuantSkillsAuthoringCommitResult>;
    start: (result: QuantSkillsAuthoringCommitResult) => Promise<void>;
    openLibrary: (kind: QuantSkillsAuthoringCommitResult['kind']) => void;
    focusComposer: () => void;
}
/** Always mounted in the session header, independent of collapsed tool history. */
export declare function AuthoringReview({ useSessions, commit, start, focusComposer, openLibrary }: InjectFace<AuthoringReviewInjected>): import("react").JSX.Element | null;
//# sourceMappingURL=AuthoringReview.d.ts.map