import { describe, it, expect } from 'vitest'
import { ChampionSchema, ItemSchema } from '@wr-calc/schema'
import { GENERATED_CHAMPIONS } from '../src/patches/7.3/generated/champions'
import { GENERATED_ITEMS } from '../src/patches/7.3/generated/items'

// Counts are the 2026-09-23 wrpocket snapshot for patch 7.3; a re-import that changes them should
// update these deliberately.
describe('GENERATED_ITEMS', () => {
  it('has all 171 patch 7.3 items with unique ids', () => {
    expect(GENERATED_ITEMS).toHaveLength(171)
    expect(new Set(GENERATED_ITEMS.map((item) => item.id)).size).toBe(171)
  })

  it('every item parses against ItemSchema and is marked as unverified wiki data', () => {
    for (const item of GENERATED_ITEMS) {
      expect(() => ItemSchema.parse(item), item.id).not.toThrow()
      expect(item.provenance, item.id).toEqual({ source: 'wiki', patch: '7.3', verifiedInGame: false })
    }
  })

  it('every recipe component exists', () => {
    const ids = new Set(GENERATED_ITEMS.map((item) => item.id))
    for (const item of GENERATED_ITEMS) {
      for (const component of item.recipe) expect(ids.has(component), `${item.id} → ${component}`).toBe(true)
    }
  })

  it('has the aliased BF Sword id', () => {
    expect(GENERATED_ITEMS.find((item) => item.id === 'bf-sword')?.stats).toEqual({ ad: 40 })
  })
})

describe('GENERATED_CHAMPIONS', () => {
  it('has all 142 patch 7.3 champions with unique ids', () => {
    expect(GENERATED_CHAMPIONS).toHaveLength(142)
    expect(new Set(GENERATED_CHAMPIONS.map((champion) => champion.id)).size).toBe(142)
  })

  it('every champion parses against ChampionSchema and is marked as unverified wiki data', () => {
    for (const champion of GENERATED_CHAMPIONS) {
      expect(() => ChampionSchema.parse(champion), champion.id).not.toThrow()
      expect(champion.provenance, champion.id).toEqual({ source: 'wiki', patch: '7.3', verifiedInGame: false })
    }
  })

  it('maps Jinx from the site data (spot check)', () => {
    const jinx = GENERATED_CHAMPIONS.find((champion) => champion.id === 'jinx')!
    expect(jinx.baseStats.hp).toEqual({ base: 630, perLevel: 120 })
    expect(jinx.abilities.w.damage[0]).toEqual({
      type: 'physical', base: { byRank: [10, 80, 150, 220] }, ratios: [{ stat: 'totalAd', value: 1.6 }], tags: [],
    })
    expect(jinx.abilities.r.maxRank).toBe(3)
  })
})
