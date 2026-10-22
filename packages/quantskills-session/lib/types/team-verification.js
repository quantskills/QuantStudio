import { renderSkillContent } from '@deepseek-ai/dsh-skill';
import { defineTool } from '@deepseek-ai/dsh-tools';
export const TEAM_MEMBER_INSTRUCTIONS = 'read_team_member_instructions';
export const TEAM_CALCULATE = 'quantskills_calculate';
export const TEAM_LEAD_VERIFICATION = [
    `Before assigning a new kind of work, read the selected members' saved roles and exact Skill instructions with ${TEAM_MEMBER_INSTRUCTIONS}, batching the needed names. Reuse instructions still visible at the same version; reread after compaction if necessary. These are delegation references, not extra Skills for you to execute.`,
    'Delegate within those saved responsibilities, validation rules and output requirements. Do not add, rename or remove output fields merely to make a task more helpful. Forward explicit user changes accurately; do not invent changes on the user\'s behalf.',
    `Before accepting material numerical results, independently recompute from the original inputs with ${TEAM_CALCULATE} or an appropriate deterministic computation tool. Checking only that a member's totals agree with each other is not an independent check. Preserve every input occurrence, including equal-valued or repeated rows unless the task explicitly requires deduplication; reconcile operand counts with the source.`,
    'Compare the returned result against the saved requirements and explicit user changes before finalizing. Send a focused correction to the existing member when it fails; do not silently delete extra fields, manufacture missing results, or accept an unchecked amount. Keep internal verification metadata out of the user\'s result unless requested. If verification cannot be completed, report the blocker rather than claim success.',
].join('\n');
export const TEAM_MEMBER_VERIFICATION = [
    'A delegated task supplies scope and inputs; it does not silently replace your saved role, Skill validation rules or output requirements. Preserve the configured fields unless the task conveys an explicit user-requested change. If the delegation conflicts with the saved requirements, report the conflict to the lead instead of silently expanding the result.',
    `Use ${TEAM_CALCULATE} or an appropriate deterministic computation tool for material arithmetic before reporting a result. Compute from all relevant source rows, preserving repeated occurrences unless explicitly told to deduplicate, and check operand counts. A correct calculation does not prove that its operands are complete. Never replace missing or invalid inputs with zero.`,
].join('\n');
const abs = (value) => value < 0n ? -value : value;
function rational(n, d) {
    if (d === 0n)
        throw new Error('Division by zero is not a valid result.');
    if (d < 0n) {
        n = -n;
        d = -d;
    }
    let a = abs(n), b = d;
    while (b !== 0n) {
        const remainder = a % b;
        a = b;
        b = remainder;
    }
    n /= a;
    d /= a;
    if (abs(n).toString().length > 8192 || d.toString().length > 8192) {
        throw new Error('Calculation exceeds the exact arithmetic size limit.');
    }
    return { n, d };
}
function decimal(value) {
    if (typeof value !== 'string' || value.length > 128 || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) {
        throw new Error('Operands must be plain decimal strings; missing values, expressions and non-finite numbers are rejected.');
    }
    const unsigned = value.replace(/^[+-]/, ''), [whole = '0', fraction = ''] = unsigned.split('.');
    return rational(BigInt((value.startsWith('-') ? '-' : '') + (whole || '0') + fraction), 10n ** BigInt(fraction.length));
}
function formatted(value, places) {
    const scaled = abs(value.n) * 10n ** BigInt(places);
    const remainder = scaled % value.d;
    const rounded = scaled / value.d + (remainder * 2n >= value.d ? 1n : 0n);
    const digits = rounded.toString().padStart(places + 1, '0');
    const body = places === 0 ? digits : `${digits.slice(0, -places)}.${digits.slice(-places)}`.replace(/\.?0+$/, '');
    return { value: (value.n < 0n && rounded !== 0n ? '-' : '') + body, rounded: remainder !== 0n };
}
/** Pure decimal/rational arithmetic. No eval, shell, filesystem, model or network.
 * Repeated operands are deliberately retained; correctness of source selection
 * remains the caller's responsibility and is never represented as verified. */
export function calculateBatch(calculations, places = 12) {
    if (!Number.isInteger(places) || places < 0 || places > 18)
        throw new Error('decimal_places must be an integer from 0 to 18.');
    if (!Array.isArray(calculations) || calculations.length === 0 || calculations.length > 16)
        throw new Error('Supply between 1 and 16 calculations per batch.');
    const labels = new Set();
    return calculations.map(calculation => {
        if (!calculation || typeof calculation.label !== 'string' || !calculation.label.trim() || calculation.label.length > 200 || labels.has(calculation.label)) {
            throw new Error('Each calculation needs a distinct nonempty label of at most 200 characters.');
        }
        labels.add(calculation.label);
        const { operation, values } = calculation;
        if (!['sum', 'subtract', 'multiply', 'divide'].includes(operation))
            throw new Error('Unsupported arithmetic operation.');
        if (!Array.isArray(values) || values.length === 0 || values.length > 1024 || (['subtract', 'divide'].includes(operation) && values.length < 2)) {
            throw new Error('Supply 1–1024 operands, or at least two for subtract/divide. Split larger inputs into auditable batches.');
        }
        let total = decimal(values[0]);
        for (const source of values.slice(1)) {
            const next = decimal(source);
            switch (operation) {
                case 'sum':
                    total = rational(total.n * next.d + next.n * total.d, total.d * next.d);
                    break;
                case 'subtract':
                    total = rational(total.n * next.d - next.n * total.d, total.d * next.d);
                    break;
                case 'multiply':
                    total = rational(total.n * next.n, total.d * next.d);
                    break;
                case 'divide':
                    total = rational(total.n * next.d, total.d * next.n);
                    break;
            }
        }
        const expected = calculation.expected === undefined ? undefined : decimal(calculation.expected);
        return {
            label: calculation.label, operation, operandCount: values.length,
            ...formatted(total, places),
            exact: { numerator: total.n.toString(), denominator: total.d.toString() },
            ...(expected === undefined ? {} : { matchesExpected: total.n * expected.d === expected.n * total.d }),
        };
    });
}
export const teamCalculationTool = defineTool({
    name: TEAM_CALCULATE,
    description: 'Compute or independently check arithmetic using exact decimal inputs, preserving every operand occurrence. Batch named calculations. Does not verify that inputs are complete or that a financial/business rule is appropriate.',
    parameters: {
        calculations: {
            type: 'array', required: true,
            items: {
                type: 'object', additionalProperties: false,
                properties: {
                    label: { type: 'string', required: true },
                    operation: { type: 'string', required: true, enum: ['sum', 'subtract', 'multiply', 'divide'] },
                    values: { type: 'array', required: true, items: { type: 'string' }, description: 'Plain decimal strings in input order. Keep duplicates; subtract/divide proceed left to right.' },
                    expected: { type: 'string', description: 'Optional claimed result to check for exact equality.' },
                },
            },
        },
        decimal_places: { type: 'integer', description: '0–18; default 12. Rounds only the displayed final value, halfway away from zero. Exact fraction is also returned.' },
    },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    async execute(args, exec) {
        exec.signal.throwIfAborted();
        return JSON.stringify({ calculations: calculateBatch(args.calculations, args.decimal_places), sourceCompleteness: 'not-verified' });
    },
    isConcurrencySafe: () => true,
    presentCall: () => ({ card: 'generic', title: '复核计算', kind: 'read' }),
});
export function teamMemberInstructionReader(owner, resolve) {
    return defineTool({
        name: TEAM_MEMBER_INSTRUCTIONS,
        description: 'Read declared Team members\' frozen roles, workflow order and complete exact-version Skill instructions before delegation or result review. Read-only; does not activate members or attach their Skills to the lead.',
        parameters: { members: { type: 'array', required: true, items: { type: 'string' }, description: 'Declared member names to inspect together.' } },
        output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
        async execute(args, exec) {
            exec.signal.throwIfAborted();
            if (exec.agent !== owner)
                throw new Error('Only the exact Team Lead can inspect its declared member instructions.');
            if (args.members.length === 0 || args.members.length > 16)
                throw new Error('Choose 1–16 declared members.');
            const selected = [...new Set(args.members)].map(name => {
                const value = resolve(name);
                if (!value)
                    throw new Error(`No declared Team member ${JSON.stringify(name)}.`);
                return value;
            });
            return selected.map(({ member, resolved }) => [
                `Delegation reference only — do not adopt this member's role or execute its Skills on its behalf.`,
                `Member: ${member.name}; Agent: ${member.agent.agentId}; saved revision: ${String(member.agent.revision)}.`,
                `Saved role:\n${member.agent.role}`,
                `Skill orchestration: ${member.agent.mode}. Skill order (exact versions): ${JSON.stringify(resolved.map(skill => skill.version.versionId))}`,
                ...resolved.map(skill => `Exact version: ${skill.version.versionId}\n${renderSkillContent(skill.definition)}`),
            ].join('\n\n')).join('\n\n');
        },
        isConcurrencySafe: () => true,
        presentCall: args => ({ card: 'generic', title: '查看成员职责与输出要求', kind: 'read', rawInput: args.members.join(', ') }),
    });
}
//# sourceMappingURL=team-verification.js.map