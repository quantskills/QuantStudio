import { describe, expect, it } from 'vitest'
import { computeColumns, applyColumnClaims, SIDEBAR_COLLAPSED } from './columns.ts'

function claimed(width: number, sidebar: number, rightbar: number) {
  return applyColumnClaims(width, computeColumns(width, 0, 0), { sidebarExclusive: true, sidebarReservation: sidebar, detailsExclusive: true, detailsReservation: rightbar })
}

describe('exclusive sidebar layout', () => {
  it.each([320, 390, 495, 768, 840])('gives a %i px mobile viewport entirely to the conversation', width => {
    expect(claimed(width, 0, 0)).toEqual({ sidebar: 0, center: width, rightbar: 0 })
  })
  it('preserves the native collapsed rail when no overlay owns it', () => {
    expect(computeColumns(390, 0, 0)).toEqual({ sidebar: SIDEBAR_COLLAPSED, center: 390 - SIDEBAR_COLLAPSED, rightbar: 0 })
  })
  it('restores the desktop reservation after rotating or widening the viewport', () => {
    expect(claimed(1440, 400, 500)).toEqual({ sidebar: 400, center: 540, rightbar: 500 })
    expect(claimed(390, 0, 0).center).toBe(390)
    expect(claimed(1440, 400, 0)).toEqual({ sidebar: 400, center: 1040, rightbar: 0 })
  })
})
