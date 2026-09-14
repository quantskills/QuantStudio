/** Durable Host-owned storage for user-authored QuantSkills Agent Team definitions. */
import { chmod, lstat, mkdir, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write';
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths';
import { z } from 'zod';
import { quantSkillsAgentDefinitionSchema } from "./agent-store.js";
const SCHEMA_VERSION = 1;
const DOCUMENT_NAME = 'agent-teams.json';
const TEAM_ID = /^agent-team-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MEMBER_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Maximum UTF-8 byte size accepted for the complete Agent Team document. */
export const MAX_AGENT_TEAM_DOCUMENT_BYTES = 4 * 1024 * 1024;
/** Maximum number of declared teammates in one Agent Team. */
export const MAX_AGENT_TEAM_MEMBERS = 8;
const teamModelSelectionSchema = z.object({
    provider: z.string().min(1).max(200),
    model: z.string().min(1).max(500),
    reasoningEffort: z.string().min(1).max(100).optional(),
}).strict();
/** Durable schema for one explicit Agent Team role model policy. */
export const quantSkillsAgentTeamModelChoiceSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('default') }).strict(),
    z.object({ kind: z.literal('fixed'), selection: teamModelSelectionSchema }).strict(),
]).transform(choice => choice.kind === 'default'
    ? freezeTeamModelChoice({ kind: 'default' })
    : freezeTeamModelChoice({
        kind: 'fixed',
        selection: {
            provider: choice.selection.provider,
            model: choice.selection.model,
            ...(choice.selection.reasoningEffort === undefined
                ? {}
                : { reasoningEffort: choice.selection.reasoningEffort }),
        },
    }));
const memberDefinitionSchema = z.object({
    name: z.string().regex(MEMBER_NAME).max(64).refine(name => name !== 'lead', 'lead is reserved'),
    context: z.enum(['fresh', 'fork']),
    agent: quantSkillsAgentDefinitionSchema,
    model: quantSkillsAgentTeamModelChoiceSchema.optional(),
}).strict().transform(member => Object.freeze({
    name: member.name,
    context: member.context,
    agent: member.agent,
    model: member.model ?? modelChoiceFromAgent(member.agent),
}));
/** Durable schema for one complete Agent Team definition. */
export const quantSkillsAgentTeamDefinitionSchema = z.object({
    teamId: z.string().regex(TEAM_ID),
    revision: z.number().int().positive(),
    name: z.string().min(1).max(80),
    description: z.string().min(1).max(4_000),
    lead: quantSkillsAgentDefinitionSchema,
    leadModel: quantSkillsAgentTeamModelChoiceSchema.optional(),
    members: z.array(memberDefinitionSchema).min(1).max(MAX_AGENT_TEAM_MEMBERS),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
}).strict().superRefine((definition, issue) => {
    const names = new Set();
    for (const [index, member] of definition.members.entries()) {
        if (names.has(member.name)) {
            issue.addIssue({ code: 'custom', message: 'teammate names must be unique', path: ['members', index, 'name'] });
        }
        names.add(member.name);
    }
}).transform(freezeTeamDefinition);
/** Durable schema for one immutable Agent Team Session binding. */
export const quantSkillsAgentTeamSessionSchema = quantSkillsAgentTeamDefinitionSchema;
/** Durable schema for one continuable Agent Team member Session. */
export const quantSkillsAgentTeamMemberSessionSchema = z.object({
    teamId: z.string().regex(TEAM_ID),
    teamRevision: z.number().int().positive(),
    memberName: z.string().regex(MEMBER_NAME).max(64),
    agent: quantSkillsAgentDefinitionSchema,
    model: quantSkillsAgentTeamModelChoiceSchema.optional(),
}).strict().transform(value => Object.freeze({
    teamId: value.teamId,
    teamRevision: value.teamRevision,
    memberName: value.memberName,
    agent: value.agent,
    model: value.model ?? modelChoiceFromAgent(value.agent),
}));
const documentSchema = z.object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    teams: z.array(quantSkillsAgentTeamDefinitionSchema),
}).strict();
/** Host-owned durable Agent Team definition store with serialized atomic mutations. */
export class QuantSkillsAgentTeamStore {
    root;
    tail = Promise.resolve();
    /** @param dshHome - optional Harness home override. */
    constructor(dshHome) {
        this.root = join(resolveDshHome(dshHome), 'quantskills');
    }
    /**
     * Read every validated definition ordered by most recent update.
     * @returns immutable Team definitions.
     */
    async list() {
        const document = await this.read(await this.path());
        return Object.freeze([...document.teams].sort((left, right) => right.updatedAt - left.updatedAt || left.teamId.localeCompare(right.teamId)));
    }
    /**
     * Serialize one read-modify-write transaction.
     * @param mutation - pure replacement calculated from the latest stored definitions.
     * @returns the mutation's result after the replacement is durable.
     */
    mutate(mutation) {
        const run = this.tail.then(async () => {
            const path = await this.path();
            return withFileLock(path, async () => {
                const current = await this.read(path);
                const changed = mutation(current.teams);
                await this.write(path, { schemaVersion: SCHEMA_VERSION, teams: changed.teams });
                return changed.result;
            });
        });
        this.tail = run.then(() => { }, () => { });
        return run;
    }
    async read(path) {
        let source;
        try {
            const info = await lstat(path);
            if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_AGENT_TEAM_DOCUMENT_BYTES) {
                throw new Error('Agent Team document is not a bounded regular file');
            }
            source = await readFile(path, 'utf8');
        }
        catch (error) {
            if (isMissing(error))
                return { schemaVersion: SCHEMA_VERSION, teams: [] };
            throw error;
        }
        const parsed = documentSchema.parse(JSON.parse(source));
        const ids = new Set();
        return Object.freeze({
            schemaVersion: SCHEMA_VERSION,
            teams: Object.freeze(parsed.teams.map((definition) => {
                if (ids.has(definition.teamId))
                    throw new Error(`duplicate QuantSkills Agent Team id "${definition.teamId}"`);
                ids.add(definition.teamId);
                return definition;
            })),
        });
    }
    async write(path, document) {
        const validated = documentSchema.parse(document);
        const content = `${JSON.stringify(validated, null, 2)}\n`;
        if (Buffer.byteLength(content, 'utf8') > MAX_AGENT_TEAM_DOCUMENT_BYTES) {
            throw new Error(`QuantSkills Agent Team document exceeds ${String(MAX_AGENT_TEAM_DOCUMENT_BYTES)} bytes`);
        }
        await writeFileAtomic(path, content, { mode: 0o600, dirMode: 0o700 });
    }
    async path() {
        await mkdir(this.root, { recursive: true, mode: 0o700 });
        const info = await lstat(this.root);
        if (!info.isDirectory() || info.isSymbolicLink())
            throw new Error('QuantSkills managed root is not a real directory');
        await chmod(this.root, 0o700);
        return join(await realpath(this.root), DOCUMENT_NAME);
    }
}
/**
 * Deep-freeze one parsed or newly constructed Agent Team definition.
 * @param definition - validated complete Team value.
 * @returns the immutable branded Team definition.
 */
export function freezeTeamDefinition(definition) {
    return Object.freeze({
        teamId: definition.teamId,
        revision: definition.revision,
        name: definition.name,
        description: definition.description,
        lead: definition.lead,
        leadModel: definition.leadModel ?? modelChoiceFromAgent(definition.lead),
        members: Object.freeze(definition.members.map(member => Object.freeze({
            name: member.name,
            context: member.context,
            agent: member.agent,
            model: member.model ?? modelChoiceFromAgent(member.agent),
        }))),
        createdAt: definition.createdAt,
        updatedAt: definition.updatedAt,
    });
}
/**
 * Freeze one Team member Session binding.
 * @param input - exact Team revision, member name, and Agent snapshot.
 * @returns the immutable member Session binding.
 */
export function freezeTeamMemberSessionBinding(input) {
    return Object.freeze({
        teamId: input.teamId,
        teamRevision: input.teamRevision,
        memberName: input.memberName,
        agent: input.agent,
        model: input.model ?? modelChoiceFromAgent(input.agent),
    });
}
/**
 * Deep-freeze one explicit Team role model choice.
 * @param choice - default or exact provider/model selection.
 * @returns detached immutable choice.
 */
export function freezeTeamModelChoice(choice) {
    if (choice.kind === 'default')
        return Object.freeze({ kind: 'default' });
    return Object.freeze({
        kind: 'fixed',
        selection: Object.freeze({
            provider: choice.selection.provider,
            model: choice.selection.model,
            ...(choice.selection.reasoningEffort === undefined
                ? {}
                : { reasoningEffort: choice.selection.reasoningEffort }),
        }),
    });
}
function modelChoiceFromAgent(agent) {
    return agent.model === undefined
        ? Object.freeze({ kind: 'default' })
        : freezeTeamModelChoice({ kind: 'fixed', selection: agent.model });
}
function isMissing(error) {
    return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
//# sourceMappingURL=team-store.js.map