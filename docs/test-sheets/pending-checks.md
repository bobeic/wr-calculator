# Pending in-game checks

A running list of everything waiting on a practice-tool session, highest value first. Tick an
item off (or delete it) once its reading has been applied. Patch 7.3a is live.

## 1. Item batch 5 (Ambessa AD items)

Setup: Ambessa level 15, Q/W/E rank 4, R rank 3, the 100 armor / 100 MR / 10,000 HP dummy, no damage
runes, one item at a time. The sheet with engine predictions is to be regenerated (its branch isn't on
GitHub).

Done 2026-10-01: base stats (2340 HP, 121 AD, 106 armor, 64 MR) and the no-item hits all match the engine.
Eclipse is done too: attack, Q, W and E match, and the proc on E's recast showed 7% max HP (the model
now uses 7%). These are golden cases now.

Still to read, one item at a time, with tooltip stats plus attack, Q (edge), Q then Q2, W and E:
- Black Cleaver: E, feint, empowered attack, then Q. Does the empowered attack add exactly one stack?
- Serylda's Grudge: three abilities, then the burn's total.
- Spear of Shojin: four Q/W/E hits in a row, each number.
- Sundered Sky: two attacks in a row (only the first should crit). Does it trigger on the dummy, or
  only on Garen?
- Sterak's Gage, Death's Dance, Guardian Angel (45 or 40 AD?), Maw of Malmortius: stats and attack/Q.
- Is Seraph's Embrace in the same one-per-build group as Sterak's and Maw?
- One full-build combo.
- Eclipse follow-up: in the Q then Q2 reading (Q2 edge 693), did Eclipse proc, or was it on cooldown or
  more than 1.8s after Q? The engine expects a proc on Q2.

## 2. Patch 7.3a spot checks

All answered on 2026-10-01: Death's Dance 3300; BotRK 6% (8% melee), which is an undocumented change
that wrpocket had right and the model now uses; Sterak's 20% flat tenacity; Infinity Orb +15 magic pen;
Nashor's Tooth magic, 80 AP; Luden's Echo up to 4 other enemies.

## 3. Open engine rules (TODO-VERIFY in `packages/calc/src/rules.ts`)

Each `TODO-VERIFY` comment there says how to check it. The ones most likely to move numbers:

- `critDamageMultiplier`: hit the dummy with and without a crit.
- `attackSpeedCap`: stack attack speed on a fast-attacking champion.
- `abilityHasteFormula`: time a cooldown with and without haste.
- `resistModificationOrder` and `damageAmpTiming`: penetration plus an amp item on the same hit.

## 4. Parked unknowns (only if convenient)

- Ambessa R deals ~57 more pre-mitigation damage than its tooltip, on both the dummy and a full-HP
  Garen. A fixed bonus or a hidden ~14% amp would fit. With Eclipse (+65 bonus AD) it read 275, against 270
  with no items, so R may scale slightly with bonus AD (~13% of bonus AD before mitigation).
- Hextech Rocketbelt sometimes shows an extra ~75 damage on top of 7 bolts.
- Stormsurge never triggered on the dummy; needs a real champion target.
