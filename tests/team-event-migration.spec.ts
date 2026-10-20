import { describe, expect, it } from 'vitest'
import { migrateTeamEvents } from '../scripts/team-event-migration.mjs'

const events = [
  { seq: 0, type: 'team/member', data: { version: 1, teamId: 'lead', member: {
    id: 'child', name: 'researcher', description: '', provider: 'spawn', context: 'fresh', phase: 'provisioning' } } },
  { seq: 1, type: 'team/member', data: { version: 1, teamId: 'lead', member: {
    id: 'child', name: 'researcher', description: '', provider: 'spawn', context: 'fresh', phase: 'active' } } },
  { seq: 2, type: 'team/task', data: { version: 1, teamId: 'lead', task: {
    id: 'task-1', revision: 1, subject: 'research', description: '', status: 'pending', blockedBy: [], writeScopes: [] } } },
  { seq: 3, type: 'team/message/queued', data: { version: 1, teamId: 'lead', message: {
    id: 'message-1', senderId: 'lead', senderName: 'lead', targetId: 'child', delivery: 'quiet', content: [{ type: 'text', text: 'research' }] } } },
  { seq: 4, type: 'team/message/delivered', data: { version: 1, teamId: 'lead', messageId: 'message-1', targetId: 'child' } },
]
describe('offline Team format migration', () => {
  it('preserves roster/task/message identities and validates against the actual target projection', () => {
    const input = structuredClone(events)
    const result = migrateTeamEvents({ id: 'lead' }, input)
    expect(result.originals).toEqual(events)
    expect(input).toEqual(events)
    expect(result.mappings).toHaveLength(5)
    expect(result.events[3].data.message).not.toHaveProperty('delivery')
    expect(result.events[3].data.message.id).toBe('message-1')
    expect(result.events[4].data).toMatchObject({ version: 2, messageId: 'message-1', targetId: 'child' })
    expect(migrateTeamEvents({ id: 'lead' }, result.events).mappings).toEqual([])
  })
  it('retains unknown events and fails closed on unknown versions or invalid graph transitions', () => {
    const unknown = { seq: 5, type: 'team/future', data: { value: 'retained verbatim' } }
    expect(migrateTeamEvents({ id: 'lead' }, [unknown])).toMatchObject({ events: [unknown], originals: [unknown], unknown: [unknown] })
    expect(() => migrateTeamEvents({ id: 'lead' }, [{ ...events[0], data: { ...events[0].data, version: 9 } }])).toThrow(/Unsupported/)
    const task = structuredClone(events[2]) as any
    task.data.task.blockedBy = ['task-1']
    expect(() => migrateTeamEvents({ id: 'lead' }, [task])).toThrow(/validation/)
  })
})
