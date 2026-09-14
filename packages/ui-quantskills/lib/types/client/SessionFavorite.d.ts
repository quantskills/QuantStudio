import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store';
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client';
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots';
import type { QuantSkillsViewState } from './store.ts';
import type { QuantSkillsAgentsSnapshot, QuantSkillsSessionsSnapshot } from './types.ts';
export interface SessionFavoriteInjected {
    hooks: {
        sessions: ObservableSnapshot<SessionListState>;
        view: ObservableSnapshot<QuantSkillsViewState>;
        agents: ObservableSnapshot<QuantSkillsAgentsSnapshot>;
        skills: ObservableSnapshot<QuantSkillsSessionsSnapshot>;
    };
    toggle: (ids: string[]) => void;
}
/** Favorite the owning capability, so every future session can reuse it. */
export declare function SessionFavorite({ useSessions, useView, useAgents, useSkills, toggle }: InjectFace<SessionFavoriteInjected>): import("react").JSX.Element | null;
//# sourceMappingURL=SessionFavorite.d.ts.map