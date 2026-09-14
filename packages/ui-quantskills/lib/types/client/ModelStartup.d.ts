import type { ModelAccessResponse } from '@deepseek-ai/dsh-quantskills-session/types';
import { type ModelAccess } from './QuantSkillsModelServices.tsx';
export declare const hasConfiguredModel: (data: ModelAccessResponse) => boolean;
/** Lives in the application shell, so navigation never reopens a dismissed startup check. */
export declare function ModelStartup({ access }: {
    access: ModelAccess;
}): import("react").JSX.Element | null;
//# sourceMappingURL=ModelStartup.d.ts.map