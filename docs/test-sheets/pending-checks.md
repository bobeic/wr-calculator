# Pending in-game checks

Only passives whose behaviour is unclear or needs confirming go here. Plain numbers (stats, prices,
ratios) come from wrpocket, which in-game checks have backed (decided 2026-10-01; see ADR
`2026-10-01-data-source-priority.md`). Tick an item off (or delete it) once its reading has been applied.
Patch 7.3a is live.

## 1. Unclear passives

- Eclipse: in a Q then Q2 sequence, does Ever Rising Moon proc on Q2 (two hits within 1.8s)? The engine
  says yes. The recorded Q2 reading (693) didn't say whether it was on cooldown.
- Shop rules (no combat needed): how many item slots does the inventory have, with boots in or out of them?
  The engine allows 6 items plus a separate boots slot (`ITEM_SLOTS` / `HAS_SEPARATE_BOOTS_SLOT` in
  `packages/calc/src/rules.ts`); if it's 5 + boots, that's a one-line change. Also: can the same legendary
  be bought twice? The engine says no (components can).
- Seraph's Embrace: is it in the same one-per-build group as Sterak's Gage and Maw of Malmortius (a guess
  from its passive's name)?

## 2. Open engine rules (TODO-VERIFY in `packages/calc/src/rules.ts`)

Each `TODO-VERIFY` comment there says how to check it. The ones most likely to move numbers:

- `critDamageMultiplier`: hit the dummy with and without a crit.
- `attackSpeedCap`: stack attack speed on a fast-attacking champion.
- `abilityHasteFormula`: time a cooldown with and without haste.
- `resistModificationOrder` and `damageAmpTiming`: penetration plus an amp item on the same hit.

## 3. Parked unknowns (only if convenient)

- Ambessa R deals ~57 more pre-mitigation damage than its tooltip, on both the dummy and a full-HP
  Garen. A fixed bonus or a hidden ~14% amp would fit. With Eclipse (+65 bonus AD) it read 275, against 270
  with no items, so R may scale slightly with bonus AD (~13% of bonus AD before mitigation).
- Hextech Rocketbelt sometimes shows an extra ~75 damage on top of 7 bolts.
- Stormsurge never triggered on the dummy; needs a real champion target.
