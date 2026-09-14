/** Bounded, fixed-commit QuantSkills repository README transport. */
import { QuantSkillsHostError } from "./error.js";
/**
 * Build the only upstream URL accepted for an approved asset README.
 * @param assetId - catalog-approved repository identity.
 * @param commit - catalog-approved exact commit.
 * @returns exact official raw `README.md` URL.
 */
export function quantSkillsReadmeUrl(assetId, commit) {
    return `https://raw.githubusercontent.com/quantskills/${assetId}/${commit}/README.md`;
}
/**
 * Decode one README response without allowing omitted Content-Length to bypass the cap.
 * @param response - successful exact raw README response.
 * @param maxBytes - maximum complete Markdown bytes.
 * @returns non-empty UTF-8 Markdown source.
 */
export async function readQuantSkillsReadmeResponse(response, maxBytes) {
    const declared = response.headers.get('content-length');
    if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) {
        throw new QuantSkillsHostError('QuantSkills README exceeds the configured byte limit.', 'ASSET_README_INVALID');
    }
    if (response.body === null) {
        throw new QuantSkillsHostError('QuantSkills README response has no body.', 'ASSET_README_FETCH_FAILED');
    }
    const reader = response.body.getReader();
    const chunks = [];
    let bytes = 0;
    try {
        while (true) {
            const next = await reader.read();
            if (next.done)
                break;
            bytes += next.value.byteLength;
            if (bytes > maxBytes) {
                await reader.cancel();
                throw new QuantSkillsHostError('QuantSkills README exceeds the configured byte limit.', 'ASSET_README_INVALID');
            }
            chunks.push(next.value);
        }
    }
    finally {
        reader.releaseLock();
    }
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
    }
    let markdown;
    try {
        markdown = new TextDecoder('utf-8', { fatal: true }).decode(body);
    }
    catch (error) {
        throw new QuantSkillsHostError('QuantSkills README is not valid UTF-8.', 'ASSET_README_INVALID', { cause: error });
    }
    if (markdown.trim() === '') {
        throw new QuantSkillsHostError('QuantSkills README is empty.', 'ASSET_README_INVALID');
    }
    return markdown;
}
//# sourceMappingURL=readme.js.map