import type { ISidebarRight } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { fileAddressFor } from '@deepseek-ai/dsh-util-workspace-path'

export const QS_RESULTS_KIND = 'quantskills-results'

/** Refuse stale session callbacks; never borrow the currently visible session's paths. */
export function openNativeResult(sidebar: ISidebarRight | undefined, sessionId: SessionId, cwd: string | undefined, path?: string): boolean {
  if (sidebar === undefined || sidebar.mounted.getSnapshot() !== sessionId) return false
  if (path === undefined) sidebar.openTab(QS_RESULTS_KIND)
  else sidebar.openResource(fileAddressFor(sessionId, cwd, path))
  return true
}
