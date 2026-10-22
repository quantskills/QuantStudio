// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LegacyTeamRecovery } from '../src/client/LegacyTeamRecovery.tsx'
afterEach(cleanup)
it('only audits after opening and only delivers after a separate explicit continuation', async () => {
  const recover = vi.fn(async (_id: string, proceed: boolean) => ({ delivered: proceed ? 1 : 0, pending: proceed ? 0 : 1, uncertain: 1, unknownEvents: 0 }))
  const state = { order: ['lead'], byId: { lead: { id: 'lead', retainedBy: { mainView: true }, running: false,
    projectionValues: { quantSkillsAgentTeamSession: { teamId: 'team' } } } } }
  render(<LegacyTeamRecovery {...{ recover, useSessions: (pick: (value: unknown) => unknown) => pick(state) } as never}/>)
  expect(recover).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '旧团队消息' }))
  await waitFor(() => expect(recover).toHaveBeenCalledWith('lead', false))
  expect(recover).not.toHaveBeenCalledWith('lead', true)
  fireEvent.click(await screen.findByRole('button', { name: '继续待恢复消息' }))
  await waitFor(() => expect(recover).toHaveBeenCalledWith('lead', true))
  await waitFor(() => expect((screen.getByRole('button', { name: '继续待恢复消息' }) as HTMLButtonElement).disabled).toBe(true))
  expect(screen.getByText(/接收记录缺失/)).toBeTruthy()
})
