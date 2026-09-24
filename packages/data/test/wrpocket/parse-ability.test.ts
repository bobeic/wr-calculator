import { describe, it, expect } from 'vitest'
import {
  damageTypesIn, findTextDamage, parseRanks, parseRatios, round, toScalar,
} from '../../scripts/wrpocket/parse-ability'
import { normalizeId } from '../../scripts/wrpocket/ids'

describe('round', () => {
  it('removes float noise', () => {
    expect(round(0.1 + 0.2)).toBe(0.3)
    expect(round(35 / 100)).toBe(0.35)
  })
})

describe('parseRanks', () => {
  it.each<[string, number[] | null]>([
    ['8/7/6/5', [8, 7, 6, 5]],
    ['8 / 7 / 6 / 5', [8, 7, 6, 5]],
    ['30%/40%/50%', [30, 40, 50]],
    ['13.5/13/12.5/12', [13.5, 13, 12.5, 12]],
    ['14', [14]],
    ['abc', null],
    ['', null],
    ['1//2', null],
  ])('parses %j', (text, expected) => {
    expect(parseRanks(text)).toEqual(expected)
  })
})

describe('toScalar', () => {
  it('returns a plain number for one rank and byRank otherwise', () => {
    expect(toScalar([5])).toBe(5)
    expect(toScalar([1, 2])).toEqual({ byRank: [1, 2] })
  })
})

describe('parseRatios', () => {
  it('parses AP and bonus Health', () => {
    expect(parseRatios('+65% AP +5% bonus Health')).toEqual({
      ratios: [{ stat: 'ap', value: 0.65 }, { stat: 'bonusHp', value: 0.05 }], unparsed: [],
    })
  })

  it('parses per-rank ratios', () => {
    expect(parseRatios('+75% / 80% / 85% / 90% AD')).toEqual({
      ratios: [{ stat: 'totalAd', value: { byRank: [0.75, 0.8, 0.85, 0.9] } }], unparsed: [],
    })
  })

  it.each<[string, string, number]>([
    ['+160% AD', 'totalAd', 1.6],
    ['+40% bonus AD', 'bonusAd', 0.4],
    ['+2%AP', 'ap', 0.02],
    ['+9% max Health', 'maxHp', 0.09],
    ['+3% HP', 'maxHp', 0.03],
  ])('parses %s', (group, stat, value) => {
    expect(parseRatios(group)).toEqual({ ratios: [{ stat, value }], unparsed: [] })
  })

  it('reports parts it cannot map, keeping the ones it can', () => {
    expect(parseRatios('+ 45% AP + 2% bonus Mana')).toEqual({
      ratios: [{ stat: 'ap', value: 0.45 }], unparsed: ['2% bonus Mana'],
    })
    expect(parseRatios('+0.5 AP')).toEqual({ ratios: [], unparsed: ['0.5 AP'] })
  })
})

describe('findTextDamage', () => {
  it('reads per-rank base damage, ratios and type', () => {
    expect(findTextDamage(
      'Hurls a fireball, dealing 80 / 130 / 180 / 230 (+85% AP) magic damage.',
    )).toEqual({ base: [80, 130, 180, 230], ratioGroup: '+85% AP', type: 'magic', isRangeUpperBound: false })
  })

  it('reads "bonus <type> damage" phrases', () => {
    expect(findTextDamage('Attacks deal 12 (+10% Armor) bonus magic damage.')).toMatchObject({
      base: [12], type: 'magic',
    })
  })

  it('flags the upper end of a damage range', () => {
    expect(findTextDamage(
      'dealing 25 (+12% bonus AD)–250 (+120% bonus AD) physical damage plus more',
    )).toEqual({ base: [250], ratioGroup: '+120% bonus AD', type: 'physical', isRangeUpperBound: true })
  })

  it('returns null when there is no damage phrase', () => {
    expect(findTextDamage('Gains 32 (based on level) Move Speed while out of combat.')).toBeNull()
  })
})

describe('damageTypesIn', () => {
  it('lists each distinct damage type once, in order of appearance', () => {
    expect(damageTypesIn('deals magic damage, then physical damage, then magic damage')).toEqual([
      'magic', 'physical',
    ])
  })
})

describe('normalizeId', () => {
  it('maps known aliases and passes others through', () => {
    expect(normalizeId('b.-f.-sword')).toBe('bf-sword')
    expect(normalizeId('nunu-and-willump')).toBe('nunu-willump')
    expect(normalizeId('jinx')).toBe('jinx')
  })
})
