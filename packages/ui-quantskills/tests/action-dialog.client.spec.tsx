// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ActionDialog } from '../src/client/ActionDialog.tsx'

afterEach(cleanup)

function setup(props: { drawer?: boolean; busy?: boolean } = { drawer: true }) {
  const onClose = vi.fn()
  render(<ActionDialog title="快速上手" onClose={onClose} {...props}><button>下一步</button></ActionDialog>)
  const dialog = screen.getByRole('dialog')
  // Physical viewport coordinates also cover a drawer rendered with the app's UI scaling.
  vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({ left: 600, right: 1000, top: 0, bottom: 800 } as DOMRect)
  return { dialog, onClose }
}

function press(target: Element, clientX: number, clientY = 300) {
  // jsdom has no PointerEvent constructor; React reads the same mouse coordinates from this event.
  fireEvent(target, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX, clientY }))
}

it('closes a drawer when clicking its backdrop', () => {
  const { dialog, onClose } = setup()
  press(dialog, 250)
  fireEvent.click(dialog, { clientX: 250, clientY: 300 })
  expect(onClose).toHaveBeenCalledTimes(1)
})

it('keeps dialog padding and content interactive without dismissing', () => {
  const { dialog, onClose } = setup()
  press(dialog, 610)
  fireEvent.click(dialog, { clientX: 610, clientY: 300 })
  const next = screen.getByRole('button', { name: '下一步' })
  press(next, 700)
  fireEvent.click(next, { clientX: 700, clientY: 300 })
  expect(onClose).not.toHaveBeenCalled()
})

it('does not dismiss when a drag starts inside or ends inside the drawer', () => {
  const { dialog, onClose } = setup()
  press(dialog, 700)
  fireEvent.click(dialog, { clientX: 250, clientY: 300 })
  press(dialog, 250)
  fireEvent.click(dialog, { clientX: 700, clientY: 300 })
  expect(onClose).not.toHaveBeenCalled()
})

it.each([{ drawer: true, busy: true }, { drawer: false }])('preserves busy and confirmation protection: %j', props => {
  const { dialog, onClose } = setup(props)
  press(dialog, 250)
  fireEvent.click(dialog, { clientX: 250, clientY: 300 })
  expect(onClose).not.toHaveBeenCalled()
})

it('ignores a cancelled pointer gesture', () => {
  const { dialog, onClose } = setup()
  press(dialog, 250)
  fireEvent.pointerCancel(dialog)
  fireEvent.click(dialog, { clientX: 250, clientY: 300 })
  expect(onClose).not.toHaveBeenCalled()
})

it('retains the native Escape cancel behavior', () => {
  const { dialog, onClose } = setup()
  fireEvent(dialog, new Event('cancel', { cancelable: true }))
  expect(onClose).toHaveBeenCalledTimes(1)
})
