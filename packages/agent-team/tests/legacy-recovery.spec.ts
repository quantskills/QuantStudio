import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { classifyLegacyMessages, type LegacyTeamRecord, type ReceiverEvidence } from '../src/legacy-mailbox.ts'
import { LegacyTeamRecovery } from '../src/legacy-recovery.ts'

const roots: string[] = []
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })
const queued: LegacyTeamRecord = { type: 'team/message/queued', data: { version: 1, teamId: 'lead',
  message: { id: 'old-message', senderId: 'lead', senderName: 'Lead', targetId: 'child', content: [{ type: 'text', text: 'Continue analysis' }] } } }
const accepted = { teamId: 'lead', messageId: 'old-message', senderId: 'lead' }
const receipt: LegacyTeamRecord = { type: 'team/message/delivered', data: { version: 1, teamId: 'lead', messageId: 'old-message', targetId: 'child' } }
const evidence = (complete = true, values: typeof accepted[] = []): ReceiverEvidence => ({ complete, accepted: values })
const classify = (events: LegacyTeamRecord[], receiver: ReceiverEvidence) => classifyLegacyMessages(events, new Map([['child', receiver]])).messages[0]!.status

describe('legacy message classification', () => {
  it('does not resend receipts or accepted messages, even without a receipt', () => {
    expect(classify([queued, receipt], evidence(false))).toBe('delivered')
    expect(classify([queued], evidence(false, [accepted]))).toBe('delivered')
  })
  it('requires complete negative history before permitting recovery', () => {
    expect(classify([queued], evidence())).toBe('pending-recovery')
    expect(classify([queued], evidence(false))).toBe('needs-confirmation')
  })
  it('retains contradictions and unknown history without silent completion', () => {
    expect(classify([queued, receipt], evidence(true, [{ ...accepted, senderId: 'other' }]))).toBe('needs-confirmation')
    expect(classify([queued, { ...receipt, data: { ...(receipt.data as object), targetId: 'wrong' } }], evidence())).toBe('needs-confirmation')
    const unknown = { type: 'team/future', data: { version: 99, original: 'retain me' } }
    expect(classifyLegacyMessages([unknown], new Map()).unknown).toEqual([unknown])
    expect(classify([queued, queued], evidence())).toBe('needs-confirmation')
  })
  it('reads the historical events after the official v4 conversion to payload version 2', () => {
    expect(classify([{ ...queued, data: { ...(queued.data as object), version: 2 } }], evidence())).toBe('pending-recovery')
  })
})

describe('durable continuation boundary', () => {
  async function setup() {
    const root = await mkdtemp(join(tmpdir(), 'qs-team-recovery-')); roots.push(root)
    const recovery = new LegacyTeamRecovery(root)
    let receiver = evidence()
    const deliver = vi.fn(async () => { receiver = evidence(true, [accepted]) })
    const port = { evidence: async () => receiver, deliver }
    const path = join(root, `${createHash('sha256').update('lead').digest('hex')}.json`)
    return { root, recovery, port, path, set: (value: ReceiverEvidence) => { receiver = value } }
  }
  it('requires user continuation and retains stable IDs across repeated recovery', async () => {
    const { recovery, port } = await setup()
    await expect(recovery.continue('lead', [queued], port, { userContinued: false } as never)).rejects.toThrow(/explicit/)
    expect(port.deliver).not.toHaveBeenCalled()
    const first = await recovery.continue('lead', [queued], port, { userContinued: true })
    const second = await recovery.continue('lead', [queued], port, { userContinued: true })
    expect(first).toEqual(second)
    expect(first.messages[0]).toMatchObject({ messageId: 'old-message', senderId: 'lead', targetId: 'child', status: 'delivered' })
    expect(port.deliver).toHaveBeenCalledOnce()
  })
  it('reconciles receiver acceptance when the transport loses its receipt', async () => {
    const { recovery, port, set } = await setup()
    port.deliver.mockImplementationOnce(async () => { set(evidence(true, [accepted])); throw new Error('receipt not written') })
    expect((await recovery.continue('lead', [queued], port, { userContinued: true })).messages[0]!.status).toBe('delivered')
    await recovery.continue('lead', [queued], port, { userContinued: true })
    expect(port.deliver).toHaveBeenCalledOnce()
  })
  it('never retries an interrupted attempt on absence alone', async () => {
    const { recovery, port, path, set } = await setup()
    port.deliver.mockImplementationOnce(async () => { throw new Error('lost result') })
    await recovery.continue('lead', [queued], port, { userContinued: true })
    const journal = JSON.parse(await readFile(path, 'utf8'))
    journal.messages[0].status = 'pending-recovery'; journal.messages[0].attempt = 'started'
    await writeFile(path, JSON.stringify(journal))
    const result = await recovery.continue('lead', [queued], port, { userContinued: true })
    expect(result.messages[0]!.status).toBe('needs-confirmation')
    expect(port.deliver).toHaveBeenCalledOnce()
    set(evidence(true, [accepted]))
    expect((await recovery.continue('lead', [queued], port, { userContinued: true })).messages[0]!.status).toBe('delivered')
    expect(port.deliver).toHaveBeenCalledOnce()
  })
  it('serializes owners, fails closed on interrupted locks, and preserves journal data', async () => {
    const { recovery, root, port, path } = await setup()
    await writeFile(`${path}.lock`, 'owner not yet verified stopped')
    await expect(recovery.continue('lead', [queued], port, { userContinued: true })).rejects.toMatchObject({ code: 'EEXIST' })
    expect(port.deliver).not.toHaveBeenCalled()
    expect(await readFile(`${path}.lock`, 'utf8')).toContain('not yet verified')
  })
})
