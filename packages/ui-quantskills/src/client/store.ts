import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { QuantSkillsAgentTeamModelChoice } from './plugin-types.ts'
import {
  DEFAULT_QUANTSKILLS_AGENT_PERMISSION, DEFAULT_QUANTSKILLS_AUTO_CHECK_CATALOG,
  DEFAULT_QUANTSKILLS_AUTO_CHECK_PANDA, DEFAULT_QUANTSKILLS_COLOR_SCHEME,
  DEFAULT_QUANTSKILLS_CONVERSATION_BRIGHTNESS, DEFAULT_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY,
  DEFAULT_QUANTSKILLS_DARK_BACKGROUND, DEFAULT_QUANTSKILLS_LIGHT_BACKGROUND,
  DEFAULT_QUANTSKILLS_RESUME_AFTER_PANDA_LOGIN,
  type QuantSkillsColorScheme, type QuantSkillsDarkBackground, type QuantSkillsDefaultAgentPermission,
  type QuantSkillsLightBackground, type QuantSkillsSettings,
  type QuantSkillsAssetDisplayNameOverride,
} from '../appearance-settings.ts'
import type { QuantSkillsPage } from './types.ts'

/** Viewing state shared by the QuantSkills rail, pages, and drawers. */
export interface QuantSkillsViewState {
  pluginOpen: boolean
  pluginConversationOpen: boolean
  page: QuantSkillsPage
  agentWorkspaceTab: 'mine' | 'teams' | 'market'
  agentTeamCreationPending: boolean
  agentTeamBuilderSeed: QuantSkillsAgentTeamBuilderSeed | undefined
  selectedSkill: string | undefined
  selectedCategory: string
  selectedAgentCategory: string
  search: string
  catalogView: 'list' | 'grid'
  catalogSort: 'recommended' | 'name' | 'category'
  skillDrawerOpen: boolean
  conversationsPinned: boolean
  settingsSection: 'plugins' | 'models' | 'workspace' | 'updates' | 'permissions' | 'appearance' | 'panda-data' | 'brand-support'
  interfaceScale: number
  conversationScale: number
  conversationBrightness: number
  conversationOverlayOpacity: number
  colorScheme: QuantSkillsColorScheme
  lightBackground: QuantSkillsLightBackground
  darkBackground: QuantSkillsDarkBackground
  autoCheckCatalog: boolean
  autoCheckPanda: boolean
  resumeAfterPandaLogin: boolean
  favoriteAssetIds: string[]
  assetDisplayNameOverrides: QuantSkillsAssetDisplayNameOverride[]
  defaultAgentProvider: string
  defaultAgentModel: string
  defaultAgentReasoningEffort: string
  defaultAgentPermission: QuantSkillsDefaultAgentPermission
  defaultWorkspaceId: string | undefined
  workspaceRecoveryNotice: string | undefined
  settingsStatus: 'loading' | 'ready' | 'unavailable'
  settingsWritable: boolean
  pendingPandaTaskLabel: string | undefined
  resultPreviewRequest: {
    sessionId: SessionId
    path: string
    sequence: number
    focusPending: boolean
  } | undefined
}

/** Optional values prepared by AI authoring before the manual Team builder opens. */
export interface QuantSkillsAgentTeamBuilderSeed {
  readonly name: string
  readonly description: string
  readonly leadAgentId: string
  readonly leadModel: QuantSkillsAgentTeamModelChoice
  readonly members: readonly {
    readonly name: string
    readonly agentId: string
    readonly context: 'fresh' | 'fork'
    readonly model: QuantSkillsAgentTeamModelChoice
  }[]
}

type QuantSkillsViewActions = {
  openPlugin: (draft: QuantSkillsViewState) => void
  closePlugin: (draft: QuantSkillsViewState) => void
  openPluginConversation: (draft: QuantSkillsViewState) => void
  showPluginConversationIndex: (draft: QuantSkillsViewState) => void
  navigate: (draft: QuantSkillsViewState, page: QuantSkillsPage) => void
  setAgentWorkspaceTab: (draft: QuantSkillsViewState, tab: QuantSkillsViewState['agentWorkspaceTab']) => void
  requestAgentTeamCreation: (draft: QuantSkillsViewState, seed?: QuantSkillsAgentTeamBuilderSeed) => void
  consumeAgentTeamCreation: (draft: QuantSkillsViewState) => void
  selectSkill: (draft: QuantSkillsViewState, name?: string) => void
  setCategory: (draft: QuantSkillsViewState, category: string) => void
  setAgentCategory: (draft: QuantSkillsViewState, category: string) => void
  setSearch: (draft: QuantSkillsViewState, search: string) => void
  setCatalogView: (draft: QuantSkillsViewState, view: 'list' | 'grid') => void
  setCatalogSort: (draft: QuantSkillsViewState, sort: QuantSkillsViewState['catalogSort']) => void
  closeSkillDrawer: (draft: QuantSkillsViewState) => void
  toggleConversationsPinned: (draft: QuantSkillsViewState) => void
  setSettingsSection: (draft: QuantSkillsViewState, section: QuantSkillsViewState['settingsSection']) => void
  setInterfaceScale: (draft: QuantSkillsViewState, scale: number) => void
  setConversationScale: (draft: QuantSkillsViewState, scale: number) => void
  setConversationOverlayOpacity: (draft: QuantSkillsViewState, opacity: number) => void
  setConversationBrightness: (draft: QuantSkillsViewState, brightness: number) => void
  setColorScheme: (draft: QuantSkillsViewState, scheme: QuantSkillsColorScheme) => void
  setLightBackground: (draft: QuantSkillsViewState, background: QuantSkillsLightBackground) => void
  setDarkBackground: (draft: QuantSkillsViewState, background: QuantSkillsDarkBackground) => void
  setAutoCheckCatalog: (draft: QuantSkillsViewState, enabled: boolean) => void
  setAutoCheckPanda: (draft: QuantSkillsViewState, enabled: boolean) => void
  setResumeAfterPandaLogin: (draft: QuantSkillsViewState, enabled: boolean) => void
  setFavoriteAssetIds: (draft: QuantSkillsViewState, assetIds: readonly string[]) => void
  setAssetDisplayNameOverrides: (
    draft: QuantSkillsViewState,
    overrides: readonly QuantSkillsAssetDisplayNameOverride[],
  ) => void
  setDefaultAgentModel: (
    draft: QuantSkillsViewState,
    provider: string,
    model: string,
    reasoningEffort: string,
  ) => void
  setDefaultAgentPermission: (
    draft: QuantSkillsViewState,
    permission: QuantSkillsDefaultAgentPermission,
  ) => void
  setDefaultWorkspaceId: (draft: QuantSkillsViewState, workspaceId?: string) => void
  setWorkspaceRecoveryNotice: (draft: QuantSkillsViewState, notice?: string) => void
  syncSettings: (
    draft: QuantSkillsViewState,
    value: QuantSkillsSettings | undefined,
    status: QuantSkillsViewState['settingsStatus'],
    writable: boolean,
  ) => void
  setPendingPandaTask: (draft: QuantSkillsViewState, label?: string) => void
  requestResultPreview: (draft: QuantSkillsViewState, sessionId: SessionId, path: string) => void
  acknowledgeResultPreviewFocus: (draft: QuantSkillsViewState, sessionId: SessionId, sequence: number) => void
}

/**
 * Create the root viewing-state store for the QuantSkills application.
 * @returns an exclusive store handle mounted by the root slot registration.
 */
export function createQuantSkillsViewStore(): EngineStoreHandle<QuantSkillsViewState, QuantSkillsViewActions> {
  return defineStore({
    init: (): QuantSkillsViewState => ({
      pluginOpen: false,
      pluginConversationOpen: false,
      page: 'home',
      agentWorkspaceTab: 'mine',
      agentTeamCreationPending: false,
      agentTeamBuilderSeed: undefined,
      selectedSkill: undefined,
      selectedCategory: 'all',
      selectedAgentCategory: 'all',
      search: '',
      catalogView: 'list',
      catalogSort: 'recommended',
      skillDrawerOpen: false,
      conversationsPinned: true,
      settingsSection: 'workspace',
      interfaceScale: 1,
      conversationScale: 1,
      conversationBrightness: DEFAULT_QUANTSKILLS_CONVERSATION_BRIGHTNESS,
      conversationOverlayOpacity: DEFAULT_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY,
      colorScheme: DEFAULT_QUANTSKILLS_COLOR_SCHEME,
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
      defaultWorkspaceId: undefined,
      workspaceRecoveryNotice: undefined,
      settingsStatus: 'loading',
      settingsWritable: false,
      pendingPandaTaskLabel: undefined,
      resultPreviewRequest: undefined,
    }),
    actions: {
      openPlugin: (draft) => { draft.pluginOpen = true },
      closePlugin: (draft) => {
        draft.pluginOpen = false
        draft.pluginConversationOpen = false
      },
      openPluginConversation: (draft) => {
        draft.pluginOpen = true
        draft.pluginConversationOpen = true
        draft.page = 'conversations'
      },
      showPluginConversationIndex: (draft) => {
        draft.pluginConversationOpen = false
        draft.page = 'conversations'
      },
      navigate: (draft, page) => {
        draft.page = page
        if (page === 'teams') draft.agentWorkspaceTab = 'teams'
        if (page === 'agents' && draft.agentWorkspaceTab === 'teams') draft.agentWorkspaceTab = 'mine'
        if (page !== 'conversations') draft.pluginConversationOpen = false
        if (page !== 'skills') draft.skillDrawerOpen = false
      },
      setAgentWorkspaceTab: (draft, tab) => {
        draft.agentWorkspaceTab = tab
        if (tab === 'teams') draft.page = 'teams'
        else if (draft.page === 'teams') draft.page = 'agents'
      },
      requestAgentTeamCreation: (draft, seed) => {
        draft.pluginConversationOpen = false
        draft.page = 'teams'
        draft.agentWorkspaceTab = 'teams'
        draft.agentTeamCreationPending = true
        draft.agentTeamBuilderSeed = seed === undefined ? undefined : {
          ...seed,
          members: seed.members.map(member => ({ ...member })),
        }
        draft.skillDrawerOpen = false
      },
      consumeAgentTeamCreation: (draft) => {
        draft.agentTeamCreationPending = false
        draft.agentTeamBuilderSeed = undefined
      },
      selectSkill: (draft, name) => {
        draft.selectedSkill = name
        draft.skillDrawerOpen = name !== undefined
      },
      setCategory: (draft, category) => { draft.selectedCategory = category },
      setAgentCategory: (draft, category) => { draft.selectedAgentCategory = category },
      setSearch: (draft, search) => { draft.search = search },
      setCatalogView: (draft, view) => { draft.catalogView = view },
      setCatalogSort: (draft, sort) => { draft.catalogSort = sort },
      closeSkillDrawer: (draft) => { draft.skillDrawerOpen = false },
      toggleConversationsPinned: (draft) => { draft.conversationsPinned = !draft.conversationsPinned },
      setSettingsSection: (draft, section) => { draft.settingsSection = section },
      setInterfaceScale: (draft, scale) => { draft.interfaceScale = scale },
      setConversationScale: (draft, scale) => { draft.conversationScale = scale },
      setConversationOverlayOpacity: (draft, opacity) => { draft.conversationOverlayOpacity = opacity },
      setConversationBrightness: (draft, brightness) => { draft.conversationBrightness = brightness },
      setColorScheme: (draft, scheme) => { draft.colorScheme = scheme },
      setLightBackground: (draft, background) => { draft.lightBackground = background },
      setDarkBackground: (draft, background) => { draft.darkBackground = background },
      setAutoCheckCatalog: (draft, enabled) => { draft.autoCheckCatalog = enabled },
      setAutoCheckPanda: (draft, enabled) => { draft.autoCheckPanda = enabled },
      setResumeAfterPandaLogin: (draft, enabled) => { draft.resumeAfterPandaLogin = enabled },
      setFavoriteAssetIds: (draft, assetIds) => { draft.favoriteAssetIds = [...assetIds] },
      setAssetDisplayNameOverrides: (draft, overrides) => {
        draft.assetDisplayNameOverrides = overrides.map(entry => ({ ...entry }))
      },
      setDefaultAgentModel: (draft, provider, model, reasoningEffort) => {
        draft.defaultAgentProvider = provider
        draft.defaultAgentModel = model
        draft.defaultAgentReasoningEffort = reasoningEffort
      },
      setDefaultAgentPermission: (draft, permission) => { draft.defaultAgentPermission = permission },
      setDefaultWorkspaceId: (draft, workspaceId) => { draft.defaultWorkspaceId = workspaceId },
      setWorkspaceRecoveryNotice: (draft, notice) => { draft.workspaceRecoveryNotice = notice },
      syncSettings: (draft, value, status, writable) => {
        draft.settingsStatus = status
        draft.settingsWritable = writable
        if (value === undefined) return
        draft.interfaceScale = value.interfaceScale
        draft.conversationScale = value.conversationScale
        draft.conversationBrightness = value.conversationBrightness
        draft.conversationOverlayOpacity = value.conversationOverlayOpacity ?? DEFAULT_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY
        draft.colorScheme = value.colorScheme
        draft.lightBackground = value.lightBackground
        draft.darkBackground = value.darkBackground
        draft.autoCheckCatalog = value.autoCheckCatalog
        draft.autoCheckPanda = value.autoCheckPanda
        draft.resumeAfterPandaLogin = value.resumeAfterPandaLogin
        draft.favoriteAssetIds = [...value.favoriteAssetIds]
        draft.assetDisplayNameOverrides = value.assetDisplayNameOverrides.map(entry => ({ ...entry }))
        draft.defaultAgentProvider = value.defaultAgentProvider
        draft.defaultAgentModel = value.defaultAgentModel
        draft.defaultAgentReasoningEffort = value.defaultAgentReasoningEffort
        draft.defaultAgentPermission = value.defaultAgentPermission
        draft.defaultWorkspaceId = value.defaultWorkspaceId
      },
      setPendingPandaTask: (draft, label) => { draft.pendingPandaTaskLabel = label },
      requestResultPreview: (draft, sessionId, path) => {
        draft.resultPreviewRequest = {
          sessionId,
          path,
          sequence: (draft.resultPreviewRequest?.sequence ?? 0) + 1,
          focusPending: true,
        }
      },
      acknowledgeResultPreviewFocus: (draft, sessionId, sequence) => {
        const request = draft.resultPreviewRequest
        if (request?.sessionId === sessionId && request.sequence === sequence) request.focusPending = false
      },
    },
  })
}

/** Frame geometry owned by the QuantSkills root entry. */
export interface QuantSkillsLayoutState {
  sidebarOpen: boolean
  sidebarReservation: number
  detailsOpen: boolean
  detailsReservation: number
  resultsOpen: boolean
  conversationTextScale: number
  conversationTextScaleClaimed: boolean
}

type QuantSkillsLayoutActions = {
  toggleSidebar: (draft: QuantSkillsLayoutState) => void
  setSidebarReservation: (draft: QuantSkillsLayoutState, px: number) => void
  setDetailsReservation: (draft: QuantSkillsLayoutState, px: number) => void
  openDetails: (draft: QuantSkillsLayoutState) => void
  closeDetails: (draft: QuantSkillsLayoutState) => void
  openResults: (draft: QuantSkillsLayoutState) => void
  closeResults: (draft: QuantSkillsLayoutState) => void
  setConversationTextScale: (draft: QuantSkillsLayoutState, scale: number, claimed: boolean) => void
}

/**
 * Create the root frame store used by the layout-compatible service.
 * @returns an exclusive layout store handle mounted by the root slot registration.
 */
export function createQuantSkillsLayoutStore(): EngineStoreHandle<QuantSkillsLayoutState, QuantSkillsLayoutActions> {
  return defineStore({
    init: (): QuantSkillsLayoutState => ({
      sidebarOpen: true,
      sidebarReservation: 0,
      detailsOpen: false,
      detailsReservation: 0,
      resultsOpen: false,
      conversationTextScale: 1,
      conversationTextScaleClaimed: false,
    }),
    actions: {
      toggleSidebar: (draft) => { draft.sidebarOpen = !draft.sidebarOpen },
      setSidebarReservation: (draft, px) => {
        draft.sidebarReservation = Math.max(0, Math.round(px))
      },
      setDetailsReservation: (draft, px) => {
        draft.detailsReservation = Math.max(0, Math.round(px))
      },
      openDetails: (draft) => {
        draft.detailsOpen = true
        draft.resultsOpen = false
      },
      closeDetails: (draft) => { draft.detailsOpen = false },
      openResults: (draft) => {
        draft.detailsOpen = false
        draft.resultsOpen = true
      },
      closeResults: (draft) => { draft.resultsOpen = false },
      setConversationTextScale: (draft, scale, claimed) => {
        draft.conversationTextScale = scale
        draft.conversationTextScaleClaimed = claimed
      },
    },
  })
}

/** Session state observed by the local result-notification projection. */
export interface QuantSkillsNotificationObservation {
  sessionId: string
  updatedAt: number
  runState: 'idle' | 'running' | 'failed' | 'cancelled' | 'completed'
}

/** One unread terminal run result. */
export interface QuantSkillsUnreadNotification {
  updatedAt: number
  runState: 'failed' | 'completed'
}

/** Browser-local notification projection shared by the frame and navigation rail. */
export interface QuantSkillsNotificationState {
  initialized: boolean
  observedBySession: Record<string, QuantSkillsNotificationObservation>
  unreadBySession: Record<string, QuantSkillsUnreadNotification>
}

type QuantSkillsNotificationActions = {
  sync: (draft: QuantSkillsNotificationState, observations: readonly QuantSkillsNotificationObservation[]) => void
  acknowledge: (draft: QuantSkillsNotificationState, sessionId: string) => void
}

function withoutRecordKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([candidate]) => candidate !== key))
}

/**
 * Create the persisted browser-local projection for completed and failed Session runs.
 * @returns an exclusive store handle mounted once by the QuantSkills root registration.
 */
export function createQuantSkillsNotificationStore(): EngineStoreHandle<
  QuantSkillsNotificationState,
  QuantSkillsNotificationActions
> {
  return defineStore({
    init: (): QuantSkillsNotificationState => ({
      initialized: false,
      observedBySession: {},
      unreadBySession: {},
    }),
    persist: 'dsh.quantskills.notifications.v1',
    actions: {
      sync: (draft, observations) => {
        const activeIds = new Set(observations.map(observation => observation.sessionId))
        draft.observedBySession = Object.fromEntries(
          Object.entries(draft.observedBySession).filter(([sessionId]) => activeIds.has(sessionId)),
        )
        draft.unreadBySession = Object.fromEntries(
          Object.entries(draft.unreadBySession).filter(([sessionId]) => activeIds.has(sessionId)),
        )
        for (const observation of observations) {
          const previous = draft.observedBySession[observation.sessionId]
          const terminal = observation.runState === 'completed' || observation.runState === 'failed'
          const changed = previous === undefined
            || previous.runState !== observation.runState
            || previous.updatedAt !== observation.updatedAt
          if (draft.initialized && changed
            && (observation.runState === 'completed' || observation.runState === 'failed')) {
            draft.unreadBySession[observation.sessionId] = {
              updatedAt: observation.updatedAt,
              runState: observation.runState,
            }
          } else if (!terminal) {
            draft.unreadBySession = withoutRecordKey(draft.unreadBySession, observation.sessionId)
          }
          draft.observedBySession[observation.sessionId] = { ...observation }
        }
        draft.initialized = true
      },
      acknowledge: (draft, sessionId) => {
        draft.unreadBySession = withoutRecordKey(draft.unreadBySession, sessionId)
      },
    },
  })
}
