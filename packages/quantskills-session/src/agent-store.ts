/** Durable Host-owned storage for user-authored QuantSkills Agent definitions. */

import { chmod, lstat, mkdir, readFile, realpath } from 'node:fs/promises'
import { join } from 'node:path'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { z } from 'zod'
import type {
  QuantSkillsAgentDefinition, QuantSkillsAgentId, QuantSkillsAssetId, QuantSkillsCommitSha,
  QuantSkillsInstalledVersionId, QuantSkillsTreeDigest,
} from './types.ts'

const SCHEMA_VERSION = 1
const DOCUMENT_NAME = 'agents.json'
const AGENT_ID = /^agent-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
/** Maximum UTF-8 byte size accepted and published for the complete Agent document. */
export const MAX_AGENT_DOCUMENT_BYTES = 4 * 1024 * 1024
/** Maximum instruction text retained from one native `AGENTS.md` template. */
export const MAX_AGENT_ROLE_CHARS = 128_000

/** Durable schema shared by single-Skill and user Agent Session bindings. */
export const quantSkillsSessionBindingSchema = z.object({
  assetId: z.string().regex(/^(?:skill)-[a-z0-9](?:[a-z0-9_-]{0,98}[a-z0-9])?$/),
  versionId: z.string(),
  commit: z.string().regex(/^[a-f0-9]{40}$/),
  treeDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
}).strict().superRefine((binding, issue) => {
  if (binding.versionId !== `${binding.assetId}@${binding.commit}`) {
    issue.addIssue({ code: 'custom', message: 'versionId must identify assetId at commit', path: ['versionId'] })
  }
}).transform(parsed => Object.freeze({
  assetId: parsed.assetId as QuantSkillsAssetId,
  versionId: parsed.versionId as QuantSkillsInstalledVersionId,
  commit: parsed.commit as QuantSkillsCommitSha,
  treeDigest: parsed.treeDigest as QuantSkillsTreeDigest,
}))

/** Durable schema for one complete immutable user Agent definition. */
export const quantSkillsAgentDefinitionSchema = z.object({
  agentId: z.string().regex(AGENT_ID),
  revision: z.number().int().positive(),
  name: z.string().min(1).max(80),
  role: z.string().min(1).max(MAX_AGENT_ROLE_CHARS),
  mode: z.enum(['dynamic', 'fixed']),
  model: z.object({
    provider: z.string().min(1).max(200),
    model: z.string().min(1).max(400),
    reasoningEffort: z.string().min(1).max(100).optional(),
  }).strict().optional(),
  permission: z.enum(['read-only', 'workspace-write', 'danger-full-access']).default('workspace-write'),
  sourceVersionId: z.string().regex(/^agent-[a-z0-9](?:[a-z0-9_-]{0,98}[a-z0-9])?@[a-f0-9]{40}$/).optional(),
  skills: z.array(quantSkillsSessionBindingSchema).max(32),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
}).strict().superRefine((definition, issue) => {
  const seen = new Set<string>()
  for (const [index, binding] of definition.skills.entries()) {
    if (seen.has(binding.assetId)) {
      issue.addIssue({ code: 'custom', message: 'an Agent may select an asset only once', path: ['skills', index] })
    }
    seen.add(binding.assetId)
  }
}).transform(freezeDefinition)

const documentSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  agents: z.array(quantSkillsAgentDefinitionSchema),
}).strict()

/** Parsed durable Agent document. */
interface AgentDocument {
  readonly schemaVersion: 1
  readonly agents: readonly QuantSkillsAgentDefinition[]
}

/** Host-owned durable Agent definition store with serialized atomic mutations. */
export class QuantSkillsAgentStore {
  private readonly root: string
  private tail: Promise<void> = Promise.resolve()

  /**
   * @param dshHome - optional Harness home override.
   */
  constructor(dshHome?: string) {
    this.root = join(resolveDshHome(dshHome), 'quantskills')
  }

  /**
   * Read every validated definition ordered by most recent update.
   * @returns immutable validated definitions.
   */
  async list(): Promise<readonly QuantSkillsAgentDefinition[]> {
    const document = await this.read(await this.path())
    return Object.freeze([...document.agents].sort((left, right) =>
      right.updatedAt - left.updatedAt || left.agentId.localeCompare(right.agentId)))
  }

  /**
   * Serialize one read-modify-write transaction.
   * @param mutation - operation producing the next complete definition set.
   * @returns the operation result after durable publication.
   */
  mutate<T>(
    mutation: (agents: readonly QuantSkillsAgentDefinition[]) => {
      readonly agents: readonly QuantSkillsAgentDefinition[]
      readonly result: T
    } | Promise<{ readonly agents: readonly QuantSkillsAgentDefinition[]; readonly result: T }>,
  ): Promise<T> {
    const run = this.tail.then(async () => {
      const path = await this.path()
      return withFileLock(path, async () => {
        const current = await this.read(path)
        const changed = await mutation(current.agents)
        await this.write(path, { schemaVersion: SCHEMA_VERSION, agents: changed.agents })
        return changed.result
      })
    })
    this.tail = run.then(() => {}, () => {})
    return run
  }

  private async read(path: string): Promise<AgentDocument> {
    let source: string
    try {
      const info = await lstat(path)
      if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_AGENT_DOCUMENT_BYTES) {
        throw new Error('Agent document is not a bounded regular file')
      }
      source = await readFile(path, 'utf8')
    } catch (error) {
      if (isMissing(error)) return { schemaVersion: SCHEMA_VERSION, agents: [] }
      throw error
    }
    const parsed = documentSchema.parse(JSON.parse(source) as unknown)
    const ids = new Set<string>()
    return Object.freeze({
      schemaVersion: SCHEMA_VERSION,
      agents: Object.freeze(parsed.agents.map((definition) => {
        if (ids.has(definition.agentId)) throw new Error(`duplicate QuantSkills Agent id "${definition.agentId}"`)
        ids.add(definition.agentId)
        return definition
      })),
    })
  }

  private async write(path: string, document: AgentDocument): Promise<void> {
    const validated = documentSchema.parse(document)
    const content = `${JSON.stringify(validated, null, 2)}\n`
    if (Buffer.byteLength(content, 'utf8') > MAX_AGENT_DOCUMENT_BYTES) {
      throw new Error(`QuantSkills Agent document exceeds ${String(MAX_AGENT_DOCUMENT_BYTES)} bytes`)
    }
    await writeFileAtomic(path, content, { mode: 0o600, dirMode: 0o700 })
  }

  private async path(): Promise<string> {
    await mkdir(this.root, { recursive: true, mode: 0o700 })
    const info = await lstat(this.root)
    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new Error('QuantSkills managed root is not a real directory')
    }
    await chmod(this.root, 0o700)
    return join(await realpath(this.root), DOCUMENT_NAME)
  }
}

/**
 * Deep-freeze one parsed or newly constructed definition.
 * @param definition - validated Agent data.
 * @returns immutable branded definition.
 */
export function freezeDefinition(definition: {
  readonly agentId: string
  readonly revision: number
  readonly name: string
  readonly role: string
  readonly mode: 'dynamic' | 'fixed'
  readonly model?: {
    readonly provider: string
    readonly model: string
    readonly reasoningEffort?: string | undefined
  } | undefined
  readonly permission: 'read-only' | 'workspace-write' | 'danger-full-access'
  readonly sourceVersionId?: string | undefined
  readonly skills: readonly {
    readonly assetId: string
    readonly versionId: string
    readonly commit: string
    readonly treeDigest: string
  }[]
  readonly createdAt: number
  readonly updatedAt: number
}): QuantSkillsAgentDefinition {
  return Object.freeze({
    agentId: definition.agentId as QuantSkillsAgentId,
    revision: definition.revision,
    name: definition.name,
    role: definition.role,
    mode: definition.mode,
    permission: definition.permission,
    ...(definition.sourceVersionId === undefined
      ? {}
      : { sourceVersionId: definition.sourceVersionId as QuantSkillsInstalledVersionId }),
    ...(definition.model === undefined ? {} : { model: Object.freeze({
      provider: definition.model.provider,
      model: definition.model.model,
      ...(definition.model.reasoningEffort === undefined
        ? {}
        : { reasoningEffort: definition.model.reasoningEffort }),
    }) }),
    skills: Object.freeze(definition.skills.map(binding => Object.freeze({
      assetId: binding.assetId as QuantSkillsAssetId,
      versionId: binding.versionId as QuantSkillsInstalledVersionId,
      commit: binding.commit as QuantSkillsCommitSha,
      treeDigest: binding.treeDigest as QuantSkillsTreeDigest,
    }))),
    createdAt: definition.createdAt,
    updatedAt: definition.updatedAt,
  })
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
