import { describe, expect, it } from 'vitest'
import { prepareQSEvents, restoreQSEvents } from '../scripts/qs-event-migration.mjs'
import { restoreRows } from '../scripts/session-migration.mjs'
import { historicalSessionFormatCatalog, createSessionFormatCatalogWithChildren } from '@deepseek-ai/dsh-session-format-catalog'

const header = { type: 'session', version: 0, id: 'qs-copy', createdAt: 1, delegationDepth: 0 }
const metadata = { type: 'quantskills/plain-session', seq: 0, time: 2, data: { purpose: 'chat' } }

describe('audited QS extension migration', () => {
  it('preserves required application metadata through the native chain without persisting temporary envelopes', () => {
    const original = [header, metadata]
    const prepared = prepareQSEvents(original)
    const target = restoreRows(prepared.migrationRows, createSessionFormatCatalogWithChildren([]))
    const result = restoreQSEvents(target, prepared.originals)
    expect(result.artifact.events).toEqual([metadata])
    expect(result.originals).toEqual([metadata])
    expect(result.mappings).toEqual([expect.objectContaining({ type: metadata.type, sourceSeq: 0, targetSeq: 0 })])
    expect(original).toEqual([header, metadata])
    expect(() => restoreQSEvents({ ...target, events: [] }, prepared.originals)).toThrow(/disappeared/)
    expect(() => restoreQSEvents({ ...target, events: [...target.events, ...target.events] }, prepared.originals)).toThrow(/identity/)
  })

  it('does not admit future extension fields, surface mutations, sequence-bearing envelopes or unknown required types', () => {
    for (const changed of [
      { ...metadata, sourceEventSeqs: [0] },
      { ...metadata, data: { ...metadata.data, futureField: true } },
      { ...metadata, surfaceOp: 'append' },
    ]) expect(() => prepareQSEvents([header, changed])).toThrow(/shape/)
    const unknown = prepareQSEvents([header, { ...metadata, type: 'quantskills/future' }])
    expect(() => restoreRows(unknown.migrationRows, historicalSessionFormatCatalog)).toThrow(/unknown historical/)
  })

  it('keeps packed physical rows unchanged across independent native decoding passes', () => {
    const rows = [header,
      { type: 'turn/start', seq: 0, time: 2, data: { turn: 1 } },
      { type: 'step/start', seq: 1, time: 3, data: { turn: 1, step: 1 } },
      { type: 'text-chunks', seq0: 2, time0: 4, data: { turn: 1, step: 1, index: 0, dt: [1], texts: ['first', 'second'] } },
      { ...metadata, seq: 4, time: 6 },
    ]
    const prepared = prepareQSEvents(rows), original = structuredClone(prepared.migrationRows)
    const first = restoreRows(prepared.migrationRows, historicalSessionFormatCatalog)
    expect(prepared.migrationRows).toEqual(original)
    expect(restoreRows(prepared.migrationRows, historicalSessionFormatCatalog)).toEqual(first)
    const result = restoreQSEvents(restoreRows(prepared.migrationRows, createSessionFormatCatalogWithChildren([])), prepared.originals)
    expect(result.artifact.events.filter(event => event.type === metadata.type)).toHaveLength(1)
    expect(result.artifact.events.find(event => event.type === metadata.type)?.data).toEqual(metadata.data)
  })
})
