# Wild Rift Damage Calculator — Phase 1: Engine, Schema, Fixtures

Design doc. Elaborates and resolves ambiguities in the original phase-1 spec; where this doc
changes or fixes something in that spec, it's called out explicitly as **Spec fix**.

## Goal

Build the calculation core of a Wild Rift build/damage calculator: comparing builds and runes
against a target, and showing where one build overtakes another as gold increases. This phase
builds the **engine and data schema only**. A future data pipeline (patch notes + in-game
verification) populates the same schema, so the schema is designed around what the engine needs,
not the other way round.

### Hard principles

1. The engine contains mechanics, not game values. Every game number lives in data files
   validated by the schema.
2. Unverified mechanics live in one place: `packages/calc/src/rules.ts`, each marked
   `// TODO-VERIFY` with a note on how to check it in the practice tool. Never scatter them.
3. No champion or item names in engine code. Never `if (item.name === ...)`. Unusual behaviour
   goes through a custom handler registered by id.
4. Every effect declares its support level (`full` / `partial` / `none`). Unmodelled effects are
   surfaced in results, never silently ignored.
5. The engine is pure TypeScript. Deterministic, no I/O, no React, runs in browser and Node.
6. No real game values are filled in from memory or the internet. Real values are entered by the
   project owner after verifying in-game.

Champion **base stats are not a minor input**. `totalAd` (base+bonus) vs `bonusAd`-only is a
distinction the real game makes constantly (most on-hit effects and many ability ratios key off
`totalAd` specifically, which is why the schema tracks both), base HP/armor/MR determine effective
HP even on a bare champion, base mana feeds Muramana/Seraph's-Embrace-style scaling, and base
attack speed sets the interval the combo timeline advances on for every `AA`. `resolveStats`
resolves champion base+growth first, before any item/rune contribution, and keeps base/bonus/total
separate all the way through so ratios can target whichever the real effect actually uses.

## Stack & repo

pnpm workspaces (via `corepack enable && corepack prepare pnpm@latest --activate` — pnpm isn't
installed globally in this environment, so pin the version in `package.json#packageManager`
rather than a global install), TypeScript strict with project references enforcing dependency
direction `schema → {calc, data} → web`, Zod, Vitest (root-level config, per-package test globs).

```
packages/schema   Zod schemas + inferred types (the contract with the future pipeline)
packages/calc     engine (pure)
packages/data     patches/index.json, patches/<version>/{items,champions,runes,targets}.json,
                  fixtures/ (synthetic), golden/ (practice-tool test cases)
apps/web          Next.js, one bare debug page
```

`packages/data/patches` mirrors a future static API (`/v1/patches.json`, `/v1/<patch>/items.json`,
`/v1/latest/...`). It will later be published to a CDN unchanged, so nothing in it may depend on
`apps/web`. `packages/calc` may take a **dev-only** dependency on `packages/data` (fixtures/golden
cases in tests) — never a runtime one.

## Conventions

- Percentages are fractions (0.25 = 25%).
- Stat keys are a closed enum; unknown keys fail validation.
- Any game value may be a `Scalar`:
  - `number`
  - `{ byLevel: number[] }` (champion levels 1..max)
  - `{ levelRange: { min: number, max: number } }` for "X–Y based on level" (interpolation rule in
    rules.ts)
  - `{ byRank: number[] }` (ability ranks)
- Real values not yet entered are `null`. **Resolved behaviour:** the engine treats a `null`
  scalar as `0` and records it in the result's `dataWarnings` list (e.g. `"Rabadon's Deathcap: ap
  is unverified (null)"`), rather than throwing. This lets a half-filled patch be simulated
  end-to-end, with numbers becoming real as they're entered.

## Schema (packages/schema)

No dependency on `packages/calc`. Layout:

```
packages/schema/src/
  stat-key.ts       StatKey enum
  scalar.ts         Scalar union + interpolation helper types (logic lives in calc/rules.ts)
  effect/
    condition.ts    Condition union
    kinds/          one schema file per Effect kind (or grouped if small)
    effect.ts        the discriminated Effect union
  item.ts
  champion.ts
  ability.ts
  build.ts
  target.ts
  rune.ts
  provenance.ts
  validate/         cross-field checks (see Validator below)
  index.ts
```

### StatKey enum
`hp, hpRegen, mana, manaRegen, ad, ap, armor, mr, attackSpeed (bonus, fraction), critChance,
critDamage (bonus), abilityHaste, moveSpeed, moveSpeedPct, flatArmorPen, pctArmorPen,
flatMagicPen, pctMagicPen, lifesteal, physicalVamp, omnivamp, healShieldPower, tenacity`. Extend
only via the enum.

### Item
```ts
{
  id: string                 // stable slug, never the display name
  name: string
  tier: 'basic' | 'epic' | 'legendary' | 'boots' | 'enchant' | 'support' | 'consumable'
  cost: { total: number, combine: number }
  recipe: string[]           // component ids
  stats: Partial<Record<StatKey, Scalar>>
  effects: Effect[]
  tags: string[]
  provenance: {
    source: 'manual' | 'wiki' | 'patch-notes' | 'in-game'
    patch: string
    verifiedInGame: boolean
    verifiedAt?: string
  }
}
```

### Effect (the core)

Discriminated union on `kind`. `kind` identifies the *mechanical pattern* an effect follows (on-hit
rider, stacking passive, resist shred, DoT, ...) — never the item/ability it belongs to. Two
different items' on-hit passives are both `kind: 'onHit'` with different field values; the engine
dispatches on `kind` and never on identity.

Every effect has: `id`, `name` (passive name as shown in game), `description` (raw game text, for
display), `uniqueGroup?`, `support`, `supportNotes?`, and `inputs?` (user-controlled parameters
the UI renders automatically — stack count with min/max/default, boolean toggles).

Kinds: `stat`, `statMultiplier`, `statConversion`, `stacking`, `onHit`, `spellblade`,
`procEveryN`, `dot`, `resistShred`, `penetration`, `damageAmp`, `cooldownRefund`,
`damageReduction`, `shield`/`heal`, `active`, `custom` (`{ handler: string }`, implemented in
`packages/calc/src/custom/<handler>.ts`, registered by id, still declares a support level).

Conditions: small typed union (`targetHpBelow`, `targetHpAbove`, `stacksAtMax`, `toggle`,
`damageType`, `sourceKind`, `targetIsChampion`, `targetIsMonster`). No string expressions, no eval.

Runes reuse the same Effect union. Rune paths and slots are data-driven.

### Champion & Ability
```ts
Champion {
  id, name, resource: 'mana' | 'energy' | 'none' | 'other'
  baseStats: Partial<Record<StatKey, { base: number, perLevel: number }>>
  attackSpeed: { base: number, ratio?: number }
  abilities: { passive: Ability, q: Ability, w: Ability, e: Ability, r: Ability }
}
Ability {
  id, name, maxRank, cooldown: Scalar, cost?: Scalar, castTime: number
  damage: DamageComponent[]
  flags: { appliesOnHit?, triggersSpellblade?, resetsBasicAttack?, ... }
  custom?: string            // handler id for kits that don't fit
}
DamageComponent {
  type: 'physical' | 'magic' | 'true'
  base: Scalar
  ratios: { stat: 'totalAd' | 'bonusAd' | 'ap' | 'maxHp' | 'bonusHp' | 'targetMaxHp'
               | 'targetCurrentHp' | 'targetMissingHp' | ..., value: Scalar }[]
  hits?: number
  tags: string[]
}
```

### Build & Target
- `Build`: `{ items: string[] (purchase order), boots?, enchant?, runes, inputs: Record<string,
  number | boolean> }`. Slot limits come from rules.ts.
- `Target`: either `{ champion, level, build }` or a dummy `{ hp, armor, mr, effects? }`. Presets
  (squishy/bruiser/tank) live in `targets.json`, not code.

### Validator — dependency resolution

**Spec fix.** The original spec put "custom handler ids exist" validation inside `packages/schema`,
but that check needs to know which handlers `packages/calc` has actually registered — and
`schema` must stay dependency-free (it's the standalone pipeline contract). Resolution:

- `packages/schema/src/validate/` does every check that's self-contained: `cost.total ===
  sum(component totals) + combine`, recipe ids exist within the same patch, unique-group
  consistency, stat-key enum membership. Its handler-id check is parameterized —
  `validateItem(item, { knownHandlerIds: Set<string> })` — so it never imports `calc`.
- `packages/data/scripts/validate.ts` is the actual call site: it imports both `schema`'s
  validator and `calc`'s effect/custom registries, and passes the real handler id set through.
  This is the one place in the repo allowed to depend on both.

## Engine (packages/calc)

```
packages/calc/src/
  rules.ts                  TODO-VERIFY constants, see below
  resolve-stats.ts
  mitigation.ts
  simulate-combo.ts
  effects/
    registry.ts              Record<EffectKind, EffectHandler>
    stat.ts, stat-multiplier.ts, stat-conversion.ts, stacking.ts, on-hit.ts,
    spellblade.ts, proc-every-n.ts, dot.ts, resist-shred.ts, penetration.ts,
    damage-amp.ts, cooldown-refund.ts, damage-reduction.ts, shield-heal.ts, active.ts
  custom/
    registry.ts               Record<string, EffectHandler>  (handler id → implementation)
  analysis/
    sustained-dps.ts, effective-hp.ts, gold-efficiency.ts, compare-builds.ts
  index.ts
```

### Effect dispatch — handler registry (chosen over inline switch or compiled IR)

Considered three approaches:

- **Switch-on-kind inside the engine** — fastest to write, but puts all ~15 kinds' logic inside
  the files that also own stat resolution and the combat timeline; violates principle 2, and is
  the wr-database anti-pattern (behaviour keyed by identity inside a monolith) one level of
  abstraction up (keyed by kind instead of by name, still inline in the core).
- **Compile effects to a flattened IR** (`Modifier[]`/`Trigger[]`) upfront, sim only reads the IR —
  fastest sim loop and caches well, but stateful mechanics (spellblade ICD, `procEveryN`'s
  per-target hit counter, DoT refresh rules) don't flatten in advance; they depend on what happens
  during the timeline. Forcing them into a static IR means approximating or rebuilding a shadow
  event system inside the IR — a real fidelity risk, not just inconvenience.
- **Handler registry keyed by kind (chosen).** The real game evaluates combat live: state (current
  HP, shred stacks, shields, cooldowns) mutates as events actually occur, in the order they occur —
  which `simulateCombo`'s hook design (`onBasicAttack`, `onAbilityCast`, `onAbilityHit`,
  `onDamageDealt`, `onTick`) already assumes. A handler registry is the direct implementation of
  that: each kind supplies hook functions under the same hook names the timeline defines, nothing
  is pre-flattened or approximated, and each mechanic is independently testable against its own
  synthetic fixture.

```ts
interface EffectHandler<E extends Effect> {
  kind: E['kind']
  contributeStats?(effect: E, ctx: StatContext): StatContribution[]
  hooks?: Partial<Record<HookName, HookFn<E>>>
}
```

`registry.ts` builds `Record<EffectKind, EffectHandler>`; both `resolveStats` and
`simulateCombo` look up `registry[effect.kind]` and never branch on kind themselves. `custom`
effects resolve to a handler implementing the identical interface, looked up by handler id in
`custom/registry.ts` — one dispatch mechanism, two lookup tables.

### 1. `resolveStats(champion, level, build) → StatSheet`

**Spec fix.** Original signature was `resolveStats(champion, level, build, runes, inputs)`, but
`Build` already carries `runes` and `inputs` — the extra parameters were redundant with the type.
Collapsed to three arguments.

Returns base / bonus / total per stat and a breakdown: `{ stat, source, layer, amount }[]`, where
`source` is `{ kind: 'champion' | 'item' | 'rune' | 'effect', id, name }` (names are fine in
*output* data for display; principle 3 only forbids branching on them in engine logic). Also
returns `dataWarnings` and `unverifiedRules` (see Result envelope).

Order (defined once, in rules.ts):
1. Champion base + growth for level
2. Flat stats from items, runes, stacking effects
3. `statMultiplier` effects
4. `statConversion` effects
5. Caps

**Caching.** `resolveStats` itself stays pure with no hidden state (a module-level cache would
violate "deterministic, no I/O"). `compareBuilds` instead creates a `Map` scoped to a single call,
keyed by `(championId, level, orderedItemIds, inputsHash, runesHash)`, and reuses it across the
~28 breakpoint simulations it runs internally. This removes the repeated-computation cost where it
actually occurs, without introducing cross-call state.

### 2. Mitigation
- Multiplier from resist R: R ≥ 0 → `100 / (100 + R)`; R < 0 → `2 − 100 / (100 − R)`.
- Resist modification order in rules.ts. Default: flat reduction → % reduction → % pen → flat pen.
  Penetration cannot take resist below 0; reduction can.
- Target `damageReduction` effects apply after.

### 3. `simulateCombo(attacker, target, sequence, options) → ComboResult`

Event-driven timeline (this is the model the effect-handler registry is built to serve — see
above).

- `sequence`: `'AA' | 'Q' | 'W' | 'E' | 'R' | 'item:<id>' | 'wait:<seconds>'`.
- Time advances by attack interval (from AS) or cast time. Cooldowns respected with ability haste;
  option to ignore cooldowns for pure burst.
- Each action emits `DamageInstance { time, source, sourceKind, type, raw, mitigated,
  targetHpAfter }`.
- Effect hooks: `onBasicAttack`, `onAbilityCast`, `onAbilityHit`, `onDamageDealt`, `onTick`. Hooks
  can emit instances, add/remove buffs and debuffs, and modify cooldowns.
- Target state (current HP, shred stacks, shields) updates after every instance, so % current HP
  effects are order-correct.
- Crit mode: `'expected' | 'always' | 'never'`.

Result: totals by damage type and source, instance log, `killed`, `timeToKill`, `overkill`, and
the three warning lists from the Result envelope below.

### 4. Analysis
- `sustainedDps(attacker, target, seconds, priority)`: auto-attacks plus abilities off cooldown.
- `effectiveHp(sheet)`: vs physical and magic.
- `goldEfficiency(item)`: stat gold values derived from basic items in the data, not hardcoded.
- `compareBuilds(a, b, target, scenario)`: series at every purchase breakpoint (after each
  completed item, optionally with next-item components) → `{ gold, burst, dps, ttk, ehp }[]` per
  build, for crossover charts.
- Performance: a Vitest test (from work-order step 5 onward) asserts `compareBuilds` for two
  6-item builds completes in under 5ms via `performance.now()`, generous enough not to flake in
  CI. Write the sim for clarity first; only optimize if this test fails.

### Result envelope — warnings as first-class output

Three lists compose through every engine output:
- `unsupportedEffects`: effects with `support: 'partial' | 'none'` that were actually involved in
  the computation, each with id, support level, and `supportNotes`.
- `dataWarnings`: which `null` data fields were treated as `0`, human-readable (item/champion name
  + field).
- `unverifiedRules`: stable ids of `rules.ts` `TODO-VERIFY` constants that were used (e.g.
  `'maxChampionLevel'`).

`resolveStats` produces its own; `simulateCombo` aggregates its own hook-triggered entries plus
whatever `resolveStats` produced for attacker/target; `compareBuilds` unions across every
breakpoint it computes.

## rules.ts (TODO-VERIFY)

Best-guess working values, not `null` — the engine must run end-to-end today. Each constant is
marked `// TODO-VERIFY` with a note on how to check it in the practice tool, and carries a stable
string id so call sites can tag `unverifiedRules` when they use it:

```ts
export const MAX_CHAMPION_LEVEL = 15 // TODO-VERIFY(maxChampionLevel): confirm level cap in practice tool
```

Covers: max champion level (believed 15), stat growth curve (believed LoL-style non-linear,
adjusted to the level cap), base crit damage multiplier (reported 175%), attack speed cap, resist
modification order, interpolation rule for "X–Y based on level", adaptive damage rule, slot rules
(item slots, boots, enchant), unique-effect resolution (strongest vs first).

## Data for this phase

- `packages/data/fixtures/`: synthetic items for mechanics tests — obviously named
  (`TEST_ONHIT_PCT_CURRENT`, `TEST_SPELLBLADE`, ...), round made-up numbers. Written by the
  assistant; these are arbitrary test values, not real game data, so principle 6 doesn't apply to
  them.
- `packages/data/patches/<current>/`: real data skeletons with `null` values and
  `verifiedInGame: false`, filled in later after in-game verification. Starter set, chosen to
  cover every effect kind:
  - plain stat components (Long Sword, B.F. Sword, an AP component)
  - Rabadon's Deathcap, Blade of the Ruined King, Trinity Force or Lich Bane, Liandry's
  - Void Staff, Black Cleaver, Infinity Edge, Navori Quickblades
  - Titanic Hydra or Heartsteel, Seraph's Embrace or Muramana
  - Plated Steelcaps, Force of Nature, one enchant
  - Champions: skeleton for Nunu & Willump, plus two more to be named.
- `packages/data/golden/`: practice-tool test cases `{ scenario, expected, tolerance, patch,
  source: 'practice-tool' }`. Start with one example-format file; the runner skips when there are
  no real cases. Populated over time from in-game testing.

## Tests (Vitest)

- Mitigation at 0, 100, and negative resists
- Stat order; breakdown sums equal totals
- Every effect kind via synthetic fixtures, one test file per handler
- Unique groups don't stack; conversions aren't circular
- % current HP order-dependence in combos
- Property test: adding a pure offensive stat item never lowers damage
- Validator rejects cost mismatches, unknown stat keys, unknown handler ids
- `compareBuilds` performance test (from step 5)
- Golden runner

## Debug page (apps/web)

One unstyled page for testing, not the real UI:
- Pickers: champion, level, two builds, target preset or custom
- Combo string input ("Q AA E AA R")
- Inputs auto-generated from effects' declared `inputs`
- Outputs: both stat sheets with breakdown, combo result and instance log, compareBuilds table,
  list of partial/unsupported effects involved, `dataWarnings` and `unverifiedRules`
- Full state in the URL query string

No design work. The real UI gets its own design pass later.

## Out of scope

Scraping and the pipeline, top-player builds, AI features, styling, auth, database.

## References (read for ideas, don't copy)

- github.com/Summerset94/wr-database: open-source WR calculator. Useful WR mechanics notes in its
  README. **Don't copy its architecture**: item effects are toggled by item name inside React
  components and abilities are hand-written per champion, so every patch requires code changes —
  precisely the pattern the handler-registry design (and principle 3) avoids.
- github.com/chaodhib/league-sim: game-data parser / shared structs / simulation split; item and
  combo optimisers.
- github.com/PauHPMCBR/LolDamageCalculator: combo vs DPS modes, build ranking, stat graphs.
- Path of Building (Path of Exile): supported vs unsupported modifiers shown distinctly, plus full
  calculation breakdowns. We want both.

## Work order

Commit after each step. Stop and summarise after steps 2 and 4 for review.

1. Monorepo, schema, validator, rules.ts
2. `resolveStats` + breakdown + tests
3. Mitigation + tests
4. `simulateCombo` + all effect kinds with synthetic fixtures + tests
5. `compareBuilds` / DPS / EHP + perf check
6. Real data skeletons (starter items, Nunu), golden runner
7. Debug page
