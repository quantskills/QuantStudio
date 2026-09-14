//#region lib/types/invariant.js
/** Package-owned invariant companion. @module @deepseek-ai/dsh-quantskills-host/invariant */
const PACKAGE_NAME = "@deepseek-ai/dsh-quantskills-host";
/** Cordis companion plugin name. */
const name = "quantskills-host-invariant";
/** Service required before package ownership can be reserved. */
const inject = ["invariants"];
/** No runtime invariant: installed truth is validated from atomic Host manifests on each list. */
const install = () => {};
/**
* Register this package's invariant companion.
* @param ctx - Context carrying the invariant registry.
* @returns the registration disposer.
*/
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };
