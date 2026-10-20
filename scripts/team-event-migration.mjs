/** Offline v1 → v2 Team conversion; retain exact source records and stable IDs. */
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readFile } from 'node:fs/promises'
const require = createRequire(import.meta.url)
const manifestFile = require.resolve('@deepseek-ai/dsh-experimental-agent-team/package.json')
if (JSON.parse(await readFile(manifestFile, 'utf8')).version !== '0.2.1-rc.2') throw new Error('Team converter requires the audited runtime')
// Exact-version offline reader, not a second runtime service or a browser dependency.
const { teamProjectionDefinition } = await import(pathToFileURL(join(dirname(manifestFile), 'lib/types/projection.js')).href)
const known = new Set(['team/member', 'team/task', 'team/message/queued', 'team/message/delivered'])

export function migrateTeamEvents(header, events) {
  const originals = [], mappings = [], unknown = []
  let state = teamProjectionDefinition.init(header)
  const converted = events.map(event => {
    if (!event.type.startsWith('team/')) return event
    originals.push(event)
    if (!known.has(event.type)) { unknown.push(event); return event }
    if (![1, 2].includes(event.data?.version)) throw new Error(`Unsupported historical Team version: ${event.type}`)
    let current = event
    if (event.data.version === 1) {
      const data = { ...event.data, version: 2 }
      if (event.type === 'team/message/queued') {
        if (!['quiet', 'wakeup'].includes(data.message?.delivery)) throw new Error('Unknown historical Team delivery mode')
        const { delivery, ...message } = data.message
        data.message = message
      }
      current = { ...event, data }
      mappings.push({ seq: event.seq, type: event.type, teamId: data.teamId,
        memberId: data.member?.id, taskId: data.task?.id, messageId: data.message?.id ?? data.messageId,
        sourceVersion: 1, targetVersion: 2 })
    }
    state = teamProjectionDefinition.apply(state, current)
    if (state.failure) throw new Error(`Team conversion failed validation: ${state.failure}`)
    return current
  })
  return { events: converted, originals, mappings, unknown }
}
