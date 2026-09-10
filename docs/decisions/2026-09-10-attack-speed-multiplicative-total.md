# ADR: `total.attackSpeed` combines base and bonus multiplicatively

**Status:** Accepted

## Context

The Phase 1 design doc (`docs/superpowers/specs/2026-09-10-phase1-engine-schema-fixtures-design.md`)
documents the `attackSpeed` StatKey as `"(bonus, fraction)"` in its StatKey list: `bonus.attackSpeed`
is a fraction (e.g. `0.25` = +25% attack speed from items/runes/effects), while `base.attackSpeed`
(written once per `resolveStats` call, from `attackSpeedAtLevel`) is an absolute rate — attacks per
second, e.g. `0.625`.

The original `resolveStats` implementation computed `total.attackSpeed = base.attackSpeed +
bonus.attackSpeed` via the same generic per-stat additive total loop used for every other stat, and
the AS-cap check similarly summed `base.attackSpeed` and `bonus.attackSpeed` directly. Adding a
fraction to an absolute rate is dimensionally wrong — it silently understates the effect of bonus AS
sources, since a fraction like `0.25` barely moves an absolute rate around `0.6-0.9` when added, but
should scale it up by 25% when applied correctly. This also would have been inconsistent with
`attackSpeedAtLevel`, which already treats champion AS growth-per-level as multiplicative rather
than additive.

## Decision

`total.attackSpeed = base.attackSpeed * (1 + bonus.attackSpeed)`, implemented as `totalAttackSpeed()`
in `packages/calc/src/rules.ts`:

```ts
export function totalAttackSpeed(base: number, bonusFraction: number): number {
  return base * (1 + bonusFraction)
}
```

This is special-cased in two places in `packages/calc/src/resolve-stats.ts`:

- The per-stat total-assembly loop uses `totalAttackSpeed(baseValue, bonusValue)` for `attackSpeed`
  instead of the generic `baseValue + bonusValue` used for every other stat.
- The AS-cap check computes the uncapped total with `totalAttackSpeed` and, when it exceeds
  `ATTACK_SPEED_CAP`, records a bonus-layer correction expressed as a fraction delta
  (`cappedBonusFraction - bonus.attackSpeed`, where `cappedBonusFraction = ATTACK_SPEED_CAP /
  base.attackSpeed - 1`) rather than the flat delta that a purely additive model would use — a flat
  delta cannot bring a multiplicative total down to exactly the cap. A `base.attackSpeed > 0` guard
  avoids dividing by zero for a champion with 0 base AS; in that pathological case the correction is
  skipped rather than crashing, consistent with this codebase's "never throw on bad data" ethos.

## Consequences

- Every other StatKey stays additive (`total[stat] = base[stat] + bonus[stat]`); `attackSpeed` is
  the only stat where base and bonus have different units and therefore combine differently.
- This is marked `TODO-VERIFY(attackSpeedStacking)` like the rest of `rules.ts`, since real
  in-game AS-stacking behavior (multiplicative vs. additive) isn't confirmed against the practice
  tool yet — only inferred from the spec's StatKey annotation and consistency with
  `attackSpeedAtLevel`.
- The AS-cap correction's breakdown entry now records a fraction amount, not an absolute-rate
  amount, matching the fractional unit of every other `attackSpeed`/`bonus` breakdown entry.
