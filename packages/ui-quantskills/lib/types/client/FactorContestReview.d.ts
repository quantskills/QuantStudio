import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store';
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client';
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots';
import { type FactorContestAccess } from './factor-contest.ts';
export interface FactorReviewInjected {
    hooks: {
        sessions: ObservableSnapshot<SessionListState>;
    };
    access: FactorContestAccess;
    openContest(): void;
}
export declare function FactorContestReview({ useSessions, access, openContest }: InjectFace<FactorReviewInjected>): import("react").JSX.Element | null;
//# sourceMappingURL=FactorContestReview.d.ts.map