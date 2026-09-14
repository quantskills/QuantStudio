import { describe, expect, it } from 'vitest'
import {
  buildSkillGuidePrompt,
  parseSkillGuideDecision,
  type QuantSkillsRecommendableSkill,
} from '../src/client/task-recommendation.ts'

function skill(
  name: string,
  title: string,
  description = '',
): QuantSkillsRecommendableSkill {
  return {
    name,
    title,
    summary: description,
    description,
    category: '因子研发工具箱',
    subcategory: '',
  }
}

describe('home task AI guide', () => {
  it('asks the model to clarify broad tasks instead of forcing a fuzzy match', () => {
    const prompt = buildSkillGuidePrompt('股票的', [
      skill('skill-a00-five-day-momentum', '五日动量因子', '计算并检验五日动量信号。'),
      skill('skill-a01-reversal', '短期反转因子', '研究短周期价格反转。'),
    ])

    expect(prompt).toContain('不要按字面重合、模糊词或最高相似度强行选择')
    expect(prompt).toContain('kind 必须为 clarify')
    expect(prompt).toContain('推荐 1–3 个不同 技能')
    expect(prompt).toContain('建议创建新 技能')
    expect(prompt).toContain('"asset":"skill-a00-five-day-momentum"')
  })

  it('accepts one targeted clarification with short answer options', () => {
    const result = parseSkillGuideDecision(JSON.stringify({
      kind: 'clarify',
      message: '股票研究可以从不同方向展开，我需要先确认你的目标。',
      question: '你更想研究哪一类问题？',
      options: ['选股因子', '市场走势', '风险监控'],
    }), [])

    expect(result).toEqual({
      kind: 'clarify',
      message: '股票研究可以从不同方向展开，我需要先确认你的目标。',
      question: '你更想研究哪一类问题？',
      options: ['选股因子', '市场走势', '风险监控'],
    })
  })

  it('accepts ordered exact catalog recommendations and their reasons', () => {
    const momentum = skill('skill-a00-five-day-momentum', '五日动量因子')
    const reversal = skill('skill-a01-reversal', '短期反转因子')
    const result = parseSkillGuideDecision(JSON.stringify({
      kind: 'recommend',
      message: '这两个 技能 都能研究短周期价格信号。',
      recommendations: [
        { asset: momentum.name, reason: '直接计算并验证五日动量。' },
        { asset: reversal.name, reason: '适合比较短期价格反转。' },
      ],
    }), [reversal, momentum])

    expect(result).toEqual({
      kind: 'recommend',
      message: '这两个 技能 都能研究短周期价格信号。',
      recommendations: [
        { skill: momentum, reason: '直接计算并验证五日动量。' },
        { skill: reversal, reason: '适合比较短期价格反转。' },
      ],
    })
  })

  it('accepts a natural creation suggestion for a clear uncovered task', () => {
    expect(parseSkillGuideDecision(JSON.stringify({
      kind: 'create',
      message: '目录里没有覆盖这类另类数据，可以按你的目标创建一个专用 技能。',
    }), [])).toEqual({
      kind: 'create',
      message: '目录里没有覆盖这类另类数据，可以按你的目标创建一个专用 技能。',
    })
  })

  it('rejects a model-invented asset outside the trusted catalog', () => {
    const momentum = skill('skill-a00-five-day-momentum', '五日动量因子')

    expect(() => parseSkillGuideDecision(JSON.stringify({
      kind: 'recommend',
      message: '找到一个选择。',
      recommendations: [{ asset: 'skill-invented', reason: '看起来合适。' }],
    }), [momentum])).toThrow('目录外的项目')
  })
})
