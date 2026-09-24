# ADR: Linear stat growth, curved attack-speed growth, and a 200% crit base

**Status:** Accepted

## Context

Two rules in `packages/calc/src/rules.ts` were assumptions carried over from PC League of Legends:

- `statAtLevel` used the classic non-linear growth curve (`base + perLevel * n * (0.7025 + B * n)`,
  rescaled to `MAX_CHAMPION_LEVEL`) for every champion stat.
- `BASE_CRIT_DAMAGE_MULTIPLIER` was 1.75.

The wrpocket.app 7.3 data (`packages/data/.cache/wrpocket/`, see
`docs/superpowers/specs/2026-09-24-wrpocket-import-design.md`) contradicts both:

- Every per-level stat table except attack speed is a straight line from level 1 to 15 for all 142
  champions (the importer's `linearityNotes` flags nothing beyond a 1-point tolerance).
- Attack speed is not linear: it misses a straight line by up to 0.03 (Kalista), but fits the
  existing curve (`base * (1 + ratio * n * (A + B * n))`) within 0.0022 for all 142 champions.
- Infinity Edge's 7.3 text reads "Critical strike damage increased from 200% to 230%", and the item
  is modeled with `critDamage: 0.3`, so a 1.75 base put crit builds about 12% low.

## Decision

- `statAtLevel` is linear: `base + perLevel * (level - 1)`. The importer's `fitGrowth` already fits
  `perLevel` from levels 1 and 15, so imported data needs no change.
- `attackSpeedAtLevel` keeps the curve; its constants are renamed `ATTACK_SPEED_CURVE_A/B`.
- `BASE_CRIT_DAMAGE_MULTIPLIER` is 2.0.

All three stay marked TODO-VERIFY: the evidence is third-party site data and item text, not
practice-tool measurements.

## Consequences

- Mid-level stats (levels 2-14) change; levels 1 and 15 are unchanged. The user's level-8 Jinx HP
  check should now match `base + 7 * perLevel`.
- Crit damage rises by 25 percentage points in `always` mode and proportionally in `expected` mode.
- Tests that encoded the old rules (`statAtLevel` "grows non-linearly", the 1.95/0.75 crit
  expectations in `rules.test.ts`, the 175 AA crit in `simulate-combo.test.ts`) were updated to the
  new rules.
