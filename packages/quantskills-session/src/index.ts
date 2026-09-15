/** Exact-version QuantSkills session composition and log-backed archive remotes. */

import { QuantSkillsLibraryStore } from './library-store.ts'
import { ContestService, sameContest } from './contest-service.ts'
import { OfficialContestCli } from './contest-cli.ts'
import { installContestTools } from './contest-tools.ts'
import type { ContestStatus, ContestData, ContestQuery, ContestPlan, ContestInspection } from './contest-types.ts'
import type { ContestSessionOpenRequest, ContestSessionOpenResult } from './types.ts'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import type {} from '@deepseek-ai/dsh-subprocess'
import { join } from 'node:path'
import { capabilityDisplayName } from './capability-display.ts'
import type { QuantSkillsLibrarySourceRecord } from './types.ts'
import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, relative, sep } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import s from '@deepseek-ai/schemastery'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import {
  installModelSelection, type Agent, type ModelSelection,
} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-agent-team'
import type FileSystem from '@deepseek-ai/dsh-fs'
import type { FsTarget } from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-api-session-controller'
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { QuantSkillsResolvedInstalledSkill } from '@deepseek-ai/dsh-quantskills-host'
import type {
  QuantSkillsAssetId,
  QuantSkillsInstalledVersionId,
  QuantSkillsInstalledVersion,
  QuantSkillsTreeDigest,
} from '@deepseek-ai/dsh-quantskills-host/types'
import {
  SessionId, type SessionEvent, type SessionHeader,
} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session-persistence'
import type { ProjectionSnapshot } from '@deepseek-ai/dsh-session-projection'
import type {} from '@deepseek-ai/dsh-session-projection-cache'
import {
  renderSkillContent, type SkillCandidate, type SkillDefinition, type SkillLookupOptions, type SkillProvider,
} from '@deepseek-ai/dsh-skill'
import type { SystemPrompt } from '@deepseek-ai/dsh-system-prompt'
import { installQuantSkillsIdentity } from './product-identity.ts'
import { renderArtifactTheme } from './artifact-theme.ts'
import type {} from '@deepseek-ai/dsh-subagent'
import { defineTool, type ToolCallView } from '@deepseek-ai/dsh-tools'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { snapshotJsonValue, type JsonValue } from '@deepseek-ai/dsh-util-values'
import type {} from '@deepseek-ai/dsh-workspace'
import { z } from 'zod'
import Mustache from 'mustache'
import { parseOffice } from 'officeparser'
import type {
  QuantSkillsFrequentRequest,
  QuantSkillsFrequentSkill,
  QuantSkillsAgentCreateRequest,
  QuantSkillsAgentDefinition,
  QuantSkillsAgentDeleteRequest,
  QuantSkillsAgentSessionArchiveItem,
  QuantSkillsAgentSessionBinding,
  QuantSkillsAgentSessionCreateRequest,
  QuantSkillsAgentSessionCreateResult,
  QuantSkillsAgentUpdateRequest,
  QuantSkillsAgentTeamCreateRequest,
  QuantSkillsAgentTeamDefinition,
  QuantSkillsAgentTeamDeleteRequest,
  QuantSkillsAgentTeamMemberSessionBinding,
  QuantSkillsAgentTeamModelChoice,
  QuantSkillsAgentTeamSessionArchiveItem,
  QuantSkillsAgentTeamSessionBinding,
  QuantSkillsAgentTeamSessionCreateRequest,
  QuantSkillsAgentTeamSessionCreateResult,
  QuantSkillsAgentTeamSessionMember,
  QuantSkillsAgentTeamUpdateRequest,
  QuantSkillsAgentTeamDraft, QuantSkillsAgentTeamDraftDiagnostic, QuantSkillsAgentTeamDraftModelSummary,
  QuantSkillsFileAttachRequest,
  QuantSkillsFileAttachmentRef,
  QuantSkillsFileListRequest,
  QuantSkillsFileListResult,
  QuantSkillsFileParsing,
  QuantSkillsFileReadRequest,
  QuantSkillsFileReadResult,
  QuantSkillsPromptFormCapability,
  QuantSkillsPromptFormListRequest,
  QuantSkillsPromptFormListResult,
  QuantSkillsPromptFormRenderRequest,
  QuantSkillsPromptFormRenderResult,
  QuantSkillsSessionFileAttachment,
  QuantSkillsPreparedResult,
  QuantSkillsResultPrepareRequest,
  QuantSkillsResultPrepareResult,
  QuantSkillsResultPreview,
  QuantSkillsResultPreviewRequest,
  QuantSkillsResidentSkillAttachRequest,
  QuantSkillsResidentSkillChange,
  QuantSkillsResidentSkillDetachRequest,
  QuantSkillsResidentSkillResult,
  QuantSkillsSessionArchiveItem,
  QuantSkillsPlainSessionArchiveItem,
  QuantSkillsSessionBinding,
  QuantSkillsSessionCreateRequest,
  QuantSkillsSessionCreateResult,
  QuantSkillsSessionEnsureRequest,
  QuantSkillsSessionEnsureResult,
  QuantSkillsPlainSessionBinding,
  QuantSkillsPlainSessionCreateRequest,
  QuantSkillsPlainSessionCreateResult,
  QuantSkillsSessionListRequest,
  QuantSkillsWorkspaceRequest,
  QuantSkillsWorkspaceResolveResult,
  QuantSkillsWorkspaceStatusResult,
  QuantSkillsPandaRuntimeBinding,
  QuantSkillsAuthoringKind,
  QuantSkillsAuthoringCommitRequest,
  QuantSkillsAuthoringCommitResult,
  QuantSkillsAuthoringCommitted,
  QuantSkillsAuthoringSessionCreateRequest,
  QuantSkillsAuthoringStarted,
} from './types.ts'
import {
  DEFAULT_MAX_FILE_ATTACHMENT_BYTES,
  DEFAULT_MAX_SESSION_FILE_ATTACHMENT_BYTES,
  QuantSkillsFileStore,
  decodeQuantSkillsFileAttachment,
} from './file-store.ts'
import { QuantSkillsWorkspaceResolver, resolveQuantSkillsManagedPath } from './managed-workspace.ts'
import {
  freezeDefinition, MAX_AGENT_ROLE_CHARS, quantSkillsAgentDefinitionSchema as agentSessionSchema,
  quantSkillsSessionBindingSchema as bindingSchema, QuantSkillsAgentStore,
} from './agent-store.ts'
import {
  freezeTeamDefinition,
  freezeTeamModelChoice,
  freezeTeamMemberSessionBinding,
  MAX_AGENT_TEAM_MEMBERS,
  quantSkillsAgentTeamMemberSessionSchema,
  quantSkillsAgentTeamModelChoiceSchema,
  quantSkillsAgentTeamSessionSchema,
  QuantSkillsAgentTeamStore,
} from './team-store.ts'
import { QuantSkillsModelAccess } from './model-access.ts'
import type { ModelAccessRequest, ModelAccessResponse } from './model-access-types.ts'
import { registerQuantSkillsSessionEventTypes } from './event-catalog.ts'

export type * from './types.ts'

const BINDING_EVENT = 'quantskills/session-bound'
const PLAIN_SESSION_EVENT = 'quantskills/plain-session'
const AGENT_SESSION_EVENT = 'quantskills/agent-session'
const AGENT_TEAM_SESSION_EVENT = 'quantskills/agent-team-session'
const AGENT_TEAM_MEMBER_EVENT = 'quantskills/agent-team-member'
const RESIDENT_SKILL_EVENT = 'quantskills/resident-skill-changed'
const FILE_ATTACHED_EVENT = 'quantskills/file-attached'
const PANDA_RUNTIME_EVENT = 'panda/runtime-bound'
const AUTHORING_STARTED_EVENT = 'quantskills/authoring-started'
const AUTHORING_COMMITTED_EVENT = 'quantskills/authoring-committed'

const PINNED_PROVIDER_RANK = 0
const MAX_FREQUENT_LIMIT = 100
const MAX_AGENT_SKILLS = 32
const MAX_RESULT_PREPARE_PATHS = 100
const MAX_RESULT_CANDIDATE_CHARS = 4_096
const TEAM_ACTIVATION_TOOL = 'activate_team_member'
const AGENT_TEAM_DRAFT_TOOL = 'quantskills_team_draft'
const ASSET_DRAFT_TOOL = 'quantskills_asset_draft'
const AGENT_TEAM_AUTHORING_NAME = 'Agent Team 创作'
const AUTHORING_AGENT_NAMES = new Set([
  'Skill 创作', 'Agent 创作', AGENT_TEAM_AUTHORING_NAME,
  'QuantSkills · Skill 创作助手', 'QuantSkills · Agent 创作助手',
])

function isAuthoringAgent(name: string): boolean {
  return AUTHORING_AGENT_NAMES.has(name)
}

function toolJsonObject(value: object): Record<string, JsonValue> {
  const snapshot = snapshotJsonValue(value)
  if (snapshot === undefined) {
    throw new TypeError('QuantSkills Team draft tool result must be a JSON object.')
  }
  return snapshot as Record<string, JsonValue>
}

function authoringDigest(value: object): QuantSkillsTreeDigest {
  const canonical = snapshotJsonValue(value)
  if (canonical === undefined) throw new TypeError('QuantSkills authoring draft must be JSON serializable.')
  return `sha256:${createHash('sha256').update(JSON.stringify(canonical)).digest('hex')}` as QuantSkillsTreeDigest
}

function registerLiteralPromptSection(
  systemPrompt: SystemPrompt,
  section: { readonly name: string; readonly order: number; readonly text: string | (() => string) },
): () => void {
  const variableName = `quantskills_literal_${createHash('sha256')
    .update(section.name)
    .digest('hex')
    .slice(0, 16)}`
  const disposeVariable = systemPrompt.variable(variableName, () => typeof section.text === 'function' ? section.text() : section.text)
  let disposeSection: (() => void) | undefined
  try {
    disposeSection = systemPrompt.section({
      name: section.name,
      order: section.order,
      text: `{{${variableName}}}`,
    })
  } catch (error) {
    disposeVariable()
    throw error
  }
  return () => {
    disposeSection?.()
    disposeSection = undefined
    disposeVariable()
  }
}

function teamModelChoiceToolSchema(description: string) {
  return {
    type: 'object',
    required: true,
    additionalProperties: false,
    description,
    properties: {
      kind: { type: 'string', required: true, enum: ['default', 'fixed'] },
      selection: {
        type: 'object',
        additionalProperties: false,
        properties: {
          provider: { type: 'string', required: true },
          model: { type: 'string', required: true },
          reasoningEffort: { type: 'string' },
        },
      },
    },
  } as const
}
const UTF8_ATTACHMENT_MEDIA_TYPES = new Set([
  'application/csv',
  'application/javascript',
  'application/json',
  'application/ld+json',
  'application/sql',
  'application/x-ndjson',
  'application/xml',
  'application/yaml',
])
const OFFICE_DOCUMENT_EXTENSIONS = new Set(['.docx', '.odt', '.pptx', '.odp', '.rtf', '.epub'])
const SPREADSHEET_EXTENSIONS = new Set(['.xlsx', '.ods'])
const RESULT_TEXT_MEDIA_TYPES: ReadonlyMap<string, string> = new Map([
  ['.bat', 'text/plain'],
  ['.c', 'text/x-c'],
  ['.cc', 'text/x-c++'],
  ['.cjs', 'text/javascript'],
  ['.conf', 'text/plain'],
  ['.cpp', 'text/x-c++'],
  ['.cs', 'text/x-csharp'],
  ['.css', 'text/css'],
  ['.cts', 'text/typescript'],
  ['.csv', 'text/csv'],
  ['.dart', 'text/x-dart'],
  ['.fish', 'text/x-shellscript'],
  ['.go', 'text/x-go'],
  ['.h', 'text/x-c'],
  ['.html', 'text/html'],
  ['.hpp', 'text/x-c++'],
  ['.ini', 'text/plain'],
  ['.java', 'text/x-java'],
  ['.js', 'text/javascript'],
  ['.jsx', 'text/jsx'],
  ['.json', 'application/json'],
  ['.kt', 'text/x-kotlin'],
  ['.kts', 'text/x-kotlin'],
  ['.log', 'text/plain'],
  ['.lua', 'text/x-lua'],
  ['.m', 'text/x-objective-c'],
  ['.md', 'text/markdown'],
  ['.mjs', 'text/javascript'],
  ['.mm', 'text/x-objective-c++'],
  ['.mts', 'text/typescript'],
  ['.php', 'text/x-php'],
  ['.pl', 'text/x-perl'],
  ['.ps1', 'text/x-powershell'],
  ['.py', 'text/x-python'],
  ['.r', 'text/x-r'],
  ['.rb', 'text/x-ruby'],
  ['.rs', 'text/x-rust'],
  ['.scss', 'text/x-scss'],
  ['.sh', 'text/x-shellscript'],
  ['.sql', 'application/sql'],
  ['.swift', 'text/x-swift'],
  ['.toml', 'application/toml'],
  ['.ts', 'text/typescript'],
  ['.tsx', 'text/tsx'],
  ['.tsv', 'text/tab-separated-values'],
  ['.txt', 'text/plain'],
  ['.vue', 'text/x-vue'],
  ['.xml', 'application/xml'],
  ['.yaml', 'application/yaml'],
  ['.yml', 'application/yaml'],
  ['.zsh', 'text/x-shellscript'],
] as const)
const RESULT_BINARY_MEDIA_TYPES: ReadonlyMap<
  string,
  'application/pdf' | 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'
> = new Map([
  ['.gif', 'image/gif'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.pdf', 'application/pdf'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
] as const)
const RESULT_RESOURCE_MEDIA_TYPES: ReadonlyMap<string, string> = new Map([
  ['.aac', 'audio/aac'],
  ['.avi', 'video/x-msvideo'],
  ['.bmp', 'image/bmp'],
  ['.flac', 'audio/flac'],
  ['.ico', 'image/x-icon'],
  ['.m4a', 'audio/mp4'],
  ['.mkv', 'video/x-matroska'],
  ['.mov', 'video/quicktime'],
  ['.mp3', 'audio/mpeg'],
  ['.mp4', 'video/mp4'],
  ['.oga', 'audio/ogg'],
  ['.ogg', 'audio/ogg'],
  ['.ogv', 'video/ogg'],
  ['.tif', 'image/tiff'],
  ['.tiff', 'image/tiff'],
  ['.wav', 'audio/wav'],
  ['.webm', 'video/webm'],
] as const)
const RESULT_DOCUMENT_MEDIA_TYPES: ReadonlyMap<string, string> = new Map([
  ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['.epub', 'application/epub+zip'],
  ['.odp', 'application/vnd.oasis.opendocument.presentation'],
  ['.ods', 'application/vnd.oasis.opendocument.spreadsheet'],
  ['.odt', 'application/vnd.oasis.opendocument.text'],
  ['.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  ['.rtf', 'application/rtf'],
  ['.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
] as const)
/** Default maximum bytes decoded by the built-in UTF-8 attachment reader. */
export const DEFAULT_MAX_TEXT_ATTACHMENT_BYTES = 1024 * 1024
/** Default maximum source bytes accepted by the built-in document parser. */
export const DEFAULT_MAX_DOCUMENT_ATTACHMENT_BYTES = 25 * 1024 * 1024
/** Default maximum workspace-file bytes returned by the result preview Remote. */
export const DEFAULT_MAX_RESULT_PREVIEW_BYTES = 2 * 1024 * 1024
/** Default maximum bytes copied from one legacy installed-Skill result into a Session workspace. */
export const DEFAULT_MAX_RESULT_ARCHIVE_BYTES = 100 * 1024 * 1024

const fileAttachmentRefSchema = z.object({
  attachmentId: z.string().regex(/^sha256:[0-9a-f]{64}$/).transform(AttachmentId),
  mediaType: z.string().min(1),
  bytes: z.number().int().positive(),
  name: z.string().min(1),
}).strict()
const fileParsingSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ready'),
    kind: z.enum(['utf8-text', 'pdf', 'office-document', 'spreadsheet']),
  }).strict(),
  z.object({ status: z.literal('unsupported'), reason: z.string().min(1) }).strict(),
  z.object({ status: z.literal('failed'), reason: z.string().min(1) }).strict(),
])
const sessionFileAttachmentSchema = z.object({
  file: fileAttachmentRefSchema,
  parsing: fileParsingSchema,
  attachedAt: z.number().int().nonnegative(),
}).strict()
const sessionFileAttachmentsSchema = z.array(sessionFileAttachmentSchema).readonly()
const residentSkillChangeSchema = z.object({
  operation: z.enum(['attach', 'detach']),
  binding: bindingSchema,
  changedAt: z.number().int().nonnegative(),
}).strict()
const residentSkillsSchema = z.array(bindingSchema).readonly()
const plainSessionBindingSchema = z.object({
  purpose: z.enum(['ordinary', 'role-helper', 'contest']),
  contest: z.object({ accountId: z.string().min(1), contestId: z.string().min(1) }).optional(),
  contestConversation: z.enum(['main', 'topic']).optional(),
}).strict().refine(value => (value.purpose === 'contest') === (value.contest !== undefined)
  && (value.contestConversation === undefined || value.purpose === 'contest'), 'contest purpose requires its bound account')
const pandaRuntimeBindingSchema = z.object({
  environmentId: z.string().min(1),
  sdkVersion: z.string().min(1),
  pythonVersion: z.string().min(1),
  apiFingerprint: z.string().min(1),
}).strict()
const authoringStartedSchema = z.object({
  kind: z.enum(['skill', 'agent', 'agent-team']),
}).strict()
const treeDigestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/)
const installedVersionSchema = z.object({
  versionId: z.string().min(1),
  assetId: z.string().min(1),
  kind: z.enum(['skill', 'agent']),
  repository: z.string().min(1),
  commit: z.string().regex(/^[a-f0-9]{40}$/),
  declaration: z.enum(['SKILL.md', 'AGENTS.md']),
  treeDigest: treeDigestSchema,
  fileCount: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
  installedAt: z.number().int().nonnegative(),
  exposure: z.enum(['skill-registry', 'agent-template']),
  origin: z.enum(['catalog', 'local-authoring']),
  declarationTitleZh: z.string().optional(),
}).strict()
const authoringCommitResultSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('skill'), version: installedVersionSchema }).strict(),
  z.object({ kind: z.literal('agent'), version: installedVersionSchema, agent: agentSessionSchema }).strict(),
  z.object({ kind: z.literal('agent-team'), team: quantSkillsAgentTeamSessionSchema }).strict(),
])
const authoringCommittedSchema = z.object({
  toolCallId: z.string().min(1),
  treeDigest: treeDigestSchema,
  result: authoringCommitResultSchema,
}).strict()
const assetDraftResultSchema = z.object({
  kind: z.literal('draft'),
  draft: z.object({
    assetId: z.string().min(1),
    assetKind: z.enum(['skill', 'agent']),
    declaration: z.enum(['SKILL.md', 'AGENTS.md']),
    draftPath: z.string().min(1),
    treeDigest: treeDigestSchema,
    fileCount: z.number().int().nonnegative(),
    totalBytes: z.number().int().nonnegative(),
    requires: z.array(z.string()).readonly(),
  }).strict(),
  diagnostics: z.array(z.object({
    level: z.enum(['info', 'warning', 'error']),
    code: z.string(),
    message: z.string(),
  }).strict()).readonly(),
}).strict()
const teamDraftCommitSchema = z.object({
  kind: z.literal('draft'),
  treeDigest: treeDigestSchema,
  draft: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    lead: z.object({ agentId: z.string().min(1), revision: z.number().int().positive() }).strict(),
    leadModel: quantSkillsAgentTeamModelChoiceSchema,
    members: z.array(z.object({
      name: z.string().min(1),
      responsibility: z.string().min(1),
      context: z.enum(['fresh', 'fork']),
      agent: z.object({ agentId: z.string().min(1), revision: z.number().int().positive() }).strict(),
      model: quantSkillsAgentTeamModelChoiceSchema,
    }).strict()).min(1).readonly(),
    diagnostics: z.array(z.object({
      level: z.enum(['info', 'warning', 'error']),
      code: z.string(),
      message: z.string(),
    }).strict()).readonly(),
  }).strict(),
  diagnostics: z.array(z.unknown()).readonly(),
}).strict()

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** QuantSkills session creator and log-backed archive service. */
    quantSkillsSessions: QuantSkillsSessionService
  }
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /** Durable ownership and purpose for a plain QuantSkills Session. */
    'quantskills/plain-session': QuantSkillsPlainSessionBinding
    /**
     * Exact installed Skill version that determines this session's scoped Skill provider.
     * Required-on-read and log-only; it does not enter the model message surface.
     */
    'quantskills/session-bound': QuantSkillsSessionBinding
    /** Complete immutable user Agent composition that this Session runs. */
    'quantskills/agent-session': QuantSkillsAgentSessionBinding
    /** Complete immutable Agent Team composition that this Team Lead Session runs. */
    'quantskills/agent-team-session': QuantSkillsAgentTeamSessionBinding
    /** Exact declared Agent identity assigned to this continuable Team member Session. */
    'quantskills/agent-team-member': QuantSkillsAgentTeamMemberSessionBinding
    /** Exact Skill version attached to or detached from the Session-resident composition. */
    'quantskills/resident-skill-changed': QuantSkillsResidentSkillChange
    /** Immutable generic file owned by this QuantSkills Session. */
    'quantskills/file-attached': QuantSkillsSessionFileAttachment
    /** Exact PandaData runtime used by this QuantSkills Session. */
    'panda/runtime-bound': QuantSkillsPandaRuntimeBinding
    /** Dedicated authoring purpose that controls which draft tool the Session receives. */
    'quantskills/authoring-started': QuantSkillsAuthoringStarted
    /** Explicitly confirmed immutable publication derived from one successful draft Tool Result. */
    'quantskills/authoring-committed': QuantSkillsAuthoringCommitted
  }
}

/** Loader configuration for durable user Agent definitions. */
export interface Config {
  /** Harness home override. */
  readonly dshHome?: string
  /** Maximum UTF-8 bytes exposed by the built-in attachment reader. */
  readonly maxTextAttachmentBytes?: number
  /** Maximum PDF or Office source bytes admitted to the built-in parser. */
  readonly maxDocumentAttachmentBytes?: number
  /** Maximum decoded bytes accepted for one generic file. */
  readonly maxFileAttachmentBytes?: number
  /** Maximum aggregate generic-file bytes accepted by one Session. */
  readonly maxSessionFileAttachmentBytes?: number
  /** Maximum complete workspace-file bytes returned to one result preview. */
  readonly maxResultPreviewBytes?: number
  /** Maximum bytes copied from one legacy installed-Skill result into a Session workspace. */
  readonly maxResultArchiveBytes?: number
  /** Exact DSH tool names that submit live orders and must ask on every call. */
  readonly liveTradingToolNames?: string[]
  /** Continuable-subagent provider used by fresh Agent Team members. */
  readonly teamFreshProvider?: string
  /** Continuable-subagent provider used by forked Agent Team members. */
  readonly teamForkProvider?: string
}

/** Rejection of a SessionId already owned by a different or ordinary session. */
export class QuantSkillsSessionConflictError extends Error {
  override readonly name = 'QuantSkillsSessionConflictError'
}

/**
 * Parse one plain QuantSkills ownership marker at the durable-log boundary.
 * @param value - untrusted persisted event data.
 * @returns validated immutable ownership and purpose.
 */
export function parseQuantSkillsPlainSessionBinding(value: unknown): QuantSkillsPlainSessionBinding {
  return Object.freeze(plainSessionBindingSchema.parse(value))
}

/**
 * Fold the once-only plain QuantSkills ownership marker from a Session log.
 * @param events - live, restored, or persisted Session events.
 * @returns the ownership marker, or null for every other Session.
 * @throws when the marker is malformed or repeated.
 */
export function foldQuantSkillsPlainSessionBinding(
  events: readonly SessionEvent[],
): QuantSkillsPlainSessionBinding | null {
  let binding: QuantSkillsPlainSessionBinding | null = null
  for (const event of events) {
    if (event.type !== PLAIN_SESSION_EVENT) continue
    if (binding !== null) throw new Error('session contains more than one quantskills/plain-session event')
    binding = parseQuantSkillsPlainSessionBinding(event.data)
  }
  return binding
}

/**
 * Parse and freeze one binding at the durable-log boundary.
 * @param value - untrusted persisted event data.
 * @returns validated exact-version binding.
 */
export function parseQuantSkillsSessionBinding(value: unknown): QuantSkillsSessionBinding {
  return bindingSchema.parse(value)
}

/**
 * Fold the once-only binding event from a complete or prefix session log.
 * @param events - live, restored, or persisted session events.
 * @returns the exact binding, or null for an ordinary session.
 * @throws when a binding is malformed or repeated.
 */
export function foldQuantSkillsSessionBinding(events: readonly SessionEvent[]): QuantSkillsSessionBinding | null {
  let binding: QuantSkillsSessionBinding | null = null
  for (const event of events) {
    if (event.type !== BINDING_EVENT) continue
    if (binding !== null) throw new Error('session contains more than one quantskills/session-bound event')
    binding = parseQuantSkillsSessionBinding(event.data)
  }
  return binding
}

/**
 * Parse and freeze one user Agent Session definition at the durable-log boundary.
 * @param value - untrusted persisted event data.
 * @returns validated immutable Agent composition.
 */
export function parseQuantSkillsAgentSession(value: unknown): QuantSkillsAgentSessionBinding {
  return agentSessionSchema.parse(value)
}

/**
 * Fold the once-only user Agent composition from a Session log.
 * @param events - live, restored, or persisted Session events.
 * @returns the immutable Agent composition, or null for every other Session.
 * @throws when the event is malformed or repeated.
 */
export function foldQuantSkillsAgentSession(events: readonly SessionEvent[]): QuantSkillsAgentSessionBinding | null {
  let agent: QuantSkillsAgentSessionBinding | null = null
  for (const event of events) {
    if (event.type !== AGENT_SESSION_EVENT) continue
    if (agent !== null) throw new Error('session contains more than one quantskills/agent-session event')
    agent = parseQuantSkillsAgentSession(event.data)
  }
  return agent
}

/**
 * Parse one immutable Agent Team Session binding at the durable-log boundary.
 * @param value - untrusted durable payload.
 * @returns the validated immutable Team binding.
 */
export function parseQuantSkillsAgentTeamSession(value: unknown): QuantSkillsAgentTeamSessionBinding {
  return quantSkillsAgentTeamSessionSchema.parse(value)
}

/**
 * Fold the Team Lead composition from a Session log. A forked teammate inherits
 * the Lead prefix, then its member event replaces that inherited identity.
 * @param events - live, restored, or persisted Session events.
 * @returns the immutable Team binding, or null for a non-Lead Session.
 */
export function foldQuantSkillsAgentTeamSession(
  events: readonly SessionEvent[],
): QuantSkillsAgentTeamSessionBinding | null {
  let team: QuantSkillsAgentTeamSessionBinding | null = null
  let seen = false
  for (const event of events) {
    if (event.type === AGENT_TEAM_SESSION_EVENT) {
      if (seen) throw new Error('session contains more than one quantskills/agent-team-session event')
      team = parseQuantSkillsAgentTeamSession(event.data)
      seen = true
    } else if (event.type === AGENT_TEAM_MEMBER_EVENT) {
      team = null
    }
  }
  return team
}

/**
 * Parse one immutable Agent Team member binding at the durable-log boundary.
 * @param value - untrusted durable payload.
 * @returns the validated immutable member binding.
 */
export function parseQuantSkillsAgentTeamMemberSession(
  value: unknown,
): QuantSkillsAgentTeamMemberSessionBinding {
  return quantSkillsAgentTeamMemberSessionSchema.parse(value)
}

/**
 * Fold the once-only exact Agent identity of a continuable Team member.
 * @param events - live, restored, or persisted Session events.
 * @returns the member binding, or null for every other Session.
 */
export function foldQuantSkillsAgentTeamMemberSession(
  events: readonly SessionEvent[],
): QuantSkillsAgentTeamMemberSessionBinding | null {
  let member: QuantSkillsAgentTeamMemberSessionBinding | null = null
  for (const event of events) {
    if (event.type !== AGENT_TEAM_MEMBER_EVENT) continue
    if (member !== null) throw new Error('session contains more than one quantskills/agent-team-member event')
    member = parseQuantSkillsAgentTeamMemberSession(event.data)
  }
  return member
}

/**
 * Fold the effective resident Skill set from immutable base bindings and later hot-plug transitions.
 * @param events - live, restored, or persisted Session events.
 * @returns exact Skill bindings in stable attachment order.
 */
export function foldQuantSkillsResidentSkills(events: readonly SessionEvent[]): readonly QuantSkillsSessionBinding[] {
  let skills: readonly QuantSkillsSessionBinding[] = Object.freeze([])
  for (const event of events) skills = applyResidentSkillEvent(skills, event)
  return skills
}

function applyResidentSkillEvent(
  state: readonly QuantSkillsSessionBinding[],
  event: SessionEvent,
): readonly QuantSkillsSessionBinding[] {
  if (event.type === BINDING_EVENT) {
    if (state.length !== 0) throw new Error('QuantSkills base Skill binding must precede resident Skill transitions')
    return Object.freeze([parseQuantSkillsSessionBinding(event.data)])
  }
  if (event.type === AGENT_SESSION_EVENT) {
    if (state.length !== 0) throw new Error('QuantSkills Agent binding must precede resident Skill transitions')
    return Object.freeze([...parseQuantSkillsAgentSession(event.data).skills])
  }
  if (event.type === AGENT_TEAM_SESSION_EVENT) {
    if (state.length !== 0) throw new Error('QuantSkills Agent Team binding must precede resident Skill transitions')
    return Object.freeze([...parseQuantSkillsAgentTeamSession(event.data).lead.skills])
  }
  if (event.type === AGENT_TEAM_MEMBER_EVENT) {
    return Object.freeze([...parseQuantSkillsAgentTeamMemberSession(event.data).agent.skills])
  }
  if (event.type !== RESIDENT_SKILL_EVENT) return state
  const change = residentSkillChangeSchema.parse(event.data)
  const index = state.findIndex(item => item.assetId === change.binding.assetId)
  if (change.operation === 'attach') {
    if (index >= 0) throw new Error(`resident Skill "${change.binding.assetId}" is already attached`)
    return Object.freeze([...state, change.binding])
  }
  const existing = state[index]
  if (existing === undefined || !sameBinding(existing, change.binding)) {
    throw new Error(`resident Skill "${change.binding.assetId}" detach does not match the effective version`)
  }
  return Object.freeze(state.filter((_item, candidate) => candidate !== index))
}

/**
 * Parse one generic-file ownership event at the durable-log boundary.
 * @param value - untrusted persisted event data.
 * @returns validated immutable attachment metadata.
 */
export function parseQuantSkillsSessionFileAttachment(value: unknown): QuantSkillsSessionFileAttachment {
  return Object.freeze(sessionFileAttachmentSchema.parse(value))
}

/**
 * Fold generic-file ownership records from a complete or prefix Session log.
 * @param events - live, restored, or persisted Session events.
 * @returns attachments in append order.
 */
export function foldQuantSkillsSessionFileAttachments(
  events: readonly SessionEvent[],
): readonly QuantSkillsSessionFileAttachment[] {
  const files: QuantSkillsSessionFileAttachment[] = []
  for (const event of events) {
    if (event.type === FILE_ATTACHED_EVENT) files.push(parseQuantSkillsSessionFileAttachment(event.data))
  }
  return Object.freeze(files)
}

/**
 * Parse one exact PandaData runtime binding at the durable-log boundary.
 * @param value - untrusted persisted event data.
 * @returns validated immutable environment identity.
 */
export function parseQuantSkillsPandaRuntimeBinding(value: unknown): QuantSkillsPandaRuntimeBinding {
  return Object.freeze(pandaRuntimeBindingSchema.parse(value))
}

/**
 * Fold the once-only PandaData runtime selected for one Session.
 * @param events - live, restored, or persisted Session events.
 * @returns the exact environment binding, or null for a non-Panda Session.
 */
export function foldQuantSkillsPandaRuntimeBinding(
  events: readonly SessionEvent[],
): QuantSkillsPandaRuntimeBinding | null {
  let binding: QuantSkillsPandaRuntimeBinding | null = null
  for (const event of events) {
    if (event.type !== PANDA_RUNTIME_EVENT) continue
    if (binding !== null) throw new Error('session contains more than one panda/runtime-bound event')
    binding = parseQuantSkillsPandaRuntimeBinding(event.data)
  }
  return binding
}

/**
 * Fold the once-only authoring purpose from one Session log.
 * @param events - live, restored, or persisted Session events.
 * @returns the dedicated authoring kind, or null for ordinary Sessions.
 */
export function foldQuantSkillsAuthoringStarted(events: readonly SessionEvent[]): QuantSkillsAuthoringKind | null {
  let kind: QuantSkillsAuthoringKind | null = null
  for (const event of events) {
    if (event.type !== AUTHORING_STARTED_EVENT) continue
    if (kind !== null) throw new Error('session contains more than one quantskills/authoring-started event')
    kind = authoringStartedSchema.parse(event.data).kind
  }
  return kind
}

/**
 * Parse one confirmed authoring publication at the durable-log boundary.
 * @param value - untrusted persisted event data.
 * @returns validated immutable publication result and idempotency identity.
 */
export function parseQuantSkillsAuthoringCommitted(value: unknown): QuantSkillsAuthoringCommitted {
  return Object.freeze(authoringCommittedSchema.parse(value)) as unknown as QuantSkillsAuthoringCommitted
}

/**
 * Fold all explicitly confirmed authoring publications in durable order.
 * @param events - live, restored, or persisted Session events.
 * @returns immutable committed publications with duplicate identities rejected.
 */
export function foldQuantSkillsAuthoringCommitted(
  events: readonly SessionEvent[],
): readonly QuantSkillsAuthoringCommitted[] {
  const commits: QuantSkillsAuthoringCommitted[] = []
  const identities = new Set<string>()
  for (const event of events) {
    if (event.type !== AUTHORING_COMMITTED_EVENT) continue
    const committed = parseQuantSkillsAuthoringCommitted(event.data)
    const identity = `${committed.toolCallId}\0${committed.treeDigest}`
    if (identities.has(identity)) throw new Error('session contains a duplicate quantskills/authoring-committed event')
    identities.add(identity)
    commits.push(committed)
  }
  return Object.freeze(commits)
}

interface Reservation {
  readonly binding: QuantSkillsSessionBinding
  readonly resolved: QuantSkillsResolvedInstalledSkill
}

interface PlainReservation {
  readonly binding: QuantSkillsPlainSessionBinding
}

interface AgentReservation {
  readonly agent: QuantSkillsAgentSessionBinding
  readonly resolved: readonly QuantSkillsResolvedInstalledSkill[]
  readonly authoringKind?: QuantSkillsAuthoringKind
}

interface ResolvedTeamMember {
  readonly member: QuantSkillsAgentTeamSessionMember
  readonly resolved: readonly QuantSkillsResolvedInstalledSkill[]
}

interface TeamReservation {
  readonly binding: QuantSkillsAgentTeamSessionBinding
  readonly leadResolved: readonly QuantSkillsResolvedInstalledSkill[]
  readonly members: readonly ResolvedTeamMember[]
}

interface TeamRuntime extends TeamReservation {
  readonly membersByName: ReadonlyMap<string, ResolvedTeamMember>
}

interface TeamMemberReservation {
  readonly rootSessionId: SessionId
  readonly binding: QuantSkillsAgentTeamMemberSessionBinding
  readonly resolved: readonly QuantSkillsResolvedInstalledSkill[]
}

interface ResidentSkillRuntimeEntry {
  readonly resolved: QuantSkillsResolvedInstalledSkill
  readonly dispose: () => void
}

interface ResidentSkillRuntime {
  readonly entries: Map<QuantSkillsAssetId, ResidentSkillRuntimeEntry>
}

interface ResultSource {
  readonly binding: QuantSkillsSessionBinding
  readonly resourceBase: string
  readonly outputRoot: FsTarget
}

interface ResultCandidate {
  readonly path: string
  readonly source: 'assistant' | 'mutation'
}

/** Host service for product-owned QuantSkills Sessions, exact asset composition, and durable archives. */
const QUANTSKILLS_RESULT_FILE_PATH = '/api/quantskills.result.file'

interface ResultPreviewConnection {
  readonly fetch: {
    register(route: {
      readonly path: string
      readonly methods: readonly ('GET' | 'HEAD')[]
      readonly fetch: (request: Request) => Promise<Response>
    }): () => Promise<void>
  }
}

function connectionOf(ctx: Context): ResultPreviewConnection {
  return Reflect.get(ctx, 'connection') as ResultPreviewConnection
}

/** Host service for product-owned QuantSkills Sessions, exact asset composition, and durable archives. */
export class QuantSkillsSessionService extends TypertRemoteService {
  static inject = [
    'agents',
    'agentTeams',
    'sessionController',
    'fs',
    'llm',
    'quantSkillsHost',
    'sessionPersistence',
    'sessionProjectionCache',
    'sessionProjections',
    'sessions',
    'skills',
    'subagents',
    'tools',
    'workspaceRegistry',
  ]

  static Config: s<Config> = s.object({
    dshHome: s.string(),
    maxTextAttachmentBytes: s.number().step(1).min(1).default(DEFAULT_MAX_TEXT_ATTACHMENT_BYTES),
    maxDocumentAttachmentBytes: s.number().step(1).min(1).default(DEFAULT_MAX_DOCUMENT_ATTACHMENT_BYTES),
    maxFileAttachmentBytes: s.number().step(1).min(1).default(DEFAULT_MAX_FILE_ATTACHMENT_BYTES),
    maxSessionFileAttachmentBytes: s.number().step(1).min(1).default(DEFAULT_MAX_SESSION_FILE_ATTACHMENT_BYTES),
    maxResultPreviewBytes: s.number().step(1).min(1).default(DEFAULT_MAX_RESULT_PREVIEW_BYTES),
    maxResultArchiveBytes: s.number().step(1).min(1).default(DEFAULT_MAX_RESULT_ARCHIVE_BYTES),
    liveTradingToolNames: s.array(s.string()).default([]),
    teamFreshProvider: s.string().default('spawn'),
    teamForkProvider: s.string().default('fork'),
  })

  private readonly libraryStore: QuantSkillsLibraryStore
  private readonly modelAccess: QuantSkillsModelAccess

  /** Manage model providers through the Host settings and credential services. */
  @Remote('modelsAccess')
  async modelsAccess(request: ModelAccessRequest): Promise<ModelAccessResponse> {
    return this.modelAccess.run(request)
  }

  private readonly reservations = new Map<SessionId, Reservation>()
  private readonly plainReservations = new Map<SessionId, PlainReservation>()
  private readonly agentReservations = new Map<SessionId, AgentReservation>()
  private readonly agentStore: QuantSkillsAgentStore
  private readonly teamReservations = new Map<SessionId, TeamReservation>()
  private readonly teamMemberReservations = new Map<SessionId, TeamMemberReservation>()
  private readonly teamRuntimes = new Map<SessionId, TeamRuntime>()
  private readonly teamStore: QuantSkillsAgentTeamStore
  private readonly lifetime = new AbortController()
  private readonly attachmentTails = new Map<SessionId, Promise<void>>()
  private readonly resultPrepareTails = new Map<SessionId, Promise<void>>()
  private readonly residentSkillTails = new Map<SessionId, Promise<void>>()
  private readonly authoringCommitTails = new Map<SessionId, Promise<void>>()
  private readonly agentSetups = new WeakMap<Agent, Promise<void>>()
  private readonly residentSkillRuntimes = new Map<SessionId, ResidentSkillRuntime>()
  private readonly maxTextAttachmentBytes: number
  private readonly maxDocumentAttachmentBytes: number
  private readonly maxResultPreviewBytes: number
  private readonly maxResultArchiveBytes: number
  private readonly fileStore: QuantSkillsFileStore
  private readonly liveTradingToolNames: ReadonlySet<string>
  private readonly teamFreshProvider: string
  private readonly teamForkProvider: string
  private readonly workspaceResolver: QuantSkillsWorkspaceResolver
  private readonly contest: ContestService
  private contestSessionOpening: Promise<unknown> = Promise.resolve()

  /**
   * @param ctx - assembled QuantSkills Host context.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, 'quantSkillsSessions', { namespace: 'quantSkillsSessions' })
    this.contest = new ContestService(new OfficialContestCli(() => {
      const processes = ctx.get('subprocess')
      if (!processes) throw new Error('比赛 CLI 进程服务未就绪，请重新启动应用。')
      return processes
    },
      join(resolveDshHome(config.dshHome), 'quantskills', 'contest', 'auth')), config.dshHome)
    installQuantSkillsIdentity(ctx)
    this.libraryStore = new QuantSkillsLibraryStore(config.dshHome)
    ctx.inject(['connection' as never], (connectionCtx) => {
      connectionOf(connectionCtx).fetch.register({
        path: QUANTSKILLS_RESULT_FILE_PATH,
        methods: ['GET', 'HEAD'],
        fetch: request => this.resultFileResponse(request),
      })
    })

    this.modelAccess = new QuantSkillsModelAccess(ctx)
    registerQuantSkillsSessionEventTypes()
    this.agentStore = new QuantSkillsAgentStore(config.dshHome)
    this.teamStore = new QuantSkillsAgentTeamStore(config.dshHome)
    this.maxTextAttachmentBytes = config.maxTextAttachmentBytes ?? DEFAULT_MAX_TEXT_ATTACHMENT_BYTES
    this.maxDocumentAttachmentBytes = config.maxDocumentAttachmentBytes ?? DEFAULT_MAX_DOCUMENT_ATTACHMENT_BYTES
    this.fileStore = new QuantSkillsFileStore(config.dshHome, {
      maxFileBytes: config.maxFileAttachmentBytes ?? DEFAULT_MAX_FILE_ATTACHMENT_BYTES,
      maxSessionFileBytes: config.maxSessionFileAttachmentBytes ?? DEFAULT_MAX_SESSION_FILE_ATTACHMENT_BYTES,
    })
    this.maxResultPreviewBytes = config.maxResultPreviewBytes ?? DEFAULT_MAX_RESULT_PREVIEW_BYTES
    this.maxResultArchiveBytes = config.maxResultArchiveBytes ?? DEFAULT_MAX_RESULT_ARCHIVE_BYTES
    this.liveTradingToolNames = validateLiveTradingToolNames(config.liveTradingToolNames ?? [])
    this.teamFreshProvider = requiredProvider(config.teamFreshProvider ?? 'spawn', 'teamFreshProvider')
    this.teamForkProvider = requiredProvider(config.teamForkProvider ?? 'fork', 'teamForkProvider')
    this.workspaceResolver = new QuantSkillsWorkspaceResolver(
      ctx.workspaceRegistry,
      () => resolveQuantSkillsManagedPath({ signal: this.lifetime.signal }),
    )

    ctx.subagents.registerContinuableSetup(childCtx => this.setupTeamMember(childCtx))

    ctx.sessionProjections.register<'quantSkillsPlainSession', QuantSkillsPlainSessionBinding | null>({
      key: 'quantSkillsPlainSession',
      stateSchema: plainSessionBindingSchema.nullable(),
      init: () => null,
      apply: (state, event) => {
        if (event.type !== PLAIN_SESSION_EVENT) return state
        if (state !== null) throw new Error('session contains more than one quantskills/plain-session event')
        return parseQuantSkillsPlainSessionBinding(event.data)
      },
      wire: { viewSchema: plainSessionBindingSchema.nullable(), view: state => state },
      stateVersion: 1,
    })

    ctx.sessionProjections.register<'quantSkillsSession', QuantSkillsSessionBinding | null>({
      key: 'quantSkillsSession',
      stateSchema: bindingSchema.nullable(),
      init: () => null,
      apply: (state, event) => {
        if (event.type !== BINDING_EVENT) return state
        if (state !== null) throw new Error('session contains more than one quantskills/session-bound event')
        return parseQuantSkillsSessionBinding(event.data)
      },
      wire: { viewSchema: bindingSchema.nullable(), view: state => state },
      stateVersion: 1,
    })

    ctx.sessionProjections.register<'quantSkillsAgentSession', QuantSkillsAgentSessionBinding | null>({
      key: 'quantSkillsAgentSession',
      stateSchema: agentSessionSchema.nullable(),
      init: () => null,
      apply: (state, event) => {
        if (event.type !== AGENT_SESSION_EVENT) return state
        if (state !== null) throw new Error('session contains more than one quantskills/agent-session event')
        return parseQuantSkillsAgentSession(event.data)
      },
      wire: { viewSchema: agentSessionSchema.nullable(), view: state => state },
      stateVersion: 1,
    })

    ctx.sessionProjections.register<'quantSkillsAgentTeamSession', QuantSkillsAgentTeamSessionBinding | null>({
      key: 'quantSkillsAgentTeamSession',
      stateSchema: quantSkillsAgentTeamSessionSchema.nullable(),
      init: () => null,
      apply: (state, event) => {
        if (event.type === AGENT_TEAM_MEMBER_EVENT) return null
        if (event.type !== AGENT_TEAM_SESSION_EVENT) return state
        if (state !== null) throw new Error('session contains more than one quantskills/agent-team-session event')
        return parseQuantSkillsAgentTeamSession(event.data)
      },
      wire: { viewSchema: quantSkillsAgentTeamSessionSchema.nullable(), view: state => state },
      stateVersion: 1,
    })

    ctx.sessionProjections.register<'quantSkillsAgentTeamMember', QuantSkillsAgentTeamMemberSessionBinding | null>({
      key: 'quantSkillsAgentTeamMember',
      stateSchema: quantSkillsAgentTeamMemberSessionSchema.nullable(),
      init: () => null,
      apply: (state, event) => {
        if (event.type !== AGENT_TEAM_MEMBER_EVENT) return state
        if (state !== null) throw new Error('session contains more than one quantskills/agent-team-member event')
        return parseQuantSkillsAgentTeamMemberSession(event.data)
      },
      wire: { viewSchema: quantSkillsAgentTeamMemberSessionSchema.nullable(), view: state => state },
      stateVersion: 1,
    })

    ctx.sessionProjections.register<'quantSkillsResidentSkills', readonly QuantSkillsSessionBinding[]>({
      key: 'quantSkillsResidentSkills',
      stateSchema: residentSkillsSchema,
      init: () => Object.freeze([]),
      apply: (state, event) => applyResidentSkillEvent(state, event),
      wire: { viewSchema: residentSkillsSchema, view: state => state },
      stateVersion: 1,
    })

    ctx.sessionProjections.register<'quantSkillsAttachments', readonly QuantSkillsSessionFileAttachment[]>({
      key: 'quantSkillsAttachments',
      stateSchema: sessionFileAttachmentsSchema,
      init: () => Object.freeze([]),
      apply: (state, event) => event.type === FILE_ATTACHED_EVENT
        ? Object.freeze([...state, parseQuantSkillsSessionFileAttachment(event.data)])
        : state,
      wire: { viewSchema: sessionFileAttachmentsSchema, view: state => state },
      stateVersion: 1,
    })

    ctx.sessionProjections.register<'quantSkillsPandaRuntime', QuantSkillsPandaRuntimeBinding | null>({
      key: 'quantSkillsPandaRuntime',
      stateSchema: pandaRuntimeBindingSchema.nullable(),
      init: () => null,
      apply: (state, event) => {
        if (event.type !== PANDA_RUNTIME_EVENT) return state
        if (state !== null) throw new Error('session contains more than one panda/runtime-bound event')
        return parseQuantSkillsPandaRuntimeBinding(event.data)
      },
      wire: { viewSchema: pandaRuntimeBindingSchema.nullable(), view: state => state },
      stateVersion: 1,
    })

    ctx.sessionProjections.register<'quantSkillsAuthoring', QuantSkillsAuthoringKind | null>({
      key: 'quantSkillsAuthoring',
      stateSchema: z.enum(['skill', 'agent', 'agent-team']).nullable(),
      init: () => null,
      apply: (state, event) => {
        if (event.type !== AUTHORING_STARTED_EVENT) return state
        if (state !== null) throw new Error('session contains more than one quantskills/authoring-started event')
        return authoringStartedSchema.parse(event.data).kind
      },
      wire: { viewSchema: z.enum(['skill', 'agent', 'agent-team']).nullable(), view: state => state },
      stateVersion: 1,
    })

    ctx.sessionProjections.register({
      key: 'quantSkillsAuthoringPending',
      stateSchema: authoringReviewStateSchema,
      init: () => ({ kind: null, calls: [], pending: null }),
      apply: applyAuthoringReview,
      wire: { viewSchema: authoringReviewSchema.nullable(), view: state => state.pending },
      stateVersion: 1,
    })

    ctx.sessionProjections.register<'quantSkillsAuthoringCommits', readonly QuantSkillsAuthoringCommitted[]>({
      key: 'quantSkillsAuthoringCommits',
      stateSchema: z.array(authoringCommittedSchema).readonly() as unknown as z.ZodType<readonly QuantSkillsAuthoringCommitted[]>,
      init: () => Object.freeze([]),
      apply: (state, event) => event.type === AUTHORING_COMMITTED_EVENT
        ? Object.freeze([...state, parseQuantSkillsAuthoringCommitted(event.data)])
        : state,
      wire: {
        viewSchema: z.array(authoringCommittedSchema).readonly() as unknown as z.ZodType<readonly QuantSkillsAuthoringCommitted[]>,
        view: state => state,
      },
      stateVersion: 1,
    })

    ctx.effect(() => () => {
      this.lifetime.abort(new Error('quantskills-session: service disposed'))
      this.contest.dispose()
      this.reservations.clear()
      this.plainReservations.clear()
      this.agentReservations.clear()
      this.teamReservations.clear()
      this.teamMemberReservations.clear()
      this.teamRuntimes.clear()
      this.attachmentTails.clear()
      this.authoringCommitTails.clear()
      for (const runtime of this.residentSkillRuntimes.values()) disposeResidentRuntime(runtime)
      this.residentSkillRuntimes.clear()
    }, 'quantskills-session.lifecycle')
  }

  /**
   * Inspect the optional preferred and managed QuantSkills Workspace without creating it.
   * @param request - optional user-selected Workspace.
   * @returns current Workspace targets and preference health.
   */
  @Remote('workspaceStatus')
  workspaceStatus(request: QuantSkillsWorkspaceRequest): Promise<QuantSkillsWorkspaceStatusResult> {
    return this.workspaceResolver.status(request.preferredWorkspaceId)
  }

  /**
   * Select the preferred Workspace or create and register the managed fallback.
   * @param request - optional user-selected Workspace.
   * @returns the explicit Workspace target for a new Session.
   */
  @Remote('workspaceResolve')
  workspaceResolve(request: QuantSkillsWorkspaceRequest): Promise<QuantSkillsWorkspaceResolveResult> {
    return this.workspaceResolver.resolve(request.preferredWorkspaceId)
  }

  /** Read local contest status without starting processes or opening a browser. */
  @Remote('contestStatus')
  contestStatus(request: { sessionId?: string }): Promise<ContestStatus> { return this.contest.status(request.sessionId) }

  /** Explicit application mode toggle; never changes ordinary Session composition. */
  @Remote('contestMode')
  contestMode(request: { enabled: boolean }): Promise<ContestStatus> { return this.contest.setEnabled(request.enabled) }

  @Remote('contestConnect')
  contestConnect(): Promise<ContestStatus> { return this.contest.connect() }

  @Remote('contestDisconnect')
  contestDisconnect(): Promise<ContestStatus> { return this.contest.disconnect() }

  @Remote('contestCheckUpdate')
  contestCheckUpdate(): Promise<ContestStatus> { return this.contest.checkUpdate() }

  @Remote('contestUpdate')
  contestUpdate(): Promise<ContestStatus> { return this.contest.update() }

  @Remote('contestQuery')
  contestQuery(request: ContestQuery): Promise<ContestData> { return this.contest.query(request) }

  /** Entry inspection is bound to the persisted conversation, never a caller-supplied account. */
  @Remote('contestInspect')
  async contestInspect(request: { sessionId: SessionId }, signal?: AbortSignal): Promise<ContestInspection> {
    const existing = await this.inspectExisting(request.sessionId, this.operationSignal(signal))
    const binding = existing && foldQuantSkillsPlainSessionBinding(existing.events)
    if (binding?.purpose !== 'contest' || !binding.contest) throw new Error('账户巡检仅用于比赛专用会话。')
    return this.contest.inspect(binding.contest, signal)
  }

  /** Serialize entry across clients so each account reuses one main conversation. */
  @Remote('contestSessionOpen')
  contestSessionOpen(request: ContestSessionOpenRequest, signal?: AbortSignal): Promise<ContestSessionOpenResult> {
    const next = this.contestSessionOpening.catch(() => {}).then(async () => {
      const identity = await this.contest.researchIdentity()
      const active = this.operationSignal(signal)
      if (!request.topic) {
        const archives = await this.listPlainArchives({}, active)
        const candidates = archives.filter(item => !item.archived && !item.parentSessionId
          && item.binding.purpose === 'contest' && item.binding.contestConversation !== 'topic'
          && sameContest(item.binding.contest, identity))
        // Explicit main conversations win; legacy conversations can be adopted without rewriting history.
        const prior = candidates.find(item => item.binding.contestConversation === 'main')
          ?? candidates.sort((a, b) => a.createdAt - b.createdAt || a.sessionId.localeCompare(b.sessionId))[0]
        if (prior) {
          await this.sessionEnsure({ sessionId: prior.sessionId }, active)
          return { sessionId: prior.sessionId, binding: prior.binding, created: false }
        }
      }
      const created = await this.plainSessionCreate({ sessionId: request.sessionId, purpose: 'contest',
        contestConversation: request.topic ? 'topic' : 'main',
        ...(request.workspaceId === undefined ? {} : { workspaceId: request.workspaceId }),
        ...(request.cwd === undefined ? {} : { cwd: request.cwd }),
      }, active)
      if (!sameContest(created.binding.contest, identity)) throw new Error('比赛账户已切换，请重新进入。')
      return { sessionId: created.sessionId, binding: created.binding, created: true }
    })
    this.contestSessionOpening = next
    return next
  }

  /** Client-only execution endpoint. The model is never given an execute tool. */
  @Remote('contestExecute')
  contestExecute(request: { planId: string; sessionId: string }): Promise<ContestPlan> {
    return this.contest.execute(request.planId, request.sessionId)
  }

  @Remote('contestDismiss')
  contestDismiss(request: { planId: string; sessionId: string }): Promise<ContestStatus> {
    return this.contest.dismiss(request.planId, request.sessionId)
  }

  @Remote('contestReconcile')
  contestReconcile(request: { planId: string; sessionId: string }): Promise<ContestPlan> {
    return this.contest.reconcile(request.planId, request.sessionId)
  }

  /**
   * Resume one persisted QuantSkills Session and restore its plugin-owned composition.
   * @param request - existing QuantSkills Session identity.
   * @param signal - optional caller cancellation.
   * @returns the live Session identity after setup completes.
   */
  @Remote('sessionEnsure')
  async sessionEnsure(
    request: QuantSkillsSessionEnsureRequest,
    signal?: AbortSignal,
  ): Promise<QuantSkillsSessionEnsureResult> {
    const active = this.operationSignal(signal)
    const existing = await this.inspectExisting(request.sessionId, active)
    if (existing === undefined) {
      throw new Error(`QuantSkills Session "${request.sessionId}" was not found.`)
    }
    const owned = [
      foldQuantSkillsPlainSessionBinding(existing.events),
      foldQuantSkillsSessionBinding(existing.events),
      foldQuantSkillsAgentSession(existing.events),
      foldQuantSkillsAgentTeamSession(existing.events),
    ].filter(value => value !== null).length
    if (owned !== 1 || foldQuantSkillsAgentTeamMemberSession(existing.events) !== null) {
      throw new QuantSkillsSessionConflictError(
        `session "${request.sessionId}" is not one restorable QuantSkills root Session`,
      )
    }
    let agent = this.ctx.agents.get(request.sessionId)
    if (agent === undefined) {
      if (existing.header.cwd === undefined) {
        throw new Error(`QuantSkills Session "${request.sessionId}" has no Workspace path.`)
      }
      await this.ctx.sessionController.create({ sessionId: request.sessionId, cwd: existing.header.cwd })
      agent = this.ctx.agents.get(request.sessionId)
      if (agent === undefined) {
        throw new Error(`QuantSkills Session "${request.sessionId}" did not become live.`)
      }
    }
    await this.ensureAgentSetup(agent)
    return Object.freeze({ sessionId: request.sessionId })
  }

  /**
   * Create or idempotently adopt one product-owned QuantSkills Session without an asset composition.
   * @param request - preallocated SessionId, explicit purpose, and ordinary create options.
   * @param signal - optional caller cancellation.
   * @returns the published Session identity and durable QuantSkills ownership marker.
   */
  @Remote('plainSessionCreate')
  async plainSessionCreate(
    request: QuantSkillsPlainSessionCreateRequest,
    signal?: AbortSignal,
  ): Promise<QuantSkillsPlainSessionCreateResult> {
    if (request.workspaceId !== undefined && request.cwd !== undefined) {
      throw new TypeError('QuantSkills plain Session create accepts workspaceId or cwd, not both')
    }
    const active = this.operationSignal(signal)
    if (request.contestConversation !== undefined && request.purpose !== 'contest') throw new Error('普通会话不能设置比赛对话类型。')
    const binding = Object.freeze({ purpose: request.purpose,
      ...(request.purpose === 'contest' ? { contest: await this.contest.researchIdentity() } : {}),
      ...(request.contestConversation === undefined ? {} : { contestConversation: request.contestConversation }),
    })
    if (this.reservations.has(request.sessionId)
      || this.agentReservations.has(request.sessionId)
      || this.teamReservations.has(request.sessionId)
      || this.teamMemberReservations.has(request.sessionId)) {
      throw new QuantSkillsSessionConflictError(
        `session "${request.sessionId}" is reserved for another QuantSkills composition`,
      )
    }
    const priorReservation = this.plainReservations.get(request.sessionId)
    if (priorReservation !== undefined && !samePlainBinding(priorReservation.binding, binding)) {
      throw new QuantSkillsSessionConflictError(
        `session "${request.sessionId}" is reserved for another QuantSkills purpose`,
      )
    }
    const existing = await this.inspectExisting(request.sessionId, active)
    if (existing !== undefined) {
      const current = foldQuantSkillsPlainSessionBinding(existing.events)
      if (current === null || !samePlainBinding(current, binding)
        || foldQuantSkillsSessionBinding(existing.events) !== null
        || foldQuantSkillsAgentSession(existing.events) !== null
        || foldQuantSkillsAgentTeamSession(existing.events) !== null
        || foldQuantSkillsAgentTeamMemberSession(existing.events) !== null) {
        throw new QuantSkillsSessionConflictError(
          `session "${request.sessionId}" already exists with another owner or QuantSkills purpose`,
        )
      }
    }

    const reservation = priorReservation ?? Object.freeze({ binding })
    if (priorReservation === undefined) this.plainReservations.set(request.sessionId, reservation)
    try {
      const response = await this.ctx.sessionController.create({
        sessionId: request.sessionId,
        ...request.workspaceId === undefined ? {} : { workspaceId: request.workspaceId },
        ...request.cwd === undefined ? {} : { cwd: request.cwd },
        ...request.agentPreset === undefined ? {} : { agentPreset: request.agentPreset },
      })
      const agent = this.ctx.agents.get(request.sessionId)
      if (agent === undefined) throw new Error(`session "${request.sessionId}" did not become live`)
      await this.ensureAgentSetup(agent)
      const published = foldQuantSkillsPlainSessionBinding(agent.session.events)
      if (published === null || !samePlainBinding(published, binding)) {
        throw new Error(`session "${request.sessionId}" was published without its complete QuantSkills setup`)
      }
      return Object.freeze({
        sessionId: request.sessionId,
        binding,
        ...response.agentPreset === undefined
          ? {}
          : { agentPreset: response.agentPreset },
      })
    } finally {
      if (this.plainReservations.get(request.sessionId) === reservation) {
        this.plainReservations.delete(request.sessionId)
      }
    }
  }

  /**
   * Create or idempotently adopt one session under an exact installed Skill version.
   * @param request - preallocated SessionId, exact installed version, and ordinary create options.
   * @param signal - optional caller cancellation.
   * @returns the published session identity and durable binding.
   */
  @Remote('create')
  async create(
    request: QuantSkillsSessionCreateRequest,
    signal?: AbortSignal,
  ): Promise<QuantSkillsSessionCreateResult> {
    if (request.workspaceId !== undefined && request.cwd !== undefined) {
      throw new TypeError('QuantSkills session create accepts workspaceId or cwd, not both')
    }
    const active = this.operationSignal(signal)
    const resolved = await this.ctx.quantSkillsHost.resolveInstalledSkill(request.versionId, active)
    const binding = bindingFrom(resolved.version)
    if (this.plainReservations.has(request.sessionId)) {
      throw new QuantSkillsSessionConflictError(
        `session "${request.sessionId}" is reserved for a plain QuantSkills Session`,
      )
    }
    if (this.agentReservations.has(request.sessionId)) {
      throw new QuantSkillsSessionConflictError(
        `session "${request.sessionId}" is reserved for a QuantSkills Agent composition`,
      )
    }
    const priorReservation = this.reservations.get(request.sessionId)
    if (priorReservation !== undefined && !sameBinding(priorReservation.binding, binding)) {
      throw this.conflict(request.sessionId, priorReservation.binding)
    }

    const existing = await this.inspectExisting(request.sessionId, active)
    if (existing !== undefined) {
      if (foldQuantSkillsAgentSession(existing.events) !== null) {
        throw new QuantSkillsSessionConflictError(
          `session "${request.sessionId}" already exists as an Agent-bound session`,
        )
      }
      const current = foldQuantSkillsSessionBinding(existing.events)
      if (current === null || !sameBinding(current, binding)) throw this.conflict(request.sessionId, current)
      const liveAgent = this.ctx.agents.get(request.sessionId)
      if (liveAgent !== undefined && !(await this.agentMatchesResidentLog(liveAgent, active))) {
        throw new QuantSkillsSessionConflictError(
          `session "${request.sessionId}" is live without its exact QuantSkills setup and cannot be adopted`,
        )
      }
    }

    const reservation = priorReservation ?? Object.freeze({ binding, resolved })
    if (priorReservation === undefined) this.reservations.set(request.sessionId, reservation)
    try {
      const response = await this.ctx.sessionController.create({
        sessionId: request.sessionId,
        ...request.workspaceId === undefined ? {} : { workspaceId: request.workspaceId },
        ...request.cwd === undefined ? {} : { cwd: request.cwd },
        ...request.agentPreset === undefined ? {} : { agentPreset: request.agentPreset },
      })
      const agent = this.ctx.agents.get(request.sessionId)
      if (agent === undefined) throw new Error(`session "${request.sessionId}" did not become live`)
      await this.ensureAgentSetup(agent)
      const published = foldQuantSkillsSessionBinding(agent.session.events)
      if (published === null || !sameBinding(published, binding)
        || !(await this.agentMatchesResidentLog(agent, active))) {
        throw new Error(`session "${request.sessionId}" was published without its exact QuantSkills setup`)
      }
      return Object.freeze({
        sessionId: request.sessionId,
        binding,
        ...response.agentPreset === undefined
          ? {}
          : { agentPreset: response.agentPreset },
      })
    } finally {
      if (this.reservations.get(request.sessionId) === reservation) this.reservations.delete(request.sessionId)
    }
  }

  /**
   * List real QuantSkills conversation archives from live and persisted session truth.
   * @param request - archive visibility filter.
   * @param signal - optional caller cancellation.
   * @returns Skill-bound ordinary sessions ordered by most recent activity.
   */
  @Remote('list')
  async list(
    request: QuantSkillsSessionListRequest,
    signal?: AbortSignal,
  ): Promise<readonly QuantSkillsSessionArchiveItem[]> {
    const active = this.operationSignal(signal)
    return this.listArchives(request, active)
  }

  /**
   * List ordinary QuantSkills conversations that do not yet load a Skill, Agent, or Team.
   * @param request - archive visibility filter.
   * @param signal - optional caller cancellation.
   * @returns ordinary product-owned Sessions ordered by most recent activity.
   */
  @Remote('plainSessionList')
  async plainSessionList(
    request: QuantSkillsSessionListRequest,
    signal?: AbortSignal,
  ): Promise<readonly QuantSkillsPlainSessionArchiveItem[]> {
    return this.listPlainArchives(request, this.operationSignal(signal))
  }

  /**
   * Aggregate frequently used Skills from real bound conversation archives.
   * @param request - archive visibility and bounded result count.
   * @param signal - optional caller cancellation.
   * @returns usage rows ordered by session count and recency.
   */
  @Remote('frequent')
  async frequent(
    request: QuantSkillsFrequentRequest,
    signal?: AbortSignal,
  ): Promise<readonly QuantSkillsFrequentSkill[]> {
    const limit = request.limit ?? 12
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_FREQUENT_LIMIT) {
      throw new TypeError(`QuantSkills frequent limit must be an integer from 1 to ${String(MAX_FREQUENT_LIMIT)}`)
    }
    const archives = await this.listArchives(request, this.operationSignal(signal))
    const rows = new Map<QuantSkillsAssetId, QuantSkillsFrequentSkill>()
    for (const archive of archives) {
      const current = rows.get(archive.binding.assetId)
      rows.set(archive.binding.assetId, Object.freeze({
        assetId: archive.binding.assetId,
        sessionCount: (current?.sessionCount ?? 0) + 1,
        lastUsedAt: Math.max(current?.lastUsedAt ?? 0, archive.updatedAt),
        recentSessionId: current === undefined || archive.updatedAt > current.lastUsedAt
          ? archive.sessionId
          : current.recentSessionId,
      }))
    }
    return Object.freeze([...rows.values()]
      .sort((left, right) => right.sessionCount - left.sessionCount
        || right.lastUsedAt - left.lastUsedAt
        || left.assetId.localeCompare(right.assetId))
      .slice(0, limit))
  }

  /**
   * Attach one exact installed Skill as resident Session context without creating a user message.
   * @param request - live QuantSkills Session and exact installed version.
   * @param signal - optional caller cancellation.
   * @returns the authoritative resident Skill set after the append.
   */
  @Remote('residentSkillAttach')
  async residentSkillAttach(
    request: QuantSkillsResidentSkillAttachRequest,
    signal?: AbortSignal,
  ): Promise<QuantSkillsResidentSkillResult> {
    const active = this.operationSignal(signal)
    return this.withSessionLock(this.residentSkillTails, request.sessionId, async () => {
      active.throwIfAborted()
      const agent = this.requireLiveQuantSkillsAgent(request.sessionId)
      await this.ensureAgentSetup(agent)
      const runtime = this.requireResidentRuntime(request.sessionId)
      const resolved = await this.ctx.quantSkillsHost.resolveInstalledSkill(request.versionId, active)
      active.throwIfAborted()
      const binding = bindingFrom(resolved.version)
      const current = foldQuantSkillsResidentSkills(agent.session.events)
      const occupied = current.find(item => item.assetId === binding.assetId)
      if (occupied !== undefined) {
        if (!sameBinding(occupied, binding)) {
          throw new Error(`QuantSkills Skill "${binding.assetId}" is already resident at another version.`)
        }
        return Object.freeze({ skills: current })
      }
      const registered = this.registerResidentSkill(agent.ctx, resolved)
      runtime.entries.set(binding.assetId, registered)
      try {
        agent.session.append(RESIDENT_SKILL_EVENT, Object.freeze({
          operation: 'attach',
          binding,
          changedAt: Date.now(),
        }))
      } catch (error) {
        runtime.entries.delete(binding.assetId)
        registered.dispose()
        throw error
      }
      return Object.freeze({ skills: foldQuantSkillsResidentSkills(agent.session.events) })
    })
  }

  /**
   * Detach one resident Skill by stable asset identity without rewriting conversation history.
   * @param request - live QuantSkills Session and resident asset identity.
   * @returns the authoritative resident Skill set after the append.
   */
  @Remote('residentSkillDetach')
  residentSkillDetach(request: QuantSkillsResidentSkillDetachRequest): Promise<QuantSkillsResidentSkillResult> {
    return this.withSessionLock(this.residentSkillTails, request.sessionId, async () => {
      const agent = this.requireLiveQuantSkillsAgent(request.sessionId)
      await this.ensureAgentSetup(agent)
      const runtime = this.requireResidentRuntime(request.sessionId)
      const current = foldQuantSkillsResidentSkills(agent.session.events)
      const binding = current.find(item => item.assetId === request.assetId)
      if (binding === undefined) return Object.freeze({ skills: current })
      agent.session.append(RESIDENT_SKILL_EVENT, Object.freeze({
        operation: 'detach',
        binding,
        changedAt: Date.now(),
      }))
      const registered = runtime.entries.get(request.assetId)
      runtime.entries.delete(request.assetId)
      registered?.dispose()
      return Object.freeze({ skills: foldQuantSkillsResidentSkills(agent.session.events) })
    })
  }

  /**
   * List optional parameter forms reachable from the live Session composition.
   * @param request - live QuantSkills Session identity.
   * @param signal - optional caller cancellation.
   * @returns exact-version forms for resident Skills and declared Agent sources.
   */
  @Remote('promptFormList')
  async promptFormList(
    request: QuantSkillsPromptFormListRequest,
    signal?: AbortSignal,
  ): Promise<QuantSkillsPromptFormListResult> {
    const active = this.operationSignal(signal)
    const agent = this.requireLiveQuantSkillsAgent(request.sessionId)
    return Object.freeze({ forms: await this.listPromptForms(agent, active) })
  }

  /**
   * Render a parameter form only when its exact version belongs to the live Session.
   * @param request - Session, exact version, task, and declared field values.
   * @param signal - optional caller cancellation.
   * @returns plain text suitable for an ordinary logged user message.
   */
  @Remote('promptFormRender')
  async promptFormRender(
    request: QuantSkillsPromptFormRenderRequest,
    signal?: AbortSignal,
  ): Promise<QuantSkillsPromptFormRenderResult> {
    const active = this.operationSignal(signal)
    const agent = this.requireLiveQuantSkillsAgent(request.sessionId)
    const forms = await this.listPromptForms(agent, active)
    const capability = forms.find(candidate => candidate.versionId === request.versionId)
    if (capability === undefined) {
      throw new Error('QuantSkills parameter form version is not part of the addressed Session.')
    }
    if (capability.promptForm.status === 'invalid') {
      throw new Error(`QuantSkills parameter form is unavailable: ${capability.promptForm.reason}`)
    }
    const attachments = foldQuantSkillsSessionFileAttachments(agent.session.events)
    return Object.freeze({
      text: renderPromptForm(capability, request, attachments),
    })
  }

  /**
   * Read durable user Agent definitions ordered by most recent update.
   * @returns immutable validated definitions.
   */
  @Remote('agentList')
  agentList(): Promise<readonly QuantSkillsAgentDefinition[]> {
    return this.agentStore.list()
  }

  /**
   * Create one durable user Agent after resolving every exact Skill version.
   * @param request - role, orchestration mode, and ordered installed versions.
   * @param signal - optional caller cancellation.
   * @returns the Host-owned Agent definition.
   */
  /** Explicit provenance only; absent legacy rows remain unknown in the UI. */
  @Remote('agentLibrarySources')
  async agentLibrarySources(): Promise<readonly QuantSkillsLibrarySourceRecord[]> {
    // This store only contains locally created teams; it has no catalog/import writer.
    // Recover older saves that predate the provenance sidecar without touching revisions.
    const records = await this.libraryStore.list()
    const known = new Set(records.map(record => record.id))
    for (const team of await this.teamStore.list()) {
      if (!known.has(team.teamId)) await this.libraryStore.put({ id: team.teamId, kind: 'agent-team', source: 'personal', method: 'recovered' })
    }
    return this.libraryStore.list()
  }

  @Remote('agentCreate')
  async agentCreate(
    request: QuantSkillsAgentCreateRequest,
    signal?: AbortSignal,
  ): Promise<QuantSkillsAgentDefinition> {
    return this.createAgentDefinition(request, signal)
  }

  private async createAgentDefinition(
    request: QuantSkillsAgentCreateRequest, signal?: AbortSignal, targetId?: string,
  ): Promise<QuantSkillsAgentDefinition> {
    if (request.purpose !== undefined && (request.purpose !== 'authoring-helper' || request.copyFrom !== undefined || request.sourceVersionId !== undefined)) {
      throw new Error('内部助手只能显式新建，不能把已有或已安装智能体改成内部助手。')
    }
    if (request.copyFrom !== undefined) {
      const source = (await this.agentStore.list()).find(item => item.agentId === request.copyFrom!.agentId)
      if (!source || source.revision !== request.copyFrom.expectedRevision) throw new QuantSkillsSessionConflictError('复制来源已变化，请刷新后重试。')
    }
    const agentId = `agent-${targetId ?? randomUUID()}`
    if (targetId !== undefined) {
      const existing = (await this.agentStore.list()).find(item => item.agentId === agentId)
      if (existing !== undefined) return existing
    }
    const active = this.operationSignal(signal)
    const resolved = await this.resolveAgentSkills(request, active)
    active.throwIfAborted()
    const time = Date.now()
    const definition = freezeDefinition({
      agentId,
      revision: 1,
      name: capabilityDisplayName(request.name.trim(), request.role),
      role: request.role.trim(),
      mode: request.mode,
      ...(request.model === undefined ? {} : { model: request.model }),
      permission: request.permission ?? 'workspace-write',
      ...(request.sourceVersionId === undefined ? {} : { sourceVersionId: request.sourceVersionId }),
      skills: resolved.map(item => bindingFrom(item.version)),
      createdAt: time,
      updatedAt: time,
    })
    const installed = request.sourceVersionId === undefined ? undefined
      : (await this.ctx.quantSkillsHost.list(active)).versions.find(item => item.versionId === request.sourceVersionId)
    await this.libraryStore.put({
      id: agentId, kind: 'agent', source: request.purpose === 'authoring-helper' ? 'internal' : installed?.origin === 'catalog' && !request.copyFrom ? 'installed' : 'personal',
      method: request.purpose === 'authoring-helper' ? 'internal' : installed?.origin === 'catalog' && !request.copyFrom ? 'installation' : targetId ? 'ai' : 'manual',
    })
    return this.agentStore.mutate(agents => ({
      agents: [...agents, definition],
      result: definition,
    }))
  }

  /**
   * Replace one durable user Agent through optimistic revision matching.
   * @param request - identity, expected revision, and complete editable fields.
   * @param signal - optional caller cancellation.
   * @returns the committed next revision.
   */
  @Remote('agentUpdate')
  async agentUpdate(
    request: QuantSkillsAgentUpdateRequest,
    signal?: AbortSignal,
  ): Promise<QuantSkillsAgentDefinition> {
    if (request.purpose !== undefined) throw new Error('保存编辑不能改变智能体的来源分类。')
    if (request.copyFrom !== undefined) throw new Error('个人副本必须通过创建接口保存，不能覆盖来源。')
    const source = (await this.libraryStore.list()).find(item => item.id === request.agentId)
    if (source?.source === 'installed') throw new Error('已安装智能体不可覆盖，请另存为我的副本。')
    const active = this.operationSignal(signal)
    const resolved = await this.resolveAgentSkills(request, active)
    active.throwIfAborted()
    return this.agentStore.mutate((agents) => {
      const index = agents.findIndex(agent => agent.agentId === request.agentId)
      const current = agents[index]
      if (current === undefined) throw new Error(`QuantSkills Agent "${request.agentId}" was not found.`)
      if (current.revision !== request.expectedRevision) {
        throw new Error(`QuantSkills Agent "${request.agentId}" changed; refresh before saving.`)
      }
      const updated = freezeDefinition({
        agentId: current.agentId,
        revision: current.revision + 1,
        name: request.name.trim(),
        role: request.role.trim(),
        mode: request.mode,
        ...(request.model === undefined ? {} : { model: request.model }),
        permission: request.permission ?? 'workspace-write',
        ...(request.sourceVersionId === undefined ? {} : { sourceVersionId: request.sourceVersionId }),
        skills: resolved.map(item => bindingFrom(item.version)),
        createdAt: current.createdAt,
        updatedAt: Date.now(),
      })
      return {
        agents: agents.map((agent, candidate) => candidate === index ? updated : agent),
        result: updated,
      }
    })
  }

  /**
   * Delete one durable user Agent through optimistic revision matching.
   * Existing Agent Sessions remain reconstructable from their logs.
   * @param request - identity and expected revision.
   */
  @Remote('agentDelete')
  async agentDelete(request: QuantSkillsAgentDeleteRequest): Promise<void> {
    await this.agentStore.mutate((agents) => {
      const current = agents.find(agent => agent.agentId === request.agentId)
      if (current === undefined) throw new Error(`QuantSkills Agent "${request.agentId}" was not found.`)
      if (current.revision !== request.expectedRevision) {
        throw new Error(`QuantSkills Agent "${request.agentId}" changed; refresh before deleting.`)
      }
      return {
        agents: agents.filter(agent => agent.agentId !== request.agentId),
        result: undefined,
      }
    })
  }

  /** Uninstall an imported Agent; frozen Team definitions and session histories remain valid. */
  @Remote('agentUninstall')
  async agentUninstall(request: QuantSkillsAgentDeleteRequest): Promise<void> {
    await this.agentStore.mutate(async agents => {
      const current = agents.find(agent => agent.agentId === request.agentId)
      if (!current || current.revision !== request.expectedRevision) throw new Error('智能体已变化，请刷新后重试。')
      if (!current.sourceVersionId) throw new Error('此智能体不是已安装的公共能力。')
      const template = await this.ctx.quantSkillsHost.agentTemplate(current.sourceVersionId)
      if (template.version.origin !== 'catalog') throw new Error('此智能体不是已安装的公共能力。')
      const remaining = agents.filter(agent => agent.agentId !== current.agentId)
      const assetId = template.version.assetId
      if (!remaining.some(agent => agent.sourceVersionId?.startsWith(`${assetId}@`))) {
        await this.ctx.quantSkillsHost.uninstallAsset({ assetId })
      }
      return { agents: remaining, result: undefined }
    })
  }

  /**
   * Atomically create or adopt one Session under an immutable user Agent composition.
   * @param request - fresh Session id, exact Agent revision, and ordinary create options.
   * @param signal - optional caller cancellation.
   * @returns the published Session and logged Agent composition.
   */
  @Remote('agentSessionCreate')
  async agentSessionCreate(
    request: QuantSkillsAgentSessionCreateRequest,
    signal?: AbortSignal,
  ): Promise<QuantSkillsAgentSessionCreateResult> {
    return this.createAgentSession(request, undefined, signal)
  }

  /**
   * Atomically create one Agent Session whose authoring purpose is durable before its tools are exposed.
   * @param request - fresh Session identity, exact Agent revision, Workspace, and authoring kind.
   * @param signal - optional caller cancellation.
   * @returns the published Agent Session and exact composition.
   */
  @Remote('authoringSessionCreate')
  async authoringSessionCreate(
    request: QuantSkillsAuthoringSessionCreateRequest,
    signal?: AbortSignal,
  ): Promise<QuantSkillsAgentSessionCreateResult> {
    return this.createAgentSession(request, request.kind, signal)
  }

  /**
   * Commit one successful logged draft after an explicit Client confirmation.
   * @param request - Session-owned Tool call identity and observed content digest.
   * @param signal - optional caller cancellation.
   * @returns the immutable local asset, Agent, or Team publication.
   */
  @Remote('authoringCommit')
  authoringCommit(
    request: QuantSkillsAuthoringCommitRequest,
    signal?: AbortSignal,
  ): Promise<QuantSkillsAuthoringCommitResult> {
    const active = this.operationSignal(signal)
    return this.withSessionLock(this.authoringCommitTails, request.sessionId, async () => {
      active.throwIfAborted()
      const agent = this.requireLiveQuantSkillsAgent(request.sessionId)
      const authoringKind = foldQuantSkillsAuthoringStarted(agent.session.events)
      if (authoringKind === null) throw new Error('QuantSkills Session is not an authoring Session.')
      const prior = foldQuantSkillsAuthoringCommitted(agent.session.events)
        .find(commit => commit.toolCallId === request.toolCallId && commit.treeDigest === request.expectedTreeDigest)
      if (prior !== undefined) return prior.result
      const logged = successfulAuthoringToolResult(agent.session.events, request.toolCallId, authoringKind)
      if (logged.treeDigest !== request.expectedTreeDigest) {
        throw new Error('QuantSkills draft changed after the confirmation card was rendered.')
      }
      let result: QuantSkillsAuthoringCommitResult
      if (authoringKind === 'agent-team') {
        const prepared = teamDraftCommitSchema.parse(logged.value)
        const description = [
          prepared.draft.description.trim(),
          '',
          '成员职责',
          ...prepared.draft.members.map(member => `- ${member.name}：${member.responsibility}`),
        ].join('\n')
        const fields: QuantSkillsAgentTeamCreateRequest = {
          name: prepared.draft.name.trim(),
          description,
          leadAgentId: prepared.draft.lead.agentId as QuantSkillsAgentDefinition['agentId'],
          leadAgentRevision: prepared.draft.lead.revision,
          leadModel: prepared.draft.leadModel,
          members: prepared.draft.members.map(member => ({
            name: member.name,
            agentId: member.agent.agentId as QuantSkillsAgentDefinition['agentId'],
            agentRevision: member.agent.revision,
            context: member.context,
            model: member.model,
          })),
        }
        const previous = [...foldQuantSkillsAuthoringCommitted(agent.session.events)].reverse()
          .find(commit => commit.result.kind === 'agent-team')
        const team = previous?.result.kind === 'agent-team'
          ? await this.agentTeamUpdate({
            ...fields,
            teamId: previous.result.team.teamId,
            expectedRevision: previous.result.team.revision,
          })
          : await this.agentTeamCreate(fields)
        await this.libraryStore.put({ id: team.teamId, kind: 'agent-team', source: 'personal', method: 'ai' })
        result = Object.freeze({ kind: 'agent-team', team })
      } else {
        const prepared = assetDraftResultSchema.parse(logged.value)
        if (prepared.draft.assetKind !== authoringKind) {
          throw new Error('QuantSkills draft kind does not match the Session authoring purpose.')
        }
        const cwd = agent.session.header.cwd
        if (cwd === undefined) throw new Error('QuantSkills authoring Session has no Workspace path.')
        const workspaceRoot = await this.ctx.fs.resolve('.', { cwd, signal: active })
        const draftsRoot = await this.ctx.fs.resolve('quantskills-drafts', { cwd, signal: active })
        const draftRoot = await this.ctx.fs.resolve(prepared.draft.draftPath, { cwd, signal: active })
        if (!this.ctx.fs.contains(workspaceRoot, draftsRoot) || !this.ctx.fs.contains(draftsRoot, draftRoot)) {
          throw new Error('QuantSkills authoring draft escaped the Session Workspace.')
        }
        const version = await this.ctx.quantSkillsHost.publishAuthoredDraft({
          draftRoot: this.ctx.fs.processPath(draftRoot),
          kind: authoringKind,
          expectedTreeDigest: request.expectedTreeDigest,
        }, active)
        if (authoringKind === 'skill') {
          result = Object.freeze({ kind: 'skill', version })
        } else {
          const template = await this.ctx.quantSkillsHost.agentTemplate(version.versionId, active)
          const installed = await this.ctx.quantSkillsHost.list(active)
          const versionIds = template.requires.map((assetId) => {
            const candidates = installed.versions
              .filter(candidate => candidate.kind === 'skill' && candidate.assetId === assetId)
              .sort((left, right) => right.installedAt - left.installedAt
                || right.versionId.localeCompare(left.versionId))
            const selected = candidates[0]
            if (selected === undefined) throw new Error(`QuantSkills authored Agent requires missing Skill "${assetId}".`)
            return selected.versionId
          })
          const previous = [...foldQuantSkillsAuthoringCommitted(agent.session.events)].reverse()
            .find(commit => commit.result.kind === 'agent')
          const fields: QuantSkillsAgentCreateRequest = {
            name: template.name,
            role: template.instructions,
            mode: 'dynamic',
            permission: 'workspace-write',
            sourceVersionId: version.versionId,
            versionIds,
          }
          const definition = previous?.result.kind === 'agent'
            ? await this.agentUpdate({
              ...fields,
              agentId: previous.result.agent.agentId,
              expectedRevision: previous.result.agent.revision,
            }, active)
            : await this.agentCreate(fields, active)
          result = Object.freeze({ kind: 'agent', version, agent: definition })
        }
      }
      const committed: QuantSkillsAuthoringCommitted = Object.freeze({
        toolCallId: request.toolCallId,
        treeDigest: request.expectedTreeDigest,
        result,
      })
      agent.session.append(AUTHORING_COMMITTED_EVENT, committed)
      return result
    })
  }

  private async createAgentSession(
    request: QuantSkillsAgentSessionCreateRequest,
    authoringKind: QuantSkillsAuthoringKind | undefined,
    signal?: AbortSignal,
  ): Promise<QuantSkillsAgentSessionCreateResult> {
    if (request.workspaceId !== undefined && request.cwd !== undefined) {
      throw new TypeError('QuantSkills Agent Session create accepts workspaceId or cwd, not both')
    }
    const active = this.operationSignal(signal)
    if (this.plainReservations.has(request.sessionId)) {
      throw new QuantSkillsSessionConflictError(
        `session "${request.sessionId}" is reserved for a plain QuantSkills Session`,
      )
    }
    const prior = this.agentReservations.get(request.sessionId)
    if (prior !== undefined && !matchesAgentRequest(prior.agent, request)) {
      throw new QuantSkillsSessionConflictError(
        `session "${request.sessionId}" is reserved for another QuantSkills Agent composition`,
      )
    }
    if (prior !== undefined && prior.authoringKind !== authoringKind) {
      throw new QuantSkillsSessionConflictError(
        `session "${request.sessionId}" is reserved for another QuantSkills authoring purpose`,
      )
    }
    const existing = await this.inspectExisting(request.sessionId, active)
    let definition: QuantSkillsAgentSessionBinding
    let resolved: readonly QuantSkillsResolvedInstalledSkill[]
    if (existing !== undefined) {
      if (foldQuantSkillsSessionBinding(existing.events) !== null) {
        throw new QuantSkillsSessionConflictError(
          `session "${request.sessionId}" already exists as a Skill-bound session`,
        )
      }
      const logged = foldQuantSkillsAgentSession(existing.events)
      if (logged === null || !matchesAgentRequest(logged, request)) {
        throw new QuantSkillsSessionConflictError(
          `session "${request.sessionId}" already exists under another composition`,
        )
      }
      if (prior !== undefined && !sameAgent(prior.agent, logged)) {
        throw new QuantSkillsSessionConflictError(
          `session "${request.sessionId}" has another reserved Agent composition`,
        )
      }
      const loggedAuthoring = foldQuantSkillsAuthoringStarted(existing.events)
      if (authoringKind !== undefined && loggedAuthoring !== authoringKind) {
        throw new QuantSkillsSessionConflictError(
          `session "${request.sessionId}" already exists under another QuantSkills authoring purpose`,
        )
      }
      definition = logged
      resolved = prior?.resolved ?? await this.resolveBindings(logged.skills, active)
    } else if (prior !== undefined) {
      definition = prior.agent
      resolved = prior.resolved
    } else {
      const current = (await this.agentStore.list()).find(agent => agent.agentId === request.agentId)
      if (current === undefined) throw new Error(`QuantSkills Agent "${request.agentId}" was not found.`)
      if (current.revision !== request.expectedRevision) {
        throw new Error(`QuantSkills Agent "${request.agentId}" changed; refresh before running.`)
      }
      definition = current
      resolved = await this.resolveBindings(current.skills, active)
    }
    const reservation = prior ?? Object.freeze({
      agent: definition,
      resolved,
      ...(authoringKind === undefined ? {} : { authoringKind }),
    })
    if (prior === undefined) this.agentReservations.set(request.sessionId, reservation)
    try {
      const response = await this.ctx.sessionController.create({
        sessionId: request.sessionId,
        ...request.workspaceId === undefined ? {} : { workspaceId: request.workspaceId },
        ...request.cwd === undefined ? {} : { cwd: request.cwd },
        ...request.agentPreset === undefined ? {} : { agentPreset: request.agentPreset },
      })
      const agent = this.ctx.agents.get(request.sessionId)
      if (agent === undefined) throw new Error(`session "${request.sessionId}" did not become live`)
      await this.ensureAgentSetup(agent)
      const published = foldQuantSkillsAgentSession(agent.session.events)
      if (published === null || !sameAgent(published, definition)
        || !(await this.agentMatchesResidentLog(agent, active))) {
        throw new Error(`session "${request.sessionId}" was published without its exact QuantSkills Agent setup`)
      }
      return Object.freeze({
        sessionId: request.sessionId,
        agent: published,
        ...response.agentPreset === undefined
          ? {}
          : { agentPreset: response.agentPreset },
      })
    } finally {
      if (this.agentReservations.get(request.sessionId) === reservation) {
        this.agentReservations.delete(request.sessionId)
      }
    }
  }

  /**
   * List real user Agent conversation archives from live and persisted Session truth.
   * @param request - archive visibility filter.
   * @param signal - optional caller cancellation.
   * @returns Agent-bound Sessions ordered by most recent activity.
   */
  @Remote('agentSessionList')
  async agentSessionList(
    request: QuantSkillsSessionListRequest,
    signal?: AbortSignal,
  ): Promise<readonly QuantSkillsAgentSessionArchiveItem[]> {
    return this.listAgentArchives(request, this.operationSignal(signal))
  }

  /**
   * Read saved Agent Team definitions ordered by most recent update.
   * @returns immutable Agent Team definitions.
   */
  @Remote('agentTeamList')
  agentTeamList(): Promise<readonly QuantSkillsAgentTeamDefinition[]> {
    return this.teamStore.list()
  }

  /**
   * Resolve Agent references and create one immutable saved Agent Team.
   * @param request - Team name, goal, Lead revision, and member revisions.
   * @returns the saved exact Team definition.
   */
  @Remote('agentTeamCreate')
  async agentTeamCreate(request: QuantSkillsAgentTeamCreateRequest): Promise<QuantSkillsAgentTeamDefinition> {
    const composition = await this.resolveTeamRequest(request)
    const time = Date.now()
    const definition = freezeTeamDefinition({
      teamId: `agent-team-${randomUUID()}`,
      revision: 1,
      name: request.name.trim(),
      description: request.description.trim(),
      ...composition,
      createdAt: time,
      updatedAt: time,
    })
    await this.libraryStore.put({ id: definition.teamId, kind: 'agent-team', source: 'personal', method: 'manual' })
    return this.teamStore.mutate(teams => ({ teams: [...teams, definition], result: definition }))
  }

  /**
   * Replace one saved Agent Team through optimistic revision matching.
   * @param request - replacement composition and observed Team revision.
   * @returns the updated exact Team definition.
   */
  @Remote('agentTeamUpdate')
  async agentTeamUpdate(request: QuantSkillsAgentTeamUpdateRequest): Promise<QuantSkillsAgentTeamDefinition> {
    const composition = await this.resolveTeamRequest(request)
    return this.teamStore.mutate((teams) => {
      const index = teams.findIndex(team => team.teamId === request.teamId)
      const current = teams[index]
      if (current === undefined) throw new Error(`QuantSkills Agent Team "${request.teamId}" was not found.`)
      if (current.revision !== request.expectedRevision) {
        throw new Error(`QuantSkills Agent Team "${request.teamId}" changed; refresh before saving.`)
      }
      const updated = freezeTeamDefinition({
        teamId: current.teamId,
        revision: current.revision + 1,
        name: request.name.trim(),
        description: request.description.trim(),
        ...composition,
        createdAt: current.createdAt,
        updatedAt: Date.now(),
      })
      return {
        teams: teams.map((team, candidate) => candidate === index ? updated : team),
        result: updated,
      }
    })
  }

  /**
   * Delete one saved Agent Team while preserving every existing Team Session log.
   * @param request - Team identity and observed revision.
   */
  @Remote('agentTeamDelete')
  async agentTeamDelete(request: QuantSkillsAgentTeamDeleteRequest): Promise<void> {
    await this.teamStore.mutate((teams) => {
      const current = teams.find(team => team.teamId === request.teamId)
      if (current === undefined) throw new Error(`QuantSkills Agent Team "${request.teamId}" was not found.`)
      if (current.revision !== request.expectedRevision) {
        throw new Error(`QuantSkills Agent Team "${request.teamId}" changed; refresh before deleting.`)
      }
      return { teams: teams.filter(team => team.teamId !== request.teamId), result: undefined }
    })
  }

  /**
   * Atomically create or adopt one Team Lead Session under an exact Team revision.
   * @param request - Session identity, exact Team revision, and optional Workspace selection.
   * @param signal - optional caller cancellation.
   * @returns the published Lead Session and its immutable Team binding.
   */
  @Remote('agentTeamSessionCreate')
  async agentTeamSessionCreate(
    request: QuantSkillsAgentTeamSessionCreateRequest,
    signal?: AbortSignal,
  ): Promise<QuantSkillsAgentTeamSessionCreateResult> {
    if (request.workspaceId !== undefined && request.cwd !== undefined) {
      throw new TypeError('QuantSkills Agent Team Session create accepts workspaceId or cwd, not both')
    }
    const active = this.operationSignal(signal)
    const prior = this.teamReservations.get(request.sessionId)
    if (prior !== undefined && !matchesTeamRequest(prior.binding, request)) {
      throw new QuantSkillsSessionConflictError(
        `session "${request.sessionId}" is reserved for another QuantSkills Agent Team composition`,
      )
    }
    if (this.plainReservations.has(request.sessionId)
      || this.reservations.has(request.sessionId) || this.agentReservations.has(request.sessionId)
      || this.teamMemberReservations.has(request.sessionId)) {
      throw new QuantSkillsSessionConflictError(`session "${request.sessionId}" is reserved for another composition`)
    }
    const existing = await this.inspectExisting(request.sessionId, active)
    let reservation: TeamReservation
    if (existing !== undefined) {
      const logged = foldQuantSkillsAgentTeamSession(existing.events)
      if (logged === null || !matchesTeamRequest(logged, request)) {
        throw new QuantSkillsSessionConflictError(
          `session "${request.sessionId}" already exists under another composition`,
        )
      }
      if (prior !== undefined && !sameTeamSession(prior.binding, logged)) {
        throw new QuantSkillsSessionConflictError(
          `session "${request.sessionId}" has another reserved Agent Team composition`,
        )
      }
      reservation = prior ?? await this.resolveTeamRuntime(logged, active)
    } else if (prior !== undefined) {
      reservation = prior
    } else {
      const definition = (await this.teamStore.list()).find(team => team.teamId === request.teamId)
      if (definition === undefined) throw new Error(`QuantSkills Agent Team "${request.teamId}" was not found.`)
      if (definition.revision !== request.expectedRevision) {
        throw new Error(`QuantSkills Agent Team "${request.teamId}" changed; refresh before running.`)
      }
      reservation = await this.resolveTeamRuntime(definition, active)
    }
    if (prior === undefined) this.teamReservations.set(request.sessionId, reservation)
    try {
      const response = await this.ctx.sessionController.create({
        sessionId: request.sessionId,
        ...request.workspaceId === undefined ? {} : { workspaceId: request.workspaceId },
        ...request.cwd === undefined ? {} : { cwd: request.cwd },
        ...request.agentPreset === undefined ? {} : { agentPreset: request.agentPreset },
      })
      const agent = this.ctx.agents.get(request.sessionId)
      if (agent === undefined) throw new Error(`session "${request.sessionId}" did not become live`)
      await this.ensureAgentSetup(agent)
      const published = foldQuantSkillsAgentTeamSession(agent.session.events)
      if (published === null || !sameTeamSession(published, reservation.binding)
        || !(await this.agentMatchesResidentLog(agent, active))) {
        throw new Error(`session "${request.sessionId}" was published without its exact QuantSkills Agent Team setup`)
      }
      return Object.freeze({
        sessionId: request.sessionId,
        team: published,
        ...response.agentPreset === undefined
          ? {}
          : { agentPreset: response.agentPreset },
      })
    } finally {
      if (this.teamReservations.get(request.sessionId) === reservation) this.teamReservations.delete(request.sessionId)
    }
  }

  /**
   * List real Agent Team Lead conversation archives from live and persisted Session truth.
   * @param request - archive visibility filter.
   * @param signal - optional caller cancellation.
   * @returns Team Lead Sessions ordered by most recent activity.
   */
  @Remote('agentTeamSessionList')
  async agentTeamSessionList(
    request: QuantSkillsSessionListRequest,
    signal?: AbortSignal,
  ): Promise<readonly QuantSkillsAgentTeamSessionArchiveItem[]> {
    return this.listTeamArchives(request, this.operationSignal(signal))
  }

  /**
   * Attach one immutable generic file to a live QuantSkills Session.
   * Per-Session serialization makes the aggregate byte check authoritative
   * even when browser uploads overlap.
   * @param request - Session identity, canonical base64 bytes, and display metadata.
   * @param signal - optional caller cancellation.
   * @returns the durable ownership record appended to the Session log.
   */
  @Remote('fileAttach')
  async fileAttach(
    request: QuantSkillsFileAttachRequest,
    signal?: AbortSignal,
  ): Promise<QuantSkillsSessionFileAttachment> {
    const active = this.operationSignal(signal)
    return this.withSessionLock(this.attachmentTails, request.sessionId, async () => {
      active.throwIfAborted()
      const agent = this.requireLiveQuantSkillsAgent(request.sessionId)
      const input = decodeQuantSkillsFileAttachment(request, this.fileStore.limits.maxFileBytes)
      const current = foldQuantSkillsSessionFileAttachments(agent.session.events)
      const aggregateBytes = current.reduce((total, item) => total + item.file.bytes, 0)
      if (aggregateBytes + input.data.byteLength > this.fileStore.limits.maxSessionFileBytes) {
        throw new Error('QuantSkills Session attachment bytes exceed the configured aggregate limit.')
      }
      this.fileStore.validateFile(input)
      active.throwIfAborted()
      const file = await this.fileStore.saveFile(input)
      active.throwIfAborted()
      const attached = Object.freeze({
        file,
        parsing: this.classifyFile(file, input.data),
        attachedAt: Date.now(),
      }) satisfies QuantSkillsSessionFileAttachment
      return agent.session.append(FILE_ATTACHED_EVENT, attached).data
    })
  }

  /**
   * List immutable generic files already owned by one QuantSkills Session.
   * @param request - Session identity.
   * @param signal - optional caller cancellation.
   * @returns durable file records plus Host-enforced limits.
   */
  @Remote('fileList')
  async fileList(
    request: QuantSkillsFileListRequest,
    signal?: AbortSignal,
  ): Promise<QuantSkillsFileListResult> {
    const existing = await this.requireQuantSkillsSession(request.sessionId, this.operationSignal(signal))
    return Object.freeze({
      files: foldQuantSkillsSessionFileAttachments(existing.events),
      limits: this.fileStore.limits,
    })
  }

  /**
   * Read bounded text extracted from a supported attachment owned by a QuantSkills Session.
   * @param request - Session identity and opaque attachment id.
   * @param signal - optional caller cancellation.
   * @returns verified metadata and decoded text.
   */
  @Remote('fileRead')
  async fileRead(
    request: QuantSkillsFileReadRequest,
    signal?: AbortSignal,
  ): Promise<QuantSkillsFileReadResult> {
    const active = this.operationSignal(signal)
    const existing = await this.requireQuantSkillsSession(request.sessionId, active)
    return this.readTextAttachment(existing.events, request.attachmentId, active)
  }

  /**
   * Normalize discovered result paths to one Session workspace. Authorized legacy Skill output
   * and successful external mutation results are copied into the Session workspace first.
   * @param request - Session identity and bounded candidate path list.
   * @param signal - optional caller cancellation.
   * @returns one ordered readiness or diagnostic result per candidate.
   */
  @Remote('resultPrepare')
  resultPrepare(
    request: QuantSkillsResultPrepareRequest,
    signal?: AbortSignal,
  ): Promise<QuantSkillsResultPrepareResult> {
    if (request.paths.length > MAX_RESULT_PREPARE_PATHS) {
      throw new TypeError(`QuantSkills result preparation accepts at most ${String(MAX_RESULT_PREPARE_PATHS)} paths.`)
    }
    const active = this.operationSignal(signal)
    return this.withSessionLock(this.resultPrepareTails, request.sessionId, async () => {
      active.throwIfAborted()
      const existing = await this.requireQuantSkillsSession(request.sessionId, active)
      const cwd = existing.header.cwd
      if (cwd === undefined) throw new Error('QuantSkills Session has no workspace path.')
      const workspaceRoot = await this.ctx.fs.resolve('.', { cwd, signal: active })
      const sources = await this.resolveResultSources(existing.events, active)
      const mutationPaths = new Set(
        this.resultCandidates(request.sessionId, existing.events)
          .filter(candidate => candidate.source === 'mutation')
          .map(candidate => candidate.path),
      )
      const results: QuantSkillsPreparedResult[] = []
      for (const inputPath of request.paths) {
        active.throwIfAborted()
        results.push(await this.prepareResultPath(
          inputPath,
          cwd,
          workspaceRoot,
          sources,
          mutationPaths.has(inputPath),
          active,
        ))
      }
      return Object.freeze({ results: Object.freeze(results) })
    })
  }

  /**
   * Restore every previewable result referenced by the complete durable Session log.
   * The returned paths pass through the same workspace and installed-version checks as
   * candidates discovered in the currently loaded browser window.
   * @param request - QuantSkills Session identity.
   * @param signal - optional caller cancellation.
   * @returns newest-reference-first verified results from the full Session history.
   */
  @Remote('resultList')
  async resultList(
    request: { readonly sessionId: SessionId },
    signal?: AbortSignal,
  ): Promise<QuantSkillsResultPrepareResult> {
    const active = this.operationSignal(signal)
    const existing = await this.requireQuantSkillsSession(request.sessionId, active)
    const paths = this.resultCandidates(request.sessionId, existing.events).map(candidate => candidate.path)
    return this.resultPrepare({ sessionId: request.sessionId, paths }, active)
  }

  /**
   * Read a bounded preview from a path contained by the addressed QuantSkills Session workspace.
   * Supported text is returned as UTF-8, Office documents as bounded extracted text,
   * and verified image/PDF bytes as canonical base64.
   * @param request - Session identity and workspace-relative produced path.
   * @param signal - optional caller cancellation.
   * @returns evidence-backed preview or an explicit unsupported result.
   */
  @Remote('resultPreview')
  async resultPreview(
    request: QuantSkillsResultPreviewRequest,
    signal?: AbortSignal,
  ): Promise<QuantSkillsResultPreview> {
    if (request.path.trim() === '') throw new TypeError('QuantSkills result preview path must be non-empty.')
    const active = this.operationSignal(signal)
    const { root, target, info } = await this.resolveResultPreviewTarget(request, active)
    if (info?.type === 'directory') {
      const entries = (await this.ctx.fs.listDir(target, active)).filter(entry => this.ctx.fs.contains(root, entry.target))
        .filter((entry): entry is typeof entry & { readonly type: 'file' | 'directory' } => entry.type !== 'other')
        .map(entry => Object.freeze({
          name: entry.name,
          path: workspaceRelativePath(this.ctx.fs, root, entry.target),
          type: entry.type,
          ...(entry.size === undefined ? {} : { bytes: entry.size }),
        }))
      return Object.freeze({ kind: 'directory', path: request.path, bytes: 0, entries })
    }
    if (info?.type !== 'file') throw new Error('QuantSkills result preview path is not a regular file.')
    const knownBytes = info.size
    const mediaType = resultPreviewMediaType(request.path)
    if (mediaType?.mediaType === 'application/pdf') {
      const signature = await readBinarySignature(this.ctx.fs, target, active)
      if (!matchesPreviewSignature('application/pdf', signature)) {
        return Object.freeze({
          kind: 'unsupported',
          path: request.path,
          bytes: knownBytes ?? signature.byteLength,
          reason: 'File bytes do not match the preview extension.',
        })
      }
      return Object.freeze({
        kind: 'resource',
        path: request.path,
        mediaType: 'application/pdf',
        bytes: knownBytes ?? 0,
        url: resultFileUrl(request),
        presentation: 'pdf',
      })
    }
    if (knownBytes !== undefined && knownBytes > this.maxResultPreviewBytes) {
      const resolved = resultResourceDescription(request.path, mediaType)
      return Object.freeze({
        kind: 'resource',
        path: request.path,
        mediaType: resolved.mediaType,
        bytes: knownBytes,
        url: resultFileUrl(request),
        presentation: resolved.presentation,
      })
    }
    if (mediaType === undefined) {
      const resolved = resultResourceDescription(request.path, mediaType)
      return Object.freeze({
        kind: 'resource',
        path: request.path,
        mediaType: resolved.mediaType,
        bytes: knownBytes ?? 0,
        url: resultFileUrl(request),
        presentation: resolved.presentation,
      })
    }
    const data = await this.ctx.fs.readBytes(target, active, this.maxResultPreviewBytes)
    const bytes = data.byteLength
    if (mediaType.kind === 'document') {
      let text: string
      try {
        const ast = await parseOffice(Buffer.from(data), {
          abortSignal: active,
          extractAttachments: false,
          includeRawContent: false,
          ocr: false,
          outputErrorToConsole: false,
        })
        text = (await ast.to('text')).value
      } catch (error) {
        active.throwIfAborted()
        return Object.freeze({
          kind: 'unsupported',
          path: request.path,
          bytes,
          reason: `Document preview parsing failed: ${error instanceof Error ? error.message : String(error)}`,
        })
      }
      return Object.freeze({
        kind: 'document',
        path: request.path,
        mediaType: mediaType.mediaType,
        bytes,
        ...boundUtf8Text(text, this.maxResultPreviewBytes),
      })
    }
    if (mediaType.kind === 'binary') {
      if (!matchesPreviewSignature(mediaType.mediaType, data)) {
        return Object.freeze({
          kind: 'unsupported',
          path: request.path,
          bytes,
          reason: 'File bytes do not match the preview extension.',
        })
      }
      return Object.freeze({
        kind: 'resource',
        path: request.path,
        mediaType: mediaType.mediaType,
        bytes,
        url: resultFileUrl(request),
        presentation: 'image',
      })
    }
    try {
      return Object.freeze({
        kind: 'text',
        path: request.path,
        mediaType: mediaType.mediaType,
        bytes,
        text: new TextDecoder('utf-8', { fatal: true }).decode(data),
      })
    } catch (_invalidUtf8) {
      return Object.freeze({
        kind: 'unsupported',
        path: request.path,
        bytes,
        reason: 'File is not valid UTF-8.',
      })
    }
  }

  private async resolveResultPreviewTarget(
    request: QuantSkillsResultPreviewRequest,
    signal: AbortSignal,
  ): Promise<{
    readonly root: FsTarget
    readonly target: FsTarget
    readonly info: Awaited<ReturnType<FileSystem['stat']>>
  }> {
    const existing = await this.requireQuantSkillsSession(request.sessionId, signal)
    const cwd = existing.header.cwd
    if (cwd === undefined) throw new Error('QuantSkills Session has no workspace path.')
    const root = await this.ctx.fs.resolve('.', { cwd, signal })
    const target = await this.ctx.fs.resolve(request.path, { cwd, signal })
    if (!this.ctx.fs.contains(root, target)) {
      throw new Error('QuantSkills result preview path escapes the Session workspace.')
    }
    return { root, target, info: await this.ctx.fs.stat(target, signal) }
  }

  private async resultFileResponse(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const sessionId = url.searchParams.get('sessionId')
    const path = url.searchParams.get('path')
    if (sessionId === null || sessionId === '' || path === null || path.trim() === '') {
      return new Response('missing or invalid result file query', { status: 400 })
    }
    try {
      const active = request.signal
      const previewRequest = { sessionId: SessionId(sessionId), path }
      const { target, info } = await this.resolveResultPreviewTarget(previewRequest, active)
      if (info?.type !== 'file') return new Response('result file not found', { status: 404 })
      const size = info.size
      if (size === undefined) return new Response('result file size unavailable', { status: 409 })
      const range = parseHttpByteRange(request.headers.get('range'), size)
      if (range === 'invalid') {
        return new Response(null, { status: 416, headers: { 'content-range': `bytes */${String(size)}` } })
      }
      const description = resultResourceDescription(path, resultPreviewMediaType(path))
      // Verify the file before handing bytes to the PDF renderer.
      if (description.presentation === 'pdf'
        && !matchesPreviewSignature('application/pdf', await readBinarySignature(this.ctx.fs, target, active))) {
        return new Response('invalid PDF file', { status: 415 })
      }
      const mediaType = description.presentation === 'text' ? 'text/plain; charset=utf-8' : description.mediaType
      const headers = new Headers({
        'accept-ranges': 'bytes',
        'cache-control': 'private, no-store',
        'content-type': mediaType,
        'x-content-type-options': 'nosniff',
        'content-security-policy': "sandbox; default-src 'none'",
        ...(url.searchParams.get('download') === '1' || description.presentation === 'external' ? { 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(basename(path).replace(/[\r\n]/g, ''))}` } : {}),
      })
      const contentLength = range === undefined ? size : range.end - range.start + 1
      headers.set('content-length', String(contentLength))
      if (range !== undefined) headers.set('content-range', `bytes ${String(range.start)}-${String(range.end)}/${String(size)}`)
      const status = range === undefined ? 200 : 206
      if (request.method === 'HEAD') return new Response(null, { status, headers })
      const bytes = await streamResultBytes(this.ctx.fs, target, active, range)
      return new Response(asyncIterableByteStream(bytes), { status, headers })
    } catch (_error: unknown) {
      request.signal.throwIfAborted()
      return new Response('result file not found', { status: 404 })
    }
  }

  private async resolveResultSources(
    events: readonly SessionEvent[],
    signal: AbortSignal,
  ): Promise<readonly ResultSource[]> {
    const bindings = resultSourceBindings(events)
    const resolved = await this.resolveBindings(bindings, signal)
    const sources: ResultSource[] = []
    const seen = new Set<QuantSkillsInstalledVersionId>()
    for (let index = 0; index < bindings.length; index += 1) {
      signal.throwIfAborted()
      const binding = bindings[index]
      const item = resolved[index]
      if (binding === undefined || item === undefined) throw new Error('QuantSkills result source resolution lost an item.')
      const resourceBase = item.definition.resourceBase
      if (resourceBase?.kind !== 'directory') {
        throw new Error(`installed QuantSkills version "${binding.versionId}" has no resource directory`)
      }
      sources.push(Object.freeze({
        binding,
        resourceBase: resourceBase.path,
        outputRoot: await this.ctx.fs.resolve('output', { cwd: resourceBase.path, signal }),
      }))
      seen.add(binding.versionId)
    }
    for (const versionId of promptFormAgentSources(events)) {
      signal.throwIfAborted()
      if (seen.has(versionId)) continue
      const installed = await this.ctx.quantSkillsHost.resolveInstalledResource(versionId, signal)
      if (installed.version.kind !== 'agent' || installed.version.exposure !== 'agent-template') {
        throw new Error(`installed QuantSkills version "${versionId}" is not an Agent template`)
      }
      const binding = bindingFrom(installed.version)
      sources.push(Object.freeze({
        binding,
        resourceBase: installed.resourceBase,
        outputRoot: await this.ctx.fs.resolve('output', { cwd: installed.resourceBase, signal }),
      }))
      seen.add(versionId)
    }
    for (const resourceBase of successfulSkillToolResourceBases(events)) {
      signal.throwIfAborted()
      const installed = await this.ctx.quantSkillsHost.matchInstalledSkillResource(resourceBase, signal)
      if (installed === undefined || seen.has(installed.version.versionId)) continue
      const binding = bindingFrom(installed.version)
      sources.push(Object.freeze({
        binding,
        resourceBase: installed.resourceBase,
        outputRoot: await this.ctx.fs.resolve('output', { cwd: installed.resourceBase, signal }),
      }))
      seen.add(installed.version.versionId)
    }
    return Object.freeze(sources)
  }

  private async prepareResultPath(
    inputPath: string,
    cwd: string,
    workspaceRoot: FsTarget,
    sources: readonly ResultSource[],
    authorizedMutation: boolean,
    signal: AbortSignal,
  ): Promise<QuantSkillsPreparedResult> {
    if (inputPath.trim() === '') return unavailableResult(inputPath, 'Result path is empty.')
    if (inputPath.length > MAX_RESULT_CANDIDATE_CHARS) {
      return unavailableResult(inputPath, `Result path exceeds ${String(MAX_RESULT_CANDIDATE_CHARS)} characters.`)
    }
    try {
      const workspaceCandidate = await this.ctx.fs.resolve(inputPath, { cwd, signal })
      if (this.ctx.fs.contains(workspaceRoot, workspaceCandidate)) {
        const info = await this.ctx.fs.stat(workspaceCandidate, signal)
        if (info?.type === 'file') {
          return readyResult(inputPath, workspaceRelativePath(this.ctx.fs, workspaceRoot, workspaceCandidate), false)
        }
        if (info !== undefined) return unavailableResult(inputPath, 'Result path is not a regular file.')
        if (isAbsolute(inputPath)) return unavailableResult(inputPath, 'Result file does not exist.')
      }

      const matches: Array<{
        readonly source: ResultSource
        readonly target: FsTarget
        readonly relativePath: string
      }> = []
      let matchedNonFile = false
      for (const source of sources) {
        signal.throwIfAborted()
        const sourceCwd = isAbsolute(inputPath)
          ? undefined
          : legacyCandidateStartsWithOutput(inputPath)
            ? source.resourceBase
            : this.ctx.fs.processPath(source.outputRoot)
        const candidate = await this.ctx.fs.resolve(inputPath, {
          ...(sourceCwd === undefined ? {} : { cwd: sourceCwd }),
          signal,
        })
        if (!this.ctx.fs.contains(source.outputRoot, candidate)) continue
        const pathInfo = await this.ctx.fs.lstat(inputPath, sourceCwd === undefined ? undefined : { cwd: sourceCwd }, signal)
        if (pathInfo?.type === 'symlink') {
          return unavailableResult(inputPath, 'Legacy result path is a symbolic link and cannot be archived.')
        }
        const info = await this.ctx.fs.stat(candidate, signal)
        if (info?.type !== 'file') {
          if (info !== undefined) matchedNonFile = true
          continue
        }
        matches.push({
          source,
          target: candidate,
          relativePath: workspaceRelativePath(this.ctx.fs, source.outputRoot, candidate),
        })
      }
      if (matches.length === 0) {
        if (authorizedMutation) {
          return this.archiveExternalMutationResult(inputPath, workspaceCandidate, cwd, workspaceRoot, signal)
        }
        return unavailableResult(inputPath, matchedNonFile
          ? 'Legacy result path is not a regular file.'
          : 'Result is outside the Session workspace and its exact installed Skill output directories.')
      }
      if (matches.length > 1) {
        return unavailableResult(inputPath, 'Relative legacy result path matches more than one installed Skill version.')
      }
      const match = matches[0]
      if (match === undefined) throw new Error('QuantSkills result match disappeared.')
      return await this.archiveLegacyResult(inputPath, match, cwd, workspaceRoot, signal)
    } catch (error) {
      signal.throwIfAborted()
      return unavailableResult(inputPath, `Result preparation failed: ${errorMessage(error)}`)
    }
  }

  private async archiveExternalMutationResult(
    inputPath: string,
    target: FsTarget,
    cwd: string,
    workspaceRoot: FsTarget,
    signal: AbortSignal,
  ): Promise<QuantSkillsPreparedResult> {
    const options = isAbsolute(inputPath) ? undefined : { cwd }
    const pathInfo = await this.ctx.fs.lstat(inputPath, options, signal)
    if (pathInfo?.type === 'symlink') {
      return unavailableResult(inputPath, 'Produced result path is a symbolic link and cannot be archived.')
    }
    const info = await this.ctx.fs.stat(target, signal)
    if (info?.type !== 'file') {
      return unavailableResult(inputPath, info === undefined
        ? 'Produced result file no longer exists.'
        : 'Produced result path is not a regular file.')
    }
    if (info.size !== undefined && info.size > this.maxResultArchiveBytes) {
      return unavailableResult(
        inputPath,
        `Produced result exceeds the ${String(this.maxResultArchiveBytes)} byte archive limit.`,
      )
    }
    const data = await this.ctx.fs.readBytes(target, signal, this.maxResultArchiveBytes)
    const targetPath = this.ctx.fs.processPath(target)
    const pathDigest = createHash('sha256').update(targetPath).digest('hex').slice(0, 16)
    const relativePath = [
      'output',
      'quantskills',
      'session-files',
      pathDigest,
      basename(targetPath),
    ].join('/')
    const destination = await this.ctx.fs.resolve(relativePath, { cwd, signal })
    if (!this.ctx.fs.contains(workspaceRoot, destination)) {
      throw new Error('QuantSkills produced result archive target escapes the Session workspace.')
    }
    const destinationPath = this.ctx.fs.processPath(destination)
    await mkdir(dirname(destinationPath), { recursive: true })
    try {
      await writeFile(destinationPath, data, { flag: 'wx' })
    } catch (error) {
      if (!isAlreadyExistsError(error)) throw error
      const existingInfo = await this.ctx.fs.stat(destination, signal)
      if (existingInfo?.type !== 'file' || existingInfo.size !== data.byteLength) {
        return unavailableResult(inputPath, 'A different file already occupies the produced result archive path.')
      }
      const existing = await this.ctx.fs.readBytes(destination, signal, this.maxResultArchiveBytes)
      if (!Buffer.from(existing).equals(Buffer.from(data))) {
        return unavailableResult(inputPath, 'A different file already occupies the produced result archive path.')
      }
    }
    return readyResult(inputPath, relativePath, true)
  }

  private async archiveLegacyResult(
    inputPath: string,
    match: { readonly source: ResultSource; readonly target: FsTarget; readonly relativePath: string },
    cwd: string,
    workspaceRoot: FsTarget,
    signal: AbortSignal,
  ): Promise<QuantSkillsPreparedResult> {
    const sourceInfo = await this.ctx.fs.stat(match.target, signal)
    if (sourceInfo?.type !== 'file') return unavailableResult(inputPath, 'Legacy result is not a regular file.')
    if (sourceInfo.size !== undefined && sourceInfo.size > this.maxResultArchiveBytes) {
      return unavailableResult(
        inputPath,
        `Legacy result exceeds the ${String(this.maxResultArchiveBytes)} byte archive limit.`,
      )
    }
    const data = await this.ctx.fs.readBytes(match.target, signal, this.maxResultArchiveBytes)
    const relativePath = [
      'output',
      'quantskills',
      String(match.source.binding.assetId),
      String(match.source.binding.commit),
      ...match.relativePath.split('/'),
    ].join('/')
    const destination = await this.ctx.fs.resolve(relativePath, { cwd, signal })
    if (!this.ctx.fs.contains(workspaceRoot, destination)) {
      throw new Error('QuantSkills legacy result archive target escapes the Session workspace.')
    }
    const destinationPath = this.ctx.fs.processPath(destination)
    await mkdir(dirname(destinationPath), { recursive: true })
    const destinationParent = await this.ctx.fs.resolve(dirname(destinationPath), { signal })
    if (!this.ctx.fs.contains(workspaceRoot, destinationParent)) {
      throw new Error('QuantSkills legacy result archive directory escapes the Session workspace.')
    }
    try {
      await writeFile(destinationPath, data, { flag: 'wx' })
    } catch (error) {
      if (!isAlreadyExistsError(error)) throw error
      const existingInfo = await this.ctx.fs.stat(destination, signal)
      if (existingInfo?.type !== 'file' || existingInfo.size !== data.byteLength) {
        return unavailableResult(inputPath, 'A different file already occupies the legacy result archive path.')
      }
      const existing = await this.ctx.fs.readBytes(destination, signal, this.maxResultArchiveBytes)
      if (!Buffer.from(existing).equals(Buffer.from(data))) {
        return unavailableResult(inputPath, 'A different file already occupies the legacy result archive path.')
      }
    }
    return readyResult(inputPath, relativePath, true)
  }

  private ensureAgentSetup(agent: Agent): Promise<void> {
    const current = this.agentSetups.get(agent)
    if (current !== undefined) return current
    const operation = this.setupAgent(agent.ctx)
    const guarded = operation.catch((error: unknown) => {
      if (this.agentSetups.get(agent) === guarded) this.agentSetups.delete(agent)
      throw error
    })
    this.agentSetups.set(agent, guarded)
    return guarded
  }

  private async setupAgent(agentCtx: Context): Promise<void> {
    const agent = agentCtx.agent
    if (agent === undefined) throw new Error('quantskills-session: setup has no scoped agent')
    const plainReservation = this.plainReservations.get(agent.session.id)
    const loggedPlain = foldQuantSkillsPlainSessionBinding(agent.session.events)
    const teamReservation = this.teamReservations.get(agent.session.id)
    const loggedTeam = foldQuantSkillsAgentTeamSession(agent.session.events)
    const agentReservation = this.agentReservations.get(agent.session.id)
    const loggedAgent = foldQuantSkillsAgentSession(agent.session.events)
    const loggedAuthoring = foldQuantSkillsAuthoringStarted(agent.session.events)
    const reservation = this.reservations.get(agent.session.id)
    const logged = foldQuantSkillsSessionBinding(agent.session.events)
    const kinds = [
      loggedPlain !== null || plainReservation !== undefined,
      loggedTeam !== null || teamReservation !== undefined,
      loggedAgent !== null || agentReservation !== undefined,
      logged !== null || reservation !== undefined,
    ].filter(Boolean).length
    if (kinds > 1) {
      throw new Error(`session "${agent.session.id}" mixes QuantSkills plain, Skill, Agent, or Agent Team bindings`)
    }
    if (loggedAuthoring !== null && loggedAgent === null && agentReservation === undefined) {
      throw new Error(`session "${agent.session.id}" has an authoring purpose without an Agent composition`)
    }
    if (loggedPlain !== null || plainReservation !== undefined) {
      if (loggedPlain !== null && plainReservation !== undefined
        && !samePlainBinding(loggedPlain, plainReservation.binding)) {
        throw new QuantSkillsSessionConflictError(
          `session "${agent.session.id}" has another logged QuantSkills purpose`,
        )
      }
      const binding = loggedPlain ?? plainReservation?.binding
      if (binding === undefined) return
      this.installResidentRuntime(agentCtx, agent, Object.freeze([]))
      this.registerAttachmentTool(agentCtx, agent)
      this.registerLiveTradingApproval(agentCtx, agent)
      if (binding.contest) {
        await this.contest.rules()
        installContestTools(agentCtx, agent, this.contest, binding.contest)
      }
      if (loggedPlain === null) agent.session.append(PLAIN_SESSION_EVENT, binding)
      return
    }
    if (loggedTeam !== null || teamReservation !== undefined) {
      if (loggedTeam !== null && teamReservation !== undefined
        && !sameTeamSession(loggedTeam, teamReservation.binding)) {
        throw new QuantSkillsSessionConflictError(
          `session "${agent.session.id}" has another logged QuantSkills Agent Team composition`,
        )
      }
      const resolved = teamReservation ?? (loggedTeam === null
        ? undefined
        : await this.resolveTeamRuntime(loggedTeam, this.lifetime.signal))
      if (resolved === undefined) return
      const residentBindings = loggedTeam === null
        ? resolved.binding.lead.skills
        : foldQuantSkillsResidentSkills(agent.session.events)
      const leadResolved = sameBindingList(residentBindings, resolved.binding.lead.skills)
        ? resolved.leadResolved
        : await this.resolveBindings(residentBindings, this.lifetime.signal)
      const systemPrompt = agentCtx.get('systemPrompt')
      if (systemPrompt === undefined) throw new Error('quantskills-session: scoped system prompt is unavailable')
      installTeamModelChoice(agentCtx, resolved.binding.leadModel)
      registerLiteralPromptSection(systemPrompt, {
        name: 'quantskills:agent-team-lead',
        order: 10,
        text: renderTeamLeadPrompt(resolved.binding),
      })
      this.installResidentRuntime(agentCtx, agent, leadResolved)
      const runtime = teamRuntime(resolved)
      if (this.teamRuntimes.has(agent.session.id)) {
        throw new Error(`QuantSkills Agent Team Session "${agent.session.id}" already has a runtime.`)
      }
      this.teamRuntimes.set(agent.session.id, runtime)
      agentCtx.effect(() => () => {
        if (this.teamRuntimes.get(agent.session.id) === runtime) this.teamRuntimes.delete(agent.session.id)
      }, 'quantskills-session.agent-team-runtime')
      this.registerTeamActivationTool(agentCtx, agent, runtime)
      this.registerAttachmentTool(agentCtx, agent)
      this.registerLiveTradingApproval(agentCtx, agent)
      if (loggedTeam === null) agent.session.append(AGENT_TEAM_SESSION_EVENT, resolved.binding)
      return
    }
    if (loggedAgent !== null || agentReservation !== undefined) {
      if (loggedAgent !== null && agentReservation !== undefined
        && !sameAgent(loggedAgent, agentReservation.agent)) {
        throw new QuantSkillsSessionConflictError(
          `session "${agent.session.id}" has another logged QuantSkills Agent composition`,
        )
      }
      const definition = loggedAgent ?? agentReservation?.agent
      if (definition === undefined) return
      const authoringKind = loggedAuthoring ?? agentReservation?.authoringKind
      if (loggedAuthoring !== null && agentReservation?.authoringKind !== undefined
        && loggedAuthoring !== agentReservation.authoringKind) {
        throw new QuantSkillsSessionConflictError(
          `session "${agent.session.id}" has another logged QuantSkills authoring purpose`,
        )
      }
      const baseResolved = agentReservation?.resolved
        ?? await this.resolveBindings(definition.skills, this.lifetime.signal)
      const residentBindings = loggedAgent === null
        ? definition.skills
        : foldQuantSkillsResidentSkills(agent.session.events)
      const resolved = sameBindingList(residentBindings, definition.skills)
        ? baseResolved
        : await this.resolveBindings(residentBindings, this.lifetime.signal)
      const skills = agentCtx.get('skills')
      const systemPrompt = agentCtx.get('systemPrompt')
      if (skills === undefined) throw new Error('quantskills-session: scoped Skill registry is unavailable')
      if (systemPrompt === undefined) throw new Error('quantskills-session: scoped system prompt is unavailable')
      registerLiteralPromptSection(systemPrompt, {
        name: 'quantskills:user-agent',
        order: 10,
        text: renderAgentPrompt(definition),
      })
      this.installResidentRuntime(agentCtx, agent, resolved)
      this.registerAttachmentTool(agentCtx, agent)
      if (authoringKind === 'agent-team') this.registerAgentTeamDraftTool(agentCtx, agent)
      else if (authoringKind === 'skill' || authoringKind === 'agent') {
        this.registerAssetDraftTool(agentCtx, agent, authoringKind)
      }
      this.registerLiveTradingApproval(agentCtx, agent)
      if (loggedAuthoring === null && authoringKind !== undefined) {
        agent.session.append(AUTHORING_STARTED_EVENT, { kind: authoringKind })
      }
      if (loggedAgent === null) agent.session.append(AGENT_SESSION_EVENT, definition)
      return
    }
    if (logged === null && reservation === undefined) return
    if (logged !== null && reservation !== undefined && !sameBinding(logged, reservation.binding)) {
      throw this.conflict(agent.session.id, logged)
    }
    const binding = logged ?? reservation?.binding
    if (binding === undefined) return
    const baseResolved = reservation?.resolved
      ?? await this.ctx.quantSkillsHost.resolveInstalledSkill(binding.versionId, this.lifetime.signal)
    const resolvedBinding = bindingFrom(baseResolved.version)
    if (!sameBinding(binding, resolvedBinding)) {
      throw new Error(`installed QuantSkills version no longer matches session "${agent.session.id}" binding`)
    }
    const residentBindings = logged === null
      ? Object.freeze([binding])
      : foldQuantSkillsResidentSkills(agent.session.events)
    const onlyResident = residentBindings[0]
    const resolved = residentBindings.length === 1 && onlyResident !== undefined && sameBinding(onlyResident, binding)
      ? Object.freeze([baseResolved])
      : await this.resolveBindings(residentBindings, this.lifetime.signal)
    this.installResidentRuntime(agentCtx, agent, resolved)
    this.registerAttachmentTool(agentCtx, agent)
    this.registerLiveTradingApproval(agentCtx, agent)
    if (logged === null) agent.session.append(BINDING_EVENT, binding)
  }

  private setupTeamMember(agentCtx: Context): () => void {
    const agent = agentCtx.agent
    if (agent === undefined) throw new Error('quantskills-session: continuable setup has no scoped agent')
    const reservation = this.teamMemberReservations.get(agent.session.id)
    const logged = foldQuantSkillsAgentTeamMemberSession(agent.session.events)
    if (logged === null && reservation === undefined) return () => {}
    const binding = logged ?? reservation?.binding
    if (binding === undefined) return () => {}
    const parentId = agent.session.header.parentSession
    if (parentId === undefined) throw new Error('QuantSkills Agent Team member has no parent Session.')
    if (reservation !== undefined && reservation.rootSessionId !== parentId) {
      throw new Error('QuantSkills Agent Team member reservation belongs to another Team Lead.')
    }
    const runtime = this.teamRuntimes.get(parentId)
    if (runtime === undefined) throw new Error('QuantSkills Agent Team Lead runtime is not live.')
    const declared = runtime.membersByName.get(binding.memberName)
    if (declared === undefined
      || binding.teamId !== runtime.binding.teamId
      || binding.teamRevision !== runtime.binding.revision
      || !sameAgent(binding.agent, declared.member.agent)
      || !sameTeamModelChoice(binding.model, declared.member.model)) {
      throw new Error(`QuantSkills Agent Team member "${binding.memberName}" does not match the frozen Team definition.`)
    }
    const systemPrompt = agentCtx.get('systemPrompt')
    if (systemPrompt === undefined) throw new Error('quantskills-session: scoped system prompt is unavailable')
    const disposeModel = installTeamModelChoice(agentCtx, binding.model)
    const disposePrompt = registerLiteralPromptSection(systemPrompt, {
      name: 'quantskills:agent-team-member',
      order: 10,
      text: renderTeamMemberPrompt(runtime.binding, declared.member),
    })
    let disposeSkills: (() => void) | undefined
    try {
      disposeSkills = this.installResidentRuntime(
        agentCtx,
        agent,
        reservation?.resolved ?? declared.resolved,
      )
      if (logged === null) agent.session.append(AGENT_TEAM_MEMBER_EVENT, binding)
    } catch (error) {
      disposeSkills?.()
      disposePrompt()
      disposeModel()
      throw error
    }
    return () => {
      disposeSkills?.()
      disposeSkills = undefined
      disposePrompt()
      disposeModel()
    }
  }

  private registerTeamActivationTool(agentCtx: Context, agent: Agent, runtime: TeamRuntime): void {
    const tools = agentCtx.get('tools')
    if (tools === undefined) throw new Error('quantskills-session: scoped Tool registry is unavailable')
    tools.register(defineTool({
      name: TEAM_ACTIVATION_TOOL,
      description: 'Start one declared Agent Team member with its frozen Agent role and exact resident Skills. Use followup_task for a member that was already started.',
      parameters: {
        member: { type: 'string', required: true, description: 'Declared lower-kebab-case Team member name.' },
        task: { type: 'string', required: true, description: 'Complete initial task for this Team member.' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            member: { type: 'string', required: true },
            sessionId: { type: 'string', required: true },
            agentId: { type: 'string', required: true },
            agentRevision: { type: 'integer', required: true },
            status: { type: 'string', required: true },
          },
        },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
      },
      execute: async (args, exec) => {
        if (exec.agent !== agent) throw new Error('Agent Team member activation requires the exact Team Lead.')
        const member = runtime.membersByName.get(args.member)
        if (member === undefined) {
          throw new Error(`Agent Team has no declared member "${args.member}".`)
        }
        if (this.ctx.agentTeams.listMembers(agent).some(candidate => candidate.name === args.member)) {
          throw new Error(`Agent Team member "${args.member}" was already started; use followup_task to continue it.`)
        }
        const childId = SessionId(randomUUID())
        const binding = freezeTeamMemberSessionBinding({
          teamId: runtime.binding.teamId,
          teamRevision: runtime.binding.revision,
          memberName: member.member.name,
          agent: member.member.agent,
          model: member.member.model,
        })
        const reservation: TeamMemberReservation = Object.freeze({
          rootSessionId: agent.id,
          binding,
          resolved: member.resolved,
        })
        this.teamMemberReservations.set(childId, reservation)
        try {
          const started = await this.ctx.agentTeams.spawnTeammate(agent, {
            childId,
            name: member.member.name,
            description: member.member.agent.name,
            prompt: [{ type: 'text', text: args.task }],
            context: member.member.context,
            provider: member.member.context === 'fork' ? this.teamForkProvider : this.teamFreshProvider,
            ...(member.member.model.kind === 'fixed'
              ? {
                agentOptions: {
                  provider: member.member.model.selection.provider,
                  model: member.member.model.selection.model,
                },
              }
              : {}),
            signal: exec.signal,
          })
          return {
            member: member.member.name,
            sessionId: started.member.id,
            agentId: member.member.agent.agentId,
            agentRevision: member.member.agent.revision,
            status: started.member.status,
          }
        } finally {
          if (this.teamMemberReservations.get(childId) === reservation) {
            this.teamMemberReservations.delete(childId)
          }
        }
      },
      presentCall: args => ({ card: 'generic', title: `Activate Team member ${args.member}`, kind: 'execute' }),
    }))
  }

  private registerAssetDraftTool(
    agentCtx: Context,
    agent: Agent,
    kind: 'skill' | 'agent',
  ): void {
    const tools = agentCtx.get('tools')
    const systemPrompt = agentCtx.get('systemPrompt')
    if (tools === undefined) throw new Error('quantskills-session: scoped Tool registry is unavailable')
    if (systemPrompt === undefined) throw new Error('quantskills-session: scoped system prompt is unavailable')
    registerLiteralPromptSection(systemPrompt, {
      name: 'quantskills:asset-authoring',
      order: 32,
      text: [
        `This Session authors exactly one local QuantSkills ${kind === 'skill' ? 'Skill' : 'Agent'}.`,
        `Write the complete draft below \`quantskills-drafts/${kind}/<asset-id>/\` in the current Workspace.`,
        `The root declaration must be ${kind === 'skill' ? 'SKILL.md' : 'AGENTS.md'}.`,
        `After writing and reviewing the files, call ${ASSET_DRAFT_TOOL} with action \`prepare\` and the draft directory.`,
        'The prepare action validates only. It cannot save or install the asset; the application automatically opens a final confirmation dialog when your response finishes. Tell the user to click 确认生成 once; do not ask them to repeat verbal confirmation, search earlier tool records, or inspect technical digests.',
      ].join('\n'),
    })
    tools.register(defineTool({
      name: ASSET_DRAFT_TOOL,
      description: 'List exact installed Skills or validate one Workspace-local Skill/Agent draft. This tool cannot publish an asset.',
      parameters: {
        action: { type: 'string', required: true, enum: ['list-skills', 'prepare'] },
        path: { type: 'string', description: 'Workspace-relative draft directory under quantskills-drafts/.' },
      },
      output: {
        schema: { type: 'object', additionalProperties: true },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
      },
      execute: async (args, exec) => {
        if (exec.agent !== agent) throw new Error('QuantSkills draft preparation requires the exact authoring Agent.')
        if (args.action === 'list-skills') {
          const installed = await this.ctx.quantSkillsHost.list(exec.signal)
          return toolJsonObject({
            kind: 'skills',
            skills: installed.versions.filter(version => version.kind === 'skill').map(version => ({
              assetId: version.assetId,
              versionId: version.versionId,
              commit: version.commit,
              treeDigest: version.treeDigest,
              origin: version.origin,
            })),
          })
        }
        if (args.path === undefined || args.path.trim() === '') {
          throw new TypeError('QuantSkills draft path is required for prepare.')
        }
        const cwd = agent.session.header.cwd
        if (cwd === undefined) throw new Error('QuantSkills authoring Session has no Workspace path.')
        const workspaceRoot = await this.ctx.fs.resolve('.', { cwd, signal: exec.signal })
        const draftsRoot = await this.ctx.fs.resolve('quantskills-drafts', { cwd, signal: exec.signal })
        const draftRoot = await this.ctx.fs.resolve(args.path, { cwd, signal: exec.signal })
        if (!this.ctx.fs.contains(workspaceRoot, draftsRoot) || !this.ctx.fs.contains(draftsRoot, draftRoot)) {
          throw new Error('QuantSkills authoring draft must stay below the Session Workspace quantskills-drafts directory.')
        }
        const info = await this.ctx.fs.stat(draftRoot, exec.signal)
        if (info?.type !== 'directory') throw new Error('QuantSkills authoring draft path is not a directory.')
        const prepared = await this.ctx.quantSkillsHost.prepareAuthoredDraft({
          draftRoot: this.ctx.fs.processPath(draftRoot),
          kind,
        }, exec.signal)
        return toolJsonObject({
          kind: 'draft',
          draft: {
            assetId: prepared.assetId,
            assetKind: prepared.kind,
            declaration: prepared.declaration,
            draftPath: workspaceRelativePath(this.ctx.fs, workspaceRoot, draftRoot),
            treeDigest: prepared.treeDigest,
            fileCount: prepared.fileCount,
            totalBytes: prepared.totalBytes,
            requires: [...prepared.requires],
          },
          diagnostics: [{
            level: 'info',
            code: 'validated-tree',
            message: '草案已通过安全树、声明和依赖校验；保存前 Host 会重新读取并比较摘要。',
          }],
        })
      },
      isConcurrencySafe: args => args.action === 'list-skills',
      presentCall: args => ({
        card: 'generic',
        title: args.action === 'list-skills' ? 'List exact QuantSkills versions' : `Prepare local ${kind} draft`,
        kind: 'read',
      }),
    }))
  }

  private registerAgentTeamDraftTool(agentCtx: Context, agent: Agent): void {
    const tools = agentCtx.get('tools')
    if (tools === undefined) throw new Error('quantskills-session: scoped Tool registry is unavailable')
    tools.register(defineTool({
      name: AGENT_TEAM_DRAFT_TOOL,
      description: 'List saved QuantSkills Agents or prepare a validated Agent Team draft. This tool never creates, updates, or starts a Team. After prepare, the application automatically opens a final confirmation dialog when your response finishes. Briefly tell the user to click 确认生成; do not ask for another verbal confirmation or tell them to find earlier tool cards.',
      parameters: {
        action: { type: 'string', required: true, enum: ['list-agents', 'create-agents', 'prepare'] },
        agents: {
          type: 'array',
          description: 'Missing Agents to create automatically. Use only with create-agents.',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              name: { type: 'string', required: true, description: 'Unique user-facing Agent name.' },
              role: { type: 'string', required: true, description: 'Complete operating instructions, responsibilities, inputs, outputs, and limits for this Agent.' },
            },
          },
        },

        draft: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', required: true, description: 'User-facing Team name.' },
            description: { type: 'string', required: true, description: 'Team goal, inputs, outputs, and operating limits.' },
            leadAgentId: { type: 'string', required: true, description: 'Agent id selected as Lead.' },
            leadModel: teamModelChoiceToolSchema('Lead model policy. Use default to follow the user default.'),
            members: {
              type: 'array',
              required: true,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  name: { type: 'string', required: true, description: 'Stable lower-kebab-case member name.' },
                  agentId: { type: 'string', required: true, description: 'Saved Agent id assigned to this member.' },
                  responsibility: { type: 'string', required: true, description: 'Concrete responsibility and expected handoff.' },
                  context: { type: 'string', enum: ['fresh', 'fork'], description: 'fresh isolates context; fork inherits completed Lead turns.' },
                  model: teamModelChoiceToolSchema('Member model policy. Use default to follow the user default.'),
                },
              },
            },
          },
        },
      },
      output: {
        schema: { type: 'object', additionalProperties: true },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
      },
      execute: async (args, exec) => {
        if (exec.agent !== agent) throw new Error('Agent Team drafting requires the exact authoring Agent.')
        const internalIds = new Set((await this.libraryStore.list()).filter(item => item.source === 'internal').map(item => item.id))
        const definitions = (await this.agentStore.list()).filter(definition => !internalIds.has(definition.agentId) && !isAuthoringAgent(definition.name))
        if (args.action === 'list-agents') {
          const models = await this.agentTeamModelCatalog()
          return toolJsonObject({
            kind: 'agents',
            agents: definitions.map(definition => ({
              agentId: definition.agentId,
              revision: definition.revision,
              name: definition.name,
              role: definition.role,
              mode: definition.mode,
              ...(definition.model === undefined ? {} : { model: { ...definition.model } }),
              permission: definition.permission,
              skills: definition.skills.map(skill => ({ ...skill })),
            })),
            models,
          })
        }
        if (args.action === 'create-agents') {
          const requested = args.agents
          if (requested === undefined || requested.length === 0 || requested.length > MAX_AGENT_TEAM_MEMBERS + 1) {
            throw new TypeError(`create-agents requires 1 through ${String(MAX_AGENT_TEAM_MEMBERS + 1)} Agent definitions.`)
          }
          const permission = this.authoringPermission(agent)
          const result = await this.agentStore.mutate(async (current) => {
            const next = [...current]
            const selected: QuantSkillsAgentDefinition[] = []
            let createdCount = 0
            const createdIds = new Set<string>()
            let reusedCount = 0
            for (const candidate of requested) {
              const name = candidate.name.trim()
              const role = candidate.role.trim()
              if (name === '' || name.length > 80) {
                throw new TypeError('Automatically created Agent names must contain 1 through 80 characters.')
              }
              if (role === '' || role.length > MAX_AGENT_ROLE_CHARS) {
                throw new TypeError(`Automatically created Agent roles must contain 1 through ${String(MAX_AGENT_ROLE_CHARS)} characters.`)
              }
              const sameName = next.find(definition => (
                !internalIds.has(definition.agentId) && definition.name.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0
              ))
              if (sameName !== undefined) {
                if (sameName.role !== role) {
                  throw new Error(`Agent“${name}”已存在但职责不同；请改用唯一名称，不要覆盖用户现有 Agent。`)
                }
                if (sameName.permission !== permission || sameName.mode !== 'dynamic'
                  || sameName.model !== undefined || sameName.skills.length !== 0) {
                  throw new Error(`Agent“${name}”的执行配置不同，不能仅按名称复用；请明确选择该 Agent 或使用新名称。`)
                }
                selected.push(sameName)
                reusedCount += 1
                continue
              }
              const time = Date.now()
              const definition = freezeDefinition({
                agentId: `agent-${randomUUID()}`,
                revision: 1,
                name,
                role,
                mode: 'dynamic',
                permission,
                skills: [],
                createdAt: time,
                updatedAt: time,
              })
              next.push(definition)
              createdIds.add(definition.agentId)
              selected.push(definition)
              createdCount += 1
            }
            // Write provenance before the primary store. A provenance failure
            // must not leave visible Agents misclassified as unknown history.
            for (const definition of selected) {
              if (createdIds.has(definition.agentId)) {
                await this.libraryStore.put({ id: definition.agentId, kind: 'agent', source: 'personal', method: 'ai' })
              }
            }
            return { agents: next, result: { selected, createdCount, reusedCount } }
          })
          return toolJsonObject({
            kind: 'created-agents',
            createdCount: result.createdCount,
            reusedCount: result.reusedCount,
            agents: result.selected.map(definition => ({
              agentId: definition.agentId,
              revision: definition.revision,
              name: definition.name,
              role: definition.role,
              mode: definition.mode,
              permission: definition.permission,
              skills: [],
            })),
          })
        }
        const input = args.draft
        if (input === undefined) throw new TypeError('Agent Team draft input is required for prepare.')
        const diagnostics: QuantSkillsAgentTeamDraftDiagnostic[] = []
        const report = (
          level: QuantSkillsAgentTeamDraftDiagnostic['level'],
          code: string,
          message: string,
        ): void => { diagnostics.push(Object.freeze({ level, code, message })) }
        const name = input.name.trim()
        const description = input.description.trim()
        if (name === '' || name.length > 80) report('error', 'invalid-name', '团队名称必须包含 1 到 80 个字符。')
        if (description === '' || description.length > 4_000) {
          report('error', 'invalid-description', '团队目标必须包含 1 到 4000 个字符。')
        }
        if (input.members.length < 1 || input.members.length > MAX_AGENT_TEAM_MEMBERS) {
          report('error', 'invalid-member-count', `团队必须包含 1 到 ${String(MAX_AGENT_TEAM_MEMBERS)} 个成员。`)
        }
        const byId = new Map<string, QuantSkillsAgentDefinition>(
          definitions.map(definition => [definition.agentId, definition]),
        )
        const lead = byId.get(input.leadAgentId)
        if (lead === undefined) report('error', 'missing-lead', '所选 Lead Agent 不存在；请重新读取 Agent 列表。')
        const leadModel = quantSkillsAgentTeamModelChoiceSchema.safeParse(input.leadModel)
        if (!leadModel.success) report('error', 'invalid-lead-model', 'Lead 必须选择跟随默认模型或一个有效的固定模型。')
        else await this.reportInvalidTeamModelChoice(leadModel.data, 'Lead', report)
        const names = new Set<string>()
        const agentIds = new Set<string>(lead === undefined ? [] : [lead.agentId])
        const members: QuantSkillsAgentTeamDraft['members'][number][] = []
        for (const candidate of input.members) {
          const memberName = candidate.name.trim()
          const responsibility = candidate.responsibility.trim()
          if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(memberName) || memberName === 'lead' || memberName.length > 64) {
            report('error', 'invalid-member-name', `成员标识“${memberName || '（空）'}”必须是 lower-kebab-case，且不能使用 lead。`)
          } else if (names.has(memberName)) {
            report('error', 'duplicate-member-name', `成员标识“${memberName}”重复。`)
          }
          if (responsibility === '') report('error', 'missing-responsibility', `成员“${memberName || '（未命名）'}”缺少职责说明。`)
          const member = byId.get(candidate.agentId)
          const memberModel = quantSkillsAgentTeamModelChoiceSchema.safeParse(candidate.model)
          if (!memberModel.success) {
            report('error', 'invalid-member-model', `成员“${memberName || '（未命名）'}”必须选择跟随默认模型或一个有效的固定模型。`)
          } else {
            await this.reportInvalidTeamModelChoice(memberModel.data, `成员“${memberName || '（未命名）'}”`, report)
          }
          if (member === undefined) {
            report('error', 'missing-member-agent', `成员“${memberName || '（未命名）'}”选择的 Agent 不存在。`)
          } else if (agentIds.has(member.agentId)) {
            report('error', 'duplicate-agent', `Agent“${member.name}”不能同时占用多个团队角色。`)
          } else if (lead !== undefined && !sameAgentExecution(lead, member)) {
            report('error', 'incompatible-runtime', `Agent“${member.name}”与 Lead 的权限预设不一致。`)
          }
          names.add(memberName)
          if (member !== undefined && memberModel.success) {
            agentIds.add(member.agentId)
            members.push({
              name: memberName,
              responsibility,
              context: candidate.context ?? 'fresh',
              agent: { agentId: member.agentId, revision: member.revision },
              model: memberModel.data,
            })
          }
        }
        if (diagnostics.some(diagnostic => diagnostic.level === 'error') || lead === undefined || !leadModel.success) {
          return toolJsonObject({ kind: 'draft', diagnostics })
        }
        report('info', 'exact-revisions', '草案已冻结当前 Agent revision；创建时会再次校验。')
        const draft: QuantSkillsAgentTeamDraft = {
          name,
          description,
          lead: { agentId: lead.agentId, revision: lead.revision },
          leadModel: leadModel.data,
          members,
          diagnostics,
        }
        const treeDigest = authoringDigest(draft)
        return toolJsonObject({
          kind: 'draft',
          treeDigest,
          draft: {
            ...draft,
            lead: { ...draft.lead },
            leadModel: cloneTeamModelChoice(draft.leadModel),
            members: draft.members.map(member => ({
              ...member,
              agent: { ...member.agent },
              model: cloneTeamModelChoice(member.model),
            })),
            diagnostics: draft.diagnostics.map(diagnostic => ({ ...diagnostic })),
          },
          diagnostics: diagnostics.map(diagnostic => ({ ...diagnostic })),
        })
      },
      isConcurrencySafe: () => true,
      presentCall: args => ({
        card: 'generic',
        title: args.action === 'list-agents' ? 'List Agent Team candidates' : 'Prepare Agent Team draft',
        kind: 'read',
      }),
    }))
  }

  private authoringPermission(agent: Agent): QuantSkillsAgentDefinition['permission'] {
    const presets = this.ctx.get('permissionPresets') as {
      current(session: Agent['session']): string
    } | undefined
    if (presets === undefined) return 'read-only'
    const current = presets.current(agent.session)
    if (current === 'read-only' || current === 'workspace-write' || current === 'danger-full-access') return current
    throw new Error('当前自定义权限无法安全继承，请先选择明确的权限预设。')
  }

  private async agentTeamModelCatalog(): Promise<readonly QuantSkillsAgentTeamDraftModelSummary[]> {
    const groups = await Promise.all(this.ctx.llm.listProviders().map(async (provider) => {
      try {
        const models = await this.ctx.llm.listModels(provider.id)
        return await Promise.all(models.map(async (model): Promise<QuantSkillsAgentTeamDraftModelSummary> => {
          const resolved = await this.ctx.llm.resolveModelInfo(provider.id, model.id)
          return Object.freeze({
            provider: provider.id,
            providerLabel: provider.name,
            model: model.id,
            modelLabel: model.name,
            reasoningEfforts: Object.freeze((resolved.reasoning?.efforts ?? []).map(effort => Object.freeze({
              id: String(effort.id),
              label: effort.name,
            }))),
          })
        }))
      } catch (error: unknown) {
        this.ctx.logger.warn(
          `QuantSkills Agent Team model catalog skipped provider "${provider.id}": ${error instanceof Error ? error.message : String(error)}`,
        )
        return []
      }
    }))
    return Object.freeze(groups.flat())
  }

  private async reportInvalidTeamModelChoice(
    choice: QuantSkillsAgentTeamModelChoice,
    role: string,
    report: (level: QuantSkillsAgentTeamDraftDiagnostic['level'], code: string, message: string) => void,
  ): Promise<void> {
    try {
      await this.validateTeamModelChoice(choice, role)
    } catch (error: unknown) {
      report(
        'error',
        'unavailable-model',
        `${role} 选择的模型当前不可用：${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  private async validateTeamModelChoice(choice: QuantSkillsAgentTeamModelChoice, role: string): Promise<void> {
    if (choice.kind === 'default') return
    try {
      await this.ctx.llm.resolveCallConfig({
        provider: choice.selection.provider,
        model: choice.selection.model,
        ...(choice.selection.reasoningEffort === undefined
          ? {}
          : { reasoningEffort: ReasoningEffortId(choice.selection.reasoningEffort) }),
      })
    } catch (error: unknown) {
      throw new TypeError(
        `${role} selected an unavailable model: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      )
    }
  }

  private installResidentRuntime(
    agentCtx: Context,
    agent: Agent,
    resolved: readonly QuantSkillsResolvedInstalledSkill[],
  ): () => void {
    const runtime: ResidentSkillRuntime = { entries: new Map() }
    for (const item of resolved) {
      const binding = bindingFrom(item.version)
      if (runtime.entries.has(binding.assetId)) {
        disposeResidentRuntime(runtime)
        throw new Error(`QuantSkills Session contains duplicate resident Skill "${binding.assetId}".`)
      }
      runtime.entries.set(binding.assetId, this.registerResidentSkill(agentCtx, item))
    }
    const previous = this.residentSkillRuntimes.get(agent.session.id)
    if (previous !== undefined) {
      disposeResidentRuntime(runtime)
      throw new Error(`QuantSkills Session "${agent.session.id}" already has a resident Skill runtime.`)
    }
    const systemPrompt = agentCtx.get('systemPrompt')
    if (systemPrompt === undefined) {
      disposeResidentRuntime(runtime)
      throw new Error('quantskills-session: scoped system prompt is unavailable')
    }
    let disposeOutputPolicy: (() => void) | undefined
    try {
      disposeOutputPolicy = registerLiteralPromptSection(systemPrompt, {
        name: 'quantskills:artifact-output',
        order: 114,
        text: () => (foldQuantSkillsPlainSessionBinding(agent.session.events) ?? this.plainReservations.get(agent.session.id)?.binding)?.purpose === 'contest'
          ? '比赛研究在本对话中交付。仅使用本会话已开放的工具和已附文件，不使用 Shell 或任意代码，不声称创建了未生成的文件。'
          : [
          'Write every generated artifact under `output/` in the current Session workspace.',
          renderArtifactTheme(this.ctx.get('settings')?.get('ui-quantskills')),
          'After creating and checking real files, add one final fenced quantskills-deliverables JSON block: {"version":1,"items":[{"path":"output/report.html","title":"报告","presentation":"interactive"}]}. Use interactive for self-contained HTML, card for other files. Never declare files that do not exist. Include images, audio, video and PDF when delivered. Self-contained HTML must inline scripts and styles; external network resources are unavailable in previews.',
          'Treat every installed QuantSkills Skill resource directory as read-only source material; never write generated files into a Skill resource directory.',
          'When a Skill instruction names a relative `output/` path, resolve it against the current Session workspace, not the installed Skill resource directory.',
          'Treat Python, PandaData, and other runtime requirements declared by an installed asset as descriptive requirements, not as proof that a plugin-managed runtime or login exists.',
          'Use the Python interpreter, virtual environment, PandaData SDK, and credentials available to the current Session workspace or user environment through the normal shell and subprocess tools.',
          'If a required interpreter, package, credential, or API is unavailable, stop only the affected task. Report the observed failure and the exact repair options; install or change the user environment only after explicit user approval. Continue unrelated QuantSkills work normally.',
        ].join('\n'),
      })
    } catch (error) {
      disposeResidentRuntime(runtime)
      throw error
    }
    this.residentSkillRuntimes.set(agent.session.id, runtime)
    let disposed = false
    const dispose = (): void => {
      if (disposed) return
      disposed = true
      if (this.residentSkillRuntimes.get(agent.session.id) !== runtime) return
      this.residentSkillRuntimes.delete(agent.session.id)
      disposeOutputPolicy?.()
      disposeOutputPolicy = undefined
      disposeResidentRuntime(runtime)
    }
    agentCtx.effect(() => dispose, 'quantskills-session.resident-skills')
    return dispose
  }

  private registerResidentSkill(
    agentCtx: Context,
    resolved: QuantSkillsResolvedInstalledSkill,
  ): ResidentSkillRuntimeEntry {
    const skills = agentCtx.get('skills')
    const systemPrompt = agentCtx.get('systemPrompt')
    if (skills === undefined) throw new Error('quantskills-session: scoped Skill registry is unavailable')
    if (systemPrompt === undefined) throw new Error('quantskills-session: scoped system prompt is unavailable')
    const disposeProvider = skills.registerProvider(() => pinnedProvider(resolved))
    let disposePrompt: (() => void) | undefined
    try {
      disposePrompt = registerLiteralPromptSection(systemPrompt, {
        name: `quantskills:resident:${resolved.version.versionId}`,
        order: 30,
        text: [
          'The following QuantSkills Skill is resident in this Session. Apply it whenever relevant without asking the user to load or restate it.',
          renderSkillContent(resolved.definition),
        ].join('\n\n'),
      })
    } catch (error) {
      disposeProvider()
      throw error
    }
    let disposed = false
    return Object.freeze({
      resolved,
      dispose: () => {
        if (disposed) return
        disposed = true
        disposePrompt?.()
        disposePrompt = undefined
        disposeProvider()
      },
    })
  }

  private requireResidentRuntime(sessionId: SessionId): ResidentSkillRuntime {
    const runtime = this.residentSkillRuntimes.get(sessionId)
    if (runtime === undefined) throw new Error(`QuantSkills Session "${sessionId}" has no live resident Skill runtime.`)
    return runtime
  }

  private registerAttachmentTool(agentCtx: Context, agent: Agent): void {
    const tools = agentCtx.get('tools')
    const systemPrompt = agentCtx.get('systemPrompt')
    if (tools === undefined) throw new Error('quantskills-session: scoped Tool registry is unavailable')
    if (systemPrompt === undefined) throw new Error('quantskills-session: scoped system prompt is unavailable')
    tools.register(defineTool({
      name: 'quantskills_read_attachment',
      description: 'Read text from one UTF-8, PDF, Office, or spreadsheet attachment owned by this QuantSkills Session using its opaque attachment id.',
      parameters: {
        attachment_id: {
          type: 'string',
          required: true,
          description: 'Opaque sha256 attachment id stated in the user message.',
        },
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      isConcurrencySafe: () => true,
      execute: async (args, exec) => {
        const result = await this.readTextAttachment(agent.session.events, args.attachment_id, exec.signal)
        return result.text
      },
      presentCall: args => ({
        card: 'generic',
        title: `Read attachment ${args.attachment_id}`,
        kind: 'read',
      }),
    }))
    systemPrompt.section({
      name: 'quantskills:attachments',
      order: 115,
      text: 'When a user message lists a QuantSkills attachment id, read supported text through `quantskills_read_attachment`. Never invent file contents for unsupported or failed parsing states.',
    })
  }

  private registerLiveTradingApproval(agentCtx: Context, agent: Agent): void {
    if (this.liveTradingToolNames.size === 0) return
    const tools = agentCtx.get('tools')
    if (tools === undefined) throw new Error('quantskills-session: scoped Tool registry is unavailable')
    for (const name of this.liveTradingToolNames) {
      if (tools.get(name, agent) === undefined) {
        throw new Error(`quantskills-session: configured live-trading tool "${name}" is unavailable`)
      }
    }
    agentCtx.on('tools/pre-execute', (execution, next) => {
      if (!this.liveTradingToolNames.has(execution.name)) return next()
      return Promise.resolve({
        kind: 'ask',
        reason: 'QuantSkills live order requires a fresh user confirmation for this exact tool call.',
      })
    }, { prepend: true })
    const systemPrompt = agentCtx.get('systemPrompt')
    if (systemPrompt === undefined) throw new Error('quantskills-session: scoped system prompt is unavailable')
    systemPrompt.section({
      name: 'quantskills:live-trading-approval',
      order: 116,
      text: `Live trading is permitted only through these approval-gated DSH tools: ${[...this.liveTradingToolNames].join(', ')}. Every order requires a fresh user confirmation; never use shell, code, or another tool to bypass that confirmation.`,
    })
  }

  private classifyFile(file: QuantSkillsFileAttachmentRef, data: Uint8Array): QuantSkillsFileParsing {
    if (isUtf8TextCandidate(file)) {
      if (data.byteLength > this.maxTextAttachmentBytes) {
        return Object.freeze({
          status: 'unsupported',
          reason: `UTF-8 reader limit is ${String(this.maxTextAttachmentBytes)} bytes.`,
        })
      }
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(data)
        return Object.freeze({ status: 'ready', kind: 'utf8-text' })
      } catch (_invalidUtf8) {
        return Object.freeze({ status: 'failed', reason: 'Bytes are not valid UTF-8.' })
      }
    }
    const kind = documentParsingKind(file.name)
    if (kind === undefined) {
      return Object.freeze({ status: 'unsupported', reason: 'No built-in parser accepts this media type.' })
    }
    if (data.byteLength > this.maxDocumentAttachmentBytes) {
      return Object.freeze({
        status: 'unsupported',
        reason: `Document parser limit is ${String(this.maxDocumentAttachmentBytes)} bytes.`,
      })
    }
    return Object.freeze({ status: 'ready', kind })
  }

  private async readTextAttachment(
    events: readonly SessionEvent[],
    attachmentId: string,
    signal: AbortSignal,
  ): Promise<QuantSkillsFileReadResult> {
    const attached = foldQuantSkillsSessionFileAttachments(events)
      .find(item => item.file.attachmentId === attachmentId)
    if (attached === undefined) throw new Error('Attachment is not owned by this QuantSkills Session.')
    if (attached.parsing.status !== 'ready') {
      throw new Error(`Attachment has no readable text: ${attached.parsing.reason}`)
    }
    const stored = await this.fileStore.readFile(attached.file, signal)
    if (attached.parsing.kind === 'utf8-text') {
      if (attached.file.bytes > this.maxTextAttachmentBytes) {
        throw new Error('Attachment exceeds the configured UTF-8 reader limit.')
      }
      const text = new TextDecoder('utf-8', { fatal: true }).decode(stored.data)
      return Object.freeze({ file: stored.ref, text, truncated: false })
    }
    if (attached.file.bytes > this.maxDocumentAttachmentBytes) {
      throw new Error('Attachment exceeds the configured document parser limit.')
    }
    let text: string
    try {
      const ast = await parseOffice(Buffer.from(stored.data), {
        abortSignal: signal,
        extractAttachments: false,
        includeRawContent: false,
        ocr: false,
        outputErrorToConsole: false,
      })
      text = (await ast.to('text')).value
    } catch (error) {
      signal.throwIfAborted()
      throw new Error(`Attachment document parsing failed: ${error instanceof Error ? error.message : String(error)}`)
    }
    const bounded = boundUtf8Text(text, this.maxTextAttachmentBytes)
    return Object.freeze({ file: stored.ref, ...bounded })
  }

  /** Complete-log result candidates, newest reference first and bounded for one prepare request. */
  private resultCandidates(
    sessionId: SessionId,
    events: readonly SessionEvent[],
  ): readonly ResultCandidate[] {
    const calls = new Map<string, Extract<SessionEvent, { type: 'tool/call' }>>()
    for (const event of events) {
      if (event.type === 'tool/call') calls.set(String(event.data.callId), event)
    }

    const candidates: ResultCandidate[] = []
    const candidateIndexes = new Map<string, number>()
    const settledCalls = new Set<string>()
    const agent = this.ctx.agents.get(sessionId)
    const add = (value: string, source: 'assistant' | 'mutation'): void => {
      const candidate = historicalResultCandidate(value, source)
      if (candidate === undefined) return
      const existingIndex = candidateIndexes.get(candidate)
      if (existingIndex !== undefined) {
        const existing = candidates[existingIndex]
        if (source === 'mutation' && existing?.source === 'assistant') {
          candidates[existingIndex] = Object.freeze({ path: candidate, source })
        }
        return
      }
      if (candidates.length >= MAX_RESULT_PREPARE_PATHS) return
      candidateIndexes.set(candidate, candidates.length)
      candidates.push(Object.freeze({ path: candidate, source }))
    }

    for (const event of [...events].reverse()) {
      if (event.type === 'assistant/message') {
        for (const block of event.data.message.content) {
          if (block.type !== 'text') continue
          for (const match of block.text.matchAll(/`([^`\r\n]+)`/g)) add(match[1] ?? '', 'assistant')
        }
        continue
      }
      if (event.type !== 'tool/result') continue
      const result = event.data.message.content[0]
      const callId = String(result.toolCallId)
      if (settledCalls.has(callId)) continue
      settledCalls.add(callId)
      if (result.isError === true) continue
      const call = calls.get(callId)
      if (call === undefined) continue
      let args: unknown
      try {
        args = JSON.parse(call.data.arguments) as unknown
      } catch (_invalidLoggedToolArguments) {
        continue
      }
      const tool = this.ctx.tools.get(call.data.name, agent) ?? this.ctx.tools.get(call.data.name)
      let view: ToolCallView | undefined
      try {
        view = tool?.presentCall?.(args)
      } catch (_invalidHistoricalPresentation) {
        continue
      }
      const locations = view?.card === 'diff'
        ? view.locations
        : view?.card === 'generic' && view.kind === 'edit'
          ? view.locations
          : undefined
      for (const location of locations ?? []) add(location.path, 'mutation')
    }
    return Object.freeze(candidates)
  }

  private requireLiveQuantSkillsAgent(sessionId: SessionId): Agent {
    const agent = this.ctx.agents.get(sessionId)
    if (agent === undefined) throw new Error(`QuantSkills Session "${sessionId}" is not live.`)
    if (!isQuantSkillsSession(agent.session.events)) {
      throw new Error(`Session "${sessionId}" is not owned by QuantSkills.`)
    }
    return agent
  }

  private async listPromptForms(
    agent: Agent,
    signal: AbortSignal,
  ): Promise<readonly QuantSkillsPromptFormCapability[]> {
    const forms: QuantSkillsPromptFormCapability[] = []
    const seen = new Set<QuantSkillsInstalledVersionId>()
    for (const binding of foldQuantSkillsResidentSkills(agent.session.events)) {
      signal.throwIfAborted()
      if (seen.has(binding.versionId)) continue
      seen.add(binding.versionId)
      const resolved = await this.ctx.quantSkillsHost.resolveInstalledSkill(binding.versionId, signal)
      if (resolved.promptForm !== undefined) {
        forms.push(Object.freeze({
          assetId: binding.assetId,
          versionId: binding.versionId,
          source: 'skill',
          promptForm: resolved.promptForm,
        }))
      }
    }
    for (const versionId of promptFormAgentSources(agent.session.events)) {
      signal.throwIfAborted()
      if (seen.has(versionId)) continue
      seen.add(versionId)
      const template = await this.ctx.quantSkillsHost.agentTemplate(versionId, signal)
      if (template.promptForm !== undefined) {
        forms.push(Object.freeze({
          assetId: template.version.assetId,
          versionId,
          source: 'agent',
          promptForm: template.promptForm,
        }))
      }
    }
    return Object.freeze(forms)
  }

  private async requireQuantSkillsSession(
    sessionId: SessionId,
    signal: AbortSignal,
  ): Promise<{ header: SessionHeader; events: readonly SessionEvent[] }> {
    const existing = await this.inspectExisting(sessionId, signal)
    if (existing === undefined) throw new Error(`Session "${sessionId}" was not found.`)
    if (!isQuantSkillsSession(existing.events)) {
      throw new Error(`Session "${sessionId}" is not owned by QuantSkills.`)
    }
    return existing
  }

  private async withSessionLock<T>(
    tails: Map<SessionId, Promise<void>>,
    sessionId: SessionId,
    operation: () => T | Promise<T>,
  ): Promise<T> {
    const prior = tails.get(sessionId) ?? Promise.resolve()
    const run = prior.then(operation, operation)
    const tail = run.then(() => {}, () => {})
    tails.set(sessionId, tail)
    try {
      return await run
    } finally {
      if (tails.get(sessionId) === tail) tails.delete(sessionId)
    }
  }

  private async agentHasResolvedSkill(
    agent: Agent,
    resolved: QuantSkillsResolvedInstalledSkill,
    signal: AbortSignal,
  ): Promise<boolean> {
    const skill = await this.ctx.skills.get(resolved.definition.name, { scope: agent, signal })
    return skill?.provider === pinnedProviderName(resolved.version.versionId)
      && skill.path === resolved.definition.path
      && skill.resourceBase?.kind === 'directory'
      && resolved.definition.resourceBase?.kind === 'directory'
      && skill.resourceBase.path === resolved.definition.resourceBase.path
  }

  private async agentMatchesResidentLog(agent: Agent, signal: AbortSignal): Promise<boolean> {
    const resolved = await this.resolveBindings(foldQuantSkillsResidentSkills(agent.session.events), signal)
    return this.agentHasResolvedSkills(agent, resolved, signal)
  }

  private async agentHasResolvedSkills(
    agent: Agent,
    resolved: readonly QuantSkillsResolvedInstalledSkill[],
    signal: AbortSignal,
  ): Promise<boolean> {
    for (const item of resolved) {
      if (!(await this.agentHasResolvedSkill(agent, item, signal))) return false
    }
    return true
  }

  private async resolveAgentSkills(
    request: Pick<QuantSkillsAgentCreateRequest, 'name' | 'role' | 'mode' | 'versionIds'>,
    signal: AbortSignal,
  ): Promise<readonly QuantSkillsResolvedInstalledSkill[]> {
    if (request.name.trim() === '' || request.name.trim().length > 80) {
      throw new TypeError('QuantSkills Agent name must contain 1 through 80 characters.')
    }
    const role = request.role.trim()
    if (role === '' || role.length > MAX_AGENT_ROLE_CHARS) {
      throw new TypeError(`QuantSkills Agent role must contain 1 through ${String(MAX_AGENT_ROLE_CHARS)} characters.`)
    }
    if (request.versionIds.length > MAX_AGENT_SKILLS) {
      throw new TypeError(`QuantSkills Agent may select at most ${String(MAX_AGENT_SKILLS)} Skills.`)
    }
    const resolved: QuantSkillsResolvedInstalledSkill[] = []
    const assets = new Set<QuantSkillsAssetId>()
    for (const versionId of request.versionIds) {
      signal.throwIfAborted()
      const item = await this.ctx.quantSkillsHost.resolveInstalledSkill(versionId, signal)
      if (assets.has(item.version.assetId)) {
        throw new TypeError(`QuantSkills Agent selected Skill "${item.version.assetId}" more than once.`)
      }
      assets.add(item.version.assetId)
      resolved.push(item)
    }
    return Object.freeze(resolved)
  }

  private async resolveTeamRequest(
    request: QuantSkillsAgentTeamCreateRequest,
  ): Promise<{
    readonly lead: QuantSkillsAgentDefinition
    readonly leadModel: QuantSkillsAgentTeamModelChoice
    readonly members: readonly QuantSkillsAgentTeamSessionMember[]
  }> {
    const name = request.name.trim()
    const description = request.description.trim()
    if (name === '' || name.length > 80) {
      throw new TypeError('QuantSkills Agent Team name must contain 1 through 80 characters.')
    }
    if (description === '' || description.length > 4_000) {
      throw new TypeError('QuantSkills Agent Team description must contain 1 through 4000 characters.')
    }
    if (request.members.length < 1 || request.members.length > MAX_AGENT_TEAM_MEMBERS) {
      throw new TypeError(`QuantSkills Agent Team must declare 1 through ${String(MAX_AGENT_TEAM_MEMBERS)} members.`)
    }
    const agents = await this.agentStore.list()
    const resolveAgent = (agentId: string, revision: number): QuantSkillsAgentDefinition => {
      const agent = agents.find(candidate => candidate.agentId === agentId)
      if (agent === undefined) throw new Error(`QuantSkills Agent "${agentId}" was not found.`)
      if (agent.revision !== revision) {
        throw new Error(`QuantSkills Agent "${agentId}" changed; refresh the Agent Team before saving.`)
      }
      return agent
    }
    const lead = resolveAgent(request.leadAgentId, request.leadAgentRevision)
    await this.validateTeamModelChoice(request.leadModel, 'Agent Team Lead')
    await Promise.all(request.members.map(reference => this.validateTeamModelChoice(
      reference.model,
      `Agent Team member "${reference.name}"`,
    )))
    const names = new Set<string>()
    const agentIds = new Set<string>([lead.agentId])
    const members = request.members.map((reference): QuantSkillsAgentTeamSessionMember => {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(reference.name)
        || reference.name.length > 64 || reference.name === 'lead') {
        throw new TypeError('Agent Team member names must be unique lower-kebab-case values other than "lead".')
      }
      if (names.has(reference.name)) throw new TypeError(`Agent Team member name "${reference.name}" is duplicated.`)
      if (agentIds.has(reference.agentId)) {
        throw new TypeError(`Agent "${reference.agentId}" occupies more than one Agent Team role.`)
      }
      const member = resolveAgent(reference.agentId, reference.agentRevision)
      if (!sameAgentExecution(lead, member)) {
        throw new TypeError(
          `Agent Team member "${reference.name}" must use the same permission preset as the Lead because DSH continuable teammates inherit that runtime setting.`,
        )
      }
      names.add(reference.name)
      agentIds.add(reference.agentId)
      return Object.freeze({
        name: reference.name,
        context: reference.context,
        agent: member,
        model: freezeTeamModelChoice(reference.model),
      })
    })
    return Object.freeze({
      lead,
      leadModel: freezeTeamModelChoice(request.leadModel),
      members: Object.freeze(members),
    })
  }

  private async resolveTeamRuntime(
    binding: QuantSkillsAgentTeamSessionBinding,
    signal: AbortSignal,
  ): Promise<TeamReservation> {
    const leadResolved = await this.resolveBindings(binding.lead.skills, signal)
    const members: ResolvedTeamMember[] = []
    for (const member of binding.members) {
      signal.throwIfAborted()
      members.push(Object.freeze({ member, resolved: await this.resolveBindings(member.agent.skills, signal) }))
    }
    return Object.freeze({ binding, leadResolved, members: Object.freeze(members) })
  }

  private async resolveBindings(
    bindings: readonly QuantSkillsSessionBinding[],
    signal: AbortSignal,
  ): Promise<readonly QuantSkillsResolvedInstalledSkill[]> {
    const resolved: QuantSkillsResolvedInstalledSkill[] = []
    for (const binding of bindings) {
      signal.throwIfAborted()
      const item = await this.ctx.quantSkillsHost.resolveInstalledSkill(binding.versionId, signal)
      if (!sameBinding(binding, bindingFrom(item.version))) {
        throw new Error(`installed QuantSkills version no longer matches Agent binding "${binding.versionId}"`)
      }
      resolved.push(item)
    }
    return Object.freeze(resolved)
  }

  private async inspectExisting(
    sessionId: SessionId,
    signal: AbortSignal,
  ): Promise<{ header: SessionHeader; events: readonly SessionEvent[] } | undefined> {
    const live = this.ctx.sessions.get(sessionId)
    if (live !== undefined) return { header: live.header, events: live.events }
    const stored = (await this.ctx.sessionPersistence.list(signal)).find(header => header.id === sessionId)
    if (stored === undefined) return undefined
    const inspected = await this.ctx.sessionPersistence.inspect(sessionId, signal)
    return { header: inspected.meta, events: inspected.events }
  }

  private async listArchives(
    request: QuantSkillsSessionListRequest,
    signal: AbortSignal,
  ): Promise<readonly QuantSkillsSessionArchiveItem[]> {
    const headers = new Map<SessionId, SessionHeader>()
    for (const header of await this.ctx.sessionPersistence.list(signal)) headers.set(header.id, header)
    for (const session of this.ctx.sessions.list()) headers.set(session.id, session.header)
    const archived = new Set(this.ctx.workspaceRegistry.archivedSessionIds)
    const items: QuantSkillsSessionArchiveItem[] = []
    for (const header of headers.values()) {
      signal.throwIfAborted()
      if (header.origin === 'subagent' || (request.includeArchived !== true && archived.has(header.id))) continue
      const live = this.ctx.sessions.get(header.id)
      const events = live === undefined
        ? (await this.ctx.sessionPersistence.inspect(header.id, signal)).events
        : live.events
      const snapshot = live === undefined
        ? this.ctx.sessionProjectionCache.coldSnapshot(header, events)
        : this.ctx.sessionProjections.snapshot(live)
      const binding = projectionBinding(snapshot)
      if (binding === null) continue
      const title = typeof snapshot.values.title === 'string' ? snapshot.values.title : undefined
      const metadata = snapshot.values.sessionListMetadata
      items.push(Object.freeze({
        sessionId: header.id,
        binding,
        createdAt: header.createdAt,
        updatedAt: Math.max(header.createdAt, metadata?.lastPromptAt ?? 0),
        ...(title === undefined ? {} : { title }),
        ...header.cwd === undefined ? {} : { cwd: header.cwd },
        ...header.parentSession === undefined ? {} : { parentSessionId: header.parentSession },
        archived: archived.has(header.id),
        running: this.ctx.agents.get(header.id)?.status === 'running',
        runState: sessionRunState(this.ctx.agents.get(header.id), events),
      }))
    }
    items.sort((left, right) => right.updatedAt - left.updatedAt || left.sessionId.localeCompare(right.sessionId))
    return Object.freeze(items)
  }

  private async listPlainArchives(
    request: QuantSkillsSessionListRequest,
    signal: AbortSignal,
  ): Promise<readonly QuantSkillsPlainSessionArchiveItem[]> {
    const headers = new Map<SessionId, SessionHeader>()
    for (const header of await this.ctx.sessionPersistence.list(signal)) headers.set(header.id, header)
    for (const session of this.ctx.sessions.list()) headers.set(session.id, session.header)
    const archived = new Set(this.ctx.workspaceRegistry.archivedSessionIds)
    const items: QuantSkillsPlainSessionArchiveItem[] = []
    for (const header of headers.values()) {
      signal.throwIfAborted()
      if (header.origin === 'subagent' || (request.includeArchived !== true && archived.has(header.id))) continue
      const live = this.ctx.sessions.get(header.id)
      const events = live === undefined
        ? (await this.ctx.sessionPersistence.inspect(header.id, signal)).events
        : live.events
      const snapshot = live === undefined
        ? this.ctx.sessionProjectionCache.coldSnapshot(header, events)
        : this.ctx.sessionProjections.snapshot(live)
      const binding = projectionPlainBinding(snapshot)
      if (binding?.purpose !== 'ordinary' && binding?.purpose !== 'contest') continue
      const title = typeof snapshot.values.title === 'string' ? snapshot.values.title : undefined
      const metadata = snapshot.values.sessionListMetadata
      items.push(Object.freeze({
        sessionId: header.id,
        binding,
        createdAt: header.createdAt,
        updatedAt: Math.max(header.createdAt, metadata?.lastPromptAt ?? 0),
        ...(title === undefined ? {} : { title }),
        ...header.cwd === undefined ? {} : { cwd: header.cwd },
        ...header.parentSession === undefined ? {} : { parentSessionId: header.parentSession },
        archived: archived.has(header.id),
        running: this.ctx.agents.get(header.id)?.status === 'running',
        runState: sessionRunState(this.ctx.agents.get(header.id), events),
      }))
    }
    items.sort((left, right) => right.updatedAt - left.updatedAt || left.sessionId.localeCompare(right.sessionId))
    return Object.freeze(items)
  }

  private async listAgentArchives(
    request: QuantSkillsSessionListRequest,
    signal: AbortSignal,
  ): Promise<readonly QuantSkillsAgentSessionArchiveItem[]> {
    const headers = new Map<SessionId, SessionHeader>()
    for (const header of await this.ctx.sessionPersistence.list(signal)) headers.set(header.id, header)
    for (const session of this.ctx.sessions.list()) headers.set(session.id, session.header)
    const archived = new Set(this.ctx.workspaceRegistry.archivedSessionIds)
    const items: QuantSkillsAgentSessionArchiveItem[] = []
    for (const header of headers.values()) {
      signal.throwIfAborted()
      if (header.origin === 'subagent' || (request.includeArchived !== true && archived.has(header.id))) continue
      const live = this.ctx.sessions.get(header.id)
      const events = live === undefined
        ? (await this.ctx.sessionPersistence.inspect(header.id, signal)).events
        : live.events
      const snapshot = live === undefined
        ? this.ctx.sessionProjectionCache.coldSnapshot(header, events)
        : this.ctx.sessionProjections.snapshot(live)
      const agent = projectionAgent(snapshot)
      if (agent === null) continue
      const title = typeof snapshot.values.title === 'string' ? snapshot.values.title : undefined
      const metadata = snapshot.values.sessionListMetadata
      items.push(Object.freeze({
        sessionId: header.id,
        agent,
        createdAt: header.createdAt,
        updatedAt: Math.max(header.createdAt, metadata?.lastPromptAt ?? 0),
        ...(title === undefined ? {} : { title }),
        ...header.cwd === undefined ? {} : { cwd: header.cwd },
        ...header.parentSession === undefined ? {} : { parentSessionId: header.parentSession },
        archived: archived.has(header.id),
        running: this.ctx.agents.get(header.id)?.status === 'running',
        runState: sessionRunState(this.ctx.agents.get(header.id), events),
      }))
    }
    items.sort((left, right) => right.updatedAt - left.updatedAt || left.sessionId.localeCompare(right.sessionId))
    return Object.freeze(items)
  }

  private async listTeamArchives(
    request: QuantSkillsSessionListRequest,
    signal: AbortSignal,
  ): Promise<readonly QuantSkillsAgentTeamSessionArchiveItem[]> {
    const headers = new Map<SessionId, SessionHeader>()
    for (const header of await this.ctx.sessionPersistence.list(signal)) headers.set(header.id, header)
    for (const session of this.ctx.sessions.list()) headers.set(session.id, session.header)
    const archived = new Set(this.ctx.workspaceRegistry.archivedSessionIds)
    const items: QuantSkillsAgentTeamSessionArchiveItem[] = []
    for (const header of headers.values()) {
      signal.throwIfAborted()
      if (header.origin === 'subagent' || (request.includeArchived !== true && archived.has(header.id))) continue
      const live = this.ctx.sessions.get(header.id)
      const events = live === undefined
        ? (await this.ctx.sessionPersistence.inspect(header.id, signal)).events
        : live.events
      const snapshot = live === undefined
        ? this.ctx.sessionProjectionCache.coldSnapshot(header, events)
        : this.ctx.sessionProjections.snapshot(live)
      const team = projectionTeam(snapshot)
      if (team === null) continue
      const title = typeof snapshot.values.title === 'string' ? snapshot.values.title : undefined
      const metadata = snapshot.values.sessionListMetadata
      items.push(Object.freeze({
        sessionId: header.id,
        team,
        createdAt: header.createdAt,
        updatedAt: Math.max(header.createdAt, metadata?.lastPromptAt ?? 0),
        ...(title === undefined ? {} : { title }),
        ...header.cwd === undefined ? {} : { cwd: header.cwd },
        ...header.parentSession === undefined ? {} : { parentSessionId: header.parentSession },
        archived: archived.has(header.id),
        running: this.ctx.agents.get(header.id)?.status === 'running',
        runState: sessionRunState(this.ctx.agents.get(header.id), events),
      }))
    }
    items.sort((left, right) => right.updatedAt - left.updatedAt || left.sessionId.localeCompare(right.sessionId))
    return Object.freeze(items)
  }

  private operationSignal(caller?: AbortSignal): AbortSignal {
    return caller === undefined
      ? this.lifetime.signal
      : AbortSignal.any([this.lifetime.signal, caller])
  }

  private conflict(
    sessionId: SessionId,
    existing: QuantSkillsSessionBinding | null,
  ): QuantSkillsSessionConflictError {
    return new QuantSkillsSessionConflictError(existing === null
      ? `session "${sessionId}" already exists as an ordinary session`
      : `session "${sessionId}" is already bound to "${existing.versionId}"`)
  }
}

function bindingFrom(version: QuantSkillsInstalledVersion): QuantSkillsSessionBinding {
  return Object.freeze({
    assetId: version.assetId,
    versionId: version.versionId,
    commit: version.commit,
    treeDigest: version.treeDigest,
  })
}

function samePlainBinding(left: QuantSkillsPlainSessionBinding, right: QuantSkillsPlainSessionBinding): boolean {
  return left.purpose === right.purpose && left.contest?.accountId === right.contest?.accountId && left.contest?.contestId === right.contest?.contestId
    && left.contestConversation === right.contestConversation
}

function sameBinding(left: QuantSkillsSessionBinding, right: QuantSkillsSessionBinding): boolean {
  return left.assetId === right.assetId
    && left.versionId === right.versionId
    && left.commit === right.commit
    && left.treeDigest === right.treeDigest
}

function sameBindingList(
  left: readonly QuantSkillsSessionBinding[],
  right: readonly QuantSkillsSessionBinding[],
): boolean {
  return left.length === right.length && left.every((binding, index) => {
    const candidate = right[index]
    return candidate !== undefined && sameBinding(binding, candidate)
  })
}

function disposeResidentRuntime(runtime: ResidentSkillRuntime): void {
  for (const entry of runtime.entries.values()) entry.dispose()
  runtime.entries.clear()
}

function sameAgent(left: QuantSkillsAgentSessionBinding, right: QuantSkillsAgentSessionBinding): boolean {
  return left.agentId === right.agentId
    && left.revision === right.revision
    && left.name === right.name
    && left.role === right.role
    && left.mode === right.mode
    && left.permission === right.permission
    && left.sourceVersionId === right.sourceVersionId
    && left.model?.provider === right.model?.provider
    && left.model?.model === right.model?.model
    && left.model?.reasoningEffort === right.model?.reasoningEffort
    && left.createdAt === right.createdAt
    && left.updatedAt === right.updatedAt
    && left.skills.length === right.skills.length
    && left.skills.every((binding, index) => {
      const candidate = right.skills[index]
      return candidate !== undefined && sameBinding(binding, candidate)
    })
}

function sameAgentExecution(left: QuantSkillsAgentDefinition, right: QuantSkillsAgentDefinition): boolean {
  return left.permission === right.permission
}

function installTeamModelChoice(agentCtx: Context, choice: QuantSkillsAgentTeamModelChoice): () => void {
  if (choice.kind === 'default') return () => {}
  const selection: ModelSelection = {
    provider: choice.selection.provider,
    model: choice.selection.model,
    ...(choice.selection.reasoningEffort === undefined
      ? {}
      : { reasoningEffort: ReasoningEffortId(choice.selection.reasoningEffort) }),
  }
  return installModelSelection(agentCtx, { current: selection, assembled: undefined })
}

function cloneTeamModelChoice(choice: QuantSkillsAgentTeamModelChoice): QuantSkillsAgentTeamModelChoice {
  return choice.kind === 'default'
    ? { kind: 'default' }
    : {
      kind: 'fixed',
      selection: {
        provider: choice.selection.provider,
        model: choice.selection.model,
        ...(choice.selection.reasoningEffort === undefined
          ? {}
          : { reasoningEffort: choice.selection.reasoningEffort }),
      },
    }
}

function sameTeamModelChoice(
  left: QuantSkillsAgentTeamModelChoice,
  right: QuantSkillsAgentTeamModelChoice,
): boolean {
  return left.kind === right.kind && (left.kind === 'default' || (
    right.kind === 'fixed'
    && left.selection.provider === right.selection.provider
    && left.selection.model === right.selection.model
    && left.selection.reasoningEffort === right.selection.reasoningEffort
  ))
}

function sameTeamSession(
  left: QuantSkillsAgentTeamSessionBinding,
  right: QuantSkillsAgentTeamSessionBinding,
): boolean {
  return left.teamId === right.teamId
    && left.revision === right.revision
    && left.name === right.name
    && left.description === right.description
    && left.createdAt === right.createdAt
    && left.updatedAt === right.updatedAt
    && sameAgent(left.lead, right.lead)
    && sameTeamModelChoice(left.leadModel, right.leadModel)
    && left.members.length === right.members.length
    && left.members.every((member, index) => {
      const candidate = right.members[index]
      return candidate !== undefined
        && member.name === candidate.name
        && member.context === candidate.context
        && sameTeamModelChoice(member.model, candidate.model)
        && sameAgent(member.agent, candidate.agent)
    })
}

function matchesTeamRequest(
  team: QuantSkillsAgentTeamSessionBinding,
  request: Pick<QuantSkillsAgentTeamSessionCreateRequest, 'teamId' | 'expectedRevision'>,
): boolean {
  return team.teamId === request.teamId && team.revision === request.expectedRevision
}

function teamRuntime(reservation: TeamReservation): TeamRuntime {
  return Object.freeze({
    ...reservation,
    membersByName: new Map(reservation.members.map(member => [member.member.name, member])),
  })
}

function matchesAgentRequest(
  agent: QuantSkillsAgentSessionBinding,
  request: Pick<QuantSkillsAgentSessionCreateRequest, 'agentId' | 'expectedRevision'>,
): boolean {
  return agent.agentId === request.agentId && agent.revision === request.expectedRevision
}

function projectionBinding(snapshot: ProjectionSnapshot): QuantSkillsSessionBinding | null {
  const value = snapshot.values.quantSkillsSession
  return value === undefined || value === null ? null : parseQuantSkillsSessionBinding(value)
}

function projectionPlainBinding(snapshot: ProjectionSnapshot): QuantSkillsPlainSessionBinding | null {
  const value = snapshot.values.quantSkillsPlainSession
  return value === undefined || value === null ? null : parseQuantSkillsPlainSessionBinding(value)
}

function projectionAgent(snapshot: ProjectionSnapshot): QuantSkillsAgentSessionBinding | null {
  const value = snapshot.values.quantSkillsAgentSession
  return value === undefined || value === null ? null : parseQuantSkillsAgentSession(value)
}

function projectionTeam(snapshot: ProjectionSnapshot): QuantSkillsAgentTeamSessionBinding | null {
  const value = snapshot.values.quantSkillsAgentTeamSession
  return value === undefined || value === null ? null : parseQuantSkillsAgentTeamSession(value)
}

function isQuantSkillsSession(events: readonly SessionEvent[]): boolean {
  return foldQuantSkillsPlainSessionBinding(events) !== null
    || foldQuantSkillsSessionBinding(events) !== null
    || foldQuantSkillsAgentSession(events) !== null
    || foldQuantSkillsAgentTeamSession(events) !== null
    || foldQuantSkillsAgentTeamMemberSession(events) !== null
}

function promptFormAgentSources(events: readonly SessionEvent[]): readonly QuantSkillsInstalledVersionId[] {
  const versions: QuantSkillsInstalledVersionId[] = []
  const add = (versionId: QuantSkillsInstalledVersionId | undefined): void => {
    if (versionId !== undefined && !versions.includes(versionId)) versions.push(versionId)
  }
  add(foldQuantSkillsAgentSession(events)?.sourceVersionId)
  const team = foldQuantSkillsAgentTeamSession(events)
  if (team !== null) {
    add(team.lead.sourceVersionId)
    for (const member of team.members) add(member.agent.sourceVersionId)
  }
  add(foldQuantSkillsAgentTeamMemberSession(events)?.agent.sourceVersionId)
  return Object.freeze(versions)
}

function renderPromptForm(
  capability: QuantSkillsPromptFormCapability,
  request: QuantSkillsPromptFormRenderRequest,
  attachments: readonly QuantSkillsSessionFileAttachment[],
): string {
  if (capability.promptForm.status !== 'ready') throw new Error('QuantSkills parameter form is unavailable.')
  const form = capability.promptForm.form
  const fieldKeys = new Set(form.fields.map(field => field.key))
  const unknown = Object.keys(request.values).find(key => !fieldKeys.has(key))
  if (unknown !== undefined) throw new TypeError(`QuantSkills parameter form received unknown field "${unknown}".`)

  const view: Record<string, string | number> = Object.create(null) as Record<string, string | number>
  const task = request.task ?? ''
  if (form.task?.required === true && task.trim() === '') {
    throw new TypeError('QuantSkills parameter form task is required.')
  }
  view.task = task
  view.attachments = renderPromptFormAttachments(attachments)
  for (const field of form.fields) {
    const input = request.values[field.key]
    const value = input === undefined || input === '' ? field.default : input
    if (value === undefined) {
      if (field.required === true) throw new TypeError(`QuantSkills parameter form field "${field.label}" is required.`)
      view[field.key] = ''
      continue
    }
    if (field.type === 'number') {
      const numeric = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(numeric)) {
        throw new TypeError(`QuantSkills parameter form field "${field.label}" must be a finite number.`)
      }
      view[field.key] = numeric
      continue
    }
    if (typeof value !== 'string') {
      throw new TypeError(`QuantSkills parameter form field "${field.label}" must be text.`)
    }
    if (field.required === true && value.trim() === '') {
      throw new TypeError(`QuantSkills parameter form field "${field.label}" is required.`)
    }
    if (field.type === 'select' && !field.options?.some(option => option.value === value)) {
      throw new TypeError(`QuantSkills parameter form field "${field.label}" must use one declared option.`)
    }
    if (field.type === 'date' && value !== '' && !validIsoDate(value)) {
      throw new TypeError(`QuantSkills parameter form field "${field.label}" must use YYYY-MM-DD.`)
    }
    view[field.key] = value
  }
  return Mustache.render(form.promptTemplate, view, undefined, {
    escape: value => String(value),
  })
}

function renderPromptFormAttachments(attachments: readonly QuantSkillsSessionFileAttachment[]): string {
  return attachments.map(({ file, parsing }) => {
    const parser = parsing.status === 'ready' ? parsing.kind : parsing.status
    return `- ${file.name} (${file.mediaType}, ${String(file.bytes)} bytes, ${parser}; id ${file.attachmentId})`
  }).join('\n')
}

function validIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match === null) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

function sessionRunState(
  live: Agent | undefined,
  events: readonly SessionEvent[],
): QuantSkillsSessionArchiveItem['runState'] {
  if (live?.status === 'running') return 'running'
  const ended = events.findLast(event => event.type === 'turn/end')
  if (ended === undefined) return 'idle'
  switch (ended.data.reason.kind) {
    case 'error': return 'failed'
    case 'aborted':
    case 'interrupted': return 'cancelled'
    default: return 'completed'
  }
}

function isUtf8TextCandidate(file: QuantSkillsFileAttachmentRef): boolean {
  if (file.mediaType.startsWith('text/')) return true
  return UTF8_ATTACHMENT_MEDIA_TYPES.has(file.mediaType.toLowerCase())
}

function documentParsingKind(
  name: string,
): Extract<QuantSkillsFileParsing, { status: 'ready' }>['kind'] | undefined {
  const extension = extname(name).toLowerCase()
  if (extension === '.pdf') return 'pdf'
  if (SPREADSHEET_EXTENSIONS.has(extension)) return 'spreadsheet'
  if (OFFICE_DOCUMENT_EXTENSIONS.has(extension)) return 'office-document'
  return undefined
}

function boundUtf8Text(text: string, maxBytes: number): { readonly text: string; readonly truncated: boolean } {
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) return Object.freeze({ text, truncated: false })
  const marker = '\n\n[文档内容已达到附件文本上限，后续内容已截断。]'
  const markerBytes = Buffer.byteLength(marker, 'utf8')
  if (markerBytes >= maxBytes) {
    return Object.freeze({ text: Buffer.from(marker).subarray(0, maxBytes).toString('utf8'), truncated: true })
  }
  const budget = maxBytes - markerBytes
  let low = 0
  let high = text.length
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (Buffer.byteLength(text.slice(0, middle), 'utf8') <= budget) low = middle
    else high = middle - 1
  }
  return Object.freeze({ text: `${text.slice(0, low)}${marker}`, truncated: true })
}

function validateLiveTradingToolNames(names: readonly string[]): ReadonlySet<string> {
  const validated = new Set<string>()
  for (const name of names) {
    if (name.trim() === '' || name !== name.trim()) {
      throw new Error('quantskills-session: liveTradingToolNames entries must be non-empty and have no surrounding whitespace')
    }
    if (validated.has(name)) {
      throw new Error(`quantskills-session: duplicate live-trading tool name "${name}"`)
    }
    validated.add(name)
  }
  return validated
}

function requiredProvider(value: string, field: string): string {
  if (value.trim() === '' || value !== value.trim()) {
    throw new Error(`quantskills-session: ${field} must be non-empty and have no surrounding whitespace`)
  }
  return value
}

function resultSourceBindings(events: readonly SessionEvent[]): readonly QuantSkillsSessionBinding[] {
  const bindings: QuantSkillsSessionBinding[] = [...foldQuantSkillsResidentSkills(events)]
  const team = foldQuantSkillsAgentTeamSession(events)
  if (team !== null) {
    for (const member of team.members) bindings.push(...member.agent.skills)
  }
  const member = foldQuantSkillsAgentTeamMemberSession(events)
  if (member !== null) bindings.push(...member.agent.skills)
  const unique = new Map<QuantSkillsInstalledVersionId, QuantSkillsSessionBinding>()
  for (const binding of bindings) {
    const existing = unique.get(binding.versionId)
    if (existing !== undefined && !sameBinding(existing, binding)) {
      throw new Error(`QuantSkills result source "${binding.versionId}" has conflicting durable bindings.`)
    }
    unique.set(binding.versionId, binding)
  }
  return Object.freeze([...unique.values()])
}

function successfulSkillToolResourceBases(events: readonly SessionEvent[]): readonly string[] {
  const skillCalls = new Set<string>()
  const resourceBases = new Set<string>()
  for (const event of events) {
    if (event.type === 'tool/call' && event.data.name === 'skill') {
      skillCalls.add(event.data.callId)
      continue
    }
    if (event.type !== 'tool/result') continue
    const result = event.data.message.content[0]
    if (result.isError || !skillCalls.has(result.toolCallId)) continue
    for (const block of result.content) {
      if (block.type !== 'text') continue
      const resourceBase = renderedSkillDirectoryResourceBase(block.text)
      if (resourceBase !== undefined) resourceBases.add(resourceBase)
    }
  }
  return Object.freeze([...resourceBases])
}

const authoringReviewSchema = z.object({
  toolCallId: z.string(), treeDigest: z.string(),
  kind: z.enum(['skill', 'agent', 'agent-team']),
  name: z.string(), description: z.string(), members: z.array(z.string()),
})
const authoringReviewStateSchema = z.object({
  kind: z.enum(['skill', 'agent', 'agent-team']).nullable(),
  calls: z.array(z.string()),
  pending: authoringReviewSchema.nullable(),
})

/** Derive a review outside collapsed tool views; replay also restores unfinished drafts. */
export function applyAuthoringReview(
  state: z.infer<typeof authoringReviewStateSchema>, event: SessionEvent,
): z.infer<typeof authoringReviewStateSchema> {
  if (event.type === AUTHORING_STARTED_EVENT) {
    return { ...state, kind: authoringStartedSchema.parse(event.data).kind }
  }
  if (state.kind === null) return state
  if (event.type === AUTHORING_COMMITTED_EVENT) {
    const committed = parseQuantSkillsAuthoringCommitted(event.data)
    return committed.toolCallId === state.pending?.toolCallId ? { ...state, pending: null } : state
  }
  const tool = state.kind === 'agent-team' ? AGENT_TEAM_DRAFT_TOOL : ASSET_DRAFT_TOOL
  if (event.type === 'tool/call' && event.data.name === tool) {
    return { ...state, calls: [...state.calls, event.data.callId], pending: null }
  }
  if (event.type !== 'tool/result') return state
  const result = event.data.message.content[0]
  if (result.isError || !state.calls.includes(result.toolCallId)) return state
  try {
    const value: unknown = JSON.parse(result.content.filter(block => block.type === 'text').map(block => block.text).join(''))
    if (state.kind === 'agent-team') {
      const parsed = teamDraftCommitSchema.safeParse(value)
      if (!parsed.success) return state
      return { ...state, pending: { kind: state.kind, toolCallId: result.toolCallId,
        treeDigest: parsed.data.treeDigest, name: parsed.data.draft.name,
        description: parsed.data.draft.description,
        members: parsed.data.draft.members.map(member => member.name + ' · ' + member.responsibility) } }
    }
    const parsed = assetDraftResultSchema.safeParse(value)
    if (!parsed.success || parsed.data.draft.assetKind !== state.kind) return state
    return { ...state, pending: { kind: state.kind, toolCallId: result.toolCallId,
      treeDigest: parsed.data.draft.treeDigest, name: parsed.data.draft.assetId,
      description: '文件已准备好。确认后加入你的' + (state.kind === 'skill' ? '技能库' : '智能体库') + '。',
      members: [] } }
  } catch { return state }
}

function successfulAuthoringToolResult(
  events: readonly SessionEvent[],
  toolCallId: string,
  kind: QuantSkillsAuthoringKind,
): { readonly treeDigest: QuantSkillsTreeDigest; readonly value: unknown } {
  const expectedTool = kind === 'agent-team' ? AGENT_TEAM_DRAFT_TOOL : ASSET_DRAFT_TOOL
  const call = events.find(event => event.type === 'tool/call' && event.data.callId === toolCallId)
  if (call === undefined || call.type !== 'tool/call' || call.data.name !== expectedTool) {
    throw new Error('QuantSkills authoring commit does not reference a matching logged draft Tool call.')
  }
  const matches = events.filter((event) => {
    if (event.type !== 'tool/result') return false
    const block = event.data.message.content[0]
    return block.toolCallId === toolCallId && !block.isError
  })
  if (matches.length !== 1) {
    throw new Error('QuantSkills authoring commit requires exactly one successful logged draft Tool result.')
  }
  const event = matches[0]
  if (event === undefined || event.type !== 'tool/result') {
    throw new Error('QuantSkills authoring draft Tool result disappeared during validation.')
  }
  const result = event.data.message.content[0]
  const text = result.content.filter(block => block.type === 'text').map(block => block.text).join('')
  let value: unknown
  try {
    value = JSON.parse(text) as unknown
  } catch (error) {
    throw new Error('QuantSkills authoring draft Tool result is not valid JSON.', { cause: error })
  }
  if (kind === 'agent-team') {
    const parsed = teamDraftCommitSchema.parse(value)
    return Object.freeze({ treeDigest: parsed.treeDigest as QuantSkillsTreeDigest, value })
  }
  const parsed = assetDraftResultSchema.parse(value)
  return Object.freeze({ treeDigest: parsed.draft.treeDigest as QuantSkillsTreeDigest, value })
}

function renderedSkillDirectoryResourceBase(text: string): string | undefined {
  if (!text.startsWith('<skill_content name="')) return undefined
  const marker = '<skill_resources>\nBase directory for this skill: '
  const firstLineEnd = text.indexOf('\n')
  if (firstLineEnd < 0 || !text.startsWith(marker, firstLineEnd + 1)) return undefined
  const start = firstLineEnd + 1
  const valueStart = start + marker.length
  const valueEnd = text.indexOf('\n', valueStart)
  if (valueEnd < 0) return undefined
  const resourceFooter = 'Resolve relative paths mentioned by this skill against the base directory before using them. Load referenced resources only as needed.\n</skill_resources>'
  if (!text.startsWith(resourceFooter, valueEnd + 1)) return undefined
  const resourceBase = text.slice(valueStart, valueEnd)
    .replaceAll('&gt;', '>')
    .replaceAll('&lt;', '<')
    .replaceAll('&amp;', '&')
  return resourceBase === '' ? undefined : resourceBase
}

function workspaceRelativePath(fs: FileSystem, root: FsTarget, target: FsTarget): string {
  const path = relative(fs.processPath(root), fs.processPath(target))
  if (path === '' || isAbsolute(path) || path === '..' || path.startsWith(`..${sep}`)) {
    throw new Error('QuantSkills result path is not a file below its declared root.')
  }
  return path.split(sep).join('/')
}

function legacyCandidateStartsWithOutput(path: string): boolean {
  const normalized = path.replaceAll('\\', '/').replace(/^\.\//, '')
  return normalized === 'output' || normalized.startsWith('output/')
}

function historicalResultCandidate(
  value: string,
  source: 'assistant' | 'mutation',
): string | undefined {
  const exact = value.trim()
  if (exact === '' || exact.length > MAX_RESULT_CANDIDATE_CHARS) return undefined
  const normalized = exact.replaceAll('\\', '/')
  if (resultPreviewMediaType(normalized) === undefined) return undefined
  if (source === 'mutation') return exact
  if (value !== exact || /\s/.test(normalized)) return undefined
  if (!normalized.includes('/') || normalized.startsWith('/') || /^[a-z]:\//i.test(normalized)) return undefined
  if (normalized.includes('://') || normalized.split('/').some(part => part === '' || part === '.' || part === '..')) {
    return undefined
  }
  return normalized
}

function readyResult(inputPath: string, path: string, archived: boolean): QuantSkillsPreparedResult {
  return Object.freeze({ status: 'ready', inputPath, path, archived })
}

function unavailableResult(inputPath: string, reason: string): QuantSkillsPreparedResult {
  return Object.freeze({ status: 'unavailable', inputPath, reason })
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isAlreadyExistsError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'EEXIST'
}

type ResultPreviewMediaType =
  | { readonly kind: 'text'; readonly mediaType: string }
  | { readonly kind: 'document'; readonly mediaType: string }
  | {
    readonly kind: 'binary'
    readonly mediaType: 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'
  }

function resultPreviewMediaType(path: string): ResultPreviewMediaType | undefined {
  const extension = extname(path).toLowerCase()
  const textMediaType = RESULT_TEXT_MEDIA_TYPES.get(extension)
  if (textMediaType !== undefined) return { kind: 'text', mediaType: textMediaType }
  const documentMediaType = RESULT_DOCUMENT_MEDIA_TYPES.get(extension)
  if (documentMediaType !== undefined) return { kind: 'document', mediaType: documentMediaType }
  const binaryMediaType = RESULT_BINARY_MEDIA_TYPES.get(extension)
  return binaryMediaType === undefined ? undefined : { kind: 'binary', mediaType: binaryMediaType }
}

function matchesPreviewSignature(
  mediaType: Extract<ResultPreviewMediaType, { kind: 'binary' }>['mediaType'],
  data: Uint8Array,
): boolean {
  switch (mediaType) {
    case 'application/pdf': return startsWithBytes(data, [0x25, 0x50, 0x44, 0x46, 0x2d])
    case 'image/png': return startsWithBytes(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    case 'image/jpeg': return startsWithBytes(data, [0xff, 0xd8, 0xff])
    case 'image/gif': {
      const signature = new TextDecoder().decode(data.subarray(0, 6))
      return signature === 'GIF87a' || signature === 'GIF89a'
    }
    case 'image/webp': return startsWithBytes(data, [0x52, 0x49, 0x46, 0x46])
      && startsWithBytes(data.subarray(8), [0x57, 0x45, 0x42, 0x50])
    default: return false
  }
}

function startsWithBytes(data: Uint8Array, prefix: readonly number[]): boolean {
  return data.byteLength >= prefix.length && prefix.every((byte, index) => data[index] === byte)
}

function renderAgentPrompt(agent: QuantSkillsAgentSessionBinding): string {
  const orchestration = agent.mode === 'fixed'
    ? 'Use the currently resident QuantSkills Skill sections in their displayed order when the task requires the complete workflow.'
    : 'Choose and combine the currently resident QuantSkills Skill sections dynamically according to the user request.'
  return [
    `You are the user-defined QuantSkills Agent "${agent.name}".`,
    `Role:\n${agent.role}`,
    `Skill orchestration: ${agent.mode}. ${orchestration}`,
    'Exact resident Skill contents are supplied in separate Session system-prompt sections.',
    'If no resident Skill section is present, follow the saved role using the Session base capabilities.',
  ].join('\n\n')
}

function renderTeamLeadPrompt(team: QuantSkillsAgentTeamSessionBinding): string {
  const roster = team.members
    .map(member => `- ${member.name}: ${member.agent.name} (Agent ${member.agent.agentId} revision ${String(member.agent.revision)}, ${member.context} context)`)
    .join('\n')
  return [
    `You are the Lead Agent "${team.lead.name}" of the saved QuantSkills Agent Team "${team.name}".`,
    `Team objective:\n${team.description}`,
    `Lead role:\n${team.lead.role}`,
    `Declared members:\n${roster}`,
    `Start only declared members through ${TEAM_ACTIVATION_TOOL}. Never call an unrestricted teammate creation tool. A member name is single-use for this Team Session; continue an existing member through followup_task.`,
    'Use the shared Team task and message tools to coordinate parallel work. Wait for required members before giving the user a final answer.',
    'Exact Lead Skill contents are supplied in separate Session system-prompt sections.',
  ].join('\n\n')
}

function renderTeamMemberPrompt(
  team: QuantSkillsAgentTeamSessionBinding,
  member: QuantSkillsAgentTeamSessionMember,
): string {
  return [
    `You are Team member "${member.name}" in the saved QuantSkills Agent Team "${team.name}".`,
    `Assigned Agent: "${member.agent.name}" revision ${String(member.agent.revision)}.`,
    `Role:\n${member.agent.role}`,
    `Team objective:\n${team.description}`,
    'Work only on the task delegated by the Team Lead. Coordinate through the Team task and message tools, and report useful results to lead.',
    'Exact member Skill contents are supplied in separate Session system-prompt sections.',
  ].join('\n\n')
}

function pinnedProvider(resolved: QuantSkillsResolvedInstalledSkill): SkillProvider {
  const providerName = pinnedProviderName(resolved.version.versionId)
  const definition: SkillDefinition = Object.freeze({
    ...resolved.definition,
    provider: providerName,
  })
  const candidate: SkillCandidate = Object.freeze({
    ...definition,
    rank: PINNED_PROVIDER_RANK,
    locator: resolved.version.versionId,
  })
  return Object.freeze({
    name: providerName,
    list(options: SkillLookupOptions): Promise<readonly SkillCandidate[]> {
      options.signal?.throwIfAborted()
      return Promise.resolve(Object.freeze([candidate]))
    },
    get(selected: SkillCandidate, options: SkillLookupOptions): Promise<SkillDefinition | undefined> {
      options.signal?.throwIfAborted()
      return Promise.resolve(selected === candidate ? definition : undefined)
    },
  })
}

function pinnedProviderName(versionId: QuantSkillsInstalledVersionId): string {
  return `quantskills-session:${versionId}`
}

export default QuantSkillsSessionService

function resultResourceDescription(
  path: string,
  previewType = resultPreviewMediaType(path),
): { readonly mediaType: string; readonly presentation: 'pdf' | 'image' | 'audio' | 'video' | 'text' | 'external' } {
  if (previewType?.kind === 'text') return { mediaType: previewType.mediaType, presentation: 'text' }
  if (previewType?.kind === 'binary') {
    return previewType.mediaType === 'application/pdf'
      ? { mediaType: previewType.mediaType, presentation: 'pdf' }
      : { mediaType: previewType.mediaType, presentation: 'image' }
  }
  if (previewType?.kind === 'document') return { mediaType: previewType.mediaType, presentation: 'external' }
  const mediaType = RESULT_RESOURCE_MEDIA_TYPES.get(extname(path).toLowerCase()) ?? 'application/octet-stream'
  if (mediaType.startsWith('image/')) return { mediaType, presentation: 'image' }
  if (mediaType.startsWith('audio/')) return { mediaType, presentation: 'audio' }
  if (mediaType.startsWith('video/')) return { mediaType, presentation: 'video' }
  return { mediaType, presentation: 'external' }
}


function resultFileUrl(request: QuantSkillsResultPreviewRequest): string {
  const query = new URLSearchParams({ sessionId: request.sessionId, path: request.path })
  return `${QUANTSKILLS_RESULT_FILE_PATH}?${query.toString()}`
}

function parseHttpByteRange(
  header: string | null,
  size: number,
): { readonly start: number; readonly end: number } | 'invalid' | undefined {
  if (header === null) return undefined
  if (!Number.isSafeInteger(size) || size < 0 || !header.startsWith('bytes=') || header.includes(',')) return 'invalid'
  const match = /^bytes=(\d*)-(\d*)$/.exec(header)
  if (match === null || (match[1] === '' && match[2] === '')) return 'invalid'
  if (size === 0) return 'invalid'
  if (match[1] === '') {
    const suffix = Number(match[2])
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return 'invalid'
    return { start: Math.max(0, size - suffix), end: size - 1 }
  }
  const start = Number(match[1])
  if (!Number.isSafeInteger(start) || start < 0 || start >= size) return 'invalid'
  const requestedEnd = match[2] === '' ? size - 1 : Number(match[2])
  if (!Number.isSafeInteger(requestedEnd) || requestedEnd < start) return 'invalid'
  return { start, end: Math.min(requestedEnd, size - 1) }
}

async function* sliceAsyncIterableBytes(
  chunks: AsyncIterable<Uint8Array>,
  start: number,
  end: number,
): AsyncIterable<Uint8Array> {
  let offset = 0
  for await (const chunk of chunks) {
    const chunkStart = offset
    const chunkEnd = offset + chunk.byteLength - 1
    offset += chunk.byteLength
    if (chunkEnd < start) continue
    if (chunkStart > end) return
    const from = Math.max(0, start - chunkStart)
    const to = Math.min(chunk.byteLength, end - chunkStart + 1)
    if (to > from) yield chunk.subarray(from, to)
    if (chunkEnd >= end) return
  }
}

function asyncIterableByteStream(chunks: AsyncIterable<Uint8Array>): ReadableStream<Uint8Array> {
  const iterator = chunks[Symbol.asyncIterator]()
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await iterator.next()
        if (next.done) controller.close()
        else controller.enqueue(next.value)
      } catch (error: unknown) {
        controller.error(error)
      }
    },
    async cancel() {
      await iterator.return?.()
    },
  })
}

async function readBinarySignature(
  fs: FileSystem,
  target: FsTarget,
  signal: AbortSignal,
): Promise<Uint8Array> {
  const chunks = await streamResultBytes(fs, target, signal)
  for await (const chunk of chunks) return chunk.subarray(0, 12)
  return new Uint8Array()
}

/** Use the backend's stream where available, or a verified shared local path. */
async function streamResultBytes(fs: FileSystem, target: FsTarget, signal: AbortSignal, range?: { start: number; end: number }): Promise<AsyncIterable<Uint8Array>> {
  const streaming = fs as FileSystem & { streamBytes?: (target: FsTarget, signal: AbortSignal) => Promise<AsyncIterable<Uint8Array>> }
  if (streaming.streamBytes) {
    const chunks = await streaming.streamBytes(target, signal)
    return range ? sliceAsyncIterableBytes(chunks, range.start, range.end) : chunks
  }
  const path = fs.processPath(target)
  if (fs.processPathFromHostPath(path) === path) return createReadStream(path, { signal, highWaterMark: 64 * 1024, ...range })
  // A backend without local sharing can still serve bounded previews through its own read seam.
  const bytes = await fs.readBytes(target, signal, DEFAULT_MAX_RESULT_PREVIEW_BYTES)
  return (async function* () { yield range ? bytes.subarray(range.start, range.end + 1) : bytes })()
}
