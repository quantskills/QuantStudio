import type { ModelAccessResponse } from '@deepseek-ai/dsh-quantskills-session/types';
import { type ModelAccess } from './QuantSkillsModelServices.tsx';
import type { FlyAccess } from './fly/transport.ts';
export declare const hasConfiguredModel: (data: ModelAccessResponse) => boolean;
/** Lives in the application shell, so navigation never reopens a dismissed startup check. */
export declare function ModelStartup({ access, flyAccess }: {
    access: ModelAccess;
    flyAccess?: FlyAccess;
}): import("react").JSX.Element | null;
//# sourceMappingURL=ModelStartup.d.ts.map