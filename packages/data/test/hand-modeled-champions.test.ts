import { describe, it, expect } from 'vitest'
import { combatantFromChampion, combatantFromDummy, simulateCombo, championKitEffects } from '@wr-calc/calc'
import { ChampionSchema } from '@wr-calc/schema'
import { HAND_MODELED_CHAMPIONS, PATCH_7_3_CHAMPIONS } from '../src/patches/7.3'
import { GENERATED_CHAMPIONS } from '../src/patches/7.3/generated/champions'
import { buildCatalog } from '../src/catalog'

describe('HAND_MODELED_CHAMPIONS', () => {
  it('replaces the generated entry for each hand-modelled champion', () => {
    for (const champion of HAND_MODELED_CHAMPIONS) {
      // The dataset copies each champion to add its attack type.
      expect(PATCH_7_3_CHAMPIONS.find((entry) => entry.id === champion.id), champion.id).toEqual({ ...champion, attackType: 'melee' })
    }
    expect(PATCH_7_3_CHAMPIONS).toHaveLength(GENERATED_CHAMPIONS.length)
  })

  it('parses against ChampionSchema and keeps the generated base stats', () => {
    for (const champion of HAND_MODELED_CHAMPIONS) {
      expect(() => ChampionSchema.parse(champion), champion.id).not.toThrow()
      const generated = GENERATED_CHAMPIONS.find((entry) => entry.id === champion.id)!
      expect(champion.baseStats, champion.id).toEqual(generated.baseStats)
      expect(champion.attackSpeed, champion.id).toEqual(generated.attackSpeed)
    }
  })

  it("prefixes every kit effect id with the champion's id, so none can collide with an item effect", () => {
    for (const champion of HAND_MODELED_CHAMPIONS) {
      const ids = championKitEffects(champion).map((effect) => effect.id)
      expect(new Set(ids).size, champion.id).toBe(ids.length)
      for (const id of ids) expect(id.startsWith(`${champion.id}-`), id).toBe(true)
    }
  })
})

describe('Ambessa', () => {
  const ambessa = HAND_MODELED_CHAMPIONS.find((champion) => champion.id === 'ambessa')!
  const dummy = () => combatantFromDummy({ kind: 'dummy', hp: 10000, armor: 100, mr: 100 })
  const attacker = () => combatantFromChampion(
    ambessa, 15, { items: [], runes: [], inputs: {} }, buildCatalog([])
  )

  it('gets 30% armor pen from R at rank 3, so a level-15 attack deals 121 × 100/170', () => {
    const result = simulateCombo(attacker(), dummy(), ['AA'], { critMode: 'never' })
    expect(result.instances[0].mitigated).toBeCloseTo(121 * 100 / 170, 6)
  })

  it('runs the full kit: Sweep, Slam, Lacerate and its dash recast, then an empowered attack as one hit', () => {
    const result = simulateCombo(attacker(), dummy(), ['Q', 'Q', 'E', 'dash', 'AA'], { critMode: 'never' })
    expect(result.instances.map((i) => i.source.id)).toEqual([
      'ambessa-q', 'ambessa-q-sundering-slam', 'ambessa-e', 'ambessa-e-recast', 'AA',
    ])
    expect(result.instances[4].parts?.map((part) => part.source.id)).toEqual([
      'AA', 'ambessa-passive-drakehounds-step',
    ])
  })
})
