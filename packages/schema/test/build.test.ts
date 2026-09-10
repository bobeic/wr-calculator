import { describe, it, expect } from 'vitest'
import { BuildSchema } from '../src/build'

describe('BuildSchema', () => {
  it('parses a build with items, boots, runes, and inputs', () => {
    const result = BuildSchema.parse({
      items: ['long-sword', 'bf-sword'],
      boots: 'plated-steelcaps',
      runes: ['conqueror', 'triumph'],
      inputs: { stacks: 3, enraged: true },
    })
    expect(result.items).toEqual(['long-sword', 'bf-sword'])
  })

  it('allows boots and enchant to be omitted', () => {
    const result = BuildSchema.parse({ items: [], runes: [], inputs: {} })
    expect(result.boots).toBeUndefined()
  })
})
