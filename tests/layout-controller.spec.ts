import { expect, it, vi } from 'vitest'
import { LayoutController, type PanelActions, type MainPanelId } from '../packages/client-ui-layout/src/client/service.ts'

function actions() {
  return {
    selectPanel: vi.fn(), openRightbar: vi.fn(), closeRightbar: vi.fn(), toggleSidebar: vi.fn(),
    setSidebarReservation: vi.fn(), setDetailsReservation: vi.fn(), setConversationTextScale: vi.fn(),
    setSidebarClaimState: vi.fn(), setDetailsClaimState: vi.fn(),
  }
}

it('reattaches navigation and column actions together while retaining temporary reservations', () => {
  const first = actions(), second = actions()
  const controller = new LayoutController(first as unknown as PanelActions, id => id === 'plugins', {} as never)
  const release = controller.reserveSidebar(240)
  const navigation = controller.beginNavigation()
  controller.attachPanels(second as unknown as PanelActions)
  controller.selectPanel('plugins' as MainPanelId)
  controller.openRightbar(true, false)
  controller.closeRightbar()
  expect(navigation.aborted).toBe(true)
  expect(first.selectPanel).not.toHaveBeenCalled()
  expect(first.openRightbar).not.toHaveBeenCalled()
  expect(first.closeRightbar).not.toHaveBeenCalled()
  expect(second.selectPanel).toHaveBeenCalledWith('plugins')
  expect(second.openRightbar).toHaveBeenCalledWith(true, false)
  expect(second.closeRightbar).toHaveBeenCalledOnce()
  expect(second.setSidebarReservation).toHaveBeenLastCalledWith(240)
  release()
  expect(second.setSidebarReservation).toHaveBeenLastCalledWith(0)
  expect(() => controller.selectPanel('missing' as MainPanelId)).toThrow('Unknown main panel')
})
