# Phase 1 Step 6: Real Data Skeletons + Golden Runner — Design

Work-order item 6 from `docs/superpowers/specs/2026-09-10-phase1-engine-schema-fixtures-design.md`:
"Real data skeletons (starter items, Nunu), golden runner." Steps 1-5 are done and merged;
`packages/data/src` is currently a stub (`export {}`, no `fixtures/`/`patches/`/`golden/`
directories) and no golden-runner code exists anywhere in the repo.

This step is greenfield (new data-package content + a new test-runner mechanism), not a change to
an existing flow, so it follows the same spec → plan → subagent-driven-development path as Steps
2, 4, and 5.

## 1. Scope: starter set

**Champions (4):** Nunu & Willump, Rammus, Annie, Jinx — a broader spread than the original spec's
"Nunu plus two more" (tank/jungle, tank/initiator, burst mage, on-hit ADC), chosen to give the
debug page (Step 7) builds the user actually cares about.

**Items (15):** Long Sword, B.F. Sword, Blasting Wand (plain stat components) · Rabadon's
Deathcap, Blade of the Ruined King, Trinity Force, Liandry's Torment · Void Staff, Black Cleaver,
Infinity Edge, Navori Quickblades · Heartsteel, Seraph's Embrace · Plated Steelcaps, Force of
Nature.

Trinity Force (over Lich Bane), Heartsteel (over Titanic Hydra), and Seraph's Embrace (over
Muramana) were picked to maximize effect-kind coverage across the fixed items: Trinity Force
covers `spellblade` + `statConversion`, Heartsteel covers `stacking`, Seraph's Embrace covers
`shieldHeal` — none of which any other item in the starter set exercises.

The original spec's set also included "one enchant." **Dropped**: the user confirmed 2026-09-17
that Wild Rift removed the boot-enchant mechanic — enchants are no longer a distinct
attach-to-boots purchase, they're standalone items now. There's no longer a distinct "enchant"
category to represent in the starter set; boots coverage comes from Plated Steelcaps and Force of
Nature.

Exact real-world names for the three "plain stat component" items are placeholders pending the
user's own patch-7.3 pass — they carry no effect-kind logic, so a rename later is low-risk.

Runes are out of scope for this step, matching the original spec's "Data for this phase" list
(items and champions only). Golden-runner scenarios build with `runes: []`.

## 2. Schema changes

**`ChampionSchema` gains a `provenance` field.** The schema as merged in Steps 1-5 has no way to
express "this champion's data hasn't been verified in-game yet": `ItemSchema` has a `provenance:
ProvenanceSchema` field, but `ChampionSchema` (`packages/schema/src/champion.ts`) has none — a gap
in the original spec's assumption that champion skeletons could carry `null`s and
`verifiedInGame: false` the same way items do. Fix: add `provenance: ProvenanceSchema` (same
shape as `Item.provenance`) as a new required field on `ChampionSchema`.

`baseStats` and `attackSpeed` stay plain (non-nullable) numbers — not converted to
`NullableScalar` — using the existing `rules.ts` TODO-VERIFY convention (best-guess placeholder
values, not literal unknowns). `resolveStats`/`simulateCombo` already assume real champion
numbers; making these nullable would ripple through both for little benefit when a file-level
`provenance.verifiedInGame: false` already signals "not confirmed."

Adding a new required field to a `.strict()` schema is a breaking change for every existing
`Champion` literal. Blast radius (confirmed by grep): `packages/calc/test/simulate-combo.test.ts`,
`resolve-stats.test.ts`, `combatant.test.ts`, `analysis/compare-builds.test.ts`,
`analysis/compare-builds-perf.test.ts`, `analysis/sustained-dps.test.ts`, and
`packages/schema/test/champion.test.ts` — each needs one line added
(`provenance: { source: 'manual', patch: 'test', verifiedInGame: false }` or similar). Mechanical
fix-up, no test logic changes.

**`rules.ts`: `HAS_SEPARATE_ENCHANT_SLOT` resolved to `false`.** This was a TODO-VERIFY constant
(`itemSlots`, `packages/calc/src/rules.ts:115-119`) asking whether the inventory holds a separate
enchant slot alongside the 6 item slots and the boots slot. The user's 2026-09-17 confirmation
(enchants are now standalone items, not a slot) resolves it. Nothing currently reads
`HAS_SEPARATE_ENCHANT_SLOT` (confirmed via grep — it's dead code today, same as
`UNIQUE_EFFECT_RESOLUTION`), so flipping it is a safe, non-rippling one-line fix, folded into this
step's schema work since it's directly informed by the same correction.

**Deferred, not in this step:** `ItemTierSchema`'s `'enchant'` tier value
(`packages/schema/src/item.ts`), the `Build.enchant` optional field
(`packages/schema/src/build.ts`), and the 3 calc call sites that special-case `build.enchant` as a
distinct item (`combatant.ts`, `resolve-stats.ts`, `analysis/compare-builds.ts`) still model
enchants as their own concept. These should probably consolidate into treating any upgraded boots
as a normal `items`/`boots` entry, but that's a real behavior change to already-merged Step 2/4/5
code, not a rider on a data-and-tooling step. Noted here as a new deferred gap, not yet assigned to
a step or tracked in any other repo document — to be scoped as its own task later.

## 3. Data package layout

```
packages/data/src/patches/7.3/
  items.ts        -- 15 Item skeletons (null stats, provenance.verifiedInGame: false)
  champions.ts     -- 4 Champion skeletons (placeholder baseStats/attackSpeed, provenance.verifiedInGame: false)
  index.ts         -- catalog builder: patch7_3Catalog(): { items: Map<string, Item>, runes: Map<string, Rune> }
packages/data/golden/
  README.md        -- documents the golden-case format with one annotated example (not runner-loaded)
packages/data/test/
  golden.test.ts               -- the golden runner
  patch-7-3-conformance.test.ts -- every skeleton item/champion parses against its Zod schema
```

The original spec sketch also called for `packages/data/fixtures/`, synthetic items for mechanics
tests. **Dropped**: Steps 2-5's effect-kind tests each inline their own synthetic fixtures
per-test-file (`packages/calc/test/effects/*.test.ts`) and never needed a shared fixtures
directory across 5 steps of implementation. Adding one now would be unused surface area — YAGNI.

The catalog builder shape matches the existing `StatCatalog` consumption pattern established in
`docs/decisions/2026-09-10-resolve-stats-item-rune-catalog.md`
(`{ items: Map<string, Item>, runes: Map<string, Rune> }`), so callers (golden runner, future
debug page) build it the same way `resolveStats` already expects.

## 4. Golden runner

Case format (from the original spec): `{ scenario, expected, tolerance, patch, source }`.

- `scenario`: `{ championId, level, build: Build, target, combo }` — enough to build a `Combatant`
  via `combatantFromChampion`/`combatantFromDummy` and run it through `simulateCombo` or
  `compareBuilds`, reusing existing Step 4/5 machinery rather than a parallel code path.
- `expected`: a *partial* result object — only the fields the practice-tool run actually measured
  (e.g. `timeToKill`, specific damage totals). The runner checks each present field within
  `tolerance`; it doesn't require every output field to be specified.
- `tolerance`: a fraction (e.g. `0.02` = 2%) applied to numeric comparisons, to absorb rounding
  and any minor unmodeled mechanics.
- `patch`: must match the `patches/<version>/` directory the scenario's catalog comes from; the
  runner loads that patch's catalog before building the combatant.
- `source: 'practice-tool'`: marks a case as a real, in-game-verified result.

Runner (`packages/data/test/golden.test.ts`): globs `golden/*.json`, and for each file emits one
Vitest `it()` via `it.each`. Zero case files today means zero generated tests — visible as "0
tests" in that file's output, not a silently-passing or hidden state. This needs no
skip/conditional branch: an empty glob naturally produces an empty test list. The one
committed example lives in `golden/README.md` as prose + an annotated JSON snippet, not a `.json`
file, so it documents the format without being picked up by the glob or asserting on invented
numbers.

## 5. Testing plan

- `packages/schema/test/champion.test.ts`: cover the new `provenance` field (required, same shape
  validation as `Item.provenance`).
- `packages/data/test/patch-7-3-conformance.test.ts` (new): every exported item/champion in
  `patches/7.3` parses against `ItemSchema`/`ChampionSchema` — this is the actual regression
  protection for the skeleton data itself (typos, missing fields), independent of the golden
  runner.
- `packages/data/test/golden.test.ts` (new): the runner described above.
- The 7 existing Champion-literal call sites get their one-line `provenance` fix-up; no new
  assertions needed there, they already test what they tested before.

## 6. Out of scope

- Runes (matches original spec).
- Real (non-null) stat values for the starter items/champions — user fills these in later from
  in-game/practice-tool testing, per the original "skeletons now, verified later" design.
- The `Build.enchant` / `ItemTierSchema` `'enchant'`-tier consolidation (logged as a new gap, not
  scoped here).
- Step 7 (debug page) — separate work-order item, comes after this one.

## 7. Work breakdown preview

For the implementation plan (sized/split further by subagent-driven-development):

1. `ChampionSchema.provenance` field + `HAS_SEPARATE_ENCHANT_SLOT` fix + 7-file fixture fix-up.
2. `packages/data/src/patches/7.3/items.ts` — 15 item skeletons.
3. `packages/data/src/patches/7.3/champions.ts` — 4 champion skeletons.
4. `packages/data/src/patches/7.3/index.ts` + `packages/data/src/index.ts` — catalog builder and
   package exports.
5. `packages/data/golden/README.md` + `packages/data/test/golden.test.ts` — runner, zero real
   cases.
6. `packages/data/test/patch-7-3-conformance.test.ts` — schema-conformance smoke tests.
7. Final whole-branch review (per the SDD skill's convention from Steps 4-5).
