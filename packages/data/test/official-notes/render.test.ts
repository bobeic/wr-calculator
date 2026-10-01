import { describe, it, expect } from 'vitest'
import { renderNotesSection } from '../../scripts/official-notes/render'
import type { NotesCrossCheck } from '../../scripts/official-notes/types'

const CHECK: NotesCrossCheck = {
  url: 'https://example.test/9-9', found: true, published: '2026-09-29T09:00:00.000Z',
  autoReviewed: [{ kind: 'item', id: 'a', note: 'Not in the official 9.9 notes (https://example.test/9-9); wrpocket-only change to description' }],
  notesFlags: [{ kind: 'item', id: 'b', name: 'Beta', severity: 'notes', changes: [], goldens: [] }],
  mentioned: [{
    ref: { kind: 'item', id: 'deaths-dance', name: "Death's Dance" }, heading: "Death's Dance", status: 'reflected',
    lines: [{ group: 'Base Stats', text: '3200 → 3300', before: '3200', after: '3300', status: 'reflected' }],
  }],
  unmatched: [{ section: 'ITEMS', heading: 'Diadem of Songs' }],
  excludedCount: 2,
}

describe('renderNotesSection', () => {
  const text = renderNotesSection(CHECK).join('\n')

  it('links the notes and summarises the counts', () => {
    expect(text).toContain('## Official notes cross-check')
    expect(text).toContain('[official notes](https://example.test/9-9), published 2026-09-29')
    expect(text).toContain('- 1 flag auto-cleared as wrpocket-only')
    expect(text).toContain('- 1 hand-modelled entry changed in the notes but not in wrpocket')
  })

  it('lists auto-cleared entries with their notes', () => {
    expect(text).toContain('- item a: Not in the official 9.9 notes')
  })

  it('lists mentioned entries with status and lines', () => {
    expect(text).toContain("- item deaths-dance (Death's Dance): reflected")
    expect(text).toContain('  - Base Stats: 3200 → 3300 (reflected)')
  })

  it('lists unmatched headings and the excluded count, and explains the heuristic', () => {
    expect(text).toContain('- ITEMS: Diadem of Songs')
    expect(text).toContain('2 game-mode / system entries skipped')
    expect(text).toContain('heuristic')
  })

  it('says when the notes were not found', () => {
    const missing = renderNotesSection({ ...CHECK, found: false, published: null, autoReviewed: [], notesFlags: [], mentioned: [], unmatched: [], excludedCount: 0 }).join('\n')
    expect(missing).toContain('Official notes not found at https://example.test/9-9; nothing auto-cleared (use --notes-url).')
  })

  it('renders nothing when no notes stage ran', () => {
    expect(renderNotesSection(null)).toEqual([])
  })
})
