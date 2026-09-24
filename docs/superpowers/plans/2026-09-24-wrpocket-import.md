# wrpocket.app Data Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import all patch 7.3 champions (142) and items (171) from wrpocket.app into `packages/data` as generated TypeScript, and hand-fill the 15 starter items from the site's English text, so the engine runs on real numbers.

**Architecture:** A re-runnable `tsx` script in `packages/data/scripts/`. It fetches into a gitignored cache, maps the data with pure, unit-tested modules, and writes committed `generated/*.ts` files plus an import report. `PATCH_7_3_ITEMS` merges the generated items with the hand-written starter items, and the starter items win on the same id. `PATCH_7_3_CHAMPIONS` is the generated list.

**Tech Stack:** TypeScript 5.9, zod 3 (existing), Vitest 1.6 (existing), `tsx` (new devDependency), Node 24 global `fetch`.

**Spec:** `docs/superpowers/specs/2026-09-24-wrpocket-import-design.md`

## Global Constraints

- Branch: `feat/tvanmook/wrpocket-import/20260924`, created from `docs/tvanmook/phase1-step7-design/20260918`. Never commit to `main`.
- Commit prefixes: `feat:`, `fix:`, `test:`, `docs:`, `chore:`.
- Conflict rule: **English text wins.** Ability base damage uses the text when it has every rank. It falls back to the table when the text shows only rank 1 and the table's rank 1 matches. Real conflicts are logged in the report.
- Percentages become fractions (`30` → `0.3`). Round with `Number(value.toFixed(6))`.
- Every imported or site-filled entry uses `WRPOCKET_7_3_PROVENANCE = { source: 'wiki', patch: '7.3', verifiedInGame: false }`. `PATCH_7_3_PROVENANCE` (`manual`) is unchanged.
- Generated files are never hand-edited. Change the mapper and re-run the import instead.
- No network access in tests. The mapping modules are pure. Only `scripts/import-wrpocket.ts` does I/O.
- The `@wr-calc/data` root entry must stay browser-safe: generated files import only `type`s and `../provenance`. The existing `browser-safe-entry.test.ts` must keep passing.
- Never touch `.env*`. Never weaken a test to make it pass. Tests rewritten here change to **new requirements** stated in the spec (§6), not to hide failures.
- Run `pnpm test && pnpm typecheck` from the repo root before marking any task done.
- TypeScript strict, and a one-sentence docstring on every exported function.

## File Map

| File | Responsibility |
|---|---|
| `packages/data/scripts/wrpocket/raw-schemas.ts` | zod schemas and types for the site's JSON |
| `packages/data/scripts/wrpocket/ids.ts` | `ID_ALIASES`, `normalizeId` |
| `packages/data/scripts/wrpocket/parse-ability.ts` | `round`, `parseRanks`, `toScalar`, `parseRatios`, `findTextDamage`, `damageTypesIn` |
| `packages/data/scripts/wrpocket/map-item.ts` | `mapItemStats`, `mapItem` |
| `packages/data/scripts/wrpocket/map-champion.ts` | `fitGrowth`, `fitAttackSpeed`, `mapChampion` |
| `packages/data/scripts/wrpocket/render.ts` | `renderModule`, `renderReport` |
| `packages/data/scripts/import-wrpocket.ts` | fetch → map → write entry point |
| `packages/data/tsconfig.scripts.json` | typechecks `scripts/` and `test/wrpocket/` |
| `packages/data/src/patches/7.3/generated/{items,champions}.ts`, `IMPORT_REPORT.md` | generated output (committed) |
| `packages/data/src/patches/7.3/items.ts` | `STARTER_ITEMS` (hand-filled) |
| `packages/data/src/patches/7.3/index.ts` | merged `PATCH_7_3_ITEMS`, `PATCH_7_3_CHAMPIONS`, `PATCH_7_3_CATALOG` |
| `packages/data/src/catalog.ts` | + `mergeById` |

---

### Task 1: Tooling, raw schemas, ids and ability-text parsing

**Files:**
- Create: `packages/data/tsconfig.scripts.json`, `packages/data/scripts/wrpocket/raw-schemas.ts`, `packages/data/scripts/wrpocket/ids.ts`, `packages/data/scripts/wrpocket/parse-ability.ts`
- Modify: `packages/data/package.json` (devDependency `tsx`, script), root `package.json` (`typecheck`), root `.gitignore` (`.cache/`)
- Test: `packages/data/test/wrpocket/parse-ability.test.ts`

**Interfaces:**
- Produces (`raw-schemas.ts`): `RawMetaSchema`, `RawItemSchema`, `RawChampionSummarySchema`, `RawChampionSchema`, and the types `RawMeta`, `RawItem`, `RawAbility`, `RawChampion`.
- Produces (`ids.ts`): `ID_ALIASES: Record<string, string>`, `normalizeId(id: string): string`
- Produces (`parse-ability.ts`):
  - `round(value: number): number`
  - `parseRanks(text: string): number[] | null`
  - `toScalar(values: number[]): Scalar`
  - `parseRatios(group: string): { ratios: DamageComponent['ratios']; unparsed: string[] }`
  - `findTextDamage(text: string): { base: number[]; ratioGroup: string; type: DamageType; isRangeUpperBound: boolean } | null`
  - `damageTypesIn(text: string): DamageType[]`

- [ ] **Step 1: Create the branch and tooling**

```bash
git switch docs/tvanmook/phase1-step7-design/20260918
git switch -c feat/tvanmook/wrpocket-import/20260924
pnpm --filter @wr-calc/data add -D tsx@^4.23.0
```

In `packages/data/package.json` `scripts`, add:

```json
"import:wrpocket": "tsx scripts/import-wrpocket.ts"
```

Create `packages/data/tsconfig.scripts.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": false,
    "declaration": false,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["scripts", "test/wrpocket"]
}
```

Root `package.json`: change `typecheck` to

```json
"typecheck": "tsc -b && tsc -p packages/data/tsconfig.scripts.json",
```

(The Step 7 plan later appends `&& pnpm --filter @wr-calc/web typecheck`. Task 6 below updates that plan's text.)

Root `.gitignore`: append `.cache/`.

- [ ] **Step 2: Write `raw-schemas.ts` and `ids.ts`**

`packages/data/scripts/wrpocket/raw-schemas.ts`:

```ts
import { z } from 'zod'

// Only the fields the importer reads; .passthrough() tolerates everything else the site adds.
const LocalizedSchema = z.object({ en: z.string() }).passthrough()

export const RawMetaSchema = z.object({ patch: z.string(), updated: z.string() }).passthrough()

export const RawItemSchema = z.object({
  id: z.string(),
  name: LocalizedSchema,
  description: LocalizedSchema,
  price: z.string(),
  numeric_stats: z.record(z.string(), z.number()),
  category: LocalizedSchema,
  tier: z.string(),
  components: z.array(z.string()),
}).passthrough()

export const RawChampionSummarySchema = z.array(z.object({ id: z.string() }).passthrough())

const RawScalingSchema = z.object({
  type: z.string(),
  value: z.union([z.string(), z.number()]).transform(String),
}).passthrough()

const RawAbilitySchema = z.object({
  name: LocalizedSchema,
  description: LocalizedSchema,
  scaling: z.array(RawScalingSchema),
}).passthrough()

export const RawChampionSchema = z.object({
  id: z.string(),
  name: LocalizedSchema,
  stats: z.record(z.string(), z.record(z.string(), z.number())),
  abilities: z.record(z.string(), RawAbilitySchema),
}).passthrough()

export type RawMeta = z.infer<typeof RawMetaSchema>
export type RawItem = z.infer<typeof RawItemSchema>
export type RawAbility = z.infer<typeof RawAbilitySchema>
export type RawChampion = z.infer<typeof RawChampionSchema>
```

`packages/data/scripts/wrpocket/ids.ts`:

```ts
/** wrpocket ids that differ from this repo's ids. */
export const ID_ALIASES: Record<string, string> = {
  'b.-f.-sword': 'bf-sword',
  'nunu-and-willump': 'nunu-willump',
}

/** Maps a wrpocket id to this repo's id. */
export function normalizeId(id: string): string {
  return ID_ALIASES[id] ?? id
}
```

- [ ] **Step 3: Write the failing test**

`packages/data/test/wrpocket/parse-ability.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  damageTypesIn, findTextDamage, parseRanks, parseRatios, round, toScalar,
} from '../../scripts/wrpocket/parse-ability'
import { normalizeId } from '../../scripts/wrpocket/ids'

describe('round', () => {
  it('removes float noise', () => {
    expect(round(0.1 + 0.2)).toBe(0.3)
    expect(round(35 / 100)).toBe(0.35)
  })
})

describe('parseRanks', () => {
  it.each<[string, number[] | null]>([
    ['8/7/6/5', [8, 7, 6, 5]],
    ['8 / 7 / 6 / 5', [8, 7, 6, 5]],
    ['30%/40%/50%', [30, 40, 50]],
    ['13.5/13/12.5/12', [13.5, 13, 12.5, 12]],
    ['14', [14]],
    ['abc', null],
    ['', null],
    ['1//2', null],
  ])('parses %j', (text, expected) => {
    expect(parseRanks(text)).toEqual(expected)
  })
})

describe('toScalar', () => {
  it('returns a plain number for one rank and byRank otherwise', () => {
    expect(toScalar([5])).toBe(5)
    expect(toScalar([1, 2])).toEqual({ byRank: [1, 2] })
  })
})

describe('parseRatios', () => {
  it('parses AP and bonus Health', () => {
    expect(parseRatios('+65% AP +5% bonus Health')).toEqual({
      ratios: [{ stat: 'ap', value: 0.65 }, { stat: 'bonusHp', value: 0.05 }], unparsed: [],
    })
  })

  it('parses per-rank ratios', () => {
    expect(parseRatios('+75% / 80% / 85% / 90% AD')).toEqual({
      ratios: [{ stat: 'totalAd', value: { byRank: [0.75, 0.8, 0.85, 0.9] } }], unparsed: [],
    })
  })

  it.each<[string, string, number]>([
    ['+160% AD', 'totalAd', 1.6],
    ['+40% bonus AD', 'bonusAd', 0.4],
    ['+2%AP', 'ap', 0.02],
    ['+9% max Health', 'maxHp', 0.09],
    ['+3% HP', 'maxHp', 0.03],
  ])('parses %s', (group, stat, value) => {
    expect(parseRatios(group)).toEqual({ ratios: [{ stat, value }], unparsed: [] })
  })

  it('reports parts it cannot map, keeping the ones it can', () => {
    expect(parseRatios('+ 45% AP + 2% bonus Mana')).toEqual({
      ratios: [{ stat: 'ap', value: 0.45 }], unparsed: ['2% bonus Mana'],
    })
    expect(parseRatios('+0.5 AP')).toEqual({ ratios: [], unparsed: ['0.5 AP'] })
  })
})

describe('findTextDamage', () => {
  it('reads per-rank base damage, ratios and type', () => {
    expect(findTextDamage(
      'Hurls a fireball, dealing 80 / 130 / 180 / 230 (+85% AP) magic damage.',
    )).toEqual({ base: [80, 130, 180, 230], ratioGroup: '+85% AP', type: 'magic', isRangeUpperBound: false })
  })

  it('reads "bonus <type> damage" phrases', () => {
    expect(findTextDamage('Attacks deal 12 (+10% Armor) bonus magic damage.')).toMatchObject({
      base: [12], type: 'magic',
    })
  })

  it('flags the upper end of a damage range', () => {
    expect(findTextDamage(
      'dealing 25 (+12% bonus AD)–250 (+120% bonus AD) physical damage plus more',
    )).toEqual({ base: [250], ratioGroup: '+120% bonus AD', type: 'physical', isRangeUpperBound: true })
  })

  it('returns null when there is no damage phrase', () => {
    expect(findTextDamage('Gains 32 (based on level) Move Speed while out of combat.')).toBeNull()
  })
})

describe('damageTypesIn', () => {
  it('lists each distinct damage type once, in order of appearance', () => {
    expect(damageTypesIn('deals magic damage, then physical damage, then magic damage')).toEqual([
      'magic', 'physical',
    ])
  })
})

describe('normalizeId', () => {
  it('maps known aliases and passes others through', () => {
    expect(normalizeId('b.-f.-sword')).toBe('bf-sword')
    expect(normalizeId('nunu-and-willump')).toBe('nunu-willump')
    expect(normalizeId('jinx')).toBe('jinx')
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm --filter @wr-calc/data test wrpocket/parse-ability`
Expected: FAIL. The `../../scripts/wrpocket/parse-ability` module doesn't exist yet.

- [ ] **Step 5: Implement `parse-ability.ts`**

`packages/data/scripts/wrpocket/parse-ability.ts`:

```ts
import type { DamageComponent, DamageRatioStat, DamageType, Scalar } from '@wr-calc/schema'

/** Rounds to 6 decimals, removing float noise like 0.35000000000000003. */
export function round(value: number): number {
  return Number(value.toFixed(6))
}

/** Parses "8/7/6/5", "8 / 7 / 6 / 5", "30%/40%" or "14" into numbers; null if any part isn't a number. */
export function parseRanks(text: string): number[] | null {
  const parts = text.split('/').map((part) => part.trim().replace(/%$/, '').trim())
  const values = parts.map(Number)
  return parts.every((part) => part !== '') && values.every(Number.isFinite) ? values : null
}

/** Turns per-rank values into a Scalar: a plain number for a single rank, byRank otherwise. */
export function toScalar(values: number[]): Scalar {
  return values.length === 1 ? values[0] : { byRank: values }
}

// Order matters: "bonus AD" must be tried before "AD".
const RATIO_STATS: Array<[RegExp, DamageRatioStat]> = [
  [/^bonus AD$/i, 'bonusAd'],
  [/^AD$/i, 'totalAd'],
  [/^AP$/i, 'ap'],
  [/^bonus (Health|HP)$/i, 'bonusHp'],
  [/^(max Health|HP)$/i, 'maxHp'],
]
// "75% / 80% / 85% / 90% AD" → values "75% / 80% / 85% / 90", label "AD".
const RATIO_PART = /^((?:[\d.]+\s*%\s*\/\s*)*[\d.]+)\s*%\s*(.+)$/

/** Parses the inside of a "(+65% AP +5% bonus Health)" group into damage ratios, reporting parts it can't map. */
export function parseRatios(group: string): { ratios: DamageComponent['ratios']; unparsed: string[] } {
  const ratios: DamageComponent['ratios'] = []
  const unparsed: string[] = []
  for (const part of group.split('+').map((piece) => piece.trim()).filter((piece) => piece !== '')) {
    const match = RATIO_PART.exec(part)
    const values = match ? parseRanks(match[1]) : null
    const stat = match ? RATIO_STATS.find(([pattern]) => pattern.test(match[2].trim()))?.[1] : undefined
    if (!values || !stat) {
      unparsed.push(part)
      continue
    }
    ratios.push({ stat, value: toScalar(values.map((value) => round(value / 100))) })
  }
  return { ratios, unparsed }
}

const DAMAGE_TYPES: Record<string, DamageType> = { physical: 'physical', magic: 'magic', true: 'true' }
const DAMAGE_PHRASE = /(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)*)\s*\(([^()]*)\)\s*(?:bonus\s+)?(physical|magic|true) damage/

/** Finds the first "N (+ratios) <type> damage" phrase in ability text. */
export function findTextDamage(
  text: string,
): { base: number[]; ratioGroup: string; type: DamageType; isRangeUpperBound: boolean } | null {
  const match = DAMAGE_PHRASE.exec(text)
  if (!match) return null
  const base = parseRanks(match[1])
  const type = DAMAGE_TYPES[match[3]]
  if (!base || !type) return null
  const before = text.slice(0, match.index).trimEnd()
  return {
    base, ratioGroup: match[2], type,
    // "25 (+12% bonus AD)–250 (+120% bonus AD) physical damage": the regex matches the upper end.
    isRangeUpperBound: before.endsWith('–') || before.endsWith('-'),
  }
}

/** Lists the distinct damage types a text mentions, in order of first appearance. */
export function damageTypesIn(text: string): DamageType[] {
  const found: DamageType[] = []
  for (const match of text.matchAll(/(physical|magic|true) damage/g)) {
    const type = DAMAGE_TYPES[match[1]]
    if (type && !found.includes(type)) found.push(type)
  }
  return found
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter @wr-calc/data test wrpocket/parse-ability`
Expected: PASS.

Run: `pnpm test && pnpm typecheck` from the repo root.
Expected: all pass. The new `tsc -p packages/data/tsconfig.scripts.json` typechecks `scripts/` and `test/wrpocket/`.

- [ ] **Step 7: Commit**

```bash
git add packages/data package.json pnpm-lock.yaml .gitignore
git commit -m "feat: add wrpocket importer tooling and ability-text parsers"
```

---

### Task 2: Item mapping

**Files:**
- Create: `packages/data/scripts/wrpocket/map-item.ts`
- Test: `packages/data/test/wrpocket/map-item.test.ts`

**Interfaces:**
- Consumes: `RawItem` (Task 1), `normalizeId` (Task 1), `round` (Task 1); `Item`, `Provenance`, `StatKey` from `@wr-calc/schema`.
- Produces:
  - `interface Mapped<T> { value: T; notes: string[] }`
  - `mapItemStats(raw: Record<string, number>): Mapped<Item['stats']>`
  - `mapItem(raw: RawItem, rawPrices: Map<string, number>, provenance: Provenance): Mapped<Item>`. `rawPrices` is keyed by the **raw** (un-normalized) item id.

- [ ] **Step 1: Write the failing test**

`packages/data/test/wrpocket/map-item.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { ItemSchema } from '@wr-calc/schema'
import type { Provenance } from '@wr-calc/schema'
import { mapItem, mapItemStats } from '../../scripts/wrpocket/map-item'
import type { RawItem } from '../../scripts/wrpocket/raw-schemas'

const PROVENANCE: Provenance = { source: 'wiki', patch: '7.3', verifiedInGame: false }

function rawItem(overrides: Partial<RawItem>): RawItem {
  return {
    id: 'test-item', name: { en: 'Test Item' }, description: { en: 'Text.' }, price: '1000',
    numeric_stats: {}, category: { en: 'Physical' }, tier: 'upgraded', components: [],
    ...overrides,
  }
}

describe('mapItemStats', () => {
  it('maps keys and turns percentages into fractions', () => {
    expect(mapItemStats({
      attackDamage: 40, attackSpeed: 30, lifeSteal: 12, criticalRate: 25, moveSpeedPercent: 4,
      abilityPower: 95, magicPenPercent: 40, armorPen: 12, health: 333, magicResist: 60,
    })).toEqual({
      value: {
        ad: 40, attackSpeed: 0.3, lifesteal: 0.12, critChance: 0.25, moveSpeedPct: 0.04,
        ap: 95, pctMagicPen: 0.4, flatArmorPen: 12, hp: 333, mr: 60,
      },
      notes: [],
    })
  })

  it('skips % base regen stats and unknown keys with a note each', () => {
    const result = mapItemStats({ health: 700, healthRegen: 150, manaRegen: 50, fooStat: 3 })
    expect(result.value).toEqual({ hp: 700 })
    expect(result.notes).toEqual([
      "stat 'healthRegen' (150) skipped: it is a % of base regen, but hpRegen/manaRegen here are flat",
      "stat 'manaRegen' (50) skipped: it is a % of base regen, but hpRegen/manaRegen here are flat",
      "unknown stat 'fooStat' (3) skipped",
    ])
  })
})

describe('mapItem', () => {
  const prices = new Map([['long-sword', 500], ['b.-f.-sword', 1500]])

  it('maps id, name, tier, recipe, cost and tags', () => {
    const { value, notes } = mapItem(rawItem({
      id: 'b.-f.-sword', name: { en: 'B. F. Sword' }, price: '1500', tier: 'intermediate',
      numeric_stats: { attackDamage: 40 }, components: ['long-sword', 'long-sword'],
    }), prices, PROVENANCE)
    expect(value).toEqual({
      id: 'bf-sword', name: 'B. F. Sword', tier: 'epic',
      cost: { total: 1500, combine: 500 }, recipe: ['long-sword', 'long-sword'],
      stats: { ad: 40 }, effects: [], tags: ['physical'], provenance: PROVENANCE,
    })
    expect(notes).toEqual([])
    expect(() => ItemSchema.parse(value)).not.toThrow()
  })

  it.each<[string, string, string]>([
    ['Boots', 'intermediate', 'boots'],
    ['Support', 'upgraded', 'support'],
    ['Magic', 'basic', 'basic'],
    ['Magic', 'intermediate', 'epic'],
    ['Defense', 'upgraded', 'legendary'],
  ])('category %s + tier %s → %s', (category, tier, expected) => {
    expect(mapItem(rawItem({ category: { en: category }, tier }), prices, PROVENANCE).value.tier).toBe(expected)
  })

  it('notes an unknown site tier and treats it as legendary', () => {
    const { value, notes } = mapItem(rawItem({ tier: 'mythic' }), prices, PROVENANCE)
    expect(value.tier).toBe('legendary')
    expect(notes).toEqual(["unknown tier 'mythic', treated as legendary"])
  })

  it('clamps a negative combine cost to 0 with a note', () => {
    const { value, notes } = mapItem(rawItem({ price: '400', components: ['long-sword'] }), prices, PROVENANCE)
    expect(value.cost).toEqual({ total: 400, combine: 0 })
    expect(notes).toEqual(['components cost 500, more than the item (400); combine set to 0'])
  })

  it('uses the total as combine when a component price is unknown', () => {
    const { value, notes } = mapItem(rawItem({ price: '900', components: ['mystery'] }), prices, PROVENANCE)
    expect(value.cost).toEqual({ total: 900, combine: 900 })
    expect(notes).toEqual(["unknown component 'mystery'; combine set to total"])
  })

  it('throws on a non-numeric price', () => {
    expect(() => mapItem(rawItem({ price: 'free' }), prices, PROVENANCE)).toThrow(/test-item: price 'free'/)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @wr-calc/data test wrpocket/map-item`
Expected: FAIL. The `../../scripts/wrpocket/map-item` module doesn't exist yet.

- [ ] **Step 3: Implement**

`packages/data/scripts/wrpocket/map-item.ts`:

```ts
import type { Item, Provenance, StatKey } from '@wr-calc/schema'
import type { RawItem } from './raw-schemas'
import { normalizeId } from './ids'
import { round } from './parse-ability'

export interface Mapped<T> {
  value: T
  notes: string[]
}

// scale 0.01 = the site gives a percentage; this repo stores fractions.
const STAT_MAP: Record<string, { key: StatKey; scale: number } | undefined> = {
  attackDamage: { key: 'ad', scale: 1 },
  abilityPower: { key: 'ap', scale: 1 },
  health: { key: 'hp', scale: 1 },
  armor: { key: 'armor', scale: 1 },
  magicResist: { key: 'mr', scale: 1 },
  abilityHaste: { key: 'abilityHaste', scale: 1 },
  mana: { key: 'mana', scale: 1 },
  moveSpeed: { key: 'moveSpeed', scale: 1 },
  armorPen: { key: 'flatArmorPen', scale: 1 },
  magicPen: { key: 'flatMagicPen', scale: 1 },
  attackSpeed: { key: 'attackSpeed', scale: 0.01 },
  criticalRate: { key: 'critChance', scale: 0.01 },
  moveSpeedPercent: { key: 'moveSpeedPct', scale: 0.01 },
  armorPenPercent: { key: 'pctArmorPen', scale: 0.01 },
  magicPenPercent: { key: 'pctMagicPen', scale: 0.01 },
  lifeSteal: { key: 'lifesteal', scale: 0.01 },
  healShieldPower: { key: 'healShieldPower', scale: 0.01 },
  tenacity: { key: 'tenacity', scale: 0.01 },
}
const PERCENT_OF_BASE_REGEN = new Set(['healthRegen', 'manaRegen'])
const TIER_MAP: Record<string, Item['tier'] | undefined> = {
  basic: 'basic', intermediate: 'epic', upgraded: 'legendary',
}

/** Maps wrpocket numeric_stats onto this repo's stat keys, noting every key it had to skip. */
export function mapItemStats(raw: Record<string, number>): Mapped<Item['stats']> {
  const stats: Item['stats'] = {}
  const notes: string[] = []
  for (const [key, amount] of Object.entries(raw)) {
    const mapping = STAT_MAP[key]
    if (mapping) stats[mapping.key] = round(amount * mapping.scale)
    else if (PERCENT_OF_BASE_REGEN.has(key)) {
      notes.push(`stat '${key}' (${amount}) skipped: it is a % of base regen, but hpRegen/manaRegen here are flat`)
    } else notes.push(`unknown stat '${key}' (${amount}) skipped`)
  }
  return { value: stats, notes }
}

function tierOf(raw: RawItem, notes: string[]): Item['tier'] {
  if (raw.category.en === 'Boots') return 'boots'
  if (raw.category.en === 'Support') return 'support'
  const tier = TIER_MAP[raw.tier]
  if (tier) return tier
  notes.push(`unknown tier '${raw.tier}', treated as legendary`)
  return 'legendary'
}

/** Maps one wrpocket item to an Item with no modeled effects, noting anything it had to guess or skip. */
export function mapItem(raw: RawItem, rawPrices: Map<string, number>, provenance: Provenance): Mapped<Item> {
  const total = Number(raw.price)
  if (raw.price.trim() === '' || !Number.isFinite(total)) {
    throw new Error(`${raw.id}: price '${raw.price}' is not a number`)
  }
  const notes: string[] = []
  const tier = tierOf(raw, notes)

  let combine = total
  const unknown = raw.components.find((id) => !rawPrices.has(id))
  if (unknown !== undefined) {
    notes.push(`unknown component '${unknown}'; combine set to total`)
  } else {
    const componentTotal = raw.components.reduce((sum, id) => sum + (rawPrices.get(id) ?? 0), 0)
    combine = total - componentTotal
    if (combine < 0) {
      notes.push(`components cost ${componentTotal}, more than the item (${total}); combine set to 0`)
      combine = 0
    }
  }

  const stats = mapItemStats(raw.numeric_stats)
  return {
    value: {
      id: normalizeId(raw.id), name: raw.name.en, tier,
      cost: { total, combine }, recipe: raw.components.map(normalizeId),
      stats: stats.value, effects: [], tags: [raw.category.en.toLowerCase()], provenance,
    },
    notes: [...notes, ...stats.notes],
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @wr-calc/data test wrpocket/map-item`
Expected: PASS.

Run: `pnpm test && pnpm typecheck` from the repo root.
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/data/scripts/wrpocket/map-item.ts packages/data/test/wrpocket/map-item.test.ts
git commit -m "feat: map wrpocket items to the Item schema"
```

---

### Task 3: Champion mapping

**Files:**
- Create: `packages/data/scripts/wrpocket/map-champion.ts`
- Test: `packages/data/test/wrpocket/map-champion.test.ts`

**Interfaces:**
- Consumes: `RawChampion`, `RawAbility` (Task 1); `normalizeId`, `round`, `parseRanks`, `toScalar`, `parseRatios`, `findTextDamage`, `damageTypesIn` (Task 1); `Mapped` (Task 2); `MAX_CHAMPION_LEVEL` (= 15) from `@wr-calc/calc`; `Ability`, `Champion`, `DamageComponent`, `Provenance` from `@wr-calc/schema`.
- Produces:
  - `fitGrowth(level1: number, levelMax: number): { base: number; perLevel: number }`
  - `fitAttackSpeed(level1: number, levelMax: number): { base: number; ratio: number }`
  - `mapChampion(raw: RawChampion, provenance: Provenance): Mapped<Champion>`. Notes are prefixed with the ability slot (`q: ...`) or stat name. It throws if a level row or ability slot is missing.
- Site keys: stat columns `体力` hp, `体力自動回復` hpRegen, `マナ` mana, `マナ自動回復` manaRegen, `物理防御` armor, `魔法防御` mr, `攻撃力` ad, `移動速度` moveSpeed, `攻撃速度` attack speed. Level rows are `レベル1` … `レベル15`. Slots are `パッシブ` passive, `スキル1` q, `スキル2` w, `スキル3` e, `アルティメット` r. Scaling types are `cd`, `MP`, `基础伤害` (base damage) and `最大基础伤害` (max base damage, used for range phrases).

- [ ] **Step 1: Write the failing test**

`packages/data/test/wrpocket/map-champion.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { ChampionSchema } from '@wr-calc/schema'
import type { Provenance } from '@wr-calc/schema'
import { fitAttackSpeed, fitGrowth, mapChampion } from '../../scripts/wrpocket/map-champion'
import type { RawAbility, RawChampion } from '../../scripts/wrpocket/raw-schemas'

const PROVENANCE: Provenance = { source: 'wiki', patch: '7.3', verifiedInGame: false }

const LEVEL1: Record<string, number> = {
  体力: 600, 体力自動回復: 8, マナ: 300, マナ自動回復: 10, 物理防御: 30, 魔法防御: 30,
  攻撃力: 60, 移動速度: 340, 攻撃速度: 0.8,
}
const PER_LEVEL: Record<string, number> = {
  体力: 100, 体力自動回復: 0.5, マナ: 40, マナ自動回復: 1, 物理防御: 5, 魔法防御: 1.5,
  攻撃力: 4, 移動速度: 0, 攻撃速度: 0.01,
}

function linearStats(level1 = LEVEL1, perLevel = PER_LEVEL): RawChampion['stats'] {
  const stats: RawChampion['stats'] = {}
  for (let level = 1; level <= 15; level++) {
    const row: Record<string, number> = {}
    for (const key of Object.keys(level1)) row[key] = level1[key] + perLevel[key] * (level - 1)
    stats[`レベル${level}`] = row
  }
  return stats
}

function ability(en: string, scaling: Array<[string, string]> = []): RawAbility {
  return {
    name: { en: 'Ability' }, description: { en },
    scaling: scaling.map(([type, value]) => ({ type, value })),
  }
}

function rawChampion(overrides: Partial<RawChampion> = {}): RawChampion {
  return {
    id: 'test-champ', name: { en: 'Test Champ' }, stats: linearStats(),
    abilities: {
      パッシブ: ability('Passive text with no damage.'),
      スキル1: ability('Hurls a fireball, dealing 80 / 130 / 180 / 230 (+85% AP) magic damage.', [
        ['cd', '4/4/4/4'], ['MP', '50/55/60/65'], ['基础伤害', '80/125/170/215'],
      ]),
      スキル2: ability('Fires a shock blast that deals 10 (+160% AD) physical damage.', [
        ['cd', '8/7/6/5'], ['MP', '50/60/70/80'], ['基础伤害', '10/80/150/220'],
      ]),
      スキル3: ability('Chompers explode, dealing magic damage to enemies.', [
        ['cd', '14'], ['MP', '70'], ['基础伤害', '70/140/210/280'],
      ]),
      アルティメット: ability('The rocket deals 25 (+12% bonus AD)–250 (+120% bonus AD) physical damage.', [
        ['cd', '60/50/40'], ['MP', '100/100/100'], ['最低伤害', '25/35/45'], ['最大基础伤害', '250/350/450'],
      ]),
    },
    ...overrides,
  }
}

describe('fitGrowth / fitAttackSpeed', () => {
  it('fits base and perLevel from levels 1 and 15', () => {
    expect(fitGrowth(600, 2000)).toEqual({ base: 600, perLevel: 100 })
  })

  it('fits the attack speed ratio from levels 1 and 15', () => {
    expect(fitAttackSpeed(0.8, 0.94)).toEqual({ base: 0.8, ratio: 0.0125 })
  })
})

describe('mapChampion: stats', () => {
  it('maps every base stat and attack speed', () => {
    const { value } = mapChampion(rawChampion(), PROVENANCE)
    expect(value.baseStats).toEqual({
      hp: { base: 600, perLevel: 100 }, hpRegen: { base: 8, perLevel: 0.5 },
      mana: { base: 300, perLevel: 40 }, manaRegen: { base: 10, perLevel: 1 },
      armor: { base: 30, perLevel: 5 }, mr: { base: 30, perLevel: 1.5 },
      ad: { base: 60, perLevel: 4 }, moveSpeed: { base: 340, perLevel: 0 },
    })
    expect(value.attackSpeed).toEqual({ base: 0.8, ratio: 0.0125 })
    expect(value.resource).toBe('mana')
  })

  it('omits mana stats and uses resource "other" for a manaless champion', () => {
    const { value } = mapChampion(rawChampion({
      stats: linearStats({ ...LEVEL1, マナ: 0, マナ自動回復: 0 }, { ...PER_LEVEL, マナ: 0, マナ自動回復: 0 }),
    }), PROVENANCE)
    expect(value.baseStats.mana).toBeUndefined()
    expect(value.baseStats.manaRegen).toBeUndefined()
    expect(value.resource).toBe('other')
  })

  it('notes a stat whose levels are not a straight line', () => {
    const stats = linearStats()
    stats['レベル8'] = { ...stats['レベル8'], 体力: stats['レベル8'].体力 + 50 }
    const { notes } = mapChampion(rawChampion({ stats }), PROVENANCE)
    expect(notes).toContain('hp: level 8 is 1350, 50 off a straight line from level 1 to 15')
  })

  it('normalizes the id and uses the English name', () => {
    const { value } = mapChampion(rawChampion({ id: 'nunu-and-willump', name: { en: 'Nunu & Willump' } }), PROVENANCE)
    expect(value.id).toBe('nunu-willump')
    expect(value.name).toBe('Nunu & Willump')
    expect(value.abilities.q.id).toBe('nunu-willump-q')
  })

  it('throws on a missing level row or ability slot', () => {
    const stats = linearStats()
    delete stats['レベル15']
    expect(() => mapChampion(rawChampion({ stats }), PROVENANCE)).toThrow(/test-champ: missing 体力 at level 15/)
    const abilities = { ...rawChampion().abilities }
    delete abilities['スキル2']
    expect(() => mapChampion(rawChampion({ abilities }), PROVENANCE)).toThrow(/test-champ: missing ability slot スキル2/)
  })
})

describe('mapChampion: abilities', () => {
  const { value, notes } = mapChampion(rawChampion(), PROVENANCE)

  it('uses the full-rank English text over a conflicting table, with a note', () => {
    expect(value.abilities.q).toEqual({
      id: 'test-champ-q', name: 'Ability', maxRank: 4,
      cooldown: { byRank: [4, 4, 4, 4] }, cost: { byRank: [50, 55, 60, 65] }, castTime: 0,
      damage: [{ type: 'magic', base: { byRank: [80, 130, 180, 230] }, ratios: [{ stat: 'ap', value: 0.85 }], tags: [] }],
      flags: {},
    })
    expect(notes).toContain('q: text damage 80/130/180/230 conflicts with table 80/125/170/215; used text')
  })

  it('fills per-rank base damage from the table when the text shows rank 1 only', () => {
    expect(value.abilities.w.damage).toEqual([
      { type: 'physical', base: { byRank: [10, 80, 150, 220] }, ratios: [{ stat: 'totalAd', value: 1.6 }], tags: [] },
    ])
    expect(notes.filter((note) => note.startsWith('w:'))).toEqual([])
  })

  it('falls back to table damage with no ratios when the text has no damage phrase', () => {
    expect(value.abilities.e.damage).toEqual([
      { type: 'magic', base: { byRank: [70, 140, 210, 280] }, ratios: [], tags: [] },
    ])
    expect(value.abilities.e.maxRank).toBe(4)
    expect(value.abilities.e.cooldown).toBe(14)
    expect(notes).toContain('e: base damage from the table; no ratio found in the text')
  })

  it('uses the max-damage table for a range phrase, with a note', () => {
    expect(value.abilities.r.maxRank).toBe(3)
    expect(value.abilities.r.damage).toEqual([
      { type: 'physical', base: { byRank: [250, 350, 450] }, ratios: [{ stat: 'bonusAd', value: 1.2 }], tags: [] },
    ])
    expect(notes).toContain('r: damage is a range; modeled the upper bound')
  })

  it('maps the passive with rank 1, no cost, no damage and a null cooldown', () => {
    expect(value.abilities.passive).toEqual({
      id: 'test-champ-passive', name: 'Ability', maxRank: 1, cooldown: null, castTime: 0, damage: [], flags: {},
    })
  })

  it('produces a schema-valid champion', () => {
    expect(() => ChampionSchema.parse(value)).not.toThrow()
    expect(value.provenance).toEqual(PROVENANCE)
  })

  it('notes table damage it could not model when the text names several damage types', () => {
    const raw = rawChampion()
    raw.abilities['スキル3'] = ability('Deals magic damage and physical damage.', [['基础伤害', '10/20/30/40']])
    const result = mapChampion(raw, PROVENANCE)
    expect(result.value.abilities.e.damage).toEqual([])
    expect(result.notes).toContain('e: table has base damage but the text names 2 damage types; damage not modeled')
  })

  it('notes unparsed ratio parts', () => {
    const raw = rawChampion()
    raw.abilities['スキル2'] = ability('Attacks deal 12 (+10% Armor) bonus magic damage.', [['cd', '7']])
    expect(mapChampion(raw, PROVENANCE).notes).toContain("w: unparsed ratio '10% Armor'")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @wr-calc/data test wrpocket/map-champion`
Expected: FAIL. The `../../scripts/wrpocket/map-champion` module doesn't exist yet.

- [ ] **Step 3: Implement**

`packages/data/scripts/wrpocket/map-champion.ts`:

```ts
import type { Ability, Champion, DamageComponent, Provenance } from '@wr-calc/schema'
import { MAX_CHAMPION_LEVEL } from '@wr-calc/calc'
import type { RawAbility, RawChampion } from './raw-schemas'
import { normalizeId } from './ids'
import {
  damageTypesIn, findTextDamage, parseRanks, parseRatios, round, toScalar,
} from './parse-ability'
import type { Mapped } from './map-item'

type AbilitySlot = keyof Champion['abilities']
type BaseStatKey = keyof Champion['baseStats']

const SLOTS: Array<[AbilitySlot, string]> = [
  ['passive', 'パッシブ'], ['q', 'スキル1'], ['w', 'スキル2'], ['e', 'スキル3'], ['r', 'アルティメット'],
]
const STAT_COLUMNS: Array<[BaseStatKey, string]> = [
  ['hp', '体力'], ['hpRegen', '体力自動回復'], ['mana', 'マナ'], ['manaRegen', 'マナ自動回復'],
  ['armor', '物理防御'], ['mr', '魔法防御'], ['ad', '攻撃力'], ['moveSpeed', '移動速度'],
]
const ATTACK_SPEED_COLUMN = '攻撃速度'
const MANA_KEYS: ReadonlySet<BaseStatKey> = new Set<BaseStatKey>(['mana', 'manaRegen'])
// Deviation from a straight line (in stat points) beyond which the site's table is reported as non-linear.
const LINEARITY_TOLERANCE = 1

/** Fits { base, perLevel } so levels 1 and MAX_CHAMPION_LEVEL are exact. */
export function fitGrowth(level1: number, levelMax: number): { base: number; perLevel: number } {
  return { base: level1, perLevel: round((levelMax - level1) / (MAX_CHAMPION_LEVEL - 1)) }
}

/** Fits { base, ratio } so attack speed at levels 1 and MAX_CHAMPION_LEVEL is exact. */
export function fitAttackSpeed(level1: number, levelMax: number): { base: number; ratio: number } {
  return { base: level1, ratio: round((levelMax / level1 - 1) / (MAX_CHAMPION_LEVEL - 1)) }
}

function levelValue(raw: RawChampion, level: number, column: string): number {
  const value = raw.stats[`レベル${level}`]?.[column]
  if (typeof value !== 'number') throw new Error(`${raw.id}: missing ${column} at level ${level}`)
  return value
}

function linearityNotes(raw: RawChampion, key: string, column: string): string[] {
  const first = levelValue(raw, 1, column)
  const step = (levelValue(raw, MAX_CHAMPION_LEVEL, column) - first) / (MAX_CHAMPION_LEVEL - 1)
  const notes: string[] = []
  for (let level = 2; level < MAX_CHAMPION_LEVEL; level++) {
    const actual = levelValue(raw, level, column)
    const off = round(actual - (first + step * (level - 1)))
    if (Math.abs(off) > LINEARITY_TOLERANCE) {
      notes.push(`${key}: level ${level} is ${actual}, ${Math.abs(off)} off a straight line from level 1 to 15`)
    }
  }
  return notes
}

function scaling(raw: RawAbility, type: string): number[] | null {
  const entry = raw.scaling.find((candidate) => candidate.type === type)
  return entry ? parseRanks(entry.value) : null
}

function sameValues(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function mapDamage(slot: AbilitySlot, raw: RawAbility, notes: string[]): DamageComponent[] {
  const text = raw.description.en
  const found = findTextDamage(text)
  if (found) {
    const table = scaling(raw, found.isRangeUpperBound ? '最大基础伤害' : '基础伤害')
    let base = found.base
    if (table && table.length > 1) {
      if (base.length === 1 && table[0] === base[0]) base = table
      else if (!sameValues(base, table)) {
        notes.push(`${slot}: text damage ${base.join('/')} conflicts with table ${table.join('/')}; used text`)
      }
    }
    if (found.isRangeUpperBound) notes.push(`${slot}: damage is a range; modeled the upper bound`)
    if (damageTypesIn(text).length > 1) {
      notes.push(`${slot}: text names several damage types; only the first damage phrase is modeled`)
    }
    const ratios = parseRatios(found.ratioGroup)
    ratios.unparsed.forEach((part) => notes.push(`${slot}: unparsed ratio '${part}'`))
    return [{ type: found.type, base: toScalar(base), ratios: ratios.ratios, tags: [] }]
  }

  const table = scaling(raw, '基础伤害')
  if (!table) return []
  const types = damageTypesIn(text)
  if (types.length === 1) {
    notes.push(`${slot}: base damage from the table; no ratio found in the text`)
    return [{ type: types[0], base: toScalar(table), ratios: [], tags: [] }]
  }
  notes.push(`${slot}: table has base damage but the text names ${types.length} damage types; damage not modeled`)
  return []
}

function mapAbility(championId: string, slot: AbilitySlot, raw: RawAbility, notes: string[]): Ability {
  const cooldown = scaling(raw, 'cd')
  const defaultRanks = slot === 'passive' ? 1 : slot === 'r' ? 3 : 4
  const maxRank = slot === 'passive' ? 1 : cooldown && cooldown.length > 1 ? cooldown.length : defaultRanks
  const ability: Ability = {
    id: `${championId}-${slot}`,
    name: raw.name.en,
    maxRank,
    cooldown: cooldown ? toScalar(cooldown) : null,
    castTime: 0,
    damage: mapDamage(slot, raw, notes),
    flags: {},
  }
  if (slot !== 'passive') {
    const cost = scaling(raw, 'MP')
    ability.cost = cost ? toScalar(cost) : null
    if (!cooldown) notes.push(`${slot}: no cooldown in the table`)
  }
  return ability
}

/** Maps one wrpocket champion to a Champion, noting every guess, conflict and skipped value. */
export function mapChampion(raw: RawChampion, provenance: Provenance): Mapped<Champion> {
  const id = normalizeId(raw.id)
  const notes: string[] = []

  const baseStats: Champion['baseStats'] = {}
  for (const [key, column] of STAT_COLUMNS) {
    const level1 = levelValue(raw, 1, column)
    const levelMax = levelValue(raw, MAX_CHAMPION_LEVEL, column)
    if (MANA_KEYS.has(key) && level1 === 0 && levelMax === 0) continue
    baseStats[key] = fitGrowth(level1, levelMax)
    notes.push(...linearityNotes(raw, key, column))
  }
  const attackSpeed = fitAttackSpeed(
    levelValue(raw, 1, ATTACK_SPEED_COLUMN), levelValue(raw, MAX_CHAMPION_LEVEL, ATTACK_SPEED_COLUMN),
  )

  const abilityFor = (slot: AbilitySlot, key: string): Ability => {
    const rawAbility = raw.abilities[key]
    if (!rawAbility) throw new Error(`${raw.id}: missing ability slot ${key}`)
    return mapAbility(id, slot, rawAbility, notes)
  }
  const abilities = Object.fromEntries(
    SLOTS.map(([slot, key]) => [slot, abilityFor(slot, key)]),
  ) as Champion['abilities']

  return {
    value: {
      id, name: raw.name.en,
      resource: levelValue(raw, 1, 'マナ') > 0 ? 'mana' : 'other',
      baseStats, attackSpeed, abilities, provenance,
    },
    notes,
  }
}
```

(`Object.fromEntries` loses the key types, so the single `as Champion['abilities']` cast is deliberate. `SLOTS` lists all five slots, and `abilityFor` throws on any missing one.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @wr-calc/data test wrpocket/map-champion`
Expected: PASS. If the linearity-note test fails on the exact number formatting (e.g. `1350` vs `1350.0`), fix the message formatting in the implementation, not the test.

Run: `pnpm test && pnpm typecheck` from the repo root.
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/data/scripts/wrpocket/map-champion.ts packages/data/test/wrpocket/map-champion.test.ts
git commit -m "feat: map wrpocket champions to the Champion schema"
```

---

### Task 4: Rendering, the import script, and the first real import

**Files:**
- Create: `packages/data/scripts/wrpocket/render.ts`, `packages/data/scripts/import-wrpocket.ts`
- Modify: `packages/data/src/patches/7.3/provenance.ts` (add `WRPOCKET_7_3_PROVENANCE`)
- Generate: `packages/data/src/patches/7.3/generated/items.ts`, `generated/champions.ts`, `generated/IMPORT_REPORT.md`
- Test: `packages/data/test/wrpocket/render.test.ts`, `packages/data/test/generated.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
  - `WRPOCKET_7_3_PROVENANCE: Provenance`, `{ source: 'wiki', patch: '7.3', verifiedInGame: false }`
  - `renderModule(exportName: string, typeName: 'Item' | 'Champion', entries: Array<{ id: string; provenance: Provenance }>, meta: RawMeta): string`
  - `renderReport(meta: RawMeta, sections: Array<{ subject: string; notes: string[] }>, summary: string[]): string`
  - `GENERATED_ITEMS: Item[]` (171) and `GENERATED_CHAMPIONS: Champion[]` (142), both sorted by id.

- [ ] **Step 1: Add the provenance constant**

Append to `packages/data/src/patches/7.3/provenance.ts`:

```ts
/** Every value imported from (or hand-filled from) wrpocket.app for patch 7.3; unverified until checked in-game. */
export const WRPOCKET_7_3_PROVENANCE: Provenance = {
  source: 'wiki', patch: '7.3', verifiedInGame: false,
}
```

- [ ] **Step 2: Write the failing render test**

`packages/data/test/wrpocket/render.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { renderModule, renderReport } from '../../scripts/wrpocket/render'

const META = { patch: '7.3', updated: '2026-09-23 10:19:27' }
const PROVENANCE = { source: 'wiki' as const, patch: '7.3', verifiedInGame: false }

describe('renderModule', () => {
  const source = renderModule('GENERATED_ITEMS', 'Item', [
    { id: 'b-item', provenance: PROVENANCE },
    { id: 'a-item', provenance: PROVENANCE },
  ], META)

  it('writes the generated-file header with source and patch', () => {
    expect(source).toContain('// GENERATED by packages/data/scripts/import-wrpocket.ts')
    expect(source).toContain('patch 7.3, updated 2026-09-23 10:19:27')
    expect(source).toContain("import type { Item } from '@wr-calc/schema'")
    expect(source).toContain("import { WRPOCKET_7_3_PROVENANCE } from '../provenance'")
    expect(source).toContain('export const GENERATED_ITEMS: Item[] = [')
  })

  it('references the provenance constant instead of inlining it', () => {
    expect(source).toContain('"provenance": WRPOCKET_7_3_PROVENANCE')
    expect(source).not.toContain('"source": "wiki"')
    expect(source).not.toContain('__WRPOCKET_PROVENANCE__')
  })

  it('sorts entries by id', () => {
    expect(source.indexOf('"a-item"')).toBeLessThan(source.indexOf('"b-item"'))
  })
})

describe('renderReport', () => {
  it('lists the summary and only subjects that have notes', () => {
    const report = renderReport(META, [
      { subject: 'item foo', notes: ['note one', 'note two'] },
      { subject: 'item clean', notes: [] },
    ], ['171 items'])
    expect(report).toContain('# wrpocket import report (patch 7.3, updated 2026-09-23 10:19:27)')
    expect(report).toContain('- 171 items')
    expect(report).toContain('## item foo\n\n- note one\n- note two')
    expect(report).not.toContain('item clean')
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter @wr-calc/data test wrpocket/render`
Expected: FAIL. The `render` module doesn't exist yet.

- [ ] **Step 4: Implement `render.ts`**

`packages/data/scripts/wrpocket/render.ts`:

```ts
import type { Provenance } from '@wr-calc/schema'
import type { RawMeta } from './raw-schemas'

const PROVENANCE_MARKER = '__WRPOCKET_PROVENANCE__'

/** Renders a generated TypeScript module exporting the given entries (sorted by id) as a typed array. */
export function renderModule(
  exportName: string, typeName: 'Item' | 'Champion',
  entries: Array<{ id: string; provenance: Provenance }>, meta: RawMeta,
): string {
  const sorted = [...entries].sort((a, b) => a.id.localeCompare(b.id))
  const body = JSON.stringify(sorted.map((entry) => ({ ...entry, provenance: PROVENANCE_MARKER })), null, 2)
    .replaceAll(`"${PROVENANCE_MARKER}"`, 'WRPOCKET_7_3_PROVENANCE')
  return [
    '// GENERATED by packages/data/scripts/import-wrpocket.ts. Do not edit by hand: change the',
    '// mapper and re-run `pnpm --filter @wr-calc/data import:wrpocket` instead.',
    `// Source: https://wrpocket.app/site_data (patch ${meta.patch}, updated ${meta.updated}).`,
    '// Reference values, not verified in-game. See IMPORT_REPORT.md for everything skipped or guessed.',
    `import type { ${typeName} } from '@wr-calc/schema'`,
    "import { WRPOCKET_7_3_PROVENANCE } from '../provenance'",
    '',
    `export const ${exportName}: ${typeName}[] = ${body}`,
    '',
  ].join('\n')
}

/** Renders the import report: a summary, then one section per subject that has notes. */
export function renderReport(
  meta: RawMeta, sections: Array<{ subject: string; notes: string[] }>, summary: string[],
): string {
  const lines = [
    `# wrpocket import report (patch ${meta.patch}, updated ${meta.updated})`,
    '',
    'Generated by `packages/data/scripts/import-wrpocket.ts`. Every value is unverified until checked in-game.',
    '',
    ...summary.map((line) => `- ${line}`),
  ]
  for (const { subject, notes } of sections) {
    if (notes.length === 0) continue
    lines.push('', `## ${subject}`, '', ...notes.map((note) => `- ${note}`))
  }
  return `${lines.join('\n')}\n`
}
```

Run: `pnpm --filter @wr-calc/data test wrpocket/render`
Expected: PASS.

- [ ] **Step 5: Implement the import script**

`packages/data/scripts/import-wrpocket.ts`:

```ts
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WRPOCKET_7_3_PROVENANCE } from '../src/patches/7.3/provenance'
import {
  RawChampionSchema, RawChampionSummarySchema, RawItemSchema, RawMetaSchema,
} from './wrpocket/raw-schemas'
import type { RawChampion } from './wrpocket/raw-schemas'
import { mapItem } from './wrpocket/map-item'
import { mapChampion } from './wrpocket/map-champion'
import { renderModule, renderReport } from './wrpocket/render'

const BASE_URL = 'https://wrpocket.app/site_data'
const EXPECTED_PATCH = '7.3'
const REQUEST_DELAY_MS = 150
const DATA_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(DATA_ROOT, 'src', 'patches', EXPECTED_PATCH, 'generated')

async function getJson(path: string, cacheDir: string | null): Promise<unknown> {
  const cacheFile = cacheDir === null ? null : join(cacheDir, path)
  if (cacheFile !== null && existsSync(cacheFile)) return JSON.parse(await readFile(cacheFile, 'utf-8'))
  const response = await fetch(`${BASE_URL}/${path}`)
  if (!response.ok) throw new Error(`GET ${BASE_URL}/${path} failed: HTTP ${response.status}`)
  const text = await response.text()
  if (cacheFile !== null) {
    await mkdir(dirname(cacheFile), { recursive: true })
    await writeFile(cacheFile, text)
  }
  await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS))
  return JSON.parse(text)
}

async function main(): Promise<void> {
  const refresh = process.argv.includes('--refresh')
  // meta.json is always fetched fresh: it decides which cache folder is valid.
  const meta = RawMetaSchema.parse(await getJson('meta.json', null))
  if (meta.patch !== EXPECTED_PATCH) {
    throw new Error(`wrpocket is on patch ${meta.patch}, but this importer writes patch ${EXPECTED_PATCH}`)
  }
  // The cache folder is keyed by the site's update time, so new site data never reads stale cache.
  // --refresh re-downloads this version anyway.
  const cacheDir = join(DATA_ROOT, '.cache', 'wrpocket', `${meta.patch}-${meta.updated.replace(/[^0-9]/g, '')}`)
  if (refresh) await rm(cacheDir, { recursive: true, force: true })

  const rawItems = RawItemSchema.array().parse(await getJson('items.json', cacheDir))
  const summary = RawChampionSummarySchema.parse(await getJson('champions_summary.json', cacheDir))
  const rawChampions: RawChampion[] = []
  for (const { id } of summary) {
    rawChampions.push(RawChampionSchema.parse(await getJson(`champions/${id}.json`, cacheDir)))
  }

  const prices = new Map(rawItems.map((item) => [item.id, Number(item.price)]))
  const items = rawItems.map((raw) => ({ raw, mapped: mapItem(raw, prices, WRPOCKET_7_3_PROVENANCE) }))
  const champions = rawChampions.map((raw) => ({ raw, mapped: mapChampion(raw, WRPOCKET_7_3_PROVENANCE) }))

  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(join(OUT_DIR, 'items.ts'), renderModule(
    'GENERATED_ITEMS', 'Item', items.map(({ mapped }) => mapped.value), meta,
  ))
  await writeFile(join(OUT_DIR, 'champions.ts'), renderModule(
    'GENERATED_CHAMPIONS', 'Champion', champions.map(({ mapped }) => mapped.value), meta,
  ))
  const sections = [
    ...champions.map(({ mapped }) => ({ subject: `champion ${mapped.value.id}`, notes: mapped.notes })),
    ...items.map(({ mapped }) => ({ subject: `item ${mapped.value.id}`, notes: mapped.notes })),
  ].sort((a, b) => a.subject.localeCompare(b.subject))
  const noteCount = sections.reduce((sum, section) => sum + section.notes.length, 0)
  await writeFile(join(OUT_DIR, 'IMPORT_REPORT.md'), renderReport(meta, sections, [
    `${champions.length} champions, ${items.length} items imported`,
    `${noteCount} notes below (conflicts, guesses, skipped values)`,
    'Generated items have no modeled effects (passives); only starter items in items.ts do.',
    'castTime is 0 for every ability (not in the source).',
  ]))
  console.log(`Wrote ${champions.length} champions, ${items.length} items, ${noteCount} report notes to ${OUT_DIR}`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
```

- [ ] **Step 6: Run the import**

Run: `pnpm --filter @wr-calc/data import:wrpocket`
Expected: it prints `Wrote 142 champions, 171 items, <N> report notes to …/generated`. It takes about 30 seconds (144 requests at 150 ms).

On a network error, re-run it (the cache keeps finished downloads). On a zod error, the site's JSON shape changed: stop and report the error. **Do not loosen the schemas to get past it.**

- [ ] **Step 7: Write the generated-conformance test**

`packages/data/test/generated.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { ChampionSchema, ItemSchema } from '@wr-calc/schema'
import { GENERATED_CHAMPIONS } from '../src/patches/7.3/generated/champions'
import { GENERATED_ITEMS } from '../src/patches/7.3/generated/items'

// Counts are the 2026-09-23 wrpocket snapshot for patch 7.3; a re-import that changes them should
// update these deliberately.
describe('GENERATED_ITEMS', () => {
  it('has all 171 patch 7.3 items with unique ids', () => {
    expect(GENERATED_ITEMS).toHaveLength(171)
    expect(new Set(GENERATED_ITEMS.map((item) => item.id)).size).toBe(171)
  })

  it('every item parses against ItemSchema and is marked as unverified wiki data', () => {
    for (const item of GENERATED_ITEMS) {
      expect(() => ItemSchema.parse(item), item.id).not.toThrow()
      expect(item.provenance, item.id).toEqual({ source: 'wiki', patch: '7.3', verifiedInGame: false })
    }
  })

  it('every recipe component exists', () => {
    const ids = new Set(GENERATED_ITEMS.map((item) => item.id))
    for (const item of GENERATED_ITEMS) {
      for (const component of item.recipe) expect(ids.has(component), `${item.id} → ${component}`).toBe(true)
    }
  })

  it('has the aliased BF Sword id', () => {
    expect(GENERATED_ITEMS.find((item) => item.id === 'bf-sword')?.stats).toEqual({ ad: 40 })
  })
})

describe('GENERATED_CHAMPIONS', () => {
  it('has all 142 patch 7.3 champions with unique ids', () => {
    expect(GENERATED_CHAMPIONS).toHaveLength(142)
    expect(new Set(GENERATED_CHAMPIONS.map((champion) => champion.id)).size).toBe(142)
  })

  it('every champion parses against ChampionSchema and is marked as unverified wiki data', () => {
    for (const champion of GENERATED_CHAMPIONS) {
      expect(() => ChampionSchema.parse(champion), champion.id).not.toThrow()
      expect(champion.provenance, champion.id).toEqual({ source: 'wiki', patch: '7.3', verifiedInGame: false })
    }
  })

  it('maps Jinx from the site data (spot check)', () => {
    const jinx = GENERATED_CHAMPIONS.find((champion) => champion.id === 'jinx')!
    expect(jinx.baseStats.hp).toEqual({ base: 630, perLevel: 120 })
    expect(jinx.abilities.w.damage[0]).toEqual({
      type: 'physical', base: { byRank: [10, 80, 150, 220] }, ratios: [{ stat: 'totalAd', value: 1.6 }], tags: [],
    })
    expect(jinx.abilities.r.maxRank).toBe(3)
  })
})
```

Run: `pnpm --filter @wr-calc/data test generated`
Expected: PASS. If the Jinx spot check fails, compare against the cached `.cache/wrpocket/**/champions/jinx.json` and fix the mapper (with a new unit test in Task 3's file). Don't edit the generated file.

- [ ] **Step 8: Review the report and full suite**

Open `generated/IMPORT_REPORT.md`. Check the sections for `champion annie`, `champion jinx`, `champion nunu-willump` and `champion rammus`, and confirm each note makes sense for the text shown on the site. Paste those four sections into the task report for the controller. **Do not fix data by hand here.**

Run: `pnpm test && pnpm typecheck` from the repo root.
Expected: all pass, including `browser-safe-entry.test.ts`. The generated files aren't wired into the patch index yet (Task 5), so the other data tests are unchanged.

- [ ] **Step 9: Commit**

```bash
git add packages/data/scripts packages/data/src/patches/7.3/provenance.ts packages/data/src/patches/7.3/generated packages/data/test/wrpocket/render.test.ts packages/data/test/generated.test.ts
git commit -m "feat: import all patch 7.3 champions and items from wrpocket"
```

---

### Task 5: Starter items filled from the site, and merging into the patch

**Files:**
- Modify: `packages/data/src/catalog.ts` (add `mergeById`)
- Rewrite: `packages/data/src/patches/7.3/items.ts` (`STARTER_ITEMS`)
- Delete: `packages/data/src/patches/7.3/champions.ts`
- Rewrite: `packages/data/src/patches/7.3/index.ts`
- Rewrite: `packages/data/test/items.test.ts`, `packages/data/test/champions.test.ts`
- Modify: `packages/data/test/catalog.test.ts` (add `mergeById` tests), `packages/data/test/golden.test.ts` and `packages/data/test/golden-runner.test.ts` (import paths)

**Interfaces:**
- Consumes: `GENERATED_ITEMS`, `GENERATED_CHAMPIONS`, `WRPOCKET_7_3_PROVENANCE` (Task 4).
- Produces:
  - `mergeById<T extends { id: string }>(base: T[], overrides: T[]): T[]`: base order, an override replacing the base entry with the same id, and override-only ids appended in override order.
  - `STARTER_ITEMS: Item[]` (15 items)
  - `PATCH_7_3_ITEMS = mergeById(GENERATED_ITEMS, STARTER_ITEMS)` (172 items: 171 generated plus `seraphs-embrace`)
  - `PATCH_7_3_CHAMPIONS = GENERATED_CHAMPIONS`
  - `PATCH_7_3_CATALOG` (unchanged name)

- [ ] **Step 1: Write the failing `mergeById` test**

Add to `packages/data/test/catalog.test.ts` (and add `mergeById` to its `../src/catalog` import):

```ts
describe('mergeById', () => {
  it('keeps base order, replaces same ids, and appends override-only ids', () => {
    const base = [{ id: 'a', v: 1 }, { id: 'b', v: 1 }, { id: 'c', v: 1 }]
    const overrides = [{ id: 'd', v: 2 }, { id: 'b', v: 2 }]
    expect(mergeById(base, overrides)).toEqual([
      { id: 'a', v: 1 }, { id: 'b', v: 2 }, { id: 'c', v: 1 }, { id: 'd', v: 2 },
    ])
  })

  it('returns a copy of base when there are no overrides', () => {
    const base = [{ id: 'a' }]
    const merged = mergeById(base, [])
    expect(merged).toEqual(base)
    expect(merged).not.toBe(base)
  })
})
```

Run: `pnpm --filter @wr-calc/data test catalog`
Expected: FAIL (`mergeById` is not exported).

- [ ] **Step 2: Implement `mergeById`**

Append to `packages/data/src/catalog.ts`:

```ts
/** Merges overrides into base by id: base order kept, same ids replaced, new ids appended. */
export function mergeById<T extends { id: string }>(base: T[], overrides: T[]): T[] {
  const overrideById = new Map(overrides.map((entry) => [entry.id, entry]))
  const baseIds = new Set(base.map((entry) => entry.id))
  return [
    ...base.map((entry) => overrideById.get(entry.id) ?? entry),
    ...overrides.filter((entry) => !baseIds.has(entry.id)),
  ]
}
```

Run: `pnpm --filter @wr-calc/data test catalog`
Expected: PASS.

- [ ] **Step 3: Write the failing data tests (new requirements)**

Replace `packages/data/test/items.test.ts` with:

```ts
import { describe, it, expect } from 'vitest'
import { ItemSchema } from '@wr-calc/schema'
import { PATCH_7_3_ITEMS, STARTER_ITEMS } from '../src/patches/7.3'
import { GENERATED_ITEMS } from '../src/patches/7.3/generated/items'

const STARTER_IDS = [
  'long-sword', 'bf-sword', 'blasting-wand', 'rabadons-deathcap', 'blade-of-the-ruined-king',
  'trinity-force', 'liandrys-torment', 'void-staff', 'black-cleaver', 'infinity-edge',
  'navori-quickblades', 'heartsteel', 'seraphs-embrace', 'plated-steelcaps', 'force-of-nature',
].sort()
// Seraph's Embrace isn't on wrpocket (it's Archangel's Staff's upgraded form), so its shield has no source values yet.
const ALLOWED_STARTER_NULLS = ['seraphs-embrace › effects[1].amount', 'seraphs-embrace › effects[1].durationSeconds']

function nullPaths(value: unknown, path: string, out: string[]): void {
  if (value === null) out.push(path)
  else if (Array.isArray(value)) value.forEach((element, index) => nullPaths(element, `${path}[${index}]`, out))
  else if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) nullPaths(child, `${path}.${key}`, out)
  }
}

describe('STARTER_ITEMS', () => {
  it('has exactly the 15 starter items', () => {
    expect(STARTER_ITEMS.map((item) => item.id).sort()).toEqual(STARTER_IDS)
  })

  it('has no null values except the documented Seraph shield', () => {
    const found: string[] = []
    for (const item of STARTER_ITEMS) {
      const paths: string[] = []
      nullPaths(item, '', paths)
      found.push(...paths.map((path) => `${item.id} ›${path.replace(/^\./, ' ')}`))
    }
    expect(found).toEqual(ALLOWED_STARTER_NULLS)
  })

  it('matches its generated counterpart on cost, recipe and every generated stat', () => {
    for (const starter of STARTER_ITEMS) {
      const generated = GENERATED_ITEMS.find((item) => item.id === starter.id)
      if (!generated) continue // seraphs-embrace only
      expect(starter.cost, starter.id).toEqual(generated.cost)
      expect(starter.recipe, starter.id).toEqual(generated.recipe)
      expect(starter.stats, starter.id).toMatchObject(generated.stats)
    }
  })

  it('is marked as unverified wiki data', () => {
    for (const item of STARTER_ITEMS) {
      expect(item.provenance, item.id).toEqual({ source: 'wiki', patch: '7.3', verifiedInGame: false })
    }
  })
})

describe('PATCH_7_3_ITEMS', () => {
  it('is every generated item plus seraphs-embrace, with unique ids', () => {
    const ids = PATCH_7_3_ITEMS.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toHaveLength(GENERATED_ITEMS.length + 1)
    expect(ids).toContain('seraphs-embrace')
  })

  it('uses the starter item wherever one exists', () => {
    for (const starter of STARTER_ITEMS) {
      expect(PATCH_7_3_ITEMS.find((item) => item.id === starter.id), starter.id).toBe(starter)
    }
  })

  it('every item parses against ItemSchema', () => {
    for (const item of PATCH_7_3_ITEMS) expect(() => ItemSchema.parse(item), item.id).not.toThrow()
  })

  it('every recipe resolves and combine + component totals equals the item total', () => {
    const byId = new Map(PATCH_7_3_ITEMS.map((item) => [item.id, item]))
    for (const item of PATCH_7_3_ITEMS) {
      const components = item.recipe.map((id) => byId.get(id))
      expect(components.every((component) => component !== undefined), item.id).toBe(true)
      const componentTotal = components.reduce((sum, component) => sum + (component?.cost.total ?? 0), 0)
      expect(item.cost.combine + componentTotal, item.id).toBe(item.cost.total)
    }
  })
})
```

Replace `packages/data/test/champions.test.ts` with:

```ts
import { describe, it, expect } from 'vitest'
import { ChampionSchema } from '@wr-calc/schema'
import { PATCH_7_3_CHAMPIONS } from '../src/patches/7.3'

describe('PATCH_7_3_CHAMPIONS', () => {
  it('includes the 4 starter champions', () => {
    const ids = PATCH_7_3_CHAMPIONS.map((champion) => champion.id)
    for (const id of ['annie', 'jinx', 'nunu-willump', 'rammus']) expect(ids).toContain(id)
  })

  it('every champion parses against ChampionSchema', () => {
    for (const champion of PATCH_7_3_CHAMPIONS) {
      expect(() => ChampionSchema.parse(champion), champion.id).not.toThrow()
    }
  })

  it('starter champions have 4-rank basic abilities and a 3-rank ultimate', () => {
    for (const id of ['annie', 'jinx', 'nunu-willump', 'rammus']) {
      const champion = PATCH_7_3_CHAMPIONS.find((candidate) => candidate.id === id)!
      for (const key of ['q', 'w', 'e'] as const) expect(champion.abilities[key].maxRank, `${id}.${key}`).toBe(4)
      expect(champion.abilities.r.maxRank, `${id}.r`).toBe(3)
    }
  })

  it('every champion is marked as unverified wiki data', () => {
    for (const champion of PATCH_7_3_CHAMPIONS) {
      expect(champion.provenance, champion.id).toEqual({ source: 'wiki', patch: '7.3', verifiedInGame: false })
    }
  })
})
```

In `packages/data/test/golden.test.ts` and `packages/data/test/golden-runner.test.ts`, replace

```ts
import { PATCH_7_3_CHAMPIONS } from '../src/patches/7.3/champions'
```

with

```ts
import { PATCH_7_3_CHAMPIONS } from '../src/patches/7.3'
```

(`PATCH_7_3_CATALOG` is already imported from `'../src/patches/7.3'`. Merge the two imports into one line.) Also `grep -rn "patches/7.3/items'\|patches/7.3/champions'" packages/data/test` and repoint any other hits to `'../src/patches/7.3'`. `catalog.test.ts` imports `PATCH_7_3_ITEMS` from `'../src/patches/7.3/items'`: change it to `'../src/patches/7.3'`.

Run: `pnpm --filter @wr-calc/data test`
Expected: FAIL. `STARTER_ITEMS` isn't exported, and the starter data still has nulls.

- [ ] **Step 4: Rewrite `items.ts` as `STARTER_ITEMS`**

Replace `packages/data/src/patches/7.3/items.ts` entirely with the following. Values come from wrpocket's English text and `numeric_stats` (2026-09-23). Effect ids are unchanged from before.

```ts
import type { Item } from '@wr-calc/schema'
import { WRPOCKET_7_3_PROVENANCE } from './provenance'

// Hand-modeled starter items: stats/cost/recipe from wrpocket (English text), plus effects modeled
// with this repo's effect kinds. These replace the generated entries with the same id.
export const STARTER_ITEMS: Item[] = [
  {
    id: 'long-sword', name: 'Long Sword', tier: 'basic',
    cost: { total: 500, combine: 500 }, recipe: [],
    stats: { ad: 12 }, effects: [], tags: ['physical'],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'bf-sword', name: 'B. F. Sword', tier: 'epic',
    cost: { total: 1500, combine: 500 }, recipe: ['long-sword', 'long-sword'],
    stats: { ad: 40 }, effects: [], tags: ['physical'],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'blasting-wand', name: 'Blasting Wand', tier: 'epic',
    cost: { total: 800, combine: 300 }, recipe: ['amplifying-tome'],
    stats: { ap: 40 }, effects: [], tags: ['magic'],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'rabadons-deathcap', name: "Rabadon's Deathcap", tier: 'legendary',
    cost: { total: 3400, combine: 600 }, recipe: ['needlessly-large-rod', 'needlessly-large-rod'],
    stats: { ap: 130 }, tags: ['magic'],
    effects: [{
      kind: 'statMultiplier', id: 'rabadons-deathcap-magic-opus', name: 'Overkill',
      description: 'Increases ability power by 30%.', support: 'full',
      stat: 'ap', layer: 'total', amount: 0.3,
    }],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'blade-of-the-ruined-king', name: 'Blade of the Ruined King', tier: 'legendary',
    cost: { total: 3100, combine: 200 }, recipe: ['recurve-bow', 'vampiric-scepter', 'pickaxe'],
    stats: { ad: 40, attackSpeed: 0.3, lifesteal: 0.12 }, tags: ['physical', 'on-hit'],
    effects: [{
      kind: 'onHit', id: 'botrk-mists-edge', name: 'Ruined Strike',
      description: "Basic attacks deal bonus physical damage equal to 7% of the target's current Health "
        + '(8.5% for melee), minimum 15, maximum 100 against monsters.',
      support: 'partial',
      supportNotes: 'Uses the ranged value (7%); melee champions get 8.5%. The Drain slow is not modeled.',
      damageType: 'physical', pctTargetCurrentHp: 0.07, minDamage: 15, monsterCap: 100,
    }],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'trinity-force', name: 'Trinity Force', tier: 'legendary',
    cost: { total: 3333, combine: 333 }, recipe: ['sheen', 'hearthbound-axe', 'phage'],
    stats: { ad: 36, hp: 333, attackSpeed: 0.3, abilityHaste: 15 }, tags: ['physical'],
    effects: [{
      kind: 'spellblade', id: 'trinity-force-spellblade', name: 'Spellblade',
      description: 'After using an ability, the next basic attack within 10 seconds deals 200% base '
        + 'Attack Damage as bonus physical damage (1.5 second cooldown).',
      support: 'partial',
      supportNotes: 'The real bonus is 200% of *base* AD; the spellblade ratio can only reference total '
        + 'AD, so this overstates damage once you have bonus AD. Valor move speed is not modeled.',
      damageType: 'physical', bonusDamage: 0,
      ratios: [{ stat: 'ad', value: 2 }], internalCooldownSeconds: 1.5,
    }],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'liandrys-torment', name: "Liandry's Torment", tier: 'legendary',
    cost: { total: 3000, combine: 800 }, recipe: ['haunting-guise', 'fated-ashes'],
    stats: { ap: 70, hp: 300 }, tags: ['magic'],
    effects: [{
      kind: 'dot', id: 'liandrys-torment-dot', name: 'Torment',
      description: 'Damaging abilities burn the enemy for 3 seconds, dealing magic damage equal to 2% of '
        + 'their maximum Health per second.',
      support: 'none',
      supportNotes: 'The burn is % of target max Health; the dot kind only models flat ticks, so this deals '
        + '0 until a %-max-Health dot exists. Madness (up to +6% damage) is not modeled.',
      damageType: 'magic', tickAmount: 0, tickIntervalSeconds: 1, durationSeconds: 3,
      refresh: 'refresh',
    }],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'void-staff', name: 'Void Staff', tier: 'legendary',
    cost: { total: 3000, combine: 600 }, recipe: ['needlessly-large-rod', 'void-amethyst'],
    // Unconditional magic pen is a plain stat, not a `penetration`-kind effect (that kind is
    // reserved for conditional pen — see packages/schema/src/effect/kinds/penetration.ts).
    stats: { ap: 95, pctMagicPen: 0.4 }, effects: [], tags: ['magic'],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'black-cleaver', name: 'Black Cleaver', tier: 'legendary',
    cost: { total: 3000, combine: 500 }, recipe: ['long-sword', 'phage', 'kindlegem'],
    stats: { ad: 40, hp: 400, abilityHaste: 20 }, tags: ['physical'],
    effects: [{
      kind: 'resistShred', id: 'black-cleaver-carve', name: 'Sunder',
      description: "Dealing physical damage to a champion reduces their Armor by 6% for 6 seconds, "
        + 'stacking up to 5 times (30%).',
      support: 'full', supportNotes: 'Rage move speed is not modeled.',
      resist: 'armor', mode: 'percent', amount: 0.06, stacking: true, maxStacks: 5,
      durationSeconds: 6,
    }],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'infinity-edge', name: 'Infinity Edge', tier: 'legendary',
    cost: { total: 3400, combine: 600 }, recipe: ['brawlers-gloves', 'bf-sword', 'pickaxe'],
    // critDamage 0.3: "Critical strike damage increased from 200% to 230%."
    stats: { ad: 75, critChance: 0.25, critDamage: 0.3 }, effects: [], tags: ['physical', 'crit'],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'navori-quickblades', name: 'Navori Quickblades', tier: 'legendary',
    cost: { total: 2650, combine: 450 }, recipe: ['dagger', 'dagger', 'zeal'],
    stats: { attackSpeed: 0.4, critChance: 0.25, moveSpeedPct: 0.04 }, tags: ['physical', 'crit'],
    effects: [{
      kind: 'cooldownRefund', id: 'navori-untold-determination', name: 'Deft Strikes',
      description: 'Attacks reduce the remaining cooldowns of your basic abilities by 15%.',
      support: 'partial',
      supportNotes: 'The real passive triggers on basic attacks; the cooldownRefund kind only triggers '
        + 'on ability hits.',
      mode: 'percent', amount: 0.15, excludesUltimate: true,
    }],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'heartsteel', name: 'Heartsteel', tier: 'legendary',
    cost: { total: 2800, combine: 300 }, recipe: ['ruby-crystal', 'kindlegem', 'giants-belt'],
    // wrpocket also lists healthRegen 150 (% of base regen), which has no flat-stat equivalent here.
    stats: { hp: 700, abilityHaste: 20 }, tags: ['tank', 'on-hit'],
    effects: [
      {
        kind: 'stacking', id: 'heartsteel-vigor', name: 'Colossal Consumption (bonus Health gained)',
        description: "Charged strikes grant maximum Health equal to 15% of the damage dealt.",
        support: 'partial',
        supportNotes: 'The Health already gained is a manual input (1 stack = 1 Health); it is not '
          + 'accumulated from strikes automatically.',
        stat: 'hp', perStack: 1, maxStacks: 3000, stackInputId: 'heartsteel-stacks',
        inputs: [{
          type: 'stackCount', id: 'heartsteel-stacks', label: 'Heartsteel bonus Health gained',
          min: 0, max: 3000, default: 0,
        }],
      },
      {
        kind: 'onHit', id: 'heartsteel-repurpose', name: 'Colossal Consumption (charged strike)',
        description: 'A charged attack deals bonus physical damage equal to 140 + 3.5% of maximum Health.',
        support: 'partial',
        supportNotes: 'Applies to every basic attack while the toggle is on; in-game it charges for 2.5 '
          + 'seconds near an enemy champion and has a 20-second cooldown per target.',
        damageType: 'physical', flat: 140, pctOwnStat: { stat: 'hp', ratio: 0.035 },
        condition: { type: 'toggle', inputId: 'heartsteel-charge-ready' },
        inputs: [{
          type: 'boolean', id: 'heartsteel-charge-ready', label: 'Heartsteel charged strike ready',
          default: false,
        }],
      },
    ],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'seraphs-embrace', name: "Seraph's Embrace", tier: 'legendary',
    // Not on wrpocket: it's Archangel's Staff after Mana Charge reaches 700 bonus Mana. Stats are
    // Archangel's (60 AP, 500 Mana, 25 AH) plus that 700 Mana; no extra gold to "buy" it.
    cost: { total: 3000, combine: 0 }, recipe: ['archangels-staff'],
    stats: { ap: 60, mana: 1200, abilityHaste: 25 }, tags: ['magic'],
    effects: [
      {
        kind: 'statConversion', id: 'seraphs-embrace-focused-will', name: 'Awe',
        description: 'Gain Ability Power equal to 1% of your maximum Mana.',
        support: 'full',
        fromStat: 'mana', toStat: 'ap', ratio: 0.01,
      },
      {
        kind: 'shield', id: 'seraphs-embrace-bottomless-well', name: 'Lifeline',
        description: "Seraph's upgraded shield. Values aren't on wrpocket; verify in-game.",
        support: 'partial',
        supportNotes: 'Modeled as a manually toggled shield; trigger and cooldown are not modeled.',
        amount: null, durationSeconds: null,
        condition: { type: 'toggle', inputId: 'seraphs-embrace-shield-used' },
        inputs: [{
          type: 'boolean', id: 'seraphs-embrace-shield-used',
          label: "Seraph's Embrace shield used", default: false,
        }],
      },
    ],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'plated-steelcaps', name: 'Plated Steelcaps', tier: 'boots',
    cost: { total: 1200, combine: 300 }, recipe: ['ruby-crystal', 'boots-of-speed'],
    stats: { hp: 150, armor: 25, moveSpeed: 45 }, tags: ['boots', 'defense'],
    effects: [{
      kind: 'damageReduction', id: 'plated-steelcaps-reinforced-armor', name: 'Block',
      description: 'Reduces damage taken from champion basic attacks by 10%.',
      support: 'partial',
      supportNotes: 'Modeled as reducing all physical damage; the real passive only reduces '
        + 'basic-attack damage specifically.',
      damageType: 'physical', amount: 0.1,
    }],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
  {
    id: 'force-of-nature', name: 'Force of Nature', tier: 'legendary',
    cost: { total: 2800, combine: 500 }, recipe: ['ruby-crystal', 'negatron-cloak', 'winged-moonplate'],
    stats: { hp: 400, mr: 60, moveSpeedPct: 0.04 }, effects: [],
    tags: ['magic-resist'],
    provenance: WRPOCKET_7_3_PROVENANCE,
  },
]
```

Before relying on these, confirm in the generated items that `hearthbound-axe`, `vampiric-scepter`, `haunting-guise`, `fated-ashes`, `needlessly-large-rod`, `void-amethyst`, `kindlegem`, `phage`, `sheen`, `recurve-bow`, `pickaxe`, `brawlers-gloves`, `dagger`, `zeal`, `ruby-crystal`, `giants-belt`, `archangels-staff`, `boots-of-speed`, `negatron-cloak`, `winged-moonplate` and `amplifying-tome` all exist (`grep -c` in `generated/items.ts`). The recipe test in Step 3 enforces it.

`grep -rn "heartsteel-stacks\|heartsteel-repurpose\|seraphs-embrace-shield-used" packages --include=*.ts` should show only `items.ts` and tests. If any calc test references the old Heartsteel shape (e.g. `max: 20`), report it rather than editing it.

- [ ] **Step 5: Delete `champions.ts` and rewrite the patch index**

```bash
git rm packages/data/src/patches/7.3/champions.ts
```

Replace `packages/data/src/patches/7.3/index.ts` with:

```ts
import type { Champion, Item } from '@wr-calc/schema'
import { buildCatalog, mergeById } from '../../catalog'
import { GENERATED_CHAMPIONS } from './generated/champions'
import { GENERATED_ITEMS } from './generated/items'
import { STARTER_ITEMS } from './items'

export * from './provenance'
export { STARTER_ITEMS } from './items'

export const PATCH_7_3_ITEMS: Item[] = mergeById(GENERATED_ITEMS, STARTER_ITEMS)
export const PATCH_7_3_CHAMPIONS: Champion[] = GENERATED_CHAMPIONS
export const PATCH_7_3_CATALOG = buildCatalog(PATCH_7_3_ITEMS, [])
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter @wr-calc/data test`
Expected: PASS, including the unchanged `golden-runner.test.ts`. Its expectations are computed dynamically from `simulateCombo`, so real Nunu stats don't break it, and `browser-safe-entry.test.ts` still finds no `node:` imports.

If the null-values test lists more paths than the two allowed, the starter data above has a gap. Fill it from the site text; don't widen `ALLOWED_STARTER_NULLS`.

Run: `pnpm test && pnpm typecheck` from the repo root.
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add -A packages/data
git commit -m "feat: fill starter items from wrpocket and merge generated data into patch 7.3"
```

---

### Task 6: Update the Step 7 plan/spec, README and final verification

**Files:**
- Modify: `docs/superpowers/plans/2026-09-24-phase1-step7-debug-page.md`
- Modify: `docs/superpowers/specs/2026-09-24-phase1-step7-debug-page-design.md` (§1 purpose line)
- Modify: `README.md` (`packages/data` line + importer command)

**Interfaces:**
- Consumes: the merged data from Task 5. Facts the edits depend on:
  - `PATCH_7_3_CHAMPIONS[0].id` (expected `aatrox`, since the generated list is sorted by id)
  - Heartsteel's inputs, in order: `heartsteel-stacks` (stackCount, 0–3000, default 0) then `heartsteel-charge-ready` (boolean, default false)
  - the only starter-item nulls: `seraphs-embrace › effects[1].amount` and `.durationSeconds`
- Produces: a Step 7 plan whose code and tests are correct against the new data.

- [ ] **Step 1: Confirm the facts**

Run:

```bash
pnpm --filter @wr-calc/data exec tsx -e "import('./src/patches/7.3/index.ts').then((m) => console.log(m.PATCH_7_3_CHAMPIONS[0].id, m.PATCH_7_3_CHAMPIONS.length))"
```

Expected: `aatrox 142`. If the first id differs, use the printed id everywhere this task says `aatrox`.

- [ ] **Step 2: Apply these exact edits to the Step 7 plan**

In `docs/superpowers/plans/2026-09-24-phase1-step7-debug-page.md`:

1. **Task 1, Step 4:** replace "`packages/data/src/patches/7.3/index.ts`: add `export * from './targets'` after `export * from './champions'`." with "`packages/data/src/patches/7.3/index.ts`: add `export * from './targets'` after `export * from './provenance'`."
2. **Task 1, Step 5:** the golden tests now import `PATCH_7_3_CHAMPIONS` from `'../src/patches/7.3'`; keep that import and just switch the `new Map(...)` line to `buildChampionMap(...)`.
3. **Task 2, Step 1 (root `package.json`):** the `typecheck` line becomes `"typecheck": "tsc -b && tsc -p packages/data/tsconfig.scripts.json && pnpm --filter @wr-calc/web typecheck",`.
4. **Task 2, Step 3 (`debug-state.test.ts`):** `championId: 'nunu-willump'` → `championId: 'aatrox'`.
5. **Task 4, Step 1 (`url-state.test.ts`):** in "resets an unknown champion and reports it", `'nunu-willump'` → `'aatrox'`.
6. **Task 5 facts line:** replace the Heartsteel fact with "`heartsteel` declares `{ type: 'stackCount', id: 'heartsteel-stacks', min: 0, max: 3000, default: 0 }` then `{ type: 'boolean', id: 'heartsteel-charge-ready', default: false }`".
7. **Task 5, Step 1 (`collect-inputs.test.ts`):**
   - "keeps purchase order" expectation → `['seraphs-embrace-shield-used', 'heartsteel-stacks', 'heartsteel-charge-ready']`
   - "dedupes…" expectation → `['heartsteel-stacks', 'heartsteel-charge-ready']`
   - "includes boots and rune inputs after items" expectation → `['seraphs-embrace-shield-used', 'heartsteel-stacks', 'heartsteel-charge-ready', 'test-rune-toggle']`
   - "fills every declared default…" expectation → `{ 'heartsteel-stacks': 7, 'heartsteel-charge-ready': false, 'seraphs-embrace-shield-used': false }`
8. **Task 6, Step 1 (`null-report.test.ts`):** replace the test "reports real patch 7.3 item nulls" body with:
   ```ts
   const seraph = PATCH_7_3_CATALOG.items.get('seraphs-embrace')!
   const paths = nullReport([{ label: 'item seraphs-embrace', value: seraph }]).map((entry) => entry.path)
   expect(paths).toContain('item seraphs-embrace › effects[1].amount')
   ```
9. **Task 7, Step 1 (`run-debug.test.ts`):**
   - In "dedupes unsupported effects and data warnings across every call", delete the line `expect(result.envelope.dataWarnings.length).toBeGreaterThan(0)`.
   - In "reports each null once even when both builds share an item", use `buildA: { items: ['seraphs-embrace'], runes: [], inputs: {} }` and `buildB: { items: ['seraphs-embrace'], runes: [], inputs: {} }` (pass both via `state({ buildA, buildB })`). Assert on `'item seraphs-embrace › effects[1].amount'` having length 1. Keep the `champion jinx › ` assertion, since the passive cooldown is null.
   - In "includes a champion target and its items in the null report", use the target build `items: ['seraphs-embrace']`, and replace `expect(paths).toContain('item blasting-wand › stats.ap')` with `expect(paths).toContain('item seraphs-embrace › effects[1].amount')`.
   - In "fills declared input defaults…", the expected `inputs` → `{ 'heartsteel-stacks': 0, 'heartsteel-charge-ready': false }`.
   - Under "runs a full champion + 6-item build…", the comment "even while item magnitudes are null" → "base AD and item AD are real data".
10. **Task 7, Step 4 note:** leave the `compare.a` length-6 note as-is. Breakpoints are per purchased item, not data values.
11. **Task 9, Step 1 (README):** replace its `packages/data` bullet with the exact line written in Step 4 below, so Step 7 doesn't revert it.

- [ ] **Step 3: Update the Step 7 spec's purpose**

In `docs/superpowers/specs/2026-09-24-phase1-step7-debug-page-design.md` §1, replace the paragraph starting "**The page is a companion for entering real data.**" with:

```markdown
**The page is a companion for verifying data.** The 7.3 data is imported from wrpocket.app and
marked unverified (see `docs/superpowers/specs/2026-09-24-wrpocket-import-design.md`); only a few
values are still `null` (e.g. Seraph's shield, ability passives' cooldowns). The page exercises the
full engine end to end against that data and lists every remaining `null`, so in-game checks can
focus on what matters. No demo or fake dataset is shipped.
```

- [ ] **Step 4: Update the README**

In `README.md`, replace the line starting ``- `packages/data`:`` with:

```markdown
- `packages/data`: patch 7.3 data (all champions and items generated from wrpocket.app via `pnpm --filter @wr-calc/data import:wrpocket`, plus hand-modeled starter items; everything unverified until checked in-game), `buildCatalog`, and the golden test runner (Node-only loader at `@wr-calc/data/golden-loader`)
```

(Edit 11 in Step 2 makes the Step 7 plan's Task 9 use this same line.)

- [ ] **Step 5: Full verification**

From the repo root:
- `pnpm test`: all pass, zero failures.
- `pnpm typecheck`: exit 0.
- `git status`: no `.cache/` files staged.

- [ ] **Step 6: Commit**

```bash
git add docs README.md
git commit -m "docs: align Step 7 plan, spec and README with the wrpocket import"
```
