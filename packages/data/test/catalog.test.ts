import { describe, it, expect } from 'vitest'
import { buildCatalog, mergeById } from '../src/catalog'
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
