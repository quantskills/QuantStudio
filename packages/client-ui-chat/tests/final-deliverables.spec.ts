import { describe, expect, it } from 'vitest'
import { projectFinalDeliverables } from '../src/client/chat/final-deliverables.ts'
import type { AssistantBlock } from '../src/client/contract/snapshot.ts'

const block = (text: string) => [{ kind: 'text', text }] as AssistantBlock[]
const protocol = (items: unknown, version = 1) => '```quantskills-deliverables\n' + JSON.stringify({ version, items }) + '\n```'
const report = { path: 'output/report.md', title: '研究报告', presentation: 'card' }

describe('explicit final deliveries', () => {
  it('preserves conclusions, parses selected artifacts and deduplicates paths', () => {
    const value = projectFinalDeliverables(block('结论\n' + protocol([report, report, { path: 'output/chart.html', title: '图表', presentation: 'interactive' }])))
    expect(value.items).toHaveLength(2)
    expect(value.blocks).toEqual(block('结论'))
  })
  it('never infers delivery from prose or tool events and leaves invalid declarations visible', () => {
    for (const text of ['文件 `output/report.md`', protocol([report], 2), protocol([{ ...report, path: '../key' }]),
      protocol([{ ...report, path: 'output/../secret' }]), protocol([{ ...report, path: 'C:/secret' }]),
      protocol([{ ...report, path: 'output/a.html', presentation: 'execute' }]), protocol([{ ...report, presentation: 'interactive' }])]) {
      expect(projectFinalDeliverables(block(text))).toEqual({ blocks: block(text), items: [] })
    }
  })
  it('does not interpret example fences nested in ordinary code or reasoning', () => {
    const text = '````markdown\n' + protocol([report]) + '\n````'
    expect(projectFinalDeliverables(block(text)).items).toEqual([])
    expect(projectFinalDeliverables([{ kind: 'reasoning', text: protocol([report]) } as AssistantBlock]).items).toEqual([])
  })
  it('recovers the observed provider variant without inferring from arbitrary JSON', () => {
    const compatible = '结论\nquantskills-deliverables\n\n```json\n' + JSON.stringify({ version: 1, items: [report] }) + '\n```'
    expect(projectFinalDeliverables(block(compatible))).toEqual({ blocks: block('结论'), items: [report] })
    for (const text of [
      '结论\n```json\n' + JSON.stringify({ version: 1, items: [report] }) + '\n```',
      '结论\nquantskills-deliverables\n```javascript\n' + JSON.stringify({ version: 1, items: [report] }) + '\n```',
      '结论\nquantskills-deliverables\n```json\n{"version":2,"items":[]}\n```',
    ]) expect(projectFinalDeliverables(block(text))).toEqual({ blocks: block(text), items: [] })
  })
  it('hides incomplete protocol only during streaming; malformed finished output is recoverable', () => {
    const text = '结论\n```quantskills-deliverables\n{"version":1'
    expect(projectFinalDeliverables(block(text), true)).toEqual({ blocks: block('结论'), items: [] })
    expect(projectFinalDeliverables(block(text), false).blocks).toEqual(block(text))
    const compatible = '结论\nquantskills-deliverables\n\n```json\n{"version":1'
    expect(projectFinalDeliverables(block(compatible), true)).toEqual({ blocks: block('结论'), items: [] })
    expect(projectFinalDeliverables(block(compatible), false).blocks).toEqual(block(compatible))
  })
  it('recovers the exact unmarked final JSON manifest and normalizes Windows paths', () => {
    const items = [
      { path: 'output/lowvol_dividend/output/report.html', title: '低波动+高股息策略研究报告', presentation: 'interactive' },
      { path: 'output\\lowvol_dividend\\output\\factors_final.parquet', title: '完整因子面板', presentation: 'card' },
    ]
    const json = JSON.stringify({ version: 1, items })
    const text = '报告已由子代理补充完善。最终交付：\n\n```json\n' + json + '\n```'
    const result = projectFinalDeliverables(block(text), false, { allowUnmarked: true })
    expect(result.items).toEqual([items[0], { ...items[1], path: 'output/lowvol_dividend/output/factors_final.parquet' }])
    expect(result.blocks).toEqual(block('报告已由子代理补充完善。最终交付：\n'))
    expect(projectFinalDeliverables(block(text), true, { allowUnmarked: true })).toEqual({ blocks: block(text), items: [] })
    expect(projectFinalDeliverables(block('   ```JSON\n' + json + '\n   ```'), false, { allowUnmarked: true }).items).toHaveLength(2)
  })
  it('does not convert unrelated, nested, incomplete or unsafe JSON to links', () => {
    for (const payload of [
      { version: 1, items: [{ id: 'other', path: 'output/report.md' }] },
      { version: 1, items: [report], instructions: 'example' },
      { version: 1, items: [{ ...report, example: true }] },
      { version: 1, items: [{ ...report, path: 'output/../secret' }] },
      { version: 1, items: [{ ...report, path: 'https://example.com' }] },
      { version: 1, items: [] },
    ]) {
      const text = '```json\n' + JSON.stringify(payload) + '\n```'
      expect(projectFinalDeliverables(block(text), false, { allowUnmarked: true })).toEqual({ blocks: block(text), items: [] })
    }
    const nested = '````markdown\n```json\n' + JSON.stringify({ version: 1, items: [report] }) + '\n```\n````'
    expect(projectFinalDeliverables(block(nested), false, { allowUnmarked: true }).items).toEqual([])
    const unfinished = '```json\n' + JSON.stringify({ version: 1, items: [report] })
    expect(projectFinalDeliverables(block(unfinished), false, { allowUnmarked: true })).toEqual({ blocks: block(unfinished), items: [] })
  })
})
