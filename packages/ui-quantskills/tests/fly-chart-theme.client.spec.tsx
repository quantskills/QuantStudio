// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useChartPalette } from '../src/client/fly/useChartPalette'

afterEach(() => { cleanup(); vi.restoreAllMocks(); document.body.removeAttribute('data-qs-preset') })

it('updates an already-mounted canvas palette when a QS ancestor changes theme', async () => {
  const color = { value: '#0067d9' }
  vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({ getPropertyValue: (key: string) => key === '--fv-lime' ? color.value : '' }) as CSSStyleDeclaration)
  function Sample() {
    const { ref, palette } = useChartPalette()
    return <section ref={ref}><output>{palette.equity}</output></section>
  }
  const { unmount } = render(<Sample />)
  await screen.findByText('#0067d9')
  act(() => { color.value = '#8fd6b8'; document.body.setAttribute('data-qs-preset', 'forest') })
  await waitFor(() => expect(screen.getByText('#8fd6b8')).toBeTruthy())
  const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect')
  unmount()
  expect(disconnect).toHaveBeenCalledOnce()
})
