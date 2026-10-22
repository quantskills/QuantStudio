import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Budget, validateBudgetLimits } from '../lib/budget.mjs'
const initial = { limitCny: 100, priorCny: 2.4527854000000002 }
const request = { tag: 'fixture', inputByteBound: 1000, maxOutput: 500, inputRate: 0.001, outputRate: 0.002 }
async function fixture() { return join(await mkdtemp(join(tmpdir(), 'qs-budget-')), 'ledger.json') }
test('persists reservation before request and settles all token classes once', async () => {
  const file = await fixture(), b = await Budget.open(file, initial), id = await b.reserve(request)
  assert.equal(JSON.parse(await readFile(file)).calls[0].state, 'reserved')
  await b.settle(id, { prompt_tokens: 700, completion_tokens: 100, prompt_tokens_details: { cached_tokens: 200 } })
  assert.equal(b.used(), initial.priorCny + 0.9)
  await assert.rejects(b.settle(id, { prompt_tokens: 1, completion_tokens: 1 }), /not pending/)
  await b.close()
})
test('concurrent children cannot overbook and budget survives reopening', async () => {
  const file = await fixture(), b = await Budget.open(file, initial)
  const results = await Promise.allSettled(Array.from({ length: 100 }, () => b.reserve(request)))
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 43)
  assert.ok(b.used() <= 90)
  await b.close()
  const resumed = await Budget.open(file, initial)
  await assert.rejects(resumed.reserve(request), /halted/)
  await resumed.close()
})
test('unknown usage retains money and disables future calls', async () => {
  const file = await fixture(), b = await Budget.open(file, initial), id = await b.reserve(request)
  await assert.rejects(b.settle(id, undefined), /usage missing/)
  assert.equal(b.used(), initial.priorCny + 2)
  await assert.rejects(b.reserve(request), /halted/)
  await b.close()
})
test('another gateway cannot acquire the ledger and invalid usage cannot pass', async () => {
  const file = await fixture(), b = await Budget.open(file, initial)
  await assert.rejects(Budget.open(file, initial), { code: 'EEXIST' })
  const id = await b.reserve(request)
  await assert.rejects(b.settle(id, { prompt_tokens: -1, completion_tokens: 1 }), /usage missing/)
  await b.close()
})

test('a new stage carries historical spend forward and cannot reset its additional limit', async () => {
  const file=await fixture(), initialStage={limitCny:100,priorCny:59.9298464,stageLimitCny:25}
  const b=await Budget.open(file,initialStage)
  const attempts=await Promise.allSettled(Array.from({length:20},()=>b.reserve(request)))
  assert.equal(attempts.filter(a=>a.status==='fulfilled').length,12)
  assert.ok(b.used()<=initialStage.priorCny+25)
  await b.close()
  await assert.rejects(Budget.open(file,{...initialStage,stageLimitCny:26}),/identity mismatch/)
})

test('ceiling stops later smaller requests and survives reopening without losing settled usage', async () => {
  const file=await fixture(), limits={limitCny:100,priorCny:59.93,stageLimitCny:3}
  const b=await Budget.open(file,limits), id=await b.reserve(request)
  await b.settle(id,{prompt_tokens:1000,completion_tokens:500})
  await assert.rejects(b.reserve(request),/ceiling reached/)
  assert.equal(b.value.calls.length,1)
  await b.close()
  const resumed=await Budget.open(file,limits)
  await assert.rejects(resumed.reserve({...request,inputByteBound:1,maxOutput:1}),/previously reached/)
  assert.equal(resumed.used(),61.93)
  await resumed.close()
})

const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const grant = bytes => ({ id: 'human-approved-fixture', expectedSha256: digest(bytes), additionalCny: 3,
  limitCny: 120, authorization: 'Fixture: human approved at most 3 additional CNY and cumulative cap 120 CNY.' })
test('explicit amendment preserves prior spend, exact backup and calls, and enforces only the newly granted amount', async () => {
  const file = await fixture(), limits = { limitCny: 100, priorCny: 59.93, stageLimitCny: 3 }
  const b = await Budget.open(file, limits), id = await b.reserve(request)
  await b.settle(id, { prompt_tokens: 1000, completion_tokens: 500 })
  await assert.rejects(b.reserve(request), /ceiling/)
  await b.close()
  const before = await readFile(file), next = await Budget.amend(file, limits, grant(before))
  assert.deepEqual(await readFile(file + '.before-human-approved-fixture.json'), before)
  assert.deepEqual(next, { limitCny: 120, priorCny: 59.93, stageLimitCny: 5 })
  const amended = JSON.parse(await readFile(file))
  assert.deepEqual(amended.calls, JSON.parse(before).calls)
  assert.equal(amended.amendments[0].beforeSha256, digest(before))
  assert.equal(amended.amendments[0].cumulativeBeforeCny, 61.93)
  assert.equal(amended.exhausted, false)
  await assert.rejects(Budget.amend(file, next, grant(await readFile(file))), /already applied/)
  await assert.rejects(Budget.amend(file, limits, { ...grant(before), id: 'stale-grant' }), /changed since/)
  const resumed = await Budget.open(file, next)
  await resumed.reserve(request)
  await assert.rejects(resumed.reserve(request), /ceiling/)
  assert.equal(resumed.used(), 63.93)
  await resumed.close()
  await assert.rejects(Budget.open(file, limits), /identity mismatch/)
})

test('amendment cannot clear an accounting halt, unresolved reservation or malformed cost', async () => {
  for (const patch of [{ state: 'reserved' }, { state: 'unknown' }, { costCny: null }, { costCny: -1 }, { halted: true }]) {
    const file = await fixture(), b = await Budget.open(file, initial), id = await b.reserve(request)
    await b.settle(id, { prompt_tokens: 700, completion_tokens: 100 }); await b.close()
    const value = JSON.parse(await readFile(file))
    if (patch.halted) value.halted = true; else Object.assign(value.calls[0], patch)
    const bytes = JSON.stringify(value); await writeFile(file, bytes)
    await assert.rejects(Budget.amend(file, initial, grant(bytes)), /unresolved/)
    assert.equal(await readFile(file, 'utf8'), bytes)
  }
})

test('amendment requires exclusive ownership, positive explicit authorization and the global safety margin', async () => {
  const file = await fixture(), b = await Budget.open(file, initial), before = await readFile(file)
  await assert.rejects(Budget.amend(file, initial, grant(before)), { code: 'EEXIST' })
  await b.close()
  for (const patch of [{ authorization: '' }, { additionalCny: 0 }, { additionalCny: Infinity }, { limitCny: 99 }, { id: '../unsafe' }]) {
    await assert.rejects(Budget.amend(file, initial, { ...grant(before), ...patch }), /Invalid explicit/)
  }
  const limits = { limitCny: 100, priorCny: 89, stageLimitCny: 10 }, second = await fixture()
  const old = await Budget.open(second, limits); await old.close()
  const next = await Budget.amend(second, limits, { ...grant(await readFile(second)), limitCny: 100 })
  const resumed = await Budget.open(second, next)
  await assert.rejects(resumed.reserve(request), /ceiling/)
  await resumed.close()
  for (const invalid of [{ ...initial, limitCny: NaN }, { ...initial, priorCny: -1 }, { ...initial, stageLimitCny: 0 }]) {
    assert.throws(() => validateBudgetLimits(invalid), /Invalid budget/)
  }
})
