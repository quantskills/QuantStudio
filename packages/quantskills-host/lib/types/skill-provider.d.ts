/** `ctx.skills` provider for Host-committed QuantSkills versions. */
import type { SkillCandidate, SkillDefinition, SkillInvocationPolicy, SkillLookupOptions, SkillProvider } from '@deepseek-ai/dsh-skill';
import type { QuantSkillsAssetId, QuantSkillsInstalledVersionId } from './types.ts';
import type { QuantSkillsPromptFormResult } from './types.ts';
/** One immutable installed Skill declaration owned by the Host store. */
export interface QuantSkillsInstalledSkillLocation {
    readonly assetId: QuantSkillsAssetId;
    readonly versionId: QuantSkillsInstalledVersionId;
    readonly declarationPath: string;
    readonly resourceBase: string;
}
interface ParsedSkill {
    readonly name: string;
    readonly description: string;
    readonly whenToUse?: string;
    readonly invocation: SkillInvocationPolicy;
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly content: string;
    readonly promptForm?: QuantSkillsPromptFormResult;
}
/** Provider name recorded on registry-visible QuantSkills definitions. */
export declare const QUANTSKILLS_SKILL_PROVIDER = "quantskills-host";
/**
 * Parse one standard DSH Skill declaration from an exact checked-out commit.
 * @param raw - complete UTF-8 `SKILL.md` text.
 * @returns validated discovery metadata and instruction body.
 */
export declare function parseQuantSkillsSkill(raw: string): ParsedSkill;
/**
 * Check the catalog identity accepted for one standard Skill declaration.
 * @param assetId - approved repository and installation identity.
 * @param declarationName - name parsed from the root `SKILL.md`.
 * @returns whether the declaration uses the asset id or its standard name without one `skill-` repository prefix.
 */
export declare function matchesQuantSkillsSkillName(assetId: QuantSkillsAssetId, declarationName: string): boolean;
/** Provider that exposes the latest committed version of every installed Skill. */
export declare class QuantSkillsInstalledSkillProvider implements SkillProvider {
    private readonly locations;
    readonly name = "quantskills-host";
    /**
     * @param locations - reads the current Host-committed Skill locations.
     */
    constructor(locations: (signal?: AbortSignal) => Promise<readonly QuantSkillsInstalledSkillLocation[]>);
    /**
     * Project installed declarations into registry candidates.
     * @param options - caller cancellation for manifest and declaration reads.
     * @returns candidates backed by immutable Host version directories.
     */
    list(options: SkillLookupOptions): Promise<readonly SkillCandidate[]>;
    /**
     * Load the exact declaration selected during discovery.
     * @param candidate - provider-owned installed-version locator.
     * @param options - caller cancellation for the declaration read.
     * @returns the complete installed Skill definition.
     */
    get(candidate: SkillCandidate, options: SkillLookupOptions): Promise<SkillDefinition>;
}
/**
 * Load one exact Host-installed Skill location as a complete immutable definition.
 * @param location - exact committed version location returned by the Host store.
 * @param signal - optional caller cancellation for the declaration read.
 * @returns the parsed Skill definition pinned to that location.
 */
export declare function loadQuantSkillsInstalledSkill(location: QuantSkillsInstalledSkillLocation, signal?: AbortSignal): Promise<SkillDefinition>;
export {};
//# sourceMappingURL=skill-provider.d.ts.map