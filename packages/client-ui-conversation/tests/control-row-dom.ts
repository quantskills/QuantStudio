/** jsdom font-loading events; layout tests drive their own measurements. */
import { beforeEach, afterEach, vi } from 'vitest'

const fonts = Object.getOwnPropertyDescriptor(document, 'fonts')
beforeEach(() => {
  // QS measures the composed toolbar; jsdom has no layout observer.
  vi.stubGlobal('ResizeObserver', class {
    constructor(private callback: ResizeObserverCallback) {}
    observe(target: Element) {
      this.callback([{
        target, borderBoxSize: [{ inlineSize: 100, blockSize: 20 }],
        contentBoxSize: [{ inlineSize: 100, blockSize: 20 }],
        contentRect: target.getBoundingClientRect(),
      } as ResizeObserverEntry], this as unknown as ResizeObserver)
    }
    unobserve() {}
    disconnect() {}
  })
  Object.defineProperty(document, 'fonts', { configurable: true, value: new EventTarget() })
})
afterEach(() => {
  vi.unstubAllGlobals()
  if (fonts === undefined) Reflect.deleteProperty(document, 'fonts')
  else Object.defineProperty(document, 'fonts', fonts)
})
