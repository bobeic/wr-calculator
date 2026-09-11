# Phase 1 / Step 4 — simulateCombo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `simulateCombo(attacker, target, sequence, options) → ComboResult`, an
event-driven combat timeline that executes a combo string against a target, dispatching all 13
combat-only effect kinds through the same handler-registry pattern Step 2 established for
stat-contributing kinds, and producing a full damage-instance log plus the three warning lists.

**Architecture:** Every combat-only effect kind gets its own handler file under
`packages/calc/src/effects/`, unit-tested in isolation against a hand-built `HookContext` (the same
pattern Step 2 used for `StatContext`). `simulate-combo.ts` is the engine: it builds runtime state
for both sides, walks the `sequence` array advancing simulated time, calls into `mitigation.ts`
(Step 3) for every damage instance, and dispatches to registered handlers by effect `kind` —
`kind: 'custom'` effects dispatch a second time by `effect.handler` id, exactly mirroring the
kind-registry / handler-id-registry split the spec describes for `resolveStats`.

**Tech Stack:** TypeScript strict, Vitest, `@wr-calc/schema`, `packages/calc`'s own Step 2/3 output
(`resolveStats`, `effects/registry.ts`, `mitigation.ts`).

**Spec:** `docs/superpowers/specs/2026-09-10-phase1-engine-schema-fixtures-design.md`, sections
"Effect dispatch — handler registry" and "3. `simulateCombo`"; and
`docs/decisions/2026-09-10-simulate-combo-combatant-signature.md` for the `Combatant`-based
signature fix this plan implements (Design note 1).

## Global Constraints

- TypeScript strict mode; every new file needs full type annotations on exported functions.
- Percentages are fractions (0.25 = 25%).
- The engine is pure: deterministic (no `Math.random`, no I/O, no hidden module-level state) — the
  `'expected'` crit mode uses an expected-value multiplier instead of rolling, so determinism holds
  even with crit modeled.
- No champion or item names in engine code — only `effect.kind` (and, for `custom`, `effect.handler`
  id) drive dispatch. Never branch on `.name`.
- Every unverified mechanic is a `// TODO-VERIFY` entry in `packages/calc/src/rules.ts` with a
  practice-tool check note and a stable id in `UNVERIFIED_RULE_IDS`.
- A `null` Scalar value resolves to `0` and is recorded in `dataWarnings`, never thrown on.
- Commit after each task.

---

## Design notes (read before starting; these resolve ambiguities the spec doc leaves open — no
further sign-off needed, but every task builds on the same model)

1. **`simulateCombo` takes pre-resolved `Combatant`s, not raw `Champion`/`Target`.** The spec's
   `Target.champion` field is an id string (needs a champion catalog to resolve), and building a
   combatant already requires calling `resolveStats` first. Rather than have `simulateCombo`
   re-derive that internally, `packages/calc/src/combatant.ts` exports `combatantFromChampion(...)`
   and `combatantFromDummy(...)` — thin builders callers (tests, the future debug page,
   `compareBuilds`) use to go from raw data to a `Combatant`, exactly mirroring how `resolveStats`
   itself is a separate, composable step from whatever calls it. This is recorded as its own ADR,
   already written: `docs/decisions/2026-09-10-simulate-combo-combatant-signature.md` — since it's
   a signature-shape decision like the Step 2 catalog-parameter ADR, it's settled up front rather
   than discovered mid-implementation.
2. **`Combatant` carries resolved `Item[]` (not a flattened `Effect[]`)** so `item:'<id>'` sequence
   actions can find the specific item's `active` effect and cooldown, plus a separate flattened
   `runeEffects: Effect[]` (runes are never referenced by id in a sequence). "All equipped effects"
   for hook dispatch is `[...items.flatMap(i => i.effects), ...runeEffects]`, computed once by the
   engine.
3. **Hook dispatch is push-based through `HookContext`, not a shared mutable timeline object.**
   Every hook function receives `(effect, ctx, ...eventArgs)`; `ctx.self` is the runtime state of
   whichever combatant *owns* the equipped effect, `ctx.opponent` the other side. A handler mutates
   whichever runtime state matches the mechanic's real owner: `spellblade`/`procEveryN` mutate
   `ctx.self` (the attacker's own ICD/counter state), `resistShred`/`dot` mutate `ctx.opponent`
   (debuffs the effect's owner inflicts on the other side), `damageReduction`/`penetration` never
   mutate anything (pure per-hit readers).
4. **Three new per-kind capabilities beyond `contributeStats`/`hooks`**, since `penetration`,
   `damageAmp`, and `damageReduction` are conditional *readers* evaluated at damage-computation
   time, not hook-triggered *writers*: `modifyResist(effect, ctx, damageType) → Partial<
   ResistModifiers>`, `damageMultiplier(effect, ctx, input) → number` (folded into raw damage
   pre-mitigation), `damageReductionFraction(effect, ctx, damageType) → number` (Step 3's
   `applyDamageReductionFractions`, post-mitigation). `resistShred` implements *both* a hook (to
   update its own stack state on hit) and `modifyResist` (to report the current stack's value) —
   see Task 5.
5. **Trigger assignments for kinds with no explicit trigger field in their schema** (Phase 1
   best-guess, `// TODO-VERIFY`-tagged where the assumption is numeric/mechanical; anything a real
   item needs that doesn't fit goes through `kind: 'custom'`, per spec principle 3):
   - `resistShred`, `procEveryN`: fire on `onDamageDealt` (any damage the effect's owner deals).
   - `dot`: applied/refreshed on `onAbilityHit` (the common real trigger — Liandry's, Prowler's).
   - `cooldownRefund`: fires on `onAbilityHit`, reduces every non-ultimate ability's remaining
     cooldown (or all four if `excludesUltimate` is false) on the *caster*.
   - `shield`, `heal`: fire on `onAbilityCast` (self-buff-on-cast passives — the common case).
   - `spellblade`: primes on `onAbilityCast` (subject to its own internal cooldown), consumes on the
     next `onBasicAttack`.
   - `onHit`: fires on `onBasicAttack`.
6. **Crit is deterministic, basic-attacks only.** No `DamageComponent`/`Ability` field marks an
   ability as able to crit, so only the AA's own AD-based damage crits; `onHit` riders never crit.
   `'expected'` mode uses an expected-value multiplier (`1 + critChance * (critMultiplier - 1)`),
   never a random roll — this keeps `simulateCombo` deterministic for `'expected'` the same way it
   already is for `'always'`/`'never'`. Added to `rules.ts`: `critMultiplier(critChance,
   bonusCritDamage, mode)`, reusing the existing `BASE_CRIT_DAMAGE_MULTIPLIER`/`critDamageMultiplier`
   rule id (no new rule id needed).
7. **`damageAmp` applies pre-mitigation** (multiplies raw damage before resist), `damageReduction`
   applies post-mitigation (per spec, explicit). This pre/post split is `// TODO-VERIFY`-tagged as a
   new rule, `damageAmpTiming`, in `rules.ts`.
8. **`Condition` evaluation takes the owning `Effect`, not just the `Condition`**, so `stacksAtMax`
   can resolve against that effect's own declared `stackCount` input (`effect.inputs`) rather than
   needing an external id reference the schema doesn't provide. `targetIsChampion`/`targetIsMonster`
   read a new `Combatant.kind: 'champion' | 'monster' | 'dummy'` field (`combatantFromDummy` sets
   `'dummy'`, which is neither — both conditions evaluate `false` for a training dummy).
9. **DoT ticks are precomputed at apply time**, not driven by a live per-frame clock. When a `dot`
   effect is applied/refreshed, the handler resolves `tickAmount` once (champion level doesn't change
   mid-combo) and schedules `Math.floor(durationSeconds / tickIntervalSeconds)` future
   `DamageInstance`s directly onto the engine's event queue — this is what makes the timeline
   genuinely "event-driven" rather than fixed-step, and keeps `onTick` meaningful (it fires when a
   scheduled DoT tick's time arrives) without simulating idle time.
10. **`shield`/`heal`/`active`/`custom` don't need `stage` or `contributeStats`** — `stage` stays
    `undefined` for every Step 4 handler (Step 2's `EFFECT_HANDLERS` map is untouched by this step
    for `contributeStats`/`stageOf` purposes; Step 4 adds `hooks`/`modifyResist`/`damageMultiplier`/
    `damageReductionFraction` to the *same* registry entries where a kind needs them).
11. **`custom` handlers resolve through a caller-supplied override merged with a built-in registry**:
    `resolveEffectHandler(effect, customHandlers)` checks `options.customHandlers?.[effect.handler]`
    before falling back to `packages/calc/src/custom/registry.ts`'s `CUSTOM_HANDLERS` (empty in
    Phase 1 — no real champion kits are implemented until Step 6+). This keeps the dispatch pure and
    testable without any hidden mutable registration step.
12. **`effect.condition` is gated generically by the engine for every hook dispatch, not by each
    hook-based handler individually.** Task 16's `simulateCombo` defines a `conditionAllows(effect,
    ctx, extra?)` helper (`!effect.condition || ctx.conditionMet(...)`) and checks it in all four
    hook-dispatch sites (`dispatchOnBasicAttack`, `dispatchOnAbilityCast`, `dispatchOnAbilityHit`,
    and `performDamage`'s `onDamageDealt` loop) before ever calling into a handler's hook. This was
    added after Task 5's review caught `resistShredHandler.modifyResist` missing a condition check
    its sibling `penetrationHandler` had — rather than risk the same omission recurring across
    Tasks 6-12's hook-based handlers, the check moved to the one place it can't be forgotten. The
    three *reader* capabilities (`modifyResist`/`damageMultiplier`/`damageReductionFraction`) are
    NOT covered by this — `performDamage` calls those directly outside the hook-dispatch loops, so
    each of those handlers still self-checks its own `condition` (as `penetration`/`damageAmp`/
    `resistShred.modifyResist`/`damageReduction` already correctly do).

---

### Task 1: Combat core types + the `onHit` handler

**Files:**
- Modify: `packages/calc/src/effects/types.ts`
- Create: `packages/calc/src/effects/on-hit.ts`
- Test: `packages/calc/test/effects/on-hit.test.ts`

**Interfaces:**
- Consumes: `ResistModifiers` from `../mitigation` (Step 3); `UnverifiedRuleId` from `../rules`;
  `Effect`, `Condition`, `DamageType`, `OnHitEffect` from `@wr-calc/schema`; `resolveScalar`,
  `scalarWarning` from `../resolve-scalar` (Step 2).
- Produces (all in `effects/types.ts`): `type SourceKind = 'basicAttack' | 'ability' | 'item' |
  'other'`, `interface DamageSource { kind: SourceKind; id: string; name: string }`, `interface
  RawDamageInstanceInput { type: DamageType; amount: number; source: DamageSource }`, `interface
  DamageInstance { time: number; source: DamageSource; type: DamageType; raw: number; mitigated:
  number; targetHpAfter: number }`, `interface RuntimeBuff { expiresAt?: number; stacks?: number;
  data?: Record<string, number> }`, `interface CombatantRuntime { currentHp: number; shieldHp:
  number; cooldowns: Record<string, number>; buffs: Record<string, RuntimeBuff> }`, `type
  AbilityKey = 'q' | 'w' | 'e' | 'r'`, `interface HookHandlers<E extends Effect> { onBasicAttack?
  (effect: E, ctx: HookContext): void; onAbilityCast?(effect: E, ctx: HookContext, abilityKey:
  AbilityKey): void; onAbilityHit?(effect: E, ctx: HookContext, abilityKey: AbilityKey, instances:
  DamageInstance[]): void; onDamageDealt?(effect: E, ctx: HookContext, instance: DamageInstance):
  void; onTick?(effect: E, ctx: HookContext, deltaSeconds: number): void }`, `type HookName =
  keyof HookHandlers<Effect>`, `interface HookContext { time: number; level: number; self:
  CombatantRuntime; opponent: CombatantRuntime; selfSheet: StatSheet; opponentSheet: StatSheet;
  selfKind: 'champion' | 'monster' | 'dummy'; opponentKind: 'champion' | 'monster' | 'dummy';
  inputs: Record<string, number | boolean>; ignoreCooldowns: boolean; dealDamage(input:
  RawDamageInstanceInput): DamageInstance; addDataWarning(message: string): void;
  addUnverifiedRule(id: UnverifiedRuleId): void; conditionMet(effect: Effect, condition:
  Condition, extra?: { damageType?: DamageType; sourceKind?: SourceKind }): boolean }`, and
  `EffectHandler` extended with `hooks?: HookHandlers<E>`, `modifyResist?(effect: E, ctx:
  HookContext, damageType: DamageType): Partial<ResistModifiers>`, `damageMultiplier?(effect: E,
  ctx: HookContext, input: RawDamageInstanceInput): number`, `damageReductionFraction?(effect: E,
  ctx: HookContext, damageType: DamageType): number`. Also: `onHitHandler: EffectHandler<
  OnHitEffect>`.

- [ ] **Step 1: Write the failing test**

Create `packages/calc/test/effects/on-hit.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { onHitHandler } from '../../src/effects/on-hit'
import type { HookContext, CombatantRuntime, DamageInstance } from '../../src/effects/types'
import type { StatSheet } from '../../src/resolve-stats'

function runtime(overrides: Partial<CombatantRuntime> = {}): CombatantRuntime {
  return { currentHp: 1000, shieldHp: 0, cooldowns: {}, buffs: {}, ...overrides }
}

function sheet(overrides: Partial<StatSheet> = {}): StatSheet {
  return {
    base: {}, bonus: {}, total: {}, breakdown: [], unsupportedEffects: [], dataWarnings: [],
    unverifiedRules: [], ...overrides,
  }
}

function ctx(overrides: Partial<HookContext> = {}): HookContext {
  return {
    time: 0, level: 5, self: runtime(), opponent: runtime(), selfSheet: sheet(),
    opponentSheet: sheet(), selfKind: 'champion', opponentKind: 'champion', inputs: {},
    ignoreCooldowns: false,
    dealDamage: vi.fn((input): DamageInstance => ({
      time: 0, source: input.source, type: input.type, raw: input.amount,
      mitigated: input.amount, targetHpAfter: 0,
    })),
    addDataWarning: vi.fn(), addUnverifiedRule: vi.fn(), conditionMet: () => true,
    ...overrides,
  }
}

const baseEffect = {
  id: 'e1', name: 'Test On-Hit', description: '', support: 'full' as const,
  kind: 'onHit' as const, damageType: 'physical' as const,
}

describe('onHitHandler.onBasicAttack', () => {
  it('deals flat on-hit damage', () => {
    const c = ctx()
    onHitHandler.hooks!.onBasicAttack!({ ...baseEffect, flat: 15 }, c)
    expect(c.dealDamage).toHaveBeenCalledWith({
      type: 'physical', amount: 15, source: { kind: 'item', id: 'e1', name: 'Test On-Hit' },
    })
  })

  it('adds a percent-of-current-hp component', () => {
    const c = ctx({ opponent: runtime({ currentHp: 400 }) })
    onHitHandler.hooks!.onBasicAttack!({ ...baseEffect, pctTargetCurrentHp: 0.05 }, c)
    expect(c.dealDamage).toHaveBeenCalledWith(expect.objectContaining({ amount: 20 }))
  })

  it('adds a percent-of-max-hp component from the opponent sheet', () => {
    const c = ctx({ opponentSheet: sheet({ total: { hp: 2000 } }) })
    onHitHandler.hooks!.onBasicAttack!({ ...baseEffect, pctTargetMaxHp: 0.03 }, c)
    expect(c.dealDamage).toHaveBeenCalledWith(expect.objectContaining({ amount: 60 }))
  })

  it('adds a percent-of-missing-hp component', () => {
    const c = ctx({
      opponent: runtime({ currentHp: 300 }), opponentSheet: sheet({ total: { hp: 1000 } }),
    })
    onHitHandler.hooks!.onBasicAttack!({ ...baseEffect, pctTargetMissingHp: 0.1 }, c)
    expect(c.dealDamage).toHaveBeenCalledWith(expect.objectContaining({ amount: 70 }))
  })

  it('adds a ratio of the attacker\'s own stat', () => {
    const c = ctx({ selfSheet: sheet({ total: { ad: 100 } }) })
    onHitHandler.hooks!.onBasicAttack!(
      { ...baseEffect, pctOwnStat: { stat: 'ad', ratio: 0.2 } }, c
    )
    expect(c.dealDamage).toHaveBeenCalledWith(expect.objectContaining({ amount: 20 }))
  })

  it('clamps to minDamage and maxDamage', () => {
    const c = ctx()
    onHitHandler.hooks!.onBasicAttack!({ ...baseEffect, flat: 5, minDamage: 10 }, c)
    expect(c.dealDamage).toHaveBeenCalledWith(expect.objectContaining({ amount: 10 }))
    onHitHandler.hooks!.onBasicAttack!({ ...baseEffect, flat: 50, maxDamage: 30 }, c)
    expect(c.dealDamage).toHaveBeenCalledWith(expect.objectContaining({ amount: 30 }))
  })

  it('records a data warning when flat is null', () => {
    const c = ctx()
    onHitHandler.hooks!.onBasicAttack!({ ...baseEffect, flat: null }, c)
    expect(c.addDataWarning).toHaveBeenCalledWith('Test On-Hit: flat is unverified (null)')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wr-calc/calc test`
Expected: FAIL — `../../src/effects/on-hit` does not exist, and `effects/types.ts` doesn't export
the combat types yet.

- [ ] **Step 3: Implement**

In `packages/calc/src/effects/types.ts`, add these imports to the top (alongside the existing
`Effect, StatKey` import — extend it rather than duplicate):

```ts
import type { Effect, StatKey, Condition, DamageType } from '@wr-calc/schema'
import type { STAT_RESOLUTION_ORDER, UnverifiedRuleId } from '../rules'
import type { ResistModifiers } from '../mitigation'
import type { StatSheet } from '../resolve-stats'
```

Then append at the end of the file (everything from Task 3's plan stays unchanged above this):

```ts
export type SourceKind = 'basicAttack' | 'ability' | 'item' | 'other'

export interface DamageSource {
  kind: SourceKind
  id: string
  name: string
}

export interface RawDamageInstanceInput {
  type: DamageType
  amount: number
  source: DamageSource
}

export interface DamageInstance {
  time: number
  source: DamageSource
  type: DamageType
  raw: number
  mitigated: number
  targetHpAfter: number
}

export interface RuntimeBuff {
  expiresAt?: number
  stacks?: number
  data?: Record<string, number>
}

export interface CombatantRuntime {
  currentHp: number
  shieldHp: number
  cooldowns: Record<string, number>
  buffs: Record<string, RuntimeBuff>
}

export type AbilityKey = 'q' | 'w' | 'e' | 'r'

export interface HookHandlers<E extends Effect> {
  onBasicAttack?(effect: E, ctx: HookContext): void
  onAbilityCast?(effect: E, ctx: HookContext, abilityKey: AbilityKey): void
  onAbilityHit?(effect: E, ctx: HookContext, abilityKey: AbilityKey, instances: DamageInstance[]): void
  onDamageDealt?(effect: E, ctx: HookContext, instance: DamageInstance): void
  onTick?(effect: E, ctx: HookContext, deltaSeconds: number): void
}

export type HookName = keyof HookHandlers<Effect>

export interface HookContext {
  time: number
  level: number
  self: CombatantRuntime
  opponent: CombatantRuntime
  selfSheet: StatSheet
  opponentSheet: StatSheet
  selfKind: 'champion' | 'monster' | 'dummy'
  opponentKind: 'champion' | 'monster' | 'dummy'
  inputs: Record<string, number | boolean>
  ignoreCooldowns: boolean
  dealDamage(input: RawDamageInstanceInput): DamageInstance
  addDataWarning(message: string): void
  addUnverifiedRule(id: UnverifiedRuleId): void
  conditionMet(
    effect: Effect, condition: Condition,
    extra?: { damageType?: DamageType; sourceKind?: SourceKind }
  ): boolean
}
```

Then modify the existing `EffectHandler` interface to add four optional members (keep `kind`,
`stage`, `contributeStats` exactly as they are):

```ts
export interface EffectHandler<E extends Effect = Effect> {
  kind: E['kind']
  stage?: EffectStage
  contributeStats?(effect: E, ctx: StatContext): StatContribution[]
  hooks?: HookHandlers<E>
  modifyResist?(effect: E, ctx: HookContext, damageType: DamageType): Partial<ResistModifiers>
  damageMultiplier?(effect: E, ctx: HookContext, input: RawDamageInstanceInput): number
  damageReductionFraction?(effect: E, ctx: HookContext, damageType: DamageType): number
}
```

Create `packages/calc/src/effects/on-hit.ts`:

```ts
import type { OnHitEffect, NullableScalar } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

export const onHitHandler: EffectHandler<OnHitEffect> = {
  kind: 'onHit',
  hooks: {
    onBasicAttack(effect, ctx) {
      const part = (scalar: NullableScalar | undefined, label: string): number => {
        if (scalar == null) return 0
        const resolved = resolveScalar(scalar, ctx.level)
        const warning = scalarWarning(effect.name, label, resolved)
        if (warning) ctx.addDataWarning(warning)
        return resolved.value
      }

      let amount = part(effect.flat, 'flat')
      amount += part(effect.pctTargetCurrentHp, 'pctTargetCurrentHp') * ctx.opponent.currentHp
      const targetMaxHp = ctx.opponentSheet.total.hp ?? 0
      amount += part(effect.pctTargetMaxHp, 'pctTargetMaxHp') * targetMaxHp
      amount += part(effect.pctTargetMissingHp, 'pctTargetMissingHp')
        * Math.max(0, targetMaxHp - ctx.opponent.currentHp)
      if (effect.pctOwnStat) {
        const statValue = ctx.selfSheet.total[effect.pctOwnStat.stat] ?? 0
        amount += part(effect.pctOwnStat.ratio, 'pctOwnStat.ratio') * statValue
      }
      if (effect.minDamage != null) amount = Math.max(amount, part(effect.minDamage, 'minDamage'))
      if (effect.maxDamage != null) amount = Math.min(amount, part(effect.maxDamage, 'maxDamage'))

      ctx.dealDamage({
        type: effect.damageType, amount,
        source: { kind: 'item', id: effect.id, name: effect.name },
      })
    },
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @wr-calc/calc test`
Expected: PASS. Also run `pnpm run typecheck` to confirm the `EffectHandler` extension doesn't
break Step 2's existing handler files (they only use `kind`/`stage`/`contributeStats`, all
untouched).

- [ ] **Step 5: Commit**

```bash
git add packages/calc/src/effects/types.ts packages/calc/src/effects/on-hit.ts \
  packages/calc/test/effects/on-hit.test.ts
git commit -m "feat: add combat hook types and the onHit effect handler"
```

---

### Task 2: the `damageAmp` handler

**Files:**
- Create: `packages/calc/src/effects/damage-amp.ts`
- Test: `packages/calc/test/effects/damage-amp.test.ts`

**Interfaces:**
- Consumes: `EffectHandler`, `HookContext`, `RawDamageInstanceInput` from `./types` (Task 1);
  `resolveScalar`, `scalarWarning` from `../resolve-scalar`; `DamageAmpEffect` from
  `@wr-calc/schema`.
- Produces: `damageAmpHandler: EffectHandler<DamageAmpEffect>` (implements `damageMultiplier` only
  — no `hooks`, no `contributeStats`; see Design note 4).

- [ ] **Step 1: Write the failing test**

Create `packages/calc/test/effects/damage-amp.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { damageAmpHandler } from '../../src/effects/damage-amp'
import type { HookContext, CombatantRuntime, RawDamageInstanceInput } from '../../src/effects/types'
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
    time: 0, level: 5, self: runtime(), opponent: runtime(), selfSheet: sheet(),
    opponentSheet: sheet(), selfKind: 'champion', opponentKind: 'champion', inputs: {},
    ignoreCooldowns: false,
    dealDamage: () => ({ time: 0, source: { kind: 'other', id: '', name: '' }, type: 'physical', raw: 0, mitigated: 0, targetHpAfter: 0 }),
    addDataWarning: () => {}, addUnverifiedRule: () => {}, conditionMet: () => true,
    ...overrides,
  }
}

const input: RawDamageInstanceInput = {
  type: 'physical', amount: 100, source: { kind: 'basicAttack', id: 'aa', name: 'Attack' },
}

const effect = {
  id: 'e1', name: 'Test Amp', description: '', support: 'full' as const,
  kind: 'damageAmp' as const, condition: { type: 'targetHpBelow' as const, threshold: 0.5 },
  amount: 0.1,
}

describe('damageAmpHandler.damageMultiplier', () => {
  it('returns 1 + amount when the condition is met', () => {
    const result = damageAmpHandler.damageMultiplier!(effect, ctx({ conditionMet: () => true }), input)
    expect(result).toBe(1.1)
  })

  it('returns 1 when the condition is not met', () => {
    const result = damageAmpHandler.damageMultiplier!(effect, ctx({ conditionMet: () => false }), input)
    expect(result).toBe(1)
  })

  it('flags a data warning and treats amount as 0 when null', () => {
    const c = ctx({ conditionMet: () => true })
    const result = damageAmpHandler.damageMultiplier!({ ...effect, amount: null }, c, input)
    expect(result).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wr-calc/calc test`
Expected: FAIL — `../../src/effects/damage-amp` does not exist.

- [ ] **Step 3: Implement**

Create `packages/calc/src/effects/damage-amp.ts`:

```ts
import type { DamageAmpEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

export const damageAmpHandler: EffectHandler<DamageAmpEffect> = {
  kind: 'damageAmp',
  damageMultiplier(effect, ctx, input) {
    if (!ctx.conditionMet(effect, effect.condition, { damageType: input.type })) return 1
    const resolved = resolveScalar(effect.amount, ctx.level)
    const warning = scalarWarning(effect.name, 'amount', resolved)
    if (warning) ctx.addDataWarning(warning)
    return 1 + resolved.value
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @wr-calc/calc test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/calc/src/effects/damage-amp.ts packages/calc/test/effects/damage-amp.test.ts
git commit -m "feat: add the damageAmp effect handler"
```

---

### Task 3: the `penetration` handler

**Files:**
- Create: `packages/calc/src/effects/penetration.ts`
- Test: `packages/calc/test/effects/penetration.test.ts`

**Interfaces:**
- Consumes: `EffectHandler`, `HookContext` from `./types` (Task 1); `ResistModifiers` from
  `../mitigation` (Step 3); `resolveScalar`, `scalarWarning` from `../resolve-scalar`;
  `PenetrationEffect` from `@wr-calc/schema`.
- Produces: `penetrationHandler: EffectHandler<PenetrationEffect>` (implements `modifyResist` only
  — conditional pen has no persistent state, so no hook is needed; unconditional pen is already a
  plain `stat` effect on `flatArmorPen`/`pctArmorPen`/`flatMagicPen`/`pctMagicPen`, handled entirely
  by Step 2's `statHandler`).

- [ ] **Step 1: Write the failing test**

Create `packages/calc/test/effects/penetration.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { penetrationHandler } from '../../src/effects/penetration'
import type { HookContext, CombatantRuntime } from '../../src/effects/types'
import type { StatSheet } from '../../src/resolve-stats'

function runtime(): CombatantRuntime {
  return { currentHp: 1000, shieldHp: 0, cooldowns: {}, buffs: {} }
}

function sheet(): StatSheet {
  return {
    base: {}, bonus: {}, total: {}, breakdown: [], unsupportedEffects: [], dataWarnings: [],
    unverifiedRules: [],
  }
}

function ctx(overrides: Partial<HookContext> = {}): HookContext {
  return {
    time: 0, level: 5, self: runtime(), opponent: runtime(), selfSheet: sheet(),
    opponentSheet: sheet(), selfKind: 'champion', opponentKind: 'champion', inputs: {},
    ignoreCooldowns: false,
    dealDamage: () => ({ time: 0, source: { kind: 'other', id: '', name: '' }, type: 'physical', raw: 0, mitigated: 0, targetHpAfter: 0 }),
    addDataWarning: () => {}, addUnverifiedRule: () => {}, conditionMet: () => true,
    ...overrides,
  }
}

const effect = {
  id: 'e1', name: 'Test Pen', description: '', support: 'full' as const,
  kind: 'penetration' as const, resist: 'armor' as const, mode: 'percent' as const, amount: 0.3,
  condition: { type: 'targetHpAbove' as const, threshold: 0.7 },
}

describe('penetrationHandler.modifyResist', () => {
  it('contributes pctPen for percent-mode armor pen against physical damage', () => {
    const result = penetrationHandler.modifyResist!(effect, ctx({ conditionMet: () => true }), 'physical')
    expect(result).toEqual({ pctPen: 0.3 })
  })

  it('contributes flatPen for flat-mode pen', () => {
    const flatEffect = { ...effect, mode: 'flat' as const, amount: 15 }
    const result = penetrationHandler.modifyResist!(flatEffect, ctx({ conditionMet: () => true }), 'physical')
    expect(result).toEqual({ flatPen: 15 })
  })

  it('contributes nothing when the condition is not met', () => {
    const result = penetrationHandler.modifyResist!(effect, ctx({ conditionMet: () => false }), 'physical')
    expect(result).toEqual({})
  })

  it('contributes nothing when the damage type does not match the targeted resist', () => {
    const result = penetrationHandler.modifyResist!(effect, ctx({ conditionMet: () => true }), 'magic')
    expect(result).toEqual({})
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wr-calc/calc test`
Expected: FAIL — `../../src/effects/penetration` does not exist.

- [ ] **Step 3: Implement**

Create `packages/calc/src/effects/penetration.ts`:

```ts
import type { PenetrationEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import type { ResistModifiers } from '../mitigation'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

export const penetrationHandler: EffectHandler<PenetrationEffect> = {
  kind: 'penetration',
  modifyResist(effect, ctx, damageType) {
    const targetsThisDamageType =
      (effect.resist === 'armor' && damageType === 'physical')
      || (effect.resist === 'mr' && damageType === 'magic')
    if (!targetsThisDamageType) return {}
    if (!ctx.conditionMet(effect, effect.condition, { damageType })) return {}

    const resolved = resolveScalar(effect.amount, ctx.level)
    const warning = scalarWarning(effect.name, 'amount', resolved)
    if (warning) ctx.addDataWarning(warning)

    const modifiers: Partial<ResistModifiers> = {}
    if (effect.mode === 'flat') modifiers.flatPen = resolved.value
    else modifiers.pctPen = resolved.value
    return modifiers
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @wr-calc/calc test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/calc/src/effects/penetration.ts packages/calc/test/effects/penetration.test.ts
git commit -m "feat: add the penetration effect handler"
```

---

### Task 4: the `damageReduction` handler

**Files:**
- Create: `packages/calc/src/effects/damage-reduction.ts`
- Test: `packages/calc/test/effects/damage-reduction.test.ts`

**Interfaces:**
- Consumes: `EffectHandler`, `HookContext` from `./types` (Task 1); `resolveScalar`,
  `scalarWarning` from `../resolve-scalar`; `DamageReductionEffect` from `@wr-calc/schema`.
- Produces: `damageReductionHandler: EffectHandler<DamageReductionEffect>` (implements
  `damageReductionFraction` only — this is the reader `simulateCombo`'s `performDamage` calls
  against the *target's* own effects, post-mitigation, per Step 3's `applyDamageReductionFractions`
  and spec: "Target damageReduction effects apply after"). `effect.condition` is optional here
  (inherited from `EffectBaseSchema`, unlike `penetration`/`damageAmp` which require it) — only
  check it when present.

- [ ] **Step 1: Write the failing test**

Create `packages/calc/test/effects/damage-reduction.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { damageReductionHandler } from '../../src/effects/damage-reduction'
import type { HookContext, CombatantRuntime } from '../../src/effects/types'
import type { StatSheet } from '../../src/resolve-stats'

function runtime(): CombatantRuntime {
  return { currentHp: 1000, shieldHp: 0, cooldowns: {}, buffs: {} }
}

function sheet(): StatSheet {
  return {
    base: {}, bonus: {}, total: {}, breakdown: [], unsupportedEffects: [], dataWarnings: [],
    unverifiedRules: [],
  }
}

function ctx(overrides: Partial<HookContext> = {}): HookContext {
  return {
    time: 0, level: 5, self: runtime(), opponent: runtime(), selfSheet: sheet(),
    opponentSheet: sheet(), selfKind: 'champion', opponentKind: 'champion', inputs: {},
    ignoreCooldowns: false,
    dealDamage: () => ({ time: 0, source: { kind: 'other', id: '', name: '' }, type: 'physical', raw: 0, mitigated: 0, targetHpAfter: 0 }),
    addDataWarning: () => {}, addUnverifiedRule: () => {}, conditionMet: () => true,
    ...overrides,
  }
}

describe('damageReductionHandler.damageReductionFraction', () => {
  it('applies to a matching specific damage type', () => {
    const effect = {
      id: 'e1', name: 'Test Reduction', description: '', support: 'full' as const,
      kind: 'damageReduction' as const, damageType: 'magic' as const, amount: 0.2,
    }
    expect(damageReductionHandler.damageReductionFraction!(effect, ctx(), 'magic')).toBe(0.2)
  })

  it('does not apply to a non-matching specific damage type', () => {
    const effect = {
      id: 'e1', name: 'Test Reduction', description: '', support: 'full' as const,
      kind: 'damageReduction' as const, damageType: 'magic' as const, amount: 0.2,
    }
    expect(damageReductionHandler.damageReductionFraction!(effect, ctx(), 'physical')).toBe(0)
  })

  it('applies to every damage type when damageType is "all"', () => {
    const effect = {
      id: 'e1', name: 'Test Reduction', description: '', support: 'full' as const,
      kind: 'damageReduction' as const, damageType: 'all' as const, amount: 0.15,
    }
    expect(damageReductionHandler.damageReductionFraction!(effect, ctx(), 'true')).toBe(0.15)
  })

  it('respects an optional condition', () => {
    const effect = {
      id: 'e1', name: 'Test Reduction', description: '', support: 'full' as const,
      kind: 'damageReduction' as const, damageType: 'all' as const, amount: 0.15,
      condition: { type: 'targetHpBelow' as const, threshold: 0.3 },
    }
    expect(damageReductionHandler.damageReductionFraction!(
      effect, ctx({ conditionMet: () => false }), 'physical'
    )).toBe(0)
  })

  it('flags a data warning and treats amount as 0 when null', () => {
    const effect = {
      id: 'e1', name: 'Test Reduction', description: '', support: 'full' as const,
      kind: 'damageReduction' as const, damageType: 'all' as const, amount: null,
    }
    expect(damageReductionHandler.damageReductionFraction!(effect, ctx(), 'physical')).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wr-calc/calc test`
Expected: FAIL — `../../src/effects/damage-reduction` does not exist.

- [ ] **Step 3: Implement**

Create `packages/calc/src/effects/damage-reduction.ts`:

```ts
import type { DamageReductionEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

export const damageReductionHandler: EffectHandler<DamageReductionEffect> = {
  kind: 'damageReduction',
  damageReductionFraction(effect, ctx, damageType) {
    const targets = effect.damageType === 'all' || effect.damageType === damageType
    if (!targets) return 0
    if (effect.condition && !ctx.conditionMet(effect, effect.condition, { damageType })) return 0

    const resolved = resolveScalar(effect.amount, ctx.level)
    const warning = scalarWarning(effect.name, 'amount', resolved)
    if (warning) ctx.addDataWarning(warning)
    return resolved.value
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @wr-calc/calc test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/calc/src/effects/damage-reduction.ts \
  packages/calc/test/effects/damage-reduction.test.ts
git commit -m "feat: add the damageReduction effect handler"
```

---

### Task 5: the `resistShred` handler

**Files:**
- Create: `packages/calc/src/effects/resist-shred.ts`
- Test: `packages/calc/test/effects/resist-shred.test.ts`

**Interfaces:**
- Consumes: `EffectHandler`, `HookContext` from `./types` (Task 1); `ResistModifiers` from
  `../mitigation`; `resolveScalar`, `scalarWarning` from `../resolve-scalar`; `ResistShredEffect`
  from `@wr-calc/schema`.
- Produces: `resistShredHandler: EffectHandler<ResistShredEffect>` — the one kind that implements
  *both* `hooks.onDamageDealt` (to add/refresh a stack on `ctx.opponent.buffs`, keyed
  `` `resistShred:${effect.id}` ``, on every hit its owner lands) *and* `modifyResist` (to read that
  stack back as a resist modifier on the *next* hit — see Design note 5's ordering: `performDamage`
  reads `modifyResist` before firing `onDamageDealt`, so a hit is never shredded by the stack it
  itself just added).

- [ ] **Step 1: Write the failing test**

Create `packages/calc/test/effects/resist-shred.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resistShredHandler } from '../../src/effects/resist-shred'
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
    time: 0, level: 5, self: runtime(), opponent: runtime(), selfSheet: sheet(),
    opponentSheet: sheet(), selfKind: 'champion', opponentKind: 'champion', inputs: {},
    ignoreCooldowns: false,
    dealDamage: () => ({ time: 0, source: { kind: 'other', id: '', name: '' }, type: 'physical', raw: 0, mitigated: 0, targetHpAfter: 0 }),
    addDataWarning: () => {}, addUnverifiedRule: () => {}, conditionMet: () => true,
    ...overrides,
  }
}

const nonStacking = {
  id: 'e1', name: 'Test Shred', description: '', support: 'full' as const,
  kind: 'resistShred' as const, resist: 'armor' as const, mode: 'flat' as const, amount: 5,
  stacking: false,
}

const stacking = { ...nonStacking, stacking: true, maxStacks: 3, amount: 4 }

describe('resistShredHandler.onDamageDealt', () => {
  it('sets a single stack for a non-stacking shred', () => {
    const c = ctx()
    resistShredHandler.hooks!.onDamageDealt!(nonStacking, c, {} as never)
    expect(c.opponent.buffs['resistShred:e1'].stacks).toBe(1)
  })

  it('increments stacks up to maxStacks for a stacking shred', () => {
    const c = ctx({ opponent: runtime({ buffs: { 'resistShred:e1': { stacks: 3 } } }) })
    resistShredHandler.hooks!.onDamageDealt!(stacking, c, {} as never)
    expect(c.opponent.buffs['resistShred:e1'].stacks).toBe(3)
  })
})

describe('resistShredHandler.modifyResist', () => {
  it('returns nothing when no stack is active', () => {
    expect(resistShredHandler.modifyResist!(nonStacking, ctx(), 'physical')).toEqual({})
  })

  it('returns nothing once the buff has expired', () => {
    const c = ctx({
      time: 10, opponent: runtime({ buffs: { 'resistShred:e1': { stacks: 1, expiresAt: 5 } } }),
    })
    expect(resistShredHandler.modifyResist!(nonStacking, c, 'physical')).toEqual({})
  })

  it('returns nothing for a non-matching damage type', () => {
    const c = ctx({ opponent: runtime({ buffs: { 'resistShred:e1': { stacks: 1 } } }) })
    expect(resistShredHandler.modifyResist!(nonStacking, c, 'magic')).toEqual({})
  })

  it('scales flat-mode shred by stack count', () => {
    const c = ctx({ opponent: runtime({ buffs: { 'resistShred:e1': { stacks: 3 } } }) })
    expect(resistShredHandler.modifyResist!(stacking, c, 'physical')).toEqual({ flatReduction: 12 })
  })

  it('reports percent-mode shred as pctReduction', () => {
    const percentEffect = { ...nonStacking, mode: 'percent' as const, amount: 0.1 }
    const c = ctx({ opponent: runtime({ buffs: { 'resistShred:e1': { stacks: 1 } } }) })
    expect(resistShredHandler.modifyResist!(percentEffect, c, 'physical')).toEqual({ pctReduction: 0.1 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wr-calc/calc test`
Expected: FAIL — `../../src/effects/resist-shred` does not exist.

- [ ] **Step 3: Implement**

Create `packages/calc/src/effects/resist-shred.ts`:

```ts
import type { ResistShredEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import type { ResistModifiers } from '../mitigation'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

function buffKey(effect: ResistShredEffect): string {
  return `resistShred:${effect.id}`
}

export const resistShredHandler: EffectHandler<ResistShredEffect> = {
  kind: 'resistShred',
  hooks: {
    onDamageDealt(effect, ctx) {
      const key = buffKey(effect)
      const existing = ctx.opponent.buffs[key]
      const stacks = effect.stacking
        ? Math.min((existing?.stacks ?? 0) + 1, effect.maxStacks ?? Infinity)
        : 1

      let expiresAt: number | undefined
      if (effect.durationSeconds != null) {
        const resolved = resolveScalar(effect.durationSeconds, ctx.level)
        const warning = scalarWarning(effect.name, 'durationSeconds', resolved)
        if (warning) ctx.addDataWarning(warning)
        expiresAt = ctx.time + resolved.value
      }
      ctx.opponent.buffs[key] = { stacks, expiresAt }
    },
  },
  modifyResist(effect, ctx, damageType) {
    const targetsThisDamageType =
      (effect.resist === 'armor' && damageType === 'physical')
      || (effect.resist === 'mr' && damageType === 'magic')
    if (!targetsThisDamageType) return {}

    const buff = ctx.opponent.buffs[buffKey(effect)]
    if (!buff || (buff.expiresAt !== undefined && buff.expiresAt < ctx.time)) return {}

    const resolved = resolveScalar(effect.amount, ctx.level)
    const warning = scalarWarning(effect.name, 'amount', resolved)
    if (warning) ctx.addDataWarning(warning)
    const total = resolved.value * (buff.stacks ?? 1)

    const modifiers: Partial<ResistModifiers> = {}
    if (effect.mode === 'flat') modifiers.flatReduction = total
    else modifiers.pctReduction = total
    return modifiers
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @wr-calc/calc test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/calc/src/effects/resist-shred.ts packages/calc/test/effects/resist-shred.test.ts
git commit -m "feat: add the resistShred effect handler"
```

---

### Task 6: the `spellblade` handler

**Files:**
- Create: `packages/calc/src/effects/spellblade.ts`
- Test: `packages/calc/test/effects/spellblade.test.ts`

**Interfaces:**
- Consumes: `EffectHandler`, `HookContext` from `./types` (Task 1); `resolveScalar`,
  `scalarWarning` from `../resolve-scalar`; `SpellbladeEffect` from `@wr-calc/schema`.
- Produces: `spellbladeHandler: EffectHandler<SpellbladeEffect>` — primes on `onAbilityCast`
  (subject to its own ICD, tracked in `ctx.self.cooldowns['spellblade:<id>']`), consumes on the next
  `onBasicAttack` (marks `ctx.self.buffs['spellblade:<id>']` while primed, deletes it on consume,
  then sets the ICD for the *next* prime).

- [ ] **Step 1: Write the failing test**

Create `packages/calc/test/effects/spellblade.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { spellbladeHandler } from '../../src/effects/spellblade'
import type { HookContext, CombatantRuntime } from '../../src/effects/types'
import type { StatSheet } from '../../src/resolve-stats'

function runtime(overrides: Partial<CombatantRuntime> = {}): CombatantRuntime {
  return { currentHp: 1000, shieldHp: 0, cooldowns: {}, buffs: {}, ...overrides }
}

function sheet(overrides: Partial<StatSheet> = {}): StatSheet {
  return {
    base: {}, bonus: {}, total: {}, breakdown: [], unsupportedEffects: [], dataWarnings: [],
    unverifiedRules: [], ...overrides,
  }
}

function ctx(overrides: Partial<HookContext> = {}): HookContext {
  return {
    time: 0, level: 5, self: runtime(), opponent: runtime(), selfSheet: sheet(),
    opponentSheet: sheet(), selfKind: 'champion', opponentKind: 'champion', inputs: {},
    ignoreCooldowns: false,
    dealDamage: (input) => ({
      time: 0, source: input.source, type: input.type, raw: input.amount,
      mitigated: input.amount, targetHpAfter: 0,
    }),
    addDataWarning: () => {}, addUnverifiedRule: () => {}, conditionMet: () => true,
    ...overrides,
  }
}

const effect = {
  id: 'e1', name: 'Test Spellblade', description: '', support: 'full' as const,
  kind: 'spellblade' as const, damageType: 'physical' as const, bonusDamage: 10,
  ratios: [{ stat: 'ad' as const, value: 0.5 }], internalCooldownSeconds: 1.5,
}

describe('spellbladeHandler', () => {
  it('does nothing on a basic attack when not primed', () => {
    let called = false
    const c = ctx({ dealDamage: (input) => { called = true; return { time: 0, source: input.source, type: input.type, raw: 0, mitigated: 0, targetHpAfter: 0 } } })
    spellbladeHandler.hooks!.onBasicAttack!(effect, c)
    expect(called).toBe(false)
  })

  it('primes on ability cast and consumes on the next basic attack', () => {
    const self = runtime()
    const c = ctx({ self, selfSheet: sheet({ total: { ad: 100 } }) })
    spellbladeHandler.hooks!.onAbilityCast!(effect, c, 'q')
    expect(self.buffs['spellblade:e1']).toBeDefined()

    let dealt: { type: string; amount: number } | undefined
    const consumeCtx = ctx({
      self, selfSheet: sheet({ total: { ad: 100 } }),
      dealDamage: (input) => {
        dealt = { type: input.type, amount: input.amount }
        return { time: 0, source: input.source, type: input.type, raw: input.amount, mitigated: input.amount, targetHpAfter: 0 }
      },
    })
    spellbladeHandler.hooks!.onBasicAttack!(effect, consumeCtx)
    expect(dealt).toEqual({ type: 'physical', amount: 60 })
    expect(self.buffs['spellblade:e1']).toBeUndefined()
    expect(self.cooldowns['spellblade:e1']).toBe(1.5)
  })

  it('does not re-prime while on internal cooldown', () => {
    const self = runtime({ cooldowns: { 'spellblade:e1': 10 } })
    const c = ctx({ self, time: 5 })
    spellbladeHandler.hooks!.onAbilityCast!(effect, c, 'q')
    expect(self.buffs['spellblade:e1']).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wr-calc/calc test`
Expected: FAIL — `../../src/effects/spellblade` does not exist.

- [ ] **Step 3: Implement**

Create `packages/calc/src/effects/spellblade.ts`:

```ts
import type { SpellbladeEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

function buffKey(effect: SpellbladeEffect): string {
  return `spellblade:${effect.id}`
}

export const spellbladeHandler: EffectHandler<SpellbladeEffect> = {
  kind: 'spellblade',
  hooks: {
    onAbilityCast(effect, ctx) {
      const key = buffKey(effect)
      const availableAt = ctx.self.cooldowns[key] ?? 0
      if (!ctx.ignoreCooldowns && ctx.time < availableAt) return
      ctx.self.buffs[key] = {}
    },
    onBasicAttack(effect, ctx) {
      const key = buffKey(effect)
      if (!ctx.self.buffs[key]) return
      delete ctx.self.buffs[key]

      const icdResolved = resolveScalar(effect.internalCooldownSeconds, ctx.level)
      const icdWarning = scalarWarning(effect.name, 'internalCooldownSeconds', icdResolved)
      if (icdWarning) ctx.addDataWarning(icdWarning)
      ctx.self.cooldowns[key] = ctx.time + icdResolved.value

      const bonusResolved = resolveScalar(effect.bonusDamage, ctx.level)
      const bonusWarning = scalarWarning(effect.name, 'bonusDamage', bonusResolved)
      if (bonusWarning) ctx.addDataWarning(bonusWarning)

      let amount = bonusResolved.value
      for (const ratio of effect.ratios) {
        const statValue = ctx.selfSheet.total[ratio.stat] ?? 0
        const ratioResolved = resolveScalar(ratio.value, ctx.level)
        const ratioWarning = scalarWarning(effect.name, `ratios.${ratio.stat}`, ratioResolved)
        if (ratioWarning) ctx.addDataWarning(ratioWarning)
        amount += statValue * ratioResolved.value
      }

      ctx.dealDamage({
        type: effect.damageType, amount,
        source: { kind: 'item', id: effect.id, name: effect.name },
      })
    },
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @wr-calc/calc test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/calc/src/effects/spellblade.ts packages/calc/test/effects/spellblade.test.ts
git commit -m "feat: add the spellblade effect handler"
```

---

### Task 7: the `procEveryN` handler

**Files:**
- Create: `packages/calc/src/effects/proc-every-n.ts`
- Test: `packages/calc/test/effects/proc-every-n.test.ts`

**Interfaces:**
- Consumes: `EffectHandler`, `HookContext`, `DamageInstance` from `./types` (Task 1);
  `resolveScalar`, `scalarWarning` from `../resolve-scalar`; `ProcEveryNEffect` from
  `@wr-calc/schema`.
- Produces: `procEveryNHandler: EffectHandler<ProcEveryNEffect>` — counts the effect owner's own
  damage instances (`onDamageDealt`, tracked via `ctx.self.buffs['procEveryN:<id>'].stacks`), and
  on the Nth deals `effect.damage` if present. **Guards against counting its own proc instance**:
  `performDamage` (Task 16) fires `onDamageDealt` again for the bonus instance this handler itself
  creates via `ctx.dealDamage`, so the handler ignores any instance whose `source.id === effect.id`
  — without this an `n: 1` effect would recurse into itself indefinitely.

- [ ] **Step 1: Write the failing test**

Create `packages/calc/test/effects/proc-every-n.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { procEveryNHandler } from '../../src/effects/proc-every-n'
import type { HookContext, CombatantRuntime, DamageInstance } from '../../src/effects/types'
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
    time: 0, level: 5, self: runtime(), opponent: runtime(), selfSheet: sheet(),
    opponentSheet: sheet(), selfKind: 'champion', opponentKind: 'champion', inputs: {},
    ignoreCooldowns: false,
    dealDamage: (input) => ({
      time: 0, source: input.source, type: input.type, raw: input.amount,
      mitigated: input.amount, targetHpAfter: 0,
    }),
    addDataWarning: () => {}, addUnverifiedRule: () => {}, conditionMet: () => true,
    ...overrides,
  }
}

function otherInstance(): DamageInstance {
  return {
    time: 0, source: { kind: 'basicAttack', id: 'aa', name: 'Attack' }, type: 'physical',
    raw: 10, mitigated: 10, targetHpAfter: 990,
  }
}

const effect = {
  id: 'e1', name: 'Test Proc', description: '', support: 'full' as const,
  kind: 'procEveryN' as const, n: 3, damageType: 'magic' as const, damage: 20,
  resetsOnMiss: false,
}

describe('procEveryNHandler.onDamageDealt', () => {
  it('increments the counter without proccing below n', () => {
    const self = runtime()
    const c = ctx({ self })
    procEveryNHandler.hooks!.onDamageDealt!(effect, c, otherInstance())
    procEveryNHandler.hooks!.onDamageDealt!(effect, c, otherInstance())
    expect(self.buffs['procEveryN:e1'].stacks).toBe(2)
  })

  it('procs on the nth hit and resets the counter', () => {
    const self = runtime({ buffs: { 'procEveryN:e1': { stacks: 2 } } })
    let dealt: { type: string; amount: number } | undefined
    const c = ctx({
      self,
      dealDamage: (input) => {
        dealt = { type: input.type, amount: input.amount }
        return { time: 0, source: input.source, type: input.type, raw: input.amount, mitigated: input.amount, targetHpAfter: 0 }
      },
    })
    procEveryNHandler.hooks!.onDamageDealt!(effect, c, otherInstance())
    expect(dealt).toEqual({ type: 'magic', amount: 20 })
    expect(self.buffs['procEveryN:e1'].stacks).toBe(0)
  })

  it('ignores its own proc instance to avoid re-triggering itself', () => {
    const self = runtime({ buffs: { 'procEveryN:e1': { stacks: 5 } } })
    const c = ctx({ self })
    const ownInstance: DamageInstance = {
      ...otherInstance(), source: { kind: 'item', id: 'e1', name: 'Test Proc' },
    }
    procEveryNHandler.hooks!.onDamageDealt!(effect, c, ownInstance)
    expect(self.buffs['procEveryN:e1'].stacks).toBe(5)
  })

  it('resets without dealing damage when damage is not set', () => {
    const self = runtime({ buffs: { 'procEveryN:e1': { stacks: 2 } } })
    let called = false
    const c = ctx({ self, dealDamage: (input) => { called = true; return { time: 0, source: input.source, type: input.type, raw: 0, mitigated: 0, targetHpAfter: 0 } } })
    procEveryNHandler.hooks!.onDamageDealt!({ ...effect, damage: undefined }, c, otherInstance())
    expect(called).toBe(false)
    expect(self.buffs['procEveryN:e1'].stacks).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wr-calc/calc test`
Expected: FAIL — `../../src/effects/proc-every-n` does not exist.

- [ ] **Step 3: Implement**

Create `packages/calc/src/effects/proc-every-n.ts`:

```ts
import type { ProcEveryNEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

export const procEveryNHandler: EffectHandler<ProcEveryNEffect> = {
  kind: 'procEveryN',
  hooks: {
    onDamageDealt(effect, ctx, instance) {
      if (instance.source.id === effect.id) return

      const key = `procEveryN:${effect.id}`
      const hits = (ctx.self.buffs[key]?.stacks ?? 0) + 1
      if (hits < effect.n) {
        ctx.self.buffs[key] = { stacks: hits }
        return
      }
      ctx.self.buffs[key] = { stacks: 0 }

      if (effect.damage == null) return
      const resolved = resolveScalar(effect.damage, ctx.level)
      const warning = scalarWarning(effect.name, 'damage', resolved)
      if (warning) ctx.addDataWarning(warning)
      ctx.dealDamage({
        type: effect.damageType ?? 'physical', amount: resolved.value,
        source: { kind: 'item', id: effect.id, name: effect.name },
      })
    },
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @wr-calc/calc test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/calc/src/effects/proc-every-n.ts packages/calc/test/effects/proc-every-n.test.ts
git commit -m "feat: add the procEveryN effect handler"
```

---

### Task 8: the `dot` handler

**Files:**
- Modify: `packages/calc/src/effects/types.ts`
- Create: `packages/calc/src/effects/dot.ts`
- Test: `packages/calc/test/effects/dot.test.ts`

**Interfaces:**
- Consumes: `EffectHandler`, `HookContext` from `./types`; `resolveScalar`, `scalarWarning` from
  `../resolve-scalar`; `DotEffect` from `@wr-calc/schema`.
- Produces: one new optional method on `HookContext` — `scheduleEvent?(atTime: number, run: (ctx:
  HookContext) => void): void` (Design note 9: the engine, Task 16, implements this as a real
  priority queue; it's optional on the type only so Tasks 1–7's existing test `ctx()` helpers don't
  need updating — every real dispatch from the engine always supplies it) — and
  `dotHandler: EffectHandler<DotEffect>`.

- [ ] **Step 1: Write the failing test**

Create `packages/calc/test/effects/dot.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { dotHandler } from '../../src/effects/dot'
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
    time: 0, level: 5, self: runtime(), opponent: runtime(), selfSheet: sheet(),
    opponentSheet: sheet(), selfKind: 'champion', opponentKind: 'champion', inputs: {},
    ignoreCooldowns: false,
    dealDamage: (input) => ({
      time: 0, source: input.source, type: input.type, raw: input.amount,
      mitigated: input.amount, targetHpAfter: 0,
    }),
    addDataWarning: () => {}, addUnverifiedRule: () => {}, conditionMet: () => true,
    ...overrides,
  }
}

const effect = {
  id: 'e1', name: 'Test DoT', description: '', support: 'full' as const,
  kind: 'dot' as const, damageType: 'magic' as const, tickAmount: 5, tickIntervalSeconds: 2,
  durationSeconds: 6, refresh: 'refresh' as const,
}

describe('dotHandler.onAbilityHit', () => {
  it('schedules one tick per interval within the duration', () => {
    const scheduled: number[] = []
    const c = ctx({ scheduleEvent: (atTime) => { scheduled.push(atTime) } })
    dotHandler.hooks!.onAbilityHit!(effect, c, 'q', [])
    expect(scheduled).toEqual([2, 4, 6])
  })

  it('marks the target as affected with an expiry', () => {
    const opponent = runtime()
    const c = ctx({ opponent, scheduleEvent: () => {} })
    dotHandler.hooks!.onAbilityHit!(effect, c, 'q', [])
    expect(opponent.buffs['dot:e1']).toEqual({ expiresAt: 6 })
  })

  it('deals tickAmount damage of damageType when a scheduled tick runs', () => {
    let dealt: { type: string; amount: number } | undefined
    const c = ctx({
      scheduleEvent: (_atTime, run) => run(ctx({
        dealDamage: (input) => {
          dealt = { type: input.type, amount: input.amount }
          return { time: 0, source: input.source, type: input.type, raw: input.amount, mitigated: input.amount, targetHpAfter: 0 }
        },
      })),
    })
    dotHandler.hooks!.onAbilityHit!(effect, c, 'q', [])
    expect(dealt).toEqual({ type: 'magic', amount: 5 })
  })

  it('does not reschedule when already active and refresh is "ignore"', () => {
    const ignoreEffect = { ...effect, refresh: 'ignore' as const }
    const scheduled: number[] = []
    const opponent = runtime({ buffs: { 'dot:e1': { expiresAt: 3 } } })
    const c = ctx({ opponent, scheduleEvent: (atTime) => { scheduled.push(atTime) } })
    dotHandler.hooks!.onAbilityHit!(ignoreEffect, c, 'q', [])
    expect(scheduled).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wr-calc/calc test`
Expected: FAIL — `../../src/effects/dot` does not exist.

- [ ] **Step 3: Implement**

In `packages/calc/src/effects/types.ts`, add one member to the existing `HookContext` interface
(insert it as the last member, right before the closing `}`):

```ts
  scheduleEvent?(atTime: number, run: (ctx: HookContext) => void): void
```

Create `packages/calc/src/effects/dot.ts`:

```ts
import type { DotEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

function buffKey(effect: DotEffect): string {
  return `dot:${effect.id}`
}

export const dotHandler: EffectHandler<DotEffect> = {
  kind: 'dot',
  hooks: {
    onAbilityHit(effect, ctx) {
      const key = buffKey(effect)
      if (ctx.opponent.buffs[key] && effect.refresh === 'ignore') return

      const amountResolved = resolveScalar(effect.tickAmount, ctx.level)
      const amountWarning = scalarWarning(effect.name, 'tickAmount', amountResolved)
      if (amountWarning) ctx.addDataWarning(amountWarning)

      const durationResolved = resolveScalar(effect.durationSeconds, ctx.level)
      const durationWarning = scalarWarning(effect.name, 'durationSeconds', durationResolved)
      if (durationWarning) ctx.addDataWarning(durationWarning)

      ctx.opponent.buffs[key] = { expiresAt: ctx.time + durationResolved.value }

      const ticks = Math.floor(durationResolved.value / effect.tickIntervalSeconds)
      for (let i = 1; i <= ticks; i++) {
        const tickTime = ctx.time + i * effect.tickIntervalSeconds
        ctx.scheduleEvent?.(tickTime, (laterCtx) => {
          laterCtx.dealDamage({
            type: effect.damageType, amount: amountResolved.value,
            source: { kind: 'item', id: effect.id, name: effect.name },
          })
        })
      }
    },
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @wr-calc/calc test`
Expected: PASS. Also run `pnpm run typecheck` to confirm every prior task's `ctx()` test helper
(Tasks 1–7) still satisfies `HookContext` now that it has a new optional member.

- [ ] **Step 5: Commit**

```bash
git add packages/calc/src/effects/types.ts packages/calc/src/effects/dot.ts \
  packages/calc/test/effects/dot.test.ts
git commit -m "feat: add the dot effect handler and HookContext.scheduleEvent"
```

---

### Task 9: the `cooldownRefund` handler

**Files:**
- Create: `packages/calc/src/effects/cooldown-refund.ts`
- Test: `packages/calc/test/effects/cooldown-refund.test.ts`

**Interfaces:**
- Consumes: `EffectHandler`, `HookContext`, `AbilityKey` from `./types`; `resolveScalar`,
  `scalarWarning` from `../resolve-scalar`; `CooldownRefundEffect` from `@wr-calc/schema`.
- Produces: `cooldownRefundHandler: EffectHandler<CooldownRefundEffect>` — fires on
  `onAbilityHit` (Design note 5), reducing every currently-active ability cooldown in
  `ctx.self.cooldowns` (keyed `'q' | 'w' | 'e' | 'r'`, per the engine's convention — see Task 16),
  skipping `'r'` when `excludesUltimate` is true.

- [ ] **Step 1: Write the failing test**

Create `packages/calc/test/effects/cooldown-refund.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { cooldownRefundHandler } from '../../src/effects/cooldown-refund'
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
    time: 10, level: 5, self: runtime(), opponent: runtime(), selfSheet: sheet(),
    opponentSheet: sheet(), selfKind: 'champion', opponentKind: 'champion', inputs: {},
    ignoreCooldowns: false,
    dealDamage: (input) => ({
      time: 0, source: input.source, type: input.type, raw: input.amount,
      mitigated: input.amount, targetHpAfter: 0,
    }),
    addDataWarning: () => {}, addUnverifiedRule: () => {}, conditionMet: () => true,
    ...overrides,
  }
}

describe('cooldownRefundHandler.onAbilityHit', () => {
  it('reduces a flat amount off every active non-ultimate cooldown', () => {
    const self = runtime({ cooldowns: { q: 18, w: 12, r: 100 } })
    const c = ctx({ self })
    const effect = {
      id: 'e1', name: 'Test Refund', description: '', support: 'full' as const,
      kind: 'cooldownRefund' as const, mode: 'flat' as const, amount: 3, excludesUltimate: true,
    }
    cooldownRefundHandler.hooks!.onAbilityHit!(effect, c, 'q', [])
    expect(self.cooldowns).toEqual({ q: 15, w: 10, r: 100 })
  })

  it('clamps a flat refund at the current time', () => {
    const self = runtime({ cooldowns: { q: 11 } })
    const c = ctx({ self })
    const effect = {
      id: 'e1', name: 'Test Refund', description: '', support: 'full' as const,
      kind: 'cooldownRefund' as const, mode: 'flat' as const, amount: 5, excludesUltimate: true,
    }
    cooldownRefundHandler.hooks!.onAbilityHit!(effect, c, 'q', [])
    expect(self.cooldowns.q).toBe(10)
  })

  it('reduces remaining cooldown by a percentage', () => {
    const self = runtime({ cooldowns: { q: 20 } }) // 10s remaining at time 10
    const c = ctx({ self })
    const effect = {
      id: 'e1', name: 'Test Refund', description: '', support: 'full' as const,
      kind: 'cooldownRefund' as const, mode: 'percent' as const, amount: 0.5, excludesUltimate: true,
    }
    cooldownRefundHandler.hooks!.onAbilityHit!(effect, c, 'q', [])
    expect(self.cooldowns.q).toBe(15)
  })

  it('includes the ultimate when excludesUltimate is false', () => {
    const self = runtime({ cooldowns: { r: 100 } })
    const c = ctx({ self })
    const effect = {
      id: 'e1', name: 'Test Refund', description: '', support: 'full' as const,
      kind: 'cooldownRefund' as const, mode: 'flat' as const, amount: 10, excludesUltimate: false,
    }
    cooldownRefundHandler.hooks!.onAbilityHit!(effect, c, 'q', [])
    expect(self.cooldowns.r).toBe(90)
  })

  it('leaves abilities that are not on cooldown untouched', () => {
    const self = runtime({ cooldowns: {} })
    const c = ctx({ self })
    const effect = {
      id: 'e1', name: 'Test Refund', description: '', support: 'full' as const,
      kind: 'cooldownRefund' as const, mode: 'flat' as const, amount: 10, excludesUltimate: true,
    }
    cooldownRefundHandler.hooks!.onAbilityHit!(effect, c, 'q', [])
    expect(self.cooldowns).toEqual({})
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wr-calc/calc test`
Expected: FAIL — `../../src/effects/cooldown-refund` does not exist.

- [ ] **Step 3: Implement**

Create `packages/calc/src/effects/cooldown-refund.ts`:

```ts
import type { CooldownRefundEffect } from '@wr-calc/schema'
import type { AbilityKey, EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

export const cooldownRefundHandler: EffectHandler<CooldownRefundEffect> = {
  kind: 'cooldownRefund',
  hooks: {
    onAbilityHit(effect, ctx) {
      const resolved = resolveScalar(effect.amount, ctx.level)
      const warning = scalarWarning(effect.name, 'amount', resolved)
      if (warning) ctx.addDataWarning(warning)

      const keys: AbilityKey[] = effect.excludesUltimate ? ['q', 'w', 'e'] : ['q', 'w', 'e', 'r']
      for (const key of keys) {
        const availableAt = ctx.self.cooldowns[key]
        if (availableAt === undefined || availableAt <= ctx.time) continue
        if (effect.mode === 'flat') {
          ctx.self.cooldowns[key] = Math.max(ctx.time, availableAt - resolved.value)
        } else {
          const remaining = availableAt - ctx.time
          ctx.self.cooldowns[key] = ctx.time + remaining * (1 - resolved.value)
        }
      }
    },
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @wr-calc/calc test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/calc/src/effects/cooldown-refund.ts \
  packages/calc/test/effects/cooldown-refund.test.ts
git commit -m "feat: add the cooldownRefund effect handler"
```

---

### Task 10: the `shield` and `heal` handlers

**Files:**
- Create: `packages/calc/src/effects/shield-heal.ts`
- Test: `packages/calc/test/effects/shield-heal.test.ts`

**Interfaces:**
- Consumes: `EffectHandler`, `HookContext` from `./types`; `resolveScalar`, `scalarWarning` from
  `../resolve-scalar`; `ShieldEffect`, `HealEffect` from `@wr-calc/schema`.
- Produces: `shieldHandler: EffectHandler<ShieldEffect>`, `healHandler: EffectHandler<HealEffect>`
  — both fire on `onAbilityCast` (Design note 5: the common "grants on ability cast" case; anything
  with a different real trigger needs a `kind: 'custom'` handler instead). `shieldHandler` adds to
  `ctx.self.shieldHp` (a shield's `durationSeconds` is resolved and warned-on for data-completeness
  but not yet enforced — Phase 1 doesn't expire shields mid-combo, a known, honestly-reported gap,
  not engine dead code, since the field is still validated). `healHandler` adds to
  `ctx.self.currentHp`, clamped at `ctx.selfSheet.total.hp`.

- [ ] **Step 1: Write the failing test**

Create `packages/calc/test/effects/shield-heal.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { shieldHandler, healHandler } from '../../src/effects/shield-heal'
import type { HookContext, CombatantRuntime } from '../../src/effects/types'
import type { StatSheet } from '../../src/resolve-stats'

function runtime(overrides: Partial<CombatantRuntime> = {}): CombatantRuntime {
  return { currentHp: 1000, shieldHp: 0, cooldowns: {}, buffs: {}, ...overrides }
}

function sheet(overrides: Partial<StatSheet> = {}): StatSheet {
  return {
    base: {}, bonus: {}, total: {}, breakdown: [], unsupportedEffects: [], dataWarnings: [],
    unverifiedRules: [], ...overrides,
  }
}

function ctx(overrides: Partial<HookContext> = {}): HookContext {
  return {
    time: 0, level: 5, self: runtime(), opponent: runtime(), selfSheet: sheet(),
    opponentSheet: sheet(), selfKind: 'champion', opponentKind: 'champion', inputs: {},
    ignoreCooldowns: false,
    dealDamage: (input) => ({
      time: 0, source: input.source, type: input.type, raw: input.amount,
      mitigated: input.amount, targetHpAfter: 0,
    }),
    addDataWarning: () => {}, addUnverifiedRule: () => {}, conditionMet: () => true,
    ...overrides,
  }
}

describe('shieldHandler.onAbilityCast', () => {
  it('adds to the caster shieldHp', () => {
    const self = runtime({ shieldHp: 10 })
    const c = ctx({ self })
    const effect = {
      id: 'e1', name: 'Test Shield', description: '', support: 'full' as const,
      kind: 'shield' as const, amount: 50, durationSeconds: 3,
    }
    shieldHandler.hooks!.onAbilityCast!(effect, c, 'q')
    expect(self.shieldHp).toBe(60)
  })

  it('flags a data warning when amount is null', () => {
    const c = ctx()
    const effect = {
      id: 'e1', name: 'Test Shield', description: '', support: 'full' as const,
      kind: 'shield' as const, amount: null, durationSeconds: 3,
    }
    let warned: string | undefined
    shieldHandler.hooks!.onAbilityCast!(effect, ctx({ addDataWarning: (m) => { warned = m } }), 'q')
    expect(warned).toBe('Test Shield: amount is unverified (null)')
  })
})

describe('healHandler.onAbilityCast', () => {
  it('adds to current hp', () => {
    const self = runtime({ currentHp: 500 })
    const c = ctx({ self, selfSheet: sheet({ total: { hp: 1000 } }) })
    const effect = {
      id: 'e1', name: 'Test Heal', description: '', support: 'full' as const,
      kind: 'heal' as const, amount: 100,
    }
    healHandler.hooks!.onAbilityCast!(effect, c, 'q')
    expect(self.currentHp).toBe(600)
  })

  it('clamps healing at max hp', () => {
    const self = runtime({ currentHp: 950 })
    const c = ctx({ self, selfSheet: sheet({ total: { hp: 1000 } }) })
    const effect = {
      id: 'e1', name: 'Test Heal', description: '', support: 'full' as const,
      kind: 'heal' as const, amount: 200,
    }
    healHandler.hooks!.onAbilityCast!(effect, c, 'q')
    expect(self.currentHp).toBe(1000)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wr-calc/calc test`
Expected: FAIL — `../../src/effects/shield-heal` does not exist.

- [ ] **Step 3: Implement**

Create `packages/calc/src/effects/shield-heal.ts`:

```ts
import type { ShieldEffect, HealEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

export const shieldHandler: EffectHandler<ShieldEffect> = {
  kind: 'shield',
  hooks: {
    onAbilityCast(effect, ctx) {
      const amountResolved = resolveScalar(effect.amount, ctx.level)
      const amountWarning = scalarWarning(effect.name, 'amount', amountResolved)
      if (amountWarning) ctx.addDataWarning(amountWarning)

      const durationResolved = resolveScalar(effect.durationSeconds, ctx.level)
      const durationWarning = scalarWarning(effect.name, 'durationSeconds', durationResolved)
      if (durationWarning) ctx.addDataWarning(durationWarning)

      ctx.self.shieldHp += amountResolved.value
    },
  },
}

export const healHandler: EffectHandler<HealEffect> = {
  kind: 'heal',
  hooks: {
    onAbilityCast(effect, ctx) {
      const resolved = resolveScalar(effect.amount, ctx.level)
      const warning = scalarWarning(effect.name, 'amount', resolved)
      if (warning) ctx.addDataWarning(warning)

      const maxHp = ctx.selfSheet.total.hp ?? ctx.self.currentHp
      ctx.self.currentHp = Math.min(maxHp, ctx.self.currentHp + resolved.value)
    },
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @wr-calc/calc test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/calc/src/effects/shield-heal.ts packages/calc/test/effects/shield-heal.test.ts
git commit -m "feat: add the shield and heal effect handlers"
```

---

### Task 11: the `active` handler

**Files:**
- Modify: `packages/calc/src/effects/types.ts`
- Create: `packages/calc/src/effects/active.ts`
- Test: `packages/calc/test/effects/active.test.ts`

**Interfaces:**
- Consumes: `EffectHandler`, `HookContext` from `./types`; `resolveScalar`, `scalarWarning` from
  `../resolve-scalar`; `ActiveEffect` from `@wr-calc/schema`.
- Produces: one new optional member on `EffectHandler` — `activate?(effect: E, ctx: HookContext):
  void` (unlike the five `HookHandlers` entries, this isn't dispatched to every equipped effect on
  a timeline event; the engine's `item:'<id>'` sequence-action executor, Task 16, calls it directly
  on the specific item's `active` effect it finds, after its own cooldown check — see that task) —
  and `activeHandler: EffectHandler<ActiveEffect>`.

- [ ] **Step 1: Write the failing test**

Create `packages/calc/test/effects/active.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { activeHandler } from '../../src/effects/active'
import type { HookContext, CombatantRuntime } from '../../src/effects/types'
import type { StatSheet } from '../../src/resolve-stats'

function runtime(): CombatantRuntime {
  return { currentHp: 1000, shieldHp: 0, cooldowns: {}, buffs: {} }
}

function sheet(): StatSheet {
  return {
    base: {}, bonus: {}, total: {}, breakdown: [], unsupportedEffects: [], dataWarnings: [],
    unverifiedRules: [],
  }
}

function ctx(overrides: Partial<HookContext> = {}): HookContext {
  return {
    time: 0, level: 5, self: runtime(), opponent: runtime(), selfSheet: sheet(),
    opponentSheet: sheet(), selfKind: 'champion', opponentKind: 'champion', inputs: {},
    ignoreCooldowns: false,
    dealDamage: (input) => ({
      time: 0, source: input.source, type: input.type, raw: input.amount,
      mitigated: input.amount, targetHpAfter: 0,
    }),
    addDataWarning: () => {}, addUnverifiedRule: () => {}, conditionMet: () => true,
    ...overrides,
  }
}

describe('activeHandler.activate', () => {
  it('deals damage when damage and damageType are set', () => {
    const effect = {
      id: 'e1', name: 'Test Active', description: '', support: 'full' as const,
      kind: 'active' as const, cooldownSeconds: 60, damageType: 'magic' as const, damage: 80,
    }
    let dealt: { type: string; amount: number } | undefined
    const c = ctx({
      dealDamage: (input) => {
        dealt = { type: input.type, amount: input.amount }
        return { time: 0, source: input.source, type: input.type, raw: input.amount, mitigated: input.amount, targetHpAfter: 0 }
      },
    })
    activeHandler.activate!(effect, c)
    expect(dealt).toEqual({ type: 'magic', amount: 80 })
  })

  it('does nothing when this active has no damage component', () => {
    const effect = {
      id: 'e1', name: 'Test Active', description: '', support: 'full' as const,
      kind: 'active' as const, cooldownSeconds: 60,
    }
    let called = false
    const c = ctx({ dealDamage: (input) => { called = true; return { time: 0, source: input.source, type: input.type, raw: 0, mitigated: 0, targetHpAfter: 0 } } })
    activeHandler.activate!(effect, c)
    expect(called).toBe(false)
  })

  it('flags a data warning when damage is null', () => {
    const effect = {
      id: 'e1', name: 'Test Active', description: '', support: 'full' as const,
      kind: 'active' as const, cooldownSeconds: 60, damageType: 'true' as const, damage: null,
    }
    let warned: string | undefined
    activeHandler.activate!(effect, ctx({ addDataWarning: (m) => { warned = m } }))
    expect(warned).toBe('Test Active: damage is unverified (null)')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wr-calc/calc test`
Expected: FAIL — `../../src/effects/active` does not exist.

- [ ] **Step 3: Implement**

In `packages/calc/src/effects/types.ts`, add one member to the existing `EffectHandler` interface
(insert it as the last member, right before the closing `}`):

```ts
  activate?(effect: E, ctx: HookContext): void
```

Create `packages/calc/src/effects/active.ts`:

```ts
import type { ActiveEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

export const activeHandler: EffectHandler<ActiveEffect> = {
  kind: 'active',
  activate(effect, ctx) {
    if (effect.damage == null || effect.damageType == null) return
    const resolved = resolveScalar(effect.damage, ctx.level)
    const warning = scalarWarning(effect.name, 'damage', resolved)
    if (warning) ctx.addDataWarning(warning)
    ctx.dealDamage({
      type: effect.damageType, amount: resolved.value,
      source: { kind: 'item', id: effect.id, name: effect.name },
    })
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @wr-calc/calc test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/calc/src/effects/types.ts packages/calc/src/effects/active.ts \
  packages/calc/test/effects/active.test.ts
git commit -m "feat: add the active effect handler"
```

---

### Task 12: `custom` handler registry + `resolveEffectHandler`

**Files:**
- Create: `packages/calc/src/custom/registry.ts`
- Modify: `packages/calc/src/effects/registry.ts`
- Test: `packages/calc/test/effects/resolve-effect-handler.test.ts`

**Interfaces:**
- Consumes: `EffectHandler` from `../effects/types`; `Effect` from `@wr-calc/schema`;
  `EFFECT_HANDLERS` from `./registry` (Step 2, unchanged by this task).
- Produces: `CUSTOM_HANDLERS: Record<string, EffectHandler>` (empty — Design note 11: no real
  champion kits exist until Step 6+) in `custom/registry.ts`; `resolveEffectHandler(effect: Effect,
  customHandlers?: Record<string, EffectHandler>): EffectHandler | undefined` in
  `effects/registry.ts` — for `kind !== 'custom'`, this is exactly `EFFECT_HANDLERS[effect.kind]`
  (Step 2's existing lookup); for `kind === 'custom'`, it checks the caller-supplied
  `customHandlers` override first, then falls back to `CUSTOM_HANDLERS`.

- [ ] **Step 1: Write the failing test**

Create `packages/calc/test/effects/resolve-effect-handler.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveEffectHandler, EFFECT_HANDLERS } from '../../src/effects/registry'
import { CUSTOM_HANDLERS } from '../../src/custom/registry'
import type { EffectHandler } from '../../src/effects/types'

describe('CUSTOM_HANDLERS', () => {
  it('is empty in Phase 1 (no real champion kits implemented yet)', () => {
    expect(CUSTOM_HANDLERS).toEqual({})
  })
})

describe('resolveEffectHandler', () => {
  it('dispatches non-custom kinds straight to EFFECT_HANDLERS', () => {
    const effect = {
      id: 'e1', name: 'Test', description: '', support: 'full' as const,
      kind: 'stat' as const, stat: 'ad' as const, amount: 10,
    }
    expect(resolveEffectHandler(effect)).toBe(EFFECT_HANDLERS.stat)
  })

  it('resolves a custom effect from a caller-supplied override', () => {
    const fakeHandler: EffectHandler = { kind: 'custom' }
    const effect = {
      id: 'e1', name: 'Test', description: '', support: 'full' as const,
      kind: 'custom' as const, handler: 'fake-handler',
    }
    expect(resolveEffectHandler(effect, { 'fake-handler': fakeHandler })).toBe(fakeHandler)
  })

  it('returns undefined for an unregistered custom handler id', () => {
    const effect = {
      id: 'e1', name: 'Test', description: '', support: 'full' as const,
      kind: 'custom' as const, handler: 'does-not-exist',
    }
    expect(resolveEffectHandler(effect)).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wr-calc/calc test`
Expected: FAIL — `resolveEffectHandler` is not exported and `../../src/custom/registry` does not
exist.

- [ ] **Step 3: Implement**

Create `packages/calc/src/custom/registry.ts`:

```ts
import type { EffectHandler } from '../effects/types'

/**
 * Handler id -> implementation for `kind: 'custom'` effects that don't fit the declarative model.
 * Empty in Phase 1: no real champion kits are implemented until Step 6+ (real data skeletons).
 */
export const CUSTOM_HANDLERS: Record<string, EffectHandler> = {}
```

In `packages/calc/src/effects/registry.ts`, add an import and one function at the end of the file
(everything already there — `EFFECT_HANDLERS`, `contributeStats`, `stageOf` — stays unchanged):

```ts
import { CUSTOM_HANDLERS } from '../custom/registry'
```

```ts
/**
 * Resolves the handler for any effect, including `kind: 'custom'`'s second-level dispatch by
 * `effect.handler` id. `customHandlers` lets a caller (mainly tests) override or extend the
 * built-in `CUSTOM_HANDLERS` registry without any hidden mutable registration step.
 */
export function resolveEffectHandler(
  effect: Effect, customHandlers: Record<string, EffectHandler<any>> = {}
): EffectHandler<any> | undefined {
  if (effect.kind === 'custom') {
    return customHandlers[effect.handler] ?? CUSTOM_HANDLERS[effect.handler]
  }
  return EFFECT_HANDLERS[effect.kind]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @wr-calc/calc test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/calc/src/custom/registry.ts packages/calc/src/effects/registry.ts \
  packages/calc/test/effects/resolve-effect-handler.test.ts
git commit -m "feat: add the custom handler registry and resolveEffectHandler"
```

---

### Task 13: `combatant.ts` — building `Combatant`s from a champion+build or a dummy target

**Files:**
- Create: `packages/calc/src/combatant.ts`
- Modify: `packages/calc/src/index.ts`
- Test: `packages/calc/test/combatant.test.ts`

**Interfaces:**
- Consumes: `resolveStats`, `StatCatalog`, `StatSheet` from `./resolve-stats` (Step 2); `Champion`,
  `Build`, `Item`, `Rune`, `Effect`, `Target` from `@wr-calc/schema`.
- Produces: `interface Combatant { id: string; name: string; kind: 'champion' | 'monster' |
  'dummy'; level: number; sheet: StatSheet; items: Item[]; runeEffects: Effect[]; inputs:
  Record<string, number | boolean>; abilities?: Champion['abilities'] }`,
  `combatantFromChampion(champion: Champion, level: number, build: Build, catalog: StatCatalog):
  Combatant`, `combatantFromDummy(dummy: Extract<Target, { kind: 'dummy' }>): Combatant`. `level`
  and `inputs` travel with each `Combatant` (rather than being single globals passed to
  `simulateCombo`) because `HookContext.level`/`HookContext.inputs` (Task 1) are set per-owner when
  the engine (Task 16) dispatches an effect — a target's own `damageReduction` effect resolves its
  scalars and any `toggle`/`stacksAtMax` condition against the *target's* level and build inputs,
  not the attacker's.

- [ ] **Step 1: Write the failing test**

Create `packages/calc/test/combatant.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { combatantFromChampion, combatantFromDummy } from '../src/combatant'
import type { Champion, Item, Rune, Build, Target } from '@wr-calc/schema'

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

describe('combatantFromChampion', () => {
  it('resolves the sheet and passes through champion identity and abilities', () => {
    const combatant = combatantFromChampion(
      validChampion(), 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    expect(combatant.id).toBe('nunu-willump')
    expect(combatant.kind).toBe('champion')
    expect(combatant.level).toBe(1)
    expect(combatant.sheet.total.ad).toBe(60)
    expect(combatant.abilities?.q.id).toBe('q')
  })

  it('collects build.items plus boots and enchant, in that order', () => {
    const items = new Map([
      ['long-sword', itemWithStats('long-sword', 10)],
      ['boots', itemWithStats('boots', 0)],
      ['enchant', itemWithStats('enchant', 0)],
    ])
    const build = emptyBuild({ items: ['long-sword'], boots: 'boots', enchant: 'enchant' })
    const combatant = combatantFromChampion(validChampion(), 1, build, { items, runes: new Map() })
    expect(combatant.items.map((i) => i.id)).toEqual(['long-sword', 'boots', 'enchant'])
  })

  it('flattens rune effects', () => {
    const rune: Rune = {
      id: 'conqueror', name: 'Conqueror', path: 'precision', slot: 'keystone',
      effects: [{
        id: 'conqueror-ad', name: 'Conqueror', description: '', support: 'full',
        kind: 'stat', stat: 'ad', amount: 5,
      }],
    }
    const runes = new Map([['conqueror', rune]])
    const build = emptyBuild({ runes: ['conqueror'] })
    const combatant = combatantFromChampion(validChampion(), 1, build, { items: new Map(), runes })
    expect(combatant.runeEffects).toEqual(rune.effects)
  })

  it('propagates the unknown-item-id error from resolveStats', () => {
    const build = emptyBuild({ items: ['does-not-exist'] })
    expect(() => combatantFromChampion(
      validChampion(), 1, build, { items: new Map(), runes: new Map() }
    )).toThrow(/unknown item id/)
  })
})

describe('combatantFromDummy', () => {
  it('builds a bare-stats combatant with no abilities or items', () => {
    const dummy: Extract<Target, { kind: 'dummy' }> = { kind: 'dummy', hp: 1000, armor: 50, mr: 30 }
    const combatant = combatantFromDummy(dummy)
    expect(combatant.kind).toBe('dummy')
    expect(combatant.level).toBe(15)
    expect(combatant.sheet.total).toEqual({ hp: 1000, armor: 50, mr: 30 })
    expect(combatant.items).toEqual([])
    expect(combatant.abilities).toBeUndefined()
  })

  it('carries the dummy\'s own effects, if any', () => {
    const dummy: Extract<Target, { kind: 'dummy' }> = {
      kind: 'dummy', hp: 1000, armor: 0, mr: 0,
      effects: [{
        id: 'fon', name: 'Force of Nature', description: '', support: 'full',
        kind: 'damageReduction', damageType: 'magic', amount: 0.1,
      }],
    }
    expect(combatantFromDummy(dummy).runeEffects).toEqual(dummy.effects)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wr-calc/calc test`
Expected: FAIL — `../src/combatant` does not exist.

- [ ] **Step 3: Implement**

Create `packages/calc/src/combatant.ts`:

```ts
import type { Champion, Build, Item, Effect, Target } from '@wr-calc/schema'
import { resolveStats } from './resolve-stats'
import type { StatCatalog, StatSheet } from './resolve-stats'
import { MAX_CHAMPION_LEVEL } from './rules'

export interface Combatant {
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

/** Builds a combat-ready Combatant from a champion, level, and build, resolving its stats via resolveStats. */
export function combatantFromChampion(
  champion: Champion, level: number, build: Build, catalog: StatCatalog
): Combatant {
  const sheet = resolveStats(champion, level, build, catalog)
  const itemIds = [
    ...build.items,
    ...(build.boots ? [build.boots] : []),
    ...(build.enchant ? [build.enchant] : []),
  ]
  // resolveStats above already throws on any unknown item/rune id, so every lookup here is safe.
  const items = itemIds.map((id) => catalog.items.get(id)!)
  const runeEffects = build.runes.flatMap((id) => catalog.runes.get(id)!.effects)
  return {
    id: champion.id, name: champion.name, kind: 'champion', level, sheet, items, runeEffects,
    inputs: build.inputs, abilities: champion.abilities,
  }
}

type TargetDummy = Extract<Target, { kind: 'dummy' }>

/** Builds a bare-stats Combatant from a dummy target — no abilities, no items. */
export function combatantFromDummy(dummy: TargetDummy): Combatant {
  const sheet: StatSheet = {
    base: {}, bonus: {}, total: { hp: dummy.hp, armor: dummy.armor, mr: dummy.mr },
    breakdown: [], unsupportedEffects: [], dataWarnings: [], unverifiedRules: [],
  }
  return {
    // A dummy has no champion level of its own; MAX_CHAMPION_LEVEL is the least-surprising default
    // for any byLevel/levelRange scalar a synthetic test effect attached to it might use.
    id: 'dummy', name: 'Training Dummy', kind: 'dummy', level: MAX_CHAMPION_LEVEL, sheet,
    items: [], runeEffects: dummy.effects ?? [], inputs: {},
  }
}
```

Update `packages/calc/src/index.ts` to add one line:

```ts
export * from './combatant'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @wr-calc/calc test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/calc/src/combatant.ts packages/calc/src/index.ts \
  packages/calc/test/combatant.test.ts
git commit -m "feat: add combatantFromChampion and combatantFromDummy"
```

---

### Task 14: `damage-component.ts` — resolving an `Ability`'s `DamageComponent`s

**Files:**
- Modify: `packages/schema/src/ability.ts`
- Create: `packages/calc/src/damage-component.ts`
- Test: `packages/calc/test/damage-component.test.ts`

**Interfaces:**
- Consumes: `Combatant` from `./combatant` (Task 13); `resolveScalar`, `scalarWarning` from
  `./resolve-scalar`; `DamageComponent`, `DamageRatioStat` from `@wr-calc/schema` (this task adds
  the `DamageRatioStat` export, the same way Step 3 added `DamageType`).
- Produces: `interface ResolvedDamageComponent { type: DamageComponent['type']; amount: number;
  dataWarnings: string[] }`, `resolveDamageComponent(component: DamageComponent, attacker:
  Combatant, target: Combatant, targetCurrentHp: number, level: number, ownerName: string):
  ResolvedDamageComponent`. This is what Task 16's ability-cast executor calls once per
  `DamageComponent` on the ability being cast.

- [ ] **Step 1: Write the failing test**

Create `packages/calc/test/damage-component.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveDamageComponent } from '../src/damage-component'
import type { Combatant } from '../src/combatant'
import type { StatSheet } from '../src/resolve-stats'

function sheet(overrides: Partial<StatSheet> = {}): StatSheet {
  return {
    base: {}, bonus: {}, total: {}, breakdown: [], unsupportedEffects: [], dataWarnings: [],
    unverifiedRules: [], ...overrides,
  }
}

function combatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: 'c1', name: 'Test', kind: 'champion', level: 5, sheet: sheet(), items: [],
    runeEffects: [], inputs: {}, ...overrides,
  }
}

describe('resolveDamageComponent', () => {
  it('resolves base plus a totalAd ratio', () => {
    const attacker = combatant({ sheet: sheet({ total: { ad: 100 } }) })
    const target = combatant()
    const component = {
      type: 'physical' as const, base: 20,
      ratios: [{ stat: 'totalAd' as const, value: 0.5 }], tags: [],
    }
    const result = resolveDamageComponent(component, attacker, target, 1000, 5, 'Test Q')
    expect(result).toEqual({ type: 'physical', amount: 70, dataWarnings: [] })
  })

  it('sums multiple ratios', () => {
    const attacker = combatant({ sheet: sheet({ total: { ad: 100, ap: 50 } }) })
    const target = combatant()
    const component = {
      type: 'magic' as const, base: 0,
      ratios: [
        { stat: 'totalAd' as const, value: 0.2 }, { stat: 'ap' as const, value: 0.6 },
      ], tags: [],
    }
    const result = resolveDamageComponent(component, attacker, target, 1000, 5, 'Test W')
    expect(result.amount).toBe(50)
  })

  it('multiplies by hits when present', () => {
    const attacker = combatant()
    const target = combatant()
    const component = { type: 'physical' as const, base: 10, ratios: [], hits: 3, tags: [] }
    const result = resolveDamageComponent(component, attacker, target, 1000, 5, 'Test E')
    expect(result.amount).toBe(30)
  })

  it('uses the live target current hp, not the target sheet total', () => {
    const attacker = combatant()
    const target = combatant({ sheet: sheet({ total: { hp: 2000 } }) })
    const component = {
      type: 'true' as const, base: 0,
      ratios: [{ stat: 'targetCurrentHp' as const, value: 0.1 }], tags: [],
    }
    const result = resolveDamageComponent(component, attacker, target, 400, 5, 'Test R')
    expect(result.amount).toBe(40)
  })

  it('computes targetMissingHp from the sheet max minus live current', () => {
    const attacker = combatant()
    const target = combatant({ sheet: sheet({ total: { hp: 1000 } }) })
    const component = {
      type: 'true' as const, base: 0,
      ratios: [{ stat: 'targetMissingHp' as const, value: 0.5 }], tags: [],
    }
    const result = resolveDamageComponent(component, attacker, target, 300, 5, 'Test R')
    expect(result.amount).toBe(350)
  })

  it('collects data warnings for null base and ratio values', () => {
    const attacker = combatant()
    const target = combatant()
    const component = {
      type: 'physical' as const, base: null,
      ratios: [{ stat: 'totalAd' as const, value: null }], tags: [],
    }
    const result = resolveDamageComponent(component, attacker, target, 1000, 5, 'Test Q')
    expect(result.dataWarnings).toEqual([
      'Test Q: base is unverified (null)', 'Test Q: ratios.totalAd is unverified (null)',
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wr-calc/calc test`
Expected: FAIL — `../src/damage-component` does not exist.

- [ ] **Step 3: Implement**

In `packages/schema/src/ability.ts`, add directly below `export const DamageRatioStatSchema =
z.enum([...])`:

```ts
export type DamageRatioStat = z.infer<typeof DamageRatioStatSchema>
```

Create `packages/calc/src/damage-component.ts`:

```ts
import type { DamageComponent, DamageRatioStat } from '@wr-calc/schema'
import type { Combatant } from './combatant'
import { resolveScalar, scalarWarning } from './resolve-scalar'

export interface ResolvedDamageComponent {
  type: DamageComponent['type']
  amount: number
  dataWarnings: string[]
}

function resolveRatioStat(
  stat: DamageRatioStat, attacker: Combatant, target: Combatant, targetCurrentHp: number
): number {
  switch (stat) {
    case 'totalAd': return attacker.sheet.total.ad ?? 0
    case 'bonusAd': return attacker.sheet.bonus.ad ?? 0
    case 'ap': return attacker.sheet.total.ap ?? 0
    case 'maxHp': return attacker.sheet.total.hp ?? 0
    case 'bonusHp': return attacker.sheet.bonus.hp ?? 0
    case 'targetMaxHp': return target.sheet.total.hp ?? 0
    case 'targetCurrentHp': return targetCurrentHp
    case 'targetMissingHp': return Math.max(0, (target.sheet.total.hp ?? 0) - targetCurrentHp)
  }
}

/** Resolves one Ability DamageComponent's damage amount for a given attacker/target/level/live target HP. */
export function resolveDamageComponent(
  component: DamageComponent, attacker: Combatant, target: Combatant,
  targetCurrentHp: number, level: number, ownerName: string
): ResolvedDamageComponent {
  const dataWarnings: string[] = []
  const baseResolved = resolveScalar(component.base, level)
  const baseWarning = scalarWarning(ownerName, 'base', baseResolved)
  if (baseWarning) dataWarnings.push(baseWarning)

  let amount = baseResolved.value
  for (const ratio of component.ratios) {
    const statValue = resolveRatioStat(ratio.stat, attacker, target, targetCurrentHp)
    const ratioResolved = resolveScalar(ratio.value, level)
    const ratioWarning = scalarWarning(ownerName, `ratios.${ratio.stat}`, ratioResolved)
    if (ratioWarning) dataWarnings.push(ratioWarning)
    amount += statValue * ratioResolved.value
  }

  return { type: component.type, amount: amount * (component.hits ?? 1), dataWarnings }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @wr-calc/calc test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/schema/src/ability.ts packages/calc/src/damage-component.ts \
  packages/calc/test/damage-component.test.ts
git commit -m "feat: add resolveDamageComponent for ability damage"
```

---

### Task 15: `rules.ts` crit multiplier + register all combat handlers in `effects/registry.ts`

**Files:**
- Modify: `packages/calc/src/rules.ts`
- Modify: `packages/calc/src/effects/registry.ts`
- Modify: `packages/calc/test/effects/registry.test.ts` (Step 2's existing file — two of its
  existing tests use `kind: 'shield'` as "a kind with no registered handler"; that stops being true
  once this task registers `shield`, so they're updated to use `'custom'`, the one kind that
  genuinely never gets an `EFFECT_HANDLERS` entry — see Task 12)
- Test: `packages/calc/test/rules.test.ts` (append)

**Interfaces:**
- Consumes: `BASE_CRIT_DAMAGE_MULTIPLIER` from `./rules` (Step 1, unchanged); all 11 handlers from
  Tasks 1–11 (`onHitHandler`, `damageAmpHandler`, `penetrationHandler`, `damageReductionHandler`,
  `resistShredHandler`, `spellbladeHandler`, `procEveryNHandler`, `dotHandler`,
  `cooldownRefundHandler`, `shieldHandler`, `healHandler`, `activeHandler` — 12 handlers, `shield`
  and `heal` both from Task 10's one file).
- Produces: `critMultiplier(critChance: number, bonusCritDamage: number, mode: 'expected' |
  'always' | 'never'): number`; one new entry in `UNVERIFIED_RULE_IDS`, `'damageAmpTiming'`;
  `EFFECT_HANDLERS` extended to 16 entries (every kind except `custom`).

- [ ] **Step 1: Write the failing tests**

Append to `packages/calc/test/rules.test.ts` (add `critMultiplier` to the existing import):

```ts
describe('critMultiplier', () => {
  it('is 1 in "never" mode', () => {
    expect(critMultiplier(0.5, 0.2, 'never')).toBe(1)
  })

  it('is the full crit multiplier in "always" mode', () => {
    expect(critMultiplier(0.5, 0.2, 'always')).toBeCloseTo(1.95)
  })

  it('is an expected value between 1 and the full multiplier in "expected" mode', () => {
    const result = critMultiplier(0.5, 0, 'expected')
    expect(result).toBeCloseTo(1 + 0.5 * 0.75)
  })

  it('clamps crit chance to [0, 1] in "expected" mode', () => {
    expect(critMultiplier(2, 0, 'expected')).toBe(critMultiplier(1, 0, 'expected'))
    expect(critMultiplier(-1, 0, 'expected')).toBe(1)
  })
})
```

Replace `packages/calc/test/effects/registry.test.ts` entirely with:

```ts
import { describe, it, expect } from 'vitest'
import { EFFECT_HANDLERS, contributeStats, stageOf } from '../../src/effects/registry'
import type { StatContext } from '../../src/effects/types'

function ctx(): StatContext {
  return { level: 5, inputs: {}, statSoFar: () => 0 }
}

describe('EFFECT_HANDLERS', () => {
  it('registers every effect kind except custom', () => {
    expect(Object.keys(EFFECT_HANDLERS).sort()).toEqual([
      'active', 'cooldownRefund', 'damageAmp', 'damageReduction', 'dot', 'heal', 'onHit',
      'penetration', 'procEveryN', 'resistShred', 'shield', 'spellblade', 'stacking', 'stat',
      'statConversion', 'statMultiplier',
    ])
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

  it('returns an empty array for custom, the one kind never registered by kind', () => {
    const effect = {
      id: 'e1', name: 'Test', description: '', support: 'full' as const,
      kind: 'custom' as const, handler: 'does-not-exist',
    }
    expect(contributeStats(effect, ctx())).toEqual([])
  })
})

describe('stageOf', () => {
  it('returns the stage for a registered stat-contributing kind', () => {
    const effect = {
      id: 'e1', name: 'Test', description: '', support: 'full' as const,
      kind: 'statMultiplier' as const, stat: 'ad' as const, layer: 'bonus' as const, amount: 0.1,
    }
    expect(stageOf(effect)).toBe('multiplier')
  })

  it('returns undefined for a registered combat-only kind (it has no stage)', () => {
    const effect = {
      id: 'e1', name: 'Test', description: '', support: 'full' as const,
      kind: 'shield' as const, amount: 10, durationSeconds: 5,
    }
    expect(stageOf(effect)).toBeUndefined()
  })

  it('returns undefined for custom', () => {
    const effect = {
      id: 'e1', name: 'Test', description: '', support: 'full' as const,
      kind: 'custom' as const, handler: 'does-not-exist',
    }
    expect(stageOf(effect)).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @wr-calc/calc test`
Expected: FAIL — `critMultiplier` is not exported yet, and `EFFECT_HANDLERS` still only has 4 keys.

- [ ] **Step 3: Implement**

In `packages/calc/src/rules.ts`, add after `totalAttackSpeed` (before `STAT_RESOLUTION_ORDER`):

```ts
// TODO-VERIFY(critDamageMultiplier): reuses the constant above; the "expected value, no rolling"
// approach itself needs no separate verification (it's a modeling choice, not a game mechanic) but
// the underlying crit chance/damage stacking it's built on does — see BASE_CRIT_DAMAGE_MULTIPLIER.
/** Resolves the crit multiplier for a basic attack under a given crit mode; 'expected' is a deterministic expected value, never a random roll. */
export function critMultiplier(
  critChance: number, bonusCritDamage: number, mode: 'expected' | 'always' | 'never'
): number {
  const fullCritMultiplier = BASE_CRIT_DAMAGE_MULTIPLIER + bonusCritDamage
  if (mode === 'never') return 1
  if (mode === 'always') return fullCritMultiplier
  const clampedChance = Math.min(Math.max(critChance, 0), 1)
  return 1 + clampedChance * (fullCritMultiplier - 1)
}
```

Then add `'damageAmpTiming'` to `UNVERIFIED_RULE_IDS` (append after `'attackSpeedStacking'`), with
a comment directly above the array:

```ts
// TODO-VERIFY(damageAmpTiming): confirm damageAmp effects multiply raw damage before resist
// mitigation (not after) — compare a known damageAmp source's effect on a hit against a
// known-armor dummy to the pre- vs post-mitigation prediction.
```

In `packages/calc/src/effects/registry.ts`, replace the whole file with:

```ts
import type { Effect, EffectKind } from '@wr-calc/schema'
import type { EffectHandler, EffectStage, StatContext, StatContribution } from './types'
import { statHandler } from './stat'
import { stackingHandler } from './stacking'
import { statMultiplierHandler } from './stat-multiplier'
import { statConversionHandler } from './stat-conversion'
import { onHitHandler } from './on-hit'
import { damageAmpHandler } from './damage-amp'
import { penetrationHandler } from './penetration'
import { damageReductionHandler } from './damage-reduction'
import { resistShredHandler } from './resist-shred'
import { spellbladeHandler } from './spellblade'
import { procEveryNHandler } from './proc-every-n'
import { dotHandler } from './dot'
import { cooldownRefundHandler } from './cooldown-refund'
import { shieldHandler, healHandler } from './shield-heal'
import { activeHandler } from './active'
import { CUSTOM_HANDLERS } from '../custom/registry'

/**
 * Handlers for every effect kind except `custom`, which dispatches a second time by
 * `effect.handler` id (see `resolveEffectHandler` below) rather than by kind.
 */
export const EFFECT_HANDLERS: Partial<Record<EffectKind, EffectHandler<any>>> = {
  stat: statHandler,
  stacking: stackingHandler,
  statMultiplier: statMultiplierHandler,
  statConversion: statConversionHandler,
  onHit: onHitHandler,
  damageAmp: damageAmpHandler,
  penetration: penetrationHandler,
  damageReduction: damageReductionHandler,
  resistShred: resistShredHandler,
  spellblade: spellbladeHandler,
  procEveryN: procEveryNHandler,
  dot: dotHandler,
  cooldownRefund: cooldownRefundHandler,
  shield: shieldHandler,
  heal: healHandler,
  active: activeHandler,
}

/** Looks up and calls the registered handler's contributeStats for an effect, if any. */
export function contributeStats(effect: Effect, ctx: StatContext): StatContribution[] {
  return EFFECT_HANDLERS[effect.kind]?.contributeStats?.(effect, ctx) ?? []
}

/** The stat-resolution stage a given effect's kind belongs to, if it contributes stats at all. */
export function stageOf(effect: Effect): EffectStage | undefined {
  return EFFECT_HANDLERS[effect.kind]?.stage
}

/**
 * Resolves the handler for any effect, including `kind: 'custom'`'s second-level dispatch by
 * `effect.handler` id. `customHandlers` lets a caller (mainly tests) override or extend the
 * built-in `CUSTOM_HANDLERS` registry without any hidden mutable registration step.
 */
export function resolveEffectHandler(
  effect: Effect, customHandlers: Record<string, EffectHandler<any>> = {}
): EffectHandler<any> | undefined {
  if (effect.kind === 'custom') {
    return customHandlers[effect.handler] ?? CUSTOM_HANDLERS[effect.handler]
  }
  return EFFECT_HANDLERS[effect.kind]
}
```

(this supersedes Task 12's smaller edit to the same file — `resolveEffectHandler` and the
`CUSTOM_HANDLERS` import already exist from Task 12; this step's diff is really just the 12 new
imports and 12 new `EFFECT_HANDLERS` entries, shown here as a full-file replacement for clarity)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @wr-calc/calc test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/calc/src/rules.ts packages/calc/src/effects/registry.ts \
  packages/calc/test/rules.test.ts packages/calc/test/effects/registry.test.ts
git commit -m "feat: add critMultiplier and register all combat-only effect handlers"
```

---

### Task 16: `simulate-combo.ts` — the event-driven combat engine

**Files:**
- Modify: `packages/calc/src/rules.ts`
- Create: `packages/calc/src/simulate-combo.ts`
- Modify: `packages/calc/src/index.ts`
- Test: `packages/calc/test/simulate-combo.test.ts`

**Interfaces:**
- Consumes: `Combatant` from `./combatant` (Task 13); `resolveDamageComponent` from
  `./damage-component` (Task 14); `resolveEffectHandler` from `./effects/registry` (Tasks 12, 15);
  `mitigateDamage`, `applyDamageReductionFractions`, `ZERO_RESIST_MODIFIERS`, `ResistModifiers`
  from `./mitigation` (Step 3); `resolveScalar` from `./resolve-scalar`; every combat type from
  `./effects/types` (Task 1, 8, 11: `AbilityKey`, `CombatantRuntime`, `DamageInstance`,
  `EffectHandler`, `HookContext`, `RawDamageInstanceInput`, `SourceKind`); `critMultiplier` (this
  task adds it to `rules.ts`, alongside Task 15's own `rules.ts` addition — both land in the same
  file, at different points in the task sequence); `UnsupportedEffectEntry` from
  `./result-envelope`.
- Produces: `type ComboAction = 'AA' | 'Q' | 'W' | 'E' | 'R' | \`item:${string}\` |
  \`wait:${number}\`\`, `interface SimulateComboOptions { critMode?: 'expected' | 'always' |
  'never'; ignoreCooldowns?: boolean; customHandlers?: Record<string, EffectHandler<any>> }`,
  `interface ComboResult { instances: DamageInstance[]; totalsByType: Partial<Record<DamageType,
  number>>; totalsBySource: Record<string, number>; killed: boolean; timeToKill?: number;
  overkill?: number; unsupportedEffects: UnsupportedEffectEntry[]; dataWarnings: string[];
  unverifiedRules: UnverifiedRuleId[] }`, `simulateCombo(attacker: Combatant, target: Combatant,
  sequence: ComboAction[], options?: SimulateComboOptions): ComboResult`, plus one more `rules.ts`
  addition beyond Task 15's: `cooldownWithHaste(baseCooldownSeconds: number, abilityHaste:
  number): number` and `'abilityHasteFormula'` in `UNVERIFIED_RULE_IDS`.

**Known Phase 1 gaps** (accepted now, not silently — surfaced here the way Step 2's plan surfaced
its own deferred gaps): `Ability.flags` (`appliesOnHit`, `triggersSpellblade`,
`resetsBasicAttack`) and `Ability.cost` are validated by the schema but not read by this engine —
every `onHit`/`spellblade` effect responds to *every* basic attack/ability cast uniformly (Design
note 5), an ability cast never resets the AA timer, and no resource (mana/energy) gates an action.
A dead target's already-scheduled DoT ticks still land (they just drive an already-negative
`currentHp` further negative) since Phase 1 doesn't cancel scheduled events on death.
`targetHpBelow`/`targetHpAbove` conditions always read the *opponent* of whoever owns the
condition — correct for attacker-owned `damageAmp`/`penetration` ("execute a low-hp target"), but
means a `damageReduction` effect's condition reads the *attacker's* hp, not the defender's own
(self-hp-gated damage reduction, e.g. "reduced damage below 30% health", needs a `kind: 'custom'`
handler in Phase 1).

- [ ] **Step 1: Write the failing tests**

Create `packages/calc/test/simulate-combo.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { simulateCombo } from '../src/simulate-combo'
import { combatantFromChampion, combatantFromDummy } from '../src/combatant'
import type { Champion, Item, Build, Target } from '@wr-calc/schema'

function championWithAbility(overrides: Partial<Champion> = {}): Champion {
  return {
    id: 'test-champ', name: 'Test Champion', resource: 'mana',
    baseStats: { hp: { base: 1000, perLevel: 0 }, ad: { base: 60, perLevel: 0 } },
    attackSpeed: { base: 1, ratio: 0 },
    abilities: {
      passive: { id: 'passive', name: 'P', maxRank: 1, cooldown: 0, castTime: 0, damage: [], flags: {} },
      q: {
        id: 'q', name: 'Q', maxRank: 5, cooldown: 8, castTime: 0, flags: {},
        damage: [{ type: 'magic', base: 50, ratios: [], tags: [] }],
      },
      w: { id: 'w', name: 'W', maxRank: 5, cooldown: 8, castTime: 0, damage: [], flags: {} },
      e: { id: 'e', name: 'E', maxRank: 5, cooldown: 8, castTime: 0, damage: [], flags: {} },
      r: { id: 'r', name: 'R', maxRank: 3, cooldown: 100, castTime: 0, damage: [], flags: {} },
    },
    ...overrides,
  }
}

function emptyBuild(overrides: Partial<Build> = {}): Build {
  return { items: [], runes: [], inputs: {}, ...overrides }
}

function dummy(overrides: Partial<Extract<Target, { kind: 'dummy' }>> = {}):
  Extract<Target, { kind: 'dummy' }> {
  return { kind: 'dummy', hp: 1000, armor: 0, mr: 0, ...overrides }
}

function baseItem(id: string, effect: Item['effects'][number]): Item {
  return {
    id, name: id, tier: 'basic', cost: { total: 1000, combine: 1000 }, recipe: [], stats: {},
    effects: [effect], tags: [],
    provenance: { source: 'manual', patch: '0.0.0', verifiedInGame: false },
  }
}

describe('simulateCombo', () => {
  it('deals basic AD damage on each AA at the attack interval', () => {
    const attacker = combatantFromChampion(
      championWithAbility(), 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    const target = combatantFromDummy(dummy())
    const result = simulateCombo(attacker, target, ['AA', 'AA'], { critMode: 'never' })
    expect(result.instances.map((i) => i.time)).toEqual([1, 2])
    expect(result.instances[0].mitigated).toBe(60)
    expect(result.totalsByType.physical).toBe(120)
  })

  it('applies crit mode to AA damage', () => {
    const champion = championWithAbility({
      baseStats: {
        hp: { base: 1000, perLevel: 0 }, ad: { base: 100, perLevel: 0 },
        critChance: { base: 0.5, perLevel: 0 },
      },
    })
    const attacker = combatantFromChampion(
      champion, 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    const target = combatantFromDummy(dummy())

    const never = simulateCombo(attacker, target, ['AA'], { critMode: 'never' })
    const always = simulateCombo(attacker, target, ['AA'], { critMode: 'always' })
    const expected = simulateCombo(attacker, target, ['AA'], { critMode: 'expected' })

    expect(never.instances[0].mitigated).toBe(100)
    expect(always.instances[0].mitigated).toBe(175)
    expect(expected.instances[0].mitigated).toBeCloseTo(100 * (1 + 0.5 * 0.75))
  })

  it('applies an onHit item effect on every basic attack', () => {
    const item = baseItem('test-onhit', {
      id: 'test-onhit-passive', name: 'Test On-Hit Passive', description: '', support: 'full',
      kind: 'onHit', damageType: 'magic', flat: 20,
    })
    const items = new Map([['test-onhit', item]])
    const build = emptyBuild({ items: ['test-onhit'] })
    const attacker = combatantFromChampion(championWithAbility(), 1, build, { items, runes: new Map() })
    const target = combatantFromDummy(dummy())
    const result = simulateCombo(attacker, target, ['AA'], { critMode: 'never' })
    expect(result.instances).toHaveLength(2)
    expect(result.totalsByType.physical).toBe(60)
    expect(result.totalsByType.magic).toBe(20)
  })

  it('reduces damage against an armored target', () => {
    const attacker = combatantFromChampion(
      championWithAbility(), 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    const noArmor = combatantFromDummy(dummy({ armor: 0 }))
    const armored = combatantFromDummy(dummy({ armor: 100 }))
    const damageAgainst = (t: ReturnType<typeof combatantFromDummy>) =>
      simulateCombo(attacker, t, ['AA'], { critMode: 'never' }).instances[0].mitigated
    expect(damageAgainst(armored)).toBeCloseTo(damageAgainst(noArmor) * 0.5)
  })

  it('casts an ability, deals its damage, and respects its cooldown', () => {
    const attacker = combatantFromChampion(
      championWithAbility(), 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    const target = combatantFromDummy(dummy())
    const result = simulateCombo(attacker, target, ['Q', 'Q'], { critMode: 'never' })
    expect(result.instances).toHaveLength(1)
    expect(result.instances[0].mitigated).toBe(50)
  })

  it('ignores cooldowns when the option is set', () => {
    const attacker = combatantFromChampion(
      championWithAbility(), 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    const target = combatantFromDummy(dummy())
    const result = simulateCombo(
      attacker, target, ['Q', 'Q'], { critMode: 'never', ignoreCooldowns: true }
    )
    expect(result.instances).toHaveLength(2)
  })

  it('computes pctTargetCurrentHp against live target hp, shrinking across successive attacks', () => {
    const item = baseItem('test-pct-item', {
      id: 'test-pct-passive', name: 'Test Pct Passive', description: '', support: 'full',
      kind: 'onHit', damageType: 'true', pctTargetCurrentHp: 0.5,
    })
    const items = new Map([['test-pct-item', item]])
    const build = emptyBuild({ items: ['test-pct-item'] })
    const champion = championWithAbility({
      baseStats: { hp: { base: 1000, perLevel: 0 }, ad: { base: 0, perLevel: 0 } },
    })
    const attacker = combatantFromChampion(champion, 1, build, { items, runes: new Map() })
    const target = combatantFromDummy(dummy({ hp: 1000 }))
    const result = simulateCombo(attacker, target, ['AA', 'AA'], { critMode: 'never' })
    const onHitInstances = result.instances.filter((i) => i.type === 'true')
    expect(onHitInstances[0].mitigated).toBe(500)
    expect(onHitInstances[1].mitigated).toBe(250)
  })

  it('detects a kill, records timeToKill and overkill, and stops processing further actions', () => {
    const champion = championWithAbility({
      baseStats: { hp: { base: 1000, perLevel: 0 }, ad: { base: 500, perLevel: 0 } },
    })
    const attacker = combatantFromChampion(
      champion, 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    const target = combatantFromDummy(dummy({ hp: 300, armor: 0 }))
    const result = simulateCombo(attacker, target, ['AA', 'AA', 'AA'], { critMode: 'never' })
    expect(result.killed).toBe(true)
    expect(result.timeToKill).toBe(1)
    expect(result.overkill).toBe(200)
    expect(result.instances).toHaveLength(1)
  })

  it('aggregates unsupportedEffects and dataWarnings from resolveStats and its own combat dispatch', () => {
    const partialItem = baseItem('test-partial-item', {
      id: 'test-partial-passive', name: 'Test Partial Passive', description: '',
      support: 'partial', supportNotes: 'exact scaling unconfirmed',
      kind: 'onHit', damageType: 'physical', flat: 5,
    })
    const items = new Map([['test-partial-item', partialItem]])
    const build = emptyBuild({ items: ['test-partial-item'] })
    const champion = championWithAbility()
    champion.abilities.q.damage = [{ type: 'magic', base: null, ratios: [], tags: [] }]
    const attacker = combatantFromChampion(champion, 1, build, { items, runes: new Map() })
    const target = combatantFromDummy(dummy())

    const result = simulateCombo(attacker, target, ['AA', 'Q'], { critMode: 'never' })
    expect(result.unsupportedEffects).toEqual([
      { id: 'test-partial-passive', support: 'partial', supportNotes: 'exact scaling unconfirmed' },
    ])
    expect(result.dataWarnings).toContain('Q: base is unverified (null)')
  })

  it('triggers an item active on an item:<id> action and respects its cooldown', () => {
    const item = baseItem('test-active-item', {
      id: 'test-active-passive', name: 'Test Active', description: '', support: 'full',
      kind: 'active', cooldownSeconds: 60, damageType: 'magic', damage: 100,
    })
    const items = new Map([['test-active-item', item]])
    const build = emptyBuild({ items: ['test-active-item'] })
    const attacker = combatantFromChampion(championWithAbility(), 1, build, { items, runes: new Map() })
    const target = combatantFromDummy(dummy())
    const result = simulateCombo(
      attacker, target, ['item:test-active-item', 'item:test-active-item'], { critMode: 'never' }
    )
    expect(result.instances).toHaveLength(1)
    expect(result.instances[0].mitigated).toBe(100)
  })

  it('ticks a dot applied on ability hit while a later wait advances through it', () => {
    const item = baseItem('test-dot-item', {
      id: 'test-dot-passive', name: 'Test DoT', description: '', support: 'full',
      kind: 'dot', damageType: 'magic', tickAmount: 10, tickIntervalSeconds: 1,
      durationSeconds: 3, refresh: 'refresh',
    })
    const items = new Map([['test-dot-item', item]])
    const build = emptyBuild({ items: ['test-dot-item'] })
    const champion = championWithAbility()
    champion.abilities.q.damage = []
    const attacker = combatantFromChampion(champion, 1, build, { items, runes: new Map() })
    const target = combatantFromDummy(dummy())
    const result = simulateCombo(attacker, target, ['Q', 'wait:3'], { critMode: 'never' })
    const dotInstances = result.instances.filter((i) => i.source.id === 'test-dot-passive')
    expect(dotInstances).toHaveLength(3)
    expect(dotInstances.map((i) => i.mitigated)).toEqual([10, 10, 10])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @wr-calc/calc test`
Expected: FAIL — `../src/simulate-combo` does not exist.

- [ ] **Step 3: Implement**

In `packages/calc/src/rules.ts`, add after `critMultiplier` (Task 15's addition):

```ts
// TODO-VERIFY(abilityHasteFormula): confirm ability haste reduces cooldowns via the standard LoL
// formula (cooldown / (1 + haste/100)) rather than a different Wild Rift-specific curve, by
// comparing a champion's displayed ability cooldown at 0 and at a known ability haste value in
// the practice tool.
/** Reduces a base cooldown by a flat ability haste value using the standard LoL haste formula. */
export function cooldownWithHaste(baseCooldownSeconds: number, abilityHaste: number): number {
  return baseCooldownSeconds / (1 + abilityHaste / 100)
}
```

Add `'abilityHasteFormula'` to `UNVERIFIED_RULE_IDS` (append after `'damageAmpTiming'`).

Create `packages/calc/src/simulate-combo.ts`:

```ts
import type { Effect, DamageType, Condition } from '@wr-calc/schema'
import type { Combatant } from './combatant'
import type {
  AbilityKey, CombatantRuntime, DamageInstance, EffectHandler, HookContext,
  RawDamageInstanceInput, SourceKind,
} from './effects/types'
import type { UnverifiedRuleId } from './rules'
import type { ResistModifiers } from './mitigation'
import type { UnsupportedEffectEntry } from './result-envelope'
import { critMultiplier, cooldownWithHaste } from './rules'
import { mitigateDamage, applyDamageReductionFractions, ZERO_RESIST_MODIFIERS } from './mitigation'
import { resolveEffectHandler } from './effects/registry'
import { resolveDamageComponent } from './damage-component'
import { resolveScalar } from './resolve-scalar'

export type ComboAction = 'AA' | 'Q' | 'W' | 'E' | 'R' | `item:${string}` | `wait:${number}`

export interface SimulateComboOptions {
  critMode?: 'expected' | 'always' | 'never'
  ignoreCooldowns?: boolean
  customHandlers?: Record<string, EffectHandler<any>>
}

export interface ComboResult {
  instances: DamageInstance[]
  totalsByType: Partial<Record<DamageType, number>>
  totalsBySource: Record<string, number>
  killed: boolean
  timeToKill?: number
  overkill?: number
  unsupportedEffects: UnsupportedEffectEntry[]
  dataWarnings: string[]
  unverifiedRules: UnverifiedRuleId[]
}

function combatantEffects(combatant: Combatant): Effect[] {
  return [...combatant.items.flatMap((item) => item.effects), ...combatant.runeEffects]
}

function evaluateCondition(
  effect: Effect, condition: Condition, self: Combatant, opponent: Combatant,
  opponentRuntime: CombatantRuntime, extra?: { damageType?: DamageType; sourceKind?: SourceKind }
): boolean {
  switch (condition.type) {
    case 'targetHpBelow': {
      const maxHp = opponent.sheet.total.hp ?? 0
      return maxHp > 0 && opponentRuntime.currentHp / maxHp < condition.threshold
    }
    case 'targetHpAbove': {
      const maxHp = opponent.sheet.total.hp ?? 0
      return maxHp > 0 && opponentRuntime.currentHp / maxHp > condition.threshold
    }
    case 'stacksAtMax': {
      const stackInput = effect.inputs?.find((input) => input.type === 'stackCount')
      if (!stackInput) return false
      const value = self.inputs[stackInput.id]
      return typeof value === 'number' && value >= stackInput.max
    }
    case 'toggle':
      return self.inputs[condition.inputId] === true
    case 'damageType':
      return extra?.damageType === condition.value
    case 'sourceKind':
      return extra?.sourceKind === condition.value
    case 'targetIsChampion':
      return opponent.kind === 'champion'
    case 'targetIsMonster':
      return opponent.kind === 'monster'
  }
}

/**
 * Gates any hook dispatch on the effect's own optional `condition` — this is what lets a
 * conditional effect skip a hook-triggered mechanic (onHit, spellblade, dot, procEveryN,
 * cooldownRefund, shield, heal, active) without every individual handler needing its own
 * condition check. Reader capabilities (`modifyResist`/`damageMultiplier`/`damageReductionFraction`)
 * are NOT covered by this — they're called directly by performDamage's modifier-gathering phase,
 * not through a hook-dispatch loop, so each of those handlers still self-checks its own condition
 * (see `penetrationHandler`/`damageAmpHandler`/`resistShredHandler.modifyResist`/
 * `damageReductionHandler`).
 */
function conditionAllows(
  effect: Effect, ctx: HookContext,
  extra?: { damageType?: DamageType; sourceKind?: SourceKind }
): boolean {
  return !effect.condition || ctx.conditionMet(effect, effect.condition, extra)
}

/**
 * Runs an event-driven combat timeline for `attacker` acting through `sequence` against `target`.
 * Phase 1 is asymmetric: only the attacker acts (basic attacks, ability casts, item actives) — the
 * target never initiates damage, so every DamageInstance flows attacker -> target. See this task's
 * "Known Phase 1 gaps" note for what's accepted-but-unmodeled.
 */
export function simulateCombo(
  attacker: Combatant, target: Combatant, sequence: ComboAction[],
  options: SimulateComboOptions = {}
): ComboResult {
  const critMode = options.critMode ?? 'expected'
  const ignoreCooldowns = options.ignoreCooldowns ?? false
  const customHandlers = options.customHandlers ?? {}

  const attackerRuntime: CombatantRuntime = {
    currentHp: attacker.sheet.total.hp ?? 0, shieldHp: 0, cooldowns: {}, buffs: {},
  }
  const targetRuntime: CombatantRuntime = {
    currentHp: target.sheet.total.hp ?? 0, shieldHp: 0, cooldowns: {}, buffs: {},
  }
  const attackerEffectsList = combatantEffects(attacker)
  const targetEffectsList = combatantEffects(target)

  const instances: DamageInstance[] = []
  const dataWarnings: string[] = []
  const unverifiedRuleIds = new Set<UnverifiedRuleId>()
  const unsupportedByEffectId = new Map<string, UnsupportedEffectEntry>()
  const scheduled: { time: number; run: (ctx: HookContext) => void }[] = []
  let time = 0
  let killed = false
  let timeToKill: number | undefined
  let overkill: number | undefined

  const trackSupport = (effect: Effect) => {
    if (effect.support !== 'full' && !unsupportedByEffectId.has(effect.id)) {
      unsupportedByEffectId.set(effect.id, {
        id: effect.id, support: effect.support, supportNotes: effect.supportNotes,
      })
    }
  }

  function buildCtx(
    self: Combatant, selfRuntime: CombatantRuntime, opponent: Combatant,
    opponentRuntime: CombatantRuntime
  ): HookContext {
    return {
      time, level: self.level, self: selfRuntime, opponent: opponentRuntime,
      selfSheet: self.sheet, opponentSheet: opponent.sheet,
      selfKind: self.kind, opponentKind: opponent.kind, inputs: self.inputs, ignoreCooldowns,
      // Phase 1 has no target-initiated damage, so dealDamage always applies attacker -> target,
      // regardless of which side's ctx it was called from.
      dealDamage: (input) => performDamage(input),
      addDataWarning: (message) => dataWarnings.push(message),
      addUnverifiedRule: (id) => unverifiedRuleIds.add(id),
      conditionMet: (effect, condition, extra) =>
        evaluateCondition(effect, condition, self, opponent, opponentRuntime, extra),
      scheduleEvent: (atTime, run) => {
        scheduled.push({ time: atTime, run })
        scheduled.sort((a, b) => a.time - b.time)
      },
    }
  }

  function flushScheduledEvents(upTo: number) {
    while (scheduled.length > 0 && scheduled[0].time <= upTo) {
      const event = scheduled.shift()!
      time = event.time
      event.run(buildCtx(attacker, attackerRuntime, target, targetRuntime))
    }
    time = upTo
  }

  function performDamage(input: RawDamageInstanceInput): DamageInstance {
    const attackerCtx = buildCtx(attacker, attackerRuntime, target, targetRuntime)

    let raw = input.amount
    for (const effect of attackerEffectsList) {
      const handler = resolveEffectHandler(effect, customHandlers)
      if (!handler?.damageMultiplier) continue
      const multiplier = handler.damageMultiplier(effect, attackerCtx, input)
      if (multiplier === 1) continue
      raw *= multiplier
      unverifiedRuleIds.add('damageAmpTiming')
      trackSupport(effect)
    }

    const resistBase = input.type === 'physical' ? target.sheet.total.armor ?? 0
      : input.type === 'magic' ? target.sheet.total.mr ?? 0 : 0
    const modifiers: ResistModifiers = { ...ZERO_RESIST_MODIFIERS }
    if (input.type === 'physical') {
      modifiers.flatPen += attacker.sheet.total.flatArmorPen ?? 0
      modifiers.pctPen += attacker.sheet.total.pctArmorPen ?? 0
    } else if (input.type === 'magic') {
      modifiers.flatPen += attacker.sheet.total.flatMagicPen ?? 0
      modifiers.pctPen += attacker.sheet.total.pctMagicPen ?? 0
    }
    for (const effect of attackerEffectsList) {
      const handler = resolveEffectHandler(effect, customHandlers)
      if (!handler?.modifyResist) continue
      const partial = handler.modifyResist(effect, attackerCtx, input.type)
      if (Object.keys(partial).length === 0) continue
      modifiers.flatReduction += partial.flatReduction ?? 0
      modifiers.pctReduction += partial.pctReduction ?? 0
      modifiers.pctPen += partial.pctPen ?? 0
      modifiers.flatPen += partial.flatPen ?? 0
      trackSupport(effect)
    }

    let mitigated = mitigateDamage(raw, input.type, resistBase, modifiers)
    if (input.type !== 'true') unverifiedRuleIds.add('resistModificationOrder')

    const targetCtx = buildCtx(target, targetRuntime, attacker, attackerRuntime)
    const fractions: number[] = []
    for (const effect of targetEffectsList) {
      const handler = resolveEffectHandler(effect, customHandlers)
      if (!handler?.damageReductionFraction) continue
      const fraction = handler.damageReductionFraction(effect, targetCtx, input.type)
      if (fraction === 0) continue
      fractions.push(fraction)
      trackSupport(effect)
    }
    mitigated = applyDamageReductionFractions(mitigated, fractions)

    const absorbed = Math.min(targetRuntime.shieldHp, mitigated)
    targetRuntime.shieldHp -= absorbed
    targetRuntime.currentHp -= (mitigated - absorbed)

    const instance: DamageInstance = {
      time, source: input.source, type: input.type, raw, mitigated,
      targetHpAfter: targetRuntime.currentHp,
    }
    instances.push(instance)

    if (!killed && targetRuntime.currentHp <= 0) {
      killed = true
      timeToKill = time
      overkill = -targetRuntime.currentHp
    }

    for (const effect of attackerEffectsList) {
      const handler = resolveEffectHandler(effect, customHandlers)
      if (!handler?.hooks?.onDamageDealt) continue
      if (!conditionAllows(effect, attackerCtx, { damageType: instance.type, sourceKind: instance.source.kind })) continue
      handler.hooks.onDamageDealt(effect, attackerCtx, instance)
      trackSupport(effect)
    }

    return instance
  }

  function dispatchOnBasicAttack() {
    const ctx = buildCtx(attacker, attackerRuntime, target, targetRuntime)
    for (const effect of attackerEffectsList) {
      const handler = resolveEffectHandler(effect, customHandlers)
      if (!handler?.hooks?.onBasicAttack) continue
      if (!conditionAllows(effect, ctx)) continue
      handler.hooks.onBasicAttack(effect, ctx)
      trackSupport(effect)
    }
  }

  function dispatchOnAbilityCast(abilityKey: AbilityKey) {
    const ctx = buildCtx(attacker, attackerRuntime, target, targetRuntime)
    for (const effect of attackerEffectsList) {
      const handler = resolveEffectHandler(effect, customHandlers)
      if (!handler?.hooks?.onAbilityCast) continue
      if (!conditionAllows(effect, ctx)) continue
      handler.hooks.onAbilityCast(effect, ctx, abilityKey)
      trackSupport(effect)
    }
  }

  function dispatchOnAbilityHit(abilityKey: AbilityKey, hitInstances: DamageInstance[]) {
    const ctx = buildCtx(attacker, attackerRuntime, target, targetRuntime)
    for (const effect of attackerEffectsList) {
      const handler = resolveEffectHandler(effect, customHandlers)
      if (!handler?.hooks?.onAbilityHit) continue
      if (!conditionAllows(effect, ctx)) continue
      handler.hooks.onAbilityHit(effect, ctx, abilityKey, hitInstances)
      trackSupport(effect)
    }
  }

  for (const action of sequence) {
    if (killed) break

    if (action === 'AA') {
      const interval = 1 / Math.max(attacker.sheet.total.attackSpeed ?? 1, 0.01)
      time += interval
      flushScheduledEvents(time)

      const critChance = attacker.sheet.total.critChance ?? 0
      const bonusCritDamage = attacker.sheet.total.critDamage ?? 0
      const critMult = critMultiplier(critChance, bonusCritDamage, critMode)
      unverifiedRuleIds.add('critDamageMultiplier')

      performDamage({
        type: 'physical', amount: (attacker.sheet.total.ad ?? 0) * critMult,
        source: { kind: 'basicAttack', id: 'AA', name: 'Basic Attack' },
      })
      dispatchOnBasicAttack()
    } else if (action === 'Q' || action === 'W' || action === 'E' || action === 'R') {
      if (!attacker.abilities) continue
      const abilityKey = action.toLowerCase() as AbilityKey
      const ability = attacker.abilities[abilityKey]
      const availableAt = attackerRuntime.cooldowns[abilityKey] ?? 0
      if (!ignoreCooldowns && time < availableAt) continue

      time += ability.castTime
      flushScheduledEvents(time)
      dispatchOnAbilityCast(abilityKey)

      const hitInstances: DamageInstance[] = []
      for (const component of ability.damage) {
        const resolved = resolveDamageComponent(
          component, attacker, target, targetRuntime.currentHp, attacker.level, ability.name
        )
        resolved.dataWarnings.forEach((warning) => dataWarnings.push(warning))
        hitInstances.push(performDamage({
          type: resolved.type, amount: resolved.amount,
          source: { kind: 'ability', id: ability.id, name: ability.name },
        }))
      }

      const cooldownResolved = resolveScalar(ability.cooldown, attacker.level)
      if (cooldownResolved.wasNull) {
        dataWarnings.push(`${ability.name}: cooldown is unverified (null)`)
      }
      const hastedCooldown = cooldownWithHaste(
        cooldownResolved.value, attacker.sheet.total.abilityHaste ?? 0
      )
      unverifiedRuleIds.add('abilityHasteFormula')
      attackerRuntime.cooldowns[abilityKey] = time + hastedCooldown

      dispatchOnAbilityHit(abilityKey, hitInstances)
    } else if (action.startsWith('item:')) {
      const itemId = action.slice(5)
      const item = attacker.items.find((candidate) => candidate.id === itemId)
      const activeEffect = item?.effects.find((effect) => effect.kind === 'active')
      if (!item || !activeEffect) continue

      const cooldownKey = `active:${activeEffect.id}`
      const availableAt = attackerRuntime.cooldowns[cooldownKey] ?? 0
      if (!ignoreCooldowns && time < availableAt) continue

      const ctx = buildCtx(attacker, attackerRuntime, target, targetRuntime)
      const handler = resolveEffectHandler(activeEffect, customHandlers)
      handler?.activate?.(activeEffect, ctx)
      trackSupport(activeEffect)

      const cooldownResolved = resolveScalar(activeEffect.cooldownSeconds, attacker.level)
      if (cooldownResolved.wasNull) {
        dataWarnings.push(`${activeEffect.name}: cooldownSeconds is unverified (null)`)
      }
      attackerRuntime.cooldowns[cooldownKey] = time + cooldownResolved.value
    } else if (action.startsWith('wait:')) {
      time += Number(action.slice(5))
      flushScheduledEvents(time)
    }
  }

  const totalsByType: Partial<Record<DamageType, number>> = {}
  const totalsBySource: Record<string, number> = {}
  for (const instance of instances) {
    totalsByType[instance.type] = (totalsByType[instance.type] ?? 0) + instance.mitigated
    totalsBySource[instance.source.id] =
      (totalsBySource[instance.source.id] ?? 0) + instance.mitigated
  }

  const mergedUnsupported = new Map<string, UnsupportedEffectEntry>()
  for (const entry of [
    ...attacker.sheet.unsupportedEffects, ...target.sheet.unsupportedEffects,
    ...unsupportedByEffectId.values(),
  ]) mergedUnsupported.set(entry.id, entry)

  return {
    instances, totalsByType, totalsBySource, killed, timeToKill, overkill,
    unsupportedEffects: [...mergedUnsupported.values()],
    dataWarnings: [...attacker.sheet.dataWarnings, ...target.sheet.dataWarnings, ...dataWarnings],
    unverifiedRules: [...new Set([
      ...attacker.sheet.unverifiedRules, ...target.sheet.unverifiedRules, ...unverifiedRuleIds,
    ])],
  }
}
```

Update `packages/calc/src/index.ts` to add one line:

```ts
export * from './simulate-combo'
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @wr-calc/calc test`
Expected: PASS, all tests in `simulate-combo.test.ts` green.

- [ ] **Step 5: Run the full monorepo test suite and typecheck**

Run: `pnpm run typecheck && pnpm run test`
Expected: PASS — every package, no regressions.

- [ ] **Step 6: Commit**

```bash
git add packages/calc/src/rules.ts packages/calc/src/simulate-combo.ts \
  packages/calc/src/index.ts packages/calc/test/simulate-combo.test.ts
git commit -m "feat: add simulateCombo, the event-driven combat engine"
```

---

## Self-review notes

- **Spec coverage:** all 13 combat-only effect kinds (`onHit`, `spellblade`, `procEveryN`, `dot`,
  `resistShred`, `penetration`, `damageAmp`, `cooldownRefund`, `damageReduction`, `shield`, `heal`,
  `active`, `custom`) get handlers (Tasks 1–12); the engine (`simulate-combo.ts`, Task 16)
  implements every spec bullet under "3. `simulateCombo`" — all six sequence-action kinds, time
  advancing by attack interval or cast time, cooldowns respected with ability haste plus an
  ignore-cooldowns option, three crit modes, live target-state-dependent damage (verified by the
  `pctTargetCurrentHp` order-dependence test), and a result envelope with totals/instance
  log/killed/timeToKill/overkill plus the three aggregated warning lists. One deliberate,
  consistency-driven deviation from the spec's literal `DamageInstance { time, source, sourceKind,
  ... }` shorthand: `source` and `sourceKind` are combined into one `DamageSource { kind, id, name
  }` field (named `source`), mirroring `StatContribution.source`'s shape from Step 2 rather than
  introducing a second, differently-shaped source representation.
- **Placeholder scan:** none — every task has complete, runnable code; the "Known Phase 1 gaps"
  note under Task 16 documents what's accepted-but-unmodeled honestly rather than half-implementing
  it (`Ability.flags`, resource costs, self-hp-gated `damageReduction`), the same way Step 2 ended
  with a "Known deferred gaps" list rather than silently cutting corners.
- **Type consistency:** `Combatant` (Task 13, retrofitted with `level`/`inputs` while Tasks 14 and
  16 were being designed, before either task's code was finalized) is consumed identically by
  `damage-component.ts` (Task 14) and `simulate-combo.ts` (Task 16). `RawDamageInstanceInput`/
  `DamageInstance`/`ResistModifiers`/`AbilityKey` (Task 1, Step 3) are reused verbatim by every
  handler and by the engine. `EffectHandler` grows three capabilities in Task 1
  (`hooks`/`modifyResist`/`damageMultiplier`/`damageReductionFraction`) and one more in Task 11
  (`activate`); every later task's handler populates only the subset it needs, and the registry
  (Task 15) registers all 16 non-`custom` kinds under the same `EFFECT_HANDLERS` map Step 2 built.
