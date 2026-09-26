import { describe, it, expect } from 'vitest'
import { TargetSchema } from '../src/target'

describe('TargetSchema', () => {
  it('parses a champion target', () => {
    const result = TargetSchema.parse({
      kind: 'champion',
      champion: 'nunu-willump',
      level: 11,
      build: { items: [], runes: [], inputs: {} },
    })
    expect(result.kind).toBe('champion')
  })

  it('parses a dummy target', () => {
    const result = TargetSchema.parse({ kind: 'dummy', hp: 2000, armor: 60, mr: 40 })
    expect(result.kind).toBe('dummy')
  })

  it('accepts a dummy target starting below full hp', () => {
    const result = TargetSchema.parse({ kind: 'dummy', hp: 2000, armor: 60, mr: 40, startHpFraction: 0.3 })
    expect(result).toMatchObject({ kind: 'dummy', startHpFraction: 0.3 })
  })

  it.each([0, -0.1, 1.1])('rejects a dummy startHpFraction of %s', (startHpFraction) => {
    expect(() =>
      TargetSchema.parse({ kind: 'dummy', hp: 2000, armor: 60, mr: 40, startHpFraction })
    ).toThrow()
  })

  it('rejects a dummy target missing hp', () => {
    expect(() => TargetSchema.parse({ kind: 'dummy', armor: 60, mr: 40 })).toThrow()
  })

  it('rejects a dummy target with an unknown field', () => {
    expect(() =>
      TargetSchema.parse({ kind: 'dummy', hp: 2000, armor: 60, mr: 40, madeUpField: true })
    ).toThrow()
  })
})
