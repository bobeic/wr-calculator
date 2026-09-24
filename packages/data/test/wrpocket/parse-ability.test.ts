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

  it('collapses internal whitespace and tolerates no space between % and the label', () => {
    expect(parseRatios('+80%bonus  AD')).toEqual({ ratios: [{ stat: 'bonusAd', value: 0.8 }], unparsed: [] })
    expect(parseRatios('+80% bonus  AD')).toEqual({ ratios: [{ stat: 'bonusAd', value: 0.8 }], unparsed: [] })
  })
})

describe('findTextDamage', () => {
  it('reads per-rank base damage, ratios and type', () => {
    expect(findTextDamage(
      'Hurls a fireball, dealing 80 / 130 / 180 / 230 (+85% AP) magic damage.',
    )).toEqual({
      base: [80, 130, 180, 230], ratioGroup: '+85% AP', type: 'magic', isRangeUpperBound: false,
      formulaSnippet: null, perHitSnippet: null,
    })
  })

  it('reads "bonus <type> damage" phrases', () => {
    expect(findTextDamage('Attacks deal 12 (+10% Armor) bonus magic damage.')).toMatchObject({
      base: [12], type: 'magic',
    })
  })

  it('flags the upper end of a damage range', () => {
    expect(findTextDamage(
      'dealing 25 (+12% bonus AD)–250 (+120% bonus AD) physical damage plus more',
    )).toEqual({
      base: [250], ratioGroup: '+120% bonus AD', type: 'physical', isRangeUpperBound: true,
      formulaSnippet: null, perHitSnippet: null,
    })
  })

  it('returns null when there is no damage phrase', () => {
    expect(findTextDamage('Gains 32 (based on level) Move Speed while out of combat.')).toBeNull()
  })

  it('flags a formula-shaped base value ("N + Level x M" or "N + M") with a reconstructed snippet', () => {
    expect(findTextDamage(
      "Illumination empowers Lux's next attack against that target, dealing 18 + Level x 7.5 (+25% AP) magic damage.",
    )).toMatchObject({ base: [7.5], formulaSnippet: '18 + Level x 7.5' })
    expect(findTextDamage(
      'plus 13 + 2 (+20% AP) magic damage over 1.5 seconds.',
    )).toMatchObject({ base: [2], formulaSnippet: '13 + 2' })
  })

  it('does not flag an ordinary base value as a formula', () => {
    expect(findTextDamage('Hurls a fireball, dealing 80 (+85% AP) magic damage.')).toMatchObject({
      formulaSnippet: null,
    })
  })

  it('flags per-hit/per-second ticking text right after the damage phrase, with a short snippet', () => {
    expect(findTextDamage('Fires 5 arrows, dealing 70 (+100% bonus AD) physical damage per arrow.'))
      .toMatchObject({ perHitSnippet: 'per arrow' })
    expect(findTextDamage('The trail burns for 60 (+60% bonus AD) magic damage per second, dealing up to 150.'))
      .toMatchObject({ perHitSnippet: 'per second' })
    expect(findTextDamage('Curses an area, dealing 7 (+7% AP) magic damage every 0.5 seconds to enemies within, and more.'))
      .toMatchObject({ perHitSnippet: 'every 0.5 seconds to enemies within' })
    expect(findTextDamage('Slashes twice, damaging enemies for 20 (+50% bonus AD) physical damage each and more.'))
      .toMatchObject({ perHitSnippet: 'each and more' })
  })

  it('does not flag ordinary trailing text as per-hit', () => {
    expect(findTextDamage('Hurls a fireball, dealing 80 (+85% AP) magic damage.')).toMatchObject({
      perHitSnippet: null,
    })
    expect(findTextDamage('dealing 25 (+12% bonus AD)–250 (+120% bonus AD) physical damage plus more'))
      .toMatchObject({ perHitSnippet: null })
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
