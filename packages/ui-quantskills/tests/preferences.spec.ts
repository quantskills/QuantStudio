import { describe, expect, it, vi } from 'vitest'
import { QuantSkillsPreferences, type PreferencesTransport } from '../src/client/preferences.ts'

function host(writable = true) {
  let revision = 1
  const defaults = { colorScheme: 'dark', darkBackground: 'motion-minimal-blue' }
  let user: Record<string, unknown> = { favoriteAssetIds: ['my-expert'], defaultWorkspaceId: 'my-workspace' }
  const view = () => ({ ns: 'ui-quantskills', schema: {}, value: { ...defaults, ...user }, user: { ...user }, revision })
  const transport: PreferencesTransport = {
    describe: vi.fn(async () => ({ writable, namespaces: [view()] })),
    mutate: vi.fn(async (ns, ops, expected) => {
      expect(ns).toBe('ui-quantskills')
      if (expected !== revision) throw Object.assign(new Error('conflict'), { code: 'settings/conflict' })
      for (const op of ops) {
        expect(op.path).toHaveLength(1)
        if (op.op === 'set') user[op.path[0]!] = op.value
        else delete user[op.path[0]!]
      }
      revision++
      return view()
    }),
  }
  const create = () => new QuantSkillsPreferences<Record<string, unknown>>('ui-quantskills', transport, v => v.value as Record<string, unknown>)
  return { transport, create, view, edit: (patch: Record<string, unknown>) => { user = { ...user, ...patch }; revision++ } }
}

describe('authenticated QuantSkills preferences', () => {
  it('uses Host write capability and reads persisted choices in a fresh browser controller', async () => {
    const h = host(); const prefs = h.create()
    await prefs.reload()
    expect(prefs.getSnapshot()).toMatchObject({ status: 'ready', writable: true, mode: 'host' })
    await prefs.set('darkBackground', 'motion-minimal-jade')
    const nextBrowser = h.create(); await nextBrowser.reload()
    expect(nextBrowser.getSnapshot().value).toMatchObject({ darkBackground: 'motion-minimal-jade', favoriteAssetIds: ['my-expert'] })
  })

  it('honors an actually read-only Host', async () => {
    const h = host(false); const prefs = h.create(); await prefs.reload()
    await expect(prefs.set('colorScheme', 'light')).rejects.toThrow('read-only')
    expect(h.transport.mutate).not.toHaveBeenCalled()
    expect(prefs.getSnapshot().writable).toBe(false)
  })

  it('serializes a complete theme change and does not overwrite custom preferences', async () => {
    const h = host(); const prefs = h.create(); await prefs.reload()
    const listener = vi.fn(); prefs.subscribe(listener)
    await Promise.all([prefs.set('colorScheme', 'light'), prefs.set('lightBackground', 'water'), prefs.set('interfaceScale', 0.9)])
    expect(prefs.getSnapshot().value).toMatchObject({ colorScheme: 'light', lightBackground: 'water', interfaceScale: 0.9, defaultWorkspaceId: 'my-workspace', favoriteAssetIds: ['my-expert'] })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('reloads after a concurrent user edit and retries only the selected field', async () => {
    const h = host(); const prefs = h.create(); await prefs.reload()
    h.edit({ favoriteAssetIds: ['team-added-expert'], darkBackground: 'other-theme' })
    await prefs.set('interfaceScale', 1.1)
    expect(h.transport.mutate).toHaveBeenCalledTimes(2)
    expect(prefs.getSnapshot().value).toMatchObject({ favoriteAssetIds: ['team-added-expert'], darkBackground: 'other-theme', interfaceScale: 1.1 })
  })

  it('clears a field without replacing the namespace or its other fields', async () => {
    const h = host(); const prefs = h.create(); await prefs.reload()
    await prefs.unset('defaultWorkspaceId')
    expect(prefs.getSnapshot().value).not.toHaveProperty('defaultWorkspaceId')
    expect(prefs.getSnapshot().value?.favoriteAssetIds).toEqual(['my-expert'])
  })

  it('rolls back a rejected write, reports the failure, and permits a later successful save', async () => {
    const h = host(); const prefs = h.create(); await prefs.reload()
    vi.mocked(h.transport.mutate).mockRejectedValueOnce(new Error('HTTP 503'))
    await expect(prefs.set('colorScheme', 'light')).rejects.toThrow('HTTP 503')
    expect(h.transport.mutate).toHaveBeenCalledTimes(1)
    expect(prefs.getSnapshot()).toMatchObject({ value: { colorScheme: 'dark' }, error: expect.stringContaining('未保存') })
    await prefs.set('colorScheme', 'light')
    expect(prefs.getSnapshot().error).toBeUndefined()
  })

  it('coalesces invalidations and recovers an unavailable connection without granting write access', async () => {
    const h = host(); const prefs = h.create()
    vi.mocked(h.transport.describe).mockRejectedValueOnce(new Error('HTTP 401'))
    await Promise.all([prefs.reload(), prefs.reload()])
    expect(h.transport.describe).toHaveBeenCalledTimes(1)
    expect(prefs.getSnapshot()).toMatchObject({ status: 'unavailable', writable: false })
    await prefs.reload()
    expect(prefs.getSnapshot().status).toBe('ready')
  })

  it('rejects invalid namespace content and stops requests after disposal', async () => {
    const h = host()
    const prefs = new QuantSkillsPreferences('ui-quantskills', h.transport, () => undefined)
    await prefs.reload()
    expect(prefs.getSnapshot()).toMatchObject({ status: 'unavailable', writable: false })
    await prefs.dispose(); await prefs.reload(); await prefs.set('colorScheme', 'light')
    expect(h.transport.describe).toHaveBeenCalledTimes(1)
    expect(h.transport.mutate).not.toHaveBeenCalled()
  })
})
