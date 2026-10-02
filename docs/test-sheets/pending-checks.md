# Pending in-game checks

Only passives whose behaviour is unclear or needs confirming go here. Plain numbers (stats, prices,
ratios) come from wrpocket, which in-game checks have backed (decided 2026-10-01; see ADR
`2026-10-01-data-source-priority.md`). Tick an item off (or delete it) once its reading has been applied.
Patch 7.3a is live.

## 1. Unclear passives

- Shared passive names (user, 2026-10-02: "passives are unique"). The validator now blocks two finished items
  with the same named passive. The obvious ones (Spellblade, Lifeline, Annul) are expected; these pairs are
  less obvious and worth a look in the shop: Rylai's Crystal Scepter + Serylda's Grudge (both "Icy"),
  Dead Man's Plate + Youmuu's Ghostblade ("Momentum"), Sunfire Aegis + Hollow Radiance ("Immolate").

- Batch 6 assumptions (2026-10-02; every batch 6 item is unchecked, these are the guesses most likely to be off):
  - Energized items (Rapid Firecannon, Stormrazor, Statikk Shiv): how many basic attacks charge one, standing still?
    The engine says 7 (Statikk 5), from SharpWR Damage Lab's benchmark.
  - Sunfire Aegis, Bami's Cinder, Unending Despair: first tick 1s (Despair 4s) after your first hit, and how long
    after your last hit they keep ticking. The engine says 3s.
  - Galeforce: is 40–125 + 35% bonus AD the total of all 3 projectiles, or per projectile? The engine says total.
  - Guinsoo's Rageblade: how long do Seething Strike stacks last? The engine says 5s.
  - Terminus: is the first attack Light (the engine) or Dark?
  - Kraken Slayer: does 150–210 grow linearly with level, and does Guinsoo's extra on-hit count toward it?
  - Dusk and Dawn: the "shortly afterward" extra on-hit; the engine applies it right after the attack.

- Runes (first modelled 2026-10-02 from wrpocket's 7.3a text; all unchecked):
  - Rune page shape: the engine only enforces one keystone. How many minor runes, and one per path or per row?
  - Aery: how long before she can be sent again? The engine says 2 seconds.
  - Empowerment: once per fight, or every 3 attacks? And does the 8% start right after the proc? The engine procs
    once and leaves the 8% to a toggle.
  - Cut Down and Last Stand say "attacks": do abilities count? The engine amplifies everything.
  - Grasp of Undying: the engine has it ready on the first attack, then every 4 seconds.
  - Electrocute and Dark Harvest damage type: adaptive by bonus AD vs AP (rules.ts `adaptiveDamageType`).

- Ignite: what is its cooldown in Wild Rift (the engine uses League's 90s), and is 72–380 linear with level?

- Champion kits for Darius, Lee Sin, Hwei, Caitlyn and Senna (2026-10-03, from wrpocket's 7.3a text; all unchecked).
  The guesses most likely to be off:
  - Darius: Noxian Might's AD. The text says "32 (based on level)"; the engine gives 32 at every level. What is it at
    level 15? Also: does Hemorrhage tick once a second, and does R's damage go up by 20% per stack (5 stacks = double)?
  - Caitlyn: is the Headshot the 6th attack or the 7th? The text reads "every 6 attacks, the next attack", so the
    engine fires it on the 7th.
  - Hwei: does Signature of the Visionary go off on every second ability hit? How long do Stirring Lights last (the
    engine says 6s)?
  - Senna: Mist's crit is modelled as 0.5% per stack instead of 10% per 20.

- Ranged list (2026-10-03): skim `packages/data/src/attack-types.ts`. It's from League's attack types; anyone missing
  or wrong there gets the wrong melee/ranged item values. Gnar, Nidalee, Jayce and Kayle change with form; the
  engine uses one value per combo (listed in the file).

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
