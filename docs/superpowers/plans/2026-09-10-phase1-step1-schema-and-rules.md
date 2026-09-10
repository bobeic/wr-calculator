# Phase 1 / Step 1 — Monorepo, Schema, Validator, rules.ts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the pnpm/TypeScript monorepo and build `packages/schema` (Zod schemas for every
data shape the engine needs) plus `packages/calc/src/rules.ts` (best-guess, TODO-VERIFY game
mechanics constants), so later steps have a validated data contract and a single place unverified
mechanics live.

**Architecture:** Four-package pnpm workspace (`schema`, `calc`, `data`, `web`) with TypeScript
project references enforcing `schema → {calc, data} → web`. No per-package build step — packages
export directly from `src/*.ts` via `package.json#main`, resolved through pnpm's workspace
symlinks; Vitest and (later) Next.js transpile TS on the fly. `packages/schema` has zero
dependency on `packages/calc`; its handler-id validation is parameterized so the actual
calc-aware check happens at the one call site allowed to depend on both (`packages/data/scripts/
validate.ts`, built in the Step 6 plan — not this one).

**Tech Stack:** pnpm workspaces (via corepack), TypeScript strict + project references, Zod,
Vitest.

## Global Constraints

- Percentages are fractions (0.25 = 25%).
- Stat keys are a closed enum; unknown keys fail validation.
- Any game value may be a `Scalar`: `number | { byLevel: number[] } | { levelRange: { min, max } }
  | { byRank: number[] }`. Nullability (`| null`) is applied at each usage site, not baked into
  `Scalar` itself.
- Real values not yet entered are `null`; later engine steps treat `null` as `0` and record a
  warning (not this plan's concern — schema just needs to allow `null`).
- No champion or item names in engine code (not applicable to this plan — schema/rules.ts contain
  no item- or champion-specific logic by construction).
- Every `Effect` declares `support: 'full' | 'partial' | 'none'`.
- `rules.ts` constants are best-guess values, each marked `// TODO-VERIFY(<id>)` with a note on
  how to check it in the practice tool. Never scattered elsewhere.
- TypeScript strict mode throughout.
- Docstrings on public functions — one sentence on what it does, not how.
- No dead code, no commented-out blocks.
- Every function that could fail should handle the failure path (schema validation failures
  return/throw structured errors, not silent `undefined`).
- Branch: work on `feat/tvanmook/wr-calc-phase1-step1/20260910` (never commit to `main`).
  Commit prefixes: `feat:`, `fix:`, `test:`, `docs:`, `chore:`. Commit after every task.
- Run the full test suite (`pnpm test`) before the final task's commit.

---

## Task 1: Workspace scaffold

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `tsconfig.json` (root, references only)
- Create: `vitest.config.shared.ts`
- Create: `vitest.workspace.ts`
- Create: `.gitignore`
- Create: `packages/schema/package.json`, `packages/schema/tsconfig.json`,
  `packages/schema/vitest.config.ts`, `packages/schema/src/index.ts`
- Create: `packages/calc/package.json`, `packages/calc/tsconfig.json`,
  `packages/calc/vitest.config.ts`, `packages/calc/src/index.ts`
- Create: `packages/data/package.json`, `packages/data/tsconfig.json`,
  `packages/data/vitest.config.ts`, `packages/data/src/index.ts`

**Interfaces:**
- Produces: three workspace packages (`@wr-calc/schema`, `@wr-calc/calc`, `@wr-calc/data`), each
  resolvable via `import ... from '@wr-calc/<name>'`, each with an empty `src/index.ts` (`export
  {}`) that later tasks fill in. `apps/web` is intentionally NOT scaffolded here — deferred to the
  Step 7 plan — but `apps/*` is already in the workspace glob so it needs no changes later.

- [ ] **Step 1: Create the feature branch**

Run:
```bash
git status
git checkout -b feat/tvanmook/wr-calc-phase1-step1/20260910
```
Expected: `git status` shows a clean tree (only the design doc commit from the prior branch);
`git checkout -b` reports switching to the new branch.

- [ ] **Step 2: Enable pnpm via corepack**

Run:
```bash
corepack enable
corepack prepare pnpm@latest --activate
```
Expected: `pnpm -v` prints a version number.

- [ ] **Step 3: Create root workspace config**

`package.json`:
```json
{
  "name": "wr-calculator",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -b",
    "typecheck": "tsc -b --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

`.gitignore`:
```
node_modules/
dist/
*.tsbuildinfo
.next/
.env
.env.*
```

- [ ] **Step 4: Create shared TypeScript config**

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "composite": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

`tsconfig.json` (root):
```json
{
  "files": [],
  "references": [
    { "path": "packages/schema" },
    { "path": "packages/calc" },
    { "path": "packages/data" }
  ]
}
```

- [ ] **Step 5: Create shared Vitest config**

`vitest.config.shared.ts`:
```ts
import { defineConfig } from 'vitest/config'

export const sharedConfig = defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    passWithNoTests: true,
  },
})
```

`vitest.workspace.ts`:
```ts
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace(['packages/*', 'apps/*'])
```

- [ ] **Step 6: Scaffold `packages/schema`**

`packages/schema/package.json`:
```json
{
  "name": "@wr-calc/schema",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "zod": "^3.23.0"
  }
}
```

`packages/schema/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

`packages/schema/vitest.config.ts`:
```ts
import { sharedConfig } from '../../vitest.config.shared'

export default sharedConfig
```

`packages/schema/src/index.ts`:
```ts
export {}
```

- [ ] **Step 7: Scaffold `packages/calc`**

`packages/calc/package.json`:
```json
{
  "name": "@wr-calc/calc",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@wr-calc/schema": "workspace:*"
  }
}
```

`packages/calc/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"],
  "references": [{ "path": "../schema" }]
}
```

`packages/calc/vitest.config.ts`: identical pattern to schema's (Step 6).

`packages/calc/src/index.ts`:
```ts
export {}
```

- [ ] **Step 8: Scaffold `packages/data`**

`packages/data/package.json`:
```json
{
  "name": "@wr-calc/data",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@wr-calc/schema": "workspace:*"
  }
}
```

`packages/data/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"],
  "references": [{ "path": "../schema" }]
}
```

`packages/data/vitest.config.ts`: identical pattern to schema's (Step 6).

`packages/data/src/index.ts`:
```ts
export {}
```

- [ ] **Step 9: Install and verify**

Run:
```bash
pnpm install
pnpm typecheck
```
Expected: install succeeds; `tsc -b --noEmit` completes with no errors (three empty-but-valid
packages). Do not run `pnpm test` yet — no test files exist until Task 2.

- [ ] **Step 10: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json tsconfig.json \
  vitest.config.shared.ts vitest.workspace.ts .gitignore packages/schema packages/calc packages/data
git commit -m "chore: scaffold pnpm workspace with schema, calc, data packages"
```

---

## Task 2: StatKey and Scalar schemas

**Files:**
- Create: `packages/schema/src/stat-key.ts`
- Create: `packages/schema/src/scalar.ts`
- Test: `packages/schema/test/stat-key.test.ts`
- Test: `packages/schema/test/scalar.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces: `STAT_KEYS: readonly string[]`, `StatKeySchema: ZodEnum`, `StatKey` type,
  `statKeyRecord<T>(valueSchema: T): ZodObject` (a `Partial<Record<StatKey, T>>` builder reused by
  `Item.stats` and `Champion.baseStats` in later tasks), `ScalarSchema`, `NullableScalarSchema`,
  `Scalar` type.

- [ ] **Step 1: Write the failing tests**

`packages/schema/test/stat-key.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { StatKeySchema, STAT_KEYS } from '../src/stat-key'

describe('StatKeySchema', () => {
  it('accepts every declared stat key', () => {
    for (const key of STAT_KEYS) {
      expect(StatKeySchema.parse(key)).toBe(key)
    }
  })

  it('rejects an unknown stat key', () => {
    expect(() => StatKeySchema.parse('unknownStat')).toThrow()
  })
})
```

`packages/schema/test/scalar.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { ScalarSchema, NullableScalarSchema } from '../src/scalar'

describe('ScalarSchema', () => {
  it('accepts a plain number', () => {
    expect(ScalarSchema.parse(10)).toBe(10)
  })

  it('accepts a byLevel array', () => {
    const value = { byLevel: [1, 2, 3] }
    expect(ScalarSchema.parse(value)).toEqual(value)
  })

  it('accepts a levelRange object', () => {
    const value = { levelRange: { min: 10, max: 50 } }
    expect(ScalarSchema.parse(value)).toEqual(value)
  })

  it('accepts a byRank array', () => {
    const value = { byRank: [5, 10, 15, 20, 25] }
    expect(ScalarSchema.parse(value)).toEqual(value)
  })

  it('rejects a string', () => {
    expect(() => ScalarSchema.parse('10')).toThrow()
  })

  it('rejects null on the non-nullable schema', () => {
    expect(() => ScalarSchema.parse(null)).toThrow()
  })
})

describe('NullableScalarSchema', () => {
  it('accepts null', () => {
    expect(NullableScalarSchema.parse(null)).toBeNull()
  })

  it('accepts everything ScalarSchema accepts', () => {
    expect(NullableScalarSchema.parse(10)).toBe(10)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @wr-calc/schema test`
Expected: FAIL — `Cannot find module '../src/stat-key'` / `'../src/scalar'`.

- [ ] **Step 3: Implement `stat-key.ts`**

```ts
import { z } from 'zod'

export const STAT_KEYS = [
  'hp', 'hpRegen', 'mana', 'manaRegen', 'ad', 'ap', 'armor', 'mr',
  'attackSpeed', 'critChance', 'critDamage', 'abilityHaste',
  'moveSpeed', 'moveSpeedPct', 'flatArmorPen', 'pctArmorPen',
  'flatMagicPen', 'pctMagicPen', 'lifesteal', 'physicalVamp',
  'omnivamp', 'healShieldPower', 'tenacity',
] as const

/** The closed set of stat keys the engine understands; unknown keys fail validation. */
export const StatKeySchema = z.enum(STAT_KEYS)
export type StatKey = z.infer<typeof StatKeySchema>

/** Builds a Partial<Record<StatKey, T>> schema for the given per-stat value schema. */
export function statKeyRecord<T extends z.ZodTypeAny>(valueSchema: T) {
  const shape = Object.fromEntries(
    STAT_KEYS.map((key) => [key, valueSchema.optional()])
  ) as Record<StatKey, z.ZodOptional<T>>
  return z.object(shape)
}
```

- [ ] **Step 4: Implement `scalar.ts`**

```ts
import { z } from 'zod'

/**
 * A game value that may be constant or scale with champion level or ability rank.
 */
export const ScalarSchema = z.union([
  z.number(),
  z.object({ byLevel: z.array(z.number()) }),
  z.object({ levelRange: z.object({ min: z.number(), max: z.number() }) }),
  z.object({ byRank: z.array(z.number()) }),
])
export type Scalar = z.infer<typeof ScalarSchema>

/** A Scalar that may be null when the real value hasn't been entered yet. */
export const NullableScalarSchema = ScalarSchema.nullable()
export type NullableScalar = z.infer<typeof NullableScalarSchema>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @wr-calc/schema test`
Expected: PASS, both files.

- [ ] **Step 6: Commit**

```bash
git add packages/schema/src/stat-key.ts packages/schema/src/scalar.ts \
  packages/schema/test/stat-key.test.ts packages/schema/test/scalar.test.ts
git commit -m "feat: add StatKey and Scalar schemas"
```

---

## Task 3: Condition schema and Effect base fields

**Files:**
- Create: `packages/schema/src/effect/condition.ts`
- Create: `packages/schema/src/effect/kinds/common.ts`
- Test: `packages/schema/test/effect/condition.test.ts`
- Test: `packages/schema/test/effect/common.test.ts`

**Interfaces:**
- Consumes: nothing new (leaf modules; `common.ts` imports `ConditionSchema` from this task's own
  `condition.ts`).
- Produces: `ConditionSchema`, `Condition` type (used by every effect-kind schema from Task 4
  onward, and by `Ability.flags`/damage components later). `SupportLevelSchema`,
  `EffectInputSchema`, `EffectInput` type, `EffectBaseSchema` (the object every effect-kind schema
  `.extend()`s in Tasks 4–7).

- [ ] **Step 1: Write the failing tests**

`packages/schema/test/effect/condition.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { ConditionSchema } from '../../src/effect/condition'

describe('ConditionSchema', () => {
  it('accepts a targetHpBelow condition', () => {
    const result = ConditionSchema.parse({ type: 'targetHpBelow', threshold: 0.3 })
    expect(result.type).toBe('targetHpBelow')
  })

  it('accepts a toggle condition', () => {
    const result = ConditionSchema.parse({ type: 'toggle', inputId: 'enraged' })
    expect(result.type).toBe('toggle')
  })

  it('accepts a targetIsMonster condition with no extra fields', () => {
    const result = ConditionSchema.parse({ type: 'targetIsMonster' })
    expect(result.type).toBe('targetIsMonster')
  })

  it('rejects an unknown condition type', () => {
    expect(() => ConditionSchema.parse({ type: 'madeUp' })).toThrow()
  })

  it('rejects targetHpBelow missing threshold', () => {
    expect(() => ConditionSchema.parse({ type: 'targetHpBelow' })).toThrow()
  })
})
```

`packages/schema/test/effect/common.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { EffectBaseSchema, EffectInputSchema } from '../../src/effect/kinds/common'

describe('EffectInputSchema', () => {
  it('accepts a stackCount input', () => {
    const result = EffectInputSchema.parse({
      type: 'stackCount', id: 'stacks', label: 'Stacks', min: 0, max: 5, default: 0,
    })
    expect(result.type).toBe('stackCount')
  })

  it('accepts a boolean input', () => {
    const result = EffectInputSchema.parse({
      type: 'boolean', id: 'enraged', label: 'Enraged', default: false,
    })
    expect(result.type).toBe('boolean')
  })
})

describe('EffectBaseSchema', () => {
  const valid = {
    id: 'test-effect',
    name: 'Test Effect',
    description: 'Deals bonus damage.',
    support: 'full' as const,
  }

  it('accepts the minimal required fields', () => {
    expect(EffectBaseSchema.parse(valid)).toMatchObject(valid)
  })

  it('accepts optional uniqueGroup, supportNotes, inputs, and condition', () => {
    const result = EffectBaseSchema.parse({
      ...valid,
      uniqueGroup: 'spellblade',
      supportNotes: 'ICD timing unverified',
      inputs: [{ type: 'boolean', id: 'toggle', label: 'Toggle', default: false }],
      condition: { type: 'targetIsChampion' },
    })
    expect(result.uniqueGroup).toBe('spellblade')
  })

  it('rejects an invalid support level', () => {
    expect(() => EffectBaseSchema.parse({ ...valid, support: 'maybe' })).toThrow()
  })

  it('rejects missing description', () => {
    const { description, ...rest } = valid
    expect(() => EffectBaseSchema.parse(rest)).toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @wr-calc/schema test`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `condition.ts`**

```ts
import { z } from 'zod'

/**
 * The closed set of conditions an Effect may gate on. No string expressions, no eval.
 */
export const ConditionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('targetHpBelow'), threshold: z.number() }),
  z.object({ type: z.literal('targetHpAbove'), threshold: z.number() }),
  z.object({ type: z.literal('stacksAtMax') }),
  z.object({ type: z.literal('toggle'), inputId: z.string() }),
  z.object({ type: z.literal('damageType'), value: z.enum(['physical', 'magic', 'true']) }),
  z.object({
    type: z.literal('sourceKind'),
    value: z.enum(['basicAttack', 'ability', 'item', 'other']),
  }),
  z.object({ type: z.literal('targetIsChampion') }),
  z.object({ type: z.literal('targetIsMonster') }),
])
export type Condition = z.infer<typeof ConditionSchema>
```

- [ ] **Step 4: Implement `effect/kinds/common.ts`**

```ts
import { z } from 'zod'
import { ConditionSchema } from '../condition'

export const SupportLevelSchema = z.enum(['full', 'partial', 'none'])
export type SupportLevel = z.infer<typeof SupportLevelSchema>

/** A user-controlled parameter the UI renders automatically for a declaring effect. */
export const EffectInputSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('stackCount'),
    id: z.string(),
    label: z.string(),
    min: z.number(),
    max: z.number(),
    default: z.number(),
  }),
  z.object({
    type: z.literal('boolean'),
    id: z.string(),
    label: z.string(),
    default: z.boolean(),
  }),
])
export type EffectInput = z.infer<typeof EffectInputSchema>

/** Fields shared by every Effect kind; individual kinds `.extend()` this. */
export const EffectBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  uniqueGroup: z.string().optional(),
  support: SupportLevelSchema,
  supportNotes: z.string().optional(),
  inputs: z.array(EffectInputSchema).optional(),
  condition: ConditionSchema.optional(),
})
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @wr-calc/schema test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/schema/src/effect packages/schema/test/effect
git commit -m "feat: add Condition schema and shared Effect base fields"
```

---

## Task 4: Simple effect kinds (stat, statMultiplier, statConversion, stacking)

**Files:**
- Create: `packages/schema/src/effect/kinds/stat.ts`
- Create: `packages/schema/src/effect/kinds/stat-multiplier.ts`
- Create: `packages/schema/src/effect/kinds/stat-conversion.ts`
- Create: `packages/schema/src/effect/kinds/stacking.ts`
- Create: `packages/schema/src/effect/effect.ts` (started here, extended in Tasks 5–7)
- Test: `packages/schema/test/effect/simple-kinds.test.ts`

**Interfaces:**
- Consumes: `EffectBaseSchema` (Task 3), `StatKeySchema` (Task 2), `NullableScalarSchema`
  (Task 2).
- Produces: `StatEffectSchema`, `StatMultiplierEffectSchema`, `StatConversionEffectSchema`,
  `StackingEffectSchema` and their inferred types. `EffectSchema` (a `z.discriminatedUnion` on
  `kind`) started with these four kinds — Tasks 5, 6, 7 append to its member array. `Effect` and
  `EffectKind` types, re-derived each time a kind is added.

- [ ] **Step 1: Write the failing test**

`packages/schema/test/effect/simple-kinds.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { EffectSchema } from '../../src/effect/effect'

const base = {
  id: 'test-effect',
  name: 'Test Effect',
  description: 'Test description',
  support: 'full' as const,
}

describe('simple effect kinds', () => {
  it('parses a stat effect', () => {
    const result = EffectSchema.parse({ ...base, kind: 'stat', stat: 'ad', amount: 10 })
    expect(result.kind).toBe('stat')
  })

  it('parses a statMultiplier effect', () => {
    const result = EffectSchema.parse({
      ...base, kind: 'statMultiplier', stat: 'ad', layer: 'bonus', amount: 0.1,
    })
    expect(result.kind).toBe('statMultiplier')
  })

  it('parses a statConversion effect', () => {
    const result = EffectSchema.parse({
      ...base, kind: 'statConversion', fromStat: 'ap', toStat: 'ad', ratio: 0.3,
    })
    expect(result.kind).toBe('statConversion')
  })

  it('parses a stacking effect', () => {
    const result = EffectSchema.parse({
      ...base, kind: 'stacking', stat: 'ad', perStack: 2, maxStacks: 5, stackInputId: 'stacks',
    })
    expect(result.kind).toBe('stacking')
  })

  it('accepts null amount on a stat effect (unverified real value)', () => {
    const result = EffectSchema.parse({ ...base, kind: 'stat', stat: 'ad', amount: null })
    expect(result.kind === 'stat' && result.amount).toBeNull()
  })

  it('rejects a stat effect missing amount', () => {
    expect(() => EffectSchema.parse({ ...base, kind: 'stat', stat: 'ad' })).toThrow()
  })

  it('rejects an unknown kind', () => {
    expect(() => EffectSchema.parse({ ...base, kind: 'madeUpKind' })).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wr-calc/schema test`
Expected: FAIL — `effect.ts` not found.

- [ ] **Step 3: Implement the four kind schemas**

`packages/schema/src/effect/kinds/stat.ts`:
```ts
import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { StatKeySchema } from '../../stat-key'
import { NullableScalarSchema } from '../../scalar'

export const StatEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('stat'),
  stat: StatKeySchema,
  amount: NullableScalarSchema,
})
export type StatEffect = z.infer<typeof StatEffectSchema>
```

`packages/schema/src/effect/kinds/stat-multiplier.ts`:
```ts
import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { StatKeySchema } from '../../stat-key'
import { NullableScalarSchema } from '../../scalar'

export const StatMultiplierEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('statMultiplier'),
  stat: StatKeySchema,
  layer: z.enum(['base', 'bonus', 'total']),
  amount: NullableScalarSchema,
})
export type StatMultiplierEffect = z.infer<typeof StatMultiplierEffectSchema>
```

`packages/schema/src/effect/kinds/stat-conversion.ts`:
```ts
import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { StatKeySchema } from '../../stat-key'
import { NullableScalarSchema } from '../../scalar'

export const StatConversionEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('statConversion'),
  fromStat: StatKeySchema,
  toStat: StatKeySchema,
  ratio: NullableScalarSchema,
})
export type StatConversionEffect = z.infer<typeof StatConversionEffectSchema>
```

`packages/schema/src/effect/kinds/stacking.ts`:
```ts
import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { StatKeySchema } from '../../stat-key'
import { NullableScalarSchema } from '../../scalar'

export const StackingEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('stacking'),
  stat: StatKeySchema,
  perStack: NullableScalarSchema,
  maxStacks: z.number(),
  /** References the `id` of an `inputs[]` entry of type 'stackCount' that drives this effect. */
  stackInputId: z.string(),
})
export type StackingEffect = z.infer<typeof StackingEffectSchema>
```

- [ ] **Step 4: Assemble the (partial) Effect union**

`packages/schema/src/effect/effect.ts`:
```ts
import { z } from 'zod'
import { StatEffectSchema } from './kinds/stat'
import { StatMultiplierEffectSchema } from './kinds/stat-multiplier'
import { StatConversionEffectSchema } from './kinds/stat-conversion'
import { StackingEffectSchema } from './kinds/stacking'

// Tasks 5, 6, and 7 append their kinds' schemas to this array.
export const EffectSchema = z.discriminatedUnion('kind', [
  StatEffectSchema,
  StatMultiplierEffectSchema,
  StatConversionEffectSchema,
  StackingEffectSchema,
])
export type Effect = z.infer<typeof EffectSchema>
export type EffectKind = Effect['kind']
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @wr-calc/schema test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/schema/src/effect
git commit -m "feat: add stat, statMultiplier, statConversion, stacking effect kinds"
```

---

## Task 5: On-hit-family effect kinds (onHit, spellblade, procEveryN, dot)

**Files:**
- Create: `packages/schema/src/effect/kinds/on-hit.ts`
- Create: `packages/schema/src/effect/kinds/spellblade.ts`
- Create: `packages/schema/src/effect/kinds/proc-every-n.ts`
- Create: `packages/schema/src/effect/kinds/dot.ts`
- Modify: `packages/schema/src/effect/effect.ts`
- Test: `packages/schema/test/effect/on-hit-family-kinds.test.ts`

**Interfaces:**
- Consumes: `EffectBaseSchema`, `StatKeySchema`, `NullableScalarSchema` (as Task 4); appends to
  the `EffectSchema` union array started in Task 4.
- Produces: `OnHitEffectSchema`, `SpellbladeEffectSchema`, `ProcEveryNEffectSchema`,
  `DotEffectSchema` and their types.

- [ ] **Step 1: Write the failing test**

`packages/schema/test/effect/on-hit-family-kinds.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { EffectSchema } from '../../src/effect/effect'

const base = {
  id: 'test-effect',
  name: 'Test Effect',
  description: 'Test description',
  support: 'full' as const,
}

describe('on-hit-family effect kinds', () => {
  it('parses an onHit effect with flat and pct-current-hp damage', () => {
    const result = EffectSchema.parse({
      ...base,
      kind: 'onHit',
      damageType: 'physical',
      flat: 15,
      pctTargetCurrentHp: 0.08,
      monsterCap: 60,
    })
    expect(result.kind).toBe('onHit')
  })

  it('parses a spellblade effect', () => {
    const result = EffectSchema.parse({
      ...base,
      kind: 'spellblade',
      damageType: 'physical',
      bonusDamage: null,
      ratios: [{ stat: 'ad', value: 1 }],
      internalCooldownSeconds: 1.5,
    })
    expect(result.kind).toBe('spellblade')
  })

  it('parses a procEveryN effect', () => {
    const result = EffectSchema.parse({
      ...base, kind: 'procEveryN', n: 3, damageType: 'magic', damage: 40,
    })
    expect(result.kind).toBe('procEveryN')
  })

  it('parses a dot effect', () => {
    const result = EffectSchema.parse({
      ...base,
      kind: 'dot',
      damageType: 'magic',
      tickAmount: 10,
      tickIntervalSeconds: 1,
      durationSeconds: 4,
      refresh: 'refresh',
    })
    expect(result.kind).toBe('dot')
  })

  it('rejects a dot effect with an invalid refresh rule', () => {
    expect(() =>
      EffectSchema.parse({
        ...base,
        kind: 'dot',
        damageType: 'magic',
        tickAmount: 10,
        tickIntervalSeconds: 1,
        durationSeconds: 4,
        refresh: 'explode',
      })
    ).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wr-calc/schema test`
Expected: FAIL — unrecognized `kind` discriminator values.

- [ ] **Step 3: Implement the four kind schemas**

`packages/schema/src/effect/kinds/on-hit.ts`:
```ts
import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { StatKeySchema } from '../../stat-key'
import { NullableScalarSchema } from '../../scalar'

export const OnHitEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('onHit'),
  damageType: z.enum(['physical', 'magic', 'true']),
  flat: NullableScalarSchema.optional(),
  pctTargetCurrentHp: NullableScalarSchema.optional(),
  pctTargetMaxHp: NullableScalarSchema.optional(),
  pctTargetMissingHp: NullableScalarSchema.optional(),
  pctOwnStat: z.object({ stat: StatKeySchema, ratio: NullableScalarSchema }).optional(),
  minDamage: NullableScalarSchema.optional(),
  maxDamage: NullableScalarSchema.optional(),
  monsterCap: NullableScalarSchema.optional(),
})
export type OnHitEffect = z.infer<typeof OnHitEffectSchema>
```

`packages/schema/src/effect/kinds/spellblade.ts`:
```ts
import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { StatKeySchema } from '../../stat-key'
import { NullableScalarSchema } from '../../scalar'

export const SpellbladeEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('spellblade'),
  damageType: z.enum(['physical', 'magic', 'true']),
  bonusDamage: NullableScalarSchema,
  ratios: z.array(z.object({ stat: StatKeySchema, value: NullableScalarSchema })).default([]),
  internalCooldownSeconds: NullableScalarSchema,
})
export type SpellbladeEffect = z.infer<typeof SpellbladeEffectSchema>
```

`packages/schema/src/effect/kinds/proc-every-n.ts`:
```ts
import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { NullableScalarSchema } from '../../scalar'

export const ProcEveryNEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('procEveryN'),
  n: z.number(),
  damageType: z.enum(['physical', 'magic', 'true']).optional(),
  damage: NullableScalarSchema.optional(),
  debuffId: z.string().optional(),
  resetsOnMiss: z.boolean().default(false),
})
export type ProcEveryNEffect = z.infer<typeof ProcEveryNEffectSchema>
```

`packages/schema/src/effect/kinds/dot.ts`:
```ts
import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { NullableScalarSchema } from '../../scalar'

export const DotEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('dot'),
  damageType: z.enum(['physical', 'magic', 'true']),
  tickAmount: NullableScalarSchema,
  tickIntervalSeconds: z.number(),
  durationSeconds: NullableScalarSchema,
  refresh: z.enum(['refresh', 'stack', 'ignore']),
})
export type DotEffect = z.infer<typeof DotEffectSchema>
```

- [ ] **Step 4: Append to the Effect union**

`packages/schema/src/effect/effect.ts` (full file, replacing Task 4's version):
```ts
import { z } from 'zod'
import { StatEffectSchema } from './kinds/stat'
import { StatMultiplierEffectSchema } from './kinds/stat-multiplier'
import { StatConversionEffectSchema } from './kinds/stat-conversion'
import { StackingEffectSchema } from './kinds/stacking'
import { OnHitEffectSchema } from './kinds/on-hit'
import { SpellbladeEffectSchema } from './kinds/spellblade'
import { ProcEveryNEffectSchema } from './kinds/proc-every-n'
import { DotEffectSchema } from './kinds/dot'

// Tasks 6 and 7 append their kinds' schemas to this array.
export const EffectSchema = z.discriminatedUnion('kind', [
  StatEffectSchema,
  StatMultiplierEffectSchema,
  StatConversionEffectSchema,
  StackingEffectSchema,
  OnHitEffectSchema,
  SpellbladeEffectSchema,
  ProcEveryNEffectSchema,
  DotEffectSchema,
])
export type Effect = z.infer<typeof EffectSchema>
export type EffectKind = Effect['kind']
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @wr-calc/schema test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/schema/src/effect
git commit -m "feat: add onHit, spellblade, procEveryN, dot effect kinds"
```

---

## Task 6: Resist/amp effect kinds (resistShred, penetration, damageAmp, damageReduction, cooldownRefund)

**Files:**
- Create: `packages/schema/src/effect/kinds/resist-shred.ts`
- Create: `packages/schema/src/effect/kinds/penetration.ts`
- Create: `packages/schema/src/effect/kinds/damage-amp.ts`
- Create: `packages/schema/src/effect/kinds/damage-reduction.ts`
- Create: `packages/schema/src/effect/kinds/cooldown-refund.ts`
- Modify: `packages/schema/src/effect/effect.ts`
- Test: `packages/schema/test/effect/resist-amp-kinds.test.ts`

**Interfaces:**
- Consumes: `EffectBaseSchema`, `NullableScalarSchema`, `ConditionSchema`; appends to
  `EffectSchema`.
- Produces: `ResistShredEffectSchema`, `PenetrationEffectSchema`, `DamageAmpEffectSchema`,
  `DamageReductionEffectSchema`, `CooldownRefundEffectSchema` and their types. `penetration` and
  `damageAmp` require `condition` (override the base's optional field to required) — per the
  design doc, unconditional pen/amp is expressed as a plain `stat`/`statMultiplier` effect
  instead.

- [ ] **Step 1: Write the failing test**

`packages/schema/test/effect/resist-amp-kinds.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { EffectSchema } from '../../src/effect/effect'

const base = {
  id: 'test-effect',
  name: 'Test Effect',
  description: 'Test description',
  support: 'full' as const,
}

describe('resist/amp effect kinds', () => {
  it('parses a stacking resistShred effect', () => {
    const result = EffectSchema.parse({
      ...base,
      kind: 'resistShred',
      resist: 'armor',
      mode: 'percent',
      amount: 0.06,
      stacking: true,
      maxStacks: 5,
      durationSeconds: 3,
    })
    expect(result.kind).toBe('resistShred')
  })

  it('parses a penetration effect with its required condition', () => {
    const result = EffectSchema.parse({
      ...base,
      kind: 'penetration',
      resist: 'mr',
      mode: 'flat',
      amount: 10,
      condition: { type: 'targetHpAbove', threshold: 0.5 },
    })
    expect(result.kind).toBe('penetration')
  })

  it('rejects a penetration effect with no condition', () => {
    expect(() =>
      EffectSchema.parse({ ...base, kind: 'penetration', resist: 'mr', mode: 'flat', amount: 10 })
    ).toThrow()
  })

  it('parses a damageAmp effect with its required condition', () => {
    const result = EffectSchema.parse({
      ...base,
      kind: 'damageAmp',
      amount: 0.1,
      condition: { type: 'targetHpBelow', threshold: 0.3 },
    })
    expect(result.kind).toBe('damageAmp')
  })

  it('parses a damageReduction effect', () => {
    const result = EffectSchema.parse({
      ...base, kind: 'damageReduction', damageType: 'physical', amount: 0.15,
    })
    expect(result.kind).toBe('damageReduction')
  })

  it('parses a cooldownRefund effect', () => {
    const result = EffectSchema.parse({
      ...base, kind: 'cooldownRefund', mode: 'percent', amount: 0.05,
    })
    expect(result.kind === 'cooldownRefund' && result.excludesUltimate).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wr-calc/schema test`
Expected: FAIL.

- [ ] **Step 3: Implement the five kind schemas**

`packages/schema/src/effect/kinds/resist-shred.ts`:
```ts
import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { NullableScalarSchema } from '../../scalar'

export const ResistShredEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('resistShred'),
  resist: z.enum(['armor', 'mr']),
  mode: z.enum(['flat', 'percent']),
  amount: NullableScalarSchema,
  stacking: z.boolean().default(false),
  maxStacks: z.number().optional(),
  durationSeconds: NullableScalarSchema.optional(),
})
export type ResistShredEffect = z.infer<typeof ResistShredEffectSchema>
```

`packages/schema/src/effect/kinds/penetration.ts`:
```ts
import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { ConditionSchema } from '../condition'
import { NullableScalarSchema } from '../../scalar'

export const PenetrationEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('penetration'),
  resist: z.enum(['armor', 'mr']),
  mode: z.enum(['flat', 'percent']),
  amount: NullableScalarSchema,
  // Unconditional pen is expressed as a plain stat effect; this kind is for conditional pen only.
  condition: ConditionSchema,
})
export type PenetrationEffect = z.infer<typeof PenetrationEffectSchema>
```

`packages/schema/src/effect/kinds/damage-amp.ts`:
```ts
import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { ConditionSchema } from '../condition'
import { NullableScalarSchema } from '../../scalar'

export const DamageAmpEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('damageAmp'),
  condition: ConditionSchema,
  /** Fraction added to damage, e.g. 0.1 = +10%. */
  amount: NullableScalarSchema,
})
export type DamageAmpEffect = z.infer<typeof DamageAmpEffectSchema>
```

`packages/schema/src/effect/kinds/damage-reduction.ts`:
```ts
import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { NullableScalarSchema } from '../../scalar'

export const DamageReductionEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('damageReduction'),
  damageType: z.enum(['physical', 'magic', 'true', 'all']),
  /** Fraction of incoming damage removed. */
  amount: NullableScalarSchema,
})
export type DamageReductionEffect = z.infer<typeof DamageReductionEffectSchema>
```

`packages/schema/src/effect/kinds/cooldown-refund.ts`:
```ts
import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { NullableScalarSchema } from '../../scalar'

export const CooldownRefundEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('cooldownRefund'),
  mode: z.enum(['flat', 'percent']),
  amount: NullableScalarSchema,
  excludesUltimate: z.boolean().default(true),
})
export type CooldownRefundEffect = z.infer<typeof CooldownRefundEffectSchema>
```

- [ ] **Step 4: Append to the Effect union**

`packages/schema/src/effect/effect.ts` (full file, replacing Task 5's version):
```ts
import { z } from 'zod'
import { StatEffectSchema } from './kinds/stat'
import { StatMultiplierEffectSchema } from './kinds/stat-multiplier'
import { StatConversionEffectSchema } from './kinds/stat-conversion'
import { StackingEffectSchema } from './kinds/stacking'
import { OnHitEffectSchema } from './kinds/on-hit'
import { SpellbladeEffectSchema } from './kinds/spellblade'
import { ProcEveryNEffectSchema } from './kinds/proc-every-n'
import { DotEffectSchema } from './kinds/dot'
import { ResistShredEffectSchema } from './kinds/resist-shred'
import { PenetrationEffectSchema } from './kinds/penetration'
import { DamageAmpEffectSchema } from './kinds/damage-amp'
import { CooldownRefundEffectSchema } from './kinds/cooldown-refund'
import { DamageReductionEffectSchema } from './kinds/damage-reduction'

// Task 7 appends its kinds' schemas to this array.
export const EffectSchema = z.discriminatedUnion('kind', [
  StatEffectSchema,
  StatMultiplierEffectSchema,
  StatConversionEffectSchema,
  StackingEffectSchema,
  OnHitEffectSchema,
  SpellbladeEffectSchema,
  ProcEveryNEffectSchema,
  DotEffectSchema,
  ResistShredEffectSchema,
  PenetrationEffectSchema,
  DamageAmpEffectSchema,
  CooldownRefundEffectSchema,
  DamageReductionEffectSchema,
])
export type Effect = z.infer<typeof EffectSchema>
export type EffectKind = Effect['kind']
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @wr-calc/schema test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/schema/src/effect
git commit -m "feat: add resistShred, penetration, damageAmp, damageReduction, cooldownRefund effect kinds"
```

---

## Task 7: Remaining effect kinds (shield, heal, active, custom) and full union

**Files:**
- Create: `packages/schema/src/effect/kinds/shield.ts`
- Create: `packages/schema/src/effect/kinds/heal.ts`
- Create: `packages/schema/src/effect/kinds/active.ts`
- Create: `packages/schema/src/effect/kinds/custom.ts`
- Modify: `packages/schema/src/effect/effect.ts`
- Test: `packages/schema/test/effect/remaining-kinds.test.ts`
- Test: `packages/schema/test/effect/effect-union.test.ts`

**Interfaces:**
- Consumes: `EffectBaseSchema`, `NullableScalarSchema`.
- Produces: `ShieldEffectSchema`, `HealEffectSchema`, `ActiveEffectSchema`, `CustomEffectSchema`
  and their types. **Finalizes** `EffectSchema` with all 17 kinds — this is the `Effect`/
  `EffectKind` shape every later task (Item, Ability, Rune, Target, and every `packages/calc`
  task) imports.

- [ ] **Step 1: Write the failing tests**

`packages/schema/test/effect/remaining-kinds.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { EffectSchema } from '../../src/effect/effect'

const base = {
  id: 'test-effect',
  name: 'Test Effect',
  description: 'Test description',
  support: 'full' as const,
}

describe('remaining effect kinds', () => {
  it('parses a shield effect', () => {
    const result = EffectSchema.parse({
      ...base, kind: 'shield', amount: 300, durationSeconds: 2.5,
    })
    expect(result.kind).toBe('shield')
  })

  it('parses a heal effect', () => {
    const result = EffectSchema.parse({ ...base, kind: 'heal', amount: 150 })
    expect(result.kind).toBe('heal')
  })

  it('parses an active effect', () => {
    const result = EffectSchema.parse({
      ...base, kind: 'active', cooldownSeconds: 60, damageType: 'magic', damage: 200,
    })
    expect(result.kind).toBe('active')
  })

  it('parses a custom effect', () => {
    const result = EffectSchema.parse({
      ...base, kind: 'custom', support: 'partial', handler: 'someHandler',
    })
    expect(result.kind).toBe('custom')
  })

  it('rejects a custom effect missing handler', () => {
    expect(() => EffectSchema.parse({ ...base, kind: 'custom' })).toThrow()
  })
})
```

`packages/schema/test/effect/effect-union.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { EffectSchema } from '../../src/effect/effect'

const EXPECTED_KINDS = [
  'stat', 'statMultiplier', 'statConversion', 'stacking', 'onHit', 'spellblade',
  'procEveryN', 'dot', 'resistShred', 'penetration', 'damageAmp', 'cooldownRefund',
  'damageReduction', 'shield', 'heal', 'active', 'custom',
]

describe('EffectSchema union', () => {
  it('recognizes exactly the 17 documented kinds', () => {
    const optionKinds = EffectSchema.options.map((option) => option.shape.kind.value)
    expect(optionKinds.sort()).toEqual([...EXPECTED_KINDS].sort())
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @wr-calc/schema test`
Expected: FAIL — remaining kinds unrecognized; union test fails on kind count.

- [ ] **Step 3: Implement the four kind schemas**

`packages/schema/src/effect/kinds/shield.ts`:
```ts
import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { NullableScalarSchema } from '../../scalar'

export const ShieldEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('shield'),
  amount: NullableScalarSchema,
  durationSeconds: NullableScalarSchema,
})
export type ShieldEffect = z.infer<typeof ShieldEffectSchema>
```

`packages/schema/src/effect/kinds/heal.ts`:
```ts
import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { NullableScalarSchema } from '../../scalar'

export const HealEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('heal'),
  amount: NullableScalarSchema,
})
export type HealEffect = z.infer<typeof HealEffectSchema>
```

`packages/schema/src/effect/kinds/active.ts`:
```ts
import { z } from 'zod'
import { EffectBaseSchema } from './common'
import { NullableScalarSchema } from '../../scalar'

export const ActiveEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('active'),
  cooldownSeconds: NullableScalarSchema,
  damageType: z.enum(['physical', 'magic', 'true']).optional(),
  damage: NullableScalarSchema.optional(),
})
export type ActiveEffect = z.infer<typeof ActiveEffectSchema>
```

`packages/schema/src/effect/kinds/custom.ts`:
```ts
import { z } from 'zod'
import { EffectBaseSchema } from './common'

export const CustomEffectSchema = EffectBaseSchema.extend({
  kind: z.literal('custom'),
  /** Handler id, implemented in packages/calc/src/custom/<handler>.ts and registered by id. */
  handler: z.string(),
})
export type CustomEffect = z.infer<typeof CustomEffectSchema>
```

- [ ] **Step 4: Finalize the Effect union**

`packages/schema/src/effect/effect.ts` (full, final file):
```ts
import { z } from 'zod'
import { StatEffectSchema } from './kinds/stat'
import { StatMultiplierEffectSchema } from './kinds/stat-multiplier'
import { StatConversionEffectSchema } from './kinds/stat-conversion'
import { StackingEffectSchema } from './kinds/stacking'
import { OnHitEffectSchema } from './kinds/on-hit'
import { SpellbladeEffectSchema } from './kinds/spellblade'
import { ProcEveryNEffectSchema } from './kinds/proc-every-n'
import { DotEffectSchema } from './kinds/dot'
import { ResistShredEffectSchema } from './kinds/resist-shred'
import { PenetrationEffectSchema } from './kinds/penetration'
import { DamageAmpEffectSchema } from './kinds/damage-amp'
import { CooldownRefundEffectSchema } from './kinds/cooldown-refund'
import { DamageReductionEffectSchema } from './kinds/damage-reduction'
import { ShieldEffectSchema } from './kinds/shield'
import { HealEffectSchema } from './kinds/heal'
import { ActiveEffectSchema } from './kinds/active'
import { CustomEffectSchema } from './kinds/custom'

export const EffectSchema = z.discriminatedUnion('kind', [
  StatEffectSchema,
  StatMultiplierEffectSchema,
  StatConversionEffectSchema,
  StackingEffectSchema,
  OnHitEffectSchema,
  SpellbladeEffectSchema,
  ProcEveryNEffectSchema,
  DotEffectSchema,
  ResistShredEffectSchema,
  PenetrationEffectSchema,
  DamageAmpEffectSchema,
  CooldownRefundEffectSchema,
  DamageReductionEffectSchema,
  ShieldEffectSchema,
  HealEffectSchema,
  ActiveEffectSchema,
  CustomEffectSchema,
])
export type Effect = z.infer<typeof EffectSchema>
export type EffectKind = Effect['kind']

export * from './kinds/stat'
export * from './kinds/stat-multiplier'
export * from './kinds/stat-conversion'
export * from './kinds/stacking'
export * from './kinds/on-hit'
export * from './kinds/spellblade'
export * from './kinds/proc-every-n'
export * from './kinds/dot'
export * from './kinds/resist-shred'
export * from './kinds/penetration'
export * from './kinds/damage-amp'
export * from './kinds/cooldown-refund'
export * from './kinds/damage-reduction'
export * from './kinds/shield'
export * from './kinds/heal'
export * from './kinds/active'
export * from './kinds/custom'
export * from './condition'
export * from './kinds/common'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @wr-calc/schema test`
Expected: PASS, all effect tests including the 17-kind union check.

- [ ] **Step 6: Commit**

```bash
git add packages/schema/src/effect packages/schema/test/effect
git commit -m "feat: add shield, heal, active, custom effect kinds; finalize Effect union"
```

---

## Task 8: Provenance and Item schema

**Files:**
- Create: `packages/schema/src/provenance.ts`
- Create: `packages/schema/src/item.ts`
- Test: `packages/schema/test/item.test.ts`

**Interfaces:**
- Consumes: `StatKeySchema`, `statKeyRecord` (Task 2), `NullableScalarSchema` (Task 2),
  `EffectSchema` (Task 7).
- Produces: `ProvenanceSchema`, `Provenance` type. `ItemTierSchema`, `ItemSchema`, `Item` type —
  consumed by Task 11 (validator) and every later step that reads item data.

- [ ] **Step 1: Write the failing test**

`packages/schema/test/item.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { ItemSchema } from '../src/item'

function validItem() {
  return {
    id: 'long-sword',
    name: 'Long Sword',
    tier: 'basic' as const,
    cost: { total: 350, combine: 350 },
    recipe: [],
    stats: { ad: 10 },
    effects: [],
    tags: ['physical'],
    provenance: { source: 'manual' as const, patch: '0.0.0', verifiedInGame: false },
  }
}

describe('ItemSchema', () => {
  it('parses a minimal valid item', () => {
    const result = ItemSchema.parse(validItem())
    expect(result.id).toBe('long-sword')
  })

  it('allows null stat values for unverified data', () => {
    const item = validItem()
    item.stats = { ad: null } as unknown as typeof item.stats
    const result = ItemSchema.parse(item)
    expect(result.stats.ad).toBeNull()
  })

  it('rejects an unknown stat key', () => {
    const item = { ...validItem(), stats: { madeUpStat: 10 } }
    expect(() => ItemSchema.parse(item)).toThrow()
  })

  it('rejects an unknown tier', () => {
    const item = { ...validItem(), tier: 'mythic' }
    expect(() => ItemSchema.parse(item)).toThrow()
  })

  it('parses an item carrying effects', () => {
    const item = {
      ...validItem(),
      effects: [
        {
          id: 'passive', name: 'Passive', description: 'Does a thing.', support: 'full' as const,
          kind: 'stat' as const, stat: 'ad' as const, amount: 5,
        },
      ],
    }
    const result = ItemSchema.parse(item)
    expect(result.effects).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wr-calc/schema test`
Expected: FAIL — `item.ts` not found.

- [ ] **Step 3: Implement `provenance.ts`**

```ts
import { z } from 'zod'

export const ProvenanceSchema = z.object({
  source: z.enum(['manual', 'wiki', 'patch-notes', 'in-game']),
  patch: z.string(),
  verifiedInGame: z.boolean(),
  verifiedAt: z.string().optional(),
})
export type Provenance = z.infer<typeof ProvenanceSchema>
```

- [ ] **Step 4: Implement `item.ts`**

```ts
import { z } from 'zod'
import { statKeyRecord } from './stat-key'
import { NullableScalarSchema } from './scalar'
import { EffectSchema } from './effect/effect'
import { ProvenanceSchema } from './provenance'

export const ItemTierSchema = z.enum([
  'basic', 'epic', 'legendary', 'boots', 'enchant', 'support', 'consumable',
])

export const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  tier: ItemTierSchema,
  cost: z.object({ total: z.number(), combine: z.number() }),
  recipe: z.array(z.string()),
  stats: statKeyRecord(NullableScalarSchema),
  effects: z.array(EffectSchema),
  tags: z.array(z.string()),
  provenance: ProvenanceSchema,
})
export type Item = z.infer<typeof ItemSchema>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @wr-calc/schema test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/schema/src/provenance.ts packages/schema/src/item.ts packages/schema/test/item.test.ts
git commit -m "feat: add Provenance and Item schemas"
```

---

## Task 9: DamageComponent, Ability, Champion schemas

**Files:**
- Create: `packages/schema/src/ability.ts`
- Create: `packages/schema/src/champion.ts`
- Test: `packages/schema/test/ability.test.ts`
- Test: `packages/schema/test/champion.test.ts`

**Interfaces:**
- Consumes: `StatKeySchema`, `statKeyRecord` (Task 2), `NullableScalarSchema` (Task 2).
- Produces: `DamageTypeSchema`, `DamageRatioStatSchema`, `DamageComponentSchema`, `AbilitySchema`
  and types — consumed by `ChampionSchema` (this task) and by `packages/calc`'s combo engine in
  later plans. `ChampionBaseStatsSchema`, `ChampionSchema`, `Champion` type.

- [ ] **Step 1: Write the failing tests**

`packages/schema/test/ability.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { AbilitySchema, DamageComponentSchema } from '../src/ability'

describe('DamageComponentSchema', () => {
  it('parses a component with multiple ratios', () => {
    const result = DamageComponentSchema.parse({
      type: 'magic',
      base: { byRank: [80, 120, 160, 200, 240] },
      ratios: [
        { stat: 'ap', value: 0.6 },
        { stat: 'targetCurrentHp', value: 0.1 },
      ],
      tags: ['nuke'],
    })
    expect(result.ratios).toHaveLength(2)
  })

  it('rejects an unknown ratio stat', () => {
    expect(() =>
      DamageComponentSchema.parse({
        type: 'magic', base: 100, ratios: [{ stat: 'madeUp', value: 1 }], tags: [],
      })
    ).toThrow()
  })
})

describe('AbilitySchema', () => {
  const validAbility = {
    id: 'q', name: 'Test Q', maxRank: 5, cooldown: { byRank: [8, 7, 6, 5, 4] },
    castTime: 0.25, damage: [], flags: {},
  }

  it('parses a minimal valid ability', () => {
    const result = AbilitySchema.parse(validAbility)
    expect(result.id).toBe('q')
  })

  it('accepts a custom handler id for kits that do not fit', () => {
    const result = AbilitySchema.parse({ ...validAbility, custom: 'nunuSnowball' })
    expect(result.custom).toBe('nunuSnowball')
  })
})
```

`packages/schema/test/champion.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { ChampionSchema } from '../src/champion'

function validAbility(id: string) {
  return { id, name: id, maxRank: 5, cooldown: 8, castTime: 0.25, damage: [], flags: {} }
}

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
    }
    expect(() => ChampionSchema.parse(champion)).toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @wr-calc/schema test`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `ability.ts`**

```ts
import { z } from 'zod'
import { NullableScalarSchema } from './scalar'

export const DamageTypeSchema = z.enum(['physical', 'magic', 'true'])

export const DamageRatioStatSchema = z.enum([
  'totalAd', 'bonusAd', 'ap', 'maxHp', 'bonusHp',
  'targetMaxHp', 'targetCurrentHp', 'targetMissingHp',
])

export const DamageComponentSchema = z.object({
  type: DamageTypeSchema,
  base: NullableScalarSchema,
  ratios: z.array(z.object({ stat: DamageRatioStatSchema, value: NullableScalarSchema })),
  hits: z.number().optional(),
  tags: z.array(z.string()),
})
export type DamageComponent = z.infer<typeof DamageComponentSchema>

export const AbilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  maxRank: z.number(),
  cooldown: NullableScalarSchema,
  cost: NullableScalarSchema.optional(),
  castTime: z.number(),
  damage: z.array(DamageComponentSchema),
  flags: z.object({
    appliesOnHit: z.boolean().optional(),
    triggersSpellblade: z.boolean().optional(),
    resetsBasicAttack: z.boolean().optional(),
  }),
  /** Handler id for kits that don't fit the declarative damage model, e.g. Nunu's Q throw. */
  custom: z.string().optional(),
})
export type Ability = z.infer<typeof AbilitySchema>
```

- [ ] **Step 4: Implement `champion.ts`**

```ts
import { z } from 'zod'
import { statKeyRecord } from './stat-key'
import { AbilitySchema } from './ability'

export const ChampionBaseStatsSchema = statKeyRecord(
  z.object({ base: z.number(), perLevel: z.number() })
)

export const ChampionSchema = z.object({
  id: z.string(),
  name: z.string(),
  resource: z.enum(['mana', 'energy', 'none', 'other']),
  baseStats: ChampionBaseStatsSchema,
  attackSpeed: z.object({ base: z.number(), ratio: z.number().optional() }),
  abilities: z.object({
    passive: AbilitySchema,
    q: AbilitySchema,
    w: AbilitySchema,
    e: AbilitySchema,
    r: AbilitySchema,
  }),
})
export type Champion = z.infer<typeof ChampionSchema>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @wr-calc/schema test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/schema/src/ability.ts packages/schema/src/champion.ts \
  packages/schema/test/ability.test.ts packages/schema/test/champion.test.ts
git commit -m "feat: add DamageComponent, Ability, Champion schemas"
```

---

## Task 10: Rune, Build, Target schemas

**Files:**
- Create: `packages/schema/src/rune.ts`
- Create: `packages/schema/src/build.ts`
- Create: `packages/schema/src/target.ts`
- Test: `packages/schema/test/rune.test.ts`
- Test: `packages/schema/test/build.test.ts`
- Test: `packages/schema/test/target.test.ts`

**Interfaces:**
- Consumes: `EffectSchema` (Task 7).
- Produces: `RuneSchema`, `Rune` type. `BuildSchema`, `Build` type. `TargetChampionSchema`,
  `TargetDummySchema`, `TargetSchema`, `Target` type — consumed by every `packages/calc`
  simulation task in later plans.

**Spec note:** the design doc describes `Target` as "either `{ champion, level, build }` or a
dummy," without naming a discriminant field. A Zod discriminated union needs one, so this task
adds an explicit `kind: 'champion' | 'dummy'` field — the natural, minimal elaboration needed to
implement the documented shape.

- [ ] **Step 1: Write the failing tests**

`packages/schema/test/rune.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { RuneSchema } from '../src/rune'

describe('RuneSchema', () => {
  it('parses a minimal valid rune', () => {
    const result = RuneSchema.parse({
      id: 'conqueror', name: 'Conqueror', path: 'precision', slot: 'keystone', effects: [],
    })
    expect(result.id).toBe('conqueror')
  })
})
```

`packages/schema/test/build.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { BuildSchema } from '../src/build'

describe('BuildSchema', () => {
  it('parses a build with items, boots, runes, and inputs', () => {
    const result = BuildSchema.parse({
      items: ['long-sword', 'bf-sword'],
      boots: 'plated-steelcaps',
      runes: ['conqueror', 'triumph'],
      inputs: { stacks: 3, enraged: true },
    })
    expect(result.items).toEqual(['long-sword', 'bf-sword'])
  })

  it('allows boots and enchant to be omitted', () => {
    const result = BuildSchema.parse({ items: [], runes: [], inputs: {} })
    expect(result.boots).toBeUndefined()
  })
})
```

`packages/schema/test/target.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { TargetSchema } from '../src/target'

describe('TargetSchema', () => {
  it('parses a champion target', () => {
    const result = TargetSchema.parse({
      kind: 'champion',
      champion: 'nunu-willump',
      level: 11,
      build: { items: [], runes: [], inputs: {} },
    })
    expect(result.kind).toBe('champion')
  })

  it('parses a dummy target', () => {
    const result = TargetSchema.parse({ kind: 'dummy', hp: 2000, armor: 60, mr: 40 })
    expect(result.kind).toBe('dummy')
  })

  it('rejects a dummy target missing hp', () => {
    expect(() => TargetSchema.parse({ kind: 'dummy', armor: 60, mr: 40 })).toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @wr-calc/schema test`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `rune.ts`**

```ts
import { z } from 'zod'
import { EffectSchema } from './effect/effect'

// Rune paths and slots are data-driven (validated against runePaths.json at the data layer in
// a later step), so they're plain strings here rather than a hardcoded enum.
export const RuneSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  slot: z.string(),
  effects: z.array(EffectSchema),
})
export type Rune = z.infer<typeof RuneSchema>
```

- [ ] **Step 4: Implement `build.ts`**

```ts
import { z } from 'zod'

export const BuildSchema = z.object({
  items: z.array(z.string()),
  boots: z.string().optional(),
  enchant: z.string().optional(),
  runes: z.array(z.string()),
  inputs: z.record(z.string(), z.union([z.number(), z.boolean()])),
})
export type Build = z.infer<typeof BuildSchema>
```

- [ ] **Step 5: Implement `target.ts`**

```ts
import { z } from 'zod'
import { BuildSchema } from './build'
import { EffectSchema } from './effect/effect'

export const TargetChampionSchema = z.object({
  kind: z.literal('champion'),
  champion: z.string(),
  level: z.number(),
  build: BuildSchema,
})

export const TargetDummySchema = z.object({
  kind: z.literal('dummy'),
  hp: z.number(),
  armor: z.number(),
  mr: z.number(),
  effects: z.array(EffectSchema).optional(),
})

export const TargetSchema = z.discriminatedUnion('kind', [TargetChampionSchema, TargetDummySchema])
export type Target = z.infer<typeof TargetSchema>
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @wr-calc/schema test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/schema/src/rune.ts packages/schema/src/build.ts packages/schema/src/target.ts \
  packages/schema/test/rune.test.ts packages/schema/test/build.test.ts packages/schema/test/target.test.ts
git commit -m "feat: add Rune, Build, Target schemas"
```

---

## Task 11: Schema validator (cross-field checks)

**Files:**
- Create: `packages/schema/src/validate/item.ts`
- Create: `packages/schema/src/validate/index.ts`
- Test: `packages/schema/test/validate.test.ts`

**Interfaces:**
- Consumes: `Item` type (Task 8).
- Produces: `validateItemCost(item, allItems: Map<string, Item>): string[]`,
  `validateRecipeIds(item, allItems: Map<string, Item>): string[]`,
  `validateUniqueGroups(item: Item): string[]`,
  `validateItemHandlers(item: Item, knownHandlerIds: Set<string>): string[]`,
  `validateItem(item, allItems, knownHandlerIds): string[]` (composes all four). No dependency on
  `packages/calc` — `knownHandlerIds` is supplied by the caller (the Step 6 plan's
  `packages/data/scripts/validate.ts`, which is the one place allowed to import both `schema` and
  `calc`).

- [ ] **Step 1: Write the failing test**

`packages/schema/test/validate.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import {
  validateItemCost, validateRecipeIds, validateUniqueGroups, validateItemHandlers, validateItem,
} from '../src/validate'
import type { Item } from '../src/item'

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'test-item',
    name: 'Test Item',
    tier: 'basic',
    cost: { total: 100, combine: 100 },
    recipe: [],
    stats: {},
    effects: [],
    tags: [],
    provenance: { source: 'manual', patch: '0.0.0', verifiedInGame: false },
    ...overrides,
  }
}

describe('validateItemCost', () => {
  it('passes when total equals sum of components plus combine', () => {
    const sword = makeItem({ id: 'long-sword', cost: { total: 350, combine: 350 } })
    const bfSword = makeItem({
      id: 'bf-sword', recipe: ['long-sword', 'long-sword'], cost: { total: 1300, combine: 600 },
    })
    const allItems = new Map([[sword.id, sword], [bfSword.id, bfSword]])
    expect(validateItemCost(bfSword, allItems)).toEqual([])
  })

  it('fails when total does not match component sum plus combine', () => {
    const sword = makeItem({ id: 'long-sword', cost: { total: 350, combine: 350 } })
    const bad = makeItem({ id: 'bad-item', recipe: ['long-sword'], cost: { total: 999, combine: 100 } })
    const allItems = new Map([[sword.id, sword], [bad.id, bad]])
    expect(validateItemCost(bad, allItems)).toHaveLength(1)
  })
})

describe('validateRecipeIds', () => {
  it('fails when a recipe references an unknown item id', () => {
    const item = makeItem({ recipe: ['does-not-exist'] })
    expect(validateRecipeIds(item, new Map())).toHaveLength(1)
  })

  it('passes when every recipe id resolves', () => {
    const sword = makeItem({ id: 'long-sword' })
    const item = makeItem({ recipe: ['long-sword'] })
    expect(validateRecipeIds(item, new Map([[sword.id, sword]]))).toEqual([])
  })
})

describe('validateUniqueGroups', () => {
  it('fails when two different effects in the same item share a uniqueGroup', () => {
    const item = makeItem({
      effects: [
        {
          id: 'a', name: 'A', description: '', support: 'full', kind: 'stat', stat: 'ad',
          amount: 10, uniqueGroup: 'shared',
        },
        {
          id: 'b', name: 'B', description: '', support: 'full', kind: 'stat', stat: 'ap',
          amount: 10, uniqueGroup: 'shared',
        },
      ] as Item['effects'],
    })
    expect(validateUniqueGroups(item)).toHaveLength(1)
  })

  it('passes when uniqueGroup values differ', () => {
    const item = makeItem({
      effects: [
        {
          id: 'a', name: 'A', description: '', support: 'full', kind: 'stat', stat: 'ad',
          amount: 10, uniqueGroup: 'group-a',
        },
        {
          id: 'b', name: 'B', description: '', support: 'full', kind: 'stat', stat: 'ap',
          amount: 10, uniqueGroup: 'group-b',
        },
      ] as Item['effects'],
    })
    expect(validateUniqueGroups(item)).toEqual([])
  })
})

describe('validateItemHandlers', () => {
  it('fails when a custom effect references an unregistered handler', () => {
    const item = makeItem({
      effects: [
        { id: 'a', name: 'A', description: '', support: 'partial', kind: 'custom', handler: 'unknownHandler' },
      ] as Item['effects'],
    })
    expect(validateItemHandlers(item, new Set(['knownHandler']))).toHaveLength(1)
  })

  it('passes when the handler is registered', () => {
    const item = makeItem({
      effects: [
        { id: 'a', name: 'A', description: '', support: 'partial', kind: 'custom', handler: 'knownHandler' },
      ] as Item['effects'],
    })
    expect(validateItemHandlers(item, new Set(['knownHandler']))).toEqual([])
  })
})

describe('validateItem (composed)', () => {
  it('unions errors from all four checks', () => {
    const item = makeItem({
      recipe: ['missing'],
      cost: { total: 1, combine: 1 },
      effects: [
        { id: 'a', name: 'A', description: '', support: 'partial', kind: 'custom', handler: 'nope' },
      ] as Item['effects'],
    })
    const errors = validateItem(item, new Map(), new Set())
    expect(errors.length).toBeGreaterThanOrEqual(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wr-calc/schema test`
Expected: FAIL — `../src/validate` not found.

- [ ] **Step 3: Implement `validate/item.ts`**

```ts
import type { Item } from '../item'

/** Checks cost.total === sum(component totals) + combine. */
export function validateItemCost(item: Item, allItems: Map<string, Item>): string[] {
  const errors: string[] = []
  const componentTotal = item.recipe.reduce((sum, id) => {
    const component = allItems.get(id)
    if (!component) return sum // reported separately by validateRecipeIds
    return sum + component.cost.total
  }, 0)
  if (componentTotal + item.cost.combine !== item.cost.total) {
    errors.push(
      `Item ${item.id}: cost.total (${item.cost.total}) !== sum(components)=${componentTotal} + combine=${item.cost.combine}`
    )
  }
  return errors
}

/** Checks every recipe component id resolves to a known item. */
export function validateRecipeIds(item: Item, allItems: Map<string, Item>): string[] {
  return item.recipe
    .filter((id) => !allItems.has(id))
    .map((id) => `Item ${item.id}: recipe references unknown item id '${id}'`)
}

/** Checks no two distinct effects on the same item accidentally share a uniqueGroup. */
export function validateUniqueGroups(item: Item): string[] {
  const errors: string[] = []
  const seenBy = new Map<string, string>()
  for (const effect of item.effects) {
    if (!effect.uniqueGroup) continue
    const existing = seenBy.get(effect.uniqueGroup)
    if (existing && existing !== effect.id) {
      errors.push(
        `Item ${item.id}: effects '${existing}' and '${effect.id}' both declare uniqueGroup '${effect.uniqueGroup}'`
      )
    }
    seenBy.set(effect.uniqueGroup, effect.id)
  }
  return errors
}

/**
 * Checks every custom-effect handler id is registered. Takes the known handler ids as a
 * parameter rather than importing packages/calc, so this package stays dependency-free; the
 * real handler registry is threaded in by the caller.
 */
export function validateItemHandlers(item: Item, knownHandlerIds: Set<string>): string[] {
  const errors: string[] = []
  for (const effect of item.effects) {
    if (effect.kind === 'custom' && !knownHandlerIds.has(effect.handler)) {
      errors.push(`Item ${item.id}: unknown custom handler '${effect.handler}'`)
    }
  }
  return errors
}
```

- [ ] **Step 4: Implement `validate/index.ts`**

```ts
import type { Item } from '../item'
import {
  validateItemCost, validateRecipeIds, validateUniqueGroups, validateItemHandlers,
} from './item'

export {
  validateItemCost, validateRecipeIds, validateUniqueGroups, validateItemHandlers,
}

/** Runs every structural and cross-field check for a single item. */
export function validateItem(
  item: Item,
  allItems: Map<string, Item>,
  knownHandlerIds: Set<string>
): string[] {
  return [
    ...validateItemCost(item, allItems),
    ...validateRecipeIds(item, allItems),
    ...validateUniqueGroups(item),
    ...validateItemHandlers(item, knownHandlerIds),
  ]
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @wr-calc/schema test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/schema/src/validate packages/schema/test/validate.test.ts
git commit -m "feat: add schema validator (cost, recipe ids, unique groups, handler ids)"
```

---

## Task 12: Schema package barrel export

**Files:**
- Modify: `packages/schema/src/index.ts`
- Test: `packages/schema/test/index.test.ts`

**Interfaces:**
- Consumes: every schema module built in Tasks 2–11.
- Produces: `packages/schema`'s public surface — every schema, type, and validator function
  importable as `import { ... } from '@wr-calc/schema'`. This is what `packages/calc`,
  `packages/data`, and (later) `apps/web` import against.

- [ ] **Step 1: Write the failing test**

`packages/schema/test/index.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import * as schema from '../src/index'

describe('@wr-calc/schema public surface', () => {
  it('exports the core schemas', () => {
    expect(schema.StatKeySchema).toBeDefined()
    expect(schema.ScalarSchema).toBeDefined()
    expect(schema.EffectSchema).toBeDefined()
    expect(schema.ItemSchema).toBeDefined()
    expect(schema.ChampionSchema).toBeDefined()
    expect(schema.AbilitySchema).toBeDefined()
    expect(schema.RuneSchema).toBeDefined()
    expect(schema.BuildSchema).toBeDefined()
    expect(schema.TargetSchema).toBeDefined()
  })

  it('exports the validator', () => {
    expect(schema.validateItem).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wr-calc/schema test`
Expected: FAIL — `index.ts` still just `export {}`.

- [ ] **Step 3: Implement `index.ts`**

```ts
export * from './stat-key'
export * from './scalar'
export * from './effect/effect'
export * from './provenance'
export * from './item'
export * from './ability'
export * from './champion'
export * from './rune'
export * from './build'
export * from './target'
export * from './validate'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @wr-calc/schema test`
Expected: PASS.

Run: `pnpm typecheck`
Expected: no errors, including no export-name collisions across the barrel (if TypeScript flags a
duplicate export, resolve it by exporting the conflicting name explicitly from only one module
rather than via `export *`).

- [ ] **Step 5: Commit**

```bash
git add packages/schema/src/index.ts packages/schema/test/index.test.ts
git commit -m "feat: export full public surface from @wr-calc/schema"
```

---

## Task 13: rules.ts (TODO-VERIFY constants)

**Files:**
- Create: `packages/calc/src/rules.ts`
- Modify: `packages/calc/src/index.ts`
- Test: `packages/calc/test/rules.test.ts`

**Interfaces:**
- Consumes: nothing (pure constants/functions, no schema dependency needed at this stage).
- Produces: `MAX_CHAMPION_LEVEL`, `BASE_CRIT_DAMAGE_MULTIPLIER`, `ATTACK_SPEED_CAP`,
  `statAtLevel(base, perLevel, level): number`,
  `interpolateLevelRange(min, max, level): number`,
  `resolveAdaptiveDamageType(bonusAd, ap): 'physical' | 'magic'`,
  `RESIST_MODIFICATION_ORDER`, `UNIQUE_EFFECT_RESOLUTION`, `ITEM_SLOTS`,
  `HAS_SEPARATE_BOOTS_SLOT`, `HAS_SEPARATE_ENCHANT_SLOT`, `UNVERIFIED_RULE_IDS`,
  `UnverifiedRuleId` type — consumed by `resolveStats` (Step 2 plan), `mitigation.ts` (Step 3
  plan), and `simulateCombo` (Step 4 plan).

- [ ] **Step 1: Write the failing test**

`packages/calc/test/rules.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import {
  MAX_CHAMPION_LEVEL, statAtLevel, interpolateLevelRange, resolveAdaptiveDamageType,
  UNVERIFIED_RULE_IDS,
} from '../src/rules'

describe('statAtLevel', () => {
  it('returns base at level 1', () => {
    expect(statAtLevel(100, 10, 1)).toBe(100)
  })

  it('returns base + full linear growth at max level', () => {
    expect(statAtLevel(100, 10, MAX_CHAMPION_LEVEL)).toBeCloseTo(
      100 + 10 * (MAX_CHAMPION_LEVEL - 1), 5
    )
  })

  it('grows non-linearly: late-level increments exceed early-level increments', () => {
    const early = statAtLevel(100, 10, 2) - statAtLevel(100, 10, 1)
    const late = statAtLevel(100, 10, MAX_CHAMPION_LEVEL) - statAtLevel(100, 10, MAX_CHAMPION_LEVEL - 1)
    expect(late).toBeGreaterThan(early)
  })
})

describe('interpolateLevelRange', () => {
  it('returns min at level 1', () => {
    expect(interpolateLevelRange(10, 50, 1)).toBe(10)
  })

  it('returns max at max level', () => {
    expect(interpolateLevelRange(10, 50, MAX_CHAMPION_LEVEL)).toBe(50)
  })

  it('clamps levels above the cap', () => {
    expect(interpolateLevelRange(10, 50, 999)).toBe(50)
  })

  it('clamps levels below 1', () => {
    expect(interpolateLevelRange(10, 50, 0)).toBe(10)
  })
})

describe('resolveAdaptiveDamageType', () => {
  it('resolves to physical when bonus AD >= AP', () => {
    expect(resolveAdaptiveDamageType(50, 30)).toBe('physical')
  })

  it('resolves to magic when AP > bonus AD', () => {
    expect(resolveAdaptiveDamageType(30, 50)).toBe('magic')
  })
})

describe('UNVERIFIED_RULE_IDS', () => {
  it('is non-empty and has no duplicates', () => {
    expect(UNVERIFIED_RULE_IDS.length).toBeGreaterThan(0)
    expect(new Set(UNVERIFIED_RULE_IDS).size).toBe(UNVERIFIED_RULE_IDS.length)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wr-calc/calc test`
Expected: FAIL — `rules.ts` not found.

- [ ] **Step 3: Implement `rules.ts`**

```ts
/**
 * Mechanics believed true but not yet confirmed against the live game. Every constant/function
 * here is marked TODO-VERIFY with a note on how to check it in the practice tool. Never scatter
 * unverified mechanics outside this file.
 */

// TODO-VERIFY(maxChampionLevel): confirm the champion level cap in the practice tool by leveling
// a champion to max in a custom game and reading the level indicator.
export const MAX_CHAMPION_LEVEL = 15

// TODO-VERIFY(critDamageMultiplier): confirm the base crit multiplier by comparing a non-crit vs
// crit auto-attack in the combat log on a target dummy with no bonus crit damage sources.
export const BASE_CRIT_DAMAGE_MULTIPLIER = 1.75

// TODO-VERIFY(attackSpeedCap): confirm the attack speed cap by stacking AS items on a fast-AS
// champion until the attack interval stops decreasing, and reading the displayed AS value.
export const ATTACK_SPEED_CAP = 2.5

const GROWTH_CURVE_A = 0.7025
const GROWTH_CURVE_B = (1 - GROWTH_CURVE_A) / (MAX_CHAMPION_LEVEL - 1)

// TODO-VERIFY(statGrowthCurve): confirm the growth curve shape (assumed to follow the classic
// LoL non-linear per-level formula, rescaled so full growth lands at MAX_CHAMPION_LEVEL instead
// of the PC game's level 18) by recording a champion's displayed stats at every level 1-15 in
// the practice tool and fitting them against this formula.
/** Resolves a champion stat at a given level from its base and per-level growth. */
export function statAtLevel(base: number, perLevel: number, level: number): number {
  if (level <= 1) return base
  const n = level - 1
  const factor = GROWTH_CURVE_A + GROWTH_CURVE_B * n
  return base + perLevel * n * factor
}

// TODO-VERIFY(levelRangeInterpolation): confirm "X-Y based on level" values interpolate linearly
// across levels 1..MAX_CHAMPION_LEVEL by checking an ability tooltip's displayed value at two
// different champion levels and confirming it falls on a straight line between min and max.
/** Resolves a `{ levelRange: { min, max } }` Scalar at a given champion level. */
export function interpolateLevelRange(min: number, max: number, level: number): number {
  const clampedLevel = Math.min(Math.max(level, 1), MAX_CHAMPION_LEVEL)
  const t = (clampedLevel - 1) / (MAX_CHAMPION_LEVEL - 1)
  return min + (max - min) * t
}

// TODO-VERIFY(adaptiveDamageType): confirm adaptive damage picks physical vs magic by comparing
// bonus AD to AP (believed: physical if bonusAd >= ap, else magic) on a dummy with a known
// adaptive-damage rune/item equipped at two different stat ratios.
/** Resolves whether an adaptive-damage effect deals physical or magic damage. */
export function resolveAdaptiveDamageType(bonusAd: number, ap: number): 'physical' | 'magic' {
  return bonusAd >= ap ? 'physical' : 'magic'
}

// TODO-VERIFY(resistModificationOrder): confirm resist modification order by applying a flat
// reduction, a % reduction, and armor pen together on a known-armor dummy and checking the
// resulting mitigation matches this order rather than a different one.
export const RESIST_MODIFICATION_ORDER = [
  'flatReduction', 'pctReduction', 'pctPen', 'flatPen',
] as const

// TODO-VERIFY(uniqueEffectResolution): confirm whether two items sharing a uniqueGroup resolve
// to the stronger effect or the first-acquired one, by buying both in-game and checking which
// passive is shown as active.
export const UNIQUE_EFFECT_RESOLUTION: 'strongest' | 'first' = 'strongest'

// TODO-VERIFY(itemSlots): confirm the inventory holds 6 item slots plus a separate boots slot
// and a separate enchant slot (i.e. boots/enchant don't consume one of the 6), in a custom game.
export const ITEM_SLOTS = 6
export const HAS_SEPARATE_BOOTS_SLOT = true
export const HAS_SEPARATE_ENCHANT_SLOT = true

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
] as const
export type UnverifiedRuleId = (typeof UNVERIFIED_RULE_IDS)[number]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @wr-calc/calc test`
Expected: PASS.

- [ ] **Step 5: Export from the calc package index**

`packages/calc/src/index.ts`:
```ts
export * from './rules'
```

- [ ] **Step 6: Full workspace verification**

Run:
```bash
pnpm typecheck
pnpm test
```
Expected: both succeed across every package (`@wr-calc/data` still has no tests —
`passWithNoTests: true` makes that a pass, not a failure).

- [ ] **Step 7: Commit**

```bash
git add packages/calc/src/rules.ts packages/calc/src/index.ts packages/calc/test/rules.test.ts
git commit -m "feat: add rules.ts with TODO-VERIFY mechanics constants"
```

---

## Final check

- [ ] Run `pnpm typecheck && pnpm test` one more time from the repo root; both must be clean.
- [ ] Confirm every `Effect` kind from the design doc has a schema, a place in `EffectSchema`,
  and a passing test (17 kinds: stat, statMultiplier, statConversion, stacking, onHit,
  spellblade, procEveryN, dot, resistShred, penetration, damageAmp, cooldownRefund,
  damageReduction, shield, heal, active, custom).
- [ ] Confirm `rules.ts` has no bare numeric/behavioral constant lacking a `// TODO-VERIFY(id)`
  comment and a corresponding entry in `UNVERIFIED_RULE_IDS`.
