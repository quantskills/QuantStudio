import type { ModelAccessRequest, ModelAccessResponse } from '@deepseek-ai/dsh-quantskills-session/types';
export type ModelAccess = (request: ModelAccessRequest) => Promise<ModelAccessResponse>;
/** QuantSkills owns this form and its typed Host API; no hidden Host forms are mounted. */
export declare function QuantSkillsModelServices({ access, initialData, initialAdding, onSaved, onBusyChange }: {
    access?: ModelAccess | undefined;
    initialData?: ModelAccessResponse | undefined;
    initialAdding?: boolean;
    onSaved?: (result: ModelAccessResponse) => void;
    onBusyChange?: (busy: boolean) => void;
}): import("react").JSX.Element;
//# sourceMappingURL=QuantSkillsModelServices.d.ts.map