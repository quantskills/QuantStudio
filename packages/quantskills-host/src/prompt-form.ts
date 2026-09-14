/** Parser for optional, non-executable QuantSkills `qsh-form` v1 metadata. */

import type {
  QuantSkillsPromptFormAdaptation,
  QuantSkillsPromptFormField,
  QuantSkillsPromptFormFieldType,
  QuantSkillsPromptFormOption,
  QuantSkillsPromptFormResult,
  QuantSkillsPromptFormTask,
  QuantSkillsPromptFormV1,
} from './types.ts'

const MAX_FORM_BYTES = 16 * 1024
const MAX_FIELDS = 12
const FIELD_KEY = /^[a-z0-9_]{1,32}$/
const JSON_NUMBER_STRING = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/
const FORM_BLOCK = /^```json qsh-form[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/m
const FORM_TAG = /{{\s*([#/^]?)\s*([a-zA-Z0-9_]+)\s*}}/g
const FIELD_TYPES = new Set<QuantSkillsPromptFormFieldType>(['text', 'textarea', 'select', 'date', 'number'])
const RESERVED_KEYS = new Set(['task', 'attachments'])

/**
 * Parse the first optional `qsh-form` block without changing the surrounding declaration.
 * @param source - complete Skill or Agent instruction body.
 * @returns a ready or invalid form result, or `undefined` when no form is declared.
 */
export function parseQuantSkillsPromptForm(source: string): QuantSkillsPromptFormResult | undefined {
  const match = FORM_BLOCK.exec(source)
  if (match === null) return undefined
  if (Buffer.byteLength(match[0], 'utf8') > MAX_FORM_BYTES) return invalid('qsh-form exceeds the 16 KiB limit.')

  let input: unknown
  try {
    input = JSON.parse(match[1] ?? '')
  } catch {
    return invalid('qsh-form must contain valid JSON.')
  }
  if (!isRecord(input)) return invalid('qsh-form root must be an object.')
  if (input.version !== 1) return invalid('qsh-form version must equal 1.')

  const adapted = adaptPromptFormV1(input)
  const task = parseTask(adapted.input.task)
  if (typeof task === 'string') return invalid(task)
  const fields = parseFields(adapted.input.fields)
  if (typeof fields === 'string') return invalid(fields)
  if (typeof adapted.input.prompt_template !== 'string' || adapted.input.prompt_template.trim() === '') {
    return invalid('qsh-form prompt_template must be a non-empty string.')
  }
  const templateError = validateTemplate(adapted.input.prompt_template, fields)
  if (templateError !== undefined) return invalid(templateError)

  const form: QuantSkillsPromptFormV1 = Object.freeze({
    version: 1,
    ...(task === undefined ? {} : { task }),
    fields,
    promptTemplate: adapted.input.prompt_template,
  })
  return Object.freeze({
    status: 'ready',
    form,
    ...(adapted.adaptations.length === 0 ? {} : { adaptations: adapted.adaptations }),
  })
}

function adaptPromptFormV1(input: Record<string, unknown>): {
  readonly input: Record<string, unknown>
  readonly adaptations: readonly QuantSkillsPromptFormAdaptation[]
} {
  if (!Array.isArray(input.fields)) return { input, adaptations: Object.freeze([]) }
  const adaptations: QuantSkillsPromptFormAdaptation[] = []
  let changed = false
  const fields = input.fields.map((field) => {
    if (!isRecord(field)
      || field.type !== 'number'
      || typeof field.key !== 'string'
      || !FIELD_KEY.test(field.key)
      || RESERVED_KEYS.has(field.key)
      || typeof field.default !== 'string'
      || !JSON_NUMBER_STRING.test(field.default)) return field
    const defaultValue = Number(field.default)
    if (!Number.isFinite(defaultValue)) return field
    changed = true
    adaptations.push(Object.freeze({ code: 'number-default-string', fieldKey: field.key }))
    return Object.freeze({ ...field, default: defaultValue })
  })
  return Object.freeze({
    input: changed ? Object.freeze({ ...input, fields: Object.freeze(fields) }) : input,
    adaptations: Object.freeze(adaptations),
  })
}

function parseTask(input: unknown): QuantSkillsPromptFormTask | string | undefined {
  if (input === undefined) return undefined
  if (!isRecord(input)) return 'qsh-form task must be an object.'
  if (input.placeholder !== undefined && typeof input.placeholder !== 'string') {
    return 'qsh-form task.placeholder must be a string.'
  }
  if (input.required !== undefined && typeof input.required !== 'boolean') {
    return 'qsh-form task.required must be a boolean.'
  }
  return Object.freeze({
    ...(input.placeholder === undefined ? {} : { placeholder: input.placeholder }),
    ...(input.required === undefined ? {} : { required: input.required }),
  })
}

function parseFields(input: unknown): readonly QuantSkillsPromptFormField[] | string {
  if (input === undefined) return Object.freeze([])
  if (!Array.isArray(input)) return 'qsh-form fields must be an array.'
  if (input.length > MAX_FIELDS) return `qsh-form fields may contain at most ${String(MAX_FIELDS)} entries.`
  const keys = new Set<string>()
  const fields: QuantSkillsPromptFormField[] = []
  for (let index = 0; index < input.length; index++) {
    const parsed = parseField(input[index], index, keys)
    if (typeof parsed === 'string') return parsed
    fields.push(parsed)
  }
  return Object.freeze(fields)
}

function parseField(input: unknown, index: number, keys: Set<string>): QuantSkillsPromptFormField | string {
  const path = `qsh-form fields[${String(index)}]`
  if (!isRecord(input)) return `${path} must be an object.`
  if (typeof input.key !== 'string' || !FIELD_KEY.test(input.key) || RESERVED_KEYS.has(input.key)) {
    return `${path}.key must match ${String(FIELD_KEY)} and cannot be task or attachments.`
  }
  if (keys.has(input.key)) return `${path}.key duplicates ${JSON.stringify(input.key)}.`
  keys.add(input.key)
  if (typeof input.type !== 'string' || !FIELD_TYPES.has(input.type as QuantSkillsPromptFormFieldType)) {
    return `${path}.type must be text, textarea, select, date, or number.`
  }
  const type = input.type as QuantSkillsPromptFormFieldType
  const label = input.label === undefined ? input.key : input.label
  if (typeof label !== 'string' || label.trim() === '') return `${path}.label must be a non-empty string.`
  if (input.required !== undefined && typeof input.required !== 'boolean') return `${path}.required must be a boolean.`
  if (input.placeholder !== undefined && typeof input.placeholder !== 'string') return `${path}.placeholder must be a string.`
  if (input.help !== undefined && typeof input.help !== 'string') return `${path}.help must be a string.`
  const defaultValue = input.default
  if (defaultValue !== undefined
    && (type === 'number' ? typeof defaultValue !== 'number' || !Number.isFinite(defaultValue) : typeof defaultValue !== 'string')) {
    return `${path}.default does not match field type ${type}.`
  }
  const options = parseOptions(type, input.options, path)
  if (typeof options === 'string') return options
  if (type === 'select' && defaultValue !== undefined
    && !options?.some(option => option.value === defaultValue)) {
    return `${path}.default must match one declared option.`
  }
  return Object.freeze({
    key: input.key,
    label,
    type,
    ...(input.required === undefined ? {} : { required: input.required }),
    ...(input.placeholder === undefined ? {} : { placeholder: input.placeholder }),
    ...(input.help === undefined ? {} : { help: input.help }),
    ...(defaultValue === undefined ? {} : { default: defaultValue as string | number }),
    ...(options === undefined ? {} : { options }),
  })
}

function parseOptions(
  type: QuantSkillsPromptFormFieldType,
  input: unknown,
  path: string,
): readonly QuantSkillsPromptFormOption[] | string | undefined {
  if (type !== 'select') return input === undefined ? undefined : `${path}.options is only valid for select fields.`
  if (!Array.isArray(input) || input.length === 0) return `${path}.options must be a non-empty array.`
  const options: QuantSkillsPromptFormOption[] = []
  for (let index = 0; index < input.length; index++) {
    const option: unknown = input[index]
    if (!isRecord(option) || typeof option.value !== 'string' || typeof option.label !== 'string') {
      return `${path}.options[${String(index)}] must contain string value and label fields.`
    }
    options.push(Object.freeze({ value: option.value, label: option.label }))
  }
  return Object.freeze(options)
}

function validateTemplate(template: string, fields: readonly QuantSkillsPromptFormField[]): string | undefined {
  const allowed = new Set([...RESERVED_KEYS, ...fields.map(field => field.key)])
  const stack: string[] = []
  let last = 0
  for (const tag of template.matchAll(FORM_TAG)) {
    const tagIndex = tag.index
    const between = template.slice(last, tagIndex)
    const tagEnd = tagIndex + tag[0].length
    if (between.includes('{{')
      || between.includes('}}')
      || template[tagIndex - 1] === '{'
      || template[tagEnd] === '}') {
      return 'qsh-form prompt_template contains an unsupported Mustache tag.'
    }
    const marker = tag[1] ?? ''
    const name = tag[2] ?? ''
    if (!allowed.has(name)) return `qsh-form prompt_template references undeclared variable ${JSON.stringify(name)}.`
    if (marker === '#' || marker === '^') stack.push(name)
    if (marker === '/' && stack.pop() !== name) return 'qsh-form prompt_template contains unbalanced sections.'
    last = tagEnd
  }
  if (template.slice(last).includes('{{') || template.includes('}}', last)) {
    return 'qsh-form prompt_template contains an unsupported Mustache tag.'
  }
  if (stack.length > 0) return 'qsh-form prompt_template contains unbalanced sections.'
  return undefined
}

function invalid(reason: string): QuantSkillsPromptFormResult {
  return Object.freeze({ status: 'invalid', reason })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
