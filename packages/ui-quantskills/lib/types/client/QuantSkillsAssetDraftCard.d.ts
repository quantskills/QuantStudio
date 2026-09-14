import type { QuantSkillsAgentDefinition, QuantSkillsAuthoringCommitResult, QuantSkillsAuthoringInstalledVersion, SessionId } from './plugin-types.ts';
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store';
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client';
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots';
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client';
/** Actions used by the immutable local 技能/专家 confirmation card. */
export interface QuantSkillsAssetDraftCardInjected {
    hooks: {
        sessions: ObservableSnapshot<SessionListState>;
    };
    sessionId: SessionId;
    commitAuthoring: (toolCallId: string, treeDigest: string) => Promise<QuantSkillsAuthoringCommitResult>;
    startSkill: (version: QuantSkillsAuthoringInstalledVersion) => Promise<void>;
    startAgent: (agent: QuantSkillsAgentDefinition) => Promise<void>;
    openManualAgent: (agent?: QuantSkillsAgentDefinition) => void;
    focusComposer: () => void;
}
type QuantSkillsAssetDraftCardProps = ToolCallViewProps & InjectFace<QuantSkillsAssetDraftCardInjected>;
/** Explicit confirmation card for one logged local 技能 or 专家 draft. */
export declare function QuantSkillsAssetDraftCard({ block, callId, sessionId, useSessions, commitAuthoring, startSkill, startAgent, openManualAgent, focusComposer, }: QuantSkillsAssetDraftCardProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=QuantSkillsAssetDraftCard.d.ts.map