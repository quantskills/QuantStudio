/** @vitest-environment jsdom */
/** QuantSkills composer launcher, taxonomy picker, and resident-chip interactions. */

import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  QuantSkillsAgentDefinition, QuantSkillsAgentTeamDefinition, QuantSkillsAssetId, QuantSkillsCommitSha,
  QuantSkillsInstalledVersionId, QuantSkillsPromptFormCapability, QuantSkillsSessionBinding,
  QuantSkillsTreeDigest,
} from '@deepseek-ai/dsh-api-remotes/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import {
  capabilityLibraryRows, QuantSkillsCapabilityPicker, QuantSkillsCapabilityPickerController,
  QuantSkillsResidentControl, quantSkillsLauncherSource,
  type QuantSkillsCapabilityPickerProps, type QuantSkillsResidentControlProps,
} from '../src/client/QuantSkillsCapabilityPicker.tsx'
import { QuantSkillsAttachmentController } from '../src/client/QuantSkillsAttachmentControl.tsx'
import type {
  QuantSkillsAgentsSnapshot, QuantSkillsCatalogSnapshot, QuantSkillsSessionsSnapshot,
} from '../src/client/types.ts'

afterEach(cleanup)

const sessionId = 'session-capability-picker' as SessionId
const binding: QuantSkillsSessionBinding = {
  assetId: 'skill-risk-radar' as QuantSkillsAssetId,
  versionId: 'skill-risk-radar@a' as QuantSkillsInstalledVersionId,
  commit: 'a'.repeat(40) as QuantSkillsCommitSha,
  treeDigest: `sha256:${'b'.repeat(64)}` as QuantSkillsTreeDigest,
}
const agent: QuantSkillsAgentDefinition = {
  agentId: 'agent-1' as QuantSkillsAgentDefinition['agentId'],
  revision: 1,
  name: 'agent-market-regime',
  role: '监控市场状态。',
  mode: 'dynamic',
  permission: 'workspace-write',
  sourceVersionId: `agent-market-regime@${'c'.repeat(40)}` as QuantSkillsInstalledVersionId,
  skills: [binding],
  createdAt: 1,
  updatedAt: 2,
}
const catalogSnapshot: QuantSkillsCatalogSnapshot = {
  phase: 'ready',
  installedPhase: 'ready',
  sync: { mode: 'manual', state: 'idle' },
  categories: [{
    id: 'risk',
    label: '风险监控与预警',
    subcategories: [{ id: 'market-risk', label: '市场风险' }],
  }],
  assets: [{
    name: binding.assetId,
    title: 'A股市场风险雷达',
    catalogTitle: 'A股市场风险雷达',
    englishTitle: 'A-share market risk radar',
    aliases: [],
    nameSource: 'declaration',
    summary: '扫描市场风险。',
    description: '扫描市场风险。',
    projectType: 'skill',
    category: 'risk',
    subcategory: 'market-risk',
    commitSha: binding.commit,
    declarationFile: 'SKILL.md',
    url: 'https://github.com/quantskills/skill-risk-radar',
    health: 'healthy',
    validationLevel: 'approved',
    requires: [],
  }, {
    name: 'agent-market-regime',
    title: '市场状态监控专家',
    catalogTitle: '市场状态监控专家',
    englishTitle: 'Market regime agent',
    aliases: [],
    nameSource: 'generated',
    summary: '识别市场状态。',
    description: '识别市场状态。',
    projectType: 'agent',
    category: 'risk',
    subcategory: 'market-risk',
    commitSha: 'c'.repeat(40),
    declarationFile: 'AGENTS.md',
    url: 'https://github.com/quantskills/agent-market-regime',
    health: 'healthy',
    validationLevel: 'approved',
    requires: [],
  }],
  versionsByAsset: {},
  installing: new Set(),
}
const sessionsSnapshot: QuantSkillsSessionsSnapshot = {
  phase: 'ready',
  plainArchives: [],
  archives: [],
  frequent: [{
    assetId: binding.assetId,
    sessionCount: 3,
    lastUsedAt: 3,
    recentSessionId: sessionId,
  }],
}
const agentsSnapshot: QuantSkillsAgentsSnapshot = {
  phase: 'ready',
  definitions: [agent],
  archives: [{
    sessionId: 'session-agent-market' as SessionId,
    agent,
    createdAt: 2,
    updatedAt: 3,
    archived: false,
    running: false,
    runState: 'completed',
  }],
  teams: [],
  teamArchives: [],
}

describe('QuantSkills composer capability picker', () => {
  it('opens from the plus-menu source and traverses category, subcategory, and 技能 rows', async () => {
    const controller = new QuantSkillsCapabilityPickerController()
    const attachments = new QuantSkillsAttachmentController()
    const openFile = vi.fn()
    attachments.register(sessionId, openFile)
    const source = quantSkillsLauncherSource(controller, attachments)
    const candidates = await source.candidates({ sessionId }, {
      query: '',
      position: 'leading',
      signal: new AbortController().signal,
    })
    expect(source.launcher).toBe(true)
    expect(source.order).toBeLessThan(0)
    expect(candidates.map(candidate => candidate.name)).toEqual(['文件', 'QuantSkills', '常用'])
    expect(source.onPick({
      candidate: candidates[0]!,
      session: { sessionId },
      position: 'leading',
      via: 'menu',
      span: { start: 0, end: 0, draftRev: 0 },
    })).toBe('handled')
    expect(openFile).toHaveBeenCalledTimes(1)
    expect(source.onPick({
      candidate: candidates[1]!,
      session: { sessionId },
      position: 'leading',
      via: 'menu',
      span: { start: 0, end: 0, draftRev: 0 },
    })).toBe('handled')

    const toggleSkill = vi.fn(async () => {})
    const openCatalogAgent = vi.fn(async () => {})
    const view = render(<QuantSkillsCapabilityPicker {...({
      sessionId,
      useProjection: (key: string) => key === 'quantSkillsResidentSkills' ? [binding] : undefined,
      picker: controller.source,
      catalog: createSnapshotStore(catalogSnapshot),
      sessions: createSnapshotStore(sessionsSnapshot),
      agents: createSnapshotStore(agentsSnapshot),
      close: () => { controller.close() },
      toggleSkill,
      openCatalogAgent,
      openUserAgent: vi.fn(async () => {}),
    } as unknown as QuantSkillsCapabilityPickerProps)} />)

    fireEvent.click(view.getByRole('button', { name: '发现的' }))
    fireEvent.change(view.getByRole('combobox', { name: '能力分类' }), { target: { value: 'risk' } })
    fireEvent.change(view.getByRole('combobox', { name: '能力子分类' }), { target: { value: 'market-risk' } })
    fireEvent.click(view.getByRole('button', { name: /A股市场风险雷达/ }))
    await waitFor(() => { expect(toggleSkill).toHaveBeenCalledWith(sessionId, catalogSnapshot.assets[0], binding) })
    await waitFor(() => { expect(view.queryByRole('dialog')).toBeNull() })

    controller.open(sessionId, 'catalog')
    fireEvent.click(await view.findByRole('button', { name: '发现的' }))
    fireEvent.change(view.getByRole('combobox', { name: '能力分类' }), { target: { value: 'risk' } })
    fireEvent.change(view.getByRole('combobox', { name: '能力子分类' }), { target: { value: 'market-risk' } })
    fireEvent.click(view.getByRole('button', { name: /市场状态监控专家/ }))
    await waitFor(() => { expect(openCatalogAgent).toHaveBeenCalledWith(catalogSnapshot.assets[1]) })
  })

  it('shows frequent capabilities and collapses resident items into an upward hot-plug menu', async () => {
    const controller = new QuantSkillsCapabilityPickerController()
    controller.open(sessionId, 'frequent')
    const openUserAgent = vi.fn(async () => {})
    const picker = render(<QuantSkillsCapabilityPicker {...({
      sessionId,
      useProjection: () => [binding],
      picker: controller.source,
      catalog: createSnapshotStore(catalogSnapshot),
      sessions: createSnapshotStore(sessionsSnapshot),
      agents: createSnapshotStore(agentsSnapshot),
      close: () => { controller.close() },
      toggleSkill: vi.fn(async () => {}),
      openCatalogAgent: vi.fn(async () => {}),
      openUserAgent,
    } as unknown as QuantSkillsCapabilityPickerProps)} />)
    fireEvent.click(picker.getByRole('button', { name: /^专家 \d/ }))
    fireEvent.click(picker.getByRole('button', { name: /市场状态监控专家/ }))
    await waitFor(() => { expect(openUserAgent).toHaveBeenCalledWith(agent) })

    const detach = vi.fn(async () => {})
    const openPicker = vi.fn()
    const chips = render(<QuantSkillsResidentControl {...({
      sessionId,
      useProjection: (key: string) => key === 'quantSkillsResidentSkills' ? [binding] : agent,
      catalog: createSnapshotStore(catalogSnapshot),
      detach,
      openPicker,
      listPromptForms: vi.fn(async () => ({ forms: [] })),
      renderPromptForm: vi.fn(async () => ''),
      fillDraft: vi.fn(),
      runPrompt: vi.fn(),
    } as unknown as QuantSkillsResidentControlProps)} />)
    expect(chips.queryByText('市场状态监控专家')).toBeNull()
    const summary = chips.getByRole('button', { name: '本会话已加载 2 项能力' })
    expect(summary.textContent).toBe('2')
    expect(summary.getAttribute('title')).toContain('点击管理')
    fireEvent.click(chips.getByRole('button', { name: '本会话已加载 2 项能力' }))
    expect(chips.getByRole('dialog', { name: '本会话已加载能力' })).toBeDefined()
    expect(chips.getByText('市场状态监控专家')).toBeDefined()
    fireEvent.click(chips.getByRole('button', { name: '卸载 A股市场风险雷达' }))
    await waitFor(() => { expect(detach).toHaveBeenCalledWith(sessionId, binding.assetId) })
    fireEvent.click(chips.getByRole('button', { name: '添加技能、专家或专家团' }))
    expect(openPicker).toHaveBeenCalledWith(sessionId)
  })

  it('keeps the capability entry visible before a Session has loaded any 技能 or 专家', () => {
    const openPicker = vi.fn()
    const view = render(<QuantSkillsResidentControl {...({
      sessionId,
      useProjection: () => undefined,
      catalog: createSnapshotStore(catalogSnapshot),
      detach: vi.fn(async () => {}),
      openPicker,
      listPromptForms: vi.fn(async () => ({ forms: [] })),
      renderPromptForm: vi.fn(async () => ''),
      fillDraft: vi.fn(),
      runPrompt: vi.fn(),
    } as unknown as QuantSkillsResidentControlProps)} />)

    fireEvent.click(view.getByRole('button', { name: '本会话已加载 0 项能力' }))
    expect(view.getByText('当前会话还没有加载 技能 或 专家。')).toBeDefined()
    fireEvent.click(view.getByRole('button', { name: '添加技能、专家或专家团' }))
    expect(openPicker).toHaveBeenCalledWith(sessionId)
  })

  it('renders qsh-form fields in an upward drawer and supports fill and run actions', async () => {
    const form = {
      assetId: binding.assetId,
      versionId: binding.versionId,
      source: 'skill',
      promptForm: {
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
          promptTemplate: '{{task}} {{market}} {{days}}',
        },
      },
    } as const satisfies QuantSkillsPromptFormCapability
    const renderPromptForm = vi.fn(async () => '已渲染参数消息')
    const fillDraft = vi.fn()
    const runPrompt = vi.fn()
    const props = {
      sessionId,
      useProjection: (key: string) => key === 'quantSkillsResidentSkills'
        ? [binding]
        : key === 'quantSkillsAttachments'
          ? [{
            file: { attachmentId: 'attachment-1', name: 'signals.csv', mediaType: 'text/csv', bytes: 10 },
            parsing: { status: 'ready', kind: 'utf8-text' },
            attachedAt: 1,
          }]
          : null,
      catalog: createSnapshotStore(catalogSnapshot),
      detach: vi.fn(async () => {}),
      openPicker: vi.fn(),
      listPromptForms: vi.fn(async () => ({ forms: [form] })),
      renderPromptForm,
      fillDraft,
      runPrompt,
    } as unknown as QuantSkillsResidentControlProps
    const view = render(<QuantSkillsResidentControl {...props}/>)

    fireEvent.click(view.getByRole('button', { name: '本会话已加载 1 项能力' }))
    fireEvent.click(await view.findByRole('button', { name: '参数' }))
    expect(view.getByRole('dialog', { name: 'QuantSkills 参数' })).toBeDefined()
    expect(view.getByRole('status').textContent).toContain('已兼容旧格式')
    expect(view.getByText('signals.csv')).toBeDefined()
    fireEvent.change(view.getByRole('textbox', { name: '参数任务' }), { target: { value: '扫描风险' } })
    fireEvent.change(view.getByRole('spinbutton', { name: '参数 天数' }), { target: { value: '10' } })
    fireEvent.click(view.getByRole('button', { name: '填入输入框' }))
    await waitFor(() => { expect(fillDraft).toHaveBeenCalledWith(sessionId, '已渲染参数消息') })
    expect(renderPromptForm).toHaveBeenCalledWith({
      sessionId,
      versionId: binding.versionId,
      task: '扫描风险',
      values: { market: 'cn', days: '10' },
    })

    fireEvent.click(view.getByRole('button', { name: '本会话已加载 1 项能力' }))
    fireEvent.click(await view.findByRole('button', { name: '参数' }))
    fireEvent.change(view.getByRole('textbox', { name: '参数任务' }), { target: { value: '直接运行' } })
    fireEvent.click(view.getByRole('button', { name: '应用并运行' }))
    await waitFor(() => { expect(runPrompt).toHaveBeenCalledWith(sessionId, '已渲染参数消息') })
  })

  it('keeps invalid forms out of the parameter action while showing a diagnostic', async () => {
    const form = {
      assetId: binding.assetId,
      versionId: binding.versionId,
      source: 'skill',
      promptForm: { status: 'invalid', reason: '未声明变量 model' },
    } as const satisfies QuantSkillsPromptFormCapability
    const view = render(<QuantSkillsResidentControl {...({
      sessionId,
      useProjection: (key: string) => key === 'quantSkillsResidentSkills' ? [binding] : null,
      catalog: createSnapshotStore(catalogSnapshot),
      detach: vi.fn(async () => {}),
      openPicker: vi.fn(),
      listPromptForms: vi.fn(async () => ({ forms: [form] })),
      renderPromptForm: vi.fn(async () => ''),
      fillDraft: vi.fn(),
      runPrompt: vi.fn(),
    } as unknown as QuantSkillsResidentControlProps)}/>)

    const scoped = within(view.container)
    fireEvent.click(scoped.getByRole('button', { name: '本会话已加载 1 项能力' }))
    expect(await scoped.findByText(/参数不可用/)).toBeDefined()
    expect(scoped.queryByRole('button', { name: '参数' })).toBeNull()
  })
})

it('loads private capabilities by provenance and offers saved teams independently of the public catalog', async () => {
  const privateAsset = 'skill-private-notes'
  const personalExpert = { ...agent, agentId: 'personal-expert', name: '我的文档专家', sourceVersionId: undefined } as QuantSkillsAgentDefinition
  const team = { teamId: 'personal-team', name: '我的办公团', description: '整理文件并核对交付', revision: 1, lead: personalExpert, leadModel: { kind: 'default' }, members: [], createdAt: 1, updatedAt: 2 } as QuantSkillsAgentTeamDefinition
  const state: QuantSkillsAgentsSnapshot = { ...agentsSnapshot, definitions: [personalExpert, agent], teams: [team], librarySources: [
    { id: personalExpert.agentId, kind: 'agent', source: 'personal', method: 'manual' },
    { id: team.teamId, kind: 'agent-team', source: 'personal', method: 'manual' },
    { id: agent.agentId, kind: 'agent', source: 'installed', method: 'installation' },
  ] }
  const localCatalog: QuantSkillsCatalogSnapshot = { ...catalogSnapshot, versionsByAsset: { [privateAsset]: [{ assetName: privateAsset, versionId: `${privateAsset}@local`, commitSha: 'local', projectType: 'skill', exposure: 'skill-registry', declarationFile: 'SKILL.md', declarationTitleZh: '我的私人笔记', installedAt: 1, origin: 'local-authoring' }] } }
  const mine = capabilityLibraryRows('mine', localCatalog, state, sessionsSnapshot)
  expect(mine.map(row => row.name)).toEqual(['我的私人笔记', '我的文档专家', '我的办公团'])
  expect(capabilityLibraryRows('discover', localCatalog, state, sessionsSnapshot).some(row => row.name === '我的私人笔记')).toBe(false)
  expect(capabilityLibraryRows('installed', localCatalog, state, sessionsSnapshot).map(row => row.name)).toEqual(['市场状态监控专家'])
  const controller = new QuantSkillsCapabilityPickerController(); controller.open(sessionId, 'catalog')
  const toggleSkill = vi.fn(async () => {}), openUserTeam = vi.fn(async () => {})
  const view = render(<QuantSkillsCapabilityPicker {...({ sessionId, useProjection: () => [], picker: controller.source, catalog: createSnapshotStore(localCatalog), sessions: createSnapshotStore(sessionsSnapshot), agents: createSnapshotStore(state), close: () => controller.close(), toggleSkill, openUserTeam, openUserAgent: vi.fn(), openCatalogAgent: vi.fn(), openExpertPreset: vi.fn(), openTeamPreset: vi.fn() } as unknown as QuantSkillsCapabilityPickerProps)}/>)
  fireEvent.click(view.getByRole('button', { name: /我的私人笔记/ }))
  await waitFor(() => expect(toggleSkill).toHaveBeenCalledWith(sessionId, expect.objectContaining({ name: privateAsset, commitSha: 'local' }), undefined))
  controller.open(sessionId, 'catalog')
  fireEvent.click(await view.findByRole('button', { name: /^专家团 1$/ }))
  fireEvent.click(view.getByRole('button', { name: /我的办公团/ }))
  await waitFor(() => expect(openUserTeam).toHaveBeenCalledWith(team))
  view.unmount()
})

it('filters recommended teams, preserves errors for retry, and prevents concurrent starts', async () => {
  const controller = new QuantSkillsCapabilityPickerController(); controller.open(sessionId, 'catalog')
  let reject: (reason: Error) => void = () => {}
  const openTeamPreset = vi.fn(() => new Promise<void>((_, fail) => { reject = fail }))
  const view = render(<QuantSkillsCapabilityPicker {...({ sessionId, useProjection: () => [], picker: controller.source, catalog: createSnapshotStore(catalogSnapshot), sessions: createSnapshotStore(sessionsSnapshot), agents: createSnapshotStore(agentsSnapshot), close: () => controller.close(), toggleSkill: vi.fn(), openUserTeam: vi.fn(), openUserAgent: vi.fn(), openCatalogAgent: vi.fn(), openExpertPreset: vi.fn(), openTeamPreset } as unknown as QuantSkillsCapabilityPickerProps)}/>)
  fireEvent.click(view.getByRole('button', { name: '推荐的' }))
  fireEvent.click(view.getByRole('button', { name: /^专家团 \d/ }))
  fireEvent.change(view.getByRole('combobox', { name: '能力分类' }), { target: { value: 'quant' } })
  fireEvent.change(view.getByRole('searchbox', { name: '搜索能力' }), { target: { value: '量化策略研发' } })
  const row = view.getByRole('button', { name: /量化策略研发团/ })
  fireEvent.click(row); fireEvent.click(row)
  expect(openTeamPreset).toHaveBeenCalledTimes(1)
  expect(openTeamPreset).toHaveBeenCalledWith(expect.objectContaining({ id: 'strategy-development' }))
  reject(new Error('暂时无法保存'))
  expect(await view.findByRole('alert')).toHaveProperty('textContent', '暂时无法保存')
  expect(controller.source.getSnapshot().open).toBe(true)
  fireEvent.click(view.getByRole('button', { name: '发现的' }))
  fireEvent.change(view.getByRole('searchbox', { name: '搜索能力' }), { target: { value: '' } })
  expect(view.getByText('公开目录暂未提供专家团')).toBeDefined()
  fireEvent.keyDown(view.getByRole('dialog'), { key: 'Escape' })
  await waitFor(() => expect(view.queryByRole('dialog')).toBeNull())
  view.unmount()
})
