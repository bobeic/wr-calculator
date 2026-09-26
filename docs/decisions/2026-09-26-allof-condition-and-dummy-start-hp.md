# ADR: `allOf` conditions and a dummy start-HP fraction

**Status:** Accepted

## Context

Infinity Orb's Inevitable Demise amplifies damage by 20% only when two things are true: the target
is below 40% HP and the damage comes from an ability. The 7.3 practice tool confirmed both halves:
Annie's Q, W and R dealt exactly 1.2x below 40%, and Luden's Echo (source kind `item`) was not
amplified.

An effect had exactly one `condition`, with no way to combine them. Separately, `simulateCombo`
always started the target at full HP, so no golden case could record a hit below a low-HP threshold.

## Decision

- `ConditionSchema` gains `{ type: 'allOf', conditions: LeafCondition[] }` (at least two). Its
  members are leaf conditions only, with no nested `allOf`, so the schema stays non-recursive
  (no `z.lazy`). `evaluateCondition` returns true when every member holds.
- This was chosen over a `sourceKinds` filter on `damageAmp` because it works for any effect kind
  and any mix of conditions (e.g. "abilities against champions").
- `TargetDummySchema` and the golden target gain an optional `startHpFraction` (0 < x <= 1, default
  1). `Combatant.startHpFraction` carries it, and `simulateCombo` starts each combatant at
  `maxHp * startHpFraction`.

## Consequences

- Infinity Orb is modeled as a `damageAmp` of 0.2 with
  `allOf[targetHpBelow 0.4, sourceKind ability]`. The HP check uses the target's HP before the hit.
- "Empowered attacks" are not amplified (there's no source kind for them); this matters only for
  champions with empowered basic attacks, not Annie.
- `anyOf` or nesting can be added later if an item needs them.
