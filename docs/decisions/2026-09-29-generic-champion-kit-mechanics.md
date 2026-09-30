# ADR: Generic champion kit mechanics

**Status:** Accepted

## Context

Ambessa (and most fighters/assassins) need recasts, dash-triggered effects, empowered-attack
charges, ratios that grow with a second stat, and stats from their own ability ranks. Champions
had no effects and one damage list per key. The user chose a generic design over an
Ambessa-only handler so Riven, Jax, Camille and others become mostly data.
Spec: docs/superpowers/specs/2026-09-29-generic-champion-kit-mechanics-design.md

## Decision

- `ability.effects` reuse the item/rune effect system; `bindAbilityRank` replaces `byRank`
  values with the ability's rank before use; they run before item and rune effects.
- Ratios take an optional `perStat` (coefficient = value + perStat.value × stat).
- `ability.stages` (press or dash trigger, window from the previous cast's end, all stages
  assumed to hit) with `cooldownStartsOn` `firstCast` (default) or `lastStage`.
- A `dash` combo action (`DASH_SECONDS`, unverified) with an `onDash` hook; each ability cast
  can feed one feint; a dash-triggered stage can't feed another.
- `empoweredAttack` charges (shared, refreshed expiry — unverified) spend one per attack, deal
  their bonus as a separate instance and speed up only that swing, capped.
- Hand-modelled champions merge over generated data (`HAND_MODELED_CHAMPIONS`).
- The damage-component schema moved to its own file so effect kinds can use it without an
  import cycle with `ability.ts`.
- To keep `declaration: true` builds under TypeScript's type-serialization limit (TS7056), `AbilityEffectsSchema` and `ChampionAbilitiesSchema` carry explicit annotations that reference schemas by name.

## Consequences

- Ambessa's values are placeholders from her ability text until the baseline readings arrive.
- Energy costs, healing and positional variants are not modeled; the combo search (sub-project D)
  owns costs.
