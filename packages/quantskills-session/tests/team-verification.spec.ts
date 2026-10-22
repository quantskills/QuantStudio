import { describe, expect, it } from 'vitest'
import { calculateBatch, type Calculation } from '../src/team-verification.ts'

describe('exact Team arithmetic verification', () => {
  it('counts every repeated row and rejects a plausible but incomplete claimed fee total', () => {
    const rows = [
      { id: 'r1', gross: '430', open: '12', close: '18' },
      { id: 'r2', gross: '-360', open: '6', close: '9' },
      { id: 'r3', gross: '200', open: '0', close: '5' },
      { id: 'r4', gross: '17.35', open: '0.15', close: '0.2' },
      { id: 'r1', gross: '430', open: '12', close: '18' },
    ]
    const [fees, gross] = calculateBatch([
      { label: 'fees', operation: 'sum', values: rows.flatMap(row => [row.open, row.close]), expected: '50.35' },
      { label: 'gross', operation: 'sum', values: rows.map(row => row.gross), expected: '717.35' },
    ])
    expect(fees).toMatchObject({ value: '80.35', operandCount: 10, matchesExpected: false, rounded: false })
    expect(gross).toMatchObject({ value: '717.35', operandCount: 5, matchesExpected: true })
    expect(calculateBatch([{ label: 'net', operation: 'subtract', values: [gross!.value, fees!.value] }])[0])
      .toMatchObject({ value: '637', exact: { numerator: '637', denominator: '1' }, rounded: false })
  })

  it('keeps decimal precision, zero operands and integers beyond binary floating-point precision', () => {
    expect(calculateBatch([
      { label: 'decimal', operation: 'sum', values: ['0.1', '0.2', '0', '-0'], expected: '0.3' },
      { label: 'large', operation: 'subtract', values: ['9007199254740993', '9007199254740992'] },
      { label: 'negative', operation: 'multiply', values: ['-1.25', '2', '2'] },
    ]).map(result => result.value)).toEqual(['0.3', '1', '-5'])
  })

  it('reports exact fractions and rounding without calling rounded equality exact', () => {
    const results = calculateBatch([
      { label: 'third', operation: 'divide', values: ['1', '3'], expected: '0.33' },
      { label: 'chain', operation: 'divide', values: ['100', '4', '2'] },
      { label: 'round', operation: 'sum', values: ['-1.005', '0'] },
      { label: 'zero', operation: 'sum', values: ['-.0001', '0'] },
    ], 2)
    expect(results[0]).toMatchObject({ value: '0.33', rounded: true, matchesExpected: false, exact: { numerator: '1', denominator: '3' } })
    expect(results[1]).toMatchObject({ value: '12.5', rounded: false })
    expect(results[2]).toMatchObject({ value: '-1.01', rounded: true })
    expect(results[3]).toMatchObject({ value: '0', rounded: true })
    expect(calculateBatch([{ label: 'whole', operation: 'sum', values: ['100', '.5'] }], 0)[0]?.value).toBe('101')
  })

  it.each([null, undefined, 0, '', 'NaN', 'Infinity', '1e2', '1+2', 'process.exit()', '1,000', ' 3'])('rejects invalid operand %s instead of assuming zero or evaluating it', value => {
    expect(() => calculateBatch([{ label: 'invalid', operation: 'sum', values: ['1', value as string] }])).toThrow('plain decimal')
  })

  it('fails a batch on invalid operations, duplicate labels, zero division or unsafe resource requests', () => {
    const base: Calculation = { label: 'a', operation: 'sum', values: ['1'] }
    expect(() => calculateBatch([base, base])).toThrow('distinct')
    expect(() => calculateBatch([{ ...base, operation: 'divide', values: ['2', '0'] }])).toThrow('zero')
    expect(() => calculateBatch([{ ...base, operation: 'subtract' }])).toThrow('at least two')
    expect(() => calculateBatch([{ ...base, values: [] }])).toThrow('operands')
    expect(() => calculateBatch([{ ...base, operation: 'unknown' as Calculation['operation'] }])).toThrow('Unsupported')
    expect(() => calculateBatch([{ ...base, values: Array(1025).fill('1') }])).toThrow('operands')
    expect(() => calculateBatch([{ ...base, values: ['9'.repeat(129)] }])).toThrow('plain decimal')
    expect(() => calculateBatch([{ ...base, operation: 'multiply', values: Array(100).fill('9'.repeat(100)) }])).toThrow('size limit')
    expect(() => calculateBatch(Array(17).fill(base))).toThrow('16')
    for (const places of [-1, 19, NaN, 1.5]) expect(() => calculateBatch([base], places)).toThrow('decimal_places')
  })
})
