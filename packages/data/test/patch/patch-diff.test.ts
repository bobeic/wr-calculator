import type { Item } from '@wr-calc/schema'
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

describe('auto-apply of number-only item changes', () => {
  const item = (id: string, name: string, overrides: Parameters<typeof makeRawItem>[0] = {}) => makeRawItem({ id, name: { en: name }, ...overrides })
  const ids = ['price', 'stat', 'text', 'added-stat', 'pinned', 'unconfirmed', 'contradicted', 'linked', 'linked-unconfirmed']
  const names: Record<string, string> = {
    price: 'Price Item', stat: 'Stat Item', text: 'Text Item', 'added-stat': 'Added Stat', pinned: 'Pinned Item',
    unconfirmed: 'Quiet Item', contradicted: 'Wrong Item', linked: 'Linked Item', 'linked-unconfirmed': 'Unsure Item',
  }
  const strike = (pctHp: number): { en: string } => ({ en: `Strike: Attacks deal ${pctHp}% of current Health.` })
  const base = makeSnapshot('7.3', '2026-09-23 10:19:27', ids.map((id) => item(id, names[id], id.startsWith('linked') ? { description: strike(7) } : {})), [])
  const after = makeSnapshot('7.3a', '2026-09-29 16:09:43', [
    item('price', names.price, { price: '600', components: ['dagger'], tier: 'epic' }),
    item('stat', names.stat, { numeric_stats: { attackDamage: 15 } }),
    item('text', names.text, { price: '600', description: { en: '+12 Attack Damage. New passive.' } }),
    item('added-stat', names['added-stat'], { numeric_stats: { attackDamage: 12, armor: 5 } }),
    item('pinned', names.pinned, { price: '600' }),
    item('unconfirmed', names.unconfirmed, { price: '600' }),
    item('contradicted', names.contradicted, { price: '600' }),
    item('linked', names.linked, { description: strike(6) }),
    item('linked-unconfirmed', names['linked-unconfirmed'], { description: strike(6) }),
  ], [])
  const line = (text: string, value: string) => ({ group: null, text, before: 'x', after: value })
  const entry = (id: string, lines: ReturnType<typeof line>[]) => ({ source: 'rich-text' as const, section: 'ITEMS', excluded: false, heading: names[id], lines })
  const notes = {
    patch: '7.3a', url: 'u', title: '', published: '',
    entries: [
      ...['price', 'text', 'added-stat', 'pinned'].map((id) => entry(id, [line('Cost', '600')])),
      entry('stat', [line('AD', '15')]),
      entry('contradicted', [line('Cost', '650')]),
      entry('linked', [line('Damage', '6%')]),
      entry('linked-unconfirmed', [line('Range', '500')]),
    ],
  }
  const model = (id: string): Item => ({
    id, name: names[id], tier: 'basic', cost: { total: 500, combine: 500 }, recipe: [], stats: { ad: 12 }, tags: [],
    effects: [{ kind: 'onHit', id: `${id}-strike`, name: 'Strike', description: '', support: 'full', damageType: 'physical', pctTargetCurrentHp: 0.07 } as unknown as Item['effects'][number]],
    provenance: { source: 'wiki', patch: '7.3', verifiedInGame: false },
    ...(id === 'pinned' ? { sourcePins: ['cost'] } : {}),
  })
  const links = Object.fromEntries(['linked', 'linked-unconfirmed'].map((id) => [id, {
    links: [{ effectId: `${id}-strike`, path: 'pctTargetCurrentHp', capture: [/deal (\d+)% of current Health/], value: ([n]: number[]) => n / 100 }],
  }]))
  const run = (withNotes: boolean) => buildPatchDiff({
    before: base, after, handModelled: { items: ids, champions: [] }, previousStale: [], covered: NONE, goldens: [],
    notesBefore: [], notesAfter: [], notes: withNotes ? { url: 'u', notes } : null, autoApply: { handItems: ids.map(model), links },
  })

  it('applies changes the notes confirm; flags wording, added stats, pins, unconfirmed and contradicted changes', () => {
    const result = run(true)
    expect(result.autoApplied.map((entry) => entry.id)).toEqual(['linked', 'price', 'stat'])
    expect(result.needsReview.map((flag) => flag.id).sort())
      .toEqual(['added-stat', 'contradicted', 'linked-unconfirmed', 'pinned', 'text', 'unconfirmed'])
  })

  it('turns a confirmed linked description number into a text-sync update', () => {
    expect(run(true).textSync).toEqual([{ itemId: 'linked', effectId: 'linked-strike', path: 'pctTargetCurrentHp', value: 0.06, note: '7 -> 6' }])
  })

  it('never auto-clears a synced change just because the notes leave it out', () => {
    expect(run(true).officialNotes?.autoReviewed).toEqual([])
  })

  it('auto-applies nothing without the official notes, or when autoApply is off', () => {
    expect(run(false).autoApplied).toEqual([])
    expect(run(false).textSync).toEqual([])
    expect(run(false).needsReview).toHaveLength(9)
    const { autoApply: _, ...input } = {
      before: base, after, handModelled: { items: ids, champions: [] }, previousStale: [], covered: NONE, goldens: [],
      notesBefore: [], notesAfter: [], notes: { url: 'u', notes }, autoApply: undefined,
    }
    expect(buildPatchDiff(input).autoApplied).toEqual([])
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

  // trinity-force's only change is its price, which the overlay syncs; a notes-only auto-clear would hide it.
  it('keeps a synced change the official notes do not mention flagged instead of auto-clearing it', () => {
    const notes = {
      patch: '7.3a', url: 'u', title: '', published: '',
      entries: [{ source: 'rich-text' as const, section: 'ITEMS', excluded: false, heading: 'Long Sword', lines: [] }],
    }
    const withNotes = buildPatchDiff({
      before, after, handModelled: { items: ['trinity-force'], champions: [] }, previousStale: [],
      covered: NONE, goldens: [], notesBefore: [], notesAfter: [], notes: { url: 'u', notes },
    })
    expect(withNotes.needsReview.map((flag) => flag.id)).toEqual(['trinity-force'])
    expect(withNotes.officialNotes?.autoReviewed).toEqual([])
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
