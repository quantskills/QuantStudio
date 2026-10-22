/** Offline audit only: reads a separate copy, reports aggregate evidence, never creates a Host. */
import { readdir, readFile, lstat, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { historicalSessionFormatCatalog, createSessionFormatCatalogWithChildren } from '@deepseek-ai/dsh-session-format-catalog'
import { historicalChildCatalogSource } from '@deepseek-ai/dsh-session-format-v3-to-v4'
import { restoreRows } from './session-migration.mjs'
import { decodeSessionFrames } from './session-zstd.mjs'
import { migrateTeamEvents } from './team-event-migration.mjs'
import { prepareQSEvents, restoreQSEvents } from './qs-event-migration.mjs'

export async function auditSessionCopy(directory) {
  const records = [], errors = new Map(), diagnostics = new Map(), hashes = [], rawEvents = new Map()
  let bytes = 0, eventCount = 0, historicalPassed = 0, targetPassed = 0
  const reason = error => {
    const type = /unknown historical event type "([a-zA-Z0-9/-]+)"/.exec(error.message)?.[1]
    if (type) return `unsupported-extension:${type}`
    if (/historical child identity/.test(error.message)) return 'missing-child-evidence'
    if (/inheritedEventCount exceeds/.test(error.message)) return 'incomplete-inherited-events'
    return error.name === 'SessionFormatUnsupportedMigrationError' ? 'unsupported-format-transition' : 'invalid-artifact'
  }
  const fail = error => {
    const code = reason(error); errors.set(code, (errors.get(code) ?? 0) + 1)
    // Private diagnostics stay out of the public aggregate and never contain record bodies.
    const detail = String(error.message).replace(/"[^"\n]*"/g, '"[value]"').replace(/\d+/g, '#')
    diagnostics.set(detail, (diagnostics.get(detail) ?? 0) + 1)
  }
  async function walk(dir) {
    if ((await lstat(dir)).isSymbolicLink()) throw new Error('Offline audit refuses links.')
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = join(dir, entry.name)
      if (entry.isSymbolicLink()) throw new Error('Offline audit refuses links.')
      if (entry.isDirectory()) { await walk(file); continue }
      if (!/\.jsonl(?:\.zstd)?$/.test(file)) continue
      const source = await readFile(file); bytes += source.length
      hashes.push(createHash('sha256').update(source).digest('hex'))
      try {
        const text = (file.endsWith('.zstd') ? decodeSessionFrames(source) : source).toString('utf8')
        if (!text.endsWith('\n')) throw new Error('Truncated history.')
        const rows = text.trimEnd().split(/\r?\n/).map(JSON.parse)
        eventCount += rows.length - 1
        for (const row of rows.slice(1)) if (typeof row.type === 'string') rawEvents.set(row.type, (rawEvents.get(row.type) ?? 0) + 1)
        const qs = prepareQSEvents(rows)
        records.push({ rows: qs.migrationRows, qs, historical: restoreRows(qs.migrationRows, historicalSessionFormatCatalog) }); historicalPassed++
      } catch (error) { fail(error) }
    }
  }
  await walk(resolve(directory))
  for (const item of records) {
    try {
      const children = records.filter(child => child.historical.header.parentSession === item.historical.header.id && child.historical.header.origin === 'subagent')
        .map(child => historicalChildCatalogSource(child.historical))
      const target = restoreRows(item.rows, createSessionFormatCatalogWithChildren(children))
      const restored = restoreQSEvents(target, item.qs.originals).artifact
      migrateTeamEvents(restored.header, restored.events); targetPassed++
    } catch (error) { fail(error) }
  }
  return { schemaVersion: 1, runtime: '0.2.1-rc.2', result: errors.size ? 'blocked' : 'passed', runnable: false,
    artifacts: hashes.length, compressedBytes: bytes, physicalRows: eventCount, historicalPassed, targetPassed,
    sourceSetHash: createHash('sha256').update(JSON.stringify(hashes.sort())).digest('hex'),
    failures: Object.fromEntries(errors), diagnostics: Object.fromEntries(diagnostics), eventTypes: Object.fromEntries([...rawEvents].sort()) }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2] || !process.argv[3]) throw new Error('Usage: node scripts/audit-session-copy.mjs OFFLINE_COPY AGGREGATE_REPORT')
  const report = await auditSessionCopy(process.argv[2])
  await writeFile(process.argv[3], JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
  console.log(JSON.stringify({ result: report.result, artifacts: report.artifacts, historicalPassed: report.historicalPassed,
    targetPassed: report.targetPassed, failures: report.failures, runnable: false }))
  if (report.result !== 'passed') process.exitCode = 2
}
