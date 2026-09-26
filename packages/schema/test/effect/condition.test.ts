import { describe, it, expect } from 'vitest'
import { ConditionSchema } from '../../src/effect/condition'

describe('ConditionSchema', () => {
  it('accepts a targetHpBelow condition', () => {
    const result = ConditionSchema.parse({ type: 'targetHpBelow', threshold: 0.3 })
    expect(result.type).toBe('targetHpBelow')
  })

  it('accepts a toggle condition', () => {
    const result = ConditionSchema.parse({ type: 'toggle', inputId: 'enraged' })
    expect(result.type).toBe('toggle')
  })

  it('accepts a targetIsMonster condition with no extra fields', () => {
    const result = ConditionSchema.parse({ type: 'targetIsMonster' })
    expect(result.type).toBe('targetIsMonster')
  })

  it('accepts an abilitySlot condition', () => {
    expect(ConditionSchema.parse({ type: 'abilitySlot', value: 'r' }).type).toBe('abilitySlot')
  })

  it('accepts a targetHasDot condition with no extra fields', () => {
    expect(ConditionSchema.parse({ type: 'targetHasDot' }).type).toBe('targetHasDot')
  })

  it('rejects an abilitySlot outside q/w/e/r', () => {
    expect(() => ConditionSchema.parse({ type: 'abilitySlot', value: 'passive' })).toThrow()
  })

  it('rejects an unknown condition type', () => {
    expect(() => ConditionSchema.parse({ type: 'madeUp' })).toThrow()
  })

  it('rejects targetHpBelow missing threshold', () => {
    expect(() => ConditionSchema.parse({ type: 'targetHpBelow' })).toThrow()
  })

  it('rejects an unknown field', () => {
    expect(() =>
      ConditionSchema.parse({ type: 'targetHpBelow', threshold: 0.3, madeUpField: true })
    ).toThrow()
  })

  it('accepts an allOf condition combining leaf conditions', () => {
    const result = ConditionSchema.parse({
      type: 'allOf',
      conditions: [
        { type: 'targetHpBelow', threshold: 0.4 },
        { type: 'sourceKind', value: 'ability' },
      ],
    })
    expect(result.type).toBe('allOf')
  })

  it('rejects an allOf with fewer than two conditions', () => {
    expect(() => ConditionSchema.parse({
      type: 'allOf', conditions: [{ type: 'targetHpBelow', threshold: 0.4 }],
    })).toThrow()
  })

  it('rejects a nested allOf', () => {
    expect(() => ConditionSchema.parse({
      type: 'allOf',
      conditions: [
        { type: 'targetIsChampion' },
        {
          type: 'allOf',
          conditions: [{ type: 'targetIsChampion' }, { type: 'targetIsMonster' }],
        },
      ],
    })).toThrow()
  })
})
