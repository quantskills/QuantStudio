import type { ModelAccessRequest, ModelAccessResponse } from '@deepseek-ai/dsh-quantskills-session/types';
import type { ContestAccess } from './contest.ts';
export type ModelAccess = (request: ModelAccessRequest) => Promise<ModelAccessResponse>;
/** QuantSkills owns this form and its typed Host API; no hidden Host forms are mounted. */
export declare function QuantSkillsModelServices({ access, jevAccess, initialData, initialAdding, onSaved, onBusyChange }: {
    access?: ModelAccess | undefined;
    jevAccess?: Pick<NonNullable<ContestAccess['watch']>, 'settings' | 'configure'> | undefined;
    initialData?: ModelAccessResponse | undefined;
    initialAdding?: boolean;
    onSaved?: (result: ModelAccessResponse) => void;
    onBusyChange?: (busy: boolean) => void;
}): import("react").JSX.Element;
//# sourceMappingURL=QuantSkillsModelServices.d.ts.map