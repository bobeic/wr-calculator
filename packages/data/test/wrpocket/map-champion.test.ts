import { describe, it, expect } from 'vitest'
import { ChampionSchema } from '@wr-calc/schema'
import type { Provenance } from '@wr-calc/schema'
import { fitAttackSpeed, fitGrowth, mapChampion } from '../../scripts/wrpocket/map-champion'
import type { RawAbility, RawChampion } from '../../scripts/wrpocket/raw-schemas'

const PROVENANCE: Provenance = { source: 'wiki', patch: '7.3', verifiedInGame: false }

const LEVEL1: Record<string, number> = {
  体力: 600, 体力自動回復: 8, マナ: 300, マナ自動回復: 10, 物理防御: 30, 魔法防御: 30,
  攻撃力: 60, 移動速度: 340, 攻撃速度: 0.8,
}
const PER_LEVEL: Record<string, number> = {
  体力: 100, 体力自動回復: 0.5, マナ: 40, マナ自動回復: 1, 物理防御: 5, 魔法防御: 1.5,
  攻撃力: 4, 移動速度: 0, 攻撃速度: 0.01,
}

function linearStats(level1 = LEVEL1, perLevel = PER_LEVEL): RawChampion['stats'] {
  const stats: RawChampion['stats'] = {}
  for (let level = 1; level <= 15; level++) {
    const row: Record<string, number> = {}
    for (const key of Object.keys(level1)) row[key] = level1[key] + perLevel[key] * (level - 1)
    stats[`レベル${level}`] = row
  }
  return stats
}

function ability(en: string, scaling: Array<[string, string]> = []): RawAbility {
  return {
    name: { en: 'Ability' }, description: { en },
    scaling: scaling.map(([type, value]) => ({ type, value })),
  }
}

function rawChampion(overrides: Partial<RawChampion> = {}): RawChampion {
  return {
    id: 'test-champ', name: { en: 'Test Champ' }, stats: linearStats(),
    abilities: {
      パッシブ: ability('Passive text with no damage.'),
      スキル1: ability('Hurls a fireball, dealing 80 / 130 / 180 / 230 (+85% AP) magic damage.', [
        ['cd', '4/4/4/4'], ['MP', '50/55/60/65'], ['基础伤害', '80/125/170/215'],
      ]),
      スキル2: ability('Fires a shock blast that deals 10 (+160% AD) physical damage.', [
        ['cd', '8/7/6/5'], ['MP', '50/60/70/80'], ['基础伤害', '10/80/150/220'],
      ]),
      スキル3: ability('Chompers explode, dealing magic damage to enemies.', [
        ['cd', '14'], ['MP', '70'], ['基础伤害', '70/140/210/280'],
      ]),
      アルティメット: ability('The rocket deals 25 (+12% bonus AD)–250 (+120% bonus AD) physical damage.', [
        ['cd', '60/50/40'], ['MP', '100/100/100'], ['最低伤害', '25/35/45'], ['最大基础伤害', '250/350/450'],
      ]),
    },
    ...overrides,
  }
}

describe('fitGrowth / fitAttackSpeed', () => {
  it('fits base and perLevel from levels 1 and 15', () => {
    expect(fitGrowth(600, 2000)).toEqual({ base: 600, perLevel: 100 })
  })

  it('fits the attack speed ratio from levels 1 and 15', () => {
    expect(fitAttackSpeed(0.8, 0.94)).toEqual({ base: 0.8, ratio: 0.0125 })
  })
})

describe('mapChampion: stats', () => {
  it('maps every base stat and attack speed', () => {
    const { value } = mapChampion(rawChampion(), PROVENANCE)
    expect(value.baseStats).toEqual({
      hp: { base: 600, perLevel: 100 }, hpRegen: { base: 8, perLevel: 0.5 },
      mana: { base: 300, perLevel: 40 }, manaRegen: { base: 10, perLevel: 1 },
      armor: { base: 30, perLevel: 5 }, mr: { base: 30, perLevel: 1.5 },
      ad: { base: 60, perLevel: 4 }, moveSpeed: { base: 340, perLevel: 0 },
    })
    expect(value.attackSpeed).toEqual({ base: 0.8, ratio: 0.0125 })
    expect(value.resource).toBe('mana')
  })

  it('omits mana stats and uses resource "other" for a manaless champion', () => {
    const { value } = mapChampion(rawChampion({
      stats: linearStats({ ...LEVEL1, マナ: 0, マナ自動回復: 0 }, { ...PER_LEVEL, マナ: 0, マナ自動回復: 0 }),
    }), PROVENANCE)
    expect(value.baseStats.mana).toBeUndefined()
    expect(value.baseStats.manaRegen).toBeUndefined()
    expect(value.resource).toBe('other')
  })

  it('notes a stat whose levels are not a straight line', () => {
    const stats = linearStats()
    stats['レベル8'] = { ...stats['レベル8'], 体力: stats['レベル8'].体力 + 50 }
    const { notes } = mapChampion(rawChampion({ stats }), PROVENANCE)
    expect(notes).toContain('hp: level 8 is 1350, 50 off a straight line from level 1 to 15')
  })

  it('normalizes the id and uses the English name', () => {
    const { value } = mapChampion(rawChampion({ id: 'nunu-and-willump', name: { en: 'Nunu & Willump' } }), PROVENANCE)
    expect(value.id).toBe('nunu-willump')
    expect(value.name).toBe('Nunu & Willump')
    expect(value.abilities.q.id).toBe('nunu-willump-q')
  })

  it('throws on a missing level row or ability slot', () => {
    const stats = linearStats()
    delete stats['レベル15']
    expect(() => mapChampion(rawChampion({ stats }), PROVENANCE)).toThrow(/test-champ: missing 体力 at level 15/)
    const abilities = { ...rawChampion().abilities }
    delete abilities['スキル2']
    expect(() => mapChampion(rawChampion({ abilities }), PROVENANCE)).toThrow(/test-champ: missing ability slot スキル2/)
  })
})

describe('mapChampion: abilities', () => {
  const { value, notes } = mapChampion(rawChampion(), PROVENANCE)

  it('uses the full-rank English text over a conflicting table, with a note', () => {
    expect(value.abilities.q).toEqual({
      id: 'test-champ-q', name: 'Ability', maxRank: 4,
      cooldown: { byRank: [4, 4, 4, 4] }, cost: { byRank: [50, 55, 60, 65] }, castTime: 0,
      damage: [{ type: 'magic', base: { byRank: [80, 130, 180, 230] }, ratios: [{ stat: 'ap', value: 0.85 }], tags: [] }],
      flags: {},
    })
    expect(notes).toContain('q: text damage 80/130/180/230 conflicts with table 80/125/170/215; used text')
  })

  it('fills per-rank base damage from the table when the text shows rank 1 only', () => {
    expect(value.abilities.w.damage).toEqual([
      { type: 'physical', base: { byRank: [10, 80, 150, 220] }, ratios: [{ stat: 'totalAd', value: 1.6 }], tags: [] },
    ])
    expect(notes.filter((note) => note.startsWith('w:'))).toEqual([])
  })

  it('falls back to table damage with no ratios when the text has no damage phrase', () => {
    expect(value.abilities.e.damage).toEqual([
      { type: 'magic', base: { byRank: [70, 140, 210, 280] }, ratios: [], tags: [] },
    ])
    expect(value.abilities.e.maxRank).toBe(4)
    expect(value.abilities.e.cooldown).toBe(14)
    expect(notes).toContain('e: base damage from the table; no ratio found in the text')
  })

  it('uses the max-damage table for a range phrase, with a note', () => {
    expect(value.abilities.r.maxRank).toBe(3)
    expect(value.abilities.r.damage).toEqual([
      { type: 'physical', base: { byRank: [250, 350, 450] }, ratios: [{ stat: 'bonusAd', value: 1.2 }], tags: [] },
    ])
    expect(notes).toContain('r: damage is a range; modeled the upper bound')
  })

  it('maps the passive with rank 1, no cost, no damage and a null cooldown', () => {
    expect(value.abilities.passive).toEqual({
      id: 'test-champ-passive', name: 'Ability', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    })
  })

  it('produces a schema-valid champion', () => {
    expect(() => ChampionSchema.parse(value)).not.toThrow()
    expect(value.provenance).toEqual(PROVENANCE)
  })

  it('notes table damage it could not model when the text names several damage types', () => {
    const raw = rawChampion()
    raw.abilities['スキル3'] = ability('Deals magic damage and physical damage.', [['基础伤害', '10/20/30/40']])
    const result = mapChampion(raw, PROVENANCE)
    expect(result.value.abilities.e.damage).toEqual([])
    expect(result.notes).toContain('e: table has base damage but the text names 2 damage types; damage not modeled')
  })

  it('notes unparsed ratio parts', () => {
    const raw = rawChampion()
    raw.abilities['スキル2'] = ability('Attacks deal 12 (+10% Armor) bonus magic damage.', [['cd', '7']])
    expect(mapChampion(raw, PROVENANCE).notes).toContain("w: unparsed ratio '10% Armor'")
  })

  it('notes a formula-shaped base value on the passive', () => {
    const raw = rawChampion()
    raw.abilities['パッシブ'] = ability(
      "Illumination empowers Lux's next attack against that target, dealing 18 + Level x 7.5 (+25% AP) magic damage.",
    )
    expect(mapChampion(raw, PROVENANCE).notes).toContain(
      "passive: damage looks like a formula ('18 + Level x 7.5'); base may be wrong",
    )
  })

  it('notes per-hit/per-second ticking text on an ability', () => {
    const raw = rawChampion()
    raw.abilities['スキル2'] = ability(
      'Fires 5 arrows in a cone, dealing 70 (+100% bonus AD) physical damage per arrow.', [['cd', '7']],
    )
    expect(mapChampion(raw, PROVENANCE).notes).toContain(
      "w: damage is per second/hit ('per arrow'); modeled as one hit",
    )
  })

  it('notes a byRank field whose length differs from maxRank', () => {
    const raw = rawChampion()
    // cd has one value, so w keeps the default maxRank of 4; the base table has 5 ranks.
    raw.abilities['スキル2'] = ability('Deals 160 (+55% AP) magic damage.', [
      ['cd', '10'], ['基础伤害', '160/230/300/370/440'],
    ])
    // cd has 3 values (maxRank 3), but MP has 4.
    raw.abilities['アルティメット'] = ability('Deals 70 (+65% bonus AD) physical damage.', [
      ['cd', '80/70/60'], ['MP', '80/80/80/80'], ['基础伤害', '60/110/160'],
    ])
    const { notes } = mapChampion(raw, PROVENANCE)
    expect(notes).toContain('w: base has 5 ranks but maxRank is 4')
    expect(notes).toContain('r: cost has 4 ranks but maxRank is 3')
  })

  it('notes a byRank base and ratio on a maxRank-1 passive', () => {
    const raw = rawChampion()
    raw.abilities['パッシブ'] = ability(
      'Attacks fire rounds, dealing 20/24/28/32/36 (+102%/104%/106%/108%/110% AD) physical damage to the first enemy hit.',
    )
    const { notes } = mapChampion(raw, PROVENANCE)
    expect(notes).toContain('passive: base has 5 ranks but maxRank is 1')
    expect(notes).toContain('passive: ratios.totalAd has 5 ranks but maxRank is 1')
  })
})
