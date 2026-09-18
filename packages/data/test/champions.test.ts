import { describe, it, expect } from 'vitest'
import { ChampionSchema } from '@wr-calc/schema'
import { PATCH_7_3_CHAMPIONS } from '../src/patches/7.3/champions'

describe('PATCH_7_3_CHAMPIONS', () => {
  it('has exactly the 4 starter champions', () => {
    expect(PATCH_7_3_CHAMPIONS.map((c) => c.id).sort()).toEqual(
      ['annie', 'jinx', 'nunu-willump', 'rammus']
    )
  })

  it('every champion parses against ChampionSchema', () => {
    for (const champion of PATCH_7_3_CHAMPIONS) {
      expect(() => ChampionSchema.parse(champion), champion.id).not.toThrow()
    }
  })

  it('every champion declares all 5 ability slots with non-empty ids', () => {
    for (const champion of PATCH_7_3_CHAMPIONS) {
      for (const key of ['passive', 'q', 'w', 'e', 'r'] as const) {
        expect(champion.abilities[key].id, `${champion.id}.${key}`).not.toBe('')
      }
    }
  })

  it('every champion is marked unverified for patch 7.3', () => {
    for (const champion of PATCH_7_3_CHAMPIONS) {
      expect(champion.provenance, champion.id).toEqual({
        source: 'manual', patch: '7.3', verifiedInGame: false,
      })
    }
  })
})
