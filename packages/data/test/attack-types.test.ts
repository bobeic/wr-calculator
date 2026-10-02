import { describe, it, expect } from 'vitest'
import { EffectSchema } from '@wr-calc/schema'
import { combatantFromChampion, combatantFromDummy, effectForAttackType, simulateCombo } from '@wr-calc/calc'
import { FORM_DEPENDENT_CHAMPIONS, RANGED_CHAMPIONS, attackTypeOf } from '../src/attack-types'
import { getPatchDataset } from '../src/patches/registry'

const dataset = getPatchDataset('7.3a')
const champion = (id: string) => dataset.champions.find((entry) => entry.id === id)!
const dummy = () => combatantFromDummy({ kind: 'dummy', hp: 10000, armor: 100, mr: 100 })

describe('attack types', () => {
  it('lists only real champions, and every dataset champion has an attack type', () => {
    const ids = new Set(dataset.champions.map((entry) => entry.id))
    expect([...RANGED_CHAMPIONS, ...FORM_DEPENDENT_CHAMPIONS].filter((id) => !ids.has(id))).toEqual([])
    expect(dataset.champions.every((entry) => entry.attackType === attackTypeOf(entry.id))).toBe(true)
    expect(champion('jinx').attackType).toBe('ranged')
    expect(champion('ambessa').attackType).toBe('melee')
  })

  it('every effect with ranged values is still a valid effect after applying them', () => {
    const effects = [
      ...dataset.items.flatMap((item) => item.effects), ...dataset.runes.flatMap((rune) => rune.effects),
      ...dataset.spells.flatMap((spell) => spell.effects),
    ].filter((effect) => effect.ranged !== undefined)
    expect(effects.length).toBeGreaterThanOrEqual(11)
    for (const effect of effects) {
      const ranged = effectForAttackType(effect, 'ranged')
      expect(() => EffectSchema.parse(ranged), effect.id).not.toThrow()
      expect(ranged, effect.id).not.toEqual(effectForAttackType(effect, 'melee'))
    }
  })

  it.each([['ambessa', 210], ['jinx', 168]] as const)('Kraken Slayer gives %s %d at level 15 (before the missing-Health amp)', (id, base) => {
    const result = simulateCombo(
      combatantFromChampion(champion(id), 15, { items: ['kraken-slayer'], runes: [], inputs: {} }, dataset.catalog),
      dummy(), ['AA', 'AA', 'AA'], { critMode: 'never' },
    )
    const part = result.instances[2].parts!.find((entry) => entry.source.id === 'kraken-slayer-bring-it-down')!
    const missingPct = (10000 - result.instances[1].targetHpAfter) / 100
    expect(part.amount).toBeCloseTo(base * (1 + missingPct * 0.0075), 6)
  })

  it('a ranged champion gets ranged stat values: Yordle Trap gives Jinx 20% attack speed, Ambessa 30%', () => {
    const bonusAs = (id: string) => combatantFromChampion(
      champion(id), 15, { items: ['yordle-trap'], runes: [], inputs: { 'yordle-trap-inspired': true } }, dataset.catalog,
    ).sheet.breakdown.find((entry) => entry.source.id === 'yordle-trap-catcher')!.amount
    expect(bonusAs('jinx')).toBeCloseTo(0.2, 9)
    expect(bonusAs('ambessa')).toBeCloseTo(0.3, 9)
  })
})
