import { open, readFile, rename } from 'node:fs/promises'
import { randomUUID, createHash } from 'node:crypto'

export function validateBudgetLimits(value) {
  if (!Number.isFinite(value.priorCny) || value.priorCny < 0
    || !Number.isFinite(value.limitCny) || value.limitCny <= 0
    || (value.stageLimitCny !== undefined && (!Number.isFinite(value.stageLimitCny) || value.stageLimitCny <= 0))) {
    throw new Error('Invalid budget limits')
  }
}

// A single writer owns the ledger for its entire run. A stale lock is never
// silently removed: an interrupted request may have reached the paid service.
export class Budget {
  static async open(file, initial) {
    validateBudgetLimits(initial)
    const lock = await open(file + '.lock', 'wx', 0o600)
    try {
      await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }))
      await lock.sync()
      let value
      try { value = JSON.parse(await readFile(file, 'utf8')) }
      catch (e) { if (e.code !== 'ENOENT') throw e; value = { schema: 1, ...initial, calls: [] } }
      if (value.schema !== 1 || !Array.isArray(value.calls) || !Number.isFinite(value.priorCny) || value.priorCny < 0
          || value.limitCny !== initial.limitCny || value.priorCny !== initial.priorCny || value.stageLimitCny !== initial.stageLimitCny) throw new Error('Budget ledger identity mismatch')
      for (const call of value.calls) if (call.state === 'reserved') {
        call.state = 'unknown'; call.failure = 'Interrupted before durable usage settlement'; value.halted = true
      }
      const budget = new Budget(file, value, lock)
      await budget.save()
      return budget
    } catch (e) { await lock.close(); /* keep lock on uncertain state */ throw e }
  }
  // Explicit human-authorized extension only. Editing a config or reopening a
  // stopped ledger never invokes this path. The expected digest binds approval
  // to settled spend; no unresolved/in-flight usage may be carried through it.
  static async amend(file, initial, { id, expectedSha256, additionalCny, limitCny, authorization }) {
    validateBudgetLimits(initial)
    if (!/^[a-z0-9-]{1,80}$/.test(id ?? '') || !/^[a-f0-9]{64}$/.test(expectedSha256 ?? '')
      || !Number.isFinite(additionalCny) || additionalCny <= 0
      || !Number.isFinite(limitCny) || limitCny < initial.limitCny
      || typeof authorization !== 'string' || !authorization.trim() || authorization.length > 1000) {
      throw new Error('Invalid explicit budget authorization')
    }
    const lock = await open(file + '.lock', 'wx', 0o600)
    const budget = new Budget(file, null, lock)
    try {
      const bytes = await readFile(file)
      if (createHash('sha256').update(bytes).digest('hex') !== expectedSha256) throw new Error('Budget changed since authorization snapshot')
      const value = JSON.parse(bytes)
      if (value.schema !== 1 || !Array.isArray(value.calls) || value.priorCny !== initial.priorCny
        || value.limitCny !== initial.limitCny || value.stageLimitCny !== initial.stageLimitCny) throw new Error('Budget ledger identity mismatch')
      if (value.halted || value.calls.some(c => c.state !== 'settled' || !Number.isFinite(c.costCny) || c.costCny < 0)) {
        throw new Error('Cannot extend a ledger with unresolved usage')
      }
      if (value.amendments !== undefined && !Array.isArray(value.amendments)) throw new Error('Unknown amendment history')
      if (value.amendments?.some(entry => entry.id === id)) throw new Error('Authorization already applied')
      const spent = value.calls.reduce((sum, c) => sum + c.costCny, 0)
      const next = { limitCny, priorCny: value.priorCny, stageLimitCny: spent + additionalCny }
      validateBudgetLimits(next)
      if (Math.min(limitCny * 0.9, next.priorCny + next.stageLimitCny) <= value.priorCny + spent) throw new Error('No authorized budget remaining')
      const backupName = file + '.before-' + id + '.json'
      const backup = await open(backupName, 'wx', 0o600)
      try { await backup.writeFile(bytes); await backup.sync() } finally { await backup.close() }
      value.amendments = [...(value.amendments ?? []), { id, authorizedAt: new Date().toISOString(),
        authorization: authorization.trim(), beforeSha256: expectedSha256, before: { ...initial }, after: next,
        cumulativeBeforeCny: value.priorCny + spent, settledCallsBefore: value.calls.length, additionalCny }]
      Object.assign(value, next, { exhausted: false })
      budget.value = value
      await budget.save()
      return next
    } finally { await budget.close() }
  }
  constructor(file, value, lock) { this.file = file; this.value = value; this.lock = lock; this.tail = Promise.resolve() }
  serial(fn) { const result = this.tail.then(fn); this.tail = result.catch(() => {}); return result }
  used() { return this.value.priorCny + this.value.calls.reduce((sum, c) => sum + (c.costCny ?? c.reserveCny), 0) }
  reserve({ tag, inputByteBound, maxOutput, inputRate, outputRate }) {
    return this.serial(async () => {
      if (this.value.halted || this.value.calls.some(c => c.state === 'unknown')) throw new Error('Budget halted by unresolved request')
      if (this.value.exhausted) throw new Error('Budget safety ceiling previously reached; further paid runs disabled')
      if (![inputByteBound, maxOutput].every(v => Number.isSafeInteger(v) && v > 0)
        || ![inputRate, outputRate].every(v => Number.isFinite(v) && v > 0)) throw new Error('Invalid reservation inputs')
      const reserveCny = inputByteBound * inputRate + maxOutput * outputRate
      if (this.used() + reserveCny > Math.min(this.value.limitCny * 0.9, this.value.stageLimitCny === undefined ? Infinity : this.value.priorCny + this.value.stageLimitCny)) {
        this.value.exhausted = true; await this.save()
        throw new Error('Budget safety ceiling reached before request')
      }
      const call = { id: randomUUID(), tag, inputByteBound, maxOutput, inputRate, outputRate, reserveCny, state: 'reserved', startedAt: new Date().toISOString() }
      this.value.calls.push(call); await this.save(); return call.id
    })
  }
  settle(id, usage, extra = {}) {
    return this.serial(async () => {
      const call = this.value.calls.find(c => c.id === id)
      if (!call || call.state !== 'reserved') throw new Error('Reservation is not pending')
      const input = usage?.prompt_tokens, output = usage?.completion_tokens
      if (![input, output].every(v => Number.isSafeInteger(v) && v >= 0)) {
        call.state = 'unknown'; this.value.halted = true; await this.save(); throw new Error('Authoritative token usage missing')
      }
      Object.assign(call, { state: 'settled', inputTokens: input, outputTokens: output,
        cachedInputTokens: usage.prompt_tokens_details?.cached_tokens ?? usage.prompt_cache_hit_tokens ?? null,
        reasoningTokens: usage.completion_tokens_details?.reasoning_tokens ?? null,
        costCny: input * call.inputRate + output * call.outputRate, ...extra })
      if (input > call.inputByteBound || output > call.maxOutput) this.value.halted = true
      await this.save()
      if (this.value.halted) throw new Error('Provider exceeded reserved bounds; future requests disabled')
    })
  }
  unknown(id, reason) { return this.serial(async () => {
    const call = this.value.calls.find(c => c.id === id)
    if (call?.state === 'reserved') { call.state = 'unknown'; call.failure = reason; this.value.halted = true; await this.save() }
  }) }
  async save() {
    const temporary = this.file + '.next'
    const stream = await open(temporary, 'w', 0o600)
    try { await stream.writeFile(JSON.stringify(this.value, null, 2) + '\n'); await stream.sync() } finally { await stream.close() }
    await rename(temporary, this.file)
  }
  async close() {
    await this.tail
    await this.lock.close()
    // The writer is closed, but unfinished reservations still survive in JSON.
    const { unlink } = await import('node:fs/promises'); await unlink(this.file + '.lock')
  }
}
