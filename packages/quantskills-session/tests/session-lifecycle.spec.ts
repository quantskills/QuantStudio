import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm, readFile, mkdir, writeFile, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { SessionId, SessionStore, type Session, type SessionHeader } from '@deepseek-ai/dsh-session'
import { AgentRegistry, type Agent } from '@deepseek-ai/dsh-agent'
import { SessionProjectionRegistry } from '@deepseek-ai/dsh-session-projection'
import { SessionProjectionCache } from '@deepseek-ai/dsh-session-projection-cache'
import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import SqliteSessionQueryEngine from '@deepseek-ai/dsh-session-query-sqlite'
import { Storage } from '@deepseek-ai/dsh-storage'
import * as StorageJson from '@deepseek-ai/dsh-storage-json'
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain'
import { WorkspaceRegistry } from '@deepseek-ai/dsh-workspace'
import LocalFileSystem from '@deepseek-ai/dsh-fs-local'
import { createMessage, createToolResultMessage, ToolCallId } from '@deepseek-ai/dsh-llm'
import { SessionLifecycle } from '../src/session-lifecycle.ts'

const contexts: Context[] = [], roots: string[] = []
afterEach(async () => {
  for (const ctx of contexts.splice(0).reverse()) await ctx.fiber.dispose()
  for (const root of roots.splice(0)) {
    if (!root.startsWith(join(tmpdir(), 'qs-session-lifecycle-'))) throw new Error('unexpected test cleanup path')
    await rm(root, { recursive: true, force: true })
  }
})

async function harness(home?: string) {
  const root = home ?? await mkdtemp(join(tmpdir(), 'qs-session-lifecycle-'))
  if (!home) roots.push(root)
  const ctx = new Context(); contexts.push(ctx)
  await ctx.plugin(SessionStore)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(LocalFileSystem, { cwd: root })
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root: join(root, 'domains') })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  await ctx.plugin(JsonlSessionPersistence, { root: join(root, 'sessions'), compression: 'none' })
  await ctx.plugin(SessionProjectionCache, { writeEveryEvents: 10, writeIntervalMs: 500 })
  await ctx.plugin(WorkspaceRegistry)
  await ctx.plugin(SqliteSessionQueryEngine, { path: join(root, 'search.sqlite') })
  const publish = async (session: Session) => {
    const agent = { id: session.id, session, status: 'idle' } as Agent
    const detachSession = ctx.sessions.enter(session), detachAgent = ctx.agents.enter(agent, undefined)
    ctx.sessions.announce(session); ctx.agents.announce(agent)
    return { agent, dispose: async () => { await ctx.sessions.flush(session); detachAgent(); detachSession() } }
  }
  ctx.agents.setFactory({
    createAgent: async (_ctx, options) => publish(ctx.sessions.prepare(options.sessionId, { meta: options.meta })),
    resume: async (_ctx, options) => {
      const preparation = await ctx.sessionPersistence.prepare(options.resumeSessionId)
      try { return await publish(preparation.session) } finally { preparation[Symbol.dispose]() }
    },
  })
  const create = async (id: string, meta: Partial<SessionHeader> = {}) => {
    const handle = await ctx.agents.create({ sessionId: SessionId(id), meta: { cwd: root, ...meta } })
    handle.agent.session.append('assistant/message', { turn: 1, step: 1, message: createMessage({
      role: 'assistant', content: [{ type: 'text', text: 'unique lifecycle research evidence' }],
      source: { kind: 'model', provider: 'test', model: 'test' },
    }) }, { surfaceOp: 'append' })
    await ctx.sessions.flush(handle.agent.session)
    return handle
  }
  const lifecycle = new SessionLifecycle(ctx, root); await lifecycle.ready
  return { root, ctx, create, lifecycle }
}
const owned = async () => {}

function declareFile(session: Session, path: string) {
  session.append('assistant/message', { turn: 1, step: 1, message: createMessage({ role: 'assistant',
    content: [{ type: 'text', text: `报告已生成：\`${path}\`` }], source: { kind: 'model', provider: 'test', model: 'test' },
  }) }, { surfaceOp: 'append' })
}
function writeEvidence(session: Session, path: string, operation = 'Created') {
  const callId = ToolCallId(`write-${session.events.length}`)
  session.append('tool/call', { turn: 1, step: 1, callId, name: 'write', arguments: JSON.stringify({ file_path: path, content: 'test report' }) })
  session.append('tool/result', { turn: 1, step: 1, message: createToolResultMessage({ callId, isError: false, content: [{ type: 'text', text: `<path>${path}</path>\n<type>file</type>\n<content>\n${operation} file\n</content>` }] }) }, { surfaceOp: 'append' })
}

describe('durable conversation lifecycle with the real DSH storage backends', () => {
  it('previews and permanently removes only reviewed generated files, including child results', async () => {
    const h = await harness(), main = await h.create('files-main', { createdAt: Date.now() - 2000 }), id = main.agent.id
    const child = await h.create('files-child', { parentSession: id, origin: 'subagent', createdAt: Date.now() - 1500 })
    const other = await h.create('files-other')
    await mkdir(join(h.root, 'output'))
    for (const name of ['report.html', 'child.csv', 'shared.csv', 'existing.csv', 'untouched.csv']) await writeFile(join(h.root, 'output', name), 'test report')
    await writeFile(join(h.root, 'input.txt'), 'keep input')
    declareFile(main.agent.session, 'output/report.html')
    writeEvidence(child.agent.session, 'output/child.csv')
    declareFile(main.agent.session, 'output/shared.csv'); declareFile(other.agent.session, 'output/shared.csv')
    writeEvidence(main.agent.session, 'output/existing.csv', 'Updated')
    declareFile(main.agent.session, 'output/existing.csv')
    declareFile(main.agent.session, 'input.txt')
    const preview = await h.lifecycle.preview(id, owned)
    expect(preview.files.map(file => file.path)).toEqual([join(h.root, 'output/child.csv'), join(h.root, 'output/report.html')])
    expect(preview.retained).toEqual(expect.arrayContaining([expect.objectContaining({ path: join(h.root, 'output/shared.csv') }), expect.objectContaining({ path: join(h.root, 'output/existing.csv') })]))
    expect(await readFile(join(h.root, 'output/report.html'), 'utf8')).toBe('test report')
    await h.lifecycle.run({ sessionId: id, action: 'delete', filesToken: preview.token }, owned)
    for (const name of ['report.html', 'child.csv']) await expect(readFile(join(h.root, 'output', name))).rejects.toMatchObject({ code: 'ENOENT' })
    for (const name of ['shared.csv', 'existing.csv', 'untouched.csv']) expect(await readFile(join(h.root, 'output', name), 'utf8')).toBe('test report')
    expect(await readFile(join(h.root, 'input.txt'), 'utf8')).toBe('keep input')
    expect(h.ctx.sessions.get(id)).toBeUndefined()
    expect(h.ctx.sessions.get(child.agent.id)).toBeUndefined()
    expect(h.ctx.sessions.get(other.agent.id)).toBeDefined()
  })

  it('does not erase any files or history when a reviewed file changes or a token addresses another session', async () => {
    const h = await harness(), main = await h.create('changing', { createdAt: Date.now() - 2000 }), other = await h.create('other')
    await mkdir(join(h.root, 'output'))
    for (const name of ['a.txt', 'b.txt']) { await writeFile(join(h.root, 'output', name), 'before'); declareFile(main.agent.session, `output/${name}`) }
    const preview = await h.lifecycle.preview(main.agent.id, owned)
    await expect(h.lifecycle.run({ sessionId: other.agent.id, action: 'delete', filesToken: preview.token }, owned)).rejects.toThrow('过期')
    await writeFile(join(h.root, 'output/b.txt'), 'changed by user')
    await expect(h.lifecycle.run({ sessionId: main.agent.id, action: 'delete', filesToken: preview.token }, owned)).rejects.toThrow('已变化')
    expect(await readFile(join(h.root, 'output/a.txt'), 'utf8')).toBe('before')
    expect(await readFile(join(h.root, 'output/b.txt'), 'utf8')).toBe('changed by user')
    expect(h.ctx.sessions.get(main.agent.id)).toBeDefined()
    await h.lifecycle.run({ sessionId: main.agent.id, action: 'delete' }, owned)
    expect(await readFile(join(h.root, 'output/a.txt'), 'utf8')).toBe('before')
  })

  it('excludes original files, directories, escaping paths and junction targets', async () => {
    const h = await harness()
    await mkdir(join(h.root, 'output')); await mkdir(join(h.root, 'outside'))
    await writeFile(join(h.root, 'output/original.txt'), 'original')
    await writeFile(join(h.root, 'outside/linked.txt'), 'linked')
    await symlink(join(h.root, 'outside'), join(h.root, 'output/link'), 'junction')
    const main = await h.create('unsafe', { createdAt: Date.now() + 1000 })
    for (const path of ['output/original.txt', 'output/link/linked.txt', '../outside.txt', 'output']) declareFile(main.agent.session, path)
    const preview = await h.lifecycle.preview(main.agent.id, owned)
    expect(preview.files).toEqual([])
    expect(preview.retained.map(file => file.reason).join(' ')).toContain('链接')
    await h.lifecycle.run({ sessionId: main.agent.id, action: 'delete', filesToken: preview.token }, owned)
    expect(await readFile(join(h.root, 'output/original.txt'), 'utf8')).toBe('original')
    expect(await readFile(join(h.root, 'outside/linked.txt'), 'utf8')).toBe('linked')
  })

  it('recovers full deletion after file cleanup succeeds but history removal is interrupted', async () => {
    const h = await harness(), main = await h.create('full-recovery', { createdAt: Date.now() - 2000 })
    await writeFile(join(h.root, 'created.txt'), 'test report'); writeEvidence(main.agent.session, 'created.txt')
    const preview = await h.lifecycle.preview(main.agent.id, owned)
    expect(preview.files).toHaveLength(1)
    const persistence = h.ctx.sessionPersistence as unknown as { deleteSession(id: SessionId): Promise<void> }
    const failure = vi.spyOn(persistence, 'deleteSession').mockRejectedValueOnce(new Error('disk busy'))
    await expect(h.lifecycle.run({ sessionId: main.agent.id, action: 'delete', filesToken: preview.token }, owned)).rejects.toThrow('disk busy')
    await expect(readFile(join(h.root, 'created.txt'))).rejects.toMatchObject({ code: 'ENOENT' })
    failure.mockRestore(); await h.ctx.fiber.dispose(); contexts.splice(contexts.indexOf(h.ctx), 1)
    const restarted = await harness(h.root)
    expect(await restarted.ctx.sessionPersistence.list()).toEqual([])
    await expect(readFile(join(h.root, 'created.txt'))).rejects.toMatchObject({ code: 'ENOENT' })
  })
  it('archives/restores the original identity and history across a restart', async () => {
    const h = await harness(), handle = await h.create('archive-real')
    const id = handle.agent.id, events = handle.agent.session.events
    await h.lifecycle.run({ sessionId: id, action: 'archive' }, owned)
    expect(h.ctx.workspaceRegistry.archivedSessionIds).toContain(id)
    await handle.dispose(); await h.ctx.fiber.dispose(); contexts.splice(contexts.indexOf(h.ctx), 1)
    const reopened = await harness(h.root)
    expect(reopened.ctx.workspaceRegistry.archivedSessionIds).toContain(id)
    await reopened.lifecycle.run({ sessionId: id, action: 'restore' }, owned)
    expect(reopened.ctx.workspaceRegistry.archivedSessionIds).not.toContain(id)
    expect((await reopened.ctx.sessionPersistence.inspect(id)).events).toEqual(events)
  })

  it('deletes live logs, child logs, cached history and search hits, preserving independent forks and files', async () => {
    const h = await harness(), main = await h.create('delete-real'), id = main.agent.id
    const child = await h.create('delete-child', { parentSession: id, origin: 'subagent' })
    const fork = await h.create('keep-fork', { parentSession: id })
    const path = h.ctx.sessionPersistence.locate(main.agent.session.header)!.path
    await writeFile(join(h.root, 'report.txt'), 'keep this work product')
    await h.ctx.sessionProjectionCache.write(main.agent.session)
    await h.ctx.sessionQuery.searchSessions({ query: 'lifecycle' })
    await h.lifecycle.run({ sessionId: id, action: 'archive' }, owned)
    await h.lifecycle.run({ sessionId: id, action: 'delete' }, owned)
    expect(h.ctx.agents.get(id)).toBeUndefined()
    expect(h.ctx.sessions.get(id)).toBeUndefined()
    expect(h.ctx.sessions.get(child.agent.id)).toBeUndefined()
    expect(h.ctx.sessions.get(fork.agent.id)).toBeDefined()
    await expect(readFile(path)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(h.ctx.sessionPersistence.inspect(id)).rejects.toThrow()
    expect(h.ctx.sessionProjectionCache.cachedSnapshot(main.agent.session.header)).toBeUndefined()
    expect((await h.ctx.sessionQuery.searchSessions({ query: 'lifecycle' })).items.map(item => item.header.id)).toEqual([fork.agent.id])
    expect(await readFile(join(h.root, 'report.txt'), 'utf8')).toBe('keep this work product')
    await h.ctx.fiber.dispose(); contexts.splice(contexts.indexOf(h.ctx), 1)
    const restarted = await harness(h.root)
    expect((await restarted.ctx.sessionPersistence.list()).map(item => item.id)).toEqual([fork.agent.id])
    expect(restarted.ctx.workspaceRegistry.archivedSessionIds).not.toContain(id)
  })

  it('refuses running/foreign sessions before changing anything', async () => {
    const h = await harness(), handle = await h.create('busy'), id = handle.agent.id
    Object.assign(handle.agent, { status: 'running' })
    await expect(h.lifecycle.run({ sessionId: id, action: 'delete' }, owned)).rejects.toThrow('正在运行')
    Object.assign(handle.agent, { status: 'idle' })
    await expect(h.lifecycle.run({ sessionId: id, action: 'delete' }, async () => { throw new Error('not owned') })).rejects.toThrow('not owned')
    expect(h.ctx.sessions.get(id)).toBeDefined()
    expect(h.ctx.workspaceRegistry.archivedSessionIds).not.toContain(id)
  })

  it('keeps the original teardown handle when a duplicate activation is rejected', async () => {
    const h = await harness(), handle = await h.create('same-id'), id = handle.agent.id
    await expect(h.create('same-id')).rejects.toThrow()
    await h.lifecycle.run({ sessionId: id, action: 'delete' }, owned)
    expect(h.ctx.sessions.get(id)).toBeUndefined()
    await expect(h.ctx.sessionPersistence.inspect(id)).rejects.toThrow()
    await expect(h.ctx.workspaceRegistry.restoreSession(id)).rejects.toThrow()
  })

  it('replays an interrupted deletion after restarting', async () => {
    const h = await harness(), handle = await h.create('pending-delete'), id = handle.agent.id
    await h.lifecycle.run({ sessionId: id, action: 'archive' }, owned)
    const cache = vi.spyOn(h.ctx.sessionProjectionCache, 'deleteSession').mockRejectedValueOnce(new Error('disk busy'))
    await expect(h.lifecycle.run({ sessionId: id, action: 'delete' }, owned)).rejects.toThrow('disk busy')
    expect(JSON.parse(await readFile(join(h.root, 'quantskills/pending-session-deletions.json'), 'utf8'))).toContain(id)
    cache.mockRestore()
    await h.ctx.fiber.dispose(); contexts.splice(contexts.indexOf(h.ctx), 1)
    const restarted = await harness(h.root)
    expect(await restarted.ctx.sessionPersistence.list()).toEqual([])
    expect(restarted.ctx.workspaceRegistry.archivedSessionIds).not.toContain(id)
  })
})
