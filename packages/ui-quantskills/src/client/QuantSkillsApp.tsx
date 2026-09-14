import { EXPERT_PRESETS } from './expert-presets.ts'
import { TEAM_PRESETS } from './team-presets.ts'
import { ProductIntro } from './ProductIntro.tsx'
import { findMinimalTheme, minimalThemeStyle } from './minimal-themes.ts'
import { capabilitySummary } from '@deepseek-ai/dsh-quantskills-session/display'
import { declarationDisplay } from './declaration-display.ts'
import { hasChinese } from './catalog-zh.ts'
import { ArrowRightIcon as ArrowRight } from '@phosphor-icons/react'
import { DatabasePage, type DatabaseAccess } from './DatabasePage.tsx'
import { ExpertPresets } from './ExpertPresets.tsx'
import { TeamPresets } from './TeamPresets.tsx'
import { InteractiveHtml } from './InteractiveHtml.tsx'
import { PdfPreview } from './PdfPreview.tsx'
import { ZoomableImage } from './ZoomableImage.tsx'
import { ActionDialog } from './ActionDialog.tsx'
import { ManualSkillEditor, type ManualSkillSave, type ManualSkillSource } from './ManualSkillEditor.tsx'
import { skillLibraryAssets, agentLibrarySource, type CapabilityLibrarySource } from './capability-library.ts'
import { publicCatalogLabel } from './brand-copy.ts'
import {
  useCallback, useEffect, useId, useMemo, useRef, useState,
  type CSSProperties, type FormEvent, type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject,
} from 'react'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {
  QuantSkillsAgentCreateRequest, QuantSkillsAgentDefinition, QuantSkillsAgentDeleteRequest,
  QuantSkillsAgentSessionArchiveItem, QuantSkillsAgentUpdateRequest,
  QuantSkillsAgentTeamCreateRequest, QuantSkillsAgentTeamDefinition, QuantSkillsAgentTeamDeleteRequest,
  QuantSkillsAgentTeamModelChoice, QuantSkillsAgentTeamSessionArchiveItem, QuantSkillsAgentTeamUpdateRequest,
  QuantSkillsAssetReadme, QuantSkillsInstalledVersionId, QuantSkillsPlainSessionArchiveItem,
  QuantSkillsSessionArchiveItem, QuantSkillsSessionBinding,
  QuantSkillsResultPreview, QuantSkillsApplicationUpdateCheckRequest,
  QuantSkillsApplicationUpdateSource, QuantSkillsApplicationUpdateStartResult,
  QuantSkillsApplicationUpdateStatus,
  QuantSkillsWorkspaceStatusResult,
  PandaMcpStatus,
} from './plugin-types.ts'
import { pandaMcpPhaseLabel } from './panda-mcp-presentation.ts'
import {
  CodeBlock, MarkdownText, Menu, type MarkdownLabels, type MenuItem,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { InjectFace, PropsRenderSlots, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import {
  ArrowDownIcon as ArrowDown, ArrowUpIcon as ArrowUp,
  CubeIcon as Cube, DnaIcon as Dna,
  CaretDownIcon as CaretDown, CaretLeftIcon as CaretLeft, CaretRightIcon as CaretRight,
  ArrowSquareOutIcon as ArrowSquareOut, ChartLineUpIcon as ChartLineUp,
  ArrowClockwiseIcon as ArrowClockwise,
  CheckCircleIcon as CheckCircle,
  BellIcon as Bell, BellRingingIcon as BellRinging,
  ChatsCircleIcon as ChatsCircle, CircleIcon as Circle, ClockIcon as Clock,
  DatabaseIcon as Database, DotsSixVerticalIcon as DotsSixVertical, DotsThreeVerticalIcon as DotsThreeVertical,
  FileCodeIcon as FileCode, FileCsvIcon as FileCsv, FilePdfIcon as FilePdf,
  FileTextIcon as FileText,
  FloppyDiskIcon as FloppyDisk, FolderOpenIcon as FolderOpen, GearSixIcon as GearSix,
  GlobeIcon as Globe, GridFourIcon as GridFour, HouseIcon as House, ListIcon as List,
  LockKeyIcon as LockKey, MagnifyingGlassIcon as MagnifyingGlass,
  MagicWandIcon as MagicWand,
  PaletteIcon as Palette, PaperPlaneTiltIcon as PaperPlaneTilt, PlusIcon as Plus,
  PencilSimpleIcon as PencilSimple,
  ShieldIcon as Shield, StarIcon as Star,
  TrashIcon as Trash, WrenchIcon as Wrench, XIcon as X,
} from '@phosphor-icons/react'
import { ArrowLeftIcon as ArrowLeft } from '@phosphor-icons/react'
import { ArrowsInSimpleIcon as ArrowsInSimple } from '@phosphor-icons/react'
import { ArrowsOutSimpleIcon as ArrowsOutSimple } from '@phosphor-icons/react'
import clsx from 'clsx'
import { csvParseRows, tsvParseRows } from 'd3-dsv'
import type {
  createQuantSkillsLayoutStore, createQuantSkillsNotificationStore, createQuantSkillsViewStore,
  QuantSkillsAgentTeamBuilderSeed, QuantSkillsNotificationObservation,
} from './store.ts'
import type {
  QuantSkillsAsset, QuantSkillsCatalogSnapshot, QuantSkillsPage,
  QuantSkillsAgentModelOption, QuantSkillsAgentsSnapshot, QuantSkillsAuthoringKind,
  QuantSkillsInstalledVersion, QuantSkillsSessionsSnapshot,
} from './types.ts'
import {
  isCodeResultPath, previewableResultPathsForLatestTurn, projectQuantSkillsResults, resultExtension,
  resultPreviewRank,
  type QuantSkillsPreparedResultArtifact, type QuantSkillsProducedFile,
} from './result-data.ts'
import { applyAssetDisplayNameOverrides } from './catalog.ts'
import { QuantSkillsBrandLockup, QuantSkillsBrandMark } from './QuantSkillsBrand.tsx'
import {
  QuantSkillsBrandSupportPanel, QuantSkillsBrandSupportSettings,
} from './QuantSkillsBrandSupportSettings.tsx'
import { QuantSkillsModelServices, type ModelAccess } from './QuantSkillsModelServices.tsx'
import { ModelStartup } from './ModelStartup.tsx'
import { QuantSkillsThemePicker } from './QuantSkillsThemePicker.tsx'
import type {
  ConversationTextScaleClaim, DetailsColumnClaim, DetailsColumnClaimOptions,
  SidebarColumnClaim, SidebarColumnClaimOptions,
} from './layout-contract.ts'
import {
  DEFAULT_QUANTSKILLS_CONVERSATION_BRIGHTNESS,
  DEFAULT_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY, MAX_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY, MIN_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY,
  MAX_QUANTSKILLS_CONVERSATION_BRIGHTNESS, MAX_QUANTSKILLS_SCALE,
  MIN_QUANTSKILLS_CONVERSATION_BRIGHTNESS, MIN_QUANTSKILLS_SCALE,
} from '../appearance-settings.ts'
import { resolveQuantSkillsBackground } from './theme-backgrounds.ts'
import { CapabilityIcon } from './CapabilityIcon.tsx'
import { useAnimatedBackground } from './animated-background.ts'
import { useThemePreset } from './theme-presets.ts'
import css from './QuantSkillsApp.module.css'

const MARKDOWN_LABELS: MarkdownLabels = {
  code: { copyLabel: '复制', copiedLabel: '已复制' },
  footnotes: '脚注',
}

/** Apply the owned palette and background to native Host surfaces for this mounted frame. */
function useQuantSkillsDocumentAppearance(
  enabled: boolean,
  scheme: Parameters<typeof resolveQuantSkillsBackground>[0],
  background: ReturnType<typeof resolveQuantSkillsBackground>,
  conversationBrightness: number,
  conversationOverlayOpacity: number,
  inConversation = false,
): void {
  const preset = useThemePreset()
  useAnimatedBackground(enabled, background, inConversation)
  useEffect(() => {
    if (!enabled) return
    const minimal = findMinimalTheme(background.id)
    const previousMinimal = document.body.dataset.qsMinimal
    const themeProperties = minimal ? minimalThemeStyle(minimal) : {}
    const previousTokens = Object.fromEntries(Object.keys(themeProperties).map(key => [key, document.body.style.getPropertyValue(key)]))
    for (const [key, value] of Object.entries(themeProperties)) document.body.style.setProperty(key, value)
    if (minimal) document.body.dataset.qsMinimal = minimal.id
    else delete document.body.dataset.qsMinimal
    const previousPreset = document.body.dataset.qsPreset
    document.body.dataset.qsPreset = preset
    const previousTheme = document.body.dataset.qsPluginTheme
    const previousBackground = document.body.dataset.qsBackground
    const previousImage = document.body.style.getPropertyValue('--qs-background-image')
    const previousPosition = document.body.style.getPropertyValue('--qs-background-position')
    const previousConversationColor = document.body.style.getPropertyValue('--qs-conversation-text-color')
    const previousConversationOverlayOpacity = document.body.style.getPropertyValue('--qs-conversation-surface-opacity')
    const strength = Math.max(
      MIN_QUANTSKILLS_CONVERSATION_BRIGHTNESS,
      Math.min(MAX_QUANTSKILLS_CONVERSATION_BRIGHTNESS, conversationBrightness),
    )
    const channel = scheme === 'dark'
      ? Math.round(255 * strength)
      : Math.round(10 + (1 - strength) * 210)
    document.body.dataset.qsPluginTheme = scheme
    document.body.dataset.qsBackground = background.id
    document.body.style.setProperty('--qs-background-image', background.gradient ?? (background.url === undefined ? 'none' : `url("${background.url}")`))
    document.body.style.setProperty('--qs-background-position', background.position)
    const foreground = minimal
      ? [1, 3, 5].map(offset => Number.parseInt(minimal.tokens.ink.slice(offset, offset + 2), 16))
        .map(value => Math.round(scheme === 'dark' ? value * strength : value + (255 - value) * (1 - strength)))
      : [channel, channel, channel]
    document.body.style.setProperty('--qs-conversation-text-color', `rgb(${foreground.join(' ')})`)
    document.body.style.setProperty('--qs-conversation-surface-opacity', `${String(Math.round(Math.max(
      MIN_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY,
      Math.min(MAX_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY, conversationOverlayOpacity),
    ) * 100))}%`)
    return () => {
      for (const [key, value] of Object.entries(previousTokens)) {
        if (value) document.body.style.setProperty(key, value)
        else document.body.style.removeProperty(key)
      }
      if (previousMinimal === undefined) delete document.body.dataset.qsMinimal
      else document.body.dataset.qsMinimal = previousMinimal
      if (previousPreset === undefined) delete document.body.dataset.qsPreset
      else document.body.dataset.qsPreset = previousPreset
      if (previousTheme === undefined) delete document.body.dataset.qsPluginTheme
      else document.body.dataset.qsPluginTheme = previousTheme
      if (previousBackground === undefined) delete document.body.dataset.qsBackground
      else document.body.dataset.qsBackground = previousBackground
      if (previousImage === '') document.body.style.removeProperty('--qs-background-image')
      else document.body.style.setProperty('--qs-background-image', previousImage)
      if (previousPosition === '') document.body.style.removeProperty('--qs-background-position')
      else document.body.style.setProperty('--qs-background-position', previousPosition)
      if (previousConversationColor === '') document.body.style.removeProperty('--qs-conversation-text-color')
      else document.body.style.setProperty('--qs-conversation-text-color', previousConversationColor)
      if (previousConversationOverlayOpacity === '') document.body.style.removeProperty('--qs-conversation-surface-opacity')
      else document.body.style.setProperty('--qs-conversation-surface-opacity', previousConversationOverlayOpacity)
    }
  }, [background, conversationBrightness, conversationOverlayOpacity, enabled, scheme, preset])
}

/** Registration-time injected application services and observable controllers. */
export interface QuantSkillsAppInjected {
  manualSkillSave?: ManualSkillSave
  readSkillDeclaration: (versionId: string, signal: AbortSignal) => Promise<string>

  renderPluginMarket?: () => ReactNode
  databaseAccess?: DatabaseAccess
  modelAccess?: ModelAccess

  /** Whether new Sessions use the native plugin's managed-default Workspace policy. */
  managedWorkspace: boolean
  hooks: {
    store: ViewInstance['store']
    catalog: ObservableSnapshot<QuantSkillsCatalogSnapshot>
    boundSessions: ObservableSnapshot<QuantSkillsSessionsSnapshot>
    agents: ObservableSnapshot<QuantSkillsAgentsSnapshot>
  }
  actions: ViewActions
  refreshCatalog: () => Promise<void>
  applicationUpdateStatus: () => Promise<QuantSkillsApplicationUpdateStatus>
  applicationUpdateCheck: (
    request: QuantSkillsApplicationUpdateCheckRequest,
  ) => Promise<QuantSkillsApplicationUpdateStartResult>
  applicationUpdateStart: () => Promise<QuantSkillsApplicationUpdateStartResult>
  readAssetReadme: (asset: QuantSkillsAsset, signal?: AbortSignal) => Promise<QuantSkillsAssetReadme>
  installAsset: (asset: QuantSkillsAsset) => Promise<void>
  uninstallAsset?: ((assetId: string) => Promise<void>) | undefined
  uninstallAgent?: ((request: QuantSkillsAgentDeleteRequest) => Promise<void>) | undefined
  openSession: (id: SessionId) => void
  startSession: () => Promise<void>
  startSkillSession: (asset: QuantSkillsAsset, version: QuantSkillsInstalledVersion) => Promise<void>
  startBoundSession: (binding: QuantSkillsSessionBinding, label: string) => Promise<void>
  createAgent: (request: QuantSkillsAgentCreateRequest) => Promise<QuantSkillsAgentDefinition>
  updateAgent: (request: QuantSkillsAgentUpdateRequest) => Promise<QuantSkillsAgentDefinition>
  deleteAgent: (request: QuantSkillsAgentDeleteRequest) => Promise<void>
  startAgentSession: (definition: QuantSkillsAgentDefinition) => Promise<SessionId>
  createAgentTeam: (request: QuantSkillsAgentTeamCreateRequest) => Promise<QuantSkillsAgentTeamDefinition>
  updateAgentTeam: (request: QuantSkillsAgentTeamUpdateRequest) => Promise<QuantSkillsAgentTeamDefinition>
  deleteAgentTeam: (request: QuantSkillsAgentTeamDeleteRequest) => Promise<void>
  startAgentTeamSession: (definition: QuantSkillsAgentTeamDefinition) => Promise<SessionId>
  testAgent: (definition: QuantSkillsAgentDefinition) => Promise<SessionId>
  listAgentModels: () => Promise<readonly QuantSkillsAgentModelOption[]>
  generateAgentRole: (
    request: QuantSkillsAgentRoleDraftRequest,
    signal?: AbortSignal,
  ) => Promise<string>
  installAgent: (asset: QuantSkillsAsset) => Promise<QuantSkillsAgentDefinition>
  refreshAgents: () => Promise<void>
  refreshBoundSessions: () => Promise<void>
  workspaceStatus: () => Promise<QuantSkillsWorkspaceStatusResult>
  setDefaultWorkspace: (workspaceId?: string) => Promise<void>
  pandaMcpStatus: () => Promise<PandaMcpStatus>
  authenticatePandaMcp: () => Promise<PandaMcpStatus>
  refreshPandaMcp: () => Promise<PandaMcpStatus>
  logoutPandaMcp: () => Promise<PandaMcpStatus>
  startAuthoringSession: (kind: QuantSkillsAuthoringKind, initialRequest?: string) => Promise<void>
  openAgentTeamBuilder: (seed?: QuantSkillsAgentTeamBuilderSeed) => void
  send: (text: string) => Promise<void>
  startTask: (text: string, assetName?: string) => Promise<QuantSkillsTaskStartResult>
}

/** Exact trusted catalog 技能 recommended by the AI task matcher. */
export interface QuantSkillsTaskSuggestion {
  /** Stable QuantSkills repository name. */
  readonly asset: string
  /** User-facing catalog title. */
  readonly title: string
  /** Model-authored explanation grounded in the user's current requirement. */
  readonly reason: string
}

/** Outcome of resolving and optionally starting a task from the home composer. */
export type QuantSkillsTaskStartResult = Readonly<
  | { readonly kind: 'started'; readonly asset: string; readonly title: string }
  | {
      readonly kind: 'clarification'
      readonly message: string
      readonly question: string
      readonly options: readonly string[]
    }
  | {
      readonly kind: 'recommendations'
      readonly message: string
      readonly suggestions: readonly QuantSkillsTaskSuggestion[]
    }
  | { readonly kind: 'creation'; readonly message: string }
>

/** Model-visible inputs used to draft one 专家 role without mutating the editor. */
export interface QuantSkillsAgentRoleDraftRequest {
  /** User-facing 专家 name, or blank while creating a new definition. */
  readonly name: string
  /** Existing role text used as revision context. */
  readonly currentRole: string
  /** How the installed 技能 versions will be offered to the 专家. */
  readonly mode: AgentEditorDraft['mode']
  /** Exact installed Skills currently selected in the editor. */
  readonly skills: readonly {
    readonly title: string
    readonly versionId: string
  }[]
  /** Optional user direction for this generation only. */
  readonly instruction: string
  /** Optional editor-selected model. */
  readonly model?: {
    readonly provider: string
    readonly model: string
    readonly reasoningEffort?: string
  }
}

/** Injected navigation-rail state and actions. */
export interface QuantSkillsRailInjected {
  hooks: {
    store: ViewInstance['store']
    notifications: NotificationInstance['store']
  }
  actions: ViewActions
  collapse: () => void
}

/** Injected state and actions for the native DSH application adapter. */
export interface QuantSkillsPluginFrameInjected {
  modelAccess: ModelAccess
  hooks: {
    view: ViewInstance['store']
    layout: LayoutInstance['store']
    catalog: ObservableSnapshot<QuantSkillsCatalogSnapshot>
    boundSessions: ObservableSnapshot<QuantSkillsSessionsSnapshot>
    agents: ObservableSnapshot<QuantSkillsAgentsSnapshot>
    notifications: NotificationInstance['store']
  }
  actions: ViewActions
  openSession: (id: SessionId) => void
  acknowledgeNotification: (id: SessionId) => void
  renameSession: (id: SessionId, title: string) => Promise<void>
  removeSessions: (ids: readonly SessionId[]) => Promise<void>
  startSession: () => Promise<void>
  startAuthoringSession: (kind: QuantSkillsAuthoringKind, initialRequest?: string) => Promise<void>
  openAgentTeamBuilder: (seed?: QuantSkillsAgentTeamBuilderSeed) => void
  claimSidebar: (options: SidebarColumnClaimOptions) => SidebarColumnClaim
  claimDetails: (options: DetailsColumnClaimOptions) => DetailsColumnClaim
  claimConversationTextScale: (scale: number) => ConversationTextScaleClaim
  openResults: () => void
  closeResults: () => void
  close: () => void
}

/** Injected action and notification state for the native DSH sidebar launcher. */
export interface QuantSkillsPluginLauncherInjected {
  hooks: { notifications: NotificationInstance['store'] }
  open: () => void
}

/** Injected result-drawer actions. */
export interface QuantSkillsResultInjected {
  revealFile?: (path: string) => Promise<void>
  saveFileAs?: (path: string) => Promise<void>
  hooks: {
    resultRequest: ViewInstance['store']
  }
  close: () => void
  listFiles: (signal?: AbortSignal) => Promise<readonly QuantSkillsPreparedResultArtifact[]>
  prepareFiles: (
    paths: readonly string[],
    signal?: AbortSignal,
  ) => Promise<readonly QuantSkillsPreparedResultArtifact[]>
  openFile: (path: string) => Promise<void>
  previewFile: (path: string) => Promise<QuantSkillsResultPreview>
  openOutputDirectory: (path?: string) => Promise<void>
  continueWithResults: (paths: readonly string[]) => Promise<void>
  acknowledgePreviewFocus: (sequence: number) => void
  triggerRef: RefObject<HTMLElement | null>
  docked: boolean
}

/** Injected action that opens the current bound Session's result workbench. */
export interface QuantSkillsResultActionInjected {
  open: (trigger: HTMLElement) => void
  complete: (sessionId: SessionId) => void
}
/** Authoring actions exposed in the resident conversation header. */
export interface QuantSkillsAuthoringActionInjected {
  start: (kind: QuantSkillsAuthoringKind) => Promise<void>
  openAgentTeamBuilder: (seed?: QuantSkillsAgentTeamBuilderSeed) => void
}
type ViewStore = ReturnType<typeof createQuantSkillsViewStore>
type ViewInstance = ReturnType<ViewStore['create']>
type ViewActions = ViewInstance['actions']
type LayoutStore = ReturnType<typeof createQuantSkillsLayoutStore>
type LayoutInstance = ReturnType<LayoutStore['create']>
type NotificationStore = ReturnType<typeof createQuantSkillsNotificationStore>
type NotificationInstance = ReturnType<NotificationStore['create']>
/** Shared page projection injected into the QuantSkills-owned root frame. */
export interface QuantSkillsFrameInjected {
  hooks: {
    view: ViewInstance['store']
    catalog: ObservableSnapshot<QuantSkillsCatalogSnapshot>
    boundSessions: ObservableSnapshot<QuantSkillsSessionsSnapshot>
    agents: ObservableSnapshot<QuantSkillsAgentsSnapshot>
    notifications: NotificationInstance['store']
  }
  openSession: (id: SessionId) => void
  syncNotifications: (observations: readonly QuantSkillsNotificationObservation[]) => void
  acknowledgeNotification: (id: SessionId) => void
  renameSession: (id: SessionId, title: string) => Promise<void>
  removeSessions: (ids: readonly SessionId[]) => Promise<void>
  startSession: () => Promise<void>
  startAuthoringSession: (kind: QuantSkillsAuthoringKind, initialRequest?: string) => Promise<void>
  openAgentTeamBuilder: (seed?: QuantSkillsAgentTeamBuilderSeed) => void
}
export type QuantSkillsFrameProps = PropsRuntime<'root'>
  & PropsRenderSlots<
    'sidebar' | 'quantskills.page' | 'quantskills.results' | 'conversation' | 'details' | 'shell.overlay'
  >
  & PropsStore<LayoutStore>
  & InjectFace<QuantSkillsFrameInjected>
export type QuantSkillsAppProps = PropsRuntime<'quantskills.page'> & InjectFace<QuantSkillsAppInjected>
export type QuantSkillsRailProps = PropsRuntime<'sidebar'>
  & PropsRenderSlots<'sidebar.footer.action'>
  & InjectFace<QuantSkillsRailInjected>
export type QuantSkillsPluginFrameProps = PropsRuntime<'shell.overlay'>
  & PropsRenderSlots<'quantskills.page' | 'quantskills.results'>
  & InjectFace<QuantSkillsPluginFrameInjected>
export type QuantSkillsPluginLauncherProps = PropsRuntime<'sidebar.footer.action'>
  & InjectFace<QuantSkillsPluginLauncherInjected>
export type QuantSkillsResultProps = PropsRuntime<'quantskills.results'> & InjectFace<QuantSkillsResultInjected>
export type QuantSkillsResultActionProps = PropsRuntime<'conversation.session.header.actions'>
  & QuantSkillsResultActionInjected
export type QuantSkillsAuthoringActionProps = QuantSkillsAuthoringActionInjected

type PageProps = QuantSkillsAppProps & {
  catalog: QuantSkillsCatalogSnapshot
  boundSessions: QuantSkillsSessionsSnapshot
  agents: QuantSkillsAgentsSnapshot
}

/** DSH-compatible root frame that keeps the stock conversation services while replacing the stock visual shell. */
export function QuantSkillsFrame({
  useStore, actions, useSessions, useView, useCatalog, useBoundSessions, useAgents, useNotifications,
  renderSlot, openSession, syncNotifications, acknowledgeNotification, renameSession, removeSessions, startSession,
  startAuthoringSession, openAgentTeamBuilder,
}: QuantSkillsFrameProps) {
  const sidebarOpen = useStore(state => state.sidebarOpen)
  const detailsOpen = useStore(state => state.detailsOpen)
  const currentSessionId = useSessions(state => state.current)
  const plainArchives = useBoundSessions(state => state.plainArchives)
  const archives = useBoundSessions(state => state.archives)
  const boundSessionsReady = useBoundSessions(state => state.phase === 'ready')
  const agentArchives = useAgents(state => state.archives)
  const teamArchives = useAgents(state => state.teamArchives)
  const agentsReady = useAgents(state => state.phase === 'ready')
  const unreadBySession = useNotifications(state => state.unreadBySession)
  const unreadCount = Object.keys(unreadBySession).length
  const catalogSnapshot = useCatalog(snapshot => snapshot)
  const displayNameOverrides = useView(state => state.assetDisplayNameOverrides)
  const catalog = useMemo(
    () => applyAssetDisplayNameOverrides(catalogSnapshot, displayNameOverrides),
    [catalogSnapshot, displayNameOverrides],
  )
  const currentArchive = archives.find(archive => archive.sessionId === currentSessionId)
  const currentPlainArchive = plainArchives.find(archive => archive.sessionId === currentSessionId)
  const currentAgentArchive = agentArchives.find(archive => archive.sessionId === currentSessionId)
  const currentTeamArchive = teamArchives.find(archive => archive.sessionId === currentSessionId)
  const page = useView(state => state.page)
  const interfaceScale = useView(state => state.interfaceScale)
  const conversationScale = useView(state => state.conversationScale)
  const conversationBrightness = useView(state => state.conversationBrightness)
  const conversationOverlayOpacity = useView(state => state.conversationOverlayOpacity)
  const colorScheme = useView(state => state.colorScheme)
  const lightBackground = useView(state => state.lightBackground)
  const darkBackground = useView(state => state.darkBackground)
  const background = useMemo(
    () => resolveQuantSkillsBackground(colorScheme, lightBackground, darkBackground),
    [colorScheme, darkBackground, lightBackground],
  )
  useQuantSkillsDocumentAppearance(true, colorScheme, background, conversationBrightness, conversationOverlayOpacity)
  const claimedConversationTextScale = useStore(state => state.conversationTextScale)
  const conversationTextScaleClaimed = useStore(state => state.conversationTextScaleClaimed)
  const resultsOpen = useStore(state => state.resultsOpen)
  const sidebarReservation = useStore(state => state.sidebarReservation)
  const detailsReservation = useStore(state => state.detailsReservation)
  const previousSessionId = useRef(currentSessionId)
  const notificationObservations = useMemo<readonly QuantSkillsNotificationObservation[]>(() => [
    ...plainArchives.map(archive => ({
      sessionId: archive.sessionId,
      updatedAt: archive.updatedAt,
      runState: archive.runState,
    })),
    ...archives.map(archive => ({
      sessionId: archive.sessionId,
      updatedAt: archive.updatedAt,
      runState: archive.runState,
    })),
    ...agentArchives.map(archive => ({
      sessionId: archive.sessionId,
      updatedAt: archive.updatedAt,
      runState: archive.runState,
    })),
    ...teamArchives.map(archive => ({
      sessionId: archive.sessionId,
      updatedAt: archive.updatedAt,
      runState: archive.runState,
    })),
  ], [agentArchives, archives, plainArchives, teamArchives])
  useEffect(() => {
    if (boundSessionsReady && agentsReady) syncNotifications(notificationObservations)
  }, [agentsReady, boundSessionsReady, notificationObservations, syncNotifications])
  useEffect(() => {
    const badgeNavigator = navigator as unknown as {
      setAppBadge?: (contents: number) => Promise<void>
      clearAppBadge?: () => Promise<void>
    }
    const update = unreadCount === 0
      ? badgeNavigator.clearAppBadge?.()
      : badgeNavigator.setAppBadge?.(unreadCount)
    // The in-app counters remain authoritative when the browser does not expose OS badging.
    if (update !== undefined) void update.catch(() => {})
  }, [unreadCount])
  const openNotifiedSession = useCallback((id: SessionId): void => {
    acknowledgeNotification(id)
    openSession(id)
  }, [acknowledgeNotification, openSession])
  useEffect(() => {
    if (previousSessionId.current !== currentSessionId) actions.closeResults()
    previousSessionId.current = currentSessionId
  }, [actions, currentSessionId])
  const conversationVisible = page === 'conversations'
  const quantSkillsConversationSelected = currentPlainArchive !== undefined
    || currentArchive !== undefined
    || currentAgentArchive !== undefined
    || currentTeamArchive !== undefined
  const detailsVisible = conversationVisible && quantSkillsConversationSelected && detailsOpen
  const resultsVisible = conversationVisible && quantSkillsConversationSelected && resultsOpen
  const sidebarWidth = Math.max(
    Math.round((sidebarOpen ? 78 : 56) * interfaceScale),
    sidebarReservation,
  )
  const style = {
    '--qs-interface-scale': interfaceScale,
    '--qs-conversation-scale': conversationScale,
    '--qs-background-image': background.gradient ?? (background.url === undefined ? 'none' : `url("${background.url}")`),
    '--qs-background-position': background.position,
    gridTemplateColumns: `${sidebarWidth}px minmax(0, 1fr) ${Math.max(detailsVisible ? 430 : 0, detailsReservation)}px`,
  } as CSSProperties
  const resolvedConversationScale = conversationTextScaleClaimed
    ? claimedConversationTextScale
    : conversationScale
  const conversationStyle = {
    '--qs-conversation-scale': resolvedConversationScale,
    '--dsh-conversation-text-scale': resolvedConversationScale,
    '--dsh-conversation-text-base-size': `${String(16 * resolvedConversationScale)}px`,
  } as CSSProperties
  return <div
    className={css.rootFrame}
    style={style}
    data-details-open={detailsVisible || undefined}
    data-interface-scale={interfaceScale}
    data-qs-theme={colorScheme}
    data-qs-background={background.id}
  >
    <div className={css.rootSidebar}>
      {renderSlot('sidebar', { collapsed: !sidebarOpen, width: sidebarWidth })}
    </div>
    <div
      className={css.rootConversation}
      style={conversationStyle}
      data-conversation-scale={conversationScale}
      data-stock-conversation={conversationVisible || undefined}
    >
      {conversationVisible
        ? <ConversationFrame
          currentPlain={currentPlainArchive}
          currentSkill={currentArchive}
          currentAgent={currentAgentArchive}
          currentTeam={currentTeamArchive}
          plainArchives={plainArchives}
          skillArchives={archives}
          agentArchives={agentArchives}
          teamArchives={teamArchives}
          catalog={catalog}
          unreadBySession={unreadBySession}
          archivesOpen={!resultsVisible}
          openSession={openNotifiedSession}
          renameSession={renameSession}
          removeSessions={removeSessions}
          startSession={startSession}
          startAuthoringSession={startAuthoringSession}
          openAgentTeamBuilder={openAgentTeamBuilder}
        >
          {renderSlot('conversation', {})}
        </ConversationFrame>
        : renderSlot('quantskills.page', {})}
    </div>
    <div className={css.rootDetails}>{renderSlot('details', {})}</div>
    <div
      className={css.rootResults}
      data-open={resultsVisible || undefined}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) actions.closeResults()
      }}
    >
      {resultsVisible ? renderSlot('quantskills.results', {}) : null}
    </div>
    <div className={css.rootOverlay}>{renderSlot('shell.overlay', {})}</div>
  </div>
}

function ConversationFrame({
  currentPlain, currentSkill, currentAgent, currentTeam, plainArchives, skillArchives, agentArchives, teamArchives,
  catalog, archivesOpen, unreadBySession, openSession, renameSession, removeSessions, startSession,
  startAuthoringSession, openAgentTeamBuilder, sidebarOnly = false,
  drawerWidth: controlledDrawerWidth, onDrawerWidthChange, onCollapseDrawer, interfaceScale = 1, children,
}: {
  currentPlain: QuantSkillsPlainSessionArchiveItem | undefined
  currentSkill: QuantSkillsSessionArchiveItem | undefined
  currentAgent: QuantSkillsAgentSessionArchiveItem | undefined
  currentTeam: QuantSkillsAgentTeamSessionArchiveItem | undefined
  plainArchives: readonly QuantSkillsPlainSessionArchiveItem[]
  skillArchives: readonly QuantSkillsSessionArchiveItem[]
  agentArchives: readonly QuantSkillsAgentSessionArchiveItem[]
  teamArchives: readonly QuantSkillsAgentTeamSessionArchiveItem[]
  catalog: QuantSkillsCatalogSnapshot
  archivesOpen: boolean
  unreadBySession: Readonly<Record<string, { readonly updatedAt: number; readonly runState: 'failed' | 'completed' }>>
  openSession: (id: SessionId) => void
  renameSession: (id: SessionId, title: string) => Promise<void>
  removeSessions: (ids: readonly SessionId[]) => Promise<void>
  startSession: () => Promise<void>
  startAuthoringSession: (kind: QuantSkillsAuthoringKind, initialRequest?: string) => Promise<void>
  openAgentTeamBuilder: (seed?: QuantSkillsAgentTeamBuilderSeed) => void
  sidebarOnly?: boolean
  drawerWidth?: number
  onDrawerWidthChange?: (width: number) => void
  onCollapseDrawer?: () => void
  interfaceScale?: number
  children?: ReactNode
}) {
  const [error, setError] = useState<string>()
  const [pendingRename, setPendingRename] = useState<ConversationRow>()
  const [renameDraft, setRenameDraft] = useState('')
  const [renameError, setRenameError] = useState<string>()
  const [renaming, setRenaming] = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState<ConversationRemovalRequest>()
  const [removing, setRemoving] = useState(false)
  const [managing, setManaging] = useState(false)
  const [selectedSessionIds, setSelectedSessionIds] = useState<ReadonlySet<SessionId>>(() => new Set())
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [kindFilter, setKindFilter] = useState<'plain' | 'skill' | 'agent' | 'team'>(
    currentTeam !== undefined ? 'team' : currentAgent !== undefined ? 'agent'
      : currentSkill !== undefined ? 'skill' : 'plain',
  )
  const [sessionSearch, setSessionSearch] = useState('')
  const [localDrawerWidth, setLocalDrawerWidth] = useState(readSessionDrawerWidth)
  const drawerWidth = controlledDrawerWidth ?? localDrawerWidth
  const drag = useRef<{ readonly pointerId: number; readonly startX: number; readonly startWidth: number }>()
  const notificationsRef = useRef<HTMLDivElement>(null)
  const currentSessionId = currentPlain?.sessionId ?? currentSkill?.sessionId
    ?? currentAgent?.sessionId ?? currentTeam?.sessionId
  const currentKind = currentTeam !== undefined ? 'team' : currentAgent !== undefined ? 'agent'
    : currentSkill !== undefined ? 'skill' : currentPlain !== undefined ? 'plain' : undefined
  const allRows = [
    ...plainArchives.map(archive => ({ kind: 'plain' as const, archive })),
    ...skillArchives.map(archive => ({ kind: 'skill' as const, archive })),
    ...agentArchives.map(archive => ({ kind: 'agent' as const, archive })),
    ...teamArchives.map(archive => ({ kind: 'team' as const, archive })),
  ].sort((left, right) => right.archive.updatedAt - left.archive.updatedAt)
  const normalizedSearch = sessionSearch.trim().toLocaleLowerCase('zh-CN')
  const matchesSearch = (row: ConversationRow): boolean => normalizedSearch === ''
    || conversationRowSearchText(row, catalog).includes(normalizedSearch)
  const running = allRows.filter(row => row.archive.running && matchesSearch(row))
  const recent = allRows.filter(row => row.kind === kindFilter && !row.archive.running && matchesSearch(row))
  const rows = [...running, ...recent]
  const deletableSessionIds = recent.map(row => row.archive.sessionId)
  const deletableSessionKey = deletableSessionIds.join('\u0000')
  const allDeletableSelected = deletableSessionIds.length > 0
    && deletableSessionIds.every(id => selectedSessionIds.has(id))
  const recentGroups = groupConversationRowsByDate(recent)
  const notificationRows = allRows.filter(row => unreadBySession[row.archive.sessionId] !== undefined).slice(0, 8)
  const unreadCount = Object.keys(unreadBySession).length
  useEffect(() => {
    if (currentTeam !== undefined) setKindFilter('team')
    else if (currentAgent !== undefined) setKindFilter('agent')
    else if (currentSkill !== undefined) setKindFilter('skill')
    else if (currentPlain !== undefined) setKindFilter('plain')
  }, [currentAgent?.sessionId, currentPlain?.sessionId, currentSkill?.sessionId, currentTeam?.sessionId])
  useEffect(() => {
    const available = new Set(deletableSessionIds)
    setSelectedSessionIds((previous) => {
      const next = new Set([...previous].filter(id => available.has(id)))
      return next.size === previous.size ? previous : next
    })
  }, [deletableSessionKey])
  useEffect(() => {
    if (!notificationsOpen) return
    const closeNotifications = (event: PointerEvent): void => {
      if (event.target instanceof Node && !notificationsRef.current?.contains(event.target)) {
        setNotificationsOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setNotificationsOpen(false)
    }
    document.addEventListener('pointerdown', closeNotifications, true)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeNotifications, true)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [notificationsOpen])
  const resize = (next: number, persist: boolean): void => {
    const width = clampSessionDrawerWidth(next)
    if (controlledDrawerWidth === undefined) setLocalDrawerWidth(width)
    onDrawerWidthChange?.(width)
    if (persist) writeSessionDrawerWidth(width)
  }
  const beginResize = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: drawerWidth }
  }
  const continueResize = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const active = drag.current
    if (active === undefined || active.pointerId !== event.pointerId) return
    resize(active.startWidth + (event.clientX - active.startX) / interfaceScale, false)
  }
  const finishResize = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const active = drag.current
    if (active === undefined || active.pointerId !== event.pointerId) return
    drag.current = undefined
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    resize(active.startWidth + (event.clientX - active.startX) / interfaceScale, true)
  }
  const resizeByKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const next = event.key === 'ArrowLeft'
      ? drawerWidth - SESSION_DRAWER_KEYBOARD_STEP
      : event.key === 'ArrowRight'
        ? drawerWidth + SESSION_DRAWER_KEYBOARD_STEP
        : event.key === 'Home'
          ? SESSION_DRAWER_MIN_WIDTH
          : event.key === 'End'
            ? SESSION_DRAWER_MAX_WIDTH
            : undefined
    if (next === undefined) return
    event.preventDefault()
    resize(next, true)
  }
  const confirmRemoval = async (): Promise<void> => {
    if (pendingRemoval === undefined) return
    const ids = pendingRemoval.rows
      .filter(row => !row.archive.running)
      .map(row => row.archive.sessionId)
    if (ids.length === 0) return
    setRemoving(true)
    setError(undefined)
    try {
      await removeSessions(ids)
      setPendingRemoval(undefined)
      setSelectedSessionIds(new Set())
      setManaging(false)
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setRemoving(false)
    }
  }
  const requestRename = (row: ConversationRow): void => {
    setPendingRename(row)
    setRenameDraft(conversationRowTitle(row, catalog))
    setRenameError(undefined)
  }
  const confirmRename = async (row: ConversationRow, title: string): Promise<void> => {
    setRenaming(true)
    setRenameError(undefined)
    try {
      await renameSession(row.archive.sessionId, title)
      setPendingRename(undefined)
    } catch (cause: unknown) {
      setRenameError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setRenaming(false)
    }
  }
  const layoutStyle = { '--qs-session-drawer-width': `${String(drawerWidth)}px` } as CSSProperties
  return <div
    className={clsx(
      css.boundConversationLayout,
      archivesOpen && css.withSessionDrawer,
      sidebarOnly && archivesOpen && css.sessionDrawerOnly,
    )}
    style={layoutStyle}
  >
    {archivesOpen && <aside className={css.sessionDrawer} aria-label="会话切换">
      <header className={css.sessionHeader}>
        <div className={css.sessionSummary}>
          <b>会话中心</b>
          <small>{allRows.filter(row => row.archive.running).length} 个运行中 · {allRows.length} 个会话</small>
          <small className={css.catalogSync} data-state={catalog.sync.state}>
            <i/>{catalog.sync.mode === 'manual'
              ? 'QS 目录按需检查'
              : catalog.sync.state === 'connected'
                ? 'QS 目录已实时同步'
                : 'QS 实时同步重连中'}
          </small>
        </div>
        <div className={css.sessionHeaderActions}>
          {!managing && <div ref={notificationsRef} className={css.sessionNotifications}>
            <button
              type="button"
              className={css.notificationButton}
              aria-label={`会话通知${unreadCount === 0 ? '' : `，${String(unreadCount)} 条未读结果`}`}
              aria-expanded={notificationsOpen}
              onClick={() => { setNotificationsOpen(open => !open) }}
            >
              {unreadCount === 0 ? <Bell size={18}/> : <BellRinging size={18}/>}
              {unreadCount > 0 && <mark>{unreadCount}</mark>}
            </button>
            {notificationsOpen && <ConversationNotificationMenu
              rows={notificationRows}
              unreadCount={unreadCount}
              catalog={catalog}
              openSession={(id) => { setNotificationsOpen(false); openSession(id) }}
            />}
          </div>}
          {!managing && <QuantSkillsAuthoringAction
            start={startAuthoringSession}
            openAgentTeamBuilder={openAgentTeamBuilder}
          />}
          {!managing && <button
            type="button"
            title="创建不加载 技能、专家 或 专家团 的普通会话"
            onClick={() => {
              setError(undefined)
              void startSession().catch((cause: unknown) => {
                setError(cause instanceof Error ? cause.message : String(cause))
              })
            }}
          ><Plus/>新对话</button>}
          {managing && <button
            type="button"
            className={css.sessionManageDone}
            onClick={() => {
              setManaging(false)
              setSelectedSessionIds(new Set())
            }}
          >完成</button>}
        </div>
      </header>
      <label className={css.sessionSearch}>
        <MagnifyingGlass size={17}/>
        <input
          type="search"
          value={sessionSearch}
          placeholder="搜索会话名称或 ID"
          aria-label="搜索 QuantSkills 会话"
          onChange={(event) => { setSessionSearch(event.currentTarget.value) }}
        />
      </label>
      <div className={css.sessionKindTabs} role="tablist" aria-label="按会话类型筛选">
        {([
          ['plain', '普通', plainArchives.length],
          ['skill', '技能', skillArchives.length],
          ['agent', '专家', agentArchives.length],
          ['team', '专家团', teamArchives.length],
        ] as const).map(([kind, label, count]) => <button
          key={kind}
          type="button"
          role="tab"
          aria-selected={kindFilter === kind}
          className={kindFilter === kind ? css.selected : undefined}
          onClick={() => {
            setKindFilter(kind)
            setSelectedSessionIds(new Set())
            const latest = allRows.find(row => row.kind === kind)
            if (latest !== undefined && currentKind !== kind) openSession(latest.archive.sessionId)
          }}
        >{label}<mark>{count}</mark></button>)}
      </div>
      {managing && <div className={css.sessionBulkBar} role="toolbar" aria-label="批量管理会话">
        <label>
          <input
            type="checkbox"
            aria-label="全选可删除会话"
            checked={allDeletableSelected}
            onChange={() => {
              setSelectedSessionIds(allDeletableSelected ? new Set() : new Set(deletableSessionIds))
            }}
          />
          <span>{allDeletableSelected ? '取消全选' : '全选'}</span>
        </label>
        <small>{selectedSessionIds.size} 已选</small>
        <button
          type="button"
          disabled={selectedSessionIds.size === 0}
          onClick={() => {
            setError(undefined)
            setPendingRemoval({
              kind: 'selected',
              rows: recent.filter(row => selectedSessionIds.has(row.archive.sessionId)),
            })
          }}
        ><Trash size={15}/>删除</button>
        <button
          type="button"
          className={css.sessionClearButton}
          disabled={recent.length === 0}
          onClick={() => {
            setError(undefined)
            setPendingRemoval({ kind: 'clear', rows: recent })
          }}
        >清空</button>
      </div>}
      <ConversationSwitchGroup
        title="运行中"
        rows={running}
        catalog={catalog}
        currentSessionId={currentSessionId}
        openSession={openSession}
        requestRename={requestRename}
        requestRemoval={(row) => {
          setError(undefined)
          setPendingRemoval({ kind: 'single', rows: [row] })
        }}
        managing={managing}
        selectedSessionIds={selectedSessionIds}
        toggleSelection={() => {}}
      />
      {recentGroups.map(group => <ConversationSwitchGroup
        key={group.key}
        title={group.label}
        rows={group.rows}
        catalog={catalog}
        currentSessionId={currentSessionId}
        openSession={openSession}
        requestRename={requestRename}
        requestRemoval={(row) => {
          setError(undefined)
          setPendingRemoval({ kind: 'single', rows: [row] })
        }}
        managing={managing}
        selectedSessionIds={selectedSessionIds}
        toggleSelection={(id) => {
          setSelectedSessionIds((previous) => {
            const next = new Set(previous)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
          })
        }}
      />)}
      {running.length === 0 && recent.length === 0 && <div className={css.sessionEmpty}>
        {kindFilter === 'team'
          ? <><CapabilityIcon kind="agent-team" size={28}/><b>还没有 专家团 会话</b><small>专家团 编排完成后会在这里保留独立存档。</small></>
          : kindFilter === 'plain'
            ? <><ChatsCircle size={28}/><b>还没有普通会话</b><small>点击“新对话”即可开始，不需要先配置 Python 或 PandaData。</small></>
          : <><MagnifyingGlass size={28}/><b>没有匹配的会话</b><small>清除搜索词或切换会话类型。</small></>}
      </div>}
      {!managing && <footer className={css.sessionFooter}>
        <small>共 {rows.length} 条</small>
        <button
          type="button"
          className={css.sessionManageButton}
          title="批量管理会话"
          disabled={recent.length === 0}
          onClick={() => {
            setNotificationsOpen(false)
            setManaging(true)
          }}
        ><List size={16}/>批量管理</button>
      </footer>}
      {error && <p className={css.error} role="alert">{error}</p>}
    </aside>}
    {archivesOpen && <div
      className={css.sessionDivider}
      role="separator"
      aria-label="调整会话列表宽度"
      aria-orientation="vertical"
      aria-valuemin={SESSION_DRAWER_MIN_WIDTH}
      aria-valuemax={SESSION_DRAWER_MAX_WIDTH}
      aria-valuenow={drawerWidth}
      tabIndex={0}
      title="拖拽调整会话列表宽度；双击恢复默认宽度"
      onDoubleClick={() => { resize(SESSION_DRAWER_DEFAULT_WIDTH, true) }}
      onKeyDown={resizeByKeyboard}
      onPointerDown={beginResize}
      onPointerMove={continueResize}
      onPointerUp={finishResize}
      onPointerCancel={finishResize}
    >
      {onCollapseDrawer !== undefined && <button
        type="button"
        className={`${css.sidebarToggle} ${css.sessionDividerButton}`}
        aria-label="隐藏会话侧栏"
        title="隐藏会话侧栏"
        onPointerDown={(event) => { event.stopPropagation() }}
        onClick={(event) => {
          event.stopPropagation()
          onCollapseDrawer()
        }}
      ><CaretLeft size={15}/></button>}
    </div>}
    {!sidebarOnly && <section className={css.stockConversation}>
      {currentKind === undefined || currentKind === kindFilter
        ? children
        : <ConversationKindEmpty kind={kindFilter}/>}
    </section>}
    {pendingRename !== undefined && <RenameSessionDialog
      row={pendingRename}
      catalog={catalog}
      draft={renameDraft}
      busy={renaming}
      error={renameError}
      onDraftChange={(draft) => {
        setRenameDraft(draft)
        setRenameError(undefined)
      }}
      onCancel={() => { if (!renaming) setPendingRename(undefined) }}
      onConfirm={(title) => { void confirmRename(pendingRename, title) }}
    />}
    {pendingRemoval !== undefined && <RemoveSessionDialog
      request={pendingRemoval}
      catalog={catalog}
      retainedRunningCount={pendingRemoval.kind === 'clear' ? running.length : 0}
      busy={removing}
      error={error}
      onCancel={() => { if (!removing) setPendingRemoval(undefined) }}
      onConfirm={() => { void confirmRemoval() }}
    />}
  </div>
}

function ConversationKindEmpty({ kind }: { kind: 'plain' | 'skill' | 'agent' | 'team' }) {
  const label = kind === 'plain' ? '普通' : kind === 'skill' ? '技能' : kind === 'agent' ? '专家' : '专家团'
  return <div className={css.conversationKindEmpty}>
    <CapabilityIcon kind={kind === 'skill' ? 'skill' : kind === 'team' ? 'agent-team' : 'agent'} size={38}/>
    <h2>暂无 {label} 会话</h2>
    <p>左侧只显示这一类型的存档。点击“创建”或从技能、专家页面明确开始后，会在这里建立独立上下文。</p>
  </div>
}

type ConversationRow = { kind: 'plain'; archive: QuantSkillsPlainSessionArchiveItem }
  | { kind: 'skill'; archive: QuantSkillsSessionArchiveItem }
  | { kind: 'agent'; archive: QuantSkillsAgentSessionArchiveItem }
  | { kind: 'team'; archive: QuantSkillsAgentTeamSessionArchiveItem }

interface ConversationRemovalRequest {
  readonly kind: 'single' | 'selected' | 'clear'
  readonly rows: readonly ConversationRow[]
}

interface ConversationDateGroup {
  readonly key: string
  readonly label: string
  readonly rows: readonly ConversationRow[]
}

const SESSION_DRAWER_MIN_WIDTH = 320
const SESSION_DRAWER_MAX_WIDTH = 560
const SESSION_DRAWER_DEFAULT_WIDTH = 420
const SESSION_DRAWER_KEYBOARD_STEP = 16
const SESSION_DRAWER_STORAGE_KEY = 'dsh.quantskills.session-drawer-width'

function clampSessionDrawerWidth(width: number): number {
  return Math.min(SESSION_DRAWER_MAX_WIDTH, Math.max(SESSION_DRAWER_MIN_WIDTH, Math.round(width)))
}

function readSessionDrawerWidth(): number {
  if (typeof window === 'undefined') return SESSION_DRAWER_DEFAULT_WIDTH
  try {
    const stored = Number(window.localStorage.getItem(SESSION_DRAWER_STORAGE_KEY))
    return Number.isFinite(stored) && stored > 0
      ? clampSessionDrawerWidth(stored)
      : SESSION_DRAWER_DEFAULT_WIDTH
  } catch (_storageUnavailable) {
    return SESSION_DRAWER_DEFAULT_WIDTH
  }
}

function writeSessionDrawerWidth(width: number): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SESSION_DRAWER_STORAGE_KEY, String(clampSessionDrawerWidth(width)))
  } catch (_storageUnavailable) {
    // Browser-local presentation remains usable for this mount when persistent storage is unavailable.
  }
}

function conversationRowTitle(row: ConversationRow, catalog?: QuantSkillsCatalogSnapshot): string {
  return row.archive.title ?? (row.kind === 'plain'
    ? '新会话'
    : row.kind === 'skill'
    ? catalog === undefined ? row.archive.binding.assetId : assetTitle(catalog, row.archive.binding.assetId)
    : row.kind === 'agent' ? row.archive.agent.name : row.archive.team.name)
}

function conversationRowSearchText(row: ConversationRow, catalog: QuantSkillsCatalogSnapshot): string {
  const technicalId = row.kind === 'plain'
    ? row.archive.sessionId
    : row.kind === 'skill'
    ? row.archive.binding.assetId
    : row.kind === 'agent' ? row.archive.agent.agentId : row.archive.team.teamId
  const ownerName = row.kind === 'plain'
    ? '普通会话'
    : row.kind === 'skill'
    ? assetTitle(catalog, row.archive.binding.assetId)
    : row.kind === 'agent' ? row.archive.agent.name : row.archive.team.name
  return `${conversationRowTitle(row, catalog)} ${ownerName} ${technicalId}`.toLocaleLowerCase('zh-CN')
}

/** Group conversations into stable local-time recency buckets. */
function groupConversationRowsByDate(
  rows: readonly ConversationRow[],
  now = Date.now(),
): readonly ConversationDateGroup[] {
  const today = new Date(now)
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const yesterdayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).getTime()
  const sevenDayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6).getTime()
  const hourStart = now - 60 * 60 * 1000
  const groups: Array<ConversationDateGroup & { rows: ConversationRow[] }> = [
    { key: 'last-hour', label: '最近1小时', rows: [] },
    { key: 'today', label: '今天', rows: [] },
    { key: 'yesterday', label: '昨天', rows: [] },
    { key: 'last-seven-days', label: '最近7天', rows: [] },
    { key: 'history', label: '历史', rows: [] },
  ]
  for (const row of [...rows].sort((left, right) => right.archive.updatedAt - left.archive.updatedAt)) {
    const updatedAt = row.archive.updatedAt
    const group = updatedAt >= hourStart
      ? groups[0]
      : updatedAt >= todayStart
        ? groups[1]
        : updatedAt >= yesterdayStart
          ? groups[2]
          : updatedAt >= sevenDayStart
            ? groups[3]
            : groups[4]
    group?.rows.push(row)
  }
  return groups.filter(group => group.rows.length > 0).map(group => ({
    key: group.key,
    label: group.label,
    rows: Object.freeze(group.rows),
  }))
}

function conversationNotificationLabel(row: ConversationRow): string {
  if (row.archive.runState === 'failed') return '运行失败，点击查看'
  return '运行完成，点击查看'
}

function conversationNotificationStatus(row: ConversationRow): Parameters<typeof StatusDot>[0]['status'] {
  return row.archive.runState === 'idle' ? 'waiting' : row.archive.runState
}

function ConversationNotificationMenu({ rows, unreadCount, catalog, openSession }: {
  rows: readonly ConversationRow[]
  unreadCount: number
  catalog: QuantSkillsCatalogSnapshot
  openSession: (id: SessionId) => void
}) {
  return <section className={css.notificationMenu} role="dialog" aria-label="会话通知列表">
    <header>
      <span><b>会话通知</b><small>{unreadCount === 0 ? '没有未读运行结果' : `${String(unreadCount)} 条运行结果未查看`}</small></span>
    </header>
    <div>
      {rows.map(row => <button
        type="button"
        key={row.archive.sessionId}
        onClick={() => { openSession(row.archive.sessionId) }}
      >
        {row.kind === 'skill'
          ? <SkillMark small/>
          : <span className={css.agentMark}>{row.kind === 'plain' ? <ChatsCircle/> : <CapabilityIcon kind={row.kind === 'team' ? 'agent-team' : 'agent'}/>}</span>}
        <span>
          <b>{conversationRowTitle(row, catalog)}</b>
          <small>{conversationNotificationLabel(row)} · {formatUpdated(row.archive.updatedAt)}</small>
        </span>
        <StatusDot status={conversationNotificationStatus(row)}/>
      </button>)}
      {rows.length === 0 && <p>完成或失败的运行结果会显示在这里。</p>}
    </div>
  </section>
}

function RemoveSessionDialog({ request, catalog, retainedRunningCount, busy, error, onCancel, onConfirm }: {
  request: ConversationRemovalRequest
  catalog: QuantSkillsCatalogSnapshot
  retainedRunningCount: number
  busy: boolean
  error: string | undefined
  onCancel: () => void
  onConfirm: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    cancelRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => { window.removeEventListener('keydown', closeOnEscape) }
  }, [busy, onCancel])
  const single = request.kind === 'single' ? request.rows[0] : undefined
  const heading = request.kind === 'single' && single !== undefined
    ? `删除“${conversationRowTitle(single, catalog)}”会话？`
    : request.kind === 'clear'
      ? `清空 ${String(request.rows.length)} 个可删除会话？`
      : `删除选中的 ${String(request.rows.length)} 个会话？`
  const confirmLabel = request.kind === 'clear' ? '清空会话' : '删除会话'
  return <div className={css.dialogBackdrop}>
    <section className={css.removeDialog} role="dialog" aria-modal="true" aria-labelledby="remove-session-title">
      <span className={css.removeDialogIcon}><Trash size={20}/></span>
      <div>
        <h2 id="remove-session-title">{heading}</h2>
        <p>{request.kind === 'single' ? '该会话' : '这些会话'}会从 QuantSkills 列表中移除，原始记录仍保留在会话归档中。</p>
        {retainedRunningCount > 0 && <p>{retainedRunningCount} 个运行中的会话会保留。</p>}
        {error !== undefined && <p className={css.removeDialogError} role="alert">{error}</p>}
      </div>
      <footer>
        <button ref={cancelRef} type="button" disabled={busy} onClick={onCancel}>取消</button>
        <button type="button" disabled={busy} className={css.removeConfirmButton} onClick={onConfirm}>
          {busy ? '处理中…' : confirmLabel}
        </button>
      </footer>
    </section>
  </div>
}

function RenameSessionDialog({ row, catalog, draft, busy, error, onDraftChange, onCancel, onConfirm }: {
  row: ConversationRow
  catalog: QuantSkillsCatalogSnapshot
  draft: string
  busy: boolean
  error: string | undefined
  onDraftChange: (draft: string) => void
  onCancel: () => void
  onConfirm: (title: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const trimmed = draft.trim()
  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => { window.removeEventListener('keydown', closeOnEscape) }
  }, [busy, onCancel])
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (!busy && trimmed !== '') onConfirm(trimmed)
  }
  return <div className={css.dialogBackdrop}>
    <form
      className={css.renameDialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onSubmit={submit}
    >
      <span className={css.renameDialogIcon}><PencilSimple size={20}/></span>
      <div>
        <h2 id={titleId}>重命名会话</h2>
        <p>为“{conversationRowTitle(row, catalog)}”设置便于识别的名称。新名称会保存到会话记录中。</p>
      </div>
      <label>
        <span>会话名称</span>
        <input
          ref={inputRef}
          value={draft}
          aria-label="会话名称"
          disabled={busy}
          onChange={(event) => { onDraftChange(event.currentTarget.value) }}
        />
      </label>
      {error !== undefined && <p className={css.renameDialogError} role="alert">{error}</p>}
      <footer>
        <button type="button" disabled={busy} onClick={onCancel}>取消</button>
        <button type="submit" disabled={busy || trimmed === ''} className={css.renameConfirmButton}>
          {busy ? '保存中…' : '重命名'}
        </button>
      </footer>
    </form>
  </div>
}

function ConversationSwitchGroup({
  title, rows, catalog, currentSessionId, openSession, requestRename, requestRemoval,
  managing, selectedSessionIds, toggleSelection,
}: {
  title: string
  rows: readonly ConversationRow[]
  catalog: QuantSkillsCatalogSnapshot
  currentSessionId: SessionId | undefined
  openSession: (id: SessionId) => void
  requestRename: (row: ConversationRow) => void
  requestRemoval: (row: ConversationRow) => void
  managing: boolean
  selectedSessionIds: ReadonlySet<SessionId>
  toggleSelection: (id: SessionId) => void
}) {
  if (rows.length === 0) return null
  return <section className={css.sessionGroup}>
    <h2>{title}<mark>{rows.length}</mark></h2>
    <div className={css.sessionTabs}>
      {rows.map(row => <div
        key={row.archive.sessionId}
        className={clsx(
          css.sessionTab,
          managing && css.sessionTabManaging,
          row.archive.sessionId === currentSessionId && css.selected,
        )}
      >
        {managing && <label
          className={css.sessionSelect}
          title={row.archive.running ? '运行中的会话不能删除' : '选择会话'}
        >
          <input
            type="checkbox"
            aria-label={`选择会话 ${conversationRowTitle(row, catalog)}`}
            checked={selectedSessionIds.has(row.archive.sessionId)}
            disabled={row.archive.running}
            onChange={() => { toggleSelection(row.archive.sessionId) }}
          />
        </label>}
        <button
          type="button"
          className={css.sessionOpen}
          aria-current={row.archive.sessionId === currentSessionId ? 'page' : undefined}
          onClick={() => { openSession(row.archive.sessionId) }}
        >
          {row.kind === 'skill'
            ? <SkillMark small/>
            : <span className={css.agentMark}>{row.kind === 'plain' ? <ChatsCircle/> : <CapabilityIcon kind={row.kind === 'team' ? 'agent-team' : 'agent'}/>}</span>}
          <span>
            <b>{conversationRowTitle(row, catalog)}</b>
            <small>{row.kind === 'plain'
              ? '普通会话'
              : row.kind === 'skill'
              ? `${assetTitle(catalog, row.archive.binding.assetId)} · 技能`
              : row.kind === 'agent' ? `专家 · ${row.archive.agent.name}` : `专家团 · ${row.archive.team.name}`} · {formatUpdated(row.archive.updatedAt)}</small>
          </span>
          {row.archive.running ? <StatusDot status="running"/> : <CaretRight/>}
        </button>
        {!managing && <span className={css.sessionActions}>
          <button
            type="button"
            className={clsx(css.sessionAction, css.sessionRename)}
            aria-label={`重命名会话 ${conversationRowTitle(row, catalog)}`}
            title="重命名会话"
            onClick={() => { requestRename(row) }}
          ><PencilSimple size={16}/></button>
          <button
            type="button"
            className={clsx(css.sessionAction, css.sessionRemove)}
            aria-label={`删除会话 ${conversationRowTitle(row, catalog)}`}
            title={row.archive.running ? '运行中的会话不能删除' : '删除会话'}
            disabled={row.archive.running}
            onClick={() => { requestRemoval(row) }}
          ><Trash size={16}/></button>
        </span>}
      </div>)}
    </div>
  </section>
}

function SkillMark({ tone = 'blue', small = false }: { tone?: string | undefined; small?: boolean }) {
  return <span className={clsx(css.skillMark, css[tone], small && css.skillMarkSmall)}><CapabilityIcon kind="skill" size={small ? 18 : 24}/></span>
}

function StatusDot({ status }: { status: 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled' }) {
  return <span
    className={clsx(css.statusDot, css[status])}
    aria-label={status === 'running' ? '运行中' : status === 'waiting' ? '等待回复' : status === 'failed' ? '失败' : status === 'cancelled' ? '已取消' : '已完成'}
  />
}

const NAV_ITEMS: readonly { page: QuantSkillsPage; label: string; icon: ReactNode }[] = [
  { page: 'home', label: '首页', icon: <House size={24} /> },
  { page: 'skills', label: '技能', icon: <CapabilityIcon kind="skill"/> },
  { page: 'agents', label: '专家', icon: <CapabilityIcon kind="agent"/> },
  { page: 'teams', label: '专家团', icon: <CapabilityIcon kind="agent-team"/> },
  { page: 'conversations', label: '会话', icon: <ChatsCircle size={25} /> },
  { page: 'database', label: '数据库', icon: <Database size={24}/> },
  { page: 'favorites', label: '收藏', icon: <Star size={24} /> },
]

const PLUGIN_NAV_WIDTH = 96
const PLUGIN_SESSION_DIVIDER_WIDTH = 9
const RESULT_WORKBENCH_MIN_WIDTH = 360
const RESULT_WORKBENCH_MAX_WIDTH = 960
const RESULT_WORKBENCH_DEFAULT_WIDTH = 420
const RESULT_WORKBENCH_KEYBOARD_STEP = 24
const RESULT_WORKBENCH_STORAGE_KEY = 'dsh.quantskills.result-workbench-width'

function clampResultWorkbenchWidth(width: number): number {
  return Math.min(RESULT_WORKBENCH_MAX_WIDTH, Math.max(RESULT_WORKBENCH_MIN_WIDTH, Math.round(width)))
}

function readResultWorkbenchWidth(): number {
  if (typeof window === 'undefined') return RESULT_WORKBENCH_DEFAULT_WIDTH
  try {
    const stored = Number(window.localStorage.getItem(RESULT_WORKBENCH_STORAGE_KEY))
    return Number.isFinite(stored) && stored > 0
      ? clampResultWorkbenchWidth(stored)
      : RESULT_WORKBENCH_DEFAULT_WIDTH
  } catch (_storageUnavailable) {
    return RESULT_WORKBENCH_DEFAULT_WIDTH
  }
}

function writeResultWorkbenchWidth(width: number): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(RESULT_WORKBENCH_STORAGE_KEY, String(clampResultWorkbenchWidth(width)))
  } catch (_storageUnavailable) {
    // The current split remains usable when browser-local persistence is unavailable.
  }
}

/** Full-screen QuantSkills application hosted by the stock DSH shell. */
export function QuantSkillsPluginFrame({
  useView, useLayout, useCatalog, useBoundSessions, useAgents, useSessions, useNotifications,
  renderSlot, actions, openSession, acknowledgeNotification, renameSession, removeSessions,
  startSession, startAuthoringSession, openAgentTeamBuilder, claimSidebar, claimDetails,
  claimConversationTextScale, openResults, closeResults, close, modelAccess,
}: QuantSkillsPluginFrameProps) {
  const open = useView(state => state.pluginOpen)
  const page = useView(state => state.page)
  const conversationOpen = useView(state => state.pluginConversationOpen)
  const interfaceScale = useView(state => state.interfaceScale)
  const conversationScale = useView(state => state.conversationScale)
  const conversationBrightness = useView(state => state.conversationBrightness)
  const conversationOverlayOpacity = useView(state => state.conversationOverlayOpacity)
  const colorScheme = useView(state => state.colorScheme)
  const lightBackground = useView(state => state.lightBackground)
  const darkBackground = useView(state => state.darkBackground)
  const background = useMemo(
    () => resolveQuantSkillsBackground(colorScheme, lightBackground, darkBackground),
    [colorScheme, darkBackground, lightBackground],
  )
  const displayNameOverrides = useView(state => state.assetDisplayNameOverrides)
  const resultsOpen = useLayout(state => state.resultsOpen)
  const currentSessionId = useSessions(state => state.current)
  const catalogSnapshot = useCatalog(snapshot => snapshot)
  const catalog = useMemo(
    () => applyAssetDisplayNameOverrides(catalogSnapshot, displayNameOverrides),
    [catalogSnapshot, displayNameOverrides],
  )
  const plainArchives = useBoundSessions(state => state.plainArchives)
  const skillArchives = useBoundSessions(state => state.archives)
  const agentArchives = useAgents(state => state.archives)
  const teamArchives = useAgents(state => state.teamArchives)
  const unreadBySession = useNotifications(state => state.unreadBySession)
  const unreadCount = useNotifications(state => Object.keys(state.unreadBySession).length)
  const workspaceRecoveryNotice = useView(state => state.workspaceRecoveryNotice)
  const [drawerWidth, setDrawerWidth] = useState(readSessionDrawerWidth)
  const [sessionDrawerOpen, setSessionDrawerOpen] = useState(true)
  const [resultWidth, setResultWidth] = useState(readResultWorkbenchWidth)
  const [resultMaximized, setResultMaximized] = useState(false)
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)
  const mobile = viewportWidth <= 840
  const frameScale = mobile ? 1 : interfaceScale
  const [mobilePanel, setMobilePanel] = useState<'navigation' | 'sessions' | undefined>()
  const navigationRef = useRef<HTMLElement>(null)
  const mobileSessionsRef = useRef<HTMLDivElement>(null)
  const mobileHeaderRef = useRef<HTMLElement>(null)
  const mobileNavId = useId()
  const mobileSessionsId = useId()
  const mobileResultsId = useId()
  useEffect(() => {
    const resize = () => { setViewportWidth(window.innerWidth) }
    window.addEventListener('resize', resize)
    return () => { window.removeEventListener('resize', resize) }
  }, [])
  const resultFrameRef = useRef<HTMLDivElement>(null)
  const sidebarClaim = useRef<SidebarColumnClaim>()
  const resultDrag = useRef<{ readonly pointerId: number; readonly startX: number; readonly startWidth: number }>()
  const resultClaim = useRef<DetailsColumnClaim>()
  const conversationScaleClaim = useRef<ConversationTextScaleClaim>()
  const resultSession = useRef(currentSessionId)
  const quantSkillsConversationSelected = plainArchives.some(archive => archive.sessionId === currentSessionId)
    || skillArchives.some(archive => archive.sessionId === currentSessionId)
    || agentArchives.some(archive => archive.sessionId === currentSessionId)
    || teamArchives.some(archive => archive.sessionId === currentSessionId)
  const resultSurfaceVisible = open && conversationOpen && quantSkillsConversationSelected
  const resultWorkbenchOpen = resultSurfaceVisible && resultsOpen
  const claimedSidebarWidth = mobile ? 0 : Math.round(
    (PLUGIN_NAV_WIDTH + (sessionDrawerOpen ? drawerWidth + PLUGIN_SESSION_DIVIDER_WIDTH : 0)) * frameScale,
  )
  const resultOverlay = mobile || viewportWidth - claimedSidebarWidth - resultWidth < 520
  const actualResultWidth = Math.min(resultWidth, Math.max(280, viewportWidth - 88))
  const claimedSidebarWidthRef = useRef(claimedSidebarWidth)
  claimedSidebarWidthRef.current = claimedSidebarWidth
  useQuantSkillsDocumentAppearance(open, colorScheme, background, conversationBrightness, conversationOverlayOpacity, conversationOpen)
  useEffect(() => {
    if (!open || !mobile) return
    document.body.setAttribute('data-qs-mobile', '')
    const updateHeight = () => {
      // Follow the on-screen keyboard without changing layout during pinch zoom.
      const visual = window.visualViewport
      const height = visual && visual.scale === 1 ? visual.height : window.innerHeight
      document.body.style.setProperty('--qs-mobile-height', `${height}px`)
    }
    updateHeight()
    window.visualViewport?.addEventListener('resize', updateHeight)
    window.addEventListener('resize', updateHeight)
    return () => {
      document.body.removeAttribute('data-qs-mobile')
      document.body.style.removeProperty('--qs-mobile-height')
      window.visualViewport?.removeEventListener('resize', updateHeight)
      window.removeEventListener('resize', updateHeight)
    }
  }, [mobile, open])
  useEffect(() => { setMobilePanel(undefined) }, [page, currentSessionId, conversationOpen, mobile])
  useEffect(() => { if (resultWorkbenchOpen) setMobilePanel(undefined) }, [resultWorkbenchOpen])
  useEffect(() => {
    if (!mobile || !open) return
    const panel = mobilePanel === 'navigation' ? navigationRef.current
      : mobilePanel === 'sessions' ? mobileSessionsRef.current
      : resultWorkbenchOpen ? resultFrameRef.current : null
    if (!panel) return
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusables = () => [...panel.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, select, textarea, [tabindex="0"]')]
      .filter(element => element.getClientRects().length > 0)
    focusables()[0]?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return
      if (event.key === 'Escape') { event.preventDefault(); setMobilePanel(undefined); closeResults(); return }
      if (event.key !== 'Tab') return
      // Include the toolbar's close/toggle controls in the drawer focus cycle.
      const items = [...(mobileHeaderRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? []), ...focusables()]
      const first = items[0], last = items.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); if (trigger?.isConnected) trigger.focus({ preventScroll: true }) }
  }, [mobile, mobilePanel, open, resultWorkbenchOpen, closeResults])
  useEffect(() => {
    if (!open || !conversationOpen) return
    const claim = claimSidebar({
      width: claimedSidebarWidthRef.current,
      exclusive: true,
      onDisplaced: close,
    })
    sidebarClaim.current = claim
    return () => {
      if (sidebarClaim.current === claim) sidebarClaim.current = undefined
      claim.release()
    }
  }, [claimSidebar, close, conversationOpen, open])
  useEffect(() => { sidebarClaim.current?.update(claimedSidebarWidth) }, [claimedSidebarWidth])
  useEffect(() => {
    if (!open || !conversationOpen) return
    const claim = claimConversationTextScale(conversationScale)
    conversationScaleClaim.current = claim
    return () => {
      if (conversationScaleClaim.current === claim) conversationScaleClaim.current = undefined
      claim.release()
    }
  }, [claimConversationTextScale, conversationOpen, open])
  useEffect(() => { conversationScaleClaim.current?.update(conversationScale) }, [conversationScale])
  useEffect(() => {
    if (!mobile && (!resultWorkbenchOpen || resultOverlay || resultMaximized)) return
    if (!open || !conversationOpen) return
    const claim = claimDetails({
      width: mobile ? 0 : resultWidth,
      exclusive: true,
      onDisplaced: closeResults,
    })
    resultClaim.current = claim
    return () => {
      if (resultDrag.current !== undefined) {
        resultDrag.current = undefined
        claim.setDragging(false)
      }
      if (resultClaim.current === claim) resultClaim.current = undefined
      claim.release()
    }
  }, [claimDetails, closeResults, resultWorkbenchOpen, resultOverlay, resultMaximized, mobile, open, conversationOpen])
  useEffect(() => { resultClaim.current?.update(mobile ? 0 : resultWidth) }, [resultWidth, mobile])
  useEffect(() => {
    if (resultWorkbenchOpen) return
    setResultMaximized(false)
    if (resultDrag.current !== undefined) {
      resultDrag.current = undefined
      resultClaim.current?.setDragging(false)
    }
  }, [resultWorkbenchOpen])
  useEffect(() => {
    if (resultSession.current !== currentSessionId) closeResults()
    resultSession.current = currentSessionId
  }, [closeResults, currentSessionId])
  useEffect(() => {
    if (resultsOpen && !resultWorkbenchOpen) closeResults()
  }, [closeResults, resultWorkbenchOpen, resultsOpen])
  useEffect(() => {
    if (!resultWorkbenchOpen || !resultMaximized) return
    const panel = resultFrameRef.current
    if (!panel) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusFirst = () => { panel.querySelector<HTMLElement>('button:not(:disabled), [tabindex="0"]')?.focus() }
    const containFocus = (event: FocusEvent) => {
      if (!panel.contains(event.target as Node) && !document.querySelector('dialog[open]')) focusFirst()
    }
    focusFirst()
    document.addEventListener('focusin', containFocus)
    return () => { document.removeEventListener('focusin', containFocus); if (previous?.isConnected) previous.focus() }
  }, [resultWorkbenchOpen, resultOverlay, resultMaximized])
  if (!open) return null
  const currentPlain = plainArchives.find(archive => archive.sessionId === currentSessionId)
  const currentSkill = skillArchives.find(archive => archive.sessionId === currentSessionId)
  const currentAgent = agentArchives.find(archive => archive.sessionId === currentSessionId)
  const currentTeam = teamArchives.find(archive => archive.sessionId === currentSessionId)
  const openNotifiedSession = (id: SessionId): void => {
    acknowledgeNotification(id)
    openSession(id)
  }
  const resizeResult = (next: number, persist: boolean): void => {
    const width = clampResultWorkbenchWidth(next)
    setResultWidth(width)
    if (persist) writeResultWorkbenchWidth(width)
  }
  const beginResultResize = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    resultDrag.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: resultWidth }
    resultClaim.current?.setDragging(true)
  }
  const continueResultResize = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const active = resultDrag.current
    if (active === undefined || active.pointerId !== event.pointerId) return
    resizeResult(active.startWidth - (event.clientX - active.startX), false)
  }
  const finishResultResize = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const active = resultDrag.current
    if (active === undefined || active.pointerId !== event.pointerId) return
    resultDrag.current = undefined
    resultClaim.current?.setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    resizeResult(active.startWidth - (event.clientX - active.startX), true)
  }
  const cancelResultResize = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const active = resultDrag.current
    if (active === undefined || active.pointerId !== event.pointerId) return
    resultDrag.current = undefined
    resultClaim.current?.setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    writeResultWorkbenchWidth(resultWidth)
  }
  const resizeResultByKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const next = event.key === 'ArrowLeft'
      ? resultWidth + RESULT_WORKBENCH_KEYBOARD_STEP
      : event.key === 'ArrowRight'
        ? resultWidth - RESULT_WORKBENCH_KEYBOARD_STEP
        : event.key === 'Home'
          ? RESULT_WORKBENCH_MIN_WIDTH
          : event.key === 'End'
            ? RESULT_WORKBENCH_MAX_WIDTH
            : undefined
    if (next === undefined) return
    event.preventDefault()
    resizeResult(next, true)
  }
  return <section
    className={css.pluginFrame}
    style={{
      '--qs-plugin-nav-width': `${String(mobile ? 0 : Math.round(PLUGIN_NAV_WIDTH * frameScale))}px`,
      '--qs-interface-scale': frameScale,
      '--qs-interface-inverse-scale': 1 / frameScale,
      '--qs-background-image': background.gradient ?? (background.url === undefined ? 'none' : `url("${background.url}")`),
      '--qs-background-position': background.position,
    } as CSSProperties}
    aria-label="QuantSkills 插件应用"
    data-conversation-open={conversationOpen || undefined}
    data-mobile-panel={mobile ? mobilePanel : undefined}
    data-plugin-interface-scale={interfaceScale}
    data-qs-theme={colorScheme}
    data-qs-background={background.id}
  >
    <ModelStartup access={modelAccess}/>
    {mobile && <header ref={mobileHeaderRef} className={css.mobileHeader} aria-label="移动端工具栏">
      <button type="button" aria-label={mobilePanel === 'navigation' ? '关闭导航' : '打开导航'} aria-expanded={mobilePanel === 'navigation'} aria-controls={mobileNavId}
        onClick={() => { closeResults(); setMobilePanel(current => current === 'navigation' ? undefined : 'navigation') }}>
        {mobilePanel === 'navigation' ? <X size={22}/> : <List size={22}/>}
      </button>
      <span className={css.mobileTitle}><QuantSkillsBrandMark size={20}/><b>{conversationOpen ? '会话' : NAV_ITEMS.find(item => item.page === page)?.label ?? ({ qube: 'QUBE', evo: 'EVO', settings: '设置' } as Record<string, string>)[page] ?? 'QuantSkills'}</b></span>
      {conversationOpen && <button type="button" aria-label={mobilePanel === 'sessions' ? '关闭会话列表' : '打开会话列表'} aria-expanded={mobilePanel === 'sessions'} aria-controls={mobileSessionsId}
        onClick={() => { closeResults(); setMobilePanel(current => current === 'sessions' ? undefined : 'sessions') }}><ChatsCircle size={22}/></button>}
      {resultSurfaceVisible && <button type="button" aria-label={resultWorkbenchOpen ? '关闭结果预览' : '打开结果预览'} aria-expanded={resultWorkbenchOpen} aria-controls={mobileResultsId}
        onClick={() => { setMobilePanel(undefined); if (resultWorkbenchOpen) closeResults(); else openResults() }}><FolderOpen size={22}/></button>}
    </header>}
    {workspaceRecoveryNotice !== undefined && <div className={css.pluginNotice} role="status">
      <span>{workspaceRecoveryNotice}</span>
      <button type="button" onClick={() => { actions.setWorkspaceRecoveryNotice(undefined) }}>知道了</button>
    </div>}
    {!conversationOpen && <header className={css.pluginHeader}>
      <span className={css.pluginBrand}><QuantSkillsBrandLockup /></span>
    </header>}
    <div className={css.pluginBody}>
      {mobile && (mobilePanel || resultWorkbenchOpen) && <button type="button" className={css.mobileScrim} aria-label="关闭展开面板" tabIndex={-1} onClick={() => { setMobilePanel(undefined); closeResults() }}/>}
      <nav ref={navigationRef} id={mobileNavId} className={css.pluginNav} aria-label="QuantSkills 插件导航"
        onClick={event => { if (mobile && (event.target as Element).closest('button')) setMobilePanel(undefined) }}>
        {conversationOpen && <span className={css.pluginConversationBrand} title="QuantSkills"><QuantSkillsBrandMark size={30}/></span>}
        {NAV_ITEMS.map(item => <button
          key={item.page}
          type="button"
          className={clsx(css.pluginNavItem, (page === item.page || (item.page === 'conversations' && page === 'parallel')) && css.pluginNavItemActive)}
          aria-current={page === item.page ? 'page' : undefined}
          onClick={() => {
            if (item.page === 'conversations') actions.showPluginConversationIndex()
            else actions.navigate(item.page)
          }}
        >
          <span className={css.railIcon}>{item.icon}{item.page === 'conversations' && unreadCount > 0 && <b className={css.badge}>{unreadCount}</b>}</span>
          <span>{item.label}</span>
        </button>)}
        <div className={css.productLinks} role="group" aria-label="PandaAI 产品">
          <button type="button" className={clsx(css.pluginNavItem, page === 'qube' && css.pluginNavItemActive)} aria-current={page === 'qube' ? 'page' : undefined} onClick={() => actions.navigate('qube')} title="QUBE · 产品介绍">
            <Cube size={24} aria-hidden="true"/><span>QUBE</span>
          </button>
          <button type="button" className={clsx(css.pluginNavItem, page === 'evo' && css.pluginNavItemActive)} aria-current={page === 'evo' ? 'page' : undefined} onClick={() => actions.navigate('evo')} title="EVO · 产品介绍">
            <Dna size={24} aria-hidden="true"/><span>EVO</span>
          </button>
        </div>
        <button
          type="button"
          className={clsx(css.pluginNavItem, page === 'settings' && css.pluginNavItemActive)}
          aria-current={page === 'settings' ? 'page' : undefined}
          onClick={() => { actions.navigate('settings') }}
        ><GearSix size={24}/><span>设置</span></button>
      </nav>
      <div ref={mobileSessionsRef} id={mobileSessionsId} className={css.pluginPage}>
        <div className={css.pluginScaleViewport} data-interface-scale-viewport="page">
          {conversationOpen
            ? <ConversationFrame
              currentPlain={currentPlain}
              currentSkill={currentSkill}
              currentAgent={currentAgent}
              currentTeam={currentTeam}
              plainArchives={plainArchives}
              skillArchives={skillArchives}
              agentArchives={agentArchives}
              teamArchives={teamArchives}
              catalog={catalog}
              archivesOpen={mobile ? mobilePanel === 'sessions' : sessionDrawerOpen}
              unreadBySession={unreadBySession}
              openSession={id => { setMobilePanel(undefined); openNotifiedSession(id) }}
              renameSession={renameSession}
              removeSessions={removeSessions}
              startSession={startSession}
              startAuthoringSession={startAuthoringSession}
              openAgentTeamBuilder={openAgentTeamBuilder}
              sidebarOnly
              drawerWidth={drawerWidth}
              onDrawerWidthChange={setDrawerWidth}
              onCollapseDrawer={() => { setSessionDrawerOpen(false) }}
              interfaceScale={frameScale}
            />
            : renderSlot('quantskills.page', {})}
        </div>
      </div>
    </div>
    {!mobile && conversationOpen && !sessionDrawerOpen && <button
      type="button"
      className={`${css.sidebarToggle} ${css.sessionDrawerRestore}`}
      aria-label="显示会话侧栏"
      title="显示会话侧栏"
      onClick={() => { setSessionDrawerOpen(true) }}
    ><CaretRight size={15}/></button>}
    {!mobile && resultSurfaceVisible && !resultWorkbenchOpen && <button
      type="button"
      className={`${css.sidebarToggle} ${css.resultDrawerRestore}`}
      aria-label="显示结果侧栏"
      title="显示结果侧栏"
      onClick={openResults}
    ><CaretLeft size={15}/></button>}
    {resultWorkbenchOpen && <div
      ref={resultFrameRef}
      id={mobileResultsId}
      className={css.pluginResults}
      role="complementary"
      aria-label="文件与预览"
      data-floating={resultOverlay || undefined}
      data-open
      data-expanded
      data-maximized={resultMaximized || undefined}
      style={{
        '--qs-result-workbench-width': `${String(actualResultWidth)}px`,
      } as CSSProperties}
    >
      <div
        className={css.resultDivider}
        role="separator"
        aria-label="调整结果工作台宽度"
        aria-orientation="vertical"
        aria-valuemin={RESULT_WORKBENCH_MIN_WIDTH}
        aria-valuemax={RESULT_WORKBENCH_MAX_WIDTH}
        aria-valuenow={resultWidth}
        tabIndex={0}
        title="拖拽调整结果工作台宽度；双击恢复默认宽度"
        onDoubleClick={() => { resizeResult(RESULT_WORKBENCH_DEFAULT_WIDTH, true) }}
        onKeyDown={resizeResultByKeyboard}
        onPointerDown={beginResultResize}
        onPointerMove={continueResultResize}
        onPointerUp={finishResultResize}
        onPointerCancel={cancelResultResize}
        onLostPointerCapture={cancelResultResize}
      >
        <button
          type="button"
          className={`${css.sidebarToggle} ${css.resultDividerButton}`}
          aria-label="隐藏结果侧栏"
          title="隐藏结果侧栏"
          onPointerDown={(event) => { event.stopPropagation() }}
          onClick={(event) => {
            event.stopPropagation()
            closeResults()
          }}
        ><CaretRight size={15}/></button>
      </div>
      <div className={css.resultDock}>
        <div className={css.pluginScaleViewport} data-interface-scale-viewport="results">
          {renderSlot('quantskills.results', {
            mode: 'expanded',
            maximized: resultMaximized,
            expand: openResults,
            toggleMaximized: () => { setResultMaximized(current => !current) },
          })}
        </div>
      </div>
    </div>}
  </section>
}

/** QuantSkills application launcher contributed to the stock Host sidebar. */
export function QuantSkillsPluginLauncher({ wide, useNotifications, open }: QuantSkillsPluginLauncherProps) {
  const unreadCount = useNotifications(state => Object.keys(state.unreadBySession).length)
  return <button
    type="button"
    className={clsx(css.pluginLauncher, !wide && css.pluginLauncherRail)}
    aria-label="打开 QuantSkills"
    title="打开 QuantSkills"
    onClick={open}
  >
    <span className={css.railIcon}>
      <QuantSkillsBrandMark size={wide ? 18 : 22}/>
      {unreadCount > 0 && <b className={css.badge}>{unreadCount}</b>}
    </span>
    {wide && <span>QuantSkills</span>}
  </button>
}

/** Compact DSH-consistent application rail used by every QuantSkills screen. */
export function QuantSkillsRail({
  collapsed, useStore, useNotifications, actions, collapse, renderSlot,
}: QuantSkillsRailProps) {
  const page = useStore(state => state.page)
  const unreadCount = useNotifications(state => Object.keys(state.unreadBySession).length)
  return (
    <nav className={css.rail} aria-label="QuantSkills 主导航">
      <div className={css.railLogo}><QuantSkillsBrandMark size={38} /></div>
      <div className={css.railItems}>
        {NAV_ITEMS.map((item) => {
          const active = page === item.page || (item.page === 'conversations' && page === 'parallel')
          return <button
            key={item.page}
            type="button"
            className={clsx(css.railItem, active && css.railItemActive)}
            aria-current={active ? 'page' : undefined}
            aria-label={item.page === 'conversations' ? item.label : undefined}
            onClick={() => { actions.navigate(item.page) }}
          >
            <span className={css.railIcon}>
              {item.icon}
              {item.page === 'conversations' && unreadCount > 0
                && <b className={css.badge}>{unreadCount}</b>}
            </span>
            <span>{item.label}</span>
          </button>
        })}
      </div>
      <div className={css.railFooterActions}>
        {renderSlot('sidebar.footer.action', { wide: false })}
      </div>
      <button type="button" className={clsx(css.railItem, page === 'settings' && css.railItemActive)} onClick={() => { actions.navigate('settings') }}>
        <GearSix size={25} /><span>设置</span>
      </button>
      {collapsed && <button type="button" className={css.railExpand} aria-label="展开导航" onClick={collapse}><CaretRight /></button>}
    </nav>
  )
}

/** Seven-screen QuantSkills application projected from DSH state and the published catalog. */
export function QuantSkillsApp(props: QuantSkillsAppProps) {
  const page = props.useStore(state => state.page)
  const catalogSnapshot = props.useCatalog(snapshot => snapshot)
  const displayNameOverrides = props.useStore(state => state.assetDisplayNameOverrides)
  const catalog = useMemo(
    () => applyAssetDisplayNameOverrides(catalogSnapshot, displayNameOverrides),
    [catalogSnapshot, displayNameOverrides],
  )
  const boundSessions = props.useBoundSessions(snapshot => snapshot)
  const agents = props.useAgents(snapshot => snapshot)
  const pageProps = { ...props, catalog, boundSessions, agents }
  return (
    <main className={css.app} data-page={page}>
      {page === 'home' && <HomePage {...pageProps} />}
      {page === 'skills' && <SkillsPage {...pageProps} />}
      {page === 'conversations' && <ConversationPage {...pageProps} />}
      {page === 'parallel' && <ParallelPage {...pageProps} />}
      {page === 'favorites' && <FavoritesPage {...pageProps} />}
      {(page === 'agents' || page === 'teams') && <AgentsPage {...pageProps} />}
      {page === 'settings' && <SettingsPage {...pageProps} />}
      {page === 'database' && <DatabasePage access={pageProps.databaseAccess} />}
      {(page === 'qube' || page === 'evo') && <ProductIntro product={page} navigate={props.actions.navigate} />}
    </main>
  )
}

const DRAWER_OVERLAY_QUERY = '(max-width: 1180px)'

function drawerOverlayMatches(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(DRAWER_OVERLAY_QUERY).matches
}

function useDrawerBehavior(
  open: boolean,
  onClose: () => void,
  triggerRef: RefObject<HTMLElement | null>,
  overlayEnabled = true,
) {
  const labelId = useId()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [overlay, setOverlay] = useState(() => overlayEnabled && drawerOverlayMatches())
  const close = useCallback(() => {
    onClose()
    queueMicrotask(() => { triggerRef.current?.focus() })
  }, [onClose, triggerRef])
  useEffect(() => {
    if (!overlayEnabled) {
      setOverlay(false)
      return
    }
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(DRAWER_OVERLAY_QUERY)
    const update = (event: MediaQueryListEvent): void => { setOverlay(event.matches) }
    media.addEventListener('change', update)
    return () => { media.removeEventListener('change', update) }
  }, [overlayEnabled])
  useEffect(() => {
    if (!open) return
    const escape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      close()
    }
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('keydown', escape) }
  }, [close, open])
  useEffect(() => {
    if (!open || !overlay) return
    queueMicrotask(() => { closeButtonRef.current?.focus() })
  }, [open, overlay])
  return { close, closeButtonRef, labelId, overlay, panelId: `${labelId}-panel` }
}

function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <header className={css.pageHeader}><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</header>
}

function applicationUpdateSourceLabel(source: QuantSkillsApplicationUpdateSource | undefined): string {
  return source === 'gitee' ? 'Gitee（国内）' : 'GitHub（国外）'
}

function describeApplicationUpdate(status: QuantSkillsApplicationUpdateStatus): string | undefined {
  if (status.state === 'idle') return undefined
  const source = applicationUpdateSourceLabel(status.source)
  if (status.state === 'checking') return `正在通过 ${source} 检查正式发布版本。当前会话不会受影响。`
  if (status.state === 'current') {
    return `${source}：当前${status.currentVersion === undefined ? '' : ` ${status.currentVersion}`}已是最新正式版本。`
  }
  if (status.state === 'available') {
    const version = status.candidateVersion ?? status.candidateCommit?.slice(0, 7)
    return `${source}：发现新版本${version === undefined ? '' : ` ${version}`}。只有你确认后才会下载、安装依赖并验证。`
  }
  if (status.state === 'ready') {
    const version = status.candidateVersion ?? status.candidateCommit?.slice(0, 7)
    return `${source}：新版本${version === undefined ? '' : ` ${version}`}已准备好，将在下次正常启动时生效。`
  }
  if (status.state === 'preparing') {
    const phase = status.phase === 'fetching'
      ? '正在下载官方版本'
      : status.phase === 'installing'
        ? '正在安装锁定依赖'
        : '正在执行源码与隔离启动验证'
    return `${source}：${phase}。你可以继续使用当前版本。`
  }
  if (status.state === 'blocked') {
    if (status.errorCode === 'APPLICATION_UPDATE_DEVELOPMENT_DIRTY') {
      return '检测到本地开发修改，当前开发目录保持不变；请继续使用自己的 Git 工作流。'
    }
    if (status.errorCode === 'APPLICATION_UPDATE_DEVELOPMENT_REMOTE') {
      return '当前是非官方远程的开发仓库；请继续使用自己的 Git 工作流。'
    }
    if (status.errorCode === 'APPLICATION_UPDATE_DEVELOPMENT_BRANCH') {
      return '当前是开发分支；不会切换或覆盖该分支。'
    }
    return '当前仓库包含领先或分叉提交；不会改写本地历史。'
  }
  return undefined
}

function HomePage(props: PageProps) {
  const [task, setTask] = useState('')
  const [taskBusy, setTaskBusy] = useState<'matching' | 'starting' | 'authoring'>()
  const [taskGuide, setTaskGuide] = useState<{
    readonly prompt: string
    readonly result: Exclude<QuantSkillsTaskStartResult, { readonly kind: 'started' }>
  }>()
  const [submitError, setSubmitError] = useState<string>()
  const [recommendation, setRecommendation] = useState<string>()
  const [applicationUpdate, setApplicationUpdate] = useState<QuantSkillsApplicationUpdateStatus>({ state: 'idle' })
  const [applicationUpdateSource, setApplicationUpdateSource] = useState<QuantSkillsApplicationUpdateSource>('github')
  const [applicationUpdateSourceOpen, setApplicationUpdateSourceOpen] = useState(false)
  const lastAutoUpdateCheck = useRef(0)
  const [applicationUpdateError, setApplicationUpdateError] = useState<string>()
  const [featuredActionError, setFeaturedActionError] = useState<string>()
  const [featuredCategory, setFeaturedCategory] = useState('all')
  const currentSessionId = props.useSessions(state => state.current)
  const currentBound = props.boundSessions.archives.find(archive => archive.sessionId === currentSessionId)
  const currentAgent = props.agents.archives.find(archive => archive.sessionId === currentSessionId)
  const activeSkills = props.boundSessions.archives.filter(archive => archive.running && !archive.archived)
  const activeAgents = props.agents.archives.filter(archive => archive.running && !archive.archived)
  const currentSkillActivity = currentBound ?? (currentAgent === undefined
    ? props.boundSessions.archives.find(archive => !archive.archived)
    : undefined)
  const currentAgentActivity = currentAgent ?? (currentBound === undefined
    ? props.agents.archives.find(archive => !archive.archived)
    : undefined)
  const attentionCount = activeSkills.length + activeAgents.length
  const skillAssets = props.catalog.assets.filter(asset => asset.projectType === 'skill')
  const frequent = props.boundSessions.frequent.map((entry) => {
    const asset = skillAssets.find(candidate => candidate.name === entry.assetId)
    const recent = props.boundSessions.archives.find(archive => archive.sessionId === entry.recentSessionId)
    return { entry, asset, recent }
  })
  const refreshApplicationUpdate = useCallback(() => {
    void props.applicationUpdateStatus().then((status) => {
      setApplicationUpdate(status)
      if (status.source !== undefined) setApplicationUpdateSource(status.source)
    }, (error: unknown) => {
      setApplicationUpdateError(error instanceof Error ? error.message : String(error))
    })
  }, [props.applicationUpdateStatus])
  useEffect(() => {
    let disposed = false
    const inspect = async () => {
      if (document.visibilityState === 'hidden') return
      try {
        const status = await props.applicationUpdateStatus()
        if (disposed) return
        setApplicationUpdate(status)
        if (status.source !== undefined) setApplicationUpdateSource(status.source)
        const now = Date.now()
        if (['idle', 'current', 'failed', 'blocked'].includes(status.state)
          && now - Math.max(status.checkedAt ?? 0, lastAutoUpdateCheck.current) > 60 * 60 * 1000) {
          lastAutoUpdateCheck.current = now
          const result = await props.applicationUpdateCheck({ source: status.source ?? 'github' })
          if (!disposed) { setApplicationUpdate(result.status); refreshApplicationUpdate() }
        }
      } catch { /* Manual checks surface connection errors; background checks stay quiet. */ }
    }
    const timer = window.setTimeout(() => { void inspect() }, 1500)
    const interval = window.setInterval(() => { void inspect() }, 60 * 60 * 1000)
    const onFocus = () => { void inspect() }
    window.addEventListener('focus', onFocus)
    refreshApplicationUpdate()
    return () => { disposed = true; window.clearTimeout(timer); window.clearInterval(interval); window.removeEventListener('focus', onFocus) }
  }, [props.applicationUpdateStatus, props.applicationUpdateCheck, refreshApplicationUpdate])
  useEffect(() => {
    if (applicationUpdate.state !== 'checking' && applicationUpdate.state !== 'preparing') return
    const timer = window.setInterval(refreshApplicationUpdate, 750)
    return () => { window.clearInterval(timer) }
  }, [applicationUpdate.state, refreshApplicationUpdate])
  const resolveTask = (prompt: string, assetName?: string): void => {
    setSubmitError(undefined)
    setTaskGuide(undefined)
    setTaskBusy(assetName === undefined ? 'matching' : 'starting')
    setRecommendation(assetName === undefined ? 'AI 正在理解需求并匹配现有 技能…' : '正在安装并启动所选 技能…')
    void props.startTask(prompt, assetName).then((result) => {
      if (result.kind !== 'started') {
        setRecommendation(undefined)
        setTask('')
        setTaskGuide({ prompt, result })
        return
      }
      setTask('')
      setRecommendation(`已选择「${result.title}」，正在独立会话中运行。`)
      props.actions.navigate('conversations')
    }, (error: unknown) => {
      setRecommendation(undefined)
      setSubmitError(error instanceof Error ? error.message : String(error))
    }).finally(() => { setTaskBusy(undefined) })
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const answer = task.trim()
    if (answer === '' || taskBusy !== undefined) return
    if (taskGuide?.result.kind === 'clarification') {
      resolveTask(`${taskGuide.prompt}\n\nAI 追问：${taskGuide.result.question}\n用户回答：${answer}`)
      return
    }
    resolveTask(answer)
  }
  const answerClarification = (answer: string): void => {
    if (taskGuide?.result.kind !== 'clarification' || taskBusy !== undefined) return
    resolveTask(`${taskGuide.prompt}\n\nAI 追问：${taskGuide.result.question}\n用户回答：${answer}`)
  }
  const resetTaskGuide = (): void => {
    if (taskBusy !== undefined) return
    setTask('')
    setTaskGuide(undefined)
    setRecommendation(undefined)
    setSubmitError(undefined)
  }
  const createSkillForTask = (): void => {
    if (taskGuide === undefined || taskBusy !== undefined) return
    setSubmitError(undefined)
    setTaskBusy('authoring')
    setRecommendation('正在打开 技能 创作助手…')
    void props.startAuthoringSession('skill', taskGuide.prompt).then(() => {
      setTask('')
      setTaskGuide(undefined)
    }, (error: unknown) => {
      setRecommendation(undefined)
      setSubmitError(error instanceof Error ? error.message : String(error))
    }).finally(() => { setTaskBusy(undefined) })
  }
  const checkApplicationUpdate = () => {
    lastAutoUpdateCheck.current = Date.now()
    setApplicationUpdateError(undefined)
    void props.applicationUpdateCheck({ source: applicationUpdateSource }).then((result) => {
      setApplicationUpdate(result.status)
      refreshApplicationUpdate()
    }, (error: unknown) => {
      setApplicationUpdateError(error instanceof Error ? error.message : String(error))
    })
  }
  const startApplicationUpdate = () => {
    const version = applicationUpdate.candidateVersion ?? applicationUpdate.candidateCommit?.slice(0, 7)
    const source = applicationUpdateSourceLabel(applicationUpdate.source)
    const confirmed = window.confirm(
      `将从 ${source} 下载并验证 QuantSkills${version === undefined ? '' : ` ${version}`}，准备完成后在下次正常启动时生效。仅更新应用程序和内置推荐模板，不覆盖自建技能、专家、专家团、会话与配置。是否继续？`,
    )
    if (!confirmed) return
    setApplicationUpdateError(undefined)
    void props.applicationUpdateStart().then((result) => {
      setApplicationUpdate(result.status)
      refreshApplicationUpdate()
    }, (error: unknown) => {
      setApplicationUpdateError(error instanceof Error ? error.message : String(error))
    })
  }
  const applicationUpdateBusy = applicationUpdate.state === 'checking' || applicationUpdate.state === 'preparing'
  const applicationUpdateSourceLocked = applicationUpdateBusy
  const applicationUpdateMessage = describeApplicationUpdate(applicationUpdate)
  return (
    <div className={css.pageScroll}>
      <PageHeader
        title="QuantSkills"
        subtitle="让专业技能成为你的 AI 研究能力"
        action={<div className={css.pageHeaderActions}>
          <div className={css.applicationUpdateControl}>
            <button type="button" className={`${css.outlineButton} ${applicationUpdate.state === 'available' ? css.applicationUpdateAvailable : applicationUpdate.state === 'ready' ? css.applicationUpdateReady : ''}`} data-update-state={applicationUpdate.state} aria-busy={applicationUpdateBusy} disabled={applicationUpdateBusy} onClick={applicationUpdate.state === 'available' ? startApplicationUpdate : checkApplicationUpdate}>
              <ArrowClockwise className={applicationUpdateBusy ? css.spinningIcon : undefined}/>
              {applicationUpdate.state === 'checking' ? '正在检查…' : applicationUpdate.state === 'preparing' ? '正在准备更新…' : applicationUpdate.state === 'available' ? '下载并更新' : applicationUpdate.state === 'ready' ? '更新已就绪' : '检查更新'}
            </button>
            <Menu
              open={applicationUpdateSourceOpen}
              portal
              align="end"
              className={css.applicationUpdateSourceMenu ?? ''}
              items={([
                {
                  id: 'github',
                  label: <span className={css.applicationUpdateSourceMenuLabel}><b>GitHub</b><small>国外 · 官方项目仓库</small></span>,
                },
                {
                  id: 'gitee',
                  label: <span className={css.applicationUpdateSourceMenuLabel}><b>Gitee</b><small>国内 · 官方镜像仓库</small></span>,
                },
              ] satisfies readonly MenuItem[])}
              onClose={() => { setApplicationUpdateSourceOpen(false) }}
              onSelect={(id) => {
                if (id !== 'github' && id !== 'gitee') return
                setApplicationUpdateSource(id)
                setApplicationUpdate({ state: 'idle' })
                setApplicationUpdateError(undefined)
                setApplicationUpdateSourceOpen(false)
              }}
              anchor={<button
                type="button"
                className={css.applicationUpdateSourceButton}
                aria-label={`更新来源：${applicationUpdateSourceLabel(applicationUpdateSource)}`}
                aria-haspopup="menu"
                aria-expanded={applicationUpdateSourceOpen}
                disabled={applicationUpdateSourceLocked}
                onClick={() => { setApplicationUpdateSourceOpen(value => !value) }}
              ><Globe size={16}/><span>{applicationUpdateSourceLabel(applicationUpdateSource)}</span><CaretDown size={13}/></button>}
            />
          </div>
          <button type="button" className={css.outlineButton} onClick={() => { props.actions.navigate('parallel') }}><ChatsCircle />活动会话 {attentionCount}<CaretRight /></button>
        </div>}
      />
      {(applicationUpdate.state === 'available' || applicationUpdate.state === 'ready') && <section className={css.applicationReleaseNotes} aria-label="版本更新内容">
        <div><strong>{applicationUpdate.state === 'ready' ? '更新已准备好' : '发现新版本'} · {applicationUpdate.candidateVersion}</strong><small>{applicationUpdate.currentVersion ?? '当前版本'} → {applicationUpdate.candidateVersion} · {applicationUpdate.candidateCommit?.slice(0, 7)}</small></div>
        {applicationUpdate.releaseNotes?.length ? <ul>{applicationUpdate.releaseNotes.map((note, index) => <li key={index}>{note}</li>)}</ul> : <p>此版本未提供摘要，可在官方仓库查看变更。</p>}
        <p>更新范围：应用程序、界面和内置推荐模板。保留自建技能、专家、专家团、会话、数据库与模型配置；不会自动导入或覆盖个人资产库。</p>
        <a href={`https://${applicationUpdate.source === 'gitee' ? 'gitee.com' : 'github.com'}/quantskills/QuantStudio/commit/${applicationUpdate.candidateCommit}`} target="_blank" rel="noopener noreferrer">查看完整变更 ↗</a>
      </section>}
      {applicationUpdateMessage && <p className={css.repositoryUpdateMessage} role="status">{applicationUpdateMessage}</p>}
      {(applicationUpdate.state === 'failed' || applicationUpdateError !== undefined) && <p className={css.repositoryUpdateError} role="alert">{applicationUpdateError ?? '更新准备失败，当前版本仍可正常使用；请检查网络后重新点击“检查更新”。'}</p>}
      <div className={css.homeGrid}>
        <div className={css.homeMain}>
          <section>
            <h2>今天想让 AI 做什么量化研究？</h2>
            <form className={css.heroComposer} onSubmit={submit}>
              <input
                aria-label="量化研究任务"
                value={task}
                disabled={taskBusy !== undefined}
                onChange={(event) => {
                  setTask(event.target.value)
                  if (taskGuide?.result.kind !== 'clarification') setTaskGuide(undefined)
                }}
                placeholder={taskGuide?.result.kind === 'clarification'
                  ? taskGuide.result.question
                  : '描述需求，AI 会追问并推荐合适的技能…'}
              />
              <button type="submit" aria-label="查找或创建 技能" disabled={taskBusy !== undefined}>
                <PaperPlaneTilt size={22} weight="fill" />
              </button>
            </form>
            {recommendation && <p className={css.notice} role="status">{recommendation}</p>}
            {taskGuide && <div className={css.taskSuggestion} role="region" aria-label="AI 技能 导购">
              {taskGuide.result.kind === 'clarification' && <>
                <div>
                  <b>帮我再确认一点</b>
                  <p>{taskGuide.result.message}</p>
                  <p className={css.taskQuestion}>{taskGuide.result.question}</p>
                </div>
                <div className={css.creationActions}>
                  {taskGuide.result.options.map(option => <button
                    type="button"
                    className={css.outlineButton}
                    disabled={taskBusy !== undefined}
                    key={option}
                    onClick={() => { answerClarification(option) }}
                  >{option}</button>)}
                  <button type="button" className={css.textButton} onClick={resetTaskGuide}>重新描述</button>
                </div>
              </>}
              {taskGuide.result.kind === 'recommendations' && <>
                <div>
                  <b>我为你找到了 {taskGuide.result.suggestions.length} 个选择</b>
                  <p>{taskGuide.result.message}</p>
                  <div className={css.taskCandidates}>
                    {taskGuide.result.suggestions.map(suggestion => <article className={css.taskCandidate} key={suggestion.asset}>
                      <span><b>{suggestion.title}</b><small>{suggestion.reason}</small></span>
                      <button
                        type="button"
                        className={css.outlineButton}
                        disabled={taskBusy !== undefined}
                        onClick={() => { resolveTask(taskGuide.prompt, suggestion.asset) }}
                      >使用这个 技能</button>
                    </article>)}
                  </div>
                </div>
                <div className={css.creationActions}>
                  <button type="button" className={css.textButton} onClick={resetTaskGuide}>重新描述</button>
                  <button type="button" className={css.primaryButton} disabled={taskBusy !== undefined} onClick={createSkillForTask}><MagicWand/>都不合适，AI 创建</button>
                </div>
              </>}
              {taskGuide.result.kind === 'creation' && <>
                <div>
                  <b>这个需求更适合创建新 技能</b>
                  <p>{taskGuide.result.message}</p>
                </div>
                <div className={css.creationActions}>
                  <button type="button" className={css.textButton} onClick={resetTaskGuide}>重新描述</button>
                  <button type="button" className={css.primaryButton} disabled={taskBusy !== undefined} onClick={createSkillForTask}><MagicWand/>AI 创建 技能</button>
                </div>
              </>}
            </div>}
            {submitError && <p className={css.error} role="alert">{submitError}</p>}
          </section>
          <CatalogMetrics
            phase={props.catalog.phase}
            error={props.catalog.catalogError}
            assets={props.catalog.assets}
            categories={props.catalog.categories}
            selectedCategory={featuredCategory}
            onSelect={setFeaturedCategory}
            onRefresh={props.refreshCatalog}
          />
          {currentSkillActivity && <section><h2>最近会话</h2><button type="button" className={css.continueCard} onClick={() => { props.openSession(currentSkillActivity.sessionId); props.actions.navigate('conversations') }}><SkillMark /><span><b>{currentSkillActivity.title ?? assetTitle(props.catalog, currentSkillActivity.binding.assetId)}</b><small>{assetTitle(props.catalog, currentSkillActivity.binding.assetId)} · 技能</small></span><span className={css.progressMeta}><b>技能 独立会话</b><small>{currentSkillActivity.running ? 'AI 正在处理' : '上下文已保存，可继续'}</small></span><span className={css.linkText}>继续 <CaretRight /></span></button></section>}
          {currentSkillActivity === undefined && currentAgentActivity && <section><h2>最近会话</h2><button type="button" className={css.continueCard} onClick={() => { props.openSession(currentAgentActivity.sessionId); props.actions.navigate('conversations') }}><CapabilityIcon kind="agent"/><span><b>{currentAgentActivity.title ?? currentAgentActivity.agent.name}</b><small>{currentAgentActivity.agent.name}</small></span><span className={css.progressMeta}><b>专家 独立会话</b><small>{currentAgentActivity.running ? 'AI 正在处理' : '上下文已保存，可继续'}</small></span><span className={css.linkText}>继续 <CaretRight /></span></button></section>}
          <section>
            <h2>常用技能</h2>
            {frequent.length === 0
              ? <p className={css.emptyInline}>还没有常用 技能。创建并使用独立会话后，Host 会在这里汇总。</p>
              : <div className={css.frequentRow}>{frequent.map(({ entry, asset, recent }, index) => <article
                className={css.frequentCard}
                key={entry.assetId}
              >
                <button type="button" className={css.frequentMain} onClick={() => { props.openSession(entry.recentSessionId); props.actions.navigate('conversations') }}>
                  <SkillMark tone={['blue', 'orange', 'green', 'purple'][index % 4] ?? 'blue'} small/>
                  <span><b>{asset?.title ?? entry.assetId}</b><small>{entry.sessionCount} 个存档 · 继续最近会话</small></span>
                  <CaretRight />
                </button>
                <button
                  type="button"
                  className={css.frequentNew}
                  aria-label={`为 ${asset?.title ?? entry.assetId} 新建会话`}
                  disabled={recent === undefined}
                  onClick={() => {
                    if (recent === undefined) return
                    void props.startBoundSession(recent.binding, asset?.title ?? entry.assetId)
                  }}
                ><Plus/></button>
              </article>)}</div>}
          </section>
          <RankingTable
            catalog={props.catalog}
            selectedCategory={featuredCategory}
            onCategory={setFeaturedCategory}
            onInstall={(asset) => {
              setFeaturedActionError(undefined)
              void props.installAsset(asset).catch((error: unknown) => {
                setFeaturedActionError(error instanceof Error ? error.message : String(error))
              })
            }}
            onStart={(asset, version) => {
              setFeaturedActionError(undefined)
              void props.startSkillSession(asset, version).catch((error: unknown) => {
                setFeaturedActionError(error instanceof Error ? error.message : String(error))
              })
            }}
            onInstallAgent={(asset) => {
              setFeaturedActionError(undefined)
              void props.installAgent(asset).then(() => {
                props.actions.setAgentWorkspaceTab('mine')
                props.actions.navigate('agents')
              }, (error: unknown) => {
                setFeaturedActionError(error instanceof Error ? error.message : String(error))
              })
            }}
            onOpenAll={() => {
              const selectedAssets = featuredCategory === 'all'
                ? props.catalog.assets
                : props.catalog.assets.filter(asset => asset.category === featuredCategory)
              const hasSkill = selectedAssets.some(asset => asset.projectType === 'skill')
              const hasAgent = selectedAssets.some(asset => asset.projectType === 'agent')
              if (!hasSkill && hasAgent) {
                props.actions.setAgentCategory(featuredCategory)
                props.actions.setAgentWorkspaceTab('market')
                props.actions.navigate('agents')
                return
              }
              props.actions.setCategory(featuredCategory)
              props.actions.navigate('skills')
            }}
          />
          {(featuredActionError ?? props.catalog.operationError) && <p className={css.error} role="alert">{featuredActionError ?? props.catalog.operationError}</p>}
        </div>
        <QuantSkillsBrandSupportPanel/>
      </div>
    </div>
  )
}

function CatalogMetrics({ phase, error, assets, categories, selectedCategory, onSelect, onRefresh }: {
  phase: QuantSkillsCatalogSnapshot['phase']
  error: string | undefined
  assets: readonly QuantSkillsAsset[]
  categories: QuantSkillsCatalogSnapshot['categories']
  selectedCategory: string
  onSelect: (category: string) => void
  onRefresh: () => Promise<void>
}) {
  const unavailable = assets.length === 0 && phase !== 'ready'
  const skillCount = assets.filter(asset => asset.projectType === 'skill').length
  const agentCount = assets.length - skillCount
  return <section className={css.catalogMetrics} aria-labelledby="catalog-metrics-title">
    <button
      type="button"
      className={css.catalogMetricTotal}
      aria-pressed={selectedCategory === 'all'}
      onClick={() => {
        if (phase === 'error') void onRefresh()
        else onSelect('all')
      }}
    >
      <span><small id="catalog-metrics-title">QS 官方公开库</small><b>{unavailable ? '—' : assets.length}</b><em>{phase === 'loading' ? '正在连接宿主' : phase === 'error' ? '目录暂不可用' : '个公开项目'}</em></span>
      <span>{unavailable ? (error ?? '正在读取已验证目录') : `${String(skillCount)} 个 技能 · ${String(agentCount)} 个 专家`}</span>
    </button>
    <div className={css.catalogMetricCategories} role="group" aria-label="各分类公开项目数量">
      {categories.map((category) => {
        const categoryAssets = assets.filter(asset => asset.category === category.id)
        return <button
          type="button"
          key={category.id}
          aria-pressed={selectedCategory === category.id}
          onClick={() => { onSelect(category.id) }}
        >
          <span>{category.label}</span>
          <span className={css.catalogMetricCount}>
            <b>{categoryAssets.length}</b>
          </span>
        </button>
      })}
    </div>
  </section>
}

function RankingTable({
  catalog, selectedCategory, onCategory, onInstall, onStart, onInstallAgent, onOpenAll,
}: {
  catalog: QuantSkillsCatalogSnapshot
  selectedCategory: string
  onCategory: (category: string) => void
  onInstall: (asset: QuantSkillsAsset) => void
  onStart: (asset: QuantSkillsAsset, version: QuantSkillsInstalledVersion) => void
  onInstallAgent: (asset: QuantSkillsAsset) => void
  onOpenAll: () => void
}) {
  const categories = catalog.categories
  const categoryLabel = new Map(categories.map(category => [category.id, category.label]))
  const featured = selectedCategory === 'all'
    ? catalog.assets
    : catalog.assets.filter(asset => asset.category === selectedCategory)
  const selectedLabel = selectedCategory === 'all' ? '全部分类' : categoryLabel.get(selectedCategory) ?? selectedCategory
  const featuredSkillCount = featured.filter(asset => asset.projectType === 'skill').length
  const featuredAgentCount = featured.length - featuredSkillCount
  const targetLabel = featuredSkillCount === 0 && featuredAgentCount > 0 ? '专家' : '技能'
  return <section>
    <div className={css.catalogHeading}>
      <h2>目录精选 <small>{selectedLabel}</small></h2>
      <div className={css.segmented}>
        <button type="button" className={selectedCategory === 'all' ? css.selected : undefined} onClick={() => { onCategory('all') }}>全部</button>
        {categories.map(category => <button type="button" className={selectedCategory === category.id ? css.selected : undefined} key={category.id} onClick={() => { onCategory(category.id) }}>{category.label}</button>)}
      </div>
    </div>
    <div className={css.table}>
      <div className={css.tableHead}><span>#</span><span>名称</span><span>分类</span><span>状态</span><span>提交</span><span>操作</span></div>
      {featured.slice(0, 3).map((asset, index) => {
        const installed = currentInstalledVersion(catalog, asset)
        const installing = catalog.installing.has(asset.name)
        const updateAvailable = installed === undefined && (catalog.versionsByAsset[asset.name]?.length ?? 0) > 0
        const canStart = installed !== undefined && catalog.installedPhase === 'ready'
        const canInstall = catalog.phase === 'ready' && !installing
        const skillAction = installed ? '使用' : updateAvailable ? '更新' : '安装'
        const action = asset.projectType === 'agent'
          ? installed === undefined ? '安装并创建' : '创建副本'
          : skillAction
        const disabledReason = asset.projectType === 'skill' && installed && catalog.installedPhase !== 'ready'
          ? '宿主已安装版本投影不可用或已过期'
          : catalog.phase !== 'ready'
            ? '宿主目录不可用或已过期'
            : undefined
        const actionDisabled = asset.projectType === 'agent' ? !canInstall : installed ? !canStart : !canInstall
        return <div className={css.tableRow} key={asset.name}>
          <span className={css.rank}>{index + 1}</span>
          <span className={css.nameCell}>{asset.projectType === 'skill'
            ? <SkillMark tone={['blue', 'orange', 'green'][index] ?? 'blue'} small/>
            : <CapabilityIcon kind="agent"/>}
          <span><b>{asset.title}</b><small className={css.technicalId}>{asset.name}</small><small className={css.catalogSummary}>{asset.summary}</small></span></span>
          <span><mark>{categoryLabel.get(asset.category) ?? asset.category}</mark></span>
          <span title={asset.health}>{asset.projectType === 'skill' ? '技能' : '专家'} · {asset.health === 'frozen-declaration-only' ? '固定版本' : asset.health === 'healthy' ? '正常' : '待检查'}</span>
          <span>{asset.commitSha.slice(0, 7)}</span>
          <span className={css.tableAction}>
            <button
              type="button"
              className={installed ? css.primaryButton : css.outlineButton}
              aria-label={`${installing ? '安装中' : action} ${asset.title}`}
              disabled={actionDisabled}
              title={disabledReason}
              onClick={() => {
                if (asset.projectType === 'agent') onInstallAgent(asset)
                else if (installed) onStart(asset, installed)
                else onInstall(asset)
              }}
            >{installing ? '安装中' : installed ? action : catalog.phase === 'ready' ? action : '宿主不可用'}</button>
          </span>
        </div>
      })}
    </div>
    {featured.length === 0 && <p className={css.emptyInline}>这个分类暂时没有公开项目。</p>}
    <button type="button" className={css.centerLink} onClick={onOpenAll}>查看{selectedCategory === 'all' ? '全部' : `“${selectedLabel}”`}{targetLabel} <CaretRight /></button>
  </section>
}

function SkillsPage(props: PageProps) {
  const [manualEditor, setManualEditor] = useState<{ source?: ManualSkillSource }>()
  const [uninstallTarget, setUninstallTarget] = useState<QuantSkillsAsset>()
  const [uninstallBusy, setUninstallBusy] = useState(false)
  const [uninstallError, setUninstallError] = useState<string>()
  const displayNameOverrides = props.useStore(state => state.assetDisplayNameOverrides)
  const [librarySource, setLibrarySource] = useState<CapabilityLibrarySource>(() => {
    try {
      const saved = localStorage.getItem('quantskills.skillLibrarySource')
      if (saved === 'installed' || saved === 'discover' || saved === 'unknown') return saved
    } catch { /* Storage is optional. */ }
    return 'mine'
  })
  const libraryAssets = useMemo(() => skillLibraryAssets(props.catalog, librarySource).map(asset => {
    const override = displayNameOverrides.find(entry => entry.assetId === asset.name)
    return override ? { ...asset, title: override.displayName } : asset
  }), [props.catalog, librarySource, displayNameOverrides])
  const libraryPhase = librarySource === 'discover' ? props.catalog.phase : props.catalog.installedPhase
  const changeLibrarySource = (source: CapabilityLibrarySource): void => {
    setLibrarySource(source)
    props.actions.setCategory('all')
    props.actions.closeSkillDrawer()
    try { localStorage.setItem('quantskills.skillLibrarySource', source) } catch { /* Storage is optional. */ }
  }
  const search = props.useStore(state => state.search)
  const selectedCategory = props.useStore(state => state.selectedCategory)
  const selectedSkill = props.useStore(state => state.selectedSkill)
  const drawerOpen = props.useStore(state => state.skillDrawerOpen)
  const view = props.useStore(state => state.catalogView)
  const sort = props.useStore(state => state.catalogSort)
  const favoriteAssetIds = props.useStore(state => state.favoriteAssetIds)
  const autoCheckCatalog = props.useStore(state => state.autoCheckCatalog)
  const settingsWritable = props.useStore(state => state.settingsWritable)
  const [actionError, setActionError] = useState<string>()
  const drawerTriggerRef = useRef<HTMLButtonElement | null>(null)
  const closeDrawer = useCallback(() => { props.actions.closeSkillDrawer() }, [props.actions])
  const drawer = useDrawerBehavior(drawerOpen, closeDrawer, drawerTriggerRef, false)
  const skillCategories = useMemo(() => props.catalog.categories.filter(category =>
    libraryAssets.some(asset => asset.projectType === 'skill' && asset.category === category.id)), [
    libraryAssets,
    props.catalog.categories,
  ])
  useEffect(() => {
    if (selectedCategory !== 'all' && !skillCategories.some(category => category.id === selectedCategory)) {
      props.actions.setCategory('all')
    }
  }, [props.actions, selectedCategory, skillCategories])
  const skills = useMemo(() => {
    const filtered = libraryAssets.filter(asset => asset.projectType === 'skill'
      && (selectedCategory === 'all' || asset.category === selectedCategory)
      && assetSearchText(asset).includes(search.trim().toLocaleLowerCase()))
    if (sort === 'recommended') return filtered
    return [...filtered].sort((left, right) => sort === 'name'
      ? left.title.localeCompare(right.title, 'zh-CN')
      : left.category.localeCompare(right.category) || left.title.localeCompare(right.title, 'zh-CN'))
  }, [libraryAssets, search, selectedCategory, sort])
  const selected = libraryAssets.find(asset => asset.name === selectedSkill) ?? skills[0]
  const install = (asset: QuantSkillsAsset): void => {
    setActionError(undefined)
    void props.installAsset(asset).catch((error: unknown) => {
      setActionError(error instanceof Error ? error.message : String(error))
    })
  }
  const start = (asset: QuantSkillsAsset, version: QuantSkillsInstalledVersion): void => {
    setActionError(undefined)
    void props.startSkillSession(asset, version).catch((error: unknown) => {
      setActionError(error instanceof Error ? error.message : String(error))
    })
  }
  const catalogStatus = libraryPhase === 'loading'
    ? '正在连接宿主目录'
    : libraryPhase === 'stale'
      ? '宿主目录已过期'
      : libraryPhase === 'error'
        ? '宿主目录不可用'
        : `${skills.length} 个技能`
  if (manualEditor && props.manualSkillSave) return <div className={css.capabilityPage}><ManualSkillEditor
    source={manualEditor.source} save={props.manualSkillSave} onClose={() => setManualEditor(undefined)}
    onSaved={assetId => { setManualEditor(undefined); changeLibrarySource('mine'); props.actions.setSearch(''); props.actions.selectSkill(assetId) }}
  /></div>
  return (
    <div className={css.capabilityPage}>
      {uninstallTarget && <ActionDialog title="卸载技能" busy={uninstallBusy} error={uninstallError} onClose={() => setUninstallTarget(undefined)}>
        <p>卸载「{uninstallTarget.title}」后，它将从已安装列表和可加载技能中移除。已有会话与专家引用的版本会保留，之后可重新安装。</p>
        <footer><button type="button" disabled={uninstallBusy} onClick={() => setUninstallTarget(undefined)}>取消</button>
          <button type="button" data-danger disabled={uninstallBusy} onClick={() => {
            setUninstallBusy(true); setUninstallError(undefined)
            void props.uninstallAsset!(uninstallTarget.name).then(() => { setUninstallTarget(undefined); props.actions.closeSkillDrawer() }, error => {
              setUninstallError(error instanceof Error ? error.message : '卸载失败，请重试。')
            }).finally(() => setUninstallBusy(false))
          }}>{uninstallBusy ? '正在卸载…' : '确认卸载'}</button></footer>
      </ActionDialog>}
      {actionError && <p className={css.error} role="alert">{actionError}</p>}
      {props.catalog.operationError && <p className={css.error} role="alert">{props.catalog.operationError}</p>}
      <div className={css.pageScroll} hidden={drawerOpen && selected !== undefined}>
        <div className={css.catalogHeader}>
          <PageHeader title="技能" action={<div className={css.creationActions}><button type="button" className={css.outlineButton} disabled={!props.manualSkillSave} onClick={() => setManualEditor({})}>手动创建</button><button type="button" className={css.primaryButton} onClick={() => {
            void props.startAuthoringSession('skill').catch((error: unknown) => {
              setActionError(error instanceof Error ? error.message : '无法开始技能创作')
            })
          }}><Plus/>AI 创建技能</button></div>} />
          <label className={css.searchBox}><MagnifyingGlass/><input value={search} onChange={(event) => { props.actions.setSearch(event.target.value) }} placeholder="搜索 技能、策略或数据源" /></label>
        </div>
        <div className={css.agentTabs} aria-label="技能来源">
          {([['mine', '我的创建'], ['installed', '已安装'], ['discover', '发现']] as const).map(([source, label]) =>
            <button key={source} type="button" aria-pressed={librarySource === source} className={librarySource === source ? css.selected : undefined} onClick={() => { changeLibrarySource(source) }}>{label}</button>)}
          {skillLibraryAssets(props.catalog, 'unknown').length > 0 && <button type="button" aria-pressed={librarySource === 'unknown'} onClick={() => { changeLibrarySource('unknown') }}>历史内容 · 来源待确认</button>}
        </div>
        <div className={css.categoryTabs}><button type="button" className={selectedCategory === 'all' ? css.selected : undefined} onClick={() => { props.actions.setCategory('all') }}>全部</button>{skillCategories.map(category => <button type="button" key={category.id} className={selectedCategory === category.id ? css.selected : undefined} onClick={() => { props.actions.setCategory(category.id) }}>{category.label}</button>)}</div>
        <div className={css.catalogTools}><span>{catalogStatus}</span><button type="button" onClick={() => { void props.refreshCatalog() }}>刷新目录</button><div className={css.viewToggle}><button aria-label="列表视图" className={view === 'list' ? css.selected : undefined} onClick={() => { props.actions.setCatalogView('list') }}><List /></button><button aria-label="卡片视图" className={view === 'grid' ? css.selected : undefined} onClick={() => { props.actions.setCatalogView('grid') }}><GridFour /></button></div><label className={css.catalogSort}><select aria-label="技能 排序" value={sort} onChange={(event) => { props.actions.setCatalogSort(event.target.value as typeof sort) }}><option value="recommended">综合排序</option><option value="name">名称排序</option><option value="category">分类排序</option></select><CaretDown/></label></div>
        {props.catalog.catalogError && <p className={css.notice} role="status">{props.catalog.catalogError}</p>}
        {props.catalog.installedError && <p className={css.notice} role="status">{props.catalog.installedError}</p>}
        <div className={clsx(css.skillCatalog, view === 'grid' && css.skillGrid)}>
          {skills.map((asset, index) => <SkillRow
            key={asset.name}
            asset={asset}
            tone={['blue', 'orange', 'green', 'purple'][index % 4] ?? 'blue'}
            catalog={props.catalog}
            favorite={favoriteAssetIds.includes(asset.name)}
            selected={asset.name === selected?.name && drawerOpen}
            drawerId={drawer.panelId}
            onSelect={(trigger) => {
              drawerTriggerRef.current = trigger
              props.actions.selectSkill(asset.name)
            }}
            onInstall={() => { install(asset) }}
            onUninstall={librarySource === 'installed' && props.uninstallAsset ? () => { setUninstallError(undefined); setUninstallTarget(asset) } : undefined}
            onStart={(version) => { start(asset, version) }}
            onFavorite={() => {
              props.actions.setFavoriteAssetIds(favoriteAssetIds.includes(asset.name)
                ? favoriteAssetIds.filter(id => id !== asset.name)
                : [...favoriteAssetIds, asset.name])
            }}
          />)}
          {skills.length === 0 && <div className={css.emptyState}><MagnifyingGlass size={30}/><h2>{libraryPhase === 'loading' ? '正在读取技能' : libraryPhase === 'error' || libraryPhase === 'stale' ? '技能读取失败，请重试' : search.trim() || selectedCategory !== 'all' ? '没有匹配的技能' : librarySource === 'mine' ? '还没有创建技能' : librarySource === 'installed' ? '还没有安装技能' : '暂无技能'}</h2>{libraryPhase === 'ready' && <button onClick={() => { props.actions.setSearch(''); props.actions.setCategory('all') }}>清除筛选</button>}</div>}
        </div>
      </div>
      {drawerOpen && selected && <SkillDetails
        asset={selected}
        catalog={props.catalog}
        favorite={favoriteAssetIds.includes(selected.name)}
        autoCheckCatalog={autoCheckCatalog}
        settingsWritable={settingsWritable}
        customDisplayName={displayNameOverrides.find(entry => entry.assetId === selected.name)?.displayName}
        archives={props.boundSessions.archives.filter(archive => archive.binding.assetId === selected.name)}
        drawer={drawer}
        readAssetReadme={props.readAssetReadme}
        onEdit={props.manualSkillSave ? version => setManualEditor({ source: {
          versionId: version.versionId as QuantSkillsInstalledVersionId, name: selected.title, personal: version.origin === 'local-authoring',
          read: signal => props.readSkillDeclaration(version.versionId, signal),
        } }) : undefined}
        onInstall={() => { install(selected) }}
        onStart={(version) => { start(selected, version) }}
        onFavorite={() => {
          props.actions.setFavoriteAssetIds(favoriteAssetIds.includes(selected.name)
            ? favoriteAssetIds.filter(id => id !== selected.name)
            : [...favoriteAssetIds, selected.name])
        }}
        onAutoCheckCatalog={(enabled) => { props.actions.setAutoCheckCatalog(enabled) }}
        onDisplayNameOverride={(displayName) => {
          const remaining = displayNameOverrides.filter(entry => entry.assetId !== selected.name)
          props.actions.setAssetDisplayNameOverrides(displayName === undefined
            ? remaining
            : [...remaining, { assetId: selected.name, displayName }])
        }}
        onOpen={(sessionId) => {
          props.openSession(sessionId)
          props.actions.navigate('conversations')
        }}
      />}
    </div>
  )
}

function SkillRow({ asset, catalog, selected, favorite, tone, drawerId, onSelect, onInstall, onStart, onFavorite, onArrange, onUninstall }: {
  asset: QuantSkillsAsset
  catalog: QuantSkillsCatalogSnapshot
  selected: boolean
  favorite: boolean
  tone: string
  drawerId: string
  onSelect: (trigger: HTMLButtonElement) => void
  onInstall: () => void
  onUninstall?: (() => void) | undefined
  onStart: (version: QuantSkillsInstalledVersion) => void
  onFavorite: () => void
  onArrange?: ((version: QuantSkillsInstalledVersion) => void) | undefined
}) {
  const installed = currentInstalledVersion(catalog, asset)
  const installing = catalog.installing.has(asset.name)
  const otherVersion = (catalog.versionsByAsset[asset.name]?.length ?? 0) > 0
  const updateAvailable = installed === undefined && otherVersion
  const canStart = installed !== undefined && catalog.installedPhase === 'ready'
  const canInstall = catalog.phase === 'ready' && !installing
  const status = installing
    ? '正在安装'
    : installed
      ? '已安装当前版本'
      : updateAvailable
        ? '有更新 · 已有会话不变'
        : '未安装'
  const disabledReason = installed && catalog.installedPhase !== 'ready'
    ? '宿主已安装版本投影不可用或已过期'
    : !installed && catalog.phase !== 'ready'
      ? '宿主目录不可用或已过期'
      : undefined
  return <article className={clsx(css.skillRow, selected && css.skillRowSelected)}>
    <button
      type="button"
      className={css.skillDetailButton}
      aria-label={`查看 ${asset.title} 详情`}
      aria-expanded={selected}
      aria-controls={selected ? drawerId : undefined}
      onClick={(event) => { onSelect(event.currentTarget) }}
    >
      <SkillMark tone={tone}/>
      <span className={css.skillIdentity}>
        <b>{asset.title}</b>
        <small className={css.technicalId}>{asset.name}</small>
        <small>{asset.summary || '标准 QuantSkills 能力'}</small>
      </span>
    </button>
    <span className={css.maintainer}>{installed?.origin === 'local-authoring' ? '我的创建' : asset.url ? 'QUANTSKILLS' : '历史内容'}</span>
    <span className={css.tags}><mark>{asset.category || '研究'}</mark><mark>{asset.declarationFile}</mark></span>
    <span className={css.installStatus}>
      {installed ? <CheckCircle weight="fill"/> : updateAvailable ? <Clock/> : <Circle/>}{status}
    </span>
    <button type="button" className={css.favoriteButton} aria-label={`${favorite ? '取消收藏' : '收藏'} ${asset.title}`} aria-pressed={favorite} onClick={onFavorite}><Star weight={favorite ? 'fill' : 'regular'}/></button>
    <div className={css.capabilityRowActions}>
    <button
      type="button"
      className={css.outlineButton}
      disabled={installed ? !canStart : !canInstall}
      title={disabledReason}
      onClick={() => { if (installed) onStart(installed); else onInstall() }}
    >
      {installing
        ? '安装中'
        : installed
          ? '新建会话'
          : catalog.phase === 'ready'
            ? updateAvailable ? `更新到 ${asset.commitSha.slice(0, 7)}` : '安装'
            : '宿主不可用'}
    </button>
    {otherVersion && onUninstall && <button type="button" className={css.uninstallButton} disabled={installing || catalog.installedPhase !== 'ready'} aria-label={`卸载 ${asset.title}`} onClick={onUninstall}><Trash/>卸载</button>}
    {installed && onArrange && <button type="button" className={css.outlineButton} disabled={!canStart} onClick={() => onArrange(installed)}>创建安排</button>}
    </div>
  </article>
}

type DrawerBehavior = ReturnType<typeof useDrawerBehavior>

function SkillDetails({
  asset,
  catalog,
  favorite,
  autoCheckCatalog,
  settingsWritable,
  customDisplayName,
  archives,
  drawer,
  readAssetReadme,
  onInstall,
  onStart,
  onFavorite,
  onAutoCheckCatalog,
  onDisplayNameOverride,
  onOpen,
  onEdit,
}: {
  asset: QuantSkillsAsset
  catalog: QuantSkillsCatalogSnapshot
  favorite: boolean
  autoCheckCatalog: boolean
  settingsWritable: boolean
  customDisplayName: string | undefined
  archives: readonly QuantSkillsSessionArchiveItem[]
  drawer: DrawerBehavior
  readAssetReadme: (asset: QuantSkillsAsset, signal?: AbortSignal) => Promise<QuantSkillsAssetReadme>
  onInstall: () => void
  onStart: (version: QuantSkillsInstalledVersion) => void
  onFavorite: () => void
  onAutoCheckCatalog: (enabled: boolean) => void
  onDisplayNameOverride: (displayName?: string) => void
  onOpen: (sessionId: SessionId) => void
  onEdit?: ((version: QuantSkillsInstalledVersion) => void) | undefined
}) {
  useEffect(() => { drawer.closeButtonRef.current?.focus() }, [drawer.closeButtonRef])
  const [displayNameDraft, setDisplayNameDraft] = useState(customDisplayName ?? '')
  const [readme, setReadme] = useState<
    { readonly phase: 'loading' }
    | { readonly phase: 'ready'; readonly value: QuantSkillsAssetReadme }
    | { readonly phase: 'error'; readonly message: string }
  >({ phase: 'loading' })
  const declaration = readme.phase === 'ready' ? declarationDisplay(readme.value.markdown) : undefined
  useEffect(() => {
    setDisplayNameDraft(customDisplayName ?? '')
  }, [asset.name, customDisplayName])
  useEffect(() => {
    const controller = new AbortController()
    setReadme({ phase: 'loading' })
    void readAssetReadme(asset, controller.signal).then(
      (value) => { if (!controller.signal.aborted) setReadme({ phase: 'ready', value }) },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setReadme({ phase: 'error', message: error instanceof Error ? error.message : String(error) })
        }
      },
    )
    return () => { controller.abort() }
  }, [asset.name, asset.commitSha, readAssetReadme])
  const installed = currentInstalledVersion(catalog, asset)
  const installing = catalog.installing.has(asset.name)
  const updateAvailable = installed === undefined && (catalog.versionsByAsset[asset.name]?.length ?? 0) > 0
  const canStart = installed !== undefined && catalog.installedPhase === 'ready'
  const canInstall = catalog.phase === 'ready' && !installing
  const disabledReason = installed && catalog.installedPhase !== 'ready'
    ? '宿主已安装版本投影不可用或已过期'
    : catalog.phase !== 'ready'
      ? '宿主目录不可用或已过期'
      : undefined
  return <aside
    id={drawer.panelId}
    className={css.capabilityDetails}
    role="region"
    aria-labelledby={drawer.labelId}
  >
    <header>
      <button ref={drawer.closeButtonRef} aria-label="关闭 技能 详情" onClick={drawer.close}>← 返回技能库</button>
    </header>
    <div className={css.drawerTitle}>
      <SkillMark/><span><h2 id={drawer.labelId}>{asset.title}</h2><small className={css.technicalId}>{asset.name}</small></span>
      <button type="button" className={css.favoriteButton} aria-label={`${favorite ? '取消收藏' : '收藏'} ${asset.title}`} aria-pressed={favorite} onClick={onFavorite}><Star weight={favorite ? 'fill' : 'regular'}/></button>
    </div>
    <form className={css.localNameEditor} onSubmit={(event) => {
      event.preventDefault()
      const next = displayNameDraft.trim()
      if (next !== '') onDisplayNameOverride(next)
    }}>
      <label htmlFor={`local-name-${asset.name}`}>本地显示名称</label>
      <div><input
        id={`local-name-${asset.name}`}
        value={displayNameDraft}
        maxLength={80}
        disabled={!settingsWritable}
        placeholder={asset.catalogTitle}
        onChange={(event) => { setDisplayNameDraft(event.target.value) }}
      /><button type="submit" disabled={!settingsWritable || displayNameDraft.trim() === ''}>保存</button>{customDisplayName !== undefined && <button type="button" disabled={!settingsWritable} onClick={() => { setDisplayNameDraft(''); onDisplayNameOverride() }}>恢复目录名称</button>}</div>
      <small>只改变本机显示；安装、更新、搜索和会话绑定仍使用 {asset.name}。</small>
    </form>
    <div className={css.metaLine}>
      <span>版本 <b>{asset.commitSha.slice(0, 7)}</b></span>
      <span>{installed ? installed.origin === 'local-authoring' ? '我的创建 · 已保存' : installed.origin === 'catalog' ? '公共安装 · 已保存' : '历史内容 · 来源待确认' : '公开目录'}</span>
    </div>
    {installed && onEdit && <button type="button" className={css.outlineButton} disabled={catalog.installedPhase !== 'ready'} onClick={() => onEdit(installed)}>{installed.origin === 'local-authoring' ? '编辑技能' : '另存为我的技能'}</button>}
    <section className={css.skillReadme} aria-label="仓库 README">
      <header className={css.skillReadmeHeader}>
        <div><b>{readme.phase === 'ready' ? readme.value.path : installed ? asset.declarationFile : 'README.md'}</b><small>固定版本 {asset.commitSha.slice(0, 7)}</small></div>
        {asset.url && <a href={`${asset.url}/blob/${asset.commitSha}/${readme.phase === 'ready' ? readme.value.path.split('/').map(encodeURIComponent).join('/') : 'README.md'}`} target="_blank" rel="noreferrer">查看仓库原文 <ArrowSquareOut/></a>}
      </header>
      {readme.phase === 'loading' && <p className={css.skillReadmeStatus}>正在读取固定版本说明…</p>}
      {readme.phase === 'error' && <div className={css.skillReadmeFallback} role="status">
        <b>技能说明暂时无法读取</b>
        <p>{asset.summary || asset.description || '该 技能 暂无可用说明。'}</p>
        {asset.description && !hasChinese(asset.description) && asset.description !== asset.summary && <details><summary>原始说明</summary><p>{asset.description}</p></details>}
        <small>{readme.message}</small>
      </div>}
      {declaration && <div className={css.skillReadmeBody}>
        <MarkdownText text={declaration.body} labels={MARKDOWN_LABELS}/>
        {declaration.metadata && <details><summary>声明元信息</summary><pre>{declaration.metadata}</pre></details>}
      </div>}
    </section>
    {updateAvailable && <p className={css.notice} role="status">
      <Shield/>更新会安装不可变的新版本；已有会话继续使用原版本，新会话才使用 {asset.commitSha.slice(0, 7)}。
    </p>}
    <InfoGroup icon={<Wrench/>} title="适用场景">
      <li>量化研究与证据验证</li><li>独立上下文与多轮追问</li>
    </InfoGroup>
    <InfoGroup icon={<Star/>} title="所需能力">
      <li>标准 {asset.declarationFile}</li><li>{asset.requires.join('、') || '本地工作区'}</li>
    </InfoGroup>
    <InfoGroup icon={<LockKey/>} title="权限"><li>使用会话当前授权；保存技能不会额外授予执行权限。</li></InfoGroup>
    <div className={css.requirements}>
      <h3>运行要求</h3>
      <p><FolderOpen/>运行环境 <span>使用当前工作区与用户环境</span></p>
      <p><Wrench/>Python / PandaData <span>按当前环境使用，缺失时由任务给出修复建议</span></p>
      <p><Globe/>网络 <span>按运行授权</span></p>
    </div>
    <button
      type="button"
      className={css.primaryButton}
      disabled={installed ? !canStart : !canInstall}
      title={disabledReason}
      onClick={() => { if (installed) onStart(installed); else onInstall() }}
    >
      {installing
        ? '正在安装...'
        : installed
          ? '新建独立会话'
          : catalog.phase === 'ready'
            ? updateAvailable ? `更新到 ${asset.commitSha.slice(0, 7)}` : '安装 技能'
            : '宿主不可用'}
      <PaperPlaneTilt weight="fill"/>
    </button>
    <div className={css.archiveList}>
      <h3>会话存档 <mark>{archives.length}</mark></h3>
      {archives.length === 0
        ? <p><ChatsCircle/>还没有该 技能 的会话存档。</p>
        : archives.map(archive => <button
          type="button"
          key={archive.sessionId}
          onClick={() => { onOpen(archive.sessionId) }}
        >
          <ChatsCircle/>
          <span><b>{archive.title ?? '未命名会话'}</b><small>{formatUpdated(archive.updatedAt)}</small></span>
          {archive.running ? <StatusDot status="running"/> : <CaretRight/>}
        </button>)}
    </div>
    <label className={css.toggleRow} title="检查间隔由 QuantSkills Host 配置">
      自动检查目录（{formatRefreshInterval(catalog.refreshAfterMs)}）
      <input type="checkbox" checked={autoCheckCatalog} disabled={!settingsWritable} onChange={(event) => { onAutoCheckCatalog(event.target.checked) }}/><i/>
    </label>
  </aside>
}

function currentInstalledVersion(
  catalog: QuantSkillsCatalogSnapshot,
  asset: QuantSkillsAsset,
): QuantSkillsInstalledVersion | undefined {
  return catalog.versionsByAsset[asset.name]?.find(version => version.commitSha === asset.commitSha
    && version.projectType === asset.projectType
    && version.exposure === (asset.projectType === 'skill' ? 'skill-registry' : 'agent-template'))
}

function assetTitle(catalog: QuantSkillsCatalogSnapshot, assetId: string): string {
  return catalog.assets.find(asset => asset.name === assetId)?.title ?? assetId
}

function assetSearchText(asset: QuantSkillsAsset): string {
  return [
    asset.title,
    asset.catalogTitle,
    asset.englishTitle,
    asset.name,
    ...asset.aliases,
    asset.summary,
    asset.description,
  ].join(' ').toLocaleLowerCase()
}

function formatUpdated(updatedAt: number): string {
  return new Intl.DateTimeFormat(
    'zh-CN',
    { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' },
  ).format(new Date(updatedAt))
}

function InfoGroup({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <section className={css.infoGroup}><h3>{icon}{title}</h3><ul>{children}</ul></section>
}

function ConversationPage(props: PageProps) {
  const [creatingSession, setCreatingSession] = useState(false)
  const [createSessionError, setCreateSessionError] = useState<string>()
  const plainArchives = props.boundSessions.plainArchives
  const skillArchives = props.boundSessions.archives
  const agentArchives = props.agents.archives
  const teamArchives = props.agents.teamArchives
  const rows: readonly ConversationRow[] = [
    ...plainArchives.map(archive => ({ kind: 'plain' as const, archive })),
    ...skillArchives.map(archive => ({ kind: 'skill' as const, archive })),
    ...agentArchives.map(archive => ({ kind: 'agent' as const, archive })),
    ...teamArchives.map(archive => ({ kind: 'team' as const, archive })),
  ].sort((left, right) => right.archive.updatedAt - left.archive.updatedAt)
  const archiveCount = rows.length
  const groups = groupConversationRowsByDate(rows)
  const open = (sessionId: SessionId): void => {
    props.openSession(sessionId)
    props.actions.navigate('conversations')
  }
  const startSession = async (): Promise<void> => {
    if (creatingSession) return
    setCreatingSession(true)
    setCreateSessionError(undefined)
    try {
      await props.startSession()
    } catch (cause: unknown) {
      setCreateSessionError(cause instanceof Error ? cause.message : '创建会话失败，请重试。')
    } finally {
      setCreatingSession(false)
    }
  }
  return <div className={css.pageScroll}>
    <PageHeader
      title="会话"
      subtitle="普通、技能、专家 与 专家团 会话都有独立上下文和真实存档"
      action={<div className={css.creationActions}>
        <button type="button" className={css.primaryButton} disabled={creatingSession} onClick={() => { void startSession() }}>
          <Plus/>{creatingSession ? '正在创建…' : '新建会话'}
        </button>
        <button type="button" className={css.outlineButton} onClick={() => {
          void Promise.all([props.refreshBoundSessions(), props.refreshAgents()])
        }}>刷新</button>
      </div>}
    />
    {props.boundSessions.error && <p className={css.notice} role="status">{props.boundSessions.error}</p>}
    {props.agents.error && <p className={css.notice} role="status">{props.agents.error}</p>}
    {createSessionError && <p className={css.notice} role="alert">{createSessionError}</p>}
    {archiveCount === 0
      ? <div className={css.settingsPlaceholder}>
        <ChatsCircle size={42}/><h2>还没有 QuantSkills 会话</h2>
        <p>普通会话可直接使用；需要 Python 或 PandaData 时，专家会使用当前工作区和用户环境，并在缺失时给出修复建议。</p>
        <button type="button" className={css.primaryButton} disabled={creatingSession} onClick={() => { void startSession() }}>
          <Plus/>{creatingSession ? '正在创建…' : '新建会话'}
        </button>
      </div>
      : <div className={css.archiveGroups}>
        {groups.map(group => <ConversationArchiveGroup
          key={group.key}
          title={group.label}
          rows={group.rows}
          props={props}
          open={open}
        />)}
      </div>}
  </div>
}

function ConversationArchiveGroup({ title, rows, props, open }: {
  title: string
  rows: readonly ConversationRow[]
  props: PageProps
  open: (sessionId: SessionId) => void
}) {
  if (rows.length === 0) return null
  return <section className={css.archiveGroup}>
    <h2>{title}<mark>{rows.length}</mark></h2>
    <div className={css.archiveOverview}>
      {rows.map((row, index) => {
        if (row.kind === 'plain') {
          return <article key={row.archive.sessionId}>
            <button type="button" className={css.archiveMain} onClick={() => { open(row.archive.sessionId) }}>
              <CapabilityIcon kind="agent-team"/>
              <span>
                <b>{row.archive.title ?? '新会话'}</b>
                <small>普通会话 · {formatUpdated(row.archive.updatedAt)}</small>
              </span>
              {row.archive.running ? <StatusDot status="running"/> : <CaretRight/>}
            </button>
            <button type="button" className={css.archiveNew} aria-label="新建普通会话" onClick={() => {
              void props.startSession()
            }}><Plus/></button>
          </article>
        }
        if (row.kind === 'skill') {
          const label = assetTitle(props.catalog, row.archive.binding.assetId)
          return <article key={row.archive.sessionId}>
            <button type="button" className={css.archiveMain} onClick={() => { open(row.archive.sessionId) }}>
              <SkillMark tone={['blue', 'orange', 'green', 'purple'][index % 4] ?? 'blue'}/>
              <span><b>{row.archive.title ?? label}</b><small>{label} · {formatUpdated(row.archive.updatedAt)}</small></span>
              {row.archive.running ? <StatusDot status="running"/> : <CaretRight/>}
            </button>
            <button type="button" className={css.archiveNew} aria-label={`为 ${label} 新建会话`} onClick={() => {
              void props.startBoundSession(row.archive.binding, label)
            }}><Plus/></button>
          </article>
        }
        const definition = row.kind === 'agent'
          ? props.agents.definitions.find(item => item.agentId === row.archive.agent.agentId)
          : props.agents.teams.find(item => item.teamId === row.archive.team.teamId)
        const canStart = props.agents.phase === 'ready' && definition !== undefined
        const ownerName = row.kind === 'agent' ? row.archive.agent.name : row.archive.team.name
        const ownerLabel = row.kind === 'agent' ? '专家' : '专家团'
        return <article key={row.archive.sessionId}>
          <button type="button" className={css.archiveMain} onClick={() => { open(row.archive.sessionId) }}>
            <span className={css.agentMark}>{row.kind === 'agent' ? <CapabilityIcon kind="agent"/> : <ChatsCircle/>}</span>
            <span>
              <b>{row.archive.title ?? ownerName}</b>
              <small>{ownerLabel} · {ownerName} · {formatUpdated(row.archive.updatedAt)}</small>
            </span>
            {row.archive.running ? <StatusDot status="running"/> : <CaretRight/>}
          </button>
          <button
            type="button"
            className={css.archiveNew}
            aria-label={`为${ownerLabel} ${ownerName} 新建会话`}
            disabled={!canStart}
            title={canStart ? undefined : `当前${ownerLabel}定义不可用；旧存档仍可继续`}
            onClick={() => {
              if (definition === undefined) return
              if (row.kind === 'agent' && 'agentId' in definition) void props.startAgentSession(definition)
              else if (row.kind === 'team' && 'teamId' in definition) void props.startAgentTeamSession(definition)
            }}
          ><Plus/></button>
        </article>
      })}
    </div>
  </section>
}

function ParallelPage(props: PageProps) {
  const [filter, setFilter] = useState<'all' | 'running' | 'waiting' | 'failed' | 'cancelled' | 'completed'>('all')
  const [replyDrawerOpen, setReplyDrawerOpen] = useState(false)
  const currentSessionId = props.useSessions(state => state.current)
  const sessionById = props.useSessions(state => state.byId)
  const pendingInteractions = props.useSessionPendingInteraction(state => state)
  const rows = [
    ...props.boundSessions.archives.filter(archive => !archive.archived).map(archive => ({
      kind: 'skill' as const,
      archive,
      state: pendingInteractions.has(archive.sessionId)
        ? 'waiting' as const
        : sessionById[archive.sessionId]?.completed === true
          ? 'completed' as const
          : archive.runState,
    })),
    ...props.agents.archives.filter(archive => !archive.archived).map(archive => ({
      kind: 'agent' as const,
      archive,
      state: pendingInteractions.has(archive.sessionId)
        ? 'waiting' as const
        : sessionById[archive.sessionId]?.completed === true
          ? 'completed' as const
          : archive.runState,
    })),
  ].sort((left, right) => right.archive.updatedAt - left.archive.updatedAt)
  const current = rows.find(row => row.archive.sessionId === currentSessionId)
  const loaded = rows.filter(row => row.state === 'running')
  const waiting = rows.filter(row => row.state === 'waiting')
  const failed = rows.filter(row => row.state === 'failed')
  const cancelled = rows.filter(row => row.state === 'cancelled')
  const completed = rows.filter(row => row.state === 'completed' || row.state === 'idle')
  const groups = [
    { id: 'running' as const, title: '运行中', rows: loaded },
    { id: 'waiting' as const, title: '等待你的回复', rows: waiting },
    { id: 'failed' as const, title: '失败', rows: failed },
    { id: 'cancelled' as const, title: '已取消', rows: cancelled },
    { id: 'completed' as const, title: '最近完成', rows: completed },
  ]
  const currentDefinition = current?.kind === 'agent'
    ? props.agents.definitions.find(definition => definition.agentId === current.archive.agent.agentId)
    : undefined
  const canStartCurrent = current?.kind !== 'agent'
    || (props.agents.phase === 'ready' && currentDefinition !== undefined)
  const open = (id: SessionId): void => {
    props.openSession(id)
    props.actions.navigate('conversations')
  }
  if (rows.length === 0) return <div className={css.pageScroll}>
    <PageHeader title="并行视图" subtitle="每个会话拥有独立上下文、工作区和产物"/>
    <div className={css.settingsPlaceholder}>
      <ChatsCircle size={42}/><h2>暂无并行会话</h2>
      <p>创建多个真实 技能 会话后，可在这里统一查看运行和可继续状态。</p>
      <button type="button" className={css.primaryButton} onClick={() => { props.actions.navigate('skills') }}>
        <CapabilityIcon kind="skill" size={18} bare/>选择 技能
      </button>
    </div>
  </div>
  return <div className={css.pageScroll}>
    <PageHeader
      title="并行视图"
      subtitle="每个会话拥有独立上下文、工作区和产物"
      action={<div className={css.pageHeaderActions}>
        {waiting.length > 0 && <button type="button" className={css.replyDrawerTrigger} aria-label={`查看等待回复的 ${waiting.length} 个会话`} onClick={() => { setReplyDrawerOpen(true) }}>
          <ChatsCircle/><span>等待回复</span><b>{waiting.length}</b><CaretRight/>
        </button>}
        <button
        className={css.primaryButton}
        disabled={!canStartCurrent}
        title={canStartCurrent ? undefined : '当前 专家 定义不可用；旧存档仍可继续'}
        onClick={() => {
          if (current === undefined) {
            props.actions.navigate('skills')
            return
          }
          if (current.kind === 'skill') {
            void props.startBoundSession(
              current.archive.binding,
              assetTitle(props.catalog, current.archive.binding.assetId),
            )
          } else {
            if (currentDefinition !== undefined) void props.startAgentSession(currentDefinition)
          }
        }}
      >{current === undefined ? <><CapabilityIcon kind="skill" size={18} bare/>选择 技能 或 专家</> : <><Plus/>新会话</>}</button></div>}
    />
    <div className={css.filters}>
      {([
        ['all', `全部 ${rows.length}`],
        ['running', `运行中 ${loaded.length}`],
        ['waiting', `等待回复 ${waiting.length}`],
        ['failed', `失败 ${failed.length}`],
        ['cancelled', `已取消 ${cancelled.length}`],
        ['completed', `最近完成 ${completed.length}`],
      ] as const).map(([id, label]) => (
        <button key={id} className={filter === id ? css.selected : undefined} onClick={() => { setFilter(id) }}>
          {label}
        </button>
      ))}
    </div>
    {groups.filter(group => filter === 'all' || filter === group.id).map(group => (
      <ParallelSection key={group.id} title={group.title} count={group.rows.length}>
        {group.rows.length === 0
          ? <p className={css.muted}>当前没有此状态的会话。</p>
          : group.rows.map(row => <ParallelRow
            key={row.archive.sessionId}
            row={row}
            label={row.kind === 'skill'
              ? assetTitle(props.catalog, row.archive.binding.assetId)
              : row.archive.agent.name}
            onOpen={() => { open(row.archive.sessionId) }}
            state={row.state}
          />)}
      </ParallelSection>
    ))}
    {replyDrawerOpen && <aside className={css.replyDrawer} aria-label="等待回复会话">
      <header><div><h2>等待你的回复</h2><p>这些会话相互独立，可逐个处理。</p></div><button type="button" aria-label="关闭等待回复" onClick={() => { setReplyDrawerOpen(false) }}><X/></button></header>
      {waiting.map(row => <button type="button" key={row.archive.sessionId} onClick={() => { setReplyDrawerOpen(false); open(row.archive.sessionId) }}>
        {row.kind === 'skill' ? <SkillMark small/> : <CapabilityIcon kind="agent"/>}
        <span><b>{row.archive.title ?? (row.kind === 'skill' ? row.archive.binding.assetId : row.archive.agent.name)}</b><small>{pendingInteractions.get(row.archive.sessionId)?.kind ?? '需要你的输入'}</small></span><CaretRight/>
      </button>)}
    </aside>}
  </div>
}

function ParallelSection({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return <section className={css.parallelSection}>
    <h2>{title} <mark>{count}</mark></h2>
    <div className={css.parallelHead}>
      <span>会话</span><span>技能</span><span>状态</span><span>当前状态</span><span>更新时间</span><span/>
    </div>
    {children}
  </section>
}

function ParallelRow({ row, label, onOpen, state }: {
  row: { kind: 'skill'; archive: QuantSkillsSessionArchiveItem }
    | { kind: 'agent'; archive: QuantSkillsAgentSessionArchiveItem }
  label: string
  onOpen: () => void
  state: 'idle' | 'running' | 'waiting' | 'failed' | 'cancelled' | 'completed'
}) {
  const { archive } = row
  const status = state === 'idle' ? 'completed' : state
  const statusLabel = state === 'running' ? '运行中' : state === 'waiting' ? '等待回复' : state === 'failed' ? '失败' : state === 'cancelled' ? '已取消' : '已完成'
  return <div className={css.parallelRow}>
    <span className={css.nameCell}>
      {row.kind === 'skill' ? <SkillMark small/> : <CapabilityIcon kind="agent"/>}
      <b>{archive.title ?? label}</b>
    </span>
    <span>{row.kind === 'skill' ? `技能 · ${label}` : `专家 · ${label}`}</span>
    <span className={css.success}>
      <StatusDot status={status}/>{statusLabel}
    </span>
    <span>{state === 'running' ? 'AI 正在处理' : state === 'waiting' ? '请打开会话回复' : state === 'failed' ? '可打开查看错误并重试' : state === 'cancelled' ? '可新建会话重新运行' : '独立上下文与产物已保存'}</span>
    <span>{formatUpdated(archive.updatedAt)}</span>
    <span><button type="button" onClick={onOpen}>打开</button><DotsThreeVertical/></span>
  </div>
}

function FavoriteToggle({ id, name, favorites, toggle }: { id: string; name: string; favorites: readonly string[]; toggle: (ids: string[]) => void }) {
  const active = favorites.includes(id)
  return <button type="button" className={css.favoriteButton} aria-label={`${active ? '取消收藏' : '收藏'} ${name}`} aria-pressed={active}
    onClick={() => toggle(active ? favorites.filter(item => item !== id) : [...favorites, id])}><Star weight={active ? 'fill' : 'regular'}/></button>
}

function FavoritesPage(props: PageProps) {
  const favorites = props.useStore(state => state.favoriteAssetIds)
  const [busy, setBusy] = useState<string>()
  const [error, setError] = useState<string>()
  const assets = [...skillLibraryAssets(props.catalog, 'mine'), ...skillLibraryAssets(props.catalog, 'installed'), ...props.catalog.assets]
  const entries = favorites.flatMap<{ id: string; kind: 'skill' | 'agent' | 'agent-team'; name: string; summary: string; recent: SessionId | undefined; start: () => Promise<unknown>; ready: boolean; action: string }>(id => {
    const agent = props.agents.definitions.find(item => `agent:${item.agentId}` === id)
    const team = props.agents.teams.find(item => `team:${item.teamId}` === id)
    const asset = assets.find(item => item.name === id)
    if (agent) return [{ id, kind: 'agent' as const, name: agent.name, summary: capabilitySummary(agent.role),
      recent: props.agents.archives.filter(item => item.agent.agentId === agent.agentId).sort((a,b) => b.updatedAt-a.updatedAt)[0]?.sessionId,
      start: () => props.startAgentSession(agent), ready: props.agents.definitionsPhase === 'ready' || props.agents.phase === 'ready', action: '开始对话' }]
    if (team) return [{ id, kind: 'agent-team' as const, name: team.name, summary: team.description,
      recent: props.agents.teamArchives.filter(item => item.team.teamId === team.teamId).sort((a,b) => b.updatedAt-a.updatedAt)[0]?.sessionId,
      start: () => props.startAgentTeamSession(team), ready: props.agents.teamsPhase === 'ready' || props.agents.phase === 'ready', action: '开始团队会话' }]
    if (!asset) return []
    const version = currentInstalledVersion(props.catalog, asset)
    return [{ id, kind: asset.projectType, name: asset.title, summary: asset.summary || asset.description,
      recent: props.boundSessions.archives.filter(item => item.binding.assetId === asset.name).sort((a,b) => b.updatedAt-a.updatedAt)[0]?.sessionId,
      start: async () => {
        if (asset.projectType === 'agent') { const installed = await props.installAgent(asset); await props.startAgentSession(installed) }
        else if (version) await props.startSkillSession(asset, version)
        else await props.installAsset(asset)
      }, ready: version ? props.catalog.installedPhase === 'ready' : props.catalog.phase === 'ready', action: asset.projectType === 'agent' ? '创建并对话' : version ? '开始对话' : '安装技能' }]
  })
  const run = async (id: string, operation: () => Promise<unknown>) => {
    setBusy(id); setError(undefined)
    try { await operation() } catch (cause) { setError(cause instanceof Error ? cause.message : '暂时无法打开，请重试。') } finally { setBusy(undefined) }
  }
  return <div className={css.pageScroll}>
    <PageHeader title="收藏" subtitle="常用技能、专家与团队，从这里继续对话或开始新任务"/>
    {error && <p className={css.error} role="alert">{error}</p>}
    {entries.length === 0 ? <div className={css.emptyState}><Star size={34}/><h2>收藏常用的能力</h2><p>在技能、专家卡片或会话顶部点击星标，即可在这里直接使用。</p><button type="button" onClick={() => props.actions.navigate('skills')}>浏览技能</button></div>
      : <div className={css.cardGrid}>{entries.map(entry => <article className={css.favoriteCard} key={entry.id}>
        <div className={css.agentLaunchTitle}><CapabilityIcon kind={entry.kind}/><span><h2>{entry.name}</h2><small>{entry.kind === 'skill' ? '技能' : entry.kind === 'agent' ? '专家' : '专家团'}</small></span>
          <FavoriteToggle id={entry.id} name={entry.name} favorites={favorites} toggle={props.actions.setFavoriteAssetIds}/></div>
        <p>{entry.summary}</p>
        <div className={css.favoriteActions}>
          <button type="button" className={css.primaryButton} disabled={busy !== undefined || !entry.ready} onClick={() => { if (entry.recent) props.openSession(entry.recent); else void run(entry.id,entry.start) }}><ChatsCircle/>{busy === entry.id ? '正在打开…' : entry.recent ? '继续对话' : entry.action}</button>
          {entry.recent && <button type="button" className={css.outlineButton} disabled={busy !== undefined || !entry.ready} onClick={() => { void run(entry.id,entry.start) }}><Plus/>新对话</button>}
        </div>
      </article>)}</div>}
  </div>
}

interface AgentEditorDraft {
  readonly name: string
  readonly role: string
  readonly mode: 'dynamic' | 'fixed'
  readonly versionIds: readonly string[]
  readonly modelKey: string
  readonly reasoningEffort: string
  readonly permission: 'read-only' | 'workspace-write' | 'danger-full-access'
}

const EMPTY_AGENT_DRAFT: AgentEditorDraft = {
  name: '',
  role: '',
  mode: 'dynamic',
  versionIds: [],
  modelKey: '',
  reasoningEffort: '',
  permission: 'workspace-write',
}

function AgentsPage(props: PageProps) {
  const [uninstallTarget, setUninstallTarget] = useState<QuantSkillsAgentDefinition>()
  const [uninstallError, setUninstallError] = useState<string>()
  const favorites = props.useStore(state => state.favoriteAssetIds)
  const defaultAgentProvider = props.useStore(state => state.defaultAgentProvider)
  const defaultAgentModel = props.useStore(state => state.defaultAgentModel)
  const defaultAgentReasoningEffort = props.useStore(state => state.defaultAgentReasoningEffort)
  const defaultAgentPermission = props.useStore(state => state.defaultAgentPermission)
  const defaultDraft = useMemo<AgentEditorDraft>(() => ({
    ...EMPTY_AGENT_DRAFT,
    modelKey: defaultAgentProvider === '' || defaultAgentModel === ''
      ? ''
      : `${defaultAgentProvider}\u0000${defaultAgentModel}`,
    reasoningEffort: defaultAgentReasoningEffort,
    permission: defaultAgentPermission,
  }), [defaultAgentModel, defaultAgentPermission, defaultAgentProvider, defaultAgentReasoningEffort])
  const teamPage = props.useStore(state => state.page === 'teams')
  const tab = props.useStore(state => state.agentWorkspaceTab)
  const [expertSource, setExpertSource] = useState<CapabilityLibrarySource>('mine')
  const [showExpertPresets, setShowExpertPresets] = useState(false)
  const [showTeamPresets, setShowTeamPresets] = useState(false)
  const [presetTeamToEdit, setPresetTeamToEdit] = useState<string>()
  const [teamSource, setTeamSource] = useState<CapabilityLibrarySource>('mine')
  const librarySource = teamPage ? teamSource : expertSource
  const setLibrarySource = teamPage ? setTeamSource : setExpertSource
  const agentTeamCreationPending = props.useStore(state => state.agentTeamCreationPending)
  const agentTeamBuilderSeed = props.useStore(state => state.agentTeamBuilderSeed)
  useEffect(() => { if (agentTeamCreationPending) setShowTeamPresets(false) }, [agentTeamCreationPending])
  const selectedAgentCategory = props.useStore(state => state.selectedAgentCategory)
  const setTab = props.actions.setAgentWorkspaceTab
  const [editingId, setEditingId] = useState<string>()
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<AgentEditorDraft>(EMPTY_AGENT_DRAFT)
  const [candidateVersionId, setCandidateVersionId] = useState('')
  const [busy, setBusy] = useState(false)
  const [operationError, setOperationError] = useState<string>()
  const [validationShown, setValidationShown] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  const [modelOptions, setModelOptions] = useState<readonly QuantSkillsAgentModelOption[]>([])
  const [roleAssistantOpen, setRoleAssistantOpen] = useState(false)
  const [roleAssistantInstruction, setRoleAssistantInstruction] = useState('')
  const [roleAssistantDraft, setRoleAssistantDraft] = useState('')
  const [roleAssistantError, setRoleAssistantError] = useState<string>()
  const [roleAssistantBusy, setRoleAssistantBusy] = useState(false)
  const roleAssistantAbortRef = useRef<AbortController>()
  const roleAssistantTriggerRef = useRef<HTMLButtonElement>(null)
  const roleAssistantCloseRef = useRef<HTMLButtonElement>(null)
  const sources = props.agents.librarySources ?? []
  const sourceOf = (id: string, version?: string) => agentLibrarySource(id, version, sources, props.catalog)
  const definitions = props.agents.definitions.filter(item => sourceOf(item.agentId, item.sourceVersionId) === librarySource)
  const visibleTeams = props.agents.teams.filter(item => sourceOf(item.teamId) === librarySource)
  const hasUnknown = teamPage ? props.agents.teams.some(item => sourceOf(item.teamId) === 'unknown') : props.agents.definitions.some(item => sourceOf(item.agentId, item.sourceVersionId) === 'unknown')
    || props.agents.teams.some(item => sourceOf(item.teamId) === 'unknown')
  const allMarketAgents = useMemo(
    () => props.catalog.assets.filter(asset => asset.projectType === 'agent'),
    [props.catalog.assets],
  )
  const agentCategories = useMemo(() => props.catalog.categories.filter(category =>
    allMarketAgents.some(asset => asset.category === category.id)), [
    allMarketAgents,
    props.catalog.categories,
  ])
  const marketAgents = useMemo(() => allMarketAgents.filter(asset =>
    selectedAgentCategory === 'all' || asset.category === selectedAgentCategory), [
    allMarketAgents,
    selectedAgentCategory,
  ])
  const selected = creating
    ? undefined
    : definitions.find(definition => definition.agentId === editingId)
  const installedVersions = useMemo(() => Object.values(props.catalog.versionsByAsset)
    .flat()
    .filter(version => version.projectType === 'skill' && version.exposure === 'skill-registry')
    .sort((left, right) => left.assetName.localeCompare(right.assetName)), [props.catalog.versionsByAsset])
  const versionById = useMemo(
    () => new Map(installedVersions.map(version => [version.versionId, version])),
    [installedVersions],
  )
  const assetNameByVersion = useMemo(() => new Map(installedVersions.map(version => [
    version.versionId,
    version.assetName,
  ])), [installedVersions])
  const selectedArchives = selected === undefined
    ? []
    : props.agents.archives.filter(archive => archive.agent.agentId === selected.agentId)
  const recentArchiveByAgent = useMemo(() => {
    const byAgent = new Map<string, QuantSkillsAgentSessionArchiveItem>()
    for (const archive of [...props.agents.archives].sort((left, right) => right.updatedAt - left.updatedAt)) {
      if (!byAgent.has(archive.agent.agentId)) byAgent.set(archive.agent.agentId, archive)
    }
    return byAgent
  }, [props.agents.archives])

  useEffect(() => {
    if (selected === undefined || creating) return
    setDraft({
      name: selected.name,
      role: selected.role,
      mode: selected.mode,
      versionIds: selected.skills.map(skill => skill.versionId),
      modelKey: selected.model === undefined ? '' : `${selected.model.provider}\u0000${selected.model.model}`,
      reasoningEffort: selected.model?.reasoningEffort ?? '',
      permission: selected.permission,
    })
    setDeletePending(false)
    setOperationError(undefined)
    setValidationShown(false)
    setRoleAssistantOpen(false)
    setRoleAssistantInstruction('')
    setRoleAssistantDraft('')
    setRoleAssistantError(undefined)
  }, [creating, selected?.agentId, selected?.revision])

  useEffect(() => {
    if (!roleAssistantOpen) return
    roleAssistantCloseRef.current?.focus()
    const closeOnEscape = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      roleAssistantAbortRef.current?.abort()
      setRoleAssistantOpen(false)
      roleAssistantTriggerRef.current?.focus()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('keydown', closeOnEscape) }
  }, [roleAssistantOpen])

  useEffect(() => {
    void props.listAgentModels().then(setModelOptions, () => { setModelOptions([]) })
  }, [])

  useEffect(() => {
    if (selectedAgentCategory !== 'all'
      && !agentCategories.some(category => category.id === selectedAgentCategory)) {
      props.actions.setAgentCategory('all')
    }
  }, [agentCategories, props.actions, selectedAgentCategory])

  const beginCreate = (): void => {
    roleAssistantAbortRef.current?.abort()
    setShowExpertPresets(false)
    setCreating(true)
    setEditingId(undefined)
    setDraft(defaultDraft)
    setCandidateVersionId(installedVersions[0]?.versionId ?? '')
    setDeletePending(false)
    setOperationError(undefined)
    setValidationShown(false)
    setRoleAssistantOpen(false)
    setRoleAssistantInstruction('')
    setRoleAssistantDraft('')
    setRoleAssistantError(undefined)
  }
  const startAgentAuthoring = (): void => {
    setBusy(true)
    setOperationError(undefined)
    void props.startAuthoringSession('agent').catch((cause: unknown) => {
      setOperationError(cause instanceof Error ? cause.message : '专家 创作会话创建失败。')
    }).finally(() => { setBusy(false) })
  }
  const beginEdit = (definition: QuantSkillsAgentDefinition): void => {
    roleAssistantAbortRef.current?.abort()
    setShowExpertPresets(false)
    setCreating(false)
    setEditingId(definition.agentId)
    setValidationShown(false)
    setRoleAssistantOpen(false)
    setRoleAssistantInstruction('')
    setRoleAssistantDraft('')
    setRoleAssistantError(undefined)
  }
  const addVersion = (): void => {
    const candidate = versionById.get(candidateVersionId)
    if (candidate === undefined) return
    setDraft(current => ({
      ...current,
      versionIds: [
        ...current.versionIds.filter((versionId) => {
          const assetName = assetNameByVersion.get(versionId)
          return assetName === undefined || assetName !== candidate.assetName
        }),
        candidate.versionId,
      ],
    }))
  }
  const moveVersion = (index: number, direction: -1 | 1): void => {
    const destination = index + direction
    if (destination < 0 || destination >= draft.versionIds.length) return
    const next = [...draft.versionIds]
    const current = next[index]
    const neighbor = next[destination]
    if (current === undefined || neighbor === undefined) return
    next[index] = neighbor
    next[destination] = current
    setDraft(value => ({ ...value, versionIds: next }))
  }
  const nameError = draft.name.trim() === '' ? '请输入专家名称。' : undefined
  const roleError = draft.role.trim() === ''
    ? '请输入角色说明。'
    : draft.role.includes('{{') || draft.role.includes('}}')
      ? '角色说明不能包含双花括号引用。'
      : undefined
  const formReady = nameError === undefined && roleError === undefined
  const authoritativeReady = (props.agents.definitionsPhase ?? props.agents.phase) === 'ready'
  const dirty = selected === undefined
    || draft.name !== selected.name
    || draft.role !== selected.role
    || draft.mode !== selected.mode
    || draft.permission !== selected.permission
    || draft.modelKey !== (selected.model === undefined ? '' : `${selected.model.provider}\u0000${selected.model.model}`)
    || draft.reasoningEffort !== (selected.model?.reasoningEffort ?? '')
    || draft.versionIds.length !== selected.skills.length
    || draft.versionIds.some((versionId, index) => versionId !== selected.skills[index]?.versionId)

  const validateDraft = (): boolean => {
    setValidationShown(true)
    if (formReady) return true
    setOperationError('请完成标记为必填的内容。')
    return false
  }
  const persistDraft = async (): Promise<QuantSkillsAgentDefinition> => {
    const fields = {
      name: draft.name.trim(),
      role: draft.role.trim(),
      mode: draft.mode,
      ...(draft.modelKey === '' ? {} : {
        model: {
          provider: draft.modelKey.split('\u0000')[0] ?? '',
          model: draft.modelKey.split('\u0000')[1] ?? '',
          ...(draft.reasoningEffort === '' ? {} : { reasoningEffort: draft.reasoningEffort }),
        },
      }),
      permission: draft.permission,
      ...(selected?.sourceVersionId === undefined ? {} : { sourceVersionId: selected.sourceVersionId }),
      versionIds: draft.versionIds as readonly QuantSkillsInstalledVersionId[],
    }
    const saved = selected === undefined
      ? await props.createAgent(fields)
      : sourceOf(selected.agentId, selected.sourceVersionId) === 'installed'
        ? await props.createAgent({ ...fields, copyFrom: { agentId: selected.agentId, expectedRevision: selected.revision } })
        : await props.updateAgent({
        ...fields,
        agentId: selected.agentId,
        expectedRevision: selected.revision,
      })
    setCreating(false)
    setLibrarySource('mine')
    setEditingId(saved.agentId)
    setValidationShown(false)
    return saved
  }
  const save = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!authoritativeReady || !validateDraft()) return
    setBusy(true)
    setOperationError(undefined)
    try {
      await persistDraft()
    } catch (error: unknown) {
      setOperationError(error instanceof Error ? error.message : '专家 保存失败。请刷新 Host 状态后重试。')
    } finally {
      setBusy(false)
    }
  }
  const saveAndRun = async (isolated: boolean): Promise<void> => {
    if (!authoritativeReady) {
      setOperationError('Host 投影尚未就绪，请刷新后重试。')
      return
    }
    let definition = selected
    if ((definition === undefined || dirty) && !validateDraft()) return
    setBusy(true)
    setOperationError(undefined)
    try {
      if (definition === undefined || dirty) definition = await persistDraft()
      if (isolated) await props.testAgent(definition)
      else await props.startAgentSession(definition)
    } catch (error: unknown) {
      setOperationError(error instanceof Error
        ? error.message
        : isolated ? '测试会话创建失败。' : '专家 会话创建失败。')
    } finally {
      setBusy(false)
    }
  }
  const remove = async (): Promise<void> => {
    if (selected === undefined) return
    setBusy(true)
    setOperationError(undefined)
    try {
      await props.deleteAgent({ agentId: selected.agentId, expectedRevision: selected.revision })
      setEditingId(undefined)
      setDeletePending(false)
    } catch {
      setOperationError('专家 删除失败。请刷新 Host 状态后重试。')
    } finally {
      setBusy(false)
    }
  }
  const start = async (definition: QuantSkillsAgentDefinition): Promise<void> => {
    setBusy(true)
    setOperationError(undefined)
    try {
      await props.startAgentSession(definition)
    } catch {
      setOperationError('专家 会话创建失败。请刷新 Host 状态后重试。')
    } finally {
      setBusy(false)
    }
  }
  const open = (definition: QuantSkillsAgentDefinition): void => {
    const recent = recentArchiveByAgent.get(definition.agentId)
    if (recent !== undefined) {
      props.openSession(recent.sessionId)
      props.actions.navigate('conversations')
      return
    }
    void start(definition)
  }
  const closeRoleAssistant = (): void => {
    roleAssistantAbortRef.current?.abort()
    setRoleAssistantOpen(false)
    setRoleAssistantBusy(false)
    roleAssistantTriggerRef.current?.focus()
  }
  const generateRole = async (): Promise<void> => {
    roleAssistantAbortRef.current?.abort()
    const controller = new AbortController()
    roleAssistantAbortRef.current = controller
    setRoleAssistantBusy(true)
    setRoleAssistantError(undefined)
    try {
      const generated = (await props.generateAgentRole({
        name: draft.name.trim(),
        currentRole: draft.role.trim(),
        mode: draft.mode,
        skills: draft.versionIds.map((versionId) => {
          const version = versionById.get(versionId)
          return {
            title: version === undefined ? versionId : assetTitle(props.catalog, version.assetName),
            versionId,
          }
        }),
        instruction: roleAssistantInstruction.trim(),
        ...(draft.modelKey === '' ? {} : {
          model: {
            provider: draft.modelKey.split('\u0000')[0] ?? '',
            model: draft.modelKey.split('\u0000')[1] ?? '',
            ...(draft.reasoningEffort === '' ? {} : { reasoningEffort: draft.reasoningEffort }),
          },
        }),
      }, controller.signal)).trim()
      if (generated === '') throw new Error('模型没有返回角色说明，请重试。')
      if (generated.includes('{{') || generated.includes('}}')) {
        throw new Error('生成内容包含不受支持的双花括号引用，请补充要求后重新生成。')
      }
      setRoleAssistantDraft(generated)
    } catch (error: unknown) {
      if (!controller.signal.aborted) {
        setRoleAssistantError(error instanceof Error ? error.message : 'AI 角色说明生成失败，请重试。')
      }
    } finally {
      if (roleAssistantAbortRef.current === controller) {
        roleAssistantAbortRef.current = undefined
        setRoleAssistantBusy(false)
      }
    }
  }
  const applyRoleAssistantDraft = (mode: 'replace' | 'append'): void => {
    const generated = roleAssistantDraft.trim()
    if (generated === '') return
    setDraft(value => ({
      ...value,
      role: mode === 'replace' || value.role.trim() === ''
        ? generated
        : `${value.role.trim()}\n\n${generated}`,
    }))
    setRoleAssistantOpen(false)
    roleAssistantTriggerRef.current?.focus()
  }
  const teamWorkspace = <AgentTeamsWorkspace
    {...props}
    agents={{ ...props.agents, teams: visibleTeams }}
    modelOptions={modelOptions}
    creationPending={agentTeamCreationPending}
    builderSeed={agentTeamBuilderSeed}
    initialTeamId={presetTeamToEdit}
    consumeCreationRequest={props.actions.consumeAgentTeamCreation}
    openManualAgentBuilder={() => { setTab('mine'); beginCreate() }}
  />
  return <div className={css.pageScroll}>
    {uninstallTarget && <ActionDialog title="卸载专家" busy={busy} error={uninstallError} onClose={() => setUninstallTarget(undefined)}>
      <p>卸载「{uninstallTarget.name}」？已有会话、团队和依赖技能会保留，之后可从发现页重新安装。</p>
      <footer><button type="button" disabled={busy} onClick={() => setUninstallTarget(undefined)}>取消</button>
        <button type="button" data-danger disabled={busy} onClick={() => {
          setBusy(true); setUninstallError(undefined)
          void props.uninstallAgent!({ agentId: uninstallTarget.agentId, expectedRevision: uninstallTarget.revision }).then(() => {
            setUninstallTarget(undefined); setEditingId(undefined)
          }, error => setUninstallError(error instanceof Error ? error.message : '卸载失败，请重试。')).finally(() => setBusy(false))
        }}>{busy ? '正在卸载…' : '确认卸载'}</button></footer>
    </ActionDialog>}
    <PageHeader
      title={teamPage ? "专家团" : "专家"}
      subtitle={teamPage ? "让多位专家围绕一个目标协作，各自发挥所长" : "选择专长，完成投研与日常办公任务"}
      action={tab === 'mine' ? <div className={css.creationActions}>
        <button type="button" className={css.primaryButton} disabled={busy} onClick={startAgentAuthoring}><MagicWand/>AI 创建 专家</button>
        <button type="button" className={css.outlineButton} disabled={busy} onClick={beginCreate}><Plus/>手动配置 专家</button>
      </div> : undefined}
    />
    <div className={css.agentTabs}>
      {!teamPage && <button type="button" className={showExpertPresets ? css.selected : undefined} onClick={() => { setShowExpertPresets(true); setCreating(false); setEditingId(undefined) }}>推荐专家 · {EXPERT_PRESETS.length}</button>}
      {teamPage && <button type="button" className={showTeamPresets ? css.selected : undefined} onClick={() => { setShowTeamPresets(true); setPresetTeamToEdit(undefined) }}>推荐专家团 · {TEAM_PRESETS.length}</button>}
      {([['mine', '我的创建'], ['installed', '已安装'], ['discover', '发现']] as const).filter(([source]) => !teamPage || source !== 'discover').map(([source, label]) => <button
        key={source} type="button" className={!(teamPage ? showTeamPresets : showExpertPresets) && (tab === 'market' ? source === 'discover' : librarySource === source) ? css.selected : undefined}
        onClick={() => { setShowExpertPresets(false); setShowTeamPresets(false); setPresetTeamToEdit(undefined); if (source !== 'discover') setLibrarySource(source); setTab(teamPage ? 'teams' : source === 'discover' ? 'market' : 'mine'); setEditingId(undefined); setCreating(false) }}
      >{label}</button>)}
      {hasUnknown && <button type="button" className={!(teamPage ? showTeamPresets : showExpertPresets) && librarySource === 'unknown' && tab !== 'market' ? css.selected : undefined} onClick={() => { setShowExpertPresets(false); setShowTeamPresets(false); setPresetTeamToEdit(undefined); setLibrarySource('unknown'); setTab(teamPage ? 'teams' : 'mine') }}>历史内容 · 来源待确认</button>}
    </div>
    {(props.agents.error ?? operationError) && <p className={css.error} role="alert">
      {operationError ?? props.agents.error}
    </p>}
    {teamPage && showTeamPresets ? <TeamPresets definitions={props.agents.definitions} teams={props.agents.teams} versions={installedVersions} ready={authoritativeReady && (props.agents.teamsPhase ?? props.agents.phase) === 'ready'} icon={<CapabilityIcon kind="agent-team"/>} createExpert={props.createAgent} createTeam={props.createAgentTeam} start={props.startAgentTeamSession} open={team => { setLibrarySource('mine'); setTab('teams'); setPresetTeamToEdit(team.teamId); setShowTeamPresets(false) }}/>
    : !teamPage && showExpertPresets ? <ExpertPresets definitions={props.agents.definitions} versions={installedVersions} ready={authoritativeReady} icon={<CapabilityIcon kind="agent"/>} create={props.createAgent} start={props.startAgentSession} open={definition => { setLibrarySource('mine'); setTab('mine'); beginEdit(definition) }}/>
    : tab === 'teams' ? teamWorkspace : tab === 'market' ? <div className={css.agentMarket}>
      <div className={css.categoryTabs} aria-label="专家市场分类">
        <button type="button" className={selectedAgentCategory === 'all' ? css.selected : undefined} onClick={() => { props.actions.setAgentCategory('all') }}>全部</button>
        {agentCategories.map((category) => {
          const count = allMarketAgents.filter(asset => asset.category === category.id).length
          return <button type="button" key={category.id} className={selectedAgentCategory === category.id ? css.selected : undefined} onClick={() => { props.actions.setAgentCategory(category.id) }}>{category.label} {count}</button>
        })}
      </div>
      {marketAgents.map((asset) => {
        const installed = props.catalog.versionsByAsset[asset.name]?.find(version => version.exposure === 'agent-template')
        return <article key={asset.name}>
          <CapabilityIcon kind="agent"/>
          <div>
            <h2>{asset.title}</h2>
            <small className={css.technicalId}>{asset.name}</small>
            <p>{asset.summary || asset.description}</p>
            <small>AGENTS.md · {asset.commitSha.slice(0, 12)} · {asset.requires.length === 0
              ? '依赖将在安装时从声明解析'
              : `${String(asset.requires.length)} 个目录依赖`}</small>
          </div>
          <button
            type="button"
            className={css.primaryButton}
            disabled={busy || props.catalog.phase !== 'ready'}
            onClick={() => {
              setBusy(true); setOperationError(undefined)
              void props.installAgent(asset).then((created) => {
                setLibrarySource('installed'); setTab('mine'); setCreating(false); setEditingId(created.agentId)
              }, (error: unknown) => {
                setOperationError(error instanceof Error ? error.message : '专家 安装失败。')
              }).finally(() => { setBusy(false) })
            }}
          >{installed === undefined ? '安装并创建' : '创建副本'}</button>
        </article>
      })}
      {marketAgents.length === 0 && <div className={css.settingsPlaceholder}>
        <CapabilityIcon kind="agent" size={40}/><h2>这个分类暂无专家</h2><p>选择其他分类，或刷新官方目录后重试。</p>
        {selectedAgentCategory !== 'all' && <button type="button" className={css.outlineButton} onClick={() => { props.actions.setAgentCategory('all') }}>查看全部专家</button>}
      </div>}
    </div> : <div className={css.agentWorkspace}>
      {creating || selected !== undefined ? <form className={css.agentEditor} noValidate onSubmit={(event) => { void save(event) }}>
        <div className={css.agentTitle}>
          <CapabilityIcon kind="agent"/>
          <div><h2>{creating ? '创建专家' : `设置 · ${selected?.name ?? '专家'}`}</h2><small>{selected === undefined ? '新定义' : `Host 版本 ${selected.revision}`}</small></div>
          {selected && !dirty && authoritativeReady
            ? <span className={css.success}><CheckCircle/>Host 已保存</span>
            : <span className={css.warning}><Circle weight="fill"/>
              {authoritativeReady ? '有未保存更改' : 'Host 投影已过期'}
            </span>}
        </div>
        <div className={css.agentBuilder}>
          <details className={css.agentSummary}><summary>配置摘要与会话存档</summary>
            <CapabilityIcon kind="agent" size={34}/><h2>{draft.name.trim() || '未命名 专家'}</h2>
            <p>{draft.role.trim() || '填写角色说明，告诉 AI 它负责什么。'}</p>
            <hr/><small>编排方式</small><b>{draft.mode === 'fixed' ? '固定顺序' : 'AI 动态选择'}</b>
            <small>精确 技能</small><b>{draft.versionIds.length} 个</b>
            {selectedArchives.length > 0 && <><hr/><small>会话存档</small><div className={css.agentArchives}>
              {selectedArchives.map(archive => <button
                type="button"
                key={archive.sessionId}
                onClick={() => { props.openSession(archive.sessionId); props.actions.navigate('conversations') }}
              ><span>{archive.title ?? archive.agent.name}</span><small>{formatUpdated(archive.updatedAt)}</small></button>)}
            </div></>}
          </details>
          <section className={css.orchestration}>
            <div className={css.agentFields}>
              <label><span className={css.fieldLabel}>名称 <span className={css.requiredBadge}>必填</span></span><input
                aria-label="专家 名称"
                aria-describedby="agent-name-help"
                aria-invalid={validationShown && nameError !== undefined}
                required
                value={draft.name}
                maxLength={80}
                onChange={(event) => { setDraft(value => ({ ...value, name: event.target.value })) }}
                placeholder="例如：量化研究助理"
              /><small id="agent-name-help" className={css.fieldHelp}>1–80 个字符；保存后仍可通过齿轮修改。</small>
              {validationShown && nameError !== undefined && <small className={css.fieldError}>{nameError}</small>}</label>
              <div className={css.agentField}><span className={css.roleFieldHeading}><label htmlFor="agent-role" className={css.fieldLabel}>角色说明 <span className={css.requiredBadge}>必填</span></label><button
                ref={roleAssistantTriggerRef}
                type="button"
                className={css.aiWriteButton}
                onClick={() => {
                  setRoleAssistantOpen(true)
                  setRoleAssistantError(undefined)
                }}
              ><MagicWand/>AI 帮写</button></span><textarea
                id="agent-role"
                aria-label="专家 角色说明"
                aria-describedby="agent-role-help"
                aria-invalid={validationShown && roleError !== undefined}
                required
                value={draft.role}
                maxLength={128_000}
                onChange={(event) => { setDraft(value => ({ ...value, role: event.target.value })) }}
                placeholder="说明职责、研究方法、限制和希望交付的产物。"
              /><small id="agent-role-help" className={css.fieldHelp}>写入每个新会话的角色指引；不能包含双花括号引用。</small>
              {validationShown && roleError !== undefined && <small className={css.fieldError}>{roleError}</small>}</div>
            </div>
            {roleAssistantOpen && <div className={css.roleAssistantLayer}>
              <button type="button" className={css.roleAssistantBackdrop} aria-label="关闭 AI 帮写" onClick={closeRoleAssistant}/>
              <aside className={css.roleAssistantDrawer} role="dialog" aria-modal="true" aria-labelledby="agent-role-assistant-title">
                <header>
                  <span className={css.agentMark}><MagicWand/></span>
                  <div><h2 id="agent-role-assistant-title">AI 帮写角色说明</h2><p>根据名称、技能 编排和现有说明生成草稿。</p></div>
                  <button ref={roleAssistantCloseRef} type="button" aria-label="关闭 AI 帮写" onClick={closeRoleAssistant}><X/></button>
                </header>
                <div className={css.roleAssistantContext}>
                  <span><b>{draft.name.trim() || '未命名专家'}</b><small>{draft.versionIds.length} 个 技能 · {draft.mode === 'fixed' ? '固定顺序' : 'AI 动态选择'}</small></span>
                  <span>{draft.modelKey === '' ? '使用会话默认模型' : '使用当前选择的模型'}</span>
                </div>
                <label><span>补充要求 <span className={css.optionalBadge}>选填</span></span><textarea
                  aria-label="AI 帮写补充要求"
                  value={roleAssistantInstruction}
                  maxLength={2_000}
                  onChange={(event) => { setRoleAssistantInstruction(event.target.value) }}
                  placeholder="例如：强调风险控制，要求输出中文研究报告。"
                /></label>
                <div className={css.roleAssistantGenerateRow}>
                  <button type="button" className={css.primaryButton} disabled={roleAssistantBusy} onClick={() => { void generateRole() }}>
                    <MagicWand/>{roleAssistantBusy ? '正在生成…' : roleAssistantDraft === '' ? '生成草稿' : '重新生成'}
                  </button>
                  <small>生成过程使用当前会话模型，并记录在临时会话后自动归档。</small>
                </div>
                {roleAssistantError !== undefined && <p className={css.roleAssistantError} role="alert">{roleAssistantError}</p>}
                <label className={css.roleAssistantPreview}><span>草稿预览</span><textarea
                  aria-label="AI 角色说明草稿"
                  value={roleAssistantDraft}
                  onChange={(event) => { setRoleAssistantDraft(event.target.value) }}
                  placeholder="生成后的角色说明会显示在这里，应用前可以继续修改。"
                /></label>
                <footer>
                  <button type="button" className={css.outlineButton} onClick={closeRoleAssistant}>取消</button>
                  <button type="button" className={css.outlineButton} disabled={roleAssistantDraft.trim() === '' || roleAssistantBusy} onClick={() => { applyRoleAssistantDraft('append') }}>追加</button>
                  <button type="button" className={css.primaryButton} disabled={roleAssistantDraft.trim() === '' || roleAssistantBusy} onClick={() => { applyRoleAssistantDraft('replace') }}>替换原说明</button>
                </footer>
              </aside>
            </div>}
            <div className={css.sectionHeading}>
              <div><h2>技能 编排 <span className={css.optionalBadge}>选填</span></h2><p>不添加时创建角色型专家；添加后只使用 Host 已安装的精确版本，顺序会随会话写入日志。</p></div>
            </div>
            <div className={css.agentSkillPicker}>
              <select
                aria-label="选择已安装 技能 版本"
                value={candidateVersionId}
                disabled={installedVersions.length === 0}
                onChange={(event) => { setCandidateVersionId(event.target.value) }}
              >
                <option value="">选择已安装版本</option>
                {installedVersions.map(version => <option key={version.versionId} value={version.versionId}>
                  {assetTitle(props.catalog, version.assetName)} · {version.commitSha.slice(0, 12)}
                </option>)}
              </select>
              <button
                type="button"
                className={css.outlineButton}
                disabled={candidateVersionId === ''}
                onClick={addVersion}
              ><Plus/>添加 技能</button>
            </div>
            {installedVersions.length === 0 && <p className={css.notice}>当前没有已安装 技能；仍可保存角色型专家，之后再通过齿轮添加。</p>}
            <div className={css.orchestrationTable}>
              {draft.versionIds.length === 0
                ? <p className={css.emptyInline}>尚未添加 技能。该专家将只使用角色指引和会话基础能力。</p>
                : draft.versionIds.map((versionId, index) => {
                  const version = versionById.get(versionId)
                  const label = version === undefined ? versionId : assetTitle(props.catalog, version.assetName)
                  return <div key={versionId} className={css.agentSkillRow}>
                    <DotsSixVertical/><span>{index + 1}</span><SkillMark small/>
                    <span><b>{label}</b><small>{versionId}</small></span>
                    <span className={css.exactVersion}>精确版本</span>
                    <span className={css.agentOrderActions}>
                      <button type="button" aria-label={`上移 ${label}`} disabled={index === 0} onClick={() => { moveVersion(index, -1) }}><ArrowUp/></button>
                      <button type="button" aria-label={`下移 ${label}`} disabled={index === draft.versionIds.length - 1} onClick={() => { moveVersion(index, 1) }}><ArrowDown/></button>
                      <button type="button" aria-label={`移除 ${label}`} onClick={() => { setDraft(value => ({ ...value, versionIds: value.versionIds.filter(id => id !== versionId) })) }}><X/></button>
                    </span>
                  </div>
                })}
            </div>
            <h3 className={css.fieldLabel}>编排方式 <span className={css.requiredBadge}>必选</span></h3>
            <label className={css.radioLine}><input
              type="radio"
              name="agent-mode"
              checked={draft.mode === 'dynamic'}
              onChange={() => { setDraft(value => ({ ...value, mode: 'dynamic' })) }}
            /><span><b>由 AI 动态选择</b><small>AI 根据对话目标选择这些 技能，列表顺序作为优先级。</small></span></label>
            <label className={css.radioLine}><input
              type="radio"
              name="agent-mode"
              checked={draft.mode === 'fixed'}
              onChange={() => { setDraft(value => ({ ...value, mode: 'fixed' })) }}
            /><span><b>固定顺序</b><small>向 AI 提供按列表顺序使用全部 技能 的固定指引。</small></span></label>
            <div className={css.sectionHeading}><div><h2>模型与权限</h2><p>每次新建 专家 会话时应用；测试会话也使用相同配置。</p></div></div>
            <div className={css.agentFields}>
              <label><span className={css.fieldLabel}>模型 <span className={css.optionalBadge}>选填</span></span><select
                aria-label="专家 模型"
                aria-describedby="agent-model-help"
                value={draft.modelKey}
                onChange={(event) => { setDraft(value => ({ ...value, modelKey: event.target.value, reasoningEffort: '' })) }}
              >
                <option value="">跟随会话默认模型</option>
                {modelOptions.map(option => <option key={`${option.provider}\u0000${option.model}`} value={`${option.provider}\u0000${option.model}`}>
                  {publicCatalogLabel(option.providerLabel)} · {publicCatalogLabel(option.modelLabel)}
                </option>)}
              </select><small id="agent-model-help" className={css.fieldHelp}>不选择时跟随新会话的默认模型。</small></label>
              <label><span className={css.fieldLabel}>权限 <span className={css.requiredBadge}>必选</span></span><select aria-label="专家 权限" required value={draft.permission} onChange={(event) => {
                setDraft(value => ({ ...value, permission: event.target.value as AgentEditorDraft['permission'] }))
              }}>
                <option value="read-only">只读分析</option><option value="workspace-write">有限权限</option><option value="danger-full-access">完全权限</option>
              </select></label>
              {modelOptions.find(option => `${option.provider}\u0000${option.model}` === draft.modelKey)?.reasoningEfforts.length
                ? <label><span className={css.fieldLabel}>推理强度 <span className={css.optionalBadge}>选填</span></span><select aria-label="专家 推理强度" value={draft.reasoningEffort} onChange={(event) => { setDraft(value => ({ ...value, reasoningEffort: event.target.value })) }}>
                  <option value="">模型默认</option>
                  {modelOptions.find(option => `${option.provider}\u0000${option.model}` === draft.modelKey)?.reasoningEfforts.map(effort => <option key={effort.id} value={effort.id}>{effort.label}</option>)}
                </select></label>
                : null}
            </div>
          </section>
        </div>
        <footer className={css.stickyFooter}>
          <button type="button" className={css.agentEditorBack} onClick={() => {
            setCreating(false)
            setEditingId(undefined)
            setDeletePending(false)
            setOperationError(undefined)
          }}><X/>取消并返回专家</button>
          {selected && <button type="button" className={css.dangerButton} disabled={busy || !authoritativeReady} onClick={() => { setDeletePending(true) }}>删除</button>}
          {selected && deletePending && <ActionDialog title="删除专家" busy={busy} error={operationError} onClose={() => setDeletePending(false)}><p>删除「{selected.name}」的定义？已有会话会保留。</p><footer><button type="button" disabled={busy} onClick={() => setDeletePending(false)}>取消</button><button type="button" data-danger disabled={busy || !authoritativeReady} onClick={() => { void remove() }}>确认删除</button></footer></ActionDialog>}
          {!authoritativeReady && <span className={css.footerHint} role="status">Host 投影未就绪，暂时不能保存或创建会话。</span>}
          <button type="submit" className={css.outlineButton} disabled={busy || !authoritativeReady}><FloppyDisk/>{busy ? '处理中' : '保存'}</button>
          <button type="button" className={css.outlineButton} disabled={busy || !authoritativeReady} onClick={() => { void saveAndRun(true) }}><Shield/>{dirty ? '保存并隔离测试' : '隔离测试'}</button>
          <button type="button" className={css.primaryButton} disabled={busy || !authoritativeReady} onClick={() => { void saveAndRun(false) }}><ChatsCircle/>{dirty ? '保存并新建对话' : '新建专家对话'}</button>
        </footer>
      </form> : <AgentLaunchpad
        onUninstall={librarySource === 'installed' && props.uninstallAgent ? definition => { setUninstallError(undefined); setUninstallTarget(definition) } : undefined}
        definitions={definitions}
        favorites={favorites}
        toggleFavorite={props.actions.setFavoriteAssetIds}
        recentArchiveByAgent={recentArchiveByAgent}
        ready={authoritativeReady}
        busy={busy}
        onOpen={open}
        onStart={(definition) => { void start(definition) }}
        onEdit={beginEdit}
        onCreate={beginCreate}
        onAuthoring={startAgentAuthoring}
      />}
    </div>}
  </div>
}

function AgentLaunchpad({
  definitions, recentArchiveByAgent, ready, busy, onOpen, onStart, onEdit, onCreate, onAuthoring, onArrange, favorites, toggleFavorite, onUninstall,
}: {
  definitions: readonly QuantSkillsAgentDefinition[]
  favorites: readonly string[]
  toggleFavorite: (ids: string[]) => void
  recentArchiveByAgent: ReadonlyMap<string, QuantSkillsAgentSessionArchiveItem>
  ready: boolean
  busy: boolean
  onOpen: (definition: QuantSkillsAgentDefinition) => void
  onStart: (definition: QuantSkillsAgentDefinition) => void
  onEdit: (definition: QuantSkillsAgentDefinition) => void
  onCreate: () => void
  onAuthoring: () => void
  onUninstall?: ((definition: QuantSkillsAgentDefinition) => void) | undefined
  onArrange?: ((definition: QuantSkillsAgentDefinition) => void) | undefined
}) {
  if (definitions.length === 0) return <section className={css.agentLaunchpad}>
    <div className={css.settingsPlaceholder}>
      <CapabilityIcon kind="agent" size={42}/><h2>创建你的第一个专家</h2>
      <p>配置一次角色与 技能，之后从列表一键继续独立对话。</p>
      <div className={css.creationActions}>
        <button type="button" className={css.primaryButton} disabled={busy} onClick={onAuthoring}><MagicWand/>AI 创建 专家</button>
        <button type="button" className={css.outlineButton} disabled={busy} onClick={onCreate}><Plus/>手动配置 专家</button>
      </div>
    </div>
  </section>
  return <section className={css.agentLaunchpad}>
    <header><div><h2>选择专家开始对话</h2><p>主按钮继续最近存档；“新对话”始终创建独立上下文。</p></div></header>
    <div className={css.agentLaunchGrid}>
      {definitions.map((definition) => {
        const recent = recentArchiveByAgent.get(definition.agentId)
        return <article key={definition.agentId}>
          <div className={css.agentLaunchTitle}>
            <CapabilityIcon kind="agent"/>
            <span><h2>{definition.name}</h2><small>{definition.skills.length} 个 技能 · {definition.mode === 'fixed' ? '固定编排' : '动态编排'}</small></span>
            <div className={css.agentCardTools}><FavoriteToggle id={`agent:${definition.agentId}`} name={definition.name} favorites={favorites} toggle={toggleFavorite}/><button type="button" className={css.agentGear} aria-label={`设置专家 ${definition.name}`} onClick={() => { onEdit(definition) }}><GearSix/></button></div>
          </div>
          <p>{capabilitySummary(definition.role)}</p>
          <div className={css.agentLaunchMeta}>
            <span><ChatsCircle/>{recent === undefined ? '还没有对话' : `${recent.title ?? '未命名对话'} · ${formatUpdated(recent.updatedAt)}`}</span>
            <span><Shield/>{definition.permission === 'read-only' ? '只读分析' : definition.permission === 'workspace-write' ? '有限权限' : '完全权限'}</span>
          </div>
          <footer>
            <button type="button" className={css.primaryButton} disabled={!ready || busy} onClick={() => { onOpen(definition) }}><ChatsCircle/>{recent === undefined ? '开始对话' : '继续对话'}</button>
            <button type="button" className={css.outlineButton} disabled={!ready || busy} onClick={() => { onStart(definition) }}><Plus/>新对话</button>
            {onArrange && <button type="button" className={css.outlineButton} disabled={!ready || busy} onClick={() => onArrange(definition)}>创建安排</button>}
            {onUninstall && <button type="button" className={css.uninstallButton} disabled={!ready || busy} aria-label={`卸载 ${definition.name}`} onClick={() => onUninstall(definition)}><Trash/>卸载</button>}
          </footer>
        </article>
      })}
    </div>
  </section>
}

interface AgentTeamMemberDraft {
  readonly key: string
  readonly name: string
  readonly agentId: string
  readonly context: 'fresh' | 'fork'
  readonly model: QuantSkillsAgentTeamModelChoice
}

interface AgentTeamDraft {
  readonly name: string
  readonly description: string
  readonly leadAgentId: string
  readonly leadModel: QuantSkillsAgentTeamModelChoice
  readonly members: readonly AgentTeamMemberDraft[]
}

const DEFAULT_TEAM_MODEL_CHOICE: QuantSkillsAgentTeamModelChoice = { kind: 'default' }

function blankTeamDraft(definitions: readonly QuantSkillsAgentDefinition[]): AgentTeamDraft {
  return {
    name: '',
    description: '',
    leadAgentId: definitions[0]?.agentId ?? '',
    leadModel: DEFAULT_TEAM_MODEL_CHOICE,
    members: [{
      key: crypto.randomUUID(),
      name: 'researcher',
      agentId: definitions[1]?.agentId ?? '',
      context: 'fresh',
      model: DEFAULT_TEAM_MODEL_CHOICE,
    }],
  }
}

function teamDraftFrom(definition: QuantSkillsAgentTeamDefinition): AgentTeamDraft {
  return {
    name: definition.name,
    description: definition.description,
    leadAgentId: definition.lead.agentId,
    leadModel: definition.leadModel,
    members: definition.members.map(member => ({
      key: crypto.randomUUID(),
      name: member.name,
      agentId: member.agent.agentId,
      context: member.context,
      model: member.model,
    })),
  }
}

function teamDraftFromSeed(seed: QuantSkillsAgentTeamBuilderSeed): AgentTeamDraft {
  return {
    name: seed.name,
    description: seed.description,
    leadAgentId: seed.leadAgentId,
    leadModel: seed.leadModel,
    members: seed.members.map(member => ({ ...member, key: crypto.randomUUID() })),
  }
}

function teamModelChoiceKey(choice: QuantSkillsAgentTeamModelChoice): string {
  return choice.kind === 'default' ? '' : `${choice.selection.provider}\u0000${choice.selection.model}`
}

function teamModelChoiceLabel(
  choice: QuantSkillsAgentTeamModelChoice,
  options: readonly QuantSkillsAgentModelOption[],
): string {
  if (choice.kind === 'default') return '跟随会话默认'
  const option = options.find(candidate => candidate.provider === choice.selection.provider
    && candidate.model === choice.selection.model)
  const model = option === undefined
    ? `${choice.selection.provider} · ${choice.selection.model}`
    : `${publicCatalogLabel(option.providerLabel)} · ${publicCatalogLabel(option.modelLabel)}`
  const effort = option?.reasoningEfforts.find(candidate => candidate.id === choice.selection.reasoningEffort)?.label
    ?? choice.selection.reasoningEffort
  return effort === undefined ? model : `${model} · ${effort}`
}

function TeamModelChoiceFields({ label, choice, options, onChange }: {
  label: string
  choice: QuantSkillsAgentTeamModelChoice
  options: readonly QuantSkillsAgentModelOption[]
  onChange: (choice: QuantSkillsAgentTeamModelChoice) => void
}) {
  const modelKey = teamModelChoiceKey(choice)
  const selected = choice.kind === 'fixed'
    ? options.find(option => option.provider === choice.selection.provider
      && option.model === choice.selection.model)
    : undefined
  return <div className={css.teamModelFields}>
    <label><small>{label}模型</small><select aria-label={`${label}模型`} value={modelKey} onChange={(event) => {
      const option = options.find(candidate => `${candidate.provider}\u0000${candidate.model}` === event.target.value)
      onChange(option === undefined
        ? DEFAULT_TEAM_MODEL_CHOICE
        : { kind: 'fixed', selection: { provider: option.provider, model: option.model } })
    }}>
      <option value="">跟随会话默认模型</option>
      {choice.kind === 'fixed' && selected === undefined && <option value={modelKey}>
        {choice.selection.provider} · {choice.selection.model}
      </option>}
      {options.map(option => <option key={`${option.provider}\u0000${option.model}`} value={`${option.provider}\u0000${option.model}`}>
        {publicCatalogLabel(option.providerLabel)} · {publicCatalogLabel(option.modelLabel)}
      </option>)}
    </select></label>
    {choice.kind === 'fixed' && selected !== undefined && selected.reasoningEfforts.length > 0 && <label><small>{label}推理强度</small><select
      aria-label={`${label}推理强度`}
      value={choice.selection.reasoningEffort ?? ''}
      onChange={(event) => { onChange({
        kind: 'fixed',
        selection: {
          provider: choice.selection.provider,
          model: choice.selection.model,
          ...(event.target.value === '' ? {} : { reasoningEffort: event.target.value }),
        },
      }) }}
    ><option value="">模型默认</option>{selected.reasoningEfforts.map(effort => <option key={effort.id} value={effort.id}>{effort.label}</option>)}</select></label>}
  </div>
}

function AgentTeamsWorkspace(props: PageProps & {
  modelOptions: readonly QuantSkillsAgentModelOption[]
  initialTeamId?: string | undefined
  creationPending: boolean
  builderSeed: QuantSkillsAgentTeamBuilderSeed | undefined
  consumeCreationRequest: () => void
  openManualAgentBuilder: () => void
}) {
  const definitions = props.agents.definitions
  const teams = props.agents.teams
  const favorites = props.useStore(state => state.favoriteAssetIds)
  const [selectedId, setSelectedId] = useState<string | undefined>(props.initialTeamId)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<AgentTeamDraft>(() => blankTeamDraft(definitions))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [validationShown, setValidationShown] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const selected = creating ? undefined : teams.find(team => team.teamId === selectedId)
  const recentByTeam = useMemo(() => {
    const result = new Map<string, QuantSkillsAgentTeamSessionArchiveItem>()
    for (const archive of [...props.agents.teamArchives].sort((left, right) => right.updatedAt - left.updatedAt)) {
      if (!result.has(archive.team.teamId)) result.set(archive.team.teamId, archive)
    }
    return result
  }, [props.agents.teamArchives])
  useEffect(() => {
    if (selected === undefined || creating) return
    setDraft(teamDraftFrom(selected))
    setError(undefined)
    setValidationShown(false)
    setDeletePending(false)
  }, [creating, selected?.revision, selected?.teamId])

  const lead = definitions.find(agent => agent.agentId === draft.leadAgentId)
  const names = draft.members.map(member => member.name.trim())
  const agentIds = draft.members.map(member => member.agentId)
  const nameError = draft.name.trim() === '' ? '请输入团队名称。' : undefined
  const descriptionError = draft.description.trim() === ''
    ? '请输入团队目标。'
    : draft.description.includes('{{') || draft.description.includes('}}')
      ? '团队目标不能包含双花括号引用。'
      : undefined
  const leadError = lead === undefined ? '请选择 Lead 专家。' : undefined
  const membersError = draft.members.length === 0
    ? '至少添加一个团队成员。'
    : names.some(name => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name === 'lead')
      ? '成员标识必须是小写英文、数字和连字符，且不能使用 lead。'
      : new Set(names).size !== names.length
        ? '成员标识不能重复。'
        : agentIds.some(agentId => agentId === '' || !definitions.some(agent => agent.agentId === agentId))
          ? '每个成员都必须选择一个仍然存在的 专家。'
          : new Set([draft.leadAgentId, ...agentIds]).size !== draft.members.length + 1
            ? 'Lead 与成员不能重复使用同一个 专家。'
            : lead !== undefined && draft.members.some((member) => {
              const agent = definitions.find(candidate => candidate.agentId === member.agentId)
              return agent !== undefined && lead.permission !== agent.permission
            })
              ? '所有成员必须与 Lead 使用相同权限。'
              : undefined
  const teamDataReady = (props.agents.teamsPhase ?? props.agents.phase) === 'ready'
  const ready = teamDataReady
    && nameError === undefined
    && descriptionError === undefined
    && leadError === undefined
    && membersError === undefined

  const beginCreate = (seed?: QuantSkillsAgentTeamBuilderSeed): void => {
    setCreating(true)
    setSelectedId(undefined)
    setDraft(seed === undefined ? blankTeamDraft(definitions) : teamDraftFromSeed(seed))
    setError(undefined)
    setValidationShown(false)
    setDeletePending(false)
  }
  useEffect(() => {
    if (!props.creationPending) return
    beginCreate(props.builderSeed)
    props.consumeCreationRequest()
  }, [props.builderSeed, props.creationPending])
  useEffect(() => {
    if (creating) nameInputRef.current?.focus()
  }, [creating])
  const beginEdit = (definition: QuantSkillsAgentTeamDefinition): void => {
    setCreating(false)
    setSelectedId(definition.teamId)
    setDraft(teamDraftFrom(definition))
    setError(undefined)
    setValidationShown(false)
    setDeletePending(false)
  }
  const persist = async (): Promise<QuantSkillsAgentTeamDefinition> => {
    setValidationShown(true)
    if (!ready || lead === undefined) throw new Error('请先修正 专家团 的必填项和运行约束。')
    const fields: QuantSkillsAgentTeamCreateRequest = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      leadAgentId: lead.agentId,
      leadAgentRevision: lead.revision,
      leadModel: draft.leadModel,
      members: draft.members.map((member) => {
        const agent = definitions.find(candidate => candidate.agentId === member.agentId)
        if (agent === undefined) throw new Error(`成员 ${member.name} 的 专家 已不存在。`)
        return {
          name: member.name.trim(),
          agentId: agent.agentId,
          agentRevision: agent.revision,
          context: member.context,
          model: member.model,
        }
      }),
    }
    const saved = selected === undefined
      ? await props.createAgentTeam(fields)
      : await props.updateAgentTeam({
        ...fields,
        teamId: selected.teamId,
        expectedRevision: selected.revision,
      })
    setCreating(false)
    setSelectedId(saved.teamId)
    setValidationShown(false)
    return saved
  }
  const save = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setBusy(true)
    setError(undefined)
    try {
      await persist()
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : '专家团 保存失败。')
    } finally {
      setBusy(false)
    }
  }
  const saveAndStart = async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      const saved = await persist()
      await props.startAgentTeamSession(saved)
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : '专家团 会话创建失败。')
    } finally {
      setBusy(false)
    }
  }
  const start = async (definition: QuantSkillsAgentTeamDefinition): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      await props.startAgentTeamSession(definition)
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : '专家团 会话创建失败。')
    } finally {
      setBusy(false)
    }
  }
  const open = (definition: QuantSkillsAgentTeamDefinition): void => {
    const recent = recentByTeam.get(definition.teamId)
    if (recent === undefined) {
      void start(definition)
      return
    }
    props.openSession(recent.sessionId)
    props.actions.navigate('conversations')
  }
  const remove = async (): Promise<void> => {
    if (selected === undefined) return
    setBusy(true)
    setError(undefined)
    try {
      await props.deleteAgentTeam({ teamId: selected.teamId, expectedRevision: selected.revision })
      setSelectedId(undefined)
      setDeletePending(false)
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : '专家团 删除失败。')
    } finally {
      setBusy(false)
    }
  }
  const startAuthoring = (kind: 'agent' | 'agent-team'): void => {
    setBusy(true)
    setError(undefined)
    void props.startAuthoringSession(kind).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : `${kind === 'agent' ? '专家' : '专家团'} 创作会话创建失败。`)
    }).finally(() => { setBusy(false) })
  }

  return <section className={css.agentTeamWorkspace}>
    <header className={css.agentTeamHeader}>
      <div><h2>{teams.length} 个专家团</h2><p>选择已有专家团继续协作，或创建新的研究分工。</p></div>
      <div className={css.creationActions}>
        <button type="button" className={css.primaryButton} disabled={busy} onClick={() => { startAuthoring('agent-team') }}><MagicWand/>AI 创建 专家团</button>
        <button type="button" className={css.outlineButton} disabled={busy} onClick={() => { beginCreate() }}><Plus/>手动编排</button>
      </div>
    </header>
    {definitions.length < 2 && <div className={css.insufficientAgents}>
      <p className={css.notice}>创建团队需要至少一个 Lead 和一个成员。AI 会先设计完整分工；若缺少所需角色，会明确说明并继续引导 AI 创建对应 专家。</p>
      <div className={css.creationActions}>
        <button type="button" className={css.outlineButton} disabled={busy} onClick={() => { startAuthoring('agent') }}><MagicWand/>AI 创建 专家</button>
      </div>
    </div>}
    {error !== undefined && <p className={css.error} role="alert">{error}</p>}
    <div className={css.agentWorkspace}>
      {creating || selected !== undefined ? <form className={css.agentEditor} noValidate onSubmit={(event) => { void save(event) }}>
        <div className={css.agentTitle}>
          <CapabilityIcon kind="agent-team"/>
          <div><h2>{creating ? '创建 专家团' : `设置 · ${selected?.name ?? ''}`}</h2><small>{selected === undefined ? '新定义' : `Host 版本 ${selected.revision}`}</small></div>
        </div>
        <div className={css.agentBuilder}>
          <details className={css.agentSummary}><summary>团队配置摘要</summary>
            <CapabilityIcon kind="agent-team" size={34}/><h2>{draft.name || '未命名团队'}</h2><p>{draft.description || '描述团队目标与 Lead 的交付要求。'}</p>
            <hr/><small>Lead</small><b>{lead?.name ?? '未选择'}</b><small>成员</small><b>{draft.members.length} 个</b>
            <small>Lead 模型</small><b>{teamModelChoiceLabel(draft.leadModel, props.modelOptions)}</b>
            <small>团队权限</small><b>{lead?.permission ?? '未确定'}</b>
          </details>
          <section className={css.orchestration}>
            <div className={css.agentFields}>
              <label><span className={css.fieldLabel}>团队名称 <span className={css.requiredBadge}>必填</span></span><input ref={nameInputRef} aria-label="专家团 名称" value={draft.name} maxLength={80} onChange={(event) => { setDraft(value => ({ ...value, name: event.target.value })) }}/>{validationShown && nameError !== undefined && <small className={css.fieldError}>{nameError}</small>}</label>
              <label><span className={css.fieldLabel}>Lead 专家 <span className={css.requiredBadge}>必选</span></span><select aria-label="专家团 Lead" value={draft.leadAgentId} onChange={(event) => { setDraft(value => ({ ...value, leadAgentId: event.target.value })) }}><option value="">选择 Lead 专家</option>{definitions.map(agent => <option key={agent.agentId} value={agent.agentId}>{agent.name} · r{agent.revision}</option>)}</select>{validationShown && leadError !== undefined && <small className={css.fieldError}>{leadError}</small>}</label>
            </div>
            <TeamModelChoiceFields label="Lead " choice={draft.leadModel} options={props.modelOptions} onChange={(model) => { setDraft(value => ({ ...value, leadModel: model })) }}/>
            <label className={css.agentField}><span className={css.fieldLabel}>团队目标 <span className={css.requiredBadge}>必填</span></span><textarea aria-label="专家团 目标" value={draft.description} maxLength={4_000} onChange={(event) => { setDraft(value => ({ ...value, description: event.target.value })) }} placeholder="说明团队共同目标、分工原则和最终交付。"/>{validationShown && descriptionError !== undefined && <small className={css.fieldError}>{descriptionError}</small>}</label>
            <div className={css.sectionHeading}><div><h2>成员编排 <span className={css.requiredBadge}>至少 1 个</span></h2><p>成员标识会成为团队的稳定寻址名称；一个 专家 在同一团队只能占一个角色。</p></div><button type="button" className={css.outlineButton} disabled={draft.members.length >= 8} onClick={() => { setDraft(value => ({ ...value, members: [...value.members, { key: crypto.randomUUID(), name: `member-${String(value.members.length + 1)}`, agentId: '', context: 'fresh', model: DEFAULT_TEAM_MODEL_CHOICE }] })) }}><Plus/>添加成员</button></div>
            <div className={css.teamMemberList}>
              {draft.members.map((member, index) => <div key={member.key} className={css.teamMemberRow}>
                <span className={css.teamMemberIndex}>{index + 1}</span>
                <label><small>成员标识</small><input aria-label={`成员 ${String(index + 1)} 标识`} value={member.name} onChange={(event) => { setDraft(value => ({ ...value, members: value.members.map(row => row.key === member.key ? { ...row, name: event.target.value } : row) })) }}/></label>
                <label><small>专家</small><select aria-label={`成员 ${String(index + 1)} 专家`} value={member.agentId} onChange={(event) => { setDraft(value => ({ ...value, members: value.members.map(row => row.key === member.key ? { ...row, agentId: event.target.value } : row) })) }}><option value="">选择 专家</option>{definitions.map(agent => <option key={agent.agentId} value={agent.agentId}>{agent.name} · r{agent.revision}</option>)}</select></label>
                <label><small>上下文</small><select aria-label={`成员 ${String(index + 1)} 上下文`} value={member.context} onChange={(event) => { setDraft(value => ({ ...value, members: value.members.map(row => row.key === member.key ? { ...row, context: event.target.value as 'fresh' | 'fork' } : row) })) }}><option value="fresh">独立上下文</option><option value="fork">继承已完成轮次</option></select></label>
                <button type="button" aria-label={`删除成员 ${String(index + 1)}`} disabled={draft.members.length === 1} onClick={() => { setDraft(value => ({ ...value, members: value.members.filter(row => row.key !== member.key) })) }}><Trash/></button>
                <TeamModelChoiceFields label={`成员 ${String(index + 1)} `} choice={member.model} options={props.modelOptions} onChange={(model) => { setDraft(value => ({ ...value, members: value.members.map(row => row.key === member.key ? { ...row, model } : row) })) }}/>
              </div>)}
            </div>
            {validationShown && membersError !== undefined && <p className={css.fieldError}>{membersError}</p>}
            <p className={css.notice}><Shield/>每个角色可以跟随会话默认模型，也可以分别指定模型和推理强度；团队成员仍需与 Lead 使用相同权限。角色和 技能 按每个成员冻结的 专家 版本独立加载。</p>
          </section>
        </div>
        <footer className={css.stickyFooter}>
          <button type="button" className={css.agentEditorBack} onClick={() => { setCreating(false); setSelectedId(undefined); setError(undefined) }}><X/>取消并返回团队</button>
          {selected !== undefined && <button type="button" className={css.dangerButton} disabled={busy} onClick={() => { setDeletePending(true) }}>删除</button>}
          {selected !== undefined && deletePending && <ActionDialog title="删除 专家团" busy={busy} error={error} onClose={() => setDeletePending(false)}><p>删除「{selected.name}」的团队定义？已有会话会保留。</p><footer><button type="button" disabled={busy} onClick={() => setDeletePending(false)}>取消</button><button type="button" data-danger disabled={busy} onClick={() => { void remove() }}>确认删除</button></footer></ActionDialog>}
          {!ready && <span className={css.footerHint} role="status">请先修正必填项，并确保 Lead 与成员的权限一致。</span>}
          <button type="submit" className={css.outlineButton} disabled={busy || !ready}><FloppyDisk/>{busy ? '处理中' : '保存'}</button>
          <button type="button" className={css.primaryButton} disabled={busy || !ready} onClick={() => { void saveAndStart() }}><ChatsCircle/>保存并新建团队会话</button>
        </footer>
      </form> : <section className={css.agentLaunchpad}>
        {teams.length === 0 ? <div className={css.settingsPlaceholder}><CapabilityIcon kind="agent-team" size={42}/><h2>创建第一个专家团</h2><p>告诉 AI 团队目标、输入和期望交付，角色选择与底层编排会自动完成。</p><div className={css.creationActions}><button type="button" className={css.primaryButton} disabled={busy} onClick={() => { startAuthoring('agent-team') }}><MagicWand/>AI 创建 专家团</button></div></div>
          : <div className={css.agentLaunchGrid}>{teams.map((team) => {
            const recent = recentByTeam.get(team.teamId)
            return <article key={team.teamId}>
              <div className={css.agentLaunchTitle}><CapabilityIcon kind="agent-team"/><span><h2>{team.name}</h2><small>Lead：{team.lead.name} · {team.members.length} 个成员</small></span><div className={css.agentCardTools}><FavoriteToggle id={`team:${team.teamId}`} name={team.name} favorites={favorites} toggle={props.actions.setFavoriteAssetIds}/><button type="button" className={css.agentGear} aria-label={`设置专家团 ${team.name}`} onClick={() => { beginEdit(team) }}><GearSix/></button></div></div>
              <p>{team.description}</p>
              <div className={css.teamRosterPreview}>
                {team.members.map(member => <span key={member.name}>
                  {member.name} · {member.agent.name} · {teamModelChoiceLabel(member.model, props.modelOptions)}
                </span>)}
              </div>
              <footer><button type="button" className={css.primaryButton} disabled={busy || !teamDataReady} onClick={() => { open(team) }}><ChatsCircle/>{recent === undefined ? '开始团队会话' : '继续团队会话'}</button><button type="button" className={css.outlineButton} disabled={busy || !teamDataReady} onClick={() => { void start(team) }}><Plus/>新团队会话</button></footer>
            </article>
          })}</div>}
      </section>}
    </div>
  </section>
}

function PluginSettings(props: PageProps) {
  return <div className={css.pluginMarket}>{props.renderPluginMarket?.() ?? <p role="status">插件市场正在加载，请稍后重新打开。</p>}</div>
}

function SettingsPage(props: PageProps) {
  const section = props.useStore(state => state.settingsSection)
  const interfaceScale = props.useStore(state => state.interfaceScale)
  const conversationScale = props.useStore(state => state.conversationScale)
  const conversationBrightness = props.useStore(state => state.conversationBrightness)
  const conversationOverlayOpacity = props.useStore(state => state.conversationOverlayOpacity)
  const colorScheme = props.useStore(state => state.colorScheme)
  const lightBackground = props.useStore(state => state.lightBackground)
  const darkBackground = props.useStore(state => state.darkBackground)
  const autoCheckCatalog = props.useStore(state => state.autoCheckCatalog)
  const settingsStatus = props.useStore(state => state.settingsStatus)
  const settingsWritable = props.useStore(state => state.settingsWritable)
  const defaultAgentProvider = props.useStore(state => state.defaultAgentProvider)
  const defaultAgentModel = props.useStore(state => state.defaultAgentModel)
  const defaultAgentReasoningEffort = props.useStore(state => state.defaultAgentReasoningEffort)
  const defaultAgentPermission = props.useStore(state => state.defaultAgentPermission)
  const [modelOptions, setModelOptions] = useState<readonly QuantSkillsAgentModelOption[]>([])
  const [modelError, setModelError] = useState<string>()
  useEffect(() => {
    if (section !== 'permissions') return
    setModelError(undefined)
    void props.listAgentModels().then(setModelOptions, (cause: unknown) => {
      setModelOptions([])
      setModelError(cause instanceof Error ? cause.message : '无法读取模型目录。')
    })
  }, [section])
  const preferencesReady = settingsStatus === 'ready' && settingsWritable
  const sections: readonly [typeof section, ReactNode, string][] = [
    ['workspace', <FolderOpen/>, '工作区'],
    ['updates', <Clock/>, '自动更新'],
    ['permissions', <Shield/>, '模型与权限'],
    ['models', <Wrench/>, '模型服务'],
    ['plugins', <GridFour/>, '插件市场'],
    ['appearance', <Palette/>, '外观'],
    ['panda-data', <Database/>, 'PandaData'],
    ['brand-support', <Globe/>, '品牌与支持'],
  ]
  return <div className={css.pageWithDrawer}>
    <div className={css.pageScroll}>
      <PageHeader title="设置" subtitle="管理工作区、更新、模型权限与显示"/>
      <div className={css.settingsLayout}>
        <aside className={css.settingsNav}>
          {sections.map(([id, icon, label]) => (
            <button
              key={id}
              className={section === id ? css.selected : undefined}
              aria-current={section === id ? "page" : undefined}
              onClick={() => { props.actions.setSettingsSection(id) }}
            >
              {icon}{label}
            </button>
          ))}
          <hr/>
          <p>界面 {Math.round(interfaceScale * 100)}% · 对话文字 {Math.round(conversationScale * 100)}%</p>
        </aside>
        <section className={css.settingsContent}>
          {section === 'plugins' ? <PluginSettings {...props}/> : section === 'models' ? <QuantSkillsModelServices access={props.modelAccess}/> : section === 'workspace' ? <WorkspaceSettings props={props}/> : section === 'appearance' ? <>
            <h2>外观</h2>
            <p>QuantSkills 的配色、界面比例和会话文字均可独立调整，并即时预览。</p>
            <QuantSkillsThemePicker
              scheme={colorScheme}
              lightBackground={lightBackground}
              darkBackground={darkBackground}
              disabled={!preferencesReady}
              onChange={(scheme) => { props.actions.setColorScheme(scheme) }}
              onLightBackgroundChange={(background) => { props.actions.setLightBackground(background) }}
              onDarkBackgroundChange={(background) => { props.actions.setDarkBackground(background) }}
            />
            <label className={css.scaleControl}>界面比例
              <input
                type="range"
                min={MIN_QUANTSKILLS_SCALE}
                max={MAX_QUANTSKILLS_SCALE}
                step="0.05"
                value={interfaceScale}
                disabled={!preferencesReady}
                onChange={(event) => { props.actions.setInterfaceScale(Number(event.target.value)) }}
              />
              <b>{Math.round(interfaceScale * 100)}%</b>
            </label>
            <label className={css.scaleControl}>会话文字
              <input
                type="range"
                min={MIN_QUANTSKILLS_SCALE}
                max={MAX_QUANTSKILLS_SCALE}
                step="0.05"
                value={conversationScale}
                disabled={!preferencesReady}
                onChange={(event) => { props.actions.setConversationScale(Number(event.target.value)) }}
              />
              <b>{Math.round(conversationScale * 100)}%</b>
            </label>
            <label className={css.scaleControl}>文字亮度
              <input
                type="range"
                min={MIN_QUANTSKILLS_CONVERSATION_BRIGHTNESS}
                max={MAX_QUANTSKILLS_CONVERSATION_BRIGHTNESS}
                step="0.05"
                value={conversationBrightness}
                disabled={!preferencesReady}
                onChange={(event) => { props.actions.setConversationBrightness(Number(event.target.value)) }}
              />
              <b>{Math.round(conversationBrightness * 100)}%</b>
            </label>
            <label className={css.scaleControl}>内容蒙层
              <input
                aria-label="内容蒙层"
                type="range"
                min={MIN_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY}
                max={MAX_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY}
                step="0.01"
                value={conversationOverlayOpacity}
                disabled={!preferencesReady}
                onChange={(event) => { props.actions.setConversationOverlayOpacity(Number(event.target.value)) }}
              />
              <b>{Math.round(conversationOverlayOpacity * 100)}%</b>
            </label>
            <small className={css.scaleHint}>首页与会话共用此设置。数值越低，背景越清晰；数值越高，内容越易读。</small>
            <div className={css.settingsActions}><button type="button" className={css.outlineButton} disabled={!preferencesReady || (interfaceScale === 1 && conversationScale === 1 && conversationBrightness === DEFAULT_QUANTSKILLS_CONVERSATION_BRIGHTNESS && conversationOverlayOpacity === DEFAULT_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY)} onClick={() => { props.actions.setInterfaceScale(1); props.actions.setConversationScale(1); props.actions.setConversationBrightness(DEFAULT_QUANTSKILLS_CONVERSATION_BRIGHTNESS); props.actions.setConversationOverlayOpacity(DEFAULT_QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY) }}>恢复默认</button><PreferenceSaveState status={settingsStatus} writable={settingsWritable}/></div>
          </> : section === 'brand-support' ? <QuantSkillsBrandSupportSettings/>
            : section === 'updates' ? <UpdateSettings
              catalog={props.catalog}
              catalogEnabled={autoCheckCatalog}
              catalogWritable={preferencesReady}
              onCatalogChange={(enabled) => { props.actions.setAutoCheckCatalog(enabled) }}
              onRefresh={() => props.refreshCatalog()}
            /> : section === 'panda-data' ? <PandaDataSettings
              status={props.pandaMcpStatus}
              authenticate={props.authenticatePandaMcp}
              refresh={props.refreshPandaMcp}
              logout={props.logoutPandaMcp}
            /> : <PermissionSettings
              modelOptions={modelOptions}
              modelError={modelError}
              provider={defaultAgentProvider}
              model={defaultAgentModel}
              reasoningEffort={defaultAgentReasoningEffort}
              permission={defaultAgentPermission}
              writable={preferencesReady}
              status={settingsStatus}
              onModelChange={(provider, model, reasoningEffort) => { props.actions.setDefaultAgentModel(provider, model, reasoningEffort) }}
              onPermissionChange={(permission) => { props.actions.setDefaultAgentPermission(permission) }}
            />}
        </section>
      </div>
    </div>
  </div>
}

function PandaDataSettings({ status, authenticate, refresh, logout }: {
  status: () => Promise<PandaMcpStatus>
  authenticate: () => Promise<PandaMcpStatus>
  refresh: () => Promise<PandaMcpStatus>
  logout: () => Promise<PandaMcpStatus>
}) {
  const [snapshot, setSnapshot] = useState<PandaMcpStatus>()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const poll = useCallback(async () => {
    try {
      setSnapshot(await status())
      setError(undefined)
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : '无法读取 PandaData 连接状态。')
    }
  }, [status])
  useEffect(() => {
    void poll()
    const timer = window.setInterval(() => { void poll() }, 4_000)
    return () => { window.clearInterval(timer) }
  }, [poll])
  const run = async (action: () => Promise<PandaMcpStatus>): Promise<void> => {
    setBusy(true)
    try {
      setSnapshot(await action())
      setError(undefined)
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'PandaData 操作失败。')
      await poll()
    } finally {
      setBusy(false)
    }
  }
  const phase = snapshot?.phase ?? 'disconnected'
  const connected = phase === 'connected'
  const idle = !busy && phase !== 'authenticating'
  return <div className={css.settingsPanel}>
    <Database size={34}/><h2>PandaData</h2>
    <p>登录后，模型可通过公网 MCP 调用行情数据。QuantSkills 不会收集密码，也不会把 token 发给模型。</p>
    <dl className={css.settingsFacts}>
      <div><dt>状态</dt><dd>{pandaMcpPhaseLabel(phase)}</dd></div>
      <div><dt>服务</dt><dd>{snapshot?.url ?? 'https://pandadatamcp.pandaaiquant.com/mcp'}</dd></div>
      <div><dt>说明</dt><dd>{snapshot?.message ?? '正在读取连接状态…'}</dd></div>
    </dl>
    {error !== undefined && <p className={css.error} role="alert">{error}</p>}
    <div className={css.settingsActions}>
      <button
        type="button"
        className={css.primaryButton}
        disabled={!idle && !snapshot?.authorizationUrl}
        onClick={() => { void run(authenticate) }}
      >{snapshot?.authorizationUrl ? '继续授权' : connected || phase === 'needs_auth' ? '重新登录' : '登录'}</button>
      <button
        type="button"
        className={css.outlineButton}
        disabled={!idle}
        onClick={() => { void run(refresh) }}
      ><ArrowClockwise/>刷新状态</button>
      <button
        type="button"
        className={css.outlineButton}
        disabled={!idle}
        onClick={() => { void run(logout) }}
      >退出登录</button>
    </div>
  </div>
}

function PreferenceSaveState({ status, writable }: {
  status: 'loading' | 'ready' | 'unavailable'
  writable: boolean
}) {
  const label = status === 'loading'
    ? '正在读取 Host 设置'
    : status === 'ready' && writable
      ? '外观更改会自动保存'
      : '当前连接不允许持久化设置'
  return <p className={status === 'ready' && writable ? css.success : css.warning} role="status">
    {status === 'ready' && writable ? <CheckCircle/> : <Clock/>}{label}
  </p>
}

function UpdateSettings({
  catalog, catalogEnabled, catalogWritable, onCatalogChange, onRefresh,
}: {
  catalog: QuantSkillsCatalogSnapshot
  catalogEnabled: boolean
  catalogWritable: boolean
  onCatalogChange: (enabled: boolean) => void
  onRefresh: () => Promise<void>
}) {
  const [refreshing, setRefreshing] = useState(false)
  return <div className={css.settingsPanel}>
    <Clock size={34}/><h2>自动更新</h2>
    <p>这里只控制公开 技能 目录的自动检查。QuantSkills 应用版本不会自动联网或更新。</p>
    <div className={css.settingRows}>
      <label>自动检查 技能 目录（{formatRefreshInterval(catalog.refreshAfterMs)}）
        <input type="checkbox" checked={catalogEnabled} disabled={!catalogWritable} onChange={(event) => { onCatalogChange(event.target.checked) }}/><i/>
      </label>
    </div>
    <div className={css.settingsActions}>
      <button type="button" className={css.outlineButton} disabled={refreshing} onClick={() => {
        setRefreshing(true)
        void onRefresh().finally(() => { setRefreshing(false) })
      }}>{refreshing ? '正在检查…' : '立即检查目录与已安装版本'}</button>
      {catalog.refreshedAt && <small>上次目录同步：{formatUpdated(catalog.refreshedAt)}</small>}
    </div>
    <dl className={css.settingsFacts}>
      <div><dt>技能 安装</dt><dd>始终由用户点击确认；不会在后台执行新代码安装。</dd></div>
      <div><dt>应用版本</dt><dd>首页会自动检查所选来源的正式版本，每小时最多检查一次；发现更新会变色提示并列出更新内容，点击后才下载。</dd></div>
      <div><dt>会话版本</dt><dd>已有会话固定原版本，新会话才使用新安装版本。</dd></div>
    </dl>
  </div>
}

function formatRefreshInterval(value: number | undefined): string {
  if (value === undefined) return '等待宿主策略'
  if (value % 60_000 === 0) return `${value / 60_000} 分钟`
  return `${Math.ceil(value / 1000)} 秒`
}

function WorkspaceSettings({ props }: { props: PageProps }) {
  const sessions = props.useSessions(state => state)
  const workspaces = props.useWorkspaces(state => state)
  const [refreshing, setRefreshing] = useState(false)
  const [workspaceStatus, setWorkspaceStatus] = useState<QuantSkillsWorkspaceStatusResult>()
  const [workspaceError, setWorkspaceError] = useState<string>()
  const defaultWorkspaceId = props.useStore(state => state.defaultWorkspaceId)
  const settingsWritable = props.useStore(state => state.settingsWritable)
  const currentSessionId = sessions.current
  const current = currentSessionId === undefined ? undefined : sessions.byId[currentSessionId]
  const workspace = currentSessionId === undefined
    ? workspaces.items.at(0)
    : workspaces.items.find(item => item.sessionIds.includes(currentSessionId))
  useEffect(() => {
    if (!props.managedWorkspace) {
      setWorkspaceStatus(undefined)
      setWorkspaceError(undefined)
      return
    }
    let active = true
    setWorkspaceError(undefined)
    void props.workspaceStatus().then(
      (status) => {
        if (!active) return
        setWorkspaceStatus(status)
        if (status.preferredMissing && defaultWorkspaceId !== undefined) {
          props.actions.setWorkspaceRecoveryNotice('原自定义工作区已不可用，已恢复 QuantSkills 默认工作区。')
          void props.setDefaultWorkspace(undefined)
        }
      },
      (cause: unknown) => { if (active) setWorkspaceError(cause instanceof Error ? cause.message : '无法读取默认工作区。') },
    )
    return () => { active = false }
  }, [defaultWorkspaceId, props.managedWorkspace])
  return <div className={css.settingsPanel}>
    <FolderOpen size={34}/><h2>工作区</h2>
    <p>QuantSkills 只管理会话的工作区归属。Python、PandaData SDK 和登录状态由用户环境负责，不在插件设置中保存或自动安装。</p>
    <dl className={css.settingsFacts}>
      <div><dt>Host 会话</dt><dd>{sessions.phase === 'ready' ? `${sessions.ids.length} 个已加载` : `状态：${sessions.phase}`}</dd></div>
      <div><dt>当前会话</dt><dd>{current?.displayTitle ?? '未选择'}</dd></div>
      <div><dt>当前工作区</dt><dd>{workspace === undefined ? '未绑定' : `${workspace.title} · ${workspace.path}`}</dd></div>
      {props.managedWorkspace && <div><dt>新会话默认工作区</dt><dd>{workspaceStatus?.preferredWorkspace === undefined
        ? `QuantSkills 默认工作区 · ${workspaceStatus?.managedPath ?? '正在读取…'}`
        : `${workspaceStatus.preferredWorkspace.title} · ${workspaceStatus.preferredWorkspace.path}`}</dd></div>}
      <div><dt>QuantSkills 目录</dt><dd>{props.catalog.phase === 'ready' ? `${props.catalog.assets.length} 个公开资产` : `状态：${props.catalog.phase}`}</dd></div>
    </dl>
    {props.managedWorkspace && <div className={css.settingsForm}>
      <label>默认工作区<select
        aria-label="QuantSkills 默认工作区"
        value={defaultWorkspaceId ?? ''}
        disabled={!settingsWritable}
        onChange={(event) => {
          setWorkspaceError(undefined)
          void props.setDefaultWorkspace(event.target.value === '' ? undefined : event.target.value)
            .then(() => props.workspaceStatus())
            .then(setWorkspaceStatus)
            .catch((cause: unknown) => { setWorkspaceError(cause instanceof Error ? cause.message : '无法保存默认工作区。') })
        }}
      >
        <option value="">QuantSkills 默认工作区</option>
        {workspaces.items.map(item => <option key={item.workspaceId} value={item.workspaceId}>{item.title} · {item.path}</option>)}
      </select></label>
      {defaultWorkspaceId !== undefined && <button type="button" className={css.outlineButton} onClick={() => {
        setWorkspaceError(undefined)
        void props.setDefaultWorkspace(undefined)
          .then(() => props.workspaceStatus())
          .then(setWorkspaceStatus)
          .catch((cause: unknown) => { setWorkspaceError(cause instanceof Error ? cause.message : '无法恢复默认工作区。') })
      }}>恢复 QuantSkills 默认工作区</button>}
    </div>}
    {workspaceError !== undefined && <p className={css.error} role="alert">{workspaceError}</p>}
    <div className={css.settingsActions}>
      <button type="button" className={css.outlineButton} disabled={refreshing} onClick={() => {
        setRefreshing(true)
        void Promise.all([
          props.refreshCatalog(),
          props.refreshBoundSessions(), props.refreshAgents(),
          ...(props.managedWorkspace ? [props.workspaceStatus().then(setWorkspaceStatus)] : []),
        ]).finally(() => { setRefreshing(false) })
      }}>{refreshing ? '正在同步 Host…' : '刷新工作区与目录'}</button>
    </div>
    <p className={css.notice}><Shield/>技能、专家 和 专家团 的安装与启动不依赖 PandaData 登录检查。需要 Python 或 PandaData 的任务会使用当前工作区和用户环境，缺失时只终止该任务并提供修复建议。</p>
  </div>
}

function PermissionSettings({
  modelOptions, modelError, provider, model, reasoningEffort, permission, writable, status,
  onModelChange, onPermissionChange,
}: {
  modelOptions: readonly QuantSkillsAgentModelOption[]
  modelError: string | undefined
  provider: string
  model: string
  reasoningEffort: string
  permission: AgentEditorDraft['permission']
  writable: boolean
  status: 'loading' | 'ready' | 'unavailable'
  onModelChange: (provider: string, model: string, reasoningEffort: string) => void
  onPermissionChange: (permission: AgentEditorDraft['permission']) => void
}) {
  const modelKey = provider === '' || model === '' ? '' : `${provider}\u0000${model}`
  const selected = modelOptions.find(option => `${option.provider}\u0000${option.model}` === modelKey)
  return <div className={css.settingsPanel}>
    <Shield size={34}/><h2>模型与权限</h2>
    <p>这些值是“新建 专家”的真实默认值；已有 专家 和已有会话不会被改写。</p>
    <div className={css.settingsForm}>
      <label>默认 专家 模型<select aria-label="默认 专家 模型" value={modelKey} disabled={!writable} onChange={(event) => {
        const option = modelOptions.find(candidate => `${candidate.provider}\u0000${candidate.model}` === event.target.value)
        onModelChange(option?.provider ?? '', option?.model ?? '', '')
      }}><option value="">跟随会话默认模型</option>{modelOptions.map(option => <option key={`${option.provider}\u0000${option.model}`} value={`${option.provider}\u0000${option.model}`}>{option.providerLabel} · {option.modelLabel}</option>)}</select></label>
      {selected !== undefined && selected.reasoningEfforts.length > 0 && <label>默认推理强度<select aria-label="默认 专家 推理强度" value={reasoningEffort} disabled={!writable} onChange={(event) => { onModelChange(selected.provider, selected.model, event.target.value) }}><option value="">模型默认</option>{selected.reasoningEfforts.map(effort => <option key={effort.id} value={effort.id}>{effort.label}</option>)}</select></label>}
      <label>默认 专家 权限<select aria-label="默认 专家 权限" value={permission} disabled={!writable} onChange={(event) => { onPermissionChange(event.target.value as AgentEditorDraft['permission']) }}><option value="read-only">只读</option><option value="workspace-write">工作区写入</option><option value="danger-full-access">完全访问</option></select></label>
    </div>
    {modelError && <p className={css.error} role="alert">{modelError}</p>}
    <PreferenceSaveState status={status} writable={writable}/>
    <dl className={css.settingsFacts}>
      <div><dt>普通 技能 会话</dt><dd>继续使用会话标题栏的模型与权限选择器。</dd></div>
      <div><dt>专家 会话</dt><dd>创建 专家 时固化模型与权限，新建会话时由 Host 应用。</dd></div>
      <div><dt>实盘交易</dt><dd>每一笔下单仍要求新的用户确认，默认权限不能绕过。</dd></div>
    </dl>
  </div>
}

/** Starts a durable, independent AI authoring conversation from any QuantSkills Session. */
export function QuantSkillsAuthoringAction({ start }: QuantSkillsAuthoringActionProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<QuantSkillsAuthoringKind>()
  const [error, setError] = useState<string>()
  const launch = (kind: QuantSkillsAuthoringKind): void => {
    setBusy(kind)
    setError(undefined)
    void start(kind).then(() => {
      setOpen(false)
    }, (cause: unknown) => {
      setError(cause instanceof Error ? cause.message : String(cause))
    }).finally(() => { setBusy(undefined) })
  }
  const items: readonly MenuItem[] = [
    {
      id: 'skill',
      disabled: busy !== undefined,
      icon: <CapabilityIcon kind="skill" size={17} bare/>,
      label: <span className={css.authoringMenuLabel}>
        <b>{busy === 'skill' ? '正在创建会话…' : 'AI 创建 技能'}</b>
        <small>独立上下文 · 输出标准 SKILL.md</small>
      </span>,
    },
    {
      id: 'agent',
      disabled: busy !== undefined,
      icon: <CapabilityIcon kind="agent" size={17} bare/>,
      label: <span className={css.authoringMenuLabel}>
        <b>{busy === 'agent' ? '正在创建会话…' : 'AI 创建 专家'}</b>
        <small>独立上下文 · 输出标准 AGENTS.md</small>
      </span>,
    },
    {
      id: 'agent-team',
      disabled: busy !== undefined,
      icon: <CapabilityIcon kind="agent-team" size={17} bare/>,
      label: <span className={css.authoringMenuLabel}>
        <b>{busy === 'agent-team' ? '正在创建会话…' : 'AI 创建 专家团'}</b>
        <small>对话确认目标、Lead 与成员；也可前往专家页面手动编排</small>
      </span>,
    },
  ]
  const footer: readonly MenuItem[] | undefined = error === undefined ? undefined : [{
    id: 'authoring-error',
    label: <span className={css.authoringMenuError} role="alert">{error}</span>,
    disabled: true,
    danger: true,
  }]
  return <Menu
    open={open}
    portal
    align="start"
    className={css.authoringAction ?? ''}
    items={items}
    {...footer === undefined ? {} : { footer }}
    onClose={() => { setOpen(false) }}
    onSelect={(id) => {
      if (id === 'skill' || id === 'agent' || id === 'agent-team') launch(id)
    }}
    anchor={<button
      type="button"
      className={css.authoringButton}
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={() => { setOpen(value => !value) }}
    >创建<CaretDown size={14}/></button>}
  />
}
/** Header action shown only when the Host projection binds this Session to QuantSkills. */
export function QuantSkillsResultAction({
  useProjection, useSession, useChat, open, complete,
}: QuantSkillsResultActionProps) {
  const plain = useProjection('quantSkillsPlainSession')
  const binding = useProjection('quantSkillsSession')
  const agent = useProjection('quantSkillsAgentSession')
  const team = useProjection('quantSkillsAgentTeamSession')
  const teamMember = useProjection('quantSkillsAgentTeamMember')
  const sessionId = useSession(snapshot => snapshot.sessionId)
  const running = useSession(snapshot => snapshot.running)
  const previewablePaths = useChat(snapshot =>
    previewableResultPathsForLatestTurn(snapshot).join('\u0000'))
  const previousRun = useRef({ sessionId, running })
  useEffect(() => {
    const previous = previousRun.current
    if (previous.sessionId === sessionId && previous.running && !running && previewablePaths !== '') {
      complete(sessionId)
    }
    previousRun.current = { sessionId, running }
  }, [complete, previewablePaths, running, sessionId])
  let owner: string
  if (plain != null) owner = plain.purpose === 'role-helper' ? 'QuantSkills 创作会话' : 'QuantSkills 普通会话'
  else if (binding != null) owner = binding.assetId
  else if (agent != null) owner = agent.name
  else if (team != null) owner = team.name
  else if (teamMember != null) owner = `${teamMember.agent.name} · ${teamMember.memberName}`
  else return null
  return <button
    type="button"
    className={css.resultAction}
    aria-label={`查看 ${owner} 本对话结果`}
    onClick={(event) => { open(event.currentTarget) }}
  >
    <ChartLineUp size={15}/>
    <span>结果</span>
    {running && <span className={css.resultActionLive}>运行中</span>}
  </button>
}

type ResultTab = 'overview' | 'files' | 'browser' | 'changes'

const RESULT_TABS: readonly { id: ResultTab; label: string }[] = [
  { id: 'overview', label: '概览' },
  { id: 'files', label: '文件' },
  { id: 'browser', label: '网页预览' },
  { id: 'changes', label: '变更' },
]

type ResultFileGroup = 'reports' | 'data' | 'code' | 'other'

type PreparedResultFile = QuantSkillsProducedFile & QuantSkillsPreparedResultArtifact

type ResultArtifactPreparationState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading'; readonly key: string }
  | { readonly status: 'ready'; readonly key: string; readonly files: readonly PreparedResultFile[] }
  | { readonly status: 'error'; readonly key: string; readonly files: readonly PreparedResultFile[] }

const RESULT_FILE_GROUPS: readonly { id: ResultFileGroup; label: string }[] = [
  { id: 'reports', label: '报告' },
  { id: 'data', label: '数据' },
  { id: 'code', label: '代码与文本' },
  { id: 'other', label: '其他' },
]

function ProducedFileIcon({ path }: { path: string }) {
  const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase()
  if (extension === 'pdf') return <FilePdf/>
  if (extension === 'csv') return <FileCsv/>
  if (['docx', 'epub', 'odp', 'ods', 'odt', 'pptx', 'rtf', 'xlsx'].includes(extension)) return <FileText/>
  return <FileCode/>
}

function primaryResultFile(files: readonly PreparedResultFile[]): PreparedResultFile | undefined {
  return files.reduce<PreparedResultFile | undefined>((preferred, file) => {
    if (preferred === undefined) return file
    return resultPreviewRank(file.path) < resultPreviewRank(preferred.path) ? file : preferred
  }, undefined)
}

function resultFileName(path: string): string {
  const separator = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return separator === -1 ? path : path.slice(separator + 1)
}

function resultFileGroup(path: string): ResultFileGroup {
  const extension = resultExtension(path)
  if (['md', 'markdown', 'html', 'htm', 'pdf', 'docx', 'odt', 'rtf', 'epub', 'pptx', 'odp'].includes(extension)) {
    return 'reports'
  }
  if (['csv', 'tsv', 'json', 'xlsx', 'xls', 'ods', 'parquet', 'arrow'].includes(extension)) return 'data'
  if (isCodeResultPath(path) || ['txt', 'log'].includes(extension)) return 'code'
  return 'other'
}

function unavailableResultFile(file: QuantSkillsProducedFile, reason?: string): PreparedResultFile {
  return {
    ...file,
    sourcePath: file.path,
    status: 'unavailable',
    reason: reason ?? '产物不在会话工作区',
  }
}

function resultFileLocation(file: PreparedResultFile): string {
  if (file.status === 'unavailable') return `${file.reason ?? '产物不可用'} · ${file.sourcePath}`
  if (file.status === 'archived') return `已归档 · ${file.sourcePath} → ${file.path}`
  return file.path
}

function projectPreparedResultFiles(
  candidates: readonly QuantSkillsProducedFile[],
  prepared: readonly QuantSkillsPreparedResultArtifact[],
): readonly PreparedResultFile[] {
  const bySource = new Map(prepared.map(item => [item.sourcePath, item] as const))
  return candidates.map((candidate) => {
    const item = bySource.get(candidate.path)
    if (item === undefined) return unavailableResultFile(candidate)
    if (item.status === 'unavailable' || item.path.trim() === '') {
      return unavailableResultFile(candidate, item.reason)
    }
    return {
      ...candidate,
      name: resultFileName(item.path),
      sourcePath: item.sourcePath,
      path: item.path,
      status: item.status,
      ...(item.reason === undefined ? {} : { reason: item.reason }),
    }
  })
}

function mergePreparedResultFiles(
  complete: readonly QuantSkillsPreparedResultArtifact[],
  candidates: readonly QuantSkillsProducedFile[],
  prepared: readonly QuantSkillsPreparedResultArtifact[],
): readonly PreparedResultFile[] {
  const durableCandidates = complete.map(item => ({
    path: item.sourcePath,
    name: resultFileName(item.sourcePath),
  }))
  const files = [
    ...projectPreparedResultFiles(durableCandidates, complete),
    ...projectPreparedResultFiles(candidates, prepared),
  ]
  const merged: PreparedResultFile[] = []
  const readyPaths = new Set<string>()
  for (const file of files) {
    if (file.status === 'unavailable' || readyPaths.has(file.path)) continue
    readyPaths.add(file.path)
    merged.push(file)
  }
  return merged
}

function ResultFiles({
  files, openFile, previewFile, selectedPath,
}: {
  files: readonly PreparedResultFile[]
  openFile: (path: string) => void
  previewFile: (path: string) => void
  selectedPath?: string | undefined
}) {
  if (files.length === 0) return <div className={css.resultEmpty}>
    <FolderOpen size={30}/>
    <h3>还没有可打开的产物</h3>
    <p>只有成功写入或修改并由工具报告位置的文件才会显示在这里。</p>
  </div>
  return <section className={css.files} aria-label="本对话生成的文件">
    {files.map(file => <div key={file.sourcePath} data-selected={selectedPath === file.path || undefined}>
      <button
        type="button"
        disabled={file.status === 'unavailable'}
        onClick={() => { previewFile(file.path) }}
        aria-label={file.status === 'unavailable' ? `${file.name} 产物不可用` : `预览 ${file.name}`}
      >
        <ProducedFileIcon path={file.path}/>
        <span>
          <b>{file.name}</b>
          <small title={resultFileLocation(file)}>{resultFileLocation(file)}</small>
        </span>
      </button>
      <button
        type="button"
        disabled={file.status === 'unavailable'}
        onClick={() => { openFile(file.path) }}
        aria-label={`在 IDE 中打开 ${file.name}`}
      >
        <ArrowSquareOut aria-hidden="true"/>
      </button>
    </div>)}
  </section>
}

function ResultFileNavigator({
  files, selectedPath, select, mode = 'files',
}: {
  files: readonly PreparedResultFile[]
  selectedPath?: string | undefined
  select: (path: string) => void
  mode?: 'files' | 'changes'
}) {
  const sections = mode === 'changes'
    ? [{ id: 'changes', label: '新增', files }]
    : RESULT_FILE_GROUPS.map(group => ({
      id: group.id,
      label: group.label,
      files: files.filter(file => resultFileGroup(file.path) === group.id),
    }))
  return <nav className={css.resultFileNavigator} aria-label={mode === 'changes' ? '文件变更导航' : '工作空间文件导航'}>
    <header><strong>{mode === 'changes' ? '文件变更' : '工作空间文件'}</strong><span>{files.length}</span></header>
    {sections.map((section) => {
      if (section.files.length === 0) return null
      return <section key={section.id}>
        <h3>{section.label}<span>{section.files.length}</span></h3>
        {section.files.map(file => <button
          key={file.sourcePath}
          type="button"
          disabled={file.status === 'unavailable'}
          className={selectedPath === file.path ? css.selected : undefined}
          aria-current={selectedPath === file.path ? 'page' : undefined}
          aria-label={file.status === 'unavailable' ? `${file.name} 产物不可用` : undefined}
          title={resultFileLocation(file)}
          onClick={() => { select(file.path) }}
        >
          <ProducedFileIcon path={file.path}/>
          <span>
            <b>{file.name}</b>
            <small>{mode === 'changes'
              ? `新增 · ${file.status === 'ready' ? file.path : resultFileLocation(file)}`
              : file.status === 'ready' ? file.path : resultFileLocation(file)}</small>
          </span>
        </button>)}
      </section>
    })}
  </nav>
}

function ResultOpenTabs({
  paths, selectedPath, select, close,
}: {
  paths: readonly string[]
  selectedPath?: string | undefined
  select: (path: string) => void
  close: (path: string) => void
}) {
  return <div className={css.resultOpenTabs} role="tablist" aria-label="已打开的产物">
    {paths.map(path => <div key={path} className={selectedPath === path ? css.selected : undefined}>
      <button
        type="button"
        role="tab"
        aria-selected={selectedPath === path}
        title={path}
        onClick={() => { select(path) }}
      >
        <ProducedFileIcon path={path}/>
        <span>{resultFileName(path)}</span>
      </button>
      <button type="button" aria-label={`关闭 ${resultFileName(path)} 标签`} onClick={() => { close(path) }}><X/></button>
    </div>)}
  </div>
}


function resultPreviewHostBase(): string {
  const origin = (globalThis as { location?: { origin?: string } }).location?.origin
  return origin !== undefined && origin !== 'null' ? origin : 'http://quantskills.internal'
}

type ResultPreviewState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading'; readonly path: string }
  | { readonly status: 'ready'; readonly value: QuantSkillsResultPreview }
  | { readonly status: 'error'; readonly path: string }

function ResultTablePreview({ text, extension }: { text: string; extension: 'csv' | 'tsv' }) {
  const [search, setSearch] = useState('')
  const rows = useMemo(() => extension === 'tsv' ? tsvParseRows(text) : csvParseRows(text), [extension, text])
  const headers = rows[0] ?? []
  const query = search.trim().toLocaleLowerCase()
  const visibleRows = rows.slice(1).filter(row => query === ''
    || row.some(cell => cell.toLocaleLowerCase().includes(query)))
  return <div className={css.resultTablePreview}>
    <div className={css.resultTableToolbar}>
      <label><MagnifyingGlass/><input
        aria-label="搜索表格"
        value={search}
        placeholder="搜索当前表格"
        onChange={(event) => { setSearch(event.currentTarget.value) }}
      /></label>
      <span>{visibleRows.length.toLocaleString('zh-CN')} 行</span>
    </div>
    {headers.length === 0
      ? <div className={css.resultEmpty}><Database size={30}/><h3>表格没有可显示的数据</h3></div>
      : <div className={css.resultTableScroll}><table>
        <thead><tr>{headers.map((header, index) => <th key={`${header}-${String(index)}`}>{header || `列 ${String(index + 1)}`}</th>)}</tr></thead>
        <tbody>{visibleRows.map((row, rowIndex) => <tr key={String(rowIndex)}>
          {headers.map((_, columnIndex) => <td key={String(columnIndex)}>{row[columnIndex] ?? ''}</td>)}
        </tr>)}</tbody>
      </table></div>}
  </div>
}

function ResultPreview({
  state, openFile, selectPath, refresh, titleRef, mode = 'file', goBack, goForward, revealFile, saveFileAs,
}: {
  state: ResultPreviewState
  openFile: (path: string) => void
  selectPath: (path: string) => void
  refresh: (path: string) => void
  titleRef: RefObject<HTMLHeadingElement>
  mode?: 'file' | 'browser' | 'changes'
  goBack?: (() => void) | undefined
  goForward?: (() => void) | undefined
  revealFile?: ((path: string) => void) | undefined
  saveFileAs?: ((path: string) => void) | undefined
}) {
  if (state.status === 'idle') return <section className={css.resultPreview}>
    <div className={css.resultEmpty}><FileText size={30}/><h3>选择一个产物开始预览</h3></div>
  </section>
  if (state.status === 'loading') return <section className={css.resultPreview} aria-live="polite">
    <h3 ref={titleRef} tabIndex={-1}>{state.path}</h3><p>正在从当前会话工作区读取预览…</p>
  </section>
  if (state.status === 'error') return <section className={css.resultPreview} role="alert">
    <h3 ref={titleRef} tabIndex={-1}>{state.path}</h3><p>宿主无法读取这个文件的预览。</p>
    <button type="button" onClick={() => { openFile(state.path) }}>使用系统应用完整打开</button>
  </section>
  const preview = state.value
  const extension = resultExtension(preview.path)
  const language = extension === 'yml' ? 'yaml' : extension
  const typeLabel = preview.kind === 'document'
    ? '文档阅读模式'
    : preview.kind === 'directory'
      ? '文件夹'
      : preview.kind === 'resource'
        ? preview.presentation === 'external' ? '本地文件' : '完整查看'
        : preview.kind === 'binary'
          ? preview.mediaType === 'application/pdf' ? 'PDF' : '图片'
          : preview.kind === 'unsupported'
            ? '不可预览'
            : preview.mediaType === 'text/markdown'
              ? 'Markdown'
              : preview.mediaType === 'text/html'
                ? 'HTML'
                : ['csv', 'tsv'].includes(extension)
                  ? '表格文本'
                  : isCodeResultPath(preview.path) || extension === 'json'
                    ? '代码'
                    : '文本'
  return <section className={css.resultPreview} aria-label={`${preview.path} 预览`}>
    <header className={mode === 'browser' ? css.resultBrowserToolbar : undefined}>
      {mode === 'browser' && <div className={css.resultBrowserHistory}>
        <button type="button" disabled={goBack === undefined} aria-label="后退" onClick={goBack}><ArrowLeft/></button>
        <button type="button" disabled={goForward === undefined} aria-label="前进" onClick={goForward}><ArrowRight/></button>
      </div>}
      <div className={mode === 'browser' ? css.resultBrowserAddress : undefined}>
        {mode === 'browser' && <Globe aria-hidden="true"/>}
        <h3 ref={titleRef} tabIndex={-1}>{preview.path}</h3>
        {mode !== 'browser' && <small>{mode === 'changes' ? '新增文件' : typeLabel} · {preview.bytes.toLocaleString('zh-CN')} 字节</small>}
      </div>
      <button
        type="button"
        className={css.resultPreviewRefresh}
        onClick={() => { refresh(preview.path) }}
        aria-label={`刷新当前产物 ${preview.path}`}
        title="刷新当前产物"
      ><ArrowClockwise/></button>
      {mode === 'browser' && revealFile !== undefined && <button
        type="button"
        className={css.resultPreviewRefresh}
        onClick={() => { revealFile(preview.path) }}
        aria-label={`在文件夹中显示 ${preview.path}`}
        title="在文件夹中显示"
      ><FolderOpen/></button>}
      {mode === 'browser' && saveFileAs !== undefined && <button
        type="button"
        className={css.resultPreviewRefresh}
        onClick={() => { saveFileAs(preview.path) }}
        aria-label={`另存为 ${preview.path}`}
        title="另存为"
      ><FloppyDisk/></button>}
      <button
        type="button"
        className={mode === 'browser' ? css.resultPreviewRefresh : undefined}
        onClick={() => { openFile(preview.path) }}
        aria-label={`使用系统应用完整打开 ${preview.path}`}
        title="使用系统应用完整打开"
      ><ArrowSquareOut/>{mode === 'browser' ? null : '完整打开'}</button>
    </header>
    <div className={css.resultPreviewCanvas} data-kind={preview.kind}>
      {preview.kind === 'text' && preview.mediaType === 'text/markdown'
        ? <div className={css.resultMarkdown}><MarkdownText text={preview.text} labels={MARKDOWN_LABELS}/></div>
        : preview.kind === 'text' && preview.mediaType === 'text/html'
          ? <InteractiveHtml
            className={css.resultHtmlPreview}
            title={`${preview.path} HTML 预览`}
            source={preview.text}
          />
          : preview.kind === 'text' && (extension === 'csv' || extension === 'tsv')
            ? <ResultTablePreview text={preview.text} extension={extension}/>
            : preview.kind === 'text' && (isCodeResultPath(preview.path) || extension === 'json')
              ? <CodeBlock
                className={css.resultCodePreview}
                code={preview.text}
                lang={language}
                copyLabel="复制"
                copiedLabel="已复制"
              />
              : preview.kind === 'text'
                ? <pre className={css.resultPlainPreview}>{preview.text}</pre>
                : preview.kind === 'document'
                  ? <article className={css.resultDocumentPreview}>
                    {preview.truncated && <p role="status">内嵌阅读内容较长；可点击“完整打开”使用本机应用查看原文件。</p>}
                    <pre>{preview.text}</pre>
                  </article>
                  : preview.kind === 'directory'
                    ? preview.entries.length === 0
                      ? <div className={css.resultEmpty}><FolderOpen size={30}/><h3>此文件夹为空</h3></div>
                      : <div className={css.resultDirectoryList} role="list" aria-label={`${preview.path} 文件列表`}>
                        {preview.entries.map(entry => <button
                          key={entry.path}
                          type="button"
                          onClick={() => { selectPath(entry.path) }}
                        >
                          {entry.type === 'directory' ? <FolderOpen aria-hidden="true"/> : <FileText aria-hidden="true"/>}
                          <span><b>{entry.name}{entry.type === 'directory' ? '/' : ''}</b><small>{entry.type === 'directory' ? '文件夹' : entry.bytes === undefined ? '文件' : `${entry.bytes.toLocaleString('zh-CN')} 字节`}</small></span>
                          <ArrowRight aria-hidden="true"/>
                        </button>)}
                      </div>
                    : preview.kind === 'resource' && preview.presentation === 'image'
                      ? <ZoomableImage src={new URL(preview.url, resultPreviewHostBase()).toString()} alt={`${preview.path} 文件完整视图`}/>
                      : preview.kind === 'resource' && preview.presentation === 'pdf'
                        ? <PdfPreview title={`${preview.path} PDF 完整视图`} url={new URL(preview.url, resultPreviewHostBase()).toString()}/>
                        : preview.kind === 'resource' && preview.presentation === 'text'
                          ? <iframe sandbox="" title={`${preview.path} 文本完整视图`} src={new URL(preview.url, resultPreviewHostBase()).toString()}/>
                          : preview.kind === 'resource' && preview.presentation === 'audio'
                            ? <div className={css.resultMediaViewer}><audio controls src={new URL(preview.url, resultPreviewHostBase()).toString()}>当前浏览器无法播放此音频。</audio></div>
                            : preview.kind === 'resource' && preview.presentation === 'video'
                              ? <div className={css.resultMediaViewer}><video controls src={new URL(preview.url, resultPreviewHostBase()).toString()}>当前浏览器无法播放此视频。</video></div>
                              : preview.kind === 'resource'
                                ? <div className={css.resultEmpty}><FileText size={30}/><h3>使用本机应用完整查看</h3><p>此类型不由浏览器直接渲染，但文件没有大小限制，可交给系统默认应用打开。</p><button type="button" onClick={() => { openFile(preview.path) }}><ArrowSquareOut/>完整打开</button></div>
                  : preview.kind === 'binary' && preview.mediaType.startsWith('image/')
                    ? <ZoomableImage src={`data:${preview.mediaType};base64,${preview.data}`} alt={`${preview.path} 文件预览`}/>
                    : preview.kind === 'binary'
                      ? <iframe
                        title={`${preview.path} PDF 预览`}
                        src={preview.url === undefined
                          ? `data:${preview.mediaType};base64,${preview.data}`
                          : new URL(preview.url, resultPreviewHostBase()).toString()}
                      />
                      : <div className={css.resultEmpty}><FileText size={30}/><h3>暂不支持内嵌预览</h3><p>{preview.reason}</p></div>}
    </div>
  </section>
}

/** Current QuantSkills Session's real, read-only result workbench. */
export function QuantSkillsResultPanel({
  close, listFiles, prepareFiles, openFile, previewFile, revealFile, saveFileAs, continueWithResults,
  acknowledgePreviewFocus, triggerRef, docked, mode: panelMode, maximized, expand, toggleMaximized,
  useProjection, useSession, useChat, useSessions, useResultRequest, sessionId,
}: QuantSkillsResultProps) {
  const plain = useProjection('quantSkillsPlainSession')
  const binding = useProjection('quantSkillsSession')
  const agent = useProjection('quantSkillsAgentSession')
  const team = useProjection('quantSkillsAgentTeamSession')
  const teamMember = useProjection('quantSkillsAgentTeamMember')
  const snapshot = useChat(value => value)
  const hasOlderHistory = useSession(value => value.hasMore)
  const openState = useSession(value => value.openState)
  const running = useSession(value => value.running)
  const title = useSessions(state => state.byId[sessionId]?.displayTitle ?? state.byId[sessionId]?.title)
  const requestedPreview = useResultRequest((state) => {
    const request = state.resultPreviewRequest
    return request?.sessionId === sessionId
      ? `${String(request.sequence)}\u0000${request.path}\u0000${request.focusPending ? '1' : '0'}`
      : ''
  })
  const [tab, setTab] = useState<ResultTab>('files')
  const [fileNavigatorOpen, setFileNavigatorOpen] = useState(false)
  const [continueError, setContinueError] = useState(false)
  useEffect(() => { setFileNavigatorOpen(false) }, [sessionId, panelMode])
  const [railProgressOpen, setRailProgressOpen] = useState(true)
  const [railFilesOpen, setRailFilesOpen] = useState(true)
  const [openError, setOpenError] = useState(false)
  const [continueBusy, setContinueBusy] = useState(false)
  const [preview, setPreview] = useState<ResultPreviewState>({ status: 'idle' })
  const [selectedPath, setSelectedPath] = useState<string>()
  const [openPaths, setOpenPaths] = useState<readonly string[]>([])
  const [referencedPaths, setReferencedPaths] = useState<readonly string[]>([])
  const [preparation, setPreparation] = useState<ResultArtifactPreparationState>({ status: 'idle' })
  const previewRequest = useRef(0)
  const previewTitleRef = useRef<HTMLHeadingElement>(null)
  const preparationRequest = useRef(0)
  const previewedFilesKey = useRef<string>()
  const drawer = useDrawerBehavior(true, close, triggerRef, !docked)
  const result = useMemo(
    () => projectQuantSkillsResults(snapshot, hasOlderHistory),
    [hasOlderHistory, snapshot],
  )
  const [requestedSequenceText = '', requestedPath = '', requestedFocusText = '0'] = requestedPreview.split('\u0000')
  const requestedSequence = Number(requestedSequenceText)
  const requestedFocusPending = requestedFocusText === '1'
  const requestedSelection = requestedPath === '' ? '' : `${requestedSequenceText}\u0000${requestedPath}`
  const candidateFiles = useMemo(() => {
    const byPath = new Map(result.files.map(file => [file.path, file] as const))
    for (const path of [...referencedPaths, ...(requestedPath === '' ? [] : [requestedPath])]) {
      if (byPath.has(path)) continue
      byPath.set(path, { path, name: resultFileName(path) })
    }
    return [...byPath.values()]
  }, [referencedPaths, requestedPath, result.files])
  const candidateFilesKey = JSON.stringify(candidateFiles.map(file => [file.path, file.name]))
  const stableCandidates = useRef({ key: candidateFilesKey, files: candidateFiles })
  if (stableCandidates.current.key !== candidateFilesKey) {
    stableCandidates.current = { key: candidateFilesKey, files: candidateFiles }
  }
  const preparedCandidates = stableCandidates.current.files
  const preparationKey = `${sessionId}\u0001${candidateFilesKey}`
  useEffect(() => {
    const request = ++preparationRequest.current
    previewRequest.current++
    setOpenPaths([])
    setSelectedPath(undefined)
    setPreview({ status: 'idle' })
    const controller = new AbortController()
    setPreparation({ status: 'loading', key: preparationKey })
    const complete = listFiles(controller.signal)
    const current = preparedCandidates.length === 0
      ? Promise.resolve<readonly QuantSkillsPreparedResultArtifact[]>([])
      : prepareFiles(preparedCandidates.map(file => file.path), controller.signal)
    void Promise.allSettled([complete, current]).then(([completeResult, currentResult]) => {
      if (controller.signal.aborted || preparationRequest.current !== request) return
      const completeFiles = completeResult.status === 'fulfilled' ? completeResult.value : []
      const currentFiles = currentResult.status === 'fulfilled' ? currentResult.value : []
      const files = mergePreparedResultFiles(completeFiles, preparedCandidates, currentFiles)
      setPreparation({
        status: completeResult.status === 'rejected' || currentResult.status === 'rejected' ? 'error' : 'ready',
        key: preparationKey,
        files,
      })
    })
    return () => { controller.abort() }
  }, [listFiles, preparationKey, prepareFiles, preparedCandidates])
  const currentPreparation = preparation.status !== 'idle' && preparation.key === preparationKey
    ? preparation
    : candidateFiles.length === 0
      ? { status: 'ready' as const, key: preparationKey, files: [] }
      : { status: 'loading' as const, key: preparationKey }
  const files = currentPreparation.status === 'ready' || currentPreparation.status === 'error'
    ? currentPreparation.files
    : []
  const previewableFiles = files.filter(file => file.status !== 'unavailable')
  let ownerLabel: string
  let ownerVersion: string
  if (plain != null) {
    ownerLabel = plain.purpose === 'role-helper' ? 'QuantSkills 创作会话' : 'QuantSkills 普通会话'
    ownerVersion = '会话工作区产物'
  } else if (binding != null) {
    ownerLabel = String(binding.assetId)
    ownerVersion = String(binding.commit).slice(0, 7)
  } else if (agent != null) {
    ownerLabel = agent.name
    ownerVersion = `专家 修订 ${String(agent.revision)}`
  } else if (team != null) {
    ownerLabel = team.name
    ownerVersion = `专家团 修订 ${String(team.revision)}`
  } else if (teamMember != null) {
    ownerLabel = `${teamMember.agent.name} · ${teamMember.memberName}`
    ownerVersion = `专家团 修订 ${String(teamMember.teamRevision)}`
  } else {
    return null
  }

  const open = (path: string): void => {
    setOpenError(false)
    void openFile(path).catch(() => { setOpenError(true) })
  }
  const loadPreview = useCallback((path: string, target?: ResultTab): void => {
    const request = ++previewRequest.current
    setTab(target ?? (['html', 'htm'].includes(resultExtension(path)) ? 'browser' : 'files'))
    setOpenPaths(current => current.includes(path) ? current : [...current, path])
    setSelectedPath(path)
    setPreview({ status: 'loading', path })
    void previewFile(path).then(
      (value) => { if (previewRequest.current === request) setPreview({ status: 'ready', value }) },
      () => { if (previewRequest.current === request) setPreview({ status: 'error', path }) },
    )
  }, [previewFile])
  useEffect(() => {
    setReferencedPaths(current => current.length === 0 ? current : [])
  }, [sessionId])
  useEffect(() => {
    if (requestedPath === '') return
    setReferencedPaths(current => current.includes(requestedPath) ? current : [...current, requestedPath])
  }, [requestedPath])
  const resultFilesKey = files.map(file => file.path).join('\u0000')
  useEffect(() => {
    if (currentPreparation.status !== 'ready' && currentPreparation.status !== 'error') return
    const requestedFile = requestedPath === '' ? undefined : previewableFiles.find(file =>
      file.sourcePath === requestedPath || file.path === requestedPath)
    const signature = `${resultFilesKey}\u0001${requestedSelection}`
    if (previewedFilesKey.current === signature) return
    previewedFilesKey.current = signature
    // A failed explicit request must not silently open an unrelated artifact.
    const primary = requestedPath === '' ? primaryResultFile(previewableFiles) : requestedFile
    if (primary === undefined) {
      previewRequest.current++
      setOpenPaths([])
      setSelectedPath(undefined)
      setPreview(requestedPath === '' ? { status: 'idle' } : { status: 'error', path: requestedPath })
      setTab(requestedPath === '' ? 'overview' : 'files')
      return
    }
    setOpenPaths((current) => {
      const available = new Set(previewableFiles.map(file => file.path))
      const remaining = current.filter(path => available.has(path))
      return remaining.includes(primary.path) ? remaining : [...remaining, primary.path]
    })
    loadPreview(primary.path)
  }, [currentPreparation.status, loadPreview, previewableFiles, requestedPath, requestedSelection, resultFilesKey])
  const requestedPreparedPath = requestedPath === '' ? undefined : previewableFiles.find(file =>
    file.sourcePath === requestedPath || file.path === requestedPath)?.path
  const previewPath = preview.status === 'ready'
    ? preview.value.path
    : preview.status === 'error'
      ? preview.path
      : undefined
  useEffect(() => {
    if (!requestedFocusPending || !Number.isFinite(requestedSequence)) return
    if (requestedPreparedPath === undefined || previewPath !== requestedPreparedPath) return
    const title = previewTitleRef.current
    if (title === null) return
    title.focus()
    acknowledgePreviewFocus(requestedSequence)
  }, [acknowledgePreviewFocus, previewPath, requestedFocusPending, requestedPreparedPath, requestedSequence])
  const closePreviewTab = (path: string): void => {
    const index = openPaths.indexOf(path)
    if (index === -1) return
    const remaining = openPaths.filter(openPath => openPath !== path)
    setOpenPaths(remaining)
    if (selectedPath !== path) return
    const nextPath = remaining[Math.min(index, remaining.length - 1)]
    if (nextPath !== undefined) loadPreview(nextPath, tab === 'changes' ? 'changes' : undefined)
    else {
      previewRequest.current++
      setSelectedPath(undefined)
      setPreview({ status: 'idle' })
      setTab(files.length === 0 ? 'overview' : 'files')
    }
  }
  const navigate = (next: ResultTab): void => {
    if (next === 'browser') {
      const html = previewableFiles.find(file => ['html', 'htm'].includes(resultExtension(file.path)))
      if (html !== undefined && (selectedPath !== html.path || preview.status === 'idle')) loadPreview(html.path, 'browser')
      else setTab('browser')
      return
    }
    setTab(next)
  }
  const panelTitle = title ?? ownerLabel
  const htmlFiles = previewableFiles.filter(file => ['html', 'htm'].includes(resultExtension(file.path)))
  const preparedFileCount = currentPreparation.status === 'loading' ? candidateFiles.length : files.length
  const selectedHtmlIndex = selectedPath === undefined
    ? -1
    : htmlFiles.findIndex(file => file.path === selectedPath)
  const browserBack = selectedHtmlIndex > 0
    ? () => { loadPreview(htmlFiles[selectedHtmlIndex - 1]?.path ?? '', 'browser') }
    : undefined
  const browserForward = selectedHtmlIndex >= 0 && selectedHtmlIndex < htmlFiles.length - 1
    ? () => { loadPreview(htmlFiles[selectedHtmlIndex + 1]?.path ?? '', 'browser') }
    : undefined
  const expandTo = (next: ResultTab): void => {
    navigate(next)
    expand?.()
  }

  if (panelMode === 'rail') return <aside className={css.resultRail} aria-label="对话进度与交付物">
    <header className={css.resultRailHeader}>
      <button type="button" className={css.resultRailOwner} onClick={() => { expandTo('overview') }} title={panelTitle}>
        <CapabilityIcon kind="agent" aria-hidden="true"/>
        <span>{panelTitle}</span>
        <CaretDown aria-hidden="true"/>
      </button>
      <span className={css.resultRailTools}>
        <button type="button" aria-label="打开浏览器" title="浏览器" onClick={() => { expandTo('browser') }}><Globe/></button>
        <button type="button" aria-label="打开工作空间文件" title="工作空间文件" onClick={() => { expandTo('files') }}><FolderOpen/></button>
        <button type="button" aria-label="展开结果工作台" title="展开结果工作台" onClick={() => { expand?.() }}><X/></button>
      </span>
    </header>
    <div className={css.resultRailBody}>
      <section className={css.resultRailSection}>
        <button type="button" aria-expanded={railProgressOpen} onClick={() => { setRailProgressOpen(current => !current) }}>
          <span>进度</span><CaretDown aria-hidden="true"/>
        </button>
        {railProgressOpen && <div className={css.resultRailProgress}>
          <span className={clsx(css.statusDot, running ? css.running : css.completed)} aria-hidden="true"/>
          <span>
            <b>{running ? '任务进行中' : result.turnCount > 0 ? '当前任务已完成' : '等待任务开始'}</b>
            <small>{running ? '完成后会自动更新交付物' : `${String(result.turnCount)} 轮对话已汇总`}</small>
          </span>
        </div>}
      </section>
      <section className={css.resultRailSection}>
        <button type="button" aria-expanded={railFilesOpen} onClick={() => { setRailFilesOpen(current => !current) }}>
          <span>交付物 <small>{preparedFileCount}</small></span><CaretDown aria-hidden="true"/>
        </button>
        {railFilesOpen && <div className={css.resultRailFiles}>
          {currentPreparation.status === 'loading'
            ? <p>正在同步当前对话的文件…</p>
            : previewableFiles.length === 0
              ? <p>生成完成后，文件会显示在这里。</p>
              : previewableFiles.slice(0, 8).map(file => <button
                key={file.path}
                type="button"
                title={file.path}
                onClick={() => {
                  loadPreview(file.path, ['html', 'htm'].includes(resultExtension(file.path)) ? 'browser' : 'files')
                  expand?.()
                }}
              ><ProducedFileIcon path={file.path}/><span>{file.name}</span></button>)}
          {previewableFiles.length > 8 && <button type="button" className={css.resultRailMore} onClick={() => { expandTo('files') }}>
            查看其余 {previewableFiles.length - 8} 个文件
          </button>}
        </div>}
      </section>
    </div>
  </aside>

  return <aside
    id={drawer.panelId}
    className={css.resultPanel}
    role={drawer.overlay ? 'dialog' : 'region'}
    aria-modal={drawer.overlay ? true : undefined}
    aria-labelledby={drawer.labelId}
    aria-describedby={`${drawer.labelId}-context`}
    data-overlay={drawer.overlay || undefined}
    data-docked={docked || undefined}
  >
    <h2 id={drawer.labelId} className={css.resultPanelLabel} aria-label="结果工作台">
      结果工作台：{panelTitle}
    </h2>
    <p id={`${drawer.labelId}-context`} className={css.resultPanelLabel}>
      {ownerLabel} · {ownerVersion} · 本对话
    </p>
    <header className={css.resultWorkbenchHeader}>
      {openPaths.length > 0
        ? <ResultOpenTabs paths={openPaths} selectedPath={selectedPath} select={loadPreview} close={closePreviewTab}/>
        : <div className={css.resultWorkbenchTitle}>
          <strong>{RESULT_TABS.find(item => item.id === tab)?.label ?? '概览'}</strong>
          <small>{panelTitle}</small>
        </div>}
      <span className={css.resultWindowActions}>
        <button type="button" aria-label={fileNavigatorOpen ? '隐藏工作空间文件导航' : '显示工作空间文件导航'}
          title={fileNavigatorOpen ? '隐藏工作空间文件导航' : '显示工作空间文件导航'}
          aria-expanded={fileNavigatorOpen} disabled={tab !== 'files' && tab !== 'changes'}
          onClick={() => { setFileNavigatorOpen(current => !current) }}><List/></button>
        <button type="button" aria-label="浏览当前工作区" title="浏览当前工作区" onClick={() => { loadPreview('.', 'files') }}><House/></button>
        <details className={css.resultMoreActions}>
          <summary aria-label="更多产物操作与说明" title="更多产物操作与说明"><DotsThreeVertical/></summary>
          <div>
        <button type="button" aria-label="打开产物目录" title="打开产物目录"
          disabled={previewableFiles.length === 0} onClick={() => {
            const current = previewableFiles.find(file => file.path === selectedPath) ?? previewableFiles[0]
            if (current === undefined) return
            const normalized = current.path.replaceAll('\\', '/')
            const slash = normalized.lastIndexOf('/')
            loadPreview(slash > 0 ? normalized.slice(0, slash) : '.', 'files')
          }}>打开产物目录</button>
        <button type="button" aria-label="携带产物到新会话" title="携带当前会话已确认的产物到新会话"
          disabled={previewableFiles.length === 0 || continueBusy} onClick={() => {
            setContinueBusy(true)
            setContinueError(false)
            void continueWithResults(previewableFiles.map(file => file.path))
              .catch(() => { setContinueError(true) }).finally(() => { setContinueBusy(false) })
          }}>携带产物到新会话</button>

            {revealFile !== undefined && <button type="button" disabled={selectedPath === undefined}
              onClick={() => { if (selectedPath) void revealFile(selectedPath).catch(() => { setOpenError(true) }) }}>在文件夹中显示</button>}
            {saveFileAs !== undefined && <button type="button" disabled={selectedPath === undefined}
              onClick={() => { if (selectedPath) void saveFileAs(selectedPath).catch(() => { setOpenError(true) }) }}>另存为</button>}
            <p>显示当前对话写入或明确交付的产物；预览时由 Host 验证，其他并行会话互不混入。</p>
          </div>
        </details>
        <button
          type="button"
          aria-label={maximized ? '退出全屏结果工作台' : '全屏显示结果工作台'}
          title={maximized ? '退出全屏' : '全屏显示'}
          onClick={toggleMaximized}
        >{maximized ? <ArrowsInSimple/> : <ArrowsOutSimple/>}</button>
        <button
          ref={drawer.closeButtonRef}
          type="button"
          aria-label="收起结果工作台"
          title="收起到进度与交付物栏"
          onClick={drawer.close}
        ><X/></button>
      </span>
    </header>
    <nav className={css.resultSegments} aria-label="文件与预览分类">
      {RESULT_TABS.map(item => <button key={item.id} type="button" aria-pressed={tab === item.id}
        onClick={() => { navigate(item.id) }}>{item.label}{item.id === 'files' && preparedFileCount > 0 ? ' · ' + preparedFileCount : ''}</button>)}
    </nav>
    <div className={css.resultWorkbenchShell}>
      <div className={clsx(
        css.resultBody,
        (tab === 'files' || tab === 'browser' || tab === 'changes') && css.resultWorkspaceBody,
      )} role="tabpanel" aria-label={RESULT_TABS.find(item => item.id === tab)?.label}>
        {openState === 'cold' || openState === 'loading'
          ? <div className={css.resultEmpty}><Clock size={30}/><h3>正在读取会话记录</h3></div>
          : openState === 'error'
            ? <div className={css.resultEmpty}><Circle size={30}/><h3>会话记录暂时无法读取</h3></div>
            : currentPreparation.status === 'loading'
              ? <div className={css.resultEmpty} aria-live="polite">
                <Clock size={30}/><h3>正在准备工作台</h3><p>正在校验当前会话的文件。</p>
              </div>
              : tab === 'overview'
                ? <>
                  <div className={css.resultOverviewHeader}>
                    <span><FolderOpen weight="duotone"/></span>
                    <div><h3>这次对话的产物</h3><p>报告、图表与文件，集中在这里。</p></div>
                  </div>
                  {running && <p className={css.resultRunning}><Clock/>研究仍在进行，文件完成后会自动出现在这里。</p>}
                  {files.length > 0 && <h3>最近文件</h3>}
                  {files.length > 0 && <ResultFiles files={files.slice(0, 4)} openFile={open} selectedPath={selectedPath} previewFile={loadPreview}/>}
                  {files.length > 4 && <button className={css.resultInlineLink} onClick={() => { navigate('files') }}>
                    查看全部 {files.length} 个文件
                  </button>}
                  {files.length === 0 && <div className={css.resultEmpty}><FolderOpen size={40} weight="duotone"/>
                    <h3>等待第一份产物</h3><p>让专家生成一份报告或图表，完成后即可在这里查看。</p>
                    <button type="button" className={css.outlineButton} onClick={() => { loadPreview('.', 'files') }}>浏览工作区</button>
                  </div>}
                </>
                : tab === 'files'
                  ? files.length === 0 && preview.status === 'idle'
                    ? <div className={css.resultEmpty}><FolderOpen size={36} weight="duotone"/><h3>文件会出现在这里</h3><p>也可以先浏览你的工作区。</p><button type="button" className={css.outlineButton} onClick={() => { loadPreview('.', 'files') }}>浏览工作区</button></div>
                    : <div className={css.resultWorkbench} data-files-hidden={!fileNavigatorOpen || undefined}>
                      {fileNavigatorOpen && <ResultFileNavigator files={files} selectedPath={selectedPath} select={path => { loadPreview(path, 'files') }}/>}
                      <section className={css.resultWorkspace} aria-label="工作空间文件预览">
                        {currentPreparation.status === 'error' && <p className={css.resultWarning} role="alert">
                          部分文件未通过工作区校验，当前不可预览。
                        </p>}
                        <ResultPreview state={preview} openFile={open} selectPath={path => { loadPreview(path, 'files') }} refresh={path => { loadPreview(path, 'files') }} titleRef={previewTitleRef}/>
                      </section>
                    </div>
                  : tab === 'browser'
                    ? htmlFiles.length === 0
                      ? <div className={css.resultEmpty}><Globe size={30}/><h3>还没有可浏览页面</h3><p>会话生成 HTML 页面后，可在这里安全预览。</p></div>
                      : <section className={css.resultBrowserWorkspace} aria-label="浏览器预览">
                        <ResultPreview
                          state={preview}
                          openFile={open}
                          selectPath={path => { loadPreview(path, 'browser') }}
                          refresh={path => { loadPreview(path, 'browser') }}
                          titleRef={previewTitleRef}
                          mode="browser"
                          goBack={browserBack}
                          goForward={browserForward}
                          revealFile={revealFile === undefined ? undefined : path => { void revealFile(path) }}
                          saveFileAs={saveFileAs === undefined ? undefined : path => { void saveFileAs(path) }}
                        />
                      </section>
                    : files.length === 0
                      ? <div className={css.resultEmpty}><FileCode size={30}/><h3>还没有文件变更</h3><p>当前会话写入文件后，变更会集中显示在这里。</p></div>
                      : <div className={css.resultWorkbench} data-files-hidden={!fileNavigatorOpen || undefined}>
                        {fileNavigatorOpen && <ResultFileNavigator files={files} selectedPath={selectedPath} select={path => { loadPreview(path, 'changes') }} mode="changes"/>}
                        <section className={css.resultWorkspace} aria-label="文件变更预览">
                          <ResultPreview state={preview} openFile={open} selectPath={path => { loadPreview(path, 'changes') }} refresh={path => { loadPreview(path, 'changes') }} titleRef={previewTitleRef} mode="changes"/>
                        </section>
                      </div>}
        {result.hasOlderHistory && tab === 'overview' && <p className={css.resultHint}>加载更早消息后，概览会继续更新。</p>}
        {openError && <p className={css.resultWarning} role="alert">无法使用宿主应用打开该路径，请确认文件仍然存在。</p>}
        {continueError && <p className={css.resultWarning} role="alert">创建新会话失败，产物仍保留在当前会话，请重试。</p>}
      </div>
    </div>
  </aside>
}
