import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'
export const MODEL_ACCESS_NS = 'quantskills-model-services'
export interface ConnectionPolicy {
  service: string; auto: boolean; state: string; message: string; verifiedModels: string[]
}
export interface ModelAccessSettings { connections: Record<string, ConnectionPolicy> }
/** Auto admission is explicit: an exact route must be verified and user-approved. */
export function modelAllowedForAuto(ctx: Context, provider: string, model?: string): boolean {
  // The product profile intentionally persists blank placeholders before a
  // person chooses a default. They are not legacy provider routes.
  if (provider.trim().length === 0 || (model !== undefined && model.trim().length === 0)) return false
  const policy = (ctx.get('settings')?.get(MODEL_ACCESS_NS) as ModelAccessSettings | undefined)?.connections?.[provider]
  return policy !== undefined && policy.auto && policy.state === 'verified'
    && (model === undefined || policy.verifiedModels.includes(model))
}
