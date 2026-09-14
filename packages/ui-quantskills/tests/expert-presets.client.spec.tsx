// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExpertPresets, type ExpertPresetsProps } from '../src/client/ExpertPresets.tsx'
import { EXPERT_PRESETS, expertRole, presetRequest } from '../src/client/expert-presets.ts'
import type { QuantSkillsAgentCreateRequest, QuantSkillsAgentDefinition } from '../src/client/plugin-types.ts'
import type { QuantSkillsInstalledVersion } from '../src/client/types.ts'

afterEach(cleanup)
const definition = (request: QuantSkillsAgentCreateRequest): QuantSkillsAgentDefinition => ({ ...request, agentId: `agent-${crypto.randomUUID()}`, revision: 1, skills: [], createdAt: 1, updatedAt: 1 }) as QuantSkillsAgentDefinition
const props = (): ExpertPresetsProps => ({ definitions: [], versions: [], ready: true, create: vi.fn(async request => definition(request)), start: vi.fn(async () => {}), open: vi.fn() })

describe('practical expert library', () => {
  it('offers ten distinct workflows split evenly between investing and quant', () => {
    expect(EXPERT_PRESETS).toHaveLength(20)
    expect(new Set(EXPERT_PRESETS.map(item => item.id)).size).toBe(20)
    expect(EXPERT_PRESETS.filter(item => item.group === 'investing')).toHaveLength(5)
    expect(EXPERT_PRESETS.filter(item => item.group === 'quant')).toHaveLength(5)
    for (const preset of EXPERT_PRESETS) {
      if (preset.group !== 'office') expect(expertRole(preset)).toContain('insufficient 不可当作可用数据')
      expect(expertRole(preset)).toContain(preset.example)
      expect(preset.workflow.length).toBeGreaterThanOrEqual(4)
    }
  })
  it('binds only available skill versions and leaves model choice to the session', () => {
    const preset = EXPERT_PRESETS.find(item => item.id === 'strategy-backtest')!
    const old = { assetName: 'skill-backtest', versionId: 'old', projectType: 'skill', exposure: 'skill-registry', installedAt: 1 } as QuantSkillsInstalledVersion
    const request = presetRequest(preset, [old, { ...old, versionId: 'new', installedAt: 2 }, { ...old, versionId: 'not-a-skill', projectType: 'agent', installedAt: 3 }])
    expect(request.versionIds).toEqual(['new'])
    expect(request.permission).toBe('workspace-write')
    expect(request.model).toBeUndefined()
  })
  it('filters use cases without dropping saved expert counts', () => {
    const p = props(); p.definitions = [definition(presetRequest(EXPERT_PRESETS[0]!, []))]
    render(<ExpertPresets {...p}/>); fireEvent.click(screen.getByRole('button', { name: '量化研究 5' }))
    expect(screen.queryByRole('article', { name: '个股研究专家' })).toBeNull()
    expect(screen.getAllByRole('article')).toHaveLength(5)
    expect(screen.getByText('已添加 1 / 20')).toBeTruthy()
  })
  it('reuses an edited saved expert instead of overwriting or creating duplicates', async () => {
    const p = props(), saved = { ...definition(presetRequest(EXPERT_PRESETS[0]!, [])), name: '我的公司研究', revision: 8 }
    p.definitions = [saved]; render(<ExpertPresets {...p}/>)
    fireEvent.click(within(screen.getByRole('article', { name: '个股研究专家' })).getByRole('button', { name: '开始新对话' }))
    await waitFor(() => expect(p.start).toHaveBeenCalledWith(saved))
    expect(p.create).not.toHaveBeenCalled()
  })
  it('resumes bulk installation after a failure without duplicating completed experts', async () => {
    const p = props(); let failed = false
    vi.mocked(p.create).mockImplementation(async request => { if (request.name === '财报解读专家' && !failed) { failed = true; throw new Error('临时保存失败') }; return definition(request) })
    render(<ExpertPresets {...p}/>); fireEvent.click(screen.getByRole('button', { name: '添加全部专家' }))
    await screen.findByRole('alert'); expect(screen.getByText('已添加 2 / 20')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '添加全部专家' }))
    await screen.findByRole('button', { name: '已全部添加' })
    expect(p.create).toHaveBeenCalledTimes(21)
    expect(p.start).not.toHaveBeenCalled()
  })
  it('retains a saved definition when starting its session fails', async () => {
    const p = props(); vi.mocked(p.start).mockRejectedValueOnce(new Error('模型暂不可用'))
    render(<ExpertPresets {...p}/>); const card = within(screen.getByRole('article', { name: '量化研究专家' }))
    fireEvent.click(card.getByRole('button', { name: '开始新对话' })); await screen.findByRole('alert')
    fireEvent.click(card.getByRole('button', { name: '开始新对话' }))
    await waitFor(() => expect(p.start).toHaveBeenCalledTimes(2))
    expect(p.create).toHaveBeenCalledTimes(1)
  })
})
