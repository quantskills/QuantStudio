import { describe, expect, it } from 'vitest'
import { computeColumns, SIDEBAR_COLLAPSED } from './columns.ts'

describe('exclusive sidebar layout', () => {
  it.each([320, 390, 495, 768, 840])('gives a %i px mobile viewport entirely to the conversation', width => {
    expect(computeColumns(width, 0, 0, 0, 0, true)).toEqual({ sidebar: 0, center: width, details: 0 })
  })
  it('preserves the native collapsed rail when no overlay owns it', () => {
    expect(computeColumns(390, 0, 0)).toEqual({ sidebar: SIDEBAR_COLLAPSED, center: 390 - SIDEBAR_COLLAPSED, details: 0 })
  })
  it('restores the desktop reservation after rotating or widening the viewport', () => {
    expect(computeColumns(1440, 0, 0, 400, 500, true)).toEqual({ sidebar: 400, center: 540, details: 500 })
    expect(computeColumns(390, 0, 0, 0, 0, true).center).toBe(390)
    expect(computeColumns(1440, 0, 0, 400, 0, true)).toEqual({ sidebar: 400, center: 1040, details: 0 })
  })
})
