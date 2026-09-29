import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { SessionDeletionPreview } from '@deepseek-ai/dsh-quantskills-session/types';
export interface ArchivedSession {
    sessionId: SessionId;
    title: string;
    kind: 'plain' | 'skill' | 'agent' | 'team';
    updatedAt: number;
    running: boolean;
}
export interface SessionHistoryAccess {
    list(): Promise<readonly ArchivedSession[]>;
    archive(ids: readonly SessionId[]): Promise<void>;
    remove(ids: readonly SessionId[]): Promise<void>;
    restore(id: SessionId): Promise<void>;
    files?: SessionFileDeletionAccess;
}
export interface SessionFileDeletionAccess {
    preview(ids: readonly SessionId[]): Promise<readonly SessionDeletionPreview[]>;
    remove(previews: readonly SessionDeletionPreview[]): Promise<void>;
}
export declare function DeleteSessionConfirmation({ title, busy, error, onClose, onConfirm, heading, confirmLabel, retainedRunningCount, ids, filesAccess, onComplete }: {
    title: string;
    busy: boolean;
    error?: string | undefined;
    onClose(): void;
    onConfirm(): void;
    heading?: string;
    confirmLabel?: string;
    retainedRunningCount?: number;
    ids?: readonly SessionId[] | undefined;
    filesAccess?: SessionFileDeletionAccess | undefined;
    onComplete?: (() => void) | undefined;
}): import("react").JSX.Element;
export declare function ArchiveSessionConfirmation({ title, busy, error, onClose, onConfirm }: {
    title: string;
    busy: boolean;
    error?: string | undefined;
    onClose(): void;
    onConfirm(): void;
}): import("react").JSX.Element;
/** Cards and the conversation sidebar share the same compact action menu. */
export declare function SessionHistoryMenu({ id, title, running, access }: {
    id: SessionId;
    title: string;
    running: boolean;
    access: SessionHistoryAccess | undefined;
}): import("react").JSX.Element | null;
export declare function ArchivedSessions({ access }: {
    access: SessionHistoryAccess | undefined;
}): import("react").JSX.Element;
//# sourceMappingURL=ArchivedSessions.d.ts.map