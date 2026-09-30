// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { installChartPointerCoordinates } from '../src/client/fly/chart-pointer.ts'

function fixture(scale: number) {
  const host = document.createElement('div'), viewport = document.createElement('div'), canvas = document.createElement('canvas')
  host.append(viewport); viewport.append(canvas)
  let left = 140, top = 75, width = 600, height = 300
  vi.spyOn(viewport, 'getBoundingClientRect').mockImplementation(() => ({ left, top, width: width * scale, height: height * scale }) as DOMRect)
  const dispose = installChartPointerCoordinates(host, () => ({ element: viewport, width, height }))
  return { canvas, dispose,
    move: (x: number, y: number, type = 'pointermove') => {
      const event = new MouseEvent(type, { bubbles: true, clientX: left + x * scale, clientY: top + y * scale })
      canvas.dispatchEvent(event); return event
    },
    resize: () => { left = 51; top = -92; width = 850; height = 250; scale = 1.1 },
  }
}

describe('scaled chart hit testing', () => {
  it.each([.65, .8, 1, 1.25, 1.5, 2])('hits the same bar and vertical point at %s interface scale', scale => {
    const f = fixture(scale)
    // A user points at the sixth bar. zrender must receive chart coordinates,
    // not the smaller CSS-zoom offsets that previously selected the fifth bar.
    let hit = ''
    f.canvas.addEventListener('pointermove', e => { hit = `${Math.floor(e.offsetX / 100)}:${e.offsetY}` })
    f.move(550, 180)
    expect(hit).toBe('5:180')
    f.dispose()
  })

  it('remeasures both axes after scroll, resize and a scale change', () => {
    const f = fixture(.8)
    f.move(550, 180); f.resize()
    const moved = f.move(725, 225)
    expect(moved.offsetX).toBeCloseTo(725)
    expect(moved.offsetY).toBeCloseTo(225)
    f.dispose()
  })

  it.each(['mousedown', 'mouseup', 'click', 'dblclick', 'pointerdown', 'pointerup'])('normalizes %s for pie selection and slider dragging', type => {
    const f = fixture(.8), e = f.move(450, 280, type)
    expect(e.offsetX).toBe(450); expect(e.offsetY).toBe(280)
    expect(e.defaultPrevented).toBe(false)
    f.dispose()
  })

  it('preserves wheel delta and lets zrender perform its normal event normalization', () => {
    const f = fixture(.8), e = new WheelEvent('wheel', { bubbles: true, clientX: 500, clientY: 235, deltaY: 120, ctrlKey: true })
    f.canvas.dispatchEvent(e)
    expect(e.offsetX).toBe(450); expect(e.offsetY).toBe(200)
    expect(e.deltaY).toBe(120); expect(e.ctrlKey).toBe(true)
    expect('zrX' in e).toBe(false)
    expect(e.defaultPrevented).toBe(false)
    f.dispose()
  })

  it('removes capture listeners on chart disposal', () => {
    const f = fixture(.8)
    expect(f.move(450, 150).offsetX).toBe(450)
    f.dispose()
    const event = f.move(450, 150)
    expect(Object.hasOwn(event, 'offsetX')).toBe(false)
  })
})
