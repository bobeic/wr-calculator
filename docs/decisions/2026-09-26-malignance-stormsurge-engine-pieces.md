# ADR: Engine pieces for Malignance and Stormsurge

**Status:** Accepted (Stormsurge is not yet verified in game)

## Context

Malignance and Stormsurge are on the late-game Annie shortlist, but the engine couldn't express
them:

- Malignance: +20 ability haste for the ultimate only; a burn applied only when the ultimate hits,
  ticking for 60 + 5% AP; and -10 MR on the target while it burns. Measured in the 7.3 practice tool
  (2026-09-26): each tick dealt 70 against the 100 MR dummy (67 without the MR reduction), and
  Annie's R cooldown showed 44.4s (60 / 1.35).
- Stormsurge: once damage dealt within 2.5 seconds reaches 25% of the target's max HP, a hit of
  125 + 10% AP lands 2 seconds later (25-second cooldown).

## Decision

- **`ultimateHaste` stat:** added to `abilityHaste` for R's cooldown only.
- **`abilitySlot` condition (q/w/e/r):** checked only by the ability cast/hit hooks, which know the
  slot. Per-damage checks such as `damageAmp` have no slot, so it never matches there.
- **`dot.ratios`:** added to each tick, reading the attacker's stats when the dot is applied.
- **`dot.shredWhileActive`:** a flat armor or MR reduction while the dot is active, including its
  own ticks. It skips the dot's condition, because that condition already gated applying the dot
  (and an `abilitySlot` can't match a damage instance).
- **New kind `damageWindowProc`:** keeps the damage history (after resists) in the effect's
  runtime buff data and prunes it to the window. Crossing `targetMaxHpFraction` of the target's
  max HP schedules the hit after `delaySeconds` and starts the cooldown. Damage dealt during the
  cooldown isn't counted.

## Consequences

- Malignance and Stormsurge are modeled; Malignance has golden cases, Stormsurge doesn't yet (the
  dummy's 10,000 HP needs 2,500 damage in 2.5s).
- Whether Stormsurge counts damage before or after resists is unverified; after resists is assumed.
- Squall's "target dies first" splash and the movement speed are not modeled (1v1 damage scope).
