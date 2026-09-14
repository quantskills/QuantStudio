import type { QuantSkillsAgentCreateRequest, QuantSkillsAgentDefinition } from './plugin-types.ts';
import type { QuantSkillsInstalledVersion } from './types.ts';
export declare const PRESET_GROUPS: {
    readonly investing: "投资研究";
    readonly quant: "量化研究";
    readonly office: "日常办公";
};
export interface ExpertPreset {
    id: string;
    name: string;
    group: keyof typeof PRESET_GROUPS;
    summary: string;
    example: string;
    output: string;
    skills: readonly string[];
    workflow: readonly string[];
}
export declare const EXPERT_PRESETS: readonly ExpertPreset[];
export declare const expertMarker: (preset: ExpertPreset) => string;
export declare const findPresetExpert: (preset: ExpertPreset, definitions: readonly QuantSkillsAgentDefinition[]) => QuantSkillsAgentDefinition | undefined;
export declare function expertRole(preset: ExpertPreset): string;
/** Bind only verified installed skills, one exact version per asset. */
export declare function presetRequest(preset: ExpertPreset, versions: readonly QuantSkillsInstalledVersion[]): QuantSkillsAgentCreateRequest;
//# sourceMappingURL=expert-presets.d.ts.map