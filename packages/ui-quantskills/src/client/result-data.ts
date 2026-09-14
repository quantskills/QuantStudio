/** Read-only result facts derived from one loaded Conversation window. */

import type { ChatSnapshot, ToolCallBlock, ToolResultNode } from '@deepseek-ai/dsh-client-ui-chat/client'
import { producedForClosing } from '@deepseek-ai/dsh-client-ui-deliverables/client'
import type { TurnLocation } from '@deepseek-ai/dsh-client-ui-conversation/client'

interface DeliverablesTurnData {
  readonly produced: readonly { readonly seq: number; readonly path: string }[]
}

/** One produced workspace file shown in the QuantSkills result workbench. */
export interface QuantSkillsProducedFile {
  readonly path: string
  readonly name: string
}

/** One workspace path reported by a mutation Tool or explicitly delivered by the Assistant. */
export type QuantSkillsResultFile = QuantSkillsProducedFile

/** Host disposition for one result candidate discovered in a Conversation. */
export type QuantSkillsResultArtifactStatus = 'ready' | 'archived' | 'unavailable'

/** Host-normalized result path prepared for one Session workspace. */
export interface QuantSkillsPreparedResultArtifact {
  /** Exact path discovered in the Conversation. */
  readonly sourcePath: string
  /** Canonical workspace-relative path; unavailable entries must not use it for file access. */
  readonly path: string
  /** Whether the path was already local, archived from an installed asset, or rejected. */
  readonly status: QuantSkillsResultArtifactStatus
  /** User-safe explanation for an unavailable candidate. */
  readonly reason?: string
}

/** One real Tool lifecycle visible in the current loaded Conversation window. */
export interface QuantSkillsToolActivity {
  readonly callId: string
  readonly name: string
  readonly time: number
  readonly status: 'running' | 'succeeded' | 'failed'
}

/** Result drawer facts for exactly one Session. */
export interface QuantSkillsResultData {
  readonly files: readonly QuantSkillsProducedFile[]
  readonly activity: readonly QuantSkillsToolActivity[]
  readonly settledToolCount: number
  readonly failedToolCount: number
  readonly runningToolCount: number
  readonly turnCount: number
  readonly hasOlderHistory: boolean
}

const RESULT_CODE_EXTENSIONS = new Set([
  'bat', 'c', 'cc', 'cjs', 'conf', 'cpp', 'cs', 'css', 'cts', 'dart', 'fish', 'go', 'h', 'hpp',
  'ini', 'java', 'js', 'jsx', 'kt', 'kts', 'lua', 'm', 'mjs', 'mm', 'mts', 'php', 'pl', 'ps1',
  'py', 'r', 'rb', 'rs', 'scss', 'sh', 'sql', 'swift', 'toml', 'ts', 'tsx', 'vue', 'xml', 'yaml',
  'yml', 'zsh',
])

function deliverablesFor(turn: TurnLocation | undefined): Readonly<DeliverablesTurnData> | undefined {
  if (turn === undefined) return undefined
  return (turn.data as unknown as {
    get(key: 'deliverables'): Readonly<DeliverablesTurnData> | undefined
  }).get('deliverables')
}

/**
 * Read a normalized extension from a produced workspace path.
 * @param path - workspace-relative produced path.
 * @returns the lowercase extension without a leading period, or an empty string.
 */
export function resultExtension(path: string): string {
  const separator = path.lastIndexOf('.')
  return separator === -1 ? '' : path.slice(separator + 1).toLowerCase()
}

/**
 * Decide whether a result path is a common source or configuration file.
 * @param path - workspace-relative produced path.
 * @returns true when the result workbench should use its code reader.
 */
export function isCodeResultPath(path: string): boolean {
  return RESULT_CODE_EXTENSIONS.has(resultExtension(path))
}

/**
 * Rank result formats by their default reading value in the preview drawer.
 * @param path - workspace-relative produced path.
 * @returns a lower rank for a more useful default view; 4 means system-open fallback.
 */
export function resultPreviewRank(path: string): number {
  const extension = resultExtension(path)
  if (['md', 'html', 'pdf', 'docx', 'odt', 'rtf', 'epub'].includes(extension)) return 0
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'pptx', 'odp'].includes(extension)) return 1
  if (['csv', 'tsv', 'xlsx', 'ods', 'json'].includes(extension)) return 2
  if (isCodeResultPath(path) || ['txt', 'log'].includes(extension)) return 3
  return 4
}

/**
 * Select viewable files produced by the latest loaded Turn.
 * @param snapshot - current Session's Conversation snapshot.
 * @returns exact result paths from that Turn; uncommon formats use the system application.
 */
export function previewableResultPathsForLatestTurn(
  snapshot: ChatSnapshot,
): readonly string[] {
  const latestTurn = snapshot.timeline.turnOrder.at(-1)
  if (latestTurn === undefined) return []
  const produced = deliverablesFor(snapshot.timeline.turns.get(latestTurn))
  return producedForClosing(produced)
}

function activityFor(block: ToolCallBlock): QuantSkillsToolActivity {
  if ('kind' in block) {
    return {
      callId: block.callId,
      name: block.call?.name ?? block.callId,
      time: block.time,
      status: block.isError ? 'failed' : 'succeeded',
    }
  }
  return {
    callId: block.callId,
    name: block.name,
    time: block.time,
    status: 'running',
  }
}

function visitTool(block: ToolCallBlock, rows: Map<string, QuantSkillsToolActivity>): void {
  const activity = activityFor(block)
  const previous = rows.get(activity.callId)
  if (previous === undefined || previous.status === 'running') rows.set(activity.callId, activity)
  for (const child of block.subCalls) visitTool(child, rows)
}

function isToolResult(node: ChatSnapshot['legacy']['nodes'][number]): node is ToolResultNode {
  return node.kind === 'tool-result'
}

function assistantArtifactFiles(
  snapshot: ChatSnapshot,
): readonly QuantSkillsProducedFile[] {
  const files: QuantSkillsProducedFile[] = []
  const paths = new Set<string>()
  for (const node of [...snapshot.legacy.nodes].reverse()) {
    if (node.kind !== 'assistant') continue
    for (const block of node.blocks) {
      if (block.kind !== 'text') continue
      for (const match of block.text.matchAll(/`([^`\r\n]+)`/g)) {
        const path = artifactPath(match[1] ?? '')
        if (path === undefined || paths.has(path)) continue
        paths.add(path)
        files.push({ path, name: path.slice(path.lastIndexOf('/') + 1) })
      }
    }
  }
  return files
}

function artifactPath(value: string): string | undefined {
  const path = value.trim().replaceAll('\\', '/')
  if (path.length === 0 || path.startsWith('/') || /^[A-Za-z]:\//.test(path)
    || path.includes('://') || path.split('/').includes('..')
    || /^(?:py(?:thon)?(?:\d+(?:\.\d+)*)?|node|pnpm|npm|npx|yarn|bun|bash|sh|pwsh|powershell|cmd|git)\s/i.test(path)) {
    return undefined
  }
  return path.replace(/^\.\//, '')
}

function resultFiles(snapshot: ChatSnapshot): readonly QuantSkillsProducedFile[] {
  const byPath = new Map<string, QuantSkillsProducedFile>()
  for (const file of assistantArtifactFiles(snapshot)) {
    if (!byPath.has(file.path)) byPath.set(file.path, file)
  }
  for (const turn of snapshot.timeline.turnOrder) {
    const produced = deliverablesFor(snapshot.timeline.turns.get(turn))
    for (const path of producedForClosing(produced)) {
      if (byPath.has(path)) continue
      byPath.set(path, { path, name: path.slice(path.lastIndexOf('/') + 1) })
    }
  }
  return [...byPath.values()]
}

/**
 * Project files and Tool activity from a single loaded Session window.
 *
 * Produced paths prioritize exact workspace paths explicitly
 * delivered in the newest Assistant messages, then add ui-deliverables'
 * mutation-location facts.
 * The Host still validates every path before preview. Tool rows reuse the
 * Conversation assembler's settled and in-flight lifecycle values; no metric
 * is recomputed in the browser.
 * @param snapshot - current Session's Conversation snapshot.
 * @returns Session-isolated result facts, newest activity first.
 */
export function projectQuantSkillsResults(
  snapshot: ChatSnapshot,
  hasOlderHistory = false,
): QuantSkillsResultData {
  const files = resultFiles(snapshot)
  const byCall = new Map<string, QuantSkillsToolActivity>()
  for (const node of snapshot.legacy.nodes.filter(isToolResult)) visitTool(node, byCall)
  for (const call of snapshot.legacy.runningCalls) visitTool(call, byCall)
  const activity = [...byCall.values()].sort((left, right) =>
    right.time - left.time || left.callId.localeCompare(right.callId))

  return {
    files,
    activity,
    settledToolCount: activity.filter(row => row.status !== 'running').length,
    failedToolCount: activity.filter(row => row.status === 'failed').length,
    runningToolCount: activity.filter(row => row.status === 'running').length,
    turnCount: snapshot.timeline.turnOrder.length,
    hasOlderHistory,
  }
}
