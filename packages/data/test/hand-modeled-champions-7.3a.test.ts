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
        'nasus', 'khazix', 'akali', 'draven', 'blitzcrank',
        'aatrox', 'nocturne', 'yone', 'jhin', 'malphite',
        'volibear', 'jarvan-iv', 'morgana', 'kaisa', 'yuumi',
        'ksante', 'kayn', 'ahri', 'ashe', 'lulu',
        'teemo', 'pantheon', 'ziggs', 'ezreal', 'pyke',
        'urgot', 'vi', 'ekko', 'kalista', 'zyra',
        'renekton', 'shyvana', 'syndra', 'twitch', 'swain',
        'kayle', 'kindred', 'aurelion-sol', 'vayne', 'braum',
        'fiora', 'wukong', 'twisted-fate', 'smolder', 'soraka',
        'gnar', 'rammus', 'zed', 'varus', 'alistar',
        'jax', 'nidalee', 'aurora', 'lucian', 'maokai',
        'gwen', 'rengar', 'viktor', 'xayah', 'karma',
        'jayce', 'warwick', 'orianna', 'sivir', 'nami',
        'riven', 'lillia', 'velkoz', 'kogmaw', 'rell',
        'rumble', 'skarner', 'ryze', 'zeri', 'rakan',
        'camille', 'evelynn', 'fizz', 'sona',
        'kennen', 'olaf', 'lissandra', 'milio',
        'irelia', 'talon', 'vladimir', 'janna',
        'sion', 'amumu', 'vex', 'ornn',
        'shen', 'fiddlesticks', 'heimerdinger', 'zilean',
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

describe('Nasus', () => {
  it('Siphoning Strike adds 1 damage per stack', () => {
    const bonus = (stacks: number) => partFrom(run('nasus', ['Q', 'AA'], { 'nasus-siphoning-strike-stacks': stacks }), 'nasus-q-siphoning-strike')[0].amount
    expect(bonus(0)).toBe(110)
    expect(bonus(300)).toBe(410)
  })

  it('Fury of the Sands deals 5% max Health now and every second for 11 more', () => {
    const result = run('nasus', ['R', 'wait:12'])
    expect(result.instances[0].raw).toBeCloseTo(500, 6)
    const ticks = bySource(result, 'nasus-r-storm')
    expect(ticks).toHaveLength(11)
    for (const tick of ticks) expect(tick.raw).toBeCloseTo(500, 6)
  })
})

describe("Kha'Zix", () => {
  it('Taste Their Fear deals the isolated (+110%) damage; Unseen Threat procs once', () => {
    expect(run('khazix', ['Q']).instances[0].raw).toBeCloseTo(180 * 2.1, 6)
    expect(bySource(run('khazix', ['AA', 'AA']), 'khazix-passive-unseen-threat')).toHaveLength(1)
  })
})

describe('Akali', () => {
  it("Assassin's Mark empowers the attack after an ability", () => {
    expect(bySource(run('akali', ['Q', 'AA', 'AA']), 'akali-passive-assassins-mark')).toHaveLength(1)
  })

  it("Perfect Execution's second dash grows with missing Health", () => {
    const at = (fraction: number) => simulateCombo(attacker('akali'), { ...dummy(), startHpFraction: fraction }, ['R'], { critMode: 'never' })
      .instances.filter((i) => i.source.id === 'akali-r').reduce((sum, i) => sum + i.raw, 0)
    expect(at(0.5) - at(1)).toBeCloseTo(0.5 * 420, 6)
  })
})

describe('Draven', () => {
  it('Spinning Axe empowers one attack per cast', () => {
    expect(partFrom(run('draven', ['Q', 'AA', 'AA']), 'draven-q-spinning-axe')).toHaveLength(1)
  })
})

describe('Blitzcrank', () => {
  it('Power Fist adds 140% AD to one attack', () => {
    const ad = attacker('blitzcrank').sheet.total.ad!
    expect(partFrom(run('blitzcrank', ['E', 'AA', 'AA']), 'blitzcrank-e-power-fist').map((part) => part.amount)).toEqual([1.4 * ad])
  })
})

describe('Aatrox', () => {
  it('Deathbringer Stance adds 4% max Health to one attack per 24 seconds', () => {
    expect(bySource(run('aatrox', ['AA', 'AA']), 'aatrox-passive-deathbringer-stance').map((i) => i.raw)).toEqual([400])
  })

  it('The Darkin Blade deals its three casts at 1x, 1.25x and 1.5x', () => {
    const ad = attacker('aatrox').sheet.total.ad!
    expect(run('aatrox', ['Q']).instances.map((i) => i.raw).reduce((a, b) => a + b, 0)).toBeCloseTo(3.75 * (100 + 0.9 * ad), 6)
  })

  it('World Ender multiplies AD by 1.5 at rank 3 when toggled on', () => {
    const off = attacker('aatrox').sheet.total.ad!
    expect(attacker('aatrox', { 'aatrox-world-ender-active': true }).sheet.total.ad!).toBeCloseTo(1.5 * off, 6)
  })
})

describe('Nocturne', () => {
  it('Umbra Blades adds 20% AD to every 4th attack', () => {
    const ad = attacker('nocturne').sheet.total.ad!
    expect(partFrom(run('nocturne', ['AA', 'AA', 'AA', 'AA']), 'nocturne-passive-umbra-blades').map((p) => p.amount)).toEqual([0.2 * ad])
  })
})

describe('Yone', () => {
  it('Spirit Cleave deals half physical, half magic', () => {
    const types = run('yone', ['W']).instances.map((i) => `${i.type} ${i.raw}`)
    expect(types).toEqual(['physical 632.5', 'magic 632.5'])
  })
})

describe('Jhin', () => {
  it('every 4th shot adds 60% AD', () => {
    const ad = attacker('jhin').sheet.total.ad!
    expect(partFrom(run('jhin', ['AA', 'AA', 'AA', 'AA']), 'jhin-passive-fourth-shot').map((p) => p.amount)).toEqual([0.6 * ad])
  })
})

describe('Malphite', () => {
  it('Ground Slam scales with Armor (40% more at rank 4 of Thunderclap); Thunderclap empowers attacks', () => {
    const armor = attacker('malphite').sheet.total.armor!
    const malphite = champion('malphite')
    const withoutW = combatantFromChampion(
      { ...malphite, abilities: { ...malphite.abilities, w: { ...malphite.abilities.w, effects: [] } } },
      15, { items: [], runes: [], inputs: {} }, dataset.catalog,
    ).sheet.total.armor!
    expect(armor).toBeCloseTo(1.4 * withoutW, 6)
    expect(run('malphite', ['E']).instances[0].raw).toBeCloseTo(210 + 0.4 * armor, 6)
    expect(partFrom(run('malphite', ['W', 'AA', 'AA']), 'malphite-w-first-attack')).toHaveLength(1)
    expect(partFrom(run('malphite', ['W', 'AA', 'AA']), 'malphite-w-cone')).toHaveLength(2)
  })
})

describe('Volibear', () => {
  it('Sky Splitter adds 11% max Health; Thundering Smash empowers one attack', () => {
    expect(run('volibear', ['E']).instances[0].raw).toBeCloseTo(170 + 0.11 * 10000, 6)
    expect(partFrom(run('volibear', ['Q', 'AA', 'AA']), 'volibear-q-thundering-smash')).toHaveLength(1)
  })
})

describe('Jarvan IV', () => {
  it('Martial Cadence adds 8% current Health to the first attack, then waits 5 seconds', () => {
    const procs = bySource(run('jarvan-iv', ['AA', 'AA']), 'jarvan-iv-passive-martial-cadence')
    expect(procs).toHaveLength(1)
    const attack = run('jarvan-iv', ['AA']).instances.find((i) => i.source.id === 'AA')!
    expect(procs[0].raw).toBeCloseTo(0.08 * attack.targetHpAfter, 6)
  })
})

describe('Morgana', () => {
  it('Tormented Shadow ticks 10 times over 5 seconds; Soul Shackles hits twice', () => {
    const result = run('morgana', ['W', 'wait:5'])
    expect(result.instances.filter((i) => i.source.id === 'morgana-w')).toHaveLength(1)
    expect(bySource(result, 'morgana-w-tormented-shadow')).toHaveLength(9)
    expect(run('morgana', ['R']).instances[0].raw).toBe(600)
  })
})

describe("Kai'Sa", () => {
  it('Plasma detonates on the 5th attack for 15% missing Health', () => {
    const result = run('kaisa', ['AA', 'AA', 'AA', 'AA', 'AA'])
    const procs = bySource(result, 'kaisa-passive-plasma')
    expect(procs).toHaveLength(1)
    const before = result.instances[result.instances.indexOf(procs[0]) - 1]
    expect(procs[0].raw).toBeCloseTo(0.15 * (10000 - before.targetHpAfter), 6)
  })

  it('Icathian Rain lands all 6 missiles (no bonus AD or AP without items)', () => {
    expect(run('kaisa', ['Q']).instances.map((i) => i.raw)).toEqual([100, 125])
  })
})

describe('Yuumi', () => {
  it('Prowling Projectile has 5 ranks; Final Chapter lands 7 waves', () => {
    expect(run('yuumi', ['Q']).instances[0].raw).toBe(220)
    expect(run('yuumi', ['R']).instances.map((i) => i.raw)).toEqual([120, 240])
  })
})

describe("K'Sante", () => {
  it('Dauntless Instinct adds 12 + 2% max Health at level 15 to the attack after an ability', () => {
    expect(partFrom(run('ksante', ['Q', 'AA', 'AA']), 'ksante-passive-dauntless-instinct').map((p) => p.amount)).toEqual([212])
  })

  it('Ntofo Strikes scales with bonus resists (none without items)', () => {
    expect(run('ksante', ['Q']).instances[0].raw).toBe(200)
  })
})

describe('Kayn', () => {
  it('Reaping Slash hits twice', () => {
    expect(run('kayn', ['Q']).instances[0].raw).toBe(320)
  })
})

describe('Ahri', () => {
  it('Orb of Deception deals magic out and true back', () => {
    expect(run('ahri', ['Q']).instances.map((i) => `${i.type} ${i.raw}`)).toEqual(['magic 145', 'true 145'])
  })
})

describe('Ashe', () => {
  it("Ranger's Focus adds 30% AD to every attack for 6 seconds", () => {
    const ad = attacker('ashe').sheet.total.ad!
    const flurry = partFrom(run('ashe', ['Q', 'AA', 'AA', 'AA']), 'ashe-q-flurry')
    expect(flurry).toHaveLength(3)
    for (const part of flurry) expect(part.amount).toBeCloseTo(0.3 * ad, 6)
  })
})

describe('Lulu', () => {
  it('Pix adds 12 magic damage to every attack', () => {
    expect(bySource(run('lulu', ['AA', 'AA']), 'lulu-passive-pix').map((i) => i.raw)).toEqual([12, 12])
  })
})

describe('Teemo', () => {
  it('Toxic Shot poisons for 4 ticks after an attack', () => {
    const result = run('teemo', ['AA', 'wait:4'])
    expect(bySource(result, 'teemo-passive-poison').map((i) => i.raw)).toEqual([8, 8, 8, 8])
  })
})

describe('Pantheon', () => {
  it('Grand Starfall: Comet Spear at rank 4 plus the landing', () => {
    expect(run('pantheon', ['R']).instances.map((i) => i.raw)).toEqual([200, 700])
  })
})

describe('Ziggs', () => {
  it('Bouncing Bomb includes Short Fuse', () => {
    expect(run('ziggs', ['Q']).instances.map((i) => i.raw)).toEqual([265, 20])
  })
})

describe('Ezreal', () => {
  it('ability hits stack Rising Spell Force attack speed', () => {
    const gap = (combo: ComboAction[]) => {
      const times = run('ezreal', combo).instances.filter((i) => i.source.id === 'AA').map((i) => i.time)
      return times[1] - times[0]
    }
    expect(gap(['Q', 'E', 'AA', 'AA'])).toBeLessThan(gap(['AA', 'AA']))
  })
})

describe('Pyke', () => {
  it('turns bonus Health into AD (14 to 1) and keeps none of it', () => {
    const build = (items: string[]) => combatantFromChampion(champion('pyke'), 15, { items, runes: [], inputs: {} }, dataset.catalog).sheet
    const bare = build([])
    const withBelt = build(['giants-belt'])
    expect(withBelt.total.hp).toBeCloseTo(bare.total.hp!, 6)
    expect(withBelt.total.ad! - bare.total.ad!).toBeCloseTo(dataset.catalog.items.get('giants-belt')!.stats.hp! / 14, 6)
  })
})

describe('Urgot', () => {
  it('Purge fires 12 shots over 4 seconds', () => {
    const result = run('urgot', ['W', 'wait:4'])
    expect(result.instances.filter((i) => i.source.id === 'urgot-w').length + bySource(result, 'urgot-w-purge').length).toBe(12)
  })

  it('Echoing Flames adds 105% AD + 3% max Health at level 15, once per 15 seconds', () => {
    const ad = attacker('urgot').sheet.total.ad!
    const procs = bySource(run('urgot', ['AA', 'AA']), 'urgot-passive-echoing-flames').map((i) => i.raw)
    expect(procs).toHaveLength(1)
    expect(procs[0]).toBeCloseTo(1.05 * ad + 0.03 * 10000, 6)
  })
})

describe('Vi', () => {
  it('Denting Blows lands on the 3rd attack for 4.8% max Health', () => {
    expect(bySource(run('vi', ['AA', 'AA', 'AA']), 'vi-passive-denting-blows').map((i) => i.raw)).toEqual([480])
  })
})

describe('Ekko', () => {
  it('Z-Drive Resonance procs on the third hit', () => {
    expect(bySource(run('ekko', ['Q', 'AA', 'AA']), 'ekko-passive-z-drive').map((i) => i.raw)).toEqual([30])
  })

  it('Parallel Convergence adds 3% missing Health only below 30% Health', () => {
    const at = (fraction: number) => bySource(
      simulateCombo(attacker('ekko'), { ...dummy(), startHpFraction: fraction }, ['AA'], { critMode: 'never' }), 'ekko-w-passive',
    )
    expect(at(1)).toHaveLength(0)
    expect(at(0.2)).toHaveLength(1)
  })
})

describe('Kalista', () => {
  it('Rend adds 42 (+57% AD) per extra spear', () => {
    const ad = attacker('kalista').sheet.total.ad!
    const rend = (spears: number) => run('kalista', ['E'], { 'kalista-rend-spears': spears }).instances[0].raw
    expect(rend(4) - rend(0)).toBeCloseTo(4 * (42 + 0.57 * ad), 6)
  })
})

describe('Zyra', () => {
  it('each damaging ability sprouts its own Thorn Spitter', () => {
    expect(bySource(run('zyra', ['Q', 'E', 'wait:6']), 'zyra-thorn-spitter')).toHaveLength(12)
  })
})

describe('Renekton', () => {
  it('Dominus burns for 12 seconds in all', () => {
    const result = run('renekton', ['R', 'wait:12'])
    expect(result.instances.filter((i) => i.source.id === 'renekton-r')).toHaveLength(1)
    expect(bySource(result, 'renekton-r-dominus')).toHaveLength(11)
  })
})

describe('Shyvana', () => {
  it('Scorch adds 3% max Health to every attack for 5 seconds after Flame Breath', () => {
    const scorch = [...bySource(run('shyvana', ['E', 'AA', 'AA']), 'shyvana-e-scorch'), ...partFrom(run('shyvana', ['E', 'AA', 'AA']), 'shyvana-e-scorch')]
    expect(scorch).toHaveLength(2)
  })
})

describe('Syndra', () => {
  it('Unleashed Power launches 3 spheres', () => {
    expect(run('syndra', ['R']).instances[0].raw).toBe(480)
  })
})

describe('Twitch', () => {
  it('Deadly Venom stacks up to 5 and Contaminate assumes max stacks', () => {
    expect(run('twitch', ['E']).instances[0].raw).toBe(235)
    const ticks = bySource(run('twitch', ['AA', 'AA', 'AA', 'AA', 'AA', 'AA', 'AA', 'wait:1']), 'twitch-passive-deadly-venom')
    expect(Math.max(...ticks.map((i) => i.raw))).toBeCloseTo(5, 6)
  })
})

describe('Swain', () => {
  it("Death's Hand lands all 5 bolts", () => {
    expect(run('swain', ['Q']).instances.map((i) => i.raw)).toEqual([160, 160])
  })
})

describe('Kayle', () => {
  it('Starfire Spellblade adds 17 magic on every attack at rank 4', () => {
    expect(bySource(run('kayle', ['AA', 'AA']), 'kayle-e-passive').map((i) => i.raw)).toEqual([17, 17])
  })
})

describe('Kindred', () => {
  it("Mark stacks raise Wolf's Frenzy's current-Health damage by 1% each", () => {
    const w = (marks: number) => run('kindred', ['W'], { 'kindred-mark-stacks': marks }).instances[0].raw
    expect(w(4) - w(0)).toBeCloseTo(0.04 * 10000, 6)
  })
})

describe('Aurelion Sol', () => {
  it('Breath of Light burns for 3 seconds in all', () => {
    const result = run('aurelion-sol', ['Q', 'wait:3'])
    expect(result.instances.filter((i) => i.source.id === 'aurelion-sol-q').map((i) => i.raw)).toEqual([103, 100])
    expect(bySource(result, 'aurelion-sol-q-breath').map((i) => i.raw)).toEqual([203, 203])
  })
})

describe('Vayne', () => {
  it('Silver Bolts deals 9% max Health true damage on every third hit', () => {
    const procs = bySource(run('vayne', ['AA', 'AA', 'AA', 'AA', 'AA', 'AA']), 'vayne-w-silver-bolts')
    expect(procs.map((i) => `${i.type} ${i.raw}`)).toEqual(['true 900', 'true 900'])
  })
})

describe('Braum', () => {
  it("Concussive Blows stuns on the 4th stack; Winter's Bite scales with his max Health", () => {
    expect(bySource(run('braum', ['AA', 'AA', 'AA', 'AA']), 'braum-passive-concussive-blows').map((i) => i.raw)).toEqual([45])
    expect(run('braum', ['Q']).instances[0].raw).toBeCloseTo(240 + 0.03 * attacker('braum').sheet.total.hp!, 6)
  })
})

describe('Fiora', () => {
  it('a Vital deals 4% max Health true damage at most every 2 seconds', () => {
    const vitals = bySource(run('fiora', ['AA', 'AA']), 'fiora-passive-vital')
    expect(vitals.map((i) => `${i.type} ${i.raw}`)).toEqual(['true 400'])
  })

  it('Bladework adds 50% AD to each of the next two attacks at rank 4', () => {
    const ad = attacker('fiora').sheet.total.ad!
    expect(partFrom(run('fiora', ['E', 'AA', 'AA', 'AA']), 'fiora-e-bladework').map((p) => p.amount)).toEqual([0.5 * ad, 0.5 * ad])
  })
})

describe('Wukong', () => {
  it('Cyclone spins twice for 220% AD + 18% max Health', () => {
    const ad = attacker('wukong').sheet.total.ad!
    expect(run('wukong', ['R']).instances[0].raw).toBeCloseTo(2 * (2.2 * ad + 1800), 6)
  })
})

describe('Twisted Fate', () => {
  it('Stacked Deck adds 140 magic to every 4th attack at rank 4', () => {
    expect(bySource(run('twisted-fate', ['AA', 'AA', 'AA', 'AA']), 'twisted-fate-e-fourth-attack').map((i) => i.raw)).toEqual([140])
  })
})

describe('Smolder', () => {
  it("Super Scorcher Breath's Passive damage is 30% of his Dragon Practice stacks", () => {
    const magicPart = (stacks: number) => run('smolder', ['Q'], { 'smolder-dragon-practice-stacks': stacks })
      .instances.filter((i) => i.type === 'magic').reduce((sum, i) => sum + i.raw, 0)
    expect(magicPart(200)).toBeCloseTo(60, 6)
  })
})

describe('Soraka', () => {
  it('Equinox hits twice', () => {
    expect(run('soraka', ['E']).instances[0].raw).toBe(440)
  })
})

describe('Gnar', () => {
  it('Hyper procs on the 3rd hit for 40 + 13% max Health at rank 4', () => {
    expect(bySource(run('gnar', ['AA', 'AA', 'AA']), 'gnar-w-hyper').map((i) => i.raw)).toEqual([40 + 1300])
  })
})

describe('Rammus', () => {
  it('Spiked Shell adds 18 (+10% Armor) to every attack', () => {
    const armor = attacker('rammus').sheet.total.armor!
    for (const proc of bySource(run('rammus', ['AA', 'AA']), 'rammus-w-spiked-shell')) expect(proc.raw).toBeCloseTo(18 + 0.1 * armor, 6)
  })
})

describe('Zed', () => {
  it('Contempt for the Weak only procs below 50% Health', () => {
    const procs = (fraction: number) => bySource(
      simulateCombo(attacker('zed'), { ...dummy(), startHpFraction: fraction }, ['AA'], { critMode: 'never' }), 'zed-passive-contempt',
    ).map((i) => i.raw)
    expect(procs(1)).toEqual([])
    expect(procs(0.4)).toHaveLength(1)
    expect(procs(0.4)[0]).toBeCloseTo(700, 6)
  })
})

describe('Varus', () => {
  it('ability hits detonate 3 Blight stacks for 13.5% max Health at rank 4', () => {
    expect(bySource(run('varus', ['E']), 'varus-w-blight').map((i) => i.raw)).toEqual([1350])
  })
})

describe('Alistar', () => {
  it('Trample ticks 10 times over 5 seconds', () => {
    const result = run('alistar', ['E', 'wait:5'])
    expect(result.instances.filter((i) => i.source.id === 'alistar-e')).toHaveLength(1)
    expect(bySource(result, 'alistar-e-trample')).toHaveLength(9)
  })
})

describe('Jax', () => {
  it("Grandmaster's Might adds 185 magic to every 3rd attack at rank 3", () => {
    expect(bySource(run('jax', ['AA', 'AA', 'AA']), 'jax-r-passive').map((i) => i.raw)).toEqual([185])
  })
})

describe('Nidalee', () => {
  it('Javelin Toss at max range; Bushwhack burns for 4 seconds', () => {
    expect(run('nidalee', ['Q']).instances[0].raw).toBe(450)
    expect(bySource(run('nidalee', ['W', 'wait:4']), 'nidalee-w-bushwhack')).toHaveLength(3)
  })
})

describe('Aurora', () => {
  it('Spirit Abjuration exorcises on the 3rd hit for 2.5% max Health (no AP)', () => {
    expect(bySource(run('aurora', ['AA', 'AA', 'AA']), 'aurora-passive-exorcise').map((i) => i.raw)).toEqual([250])
  })
})

describe('Lucian', () => {
  it('Lightslinger adds a 40% AD second shot after an ability', () => {
    const ad = attacker('lucian').sheet.total.ad!
    expect(partFrom(run('lucian', ['Q', 'AA', 'AA']), 'lucian-passive-lightslinger').map((p) => p.amount)).toEqual([0.4 * ad])
  })
})

describe('Maokai', () => {
  it('Bramble Smash adds 4% max Health at rank 4', () => {
    expect(run('maokai', ['Q']).instances[0].raw).toBe(225 + 400)
  })
})

describe('Gwen', () => {
  it('Thousand Cuts adds 1% max Health to every attack; Needlework fires 9 needles', () => {
    expect(bySource(run('gwen', ['AA', 'AA']), 'gwen-passive-thousand-cuts').map((i) => i.raw)).toEqual([100, 100])
    expect(run('gwen', ['R']).instances[0].raw).toBe(9 * 65)
  })
})

describe('Rengar', () => {
  it('Savagery empowers one attack with 160 (+20% AD) at rank 4', () => {
    const ad = attacker('rengar').sheet.total.ad!
    expect(partFrom(run('rengar', ['Q', 'AA', 'AA']), 'rengar-q-savagery').map((p) => p.amount)).toEqual([160 + 0.2 * ad])
  })
})

describe('Viktor', () => {
  it('Arcane Storm hits once and then 5 more times', () => {
    const result = run('viktor', ['R', 'wait:5'])
    expect(result.instances.filter((i) => i.source.id === 'viktor-r').map((i) => i.raw)).toEqual([250])
    expect(bySource(result, 'viktor-r-storm').map((i) => i.raw)).toEqual([130, 130, 130, 130, 130])
  })
})

describe('Xayah', () => {
  it('Deadly Plumage adds 25% AD to attacks for 4 seconds', () => {
    const ad = attacker('xayah').sheet.total.ad!
    const parts = partFrom(run('xayah', ['W', 'AA', 'AA']), 'xayah-w-damage')
    expect(parts).toHaveLength(2)
    for (const part of parts) expect(part.amount).toBeCloseTo(0.25 * ad, 6)
  })
})

describe('Karma', () => {
  it('Focused Resolve deals the tether and the root', () => {
    expect(run('karma', ['W']).instances.map((i) => i.raw)).toEqual([110, 130])
  })
})

describe('Jayce', () => {
  it('Thundering Blow deals 20% max Health at rank 5; Lightning Field ticks 4 times', () => {
    const bonusAd = attacker('jayce').sheet.bonus.ad ?? 0
    expect(run('jayce', ['E']).instances[0].raw).toBeCloseTo(2000 + bonusAd, 6)
    expect(bySource(run('jayce', ['W', 'wait:4']), 'jayce-w-lightning-field').map((i) => i.raw)).toEqual([110, 110, 110, 110])
  })
})

describe('Warwick', () => {
  it('Eternal Hunger adds 12 (+15% bonus AD) magic damage to attacks', () => {
    expect(bySource(run('warwick', ['AA']), 'warwick-passive-eternal-hunger').map((i) => i.raw)).toEqual([12])
  })
})

describe('Orianna', () => {
  it('Command: Shockwave deals 450 at rank 3', () => {
    expect(run('orianna', ['R']).instances.map((i) => i.raw)).toEqual([450])
  })
})

describe('Sivir', () => {
  it('Boomerang Blade hits twice', () => {
    const bonusAd = attacker('sivir').sheet.bonus.ad ?? 0
    expect(run('sivir', ['Q']).instances[0].raw).toBeCloseTo(2 * (160 + 0.7 * bonusAd), 6)
  })
})

describe('Nami', () => {
  it("Tidecaller's Blessing empowers 3 attacks", () => {
    expect(bySource(run('nami', ['E', 'AA', 'AA', 'AA', 'AA']), 'nami-e-blessing').map((i) => i.raw)).toEqual([85, 85, 85])
  })
})

describe('Riven', () => {
  it('Broken Wings charges Runic Blade 3 times; Blade of the Exile adds 25% AD when toggled on', () => {
    const ad = attacker('riven').sheet.total.ad!
    const parts = partFrom(run('riven', ['Q', 'AA', 'AA', 'AA', 'AA']), 'riven-q-runic-blade')
    expect(parts).toHaveLength(3)
    for (const part of parts) expect(part.amount).toBeCloseTo(0.22 * ad, 6)
    expect(attacker('riven', { 'riven-blade-of-the-exile-active': true }).sheet.total.ad!).toBeCloseTo(1.25 * ad, 6)
  })
})

describe('Lillia', () => {
  it('Dream Dust deals 6% max Health over 3 seconds', () => {
    expect(bySource(run('lillia', ['E', 'wait:3']), 'lillia-passive-dream-dust').map((i) => i.raw)).toEqual([200, 200, 200])
  })
})

describe("Vel'Koz", () => {
  it('Organic Deconstruction procs on the third ability hit', () => {
    expect(bySource(run('velkoz', ['Q', 'E']), 'velkoz-passive-deconstruction')).toHaveLength(0)
    expect(bySource(run('velkoz', ['Q', 'E', 'R']), 'velkoz-passive-deconstruction').map((i) => i.raw)).toEqual([140])
  })
})

describe("Kog'Maw", () => {
  it('Bio-Arcane Barrage adds 4.5% max Health to attacks', () => {
    expect(bySource(run('kogmaw', ['W', 'AA', 'AA']), 'kogmaw-w-barrage').map((i) => i.raw)).toEqual([450, 450])
  })
})

describe('Rell', () => {
  it('Full Tilt empowers one attack with 7% max Health', () => {
    const hits = bySource(run('rell', ['E', 'AA', 'AA']), 'rell-e-full-tilt')
    expect(hits).toHaveLength(1)
    expect(hits[0].raw).toBeCloseTo(700, 6)
  })
})

describe('Rumble', () => {
  it('Flamespitter adds 10% max Health; The Equalizer burns 5 times', () => {
    expect(run('rumble', ['Q']).instances[0].raw).toBeCloseTo(220 + 1000, 6)
    expect(bySource(run('rumble', ['R', 'wait:5']), 'rumble-r-equalizer').map((i) => i.raw)).toEqual([280, 280, 280, 280, 280])
  })
})

describe('Skarner', () => {
  it('Shattered Earth empowers 3 attacks and Quaking procs on the third hit', () => {
    const result = run('skarner', ['Q', 'AA', 'AA', 'AA', 'AA', 'wait:4'])
    expect(partFrom(result, 'skarner-q-shattered-earth')).toHaveLength(3)
    expect(bySource(result, 'skarner-passive-quaking')).toHaveLength(4)
    for (const tick of bySource(result, 'skarner-passive-quaking')) expect(tick.raw).toBeCloseTo(250, 6)
  })
})

describe('Ryze', () => {
  it('Overload deals 145 at rank 4', () => {
    expect(run('ryze', ['Q']).instances.map((i) => i.raw)).toEqual([145])
  })
})

describe('Zeri', () => {
  it('Spark Surge empowers 3 attacks', () => {
    expect(bySource(run('zeri', ['E', 'AA', 'AA', 'AA', 'AA']), 'zeri-e-spark-surge')).toHaveLength(3)
  })
})

describe('Rakan', () => {
  it('The Quickness deals 300 at rank 3', () => {
    expect(run('rakan', ['R']).instances.map((i) => i.raw)).toEqual([300])
  })
})

describe('Camille', () => {
  it('Precision Protocol empowers two attacks; The Hextech Ultimatum takes 25% current Health', () => {
    const ad = attacker('camille').sheet.total.ad!
    const parts = partFrom(run('camille', ['Q', 'AA', 'AA', 'AA']), 'camille-q-precision-protocol')
    expect(parts).toHaveLength(2)
    for (const part of parts) expect(part.amount).toBeCloseTo(0.6 * ad, 6)
    expect(run('camille', ['R']).instances[0].raw).toBeCloseTo(30 + 2500, 6)
  })
})

describe('Evelynn', () => {
  it('Hate Spike hits twice; Whiplash adds 2% max Health', () => {
    expect(run('evelynn', ['Q']).instances[0].raw).toBe(125)
    expect(run('evelynn', ['E']).instances[0].raw).toBeCloseTo(115 + 200, 6)
  })
})

describe('Fizz', () => {
  it('Seastone Trident burns for 3 seconds after an attack', () => {
    expect(bySource(run('fizz', ['AA', 'wait:3']), 'fizz-passive-seastone-trident').map((i) => i.raw)).toEqual([8, 8, 8])
  })
})

describe('Sona', () => {
  it('Hymn of Valor empowers her next attack', () => {
    expect(bySource(run('sona', ['Q', 'AA', 'AA']), 'sona-q-aura').map((i) => i.raw)).toEqual([23])
  })
})

describe('Kennen', () => {
  it('Electrical Surge procs on the 5th attack; Slicing Maelstrom bolts 6 times', () => {
    expect(bySource(run('kennen', ['AA', 'AA', 'AA', 'AA', 'AA']), 'kennen-w-electrical-surge')).toHaveLength(1)
    expect(bySource(run('kennen', ['R', 'wait:3']), 'kennen-r-maelstrom')).toHaveLength(6)
  })
})

describe('Olaf', () => {
  it('Reckless Swing deals true damage; Ragnarok adds 20% AD when toggled on', () => {
    const ad = attacker('olaf').sheet.total.ad!
    expect(run('olaf', ['E']).instances[0].raw).toBeCloseTo(195 + 0.55 * ad, 6)
    expect(attacker('olaf', { 'olaf-ragnarok-active': true }).sheet.total.ad!).toBeCloseTo(1.2 * ad, 6)
  })
})

describe('Lissandra', () => {
  it('Frozen Tomb deals 350 at rank 3', () => {
    expect(run('lissandra', ['R']).instances.map((i) => i.raw)).toEqual([350])
  })
})

describe('Milio', () => {
  it('Ultra Mega Fire Kick deals 320 at rank 4', () => {
    expect(run('milio', ['Q']).instances.map((i) => i.raw)).toEqual([320])
  })
})

describe('Irelia', () => {
  it('Ionian Fervor at max stacks adds attack speed and an on-hit', () => {
    const off = attacker('irelia')
    const on = attacker('irelia', { 'irelia-ionian-fervor-max': true })
    expect(on.sheet.total.attackSpeed!).toBeGreaterThan(off.sheet.total.attackSpeed!)
    expect(bySource(run('irelia', ['AA']), 'irelia-passive-on-hit')).toHaveLength(0)
    expect(bySource(run('irelia', ['AA'], { 'irelia-ionian-fervor-max': true }), 'irelia-passive-on-hit')).toHaveLength(1)
  })
})

describe('Talon', () => {
  it("Blade's End bleeds after three ability hits", () => {
    expect(bySource(run('talon', ['Q', 'W', 'R', 'wait:2']), 'talon-passive-bleed')).toHaveLength(4)
  })
})

describe('Vladimir', () => {
  it('Crimson Pact turns AP into Health; Sanguine Pool ticks 4 times', () => {
    expect(bySource(run('vladimir', ['W', 'wait:2']), 'vladimir-w-pool')).toHaveLength(4)
  })
})

describe('Janna', () => {
  it('Howling Gale deals 170 at rank 4', () => {
    expect(run('janna', ['Q']).instances.map((i) => i.raw)).toEqual([170])
  })
})

describe('Sion', () => {
  it('Soul Furnace detonates for 13% max Health at rank 4', () => {
    expect(run('sion', ['W']).instances[0].raw).toBeCloseTo(150 + 1300, 6)
  })
})

describe('Amumu', () => {
  it('Despair burns 40 + 2.1% max Health every second for 5 seconds', () => {
    const ticks = bySource(run('amumu', ['W', 'wait:5']), 'amumu-w-despair')
    expect(ticks).toHaveLength(5)
    for (const tick of ticks) expect(tick.raw).toBeCloseTo(40 + 210, 6)
  })
})

describe('Vex', () => {
  it('Shadow Surge deals the bolt and the dash', () => {
    expect(run('vex', ['R']).instances.map((i) => i.raw)).toEqual([175, 350])
  })
})

describe('Ornn', () => {
  it('Bellows Breath deals 13% max Health at rank 4', () => {
    expect(run('ornn', ['W']).instances[0].raw).toBeCloseTo(1300, 6)
  })
})

describe('Shen', () => {
  it('Twilight Assault empowers 3 attacks with 7% max Health', () => {
    const hits = bySource(run('shen', ['Q', 'AA', 'AA', 'AA', 'AA']), 'shen-q-twilight-assault')
    expect(hits).toHaveLength(3)
    for (const hit of hits) expect(hit.raw).toBeCloseTo(700, 6)
  })
})

describe('Fiddlesticks', () => {
  it('Crowstorm deals 600 in 20 ticks', () => {
    const ticks = bySource(run('fiddlesticks', ['R', 'wait:5']), 'fiddlesticks-r-crowstorm')
    expect(ticks).toHaveLength(20)
    expect(ticks.reduce((sum, tick) => sum + tick.raw, 0)).toBe(600)
  })
})

describe('Heimerdinger', () => {
  it('Hextech Micro-Rockets: the first rocket in full, 4 more at 20%', () => {
    expect(run('heimerdinger', ['W']).instances.map((i) => i.raw)).toEqual([135, 4 * 27])
  })
})

describe('Zilean', () => {
  it('Time Bomb deals 255 at rank 4', () => {
    expect(run('zilean', ['Q']).instances.map((i) => i.raw)).toEqual([255])
  })
})
