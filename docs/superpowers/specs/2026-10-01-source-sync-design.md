# Source sync: number-only patch changes apply automatically

**Status:** Phases 1 and 2 implemented. Phase 3 is a proposal.
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
- **Stale items keep their last values.** While a hand-modelled item is stale (flagged and not yet
  covered by an override or review), it syncs against the previous patch's effective item, not the new
  generated one. An unconfirmed wrpocket number therefore never reaches the calculator. Once the item
  is covered, or auto-applied with notes confirmation, it syncs to the new values. (Decided 2026-10-01:
  BotRK showed that wrpocket's unconfirmed numbers can be wrong.)
- **Pins.** `Item.sourcePins` (optional, e.g. `['cost', 'stats.ad']`) keeps a hand-written value
  where a better source disagrees with wrpocket (in-game reading or official notes, per the
  source-priority ADR). Each pin needs a comment naming that source. No item has pins today.
- **Pipeline.** `buildPatchDiff({ autoApply: { pinnedItems } })`: a hand-modelled, uncovered, unpinned
  item is **auto-applied** when both of these hold:
  - every change is `name`, `price`, `tier`, `components` or a stat whose value changed;
  - the official notes mention the item and every new number in their lines appears in wrpocket's
    record (the cross-check's `reflected` status).

  wrpocket alone isn't trusted for this. It carries Tencent CN values and sometimes regresses against
  the global notes. On 7.3a its BotRK text went 7% → 6%, copied from the Chinese text, while the
  global 7.3a notes list no BotRK change. What 7.3a did change is Viego's Q, which is also titled "Blade
  of the Ruined King". The notes list that change on Viego's champion card, and the matcher attributes it
  to Viego, not to the item. A test pins this, so a name shared between an ability and an item never
  counts as an item mention. An auto-applied item isn't flagged, isn't added to `changed-ids.ts` (so it doesn't go stale), and is
  listed in `patch-diff.json` `autoApplied` and under "Applied automatically" in `PATCH_DIFF.md`.
  These are still flagged:
  - a synced change the notes don't confirm. The notes cross-check also never auto-clears a flag that
    has a synced change, because the overlay already applied wrpocket's value: clearing it as
    "wrpocket-only" would hide it;
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

## 3. Phase 2: numbers inside effect descriptions (implemented)

Effects are hand-modelled from description text (Rabadon's "Increases Ability Power by 30%" →
`amount: 0.3`).

- **Links** (`src/patches/text-links.ts`). Each modelled number names:
  - the description number(s) it comes from, as patterns that match exactly once, each with one capture
    group;
  - an optional formula. This covers derived values: Luden's `damage` = base + others × extra, and
    half-second ticks (Liandry's 2%/s → 1% per tick).

  A link can also target a field on the item itself, for hand-only stats (Infinity Edge
  `stats.critDamage`, Malignance `stats.ultimateHaste`, Shojin `stats.basicAbilityHaste`). `ignore` marks
  spans whose numbers the model doesn't use (move speed, shields, heals, ranged values). 70 links cover
  the 35 hand-modelled items wrpocket describes. Serylda's Frostbite has no text to link: wrpocket only
  describes Icy.
- **Check** (`scripts/patch/text-sync.ts` `checkDescription`). A description change qualifies only when
  all of these hold:
  - the old and new texts are identical once numbers are masked (case and whitespace folded);
  - every link resolves in both texts;
  - every link's old-text value equals the previous patch's model value, so a link the model disagrees
    with (BotRK, Eclipse) never auto-applies;
  - every changed number is linked or ignored.
- **Auto-apply** (`autoAppliedItems`). A flagged item is auto-applied when every change is synced
  (§2) or a qualifying description change, and the official notes:
  - mention the item;
  - are `reflected` in wrpocket;
  - contain each changed linked number.

  The new values go into `generated/text-sync.ts` (`TEXT_SYNC`). `layer.ts` passes them as `textSync`, and
  the overlay applies them to inherited hand-modelled items before overrides, so later patches inherit
  them.
- **Guard test** (`test/text-links.test.ts`). Against the current patch, every link must resolve once and
  equal the model. The exceptions are listed with reasons in `KNOWN_DIVERGENCES`: BotRK (text 6%, notes
  and model 7%) and Eclipse (text 7%, model 6% from the WR wiki, pending an in-game check). A divergence
  that starts agreeing fails the test, so it gets removed. An end-to-end test runs the real links on a
  made-up next patch.

On 7.3a this applies nothing. BotRK's 7% → 6% isn't in the notes, so the notes check clears it as a
wrpocket-only text change and the model keeps 7%. Of the four items the notes change, only Death's Dance
is hand-modelled, and its description was reworded, so it stays flagged for a human. The rule pays off
when the notes change a modelled item's numbers and wrpocket's text changes only in those numbers.

## 4. Phase 3 (proposal): champions

Champion base stats and per-rank ability tables (`q.scaling.<label>`) are structured numbers in
wrpocket. These are the same kind of numbers phase 1 syncs, so the same pattern applies:

- sync `baseStats` and the per-rank tables a hand-modelled ability reads from;
- auto-apply rank-table value changes, with the same official-notes confirmation;
- flag text changes and any label that is added or removed.

The linear-growth caveat (ADR `2026-09-24-linear-stat-growth-and-200-crit-base`) has to be checked
before base stats sync.

## 5. Tencent as a preview track (later)

Diffing the Tencent CN feed field by field against our live data lists changes CN already has and global
doesn't yet (brainstorm §9). It reuses `diffSnapshots` once a Tencent → snapshot mapper exists.
