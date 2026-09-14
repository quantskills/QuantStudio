import { CapabilityIcon } from './CapabilityIcon.tsx'
import { useMemo, useState } from 'react'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type {
  QuantSkillsAgentTeamDefinition,
  QuantSkillsAgentTeamModelChoice,
  QuantSkillsAuthoringCommitResult,
  SessionId,
} from './plugin-types.ts'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import {
  CheckCircleIcon as CheckCircle, ChatsCircleIcon as ChatsCircle,
  PencilSimpleIcon as PencilSimple,
  WarningCircleIcon as WarningCircle,
} from '@phosphor-icons/react'
import type { QuantSkillsAgentsSnapshot } from './types.ts'
import type { QuantSkillsAgentTeamBuilderSeed } from './store.ts'
import css from './QuantSkillsApp.module.css'

interface ParsedDiagnostic {
  readonly level: 'info' | 'warning' | 'error'
  readonly code: string
  readonly message: string
}

interface ParsedTeamDraft {
  readonly name: string
  readonly description: string
  readonly lead: { readonly agentId: string; readonly revision: number }
  readonly leadModel: QuantSkillsAgentTeamModelChoice
  readonly members: readonly {
    readonly name: string
    readonly responsibility: string
    readonly context: 'fresh' | 'fork'
    readonly agent: { readonly agentId: string; readonly revision: number }
    readonly model: QuantSkillsAgentTeamModelChoice
  }[]
  readonly diagnostics: readonly ParsedDiagnostic[]
}

type ParsedToolResult =
  | { readonly kind: 'agents'; readonly count: number }
  | {
    readonly kind: 'draft'
    readonly treeDigest: string
    readonly draft?: ParsedTeamDraft
    readonly diagnostics: readonly ParsedDiagnostic[]
  }

/** Actions needed to confirm a session-local Team draft. */
export interface QuantSkillsTeamDraftCardInjected {
  hooks: {
    agents: ObservableSnapshot<QuantSkillsAgentsSnapshot>
    sessions: ObservableSnapshot<SessionListState>
  }
  sessionId: SessionId
  commitAuthoring: (toolCallId: string, treeDigest: string) => Promise<QuantSkillsAuthoringCommitResult>
  startAgentTeamSession: (definition: QuantSkillsAgentTeamDefinition) => Promise<void>
  openAgentTeamBuilder: (seed: QuantSkillsAgentTeamBuilderSeed) => void
  focusComposer: () => void
}

type QuantSkillsTeamDraftCardProps = ToolCallViewProps & InjectFace<QuantSkillsTeamDraftCardInjected>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseDiagnostic(value: unknown): ParsedDiagnostic | undefined {
  if (!isRecord(value)
    || (value.level !== 'info' && value.level !== 'warning' && value.level !== 'error')
    || typeof value.code !== 'string'
    || typeof value.message !== 'string') return undefined
  return { level: value.level, code: value.code, message: value.message }
}

function parseReference(value: unknown): { readonly agentId: string; readonly revision: number } | undefined {
  if (!isRecord(value) || typeof value.agentId !== 'string'
    || !Number.isSafeInteger(value.revision) || (value.revision as number) < 1) return undefined
  return { agentId: value.agentId, revision: value.revision as number }
}

function parseModelChoice(value: unknown): QuantSkillsAgentTeamModelChoice | undefined {
  if (!isRecord(value)) return undefined
  if (value.kind === 'default') return { kind: 'default' }
  if (value.kind !== 'fixed' || !isRecord(value.selection)
    || typeof value.selection.provider !== 'string' || typeof value.selection.model !== 'string'
    || (value.selection.reasoningEffort !== undefined && typeof value.selection.reasoningEffort !== 'string')) {
    return undefined
  }
  return {
    kind: 'fixed',
    selection: {
      provider: value.selection.provider,
      model: value.selection.model,
      ...(value.selection.reasoningEffort === undefined ? {} : { reasoningEffort: value.selection.reasoningEffort }),
    },
  }
}

function parseDraft(value: unknown): ParsedTeamDraft | undefined {
  if (!isRecord(value) || typeof value.name !== 'string' || typeof value.description !== 'string') return undefined
  const lead = parseReference(value.lead)
  const leadModel = parseModelChoice(value.leadModel)
  if (lead === undefined || leadModel === undefined
    || !Array.isArray(value.members) || !Array.isArray(value.diagnostics)) return undefined
  const members = value.members.map((candidate) => {
    if (!isRecord(candidate) || typeof candidate.name !== 'string'
      || typeof candidate.responsibility !== 'string'
      || (candidate.context !== 'fresh' && candidate.context !== 'fork')) return undefined
    const agent = parseReference(candidate.agent)
    const model = parseModelChoice(candidate.model)
    return agent === undefined || model === undefined ? undefined : {
      name: candidate.name,
      responsibility: candidate.responsibility,
      context: candidate.context,
      agent,
      model,
    }
  })
  const diagnostics = value.diagnostics.map(parseDiagnostic)
  if (members.some(member => member === undefined) || diagnostics.some(item => item === undefined)) return undefined
  return {
    name: value.name,
    description: value.description,
    lead,
    leadModel,
    members: members as ParsedTeamDraft['members'],
    diagnostics: diagnostics as readonly ParsedDiagnostic[],
  }
}

function parseToolResult(text: string): ParsedToolResult | undefined {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return undefined
  }
  if (!isRecord(value)) return undefined
  if (value.kind === 'agents' && Array.isArray(value.agents)) return { kind: 'agents', count: value.agents.length }
  if (value.kind !== 'draft' || typeof value.treeDigest !== 'string' || !Array.isArray(value.diagnostics)) return undefined
  const diagnostics = value.diagnostics.map(parseDiagnostic)
  if (diagnostics.some(item => item === undefined)) return undefined
  const draft = value.draft === undefined ? undefined : parseDraft(value.draft)
  if (value.draft !== undefined && draft === undefined) return undefined
  return {
    kind: 'draft',
    treeDigest: value.treeDigest,
    ...(draft === undefined ? {} : { draft }),
    diagnostics: diagnostics as readonly ParsedDiagnostic[],
  }
}

function descriptionWithResponsibilities(draft: ParsedTeamDraft): string {
  const responsibilities = draft.members.map(member => `- ${member.name}：${member.responsibility}`).join('\n')
  return `${draft.description.trim()}\n\n成员职责\n${responsibilities}`
}

function modelChoiceLabel(choice: QuantSkillsAgentTeamModelChoice): string {
  if (choice.kind === 'default') return '跟随会话默认模型'
  return [choice.selection.provider, choice.selection.model, choice.selection.reasoningEffort]
    .filter(value => value !== undefined)
    .join(' · ')
}

function seedFromDraft(draft: ParsedTeamDraft): QuantSkillsAgentTeamBuilderSeed {
  return {
    name: draft.name,
    description: descriptionWithResponsibilities(draft),
    leadAgentId: draft.lead.agentId,
    leadModel: draft.leadModel,
    members: draft.members.map(member => ({
      name: member.name,
      agentId: member.agent.agentId,
      context: member.context,
      model: member.model,
    })),
  }
}

/** Confirmation card for one logged `quantskills_team_draft` result. */
export function QuantSkillsTeamDraftCard({
  block, callId, sessionId, useAgents, useSessions,
  commitAuthoring, startAgentTeamSession, openAgentTeamBuilder, focusComposer,
}: QuantSkillsTeamDraftCardProps) {
  const definitions = useAgents(state => state.definitions)
  const restored = useSessions((state) => {
    const result = state.byId[sessionId]?.projectionValues
      ?.quantSkillsAuthoringCommits?.find(commit => commit.toolCallId === callId)?.result
    return result?.kind === 'agent-team' ? result.team : undefined
  })
  const [busy, setBusy] = useState<'save' | 'start'>()
  const [committedNow, setCommittedNow] = useState<QuantSkillsAgentTeamDefinition>()
  const saved = committedNow ?? restored
  const [error, setError] = useState<string>()
  const parsed = useMemo(() => {
    if (!('kind' in block) || block.isError) return undefined
    return parseToolResult(block.content.filter(item => item.type === 'text').map(item => item.text).join(''))
  }, [block])
  if (!('kind' in block)) return <div className={css.teamDraftCompact}><CapabilityIcon kind="agent-team"/>正在准备 专家团 草案…</div>
  if (block.isError) return <div className={css.teamDraftCompact} role="alert"><WarningCircle/>专家团 草案准备失败。</div>
  if (parsed === undefined) return <div className={css.teamDraftCompact} role="alert"><WarningCircle/>Host 返回了无法识别的 专家团 草案。</div>
  if (parsed.kind === 'agents') return <div className={css.teamDraftCompact}><CheckCircle/>已读取 {parsed.count} 个可用于编排的 专家。</div>
  if (parsed.draft === undefined) return <article className={css.teamDraftCard}>
    <header><WarningCircle/><div><h3>专家团 草案不可用</h3><p>请根据诊断继续修改方案。</p></div></header>
    <ul className={css.teamDraftDiagnostics}>{parsed.diagnostics.map(item => <li key={`${item.code}-${item.message}`} data-level={item.level}>{item.message}</li>)}</ul>
    <button type="button" className={css.outlineButton} onClick={focusComposer}><PencilSimple/>继续修改</button>
  </article>
  const draft = parsed.draft
  const currentById = new Map<string, (typeof definitions)[number]>(
    definitions.map(definition => [definition.agentId, definition]),
  )
  const lead = currentById.get(draft.lead.agentId)
  const stale = lead?.revision !== draft.lead.revision || draft.members.some(member => (
    currentById.get(member.agent.agentId)?.revision !== member.agent.revision
  ))
  const commit = async (start: boolean): Promise<void> => {
    setBusy(start ? 'start' : 'save')
    setError(undefined)
    try {
      const committed = saved === undefined ? await commitAuthoring(callId, parsed.treeDigest) : undefined
      if (committed !== undefined && committed.kind !== 'agent-team') {
        throw new Error('Host 返回了与 专家团 草案不一致的创作结果。')
      }
      const definition = saved ?? committed?.team
      if (definition === undefined) throw new Error('Host 未返回已保存的 专家团。')
      setCommittedNow(definition)
      if (start) await startAgentTeamSession(definition)
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : '专家团 创建失败。')
    } finally {
      setBusy(undefined)
    }
  }
  return <article className={css.teamDraftCard}>
    <header><CapabilityIcon kind="agent-team"/><div><h3>{draft.name}</h3><p>{draft.description}</p></div></header>
    <section className={css.teamDraftLead}>
      <small>Lead</small>
      <b>{lead?.name ?? draft.lead.agentId}</b>
      <span>r{draft.lead.revision}</span>
      <span>{modelChoiceLabel(draft.leadModel)}</span>
    </section>
    <div className={css.teamDraftMembers}>{draft.members.map((member) => {
      const definition = currentById.get(member.agent.agentId)
      return <section key={member.name}>
        <div>
          <b>{member.name}</b>
          <span>{definition?.name ?? member.agent.agentId} · r{member.agent.revision}</span>
          <span>{modelChoiceLabel(member.model)}</span>
        </div>
        <p>{member.responsibility}</p>
      </section>
    })}</div>
    {draft.diagnostics.length > 0 && <ul className={css.teamDraftDiagnostics}>{draft.diagnostics.map(item => <li key={`${item.code}-${item.message}`} data-level={item.level}>{item.message}</li>)}</ul>}
    {stale && <p className={css.error} role="alert">专家 revision 已变化，请继续对话并重新生成草案。</p>}
    {error !== undefined && <p className={css.error} role="alert">{error}</p>}
    {saved !== undefined && <p className={css.teamDraftSaved}><CheckCircle/>已保存 专家团“{saved.name}”。</p>}
    <footer className={css.teamDraftActions}>
      <button type="button" className={css.primaryButton} disabled={busy !== undefined || stale} onClick={() => { void commit(true) }}><ChatsCircle/>{busy === 'start' ? '正在启动…' : '创建并启动团队'}</button>
      <button type="button" className={css.outlineButton} disabled={busy !== undefined || stale || saved !== undefined} onClick={() => { void commit(false) }}>{busy === 'save' ? '正在保存…' : '仅保存团队'}</button>
      <button type="button" className={css.outlineButton} disabled={busy !== undefined} onClick={() => { openAgentTeamBuilder(seedFromDraft(draft)) }}><PencilSimple/>打开手动编排</button>
      <button type="button" className={css.outlineButton} disabled={busy !== undefined} onClick={focusComposer}>继续修改</button>
    </footer>
  </article>
}
