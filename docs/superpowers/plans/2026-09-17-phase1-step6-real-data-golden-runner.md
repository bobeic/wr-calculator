# Phase 1 Step 6: Real Data Skeletons + Golden Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `packages/data` real (null-valued, unverified) skeleton items and champions for the current Wild Rift patch, plus a golden-test-case runner infrastructure that Steps 2-5's `resolveStats`/`simulateCombo`/`compareBuilds` can be checked against once the user fills in real numbers.

**Architecture:** Two flat per-patch data files (`items.ts`, `champions.ts`) under `packages/data/src/patches/7.3/`, a small `buildCatalog` helper that turns them into the `StatCatalog` shape `resolveStats` already expects, and a golden-case runner (Zod-validated JSON cases + a pure comparison function + a thin Vitest integration file) that is correct and tested today even though zero real cases exist yet.

**Tech Stack:** TypeScript, Zod (schema/validation), Vitest (tests), pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-17-phase1-step6-real-data-golden-runner-design.md`

## Global Constraints

- Every item/champion added in this plan carries `provenance.verifiedInGame: false` and `provenance.patch: '7.3'` — every numeric stat/effect *magnitude* is `null` (items) or a clearly-approximate placeholder number (champion `baseStats`/`attackSpeed`, which the schema doesn't allow to be `null`) pending the user's own in-game verification pass. Never fabricate precision.
- Every item's `recipe` is `[]` and `cost.combine === cost.total` — recipe trees are out of scope for this step (see spec §3).
- No rune data and no changes to `Build`/`ItemTierSchema`'s `'enchant'` handling in this step (see spec §2, "Deferred, not in this step").
- No new champion kit mechanics beyond a single declarative `DamageComponent` per damage-dealing ability; abilities that are primarily non-damage (passives, shields, movement) get `damage: []` — `AbilitySchema` has no `effects` field to express those yet, a known gap, not fixed here.
- Run `npm test` (from repo root) after every task; it must stay fully green (currently 45 files / 287 tests passing).
- Follow the repo's branch/commit rules from `~/.claude/CLAUDE.md`: work stays on `docs/tvanmook/phase1-step6-design/20260917` (or a plan-execution branch derived from it), commit after every task with a `feat:`/`test:`/`fix:` prefix as appropriate.

---

### Task 1: `ChampionSchema.provenance`, the enchant-slot fix, and fixture fix-ups

**Files:**
- Modify: `packages/schema/src/champion.ts`
- Modify: `packages/schema/test/champion.test.ts`
- Modify: `packages/calc/src/rules.ts`
- Modify: `packages/calc/test/rules.test.ts`
- Modify: `packages/calc/test/simulate-combo.test.ts:6-23`
- Modify: `packages/calc/test/resolve-stats.test.ts:6-20`
- Modify: `packages/calc/test/combatant.test.ts:5-19`
- Modify: `packages/calc/test/analysis/compare-builds.test.ts:8-22`
- Modify: `packages/calc/test/analysis/compare-builds-perf.test.ts:7-19`
- Modify: `packages/calc/test/analysis/sustained-dps.test.ts:7-24`

**Interfaces:**
- Produces: `ChampionSchema` (and the inferred `Champion` type) now requires `provenance: Provenance` — the same shape already used by `Item.provenance`. `HAS_SEPARATE_ENCHANT_SLOT` (from `packages/calc/src/rules.ts`) is `false`.
- Consumes: `ProvenanceSchema`/`Provenance`, already defined in `packages/schema/src/provenance.ts` and exported from `@wr-calc/schema`. Nothing else in this task depends on earlier tasks.

- [ ] **Step 1: Add `provenance` to the one Zod-validated champion test fixture (red)**

In `packages/schema/test/champion.test.ts`, add a `provenance` field to all 5 inline champion objects (the schema doesn't have this field yet, so this makes the first test fail on an unrecognized key — the others already throw for unrelated reasons but should fail for the right reason too):

```typescript
// packages/schema/test/champion.test.ts
function validAbility(id: string) {
  return { id, name: id, maxRank: 5, cooldown: 8, castTime: 0.25, damage: [], flags: {} }
}

const testProvenance = { source: 'manual' as const, patch: 'test', verifiedInGame: false }

describe('ChampionSchema', () => {
  it('parses a minimal valid champion', () => {
    const champion = {
      id: 'nunu-willump',
      name: 'Nunu & Willump',
      resource: 'mana' as const,
      baseStats: { hp: { base: 610, perLevel: 90 }, ad: { base: 60, perLevel: 3 } },
      attackSpeed: { base: 0.625 },
      abilities: {
        passive: validAbility('passive'),
        q: validAbility('q'),
        w: validAbility('w'),
        e: validAbility('e'),
        r: validAbility('r'),
      },
      provenance: testProvenance,
    }
    const result = ChampionSchema.parse(champion)
    expect(result.id).toBe('nunu-willump')
  })

  it('rejects an unknown resource type', () => {
    const champion = {
      id: 'x', name: 'X', resource: 'rage', baseStats: {}, attackSpeed: { base: 0.6 },
      abilities: {
        passive: validAbility('passive'), q: validAbility('q'), w: validAbility('w'),
        e: validAbility('e'), r: validAbility('r'),
      },
      provenance: testProvenance,
    }
    expect(() => ChampionSchema.parse(champion)).toThrow()
  })

  it('rejects an unknown stat key in baseStats', () => {
    const champion = {
      id: 'x', name: 'X', resource: 'mana' as const,
      baseStats: { madeUpStat: { base: 10, perLevel: 1 } },
      attackSpeed: { base: 0.6 },
      abilities: {
        passive: validAbility('passive'), q: validAbility('q'), w: validAbility('w'),
        e: validAbility('e'), r: validAbility('r'),
      },
      provenance: testProvenance,
    }
    expect(() => ChampionSchema.parse(champion)).toThrow()
  })

  it('rejects attackSpeed inside baseStats since base AS has its own dedicated field', () => {
    const champion = {
      id: 'x', name: 'X', resource: 'mana' as const,
      baseStats: { attackSpeed: { base: 0.625, perLevel: 0.005 } },
      attackSpeed: { base: 0.625 },
      abilities: {
        passive: validAbility('passive'), q: validAbility('q'), w: validAbility('w'),
        e: validAbility('e'), r: validAbility('r'),
      },
      provenance: testProvenance,
    }
    expect(() => ChampionSchema.parse(champion)).toThrow()
  })

  it('rejects an unknown top-level field', () => {
    const champion = {
      id: 'x', name: 'X', resource: 'mana' as const, baseStats: {},
      attackSpeed: { base: 0.6 },
      abilities: {
        passive: validAbility('passive'), q: validAbility('q'), w: validAbility('w'),
        e: validAbility('e'), r: validAbility('r'),
      },
      provenance: testProvenance,
      madeUpField: true,
    }
    expect(() => ChampionSchema.parse(champion)).toThrow()
  })
})
```

- [ ] **Step 2: Run the schema test suite and confirm the first test fails**

Run: `cd packages/schema && npx vitest run test/champion.test.ts`
Expected: FAIL on "parses a minimal valid champion" — Zod error naming `provenance` as an unrecognized key.

- [ ] **Step 3: Add `provenance` to `ChampionSchema`**

```typescript
// packages/schema/src/champion.ts
import { z } from 'zod'
import { statKeyRecord } from './stat-key'
import { AbilitySchema } from './ability'
import { ProvenanceSchema } from './provenance'

export const ChampionBaseStatsSchema = statKeyRecord(
  z.object({ base: z.number(), perLevel: z.number() })
).omit({ attackSpeed: true })

export const ChampionSchema = z.object({
  id: z.string(),
  name: z.string(),
  resource: z.enum(['mana', 'energy', 'none', 'other']),
  baseStats: ChampionBaseStatsSchema,
  attackSpeed: z.object({ base: z.number(), ratio: z.number().optional() }).strict(),
  abilities: z.object({
    passive: AbilitySchema,
    q: AbilitySchema,
    w: AbilitySchema,
    e: AbilitySchema,
    r: AbilitySchema,
  }).strict(),
  provenance: ProvenanceSchema,
}).strict()
export type Champion = z.infer<typeof ChampionSchema>
```

- [ ] **Step 4: Run the schema test suite and confirm it passes**

Run: `cd packages/schema && npx vitest run test/champion.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Add a regression test for the enchant-slot fix (red), then flip the constant**

In `packages/calc/test/rules.test.ts`, add (near the other rules-constant describe blocks):

```typescript
// add to the import list at the top of the file
import {
  MAX_CHAMPION_LEVEL, statAtLevel, interpolateLevelRange, resolveAdaptiveDamageType,
  attackSpeedAtLevel, totalAttackSpeed, STAT_RESOLUTION_ORDER, UNVERIFIED_RULE_IDS, critMultiplier,
  HAS_SEPARATE_ENCHANT_SLOT,
} from '../src/rules'
```

```typescript
describe('HAS_SEPARATE_ENCHANT_SLOT', () => {
  it('is false: Wild Rift removed the boot-enchant mechanic, enchants are standalone items now', () => {
    expect(HAS_SEPARATE_ENCHANT_SLOT).toBe(false)
  })
})
```

Run: `cd packages/calc && npx vitest run test/rules.test.ts`
Expected: FAIL — `HAS_SEPARATE_ENCHANT_SLOT` is currently `true`.

Then in `packages/calc/src/rules.ts`, change:

```typescript
// TODO-VERIFY(itemSlots): confirm the inventory holds 6 item slots plus a separate boots slot
// and a separate enchant slot (i.e. boots/enchant don't consume one of the 6), in a custom game.
export const ITEM_SLOTS = 6
export const HAS_SEPARATE_BOOTS_SLOT = true
export const HAS_SEPARATE_ENCHANT_SLOT = true
```

to:

```typescript
// TODO-VERIFY(itemSlots): confirm the inventory holds 6 item slots plus a separate boots slot,
// in a custom game.
// Confirmed 2026-09-17 (user, in-game): Wild Rift removed the boot-enchant mechanic — enchants
// are standalone items now, not a separate attach-to-boots slot.
export const ITEM_SLOTS = 6
export const HAS_SEPARATE_BOOTS_SLOT = true
export const HAS_SEPARATE_ENCHANT_SLOT = false
```

Run: `cd packages/calc && npx vitest run test/rules.test.ts`
Expected: PASS.

- [ ] **Step 6: Fix the 6 calc test files' `Champion`-typed fixture helpers**

These are plain TypeScript object literals passed directly to non-validating functions (`resolveStats`, `combatantFromChampion`, ...), not run through `ChampionSchema.parse`, so they won't fail *at runtime* — but they're now missing a required field on the `Champion` type. Add one line to each helper's returned object, immediately after `attackSpeed: { ... },`:

```typescript
provenance: { source: 'manual', patch: 'test', verifiedInGame: false },
```

Apply to:
- `packages/calc/test/simulate-combo.test.ts`, in `championWithAbility()` (after line 10, `attackSpeed: { base: 1, ratio: 0 },`)
- `packages/calc/test/resolve-stats.test.ts`, in `validChampion()` (after line 10, `attackSpeed: { base: 0.625, ratio: 0.025 },`)
- `packages/calc/test/combatant.test.ts`, in `validChampion()` (after line 9, same line)
- `packages/calc/test/analysis/compare-builds.test.ts`, in `championWithAbility()` (after line 12, `attackSpeed: { base: 1, ratio: 0 },`)
- `packages/calc/test/analysis/compare-builds-perf.test.ts`, in `championWithAbility()` (after line 11, same line)
- `packages/calc/test/analysis/sustained-dps.test.ts`, in `championWithAbility()` (after line 11, same line)

Example (`packages/calc/test/simulate-combo.test.ts`), showing the full function after the edit:

```typescript
function championWithAbility(overrides: Partial<Champion> = {}): Champion {
  return {
    id: 'test-champ', name: 'Test Champion', resource: 'mana',
    baseStats: { hp: { base: 1000, perLevel: 0 }, ad: { base: 60, perLevel: 0 } },
    attackSpeed: { base: 1, ratio: 0 },
    provenance: { source: 'manual', patch: 'test', verifiedInGame: false },
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
```

Apply the same one-line insertion (adjusted `id`/`name`/stat values already present in each file are untouched) to the other 5 files.

- [ ] **Step 7: Run the full monorepo test suite**

Run: `npm test` (from repo root)
Expected: PASS — all test files green (still 45 files; test count may grow by ~6 from Steps 1/5 above).

- [ ] **Step 8: Commit**

```bash
git add packages/schema/src/champion.ts packages/schema/test/champion.test.ts \
  packages/calc/src/rules.ts packages/calc/test/rules.test.ts \
  packages/calc/test/simulate-combo.test.ts packages/calc/test/resolve-stats.test.ts \
  packages/calc/test/combatant.test.ts packages/calc/test/analysis/compare-builds.test.ts \
  packages/calc/test/analysis/compare-builds-perf.test.ts packages/calc/test/analysis/sustained-dps.test.ts
git commit -m "$(cat <<'EOF'
feat: add ChampionSchema.provenance, resolve the enchant-slot TODO-VERIFY

Champion skeletons need a way to declare verifiedInGame: false, same as
items already can. Also resolves HAS_SEPARATE_ENCHANT_SLOT to false per
2026-09-17 in-game confirmation: WR removed the boot-enchant mechanic.
EOF
)"
```

---

### Task 2: Item skeletons

**Files:**
- Create: `packages/data/src/patches/7.3/provenance.ts`
- Create: `packages/data/src/patches/7.3/items.ts`
- Test: `packages/data/test/items.test.ts`

**Interfaces:**
- Produces: `PATCH_7_3_PROVENANCE: Provenance` (`{ source: 'manual', patch: '7.3', verifiedInGame: false }`); `PATCH_7_3_ITEMS: Item[]`, 15 items with ids: `long-sword`, `bf-sword`, `blasting-wand`, `rabadons-deathcap`, `blade-of-the-ruined-king`, `trinity-force`, `liandrys-torment`, `void-staff`, `black-cleaver`, `infinity-edge`, `navori-quickblades`, `heartsteel`, `seraphs-embrace`, `plated-steelcaps`, `force-of-nature`.
- Consumes: `Item`, `Provenance`, `ItemSchema` from `@wr-calc/schema` (already published, no earlier task in this plan touches it further). Independent of Task 1 (touches a different package) but the branch should have Task 1 merged in first per this plan's order.

- [ ] **Step 1: Write the failing conformance test**

```typescript
// packages/data/test/items.test.ts
import { describe, it, expect } from 'vitest'
import { ItemSchema } from '@wr-calc/schema'
import { PATCH_7_3_ITEMS } from '../src/patches/7.3/items'

const EXPECTED_IDS = [
  'long-sword', 'bf-sword', 'blasting-wand', 'rabadons-deathcap', 'blade-of-the-ruined-king',
  'trinity-force', 'liandrys-torment', 'void-staff', 'black-cleaver', 'infinity-edge',
  'navori-quickblades', 'heartsteel', 'seraphs-embrace', 'plated-steelcaps', 'force-of-nature',
].sort()

describe('PATCH_7_3_ITEMS', () => {
  it('has exactly the 15 starter items', () => {
    expect(PATCH_7_3_ITEMS.map((item) => item.id).sort()).toEqual(EXPECTED_IDS)
  })

  it('every item parses against ItemSchema', () => {
    for (const item of PATCH_7_3_ITEMS) {
      expect(() => ItemSchema.parse(item), item.id).not.toThrow()
    }
  })

  it('every item cost is internally consistent (recipe: [], so combine === total)', () => {
    for (const item of PATCH_7_3_ITEMS) {
      expect(item.recipe, item.id).toEqual([])
      expect(item.cost.combine, item.id).toBe(item.cost.total)
    }
  })

  it('every item is marked unverified for patch 7.3', () => {
    for (const item of PATCH_7_3_ITEMS) {
      expect(item.provenance, item.id).toEqual({
        source: 'manual', patch: '7.3', verifiedInGame: false,
      })
    }
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd packages/data && npx vitest run test/items.test.ts`
Expected: FAIL — cannot resolve `../src/patches/7.3/items` (module doesn't exist yet).

- [ ] **Step 3: Implement the provenance constant and the 15 items**

```typescript
// packages/data/src/patches/7.3/provenance.ts
import type { Provenance } from '@wr-calc/schema'

/** Every patch-7.3 skeleton is unverified until the user checks it in-game. */
export const PATCH_7_3_PROVENANCE: Provenance = {
  source: 'manual', patch: '7.3', verifiedInGame: false,
}
```

```typescript
// packages/data/src/patches/7.3/items.ts
import type { Item } from '@wr-calc/schema'
import { PATCH_7_3_PROVENANCE } from './provenance'

export const PATCH_7_3_ITEMS: Item[] = [
  {
    id: 'long-sword', name: 'Long Sword', tier: 'basic',
    cost: { total: 350, combine: 350 }, recipe: [],
    stats: { ad: null }, effects: [], tags: ['physical'],
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'bf-sword', name: 'B.F. Sword', tier: 'basic',
    cost: { total: 1300, combine: 1300 }, recipe: [],
    stats: { ad: null }, effects: [], tags: ['physical'],
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'blasting-wand', name: 'Blasting Wand', tier: 'basic',
    cost: { total: 850, combine: 850 }, recipe: [],
    stats: { ap: null }, effects: [], tags: ['magic'],
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'rabadons-deathcap', name: "Rabadon's Deathcap", tier: 'legendary',
    cost: { total: 2950, combine: 2950 }, recipe: [],
    stats: { ap: null }, tags: ['magic'],
    effects: [{
      kind: 'statMultiplier', id: 'rabadons-deathcap-magic-opus', name: 'Magic Opus',
      description: 'Increases total ability power.', support: 'full',
      stat: 'ap', layer: 'total', amount: null,
    }],
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'blade-of-the-ruined-king', name: 'Blade of the Ruined King', tier: 'legendary',
    cost: { total: 3200, combine: 3200 }, recipe: [],
    stats: { ad: null, attackSpeed: null, lifesteal: null }, tags: ['physical', 'on-hit'],
    effects: [{
      kind: 'onHit', id: 'botrk-mists-edge', name: "Mist's Edge",
      description: 'On-hit: deals physical damage equal to a percent of the target\'s current HP.',
      support: 'full',
      damageType: 'physical', pctTargetCurrentHp: null, minDamage: null, maxDamage: null,
      monsterCap: null,
    }],
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'trinity-force', name: 'Trinity Force', tier: 'legendary',
    cost: { total: 3333, combine: 3333 }, recipe: [],
    stats: { ad: null, attackSpeed: null, abilityHaste: null, hp: null }, tags: ['physical'],
    effects: [{
      kind: 'spellblade', id: 'trinity-force-spellblade', name: 'Spellblade',
      description: 'After using an ability, the next basic attack deals bonus physical damage.',
      support: 'full',
      damageType: 'physical', bonusDamage: null,
      ratios: [{ stat: 'totalAd', value: null }], internalCooldownSeconds: null,
    }],
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'liandrys-torment', name: "Liandry's Torment", tier: 'legendary',
    cost: { total: 2900, combine: 2900 }, recipe: [],
    stats: { ap: null, hp: null, abilityHaste: null }, tags: ['magic'],
    effects: [{
      kind: 'dot', id: 'liandrys-torment-dot', name: 'Torment',
      description: 'Ability damage burns the target over time.',
      support: 'partial',
      supportNotes: 'Modeled as a flat/AP-ratio DoT only; the real %-max-health burn component '
        + 'and multi-target stacking are not modeled.',
      damageType: 'magic', tickAmount: null, tickIntervalSeconds: 1, durationSeconds: null,
      refresh: 'refresh',
    }],
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'void-staff', name: 'Void Staff', tier: 'legendary',
    cost: { total: 2650, combine: 2650 }, recipe: [],
    // Unconditional magic pen is a plain stat, not a `penetration`-kind effect (that kind is
    // reserved for conditional pen — see packages/schema/src/effect/kinds/penetration.ts).
    stats: { ap: null, pctMagicPen: null }, effects: [], tags: ['magic'],
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'black-cleaver', name: 'Black Cleaver', tier: 'legendary',
    cost: { total: 3000, combine: 3000 }, recipe: [],
    stats: { ad: null, hp: null, abilityHaste: null }, tags: ['physical'],
    effects: [{
      kind: 'resistShred', id: 'black-cleaver-carve', name: 'Carve',
      description: 'On-hit: reduces the target\'s armor for a few seconds, stacking.',
      support: 'full',
      resist: 'armor', mode: 'percent', amount: null, stacking: true, maxStacks: 6,
      durationSeconds: null,
    }],
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'infinity-edge', name: 'Infinity Edge', tier: 'legendary',
    cost: { total: 3400, combine: 3400 }, recipe: [],
    stats: { ad: null, critChance: null, critDamage: null }, effects: [], tags: ['physical', 'crit'],
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'navori-quickblades', name: 'Navori Quickblades', tier: 'legendary',
    cost: { total: 3400, combine: 3400 }, recipe: [],
    stats: { ad: null, critChance: null, attackSpeed: null }, tags: ['physical', 'crit'],
    effects: [{
      kind: 'cooldownRefund', id: 'navori-untold-determination', name: 'Untold Determination',
      description: 'Critical strikes refund a percent of ability cooldowns, including the ultimate.',
      support: 'full',
      mode: 'percent', amount: null, excludesUltimate: false,
    }],
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'heartsteel', name: 'Heartsteel', tier: 'legendary',
    cost: { total: 3000, combine: 3000 }, recipe: [],
    stats: { hp: null }, tags: ['tank', 'on-hit'],
    effects: [
      {
        kind: 'stacking', id: 'heartsteel-vigor', name: 'Vigor',
        description: 'Gains stacking bonus health from takedowns and objectives.',
        support: 'partial',
        supportNotes: 'Stack count is a manual input here, not auto-accumulated from '
          + 'takedowns/objectives as in-game.',
        stat: 'hp', perStack: null, maxStacks: 20, stackInputId: 'heartsteel-stacks',
        inputs: [{
          type: 'stackCount', id: 'heartsteel-stacks', label: 'Heartsteel stacks',
          min: 0, max: 20, default: 0,
        }],
      },
      {
        kind: 'onHit', id: 'heartsteel-repurpose', name: 'Repurpose',
        description: 'On-hit: deals bonus physical damage scaling with bonus health.',
        support: 'full',
        damageType: 'physical', pctOwnStat: { stat: 'hp', ratio: null },
      },
    ],
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'seraphs-embrace', name: "Seraph's Embrace", tier: 'legendary',
    cost: { total: 3000, combine: 3000 }, recipe: [],
    stats: { ap: null, mana: null }, tags: ['magic'],
    effects: [
      {
        kind: 'statConversion', id: 'seraphs-embrace-focused-will', name: 'Focused Will',
        description: 'Grants ability power equal to a percent of maximum mana.',
        support: 'full',
        fromStat: 'mana', toStat: 'ap', ratio: null,
      },
      {
        kind: 'shield', id: 'seraphs-embrace-bottomless-well', name: 'Bottomless Well',
        description: 'Active: grants a shield scaling with maximum mana.',
        support: 'partial',
        supportNotes: 'Modeled as a manually toggled shield; the real active\'s cast time and '
          + 'cooldown interaction are not modeled.',
        amount: null, durationSeconds: null,
        condition: { type: 'toggle', inputId: 'seraphs-embrace-shield-used' },
        inputs: [{
          type: 'boolean', id: 'seraphs-embrace-shield-used',
          label: "Seraph's Embrace shield used", default: false,
        }],
      },
    ],
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'plated-steelcaps', name: 'Plated Steelcaps', tier: 'boots',
    cost: { total: 1100, combine: 1100 }, recipe: [],
    stats: { armor: null, moveSpeed: null }, tags: ['boots', 'defense'],
    effects: [{
      kind: 'damageReduction', id: 'plated-steelcaps-reinforced-armor', name: 'Reinforced Armor',
      description: 'Reduces incoming damage from basic attacks.',
      support: 'partial',
      supportNotes: 'Modeled as reducing all physical damage; the real passive only reduces '
        + 'basic-attack damage specifically.',
      damageType: 'physical', amount: null,
    }],
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'force-of-nature', name: 'Force of Nature', tier: 'legendary',
    cost: { total: 2800, combine: 2800 }, recipe: [],
    stats: { mr: null, moveSpeedPct: null, hpRegen: null }, effects: [],
    tags: ['magic-resist'],
    provenance: PATCH_7_3_PROVENANCE,
  },
]
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `cd packages/data && npx vitest run test/items.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full monorepo test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/data/src/patches/7.3/provenance.ts packages/data/src/patches/7.3/items.ts \
  packages/data/test/items.test.ts
git commit -m "feat: add patch 7.3 starter item skeletons"
```

---

### Task 3: Champion skeletons

**Files:**
- Create: `packages/data/src/patches/7.3/champions.ts`
- Test: `packages/data/test/champions.test.ts`

**Interfaces:**
- Produces: `PATCH_7_3_CHAMPIONS: Champion[]`, 4 champions with ids `nunu-willump`, `rammus`, `annie`, `jinx`.
- Consumes: `Champion`, `ChampionSchema` from `@wr-calc/schema`; `PATCH_7_3_PROVENANCE` from `./provenance` (Task 2).

- [ ] **Step 1: Write the failing conformance test**

```typescript
// packages/data/test/champions.test.ts
import { describe, it, expect } from 'vitest'
import { ChampionSchema } from '@wr-calc/schema'
import { PATCH_7_3_CHAMPIONS } from '../src/patches/7.3/champions'

describe('PATCH_7_3_CHAMPIONS', () => {
  it('has exactly the 4 starter champions', () => {
    expect(PATCH_7_3_CHAMPIONS.map((c) => c.id).sort()).toEqual(
      ['annie', 'jinx', 'nunu-willump', 'rammus']
    )
  })

  it('every champion parses against ChampionSchema', () => {
    for (const champion of PATCH_7_3_CHAMPIONS) {
      expect(() => ChampionSchema.parse(champion), champion.id).not.toThrow()
    }
  })

  it('every champion declares all 5 ability slots with non-empty ids', () => {
    for (const champion of PATCH_7_3_CHAMPIONS) {
      for (const key of ['passive', 'q', 'w', 'e', 'r'] as const) {
        expect(champion.abilities[key].id, `${champion.id}.${key}`).not.toBe('')
      }
    }
  })

  it('every champion is marked unverified for patch 7.3', () => {
    for (const champion of PATCH_7_3_CHAMPIONS) {
      expect(champion.provenance, champion.id).toEqual({
        source: 'manual', patch: '7.3', verifiedInGame: false,
      })
    }
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd packages/data && npx vitest run test/champions.test.ts`
Expected: FAIL — cannot resolve `../src/patches/7.3/champions`.

- [ ] **Step 3: Implement the 4 champions**

```typescript
// packages/data/src/patches/7.3/champions.ts
import type { Champion } from '@wr-calc/schema'
import { PATCH_7_3_PROVENANCE } from './provenance'

export const PATCH_7_3_CHAMPIONS: Champion[] = [
  {
    id: 'nunu-willump', name: 'Nunu & Willump', resource: 'mana',
    baseStats: {
      hp: { base: 610, perLevel: 90 }, hpRegen: { base: 8, perLevel: 0.8 },
      mana: { base: 280, perLevel: 40 }, manaRegen: { base: 7, perLevel: 0.6 },
      ad: { base: 60, perLevel: 3 }, armor: { base: 32, perLevel: 4 },
      mr: { base: 30, perLevel: 1.3 }, moveSpeed: { base: 345, perLevel: 0 },
    },
    attackSpeed: { base: 0.625, ratio: 0.025 },
    abilities: {
      passive: {
        id: 'nunu-passive', name: 'Call of the Freljord', maxRank: 1,
        cooldown: null, castTime: 0, damage: [], flags: {},
      },
      q: {
        id: 'nunu-q', name: 'Consume', maxRank: 5,
        cooldown: null, cost: null, castTime: 0.5, flags: {},
        damage: [{ type: 'magic', base: null, ratios: [{ stat: 'ap', value: null }], hits: 1, tags: ['consume'] }],
      },
      w: {
        id: 'nunu-w', name: 'Biggest Snowball Ever!', maxRank: 5,
        cooldown: null, cost: null, castTime: 0, damage: [], flags: {},
      },
      e: {
        id: 'nunu-e', name: 'Snowball Barrage', maxRank: 5,
        cooldown: null, cost: null, castTime: 0.25, flags: {},
        damage: [{ type: 'magic', base: null, ratios: [{ stat: 'ap', value: null }], hits: 3, tags: [] }],
      },
      r: {
        id: 'nunu-r', name: 'Absolute Zero', maxRank: 3,
        cooldown: null, cost: null, castTime: 3, flags: {},
        damage: [{ type: 'magic', base: null, ratios: [{ stat: 'ap', value: null }], tags: ['channel'] }],
      },
    },
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'rammus', name: 'Rammus', resource: 'mana',
    baseStats: {
      hp: { base: 600, perLevel: 95 }, hpRegen: { base: 9, perLevel: 0.9 },
      mana: { base: 250, perLevel: 35 }, manaRegen: { base: 7, perLevel: 0.6 },
      ad: { base: 68, perLevel: 3.5 }, armor: { base: 36, perLevel: 4.2 },
      mr: { base: 32, perLevel: 1.3 }, moveSpeed: { base: 335, perLevel: 0 },
    },
    attackSpeed: { base: 0.65, ratio: 0.03 },
    abilities: {
      passive: {
        id: 'rammus-passive', name: 'Spiked Shell', maxRank: 1,
        cooldown: null, castTime: 0, damage: [], flags: { appliesOnHit: true },
      },
      q: {
        id: 'rammus-q', name: 'Powerball', maxRank: 5,
        cooldown: null, cost: null, castTime: 0, flags: {},
        damage: [{ type: 'magic', base: null, ratios: [{ stat: 'ap', value: null }], tags: ['impact'] }],
      },
      w: {
        id: 'rammus-w', name: 'Defensive Ball Curl', maxRank: 5,
        cooldown: null, cost: null, castTime: 0, damage: [], flags: { appliesOnHit: true },
      },
      e: {
        id: 'rammus-e', name: 'Frenzying Taunt', maxRank: 5,
        cooldown: null, cost: null, castTime: 0.25, damage: [], flags: {},
      },
      r: {
        id: 'rammus-r', name: 'Soaring Slam', maxRank: 3,
        cooldown: null, cost: null, castTime: 0.5, flags: {},
        damage: [{ type: 'magic', base: null, ratios: [{ stat: 'ap', value: null }], tags: [] }],
      },
    },
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'annie', name: 'Annie', resource: 'mana',
    baseStats: {
      hp: { base: 560, perLevel: 90 }, hpRegen: { base: 6, perLevel: 0.6 },
      mana: { base: 450, perLevel: 35 }, manaRegen: { base: 8, perLevel: 0.7 },
      ad: { base: 50, perLevel: 3 }, armor: { base: 20, perLevel: 3.8 },
      mr: { base: 30, perLevel: 1.3 }, moveSpeed: { base: 325, perLevel: 0 },
    },
    attackSpeed: { base: 0.625, ratio: 0.02 },
    abilities: {
      passive: {
        id: 'annie-passive', name: 'Pyromania', maxRank: 1,
        cooldown: null, castTime: 0, damage: [], flags: {},
      },
      q: {
        id: 'annie-q', name: 'Disintegrate', maxRank: 5,
        cooldown: null, cost: null, castTime: 0.25, flags: {},
        damage: [{ type: 'magic', base: null, ratios: [{ stat: 'ap', value: null }], tags: [] }],
      },
      w: {
        id: 'annie-w', name: 'Incinerate', maxRank: 5,
        cooldown: null, cost: null, castTime: 0.25, flags: {},
        damage: [{ type: 'magic', base: null, ratios: [{ stat: 'ap', value: null }], tags: ['aoe'] }],
      },
      e: {
        id: 'annie-e', name: 'Molten Shield', maxRank: 5,
        cooldown: null, cost: null, castTime: 0.25, damage: [], flags: {},
      },
      r: {
        id: 'annie-r', name: 'Summon: Tibbers', maxRank: 3,
        cooldown: null, cost: null, castTime: 0.25, flags: {},
        damage: [{ type: 'magic', base: null, ratios: [{ stat: 'ap', value: null }], tags: ['summon-initial'] }],
      },
    },
    provenance: PATCH_7_3_PROVENANCE,
  },
  {
    id: 'jinx', name: 'Jinx', resource: 'mana',
    baseStats: {
      hp: { base: 580, perLevel: 100 }, hpRegen: { base: 5.5, perLevel: 0.55 },
      mana: { base: 260, perLevel: 45 }, manaRegen: { base: 6, perLevel: 0.6 },
      ad: { base: 57, perLevel: 3.4 }, armor: { base: 26, perLevel: 4.7 },
      mr: { base: 30, perLevel: 1.3 }, moveSpeed: { base: 325, perLevel: 0 },
    },
    attackSpeed: { base: 0.625, ratio: 0.03 },
    abilities: {
      passive: {
        id: 'jinx-passive', name: 'Get Excited!', maxRank: 1,
        cooldown: null, castTime: 0, damage: [], flags: {},
      },
      q: {
        id: 'jinx-q', name: 'Switcheroo!', maxRank: 5,
        cooldown: null, cost: null, castTime: 0, damage: [], flags: {},
      },
      w: {
        id: 'jinx-w', name: 'Zap!', maxRank: 5,
        cooldown: null, cost: null, castTime: 0.25, flags: {},
        damage: [{ type: 'physical', base: null, ratios: [{ stat: 'totalAd', value: null }], tags: [] }],
      },
      e: {
        id: 'jinx-e', name: 'Flame Chompers!', maxRank: 5,
        cooldown: null, cost: null, castTime: 0.25, flags: {},
        damage: [{ type: 'physical', base: null, ratios: [{ stat: 'bonusAd', value: null }], tags: ['trap'] }],
      },
      r: {
        id: 'jinx-r', name: 'Super Mega Death Rocket!', maxRank: 3,
        cooldown: null, cost: null, castTime: 0.5, flags: {},
        damage: [{ type: 'physical', base: null, ratios: [{ stat: 'bonusAd', value: null }], tags: ['execute'] }],
      },
    },
    provenance: PATCH_7_3_PROVENANCE,
  },
]
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `cd packages/data && npx vitest run test/champions.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full monorepo test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/data/src/patches/7.3/champions.ts packages/data/test/champions.test.ts
git commit -m "feat: add patch 7.3 starter champion skeletons"
```

---

### Task 4: Catalog builder and package wiring

**Files:**
- Modify: `packages/data/package.json` (add `@wr-calc/calc` dependency + `test` script)
- Modify: `packages/data/tsconfig.json` (add `../calc` project reference)
- Create: `packages/data/src/catalog.ts`
- Create: `packages/data/src/patches/7.3/index.ts`
- Modify: `packages/data/src/index.ts`
- Test: `packages/data/test/catalog.test.ts`

**Interfaces:**
- Produces: `buildCatalog(items: Item[], runes?: Rune[]): StatCatalog`; `PATCH_7_3_CATALOG: StatCatalog` (built from `PATCH_7_3_ITEMS`, no runes).
- Consumes: `StatCatalog` from `@wr-calc/calc` (new cross-package dependency, added in Step 1 below); `PATCH_7_3_ITEMS` (Task 2), `PATCH_7_3_CHAMPIONS`/`PATCH_7_3_PROVENANCE` re-exported for convenience (Tasks 2-3).

- [ ] **Step 1: Add the `@wr-calc/calc` dependency**

```json
// packages/data/package.json
{
  "name": "@wr-calc/data",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": { "test": "vitest run" },
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@wr-calc/schema": "workspace:*",
    "@wr-calc/calc": "workspace:*"
  }
}
```

```json
// packages/data/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"],
  "references": [{ "path": "../schema" }, { "path": "../calc" }]
}
```

Run: `pnpm install` (from repo root)
Expected: completes without error; `packages/data/node_modules/@wr-calc/calc` now exists (symlinked to `packages/calc`).

- [ ] **Step 2: Write the failing catalog test**

```typescript
// packages/data/test/catalog.test.ts
import { describe, it, expect } from 'vitest'
import { buildCatalog } from '../src/catalog'
import { PATCH_7_3_ITEMS } from '../src/patches/7.3/items'
import { PATCH_7_3_CATALOG } from '../src/patches/7.3'

describe('buildCatalog', () => {
  it('indexes items by id', () => {
    const catalog = buildCatalog(PATCH_7_3_ITEMS)
    expect(catalog.items.get('long-sword')?.name).toBe('Long Sword')
  })

  it('defaults to an empty rune map when none are given', () => {
    const catalog = buildCatalog(PATCH_7_3_ITEMS)
    expect(catalog.runes.size).toBe(0)
  })
})

describe('PATCH_7_3_CATALOG', () => {
  it('contains every patch 7.3 starter item', () => {
    expect(PATCH_7_3_CATALOG.items.size).toBe(PATCH_7_3_ITEMS.length)
  })
})
```

- [ ] **Step 3: Run the test and confirm it fails**

Run: `cd packages/data && npx vitest run test/catalog.test.ts`
Expected: FAIL — cannot resolve `../src/catalog` and `../src/patches/7.3`.

- [ ] **Step 4: Implement the catalog builder and the patch barrel**

```typescript
// packages/data/src/catalog.ts
import type { Item, Rune } from '@wr-calc/schema'
import type { StatCatalog } from '@wr-calc/calc'

/** Builds a StatCatalog (item/rune id -> object maps) from flat arrays. */
export function buildCatalog(items: Item[], runes: Rune[] = []): StatCatalog {
  return {
    items: new Map(items.map((item) => [item.id, item])),
    runes: new Map(runes.map((rune) => [rune.id, rune])),
  }
}
```

```typescript
// packages/data/src/patches/7.3/index.ts
import { buildCatalog } from '../../catalog'
import { PATCH_7_3_ITEMS } from './items'

export * from './provenance'
export * from './items'
export * from './champions'

export const PATCH_7_3_CATALOG = buildCatalog(PATCH_7_3_ITEMS, [])
```

```typescript
// packages/data/src/index.ts
export * from './patches/7.3'
export * from './catalog'
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `cd packages/data && npx vitest run test/catalog.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Run the full monorepo test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/data/package.json packages/data/tsconfig.json packages/data/src/catalog.ts \
  packages/data/src/patches/7.3/index.ts packages/data/src/index.ts packages/data/test/catalog.test.ts \
  pnpm-lock.yaml
git commit -m "feat: add patch 7.3 catalog builder and package exports"
```

---

### Task 5: Golden runner

**Files:**
- Create: `packages/data/src/golden-types.ts`
- Create: `packages/data/src/golden-runner.ts`
- Create: `packages/data/golden/README.md`
- Test: `packages/data/test/golden-runner.test.ts`
- Test: `packages/data/test/golden.test.ts`
- Modify: `packages/data/src/index.ts`

**Interfaces:**
- Produces: `GoldenCase`/`GoldenScenario`/`GoldenExpected` types + `GoldenCaseSchema` (from `golden-types.ts`); `loadGoldenCases(dir: string): { file: string; case: GoldenCase }[]` and `runGoldenCase(goldenCase: GoldenCase, champions: Map<string, Champion>, catalog: StatCatalog): { passed: boolean; failures: string[] }` (from `golden-runner.ts`).
- Consumes: `combatantFromChampion`, `combatantFromDummy`, `simulateCombo`, `ComboAction`, `StatCatalog` from `@wr-calc/calc` (dependency added in Task 4); `BuildSchema`, `Champion` from `@wr-calc/schema`; `PATCH_7_3_CHAMPIONS`, `PATCH_7_3_CATALOG` from Tasks 3-4.

- [ ] **Step 1: Write the failing runner unit tests**

```typescript
// packages/data/test/golden-runner.test.ts
import { describe, it, expect } from 'vitest'
import { combatantFromChampion, combatantFromDummy, simulateCombo } from '@wr-calc/calc'
import type { ComboAction } from '@wr-calc/calc'
import { runGoldenCase, loadGoldenCases } from '../src/golden-runner'
import type { GoldenCase } from '../src/golden-types'
import { PATCH_7_3_CHAMPIONS } from '../src/patches/7.3/champions'
import { PATCH_7_3_CATALOG } from '../src/patches/7.3'

const champions = new Map(PATCH_7_3_CHAMPIONS.map((champion) => [champion.id, champion]))
const nunu = champions.get('nunu-willump')!
const scenario: GoldenCase['scenario'] = {
  championId: 'nunu-willump', level: 1,
  build: { items: [], runes: [], inputs: {} },
  target: { hp: 1000, armor: 0, mr: 0 },
  combo: ['AA'],
}

function actualTotalDamage(): number {
  const attacker = combatantFromChampion(nunu, scenario.level, scenario.build, PATCH_7_3_CATALOG)
  const target = combatantFromDummy({ kind: 'dummy', ...scenario.target })
  const result = simulateCombo(
    attacker, target, scenario.combo as ComboAction[], { critMode: 'expected' }
  )
  return Object.values(result.totalsByType).reduce((sum, value) => sum + (value ?? 0), 0)
}

describe('runGoldenCase', () => {
  it('passes trivially when no fields are asserted', () => {
    const goldenCase: GoldenCase = {
      scenario, expected: {}, tolerance: 0.01, patch: '7.3', source: 'practice-tool',
    }
    expect(runGoldenCase(goldenCase, champions, PATCH_7_3_CATALOG).passed).toBe(true)
  })

  it('passes when expected matches the real simulateCombo result within tolerance', () => {
    const goldenCase: GoldenCase = {
      scenario, expected: { totalDamage: actualTotalDamage() }, tolerance: 0.01,
      patch: '7.3', source: 'practice-tool',
    }
    expect(runGoldenCase(goldenCase, champions, PATCH_7_3_CATALOG).passed).toBe(true)
  })

  it('fails with a descriptive message when expected is outside tolerance', () => {
    const goldenCase: GoldenCase = {
      scenario, expected: { totalDamage: actualTotalDamage() + 1000 }, tolerance: 0.01,
      patch: '7.3', source: 'practice-tool',
    }
    const result = runGoldenCase(goldenCase, champions, PATCH_7_3_CATALOG)
    expect(result.passed).toBe(false)
    expect(result.failures[0]).toContain('totalDamage')
  })

  it('fails with a clear message for an unknown championId', () => {
    const goldenCase: GoldenCase = {
      scenario: { ...scenario, championId: 'does-not-exist' }, expected: {}, tolerance: 0.01,
      patch: '7.3', source: 'practice-tool',
    }
    const result = runGoldenCase(goldenCase, champions, PATCH_7_3_CATALOG)
    expect(result.passed).toBe(false)
    expect(result.failures[0]).toContain('does-not-exist')
  })
})

describe('loadGoldenCases', () => {
  it('returns an empty array when the directory has no *.json case files', () => {
    // packages/data/golden/ has no committed cases yet (see golden/README.md) — this locks in
    // "no real cases yet" as a supported, non-error state, per the Step 6 design doc.
    expect(loadGoldenCases(new URL('../golden', import.meta.url).pathname)).toEqual([])
  })

  it('returns an empty array when the directory does not exist', () => {
    expect(loadGoldenCases('/does/not/exist')).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd packages/data && npx vitest run test/golden-runner.test.ts`
Expected: FAIL — cannot resolve `../src/golden-runner` and `../src/golden-types`.

- [ ] **Step 3: Implement the golden case types**

```typescript
// packages/data/src/golden-types.ts
import { z } from 'zod'
import { BuildSchema } from '@wr-calc/schema'

const COMBO_ACTION_PATTERN = /^(AA|Q|W|E|R|item:.+|wait:\d+(\.\d+)?)$/

export const GoldenScenarioSchema = z.object({
  championId: z.string(),
  level: z.number(),
  build: BuildSchema,
  target: z.object({ hp: z.number(), armor: z.number(), mr: z.number() }).strict(),
  combo: z.array(z.string().regex(COMBO_ACTION_PATTERN)),
}).strict()
export type GoldenScenario = z.infer<typeof GoldenScenarioSchema>

export const GoldenExpectedSchema = z.object({
  timeToKill: z.number().optional(),
  totalDamage: z.number().optional(),
}).strict()
export type GoldenExpected = z.infer<typeof GoldenExpectedSchema>

export const GoldenCaseSchema = z.object({
  scenario: GoldenScenarioSchema,
  expected: GoldenExpectedSchema,
  tolerance: z.number().positive(),
  patch: z.string(),
  source: z.literal('practice-tool'),
}).strict()
export type GoldenCase = z.infer<typeof GoldenCaseSchema>
```

- [ ] **Step 4: Implement the runner**

```typescript
// packages/data/src/golden-runner.ts
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Champion } from '@wr-calc/schema'
import type { StatCatalog, ComboAction } from '@wr-calc/calc'
import { combatantFromChampion, combatantFromDummy, simulateCombo } from '@wr-calc/calc'
import { GoldenCaseSchema } from './golden-types'
import type { GoldenCase } from './golden-types'

export interface LoadedGoldenCase {
  file: string
  case: GoldenCase
}

/** Reads and validates every *.json golden case in a directory. Missing/empty dir -> []. */
export function loadGoldenCases(dir: string): LoadedGoldenCase[] {
  let files: string[]
  try {
    files = readdirSync(dir).filter((name) => name.endsWith('.json'))
  } catch {
    return []
  }
  return files.map((file) => {
    const raw: unknown = JSON.parse(readFileSync(join(dir, file), 'utf-8'))
    return { file, case: GoldenCaseSchema.parse(raw) }
  })
}

export interface GoldenRunResult {
  passed: boolean
  failures: string[]
}

/** Runs one golden case's scenario through simulateCombo, checking every declared expected field within tolerance. */
export function runGoldenCase(
  goldenCase: GoldenCase, champions: Map<string, Champion>, catalog: StatCatalog
): GoldenRunResult {
  const champion = champions.get(goldenCase.scenario.championId)
  if (!champion) {
    return { passed: false, failures: [`unknown championId '${goldenCase.scenario.championId}'`] }
  }
  const attacker = combatantFromChampion(
    champion, goldenCase.scenario.level, goldenCase.scenario.build, catalog
  )
  const target = combatantFromDummy({ kind: 'dummy', ...goldenCase.scenario.target })
  const result = simulateCombo(
    attacker, target, goldenCase.scenario.combo as ComboAction[], { critMode: 'expected' }
  )

  const failures: string[] = []
  const check = (label: string, actual: number | undefined, expected: number | undefined): void => {
    if (expected === undefined) return
    if (actual === undefined) {
      failures.push(`${label}: expected ${expected}, got undefined`)
      return
    }
    const allowed = Math.abs(expected) * goldenCase.tolerance
    if (Math.abs(actual - expected) > allowed) {
      failures.push(`${label}: expected ${expected} (±${goldenCase.tolerance * 100}%), got ${actual}`)
    }
  }

  const totalDamage = Object.values(result.totalsByType).reduce((sum, value) => sum + (value ?? 0), 0)
  check('timeToKill', result.timeToKill, goldenCase.expected.timeToKill)
  check('totalDamage', totalDamage, goldenCase.expected.totalDamage)

  return { passed: failures.length === 0, failures }
}
```

- [ ] **Step 5: Run the unit tests and confirm they pass**

Run: `cd packages/data && npx vitest run test/golden-runner.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Write the golden case format doc**

```markdown
<!-- packages/data/golden/README.md -->
# Golden test cases

Real, in-game-verified combat scenarios that `packages/data/test/golden.test.ts` checks the
engine against. Empty today (see `docs/superpowers/specs/2026-09-17-phase1-step6-real-data-golden-runner-design.md`)
— `loadGoldenCases` returns `[]` for an empty directory, so the runner test file runs zero
dynamic tests until the first real `*.json` case is added here. That's expected, not broken.

## Format

Each case is a `*.json` file matching `GoldenCaseSchema` (`packages/data/src/golden-types.ts`):

```json
{
  "scenario": {
    "championId": "nunu-willump",
    "level": 6,
    "build": { "items": ["long-sword"], "runes": [], "inputs": {} },
    "target": { "hp": 1000, "armor": 40, "mr": 30 },
    "combo": ["AA", "Q", "AA"]
  },
  "expected": { "totalDamage": 214, "timeToKill": 3.1 },
  "tolerance": 0.02,
  "patch": "7.3",
  "source": "practice-tool"
}
```

- `scenario`: enough to build a `Combatant` (via `combatantFromChampion`) and a dummy target,
  then run `simulateCombo`. `combo` uses the same `ComboAction` strings as `simulateCombo` itself
  (`'AA' | 'Q' | 'W' | 'E' | 'R' | 'item:<id>' | 'wait:<seconds>'`).
- `expected`: only include the fields you actually measured in the practice tool —
  `runGoldenCase` skips any field left out. Currently supported: `totalDamage`, `timeToKill`.
- `tolerance`: fraction, e.g. `0.02` = allow ±2%.
- `patch`: which `patches/<version>/` catalog to resolve the scenario's items/champion against.
- `source`: must be `"practice-tool"` — this is how a real, verified case is distinguished from
  anything else that might exist in this directory.

To add a case: play the scenario in the Wild Rift practice tool, record the real numbers, and
drop a new `*.json` file in this directory. No code changes needed — `golden.test.ts` picks it up
automatically.
```

- [ ] **Step 7: Write the integration runner and re-export from the package index**

```typescript
// packages/data/test/golden.test.ts
import { describe, it, expect } from 'vitest'
import { loadGoldenCases, runGoldenCase } from '../src/golden-runner'
import { PATCH_7_3_CHAMPIONS } from '../src/patches/7.3/champions'
import { PATCH_7_3_CATALOG } from '../src/patches/7.3'

const GOLDEN_DIR = new URL('../golden', import.meta.url).pathname
const champions = new Map(PATCH_7_3_CHAMPIONS.map((champion) => [champion.id, champion]))
const cases = loadGoldenCases(GOLDEN_DIR)

describe.each(cases)('golden case: $file', ({ file, case: goldenCase }) => {
  it(`matches simulateCombo within tolerance (${file})`, () => {
    const result = runGoldenCase(goldenCase, champions, PATCH_7_3_CATALOG)
    expect(result.passed, result.failures.join('; ')).toBe(true)
  })
})
```

```typescript
// packages/data/src/index.ts
export * from './patches/7.3'
export * from './catalog'
export * from './golden-types'
export * from './golden-runner'
```

- [ ] **Step 8: Run the full monorepo test suite**

Run: `npm test`
Expected: PASS. `golden.test.ts` contributes 0 tests (empty `describe.each`); every other file
unchanged or green.

- [ ] **Step 9: Commit**

```bash
git add packages/data/src/golden-types.ts packages/data/src/golden-runner.ts \
  packages/data/src/index.ts packages/data/golden/README.md \
  packages/data/test/golden-runner.test.ts packages/data/test/golden.test.ts
git commit -m "feat: add golden test case runner (zero real cases yet)"
```

---

## Self-Review

**Spec coverage:** §1 (starter set) — Tasks 2-3. §2 (schema changes) — Task 1. §3 (data package
layout, dropping `fixtures/`) — Tasks 2-4 (no `fixtures/` directory created). §4 (golden runner) —
Task 5. §5 (testing plan) — a conformance test per data file (Tasks 2-3), catalog test (Task 4),
runner unit + integration tests (Task 5), 7-file fixture fix-up (Task 1). §6 (out of scope) — no
task touches runes, real stat values, `Build.enchant`, or the debug page. All covered.

**Placeholder scan:** no `TBD`/`TODO-fill-in`/"similar to Task N" found — every step has real,
complete code. The project's own `TODO-VERIFY` convention appears only where the *existing*
`rules.ts` file already uses it (Task 1, editing an existing comment), not as a stand-in for
missing plan content.

**Type consistency:** `StatCatalog` (Task 4's `buildCatalog` return type) matches the shape
`resolveStats`/`combatantFromChampion` already consume (`{ items: Map<string, Item>, runes: Map<string, Rune> }`,
confirmed against `packages/calc/src/resolve-stats.ts`). `GoldenCase`/`GoldenScenario`/`GoldenExpected`
(Task 5) are used with matching field names and types in both `golden-runner.test.ts` and
`golden.test.ts`. `PATCH_7_3_PROVENANCE` (Task 2) is imported with the same name into
`champions.ts` (Task 3). `runGoldenCase`'s third parameter is `StatCatalog`, matching what
`PATCH_7_3_CATALOG` (Task 4) actually is.
