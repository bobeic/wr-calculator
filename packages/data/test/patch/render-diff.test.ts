import { describe, it, expect } from 'vitest'
import { renderPatchDiff } from '../../scripts/patch/render-diff'
import type { PatchDiff } from '../../scripts/patch/types'

const DIFF: PatchDiff = {
  from: '7.3', to: '7.3a', fromUpdated: '2026-09-23 10:19:27', toUpdated: '2026-09-29 16:09:43',
  needsReview: [
    { severity: 'removed', kind: 'item', id: 'gone-item', name: 'Gone Item', changes: [], goldens: [] },
    {
      severity: 'changed', kind: 'item', id: 'blade-of-the-ruined-king', name: 'Blade of the Ruined King',
      goldens: ['ambessa-aa.json'],
      changes: [
        { field: 'stats.attackDamage', before: '40', after: '35' },
        { field: 'description', before: 'Deals 7%', after: 'Deals 6%', numbers: [{ before: '7%', after: '6%' }], wordDiff: 'Deals ~~7%~~**6%**' },
        { field: 'name', before: 'a b', after: 'b a', numbers: [], wordDiff: '~~a~~ b **a**' },
      ],
    },
    { severity: 'notes', kind: 'item', id: 'notes-only', name: 'Notes Only', changes: [], goldens: [] },
  ],
  autoApplied: [
    { kind: 'item', id: 'deaths-dance', name: "Death's Dance", goldens: [], changes: [{ field: 'price', before: '3200', after: '3300' }] },
  ],
  textSync: [{ itemId: 'deaths-dance', effectId: 'dd-cauterize', path: 'ratio', value: 0.35, note: '30 -> 35' }],
  carriedStale: [{ kind: 'champion', id: 'ambessa', name: 'Ambessa', since: '7.2' }],
  items: [], champions: [
    { kind: 'champion', id: 'annie', name: 'Annie', goldens: ['annie-q.json'], changes: [{ field: 'stats.ad', before: 'Lv1 52', after: 'Lv1 55' }] },
  ],
  added: [{ kind: 'item', id: 'new-item', name: 'New Item' }], removed: [],
  mapperNotes: { added: [{ subject: 'item x', note: 'n' }], removed: [] },
  officialNotes: null,
}

describe('renderPatchDiff', () => {
  const report = renderPatchDiff(DIFF)

  it('puts the sections in order', () => {
    const order = ['# Patch diff: 7.3 → 7.3a', '## Needs review', '## Applied automatically', '## Still stale from earlier patches',
      '## Changed champions', '## Changed items', '## Added', '## Removed', '## Mapper notes']
    const positions = order.map((heading) => report.indexOf(heading))
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('renders flags with severity, goldens, value and text changes', () => {
    expect(report).toContain('### item gone-item (Gone Item): removed from wrpocket')
    expect(report).toContain('### item blade-of-the-ruined-king (Blade of the Ruined King): changed')
    expect(report).toContain('Goldens: ambessa-aa.json')
    expect(report).toContain('- `stats.attackDamage`: 40 → 35')
    expect(report).toContain('- `description`: numbers 7% → 6%')
    expect(report).toContain('- `name`: wording only')
    expect(report).toContain('<details><summary>text diff</summary>\n\nDeals ~~7%~~**6%**\n\n</details>')
  })

  it('says None. for empty sections and shows summary counts', () => {
    expect(report).toContain('## Removed\n\nNone.')
    expect(report).toContain('- 3 hand-modelled entries need review')
    expect(report).toContain('- 0 items and 1 champions changed, 1 added, 0 removed')
    expect(report).toContain('- champion ambessa (Ambessa), stale since 7.2')
  })

  it('lists auto-applied items with their changes and counts them', () => {
    expect(report).toContain('- 1 hand-modelled items took number-only changes from wrpocket automatically')
    const section = report.slice(report.indexOf('## Applied automatically'), report.indexOf('## Still stale'))
    expect(section).toContain("### item deaths-dance (Death's Dance)")
    expect(section).toContain('- `price`: 3200 → 3300')
    expect(section).toContain('- deaths-dance `dd-cauterize.ratio` = 0.35 (text 30 -> 35)')
  })

  it('labels a notes-only flag', () => {
    expect(report).toContain('### item notes-only (Notes Only): in the official notes, wrpocket unchanged')
  })

  it('puts the notes section after Needs review when present', () => {
    const withNotes = renderPatchDiff({
      ...DIFF,
      officialNotes: { url: 'https://example.test/n', found: false, published: null, autoReviewed: [], notesFlags: [], mentioned: [], unmatched: [], excludedCount: 0 },
    })
    expect(withNotes.indexOf('## Official notes cross-check')).toBeGreaterThan(withNotes.indexOf('## Needs review'))
    expect(withNotes.indexOf('## Official notes cross-check')).toBeLessThan(withNotes.indexOf('## Still stale from earlier patches'))
  })

  describe('In the official notes line', () => {
    const FOUND = {
      url: 'https://example.test/n', found: true, published: '2026-09-29T09:00:00.000Z', autoReviewed: [], notesFlags: [],
      mentioned: [{ ref: { kind: 'item' as const, id: 'blade-of-the-ruined-king', name: 'Blade of the Ruined King' }, heading: 'Blade', status: 'reflected' as const, lines: [] }],
      unmatched: [], excludedCount: 0,
    }
    const entryBlock = (text: string, heading: string): string => text.split('### ').find((block) => block.startsWith(heading)) ?? ''

    it('says yes for a flagged entry the notes mention', () => {
      const block = entryBlock(renderPatchDiff({ ...DIFF, officialNotes: FOUND }), 'item blade-of-the-ruined-king')
      expect(block).toContain('In the official notes: yes')
      expect(block.indexOf('Goldens:')).toBeLessThan(block.indexOf('In the official notes:'))
    })

    it('says no for a flagged entry the notes do not mention', () => {
      expect(entryBlock(renderPatchDiff({ ...DIFF, officialNotes: FOUND }), 'item gone-item')).toContain('In the official notes: no')
    })

    it('lists the matched notes lines under a notes-only flag', () => {
      const withLines = {
        ...FOUND,
        mentioned: [...FOUND.mentioned, {
          ref: { kind: 'item' as const, id: 'notes-only', name: 'Notes Only' }, heading: 'Notes Only', status: 'not in wrpocket' as const,
          lines: [{ group: 'Base Stats', text: 'Price: 1000 → 1100', before: '1000', after: '1100', status: 'not found' as const }],
        }],
      }
      const block = entryBlock(renderPatchDiff({ ...DIFF, officialNotes: withLines }), 'item notes-only')
      expect(block).toContain('- Base Stats: Price: 1000 → 1100 (not found)')
      expect(entryBlock(renderPatchDiff({ ...DIFF, officialNotes: withLines }), 'item blade-of-the-ruined-king')).not.toContain('(not found)')
    })

    it('omits the line when there is no notes stage or the notes were not found', () => {
      expect(report).not.toContain('In the official notes:')
      expect(renderPatchDiff({ ...DIFF, officialNotes: { ...FOUND, found: false, mentioned: [] } })).not.toContain('In the official notes:')
    })
  })
})
