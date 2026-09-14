// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInteractiveFlow } from '../src/client/interactive-flow.ts'
import { MINIMAL_THEMES } from '../src/client/minimal-themes.ts'
import { setBackgroundMotion, useAnimatedBackground } from '../src/client/animated-background.ts'
import { resolveQuantSkillsBackground } from '../src/client/theme-backgrounds.ts'

let context: CanvasRenderingContext2D
beforeEach(() => {
  localStorage.clear()
  const gradient = { addColorStop: vi.fn() }
  context = Object.fromEntries(['clearRect','setTransform','beginPath','closePath','arc','ellipse','fill','fillRect','moveTo','lineTo','stroke'].map(name => [name, vi.fn()])) as unknown as CanvasRenderingContext2D
  context.createLinearGradient = vi.fn(() => gradient) as never
  context.createRadialGradient = vi.fn(() => gradient) as never
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) => kind === '2d' ? context : null) as never)
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.innerHTML = ''; localStorage.clear() })

function scene(theme: typeof MINIMAL_THEMES[number] = MINIMAL_THEMES[0]) {
  const layer = document.createElement('div'), canvas = document.createElement('canvas')
  document.body.append(layer); layer.append(canvas)
  const flow = createInteractiveFlow(layer, canvas, theme)
  flow.resize(800, 600)
  return { layer, flow }
}
function pointer() { return new MouseEvent('pointerdown', { clientX: 200, clientY: 180, button: 0, bubbles: true, cancelable: true }) }
const hasRipple = () => vi.mocked(context.arc).mock.calls.some(([, , radius]) => radius > 10)
const rippleCount = () => vi.mocked(context.arc).mock.calls.filter(([, , radius]) => radius > 10).length

describe('interactive background lifecycle', () => {
  it('falls back without WebGL, responds to clicks without consuming them, and stops observing after disposal', () => {
    const { layer, flow } = scene()
    expect(layer.dataset.flowRenderer).toBe('canvas')
    flow.setActive(true); flow.draw(0)
    const click = pointer(); document.dispatchEvent(click)
    vi.mocked(context.arc).mockClear(); flow.draw(.2)
    expect(click.defaultPrevented).toBe(false)
    expect(hasRipple()).toBe(true)
    flow.draw(5); flow.destroy()
    document.dispatchEvent(pointer()); vi.mocked(context.arc).mockClear(); flow.draw(5.1)
    expect(hasRipple()).toBe(false)
    expect(layer.querySelectorAll('canvas')).toHaveLength(1)
  })
  it('ignores interaction while paused and clears ripples when paused', () => {
    const { flow } = scene()
    flow.setActive(false); document.dispatchEvent(pointer()); flow.draw(.2)
    expect(hasRipple()).toBe(false)
    flow.setActive(true); document.dispatchEvent(pointer()); flow.draw(.4)
    expect(hasRipple()).toBe(true)
    flow.setActive(false); vi.mocked(context.arc).mockClear(); flow.draw(.4)
    expect(hasRipple()).toBe(false)
    flow.destroy()
  })
  it.each(['glass-blue', 'glass-rain', 'glass-ink'])('%s responds to pointer movement, limits trails, and keeps control clicks usable', (id) => {
    const theme = MINIMAL_THEMES.find(theme => theme.id === id)!
    const { flow } = scene(theme)
    flow.setActive(true); flow.draw(0)
    const button = document.createElement('button'), onClick = vi.fn()
    button.addEventListener('click', onClick); document.body.append(button)
    const move = new MouseEvent('pointermove', {clientX: 230, clientY: 190, bubbles: true, cancelable: true})
    button.dispatchEvent(move)
    for(let i=0;i<20;i++)document.dispatchEvent(new MouseEvent('pointermove', {clientX: 250+i*5, clientY: 200, bubbles: true}))
    vi.mocked(context.arc).mockClear();flow.draw(.2)
    expect(move.defaultPrevented).toBe(false)
    expect(rippleCount()).toBe(2)
    const click = pointer();button.dispatchEvent(click);button.click()
    vi.mocked(context.arc).mockClear();flow.draw(.3)
    expect(rippleCount()).toBe(4)
    expect(click.defaultPrevented).toBe(false)
    expect(onClick).toHaveBeenCalledOnce()
    flow.destroy()
  })
  it.each(['glass-blue', 'glass-rain', 'glass-ink'])('%s retains its still frame when paused, including after new pointer events', (id) => {
    const theme = MINIMAL_THEMES.find(theme => theme.id === id)!
    const { flow } = scene(theme)
    flow.setActive(true);flow.draw(3)
    flow.setActive(false)
    vi.mocked(context.arc).mockClear();flow.draw(3)
    const arcs = [...vi.mocked(context.arc).mock.calls]
    document.dispatchEvent(pointer())
    document.dispatchEvent(new MouseEvent('pointermove', {clientX: 450, clientY: 100, bubbles: true}))
    vi.mocked(context.arc).mockClear();flow.draw(20)
    expect(vi.mocked(context.arc).mock.calls).toEqual(arcs)
    expect(hasRipple()).toBe(false)
    flow.destroy()
    vi.mocked(context.clearRect).mockClear();flow.draw(30)
    expect(context.clearRect).not.toHaveBeenCalled()
  })
  it('renders rain streaks and glass droplets only for the rainy scene, with a safe canvas fallback for every theme', () => {
    for(const theme of MINIMAL_THEMES){
      const {layer, flow}=scene(theme)
      expect(layer.dataset.flowRenderer).toBe('canvas')
      vi.mocked(context.ellipse).mockClear();flow.draw(0)
      expect(vi.mocked(context.ellipse).mock.calls.length > 0).toBe(theme.scene==='rain')
      expect(context.fillRect).toHaveBeenCalledWith(0,0,800,600)
      flow.destroy();layer.remove()
    }
  })
  it('repaints a paused scene with the canvas fallback after GPU loss and releases resources once', () => {
    const gl = {
      ...Object.fromEntries(['shaderSource','compileShader','attachShader','linkProgram','useProgram','bindBuffer','bufferData','enableVertexAttribArray','vertexAttribPointer','uniform3fv','uniform4fv','uniform3f','uniform2f','viewport','drawArrays','deleteShader','deleteProgram','deleteBuffer'].map(name => [name,vi.fn()])),
      createShader: vi.fn(() => ({})), createProgram: vi.fn(() => ({})), createBuffer: vi.fn(() => ({})),
      getShaderParameter: vi.fn(() => true),getProgramParameter: vi.fn(() => true),
      getAttribLocation: vi.fn(() => 0),getUniformLocation: vi.fn(() => ({})),getExtension: vi.fn(() => null),
    }
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockImplementation(((kind: string) => kind==='2d' ? context : gl) as never)
    const { layer, flow }=scene(MINIMAL_THEMES.find(theme => theme.id==='glass-blue')!)
    expect(layer.dataset.flowRenderer).toBe('webgl')
    flow.setActive(false);flow.draw(0)
    const gpu=layer.firstElementChild as HTMLCanvasElement
    vi.mocked(context.fillRect).mockClear()
    const loss=new Event('webglcontextlost',{cancelable:true})
    gpu.dispatchEvent(loss)
    expect(layer.dataset.flowRenderer).toBe('canvas')
    expect(gpu.hidden).toBe(true)
    expect(context.fillRect).toHaveBeenCalledWith(0,0,800,600)
    expect(gl.deleteShader).toHaveBeenCalledTimes(2)
    expect(gl.deleteProgram).toHaveBeenCalledOnce()
    expect(gl.deleteBuffer).toHaveBeenCalledOnce()
    flow.destroy();flow.destroy()
    expect(gl.deleteShader).toHaveBeenCalledTimes(2)
  })
  it('honors reduced motion, supports explicit pause and removes its canvas on unmount', () => {
    let reduced = true
    const media = new EventTarget()
    Object.defineProperty(media, 'matches', { get: () => reduced })
    vi.stubGlobal('matchMedia', () => media)
    const raf = vi.fn(() => 1), cancel = vi.fn()
    vi.stubGlobal('requestAnimationFrame', raf); vi.stubGlobal('cancelAnimationFrame', cancel)
    const background = resolveQuantSkillsBackground('dark','launch','motion-minimal-blue')
    function Demo() { useAnimatedBackground(true, background); return null }
    const view = render(<Demo/>)
    expect(document.querySelector('[data-qs-motion]')?.getAttribute('data-playing')).toBe('false')
    expect(raf).not.toHaveBeenCalled()
    act(() => { reduced = false; media.dispatchEvent(new Event('change')) })
    expect(raf).toHaveBeenCalled()
    const existingLayer = document.querySelector('[data-qs-motion]')
    act(() => setBackgroundMotion(false))
    expect(document.querySelector('[data-qs-motion]')).toBe(existingLayer)
    expect(document.querySelector('[data-qs-motion]')?.getAttribute('data-playing')).toBe('false')
    view.unmount()
    expect(document.querySelector('[data-qs-motion]')).toBeNull()
    expect(cancel).toHaveBeenCalled()
  })
})
