/** `ctx.skills` provider for Host-committed QuantSkills versions. */
import { readFile } from 'node:fs/promises';
import { isSkillName } from '@deepseek-ai/dsh-skill';
import { parse as parseYaml } from 'yaml';
import { parseQuantSkillsPromptForm } from "./prompt-form.js";
const PROVIDER_NAME = 'quantskills-host';
const PROVIDER_RANK = 50;
/** Provider name recorded on registry-visible QuantSkills definitions. */
export const QUANTSKILLS_SKILL_PROVIDER = PROVIDER_NAME;
/**
 * Parse one standard DSH Skill declaration from an exact checked-out commit.
 * @param raw - complete UTF-8 `SKILL.md` text.
 * @returns validated discovery metadata and instruction body.
 */
export function parseQuantSkillsSkill(raw) {
    const parsed = parseFrontmatter(raw);
    if (parsed === undefined)
        throw new Error('SKILL.md requires YAML frontmatter');
    const name = requiredString(parsed.data, 'name');
    const description = requiredString(parsed.data, 'description');
    if (!isSkillName(name))
        throw new Error(`SKILL.md contains invalid skill name "${name}"`);
    const whenToUse = optionalString(parsed.data, 'whenToUse');
    const metadata = optionalRecord(parsed.data, 'metadata');
    const promptForm = parseQuantSkillsPromptForm(parsed.body);
    return Object.freeze({
        name,
        description,
        ...(whenToUse === undefined ? {} : { whenToUse }),
        invocation: parseInvocationPolicy(parsed.data),
        ...(metadata === undefined ? {} : { metadata: Object.freeze(metadata) }),
        content: parsed.body.trim(),
        ...(promptForm === undefined ? {} : { promptForm }),
    });
}
/**
 * Check the catalog identity accepted for one standard Skill declaration.
 * @param assetId - approved repository and installation identity.
 * @param declarationName - name parsed from the root `SKILL.md`.
 * @returns whether the declaration uses the asset id or its standard name without one `skill-` repository prefix.
 */
export function matchesQuantSkillsSkillName(assetId, declarationName) {
    return declarationName === assetId
        || (assetId.startsWith('skill-') && declarationName === assetId.slice('skill-'.length));
}
/** Provider that exposes the latest committed version of every installed Skill. */
export class QuantSkillsInstalledSkillProvider {
    locations;
    name = PROVIDER_NAME;
    /**
     * @param locations - reads the current Host-committed Skill locations.
     */
    constructor(locations) {
        this.locations = locations;
    }
    /**
     * Project installed declarations into registry candidates.
     * @param options - caller cancellation for manifest and declaration reads.
     * @returns candidates backed by immutable Host version directories.
     */
    async list(options) {
        const candidates = [];
        for (const location of await this.locations(options.signal)) {
            options.signal?.throwIfAborted();
            const parsed = await readParsedSkill(location, options.signal);
            assertAssetName(location, parsed);
            candidates.push(toCandidate(location, parsed));
        }
        return Object.freeze(candidates);
    }
    /**
     * Load the exact declaration selected during discovery.
     * @param candidate - provider-owned installed-version locator.
     * @param options - caller cancellation for the declaration read.
     * @returns the complete installed Skill definition.
     */
    async get(candidate, options) {
        const location = candidate.locator;
        const parsed = await readParsedSkill(location, options.signal);
        assertAssetName(location, parsed);
        return Object.freeze({
            ...projectSkill(location, parsed),
            content: parsed.content,
        });
    }
}
function toCandidate(location, parsed) {
    return Object.freeze({
        ...projectSkill(location, parsed),
        rank: PROVIDER_RANK,
        locator: Object.freeze({ ...location }),
    });
}
function projectSkill(location, parsed) {
    return {
        name: parsed.name,
        description: parsed.description,
        ...(parsed.whenToUse === undefined ? {} : { whenToUse: parsed.whenToUse }),
        invocation: parsed.invocation,
        source: PROVIDER_NAME,
        provider: PROVIDER_NAME,
        resourceBase: { kind: 'directory', path: location.resourceBase },
        path: location.declarationPath,
        ...(parsed.metadata === undefined ? {} : { metadata: parsed.metadata }),
    };
}
async function readParsedSkill(location, signal) {
    signal?.throwIfAborted();
    const raw = await readFile(location.declarationPath, { encoding: 'utf8', signal });
    signal?.throwIfAborted();
    return parseQuantSkillsSkill(raw);
}
/**
 * Load one exact Host-installed Skill location as a complete immutable definition.
 * @param location - exact committed version location returned by the Host store.
 * @param signal - optional caller cancellation for the declaration read.
 * @returns the parsed Skill definition pinned to that location.
 */
export async function loadQuantSkillsInstalledSkill(location, signal) {
    const parsed = await readParsedSkill(location, signal);
    assertAssetName(location, parsed);
    return Object.freeze({
        ...projectSkill(location, parsed),
        content: parsed.content,
    });
}
function assertAssetName(location, parsed) {
    if (!matchesQuantSkillsSkillName(location.assetId, parsed.name)) {
        throw new Error(`installed Skill name "${parsed.name}" does not match asset "${location.assetId}"`);
    }
}
function parseFrontmatter(raw) {
    const firstLineEnd = raw.indexOf('\n');
    if (firstLineEnd < 0 || raw.slice(0, firstLineEnd).replace(/\r$/, '') !== '---')
        return undefined;
    const start = firstLineEnd + 1;
    let lineStart = start;
    while (lineStart <= raw.length) {
        const nextNewline = raw.indexOf('\n', lineStart);
        const lineEnd = nextNewline < 0 ? raw.length : nextNewline;
        if (raw.slice(lineStart, lineEnd).replace(/\r$/, '') === '---') {
            const parsed = parseYaml(raw.slice(start, lineStart));
            if (!isRecord(parsed))
                return undefined;
            return { data: parsed, body: raw.slice(nextNewline < 0 ? raw.length : nextNewline + 1) };
        }
        if (nextNewline < 0)
            return undefined;
        lineStart = nextNewline + 1;
    }
    return undefined;
}
function requiredString(data, key) {
    const value = data[key];
    if (typeof value !== 'string' || value.trim() === '')
        throw new Error(`SKILL.md requires frontmatter field "${key}"`);
    return value;
}
function optionalString(data, key) {
    const value = data[key];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}
function optionalRecord(data, key) {
    const value = data[key];
    return isRecord(value) ? value : undefined;
}
function parseInvocationPolicy(data) {
    for (const [legacy, canonical] of [
        ['disableModelInvocation', 'disable-model-invocation'],
        ['modelInvocable', 'disable-model-invocation'],
        ['userInvocable', 'user-invocable'],
    ]) {
        if (Object.hasOwn(data, legacy))
            throw new Error(`frontmatter field "${legacy}" is unsupported; use "${canonical}"`);
    }
    return {
        modelInvocable: frontmatterBoolean(data, 'disable-model-invocation') !== true,
        userInvocable: frontmatterBoolean(data, 'user-invocable') !== false,
    };
}
function frontmatterBoolean(data, key) {
    if (!Object.hasOwn(data, key))
        return undefined;
    const value = data[key];
    if (typeof value === 'boolean')
        return value;
    const normalized = typeof value === 'string' ? value.toLowerCase() : value;
    if (normalized === 1 || ['1', 'true', 'yes', 'on'].includes(String(normalized)))
        return true;
    if (normalized === 0 || ['0', 'false', 'no', 'off'].includes(String(normalized)))
        return false;
    throw new TypeError(`frontmatter field "${key}" must be a boolean`);
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=skill-provider.js.map