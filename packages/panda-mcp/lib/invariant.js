//#region lib/types/invariant.js
/** 包级 invariant 伴随插件。 */
const PACKAGE_NAME = "@deepseek-ai/dsh-panda-mcp";
/** Cordis 伴随插件名。 */
const name = "panda-mcp-invariant";
/** 注册前需要 invariant 服务。 */
const inject = ["invariants"];
const install = () => {};
/** 登记本包的 invariant 所有权。 */
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };
