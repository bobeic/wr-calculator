# Phase 1 / Step 3 — Mitigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the pure resist/mitigation math (`packages/calc/src/mitigation.ts`) that Step 4's
`simulateCombo` will call on every damage instance: turning a raw resist value plus modifiers into
a mitigation multiplier, applying it to raw damage, and layering target `damageReduction` effect
fractions on afterward.

**Architecture:** A small, dependency-free module of pure functions (no Effect objects, no hooks,
no envelope tracking) — mirroring `resolve-scalar.ts`'s role in Step 2. `simulateCombo` (Step 4) is
responsible for gathering the `ResistModifiers` values (from attacker's stat-based pen, `resistShred`
runtime state, conditional `penetration` effects) and the `damageReduction` fractions (from target's
effects) before calling into this module, and for tagging `unverifiedRules` when it does. This keeps
mitigation testable in complete isolation, exactly like Step 2's `resolveScalar`.

**Tech Stack:** TypeScript strict, Vitest, `@wr-calc/schema` (types only).

**Spec:** `docs/superpowers/specs/2026-09-10-phase1-engine-schema-fixtures-design.md`, section "2.
Mitigation".

## Global Constraints

- TypeScript strict mode; every new file needs full type annotations on exported functions.
- Percentages are fractions (0.25 = 25%), matching the schema's convention.
- The engine is pure: deterministic, no I/O, no hidden module-level state.
- No champion or item names in engine code.
- Commit after the task.

---

## Design notes (read before starting)

1. **`mitigation.ts` has no knowledge of `Effect`, hooks, or `unverifiedRules`.** It takes plain
   numbers in and returns plain numbers out. `RESIST_MODIFICATION_ORDER` (already in `rules.ts`,
   Step 1) is consumed directly; tagging `'resistModificationOrder'` in a result's
   `unverifiedRules` is the caller's (Step 4's) job, the same way `resolveStats` — not
   `resolveScalar` — is what pushes to `unverifiedRules` today.
2. **`ResistModifiers` has four fields**: `flatReduction`, `pctReduction`, `pctPen`, `flatPen` —
   matching `RESIST_MODIFICATION_ORDER`'s four steps one-to-one. `effectiveResist` applies them in
   that order, each step operating on the *running* resist value from the previous step (not the
   original raw value), per the spec: "Resist modification order in rules.ts." Reduction steps can
   drive the running value negative; penetration steps clamp it to a minimum of 0 (spec: "Penetration
   cannot take resist below 0; reduction can").
3. **`packages/schema/src/ability.ts` gains a `DamageType` type export** (`z.infer` of the
   `DamageTypeSchema` already defined there) — needed by `mitigation.ts` and by every Step 4 combat
   file that follows. This is the one schema change in this step; it's purely additive (no schema
   shape changes, just a missing type alias).
4. **`applyDamageReductionFractions` stacks multiplicatively**: each fraction removes that share of
   whatever remains after the previous one, `remaining *= (1 - fraction)` — this is the "Target
   `damageReduction` effects apply after" step from the spec, applied post-mitigation. It takes a
   plain `number[]` of already-resolved fractions; resolving which of a target's effects apply (and
   their conditions) is Step 4's job (the `damageReduction` handler), not this module's.

---

### Task 1: `mitigation.ts` — resist modification, mitigation multiplier, damage application

**Files:**
- Modify: `packages/schema/src/ability.ts`
- Create: `packages/calc/src/mitigation.ts`
- Modify: `packages/calc/src/index.ts`
- Test: `packages/calc/test/mitigation.test.ts`

**Interfaces:**
- Consumes: `RESIST_MODIFICATION_ORDER` from `./rules` (Step 1, unchanged); `DamageType` from
  `@wr-calc/schema` (this task adds the export).
- Produces: `interface ResistModifiers { flatReduction: number; pctReduction: number; pctPen:
  number; flatPen: number }`, `ZERO_RESIST_MODIFIERS: ResistModifiers`, `effectiveResist(rawResist:
  number, modifiers?: ResistModifiers): number`, `mitigationMultiplier(resist: number): number`,
  `mitigateDamage(rawDamage: number, damageType: DamageType, rawResist: number, modifiers?:
  ResistModifiers): number`, `applyDamageReductionFractions(amount: number, fractions: number[]):
  number`.

- [ ] **Step 1: Write the failing tests**

Create `packages/calc/test/mitigation.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  effectiveResist, mitigationMultiplier, mitigateDamage, applyDamageReductionFractions,
} from '../src/mitigation'

describe('mitigationMultiplier', () => {
  it('is 1 at 0 resist', () => {
    expect(mitigationMultiplier(0)).toBe(1)
  })

  it('is 0.5 at 100 resist', () => {
    expect(mitigationMultiplier(100)).toBe(0.5)
  })

  it('approaches 1/3 at 200 resist', () => {
    expect(mitigationMultiplier(200)).toBeCloseTo(1 / 3)
  })

  it('amplifies damage at negative resist', () => {
    expect(mitigationMultiplier(-100)).toBe(1.5)
  })
})

describe('effectiveResist', () => {
  it('returns the raw value with no modifiers', () => {
    expect(effectiveResist(50)).toBe(50)
  })

  it('lets flat reduction drive resist negative', () => {
    expect(effectiveResist(30, {
      flatReduction: 50, pctReduction: 0, pctPen: 0, flatPen: 0,
    })).toBe(-20)
  })

  it('applies percent reduction to the running value', () => {
    expect(effectiveResist(100, {
      flatReduction: 0, pctReduction: 0.5, pctPen: 0, flatPen: 0,
    })).toBe(50)
  })

  it('clamps percent penetration at 0', () => {
    expect(effectiveResist(10, {
      flatReduction: 0, pctReduction: 0, pctPen: 2, flatPen: 0,
    })).toBe(0)
  })

  it('clamps flat penetration at 0', () => {
    expect(effectiveResist(10, {
      flatReduction: 0, pctReduction: 0, pctPen: 0, flatPen: 50,
    })).toBe(0)
  })

  it('applies all four steps in RESIST_MODIFICATION_ORDER', () => {
    // 100 -> flatReduction 20 -> 80 -> pctReduction 0 -> 80 -> pctPen 0.5 -> 40 -> flatPen 0 -> 40
    expect(effectiveResist(100, {
      flatReduction: 20, pctReduction: 0, pctPen: 0.5, flatPen: 0,
    })).toBe(40)
  })
})

describe('mitigateDamage', () => {
  it('passes true damage through unaffected by resist', () => {
    expect(mitigateDamage(100, 'true', 500)).toBe(100)
  })

  it('mitigates physical damage using the resist formula', () => {
    expect(mitigateDamage(100, 'physical', 100)).toBe(50)
  })

  it('applies resist modifiers before mitigating', () => {
    const modifiers = { flatReduction: 0, pctReduction: 0, pctPen: 0, flatPen: 100 }
    expect(mitigateDamage(100, 'magic', 100, modifiers)).toBe(100)
  })
})

describe('applyDamageReductionFractions', () => {
  it('returns the amount unchanged with no fractions', () => {
    expect(applyDamageReductionFractions(100, [])).toBe(100)
  })

  it('stacks fractions multiplicatively', () => {
    expect(applyDamageReductionFractions(100, [0.5, 0.5])).toBe(25)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @wr-calc/calc test`
Expected: FAIL — `../src/mitigation` does not exist.

- [ ] **Step 3: Implement**

In `packages/schema/src/ability.ts`, add directly below the existing `DamageTypeSchema` line
(`export const DamageTypeSchema = z.enum(['physical', 'magic', 'true'])`):

```ts
export type DamageType = z.infer<typeof DamageTypeSchema>
```

Create `packages/calc/src/mitigation.ts`:

```ts
import type { DamageType } from '@wr-calc/schema'
import { RESIST_MODIFICATION_ORDER } from './rules'

export interface ResistModifiers {
  flatReduction: number
  pctReduction: number
  pctPen: number
  flatPen: number
}

export const ZERO_RESIST_MODIFIERS: ResistModifiers = {
  flatReduction: 0, pctReduction: 0, pctPen: 0, flatPen: 0,
}

/**
 * Applies resist modifiers to a raw resist value in RESIST_MODIFICATION_ORDER, each step reading
 * the running value left by the previous one. Reduction (flat/percent) can drive resist negative;
 * penetration (flat/percent) cannot take it below 0.
 */
export function effectiveResist(
  rawResist: number, modifiers: ResistModifiers = ZERO_RESIST_MODIFIERS
): number {
  let resist = rawResist
  for (const step of RESIST_MODIFICATION_ORDER) {
    if (step === 'flatReduction') resist -= modifiers.flatReduction
    else if (step === 'pctReduction') resist -= resist * modifiers.pctReduction
    else if (step === 'pctPen') resist = Math.max(0, resist - resist * modifiers.pctPen)
    else resist = Math.max(0, resist - modifiers.flatPen)
  }
  return resist
}

/** The fraction of raw damage that gets through a given (already-modified) resist value. */
export function mitigationMultiplier(resist: number): number {
  return resist >= 0 ? 100 / (100 + resist) : 2 - 100 / (100 - resist)
}

/** Mitigates raw damage of a given type by a raw resist value and its modifiers. True damage passes through unaffected. */
export function mitigateDamage(
  rawDamage: number, damageType: DamageType, rawResist: number,
  modifiers: ResistModifiers = ZERO_RESIST_MODIFIERS
): number {
  if (damageType === 'true') return rawDamage
  return rawDamage * mitigationMultiplier(effectiveResist(rawResist, modifiers))
}

/** Applies target damageReduction effect fractions after resist mitigation, stacking multiplicatively. */
export function applyDamageReductionFractions(amount: number, fractions: number[]): number {
  return fractions.reduce((remaining, fraction) => remaining * (1 - fraction), amount)
}
```

Update `packages/calc/src/index.ts` to add one line:

```ts
export * from './mitigation'
```

(keep every existing export line unchanged; this is a pure addition)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @wr-calc/calc test`
Expected: PASS, all tests in `mitigation.test.ts` green.

- [ ] **Step 5: Run the full monorepo test suite and typecheck**

Run: `pnpm run typecheck && pnpm run test`
Expected: PASS — every package, no regressions (the `DamageType` export addition must not break
`packages/schema`'s own build/tests).

- [ ] **Step 6: Commit**

```bash
git add packages/schema/src/ability.ts packages/calc/src/mitigation.ts \
  packages/calc/src/index.ts packages/calc/test/mitigation.test.ts
git commit -m "feat: add mitigation.ts (resist modification, mitigation multiplier, damage reduction stacking)"
```

---

## Self-review notes

- **Spec coverage:** all four bullets under "2. Mitigation" are implemented: the R≥0/R<0 formula,
  resist modification order (flat reduction → % reduction → % pen → flat pen, pen clamped at 0,
  reduction allowed negative), and target `damageReduction` effects applying after (as a
  composable, effect-agnostic fraction-stacking function Step 4 will feed from its `damageReduction`
  handler).
- **Placeholder scan:** none — the task has complete, runnable code.
- **Type consistency:** `ResistModifiers`'s four fields match `RESIST_MODIFICATION_ORDER`'s four
  string literals one-to-one; this is the type Step 4's `simulateCombo` will construct and pass into
  `mitigateDamage`.
