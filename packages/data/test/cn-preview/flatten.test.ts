import { describe, it, expect } from 'vitest'
import { cnLeaks, diffFlat, differsNow, flatten } from '../../scripts/cn-preview/flatten'
import type { LiveLookup, RawEquip, RawHero } from '../../scripts/cn-preview/flatten'
import type { Snapshot } from '../../scripts/patch/snapshot'

const equip = (price: string, ad: string): RawEquip => ({
  version: '7.3', fileTime: 't',
  equipList: [
    { equipId: '2240', name: '电刃', price, from: ['2001'], ad, attackSpeed: '3500', hp: '0' },
    { equipId: '2119', name: '歌之权冠', price: '2400', from: [] },
  ],
})
const hero = (base: string): RawHero => ({
  version: '7.3', fileTime: 't', hero: { heroId: '10068', name: '瑟提', hp: '6000000' },
  spells: [
    { spellKey: 'passive' },
    { spellKey: 'active', costvalue: '0', variType1: 'cd', variValue1: '9/8/6/5', variType2: 'None', variValue2: '0', variType3: '基础伤害', variValue3: base },
  ],
})
const items = new Map([['2240', 'statikk-shiv'], ['2001', 'dagger']])
const champions = new Map([['10068', 'sett']])

describe('flatten', () => {
  it('scales stats, maps ids, skips zero stats and None rows, and keys CN-only entries by Tencent id', () => {
    const flat = flatten(equip('3000', '450000'), [hero('5/20/35/50')], items, champions)
    expect(flat['item:statikk-shiv']).toEqual({ name: '电刃', price: '3000', from: 'dagger', 'stat.ad': '45', 'stat.attackSpeed': '35' })
    expect(flat['item:cn-2119']).toMatchObject({ price: '2400' })
    expect(flat['champion:sett']).toEqual({ name: '瑟提', 'base.hp': '600', 'q.cd': '9/8/6/5', 'q.基础伤害': '5/20/35/50' })
  })
})

describe('diffFlat and differsNow', () => {
  const live: LiveLookup = (entry, field) => (entry === 'item:statikk-shiv' && field === 'price' ? '3100' : null)

  it('lists changed fields with whether live already has the new value', () => {
    const before = flatten(equip('3000', '450000'), [hero('5/20/35/50')], items, champions)
    const after = flatten(equip('3100', '500000'), [hero('10/25/40/55')], items, champions)
    expect(diffFlat(before, after, live).map((c) => `${c.entry} ${c.field} ${c.before}->${c.after} ${c.live}`)).toEqual([
      'champion:sett q.基础伤害 5/20/35/50->10/25/40/55 unknown',
      'item:statikk-shiv price 3000->3100 live',
      'item:statikk-shiv stat.ad 45->50 unknown',
    ])
  })

  it('lists only fields with a known live value that disagrees', () => {
    const flat = flatten(equip('3000', '450000'), [], items, champions)
    expect(differsNow(flat, live)).toEqual([
      { entry: 'item:statikk-shiv', name: '电刃', field: 'price', before: '3100', after: '3000', live: 'cn-only' },
    ])
  })
})

describe('cnLeaks', () => {
  const snapshot = (price: string, ad: number): Snapshot => ({
    meta: { patch: '7.3', updated: 't' }, champions: [],
    items: [{ id: 'statikk-shiv', name: { en: 'Statikk Shiv' }, description: { en: '' }, price, tier: '3', category: { en: 'physical' }, components: [], numeric_stats: { attackDamage: ad } }],
  })
  const cn = { 'item:statikk-shiv': { name: '电刃', price: '3100', 'stat.ad': '45' } }

  it('flags a value that moved onto exactly CN\'s number', () => {
    expect(cnLeaks(snapshot('3000', 45), snapshot('3100', 45), cn)).toEqual([
      { entry: 'item:statikk-shiv', name: 'Statikk Shiv', field: 'price', before: '3000', after: '3100', live: 'live' },
    ])
  })

  it('ignores unchanged values and changes CN doesn\'t share', () => {
    expect(cnLeaks(snapshot('3000', 45), snapshot('3000', 45), cn)).toEqual([])
    expect(cnLeaks(snapshot('3000', 45), snapshot('2900', 40), cn)).toEqual([])
  })
})
