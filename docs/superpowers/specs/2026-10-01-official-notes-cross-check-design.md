# Official patch notes cross-check: design

**Status:** Draft for review
**Date:** 2026-10-01
**Builds on:** `2026-10-01-patch-update-pipeline-design.md`; ADR `docs/decisions/2026-10-01-data-source-priority.md`

## 1. Why

The 7.3a import flagged 31 hand-modelled entries for review. The official notes show that only one of them,
Death's Dance's price, was a real change. The other 30 were wrpocket rewording its own text. Telling them
apart took a manual read of the notes. The pipeline can't catch the reverse case either: when the notes
change something wrpocket hasn't updated yet, nothing gets flagged.

This is step 2 of patch tracking (see the product vision: the engine stays current with every patch,
automatically where possible).

## 2. Goals

1. Fetch and parse the official notes for the patch being imported, and commit them as a snapshot.
2. Match each notes entry (champion or item) to our ids.
3. **Auto-clear:** a flagged hand-modelled entry that the notes don't mention at all is cleared
   automatically. It is recorded as reviewed with a generated note.
4. **Notes-only flags:** a hand-modelled entry that the notes change but wrpocket didn't change is flagged
   for review.
5. **Report:** for every notes entry we can match, say whether wrpocket's data already shows the new
   numbers. List the notes entries we can't match.

Out of scope:
- Applying notes numbers to the data. Overrides stay human-written.
- The China test server preview.
- Game modes (ARAM augments), runes, summoner spells and map systems. They are listed as unmatched
  and nothing else is done with them.

## 3. Source format (checked on the 7.3a page; the 7.3 fixture is checked during implementation)

- **URL:** `https://wildrift.leagueoflegends.com/en-us/news/game-updates/wild-rift-patch-notes-<id>/`,
  where `<id>` is the patch id with dots replaced by dashes (`7.3a` → `7-3a`). A `--notes-url <url>`
  flag overrides it for a page with an irregular slug.
- **Embedded data:** the page embeds its content as JSON in `<script id="__NEXT_DATA__">`, under
  `props.pageProps.page.blades[]`.
  - `articleMasthead` gives the title and `publishDate`.
  - `characterChanges` has one record per champion: `character.name` in upper case (`HWEI`), then
    `changes[]`, each with a `title` (the ability name) and `description.body` (HTML `<ul><li>` lines).
  - `articleRichText` has one HTML body. `<h2>` headings start sections (`ITEMS`, `Other Battlefield
    Content`, `GAME MODE CHANGES`, …), `<h4>` starts an entry (`Death's Dance`), a `<p>` ending in `:`
    starts a sub-group (`Base Stats:`, `Flurry:`) and `<li>` is one change line.
- **Change lines:**
  - Most read `Label: before → after`, sometimes with `->` instead of the arrow, and without spaces
    (`30→20`).
  - Some lines are prose with no arrow, such as "[New] Tenacity: 20%" or "[Removed]".
  - Text contains entities such as `&nbsp;` and curly quotes.

## 4. Design

### 4.1 Units

All new code lives in `packages/data/scripts/official-notes/`, following the `scripts/patch/` layout:
pure functions in their own files, and I/O in `patch-update.ts`.

| Unit | Does | Depends on |
|---|---|---|
| `url.ts` | Builds the notes URL from a patch id. | none |
| `parse.ts` | Turns the page HTML into `OfficialNotes`. A pure function. | none |
| `match.ts` | Maps notes entry headings to item and champion ids by normalised name. | the wrpocket snapshot |
| `cross-check.ts` | Classifies entries and produces auto-reviews, notes-only flags and the report data. | the `SnapshotDiff`, flags, matched notes and the new snapshot |
| `render.ts` | Renders the report section as markdown. | none |

The notes data shapes:

```ts
interface NotesLine {
  group: string | null    // 'Base Stats', 'Flurry', or a champion's ability title
  text: string            // plain text: tags stripped, entities decoded
  before: string | null   // from 'Label: before → after'; null when the line has no arrow
  after: string | null
}
interface NotesEntry {
  section: 'champion' | 'item' | 'other'  // from the blade type or the <h2> heading
  heading: string                         // 'HWEI', "Death's Dance"
  lines: NotesLine[]
}
interface OfficialNotes {
  patch: string
  url: string
  title: string
  published: string    // the masthead's publishDate
  entries: NotesEntry[]
}
```

An `<h2>` heading maps to a section like this: `ITEMS` → item. `CHAMPIONS` → champion, in case a page
puts champions in rich text. Anything else → other. Champion blades are always champion entries.

### 4.2 Matching

Names are normalised before comparing: case-folded, curly quotes made straight, `&nbsp;` and trailing
spaces removed, and punctuation other than letters, digits and spaces dropped. Item headings are
compared against item names in the wrpocket snapshot, and champion headings against champion names.

An entry whose heading has no match is reported as unmatched, with its section. Unmatched item or
champion entries are a warning sign that the names have drifted. Unmatched "other" entries are expected.

### 4.3 Cross-check

The inputs are the snapshot diff, the review flags `buildPatchDiff` already computes, the matched notes,
the hand-modelled ids and the new snapshot.

- **Mentioned or not.** An id is mentioned if any matched notes entry maps to it.
- **Auto-clear.** A flag with severity `changed` whose id is not mentioned becomes a generated
  `ReviewedEntry`. Its note reads: `Not in the official <patch> notes (<url>); wrpocket-only change to
  <fields>`. Flags with severity `removed` are never auto-cleared.
- **Notes-only flag.** A hand-modelled id that is mentioned, not covered (by an override or a hand
  review), and absent from the snapshot diff becomes a new flag. Its severity is `notes` and it carries
  the notes lines. It shows under "Needs review" with the label "in the official notes, wrpocket
  unchanged".
- **Reflected check.** For every matched entry and every notes line with an `after` value, each number in
  `after` is looked up in the new wrpocket record for that id (all string and number fields, flattened).
  Numbers are normalised the same way the text diff does (`3,300` → `3300`, `%` kept).
  - The line is `reflected` if every number is found, and `not found` otherwise.
  - The entry is `reflected`, `partly` or `not in wrpocket`.
  - This is a heuristic: a number can appear for an unrelated reason. The report says so, and the
    result only informs. It never clears anything.
- **Flags the notes confirm.** A flagged entry that is mentioned stays flagged, as today. The report puts
  its notes lines next to its wrpocket changes.

### 4.4 Where the results go

- **Committed notes snapshot:** `packages/data/snapshots/official-notes/<patch>.json`, written as stable
  JSON like the wrpocket snapshots. A `--from-cache` run reads this file instead of fetching.
- **Raw page cache:** `.cache/official-notes/<patch>.html`. It is git-ignored, the same as the wrpocket
  cache.
- **Generated module:** `src/patches/<patch>/generated/notes-review.ts`. It exports
  `NOTES_REVIEWED: ReviewedEntry[]` and `NOTES_FLAGGED: ChangedIds`.
- **Layers:**
  - `layer.ts` (the scaffold template, and 7.3a's existing file, edited once by hand) passes
    `reviewed: [...REVIEWED, ...NOTES_REVIEWED]`.
  - It passes `changedIds` as `CHANGED_IDS` merged with `NOTES_FLAGGED`.
  - The overlay doesn't change. A hand review or override of the same id still covers it as before.
- **`patch-diff.json`:** gets an `officialNotes` field: the url, published date, auto-reviewed ids,
  notes-only flags, per-entry reflected status and the unmatched headings.
- **`PATCH_DIFF.md`:** gets an "Official notes cross-check" section after "Needs review". It has the link
  and date, the auto-cleared entries with their notes, the matched entries and their status, and the
  unmatched headings grouped by section. Each "Needs review" entry also gets the line "In the official
  notes: yes/no".

### 4.5 Failure handling

- **Notes page returns 404** (not published yet, or an irregular slug): the import still runs. The report
  says `Official notes not found at <url>; nothing auto-cleared (use --notes-url)`. `notes-review.ts` is
  written with empty lists.
- **Network error or other HTTP error:** the run fails before anything is written, as wrpocket fetch
  failures already do.
- **Page found but no `__NEXT_DATA__`, or no change blades:** the run fails, naming the URL. The page
  layout has drifted and the parser needs updating. A silent empty result would auto-clear everything.
- **Zero matched item or champion entries on a page that has a champion blade or an `ITEMS`
  section:** the run fails. This guards against names drifting so far that nothing is "mentioned", which
  would auto-clear every flag.
- **`--from-cache` with no committed notes snapshot for that patch:** the run carries on as if the page
  returned 404.

### 4.6 Fix bundled in

A `--from-cache` run rebuilt `meta.json` from the cache folder name and dropped `patch_major` and
`sources`. The fix: when the committed snapshot for the same patch has the same `updated`, reuse its meta.
Live runs also start saving `meta.json` into the cache folder.

## 5. Re-running 7.3a

After implementation, `patch:update --from-cache .cache/wrpocket/7.3a-20260929160943 --refresh --notes-url
<7.3a url>` fetches and commits the 7.3a notes snapshot and regenerates the report. 7.3a's hand-written
`reviewed.ts` already covers the 30 entries, so nothing new is auto-cleared. The report should show:

- Death's Dance mentioned and reflected (3300).
- Yun Tal Wildarrows, Whispering Circlet, Diadem of Songs and the 12 champions matched, each with a
  reflected status.
- The augment, champion-adjustment and Nexus headings unmatched under "other".

A test runs the cross-check on the 7.3a fixtures with no hand reviews. It must produce exactly 30
auto-reviewed entries and leave only Death's Dance flagged. That is the 7.3a outcome we worked out by
hand, made executable.

## 6. Testing

- `parse.ts`: the fixtures are trimmed `__NEXT_DATA__` extracts of the 7.3 and 7.3a pages, committed under
  `packages/data/test/fixtures/official-notes/`. The tests cover:
  - Sections, headings and groups.
  - Arrow variants (`→`, `->`, no spaces).
  - Lines with no arrow.
  - Entity decoding.
  - Errors when the page has no `__NEXT_DATA__` or no blades.
- `match.ts`: curly apostrophes (`Serylda’s Grudge`), upper-case champion names, `&nbsp;` trailing
  spaces, and unmatched headings.
- `cross-check.ts`: auto-clear (changed but not mentioned), no auto-clear for removed entries or
  mentioned entries, notes-only flags, covered ids skipped, and reflected / partly / not in wrpocket,
  including the `3,300` normalisation.
- `render.ts`: snapshot-style tests of the section, in the existing `render-diff.test.ts` style.
- Pipeline guards: 404 → empty lists and the report message; a found page with zero matches → error.
- The 7.3a acceptance test from §5.
- `patch-consistency.test.ts` keeps working: notes-reviewed ids count as covered.

## 7. Risks

- **The page layout is Riot's CMS and can change.** The fail-loud rules in §4.5 catch it, and the
  committed fixtures pin the format we parse.
- **Notes don't list every change.** Riot sometimes ships undocumented changes. An auto-cleared entry
  could hide a real undocumented change. Every auto-review note says it came from the notes, and the
  data-source ADR already ranks in-game readings above the notes.
- **URL slugs may vary.** `--notes-url` covers that.
