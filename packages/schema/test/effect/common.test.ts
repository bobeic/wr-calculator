import { describe, it, expect } from 'vitest'
import { EffectBaseSchema, EffectInputSchema } from '../../src/effect/kinds/common'

describe('EffectInputSchema', () => {
  it('accepts a stackCount input', () => {
    const result = EffectInputSchema.parse({
      type: 'stackCount', id: 'stacks', label: 'Stacks', min: 0, max: 5, default: 0,
    })
    expect(result.type).toBe('stackCount')
  })

  it('accepts a boolean input', () => {
    const result = EffectInputSchema.parse({
      type: 'boolean', id: 'enraged', label: 'Enraged', default: false,
    })
    expect(result.type).toBe('boolean')
  })
})

describe('EffectBaseSchema', () => {
  const valid = {
    id: 'test-effect',
    name: 'Test Effect',
    description: 'Deals bonus damage.',
    support: 'full' as const,
  }

  it('accepts the minimal required fields', () => {
    expect(EffectBaseSchema.parse(valid)).toMatchObject(valid)
  })

  it('accepts optional uniqueGroup, supportNotes, inputs, and condition', () => {
    const result = EffectBaseSchema.parse({
      ...valid,
      uniqueGroup: 'spellblade',
      supportNotes: 'ICD timing unverified',
      inputs: [{ type: 'boolean', id: 'toggle', label: 'Toggle', default: false }],
      condition: { type: 'targetIsChampion' },
    })
    expect(result.uniqueGroup).toBe('spellblade')
  })

  it('rejects an invalid support level', () => {
    expect(() => EffectBaseSchema.parse({ ...valid, support: 'maybe' })).toThrow()
  })

  it('rejects missing description', () => {
    const { description, ...rest } = valid
    expect(() => EffectBaseSchema.parse(rest)).toThrow()
  })

  it('rejects an unknown field', () => {
    expect(() => EffectBaseSchema.parse({ ...valid, madeUpField: true })).toThrow()
  })
})
