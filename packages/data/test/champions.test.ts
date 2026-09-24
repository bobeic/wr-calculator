import { describe, it, expect } from 'vitest'
import { ChampionSchema } from '@wr-calc/schema'
import { PATCH_7_3_CHAMPIONS } from '../src/patches/7.3'

describe('PATCH_7_3_CHAMPIONS', () => {
  it('includes the 4 starter champions', () => {
    const ids = PATCH_7_3_CHAMPIONS.map((champion) => champion.id)
    for (const id of ['annie', 'jinx', 'nunu-willump', 'rammus']) expect(ids).toContain(id)
  })

  it('every champion parses against ChampionSchema', () => {
    for (const champion of PATCH_7_3_CHAMPIONS) {
      expect(() => ChampionSchema.parse(champion), champion.id).not.toThrow()
    }
  })

  it('starter champions have 4-rank basic abilities and a 3-rank ultimate', () => {
    for (const id of ['annie', 'jinx', 'nunu-willump', 'rammus']) {
      const champion = PATCH_7_3_CHAMPIONS.find((candidate) => candidate.id === id)!
      for (const key of ['q', 'w', 'e'] as const) expect(champion.abilities[key].maxRank, `${id}.${key}`).toBe(4)
      expect(champion.abilities.r.maxRank, `${id}.r`).toBe(3)
    }
  })

  it('every champion is marked as unverified wiki data', () => {
    for (const champion of PATCH_7_3_CHAMPIONS) {
      expect(champion.provenance, champion.id).toEqual({ source: 'wiki', patch: '7.3', verifiedInGame: false })
    }
  })
})
