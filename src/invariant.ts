/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-quantskills-plugin`.
 * @module @deepseek-ai/dsh-quantskills-plugin/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-quantskills-plugin'

/** Cordis companion plugin name. */
export const name = 'quantskills-plugin-bundle-invariant'
/** Service required before the companion can register. */
export const inject = ['invariants']

// No runtime invariant: this package owns a static Loader patch list. The
// mounted Host, Session, Panda connector, and client packages own their live
// registrations and invariants.
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
