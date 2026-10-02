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
      .toEqual([
        'ambessa', 'darius', 'lee-sin', 'hwei', 'caitlyn', 'senna', 'chogath', 'master-yi', 'yasuo', 'miss-fortune', 'nautilus',
        'garen', 'xin-zhao', 'brand', 'yunara', 'thresh', 'mordekaiser', 'viego', 'veigar', 'tristana', 'leona',
        'sett', 'graves', 'galio', 'samira', 'lux',
        'dr-mundo', 'tryndamere', 'mel', 'jinx', 'seraphine',
      ])
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

const bySource = (result: ReturnType<typeof run>, id: string) => result.instances.filter((instance) => instance.source.id === id)
const partFrom = (result: ReturnType<typeof run>, id: string) =>
  result.instances.flatMap((instance) => instance.parts ?? []).filter((part) => part.source.id === id)

describe("Cho'Gath", () => {
  it('Feast stacks add Health and grow the spikes: 10 stacks at rank 3 / rank 4', () => {
    const base = attacker('chogath').sheet.total.hp!
    expect(attacker('chogath', { 'chogath-feast-stacks': 10 }).sheet.total.hp! - base).toBeCloseTo(1600, 6)
    const result = run('chogath', ['E', 'AA', 'AA', 'AA', 'AA'], { 'chogath-feast-stacks': 10 })
    const spikes = bySource(result, 'chogath-e-vorpal-spikes')
    expect(spikes).toHaveLength(3)
    expect(spikes[0].raw).toBeCloseTo(95 + 10000 * (0.035 + 0.006 * 10), 6)
  })

  it('R deals 600 true plus 10% of bonus Health', () => {
    const r = run('chogath', ['R'], { 'chogath-feast-stacks': 10 }).instances[0]
    expect([r.type, r.raw]).toEqual(['true', 600 + 0.1 * 1600])
  })
})

describe('Master Yi', () => {
  const ad = () => attacker('master-yi').sheet.total.ad!

  it('Wuju Style adds 5 AD and then 8%', () => {
    const generated = GENERATED_CHAMPIONS.find((entry) => entry.id === 'master-yi')!
    const plain = generated.baseStats.ad!.base + generated.baseStats.ad!.perLevel * 14
    expect(ad()).toBeCloseTo((plain + 5) * 1.08, 6)
  })

  it('every 4th attack strikes again for 50% AD', () => {
    const result = run('master-yi', ['AA', 'AA', 'AA', 'AA'])
    expect(partFrom(result, 'master-yi-passive-double-strike').map((part) => part.amount)).toEqual([0.5 * ad()])
    expect(result.instances[3].raw).toBeCloseTo(1.5 * ad(), 6)
  })

  it('Alpha Strike on one target: the strike plus three 25% returns', () => {
    expect(run('master-yi', ['Q']).instances.reduce((sum, i) => sum + i.raw, 0)).toBeCloseTo(1.75 * (140 + 0.6 * ad()), 6)
  })

  it('E adds 45 (+25% bonus AD) true damage to every attack for 5 seconds', () => {
    const bonusAd = attacker('master-yi').sheet.bonus.ad!
    const result = run('master-yi', ['E', 'AA', 'AA', 'AA', 'wait:5', 'AA'])
    const procs = bySource(result, 'master-yi-e-wuju-style')
    expect(procs.map((instance) => instance.type)).toEqual(['true', 'true', 'true'])
    for (const proc of procs) expect(proc.raw).toBeCloseTo(45 + 0.25 * bonusAd, 6)
  })

  it('R speeds up attacks', () => {
    const gap = (combo: ComboAction[]) => {
      const times = run('master-yi', combo).instances.filter((instance) => instance.source.id === 'AA').map((instance) => instance.time)
      return times[1] - times[0]
    }
    expect(gap(['R', 'AA', 'AA'])).toBeLessThan(gap(['AA', 'AA']))
  })
})

describe('Yasuo', () => {
  it('doubles crit chance from items', () => {
    const critItem = [...dataset.catalog.items.values()].find((item) => item.tier === 'legendary' && (item.stats.critChance ?? 0) > 0)!
    const sheet = combatantFromChampion(champion('yasuo'), 15, { items: [critItem.id], runes: [], inputs: {} }, dataset.catalog).sheet
    expect(sheet.total.critChance).toBeCloseTo(2 * critItem.stats.critChance!, 6)
  })

  it('Q, E and R deal their text damage', () => {
    const ad = attacker('yasuo').sheet.total.ad!
    expect(run('yasuo', ['Q']).instances[0].raw).toBeCloseTo(110 + 1.05 * ad, 6)
    expect(run('yasuo', ['E']).instances[0].raw).toBe(100)
    expect(run('yasuo', ['R']).instances[0].raw).toBe(500)
  })
})

describe('Miss Fortune', () => {
  it('is ranged; Love Tap adds 9 to every third attack', () => {
    expect(champion('miss-fortune').attackType).toBe('ranged')
    const result = run('miss-fortune', ['AA', 'AA', 'AA'])
    expect(partFrom(result, 'miss-fortune-passive-love-tap').map((part) => part.amount)).toEqual([9])
  })

  it('E rains 8 waves of 30 over 2 seconds; R fires 16 waves at rank 3', () => {
    expect(bySource(run('miss-fortune', ['E', 'wait:2']), 'miss-fortune-e-make-it-rain').map((i) => i.raw)).toEqual(Array(8).fill(30))
    const ad = attacker('miss-fortune').sheet.total.ad!
    const waves = bySource(run('miss-fortune', ['R', 'wait:4']), 'miss-fortune-r-bullet-time')
    expect(waves).toHaveLength(16)
    expect(waves[0].raw).toBeCloseTo(40 + 0.6 * ad, 6)
  })
})

describe('Nautilus', () => {
  it('Staggering Blow adds 13 once per 6 seconds', () => {
    const result = run('nautilus', ['AA', 'AA', 'AA'])
    const procs = [...bySource(result, 'nautilus-passive-staggering-blow'), ...partFrom(result, 'nautilus-passive-staggering-blow')]
    expect(procs.map((proc) => ('raw' in proc ? proc.raw : proc.amount))).toEqual([13])
  })

  it("Titan's Wrath empowers every attack while it lasts", () => {
    const result = run('nautilus', ['W', 'AA', 'AA', 'AA'])
    expect(bySource(result, 'nautilus-w-titans-wrath').map((i) => [i.type, i.raw])).toEqual(Array(3).fill(['magic', 80]))
  })
})

describe('Garen', () => {
  const ad = () => attacker('garen').sheet.total.ad!

  it('Q deals its text damage', () => {
    expect(run('garen', ['Q']).instances[0].raw).toBeCloseTo(160 + 0.4 * ad(), 6)
  })

  it('Judgment ticks 8 times for 25 (+40% AD) physical damage', () => {
    const ticks = bySource(run('garen', ['E', 'wait:3']), 'garen-e-judgment')
    expect(ticks).toHaveLength(8)
    for (const tick of ticks) expect(tick.raw).toBeCloseTo(25 + 0.4 * ad(), 6)
  })

  it('R deals 350 true plus 15% of missing Health', () => {
    const result = simulateCombo(attacker('garen'), { ...dummy(), startHpFraction: 0.5 }, ['R'], { critMode: 'never' })
    expect([result.instances[0].type, result.instances[0].raw]).toEqual(['true', 350 + 0.15 * 5000])
  })
})

describe('Xin Zhao', () => {
  const ad = () => attacker('xin-zhao').sheet.total.ad!
  const bonusAd = () => attacker('xin-zhao').sheet.bonus.ad ?? 0

  it('Determination adds 22% AD to every third attack', () => {
    const result = run('xin-zhao', ['AA', 'AA', 'AA'])
    expect(partFrom(result, 'xin-zhao-passive-determination').map((part) => part.amount)).toEqual([0.22 * ad()])
  })

  it('Three Talon Strike empowers the next 3 attacks', () => {
    const procs = partFrom(run('xin-zhao', ['Q', 'AA', 'AA', 'AA', 'AA']), 'xin-zhao-q-three-talon-strike')
    expect(procs).toHaveLength(3)
    for (const proc of procs) expect(proc.amount).toBeCloseTo(44 + 0.4 * bonusAd(), 6)
  })

  it('Wind Becomes Lightning hits twice', () => {
    const [hit1, hit2] = run('xin-zhao', ['W']).instances
    expect(hit1.raw).toBeCloseTo(70 + 0.5 * ad(), 6)
    expect(hit2.raw).toBeCloseTo(175 + 0.75 * ad(), 6)
  })

  it('Audacious Charge speeds up attacks', () => {
    const gap = (combo: ComboAction[]) => {
      const times = run('xin-zhao', combo).instances.filter((i) => i.source.id === 'AA').map((i) => i.time)
      return times[1] - times[0]
    }
    expect(gap(['E', 'AA', 'AA'])).toBeLessThan(gap(['AA', 'AA']))
  })

  it('Crescent Guard deals bonus AD, AP and 15% of max Health', () => {
    const result = run('xin-zhao', ['R'])
    expect(result.instances[0].raw).toBeCloseTo(225 + 1 * bonusAd() + 0.15 * 10000, 6)
  })
})

describe('Brand', () => {
  it('Sear, Pillar of Flame and Conflagration deal their text damage', () => {
    expect(run('brand', ['Q']).instances[0].raw).toBe(200)
    expect(run('brand', ['W']).instances[0].raw).toBe(220)
    expect(run('brand', ['E']).instances[0].raw).toBe(150)
  })

  it('abilities set the target Ablaze for 3% of max Health over 4 seconds', () => {
    const ablaze = bySource(run('brand', ['Q', 'wait:4']), 'brand-passive-ablaze')
    expect(ablaze).toHaveLength(1)
    expect(ablaze[0].raw).toBeCloseTo(0.03 * 10000, 6)
  })
})

describe('Yunara', () => {
  it('Spirit Charge adds 10 (+20% AP) to every attack', () => {
    const result = run('yunara', ['AA'])
    expect(bySource(result, 'yunara-q-spirit-charge').map((instance) => instance.raw)).toEqual([25])
  })

  it('Arc of Judgment deals its text damage and lingers for 4 ticks', () => {
    const bonusAd = attacker('yunara').sheet.bonus.ad ?? 0
    const result = run('yunara', ['W', 'wait:1'])
    expect(result.instances[0].raw).toBeCloseTo(210 + 0.85 * bonusAd, 6)
    const lingering = bySource(result, 'yunara-w-lingering-bead')
    expect(lingering).toHaveLength(4)
    for (const tick of lingering) expect(tick.raw).toBeCloseTo(8 + 0.12 * bonusAd, 6)
  })
})

describe('Thresh', () => {
  it('Death Sentence and The Box deal their text damage', () => {
    expect(run('thresh', ['Q']).instances[0].raw).toBe(280)
    expect(run('thresh', ['R']).instances[0].raw).toBe(550)
  })

  it('Souls grant 2 Armor and 2 Ability Power each', () => {
    const base = attacker('thresh').sheet.total
    const withSouls = attacker('thresh', { 'thresh-souls': 10 }).sheet.total
    expect(withSouls.armor! - (base.armor ?? 0)).toBeCloseTo(20, 6)
    expect(withSouls.ap! - (base.ap ?? 0)).toBeCloseTo(20, 6)
  })

  it("Flay's passive adds its AD ratio on-hit", () => {
    const ad = attacker('thresh').sheet.total.ad!
    const result = run('thresh', ['AA'])
    expect(bySource(result, 'thresh-e-flay-passive').map((instance) => instance.raw)).toEqual([2 * ad])
  })
})

describe('Mordekaiser', () => {
  it('attacks deal 30% bonus AD as magic damage', () => {
    const ad = attacker('mordekaiser').sheet.total.ad!
    expect(bySource(run('mordekaiser', ['AA']), 'mordekaiser-passive-bonus-magic').map((i) => i.raw)).toEqual([0.3 * ad])
  })

  it('Obliterate deals its text damage (no AP or bonus AD with no items, so just the base)', () => {
    expect(run('mordekaiser', ['Q']).instances[0].raw).toBe(272)
  })

  it('3 ability hits within 5 seconds cloak him in a field for 5 ticks of 100', () => {
    const ticks = bySource(run('mordekaiser', ['Q', 'AA', 'Q', 'AA', 'Q', 'wait:5']), 'mordekaiser-passive-negative-energy')
    expect(ticks).toHaveLength(5)
    for (const tick of ticks) expect(tick.raw).toBeCloseTo(100, 6)
  })
})

describe('Viego', () => {
  it('the on-hit current-Health bonus and Double Strike proc once each after an ability hit', () => {
    const result = run('viego', ['Q', 'AA'])
    expect(bySource(result, 'viego-passive-current-hp')).toHaveLength(1)
    expect(partFrom(result, 'viego-passive-double-strike')).toHaveLength(1)
  })

  it('Heartbreaker deals 120% AD plus missing Health', () => {
    const ad = attacker('viego').sheet.total.ad!
    const result = simulateCombo(attacker('viego'), { ...dummy(), startHpFraction: 0.5 }, ['R'], { critMode: 'never' })
    expect(result.instances[0].raw).toBeCloseTo(1.2 * ad + 0.2 * 5000, 6)
  })
})

describe('Veigar', () => {
  it('Phenomenal Evil Power stacks grant 1 AP each', () => {
    const base = attacker('veigar').sheet.total.ap ?? 0
    const withStacks = attacker('veigar', { 'veigar-phenomenal-evil-stacks': 10 }).sheet.total.ap ?? 0
    expect(withStacks - base).toBeCloseTo(10, 6)
  })

  it('Q, W and R deal their text damage', () => {
    expect(run('veigar', ['Q']).instances[0].raw).toBe(245)
    expect(run('veigar', ['W']).instances[0].raw).toBe(280)
    expect(run('veigar', ['R']).instances[0].raw).toBe(315)
  })
})

describe('Tristana', () => {
  it('Rapid Fire speeds up attacks', () => {
    const gap = (combo: ComboAction[]) => {
      const times = run('tristana', combo).instances.filter((i) => i.source.id === 'AA').map((i) => i.time)
      return times[1] - times[0]
    }
    expect(gap(['Q', 'AA', 'AA'])).toBeLessThan(gap(['AA', 'AA']))
  })

  it('Rocket Jump, Explosive Charge and Buster Shot deal their text damage', () => {
    expect(run('tristana', ['W']).instances[0].raw).toBe(200)
    expect(run('tristana', ['E']).instances[0].raw).toBe(170)
    expect(run('tristana', ['R']).instances[0].raw).toBe(400)
  })
})

describe('Leona', () => {
  it('Shield of Daybreak empowers the next attack', () => {
    const procs = bySource(run('leona', ['Q', 'AA']), 'leona-q-shield-of-daybreak')
    expect(procs).toHaveLength(1)
    expect(procs[0].raw).toBe(120)
  })

  it('Eclipse, Zenith Blade and Solar Flare deal their text damage', () => {
    expect(run('leona', ['W']).instances[0].raw).toBe(185)
    expect(run('leona', ['E']).instances[0].raw).toBe(225)
    expect(run('leona', ['R']).instances[0].raw).toBe(300)
  })
})

describe('Sett', () => {
  it('every second attack is a right punch with 9 bonus damage (no bonus AD without items)', () => {
    expect(partFrom(run('sett', ['AA', 'AA', 'AA', 'AA']), 'sett-passive-right-punch').map((part) => part.amount)).toEqual([9, 9])
  })

  it('Knuckle Down empowers two attacks with base + (1% + 0.025% per AD) max Health', () => {
    const ad = attacker('sett').sheet.total.ad!
    const bonus = partFrom(run('sett', ['Q', 'AA', 'AA', 'AA']), 'sett-q-knuckle-down')
    expect(bonus).toHaveLength(2)
    for (const part of bonus) expect(part.amount).toBeCloseTo(50 + (0.01 + 0.00025 * ad) * 10000, 6)
  })

  it('Haymaker deals its base as true damage', () => {
    expect(run('sett', ['W']).instances[0]).toMatchObject({ raw: 155, type: 'true' })
  })
})

describe('Graves', () => {
  it('attacks deal an extra 44% AD (all four bullets)', () => {
    const ad = attacker('graves').sheet.total.ad!
    expect(bySource(run('graves', ['AA']), 'graves-passive-buckshot').map((i) => i.raw)[0]).toBeCloseTo(0.44 * ad, 6)
  })

  it('End of the Line hits twice (no bonus AD without items)', () => {
    expect(run('graves', ['Q']).instances.map((i) => i.raw)).toEqual([130, 230])
  })
})

describe('Galio', () => {
  it('Colossal Smash procs on the first attack, then waits 5 seconds', () => {
    expect(bySource(run('galio', ['AA', 'AA', 'AA']), 'galio-passive-colossal-smash')).toHaveLength(1)
  })

  it("Winds of War's tornado deals 8% max Health (no AP without items)", () => {
    expect(run('galio', ['Q']).instances.map((i) => i.raw)).toEqual([205, 800])
  })
})

describe('Samira', () => {
  it('Inferno Trigger fires 10 shots of 60 (+50% AD)', () => {
    const ad = attacker('samira').sheet.total.ad!
    expect(run('samira', ['R']).instances[0].raw).toBeCloseTo(10 * (60 + 0.5 * ad), 6)
  })

  it('Wild Rush speeds up attacks', () => {
    const gap = (combo: ComboAction[]) => {
      const times = run('samira', combo).instances.filter((i) => i.source.id === 'AA').map((i) => i.time)
      return times[1] - times[0]
    }
    expect(gap(['E', 'AA', 'AA'])).toBeLessThan(gap(['AA', 'AA']))
  })
})

describe('Lux', () => {
  it('Illumination detonates on every second ability hit', () => {
    expect(bySource(run('lux', ['Q', 'E', 'R']), 'lux-passive-illumination').map((i) => i.raw)).toEqual([25.5])
  })
})

describe('Dr. Mundo', () => {
  it("Infected Bonesaw deals 29% of the target's current Health", () => {
    expect(run('dr-mundo', ['Q']).instances[0].raw).toBeCloseTo(0.29 * 10000, 6)
  })

  it('Blunt Force Trauma empowers one attack with 50 (+5% bonus Health; none without items)', () => {
    expect(partFrom(run('dr-mundo', ['E', 'AA', 'AA']), 'dr-mundo-e-blunt-force-trauma').map((part) => part.amount)).toEqual([50])
  })
})

describe('Tryndamere', () => {
  it('each point of Fury grants 0.32% crit', () => {
    const base = attacker('tryndamere').sheet.total.critChance ?? 0
    const full = attacker('tryndamere', { 'tryndamere-fury': 100 }).sheet.total.critChance ?? 0
    expect(full - base).toBeCloseTo(0.32, 6)
  })
})

describe('Mel', () => {
  it('Projectile Burst fires on the attack after an ability, once', () => {
    expect(bySource(run('mel', ['Q', 'AA', 'AA']), 'mel-passive-projectile-burst').map((i) => i.raw)).toEqual([99])
  })

  it('Radiant Volley deals every explosion (no AP without items)', () => {
    expect(run('mel', ['Q']).instances[0].raw).toBe(200)
  })
})

describe('Jinx', () => {
  it('Pow-Pow attacks speed up the following attacks', () => {
    const times = run('jinx', ['AA', 'AA', 'AA', 'AA']).instances.filter((i) => i.source.id === 'AA').map((i) => i.time)
    expect(times[3] - times[2]).toBeLessThan(times[1] - times[0])
  })

  it('Super Mega Death Rocket adds 35% missing Health', () => {
    const ad = attacker('jinx').sheet.total
    const result = simulateCombo(attacker('jinx'), { ...dummy(), startHpFraction: 0.5 }, ['R'], { critMode: 'never' })
    expect(result.instances[0].raw).toBeCloseTo(450 + 1.2 * ((ad.ad ?? 0) - (attacker('jinx').sheet.base.ad ?? 0)) + 0.35 * 5000, 6)
  })
})

describe('Seraphine', () => {
  it('each cast gives the next attack a Note of 4 bonus magic damage', () => {
    expect(bySource(run('seraphine', ['Q', 'AA', 'AA']), 'seraphine-passive-harmony').map((i) => i.raw)).toEqual([4])
  })
})
