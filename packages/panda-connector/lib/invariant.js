//#region lib/types/invariant.js
/** Package-owned invariant companion. @module @deepseek-ai/dsh-panda-connector/invariant */
const PACKAGE_NAME = "@deepseek-ai/dsh-panda-connector";
/** Cordis companion plugin name. */
const name = "panda-connector-invariant";
/** Service required before the companion can reserve package ownership. */
const inject = ["invariants"];
/** No runtime invariant: connection publication is owned inside one serialized service. */
const install = () => {};
/** Register this package's invariant companion. */
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };
