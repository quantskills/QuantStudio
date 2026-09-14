/** Client-safe QuantSkills Host catalog, installation, and identifier types. */

import type { Branded } from '@deepseek-ai/dsh-brand'

/** Catalog identity assigned by the trusted QuantSkills publication. */
export type QuantSkillsAssetId = Branded<'QuantSkillsAssetId'>

/** Content snapshot identity assigned by the trusted QuantSkills publication. */
export type QuantSkillsSnapshotId = Branded<'QuantSkillsSnapshotId'>

/** Exact 40-hex Git commit accepted from the trusted catalog. */
export type QuantSkillsCommitSha = Branded<'QuantSkillsCommitSha'>

/** Stable identity of one immutable installed asset version. */
export type QuantSkillsInstalledVersionId = Branded<'QuantSkillsInstalledVersionId'>

/** SHA-256 digest of the validated upstream Git tree listing. */
export type QuantSkillsTreeDigest = Branded<'QuantSkillsTreeDigest'>

/** Asset kinds published by the QuantSkills catalog. */
export type QuantSkillsAssetKind = 'skill' | 'agent'

/** Root declaration admitted for one asset kind. */
export type QuantSkillsDeclarationFile = 'SKILL.md' | 'AGENTS.md'

/** Origin of the stable localized name published for one exact catalog asset version. */
export type QuantSkillsDisplayNameSource = 'catalog' | 'declaration' | 'generated' | 'asset-id'

/** Input controls supported by the optional QuantSkills `qsh-form` v1 declaration. */
export type QuantSkillsPromptFormFieldType = 'text' | 'textarea' | 'select' | 'date' | 'number'

/** One fixed option for a `select` prompt-form field. */
export interface QuantSkillsPromptFormOption {
  readonly value: string
  readonly label: string
}

/** One normalized optional field in a QuantSkills prompt form. */
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

/** Primary natural-language task input declared by a QuantSkills prompt form. */
export interface QuantSkillsPromptFormTask {
  readonly placeholder?: string
  readonly required?: boolean
}

/** Validated, non-executable QuantSkills `qsh-form` v1 metadata. */
export interface QuantSkillsPromptFormV1 {
  readonly version: 1
  readonly task?: QuantSkillsPromptFormTask
  readonly fields: readonly QuantSkillsPromptFormField[]
  readonly promptTemplate: string
}

/** One deterministic compatibility conversion applied to prompt-form metadata. */
export interface QuantSkillsPromptFormAdaptation {
  readonly code: 'number-default-string'
  readonly fieldKey: string
}

/** Optional prompt-form parsing outcome; absence means the declaration has no form block. */
export type QuantSkillsPromptFormResult =
  | {
    readonly status: 'ready'
    readonly form: QuantSkillsPromptFormV1
    readonly adaptations?: readonly QuantSkillsPromptFormAdaptation[]
  }
  | { readonly status: 'invalid'; readonly reason: string }

/** Host-owned delivery state for official catalog change notifications. */
export interface QuantSkillsCatalogSyncStatus {
  /** How the Host learns that the official publication may have changed. */
  readonly mode: 'manual' | 'event-stream'
  /** Current event-stream lifecycle state; manual mode stays `idle`. */
  readonly state: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error'
  /** Last successful event-stream connection time. */
  readonly connectedAt?: number
  /** Last catalog change event accepted from the relay. */
  readonly eventReceivedAt?: number
  /** User-safe failure summary while reconnecting. */
  readonly error?: string
}

/** Localized names resolved before an asset reaches a Client renderer. */
export interface QuantSkillsDisplayNames {
  readonly zhCN: string
  readonly en?: string
}

/** One dynamic QuantSkills taxonomy subcategory. */
export interface QuantSkillsCatalogSubcategory {
  readonly id: string
  readonly labelEn: string
  readonly labelZh: string
}

/** One dynamic QuantSkills taxonomy category and its published children. */
export interface QuantSkillsCatalogCategory {
  readonly id: string
  readonly labelEn: string
  readonly labelZh: string
  readonly subcategories: readonly QuantSkillsCatalogSubcategory[]
}

/** One approved catalog asset safe to present to a Client. */
export interface QuantSkillsCatalogAsset {
  readonly assetId: QuantSkillsAssetId
  readonly kind: QuantSkillsAssetKind
  readonly repository: string
  readonly commit: QuantSkillsCommitSha
  readonly declaration: QuantSkillsDeclarationFile
  readonly displayNames: QuantSkillsDisplayNames
  readonly aliases: readonly string[]
  readonly nameSource: QuantSkillsDisplayNameSource
  readonly title?: string
  readonly category?: string
  readonly subcategory?: string
  readonly description?: string
  readonly health?: string
  readonly validationLevel?: string
  readonly requires?: readonly QuantSkillsAssetId[]
  readonly summaryEn?: string
  readonly summaryZh?: string
}

/** One validated point-in-time approved catalog projection. */
export interface QuantSkillsCatalogSnapshot {
  readonly snapshotId: QuantSkillsSnapshotId
  /** Host-configured delay before the Client checks the official catalog again. */
  readonly refreshAfterMs: number
  readonly categories: readonly QuantSkillsCatalogCategory[]
  readonly assets: readonly QuantSkillsCatalogAsset[]
  /** Live Host delivery state for this official catalog projection. */
  readonly sync: QuantSkillsCatalogSyncStatus
}

declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * A new trusted official catalog snapshot committed after an event-stream hint.
     * @param snapshot - bounded catalog projection fetched from the configured trusted URL.
     * @mode emit
     */
    'quantskills/catalog-updated'(snapshot: QuantSkillsCatalogSnapshot): void

    /**
     * Event-stream connection state changed.
     * @param status - current Host-owned delivery state.
     * @mode emit
     */
    'quantskills/catalog-sync-status'(status: QuantSkillsCatalogSyncStatus): void
  }
}

/** Optimistic install request tied to the exact catalog state the Client observed. */
export interface QuantSkillsInstallRequest {
  readonly assetId: QuantSkillsAssetId
  readonly observedSnapshotId: QuantSkillsSnapshotId
  readonly observedCommit: QuantSkillsCommitSha
}

/** Read request tied to the exact approved catalog state visible to the Client. */
export interface QuantSkillsAssetReadmeRequest {
  readonly assetId: QuantSkillsAssetId
  readonly observedSnapshotId: QuantSkillsSnapshotId
  readonly observedCommit: QuantSkillsCommitSha
}

/** Exact-version repository documentation safe to render in an asset detail view. */
export interface QuantSkillsAssetReadme {
  readonly assetId: QuantSkillsAssetId
  readonly commit: QuantSkillsCommitSha
  readonly path: 'README.md' | 'SKILL.md'
  readonly markdown: string
}

/** Host-committed immutable installation record. */
export interface QuantSkillsInstalledVersion {
  readonly versionId: QuantSkillsInstalledVersionId
  readonly assetId: QuantSkillsAssetId
  readonly kind: QuantSkillsAssetKind
  readonly repository: string
  readonly commit: QuantSkillsCommitSha
  readonly declaration: QuantSkillsDeclarationFile
  readonly treeDigest: QuantSkillsTreeDigest
  readonly fileCount: number
  readonly totalBytes: number
  readonly installedAt: number
  /** Skills are registry-visible; Agents expose a validated user-Agent template. */
  readonly exposure: 'skill-registry' | 'agent-template'
  /** Publication owner for this immutable version. */
  readonly origin: 'catalog' | 'local-authoring'
  /** Chinese H1 read from this exact installed declaration, when present. */
  readonly declarationTitleZh?: string
}

/** Host validation result for one Workspace-local Skill or Agent draft. */
export interface QuantSkillsAuthoredDraft {
  readonly assetId: QuantSkillsAssetId
  readonly kind: QuantSkillsAssetKind
  readonly declaration: QuantSkillsDeclarationFile
  readonly treeDigest: QuantSkillsTreeDigest
  readonly fileCount: number
  readonly totalBytes: number
  readonly requires: readonly QuantSkillsAssetId[]
}

/** Request to validate a draft directory without publishing it. */
export interface QuantSkillsAuthoredDraftPrepareRequest {
  readonly draftRoot: string
  readonly kind: QuantSkillsAssetKind
}

/** Request to atomically publish an unchanged, previously prepared local draft. */
export interface QuantSkillsAuthoredDraftPublishRequest extends QuantSkillsAuthoredDraftPrepareRequest {
  readonly expectedTreeDigest: QuantSkillsTreeDigest
  readonly expectedBaseVersionId?: QuantSkillsInstalledVersionId | null
}

/** Validated Agent template adapted from one exact installed `AGENTS.md`. */
export interface QuantSkillsInstalledAgentTemplate {
  readonly version: QuantSkillsInstalledVersion
  readonly name: string
  readonly description: string
  readonly instructions: string
  readonly requires: readonly QuantSkillsAssetId[]
  /** Optional form metadata parsed independently from the literal Agent instructions. */
  readonly promptForm?: QuantSkillsPromptFormResult
}

/** Point-in-time projection of Host-committed installed versions. */
export interface QuantSkillsInstalledSnapshot {
  readonly versions: readonly QuantSkillsInstalledVersion[]
}

/** Stable application-update lifecycle states shown by every Client surface. */
export type QuantSkillsApplicationUpdateState =
  | 'idle'
  | 'checking'
  | 'current'
  | 'available'
  | 'preparing'
  | 'ready'
  | 'blocked'
  | 'failed'

/** Bounded preparation phases for one official application candidate. */
export type QuantSkillsApplicationUpdatePhase = 'fetching' | 'installing' | 'verifying'

/** Official Git service selected by the user for one application update operation. */
export type QuantSkillsApplicationUpdateSource = 'github' | 'gitee'

/** Explicit source for a user-requested application update check. */
export interface QuantSkillsApplicationUpdateCheckRequest {
  readonly source: QuantSkillsApplicationUpdateSource
}

/** Point-in-time application updater projection safe to show in the Client. */
export interface QuantSkillsApplicationUpdateStatus {
  readonly state: QuantSkillsApplicationUpdateState
  /** Official Git service used by the active or latest completed operation. */
  readonly source?: QuantSkillsApplicationUpdateSource
  /** Installed application SemVer read from the active package manifest. */
  readonly currentVersion?: string
  readonly currentCommit?: string
  /** Newest published stable SemVer selected from an official `vX.Y.Z` Git tag. */
  readonly candidateVersion?: string
  readonly candidateCommit?: string
  /** Release notes read from the exact candidate commit. */
  readonly releaseNotes?: readonly string[]
  readonly phase?: QuantSkillsApplicationUpdatePhase
  readonly checkedAt?: number
  readonly errorCode?: QuantSkillsHostErrorCode
}

/** Immediate acknowledgement; the accepted check or preparation continues independently in the Host. */
export interface QuantSkillsApplicationUpdateStartResult {
  readonly accepted: 'started' | 'reused'
  readonly status: QuantSkillsApplicationUpdateStatus
}

/** Stable Host failure codes safe for RPC error classification. */
export type QuantSkillsHostErrorCode =
  | 'CATALOG_FETCH_FAILED'
  | 'CATALOG_INVALID'
  | 'CATALOG_STALE'
  | 'ASSET_NOT_FOUND'
  | 'ASSET_README_FETCH_FAILED'
  | 'ASSET_README_NOT_FOUND'
  | 'ASSET_README_INVALID'
  | 'INSTALL_INVALID_TREE'
  | 'INSTALL_LIMIT_EXCEEDED'
  | 'INSTALL_GIT_FAILED'
  | 'INSTALL_EXPOSURE_FAILED'
  | 'INSTALL_RECORD_CORRUPT'
  | 'INSTALL_WRITE_FAILED'
  | 'INSTALLED_VERSION_NOT_FOUND'
  | 'INSTALLED_VERSION_NOT_SKILL'
  | 'INSTALLED_VERSION_NOT_AGENT'
  | 'APPLICATION_UPDATE_CHECK_FAILED'
  | 'APPLICATION_UPDATE_NOT_AVAILABLE'
  | 'APPLICATION_UPDATE_DOWNLOAD_FAILED'
  | 'APPLICATION_UPDATE_INSTALL_FAILED'
  | 'APPLICATION_UPDATE_VERIFY_FAILED'
  | 'APPLICATION_UPDATE_STATE_CORRUPT'
  | 'APPLICATION_UPDATE_PATH_INVALID'
  | 'APPLICATION_UPDATE_DEVELOPMENT_DIRTY'
  | 'APPLICATION_UPDATE_DEVELOPMENT_REMOTE'
  | 'APPLICATION_UPDATE_DEVELOPMENT_BRANCH'
  | 'APPLICATION_UPDATE_DEVELOPMENT_AHEAD'
  | 'APPLICATION_UPDATE_DEVELOPMENT_DIVERGED'

/** Declaration-only editing; supporting files are copied from an exact Host-owned version. */
export interface QuantSkillsManualSkillSaveRequest {
  readonly markdown: string
  readonly mode: 'create' | 'edit' | 'copy'
  readonly sourceVersionId?: QuantSkillsInstalledVersionId
  readonly copyAssetId?: string
}
