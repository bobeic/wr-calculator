import { describe, it, expect } from 'vitest'
import { changedIdsOf, diffSnapshots } from '../../scripts/patch/diff'
import { makeRawChampion, makeRawItem, makeSnapshot } from './fixtures'

const before = (items = [makeRawItem()], champions = [makeRawChampion()]) =>
  makeSnapshot('7.3', '2026-09-23 10:19:27', items, champions)
const after = (items = [makeRawItem()], champions = [makeRawChampion()]) =>
  makeSnapshot('7.3a', '2026-09-29 16:09:43', items, champions)

describe('diffSnapshots', () => {
  it('reports nothing for identical snapshots', () => {
    expect(diffSnapshots(before(), after())).toEqual({ items: [], champions: [], added: [], removed: [] })
  })

  it('reports price, tier and each numeric stat (added, removed, changed)', () => {
    const diff = diffSnapshots(
      before([makeRawItem({ numeric_stats: { attackDamage: 12, armor: 5 } })]),
      after([makeRawItem({ price: '450', tier: 'epic', numeric_stats: { attackDamage: 10, lifeSteal: 5 } })]),
    )
    expect(diff.items).toEqual([{
      kind: 'item', id: 'long-sword', name: 'Long Sword',
      changes: [
        { field: 'price', before: '500', after: '450' },
        { field: 'tier', before: 'basic', after: 'epic' },
        { field: 'stats.armor', before: '5', after: '—' },
        { field: 'stats.attackDamage', before: '12', after: '10' },
        { field: 'stats.lifeSteal', before: '—', after: '5' },
      ],
    }])
  })

  it('reports a text change with its numbers and a word diff', () => {
    const diff = diffSnapshots(
      before([makeRawItem({ description: { en: 'Deals 7% current Health' } })]),
      after([makeRawItem({ description: { en: 'Deals 6% current Health' } })]),
    )
    expect(diff.items[0].changes).toEqual([{
      field: 'description', before: 'Deals 7% current Health', after: 'Deals 6% current Health',
      numbers: [{ before: '7%', after: '6%' }], wordDiff: 'Deals ~~7%~~**6%** current Health',
    }])
  })

  it('reports a wording-only change with no numbers', () => {
    const diff = diffSnapshots(
      before([makeRawItem({ description: { en: 'Basic attacks deal 15' } })]),
      after([makeRawItem({ description: { en: 'Attacks deal 15' } })]),
    )
    expect(diff.items[0].changes[0].numbers).toEqual([])
  })

  it('names champion stats and abilities by our keys, listing changed levels only', () => {
    const changed = makeRawChampion()
    changed.stats['レベル1'] = { ...changed.stats['レベル1'], 体力: 520 }
    changed.abilities['スキル1'] = {
      ...changed.abilities['スキル1'],
      scaling: [{ type: 'cd', value: '4/4/4/4' }, { type: 'MP', value: '50/50/50/50' }],
    }
    const diff = diffSnapshots(before(undefined, [makeRawChampion()]), after(undefined, [changed]))
    expect(diff.champions[0].changes).toEqual([
      { field: 'stats.hp', before: 'Lv1 500', after: 'Lv1 520' },
      { field: 'q.scaling.MP', before: '50/55/60/65', after: '50/50/50/50' },
    ])
  })

  it('reports added and removed entries', () => {
    const diff = diffSnapshots(
      before([makeRawItem(), makeRawItem({ id: 'old-item', name: { en: 'Old Item' } })]),
      after([makeRawItem(), makeRawItem({ id: 'new-item', name: { en: 'New Item' } })]),
    )
    expect(diff.added).toEqual([{ kind: 'item', id: 'new-item', name: 'New Item' }])
    expect(diff.removed).toEqual([{ kind: 'item', id: 'old-item', name: 'Old Item' }])
  })

  it("uses this repo's ids for aliased wrpocket ids", () => {
    const diff = diffSnapshots(
      before([makeRawItem({ id: 'b.-f.-sword', price: '1300' })]),
      after([makeRawItem({ id: 'b.-f.-sword', price: '1500' })]),
    )
    expect(diff.items[0].id).toBe('bf-sword')
  })
})

describe('changedIdsOf', () => {
  it('lists changed and removed ids, sorted, without added ones', () => {
    const diff = diffSnapshots(
      before([makeRawItem({ id: 'b' }), makeRawItem({ id: 'a' }), makeRawItem({ id: 'gone' })]),
      after([makeRawItem({ id: 'b', price: '1' }), makeRawItem({ id: 'a', price: '1' }), makeRawItem({ id: 'new' })]),
    )
    expect(changedIdsOf(diff)).toEqual({ items: ['a', 'b', 'gone'], champions: [] })
  })
})
