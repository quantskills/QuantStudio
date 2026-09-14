/** Read-only result facts derived from one loaded Conversation window. */
import type { ChatSnapshot } from '@deepseek-ai/dsh-client-ui-chat/client';
/** One produced workspace file shown in the QuantSkills result workbench. */
export interface QuantSkillsProducedFile {
    readonly path: string;
    readonly name: string;
}
/** One workspace path reported by a mutation Tool or explicitly delivered by the Assistant. */
export type QuantSkillsResultFile = QuantSkillsProducedFile;
/** Host disposition for one result candidate discovered in a Conversation. */
export type QuantSkillsResultArtifactStatus = 'ready' | 'archived' | 'unavailable';
/** Host-normalized result path prepared for one Session workspace. */
export interface QuantSkillsPreparedResultArtifact {
    /** Exact path discovered in the Conversation. */
    readonly sourcePath: string;
    /** Canonical workspace-relative path; unavailable entries must not use it for file access. */
    readonly path: string;
    /** Whether the path was already local, archived from an installed asset, or rejected. */
    readonly status: QuantSkillsResultArtifactStatus;
    /** User-safe explanation for an unavailable candidate. */
    readonly reason?: string;
}
/** One real Tool lifecycle visible in the current loaded Conversation window. */
export interface QuantSkillsToolActivity {
    readonly callId: string;
    readonly name: string;
    readonly time: number;
    readonly status: 'running' | 'succeeded' | 'failed';
}
/** Result drawer facts for exactly one Session. */
export interface QuantSkillsResultData {
    readonly files: readonly QuantSkillsProducedFile[];
    readonly activity: readonly QuantSkillsToolActivity[];
    readonly settledToolCount: number;
    readonly failedToolCount: number;
    readonly runningToolCount: number;
    readonly turnCount: number;
    readonly hasOlderHistory: boolean;
}
/**
 * Read a normalized extension from a produced workspace path.
 * @param path - workspace-relative produced path.
 * @returns the lowercase extension without a leading period, or an empty string.
 */
export declare function resultExtension(path: string): string;
/**
 * Decide whether a result path is a common source or configuration file.
 * @param path - workspace-relative produced path.
 * @returns true when the result workbench should use its code reader.
 */
export declare function isCodeResultPath(path: string): boolean;
/**
 * Rank result formats by their default reading value in the preview drawer.
 * @param path - workspace-relative produced path.
 * @returns a lower rank for a more useful default view; 4 means system-open fallback.
 */
export declare function resultPreviewRank(path: string): number;
/**
 * Select viewable files produced by the latest loaded Turn.
 * @param snapshot - current Session's Conversation snapshot.
 * @returns exact result paths from that Turn; uncommon formats use the system application.
 */
export declare function previewableResultPathsForLatestTurn(snapshot: ChatSnapshot): readonly string[];
/**
 * Project files and Tool activity from a single loaded Session window.
 *
 * Produced paths prioritize exact workspace paths explicitly
 * delivered in the newest Assistant messages, then add ui-deliverables'
 * mutation-location facts.
 * The Host still validates every path before preview. Tool rows reuse the
 * Conversation assembler's settled and in-flight lifecycle values; no metric
 * is recomputed in the browser.
 * @param snapshot - current Session's Conversation snapshot.
 * @returns Session-isolated result facts, newest activity first.
 */
export declare function projectQuantSkillsResults(snapshot: ChatSnapshot, hasOlderHistory?: boolean): QuantSkillsResultData;
//# sourceMappingURL=result-data.d.ts.map