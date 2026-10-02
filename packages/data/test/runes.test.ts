import { describe, it, expect } from 'vitest'
import { RuneSchema } from '@wr-calc/schema'
import type { Build } from '@wr-calc/schema'
import { combatantFromChampion, combatantFromDummy, simulateCombo } from '@wr-calc/calc'
import type { ComboAction } from '@wr-calc/calc'
import { getPatchDataset } from '../src/patches/registry'
import { RUNES_7_3A } from '../src/patches/7.3a/runes'

const dataset = getPatchDataset('7.3a')
const ambessa = dataset.champions.find((champion) => champion.id === 'ambessa')!
const annie = dataset.champions.find((champion) => champion.id === 'annie')!
const dummy = (startHpFraction = 1) => combatantFromDummy({ kind: 'dummy', hp: 10000, armor: 100, mr: 100, startHpFraction })
const withRunes = (runes: string[], inputs: Build['inputs'] = {}, items: string[] = [], champion = ambessa) =>
  combatantFromChampion(champion, 15, { items, runes, inputs }, dataset.catalog)
const total = (result: ReturnType<typeof simulateCombo>) => result.instances.reduce((sum, instance) => sum + instance.mitigated, 0)
const sourceIds = (result: ReturnType<typeof simulateCombo>) => new Set(result.instances.flatMap((instance) => [instance.source.id, ...(instance.parts ?? []).map((part) => part.source.id)]))
const COMBO: ComboAction[] = ['Q', 'AA', 'W', 'AA', 'E', 'AA', 'R', 'AA', 'wait:3']

describe('7.3a runes', () => {
  it('are valid and in the dataset catalog, one entry per wrpocket rune', () => {
    expect(RUNES_7_3A).toHaveLength(52)
    for (const rune of RUNES_7_3A) {
      expect(() => RuneSchema.parse(rune)).not.toThrow()
      expect(dataset.catalog.runes.get(rune.id)).toBe(rune)
    }
    expect(RUNES_7_3A.filter((rune) => rune.slot === 'keystone')).toHaveLength(13)
  })

  it('each run through a combo without errors', () => {
    for (const rune of RUNES_7_3A) {
      expect(() => simulateCombo(withRunes([rune.id]), dummy(), COMBO), rune.id).not.toThrow()
    }
  })

  it.each([
    ['electrocute', 'electrocute-proc'], ['aery', 'aery-damage'], ['arcane-comet', 'arcane-comet-damage'],
    ['grasp-of-undying', 'grasp-of-undying-attack'], ['empowered-attack', 'empowered-attack-damage'],
    ['chain-assault', 'chain-assault-damage'], ['scorch', 'scorch-damage'], ['brutal', 'brutal-damage'],
    ['empowerment', 'empowerment-proc'],
  ])('%s deals its damage', (runeId, effectId) => {
    expect(sourceIds(simulateCombo(withRunes([runeId]), dummy(), COMBO)).has(effectId)).toBe(true)
  })

  it('Electrocute deals adaptive damage: physical for Ambessa (AD build), magic for Annie', () => {
    const type = (champion: typeof ambessa, items: string[]) => simulateCombo(withRunes(['electrocute'], {}, items, champion), dummy(), COMBO)
      .instances.find((instance) => instance.source.id === 'electrocute-proc')?.type
    expect(type(ambessa, ['bf-sword'])).toBe('physical')
    expect(type(annie, ['blasting-wand'])).toBe('magic')
  })

  it('Conqueror raises damage as it stacks', () => {
    const without = total(simulateCombo(withRunes([]), dummy(), COMBO, { critMode: 'never' }))
    const conqueror = total(simulateCombo(withRunes(['conqueror']), dummy(), COMBO, { critMode: 'never' }))
    expect(conqueror).toBeGreaterThan(without)
  })

  it('Dark Harvest needs the target below half Health and adds 11 per soul', () => {
    const proc = (fraction: number, souls: number) => simulateCombo(withRunes(['dark-harvest'], { 'dark-harvest-souls': souls }), dummy(fraction), ['AA'], { critMode: 'never' })
      .instances.find((instance) => instance.source.id === 'dark-harvest-proc')
    expect(proc(1, 0)).toBeUndefined()
    expect(proc(0.4, 10)!.raw - proc(0.4, 0)!.raw).toBeCloseTo(110, 6)
  })

  it('Axiom Arcanist amplifies only the ultimate', () => {
    const raw = (runes: string[], key: 'ambessa-r' | 'ambessa-q') => simulateCombo(withRunes(runes), dummy(), ['Q', 'R'], { critMode: 'never' })
      .instances.filter((instance) => instance.source.id.startsWith(key)).reduce((sum, instance) => sum + instance.raw, 0)
    expect(raw(['axiom-arcanist'], 'ambessa-r') / raw([], 'ambessa-r')).toBeCloseTo(1.1, 6)
    expect(raw(['axiom-arcanist'], 'ambessa-q')).toBeCloseTo(raw([], 'ambessa-q'), 6)
  })

  it('rejects two keystones', () => {
    expect(() => withRunes(['electrocute', 'conqueror'])).toThrow(/keystones/)
  })
})
