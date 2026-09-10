# Phase 1 / Step 2 — resolveStats + Breakdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `resolveStats(champion, level, build, catalog) → StatSheet`, the engine's
first computation: a champion's base/bonus/total stats for a level and build, with a full
per-contribution breakdown, `dataWarnings`, and `unverifiedRules`.

**Architecture:** A handler-registry dispatch (`Partial<Record<EffectKind, EffectHandler>>`) so
`resolveStats` never branches on effect kind. Only the four stat-contributing kinds (`stat`,
`stacking`, `statMultiplier`, `statConversion`) get handlers in this step; the remaining 13
combat-only kinds get their handlers in Step 4 alongside `simulateCombo`, which is what actually
needs them. Resolution runs in the order defined in `rules.ts`: champion base+growth, then three
effect-driven stages (flat, multiplier, conversion), then caps.

**Tech Stack:** TypeScript strict, Vitest, `@wr-calc/schema` (Zod-inferred types only — no Zod
parsing happens inside `packages/calc`, which stays a pure consumer of already-validated data).

**Spec:** `docs/superpowers/specs/2026-09-10-phase1-engine-schema-fixtures-design.md` (sections
"Engine (packages/calc)" and "1. `resolveStats`"), and
`docs/decisions/2026-09-10-resolve-stats-item-rune-catalog.md` for the catalog-parameter fix this
plan implements.

## Global Constraints

- TypeScript strict mode (`tsconfig.base.json`); every new file needs full type annotations on
  exported functions.
- Percentages are fractions (0.25 = 25%), matching the schema's convention.
- The engine is pure: deterministic, no I/O, no hidden module-level state. `resolveStats` must be
  a plain function of its four arguments.
- No champion or item names in engine code — never branch on `.name` or a hardcoded id. Only the
  effect-kind registry may dispatch on `kind`.
- Every unverified mechanic (a game-behavior assumption not yet confirmed in-game) is a
  `// TODO-VERIFY` constant/function in `packages/calc/src/rules.ts`, with a note on how to check
  it in the practice tool, and a stable id added to `UNVERIFIED_RULE_IDS`.
- A `null` Scalar value is treated as `0` and recorded in `dataWarnings`, never thrown on.
- Commit after each task.

---

## Design notes (read before starting; not spec text, but decisions this plan depends on)

These resolve ambiguities the spec doc leaves open. They are implementation decisions, not
product/game-design ones — no further sign-off needed, but they're recorded here so every task
builds on the same model.

1. **`resolveStats` takes a fourth `catalog` parameter** — `{ items: Map<string, Item>, runes:
   Map<string, Rune> }` — to turn `Build.items`/`Build.runes` (id strings) into real objects. See
   the linked ADR. An id with no catalog entry is a caller error: `resolveStats` throws a plain
   `Error`.
2. **`StatContribution.layer` is `'base' | 'bonus'` only**, never `'total'`. `'total'` is always
   `base + bonus`, computed once at the end — it's never an independent target to add into.
   Champion base+growth is the only thing that ever writes to `'base'`; every item stat, rune
   effect, and item effect writes to `'bonus'`.
3. **`StatMultiplierEffect.layer` is a *read* selector, not a *write* target.** It says which
   value to use as the multiplier's basis (the stat's current base, bonus, or total-so-far) — the
   resulting delta is always written to `'bonus'`, since it's always an effect granting something
   additional, never a rewrite of the champion's innate value.
4. **`StatConversionEffect` always reads its `fromStat` at `'total'`** (post-multiplier, since the
   conversion stage runs after the multiplier stage) — it has no `layer` field of its own, so
   there's no other value to prefer.
5. **A `StatContribution`'s `source.kind`** is `'champion'` for base+growth, `'item'` for an
   item's own `.stats` record (its intrinsic stat line), and `'effect'` for any effect-driven
   contribution (whether the effect lives on an item or a rune) — using the effect's own `id`/
   `name`, not its parent's. `'rune'` stays in the `StatSource` union for schema-doc fidelity but
   is never constructed by this step's code, since `RuneSchema` has no direct `.stats` field.
6. **The "Caps" stage (Order step 5) implements exactly the attack-speed cap** — the only cap the
   design doc actually specifies (`ATTACK_SPEED_CAP` already exists in `rules.ts`). No other caps
   are invented.
7. **Stage routing is data-driven, not a branch.** Each registered `EffectHandler` declares its
   own `stage` (`'flat' | 'multiplier' | 'conversion'`, matching `rules.ts`'s
   `STAT_RESOLUTION_ORDER`). `resolveStats` loops `STAT_RESOLUTION_ORDER` and, for each effect,
   looks up `stageOf(effect)` from the registry — it never inspects `effect.kind` itself.
8. **`unverifiedRules` tags a rule id whenever the code path that reads that constant executes**,
   not only when it changed the numeric outcome (e.g. `attackSpeedCap` is tagged on every call,
   even when the computed AS is under the cap) — simpler and consistent with how
   `statGrowthCurve`/`maxChampionLevel` are unconditionally used by every call.
9. **Only `resolveStats`, the registry, and the shared types are exported** from
   `packages/calc/src/index.ts`. Individual kind-handler files (`effects/stat.ts` etc.) are
   internal implementation detail of the registry, same as `packages/schema`'s internal files
   that aren't part of its public surface.

---

### Task 1: `rules.ts` — attack speed growth + stat resolution order

**Files:**
- Modify: `packages/calc/src/rules.ts`
- Test: `packages/calc/test/rules.test.ts`

**Interfaces:**
- Produces: `attackSpeedAtLevel(base: number, ratio: number, level: number): number`,
  `STAT_RESOLUTION_ORDER: readonly ['flat', 'multiplier', 'conversion']`, and two new entries in
  `UNVERIFIED_RULE_IDS`: `'attackSpeedRatioGrowth'`, `'statResolutionOrder'`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/calc/test/rules.test.ts` (add `attackSpeedAtLevel, STAT_RESOLUTION_ORDER` to
the existing import on line 2-5):

```ts
describe('attackSpeedAtLevel', () => {
  it('returns base at level 1', () => {
    expect(attackSpeedAtLevel(0.625, 0.025, 1)).toBe(0.625)
  })

  it('returns base with zero growth when ratio is 0', () => {
    expect(attackSpeedAtLevel(0.625, 0, MAX_CHAMPION_LEVEL)).toBe(0.625)
  })

  it('grows with level when ratio is positive', () => {
    const level1 = attackSpeedAtLevel(0.625, 0.025, 1)
    const maxLevel = attackSpeedAtLevel(0.625, 0.025, MAX_CHAMPION_LEVEL)
    expect(maxLevel).toBeGreaterThan(level1)
  })

  it('grows non-linearly: late-level increments exceed early-level increments', () => {
    const early = attackSpeedAtLevel(0.625, 0.025, 2) - attackSpeedAtLevel(0.625, 0.025, 1)
    const late = attackSpeedAtLevel(0.625, 0.025, MAX_CHAMPION_LEVEL)
      - attackSpeedAtLevel(0.625, 0.025, MAX_CHAMPION_LEVEL - 1)
    expect(late).toBeGreaterThan(early)
  })
})

describe('STAT_RESOLUTION_ORDER', () => {
  it('defines the three effect-driven stat resolution stages in order', () => {
    expect(STAT_RESOLUTION_ORDER).toEqual(['flat', 'multiplier', 'conversion'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @wr-calc/calc test`
Expected: FAIL — `attackSpeedAtLevel` and `STAT_RESOLUTION_ORDER` are not exported yet.

- [ ] **Step 3: Implement**

In `packages/calc/src/rules.ts`, add after `resolveAdaptiveDamageType` (before
`RESIST_MODIFICATION_ORDER`):

```ts
// TODO-VERIFY(attackSpeedRatioGrowth): confirm champion base attack speed scales with level as
// base * (1 + ratio * growthFactor(level)), using the same non-linear growth curve as other
// stats, by recording a champion's displayed base attack speed at level 1 and at
// MAX_CHAMPION_LEVEL in the practice tool and checking it fits this formula.
/** Resolves a champion's base attack speed at a given level from its base value and AS ratio. */
export function attackSpeedAtLevel(base: number, ratio: number, level: number): number {
  if (level <= 1) return base
  const n = level - 1
  const factor = GROWTH_CURVE_A + GROWTH_CURVE_B * n
  return base * (1 + ratio * n * factor)
}

// TODO-VERIFY(statResolutionOrder): confirm stat resolution applies in this order — champion
// base+growth, then flat contributions (item stats, `stat`/`stacking` effects), then
// `statMultiplier` effects, then `statConversion` effects, then caps — by equipping items that
// cover multiple stages together and checking the displayed total against each possible
// ordering.
export const STAT_RESOLUTION_ORDER = ['flat', 'multiplier', 'conversion'] as const
```

Then update `UNVERIFIED_RULE_IDS` (add the two new ids, keeping the rest unchanged):

```ts
export const UNVERIFIED_RULE_IDS = [
  'maxChampionLevel',
  'critDamageMultiplier',
  'attackSpeedCap',
  'statGrowthCurve',
  'levelRangeInterpolation',
  'adaptiveDamageType',
  'resistModificationOrder',
  'uniqueEffectResolution',
  'itemSlots',
  'attackSpeedRatioGrowth',
  'statResolutionOrder',
] as const
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @wr-calc/calc test`
Expected: PASS, all tests in `rules.test.ts` green.

- [ ] **Step 5: Commit**

```bash
git add packages/calc/src/rules.ts packages/calc/test/rules.test.ts
git commit -m "feat: add attackSpeedAtLevel and STAT_RESOLUTION_ORDER to rules.ts"
```

---

### Task 2: `resolve-scalar.ts` — turn any Scalar into a number

**Files:**
- Create: `packages/calc/src/resolve-scalar.ts`
- Test: `packages/calc/test/resolve-scalar.test.ts`

**Interfaces:**
- Consumes: `interpolateLevelRange` from `./rules` (Task 1, unchanged).
- Produces: `interface ResolvedScalar { value: number; wasNull: boolean;
  usedLevelRangeInterpolation: boolean; wasByRank: boolean }`,
  `resolveScalar(scalar: NullableScalar, level: number): ResolvedScalar`,
  `scalarWarning(ownerName: string, fieldLabel: string, resolved: ResolvedScalar): string |
  undefined`.

- [ ] **Step 1: Write the failing test**

Create `packages/calc/test/resolve-scalar.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveScalar, scalarWarning } from '../src/resolve-scalar'

describe('resolveScalar', () => {
  it('resolves null to 0 and flags wasNull', () => {
    const result = resolveScalar(null, 5)
    expect(result).toEqual({
      value: 0, wasNull: true, usedLevelRangeInterpolation: false, wasByRank: false,
    })
  })

  it('resolves a plain number', () => {
    const result = resolveScalar(42, 5)
    expect(result.value).toBe(42)
    expect(result.wasNull).toBe(false)
  })

  it('resolves a levelRange scalar via interpolation', () => {
    const result = resolveScalar({ levelRange: { min: 10, max: 50 } }, 1)
    expect(result.value).toBe(10)
    expect(result.usedLevelRangeInterpolation).toBe(true)
  })

  it('resolves a byLevel scalar by indexing on champion level', () => {
    const result = resolveScalar({ byLevel: [1, 2, 3] }, 2)
    expect(result.value).toBe(2)
  })

  it('clamps byLevel indexing to the array bounds', () => {
    const result = resolveScalar({ byLevel: [1, 2, 3] }, 99)
    expect(result.value).toBe(3)
  })

  it('resolves a byRank scalar to 0 and flags wasByRank', () => {
    const result = resolveScalar({ byRank: [1, 2, 3] }, 5)
    expect(result.value).toBe(0)
    expect(result.wasByRank).toBe(true)
  })
})

describe('scalarWarning', () => {
  it('returns a null-value warning', () => {
    const resolved = resolveScalar(null, 5)
    expect(scalarWarning('Test Effect', 'amount', resolved)).toBe(
      'Test Effect: amount is unverified (null)'
    )
  })

  it('returns a byRank warning', () => {
    const resolved = resolveScalar({ byRank: [1] }, 5)
    expect(scalarWarning('Test Effect', 'amount', resolved)).toBe(
      'Test Effect: amount uses a byRank scalar outside an ability-rank context; treated as 0'
    )
  })

  it('returns undefined when nothing is wrong', () => {
    const resolved = resolveScalar(10, 5)
    expect(scalarWarning('Test Effect', 'amount', resolved)).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wr-calc/calc test`
Expected: FAIL — `../src/resolve-scalar` does not exist.

- [ ] **Step 3: Implement**

Create `packages/calc/src/resolve-scalar.ts`:

```ts
import type { NullableScalar } from '@wr-calc/schema'
import { interpolateLevelRange } from './rules'

export interface ResolvedScalar {
  value: number
  wasNull: boolean
  usedLevelRangeInterpolation: boolean
  wasByRank: boolean
}

/** Resolves any NullableScalar to a number at a given champion level. */
export function resolveScalar(scalar: NullableScalar, level: number): ResolvedScalar {
  if (scalar === null) {
    return { value: 0, wasNull: true, usedLevelRangeInterpolation: false, wasByRank: false }
  }
  if (typeof scalar === 'number') {
    return { value: scalar, wasNull: false, usedLevelRangeInterpolation: false, wasByRank: false }
  }
  if ('levelRange' in scalar) {
    const value = interpolateLevelRange(scalar.levelRange.min, scalar.levelRange.max, level)
    return { value, wasNull: false, usedLevelRangeInterpolation: true, wasByRank: false }
  }
  if ('byLevel' in scalar) {
    const index = Math.min(Math.max(Math.round(level), 1), scalar.byLevel.length) - 1
    return {
      value: scalar.byLevel[index], wasNull: false, usedLevelRangeInterpolation: false,
      wasByRank: false,
    }
  }
  // byRank: only meaningful for ability ranks, not champion-level stat resolution.
  return { value: 0, wasNull: false, usedLevelRangeInterpolation: false, wasByRank: true }
}

/** Builds a human-readable data warning for a resolved scalar, or undefined if none applies. */
export function scalarWarning(
  ownerName: string, fieldLabel: string, resolved: ResolvedScalar
): string | undefined {
  if (resolved.wasNull) return `${ownerName}: ${fieldLabel} is unverified (null)`
  if (resolved.wasByRank) {
    return `${ownerName}: ${fieldLabel} uses a byRank scalar outside an ability-rank context; `
      + 'treated as 0'
  }
  return undefined
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @wr-calc/calc test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/calc/src/resolve-scalar.ts packages/calc/test/resolve-scalar.test.ts
git commit -m "feat: add resolveScalar to turn any Scalar into a number"
```

---

### Task 3: effect handler types + the `stat` handler

**Files:**
- Create: `packages/calc/src/effects/types.ts`
- Create: `packages/calc/src/effects/stat.ts`
- Test: `packages/calc/test/effects/stat.test.ts`

**Interfaces:**
- Consumes: `STAT_RESOLUTION_ORDER` from `../rules` (Task 1); `resolveScalar`, `scalarWarning`
  from `../resolve-scalar` (Task 2); `Effect`, `StatEffect`, `StatKey` from `@wr-calc/schema`.
- Produces: `type EffectStage = 'flat' | 'multiplier' | 'conversion'`, `type StatLayer = 'base' |
  'bonus'`, `type StatSource = {kind:'champion'|'item'|'rune'|'effect', id: string, name:
  string}`, `interface StatContribution { stat: StatKey; layer: StatLayer; amount: number; source:
  StatSource; dataWarning?: string; usedLevelRangeInterpolation: boolean }`, `interface
  StatContext { level: number; inputs: Record<string, number | boolean>; statSoFar(stat: StatKey,
  layer: StatLayer | 'total'): number }`, `interface EffectHandler<E extends Effect = Effect> {
  kind: E['kind']; stage?: EffectStage; contributeStats?(effect: E, ctx: StatContext):
  StatContribution[] }`, and `statHandler: EffectHandler<StatEffect>`.

- [ ] **Step 1: Write the failing test**

Create `packages/calc/test/effects/stat.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { statHandler } from '../../src/effects/stat'
import type { StatContext } from '../../src/effects/types'

function ctx(overrides: Partial<StatContext> = {}): StatContext {
  return { level: 5, inputs: {}, statSoFar: () => 0, ...overrides }
}

describe('statHandler', () => {
  it('contributes a flat amount to the bonus layer', () => {
    const effect = {
      id: 'e1', name: 'Test Passive', description: '', support: 'full' as const,
      kind: 'stat' as const, stat: 'ad' as const, amount: 10,
    }
    const [contribution] = statHandler.contributeStats!(effect, ctx())
    expect(contribution).toEqual({
      stat: 'ad', layer: 'bonus', amount: 10,
      source: { kind: 'effect', id: 'e1', name: 'Test Passive' },
      dataWarning: undefined, usedLevelRangeInterpolation: false,
    })
  })

  it('flags a data warning when amount is null', () => {
    const effect = {
      id: 'e1', name: 'Test Passive', description: '', support: 'full' as const,
      kind: 'stat' as const, stat: 'ad' as const, amount: null,
    }
    const [contribution] = statHandler.contributeStats!(effect, ctx())
    expect(contribution.amount).toBe(0)
    expect(contribution.dataWarning).toBe('Test Passive: amount is unverified (null)')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wr-calc/calc test`
Expected: FAIL — `../../src/effects/stat` does not exist.

- [ ] **Step 3: Implement**

Create `packages/calc/src/effects/types.ts`:

```ts
import type { Effect, StatKey } from '@wr-calc/schema'
import type { STAT_RESOLUTION_ORDER } from '../rules'

export type EffectStage = (typeof STAT_RESOLUTION_ORDER)[number]

export type StatLayer = 'base' | 'bonus'

export type StatSource =
  | { kind: 'champion'; id: string; name: string }
  | { kind: 'item'; id: string; name: string }
  | { kind: 'rune'; id: string; name: string }
  | { kind: 'effect'; id: string; name: string }

export interface StatContribution {
  stat: StatKey
  layer: StatLayer
  amount: number
  source: StatSource
  dataWarning?: string
  usedLevelRangeInterpolation: boolean
}

export interface StatContext {
  level: number
  inputs: Record<string, number | boolean>
  statSoFar(stat: StatKey, layer: StatLayer | 'total'): number
}

export interface EffectHandler<E extends Effect = Effect> {
  kind: E['kind']
  stage?: EffectStage
  contributeStats?(effect: E, ctx: StatContext): StatContribution[]
}
```

Create `packages/calc/src/effects/stat.ts`:

```ts
import type { StatEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

export const statHandler: EffectHandler<StatEffect> = {
  kind: 'stat',
  stage: 'flat',
  contributeStats(effect, ctx) {
    const resolved = resolveScalar(effect.amount, ctx.level)
    return [{
      stat: effect.stat,
      layer: 'bonus',
      amount: resolved.value,
      source: { kind: 'effect', id: effect.id, name: effect.name },
      dataWarning: scalarWarning(effect.name, 'amount', resolved),
      usedLevelRangeInterpolation: resolved.usedLevelRangeInterpolation,
    }]
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @wr-calc/calc test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/calc/src/effects/types.ts packages/calc/src/effects/stat.ts \
  packages/calc/test/effects/stat.test.ts
git commit -m "feat: add effect handler types and the stat effect handler"
```

---

### Task 4: the `stacking` handler

**Files:**
- Create: `packages/calc/src/effects/stacking.ts`
- Test: `packages/calc/test/effects/stacking.test.ts`

**Interfaces:**
- Consumes: `EffectHandler`, `StatContext` from `./types` (Task 3); `resolveScalar`,
  `scalarWarning` from `../resolve-scalar` (Task 2); `StackingEffect` from `@wr-calc/schema`.
- Produces: `stackingHandler: EffectHandler<StackingEffect>`.

- [ ] **Step 1: Write the failing test**

Create `packages/calc/test/effects/stacking.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { stackingHandler } from '../../src/effects/stacking'
import type { StatContext } from '../../src/effects/types'

function ctx(overrides: Partial<StatContext> = {}): StatContext {
  return { level: 5, inputs: {}, statSoFar: () => 0, ...overrides }
}

const effect = {
  id: 'e1', name: 'Test Stacks', description: '', support: 'full' as const,
  kind: 'stacking' as const, stat: 'ad' as const, perStack: 2, maxStacks: 5,
  stackInputId: 'stacks',
}

describe('stackingHandler', () => {
  it('multiplies perStack by the current stack count from inputs', () => {
    const [contribution] = stackingHandler.contributeStats!(effect, ctx({ inputs: { stacks: 3 } }))
    expect(contribution.amount).toBe(6)
  })

  it('caps stacks at maxStacks', () => {
    const [contribution] = stackingHandler.contributeStats!(effect, ctx({ inputs: { stacks: 99 } }))
    expect(contribution.amount).toBe(10)
  })

  it('treats a missing input as zero stacks', () => {
    const [contribution] = stackingHandler.contributeStats!(effect, ctx({ inputs: {} }))
    expect(contribution.amount).toBe(0)
  })

  it('flags a data warning when perStack is null', () => {
    const [contribution] = stackingHandler.contributeStats!(
      { ...effect, perStack: null }, ctx({ inputs: { stacks: 3 } })
    )
    expect(contribution.dataWarning).toBe('Test Stacks: perStack is unverified (null)')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wr-calc/calc test`
Expected: FAIL — `../../src/effects/stacking` does not exist.

- [ ] **Step 3: Implement**

Create `packages/calc/src/effects/stacking.ts`:

```ts
import type { StackingEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

export const stackingHandler: EffectHandler<StackingEffect> = {
  kind: 'stacking',
  stage: 'flat',
  contributeStats(effect, ctx) {
    const rawStacks = ctx.inputs[effect.stackInputId]
    const stacks = typeof rawStacks === 'number' ? Math.min(rawStacks, effect.maxStacks) : 0
    const resolved = resolveScalar(effect.perStack, ctx.level)
    return [{
      stat: effect.stat,
      layer: 'bonus',
      amount: resolved.value * stacks,
      source: { kind: 'effect', id: effect.id, name: effect.name },
      dataWarning: scalarWarning(effect.name, 'perStack', resolved),
      usedLevelRangeInterpolation: resolved.usedLevelRangeInterpolation,
    }]
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @wr-calc/calc test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/calc/src/effects/stacking.ts packages/calc/test/effects/stacking.test.ts
git commit -m "feat: add the stacking effect handler"
```

---

### Task 5: the `statMultiplier` handler

**Files:**
- Create: `packages/calc/src/effects/stat-multiplier.ts`
- Test: `packages/calc/test/effects/stat-multiplier.test.ts`

**Interfaces:**
- Consumes: `EffectHandler`, `StatContext` from `./types` (Task 3); `resolveScalar`,
  `scalarWarning` from `../resolve-scalar` (Task 2); `StatMultiplierEffect` from
  `@wr-calc/schema`.
- Produces: `statMultiplierHandler: EffectHandler<StatMultiplierEffect>`.

- [ ] **Step 1: Write the failing test**

Create `packages/calc/test/effects/stat-multiplier.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { statMultiplierHandler } from '../../src/effects/stat-multiplier'
import type { StatContext } from '../../src/effects/types'

function ctx(overrides: Partial<StatContext> = {}): StatContext {
  return { level: 5, inputs: {}, statSoFar: () => 0, ...overrides }
}

describe('statMultiplierHandler', () => {
  it('multiplies the basis value read from the layer named on the effect', () => {
    const effect = {
      id: 'e1', name: 'Test Multiplier', description: '', support: 'full' as const,
      kind: 'statMultiplier' as const, stat: 'ad' as const, layer: 'bonus' as const, amount: 0.1,
    }
    const statSoFar: StatContext['statSoFar'] = (_stat, layer) => (layer === 'bonus' ? 50 : 0)
    const [contribution] = statMultiplierHandler.contributeStats!(effect, ctx({ statSoFar }))
    expect(contribution.amount).toBe(5)
    expect(contribution.layer).toBe('bonus')
  })

  it('reads the total layer when the effect targets total', () => {
    const effect = {
      id: 'e1', name: 'Test Multiplier', description: '', support: 'full' as const,
      kind: 'statMultiplier' as const, stat: 'ad' as const, layer: 'total' as const, amount: 0.2,
    }
    const statSoFar: StatContext['statSoFar'] = (_stat, layer) => (layer === 'total' ? 100 : 0)
    const [contribution] = statMultiplierHandler.contributeStats!(effect, ctx({ statSoFar }))
    expect(contribution.amount).toBe(20)
  })

  it('flags a data warning when amount is null', () => {
    const effect = {
      id: 'e1', name: 'Test Multiplier', description: '', support: 'full' as const,
      kind: 'statMultiplier' as const, stat: 'ad' as const, layer: 'bonus' as const, amount: null,
    }
    const [contribution] = statMultiplierHandler.contributeStats!(effect, ctx())
    expect(contribution.dataWarning).toBe('Test Multiplier: amount is unverified (null)')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wr-calc/calc test`
Expected: FAIL — `../../src/effects/stat-multiplier` does not exist.

- [ ] **Step 3: Implement**

Create `packages/calc/src/effects/stat-multiplier.ts`:

```ts
import type { StatMultiplierEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

export const statMultiplierHandler: EffectHandler<StatMultiplierEffect> = {
  kind: 'statMultiplier',
  stage: 'multiplier',
  contributeStats(effect, ctx) {
    const basis = ctx.statSoFar(effect.stat, effect.layer)
    const resolved = resolveScalar(effect.amount, ctx.level)
    return [{
      stat: effect.stat,
      layer: 'bonus',
      amount: basis * resolved.value,
      source: { kind: 'effect', id: effect.id, name: effect.name },
      dataWarning: scalarWarning(effect.name, 'amount', resolved),
      usedLevelRangeInterpolation: resolved.usedLevelRangeInterpolation,
    }]
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @wr-calc/calc test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/calc/src/effects/stat-multiplier.ts \
  packages/calc/test/effects/stat-multiplier.test.ts
git commit -m "feat: add the statMultiplier effect handler"
```

---

### Task 6: the `statConversion` handler

**Files:**
- Create: `packages/calc/src/effects/stat-conversion.ts`
- Test: `packages/calc/test/effects/stat-conversion.test.ts`

**Interfaces:**
- Consumes: `EffectHandler`, `StatContext` from `./types` (Task 3); `resolveScalar`,
  `scalarWarning` from `../resolve-scalar` (Task 2); `StatConversionEffect` from
  `@wr-calc/schema`.
- Produces: `statConversionHandler: EffectHandler<StatConversionEffect>`.

- [ ] **Step 1: Write the failing test**

Create `packages/calc/test/effects/stat-conversion.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { statConversionHandler } from '../../src/effects/stat-conversion'
import type { StatContext } from '../../src/effects/types'

function ctx(overrides: Partial<StatContext> = {}): StatContext {
  return { level: 5, inputs: {}, statSoFar: () => 0, ...overrides }
}

describe('statConversionHandler', () => {
  it('converts a ratio of the fromStat total into the toStat', () => {
    const effect = {
      id: 'e1', name: 'Test Conversion', description: '', support: 'full' as const,
      kind: 'statConversion' as const, fromStat: 'ap' as const, toStat: 'ad' as const, ratio: 0.3,
    }
    const statSoFar: StatContext['statSoFar'] = (stat, layer) =>
      (stat === 'ap' && layer === 'total' ? 100 : 0)
    const [contribution] = statConversionHandler.contributeStats!(effect, ctx({ statSoFar }))
    expect(contribution.stat).toBe('ad')
    expect(contribution.amount).toBe(30)
  })

  it('flags a data warning when ratio is null', () => {
    const effect = {
      id: 'e1', name: 'Test Conversion', description: '', support: 'full' as const,
      kind: 'statConversion' as const, fromStat: 'ap' as const, toStat: 'ad' as const, ratio: null,
    }
    const [contribution] = statConversionHandler.contributeStats!(effect, ctx())
    expect(contribution.dataWarning).toBe('Test Conversion: ratio is unverified (null)')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wr-calc/calc test`
Expected: FAIL — `../../src/effects/stat-conversion` does not exist.

- [ ] **Step 3: Implement**

Create `packages/calc/src/effects/stat-conversion.ts`:

```ts
import type { StatConversionEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

export const statConversionHandler: EffectHandler<StatConversionEffect> = {
  kind: 'statConversion',
  stage: 'conversion',
  contributeStats(effect, ctx) {
    const basis = ctx.statSoFar(effect.fromStat, 'total')
    const resolved = resolveScalar(effect.ratio, ctx.level)
    return [{
      stat: effect.toStat,
      layer: 'bonus',
      amount: basis * resolved.value,
      source: { kind: 'effect', id: effect.id, name: effect.name },
      dataWarning: scalarWarning(effect.name, 'ratio', resolved),
      usedLevelRangeInterpolation: resolved.usedLevelRangeInterpolation,
    }]
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @wr-calc/calc test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/calc/src/effects/stat-conversion.ts \
  packages/calc/test/effects/stat-conversion.test.ts
git commit -m "feat: add the statConversion effect handler"
```

---

### Task 7: the effect registry

**Files:**
- Create: `packages/calc/src/effects/registry.ts`
- Test: `packages/calc/test/effects/registry.test.ts`

**Interfaces:**
- Consumes: `statHandler` (Task 3), `stackingHandler` (Task 4), `statMultiplierHandler` (Task 5),
  `statConversionHandler` (Task 6); `EffectHandler`, `EffectStage`, `StatContext`,
  `StatContribution` from `./types`; `Effect`, `EffectKind` from `@wr-calc/schema`.
- Produces: `EFFECT_HANDLERS: Partial<Record<EffectKind, EffectHandler<any>>>`,
  `contributeStats(effect: Effect, ctx: StatContext): StatContribution[]`,
  `stageOf(effect: Effect): EffectStage | undefined`.

- [ ] **Step 1: Write the failing test**

Create `packages/calc/test/effects/registry.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { EFFECT_HANDLERS, contributeStats, stageOf } from '../../src/effects/registry'
import type { StatContext } from '../../src/effects/types'

function ctx(): StatContext {
  return { level: 5, inputs: {}, statSoFar: () => 0 }
}

describe('EFFECT_HANDLERS', () => {
  it('registers exactly the four stat-contributing kinds', () => {
    expect(Object.keys(EFFECT_HANDLERS).sort()).toEqual(
      ['stacking', 'stat', 'statConversion', 'statMultiplier'].sort()
    )
  })
})

describe('contributeStats', () => {
  it('dispatches to the registered handler for a known kind', () => {
    const effect = {
      id: 'e1', name: 'Test', description: '', support: 'full' as const,
      kind: 'stat' as const, stat: 'ad' as const, amount: 10,
    }
    const result = contributeStats(effect, ctx())
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe(10)
  })

  it('returns an empty array for a kind with no registered handler', () => {
    const effect = {
      id: 'e1', name: 'Test', description: '', support: 'full' as const,
      kind: 'shield' as const, amount: 10, durationSeconds: 5,
    }
    expect(contributeStats(effect, ctx())).toEqual([])
  })
})

describe('stageOf', () => {
  it('returns the stage for a registered kind', () => {
    const effect = {
      id: 'e1', name: 'Test', description: '', support: 'full' as const,
      kind: 'statMultiplier' as const, stat: 'ad' as const, layer: 'bonus' as const, amount: 0.1,
    }
    expect(stageOf(effect)).toBe('multiplier')
  })

  it('returns undefined for a kind with no registered handler', () => {
    const effect = {
      id: 'e1', name: 'Test', description: '', support: 'full' as const,
      kind: 'shield' as const, amount: 10, durationSeconds: 5,
    }
    expect(stageOf(effect)).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wr-calc/calc test`
Expected: FAIL — `../../src/effects/registry` does not exist.

- [ ] **Step 3: Implement**

Create `packages/calc/src/effects/registry.ts`:

```ts
import type { Effect, EffectKind } from '@wr-calc/schema'
import type { EffectHandler, EffectStage, StatContext, StatContribution } from './types'
import { statHandler } from './stat'
import { stackingHandler } from './stacking'
import { statMultiplierHandler } from './stat-multiplier'
import { statConversionHandler } from './stat-conversion'

/**
 * Handlers for the effect kinds resolveStats needs. The remaining combat-only kinds (onHit,
 * spellblade, dot, ...) get their handlers in Step 4 alongside simulateCombo, which is what
 * actually dispatches on them; resolveStats never needs them, so they aren't registered here.
 */
export const EFFECT_HANDLERS: Partial<Record<EffectKind, EffectHandler<any>>> = {
  stat: statHandler,
  stacking: stackingHandler,
  statMultiplier: statMultiplierHandler,
  statConversion: statConversionHandler,
}

/** Looks up and calls the registered handler's contributeStats for an effect, if any. */
export function contributeStats(effect: Effect, ctx: StatContext): StatContribution[] {
  return EFFECT_HANDLERS[effect.kind]?.contributeStats?.(effect, ctx) ?? []
}

/** The stat-resolution stage a given effect's kind belongs to, if it contributes stats at all. */
export function stageOf(effect: Effect): EffectStage | undefined {
  return EFFECT_HANDLERS[effect.kind]?.stage
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @wr-calc/calc test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/calc/src/effects/registry.ts packages/calc/test/effects/registry.test.ts
git commit -m "feat: add the effect handler registry"
```

---

### Task 8: `resolveStats` and public exports

**Files:**
- Create: `packages/calc/src/result-envelope.ts`
- Create: `packages/calc/src/resolve-stats.ts`
- Modify: `packages/calc/src/index.ts`
- Test: `packages/calc/test/resolve-stats.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-7 (`MAX_CHAMPION_LEVEL`, `ATTACK_SPEED_CAP`,
  `STAT_RESOLUTION_ORDER`, `statAtLevel`, `attackSpeedAtLevel` from `./rules`; `resolveScalar`,
  `scalarWarning` from `./resolve-scalar`; `contributeStats`, `stageOf` from
  `./effects/registry`; `StatContribution`, `StatContext`, `StatLayer`, `StatSource` from
  `./effects/types`); `Champion`, `Build`, `Item`, `Rune`, `Effect`, `StatKey`, `NullableScalar`,
  `STAT_KEYS` from `@wr-calc/schema`.
- Produces: `interface UnsupportedEffectEntry { id: string; support: 'partial' | 'none';
  supportNotes?: string }`, `interface StatCatalog { items: Map<string, Item>; runes: Map<string,
  Rune> }`, `interface StatSheet { base, bonus, total: Partial<Record<StatKey, number>>;
  breakdown: StatContribution[]; unsupportedEffects: UnsupportedEffectEntry[]; dataWarnings:
  string[]; unverifiedRules: UnverifiedRuleId[] }`, `resolveStats(champion: Champion, level:
  number, build: Build, catalog: StatCatalog): StatSheet`.

- [ ] **Step 1: Write the failing tests**

Create `packages/calc/test/resolve-stats.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveStats } from '../src/resolve-stats'
import type { Champion, Item, Rune, Build } from '@wr-calc/schema'
import { MAX_CHAMPION_LEVEL, ATTACK_SPEED_CAP } from '../src/rules'

function validChampion(overrides: Partial<Champion> = {}): Champion {
  return {
    id: 'nunu-willump', name: 'Nunu & Willump', resource: 'mana',
    baseStats: { hp: { base: 610, perLevel: 90 }, ad: { base: 60, perLevel: 3 } },
    attackSpeed: { base: 0.625, ratio: 0.025 },
    abilities: {
      passive: { id: 'passive', name: 'P', maxRank: 1, cooldown: 0, castTime: 0, damage: [], flags: {} },
      q: { id: 'q', name: 'Q', maxRank: 5, cooldown: 8, castTime: 0.25, damage: [], flags: {} },
      w: { id: 'w', name: 'W', maxRank: 5, cooldown: 8, castTime: 0.25, damage: [], flags: {} },
      e: { id: 'e', name: 'E', maxRank: 5, cooldown: 8, castTime: 0.25, damage: [], flags: {} },
      r: { id: 'r', name: 'R', maxRank: 3, cooldown: 100, castTime: 0.25, damage: [], flags: {} },
    },
    ...overrides,
  }
}

function itemWithStats(id: string, ad: number): Item {
  return {
    id, name: id, tier: 'basic', cost: { total: 350, combine: 350 }, recipe: [],
    stats: { ad }, effects: [], tags: [],
    provenance: { source: 'manual', patch: '0.0.0', verifiedInGame: false },
  }
}

function emptyBuild(overrides: Partial<Build> = {}): Build {
  return { items: [], runes: [], inputs: {}, ...overrides }
}

describe('resolveStats', () => {
  it('resolves champion base stats at level 1 with no items', () => {
    const sheet = resolveStats(
      validChampion(), 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    expect(sheet.base.hp).toBe(610)
    expect(sheet.base.ad).toBe(60)
    expect(sheet.total.ad).toBe(60)
    expect(sheet.bonus.ad).toBeUndefined()
  })

  it('grows champion base stats with level', () => {
    const sheet = resolveStats(
      validChampion(), MAX_CHAMPION_LEVEL, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    expect(sheet.base.hp).toBeGreaterThan(610)
  })

  it('adds item stats to the bonus layer and sums into total', () => {
    const items = new Map([['long-sword', itemWithStats('long-sword', 10)]])
    const build = emptyBuild({ items: ['long-sword'] })
    const sheet = resolveStats(validChampion(), 1, build, { items, runes: new Map() })
    expect(sheet.bonus.ad).toBe(10)
    expect(sheet.total.ad).toBe(70)
  })

  it('throws when a build references an unknown item id', () => {
    const build = emptyBuild({ items: ['does-not-exist'] })
    expect(() => resolveStats(
      validChampion(), 1, build, { items: new Map(), runes: new Map() }
    )).toThrow(/unknown item id/)
  })

  it('throws when a build references an unknown rune id', () => {
    const build = emptyBuild({ runes: ['does-not-exist'] })
    expect(() => resolveStats(
      validChampion(), 1, build, { items: new Map(), runes: new Map() }
    )).toThrow(/unknown rune id/)
  })

  it('records a data warning for a null item stat', () => {
    const item = itemWithStats('rabadons', 0)
    item.stats = { ap: null }
    const items = new Map([['rabadons', item]])
    const build = emptyBuild({ items: ['rabadons'] })
    const sheet = resolveStats(validChampion(), 1, build, { items, runes: new Map() })
    expect(sheet.dataWarnings).toContain('rabadons: stats.ap is unverified (null)')
  })

  it('applies a stat effect from an item to the bonus layer', () => {
    const item = itemWithStats('passive-item', 0)
    item.stats = {}
    item.effects = [{
      id: 'passive-item-passive', name: 'Test Passive', description: '', support: 'full',
      kind: 'stat', stat: 'armor', amount: 20,
    }]
    const items = new Map([['passive-item', item]])
    const build = emptyBuild({ items: ['passive-item'] })
    const sheet = resolveStats(validChampion(), 1, build, { items, runes: new Map() })
    expect(sheet.bonus.armor).toBe(20)
  })

  it('applies statMultiplier after flat contributions', () => {
    const item = itemWithStats('flat-item', 100)
    item.effects = [{
      id: 'mult', name: 'Test Multiplier', description: '', support: 'full',
      kind: 'statMultiplier', stat: 'ad', layer: 'bonus', amount: 0.1,
    }]
    const items = new Map([['flat-item', item]])
    const build = emptyBuild({ items: ['flat-item'] })
    const sheet = resolveStats(validChampion(), 1, build, { items, runes: new Map() })
    expect(sheet.bonus.ad).toBe(110)
  })

  it('applies statConversion using the post-multiplier total of the source stat', () => {
    const item = itemWithStats('conversion-item', 0)
    item.stats = { ap: 100 }
    item.effects = [{
      id: 'conv', name: 'Test Conversion', description: '', support: 'full',
      kind: 'statConversion', fromStat: 'ap', toStat: 'ad', ratio: 0.3,
    }]
    const items = new Map([['conversion-item', item]])
    const build = emptyBuild({ items: ['conversion-item'] })
    const sheet = resolveStats(validChampion(), 1, build, { items, runes: new Map() })
    expect(sheet.bonus.ad).toBe(30)
  })

  it('applies a stacking effect scaled by the input stack count', () => {
    const item = itemWithStats('stacking-item', 0)
    item.stats = {}
    item.effects = [{
      id: 'stacks', name: 'Test Stacks', description: '', support: 'full',
      kind: 'stacking', stat: 'ad', perStack: 2, maxStacks: 5, stackInputId: 'stacks',
    }]
    const items = new Map([['stacking-item', item]])
    const build = emptyBuild({ items: ['stacking-item'], inputs: { stacks: 3 } })
    const sheet = resolveStats(validChampion(), 1, build, { items, runes: new Map() })
    expect(sheet.bonus.ad).toBe(6)
  })

  it('applies effects from runes as well as items', () => {
    const rune: Rune = {
      id: 'conqueror', name: 'Conqueror', path: 'precision', slot: 'keystone',
      effects: [{
        id: 'conqueror-ad', name: 'Conqueror', description: '', support: 'full',
        kind: 'stat', stat: 'ad', amount: 5,
      }],
    }
    const runes = new Map([['conqueror', rune]])
    const build = emptyBuild({ runes: ['conqueror'] })
    const sheet = resolveStats(validChampion(), 1, build, { items: new Map(), runes })
    expect(sheet.bonus.ad).toBe(5)
  })

  it('reports unsupported effects that were involved in the computation', () => {
    const item = itemWithStats('partial-item', 0)
    item.stats = {}
    item.effects = [{
      id: 'iffy', name: 'Iffy Passive', description: '', support: 'partial',
      supportNotes: 'exact scaling unconfirmed',
      kind: 'stat', stat: 'ad', amount: 5,
    }]
    const items = new Map([['partial-item', item]])
    const build = emptyBuild({ items: ['partial-item'] })
    const sheet = resolveStats(validChampion(), 1, build, { items, runes: new Map() })
    expect(sheet.unsupportedEffects).toEqual([
      { id: 'iffy', support: 'partial', supportNotes: 'exact scaling unconfirmed' },
    ])
  })

  it('does not report combat-only effects as unsupported since they never contribute stats', () => {
    const item = itemWithStats('onhit-item', 0)
    item.stats = {}
    item.effects = [{
      id: 'onhit', name: 'On-Hit', description: '', support: 'partial',
      kind: 'onHit', damageType: 'physical', flat: 10,
    }]
    const items = new Map([['onhit-item', item]])
    const build = emptyBuild({ items: ['onhit-item'] })
    const sheet = resolveStats(validChampion(), 1, build, { items, runes: new Map() })
    expect(sheet.unsupportedEffects).toEqual([])
  })

  it('caps attack speed at ATTACK_SPEED_CAP', () => {
    const item = itemWithStats('as-item', 0)
    item.stats = { attackSpeed: 10 }
    const items = new Map([['as-item', item]])
    const build = emptyBuild({ items: ['as-item'] })
    const sheet = resolveStats(validChampion(), 1, build, { items, runes: new Map() })
    expect(sheet.total.attackSpeed).toBe(ATTACK_SPEED_CAP)
  })

  it('always reports the core unverified rules used by every call', () => {
    const sheet = resolveStats(
      validChampion(), 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    expect(sheet.unverifiedRules).toEqual(expect.arrayContaining([
      'maxChampionLevel', 'statGrowthCurve', 'statResolutionOrder', 'attackSpeedRatioGrowth',
      'attackSpeedCap',
    ]))
  })

  it('tags levelRangeInterpolation only when a levelRange scalar is actually used', () => {
    const item = itemWithStats('range-item', 0)
    item.stats = { ap: { levelRange: { min: 10, max: 50 } } }
    const items = new Map([['range-item', item]])
    const build = emptyBuild({ items: ['range-item'] })
    const sheet = resolveStats(validChampion(), 1, build, { items, runes: new Map() })
    expect(sheet.unverifiedRules).toContain('levelRangeInterpolation')
  })

  it('includes a breakdown entry for every contribution with its source', () => {
    const sheet = resolveStats(
      validChampion(), 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    const hpEntry = sheet.breakdown.find((entry) => entry.stat === 'hp')
    expect(hpEntry).toMatchObject({
      stat: 'hp', layer: 'base', amount: 610,
      source: { kind: 'champion', id: 'nunu-willump', name: 'Nunu & Willump' },
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @wr-calc/calc test`
Expected: FAIL — `../src/resolve-stats` does not exist.

- [ ] **Step 3: Implement**

Create `packages/calc/src/result-envelope.ts`:

```ts
export interface UnsupportedEffectEntry {
  id: string
  support: 'partial' | 'none'
  supportNotes?: string
}
```

Create `packages/calc/src/resolve-stats.ts`:

```ts
import type { Champion, Build, Item, Rune, Effect, StatKey, NullableScalar } from '@wr-calc/schema'
import { STAT_KEYS } from '@wr-calc/schema'
import {
  MAX_CHAMPION_LEVEL, ATTACK_SPEED_CAP, STAT_RESOLUTION_ORDER, statAtLevel, attackSpeedAtLevel,
} from './rules'
import type { UnverifiedRuleId } from './rules'
import { resolveScalar, scalarWarning } from './resolve-scalar'
import { contributeStats, stageOf } from './effects/registry'
import type { StatContribution, StatContext, StatLayer, StatSource } from './effects/types'
import type { UnsupportedEffectEntry } from './result-envelope'

export interface StatSheet {
  base: Partial<Record<StatKey, number>>
  bonus: Partial<Record<StatKey, number>>
  total: Partial<Record<StatKey, number>>
  breakdown: StatContribution[]
  unsupportedEffects: UnsupportedEffectEntry[]
  dataWarnings: string[]
  unverifiedRules: UnverifiedRuleId[]
}

export interface StatCatalog {
  items: Map<string, Item>
  runes: Map<string, Rune>
}

/** Resolves a champion's base/bonus/total stats for a level and build, with a full breakdown. */
export function resolveStats(
  champion: Champion, level: number, build: Build, catalog: StatCatalog
): StatSheet {
  const clampedLevel = Math.min(Math.max(Math.round(level), 1), MAX_CHAMPION_LEVEL)

  const base: Partial<Record<StatKey, number>> = {}
  const bonus: Partial<Record<StatKey, number>> = {}
  const breakdown: StatContribution[] = []
  const dataWarnings: string[] = []
  const unsupportedEffects: UnsupportedEffectEntry[] = []
  const unverifiedRules = new Set<UnverifiedRuleId>([
    'maxChampionLevel', 'statGrowthCurve', 'statResolutionOrder', 'attackSpeedRatioGrowth',
    'attackSpeedCap',
  ])

  const record = (contribution: StatContribution) => {
    if (contribution.layer === 'base') {
      base[contribution.stat] = (base[contribution.stat] ?? 0) + contribution.amount
    } else {
      bonus[contribution.stat] = (bonus[contribution.stat] ?? 0) + contribution.amount
    }
    breakdown.push(contribution)
    if (contribution.dataWarning) dataWarnings.push(contribution.dataWarning)
    if (contribution.usedLevelRangeInterpolation) unverifiedRules.add('levelRangeInterpolation')
  }

  const championSource: StatSource = { kind: 'champion', id: champion.id, name: champion.name }

  for (
    const [stat, growth] of
      Object.entries(champion.baseStats) as [StatKey, { base: number; perLevel: number }][]
  ) {
    record({
      stat, layer: 'base', amount: statAtLevel(growth.base, growth.perLevel, clampedLevel),
      source: championSource, usedLevelRangeInterpolation: false,
    })
  }
  record({
    stat: 'attackSpeed', layer: 'base',
    amount: attackSpeedAtLevel(
      champion.attackSpeed.base, champion.attackSpeed.ratio ?? 0, clampedLevel
    ),
    source: championSource, usedLevelRangeInterpolation: false,
  })

  const statSoFar = (stat: StatKey, layer: StatLayer | 'total'): number => {
    if (layer === 'base') return base[stat] ?? 0
    if (layer === 'bonus') return bonus[stat] ?? 0
    return (base[stat] ?? 0) + (bonus[stat] ?? 0)
  }

  const items = build.items.map((id) => {
    const item = catalog.items.get(id)
    if (!item) throw new Error(`resolveStats: unknown item id '${id}' in build`)
    return item
  })
  const runes = build.runes.map((id) => {
    const rune = catalog.runes.get(id)
    if (!rune) throw new Error(`resolveStats: unknown rune id '${id}' in build`)
    return rune
  })

  for (const item of items) {
    const source: StatSource = { kind: 'item', id: item.id, name: item.name }
    for (const [stat, scalar] of Object.entries(item.stats) as [StatKey, NullableScalar][]) {
      const resolved = resolveScalar(scalar, clampedLevel)
      record({
        stat, layer: 'bonus', amount: resolved.value, source,
        dataWarning: scalarWarning(item.name, `stats.${stat}`, resolved),
        usedLevelRangeInterpolation: resolved.usedLevelRangeInterpolation,
      })
    }
  }

  const effects: Effect[] = [
    ...items.flatMap((item) => item.effects),
    ...runes.flatMap((rune) => rune.effects),
  ]
  const ctx: StatContext = { level: clampedLevel, inputs: build.inputs, statSoFar }
  for (const stage of STAT_RESOLUTION_ORDER) {
    for (const effect of effects) {
      if (stageOf(effect) !== stage) continue
      const contributions = contributeStats(effect, ctx)
      for (const contribution of contributions) record(contribution)
      if (contributions.length > 0 && effect.support !== 'full') {
        unsupportedEffects.push({
          id: effect.id, support: effect.support, supportNotes: effect.supportNotes,
        })
      }
    }
  }

  const uncappedAttackSpeed = (base.attackSpeed ?? 0) + (bonus.attackSpeed ?? 0)
  if (uncappedAttackSpeed > ATTACK_SPEED_CAP) {
    record({
      stat: 'attackSpeed', layer: 'bonus', amount: ATTACK_SPEED_CAP - uncappedAttackSpeed,
      source: championSource, usedLevelRangeInterpolation: false,
    })
  }

  const total: Partial<Record<StatKey, number>> = {}
  for (const stat of STAT_KEYS) {
    const baseValue = base[stat] ?? 0
    const bonusValue = bonus[stat] ?? 0
    if (baseValue !== 0 || bonusValue !== 0) total[stat] = baseValue + bonusValue
  }

  return {
    base, bonus, total, breakdown, unsupportedEffects, dataWarnings,
    unverifiedRules: [...unverifiedRules],
  }
}
```

Update `packages/calc/src/index.ts` to:

```ts
export * from './rules'
export * from './resolve-scalar'
export * from './result-envelope'
export * from './resolve-stats'
export * from './effects/types'
export * from './effects/registry'
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @wr-calc/calc test`
Expected: PASS, all tests in `resolve-stats.test.ts` green.

- [ ] **Step 5: Run the full monorepo test suite and typecheck**

Run: `pnpm run typecheck && pnpm run test`
Expected: PASS — every package, no regressions.

- [ ] **Step 6: Commit**

```bash
git add packages/calc/src/result-envelope.ts packages/calc/src/resolve-stats.ts \
  packages/calc/src/index.ts packages/calc/test/resolve-stats.test.ts
git commit -m "feat: add resolveStats and export the calc package's Step 2 public surface"
```

---

## Self-review notes

- **Spec coverage:** `resolveStats` signature (with the ADR'd catalog fix), the defined
  five-stage order, base/bonus/total + breakdown, `dataWarnings`, `unverifiedRules`, and
  `unsupportedEffects` are all implemented. `simulateCombo`, mitigation, and the 13 combat-only
  effect kinds are explicitly out of scope (Steps 3/4) and untouched.
- **Placeholder scan:** none — every task has complete, runnable code.
- **Type consistency:** `StatContribution`, `StatContext`, `StatSource`, `StatLayer`,
  `EffectHandler`, `EffectStage` are defined once in Task 3 and reused verbatim by every later
  task; `resolveScalar`/`scalarWarning` (Task 2) are reused identically by all four handlers and
  by `resolveStats`'s own item-stats loop.
