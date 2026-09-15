/** Client-safe QuantSkills session binding and archive types. */

import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { Branded } from '@deepseek-ai/dsh-brand'
import type { AttachmentId } from '@deepseek-ai/dsh-attachment/types'
export type { ContestIdentity, ContestStatus, ContestQuery, ContestData, ContestPlan, ContestOrder, ContestPrepareRequest, ContestInspection } from './contest-types.ts'

/** QuantSkills catalog asset identity. */
export type QuantSkillsAssetId = Branded<'QuantSkillsAssetId'>
/** Exact approved Git commit. */
export type QuantSkillsCommitSha = Branded<'QuantSkillsCommitSha'>
/** Exact Host-installed asset-version identity. */
export type QuantSkillsInstalledVersionId = Branded<'QuantSkillsInstalledVersionId'>
/** SHA-256 digest of the validated installed Git tree. */
export type QuantSkillsTreeDigest = Branded<'QuantSkillsTreeDigest'>
/** Host-owned user Agent identity. */
export type QuantSkillsAgentId = Branded<'QuantSkillsAgentId'>
/** Host-owned user Agent Team identity. */
export type QuantSkillsAgentTeamId = Branded<'QuantSkillsAgentTeamId'>

/** Exact PandaData runtime frozen into a QuantSkills Session. */
export interface QuantSkillsPandaRuntimeBinding {
  readonly environmentId: string
  readonly sdkVersion: string
  readonly pythonVersion: string
  readonly apiFingerprint: string
}

/** Asset family owned by one dedicated AI authoring Session. */
export type QuantSkillsAuthoringKind = 'skill' | 'agent' | 'agent-team'

/** User-library provenance kept outside immutable execution snapshots. */
export interface QuantSkillsLibrarySourceRecord {
  readonly id: string
  readonly kind: 'agent' | 'agent-team'
  readonly source: 'personal' | 'installed' | 'internal'
  readonly method: 'manual' | 'ai' | 'installation' | 'internal' | 'recovered'
}

/** Once-only declaration that enables authoring tools for one Session. */
export interface QuantSkillsAuthoringStarted {
  readonly kind: QuantSkillsAuthoringKind
}

/** Request to commit one successful logged authoring draft result. */
export interface QuantSkillsAuthoringCommitRequest {
  readonly sessionId: SessionId
  readonly toolCallId: string
  readonly expectedTreeDigest: QuantSkillsTreeDigest
}

/** Host persistence state, distinct from model execution state. */
export interface QuantSkillsAuthoringStatus {
  readonly phase: 'draft' | 'pending' | 'committed' | 'cancelled'
}

/** Client-safe local projection of one immutable authored asset version. */
export interface QuantSkillsAuthoringInstalledVersion {
  readonly versionId: QuantSkillsInstalledVersionId
  readonly assetId: QuantSkillsAssetId
  readonly kind: 'skill' | 'agent'
  readonly repository: string
  readonly commit: QuantSkillsCommitSha
  readonly declaration: 'SKILL.md' | 'AGENTS.md'
  readonly treeDigest: QuantSkillsTreeDigest
  readonly fileCount: number
  readonly totalBytes: number
  readonly installedAt: number
  readonly exposure: 'skill-registry' | 'agent-template'
  readonly origin: 'catalog' | 'local-authoring'
  readonly declarationTitleZh?: string
}

/** Durable outcome produced only after explicit user confirmation. */
export type QuantSkillsAuthoringCommitResult =
  | { readonly kind: 'skill'; readonly version: QuantSkillsAuthoringInstalledVersion }
  | {
    readonly kind: 'agent'
    readonly version: QuantSkillsAuthoringInstalledVersion
    readonly agent: QuantSkillsAgentDefinition
  }
  | { readonly kind: 'agent-team'; readonly team: QuantSkillsAgentTeamDefinition }

/** Logged idempotency identity and published result for one confirmed authoring draft. */
export interface QuantSkillsAuthoringCommitted {
  readonly toolCallId: string
  readonly treeDigest: QuantSkillsTreeDigest
  readonly result: QuantSkillsAuthoringCommitResult
}

/** One registered Host Workspace accepted for new QuantSkills Sessions. */
export interface QuantSkillsWorkspaceTarget {
  readonly workspaceId: WorkspaceId
  readonly path: string
  readonly title: string
}

/** Optional preferred Workspace used by status and resolution requests. */
export interface QuantSkillsWorkspaceRequest {
  readonly preferredWorkspaceId?: WorkspaceId
}

/** Read-only projection of the managed and optional preferred Workspace. */
export interface QuantSkillsWorkspaceStatusResult {
  readonly managedPath: string
  readonly managedWorkspace?: QuantSkillsWorkspaceTarget
  readonly preferredWorkspace?: QuantSkillsWorkspaceTarget
  readonly preferredMissing: boolean
}

/** Explicit Workspace selected for a new plugin Session. */
export interface QuantSkillsWorkspaceResolveResult {
  readonly workspace: QuantSkillsWorkspaceTarget
  readonly source: 'preferred' | 'managed'
  readonly recoveredPreferredWorkspaceId?: WorkspaceId
}

/** Durable identity of the exact installed Skill version composed for one session. */
export interface QuantSkillsSessionBinding {
  readonly assetId: QuantSkillsAssetId
  readonly versionId: QuantSkillsInstalledVersionId
  readonly commit: QuantSkillsCommitSha
  readonly treeDigest: QuantSkillsTreeDigest
}

/** Request for atomically creating or idempotently adopting one Skill-bound session. */
export interface QuantSkillsSessionCreateRequest {
  readonly sessionId: SessionId
  readonly versionId: QuantSkillsInstalledVersionId
  readonly workspaceId?: WorkspaceId
  readonly cwd?: string
  readonly agentPreset?: string
}

/** Successful Skill-bound session creation or idempotent adoption. */
export interface QuantSkillsSessionCreateResult {
  readonly sessionId: SessionId
  readonly binding: QuantSkillsSessionBinding
  readonly agentPreset?: string
}

/** Request to restore the complete QuantSkills composition of one existing Session. */
export interface QuantSkillsSessionEnsureRequest {
  readonly sessionId: SessionId
}

/** Existing Session identity after its QuantSkills composition is live. */
export interface QuantSkillsSessionEnsureResult {
  readonly sessionId: SessionId
}

/** Product-owned purpose of a QuantSkills Session without a frozen asset composition. */
export type QuantSkillsPlainSessionPurpose = 'ordinary' | 'role-helper' | 'contest'

/** Durable ownership marker for a QuantSkills Session without a frozen asset composition. */
export interface QuantSkillsPlainSessionBinding {
  readonly purpose: QuantSkillsPlainSessionPurpose
  readonly contest?: import('./contest-types.ts').ContestIdentity | undefined
  readonly contestConversation?: 'main' | 'topic' | undefined
}

/** Request for atomically creating or idempotently adopting one plain QuantSkills Session. */
export interface QuantSkillsPlainSessionCreateRequest {
  readonly sessionId: SessionId
  readonly purpose: QuantSkillsPlainSessionPurpose
  readonly contestConversation?: 'main' | 'topic'
  readonly workspaceId?: WorkspaceId
  readonly cwd?: string
  readonly agentPreset?: string
}

export interface ContestSessionOpenRequest {
  readonly sessionId: SessionId
  readonly workspaceId?: WorkspaceId
  readonly cwd?: string
  readonly topic?: boolean
}

export interface ContestSessionOpenResult {
  readonly sessionId: SessionId
  readonly binding: QuantSkillsPlainSessionBinding
  readonly created: boolean
}

/** Successful plain QuantSkills Session creation or idempotent adoption. */
export interface QuantSkillsPlainSessionCreateResult {
  readonly sessionId: SessionId
  readonly binding: QuantSkillsPlainSessionBinding
  readonly agentPreset?: string
}

/** One durable hot-plug transition for a Session-resident exact Skill version. */
export interface QuantSkillsResidentSkillChange {
  readonly operation: 'attach' | 'detach'
  readonly binding: QuantSkillsSessionBinding
  readonly changedAt: number
}

/** Request to attach one installed Skill version to a live QuantSkills Session. */
export interface QuantSkillsResidentSkillAttachRequest {
  readonly sessionId: SessionId
  readonly versionId: QuantSkillsInstalledVersionId
}

/** Request to detach the resident Skill currently occupying one asset identity. */
export interface QuantSkillsResidentSkillDetachRequest {
  readonly sessionId: SessionId
  readonly assetId: QuantSkillsAssetId
}

/** Authoritative resident Skill set returned after one hot-plug operation. */
export interface QuantSkillsResidentSkillResult {
  readonly skills: readonly QuantSkillsSessionBinding[]
}

/** Input controls supported by the client-safe QuantSkills parameter protocol. */
export type QuantSkillsPromptFormFieldType = 'text' | 'textarea' | 'select' | 'date' | 'number'

/** One label/value choice for a select parameter. */
export interface QuantSkillsPromptFormOption {
  readonly label: string
  readonly value: string
}

/** One declared parameter accepted by a QuantSkills prompt form. */
export interface QuantSkillsPromptFormField {
  readonly key: string
  readonly label: string
  readonly type: QuantSkillsPromptFormFieldType
  readonly required?: boolean
  readonly placeholder?: string
  readonly help?: string
  readonly default?: string | number
  readonly options?: readonly QuantSkillsPromptFormOption[]
}

/** Optional task input displayed above declared form fields. */
export interface QuantSkillsPromptFormTask {
  readonly placeholder?: string
  readonly required?: boolean
}

/** Valid version-one QuantSkills parameter form projected to clients. */
export interface QuantSkillsPromptFormV1 {
  readonly version: 1
  readonly task?: QuantSkillsPromptFormTask
  readonly fields: readonly QuantSkillsPromptFormField[]
  readonly promptTemplate: string
}

/** One deterministic compatibility conversion reported by the Host parser. */
export interface QuantSkillsPromptFormAdaptation {
  readonly code: 'number-default-string'
  readonly fieldKey: string
}

/** Non-blocking parse outcome for an optional QuantSkills parameter form. */
export type QuantSkillsPromptFormResult =
  | {
    readonly status: 'ready'
    readonly form: QuantSkillsPromptFormV1
    readonly adaptations?: readonly QuantSkillsPromptFormAdaptation[]
  }
  | { readonly status: 'invalid'; readonly reason: string }

/** One optional parameter form reachable from the addressed Session composition. */
export interface QuantSkillsPromptFormCapability {
  readonly assetId: QuantSkillsAssetId
  readonly versionId: QuantSkillsInstalledVersionId
  readonly source: 'skill' | 'agent'
  readonly promptForm: QuantSkillsPromptFormResult
}

/** Request for parameter forms authorized by one live QuantSkills Session. */
export interface QuantSkillsPromptFormListRequest {
  readonly sessionId: SessionId
}

/** Current exact-version parameter forms available to one Session. */
export interface QuantSkillsPromptFormListResult {
  readonly forms: readonly QuantSkillsPromptFormCapability[]
}

/** Primitive values accepted by the controlled Host-side prompt renderer. */
export type QuantSkillsPromptFormValue = string | number

/** Request to render one Session-authorized exact-version parameter form. */
export interface QuantSkillsPromptFormRenderRequest {
  readonly sessionId: SessionId
  readonly versionId: QuantSkillsInstalledVersionId
  readonly task?: string
  readonly values: Readonly<Record<string, QuantSkillsPromptFormValue>>
}

/** Plain user-message text produced by the controlled parameter renderer. */
export interface QuantSkillsPromptFormRenderResult {
  readonly text: string
}

/** Session archive list filters. */
export interface QuantSkillsSessionListRequest {
  readonly includeArchived?: boolean
}

/** Durable or live execution state projected for parallel-session control. */
export type QuantSkillsSessionRunState = 'idle' | 'running' | 'failed' | 'cancelled' | 'completed'

/** One real log-backed Skill conversation archive. */
export interface QuantSkillsSessionArchiveItem {
  readonly sessionId: SessionId
  readonly binding: QuantSkillsSessionBinding
  readonly createdAt: number
  readonly updatedAt: number
  readonly title?: string
  readonly cwd?: string
  readonly parentSessionId?: SessionId
  readonly archived: boolean
  readonly running: boolean
  readonly runState: QuantSkillsSessionRunState
}

/** One ordinary product-owned conversation that has no Skill, Agent, or Team composition. */
export interface QuantSkillsPlainSessionArchiveItem {
  readonly sessionId: SessionId
  readonly binding: QuantSkillsPlainSessionBinding
  readonly createdAt: number
  readonly updatedAt: number
  readonly title?: string
  readonly cwd?: string
  readonly parentSessionId?: SessionId
  readonly archived: boolean
  readonly running: boolean
  readonly runState: QuantSkillsSessionRunState
}

/** Frequent-Skill aggregation filters. */
export interface QuantSkillsFrequentRequest extends QuantSkillsSessionListRequest {
  readonly limit?: number
}

/** One Skill's usage derived from real bound conversation history. */
export interface QuantSkillsFrequentSkill {
  readonly assetId: QuantSkillsAssetId
  readonly sessionCount: number
  readonly lastUsedAt: number
  readonly recentSessionId: SessionId
}

/** How a user Agent chooses its ordered exact Skill composition. */
export type QuantSkillsAgentMode = 'dynamic' | 'fixed'

/** Model selection applied whenever one user Agent starts a Session. */
export interface QuantSkillsAgentModelSelection {
  readonly provider: string
  readonly model: string
  readonly reasoningEffort?: string
}

/** Host permission preset applied whenever one user Agent starts a Session. */
export type QuantSkillsAgentPermission = 'read-only' | 'workspace-write' | 'danger-full-access'

/** Durable Host-owned user Agent definition. */
export interface QuantSkillsAgentDefinition {
  readonly agentId: QuantSkillsAgentId
  readonly revision: number
  readonly name: string
  readonly role: string
  readonly mode: QuantSkillsAgentMode
  readonly model?: QuantSkillsAgentModelSelection
  readonly permission: QuantSkillsAgentPermission
  readonly sourceVersionId?: QuantSkillsInstalledVersionId
  readonly skills: readonly QuantSkillsSessionBinding[]
  readonly createdAt: number
  readonly updatedAt: number
}

/** Editable fields accepted when creating a user Agent. */
export interface QuantSkillsAgentCreateRequest {
  /** Explicitly create a hidden application helper; never inferred from its name. */
  readonly purpose?: 'authoring-helper'
  /** Explicit personal copy of a saved definition, checked before publication. */
  readonly copyFrom?: { readonly agentId: QuantSkillsAgentId; readonly expectedRevision: number }
  readonly name: string
  readonly role: string
  readonly mode: QuantSkillsAgentMode
  readonly model?: QuantSkillsAgentModelSelection
  readonly permission?: QuantSkillsAgentPermission
  readonly sourceVersionId?: QuantSkillsInstalledVersionId
  readonly versionIds: readonly QuantSkillsInstalledVersionId[]
}

/** Optimistic update of one durable user Agent. */
export interface QuantSkillsAgentUpdateRequest extends QuantSkillsAgentCreateRequest {
  readonly agentId: QuantSkillsAgentId
  readonly expectedRevision: number
}

/** Optimistic deletion of one durable user Agent. */
export interface QuantSkillsAgentDeleteRequest {
  readonly agentId: QuantSkillsAgentId
  readonly expectedRevision: number
}

/** Immutable Agent definition recorded in each Agent Session log. */
export type QuantSkillsAgentSessionBinding = QuantSkillsAgentDefinition

/** Request for atomically creating one Agent-composed Session. */
export interface QuantSkillsAgentSessionCreateRequest {
  readonly sessionId: SessionId
  readonly agentId: QuantSkillsAgentId
  readonly expectedRevision: number
  readonly workspaceId?: WorkspaceId
  readonly cwd?: string
  readonly agentPreset?: string
}

/** Successful Agent Session creation or idempotent adoption. */
export interface QuantSkillsAgentSessionCreateResult {
  readonly sessionId: SessionId
  readonly agent: QuantSkillsAgentSessionBinding
  readonly agentPreset?: string
}

/** Request for an Agent Session whose authoring purpose is recorded atomically at creation. */
export interface QuantSkillsAuthoringSessionCreateRequest extends QuantSkillsAgentSessionCreateRequest {
  readonly kind: QuantSkillsAuthoringKind
}

/** One real log-backed user Agent conversation archive. */
export interface QuantSkillsAgentSessionArchiveItem {
  readonly sessionId: SessionId
  readonly agent: QuantSkillsAgentSessionBinding
  readonly createdAt: number
  readonly updatedAt: number
  readonly title?: string
  readonly cwd?: string
  readonly parentSessionId?: SessionId
  readonly archived: boolean
  readonly running: boolean
  readonly runState: QuantSkillsSessionRunState
}

/** One immutable teammate slot in a saved Agent Team definition. */
export interface QuantSkillsAgentTeamMemberReference {
  readonly name: string
  readonly agentId: QuantSkillsAgentId
  readonly agentRevision: number
  readonly context: 'fresh' | 'fork'
  readonly model: QuantSkillsAgentTeamModelChoice
}

/** Explicit model policy frozen for one Agent Team role. */
export type QuantSkillsAgentTeamModelChoice =
  | { readonly kind: 'default' }
  | { readonly kind: 'fixed'; readonly selection: QuantSkillsAgentModelSelection }

/** Editable fields accepted when creating an Agent Team. */
export interface QuantSkillsAgentTeamCreateRequest {
  readonly name: string
  readonly description: string
  readonly leadAgentId: QuantSkillsAgentId
  readonly leadAgentRevision: number
  readonly leadModel: QuantSkillsAgentTeamModelChoice
  readonly members: readonly QuantSkillsAgentTeamMemberReference[]
}

/** Exact saved Agent revision selected by an AI-prepared Team draft. */
export interface AgentRevisionReference {
  readonly agentId: QuantSkillsAgentId
  readonly revision: number
}

/** One member proposed by an AI-prepared Team draft. */
export interface AgentTeamDraftMember {
  readonly name: string
  readonly responsibility: string
  readonly context: 'fresh' | 'fork'
  readonly agent: AgentRevisionReference
  readonly model: QuantSkillsAgentTeamModelChoice
}

/** One validation or matching message attached to an AI-prepared Team draft. */
export interface QuantSkillsAgentTeamDraftDiagnostic {
  readonly level: 'info' | 'warning' | 'error'
  readonly code: string
  readonly message: string
}

/** Session-local Team proposal that the Client durably creates for the authoring AI. */
export interface QuantSkillsAgentTeamDraft {
  readonly name: string
  readonly description: string
  readonly lead: AgentRevisionReference
  readonly leadModel: QuantSkillsAgentTeamModelChoice
  readonly members: readonly AgentTeamDraftMember[]
  readonly diagnostics: readonly QuantSkillsAgentTeamDraftDiagnostic[]
}

/** One routable model advertised to the Agent Team authoring model. */
export interface QuantSkillsAgentTeamDraftModelSummary {
  readonly provider: string
  readonly providerLabel: string
  readonly model: string
  readonly modelLabel: string
  readonly reasoningEfforts: readonly {
    readonly id: string
    readonly label: string
  }[]
}

/** Agent metadata exposed to the Team authoring model without granting mutation. */
export interface QuantSkillsAgentTeamDraftAgentSummary {
  readonly agentId: QuantSkillsAgentId
  readonly revision: number
  readonly name: string
  readonly role: string
  readonly mode: QuantSkillsAgentMode
  readonly model?: QuantSkillsAgentModelSelection
  readonly permission: QuantSkillsAgentPermission
  readonly skills: readonly QuantSkillsSessionBinding[]
}

/** Logged JSON result returned by the Agent Team authoring tool. */
export type QuantSkillsAgentTeamDraftToolResult =
  | {
    readonly kind: 'agents'
    readonly agents: readonly QuantSkillsAgentTeamDraftAgentSummary[]
    readonly models: readonly QuantSkillsAgentTeamDraftModelSummary[]
  }
  | {
    readonly kind: 'created-agents'
    readonly agents: readonly QuantSkillsAgentTeamDraftAgentSummary[]
    readonly createdCount: number
    readonly reusedCount: number
  }
  | {
    readonly kind: 'draft'
    readonly draft?: QuantSkillsAgentTeamDraft
    readonly diagnostics: readonly QuantSkillsAgentTeamDraftDiagnostic[]
  }

/** Optimistic replacement of one saved Agent Team. */
export interface QuantSkillsAgentTeamUpdateRequest extends QuantSkillsAgentTeamCreateRequest {
  readonly teamId: QuantSkillsAgentTeamId
  readonly expectedRevision: number
}

/** Optimistic deletion of one saved Agent Team. */
export interface QuantSkillsAgentTeamDeleteRequest {
  readonly teamId: QuantSkillsAgentTeamId
  readonly expectedRevision: number
}

/** Exact user Agent assigned to one immutable teammate name in a Team definition. */
export interface QuantSkillsAgentTeamSessionMember {
  readonly name: string
  readonly context: 'fresh' | 'fork'
  readonly agent: QuantSkillsAgentDefinition
  readonly model: QuantSkillsAgentTeamModelChoice
}

/** Durable Host-owned Agent Team definition with complete Agent snapshots. */
export interface QuantSkillsAgentTeamDefinition {
  readonly teamId: QuantSkillsAgentTeamId
  readonly revision: number
  readonly name: string
  readonly description: string
  readonly lead: QuantSkillsAgentDefinition
  readonly leadModel: QuantSkillsAgentTeamModelChoice
  readonly members: readonly QuantSkillsAgentTeamSessionMember[]
  readonly createdAt: number
  readonly updatedAt: number
}

/** Complete immutable Agent Team composition recorded in a Team Lead Session. */
export type QuantSkillsAgentTeamSessionBinding = QuantSkillsAgentTeamDefinition

/** Exact Team membership recorded in a continuable teammate Session. */
export interface QuantSkillsAgentTeamMemberSessionBinding {
  readonly teamId: QuantSkillsAgentTeamId
  readonly teamRevision: number
  readonly memberName: string
  readonly agent: QuantSkillsAgentDefinition
  readonly model: QuantSkillsAgentTeamModelChoice
}

/** Request for atomically creating one Agent Team Lead Session. */
export interface QuantSkillsAgentTeamSessionCreateRequest {
  readonly sessionId: SessionId
  readonly teamId: QuantSkillsAgentTeamId
  readonly expectedRevision: number
  readonly workspaceId?: WorkspaceId
  readonly cwd?: string
  readonly agentPreset?: string
}

/** Successful Agent Team Lead Session creation or idempotent adoption. */
export interface QuantSkillsAgentTeamSessionCreateResult {
  readonly sessionId: SessionId
  readonly team: QuantSkillsAgentTeamSessionBinding
  readonly agentPreset?: string
}

/** One real log-backed Agent Team conversation archive. */
export interface QuantSkillsAgentTeamSessionArchiveItem {
  readonly sessionId: SessionId
  readonly team: QuantSkillsAgentTeamSessionBinding
  readonly createdAt: number
  readonly updatedAt: number
  readonly title?: string
  readonly cwd?: string
  readonly parentSessionId?: SessionId
  readonly archived: boolean
  readonly running: boolean
  readonly runState: QuantSkillsSessionRunState
}

/** Parser disposition recorded for one immutable uploaded file. */
export type QuantSkillsFileParsing =
  | { readonly status: 'ready'; readonly kind: 'utf8-text' }
  | { readonly status: 'ready'; readonly kind: 'pdf' | 'office-document' | 'spreadsheet' }
  | { readonly status: 'unsupported'; readonly reason: string }
  | { readonly status: 'failed'; readonly reason: string }

/** Immutable generic-file reference owned and persisted by the QuantSkills plugin. */
export interface QuantSkillsFileAttachmentRef {
  readonly attachmentId: AttachmentId
  readonly mediaType: string
  readonly bytes: number
  readonly name: string
}

/** Generic-file admission limits enforced by the QuantSkills plugin. */
export interface QuantSkillsFileAttachmentLimits {
  readonly maxFileBytes: number
  readonly maxSessionFileBytes: number
}

/** Browser-encoded generic file accepted by the QuantSkills attachment Remote. */
export interface QuantSkillsEncodedFileAttachment {
  readonly data: string
  readonly mediaType: string
  readonly name: string
}

/** Durable Session ownership record for one uploaded generic file. */
export interface QuantSkillsSessionFileAttachment {
  readonly file: QuantSkillsFileAttachmentRef
  readonly parsing: QuantSkillsFileParsing
  readonly attachedAt: number
}

/** Session-addressed generic-file upload request. */
export interface QuantSkillsFileAttachRequest extends QuantSkillsEncodedFileAttachment {
  readonly sessionId: SessionId
}

/** Session-addressed generic-file directory request. */
export interface QuantSkillsFileListRequest {
  readonly sessionId: SessionId
}

/** Generic-file directory plus the Host-enforced admission limits. */
export interface QuantSkillsFileListResult {
  readonly files: readonly QuantSkillsSessionFileAttachment[]
  readonly limits: QuantSkillsFileAttachmentLimits
}

/** Session-authorized text attachment read request for browser preview. */
export interface QuantSkillsFileReadRequest {
  readonly sessionId: SessionId
  readonly attachmentId: string
}

/** Bounded UTF-8 text returned from an attachment proven to belong to the Session. */
export interface QuantSkillsFileReadResult {
  readonly file: QuantSkillsFileAttachmentRef
  readonly text: string
  readonly truncated: boolean
}

/** Session-authorized workspace result-preview request. */
export interface QuantSkillsResultPreviewRequest {
  readonly sessionId: SessionId
  readonly path: string
}

/** Candidate paths discovered from one QuantSkills conversation before workspace preview. */
export interface QuantSkillsResultPrepareRequest {
  readonly sessionId: SessionId
  readonly paths: readonly string[]
}

/** One Host-verified result path, or a user-safe reason that it cannot be previewed. */
export type QuantSkillsPreparedResult =
  | {
    readonly status: 'ready'
    readonly inputPath: string
    /** Canonical path relative to the addressed Session workspace. */
    readonly path: string
    /** Whether the Host copied an authorized external result into the Session workspace. */
    readonly archived: boolean
  }
  | {
    readonly status: 'unavailable'
    readonly inputPath: string
    readonly reason: string
  }

/** Batch outcome preserving the caller's candidate order. */
export interface QuantSkillsResultPrepareResult {
  readonly results: readonly QuantSkillsPreparedResult[]
}

/** A Session-workspace result rendered inline or opened through the local Host. */
export type QuantSkillsResultPreview =
  | {
    readonly kind: 'directory'
    readonly path: string
    readonly bytes: 0
    readonly entries: readonly {
      readonly name: string
      readonly path: string
      readonly type: 'file' | 'directory'
      readonly bytes?: number
    }[]
  }
  | {
    readonly kind: 'text'
    readonly path: string
    readonly mediaType: string
    readonly bytes: number
    readonly text: string
  }
  | {
    readonly kind: 'document'
    readonly path: string
    readonly mediaType: string
    readonly bytes: number
    readonly text: string
    readonly truncated: boolean
  }
  | {
    readonly kind: 'binary'
    readonly path: string
    readonly mediaType: 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'
    readonly bytes: number
    readonly data: string
    /** Authenticated same-Host stream used for PDFs that must not be buffered into RPC. */
    readonly url?: string
  }
  | {
    readonly kind: 'resource'
    readonly path: string
    readonly mediaType: string
    readonly bytes: number
    /** Authenticated, workspace-contained URL that streams the complete local file. */
    readonly url: string
    readonly presentation: 'pdf' | 'image' | 'audio' | 'video' | 'text' | 'external'
  }
  | {
    readonly kind: 'unsupported'
    readonly path: string
    readonly bytes: number
    readonly reason: string
  }

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /** Durable product ownership for a plain QuantSkills Session, or null for every other Session. */
    quantSkillsPlainSession: QuantSkillsPlainSessionBinding | null
    /** Exact QuantSkills version bound to this session, or null for an ordinary session. */
    quantSkillsSession: QuantSkillsSessionBinding | null
    /** Exact user Agent composition recorded for this session, or null for every other Session. */
    quantSkillsAgentSession: QuantSkillsAgentSessionBinding | null
    /** Exact Agent Team composition recorded for this Team Lead Session. */
    quantSkillsAgentTeamSession: QuantSkillsAgentTeamSessionBinding | null
    /** Exact Agent Team member composition recorded for this continuable child Session. */
    quantSkillsAgentTeamMember: QuantSkillsAgentTeamMemberSessionBinding | null
    /** Ordered exact Skill versions currently resident in this Session. */
    quantSkillsResidentSkills: readonly QuantSkillsSessionBinding[]
    /** Generic files durably attached to this QuantSkills Session. */
    quantSkillsAttachments: readonly QuantSkillsSessionFileAttachment[]
    /** Exact PandaData environment used by this QuantSkills Session. */
    quantSkillsPandaRuntime: QuantSkillsPandaRuntimeBinding | null
    /** Dedicated authoring purpose, or null for an ordinary Session. */
    quantSkillsAuthoring: QuantSkillsAuthoringKind | null
    /** Confirmed authoring publications in durable commit order. */
    quantSkillsAuthoringCommits: readonly QuantSkillsAuthoringCommitted[]
    /** Latest validated draft awaiting the user's explicit final confirmation. */
    quantSkillsAuthoringPending: { toolCallId: string; treeDigest: string; kind: QuantSkillsAuthoringKind; name: string; description: string; members: string[] } | null
  }
}
export type { ModelAccessRequest, ModelAccessResponse, ModelConnection, ModelConnectionDraft, ModelRecommendationRole, ModelServiceDefinition, ModelServiceRecommendation, ModelVerification } from './model-access-types.ts'
