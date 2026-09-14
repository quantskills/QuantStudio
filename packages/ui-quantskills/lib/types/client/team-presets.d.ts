import type { QuantSkillsAgentCreateRequest, QuantSkillsAgentDefinition, QuantSkillsAgentTeamCreateRequest, QuantSkillsAgentTeamDefinition } from './plugin-types.ts';
import type { QuantSkillsInstalledVersion } from './types.ts';
export interface TeamPreset {
    id: string;
    name: string;
    group: 'investing' | 'quant' | 'office';
    summary: string;
    example: string;
    output: string;
    lead: string;
    members: readonly {
        expert: string;
        responsibility: string;
    }[];
    stages: readonly string[];
}
export declare const TEAM_PRESETS: readonly TeamPreset[];
export declare const teamPresetMarker: (preset: TeamPreset) => string;
export declare const findPresetTeam: (preset: TeamPreset, teams: readonly QuantSkillsAgentTeamDefinition[]) => QuantSkillsAgentTeamDefinition | undefined;
export declare const expertPresetById: (id: string) => import("./expert-presets.ts").ExpertPreset;
export declare function teamDescription(preset: TeamPreset): string;
export declare function teamPresetRequest(preset: TeamPreset, definitions: readonly QuantSkillsAgentDefinition[]): QuantSkillsAgentTeamCreateRequest;
export interface TeamPresetAccess {
    definitions: readonly QuantSkillsAgentDefinition[];
    teams: readonly QuantSkillsAgentTeamDefinition[];
    versions: readonly QuantSkillsInstalledVersion[];
    createExpert(request: QuantSkillsAgentCreateRequest): Promise<QuantSkillsAgentDefinition>;
    createTeam(request: QuantSkillsAgentTeamCreateRequest): Promise<QuantSkillsAgentTeamDefinition>;
    savedExpert(expert: QuantSkillsAgentDefinition): void;
    savedTeam(team: QuantSkillsAgentTeamDefinition): void;
}
/** One sequential batch reuses shared experts and preserves partial success for retry. */
export declare function saveTeamPresets(presets: readonly TeamPreset[], access: TeamPresetAccess): Promise<QuantSkillsAgentTeamDefinition[]>;
//# sourceMappingURL=team-presets.d.ts.map