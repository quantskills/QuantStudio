/** `ctx.skills` provider for Host-committed QuantSkills versions. */

import { readFile } from 'node:fs/promises'
import type {
  SkillCandidate,
  SkillDefinition,
  SkillInvocationPolicy,
  SkillLookupOptions,
  SkillProvider,
} from '@deepseek-ai/dsh-skill'
import { isSkillName } from '@deepseek-ai/dsh-skill'
import { parse as parseYaml } from 'yaml'
import type { QuantSkillsAssetId, QuantSkillsInstalledVersionId } from './types.ts'
import type { QuantSkillsPromptFormResult } from './types.ts'
import { parseQuantSkillsPromptForm } from './prompt-form.ts'

const PROVIDER_NAME = 'quantskills-host'
const PROVIDER_RANK = 50

/** One immutable installed Skill declaration owned by the Host store. */
export interface QuantSkillsInstalledSkillLocation {
  readonly assetId: QuantSkillsAssetId
  readonly versionId: QuantSkillsInstalledVersionId
  readonly declarationPath: string
  readonly resourceBase: string
}

interface ParsedSkill {
  readonly name: string
  readonly description: string
  readonly whenToUse?: string
  readonly invocation: SkillInvocationPolicy
  readonly metadata?: Readonly<Record<string, unknown>>
  readonly content: string
  readonly promptForm?: QuantSkillsPromptFormResult
}

interface QuantSkillsSkillLocator extends QuantSkillsInstalledSkillLocation {}

/** Provider name recorded on registry-visible QuantSkills definitions. */
export const QUANTSKILLS_SKILL_PROVIDER = PROVIDER_NAME

/**
 * Parse one standard DSH Skill declaration from an exact checked-out commit.
 * @param raw - complete UTF-8 `SKILL.md` text.
 * @returns validated discovery metadata and instruction body.
 */
export function parseQuantSkillsSkill(raw: string): ParsedSkill {
  const parsed = parseFrontmatter(raw)
  if (parsed === undefined) throw new Error('SKILL.md requires YAML frontmatter')
  const name = requiredString(parsed.data, 'name')
  const description = requiredString(parsed.data, 'description')
  if (!isSkillName(name)) throw new Error(`SKILL.md contains invalid skill name "${name}"`)
  const whenToUse = optionalString(parsed.data, 'whenToUse')
  const metadata = optionalRecord(parsed.data, 'metadata')
  const promptForm = parseQuantSkillsPromptForm(parsed.body)
  return Object.freeze({
    name,
    description,
    ...(whenToUse === undefined ? {} : { whenToUse }),
    invocation: parseInvocationPolicy(parsed.data),
    ...(metadata === undefined ? {} : { metadata: Object.freeze(metadata) }),
    content: parsed.body.trim(),
    ...(promptForm === undefined ? {} : { promptForm }),
  })
}

/**
 * Check the catalog identity accepted for one standard Skill declaration.
 * @param assetId - approved repository and installation identity.
 * @param declarationName - name parsed from the root `SKILL.md`.
 * @returns whether the declaration uses the asset id or its standard name without one `skill-` repository prefix.
 */
export function matchesQuantSkillsSkillName(assetId: QuantSkillsAssetId, declarationName: string): boolean {
  return declarationName === assetId
    || (assetId.startsWith('skill-') && declarationName === assetId.slice('skill-'.length))
}

/** Provider that exposes the latest committed version of every installed Skill. */
export class QuantSkillsInstalledSkillProvider implements SkillProvider {
  readonly name = PROVIDER_NAME

  /**
   * @param locations - reads the current Host-committed Skill locations.
   */
  constructor(
    private readonly locations: (signal?: AbortSignal) => Promise<readonly QuantSkillsInstalledSkillLocation[]>,
  ) {}

  /**
   * Project installed declarations into registry candidates.
   * @param options - caller cancellation for manifest and declaration reads.
   * @returns candidates backed by immutable Host version directories.
   */
  async list(options: SkillLookupOptions): Promise<readonly SkillCandidate[]> {
    const candidates: SkillCandidate[] = []
    for (const location of await this.locations(options.signal)) {
      options.signal?.throwIfAborted()
      const parsed = await readParsedSkill(location, options.signal)
      assertAssetName(location, parsed)
      candidates.push(toCandidate(location, parsed))
    }
    return Object.freeze(candidates)
  }

  /**
   * Load the exact declaration selected during discovery.
   * @param candidate - provider-owned installed-version locator.
   * @param options - caller cancellation for the declaration read.
   * @returns the complete installed Skill definition.
   */
  async get(candidate: SkillCandidate, options: SkillLookupOptions): Promise<SkillDefinition> {
    const location = candidate.locator as QuantSkillsSkillLocator
    const parsed = await readParsedSkill(location, options.signal)
    assertAssetName(location, parsed)
    return Object.freeze({
      ...projectSkill(location, parsed),
      content: parsed.content,
    })
  }
}

function toCandidate(location: QuantSkillsInstalledSkillLocation, parsed: ParsedSkill): SkillCandidate {
  return Object.freeze({
    ...projectSkill(location, parsed),
    rank: PROVIDER_RANK,
    locator: Object.freeze({ ...location }),
  })
}

function projectSkill(location: QuantSkillsInstalledSkillLocation, parsed: ParsedSkill) {
  return {
    name: parsed.name,
    description: parsed.description,
    ...(parsed.whenToUse === undefined ? {} : { whenToUse: parsed.whenToUse }),
    invocation: parsed.invocation,
    source: PROVIDER_NAME,
    provider: PROVIDER_NAME,
    resourceBase: { kind: 'directory' as const, path: location.resourceBase },
    path: location.declarationPath,
    ...(parsed.metadata === undefined ? {} : { metadata: parsed.metadata }),
  }
}

async function readParsedSkill(
  location: QuantSkillsInstalledSkillLocation,
  signal?: AbortSignal,
): Promise<ParsedSkill> {
  signal?.throwIfAborted()
  const raw = await readFile(location.declarationPath, { encoding: 'utf8', signal })
  signal?.throwIfAborted()
  return parseQuantSkillsSkill(raw)
}

/**
 * Load one exact Host-installed Skill location as a complete immutable definition.
 * @param location - exact committed version location returned by the Host store.
 * @param signal - optional caller cancellation for the declaration read.
 * @returns the parsed Skill definition pinned to that location.
 */
export async function loadQuantSkillsInstalledSkill(
  location: QuantSkillsInstalledSkillLocation,
  signal?: AbortSignal,
): Promise<SkillDefinition> {
  const parsed = await readParsedSkill(location, signal)
  assertAssetName(location, parsed)
  return Object.freeze({
    ...projectSkill(location, parsed),
    content: parsed.content,
  })
}

function assertAssetName(location: QuantSkillsInstalledSkillLocation, parsed: ParsedSkill): void {
  if (!matchesQuantSkillsSkillName(location.assetId, parsed.name)) {
    throw new Error(`installed Skill name "${parsed.name}" does not match asset "${location.assetId}"`)
  }
}

function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } | undefined {
  const firstLineEnd = raw.indexOf('\n')
  if (firstLineEnd < 0 || raw.slice(0, firstLineEnd).replace(/\r$/, '') !== '---') return undefined
  const start = firstLineEnd + 1
  let lineStart = start
  while (lineStart <= raw.length) {
    const nextNewline = raw.indexOf('\n', lineStart)
    const lineEnd = nextNewline < 0 ? raw.length : nextNewline
    if (raw.slice(lineStart, lineEnd).replace(/\r$/, '') === '---') {
      const parsed = parseYaml(raw.slice(start, lineStart)) as unknown
      if (!isRecord(parsed)) return undefined
      return { data: parsed, body: raw.slice(nextNewline < 0 ? raw.length : nextNewline + 1) }
    }
    if (nextNewline < 0) return undefined
    lineStart = nextNewline + 1
  }
  return undefined
}

function requiredString(data: Record<string, unknown>, key: string): string {
  const value = data[key]
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`SKILL.md requires frontmatter field "${key}"`)
  return value
}

function optionalString(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function optionalRecord(data: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const value = data[key]
  return isRecord(value) ? value : undefined
}

function parseInvocationPolicy(data: Record<string, unknown>): SkillInvocationPolicy {
  for (const [legacy, canonical] of [
    ['disableModelInvocation', 'disable-model-invocation'],
    ['modelInvocable', 'disable-model-invocation'],
    ['userInvocable', 'user-invocable'],
  ] as const) {
    if (Object.hasOwn(data, legacy)) throw new Error(`frontmatter field "${legacy}" is unsupported; use "${canonical}"`)
  }
  return {
    modelInvocable: frontmatterBoolean(data, 'disable-model-invocation') !== true,
    userInvocable: frontmatterBoolean(data, 'user-invocable') !== false,
  }
}

function frontmatterBoolean(data: Record<string, unknown>, key: string): boolean | undefined {
  if (!Object.hasOwn(data, key)) return undefined
  const value = data[key]
  if (typeof value === 'boolean') return value
  const normalized = typeof value === 'string' ? value.toLowerCase() : value
  if (normalized === 1 || ['1', 'true', 'yes', 'on'].includes(String(normalized))) return true
  if (normalized === 0 || ['0', 'false', 'no', 'off'].includes(String(normalized))) return false
  throw new TypeError(`frontmatter field "${key}" must be a boolean`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
