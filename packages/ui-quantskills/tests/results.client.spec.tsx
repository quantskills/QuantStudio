// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type {
  SessionListState, SessionSnapshot, UseProjection,
} from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { EMPTY_CHAT_SNAPSHOT } from '../../client-ui-chat/src/client/contract/snapshot.ts'
import type {
  AssistantMessageNode, ChatSnapshot, ToolResultNode,
} from '@deepseek-ai/dsh-client-ui-chat/client'
import type {
  ConversationLocationDataStore, ConversationTurnDataMap, TurnLocation,
} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { bindSnapshotSelector } from './bind-snapshot.ts'
import type {
  QuantSkillsAssetId, QuantSkillsCommitSha, QuantSkillsInstalledVersionId, QuantSkillsSessionBinding,
  QuantSkillsTreeDigest,
} from '@deepseek-ai/dsh-api-remotes/client'
import {
  QuantSkillsResultAction, QuantSkillsResultPanel,
  type QuantSkillsResultActionProps, type QuantSkillsResultProps,
} from '../src/client/QuantSkillsApp.tsx'
import {
  previewableResultPathsForLatestTurn, projectQuantSkillsResults,
} from '../src/client/result-data.ts'
import { createQuantSkillsViewStore } from '../src/client/store.ts'

vi.mock('@deepseek-ai/dsh-client-ui-deliverables/client', () => ({
  producedForClosing: (data: { readonly produced: readonly { readonly path: string }[] } | undefined) => {
    if (data === undefined) return []
    return [...new Set(data.produced.map(item => item.path))]
  },
}))

const SESSION_ID = 'qs-results' as SessionId
const conversationDeliverables = {} as QuantSkillsResultProps['deliverables']
const binding: QuantSkillsSessionBinding = {
  assetId: 'skill-five-day-momentum' as QuantSkillsAssetId,
  versionId: 'skill-five-day-momentum@aaaaaaaaaaaa' as QuantSkillsInstalledVersionId,
  commit: 'a'.repeat(40) as QuantSkillsCommitSha,
  treeDigest: 'b'.repeat(64) as QuantSkillsTreeDigest,
}

class TurnDataStore implements ConversationLocationDataStore<ConversationTurnDataMap> {
  private readonly values = new Map<string, unknown>()

  get<Key extends Extract<keyof ConversationTurnDataMap, string>>(
    key: Key,
  ): Readonly<ConversationTurnDataMap[Key]> | undefined {
    return this.values.get(key) as Readonly<ConversationTurnDataMap[Key]> | undefined
  }

  set<Key extends Extract<keyof ConversationTurnDataMap, string>>(
    key: Key,
    value: ConversationTurnDataMap[Key],
  ): void {
    this.values.set(key, value)
  }
}

function toolResult(
  callId: string,
  name: string,
  time: number,
  isError: boolean,
  subCalls: ToolResultNode[] = [],
): ToolResultNode {
  return {
    kind: 'tool-result',
    seq: time,
    time,
    callId,
    call: { name, argsRaw: '{}' },
    callTime: time - 10,
    content: [{ type: 'text', text: isError ? 'failed' : 'done' }],
    isError,
    ...(isError ? { error: { name: 'ToolError', code: 'failed' } } : {}),
    callView: null,
    resultView: null,
    subCalls,
  }
}

function conversation(
  producedPaths: readonly string[] = ['reports/momentum.pdf', 'data/signals.csv'],
  running = true,
  assistantText?: string,
): ChatSnapshot {
  const data = new TurnDataStore()
  data.set('deliverables', {
    produced: producedPaths.map((path, index) => ({ seq: index + 5, path })),
  })
  const turn: TurnLocation = {
    turn: 1,
    start: undefined,
    end: undefined,
    status: 'closed',
    steps: [],
    data,
  }
  const child = toolResult('child-failed', 'panda_query', 1_787_171_201_000, true)
  const completed = toolResult('root-complete', 'write_report', 1_787_171_202_000, false, [child])
  const assistant: AssistantMessageNode | undefined = assistantText === undefined ? undefined : {
    kind: 'assistant',
    seq: 8,
    time: 1_787_171_202_500,
    turn: 1,
    step: 1,
    blocks: [{ kind: 'text', text: assistantText }],
  }
  return {
    ...EMPTY_CHAT_SNAPSHOT,
    timeline: { turnOrder: [1], turns: new Map([[1, turn]]) },
    legacy: {
      ...EMPTY_CHAT_SNAPSHOT.legacy,
      nodes: assistant === undefined ? [completed] : [completed, assistant],
      runningCalls: running ? [{
        callId: 'live-call',
        name: 'python',
        argsRaw: '{}',
        turn: 2,
        step: 1,
        time: 1_787_171_203_000,
        callView: null,
        subCalls: [],
      }] : [],
    },
  }
}

function sessionSnapshot(running = true): SessionSnapshot {
  return {
    sessionId: SESSION_ID,
    queue: [],
    pendingSubmissions: [],
    running,
    subagent: null,
    removed: false,
    openState: 'open',
    openError: null,
    hasMore: true,
    loadingOlder: false,
    promptError: null,
    blank: false,
    lastAgentError: null,
    promptAttempted: true,
    awaitingFirstTurn: false,
  }
}

function projection(value: QuantSkillsSessionBinding | null): UseProjection {
  return (key: string) => key === 'quantSkillsSession' ? value : undefined
}

function projections(values: Readonly<Record<string, unknown>>): UseProjection {
  return (key: string) => values[key]
}

function sessions() {
  return bindSnapshotSelector(createSnapshotStore<SessionListState>({
    ids: [SESSION_ID],
    byId: {
      [SESSION_ID]: {
        id: SESSION_ID,
        title: '沪深300动量研究',
        displayTitle: '沪深300动量研究',
        running: true,
        blank: false,
        updatedAt: 1_787_171_203_000,
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

const inputKit: Pick<QuantSkillsResultProps, 'useInput' | 'inputActions'> = {
  useInput: (() => undefined) as QuantSkillsResultProps['useInput'],
  inputActions: {
    setDraft: () => {},
    addImages: () => true,
    removeImage: () => {},
    pruneImages: () => {},
    submit: () => {},
  },
}

function resultProps(
  value: QuantSkillsSessionBinding | null,
  openFile = vi.fn(async () => {}),
  previewFile: QuantSkillsResultProps['previewFile'] = async path => ({
    kind: 'text' as const, path, mediaType: 'text/csv', bytes: 24, text: 'symbol,score\n000001,0.8\n',
  }),
  prepareFiles: QuantSkillsResultProps['prepareFiles'] = async paths => paths.map(path => ({
    sourcePath: path,
    path,
    status: 'ready' as const,
  })),
  listFiles: QuantSkillsResultProps['listFiles'] = async () => [],
): QuantSkillsResultProps {
  return {
    ...inputKit,
    sessionId: SESSION_ID,
    useSession: bindSnapshotSelector(createSnapshotStore(sessionSnapshot())),
    useChat: bindSnapshotSelector(createSnapshotStore(conversation())),
    useProjection: projection(value),
    useSessions: sessions(),
    useWorkspaces: workspaces(),
    mode: 'expanded',
    maximized: false,
    expand: vi.fn(),
    toggleMaximized: vi.fn(),
    close: vi.fn(),
    useResultRequest: bindSnapshotSelector(createQuantSkillsViewStore().create().store),
    deliverables: conversationDeliverables,
    listFiles,
    prepareFiles,
    openFile,
    previewFile,
    openOutputDirectory: async () => {},
    continueWithResults: async () => {},
    acknowledgePreviewFocus: () => {},
    triggerRef: { current: null },
    docked: false,
  }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('QuantSkills real result projection', () => {
  it('browses the workspace before the conversation produces any artifacts', async () => {
    const previewFile = vi.fn<QuantSkillsResultProps['previewFile']>(async (path: string) => ({ kind: 'directory' as const, path, bytes: 0, mediaType: 'inode/directory', entries: [] }))
    render(<QuantSkillsResultPanel {...resultProps(binding, undefined, previewFile)}
      useChat={bindSnapshotSelector(createSnapshotStore(conversation([], false)))}/>)
    await screen.findByText('等待第一份产物')
    fireEvent.click(screen.getByRole('button', { name: '浏览当前工作区' }))
    await waitFor(() => expect(previewFile).toHaveBeenCalledWith('.'))
    expect(await screen.findByRole('region', { name: '. 预览' })).toBeDefined()
  })
  it('derives files and Tool lifecycle only from the current Conversation snapshot', () => {
    const result = projectQuantSkillsResults(conversation(), true)

    expect(result.files.map(file => file.path)).toEqual([
      'reports/momentum.pdf',
      'data/signals.csv',
    ])
    expect(result.activity.map(row => [row.name, row.status])).toEqual([
      ['python', 'running'],
      ['write_report', 'succeeded'],
      ['panda_query', 'failed'],
    ])
    expect(result).toMatchObject({
      settledToolCount: 2,
      failedToolCount: 1,
      runningToolCount: 1,
      turnCount: 1,
      hasOlderHistory: true,
    })
  })

  it('adds explicit workspace artifacts from Assistant delivery prose', () => {
    const result = projectQuantSkillsResults(conversation(
      ['reports/momentum.pdf'],
      false,
      [
        '交付：`outputs/live/report.html`、`outputs/live/decision_matrix.csv`。',
        '忽略命令 `py -3.10 scripts/run.py`、遍历 `../secret.txt`、绝对路径 `C:/secret.txt`。',
        '重复 `outputs/live/report.html`。',
      ].join('\n'),
    ))

    expect(result.files.map(file => file.path)).toEqual([
      'outputs/live/report.html',
      'outputs/live/decision_matrix.csv',
      'reports/momentum.pdf',
    ])
  })

  it('keeps uncommon result formats available through the system-open fallback', () => {
    expect(previewableResultPathsForLatestTurn(conversation([
      'output/report.md',
      'output/chart.png',
      'output/signals.csv',
      'output/analyze.py',
      'output/dashboard.tsx',
      'output/theme.scss',
      'output/archive.bin',
      'output/dashboard.html',
    ]))).toEqual([
      'output/report.md',
      'output/chart.png',
      'output/signals.csv',
      'output/analyze.py',
      'output/dashboard.tsx',
      'output/theme.scss',
      'output/archive.bin',
      'output/dashboard.html',
    ])
    expect(previewableResultPathsForLatestTurn(
      conversation(['output/archive.bin']),
    )).toEqual(['output/archive.bin'])
    expect(previewableResultPathsForLatestTurn({
      ...conversation(),
      timeline: { turnOrder: [], turns: new Map() },
    })).toEqual([])
    expect(previewableResultPathsForLatestTurn({
      ...conversation(),
      timeline: { turnOrder: [99], turns: new Map() },
    })).toEqual([])
  })

  it('previews only real files through the Host Remote and keeps an explicit external-open action', async () => {
    const openFile = vi.fn(async () => {})
    const openOutputDirectory = vi.fn(async () => {})
    const previewFile = vi.fn(async (path: string) => ({
      kind: 'text' as const,
      path,
      mediaType: 'text/csv',
      bytes: 24,
      text: 'symbol,score\n000001,0.8\n',
    }))
    render(<QuantSkillsResultPanel
      {...resultProps(binding, openFile, previewFile)}
      openOutputDirectory={openOutputDirectory}
    />)

    expect(screen.getByRole('region', { name: '结果工作台' })).toBeTruthy()
    const closeResult = screen.getByRole('button', { name: '收起结果工作台' })
    expect(closeResult).toBeTruthy()
    expect(screen.getByRole('button', { name: '全屏显示结果工作台' })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: '文件与预览分类' })).toBeTruthy()
    await waitFor(() => { expect(screen.getAllByText('momentum.pdf')).toHaveLength(1) })
    expect(screen.queryByText('factor_report.pdf')).toBeNull()
    expect(screen.queryByText('23.68%')).toBeNull()
    await vi.waitFor(() => { expect(previewFile).toHaveBeenCalledWith('reports/momentum.pdf') })
    await vi.waitFor(() => { expect(screen.getByText(/symbol,score/)).toBeTruthy() })

    expect(screen.queryByRole('navigation', { name: '工作空间文件导航' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '显示工作空间文件导航' }))
    fireEvent.click(screen.getByRole('button', { name: /signals\.csv/ }))
    await vi.waitFor(() => { expect(previewFile).toHaveBeenCalledWith('data/signals.csv') })
    await vi.waitFor(() => { expect(screen.getByRole('cell', { name: '000001' })).toBeTruthy() })
    expect(screen.getByRole('columnheader', { name: 'symbol' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /signals.csv/ }).getAttribute('aria-selected')).toBe('true')
    const previewNode = screen.getByRole('cell', { name: '000001' })
    const beforeToggle = previewFile.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: '隐藏工作空间文件导航' }))
    expect(screen.queryByRole('navigation', { name: '工作空间文件导航' })).toBeNull()
    expect(screen.getByRole('cell', { name: '000001' })).toBe(previewNode)
    expect(previewFile).toHaveBeenCalledTimes(beforeToggle)
    fireEvent.click(document.querySelector('summary[aria-label="更多产物操作与说明"]')!)
    expect(screen.getByRole('button', { name: '打开产物目录' }).closest('header')).not.toBeNull()
    expect(screen.getByRole('region', { name: '结果工作台' }).querySelector('footer')).toBeNull()
    const callsBeforeRefresh = previewFile.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: '刷新当前产物 data/signals.csv' }))
    await vi.waitFor(() => { expect(previewFile).toHaveBeenCalledTimes(callsBeforeRefresh + 1) })
    fireEvent.click(screen.getByRole('button', { name: '打开产物目录' }))
    await vi.waitFor(() => { expect(previewFile).toHaveBeenCalledWith('data') })
    expect(openOutputDirectory).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '关闭 data 标签' }))
    fireEvent.click(screen.getByRole('button', { name: '关闭 signals.csv 标签' }))
    expect(screen.queryByRole('tab', { name: /signals.csv/ })).toBeNull()

    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: '使用系统应用完整打开 reports/momentum.pdf' })).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: '使用系统应用完整打开 reports/momentum.pdf' }))
    expect(openFile).toHaveBeenCalledWith('reports/momentum.pdf')

    expect(screen.getByRole('navigation', { name: '文件与预览分类' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '概览' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /文件.*2/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: '网页预览' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '变更' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^运行(?:\s|$)/u })).toBeNull()
    expect(screen.queryByText('write_report')).toBeNull()
    expect(screen.queryByText('panda_query')).toBeNull()
  })

  it('keeps a functional progress and deliverables rail when the workbench is collapsed', async () => {
    const expand = vi.fn()
    const toggleMaximized = vi.fn()
    const previewFile = vi.fn(async (path: string) => ({
      kind: 'text' as const,
      path,
      mediaType: path.endsWith('.html') ? 'text/html' : 'text/csv',
      bytes: 42,
      text: path.endsWith('.html') ? '<main>研究速览</main>' : 'symbol,score\n000001,0.8\n',
    }))
    const props = {
      ...resultProps(binding, undefined, previewFile),
      mode: 'rail' as const,
      expand,
      toggleMaximized,
    }
    render(<QuantSkillsResultPanel {...props}/>)

    expect(screen.getByRole('complementary', { name: '对话进度与交付物' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '进度' }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('任务进行中')).toBeTruthy()
    expect(screen.getByRole('button', { name: /交付物/ }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: '打开浏览器' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '打开工作空间文件' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '展开结果工作台' })).toBeTruthy()

    await waitFor(() => { expect(screen.getByRole('button', { name: /momentum\.pdf/ })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '打开浏览器' }))
    expect(expand).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: /momentum\.pdf/ }))
    await waitFor(() => { expect(previewFile).toHaveBeenCalledWith('reports/momentum.pdf') })
    expect(expand).toHaveBeenCalledTimes(2)
    expect(toggleMaximized).not.toHaveBeenCalled()
  })

  it('wires the expanded window and browser controls to real workbench actions', async () => {
    const close = vi.fn()
    const toggleMaximized = vi.fn()
    const revealFile = vi.fn(async () => {})
    const saveFileAs = vi.fn(async () => {})
    const previewFile = vi.fn(async (path: string) => ({
      kind: 'text' as const,
      path,
      mediaType: 'text/html',
      bytes: 42,
      text: `<main>${path}</main>`,
    }))
    render(<QuantSkillsResultPanel
      {...resultProps(binding, undefined, previewFile)}
      close={close}
      toggleMaximized={toggleMaximized}
      revealFile={revealFile}
      saveFileAs={saveFileAs}
      useChat={bindSnapshotSelector(createSnapshotStore(conversation([
        'outputs/overview.html',
        'outputs/details.html',
      ], false)))}
    />)

    await waitFor(() => { expect(screen.getByTitle('outputs/overview.html HTML 预览')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '全屏显示结果工作台' }))
    expect(toggleMaximized).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: '收起结果工作台' }))
    expect(close).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: '在文件夹中显示 outputs/overview.html' }))
    expect(revealFile).toHaveBeenCalledWith('outputs/overview.html')
    fireEvent.click(screen.getByRole('button', { name: '另存为 outputs/overview.html' }))
    expect(saveFileAs).toHaveBeenCalledWith('outputs/overview.html')

    expect((screen.getByRole('button', { name: '后退' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /^文件/ }))
    fireEvent.click(screen.getByRole('button', { name: '显示工作空间文件导航' }))
    fireEvent.click(screen.getByRole('button', { name: /details\.html/ }))
    await waitFor(() => { expect(screen.getByTitle('outputs/details.html HTML 预览')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: '网页预览' }))
    await waitFor(() => { expect(screen.getByTitle('outputs/overview.html HTML 预览')).toBeTruthy() })
    expect((screen.getByRole('button', { name: '前进' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: '前进' }))
    await waitFor(() => { expect(screen.getByTitle('outputs/details.html HTML 预览')).toBeTruthy() })
    expect((screen.getByRole('button', { name: '后退' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: '后退' }))
    await waitFor(() => { expect(screen.getByTitle('outputs/overview.html HTML 预览')).toBeTruthy() })
  })

  it('opens and focuses the exact file requested from prose once per explicit link sequence', async () => {
    const previewFile = vi.fn(async (path: string) => ({
      kind: 'text' as const,
      path,
      mediaType: 'text/csv',
      bytes: 24,
      text: 'symbol,score\n000001,0.8\n',
    }))
    const view = createQuantSkillsViewStore().create()
    view.actions.requestResultPreview(SESSION_ID, 'data/signals.csv')
    const previousFocus = document.createElement('button')
    document.body.append(previousFocus)
    previousFocus.focus()
    render(<QuantSkillsResultPanel
      {...resultProps(binding, undefined, previewFile)}
      useResultRequest={bindSnapshotSelector(view.store)}
      acknowledgePreviewFocus={(sequence) => {
        view.actions.acknowledgeResultPreviewFocus(SESSION_ID, sequence)
      }}
      docked
    />)

    await vi.waitFor(() => { expect(previewFile).toHaveBeenCalledWith('data/signals.csv') })
    expect(screen.getByRole('tab', { name: /signals.csv/ }).getAttribute('aria-selected')).toBe('true')
    const previewTitle = await screen.findByRole('heading', { name: 'data/signals.csv' })
    await waitFor(() => { expect(document.activeElement).toBe(previewTitle) })
    expect(previewTitle.getAttribute('tabindex')).toBe('-1')
    expect(view.store.getSnapshot().resultPreviewRequest?.focusPending).toBe(false)

    cleanup()
    previousFocus.focus()
    previewFile.mockClear()
    render(<QuantSkillsResultPanel
      {...resultProps(binding, undefined, previewFile)}
      useResultRequest={bindSnapshotSelector(view.store)}
      acknowledgePreviewFocus={(sequence) => {
        view.actions.acknowledgeResultPreviewFocus(SESSION_ID, sequence)
      }}
      docked
    />)
    await vi.waitFor(() => { expect(previewFile).toHaveBeenCalledWith('data/signals.csv') })
    expect(document.activeElement).toBe(previousFocus)
    previousFocus.remove()
  })

  it('loads complete PDF views from the authenticated Host stream instead of a base64 data URL', async () => {
    const path = 'output/reports_pdf/大型研报.pdf'
    render(<QuantSkillsResultPanel
      {...resultProps(binding, undefined, async () => ({
        kind: 'resource',
        path,
        mediaType: 'application/pdf',
        bytes: 25 * 1024 * 1024,
        url: `/api/quantskills.result.file?sessionId=${SESSION_ID}&path=output%2Freports_pdf%2F%E5%A4%A7%E5%9E%8B%E7%A0%94%E6%8A%A5.pdf`,
        presentation: 'pdf',
      }))}
      useChat={bindSnapshotSelector(createSnapshotStore(conversation([path], false)))}
    />)

    const frame = await screen.findByTitle(`${path} PDF 完整视图`)
    expect(frame.querySelector('canvas')).not.toBeNull()
    expect(frame.querySelector('iframe')).toBeNull()
  })

  it('navigates from a directory row to the selected file in the same result pane', async () => {
    const directory = 'output/reports_pdf'
    const child = `${directory}/研报.pdf`
    const previewFile = vi.fn<QuantSkillsResultProps['previewFile']>(async path => path === directory
      ? {
        kind: 'directory',
        path,
        bytes: 0,
        entries: [{ name: '研报.pdf', path: child, type: 'file', bytes: 1024 }],
      }
      : {
        kind: 'resource',
        path,
        mediaType: 'application/pdf',
        bytes: 1024,
        url: `/api/quantskills.result.file?sessionId=${SESSION_ID}&path=${encodeURIComponent(path)}`,
        presentation: 'pdf',
      })
    render(<QuantSkillsResultPanel
      {...resultProps(binding, undefined, previewFile)}
      useChat={bindSnapshotSelector(createSnapshotStore(conversation([directory], false)))}
    />)

    const row = await screen.findByRole('button', { name: /研报\.pdf/ })
    row.click()
    await vi.waitFor(() => { expect(previewFile).toHaveBeenCalledWith(child) })
    expect(await screen.findByTitle(`${child} PDF 完整视图`)).toBeDefined()
  })

  it('shows only Host-prepared artifacts and opens normalized workspace paths', async () => {
    const prepareFiles = vi.fn<QuantSkillsResultProps['prepareFiles']>(async paths => [
      {
        sourcePath: paths[0]!,
        path: 'output/quantskills/skill-fin-news/report.md',
        status: 'archived',
      },
      {
        sourcePath: paths[1]!,
        path: paths[1]!,
        status: 'unavailable',
        reason: 'legacy output missing',
      },
    ])
    const openFile = vi.fn(async () => {})
    const previewFile = vi.fn(async (path: string) => ({
      kind: 'text' as const,
      path,
      mediaType: 'text/markdown',
      bytes: 12,
      text: '# 已归档报告',
    }))
    const continueWithResults = vi.fn(async () => {})
    const props = {
      ...resultProps(binding, openFile, previewFile, prepareFiles),
      useChat: bindSnapshotSelector(createSnapshotStore(conversation([
        'legacy/output/report.md',
        'legacy/output/missing.md',
      ], false))),
      continueWithResults,
    }
    render(<QuantSkillsResultPanel {...props}/>)

    await waitFor(() => {
      expect(prepareFiles).toHaveBeenCalledWith(
        ['legacy/output/report.md', 'legacy/output/missing.md'],
        expect.any(AbortSignal),
      )
    })
    await waitFor(() => {
      expect(previewFile).toHaveBeenCalledWith('output/quantskills/skill-fin-news/report.md')
    })
    expect(screen.getAllByText(/已归档/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/legacy output missing/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'missing.md 产物不可用' })).toBeNull()
    expect(previewFile).not.toHaveBeenCalledWith('legacy/output/report.md')
    expect(previewFile).not.toHaveBeenCalledWith('legacy/output/missing.md')

    fireEvent.click(screen.getByRole('button', {
      name: '使用系统应用完整打开 output/quantskills/skill-fin-news/report.md',
    }))
    expect(openFile).toHaveBeenCalledWith('output/quantskills/skill-fin-news/report.md')
    fireEvent.click(screen.getByRole('button', { name: '携带产物到新会话' }))
    await waitFor(() => {
      expect(continueWithResults).toHaveBeenCalledWith(['output/quantskills/skill-fin-news/report.md'])
    })
  })

  it('deduplicates prepared paths without collapsing valid same-named artifacts', async () => {
    const listFiles = vi.fn<QuantSkillsResultProps['listFiles']>(async () => [
      {
        sourcePath: 'legacy/AGENTS.md',
        path: '',
        status: 'unavailable',
        reason: 'Result is outside the Session workspace',
      },
      {
        sourcePath: 'quantskills-drafts/agent-a/AGENTS.md',
        path: 'quantskills-drafts/agent-a/AGENTS.md',
        status: 'ready',
      },
    ])
    const prepareFiles = vi.fn<QuantSkillsResultProps['prepareFiles']>(async paths => [
      {
        sourcePath: paths[0]!,
        path: 'quantskills-drafts/agent-a/AGENTS.md',
        status: 'ready',
      },
      {
        sourcePath: paths[1]!,
        path: 'quantskills-drafts/agent-b/AGENTS.md',
        status: 'ready',
      },
    ])
    const previewFile = vi.fn(async (path: string) => ({
      kind: 'text' as const,
      path,
      mediaType: 'text/markdown',
      bytes: 8,
      text: `# ${path}`,
    }))
    render(<QuantSkillsResultPanel
      {...resultProps(binding, undefined, previewFile, prepareFiles, listFiles)}
      useChat={bindSnapshotSelector(createSnapshotStore(conversation([
        'quantskills-drafts/agent-a/AGENTS.md',
        'quantskills-drafts/agent-b/AGENTS.md',
      ], false)))}
    />)

    await waitFor(() => expect(previewFile).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: '显示工作空间文件导航' }))
    expect(await screen.findByRole('navigation', { name: '工作空间文件导航' })).toBeTruthy()
    expect(screen.getAllByText('AGENTS.md').length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByText(/Result is outside the Session workspace/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'AGENTS.md 产物不可用' })).toBeNull()
    expect(previewFile).toHaveBeenCalledWith('quantskills-drafts/agent-a/AGENTS.md')
  })

  it('ignores stale result preparation when Conversation candidates change', async () => {
    let resolveOld: ((value: Awaited<ReturnType<QuantSkillsResultProps['prepareFiles']>>) => void) | undefined
    let resolveNew: ((value: Awaited<ReturnType<QuantSkillsResultProps['prepareFiles']>>) => void) | undefined
    const prepareFiles = vi.fn<QuantSkillsResultProps['prepareFiles']>(paths => new Promise((resolve) => {
      if (paths[0] === 'output/old.md') resolveOld = resolve
      else resolveNew = resolve
    }))
    const previewFile = vi.fn(async (path: string) => ({
      kind: 'text' as const,
      path,
      mediaType: 'text/markdown',
      bytes: 8,
      text: '# 最新',
    }))
    const chat = createSnapshotStore<ChatSnapshot>(conversation(['output/old.md'], false))
    render(<QuantSkillsResultPanel
      {...resultProps(binding, undefined, previewFile, prepareFiles)}
      useChat={bindSnapshotSelector(chat)}
    />)

    expect(await screen.findByText('正在准备工作台')).toBeTruthy()
    act(() => { chat.set(conversation(['output/new.md'], false)) })
    await waitFor(() => { expect(prepareFiles).toHaveBeenCalledTimes(2) })
    await act(async () => {
      resolveNew?.([{ sourcePath: 'output/new.md', path: 'output/new.md', status: 'ready' }])
    })
    await waitFor(() => { expect(previewFile).toHaveBeenCalledWith('output/new.md') })
    await act(async () => {
      resolveOld?.([{ sourcePath: 'output/old.md', path: 'output/old.md', status: 'ready' }])
    })
    expect(previewFile).not.toHaveBeenCalledWith('output/old.md')
    expect(screen.queryByText('old.md')).toBeNull()
  })

  it('keeps the prepared preview selected while streaming snapshots preserve the artifact set', async () => {
    const prepareFiles = vi.fn<QuantSkillsResultProps['prepareFiles']>(async paths => paths.map(path => ({
      sourcePath: path,
      path,
      status: 'ready',
    })))
    const previewFile = vi.fn(async (path: string) => ({
      kind: 'text' as const,
      path,
      mediaType: 'text/markdown',
      bytes: 8,
      text: `# ${path}`,
    }))
    const chat = createSnapshotStore<ChatSnapshot>(conversation(undefined, true))
    render(<QuantSkillsResultPanel
      {...resultProps(binding, undefined, previewFile, prepareFiles)}
      useChat={bindSnapshotSelector(chat)}
    />)

    await waitFor(() => { expect(previewFile).toHaveBeenCalledWith('reports/momentum.pdf') })
    fireEvent.click(screen.getByRole('button', { name: '显示工作空间文件导航' }))
    fireEvent.click(screen.getByRole('button', { name: /signals\.csv/ }))
    await waitFor(() => { expect(previewFile).toHaveBeenCalledWith('data/signals.csv') })
    expect(screen.getByRole('tab', { name: /signals.csv/ }).getAttribute('aria-selected')).toBe('true')

    act(() => {
      chat.set(conversation(undefined, true, '仍在生成分析内容。'))
    })

    expect(prepareFiles).toHaveBeenCalledOnce()
    expect(previewFile).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('tab', { name: /signals.csv/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByText('正在准备工作台')).toBeNull()
  })

  it('restores complete historical artifacts when the loaded Conversation window has no candidates', async () => {
    const complete = [
      'output/理想反转因子复现/report.md',
      'output/理想反转因子复现/research_journal.md',
      'output/理想反转因子复现/handoff_card.md',
      'output/理想反转因子复现/generated_brief.md',
      'output/理想反转因子复现/methodology.md',
      'output/理想反转因子复现/data_dictionary.csv',
      'panda_smoke.py',
    ]
    const listFiles = vi.fn<QuantSkillsResultProps['listFiles']>(async () => complete.map(path => ({
      sourcePath: path,
      path,
      status: 'ready',
    })))
    const prepareFiles = vi.fn<QuantSkillsResultProps['prepareFiles']>()
    const previewFile = vi.fn(async (path: string) => ({
      kind: 'text' as const,
      path,
      mediaType: 'text/markdown',
      bytes: 8,
      text: `# ${path}`,
    }))
    render(<QuantSkillsResultPanel
      {...resultProps(binding, undefined, previewFile, prepareFiles, listFiles)}
      useChat={bindSnapshotSelector(createSnapshotStore(conversation([], false)))}
    />)

    await waitFor(() => expect(previewFile).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: '显示工作空间文件导航' }))
    expect(await screen.findByRole('navigation', { name: '工作空间文件导航' })).toBeTruthy()
    expect(screen.getAllByText('report.md').length).toBeGreaterThan(0)
    expect(screen.getAllByText('panda_smoke.py').length).toBeGreaterThan(0)
    expect(listFiles).toHaveBeenCalledWith(expect.any(AbortSignal))
    expect(prepareFiles).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(previewFile).toHaveBeenCalledWith('output/理想反转因子复现/report.md')
    })
  })

  it('renders Markdown, sandboxed HTML, code, and extracted documents in the preview workbench', async () => {
    const previews: Record<string, Awaited<ReturnType<QuantSkillsResultProps['previewFile']>>> = {
      'reports/momentum.pdf': {
        kind: 'text', path: 'reports/momentum.pdf', mediaType: 'text/markdown', bytes: 24,
        text: '# 动量报告\n\n| 股票 | 得分 |\n| --- | --- |\n| 平安银行 | 0.8 |',
      },
      'data/signals.csv': {
        kind: 'text', path: 'data/signals.csv', mediaType: 'text/html', bytes: 34,
        text: '<h1>信号页面</h1><script>window.top.location="https://example.com"</script>',
      },
    }
    const props = resultProps(binding, vi.fn(async () => {}), async path => previews[path]!)
    render(<QuantSkillsResultPanel {...props}/>)

    await vi.waitFor(() => { expect(screen.getByRole('heading', { name: '动量报告' })).toBeTruthy() })
    expect(screen.getByText('平安银行')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '显示工作空间文件导航' }))
    fireEvent.click(screen.getByRole('button', { name: /signals\.csv/ }))
    const html = await screen.findByTitle('data/signals.csv HTML 预览')
    expect(html.getAttribute('sandbox')).toBe('allow-scripts')
    expect(html.getAttribute('srcdoc')).toContain("default-src 'none'")

    cleanup()
    const documentProps = resultProps(binding, vi.fn(async () => {}), async path => ({
      kind: 'document', path, mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      bytes: 128, text: '量化研究结论\n风险提示', truncated: false,
    }))
    render(<QuantSkillsResultPanel {...documentProps}/>)
    await vi.waitFor(() => { expect(screen.getByText(/量化研究结论/)).toBeTruthy() })
    expect(screen.getByText(/风险提示/)).toBeTruthy()
  })

  it('uses one customer-safe workspace for browser, files, changes, and always-visible navigation', async () => {
    const previewFile = vi.fn(async (path: string) => ({
      kind: 'text' as const,
      path,
      mediaType: 'text/html',
      bytes: 42,
      text: '<main><h1>投研速览</h1></main>',
    }))
    render(<QuantSkillsResultPanel
      {...resultProps(binding, undefined, previewFile)}
      useChat={bindSnapshotSelector(createSnapshotStore(conversation(['outputs/report.html'], false)))}
    />)

    expect(await screen.findByRole('tabpanel', { name: '网页预览' })).toBeTruthy()
    expect(await screen.findByTitle('outputs/report.html HTML 预览')).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'report.html' }).getAttribute('aria-selected')).toBe('true')

    expect(screen.getByRole('navigation', { name: '文件与预览分类' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '变更' }))
    expect(screen.getByRole('tabpanel', { name: '变更' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '显示工作空间文件导航' }))
    expect(screen.getByRole('navigation', { name: '文件变更导航' })).toBeTruthy()
    expect(screen.getByText('新增文件 · 42 字节')).toBeTruthy()
    expect(screen.queryByText('write_report')).toBeNull()
    expect(screen.queryByText('call-write')).toBeNull()
  })

  it('shows an explicit overview instead of an empty preview canvas when no file exists', async () => {
    render(<QuantSkillsResultPanel
      {...resultProps(binding)}
      useChat={bindSnapshotSelector(createSnapshotStore(conversation([], false)))}
    />)

    expect(await screen.findByRole('tabpanel', { name: '概览' })).toBeTruthy()
    expect(screen.getByText(/让专家生成一份报告或图表/)).toBeTruthy()
    expect(screen.queryByText('选择一个产物开始预览')).toBeNull()
  })

  it('exposes the result action and drawer for a plain QuantSkills Session', () => {
    const open = vi.fn()
    const useProjection = projections({ quantSkillsPlainSession: { purpose: 'ordinary' } })
    const actionProps: QuantSkillsResultActionProps = {
      ...inputKit,
      sessionId: SESSION_ID,
      useSession: bindSnapshotSelector(createSnapshotStore(sessionSnapshot())),
      useChat: bindSnapshotSelector(createSnapshotStore(conversation())),
      useProjection,
      useSessions: sessions(),
      useWorkspaces: workspaces(),
      open,
      complete: vi.fn(),
      deliverables: conversationDeliverables,
    }
    render(<>
      <QuantSkillsResultAction {...actionProps}/>
      <QuantSkillsResultPanel {...resultProps(null)} useProjection={useProjection}/>
    </>)

    fireEvent.click(screen.getByRole('button', { name: /QuantSkills 普通会话 本对话结果/ }))
    expect(open).toHaveBeenCalledOnce()
    expect(screen.getByRole('region', { name: '结果工作台' })).toBeTruthy()
  })

  it('does not expose either the header action or drawer for a native Host Session', () => {
    const open = vi.fn()
    const actionProps: QuantSkillsResultActionProps = {
      ...inputKit,
      sessionId: SESSION_ID,
      useSession: bindSnapshotSelector(createSnapshotStore(sessionSnapshot())),
      useChat: bindSnapshotSelector(createSnapshotStore(conversation())),
      useProjection: projection(null),
      useSessions: sessions(),
      useWorkspaces: workspaces(),
      open,
      complete: vi.fn(),
      deliverables: conversationDeliverables,
    }
    const mounted = render(<>
      <QuantSkillsResultAction {...actionProps}/>
      <QuantSkillsResultPanel {...resultProps(null)}/>
    </>)

    expect(mounted.container.childElementCount).toBe(0)
    expect(open).not.toHaveBeenCalled()
  })

  it('exposes the same result workbench for 专家团 lead and member Sessions', () => {
    const owners = [
      {
        values: { quantSkillsAgentTeamSession: { name: '宏观研究团队', revision: 3 } },
        actionName: /宏观研究团队 本对话结果/,
      },
      {
        values: {
          quantSkillsAgentTeamMember: {
            memberName: 'validator',
            teamRevision: 4,
            agent: { name: '独立验证员' },
          },
        },
        actionName: /独立验证员 · validator 本对话结果/,
      },
    ]
    for (const owner of owners) {
      const useProjection = projections(owner.values)
      const actionProps: QuantSkillsResultActionProps = {
        ...inputKit,
        sessionId: SESSION_ID,
        useSession: bindSnapshotSelector(createSnapshotStore(sessionSnapshot(false))),
        useChat: bindSnapshotSelector(createSnapshotStore(conversation(undefined, false))),
        useProjection,
        useSessions: sessions(),
        useWorkspaces: workspaces(),
        open: vi.fn(),
        complete: vi.fn(),
        deliverables: conversationDeliverables,
      }
      render(<>
        <QuantSkillsResultAction {...actionProps}/>
        <QuantSkillsResultPanel {...resultProps(null)} useProjection={useProjection}/>
      </>)

      expect(screen.getByRole('button', { name: owner.actionName })).toBeTruthy()
      expect(screen.getByRole('region', { name: '结果工作台' })).toBeTruthy()
      cleanup()
    }
  })

  it('opens once when the mounted Session finishes a live run, but not for completed history', async () => {
    const session = createSnapshotStore<SessionSnapshot>(sessionSnapshot(false))
    const chat = createSnapshotStore<ChatSnapshot>(conversation(undefined, false))
    const open = vi.fn()
    const complete = vi.fn()
    const actionProps: QuantSkillsResultActionProps = {
      ...inputKit,
      sessionId: SESSION_ID,
      useSession: bindSnapshotSelector(session),
      useChat: bindSnapshotSelector(chat),
      useProjection: projection(binding),
      useSessions: sessions(),
      useWorkspaces: workspaces(),
      open,
      complete,
      deliverables: conversationDeliverables,
    }
    render(<QuantSkillsResultAction {...actionProps}/>)
    const composer = document.createElement('textarea')
    document.body.append(composer)
    composer.focus()

    expect(complete).not.toHaveBeenCalled()
    act(() => { session.set(sessionSnapshot(true)) })
    act(() => { session.set(sessionSnapshot(false)) })
    await waitFor(() => { expect(complete).toHaveBeenCalledWith(SESSION_ID) })
    expect(complete).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(composer)
    fireEvent.click(screen.getByRole('button', { name: /本对话结果/ }))
    expect(open).toHaveBeenCalledOnce()
    composer.remove()
  })

  it('opens completed uncommon artifacts through the system-view fallback', async () => {
    const session = createSnapshotStore<SessionSnapshot>(sessionSnapshot(false))
    const chat = createSnapshotStore<ChatSnapshot>(conversation([], false))
    const complete = vi.fn()
    const actionProps: QuantSkillsResultActionProps = {
      ...inputKit,
      sessionId: SESSION_ID,
      useSession: bindSnapshotSelector(session),
      useChat: bindSnapshotSelector(chat),
      useProjection: projection(binding),
      useSessions: sessions(),
      useWorkspaces: workspaces(),
      open: vi.fn(),
      complete,
      deliverables: conversationDeliverables,
    }
    render(<QuantSkillsResultAction {...actionProps}/>)

    act(() => {
      chat.set(conversation([], true))
      session.set(sessionSnapshot(true))
    })
    act(() => { session.set(sessionSnapshot(false)) })
    act(() => {
      chat.set(conversation(['output/archive.bin'], true))
      session.set(sessionSnapshot(true))
    })
    act(() => { session.set(sessionSnapshot(false)) })

    await waitFor(() => { expect(screen.getByRole('button', { name: /本对话结果/ })).toBeTruthy() })
    expect(complete).toHaveBeenCalledWith('qs-results')
  })

  it('uses a modal narrow-screen drawer, closes with Escape, and restores its trigger', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      media: '(max-width: 1180px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })))
    const close = vi.fn()
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    const props = resultProps(binding)
    render(<QuantSkillsResultPanel {...props} close={close} triggerRef={{ current: trigger }}/>)

    const drawer = screen.getByRole('dialog', { name: '结果工作台' })
    expect(drawer.getAttribute('aria-modal')).toBe('true')
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(close).toHaveBeenCalledOnce()
    await vi.waitFor(() => { expect(document.activeElement).toBe(trigger) })
    trigger.remove()
  })
})
