# Source sync: number-only patch changes apply automatically

**Status:** Phase 1 implemented. Phases 2 and 3 are proposals.
**Date:** 2026-10-01
**Builds on:** `2026-10-01-patch-update-pipeline-design.md`, `2026-10-01-official-notes-cross-check-design.md`,
`2026-10-01-cn-preview-brainstorm.md` §8–9

## 1. Why

The user plays on the global servers and wants the data correct as soon as a patch is live. wrpocket
stays the live source: it is the Tencent CN feed with global changes added on top. Today every change
to a hand-modelled entry needs a hand-written override, even a price tweak. Once an item is modelled,
number-only changes should apply by themselves. A change to how an item works should still be flagged.

## 2. Phase 1: item stats, price, recipe (implemented)

- **Sync at build time.** `src/patches/source-sync.ts` `syncItem(hand, generated)`. Every hand-modelled
  item takes `name`, `tier`, `cost` and `recipe` from its patch's generated entry. For stats, every key
  the generated entry lists overrides the hand value. Stats wrpocket doesn't list stay (hand-only extras
  such as Infinity Edge `critDamage`, Malignance `ultimateHaste`, Shojin `basicAbilityHaste`). Effects
  and tags stay hand-written. An item with no generated entry (Seraph's Embrace) is unchanged.
  `handModelled` keeps the unsynced copy, so the next patch syncs against its own data.
- **Pins.** `Item.sourcePins` (optional, e.g. `['cost', 'stats.ad']`) keeps a hand-written value
  where a better source disagrees with wrpocket (in-game reading or official notes, per the
  source-priority ADR). Each pin needs a comment naming that source. No item has pins today.
- **Pipeline.** `buildPatchDiff({ autoApply: { pinnedItems } })`: a hand-modelled, uncovered, unpinned
  item whose every change is `name`, `price`, `tier`, `components` or a stat whose value changed is
  **auto-applied**. It isn't flagged, isn't added to `changed-ids.ts` (so it doesn't go stale), and is
  listed in `patch-diff.json` `autoApplied` and under "Applied automatically" in `PATCH_DIFF.md`.
  These are still flagged:
  - a stat that is added or dropped, because a dropped stat can't be told apart from a hand-only extra
    at build time;
  - a `category` change (tags are hand-written);
  - any description change;
  - any change to a pinned item.
- **Safety.** Turning sync on changed no value in 7.3 or 7.3a. Every hand-modelled stat, cost and recipe
  already matched wrpocket, apart from key order and the hand-only extras. All goldens still pass.

On 7.3a with no hand reviews, phase 1 auto-applies nothing: every flagged item also has a description
change. In the data, though, Death's Dance now resolves to 3300 from wrpocket without its override.
**The description is the real bottleneck.**

## 3. Phase 2 (proposal): numbers inside effect descriptions

Effects are hand-modelled from description text (BotRK "7% of the target's current Health" →
`pctTargetCurrentHp: 0.07`). Proposal:

- **Explicit links, not guesses.** An effect field can name the description number it came from. For
  example, `textLinks: { pctTargetCurrentHp: { near: "of the target's current Health", scale: 0.01 } }`
  means: the number right before that phrase, divided by 100.
- **Auto-apply rule.** A description change auto-applies when both of these hold:
  - the old and new texts are identical once numbers are masked (so a wording change still flags);
  - every changed number is linked to an effect field, and every link still resolves.

  The new values are written into the synced item at build time, the same way as phase 1.
- **Cross-check.** When the official notes cover the item, the reflected check must agree. A
  contradiction flags the item.
- **Cost.** Each hand-modelled effect needs links added once (36 items today). A test fails for a
  modelled number that has no link and no `unlinked` reason.

This would have handled BotRK's 7% → 6% (8.5% → 8% melee) on 7.3a without a hand edit.

## 4. Phase 3 (proposal): champions

Champion base stats and per-rank ability tables (`q.scaling.<label>`) are structured numbers in
wrpocket. These are the same kind of numbers phase 1 syncs, so the same pattern applies:

- sync `baseStats` and the per-rank tables a hand-modelled ability reads from;
- auto-apply rank-table value changes;
- flag text changes and any label that is added or removed.

The linear-growth caveat (ADR `2026-09-24-linear-stat-growth-and-200-crit-base`) has to be checked
before base stats sync.

## 5. Tencent as a preview track (later)

Diffing the Tencent CN feed field by field against our live data lists changes CN already has and global
doesn't yet (brainstorm §9). It reuses `diffSnapshots` once a Tencent → snapshot mapper exists.
