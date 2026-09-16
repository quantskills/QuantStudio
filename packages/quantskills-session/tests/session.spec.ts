import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { strToU8, zipSync } from 'fflate'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FactorContestService } from '../src/factor-contest-service.ts'
import { Context } from '@deepseek-ai/cordis'
import { AttachmentId, type FileAttachmentRef, type SaveFileAttachment } from '@deepseek-ai/dsh-attachment'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import { agentEvents, assembleContextFor } from '@deepseek-ai/dsh-agent'
import type { Agent, AgentHandle, AgentSetup, CreateAgentOptions, ResumeAgentOptions } from '@deepseek-ai/dsh-agent'
import type { SpawnTeammateRequest, TeamMemberView } from '@deepseek-ai/dsh-agent-team'
import LocalFileSystem from '@deepseek-ai/dsh-fs-local'
import LlmRuntime, {
  createMessage, createToolResultMessage, LlmAdapter, ReasoningEffortId, ToolCallId,
} from '@deepseek-ai/dsh-llm'
import type {
  GenerateOptions, LlmModelInfo, LlmProviderInfo, LlmResolvedModelInfo, StreamChunk,
} from '@deepseek-ai/dsh-llm'
import type { QuantSkillsResolvedInstalledSkill } from '@deepseek-ai/dsh-quantskills-host'
import type {
  QuantSkillsAssetId,
  QuantSkillsCommitSha,
  QuantSkillsInstalledAgentTemplate,
  QuantSkillsInstalledVersion,
  QuantSkillsInstalledVersionId,
  QuantSkillsPromptFormResult,
  QuantSkillsTreeDigest,
} from '@deepseek-ai/dsh-quantskills-host/types'
import SessionStore, { KNOWN_SESSION_EVENT_TYPES, SessionId } from '@deepseek-ai/dsh-session'
import type { Session, SessionEvent, SessionHeader } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import { createScope } from '@deepseek-ai/dsh-scope'
import SkillRegistry, { renderSkillContent } from '@deepseek-ai/dsh-skill'
import SystemPrompt, { renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, { defineTool } from '@deepseek-ai/dsh-tools'
import ApprovalService, { type ApprovalOutcome } from '@deepseek-ai/dsh-user-approval'
import UserQuestionService from '@deepseek-ai/dsh-user-questions'
import QuantSkillsSessionService, {
  foldQuantSkillsAgentTeamMemberSession,
  foldQuantSkillsAgentTeamSession,
  foldQuantSkillsPandaRuntimeBinding,
  foldQuantSkillsPlainSessionBinding,
  foldQuantSkillsSessionBinding,
  foldQuantSkillsAgentSession,
  foldQuantSkillsAuthoringCommitted,
  foldQuantSkillsAuthoringStarted,
  foldQuantSkillsResidentSkills,
} from '../src/index.ts'
import type { ContestService } from '../src/contest-service.ts'
import {
  QUANTSKILLS_SESSION_EVENT_TYPES,
  registerQuantSkillsSessionEventTypes,
} from '../src/event-catalog.ts'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

const assetId = 'skill-alpha' as QuantSkillsAssetId
const secondAssetId = 'skill-beta' as QuantSkillsAssetId
const agentAssetId = 'agent-alpha' as QuantSkillsAssetId
const secondAgentAssetId = 'agent-beta' as QuantSkillsAssetId
const commitV1 = '1'.repeat(40) as QuantSkillsCommitSha
const commitV2 = '2'.repeat(40) as QuantSkillsCommitSha
const digestV1 = `sha256:${'a'.repeat(64)}` as QuantSkillsTreeDigest
const digestV2 = `sha256:${'b'.repeat(64)}` as QuantSkillsTreeDigest
const pandaRuntimeBinding = Object.freeze({
  environmentId: 'panda-test-environment',
  sdkVersion: '0.0.14',
  pythonVersion: '3.11.9',
  apiFingerprint: 'panda-test-fingerprint',
})

class TeamModelAdapter extends LlmAdapter {
  override providerInfo(provider: string): LlmProviderInfo {
    return { id: provider, name: 'Test models' }
  }

  override listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    return Promise.resolve(['test', 'lead-model', 'member-model'].map(id => ({ provider, id, name: id })))
  }

  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({
      provider,
      id: model,
      name: model,
      reasoning: {
        efforts: [{ id: ReasoningEffortId('high'), name: 'High' }],
      },
    })
  }

  async * stream(_options: GenerateOptions): AsyncIterable<StreamChunk> {
    throw new Error('not exercised')
  }
}

function zipXml(files: Readonly<Record<string, string>>): Buffer {
  return Buffer.from(zipSync(Object.fromEntries(
    Object.entries(files).map(([name, source]) => [name, strToU8(source)]),
  )))
}

function docxFixture(): Buffer {
  return zipXml({
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>QuantSkills Office report</w:t></w:r></w:p></w:body></w:document>',
  })
}

function xlsxFixture(): Buffer {
  return zipXml({
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Signals" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>symbol</t></is></c><c r="B1" t="inlineStr"><is><t>score</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>000001</t></is></c><c r="B2"><v>0.8</v></c></row></sheetData></worksheet>',
  })
}

function pdfFixture(): Buffer {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  const stream = 'BT /F1 12 Tf 72 720 Td (QuantSkills PDF report) Tj ET'
  objects.push(`<< /Length ${String(Buffer.byteLength(stream))} >>\nstream\n${stream}\nendstream`)
  let source = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(source))
    source += `${String(index + 1)} 0 obj\n${object}\nendobj\n`
  })
  const xref = Buffer.byteLength(source)
  source += `xref\n0 ${String(objects.length + 1)}\n0000000000 65535 f \n`
  source += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  source += `trailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R >>\nstartxref\n${String(xref)}\n%%EOF\n`
  return Buffer.from(source)
}

function resolved(
  commit: QuantSkillsCommitSha,
  treeDigest: QuantSkillsTreeDigest,
  content: string,
  selectedAssetId: QuantSkillsAssetId = assetId,
  definitionName: string = selectedAssetId,
  promptForm?: QuantSkillsPromptFormResult,
): QuantSkillsResolvedInstalledSkill {
  const versionId = `${selectedAssetId}@${commit}` as QuantSkillsInstalledVersionId
  const version: QuantSkillsInstalledVersion = {
    versionId,
    assetId: selectedAssetId,
    kind: 'skill',
    repository: `https://github.com/quantskills/${selectedAssetId}`,
    commit,
    declaration: 'SKILL.md',
    treeDigest,
    fileCount: 1,
    totalBytes: content.length,
    installedAt: 1,
    exposure: 'skill-registry',
    origin: 'catalog',
  }
  return {
    version,
    definition: {
      name: definitionName,
      description: `Alpha ${content}`,
      invocation: { modelInvocable: true, userInvocable: true },
      source: 'quantskills-host',
      provider: 'quantskills-host',
      resourceBase: { kind: 'directory', path: `/versions/${commit}` },
      path: `/versions/${commit}/SKILL.md`,
      content,
    },
    ...(promptForm === undefined ? {} : { promptForm }),
  }
}

function atResourceBase(
  item: QuantSkillsResolvedInstalledSkill,
  resourceBase: string,
): QuantSkillsResolvedInstalledSkill {
  return {
    ...item,
    definition: {
      ...item.definition,
      path: join(resourceBase, 'SKILL.md'),
      resourceBase: { kind: 'directory', path: resourceBase },
    },
  }
}

function agentTemplate(
  selectedAssetId: QuantSkillsAssetId,
  commit: QuantSkillsCommitSha,
  promptForm?: QuantSkillsPromptFormResult,
): QuantSkillsInstalledAgentTemplate {
  const versionId = `${selectedAssetId}@${commit}` as QuantSkillsInstalledVersionId
  return Object.freeze({
    version: Object.freeze({
      versionId,
      assetId: selectedAssetId,
      kind: 'agent',
      repository: `https://github.com/quantskills/${selectedAssetId}`,
      commit,
      declaration: 'AGENTS.md',
      treeDigest: digestV1,
      fileCount: 1,
      totalBytes: 1,
      installedAt: 1,
      exposure: 'agent-template',
      origin: 'catalog',
    }),
    name: selectedAssetId,
    description: 'Test Agent template.',
    instructions: 'Keep {{task}} literal.',
    requires: Object.freeze([]),
    ...(promptForm === undefined ? {} : { promptForm }),
  })
}

interface StoredSession {
  header: SessionHeader
  events: SessionEvent[]
}

interface Harness {
  root: string
  ctx: Context
  sessionController: {
    create(request: { sessionId: SessionId; cwd?: string }): Promise<{ sessionId: SessionId }>
    fork(request: { sessionId: SessionId }): Promise<{ sessionId: SessionId }>
  }
  versions: Map<QuantSkillsInstalledVersionId, QuantSkillsResolvedInstalledSkill>
  agentTemplates: Map<QuantSkillsInstalledVersionId, QuantSkillsInstalledAgentTemplate>
  agentResourceBases: Map<QuantSkillsInstalledVersionId, string>
  handles: Map<SessionId, AgentHandle>
  fileLimits: { maxFileBytes: number; maxSessionFileBytes: number }
  liveOrders: string[]
  teamSpawnRequests: SpawnTeammateRequest[]
}

async function harness(options: {
  readonly liveTrading?: boolean
  readonly maxSessionFileBytes?: number
  readonly maxResultArchiveBytes?: number
} = {}): Promise<Harness> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-quantskills-session-'))
  roots.push(root)
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(SkillRegistry)
  await ctx.plugin(SystemPrompt, {})
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(LlmRuntime)
  ctx.llm.registerAdapter(['test'], new TeamModelAdapter())
  await ctx.plugin(ApprovalService, { policy: 'ask' })
  await ctx.plugin(LocalFileSystem, { cwd: root })
  const liveOrders: string[] = []
  ctx.tools.register(defineTool({
    name: 'submit_live_order',
    description: 'Test-only live order provider.',
    parameters: {
      order_id: { type: 'string', required: true },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    execute: (args) => {
      liveOrders.push(args.order_id)
      return Promise.resolve(`submitted:${args.order_id}`)
    },
  }))
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(UserQuestionService)

  const stored = new Map<SessionId, StoredSession>()
  const snapshot = (session: Session): void => {
    stored.set(session.id, {
      header: structuredClone(session.header),
      events: structuredClone(session.events) as SessionEvent[],
    })
  }
  ctx.on('session/created', snapshot)
  ctx.on('session/event', (session) => { snapshot(session) })
  ctx.provide('sessionPersistence', {
    list: (signal?: AbortSignal) => {
      signal?.throwIfAborted()
      return Promise.resolve([...stored.values()].map(entry => entry.header))
    },
    inspect: (id: SessionId, signal?: AbortSignal) => {
      signal?.throwIfAborted()
      const entry = stored.get(id)
      if (entry === undefined) return Promise.reject(new Error(`session "${id}" not found`))
      return Promise.resolve({ meta: entry.header, events: entry.events })
    },
  } as never)
  ctx.provide('sessionProjectionCache', {
    coldSnapshot: (id: SessionId, signal?: AbortSignal) => {
      signal?.throwIfAborted()
      const entry = stored.get(id)
      if (entry === undefined) return Promise.reject(new Error(`session "${id}" not found`))
      return Promise.resolve(ctx.sessionProjections.restore({}, entry.events, 0).snapshot)
    },
  } as never)
  ctx.provide('workspaceRegistry', {
    archivedSessionIds: [],
    list: () => [],
  } as never)
  const attachedFiles = new Map<string, { ref: FileAttachmentRef; data: Uint8Array }>()
  const fileLimits = {
    maxFileBytes: 100 * 1024 * 1024,
    maxSessionFileBytes: options.maxSessionFileBytes ?? 1024 * 1024 * 1024,
  }
  ctx.provide('fileAttachments', {
    fileLimits,
    validateFile: (input: SaveFileAttachment) => {
      if (input.data.byteLength === 0) return Promise.reject(new Error('empty file'))
      return Promise.resolve()
    },
    saveFile: (input: SaveFileAttachment) => {
      const attachmentId = AttachmentId(`sha256:${createHash('sha256').update(input.data).digest('hex')}`)
      const ref: FileAttachmentRef = Object.freeze({
        attachmentId,
        mediaType: input.mediaType,
        bytes: input.data.byteLength,
        name: input.name,
      })
      attachedFiles.set(attachmentId, { ref, data: Uint8Array.from(input.data) })
      return Promise.resolve(ref)
    },
    readFile: (ref: FileAttachmentRef, signal?: AbortSignal) => {
      signal?.throwIfAborted()
      const storedFile = attachedFiles.get(ref.attachmentId)
      return storedFile === undefined
        ? Promise.reject(new Error('attachment not found'))
        : Promise.resolve({ ref: storedFile.ref, data: Uint8Array.from(storedFile.data) })
    },
  } as never)

  const handles = new Map<SessionId, AgentHandle>()
  let continuableSetup: ((childCtx: Context) => () => void) | undefined
  const publish = async (
    ownerCtx: Context,
    session: Session,
    setup: AgentSetup | undefined,
  ): Promise<AgentHandle> => {
    const agent = { id: session.id, session, status: 'idle' } as Agent
    const scope = createScope(ownerCtx, agent)
    const agentCtx = scope.ctx.extend({ agent })
    Object.assign(agent, { ctx: agentCtx })
    let detachSession: (() => void) | undefined
    let detachAgent: (() => void) | undefined
    try {
      const commit = await setup?.(agentCtx)
      commit?.commit()
      detachSession = ctx.sessions.enter(session)
      detachAgent = ctx.agents.register(agent)
      ctx.sessions.announce(session)
      const handle: AgentHandle = {
        agent,
        dispose: async () => {
          snapshot(session)
          detachAgent?.()
          detachSession?.()
          await scope.dispose()
          handles.delete(session.id)
        },
      }
      handles.set(session.id, handle)
      return handle
    } catch (error) {
      await scope.dispose()
      throw error
    }
  }
  ctx.agents.setFactory({
    createAgent: (ownerCtx: Context, options: CreateAgentOptions) => publish(
      ownerCtx,
      ctx.sessions.prepare(options.sessionId, {
        ...options.seed === undefined ? {} : { seed: options.seed },
        ...options.meta === undefined ? {} : { meta: options.meta },
      }),
      options.setup,
    ),
    resume: async (ownerCtx: Context, options: ResumeAgentOptions) => {
      const entry = stored.get(options.resumeSessionId)
      if (entry === undefined) throw new Error(`session "${options.resumeSessionId}" not found`)
      return publish(ownerCtx, ctx.sessions.prepare(entry.header.id, {
        seed: structuredClone(entry.events),
        meta: structuredClone(entry.header),
        seedSource: 'persistence',
      }), options.setup)
    },
  })
  ctx.provide('subagents', {
    registerContinuableSetup: (setup: (childCtx: Context) => () => void) => {
      continuableSetup = setup
      return () => {
        if (continuableSetup === setup) continuableSetup = undefined
      }
    },
  } as never)
  const teamMembers = new Map<SessionId, TeamMemberView[]>()
  const teamSpawnRequests: SpawnTeammateRequest[] = []
  ctx.provide('agentTeams', {
    listMembers: (caller: Agent): TeamMemberView[] => {
      const rootId = caller.session.header.parentSession ?? caller.id
      const root = ctx.agents.get(rootId) ?? caller
      return [{
        id: root.id,
        name: 'lead',
        role: 'lead',
        status: root.status,
        diagnostics: [],
      }, ...(teamMembers.get(rootId) ?? [])]
    },
    spawnTeammate: async (lead: Agent, request: SpawnTeammateRequest) => {
      teamSpawnRequests.push(request)
      request.signal.throwIfAborted()
      if (request.childId === undefined) throw new Error('test Team requires a reserved child id')
      const handle = await publish(
        ctx,
        ctx.sessions.prepare(request.childId, {
          meta: {
            parentSession: lead.id,
            origin: 'subagent',
            delegationDepth: 1,
            ...(lead.session.header.cwd === undefined ? {} : { cwd: lead.session.header.cwd }),
          },
        }),
        (childCtx) => {
          const dispose = continuableSetup?.(childCtx) ?? (() => {})
          childCtx.effect(() => dispose, 'test.continuableSetup()')
          return { commit() {} }
        },
      )
      const member: TeamMemberView = {
        id: handle.agent.id,
        name: request.name,
        role: 'teammate',
        status: handle.agent.status,
        description: request.description,
        provider: request.provider,
        context: request.context,
        diagnostics: [],
      }
      const current = teamMembers.get(lead.id) ?? []
      teamMembers.set(lead.id, [...current, member])
      return { member }
    },
  } as never)

  let forkSequence = 0
  const sessionController = {
    create: async (request: { sessionId: SessionId; cwd?: string }) => {
      if (ctx.agents.get(request.sessionId) === undefined) {
        if (stored.has(request.sessionId)) {
          await ctx.agents.resume({ resumeSessionId: request.sessionId })
        } else {
          await ctx.agents.create({
            sessionId: request.sessionId,
            meta: { cwd: request.cwd ?? root },
          })
        }
      }
      return { sessionId: request.sessionId }
    },
    fork: async (request: { sessionId: SessionId }) => {
      const source = ctx.sessions.get(request.sessionId)
      if (source === undefined) throw new Error(`session "${request.sessionId}" not found`)
      const sessionId = SessionId(`session-test-fork-${String(++forkSequence)}`)
      await ctx.agents.create({
        sessionId,
        seed: [...source.events],
        meta: {
          ...(source.header.cwd === undefined ? {} : { cwd: source.header.cwd }),
          parentSession: source.id,
          seedLength: source.events.length,
        },
      })
      return { sessionId }
    },
  }
  ctx.provide('sessionController', sessionController as never)

  const versions = new Map<QuantSkillsInstalledVersionId, QuantSkillsResolvedInstalledSkill>([
    [`${assetId}@${commitV1}` as QuantSkillsInstalledVersionId, resolved(commitV1, digestV1, 'version one')],
    [`${assetId}@${commitV2}` as QuantSkillsInstalledVersionId, resolved(commitV2, digestV2, 'version two')],
    [`${secondAssetId}@${commitV1}` as QuantSkillsInstalledVersionId,
      resolved(commitV1, digestV1, 'beta version', secondAssetId)],
  ])
  const agentTemplates = new Map<QuantSkillsInstalledVersionId, QuantSkillsInstalledAgentTemplate>()
  const agentResourceBases = new Map<QuantSkillsInstalledVersionId, string>()
  ctx.provide('quantSkillsHost', {
    list: (signal?: AbortSignal) => {
      signal?.throwIfAborted()
      return Promise.resolve({
        versions: [
          ...[...versions.values()].map(item => item.version),
          ...[...agentTemplates.values()].map(item => item.version),
        ],
      })
    },
    resolveInstalledSkill: (versionId: QuantSkillsInstalledVersionId, signal?: AbortSignal) => {
      signal?.throwIfAborted()
      const found = versions.get(versionId)
      return found === undefined
        ? Promise.reject(new Error(`installed version "${versionId}" not found`))
        : Promise.resolve(found)
    },
    agentTemplate: (versionId: QuantSkillsInstalledVersionId, signal?: AbortSignal) => {
      signal?.throwIfAborted()
      const found = agentTemplates.get(versionId)
      return found === undefined
        ? Promise.reject(new Error(`installed Agent version "${versionId}" not found`))
        : Promise.resolve(found)
    },
    resolveInstalledResource: (versionId: QuantSkillsInstalledVersionId, signal?: AbortSignal) => {
      signal?.throwIfAborted()
      const agent = agentTemplates.get(versionId)
      if (agent !== undefined) {
        return Promise.resolve({
          version: agent.version,
          resourceBase: agentResourceBases.get(versionId)
            ?? join(root, 'agent-versions', agent.version.assetId, agent.version.commit, 'source'),
        })
      }
      const skill = versions.get(versionId)
      if (skill?.definition.resourceBase?.kind === 'directory') {
        return Promise.resolve({ version: skill.version, resourceBase: skill.definition.resourceBase.path })
      }
      return Promise.reject(new Error(`installed version "${versionId}" not found`))
    },
    matchInstalledSkillResource: (resourceBase: string, signal?: AbortSignal) => {
      signal?.throwIfAborted()
      const skill = [...versions.values()].find(candidate => (
        candidate.version.kind === 'skill'
        && candidate.version.exposure === 'skill-registry'
        && candidate.definition.resourceBase?.kind === 'directory'
        && candidate.definition.resourceBase.path === resourceBase
      ))
      return Promise.resolve(skill === undefined
        ? undefined
        : { version: skill.version, resourceBase })
    },
    prepareAuthoredDraft: async (
      request: { draftRoot: string; kind: 'skill' | 'agent' },
      signal?: AbortSignal,
    ) => {
      signal?.throwIfAborted()
      const declaration = request.kind === 'skill' ? 'SKILL.md' : 'AGENTS.md'
      const content = await readFile(join(request.draftRoot, declaration), 'utf8')
      const digest = `sha256:${createHash('sha256').update(content).digest('hex')}` as QuantSkillsTreeDigest
      return {
        assetId: basename(request.draftRoot) as QuantSkillsAssetId,
        kind: request.kind,
        declaration,
        treeDigest: digest,
        fileCount: 1,
        totalBytes: Buffer.byteLength(content),
        requires: [],
      }
    },
    publishAuthoredDraft: async (
      request: { draftRoot: string; kind: 'skill' | 'agent'; expectedTreeDigest: QuantSkillsTreeDigest },
      signal?: AbortSignal,
    ) => {
      signal?.throwIfAborted()
      const declaration = request.kind === 'skill' ? 'SKILL.md' : 'AGENTS.md'
      const content = await readFile(join(request.draftRoot, declaration), 'utf8')
      const hash = createHash('sha256').update(content).digest('hex')
      const digest = `sha256:${hash}` as QuantSkillsTreeDigest
      if (digest !== request.expectedTreeDigest) throw new Error('draft changed')
      const selectedAssetId = basename(request.draftRoot) as QuantSkillsAssetId
      const commit = hash.slice(0, 40) as QuantSkillsCommitSha
      const versionId = `${selectedAssetId}@${commit}` as QuantSkillsInstalledVersionId
      const version: QuantSkillsInstalledVersion = {
        versionId,
        assetId: selectedAssetId,
        kind: request.kind,
        repository: `local-authoring:${selectedAssetId}`,
        commit,
        declaration,
        treeDigest: digest,
        fileCount: 1,
        totalBytes: Buffer.byteLength(content),
        installedAt: Date.now(),
        exposure: request.kind === 'skill' ? 'skill-registry' : 'agent-template',
        origin: 'local-authoring',
      }
      if (request.kind === 'skill') {
        versions.set(versionId, resolved(commit, digest, content, selectedAssetId))
      } else {
        agentTemplates.set(versionId, Object.freeze({
          version,
          name: selectedAssetId,
          description: 'Locally authored Agent.',
          instructions: content,
          requires: Object.freeze([]),
        }))
      }
      return version
    },
  } as never)
  await ctx.plugin(QuantSkillsSessionService, {
    dshHome: root,
    liveTradingToolNames: options.liveTrading === true ? ['submit_live_order'] : [],
    ...(options.maxSessionFileBytes === undefined ? {} : {
      maxSessionFileAttachmentBytes: options.maxSessionFileBytes,
    }),
    ...(options.maxResultArchiveBytes === undefined ? {} : {
      maxResultArchiveBytes: options.maxResultArchiveBytes,
    }),
  })
  return {
    root, ctx, sessionController, versions, agentTemplates, agentResourceBases, handles, fileLimits, liveOrders,
    teamSpawnRequests,
  }
}

async function createBound(
  fixture: Harness,
  id: string,
  commit: QuantSkillsCommitSha = commitV1,
): Promise<SessionId> {
  const sessionId = SessionId(id)
  await fixture.ctx.quantSkillsSessions.create({
    sessionId,
    versionId: `${assetId}@${commit}` as QuantSkillsInstalledVersionId,
  })
  return sessionId
}

function appendLoggedToolResult(
  session: Session,
  callId: ToolCallId,
  name: string,
  text: string,
): void {
  session.append('tool/call', {
    turn: 1,
    step: 1,
    callId,
    name,
    arguments: '{}',
  })
  session.append('tool/result', {
    turn: 1,
    step: 1,
    message: createToolResultMessage({
      callId,
      isError: false,
      content: [{ type: 'text', text }],
    }),
  }, { surfaceOp: 'append' })
}

describe('QuantSkills exact-version sessions', () => {
  it('uninstalls imported Agent definitions with revision checks while preserving their sessions and Skill dependencies', async () => {
    const fixture = await harness()
    const sourceVersionId = `${agentAssetId}@${commitV1}` as QuantSkillsInstalledVersionId
    fixture.agentTemplates.set(sourceVersionId, agentTemplate(agentAssetId, commitV1))
    const uninstallAsset = vi.fn().mockResolvedValue(undefined)
    Object.assign(fixture.ctx.quantSkillsHost, { uninstallAsset })
    const service = fixture.ctx.quantSkillsSessions
    const agent = await service.agentCreate({ name: '测试研究助手', role: '完成研究', mode: 'dynamic', permission: 'workspace-write', sourceVersionId, versionIds: [`${assetId}@${commitV1}` as QuantSkillsInstalledVersionId] })
    const sessionId = SessionId('session-agent-uninstall')
    await service.agentSessionCreate({ sessionId, agentId: agent.agentId, expectedRevision: agent.revision })
    await expect(service.agentUninstall({ agentId: agent.agentId, expectedRevision: agent.revision + 1 })).rejects.toThrow()
    expect(uninstallAsset).not.toHaveBeenCalled()
    const another = await service.agentCreate({ name: '另一个研究助手', role: '完成研究', mode: 'dynamic', permission: 'workspace-write', sourceVersionId, versionIds: [] })
    await service.agentUninstall({ agentId: agent.agentId, expectedRevision: agent.revision })
    expect(uninstallAsset).not.toHaveBeenCalled()
    expect((await service.agentList()).some(item => item.agentId === agent.agentId)).toBe(false)
    expect((await service.agentList()).some(item => item.agentId === another.agentId)).toBe(true)
    await service.agentUninstall({ agentId: another.agentId, expectedRevision: another.revision })
    expect(uninstallAsset).toHaveBeenCalledWith({ assetId: agentAssetId })
    expect(fixture.ctx.sessions.get(sessionId)).toBeDefined()
    expect(fixture.versions.has(`${assetId}@${commitV1}` as QuantSkillsInstalledVersionId)).toBe(true)
  })
  it('registers every durable QuantSkills event with the DSH session reader', () => {
    const catalog = KNOWN_SESSION_EVENT_TYPES as Set<string>
    for (const type of QUANTSKILLS_SESSION_EVENT_TYPES) catalog.delete(type)
    try {
      registerQuantSkillsSessionEventTypes()
      expect(QUANTSKILLS_SESSION_EVENT_TYPES.every(type => KNOWN_SESSION_EVENT_TYPES.has(type))).toBe(true)
    } finally {
      for (const type of QUANTSKILLS_SESSION_EVENT_TYPES) catalog.add(type)
    }
  })

  it('creates, lists, and restores plain QuantSkills Sessions without preparing PandaData', async () => {
    const fixture = await harness()
    const sessionId = SessionId('plain-quantskills-session')
    await fixture.ctx.quantSkillsSessions.plainSessionCreate({
      sessionId,
      purpose: 'ordinary',
      cwd: fixture.root,
    })
    const agent = fixture.ctx.agents.get(sessionId)!
    expect(foldQuantSkillsPlainSessionBinding(agent.session.events)).toEqual({ purpose: 'ordinary' })
    expect(foldQuantSkillsPandaRuntimeBinding(agent.session.events)).toBeNull()
    expect(fixture.ctx.tools.get('quantskills_panda_python', agent)).toBeUndefined()
    expect(fixture.ctx.tools.get('quantskills_contest_query', agent)).toBeUndefined()
    expect(fixture.ctx.tools.get('quantskills_contest_prepare', agent)).toBeUndefined()
    const prompt = renderPrompt(await fixture.ctx.systemPrompt.assemble({ scope: agent }))
    expect(prompt).not.toContain('PandaData is the default data source')
    expect(prompt).not.toContain('Do not use AkShare, Yahoo, Tushare, or any other replacement data source')
    await expect(fixture.ctx.quantSkillsSessions.plainSessionList({})).resolves.toEqual([
      expect.objectContaining({
        sessionId,
        binding: { purpose: 'ordinary' },
        archived: false,
        running: false,
      }),
    ])
    await mkdir(join(fixture.root, 'output'), { recursive: true })
    await writeFile(join(fixture.root, 'output', 'plain-result.md'), '# Plain QuantSkills result\n')
    await expect(fixture.ctx.quantSkillsSessions.resultPrepare({
      sessionId,
      paths: ['output/plain-result.md'],
    })).resolves.toEqual({ results: [{
      inputPath: 'output/plain-result.md',
      status: 'ready',
      path: 'output/plain-result.md',
      archived: false,
    }] })

    await fixture.handles.get(sessionId)!.dispose()
    await fixture.ctx.quantSkillsSessions.plainSessionCreate({
      sessionId,
      purpose: 'ordinary',
      cwd: fixture.root,
    })
    const resumed = fixture.ctx.agents.get(sessionId)!
    expect(resumed.session.events.filter(event => event.type === 'quantskills/plain-session')).toHaveLength(1)
    expect(resumed.session.events.filter(event => event.type === 'panda/runtime-bound')).toHaveLength(0)
    expect(fixture.ctx.tools.get('quantskills_panda_python', resumed)).toBeUndefined()
    await fixture.ctx.fiber.dispose()
  })

  it('scopes contest tools to a dedicated, account-bound session and keeps it in the archive', async () => {
    const fixture = await harness()
    const service = fixture.ctx.quantSkillsSessions
    const contest = (service as unknown as { contest: ContestService }).contest
    const identity = { accountId: 'account-test', contestId: 'contest-test' }
    const queryData = vi.fn(async () => 'cached rows')
    fixture.ctx.tools.register(defineTool({ name: 'quantskills_data_query', description: 'Test cached data.',
      parameters: { refresh: { type: 'boolean' } },
      output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] }, execute: queryData }))
    const ordinaryId = SessionId('ordinary-alongside-contest')
    await service.plainSessionCreate({ sessionId: ordinaryId, purpose: 'ordinary', cwd: fixture.root })
    const ordinary = fixture.ctx.agents.get(ordinaryId)!
    const ordinaryBefore = renderPrompt(await fixture.ctx.systemPrompt.assemble({ scope: ordinary }))
    const ordinaryTools = fixture.ctx.tools.schemas(ordinary)
    await contest.setEnabled(true)
    vi.spyOn(contest, 'researchIdentity').mockResolvedValue(identity)
    vi.spyOn(contest, 'rules').mockResolvedValue('official rules')
    vi.spyOn(contest, 'rulesText').mockReturnValue('official rules')
    const sessionId = SessionId('contest-session')
    await service.plainSessionCreate({ sessionId, purpose: 'contest', cwd: fixture.root })
    const agent = fixture.ctx.agents.get(sessionId)!
    expect(foldQuantSkillsPlainSessionBinding(agent.session.events)).toEqual({ purpose: 'contest', contest: identity })
    expect(fixture.ctx.tools.get('quantskills_contest_query', agent)).toBeDefined()
    expect(fixture.ctx.tools.get('quantskills_contest_prepare', agent)).toBeDefined()
    expect(fixture.ctx.tools.get('quantskills_contest_execute', agent)).toBeUndefined()
    expect(fixture.ctx.tools.get('submit_live_order', agent)).toBeUndefined()
    expect(fixture.ctx.tools.get('submit_live_order', ordinary)).toBeDefined()
    const call = (target: Agent, name: string, args = {}) => fixture.ctx.tools.execute({
      callId: ToolCallId(`contest-test-${name}`), agent: target, name, arguments: args, signal: new AbortController().signal,
    })
    await expect(call(agent, 'submit_live_order', { order_id: 'must-not-submit' })).resolves.toMatchObject({ isError: true })
    await expect(call(agent, 'quantskills_data_query', { refresh: true })).resolves.toMatchObject({ isError: true })
    await expect(call(agent, 'quantskills_data_query')).resolves.toMatchObject({ isError: true })
    expect(queryData).not.toHaveBeenCalled()
    await expect(call(agent, 'quantskills_data_query', { refresh: false })).resolves.toMatchObject({ isError: false })
    await expect(call(ordinary, 'quantskills_data_query', { refresh: true })).resolves.toMatchObject({ isError: false })
    const late = vi.fn(async () => 'should never run')
    agent.ctx.get('tools')!.register(defineTool({ name: 'late_shell', description: 'Added after contest setup.', parameters: {},
      output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] }, execute: late }))
    await expect(call(agent, 'late_shell')).resolves.toMatchObject({ isError: true })
    expect(late).not.toHaveBeenCalled()
    await expect(call(agent, 'quantskills_contest_prepare', { operation: 'place_order' })).resolves.toMatchObject({ isError: true })
    const contestPrompt = renderPrompt(await fixture.ctx.systemPrompt.assemble({ scope: agent }))
    expect(contestPrompt).toContain('contest-account-check')
    expect(contestPrompt).not.toContain('official rules')
    expect(contestPrompt).not.toContain('through the normal shell')
    for (const name of ['contest-account-check', 'contest-research-plan', 'contest-daily-review']) {
      expect(await fixture.ctx.skills.get(name, { scope: agent })).toBeDefined()
      expect(await fixture.ctx.skills.get(name, { scope: ordinary })).toBeUndefined()
    }
    expect(await service.plainSessionList({})).toContainEqual(expect.objectContaining({ sessionId }))
    expect(fixture.ctx.tools.get('quantskills_contest_query', ordinary)).toBeUndefined()
    expect(renderPrompt(await fixture.ctx.systemPrompt.assemble({ scope: ordinary }))).toBe(ordinaryBefore)
    expect(fixture.ctx.tools.schemas(ordinary)).toEqual(ordinaryTools)
    await service.contestMode({ enabled: false })
    await expect(service.contestQuery({ kind: 'account' })).rejects.toThrow('比赛模式已关闭')
    expect(renderPrompt(await fixture.ctx.systemPrompt.assemble({ scope: agent }))).toContain('比赛模式已关闭')
    expect(renderPrompt(await fixture.ctx.systemPrompt.assemble({ scope: ordinary }))).toBe(ordinaryBefore)
    await expect(call(ordinary, 'submit_live_order', { order_id: 'ordinary-still-works' })).resolves.toMatchObject({ isError: false })
    expect(fixture.liveOrders).toEqual(['ordinary-still-works'])
    await fixture.handles.get(sessionId)!.dispose()
    await service.sessionEnsure({ sessionId })
    const resumed = fixture.ctx.agents.get(sessionId)!
    expect(fixture.ctx.tools.get('submit_live_order', resumed)).toBeUndefined()
    expect(fixture.ctx.tools.get('quantskills_contest_inspect', resumed)).toBeDefined()
    expect(fixture.ctx.tools.schemas(ordinary)).toEqual(ordinaryTools)
    await fixture.ctx.fiber.dispose()
  })

  it('reuses an account main conversation across concurrent opens, separates topics and rejects ordinary inspections', async () => {
    const fixture = await harness(), service = fixture.ctx.quantSkillsSessions
    const contest = (service as unknown as { contest: ContestService }).contest
    const identity = { accountId: 'account-main', contestId: 'contest-main' }
    vi.spyOn(contest, 'researchIdentity').mockResolvedValue(identity)
    vi.spyOn(contest, 'rules').mockResolvedValue('official rules')
    const inspect = vi.spyOn(contest, 'inspect').mockResolvedValue({ identity } as never)
    const [main, repeated] = await Promise.all([
      service.contestSessionOpen({ sessionId: SessionId('main-candidate-a'), cwd: fixture.root }),
      service.contestSessionOpen({ sessionId: SessionId('main-candidate-b'), cwd: fixture.root }),
    ])
    expect(main.created).toBe(true); expect(repeated.created).toBe(false)
    expect(repeated.sessionId).toBe(main.sessionId)
    expect(main.binding).toEqual({ purpose: 'contest', contest: identity, contestConversation: 'main' })
    const topic = await service.contestSessionOpen({ sessionId: SessionId('topic-a'), cwd: fixture.root, topic: true })
    expect(topic.sessionId).not.toBe(main.sessionId)
    expect((await service.contestSessionOpen({ sessionId: SessionId('main-candidate-c'), cwd: fixture.root })).sessionId).toBe(main.sessionId)
    await service.contestInspect({ sessionId: main.sessionId })
    expect(inspect).toHaveBeenCalledWith(identity, undefined)
    const ordinaryId = SessionId('normal-cannot-inspect')
    await service.plainSessionCreate({ sessionId: ordinaryId, purpose: 'ordinary', cwd: fixture.root })
    await expect(service.contestInspect({ sessionId: ordinaryId })).rejects.toThrow('仅用于比赛专用会话')
    expect(inspect).toHaveBeenCalledTimes(1)
    vi.mocked(contest.researchIdentity).mockResolvedValue({ ...identity, accountId: 'another-account' })
    const other = await service.contestSessionOpen({ sessionId: SessionId('other-account-main'), cwd: fixture.root })
    expect(other.created).toBe(true); expect(other.sessionId).not.toBe(main.sessionId)
    await fixture.ctx.fiber.dispose()
  })

  it('isolates factor-contest tools and prompts, reuses the account main session and separates topics', async () => {
    const fixture = await harness(), service = fixture.ctx.quantSkillsSessions
    const factors = (service as unknown as { factorContest: FactorContestService }).factorContest
    const identity = { accountId: 'factor-user', contestId: 'pandaai-fourth-factor' }
    vi.spyOn(factors, 'researchIdentity').mockResolvedValue(identity)
    const inspect = vi.spyOn(factors, 'inspect').mockResolvedValue({ identity } as never)
    const ordinaryId = SessionId('ordinary-alongside-factor')
    await service.plainSessionCreate({ sessionId: ordinaryId, purpose: 'ordinary', cwd: fixture.root })
    const ordinary = fixture.ctx.agents.get(ordinaryId)!
    const promptBefore = renderPrompt(await fixture.ctx.systemPrompt.assemble({ scope: ordinary })), toolsBefore = fixture.ctx.tools.schemas(ordinary)
    await factors.mode(true)
    const [first, repeated] = await Promise.all([
      service.factorSessionOpen({ sessionId: SessionId('factor-main-a'), cwd: fixture.root }),
      service.factorSessionOpen({ sessionId: SessionId('factor-main-b'), cwd: fixture.root }),
    ])
    expect(first.created).toBe(true); expect(repeated.created).toBe(false); expect(first.sessionId).toBe(repeated.sessionId)
    expect(first.binding).toEqual({ purpose: 'factor-contest', factorContest: identity, contestConversation: 'main' })
    const agent = fixture.ctx.agents.get(first.sessionId)!
    for (const name of ['quantskills_factor_inspect', 'quantskills_factor_budget', 'quantskills_factor_run', 'quantskills_factor_prepare']) {
      expect(fixture.ctx.tools.get(name, agent)).toBeDefined(); expect(fixture.ctx.tools.get(name, ordinary)).toBeUndefined()
    }
    for (const name of ['quantskills_factor_confirm', 'submit_live_order', 'quantskills_contest_query', 'quantskills_panda_python']) expect(fixture.ctx.tools.get(name, agent)).toBeUndefined()
    const late = vi.fn(async () => 'must not run')
    agent.ctx.get('tools')!.register(defineTool({ name: 'factor_late_shell', description: 'Late unsafe tool.', parameters: {}, output: { schema: { type: 'string' }, render: (_a, value) => [{ type: 'text', text: value }] }, execute: late }))
    await expect(fixture.ctx.tools.execute({ callId: ToolCallId('factor-guard'), agent, name: 'factor_late_shell', arguments: {}, signal: new AbortController().signal })).resolves.toMatchObject({ isError: true })
    expect(late).not.toHaveBeenCalled()
    const prompt = renderPrompt(await fixture.ctx.systemPrompt.assemble({ scope: agent }))
    expect(prompt).toContain('第四届因子大赛'); expect(prompt).toContain('算力阈值不是服务端硬封顶')
    for (const name of ['factor-contest-inspection', 'factor-contest-research', 'factor-contest-submission']) {
      expect(await fixture.ctx.skills.get(name, { scope: agent })).toBeDefined(); expect(await fixture.ctx.skills.get(name, { scope: ordinary })).toBeUndefined()
    }
    const topic = await service.factorSessionOpen({ sessionId: SessionId('factor-topic'), cwd: fixture.root, topic: true })
    expect(topic.sessionId).not.toBe(first.sessionId)
    const inspectionSignal = new AbortController().signal
    await service.factorInspect({ sessionId: first.sessionId }, inspectionSignal); expect(inspect).toHaveBeenCalledWith(identity, inspectionSignal)
    await expect(service.factorInspect({ sessionId: ordinaryId })).rejects.toThrow('因子比赛会话')
    expect((await service.plainSessionList({})).some(s => s.sessionId === first.sessionId)).toBe(true)
    expect(renderPrompt(await fixture.ctx.systemPrompt.assemble({ scope: ordinary }))).toBe(promptBefore)
    expect(fixture.ctx.tools.schemas(ordinary)).toEqual(toolsBefore)
    await factors.mode(false)
    expect(renderPrompt(await fixture.ctx.systemPrompt.assemble({ scope: agent }))).toContain('因子比赛模式已关闭')
    await fixture.handles.get(first.sessionId)!.dispose(); await service.sessionEnsure({ sessionId: first.sessionId })
    expect(fixture.ctx.tools.get('quantskills_factor_inspect', fixture.ctx.agents.get(first.sessionId)!)).toBeDefined()
    expect(fixture.ctx.tools.schemas(ordinary)).toEqual(toolsBefore)
    vi.mocked(factors.researchIdentity).mockResolvedValue({ ...identity, accountId: 'another-factor-user' })
    const other = await service.factorSessionOpen({ sessionId: SessionId('other-factor-account'), cwd: fixture.root })
    expect(other.sessionId).not.toBe(first.sessionId)
    await fixture.ctx.fiber.dispose()
  })

  it('keeps native DSH Sessions outside the QuantSkills PandaData default', async () => {
    const fixture = await harness()
    const sessionId = SessionId('native-session-without-quantskills-owner')
    await fixture.sessionController.create({ sessionId })
    const agent = fixture.ctx.agents.get(sessionId)!
    expect(foldQuantSkillsPlainSessionBinding(agent.session.events)).toBeNull()
    expect(foldQuantSkillsPandaRuntimeBinding(agent.session.events)).toBeNull()
    expect(fixture.ctx.tools.get('quantskills_panda_python', agent)).toBeUndefined()
    expect(renderPrompt(await fixture.ctx.systemPrompt.assemble({ scope: agent })))
      .not.toContain('PandaData is the default data source')
    await fixture.ctx.fiber.dispose()
  })

  it('verifies the declaration name when a standard Skill omits the repository prefix', async () => {
    const fixture = await harness()
    fixture.versions.set(
      `${assetId}@${commitV1}` as QuantSkillsInstalledVersionId,
      resolved(commitV1, digestV1, 'version one', assetId, 'alpha'),
    )

    const sessionId = await createBound(fixture, 'session-prefixed-repository')
    const agent = fixture.ctx.agents.get(sessionId)!
    await expect(fixture.ctx.skills.get('alpha', { scope: agent }))
      .resolves.toMatchObject({ content: 'version one' })
    await fixture.ctx.fiber.dispose()
  })

  it('pins v1 and v2 independently and keeps retries idempotent', async () => {
    const fixture = await harness()
    const first = await createBound(fixture, 'session-v1')
    const second = await createBound(fixture, 'session-v2', commitV2)

    const firstAgent = fixture.ctx.agents.get(first)!
    const secondAgent = fixture.ctx.agents.get(second)!
    expect(foldQuantSkillsPandaRuntimeBinding(firstAgent.session.events)).toBeNull()
    expect(fixture.ctx.tools.get('quantskills_panda_python', firstAgent)).toBeUndefined()
    await expect(fixture.ctx.skills.get(assetId, { scope: firstAgent })).resolves.toMatchObject({ content: 'version one' })
    await expect(fixture.ctx.skills.get(assetId, { scope: secondAgent })).resolves.toMatchObject({ content: 'version two' })
    expect(firstAgent.session.events.filter(event => event.type === 'quantskills/session-bound')).toHaveLength(1)

    await fixture.ctx.quantSkillsSessions.create({
      sessionId: first,
      versionId: `${assetId}@${commitV1}` as QuantSkillsInstalledVersionId,
    })
    expect(firstAgent.session.events.filter(event => event.type === 'quantskills/session-bound')).toHaveLength(1)
    await expect(fixture.ctx.quantSkillsSessions.create({
      sessionId: first,
      versionId: `${assetId}@${commitV2}` as QuantSkillsInstalledVersionId,
    })).rejects.toThrow('already bound')
    await fixture.ctx.fiber.dispose()
  })

  it('persists resident Skill hot-plug state and updates the live model context', async () => {
    const fixture = await harness()
    const sessionId = await createBound(fixture, 'session-resident-hot-plug')
    const agent = fixture.ctx.agents.get(sessionId)!

    expect(foldQuantSkillsResidentSkills(agent.session.events).map(binding => binding.assetId)).toEqual([assetId])
    expect(renderPrompt(await fixture.ctx.systemPrompt.assemble({ scope: agent }))).toContain('version one')

    await Promise.all([
      fixture.ctx.quantSkillsSessions.residentSkillAttach({
        sessionId,
        versionId: `${secondAssetId}@${commitV1}` as QuantSkillsInstalledVersionId,
      }),
      fixture.ctx.quantSkillsSessions.residentSkillAttach({
        sessionId,
        versionId: `${secondAssetId}@${commitV1}` as QuantSkillsInstalledVersionId,
      }),
    ])
    expect(foldQuantSkillsResidentSkills(agent.session.events).map(binding => binding.assetId))
      .toEqual([assetId, secondAssetId])
    expect(agent.session.events.filter(event => event.type === 'quantskills/resident-skill-changed'))
      .toHaveLength(1)
    expect(renderPrompt(await fixture.ctx.systemPrompt.assemble({ scope: agent }))).toContain('beta version')
    await expect(fixture.ctx.skills.get(secondAssetId, { scope: agent }))
      .resolves.toMatchObject({ content: 'beta version' })

    await fixture.ctx.quantSkillsSessions.residentSkillDetach({ sessionId, assetId })
    expect(foldQuantSkillsResidentSkills(agent.session.events).map(binding => binding.assetId)).toEqual([secondAssetId])
    expect(renderPrompt(await fixture.ctx.systemPrompt.assemble({ scope: agent }))).not.toContain('version one')
    await expect(fixture.ctx.skills.get(assetId, { scope: agent })).resolves.toBeUndefined()

    await fixture.handles.get(sessionId)!.dispose()
    await fixture.ctx.quantSkillsSessions.create({
      sessionId,
      versionId: `${assetId}@${commitV1}` as QuantSkillsInstalledVersionId,
    })
    const resumed = fixture.ctx.agents.get(sessionId)!
    expect(foldQuantSkillsResidentSkills(resumed.session.events).map(binding => binding.assetId)).toEqual([secondAssetId])
    expect(renderPrompt(await fixture.ctx.systemPrompt.assemble({ scope: resumed }))).toContain('beta version')
    expect(renderPrompt(await fixture.ctx.systemPrompt.assemble({ scope: resumed }))).not.toContain('version one')
    await fixture.ctx.fiber.dispose()
  })

  it('keeps resident Skill template syntax literal through hot-plug and resume', async () => {
    const fixture = await harness()
    const literalContent = 'before {{#task}}literal body{{/task}} after'
    fixture.versions.set(
      `${secondAssetId}@${commitV1}` as QuantSkillsInstalledVersionId,
      resolved(commitV1, digestV1, literalContent, secondAssetId),
    )
    const sessionId = await createBound(fixture, 'session-resident-literal')
    const agent = fixture.ctx.agents.get(sessionId)!
    const outputPolicy = 'Write every generated artifact under `output/` in the current Session workspace.'

    await fixture.ctx.quantSkillsSessions.residentSkillAttach({
      sessionId,
      versionId: `${secondAssetId}@${commitV1}` as QuantSkillsInstalledVersionId,
    })
    const livePrompt = renderPrompt(await fixture.ctx.systemPrompt.assemble({ scope: agent }))
    expect(livePrompt).toContain(literalContent)
    expect(livePrompt).toContain(outputPolicy)
    expect(livePrompt).toContain('resource directory as read-only source material')

    await fixture.ctx.quantSkillsSessions.residentSkillDetach({ sessionId, assetId: secondAssetId })
    expect(renderPrompt(await fixture.ctx.systemPrompt.assemble({ scope: agent }))).not.toContain(literalContent)
    await fixture.ctx.quantSkillsSessions.residentSkillAttach({
      sessionId,
      versionId: `${secondAssetId}@${commitV1}` as QuantSkillsInstalledVersionId,
    })
    await fixture.handles.get(sessionId)!.dispose()
    await fixture.ctx.quantSkillsSessions.create({
      sessionId,
      versionId: `${assetId}@${commitV1}` as QuantSkillsInstalledVersionId,
    })
    const resumed = fixture.ctx.agents.get(sessionId)!
    const resumedPrompt = renderPrompt(await fixture.ctx.systemPrompt.assemble({ scope: resumed }))
    expect(resumedPrompt).toContain(literalContent)
    expect(resumedPrompt).toContain(outputPolicy)
    await fixture.ctx.fiber.dispose()
  })

  it('lists and renders only Session-authorized qsh forms with real attachments', async () => {
    const fixture = await harness()
    const promptForm = {
      status: 'ready',
      adaptations: [{ code: 'number-default-string', fieldKey: 'days' }],
      form: {
        version: 1,
        task: { required: true, placeholder: '描述任务' },
        fields: [
          {
            key: 'market', label: '市场', type: 'select', required: true, default: 'cn',
            options: [{ value: 'cn', label: '中国' }, { value: 'us', label: '美国' }],
          },
          { key: 'days', label: '天数', type: 'number', default: 5 },
        ],
        promptTemplate: '任务：{{task}}\n市场：{{market}}\n天数：{{days}}\n{{#attachments}}附件：\n{{attachments}}{{/attachments}}',
      },
    } as const satisfies QuantSkillsPromptFormResult
    fixture.versions.set(
      `${assetId}@${commitV1}` as QuantSkillsInstalledVersionId,
      resolved(commitV1, digestV1, 'literal {{task}} declaration', assetId, assetId, promptForm),
    )
    const sessionId = await createBound(fixture, 'session-prompt-form')
    const attachment = Buffer.from('symbol,score\n000001,0.8\n')
    await fixture.ctx.quantSkillsSessions.fileAttach({
      sessionId,
      name: 'signals.csv',
      mediaType: 'text/csv',
      data: attachment.toString('base64'),
    })

    await expect(fixture.ctx.quantSkillsSessions.promptFormList({ sessionId })).resolves.toEqual({
      forms: [{
        assetId,
        versionId: `${assetId}@${commitV1}`,
        source: 'skill',
        promptForm,
      }],
    })
    const rendered = await fixture.ctx.quantSkillsSessions.promptFormRender({
      sessionId,
      versionId: `${assetId}@${commitV1}` as QuantSkillsInstalledVersionId,
      task: '<分析风险>',
      values: { days: '10' },
    })
    expect(rendered.text).toMatch(/^任务：<分析风险>\n市场：cn\n天数：10\n附件：\n- signals\.csv \(text\/csv, \d+ bytes, utf8-text; id sha256:/)
    await expect(fixture.ctx.quantSkillsSessions.promptFormRender({
      sessionId,
      versionId: `${assetId}@${commitV2}` as QuantSkillsInstalledVersionId,
      task: 'not authorized',
      values: {},
    })).rejects.toThrow('not part of the addressed Session')
    await expect(fixture.ctx.quantSkillsSessions.promptFormRender({
      sessionId,
      versionId: `${assetId}@${commitV1}` as QuantSkillsInstalledVersionId,
      task: '',
      values: {},
    })).rejects.toThrow('task is required')
    await fixture.ctx.fiber.dispose()
  })

  it('keeps an invalid qsh form non-blocking while disabling parameter rendering', async () => {
    const fixture = await harness()
    const promptForm = { status: 'invalid', reason: 'undeclared variable "model"' } as const
    fixture.versions.set(
      `${assetId}@${commitV1}` as QuantSkillsInstalledVersionId,
      resolved(commitV1, digestV1, 'declaration remains available', assetId, assetId, promptForm),
    )
    const sessionId = await createBound(fixture, 'session-invalid-prompt-form')

    await expect(fixture.ctx.quantSkillsSessions.promptFormList({ sessionId }))
      .resolves.toEqual({ forms: [expect.objectContaining({ promptForm })] })
    await expect(fixture.ctx.quantSkillsSessions.promptFormRender({
      sessionId,
      versionId: `${assetId}@${commitV1}` as QuantSkillsInstalledVersionId,
      values: {},
    })).rejects.toThrow('parameter form is unavailable')
    expect(renderPrompt(await fixture.ctx.systemPrompt.assemble({ scope: fixture.ctx.agents.get(sessionId)! })))
      .toContain('declaration remains available')
    await fixture.ctx.fiber.dispose()
  })

  it('cold-resumes the logged version and fails closed when it is missing', async () => {
    const fixture = await harness()
    const id = await createBound(fixture, 'session-cold')
    await fixture.handles.get(id)!.dispose()

    await fixture.ctx.quantSkillsSessions.create({
      sessionId: id,
      versionId: `${assetId}@${commitV1}` as QuantSkillsInstalledVersionId,
    })
    const resumed = fixture.ctx.agents.get(id)!
    await expect(fixture.ctx.skills.get(assetId, { scope: resumed })).resolves.toMatchObject({ content: 'version one' })
    await fixture.handles.get(id)!.dispose()

    fixture.versions.delete(`${assetId}@${commitV1}` as QuantSkillsInstalledVersionId)
    await expect(fixture.ctx.quantSkillsSessions.create({
      sessionId: id,
      versionId: `${assetId}@${commitV1}` as QuantSkillsInstalledVersionId,
    })).rejects.toThrow('not found')
    expect(fixture.ctx.sessions.get(id)).toBeUndefined()
    expect(fixture.ctx.agents.get(id)).toBeUndefined()
    await fixture.ctx.fiber.dispose()
  })

  it('inherits the exact binding and provider through an API fork', async () => {
    const fixture = await harness()
    const sourceId = await createBound(fixture, 'session-source')
    const source = fixture.ctx.sessions.get(sourceId)!
    source.append('turn/start', { turn: 1 })
    source.append('turn/end', { turn: 1, reason: { kind: 'completed' } })

    const response = await fixture.sessionController.fork({ sessionId: sourceId })
    await fixture.ctx.quantSkillsSessions.sessionEnsure({ sessionId: response.sessionId })
    const child = fixture.ctx.agents.get(response.sessionId)!
    expect(foldQuantSkillsSessionBinding(child.session.events)?.versionId)
      .toBe(`${assetId}@${commitV1}`)
    expect(child.session.events.filter(event => event.type === 'quantskills/session-bound')).toHaveLength(1)
    await expect(fixture.ctx.skills.get(assetId, { scope: child })).resolves.toMatchObject({ content: 'version one' })
    await fixture.ctx.fiber.dispose()
  })

  it('initializes a forked resident Skill runtime before its first hot-plug', async () => {
    const fixture = await harness()
    const sourceId = await createBound(fixture, 'session-resident-fork-source')
    const response = await fixture.sessionController.fork({ sessionId: sourceId })

    await fixture.ctx.quantSkillsSessions.residentSkillAttach({
      sessionId: response.sessionId,
      versionId: `${secondAssetId}@${commitV1}` as QuantSkillsInstalledVersionId,
    })

    const child = fixture.ctx.agents.get(response.sessionId)!
    expect(foldQuantSkillsResidentSkills(child.session.events).map(binding => binding.assetId))
      .toEqual([assetId, secondAssetId])
    await expect(fixture.ctx.skills.get(assetId, { scope: child }))
      .resolves.toMatchObject({ content: 'version one' })
    await expect(fixture.ctx.skills.get(secondAssetId, { scope: child }))
      .resolves.toMatchObject({ content: 'beta version' })
    await fixture.ctx.fiber.dispose()
  })

  it('lists only bound ordinary sessions and derives frequent Skills from those archives', async () => {
    const fixture = await harness()
    await fixture.sessionController.create({ sessionId: SessionId('session-ordinary') })
    await createBound(fixture, 'session-bound-one')
    await createBound(fixture, 'session-bound-two')

    expect(foldQuantSkillsSessionBinding(fixture.ctx.sessions.get(SessionId('session-ordinary'))!.events)).toBeNull()
    const archives = await fixture.ctx.quantSkillsSessions.list({})
    expect(archives.map(item => item.sessionId).sort()).toEqual([
      SessionId('session-bound-one'),
      SessionId('session-bound-two'),
    ])
    expect(archives.every(item => !item.running)).toBe(true)
    Object.assign(fixture.ctx.agents.get(SessionId('session-bound-one'))!, { status: 'running' })
    await expect(fixture.ctx.quantSkillsSessions.list({})).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ sessionId: SessionId('session-bound-one'), running: true }),
      expect.objectContaining({ sessionId: SessionId('session-bound-two'), running: false }),
    ]))
    const frequent = await fixture.ctx.quantSkillsSessions.frequent({})
    expect(frequent).toEqual([{
      assetId,
      sessionCount: 2,
      lastUsedAt: frequent[0]!.lastUsedAt,
      recentSessionId: archives[0]!.sessionId,
    }])
    expect(typeof frequent[0]!.lastUsedAt).toBe('number')
    await fixture.ctx.fiber.dispose()
  })
})

describe('QuantSkills generic attachments', () => {
  it('logs ownership, projects limits, and exposes ready text only through the scoped tool', async () => {
    const fixture = await harness()
    const sessionId = await createBound(fixture, 'session-attachment-text')
    const data = Buffer.from('日期,收益\n2026-08-21,0.03\n').toString('base64')
    const attached = await fixture.ctx.quantSkillsSessions.fileAttach({
      sessionId,
      data,
      mediaType: 'text/csv',
      name: 'returns.csv',
    })

    expect(attached).toMatchObject({
      file: { name: 'returns.csv', mediaType: 'text/csv' },
      parsing: { status: 'ready', kind: 'utf8-text' },
    })
    expect(JSON.stringify(fixture.ctx.sessions.get(sessionId)!.events)).not.toContain(data)
    await expect(fixture.ctx.quantSkillsSessions.fileList({ sessionId })).resolves.toMatchObject({
      files: [attached],
      limits: fixture.fileLimits,
    })
    await expect(fixture.ctx.quantSkillsSessions.fileRead({
      sessionId,
      attachmentId: attached.file.attachmentId,
    })).resolves.toMatchObject({ text: '日期,收益\n2026-08-21,0.03\n' })

    const agent = fixture.ctx.agents.get(sessionId)!
    expect(fixture.ctx.tools.get('quantskills_read_attachment', agent)).toBeDefined()
    const result = await fixture.ctx.tools.execute({
      callId: 'call-read-attachment' as never,
      name: 'quantskills_read_attachment',
      arguments: { attachment_id: attached.file.attachmentId },
      agent,
      signal: new AbortController().signal,
    })
    expect(result).toMatchObject({ isError: false, content: [{ type: 'text', text: '日期,收益\n2026-08-21,0.03\n' }] })
    await fixture.ctx.fiber.dispose()
  })

  it('extracts bounded text from PDF, Office, and spreadsheet attachments', async () => {
    const fixture = await harness()
    const sessionId = await createBound(fixture, 'session-attachment-documents')
    const examples = [
      {
        bytes: pdfFixture(),
        mediaType: 'application/pdf',
        name: 'report.pdf',
        kind: 'pdf' as const,
        contains: 'QuantSkills PDF report',
      },
      {
        bytes: docxFixture(),
        mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        name: 'report.docx',
        kind: 'office-document' as const,
        contains: 'QuantSkills Office report',
      },
      {
        bytes: xlsxFixture(),
        mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        name: 'signals.xlsx',
        kind: 'spreadsheet' as const,
        contains: '000001',
      },
    ]
    for (const example of examples) {
      const attached = await fixture.ctx.quantSkillsSessions.fileAttach({
        sessionId,
        data: example.bytes.toString('base64'),
        mediaType: example.mediaType,
        name: example.name,
      })
      expect(attached.parsing).toEqual({ status: 'ready', kind: example.kind })
      const read = await fixture.ctx.quantSkillsSessions.fileRead({
        sessionId,
        attachmentId: attached.file.attachmentId,
      })
      expect(read.text).toContain(example.contains)
      expect(read.truncated).toBe(false)
    }
    await fixture.ctx.fiber.dispose()
  })

  it('retains document candidates and invalid-text objects without exposing invented content', async () => {
    const fixture = await harness()
    const sessionId = await createBound(fixture, 'session-attachment-unsupported')
    const pdf = await fixture.ctx.quantSkillsSessions.fileAttach({
      sessionId,
      data: Buffer.from('%PDF-1.7').toString('base64'),
      mediaType: 'application/pdf',
      name: 'report.pdf',
    })
    const invalid = await fixture.ctx.quantSkillsSessions.fileAttach({
      sessionId,
      data: Buffer.from([0xff, 0xfe]).toString('base64'),
      mediaType: 'text/plain',
      name: 'broken.txt',
    })

    expect(pdf.parsing).toEqual({ status: 'ready', kind: 'pdf' })
    expect(invalid.parsing.status).toBe('failed')
    await expect(fixture.ctx.quantSkillsSessions.fileRead({
      sessionId,
      attachmentId: pdf.file.attachmentId,
    })).rejects.toThrow('Invalid PDF structure')
    await expect(fixture.ctx.quantSkillsSessions.fileAttach({
      sessionId,
      data: 'not-base64',
      mediaType: 'text/plain',
      name: 'bad.txt',
    })).rejects.toThrow('canonical base64')
    await fixture.ctx.fiber.dispose()
  })

  it('serializes overlapping uploads before enforcing the Session aggregate limit', async () => {
    const fixture = await harness({ maxSessionFileBytes: 5 })
    const sessionId = await createBound(fixture, 'session-attachment-budget')
    const upload = (name: string) => fixture.ctx.quantSkillsSessions.fileAttach({
      sessionId,
      data: Buffer.from('four').toString('base64'),
      mediaType: 'text/plain',
      name,
    })
    const settled = await Promise.allSettled([upload('one.txt'), upload('two.txt')])

    expect(settled.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(settled.filter(result => result.status === 'rejected')).toHaveLength(1)
    expect((await fixture.ctx.quantSkillsSessions.fileList({ sessionId })).files).toHaveLength(1)
    await fixture.ctx.fiber.dispose()
  })
})

describe('QuantSkills result previews', () => {
  it('archives output from an exact installed Skill loaded successfully during the Session', async () => {
    const fixture = await harness()
    const installedRoot = await mkdtemp(join(tmpdir(), 'dsh-quantskills-dynamic-result-'))
    roots.push(installedRoot)
    const dynamicBase = join(installedRoot, 'dynamic', 'source')
    const unloggedBase = join(installedRoot, 'unlogged', 'source')
    const dynamicLegacy = join(dynamicBase, 'output', 'dynamic.md')
    const unloggedLegacy = join(unloggedBase, 'output', 'unlogged.md')
    await mkdir(dirname(dynamicLegacy), { recursive: true })
    await mkdir(dirname(unloggedLegacy), { recursive: true })
    await writeFile(dynamicLegacy, '# Dynamic Skill report\n')
    await writeFile(unloggedLegacy, '# Unlogged Skill report\n')
    const dynamicVersionId = `${secondAssetId}@${commitV1}` as QuantSkillsInstalledVersionId
    const unloggedVersionId = `${assetId}@${commitV2}` as QuantSkillsInstalledVersionId
    const dynamic = atResourceBase(
      resolved(commitV1, digestV1, 'dynamic Skill', secondAssetId),
      dynamicBase,
    )
    fixture.versions.set(dynamicVersionId, dynamic)
    fixture.versions.set(
      unloggedVersionId,
      atResourceBase(resolved(commitV2, digestV2, 'unlogged Skill'), unloggedBase),
    )
    const sessionId = await createBound(fixture, 'session-result-prepare-dynamic-skill')
    const session = fixture.ctx.agents.get(sessionId)!.session
    const callId = ToolCallId('call-load-dynamic-skill')
    session.append('turn/start', { turn: 1 })
    session.append('step/start', { turn: 1, step: 1 })
    session.append('assistant/message', {
      turn: 1,
      step: 1,
      message: createMessage({
        role: 'assistant',
        content: [{ type: 'tool-call', id: callId, name: 'skill', arguments: `{"name":"${secondAssetId}"}` }],
        source: { kind: 'model', provider: 'test', model: 'test' },
      }),
    }, { surfaceOp: 'append' })
    session.append('tool/call', {
      turn: 1,
      step: 1,
      callId,
      name: 'skill',
      arguments: `{"name":"${secondAssetId}"}`,
    })
    session.append('tool/result', {
      turn: 1,
      step: 1,
      message: createToolResultMessage({
        callId,
        isError: false,
        content: [{ type: 'text', text: renderSkillContent(dynamic.definition) }],
      }),
    }, { surfaceOp: 'append' })
    session.append('step/end', { turn: 1, step: 1 })
    const spoofCallId = ToolCallId('call-load-spoof-skill')
    session.append('step/start', { turn: 1, step: 2 })
    session.append('assistant/message', {
      turn: 1,
      step: 2,
      message: createMessage({
        role: 'assistant',
        content: [{ type: 'tool-call', id: spoofCallId, name: 'skill', arguments: '{"name":"spoof"}' }],
        source: { kind: 'model', provider: 'test', model: 'test' },
      }),
    }, { surfaceOp: 'append' })
    session.append('tool/call', {
      turn: 1,
      step: 2,
      callId: spoofCallId,
      name: 'skill',
      arguments: '{"name":"spoof"}',
    })
    session.append('tool/result', {
      turn: 1,
      step: 2,
      message: createToolResultMessage({
        callId: spoofCallId,
        isError: false,
        content: [{
          type: 'text',
          text: renderSkillContent({
            name: 'spoof',
            provider: 'test',
            resourceBase: { kind: 'opaque', description: 'runtime memory' },
            content: `<skill_resources>\nBase directory for this skill: ${unloggedBase}`,
          }),
        }],
      }),
    }, { surfaceOp: 'append' })
    session.append('step/end', { turn: 1, step: 2 })
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })

    await expect(fixture.ctx.quantSkillsSessions.resultPrepare({
      sessionId,
      paths: [dynamicLegacy, unloggedLegacy],
    })).resolves.toEqual({ results: [
      {
        status: 'ready',
        inputPath: dynamicLegacy,
        path: `output/quantskills/${secondAssetId}/${commitV1}/dynamic.md`,
        archived: true,
      },
      expect.objectContaining({ status: 'unavailable', inputPath: unloggedLegacy }),
    ] })
    await fixture.ctx.fiber.dispose()
  })

  it('normalizes workspace paths and idempotently archives exact Skill legacy output before preview', async () => {
    const fixture = await harness()
    const installedRoot = await mkdtemp(join(tmpdir(), 'dsh-quantskills-installed-'))
    roots.push(installedRoot)
    const resourceBase = join(installedRoot, 'source')
    const legacyPath = join(resourceBase, 'output', 'reports', 'legacy.md')
    await mkdir(dirname(legacyPath), { recursive: true })
    await writeFile(legacyPath, '# Legacy report\n')
    fixture.versions.set(
      `${assetId}@${commitV1}` as QuantSkillsInstalledVersionId,
      atResourceBase(resolved(commitV1, digestV1, 'version one'), resourceBase),
    )
    const sessionId = await createBound(fixture, 'session-result-prepare-skill')
    await mkdir(join(fixture.root, 'output'), { recursive: true })
    await writeFile(join(fixture.root, 'output', 'native.md'), '# Native report\n')

    const prepared = await fixture.ctx.quantSkillsSessions.resultPrepare({
      sessionId,
      paths: ['output/native.md', legacyPath, legacyPath],
    })
    const archivedPath = `output/quantskills/${assetId}/${commitV1}/reports/legacy.md`
    expect(prepared).toEqual({ results: [
      { status: 'ready', inputPath: 'output/native.md', path: 'output/native.md', archived: false },
      { status: 'ready', inputPath: legacyPath, path: archivedPath, archived: true },
      { status: 'ready', inputPath: legacyPath, path: archivedPath, archived: true },
    ] })
    expect(await readFile(join(fixture.root, ...archivedPath.split('/')), 'utf8')).toBe('# Legacy report\n')
    await expect(fixture.ctx.quantSkillsSessions.resultPreview({ sessionId, path: legacyPath }))
      .rejects.toThrow('escapes')
    await expect(fixture.ctx.quantSkillsSessions.resultPreview({ sessionId, path: archivedPath }))
      .resolves.toMatchObject({ kind: 'text', path: archivedPath, text: '# Legacy report\n' })
    await fixture.ctx.fiber.dispose()
  })

  it('restores verified result paths from a complete cold Session log', async () => {
    const fixture = await harness()
    const outsideRoot = await mkdtemp(join(tmpdir(), 'dsh-quantskills-produced-outside-'))
    roots.push(outsideRoot)
    const externalResult = join(outsideRoot, 'external-report.md')
    await writeFile(externalResult, '# External generated report\n')
    const externalArguments = JSON.stringify({ path: externalResult })
    const unregister = fixture.ctx.tools.register(defineTool({
      name: 'write_result_fixture',
      description: 'Test-only result writer presentation.',
      parameters: { path: { type: 'string', required: true } },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      execute: args => Promise.resolve(args.path),
      presentCall: args => ({
        card: 'generic',
        title: `Write ${args.path}`,
        kind: 'edit',
        locations: [{ path: args.path }],
      }),
    }))
    const sessionId = await createBound(fixture, 'session-result-list-cold-history')
    await mkdir(join(fixture.root, 'output', 'history'), { recursive: true })
    await writeFile(join(fixture.root, 'output', 'history', 'report.md'), '# Historical report\n')
    const session = fixture.ctx.agents.get(sessionId)!.session
    const callId = ToolCallId('call-write-historical-result')
    session.append('turn/start', { turn: 1 })
    session.append('step/start', { turn: 1, step: 1 })
    session.append('assistant/message', {
      turn: 1,
      step: 1,
      message: createMessage({
        role: 'assistant',
        content: [{
          type: 'tool-call',
          id: callId,
          name: 'write_result_fixture',
          arguments: externalArguments,
        }],
        source: { kind: 'model', provider: 'test', model: 'test' },
      }),
    }, { surfaceOp: 'append' })
    session.append('tool/call', {
      turn: 1,
      step: 1,
      callId,
      name: 'write_result_fixture',
      arguments: externalArguments,
    })
    session.append('tool/result', {
      turn: 1,
      step: 1,
      message: createToolResultMessage({
        callId,
        isError: false,
        content: [{ type: 'text', text: 'written' }],
      }),
    }, { surfaceOp: 'append' })
    session.append('step/end', { turn: 1, step: 1 })
    session.append('step/start', { turn: 1, step: 2 })
    session.append('assistant/message', {
      turn: 1,
      step: 2,
      message: createMessage({
        role: 'assistant',
        content: [{
          type: 'text',
          text: '交付 `output/history/report.md`；忽略 `../secret.md` 与根目录说明 `README.md`。',
        }],
        source: { kind: 'model', provider: 'test', model: 'test' },
      }),
    }, { surfaceOp: 'append' })
    session.append('step/end', { turn: 1, step: 2 })
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    await fixture.handles.get(sessionId)!.dispose()

    const listed = await fixture.ctx.quantSkillsSessions.resultList({ sessionId })
    expect(listed).toEqual({ results: [
      {
        status: 'ready',
        inputPath: 'output/history/report.md',
        path: 'output/history/report.md',
        archived: false,
      },
      {
        status: 'ready',
        inputPath: externalResult,
        path: expect.stringMatching(/^output\/quantskills\/session-files\/[\da-f]{16}\/external-report\.md$/u),
        archived: true,
      },
    ] })
    const archivedExternal = listed.results[1]!.path
    expect(await readFile(join(fixture.root, ...archivedExternal.split('/')), 'utf8'))
      .toBe('# External generated report\n')
    await expect(fixture.ctx.quantSkillsSessions.resultPreview({ sessionId, path: archivedExternal }))
      .resolves.toMatchObject({ kind: 'text', text: '# External generated report\n' })
    unregister()
    await fixture.ctx.fiber.dispose()
  })

  it('allows exact Agent, Team, and Team-member sources and diagnoses ambiguous relative legacy paths', async () => {
    const fixture = await harness()
    const installedRoot = await mkdtemp(join(tmpdir(), 'dsh-quantskills-installed-composition-'))
    roots.push(installedRoot)
    const alphaBase = join(installedRoot, 'alpha', 'source')
    const betaBase = join(installedRoot, 'beta', 'source')
    const alphaLegacy = join(alphaBase, 'output', 'alpha.md')
    const betaLegacy = join(betaBase, 'output', 'beta.md')
    const agentAlphaBase = join(installedRoot, 'agent-alpha', 'source')
    const agentBetaBase = join(installedRoot, 'agent-beta', 'source')
    const agentAlphaLegacy = join(agentAlphaBase, 'output', 'agent-alpha.md')
    const agentBetaLegacy = join(agentBetaBase, 'output', 'agent-beta.md')
    await mkdir(join(alphaBase, 'output'), { recursive: true })
    await mkdir(join(betaBase, 'output'), { recursive: true })
    await mkdir(join(agentAlphaBase, 'output'), { recursive: true })
    await mkdir(join(agentBetaBase, 'output'), { recursive: true })
    await writeFile(alphaLegacy, 'alpha')
    await writeFile(betaLegacy, 'beta')
    await writeFile(agentAlphaLegacy, 'agent alpha')
    await writeFile(agentBetaLegacy, 'agent beta')
    await writeFile(join(alphaBase, 'output', 'ambiguous.md'), 'alpha ambiguous')
    await writeFile(join(betaBase, 'output', 'ambiguous.md'), 'beta ambiguous')
    fixture.versions.set(
      `${assetId}@${commitV1}` as QuantSkillsInstalledVersionId,
      atResourceBase(resolved(commitV1, digestV1, 'version one'), alphaBase),
    )
    fixture.versions.set(
      `${secondAssetId}@${commitV1}` as QuantSkillsInstalledVersionId,
      atResourceBase(resolved(commitV1, digestV1, 'beta version', secondAssetId), betaBase),
    )
    const agentAlphaVersionId = `${agentAssetId}@${commitV1}` as QuantSkillsInstalledVersionId
    const agentBetaVersionId = `${secondAgentAssetId}@${commitV1}` as QuantSkillsInstalledVersionId
    fixture.agentTemplates.set(agentAlphaVersionId, agentTemplate(agentAssetId, commitV1))
    fixture.agentTemplates.set(agentBetaVersionId, agentTemplate(secondAgentAssetId, commitV1))
    fixture.agentResourceBases.set(agentAlphaVersionId, agentAlphaBase)
    fixture.agentResourceBases.set(agentBetaVersionId, agentBetaBase)
    const agentDefinition = await fixture.ctx.quantSkillsSessions.agentCreate({
      name: '双 Skill Agent',
      role: '验证 Agent 产物来源。',
      mode: 'dynamic',
      permission: 'workspace-write',
      sourceVersionId: agentAlphaVersionId,
      versionIds: [
        `${assetId}@${commitV1}` as QuantSkillsInstalledVersionId,
        `${secondAssetId}@${commitV1}` as QuantSkillsInstalledVersionId,
      ],
    })
    const agentSessionId = SessionId('session-result-prepare-agent')
    await fixture.ctx.quantSkillsSessions.agentSessionCreate({
      sessionId: agentSessionId,
      agentId: agentDefinition.agentId,
      expectedRevision: agentDefinition.revision,
    })
    await expect(fixture.ctx.quantSkillsSessions.resultPrepare({
      sessionId: agentSessionId,
      paths: [alphaLegacy, agentAlphaLegacy, 'ambiguous.md'],
    })).resolves.toEqual({ results: [
      {
        status: 'ready',
        inputPath: alphaLegacy,
        path: `output/quantskills/${assetId}/${commitV1}/alpha.md`,
        archived: true,
      },
      {
        status: 'ready',
        inputPath: agentAlphaLegacy,
        path: `output/quantskills/${agentAssetId}/${commitV1}/agent-alpha.md`,
        archived: true,
      },
      {
        status: 'unavailable',
        inputPath: 'ambiguous.md',
        reason: 'Relative legacy result path matches more than one installed Skill version.',
      },
    ] })

    const lead = await fixture.ctx.quantSkillsSessions.agentCreate({
      name: '产物 Lead',
      role: '协调成员产物。',
      mode: 'dynamic',
      permission: 'workspace-write',
      sourceVersionId: agentAlphaVersionId,
      versionIds: [`${assetId}@${commitV1}` as QuantSkillsInstalledVersionId],
    })
    const member = await fixture.ctx.quantSkillsSessions.agentCreate({
      name: '产物 Member',
      role: '生成成员产物。',
      mode: 'dynamic',
      permission: 'workspace-write',
      sourceVersionId: agentBetaVersionId,
      versionIds: [`${secondAssetId}@${commitV1}` as QuantSkillsInstalledVersionId],
    })
    const team = await fixture.ctx.quantSkillsSessions.agentTeamCreate({
      name: '产物团队',
      description: '验证 Lead 可以准备已声明成员 Skill 的旧产物。',
      leadAgentId: lead.agentId,
      leadAgentRevision: lead.revision,
      leadModel: { kind: 'default' },
      members: [{
        name: 'producer',
        agentId: member.agentId,
        agentRevision: member.revision,
        context: 'fresh',
        model: { kind: 'default' },
      }],
    })
    const teamSessionId = SessionId('session-result-prepare-team')
    await fixture.ctx.quantSkillsSessions.agentTeamSessionCreate({
      sessionId: teamSessionId,
      teamId: team.teamId,
      expectedRevision: team.revision,
    })
    await expect(fixture.ctx.quantSkillsSessions.resultPrepare({
      sessionId: teamSessionId,
      paths: [betaLegacy, agentAlphaLegacy, agentBetaLegacy],
    })).resolves.toEqual({ results: [
      {
        status: 'ready',
        inputPath: betaLegacy,
        path: `output/quantskills/${secondAssetId}/${commitV1}/beta.md`,
        archived: true,
      },
      {
        status: 'ready',
        inputPath: agentAlphaLegacy,
        path: `output/quantskills/${agentAssetId}/${commitV1}/agent-alpha.md`,
        archived: true,
      },
      {
        status: 'ready',
        inputPath: agentBetaLegacy,
        path: `output/quantskills/${secondAgentAssetId}/${commitV1}/agent-beta.md`,
        archived: true,
      },
    ] })
    const root = fixture.ctx.agents.get(teamSessionId)!
    const activated = await fixture.ctx.tools.execute({
      callId: 'call-result-prepare-member' as never,
      name: 'activate_team_member',
      arguments: { member: 'producer', task: '生成成员产物。' },
      agent: root,
      signal: new AbortController().signal,
    })
    const activationText = activated.content.find(block => block.type === 'text')
    if (activationText?.type !== 'text') throw new Error('activation result has no text')
    const activatedMember = JSON.parse(activationText.text) as { sessionId: string }
    await expect(fixture.ctx.quantSkillsSessions.resultPrepare({
      sessionId: SessionId(activatedMember.sessionId),
      paths: [agentBetaLegacy, agentAlphaLegacy],
    })).resolves.toEqual({ results: [
      {
        status: 'ready',
        inputPath: agentBetaLegacy,
        path: `output/quantskills/${secondAgentAssetId}/${commitV1}/agent-beta.md`,
        archived: true,
      },
      expect.objectContaining({
        status: 'unavailable',
        inputPath: agentAlphaLegacy,
      }),
    ] })
    await fixture.ctx.fiber.dispose()
  })

  it('rejects unowned, oversized, non-regular, and conflicting legacy results', async () => {
    const fixture = await harness({ maxResultArchiveBytes: 4 })
    const installedRoot = await mkdtemp(join(tmpdir(), 'dsh-quantskills-installed-invalid-'))
    const outsideRoot = await mkdtemp(join(tmpdir(), 'dsh-quantskills-unowned-'))
    roots.push(installedRoot, outsideRoot)
    const resourceBase = join(installedRoot, 'source')
    const outputRoot = join(resourceBase, 'output')
    await mkdir(join(outputRoot, 'directory'), { recursive: true })
    const oversized = join(outputRoot, 'oversized.md')
    const conflict = join(outputRoot, 'conflict.md')
    const outside = join(outsideRoot, 'outside.md')
    await writeFile(oversized, '12345')
    await writeFile(conflict, 'old')
    await writeFile(outside, 'outside')
    fixture.versions.set(
      `${assetId}@${commitV1}` as QuantSkillsInstalledVersionId,
      atResourceBase(resolved(commitV1, digestV1, 'version one'), resourceBase),
    )
    const sessionId = await createBound(fixture, 'session-result-prepare-rejections')
    const archiveConflict = join(
      fixture.root,
      'output',
      'quantskills',
      String(assetId),
      String(commitV1),
      'conflict.md',
    )
    await mkdir(dirname(archiveConflict), { recursive: true })
    await writeFile(archiveConflict, 'new')

    const prepared = await fixture.ctx.quantSkillsSessions.resultPrepare({
      sessionId,
      paths: [outside, oversized, join(outputRoot, 'directory'), conflict],
    })
    const [outsideResult, oversizedResult, directoryResult, conflictResult] = prepared.results
    expect(outsideResult).toMatchObject({ status: 'unavailable', inputPath: outside })
    expect(oversizedResult).toMatchObject({ status: 'unavailable', inputPath: oversized })
    expect(directoryResult).toMatchObject({ status: 'unavailable', inputPath: join(outputRoot, 'directory') })
    expect(conflictResult).toMatchObject({ status: 'unavailable', inputPath: conflict })
    if (oversizedResult?.status !== 'unavailable'
      || directoryResult?.status !== 'unavailable'
      || conflictResult?.status !== 'unavailable') {
      throw new Error('Expected unavailable result diagnostics.')
    }
    expect(oversizedResult.reason).toContain('archive limit')
    expect(directoryResult.reason).toContain('regular file')
    expect(conflictResult.reason).toContain('different file')
    expect(() => fixture.ctx.quantSkillsSessions.resultPrepare({
      sessionId,
      paths: Array.from({ length: 101 }, (_, index) => `output/${String(index)}.md`),
    })).toThrow('at most 100 paths')
    await fixture.ctx.fiber.dispose()
  })

  it('reads bounded text and verified image bytes only inside the Session workspace', async () => {
    const fixture = await harness()
    const sessionId = await createBound(fixture, 'session-result-preview')
    const cwd = fixture.ctx.sessions.get(sessionId)!.header.cwd!
    await mkdir(join(cwd, 'results'), { recursive: true })
    await writeFile(join(cwd, 'results', 'signals.csv'), 'symbol,score\n000001,0.8\n')
    await writeFile(join(cwd, 'results', 'dashboard.tsx'), 'export const Dashboard = () => <main>结果</main>\n')
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
    await writeFile(join(cwd, 'results', 'plot.png'), png)
    const document = docxFixture()
    await writeFile(join(cwd, 'results', 'report.docx'), document)

    await expect(fixture.ctx.quantSkillsSessions.resultPreview({
      sessionId,
      path: 'results/signals.csv',
    })).resolves.toEqual({
      kind: 'text',
      path: 'results/signals.csv',
      mediaType: 'text/csv',
      bytes: 24,
      text: 'symbol,score\n000001,0.8\n',
    })
    await expect(fixture.ctx.quantSkillsSessions.resultPreview({
      sessionId,
      path: 'results/dashboard.tsx',
    })).resolves.toEqual({
      kind: 'text',
      path: 'results/dashboard.tsx',
      mediaType: 'text/tsx',
      bytes: Buffer.byteLength('export const Dashboard = () => <main>结果</main>\n'),
      text: 'export const Dashboard = () => <main>结果</main>\n',
    })
    await expect(fixture.ctx.quantSkillsSessions.resultPreview({
      sessionId,
      path: 'results/plot.png',
    })).resolves.toEqual({
      kind: 'resource',
      presentation: 'image',
      url: expect.stringContaining('/api/quantskills.result.file?'),
      path: 'results/plot.png',
      mediaType: 'image/png',
      bytes: png.byteLength,
    })
    const documentPreview = await fixture.ctx.quantSkillsSessions.resultPreview({
      sessionId,
      path: 'results/report.docx',
    })
    expect(documentPreview).toMatchObject({
      kind: 'document',
      path: 'results/report.docx',
      mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      bytes: document.byteLength,
      truncated: false,
    })
    expect(documentPreview.kind === 'document' ? documentPreview.text : '').toContain('QuantSkills Office report')
    await expect(fixture.ctx.quantSkillsSessions.resultPreview({
      sessionId,
      path: join(cwd, '..', 'outside.csv'),
    })).rejects.toThrow('escapes')
    await fixture.ctx.fiber.dispose()
  })

  it('reports unsupported type, invalid signatures, and configured oversize files explicitly', async () => {
    const fixture = await harness()
    const sessionId = await createBound(fixture, 'session-result-unsupported')
    const cwd = fixture.ctx.sessions.get(sessionId)!.header.cwd!
    await writeFile(join(cwd, 'archive.zip'), 'not a preview')
    await writeFile(join(cwd, 'fake.pdf'), 'not a PDF')
    await writeFile(join(cwd, 'large.txt'), 'x'.repeat(2 * 1024 * 1024 + 1))

    const unknown = await fixture.ctx.quantSkillsSessions.resultPreview({
      sessionId,
      path: 'archive.zip',
    })
    expect(unknown).toMatchObject({ kind: 'resource', presentation: 'external' })
    const fake = await fixture.ctx.quantSkillsSessions.resultPreview({
      sessionId,
      path: 'fake.pdf',
    })
    expect(fake.kind).toBe('unsupported')
    if (fake.kind !== 'unsupported') throw new Error('unreachable')
    expect(fake.reason).toContain('do not match')
    const large = await fixture.ctx.quantSkillsSessions.resultPreview({
      sessionId,
      path: 'large.txt',
    })
    expect(large).toMatchObject({ kind: 'resource', presentation: 'text' })
    await fixture.ctx.fiber.dispose()
  })
})

describe('QuantSkills live-trading approval', () => {
  it('asks again for every configured live-order call and executes only one freshly granted call', async () => {
    const fixture = await harness({ liveTrading: true })
    const sessionId = await createBound(fixture, 'session-live-trading')
    const agent = fixture.ctx.agents.get(sessionId)!
    agent.session.append('turn/start', { turn: 1 })
    const outcomes: ApprovalOutcome[] = ['allowed-once', 'rejected', 'allowed-once']
    const asked: string[] = []
    fixture.ctx.on('approval/request', (request) => {
      asked.push(request.toolName)
      return Promise.resolve(outcomes.shift() ?? 'rejected')
    }, { prepend: true })
    const execute = (callId: string, orderId: string) => fixture.ctx.tools.execute({
      callId: callId as never,
      name: 'submit_live_order',
      arguments: { order_id: orderId },
      agent,
      signal: new AbortController().signal,
    })

    await expect(execute('call-order-1', 'order-1')).resolves.toMatchObject({ isError: false })
    await expect(execute('call-order-2', 'order-2')).resolves.toMatchObject({ isError: true })
    await expect(execute('call-order-3', 'order-3')).resolves.toMatchObject({ isError: false })
    expect(asked).toEqual(['submit_live_order', 'submit_live_order', 'submit_live_order'])
    expect(fixture.liveOrders).toEqual(['order-1', 'order-3'])
    expect(agent.session.events.filter(event => event.type === 'approval/asked')).toHaveLength(3)
    expect(agent.session.events.filter(event => event.type === 'approval/decided')).toHaveLength(3)
    await fixture.ctx.fiber.dispose()
  })
})

describe('QuantSkills user Agents', () => {
  it('creates and runs a role-only Agent without an installed Skill composition', async () => {
    const fixture = await harness()
    const definition = await fixture.ctx.quantSkillsSessions.agentCreate({
      name: '研究协调员',
      role: '先澄清目标，再使用会话基础能力组织研究。',
      mode: 'dynamic',
      versionIds: [],
    })
    expect(definition.skills).toEqual([])

    const sessionId = SessionId('role-only-agent-session')
    await fixture.ctx.quantSkillsSessions.agentSessionCreate({
      sessionId,
      agentId: definition.agentId,
      expectedRevision: definition.revision,
    })

    const agent = fixture.ctx.agents.get(sessionId)!
    expect(foldQuantSkillsAgentSession(agent.session.events)).toEqual(definition)
    expect(foldQuantSkillsPandaRuntimeBinding(agent.session.events)).toBeNull()
    expect(fixture.ctx.tools.get('quantskills_panda_python', agent)).toBeUndefined()
    const prompt = renderPrompt(await fixture.ctx.systemPrompt.assemble({ scope: agent }))
    expect(prompt).toContain('no resident Skill section is present')
    expect(prompt).toContain('Session base capabilities')
    expect(prompt).toContain('Write every generated artifact under `output/` in the current Session workspace.')
    await fixture.ctx.fiber.dispose()
  })

  it('exposes the exact installed Agent source form to its Session', async () => {
    const fixture = await harness()
    const sourceVersionId = `${agentAssetId}@${commitV1}` as QuantSkillsInstalledVersionId
    const promptForm = {
      status: 'ready',
      form: {
        version: 1,
        task: { required: true },
        fields: [{ key: 'universe', label: '股票池', type: 'text', default: '沪深300' }],
        promptTemplate: '目标：{{task}}\n股票池：{{universe}}',
      },
    } as const satisfies QuantSkillsPromptFormResult
    fixture.agentTemplates.set(sourceVersionId, agentTemplate(agentAssetId, commitV1, promptForm))
    const definition = await fixture.ctx.quantSkillsSessions.agentCreate({
      name: '公开 Agent 副本',
      role: '保留 {{task}} 原文。',
      mode: 'dynamic',
      sourceVersionId,
      versionIds: [],
    })
    const sessionId = SessionId('agent-source-prompt-form')
    await fixture.ctx.quantSkillsSessions.agentSessionCreate({
      sessionId,
      agentId: definition.agentId,
      expectedRevision: definition.revision,
    })

    await expect(fixture.ctx.quantSkillsSessions.promptFormList({ sessionId })).resolves.toEqual({
      forms: [{ assetId: agentAssetId, versionId: sourceVersionId, source: 'agent', promptForm }],
    })
    await expect(fixture.ctx.quantSkillsSessions.promptFormRender({
      sessionId,
      versionId: sourceVersionId,
      task: '筛选低波动股票',
      values: {},
    })).resolves.toEqual({ text: '目标：筛选低波动股票\n股票池：沪深300' })
    await fixture.ctx.fiber.dispose()
  })

  it('persists revisioned Agent CRUD with ordered exact Skill versions', async () => {
    const fixture = await harness()
    const created = await fixture.ctx.quantSkillsSessions.agentCreate({
      name: '双因子研究员',
      role: '分析用户目标并用可复核证据回答。',
      mode: 'dynamic',
      versionIds: [
        `${assetId}@${commitV1}` as QuantSkillsInstalledVersionId,
        `${secondAssetId}@${commitV1}` as QuantSkillsInstalledVersionId,
      ],
    })

    await expect(fixture.ctx.quantSkillsSessions.agentList()).resolves.toEqual([created])
    expect(created.revision).toBe(1)
    expect(created.skills.map(skill => skill.assetId)).toEqual([assetId, secondAssetId])

    const updated = await fixture.ctx.quantSkillsSessions.agentUpdate({
      agentId: created.agentId,
      expectedRevision: 1,
      name: '双因子研究员',
      role: '固定依次执行两项研究能力。',
      mode: 'fixed',
      versionIds: [
        `${secondAssetId}@${commitV1}` as QuantSkillsInstalledVersionId,
        `${assetId}@${commitV2}` as QuantSkillsInstalledVersionId,
      ],
    })
    expect(updated).toMatchObject({ revision: 2, mode: 'fixed' })
    expect(updated.skills.map(skill => skill.assetId)).toEqual([secondAssetId, assetId])
    await expect(fixture.ctx.quantSkillsSessions.agentDelete({
      agentId: created.agentId,
      expectedRevision: 1,
    })).rejects.toThrow('changed; refresh')
    await fixture.ctx.quantSkillsSessions.agentDelete({
      agentId: created.agentId,
      expectedRevision: 2,
    })
    await expect(fixture.ctx.quantSkillsSessions.agentList()).resolves.toEqual([])
    await fixture.ctx.fiber.dispose()
  })

  it('logs and reconstructs the complete model-visible Agent composition', async () => {
    const fixture = await harness()
    const literalRole = '先保留 {{model}}，再按 {{#task}}用户任务{{/task}} 执行。'
    const definition = await fixture.ctx.quantSkillsSessions.agentCreate({
      name: '量化研究助理',
      role: literalRole,
      mode: 'fixed',
      versionIds: [
        `${assetId}@${commitV1}` as QuantSkillsInstalledVersionId,
        `${secondAssetId}@${commitV1}` as QuantSkillsInstalledVersionId,
      ],
    })
    const sessionId = SessionId('agent-session')
    await fixture.ctx.quantSkillsSessions.agentSessionCreate({
      sessionId,
      agentId: definition.agentId,
      expectedRevision: definition.revision,
    })

    const agent = fixture.ctx.agents.get(sessionId)!
    expect(foldQuantSkillsSessionBinding(agent.session.events)).toBeNull()
    expect(foldQuantSkillsAgentSession(agent.session.events)).toEqual(definition)
    expect(agent.session.events.filter(event => event.type === 'quantskills/agent-session')).toHaveLength(1)
    await expect(fixture.ctx.skills.get(assetId, { scope: agent })).resolves.toMatchObject({ content: 'version one' })
    await expect(fixture.ctx.skills.get(secondAssetId, { scope: agent }))
      .resolves.toMatchObject({ content: 'beta version' })
    const prompt = renderPrompt(await fixture.ctx.systemPrompt.assemble({ scope: agent }))
    expect(prompt).toContain('量化研究助理')
    expect(prompt).toContain(literalRole)
    expect(prompt).toContain('version one')
    expect(prompt).toContain('beta version')
    expect(prompt.indexOf('version one')).toBeLessThan(prompt.indexOf('beta version'))

    await fixture.ctx.quantSkillsSessions.residentSkillDetach({ sessionId, assetId })
    await fixture.ctx.quantSkillsSessions.residentSkillAttach({
      sessionId,
      versionId: `${assetId}@${commitV2}` as QuantSkillsInstalledVersionId,
    })
    const updatedPrompt = renderPrompt(await fixture.ctx.systemPrompt.assemble({ scope: agent }))
    expect(updatedPrompt).not.toContain('version one')
    expect(updatedPrompt).toContain('version two')
    expect(updatedPrompt).toContain('beta version')

    const archives = await fixture.ctx.quantSkillsSessions.agentSessionList({})
    expect(archives).toHaveLength(1)
    expect(archives[0]).toMatchObject({ sessionId, agent: definition, running: false })
    Object.assign(agent, { status: 'running' })
    await expect(fixture.ctx.quantSkillsSessions.agentSessionList({}))
      .resolves.toEqual([expect.objectContaining({ sessionId, running: true })])
    Object.assign(agent, { status: 'idle' })
    await fixture.handles.get(sessionId)!.dispose()
    const updated = await fixture.ctx.quantSkillsSessions.agentUpdate({
      agentId: definition.agentId,
      expectedRevision: definition.revision,
      name: '已更新研究助理',
      role: '只影响之后新建的 Agent 会话。',
      mode: 'dynamic',
      versionIds: [`${assetId}@${commitV2}` as QuantSkillsInstalledVersionId],
    })
    await expect(fixture.ctx.quantSkillsSessions.agentSessionCreate({
      sessionId,
      agentId: definition.agentId,
      expectedRevision: definition.revision,
    })).resolves.toMatchObject({ sessionId, agent: definition })
    await fixture.handles.get(sessionId)!.dispose()
    await fixture.ctx.quantSkillsSessions.agentDelete({
      agentId: definition.agentId,
      expectedRevision: updated.revision,
    })
    await expect(fixture.ctx.quantSkillsSessions.agentSessionCreate({
      sessionId,
      agentId: definition.agentId,
      expectedRevision: definition.revision,
    })).resolves.toMatchObject({ sessionId, agent: definition })
    await expect(fixture.ctx.quantSkillsSessions.agentSessionCreate({
      sessionId,
      agentId: definition.agentId,
      expectedRevision: definition.revision + 1,
    })).rejects.toThrow('another composition')

    await fixture.handles.get(sessionId)!.dispose()
    await fixture.sessionController.create({ sessionId })
    await fixture.ctx.quantSkillsSessions.sessionEnsure({ sessionId })
    const resumed = fixture.ctx.agents.get(sessionId)!
    expect(foldQuantSkillsAgentSession(resumed.session.events)).toEqual(definition)
    expect(renderPrompt(await fixture.ctx.systemPrompt.assemble({ scope: resumed }))).toContain(literalRole)
    await expect(fixture.ctx.skills.get(secondAssetId, { scope: resumed }))
      .resolves.toMatchObject({ content: 'beta version' })
    await expect(fixture.ctx.skills.get(assetId, { scope: resumed }))
      .resolves.toMatchObject({ content: 'version two' })
    await fixture.ctx.fiber.dispose()
  })

  it('forks the logged Agent role and every exact Skill provider', async () => {
    const fixture = await harness()
    const definition = await fixture.ctx.quantSkillsSessions.agentCreate({
      name: '双 Skill 研究员',
      role: '保留证据并说明结论限制。',
      mode: 'dynamic',
      versionIds: [
        `${assetId}@${commitV1}` as QuantSkillsInstalledVersionId,
        `${secondAssetId}@${commitV1}` as QuantSkillsInstalledVersionId,
      ],
    })
    const sourceId = SessionId('agent-fork-source')
    await fixture.ctx.quantSkillsSessions.agentSessionCreate({
      sessionId: sourceId,
      agentId: definition.agentId,
      expectedRevision: definition.revision,
    })
    const source = fixture.ctx.sessions.get(sourceId)!
    source.append('turn/start', { turn: 1 })
    source.append('turn/end', { turn: 1, reason: { kind: 'completed' } })

    const response = await fixture.sessionController.fork({ sessionId: sourceId })
    await fixture.ctx.quantSkillsSessions.sessionEnsure({ sessionId: response.sessionId })
    const child = fixture.ctx.agents.get(response.sessionId)!
    expect(foldQuantSkillsAgentSession(child.session.events)).toEqual(definition)
    expect(foldQuantSkillsSessionBinding(child.session.events)).toBeNull()
    expect(child.session.events.filter(event => event.type === 'quantskills/agent-session')).toHaveLength(1)
    await expect(fixture.ctx.skills.get(assetId, { scope: child })).resolves.toMatchObject({ content: 'version one' })
    await expect(fixture.ctx.skills.get(secondAssetId, { scope: child }))
      .resolves.toMatchObject({ content: 'beta version' })
    const prompt = renderPrompt(await fixture.ctx.systemPrompt.assemble({ scope: child }))
    expect(prompt).toContain(definition.role)
    expect(prompt).toContain('version one')
    expect(prompt).toContain('beta version')
    await fixture.ctx.fiber.dispose()
  })

  it('fails closed for a missing logged version and duplicate or mixed Agent events', async () => {
    const fixture = await harness()
    const definition = await fixture.ctx.quantSkillsSessions.agentCreate({
      name: '恢复校验 Agent',
      role: '只使用日志记录的精确能力。',
      mode: 'fixed',
      versionIds: [`${assetId}@${commitV1}` as QuantSkillsInstalledVersionId],
    })
    const missingId = SessionId('agent-missing-version')
    await fixture.ctx.quantSkillsSessions.agentSessionCreate({
      sessionId: missingId,
      agentId: definition.agentId,
      expectedRevision: definition.revision,
    })
    await fixture.handles.get(missingId)!.dispose()
    fixture.versions.delete(`${assetId}@${commitV1}` as QuantSkillsInstalledVersionId)
    await fixture.sessionController.create({ sessionId: missingId })
    await expect(fixture.ctx.quantSkillsSessions.sessionEnsure({ sessionId: missingId }))
      .rejects.toThrow('not found')
    fixture.versions.set(
      `${assetId}@${commitV1}` as QuantSkillsInstalledVersionId,
      resolved(commitV1, digestV1, 'version one'),
    )

    const duplicateId = SessionId('agent-duplicate-event')
    await fixture.ctx.quantSkillsSessions.agentSessionCreate({
      sessionId: duplicateId,
      agentId: definition.agentId,
      expectedRevision: definition.revision,
    })
    fixture.ctx.sessions.get(duplicateId)!.append('quantskills/agent-session', definition)
    expect(() => foldQuantSkillsAgentSession(fixture.ctx.sessions.get(duplicateId)!.events))
      .toThrow('more than one quantskills/agent-session event')
    await fixture.handles.get(duplicateId)!.dispose()

    const mixedId = SessionId('agent-mixed-event')
    await fixture.ctx.quantSkillsSessions.agentSessionCreate({
      sessionId: mixedId,
      agentId: definition.agentId,
      expectedRevision: definition.revision,
    })
    fixture.ctx.sessions.get(mixedId)!.append('quantskills/session-bound', definition.skills[0]!)
    expect(() => foldQuantSkillsResidentSkills(fixture.ctx.sessions.get(mixedId)!.events))
      .toThrow('must precede resident Skill transitions')
    await fixture.ctx.fiber.dispose()
  })
})

describe('QuantSkills local authoring', () => {
  it.each([
    { kind: 'skill' as const, declaration: 'SKILL.md' as const, assetId: 'skill-local-risk' },
    { kind: 'agent' as const, declaration: 'AGENTS.md' as const, assetId: 'agent-local-risk' },
  ])('prepares and commits a local $kind only after a logged confirmation', async ({
    kind, declaration, assetId: localAssetId,
  }) => {
    const fixture = await harness()
    const authoring = await fixture.ctx.quantSkillsSessions.agentCreate({
      name: `内部 ${kind} 助手`,
      role: '准备本地草案，未经用户确认不得保存。',
      mode: 'dynamic',
      permission: 'workspace-write',
      versionIds: [],
    })
    const draftPath = join('quantskills-drafts', kind, localAssetId)
    const draftRoot = join(fixture.root, draftPath)
    await mkdir(draftRoot, { recursive: true })
    await writeFile(join(draftRoot, declaration), `# ${localAssetId}\n\nLocal ${kind} declaration.\n`)
    const sessionId = SessionId(`local-${kind}-authoring`)
    await fixture.ctx.quantSkillsSessions.authoringSessionCreate({
      sessionId,
      agentId: authoring.agentId,
      expectedRevision: authoring.revision,
      kind,
      cwd: fixture.root,
    })
    const authoringAgent = fixture.ctx.agents.get(sessionId)!
    expect(foldQuantSkillsPandaRuntimeBinding(authoringAgent.session.events)).toBeNull()
    expect(fixture.ctx.tools.get('quantskills_panda_python', authoringAgent)).toBeUndefined()
    const tool = fixture.ctx.tools.get('quantskills_asset_draft', authoringAgent)
    expect(tool).toBeDefined()
    const callId = ToolCallId(`call-${kind}-draft`)
    const prepared = await fixture.ctx.tools.execute({
      callId,
      name: 'quantskills_asset_draft',
      arguments: { action: 'prepare', path: draftPath },
      agent: authoringAgent,
      signal: new AbortController().signal,
    })
    expect(prepared.isError).toBe(false)
    const text = prepared.content.filter(block => block.type === 'text').map(block => block.text).join('')
    const value = JSON.parse(text) as { draft: { treeDigest: QuantSkillsTreeDigest } }
    expect(foldQuantSkillsAuthoringCommitted(authoringAgent.session.events)).toEqual([])
    appendLoggedToolResult(authoringAgent.session, callId, 'quantskills_asset_draft', text)

    const committed = await fixture.ctx.quantSkillsSessions.authoringCommit({
      sessionId,
      toolCallId: callId,
      expectedTreeDigest: value.draft.treeDigest,
    })
    expect(committed.kind).toBe(kind)
    if (committed.kind === 'agent') {
      expect(committed.version).toMatchObject({ assetId: localAssetId, origin: 'local-authoring' })
      expect(committed.agent.sourceVersionId).toContain(`${localAssetId}@`)
    } else {
      expect(committed).toMatchObject({
        kind: 'skill',
        version: { assetId: localAssetId, origin: 'local-authoring' },
      })
    }
    await expect(fixture.ctx.quantSkillsSessions.authoringCommit({
      sessionId,
      toolCallId: callId,
      expectedTreeDigest: value.draft.treeDigest,
    })).resolves.toEqual(committed)
    expect(foldQuantSkillsAuthoringCommitted(authoringAgent.session.events)).toHaveLength(1)
    await fixture.ctx.fiber.dispose()
  })

  it('rejects a draft changed after the confirmation card was rendered', async () => {
    const fixture = await harness()
    const authoring = await fixture.ctx.quantSkillsSessions.agentCreate({
      name: '内容变更检查助手',
      role: '验证提交摘要。',
      mode: 'dynamic',
      permission: 'workspace-write',
      versionIds: [],
    })
    const draftPath = join('quantskills-drafts', 'skill', 'skill-changing')
    const draftRoot = join(fixture.root, draftPath)
    await mkdir(draftRoot, { recursive: true })
    await writeFile(join(draftRoot, 'SKILL.md'), '# Original\n')
    const sessionId = SessionId('changed-skill-authoring')
    await fixture.ctx.quantSkillsSessions.authoringSessionCreate({
      sessionId,
      agentId: authoring.agentId,
      expectedRevision: authoring.revision,
      kind: 'skill',
      cwd: fixture.root,
    })
    const agent = fixture.ctx.agents.get(sessionId)!
    const callId = ToolCallId('call-changing-draft')
    const prepared = await fixture.ctx.tools.execute({
      callId,
      name: 'quantskills_asset_draft',
      arguments: { action: 'prepare', path: draftPath },
      agent,
      signal: new AbortController().signal,
    })
    const text = prepared.content.filter(block => block.type === 'text').map(block => block.text).join('')
    const value = JSON.parse(text) as { draft: { treeDigest: QuantSkillsTreeDigest } }
    appendLoggedToolResult(agent.session, callId, 'quantskills_asset_draft', text)
    await writeFile(join(draftRoot, 'SKILL.md'), '# Changed\n')
    await expect(fixture.ctx.quantSkillsSessions.authoringCommit({
      sessionId,
      toolCallId: callId,
      expectedTreeDigest: value.draft.treeDigest,
    })).rejects.toThrow('draft changed')
    expect(foldQuantSkillsAuthoringCommitted(agent.session.events)).toEqual([])
    await fixture.ctx.fiber.dispose()
  })
})

describe('QuantSkills Agent Teams', () => {
  it('validates a saved Team against exact Agent revisions and inherited execution settings', async () => {
    const fixture = await harness()
    const lead = await fixture.ctx.quantSkillsSessions.agentCreate({
      name: '首席研究员',
      role: '拆解目标、分派任务并综合团队结论。',
      mode: 'dynamic',
      model: { provider: 'test', model: 'test' },
      permission: 'workspace-write',
      versionIds: [`${assetId}@${commitV1}` as QuantSkillsInstalledVersionId],
    })
    const member = await fixture.ctx.quantSkillsSessions.agentCreate({
      name: '因子验证员',
      role: '验证因子计算并报告可复核证据。',
      mode: 'fixed',
      model: { provider: 'test', model: 'test' },
      permission: 'workspace-write',
      versionIds: [`${secondAssetId}@${commitV1}` as QuantSkillsInstalledVersionId],
    })
    const incompatible = await fixture.ctx.quantSkillsSessions.agentCreate({
      name: '只读审计员',
      role: '只读取结果并检查风险。',
      mode: 'dynamic',
      model: { provider: 'test', model: 'test' },
      permission: 'read-only',
      versionIds: [],
    })

    await expect(fixture.ctx.quantSkillsSessions.agentTeamCreate({
      name: '非法名称团队',
      description: '校验成员名称。',
      leadAgentId: lead.agentId,
      leadAgentRevision: lead.revision,
      leadModel: { kind: 'default' },
      members: [{
        name: 'Bad Name',
        agentId: member.agentId,
        agentRevision: member.revision,
        context: 'fresh',
        model: { kind: 'default' },
      }],
    })).rejects.toThrow('lower-kebab-case')
    await expect(fixture.ctx.quantSkillsSessions.agentTeamCreate({
      name: '权限不一致团队',
      description: '校验继承的运行设置。',
      leadAgentId: lead.agentId,
      leadAgentRevision: lead.revision,
      leadModel: { kind: 'default' },
      members: [{
        name: 'auditor',
        agentId: incompatible.agentId,
        agentRevision: incompatible.revision,
        context: 'fresh',
        model: { kind: 'default' },
      }],
    })).rejects.toThrow('same permission preset')
    await expect(fixture.ctx.quantSkillsSessions.agentTeamCreate({
      name: '过期引用团队',
      description: '校验 Agent 乐观版本。',
      leadAgentId: lead.agentId,
      leadAgentRevision: lead.revision + 1,
      leadModel: { kind: 'default' },
      members: [{
        name: 'validator',
        agentId: member.agentId,
        agentRevision: member.revision,
        context: 'fresh',
        model: { kind: 'default' },
      }],
    })).rejects.toThrow('changed; refresh')
    await fixture.ctx.fiber.dispose()
  })

  it('exposes a read-only Team draft tool only to the Agent Team authoring Session', async () => {
    const fixture = await harness()
    const lead = await fixture.ctx.quantSkillsSessions.agentCreate({
      name: 'Lead 研究员',
      role: '拆解任务并汇总结果。',
      mode: 'dynamic',
      permission: 'workspace-write',
      versionIds: [],
    })
    const member = await fixture.ctx.quantSkillsSessions.agentCreate({
      name: '验证员',
      role: '验证证据并给出可复核结论。',
      mode: 'fixed',
      permission: 'workspace-write',
      versionIds: [],
    })
    const authoring = await fixture.ctx.quantSkillsSessions.agentCreate({
      name: '任意命名的内部创作助手',
      role: '询问用户并准备团队草案，未经确认不得创建。',
      mode: 'dynamic',
      permission: 'workspace-write',
      versionIds: [],
    })
    const authoringSessionId = SessionId('agent-team-authoring-session')
    await fixture.ctx.quantSkillsSessions.authoringSessionCreate({
      sessionId: authoringSessionId,
      agentId: authoring.agentId,
      expectedRevision: authoring.revision,
      kind: 'agent-team',
    })
    const authoringAgent = fixture.ctx.agents.get(authoringSessionId)!
    expect(fixture.ctx.tools.get('quantskills_team_draft', authoringAgent)).toBeDefined()
    expect(foldQuantSkillsAuthoringStarted(authoringAgent.session.events)).toBe('agent-team')

    const createMembers = () => fixture.ctx.tools.execute({
      callId: 'call-create-members' as never, name: 'quantskills_team_draft',
      arguments: { action: 'create-agents', agents: [{ name: '自动创建的验证成员', role: '检查结果与来源。' }] },
      agent: authoringAgent, signal: new AbortController().signal,
    })
    expect((await createMembers()).isError).toBe(false)
    expect((await createMembers()).isError).toBe(false)
    const createdMembers = (await fixture.ctx.quantSkillsSessions.agentList()).filter(item => item.name === '自动创建的验证成员')
    expect(createdMembers).toHaveLength(1)
    expect(createdMembers[0]?.permission).toBe('read-only')
    expect(await fixture.ctx.quantSkillsSessions.agentLibrarySources()).toContainEqual(expect.objectContaining({ id: createdMembers[0]!.agentId, source: 'personal', method: 'ai' }))

    const listed = await fixture.ctx.tools.execute({
      callId: 'call-list-team-agents' as never,
      name: 'quantskills_team_draft',
      arguments: { action: 'list-agents' },
      agent: authoringAgent,
      signal: new AbortController().signal,
    })
    expect(listed.isError).toBe(false)
    const listedText = listed.content.find(block => block.type === 'text')
    const listedValue = JSON.parse(listedText?.type === 'text' ? listedText.text : '{}') as {
      kind: string
      agents: { agentId: string; revision: number }[]
    }
    expect(listedValue.kind).toBe('agents')
    expect(listedValue.agents).toEqual(expect.arrayContaining([
      expect.objectContaining({ agentId: lead.agentId, revision: lead.revision }),
      expect.objectContaining({ agentId: member.agentId, revision: member.revision }),
    ]))

    const prepared = await fixture.ctx.tools.execute({
      callId: 'call-prepare-team-draft' as never,
      name: 'quantskills_team_draft',
      arguments: {
        action: 'prepare',
        draft: {
          name: '审查团队',
          description: '由 Lead 分派任务，验证员交付证据。',
          leadAgentId: lead.agentId,
          leadModel: { kind: 'fixed', selection: { provider: 'test', model: 'lead-model', reasoningEffort: 'high' } },
          members: [{
            name: 'validator',
            agentId: member.agentId,
            responsibility: '验证数据与结论，并返回可复核证据。',
            context: 'fresh',
            model: { kind: 'fixed', selection: { provider: 'test', model: 'member-model', reasoningEffort: 'high' } },
          }],
        },
      },
      agent: authoringAgent,
      signal: new AbortController().signal,
    })
    expect(prepared.isError).toBe(false)
    const preparedText = prepared.content.find(block => block.type === 'text')
    const preparedValue = JSON.parse(preparedText?.type === 'text' ? preparedText.text : '{}') as {
      treeDigest: QuantSkillsTreeDigest
      draft: {
        lead: { agentId: string; revision: number }
        members: { responsibility: string; agent: { agentId: string; revision: number } }[]
      }
    }
    expect(preparedValue.draft).toMatchObject({
      lead: { agentId: lead.agentId, revision: lead.revision },
      leadModel: { kind: 'fixed', selection: { provider: 'test', model: 'lead-model', reasoningEffort: 'high' } },
      members: [{
        responsibility: '验证数据与结论，并返回可复核证据。',
        agent: { agentId: member.agentId, revision: member.revision },
        model: { kind: 'fixed', selection: { provider: 'test', model: 'member-model', reasoningEffort: 'high' } },
      }],
    })
    await expect(fixture.ctx.quantSkillsSessions.agentTeamList()).resolves.toEqual([])

    const commitCallId = ToolCallId('call-prepare-team-draft')
    appendLoggedToolResult(
      authoringAgent.session,
      commitCallId,
      'quantskills_team_draft',
      JSON.stringify(preparedValue),
    )
    const committed = await fixture.ctx.quantSkillsSessions.authoringCommit({
      sessionId: authoringSessionId,
      toolCallId: commitCallId,
      expectedTreeDigest: preparedValue.treeDigest,
    })
    expect(committed).toMatchObject({ kind: 'agent-team', team: { revision: 1, name: '审查团队' } })
    await expect(fixture.ctx.quantSkillsSessions.authoringCommit({
      sessionId: authoringSessionId,
      toolCallId: commitCallId,
      expectedTreeDigest: preparedValue.treeDigest,
    })).resolves.toEqual(committed)
    expect(foldQuantSkillsAuthoringCommitted(authoringAgent.session.events)).toHaveLength(1)

    const ordinarySessionId = SessionId('ordinary-agent-session')
    await fixture.ctx.quantSkillsSessions.agentSessionCreate({
      sessionId: ordinarySessionId,
      agentId: lead.agentId,
      expectedRevision: lead.revision,
    })
    expect(fixture.ctx.tools.get(
      'quantskills_team_draft',
      fixture.ctx.agents.get(ordinarySessionId),
    )).toBeUndefined()
    await fixture.ctx.fiber.dispose()
  })

  it('freezes complete Agent snapshots and preserves optimistic Team CRUD', async () => {
    const fixture = await harness()
    const lead = await fixture.ctx.quantSkillsSessions.agentCreate({
      name: '团队负责人',
      role: '根据目标调度团队。',
      mode: 'dynamic',
      permission: 'workspace-write',
      versionIds: [`${assetId}@${commitV1}` as QuantSkillsInstalledVersionId],
    })
    const member = await fixture.ctx.quantSkillsSessions.agentCreate({
      name: '原始成员',
      role: '执行原始版本的验证职责。',
      mode: 'fixed',
      permission: 'workspace-write',
      versionIds: [`${secondAssetId}@${commitV1}` as QuantSkillsInstalledVersionId],
    })
    const created = await fixture.ctx.quantSkillsSessions.agentTeamCreate({
      name: '版本冻结研究团队',
      description: '保存每个角色的完整不可变 Agent 与 Skill 版本。',
      leadAgentId: lead.agentId,
      leadAgentRevision: lead.revision,
      leadModel: { kind: 'default' },
      members: [{
        name: 'validator',
        agentId: member.agentId,
        agentRevision: member.revision,
        context: 'fresh',
        model: { kind: 'default' },
      }],
    })
    expect(created).toMatchObject({ revision: 1, lead, members: [{ name: 'validator', agent: member }] })
    expect(await fixture.ctx.quantSkillsSessions.agentLibrarySources()).toContainEqual({ id: created.teamId, kind: 'agent-team', source: 'personal', method: 'manual' })
    // An older save without provenance must reappear in My creations, without
    // rewriting frozen composition or creating a second team.
    await writeFile(join(fixture.root, 'quantskills', 'library-sources.json'), JSON.stringify({ schemaVersion: 1, entries: [] }))
    expect(await fixture.ctx.quantSkillsSessions.agentLibrarySources()).toContainEqual({ id: created.teamId, kind: 'agent-team', source: 'personal', method: 'recovered' })
    expect(await fixture.ctx.quantSkillsSessions.agentTeamList()).toEqual([created])
    await fixture.ctx.quantSkillsSessions.agentUpdate({
      agentId: member.agentId,
      expectedRevision: member.revision,
      name: '新版成员',
      role: '这项修改只影响以后重新保存的 Team。',
      mode: 'dynamic',
      permission: 'workspace-write',
      versionIds: [],
    })
    await expect(fixture.ctx.quantSkillsSessions.agentTeamList()).resolves.toEqual([created])

    const updated = await fixture.ctx.quantSkillsSessions.agentTeamUpdate({
      teamId: created.teamId,
      expectedRevision: created.revision,
      name: '版本冻结研究团队 2',
      description: '仍然使用显式选择的 Agent 修订版。',
      leadAgentId: lead.agentId,
      leadAgentRevision: lead.revision,
      leadModel: { kind: 'default' },
      members: [{
        name: 'validator',
        agentId: member.agentId,
        agentRevision: member.revision + 1,
        context: 'fork',
        model: { kind: 'default' },
      }],
    })
    expect(updated).toMatchObject({ revision: 2, members: [{ context: 'fork', agent: { revision: 2 } }] })
    await expect(fixture.ctx.quantSkillsSessions.agentTeamDelete({
      teamId: created.teamId,
      expectedRevision: 1,
    })).rejects.toThrow('changed; refresh')
    await fixture.ctx.quantSkillsSessions.agentTeamDelete({
      teamId: created.teamId,
      expectedRevision: 2,
    })
    await expect(fixture.ctx.quantSkillsSessions.agentTeamList()).resolves.toEqual([])
    await fixture.ctx.fiber.dispose()
  })

  it('lists exact source forms from the Team Lead and every declared member', async () => {
    const fixture = await harness()
    const leadVersionId = `${agentAssetId}@${commitV1}` as QuantSkillsInstalledVersionId
    const memberVersionId = `${secondAgentAssetId}@${commitV1}` as QuantSkillsInstalledVersionId
    const leadForm = {
      status: 'ready',
      form: { version: 1, fields: [], promptTemplate: 'Lead：{{task}}' },
    } as const satisfies QuantSkillsPromptFormResult
    const memberForm = {
      status: 'ready',
      form: { version: 1, fields: [], promptTemplate: 'Member：{{task}}' },
    } as const satisfies QuantSkillsPromptFormResult
    fixture.agentTemplates.set(leadVersionId, agentTemplate(agentAssetId, commitV1, leadForm))
    fixture.agentTemplates.set(memberVersionId, agentTemplate(secondAgentAssetId, commitV1, memberForm))
    const lead = await fixture.ctx.quantSkillsSessions.agentCreate({
      name: '表单 Lead',
      role: '协调。',
      mode: 'dynamic',
      model: { provider: 'test', model: 'test' },
      permission: 'workspace-write',
      sourceVersionId: leadVersionId,
      versionIds: [],
    })
    const member = await fixture.ctx.quantSkillsSessions.agentCreate({
      name: '表单 Member',
      role: '执行。',
      mode: 'dynamic',
      model: { provider: 'test', model: 'test' },
      permission: 'workspace-write',
      sourceVersionId: memberVersionId,
      versionIds: [],
    })
    const team = await fixture.ctx.quantSkillsSessions.agentTeamCreate({
      name: '表单团队',
      description: '验证来源表单。',
      leadAgentId: lead.agentId,
      leadAgentRevision: lead.revision,
      leadModel: { kind: 'default' },
      members: [{
        name: 'form-member',
        agentId: member.agentId,
        agentRevision: member.revision,
        context: 'fresh',
        model: { kind: 'default' },
      }],
    })
    const sessionId = SessionId('agent-team-source-prompt-forms')
    await fixture.ctx.quantSkillsSessions.agentTeamSessionCreate({
      sessionId,
      teamId: team.teamId,
      expectedRevision: team.revision,
    })

    await expect(fixture.ctx.quantSkillsSessions.promptFormList({ sessionId })).resolves.toEqual({ forms: [
      { assetId: agentAssetId, versionId: leadVersionId, source: 'agent', promptForm: leadForm },
      { assetId: secondAgentAssetId, versionId: memberVersionId, source: 'agent', promptForm: memberForm },
    ] })
    await fixture.ctx.fiber.dispose()
  })

  it('runs a Team Lead, hot-starts only declared members, and restores exact member composition', async () => {
    const fixture = await harness()
    const leadRole = '拆分 {{task}} 并保留 {{lead_note}}，等待关键成员完成后汇总。'
    const memberRole = '独立验证 {{#signal}}信号{{/signal}} 并向 Lead 报告。'
    const teamDescription = 'Lead 协调 {{team_goal}} 与一个独立验证成员完成并行研究。'
    const lead = await fixture.ctx.quantSkillsSessions.agentCreate({
      name: '量化研究 Lead',
      role: leadRole,
      mode: 'dynamic',
      model: { provider: 'test', model: 'test' },
      permission: 'workspace-write',
      versionIds: [`${assetId}@${commitV1}` as QuantSkillsInstalledVersionId],
    })
    const member = await fixture.ctx.quantSkillsSessions.agentCreate({
      name: '信号验证员',
      role: memberRole,
      mode: 'fixed',
      model: { provider: 'test', model: 'test' },
      permission: 'workspace-write',
      versionIds: [`${secondAssetId}@${commitV1}` as QuantSkillsInstalledVersionId],
    })
    const team = await fixture.ctx.quantSkillsSessions.agentTeamCreate({
      name: '因子研究团队',
      description: teamDescription,
      leadAgentId: lead.agentId,
      leadAgentRevision: lead.revision,
      leadModel: {
        kind: 'fixed',
        selection: { provider: 'test', model: 'lead-model', reasoningEffort: 'high' },
      },
      members: [{
        name: 'signal-validator',
        agentId: member.agentId,
        agentRevision: member.revision,
        context: 'fresh',
        model: {
          kind: 'fixed',
          selection: { provider: 'test', model: 'member-model', reasoningEffort: 'high' },
        },
      }],
    })
    const sessionId = SessionId('agent-team-session')
    await fixture.ctx.quantSkillsSessions.agentTeamSessionCreate({
      sessionId,
      teamId: team.teamId,
      expectedRevision: team.revision,
    })
    const root = fixture.ctx.agents.get(sessionId)!
    expect(foldQuantSkillsAgentTeamSession(root.session.events)).toEqual(team)
    expect(foldQuantSkillsAgentTeamMemberSession(root.session.events)).toBeNull()
    expect(foldQuantSkillsPandaRuntimeBinding(root.session.events)).toBeNull()
    expect(fixture.ctx.tools.get('quantskills_panda_python', root)).toBeUndefined()
    await expect(fixture.ctx.skills.get(assetId, { scope: root })).resolves.toMatchObject({ content: 'version one' })
    await expect(fixture.ctx.skills.get(secondAssetId, { scope: root })).resolves.toBeUndefined()
    const rootPrompt = renderPrompt(await fixture.ctx.systemPrompt.assemble(assembleContextFor(root)))
    expect(rootPrompt).toContain('因子研究团队')
    expect(rootPrompt).toContain('signal-validator')
    expect(rootPrompt).toContain(leadRole)
    expect(rootPrompt).toContain(teamDescription)
    expect(rootPrompt).toContain('Write every generated artifact under `output/` in the current Session workspace.')
    expect(fixture.ctx.tools.get('activate_team_member', root)).toBeDefined()
    await expect(agentEvents(fixture.ctx, root).waterfall(
      'agent/request',
      { turn: 1, step: 0, signal: new AbortController().signal },
      () => Promise.resolve({ provider: 'test', model: 'test' }),
    )).resolves.toMatchObject({ provider: 'test', model: 'lead-model', reasoningEffort: 'high' })

    const activated = await fixture.ctx.tools.execute({
      callId: 'call-activate-team-member' as never,
      name: 'activate_team_member',
      arguments: { member: 'signal-validator', task: '验证本轮信号结果。' },
      agent: root,
      signal: new AbortController().signal,
    })
    expect(activated.isError).toBe(false)
    const content = activated.content.find(block => block.type === 'text')
    if (content?.type !== 'text') throw new Error('activation result has no text')
    const result = JSON.parse(content.text) as { sessionId: string; member: string }
    expect(result.member).toBe('signal-validator')
    expect(fixture.teamSpawnRequests.at(-1)?.agentOptions)
      .toEqual({ provider: 'test', model: 'member-model' })
    const child = fixture.ctx.agents.get(SessionId(result.sessionId))!
    expect(foldQuantSkillsAgentTeamSession(child.session.events)).toBeNull()
    expect(foldQuantSkillsAgentTeamMemberSession(child.session.events)).toEqual({
      teamId: team.teamId,
      teamRevision: team.revision,
      memberName: 'signal-validator',
      agent: member,
      model: {
        kind: 'fixed',
        selection: { provider: 'test', model: 'member-model', reasoningEffort: 'high' },
      },
    })
    expect(foldQuantSkillsPandaRuntimeBinding(child.session.events)).toBeNull()
    expect(fixture.ctx.tools.get('quantskills_panda_python', child)).toBeUndefined()
    await expect(fixture.ctx.skills.get(secondAssetId, { scope: child }))
      .resolves.toMatchObject({ content: 'beta version' })
    await expect(fixture.ctx.skills.get(assetId, { scope: child })).resolves.toBeUndefined()
    const childPrompt = renderPrompt(await fixture.ctx.systemPrompt.assemble(assembleContextFor(child)))
    expect(childPrompt).toContain('Team member "signal-validator"')
    expect(childPrompt).toContain(memberRole)
    expect(childPrompt).toContain('Write every generated artifact under `output/` in the current Session workspace.')
    await expect(agentEvents(fixture.ctx, child).waterfall(
      'agent/request',
      { turn: 1, step: 0, signal: new AbortController().signal },
      () => Promise.resolve({ provider: 'test', model: 'test' }),
    )).resolves.toMatchObject({ provider: 'test', model: 'member-model', reasoningEffort: 'high' })

    const duplicate = await fixture.ctx.tools.execute({
      callId: 'call-activate-team-member-duplicate' as never,
      name: 'activate_team_member',
      arguments: { member: 'signal-validator', task: '重复启动。' },
      agent: root,
      signal: new AbortController().signal,
    })
    expect(duplicate.isError).toBe(true)
    const duplicateText = duplicate.content.find(block => block.type === 'text')
    expect(duplicateText?.type === 'text' ? duplicateText.text : '').toContain('followup_task')
    await expect(fixture.ctx.quantSkillsSessions.agentTeamSessionList({})).resolves.toEqual([
      expect.objectContaining({ sessionId, team, running: false }),
    ])

    await fixture.handles.get(sessionId)!.dispose()
    await fixture.ctx.quantSkillsSessions.agentTeamSessionCreate({
      sessionId,
      teamId: team.teamId,
      expectedRevision: team.revision,
    })
    const resumed = fixture.ctx.agents.get(sessionId)!
    expect(foldQuantSkillsAgentTeamSession(resumed.session.events)).toEqual(team)
    await expect(fixture.ctx.skills.get(assetId, { scope: resumed })).resolves.toMatchObject({ content: 'version one' })
    expect(renderPrompt(await fixture.ctx.systemPrompt.assemble({ scope: resumed }))).toContain(teamDescription)
    await fixture.ctx.fiber.dispose()
  })
})

describe('streamed artifacts', () => {
  it('serves exact ranges and original downloads, rejects escaping paths and invalid ranges', async () => {
    const fixture = await harness()
    const sessionId = await createBound(fixture, 'session-streamed-results')
    const cwd = fixture.ctx.sessions.get(sessionId)!.header.cwd!
    await mkdir(join(cwd, 'output'), { recursive: true })
    const bytes = Buffer.from('0123456789'.repeat(300000))
    await writeFile(join(cwd, 'output', 'movie.mp4'), bytes)
    const service = fixture.ctx.quantSkillsSessions
    const request = (path: string, headers: Record<string, string> = {}, method = 'GET') =>
      (Reflect.get(service, 'resultFileResponse') as (request: Request) => Promise<Response>).call(service,
        new Request(`http://localhost/api/quantskills.result.file?${new URLSearchParams({ sessionId, path, download: '1' })}`, { headers, method }))
    const response = await request('output/movie.mp4', { range: 'bytes=10-19' })
    expect(response.status).toBe(206)
    expect(response.headers.get('content-range')).toBe(`bytes 10-19/${bytes.length}`)
    expect(response.headers.get('content-disposition')).toContain('attachment;')
    expect(await response.text()).toBe('0123456789')
    const head = await request('output/movie.mp4', {}, 'HEAD')
    expect(head.headers.get('content-length')).toBe(String(bytes.length))
    expect(await head.text()).toBe('')
    expect((await request('output/movie.mp4', { range: 'bytes=9999999-' })).status).toBe(416)
    expect((await request('../outside.mp4')).status).toBe(404)
    const preview = await service.resultPreview({ sessionId, path: 'output/movie.mp4' })
    expect(preview).toMatchObject({ kind: 'resource', presentation: 'video', bytes: bytes.length })
    expect(await service.resultPreview({ sessionId, path: 'output' })).toMatchObject({ kind: 'directory', entries: [expect.objectContaining({ name: 'movie.mp4' })] })
    await writeFile(join(cwd, 'output', 'report.pdf'), '%PDF-1.4\n')
    const pdf = await request('output/report.pdf')
    expect(pdf.headers.get('content-type')).toBe('application/pdf')
    expect(pdf.headers.get('content-security-policy')).toBe("sandbox; default-src 'none'")
    await pdf.arrayBuffer()
    await writeFile(join(cwd, 'output', 'fake.pdf'), '<html>not a PDF</html>')
    expect((await request('output/fake.pdf')).status).toBe(415)
    expect(response.headers.get('content-security-policy')).toContain('sandbox')
    await fixture.ctx.fiber.dispose()
  })
})
