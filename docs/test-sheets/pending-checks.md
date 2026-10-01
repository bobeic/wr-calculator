# Pending in-game checks

A running list of everything waiting on a practice-tool session, highest value first. Tick an
item off (or delete it) once its reading has been applied. Patch 7.3a is live.

## 1. Item batch 5 (Ambessa AD items)

The full sheet with engine predictions is `docs/test-sheets/2026-10-01-item-batch5.md` on branch
`docs/tvanmook/batch5-test-sheet/20261001`. Its readings become golden cases. Its tooltips also settle
where wrpocket and the WR wiki disagree:

- Serylda's Grudge stats.
- Death's Dance: 50 AD / 45 armor (wrpocket) vs 35 AD / 40 armor (wiki).
- Guardian Angel: 45 AD (wrpocket) vs 40 AD (wiki).

## 2. Patch 7.3a spot checks (shop tooltips only, no combat needed)

- Death's Dance costs 3300 (override written from the official notes).
- Blade of the Ruined King: is it 6% current HP (8% melee) or 7% (8.5% melee)? wrpocket changed the text
  but the official notes don't mention it.
- Infinity Orb still gives +15 magic penetration (wrpocket's description dropped the line).
- Nashor's Tooth is still a magic item (wrpocket now says Physical).
- Luden's Echo: up to 4 or 5 other enemies (only matters for the text; we model 1v1).

## 3. Open engine rules (TODO-VERIFY in `packages/calc/src/rules.ts`)

Each `TODO-VERIFY` comment there says how to check it. The ones most likely to move numbers:

- `critDamageMultiplier`: hit the dummy with and without a crit.
- `attackSpeedCap`: stack attack speed on a fast-attacking champion.
- `abilityHasteFormula`: time a cooldown with and without haste.
- `resistModificationOrder` and `damageAmpTiming`: penetration plus an amp item on the same hit.

## 4. Parked unknowns (only if convenient)

- Ambessa R deals ~57 more pre-mitigation damage than its tooltip, on both the dummy and a full-HP
  Garen. A fixed bonus or a hidden ~14% amp would fit.
- Hextech Rocketbelt sometimes shows an extra ~75 damage on top of 7 bolts.
- Stormsurge never triggered on the dummy; needs a real champion target.
