/** Git tree validation for immutable QuantSkills installations. */
import type { QuantSkillsDeclarationFile, QuantSkillsTreeDigest } from './types.ts';
/** Configured bounds applied to the complete upstream tree. */
export interface GitTreeLimits {
    readonly maxFiles: number;
    readonly maxTotalBytes: number;
    readonly maxFileBytes: number;
    readonly maxDepth: number;
    readonly maxPathBytes: number;
}
/** One validated regular Git blob used for checkout verification. */
export interface ValidatedGitBlob {
    readonly mode: '100644' | '100755';
    readonly object: string;
    readonly bytes: number;
    readonly path: string;
}
/** Complete validation result for one fixed commit tree. */
export interface ValidatedGitTree {
    readonly entries: readonly ValidatedGitBlob[];
    readonly fileCount: number;
    readonly totalBytes: number;
    readonly treeDigest: QuantSkillsTreeDigest;
}
/**
 * Parse bounded `git ls-tree -rlz --full-tree` output and reject unsafe trees.
 * @param output - complete, non-lossy NUL-delimited Git output.
 * @param declaration - exact root declaration required by the catalog kind.
 * @param limits - configured complete-tree bounds.
 * @returns the validated entries and deterministic tree digest.
 */
export declare function validateGitTree(output: string, declaration: QuantSkillsDeclarationFile, limits: GitTreeLimits): ValidatedGitTree;
//# sourceMappingURL=tree.d.ts.map