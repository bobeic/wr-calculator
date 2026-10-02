import { describe, it, expect } from 'vitest'
import { ItemSchema } from '@wr-calc/schema'
import type { Provenance } from '@wr-calc/schema'
import { mapItem, mapItemStats, passiveNames } from '../../scripts/wrpocket/map-item'
import type { RawItem } from '../../scripts/wrpocket/raw-schemas'

const PROVENANCE: Provenance = { source: 'wiki', patch: '7.3', verifiedInGame: false }

function rawItem(overrides: Partial<RawItem>): RawItem {
  return {
    id: 'test-item', name: { en: 'Test Item' }, description: { en: 'Text.' }, price: '1000',
    numeric_stats: {}, category: { en: 'Physical' }, tier: 'upgraded', components: [],
    ...overrides,
  }
}

describe('mapItemStats', () => {
  it('maps keys and turns percentages into fractions', () => {
    expect(mapItemStats({
      attackDamage: 40, attackSpeed: 30, lifeSteal: 12, criticalRate: 25, moveSpeedPercent: 4,
      abilityPower: 95, magicPenPercent: 40, armorPen: 12, health: 333, magicResist: 60,
    })).toEqual({
      value: {
        ad: 40, attackSpeed: 0.3, lifesteal: 0.12, critChance: 0.25, moveSpeedPct: 0.04,
        ap: 95, pctMagicPen: 0.4, flatArmorPen: 12, hp: 333, mr: 60,
      },
      notes: [],
    })
  })

  it('skips % base regen stats and unknown keys with a note each', () => {
    const result = mapItemStats({ health: 700, healthRegen: 150, manaRegen: 50, fooStat: 3 })
    expect(result.value).toEqual({ hp: 700 })
    expect(result.notes).toEqual([
      "stat 'healthRegen' (150) skipped: it is a % of base regen, but hpRegen/manaRegen here are flat",
      "stat 'manaRegen' (50) skipped: it is a % of base regen, but hpRegen/manaRegen here are flat",
      "unknown stat 'fooStat' (3) skipped",
    ])
  })
})

describe('mapItem', () => {
  const prices = new Map([['long-sword', 500], ['b.-f.-sword', 1500]])

  it('maps id, name, tier, recipe, cost and tags', () => {
    const { value, notes } = mapItem(rawItem({
      id: 'b.-f.-sword', name: { en: 'B. F. Sword' }, price: '1500', tier: 'intermediate',
      numeric_stats: { attackDamage: 40 }, components: ['long-sword', 'long-sword'],
    }), prices, PROVENANCE)
    expect(value).toEqual({
      id: 'bf-sword', name: 'B. F. Sword', tier: 'epic',
      cost: { total: 1500, combine: 500 }, recipe: ['long-sword', 'long-sword'],
      stats: { ad: 40 }, effects: [], tags: ['physical'], provenance: PROVENANCE,
    })
    expect(notes).toEqual([])
    expect(() => ItemSchema.parse(value)).not.toThrow()
  })

  it.each<[string, string, string]>([
    ['Boots', 'intermediate', 'boots'],
    ['Support', 'upgraded', 'support'],
    ['Magic', 'basic', 'basic'],
    ['Magic', 'intermediate', 'epic'],
    ['Defense', 'upgraded', 'legendary'],
  ])('category %s + tier %s → %s', (category, tier, expected) => {
    expect(mapItem(rawItem({ category: { en: category }, tier }), prices, PROVENANCE).value.tier).toBe(expected)
  })

  it('notes an unknown site tier and treats it as legendary', () => {
    const { value, notes } = mapItem(rawItem({ tier: 'mythic' }), prices, PROVENANCE)
    expect(value.tier).toBe('legendary')
    expect(notes).toEqual(["unknown tier 'mythic', treated as legendary"])
  })

  it('clamps a negative combine cost to 0 with a note', () => {
    const { value, notes } = mapItem(rawItem({ price: '400', components: ['long-sword'] }), prices, PROVENANCE)
    expect(value.cost).toEqual({ total: 400, combine: 0 })
    expect(notes).toEqual(['components cost 500, more than the item (400); combine set to 0'])
  })

  it('uses the total as combine when a component price is unknown', () => {
    const { value, notes } = mapItem(rawItem({ price: '900', components: ['mystery'] }), prices, PROVENANCE)
    expect(value.cost).toEqual({ total: 900, combine: 900 })
    expect(notes).toEqual(["unknown component 'mystery'; combine set to total"])
  })

  it('throws on a non-numeric price', () => {
    expect(() => mapItem(rawItem({ price: 'free' }), prices, PROVENANCE)).toThrow(/test-item: price 'free'/)
  })
})

describe('passiveNames', () => {
  it('reads named passives and actives at the start of each line, once each', () => {
    expect(passiveNames(
      'Spellblade: After casting an ability, your next attack deals bonus damage.\n'
      + 'Against monsters, deals 40 more.\nThirsting Slash (Active): Deal damage.\nUNIQUE - Strike: +10 Armor penetration.\n'
      + 'Spellblade: repeated.',
    )).toEqual(['Spellblade', 'Thirsting Slash', 'Strike'])
  })

  it('reads bold names from older snapshots', () => {
    expect(passiveNames('**Awe**: Refunds mana.\n**Quicksilver** (Active): Cleanse.')).toEqual(['Awe', 'Quicksilver'])
  })

  it('reads a name after a short lead-in', () => {
    expect(passiveNames('Consumes Mana to heal Eternity: Restore Mana.')).toEqual(['Eternity'])
  })

  it('returns nothing for a stat-only description', () => {
    expect(passiveNames('+40 Attack Damage')).toEqual([])
  })

  it('puts the names on the mapped item', () => {
    const mapped = mapItem(rawItem({ description: { en: "Sterak's Fury: Gain a shield." } }), new Map(), PROVENANCE)
    expect(mapped.value.uniquePassives).toEqual(["Sterak's Fury"])
    expect(mapItem(rawItem({}), new Map(), PROVENANCE).value.uniquePassives).toBeUndefined()
  })
})
