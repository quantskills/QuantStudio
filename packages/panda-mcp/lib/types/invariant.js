/** 包级 invariant 伴随插件。 */
const PACKAGE_NAME = '@deepseek-ai/dsh-panda-mcp';
/** Cordis 伴随插件名。 */
export const name = 'panda-mcp-invariant';
/** 注册前需要 invariant 服务。 */
export const inject = ['invariants'];
const install = () => { };
/** 登记本包的 invariant 所有权。 */
export const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//# sourceMappingURL=invariant.js.map