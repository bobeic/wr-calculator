import { describe, it, expect } from 'vitest'
import { buildCatalog, mergeById, withExclusiveGroups } from '../src/catalog'
import { PATCH_7_3_ITEMS, PATCH_7_3_CATALOG } from '../src/patches/7.3'

describe('buildCatalog', () => {
  it('indexes items by id', () => {
    const catalog = buildCatalog(PATCH_7_3_ITEMS)
    expect(catalog.items.get('long-sword')?.name).toBe('Long Sword')
  })

  it('defaults to an empty rune map when none are given', () => {
    const catalog = buildCatalog(PATCH_7_3_ITEMS)
    expect(catalog.runes.size).toBe(0)
  })
})

describe('PATCH_7_3_CATALOG', () => {
  it('contains every patch 7.3 starter item', () => {
    expect(PATCH_7_3_CATALOG.items.size).toBe(PATCH_7_3_ITEMS.length)
  })
})

describe('mergeById', () => {
  it('keeps base order, replaces same ids, and appends override-only ids', () => {
    const base = [{ id: 'a', v: 1 }, { id: 'b', v: 1 }, { id: 'c', v: 1 }]
    const overrides = [{ id: 'd', v: 2 }, { id: 'b', v: 2 }]
    expect(mergeById(base, overrides)).toEqual([
      { id: 'a', v: 1 }, { id: 'b', v: 2 }, { id: 'c', v: 1 }, { id: 'd', v: 2 },
    ])
  })

  it('returns a copy of base when there are no overrides', () => {
    const base = [{ id: 'a' }]
    const merged = mergeById(base, [])
    expect(merged).toEqual(base)
    expect(merged).not.toBe(base)
  })
})

describe('withExclusiveGroups', () => {
  const items = [
    { id: 'a', name: 'A', tier: 'legendary' as const, stats: {}, effects: [], tags: [] },
    { id: 'b', name: 'B', tier: 'legendary' as const, stats: {}, effects: [], tags: [] },
  ] as unknown as Parameters<typeof withExclusiveGroups>[0]

  it('sets each listed item\'s exclusiveGroup and leaves the rest untouched', () => {
    const result = withExclusiveGroups(items, { a: 'group-1' })
    expect(result.map((item) => item.exclusiveGroup)).toEqual(['group-1', undefined])
    expect(items[0].exclusiveGroup).toBeUndefined()
  })

  it('throws when a listed item id is not in the item list', () => {
    expect(() => withExclusiveGroups(items, { missing: 'group-1' })).toThrow(/missing/)
  })
})
