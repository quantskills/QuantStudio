/** Stable localized display-name resolution for trusted QuantSkills catalog assets. */
import type { QuantSkillsAssetKind, QuantSkillsDisplayNames, QuantSkillsDisplayNameSource } from './types.ts';
/** Catalog fields that may contribute to one immutable display-name projection. */
export interface QuantSkillsDisplayNameInput {
    readonly assetId: string;
    readonly kind: QuantSkillsAssetKind;
    readonly title?: string;
    readonly titleZh?: string;
    readonly titleEn?: string;
    readonly aliases?: readonly string[];
    readonly summaryZh?: string;
    readonly summaryEn?: string;
    readonly nameSource?: QuantSkillsDisplayNameSource;
}
/** Complete display metadata tied to one catalog asset id and commit. */
export interface ResolvedQuantSkillsDisplayName {
    readonly displayNames: QuantSkillsDisplayNames;
    readonly aliases: readonly string[];
    readonly nameSource: QuantSkillsDisplayNameSource;
}
/**
 * Resolve stable localized names during catalog intake.
 * @param input - validated catalog identity and optional publication metadata.
 * @returns localized names, searchable aliases, and their origin.
 */
export declare function resolveQuantSkillsDisplayName(input: QuantSkillsDisplayNameInput): ResolvedQuantSkillsDisplayName;
/**
 * Read the first Chinese Markdown H1 from an installed declaration.
 * @param declaration - exact installed `SKILL.md` or `AGENTS.md` text.
 * @returns normalized Chinese heading, or undefined when the H1 is absent or English-only.
 */
export declare function extractChineseDeclarationTitle(declaration: string): string | undefined;
//# sourceMappingURL=display-names.d.ts.map