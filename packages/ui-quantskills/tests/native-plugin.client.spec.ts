// @vitest-environment jsdom
/** Native-shell registration contract for the shared QuantSkills client. */

import { describe, expect, it, vi } from 'vitest'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  QuantSkillsAgentDefinition, QuantSkillsAgentId, QuantSkillsAgentTeamDefinition, QuantSkillsAgentTeamId,
} from '@deepseek-ai/dsh-api-remotes/client'
import type {
  QuantSkillsAppInjected, QuantSkillsPluginFrameInjected, QuantSkillsResultActionInjected,
  QuantSkillsResultInjected,
} from '../src/client/QuantSkillsApp.tsx'

vi.mock('@deepseek-ai/dsh-client-runtime/client', () => ({
  createSnapshotStore: <State,>(initial: State) => {
    let snapshot = initial
    const listeners = new Set<() => void>()
    return {
      getSnapshot: () => snapshot,
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
      set: (next: State) => {
        snapshot = next
        for (const listener of listeners) listener()
      },
    }
  },
  defineStore: <State, Actions extends Record<string, (draft: State, ...args: never[]) => void>>(spec: {
    init: () => State
    actions: Actions
  }) => ({
    create: () => {
      let snapshot = spec.init()
      const listeners = new Set<() => void>()
      const actions = Object.fromEntries(Object.entries(spec.actions).map(([name, action]) => [
        name,
        (...args: never[]) => {
          action(snapshot, ...args)
          snapshot = { ...snapshot }
          for (const listener of listeners) listener()
        },
      ]))
      return {
        store: {
          getSnapshot: () => snapshot,
          subscribe: (listener: () => void) => {
            listeners.add(listener)
            return () => { listeners.delete(listener) }
          },
        },
        actions,
      }
    },
  }),
  resolveWorkspacePath: (root: string, path: string) => `${root}\\${path}`,
}))
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  CodeBlock: () => null,
  MarkdownText: () => null,
  Menu: () => null,
}))
vi.mock('@deepseek-ai/dsh-client-ui-deliverables/client', () => ({
  producedForClosing: () => false,
}))

import { apply } from '../src/client/index.ts'

describe('QuantSkills native application composition', () => {
  it('adds the launcher and adopts a Host-known archive without closing the workbench', async () => {
    const lead: QuantSkillsAgentDefinition = {
      agentId: 'agent-lead' as QuantSkillsAgentId,
      revision: 1,
      name: 'Lead',
      role: '协调团队交付。',
      mode: 'dynamic',
      model: { provider: 'legacy-provider', model: 'legacy-model' },
      permission: 'workspace-write',
      skills: [],
      createdAt: 1,
      updatedAt: 1,
    }
    const member: QuantSkillsAgentDefinition = {
      ...lead,
      agentId: 'agent-member' as QuantSkillsAgentId,
      name: 'Member',
    }
    const fixedTeam: QuantSkillsAgentTeamDefinition = {
      teamId: 'agent-team-11111111-1111-4111-8111-111111111111' as QuantSkillsAgentTeamId,
      revision: 1,
      name: 'Team',
      description: '完成可复核交付。',
      lead,
      leadModel: {
        kind: 'fixed',
        selection: { provider: 'team-provider', model: 'team-model', reasoningEffort: 'high' },
      },
      members: [{ name: 'member', context: 'fresh', agent: member, model: { kind: 'default' } }],
      createdAt: 1,
      updatedAt: 1,
    }
    let activeTeam = fixedTeam
    const registrations: {
      readonly name: string
      readonly id?: string
      readonly order?: number
      readonly inject?: (() => unknown)
    }[] = []
    const injected: string[] = []
    const effects: { apply: () => void | (() => void); description?: string }[] = []
    const workspaceResolve = vi.fn(async () => ({
      ok: true as const,
      value: {
        workspace: { workspaceId: 'workspace-managed', path: 'C:\\Users\\test\\Documents\\QuantSkills', title: 'QuantSkills' },
        source: 'managed' as const,
        recoveredPreferredWorkspaceId: 'workspace-stale',
      },
    }))
    const sessionCreate = vi.fn(async (request: { readonly sessionId: string }) => ({
      result: { ok: true as const, value: { sessionId: request.sessionId } },
    }))
    const plainSessionCreate = vi.fn(async () => ({
      ok: true as const,
      value: { sessionId: 'session-1' },
    }))
    const agentTeamSessionCreate = vi.fn(async () => ({
      ok: true as const, value: { sessionId: 'session-1', team: activeTeam },
    }))
    const sessionEnsure = vi.fn(async (request: { readonly sessionId: string }) => ({
      ok: true as const, value: { sessionId: request.sessionId },
    }))
    const selectModel = vi.fn(async () => ({ ok: true as const, value: { selected: undefined } }))
    const execute = vi.fn(async () => ({ ok: true as const, value: {} }))
    const prompt = vi.fn(async () => ({ ok: true as const, value: undefined }))
    const pandaConnected = {
      phase: 'connected' as const,
      lastFailure: null,
      dataReadiness: 'verified' as const,
      executionReadiness: 'ready' as const,
      updateAvailable: false,
      logoutSupported: false,
    }
    const slots = {
      spec: (name: string) => name === 'shell.overlay'
        ? { kind: 'list' as const, scope: 'root' as const }
        : undefined,
      inject: (name: string, register: () => void) => {
        injected.push(name)
        register()
      },
      register: (options: {
        name: string
        id?: string
        order?: number
        inject?: () => unknown
      }) => {
        registrations.push(options)
        return () => {}
      },
    }
    const remote = {
      $on: vi.fn(() => () => {}),
      quantSkills: {
        catalog: vi.fn(),
        list: vi.fn(),
        assetReadme: vi.fn(),
        installAsset: vi.fn(),
        catalogSyncStatus: vi.fn(async () => ({
          ok: true as const,
          value: { mode: 'manual' as const, state: 'idle' as const },
        })),
      },
      quantSkillsSessions: {
        sessionEnsure,
        plainSessionCreate,
        workspaceResolve,
        agentTeamSessionCreate,
        agentList: vi.fn(async () => ({ ok: true as const, value: [lead, member] })),
        agentSessionList: vi.fn(async () => ({ ok: true as const, value: [] })),
        agentTeamList: vi.fn(async () => ({ ok: true as const, value: [fixedTeam] })),
        agentTeamSessionList: vi.fn(async () => ({ ok: true as const, value: [] })),
      },
      commands: { execute },
      session: { selectModel },
    }
    const releaseSidebar = vi.fn()
    const claimSidebar = vi.fn(() => ({
      update: vi.fn(),
      setDragging: vi.fn(),
      release: releaseSidebar,
    }))
    const releaseDetails = vi.fn()
    const claimDetails = vi.fn(() => ({
      update: vi.fn(),
      setDragging: vi.fn(),
      release: releaseDetails,
    }))
    const releaseConversationTextScale = vi.fn()
    const claimConversationTextScale = vi.fn(() => ({
      update: vi.fn(),
      release: releaseConversationTextScale,
    }))
    const services = new Map<string, unknown>([
      ['connection', { api: { settings: {}, llm: {}, sessions: { create: sessionCreate, selectModel } }, isLoopback: true }],
      ['inputTriggers', { registerSource: vi.fn(() => () => {}) }],
      ['conversationArtifactPreview', { register: vi.fn(() => () => {}) }],
      ['layout', { claimSidebar, claimDetails, claimConversationTextScale }],
    ])
    const openSession = vi.fn()
    const settingsSet = vi.fn(async () => {})
    const settingsUnset = vi.fn(async () => {})
    const sessionSummary = {
      sessionId: 'session-1',
      projectionValues: {
        get quantSkillsAgentTeamSession() { return activeTeam },
      },
    }
    const ctx = {
      get: (name: string) => services.get(name),
      effect: vi.fn((applyEffect: () => void | (() => void), description?: string) => {
        effects.push({ apply: applyEffect, description })
      }),
      inject: vi.fn(),
      slots,
      remote,
      settingsScope: {
        bind: () => ({
          getSnapshot: () => ({ status: 'loading' as const, writable: false }),
          subscribe: vi.fn(() => () => {}),
          set: settingsSet,
          unset: settingsUnset,
        }),
      },
      sessions: {
        open: openSession,
        binding: () => ({ session: { prompt } }),
        list: {
          getSnapshot: () => ({ byId: { 'session-1': sessionSummary } }),
          subscribe: vi.fn(() => () => {}),
        },
      },
      workspaces: {
        list: {
          getSnapshot: () => ({
            items: [{ workspaceId: 'workspace-custom', path: 'D:\\Research', title: 'Research' }],
          }),
        },
      },
      conversationDeliverables: {},
    } as unknown as ClientContext

    apply(ctx)

    expect(registrations).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'shell.overlay', id: 'quantskills-application' }),
      expect.objectContaining({ name: 'sidebar.footer.action', id: 'quantskills-application', order: 10 }),
      expect.objectContaining({ name: 'conversation.input.left', id: 'quantskills-file-attachment', order: 30 }),
      expect.objectContaining({ name: 'conversation.input.overlay', id: 'quantskills-capability-picker', order: 20 }),
      expect.objectContaining({ name: 'conversation.input.left', id: 'quantskills-resident-capabilities', order: 40 }),
      expect.objectContaining({ name: 'conversation.session.header.actions', id: 'quantskills-results', order: 40 }),
      expect.objectContaining({ name: 'quantskills.results' }),
      expect.objectContaining({ name: 'quantskills.page' }),
      expect.objectContaining({ name: 'conversation.hero.identity' }),
      expect.objectContaining({ name: 'conversation.hero.accessory', id: 'quantskills-panda-mcp', order: 10 }),
      expect.objectContaining({ name: 'conversation.chat.turnStatus' }),
    ]))
    expect(registrations.some(registration => registration.name === 'root')).toBe(false)
    expect(registrations.some(registration => registration.name === 'sidebar.brand.mark')).toBe(false)
    expect(registrations.some(registration => registration.name === 'sidebar.brand.name')).toBe(false)
    expect(registrations.some(registration => registration.name === 'conversation.hero.brand.mark')).toBe(false)
    expect(injected).toContain('conversation.hero.identity')
    expect(injected).toContain('conversation.hero.accessory')
    expect(injected).toContain('conversation.chat.turnStatus')
    expect(injected).toContain('shell.overlay')
    expect(injected).toContain('sidebar.footer.action')

    const page = registrations.find(registration => registration.name === 'quantskills.page')
    const overlay = registrations.find(registration => registration.name === 'shell.overlay')
    const resultAction = registrations.find(registration => registration.name === 'conversation.session.header.actions' && registration.id === 'quantskills-results')
    const resultPanel = registrations.find(registration => registration.name === 'quantskills.results')
    const pageFace = page?.inject?.() as QuantSkillsAppInjected
    const overlayFace = overlay?.inject?.() as QuantSkillsPluginFrameInjected
    const resultActionFace = resultAction?.inject?.() as QuantSkillsResultActionInjected
    const resultPanelFace = (resultPanel?.inject as unknown as (
      sessionId: import('@deepseek-ai/dsh-client-runtime/client').SessionId,
    ) => QuantSkillsResultInjected)('session-1' as import('@deepseek-ai/dsh-client-runtime/client').SessionId)
    overlayFace.actions.openPlugin()
    overlayFace.actions.setDefaultWorkspaceId('workspace-stale')
    pageFace.openSession('session-1' as import('@deepseek-ai/dsh-client-runtime/client').SessionId)
    const sidebarClaim = overlayFace.claimSidebar({ width: 511, exclusive: true, onDisplaced: vi.fn() })
    const claim = overlayFace.claimDetails({ width: 560, exclusive: true, onDisplaced: vi.fn() })
    const scaleClaim = overlayFace.claimConversationTextScale(0.9)

    await vi.waitFor(() => {
      expect(sessionEnsure).toHaveBeenCalledWith(
        { sessionId: 'session-1' },
        expect.any(AbortSignal),
      )
    })
    await vi.waitFor(() => { expect(openSession).toHaveBeenCalledWith('session-1') })
    expect(claimSidebar).toHaveBeenCalledWith(expect.objectContaining({ width: 511, exclusive: true }))
    expect(claimDetails).toHaveBeenCalledWith(expect.objectContaining({ width: 560, exclusive: true }))
    expect(claimConversationTextScale).toHaveBeenCalledWith(0.9)
    const resultTrigger = { focus: vi.fn() } as unknown as HTMLElement
    resultActionFace.open(resultTrigger)
    expect(resultPanelFace.triggerRef.current).toBe(resultTrigger)
    expect(overlayFace.hooks.view.getSnapshot()).toMatchObject({
      pluginOpen: true,
      pluginConversationOpen: true,
      page: 'conversations',
    })
    overlayFace.actions.showPluginConversationIndex()
    resultActionFace.complete('session-1' as import('@deepseek-ai/dsh-client-runtime/client').SessionId)
    expect(resultPanelFace.triggerRef.current).toBeNull()
    expect(overlayFace.hooks.view.getSnapshot()).toMatchObject({
      pluginOpen: true,
      pluginConversationOpen: true,
      page: 'conversations',
    })
    claim.release()
    scaleClaim.release()
    expect(releaseDetails).toHaveBeenCalledOnce()
    expect(releaseConversationTextScale).toHaveBeenCalledOnce()
    await overlayFace.startSession()
    expect(workspaceResolve).toHaveBeenCalledWith({ preferredWorkspaceId: 'workspace-stale' })
    expect(settingsUnset).toHaveBeenCalledWith('defaultWorkspaceId')
    expect(settingsSet).not.toHaveBeenCalled()
    expect(plainSessionCreate).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'workspace-managed',
      purpose: 'ordinary',
    }), expect.any(AbortSignal))
    expect(plainSessionCreate.mock.calls[0]?.[0]).not.toHaveProperty('cwd')
    await vi.waitFor(() => {
      expect(sessionEnsure).toHaveBeenCalledTimes(1)
      expect(openSession).toHaveBeenCalledWith('session-1')
    })
    await pageFace.setDefaultWorkspace('workspace-custom')
    expect(settingsSet).toHaveBeenCalledWith('defaultWorkspaceId', 'workspace-custom')
    expect(overlayFace.hooks.view.getSnapshot().defaultWorkspaceId).toBe('workspace-custom')
    await pageFace.setDefaultWorkspace(undefined)
    expect(settingsUnset).toHaveBeenCalledTimes(2)
    expect(overlayFace.hooks.view.getSnapshot().defaultWorkspaceId).toBeUndefined()
    sidebarClaim.release()
    expect(releaseSidebar).toHaveBeenCalledOnce()
    expect(overlayFace.hooks.layout.getSnapshot().sidebarReservation).toBe(0)
    expect(overlayFace.hooks.view.getSnapshot()).toMatchObject({
      pluginOpen: true,
      pluginConversationOpen: true,
      page: 'conversations',
    })
    const startTeam = pageFace.startAgentTeamSession as unknown as (
      definition: QuantSkillsAgentTeamDefinition,
      initialTask?: string,
    ) => Promise<unknown>
    await startTeam(fixedTeam, '开始团队任务')
    expect(selectModel).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'team-provider',
      model: 'team-model',
      reasoningEffort: 'high',
    }))
    expect(selectModel.mock.invocationCallOrder[0]!).toBeLessThan(prompt.mock.invocationCallOrder[0]!)

    selectModel.mockClear()
    prompt.mockClear()
    agentTeamSessionCreate.mockImplementationOnce(async () => {
      activeTeam = { ...fixedTeam, revision: 2, leadModel: { kind: 'default' as const } }
      return {
        ok: true as const,
        value: { sessionId: 'session-1', team: activeTeam },
      }
    })
    await startTeam({ ...fixedTeam, revision: 2, leadModel: { kind: 'default' } }, '继续团队任务')
    expect(selectModel).not.toHaveBeenCalled()
    expect(prompt).toHaveBeenCalledOnce()
  })
})
