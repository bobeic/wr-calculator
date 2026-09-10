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

  it('rejects a dummy target missing hp', () => {
    expect(() => TargetSchema.parse({ kind: 'dummy', armor: 60, mr: 40 })).toThrow()
  })

  it('rejects a dummy target with an unknown field', () => {
    expect(() =>
      TargetSchema.parse({ kind: 'dummy', hp: 2000, armor: 60, mr: 40, madeUpField: true })
    ).toThrow()
  })
})
