import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store';
import type { QuantSkillsAgentTeamDefinition, QuantSkillsAuthoringCommitResult, SessionId } from './plugin-types.ts';
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client';
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots';
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client';
import type { QuantSkillsAgentsSnapshot } from './types.ts';
import type { QuantSkillsAgentTeamBuilderSeed } from './store.ts';
/** Actions needed to confirm a session-local Team draft. */
export interface QuantSkillsTeamDraftCardInjected {
    hooks: {
        agents: ObservableSnapshot<QuantSkillsAgentsSnapshot>;
        sessions: ObservableSnapshot<SessionListState>;
    };
    sessionId: SessionId;
    commitAuthoring: (toolCallId: string, treeDigest: string) => Promise<QuantSkillsAuthoringCommitResult>;
    startAgentTeamSession: (definition: QuantSkillsAgentTeamDefinition) => Promise<void>;
    openAgentTeamBuilder: (seed: QuantSkillsAgentTeamBuilderSeed) => void;
    focusComposer: () => void;
}
type QuantSkillsTeamDraftCardProps = ToolCallViewProps & InjectFace<QuantSkillsTeamDraftCardInjected>;
/** Confirmation card for one logged `quantskills_team_draft` result. */
export declare function QuantSkillsTeamDraftCard({ block, callId, sessionId, useAgents, useSessions, commitAuthoring, startAgentTeamSession, openAgentTeamBuilder, focusComposer, }: QuantSkillsTeamDraftCardProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=QuantSkillsTeamDraftCard.d.ts.map