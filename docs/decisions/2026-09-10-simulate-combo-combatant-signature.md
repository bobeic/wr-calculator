# ADR: `simulateCombo` takes pre-resolved `Combatant`s, not raw `Champion`/`Target`

**Status:** Accepted

## Context

The Phase 1 design doc (`docs/superpowers/specs/2026-09-10-phase1-engine-schema-fixtures-design.md`)
sketches `simulateCombo(attacker, target, sequence, options) → ComboResult` without fully specifying
the types of `attacker`/`target`. The doc's own `Target` schema is `{ kind: 'champion', champion:
string, level: number, build: Build } | { kind: 'dummy', hp, armor, mr, effects? }` — for the
champion variant, `champion` is an id string, not an embedded `Champion` object, so resolving it
needs a champion catalog `simulateCombo` doesn't otherwise require. Separately, building either side
of a combat participant already requires calling `resolveStats` (Step 2) first to get a `StatSheet`,
and requires flattening the participant's equipped items/runes into a hookable effect list — work
that has nothing to do with the combat timeline itself.

## Decision

`simulateCombo` takes two pre-resolved `Combatant`s:

```ts
interface Combatant {
  id: string
  name: string
  kind: 'champion' | 'monster' | 'dummy'
  level: number
  sheet: StatSheet
  items: Item[]
  runeEffects: Effect[]
  inputs: Record<string, number | boolean>
  abilities?: Champion['abilities']
}

simulateCombo(
  attacker: Combatant, target: Combatant, sequence: ComboAction[], options?: SimulateComboOptions
) → ComboResult
```

Two builder functions in `packages/calc/src/combatant.ts` go from raw data to a `Combatant`:
`combatantFromChampion(champion, level, build, catalog)` (calls `resolveStats` internally, then
resolves `build.items`/`boots`/`enchant` into `Item[]` and `build.runes` into flattened
`Effect[]`) and `combatantFromDummy(dummy)` (synthesizes a bare `StatSheet` from `hp`/`armor`/`mr`,
no abilities, no items).

This mirrors the pattern the Step 2 catalog-parameter ADR already established for `resolveStats`:
callers assemble the fully-resolved shape once, the engine function itself stays a pure consumer of
already-resolved data with no internal lookup/loading.

## Consequences

- Callers (tests, the future debug page, a later `compareBuilds`) call `combatantFromChampion`/
  `combatantFromDummy` once per side before calling `simulateCombo`, the same way they already call
  `resolveStats` before anything else needs a `StatSheet`.
- `simulateCombo` never needs a champion catalog, only the item/rune catalog `combatantFromChampion`
  already threads through from `resolveStats`'s own `StatCatalog`.
- `Combatant.level` and `Combatant.inputs` travel with each side (rather than being single globals
  passed to `simulateCombo`) because effect dispatch during combat is per-owner: a target's own
  `damageReduction` effect resolves its scalars, and any `toggle`/`stacksAtMax` condition, against
  the *target's* level and build inputs, not the attacker's — something a single global level/inputs
  parameter on `simulateCombo` itself couldn't express once both sides can carry equipped effects.
