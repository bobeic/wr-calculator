import { describe, it, expect } from 'vitest'
import { ItemSchema } from '../src/item'

function validItem() {
  return {
    id: 'long-sword',
    name: 'Long Sword',
    tier: 'basic' as const,
    cost: { total: 350, combine: 350 },
    recipe: [],
    stats: { ad: 10 },
    effects: [],
    tags: ['physical'],
    provenance: { source: 'manual' as const, patch: '0.0.0', verifiedInGame: false },
  }
}

describe('ItemSchema', () => {
  it('parses a minimal valid item', () => {
    const result = ItemSchema.parse(validItem())
    expect(result.id).toBe('long-sword')
  })

  it('accepts an optional exclusiveGroup', () => {
    const result = ItemSchema.parse({ ...validItem(), exclusiveGroup: 'percent-magic-pen' })
    expect(result.exclusiveGroup).toBe('percent-magic-pen')
  })

  it('allows null stat values for unverified data', () => {
    const item = validItem()
    item.stats = { ad: null } as unknown as typeof item.stats
    const result = ItemSchema.parse(item)
    expect(result.stats.ad).toBeNull()
  })

  it('rejects an unknown stat key', () => {
    const item = { ...validItem(), stats: { madeUpStat: 10 } }
    expect(() => ItemSchema.parse(item)).toThrow()
  })

  it('rejects an unknown tier', () => {
    const item = { ...validItem(), tier: 'mythic' }
    expect(() => ItemSchema.parse(item)).toThrow()
  })

  it('rejects an unknown top-level field', () => {
    const item = { ...validItem(), madeUpField: true }
    expect(() => ItemSchema.parse(item)).toThrow()
  })

  it('parses an item carrying effects', () => {
    const item = {
      ...validItem(),
      effects: [
        {
          id: 'passive', name: 'Passive', description: 'Does a thing.', support: 'full' as const,
          kind: 'stat' as const, stat: 'ad' as const, amount: 5,
        },
      ],
    }
    const result = ItemSchema.parse(item)
    expect(result.effects).toHaveLength(1)
  })
})
