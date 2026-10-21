import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { QuantSkillsPreparedResultArtifact } from './result-data.ts';
import type { QuantSkillsResultPreview } from './plugin-types.ts';
export interface NativeResultsInjected {
    listFiles: (signal: AbortSignal) => Promise<readonly QuantSkillsPreparedResultArtifact[]>;
    prepareFiles: (paths: readonly string[], signal: AbortSignal) => Promise<readonly QuantSkillsPreparedResultArtifact[]>;
    openFile: (path: string) => void;
    openWorkspace: () => void;
    downloadFile: (path: string) => void;
}
export declare function NativeResults({ sessionId, useSession, useSessions, useChat, listFiles, prepareFiles, openFile, openWorkspace, downloadFile }: PropsRuntime<'sidebar.right.pane.tab'> & InjectFace<NativeResultsInjected>): import("react").JSX.Element;
export interface NativeMediaInjected {
    previewFile: (sessionId: string, path: string) => Promise<QuantSkillsResultPreview>;
}
/** Preserve QS media and isolated HTML within the official tab lifecycle. */
export declare function NativeResultMedia({ useTabInfo, previewFile }: PropsRuntime<'sidebar.right.pane.tab'> & InjectFace<NativeMediaInjected>): import("react").JSX.Element;
//# sourceMappingURL=NativeResults.d.ts.map