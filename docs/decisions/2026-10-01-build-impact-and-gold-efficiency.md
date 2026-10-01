# ADR: Build impact report and gold efficiency

**Status:** Accepted (2026-10-01)

## Context

Patch tracking should say what a patch does to builds, not only which records changed. Step 5's
`goldEfficiency` was deferred (`2026-09-17-compare-builds-known-phase1-gaps.md`, gap 1) until real data existed.

## Decision

- **Gold efficiency** (`packages/calc/src/analysis/gold-efficiency.ts`). `statGoldValues(items)` prices each
  stat by League's usual method:
  - single-stat basic items first (Long Sword: 500g / 12 AD ≈ 41.7g per AD);
  - then basic or epic items with no effects and exactly one stat still unpriced (Vampiric Scepter prices
    lifesteal from what's left after its AD).

  Candidates are ordered basic first, then cheapest, then by id. `goldEfficiency(item, values)` is the
  value of the item's priced stats over its cost. Passives aren't counted, and stats nothing prices (crit
  damage, flat move speed) are listed as unpriced.
- **Build impact** (`packages/data/scripts/patch/build-impact.ts`, CLI `scripts/build-impact.ts`,
  `pnpm patch:impact [<from> <to>]`). It compares two registered patches:
  - every golden-case scenario run on both patches' data (expected crits), as damage before and after;
  - every item whose cost, stats or modelled effects changed (prose ignored), or whose stat gold
    efficiency moved because stat prices moved, with cost and efficiency before and after;
  - stat gold values that changed.

  It writes `src/patches/<to>/BUILD_IMPACT.md` and `build-impact.json`. `patch:update` runs it in a child
  process after a successful import, because the importing process loaded the registry before the new
  patch existed.
- **Fixing data errors in history.** The 7.3 hand models for Eclipse (6% → 7%) and Serylda's Grudge (Frostbite
  burn removed) were corrected in place. wrpocket's 7.3 text already said so, and the 7.3a in-game checks
  confirmed it. Otherwise the impact report would show data corrections as patch changes. BotRK stays 7% on
  7.3, because the 7.3 text and notes said 7%, so its 6% is a real 7.3a change.

## Consequences

- On 7.3 → 7.3a the report shows exactly the real changes to modelled items: BotRK's on-hit, Death's Dance's
  price (gold efficiency 128.4% → 124.5%) and Yun Tal Wildarrows' attack speed (94.1% → 104.8%). No golden
  scenario changes, because none uses BotRK.
- The scenarios are the golden cases, so the report covers what has been measured. Reference builds for
  other champions can be added as scenarios later.
