//#region lib/types/invariant.js
/** Package-owned invariant companion for the Team tool adapter. */
const PACKAGE_NAME = "@deepseek-ai/dsh-tool-agent-team";
/** Cordis companion plugin name. */
const name = "tool-team-invariant";
/** Invariant registry dependency. */
const inject = ["invariants"];
/** No runtime invariant: the Team service owns durable and authorization relations. */
const install = () => {};
/** Register this package's invariant ownership. */
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };
