import { describe, it, expect } from 'vitest'
import { buildCatalog } from '../src/catalog'
import { PATCH_7_3_ITEMS } from '../src/patches/7.3/items'
import { PATCH_7_3_CATALOG } from '../src/patches/7.3'

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
