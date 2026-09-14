import { describe, expect, it } from 'vitest'
import { parseQuantSkillsPromptForm } from '../src/prompt-form.ts'

describe('QuantSkills qsh-form parser', () => {
  it('leaves declarations without a form unchanged', () => {
    expect(parseQuantSkillsPromptForm('Use {{task}} exactly as written.')).toBeUndefined()
  })

  it('normalizes a bounded v1 form while preserving its prompt template', () => {
    const source = declaration({
      version: 1,
      task: { placeholder: '描述研究任务', required: true },
      fields: [
        { key: 'market', label: '市场', type: 'select', required: true, default: 'cn', options: [
          { value: 'cn', label: '中国' },
          { value: 'us', label: '美国' },
        ] },
        { key: 'days', label: '天数', type: 'number', default: 5 },
      ],
      prompt_template: '任务：{{task}}\n市场：{{market}}\n{{#days}}天数：{{days}}{{/days}}\n{{#attachments}}{{attachments}}{{/attachments}}',
    })

    expect(parseQuantSkillsPromptForm(source)).toEqual({
      status: 'ready',
      form: {
        version: 1,
        task: { placeholder: '描述研究任务', required: true },
        fields: [
          {
            key: 'market', label: '市场', type: 'select', required: true, default: 'cn',
            options: [{ value: 'cn', label: '中国' }, { value: 'us', label: '美国' }],
          },
          { key: 'days', label: '天数', type: 'number', default: 5 },
        ],
        promptTemplate: '任务：{{task}}\n市场：{{market}}\n{{#days}}天数：{{days}}{{/days}}\n{{#attachments}}{{attachments}}{{/attachments}}',
      },
    })
  })

  it('adapts unambiguous string defaults for number fields without changing the declaration', () => {
    const source = declaration({
      version: 1,
      fields: [
        { key: 'lookback_days', label: '回看天数', type: 'number', default: '30' },
        { key: 'threshold', label: '阈值', type: 'number', default: '-1.5e2' },
      ],
      prompt_template: '{{lookback_days}} {{threshold}}',
    })

    expect(parseQuantSkillsPromptForm(source)).toEqual({
      status: 'ready',
      adaptations: [
        { code: 'number-default-string', fieldKey: 'lookback_days' },
        { code: 'number-default-string', fieldKey: 'threshold' },
      ],
      form: {
        version: 1,
        fields: [
          { key: 'lookback_days', label: '回看天数', type: 'number', default: 30 },
          { key: 'threshold', label: '阈值', type: 'number', default: -150 },
        ],
        promptTemplate: '{{lookback_days}} {{threshold}}',
      },
    })
    expect(source).toContain('"default": "30"')
  })

  it.each([' 30', '03', '+3', '1,000', 'NaN', '1e309'])(
    'does not guess the ambiguous number default %j',
    (defaultValue) => {
      const parsed = parseQuantSkillsPromptForm(declaration({
        version: 1,
        fields: [{ key: 'days', type: 'number', default: defaultValue }],
        prompt_template: '{{days}}',
      }))
      expect(parsed?.status).toBe('invalid')
      if (parsed?.status !== 'invalid') throw new Error('expected an invalid prompt form')
      expect(parsed.reason).toContain('default does not match field type number')
    },
  )

  it.each([
    ['malformed JSON', '```json qsh-form\n{\n```', 'valid JSON'],
    ['undeclared variables', declaration({ version: 1, fields: [], prompt_template: '{{model}}' }), 'undeclared variable'],
    ['unbalanced sections', declaration({ version: 1, fields: [], prompt_template: '{{#task}}missing close' }), 'unbalanced sections'],
    ['unsupported tags', declaration({ version: 1, fields: [], prompt_template: '{{{task}}}' }), 'unsupported Mustache tag'],
    ['invalid select defaults', declaration({
      version: 1,
      fields: [{ key: 'market', type: 'select', default: 'hk', options: [{ value: 'cn', label: '中国' }] }],
      prompt_template: '{{market}}',
    }), 'must match one declared option'],
  ])('marks %s invalid instead of rejecting the declaration', (_name, source, reason) => {
    const parsed = parseQuantSkillsPromptForm(source)
    expect(parsed?.status).toBe('invalid')
    if (parsed?.status !== 'invalid') throw new Error('expected an invalid prompt form')
    expect(parsed.reason).toContain(reason)
  })
})

function declaration(form: unknown): string {
  return [
    'Declaration text remains literal.',
    '```json qsh-form',
    JSON.stringify(form, null, 2),
    '```',
    'Trailing declaration text.',
  ].join('\n')
}
