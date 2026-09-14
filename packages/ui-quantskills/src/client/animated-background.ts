import { createInteractiveFlow } from './interactive-flow.ts'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { QuantSkillsBackgroundOption } from './theme-backgrounds.ts'
import { findMinimalTheme } from './minimal-themes.ts'

const KEY = 'quantskills.appearance.motion'
const EVENT = 'quantskills-motion-change'
const read = () => { try { return localStorage.getItem(KEY) !== 'paused' } catch { return true } }
const subscribe = (fn: () => void) => {
  window.addEventListener(EVENT, fn); window.addEventListener('storage', fn)
  return () => { window.removeEventListener(EVENT, fn); window.removeEventListener('storage', fn) }
}
export const useBackgroundMotion = () => useSyncExternalStore(subscribe, read, () => false)
export function setBackgroundMotion(enabled: boolean) {
  try { localStorage.setItem(KEY, enabled ? 'playing' : 'paused') } catch { /* Optional local preference. */ }
  window.dispatchEvent(new Event(EVENT))
}

/** One shared backdrop behind both the native conversation and the plugin pages. */
export function useAnimatedBackground(enabled: boolean, background: QuantSkillsBackgroundOption<string>, inConversation = false) {
  const playing = useBackgroundMotion()
  const playingRef = useRef(playing)
  const syncRef = useRef<(() => void) | undefined>(undefined)
  playingRef.current = playing
  useEffect(() => {
    if (!enabled || !background.id.startsWith('motion-') || (!background.url && !background.gradient)) return
    const minimal = findMinimalTheme(background.id)
    const layer = document.createElement('div')
    layer.dataset.qsMotion = background.id
    layer.setAttribute('aria-hidden', 'true')
    layer.style.backgroundImage = background.gradient ?? `url("${background.url}")`
    const canvas = document.createElement('canvas')
    layer.append(canvas)
    const container = inConversation ? document.body : document.querySelector('[aria-label="QuantSkills 插件应用"]') ?? document.body
    container.prepend(layer)
    const context = canvas.getContext('2d')
    const flow = minimal ? createInteractiveFlow(layer, canvas, minimal) : undefined
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0, previous = 0, elapsed = 0, width = 0, height = 0
    const particles = Array.from({ length: 48 }, (_, i) => ({ x: ((i * 137.5) % 997) / 997, y: ((i * 237.7) % 991) / 991, size: .6 + (i % 4) * .4, speed: .3 + (i % 7) * .14 }))
    const resize = () => {
      width = innerWidth; height = innerHeight
      const ratio = Math.min(devicePixelRatio || 1, 1.5)
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio)
      context?.setTransform(ratio, 0, 0, ratio, 0, 0)
      flow?.resize(width, height)
    }
    const scene = background.id.slice(7)
    const paint = (time: number) => {
      if (!context) return
      context.clearRect(0, 0, width, height)
      if (flow) { flow.draw(time); return }
      for (const p of particles) {
        const rain = scene === 'cyber' || scene === 'jiangnan'
        const x = ((p.x * width + time * p.speed * (rain ? -9 : 3)) % width + width) % width
        const y = ((p.y * height + time * p.speed * (rain ? 55 : scene === 'ocean' ? -9 : -2)) % height + height) % height
        context.globalAlpha = rain ? .15 : .16 + .28 * (1 + Math.sin(time * p.speed + p.x * 20)) / 2
        context.strokeStyle = scene === 'cyber' ? '#7bdaff' : '#e5f3ff'
        context.fillStyle = scene === 'meadow' ? '#fbefb2' : '#daefff'
        context.beginPath()
        if (rain) { context.moveTo(x, y); context.lineTo(x - 3, y + 10 + p.size * 5); context.stroke() }
        else { context.arc(x, y, p.size, 0, Math.PI * 2); context.fill() }
      }
      if (scene === 'ocean' || scene === 'meadow' || scene === 'jiangnan') {
        const x = width * (.65 + Math.sin(time / 13) * .15)
        const glow = context.createRadialGradient(x, height * .3, 0, x, height * .3, width * .6)
        glow.addColorStop(0, scene === 'meadow' ? '#ffedb119' : '#d4faff12'); glow.addColorStop(1, '#ffffff00')
        context.globalAlpha = .7; context.fillStyle = glow; context.fillRect(0, 0, width, height)
      }
    }
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw)
      if (!context || now - previous < 33) return
      const delta = Math.min(50, now - (previous || now)); previous = now; elapsed += delta
      paint(elapsed / 1000)
    }
    const sync = () => {
      cancelAnimationFrame(frame); previous = 0
      const active = playingRef.current && !reduced.matches && !document.hidden
      layer.dataset.playing = String(active)
      flow?.setActive(active)
      if (active) frame = requestAnimationFrame(draw)
      else paint(elapsed / 1000)
    }
    syncRef.current = sync
    resize(); sync()
    const onResize = () => { resize(); if (layer.dataset.playing !== 'true') paint(elapsed / 1000) }
    window.addEventListener('resize', onResize); document.addEventListener('visibilitychange', sync); reduced.addEventListener('change', sync)
    return () => { syncRef.current = undefined; cancelAnimationFrame(frame); flow?.destroy(); layer.remove(); window.removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', sync); reduced.removeEventListener('change', sync) }
  }, [enabled, background, inConversation])
  // Pause the existing scene so a preference change does not reset its composition.
  useEffect(() => { syncRef.current?.() }, [playing])
}
