/** Parser for standard QuantSkills `AGENTS.md` declarations. */
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { parseQuantSkillsPromptForm } from "./prompt-form.js";
const ASSET_PATTERN = /^agent-[a-z0-9](?:[a-z0-9_-]{0,98}[a-z0-9])?$/;
const SKILL_PATTERN = /^skill-[a-z0-9](?:[a-z0-9_-]{0,98}[a-z0-9])?$/;
const SKILL_REFERENCE_PATTERN = /^(?:skill-)?[a-z0-9](?:[a-z0-9_-]{0,98}[a-z0-9])?$/;
const metadataSchema = z.object({
    requires: z.array(z.string().regex(SKILL_REFERENCE_PATTERN)).max(32).optional(),
}).loose();
const frontmatterSchema = z.object({
    name: z.string().regex(ASSET_PATTERN),
    description: z.string().min(1).max(4_000),
    metadata: metadataSchema.optional(),
    quantSkills: metadataSchema.optional(),
}).loose();
/**
 * Parse and validate one standard QuantSkills Agent declaration.
 * @param raw - complete UTF-8 `AGENTS.md` text.
 * @returns validated template metadata and instruction body.
 */
export function parseQuantSkillsAgent(raw) {
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]+)$/.exec(raw);
    if (match === null)
        throw new Error('AGENTS.md requires YAML frontmatter and an instruction body');
    const parsed = frontmatterSchema.parse(parseYaml(projectFrontmatter(match[1] ?? '')));
    const instructions = (match[2] ?? '').trim();
    if (instructions === '')
        throw new Error('AGENTS.md instruction body is empty');
    const requires = (parsed.quantSkills?.requires ?? parsed.metadata?.requires ?? [])
        .map(value => value.startsWith('skill-') ? value : `skill-${value}`);
    if (requires.some(value => !SKILL_PATTERN.test(value))) {
        throw new Error('AGENTS.md contains an invalid Skill dependency');
    }
    const promptForm = parseQuantSkillsPromptForm(instructions);
    return Object.freeze({
        name: parsed.name,
        description: parsed.description,
        instructions,
        requires: Object.freeze(requires.map(value => value)),
        ...(promptForm === undefined ? {} : { promptForm }),
    });
}
function projectFrontmatter(input) {
    const lines = input.split(/\r?\n/);
    const projected = [];
    const emittedSections = new Set();
    let section;
    let requirementIndent;
    let scalarBlock = false;
    for (const line of lines) {
        const topLevel = /^(name|description|metadata|quantSkills):(?:\s*(.*))?$/.exec(line);
        if (topLevel !== null) {
            requirementIndent = undefined;
            scalarBlock = false;
            const key = topLevel[1];
            if (key === 'metadata' || key === 'quantSkills') {
                section = key;
            }
            else {
                section = undefined;
                const value = topLevel[2]?.trim() ?? '';
                projected.push(`${key}: ${yamlScalar(value)}`);
                scalarBlock = key === 'description' && /^[>|]/.test(value);
            }
            continue;
        }
        if (scalarBlock) {
            if (line.trim() === '' || /^\s+/.test(line)) {
                projected.push(line);
                continue;
            }
            scalarBlock = false;
        }
        if (section === undefined)
            continue;
        const requirement = /^(\s+)requires:\s*(.*)$/.exec(line);
        if (requirement !== null) {
            if (!emittedSections.has(section)) {
                projected.push(`${section}:`);
                emittedSections.add(section);
            }
            requirementIndent = requirement[1]?.length;
            projected.push(line);
            continue;
        }
        const indent = /^(\s+)/.exec(line)?.[1]?.length ?? 0;
        if (requirementIndent !== undefined && indent > requirementIndent)
            projected.push(line);
    }
    return projected.join('\n');
}
function yamlScalar(value) {
    if (value.startsWith('"') || value.startsWith("'") || /^[>|]/.test(value))
        return value;
    return JSON.stringify(value);
}
//# sourceMappingURL=agent-template.js.map