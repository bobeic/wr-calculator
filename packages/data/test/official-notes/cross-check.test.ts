import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { crossCheckNotes, numberTokens } from '../../scripts/official-notes/cross-check'
import { parseNotesPage } from '../../scripts/official-notes/parse'
import type { OfficialNotes } from '../../scripts/official-notes/types'
import { diffSnapshots } from '../../scripts/patch/diff'
import { flagHandModelled } from '../../scripts/patch/patch-diff'
import type { Snapshot } from '../../scripts/patch/snapshot'
import { readSnapshot } from '../../scripts/patch/snapshot-io'
import { getPatchDataset } from '../../src/patches/registry'

const SNAPSHOTS = new URL('../../snapshots/wrpocket/', import.meta.url).pathname
const fixture = (patch: string): string =>
  readFileSync(new URL(`../fixtures/official-notes/${patch}.html`, import.meta.url), 'utf-8')

const item = (id: string, name: string, price: string, description = ''): Snapshot['items'][number] => ({
  id, name: { en: name }, description: { en: description }, price, tier: '', category: { en: '' }, components: [], numeric_stats: { attackSpeed: 30 },
})
const snap = (items: Snapshot['items']): Snapshot => ({ meta: { patch: 't', updated: '2026-01-01 00:00:00' }, items, champions: [] })

interface EntrySpec {
  heading: string
  section?: string
  excluded?: boolean
  lines?: Array<{ text: string; after: string | null }>
}

function notes(entries: EntrySpec[]): OfficialNotes {
  return {
    patch: '9.9', url: 'https://example.test/9-9', title: '', published: '2026-01-01T00:00:00.000Z',
    entries: entries.map(({ heading, section = 'ITEMS', excluded = false, lines = [] }) => ({
      source: 'rich-text', section, excluded, heading,
      lines: lines.map(({ text, after }) => ({ group: null, text, before: after === null ? null : 'x', after })),
    })),
  }
}

const NONE = { items: [], champions: [] }

function run(
  before: Snapshot, after: Snapshot, notesOrNull: OfficialNotes | null, handItems: string[], coveredItems: string[] = [], staleItems: string[] = [],
) {
  const diff = diffSnapshots(before, after)
  const handModelled = { items: handItems, champions: [] }
  const covered = { items: coveredItems, champions: [] }
  const previousStale = staleItems.map((id) => ({ kind: 'item' as const, id, name: id, since: '9.8' }))
  return crossCheckNotes({
    patch: '9.9', url: 'https://example.test/9-9', notes: notesOrNull, after, diff,
    flags: flagHandModelled(diff, handModelled, covered, []), handModelled, covered, goldens: [], previousStale,
  })
}

describe('numberTokens', () => {
  it('strips thousands separators and percent signs', () => {
    expect(numberTokens('3,300 gold, 25% and 0.25% for 20s')).toEqual(['3300', '25', '0.25', '20'])
  })
})

describe('crossCheckNotes', () => {
  const before = snap([item('a', 'Alpha', '3200', 'Deals 7%'), item('b', 'Beta', '1000'), item('gone', 'Gone', '1')])

  it('auto-clears a changed flag the notes do not mention, naming the fields', () => {
    const check = run(before, snap([item('a', 'Alpha', '3200', 'Deals 6%'), item('b', 'Beta', '1000'), item('gone', 'Gone', '1')]), notes([{ heading: 'Beta' }]), ['a'])
    expect(check.autoReviewed).toEqual([{
      kind: 'item', id: 'a', note: 'Not in the official 9.9 notes (https://example.test/9-9); wrpocket-only change to description',
    }])
  })

  it('never auto-clears an entry already stale from an earlier patch', () => {
    const after = snap([item('a', 'Alpha', '3200', 'Deals 6%'), item('b', 'Beta', '1000'), item('gone', 'Gone', '1')])
    const check = run(before, after, notes([{ heading: 'Beta' }]), ['a'], [], ['a'])
    expect(check.autoReviewed).toEqual([])
  })

  it('never auto-clears an entry named only in an excluded section, but reports nothing else for it', () => {
    const after = snap([item('a', 'Alpha', '3200', 'Deals 6%'), item('b', 'Beta', '1000', 'Deals 1%'), item('gone', 'Gone', '1')])
    const check = run(before, after, notes([
      { heading: 'Alpha', section: 'Item System Adjustments', excluded: true, lines: [{ text: 'Price: 3200 → 3300', after: '3300' }] },
      { heading: 'Gone' },
    ]), ['a', 'b'])
    expect(check.autoReviewed.map((entry) => entry.id)).toEqual(['b'])
    expect(check.mentioned.map((entry) => entry.ref.id)).toEqual(['gone'])
    expect(check.notesFlags).toEqual([])
    expect(check.excludedCount).toBe(1)
  })

  it('never auto-clears a removed entry or a mentioned one', () => {
    const after = snap([item('a', 'Alpha', '3300', 'Deals 7%'), item('b', 'Beta', '1000')])
    const check = run(before, after, notes([{ heading: 'Alpha', lines: [{ text: 'Price: 3200 → 3,300', after: '3,300' }] }]), ['a', 'gone'])
    expect(check.autoReviewed).toEqual([])
  })

  it('auto-clears nothing when the notes page was not found', () => {
    const check = run(before, snap([item('a', 'Alpha', '3200', 'Deals 6%'), item('b', 'Beta', '1000'), item('gone', 'Gone', '1')]), null, ['a'])
    expect(check).toMatchObject({ found: false, autoReviewed: [], notesFlags: [], mentioned: [], published: null })
  })

  it('flags a hand-modelled entry the notes change but wrpocket did not', () => {
    const check = run(before, before, notes([{ heading: 'Beta', lines: [{ text: 'Price: 1000 → 1100', after: '1100' }] }]), ['b'])
    expect(check.notesFlags).toEqual([{ kind: 'item', id: 'b', name: 'Beta', severity: 'notes', changes: [], goldens: [] }])
  })

  it('skips covered ids for both auto-clear and notes flags', () => {
    const after = snap([item('a', 'Alpha', '3200', 'Deals 6%'), item('b', 'Beta', '1000'), item('gone', 'Gone', '1')])
    const check = run(before, after, notes([{ heading: 'Beta', lines: [{ text: 'Price: 1000 → 1100', after: '1100' }] }]), ['a', 'b'], ['a', 'b'])
    expect(check.autoReviewed).toEqual([])
    expect(check.notesFlags).toEqual([])
  })

  it('rates reflected, partly, not in wrpocket and no numbers', () => {
    const after = snap([item('a', 'Alpha', '3300', 'Deals 7%'), item('b', 'Beta', '1000'), item('gone', 'Gone', '1')])
    const check = run(before, after, notes([
      { heading: 'Alpha', lines: [{ text: 'Price: 3200 → 3,300', after: '3,300' }, { text: 'Attack Speed: 25% → 30%', after: '30%' }] },
      { heading: 'Beta', lines: [{ text: 'Price: 1000 → 1100', after: '1100' }, { text: 'Price: 900 → 1000', after: '1000' }] },
      { heading: 'Gone', lines: [{ text: 'Price: 2 → 3', after: '3' }] },
      { heading: 'Nexus' },
    ]), [])
    expect(check.mentioned.map((entry) => [entry.ref.id, entry.status])).toEqual([['a', 'reflected'], ['b', 'partly'], ['gone', 'not in wrpocket']])
    expect(check.unmatched).toEqual([{ section: 'ITEMS', heading: 'Nexus' }])
  })

  it('rates an entry with only arrowless lines as no numbers', () => {
    const check = run(before, before, notes([{ heading: 'Beta', lines: [{ text: '[Removed]', after: null }] }]), [])
    expect(check.mentioned[0].status).toBe('no numbers')
  })

  it('tokenises each wrpocket value separately and ignores object keys', () => {
    const withArray = { ...item('b', 'Beta', '1000'), numeric_stats: { stat999: 5 }, extra: [10, 200] } as Snapshot['items'][number]
    const check = run(before, snap([withArray]), notes([
      { heading: 'Beta', lines: [{ text: 'Extra: 1 → 200', after: '200' }, { text: 'Stat: 1 → 999', after: '999' }] },
    ]), [])
    expect(check.mentioned[0].lines.map((line) => line.status)).toEqual(['reflected', 'not found'])
  })

  it('throws when the page has entries but none match', () => {
    expect(() => run(before, before, notes([{ heading: 'Nexus' }, { heading: 'Smite' }]), [])).toThrow(/none of its 2 entries matched/)
  })

  it('reproduces the hand review of 7.3a: 30 auto-cleared, only Death\'s Dance left', async () => {
    const before73 = await readSnapshot(`${SNAPSHOTS}7.3`)
    const after73a = await readSnapshot(`${SNAPSHOTS}7.3a`)
    const dataset = getPatchDataset('7.3')
    const handModelled = { items: dataset.handModelled.items.map((entry) => entry.id), champions: dataset.handModelled.champions.map((entry) => entry.id) }
    const diff = diffSnapshots(before73, after73a)
    const flags = flagHandModelled(diff, handModelled, NONE, [])
    const notes73a = parseNotesPage(fixture('7.3a'), '7.3a', 'https://example.test/7-3a')
    const check = crossCheckNotes({ patch: '7.3a', url: notes73a.url, notes: notes73a, after: after73a, diff, flags, handModelled, covered: NONE, goldens: [], previousStale: [] })
    expect(check.autoReviewed).toHaveLength(30)
    const cleared = new Set(check.autoReviewed.map((entry) => entry.id))
    expect(flags.filter((flag) => !cleared.has(flag.id)).map((flag) => flag.id)).toEqual(['deaths-dance'])
    expect(check.notesFlags).toEqual([])
    expect(check.mentioned.find((entry) => entry.ref.id === 'deaths-dance')?.status).toBe('reflected')
  })
})
