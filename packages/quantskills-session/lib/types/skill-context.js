import { renderSkillContent } from '@deepseek-ai/dsh-skill';
import { defineTool } from '@deepseek-ai/dsh-tools';
export const ATTACHED_SKILL_READER = 'read_attached_skills';
/** Conservative character-based gate, not a token/cost prediction. A deferred read
 * adds a round trip: single Skills and fixed all-Skill workflows stay inline. */
export function selectSkillContextMode(configured, skills, fixedWorkflow = false) {
    if (configured === 'full' || fixedWorkflow || skills.length < 2)
        return 'full';
    const sizes = skills.map(skill => ({
        full: renderResidentSkillContext(skill, 'full').length,
        catalog: renderResidentSkillContext(skill, 'progressive').length,
    }));
    if (sizes.filter(size => size.catalog < size.full).length < 2)
        return 'full';
    const full = sizes.reduce((sum, size) => sum + size.full, 0);
    const catalog = sizes.reduce((sum, size) => sum + size.catalog, 0);
    // Leave headroom for the tool schema, routing guidance and an extra request.
    return full >= 3 * (catalog + PROGRESSIVE_SKILL_GUIDANCE.length + 800) ? 'progressive' : 'full';
}
/** Shared guidance is emitted once per Agent, never once per attached Skill. */
export const PROGRESSIVE_SKILL_GUIDANCE = [
    'Attached QuantSkills capabilities remain available at their exact saved versions.',
    `Before acting on a task, use ${ATTACHED_SKILL_READER} with all applicable asset_ids in one call to read their complete instructions. Match by the user request, role and descriptions; a catalog entry is not the instructions.`,
    'For a fixed Skill workflow, load every attached Skill before performing the workflow and follow the explicit attached workflow order. Do not omit prerequisites, validation or output requirements.',
    'Do not reload instructions already visible in full at the same version. After context compaction, reload any required instructions whose full details are no longer visible. Full inline Skill sections need no separate load.',
    'Skill descriptions are routing metadata. Never infer missing instructions or silently substitute another Skill/version.',
].join('\n');
export function renderSkillLoadingGuidance(skills, mode, fixedWorkflow) {
    const assetIds = skills.map(skill => skill.version.assetId);
    const order = `Attached Skill workflow order (asset_ids): ${JSON.stringify(assetIds)}`;
    if (fixedWorkflow)
        return `Follow every attached Skill in the explicit workflow order. Preserve all prerequisites, validation and output requirements.\n${order}\nSkill names by asset_id: ${JSON.stringify(skills.map(skill => ({ asset_id: skill.version.assetId, name: skill.definition.name })))}`;
    return mode === 'progressive' ? `${PROGRESSIVE_SKILL_GUIDANCE}\n${order}` : '';
}
/** Communication policy changes neither saved team membership nor fresh/fork settings. */
export const EFFICIENT_TEAM_GUIDANCE = [
    'Activate only members needed for this task and reuse an existing member for follow-up work.',
    'Give each member a self-contained task with relevant inputs, constraints, expected output and acceptance checks. Avoid copying unrelated history or assigning the same investigation twice.',
    'Report conclusions, evidence/file paths, validation and blockers. Preserve facts needed by the recipient; do not paste entire transcripts or files that the recipient can read.',
    'send_message starts or resumes an inactive recipient. Do not send acknowledgement-only replies or progress polling that would create unnecessary turns. Wait for required work and validate the combined result before final delivery.',
].join('\n');
/** Use full instructions for short or invocation-restricted Skills; never truncate a body. */
export function renderResidentSkillContext(skill, mode) {
    const full = [
        'The following QuantSkills Skill is resident in this Session. Apply it whenever relevant without asking the user to load or restate it.',
        renderSkillContent(skill.definition),
    ].join('\n\n');
    if (mode === 'full' || skill.definition.invocation?.modelInvocable === false)
        return full;
    const catalog = 'Attached Skill (instructions available on demand): ' + JSON.stringify({
        asset_id: skill.version.assetId,
        version: skill.version.versionId,
        name: skill.definition.name,
        description: skill.definition.description,
    });
    return catalog.length < full.length ? catalog : full;
}
/** Resolve only current Agent attachments, preserving complete contents and resource bases. */
export function attachedSkillReader(resolve, ownerId) {
    return defineTool({
        name: ATTACHED_SKILL_READER,
        description: 'Read complete instructions for exact attached QuantSkills Skills. Batch all applicable asset_ids in one call before using them. No need to reload a version still visible in full.',
        parameters: {
            asset_ids: { type: 'array', required: true, items: { type: 'string' }, description: 'Exact asset_id values from this Agent\'s attached Skill catalog, in workflow order.' },
        },
        output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
        async execute(args, exec) {
            exec.signal.throwIfAborted();
            if (ownerId !== undefined && exec.agent?.id !== ownerId)
                throw new Error('Read Skills from the current Agent only; inherited attachment readers cannot access another Agent\'s Skills.');
            if (args.asset_ids.length === 0)
                throw new Error('Choose at least one attached Skill asset_id.');
            const skills = [...new Set(args.asset_ids)].map(id => {
                const skill = resolve(id);
                if (!skill)
                    throw new Error(`Skill ${JSON.stringify(id)} is not attached to this Agent. Read its current catalog; do not substitute another version.`);
                if (skill.definition.invocation?.modelInvocable === false)
                    throw new Error(`Skill ${JSON.stringify(id)} is available only through its explicit inline instructions.`);
                return skill;
            });
            return skills.map(skill => `Exact attached version: ${skill.version.versionId}\n${renderSkillContent(skill.definition)}`).join('\n\n');
        },
        isConcurrencySafe: () => true,
        presentCall: args => ({ card: 'generic', title: 'Read attached Skill instructions', kind: 'read', rawInput: args.asset_ids.join(', ') }),
    });
}
//# sourceMappingURL=skill-context.js.map