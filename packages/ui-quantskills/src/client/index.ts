import { createElement, type ComponentType } from 'react'
import { artifactDownload } from './artifact-resource.ts'
import { retryHostRead } from './remote-read.ts'
import { FinalDeliverables } from './FinalDeliverables.tsx'
/** QuantSkills browser application assembled over the existing DSH layout, sessions, and conversation services. */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import { QuantSkillsPreferences, type PreferencesSnapshot } from './preferences.ts'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { resolveWorkspacePath } from '@deepseek-ai/dsh-util-workspace-path'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-quantskills-host/remote'
import type {} from '@deepseek-ai/dsh-quantskills-session/remote'
import type {} from '@deepseek-ai/dsh-panda-mcp/remote'
import type {
  QuantSkillsCatalogSnapshot as HostCatalogSnapshot,
  QuantSkillsAgentCreateRequest, QuantSkillsAgentDefinition, QuantSkillsAgentDeleteRequest,
  QuantSkillsAgentSessionBinding, QuantSkillsAgentSessionCreateRequest,
  QuantSkillsAgentSessionCreateResult, QuantSkillsAgentUpdateRequest,
  QuantSkillsAgentTeamCreateRequest, QuantSkillsAgentTeamDefinition, QuantSkillsAgentTeamDeleteRequest,
  QuantSkillsAgentTeamSessionBinding, QuantSkillsAgentTeamSessionCreateRequest,
  QuantSkillsAgentTeamSessionCreateResult, QuantSkillsAgentTeamUpdateRequest,
  QuantSkillsAssetReadme,
  QuantSkillsInstalledAgentTemplate,
  QuantSkillsPromptFormListResult,
  QuantSkillsPromptFormRenderResult,
  QuantSkillsResidentSkillResult,
  QuantSkillsResultPrepareResult,
  QuantSkillsResultPreview,
  QuantSkillsSessionFileAttachment,
  QuantSkillsInstallRequest as HostInstallRequest, QuantSkillsInstalledSnapshot as HostInstalledSnapshot,
  QuantSkillsInstalledVersion as HostInstalledVersion, QuantSkillsInstalledVersionId,
  QuantSkillsSessionBinding, QuantSkillsSessionCreateRequest, QuantSkillsSessionCreateResult,
  QuantSkillsPlainSessionCreateResult,
  QuantSkillsWorkspaceResolveResult, QuantSkillsWorkspaceStatusResult, WorkspaceId,
  QuantSkillsAuthoringCommitResult,
  QuantSkillsTreeDigest,
  QuantSkillsApplicationUpdateCheckRequest,
  PandaMcpStatus,
} from './plugin-types.ts'
import type { IConversation } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type {} from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type { InputTriggerServiceContract } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type { ILayout } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
import { QuantSkillsCatalogAutoChecker, QuantSkillsCatalogController } from './catalog.ts'
import { QuantSkillsSessionsController } from './sessions.ts'
import { QuantSkillsAgentsController } from './agents.ts'
import { findPresetExpert, presetRequest } from './expert-presets.ts'
import { saveTeamPresets } from './team-presets.ts'
import {
  QuantSkillsApp, QuantSkillsFrame, QuantSkillsPluginFrame, QuantSkillsPluginLauncher, QuantSkillsRail,
  QuantSkillsResultAction, QuantSkillsResultPanel,
  type QuantSkillsAgentRoleDraftRequest, type QuantSkillsAppInjected, type QuantSkillsFrameInjected,
  type QuantSkillsPluginFrameInjected, type QuantSkillsPluginLauncherInjected,
  type QuantSkillsRailInjected,
  type QuantSkillsResultActionInjected, type QuantSkillsResultInjected, type QuantSkillsTaskStartResult,
} from './QuantSkillsApp.tsx'
import { readArtifactTheme, subscribeArtifactTheme } from './artifact-theme.ts'
import {
  installQuantSkillsDocumentBrand, QuantSkillsBrandMark,
  QuantSkillsConversationHeroIdentity, QuantSkillsConversationStatus,
  type QuantSkillsConversationBrandInjected,
} from './QuantSkillsBrand.tsx'
import {
  createQuantSkillsLayoutStore, createQuantSkillsNotificationStore, createQuantSkillsViewStore,
} from './store.ts'
import { bindQuantSkillsResultMentionClicks } from './result-mention.ts'
import {
  buildSkillGuidePrompt, parseSkillGuideDecision, type QuantSkillsGuideDecision,
} from './task-recommendation.ts'
import { resultPreviewRank, type QuantSkillsPreparedResultArtifact } from './result-data.ts'
import type {
  ConversationTextScaleClaim, DetailsColumnClaim, DetailsColumnClaimOptions,
  SidebarColumnClaim, SidebarColumnClaimOptions,
} from './layout-contract.ts'

import type {
  QuantSkillsAgentModelOption, QuantSkillsAsset, QuantSkillsAuthoringKind, QuantSkillsInstalledVersion,
} from './types.ts'
import {
  QuantSkillsAttachmentControl, QuantSkillsAttachmentController,
  type QuantSkillsAttachmentControlInjected,
} from './QuantSkillsAttachmentControl.tsx'
import {
  QuantSkillsPandaMcpControl, QuantSkillsPandaMcpHeroControl, type QuantSkillsPandaMcpControlInjected,
} from './QuantSkillsPandaMcpControl.tsx'
import { ContestReview, type ContestReviewInjected } from './ContestReview.tsx'
import type { ContestAccess } from './contest.ts'
import { connectFlyTransport, type FlyAccess } from './fly/transport.ts'
import type { FactorContestAccess } from './factor-contest.ts'
import { FactorContestReview, type FactorReviewInjected } from './FactorContestReview.tsx'
import { AuthoringReview, type AuthoringReviewInjected } from './AuthoringReview.tsx'
import { SessionFavorite, type SessionFavoriteInjected } from './SessionFavorite.tsx'
import {
  QuantSkillsTeamDraftCard, type QuantSkillsTeamDraftCardInjected,
} from './QuantSkillsTeamDraftCard.tsx'
import { QuantSkillsGravityLaneModelSelect } from './QuantSkillsGravityLaneModelSelect.tsx'
import {
  QuantSkillsAssetDraftCard, type QuantSkillsAssetDraftCardInjected,
} from './QuantSkillsAssetDraftCard.tsx'
import {
  QuantSkillsCapabilityPicker, QuantSkillsCapabilityPickerController,
  QuantSkillsResidentControl, quantSkillsLauncherSource,
  type QuantSkillsCapabilityPickerInjected, type QuantSkillsResidentControlInjected,
} from './QuantSkillsCapabilityPicker.tsx'
import {
  QUANTSKILLS_APPEARANCE_SETTINGS_NAMESPACE,
  QUANTSKILLS_ASSET_DISPLAY_NAME_OVERRIDES_FIELD,
  QUANTSKILLS_AUTO_CHECK_CATALOG_FIELD, QUANTSKILLS_AUTO_CHECK_PANDA_FIELD,
  QUANTSKILLS_COLOR_SCHEME_FIELD, QUANTSKILLS_CONVERSATION_BRIGHTNESS_FIELD,
  QUANTSKILLS_CONVERSATION_SCALE_FIELD, QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY_FIELD,
  QUANTSKILLS_DARK_BACKGROUND_FIELD,
  QUANTSKILLS_INTERFACE_SCALE_FIELD,
  QUANTSKILLS_LIGHT_BACKGROUND_FIELD,
  QUANTSKILLS_DEFAULT_AGENT_MODEL_FIELD, QUANTSKILLS_DEFAULT_AGENT_PERMISSION_FIELD,
  QUANTSKILLS_DEFAULT_AGENT_PROVIDER_FIELD, QUANTSKILLS_DEFAULT_AGENT_REASONING_EFFORT_FIELD,
  QUANTSKILLS_DEFAULT_WORKSPACE_ID_FIELD,
  QUANTSKILLS_FAVORITE_ASSET_IDS_FIELD, QUANTSKILLS_RESUME_AFTER_PANDA_LOGIN_FIELD,
  type QuantSkillsSettings,
} from '../appearance-settings.ts'

export {
  createQuantSkillsLayoutStore, createQuantSkillsNotificationStore, createQuantSkillsViewStore,
} from './store.ts'
export type {
  PandaConnectionSnapshot, QuantSkillsAsset, QuantSkillsCatalogSnapshot, QuantSkillsInstalledVersion,
  QuantSkillsAgentsSnapshot, QuantSkillsCategory, QuantSkillsPage, QuantSkillsSessionsSnapshot,
} from './types.ts'

/** Services required by the QuantSkills application. */
export const inject = [
  'slots', 'sessions', 'workspaces', 'connection',
  'inputTriggers', 'modelDirectories',
  'settingsSchema', 'remote.settings',
  'remote', 'remote.commands', 'remote.session',
  'remote.quantSkills', 'remote.quantSkillsSessions', 'remote.pandaMcp',
]

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /** QuantSkills-owned non-conversation page surface. */
    'quantskills.page': { kind: 'single'; scope: 'root' }
    /** Additive result workbench for the currently bound QuantSkills Session. */
    'quantskills.results': { kind: 'single'; scope: 'session'; owner: { mode?: 'rail' | 'expanded'; maximized?: boolean; toggleMaximized?: () => void; expand?: () => void } }
  }
}

type LayoutActions = BoundActions<ReturnType<typeof createQuantSkillsLayoutStore>>

/** Composition selected by the package entry that mounts the shared QuantSkills application. */
export type QuantSkillsApplicationMode = 'standalone' | 'native-plugin'

/** Options for mounting the shared QuantSkills browser application. */
export interface QuantSkillsApplicationOptions {
  /** Standalone owns the root shell; native-plugin contributes to the stock DSH shell. */
  mode: QuantSkillsApplicationMode
}

/** Verify that the runtime's Host projection names the exact version returned by create. */
function isExactQuantSkillsBinding(
  actual: QuantSkillsSessionBinding,
  expected: QuantSkillsSessionBinding,
): boolean {
  return actual.assetId === expected.assetId
    && actual.versionId === expected.versionId
    && actual.commit === expected.commit
    && actual.treeDigest === expected.treeDigest
}

/** Verify that the runtime's Host projection names the exact version returned by create. */
function hasExactQuantSkillsBinding(
  summary: SessionSummary,
  expected: QuantSkillsSessionBinding,
): boolean {
  const actual = summary.projectionValues?.quantSkillsSession
  return actual !== undefined && actual !== null
    && isExactQuantSkillsBinding(actual, expected)
}

/** Verify that reconciliation recovered the immutable Agent snapshot returned by create. */
function hasExactQuantSkillsAgent(
  summary: SessionSummary,
  expected: QuantSkillsAgentSessionBinding,
): boolean {
  const actual = summary.projectionValues?.quantSkillsAgentSession
  return actual !== undefined && actual !== null
    && actual.agentId === expected.agentId
    && actual.revision === expected.revision
    && actual.name === expected.name
    && actual.role === expected.role
    && actual.mode === expected.mode
    && actual.permission === expected.permission
    && actual.sourceVersionId === expected.sourceVersionId
    && actual.model?.provider === expected.model?.provider
    && actual.model?.model === expected.model?.model
    && actual.model?.reasoningEffort === expected.model?.reasoningEffort
    && actual.createdAt === expected.createdAt
    && actual.updatedAt === expected.updatedAt
    && actual.skills.length === expected.skills.length
    && actual.skills.every((binding, index) => {
      const expectedBinding = expected.skills[index]
      return expectedBinding !== undefined && isExactQuantSkillsBinding(binding, expectedBinding)
    })
}

/** Verify that reconciliation recovered the complete immutable Agent Team snapshot. */
function hasExactQuantSkillsAgentTeam(
  summary: SessionSummary,
  expected: QuantSkillsAgentTeamSessionBinding,
): boolean {
  const actual = summary.projectionValues?.quantSkillsAgentTeamSession
  return actual !== undefined && actual !== null
    && actual.teamId === expected.teamId
    && actual.revision === expected.revision
    && actual.name === expected.name
    && actual.description === expected.description
    && hasSameAgentSnapshot(actual.lead, expected.lead)
    && actual.members.length === expected.members.length
    && actual.members.every((member, index) => {
      const expectedMember = expected.members[index]
      return expectedMember !== undefined
        && member.name === expectedMember.name
        && member.context === expectedMember.context
        && hasSameAgentSnapshot(member.agent, expectedMember.agent)
    })
}

function hasSameAgentSnapshot(
  actual: QuantSkillsAgentDefinition,
  expected: QuantSkillsAgentDefinition,
): boolean {
  return actual.agentId === expected.agentId
    && actual.revision === expected.revision
    && actual.name === expected.name
    && actual.role === expected.role
    && actual.mode === expected.mode
    && actual.permission === expected.permission
    && actual.sourceVersionId === expected.sourceVersionId
    && actual.model?.provider === expected.model?.provider
    && actual.model?.model === expected.model?.model
    && actual.model?.reasoningEffort === expected.model?.reasoningEffort
    && actual.createdAt === expected.createdAt
    && actual.updatedAt === expected.updatedAt
    && actual.skills.length === expected.skills.length
    && actual.skills.every((binding, index) => {
      const expectedBinding = expected.skills[index]
      return expectedBinding !== undefined && isExactQuantSkillsBinding(binding, expectedBinding)
    })
}

class QuantSkillsLayoutController implements ILayout {
  private actions: LayoutActions | undefined
  private readonly sidebarReservations = new Map<symbol, number>()
  private sidebarClaim: {
    readonly id: symbol
    width: number
    readonly onDisplaced: () => void
  } | undefined
  private readonly detailsReservations = new Map<symbol, number>()
  private detailsClaim: {
    readonly id: symbol
    width: number
    readonly onDisplaced: () => void
  } | undefined
  private conversationTextScaleClaim: { readonly id: symbol; scale: number } | undefined

  attach(actions: LayoutActions): void {
    this.actions = actions
    this.syncSidebarReservation()
    this.syncDetailsReservation()
    this.syncConversationTextScale()
  }
  toggleSidebar(): void {
    const claim = this.sidebarClaim
    if (claim !== undefined) {
      this.sidebarClaim = undefined
      this.syncSidebarReservation()
      claim.onDisplaced()
    }
    this.requireActions().toggleSidebar()
  }
  reserveSidebar(minimum: number): () => void {
    const id = Symbol('quantskills-layout-sidebar-reservation')
    this.sidebarReservations.set(id, Math.max(0, Math.round(minimum)))
    this.syncSidebarReservation()
    let active = true
    return () => {
      if (!active) return
      active = false
      this.sidebarReservations.delete(id)
      this.syncSidebarReservation()
    }
  }
  claimSidebar(options: SidebarColumnClaimOptions): SidebarColumnClaim {
    if (this.sidebarClaim !== undefined) {
      throw new Error('quantskills layout: the sidebar column already has an exclusive claim')
    }
    const id = Symbol('quantskills-layout-sidebar-claim')
    this.sidebarClaim = {
      id,
      width: Math.max(0, Math.round(options.width)),
      onDisplaced: options.onDisplaced,
    }
    this.syncSidebarReservation()
    let active = true
    return {
      update: (width) => {
        if (!active || this.sidebarClaim?.id !== id) return
        this.sidebarClaim.width = Math.max(0, Math.round(width))
        this.syncSidebarReservation()
      },
      setDragging: () => {},
      release: () => {
        if (!active) return
        active = false
        if (this.sidebarClaim?.id !== id) return
        this.sidebarClaim = undefined
        this.syncSidebarReservation()
      },
    }
  }
  reserveDetails(minimum: number): () => void {
    const id = Symbol('quantskills-layout-details-reservation')
    this.detailsReservations.set(id, Math.max(0, Math.round(minimum)))
    this.syncDetailsReservation()
    let active = true
    return () => {
      if (!active) return
      active = false
      this.detailsReservations.delete(id)
      this.syncDetailsReservation()
    }
  }
  claimDetails(options: DetailsColumnClaimOptions): DetailsColumnClaim {
    if (this.detailsClaim !== undefined) {
      throw new Error('quantskills layout: the details column already has an exclusive claim')
    }
    const id = Symbol('quantskills-layout-details-claim')
    this.detailsClaim = {
      id,
      width: Math.max(0, Math.round(options.width)),
      onDisplaced: options.onDisplaced,
    }
    this.syncDetailsReservation()
    let active = true
    return {
      update: (width) => {
        if (!active || this.detailsClaim?.id !== id) return
        this.detailsClaim.width = Math.max(0, Math.round(width))
        this.syncDetailsReservation()
      },
      setDragging: () => {},
      release: () => {
        if (!active) return
        active = false
        if (this.detailsClaim?.id !== id) return
        this.detailsClaim = undefined
        this.syncDetailsReservation()
      },
    }
  }
  claimConversationTextScale(scale: number): ConversationTextScaleClaim {
    if (this.conversationTextScaleClaim !== undefined) {
      throw new Error('quantskills layout: the conversation text scale already has an exclusive claim')
    }
    const id = Symbol('quantskills-layout-conversation-text-scale-claim')
    this.conversationTextScaleClaim = { id, scale }
    this.syncConversationTextScale()
    let active = true
    return {
      update: (nextScale) => {
        if (!active || this.conversationTextScaleClaim?.id !== id) return
        this.conversationTextScaleClaim.scale = nextScale
        this.syncConversationTextScale()
      },
      release: () => {
        if (!active) return
        active = false
        if (this.conversationTextScaleClaim?.id !== id) return
        this.conversationTextScaleClaim = undefined
        this.syncConversationTextScale()
      },
    }
  }
  openDetails(): void {
    const claim = this.detailsClaim
    if (claim !== undefined) {
      this.detailsClaim = undefined
      this.syncDetailsReservation()
      claim.onDisplaced()
    }
    this.requireActions().openDetails()
  }
  closeDetails(): void { this.requireActions().closeDetails() }
  openResults(): void { this.requireActions().openResults() }
  closeResults(): void { this.requireActions().closeResults() }

  private syncSidebarReservation(): void {
    if (this.actions === undefined) return
    this.actions.setSidebarReservation(this.sidebarClaim?.width ?? Math.max(0, ...this.sidebarReservations.values()))
  }

  private syncDetailsReservation(): void {
    if (this.actions === undefined) return
    this.actions.setDetailsReservation(Math.max(
      this.detailsClaim?.width ?? 0,
      ...this.detailsReservations.values(),
    ))
  }

  private syncConversationTextScale(): void {
    if (this.actions === undefined) return
    const claim = this.conversationTextScaleClaim
    this.actions.setConversationTextScale(claim?.scale ?? 1, claim !== undefined)
  }

  private requireActions(): LayoutActions {
    if (this.actions === undefined) throw new Error('QuantSkills layout is not mounted.')
    return this.actions
  }
}

/**
 * Mount the shared QuantSkills browser application in one explicit composition.
 * @param ctx - client root context.
 * @param options - standalone shell or additive native DSH plugin composition.
 */
export function mountQuantSkillsApplication(ctx: ClientContext, options: QuantSkillsApplicationOptions): void {
  const lifetime = new AbortController()
  ctx.effect(
    installQuantSkillsDocumentBrand,
    'ui-quantskills: own document and taskbar branding',
  )
  ctx.effect(
    () => () => { lifetime.abort() },
    'ui-quantskills: cancel in-flight Session creation on dispose',
  )
  class RemoteFailure extends Error {
    constructor(readonly code: string, message: string) {
      super(message)
      this.name = 'RemoteFailure'
    }
  }
  const unwrapRemote = async <T>(
    request: Promise<{ ok: true; value: T } | { ok: false; error: { code: string; message: string } }>,
  ): Promise<T> => {
    const response = await request
    if (!response.ok) throw new RemoteFailure(response.error.code, response.error.message)
    return response.value
  }
  const pandaMcp = Object.freeze({
    status: () => retryHostRead(() => unwrapRemote<PandaMcpStatus>(ctx.remote.pandaMcp.status())),
    authenticate: async () => {
      const status = await unwrapRemote<PandaMcpStatus>(ctx.remote.pandaMcp.authenticate())
      if (status.authorizationUrl) {
        const target = new URL(status.authorizationUrl)
        if (target.protocol !== 'https:' || target.origin !== new URL(status.url).origin) throw new Error('PandaData 授权地址不可信。')
        window.location.assign(target.href)
      }
      return status
    },
    refresh: () => unwrapRemote<PandaMcpStatus>(ctx.remote.pandaMcp.refresh()),
    logout: () => unwrapRemote<PandaMcpStatus>(ctx.remote.pandaMcp.logout()),
  })
  const preparedResultArtifacts = (
    prepared: QuantSkillsResultPrepareResult,
  ): readonly QuantSkillsPreparedResultArtifact[] => prepared.results.map(result => result.status === 'ready'
    ? {
      sourcePath: result.inputPath,
      path: result.path,
      status: result.archived ? 'archived' : 'ready',
    }
    : {
      sourcePath: result.inputPath,
      path: result.inputPath,
      status: 'unavailable',
      reason: result.reason,
    })
  const catalog = new QuantSkillsCatalogController({
    uninstall: assetId => unwrapRemote(ctx.remote.quantSkills.uninstallAsset({ assetId })),
    catalog: signal => unwrapRemote<HostCatalogSnapshot>(ctx.remote.quantSkills.catalog(signal)),
    list: signal => unwrapRemote<HostInstalledSnapshot>(ctx.remote.quantSkills.list(signal)),
    install: (request: HostInstallRequest, signal?: AbortSignal) => unwrapRemote<HostInstalledVersion>(
      ctx.remote.quantSkills.installAsset(request, signal),
    ),
  })
  const readmeCache = new Map<string, QuantSkillsAssetReadme>()
  const readAssetReadme = async (
    asset: QuantSkillsAsset,
    callerSignal?: AbortSignal,
  ): Promise<QuantSkillsAssetReadme> => {
    const current = catalog.source.getSnapshot()
    const installed = current.versionsByAsset[asset.name]?.find(version => version.commitSha === asset.commitSha && version.projectType === 'skill')
    if (installed) {
      const markdown = await unwrapRemote<string>(ctx.remote.quantSkills.manualSkillRead(installed.versionId as QuantSkillsInstalledVersionId, callerSignal))
      return { assetId: asset.name as QuantSkillsAssetReadme['assetId'], commit: asset.commitSha as QuantSkillsAssetReadme['commit'], path: 'SKILL.md', markdown }
    }
    if (current.phase !== 'ready' || current.snapshotId === undefined) {
      throw new Error('QuantSkills：宿主目录尚未就绪，无法读取 README。')
    }
    const approved = current.assets.find(candidate => candidate.name === asset.name)
    if (approved === undefined || approved.commitSha !== asset.commitSha) {
      throw new Error('QuantSkills：技能 目录版本已变化，请刷新后重试。')
    }
    const key = `${asset.name}@${asset.commitSha}`
    const cached = readmeCache.get(key)
    if (cached !== undefined) return cached
    const signal = callerSignal === undefined
      ? lifetime.signal
      : AbortSignal.any([lifetime.signal, callerSignal])
    const result = await unwrapRemote<QuantSkillsAssetReadme>(ctx.remote.quantSkills.assetReadme({
      assetId: asset.name as Parameters<typeof ctx.remote.quantSkills.assetReadme>[0]['assetId'],
      observedSnapshotId: current.snapshotId as Parameters<typeof ctx.remote.quantSkills.assetReadme>[0]['observedSnapshotId'],
      observedCommit: asset.commitSha as Parameters<typeof ctx.remote.quantSkills.assetReadme>[0]['observedCommit'],
    }, signal))
    readmeCache.set(key, result)
    return result
  }
  const catalogAutoChecker = new QuantSkillsCatalogAutoChecker(catalog, window)
  const applyCatalogSyncStatus = (status: Parameters<typeof catalog.acceptSyncStatus>[0]): void => {
    catalog.acceptSyncStatus(status)
    catalogAutoChecker.setEventStreamConnected(status.mode === 'event-stream' && status.state === 'connected')
  }
  void unwrapRemote(ctx.remote.quantSkills.catalogSyncStatus()).then(applyCatalogSyncStatus, () => undefined)
  const boundSessions = new QuantSkillsSessionsController({
    plainList: signal => unwrapRemote(ctx.remote.quantSkillsSessions.plainSessionList({}, signal)),
    list: signal => unwrapRemote(ctx.remote.quantSkillsSessions.list({}, signal)),
    frequent: signal => unwrapRemote(ctx.remote.quantSkillsSessions.frequent({}, signal)),
    create: (request: QuantSkillsSessionCreateRequest, signal?: AbortSignal) => unwrapRemote<QuantSkillsSessionCreateResult>(
      ctx.remote.quantSkillsSessions.create(request, signal),
    ),
  })
  const agents = new QuantSkillsAgentsController({
    sources: () => unwrapRemote(ctx.remote.quantSkillsSessions.agentLibrarySources()),
    list: () => unwrapRemote(ctx.remote.quantSkillsSessions.agentList()),
    sessions: () => unwrapRemote(ctx.remote.quantSkillsSessions.agentSessionList({})),
    create: (request: QuantSkillsAgentCreateRequest) => unwrapRemote(
      ctx.remote.quantSkillsSessions.agentCreate(request),
    ),
    update: (request: QuantSkillsAgentUpdateRequest) => unwrapRemote(
      ctx.remote.quantSkillsSessions.agentUpdate(request),
    ),
    delete: (request: QuantSkillsAgentDeleteRequest) => unwrapRemote(
      ctx.remote.quantSkillsSessions.agentDelete(request),
    ),
    start: (request: QuantSkillsAgentSessionCreateRequest) => unwrapRemote<QuantSkillsAgentSessionCreateResult>(
      ctx.remote.quantSkillsSessions.agentSessionCreate(request),
    ),
    teamList: () => unwrapRemote(ctx.remote.quantSkillsSessions.agentTeamList()),
    teamSessions: () => unwrapRemote(ctx.remote.quantSkillsSessions.agentTeamSessionList({})),
    teamCreate: (request: QuantSkillsAgentTeamCreateRequest) => unwrapRemote(
      ctx.remote.quantSkillsSessions.agentTeamCreate(request),
    ),
    teamUpdate: (request: QuantSkillsAgentTeamUpdateRequest) => unwrapRemote(
      ctx.remote.quantSkillsSessions.agentTeamUpdate(request),
    ),
    teamDelete: (request: QuantSkillsAgentTeamDeleteRequest) => unwrapRemote(
      ctx.remote.quantSkillsSessions.agentTeamDelete(request),
    ),
    teamStart: (request: QuantSkillsAgentTeamSessionCreateRequest) => unwrapRemote<QuantSkillsAgentTeamSessionCreateResult>(
      ctx.remote.quantSkillsSessions.agentTeamSessionCreate(request),
    ),
  })
  const capabilityPicker = new QuantSkillsCapabilityPickerController()
  const attachments = new QuantSkillsAttachmentController()
  const inputTriggers = ctx.get('inputTriggers') as InputTriggerServiceContract
  ctx.effect(
    () => inputTriggers.registerSource(quantSkillsLauncherSource(capabilityPicker, attachments)),
    'ui-quantskills: composer launcher source',
  )
  const view = createQuantSkillsViewStore().create()
  if (options.mode === 'native-plugin') view.actions.openPlugin()
  const notifications = createQuantSkillsNotificationStore().create()
  const nativeLayout = options.mode === 'native-plugin' ? createQuantSkillsLayoutStore().create() : undefined
  const preferences = new QuantSkillsPreferences<QuantSkillsSettings>(
    QUANTSKILLS_APPEARANCE_SETTINGS_NAMESPACE,
    {
      describe: () => unwrapRemote(ctx.remote.settings.describe()),
      mutate: (ns, ops, revision) => unwrapRemote(ctx.remote.settings.mutate(ns, ops, revision)),
    },
    section => {
      const failure = ctx.settingsSchema.validate(ctx.settingsSchema.rehydrate(section.schema), section.value)
      return failure === undefined ? section.value as QuantSkillsSettings : undefined
    },
  )
  ctx.effect(() => {
    void preferences.reload()
    const stopDocument = ctx.remote.$on('settings/document-updated', () => { void preferences.reload() })
    const stopReset = ctx.on('connection/reset', () => { void preferences.reload() })
    const refresh = () => { void preferences.reload() }
    window.addEventListener('focus', refresh)
    return () => { stopDocument(); stopReset(); window.removeEventListener('focus', refresh); void preferences.dispose() }
  }, 'ui-quantskills: authenticated preferences lifecycle')
  const syncPreferences = (snapshot: PreferencesSnapshot<QuantSkillsSettings>): void => {
    view.actions.syncSettings(snapshot.value, snapshot.status, snapshot.writable, snapshot.error)
    catalogAutoChecker.setEnabled(snapshot.value?.autoCheckCatalog ?? true)
  }
  ctx.effect(() => {
    const sync = (): void => { syncPreferences(preferences.getSnapshot()) }
    sync()
    return preferences.subscribe(sync)
  }, 'ui-quantskills: mirror Host preferences into application behavior')
  ctx.effect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let pending = ''
    const sync = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        const snapshot = preferences.getSnapshot()
        if (!snapshot.writable || !snapshot.value || !document.body.dataset.qsPluginTheme) return
        const palette = JSON.stringify(readArtifactTheme())
        if (palette === snapshot.value.artifactPalette || palette === pending) return
        pending = palette
        void preferences.set('artifactPalette', palette).catch(() => {}).finally(() => { pending = '' })
      }, 100)
    }
    const stopTheme = subscribeArtifactTheme(sync)
    let appearance = ''
    const stopSettings = preferences.subscribe(() => {
      const { value, writable } = preferences.getSnapshot()
      const next = JSON.stringify([writable, value?.colorScheme, value?.lightBackground, value?.darkBackground])
      if (next !== appearance) { appearance = next; sync() }
    })
    sync()
    return () => { clearTimeout(timer); stopTheme(); stopSettings() }
  }, 'ui-quantskills: share semantic artifact palette with generation')
  const layout = new QuantSkillsLayoutController()
  if (nativeLayout !== undefined) layout.attach(nativeLayout.actions)
  let sessionOpenGeneration = 0
  let suppressedPluginSessionId: SessionId | undefined
  const viewActions: typeof view.actions = {
    ...view.actions,
    closePlugin: () => {
      sessionOpenGeneration += 1
      suppressedPluginSessionId = ctx.sessions.list.getSnapshot().current
      view.actions.closePlugin()
    },
    showPluginConversationIndex: () => {
      sessionOpenGeneration += 1
      view.actions.showPluginConversationIndex()
    },
    navigate: (page) => {
      view.actions.navigate(page)
      if (page !== 'conversations') {
        layout.closeDetails()
        layout.closeResults()
      }
    },
    setInterfaceScale: (scale) => {
      view.actions.setInterfaceScale(scale)
      void preferences.set(QUANTSKILLS_INTERFACE_SCALE_FIELD, scale).catch(() => {})
    },
    setConversationScale: (scale) => {
      view.actions.setConversationScale(scale)
      void preferences.set(QUANTSKILLS_CONVERSATION_SCALE_FIELD, scale).catch(() => {})
    },
    setConversationOverlayOpacity: (opacity) => {
      view.actions.setConversationOverlayOpacity(opacity)
      void preferences.set(QUANTSKILLS_CONVERSATION_OVERLAY_OPACITY_FIELD, opacity).catch(() => {})
    },
    setConversationBrightness: (brightness) => {
      view.actions.setConversationBrightness(brightness)
      void preferences.set(QUANTSKILLS_CONVERSATION_BRIGHTNESS_FIELD, brightness).catch(() => {})
    },
    setColorScheme: (scheme) => {
      view.actions.setColorScheme(scheme)
      void preferences.set(QUANTSKILLS_COLOR_SCHEME_FIELD, scheme).catch(() => {})
    },
    setLightBackground: (background) => {
      view.actions.setLightBackground(background)
      void preferences.set(QUANTSKILLS_LIGHT_BACKGROUND_FIELD, background).catch(() => {})
    },
    setDarkBackground: (background) => {
      view.actions.setDarkBackground(background)
      void preferences.set(QUANTSKILLS_DARK_BACKGROUND_FIELD, background).catch(() => {})
    },
    setAutoCheckCatalog: (enabled) => {
      view.actions.setAutoCheckCatalog(enabled)
      catalogAutoChecker.setEnabled(enabled)
      void preferences.set(QUANTSKILLS_AUTO_CHECK_CATALOG_FIELD, enabled).catch(() => {})
    },
    setAutoCheckPanda: (enabled) => {
      view.actions.setAutoCheckPanda(enabled)
      void preferences.set(QUANTSKILLS_AUTO_CHECK_PANDA_FIELD, enabled).catch(() => {})
    },
    setResumeAfterPandaLogin: (enabled) => {
      view.actions.setResumeAfterPandaLogin(enabled)
      void preferences.set(QUANTSKILLS_RESUME_AFTER_PANDA_LOGIN_FIELD, enabled).catch(() => {})
    },
    setFavoriteAssetIds: (assetIds) => {
      const unique = [...new Set(assetIds)]
      view.actions.setFavoriteAssetIds(unique)
      void preferences.set(QUANTSKILLS_FAVORITE_ASSET_IDS_FIELD, unique).catch(() => {})
    },
    setAssetDisplayNameOverrides: (overrides) => {
      const unique = [...new Map(overrides.map(entry => [entry.assetId, {
        assetId: entry.assetId,
        displayName: entry.displayName.trim(),
      }])).values()].filter(entry => entry.displayName !== '')
      view.actions.setAssetDisplayNameOverrides(unique)
      void preferences.set(QUANTSKILLS_ASSET_DISPLAY_NAME_OVERRIDES_FIELD, unique).catch(() => {})
    },
    setDefaultAgentModel: (provider, model, reasoningEffort) => {
      view.actions.setDefaultAgentModel(provider, model, reasoningEffort)
      void preferences.set(QUANTSKILLS_DEFAULT_AGENT_PROVIDER_FIELD, provider).catch(() => {})
      void preferences.set(QUANTSKILLS_DEFAULT_AGENT_MODEL_FIELD, model).catch(() => {})
      void preferences.set(QUANTSKILLS_DEFAULT_AGENT_REASONING_EFFORT_FIELD, reasoningEffort).catch(() => {})
    },
    setDefaultAgentPermission: (permission) => {
      view.actions.setDefaultAgentPermission(permission)
      void preferences.set(QUANTSKILLS_DEFAULT_AGENT_PERMISSION_FIELD, permission).catch(() => {})
    },
    setDefaultWorkspaceId: (workspaceId) => {
      view.actions.setDefaultWorkspaceId(workspaceId)
    },
  }
  const adoptSession = (
    id: SessionId,
    signal: AbortSignal,
    accept: (summary: SessionSummary) => boolean = () => true,
  ): Promise<{
    readonly sessionId: SessionId
    readonly summary: SessionSummary
    readonly session: NonNullable<ReturnType<typeof ctx.sessions.binding>>['session']
  }> => new Promise((resolve, reject) => {
    let dispose = (): void => {}
    const finish = (
      result:
        | {
            readonly ok: true
            readonly value: {
              readonly sessionId: SessionId
              readonly summary: SessionSummary
              readonly session: NonNullable<ReturnType<typeof ctx.sessions.binding>>['session']
            }
          }
        | { readonly ok: false; readonly error: Error },
    ): void => {
      signal.removeEventListener('abort', abort)
      dispose()
      if (result.ok) resolve(result.value)
      else reject(result.error)
    }
    const abort = (): void => {
      finish({
        ok: false,
        error: signal.reason instanceof Error
          ? signal.reason
          : new Error(`QuantSkills Session "${id}" adoption was cancelled.`),
      })
    }
    const inspect = (): void => {
      const summary = ctx.sessions.list.getSnapshot().byId[id]
      if (summary === undefined || !accept(summary)) return
      const binding = ctx.sessions.binding(id)
      if (binding === undefined) return
      finish({
        ok: true,
        value: { sessionId: id, summary, session: binding.session },
      })
    }
    dispose = ctx.sessions.list.subscribe(inspect)
    signal.addEventListener('abort', abort, { once: true })
    inspect()
  })

  const waitForAssistantText = (
    sessionId: SessionId,
    session: Awaited<ReturnType<typeof adoptSession>>['session'],
    operation: string,
    signal: AbortSignal,
  ): Promise<string> => new Promise((resolve, reject) => {
    const eventSource = ctx.sessions.binding(sessionId)?.eventSource
    if (eventSource === undefined) {
      reject(new Error(`${operation}失败：临时 Session 事件流不可用。`))
      return
    }
    let disposeSession = (): void => {}
    let disposeEvents = (): void => {}
    const dispose = (): void => {
      disposeSession()
      disposeEvents()
    }
    const finish = (result: { readonly ok: true; readonly value: string } | { readonly ok: false; readonly error: Error }): void => {
      signal.removeEventListener('abort', abort)
      dispose()
      if (result.ok) resolve(result.value)
      else reject(result.error)
    }
    const abort = (): void => {
      finish({ ok: false, error: signal.reason instanceof Error ? signal.reason : new Error(`${operation}已取消。`) })
    }
    const inspect = (): void => {
      const snapshot = session.getSnapshot()
      if (snapshot.running) return
      let assistantSeen = false
      const entries = eventSource.getSnapshot().entries
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const entry = entries[index]
        if (entry?.type !== 'event' || entry.event.type !== 'assistant/message') continue
        assistantSeen = true
        const text = entry.event.data.message.content
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join('\n')
          .trim()
        if (text !== '') {
          finish({ ok: true, value: text })
          return
        }
      }
      if (snapshot.lastAgentError !== null) {
        finish({ ok: false, error: new Error(`${operation}失败：${snapshot.lastAgentError}`) })
        return
      }
      if (assistantSeen) finish({ ok: false, error: new Error(`${operation}失败：模型没有返回正文。`) })
    }
    disposeSession = session.subscribe(inspect)
    disposeEvents = eventSource.subscribe(inspect)
    signal.addEventListener('abort', abort, { once: true })
    inspect()
  })

  const openSession = (id: SessionId, ensureMissing = true): void => {
    const generation = ++sessionOpenGeneration
    if (options.mode === 'native-plugin') {
      suppressedPluginSessionId = undefined
      view.actions.openPluginConversation()
    }
    const sessions = ctx.sessions.list.getSnapshot()
    const summary = sessions.byId[id]
    if (summary !== undefined) {
      ctx.sessions.open(id)
      if (ctx.sessions.binding(id) !== undefined) {
        if (ensureMissing) {
          void unwrapRemote(ctx.remote.quantSkillsSessions.sessionEnsure(
            { sessionId: id },
            lifetime.signal,
          )).catch((cause: unknown) => {
            if (lifetime.signal.aborted) return
            console.error(`QuantSkills failed to initialize Session "${id}".`, cause)
          })
        }
        return
      }
    }
    void (async () => {
      if (ensureMissing) {
        await unwrapRemote(ctx.remote.quantSkillsSessions.sessionEnsure(
          { sessionId: id },
          lifetime.signal,
        ))
      }
      if (generation !== sessionOpenGeneration || lifetime.signal.aborted) return
      const adopted = await adoptSession(id, lifetime.signal)
      if (generation !== sessionOpenGeneration || lifetime.signal.aborted) return
      ctx.sessions.open(adopted.sessionId)
    })().catch((cause: unknown) => {
      if (generation !== sessionOpenGeneration || lifetime.signal.aborted) return
      console.error(`QuantSkills failed to open Session "${id}".`, cause)
      if (options.mode === 'native-plugin') view.actions.showPluginConversationIndex()
    })
  }
  const flyAccess: FlyAccess = {
    status: () => unwrapRemote(ctx.remote.quantSkillsSessions.flyStatus()),
    install: input => unwrapRemote(ctx.remote.quantSkillsSessions.flyInstall(input)),
    request: request => unwrapRemote(ctx.remote.quantSkillsSessions.flyRequest(request)),
  }
  connectFlyTransport(flyAccess)
  if (options.mode === 'standalone') {
    ctx.effect(() => {
      const disposeService = ctx.reflect.provide('layout', layout)
      const disposeRoot = ctx.slots.register({
        name: 'root',
        children: {
          'sidebar': { kind: 'single', scope: 'root' },
          'quantskills.page': { kind: 'single', scope: 'root' },
          'quantskills.results': { kind: 'single', scope: 'session' },
          'conversation': { kind: 'single', scope: 'session-maybe' },
          'details': { kind: 'single', scope: 'session' },
          'shell.overlay': { kind: 'list', scope: 'root' },
        },
        store: createQuantSkillsLayoutStore,
        inject: (actions: LayoutActions): QuantSkillsFrameInjected => {
          layout.attach(actions)
          return {
            hooks: {
              view: view.store,
              catalog: catalog.source,
              boundSessions: boundSessions.source,
              agents: agents.source,
              notifications: notifications.store,
            },
            openSession,
            syncNotifications: (observations) => { notifications.actions.sync(observations) },
            acknowledgeNotification: (id) => { notifications.actions.acknowledge(id) },
            renameSession: (id, title) => renameSession(id, title),
            removeSessions: ids => removeSessions(ids),
            startSession: () => startPlainSession(),
            startAuthoringSession: kind => startAuthoringSession(kind),
            openAgentTeamBuilder: (seed) => { view.actions.requestAgentTeamCreation(seed) },
          }
        },
      }, QuantSkillsFrame)
      return () => {
        disposeRoot()
        void disposeService()
      }
    }, 'ui-quantskills: standalone root frame and layout service')
  } else {
    if (nativeLayout === undefined) throw new Error('QuantSkills native layout is unavailable.')
    ctx.slots.inject('shell.overlay', () => ctx.slots.register({
      name: 'shell.overlay',
      id: 'quantskills-application',
      children: {
        'quantskills.page': { kind: 'single', scope: 'root' },
        'quantskills.results': { kind: 'single', scope: 'session' },
      },
      inject: (): QuantSkillsPluginFrameInjected => {
        const stockLayout = ctx.get('layout')
        if (stockLayout === undefined) {
          throw new Error('QuantSkills native workbench requires the host layout service.')
        }
        return {
          hooks: {
            view: view.store,
            layout: nativeLayout.store,
            catalog: catalog.source,
            boundSessions: boundSessions.source,
            agents: agents.source,
            notifications: notifications.store,
          },
          actions: viewActions,
          modelAccess: request => unwrapRemote(ctx.remote.quantSkillsSessions.modelsAccess(request)),
          flyAccess,
          openSession,
          acknowledgeNotification: (id) => { notifications.actions.acknowledge(id) },
          renameSession: (id, title) => renameSession(id, title),
          removeSessions: ids => removeSessions(ids),
          startSession: () => startPlainSession(),
          startAuthoringSession: kind => startAuthoringSession(kind),
          openAgentTeamBuilder: (seed) => { view.actions.requestAgentTeamCreation(seed) },
          claimSidebar: claimOptions => stockLayout.claimSidebar(claimOptions),
          claimDetails: claimOptions => stockLayout.claimDetails(claimOptions),
          claimConversationTextScale: scale => stockLayout.claimConversationTextScale(scale),
          openResults: () => { layout.openResults() },
          closeResults: () => { layout.closeResults() },
          close: () => {
            layout.closeResults()
            viewActions.closePlugin()
          },
        }
      },
    }, QuantSkillsPluginFrame))
    ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
      name: 'sidebar.footer.action',
      id: 'quantskills-application',
      order: 10,
      inject: (): QuantSkillsPluginLauncherInjected => ({
        hooks: { notifications: notifications.store },
        open: () => {
          suppressedPluginSessionId = undefined
          view.actions.openPlugin()
        },
      }),
    }, QuantSkillsPluginLauncher))
    ctx.effect(() => {
      let observedSessionId = ctx.sessions.list.getSnapshot().current
      const sync = (): void => {
        const current = ctx.sessions.list.getSnapshot().current
        if (current !== observedSessionId) {
          observedSessionId = current
          if (current !== suppressedPluginSessionId) suppressedPluginSessionId = undefined
        }
        if (current === undefined || current === suppressedPluginSessionId) return
        const sessionSnapshot = boundSessions.source.getSnapshot()
        const agentSnapshot = agents.source.getSnapshot()
        const owned = sessionSnapshot.plainArchives.some(archive => archive.sessionId === current)
          || sessionSnapshot.archives.some(archive => archive.sessionId === current)
          || agentSnapshot.archives.some(archive => archive.sessionId === current)
          || agentSnapshot.teamArchives.some(archive => archive.sessionId === current)
        if (owned && !view.store.getSnapshot().pluginOpen) view.actions.openPluginConversation()
      }
      const disposers = [
        ctx.sessions.list.subscribe(sync),
        boundSessions.source.subscribe(sync),
        agents.source.subscribe(sync),
      ]
      sync()
      return () => { for (const dispose of disposers) dispose() }
    }, 'ui-quantskills: restore the plugin frame for QuantSkills-owned Sessions')
  }
  if (options.mode !== 'native-plugin') {
    ctx.slots.inject('conversation.hero.brand.mark', () => ctx.slots.register({
      name: 'conversation.hero.brand.mark',
      priority: -100,
    }, QuantSkillsBrandMark))
  }
  const conversationBrand = (): QuantSkillsConversationBrandInjected => ({
    mode: options.mode,
    hooks: { view: view.store },
  })
  ctx.slots.inject('conversation.hero.identity', () => ctx.slots.register({
    name: 'conversation.hero.identity',
    inject: conversationBrand,
  }, QuantSkillsConversationHeroIdentity))
  ctx.slots.inject('conversation.hero.accessory', () => ctx.slots.register({
    name: 'conversation.hero.accessory',
    id: 'quantskills-panda-mcp',
    order: 10,
    inject: (): QuantSkillsPandaMcpControlInjected => ({
      ...conversationBrand(),
      ...pandaMcp,
    }),
  }, QuantSkillsPandaMcpHeroControl))
  ctx.slots.inject('conversation.chat.deliverables', () => ctx.slots.register({
    name: 'conversation.chat.deliverables',
    inject: (sessionId: SessionId) => ({
      downloadFile: (path: string) => artifactDownload(sessionId, path),
      openWorkbench: (path: string) => {
        // Bind to the rendered answer's session, never whichever session a stale callback finds.
        if (ctx.sessions.list.getSnapshot().current !== sessionId) return
        resultTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        view.actions.requestResultPreview(sessionId, path)
        if (options.mode === 'native-plugin') view.actions.openPluginConversation()
        layout.openResults()
        notifications.actions.acknowledge(sessionId)
      },
      previewFile: (path: string) => unwrapRemote<QuantSkillsResultPreview>(
        ctx.remote.quantSkillsSessions.resultPreview({ sessionId, path }),
      ),
    }),
  }, FinalDeliverables))
  ctx.slots.inject('conversation.chat.turnStatus', () => ctx.slots.register({
    name: 'conversation.chat.turnStatus',
    inject: conversationBrand,
  }, QuantSkillsConversationStatus))
  ctx.slots.inject('conversation.input.model', () => ctx.slots.register({
    name: 'conversation.input.model',
    priority: -100,
    locale: 'model',
    inject: (sessionId: SessionId) => {
      const directory = ctx.modelDirectories.directoryFor(sessionId)
      const available = ctx.sessions.subagentAddress(sessionId) === undefined
      return {
        available,
        directory: directory.store,
        load: () => { if (available) void directory.load() },
        select: selection => available
          ? directory.select(selection).then(() => true, () => false)
          : Promise.resolve(false),
      }
    },
  }, QuantSkillsGravityLaneModelSelect))
  type SessionWorkspaceTarget =
    | { readonly workspaceId: WorkspaceId; readonly cwd?: never }
    | { readonly cwd: string; readonly workspaceId?: never }
    | { readonly workspaceId?: never; readonly cwd?: never }
  const legacySessionWorkspace = (): SessionWorkspaceTarget => {
    const sessions = ctx.sessions.list.getSnapshot()
    const workspaces = ctx.workspaces.list.getSnapshot()
    const current = sessions.current
    const currentWorkspaceId = current === undefined
      ? undefined
      : workspaces.items.find(item => item.sessionIds.includes(current))?.workspaceId
    const workspaceId = currentWorkspaceId ?? workspaces.items.at(0)?.workspaceId
    const cwd = current === undefined ? undefined : sessions.byId[current]?.cwd
    return workspaceId === undefined
      ? (cwd === undefined ? {} : { cwd })
      : { workspaceId }
  }
  const resolveSessionWorkspace = async (): Promise<SessionWorkspaceTarget> => {
    if (options.mode === 'standalone') return legacySessionWorkspace()
    const preferredWorkspaceId = view.store.getSnapshot().defaultWorkspaceId as WorkspaceId | undefined
    let resolved: QuantSkillsWorkspaceResolveResult
    try {
      resolved = await unwrapRemote<QuantSkillsWorkspaceResolveResult>(
        ctx.remote.quantSkillsSessions.workspaceResolve({
          ...(preferredWorkspaceId === undefined ? {} : { preferredWorkspaceId }),
        }),
      )
    } catch (error: unknown) {
      viewActions.navigate('settings')
      view.actions.setSettingsSection('workspace')
      throw new Error('QuantSkills 默认工作区不可用。请在设置的“工作区”中选择一个可用的工作区。', {
        cause: error,
      })
    }
    if (resolved.recoveredPreferredWorkspaceId !== undefined) {
      viewActions.setDefaultWorkspaceId(undefined)
      try {
        await preferences.unset(QUANTSKILLS_DEFAULT_WORKSPACE_ID_FIELD)
      } catch (error: unknown) {
        console.warn('QuantSkills could not persist recovery from an unavailable default Workspace.', error)
      }
      view.actions.setWorkspaceRecoveryNotice('原自定义工作区已不可用，新会话已自动回退到 QuantSkills 默认工作区。')
    }
    return { workspaceId: resolved.workspace.workspaceId }
  }
  const startPlainSession = async (): Promise<void> => {
    viewActions.navigate('conversations')
    const workspace = await resolveSessionWorkspace()
    const requestedSessionId = `session-${crypto.randomUUID()}` as SessionId
    const created = await unwrapRemote<QuantSkillsPlainSessionCreateResult>(
      ctx.remote.quantSkillsSessions.plainSessionCreate({
        ...workspace,
        sessionId: requestedSessionId,
        purpose: 'ordinary',
      }, lifetime.signal),
    )
    openSession(created.sessionId, false)
    await boundSessions.refresh(lifetime.signal)
  }
  const renameSession = async (id: SessionId, title: string): Promise<void> => {
    const session = ctx.sessions.binding(id)?.session
    if (session === undefined) throw new Error(`unknown session "${id}"`)
    const result = await session.rename(title)
    if (!result.ok) throw new Error(result.error.message)
    await Promise.all([boundSessions.refresh(lifetime.signal), agents.refresh()])
  }
  const contestAccess: ContestAccess = {
    watch: {
      varieties: signal => unwrapRemote(ctx.remote.quantSkillsSessions.contestQuery({ kind: 'varieties' }, signal)),
      settings: () => unwrapRemote(ctx.remote.quantSkillsSessions.contestJevSettings()),
      usage: () => unwrapRemote(ctx.remote.quantSkillsSessions.contestJevUsage()),
      templates: () => unwrapRemote(ctx.remote.quantSkillsSessions.contestWatchTemplates()),
      saveTemplate: request => unwrapRemote(ctx.remote.quantSkillsSessions.contestWatchSaveTemplate(request)),
      datasets: () => unwrapRemote(ctx.remote.quantSkillsSessions.contestWatchDatasets()),
      prepareHistory: request => unwrapRemote(ctx.remote.quantSkillsSessions.contestWatchPrepareHistory(request)),
      configure: request => unwrapRemote(ctx.remote.quantSkillsSessions.contestJevConfigure(request)),
      status: () => unwrapRemote(ctx.remote.quantSkillsSessions.contestWatchStatus()),
      start: config => unwrapRemote(ctx.remote.quantSkillsSessions.contestWatchStart({ config, confirmed: true })),
      stop: () => unwrapRemote(ctx.remote.quantSkillsSessions.contestWatchStop()),
    },
    status: sessionId => unwrapRemote(ctx.remote.quantSkillsSessions.contestStatus(sessionId ? { sessionId } : {})),
    mode: enabled => unwrapRemote(ctx.remote.quantSkillsSessions.contestMode({ enabled })),
    connect: () => unwrapRemote(ctx.remote.quantSkillsSessions.contestConnect()),
    disconnect: () => unwrapRemote(ctx.remote.quantSkillsSessions.contestDisconnect()),
    checkUpdate: () => unwrapRemote(ctx.remote.quantSkillsSessions.contestCheckUpdate()),
    update: () => unwrapRemote(ctx.remote.quantSkillsSessions.contestUpdate()),
    query: (request, signal) => unwrapRemote(ctx.remote.quantSkillsSessions.contestQuery(request, signal)),
    execute: plan => unwrapRemote(ctx.remote.quantSkillsSessions.contestExecute({ planId: plan.id, sessionId: plan.sessionId })),
    dismiss: plan => unwrapRemote(ctx.remote.quantSkillsSessions.contestDismiss({ planId: plan.id, sessionId: plan.sessionId })),
    reconcile: plan => unwrapRemote(ctx.remote.quantSkillsSessions.contestReconcile({ planId: plan.id, sessionId: plan.sessionId })),
    inspect: (sessionId, signal) => unwrapRemote(ctx.remote.quantSkillsSessions.contestInspect({ sessionId: sessionId as SessionId }, signal)),
    requestResearch: async (sessionId, text) => {
      const current = ctx.sessions.list.getSnapshot()
      if (current.current !== sessionId || current.byId[sessionId as SessionId]?.projectionValues?.quantSkillsPlainSession?.purpose !== 'contest') {
        throw new Error('请在对应比赛会话中发起研究。')
      }
      const session = ctx.sessions.binding(sessionId as SessionId)?.session
      if (!session) throw new Error('比赛会话尚未就绪。')
      const result = await session.prompt([{ type: 'text', text }], 'queue')
      if (!result.ok) throw new Error(result.error.message)
    },
    startResearch: async (topic, callerSignal) => {
      const signal = callerSignal ? AbortSignal.any([lifetime.signal, callerSignal]) : lifetime.signal
      signal.throwIfAborted()
      const workspace = await resolveSessionWorkspace()
      signal.throwIfAborted()
      const created = await unwrapRemote(ctx.remote.quantSkillsSessions.contestSessionOpen({
        ...workspace, sessionId: `session-${crypto.randomUUID()}` as SessionId, ...(topic ? { topic: true } : {}),
      }, signal))
      signal.throwIfAborted()
      const adopted = await adoptSession(created.sessionId, signal,
        summary => summary.projectionValues?.quantSkillsPlainSession?.purpose === 'contest')
      signal.throwIfAborted()
      if (created.created) {
        const renamed = await adopted.session.rename(topic ? '比赛 · 专题研究' : '比赛 · 账户主对话')
        if (!renamed.ok) throw new Error(renamed.error.message)
      }
      signal.throwIfAborted()
      openSession(created.sessionId, false)
      void boundSessions.refresh(lifetime.signal).catch(() => {})
    },
  }
  const factorContestAccess: FactorContestAccess = {
    status: sessionId => unwrapRemote(ctx.remote.quantSkillsSessions.factorStatus(sessionId ? { sessionId } : {})),
    mode: enabled => unwrapRemote(ctx.remote.quantSkillsSessions.factorMode({ enabled })),
    connect: credentials => unwrapRemote(ctx.remote.quantSkillsSessions.factorConnect(credentials ? { credentials } : {})),
    disconnect: () => unwrapRemote(ctx.remote.quantSkillsSessions.factorDisconnect()),
    checkUpdate: () => unwrapRemote(ctx.remote.quantSkillsSessions.factorCheckUpdate()),
    update: () => unwrapRemote(ctx.remote.quantSkillsSessions.factorUpdate()),
    inspect: (sessionId, signal) => unwrapRemote(ctx.remote.quantSkillsSessions.factorInspect(sessionId ? { sessionId: sessionId as SessionId } : {}, signal)),
    query: (request, signal) => unwrapRemote(ctx.remote.quantSkillsSessions.factorQuery(request, signal)),
    prepare: (action, sessionId) => unwrapRemote(ctx.remote.quantSkillsSessions.factorPrepare({ action, ...(sessionId ? { sessionId: sessionId as SessionId } : {}) })),
    confirm: plan => unwrapRemote(ctx.remote.quantSkillsSessions.factorConfirm({ planId: plan.id, sessionId: plan.sessionId })),
    dismiss: plan => unwrapRemote(ctx.remote.quantSkillsSessions.factorDismiss({ planId: plan.id, sessionId: plan.sessionId })),
    stopBudget: budgetId => unwrapRemote(ctx.remote.quantSkillsSessions.factorStopBudget({ budgetId })),
    reconcileRun: runId => unwrapRemote(ctx.remote.quantSkillsSessions.factorReconcileRun({ runId })),
    reconcilePlan: planId => unwrapRemote(ctx.remote.quantSkillsSessions.factorReconcilePlan({ planId })),
    requestResearch: async (sessionId, text) => {
      const current = ctx.sessions.list.getSnapshot()
      if (current.current !== sessionId || current.byId[sessionId as SessionId]?.projectionValues?.quantSkillsPlainSession?.purpose !== 'factor-contest') throw new Error('请在对应因子比赛会话中发起研究。')
      const session = ctx.sessions.binding(sessionId as SessionId)?.session
      if (!session) throw new Error('因子会话尚未就绪。')
      const result = await session.prompt([{ type: 'text', text }], 'queue')
      if (!result.ok) throw new Error(result.error.message)
    },
    startResearch: async (topic, callerSignal) => {
      const signal = callerSignal ? AbortSignal.any([lifetime.signal, callerSignal]) : lifetime.signal
      signal.throwIfAborted()
      const workspace = await resolveSessionWorkspace()
      signal.throwIfAborted()
      const created = await unwrapRemote(ctx.remote.quantSkillsSessions.factorSessionOpen({ ...workspace, sessionId: `session-${crypto.randomUUID()}` as SessionId,
        ...(topic ? { topic: true } : {}) }, signal))
      signal.throwIfAborted()
      const adopted = await adoptSession(created.sessionId, signal, summary => summary.projectionValues?.quantSkillsPlainSession?.purpose === 'factor-contest')
      signal.throwIfAborted()
      if (created.created) {
        const renamed = await adopted.session.rename(topic ? '因子赛 · 专题研究' : '因子赛 · 账户主对话')
        if (!renamed.ok) throw new Error(renamed.error.message)
      }
      signal.throwIfAborted()
      openSession(created.sessionId, false); void boundSessions.refresh(lifetime.signal).catch(() => {})
    },
  }
  const removeSessions = async (ids: readonly SessionId[]): Promise<void> => {
    const uniqueIds = [...new Set(ids)]
    if (uniqueIds.length === 0) return
    const current = ctx.sessions.list.getSnapshot().current
    const archived = new Set<SessionId>()
    let failure: unknown
    for (const id of uniqueIds) {
      try {
        await ctx.workspaces.archiveSession(id)
        archived.add(id)
      } catch (cause: unknown) {
        failure = cause
        break
      }
    }
    await Promise.all([boundSessions.refresh(lifetime.signal), agents.refresh()])
    const error = failure === undefined
      ? undefined
      : failure instanceof Error
        ? failure
        : new Error('archive session failed', { cause: failure })
    if (current === undefined || !archived.has(current)) {
      if (error !== undefined) throw error
      return
    }
    const next = [
      ...boundSessions.source.getSnapshot().archives,
      ...agents.source.getSnapshot().archives,
      ...agents.source.getSnapshot().teamArchives,
    ].filter(archive => !archived.has(archive.sessionId))
      .sort((left, right) => right.updatedAt - left.updatedAt)[0]
    viewActions.navigate('conversations')
    if (next === undefined) await startPlainSession()
    else openSession(next.sessionId)
    if (error !== undefined) throw error
  }
  let conversation: IConversation | undefined
  ctx.inject(['conversation'], (scope: ClientContext) => {
    const face = scope.conversation
    scope.effect(() => {
      conversation = face
      return () => { if (conversation === face) conversation = undefined }
    }, 'ui-quantskills: stock composer draft bridge')
  })
  ctx.slots.inject(
    'conversation.input.left',
    () => ctx.slots.register({
      name: 'conversation.input.left',
      id: 'quantskills-file-attachment',
      order: 30,
      inject: (): QuantSkillsAttachmentControlInjected => ({
        controller: attachments,
        upload: (sessionId, file, data) => unwrapRemote<QuantSkillsSessionFileAttachment>(
          ctx.remote.quantSkillsSessions.fileAttach({
            sessionId,
            data,
            mediaType: file.type === '' ? 'application/octet-stream' : file.type,
            name: file.name,
          }),
        ),
        appendDraft: (sessionId, text) => {
          if (conversation === undefined) throw new Error('QuantSkills：会话输入器尚未就绪。')
          const binding = ctx.sessions.binding(sessionId)
          if (binding === undefined) throw new Error('QuantSkills：附件所属会话不可用。')
          const input = conversation.input.for(binding.ctx)
          input.setDraft(`${input.state.getSnapshot().draft}${text}`)
        },
      }),
    }, QuantSkillsAttachmentControl),
  )
  const createBoundSession = async (
    versionId: QuantSkillsInstalledVersionId,
    initialTask?: string,
  ): Promise<SessionId> => {
    const workspace = await resolveSessionWorkspace()
    const sessionId = `session-${crypto.randomUUID()}` as SessionId
    const created = await boundSessions.create({
      sessionId,
      versionId,
      ...workspace,
    }, lifetime.signal)
    const adopted = await adoptSession(
      created.sessionId,
      lifetime.signal,
      summary => hasExactQuantSkillsBinding(summary, created.binding),
    )
    lifetime.signal.throwIfAborted()
    openSession(adopted.sessionId)
    if (initialTask !== undefined) {
      const response = await adopted.session.prompt([{ type: 'text', text: initialTask }], 'queue')
      if (!response.ok) throw new Error(`QuantSkills 任务启动失败：${response.error.message}`)
    }
    viewActions.navigate('conversations')
    return adopted.sessionId
  }
  const startSkillSession = async (
    _asset: QuantSkillsAsset,
    version: QuantSkillsInstalledVersion,
  ): Promise<void> => {
    await createBoundSession(version.versionId as QuantSkillsInstalledVersionId)
  }
  const startBoundSession = async (
    binding: QuantSkillsSessionBinding,
    _label: string,
  ): Promise<void> => {
    await createBoundSession(binding.versionId)
  }
  const startAgentSessionCore = async (
    definition: QuantSkillsAgentDefinition,
    initialTask?: string,
    authoringKind?: QuantSkillsAuthoringKind,
  ): Promise<SessionId> => {
    const workspace = await resolveSessionWorkspace()
    const sessionId = `session-${crypto.randomUUID()}` as SessionId
    const request = {
      sessionId,
      agentId: definition.agentId,
      expectedRevision: definition.revision,
      ...workspace,
    }
    const created = authoringKind === undefined
      ? await agents.start(request)
      : await unwrapRemote<QuantSkillsAgentSessionCreateResult>(
        ctx.remote.quantSkillsSessions.authoringSessionCreate({ ...request, kind: authoringKind }),
      )
    const adopted = await adoptSession(
      created.sessionId,
      lifetime.signal,
      summary => hasExactQuantSkillsAgent(summary, created.agent),
    )
    lifetime.signal.throwIfAborted()
    if (created.agent.model !== undefined) {
      const selected = await ctx.remote.session.selectModel({
        sessionId: adopted.sessionId,
        provider: created.agent.model.provider,
        model: created.agent.model.model,
        ...(created.agent.model.reasoningEffort === undefined
          ? {}
          : { reasoningEffort: created.agent.model.reasoningEffort }),
      })
      if (!selected.ok) {
        throw new Error(`QuantSkills 专家 模型选择失败：${selected.error.message}`)
      }
    }
    const permission = await ctx.remote.commands.execute(
      adopted.sessionId,
      `/permission ${created.agent.permission}`,
      [],
    )
    if (!permission.ok) throw new Error(`QuantSkills 专家 权限设置失败：${permission.error.message}`)
    if (permission.value === undefined) throw new Error('QuantSkills 专家 权限命令不可用。')
    openSession(adopted.sessionId)
    if (initialTask !== undefined) {
      const response = await adopted.session.prompt([{
        type: 'text',
        text: initialTask,
      }], 'queue')
      if (!response.ok) throw new Error(`QuantSkills 专家 测试失败：${response.error.message}`)
    }
    viewActions.navigate('conversations')
    return adopted.sessionId
  }
  const startAgentSession = (
    definition: QuantSkillsAgentDefinition,
    initialTask?: string,
  ): Promise<SessionId> => {
    return startAgentSessionCore(definition, initialTask)
  }
  const startAgentTeamSessionCore = async (
    definition: QuantSkillsAgentTeamDefinition,
    initialTask?: string,
  ): Promise<SessionId> => {
    const workspace = await resolveSessionWorkspace()
    const sessionId = `session-${crypto.randomUUID()}` as SessionId
    const created = await agents.startTeam({
      sessionId,
      teamId: definition.teamId,
      expectedRevision: definition.revision,
      ...workspace,
    })
    const adopted = await adoptSession(
      created.sessionId,
      lifetime.signal,
      summary => hasExactQuantSkillsAgentTeam(summary, created.team),
    )
    lifetime.signal.throwIfAborted()
    const lead = created.team.lead
    if (created.team.leadModel.kind === 'fixed') {
      const selection = created.team.leadModel.selection
      const selected = await ctx.remote.session.selectModel({
        sessionId: adopted.sessionId,
        provider: selection.provider,
        model: selection.model,
        ...(selection.reasoningEffort === undefined ? {} : { reasoningEffort: selection.reasoningEffort }),
      })
      if (!selected.ok) {
        throw new Error(`QuantSkills 专家团 模型选择失败：${selected.error.message}`)
      }
    }
    const permission = await ctx.remote.commands.execute(
      adopted.sessionId,
      `/permission ${lead.permission}`,
      [],
    )
    if (!permission.ok) throw new Error(`QuantSkills 专家团 权限设置失败：${permission.error.message}`)
    if (permission.value === undefined) throw new Error('QuantSkills 专家团 权限命令不可用。')
    openSession(adopted.sessionId)
    if (initialTask !== undefined) {
      const response = await adopted.session.prompt([{ type: 'text', text: initialTask }], 'queue')
      if (!response.ok) throw new Error(`QuantSkills 专家团 启动失败：${response.error.message}`)
    }
    viewActions.navigate('conversations')
    return adopted.sessionId
  }
  const startAgentTeamSession = (
    definition: QuantSkillsAgentTeamDefinition,
    initialTask?: string,
  ): Promise<SessionId> => {
    return startAgentTeamSessionCore(definition, initialTask)
  }
  const startAuthoringSession = async (
    kind: QuantSkillsAuthoringKind,
    initialRequest?: string,
  ): Promise<void> => {
    const name = quantSkillsAuthoringAgentName(kind)
    const legacyName = kind === 'skill'
      ? 'QuantSkills · 技能 创作助手'
      : kind === 'agent' ? 'QuantSkills · 专家 创作助手' : undefined
    const role = quantSkillsAuthoringRole(kind)
    const definitions = agents.source.getSnapshot().definitions
    const existing = definitions.find(definition => definition.name === name)
      ?? definitions.find(definition => legacyName !== undefined && definition.name === legacyName)
    let definition = existing
    if (definition === undefined) {
      definition = await agents.create({
        purpose: 'authoring-helper',
        name,
        role,
        mode: 'dynamic',
        permission: 'workspace-write',
        versionIds: [],
      })
    } else if (definition.name !== name || definition.role !== role) {
      definition = await agents.update({
        agentId: definition.agentId,
        expectedRevision: definition.revision,
        name,
        role,
        mode: definition.mode,
        ...(definition.model === undefined ? {} : { model: definition.model }),
        permission: definition.permission,
        ...(definition.sourceVersionId === undefined ? {} : { sourceVersionId: definition.sourceVersionId }),
        versionIds: definition.skills.map(binding => binding.versionId),
      })
    }
    const sessionId = await startAgentSessionCore(
      definition,
      quantSkillsAuthoringOpening(kind, initialRequest),
      kind,
    )
    // Authoring must finish with the native conversation selected because its
    // source page unmounts during asynchronous Session startup.
    openSession(sessionId)
  }

  const listAgentModels = async (): Promise<readonly QuantSkillsAgentModelOption[]> => {
    const response = await ctx.remote.session.modelCatalog()
    if (!response.ok) throw new Error(`QuantSkills 模型目录读取失败：${response.error.message}`)
    return Object.freeze(response.value.groups.flatMap(group => group.models.map(model => Object.freeze({
      provider: group.id,
      providerLabel: group.name,
      model: model.id,
      modelLabel: model.name,
      reasoningEfforts: Object.freeze((model.reasoning?.efforts ?? []).map(effort => Object.freeze({
        id: effort.id,
        label: effort.name,
      }))),
    }))))
  }
  const generateAgentRole = async (
    request: QuantSkillsAgentRoleDraftRequest,
    callerSignal?: AbortSignal,
  ): Promise<string> => {
    const signal = callerSignal === undefined
      ? lifetime.signal
      : AbortSignal.any([lifetime.signal, callerSignal])
    signal.throwIfAborted()
    const current = ctx.sessions.list.getSnapshot().current
    const workspace = await resolveSessionWorkspace()
    const requestedSessionId = `session-${crypto.randomUUID()}` as SessionId
    const created = await unwrapRemote<QuantSkillsPlainSessionCreateResult>(
      ctx.remote.quantSkillsSessions.plainSessionCreate({
        ...workspace,
        sessionId: requestedSessionId,
        purpose: 'role-helper',
      }, signal),
    )
    const sessionId = created.sessionId
    let adopted: Awaited<ReturnType<typeof adoptSession>> | undefined
    try {
      adopted = await adoptSession(sessionId, signal)
      const session = adopted.session
      ctx.sessions.open(sessionId)
      if (request.model !== undefined) {
        const selected = await ctx.remote.session.selectModel({
          sessionId,
          provider: request.model.provider,
          model: request.model.model,
          ...(request.model.reasoningEffort === undefined
            ? {}
            : { reasoningEffort: request.model.reasoningEffort }),
        })
        if (!selected.ok) throw new Error(`AI 角色说明模型选择失败：${selected.error.message}`)
      }
      const skills = request.skills.length === 0
        ? '未编排 技能。'
        : request.skills.map((skill, index) => `${String(index + 1)}. ${skill.title}（${skill.versionId}）`).join('\n')
      const prompt = [
        '你是 QuantSkills 专家配置助手。请为下面的专家撰写可直接保存的中文角色说明。',
        '只输出角色说明正文，不要解释过程，不要使用代码围栏，不要输出模板变量语法。',
        '正文需要清楚说明职责、工作方法、行为限制和交付物；避免空泛宣传语。',
        `专家名称：${request.name || '未命名专家'}`,
        `技能 编排方式：${request.mode === 'fixed' ? '按清单固定顺序使用' : '由 AI 根据任务动态选择，清单顺序代表优先级'}`,
        `已编排的精确 技能：\n${skills}`,
        request.currentRole === '' ? '现有角色说明：无。' : `现有角色说明（请改进，不要机械重复）：\n${request.currentRole}`,
        request.instruction === '' ? '用户补充要求：无。' : `用户补充要求：\n${request.instruction}`,
      ].join('\n\n')
      const response = await session.prompt([{ type: 'text', text: prompt }], 'queue', signal)
      if (!response.ok) throw new Error(`AI 角色说明生成失败：${response.error.message}`)
      return await waitForAssistantText(sessionId, session, 'AI 角色说明生成', signal)
    } finally {
      if (adopted?.session.getSnapshot().running) await adopted.session.cancel()
      await ctx.workspaces.archiveSession(sessionId).catch((error: unknown) => {
        console.warn('QuantSkills AI role helper could not archive its temporary Session.', error)
      })
      if (current === undefined) ctx.sessions.clear()
      else if (ctx.sessions.list.getSnapshot().byId[current] !== undefined) ctx.sessions.open(current)
    }
  }
  const matchSkillForTask = async (
    request: string,
    skills: readonly QuantSkillsAsset[],
  ): Promise<QuantSkillsGuideDecision<QuantSkillsAsset>> => {
    const signal = lifetime.signal
    signal.throwIfAborted()
    const current = ctx.sessions.list.getSnapshot().current
    const workspace = await resolveSessionWorkspace()
    const requestedSessionId = `session-${crypto.randomUUID()}` as SessionId
    const created = await unwrapRemote<QuantSkillsPlainSessionCreateResult>(
      ctx.remote.quantSkillsSessions.plainSessionCreate({
        ...workspace,
        sessionId: requestedSessionId,
        purpose: 'role-helper',
      }, signal),
    )
    const sessionId = created.sessionId
    let adopted: Awaited<ReturnType<typeof adoptSession>> | undefined
    try {
      adopted = await adoptSession(sessionId, signal)
      ctx.sessions.open(sessionId)
      const prompt = buildSkillGuidePrompt(request, skills)
      const response = await adopted.session.prompt([{ type: 'text', text: prompt }], 'queue', signal)
      if (!response.ok) throw new Error(`AI 技能 匹配失败：${response.error.message}`)
      const answer = await waitForAssistantText(sessionId, adopted.session, 'AI 技能 匹配', signal)
      return parseSkillGuideDecision(answer, skills)
    } finally {
      if (adopted?.session.getSnapshot().running) await adopted.session.cancel()
      await ctx.workspaces.archiveSession(sessionId).catch((error: unknown) => {
        console.warn('QuantSkills AI catalog matcher could not archive its temporary Session.', error)
      })
      if (current === undefined) ctx.sessions.clear()
      else if (ctx.sessions.list.getSnapshot().byId[current] !== undefined) ctx.sessions.open(current)
    }
  }
  const importAgent = async (
    asset: QuantSkillsAsset,
    version: QuantSkillsInstalledVersion,
  ): Promise<QuantSkillsAgentDefinition> => {
    const template = await unwrapRemote<QuantSkillsInstalledAgentTemplate>(
      ctx.remote.quantSkills.agentTemplate(version.versionId as QuantSkillsInstalledVersionId),
    )
    const snapshot = catalog.source.getSnapshot()
    const requiredVersions = template.requires.map((assetId: string) => {
      const approved = snapshot.assets.find(candidate => candidate.name === assetId)
      const installed = snapshot.versionsByAsset[assetId]
        ?.find(candidate => candidate.exposure === 'skill-registry'
          && (approved === undefined || candidate.commitSha === approved.commitSha))
      if (installed === undefined) throw new Error(`专家 依赖 ${assetId} 尚未安装。`)
      return installed.versionId as QuantSkillsInstalledVersionId
    })
    return agents.create({
      name: asset.title,
      role: template.instructions,
      mode: 'dynamic',
      permission: 'workspace-write',
      sourceVersionId: version.versionId as QuantSkillsInstalledVersionId,
      versionIds: requiredVersions,
    })
  }
  const installAgent = async (asset: QuantSkillsAsset): Promise<QuantSkillsAgentDefinition> => {
    const version = await catalog.install(asset)
    if (version === undefined || version.exposure !== 'agent-template') {
      throw new Error(catalog.source.getSnapshot().operationError ?? 'QuantSkills 专家 安装未生成可用模板。')
    }
    return importAgent(asset, version)
  }
  const detachResidentSkill = async (sessionId: SessionId, assetId: string): Promise<void> => {
    await unwrapRemote<QuantSkillsResidentSkillResult>(
      ctx.remote.quantSkillsSessions.residentSkillDetach({
        sessionId,
        assetId: assetId as QuantSkillsSessionBinding['assetId'],
      }),
    )
  }
  const toggleResidentSkill = async (
    sessionId: SessionId,
    asset: QuantSkillsAsset,
    attached: QuantSkillsSessionBinding | undefined,
  ): Promise<void> => {
    if (attached !== undefined) {
      await detachResidentSkill(sessionId, asset.name)
      return
    }
    let version = catalog.source.getSnapshot().versionsByAsset[asset.name]
      ?.find(candidate => candidate.exposure === 'skill-registry' && candidate.commitSha === asset.commitSha)
    version ??= await catalog.install(asset)
    if (version === undefined || version.exposure !== 'skill-registry') {
      throw new Error(`QuantSkills：无法安装 技能「${asset.title}」。`)
    }
    await unwrapRemote<QuantSkillsResidentSkillResult>(
      ctx.remote.quantSkillsSessions.residentSkillAttach({
        sessionId,
        versionId: version.versionId as QuantSkillsInstalledVersionId,
      }),
    )
  }
  const openCatalogAgent = async (asset: QuantSkillsAsset): Promise<void> => {
    const installed = catalog.source.getSnapshot().versionsByAsset[asset.name]
      ?.find(candidate => candidate.exposure === 'agent-template' && candidate.commitSha === asset.commitSha)
    const existing = installed === undefined
      ? undefined
      : agents.source.getSnapshot().definitions.find(definition => definition.sourceVersionId === installed.versionId)
    const definition = existing ?? (installed === undefined
      ? await installAgent(asset)
      : await importAgent(asset, installed))
    await startAgentSession(definition)
  }

  ctx.slots.inject(
    'conversation.input.overlay',
    () => ctx.slots.register({
      name: 'conversation.input.overlay',
      id: 'quantskills-capability-picker',
      order: 20,
      inject: (): QuantSkillsCapabilityPickerInjected => ({
        picker: capabilityPicker.source,
        catalog: catalog.source,
        sessions: boundSessions.source,
        agents: agents.source,
        close: () => { capabilityPicker.close() },
        toggleSkill: toggleResidentSkill,
        openCatalogAgent,
        openUserAgent: definition => startAgentSession(definition).then(() => {}),
        openUserTeam: definition => startAgentTeamSession(definition).then(() => {}),
        openExpertPreset: async preset => {
          const snapshot = agents.source.getSnapshot()
          const existing = findPresetExpert(preset, snapshot.definitions)
          const definition = existing ?? await agents.create(presetRequest(preset, Object.values(catalog.source.getSnapshot().versionsByAsset).flat()))
          await startAgentSession(definition)
        },
        openTeamPreset: async preset => {
          const snapshot = agents.source.getSnapshot()
          const [team] = await saveTeamPresets([preset], {
            definitions: snapshot.definitions, teams: snapshot.teams,
            versions: Object.values(catalog.source.getSnapshot().versionsByAsset).flat(),
            createExpert: request => agents.create(request), createTeam: request => agents.createTeam(request),
            savedExpert: () => {}, savedTeam: () => {},
          })
          if (team) await startAgentTeamSession(team)
        },
      }),
    }, QuantSkillsCapabilityPicker),
  )
  ctx.slots.inject(
    'conversation.input.left',
    () => ctx.slots.register({
      name: 'conversation.input.left',
      id: 'quantskills-resident-capabilities',
      order: 40,
      inject: (): QuantSkillsResidentControlInjected => ({
        catalog: catalog.source,
        detach: detachResidentSkill,
        openPicker: (sessionId) => { capabilityPicker.open(sessionId, 'catalog') },
        listPromptForms: sessionId => unwrapRemote<QuantSkillsPromptFormListResult>(
          ctx.remote.quantSkillsSessions.promptFormList({ sessionId }),
        ),
        renderPromptForm: request => unwrapRemote<QuantSkillsPromptFormRenderResult>(
          ctx.remote.quantSkillsSessions.promptFormRender(request),
        ).then(result => result.text),
        fillDraft: (sessionId, text) => {
          if (conversation === undefined) throw new Error('QuantSkills：会话输入器尚未就绪。')
          const binding = ctx.sessions.binding(sessionId)
          if (binding === undefined) throw new Error('QuantSkills：参数所属会话不可用。')
          conversation.input.for(binding.ctx).setDraft(text)
        },
        runPrompt: (sessionId, text) => {
          if (conversation === undefined) throw new Error('QuantSkills：会话输入器尚未就绪。')
          const binding = ctx.sessions.binding(sessionId)
          if (binding === undefined) throw new Error('QuantSkills：参数所属会话不可用。')
          const input = conversation.input.for(binding.ctx)
          input.setDraft(text)
          input.submit('queue')
        },
      }),
    }, QuantSkillsResidentControl),
  )
  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left', id: 'quantskills-panda-mcp', order: 50,
    inject: (): QuantSkillsPandaMcpControlInjected => ({ ...conversationBrand(), ...pandaMcp }),
  }, QuantSkillsPandaMcpControl))
  const send = async (text: string): Promise<void> => {
    const sessionId = ctx.sessions.list.getSnapshot().current
    const bound = sessionId === undefined
      ? undefined
      : boundSessions.source.getSnapshot().archives.find(archive => archive.sessionId === sessionId)
    const agent = sessionId === undefined
      ? undefined
      : agents.source.getSnapshot().archives.find(archive => archive.sessionId === sessionId)
    const team = sessionId === undefined
      ? undefined
      : agents.source.getSnapshot().teamArchives.find(archive => archive.sessionId === sessionId)
    if (sessionId === undefined || (bound === undefined && agent === undefined && team === undefined)) {
      throw new Error('QuantSkills：请先选择一个 技能、专家 或 专家团 会话。')
    }
    const session = ctx.sessions.binding(sessionId)?.session
    if (session === undefined) throw new Error('QuantSkills：当前会话不可用。')
    const result = await session.prompt([{ type: 'text', text }], 'queue')
    if (!result.ok) throw new Error(`QuantSkills 提示失败：${result.error.code}: ${result.error.message}`)
  }
  const startTask = async (text: string, assetName?: string): Promise<QuantSkillsTaskStartResult> => {
    if (catalog.source.getSnapshot().phase !== 'ready') await catalog.refresh()
    const snapshot = catalog.source.getSnapshot()
    const skills = snapshot.assets.filter(asset => asset.projectType === 'skill')
    if (skills.length === 0) {
      return Object.freeze({
        kind: 'creation',
        message: '官方目录目前没有可供比较的 技能，我可以按你的需求从零创建。',
      })
    }
    const forced = assetName === undefined ? undefined : skills.find(asset => asset.name === assetName)
    if (assetName !== undefined && forced === undefined) {
      throw new Error(`QuantSkills：所选 技能「${assetName}」已不在官方目录中。`)
    }
    if (forced === undefined) {
      const decision = await matchSkillForTask(text, skills)
      if (decision.kind === 'clarify') {
        return Object.freeze({
          kind: 'clarification',
          message: decision.message,
          question: decision.question,
          options: decision.options,
        })
      }
      if (decision.kind === 'create') {
        return Object.freeze({ kind: 'creation', message: decision.message })
      }
      return Object.freeze({
        kind: 'recommendations',
        message: decision.message,
        suggestions: Object.freeze(decision.recommendations.map(({ skill, reason }) => Object.freeze({
          asset: skill.name,
          title: skill.title,
          reason,
        }))),
      })
    }
    const selected = forced
    let version = snapshot.versionsByAsset[selected.name]?.find(candidate => candidate.exposure === 'skill-registry')
    version ??= await catalog.install(selected)
    if (version === undefined || version.exposure !== 'skill-registry') {
      throw new Error(`QuantSkills：无法安装推荐 技能「${selected.title}」。`)
    }
    await createBoundSession(version.versionId as QuantSkillsInstalledVersionId, text)
    return Object.freeze({ kind: 'started', asset: selected.name, title: selected.title })
  }

  if (options.mode === 'standalone') {
    ctx.effect(
      () => ctx.slots.register({
        name: 'sidebar',
        priority: -20,
        children: {
          'sidebar.footer.action': { kind: 'list', scope: 'root' },
        },
        inject: (): QuantSkillsRailInjected => ({
          hooks: { store: view.store, notifications: notifications.store },
          actions: viewActions,
          collapse: () => { layout.toggleSidebar() },
        }),
      }, QuantSkillsRail),
      'ui-quantskills: standalone navigation rail',
    )
  }

  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions', id: 'quantskills-favorite', order: 20,
    inject: (): SessionFavoriteInjected => ({
      hooks: { sessions: ctx.sessions.list, view: view.store, agents: agents.source, skills: boundSessions.source },
      toggle: viewActions.setFavoriteAssetIds,
    }),
  }, SessionFavorite))
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions', id: 'quantskills-authoring-review', order: 10,
    inject: (): AuthoringReviewInjected => ({
      hooks: { sessions: ctx.sessions.list },
      commit: async (sessionId, toolCallId, digest) => {
        const result = await unwrapRemote<QuantSkillsAuthoringCommitResult>(
          ctx.remote.quantSkillsSessions.authoringCommit({ sessionId, toolCallId, expectedTreeDigest: digest as QuantSkillsTreeDigest }),
        )
        await Promise.all([catalog.refreshInstalled(), agents.refresh()])
        return result
      },
      start: async result => {
        if (result.kind === 'skill') await createBoundSession(result.version.versionId)
        else if (result.kind === 'agent') await startAgentSession(result.agent)
        else await startAgentTeamSession(result.team)
      },
      openLibrary: kind => {
        if (kind === 'skill') { try { localStorage.setItem('quantskills.skillLibrarySource', 'mine') } catch { /* Optional preference. */ } }
        view.actions.navigate(kind === 'skill' ? 'skills' : kind === 'agent-team' ? 'teams' : 'agents')
        if (kind !== 'skill') view.actions.setAgentWorkspaceTab(kind === 'agent-team' ? 'teams' : 'mine')
      },
      focusComposer: () => { document.querySelector<HTMLTextAreaElement>('[data-composer-card] textarea:not(:disabled)')?.focus() },
    }),
  }, AuthoringReview))
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock', id: 'quantskills-contest-review', order: 15,
    inject: (): ContestReviewInjected => ({ hooks: { sessions: ctx.sessions.list }, access: contestAccess,
      openContest: () => viewActions.navigate('contest'),
    }),
  }, ContestReview))
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock', id: 'quantskills-factor-contest-review', order: 16,
    inject: (): FactorReviewInjected => ({ hooks: { sessions: ctx.sessions.list }, access: factorContestAccess,
      openContest: () => { sessionStorage.setItem('quantstudio-competition', 'factor'); viewActions.navigate('contest') },
    }),
  }, FactorContestReview))

  const resultTrigger: { current: HTMLElement | null } = { current: null }
  ctx.effect(() => bindQuantSkillsResultMentionClicks(document, (path, trigger) => {
    if (resultPreviewRank(path) >= 4) return false
    const sessionId = ctx.sessions.list.getSnapshot().current
    if (sessionId === undefined) return false
    const sessionSnapshot = boundSessions.source.getSnapshot()
    const agentSnapshot = agents.source.getSnapshot()
    const owned = sessionSnapshot.plainArchives.some(archive => archive.sessionId === sessionId)
      || sessionSnapshot.archives.some(archive => archive.sessionId === sessionId)
      || agentSnapshot.archives.some(archive => archive.sessionId === sessionId)
      || agentSnapshot.teamArchives.some(archive => archive.sessionId === sessionId)
    if (!owned) return false
    resultTrigger.current = trigger
    view.actions.requestResultPreview(sessionId, path)
    if (options.mode === 'native-plugin') view.actions.openPluginConversation()
    layout.openResults()
    notifications.actions.acknowledge(sessionId)
    return true
  }), 'ui-quantskills: open conversation result mentions in the workbench')
  ctx.slots.inject(
    'conversation.session.header.actions',
    () => ctx.slots.register({
      name: 'conversation.session.header.actions',
      id: 'quantskills-results',
      order: 40,
      inject: (): QuantSkillsResultActionInjected => ({
        open: (trigger) => {
          resultTrigger.current = trigger
          if (options.mode === 'native-plugin') view.actions.openPluginConversation()
          layout.openResults()
        },
        complete: (sessionId) => {
          resultTrigger.current = null
          if (options.mode === 'native-plugin') view.actions.openPluginConversation()
          layout.openResults()
          notifications.actions.acknowledge(sessionId)
        },
      }),
    }, QuantSkillsResultAction),
  )

  ctx.slots.inject(
    'quantskills.results',
    () => ctx.slots.register({
      name: 'quantskills.results',
      inject: (sessionId: SessionId): QuantSkillsResultInjected => ({
        hooks: { resultRequest: view.store },
        close: () => { layout.closeResults() },
        triggerRef: resultTrigger,
        docked: options.mode === 'native-plugin',
        acknowledgePreviewFocus: (sequence) => {
          view.actions.acknowledgeResultPreviewFocus(sessionId, sequence)
        },
        listFiles: async (signal): Promise<readonly QuantSkillsPreparedResultArtifact[]> => preparedResultArtifacts(
          await unwrapRemote<QuantSkillsResultPrepareResult>(
            ctx.remote.quantSkillsSessions.resultList({ sessionId }, signal),
          ),
        ),
        prepareFiles: async (paths, signal): Promise<readonly QuantSkillsPreparedResultArtifact[]> => {
          const prepared = await unwrapRemote<QuantSkillsResultPrepareResult>(
            ctx.remote.quantSkillsSessions.resultPrepare({ sessionId, paths }, signal),
          )
          return preparedResultArtifacts(prepared)
        },
        openFile: async (path) => {
          const cwd = ctx.sessions.list.getSnapshot().byId[sessionId]?.cwd
          await unwrapRemote(ctx.remote.session.openWorkspacePath({ path: resolveWorkspacePath(cwd, path) }))
        },
        saveFileAs: async (path: string) => { artifactDownload(sessionId, path) },
        previewFile: path => unwrapRemote<QuantSkillsResultPreview>(
          ctx.remote.quantSkillsSessions.resultPreview({ sessionId, path }),
        ).catch((error: unknown) => {
          console.warn('QuantSkills result preview:', error instanceof Error ? error.message.slice(0, 700) : String(error))
          throw error
        }),
        openOutputDirectory: async (path) => {
          const normalized = path?.replaceAll('\\', '/')
          const slash = normalized?.lastIndexOf('/') ?? -1
          const directory = slash > 0 ? normalized?.slice(0, slash) : '.'
          view.actions.requestResultPreview(sessionId, directory ?? '.')
          layout.openResults()
        },
        continueWithResults: async (paths) => {
          const skill = boundSessions.source.getSnapshot().archives.find(item => item.sessionId === sessionId)
          const archivedAgent = agents.source.getSnapshot().archives.find(item => item.sessionId === sessionId)
          const archivedTeam = agents.source.getSnapshot().teamArchives.find(item => item.sessionId === sessionId)
          let nextId: SessionId
          if (skill !== undefined) {
            nextId = await createBoundSession(skill.binding.versionId)
          } else if (archivedAgent !== undefined) {
            const definition = agents.source.getSnapshot().definitions
              .find(item => item.agentId === archivedAgent.agent.agentId)
            if (definition === undefined) throw new Error('QuantSkills：当前 专家 定义不可用于创建后续会话。')
            nextId = await startAgentSession(definition)
          } else if (archivedTeam !== undefined) {
            const definition = agents.source.getSnapshot().teams
              .find(item => item.teamId === archivedTeam.team.teamId)
            if (definition === undefined) throw new Error('QuantSkills：当前 专家团 定义不可用于创建后续会话。')
            nextId = await startAgentTeamSession(definition)
          } else {
            throw new Error('QuantSkills：结果所属会话不可用。')
          }
          const next = ctx.sessions.binding(nextId)
          if (next === undefined || conversation === undefined) throw new Error('QuantSkills：后续会话尚未就绪。')
          const input = conversation.input.for(next.ctx)
          input.setDraft(`${input.state.getSnapshot().draft}\n\n来源会话：${sessionId}\n请继续处理以下同一工作区内的产物：\n${paths.map(path => `- ${path}`).join('\n')}`)
        },
      }),
    }, QuantSkillsResultPanel),
  )

  ctx.slots.inject(
    'tool.call.toolview',
    () => ctx.slots.register({
      name: 'tool.call.toolview',
      key: 'quantskills_team_draft',
      inject: (sessionId: SessionId): QuantSkillsTeamDraftCardInjected => ({
        hooks: { agents: agents.source, sessions: ctx.sessions.list },
        sessionId,
        commitAuthoring: async (toolCallId, treeDigest) => {
          const result = await unwrapRemote<QuantSkillsAuthoringCommitResult>(
            ctx.remote.quantSkillsSessions.authoringCommit({
              sessionId,
              toolCallId,
              expectedTreeDigest: treeDigest as QuantSkillsTreeDigest,
            }),
          )
          await agents.refresh()
          return result
        },
        startAgentTeamSession: async (definition) => { await startAgentTeamSession(definition) },
        openAgentTeamBuilder: (seed) => { view.actions.requestAgentTeamCreation(seed) },
        focusComposer: () => {
          document.querySelector<HTMLTextAreaElement>('[data-composer-card] textarea:not(:disabled)')?.focus()
        },
      }),
    }, QuantSkillsTeamDraftCard),
  )

  ctx.slots.inject(
    'tool.call.toolview',
    () => ctx.slots.register({
      name: 'tool.call.toolview',
      key: 'quantskills_asset_draft',
      inject: (sessionId: SessionId): QuantSkillsAssetDraftCardInjected => ({
        hooks: { sessions: ctx.sessions.list },
        sessionId,
        commitAuthoring: async (toolCallId, treeDigest) => {
          const result = await unwrapRemote<QuantSkillsAuthoringCommitResult>(
            ctx.remote.quantSkillsSessions.authoringCommit({
              sessionId,
              toolCallId,
              expectedTreeDigest: treeDigest as QuantSkillsTreeDigest,
            }),
          )
          await Promise.all([catalog.refreshInstalled(), agents.refresh()])
          return result
        },
        startSkill: async (version) => {
          await createBoundSession(version.versionId)
        },
        startAgent: async (definition) => { await startAgentSession(definition) },
        openManualAgent: () => {
          view.actions.navigate('agents')
          view.actions.setAgentWorkspaceTab('mine')
        },
        focusComposer: () => {
          document.querySelector<HTMLTextAreaElement>('[data-composer-card] textarea:not(:disabled)')?.focus()
        },
      }),
    }, QuantSkillsAssetDraftCard),
  )

  ctx.slots.inject(
    'quantskills.page',
    () => ctx.slots.register({
      name: 'quantskills.page',
      inject: (): QuantSkillsAppInjected => ({
        managedWorkspace: options.mode === 'native-plugin',
        hooks: {
          store: view.store,
          catalog: catalog.source,
          boundSessions: boundSessions.source,
          agents: agents.source,
        },
        actions: viewActions,
        refreshCatalog: async () => {
          await Promise.all([catalogAutoChecker.checkNow(), catalog.refreshInstalled()])
        },
        applicationUpdateStatus: () => unwrapRemote(ctx.remote.quantSkills.applicationUpdateStatus()),
        applicationUpdateCheck: (request: QuantSkillsApplicationUpdateCheckRequest) => unwrapRemote(
          ctx.remote.quantSkills.applicationUpdateCheck(request),
        ),
        applicationUpdateStart: () => unwrapRemote(ctx.remote.quantSkills.applicationUpdateStart()),
        // dshmarket 1.45.1 exposes a self-contained, closure-bound section.
        // It owns its locale, request state and error boundary; no child slots or store
        // are borrowed/redeclared here, preserving the stock settings owner.
        renderPluginMarket: () => {
          const entry = ctx.slots.entriesOfSlot('settings.section').find(item => item.options.id === 'market')
          if (!entry || entry.children || entry.store) return createElement('p', { role: 'status' }, '插件市场尚未就绪，请稍后重新打开设置。')
          return createElement(entry.component as ComponentType<{ close: () => void }>, { close: () => view.actions.navigate('home') })
        },
        databaseAccess: {
          list: () => unwrapRemote(ctx.remote.pandaMcp.databaseList()),
          import: input => unwrapRemote(ctx.remote.pandaMcp.databaseImport(input)),
          fetch: input => unwrapRemote(ctx.remote.pandaMcp.databaseFetch(input)),
          preview: id => unwrapRemote(ctx.remote.pandaMcp.databasePreview({ id })),
          query: input => unwrapRemote(ctx.remote.pandaMcp.databaseQuery(input)),
          refresh: id => unwrapRemote(ctx.remote.pandaMcp.databaseRefresh({ id })),
          remove: id => unwrapRemote(ctx.remote.pandaMcp.databaseRemove({ id })),
          categorize: (id, category) => unwrapRemote(ctx.remote.pandaMcp.databaseCategorize({ id, category })),
        },
        contestAccess,
        flyAccess,
        factorContestAccess,
        modelAccess: request => unwrapRemote(ctx.remote.quantSkillsSessions.modelsAccess(request)),
        readAssetReadme,
        installAsset: asset => catalog.install(asset).then(() => {}),
        uninstallAsset: assetId => catalog.uninstall(assetId),
        uninstallAgent: async request => {
          try { await unwrapRemote(ctx.remote.quantSkillsSessions.agentUninstall(request)) }
          finally { await Promise.all([agents.refresh(), catalog.refreshInstalled()]) }
        },
        openSession,
        startSession: () => startPlainSession(),
        startSkillSession,
        startBoundSession,
        readSkillDeclaration: (versionId, signal) => unwrapRemote(ctx.remote.quantSkills.manualSkillRead(versionId as QuantSkillsInstalledVersionId, signal)),
        manualSkillSave: async request => {
          const saved = await unwrapRemote<HostInstalledVersion>(ctx.remote.quantSkills.manualSkillSave(request))
          await catalog.refresh()
          return saved
        },
        createAgent: request => agents.create(request),
        updateAgent: request => agents.update(request),
        deleteAgent: request => agents.delete(request),
        startAgentSession,
        createAgentTeam: request => agents.createTeam(request),
        updateAgentTeam: request => agents.updateTeam(request),
        deleteAgentTeam: request => agents.deleteTeam(request),
        startAgentTeamSession,
        testAgent: definition => startAgentSession(
          definition,
          '这是一个隔离测试会话。请验证角色、权限、模型和 技能 编排是否加载成功；只汇报检查结果，不执行真实交易或外部副作用。',
        ),
        listAgentModels,
        generateAgentRole,
        installAgent,
        refreshAgents: () => agents.refresh(),
        refreshBoundSessions: () => boundSessions.refresh(),
        workspaceStatus: () => {
          const preferredWorkspaceId = view.store.getSnapshot().defaultWorkspaceId as WorkspaceId | undefined
          return unwrapRemote<QuantSkillsWorkspaceStatusResult>(ctx.remote.quantSkillsSessions.workspaceStatus({
            ...(preferredWorkspaceId === undefined ? {} : { preferredWorkspaceId }),
          }))
        },
        setDefaultWorkspace: async (workspaceId) => {
          if (workspaceId !== undefined) {
            const available = ctx.workspaces.list.getSnapshot().items.some(item => item.workspaceId === workspaceId)
            if (!available) throw new Error('所选工作区已不可用。')
          }
          if (workspaceId === undefined) await preferences.unset(QUANTSKILLS_DEFAULT_WORKSPACE_ID_FIELD)
          else await preferences.set(QUANTSKILLS_DEFAULT_WORKSPACE_ID_FIELD, workspaceId)
          viewActions.setDefaultWorkspaceId(workspaceId)
        },
        pandaMcpStatus: pandaMcp.status,
        authenticatePandaMcp: pandaMcp.authenticate,
        refreshPandaMcp: pandaMcp.refresh,
        logoutPandaMcp: pandaMcp.logout,
        startAuthoringSession,
        openAgentTeamBuilder: (seed) => { view.actions.requestAgentTeamCreation(seed) },
        send,
        startTask,
      }),
    }, QuantSkillsApp),
  )

  ctx.effect(() => {
    void catalog.refreshCatalog().finally(() => { catalogAutoChecker.start() })
    void catalog.refreshInstalled()
    void boundSessions.refresh()
    void agents.refresh()
    return () => {
      catalogAutoChecker.dispose()
      catalog.dispose()
    }
  }, 'ui-quantskills: catalog, bound Session, and Agent state refresh')

  ctx.effect(() => {
    const currentSessionIds = (): string => Object.keys(ctx.sessions.list.getSnapshot().byId)
      .sort()
      .join('\u0000')
    let observedSessionIds = currentSessionIds()
    const refresh = (): void => {
      const nextSessionIds = currentSessionIds()
      if (nextSessionIds === observedSessionIds) return
      observedSessionIds = nextSessionIds
      void Promise.all([boundSessions.refresh(), agents.refresh()])
    }
    return ctx.sessions.list.subscribe(refresh)
  }, 'ui-quantskills: refresh QuantSkills projections when the native Session catalog changes')

  ctx.effect(() => {
    const refresh = (): void => { void boundSessions.refresh() }
    window.addEventListener('focus', refresh)
    return () => { window.removeEventListener('focus', refresh) }
  }, 'ui-quantskills: refresh bound Sessions when the browser regains focus')

  ctx.effect(() => {
    const refresh = (): void => { void agents.refresh() }
    window.addEventListener('focus', refresh)
    return () => { window.removeEventListener('focus', refresh) }
  }, 'ui-quantskills: refresh Agents when the browser regains focus')

}

/**
 * Mount QuantSkills in the composition selected by the surrounding DSH shell.
 *
 * The stock shell declares `shell.overlay` before feature plugins load. The
 * standalone bundle deliberately disables that owner, so the same client
 * package can preserve the standalone root while the native plugin remains an
 * additive application inside an installed DSH profile.
 *
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const mode: QuantSkillsApplicationMode = ctx.slots.spec('shell.overlay') === undefined
    ? 'standalone'
    : 'native-plugin'
  mountQuantSkillsApplication(ctx, { mode })
}

/**
 * Return the neutral visible name of the internal authoring Agent.
 *
 * @param kind - QuantSkills asset kind being authored.
 * @returns The visible name stored on the authoring Agent definition.
 */
export function quantSkillsAuthoringAgentName(kind: QuantSkillsAuthoringKind): string {
  return kind === 'skill' ? '技能 创作' : kind === 'agent' ? '专家 创作' : '专家团 创作'
}

/**
 * Return the durable role instruction for one QuantSkills authoring Agent.
 * @param kind - QuantSkills asset kind being authored.
 * @returns The role text stored on the internal authoring Agent.
 */
export function quantSkillsAuthoringRole(kind: QuantSkillsAuthoringKind): string {
  if (kind === 'agent-team') {
    return [
      '你负责设计并创建 专家团。用 ask_user_question 询问卡补齐缺少的目标、输入和交付要求，每次最多三个问题；已提供的信息不要重复询问。',
      '信息充分后自行设计 Lead 与成员职责。先调用 quantskills_team_draft 的 list-agents；若缺少角色，调用 create-agents 创建对应 专家，不要把创建工作交回用户。',
      '模型默认跟随当前会话；只有用户明确指定时才配置每个角色的模型和推理强度。创建成员必须继承当前会话权限。',
      '使用工具返回的精确 专家 revision，通过 prepare 生成结构化团队草稿。准备完成后系统会自动弹出最终确认窗口；简短提示用户点击“确认生成”即可，不要要求重复口头确认，不要描述不存在的按钮或让用户翻找工具记录，不要展示 treeDigest 等技术细节。团队定义在确认后保存，不要提前声称团队已创建或启动。',
      '如实说明不兼容配置或版本冲突。用户也可在专家 → 专家团 中手动编排。',
    ].join('\n\n')
  }
  const declaration = kind === 'skill' ? 'SKILL.md' : 'AGENTS.md'
  const identity = kind === 'skill' ? 'skill-<slug>' : 'agent-<slug>'
  const dependencyRule = kind === 'skill'
    ? '技能 可以包含 references、scripts 和 assets；正文必须说明触发条件、输入、步骤、产物和失败处理。'
    : '专家 的 技能 依赖写入 quantSkills.requires，只能引用现有的 skill-* 技术 ID；正文必须说明角色、编排、限制和交付物。'
  return [
    `你正在协助用户创建 ${kind === 'skill' ? '技能' : '专家'}。每次创作在独立会话中完成，产物面向本地使用并兼容 QuantSkills 原生仓库。`,
    '先用自然语言确认目标、适用场景、数据来源、预期产物和风险限制。信息不足时继续对话，不要用大表单阻断用户。',
    '用户可见的专家与团队名称必须是简洁中文；技术 slug 只用作 ID。AGENTS.md 的一级标题写中文名称，name 与团队 name 使用中文。',
    `确认后在当前工作区的 quantskills-drafts/${identity}/ 下创建完整资产，根声明文件必须是 ${declaration}。不要修改或推送 QuantSkills 官方仓库。`,
    `技术 ID 使用 ${identity} 格式；YAML frontmatter 至少包含 name 和 description。${dependencyRule}`,
    '声明正文中的双花括号、示例代码和模板片段保持原文；不要假定宿主会对正文做第二次变量解析。',
    '文件完成后调用 quantskills_asset_draft 的 prepare 冻结草稿。系统会在回复完成后弹出最终确认窗口；简短提示点击“确认生成”即可，不要再要求口头确认或让用户翻找确认卡。确认前不要声称已安装。兼容性问题应自行检查处理，只向用户说明确实影响使用的问题。',
  ].join('\n\n')
}

/**
 * Return the first user task for one QuantSkills authoring conversation.
 * @param kind - QuantSkills asset kind being authored.
 * @param initialRequest - Optional home-page requirement used as confirmed starting context.
 * @returns The opening task submitted after Session creation.
 */
export function quantSkillsAuthoringOpening(
  kind: QuantSkillsAuthoringKind,
  initialRequest?: string,
): string {
  const opening = kind === 'agent-team'
    ? '创建一个 专家团。先用询问卡补齐团队目标、主要输入和交付要求，每次最多三个问题。随后自行设计 Lead 与成员职责，使用 quantskills_team_draft 的 list-agents 查询现有角色，使用 create-agents 创建缺少的角色，再使用 prepare 生成团队草稿。模型默认跟随当前会话；用户指定时才分别配置。不要要求用户填写技术 ID 或替你创建成员。最后说明分工并展示团队确认卡。'
    : `开始一个新的 ${kind === 'skill' ? '技能' : '专家'} 创作任务。请先用不超过三个问题了解我想解决的问题、主要输入和期望产物；在我回答前不要写文件。`
  const request = initialRequest?.trim()
  return request === undefined || request === ''
    ? opening
    : `${opening}\n\n这是用户在首页提交的初始需求：${request}\n请复述已知需求，只追问仍缺少的信息。`
}

const PANDA_CAPABILITY_ASSET_ID = 'skill-pandadata-api'

/**
 * Determine whether one catalog asset transitively depends on the standard
 * PandaData capability Skill.
 * @param asset - asset selected for a Skill or Agent launch.
 * @param assets - current trusted catalog snapshot.
 * @returns whether the launch requires Panda authentication preflight.
 */
export function quantSkillsAssetRequiresPanda(
  asset: QuantSkillsAsset,
  assets: readonly QuantSkillsAsset[],
): boolean {
  const byId = new Map(assets.map(candidate => [candidate.name, candidate]))
  const visited = new Set<string>()
  const visit = (candidate: QuantSkillsAsset): boolean => {
    if (candidate.name === PANDA_CAPABILITY_ASSET_ID) return true
    if (visited.has(candidate.name)) return false
    visited.add(candidate.name)
    return candidate.requires.some((requirement) => {
      if (requirement === PANDA_CAPABILITY_ASSET_ID) return true
      const dependency = byId.get(requirement)
      return dependency !== undefined && visit(dependency)
    })
  }
  return visit(asset)
}
