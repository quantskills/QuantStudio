import type { QuantSkillsManualSkillSaveRequest } from '@deepseek-ai/dsh-quantskills-host/types';
export type ManualSkillSave = (request: QuantSkillsManualSkillSaveRequest) => Promise<{
    assetId: string;
}>;
export interface ManualSkillSource {
    versionId: QuantSkillsManualSkillSaveRequest['sourceVersionId'];
    name: string;
    personal: boolean;
    read(signal: AbortSignal): Promise<string>;
}
export declare function ManualSkillEditor({ source, save, onSaved, onClose }: {
    source?: ManualSkillSource | undefined;
    save: ManualSkillSave;
    onSaved(assetId: string): void;
    onClose(): void;
}): import("react").JSX.Element;
//# sourceMappingURL=ManualSkillEditor.d.ts.map