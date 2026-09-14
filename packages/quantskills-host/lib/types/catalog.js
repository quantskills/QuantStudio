/** Trusted QuantSkills catalog download and validation. */
import { z } from 'zod';
import { QuantSkillsHostError } from "./error.js";
import { resolveQuantSkillsDisplayName } from "./display-names.js";
const SNAPSHOT_PATTERN = /^sha256:[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const ASSET_PATTERN = /^(?:skill|agent)-[a-z0-9](?:[a-z0-9_-]{0,98}[a-z0-9])?$/;
const OFFICIAL_CATALOG_PATTERN = /^https:\/\/raw\.githubusercontent\.com\/quantskills\/quantskills\/(?:main|[a-f0-9]{40})\/site\/catalog\.json$/;
const taxonomyLabelSchema = z.object({
    label_en: z.string().min(1),
    label_zh: z.string().min(1),
});
const subcategorySchema = taxonomyLabelSchema.extend({
    id: z.string().min(1),
});
const categorySchema = taxonomyLabelSchema.extend({
    subcategories: z.array(subcategorySchema),
});
const envelopeSchema = z.object({
    snapshot_id: z.string(),
    taxonomy: z.object({
        categories: z.record(z.string(), categorySchema),
    }),
    assets: z.array(z.unknown()),
});
const statusSchema = z.looseObject({ catalog_status: z.string() });
const approvedAssetSchema = z.object({
    catalog_status: z.literal('approved'),
    name: z.string(),
    project_type: z.enum(['skill', 'agent']),
    url: z.string(),
    commit_sha: z.string(),
    declaration_file: z.string(),
    title: z.string().optional(),
    title_zh: z.string().optional(),
    title_en: z.string().optional(),
    aliases: z.array(z.string()).max(100).optional(),
    name_source: z.enum(['catalog', 'declaration', 'generated', 'asset-id']).optional(),
    category: z.string().optional(),
    subcategory: z.string().optional(),
    description: z.string().optional(),
    health: z.string().optional(),
    validation_level: z.string().optional(),
    requires: z.array(z.string()).optional(),
    summary_en: z.string().optional(),
    summary_zh: z.string().optional(),
});
/**
 * Assert that one configured catalog URL names the official publication.
 * @param value - configured raw catalog URL.
 */
export function validateCatalogUrl(value) {
    if (!OFFICIAL_CATALOG_PATTERN.test(value)) {
        throw new QuantSkillsHostError('Catalog URL must name the official QuantSkills publication.', 'CATALOG_INVALID');
    }
}
/**
 * Convert an approved repository URL into its canonical trusted form.
 * @param value - catalog-provided repository URL.
 * @param expectedName - catalog asset id that must equal the repository name.
 * @returns the canonical HTTPS repository URL.
 */
export function validateRepositoryUrl(value, expectedName) {
    let url;
    try {
        url = new URL(value);
    }
    catch (error) {
        throw new QuantSkillsHostError('Catalog repository URL is invalid.', 'CATALOG_INVALID', { cause: error });
    }
    const match = /^\/quantskills\/([a-z0-9][a-z0-9_-]*)$/.exec(url.pathname);
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port !== ''
        || url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== ''
        || match?.[1] !== expectedName) {
        throw new QuantSkillsHostError('Catalog repository must be an exact quantskills GitHub HTTPS URL.', 'CATALOG_INVALID');
    }
    return `https://github.com/quantskills/${expectedName}`;
}
/**
 * Parse and validate a trusted catalog response, returning approved assets only.
 * @param value - decoded JSON value from the bounded official response.
 * @param limits - configured catalog item bounds.
 * @returns the immutable approved projection.
 */
export function parseCatalogDocument(value, limits) {
    const envelope = envelopeSchema.safeParse(value);
    if (!envelope.success || !SNAPSHOT_PATTERN.test(envelope.data.snapshot_id)) {
        throw new QuantSkillsHostError('QuantSkills catalog envelope is invalid.', 'CATALOG_INVALID');
    }
    if (envelope.data.assets.length > limits.maxAssets) {
        throw new QuantSkillsHostError('QuantSkills catalog exceeds the configured asset limit.', 'CATALOG_INVALID');
    }
    const categories = parseCategories(envelope.data.taxonomy.categories);
    const categoryIndex = new Map(categories.map(category => [category.id, category]));
    const assets = [];
    const seen = new Set();
    for (const candidate of envelope.data.assets) {
        const status = statusSchema.safeParse(candidate);
        if (!status.success)
            continue;
        if (status.data.catalog_status !== 'approved')
            continue;
        const parsed = approvedAssetSchema.safeParse(candidate);
        if (!parsed.success)
            continue;
        const item = parsed.data;
        const declaration = item.project_type === 'skill' ? 'SKILL.md' : 'AGENTS.md';
        if (!ASSET_PATTERN.test(item.name) || !item.name.startsWith(`${item.project_type}-`)
            || !COMMIT_PATTERN.test(item.commit_sha) || item.declaration_file !== declaration) {
            continue;
        }
        const category = item.category === undefined ? undefined : categoryIndex.get(item.category);
        if ((item.category !== undefined && category === undefined)
            || (item.subcategory !== undefined
                && (category === undefined || !category.subcategories.some(entry => entry.id === item.subcategory)))) {
            continue;
        }
        if (item.requires?.some(requirement => !ASSET_PATTERN.test(requirement)) === true)
            continue;
        const requires = item.requires?.map(requirement => requirement);
        const title = optionalText(item.title);
        const description = optionalText(item.description);
        const health = optionalText(item.health);
        const validationLevel = optionalText(item.validation_level);
        const summaryEn = optionalText(item.summary_en);
        const summaryZh = optionalText(item.summary_zh);
        const titleZh = optionalText(item.title_zh);
        const titleEn = optionalText(item.title_en);
        const display = resolveQuantSkillsDisplayName({
            assetId: item.name,
            kind: item.project_type,
            ...(title === undefined ? {} : { title }),
            ...(titleZh === undefined ? {} : { titleZh }),
            ...(titleEn === undefined ? {} : { titleEn }),
            ...(item.aliases === undefined ? {} : { aliases: item.aliases }),
            ...(summaryZh === undefined ? {} : { summaryZh }),
            ...(summaryEn === undefined ? {} : { summaryEn }),
            ...(item.name_source === undefined ? {} : { nameSource: item.name_source }),
        });
        if (seen.has(item.name))
            continue;
        let repository;
        try {
            repository = validateRepositoryUrl(item.url, item.name);
        }
        catch (error) {
            if (error instanceof QuantSkillsHostError && error.code === 'CATALOG_INVALID')
                continue;
            throw error;
        }
        seen.add(item.name);
        assets.push(Object.freeze({
            assetId: item.name,
            kind: item.project_type,
            repository,
            commit: item.commit_sha,
            declaration,
            ...display,
            ...(title === undefined ? {} : { title }),
            ...(item.category === undefined ? {} : { category: item.category }),
            ...(item.subcategory === undefined ? {} : { subcategory: item.subcategory }),
            ...(description === undefined ? {} : { description }),
            ...(health === undefined ? {} : { health }),
            ...(validationLevel === undefined ? {} : { validationLevel }),
            ...(requires === undefined ? {} : { requires: Object.freeze(requires) }),
            ...(summaryEn === undefined ? {} : { summaryEn }),
            ...(summaryZh === undefined ? {} : { summaryZh }),
        }));
    }
    return Object.freeze({
        snapshotId: envelope.data.snapshot_id,
        categories,
        assets: Object.freeze(assets),
    });
}
function parseCategories(input) {
    const categories = Object.entries(input).map(([id, category]) => {
        if (id.length === 0)
            throw new QuantSkillsHostError('QuantSkills taxonomy category id is invalid.', 'CATALOG_INVALID');
        const seen = new Set();
        const subcategories = category.subcategories.map((subcategory) => {
            if (seen.has(subcategory.id)) {
                throw new QuantSkillsHostError('QuantSkills taxonomy contains a duplicate subcategory.', 'CATALOG_INVALID');
            }
            seen.add(subcategory.id);
            return Object.freeze({
                id: subcategory.id,
                labelEn: subcategory.label_en,
                labelZh: subcategory.label_zh,
            });
        }).sort((left, right) => left.id.localeCompare(right.id));
        return Object.freeze({
            id,
            labelEn: category.label_en,
            labelZh: category.label_zh,
            subcategories: Object.freeze(subcategories),
        });
    });
    categories.sort((left, right) => left.id.localeCompare(right.id));
    return Object.freeze(categories);
}
function optionalText(value) {
    return value === undefined || value.trim() === '' ? undefined : value;
}
/**
 * Read a response body without allowing an omitted or false Content-Length to bypass the cap.
 * @param response - successful official catalog response.
 * @param maxBytes - maximum complete response bytes.
 * @returns the decoded JSON value.
 */
export async function readCatalogResponse(response, maxBytes) {
    const declared = response.headers.get('content-length');
    if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) {
        throw new QuantSkillsHostError('QuantSkills catalog exceeds the configured byte limit.', 'CATALOG_INVALID');
    }
    if (response.body === null)
        throw new QuantSkillsHostError('QuantSkills catalog response has no body.', 'CATALOG_FETCH_FAILED');
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
                throw new QuantSkillsHostError('QuantSkills catalog exceeds the configured byte limit.', 'CATALOG_INVALID');
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
    try {
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
    }
    catch (error) {
        if (error instanceof QuantSkillsHostError)
            throw error;
        throw new QuantSkillsHostError('QuantSkills catalog is not valid UTF-8 JSON.', 'CATALOG_INVALID', { cause: error });
    }
}
//# sourceMappingURL=catalog.js.map