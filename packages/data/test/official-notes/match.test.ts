import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { matchNotes, normaliseName } from '../../scripts/official-notes/match'
import { parseNotesPage } from '../../scripts/official-notes/parse'
import type { OfficialNotes } from '../../scripts/official-notes/types'
import { readSnapshot } from '../../scripts/patch/snapshot-io'
import type { Snapshot } from '../../scripts/patch/snapshot'

const SNAPSHOTS = new URL('../../snapshots/wrpocket/', import.meta.url).pathname
const fixture = (patch: string): string =>
  readFileSync(new URL(`../fixtures/official-notes/${patch}.html`, import.meta.url), 'utf-8')

function snapshot(items: Array<[string, string]>, champions: Array<[string, string]>): Snapshot {
  return {
    meta: { patch: 't', updated: '2026-01-01 00:00:00' },
    items: items.map(([id, name]) => ({
      id, name: { en: name }, description: { en: '' }, price: '0', tier: '', category: { en: '' }, components: [], numeric_stats: {},
    })),
    champions: champions.map(([id, name]) => ({ id, name: { en: name }, stats: {}, abilities: {} })),
  }
}

function notes(entries: Array<Partial<OfficialNotes['entries'][number]> & { heading: string }>): OfficialNotes {
  return {
    patch: 't', url: 'u', title: '', published: '',
    entries: entries.map((entry) => ({ source: 'rich-text', section: 'ITEMS', excluded: false, lines: [], ...entry })),
  }
}

describe('normaliseName', () => {
  it('folds case, quotes, entities and punctuation', () => {
    expect(normaliseName('Serylda’s Grudge')).toBe('seryldas grudge')
    expect(normaliseName("Serylda’s  Grudge&nbsp;")).toBe('seryldas grudge')
    expect(normaliseName('Nunu & Willump')).toBe('nunu willump')
    expect(normaliseName('HWEI')).toBe('hwei')
  })
})

describe('matchNotes', () => {
  const snap = snapshot([['seryldas-grudge', 'Serylda’s Grudge'], ['dominiks-regards', 'Dominik’s Regards'], ['viego', 'Viego']], [['viego', 'Viego'], ['hwei', 'Hwei']])

  it('matches curly-quoted items and upper-case champion cards', () => {
    const matched = matchNotes(notes([
      { heading: "Serylda’s Grudge" },
      { heading: 'HWEI', source: 'champion-blade', section: '' },
    ]), snap)
    expect(matched.map((entry) => entry.ref)).toEqual([
      { kind: 'item', id: 'seryldas-grudge', name: 'Serylda’s Grudge' },
      { kind: 'champion', id: 'hwei', name: 'Hwei' },
    ])
  })

  it('uses the alias table', () => {
    expect(matchNotes(notes([{ heading: "Lord Dominik’s Regards" }]), snap)[0].ref?.id).toBe('dominiks-regards')
  })

  it('looks up champions only for champion cards and items first for rich text', () => {
    const matched = matchNotes(notes([
      { heading: 'VIEGO', source: 'champion-blade', section: '' },
      { heading: 'Viego' },
    ]), snap)
    expect(matched.map((entry) => entry.ref?.kind)).toEqual(['champion', 'item'])
  })

  it('leaves excluded and unknown entries unmatched', () => {
    const matched = matchNotes(notes([
      { heading: 'Viego', excluded: true },
      { heading: 'Nexus' },
    ]), snap)
    expect(matched.map((entry) => entry.ref)).toEqual([null, null])
  })

  it('matches the 7.3a notes against the 7.3a snapshot', async () => {
    const real = await readSnapshot(`${SNAPSHOTS}7.3a`)
    const matched = matchNotes(parseNotesPage(fixture('7.3a'), '7.3a', 'u'), real)
    expect(matched.filter((entry) => entry.ref !== null)).toHaveLength(15)
    expect(matched.filter((entry) => entry.ref === null && !entry.excluded).map((entry) => entry.heading)).toEqual(['Diadem of Songs'])
    expect(matched.find((entry) => entry.heading === "Death's Dance")?.ref?.id).toBe('deaths-dance')
  })
})
