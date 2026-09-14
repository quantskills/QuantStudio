import type { FinalDeliverablesOwnerProps } from '@deepseek-ai/dsh-client-ui-chat/client';
import type { QuantSkillsResultPreview } from '@deepseek-ai/dsh-quantskills-session/types';
export interface FinalDeliverablesInjected {
    previewFile: (path: string) => Promise<QuantSkillsResultPreview>;
    openWorkbench: (path: string) => void;
    downloadFile?: ((path: string) => void) | undefined;
}
export declare function FinalDeliverables({ items, openWorkbench, previewFile, downloadFile }: FinalDeliverablesOwnerProps & FinalDeliverablesInjected): import("react").JSX.Element;
//# sourceMappingURL=FinalDeliverables.d.ts.map