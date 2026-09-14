/** Client assembly for the generated QuantSkills Host Remote contributions. */

import type { Context } from '@deepseek-ai/cordis'
import quantSkillsHostRemote from '@deepseek-ai/dsh-quantskills-host/remote'
import quantSkillsSessionRemote from '@deepseek-ai/dsh-quantskills-session/remote'
import pandaMcpRemote from '@deepseek-ai/dsh-panda-mcp/remote'
import type { TypertClientRemote, TypertDisposer } from '@deepseek-ai/dsh-typert-protocol'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Generated QuantSkills Remote namespaces mounted before the application UI. */
    remote: TypertClientRemote
  }
}

/** Base Remote service required before generated namespaces can mount. */
export const inject = ['remote']

/**
 * Mount the generated QuantSkills Remote namespaces before the UI requests them.
 * @param ctx - Client Cordis root carrying the typed Remote service.
 * @returns disposer that unmounts every namespace in reverse order.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const disposers: TypertDisposer[] = []
  try {
    for (const contribution of [quantSkillsHostRemote, quantSkillsSessionRemote, pandaMcpRemote]) {
      disposers.push(await ctx.remote.$mount(contribution))
    }
  } catch (error) {
    for (const dispose of disposers.reverse()) await dispose()
    throw error
  }
  return async () => {
    for (const dispose of disposers.reverse()) await dispose()
  }
}
