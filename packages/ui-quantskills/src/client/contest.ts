import { useEffect, useRef, useState } from 'react'
import { useCompetitionState, waitForCompetition } from './competition-async.ts'
import type { ContestData, ContestPlan, ContestQuery, ContestStatus, ContestInspection, ContestJevSettings, ContestJevUsage, ContestWatchConfig, ContestWatchDataset, ContestWatchTemplate, ContestWatchStatus } from './plugin-types.ts'

export interface ContestAccess {
  watch?: {
    settings(): Promise<ContestJevSettings>
    usage(): Promise<ContestJevUsage>
    templates(): Promise<ContestWatchTemplate[]>
    saveTemplate(request: ContestWatchTemplate): Promise<ContestWatchTemplate[]>
    datasets(): Promise<ContestWatchDataset[]>
    prepareHistory(request: { symbol: string; barSeconds: number }): Promise<NonNullable<ContestWatchConfig['history']>>
    configure(request: { apiKey?: string; translator?: { provider: string; model: string } }): Promise<ContestJevSettings>
    status(): Promise<ContestWatchStatus>
    start(config: ContestWatchConfig): Promise<ContestWatchStatus>
    stop(): Promise<ContestWatchStatus>
  }
  status(sessionId?: string): Promise<ContestStatus>
  mode(enabled: boolean): Promise<ContestStatus>
  connect(): Promise<ContestStatus>
  disconnect(): Promise<ContestStatus>
  checkUpdate(): Promise<ContestStatus>
  update(): Promise<ContestStatus>
  query(query: ContestQuery, signal?: AbortSignal): Promise<ContestData>
  execute(plan: ContestPlan): Promise<ContestPlan>
  dismiss(plan: ContestPlan): Promise<ContestStatus>
  reconcile(plan: ContestPlan): Promise<ContestPlan>
  inspect(sessionId: string, signal?: AbortSignal): Promise<ContestInspection>
  requestResearch(sessionId: string, text: string): Promise<void>
  startResearch(topic?: boolean, signal?: AbortSignal): Promise<void>
}

/** Polls local status only while a contest surface is mounted. Late responses cannot restore old UI state. */
export function useContest(access: ContestAccess, sessionId?: string) {
  const state = useCompetitionState(access, sessionId), { status } = state
  const watched = useRef(new Map<string, number>()), watching = useRef(new Set<string>())
  const [reconcileError, setReconcileError] = useState('')
  const lifetime = useRef(new AbortController())
  useEffect(() => {
    lifetime.current = new AbortController(); watched.current.clear(); watching.current.clear(); setReconcileError('')
    return () => lifetime.current.abort()
  }, [access, sessionId, status?.enabled, status?.identity?.accountId, status?.identity?.contestId])
  useEffect(() => {
    if (!status?.enabled || status.phase !== 'connected') return
    // Bounded read-only follow-up. Unknown/partial/terminal outcomes always stop automatic polling.
    for (const plan of status.plans) {
      if (!['queued', 'submitted'].includes(plan.status) || watching.current.has(plan.id) || (watched.current.get(plan.id) ?? 0) >= 10) continue
      watching.current.add(plan.id); watched.current.set(plan.id, (watched.current.get(plan.id) ?? 0) + 1)
      const signal = lifetime.current.signal
      void waitForCompetition(() => access.reconcile(plan), '回执查询', 30_000, signal).catch(error => {
        if (!signal.aborted) { watched.current.set(plan.id, 10); setReconcileError(error instanceof Error ? error.message : '回执查询失败，请打开计划只读核对。') }
      }).finally(() => { if (!signal.aborted) watching.current.delete(plan.id) })
    }
  }, [status, access])
  return { ...state, error: state.error || reconcileError }
}

export const contestPhases = { off: '已关闭', disconnected: '未连接', installing: '准备中', authenticating: '等待官网授权', connected: '已连接', error: '需要处理' }
export const planStates: Record<ContestPlan['status'], string> = {
  prepared: '待确认', executing: '正在提交', queued: '已排队 · 尚未成交', submitted: '已提交 · 等待回报',
  completed: '操作已完成 · 成交以柜台记录为准', partial: '部分完成 · 请核对委托', failed: '操作失败', expired: '已过期', unknown: '回执待核实 · 请勿重发', cancelled: '已取消计划',
}
export function asRecord(value: unknown): Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
export function display(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString('zh-CN', { maximumFractionDigits: 4 }) : '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
export function contestTime(time: number): string { return new Date(time).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) }
