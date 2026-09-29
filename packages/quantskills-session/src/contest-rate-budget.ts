import { ContestCliError } from './contest-cli.ts'

export type ContestRequestBucket = 'query' | 'trade'
export type ContestRequestHistory = Record<ContestRequestBucket, number[]>
export const CONTEST_REQUEST_LIMITS = { query: 60, trade: 10 } as const
export const CONTEST_REQUEST_WINDOW_MS = 60_000
export class ContestQuotaError extends ContestCliError {
  readonly local = true
  constructor(readonly bucket: ContestRequestBucket, seconds: number) {
    super('rate_limit_exceeded', `本地${bucket === 'trade' ? '交易' : '查询'}请求已达到 ${CONTEST_REQUEST_LIMITS[bucket]} 次/分钟；${seconds} 秒后重试，本次未发送至柜台。`, seconds)
  }
}

/** Count HTTP calls made by the CLI commands QS uses, not just user clicks.
 * doctor performs both account and mandate reads; dry-run POST /orders is
 * conservatively charged to the trading bucket, just like plan create/execute.
 * Public metadata/install/update and local logout do not use either quota.
 */
export function contestRequestCost(args: readonly string[]): { bucket: ContestRequestBucket; count: number } | undefined {
  const [command, action] = args
  if (['login', 'logout', 'skill', 'update', 'agent', '--version'].includes(command ?? '')) return
  if (command === 'plan') return { bucket: ['create', 'execute'].includes(action ?? '') ? 'trade' : 'query', count: 1 }
  if (command === 'order') return { bucket: 'trade', count: 1 }
  if (['cancel', 'cancel-all', 'close-all', 'rollover', 'target-position'].includes(command ?? '')) {
    // QS currently uses frozen plans instead; these CLI helpers may preflight.
    return { bucket: 'trade', count: args.includes('--dry-run') ? 1 : 3 }
  }
  return { bucket: 'query', count: command === 'doctor' ? 2 : 1 }
}

export function reserveContestRequests(history: ContestRequestHistory, args: readonly string[], now = Date.now()) {
  const cost = contestRequestCost(args)
  if (!cost) return
  for (const bucket of ['query', 'trade'] as const) history[bucket] = history[bucket].filter(at => at > now - CONTEST_REQUEST_WINDOW_MS)
  const events = history[cost.bucket], limit = CONTEST_REQUEST_LIMITS[cost.bucket]
  if (events.length + cost.count > limit) {
    const next = [...events].sort((a, b) => a - b)[events.length + cost.count - limit - 1]!
    const seconds = Math.max(1, Math.ceil((next + CONTEST_REQUEST_WINDOW_MS - now) / 1000))
    throw new ContestQuotaError(cost.bucket, seconds)
  }
  events.push(...Array<number>(cost.count).fill(now))
}
