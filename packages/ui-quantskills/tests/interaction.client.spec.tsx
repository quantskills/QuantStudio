// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionPendingInteractionSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {
  QuantSkillsAgentDefinition, QuantSkillsAgentId,
  QuantSkillsAgentTeamDefinition,
  QuantSkillsAgentTeamId, QuantSkillsAssetId, QuantSkillsCommitSha, QuantSkillsInstalledVersionId,
  QuantSkillsTreeDigest,
} from '@deepseek-ai/dsh-api-remotes/client'
import { bindSnapshotSelector } from './bind-snapshot.ts'
import {
  QuantSkillsApp, QuantSkillsAuthoringAction, QuantSkillsFrame, QuantSkillsRail,
  QuantSkillsPluginFrame,
  type QuantSkillsAppProps, type QuantSkillsFrameProps, type QuantSkillsPluginFrameProps,
  type QuantSkillsRailProps,
} from '../src/client/QuantSkillsApp.tsx'
import type { QuantSkillsApplicationUpdateStatus } from '../src/client/plugin-types.ts'
import {
  createQuantSkillsLayoutStore, createQuantSkillsNotificationStore, createQuantSkillsViewStore,
} from '../src/client/store.ts'
import { QuantSkillsTeamDraftCard } from '../src/client/QuantSkillsTeamDraftCard.tsx'
import type {
  PandaConnectionSnapshot, QuantSkillsAgentsSnapshot, QuantSkillsCatalogSnapshot,
  QuantSkillsSessionsSnapshot,
} from '../src/client/types.ts'
import {
  DEFAULT_QUANTSKILLS_AGENT_PERMISSION, DEFAULT_QUANTSKILLS_AUTO_CHECK_CATALOG,
  DEFAULT_QUANTSKILLS_AUTO_CHECK_PANDA, DEFAULT_QUANTSKILLS_DARK_BACKGROUND,
  DEFAULT_QUANTSKILLS_CONVERSATION_BRIGHTNESS,
  DEFAULT_QUANTSKILLS_LIGHT_BACKGROUND, DEFAULT_QUANTSKILLS_RESUME_AFTER_PANDA_LOGIN,
  type QuantSkillsSettings,
} from '../src/appearance-settings.ts'

vi.mock('@deepseek-ai/dsh-client-ui-deliverables/client', () => ({
  producedForClosing: (data: { readonly produced: readonly { readonly path: string }[] } | undefined) => {
    if (data === undefined) return []
    return [...new Set(data.produced.map(item => item.path))]
  },
}))

const BOUND_SESSION_ID = 'session-bound' as SessionId
const SECOND_BOUND_SESSION_ID = 'session-bound-second' as SessionId
const ORDINARY_SESSION_ID = 'session-ordinary' as SessionId
const ASSET_ID = 'skill-five-day-momentum' as QuantSkillsAssetId
const VERSION_ID = 'skill-five-day-momentum@aaaaaaaaaaaa' as QuantSkillsInstalledVersionId
const COMMIT = 'a'.repeat(40) as QuantSkillsCommitSha
const TREE_DIGEST = 'b'.repeat(64) as QuantSkillsTreeDigest
const AGENT_ID = 'agent-research' as QuantSkillsAgentId

const defaultSettings: QuantSkillsSettings = {
  interfaceScale: 1,
  conversationScale: 1,
  conversationBrightness: DEFAULT_QUANTSKILLS_CONVERSATION_BRIGHTNESS,
  colorScheme: 'light',
  lightBackground: DEFAULT_QUANTSKILLS_LIGHT_BACKGROUND,
  darkBackground: DEFAULT_QUANTSKILLS_DARK_BACKGROUND,
  autoCheckCatalog: DEFAULT_QUANTSKILLS_AUTO_CHECK_CATALOG,
  autoCheckPanda: DEFAULT_QUANTSKILLS_AUTO_CHECK_PANDA,
  resumeAfterPandaLogin: DEFAULT_QUANTSKILLS_RESUME_AFTER_PANDA_LOGIN,
  favoriteAssetIds: [],
  assetDisplayNameOverrides: [],
  defaultAgentProvider: '',
  defaultAgentModel: '',
  defaultAgentReasoningEffort: '',
  defaultAgentPermission: DEFAULT_QUANTSKILLS_AGENT_PERMISSION,
}

const catalog: QuantSkillsCatalogSnapshot = {
  phase: 'ready',
  installedPhase: 'ready',
  snapshotId: 'snapshot-1',
  categories: [{ id: '02', label: '因子研究', subcategories: [] }],
  assets: [{
    name: 'skill-five-day-momentum',
    title: '五日动量因子',
    catalogTitle: '五日动量因子',
    englishTitle: 'Five Day Momentum',
    aliases: ['动量因子'],
    nameSource: 'catalog',
    summary: '计算并验证五日动量',
    description: '公开的标准 QuantSkills 技能。',
    projectType: 'skill',
    category: '02',
    subcategory: '02.factor-generation',
    commitSha: 'a'.repeat(40),
    declarationFile: 'SKILL.md',
    url: 'https://github.com/quantskills/skill-five-day-momentum',
    health: 'healthy',
    validationLevel: 'verified',
    requires: [],
  }],
  versionsByAsset: {},
  installing: new Set(),
  refreshAfterMs: 300_000,
  sync: { mode: 'manual', state: 'idle' },
}

const catalogWithInstalled: QuantSkillsCatalogSnapshot = {
  ...catalog,
  versionsByAsset: {
    [ASSET_ID]: [{
      versionId: VERSION_ID,
      assetName: ASSET_ID,
      projectType: 'skill',
      commitSha: COMMIT,
      declarationFile: 'SKILL.md',
      installedAt: 1,
      exposure: 'skill-registry',
    }],
  },
}

const catalogWithAgentCategory: QuantSkillsCatalogSnapshot = {
  ...catalog,
  categories: [
    ...catalog.categories,
    { id: '10', label: '量化专家与自动化', subcategories: [] },
  ],
  assets: [
    ...catalog.assets,
    {
      name: 'agent-market-automation',
      title: '量化自动化研究专家',
      catalogTitle: '量化自动化研究专家',
      englishTitle: 'Quant Automation Research 专家',
      aliases: ['自动化专家'],
      nameSource: 'catalog',
      summary: '编排量化研究任务并交付可复核产物。',
      description: '公开的标准 QuantSkills 专家。',
      projectType: 'agent',
      category: '10',
      subcategory: '10.agent-automation',
      commitSha: 'c'.repeat(40),
      declarationFile: 'AGENTS.md',
      url: 'https://github.com/quantskills/agent-market-automation',
      health: 'healthy',
      validationLevel: 'verified',
      requires: [],
    },
  ],
}

const pandaReady: PandaConnectionSnapshot = {
  status: 'ready',
  credentialPersistence: 'os-keyring',
  reconnectState: 'idle',
  dataReadiness: 'unchecked',
  lastDataValidatedAt: null,
  executionReadiness: 'unchecked',
  executionIsolation: null,
  executionBackend: null,
  lastExecutionCheckedAt: null,
  lastFailure: null,
  requiredSdkVersion: '0.0.12',
  installedSdkVersion: '0.0.12',
  updateAvailable: false,
  logoutSupported: false,
}

const pandaConnected: PandaConnectionSnapshot = {
  ...pandaReady,
  status: 'connected',
  dataReadiness: 'verified',
  executionReadiness: 'ready',
  executionIsolation: 'partial',
  executionBackend: 'windows-acl',
  lastExecutionCheckedAt: 2,
}

const pandaLogoutReady: PandaConnectionSnapshot = {
  ...pandaConnected,
  logoutSupported: true,
}

const emptyBoundSessions: QuantSkillsSessionsSnapshot = {
  phase: 'ready',
  plainArchives: [],
  archives: [],
  frequent: [],
  refreshedAt: 1,
}

const emptyAgents: QuantSkillsAgentsSnapshot = {
  phase: 'ready',
  definitions: [],
  archives: [],
  teams: [],
  teamArchives: [],
  refreshedAt: 1,
}

const agentDefinition: QuantSkillsAgentDefinition = {
  agentId: AGENT_ID,
  revision: 1,
  name: '量化研究助理',
  role: '与用户对话后完成量化研究。',
  mode: 'dynamic',
  permission: 'workspace-write',
  skills: [{ assetId: ASSET_ID, versionId: VERSION_ID, commit: COMMIT, treeDigest: TREE_DIGEST }],
  createdAt: 1,
  updatedAt: 2,
}

const populatedAgents: QuantSkillsAgentsSnapshot = {
  phase: 'ready',
  definitions: [agentDefinition],
  archives: [{
    sessionId: 'session-agent' as SessionId,
    agent: agentDefinition,
    createdAt: 2,
    updatedAt: 3,
    title: '专家 动量研究',
    archived: false,
    running: false,
    runState: 'completed',
  }],
  teams: [],
  teamArchives: [],
  refreshedAt: 3,
}

const validatorAgentDefinition: QuantSkillsAgentDefinition = {
  ...agentDefinition,
  agentId: 'agent-validator' as QuantSkillsAgentId,
  name: '独立验证员',
  role: '独立复核研究结论、数据口径和风险。',
}

const agentTeamDefinition: QuantSkillsAgentTeamDefinition = {
  teamId: 'agent-team-11111111-1111-4111-8111-111111111111' as QuantSkillsAgentTeamId,
  revision: 1,
  name: '量化研究团队',
  description: '由 Lead 协调研究，成员独立验证后交付合并结论。',
  lead: agentDefinition,
  leadModel: { kind: 'fixed', selection: { provider: 'deepseek-official', model: 'deepseek-v4-pro', reasoningEffort: 'high' } },
  members: [{ name: 'validator', context: 'fresh', agent: validatorAgentDefinition, model: { kind: 'default' } }],
  createdAt: 4,
  updatedAt: 4,
}

const agentTeamReadyAgents: QuantSkillsAgentsSnapshot = {
  phase: 'ready',
  definitions: [agentDefinition, validatorAgentDefinition],
  archives: [],
  teams: [],
  teamArchives: [],
  refreshedAt: 4,
}

const populatedBoundSessions: QuantSkillsSessionsSnapshot = {
  phase: 'ready',
  plainArchives: [],
  archives: [{
    sessionId: BOUND_SESSION_ID,
    binding: { assetId: ASSET_ID, versionId: VERSION_ID, commit: COMMIT, treeDigest: TREE_DIGEST },
    createdAt: 1,
    updatedAt: 2,
    title: '五日动量研究',
    archived: false,
    running: true,
    runState: 'running',
  }],
  frequent: [{ assetId: ASSET_ID, sessionCount: 1, lastUsedAt: 2, recentSessionId: BOUND_SESSION_ID }],
  refreshedAt: 2,
}

const multiArchiveSessions: QuantSkillsSessionsSnapshot = {
  ...populatedBoundSessions,
  archives: [
    ...populatedBoundSessions.archives,
    {
      ...populatedBoundSessions.archives[0]!,
      sessionId: SECOND_BOUND_SESSION_ID,
      title: '五日动量复盘',
      updatedAt: 3,
      running: false,
      runState: 'completed',
    },
  ],
  frequent: [{
    ...populatedBoundSessions.frequent[0]!,
    sessionCount: 2,
    recentSessionId: SECOND_BOUND_SESSION_ID,
  }],
}

function emptySessions() {
  return bindSnapshotSelector(createSnapshotStore<SessionListState>({
    ids: [],
    byId: {},
    current: undefined,
    phase: 'ready',
    subagentsByParent: {},
    jobsBySession: {},
    currentAddress: undefined,
  }))
}

function sessionsWithCurrent(id: typeof BOUND_SESSION_ID) {
  return bindSnapshotSelector(createSnapshotStore<SessionListState>({
    ids: [id],
    byId: {
      [id]: {
        id,
        title: '五日动量研究',
        displayTitle: '五日动量研究',
        cwd: '/project',
        blank: false,
        running: false,
        updatedAt: 2,
      },
    },
    current: id,
    phase: 'ready',
    subagentsByParent: {},
    jobsBySession: {},
    currentAddress: undefined,
  }))
}

function useBound(snapshot: QuantSkillsSessionsSnapshot = emptyBoundSessions) {
  return bindSnapshotSelector(createSnapshotStore(snapshot))
}

function useAgentState(snapshot: QuantSkillsAgentsSnapshot = emptyAgents) {
  return bindSnapshotSelector(createSnapshotStore({ ...snapshot, librarySources: snapshot.librarySources ?? snapshot.definitions.map(item => ({ id: item.agentId, kind: 'agent' as const, source: 'personal' as const, method: 'manual' as const })) }))
}

function useCatalogState(snapshot: QuantSkillsCatalogSnapshot = catalog) {
  return bindSnapshotSelector(createSnapshotStore(snapshot))
}

function usePendingInteractions() {
  return bindSnapshotSelector(createSnapshotStore<SessionPendingInteractionSnapshot>(new Map()))
}

function notificationProps() {
  const notifications = createQuantSkillsNotificationStore().create()
  return {
    useNotifications: bindSnapshotSelector(notifications),
    syncNotifications: notifications.actions.sync,
    acknowledgeNotification: notifications.actions.acknowledge,
  }
}

function emptyWorkspaces() {
  return bindSnapshotSelector(createSnapshotStore<WorkspaceSnapshot>({
    items: [],
    archivedSessionIds: [],
    state: 'idle',
    phase: 'ready',
    error: null,
  }))
}

function setDrawerOverlay(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      matches,
      media: '(max-width: 1180px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function mountApp(
  page: 'home' | 'skills' | 'conversations' | 'settings' | 'parallel' | 'agents' | 'favorites',
  _panda: PandaConnectionSnapshot = pandaReady,
  boundSessions: QuantSkillsSessionsSnapshot = emptyBoundSessions,
  useSessions: ReturnType<typeof emptySessions> = emptySessions(),
  callbacks: Partial<Pick<
    QuantSkillsAppProps,
    'managedWorkspace' | 'installAsset' | 'uninstallAsset' | 'uninstallAgent' | 'openSession' | 'startSession' | 'startSkillSession' | 'startBoundSession' | 'createAgent' | 'updateAgent' | 'deleteAgent' | 'startAgentSession'
    | 'createAgentTeam' | 'updateAgentTeam' | 'deleteAgentTeam' | 'startAgentTeamSession'
    | 'testAgent' | 'listAgentModels' | 'generateAgentRole' | 'installAgent' | 'startTask' | 'refreshCatalog' | 'readAssetReadme'
    | 'applicationUpdateStatus' | 'applicationUpdateCheck' | 'applicationUpdateStart'
    | 'refreshAgents' | 'refreshBoundSessions'
    | 'useSessionPendingInteraction'
    | 'workspaceStatus' | 'setDefaultWorkspace' | 'startAuthoringSession' | 'openAgentTeamBuilder'
    | 'pandaMcpStatus' | 'authenticatePandaMcp' | 'refreshPandaMcp' | 'logoutPandaMcp'
  >> = {},
  agentState: QuantSkillsAgentsSnapshot = emptyAgents,
  catalogState: QuantSkillsCatalogSnapshot = catalog,
) {
  const view = createQuantSkillsViewStore().create()
  view.actions.syncSettings(defaultSettings, 'ready', true)
  view.actions.navigate(page)
  const props: QuantSkillsAppProps = {
    managedWorkspace: true,
    useSessions,
    useSessionPendingInteraction: usePendingInteractions(),
    useWorkspaces: emptyWorkspaces(),
    useStore: bindSnapshotSelector(view),
    useCatalog: bindSnapshotSelector(createSnapshotStore(catalogState)),
    useBoundSessions: useBound(boundSessions),
    useAgents: useAgentState(agentState),
    actions: view.actions,
    refreshCatalog: async () => {},
    applicationUpdateStatus: async () => ({ state: 'current' }),
    applicationUpdateCheck: async () => ({ accepted: 'started', status: { state: 'checking' } }),
    applicationUpdateStart: async () => ({ accepted: 'started', status: { state: 'checking' } }),
    readAssetReadme: async () => ({
      assetId: ASSET_ID,
      commit: COMMIT,
      path: 'README.md',
      markdown: '# 五日动量因子\n\n## 专业能力\n\n- 读取真正的仓库说明。',
    }),
    installAsset: async () => {},
    openSession: () => {},
    startSession: async () => {},
    startSkillSession: async () => {},
    startBoundSession: async () => {},
    createAgent: async () => { throw new Error('unexpected 专家 create') },
    updateAgent: async () => { throw new Error('unexpected 专家 update') },
    deleteAgent: async () => {},
    startAgentSession: async () => BOUND_SESSION_ID,
    createAgentTeam: async () => { throw new Error('unexpected 专家团 create') },
    updateAgentTeam: async () => { throw new Error('unexpected 专家团 update') },
    deleteAgentTeam: async () => {},
    startAgentTeamSession: async () => BOUND_SESSION_ID,
    testAgent: async () => BOUND_SESSION_ID,
    listAgentModels: async () => [],
    generateAgentRole: async () => '负责完成量化研究，并以中文报告交付结果。',
    installAgent: async () => { throw new Error('unexpected 专家 install') },
    refreshAgents: async () => {},
    refreshBoundSessions: async () => {},
    workspaceStatus: async () => ({
      managedPath: 'C:\\Users\\test\\Documents\\QuantSkills',
      preferredMissing: false,
    }),
    setDefaultWorkspace: async () => {},
    pandaMcpStatus: async () => ({
      ok: true as const,
      phase: 'disconnected' as const,
      url: 'https://pandadatamcp.pandaaiquant.com/mcp',
      toolCount: 6,
      toolNames: [
        'mcp__pandadata__auth_status',
        'mcp__pandadata__sdk_status',
        'mcp__pandadata__list_methods',
        'mcp__pandadata__search_methods',
        'mcp__pandadata__get_method_doc',
        'mcp__pandadata__call_pandadata',
      ],
      message: '尚未登录 PandaData。',
    }),
    authenticatePandaMcp: async () => ({
      ok: true as const,
      phase: 'connected' as const,
      url: 'https://pandadatamcp.pandaaiquant.com/mcp',
      toolCount: 6,
      toolNames: ['mcp__pandadata__call_pandadata'],
      message: '已连接 PandaData MCP。',
    }),
    refreshPandaMcp: async () => ({
      ok: true as const,
      phase: 'disconnected' as const,
      url: 'https://pandadatamcp.pandaaiquant.com/mcp',
      toolCount: 6,
      toolNames: [
        'mcp__pandadata__auth_status',
        'mcp__pandadata__sdk_status',
        'mcp__pandadata__list_methods',
        'mcp__pandadata__search_methods',
        'mcp__pandadata__get_method_doc',
        'mcp__pandadata__call_pandadata',
      ],
      message: '尚未登录 PandaData。',
    }),
    logoutPandaMcp: async () => ({
      ok: true as const,
      phase: 'disconnected' as const,
      url: 'https://pandadatamcp.pandaaiquant.com/mcp',
      toolCount: 6,
      toolNames: ['mcp__pandadata__auth_status'],
      message: '已退出 PandaData 登录。',
    }),
    startAuthoringSession: async () => {},
    openAgentTeamBuilder: (seed) => { view.actions.requestAgentTeamCreation(seed) },
    send: async () => {},
    startTask: async () => ({ kind: 'started', asset: ASSET_ID, title: '五日动量因子' }),
    ...callbacks,
  }
  render(<QuantSkillsApp {...props}/>)
  if (page === 'skills') fireEvent.click(screen.getByRole('button', { name: '发现', exact: true }))
  return view
}

beforeEach(() => {
  localStorage.clear()
  setDrawerOverlay(false)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('QuantSkills navigation and display scale', () => {
  it('groups pending replies beside the new-session action and opens the exact pending session', () => {
    const openSession = vi.fn()
    const useSessionPendingInteraction = bindSnapshotSelector(createSnapshotStore<SessionPendingInteractionSnapshot>(new Map([[BOUND_SESSION_ID, { sessionId: BOUND_SESSION_ID, key: 'question-one', kind: 'question' }]])))
    mountApp('parallel', pandaReady, populatedBoundSessions, emptySessions(), { openSession, useSessionPendingInteraction })
    const reply = screen.getByRole('button', { name: '查看等待回复的 1 个会话' }).parentElement!
    expect(reply.className).toContain('pageHeaderActions')
    fireEvent.click(screen.getByRole('button', { name: '查看等待回复的 1 个会话' }))
    const drawer = screen.getByRole('complementary', { name: '等待回复会话' })
    fireEvent.click(drawer.querySelector('button:not([aria-label])')!)
    expect(openSession).toHaveBeenCalledWith(BOUND_SESSION_ID)
  })
  it('confirms installed 技能 uninstall and keeps failures retryable', async () => {
    const uninstallAsset = vi.fn().mockRejectedValueOnce(new Error('稍后重试')).mockResolvedValue(undefined)
    const installedCatalog = { ...catalogWithInstalled, versionsByAsset: { [ASSET_ID]: catalogWithInstalled.versionsByAsset[ASSET_ID]!.map(version => ({ ...version, origin: 'catalog' as const })) } }
    mountApp('skills', pandaReady, emptyBoundSessions, emptySessions(), { uninstallAsset }, emptyAgents, installedCatalog)
    fireEvent.click(screen.getByRole('button', { name: '已安装', exact: true }))
    fireEvent.click(screen.getByRole('button', { name: '卸载 五日动量因子', exact: true }))
    expect(uninstallAsset).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '确认卸载', exact: true }))
    await screen.findByText('稍后重试')
    fireEvent.click(screen.getByRole('button', { name: '确认卸载', exact: true }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '卸载技能' })).toBeNull())
    expect(uninstallAsset).toHaveBeenLastCalledWith(ASSET_ID)
  })

  it('uninstalls only the selected imported 专家 revision after confirmation', async () => {
    const uninstallAgent = vi.fn().mockResolvedValue(undefined)
    const state = { ...populatedAgents, librarySources: [{ id: AGENT_ID, kind: 'agent' as const, source: 'installed' as const, method: 'installation' as const }] }
    mountApp('agents', pandaReady, emptyBoundSessions, emptySessions(), { uninstallAgent }, state)
    fireEvent.click(screen.getByRole('button', { name: '已安装', exact: true }))
    fireEvent.click(screen.getByRole('button', { name: '卸载 量化研究助理' }))
    expect(uninstallAgent).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '确认卸载', exact: true }))
    await waitFor(() => expect(uninstallAgent).toHaveBeenCalledWith({ agentId: AGENT_ID, expectedRevision: agentDefinition.revision }))
  })
  it('keeps the native plugin open while a selected Session uses the stock conversation surface', async () => {
    const view = createQuantSkillsViewStore().create()
    const layout = createQuantSkillsLayoutStore().create()
    const notifications = createQuantSkillsNotificationStore().create()
    view.actions.openPlugin()
    view.actions.openPluginConversation()
    view.actions.setInterfaceScale(1.25)
    view.actions.setConversationScale(0.9)
    view.actions.setColorScheme('dark')
    const close = vi.fn()
    const sessionState = createSnapshotStore<SessionListState>({
      ids: [BOUND_SESSION_ID, SECOND_BOUND_SESSION_ID],
      byId: {
        [BOUND_SESSION_ID]: {
          id: BOUND_SESSION_ID, title: '五日动量研究', displayTitle: '五日动量研究', cwd: '/project',
          blank: false, running: false, updatedAt: 2,
        },
        [SECOND_BOUND_SESSION_ID]: {
          id: SECOND_BOUND_SESSION_ID, title: '五日动量复盘', displayTitle: '五日动量复盘', cwd: '/project',
          blank: false, running: false, updatedAt: 3,
        },
      },
      current: BOUND_SESSION_ID,
      phase: 'ready',
      subagentsByParent: {},
      jobsBySession: {},
      currentAddress: undefined,
    })
    const openSession = vi.fn((id: typeof BOUND_SESSION_ID) => {
      sessionState.set({ ...sessionState.getSnapshot(), current: id })
    })
    const releaseSidebar = vi.fn()
    const updateSidebar = vi.fn()
    const setSidebarDragging = vi.fn()
    const claimSidebar = vi.fn(() => ({
      update: updateSidebar,
      setDragging: setSidebarDragging,
      release: releaseSidebar,
    }))
    const releaseDetails = vi.fn()
    const updateDetails = vi.fn()
    const setDetailsDragging = vi.fn()
    const closeResults = vi.fn(() => { layout.actions.closeResults() })
    const openResults = vi.fn(() => { layout.actions.openResults() })
    const claimDetails = vi.fn(() => ({
      update: updateDetails,
      setDragging: setDetailsDragging,
      release: releaseDetails,
    }))
    const releaseConversationTextScale = vi.fn()
    const claimConversationTextScale = vi.fn(() => ({
      update: vi.fn(),
      release: releaseConversationTextScale,
    }))
    const startAuthoringSession = vi.fn(async () => {})
    const props: QuantSkillsPluginFrameProps = {
      useSessions: bindSnapshotSelector(sessionState),
      useWorkspaces: emptyWorkspaces(),
      useView: bindSnapshotSelector(view),
      useLayout: bindSnapshotSelector(layout),
      useCatalog: useCatalogState(catalogWithInstalled),
      useBoundSessions: useBound(multiArchiveSessions),
      useAgents: useAgentState(),
      useNotifications: bindSnapshotSelector(notifications),
      actions: view.actions,
      openSession,
      acknowledgeNotification: vi.fn(),
      renameSession: vi.fn(async () => {}),
      removeSessions: vi.fn(async () => {}),
      startSession: vi.fn(async () => {}),
      startAuthoringSession,
      openAgentTeamBuilder: vi.fn(),
      claimSidebar,
      claimDetails,
      claimConversationTextScale,
      openResults,
      closeResults,
      close,
      renderSlot: name => <div data-testid={`slot-${name}`}/>,
      SessionProvider: ({ empty }) => empty?.(),
    }
    const mounted = render(<QuantSkillsPluginFrame {...props}/>)
    const frame = screen.getByRole('region', { name: 'QuantSkills 插件应用' })
    expect([...screen.getByRole('group', { name: 'PandaAI 产品' }).querySelectorAll('button')].map(button => button.textContent)).toEqual(['QUBE', 'EVO', '比赛'])

    expect(frame.getAttribute('data-conversation-open')).toBe('true')
    expect(frame.getAttribute('data-plugin-interface-scale')).toBe('1.25')
    expect(frame.getAttribute('data-qs-theme')).toBe('dark')
    expect(document.body.dataset.qsPluginTheme).toBe('dark')
    expect(frame.style.getPropertyValue('--qs-interface-scale')).toBe('1.25')
    expect(frame.style.getPropertyValue('--qs-interface-inverse-scale')).toBe('0.8')
    expect(frame.style.getPropertyValue('--qs-plugin-nav-width')).toBe('120px')
    expect(frame.style.getPropertyValue('--qs-conversation-scale')).toBe('')
    expect(frame.querySelector('[data-conversation-scale]')).toBeNull()
    expect(claimConversationTextScale).toHaveBeenCalledWith(0.9)
    expect(frame.querySelector('[data-interface-scale-viewport="page"]')).toBeTruthy()
    expect(screen.getByRole('complementary', { name: '会话切换' })).toBeTruthy()
    expect(screen.getByText('五日动量研究')).toBeTruthy()
    expect(claimSidebar).toHaveBeenCalledWith(expect.objectContaining({ width: 656, exclusive: true }))
    expect(screen.queryByTestId('slot-quantskills.page')).toBeNull()
    expect(screen.queryByRole('button', { name: '返回DSH' })).toBeNull()
    expect(close).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '隐藏会话侧栏' }))
    expect(screen.queryByRole('complementary', { name: '会话切换' })).toBeNull()
    expect(updateSidebar).toHaveBeenLastCalledWith(120)
    fireEvent.click(screen.getByRole('button', { name: '显示会话侧栏' }))
    expect(screen.getByRole('complementary', { name: '会话切换' })).toBeTruthy()
    expect(updateSidebar).toHaveBeenLastCalledWith(656)

    fireEvent.click(screen.getByRole('button', { name: '创建' }))
    expect(screen.getByRole('menu').parentElement).toBe(document.body)
    fireEvent.click(screen.getByRole('menuitem', { name: /AI 创建 专家团/ }))
    await waitFor(() => { expect(startAuthoringSession).toHaveBeenCalledWith('agent-team') })
    expect(frame.getAttribute('data-conversation-open')).toBe('true')
    expect(close).not.toHaveBeenCalled()

    act(() => { layout.actions.openResults() })
    expect(claimDetails).not.toHaveBeenCalled()
    expect(screen.getByRole('complementary', { name: '文件与预览' }).hasAttribute('aria-modal')).toBe(false)
    expect(screen.queryByRole('button', { name: '关闭文件预览并返回对话' })).toBeNull()
    const priorWidth = window.innerWidth
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1800 })
    fireEvent(window, new Event('resize'))
    expect(claimDetails).toHaveBeenCalledWith(expect.objectContaining({ width: 420, exclusive: true }))
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: priorWidth })
    expect(frame.querySelector('[data-interface-scale-viewport="results"]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '隐藏结果侧栏' }))
    expect(screen.queryByRole('separator', { name: '调整结果工作台宽度' })).toBeNull()
    expect(screen.getByRole('button', { name: '显示结果侧栏' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '显示结果侧栏' }))
    expect(openResults).toHaveBeenCalledOnce()
    const resultSeparator = screen.getByRole('separator', { name: '调整结果工作台宽度' })
    expect(resultSeparator.getAttribute('aria-valuenow')).toBe('420')
    fireEvent.keyDown(resultSeparator, { key: 'ArrowLeft' })
    expect(resultSeparator.getAttribute('aria-valuenow')).toBe('444')
    expect(updateDetails).toHaveBeenLastCalledWith(444)
    expect(localStorage.getItem('dsh.quantskills.result-workbench-width')).toBe('444')

    const setPointerCapture = vi.fn()
    const releasePointerCapture = vi.fn()
    Object.assign(resultSeparator, {
      setPointerCapture,
      releasePointerCapture,
      hasPointerCapture: () => true,
    })
    fireEvent.pointerDown(resultSeparator, { button: 0, pointerId: 9, clientX: 700 })
    expect(setDetailsDragging).toHaveBeenCalledWith(true)
    fireEvent.pointerMove(resultSeparator, { pointerId: 9, clientX: 748 })
    expect(resultSeparator.getAttribute('aria-valuenow')).toBe('396')
    fireEvent.pointerUp(resultSeparator, { pointerId: 9, clientX: 748 })
    expect(setDetailsDragging).toHaveBeenCalledWith(false)
    expect(localStorage.getItem('dsh.quantskills.result-workbench-width')).toBe('396')
    expect(setPointerCapture).toHaveBeenCalledWith(9)
    expect(releasePointerCapture).toHaveBeenCalledWith(9)

    fireEvent.pointerDown(resultSeparator, { button: 0, pointerId: 11, clientX: 700 })
    fireEvent.pointerMove(resultSeparator, { pointerId: 11, clientX: 676 })
    expect(resultSeparator.getAttribute('aria-valuenow')).toBe('420')
    fireEvent.pointerCancel(resultSeparator, { pointerId: 11 })
    expect(setDetailsDragging).toHaveBeenLastCalledWith(false)
    expect(localStorage.getItem('dsh.quantskills.result-workbench-width')).toBe('420')

    fireEvent.pointerDown(resultSeparator, { button: 0, pointerId: 10, clientX: 700 })
    fireEvent.pointerMove(resultSeparator, { pointerId: 10, clientX: 724 })
    expect(setDetailsDragging).toHaveBeenLastCalledWith(true)

    fireEvent.click(screen.getByText('五日动量复盘').closest('button')!)
    expect(openSession).toHaveBeenCalledWith(SECOND_BOUND_SESSION_ID)
    expect(closeResults).toHaveBeenCalled()
    expect(setDetailsDragging).toHaveBeenLastCalledWith(false)
    expect(screen.queryByRole('separator', { name: '调整结果工作台宽度' })).toBeNull()
    expect(screen.queryByTestId('slot-quantskills.results')).toBeNull()
    expect(frame.getAttribute('data-conversation-open')).toBe('true')
    expect(close).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '会话' }))

    expect(frame.getAttribute('data-conversation-open')).toBeNull()
    expect(screen.getByTestId('slot-quantskills.page')).toBeTruthy()
    expect(mounted.container.querySelector('[aria-label="QuantSkills 插件应用"]')).toBeTruthy()
    expect(releaseSidebar).toHaveBeenCalledOnce()
    expect(releaseDetails).toHaveBeenCalledTimes(2)
    expect(close).not.toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
    // A narrow screen must relinquish both native columns, even with desktop
    // drawers and a non-default interface scale saved in the current session.
    const deferModelSetup = screen.queryByRole('button', { name: '稍后设置' })
    if (deferModelSetup) fireEvent.click(deferModelSetup)
    try {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 495 })
      fireEvent(window, new Event('resize'))
      act(() => { view.actions.openPluginConversation() })
      expect(claimSidebar).toHaveBeenLastCalledWith(expect.objectContaining({ width: 0, exclusive: true }))
      expect(claimDetails).toHaveBeenLastCalledWith(expect.objectContaining({ width: 0, exclusive: true }))
      expect(frame.style.getPropertyValue('--qs-interface-scale')).toBe('1')
      expect(screen.queryByRole('complementary', { name: '会话切换' })).toBeNull()
      const sidebarUpdates = updateSidebar.mock.calls.length
      fireEvent.click(screen.getByRole('button', { name: '打开会话列表' }))
      expect(screen.getByRole('complementary', { name: '会话切换' })).toBeTruthy()
      expect(updateSidebar.mock.calls.length).toBe(sidebarUpdates)
      fireEvent.click(screen.getByText('五日动量复盘').closest('button')!)
      expect(frame.hasAttribute('data-mobile-panel')).toBe(false)
      fireEvent.click(screen.getByRole('button', { name: '打开结果预览' }))
      expect(screen.getByRole('complementary', { name: '文件与预览' })).toBeTruthy()
      expect(claimDetails).toHaveBeenLastCalledWith(expect.objectContaining({ width: 0, exclusive: true }))
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(screen.queryByTestId('slot-quantskills.results')).toBeNull()
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: priorWidth })
      fireEvent(window, new Event('resize'))
    }
    expect(frame.style.getPropertyValue('--qs-interface-scale')).toBe('1.25')
    expect(updateSidebar).toHaveBeenLastCalledWith(656)
    expect(screen.getByRole('complementary', { name: '会话切换' })).toBeTruthy()
    mounted.unmount()
    expect(document.body.dataset.qsPluginTheme).toBeUndefined()
    expect(document.body.hasAttribute('data-qs-mobile')).toBe(false)
  })

  it('keeps 会话 selected while the parallel view is active', () => {
    const view = createQuantSkillsViewStore().create()
    const notifications = createQuantSkillsNotificationStore().create()
    notifications.actions.sync([{ sessionId: 'completed', updatedAt: 1, runState: 'running' }])
    notifications.actions.sync([{ sessionId: 'completed', updatedAt: 1, runState: 'completed' }])
    view.actions.navigate('parallel')
    let footerWide: boolean | undefined
    const props: QuantSkillsRailProps = {
      collapsed: false,
      width: 78,
      useSessions: emptySessions(),
      useWorkspaces: emptyWorkspaces(),
      useStore: bindSnapshotSelector(view),
      useNotifications: bindSnapshotSelector(notifications),
      actions: view.actions,
      collapse: () => {},
      renderSlot: ((name: string, owner: { wide: boolean }) => {
        expect(name).toBe('sidebar.footer.action')
        footerWide = owner.wide
        return <button type="button">附件清理</button>
      }) as QuantSkillsRailProps['renderSlot'],
    }
    render(<QuantSkillsRail {...props}/>)

    expect(screen.getByRole('button', { name: '会话' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: '会话' }).textContent).toContain('1')
    expect(screen.getByRole('button', { name: '附件清理' })).toBeTruthy()
    expect(footerWide).toBe(false)
    const destinations = [...screen.getByRole('navigation', { name: 'QuantSkills 主导航' }).querySelectorAll('button')].map(button => button.textContent)
    expect(destinations.slice(destinations.indexOf('QUBE'), destinations.indexOf('QUBE') + 3)).toEqual(['QUBE', 'EVO', '比赛'])
    fireEvent.click(screen.getByRole('button', { name: '比赛', exact: true }))
    expect(view.store.getSnapshot().page).toBe('contest')
    expect(screen.getByRole('button', { name: '比赛', exact: true }).getAttribute('aria-current')).toBe('page')
  })

  it.each([0.6, 0.75, 0.9, 1, 1.1, 1.25, 1.5])(
    'projects %s scale from the frame into both application and stock conversation containers',
    (scale) => {
      const view = createQuantSkillsViewStore().create()
      const layout = createQuantSkillsLayoutStore().create()
      view.actions.setInterfaceScale(scale)
      view.actions.setConversationScale(scale)
      const renderSlot: QuantSkillsFrameProps['renderSlot'] = name => <div data-testid={`slot-${name}`}/>
      const props: QuantSkillsFrameProps = {
        useSessions: sessionsWithCurrent(BOUND_SESSION_ID),
        useWorkspaces: emptyWorkspaces(),
        useStore: bindSnapshotSelector(layout),
        actions: layout.actions,
        useView: bindSnapshotSelector(view),
        useCatalog: useCatalogState(),
        useBoundSessions: useBound(populatedBoundSessions),
        useAgents: useAgentState(),
        ...notificationProps(),
        openSession: () => {},
        renameSession: async () => {},
        removeSessions: async () => {},
        startSession: async () => {},
        startAuthoringSession: async () => {},
        openAgentTeamBuilder: () => {},
        renderSlot,
        SessionProvider: ({ empty }) => empty?.(),
      }
      const mounted = render(<QuantSkillsFrame {...props}/>)
      const frame = mounted.container.querySelector('[data-interface-scale]') as HTMLElement
      const application = screen.getByTestId('slot-quantskills.page').parentElement as HTMLElement

      expect(application.getAttribute('data-stock-conversation')).toBeNull()
      act(() => { view.actions.navigate('conversations') })
      const conversation = screen.getByTestId('slot-conversation').closest('[data-conversation-scale]') as HTMLElement

      expect(frame.dataset.interfaceScale).toBe(String(scale))
      expect(frame.style.getPropertyValue('--qs-interface-scale')).toBe(String(scale))
      expect(conversation.dataset.conversationScale).toBe(String(scale))
      expect(conversation.getAttribute('data-stock-conversation')).toBe('true')
      expect(conversation.style.getPropertyValue('--qs-conversation-scale')).toBe(String(scale))
    },
  )

  it('updates interface and conversation scales independently from the appearance controls', () => {
    const view = mountApp('settings')
    fireEvent.click(screen.getByRole('button', { name: '外观' }))

    fireEvent.change(screen.getByRole('slider', { name: /界面比例/ }), { target: { value: '1.2' } })
    fireEvent.change(screen.getByRole('slider', { name: /会话文字/ }), { target: { value: '0.95' } })
    fireEvent.change(screen.getByRole('slider', { name: /文字亮度/ }), { target: { value: '0.8' } })

    expect(view.store.getSnapshot()).toMatchObject({
      interfaceScale: 1.2,
      conversationScale: 0.95,
      conversationBrightness: 0.8,
    })
    expect(screen.getByText('界面 120% · 对话文字 95%')).toBeTruthy()
    fireEvent.change(screen.getByRole('slider', { name: '内容蒙层' }), { target: { value: '0.35' } })
    expect(view.store.getSnapshot().conversationOverlayOpacity).toBe(0.35)
    fireEvent.click(screen.getByRole('button', { name: '恢复默认' }))
    expect(view.store.getSnapshot()).toMatchObject({ interfaceScale: 1, conversationScale: 1, conversationBrightness: 1, conversationOverlayOpacity: 0.92 })

  })

  it('switches the QuantSkills-owned palette and keeps official support resources together', () => {
    const view = mountApp('settings')
    fireEvent.click(screen.getByRole('button', { name: '外观' }))
    fireEvent.click(screen.getByRole('button', { name: /深色/ }))
    expect(view.store.getSnapshot().colorScheme).toBe('dark')
    fireEvent.click(screen.getByRole('button', { name: '使用环轨星际背景' }))
    expect(view.store.getSnapshot().darkBackground).toBe('orbital-rings')
    fireEvent.click(screen.getByRole('button', { name: '不使用背景图片' }))
    expect(view.store.getSnapshot().darkBackground).toBe('none')

    fireEvent.click(screen.getByRole('button', { name: '品牌与支持' }))
    expect(screen.getByText('QuantSkills 连接专业 技能、专家与 PandaAI，让量化研究更高效。')).toBeTruthy()
    expect(screen.getByRole('link', { name: /QuantSkills 官网/ }).getAttribute('href')).toBe(
      'https://www.quantskills.ai/',
    )
    expect(screen.getByRole('link', { name: /PandaAI 官网/ }).getAttribute('href')).toBe(
      'https://www.pandaaiquant.com/',
    )
    expect(screen.getByRole('img', { name: 'PandaAI 入群小助理二维码' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'QuantSkills 官方公众号二维码' })).toBeTruthy()
  })

  it('replaces home catalog activity with PandaAI-first official brand support', () => {
    mountApp('home')

    expect(screen.queryByText('最新目录动态')).toBeNull()
    expect(screen.getByRole('heading', { name: '品牌与支持' })).toBeTruthy()
    expect(screen.getByText('QuantSkills 连接专业 技能、专家与 PandaAI，让量化研究更高效。')).toBeTruthy()
    const links = screen.getByRole('navigation', { name: '官方网站' }).querySelectorAll('a')
    expect(Array.from(links, link => link.textContent)).toEqual([
      'PandaAI 官网pandaaiquant.com',
      'QuantSkills 官网quantskills.ai',
    ])
    expect(screen.getByRole('img', { name: 'PandaAI 入群小助理二维码' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'QuantSkills 官方公众号二维码' })).toBeTruthy()
  })

  it('keeps an ordinary current Session in the unified conversation center without a resident binding', () => {
    const view = createQuantSkillsViewStore().create()
    const layout = createQuantSkillsLayoutStore().create()
    view.actions.navigate('conversations')
    const props: QuantSkillsFrameProps = {
      useSessions: sessionsWithCurrent(ORDINARY_SESSION_ID),
      useWorkspaces: emptyWorkspaces(),
      useStore: bindSnapshotSelector(layout),
      actions: layout.actions,
      useView: bindSnapshotSelector(view),
      useCatalog: useCatalogState(),
      useBoundSessions: useBound(),
      useAgents: useAgentState(),
      ...notificationProps(),
      openSession: () => {},
      renameSession: async () => {},
      removeSessions: async () => {},
      startSession: async () => {},
      startAuthoringSession: async () => {},
      openAgentTeamBuilder: () => {},
      renderSlot: name => <div data-testid={`ordinary-${name}`}/>,
      SessionProvider: ({ empty }) => empty?.(),
    }

    render(<QuantSkillsFrame {...props}/>)

    expect(screen.getByLabelText('会话切换')).toBeTruthy()
    expect(screen.getByTestId('ordinary-conversation')).toBeTruthy()
    expect(screen.queryByTestId('ordinary-quantskills.page')).toBeNull()
  })

  it('starts a clean DSH Session from the global action and keeps authoring available in the empty state', async () => {
    const view = createQuantSkillsViewStore().create()
    const layout = createQuantSkillsLayoutStore().create()
    const startSession = vi.fn(async () => {})
    const startAuthoringSession = vi.fn(async (_kind: 'skill' | 'agent' | 'agent-team') => {})
    view.actions.navigate('conversations')
    render(<QuantSkillsFrame
      useSessions={sessionsWithCurrent(BOUND_SESSION_ID)}
      useWorkspaces={emptyWorkspaces()}
      useStore={bindSnapshotSelector(layout)}
      actions={layout.actions}
      useView={bindSnapshotSelector(view)}
      useCatalog={useCatalogState()}
      useBoundSessions={useBound(populatedBoundSessions)}
      useAgents={useAgentState()}
      {...notificationProps()}
      openSession={() => {}}
      renameSession={async () => {}}
      removeSessions={async () => {}}
      startSession={startSession}
      startAuthoringSession={startAuthoringSession}
      openAgentTeamBuilder={() => {}}
      renderSlot={name => <div data-testid={`plain-${name}`}/>}
      SessionProvider={({ empty }) => empty?.()}
    />)

    fireEvent.click(screen.getByRole('button', { name: '新对话' }))
    expect(startSession).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: '创建' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /AI 创建 技能/ }))
    expect(startAuthoringSession).toHaveBeenCalledWith('skill')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '创建' }).getAttribute('aria-expanded')).toBe('false')
    })
    fireEvent.click(screen.getByRole('button', { name: '创建' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /AI 创建 专家团/ }))
    expect(startAuthoringSession).toHaveBeenCalledWith('agent-team')
  })

  it('does not leave 技能 content visible behind an empty 专家 filter', () => {
    const view = createQuantSkillsViewStore().create()
    const layout = createQuantSkillsLayoutStore().create()
    view.actions.navigate('conversations')
    render(<QuantSkillsFrame
      useSessions={sessionsWithCurrent(BOUND_SESSION_ID)}
      useWorkspaces={emptyWorkspaces()}
      useStore={bindSnapshotSelector(layout)}
      actions={layout.actions}
      useView={bindSnapshotSelector(view)}
      useCatalog={useCatalogState()}
      useBoundSessions={useBound(populatedBoundSessions)}
      useAgents={useAgentState()}
      {...notificationProps()}
      openSession={() => {}}
      renameSession={async () => {}}
      removeSessions={async () => {}}
      startSession={async () => {}}
      startAuthoringSession={async () => {}}
      openAgentTeamBuilder={() => {}}
      renderSlot={name => <div data-testid={`filtered-${name}`}/>}
      SessionProvider={({ empty }) => empty?.()}
    />)

    fireEvent.click(screen.getByRole('tab', { name: /专家\s*0/ }))
    expect(screen.getByRole('heading', { name: '暂无 专家 会话' })).toBeTruthy()
    expect(screen.queryByTestId('filtered-conversation')).toBeNull()
  })

  it('replaces the archive rail with the current Session result drawer', () => {
    const view = createQuantSkillsViewStore().create()
    const layout = createQuantSkillsLayoutStore().create()
    view.actions.navigate('conversations')
    const props: QuantSkillsFrameProps = {
      useSessions: sessionsWithCurrent(BOUND_SESSION_ID),
      useWorkspaces: emptyWorkspaces(),
      useStore: bindSnapshotSelector(layout),
      actions: layout.actions,
      useView: bindSnapshotSelector(view),
      useCatalog: useCatalogState(),
      useBoundSessions: useBound(populatedBoundSessions),
      useAgents: useAgentState(),
      ...notificationProps(),
      openSession: () => {},
      renameSession: async () => {},
      removeSessions: async () => {},
      startSession: async () => {},
      startAuthoringSession: async () => {},
      openAgentTeamBuilder: () => {},
      renderSlot: name => <div data-testid={`drawer-${name}`}/>,
      SessionProvider: ({ empty }) => empty?.(),
    }

    render(<QuantSkillsFrame {...props}/>)
    expect(screen.getByLabelText('会话切换')).toBeTruthy()

    act(() => { layout.actions.openResults() })
    expect(screen.queryByLabelText('会话切换')).toBeNull()
    expect(screen.getByTestId('drawer-quantskills.results')).toBeTruthy()

    act(() => { layout.actions.closeResults() })
    expect(screen.getByLabelText('会话切换')).toBeTruthy()
  })

  it('does not treat an archive refresh as a live current-run completion', () => {
    const view = createQuantSkillsViewStore().create()
    const layout = createQuantSkillsLayoutStore().create()
    const bound = createSnapshotStore(populatedBoundSessions)
    const notifications = createQuantSkillsNotificationStore().create()
    const acknowledgeNotification = vi.fn()
    view.actions.navigate('conversations')
    render(<QuantSkillsFrame
      useSessions={sessionsWithCurrent(BOUND_SESSION_ID)}
      useWorkspaces={emptyWorkspaces()}
      useStore={bindSnapshotSelector(layout)}
      actions={layout.actions}
      useView={bindSnapshotSelector(view)}
      useCatalog={useCatalogState()}
      useBoundSessions={bindSnapshotSelector(bound)}
      useAgents={useAgentState()}
      useNotifications={bindSnapshotSelector(notifications)}
      syncNotifications={() => {}}
      acknowledgeNotification={acknowledgeNotification}
      openSession={() => {}}
      renameSession={async () => {}}
      removeSessions={async () => {}}
      startSession={async () => {}}
      startAuthoringSession={async () => {}}
      openAgentTeamBuilder={() => {}}
      renderSlot={name => <div data-testid={`completed-${name}`}/>}
      SessionProvider={({ empty }) => empty?.()}
    />)

    expect(screen.getByLabelText('会话切换')).toBeTruthy()
    act(() => {
      bound.set({
        ...populatedBoundSessions,
        archives: [{
          ...populatedBoundSessions.archives[0]!,
          updatedAt: 3,
          running: false,
          runState: 'completed',
        }],
        refreshedAt: 3,
      })
    })

    expect(screen.getByLabelText('会话切换')).toBeTruthy()
    expect(screen.queryByTestId('completed-quantskills.results')).toBeNull()
    expect(acknowledgeNotification).not.toHaveBeenCalled()
  })

  it('resizes the conversation archive rail with accessible keyboard controls and persists the width', () => {
    const view = createQuantSkillsViewStore().create()
    const layout = createQuantSkillsLayoutStore().create()
    view.actions.navigate('conversations')
    render(<QuantSkillsFrame
      useSessions={sessionsWithCurrent(BOUND_SESSION_ID)}
      useWorkspaces={emptyWorkspaces()}
      useStore={bindSnapshotSelector(layout)}
      actions={layout.actions}
      useView={bindSnapshotSelector(view)}
      useCatalog={useCatalogState()}
      useBoundSessions={useBound(populatedBoundSessions)}
      useAgents={useAgentState()}
      {...notificationProps()}
      openSession={() => {}}
      renameSession={async () => {}}
      removeSessions={async () => {}}
      startSession={async () => {}}
      startAuthoringSession={async () => {}}
      openAgentTeamBuilder={() => {}}
      renderSlot={name => <div data-testid={`resizable-${name}`}/>}
      SessionProvider={({ empty }) => empty?.()}
    />)

    const separator = screen.getByRole('separator', { name: '调整会话列表宽度' })
    expect(separator.getAttribute('aria-valuenow')).toBe('420')
    fireEvent.keyDown(separator, { key: 'ArrowRight' })
    expect(separator.getAttribute('aria-valuenow')).toBe('436')
    expect(localStorage.getItem('dsh.quantskills.session-drawer-width')).toBe('436')
    fireEvent.doubleClick(separator)
    expect(separator.getAttribute('aria-valuenow')).toBe('420')

    const setPointerCapture = vi.fn()
    const releasePointerCapture = vi.fn()
    Object.assign(separator, {
      setPointerCapture,
      releasePointerCapture,
      hasPointerCapture: () => true,
    })
    fireEvent.pointerDown(separator, { button: 0, pointerId: 7, clientX: 300 })
    fireEvent.pointerMove(separator, { pointerId: 7, clientX: 364 })
    expect(separator.getAttribute('aria-valuenow')).toBe('484')
    fireEvent.pointerUp(separator, { pointerId: 7, clientX: 364 })
    expect(localStorage.getItem('dsh.quantskills.session-drawer-width')).toBe('484')
    expect(setPointerCapture).toHaveBeenCalledWith(7)
    expect(releasePointerCapture).toHaveBeenCalledWith(7)
  })

  it('renames an idle conversation through the durable Session action', async () => {
    const view = createQuantSkillsViewStore().create()
    const layout = createQuantSkillsLayoutStore().create()
    let resolveRename!: () => void
    const renameSession = vi.fn(() => new Promise<void>((resolve) => { resolveRename = resolve }))
    view.actions.navigate('conversations')
    render(<QuantSkillsFrame
      useSessions={sessionsWithCurrent(SECOND_BOUND_SESSION_ID)}
      useWorkspaces={emptyWorkspaces()}
      useStore={bindSnapshotSelector(layout)}
      actions={layout.actions}
      useView={bindSnapshotSelector(view)}
      useCatalog={useCatalogState()}
      useBoundSessions={useBound(multiArchiveSessions)}
      useAgents={useAgentState()}
      {...notificationProps()}
      openSession={() => {}}
      renameSession={renameSession}
      removeSessions={async () => {}}
      startSession={async () => {}}
      startAuthoringSession={async () => {}}
      openAgentTeamBuilder={() => {}}
      renderSlot={name => <div data-testid={`rename-${name}`}/>}
      SessionProvider={({ empty }) => empty?.()}
    />)

    fireEvent.click(screen.getByRole('button', { name: '重命名会话 五日动量复盘' }))
    const dialog = screen.getByRole('dialog', { name: '重命名会话' })
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: '会话名称' })
    expect(input.value).toBe('五日动量复盘')
    expect(dialog.textContent).toContain('新名称会保存到会话记录中')
    fireEvent.change(input, { target: { value: '   ' } })
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '重命名' }).disabled).toBe(true)
    fireEvent.change(input, { target: { value: '  沪深300复盘  ' } })
    fireEvent.click(screen.getByRole('button', { name: '重命名' }))

    expect(renameSession).toHaveBeenCalledWith(SECOND_BOUND_SESSION_ID, '沪深300复盘')
    expect(input.disabled).toBe(true)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByRole('dialog', { name: '重命名会话' })).toBeTruthy()
    await act(async () => { resolveRename() })
    await waitFor(() => { expect(screen.queryByRole('dialog', { name: '重命名会话' })).toBeNull() })
  })

  it('keeps a rejected running-conversation rename open for retry', async () => {
    const view = createQuantSkillsViewStore().create()
    const layout = createQuantSkillsLayoutStore().create()
    const renameSession = vi.fn()
      .mockRejectedValueOnce(new Error('rename conflict'))
      .mockRejectedValueOnce('denied')
    view.actions.navigate('conversations')
    render(<QuantSkillsFrame
      useSessions={sessionsWithCurrent(BOUND_SESSION_ID)}
      useWorkspaces={emptyWorkspaces()}
      useStore={bindSnapshotSelector(layout)}
      actions={layout.actions}
      useView={bindSnapshotSelector(view)}
      useCatalog={useCatalogState()}
      useBoundSessions={useBound(multiArchiveSessions)}
      useAgents={useAgentState()}
      {...notificationProps()}
      openSession={() => {}}
      renameSession={renameSession}
      removeSessions={async () => {}}
      startSession={async () => {}}
      startAuthoringSession={async () => {}}
      openAgentTeamBuilder={() => {}}
      renderSlot={name => <div data-testid={`rename-error-${name}`}/>}
      SessionProvider={({ empty }) => empty?.()}
    />)

    const renameRunning = screen.getByRole<HTMLButtonElement>('button', { name: '重命名会话 五日动量研究' })
    expect(renameRunning.disabled).toBe(false)
    fireEvent.click(renameRunning)
    const input = screen.getByRole('textbox', { name: '会话名称' })
    fireEvent.change(input, { target: { value: '运行中的研究' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => { expect(screen.getByRole('alert').textContent).toBe('rename conflict') })

    fireEvent.change(input, { target: { value: '第二次命名' } })
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '重命名' }))
    await waitFor(() => { expect(screen.getByRole('alert').textContent).toBe('denied') })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: '重命名会话' })).toBeNull()
  })

  it('confirms removal of an idle conversation and describes the recoverable Host archive', async () => {
    const view = createQuantSkillsViewStore().create()
    const layout = createQuantSkillsLayoutStore().create()
    const removeSessions = vi.fn(async (_ids: readonly SessionId[]) => {})
    view.actions.navigate('conversations')
    render(<QuantSkillsFrame
      useSessions={sessionsWithCurrent(SECOND_BOUND_SESSION_ID)}
      useWorkspaces={emptyWorkspaces()}
      useStore={bindSnapshotSelector(layout)}
      actions={layout.actions}
      useView={bindSnapshotSelector(view)}
      useCatalog={useCatalogState()}
      useBoundSessions={useBound(multiArchiveSessions)}
      useAgents={useAgentState()}
      {...notificationProps()}
      openSession={() => {}}
      renameSession={async () => {}}
      removeSessions={removeSessions}
      startSession={async () => {}}
      startAuthoringSession={async () => {}}
      openAgentTeamBuilder={() => {}}
      renderSlot={name => <div data-testid={`remove-${name}`}/>}
      SessionProvider={({ empty }) => empty?.()}
    />)

    fireEvent.click(screen.getByRole('button', { name: '删除会话 五日动量复盘' }))
    expect(screen.getByRole('dialog').textContent).toContain('原始记录仍保留在会话归档中')
    fireEvent.click(screen.getByRole('button', { name: '删除会话' }))

    await waitFor(() => {
      expect(removeSessions).toHaveBeenCalledWith([SECOND_BOUND_SESSION_ID])
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('selects every idle 技能 and 专家 conversation while clear preserves running work', async () => {
    const view = createQuantSkillsViewStore().create()
    const layout = createQuantSkillsLayoutStore().create()
    const removeSessions = vi.fn(async (_ids: readonly SessionId[]) => {})
    view.actions.navigate('conversations')
    render(<QuantSkillsFrame
      useSessions={sessionsWithCurrent(SECOND_BOUND_SESSION_ID)}
      useWorkspaces={emptyWorkspaces()}
      useStore={bindSnapshotSelector(layout)}
      actions={layout.actions}
      useView={bindSnapshotSelector(view)}
      useCatalog={useCatalogState()}
      useBoundSessions={useBound(multiArchiveSessions)}
      useAgents={useAgentState(populatedAgents)}
      {...notificationProps()}
      openSession={() => {}}
      renameSession={async () => {}}
      removeSessions={removeSessions}
      startSession={async () => {}}
      startAuthoringSession={async () => {}}
      openAgentTeamBuilder={() => {}}
      renderSlot={name => <div data-testid={`bulk-${name}`}/>}
      SessionProvider={({ empty }) => empty?.()}
    />)

    fireEvent.click(screen.getByRole('button', { name: '批量管理' }))
    expect(screen.getByRole('toolbar', { name: '批量管理会话' })).toBeTruthy()
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: '选择会话 五日动量研究' }).disabled)
      .toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: '全选可删除会话' }))
    expect(screen.getByText('1 已选')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    expect(screen.getByRole('heading', { name: '删除选中的 1 个会话？' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '删除会话' }))

    await waitFor(() => {
      expect(removeSessions).toHaveBeenCalledOnce()
      expect(removeSessions.mock.calls[0]?.[0]).toEqual([SECOND_BOUND_SESSION_ID])
    })

    removeSessions.mockClear()
    fireEvent.click(screen.getByRole('button', { name: '批量管理' }))
    fireEvent.click(screen.getByRole('button', { name: '清空' }))
    expect(screen.getByRole('heading', { name: '清空 1 个可删除会话？' })).toBeTruthy()
    expect(screen.getByText('1 个运行中的会话会保留。')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '清空会话' }))
    await waitFor(() => {
      expect(removeSessions).toHaveBeenCalledOnce()
      expect(removeSessions.mock.calls[0]?.[0]).toEqual([SECOND_BOUND_SESSION_ID])
    })
  })

  it('records an archive completion notification without opening a result for a background refresh', async () => {
    const view = createQuantSkillsViewStore().create()
    const layout = createQuantSkillsLayoutStore().create()
    const bound = createSnapshotStore(populatedBoundSessions)
    const notifications = createQuantSkillsNotificationStore().create()
    const openSession = vi.fn()
    const setAppBadge = vi.fn(async (_count: number) => {})
    const clearAppBadge = vi.fn(async () => {})
    Object.defineProperties(navigator, {
      setAppBadge: { configurable: true, value: setAppBadge },
      clearAppBadge: { configurable: true, value: clearAppBadge },
    })
    view.actions.navigate('conversations')
    render(<QuantSkillsFrame
      useSessions={sessionsWithCurrent(BOUND_SESSION_ID)}
      useWorkspaces={emptyWorkspaces()}
      useStore={bindSnapshotSelector(layout)}
      actions={layout.actions}
      useView={bindSnapshotSelector(view)}
      useCatalog={useCatalogState()}
      useBoundSessions={bindSnapshotSelector(bound)}
      useAgents={useAgentState()}
      useNotifications={bindSnapshotSelector(notifications)}
      syncNotifications={notifications.actions.sync}
      acknowledgeNotification={notifications.actions.acknowledge}
      openSession={openSession}
      renameSession={async () => {}}
      removeSessions={async () => {}}
      startSession={async () => {}}
      startAuthoringSession={async () => {}}
      openAgentTeamBuilder={() => {}}
      renderSlot={name => <div data-testid={`notice-${name}`}/>}
      SessionProvider={({ empty }) => empty?.()}
    />)

    expect(screen.getByRole('button', { name: '会话通知' })).toBeTruthy()
    act(() => {
      bound.set({
        ...populatedBoundSessions,
        archives: populatedBoundSessions.archives.map(archive => archive.sessionId === BOUND_SESSION_ID
          ? { ...archive, running: false, runState: 'completed', updatedAt: archive.updatedAt + 1 }
          : archive),
      })
    })
    await waitFor(() => {
      expect(setAppBadge).toHaveBeenCalledWith(1)
    })
    expect(screen.queryByTestId('notice-quantskills.results')).toBeNull()
    expect(openSession).not.toHaveBeenCalled()
  })

  it('groups conversations into the five requested recency buckets', () => {
    const now = new Date(2026, 7, 21, 18, 0).getTime()
    vi.spyOn(Date, 'now').mockReturnValue(now)
    const dated: QuantSkillsSessionsSnapshot = {
      ...multiArchiveSessions,
      archives: [
        { ...multiArchiveSessions.archives[0]!, sessionId: 'last-hour' as SessionId, updatedAt: now - 30 * 60_000, running: false, runState: 'completed' },
        { ...multiArchiveSessions.archives[1]!, sessionId: 'today' as SessionId, updatedAt: now - 2 * 60 * 60_000, running: false, runState: 'completed' },
        { ...multiArchiveSessions.archives[0]!, sessionId: 'yesterday' as SessionId, updatedAt: new Date(2026, 7, 20, 12).getTime(), running: false, runState: 'completed' },
        { ...multiArchiveSessions.archives[1]!, sessionId: 'last-week' as SessionId, updatedAt: new Date(2026, 7, 18, 12).getTime(), running: false, runState: 'completed' },
        { ...multiArchiveSessions.archives[0]!, sessionId: 'history' as SessionId, updatedAt: new Date(2026, 7, 10, 12).getTime(), running: false, runState: 'completed' },
      ],
    }
    const view = createQuantSkillsViewStore().create()
    const layout = createQuantSkillsLayoutStore().create()
    view.actions.navigate('conversations')
    render(<QuantSkillsFrame
      useSessions={sessionsWithCurrent(BOUND_SESSION_ID)}
      useWorkspaces={emptyWorkspaces()}
      useStore={bindSnapshotSelector(layout)}
      actions={layout.actions}
      useView={bindSnapshotSelector(view)}
      useCatalog={useCatalogState()}
      useBoundSessions={useBound(dated)}
      useAgents={useAgentState()}
      {...notificationProps()}
      openSession={() => {}}
      renameSession={async () => {}}
      removeSessions={async () => {}}
      startSession={async () => {}}
      startAuthoringSession={async () => {}}
      openAgentTeamBuilder={() => {}}
      renderSlot={name => <div data-testid={`date-${name}`}/>}
      SessionProvider={({ empty }) => empty?.()}
    />)

    fireEvent.click(screen.getByRole('tab', { name: '技能5' }))
    const headings = screen.getAllByRole('heading').map(heading => heading.textContent)
    expect(headings).toEqual(expect.arrayContaining(['最近1小时1', '今天1', '昨天1', '最近7天1', '历史1']))
    expect(headings.indexOf('最近1小时1')).toBeLessThan(headings.indexOf('今天1'))
    expect(headings.indexOf('今天1')).toBeLessThan(headings.indexOf('昨天1'))
    expect(headings.indexOf('昨天1')).toBeLessThan(headings.indexOf('最近7天1'))
    expect(headings.indexOf('最近7天1')).toBeLessThan(headings.indexOf('历史1'))

    cleanup()
    mountApp('conversations', pandaReady, dated)
    const pageHeadings = screen.getAllByRole('heading').map(heading => heading.textContent)
    expect(pageHeadings).toEqual(expect.arrayContaining(['最近1小时1', '今天1', '昨天1', '最近7天1', '历史1']))
  })

  it('keeps running Sessions visible above the selected archive kind', () => {
    const bound: QuantSkillsSessionsSnapshot = {
      ...multiArchiveSessions,
      archives: multiArchiveSessions.archives.map(archive => ({
        ...archive,
        running: false,
        runState: 'completed',
      })),
    }
    const agents: QuantSkillsAgentsSnapshot = {
      ...populatedAgents,
      archives: populatedAgents.archives.map(archive => ({
        ...archive,
        title: '跨分类运行 专家',
        running: true,
        runState: 'running',
      })),
    }
    const view = createQuantSkillsViewStore().create()
    const layout = createQuantSkillsLayoutStore().create()
    view.actions.navigate('conversations')
    render(<QuantSkillsFrame
      useSessions={sessionsWithCurrent(BOUND_SESSION_ID)}
      useWorkspaces={emptyWorkspaces()}
      useStore={bindSnapshotSelector(layout)}
      actions={layout.actions}
      useView={bindSnapshotSelector(view)}
      useCatalog={useCatalogState()}
      useBoundSessions={useBound(bound)}
      useAgents={useAgentState(agents)}
      {...notificationProps()}
      openSession={() => {}}
      renameSession={async () => {}}
      removeSessions={async () => {}}
      startSession={async () => {}}
      startAuthoringSession={async () => {}}
      openAgentTeamBuilder={() => {}}
      renderSlot={name => <div data-testid={`running-${name}`}/>}
      SessionProvider={({ empty }) => empty?.()}
    />)

    expect(screen.getByRole('heading', { name: '运行中1' })).toBeTruthy()
    expect(screen.getByText('跨分类运行 专家')).toBeTruthy()
    const skillTab = screen.getByRole('tab', { name: /^技能\d+$/ })
    const agentTab = screen.getByRole('tab', { name: /^专家\d+$/ })
    const teamTab = screen.getByRole('tab', { name: /^专家团\d+$/ })
    expect(skillTab.getAttribute('aria-selected')).toBe('true')
    expect(agentTab).toBeTruthy()
    expect(teamTab).toBeTruthy()

    fireEvent.click(teamTab)
    expect(teamTab.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('heading', { name: '运行中1' })).toBeTruthy()
    expect(screen.getByText('跨分类运行 专家')).toBeTruthy()
  })
})

describe('QuantSkills authoritative Session views', () => {
  it('excludes ordinary DSH Sessions from the parallel page', () => {
    mountApp('parallel', pandaReady, emptyBoundSessions, sessionsWithCurrent(ORDINARY_SESSION_ID))

    expect(screen.getByRole('heading', { name: '暂无并行会话' })).toBeTruthy()
    expect(screen.queryByText('普通会话')).toBeNull()
  })

  it('continues the Host-computed recent archive and creates from its exact binding', () => {
    const openSession = vi.fn()
    const startBoundSession = vi.fn(async () => {})
    mountApp('home', pandaReady, multiArchiveSessions, emptySessions(), { openSession, startBoundSession })

    fireEvent.click(screen.getByRole('button', { name: '为 五日动量因子 新建会话' }))
    expect(startBoundSession).toHaveBeenCalledWith(
      multiArchiveSessions.archives[1]!.binding,
      '五日动量因子',
    )

    fireEvent.click(screen.getByRole('button', { name: /五日动量因子.*2 个存档.*继续最近会话/ }))
    expect(openSession).toHaveBeenCalledWith(SECOND_BOUND_SESSION_ID)
  })

  it('shows and switches multiple real archives for the same 技能', () => {
    const openSession = vi.fn()
    mountApp('conversations', pandaReady, multiArchiveSessions, emptySessions(), { openSession })

    expect(screen.getByRole('button', { name: /五日动量研究/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /五日动量复盘/ }))
    expect(openSession).toHaveBeenCalledWith(SECOND_BOUND_SESSION_ID)
  })

  it('shows immediate progress while starting a plain Session', async () => {
    let finish: (() => void) | undefined
    const startSession = vi.fn(() => new Promise<void>((resolve) => { finish = resolve }))
    mountApp('conversations', pandaReady, multiArchiveSessions, emptySessions(), { startSession })

    fireEvent.click(screen.getByRole('button', { name: '新建会话' }))

    expect(startSession).toHaveBeenCalledOnce()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '正在创建…' }).disabled).toBe(true)
    await act(async () => { finish?.() })
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '新建会话' }).disabled).toBe(false)
  })

  it('keeps a plain Session creation failure visible', async () => {
    const startSession = vi.fn(async () => { throw new Error('workspace unavailable') })
    mountApp('conversations', pandaReady, multiArchiveSessions, emptySessions(), { startSession })

    fireEvent.click(screen.getByRole('button', { name: '新建会话' }))

    await waitFor(() => { expect(screen.getByRole('alert').textContent).toBe('workspace unavailable') })
  })
})

describe('QuantSkills home catalog discovery', () => {
  it('offers 技能 creation with the original task when the AI finds no catalog coverage', async () => {
    const startTask = vi.fn(async () => ({
      kind: 'creation' as const,
      message: '目录还没有覆盖这种另类数据研究，可以为它创建一个专用 技能。',
    }))
    const startAuthoringSession = vi.fn(async () => {})
    mountApp('home', pandaReady, emptyBoundSessions, emptySessions(), {
      startTask,
      startAuthoringSession,
    })

    fireEvent.change(screen.getByRole('textbox', { name: '量化研究任务' }), {
      target: { value: '研究一个目录中还没有覆盖的另类数据策略' },
    })
    fireEvent.click(screen.getByRole('button', { name: '查找或创建 技能' }))

    expect(await screen.findByText('这个需求更适合创建新 技能')).toBeTruthy()
    expect(screen.getByText('目录还没有覆盖这种另类数据研究，可以为它创建一个专用 技能。')).toBeTruthy()
    expect(startTask).toHaveBeenCalledWith('研究一个目录中还没有覆盖的另类数据策略', undefined)
    fireEvent.click(screen.getByRole('button', { name: 'AI 创建 技能' }))
    await waitFor(() => {
      expect(startAuthoringSession).toHaveBeenCalledWith(
        'skill',
        '研究一个目录中还没有覆盖的另类数据策略',
      )
    })
  })

  it('asks one targeted question and carries the answer into the next AI guide turn', async () => {
    const startTask = vi.fn()
      .mockResolvedValueOnce({
        kind: 'clarification' as const,
        message: '股票研究可以从不同方向展开。',
        question: '你更关注哪个方向？',
        options: ['选股因子', '市场走势', '风险监控'],
      })
      .mockResolvedValueOnce({
        kind: 'recommendations' as const,
        message: '根据你的选择，五日动量最贴近当前目标。',
        suggestions: [{ asset: ASSET_ID, title: '五日动量因子', reason: '适合构建并验证选股信号。' }],
      })
    mountApp('home', pandaReady, emptyBoundSessions, emptySessions(), { startTask })

    fireEvent.change(screen.getByRole('textbox', { name: '量化研究任务' }), {
      target: { value: '股票相关的' },
    })
    fireEvent.click(screen.getByRole('button', { name: '查找或创建 技能' }))

    expect(await screen.findByText('帮我再确认一点')).toBeTruthy()
    expect(screen.getByText('你更关注哪个方向？')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '选股因子' }))

    await waitFor(() => {
      expect(startTask).toHaveBeenLastCalledWith(
        '股票相关的\n\nAI 追问：你更关注哪个方向？\n用户回答：选股因子',
        undefined,
      )
    })
    expect(await screen.findByText('我为你找到了 1 个选择')).toBeTruthy()
  })

  it('shows AI reasons and lets the user confirm one exact 技能 before installation', async () => {
    const startTask = vi.fn(async (_text: string, assetName?: string) => assetName === undefined
      ? {
          kind: 'recommendations' as const,
          message: '五日动量最适合快速验证价格延续信号。',
          suggestions: [{
            asset: ASSET_ID,
            title: '五日动量因子',
            reason: '它直接计算五日收益并提供 IC 与稳定性检验。',
          }],
        }
      : { kind: 'started' as const, asset: ASSET_ID, title: '五日动量因子' })
    mountApp('home', pandaReady, emptyBoundSessions, emptySessions(), { startTask })

    fireEvent.change(screen.getByRole('textbox', { name: '量化研究任务' }), {
      target: { value: '找一个动量研究工具' },
    })
    fireEvent.click(screen.getByRole('button', { name: '查找或创建 技能' }))
    expect(await screen.findByText('我为你找到了 1 个选择')).toBeTruthy()
    expect(screen.getByText('它直接计算五日收益并提供 IC 与稳定性检验。')).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: '使用这个 技能' }))

    await waitFor(() => {
      expect(startTask).toHaveBeenLastCalledWith('找一个动量研究工具', ASSET_ID)
    })
  })

  it('automatically checks without installing, highlights an update and shows exact release notes', async () => {
    let status: QuantSkillsApplicationUpdateStatus = { state: 'idle' }
    const start = vi.fn()
    const check = vi.fn(async () => {
      status = { state: 'available', source: 'github', candidateVersion: '0.1.20', candidateCommit: 'b'.repeat(40), releaseNotes: ['支持移动端与 Gitee 更新'] }
      return { accepted: 'started' as const, status }
    })
    mountApp('home', pandaReady, emptyBoundSessions, emptySessions(), {
      applicationUpdateStatus: async () => status, applicationUpdateCheck: check, applicationUpdateStart: start,
    })
    await waitFor(() => { expect(check).toHaveBeenCalledOnce() }, { timeout: 3000 })
    const button = await screen.findByRole('button', { name: '下载并更新' })
    expect(button.getAttribute('data-update-state')).toBe('available')
    expect(button.className).toContain('applicationUpdateAvailable')
    expect(screen.getByText('支持移动端与 Gitee 更新')).toBeTruthy()
    expect(screen.getByText(/不会自动导入或覆盖个人资产库/)).toBeTruthy()
    expect(start).not.toHaveBeenCalled()
  })

  it('checks GitHub by default only after the user requests it without preparing a current version', async () => {
    const applicationUpdateStatus = vi.fn()
      .mockResolvedValueOnce({ state: 'idle' as const })
      .mockResolvedValue({ state: 'current' as const })
    const applicationUpdateCheck = vi.fn(async () => ({
      accepted: 'started' as const,
      status: { state: 'checking' as const },
    }))
    const applicationUpdateStart = vi.fn(async () => ({
      accepted: 'started' as const,
      status: { state: 'preparing' as const, phase: 'fetching' as const },
    }))
    mountApp('home', pandaReady, emptyBoundSessions, emptySessions(), {
      applicationUpdateStatus,
      applicationUpdateCheck,
      applicationUpdateStart,
    })

    fireEvent.click(screen.getByRole('button', { name: '检查更新' }))

    await waitFor(() => { expect(applicationUpdateCheck).toHaveBeenCalledOnce() })
    expect(applicationUpdateCheck).toHaveBeenCalledWith({ source: 'github' })
    expect(applicationUpdateStart).not.toHaveBeenCalled()
    expect((await screen.findByRole('status')).textContent).toContain('已是最新正式版本。')
    expect(applicationUpdateStatus).toHaveBeenCalled()
  })

  it('lets the user select the domestic Gitee project repository for the next update check', async () => {
    const applicationUpdateCheck = vi.fn(async () => ({
      accepted: 'started' as const,
      status: { state: 'checking' as const, source: 'gitee' as const },
    }))
    mountApp('home', pandaReady, emptyBoundSessions, emptySessions(), {
      applicationUpdateStatus: async () => ({ state: 'idle' }),
      applicationUpdateCheck,
    })

    fireEvent.click(screen.getByRole('button', { name: '更新来源：GitHub（国外）' }))
    fireEvent.click(await screen.findByText('Gitee'))
    expect(screen.getByRole('button', { name: '更新来源：Gitee（国内）' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '检查更新' }))

    await waitFor(() => {
      expect(applicationUpdateCheck).toHaveBeenCalledWith({ source: 'gitee' })
    })
  })

  it('requires a second user confirmation before preparing an available candidate', async () => {
    let state: QuantSkillsApplicationUpdateStatus = { state: 'idle' }
    const applicationUpdateStatus = vi.fn(async () => state)
    const applicationUpdateCheck = vi.fn(async () => {
      state = {
        state: 'available' as const,
        source: 'github' as const,
        currentVersion: '0.1.15',
        currentCommit: 'a'.repeat(40),
        candidateVersion: '0.1.17',
        candidateCommit: 'b'.repeat(40),
      }
      return { accepted: 'started' as const, status: { state: 'checking' as const } }
    })
    const applicationUpdateStart = vi.fn(async () => {
      state = {
        state: 'ready' as const,
        source: 'github' as const,
        currentVersion: '0.1.15',
        currentCommit: 'a'.repeat(40),
        candidateVersion: '0.1.17',
        candidateCommit: 'b'.repeat(40),
      }
      return {
        accepted: 'started' as const,
        status: {
          state: 'preparing' as const,
          phase: 'fetching' as const,
          source: 'github' as const,
          currentVersion: '0.1.15',
          currentCommit: 'a'.repeat(40),
          candidateVersion: '0.1.17',
          candidateCommit: 'b'.repeat(40),
        },
      }
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mountApp('home', pandaReady, emptyBoundSessions, emptySessions(), {
      applicationUpdateStatus,
      applicationUpdateCheck,
      applicationUpdateStart,
    })

    fireEvent.click(screen.getByRole('button', { name: '检查更新' }))
    const prepare = await screen.findByRole('button', { name: '下载并更新' })
    expect(applicationUpdateStart).not.toHaveBeenCalled()

    fireEvent.click(prepare)

    await waitFor(() => { expect(applicationUpdateStart).toHaveBeenCalledOnce() })
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('是否继续'))
    expect((await screen.findByRole('status')).textContent).toContain('0.1.17')
    expect(screen.getByRole('status').textContent).toContain('下次正常启动时生效')
  })

  it('does not prepare an available candidate when the user cancels confirmation', async () => {
    const applicationUpdateStart = vi.fn(async () => ({
      accepted: 'started' as const,
      status: { state: 'preparing' as const, phase: 'fetching' as const },
    }))
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    mountApp('home', pandaReady, emptyBoundSessions, emptySessions(), {
      applicationUpdateStatus: async () => ({
        state: 'available',
        currentVersion: '0.1.15',
        currentCommit: 'a'.repeat(40),
        candidateVersion: '0.1.17',
        candidateCommit: 'b'.repeat(40),
      }),
      applicationUpdateStart,
    })

    fireEvent.click(await screen.findByRole('button', { name: '下载并更新' }))

    expect(window.confirm).toHaveBeenCalledOnce()
    expect(applicationUpdateStart).not.toHaveBeenCalled()
  })

  it('reports a candidate that was already prepared by an earlier confirmed request', async () => {
    const applicationUpdateStatus = vi.fn(async () => ({
      state: 'ready' as const,
      currentVersion: '0.1.15',
      currentCommit: 'a'.repeat(40),
      candidateVersion: '0.1.17',
      candidateCommit: 'b'.repeat(40),
    }))
    mountApp('home', pandaReady, emptyBoundSessions, emptySessions(), {
      applicationUpdateStatus,
    })

    expect((await screen.findByRole('status')).textContent).toContain('0.1.17')
    expect(screen.getByRole('status').textContent).toContain('下次正常启动时生效')
  })

  it('explains development-checkout protection as a neutral status', async () => {
    mountApp('home', pandaReady, emptyBoundSessions, emptySessions(), {
      applicationUpdateStatus: async () => ({
        state: 'blocked',
        errorCode: 'APPLICATION_UPDATE_DEVELOPMENT_DIRTY',
      }),
    })

    expect((await screen.findByRole('status')).textContent).toContain('检测到本地开发修改')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps category selection on the home page and shows official totals by category', () => {
    mountApp('home')

    expect(screen.getByRole('button', { name: /QS 官方公开库.*1.*1 个 技能.*0 个 专家/ })).toBeTruthy()
    const categoryMetrics = screen.getByRole('group', { name: '各分类公开项目数量' })
    expect(categoryMetrics.textContent).not.toContain('技能')
    expect(categoryMetrics.textContent).not.toContain('专家')
    fireEvent.click(screen.getByRole('button', { name: /因子研究.*1/ }))
    expect(screen.getByRole('heading', { name: 'QuantSkills', level: 1 })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /目录精选.*因子研究/ })).toBeTruthy()
    expect(screen.queryByPlaceholderText('搜索 技能、策略或数据源')).toBeNull()
  })

  it('shows catalog loading and retry states instead of a false zero total', () => {
    const refreshCatalog = vi.fn(async () => {})
    const unavailableCatalog: QuantSkillsCatalogSnapshot = {
      ...catalog,
      phase: 'error',
      categories: [],
      assets: [],
      catalogError: '宿主暂时无法读取 QuantSkills 官方目录。',
    }
    mountApp(
      'home',
      pandaReady,
      emptyBoundSessions,
      emptySessions(),
      { refreshCatalog },
      emptyAgents,
      unavailableCatalog,
    )

    const retry = screen.getByRole('button', { name: /QS 官方公开库.*目录暂不可用.*宿主暂时无法读取/ })
    expect(retry.textContent).not.toContain('0 个公开项目')
    fireEvent.click(retry)
    expect(refreshCatalog).toHaveBeenCalledOnce()
  })

  it('keeps an installed 技能 usable while the catalog refresh is stale', () => {
    const startSkillSession = vi.fn(async () => {})
    mountApp(
      'home',
      pandaReady,
      emptyBoundSessions,
      emptySessions(),
      { startSkillSession },
      emptyAgents,
      { ...catalogWithInstalled, phase: 'stale' },
    )

    const action = screen.getByRole<HTMLButtonElement>('button', { name: '使用 五日动量因子' })
    expect(action.textContent).toBe('使用')
    expect(action.disabled).toBe(false)
    fireEvent.click(action)
    expect(startSkillSession).toHaveBeenCalledWith(
      catalogWithInstalled.assets[0],
      catalogWithInstalled.versionsByAsset[ASSET_ID]?.[0],
    )
  })

  it('routes an 专家-only category to the filtered 专家 market', () => {
    const view = mountApp(
      'home',
      pandaReady,
      emptyBoundSessions,
      emptySessions(),
      {},
      emptyAgents,
      catalogWithAgentCategory,
    )

    fireEvent.click(screen.getByRole('button', { name: /量化专家与自动化.*1/ }))
    expect(screen.getByText('量化自动化研究专家')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /查看“量化专家与自动化”专家/ }))

    expect(view.store.getSnapshot()).toMatchObject({
      page: 'agents',
      agentWorkspaceTab: 'market',
      selectedAgentCategory: '10',
    })
    expect(screen.getByRole('button', { name: '量化专家与自动化 1' }).className).toContain('selected')
    expect(screen.getByRole('heading', { name: '量化自动化研究专家' })).toBeTruthy()
  })

  it('keeps 专家-only categories out of the 技能 filter bar', () => {
    mountApp(
      'skills',
      pandaReady,
      emptyBoundSessions,
      emptySessions(),
      {},
      emptyAgents,
      catalogWithAgentCategory,
    )

    expect(screen.queryByRole('button', { name: '量化专家与自动化' })).toBeNull()
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: '技能 排序' }).value)
      .toBe('recommended')
  })

  it('installs or starts the exact featured 技能 from its current Host projection', () => {
    const installAsset = vi.fn(async () => {})
    mountApp('home', pandaReady, emptyBoundSessions, emptySessions(), { installAsset })

    fireEvent.click(screen.getByRole('button', { name: '安装 五日动量因子' }))
    expect(installAsset).toHaveBeenCalledWith(catalog.assets[0])

    cleanup()
    const startSkillSession = vi.fn(async () => {})
    mountApp(
      'home',
      pandaReady,
      emptyBoundSessions,
      emptySessions(),
      { startSkillSession },
      emptyAgents,
      catalogWithInstalled,
    )

    fireEvent.click(screen.getByRole('button', { name: '使用 五日动量因子' }))
    expect(startSkillSession).toHaveBeenCalledWith(
      catalogWithInstalled.assets[0],
      catalogWithInstalled.versionsByAsset[ASSET_ID]?.[0],
    )
  })
})

describe('QuantSkills Host-owned Agents', () => {
  it('keeps expert discovery filters out of the independent team library', () => {
    const view = mountApp('agents', pandaReady, emptyBoundSessions, emptySessions(), {}, {
      ...agentTeamReadyAgents,
      teams: [agentTeamDefinition],
      librarySources: [
        ...agentTeamReadyAgents.definitions.map(item => ({ id: item.agentId, kind: 'agent' as const, source: 'personal' as const, method: 'manual' as const })),
        { id: agentTeamDefinition.teamId, kind: 'agent-team', source: 'personal', method: 'manual' },
      ],
    }, catalogWithInstalled)
    fireEvent.click(screen.getByRole('button', { name: '发现', exact: true }))
    act(() => view.actions.navigate('teams'))
    expect(screen.getByRole('heading', { name: agentTeamDefinition.name })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '发现', exact: true })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '已安装', exact: true }))
    expect(screen.queryByRole('heading', { name: agentTeamDefinition.name })).toBeNull()
    act(() => view.actions.navigate('agents'))
    expect(screen.getByRole('heading', { name: agentDefinition.name })).toBeTruthy()
    act(() => view.actions.navigate('teams'))
    expect(screen.queryByRole('heading', { name: agentTeamDefinition.name })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '我的创建', exact: true }))
    expect(screen.getByRole('heading', { name: agentTeamDefinition.name })).toBeTruthy()
  })

  it('opens the 专家团 builder in create mode from the shared view action', () => {
    const view = mountApp(
      'home',
      pandaReady,
      emptyBoundSessions,
      emptySessions(),
      {},
      agentTeamReadyAgents,
      catalogWithInstalled,
    )

    act(() => { view.actions.requestAgentTeamCreation({
      name: '预填研究团队',
      description: '由创作会话准备的团队目标。',
      leadAgentId: agentDefinition.agentId,
      leadModel: { kind: 'fixed', selection: { provider: 'deepseek-official', model: 'deepseek-v4-pro', reasoningEffort: 'high' } },
      members: [{
        name: 'validator',
        agentId: validatorAgentDefinition.agentId,
        context: 'fresh',
        model: { kind: 'default' },
      }],
    }) })

    expect(view.store.getSnapshot().page).toBe('teams')
    expect(screen.getByRole('heading', { name: '创建 专家团' })).toBeDefined()
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: '专家团 名称' }).value).toBe('预填研究团队')
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Lead 模型' }).value).toBe('deepseek-official\u0000deepseek-v4-pro')
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: '成员 1 模型' }).value).toBe('')
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: '专家团 名称' }))
    expect(view.store.getSnapshot().agentTeamCreationPending).toBe(false)
  })

  it('creates and starts a durable 专家团 from exact 专家 revisions', async () => {
    const createAgentTeam = vi.fn(async () => agentTeamDefinition)
    const startAgentTeamSession = vi.fn(async () => BOUND_SESSION_ID)
    const view = mountApp(
      'agents',
      pandaReady,
      emptyBoundSessions,
      emptySessions(),
      {
        createAgentTeam,
        startAgentTeamSession,
        listAgentModels: async () => [{
          provider: 'deepseek-official',
          providerLabel: 'DeepSeek',
          model: 'deepseek-v4-pro',
          modelLabel: 'DeepSeek V4 Pro',
          reasoningEfforts: [{ id: 'high', label: '高' }],
        }],
      },
      agentTeamReadyAgents,
      catalogWithInstalled,
    )

    act(() => { view.actions.navigate('teams') })
    fireEvent.click(screen.getAllByRole('button', { name: '手动编排' })[0]!)
    fireEvent.change(screen.getByRole('textbox', { name: '专家团 名称' }), {
      target: { value: agentTeamDefinition.name },
    })
    fireEvent.change(screen.getByRole('combobox', { name: '专家团 Lead' }), {
      target: { value: agentDefinition.agentId },
    })
    fireEvent.change(screen.getByRole('textbox', { name: '专家团 目标' }), {
      target: { value: agentTeamDefinition.description },
    })
    fireEvent.change(screen.getByRole('textbox', { name: '成员 1 标识' }), {
      target: { value: 'validator' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: '成员 1 专家' }), {
      target: { value: validatorAgentDefinition.agentId },
    })
    await waitFor(() => { expect(screen.getAllByRole('option', { name: 'DeepSeek · DeepSeek V4 Pro' })).toHaveLength(2) })
    fireEvent.change(screen.getByRole('combobox', { name: 'Lead 模型' }), {
      target: { value: 'deepseek-official\u0000deepseek-v4-pro' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'Lead 推理强度' }), {
      target: { value: 'high' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存并新建团队会话' }))

    await waitFor(() => {
      expect(createAgentTeam).toHaveBeenCalledWith({
        name: agentTeamDefinition.name,
        description: agentTeamDefinition.description,
        leadAgentId: agentDefinition.agentId,
        leadAgentRevision: agentDefinition.revision,
        leadModel: {
          kind: 'fixed',
          selection: { provider: 'deepseek-official', model: 'deepseek-v4-pro', reasoningEffort: 'high' },
        },
        members: [{
          name: 'validator',
          context: 'fresh',
          agentId: validatorAgentDefinition.agentId,
          agentRevision: validatorAgentDefinition.revision,
          model: { kind: 'default' },
        }],
      })
      expect(startAgentTeamSession).toHaveBeenCalledWith(agentTeamDefinition)
    })
  })

  it('generates an editable role draft and applies it only after explicit confirmation', async () => {
    const generateAgentRole = vi.fn(async () => '负责分析量化信号。\n\n交付中文研究报告，并明确风险限制。')
    mountApp(
      'agents',
      pandaReady,
      emptyBoundSessions,
      emptySessions(),
      { generateAgentRole },
      populatedAgents,
      catalogWithInstalled,
    )

    fireEvent.click(screen.getAllByRole('button', { name: '设置专家 量化研究助理' })[0]!)
    const role = screen.getByRole('textbox', { name: '专家 角色说明' }) as HTMLTextAreaElement
    const original = role.value
    fireEvent.click(screen.getByRole('button', { name: 'AI 帮写' }))
    expect(screen.getByRole('dialog', { name: 'AI 帮写角色说明' })).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: 'AI 帮写补充要求' }), {
      target: { value: '突出回测审计。' },
    })
    fireEvent.click(screen.getByRole('button', { name: '生成草稿' }))

    await waitFor(() => {
      expect(generateAgentRole).toHaveBeenCalledWith(expect.objectContaining({
        name: '量化研究助理',
        currentRole: original,
        instruction: '突出回测审计。',
        mode: 'dynamic',
        skills: [{ title: '五日动量因子', versionId: VERSION_ID }],
      }), expect.anything())
      expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'AI 角色说明草稿' }).value)
        .toContain('交付中文研究报告')
    })
    expect(role.value).toBe(original)

    fireEvent.click(screen.getByRole('button', { name: '替换原说明' }))
    expect(role.value).toContain('交付中文研究报告')
    expect(screen.queryByRole('dialog', { name: 'AI 帮写角色说明' })).toBeNull()
  })

  it('creates a durable 专家 from an ordered exact installed 技能 composition', async () => {
    const createAgent = vi.fn(async () => agentDefinition)
    mountApp(
      'agents',
      pandaReady,
      emptyBoundSessions,
      emptySessions(),
      { createAgent },
      emptyAgents,
      catalogWithInstalled,
    )

    fireEvent.click(screen.getAllByRole('button', { name: '手动配置 专家' })[0]!)
    fireEvent.change(screen.getByRole('textbox', { name: '专家 名称' }), {
      target: { value: '量化研究助理' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: '专家 角色说明' }), {
      target: { value: '与用户对话后完成量化研究。' },
    })
    fireEvent.click(screen.getByRole('button', { name: '添加 技能' }))
    fireEvent.click(screen.getByRole('radio', { name: /固定顺序/ }))
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(createAgent).toHaveBeenCalledWith({
        name: '量化研究助理',
        role: '与用户对话后完成量化研究。',
        mode: 'fixed',
        permission: 'workspace-write',
        versionIds: [VERSION_ID],
      })
    })
  })

  it('opens a real 专家 archive and starts a new Session from its exact revision', () => {
    const openSession = vi.fn()
    const startAgentSession = vi.fn(async () => BOUND_SESSION_ID)
    const view = mountApp(
      'agents',
      pandaReady,
      emptyBoundSessions,
      emptySessions(),
      { openSession, startAgentSession },
      populatedAgents,
      catalogWithInstalled,
    )

    fireEvent.click(screen.getByRole('button', { name: '继续对话' }))
    expect(openSession).toHaveBeenCalledWith(populatedAgents.archives[0]!.sessionId)

    act(() => { view.actions.navigate('agents') })
    fireEvent.click(screen.getByRole('button', { name: '新对话' }))
    expect(startAgentSession).toHaveBeenCalledWith(agentDefinition)
  })

  it('saves an edited 专家 before launching and blocks a stale Host projection', async () => {
    const updated = { ...agentDefinition, revision: 2, role: '这是一项已经保存的修改。' }
    const updateAgent = vi.fn(async () => updated)
    const startAgentSession = vi.fn(async () => BOUND_SESSION_ID)
    mountApp(
      'agents',
      pandaReady,
      emptyBoundSessions,
      emptySessions(),
      { updateAgent, startAgentSession },
      populatedAgents,
      catalogWithInstalled,
    )
    fireEvent.click(screen.getAllByRole('button', { name: '设置专家 量化研究助理' })[0]!)
    const launch = screen.getByRole('button', { name: '新建专家对话' }) as HTMLButtonElement
    expect(launch.disabled).toBe(false)

    fireEvent.change(screen.getByRole('textbox', { name: '专家 角色说明' }), {
      target: { value: '这是一项尚未保存的修改。' },
    })

    expect(screen.getByText('有未保存更改')).toBeTruthy()
    const saveAndLaunch = screen.getByRole('button', { name: '保存并新建对话' }) as HTMLButtonElement
    expect(saveAndLaunch.disabled).toBe(false)
    expect(screen.getByText('向 AI 提供按列表顺序使用全部 技能 的固定指引。')).toBeTruthy()
    fireEvent.click(saveAndLaunch)
    await waitFor(() => {
      expect(updateAgent).toHaveBeenCalledWith(expect.objectContaining({
        agentId: agentDefinition.agentId,
        expectedRevision: agentDefinition.revision,
        role: '这是一项尚未保存的修改。',
      }))
      expect(startAgentSession).toHaveBeenCalledWith(updated)
    })

    cleanup()
    mountApp(
      'agents',
      pandaReady,
      emptyBoundSessions,
      emptySessions(),
      {},
      { ...populatedAgents, phase: 'stale' },
      catalogWithInstalled,
    )
    fireEvent.click(screen.getAllByRole('button', { name: '设置专家 量化研究助理' })[0]!)
    expect(screen.getByText('Host 投影已过期')).toBeTruthy()
    expect(screen.getByRole('button', { name: '新建专家对话' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: '删除' })).toHaveProperty('disabled', true)
  })

  it('creates a role-only 专家 and exposes required and optional field semantics', async () => {
    const roleOnly = { ...agentDefinition, skills: [] }
    const createAgent = vi.fn(async () => roleOnly)
    mountApp(
      'agents',
      pandaReady,
      emptyBoundSessions,
      emptySessions(),
      { createAgent },
      emptyAgents,
      catalogWithInstalled,
    )

    fireEvent.click(screen.getAllByRole('button', { name: '手动配置 专家' })[0]!)
    expect(screen.getAllByText('必填').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('选填').length).toBeGreaterThanOrEqual(2)
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(screen.getByText('请输入专家名称。')).toBeTruthy()
    expect(screen.getByText('请输入角色说明。')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('请完成标记为必填的内容')
    expect(screen.getByRole('textbox', { name: '专家 名称' }).getAttribute('aria-invalid')).toBe('true')
    expect(createAgent).not.toHaveBeenCalled()
    fireEvent.change(screen.getByRole('textbox', { name: '专家 名称' }), {
      target: { value: '角色型研究助理' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: '专家 角色说明' }), {
      target: { value: '只使用角色指引和会话基础能力回答。' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(createAgent).toHaveBeenCalledWith(expect.objectContaining({
        name: '角色型研究助理',
        versionIds: [],
      }))
    })
  })
})

describe('QuantSkills update policy', () => {
  it('labels an installed older commit as an update and explains that existing Sessions stay pinned', () => {
    const installAsset = vi.fn(async () => {})
    const older = {
      versionId: `${ASSET_ID}@${'c'.repeat(40)}`,
      assetName: ASSET_ID,
      projectType: 'skill' as const,
      commitSha: 'c'.repeat(40),
      declarationFile: 'SKILL.md' as const,
      installedAt: 1,
      exposure: 'skill-registry' as const,
    }
    const updateCatalog: QuantSkillsCatalogSnapshot = {
      ...catalog,
      versionsByAsset: { [ASSET_ID]: [older] },
    }
    setDrawerOverlay(false)
    mountApp('skills', pandaReady, emptyBoundSessions, emptySessions(), { installAsset }, emptyAgents, updateCatalog)

    expect(screen.getByText('有更新 · 已有会话不变')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: `更新到 ${COMMIT.slice(0, 7)}` }))
    expect(installAsset).toHaveBeenCalledWith(updateCatalog.assets[0])

    fireEvent.click(screen.getByRole('button', { name: '查看 五日动量因子 详情' }))
    expect(screen.getByText(/已有会话继续使用原版本，新会话才使用/)).toBeTruthy()
  })

  it('keeps application updates manual and configures only automatic 技能 catalog checks', () => {
    mountApp('settings')
    fireEvent.click(screen.getByRole('button', { name: '自动更新' }))

    const catalogCheck = screen.getByRole('checkbox', { name: '自动检查 技能 目录（5 分钟）' })
    expect(screen.queryByRole('checkbox', { name: '自动更新 QuantSkills' })).toBeNull()
    expect(catalogCheck).toHaveProperty('checked', true)
    fireEvent.click(catalogCheck)
    expect(catalogCheck).toHaveProperty('checked', false)
    expect(screen.queryByRole('checkbox', { name: /自动安装 技能/ })).toBeNull()
    expect(screen.getByText(/始终由用户点击确认/)).toBeTruthy()
    expect(screen.getByText(/首页会自动检查所选来源的正式版本/)).toBeTruthy()
    expect(screen.getByText(/已有会话固定原版本，新会话才使用新安装版本/)).toBeTruthy()
  })
})

describe('QuantSkills functional settings and durable actions', () => {
  it('clears an unavailable custom Workspace and exposes the managed fallback', async () => {
    const setDefaultWorkspace = vi.fn(async () => {})
    const workspaceStatus = vi.fn(async () => ({
      managedPath: 'C:\\Users\\test\\Documents\\QuantSkills',
      preferredMissing: true,
    }))
    const view = mountApp('settings', pandaConnected, emptyBoundSessions, emptySessions(), {
      workspaceStatus,
      setDefaultWorkspace,
    })
    view.actions.setDefaultWorkspaceId('workspace-deleted')
    fireEvent.click(screen.getByRole('button', { name: '工作区' }))

    await waitFor(() => { expect(setDefaultWorkspace).toHaveBeenCalledWith(undefined) })
    expect(screen.getByText(/QuantSkills 默认工作区 · C:\\Users\\test\\Documents\\QuantSkills/)).toBeTruthy()
  })

  it('keeps managed Workspace controls out of the standalone application', async () => {
    const workspaceStatus = vi.fn(async () => ({
      managedPath: 'C:\\Users\\test\\Documents\\QuantSkills',
      preferredMissing: false,
    }))
    mountApp('settings', pandaConnected, emptyBoundSessions, emptySessions(), {
      managedWorkspace: false,
      workspaceStatus,
    })
    fireEvent.click(screen.getByRole('button', { name: '工作区' }))

    await waitFor(() => { expect(screen.getByRole('heading', { name: '工作区' })).toBeTruthy() })
    expect(screen.queryByRole('combobox', { name: 'QuantSkills 默认工作区' })).toBeNull()
    expect(screen.queryByText('新会话默认工作区')).toBeNull()
    expect(workspaceStatus).not.toHaveBeenCalled()
  })

  it('opens PandaData OAuth from settings without collecting a password', async () => {
    const authenticatePandaMcp = vi.fn(async () => ({
      ok: true as const,
      phase: 'connected' as const,
      url: 'https://pandadatamcp.pandaaiquant.com/mcp',
      toolCount: 6,
      toolNames: ['mcp__pandadata__call_pandadata'],
      message: '已连接 PandaData MCP。',
    }))
    mountApp('settings', pandaConnected, emptyBoundSessions, emptySessions(), { authenticatePandaMcp })
    fireEvent.click(screen.getByRole('button', { name: 'PandaData' }))
    await waitFor(() => { expect(screen.getByRole('heading', { name: 'PandaData' })).toBeTruthy() })
    expect(screen.queryByLabelText(/密码/)).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByRole('button', { name: '刷新状态' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '退出登录' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '登录' }))
    await waitFor(() => { expect(authenticatePandaMcp).toHaveBeenCalledTimes(1) })
    await waitFor(() => { expect(screen.getByText('已连接')).toBeTruthy() })
  })

  it('lets disconnected PandaData settings refresh status and log out', async () => {
    const refreshPandaMcp = vi.fn(async () => ({
      ok: true as const,
      phase: 'disconnected' as const,
      url: 'https://pandadatamcp.pandaaiquant.com/mcp',
      toolCount: 6,
      toolNames: ['mcp__pandadata__auth_status'],
      message: '尚未登录 PandaData。',
    }))
    const logoutPandaMcp = vi.fn(async () => ({
      ok: true as const,
      phase: 'disconnected' as const,
      url: 'https://pandadatamcp.pandaaiquant.com/mcp',
      toolCount: 6,
      toolNames: ['mcp__pandadata__auth_status'],
      message: '已退出 PandaData 登录。',
    }))
    mountApp('settings', pandaConnected, emptyBoundSessions, emptySessions(), { refreshPandaMcp, logoutPandaMcp })
    fireEvent.click(screen.getByRole('button', { name: 'PandaData' }))
    await waitFor(() => { expect(screen.getByRole('heading', { name: 'PandaData' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '刷新状态' }))
    await waitFor(() => { expect(refreshPandaMcp).toHaveBeenCalled() })
    fireEvent.click(screen.getByRole('button', { name: '退出登录' }))
    await waitFor(() => { expect(logoutPandaMcp).toHaveBeenCalledTimes(1) })
    await waitFor(() => { expect(screen.getByText('已退出 PandaData 登录。')).toBeTruthy() })
  })

  it('stores real default model, reasoning, and permission values for new Agents', async () => {
    const view = mountApp('settings', pandaConnected, emptyBoundSessions, emptySessions(), {
      listAgentModels: async () => [{
        provider: 'deepseek-official',
        providerLabel: 'DeepSeek',
        model: 'deepseek-v4-pro',
        modelLabel: 'DeepSeek V4 Pro',
        reasoningEfforts: [{ id: 'high', label: '高' }],
      }],
    })
    fireEvent.click(screen.getByRole('button', { name: '模型与权限' }))
    await waitFor(() => { expect(screen.getByRole('option', { name: 'DeepSeek · DeepSeek V4 Pro' })).toBeTruthy() })
    fireEvent.change(screen.getByRole('combobox', { name: '默认 专家 模型' }), {
      target: { value: 'deepseek-official\u0000deepseek-v4-pro' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: '默认 专家 推理强度' }), {
      target: { value: 'high' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: '默认 专家 权限' }), {
      target: { value: 'read-only' },
    })

    expect(view.store.getSnapshot()).toMatchObject({
      defaultAgentProvider: 'deepseek-official',
      defaultAgentModel: 'deepseek-v4-pro',
      defaultAgentReasoningEffort: 'high',
      defaultAgentPermission: 'read-only',
    })
  })

  it('starts a favorite 技能 with its installed version and continues its own history', async () => {
    const startSkillSession = vi.fn(async () => {})
    const openSession = vi.fn()
    const view = mountApp('favorites', pandaConnected, populatedBoundSessions, emptySessions(), { startSkillSession, openSession }, emptyAgents, catalogWithInstalled)
    act(() => view.actions.setFavoriteAssetIds([ASSET_ID]))
    fireEvent.click(screen.getByRole('button', { name: '继续对话' }))
    expect(openSession).toHaveBeenCalledWith(BOUND_SESSION_ID)
    fireEvent.click(screen.getByRole('button', { name: '新对话' }))
    await waitFor(() => expect(startSkillSession).toHaveBeenCalledWith(expect.objectContaining({ name: ASSET_ID }), expect.objectContaining({ versionId: VERSION_ID })))
  })

  it('starts favorite Agents and Teams using the saved definitions', async () => {
    const startAgentSession = vi.fn(async () => BOUND_SESSION_ID)
    const startAgentTeamSession = vi.fn(async () => BOUND_SESSION_ID)
    const view = mountApp('favorites', pandaConnected, emptyBoundSessions, emptySessions(), { startAgentSession, startAgentTeamSession }, { ...agentTeamReadyAgents, teams: [agentTeamDefinition] })
    act(() => view.actions.setFavoriteAssetIds([`agent:${AGENT_ID}`, `team:${agentTeamDefinition.teamId}`]))
    fireEvent.click(screen.getByRole('button', { name: '开始对话' }))
    await waitFor(() => expect(startAgentSession).toHaveBeenCalledWith(agentDefinition))
    await waitFor(() => expect((screen.getByRole('button', { name: '开始团队会话' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: '开始团队会话' }))
    await waitFor(() => expect(startAgentTeamSession).toHaveBeenCalledWith(agentTeamDefinition))
  })

  it('uses the persisted favorite list instead of a preview-only page', () => {
    const view = mountApp('skills', pandaConnected)
    fireEvent.click(screen.getByRole('button', { name: '收藏 五日动量因子' }))
    expect(view.store.getSnapshot().favoriteAssetIds).toEqual([ASSET_ID])

    act(() => { view.actions.navigate('favorites') })
    expect(screen.getByRole('heading', { name: '收藏', level: 1 })).toBeTruthy()
    expect(screen.getByRole('button', { name: '安装技能' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '取消收藏 五日动量因子' }))
    expect(view.store.getSnapshot().favoriteAssetIds).toEqual([])
    expect(screen.getByRole('heading', { name: '收藏常用的能力' })).toBeTruthy()
  })
})

describe('QuantSkills responsive drawers', () => {
  it('renders the exact repository README instead of the English catalog description', async () => {
    setDrawerOverlay(false)
    const readAssetReadme = vi.fn(async () => ({
      assetId: ASSET_ID,
      commit: COMMIT,
      path: 'README.md' as const,
      markdown: '# 五日动量因子\n\n## 数据来源与边界\n\n- 使用仓库中文说明。',
    }))
    mountApp('skills', pandaReady, emptyBoundSessions, emptySessions(), { readAssetReadme })

    fireEvent.click(screen.getByRole('button', { name: '查看 五日动量因子 详情' }))

    await waitFor(() => { expect(screen.getByRole('heading', { name: '数据来源与边界' })).toBeTruthy() })
    expect(readAssetReadme).toHaveBeenCalledWith(catalog.assets[0], expect.any(AbortSignal))
    expect(screen.getByRole('link', { name: /查看仓库原文/ }).getAttribute('href')).toBe(
      `${catalog.assets[0]?.url}/blob/${COMMIT}/README.md`,
    )
    expect(screen.queryByText('公开的标准 QuantSkills 技能。')).toBeNull()
  })

  it('falls back to the Chinese catalog summary when README loading fails', async () => {
    setDrawerOverlay(false)
    mountApp('skills', pandaReady, emptyBoundSessions, emptySessions(), {
      readAssetReadme: async () => { throw new Error('README unavailable') },
    })
    fireEvent.click(screen.getByRole('button', { name: '查看 五日动量因子 详情' }))

    await waitFor(() => { expect(screen.getByText('技能说明暂时无法读取')).toBeTruthy() })
    expect(screen.getAllByText('计算并验证五日动量').length).toBeGreaterThan(0)
    expect(screen.queryByText('公开的标准 QuantSkills 技能。')).toBeNull()
  })

  it('searches localized metadata and persists a user-local display name without changing the asset id', () => {
    const view = mountApp('skills')
    const search = screen.getByPlaceholderText('搜索 技能、策略或数据源')

    fireEvent.change(search, { target: { value: 'Five Day Momentum' } })
    const details = screen.getByRole('button', { name: '查看 五日动量因子 详情' })
    expect(screen.getAllByText(ASSET_ID).length).toBeGreaterThan(0)

    fireEvent.click(details)
    fireEvent.change(screen.getByRole('textbox', { name: '本地显示名称' }), {
      target: { value: '我的五日动量研究' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    expect(view.store.getSnapshot().assetDisplayNameOverrides).toEqual([{
      assetId: ASSET_ID,
      displayName: '我的五日动量研究',
    }])
    fireEvent.click(screen.getByRole('button', { name: '关闭 技能 详情' }))
    fireEvent.change(search, { target: { value: '我的五日动量研究' } })
    expect(screen.getByRole('button', { name: '查看 我的五日动量研究 详情' })).toBeTruthy()
  })

  it('opens 技能 details through a real button and restores it after Escape', async () => {
    setDrawerOverlay(true)
    mountApp('skills')
    const trigger = screen.getByRole('button', { name: '查看 五日动量因子 详情' })

    expect(trigger.querySelector('button')).toBeNull()
    fireEvent.click(trigger)
    expect(screen.getByRole('region', { name: '五日动量因子' }).getAttribute('aria-modal')).toBeNull()
    await waitFor(() => { expect(document.activeElement).toBe(screen.getByRole('button', { name: '关闭 技能 详情' })) })

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull() })
    expect(document.activeElement).toBe(trigger)
  })

  it('keeps a desktop-pinned 技能 drawer as a labelled non-modal region', () => {
    setDrawerOverlay(false)
    mountApp('skills')
    fireEvent.click(screen.getByRole('button', { name: '查看 五日动量因子 详情' }))

    const region = screen.getByRole('region', { name: '五日动量因子' })
    expect(region.getAttribute('aria-modal')).toBeNull()
  })

})

describe('QuantSkills AI authoring action', () => {
  it('starts independent 技能, 专家, and 专家团 authoring Sessions', async () => {
    const start = vi.fn(async () => {})
    render(<QuantSkillsAuthoringAction start={start} openAgentTeamBuilder={() => {}}/>)

    fireEvent.click(screen.getByRole('button', { name: '创建' }))
    expect(screen.getByRole('menu')).toBeTruthy()
    fireEvent.click(screen.getByRole('menuitem', { name: /创建 专家团/ }))
    await waitFor(() => { expect(start).toHaveBeenCalledWith('agent-team') })
    expect(screen.queryByRole('menu')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '创建' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /AI 创建 技能/ }))

    await waitFor(() => { expect(start).toHaveBeenCalledWith('skill') })
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

describe('QuantSkills 专家团 draft confirmation card', () => {
  it('requires an explicit button before saving or starting and can open the prefilled builder', async () => {
    const commitAuthoring = vi.fn(async () => ({ kind: 'agent-team' as const, team: agentTeamDefinition }))
    const startAgentTeamSession = vi.fn(async () => {})
    const openAgentTeamBuilder = vi.fn()
    const focusComposer = vi.fn()
    const result = {
      kind: 'draft',
      treeDigest: TREE_DIGEST,
      draft: {
        name: '风险审查团队',
        description: '完成研究并交付可复核结论。',
        lead: { agentId: agentDefinition.agentId, revision: agentDefinition.revision },
        leadModel: {
          kind: 'fixed',
          selection: { provider: 'deepseek-official', model: 'deepseek-v4-pro', reasoningEffort: 'high' },
        },
        members: [{
          name: 'validator',
          responsibility: '验证数据与结论。',
          context: 'fresh',
          agent: { agentId: validatorAgentDefinition.agentId, revision: validatorAgentDefinition.revision },
          model: { kind: 'default' },
        }],
        diagnostics: [{ level: 'info', code: 'exact-revisions', message: '已冻结精确版本。' }],
      },
      diagnostics: [{ level: 'info', code: 'exact-revisions', message: '已冻结精确版本。' }],
    }
    render(<QuantSkillsTeamDraftCard
      callId="team-draft-call"
      toolName="quantskills_team_draft"
      sessionId={BOUND_SESSION_ID}
      useSessions={emptySessions()}
      useWorkspaces={emptyWorkspaces()}
      useSession={(() => { throw new Error('unused') })}
      useProjection={(() => undefined)}
      useInput={(() => { throw new Error('unused') })}
      inputActions={{
        setDraft: () => {},
        addImages: () => true,
        removeImage: () => {},
        pruneImages: () => {},
        submit: () => {},
      }}
      block={{
        kind: 'tool-result', seq: 4, time: 5, callId: 'team-draft-call',
        call: { name: 'quantskills_team_draft', argsRaw: '{}' }, callTime: 3,
        content: [{ type: 'text', text: JSON.stringify(result) }], isError: false,
        callView: null, resultView: null, subCalls: [],
      }}
      openFile={() => {}}
      useAgents={bindSnapshotSelector(createSnapshotStore(agentTeamReadyAgents))}
      commitAuthoring={commitAuthoring}
      startAgentTeamSession={startAgentTeamSession}
      openAgentTeamBuilder={openAgentTeamBuilder}
      focusComposer={focusComposer}
    />)

    expect(commitAuthoring).not.toHaveBeenCalled()
    expect(startAgentTeamSession).not.toHaveBeenCalled()
    expect(screen.getByText('deepseek-official · deepseek-v4-pro · high')).toBeTruthy()
    expect(screen.getByText('跟随会话默认模型')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '仅保存团队' }))
    await waitFor(() => { expect(commitAuthoring).toHaveBeenCalledOnce() })
    expect(commitAuthoring).toHaveBeenCalledWith('team-draft-call', TREE_DIGEST)
    fireEvent.click(screen.getByRole('button', { name: '创建并启动团队' }))
    await waitFor(() => { expect(startAgentTeamSession).toHaveBeenCalledWith(agentTeamDefinition) })
    expect(commitAuthoring).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: '打开手动编排' }))
    expect(openAgentTeamBuilder).toHaveBeenCalledWith(expect.objectContaining({
      name: '风险审查团队',
      leadAgentId: agentDefinition.agentId,
      leadModel: {
        kind: 'fixed',
        selection: { provider: 'deepseek-official', model: 'deepseek-v4-pro', reasoningEffort: 'high' },
      },
      members: [expect.objectContaining({ name: 'validator', model: { kind: 'default' } })],
    }))
    fireEvent.click(screen.getByRole('button', { name: '继续修改' }))
    expect(focusComposer).toHaveBeenCalledOnce()
  })
})
