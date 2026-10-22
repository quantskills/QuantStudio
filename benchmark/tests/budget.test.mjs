import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Budget } from '../lib/budget.mjs'
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
