import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { describe, expect, it } from 'vitest'
import { InputTriggerController } from '../src/client/controller.ts'
import type { InputTriggerSource, SourceRoster } from '../src/client/index.ts'

const sessionId = 'launcher-test' as SessionId

function source(name: string, launcher?: true): InputTriggerSource {
  return {
    trigger: '/',
    name,
    ...(launcher === true ? { launcher: true } : {}),
    candidates: () => Promise.resolve([{ name }]),
    onPick: () => undefined,
  }
}

describe('InputTriggerController launcher compatibility', () => {
  it('opens the DSH command source and explicit plugin launcher sources', async () => {
    const sources = [source('command'), source('quantskills', true), source('hidden')]
    const roster: SourceRoster = {
      sources: trigger => sources.filter(item => item.trigger === trigger),
      all: () => sources,
    }
    const controller = new InputTriggerController({ actx: {} as never, sessionId, roster })

    controller.toggleLauncher({
      trigger: '/',
      query: '',
      quoted: false,
      position: 'leading',
      span: { start: 0, end: 0, draftRev: 1 },
    })
    await Promise.resolve()

    expect(controller.launcher.getSnapshot()).toBe('launcher')
    expect(controller.menu.getSnapshot().groups.map(group => group.source))
      .toEqual(['command', 'quantskills'])
  })
})
