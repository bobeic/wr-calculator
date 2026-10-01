import { describe, it, expect } from 'vitest'
import { diffSnapshots } from '../../scripts/patch/diff'
import { buildPatchDiff, flagHandModelled, goldenRefs, goldensUsing } from '../../scripts/patch/patch-diff'
import type { GoldenRef } from '../../scripts/patch/patch-diff'
import type { LoadedGoldenCase } from '../../src/golden-loader'
import { makeRawChampion, makeRawItem, makeSnapshot } from './fixtures'

const golden = (file: string, championId: string, items: string[], boots?: string): LoadedGoldenCase => ({
  file,
  case: {
    scenario: {
      championId, level: 15, build: { items, runes: [], inputs: {}, ...(boots ? { boots } : {}) },
      target: { hp: 10000, armor: 100, mr: 100 }, combo: ['Q'],
    },
    expected: { totalDamage: 1 }, tolerance: 0.01, patch: '7.3', source: 'practice-tool',
  },
})

const GOLDENS: GoldenRef[] = goldenRefs([
  golden('annie-q.json', 'annie', ['rabadons-deathcap'], 'spellslingers-shoes'),
  golden('ambessa-aa.json', 'ambessa', ['bf-sword']),
])

const NONE = { items: [], champions: [] }
const before = makeSnapshot('7.3', '2026-09-23 10:19:27',
  [makeRawItem({ id: 'trinity-force', name: { en: 'Trinity Force' } }), makeRawItem({ id: 'b.-f.-sword' }),
    makeRawItem({ id: 'rabadons-deathcap' }), makeRawItem({ id: 'plain' })],
  [makeRawChampion()])
const after = makeSnapshot('7.3a', '2026-09-29 16:09:43',
  [makeRawItem({ id: 'trinity-force', name: { en: 'Trinity Force' }, price: '3400' }),
    makeRawItem({ id: 'b.-f.-sword', price: '1450' }), makeRawItem({ id: 'plain', price: '1' })],
  [makeRawChampion({ stats: { ...makeRawChampion().stats, レベル1: { ...makeRawChampion().stats['レベル1'], 攻撃力: 55 } } })])
const diff = diffSnapshots(before, after)

describe('goldensUsing', () => {
  it('matches by champion id, build items, boots and enchant', () => {
    const [withEnchant] = goldenRefs([{ ...golden('e.json', 'jinx', []), case: { ...golden('e.json', 'jinx', []).case, scenario: { ...golden('e.json', 'jinx', []).case.scenario, build: { items: [], runes: [], inputs: {}, enchant: 'stasis-enchant' } } } }])
    expect(withEnchant.itemIds).toEqual(['stasis-enchant'])
    expect(goldensUsing({ kind: 'champion', id: 'annie', name: 'Annie' }, GOLDENS)).toEqual(['annie-q.json'])
    expect(goldensUsing({ kind: 'item', id: 'spellslingers-shoes', name: '' }, GOLDENS)).toEqual(['annie-q.json'])
    expect(goldensUsing({ kind: 'item', id: 'annie', name: '' }, GOLDENS)).toEqual([])
  })
})

describe('flagHandModelled', () => {
  const handModelled = { items: ['trinity-force', 'bf-sword', 'rabadons-deathcap'], champions: ['annie'] }

  it('flags removed entries first, then changed ones, with goldens', () => {
    const flags = flagHandModelled(diff, handModelled, NONE, GOLDENS)
    expect(flags.map((flag) => [flag.severity, flag.kind, flag.id])).toEqual([
      ['removed', 'item', 'rabadons-deathcap'],
      ['changed', 'champion', 'annie'],
      ['changed', 'item', 'bf-sword'],
      ['changed', 'item', 'trinity-force'],
    ])
    expect(flags[0].goldens).toEqual(['annie-q.json'])
    expect(flags[2].goldens).toEqual(['ambessa-aa.json'])
  })

  it('skips covered ids and ids that are not hand-modelled', () => {
    const flags = flagHandModelled(diff, handModelled, { items: ['trinity-force'], champions: ['annie'] }, GOLDENS)
    expect(flags.map((flag) => flag.id)).toEqual(['rabadons-deathcap', 'bf-sword'])
    expect(flags.some((flag) => flag.id === 'plain')).toBe(false)
  })
})

describe('buildPatchDiff', () => {
  const result = buildPatchDiff({
    before, after, handModelled: { items: ['trinity-force'], champions: [] },
    previousStale: [{ kind: 'item', id: 'old-stale', name: 'Old', since: '7.2' }],
    covered: NONE, goldens: GOLDENS,
    notesBefore: [{ subject: 'item plain', note: 'gone note' }, { subject: 'item plain', note: 'kept' }],
    notesAfter: [{ subject: 'item plain', note: 'kept' }, { subject: 'item plain', note: 'new note' }],
    notes: null,
  })

  it('carries the header fields and the flags', () => {
    expect([result.from, result.to, result.fromUpdated, result.toUpdated])
      .toEqual(['7.3', '7.3a', '2026-09-23 10:19:27', '2026-09-29 16:09:43'])
    expect(result.needsReview.map((flag) => flag.id)).toEqual(['trinity-force'])
  })

  it('attaches goldens to changed generated entries', () => {
    expect(result.champions.find((entry) => entry.id === 'annie')?.goldens).toEqual(['annie-q.json'])
  })

  it('keeps earlier stale entries unless covered now', () => {
    expect(result.carriedStale.map((entry) => entry.id)).toEqual(['old-stale'])
    const covered = buildPatchDiff({
      before, after, handModelled: NONE, previousStale: [{ kind: 'item', id: 'old-stale', name: 'Old', since: '7.2' }],
      covered: { items: ['old-stale'], champions: [] }, goldens: [], notesBefore: [], notesAfter: [], notes: null,
    })
    expect(covered.carriedStale).toEqual([])
  })

  it('does not carry a stale entry that is flagged again in the same patch', () => {
    const again = buildPatchDiff({
      before, after, handModelled: { items: ['trinity-force'], champions: [] },
      previousStale: [{ kind: 'item', id: 'trinity-force', name: 'Trinity Force', since: '7.2' }],
      covered: NONE, goldens: [], notesBefore: [], notesAfter: [], notes: null,
    })
    expect(again.needsReview.map((flag) => flag.id)).toEqual(['trinity-force'])
    expect(again.carriedStale).toEqual([])
  })

  it('auto-clears flags the official notes do not mention', () => {
    const notes = {
      patch: '7.3a', url: 'u', title: '', published: '',
      entries: [{ source: 'rich-text' as const, section: 'ITEMS', excluded: false, heading: 'Long Sword', lines: [] }],
    }
    const withNotes = buildPatchDiff({
      before, after, handModelled: { items: ['trinity-force'], champions: [] }, previousStale: [],
      covered: NONE, goldens: [], notesBefore: [], notesAfter: [], notes: { url: 'u', notes },
    })
    expect(withNotes.needsReview).toEqual([])
    expect(withNotes.officialNotes?.autoReviewed.map((entry) => entry.id)).toEqual(['trinity-force'])
  })

  it('keeps a previously stale flag in needsReview instead of auto-clearing it', () => {
    const notes = {
      patch: '7.3a', url: 'u', title: '', published: '',
      entries: [{ source: 'rich-text' as const, section: 'ITEMS', excluded: false, heading: 'Long Sword', lines: [] }],
    }
    const stale = buildPatchDiff({
      before, after, handModelled: { items: ['trinity-force'], champions: [] },
      previousStale: [{ kind: 'item', id: 'trinity-force', name: 'Trinity Force', since: '7.2' }],
      covered: NONE, goldens: [], notesBefore: [], notesAfter: [], notes: { url: 'u', notes },
    })
    expect(stale.officialNotes?.autoReviewed).toEqual([])
    expect(stale.needsReview.map((flag) => flag.id)).toEqual(['trinity-force'])
  })

  it('reports no notes stage when notes is null', () => {
    expect(result.officialNotes).toBeNull()
  })

  it('reports mapper notes that are new or gone', () => {
    expect(result.mapperNotes).toEqual({
      added: [{ subject: 'item plain', note: 'new note' }],
      removed: [{ subject: 'item plain', note: 'gone note' }],
    })
  })
})
