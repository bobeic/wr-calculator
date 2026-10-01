import { describe, it, expect } from 'vitest'
import type { Build } from '@wr-calc/schema'
import { BuildSchema } from '@wr-calc/schema'
import { combatantFromChampion, combatantFromDummy, simulateCombo } from '@wr-calc/calc'
import type { ComboAction } from '@wr-calc/calc'
import { buildChampionMap } from '../src/champion-map'
import { getPatchDataset } from '../src/patches/registry'

const dataset = getPatchDataset('7.3a')
const ambessa = buildChampionMap(dataset.champions).get('ambessa')!
const dummy = () => combatantFromDummy({ kind: 'dummy', hp: 10000, armor: 100, mr: 100 })
const build = (abilityRanks?: Build['abilityRanks']): Build => ({ items: [], runes: [], inputs: {}, ...(abilityRanks ? { abilityRanks } : {}) })
const damage = (abilityRanks: Build['abilityRanks'] | undefined, combo: ComboAction[]): number => {
  const result = simulateCombo(combatantFromChampion(ambessa, 15, build(abilityRanks), dataset.catalog), dummy(), combo, { critMode: 'expected' })
  return Object.values(result.totalsByType).reduce((sum, value) => sum + (value ?? 0), 0)
}

describe('ability ranks', () => {
  it('defaults every ability to max rank, the same as naming the max ranks', () => {
    const combatant = combatantFromChampion(ambessa, 15, build(), dataset.catalog)
    expect(combatant.abilityRanks).toEqual({ q: 4, w: 4, e: 4, r: 3 })
    expect(damage(undefined, ['Q'])).toBeCloseTo(damage({ q: 4, w: 4, e: 4, r: 3 }, ['Q']), 9)
  })

  it('a lower Q rank deals less Q damage', () => {
    expect(damage({ q: 1 }, ['Q'])).toBeLessThan(damage({ q: 4 }, ['Q']))
  })

  it('binds kit effects at the chosen rank: R rank 1 gives less armor pen from its passive than rank 3', () => {
    const pen = (r: number) => combatantFromChampion(ambessa, 15, build({ r }), dataset.catalog).sheet.total.pctArmorPen ?? 0
    expect(pen(3)).toBeCloseTo(0.3, 9)
    expect(pen(1)).toBeLessThan(pen(3))
  })

  it('rejects a rank outside 1..maxRank', () => {
    expect(() => combatantFromChampion(ambessa, 15, build({ r: 4 }), dataset.catalog)).toThrow(/R rank 4 is outside 1..3/)
    expect(() => BuildSchema.parse(build({ q: 0 }))).toThrow()
  })
})
