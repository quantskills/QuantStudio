import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { describe, it, expect, vi } from 'vitest'
import { ContestService } from '../src/contest-service.ts'
import { ContestWatcher } from '../src/contest-watch.ts'
import type { ContestCli } from '../src/contest-cli.ts'
import type { ContestData } from '../src/contest-types.ts'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'

describe('watcher and service contract matching', () => {
  it.each([
    { configured: 'rb2610', position: 'rb2610', direction: 'long' },
    { configured: 'RB2610', position: 'rb2610', direction: 'long' },
    { configured: 'rb2610', position: 'RB2610.SHF', direction: 'long' },
    { configured: 'RB2610', position: 'rb2610.shf', direction: 'short' },
    { configured: 'if2609', position: 'IF2609.CFE', direction: 'short' },
    { configured: 'ta609', position: 'TA609.CZC', direction: 'long' },
  ])('can prepare a close after accepting the position: %j', async ({ configured, position, direction }) => {
    const home = await mkdtemp(join(tmpdir(), 'quantstudio-review-close-'))
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-18T02:00:00Z'))
    const identity = { accountId: 'demo-account', contestId: 'demo-contest' }
    const canonical = position.split('.')[0]!, side = direction === 'long' ? 'sell' : 'buy'
    const data = (value: JsonValue): ContestData => ({ data: value, fetchedAt: Date.now() })
    const run = vi.fn<ContestCli['run']>(async (_runtime, args) => {
      if (args[0] === 'whoami') return data({ loggedIn: true, ...identity, scope: 'futures:read futures:trade' })
      if (args[0] === 'agent') return data({ minimumCliVersion: '0.1.9' })
      if (args[0] === 'doctor') return data({ allOk: true })
      if (args[0] === 'account') return data({ equity: 1000000 })
      if (args[0] === 'positions') return data([{ contractCode: position, direction, volume: 1, closable: 1, openPrice: 3010 }])
      if (args[0] === 'orders') return data([])
      if (args[0] === 'quote') return data({ ready: true, contractCode: canonical, latestPrice: 3000, quoteTime: new Date().toISOString() })
      if (args[0] === 'order') return data({ wouldSucceed: true, contractCode: canonical, marketQuote: { contractCode: position } })
      if (args[0] === 'plan' && args[1] === 'create') return data({ planId: 'review-close-plan', expiresAt: Date.now() + 60000 })
      throw new Error(`Unexpected CLI action ${args[0]}`)
    })
    const service = new ContestService({ run, install: async () => ({ version: '0.1.19', rules: 'name: panda-trading' }) }, home)
    const ctx = { get: (name: string) => name === 'credentials' ? { describe: async () => ({ configured: true }) } : undefined } as unknown as Context
    const watcher = new ContestWatcher(ctx, service, async () => ({ action: direction === 'long' ? 'close_long' : 'close_short', confidence: .95,
      probabilities: direction === 'long' ? { hold: .05, close_long: .95 } : { hold: .05, close_short: .95 }, model: 'jev-1.13.0', time: Date.now() }))
    try {
      await service.setEnabled(true); await service.connect()
      await watcher.start({ symbol: configured, volume: 1, intervalSeconds: 60, durationMinutes: 120,
        minConfidence: .8, maxEquityDrop: 1000, maxPlans: 2, instructions: 'Evaluate closing existing position.' })
      for (let i = 0; i < 8; i++) {
        vi.setSystemTime(Date.now() + 60000); await watcher.tick()
        await (watcher as unknown as { decisionTask?: Promise<void> }).decisionTask
      }
      const state = await watcher.status()
      expect(state.running, state.message).toBe(true)
      expect(state.planCount, state.message).toBe(1)
      expect((await service.status()).plans[0]?.details.parameters).toMatchObject({ contractCode: canonical, side, offset: 'close', volume: 1 })
      expect(run.mock.calls.find(([, args]) => args[0] === 'order')?.[1]).toEqual([
        'order', '--symbol', canonical, '--direction', side, '--offset', 'close', '--volume', '1', '--dry-run',
      ])
      expect(run.mock.calls.some(([, args]) => args[0] === 'plan' && args[1] === 'execute')).toBe(false)
    } finally {
      watcher.dispose(); service.dispose(); vi.useRealTimers()
      await rm(home, { recursive: true, force: true })
    }
  })
})
