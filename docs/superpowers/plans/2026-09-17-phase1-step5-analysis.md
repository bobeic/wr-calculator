# Phase 1 / Step 5 — Analysis Layer (`sustainedDps` / `effectiveHp` / `compareBuilds`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `packages/calc/src/analysis/{effective-hp,sustained-dps,compare-builds}.ts` —
the build-comparison layer that turns `resolveStats`/`simulateCombo` output into the
gold/burst/dps/ttk/ehp series a crossover chart plots — plus the `<5ms` performance check the spec
requires for `compareBuilds`.

**Architecture:** Three small, independently-testable functions under `packages/calc/src/analysis/`,
each calling straight into Step 2-4's existing engine (`resolveStats` via `combatantFromChampion`,
`simulateCombo`) rather than reimplementing any combat math. `effectiveHp` is a pure stat-sheet
transform. `sustainedDps` drives `simulateCombo` with a generously-sized synthetic action sequence
and reads the resulting instance log rather than trying to predict cooldown state up front.
`compareBuilds` is the orchestrator: for each of two builds, it resolves one `Combatant` per
"completed item" breakpoint (cached in a call-scoped `Map`, per the spec), and calls `sustainedDps`
+ one `simulateCombo` burst run per breakpoint to fill in the series.

**Tech Stack:** TypeScript strict, Vitest, `@wr-calc/schema`, `packages/calc`'s Step 2-4 output
(`resolveStats`, `combatantFromChampion`/`combatantFromDummy`, `simulateCombo`, `mitigationMultiplier`).

**Spec:** `docs/superpowers/specs/2026-09-10-phase1-engine-schema-fixtures-design.md`, section
"4. Analysis"; `docs/decisions/2026-09-11-simulate-combo-known-phase1-gaps.md` (item 1, the
`timeToKill` bias, is resolved as of `36c347c` — this plan's `ttk` field is unbiased); and
`docs/decisions/2026-09-10-simulate-combo-combatant-signature.md`, which already names
`compareBuilds` as a future caller of `combatantFromChampion`/`combatantFromDummy`.

## Global Constraints

- TypeScript strict mode; every new file needs full type annotations on exported functions.
- Percentages are fractions (0.25 = 25%).
- The engine is pure: deterministic (no `Math.random`, no I/O, no hidden module-level state).
  `compareBuilds`'s cache is a `Map` created fresh inside each call — never module-level.
- No champion or item names in engine code — only ids/kinds drive logic.
- Commit after each task.

---

## Design notes (read before starting; these resolve ambiguities the spec doc leaves open — no
further sign-off needed, per this project's established autonomous-SDD-ruling practice, but every
task builds on the same model)

1. **`goldEfficiency` is out of scope for this step**, confirmed with the user: `packages/data` is
   still an empty stub (Step 6 hasn't run), and `goldEfficiency` isn't a dependency of
   `compareBuilds`'s output (`gold` there is cumulative item *cost*, not efficiency). Pick it up in
   Step 6 once real basic-item data exists.
2. **`compareBuilds`'s `target` parameter is a pre-resolved `Combatant`**, not a raw `Target` —
   consistent with `simulateCombo`'s own signature and the ADR that already names `compareBuilds`
   as a future `combatantFromChampion`/`combatantFromDummy` caller. Callers build it themselves,
   same as every `simulateCombo` test does today.
3. **`effectiveHp` reuses `mitigationMultiplier(resist)` from `mitigation.ts`** (`ehp = hp /
   mitigationMultiplier(resist)`) rather than re-deriving the resist formula — `mitigationMultiplier`
   already takes a bare resist value with no modifiers, which is exactly what a static stat sheet
   (no attacker-specific penetration/reduction) needs.
4. **`sustainedDps` never predicts `simulateCombo`'s internal cooldown state.** It builds a
   generously-sized action sequence (`priority` abilities attempted before a guaranteed `'AA'`, per
   "block", repeated enough times that the guaranteed AAs alone cover `seconds` even if every
   ability attempt is blocked — see Task 2), runs it once through `simulateCombo` with cooldowns
   respected, then sums only `DamageInstance`s with `time < seconds` (strict — see Task 2's inline
   comment for why `<` and not `<=`) and divides by `seconds`. A blocked ability action is a free
   no-op in `simulateCombo` (`continue`s without consuming time), so over-provisioning the sequence
   costs nothing.
5. **`compareBuilds` breakpoints step only `build.items`** (one breakpoint per completed generic
   item slot). `boots`/`enchant` are treated as already owned from breakpoint 1 onward — their cost
   is added once, at the first breakpoint (after `combatantFromChampion` has validated them), not
   staged incrementally. The spec's "optionally with next-item components" partial-in-progress
   breakpoint is cut from v1
   (YAGNI) and recorded as a documented gap in Task 6's ADR, not silently dropped.
6. **The combatant cache is one `Map<string, Combatant>` shared across both `a` and `b`**, keyed by
   `` `${championId}|${level}|${itemIds.join(',')}|${runeIds.join(',')}|${sortedInputsString}` ``
   where `itemIds` is the *full* resolved set (`build.items` plus `boots`/`enchant`, exactly what
   `combatantFromChampion` validates) — not just the staged generic items, otherwise two sides
   sharing generic items but different boots/enchant would wrongly collide. It helps exactly when
   both builds share a common item prefix (e.g. both rush the same mythic) — verified by a dedicated
   test in Task 4, not assumed.
7. **Per breakpoint:** `burst`/`ttk` come from one `simulateCombo(combatant, target,
   scenario.burstSequence, { critMode: 'expected', ignoreCooldowns: true })` call (`burst` = sum of
   `totalsByType`, `ttk` = `result.timeToKill`, possibly `undefined`); `dps` from
   `sustainedDps(combatant, target, scenario.durationSeconds, scenario.priority)`; `ehp` from
   `effectiveHp(combatant.sheet)` — the *build's own* survivability, not the target's.

---

### Task 1: `effectiveHp`

**Files:**
- Create: `packages/calc/src/analysis/effective-hp.ts`
- Modify: `packages/calc/src/index.ts` (add export)
- Test: `packages/calc/test/analysis/effective-hp.test.ts`

**Interfaces:**
- Consumes: `StatSheet` (`packages/calc/src/resolve-stats.ts`), `mitigationMultiplier`
  (`packages/calc/src/mitigation.ts`) — both already implemented.
- Produces: `effectiveHp(sheet: StatSheet): EffectiveHp` and `export interface EffectiveHp {
  physical: number; magic: number }`, consumed by Task 3's `compareBuilds`.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/calc/test/analysis/effective-hp.test.ts
import { describe, it, expect } from 'vitest'
import { effectiveHp } from '../../src/analysis/effective-hp'
import type { StatSheet } from '../../src/resolve-stats'

function sheetWith(total: Partial<StatSheet['total']>): StatSheet {
  return {
    base: {}, bonus: {}, total, breakdown: [],
    unsupportedEffects: [], dataWarnings: [], unverifiedRules: [],
  }
}

describe('effectiveHp', () => {
  it('returns hp unchanged against zero resist', () => {
    const result = effectiveHp(sheetWith({ hp: 1000, armor: 0, mr: 0 }))
    expect(result).toEqual({ physical: 1000, magic: 1000 })
  })

  it('doubles effective hp at 100 armor/mr', () => {
    const result = effectiveHp(sheetWith({ hp: 1000, armor: 100, mr: 100 }))
    expect(result.physical).toBeCloseTo(2000)
    expect(result.magic).toBeCloseTo(2000)
  })

  it('computes physical and magic independently from different resists', () => {
    const result = effectiveHp(sheetWith({ hp: 1000, armor: 100, mr: 0 }))
    expect(result.physical).toBeCloseTo(2000)
    expect(result.magic).toBeCloseTo(1000)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/calc/test/analysis/effective-hp.test.ts`
Expected: FAIL — cannot find module `../../src/analysis/effective-hp`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/calc/src/analysis/effective-hp.ts
import type { StatSheet } from '../resolve-stats'
import { mitigationMultiplier } from '../mitigation'

export interface EffectiveHp {
  physical: number
  magic: number
}

/** A stat sheet's effective HP against physical and magic damage, from its hp/armor/mr totals. */
export function effectiveHp(sheet: StatSheet): EffectiveHp {
  const hp = sheet.total.hp ?? 0
  const armor = sheet.total.armor ?? 0
  const mr = sheet.total.mr ?? 0
  return {
    physical: hp / mitigationMultiplier(armor),
    magic: hp / mitigationMultiplier(mr),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/calc/test/analysis/effective-hp.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Add the export**

In `packages/calc/src/index.ts`, add:

```typescript
export * from './analysis/effective-hp'
```

- [ ] **Step 6: Commit**

```bash
git add packages/calc/src/analysis/effective-hp.ts packages/calc/test/analysis/effective-hp.test.ts packages/calc/src/index.ts
git commit -m "feat: add effectiveHp analysis function"
```

---

### Task 2: `sustainedDps`

**Files:**
- Create: `packages/calc/src/analysis/sustained-dps.ts`
- Modify: `packages/calc/src/index.ts` (add export)
- Test: `packages/calc/test/analysis/sustained-dps.test.ts`

**Interfaces:**
- Consumes: `Combatant` (`packages/calc/src/combatant.ts`), `AbilityKey`
  (`packages/calc/src/effects/types.ts`), `simulateCombo`/`ComboAction`
  (`packages/calc/src/simulate-combo.ts`) — all already implemented.
- Produces: `sustainedDps(attacker: Combatant, target: Combatant, seconds: number, priority:
  AbilityKey[]): number`, consumed by Task 3's `compareBuilds`.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/calc/test/analysis/sustained-dps.test.ts
import { describe, it, expect } from 'vitest'
import { sustainedDps } from '../../src/analysis/sustained-dps'
import { combatantFromChampion, combatantFromDummy } from '../../src/combatant'
import type { Champion, Build, Target } from '@wr-calc/schema'

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
  return { kind: 'dummy', hp: 100000, armor: 0, mr: 0, ...overrides }
}

describe('sustainedDps', () => {
  it('matches AD-per-interval exactly for a pure-AA rotation', () => {
    const attacker = combatantFromChampion(
      championWithAbility(), 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    const target = combatantFromDummy(dummy())
    // attackSpeed 1 -> one AA/sec; critMode 'expected' at 0 crit chance -> exactly AD per hit.
    // Landings at t=0,1,2 fall inside [0,3); dividing by the same 3s gives back AD exactly.
    expect(sustainedDps(attacker, target, 3, [])).toBeCloseTo(60, 5)
  })

  it('adds exactly the priority ability\'s share of damage within the window', () => {
    const attacker = combatantFromChampion(
      championWithAbility(), 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    const target = combatantFromDummy(dummy())
    const pureAa = sustainedDps(attacker, target, 8, [])
    const withQ = sustainedDps(attacker, target, 8, ['q'])
    // Q has an 8s cooldown and 50 magic damage; over an 8s window (t < 8) only the t=0 cast
    // counts (the recast at t=8 falls on the excluded boundary), adding exactly 50/8 dps.
    expect(withQ).toBeCloseTo(pureAa + 50 / 8, 5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/calc/test/analysis/sustained-dps.test.ts`
Expected: FAIL — cannot find module `../../src/analysis/sustained-dps`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/calc/src/analysis/sustained-dps.ts
import type { Combatant } from '../combatant'
import type { AbilityKey } from '../effects/types'
import { simulateCombo } from '../simulate-combo'
import type { ComboAction } from '../simulate-combo'

const ABILITY_ACTION: Record<AbilityKey, ComboAction> = { q: 'Q', w: 'W', e: 'E', r: 'R' }

/**
 * Estimated damage per second over `seconds`, casting abilities off cooldown in `priority` order
 * (each attempt is a free no-op in simulateCombo if still on cooldown) and filling with basic
 * attacks. Only counts damage landing strictly before `seconds` so the result matches the
 * attack-speed-implied rate exactly for a pure-AA rotation.
 */
export function sustainedDps(
  attacker: Combatant, target: Combatant, seconds: number, priority: AbilityKey[]
): number {
  const interval = 1 / Math.max(attacker.sheet.total.attackSpeed ?? 1, 0.01)
  const blocks = Math.ceil(seconds / interval) + priority.length + 1
  const sequence: ComboAction[] = []
  for (let i = 0; i < blocks; i++) {
    for (const key of priority) sequence.push(ABILITY_ACTION[key])
    sequence.push('AA')
  }

  const result = simulateCombo(attacker, target, sequence, { critMode: 'expected' })
  const total = result.instances
    .filter((instance) => instance.time < seconds)
    .reduce((sum, instance) => sum + instance.mitigated, 0)
  return total / seconds
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/calc/test/analysis/sustained-dps.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Add the export**

In `packages/calc/src/index.ts`, add:

```typescript
export * from './analysis/sustained-dps'
```

- [ ] **Step 6: Commit**

```bash
git add packages/calc/src/analysis/sustained-dps.ts packages/calc/test/analysis/sustained-dps.test.ts packages/calc/src/index.ts
git commit -m "feat: add sustainedDps analysis function"
```

---

### Task 3: `compareBuilds` (core — no caching yet)

**Files:**
- Create: `packages/calc/src/analysis/compare-builds.ts`
- Modify: `packages/calc/src/index.ts` (add export)
- Test: `packages/calc/test/analysis/compare-builds.test.ts`

**Interfaces:**
- Consumes: `Combatant`/`combatantFromChampion` (`../combatant`), `StatCatalog`
  (`../resolve-stats`), `AbilityKey` (`../effects/types`), `ComboAction`/`simulateCombo`
  (`../simulate-combo`), `UnsupportedEffectEntry` (`../result-envelope`), `UnverifiedRuleId`
  (`../rules`), `effectiveHp`/`EffectiveHp` (Task 1), `sustainedDps` (Task 2).
- Produces: `compareBuilds(a: CompareBuildsSide, b: CompareBuildsSide, target: Combatant, scenario:
  CompareBuildsScenario): CompareBuildsResult`, plus the exported `CompareBuildsSide`,
  `CompareBuildsScenario`, `BuildBreakpoint`, `CompareBuildsResult` types. No other task in this
  plan builds on `compareBuilds`'s output, so this is the plan's terminal interface.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/calc/test/analysis/compare-builds.test.ts
import { describe, it, expect } from 'vitest'
import { compareBuilds } from '../../src/analysis/compare-builds'
import type { CompareBuildsScenario } from '../../src/analysis/compare-builds'
import { combatantFromDummy } from '../../src/combatant'
import type { Champion, Item, Build, Target } from '@wr-calc/schema'

function championWithAbility(overrides: Partial<Champion> = {}): Champion {
  return {
    id: 'test-champ', name: 'Test Champion', resource: 'mana',
    baseStats: { hp: { base: 1000, perLevel: 0 }, ad: { base: 60, perLevel: 0 } },
    attackSpeed: { base: 1, ratio: 0 },
    abilities: {
      passive: { id: 'passive', name: 'P', maxRank: 1, cooldown: 0, castTime: 0, damage: [], flags: {} },
      q: { id: 'q', name: 'Q', maxRank: 5, cooldown: 8, castTime: 0, damage: [], flags: {} },
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
  return { kind: 'dummy', hp: 100000, armor: 0, mr: 0, ...overrides }
}

function adItem(id: string, ad: number, cost: number): Item {
  return {
    id, name: id, tier: 'basic', cost: { total: cost, combine: cost }, recipe: [],
    stats: { ad }, effects: [], tags: [],
    provenance: { source: 'manual', patch: '0.0.0', verifiedInGame: false },
  }
}

describe('compareBuilds', () => {
  it('produces one breakpoint per item, with cumulative gold, rising dps, and no ttk against a dummy', () => {
    const items = new Map([
      ['item-a1', adItem('item-a1', 10, 1000)],
      ['item-a2', adItem('item-a2', 20, 2000)],
    ])
    const champion = championWithAbility()
    const buildA = emptyBuild({ items: ['item-a1', 'item-a2'] })
    const buildB = emptyBuild({ items: ['item-a1'] })
    const target = combatantFromDummy(dummy())
    const scenario: CompareBuildsScenario = { durationSeconds: 3, priority: [], burstSequence: ['AA'] }

    const result = compareBuilds(
      { champion, level: 1, build: buildA, catalog: { items, runes: new Map() } },
      { champion, level: 1, build: buildB, catalog: { items, runes: new Map() } },
      target, scenario
    )

    expect(result.a).toHaveLength(2)
    expect(result.b).toHaveLength(1)
    expect(result.a.map((bp) => bp.gold)).toEqual([1000, 3000])
    expect(result.a[0].burst).toBeCloseTo(70) // 60 base AD + 10 from item-a1
    expect(result.a[1].burst).toBeCloseTo(90) // + 20 from item-a2
    expect(result.a[1].dps).toBeGreaterThan(result.a[0].dps)
    expect(result.a[0].ttk).toBeUndefined() // single AA never kills a 100000hp dummy
    expect(result.a[0].ehp).toEqual({ physical: 1000, magic: 1000 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/calc/test/analysis/compare-builds.test.ts`
Expected: FAIL — cannot find module `../../src/analysis/compare-builds`.

- [ ] **Step 3: Write minimal implementation (no caching — Task 4 adds it)**

```typescript
// packages/calc/src/analysis/compare-builds.ts
import type { Champion, Build } from '@wr-calc/schema'
import type { Combatant } from '../combatant'
import { combatantFromChampion } from '../combatant'
import type { StatCatalog } from '../resolve-stats'
import type { AbilityKey } from '../effects/types'
import type { ComboAction } from '../simulate-combo'
import { simulateCombo } from '../simulate-combo'
import type { UnsupportedEffectEntry } from '../result-envelope'
import type { UnverifiedRuleId } from '../rules'
import { sustainedDps } from './sustained-dps'
import { effectiveHp } from './effective-hp'
import type { EffectiveHp } from './effective-hp'

export interface CompareBuildsSide {
  champion: Champion
  level: number
  build: Build
  catalog: StatCatalog
}

export interface CompareBuildsScenario {
  durationSeconds: number
  priority: AbilityKey[]
  burstSequence: ComboAction[]
}

export interface BuildBreakpoint {
  gold: number
  burst: number
  dps: number
  ttk?: number
  ehp: EffectiveHp
}

export interface CompareBuildsResult {
  a: BuildBreakpoint[]
  b: BuildBreakpoint[]
  unsupportedEffects: UnsupportedEffectEntry[]
  dataWarnings: string[]
  unverifiedRules: UnverifiedRuleId[]
}

interface Envelope {
  unsupportedByEffectId: Map<string, UnsupportedEffectEntry>
  dataWarnings: string[]
  unverifiedRuleIds: Set<UnverifiedRuleId>
}

function mergeEnvelope(envelope: Envelope, source: {
  unsupportedEffects: UnsupportedEffectEntry[]
  dataWarnings: string[]
  unverifiedRules: UnverifiedRuleId[]
}): void {
  for (const entry of source.unsupportedEffects) envelope.unsupportedByEffectId.set(entry.id, entry)
  source.dataWarnings.forEach((warning) => envelope.dataWarnings.push(warning))
  source.unverifiedRules.forEach((id) => envelope.unverifiedRuleIds.add(id))
}

function breakpointsForSide(
  side: CompareBuildsSide, target: Combatant, scenario: CompareBuildsScenario, envelope: Envelope
): BuildBreakpoint[] {
  const breakpoints: BuildBreakpoint[] = []
  let gold = 0

  for (let itemCount = 1; itemCount <= side.build.items.length; itemCount++) {
    const itemIds = side.build.items.slice(0, itemCount)
    const build: Build = { ...side.build, items: itemIds }
    const combatant = combatantFromChampion(side.champion, side.level, build, side.catalog)
    mergeEnvelope(envelope, combatant.sheet)

    // combatantFromChampion above already validated every id in build.items/boots/enchant via
    // resolveStats, so the catalog lookups below are safe — same trust boundary combatant.ts uses.
    if (itemCount === 1) {
      if (side.build.boots) gold += side.catalog.items.get(side.build.boots)!.cost.total
      if (side.build.enchant) gold += side.catalog.items.get(side.build.enchant)!.cost.total
    }
    gold += side.catalog.items.get(itemIds[itemIds.length - 1])!.cost.total

    const burstResult = simulateCombo(
      combatant, target, scenario.burstSequence, { critMode: 'expected', ignoreCooldowns: true }
    )
    mergeEnvelope(envelope, burstResult)
    const burst = Object.values(burstResult.totalsByType).reduce(
      (sum, value) => sum + (value ?? 0), 0
    )

    const dps = sustainedDps(combatant, target, scenario.durationSeconds, scenario.priority)

    breakpoints.push({ gold, burst, dps, ttk: burstResult.timeToKill, ehp: effectiveHp(combatant.sheet) })
  }
  return breakpoints
}

/** Computes a gold/burst/dps/ttk/ehp series at every item breakpoint for two builds, for crossover charts. */
export function compareBuilds(
  a: CompareBuildsSide, b: CompareBuildsSide, target: Combatant, scenario: CompareBuildsScenario
): CompareBuildsResult {
  const envelope: Envelope = {
    unsupportedByEffectId: new Map(), dataWarnings: [], unverifiedRuleIds: new Set(),
  }
  const aBreakpoints = breakpointsForSide(a, target, scenario, envelope)
  const bBreakpoints = breakpointsForSide(b, target, scenario, envelope)

  return {
    a: aBreakpoints, b: bBreakpoints,
    unsupportedEffects: [...envelope.unsupportedByEffectId.values()],
    dataWarnings: [...new Set(envelope.dataWarnings)],
    unverifiedRules: [...envelope.unverifiedRuleIds],
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/calc/test/analysis/compare-builds.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Add the export**

In `packages/calc/src/index.ts`, add:

```typescript
export * from './analysis/compare-builds'
```

- [ ] **Step 6: Commit**

```bash
git add packages/calc/src/analysis/compare-builds.ts packages/calc/test/analysis/compare-builds.test.ts packages/calc/src/index.ts
git commit -m "feat: add compareBuilds analysis function"
```

---

### Task 4: `compareBuilds` caching

**Files:**
- Modify: `packages/calc/src/analysis/compare-builds.ts`
- Test: `packages/calc/test/analysis/compare-builds.test.ts` (add a test)

**Interfaces:**
- Consumes/Produces: same as Task 3 — this task only changes `breakpointsForSide`'s internals to
  reuse `Combatant`s across breakpoints/sides that resolve to the same inputs; no signature changes.

- [ ] **Step 1: Write the failing test**

Add to `packages/calc/test/analysis/compare-builds.test.ts` (same file, same local helpers as Task 3):

```typescript
  it('reuses a cached combatant when both sides resolve the same breakpoint', async () => {
    const combatantModule = await import('../../src/combatant')
    const items = new Map([['item-shared', adItem('item-shared', 10, 1000)]])
    const champion = championWithAbility()
    const build = emptyBuild({ items: ['item-shared'] })
    const target = combatantFromDummy(dummy())
    const scenario: CompareBuildsScenario = { durationSeconds: 1, priority: [], burstSequence: ['AA'] }
    const spy = vi.spyOn(combatantModule, 'combatantFromChampion')

    compareBuilds(
      { champion, level: 1, build, catalog: { items, runes: new Map() } },
      { champion, level: 1, build, catalog: { items, runes: new Map() } },
      target, scenario
    )

    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
```

Add `vi` to the existing `import { describe, it, expect } from 'vitest'` line, making it
`import { describe, it, expect, vi } from 'vitest'`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/calc/test/analysis/compare-builds.test.ts`
Expected: FAIL — `spy` called twice (once per side), not once.

- [ ] **Step 3: Add the cache**

In `packages/calc/src/analysis/compare-builds.ts`, add a cache-key helper and thread a shared
`Map<string, Combatant>` through `breakpointsForSide`:

```typescript
function cacheKey(
  championId: string, level: number, itemIds: string[], runeIds: string[],
  inputs: Record<string, number | boolean>
): string {
  const inputsKey = Object.keys(inputs).sort().map((key) => `${key}=${inputs[key]}`).join('&')
  return `${championId}|${level}|${itemIds.join(',')}|${runeIds.join(',')}|${inputsKey}`
}
```

Change `breakpointsForSide`'s signature to accept the cache, and use it around the
`combatantFromChampion` call:

```typescript
function breakpointsForSide(
  side: CompareBuildsSide, target: Combatant, scenario: CompareBuildsScenario, envelope: Envelope,
  combatantCache: Map<string, Combatant>
): BuildBreakpoint[] {
  const breakpoints: BuildBreakpoint[] = []
  let gold = 0

  for (let itemCount = 1; itemCount <= side.build.items.length; itemCount++) {
    const itemIds = side.build.items.slice(0, itemCount)
    const build: Build = { ...side.build, items: itemIds }
    // The key must cover every id combatantFromChampion actually resolves against (build.items
    // plus boots/enchant), not just the staged generic items — otherwise two sides sharing the
    // same generic items but different boots/enchant would wrongly collide in the cache.
    const fullItemIds = [
      ...itemIds, ...(build.boots ? [build.boots] : []), ...(build.enchant ? [build.enchant] : []),
    ]
    const key = cacheKey(side.champion.id, side.level, fullItemIds, build.runes, build.inputs)
    let combatant = combatantCache.get(key)
    if (!combatant) {
      combatant = combatantFromChampion(side.champion, side.level, build, side.catalog)
      combatantCache.set(key, combatant)
    }
    mergeEnvelope(envelope, combatant.sheet)

    // combatantFromChampion above already validated every id in build.items/boots/enchant via
    // resolveStats, so the catalog lookups below are safe — same trust boundary combatant.ts uses.
    if (itemCount === 1) {
      if (side.build.boots) gold += side.catalog.items.get(side.build.boots)!.cost.total
      if (side.build.enchant) gold += side.catalog.items.get(side.build.enchant)!.cost.total
    }
    gold += side.catalog.items.get(itemIds[itemIds.length - 1])!.cost.total

    const burstResult = simulateCombo(
      combatant, target, scenario.burstSequence, { critMode: 'expected', ignoreCooldowns: true }
    )
    mergeEnvelope(envelope, burstResult)
    const burst = Object.values(burstResult.totalsByType).reduce(
      (sum, value) => sum + (value ?? 0), 0
    )

    const dps = sustainedDps(combatant, target, scenario.durationSeconds, scenario.priority)

    breakpoints.push({ gold, burst, dps, ttk: burstResult.timeToKill, ehp: effectiveHp(combatant.sheet) })
  }
  return breakpoints
}
```

And update `compareBuilds` to create and pass the cache:

```typescript
export function compareBuilds(
  a: CompareBuildsSide, b: CompareBuildsSide, target: Combatant, scenario: CompareBuildsScenario
): CompareBuildsResult {
  const envelope: Envelope = {
    unsupportedByEffectId: new Map(), dataWarnings: [], unverifiedRuleIds: new Set(),
  }
  const combatantCache = new Map<string, Combatant>()
  const aBreakpoints = breakpointsForSide(a, target, scenario, envelope, combatantCache)
  const bBreakpoints = breakpointsForSide(b, target, scenario, envelope, combatantCache)

  return {
    a: aBreakpoints, b: bBreakpoints,
    unsupportedEffects: [...envelope.unsupportedByEffectId.values()],
    dataWarnings: [...new Set(envelope.dataWarnings)],
    unverifiedRules: [...envelope.unverifiedRuleIds],
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/calc/test/analysis/compare-builds.test.ts`
Expected: PASS (2 tests) — re-run Task 3's test too and confirm it still passes (the cache must not
change any computed value, only how many times `combatantFromChampion` runs).

- [ ] **Step 5: Commit**

```bash
git add packages/calc/src/analysis/compare-builds.ts packages/calc/test/analysis/compare-builds.test.ts
git commit -m "feat: cache resolved combatants across compareBuilds breakpoints"
```

---

### Task 5: Performance check

**Files:**
- Test: `packages/calc/test/analysis/compare-builds-perf.test.ts`

**Interfaces:**
- Consumes: `compareBuilds` (Task 3+4). Produces nothing further.

- [ ] **Step 1: Write the test**

```typescript
// packages/calc/test/analysis/compare-builds-perf.test.ts
import { describe, it, expect } from 'vitest'
import { compareBuilds } from '../../src/analysis/compare-builds'
import type { CompareBuildsScenario } from '../../src/analysis/compare-builds'
import { combatantFromDummy } from '../../src/combatant'
import type { Champion, Item, Build, Target } from '@wr-calc/schema'

function championWithAbility(): Champion {
  return {
    id: 'test-champ', name: 'Test Champion', resource: 'mana',
    baseStats: { hp: { base: 1000, perLevel: 0 }, ad: { base: 60, perLevel: 0 } },
    attackSpeed: { base: 1, ratio: 0 },
    abilities: {
      passive: { id: 'passive', name: 'P', maxRank: 1, cooldown: 0, castTime: 0, damage: [], flags: {} },
      q: { id: 'q', name: 'Q', maxRank: 5, cooldown: 8, castTime: 0, damage: [], flags: {} },
      w: { id: 'w', name: 'W', maxRank: 5, cooldown: 8, castTime: 0, damage: [], flags: {} },
      e: { id: 'e', name: 'E', maxRank: 5, cooldown: 8, castTime: 0, damage: [], flags: {} },
      r: { id: 'r', name: 'R', maxRank: 3, cooldown: 100, castTime: 0, damage: [], flags: {} },
    },
  }
}

function dummy(): Extract<Target, { kind: 'dummy' }> {
  return { kind: 'dummy', hp: 100000, armor: 0, mr: 0 }
}

function adItem(id: string, ad: number, cost: number): Item {
  return {
    id, name: id, tier: 'basic', cost: { total: cost, combine: cost }, recipe: [],
    stats: { ad }, effects: [], tags: [],
    provenance: { source: 'manual', patch: '0.0.0', verifiedInGame: false },
  }
}

describe('compareBuilds performance', () => {
  it('computes two 6-item builds in under 5ms', () => {
    const items = new Map<string, Item>()
    const buildAItems: string[] = []
    const buildBItems: string[] = []
    for (let i = 1; i <= 6; i++) {
      items.set(`item-a${i}`, adItem(`item-a${i}`, 10 * i, 1000 * i))
      items.set(`item-b${i}`, adItem(`item-b${i}`, 5 * i, 800 * i))
      buildAItems.push(`item-a${i}`)
      buildBItems.push(`item-b${i}`)
    }
    const champion = championWithAbility()
    const buildA: Build = { items: buildAItems, runes: [], inputs: {} }
    const buildB: Build = { items: buildBItems, runes: [], inputs: {} }
    const target = combatantFromDummy(dummy())
    const scenario: CompareBuildsScenario = { durationSeconds: 3, priority: [], burstSequence: ['AA', 'AA'] }

    const start = performance.now()
    const result = compareBuilds(
      { champion, level: 1, build: buildA, catalog: { items, runes: new Map() } },
      { champion, level: 1, build: buildB, catalog: { items, runes: new Map() } },
      target, scenario
    )
    const elapsed = performance.now() - start

    expect(result.a).toHaveLength(6)
    expect(result.b).toHaveLength(6)
    expect(elapsed).toBeLessThan(5)
  })
})
```

- [ ] **Step 2: Run it**

Run: `npx vitest run packages/calc/test/analysis/compare-builds-perf.test.ts`
Expected: PASS. Per the spec: write for clarity first (already done in Tasks 3-4) — only go back
and optimize `compareBuilds`/`sustainedDps` if this flakes or fails; don't pre-optimize.

- [ ] **Step 3: Commit**

```bash
git add packages/calc/test/analysis/compare-builds-perf.test.ts
git commit -m "test: assert compareBuilds completes two 6-item builds in under 5ms"
```

---

### Task 6: Document Step 5's known gaps (ADR) and final full-suite check

**Files:**
- Create: `docs/decisions/2026-09-17-compare-builds-known-phase1-gaps.md`

**Interfaces:** None — documentation only.

- [ ] **Step 1: Write the ADR**

```markdown
# ADR: `compareBuilds` known Phase 1 gaps

**Status:** Accepted

## Context

Step 5 (`docs/superpowers/plans/2026-09-17-phase1-step5-analysis.md`) implements the analysis layer
on top of Steps 2-4's engine. Its design notes made several deliberate scope cuts, recorded here as
the durable reference — same pattern as
`docs/decisions/2026-09-11-simulate-combo-known-phase1-gaps.md` for Step 4.

## Decision — the following are accepted Phase 1 gaps

1. **`goldEfficiency(item)` is not implemented in Step 5.** The spec requires it to derive stat gold
   values from basic items in the real data, but `packages/data` is still an empty stub (Step 6,
   "real data skeletons", hasn't run). It isn't a dependency of `compareBuilds`'s output (`gold`
   there is cumulative item cost, not efficiency), so nothing in Step 5 needed it. Pick up in Step 6.
2. **`compareBuilds` never emits a partial "next-item components" breakpoint.** The spec allows one
   optionally; v1 produces exactly one breakpoint per *completed* item and nothing for an
   in-progress purchase. Revisit if a build-planning UI needs to preview a partially-afforded item.
3. **`boots`/`enchant` are treated as already owned at every breakpoint**, not staged incrementally
   like `build.items`. Their cost is added once, at the first breakpoint. This means the very first
   plotted breakpoint's `gold` already includes boots/enchant cost even though, narratively, a
   player might buy their first component before boots. Acceptable for a first pass; revisit if the
   crossover chart needs to model purchase order across item types.
4. **`compareBuilds` does not surface `sustainedDps`'s own `simulateCombo` call's envelope
   entries** (`dataWarnings`/`unsupportedEffects`/`unverifiedRules`) — only the `burst` call's
   envelope is unioned in per breakpoint. In practice this rarely loses information: `dps` and
   `burst` run the same attacker equipment through the same effect registry, so `sustainedDps`'s
   call would mostly duplicate what the burst call already reports. The one real gap: an effect kind
   that only triggers via an ability in `scenario.priority` and never appears in
   `scenario.burstSequence` could go unreported. Revisit if that scenario shape becomes common.
5. **`ttk` reflects only `scenario.burstSequence`, not whether `sustainedDps`'s priority rotation
   would eventually kill.** A build that only kills through sustained cooldown-respecting play (not
   within the fixed burst sequence) reports `ttk: undefined` for that breakpoint. Callers (a future
   debug page or UI) should treat `undefined` as "not modeled by this scenario," not "unkillable."

## Consequences

- None of the above block Step 5 from producing a working `compareBuilds` crossover series; each is
  either genuinely out of scope for Phase 1 (gap 1) or a documented, bounded simplification (gaps
  2-5).
- Future steps should update this file, not the (by then historical) Step 5 plan document.
```

- [ ] **Step 2: Commit the ADR**

```bash
git add docs/decisions/2026-09-17-compare-builds-known-phase1-gaps.md
git commit -m "docs: record compareBuilds's known Phase 1 gaps as an ADR"
```

- [ ] **Step 3: Run the full suite and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: every test file passes (the full repo suite, not just this plan's new files), and
`tsc -b` reports no errors.
