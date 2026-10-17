/** QuantSkills generic-file uploader mounted in the stock conversation tool row. */
import type { QuantSkillsSessionFileAttachment } from './plugin-types.ts';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
/** Dropped non-image files dispatched by the stock composer. */
export declare const COMPOSER_FILE_EVENT = "qs-composer-files";
/** Session-addressed bridge from the shared composer launcher to the hidden native file input. */
export declare class QuantSkillsAttachmentController {
    private readonly openers;
    /** Register the currently mounted file input for one Session. */
    register(sessionId: SessionId, open: () => void): () => void;
    /** Open the native file chooser for the addressed Session when its composer is mounted. */
    open(sessionId: SessionId): boolean;
}
/** Application callbacks required by the generic-file input control. */
export interface QuantSkillsAttachmentControlInjected {
    controller: QuantSkillsAttachmentController;
    upload: (sessionId: SessionId, file: File, data: string) => Promise<QuantSkillsSessionFileAttachment>;
    appendDraft: (sessionId: SessionId, text: string) => void;
    editDraft: (sessionId: SessionId, update: (draft: string) => string) => void;
}
/** Complete framework and application props for the generic-file input control. */
export type QuantSkillsAttachmentControlProps = PropsRuntime<'conversation.input.left'> & InjectFace<QuantSkillsAttachmentControlInjected>;
/** Upload selected files and append only their durable references to the current draft. */
export declare function QuantSkillsAttachmentControl({ sessionId, controller, upload, appendDraft, editDraft, }: QuantSkillsAttachmentControlProps): import("react").JSX.Element;
//# sourceMappingURL=QuantSkillsAttachmentControl.d.ts.map