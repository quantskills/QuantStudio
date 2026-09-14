const STOCK_PERSONA_IDENTITY = /^You are a coding agent powered by the [^\n]+? model(?:, running on the DeepSeek Harness)?\./;
const QUANTSKILLS_IDENTITY = 'You are QuantSkills, an AI assistant for research and everyday work.';
/** Built-in agent presets shadow the deployment persona; adapt only their identity sentence. */
export function installQuantSkillsIdentity(ctx) {
    ctx.on('system-prompt/assemble', async (_assembly, _context, next) => {
        const assembly = await next();
        return {
            ...assembly,
            sections: assembly.sections.map(section => section.name === 'deployment:persona'
                ? { ...section, text: section.text.replace(STOCK_PERSONA_IDENTITY, QUANTSKILLS_IDENTITY) }
                : section),
        };
    });
}
//# sourceMappingURL=product-identity.js.map