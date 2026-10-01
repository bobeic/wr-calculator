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
  ],
  carriedStale: [{ kind: 'champion', id: 'ambessa', name: 'Ambessa', since: '7.2' }],
  items: [], champions: [
    { kind: 'champion', id: 'annie', name: 'Annie', goldens: ['annie-q.json'], changes: [{ field: 'stats.ad', before: 'Lv1 52', after: 'Lv1 55' }] },
  ],
  added: [{ kind: 'item', id: 'new-item', name: 'New Item' }], removed: [],
  mapperNotes: { added: [{ subject: 'item x', note: 'n' }], removed: [] },
}

describe('renderPatchDiff', () => {
  const report = renderPatchDiff(DIFF)

  it('puts the sections in order', () => {
    const order = ['# Patch diff: 7.3 → 7.3a', '## Needs review', '## Still stale from earlier patches',
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
    expect(report).toContain('- 2 hand-modelled entries need review')
    expect(report).toContain('- 0 items and 1 champions changed, 1 added, 0 removed')
    expect(report).toContain('- champion ambessa (Ambessa), stale since 7.2')
  })
})
