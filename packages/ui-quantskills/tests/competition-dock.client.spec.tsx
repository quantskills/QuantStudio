// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { CompetitionDock } from '../src/client/CompetitionDock.tsx'

afterEach(() => { cleanup(); localStorage.clear() })
it.each(['contest', 'factor-contest'] as const)('%s folds details while preserving plan access and unfinished input', kind => {
  const openPlans = vi.fn()
  const view = () => <CompetitionDock kind={kind} label="比赛信息" title="账户主对话" subtitle="账户 1"
    actions={<button onClick={openPlans}>计划（1）</button>}><input aria-label="研究品种" defaultValue="rb2610"/></CompetitionDock>
  const mounted = render(view())
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'au2612' } })
  const collapse = screen.getByRole('button', { name: '收起比赛信息' })
  const body = document.getElementById(collapse.getAttribute('aria-controls')!)!
  fireEvent.click(collapse)
  expect(body.hidden).toBe(true)
  expect(screen.queryByRole('textbox')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '计划（1）' }))
  expect(openPlans).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: '展开比赛信息' }))
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('au2612')
  fireEvent.click(screen.getByRole('button', { name: '收起比赛信息' }))
  mounted.unmount()
  render(view())
  expect(screen.getByRole('button', { name: '展开比赛信息' }).getAttribute('aria-expanded')).toBe('false')
  expect(localStorage.getItem(`quantskills:${kind === 'contest' ? 'factor-contest' : 'contest'}:dock-collapsed`)).toBeNull()
})
