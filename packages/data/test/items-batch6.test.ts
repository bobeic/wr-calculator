import { describe, it, expect } from 'vitest'
import { ItemSchema } from '@wr-calc/schema'
import type { Build } from '@wr-calc/schema'
import { combatantFromChampion, combatantFromDummy, simulateCombo } from '@wr-calc/calc'
import type { ComboAction } from '@wr-calc/calc'
import { getPatchDataset } from '../src/patches/registry'
import { BATCH6_ITEMS } from '../src/patches/7.3a/items-batch6'

const dataset = getPatchDataset('7.3a')
const ambessa = dataset.champions.find((champion) => champion.id === 'ambessa')!
const dummy = (startHpFraction = 1) => combatantFromDummy({ kind: 'dummy', hp: 10000, armor: 100, mr: 100, startHpFraction })
const ambessaWith = (items: string[], inputs: Build['inputs'] = {}, boots?: string) => combatantFromChampion(
  ambessa, 15, { items, runes: [], inputs, ...(boots && { boots }) }, dataset.catalog,
)
const LONG_COMBO: ComboAction[] = ['AA', 'Q', 'AA', 'W', 'AA', 'E', 'dash', 'AA', 'R', 'AA', 'AA', 'AA', 'AA', 'wait:6']

describe('batch 6 items', () => {
  it('are valid items, carried into the 7.3a dataset with wrpocket\'s price and stats', () => {
    for (const item of BATCH6_ITEMS) {
      expect(() => ItemSchema.parse(item)).not.toThrow()
      const live = dataset.items.find((entry) => entry.id === item.id)!
      expect(live.effects).toEqual(item.effects)
      expect(live.cost).toEqual(item.cost)
    }
  })

  it('all run through a full combo without errors or unapplied damage', () => {
    for (const item of BATCH6_ITEMS) {
      const build = item.tier === 'boots' ? ambessaWith([], {}, item.id) : ambessaWith([item.id])
      const active = item.effects.some((effect) => effect.kind === 'active') ? [`item:${item.id}` as ComboAction] : []
      const result = simulateCombo(build, dummy(), [...active, ...LONG_COMBO])
      expect(result.dataWarnings.filter((warning) => warning.includes('scheduled')), item.id).toEqual([])
    }
  })

  it.each([
    'recurve-bow-reinforced', 'sheen-spellblade', 'kircheis-shard-shock', 'hextech-alternator-revved', 'fated-ashes-kindle',
    'bamis-cinder-cinders', 'wits-end-at-wits-end', 'terminus-shadow', 'guinsoos-rageblade-wrath',
    'kraken-slayer-bring-it-down', 'hullbreaker-skipper', 'essence-reaver-spellblade', 'divine-sunderer-spellblade',
    'iceborn-gauntlet-spellblade', 'duskblade-of-draktharr-nightstalker', 'titanic-hydra-cleave', 'dusk-and-dawn-spellblade',
    'sunfire-aegis-immolate', 'hollow-radiance-immolate', 'unending-despair-anguish', 'zekes-convergence-frostfire-tempest',
  ])('%s deals damage in a long combo', (effectId) => {
    const item = BATCH6_ITEMS.find((entry) => entry.effects.some((effect) => effect.id === effectId))!
    const result = simulateCombo(ambessaWith([item.id]), dummy(), LONG_COMBO)
    const dealt = result.instances.filter((instance) => instance.source.id === effectId || instance.parts?.some((part) => part.source.id === effectId))
    expect(dealt.length, effectId).toBeGreaterThan(0)
  })

  it('Kraken Slayer adds 210 (level 15, melee) to every third attack, more as the target loses Health', () => {
    const result = simulateCombo(ambessaWith(['kraken-slayer']), dummy(), ['AA', 'AA', 'AA'], { critMode: 'never' })
    const third = result.instances[2]
    const part = third.parts!.find((entry) => entry.source.id === 'kraken-slayer-bring-it-down')!
    const missing = (10000 - result.instances[1].targetHpAfter) / 10000
    expect(part.amount).toBeCloseTo(210 * (1 + missing * 100 * 0.0075), 6)
    expect(result.instances.slice(0, 2).every((instance) => instance.parts === undefined)).toBe(true)
  })

  it('Energized items proc on the first attack when charged, then every 12th', () => {
    const procs = (inputs: Build['inputs']) => simulateCombo(
      ambessaWith(['rapid-firecannon'], inputs), dummy(), Array<ComboAction>(13).fill('AA'), { critMode: 'never' },
    ).instances.filter((instance) => instance.source.id === 'rapid-firecannon-energized').length
    expect(procs({ 'energized-ready': true })).toBe(2)
    expect(procs({})).toBe(1)
  })

  it('The Collector executes a target left under 5% Health', () => {
    const result = simulateCombo(ambessaWith(['the-collector']), dummy(0.06), ['AA', 'AA', 'AA'], { critMode: 'never' })
    expect(result.instances.some((instance) => instance.source.id === 'the-collector-death-and-taxes')).toBe(true)
    expect(result.killed).toBe(true)
  })

  it('Terminus grants Dark armor pen from the second attack', () => {
    const result = simulateCombo(ambessaWith(['terminus']), dummy(), ['AA', 'AA', 'AA'], { critMode: 'never' })
    const physical = result.instances.filter((instance) => instance.source.id === 'AA')
    // Effective armor from the mitigation ratio: attack 3 hits 10 less (10% of 100 armor, from attack 2's Dark stack)
    // than attacks 1 and 2, on top of Ambessa's own pen.
    const armor = (index: number) => 100 * physical[index].raw / physical[index].mitigated - 100
    expect(armor(0)).toBeCloseTo(armor(1), 6)
    expect(armor(1) - armor(2)).toBeCloseTo(10, 6)
  })

  it('Phantom Dancer stacks attack speed, so attacks come faster', () => {
    const times = simulateCombo(ambessaWith(['phantom-dancer']), dummy(), ['AA', 'AA', 'AA'], { critMode: 'never' })
      .instances.map((instance) => instance.time)
    expect(times[2] - times[1]).toBeLessThan(times[1] - times[0])
  })

  it("Dominik's Regards amplifies nothing against a dummy (no bonus Health)", () => {
    const withItem = simulateCombo(ambessaWith(['dominiks-regards']), dummy(), ['AA'], { critMode: 'never' })
    expect(withItem.unsupportedEffects.some((entry) => entry.id === 'dominiks-regards-giant-slayer')).toBe(false)
  })

  it('Immortal Boots pick AD for Ambessa and amplify damage while above half Health', () => {
    const off = simulateCombo(ambessaWith([], {}, 'immortal-boots'), dummy(), ['AA'], { critMode: 'never' })
    const on = simulateCombo(ambessaWith([], { 'immortal-boots-above-half': true }, 'immortal-boots'), dummy(), ['AA'], { critMode: 'never' })
    expect(on.instances[0].raw / off.instances[0].raw).toBeCloseTo(1.05, 6)
  })
})
