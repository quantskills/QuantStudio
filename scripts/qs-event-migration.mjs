/** QS-owned metadata has no event-sequence references. Preserve it across the frozen upstream vocabulary. */
import { createHash } from 'node:crypto'
import { KNOWN_SESSION_EVENT_TYPES } from '@deepseek-ai/dsh-session'

// Frozen QS 0.1.36 payload fields. Unknown future fields/types require a reviewed converter.
const fields = new Map(Object.entries({
  'quantskills/plain-session': ['purpose', 'contest', 'factorContest', 'contestConversation'],
  'quantskills/session-bound': ['assetId', 'versionId', 'commit', 'treeDigest'],
  'quantskills/agent-session': ['agentId', 'revision', 'name', 'role', 'mode', 'permission', 'skills', 'createdAt', 'updatedAt', 'sourceVersionId'],
  'quantskills/agent-team-session': ['teamId', 'revision', 'name', 'description', 'lead', 'leadModel', 'members', 'createdAt', 'updatedAt', 'sourceVersionId'],
  'quantskills/agent-team-member': ['teamId', 'teamRevision', 'memberName', 'agent', 'model'],
  'quantskills/resident-skill-changed': ['operation', 'binding', 'changedAt'],
  'quantskills/file-attached': ['file', 'parsing', 'attachedAt'],
  'panda/runtime-bound': ['environmentId', 'sdkVersion', 'pythonVersion', 'apiFingerprint'],
  'quantskills/authoring-started': ['kind'],
  'quantskills/authoring-committed': ['toolCallId', 'treeDigest', 'result'],
}))
for (const type of fields.keys()) KNOWN_SESSION_EVENT_TYPES.add(type)
const prefix = 'QS_OFFLINE_METADATA_V1:'
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

/** Temporary log-only envelopes allow the upstream chain to remap sequence coordinates; no temporary row is saved. */
export function prepareQSEvents(rows) {
  const originals = new Map()
  const migrationRows = rows.map((row, index) => {
    if (row.type === 'feedback/record' && row.data?.text?.startsWith(prefix)) throw new Error('Reserved migration marker collision.')
    if (index === 0 || !fields.has(row.type)) return row
    if (!Number.isSafeInteger(row.seq) || row.seq < 0
      || Object.keys(row).some(key => !['type', 'seq', 'time', 'data', 'ignorable'].includes(key))
      || !row.data || typeof row.data !== 'object' || Array.isArray(row.data)
      || Object.keys(row.data).some(key => !fields.get(row.type).includes(key))) throw new Error(`Unsupported QS metadata shape: ${row.type}`)
    const marker = prefix + hash([rows[0].id, row])
    if (originals.has(marker)) throw new Error('Duplicate QS migration identity.')
    originals.set(marker, structuredClone(row))
    return { ...row, type: 'feedback/record', data: { text: marker } }
  })
  return { migrationRows, originals }
}

export function restoreQSEvents(artifact, originals) {
  const restored = new Set(), mappings = []
  const events = artifact.events.map(event => {
    if (event.type !== 'feedback/record' || !originals.has(event.data?.text)) return event
    const marker = event.data.text, original = originals.get(marker)
    if (restored.has(marker) || event.time !== original.time) throw new Error('QS metadata identity changed during migration.')
    restored.add(marker)
    mappings.push({ type: original.type, sourceSeq: original.seq, targetSeq: event.seq, payloadHash: hash(original.data) })
    return { ...event, type: original.type, data: structuredClone(original.data) }
  })
  if (restored.size !== originals.size) throw new Error('QS metadata disappeared during migration.')
  return { artifact: { ...artifact, events }, originals: [...originals.values()], mappings }
}
