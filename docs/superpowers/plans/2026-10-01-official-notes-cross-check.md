# Official Notes Cross-Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `patch:update` fetch and parse the official Wild Rift patch notes, then use them to
auto-clear wrpocket-only review flags, flag notes-only changes, and report which notes changes
wrpocket's data already shows.

**Architecture:** There are pure units in `packages/data/scripts/official-notes/`: `url`, `parse`,
`match`, `cross-check` and `render`. `buildPatchDiff` calls the cross-check, and `patch-update.ts` does
the I/O (fetch, cache, committed notes snapshot). The results reach the dataset through a generated
`generated/notes-review.ts`, which each patch's `layer.ts` merges into `reviewed` and `changedIds`. The
overlay itself doesn't change.

**Tech Stack:** TypeScript (strict), Node 22 `fetch`, vitest, tsx, zod (already used in scripts). No new
dependencies: HTML is handled with regex, because the page's content is a known JSON-embedded CMS
shape.

**Spec:** `docs/superpowers/specs/2026-10-01-official-notes-cross-check-design.md`. Read it first.

## Global Constraints

- Notes URL: `https://wildrift.leagueoflegends.com/en-us/news/game-updates/wild-rift-patch-notes-<id>/`,
  with the dots in the patch id replaced by dashes.
- Excluded-section keywords, matched case-folded against the nearest `<h2>`/`<h3>`: `game mode`,
  `adventure`, `aram`, `bug fix`, `system`, `training`, `custom mode`, `battlefest`, `recommendation`,
  `season theme`, `wild pass`.
- Name aliases (normalised notes name → normalised wrpocket name): `lord dominiks regards` →
  `dominiks regards`, `at wits end` → `wits end`, `staff of flowing waters` → `staff of flowing water`.
- The auto-review note text is exactly: `Not in the official <patch> notes (<url>); wrpocket-only change
  to <comma-separated fields>`.
- Flags with severity `removed` are never auto-cleared.
- Fail-loud rules:
  - A page that has no `__NEXT_DATA__`, or no `characterChanges`/`articleRichText` blades, throws.
  - A page with entries that aren't excluded but where nothing matches throws.
  - A 404 means notes are unavailable. Any other HTTP error throws.
- New scripts follow the repo rules:
  - Full type hints.
  - A one-sentence docstring on each exported function.
  - Comments only on non-obvious logic.
  - No dead code.
- Never edit `.env*`. Never hand-edit generated files, except creating 7.3a's first
  `generated/notes-review.ts` from the renderer in Task 5.
- Commit after each task, with a `feat:`/`fix:`/`test:`/`docs:` prefix.

## Review Focus

- **Full-width colons and trailing `。`** in change lines (`Health per level：128 → 136`,
  `Trigger distance: 7 → 11。`). `before`/`after` must not include the label or the trailing mark.
  Pinned in Task 1.
- **Thousands separators** (`3,300`) and percent signs against wrpocket's raw numbers (`attackSpeed: 30`
  for `30%`). The reflected check must call them equal. Pinned in Task 3.
- **Entries with no lines** (an `<h4>` followed only by commentary) must not crash the parser or the
  checks. They count as `no numbers`. Pinned in Tasks 1 and 3.
- **Hand reviews and the auto-clear on the same id:** a hand `reviewed.ts` entry or an override must
  stop the cross-check from also flagging or auto-clearing that id. Pinned in Task 3.
- **A notes heading equal to both an item and a champion name:** the champion blade looks up champions
  only; rich text tries items first. Pinned in Task 2.

---

## File map

| File | Role |
|---|---|
| Create `packages/data/scripts/official-notes/types.ts` | `NotesLine`, `NotesEntry`, `OfficialNotes`, `MatchedEntry`, cross-check result types |
| Create `packages/data/scripts/official-notes/url.ts` | `notesUrl(patch)` |
| Create `packages/data/scripts/official-notes/parse.ts` | `parseNotesPage(html, patch, url)` |
| Create `packages/data/scripts/official-notes/match.ts` | `normaliseName`, `matchNotes(notes, snapshot)` |
| Create `packages/data/scripts/official-notes/cross-check.ts` | `crossCheckNotes(input)` |
| Create `packages/data/scripts/official-notes/render.ts` | `renderNotesSection(check)`, `renderNotesReview(check, patch)` |
| Modify `packages/data/scripts/patch/types.ts` | `Flag.severity` gains `'notes'`; `PatchDiff.officialNotes` |
| Modify `packages/data/scripts/patch/patch-diff.ts` | `buildPatchDiff` runs the cross-check |
| Modify `packages/data/scripts/patch/render-diff.ts` | Renders the notes section and labels "Needs review" entries |
| Modify `packages/data/scripts/patch/scaffold.ts` | The `layer.ts` template merges `NOTES_REVIEWED`/`NOTES_FLAGGED` |
| Modify `packages/data/src/patches/7.3a/layer.ts` | The same merge, edited by hand once |
| Create `packages/data/src/patches/7.3a/generated/notes-review.ts` | Rendered by `renderNotesReview` (empty at first, regenerated in Task 7) |
| Modify `packages/data/scripts/patch-update.ts` | `--notes-url`, notes fetch/cache/snapshot, `notes-review.ts`, meta fix |
| Create `packages/data/snapshots/official-notes/7.3a.json` | Written by the Task 7 run |
| Modify `packages/data/tsconfig.scripts.json` | Include `test/official-notes` |
| Tests: `packages/data/test/official-notes/*.test.ts` | One file per unit |
| Fixtures (already committed): `packages/data/test/fixtures/official-notes/7.3.html`, `7.3a.html` | Trimmed `__NEXT_DATA__` pages |
| Modify `README.md`, `docs/decisions/2026-10-01-patch-overlay-and-snapshots.md` | Docs |

Run tests from the repo root with `pnpm --filter @wr-calc/data exec vitest run <path>`, the full suite
with `pnpm test`, and types with `pnpm typecheck`.

---

### Task 1: Notes types, URL and page parser

**Files:**
- Create: `packages/data/scripts/official-notes/types.ts`
- Create: `packages/data/scripts/official-notes/url.ts`
- Create: `packages/data/scripts/official-notes/parse.ts`
- Modify: `packages/data/tsconfig.scripts.json` (add `"test/official-notes"` to `include`)
- Test: `packages/data/test/official-notes/parse.test.ts`

**Interfaces:**
- Produces:
  - `notesUrl(patch: string): string`
  - `parseNotesPage(html: string, patch: string, url: string): OfficialNotes`
  - `parseChangeLine(text: string): { before: string | null; after: string | null }`
  - `htmlToText(html: string): string`
  - the types below.

- [ ] **Step 1: Write the types (no test needed; they are exercised by Step 2's tests)**

`packages/data/scripts/official-notes/types.ts`:

```ts
import type { EntryRef } from '../patch/types'

/** One bullet from the notes, e.g. 'Price: 3200 → 3300'. */
export interface NotesLine {
  /** The sub-group it sits under: 'Base Stats', 'Flurry', or a champion ability title. */
  group: string | null
  text: string
  /** Split from 'Label: before → after'; null when the line has no arrow. */
  before: string | null
  after: string | null
}

/** One heading's worth of changes: a champion card or an <h4> section. */
export interface NotesEntry {
  source: 'champion-blade' | 'rich-text'
  /** The nearest <h2>/<h3> heading text; '' for champion blades. */
  section: string
  /** True inside a game-mode, system or bug-fix section: mode-only changes, never a mention. */
  excluded: boolean
  heading: string
  lines: NotesLine[]
}

/** A parsed official patch notes page. */
export interface OfficialNotes {
  patch: string
  url: string
  title: string
  published: string
  entries: NotesEntry[]
}

/** A notes entry with the item or champion it names; ref is null when unmatched or excluded. */
export interface MatchedEntry extends NotesEntry {
  ref: EntryRef | null
}
```

- [ ] **Step 2: Write the failing tests**

`packages/data/test/official-notes/parse.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { htmlToText, parseChangeLine, parseNotesPage } from '../../scripts/official-notes/parse'
import { notesUrl } from '../../scripts/official-notes/url'

const fixture = (patch: string): string =>
  readFileSync(new URL(`../fixtures/official-notes/${patch}.html`, import.meta.url), 'utf-8')

describe('notesUrl', () => {
  it('turns dots into dashes', () => {
    expect(notesUrl('7.3a')).toBe('https://wildrift.leagueoflegends.com/en-us/news/game-updates/wild-rift-patch-notes-7-3a/')
  })
})

describe('htmlToText', () => {
  it('strips tags, decodes entities and collapses whitespace', () => {
    expect(htmlToText('<meta>Diadem of Songs&nbsp; <i>x</i> &amp; Kai&#39;Sa &#x2019;')).toBe("Diadem of Songs x & Kai'Sa ’")
  })
})

describe('parseChangeLine', () => {
  it.each([
    ['Price: 3200 → 3300', '3200', '3300'],
    ['3200 → 3300', '3200', '3300'],
    ['Armor and Magic Resistance gained after a plate falls: 30→20', '30', '20'],
    ['Health per level：128 → 136', '128', '136'],
    ['Trigger distance: 7 → 11。', '7', '11'],
    ['Health Restored: 3% - 4.5% + 0.5% Ability Power -> 4.5% - 6% + 0.2% Ability Power', '3% - 4.5% + 0.5% Ability Power', '4.5% - 6% + 0.2% Ability Power'],
    ['Armor per level：5 → 5.5', '5', '5.5'],
  ])('splits %j', (text, before, after) => {
    expect(parseChangeLine(text)).toEqual({ before, after })
  })

  it('returns nulls for a line with no arrow', () => {
    expect(parseChangeLine('[New] Tenacity: 20%')).toEqual({ before: null, after: null })
  })
})

describe('parseNotesPage on 7.3a', () => {
  const notes = parseNotesPage(fixture('7.3a'), '7.3a', 'https://example.test/7-3a')

  it('reads the masthead', () => {
    expect(notes).toMatchObject({ patch: '7.3a', url: 'https://example.test/7-3a', title: 'Wild Rift Patch Notes 7.3a', published: '2026-09-29T09:00:00.000Z' })
  })

  it('reads champion cards with ability titles as groups', () => {
    const hwei = notes.entries.find((entry) => entry.heading === 'HWEI')
    expect(hwei).toMatchObject({ source: 'champion-blade', section: '', excluded: false })
    expect(hwei?.lines[0].group).toBe('Signature of the Visionary')
    expect(notes.entries.filter((entry) => entry.source === 'champion-blade')).toHaveLength(12)
  })

  it('reads item entries under ITEMS with their groups', () => {
    const yunTal = notes.entries.find((entry) => entry.heading === 'Yun Tal Wildarrows')
    expect(yunTal).toMatchObject({ source: 'rich-text', section: 'ITEMS', excluded: false })
    expect(yunTal?.lines).toEqual([
      { group: 'Base Stats', text: 'Attack Speed: 25% → 35%', before: '25%', after: '35%' },
      { group: 'Flurry', text: 'Attack Speed: 25% → 35%', before: '25%', after: '35%' },
      { group: 'Flurry', text: 'Cooldown: 20s → 25s', before: '20s', after: '25s' },
    ])
    expect(notes.entries.find((entry) => entry.heading === "Death's Dance")?.lines.map((line) => line.after)).toEqual(['3300'])
  })

  it('trims entity padding from headings', () => {
    expect(notes.entries.map((entry) => entry.heading)).toContain('Diadem of Songs')
  })

  it('marks game-mode entries excluded', () => {
    const excluded = notes.entries.filter((entry) => entry.excluded).map((entry) => entry.heading)
    expect(excluded).toEqual(['Augment Adjustments', 'Champion Adjustment'])
  })

  it('has 18 entries in all', () => {
    expect(notes.entries).toHaveLength(18)
  })
})

describe('parseNotesPage on 7.3', () => {
  const notes = parseNotesPage(fixture('7.3'), '7.3', 'https://example.test/7-3')

  it('reads several rich-text and champion blades in page order', () => {
    expect(notes.entries).toHaveLength(197)
    expect(notes.entries.filter((entry) => entry.excluded)).toHaveLength(23)
  })

  it('treats a wholly italic paragraph as a group header and skips commentary', () => {
    const lastWhisper = notes.entries.find((entry) => entry.heading === 'Last Whisper')
    expect(lastWhisper?.lines[0]).toEqual({ group: 'Base Stats', text: '[New] Build Path: Long Sword (500) + 700', before: null, after: null })
    const zeal = notes.entries.find((entry) => entry.heading === 'Zeal')
    expect(zeal?.lines).toEqual([{ group: 'Base Stats', text: 'Movement Speed: 5% → 4%', before: '5%', after: '4%' }])
  })
})

describe('parseNotesPage errors', () => {
  it('throws without __NEXT_DATA__', () => {
    expect(() => parseNotesPage('<html></html>', '7.3a', 'u')).toThrow(/no __NEXT_DATA__/)
  })

  it('throws when no change blades are present', () => {
    const page = '<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"page":{"blades":[{"type":"riotbar"}]}}}}</script>'
    expect(() => parseNotesPage(page, '7.3a', 'u')).toThrow(/no change blades/)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @wr-calc/data exec vitest run test/official-notes/parse.test.ts`
Expected: FAIL, because the `../../scripts/official-notes/parse` module is missing.

- [ ] **Step 4: Implement `url.ts` and `parse.ts`**

`packages/data/scripts/official-notes/url.ts`:

```ts
/** The official notes page URL for a patch id, e.g. 7.3a -> .../wild-rift-patch-notes-7-3a/. */
export function notesUrl(patch: string): string {
  return `https://wildrift.leagueoflegends.com/en-us/news/game-updates/wild-rift-patch-notes-${patch.replace(/\./g, '-')}/`
}
```

`packages/data/scripts/official-notes/parse.ts`:

```ts
import { z } from 'zod'
import type { NotesEntry, NotesLine, OfficialNotes } from './types'

const EXCLUDED_KEYWORDS = [
  'game mode', 'adventure', 'aram', 'bug fix', 'system', 'training', 'custom mode', 'battlefest',
  'recommendation', 'season theme', 'wild pass',
]

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", rsquo: '’', lsquo: '‘',
  rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…',
}

const BladeSchema = z.object({ type: z.string().optional() }).passthrough()
const NextDataSchema = z.object({
  props: z.object({ pageProps: z.object({ page: z.object({ blades: z.array(BladeSchema) }) }) }),
})
const MastheadSchema = z.object({ title: z.string(), publishDate: z.string() }).passthrough()
const RichTextSchema = z.object({ richText: z.object({ body: z.string() }).passthrough() }).passthrough()
const CharacterChangesSchema = z.object({
  characters: z.array(z.object({
    character: z.object({ name: z.string() }).passthrough(),
    changes: z.array(z.object({
      title: z.string().nullable().optional(),
      description: z.object({ body: z.string() }).passthrough().optional(),
    }).passthrough()),
  }).passthrough()),
}).passthrough()

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const point = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return String.fromCodePoint(point)
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match
  })
}

/** Turns an HTML fragment into plain text: tags removed, entities decoded, whitespace collapsed. */
export function htmlToText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, '')).replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
}

// 'Label: before → after', with an optional half- or full-width colon label, either arrow, and an
// optional trailing full stop (the notes sometimes end lines with '。').
const CHANGE_LINE_RE = /^(?:(.*?)[:：]\s*)?(.+?)\s*(?:→|->)\s*(.+?)[。.]?$/

/** Splits a change line into its before and after values; nulls when it has no arrow. */
export function parseChangeLine(text: string): { before: string | null; after: string | null } {
  const match = CHANGE_LINE_RE.exec(text)
  if (match === null) return { before: null, after: null }
  return { before: match[2].trim(), after: match[3].trim() }
}

function line(group: string | null, html: string): NotesLine {
  const text = htmlToText(html)
  return { group, text, ...parseChangeLine(text) }
}

const listItems = (html: string): string[] => [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((match) => match[1])

const isExcluded = (heading: string): boolean => {
  const folded = heading.toLowerCase()
  return EXCLUDED_KEYWORDS.some((keyword) => folded.includes(keyword))
}

// A <p> starts a sub-group when it ends in a colon or is wholly italic/bold; other paragraphs are commentary.
const groupHeader = (html: string): string | null => {
  const text = htmlToText(html)
  if (/[:：]$/.test(text)) return text.replace(/[:：]$/, '').trim()
  if (/^\s*<(i|em|b|strong)>[\s\S]*<\/\1>\s*$/.test(html)) return text
  return null
}

/** Parses an official notes page's embedded __NEXT_DATA__ into entries; throws if the layout drifted. */
export function parseNotesPage(html: string, patch: string, url: string): OfficialNotes {
  const script = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html)
  if (script === null) throw new Error(`${url}: no __NEXT_DATA__ script; the notes page layout has changed`)
  const blades = NextDataSchema.parse(JSON.parse(script[1])).props.pageProps.page.blades
  if (!blades.some((blade) => blade.type === 'characterChanges' || blade.type === 'articleRichText')) {
    throw new Error(`${url}: no change blades (characterChanges / articleRichText); the notes page layout has changed`)
  }
  let title = ''
  let published = ''
  const entries: NotesEntry[] = []
  // Section state carries across rich-text blades: a page's <h2>/<h3> structure spans several of them.
  let h2 = ''
  let h3 = ''
  for (const blade of blades) {
    if (blade.type === 'articleMasthead') {
      const masthead = MastheadSchema.parse(blade)
      title = masthead.title
      published = masthead.publishDate
    } else if (blade.type === 'characterChanges') {
      for (const { character, changes } of CharacterChangesSchema.parse(blade).characters) {
        entries.push({
          source: 'champion-blade', section: '', excluded: false, heading: htmlToText(character.name),
          lines: changes.flatMap((change) => listItems(change.description?.body ?? '')
            .map((item) => line(change.title === null || change.title === undefined ? null : htmlToText(change.title), item))),
        })
      }
    } else if (blade.type === 'articleRichText') {
      let current: NotesEntry | null = null
      let group: string | null = null
      for (const match of RichTextSchema.parse(blade).richText.body.matchAll(/<(h2|h3|h4|p|li)[^>]*>([\s\S]*?)<\/\1>/g)) {
        const [, tag, inner] = match
        if (tag === 'h2') {
          h2 = htmlToText(inner)
          h3 = ''
          current = null
        } else if (tag === 'h3') {
          h3 = htmlToText(inner)
          current = null
        } else if (tag === 'h4') {
          current = {
            source: 'rich-text', section: h3 || h2, excluded: isExcluded(h2) || isExcluded(h3),
            heading: htmlToText(inner), lines: [],
          }
          entries.push(current)
          group = null
        } else if (tag === 'p') {
          group = groupHeader(inner) ?? group
        } else if (current !== null) {
          current.lines.push(line(group, inner))
        }
      }
    }
  }
  return { patch, url, title, published, entries }
}
```

Note: the `<li>` regex in the rich-text loop matches `<li>` elements directly, because `<ul>` isn't in the
tag list. A `<p>` inside a `<li>` doesn't occur on either fixture page.

- [ ] **Step 5: Add `"test/official-notes"` to `include` in `packages/data/tsconfig.scripts.json`**

```json
  "include": ["scripts", "test/wrpocket", "test/patch", "test/official-notes"]
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter @wr-calc/data exec vitest run test/official-notes/parse.test.ts`
Expected: PASS. The counts 197/23/18 were measured with a prototype of exactly these rules. If a count
differs, debug the parser against the fixture. Don't edit the expected number.

- [ ] **Step 7: Typecheck and commit**

Run: `pnpm typecheck`
Expected: no errors.

```bash
git add packages/data/scripts/official-notes packages/data/test/official-notes packages/data/tsconfig.scripts.json
git commit -m "feat: parse official Wild Rift patch notes pages"
```

---

### Task 2: Match notes entries to item and champion ids

**Files:**
- Create: `packages/data/scripts/official-notes/match.ts`
- Test: `packages/data/test/official-notes/match.test.ts`

**Interfaces:**
- Consumes:
  - `OfficialNotes`, `MatchedEntry` (Task 1).
  - `Snapshot` from `packages/data/scripts/patch/snapshot.ts`. Each `items[]`/`champions[]` entry has an
    `id` and a `name.en`.
- Produces:
  - `normaliseName(name: string): string`
  - `matchNotes(notes: OfficialNotes, snapshot: Snapshot): MatchedEntry[]`. It keeps the same order and
    length as `notes.entries`.

- [ ] **Step 1: Write the failing tests**

`packages/data/test/official-notes/match.test.ts`:

```ts
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
    expect(normaliseName("Serylda's  Grudge&nbsp;")).toBe('seryldas grudge')
    expect(normaliseName('Nunu & Willump')).toBe('nunu willump')
    expect(normaliseName('HWEI')).toBe('hwei')
  })
})

describe('matchNotes', () => {
  const snap = snapshot([['seryldas-grudge', 'Serylda’s Grudge'], ['dominiks-regards', 'Dominik’s Regards'], ['viego', 'Viego']], [['viego', 'Viego'], ['hwei', 'Hwei']])

  it('matches curly-quoted items and upper-case champion cards', () => {
    const matched = matchNotes(notes([
      { heading: "Serylda's Grudge" },
      { heading: 'HWEI', source: 'champion-blade', section: '' },
    ]), snap)
    expect(matched.map((entry) => entry.ref)).toEqual([
      { kind: 'item', id: 'seryldas-grudge', name: 'Serylda’s Grudge' },
      { kind: 'champion', id: 'hwei', name: 'Hwei' },
    ])
  })

  it('uses the alias table', () => {
    expect(matchNotes(notes([{ heading: "Lord Dominik's Regards" }]), snap)[0].ref?.id).toBe('dominiks-regards')
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @wr-calc/data exec vitest run test/official-notes/match.test.ts`
Expected: FAIL, because the `match` module is missing.

- [ ] **Step 3: Implement `match.ts`**

```ts
import type { Snapshot } from '../patch/snapshot'
import type { EntryRef } from '../patch/types'
import { htmlToText } from './parse'
import type { MatchedEntry, OfficialNotes } from './types'

// Known naming differences between the notes and wrpocket, by normalised name.
const ALIASES: Record<string, string> = {
  'lord dominiks regards': 'dominiks regards',
  'at wits end': 'wits end',
  'staff of flowing waters': 'staff of flowing water',
}

/** Normalises a display name for matching: case, quotes, entities and punctuation folded away. */
export function normaliseName(name: string): string {
  return htmlToText(name).toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

function index(kind: EntryRef['kind'], entries: Array<{ id: string; name: { en: string } }>): Map<string, EntryRef> {
  return new Map(entries.map((entry) => [normaliseName(entry.name.en), { kind, id: entry.id, name: entry.name.en }]))
}

/** Pairs each notes entry with the item or champion it names in the snapshot, or null. */
export function matchNotes(notes: OfficialNotes, snapshot: Snapshot): MatchedEntry[] {
  const items = index('item', snapshot.items)
  const champions = index('champion', snapshot.champions)
  return notes.entries.map((entry) => {
    if (entry.excluded) return { ...entry, ref: null }
    const name = normaliseName(entry.heading)
    const key = ALIASES[name] ?? name
    const ref = entry.source === 'champion-blade' ? champions.get(key) : items.get(key) ?? champions.get(key)
    return { ...entry, ref: ref ?? null }
  })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @wr-calc/data exec vitest run test/official-notes/match.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/data/scripts/official-notes/match.ts packages/data/test/official-notes/match.test.ts
git commit -m "feat: match official notes entries to item and champion ids"
```

---

### Task 3: Cross-check notes against the wrpocket diff

**Files:**
- Modify: `packages/data/scripts/official-notes/types.ts` (append the result types)
- Modify: `packages/data/scripts/patch/types.ts` (change `Flag.severity` to `'removed' | 'changed' | 'notes'`)
- Create: `packages/data/scripts/official-notes/cross-check.ts`
- Test: `packages/data/test/official-notes/cross-check.test.ts`

**Interfaces:**
- Consumes:
  - From Task 2: `matchNotes`.
  - From `scripts/patch/patch-diff.ts`: `flagHandModelled(diff, handModelled, covered, goldens): Flag[]`,
    `goldensUsing(ref, goldens): string[]` and `GoldenRef`.
  - `ReviewedEntry` from `src/patches/overlay.ts`, with fields `{ kind, id, note }`.
  - `diffSnapshots(before, after): SnapshotDiff` from `scripts/patch/diff.ts`.
- Produces:
  - `crossCheckNotes(input: CrossCheckInput): NotesCrossCheck`
  - `numberTokens(text: string): string[]`
  - The types below. Task 4 consumes `NotesCrossCheck.autoReviewed`, `.notesFlags`, `.mentioned`,
    `.unmatched`, `.excludedCount`, `.found`, `.url` and `.published`.

- [ ] **Step 1: Append the result types to `official-notes/types.ts`, and widen `Flag.severity` in `patch/types.ts`**

Append to `packages/data/scripts/official-notes/types.ts`:

```ts
import type { ReviewedEntry } from '../../src/patches/overlay'
import type { Flag } from '../patch/types'

/** Whether a notes line's new numbers appear in wrpocket's record for that entry. */
export type LineStatus = 'reflected' | 'not found' | 'no numbers'
export type EntryStatus = 'reflected' | 'partly' | 'not in wrpocket' | 'no numbers'

export interface CheckedLine extends NotesLine {
  status: LineStatus
}

/** A matched notes entry with its reflected status. */
export interface CheckedEntry {
  ref: EntryRef
  heading: string
  status: EntryStatus
  lines: CheckedLine[]
}

/** Everything the notes cross-check found for one patch. */
export interface NotesCrossCheck {
  url: string
  /** False when the page wasn't found; nothing is auto-cleared then. */
  found: boolean
  published: string | null
  /** Flagged entries the notes don't mention, cleared as wrpocket-only changes. */
  autoReviewed: ReviewedEntry[]
  /** Hand-modelled entries the notes change but wrpocket didn't. */
  notesFlags: Flag[]
  mentioned: CheckedEntry[]
  unmatched: Array<{ section: string; heading: string }>
  excludedCount: number
}
```

Put the two new `import type` lines at the top of the file, next to the existing import.

In `packages/data/scripts/patch/types.ts`, replace the `Flag` interface with:

```ts
/** A hand-modelled entry that needs review in this patch; 'notes' = changed in the official notes only. */
export interface Flag extends EntryRef {
  severity: 'removed' | 'changed' | 'notes'
  changes: FieldChange[]
  goldens: string[]
}
```

- [ ] **Step 2: Write the failing tests**

`packages/data/test/official-notes/cross-check.test.ts`:

```ts
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

function notes(entries: Array<{ heading: string; lines?: Array<{ text: string; after: string | null }> }>): OfficialNotes {
  return {
    patch: '9.9', url: 'https://example.test/9-9', title: '', published: '2026-01-01T00:00:00.000Z',
    entries: entries.map(({ heading, lines = [] }) => ({
      source: 'rich-text', section: 'ITEMS', excluded: false, heading,
      lines: lines.map(({ text, after }) => ({ group: null, text, before: after === null ? null : 'x', after })),
    })),
  }
}

const NONE = { items: [], champions: [] }

function run(before: Snapshot, after: Snapshot, notesOrNull: OfficialNotes | null, handItems: string[], coveredItems: string[] = []) {
  const diff = diffSnapshots(before, after)
  const handModelled = { items: handItems, champions: [] }
  const covered = { items: coveredItems, champions: [] }
  return crossCheckNotes({
    patch: '9.9', url: 'https://example.test/9-9', notes: notesOrNull, after, diff,
    flags: flagHandModelled(diff, handModelled, covered, []), handModelled, covered, goldens: [],
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
    const check = crossCheckNotes({ patch: '7.3a', url: notes73a.url, notes: notes73a, after: after73a, diff, flags, handModelled, covered: NONE, goldens: [] })
    expect(check.autoReviewed).toHaveLength(30)
    const cleared = new Set(check.autoReviewed.map((entry) => entry.id))
    expect(flags.filter((flag) => !cleared.has(flag.id)).map((flag) => flag.id)).toEqual(['deaths-dance'])
    expect(check.notesFlags).toEqual([])
    expect(check.mentioned.find((entry) => entry.ref.id === 'deaths-dance')?.status).toBe('reflected')
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @wr-calc/data exec vitest run test/official-notes/cross-check.test.ts`
Expected: FAIL, because the `cross-check` module is missing.

- [ ] **Step 4: Implement `cross-check.ts`**

```ts
import type { ReviewedEntry } from '../../src/patches/overlay'
import { goldensUsing } from '../patch/patch-diff'
import type { GoldenRef } from '../patch/patch-diff'
import type { Snapshot } from '../patch/snapshot'
import type { EntryRef, Flag, IdLists, SnapshotDiff } from '../patch/types'
import { matchNotes } from './match'
import type { CheckedEntry, CheckedLine, EntryStatus, NotesCrossCheck, OfficialNotes } from './types'

export interface CrossCheckInput {
  patch: string
  url: string
  /** null when the notes page wasn't found. */
  notes: OfficialNotes | null
  after: Snapshot
  diff: SnapshotDiff
  /** The wrpocket-based flags from flagHandModelled. */
  flags: Flag[]
  handModelled: IdLists
  covered: IdLists
  goldens: GoldenRef[]
}

const refKey = (ref: { kind: string; id: string }): string => `${ref.kind}\u0000${ref.id}`
const listFor = (lists: IdLists, kind: EntryRef['kind']): string[] => (kind === 'item' ? lists.items : lists.champions)

/** The numbers in a text, with thousands separators and percent signs removed: '3,300 and 25%' -> ['3300', '25']. */
export function numberTokens(text: string): string[] {
  return (text.replace(/(\d),(\d{3})/g, '$1$2').match(/\d+(?:\.\d+)?/g) ?? [])
}

function recordNumbers(after: Snapshot, ref: EntryRef): Set<string> {
  const record = ref.kind === 'item'
    ? after.items.find((entry) => entry.id === ref.id)
    : after.champions.find((entry) => entry.id === ref.id)
  return new Set(record === undefined ? [] : numberTokens(JSON.stringify(record)))
}

function entryStatus(lines: CheckedLine[]): EntryStatus {
  const numeric = lines.filter((line) => line.status !== 'no numbers')
  if (numeric.length === 0) return 'no numbers'
  const reflected = numeric.filter((line) => line.status === 'reflected').length
  if (reflected === numeric.length) return 'reflected'
  return reflected === 0 ? 'not in wrpocket' : 'partly'
}

/** Compares the official notes with the wrpocket diff: auto-clears, notes-only flags and reflected status. */
export function crossCheckNotes(input: CrossCheckInput): NotesCrossCheck {
  if (input.notes === null) {
    return { url: input.url, found: false, published: null, autoReviewed: [], notesFlags: [], mentioned: [], unmatched: [], excludedCount: 0 }
  }
  const matched = matchNotes(input.notes, input.after)
  const included = matched.filter((entry) => !entry.excluded)
  if (included.length > 0 && included.every((entry) => entry.ref === null)) {
    throw new Error(`${input.url}: none of its ${included.length} entries matched an item or champion; the names or the page layout have drifted`)
  }
  const mentioned: CheckedEntry[] = included.flatMap((entry) => {
    if (entry.ref === null) return []
    const numbers = recordNumbers(input.after, entry.ref)
    const lines: CheckedLine[] = entry.lines.map((line) => {
      const wanted = line.after === null ? [] : numberTokens(line.after)
      if (wanted.length === 0) return { ...line, status: 'no numbers' }
      return { ...line, status: wanted.every((number) => numbers.has(number)) ? 'reflected' : 'not found' }
    })
    return [{ ref: entry.ref, heading: entry.heading, status: entryStatus(lines), lines }]
  })
  const mentionedKeys = new Set(mentioned.map((entry) => refKey(entry.ref)))
  const changedKeys = new Set([...input.diff.items, ...input.diff.champions, ...input.diff.removed].map(refKey))
  const isCovered = (ref: EntryRef): boolean => listFor(input.covered, ref.kind).includes(ref.id)

  const autoReviewed: ReviewedEntry[] = input.flags
    .filter((flag) => flag.severity === 'changed' && !mentionedKeys.has(refKey(flag)))
    .map((flag) => ({
      kind: flag.kind, id: flag.id,
      note: `Not in the official ${input.patch} notes (${input.url}); wrpocket-only change to ${[...new Set(flag.changes.map((change) => change.field))].join(', ')}`,
    }))
  const seen = new Set<string>()
  const notesFlags: Flag[] = mentioned
    .map((entry) => entry.ref)
    .filter((ref) => {
      const key = refKey(ref)
      if (seen.has(key)) return false
      seen.add(key)
      return listFor(input.handModelled, ref.kind).includes(ref.id) && !isCovered(ref) && !changedKeys.has(key)
    })
    .map((ref) => ({ ...ref, severity: 'notes', changes: [], goldens: goldensUsing(ref, input.goldens) }))

  return {
    url: input.url,
    found: true,
    published: input.notes.published,
    autoReviewed,
    notesFlags,
    mentioned,
    unmatched: included.filter((entry) => entry.ref === null).map((entry) => ({ section: entry.section, heading: entry.heading })),
    excludedCount: matched.length - included.length,
  }
}
```

A champion can appear in several champion blades (7.3 lists some twice), so `seen` keeps each notes
flag unique. Auto-cleared flags need no extra covered check: `flagHandModelled` already left out
covered ids.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @wr-calc/data exec vitest run test/official-notes/cross-check.test.ts`
Expected: PASS. If the 7.3a acceptance test reports fewer than 30, print which flags were "mentioned"
and fix the matching or parsing. Don't edit the expectation: 30 is the outcome established by hand on
2026-10-01.

- [ ] **Step 6: Run the patch tests (the severity union widened) and typecheck, then commit**

Run: `pnpm --filter @wr-calc/data exec vitest run test/patch test/official-notes && pnpm typecheck`
Expected: PASS, with no type errors.

```bash
git add packages/data/scripts/official-notes packages/data/scripts/patch/types.ts packages/data/test/official-notes/cross-check.test.ts
git commit -m "feat: cross-check official notes against the wrpocket diff"
```

---

### Task 4: Report: wire the cross-check into the patch diff and PATCH_DIFF.md

**Files:**
- Modify: `packages/data/scripts/patch/types.ts` (`PatchDiff` gains `officialNotes: NotesCrossCheck | null`)
- Modify: `packages/data/scripts/patch/patch-diff.ts` (`BuildPatchDiffInput` gains `notes`; `buildPatchDiff` calls `crossCheckNotes`)
- Create: `packages/data/scripts/official-notes/render.ts` (only `renderNotesSection` in this task)
- Modify: `packages/data/scripts/patch/render-diff.ts`
- Test: `packages/data/test/official-notes/render.test.ts`
- Modify: `packages/data/test/patch/render-diff.test.ts` and `packages/data/test/patch/patch-diff.test.ts`
  (add `officialNotes: null` / `notes: null` to their fixtures, plus new assertions)

**Interfaces:**
- Consumes: `crossCheckNotes`, `NotesCrossCheck` and `OfficialNotes` (Tasks 1 and 3).
- Produces:
  - `BuildPatchDiffInput.notes: { url: string; notes: OfficialNotes | null } | null`. `null` means no
    notes stage ran (the bootstrap path, or old tests).
  - `PatchDiff.officialNotes: NotesCrossCheck | null`.
  - `PatchDiff.needsReview` holds the wrpocket flags minus the auto-reviewed ones, plus `notesFlags`.
  - `renderNotesSection(check: NotesCrossCheck | null): string[]`

- [ ] **Step 1: Write the failing render tests**

`packages/data/test/official-notes/render.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @wr-calc/data exec vitest run test/official-notes/render.test.ts`
Expected: FAIL, because the `render` module is missing.

- [ ] **Step 3: Implement `renderNotesSection` in `official-notes/render.ts`**

```ts
import type { NotesCrossCheck } from './types'

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`

/** Renders the PATCH_DIFF.md "Official notes cross-check" section; [] when no notes stage ran. */
export function renderNotesSection(check: NotesCrossCheck | null): string[] {
  if (check === null) return []
  const heading = ['## Official notes cross-check', '']
  if (!check.found) return [...heading, `Official notes not found at ${check.url}; nothing auto-cleared (use --notes-url).`, '']
  return [
    ...heading,
    `From the [official notes](${check.url}), published ${(check.published ?? '').slice(0, 10)}.`, '',
    `- ${plural(check.autoReviewed.length, 'flag', 'flags')} auto-cleared as wrpocket-only`,
    `- ${plural(check.notesFlags.length, 'hand-modelled entry', 'hand-modelled entries')} changed in the notes but not in wrpocket`,
    `- ${check.mentioned.length} notes entries matched, ${check.unmatched.length} unmatched, ${check.excludedCount} game-mode / system entries skipped`, '',
    '"Reflected" means every number in a line\'s new value appears somewhere in wrpocket\'s record for that '
      + 'entry. It is a heuristic for spotting wrpocket lagging behind the notes; it never clears a flag.', '',
    '### Auto-cleared', '',
    ...(check.autoReviewed.length === 0 ? ['None.'] : check.autoReviewed.map((entry) => `- ${entry.kind} ${entry.id}: ${entry.note}`)), '',
    '### Matched notes entries', '',
    ...(check.mentioned.length === 0 ? ['None.'] : check.mentioned.flatMap((entry) => [
      `- ${entry.ref.kind} ${entry.ref.id} (${entry.ref.name}): ${entry.status}`,
      ...entry.lines.map((line) => `  - ${line.group === null ? '' : `${line.group}: `}${line.text} (${line.status})`),
    ])), '',
    '### Unmatched notes entries', '',
    ...(check.unmatched.length === 0 ? ['None.'] : check.unmatched.map((entry) => `- ${entry.section || '(champion card)'}: ${entry.heading}`)), '',
  ]
}
```

- [ ] **Step 4: Run the render tests to verify they pass**

Run: `pnpm --filter @wr-calc/data exec vitest run test/official-notes/render.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing integration tests in `test/patch/patch-diff.test.ts` and `test/patch/render-diff.test.ts`**

In `test/patch/render-diff.test.ts`:
- Add `officialNotes: null` to the `DIFF` constant.
- Add a notes flag to `needsReview`:
  `{ severity: 'notes', kind: 'item', id: 'notes-only', name: 'Notes Only', changes: [], goldens: [] }`.
- Add these tests:

```ts
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
```

In `test/patch/patch-diff.test.ts`:
- Add `notes: null` to each of the four existing `buildPatchDiff({...})` inputs (lines ~68, 88, 96 and
  the `result` constant). It is a required field; Step 6 adds it to `BuildPatchDiffInput`.
- Inside `describe('buildPatchDiff', ...)`, add the test below. The file's `before`/`after` snapshots
  already change `trinity-force`'s price. `plain` is named `Long Sword` by `makeRawItem`'s default, so
  a notes entry for "Long Sword" matches something and passes the zero-match guard without mentioning
  Trinity Force:

```ts
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

  it('reports no notes stage when notes is null', () => {
    expect(result.officialNotes).toBeNull()
  })
```

- [ ] **Step 6: Implement the integration**

`packages/data/scripts/patch/types.ts`: add `import type { NotesCrossCheck } from '../official-notes/types'`
and this field on `PatchDiff`:

```ts
  /** The official notes cross-check; null when no notes stage ran. */
  officialNotes: NotesCrossCheck | null
```

`packages/data/scripts/patch/patch-diff.ts`:
- Add the import `import { crossCheckNotes } from '../official-notes/cross-check'` and
  `import type { OfficialNotes } from '../official-notes/types'`.
- Add `notes: { url: string; notes: OfficialNotes | null } | null` to `BuildPatchDiffInput`, with the
  doc comment `/** The official notes for the new patch; null when no notes stage ran. */`.
- In `buildPatchDiff`, after `const flags = ...`:

```ts
  const officialNotes = input.notes === null ? null : crossCheckNotes({
    patch: input.after.meta.patch, url: input.notes.url, notes: input.notes.notes, after: input.after, diff,
    flags, handModelled: input.handModelled, covered: input.covered, goldens: input.goldens,
  })
  const autoCleared = new Set((officialNotes?.autoReviewed ?? []).map((entry) => `${entry.kind}\u0000${entry.id}`))
  const needsReview = [...flags.filter((flag) => !autoCleared.has(`${flag.kind}\u0000${flag.id}`)), ...(officialNotes?.notesFlags ?? [])]
```

- Then use `needsReview` for the `needsReview` field. Use it for the `flagged` set as well, so a
  notes-flagged entry isn't also carried as stale. Add `officialNotes` to the returned object.

`packages/data/scripts/patch/render-diff.ts`:
- Import `renderNotesSection`.
- Change the needs-review heading label to:

```ts
const SEVERITY_LABEL: Record<Flag['severity'], string> = {
  removed: 'removed from wrpocket',
  changed: 'changed',
  notes: 'in the official notes, wrpocket unchanged',
}
```

  and use `${label(flag)}: ${SEVERITY_LABEL[flag.severity]}`.
- Insert `...renderNotesSection(diff.officialNotes),` immediately before `'## Still stale from earlier patches'`.
- Add the `Flag` type import.

- [ ] **Step 7: Run the data package tests and typecheck**

Run: `pnpm --filter @wr-calc/data exec vitest run && pnpm typecheck`
Expected: PASS. `patch-consistency.test.ts` still passes, because the committed 7.3a `patch-diff.json`
is unchanged until Task 7.

- [ ] **Step 8: Commit**

```bash
git add packages/data/scripts packages/data/test
git commit -m "feat: report the official notes cross-check in PATCH_DIFF"
```

---

### Task 5: Generated notes-review module and layer wiring

**Files:**
- Modify: `packages/data/scripts/official-notes/render.ts` (add `renderNotesReview`)
- Modify: `packages/data/scripts/patch/scaffold.ts` (the `layer.ts` template)
- Create: `packages/data/src/patches/7.3a/generated/notes-review.ts`
- Modify: `packages/data/src/patches/7.3a/layer.ts`
- Test: `packages/data/test/official-notes/render.test.ts` (append), and
  `packages/data/test/patch/scaffold.test.ts` (append)

**Interfaces:**
- Consumes: `NotesCrossCheck` (Task 3). `ChangedIds` and `ReviewedEntry` come from `src/patches/overlay.ts`.
- Produces:
  - `renderNotesReview(check: NotesCrossCheck | null, patch: string): string`. It returns the source of
    a module exporting `NOTES_REVIEWED: ReviewedEntry[]` and `NOTES_FLAGGED: ChangedIds`.
  - Every non-root `layer.ts` imports `./generated/notes-review`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/data/test/official-notes/render.test.ts`:

```ts
import { renderNotesReview } from '../../scripts/official-notes/render'

describe('renderNotesReview', () => {
  it('renders auto-reviews and notes flags as a module', () => {
    const source = renderNotesReview(CHECK, '9.9')
    expect(source).toContain("import type { ChangedIds, ReviewedEntry } from '../../overlay'")
    expect(source).toContain('export const NOTES_REVIEWED: ReviewedEntry[] = [')
    expect(source).toContain('"id": "a"')
    expect(source).toContain('export const NOTES_FLAGGED: ChangedIds = {')
    expect(source).toContain('"b"')
  })

  it('renders empty lists when there is no check', () => {
    const source = renderNotesReview(null, '9.9')
    expect(source).toContain('export const NOTES_REVIEWED: ReviewedEntry[] = []')
    expect(source).toContain('export const NOTES_FLAGGED: ChangedIds = {\n  "items": [],\n  "champions": []\n}')
  })
})
```

Move the new import to the top of the file next to the existing one, so there is one import line per
module.

Append to `packages/data/test/patch/scaffold.test.ts`:

```ts
describe('layer.ts template', () => {
  it('merges the generated notes review into reviewed and changedIds', () => {
    const layer = scaffoldFiles('9.9')['layer.ts']
    expect(layer).toContain("import { NOTES_FLAGGED, NOTES_REVIEWED } from './generated/notes-review'")
    expect(layer).toContain('  reviewed: [...REVIEWED, ...NOTES_REVIEWED],')
    expect(layer).toContain('    items: [...CHANGED_IDS.items, ...NOTES_FLAGGED.items],')
  })
})
```

If `scaffoldFiles` isn't imported in that file yet, add it to the existing import from
`../../scripts/patch/scaffold`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @wr-calc/data exec vitest run test/official-notes/render.test.ts test/patch/scaffold.test.ts`
Expected: FAIL, because `renderNotesReview` is missing and the template lacks the merge.

- [ ] **Step 3: Implement `renderNotesReview`**

Append to `official-notes/render.ts`:

```ts
import { GENERATOR_SCRIPT } from '../wrpocket/render'

/** Renders a patch's generated/notes-review.ts from the cross-check; empty lists without one. */
export function renderNotesReview(check: NotesCrossCheck | null, patch: string): string {
  const reviewed = check?.autoReviewed ?? []
  const flags = check?.notesFlags ?? []
  const flagged = {
    items: flags.filter((flag) => flag.kind === 'item').map((flag) => flag.id),
    champions: flags.filter((flag) => flag.kind === 'champion').map((flag) => flag.id),
  }
  const source = check === null || !check.found ? 'no official notes were found' : `the official notes at ${check.url}`
  return [
    `// GENERATED by ${GENERATOR_SCRIPT} from ${source}, for patch ${patch}.`,
    '// NOTES_REVIEWED clears flags the notes do not mention; NOTES_FLAGGED marks entries only the notes changed.',
    "import type { ChangedIds, ReviewedEntry } from '../../overlay'",
    '',
    `export const NOTES_REVIEWED: ReviewedEntry[] = ${JSON.stringify(reviewed, null, 2)}`,
    '',
    `export const NOTES_FLAGGED: ChangedIds = ${JSON.stringify(flagged, null, 2)}`,
    '',
  ].join('\n')
}
```

Move the import to the top of the file.

- [ ] **Step 4: Update the `layer.ts` template in `scaffold.ts`**

Replace the `'layer.ts'` entry's lines with:

```ts
    'layer.ts': [
      "import type { PatchLayer } from '../overlay'",
      "import { CHANGED_IDS } from './generated/changed-ids'",
      "import { GENERATED_CHAMPIONS } from './generated/champions'",
      "import { GENERATED_ITEMS } from './generated/items'",
      "import { NOTES_FLAGGED, NOTES_REVIEWED } from './generated/notes-review'",
      "import { OVERRIDE_CHAMPIONS, OVERRIDE_ITEMS } from './overrides'",
      "import { REVIEWED } from './reviewed'",
      '',
      `/** Patch ${patch}: regenerated wrpocket data over the previous patch's hand-modelled entries. */`,
      'export const PATCH_LAYER: PatchLayer = {',
      `  id: '${patch}',`,
      '  generatedItems: GENERATED_ITEMS,',
      '  generatedChampions: GENERATED_CHAMPIONS,',
      '  overrideItems: OVERRIDE_ITEMS,',
      '  overrideChampions: OVERRIDE_CHAMPIONS,',
      '  reviewed: [...REVIEWED, ...NOTES_REVIEWED],',
      '  changedIds: {',
      '    items: [...CHANGED_IDS.items, ...NOTES_FLAGGED.items],',
      '    champions: [...CHANGED_IDS.champions, ...NOTES_FLAGGED.champions],',
      '  },',
      '}',
      '',
    ].join('\n'),
```

- [ ] **Step 5: Create 7.3a's initial `generated/notes-review.ts` from the renderer, and update 7.3a's `layer.ts` to match the template**

Run from the repo root:

```bash
pnpm --filter @wr-calc/data exec tsx -e "import('./scripts/official-notes/render.ts').then(({ renderNotesReview }) => process.stdout.write(renderNotesReview(null, '7.3a')))" > packages/data/src/patches/7.3a/generated/notes-review.ts
```

Then make `packages/data/src/patches/7.3a/layer.ts` identical to `scaffoldFiles('7.3a')['layer.ts']`.
That is the template from Step 4 with `id: '7.3a'` and the doc comment for patch 7.3a.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS. The 7.3a dataset is unchanged, because the notes lists are empty.

- [ ] **Step 7: Commit**

```bash
git add packages/data/scripts packages/data/src/patches/7.3a packages/data/test
git commit -m "feat: merge a generated notes review into each patch layer"
```

---

### Task 6: Pipeline: fetch, cache and snapshot the notes, write notes-review.ts, keep the meta

**Files:**
- Modify: `packages/data/scripts/patch-update.ts`
- Create: `packages/data/scripts/official-notes/fetch.ts`
- Test: `packages/data/test/official-notes/fetch.test.ts`

**Interfaces:**
- Consumes: `parseNotesPage`, `notesUrl`, `renderNotesReview`, `stableStringify`, and
  `buildPatchDiff`'s new `notes` input.
- Produces:
  - `loadNotes(options: LoadNotesOptions): Promise<OfficialNotes | null>`
  - `NOTES_SNAPSHOT_ROOT = packages/data/snapshots/official-notes`
  - the `--notes-url <url>` CLI flag.

```ts
export interface LoadNotesOptions {
  patch: string
  url: string
  /** Raw page cache file, e.g. .cache/official-notes/7.3a.html */
  cacheFile: string
  /** Committed parsed snapshot, e.g. snapshots/official-notes/7.3a.json */
  snapshotFile: string
  /** --from-cache run: don't fetch unless allowFetch. */
  offline: boolean
  /** True when --notes-url was given: an offline run may fetch then. */
  allowFetch: boolean
  fetchPage: (url: string) => Promise<{ status: number; text: () => Promise<string> }>
}
```

- [ ] **Step 1: Write the failing tests**

`packages/data/test/official-notes/fetch.test.ts`:

```ts
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { loadNotes } from '../../scripts/official-notes/fetch'
import type { LoadNotesOptions } from '../../scripts/official-notes/fetch'

const page = readFileSync(new URL('../fixtures/official-notes/7.3a.html', import.meta.url), 'utf-8')

function options(overrides: Partial<LoadNotesOptions> = {}): LoadNotesOptions {
  const dir = mkdtempSync(join(tmpdir(), 'notes-'))
  return {
    patch: '7.3a', url: 'https://example.test/7-3a', cacheFile: join(dir, 'cache', '7.3a.html'), snapshotFile: join(dir, '7.3a.json'),
    offline: false, allowFetch: false,
    fetchPage: async () => ({ status: 200, text: async () => page }),
    ...overrides,
  }
}

describe('loadNotes', () => {
  it('fetches, parses and caches the page', async () => {
    const opts = options()
    const notes = await loadNotes(opts)
    expect(notes?.entries).toHaveLength(18)
    expect(existsSync(opts.cacheFile)).toBe(true)
  })

  it('returns null on 404', async () => {
    expect(await loadNotes(options({ fetchPage: async () => ({ status: 404, text: async () => '' }) }))).toBeNull()
  })

  it('throws on other HTTP errors', async () => {
    await expect(loadNotes(options({ fetchPage: async () => ({ status: 503, text: async () => '' }) }))).rejects.toThrow(/HTTP 503/)
  })

  it('offline: reads the cache, then the committed snapshot, else null without fetching', async () => {
    const fail = async (): Promise<never> => { throw new Error('must not fetch') }
    const opts = options({ offline: true, fetchPage: fail })
    expect(await loadNotes(opts)).toBeNull()
    writeFileSync(opts.snapshotFile, JSON.stringify({ patch: '7.3a', url: 'u', title: 't', published: 'p', entries: [] }))
    expect((await loadNotes(opts))?.title).toBe('t')
  })

  it('offline with --notes-url: fetches', async () => {
    expect((await loadNotes(options({ offline: true, allowFetch: true })))?.entries).toHaveLength(18)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @wr-calc/data exec vitest run test/official-notes/fetch.test.ts`
Expected: FAIL, because the `fetch` module is missing.

- [ ] **Step 3: Implement `official-notes/fetch.ts`**

```ts
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { z } from 'zod'
import { parseNotesPage } from './parse'
import type { OfficialNotes } from './types'

export interface LoadNotesOptions {
  patch: string
  url: string
  /** Raw page cache file, e.g. .cache/official-notes/7.3a.html */
  cacheFile: string
  /** Committed parsed snapshot, e.g. snapshots/official-notes/7.3a.json */
  snapshotFile: string
  /** --from-cache run: don't fetch unless allowFetch. */
  offline: boolean
  /** True when --notes-url was given: an offline run may fetch then. */
  allowFetch: boolean
  fetchPage: (url: string) => Promise<{ status: number; text: () => Promise<string> }>
}

const NotesLineSchema = z.object({ group: z.string().nullable(), text: z.string(), before: z.string().nullable(), after: z.string().nullable() })
const OfficialNotesSchema = z.object({
  patch: z.string(), url: z.string(), title: z.string(), published: z.string(),
  entries: z.array(z.object({
    source: z.enum(['champion-blade', 'rich-text']), section: z.string(), excluded: z.boolean(), heading: z.string(), lines: z.array(NotesLineSchema),
  })),
})

/** Loads the official notes from the page cache, the committed snapshot or the web; null if not published. */
export async function loadNotes(options: LoadNotesOptions): Promise<OfficialNotes | null> {
  if (existsSync(options.cacheFile)) return parseNotesPage(readFileSync(options.cacheFile, 'utf-8'), options.patch, options.url)
  if (options.offline && !options.allowFetch) {
    if (!existsSync(options.snapshotFile)) return null
    return OfficialNotesSchema.parse(JSON.parse(readFileSync(options.snapshotFile, 'utf-8')))
  }
  const response = await options.fetchPage(options.url)
  if (response.status === 404) return null
  if (response.status < 200 || response.status >= 300) throw new Error(`GET ${options.url} failed: HTTP ${response.status}`)
  const html = await response.text()
  // Parse before caching, so a drifted page never lands in the cache as if it were good.
  const notes = parseNotesPage(html, options.patch, options.url)
  await mkdir(dirname(options.cacheFile), { recursive: true })
  await writeFile(options.cacheFile, html)
  return notes
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @wr-calc/data exec vitest run test/official-notes/fetch.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire it into `patch-update.ts`**

1. `Options` gains `notesUrl: string | null`. `parseArgs` reads `--notes-url <url>` the same way as
   `--from-cache`, throwing `'--notes-url needs a URL'` when the value is missing.
2. Add the constant `const NOTES_SNAPSHOT_ROOT = join(DATA_ROOT, 'snapshots', 'official-notes')`, and
   imports for `loadNotes`, `notesUrl`, `renderNotesReview` and `type { OfficialNotes }`.
3. **Meta fix.** In `run`, replace the `meta` line with:

```ts
  const known = await listSnapshotMetas(SNAPSHOT_ROOT)
  // A cache folder name only carries patch and time; reuse the committed meta (with its sources) when it is the same data.
  const cacheMeta = options.fromCache === null ? null : metaFromCacheDir(options.fromCache)
  const meta: SnapshotMeta = cacheMeta === null
    ? await fetchMeta()
    : known.find((entry) => entry.patch === cacheMeta.patch && entry.updated === cacheMeta.updated) ?? cacheMeta
```

   Remove the now-duplicate `const known = ...` line below it. Change `fetchMeta` to return the raw
   text too:

```ts
/** Fetches meta.json fresh every run: it decides which cache folder is valid. */
async function fetchMeta(): Promise<{ meta: SnapshotMeta; text: string }> {
  const response = await fetch(`${BASE_URL}/meta.json`)
  if (!response.ok) throw new Error(`GET ${BASE_URL}/meta.json failed: HTTP ${response.status}`)
  const text = await response.text()
  return { meta: trimMeta(parseRaw('meta.json', null, () => RawMetaSchema.parse(JSON.parse(text)))), text }
}
```

   Use it as follows:

```ts
  const fetched = cacheMeta === null ? await fetchMeta() : null
  const meta: SnapshotMeta = fetched?.meta
    ?? known.find((entry) => entry.patch === cacheMeta!.patch && entry.updated === cacheMeta!.updated)
    ?? cacheMeta!
```

   After the existing `fetchSnapshot(...)` call:

```ts
  // Keep the raw meta beside the cached responses so a later --from-cache run can restore its sources.
  if (fetched !== null) await writeFile(join(cacheDir, 'meta.json'), fetched.text)
```

   This is the version to use. It replaces the `meta` snippet shown just above.
4. Inside `if (previous !== null) {`, before `buildPatchDiff`:

```ts
    const url = options.notesUrl ?? notesUrl(plan.patch)
    const notes: OfficialNotes | null = await loadNotes({
      patch: plan.patch, url,
      cacheFile: join(DATA_ROOT, '.cache', 'official-notes', `${plan.patch}.html`),
      snapshotFile: join(NOTES_SNAPSHOT_ROOT, `${plan.patch}.json`),
      offline: options.fromCache !== null, allowFetch: options.notesUrl !== null,
      fetchPage: (target) => fetch(target),
    })
```

   Pass `notes: { url, notes }` to `buildPatchDiff`. Then write
   `join(staged.generated, 'notes-review.ts')` with `renderNotesReview(diff.officialNotes, plan.patch)`,
   and when `notes !== null` write `join(staged.reports, 'official-notes.json')` with
   `stableStringify(notes)`.
5. In the "every stage succeeded" block, inside `if (previous !== null)`, when the staged
   `official-notes.json` exists: `mkdir(NOTES_SNAPSHOT_ROOT, { recursive: true })`, then
   `rename(staged → join(NOTES_SNAPSHOT_ROOT, \`${plan.patch}.json\`))`.
6. Extend the final console message with the notes outcome: `Official notes: <n> auto-cleared, <m>
   notes-only flags` or `Official notes: not found at <url>`.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/data/scripts packages/data/test
git commit -m "feat: patch:update fetches and snapshots the official notes and writes notes-review.ts"
```

---

### Task 7: Re-run 7.3a with the notes, and update the docs

**Files:**
- Regenerated: `packages/data/src/patches/7.3a/{PATCH_DIFF.md,patch-diff.json,generated/*}`
- Create: `packages/data/snapshots/official-notes/7.3a.json`
- Modify: `README.md` (the "Updating to a new patch" section)
- Modify: `docs/decisions/2026-10-01-patch-overlay-and-snapshots.md` (add a "Step 2: official notes" paragraph)

- [ ] **Step 1: Re-run 7.3a from cache with the notes**

Run from the repo root:

```bash
pnpm --filter @wr-calc/data patch:update --from-cache .cache/wrpocket/7.3a-20260929160943 --refresh --notes-url https://wildrift.leagueoflegends.com/en-us/news/game-updates/wild-rift-patch-notes-7-3a/
```

Expected output includes: `0 hand-modelled entries need review` and `Official notes: 0 auto-cleared, 0
notes-only flags`. It's 0 because 7.3a's hand-written `reviewed.ts` already covers the 30 entries and
the override covers Death's Dance.

- [ ] **Step 2: Check the output**

Run: `git status --short && git diff --stat`
Expected:
- `snapshots/wrpocket/7.3a/meta.json` is **unchanged**, which shows the meta fix works.
- `snapshots/official-notes/7.3a.json` is new.
- `src/patches/7.3a/generated/notes-review.ts` names the 7.3a URL, with empty lists.
- `PATCH_DIFF.md` has an "Official notes cross-check" section that lists `item deaths-dance (Death's
  Dance): reflected` and `ITEMS: Diadem of Songs` under unmatched, and reports `2 game-mode / system
  entries skipped`.
- `generated/items.ts`, `champions.ts` and `IMPORT_REPORT.md` are unchanged, because the determinism
  check passed.

- [ ] **Step 3: Update the README**

In `README.md`, after the paragraph that ends "Nothing is written if any stage fails.", add:

```markdown
The run also fetches the official patch notes
(`https://wildrift.leagueoflegends.com/en-us/news/game-updates/wild-rift-patch-notes-<id>/`, or
`--notes-url <url>`), commits them parsed under `packages/data/snapshots/official-notes/<patch>.json`
and cross-checks them against the wrpocket diff:

- a flagged entry the notes don't mention is auto-cleared as a wrpocket-only change
  (`generated/notes-review.ts`);
- a hand-modelled entry the notes change but wrpocket didn't is flagged;
- `PATCH_DIFF.md`'s "Official notes cross-check" section shows, for each notes entry, whether
  wrpocket's data already has the new numbers.

If the notes page doesn't exist yet (HTTP 404), the import runs without it and nothing is auto-cleared.
A `--from-cache` run uses the cached page or the committed notes snapshot, and fetches only with
`--notes-url`.
```

- [ ] **Step 4: Update the ADR**

In `docs/decisions/2026-10-01-patch-overlay-and-snapshots.md`, append:

```markdown
## Step 2: official notes cross-check (2026-10-01)

The official patch notes are parsed and committed next to the wrpocket snapshots
(`snapshots/official-notes/`). Flags the notes don't mention are auto-cleared through a generated
`notes-review.ts` that `layer.ts` merges into `reviewed`. Entries only the notes change are merged into
`changedIds`. The overlay is unchanged. Hand reviews and overrides still take precedence, and nothing
writes data values automatically. See `docs/superpowers/specs/2026-10-01-official-notes-cross-check-design.md`
and ADR `2026-10-01-data-source-priority.md`.
```

- [ ] **Step 5: Run the full suite and typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS. `patch-consistency.test.ts` still matches.

- [ ] **Step 6: Commit**

```bash
git add README.md docs/decisions packages/data/snapshots/official-notes packages/data/src/patches/7.3a
git commit -m "feat: cross-check 7.3a against its official notes; document the notes stage"
```
