/** Client-safe configuration and audit status for Jev's plan-only watcher. */
import type { ContestIdentity } from './contest-types.ts'

export interface ContestWatchConfig {
  symbol: string
  volume: number
  intervalSeconds: number
  decisionIntervalSeconds?: number
  openingCooldownSeconds?: number
  decisionMode?: 'jev' | 'strict' | undefined
  durationMinutes: number
  minConfidence: number
  maxEquityDrop: number
  maxPlans: number
  instructions: string
  strategyName?: string | undefined
  actionCriteria?: Partial<Record<ContestWatchAction, string | undefined>> | undefined
  referenceMaterial?: string | undefined
  allowedSide?: 'both' | 'long_only' | 'short_only' | undefined
  minSamples?: number | undefined
  maxSpread?: number | undefined
  builtInTemplate?: 'rb-range' | 'range' | 'trend' | 'breakout' | undefined
  customStrategy?: boolean | undefined
  instrument?: { product: string; exchange: 'SHF' | 'DCE' | 'CZC' | 'CFE' | 'INE' | 'GFE'; tickSize: number } | undefined
  signalRules?: ContestWatchSignalRules | undefined
  autoHistory?: { exchange: 'SHF' | 'DCE' | 'CZC' | 'CFE' | 'INE' | 'GFE'; barSeconds: 60 | 300 } | undefined
  history?: { datasetId: string; barSeconds: 60 | 300; timeMeaning: 'open' | 'close'; refresh: boolean; columns: { time: string; symbol: string; open: string; high: string; low: string; close: string } } | undefined
  rangeRules?: { lookbackBars: number; tickSize: number; minWidthTicks: number; minTouches: number; edgeFraction: number; reboundTicks: number; roundTripCostTicks: number; minRewardCostRatio: number; stopLossTicks: number; takeProfitTicks: number } | undefined
}
export type ContestWatchSignalRules = {
  kind: 'trend' | 'breakout'; lookbackBars: number; tickSize: number; roundTripCostTicks: number; minRewardCostRatio: number; stopLossTicks: number; takeProfitTicks: number
  fastBars: number; slowBars: number; pullbackTicks: number; reboundTicks: number; bufferTicks: number; maxChaseTicks: number
}
export interface ContestWatchTemplate { name: string; config: ContestWatchConfig }
export type ContestWatchAction = 'hold' | 'open_long' | 'open_short' | 'close_long' | 'close_short'
export interface ContestWatchDecision {
  action: ContestWatchAction
  confidence: number
  probabilities: Record<string, number>
  model: string
  time: number
  usage?: { input_tokens: number; output_tokens: number }
  assessments?: Record<'regime' | 'fit' | 'blocker', { choice: string; confidence: number; probabilities: Record<string, number> }>
}
export interface ContestWatchBar { time: number; open: number; high: number; low: number; close: number }
export interface ContestWatchHistory { source: string; fetchedAt?: number; barSeconds: number; bars: ContestWatchBar[]; issue?: string; warning?: string; diagnostic?: { stage: string; code: string; retryable: boolean } }
export interface ContestWatchCheck { id: string; label: string; state: 'pass' | 'fail' | 'unknown'; detail: string; actions: ContestWatchAction[]; enforcement?: 'hard' | 'reference'; facts?: Record<string, number | boolean | string | null> }
export interface ContestWatchEvidence {
  evaluatedAt: number
  decisionMode?: 'jev' | 'strict'
  history: { source: string; barSeconds: number; count: number; from?: number; to?: number; fetchedAt?: number; issue?: string; warning?: string; diagnostic?: { stage: string; code: string; retryable: boolean } }
  features: { quoteWindowSeconds: number; quoteCount: number; lower: number | null; upper: number | null; widthTicks: number | null; lowerTouches: number; upperTouches: number; location: number | null; reboundTicks: number | null; pullbackTicks: number | null; spreadTicks: number | null; longRewardCostRatio: number | null; shortRewardCostRatio: number | null }
  checks: ContestWatchCheck[]
  allowedActions: ContestWatchAction[]
}
export interface ContestWatchDataset { id: string; name: string; columns: string[]; rows: number; source: string }
export interface ContestJevRequest {
  id: string
  purpose: 'watch' | 'connection-test' | 'research' | 'validation'
  startedAt: number
  finishedAt: number
  keyFingerprint: string
  httpStatus?: number
  model?: string
  usage?: { input_tokens: number; output_tokens: number }
}
export interface ContestJevUsage {
  since: number
  requests: number
  responsesOk: number
  unknownUsage: number
  inputTokens: number
  outputTokens: number
  records: ContestJevRequest[]
}
export interface ContestWatchQuote { time: number; price: number; bid?: number; ask?: number }
export interface ContestWatchAnalysis {
  id: string
  startedAt: number
  responseAt?: number
  finishedAt?: number
  sampleCount: number
  fromTime: number
  toTime: number
  price: number
  allowedActions: ContestWatchAction[]
  decision?: ContestWatchDecision
  outcome: string
  planId?: string
  strategyName?: string
  strategyVersion?: string
  evidence?: ContestWatchEvidence
  planStatus?: 'restricted' | 'hold' | 'candidate' | 'prepared' | 'blocked'
  reviewNotes?: string[]
}
export interface ContestJevSettings {
  configured: boolean
  writable: boolean
  model: string
  testedAt?: number
  latencyMs?: number
  message?: string
  translator?: { provider: string; model: string } | undefined
  translationModels?: { provider: string; model: string }[]
}
export interface ContestWatchStatus {
  running: boolean
  message: string
  strategyNotices?: string[]
  phase?: 'sampling' | 'waiting_quote' | 'deciding' | 'checking' | 'waiting_plan'
  lastQuoteCheckedAt?: number
  nextDecisionAt?: number
  openingCooldownUntil?: number
  nextRetryAt?: number
  accountCheckedAt?: number
  samples?: ContestWatchQuote[]
  analyses?: ContestWatchAnalysis[]
  config?: ContestWatchConfig
  identity?: ContestIdentity
  runId?: string
  startedAt?: number
  expiresAt?: number
  equityBaseline?: number
  sampleCount: number
  planCount: number
  openingPlanCount?: number
  lastPlanId?: string
  lastDecision?: ContestWatchDecision
  events: { time: number; message: string }[]
}
