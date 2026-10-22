import test from 'node:test'
import assert from 'node:assert/strict'
import { gateway } from '../lib/gateway.mjs'

for (const [name, maxCalls, deadline, message] of [
  ['expired group cannot reserve or contact the provider', 64, 0, 'Per-task time cap reached'],
  ['call cap rejects before reserving money', 0, Date.now() + 600000, 'Per-task call cap reached'],
]) test(name, async () => {
  let reservations = 0
  const proxy = await gateway({ key: 'unused-test-key', pricing: {}, maxCalls,
    budget: { reserve() { reservations++; throw new Error('Unexpected reservation') } } })
  try {
    const token = proxy.register('bounded-test', { deadline })
    const response = await fetch(proxy.url + '/chat/completions', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'kimi-k3', messages: [] }),
    })
    assert.equal(response.status, 400)
    assert.equal((await response.json()).error.message, message)
    assert.equal(reservations, 0)
  } finally { await proxy.close() }
})
