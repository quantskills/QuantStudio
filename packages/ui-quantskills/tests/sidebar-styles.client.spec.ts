/** Conversation sidebar stylesheet regressions that require real CSS declarations. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  fileURLToPath(new URL('../src/client/QuantSkillsApp.module.css', import.meta.url)),
  'utf8',
)

describe('QuantSkills conversation sidebar styles', () => {
  it('includes plugin-frame padding inside the claimed Host viewport', () => {
    expect(css).toMatch(
      /\.app, \.app \*, \.pluginFrame, \.pluginFrame \* \{\s*box-sizing:\s*border-box;/,
    )
  })

  it('keeps the 技能, 专家, and 专家团 filters from shrinking under long Session lists', () => {
    const match = /^\.sessionKindTabs \{([^}]*)\}/m.exec(css)
    if (match === null) throw new Error('QuantSkillsApp.module.css has no `.sessionKindTabs` rule')

    expect(match[1]).toMatch(/\bflex:\s*0\s+0\s+auto\b/)
  })
})
