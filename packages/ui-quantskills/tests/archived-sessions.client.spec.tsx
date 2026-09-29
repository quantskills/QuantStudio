// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { ArchivedSessions, DeleteSessionConfirmation, SessionHistoryMenu, type ArchivedSession, type SessionHistoryAccess, type SessionFileDeletionAccess } from '../src/client/ArchivedSessions.tsx'
import { SessionActionsMenu } from '../src/client/SessionActionsMenu.tsx'

afterEach(cleanup)
const rows: ArchivedSession[] = ['plain', 'skill', 'agent', 'team'].map((kind, index) => ({
  sessionId: `archived-${index}` as SessionId, title: ['市场复盘', '因子挖掘', '研究专家', '投研团队'][index]!,
  kind: kind as ArchivedSession['kind'], updatedAt: Date.now() - index * 1000, running: false,
}))
function access(): SessionHistoryAccess {
  return { list: vi.fn(async () => rows), restore: vi.fn(async () => {}), remove: vi.fn(async () => {}), archive: vi.fn(async () => {}) }
}
describe('archived conversations', () => {
  it('defaults to session-only deletion without invoking generated-file cleanup', () => {
    const files: SessionFileDeletionAccess = { preview: vi.fn(), remove: vi.fn() }
    const normalRemove = vi.fn()
    render(<DeleteSessionConfirmation title="报告" busy={false} ids={[rows[0]!.sessionId]} filesAccess={files} onClose={vi.fn()} onConfirm={normalRemove}/>)
    const primary = screen.getByRole('button', { name: '会话删除', exact: true })
    expect(document.activeElement).toBe(primary)
    expect(screen.queryByRole('button', { name: '确认完整删除' })).toBeNull()
    fireEvent.click(primary)
    expect(normalRemove).toHaveBeenCalledOnce()
    expect(files.preview).not.toHaveBeenCalled()
    expect(files.remove).not.toHaveBeenCalled()
  })
  it('previews generated files before full deletion and does not delete when cancelled', async () => {
    const selection = [{ sessionId: rows[0]!.sessionId, token: 'reviewed-files', files: [{ path: 'C:/workspace/output/report.html', bytes: 100 }], retained: [{ path: 'C:/workspace/input.csv', reason: '输入文件，保留' }] }]
    const files: SessionFileDeletionAccess = { preview: vi.fn(async () => selection), remove: vi.fn(async () => {}) }
    const close = vi.fn(), normalRemove = vi.fn()
    const props = { title: '报告会话', busy: false, ids: [rows[0]!.sessionId], filesAccess: files, onClose: close, onConfirm: normalRemove }
    const ui = render(<DeleteSessionConfirmation {...props}/>)
    fireEvent.click(screen.getByRole('button', { name: '完整删除', exact: true }))
    await screen.findByText('C:/workspace/output/report.html')
    expect(screen.getByRole('dialog').textContent).toContain('文件删除后无法恢复')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '返回', exact: true }))
    expect(files.remove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '取消', exact: true }))
    expect(close).toHaveBeenCalledOnce()
    expect(files.remove).not.toHaveBeenCalled()
    ui.unmount(); render(<DeleteSessionConfirmation {...props}/>)
    fireEvent.click(screen.getByRole('button', { name: '完整删除', exact: true }))
    fireEvent.click(await screen.findByRole('button', { name: '确认完整删除' }))
    await waitFor(() => expect(files.remove).toHaveBeenCalledWith(selection))
    expect(normalRemove).not.toHaveBeenCalled()
  })
  it('keeps full-delete failures visible and requires a fresh preview before retrying', async () => {
    const files: SessionFileDeletionAccess = { preview: vi.fn(async () => [{ sessionId: rows[0]!.sessionId, token: 'old', files: [], retained: [] }]), remove: vi.fn(async () => { throw new Error('文件已变化，请重新预览完整删除。') }) }
    const close = vi.fn()
    render(<DeleteSessionConfirmation title="报告" busy={false} ids={[rows[0]!.sessionId]} filesAccess={files} onClose={close} onConfirm={vi.fn()}/>)
    fireEvent.click(screen.getByRole('button', { name: '完整删除', exact: true }))
    fireEvent.click(await screen.findByRole('button', { name: '确认完整删除' }))
    expect((await screen.findByRole('alert')).textContent).toContain('文件已变化')
    expect(screen.queryByRole('button', { name: '确认完整删除' })).toBeNull()
    expect(screen.getByRole('button', { name: '完整删除', exact: true })).toBeTruthy()
    expect(close).not.toHaveBeenCalled()
  })
  it('lists all conversation types, searches, restores and refreshes the list', async () => {
    const api = access(); render(<ArchivedSessions access={api}/>)
    await screen.findByText('投研团队')
    fireEvent.change(screen.getByRole('textbox', { name: '搜索归档会话' }), { target: { value: '研究专家' } })
    expect(screen.queryByText('市场复盘')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '恢复 研究专家' }))
    await waitFor(() => expect(api.restore).toHaveBeenCalledWith(rows[2]!.sessionId))
    await screen.findByText('已恢复，可在会话列表继续原来的对话。')
    expect(screen.queryByText('研究专家')).toBeNull()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } })
    expect(screen.getByText('市场复盘')).toBeTruthy()
  })
  it('permanent delete requires confirmation and retains the dialog after a failure', async () => {
    const api = access(); vi.mocked(api.remove).mockRejectedValueOnce(new Error('磁盘忙'))
    render(<ArchivedSessions access={api}/>)
    fireEvent.click(await screen.findByRole('button', { name: '会话删除 市场复盘' }))
    expect(api.remove).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('无法恢复')
    fireEvent.click(within(dialog).getByRole('button', { name: '会话删除', exact: true }))
    await screen.findByText('磁盘忙')
    expect(screen.getByText('市场复盘')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: '会话删除', exact: true }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.queryByText('市场复盘')).toBeNull()
    expect(api.archive).not.toHaveBeenCalled()
  })
  it('confirms archive, supports cancellation and preserves a failed confirmation for retry', async () => {
    const api = access(); render(<SessionHistoryMenu id={rows[0]!.sessionId} title="市场复盘" running={false} access={api}/>)
    fireEvent.click(screen.getByRole('button', { name: '会话操作 市场复盘' }))
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '会话操作 市场复盘' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '归档会话 市场复盘' }))
    expect(api.archive).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog').textContent).toContain('设置 → 归档会话')
    fireEvent.click(screen.getByRole('button', { name: '取消', exact: true }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.archive).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '会话操作 市场复盘' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '归档会话 市场复盘' }))
    vi.mocked(api.archive).mockRejectedValueOnce(new Error('归档失败'))
    fireEvent.click(screen.getByRole('button', { name: '确认归档' }))
    await screen.findByRole('alert')
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '确认归档' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(api.archive).toHaveBeenCalledWith([rows[0]!.sessionId]))
    expect(api.archive).toHaveBeenCalledTimes(2)
    expect(api.remove).not.toHaveBeenCalled()
  })
  it('supports keyboard dismissal and keeps running conversations protected inside the menu', () => {
    const rename = vi.fn(), archive = vi.fn(), remove = vi.fn()
    render(<SessionActionsMenu title="运行中的研究" running onRename={rename} onArchive={archive} onRemove={remove}/>)
    const trigger = screen.getByRole('button', { name: '会话操作 运行中的研究' })
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(screen.getByRole<HTMLButtonElement>('menuitem', { name: '归档会话 运行中的研究' }).disabled).toBe(true)
    expect(screen.getByRole<HTMLButtonElement>('menuitem', { name: '删除会话 运行中的研究' }).disabled).toBe(true)
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: '重命名会话 运行中的研究' }))
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(archive).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
  })
})
