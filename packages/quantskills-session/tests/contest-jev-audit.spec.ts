import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { auditedJevFetch, jevUsage } from '../src/contest-jev-audit.ts'

const roots: string[] = []
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })
async function fixture() { const root = await mkdtemp(join(tmpdir(), 'jev-audit-')); roots.push(root); return root }
it('persists concurrent calls and real usage without retaining keys, prompts or account data', async () => {
  const root = await fixture()
  const request: typeof fetch = async () => Response.json({ model: 'jev-1.13.0', usage: { input_tokens: 382, output_tokens: 34 }, secret: 'private-response' })
  const fetcher = auditedJevFetch(root, 'connection-test', request)
  await Promise.all([1, 2, 3].map(() => fetcher('https://api.typesafe.ai/v1/systemone', { headers: { Authorization: 'Bearer private-key' }, body: 'private-account' })))
  expect(await jevUsage(root)).toMatchObject({ requests: 3, responsesOk: 3, unknownUsage: 0, inputTokens: 1146, outputTokens: 102 })
  const saved = await readFile(join(root, 'jev-requests.json'), 'utf8')
  expect(saved).not.toContain('private-')
  expect(JSON.parse(saved).records[0].keyFingerprint).toHaveLength(12)
})
it('keeps unknown usage distinct from zero for missing usage, HTTP errors and network failures', async () => {
  const root = await fixture()
  await auditedJevFetch(root, 'watch', async () => Response.json({ model: 'jev-1.13.0' }))('https://api.typesafe.ai/v1/systemone')
  await auditedJevFetch(root, 'research', async () => new Response('private-error', { status: 429 }))('https://api.typesafe.ai/v1/systemone')
  await expect(auditedJevFetch(root, 'watch', async () => { throw new Error('private-network-error') })('https://api.typesafe.ai/v1/systemone')).rejects.toThrow()
  expect(await jevUsage(root)).toMatchObject({ requests: 3, responsesOk: 1, unknownUsage: 3, inputTokens: 0, outputTokens: 0 })
  expect(await readFile(join(root, 'jev-requests.json'), 'utf8')).not.toContain('private-')
})
