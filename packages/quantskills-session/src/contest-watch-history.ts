import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-panda-mcp'
import { z } from 'zod'
import { normalizeWatchBars } from './contest-watch-evidence.ts'
import { contestContractParts } from './contest-contract.ts'
import type { ContestWatchConfig, ContestWatchDataset, ContestWatchHistory } from './contest-watch-types.ts'

/** Classify without exposing raw provider messages, URLs or credentials. */
export function historyFailure(error: unknown, stage: string) {
  const value = error as { message?: string; code?: string; status?: number; name?: string }
  const text = `${value?.code ?? ''} ${value?.status ?? ''} ${value?.name ?? ''} ${value?.message ?? ''}`
  const [code, retryable, help] = /401|403|unauthori|forbidden|登录|权限|认证|token.*expir/i.test(text) ? ['AUTH_REQUIRED', false, '请检查 PandaData 登录与数据权限。'] as const
    : /timeout|timed?out|ETIMEDOUT|超时/i.test(text) ? ['TIMEOUT', true, '数据源响应超时，将自动重试。'] as const
    : /429|rate.limit|频率|限流/i.test(text) ? ['RATE_LIMIT', true, '数据源限流，将稍后重试。'] as const
    : /network|fetch failed|ECONN|ENOTFOUND|offline|网络|连接失败/i.test(text) ? ['NETWORK', true, '网络或数据源暂时不可用，将自动重试。'] as const
    : /column|preview|truncat|table|malformed|字段|列|表格|截断/i.test(text) ? ['INVALID_DATA', false, '请检查数据源返回内容与列映射。'] as const
    : ['READ_FAILED', true, '原因未明确，将自动重试；请在数据库页检查该数据源。'] as const
  return { issue: `历史数据读取失败（${stage}/${code}）；${help}`, diagnostic: { stage, code, retryable } }
}

export async function watchDatasets(ctx: Context): Promise<ContestWatchDataset[]> {
  const gateway = ctx.get('pandaMcp')
  if (!gateway) return []
  return (await gateway.databaseList()).filter(item => item.kind === 'timeseries' && item.category === 'market')
    .map(item => ({ id: item.id, name: item.name, columns: item.columns, rows: item.rowCount, source: item.source.kind }))
}
export async function prepareWatchHistory(ctx: Context, input: { symbol: string; barSeconds: number }, signal?: AbortSignal): Promise<NonNullable<ContestWatchConfig['history']>> {
  const parsed = z.object({ symbol: z.string().trim().toUpperCase().refine(value => Boolean(contestContractParts(value)?.[2])), barSeconds: z.union([z.literal(60), z.literal(300)]) }).strict().safeParse(input)
  if (!parsed.success) throw new Error('请填写 PandaData 实际合约代码（如 RB2610.SHF），周期为 1 或 5 分钟。')
  const gateway = ctx.get('pandaMcp')
  if (!gateway) throw new Error('PandaData 服务不可用，请在设置中连接。')
  const day = (time: number) => new Date(time + 8 * 3600000).toISOString().slice(0, 10).replaceAll('-', '')
  try {
    const columns = { time: 'datetime', symbol: 'symbol', open: 'open', high: 'high', low: 'low', close: 'close' }
    const existing = (await gateway.databaseList(signal)).find(item => item.kind === 'timeseries' && item.category === 'market' && item.source.kind === 'pandadata'
      && item.source.method === 'get_future_min' && item.source.rollingDay === true && item.source.params?.symbol === parsed.data.symbol
      && item.source.params?.frequency === (parsed.data.barSeconds === 60 ? '1m' : '5m') && Object.values(columns).every(column => item.columns.includes(column)))
    const dataset = existing ?? await gateway.databaseFetch({ name: `Jev ${parsed.data.symbol} ${parsed.data.barSeconds / 60}m`, kind: 'timeseries', category: 'market', dateColumn: 'datetime', ttlSeconds: 60,
      source: { kind: 'pandadata', method: 'get_future_min', rollingDay: true, params: { symbol: parsed.data.symbol, start_date: day(Date.now()), end_date: day(Date.now() + 3 * 86400000), frequency: parsed.data.barSeconds === 60 ? '1m' : '5m', fields: ['symbol', 'trading_code', 'datetime', 'open', 'high', 'low', 'close', 'volume'] } } }, signal)
    signal?.throwIfAborted()
    return { datasetId: dataset.id, barSeconds: parsed.data.barSeconds, timeMeaning: 'close', refresh: true, columns }
  } catch (error) { signal?.throwIfAborted(); throw new Error(`PandaData：${historyFailure(error, 'prepare').issue}`) }
}
export async function watchHistory(ctx: Context, config: ContestWatchConfig, signal: AbortSignal): Promise<ContestWatchHistory> {
  const source = config.history
  if (!source) return { source: '未选择历史数据集', bars: [], barSeconds: 60, issue: '未配置历史 K 线；报价快照不能替代完整 K 线。' }
  const empty = { source: source.datasetId, bars: [], barSeconds: source.barSeconds }
  let stage = 'catalog'
  try {
    const gateway = ctx.get('pandaMcp')
    if (!gateway) return { ...empty, issue: '数据库服务不可用。' }
    const datasets = await gateway.databaseList(signal), dataset = datasets.find(item => item.id === source.datasetId)
    if (!dataset || dataset.kind !== 'timeseries' || dataset.category !== 'market') return { ...empty, issue: '所选行情数据集不存在或不是行情时间序列。' }
    if (dataset.source.kind === 'pandadata' && dataset.source.method === 'get_future_min'
      && dataset.source.params?.frequency !== (source.barSeconds === 60 ? '1m' : '5m')) return { ...empty, issue: '所选周期与 PandaData 数据源不一致，请重新创建对应周期的数据源。' }
    if (!Object.values(source.columns).every(column => dataset.columns.includes(column))) return { ...empty, issue: '数据列已变化，请重新核对列映射。' }
    // Get all relevant rows (up to a bounded 5000) so source ordering cannot hide the newest bar.
    const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
    stage = 'query'
    const result = await gateway.databaseQuery({ id: source.datasetId, limit: 5000, refresh: source.refresh,
      ...(dataset.source.kind === 'pandadata' && dataset.source.method === 'get_future_min' ? { to: today } : {}) }, signal)
    signal.throwIfAborted()
    if (result.status === 'insufficient') return { ...empty, issue: '历史缓存过期或覆盖不足；请在数据库页刷新，或允许刷新所选数据源。' }
    if (result.total > 5000) return { ...empty, issue: '历史数据集超过 5000 行，请配置仅包含近期目标合约的分钟数据集。' }
    let bars: ContestWatchHistory['bars']
    // PandaData automatic minute bars are close-labelled (09:01, 10:15, 10:31, 11:30, 13:31).
    // Correct saved automatic configurations too; explicit mappings of manual sources remain intact.
    const mapping = config.autoHistory && dataset.source.kind === 'pandadata' && dataset.source.method === 'get_future_min' ? { ...source, timeMeaning: 'close' as const } : source
    try { bars = normalizeWatchBars(result.rows, mapping, config.symbol).slice(-240) }
    catch (error) { return { ...empty, issue: error instanceof Error ? error.message : '历史 K 线校验失败。' } }
    return { source: `${result.dataset.name} (${result.dataset.id})`, fetchedAt: Date.parse(result.dataset.fetchedAt), barSeconds: source.barSeconds, bars }
  } catch (error) {
    signal.throwIfAborted()
    return { ...empty, ...historyFailure(error, stage) }
  }
}
