import { type ReactNode } from 'react';
import { type TeamPresetAccess } from './team-presets.ts';
import type { QuantSkillsAgentTeamDefinition } from './plugin-types.ts';
export interface TeamPresetsProps extends Omit<TeamPresetAccess, 'savedExpert' | 'savedTeam'> {
    ready: boolean;
    icon?: ReactNode;
    start(team: QuantSkillsAgentTeamDefinition): Promise<unknown>;
    open(team: QuantSkillsAgentTeamDefinition): void;
}
export declare function TeamPresets(props: TeamPresetsProps): import("react").JSX.Element;
//# sourceMappingURL=TeamPresets.d.ts.map