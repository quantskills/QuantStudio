import { type ExpertPreset } from './expert-presets.ts';
import { type TeamPreset } from './team-presets.ts';
import type { QuantSkillsAgentDefinition, QuantSkillsAgentTeamDefinition, QuantSkillsPromptFormListResult, QuantSkillsPromptFormRenderRequest, QuantSkillsSessionBinding } from './plugin-types.ts';
import { type ObservableSnapshot, type SnapshotStore } from '@deepseek-ai/dsh-client-store';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client';
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { QuantSkillsAgentsSnapshot, QuantSkillsAsset, QuantSkillsCatalogSnapshot, QuantSkillsSessionsSnapshot } from './types.ts';
import type { QuantSkillsAttachmentController } from './QuantSkillsAttachmentControl.tsx';
/** Root views opened from the shared composer plus menu. */
export type QuantSkillsCapabilityPickerMode = 'catalog' | 'frequent';
/** Observable picker state shared by the slash source and overlay component. */
export interface QuantSkillsCapabilityPickerState {
    readonly open: boolean;
    readonly sessionId?: SessionId;
    readonly mode: QuantSkillsCapabilityPickerMode;
}
/** Small controller that opens the session-scoped picker without touching draft text. */
export declare class QuantSkillsCapabilityPickerController {
    readonly source: SnapshotStore<QuantSkillsCapabilityPickerState>;
    /** Open one root view for the addressed Session. */
    open(sessionId: SessionId, mode: QuantSkillsCapabilityPickerMode): void;
    /** Close the picker while retaining its last root for a stable next open. */
    close(): void;
}
/** Register the two top-level ability rows shown before composer commands. */
export declare function quantSkillsLauncherSource(picker: QuantSkillsCapabilityPickerController, attachments: QuantSkillsAttachmentController): InputTriggerSource;
/** Business actions and observable data used by the taxonomy picker. */
export interface QuantSkillsCapabilityPickerInjected {
    readonly picker: ObservableSnapshot<QuantSkillsCapabilityPickerState>;
    readonly catalog: ObservableSnapshot<QuantSkillsCatalogSnapshot>;
    readonly sessions: ObservableSnapshot<QuantSkillsSessionsSnapshot>;
    readonly agents: ObservableSnapshot<QuantSkillsAgentsSnapshot>;
    readonly close: () => void;
    readonly toggleSkill: (sessionId: SessionId, asset: QuantSkillsAsset, attached: QuantSkillsSessionBinding | undefined) => Promise<void>;
    readonly openCatalogAgent: (asset: QuantSkillsAsset) => Promise<void>;
    readonly openUserAgent: (definition: QuantSkillsAgentDefinition) => Promise<void>;
    readonly openUserTeam: (definition: QuantSkillsAgentTeamDefinition) => Promise<void>;
    readonly openExpertPreset: (preset: ExpertPreset) => Promise<void>;
    readonly openTeamPreset: (preset: TeamPreset) => Promise<void>;
}
/** Complete props for the overlay picker. */
export type QuantSkillsCapabilityPickerProps = PropsRuntime<'conversation.input.overlay'> & InjectFace<QuantSkillsCapabilityPickerInjected>;
type PickerSource = 'mine' | 'recommended' | 'installed' | 'discover' | 'frequent';
type PickerKind = 'all' | 'skill' | 'agent' | 'agent-team';
type CapabilityRow = {
    id: string;
    kind: Exclude<PickerKind, 'all'>;
    name: string;
    description: string;
    category: string;
    subcategory?: string;
    asset?: QuantSkillsAsset;
    expert?: QuantSkillsAgentDefinition;
    team?: QuantSkillsAgentTeamDefinition;
    expertPreset?: ExpertPreset;
    teamPreset?: TeamPreset;
};
/** Local provenance and public recommendations remain separate, including private-only skills. */
export declare function capabilityLibraryRows(source: PickerSource, catalog: QuantSkillsCatalogSnapshot, agents: QuantSkillsAgentsSnapshot, sessions: QuantSkillsSessionsSnapshot): CapabilityRow[];
/** Search and filter every capability without changing the current draft. */
export declare function QuantSkillsCapabilityPicker({ sessionId, useProjection, picker, catalog, sessions, agents, close, toggleSkill, openCatalogAgent, openUserAgent, openUserTeam, openExpertPreset, openTeamPreset, }: QuantSkillsCapabilityPickerProps): import("react").ReactPortal | null;
/** Business callback needed by the resident chips. */
export interface QuantSkillsResidentControlInjected {
    readonly catalog: ObservableSnapshot<QuantSkillsCatalogSnapshot>;
    readonly detach: (sessionId: SessionId, assetId: string) => Promise<void>;
    readonly openPicker: (sessionId: SessionId) => void;
    readonly listPromptForms: (sessionId: SessionId) => Promise<QuantSkillsPromptFormListResult>;
    readonly renderPromptForm: (request: QuantSkillsPromptFormRenderRequest) => Promise<string>;
    readonly fillDraft: (sessionId: SessionId, text: string) => void;
    readonly runPrompt: (sessionId: SessionId, text: string) => void;
}
/** Complete props for resident capability chips inside the composer tool row. */
export type QuantSkillsResidentControlProps = PropsRuntime<'conversation.input.left'> & InjectFace<QuantSkillsResidentControlInjected>;
/** Show the Session's resident 专家 and 技能 set with one-click 技能 removal. */
export declare function QuantSkillsResidentControl({ sessionId, useProjection, catalog, detach, openPicker, listPromptForms, renderPromptForm, fillDraft, runPrompt, }: QuantSkillsResidentControlProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=QuantSkillsCapabilityPicker.d.ts.map