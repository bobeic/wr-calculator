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

  it('rejects an unknown condition type', () => {
    expect(() => ConditionSchema.parse({ type: 'madeUp' })).toThrow()
  })

  it('rejects targetHpBelow missing threshold', () => {
    expect(() => ConditionSchema.parse({ type: 'targetHpBelow' })).toThrow()
  })
})
