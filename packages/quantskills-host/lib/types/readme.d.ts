/** Bounded, fixed-commit QuantSkills repository README transport. */
import type { QuantSkillsAssetId, QuantSkillsCommitSha } from './types.ts';
/**
 * Build the only upstream URL accepted for an approved asset README.
 * @param assetId - catalog-approved repository identity.
 * @param commit - catalog-approved exact commit.
 * @returns exact official raw `README.md` URL.
 */
export declare function quantSkillsReadmeUrl(assetId: QuantSkillsAssetId, commit: QuantSkillsCommitSha): string;
/**
 * Decode one README response without allowing omitted Content-Length to bypass the cap.
 * @param response - successful exact raw README response.
 * @param maxBytes - maximum complete Markdown bytes.
 * @returns non-empty UTF-8 Markdown source.
 */
export declare function readQuantSkillsReadmeResponse(response: Response, maxBytes: number): Promise<string>;
//# sourceMappingURL=readme.d.ts.map