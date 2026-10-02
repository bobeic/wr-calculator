import { describe, it, expect } from 'vitest'
import type { Build } from '@wr-calc/schema'
import { ChampionSchema } from '@wr-calc/schema'
import { championKitEffects, combatantFromChampion, combatantFromDummy, simulateCombo } from '@wr-calc/calc'
import type { ComboAction } from '@wr-calc/calc'
import { HAND_MODELED_CHAMPIONS_7_3A } from '../src/patches/7.3a/champions'
import { GENERATED_CHAMPIONS } from '../src/patches/7.3a/generated/champions'
import { getPatchDataset } from '../src/patches/registry'

const dataset = getPatchDataset('7.3a')
const champion = (id: string) => dataset.champions.find((entry) => entry.id === id)!
const dummy = () => combatantFromDummy({ kind: 'dummy', hp: 10000, armor: 100, mr: 100 })
const attacker = (id: string, inputs: Build['inputs'] = {}) => combatantFromChampion(
  champion(id), 15, { items: [], runes: [], inputs }, dataset.catalog,
)
const run = (id: string, combo: ComboAction[], inputs: Build['inputs'] = {}) =>
  simulateCombo(attacker(id, inputs), dummy(), combo, { critMode: 'never' })

describe('7.3a hand-modelled champions', () => {
  it('replace the generated entries in the 7.3a dataset and keep the generated base stats', () => {
    for (const hand of HAND_MODELED_CHAMPIONS_7_3A) {
      expect(() => ChampionSchema.parse(hand), hand.id).not.toThrow()
      expect(champion(hand.id).abilities, hand.id).toEqual(hand.abilities)
      const generated = GENERATED_CHAMPIONS.find((entry) => entry.id === hand.id)!
      expect(hand.baseStats, hand.id).toEqual(generated.baseStats)
      expect(hand.attackSpeed, hand.id).toEqual(generated.attackSpeed)
    }
    expect(dataset.handModelled.champions.map((entry) => entry.id))
      .toEqual(['ambessa', 'darius', 'lee-sin', 'hwei', 'caitlyn', 'senna'])
  })

  it("prefix every kit effect and input id with the champion's id", () => {
    for (const hand of HAND_MODELED_CHAMPIONS_7_3A) {
      const effects = championKitEffects(hand)
      expect(new Set(effects.map((effect) => effect.id)).size, hand.id).toBe(effects.length)
      for (const effect of effects) {
        expect(effect.id.startsWith(`${hand.id}-`), effect.id).toBe(true)
        for (const input of effect.inputs ?? []) expect(input.id.startsWith(`${hand.id}-`), input.id).toBe(true)
      }
    }
  })
})

describe('Darius', () => {
  const ad = () => attacker('darius').sheet.total.ad!
  // E's passive: 36% armor pen at rank 4, so 100 armor counts as 64.
  const physical = (raw: number) => raw * 100 / 164

  it('gets 36% armor pen from E and bleeds 18 over 5 seconds per stack', () => {
    const result = run('darius', ['AA', 'wait:5'])
    expect(result.instances[0].mitigated).toBeCloseTo(physical(ad()), 6)
    const bleed = result.instances.filter((instance) => instance.source.id === 'darius-passive-hemorrhage')
    expect(bleed).toHaveLength(5)
    expect(bleed.reduce((sum, instance) => sum + instance.mitigated, 0)).toBeCloseTo(physical(18), 6)
  })

  it('caps Hemorrhage at 5 stacks, all on one timer', () => {
    const result = run('darius', ['AA', 'AA', 'AA', 'AA', 'AA', 'AA', 'wait:1'])
    const lastTick = result.instances.filter((instance) => instance.source.id === 'darius-passive-hemorrhage').at(-1)!
    // Noxian Might (5th hit) adds 236 bonus AD at level 15, which the bleed reads: 5 × (3.6 + 8% × 236) per tick.
    expect(lastTick.raw).toBeCloseTo(5 * (3.6 + 0.08 * 236), 6)
  })

  it('adds 60% AD to the attack after W, as one hit', () => {
    const result = run('darius', ['W', 'AA'])
    expect(result.instances[0].raw).toBeCloseTo(ad() * 1.6, 6)
    expect(result.instances[0].parts?.map((part) => part.source.id)).toEqual(['AA', 'darius-w-crippling-strike'])
  })

  it('R deals 20% more per Hemorrhage stack, with Noxian Might adding to its bonus AD ratio', () => {
    const result = run('darius', ['AA', 'AA', 'AA', 'AA', 'AA', 'R'])
    const r = result.instances.find((instance) => instance.source.id === 'darius-r')!
    expect(r.type).toBe('true')
    expect(r.raw).toBeCloseTo((375 + 0.75 * 236) * 2, 6)
  })

  it('Noxian Might gives 236 AD at level 15 (read in game) and 32 at level 1 (the text)', () => {
    const might = championKitEffects(champion('darius')).find((effect) => effect.id === 'darius-passive-noxian-might')!
    expect(might).toMatchObject({ amountPerStack: { byLevel: expect.any(Array) } })
    const byLevel = (might as { amountPerStack: { byLevel: number[] } }).amountPerStack.byLevel
    expect([byLevel[0], byLevel[14]]).toEqual([32, 236])
  })

  it('R on a fresh target deals its base damage (375 true at rank 3, read in game)', () => {
    expect(run('darius', ['R']).instances[0].raw).toBeCloseTo(375, 6)
  })
})

describe('Lee Sin', () => {
  it('R deals 575 (+190% bonus AD +18% bonus Health) at rank 3', () => {
    expect(run('lee-sin', ['R']).instances[0].mitigated).toBeCloseTo(575 / 2, 6)
  })

  it('Q, then the Resonating Strike recast, which rises with missing Health (180 to 360)', () => {
    const result = run('lee-sin', ['Q', 'Q'])
    expect(result.instances.map((instance) => instance.source.id)).toEqual(['lee-sin-q', 'lee-sin-q-resonating-strike'])
    const missing = 180 / 2 / 10000
    expect(result.instances[0].raw).toBe(180)
    expect(result.instances[1].raw).toBeCloseTo(180 * (1 + missing), 6)
  })

  it('W empowers the next two attacks with 65 magic damage each', () => {
    const result = run('lee-sin', ['W', 'AA', 'AA', 'AA'])
    const ironWill = result.instances.filter((instance) => instance.source.id === 'lee-sin-w-iron-will')
    expect(ironWill.map((instance) => [instance.type, instance.raw])).toEqual([['magic', 65], ['magic', 65]])
  })

  it('E scales with total AD', () => {
    expect(run('lee-sin', ['E']).instances[0].raw).toBeCloseTo(140 + 0.9 * attacker('lee-sin').sheet.total.ad!, 6)
  })

  it('Flurry speeds up the two attacks after an ability', () => {
    const plain = run('lee-sin', ['AA', 'AA', 'AA']).instances.map((instance) => instance.time)
    const flurry = run('lee-sin', ['E', 'AA', 'AA', 'AA']).instances
      .filter((instance) => instance.source.id === 'AA').map((instance) => instance.time)
    expect(flurry[1] - flurry[0]).toBeLessThan(plain[1] - plain[0])
  })
})

describe('Hwei', () => {
  const sources = (combo: ComboAction[], target = dummy()) =>
    simulateCombo(attacker('hwei'), target, combo, { critMode: 'never', ignoreCooldowns: true }).instances.map((i) => [i.source.id, i.raw])

  it('casts each of the nine spells by its two keys', () => {
    expect(sources(['Q:q'])).toEqual([['hwei-q-devastating-fire', 155 + 0.07 * 10000]])
    expect(sources(['Q:w'])).toEqual([['hwei-q-severing-bolt', 170]])
    expect(sources(['Q:e', 'wait:2.5'])).toEqual([
      ['hwei-q-molten-fissure', 65], ...Array.from({ length: 5 }, () => ['hwei-q-molten-fissure-lava', 40]),
    ])
    for (const [action, id] of [['E:q', 'hwei-e-grim-visage'], ['E:w', 'hwei-e-gaze-of-the-abyss'], ['E:e', 'hwei-e-crushing-maw']] as const) {
      expect(sources([action]), action).toEqual([[id, 220]])
    }
    for (const action of ['W:q', 'W:w', 'W:e'] as const) expect(sources([action]), action).toEqual([])
  })

  it('a plain key casts the usual damage spell: Devastating Fire, Stirring Lights, Grim Visage', () => {
    expect(sources(['Q'])[0][0]).toBe('hwei-q-devastating-fire')
    expect(sources(['W', 'AA']).map(([id]) => id)).toContain('hwei-w-stirring-lights-empower')
    expect(sources(['E'])[0][0]).toBe('hwei-e-grim-visage')
  })

  it('Severing Bolt rises with missing Health, up to 170 + 680 at none left', () => {
    const half = { ...dummy(), startHpFraction: 0.5 }
    expect(sources(['Q:w'], half)).toEqual([['hwei-q-severing-bolt', 170 + 680 * 0.5]])
  })

  it('only Stirring Lights empowers attacks, three of them', () => {
    const empowered = (cast: ComboAction) => sources([cast, 'AA', 'AA', 'AA', 'AA'])
      .filter(([id]) => id === 'hwei-w-stirring-lights-empower').length
    expect([empowered('W:e'), empowered('W:q'), empowered('W:w')]).toEqual([3, 0, 0])
  })

  it('the second ability hit sets off his passive', () => {
    expect(sources(['Q:q', 'E:w']).map(([id]) => id)).toEqual(['hwei-q-devastating-fire', 'hwei-e-gaze-of-the-abyss', 'hwei-passive-signature'])
  })

  it('R shatters for 400 and burns 30 a second for 3 seconds', () => {
    expect(sources(['R', 'wait:3'])).toEqual([
      ['hwei-r', 400],
      ['hwei-r-spiraling-despair', 30], ['hwei-r-spiraling-despair', 30], ['hwei-r-spiraling-despair', 30],
    ])
  })
})

describe('Caitlyn', () => {
  const ad = () => attacker('caitlyn').sheet.total.ad!

  it('is ranged', () => {
    expect(champion('caitlyn').attackType).toBe('ranged')
  })

  it('fires a Headshot on the 7th attack, or the first when it starts ready', () => {
    const sevenAttacks: ComboAction[] = ['AA', 'AA', 'AA', 'AA', 'AA', 'AA', 'AA']
    const hits = (inputs: Build['inputs']) => run('caitlyn', sevenAttacks, inputs).instances.map((instance) => instance.raw)
    const headshot = ad() * 1.6
    expect(hits({}).map((raw) => raw > ad())).toEqual([false, false, false, false, false, false, true])
    expect(hits({})[6]).toBeCloseTo(headshot, 6)
    expect(hits({ 'caitlyn-headshot-ready': true })[0]).toBeCloseTo(headshot, 6)
  })

  it('a trapped target takes a Headshot plus the trap bonus', () => {
    const [attack] = run('caitlyn', ['W', 'AA']).instances
    expect(attack.raw).toBeCloseTo(ad() * 1.6 + 190, 6)
    expect(attack.parts?.map((part) => part.source.id)).toEqual(['AA', 'caitlyn-passive-trap-net-headshot', 'caitlyn-w-trap-headshot'])
  })

  it('R takes 20% of missing Health after a 1 s channel', () => {
    const result = simulateCombo(attacker('caitlyn'), { ...dummy(), startHpFraction: 0.5 }, ['R'], { critMode: 'never' })
    expect(result.instances[0].time).toBe(1)
    expect(result.instances[0].raw).toBeCloseTo(650 + 0.2 * 5000, 6)
  })
})

describe('Senna', () => {
  it('turns Mist stacks into AD and crit', () => {
    const sheet = attacker('senna', { 'senna-mist-stacks': 40 }).sheet
    const base = attacker('senna').sheet
    expect(sheet.total.ad! - base.total.ad!).toBeCloseTo(50, 6)
    expect(sheet.total.critChance).toBeCloseTo(0.2, 6)
  })

  it('attacks deal 10 bonus physical damage', () => {
    const result = run('senna', ['AA'])
    expect(result.totalsBySource['senna-passive-relic-cannon']).toBeCloseTo(5, 6)
  })

  it('R scales with bonus AD and AP', () => {
    expect(run('senna', ['R'], { 'senna-mist-stacks': 40 }).instances[0].raw).toBeCloseTo(550 + 1.2 * 50, 6)
  })
})
