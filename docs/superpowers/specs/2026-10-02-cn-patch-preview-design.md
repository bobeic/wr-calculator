# CN patch preview: design

**Status:** Design, ready to build. Follows `2026-10-01-cn-preview-brainstorm.md`, which settled the open questions:
any accurate source, no manual entry, text first, number-only changes to modelled entries applied automatically
later.
**Date:** 2026-10-02

## 1. What the data says (checked 2026-10-02)

- Tencent's CN feed (`https://game.gtimg.cn/images/lgamem/act/lrlib/js/`: `equip/equip.js`, `hero/<heroId>.js`) is
  reachable, unauthenticated JSON with a `version` and `fileTime` per file. Numbers are fixed point (×10000) and
  ability tables are per rank (`variTypeN` / `variValueN`, `cdtime`, `costvalue`). No Chinese text needs parsing.
- **wrpocket mirrors this feed.** Its `meta.sources` timestamps equal Tencent's `fileTime` to the second
  (items 2026-09-29 16:09:42 in both).
- Right now CN and our live data differ in one value out of 171 items: Death's Dance costs 3200 on CN and 3300 on
  global, where global is ahead. A "CN versus live" list is therefore almost always short. The preview signal is
  **CN changing**, not CN differing.

## 2. What we build (v1, text only)

1. **`cn-preview:update`** (`packages/data/scripts/cn-preview-update.ts`), run by the daily CN workflow:
   - fetch `equip/equip.js` and every `hero/<heroId>.js` (hero ids from `heroList/hero_list.js`, already used by
     `cn-stats:update`), with the same retry helper;
   - trim them to numbers only. Items: price, `from`, the stat fields. Champions: base stats and growth, and for
     each spell its cooldown, cost and `variType`/`variValue` rows;
   - map ids to ours (items via wrpocket's `source_id`, champions via `championIdFromPoster`, spells by order:
     passive, Q, W, E, R);
   - commit the trimmed result as `packages/data/snapshots/tencent/latest.json` (stable JSON).
2. **Change log.** When `version` or any `fileTime` moves, diff the new trim against the committed one and append the
   changes to `packages/data/src/cn-preview/generated/changes.ts`: date, CN version, entry, field, before → after.
   Git history keeps the old snapshots, so only `latest.json` is stored.
3. **"Live here yet?"** For each change, check whether our current live data already has the new value. Items:
   price and stats, via the existing snapshot's `numeric_stats` key map. Champions: compare the rank-value string
   (`5/20/35/50`) against wrpocket's scaling rows for the same ability, which are taken from these same Tencent
   tables. When we can't map a field, show "unknown" rather than guess.
4. **Page `/patches/cn-preview/`.** Changes grouped by date, newest first, each marked "already live" or "CN only".
   The page has a banner: CN server, own schedule, may never reach global. It is linked from `/patches/`.

Nothing feeds the calculator, `CURRENT_PATCH` or the overlay. The calculated preview (brainstorm §4.2) waits until
v1 shows the feed actually runs ahead often enough to matter.

## 3. Risks

- **CN changes may leak into "live" data.** wrpocket mirrors Tencent, so when CN patches first, our next
  `patch:update` may import CN numbers as global. The official-notes cross-check catches only what the notes state.
  The change log makes this visible: an entry marked "already live" before the global patch notes is a leak.
  Owner decision (in `docs/next-steps.md`): gate `patch:update` on this, or just watch it.
- Spell order: if Tencent ever reorders `spells[]`, the slot mapping breaks. A test pins Senna's and Hwei's order.
- Some CN-only entries (Diadem of Songs, CN-exclusive items) have no global id. They are listed by Chinese name
  under "CN only, not on global".

## 4. Tests

- Trim and diff: fixtures for an item price change, a stat change, a spell row change, an added and a removed entry.
- "Live here yet?": a change matching the snapshot, one not matching, one unmappable.
- The site: the page renders with an empty log (the first run has no baseline).

## 5. Built (2026-10-02)

v1 as above. First run: 328 entries; "differs today" is ~340 fields, almost all champion ability rows, not the one
item value §1 expected. wrpocket's champion numbers are not a straight copy of Tencent's (e.g. Aatrox Q 10/40/70/100
on wrpocket, 15/45/75/105 on Tencent), so §3's leak risk applies mainly to items. Champion base stats, ability costs
and cooldowns are logged but never compared ("?").
