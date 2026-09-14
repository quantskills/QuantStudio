// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { QuantSkillsAuthoringCommitResult, SessionId } from '../src/client/plugin-types.ts'
import { AuthoringReview } from '../src/client/AuthoringReview.tsx'
import { bindSnapshotSelector } from './bind-snapshot.ts'

afterEach(cleanup)
const id = 'review-session' as SessionId
const draft = { kind: 'skill' as const, toolCallId: 'prepared', treeDigest: 'sha256:123', name: '研究助手', description: '生成每日研究报告', members: [] }
function setup(kind: 'skill' | 'agent' | 'agent-team' = 'skill', running = false) {
  const value = { ...draft, kind }
  const store = createSnapshotStore<SessionListState>({
    ids: [id], current: id, byId: { [id]: { id, displayTitle: '创作', blank: false, running, updatedAt: 1,
      projectionValues: { quantSkillsAuthoringPending: value } } },
    phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined,
  })
  const result = { kind: 'skill', version: { assetId: 'test' } } as QuantSkillsAuthoringCommitResult
  const commit = vi.fn(async () => result), start = vi.fn(async () => {}), focusComposer = vi.fn()
  const openLibrary = vi.fn()
  const mounted = render(<AuthoringReview openLibrary={openLibrary} useSessions={bindSnapshotSelector(store)} commit={commit} start={start} focusComposer={focusComposer}/>)
  const change = (pending: typeof value | null, active = false) => {
    act(() => { store.set({ ...store.getSnapshot(), byId: { [id]: { ...store.getSnapshot().byId[id]!, running: active,
      projectionValues: { quantSkillsAuthoringPending: pending } } } }) })
  }
  return { store, commit, start, focusComposer, change, mounted, value, openLibrary }
}
describe('final creation confirmation', () => {
  it.each(['skill', 'agent', 'agent-team'] as const)('automatically reviews %s after preparation, without tool history', kind => {
    const { commit } = setup(kind)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('button', { name: '确认生成', exact: true })).toBeTruthy()
    expect(commit).not.toHaveBeenCalled()
  })
  it('waits for generation to finish, and restores the same review when dismissed', () => {
    const { change, value } = setup('skill', true)
    expect(screen.queryByRole('dialog')).toBeNull()
    change(value)
    fireEvent.click(screen.getByRole('button', { name: '关闭确认生成技能' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '待确认 · 技能' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
  it('publishes once only on a click and does not start by default', async () => {
    const { commit, start, change, openLibrary } = setup()
    fireEvent.click(screen.getByRole('button', { name: '确认生成', exact: true }))
    await waitFor(() => { expect(commit).toHaveBeenCalledWith(id, draft.toolCallId, draft.treeDigest) })
    expect(start).not.toHaveBeenCalled()
    await waitFor(() => expect(openLibrary).toHaveBeenCalledWith('skill'))
    change(null)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('status').textContent).toContain('已生成')
  })
  it('keeps failed save recoverable and never starts an unsaved draft', async () => {
    const { commit, start } = setup()
    commit.mockRejectedValueOnce(new Error('草稿已变化，请重新准备'))
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: '生成并开始' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', '草稿已变化，请重新准备')
    expect(start).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
  it('retries a failed launch from the saved result, without publishing twice', async () => {
    const { commit, start, change, openLibrary } = setup()
    start.mockRejectedValueOnce(new Error('连接暂时不可用'))
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: '生成并开始' }))
    await screen.findByRole('alert')
    change(null)
    fireEvent.click(screen.getByRole('button', { name: '重试启动' }))
    await waitFor(() => { expect(start).toHaveBeenCalledTimes(2) })
    expect(commit).toHaveBeenCalledTimes(1)
  })
})
