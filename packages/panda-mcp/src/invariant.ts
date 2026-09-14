/** 包级 invariant 伴随插件。 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-panda-mcp'

/** Cordis 伴随插件名。 */
export const name = 'panda-mcp-invariant'
/** 注册前需要 invariant 服务。 */
export const inject = ['invariants']

const install: InvariantInstaller = () => {}

/** 登记本包的 invariant 所有权。 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
