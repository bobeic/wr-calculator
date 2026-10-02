import { describe, it, expect } from 'vitest'
import { SummonerSpellSchema } from '@wr-calc/schema'
import { combatantFromChampion, combatantFromDummy, simulateCombo } from '@wr-calc/calc'
import { getPatchDataset } from '../src/patches/registry'
import { SPELLS_7_3A } from '../src/patches/7.3a/spells'

const dataset = getPatchDataset('7.3a')
const ambessa = dataset.champions.find((champion) => champion.id === 'ambessa')!
const dummy = () => combatantFromDummy({ kind: 'dummy', hp: 10000, armor: 100, mr: 100 })

describe('7.3a summoner spells', () => {
  it('are valid and in the catalog, one per wrpocket spell', () => {
    expect(SPELLS_7_3A).toHaveLength(9)
    for (const spell of SPELLS_7_3A) {
      expect(() => SummonerSpellSchema.parse(spell)).not.toThrow()
      expect(dataset.catalog.spells?.get(spell.id)).toBe(spell)
    }
  })

  it('Ignite burns for 380 true damage at level 15, over 5 seconds', () => {
    const attacker = combatantFromChampion(ambessa, 15, { items: [], runes: [], spells: ['ignite', 'flash'], inputs: {} }, dataset.catalog)
    const result = simulateCombo(attacker, dummy(), ['spell:ignite', 'wait:5'])
    const ticks = result.instances.filter((instance) => instance.source.id === 'ignite-burn')
    expect(ticks).toHaveLength(5)
    expect(ticks.reduce((sum, tick) => sum + tick.mitigated, 0)).toBeCloseTo(380, 6)
    expect(ticks.map((tick) => tick.time)).toEqual([1, 2, 3, 4, 5])
  })

  it('a spell not in the build does nothing, and more than two spells is rejected', () => {
    const attacker = combatantFromChampion(ambessa, 15, { items: [], runes: [], spells: ['flash'], inputs: {} }, dataset.catalog)
    expect(simulateCombo(attacker, dummy(), ['spell:ignite', 'wait:5']).instances).toEqual([])
    expect(() => combatantFromChampion(ambessa, 15, { items: [], runes: [], spells: ['flash', 'ignite', 'heal'], inputs: {} }, dataset.catalog))
      .toThrow(/summoner spells/)
  })
})
