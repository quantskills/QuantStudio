import { open, readFile, rename } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

// A single writer owns the ledger for its entire run. A stale lock is never
// silently removed: an interrupted request may have reached the paid service.
export class Budget {
  static async open(file, initial) {
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
  constructor(file, value, lock) { this.file = file; this.value = value; this.lock = lock; this.tail = Promise.resolve() }
  serial(fn) { const result = this.tail.then(fn); this.tail = result.catch(() => {}); return result }
  used() { return this.value.priorCny + this.value.calls.reduce((sum, c) => sum + (c.costCny ?? c.reserveCny), 0) }
  reserve({ tag, inputByteBound, maxOutput, inputRate, outputRate }) {
    return this.serial(async () => {
      if (this.value.halted || this.value.calls.some(c => c.state === 'unknown')) throw new Error('Budget halted by unresolved request')
      if (![inputByteBound, maxOutput].every(v => Number.isSafeInteger(v) && v > 0)
        || ![inputRate, outputRate].every(v => Number.isFinite(v) && v > 0)) throw new Error('Invalid reservation inputs')
      const reserveCny = inputByteBound * inputRate + maxOutput * outputRate
      if (this.used() + reserveCny > Math.min(this.value.limitCny * 0.9, this.value.stageLimitCny === undefined ? Infinity : this.value.priorCny + this.value.stageLimitCny)) throw new Error('Budget safety ceiling reached before request')
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
