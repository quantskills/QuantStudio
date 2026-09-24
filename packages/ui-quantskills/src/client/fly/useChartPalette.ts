import { useEffect, useRef, useState } from 'react'

const defaults = {
  equity: '#0067d9', profit: '#c03939', loss: '#16805b', muted: '#687080',
  blue: '#0067d9', text: '#202126', grid: '#dbe2ea', surface: '#ffffff', warning: '#a36813',
}
export type ChartPalette = typeof defaults
const tokens: Record<keyof ChartPalette, string> = {
  equity: '--fv-lime', profit: '--fv-danger', loss: '--fv-success', muted: '--fv-muted',
  blue: '--fv-lime', text: '--fv-text', grid: '--fv-line', surface: '--fv-panel', warning: '--fv-warning',
}

/** Canvas charts cannot inherit CSS variables: resolve the current component palette. */
export function useChartPalette() {
  const ref = useRef<HTMLElement>(null)
  const [palette, setPalette] = useState<ChartPalette>(defaults)
  useEffect(() => {
    if (!ref.current) return
    const element = ref.current
    const read = () => {
      const style = getComputedStyle(element)
      const next = { ...defaults }
      for (const key of Object.keys(tokens) as (keyof ChartPalette)[]) {
        next[key] = style.getPropertyValue(tokens[key]).trim() || defaults[key]
      }
      setPalette(previous => Object.keys(next).every(key => previous[key as keyof ChartPalette] === next[key as keyof ChartPalette]) ? previous : next)
    }
    read()
    const observer = new MutationObserver(read)
    // Presets may be applied to body or to a nested QS frame. Avoid observing chart mutations.
    for (let parent: HTMLElement | null = element; parent; parent = parent.parentElement) {
      observer.observe(parent, { attributes: true })
    }
    const scheme = window.matchMedia?.('(prefers-color-scheme: dark)')
    scheme?.addEventListener('change', read)
    return () => { observer.disconnect(); scheme?.removeEventListener('change', read) }
  }, [])
  return { ref, palette }
}
