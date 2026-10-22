import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
/** The official main-view reference owns selection; catalog membership alone does not. */
export function selectedSession(state: SessionListState) {
  return Object.values(state.byId).find(item => (item.retainedBy.mainView ?? 0) > 0)?.id
}
