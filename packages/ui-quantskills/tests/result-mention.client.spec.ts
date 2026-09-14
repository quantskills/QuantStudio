// @vitest-environment jsdom

import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindQuantSkillsResultMentionClicks } from '../src/client/result-mention.ts'

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
})

describe('QuantSkills result mention clicks', () => {
  it('opens accepted inline-code file mentions in the result workbench', () => {
    const code = document.createElement('code')
    const button = document.createElement('button')
    button.title = 'quantskills-drafts/agent/AGENTS.md'
    code.append(button)
    document.body.append(code)
    const genericOpen = vi.fn()
    const open = vi.fn(() => true)
    button.addEventListener('click', genericOpen)

    const dispose = bindQuantSkillsResultMentionClicks(document, open)
    button.click()

    expect(open).toHaveBeenCalledWith('quantskills-drafts/agent/AGENTS.md', button)
    expect(genericOpen).not.toHaveBeenCalled()
    dispose()
  })

  it('leaves rejected and non-mention buttons to their existing actions', () => {
    const code = document.createElement('code')
    const mention = document.createElement('button')
    mention.title = 'archive.bin'
    code.append(mention)
    const ordinary = document.createElement('button')
    ordinary.title = 'report.md'
    document.body.append(code, ordinary)
    const mentionOpen = vi.fn()
    const ordinaryOpen = vi.fn()
    mention.addEventListener('click', mentionOpen)
    ordinary.addEventListener('click', ordinaryOpen)

    const dispose = bindQuantSkillsResultMentionClicks(document, () => false)
    mention.click()
    ordinary.click()

    expect(mentionOpen).toHaveBeenCalledOnce()
    expect(ordinaryOpen).toHaveBeenCalledOnce()
    dispose()
  })
})
