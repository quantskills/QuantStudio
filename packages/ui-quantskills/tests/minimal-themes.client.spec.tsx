// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MINIMAL_THEMES, findMinimalTheme, minimalThemeStyle } from '../src/client/minimal-themes.ts'
import { QuantSkillsThemePicker } from '../src/client/QuantSkillsThemePicker.tsx'
import { CapabilityIcon } from '../src/client/CapabilityIcon.tsx'
import { resolveQuantSkillsBackground } from '../src/client/theme-backgrounds.ts'
import type { QuantSkillsColorScheme, QuantSkillsDarkBackground, QuantSkillsLightBackground } from '../src/appearance-settings.ts'

afterEach(() => { cleanup(); delete document.body.dataset.qsBackground; delete document.body.dataset.qsPreset; localStorage.clear() })

function Picker() {
  const [scheme, setScheme] = useState<QuantSkillsColorScheme>('light')
  const [dark, setDark] = useState<QuantSkillsDarkBackground>('moonwalker')
  const [light, setLight] = useState<QuantSkillsLightBackground>('launch')
  return <><QuantSkillsThemePicker scheme={scheme} darkBackground={dark} lightBackground={light} disabled={false} onChange={setScheme} onDarkBackgroundChange={setDark} onLightBackgroundChange={setLight}/>
    <output>{scheme} / {resolveQuantSkillsBackground(scheme, light, dark).id}</output></>
}
function luminance(hex: string) {
  const channels = hex.slice(1).match(/../g)!.map(value => Number.parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  return channels[0]! * .2126 + channels[1]! * .7152 + channels[2]! * .0722
}
const contrast = (a: string, b: string) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05)

describe('complete interactive themes', () => {
  it.each(MINIMAL_THEMES)('applies $label as a complete profile and retains it when switching modes', async theme => {
    render(<Picker/>)
    fireEvent.click(screen.getByRole('button', { name: `应用${theme.label}主题` }))
    expect(screen.getByRole('status').textContent).toBe(`${theme.scheme} / ${theme.background}`)
    expect(localStorage.getItem('quantskills.appearance.preset')).toBe(theme.id)
    expect(screen.getByRole('button', { name: `应用${theme.label}主题` }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: theme.scheme === 'dark' ? '明亮' : '深色', exact: true }))
    expect(screen.getByRole('status').textContent).toBe(theme.scheme === 'dark' ? 'light / launch' : 'dark / moonwalker')
    fireEvent.click(screen.getByRole('button', { name: theme.scheme === 'dark' ? '深色' : '明亮', exact: true }))
    expect(screen.getByRole('status').textContent).toBe(`${theme.scheme} / ${theme.background}`)
    const background = theme.scheme === 'light'
      ? resolveQuantSkillsBackground('light', theme.background, 'moonwalker')
      : resolveQuantSkillsBackground('dark', 'launch', theme.background)
    expect(findMinimalTheme(background.id)?.id).toBe(theme.id)
    expect(screen.getByRole('button', { name: `应用${theme.label}主题` }).getAttribute('aria-pressed')).toBe('true')
  })
  it.each(MINIMAL_THEMES)('$label keeps body, muted text and primary button labels readable', theme => {
    for (const background of [theme.tokens.surface, theme.tokens.chrome, theme.tokens.tint]) {
      expect(contrast(theme.tokens.ink, background)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(theme.tokens.secondary, background)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(theme.tokens.accent, background)).toBeGreaterThanOrEqual(4.5)
    }
    for (const color of [theme.tokens.accent, theme.tokens.skill, theme.tokens.agent, theme.tokens.team, theme.tokens.success, theme.tokens.warning, theme.tokens.danger]) {
      expect(contrast(color, theme.tokens.surface)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(color, theme.tokens.deep)).toBeGreaterThanOrEqual(4.5)
    }
    for (const color of [theme.tokens.accent, theme.tokens.skill, theme.tokens.agent, theme.tokens.team]) {
      expect(contrast(theme.tokens.buttonInk, color)).toBeGreaterThanOrEqual(4.5)
    }
    expect(Object.keys(theme.tokens).sort()).toEqual(Object.keys(MINIMAL_THEMES[0].tokens).sort())
    expect(minimalThemeStyle(theme)['--qs-buttonInk']).toBe(theme.tokens.buttonInk)
  })
  it('updates all mounted capability icons when a scene changes, and restores cosmic identities', async () => {
    const { container } = render(<><CapabilityIcon kind="skill"/><CapabilityIcon kind="agent"/><CapabilityIcon kind="agent-team" bare/></>)
    for (const [background, family] of [['motion-glass-blue','lagoon'],['motion-glass-rain','rain'],['motion-glass-ink','ink'],['motion-minimal-jade','botanical'],['motion-cyber','cyber'],['moonwalker','cosmos'],['motion-minimal-copper','atelier']]) {
      await act(async () => { document.body.dataset.qsBackground = background })
      await waitFor(() => expect([...container.querySelectorAll('[data-family]')].map(icon => icon.getAttribute('data-family'))).toEqual([family, family, family]))
      expect(new Set([...container.querySelectorAll('svg')].map(svg => svg.innerHTML)).size).toBe(3)
    }
  })
})
