import { describe, it, expect } from 'vitest'
import type { Champion, Effect } from '@wr-calc/schema'
import { bindAbilityRank, championKitEffects } from '../src/kit-effects'

const penEffect: Effect = {
  id: 'r-pen', name: 'Pen', description: '', support: 'full',
  kind: 'stat', stat: 'pctArmorPen', amount: { byRank: [0.1, 0.2, 0.3] },
}

function champion(): Champion {
  const ability = (id: string, maxRank: number, effects?: Effect[]) => ({
    id, name: id, maxRank, cooldown: 1, castTime: 0, damage: [], flags: {}, ...(effects ? { effects } : {}),
  })
  return {
    id: 'kit-champ', name: 'Kit Champ', resource: 'none',
    baseStats: { hp: { base: 1000, perLevel: 0 }, ad: { base: 100, perLevel: 0 } },
    attackSpeed: { base: 1, ratio: 0 },
    provenance: { source: 'manual', patch: 'test', verifiedInGame: false },
    abilities: {
      passive: ability('p', 1), q: ability('q', 4), w: ability('w', 4), e: ability('e', 4),
      r: ability('r', 3, [penEffect]),
    },
  }
}

describe('bindAbilityRank', () => {
  it('replaces every byRank scalar, however deeply nested, with its value at the rank', () => {
    const value = { a: { byRank: [1, 2, 3] }, b: [{ c: { byRank: [4, 5, 6] } }], d: 7, e: { byLevel: [1, 2] } }
    expect(bindAbilityRank(value, 2)).toEqual({ a: 2, b: [{ c: 5 }], d: 7, e: { byLevel: [1, 2] } })
  })

  it('clamps the rank to the byRank array and leaves an empty byRank untouched', () => {
    expect(bindAbilityRank({ byRank: [1, 2] }, 5)).toBe(2)
    expect(bindAbilityRank({ byRank: [] }, 1)).toEqual({ byRank: [] })
  })
})

describe('championKitEffects', () => {
  it("returns each ability's effects bound at that ability's max rank", () => {
    expect(championKitEffects(champion())).toEqual([{ ...penEffect, amount: 0.3 }])
  })
})
