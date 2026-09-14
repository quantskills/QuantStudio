import type { QuantSkillsAsset, QuantSkillsCatalogSnapshot } from './types.ts';
import type { QuantSkillsLibrarySourceRecord } from './plugin-types.ts';
export type CapabilityLibrarySource = 'mine' | 'installed' | 'discover' | 'unknown';
/** Stable metadata wins; only exact installed provenance may classify legacy definitions. */
export declare function agentLibrarySource(id: string, sourceVersionId: string | undefined, records: readonly QuantSkillsLibrarySourceRecord[], catalog: QuantSkillsCatalogSnapshot): CapabilityLibrarySource | 'internal';
/** Read local capabilities from Host installation truth, not the public catalog. */
export declare function skillLibraryAssets(catalog: QuantSkillsCatalogSnapshot, source: CapabilityLibrarySource): readonly QuantSkillsAsset[];
//# sourceMappingURL=capability-library.d.ts.map