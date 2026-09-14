// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import type {
  QuantSkillsAssetId, QuantSkillsCommitSha, QuantSkillsFrequentSkill,
  QuantSkillsInstalledVersionId, QuantSkillsPlainSessionArchiveItem,
  QuantSkillsSessionArchiveItem, QuantSkillsSessionCreateRequest,
  QuantSkillsSessionCreateResult, QuantSkillsTreeDigest,
} from '@deepseek-ai/dsh-api-remotes/client'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import {
  QuantSkillsSessionsController, type QuantSkillsSessionsPort,
} from '../src/client/sessions.ts'

const ASSET_ID = 'skill-five-day-momentum' as QuantSkillsAssetId
const VERSION_ID = 'skill-five-day-momentum@aaaaaaaaaaaa' as QuantSkillsInstalledVersionId
const COMMIT = 'a'.repeat(40) as QuantSkillsCommitSha
const TREE_DIGEST = 'b'.repeat(64) as QuantSkillsTreeDigest
const SESSION_ID = 'session-bound' as SessionId
const OTHER_SESSION_ID = 'session-ordinary' as SessionId

const binding = { assetId: ASSET_ID, versionId: VERSION_ID, commit: COMMIT, treeDigest: TREE_DIGEST }
const archive: QuantSkillsSessionArchiveItem = {
  sessionId: SESSION_ID,
  binding,
  createdAt: 1,
  updatedAt: 2,
  title: '五日动量研究',
  archived: false,
  running: true,
  runState: 'running',
}
const plainArchive: QuantSkillsPlainSessionArchiveItem = {
  sessionId: OTHER_SESSION_ID,
  binding: { purpose: 'ordinary' },
  createdAt: 1,
  updatedAt: 3,
  title: '普通研究会话',
  archived: false,
  running: false,
  runState: 'idle',
}
const frequent: QuantSkillsFrequentSkill = {
  assetId: ASSET_ID,
  sessionCount: 1,
  lastUsedAt: 2,
  recentSessionId: SESSION_ID,
}
const created: QuantSkillsSessionCreateResult = { sessionId: SESSION_ID, binding }

function port(overrides: Partial<QuantSkillsSessionsPort> = {}): QuantSkillsSessionsPort {
  return {
    plainList: vi.fn(async () => [plainArchive]),
    list: vi.fn(async () => [archive]),
    frequent: vi.fn(async () => [frequent]),
    create: vi.fn(async () => created),
    ...overrides,
  }
}

describe('QuantSkillsSessionsController', () => {
  it('projects Host-returned ordinary and 技能-bound archives with frequent Skills', async () => {
    const remote = port()
    const controller = new QuantSkillsSessionsController(remote)

    await controller.refresh()

    expect(remote.plainList).toHaveBeenCalledOnce()
    expect(remote.list).toHaveBeenCalledOnce()
    expect(remote.frequent).toHaveBeenCalledOnce()
    expect(controller.source.getSnapshot()).toMatchObject({
      phase: 'ready',
      plainArchives: [plainArchive],
      archives: [archive],
      frequent: [frequent],
    })
    expect(JSON.stringify(controller.source.getSnapshot())).toContain(OTHER_SESSION_ID)
  })

  it('sends the exact create request and refreshes all projections after success', async () => {
    const remote = port()
    const controller = new QuantSkillsSessionsController(remote)
    const request: QuantSkillsSessionCreateRequest = { sessionId: SESSION_ID, versionId: VERSION_ID }

    await expect(controller.create(request)).resolves.toEqual(created)

    expect(remote.create).toHaveBeenCalledWith(request)
    expect(remote.plainList).toHaveBeenCalledOnce()
    expect(remote.list).toHaveBeenCalledOnce()
    expect(remote.frequent).toHaveBeenCalledOnce()
  })

  it('forwards one caller signal through create and the authoritative refresh', async () => {
    const remote = port()
    const controller = new QuantSkillsSessionsController(remote)
    const request: QuantSkillsSessionCreateRequest = { sessionId: SESSION_ID, versionId: VERSION_ID }
    const signal = new AbortController().signal

    await controller.create(request, signal)

    expect(remote.create).toHaveBeenCalledWith(request, signal)
    expect(remote.plainList).toHaveBeenCalledWith(signal)
    expect(remote.list).toHaveBeenCalledWith(signal)
    expect(remote.frequent).toHaveBeenCalledWith(signal)
  })

  it('propagates cancellation during the post-create projection refresh', async () => {
    const controller = new AbortController()
    const reason = new DOMException('plugin disposed', 'AbortError')
    const remote = port({
      list: vi.fn((signal?: AbortSignal) => new Promise<readonly QuantSkillsSessionArchiveItem[]>((_resolve, reject) => {
        signal?.addEventListener('abort', () => { reject(reason) }, { once: true })
      })),
    })
    const sessions = new QuantSkillsSessionsController(remote)
    const request: QuantSkillsSessionCreateRequest = { sessionId: SESSION_ID, versionId: VERSION_ID }

    const creating = sessions.create(request, controller.signal)
    controller.abort(reason)

    await expect(creating).rejects.toBe(reason)
    expect(sessions.source.getSnapshot()).toEqual({
      phase: 'loading',
      plainArchives: [],
      archives: [],
      frequent: [],
    })
  })

  it('retains the last Host projection as stale after a refresh failure', async () => {
    const list = vi.fn<QuantSkillsSessionsPort['list']>()
      .mockResolvedValueOnce([archive])
      .mockRejectedValueOnce(new Error('private Remote detail'))
    const controller = new QuantSkillsSessionsController(port({ list }))

    await controller.refresh()
    await controller.refresh()

    expect(controller.source.getSnapshot()).toMatchObject({
      phase: 'stale',
      plainArchives: [plainArchive],
      archives: [archive],
      frequent: [frequent],
      error: '无法从宿主读取 QuantSkills 会话，请稍后重试。',
    })
    expect(JSON.stringify(controller.source.getSnapshot())).not.toContain('private Remote detail')
  })

  it('keeps an empty error state when no Host projection has succeeded', async () => {
    const controller = new QuantSkillsSessionsController(port({
      list: vi.fn(async () => { throw new Error('unavailable') }),
    }))

    await controller.refresh()

    expect(controller.source.getSnapshot()).toEqual({
      phase: 'error',
      plainArchives: [],
      archives: [],
      frequent: [],
      error: '无法从宿主读取 QuantSkills 会话，请稍后重试。',
    })
  })
})
