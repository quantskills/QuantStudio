/** 包级 invariant 伴随插件。 */
import type { Context } from '@deepseek-ai/cordis';
/** Cordis 伴随插件名。 */
export declare const name = "panda-mcp-invariant";
/** 注册前需要 invariant 服务。 */
export declare const inject: string[];
/** 登记本包的 invariant 所有权。 */
export declare const apply: (ctx: Context) => Promise<() => void>;
//# sourceMappingURL=invariant.d.ts.map