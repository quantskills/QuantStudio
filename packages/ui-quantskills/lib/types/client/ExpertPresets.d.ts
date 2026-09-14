import { type ReactNode } from 'react';
import type { QuantSkillsAgentCreateRequest, QuantSkillsAgentDefinition } from './plugin-types.ts';
import type { QuantSkillsInstalledVersion } from './types.ts';
export interface ExpertPresetsProps {
    definitions: readonly QuantSkillsAgentDefinition[];
    versions: readonly QuantSkillsInstalledVersion[];
    ready: boolean;
    icon?: ReactNode;
    create(request: QuantSkillsAgentCreateRequest): Promise<QuantSkillsAgentDefinition>;
    start(definition: QuantSkillsAgentDefinition): Promise<unknown>;
    open(definition: QuantSkillsAgentDefinition): void;
}
export declare function ExpertPresets(props: ExpertPresetsProps): import("react").JSX.Element;
//# sourceMappingURL=ExpertPresets.d.ts.map