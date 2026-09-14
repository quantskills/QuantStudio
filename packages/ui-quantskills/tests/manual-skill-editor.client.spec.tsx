// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ManualSkillEditor } from '../src/client/ManualSkillEditor.tsx'
afterEach(cleanup)
it('saves a manual declaration without an AI call and prevents duplicate submission', async () => {
  let done!: (value: { assetId: string }) => void
  const save = vi.fn(() => new Promise<{ assetId: string }>(resolve => { done = resolve }))
  const onSaved = vi.fn()
  render(<ManualSkillEditor save={save} onSaved={onSaved} onClose={vi.fn()} />)
  const form = screen.getByLabelText('技能声明 · SKILL.md').closest('form')!
  fireEvent.submit(form); fireEvent.submit(form)
  expect(save).toHaveBeenCalledTimes(1)
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ mode: 'create', markdown: expect.stringContaining('name: skill-user-') }))
  done({ assetId: 'skill-new' })
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith('skill-new'))
})
it('preserves a conflicting edit draft and never falls back to create', async () => {
  const save = vi.fn(async () => { throw new Error('版本冲突，请核对') })
  render(<ManualSkillEditor source={{ name: '个人技能', versionId: 'skill-test@v1' as never, personal: true, read: async () => 'original' }} save={save} onSaved={vi.fn()} onClose={vi.fn()} />)
  await screen.findByDisplayValue('original')
  fireEvent.change(screen.getByLabelText('技能声明 · SKILL.md'), { target: { value: 'modified draft' } })
  fireEvent.click(screen.getByRole('button', { name: '保存新版本' }))
  await screen.findByText('版本冲突，请核对')
  expect(screen.getByDisplayValue('modified draft')).toBeTruthy()
  expect(save).toHaveBeenCalledWith({ mode: 'edit', sourceVersionId: 'skill-test@v1', markdown: 'modified draft' })
})
it('requires an explicit discard of changed text and makes no write on cancel', () => {
  const save = vi.fn(), close = vi.fn()
  render(<ManualSkillEditor save={save} onSaved={vi.fn()} onClose={close} />)
  fireEvent.change(screen.getByLabelText('技能声明 · SKILL.md'), { target: { value: 'draft' } })
  fireEvent.click(screen.getByRole('button', { name: '取消' }))
  expect(screen.getByRole('dialog', { name: '放弃未保存的修改？' })).toBeTruthy()
  expect(close).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '放弃修改' }))
  expect(close).toHaveBeenCalledTimes(1); expect(save).not.toHaveBeenCalled()
})
it('does not save the template when reading the original version fails', async () => {
  const save = vi.fn()
  render(<ManualSkillEditor source={{ name: '原版本', versionId: 'id' as never, personal: false, read: async () => { throw new Error('读取失败') } }} save={save} onSaved={vi.fn()} onClose={vi.fn()} />)
  await screen.findByRole('alert')
  expect((screen.getByRole('button', { name: '保存到我的创建' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.submit(screen.getByLabelText('技能声明 · SKILL.md').closest('form')!)
  expect(save).not.toHaveBeenCalled()
})
