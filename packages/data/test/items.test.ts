import { describe, it, expect } from 'vitest'
import { ItemSchema } from '@wr-calc/schema'
import { PATCH_7_3_ITEMS } from '../src/patches/7.3/items'

const EXPECTED_IDS = [
  'long-sword', 'bf-sword', 'blasting-wand', 'rabadons-deathcap', 'blade-of-the-ruined-king',
  'trinity-force', 'liandrys-torment', 'void-staff', 'black-cleaver', 'infinity-edge',
  'navori-quickblades', 'heartsteel', 'seraphs-embrace', 'plated-steelcaps', 'force-of-nature',
].sort()

describe('PATCH_7_3_ITEMS', () => {
  it('has exactly the 15 starter items', () => {
    expect(PATCH_7_3_ITEMS.map((item) => item.id).sort()).toEqual(EXPECTED_IDS)
  })

  it('every item parses against ItemSchema', () => {
    for (const item of PATCH_7_3_ITEMS) {
      expect(() => ItemSchema.parse(item), item.id).not.toThrow()
    }
  })

  it('every item cost is internally consistent (recipe: [], so combine === total)', () => {
    for (const item of PATCH_7_3_ITEMS) {
      expect(item.recipe, item.id).toEqual([])
      expect(item.cost.combine, item.id).toBe(item.cost.total)
    }
  })

  it('every item is marked unverified for patch 7.3', () => {
    for (const item of PATCH_7_3_ITEMS) {
      expect(item.provenance, item.id).toEqual({
        source: 'manual', patch: '7.3', verifiedInGame: false,
      })
    }
  })
})
