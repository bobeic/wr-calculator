# China test server preview: brainstorm

**Status:** Brainstorm. The user answered §6 on 2026-10-01 (see §8); the data source is still unconfirmed.
**Date:** 2026-10-01
**Builds on:** `2026-10-01-patch-update-pipeline-design.md` (the patch-tracking steps),
`2026-10-01-official-notes-cross-check-design.md`, ADR `2026-10-01-data-source-priority.md`

## 1. What we want

Show the changes coming in the next patch before they reach live servers, as a separate **preview track**
next to the live data. This is the other half of what wildriftalpha does. The preview should:

- list the upcoming changes per champion and item, before and after where the source gives both;
- be clearly marked as not live, and never become `CURRENT_PATCH`;
- be dropped or reconciled when the live patch lands.

Later, step 5 (build impact) would use the preview to answer "what does this patch do to my build?"
before the patch ships.

## 2. The open question: where does the data come from?

This environment can't reach wildriftalpha.com, the official sites or wrpocket (the network policy
blocks them), and a web search found nothing specific. **None of the sources below has been checked.**
They are the candidates to check, in the order I'd check them.

| # | Source | Shape | For | Against |
|---|---|---|---|---|
| A | **wrpocket**: does `site_data` have a CN or test-server channel? It already holds Chinese text, which suggests a CN data feed. | JSON, the same as live | Machine-readable. Reuses `buildSnapshot`, `diffSnapshots` and the whole pipeline. | It may not exist. If it's the CN *live* server, it isn't a preview. |
| B | **Official CN site** (Tencent's Wild Rift site): test-server ("体验服") notices | Chinese HTML prose, like the official notes | Authoritative (rank 2 in the source ADR). The notes parser shape carries over: entries with `before → after` lines. | Chinese names need a name map. The page layout is unknown. It may only post at release, not during testing. |
| C | **wildriftalpha.com** | Unknown; probably per-entry before → after | Already curated, and it's the reference product | A second-hand source. Terms and permission to reuse are unknown. Our product would depend on a competitor's site. |
| D | Community dataminers (Bilibili, NGA, Weibo, Discord) | Unstructured posts and images | Often the earliest | Can't be automated. Accuracy varies. |
| E | **Manual entry**: the user writes a preview file from any of the above | A small JSON or TS file | Works today, with no scraping, and is good enough for a few changes per patch | Manual work every test cycle |

**Recommendation:** make the preview format independent of the source, and have E (manual entry) work on
day one. Then add one adapter, chosen after checking A, B and C, in that order. A wins outright if it
exists, because the existing pipeline covers almost everything.

The name map B needs (Chinese name → our id) can come from wrpocket's Chinese text, if its
snapshots carry it. Today's trimmed snapshot only keeps `name.en`, so that would mean keeping
`name.zh` too.

## 3. A source-independent preview format

Reuse the official-notes shape, because it already says "these entries change, with these lines":

```ts
interface PreviewNotes {
  /** The live patch the preview applies on top of, e.g. '7.3a'. */
  base: string
  /** A label, not a patch id: 'CN test 2026-10-05'. The live id is unknown until release. */
  label: string
  source: { kind: 'wrpocket-cn' | 'official-cn' | 'wildriftalpha' | 'manual'; url: string | null }
  captured: string
  entries: NotesEntry[]   // from official-notes/types.ts; heading is matched with matchNotes
}
```

It's committed as `snapshots/preview/<base>/<label>.json`. `matchNotes` and the reflected check work
on it unchanged.

## 4. Two depths of preview

1. **Text preview (first version).** Show the matched entries and their lines on the web app, next to
   the live values, with a "test server, may change" banner. Changes aren't applied to data or calcs.
   This is cheap, is what wildriftalpha shows, and needs no mapping from a line to a field.
2. **Calculated preview (later; step 5 needs it).** A preview layer, `<base>+preview`, built with the
   existing overlay: its `overrides.ts` is written by hand for the preview changes we care about. It
   is registered outside `PATCH_LAYERS`, so it never becomes current. With source A, the generated
   data comes for free and only hand-modelled entries need overrides.

Turning prose lines into structured overrides automatically is out of scope, the same as for the
official notes: overrides stay human-written.

## 5. Lifecycle

- During testing: `patch:preview` (or manual entry) adds or updates the preview snapshot for the current
  base.
- At release: `patch:update` imports the live patch as today. A reconcile report then compares the
  preview against the live notes and wrpocket diff, using the same matcher:
  - shipped as previewed;
  - changed between test and live;
  - dropped;
  - shipped without being previewed.

  Then the preview is archived. This reconcile report is also a quality check on the preview source.

## 6. Questions for the user

1. Which source did you have in mind? Do you know where wildriftalpha gets its data?
2. Is a text-only first version (§4.1) enough, or should the calculator run on preview data from the start?
3. Is manual entry (E) acceptable while an adapter is pending?
4. Is depending on wildriftalpha (C) acceptable, given terms and credit?

## 7. Next actions that don't need the user

- From a machine with open network access, check wrpocket for a CN or test-server feed (`site_data`
  listing, `meta.json` fields, network calls on any preview page). This is the cheapest check and
  the biggest win.
- Check whether wrpocket's raw records carry Chinese names (the `name.zh` question in §2).

## 8. User answers and findings (2026-10-01)

**Answers:**
- The priority is live accuracy: correct data as soon as a patch is live. The preview matters less.
  Any source is fine as long as it's accurate.
- No manual entry, not even as a first step.
- Text first is fine. But once an item is modelled, a change that only tweaks numbers should apply
  automatically, without a hand-written override. That changes "overrides stay human-written" for the
  number-only case: hand-modelled values need a link to the source field they came from, so that a
  number-only change can be applied and a change to the structure or text is still flagged.
- Preferred source: whatever wildriftalpha uses, most likely a Chinese API.

**Findings** (from this environment, which can't reach wildriftalpha, wrpocket or any Tencent host;
nothing below was fetched):
- Tencent's official CN Wild Rift database is served from
  `https://game.gtimg.cn/images/lgamem/act/lrlib/js/`. `heroList/hero_list.js` is confirmed by public
  code (github.com/ry2x/WildRift-Champs). The item and ability files are probably in the same folder,
  but their paths are unknown.
- CN ranked win rates come from `https://mlol.qt.qq.com/go/lgame_battle_info/hero_rank_list_v2`
  (github.com/ry2x/WildRift-Merged-Stats-Data). wildriftalpha advertises "China ranked win rates", so
  it very likely uses Tencent's endpoints. Its patch data probably comes from the same place, but
  that is unverified.
- wrpocket already mixes in Tencent CN data (see the wrpocket import design). On 7.3a its Chinese
  text had BotRK at 6% / 8% before the English text did, which is a hint that the CN feed runs ahead.

**To unblock:** either allow `game.gtimg.cn`, `mlol.qt.qq.com`, `wildriftalpha.com` and `wrpocket.app`
in this environment's network settings, or capture wildriftalpha's network requests in browser
devtools and commit the request URLs here.
