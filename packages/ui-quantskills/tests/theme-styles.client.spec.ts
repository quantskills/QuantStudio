/** QuantSkills palette regressions that require the emitted CSS declarations. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  fileURLToPath(new URL('../src/client/QuantSkillsApp.module.css', import.meta.url)),
  'utf8',
)

const compatibilityTokens = [
  '--dsw-alias-bg-base',
  '--dsw-alias-bg-mask-1',
  '--dsw-alias-border-inverted',
  '--dsw-alias-button-elevated-fill',
  '--dsw-alias-interactive-bg-hover-solid',
  '--dsw-alias-label-caption',
  '--dsw-alias-label-dimmed',
  '--dsw-alias-markdown-code-block-banner',
  '--dsw-alias-markdown-code-segment-selected',
  '--dsw-alias-scrollbar-bg-l2',
  '--dsw-alias-state-business-primary',
  '--dsw-alias-state-error-primary',
  '--dsw-linear-gradient-think',
  '--dsw-specific-sidebar-nav-item-active',
] as const

function palette(scheme: 'light' | 'dark'): Map<string, string> {
  const selector = [
    `body[data-qs-plugin-theme='${scheme}']`,
    `.rootFrame[data-qs-theme='${scheme}']`,
    `.pluginFrame[data-qs-theme='${scheme}']`,
  ].map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(',\\s*')
  const match = new RegExp(`${selector}\\s*\\{([^}]*)\\}`, 's').exec(css)
  if (match === null) throw new Error(`QuantSkillsApp.module.css has no grouped ${scheme} palette`)
  return new Map(
    [...match[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)]
      .map((entry) => [entry[1], entry[2].trim()]),
  )
}

describe('QuantSkills theme styles', () => {
  it('keeps the light and dark palettes structurally symmetric', () => {
    expect([...palette('light').keys()].sort()).toEqual([...palette('dark').keys()].sort())
  })

  it('owns native Host tokens that otherwise leak from the Host color scheme', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const tokens = palette(scheme)
      for (const token of compatibilityTokens) expect(tokens.has(token), `${scheme}: ${token}`).toBe(true)
    }
  })

  it('keeps each shared DSH palette declaration in one scheme block', () => {
    expect(css.match(/--dsw-alias-bg-base\s*:\s*#/g)).toHaveLength(2)
    expect(css.match(/--dsw-alias-markdown-code-block-banner\s*:\s*#/g)).toHaveLength(2)
  })

  it('uses light surfaces for native tool inspection and code-block chrome', () => {
    const light = palette('light')
    expect(light.get('--dsw-alias-bg-base')).toBe('#fff')
    expect(light.get('--dsw-alias-interactive-bg-hover-solid')).toBe('#f1f3f5')
    expect(light.get('--dsw-alias-markdown-code-block-banner')).toBe('#f1f1f1')
  })

  it('uses scheme-aware foregrounds and semantic feedback surfaces', () => {
    expect(css).toMatch(
      /\.promptFormDrawer > footer button:last-child \{[^}]*color: var\(--dsw-alias-label-inverted-primary\);/,
    )
    expect(css).toMatch(
      /\.capabilityPickerError \{[^}]*background: color-mix\([^;]*var\(--dsw-alias-bg-base\)\);[^}]*color: var\(--dsw-alias-state-error-primary\);/,
    )
  })
})
