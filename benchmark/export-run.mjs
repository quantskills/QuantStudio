// Publish synthetic measurements only; never copy a Host home or native logs.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'

const option = name => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1] }
if (!option('--source') || !option('--out') || !option('--reports')) throw new Error('Explicit --source, --out and --reports required')
const source = resolve(option('--source')), out = resolve(option('--out'))
const reports = option('--reports').split(',')
if (reports.some(name => basename(name) !== name || !/^[a-z0-9-]+\.json$/.test(name))) throw new Error('Invalid report filenames')
// A publication is immutable. A corrected export needs a new directory.
await mkdir(out)
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const pick = (value, keys) => Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key, value[key]]))
const paths = new Map(), files = []
const scrub = value => {
  if (typeof value === 'string') return value.replace(/(?:[A-Za-z]:[\\/]|\/(?:Users|home|tmp|private|var|mnt)\/)[^\s"'<>`|]+/g, path => {
    const id = '[local-path:' + hash(path).slice(0, 12) + ']'; paths.set(id, hash(path)); return id
  })
  if (Array.isArray(value)) return value.map(scrub)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, scrub(child)]))
  return value
}
const callKeys = ['id','tag','state','inputByteBound','maxOutput','inputRate','outputRate','reserveCny','startedAt',
  'inputTokens','outputTokens','cachedInputTokens','reasoningTokens','costCny','elapsedMs','firstVisibleMs','requestHash','failure']
async function publish(name, transform) {
  const original = await readFile(join(source, name)), value = JSON.parse(original)
  const published = scrub(transform(value)), bytes = JSON.stringify(published, null, 2) + '\n'
  await writeFile(join(out, name), bytes, { flag: 'wx' })
  files.push({ name, originalSha256: hash(original), publishedSha256: hash(bytes) })
  return published
}
const ledger = await publish('budget.json', value => ({
  ...pick(value, ['schema','limitCny','priorCny','stageLimitCny','halted','exhausted']), calls: value.calls.map(call => pick(call, callKeys)),
}))
const summary = []
for (const name of reports) {
  const report = await publish(name, value => ({
    ...pick(value, ['schema','kind','createdAt','completedAt','corpusHash','sourceHashes','candidateCommit','configurationHash',
      'suite','fixtureIds','officialPolicy','limitations','pricing','cumulativeCostUpperCny','plannedRuns','notExecuted','stopReason']),
    results: value.results.map(result => ({
      ...pick(result, ['id','family','repetition','arm','tag','runtime','runtimeIdentity','skillDefinitions','toolCount','promptHash',
        'resume','passed','failure','completedPhases','totalWallMs','inputTokens','outputTokens','costCny']),
      phases: result.phases.map(phase => pick(phase, ['stage','expected','actual','finalOutput','passed','elapsedMs','sessions',
        'artifactHash','artifactPassed','childCount','sameMembers','quietMs','errors','agents','roster','tasks'])),
      calls: result.calls.map(call => pick(call, callKeys)),
      telemetry: (result.telemetry ?? []).map(call => pick(call, ['id','tag','status','resolvedModel','requestHash','nativeRequestHash',
        'inputBytes','toolSchemaBytes','toolNames','startedAt','elapsedMs','firstVisibleMs','failure','reservationId'])),
    })),
  }))
  for (const result of report.results) {
    const calls = ledger.calls.filter(call => call.tag === result.tag)
    assert.deepEqual(result.calls, calls)
    for (const key of ['inputTokens','outputTokens']) assert.equal(result[key], calls.reduce((sum, call) => sum + (call[key] ?? 0), 0))
    assert.ok(Math.abs(result.costCny - calls.reduce((sum, call) => sum + (call.costCny ?? call.reserveCny), 0)) < 1e-9)
  }
  summary.push({ name, commit: report.candidateCommit, suite: report.suite, attempted: report.results.length,
    passed: report.results.filter(result => result.passed).length,
    calls: report.results.reduce((sum, result) => sum + result.calls.length, 0),
    costUpperCny: report.results.reduce((sum, result) => sum + result.costCny, 0) })
}
await writeFile(join(out, 'publication-manifest.json'), JSON.stringify({ schema: 1,
  policy: 'Whitelisted synthetic results, original scoring and usage retained; no credentials, user sessions or native reasoning logs.',
  files, pathMapping: Object.fromEntries(paths), summary,
  cumulativeCostUpperCny: ledger.priorCny + ledger.calls.reduce((sum, call) => sum + (call.costCny ?? call.reserveCny), 0),
}, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify({ reports: summary, redactedPaths: paths.size }))
