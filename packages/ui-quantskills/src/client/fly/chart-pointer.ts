type ChartViewport = { element: HTMLElement; width: number; height: number }

/** ECharts/zrender reads native offsetX/Y, which Chromium scales with CSS zoom.
 * Convert viewport coordinates to chart units before zrender normalizes the
 * event. Keep its wheel/button handling intact, and remeasure after scrolling,
 * resizing or changing the interface scale. Device pixels are not chart units.
 */
export function installChartPointerCoordinates(host: HTMLElement, viewport: () => ChartViewport) {
  const events = ['mousemove', 'mousedown', 'mouseup', 'mouseout', 'pointermove', 'pointerdown',
    'pointerup', 'pointerout', 'click', 'dblclick', 'contextmenu', 'wheel', 'mousewheel'] as const
  const normalize = (event: Event) => {
    const mouse = event as MouseEvent
    if (!Number.isFinite(mouse.clientX) || !Number.isFinite(mouse.clientY)) return
    const { element, width, height } = viewport(), rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0 || width <= 0 || height <= 0) return
    // Use offsets rather than zrX/Y: pre-populating zrX skips zrender's wheel
    // delta and button normalization. Native touch events use its DOM transform.
    Object.defineProperties(event, {
      offsetX: { configurable: true, value: (mouse.clientX - rect.left) * width / rect.width },
      offsetY: { configurable: true, value: (mouse.clientY - rect.top) * height / rect.height },
    })
  }
  for (const name of events) host.addEventListener(name, normalize, { capture: true, passive: true })
  return () => { for (const name of events) host.removeEventListener(name, normalize, true) }
}
