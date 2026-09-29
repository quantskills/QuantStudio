import type { Context } from '@deepseek-ai/cordis';
import type { SessionHeader, SessionId } from '@deepseek-ai/dsh-session';
export interface GeneratedFile {
    root: string;
    path: string;
    bytes: number;
    digest: string;
    mtime: number;
    birthtime: number;
    ino: number;
    dev: number;
}
export interface GeneratedFileSelection {
    files: GeneratedFile[];
    retained: {
        path: string;
        reason: string;
    }[];
}
/** A reviewed file may not silently become a different file while the dialog is open. */
export declare function removeGeneratedFile(file: GeneratedFile): Promise<void>;
export declare function collectGeneratedFiles(ctx: Context, headers: ReadonlyMap<SessionId, SessionHeader>, ids: ReadonlySet<SessionId>): Promise<GeneratedFileSelection>;
//# sourceMappingURL=session-generated-files.d.ts.map