import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store';
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client';
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots';
import { type ContestAccess } from './contest.ts';
export interface ContestReviewInjected {
    hooks: {
        sessions: ObservableSnapshot<SessionListState>;
    };
    access: ContestAccess;
    openContest(): void;
}
/** Normal sessions never mount a contest poller or load account context. */
export declare function ContestReview({ useSessions, access, openContest }: InjectFace<ContestReviewInjected>): import("react").JSX.Element | null;
//# sourceMappingURL=ContestReview.d.ts.map