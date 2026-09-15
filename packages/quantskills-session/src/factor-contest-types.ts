import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type { ContestIdentity } from './contest-types.ts'

export const FACTOR_CONTEST_ID = 'pandaai-fourth-factor'
export interface FactorCredentials { readonly phone: string; readonly password: string }
export interface FactorBatchRequest {
  readonly hypothesis: string
  readonly maxRuns: number
  readonly creditThreshold: number
  readonly startDate: string
  readonly endDate: string
  readonly cycle: number
}
export interface FactorCandidate {
  readonly requestId: string
  readonly name: string
  readonly formula?: string
  readonly code?: string
  readonly direction: 0 | 1
}
export type FactorPoolAction =
  | { readonly kind: 'create-pool'; readonly name: string; readonly style: string; readonly cycle: number }
  | { readonly kind: 'update-pool'; readonly name: string; readonly style: string; readonly cycle?: number }
  | { readonly kind: 'add-factor'; readonly workflowId: string }
  | { readonly kind: 'replace-factor'; readonly factorId: string; readonly workflowId: string }
  | { readonly kind: 'remove-factor'; readonly factorId: string }
  | { readonly kind: 'submit-pool' }
export type FactorPlanAction = FactorPoolAction | { readonly kind: 'budget'; readonly batch: FactorBatchRequest }
export interface FactorPlan {
  id: string
  sessionId: string
  identity: ContestIdentity
  action: FactorPlanAction
  summary: string
  snapshot: JsonValue
  snapshotHash: string
  createdAt: number
  expiresAt: number
  status: 'prepared' | 'executing' | 'completed' | 'failed' | 'unknown' | 'cancelled' | 'expired'
  result?: JsonValue
}
export interface FactorBudget extends FactorBatchRequest {
  id: string
  sessionId: string
  identity: ContestIdentity
  runsUsed: number
  creditsUsed: number
  baseline: number
  status: 'active' | 'stopped' | 'exhausted' | 'unknown'
}
export interface FactorRun {
  id: string
  budgetId: string
  sessionId: string
  identity: ContestIdentity
  candidate: FactorCandidate
  workflowId?: string
  runId?: string
  createdAt: number
  status: 'creating' | 'running' | 'completed' | 'failed' | 'unknown'
  result?: JsonValue
}
export interface FactorInspection {
  identity: ContestIdentity
  fetchedAt: number
  balance: number
  registration: JsonValue
  pool: JsonValue
}
export interface FactorContestStatus {
  enabled: boolean
  phase: 'off' | 'disconnected' | 'installing' | 'connected' | 'error'
  cliVersion?: string
  latestVersion?: string
  updateAvailable: boolean
  identity?: ContestIdentity
  message: string
  inspection?: FactorInspection
  plans: FactorPlan[]
  budgets: FactorBudget[]
  runs: FactorRun[]
}
export interface FactorQuery {
  readonly kind: 'pool' | 'workflows' | 'scores' | 'factor-info' | 'factor-result' | 'factors'
  readonly id?: string
  readonly page?: number
}
