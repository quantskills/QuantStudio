// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { DEFAULT_ARTIFACT_THEME, readArtifactTheme } from '../src/client/artifact-theme.ts'
import { InteractiveHtml, isolatedHtmlDocument } from '../src/client/InteractiveHtml.tsx'
import { artifactThemeRuntime } from '../src/client/artifact-theme-runtime.ts'
import { renderArtifactTheme } from '../../quantskills-session/src/artifact-theme.ts'
import { MINIMAL_THEMES } from '../src/client/minimal-themes.ts'
afterEach(() => { cleanup(); document.body.removeAttribute('style'); delete document.body.dataset.qsPluginTheme })
it('reads complete color palettes for all six glass/minimal themes', () => {
  for (const theme of MINIMAL_THEMES) {
    document.body.dataset.qsPluginTheme = theme.scheme
    for (const [key, value] of Object.entries(theme.tokens)) document.body.style.setProperty('--qs-' + key, value)
    const palette = readArtifactTheme()
    expect(palette.surface).toBe(theme.tokens.surface)
    expect(palette.text).toBe(theme.tokens.ink)
    expect(palette.onAccent).toBe(theme.tokens.buttonInk)
    expect(new Set(palette.series).size).toBe(6)
    expect(renderArtifactTheme({ artifactPalette: JSON.stringify(palette) })).toContain(theme.tokens.surface)
  }
})
it('updates iframe colors without resetting the document or interactive state', async () => {
  const { container } = render(<InteractiveHtml source='<input value="keep"><p>report</p>' title="报告"/>)
  const frame = container.querySelector('iframe')!
  const source = frame.srcdoc
  const post = vi.spyOn(frame.contentWindow!, 'postMessage')
  document.body.style.setProperty('--qs-surface', '#25333e')
  document.body.dataset.qsPluginTheme = 'dark'
  await waitFor(() => expect(post).toHaveBeenCalledWith(expect.objectContaining({ theme: expect.objectContaining({ scheme: 'dark', surface: '#25333e' }) }), '*'))
  expect(frame.srcdoc).toBe(source)
})
it('keeps both opaque sandbox boundaries and external network isolation', () => {
  const result = isolatedHtmlDocument('<script>fetch("https://example.com")</script>', 'Report', { ...DEFAULT_ARTIFACT_THEME, scheme: 'dark', surface: '#25333e' })
  expect(result).not.toContain('background:white')
  expect(result).toContain('#25333e')
  expect(result).toContain("connect-src 'none'")
  expect(result).not.toContain('allow-same-origin')
  expect(result.indexOf('Content-Security-Policy')).toBeLessThan(result.indexOf('fetch('))
})
it('publishes a palette for chart listeners, rejecting invalid messages and preserving data colors', async () => {
  const section = document.createElement('section')
  section.innerHTML = '<article style="background:#fff;color:#111">report <span style="color:rgb(200,0,0)">-3%</span><input value="kept"></article>'
  document.body.append(section)
  const changed = vi.fn()
  window.addEventListener('quantskills:themechange', changed)
  artifactThemeRuntime(DEFAULT_ARTIFACT_THEME)
  document.dispatchEvent(new Event('DOMContentLoaded'))
  const dark = { ...DEFAULT_ARTIFACT_THEME, scheme: 'dark', surface: '#25333e', text: '#eff7fa' }
  window.dispatchEvent(new MessageEvent('message', { source: window, data: { type: 'quantskills:artifact-theme', theme: dark } }))
  expect(document.documentElement.style.getPropertyValue('--qs-report-surface')).toBe('#25333e')
  expect(section.querySelector('article')!.style.backgroundColor).toBe('var(--qs-report-surface)')
  const semanticColor = section.querySelector('span')!.style.color
  expect(semanticColor).toContain('--qs-report-legacy-')
  const adjusted = document.documentElement.style.getPropertyValue(semanticColor.slice(4, -1)).match(/\d+/g)!.map(Number)
  expect(adjusted[0]).toBeGreaterThan(adjusted[1]!) // Still red after the contrast adjustment.
  expect(section.querySelector('input')!.value).toBe('kept')
  window.dispatchEvent(new MessageEvent('message', { source: window, data: { type: 'quantskills:artifact-theme', theme: { ...dark, surface: 'url(https://evil)' } } }))
  expect(document.documentElement.style.getPropertyValue('--qs-report-surface')).toBe('#25333e')
  expect(changed).toHaveBeenCalled()
  window.removeEventListener('quantskills:themechange', changed)
  section.remove()
})
it('bounds and sanitizes generation context instead of trusting arbitrary settings text', () => {
  const prompt = renderArtifactTheme({ artifactPalette: JSON.stringify({ ...DEFAULT_ARTIFACT_THEME, instruction: 'UNTRUSTED TEXT' }) })
  expect(prompt).not.toContain('UNTRUSTED TEXT')
  expect(prompt).toContain('quantskills:themechange')
  expect(prompt).toContain('Raster images')
  expect(renderArtifactTheme({ artifactPalette: 'invalid JSON' })).toContain('No palette snapshot')
})
