// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  QuantSkillsAuthoringCommitResult,
  QuantSkillsAuthoringInstalledVersion,
  QuantSkillsTreeDigest,
  SessionId,
} from '@deepseek-ai/dsh-api-remotes/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { bindSnapshotSelector } from './bind-snapshot.ts'
import { QuantSkillsAssetDraftCard } from '../src/client/QuantSkillsAssetDraftCard.tsx'
import {
  quantSkillsAuthoringAgentName, quantSkillsAuthoringOpening, quantSkillsAuthoringRole,
} from '../src/client/index.ts'

vi.mock('@deepseek-ai/dsh-client-ui-deliverables/client', () => ({
  producedForClosing: (data: { readonly produced: readonly { readonly path: string }[] } | undefined) => {
    if (data === undefined) return []
    return [...new Set(data.produced.map(item => item.path))]
  },
}))

afterEach(cleanup)

const SESSION_ID = 'authoring-session' as SessionId
const TREE_DIGEST = `sha256:${'b'.repeat(64)}` as QuantSkillsTreeDigest
const version: QuantSkillsAuthoringInstalledVersion = {
  versionId: `skill-local-risk@${'a'.repeat(40)}` as QuantSkillsAuthoringInstalledVersion['versionId'],
  assetId: 'skill-local-risk' as QuantSkillsAuthoringInstalledVersion['assetId'],
  kind: 'skill',
  repository: 'local-authoring:skill-local-risk',
  commit: 'a'.repeat(40) as QuantSkillsAuthoringInstalledVersion['commit'],
  declaration: 'SKILL.md',
  treeDigest: TREE_DIGEST,
  fileCount: 1,
  totalBytes: 128,
  installedAt: 1,
  exposure: 'skill-registry',
  origin: 'local-authoring',
}
const committed: QuantSkillsAuthoringCommitResult = { kind: 'skill', version }

function sessions(result?: QuantSkillsAuthoringCommitResult) {
  return bindSnapshotSelector(createSnapshotStore<SessionListState>({
    ids: [SESSION_ID],
    byId: {
      [SESSION_ID]: {
        id: SESSION_ID,
        displayTitle: '技能 创作',
        blank: false,
        running: false,
        updatedAt: 1,
        projectionValues: result === undefined ? {} : {
          quantSkillsAuthoringCommits: [{
            toolCallId: 'asset-draft-call',
            treeDigest: TREE_DIGEST,
            result,
          }],
        },
      },
    },
    current: SESSION_ID,
    phase: 'ready',
    subagentsByParent: {},
    jobsBySession: {},
    currentAddress: undefined,
  }))
}

function workspaces() {
  return bindSnapshotSelector(createSnapshotStore<WorkspaceSnapshot>({
    items: [],
    archivedSessionIds: [],
    state: 'idle',
    phase: 'ready',
    error: null,
  }))
}

function renderDraft(options: {
  readonly useSessions?: ReturnType<typeof sessions>
  readonly commitAuthoring?: (toolCallId: string, treeDigest: string) => Promise<QuantSkillsAuthoringCommitResult>
} = {}) {
  const commitAuthoring = options.commitAuthoring ?? vi.fn(async () => committed)
  const startSkill = vi.fn(async () => {})
  render(<QuantSkillsAssetDraftCard
    callId="asset-draft-call"
    toolName="quantskills_asset_draft"
    sessionId={SESSION_ID}
    useSessions={options.useSessions ?? sessions()}
    useWorkspaces={workspaces()}
    useSession={(() => { throw new Error('unused') })}
    useProjection={(() => undefined)}
    useInput={(() => { throw new Error('unused') })}
    inputActions={{
      setDraft: () => {}, addImages: () => true, removeImage: () => {}, pruneImages: () => {}, submit: () => {},
    }}
    block={{
      kind: 'tool-result',
      seq: 4,
      time: 5,
      callId: 'asset-draft-call',
      call: { name: 'quantskills_asset_draft', argsRaw: '{}' },
      callTime: 3,
      content: [{
        type: 'text',
        text: JSON.stringify({
          kind: 'draft',
          draft: {
            assetId: 'skill-local-risk',
            assetKind: 'skill',
            declaration: 'SKILL.md',
            draftPath: 'quantskills-drafts/skill/skill-local-risk',
            treeDigest: TREE_DIGEST,
            fileCount: 1,
            totalBytes: 128,
            requires: [],
          },
          diagnostics: [],
        }),
      }],
      isError: false,
      callView: null,
      resultView: null,
      subCalls: [],
    }}
    openFile={() => {}}
    commitAuthoring={commitAuthoring}
    startSkill={startSkill}
    startAgent={async () => {}}
    openManualAgent={() => {}}
    focusComposer={() => {}}
  />)
  return { commitAuthoring, startSkill }
}

describe('QuantSkills authoring Session labels', () => {
  it('keeps the internal assistant branding out of new conversation labels', () => {
    expect(quantSkillsAuthoringAgentName('skill')).toBe('技能 创作')
    expect(quantSkillsAuthoringAgentName('agent')).toBe('专家 创作')
    expect(quantSkillsAuthoringAgentName('agent-team')).toBe('专家团 创作')
  })

  it('collects missing requirements and creates missing roles while keeping final team confirmation', () => {
    const role = quantSkillsAuthoringRole('agent-team')
    const opening = quantSkillsAuthoringOpening('agent-team')
    expect(role).toContain('ask_user_question')
    expect(role).toContain('create-agents')
    expect(role).toContain('确认后保存')
    expect(role).toContain('模型默认跟随当前会话')
    expect(opening).toContain('quantskills_team_draft')
    expect(opening).toContain('展示团队确认卡')
  })

  it('carries a home-page requirement into the 技能 authoring conversation', () => {
    const opening = quantSkillsAuthoringOpening('skill', '创建一个新闻情绪因子 技能')

    expect(opening).toContain('这是用户在首页提交的初始需求：创建一个新闻情绪因子 技能')
    expect(opening).toContain('只追问仍缺少的信息')
  })
})

describe('QuantSkills local asset confirmation card', () => {
  it('does not publish before confirmation and starts only from a committed result', async () => {
    const { commitAuthoring, startSkill } = renderDraft()
    expect(commitAuthoring).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '保存并新建会话' }))
    await waitFor(() => {
      expect(commitAuthoring).toHaveBeenCalledWith('asset-draft-call', TREE_DIGEST)
      expect(startSkill).toHaveBeenCalledWith(version)
    })
    expect(screen.getByText('已保存“skill-local-risk”。')).toBeTruthy()
  })

  it('restores the saved state from the durable Session projection after refresh', () => {
    const commitAuthoring = vi.fn(async () => committed)
    renderDraft({ useSessions: sessions(committed), commitAuthoring })
    expect(screen.getByText('已保存“skill-local-risk”。')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '保存', exact: true })).toBeNull()
    expect(screen.getByRole('button', { name: '开始使用' })).toBeTruthy()
    expect(commitAuthoring).not.toHaveBeenCalled()
  })
})
