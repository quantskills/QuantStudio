import { expect, it } from 'vitest'
import { smokeDiagnostics } from '../scripts/smoke-diagnostics.mjs'

it('keeps startup errors while excluding credentials and authentication links', () => {
  const secret = 'fresh-secret-value'
  const result = smokeDiagnostics([
    'Error: module missing', 'failed auth https://local/?key=not-for-report',
    'Error: password=private', `failed ${secret}`, `Error: ${'a'.repeat(43)}`,
  ].join('\n'), [secret])
  expect(result).toBe('Error: module missing\nfailed [redacted]\nError: [redacted]')
})

it('bounds diagnostics rather than publishing an entire process log', () => {
  const result = smokeDiagnostics(Array.from({ length: 30 }, () => `Error: ${'x '.repeat(600)}`).join('\n'))
  expect(result.split('\n')).toHaveLength(12)
  expect(result.split('\n').every(line => line.length <= 400)).toBe(true)
})
