# Generic Champion Kit Mechanics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add generic champion-kit mechanics (ability-owned effects, ratios that grow with a second stat, recast stages, a `dash` combo action, empowered-attack charges) and hand-model Ambessa on them.

**Architecture:** Champion abilities gain optional `effects` that reuse the item/rune effect system (rank values bound at the ability's rank before use), plus optional `stages` for recasts. `simulateCombo` gains a per-combo stage-window state machine, a `dash` action with an `onDash` hook, and per-swing attack speed for the new `empoweredAttack` effect kind. Ambessa lives in a new hand-modelled champion overlay merged over the generated wrpocket data.

**Tech Stack:** TypeScript (strict), zod schemas (`packages/schema`), pure engine (`packages/calc`), data (`packages/data`), Next debug page (`apps/web`), vitest, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-29-generic-champion-kit-mechanics-design.md`

## Global Constraints

- All new schema fields are optional; every existing champion, item and the 64 golden cases must stay green.
- No champion or item names in engine code (`packages/calc/src`). Mechanics only.
- Unverified mechanics live in `packages/calc/src/rules.ts` as `TODO-VERIFY` with a practice-tool check, and their ids in `UNVERIFIED_RULE_IDS`.
- Generated files under `packages/data/src/patches/7.3/generated/` are never hand-edited.
- Every effect declares `support` (`full` / `partial` / `none`); Ambessa's placeholder values are `partial` with a `supportNotes` saying they're unverified.
- Explicit over clever; docstring (one sentence, what not how) on every exported function; comments only on non-obvious logic.
- Run tests per package (`pnpm --filter @wr-calc/<pkg> test` for `schema`, `calc`, `data`, `web`) plus `pnpm typecheck` — `pnpm -r test` stops early on a known flaky perf test.
- Commit after each task with `feat:` / `test:` / `docs:` prefixes on branch `feat/tvanmook/generic-champion-kits/20260929` (created from the spec branch `docs/tvanmook/generic-champion-kits/20260929`).

## Review Focus

1. Pressing Q after the Slam window lapsed while Q is still on cooldown → nothing is cast (not Slam, not Sweep). Test in Task 5.
2. A dash with no ability cast before it, a second dash after one cast, or a dash too long after the cast → no empowered charge. Tests in Tasks 6 and 7.
3. An attack after the charges' expiry → no bonus damage, and the swing uses normal attack speed. Test in Task 7.
4. A `perStat` ratio whose value is `null` → a data warning and the base ratio only, never `NaN`. Test in Task 3.
5. `cooldownStartsOn: 'lastStage'` when the window lapses without a recast → the cooldown starts when the window closed, not when the key is next pressed. Test in Task 5.

---

## File map

| File | Responsibility |
|---|---|
| `packages/schema/src/damage-component.ts` (new) | `DamageType`, `DamageRatioStat`, `DamageRatio` (with `perStat`), `DamageComponent` schemas — split out of `ability.ts` so effect kinds can use them without an import cycle |
| `packages/schema/src/ability.ts` | re-exports damage-component; adds `AbilityStageSchema`, `effects`, `stages`, `cooldownStartsOn` |
| `packages/schema/src/effect/kinds/empowered-attack.ts` (new) | `EmpoweredAttackEffectSchema` |
| `packages/schema/src/effect/effect.ts` | registers the new kind |
| `packages/calc/src/damage-component.ts` | `perStat` maths |
| `packages/calc/src/kit-effects.ts` (new) | `bindAbilityRank`, `championKitEffects` |
| `packages/calc/src/resolve-stats.ts`, `combatant.ts` | include kit effects |
| `packages/calc/src/rules.ts` | `DASH_SECONDS` + three new unverified rule ids |
| `packages/calc/src/effects/types.ts` | runtime fields, `onDash` hook, `resolveComponent` on `HookContext` |
| `packages/calc/src/simulate-combo.ts` | stage windows, `dash` action, per-swing attack speed |
| `packages/calc/src/effects/empowered-attack.ts` (new) + `registry.ts` | the handler |
| `packages/data/src/golden-types.ts`, `apps/web/src/lib/parse-combo.ts` | accept `dash` |
| `packages/data/src/patches/7.3/champions.ts` (new) + `index.ts` | `HAND_MODELED_CHAMPIONS` with Ambessa |
| `docs/decisions/2026-09-29-generic-champion-kit-mechanics.md` (new) | ADR |

---

### Task 1: Split out the damage-component schema and add `perStat`, ability `effects`, `stages`, `cooldownStartsOn`

**Files:**
- Create: `packages/schema/src/damage-component.ts`
- Modify: `packages/schema/src/ability.ts`
- Test: `packages/schema/test/ability.test.ts`

**Interfaces:**
- Produces: `DamageComponentSchema`, `DamageComponent`, `DamageRatioStatSchema`, `DamageRatioStat`, `DamageTypeSchema`, `DamageType` (unchanged names, still importable from `../src/ability` and `@wr-calc/schema`); new `DamageRatio` type `{ stat; value; perStat?: { stat: DamageRatioStat; value: NullableScalar } }`; new `AbilityStageSchema` / `AbilityStage` `{ id: string; name: string; trigger: 'press' | 'dash'; windowSeconds: number; castTime?: number; damage: DamageComponent[] }`; `Ability` gains `effects?: Effect[]`, `stages?: AbilityStage[]`, `cooldownStartsOn?: 'firstCast' | 'lastStage'`.

- [ ] **Step 1: Write the failing tests** — append to `packages/schema/test/ability.test.ts`:

```ts
describe('kit mechanics fields', () => {
  const minimal = {
    id: 'q', name: 'Q', maxRank: 4, cooldown: 9, castTime: 0, damage: [], flags: {},
  }

  it('accepts a ratio whose coefficient grows with a second stat', () => {
    const result = DamageComponentSchema.parse({
      type: 'physical', base: 120, tags: [],
      ratios: [{ stat: 'targetMaxHp', value: 0.07, perStat: { stat: 'bonusAd', value: 0.0004 } }],
    })
    expect(result.ratios[0].perStat).toEqual({ stat: 'bonusAd', value: 0.0004 })
  })

  it('rejects an unknown field inside perStat', () => {
    expect(() => DamageComponentSchema.parse({
      type: 'physical', base: 0, tags: [],
      ratios: [{ stat: 'targetMaxHp', value: 0.07, perStat: { stat: 'bonusAd', value: 0.0004, extra: 1 } }],
    })).toThrow()
  })

  it('accepts ability-owned effects, recast stages and a cooldown start mode', () => {
    const result = AbilitySchema.parse({
      ...minimal,
      effects: [{
        id: 'r-pen', name: 'Pen', description: '', support: 'full',
        kind: 'stat', stat: 'pctArmorPen', amount: { byRank: [0.1, 0.2, 0.3] },
      }],
      stages: [{
        id: 'q2', name: 'Q2', trigger: 'press', windowSeconds: 3.5,
        damage: [{ type: 'physical', base: 70, ratios: [], tags: [] }],
      }],
      cooldownStartsOn: 'lastStage',
    })
    expect(result.effects).toHaveLength(1)
    expect(result.stages?.[0].trigger).toBe('press')
    expect(result.cooldownStartsOn).toBe('lastStage')
  })

  it('rejects a stage with an unknown trigger or a non-positive window', () => {
    const stage = { id: 'q2', name: 'Q2', trigger: 'press', windowSeconds: 3.5, damage: [] }
    expect(() => AbilitySchema.parse({ ...minimal, stages: [{ ...stage, trigger: 'hold' }] })).toThrow()
    expect(() => AbilitySchema.parse({ ...minimal, stages: [{ ...stage, windowSeconds: 0 }] })).toThrow()
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @wr-calc/schema test -- ability`
Expected: the four new tests FAIL (unrecognized keys `perStat` / `effects` / `stages` / `cooldownStartsOn`).

- [ ] **Step 3: Create `packages/schema/src/damage-component.ts`**

```ts
import { z } from 'zod'
import { NullableScalarSchema } from './scalar'

export const DamageTypeSchema = z.enum(['physical', 'magic', 'true'])
export type DamageType = z.infer<typeof DamageTypeSchema>

export const DamageRatioStatSchema = z.enum([
  'totalAd', 'bonusAd', 'ap', 'maxHp', 'bonusHp',
  'targetMaxHp', 'targetCurrentHp', 'targetMissingHp',
])
export type DamageRatioStat = z.infer<typeof DamageRatioStatSchema>

/**
 * One ratio term. With `perStat`, the coefficient is `value + perStat.value × perStat.stat`,
 * e.g. "7% (+0.04% per bonus AD) of max HP".
 */
export const DamageRatioSchema = z.object({
  stat: DamageRatioStatSchema,
  value: NullableScalarSchema,
  perStat: z.object({ stat: DamageRatioStatSchema, value: NullableScalarSchema }).strict().optional(),
}).strict()
export type DamageRatio = z.infer<typeof DamageRatioSchema>

export const DamageComponentSchema = z.object({
  type: DamageTypeSchema,
  base: NullableScalarSchema,
  ratios: z.array(DamageRatioSchema),
  hits: z.number().optional(),
  tags: z.array(z.string()),
}).strict()
export type DamageComponent = z.infer<typeof DamageComponentSchema>
```

- [ ] **Step 4: Replace the top of `packages/schema/src/ability.ts`** (everything above `export const AbilitySchema`) and extend `AbilitySchema`:

```ts
import { z } from 'zod'
import { NullableScalarSchema } from './scalar'
import { DamageComponentSchema } from './damage-component'
import { EffectSchema } from './effect/effect'

export * from './damage-component'

/** A follow-up cast of an ability (e.g. a recast), available while its window is open. */
export const AbilityStageSchema = z.object({
  id: z.string(),
  name: z.string(),
  trigger: z.enum(['press', 'dash']),
  /** Measured from the end of the previous stage's cast. */
  windowSeconds: z.number().positive(),
  castTime: z.number().nonnegative().optional(),
  damage: z.array(DamageComponentSchema),
}).strict()
export type AbilityStage = z.infer<typeof AbilityStageSchema>
```

and inside `AbilitySchema`'s object, after `custom`:

```ts
  /** Mechanics the ability carries, using the same effect kinds as items (e.g. a passive stat). */
  effects: z.array(EffectSchema).optional(),
  /** Stages 2..n; the ability's own damage and castTime are stage 1. */
  stages: z.array(AbilityStageSchema).optional(),
  cooldownStartsOn: z.enum(['firstCast', 'lastStage']).optional(),
```

- [ ] **Step 5: Run the schema tests**

Run: `pnpm --filter @wr-calc/schema test`
Expected: all PASS (the existing `DamageComponentSchema` tests still import from `../src/ability`).

- [ ] **Step 6: Typecheck and commit**

Run: `pnpm typecheck` — expected: no errors.

```bash
git add packages/schema
git commit -m "feat: let abilities carry effects and recast stages, and ratios grow with a second stat"
```

---

### Task 2: `empoweredAttack` effect kind (schema)

**Files:**
- Create: `packages/schema/src/effect/kinds/empowered-attack.ts`
- Modify: `packages/schema/src/effect/effect.ts`
- Test: `packages/schema/test/effect/effect-union.test.ts`, `packages/schema/test/effect/remaining-kinds.test.ts`

**Interfaces:**
- Consumes: `DamageComponentSchema` from `packages/schema/src/damage-component.ts` (Task 1).
- Produces: `EmpoweredAttackEffectSchema`, `EmpoweredAttackEffect` `{ kind: 'empoweredAttack'; grant: { on: 'abilityCast' | 'dashAfterAbility'; slots?: ('q'|'w'|'e'|'r')[]; withinSeconds?: number }; maxCharges: number; durationSeconds: number; bonus: DamageComponent; attackSpeedBonus?: number }` plus the effect base fields.

- [ ] **Step 1: Write the failing tests.** In `effect-union.test.ts`, add `'empoweredAttack'` to `EXPECTED_KINDS` and change the test name to `'recognizes exactly the 21 documented kinds'`. Append to `remaining-kinds.test.ts` (inside its `describe`, reusing its `base` object):

```ts
  it('parses an empoweredAttack effect', () => {
    const result = EffectSchema.parse({
      ...base, kind: 'empoweredAttack',
      grant: { on: 'dashAfterAbility', withinSeconds: 0.5 },
      maxCharges: 3, durationSeconds: 4, attackSpeedBonus: 0.5,
      bonus: { type: 'physical', base: { byLevel: [5, 7.5] }, ratios: [{ stat: 'bonusAd', value: 0.25 }], tags: [] },
    })
    expect(result).toMatchObject({ kind: 'empoweredAttack', maxCharges: 3 })
  })

  it('rejects an empoweredAttack with zero charges or an unknown grant trigger', () => {
    const effect = {
      ...base, kind: 'empoweredAttack', grant: { on: 'abilityCast' }, maxCharges: 1,
      durationSeconds: 4, bonus: { type: 'physical', base: 10, ratios: [], tags: [] },
    }
    expect(() => EffectSchema.parse({ ...effect, maxCharges: 0 })).toThrow()
    expect(() => EffectSchema.parse({ ...effect, grant: { on: 'onKill' } })).toThrow()
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @wr-calc/schema test -- effect`
Expected: FAIL (union lacks `empoweredAttack`).

- [ ] **Step 3: Create `packages/schema/src/effect/kinds/empowered-attack.ts`**

```ts
import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { DamageComponentSchema } from '../../damage-component'

/**
 * Charges that each empower one basic attack: extra damage (`bonus`, same format as ability
 * damage) and optional attack speed for that swing. Granted by an ability cast, or by a dash
 * within `withinSeconds` of a cast's end (treated as 0 when omitted). Charges share one expiry,
 * refreshed on every grant.
 */
export const EmpoweredAttackEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('empoweredAttack'),
  grant: z.object({
    on: z.enum(['abilityCast', 'dashAfterAbility']),
    slots: z.array(z.enum(['q', 'w', 'e', 'r'])).optional(),
    withinSeconds: z.number().nonnegative().optional(),
  }).strict(),
  maxCharges: z.number().int().positive(),
  durationSeconds: z.number().positive(),
  bonus: DamageComponentSchema,
  attackSpeedBonus: z.number().nonnegative().optional(),
})
export type EmpoweredAttackEffect = z.infer<typeof EmpoweredAttackEffectSchema>
```

- [ ] **Step 4: Register it in `packages/schema/src/effect/effect.ts`**: add `import { EmpoweredAttackEffectSchema } from './kinds/empowered-attack'`, add `EmpoweredAttackEffectSchema,` to the `discriminatedUnion` list just before `CustomEffectSchema,`, and add `export * from './kinds/empowered-attack'` with the other kind exports.

- [ ] **Step 5: Run schema tests and typecheck**

Run: `pnpm --filter @wr-calc/schema test && pnpm typecheck`
Expected: PASS, no type errors. (If `tsc` reports that `EFFECT_HANDLERS` or any exhaustive `switch` over kinds is incomplete, leave it — Task 7 adds the handler; `EFFECT_HANDLERS` is `Partial`, so none is expected.)

- [ ] **Step 6: Commit**

```bash
git add packages/schema
git commit -m "feat: add the empoweredAttack effect kind"
```

---

### Task 3: `perStat` in damage resolution

**Files:**
- Modify: `packages/calc/src/damage-component.ts:36-43`
- Test: `packages/calc/test/damage-component.test.ts`

**Interfaces:**
- Consumes: `DamageRatio.perStat` (Task 1).
- Produces: `resolveDamageComponent` (signature unchanged) now applies `perStat`.

- [ ] **Step 1: Write the failing tests** — append inside the file's `describe` (it already has `attacker`/`target` helpers building Combatants; use them with the overrides shown):

```ts
  it('grows a ratio coefficient with a second stat (perStat)', () => {
    const attacker = combatant({ sheet: sheetWith({ base: { ad: 100 }, bonus: { ad: 40 }, total: { ad: 140 } }) })
    const target = combatant({ sheet: sheetWith({ total: { hp: 10000 } }) })
    const component: DamageComponent = {
      type: 'physical', base: 120, tags: [],
      ratios: [{ stat: 'targetMaxHp', value: 0.07, perStat: { stat: 'bonusAd', value: 0.0004 } }],
    }
    const result = resolveDamageComponent(component, attacker, target, 10000, 15, 'Test Q')
    expect(result.amount).toBeCloseTo(120 + (0.07 + 0.0004 * 40) * 10000, 10)
  })

  it('warns and uses only the base coefficient when perStat.value is null', () => {
    const attacker = combatant({ sheet: sheetWith({ bonus: { ad: 40 } }) })
    const target = combatant({ sheet: sheetWith({ total: { hp: 10000 } }) })
    const component: DamageComponent = {
      type: 'physical', base: 0, tags: [],
      ratios: [{ stat: 'targetMaxHp', value: 0.07, perStat: { stat: 'bonusAd', value: null } }],
    }
    const result = resolveDamageComponent(component, attacker, target, 10000, 15, 'Test Q')
    expect(result.amount).toBeCloseTo(700, 10)
    expect(result.dataWarnings).toContain('Test Q: ratios.targetMaxHp.perStat.bonusAd is unverified (null)')
  })
```

Before appending, read the top of `packages/calc/test/damage-component.test.ts`; if its helpers are named differently than `combatant` / `sheetWith`, add these two helpers at the top of the file instead:

```ts
function sheetWith(overrides: Partial<StatSheet>): StatSheet {
  return {
    base: {}, bonus: {}, total: {}, breakdown: [], unsupportedEffects: [], dataWarnings: [],
    unverifiedRules: [], ...overrides,
  }
}
function combatant(overrides: Partial<Combatant>): Combatant {
  return {
    id: 'c', name: 'C', kind: 'champion', level: 15, sheet: sheetWith({}), items: [],
    runeEffects: [], inputs: {}, startHpFraction: 1, ...overrides,
  }
}
```
(with `import type { StatSheet } from '../src/resolve-stats'` and `import type { Combatant } from '../src/combatant'`). Make sure `import type { DamageComponent } from '@wr-calc/schema'` is present too.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @wr-calc/calc test -- damage-component`
Expected: FAIL (`perStat` ignored → 820 vs 980; no warning).

- [ ] **Step 3: Implement** — replace the ratio loop in `resolveDamageComponent`:

```ts
  for (const ratio of component.ratios) {
    const statValue = resolveRatioStat(ratio.stat, attacker, target, targetCurrentHp)
    const ratioResolved = resolveScalar(ratio.value, level, rank)
    const ratioWarning = scalarWarning(ownerName, `ratios.${ratio.stat}`, ratioResolved)
    if (ratioWarning) dataWarnings.push(ratioWarning)
    let coefficient = ratioResolved.value
    if (ratio.perStat) {
      const perResolved = resolveScalar(ratio.perStat.value, level, rank)
      const perWarning = scalarWarning(
        ownerName, `ratios.${ratio.stat}.perStat.${ratio.perStat.stat}`, perResolved
      )
      if (perWarning) dataWarnings.push(perWarning)
      coefficient += perResolved.value
        * resolveRatioStat(ratio.perStat.stat, attacker, target, targetCurrentHp)
    }
    amount += statValue * coefficient
  }
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @wr-calc/calc test -- damage-component`
Expected: PASS. (Check `scalarWarning`'s exact message format in `packages/calc/src/resolve-scalar.ts`; if a null scalar's message differs from `"<owner>: <field> is unverified (null)"`, adjust only the expected string in the test to that format.)

- [ ] **Step 5: Commit**

```bash
git add packages/calc
git commit -m "feat: resolve ratios whose coefficient grows with a second stat"
```

---

### Task 4: Ability-owned effects join stat resolution and combat

**Files:**
- Create: `packages/calc/src/kit-effects.ts`
- Modify: `packages/calc/src/resolve-stats.ts` (the `effects` array, ~line 137), `packages/calc/src/combatant.ts`, `packages/calc/src/simulate-combo.ts:44-46`, `packages/calc/src/index.ts`
- Test: `packages/calc/test/kit-effects.test.ts` (new), `packages/calc/test/resolve-stats.test.ts`

**Interfaces:**
- Produces: `bindAbilityRank<T>(value: T, rank: number): T`; `championKitEffects(champion: Champion): Effect[]`; `Combatant.kitEffects?: Effect[]` (set by `combatantFromChampion`); `simulateCombo` iterates kit effects **before** item and rune effects.

- [ ] **Step 1: Write the failing tests** — create `packages/calc/test/kit-effects.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { Champion, Effect } from '@wr-calc/schema'
import { bindAbilityRank, championKitEffects } from '../src/kit-effects'

const penEffect: Effect = {
  id: 'r-pen', name: 'Pen', description: '', support: 'full',
  kind: 'stat', stat: 'pctArmorPen', amount: { byRank: [0.1, 0.2, 0.3] },
}

function champion(): Champion {
  const ability = (id: string, maxRank: number, effects?: Effect[]) => ({
    id, name: id, maxRank, cooldown: 1, castTime: 0, damage: [], flags: {}, ...(effects ? { effects } : {}),
  })
  return {
    id: 'kit-champ', name: 'Kit Champ', resource: 'none',
    baseStats: { hp: { base: 1000, perLevel: 0 }, ad: { base: 100, perLevel: 0 } },
    attackSpeed: { base: 1, ratio: 0 },
    provenance: { source: 'manual', patch: 'test', verifiedInGame: false },
    abilities: {
      passive: ability('p', 1), q: ability('q', 4), w: ability('w', 4), e: ability('e', 4),
      r: ability('r', 3, [penEffect]),
    },
  }
}

describe('bindAbilityRank', () => {
  it('replaces every byRank scalar, however deeply nested, with its value at the rank', () => {
    const value = { a: { byRank: [1, 2, 3] }, b: [{ c: { byRank: [4, 5, 6] } }], d: 7, e: { byLevel: [1, 2] } }
    expect(bindAbilityRank(value, 2)).toEqual({ a: 2, b: [{ c: 5 }], d: 7, e: { byLevel: [1, 2] } })
  })

  it('clamps the rank to the byRank array and leaves an empty byRank untouched', () => {
    expect(bindAbilityRank({ byRank: [1, 2] }, 5)).toBe(2)
    expect(bindAbilityRank({ byRank: [] }, 1)).toEqual({ byRank: [] })
  })
})

describe('championKitEffects', () => {
  it("returns each ability's effects bound at that ability's max rank", () => {
    expect(championKitEffects(champion())).toEqual([{ ...penEffect, amount: 0.3 }])
  })
})
```

Append to `packages/calc/test/resolve-stats.test.ts` (inside the top-level `describe`):

```ts
  it("applies a stat effect carried by the champion's own ability at that ability's rank", () => {
    const champion = validChampion()
    champion.abilities.r = {
      ...champion.abilities.r,
      effects: [{
        id: 'r-pen', name: 'Pen', description: '', support: 'full',
        kind: 'stat', stat: 'pctArmorPen', amount: { byRank: [0.1, 0.2, 0.3] },
      }],
    }
    const sheet = resolveStats(champion, 15, emptyBuild(), { items: new Map(), runes: new Map() })
    expect(sheet.total.pctArmorPen).toBeCloseTo(0.3, 10)
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @wr-calc/calc test -- kit-effects resolve-stats`
Expected: FAIL (module `../src/kit-effects` not found; pen is undefined).

- [ ] **Step 3: Create `packages/calc/src/kit-effects.ts`**

```ts
import type { Champion, Effect } from '@wr-calc/schema'

const ABILITY_SLOTS = ['passive', 'q', 'w', 'e', 'r'] as const

/** Replaces every `{ byRank }` scalar inside a value with its entry at the given rank. */
export function bindAbilityRank<T>(value: T, rank: number): T {
  if (Array.isArray(value)) return value.map((element) => bindAbilityRank(element, rank)) as T
  if (value === null || typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  const ranks = record.byRank
  if (Array.isArray(ranks) && Object.keys(record).length === 1) {
    if (ranks.length === 0) return value
    return ranks[Math.min(Math.max(Math.round(rank), 1), ranks.length) - 1] as T
  }
  return Object.fromEntries(
    Object.entries(record).map(([key, child]) => [key, bindAbilityRank(child, rank)])
  ) as T
}

/** The effects a champion's own abilities carry, with rank values bound at each ability's max rank. */
export function championKitEffects(champion: Champion): Effect[] {
  // No per-ability rank input yet: abilities are fully ranked, as in simulateCombo.
  return ABILITY_SLOTS.flatMap((slot) => {
    const ability = champion.abilities[slot]
    return (ability.effects ?? []).map((effect) => bindAbilityRank(effect, ability.maxRank))
  })
}
```

- [ ] **Step 4: Wire it in.**
  - `packages/calc/src/resolve-stats.ts`: `import { championKitEffects } from './kit-effects'` and change the effects list to
    ```ts
    const effects: Effect[] = [
      ...championKitEffects(champion),
      ...items.flatMap((item) => item.effects),
      ...runes.flatMap((rune) => rune.effects),
    ]
    ```
  - `packages/calc/src/combatant.ts`: add to `Combatant` (after `runeEffects`)
    ```ts
      /** Effects carried by the champion's own abilities, rank values already bound. */
      kitEffects?: Effect[]
    ```
    `import { championKitEffects } from './kit-effects'` and in `combatantFromChampion`'s returned object add `kitEffects: championKitEffects(champion),`.
  - `packages/calc/src/simulate-combo.ts`: change `combatantEffects` to
    ```ts
    function combatantEffects(combatant: Combatant): Effect[] {
      // Kit effects first, so a champion's own empowered-attack bonus lands before item on-hits.
      return [
        ...(combatant.kitEffects ?? []),
        ...combatant.items.flatMap((item) => item.effects),
        ...combatant.runeEffects,
      ]
    }
    ```
  - `packages/calc/src/index.ts`: add `export * from './kit-effects'`.

- [ ] **Step 5: Run the calc suite**

Run: `pnpm --filter @wr-calc/calc test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/calc
git commit -m "feat: apply effects carried by a champion's own abilities, bound at the ability's rank"
```

---

### Task 5: Recast stages (press trigger) and cooldown start mode

**Files:**
- Modify: `packages/calc/src/rules.ts`, `packages/calc/src/effects/types.ts` (`CombatantRuntime`), `packages/calc/src/simulate-combo.ts` (ability branch, ~lines 396-434)
- Test: `packages/calc/test/simulate-combo.test.ts`, `packages/calc/test/rules.test.ts` (no change needed beyond the id list test)

**Interfaces:**
- Consumes: `AbilityStage`, `Ability.stages`, `Ability.cooldownStartsOn` (Task 1).
- Produces: in `rules.ts`: `DASH_SECONDS = 0.2`; `UNVERIFIED_RULE_IDS` gains `'dashDuration'`, `'empoweredChargeExpiry'`, `'stageCooldownStart'`. `CombatantRuntime` gains `lastAbilityCast?: { at: number; feintUsed: boolean }` and `swingAttackSpeedBonus?: number`. Inside `simulateCombo` (local, used by Task 6): `stageWindows: Partial<Record<AbilityKey, { nextStage: number; closesAt: number }>>`, `settleStageWindow(key)`, `advanceStageWindow(key, nextStage)`, `castStage(key, stage): DamageInstance[]`, `startCooldown(key, from)`.

- [ ] **Step 1: Write the failing tests** — append inside `describe('simulateCombo', ...)` in `packages/calc/test/simulate-combo.test.ts`:

```ts
  describe('recast stages', () => {
    const noCatalog = { items: new Map(), runes: new Map() }
    function stagedChampion(cooldownStartsOn?: 'firstCast' | 'lastStage') {
      const base = championWithAbility()
      return championWithAbility({
        abilities: {
          ...base.abilities,
          q: {
            ...base.abilities.q, cooldown: 9,
            damage: [{ type: 'true', base: 100, ratios: [], tags: [] }],
            stages: [{
              id: 'q2', name: 'Q2', trigger: 'press', windowSeconds: 3.5,
              damage: [{ type: 'true', base: 200, ratios: [], tags: [] }],
            }],
            ...(cooldownStartsOn ? { cooldownStartsOn } : {}),
          },
        },
      })
    }

    it('casts the next stage on a second press inside the window', () => {
      const attacker = combatantFromChampion(stagedChampion(), 1, emptyBuild(), noCatalog)
      const result = simulateCombo(attacker, combatantFromDummy(dummy()), ['Q', 'wait:1', 'Q'])
      expect(result.instances.map((i) => [i.source.id, i.mitigated])).toEqual([['q', 100], ['q2', 200]])
    })

    it('casts nothing when the window has lapsed and the ability is still on cooldown', () => {
      const attacker = combatantFromChampion(stagedChampion(), 1, emptyBuild(), noCatalog)
      const result = simulateCombo(attacker, combatantFromDummy(dummy()), ['Q', 'wait:4', 'Q'])
      expect(result.instances.map((i) => i.source.id)).toEqual(['q'])
    })

    it('starts the cooldown on the first cast by default', () => {
      const attacker = combatantFromChampion(stagedChampion(), 1, emptyBuild(), noCatalog)
      const result = simulateCombo(attacker, combatantFromDummy(dummy()), ['Q', 'wait:1', 'Q', 'wait:8', 'Q'])
      expect(result.instances.map((i) => i.source.id)).toEqual(['q', 'q2', 'q'])
      expect(result.unverifiedRules).toContain('stageCooldownStart')
    })

    it('with lastStage, starts the cooldown at the last stage', () => {
      const attacker = combatantFromChampion(stagedChampion('lastStage'), 1, emptyBuild(), noCatalog)
      const early = simulateCombo(attacker, combatantFromDummy(dummy()), ['Q', 'wait:1', 'Q', 'wait:8', 'Q'])
      expect(early.instances.map((i) => i.source.id)).toEqual(['q', 'q2'])
      const late = simulateCombo(attacker, combatantFromDummy(dummy()), ['Q', 'wait:1', 'Q', 'wait:9', 'Q'])
      expect(late.instances.map((i) => i.source.id)).toEqual(['q', 'q2', 'q'])
    })

    it('with lastStage, starts the cooldown when the window lapses without a recast', () => {
      const attacker = combatantFromChampion(stagedChampion('lastStage'), 1, emptyBuild(), noCatalog)
      // Window closes at 3.5s; cooldown 9s from then → Q is back at 12.5s, not 9s.
      const tooEarly = simulateCombo(attacker, combatantFromDummy(dummy()), ['Q', 'wait:12', 'Q'])
      expect(tooEarly.instances.map((i) => i.source.id)).toEqual(['q'])
      const ready = simulateCombo(attacker, combatantFromDummy(dummy()), ['Q', 'wait:12.5', 'Q'])
      expect(ready.instances.map((i) => i.source.id)).toEqual(['q', 'q'])
    })
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @wr-calc/calc test -- simulate-combo`
Expected: the new tests FAIL (second press is skipped as on cooldown).

- [ ] **Step 3: Add rules** — in `packages/calc/src/rules.ts`, after `cooldownWithHaste`:

```ts
// TODO-VERIFY(dashDuration): time a champion's short dash (e.g. Ambessa's feint) in the
// practice tool by recording it and counting frames from input to the dash ending.
export const DASH_SECONDS = 0.2

// TODO-VERIFY(empoweredChargeExpiry): charges from one empoweredAttack effect share a single
// expiry refreshed on each grant — check by stacking 3 feints, waiting until just before the
// first charge's own 4s would end, and seeing whether all remaining attacks stay empowered.

// TODO-VERIFY(stageCooldownStart): a staged ability's cooldown starts on its first cast unless its
// data says `cooldownStartsOn: 'lastStage'` — check by casting stage 1 and stage 2 and reading when
// the cooldown timer starts.
```

and add `'dashDuration', 'empoweredChargeExpiry', 'stageCooldownStart',` to `UNVERIFIED_RULE_IDS`.

- [ ] **Step 4: Add runtime fields** — in `packages/calc/src/effects/types.ts`, inside `CombatantRuntime` after `combatStartedAt`:

```ts
  /** The last ability cast that can feed a feint: when it ended, and whether a dash used it. */
  lastAbilityCast?: { at: number; feintUsed: boolean }
  /** Extra bonus attack speed for the swing in progress (e.g. an empowered attack), then cleared. */
  swingAttackSpeedBonus?: number
```

- [ ] **Step 5: Implement stages in `simulateCombo`.** Import `AbilityStage` from `@wr-calc/schema` and `DASH_SECONDS` from `./rules`. After the `dispatchOnAbilityHit` function, add:

```ts
  // Open recast windows: which stage (index into ability.stages) comes next, and until when.
  const stageWindows: Partial<Record<AbilityKey, { nextStage: number; closesAt: number }>> = {}

  function startCooldown(abilityKey: AbilityKey, from: number) {
    const ability = attacker.abilities![abilityKey]
    const rank = ability.maxRank
    const cooldownResolved = resolveScalar(ability.cooldown, attacker.level, rank)
    const cooldownWarning = scalarWarning(ability.name, 'cooldown', cooldownResolved)
    if (cooldownWarning) dataWarnings.push(cooldownWarning)
    const attackerTotal = attackerSheetNow().total
    const ultimateHaste = abilityKey === 'r' ? attackerTotal.ultimateHaste ?? 0 : 0
    const hastedCooldown = cooldownWithHaste(
      cooldownResolved.value, (attackerTotal.abilityHaste ?? 0) + ultimateHaste
    )
    unverifiedRuleIds.add('abilityHasteFormula')
    attackerRuntime.cooldowns[abilityKey] = from + hastedCooldown
  }

  function startsCooldownOnLastStage(abilityKey: AbilityKey): boolean {
    return attacker.abilities![abilityKey].cooldownStartsOn === 'lastStage'
  }

  /** Closes a window that has lapsed; a lastStage ability's cooldown starts when it closed. */
  function settleStageWindow(abilityKey: AbilityKey) {
    const window = stageWindows[abilityKey]
    if (!window || time <= window.closesAt) return
    delete stageWindows[abilityKey]
    if (startsCooldownOnLastStage(abilityKey)) startCooldown(abilityKey, window.closesAt)
  }

  /** Opens the window for `nextStage`, or closes it (starting a lastStage cooldown) if none is left. */
  function advanceStageWindow(abilityKey: AbilityKey, nextStage: number) {
    const stages = attacker.abilities![abilityKey].stages ?? []
    if (nextStage < stages.length) {
      stageWindows[abilityKey] = { nextStage, closesAt: time + stages[nextStage].windowSeconds }
      return
    }
    delete stageWindows[abilityKey]
    if (startsCooldownOnLastStage(abilityKey)) startCooldown(abilityKey, time)
  }

  /** Casts one stage: its cast time, cast hooks and damage. The caller dispatches onAbilityHit. */
  function castStage(
    abilityKey: AbilityKey, stage: Pick<AbilityStage, 'id' | 'name' | 'castTime' | 'damage'>
  ): DamageInstance[] {
    const ability = attacker.abilities![abilityKey]
    time += stage.castTime ?? 0
    flushScheduledEvents(time)
    dispatchOnAbilityCast(abilityKey)
    // No per-ability rank input yet: every ability is assumed fully ranked (see
    // docs/decisions/2026-09-24-byrank-scalar-ability-rank-context.md).
    const rank = ability.maxRank
    const hitInstances: DamageInstance[] = []
    for (const component of stage.damage) {
      const resolved = resolveDamageComponent(
        component, { ...attacker, sheet: attackerSheetNow() }, target, targetRuntime.currentHp,
        attacker.level, stage.name, rank
      )
      resolved.dataWarnings.forEach((warning) => dataWarnings.push(warning))
      hitInstances.push(performDamage({
        type: resolved.type, amount: resolved.amount,
        source: { kind: 'ability', id: stage.id, name: stage.name },
      }))
    }
    return hitInstances
  }
```

Replace the whole ability branch (`} else if (action === 'Q' || ...) { ... dispatchOnAbilityHit(abilityKey, hitInstances)`) with:

```ts
    } else if (action === 'Q' || action === 'W' || action === 'E' || action === 'R') {
      if (!attacker.abilities) continue
      const abilityKey = action.toLowerCase() as AbilityKey
      const ability = attacker.abilities[abilityKey]
      const stages = ability.stages ?? []

      settleStageWindow(abilityKey)
      const window = stageWindows[abilityKey]
      if (window && stages[window.nextStage].trigger === 'press') {
        const hitInstances = castStage(abilityKey, stages[window.nextStage])
        attackerRuntime.lastAbilityCast = { at: time, feintUsed: false }
        advanceStageWindow(abilityKey, window.nextStage + 1)
        dispatchOnAbilityHit(abilityKey, hitInstances)
        continue
      }

      const availableAt = attackerRuntime.cooldowns[abilityKey] ?? 0
      if (!ignoreCooldowns && time < availableAt) continue

      const hitInstances = castStage(abilityKey, ability)
      attackerRuntime.lastAbilityCast = { at: time, feintUsed: false }
      if (stages.length > 0) {
        unverifiedRuleIds.add('stageCooldownStart')
        stageWindows[abilityKey] = { nextStage: 0, closesAt: time + stages[0].windowSeconds }
      }
      if (stages.length > 0 && startsCooldownOnLastStage(abilityKey)) {
        // Unavailable until the chain ends; settle/advanceStageWindow set the real cooldown.
        attackerRuntime.cooldowns[abilityKey] = Infinity
      } else {
        startCooldown(abilityKey, time)
      }

      dispatchOnAbilityHit(abilityKey, hitInstances)
```

(The cooldown is set before `dispatchOnAbilityHit`, as before, so cooldown-refund effects still reduce it.)

- [ ] **Step 6: Run the calc suite**

Run: `pnpm --filter @wr-calc/calc test`
Expected: all PASS, including every pre-existing simulate-combo test.

- [ ] **Step 7: Commit**

```bash
git add packages/calc
git commit -m "feat: cast recast stages from a second press inside their window"
```

---

### Task 6: The `dash` action, dash-triggered stages and the `onDash` hook

**Files:**
- Modify: `packages/calc/src/effects/types.ts` (`HookHandlers`), `packages/calc/src/simulate-combo.ts` (`ComboAction`, action loop)
- Test: `packages/calc/test/simulate-combo.test.ts`

**Interfaces:**
- Consumes: `stageWindows`, `settleStageWindow`, `advanceStageWindow`, `castStage`, `DASH_SECONDS`, `CombatantRuntime.lastAbilityCast` (Task 5).
- Produces: `ComboAction` includes `'dash'`; `HookHandlers.onDash?(effect, ctx, dashStartedAt: number): void`. After `onDash` hooks run, the simulator marks `lastAbilityCast.feintUsed = true`, so one cast feeds at most one feint. A dash-triggered stage does not update `lastAbilityCast`.

- [ ] **Step 1: Write the failing tests** — append inside `describe('simulateCombo', ...)`:

```ts
  describe('dash', () => {
    const noCatalog = { items: new Map(), runes: new Map() }
    function dashStageChampion() {
      const base = championWithAbility()
      return championWithAbility({
        abilities: {
          ...base.abilities,
          e: {
            ...base.abilities.e, cooldown: 9,
            damage: [{ type: 'true', base: 50, ratios: [], tags: [] }],
            stages: [{
              id: 'e2', name: 'E2', trigger: 'dash', windowSeconds: 0.5,
              damage: [{ type: 'true', base: 50, ratios: [], tags: [] }],
            }],
          },
        },
      })
    }

    it('takes DASH_SECONDS and fires a dash-triggered stage at the end of the dash', () => {
      const attacker = combatantFromChampion(dashStageChampion(), 1, emptyBuild(), noCatalog)
      const result = simulateCombo(attacker, combatantFromDummy(dummy()), ['E', 'dash'])
      expect(result.instances.map((i) => [i.source.id, i.time])).toEqual([['e', 0], ['e2', DASH_SECONDS]])
      expect(result.unverifiedRules).toContain('dashDuration')
    })

    it('does not fire a dash stage once its window has lapsed, or on a key press', () => {
      const attacker = combatantFromChampion(dashStageChampion(), 1, emptyBuild(), noCatalog)
      const lapsed = simulateCombo(attacker, combatantFromDummy(dummy()), ['E', 'wait:1', 'dash'])
      expect(lapsed.instances.map((i) => i.source.id)).toEqual(['e'])
      const pressed = simulateCombo(attacker, combatantFromDummy(dummy()), ['E', 'E'])
      expect(pressed.instances.map((i) => i.source.id)).toEqual(['e'])
    })

    it('dispatches onDash with the dash start time and lets one cast feed only one feint', () => {
      const seen: { startedAt: number; eligible: boolean }[] = []
      const item = baseItem('dash-probe', {
        id: 'dash-probe-effect', name: 'Probe', description: '', support: 'full',
        kind: 'custom', handler: 'dash-probe',
      })
      const attacker = combatantFromChampion(
        championWithAbility(), 1, emptyBuild({ items: ['dash-probe'] }),
        { items: new Map([['dash-probe', item]]), runes: new Map() }
      )
      simulateCombo(attacker, combatantFromDummy(dummy()), ['Q', 'dash', 'dash'], {
        customHandlers: {
          'dash-probe': {
            kind: 'custom',
            hooks: {
              onDash: (_effect, ctx, dashStartedAt) => {
                seen.push({ startedAt: dashStartedAt, eligible: ctx.self.lastAbilityCast?.feintUsed === false })
              },
            },
          },
        },
      })
      expect(seen).toEqual([
        { startedAt: 0, eligible: true },
        { startedAt: DASH_SECONDS, eligible: false },
      ])
    })
  })
```

Add `import { DASH_SECONDS } from '../src/rules'` at the top of the test file. Before writing the custom-handler test, read `packages/schema/src/effect/kinds/custom.ts` and match its required fields (at least `handler`); add any other required fields it declares to the `baseItem(...)` effect literal.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @wr-calc/calc test -- simulate-combo`
Expected: FAIL (`dash` is ignored as an unknown action).

- [ ] **Step 3: Add the hook type** — in `HookHandlers` in `packages/calc/src/effects/types.ts`:

```ts
  /** A dash (e.g. a feint) that started at `dashStartedAt` has just ended. */
  onDash?(effect: E, ctx: HookContext, dashStartedAt: number): void
```

- [ ] **Step 4: Implement** — in `simulate-combo.ts` change the `ComboAction` type to

```ts
export type ComboAction =
  'AA' | 'Q' | 'W' | 'E' | 'R' | 'dash' | `item:${string}` | `wait:${number}`
```

add a dispatcher next to the others:

```ts
  function dispatchOnDash(dashStartedAt: number) {
    const ctx = buildCtx(attacker, attackerRuntime, target, targetRuntime)
    for (const effect of attackerEffectsList) {
      const handler = resolve(effect)
      if (!handler?.hooks?.onDash) continue
      if (!conditionAllows(effect, ctx)) continue
      handler.hooks.onDash(effect, ctx, dashStartedAt)
      trackSupport(effect)
    }
  }
```

and a branch in the action loop, before `} else if (action.startsWith('item:')) {`:

```ts
    } else if (action === 'dash') {
      const dashStartedAt = time
      // Windows are judged at the start of the dash; the stage itself lands at its end.
      const dashStages: AbilityKey[] = []
      if (attacker.abilities) {
        for (const abilityKey of ['q', 'w', 'e', 'r'] as const) {
          settleStageWindow(abilityKey)
          const window = stageWindows[abilityKey]
          const stages = attacker.abilities[abilityKey].stages ?? []
          if (window && stages[window.nextStage].trigger === 'dash') dashStages.push(abilityKey)
        }
      }
      unverifiedRuleIds.add('dashDuration')
      time += DASH_SECONDS
      flushScheduledEvents(time)
      for (const abilityKey of dashStages) {
        const window = stageWindows[abilityKey]!
        const stage = attacker.abilities![abilityKey].stages![window.nextStage]
        // A dash-triggered stage doesn't update lastAbilityCast, so it can't feed another feint.
        const hitInstances = castStage(abilityKey, stage)
        advanceStageWindow(abilityKey, window.nextStage + 1)
        dispatchOnAbilityHit(abilityKey, hitInstances)
      }
      dispatchOnDash(dashStartedAt)
      if (attackerRuntime.lastAbilityCast) attackerRuntime.lastAbilityCast.feintUsed = true
```

- [ ] **Step 5: Run the calc suite**

Run: `pnpm --filter @wr-calc/calc test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/calc
git commit -m "feat: add a dash combo action with dash-triggered stages and an onDash hook"
```

---

### Task 7: `empoweredAttack` handler and per-swing attack speed

**Files:**
- Create: `packages/calc/src/effects/empowered-attack.ts`
- Modify: `packages/calc/src/effects/registry.ts`, `packages/calc/src/effects/types.ts` (`HookContext.resolveComponent`), `packages/calc/src/simulate-combo.ts` (`buildCtx`, `AA` branch)
- Test: `packages/calc/test/effects/empowered-attack.test.ts` (new), `packages/calc/test/simulate-combo.test.ts`

**Interfaces:**
- Consumes: `EmpoweredAttackEffect` (Task 2), `onDash` + `lastAbilityCast` (Task 6), `swingAttackSpeedBonus` (Task 5), `resolveDamageComponent` (Task 3).
- Produces: `empoweredAttackHandler`; `HookContext.resolveComponent?(component: DamageComponent, ownerName: string): ResolvedDamageComponent`. Buff key `empowered:<effect.id>` holding `{ stacks, expiresAt }`. The bonus is a separate damage instance with source `{ kind: 'basicAttack', id: effect.id, name: effect.name }`.

- [ ] **Step 1: Write the failing handler tests** — create `packages/calc/test/effects/empowered-attack.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { EmpoweredAttackEffect } from '@wr-calc/schema'
import { empoweredAttackHandler } from '../../src/effects/empowered-attack'
import type { HookContext, CombatantRuntime } from '../../src/effects/types'
import type { StatSheet } from '../../src/resolve-stats'

function runtime(overrides: Partial<CombatantRuntime> = {}): CombatantRuntime {
  return { currentHp: 1000, shieldHp: 0, cooldowns: {}, buffs: {}, ...overrides }
}
function sheet(): StatSheet {
  return {
    base: {}, bonus: {}, total: {}, breakdown: [], unsupportedEffects: [], dataWarnings: [],
    unverifiedRules: [],
  }
}
function ctx(overrides: Partial<HookContext> = {}): HookContext {
  return {
    time: 0, level: 15, self: runtime(), opponent: runtime(), selfSheet: sheet(),
    opponentSheet: sheet(), selfKind: 'champion', opponentKind: 'dummy', inputs: {},
    ignoreCooldowns: false,
    dealDamage: (input) => ({
      time: 0, source: input.source, type: input.type, raw: input.amount,
      mitigated: input.amount, targetHpAfter: 0,
    }),
    resolveComponent: (component) => ({ type: component.type, amount: 40, dataWarnings: [] }),
    addDataWarning: () => {}, addUnverifiedRule: () => {}, conditionMet: () => true,
    ...overrides,
  }
}

const feint: EmpoweredAttackEffect = {
  id: 'step', name: 'Step', description: '', support: 'full', kind: 'empoweredAttack',
  grant: { on: 'dashAfterAbility', withinSeconds: 0.5 },
  maxCharges: 3, durationSeconds: 4, attackSpeedBonus: 0.5,
  bonus: { type: 'physical', base: 40, ratios: [], tags: [] },
}

describe('empoweredAttackHandler', () => {
  it('grants a charge on a dash that starts within the window of an unused cast', () => {
    const self = runtime({ lastAbilityCast: { at: 1, feintUsed: false } })
    empoweredAttackHandler.hooks!.onDash!(feint, ctx({ self, time: 1.6 }), 1.4)
    expect(self.buffs['empowered:step']).toEqual({ stacks: 1, expiresAt: 5.6 })
  })

  it('grants nothing without a cast, after a used feint, or when the dash starts too late', () => {
    for (const lastAbilityCast of [undefined, { at: 1, feintUsed: true }, { at: 1, feintUsed: false }]) {
      const self = runtime({ lastAbilityCast })
      const startedAt = lastAbilityCast?.feintUsed === false ? 1.6 : 1.1
      empoweredAttackHandler.hooks!.onDash!(feint, ctx({ self, time: startedAt + 0.2 }), startedAt)
      expect(self.buffs['empowered:step']).toBeUndefined()
    }
  })

  it('caps charges and refreshes one shared expiry on each grant', () => {
    const self = runtime({ buffs: { 'empowered:step': { stacks: 3, expiresAt: 3 } } })
    const effect = { ...feint, grant: { on: 'abilityCast' as const } }
    empoweredAttackHandler.hooks!.onAbilityCast!(effect, ctx({ self, time: 2 }), 'q')
    expect(self.buffs['empowered:step']).toEqual({ stacks: 3, expiresAt: 6 })
  })

  it('only grants on cast for the listed slots', () => {
    const self = runtime()
    const effect = { ...feint, grant: { on: 'abilityCast' as const, slots: ['w' as const] } }
    empoweredAttackHandler.hooks!.onAbilityCast!(effect, ctx({ self }), 'q')
    expect(self.buffs['empowered:step']).toBeUndefined()
    empoweredAttackHandler.hooks!.onAbilityCast!(effect, ctx({ self }), 'w')
    expect(self.buffs['empowered:step']?.stacks).toBe(1)
  })

  it('spends one charge per basic attack: bonus damage as its own instance and swing attack speed', () => {
    const self = runtime({ buffs: { 'empowered:step': { stacks: 2, expiresAt: 4 } } })
    const dealt: { id: string; kind: string; amount: number }[] = []
    const c = ctx({
      self, time: 1,
      dealDamage: (input) => {
        dealt.push({ id: input.source.id, kind: input.source.kind, amount: input.amount })
        return { time: 1, source: input.source, type: input.type, raw: input.amount, mitigated: input.amount, targetHpAfter: 0 }
      },
    })
    empoweredAttackHandler.hooks!.onBasicAttack!(feint, c)
    expect(dealt).toEqual([{ id: 'step', kind: 'basicAttack', amount: 40 }])
    expect(self.buffs['empowered:step'].stacks).toBe(1)
    expect(self.swingAttackSpeedBonus).toBe(0.5)
  })

  it('does nothing on a basic attack once the charges have expired', () => {
    const self = runtime({ buffs: { 'empowered:step': { stacks: 2, expiresAt: 4 } } })
    let called = false
    empoweredAttackHandler.hooks!.onBasicAttack!(feint, ctx({
      self, time: 4.1,
      dealDamage: (input) => { called = true; return { time: 0, source: input.source, type: input.type, raw: 0, mitigated: 0, targetHpAfter: 0 } },
    }))
    expect(called).toBe(false)
    expect(self.swingAttackSpeedBonus).toBeUndefined()
  })
})
```

Append to `packages/calc/test/simulate-combo.test.ts` (inside `describe('simulateCombo', ...)`):

```ts
  describe('empowered attacks in a combo', () => {
    const noCatalog = { items: new Map(), runes: new Map() }
    function feintChampion(attackSpeedBonus = 0.5) {
      const base = championWithAbility()
      return championWithAbility({
        abilities: {
          ...base.abilities,
          passive: {
            ...base.abilities.passive,
            effects: [{
              id: 'step', name: 'Step', description: '', support: 'full', kind: 'empoweredAttack',
              grant: { on: 'dashAfterAbility', withinSeconds: 0.5 },
              maxCharges: 3, durationSeconds: 4, attackSpeedBonus,
              bonus: { type: 'physical', base: 40, ratios: [], tags: [] },
            }],
          },
        },
      })
    }

    it('empowers the attack after ability → dash, with the bonus as its own hit and a faster next swing', () => {
      const attacker = combatantFromChampion(feintChampion(), 1, emptyBuild(), noCatalog)
      const result = simulateCombo(attacker, combatantFromDummy(dummy()), ['Q', 'dash', 'AA', 'AA'], { critMode: 'never' })
      const hits = result.instances.map((i) => [i.source.id, i.mitigated, i.time])
      // Base AS 1.0; the empowered swing at +50% waits 1/1.5 s before the next attack.
      expect(hits).toEqual([
        ['q', 50, 0], ['AA', 60, DASH_SECONDS], ['step', 40, DASH_SECONDS], ['AA', 60, DASH_SECONDS + 1 / 1.5],
      ])
    })

    it('keeps the swing attack speed under the attack speed cap', () => {
      const attacker = combatantFromChampion(feintChampion(5), 1, emptyBuild(), noCatalog)
      const result = simulateCombo(attacker, combatantFromDummy(dummy()), ['Q', 'dash', 'AA', 'AA'], { critMode: 'never' })
      const attackTimes = result.instances.filter((i) => i.source.id === 'AA').map((i) => i.time)
      expect(attackTimes[1] - attackTimes[0]).toBeCloseTo(1 / ATTACK_SPEED_CAP, 10)
    })

    it('does not empower an attack after the charges expire', () => {
      const attacker = combatantFromChampion(feintChampion(), 1, emptyBuild(), noCatalog)
      const result = simulateCombo(attacker, combatantFromDummy(dummy()), ['Q', 'dash', 'wait:4.5', 'AA'], { critMode: 'never' })
      expect(result.instances.map((i) => i.source.id)).toEqual(['q', 'AA'])
    })
  })
```

Add `ATTACK_SPEED_CAP` to the `../src/rules` import.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @wr-calc/calc test -- empowered-attack simulate-combo`
Expected: FAIL (module not found; no bonus hits).

- [ ] **Step 3: Add `resolveComponent` to `HookContext`** in `packages/calc/src/effects/types.ts` (with `import type { DamageComponent } from '@wr-calc/schema'` added to the existing schema import and `import type { ResolvedDamageComponent } from '../damage-component'`):

```ts
  /** Resolves a damage component for this context's owner against its opponent, right now. */
  resolveComponent?(component: DamageComponent, ownerName: string): ResolvedDamageComponent
```

In `simulate-combo.ts` `buildCtx`, add to the returned object:

```ts
      resolveComponent: (component, ownerName) => resolveDamageComponent(
        component, { ...self, sheet: sheetNow(self) }, opponent, opponentRuntime.currentHp,
        self.level, ownerName
      ),
```

- [ ] **Step 4: Create `packages/calc/src/effects/empowered-attack.ts`**

```ts
import type { EmpoweredAttackEffect } from '@wr-calc/schema'
import type { EffectHandler, HookContext } from './types'

function buffKey(effect: EmpoweredAttackEffect): string {
  return `empowered:${effect.id}`
}

function liveCharges(effect: EmpoweredAttackEffect, ctx: HookContext): number {
  const buff = ctx.self.buffs[buffKey(effect)]
  if (!buff || buff.expiresAt === undefined || buff.expiresAt < ctx.time) return 0
  return buff.stacks ?? 0
}

function grantCharge(effect: EmpoweredAttackEffect, ctx: HookContext): void {
  ctx.self.buffs[buffKey(effect)] = {
    stacks: Math.min(liveCharges(effect, ctx) + 1, effect.maxCharges),
    expiresAt: ctx.time + effect.durationSeconds,
  }
  ctx.addUnverifiedRule('empoweredChargeExpiry')
}

export const empoweredAttackHandler: EffectHandler<EmpoweredAttackEffect> = {
  kind: 'empoweredAttack',
  hooks: {
    onAbilityCast(effect, ctx, abilityKey) {
      if (effect.grant.on !== 'abilityCast') return
      if (effect.grant.slots && !effect.grant.slots.includes(abilityKey)) return
      grantCharge(effect, ctx)
    },
    onDash(effect, ctx, dashStartedAt) {
      if (effect.grant.on !== 'dashAfterAbility') return
      const cast = ctx.self.lastAbilityCast
      if (!cast || cast.feintUsed) return
      if (dashStartedAt - cast.at > (effect.grant.withinSeconds ?? 0)) return
      grantCharge(effect, ctx)
    },
    onBasicAttack(effect, ctx) {
      const charges = liveCharges(effect, ctx)
      if (charges === 0) return
      const key = buffKey(effect)
      if (charges === 1) delete ctx.self.buffs[key]
      else ctx.self.buffs[key] = { ...ctx.self.buffs[key], stacks: charges - 1 }

      ctx.self.swingAttackSpeedBonus = Math.max(
        ctx.self.swingAttackSpeedBonus ?? 0, effect.attackSpeedBonus ?? 0
      )
      if (!ctx.resolveComponent) {
        throw new Error('empoweredAttack: HookContext.resolveComponent is required')
      }
      const resolved = ctx.resolveComponent(effect.bonus, effect.name)
      resolved.dataWarnings.forEach((warning) => ctx.addDataWarning(warning))
      ctx.dealDamage({
        type: resolved.type, amount: resolved.amount,
        source: { kind: 'basicAttack', id: effect.id, name: effect.name },
      })
    },
  },
}
```

Register it in `packages/calc/src/effects/registry.ts`: `import { empoweredAttackHandler } from './empowered-attack'` and `empoweredAttack: empoweredAttackHandler,` in `EFFECT_HANDLERS`.

- [ ] **Step 5: Use the swing bonus in the `AA` branch** of `simulate-combo.ts` — replace

```ts
      const interval = 1 / Math.max(attackerSheetNow().total.attackSpeed ?? 1, 0.01)
```

with

```ts
      const swingBonus = attackerRuntime.swingAttackSpeedBonus ?? 0
      attackerRuntime.swingAttackSpeedBonus = undefined
      const sheetAfterSwing = attackerSheetNow()
      const swingAttackSpeed = swingBonus === 0
        ? sheetAfterSwing.total.attackSpeed ?? 1
        : Math.min(ATTACK_SPEED_CAP, totalAttackSpeed(
          sheetAfterSwing.base.attackSpeed ?? 0, (sheetAfterSwing.bonus.attackSpeed ?? 0) + swingBonus
        ))
      const interval = 1 / Math.max(swingAttackSpeed, 0.01)
```

and add `ATTACK_SPEED_CAP` to the `./rules` import.

- [ ] **Step 6: Run the calc suite**

Run: `pnpm --filter @wr-calc/calc test`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/calc
git commit -m "feat: add empowered-attack charges with per-swing attack speed"
```

---

### Task 8: Accept `dash` in golden cases and the debug page

**Files:**
- Modify: `packages/data/src/golden-types.ts:4`, `apps/web/src/lib/parse-combo.ts`
- Test: `packages/data/test/golden-runner.test.ts` (or `golden.test.ts` if the schema tests live there — check both), `apps/web/test/parse-combo.test.ts`

**Interfaces:**
- Consumes: `ComboAction` with `'dash'` (Task 6).
- Produces: golden JSON `combo` accepts `"dash"`; debug-page combo text accepts `dash` (any case).

- [ ] **Step 1: Write the failing tests.** In the data test file that already checks `GoldenScenarioSchema`/`GoldenCaseSchema` parsing (search for `GoldenCaseSchema` under `packages/data/test/`), add:

```ts
  it('accepts a dash action in a combo', () => {
    const parsed = GoldenScenarioSchema.parse({
      championId: 'ambessa', level: 15, build: { items: [], runes: [], inputs: {} },
      target: { hp: 10000, armor: 100, mr: 100 }, combo: ['E', 'dash', 'AA'],
    })
    expect(parsed.combo).toEqual(['E', 'dash', 'AA'])
  })
```

(import `GoldenScenarioSchema` from `../src/golden-types` if not already imported). In `apps/web/test/parse-combo.test.ts` add inside the `parseCombo` describe:

```ts
  it('parses dash in any case', () => {
    expect(parseCombo('Q dash AA DASH')).toEqual({ ok: true, actions: ['Q', 'dash', 'AA', 'dash'] })
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @wr-calc/data test -- golden` and `pnpm --filter @wr-calc/web test -- parse-combo`
Expected: FAIL.

- [ ] **Step 3: Implement.** In `golden-types.ts`:

```ts
const COMBO_ACTION_PATTERN = /^(AA|Q|W|E|R|dash|item:.+|wait:\d+(\.\d+)?)$/
```

In `parse-combo.ts`, inside the loop right after the `simple` check's `continue` block:

```ts
    if (token.toLowerCase() === 'dash') {
      actions.push('dash')
      continue
    }
```

and update the doc comment example to `"Q AA dash item:trinity-force wait:0.5 R"`.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @wr-calc/data test && pnpm --filter @wr-calc/web test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/data apps/web
git commit -m "feat: accept dash in golden cases and the debug page combo"
```

---

### Task 9: Hand-modelled champion overlay with Ambessa

**Files:**
- Create: `packages/data/src/patches/7.3/champions.ts`, `packages/data/test/hand-modeled-champions.test.ts`
- Modify: `packages/data/src/patches/7.3/index.ts`

**Interfaces:**
- Consumes: everything above (ability `effects`/`stages`, `perStat`, `empoweredAttack`, `dash`).
- Produces: `HAND_MODELED_CHAMPIONS: Champion[]` exported from `packages/data/src/patches/7.3` (and so `@wr-calc/data`); `PATCH_7_3_CHAMPIONS = mergeById(GENERATED_CHAMPIONS, HAND_MODELED_CHAMPIONS)`.

- [ ] **Step 1: Write the failing tests** — create `packages/data/test/hand-modeled-champions.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { combatantFromChampion, combatantFromDummy, simulateCombo, championKitEffects } from '@wr-calc/calc'
import { ChampionSchema } from '@wr-calc/schema'
import { HAND_MODELED_CHAMPIONS, PATCH_7_3_CHAMPIONS } from '../src/patches/7.3'
import { GENERATED_CHAMPIONS } from '../src/patches/7.3/generated/champions'
import { buildCatalog } from '../src/catalog'

describe('HAND_MODELED_CHAMPIONS', () => {
  it('replaces the generated entry for each hand-modelled champion', () => {
    for (const champion of HAND_MODELED_CHAMPIONS) {
      expect(PATCH_7_3_CHAMPIONS.find((entry) => entry.id === champion.id), champion.id).toBe(champion)
    }
    expect(PATCH_7_3_CHAMPIONS).toHaveLength(GENERATED_CHAMPIONS.length)
  })

  it('parses against ChampionSchema and keeps the generated base stats', () => {
    for (const champion of HAND_MODELED_CHAMPIONS) {
      expect(() => ChampionSchema.parse(champion), champion.id).not.toThrow()
      const generated = GENERATED_CHAMPIONS.find((entry) => entry.id === champion.id)!
      expect(champion.baseStats, champion.id).toEqual(generated.baseStats)
      expect(champion.attackSpeed, champion.id).toEqual(generated.attackSpeed)
    }
  })

  it("prefixes every kit effect id with the champion's id, so none can collide with an item effect", () => {
    for (const champion of HAND_MODELED_CHAMPIONS) {
      const ids = championKitEffects(champion).map((effect) => effect.id)
      expect(new Set(ids).size, champion.id).toBe(ids.length)
      for (const id of ids) expect(id.startsWith(`${champion.id}-`), id).toBe(true)
    }
  })
})

describe('Ambessa', () => {
  const ambessa = HAND_MODELED_CHAMPIONS.find((champion) => champion.id === 'ambessa')!
  const dummy = () => combatantFromDummy({ kind: 'dummy', hp: 10000, armor: 100, mr: 100 })
  const attacker = () => combatantFromChampion(
    ambessa, 15, { items: [], runes: [], inputs: {} }, buildCatalog([])
  )

  it('gets 30% armor pen from R at rank 3, so a level-15 attack deals 121 × 100/170', () => {
    const result = simulateCombo(attacker(), dummy(), ['AA'], { critMode: 'never' })
    expect(result.instances[0].mitigated).toBeCloseTo(121 * 100 / 170, 6)
  })

  it('runs the full kit: Sweep, Slam, Lacerate and its dash recast, then an empowered attack', () => {
    const result = simulateCombo(attacker(), dummy(), ['Q', 'Q', 'E', 'dash', 'AA'], { critMode: 'never' })
    expect(result.instances.map((i) => i.source.id)).toEqual([
      'ambessa-q', 'ambessa-q-sundering-slam', 'ambessa-e', 'ambessa-e-recast', 'AA',
      'ambessa-passive-drakehounds-step',
    ])
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @wr-calc/data test -- hand-modeled`
Expected: FAIL (`HAND_MODELED_CHAMPIONS` not exported).

- [ ] **Step 3: Create `packages/data/src/patches/7.3/champions.ts`**

```ts
import type { Champion, DamageComponent } from '@wr-calc/schema'
import { WRPOCKET_7_3_PROVENANCE } from './provenance'

// Hand-modelled champions: base stats copied from the generated wrpocket entry, kits written from
// the ability text with this repo's generic kit mechanics. These replace the generated entries with
// the same id. Values marked "unverified" are placeholders until checked in the practice tool.

const UNVERIFIED = 'Placeholder from the ability text; not yet checked in the practice tool.'

/** "4/5/6/7% (+0.04% per bonus AD) of the target's max Health", as a damage ratio. */
const Q_MAX_HP_RATIO = {
  stat: 'targetMaxHp' as const,
  value: { byRank: [0.04, 0.05, 0.06, 0.07] },
  perStat: { stat: 'bonusAd' as const, value: 0.0004 },
}

const LACERATE: DamageComponent = {
  type: 'physical', base: { byRank: [40, 80, 120, 160] },
  ratios: [{ stat: 'bonusAd', value: { byRank: [0.5, 0.55, 0.6, 0.65] } }], tags: [],
}

const AMBESSA: Champion = {
  id: 'ambessa', name: 'Ambessa', resource: 'energy',
  baseStats: {
    hp: { base: 660, perLevel: 120 },
    hpRegen: { base: 8, perLevel: 0.785714 },
    armor: { base: 43, perLevel: 4.5 },
    mr: { base: 36, perLevel: 2 },
    ad: { base: 58, perLevel: 4.5 },
    moveSpeed: { base: 355, perLevel: 0 },
  },
  attackSpeed: { base: 0.8, ratio: 0.009375 },
  abilities: {
    passive: {
      id: 'ambessa-passive', name: "DRAKEHOUND'S STEP", maxRank: 1, cooldown: null, castTime: 0,
      damage: [], flags: {},
      effects: [{
        kind: 'empoweredAttack', id: 'ambessa-passive-drakehounds-step', name: "Drakehound's Step",
        description: 'After an ability, a feint dash empowers her next attack within 4 seconds: 50% '
          + 'Attack Speed, more range, 5 + 2.5 (based on level) (+25% bonus AD) bonus physical '
          + 'damage and 50 Energy. Stacks up to 3 times.',
        support: 'partial',
        supportNotes: `${UNVERIFIED} Level scaling assumed 5 + 2.5 per level; feint window assumed 0.5s. `
          + 'Energy and range are not modeled.',
        grant: { on: 'dashAfterAbility', withinSeconds: 0.5 },
        maxCharges: 3, durationSeconds: 4, attackSpeedBonus: 0.5,
        bonus: {
          type: 'physical',
          base: { byLevel: Array.from({ length: 15 }, (_, index) => 5 + 2.5 * index) },
          ratios: [{ stat: 'bonusAd', value: 0.25 }], tags: [],
        },
      }],
    },
    q: {
      id: 'ambessa-q', name: 'CUNNING SWEEP', maxRank: 4, cooldown: { byRank: [12, 11, 10, 9] },
      cost: 70, castTime: 0, flags: {},
      // Edge hit (the 1v1 best case): 60/80/100/120 (+60% bonus AD) + max-HP ratio.
      damage: [{
        type: 'physical', base: { byRank: [60, 80, 100, 120] },
        ratios: [{ stat: 'bonusAd', value: 0.6 }, Q_MAX_HP_RATIO], tags: [],
      }],
      stages: [{
        id: 'ambessa-q-sundering-slam', name: 'SUNDERING SLAM', trigger: 'press', windowSeconds: 3.5,
        // First target hit: 70/100/130/160 (+90% bonus AD) + max-HP ratio.
        damage: [{
          type: 'physical', base: { byRank: [70, 100, 130, 160] },
          ratios: [{ stat: 'bonusAd', value: 0.9 }, Q_MAX_HP_RATIO], tags: [],
        }],
      }],
    },
    w: {
      id: 'ambessa-w', name: 'REPUDIATION', maxRank: 4, cooldown: { byRank: [17, 16, 15, 14] },
      cost: 70, castTime: 0, flags: {},
      // The stronger shockwave after blocking an immobilize isn't modeled (nothing to block 1v1).
      damage: [{
        type: 'physical', base: { byRank: [70, 100, 130, 160] },
        ratios: [{ stat: 'bonusAd', value: 0.8 }], tags: [],
      }],
    },
    e: {
      id: 'ambessa-e', name: 'LACERATE', maxRank: 4, cooldown: { byRank: [12, 11, 10, 9] },
      cost: 70, castTime: 0, flags: {},
      damage: [LACERATE],
      stages: [{
        id: 'ambessa-e-recast', name: 'LACERATE (RECAST)', trigger: 'dash', windowSeconds: 0.5,
        damage: [LACERATE],
      }],
    },
    r: {
      id: 'ambessa-r', name: 'PUBLIC EXECUTION', maxRank: 3, cooldown: { byRank: [80, 70, 60] },
      // The 1-second suppression before the slam (unverified).
      castTime: 1, flags: {},
      damage: [{
        type: 'physical', base: { byRank: [200, 300, 400] },
        ratios: [{
          stat: 'targetMissingHp', value: 0.1, perStat: { stat: 'bonusAd', value: 0.0005 },
        }],
        tags: [],
      }],
      effects: [{
        kind: 'stat', id: 'ambessa-r-passive-armor-pen', name: 'Public Execution (passive)',
        description: 'Gains 10/20/30% Armor Penetration.',
        support: 'partial', supportNotes: `${UNVERIFIED} Spell vamp is not modeled.`,
        stat: 'pctArmorPen', amount: { byRank: [0.1, 0.2, 0.3] },
      }],
    },
  },
  provenance: WRPOCKET_7_3_PROVENANCE,
}

export const HAND_MODELED_CHAMPIONS: Champion[] = [AMBESSA]
```

Before writing it, open the generated Ambessa entry in `packages/data/src/patches/7.3/generated/champions.ts` and copy `baseStats` and `attackSpeed` exactly from it (the values above are what it held on 2026-09-29; the data test enforces equality). Check `WRPOCKET_7_3_PROVENANCE`'s import path against `items.ts`.

- [ ] **Step 4: Wire it in** — in `packages/data/src/patches/7.3/index.ts`:

```ts
import { HAND_MODELED_CHAMPIONS } from './champions'
```
```ts
export { HAND_MODELED_CHAMPIONS } from './champions'
```
```ts
export const PATCH_7_3_CHAMPIONS: Champion[] = mergeById(GENERATED_CHAMPIONS, HAND_MODELED_CHAMPIONS)
```

- [ ] **Step 5: Run the data and web suites**

Run: `pnpm --filter @wr-calc/data test && pnpm --filter @wr-calc/web test`
Expected: PASS (all 64 golden cases unchanged). If a web test snapshot lists champion data and now sees Ambessa's new fields, update only that expectation to the new Ambessa shape.

- [ ] **Step 6: Commit**

```bash
git add packages/data
git commit -m "feat: hand-model Ambessa with the generic kit mechanics"
```

---

### Task 10: ADR, full verification

**Files:**
- Create: `docs/decisions/2026-09-29-generic-champion-kit-mechanics.md`
- Modify: `docs/superpowers/specs/2026-09-29-generic-champion-kit-mechanics-design.md` (only if implementation deviated)

- [ ] **Step 1: Write the ADR**

```markdown
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

## Consequences

- Ambessa's values are placeholders from her ability text until the baseline readings arrive.
- Energy costs, healing and positional variants are not modeled; the combo search (sub-project D)
  owns costs.
```

- [ ] **Step 2: Full verification**

Run: `pnpm typecheck`, then `pnpm --filter @wr-calc/schema test`, `pnpm --filter @wr-calc/calc test`, `pnpm --filter @wr-calc/data test`, `pnpm --filter @wr-calc/web test`
Expected: no type errors; every suite PASS.

- [ ] **Step 3: Commit**

```bash
git add docs
git commit -m "docs: ADR for generic champion kit mechanics"
```

---

### After this plan (not tasks here)

- When the Ambessa baseline readings arrive: correct `champions.ts` values and the `TODO-VERIFY` defaults, add Ambessa golden cases, set `support: 'full'` on what's confirmed.
- Model Riven or Jax in the new format with no engine changes, to prove the mechanics are generic.
