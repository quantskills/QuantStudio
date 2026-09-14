import { useSyncExternalStore } from 'react'

export interface ArtifactTheme {
  scheme: 'light' | 'dark'
  background: string; surface: string; text: string; muted: string; border: string
  accent: string; onAccent: string; success: string; warning: string; danger: string
  series: string[]
}
export const DEFAULT_ARTIFACT_THEME: ArtifactTheme = {
  scheme: 'light', background: '#f5f6f8', surface: '#ffffff', text: '#202126', muted: '#686b74',
  border: '#e1e3e8', accent: '#0067d9', onAccent: '#ffffff', success: '#24704a', warning: '#89561c', danger: '#ac454c',
  series: ['#0067d9', '#7952c7', '#00798b', '#a85a20', '#b24372', '#527235'],
}
const color = (value: string, fallback: string) => /^#[0-9a-f]{6}$/i.test(value) ? value
  : /^#[0-9a-f]{3}$/i.test(value) ? '#' + [...value.slice(1)].map(c => c + c).join('') : fallback

/** Only color values leave the app; never CSS rules, URLs, page contents or credentials. */
export function readArtifactTheme(): ArtifactTheme {
  if (typeof document === 'undefined') return DEFAULT_ARTIFACT_THEME
  const style = getComputedStyle(document.body)
  const dark = document.body.dataset.qsPluginTheme === 'dark'
  const value = (token: string, fallback: string) => color(style.getPropertyValue('--qs-' + token).trim(), fallback)
  return {
    scheme: dark ? 'dark' : 'light',
    background: value('chrome', dark ? '#202125' : '#f5f6f8'), surface: value('surface', dark ? '#292a30' : '#ffffff'),
    text: value('ink', dark ? '#f0f1f5' : '#202126'), muted: value('secondary', dark ? '#afb1be' : '#686b74'),
    border: value('line', dark ? '#404149' : '#e1e3e8'), accent: value('accent', dark ? '#75b5ff' : '#0067d9'),
    onAccent: value('buttonInk', dark ? '#122032' : '#ffffff'),
    success: value('success', dark ? '#88d9b2' : '#24704a'), warning: value('warning', dark ? '#f3ce8e' : '#89561c'), danger: value('danger', dark ? '#ff9f9c' : '#ac454c'),
    series: [value('accent', dark ? '#75b5ff' : '#0067d9'), value('skill', dark ? '#c9b1ff' : '#7952c7'),
      value('agent', dark ? '#79ded4' : '#00798b'), value('team', dark ? '#f3ce8e' : '#a85a20'),
      dark ? '#f4a5c8' : '#b24372', dark ? '#b9d98b' : '#527235'],
  }
}

export function subscribeArtifactTheme(notify: () => void): () => void {
  const observer = new MutationObserver(notify)
  observer.observe(document.body, { attributes: true, attributeFilter: ['style', 'class', 'data-qs-plugin-theme', 'data-qs-preset', 'data-qs-background'] })
  return () => observer.disconnect()
}
export function useArtifactTheme(): ArtifactTheme {
  const snapshot = useSyncExternalStore(subscribeArtifactTheme, () => JSON.stringify(readArtifactTheme()), () => JSON.stringify(DEFAULT_ARTIFACT_THEME))
  return JSON.parse(snapshot) as ArtifactTheme
}
