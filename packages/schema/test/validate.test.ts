import { describe, it, expect } from 'vitest'
import {
  validateItemCost, validateRecipeIds, validateUniqueGroups, validateItemHandlers, validateItem,
} from '../src/validate'
import type { Item } from '../src/item'

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'test-item',
    name: 'Test Item',
    tier: 'basic',
    cost: { total: 100, combine: 100 },
    recipe: [],
    stats: {},
    effects: [],
    tags: [],
    provenance: { source: 'manual', patch: '0.0.0', verifiedInGame: false },
    ...overrides,
  }
}

describe('validateItemCost', () => {
  it('passes when total equals sum of components plus combine', () => {
    const sword = makeItem({ id: 'long-sword', cost: { total: 350, combine: 350 } })
    const bfSword = makeItem({
      id: 'bf-sword', recipe: ['long-sword', 'long-sword'], cost: { total: 1300, combine: 600 },
    })
    const allItems = new Map([[sword.id, sword], [bfSword.id, bfSword]])
    expect(validateItemCost(bfSword, allItems)).toEqual([])
  })

  it('fails when total does not match component sum plus combine', () => {
    const sword = makeItem({ id: 'long-sword', cost: { total: 350, combine: 350 } })
    const bad = makeItem({ id: 'bad-item', recipe: ['long-sword'], cost: { total: 999, combine: 100 } })
    const allItems = new Map([[sword.id, sword], [bad.id, bad]])
    expect(validateItemCost(bad, allItems)).toHaveLength(1)
  })
})

describe('validateRecipeIds', () => {
  it('fails when a recipe references an unknown item id', () => {
    const item = makeItem({ recipe: ['does-not-exist'] })
    expect(validateRecipeIds(item, new Map())).toHaveLength(1)
  })

  it('passes when every recipe id resolves', () => {
    const sword = makeItem({ id: 'long-sword' })
    const item = makeItem({ recipe: ['long-sword'] })
    expect(validateRecipeIds(item, new Map([[sword.id, sword]]))).toEqual([])
  })
})

describe('validateUniqueGroups', () => {
  it('fails when two different effects in the same item share a uniqueGroup', () => {
    const item = makeItem({
      effects: [
        {
          id: 'a', name: 'A', description: '', support: 'full', kind: 'stat', stat: 'ad',
          amount: 10, uniqueGroup: 'shared',
        },
        {
          id: 'b', name: 'B', description: '', support: 'full', kind: 'stat', stat: 'ap',
          amount: 10, uniqueGroup: 'shared',
        },
      ] as Item['effects'],
    })
    expect(validateUniqueGroups(item)).toHaveLength(1)
  })

  it('passes when uniqueGroup values differ', () => {
    const item = makeItem({
      effects: [
        {
          id: 'a', name: 'A', description: '', support: 'full', kind: 'stat', stat: 'ad',
          amount: 10, uniqueGroup: 'group-a',
        },
        {
          id: 'b', name: 'B', description: '', support: 'full', kind: 'stat', stat: 'ap',
          amount: 10, uniqueGroup: 'group-b',
        },
      ] as Item['effects'],
    })
    expect(validateUniqueGroups(item)).toEqual([])
  })
})

describe('validateItemHandlers', () => {
  it('fails when a custom effect references an unregistered handler', () => {
    const item = makeItem({
      effects: [
        { id: 'a', name: 'A', description: '', support: 'partial', kind: 'custom', handler: 'unknownHandler' },
      ] as Item['effects'],
    })
    expect(validateItemHandlers(item, new Set(['knownHandler']))).toHaveLength(1)
  })

  it('passes when the handler is registered', () => {
    const item = makeItem({
      effects: [
        { id: 'a', name: 'A', description: '', support: 'partial', kind: 'custom', handler: 'knownHandler' },
      ] as Item['effects'],
    })
    expect(validateItemHandlers(item, new Set(['knownHandler']))).toEqual([])
  })
})

describe('validateItem (composed)', () => {
  it('unions errors from all four checks', () => {
    const item = makeItem({
      recipe: ['missing'],
      cost: { total: 1, combine: 1 },
      effects: [
        { id: 'a', name: 'A', description: '', support: 'partial', kind: 'custom', handler: 'nope' },
      ] as Item['effects'],
    })
    const errors = validateItem(item, new Map(), new Set())
    expect(errors.length).toBeGreaterThanOrEqual(2)
  })
})
