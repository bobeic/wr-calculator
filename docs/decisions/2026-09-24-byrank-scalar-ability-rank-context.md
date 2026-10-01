# ADR: The engine has no ability-rank context for `byRank` scalars

**Status:** Accepted (option 1 implemented 2026-09-24; see the update at the end)

## Context

`resolveScalar(scalar, level)` (`packages/calc/src/resolve-scalar.ts`, ~line 33-34) resolves every
`NullableScalar` variant against a *champion* level — except `byRank`, which it can't: a `byRank`
array is indexed by ability rank (1..`maxRank`), not champion level, and nothing in the engine's
current call chain carries an ability-rank context. The `byRank` branch always returns `{ value: 0,
wasByRank: true, ... }`, and `scalarWarning` turns that into `"<owner>: <field> uses a byRank scalar
outside an ability-rank context; treated as 0"`. Every caller that resolves an ability's `Scalar`
fields hits this: `resolveDamageComponent` (`packages/calc/src/damage-component.ts`) for
`component.base` and each `ratio.value`, and `simulateCombo`'s `Q`/`W`/`E`/`R` branch
(`packages/calc/src/simulate-combo.ts`, ~363-381) for `ability.cooldown` (and, via the caller,
`ability.cost`). This was a latent, untriggered gap through Step 4-6 because all ability fixture
data was hand-written as flat numbers.

The wrpocket.app import (`docs/superpowers/specs/2026-09-24-wrpocket-import-design.md`) changes
that: `mapAbility`/`mapDamage` (`packages/data/scripts/wrpocket/map-champion.ts`) call `toScalar`
(`packages/data/scripts/wrpocket/parse-ability.ts`) on every per-rank array the site provides —
base damage, per-rank ratio values, cooldown, and cost — which produces `{ byRank }` whenever the
array has more than one entry. Most real abilities scale per rank, so most imported abilities now
carry `byRank` base damage and `byRank` cooldown.

**Consequence, confirmed by a manual probe (Annie, level 15, Rabadon's Deathcap + Void Staff):**
- `ability.cooldown` resolves to 0 (its `byRank` array almost always has >1 distinct value), so
  `simulateCombo`/`sustainedDps` never gate a `Q`/`W`/`E`/`R` recast on cooldown — a priority
  rotation recasts every ability as fast as `castTime` allows.
- `ability.damage[].base` resolves to 0 for the same reason, so ability damage is ratio-only (a
  flat, single-value ratio like Annie Q's `+85% AP` still resolves normally — only the per-rank
  `base` and any per-rank `ratio.value` collapse to 0).
- Net effect: AA-only DPS was ~50, but priority `Q W E R` DPS was ~485 — nearly 10x higher, driven
  entirely by free recasts of ratio-only abilities, not by a realistic rotation.

This makes every ability-driven number the Step 7 debug page shows (per-ability damage, burst
sequences that include `Q`/`W`/`E`/`R`, and `sustainedDps`) unreliable: they undercount base damage
and overcount cast frequency at the same time, in a way that doesn't cancel out.

## Decision

Record this as a known, accepted Phase 1 gap. **No change to `packages/calc`** — this ADR is
documentation only, per the scope of the wrpocket-import branch's final review. Two candidate fixes
are identified but left open for the user to pick from before any engine change is made:

1. **Resolve `byRank` at `maxRank` by default when no rank context is given.** Cheap — a one-line
   change to the `byRank` branch of `resolveScalar`, no schema or call-site changes. Treats every
   ability as though it's been fully ranked, which is at least a plausible reading of "sustained
   DPS at max level," but it's silently wrong for any lower-level scenario (a level-1 combo would
   still show max-rank numbers) and changes the meaning of the existing `wasByRank`/warning
   contract for every current and future caller.
2. **Thread a real per-ability rank through the call chain** (e.g. a `Combatant.abilityRanks:
   Record<AbilityKey, number>`, populated from champion level via Wild Rift's rank-up curve, or
   from an explicit debug-page input) into `resolveScalar`, `resolveDamageComponent`, and the
   cooldown/cost resolution in `simulateCombo`. This is the accurate fix but is real design work:
   what rank curve to assume from champion level (or whether to expose it as its own input), a
   signature change reaching `resolve-scalar.ts`, `damage-component.ts`, `simulate-combo.ts`, and
   whatever the Step 7 UI needs to add to let the numbers be trusted.

## Consequences

- Until one of the above (or another fix) lands, **the Step 7 debug page's ability-derived numbers
  are not trustworthy**: per-ability damage, any `simulateCombo` sequence using `Q`/`W`/`E`/`R`, and
  `sustainedDps` all inherit this bug. Pure-`AA` numbers are unaffected.
- This is a pre-existing engine limitation, not something the wrpocket import broke — the import
  only supplied the first real data that exercises it.
- The Step 7 spec (`docs/superpowers/specs/2026-09-24-phase1-step7-debug-page-design.md`, §1) now
  points at this ADR so a reader of the debug page's ability numbers is warned before trusting them.

## Update 2026-09-24: option 1 implemented

The user chose option 1 now, with a per-ability rank input (a slice of option 2) as a later
follow-up. Implementation:

- `resolveScalar(scalar, level, rank?)` takes an optional ability rank. A `byRank` scalar with a
  rank resolves to entry `min(max(rank, 1), length)`; without one it still resolves to 0 with the
  "outside an ability-rank context" warning, so item/rune effects are unchanged (no item or rune
  data uses `byRank`).
- `resolveDamageComponent` takes the rank too, and `simulateCombo`'s `Q`/`W`/`E`/`R` branch passes
  `ability.maxRank` for both damage components and the cooldown. Ability `cost` is still never
  resolved (no resource model).
- `scalarWarning` warns when a `byRank` array's length differs from the rank it was resolved at.
  In the 7.3 import that flags 5 of 1,383 arrays: Jayce W base (5 values, maxRank 4), Nilah R cost
  (4 values, maxRank 3, unused), and the Twitch and Zeri passive damage arrays (5 values, maxRank 1;
  really per-stack/per-level, and passives aren't cast by `simulateCombo`).
- The debug page's notice now says ability values assume max rank.

This accepts option 1's stated downside: a low-level scenario still shows max-rank ability numbers.

## Update 2026-10-01: per-ability rank input (option 2's input half)

`Build.abilityRanks` (optional `{ q, w, e, r }`, each 1..maxRank) sets the rank each ability is used at. An
ability left out stays at max rank, so every existing build, golden case and test is unchanged.
- `combatantFromChampion` rejects a rank outside 1..maxRank and records the effective ranks on
  `Combatant.abilityRanks`.
- The ranks bind kit effects (`championKitEffects`), both in `resolveStats` and on the combatant: Ambessa's R
  passive armor pen follows R's rank.
- `simulateCombo` uses them for ability damage and cooldowns.
- The debug page has Q/W/E/R rank inputs next to the level (blank means max rank), shared by builds A and B
  and stored in the URL as `ranks`. A champion target stays at max rank.

Not done: deriving ranks from champion level with a skill order. The ranks are explicit.
