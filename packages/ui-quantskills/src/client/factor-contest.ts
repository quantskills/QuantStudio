import { useCompetitionState } from './competition-async.ts'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type { FactorContestStatus, FactorCredentials, FactorInspection, FactorPlan, FactorPlanAction, FactorQuery, FactorRun } from './plugin-types.ts'

export interface FactorContestAccess {
  status(sessionId?: string): Promise<FactorContestStatus>
  mode(enabled: boolean): Promise<FactorContestStatus>
  connect(credentials?: FactorCredentials): Promise<FactorContestStatus>
  disconnect(): Promise<FactorContestStatus>
  checkUpdate(): Promise<FactorContestStatus>
  update(): Promise<FactorContestStatus>
  inspect(sessionId?: string, signal?: AbortSignal): Promise<FactorInspection>
  query(query: FactorQuery, signal?: AbortSignal): Promise<JsonValue>
  prepare(action: FactorPlanAction, sessionId?: string): Promise<FactorPlan>
  confirm(plan: FactorPlan): Promise<FactorPlan>
  dismiss(plan: FactorPlan): Promise<void>
  stopBudget(budgetId: string): Promise<void>
  reconcileRun(runId: string): Promise<FactorRun>
  reconcilePlan(planId: string): Promise<FactorPlan>
  startResearch(topic?: boolean, signal?: AbortSignal): Promise<void>
  requestResearch(sessionId: string, text: string): Promise<void>
}
export const factorPhases = { off: '已关闭', disconnected: '未连接', installing: '正在准备 CLI', connected: '已连接', error: '需要处理' }
export const factorStates: Record<string, string> = { prepared: '待确认', executing: '正在提交', completed: '已完成', failed: '未完成', unknown: '待核实 · 勿重发',
  cancelled: '已取消', expired: '已过期', active: '已授权', stopped: '已停止', exhausted: '已到预算限制', creating: '正在创建', running: '回测中' }

/** Local polling only. Invalidates late reads and actions on session changes or mode changes. */
export function useFactorContest(access: FactorContestAccess, sessionId?: string) {
  return useCompetitionState(access, sessionId)
}
