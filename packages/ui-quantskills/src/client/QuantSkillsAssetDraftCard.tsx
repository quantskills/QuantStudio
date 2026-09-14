import { useMemo, useState } from 'react'
import type {
  QuantSkillsAgentDefinition,
  QuantSkillsAuthoringCommitResult,
  QuantSkillsAuthoringInstalledVersion,
  SessionId,
} from './plugin-types.ts'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import {
  CheckCircleIcon as CheckCircle,
  ChatsCircleIcon as ChatsCircle,
  PencilSimpleIcon as PencilSimple,
  WarningCircleIcon as WarningCircle,
} from '@phosphor-icons/react'
import { CapabilityIcon } from './CapabilityIcon.tsx'
import css from './QuantSkillsApp.module.css'

interface ParsedAssetDraft {
  readonly assetId: string
  readonly assetKind: 'skill' | 'agent'
  readonly declaration: 'SKILL.md' | 'AGENTS.md'
  readonly draftPath: string
  readonly treeDigest: string
  readonly fileCount: number
  readonly totalBytes: number
  readonly requires: readonly string[]
}

type ParsedResult =
  | { readonly kind: 'skills'; readonly count: number }
  | { readonly kind: 'draft'; readonly draft: ParsedAssetDraft }

/** Actions used by the immutable local 技能/专家 confirmation card. */
export interface QuantSkillsAssetDraftCardInjected {
  hooks: { sessions: ObservableSnapshot<SessionListState> }
  sessionId: SessionId
  commitAuthoring: (toolCallId: string, treeDigest: string) => Promise<QuantSkillsAuthoringCommitResult>
  startSkill: (version: QuantSkillsAuthoringInstalledVersion) => Promise<void>
  startAgent: (agent: QuantSkillsAgentDefinition) => Promise<void>
  openManualAgent: (agent?: QuantSkillsAgentDefinition) => void
  focusComposer: () => void
}

type QuantSkillsAssetDraftCardProps = ToolCallViewProps & InjectFace<QuantSkillsAssetDraftCardInjected>

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseResult(text: string): ParsedResult | undefined {
  let value: unknown
  try {
    value = JSON.parse(text) as unknown
  } catch {
    return undefined
  }
  if (!record(value)) return undefined
  if (value.kind === 'skills' && Array.isArray(value.skills)) return { kind: 'skills', count: value.skills.length }
  if (value.kind !== 'draft' || !record(value.draft)) return undefined
  const draft = value.draft
  if (typeof draft.assetId !== 'string'
    || (draft.assetKind !== 'skill' && draft.assetKind !== 'agent')
    || (draft.declaration !== 'SKILL.md' && draft.declaration !== 'AGENTS.md')
    || typeof draft.draftPath !== 'string'
    || typeof draft.treeDigest !== 'string'
    || typeof draft.fileCount !== 'number'
    || typeof draft.totalBytes !== 'number'
    || !Array.isArray(draft.requires)
    || draft.requires.some(item => typeof item !== 'string')) return undefined
  return {
    kind: 'draft',
    draft: {
      assetId: draft.assetId,
      assetKind: draft.assetKind,
      declaration: draft.declaration,
      draftPath: draft.draftPath,
      treeDigest: draft.treeDigest,
      fileCount: draft.fileCount,
      totalBytes: draft.totalBytes,
      requires: draft.requires as readonly string[],
    },
  }
}

/** Explicit confirmation card for one logged local 技能 or 专家 draft. */
export function QuantSkillsAssetDraftCard({
  block,
  callId,
  sessionId,
  useSessions,
  commitAuthoring,
  startSkill,
  startAgent,
  openManualAgent,
  focusComposer,
}: QuantSkillsAssetDraftCardProps) {
  const [busy, setBusy] = useState<'save' | 'start'>()
  const restored = useSessions(state => state.byId[sessionId]?.projectionValues
    ?.quantSkillsAuthoringCommits?.find(commit => commit.toolCallId === callId)?.result)
  const [committedNow, setCommittedNow] = useState<QuantSkillsAuthoringCommitResult>()
  const saved = committedNow ?? restored
  const [error, setError] = useState<string>()
  const parsed = useMemo(() => {
    if (!('kind' in block) || block.isError) return undefined
    return parseResult(block.content.filter(item => item.type === 'text').map(item => item.text).join(''))
  }, [block])
  if (!('kind' in block)) return <div className={css.teamDraftCompact}><CapabilityIcon kind="agent" size={18} bare/>正在校验本地草案…</div>
  if (block.isError) return <div className={css.teamDraftCompact} role="alert"><WarningCircle/>本地草案校验失败。</div>
  if (parsed === undefined) return <div className={css.teamDraftCompact} role="alert"><WarningCircle/>Host 返回了无法识别的创作草案。</div>
  if (parsed.kind === 'skills') return <div className={css.teamDraftCompact}><CheckCircle/>已读取 {parsed.count} 个精确 技能 版本。</div>
  const draft = parsed.draft
  const commit = async (start: boolean): Promise<void> => {
    setBusy(start ? 'start' : 'save')
    setError(undefined)
    try {
      const result = saved ?? await commitAuthoring(callId, draft.treeDigest)
      if (result.kind !== draft.assetKind) throw new Error('Host 返回了与草案类型不一致的创作结果。')
      setCommittedNow(result)
      if (start) {
        if (result.kind === 'skill') await startSkill(result.version)
        else await startAgent(result.agent)
      }
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'QuantSkills 草案保存失败。')
    } finally {
      setBusy(undefined)
    }
  }
  return <article className={css.teamDraftCard}>
    <header><CapabilityIcon kind={draft.assetKind}/><div><h3>{saved?.kind === 'agent' ? saved.agent.name : draft.assetId}</h3><p>{draft.assetKind === 'skill' ? '技能' : '专家'} · {draft.fileCount} 个文件 · {saved ? '已加入我的创建' : '已准备就绪'}</p></div></header>
    <details className={css.draftTechnical}><summary>文件与依赖详情</summary><section className={css.teamDraftLead}>
      <small>本地私有{draft.assetKind === 'skill' ? ' 技能' : ' 专家'}</small>
      <b>{draft.draftPath}</b>
      <span>{draft.treeDigest.slice(0, 18)}…</span>
    </section>
    {draft.requires.length > 0 && <p>依赖技能：{draft.requires.join('、')}</p>}</details>
    {error !== undefined && <p className={css.error} role="alert">{error}</p>}
    {saved !== undefined && <p className={css.teamDraftSaved}><CheckCircle/>已保存“{draft.assetId}”。</p>}
    <footer className={css.teamDraftActions}>
      <button type="button" className={css.primaryButton} disabled={busy !== undefined} onClick={() => { void commit(true) }}><ChatsCircle/>{busy === 'start' ? '正在启动…' : saved ? '开始使用' : '保存并新建会话'}</button>
      {saved === undefined && <button type="button" className={css.outlineButton} disabled={busy !== undefined} onClick={() => { void commit(false) }}>{busy === 'save' ? '正在保存…' : '保存'}</button>}
      {draft.assetKind === 'agent' && <button type="button" className={css.outlineButton} disabled={busy !== undefined} onClick={() => { openManualAgent(saved?.kind === 'agent' ? saved.agent : undefined) }}><PencilSimple/>打开手动配置</button>}
      <button type="button" className={css.outlineButton} disabled={busy !== undefined} onClick={focusComposer}>继续修改</button>
    </footer>
  </article>
}
