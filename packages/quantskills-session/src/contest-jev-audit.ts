/** Usage returned by the API, independent of the provider's billing dashboard. No request bodies or keys are stored. */
import { createHash, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { z } from 'zod'
import type { ContestJevRequest, ContestJevUsage } from './contest-watch-types.ts'

export const jevUsageSchema = z.object({ input_tokens: z.number().int().nonnegative().safe(), output_tokens: z.number().int().nonnegative().safe() })
const queues = new Map<string, Promise<void>>()
const empty = (): ContestJevUsage => ({ since: Date.now(), requests: 0, responsesOk: 0, unknownUsage: 0, inputTokens: 0, outputTokens: 0, records: [] })
async function read(root: string): Promise<ContestJevUsage> {
  try { return JSON.parse(await readFile(join(root, 'jev-requests.json'), 'utf8')) as ContestJevUsage }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return empty(); throw new Error('Jev 调用记录无法读取。') }
}
export async function jevUsage(root: string): Promise<ContestJevUsage> {
  await queues.get(root)
  return read(root)
}
async function append(root: string, entry: ContestJevRequest) {
  const writing = (queues.get(root) ?? Promise.resolve()).catch(() => {}).then(async () => {
    const usage = await read(root)
    usage.since = Math.min(usage.since, entry.startedAt)
    usage.requests++; if (entry.httpStatus && entry.httpStatus >= 200 && entry.httpStatus < 300) usage.responsesOk++
    if (entry.usage) { usage.inputTokens += entry.usage.input_tokens; usage.outputTokens += entry.usage.output_tokens }
    else usage.unknownUsage++
    usage.records = [...usage.records, entry].sort((a, b) => a.startedAt - b.startedAt).slice(-200)
    await writeFileAtomic(join(root, 'jev-requests.json'), JSON.stringify(usage), { mode: 0o600, dirMode: 0o700 })
  })
  queues.set(root, writing)
  try { await writing } finally { if (queues.get(root) === writing) queues.delete(root) }
}
export function auditedJevFetch(root: string, purpose: ContestJevRequest['purpose'], request: typeof fetch = fetch): typeof fetch {
  return async (url, init) => {
    const key = new Headers(init?.headers).get('Authorization')?.replace(/^Bearer /, '') ?? ''
    const entry: ContestJevRequest = { id: randomUUID(), purpose, startedAt: Date.now(), finishedAt: Date.now(),
      keyFingerprint: createHash('sha256').update(key).digest('hex').slice(0, 12) }
    try {
      const response = await request(url, init)
      entry.httpStatus = response.status
      try {
        const body = await response.clone().json() as { model?: unknown; usage?: unknown }
        if (typeof body.model === 'string' && /^[a-zA-Z0-9._-]{1,80}$/.test(body.model) && body.model !== key) entry.model = body.model
        const usage = jevUsageSchema.safeParse(body.usage)
        if (response.ok && usage.success) entry.usage = usage.data
      } catch { /* Missing or invalid usage is unknown, never zero. */ }
      return response
    } finally {
      entry.finishedAt = Date.now()
      await append(root, entry)
    }
  }
}
