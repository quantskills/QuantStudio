/** Trusted QuantSkills catalog download and validation. */
import type { QuantSkillsCatalogSnapshot } from './types.ts';
/** Bounds owned by one configured catalog reader. */
export interface CatalogLimits {
    readonly maxBytes: number;
    readonly maxAssets: number;
}
/**
 * Assert that one configured catalog URL names the official publication.
 * @param value - configured raw catalog URL.
 */
export declare function validateCatalogUrl(value: string): void;
/**
 * Convert an approved repository URL into its canonical trusted form.
 * @param value - catalog-provided repository URL.
 * @param expectedName - catalog asset id that must equal the repository name.
 * @returns the canonical HTTPS repository URL.
 */
export declare function validateRepositoryUrl(value: string, expectedName: string): string;
/**
 * Parse and validate a trusted catalog response, returning approved assets only.
 * @param value - decoded JSON value from the bounded official response.
 * @param limits - configured catalog item bounds.
 * @returns the immutable approved projection.
 */
export declare function parseCatalogDocument(value: unknown, limits: CatalogLimits): Omit<QuantSkillsCatalogSnapshot, 'refreshAfterMs' | 'sync'>;
/**
 * Read a response body without allowing an omitted or false Content-Length to bypass the cap.
 * @param response - successful official catalog response.
 * @param maxBytes - maximum complete response bytes.
 * @returns the decoded JSON value.
 */
export declare function readCatalogResponse(response: Response, maxBytes: number): Promise<unknown>;
//# sourceMappingURL=catalog.d.ts.map