/** Package-owned invariant companion for the Team tool adapter. */
const PACKAGE_NAME = '@deepseek-ai/dsh-tool-agent-team';
/** Cordis companion plugin name. */
export const name = 'tool-team-invariant';
/** Invariant registry dependency. */
export const inject = ['invariants'];
/** No runtime invariant: the Team service owns durable and authorization relations. */
const install = () => { };
/** Register this package's invariant ownership. */
export const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//# sourceMappingURL=invariant.js.map