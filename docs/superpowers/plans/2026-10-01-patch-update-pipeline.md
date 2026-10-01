# Patch-Update Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One command (`pnpm --filter @wr-calc/data patch:update`) that pulls a new wrpocket patch into a versioned overlay patch folder, diffs it against the previous patch, flags changed hand-modelled entries, and makes the new patch the app's default. First real run: 7.3a.

**Architecture:** Small pure modules under `packages/data/scripts/patch/` (trim → snapshot, diff, flag, render, scaffold, run plan) and a thin CLI, `scripts/patch-update.ts`, that stages every output in `.cache/` and moves it into place only once all stages have succeeded. In `src/patches/`, `overlay.ts` builds a `PatchDataset` from a `PatchLayer` plus the previous dataset. `layers.ts` (generated) lists the layers oldest first. `registry.ts` exposes `PATCH_IDS`, `CURRENT_PATCH` and `getPatchDataset`.

**Tech Stack:** TypeScript (strict), zod, tsx (CLI), vitest, pnpm workspaces, Next.js debug page (`apps/web`).

**Spec:** `docs/superpowers/specs/2026-10-01-patch-update-pipeline-design.md`

## Global Constraints

- Branch: `feat/tvanmook/patch-update-pipeline/20261001` (already created and checked out). Never commit to main.
- Commit prefixes: `feat:`, `fix:`, `test:`, `docs:`, `chore:`.
- Never weaken a test to make it pass. A test whose expectation the spec deliberately changes (the generated-file header naming `patch-update.ts`) is updated, with the reason in the commit message.
- TypeScript strict; full type annotations; one-sentence docstrings on exported functions; no dead or commented-out code; comments only on non-obvious logic.
- `@wr-calc/data`'s root entry must stay browser-safe: nothing reachable from `src/index.ts` may import `node:*` (`test/browser-safe-entry.test.ts` enforces it). Node-only code lives in `scripts/` or `src/golden-loader.ts`.
- No network in tests.
- The pipeline never writes hand-modelled effects. It never overwrites an existing `overrides.ts`, `reviewed.ts`, `provenance.ts` or `layer.ts`.
- Snapshots: sorted keys, 2-space indentation, trailing newline (`stableStringify`).
- Full verification before marking any task done: `pnpm -r test` and `pnpm typecheck`. Known flake: the compare-builds 5ms perf test can fail under full-suite load; if it is the only failure, rerun `pnpm --filter @wr-calc/calc test` alone and note it.
- Packages resolve each other from `src`, so no build step is needed between packages.

## Deviations from the spec

- The spec's per-patch `index.ts` is called `layer.ts` and exports `PATCH_LAYER`. `7.3/index.ts` already exists with the legacy `PATCH_7_3_*` exports, and every folder needs the same file name for the generated `layers.ts`.
- The spec asks for a byte-for-byte determinism check. The generated-file headers name the generator script, which this plan renames (`import-wrpocket.ts` → `patch-update.ts`), so the check compares files with the generator-name header lines stripped. Everything else must match exactly.
- Mapper notes are diffed by mapping both snapshots in memory rather than parsing the previous `IMPORT_REPORT.md`. Same result, no markdown parsing.
- The report adds a "Still stale from earlier patches" section and lists the goldens of changed generated entries too. The spec's "staleness carries forward" needs the first; the second is free once goldens are indexed.

## Review Focus

1. **Re-running on a patch the user has already started reviewing.** `overrides.ts` and `reviewed.ts` must survive untouched. Pinned in Task 6 (`writeMissingFiles` keeps existing files).
2. **An item in an inherited exclusive group disappears from wrpocket.** Today `withExclusiveGroups` throws on unknown ids, which would crash the whole app at import. Inherited groups drop ids that no longer exist (the removal is already in the report). Pinned in Task 5.
3. **wrpocket ids that differ from ours (`b.-f.-sword` → `bf-sword`).** Diffs, changed ids and flags must use our ids, or the hand-modelled BF Sword is never flagged. Pinned in Task 2.
4. **wrpocket reports an older patch, or the same patch with an older timestamp (rollback or cache glitch).** Refuse with a clear error and write nothing. Pinned in Task 6 (`planRun`).
5. **A passive reworded with no number changes.** It must still flag, and the report should say "wording only" rather than show an empty change. Pinned in Tasks 2 and 4.

---

## File Structure

```
packages/data/
  package.json                     modify: script import:wrpocket -> patch:update
  tsconfig.scripts.json            modify: include test/patch
  scripts/
    import-wrpocket.ts             delete (replaced by patch-update.ts)
    patch-update.ts                create: CLI orchestration only
    wrpocket/raw-schemas.ts        modify: optional patch_major/sources on meta
    wrpocket/map-champion.ts       modify: export SLOTS, STAT_COLUMNS, ATTACK_SPEED_COLUMN
    wrpocket/render.ts             modify: provenance const name param, new header text
    patch/stable-json.ts           create: stableStringify
    patch/snapshot.ts              create: snapshot schemas/types + trim functions
    patch/snapshot-io.ts           create: read/write snapshot folders, list metas (Node)
    patch/text-diff.ts             create: word diff, number changes, markdown render
    patch/diff.ts                  create: diffSnapshots, changedIdsOf
    patch/types.ts                 create: shared diff/flag types
    patch/map-snapshot.ts          create: snapshot -> mapped items/champions/notes
    patch/patch-diff.ts            create: goldenRefs, flagHandModelled, buildPatchDiff
    patch/render-diff.ts           create: PATCH_DIFF.md
    patch/scaffold.ts              create: patchConst, layers.ts, changed-ids.ts, stub files
    patch/run-plan.ts              create: planRun, metaFromCacheDir, stripGeneratorHeader
  src/
    index.ts                       modify: export registry + overlay types
    patches/overlay.ts             create: PatchLayer, PatchDataset, buildPatchDataset
    patches/layers.ts              create (generated format): PATCH_LAYERS
    patches/registry.ts            create: PATCH_IDS, CURRENT_PATCH, getPatchDataset
    patches/7.3/layer.ts           create: root layer
    patches/7.3a/...               created by the 7.3a run (Task 9)
  snapshots/wrpocket/7.3/, 7.3a/   created by the runs (Tasks 8, 9)
  test/patch/*.test.ts             create
  test/golden.test.ts              modify: run each case against its own patch
packages/schema/src/provenance.ts  modify: staleSince
apps/web/src/lib/dataset.ts        modify: datasetFor, CURRENT_DATASET
apps/web/src/components/*.tsx      modify: patch label from CURRENT_PATCH
apps/web/test/*.test.ts            modify: PATCH_7_3_DATASET -> datasetFor('7.3')
docs/decisions/2026-10-01-patch-overlay-and-snapshots.md  create
README.md, packages/data/golden/README.md                 modify
```

---

### Task 1: Stable JSON and trimmed snapshots

**Files:**
- Create: `packages/data/scripts/patch/stable-json.ts`, `packages/data/scripts/patch/snapshot.ts`, `packages/data/scripts/patch/snapshot-io.ts`
- Modify: `packages/data/scripts/wrpocket/raw-schemas.ts:6`, `packages/data/tsconfig.scripts.json`
- Test: `packages/data/test/patch/fixtures.ts`, `packages/data/test/patch/snapshot.test.ts`

**Interfaces:**
- Produces:
  - `stableStringify(value: unknown): string`
  - `SnapshotMetaSchema`, `SnapshotItemSchema`, `SnapshotChampionSchema` (zod, strict)
  - types `SnapshotMeta`, `SnapshotItem`, `SnapshotAbility`, `SnapshotChampion`, `Snapshot = { meta: SnapshotMeta; items: SnapshotItem[]; champions: SnapshotChampion[] }`
  - `trimMeta(raw: RawMeta): SnapshotMeta`, `trimItem(raw: RawItem): SnapshotItem`, `trimChampion(raw: RawChampion): SnapshotChampion`
  - `buildSnapshot(meta: RawMeta, items: RawItem[], champions: RawChampion[]): Snapshot` (sorted by id)
  - `writeSnapshot(dir: string, snapshot: Snapshot): Promise<void>`, `readSnapshot(dir: string): Promise<Snapshot>`, `listSnapshotMetas(root: string): Promise<SnapshotMeta[]>` (oldest `updated` first)
  - fixtures: `makeRawItem`, `makeRawChampion`, `makeSnapshot`

- [ ] **Step 1: Let the raw meta schema carry the optional fields**

In `scripts/wrpocket/raw-schemas.ts` replace the `RawMetaSchema` line with:

```ts
export const RawMetaSchema = z.object({
  patch: z.string(),
  updated: z.string(),
  patch_major: z.string().optional(),
  sources: z.record(z.string(), z.string()).optional(),
}).passthrough()
```

In `tsconfig.scripts.json` change `"include"` to `["scripts", "test/wrpocket", "test/patch"]`.

- [ ] **Step 2: Write test fixtures**

`packages/data/test/patch/fixtures.ts`:

```ts
import type { RawChampion, RawItem } from '../../scripts/wrpocket/raw-schemas'
import { buildSnapshot } from '../../scripts/patch/snapshot'
import type { Snapshot } from '../../scripts/patch/snapshot'

/** A raw wrpocket item with sensible defaults, plus the fields the trimmer must drop. */
export function makeRawItem(overrides: Partial<RawItem> = {}): RawItem {
  return {
    id: 'long-sword', name: { en: 'Long Sword', ja: 'ロングソード' },
    description: { en: '+12 Attack Damage', ja: '' }, price: '500',
    numeric_stats: { attackDamage: 12 }, category: { en: 'Physical', ja: '物理' },
    tier: 'basic', components: [], image_url: '/x.webp', gold_efficiency: 100,
    ...overrides,
  }
}

const LEVELS = Array.from({ length: 15 }, (_, index) => index + 1)

/** A raw wrpocket champion with linear stats for levels 1-15 and five ability slots. */
export function makeRawChampion(overrides: Partial<RawChampion> = {}): RawChampion {
  const stats = Object.fromEntries(LEVELS.map((level) => [`レベル${level}`, {
    体力: 500 + 100 * (level - 1), 体力自動回復: 8, マナ: 300, マナ自動回復: 10, 物理防御: 30,
    魔法防御: 30, 攻撃力: 50, 移動速度: 340, 攻撃速度: 0.7,
  }]))
  const ability = (name: string) => ({
    name: { en: name, ja: '' },
    description: { en: `${name} deals 80 / 130 / 180 / 230 (+85% AP) magic damage.`, ja: '' },
    scaling: [{ type: 'cd', value: '4/4/4/4' }, { type: 'MP', value: '50/55/60/65' }],
    video_url: 'https://example.invalid/v.mp4',
  })
  return {
    id: 'annie', name: { en: 'Annie', ja: 'アニー' }, stats,
    abilities: {
      パッシブ: ability('Pyromania'), スキル1: ability('Disintegrate'), スキル2: ability('Incinerate'),
      スキル3: ability('Molten Shield'), アルティメット: ability('Summon Tibbers'),
    },
    skins: [], bio: 'dropped',
    ...overrides,
  }
}

/** A snapshot built the same way the CLI builds one. */
export function makeSnapshot(
  patch: string, updated: string, items: RawItem[], champions: RawChampion[],
): Snapshot {
  return buildSnapshot({ patch, updated }, items, champions)
}
```

- [ ] **Step 3: Write the failing tests**

`packages/data/test/patch/snapshot.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stableStringify } from '../../scripts/patch/stable-json'
import { buildSnapshot, trimChampion, trimItem, trimMeta } from '../../scripts/patch/snapshot'
import { listSnapshotMetas, readSnapshot, writeSnapshot } from '../../scripts/patch/snapshot-io'
import { makeRawChampion, makeRawItem } from './fixtures'

describe('stableStringify', () => {
  it('sorts keys at every level, indents by 2 and ends with a newline', () => {
    expect(stableStringify({ b: 1, a: { d: [{ z: 1, y: 2 }], c: 3 } }))
      .toBe('{\n  "a": {\n    "c": 3,\n    "d": [\n      {\n        "y": 2,\n        "z": 1\n      }\n    ]\n  },\n  "b": 1\n}\n')
  })

  it('keeps array order', () => {
    expect(stableStringify([3, 1, 2])).toBe('[\n  3,\n  1,\n  2\n]\n')
  })
})

describe('trim', () => {
  it('keeps only the item fields the mapper and diff use', () => {
    expect(trimItem(makeRawItem())).toEqual({
      id: 'long-sword', name: { en: 'Long Sword' }, description: { en: '+12 Attack Damage' },
      price: '500', tier: 'basic', category: { en: 'Physical' }, components: [],
      numeric_stats: { attackDamage: 12 },
    })
  })

  it('keeps champion stats and ability name, text and scaling only', () => {
    const trimmed = trimChampion(makeRawChampion())
    expect(Object.keys(trimmed).sort()).toEqual(['abilities', 'id', 'name', 'stats'])
    expect(trimmed.name).toEqual({ en: 'Annie' })
    expect(trimmed.stats['レベル15'].体力).toBe(1900)
    expect(trimmed.abilities['スキル1']).toEqual({
      name: { en: 'Disintegrate' },
      description: { en: 'Disintegrate deals 80 / 130 / 180 / 230 (+85% AP) magic damage.' },
      scaling: [{ type: 'cd', value: '4/4/4/4' }, { type: 'MP', value: '50/55/60/65' }],
    })
  })

  it('keeps optional meta fields only when present', () => {
    expect(trimMeta({ patch: '7.3', updated: '2026-09-23 10:19:27' }))
      .toEqual({ patch: '7.3', updated: '2026-09-23 10:19:27' })
    expect(trimMeta({
      patch: '7.3a', updated: 'u', patch_major: '7.3', sources: { items: 'i' }, extra: 1,
    })).toEqual({ patch: '7.3a', updated: 'u', patch_major: '7.3', sources: { items: 'i' } })
  })

  it('sorts items and champions by id', () => {
    const snapshot = buildSnapshot(
      { patch: '7.3', updated: 'u' },
      [makeRawItem({ id: 'b' }), makeRawItem({ id: 'a' })],
      [makeRawChampion({ id: 'zed' }), makeRawChampion({ id: 'annie' })],
    )
    expect(snapshot.items.map((item) => item.id)).toEqual(['a', 'b'])
    expect(snapshot.champions.map((champion) => champion.id)).toEqual(['annie', 'zed'])
  })
})

describe('snapshot io', () => {
  it('round-trips a snapshot through stable JSON files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'snapshot-'))
    const snapshot = buildSnapshot({ patch: '7.3', updated: 'u' }, [makeRawItem()], [makeRawChampion()])
    await writeSnapshot(join(root, '7.3'), snapshot)
    expect(await readSnapshot(join(root, '7.3'))).toEqual(snapshot)
    expect(await readFile(join(root, '7.3', 'items.json'), 'utf-8')).toBe(stableStringify(snapshot.items))
  })

  it('lists metas oldest first, and [] for a missing root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'snapshot-'))
    const empty = { items: [], champions: [] }
    await writeSnapshot(join(root, '7.3a'), { meta: { patch: '7.3a', updated: '2026-09-29 16:09:43' }, ...empty })
    await writeSnapshot(join(root, '7.3'), { meta: { patch: '7.3', updated: '2026-09-23 10:19:27' }, ...empty })
    expect((await listSnapshotMetas(root)).map((meta) => meta.patch)).toEqual(['7.3', '7.3a'])
    expect(await listSnapshotMetas(join(root, 'missing'))).toEqual([])
  })
})
```

- [ ] **Step 4: Run them to verify they fail**

Run: `pnpm --filter @wr-calc/data exec vitest run test/patch/snapshot.test.ts`
Expected: FAIL, cannot resolve `../../scripts/patch/stable-json`.

- [ ] **Step 5: Implement**

`scripts/patch/stable-json.ts`:

```ts
/** Serialises a JSON value with sorted object keys and 2-space indentation, ending in a newline. */
export function stableStringify(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, sortKeys(record[key])]))
  }
  return value
}
```

`scripts/patch/snapshot.ts`:

```ts
import { z } from 'zod'
import type { RawChampion, RawItem, RawMeta } from '../wrpocket/raw-schemas'

const EnSchema = z.object({ en: z.string() }).strict()

export const SnapshotMetaSchema = z.object({
  patch: z.string(),
  updated: z.string(),
  patch_major: z.string().optional(),
  sources: z.record(z.string(), z.string()).optional(),
}).strict()

export const SnapshotItemSchema = z.object({
  id: z.string(), name: EnSchema, description: EnSchema, price: z.string(), tier: z.string(),
  category: EnSchema, components: z.array(z.string()), numeric_stats: z.record(z.string(), z.number()),
}).strict()

const SnapshotAbilitySchema = z.object({
  name: EnSchema, description: EnSchema,
  scaling: z.array(z.object({ type: z.string(), value: z.string() }).strict()),
}).strict()

export const SnapshotChampionSchema = z.object({
  id: z.string(), name: EnSchema,
  stats: z.record(z.string(), z.record(z.string(), z.number())),
  abilities: z.record(z.string(), SnapshotAbilitySchema),
}).strict()

export type SnapshotMeta = z.infer<typeof SnapshotMetaSchema>
export type SnapshotItem = z.infer<typeof SnapshotItemSchema>
export type SnapshotAbility = z.infer<typeof SnapshotAbilitySchema>
export type SnapshotChampion = z.infer<typeof SnapshotChampionSchema>

/** One patch's trimmed wrpocket data: the single source of truth for that patch's generated files. */
export interface Snapshot {
  meta: SnapshotMeta
  items: SnapshotItem[]
  champions: SnapshotChampion[]
}

/** Keeps the meta fields worth recording; the optional ones only when the site sends them. */
export function trimMeta(raw: RawMeta): SnapshotMeta {
  return {
    patch: raw.patch, updated: raw.updated,
    ...(raw.patch_major === undefined ? {} : { patch_major: raw.patch_major }),
    ...(raw.sources === undefined ? {} : { sources: { ...raw.sources } }),
  }
}

/** Keeps the item fields the mapper consumes or the diff compares. */
export function trimItem(raw: RawItem): SnapshotItem {
  return {
    id: raw.id, name: { en: raw.name.en }, description: { en: raw.description.en }, price: raw.price,
    tier: raw.tier, category: { en: raw.category.en }, components: [...raw.components],
    numeric_stats: { ...raw.numeric_stats },
  }
}

/** Keeps the champion's per-level stats and each ability's name, text and scaling rows. */
export function trimChampion(raw: RawChampion): SnapshotChampion {
  return {
    id: raw.id, name: { en: raw.name.en },
    stats: Object.fromEntries(Object.entries(raw.stats).map(([level, row]) => [level, { ...row }])),
    abilities: Object.fromEntries(Object.entries(raw.abilities).map(([key, ability]) => [key, {
      name: { en: ability.name.en }, description: { en: ability.description.en },
      scaling: ability.scaling.map(({ type, value }) => ({ type, value })),
    }])),
  }
}

const byId = (a: { id: string }, b: { id: string }): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/** Trims validated raw responses into a snapshot with items and champions sorted by id. */
export function buildSnapshot(meta: RawMeta, items: RawItem[], champions: RawChampion[]): Snapshot {
  return {
    meta: trimMeta(meta),
    items: items.map(trimItem).sort(byId),
    champions: champions.map(trimChampion).sort(byId),
  }
}
```

`scripts/patch/snapshot-io.ts`:

```ts
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { stableStringify } from './stable-json'
import {
  SnapshotChampionSchema, SnapshotItemSchema, SnapshotMetaSchema,
} from './snapshot'
import type { Snapshot, SnapshotMeta } from './snapshot'

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf-8'))
}

/** Writes meta.json, items.json and champions.json into dir as stable JSON. */
export async function writeSnapshot(dir: string, snapshot: Snapshot): Promise<void> {
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'meta.json'), stableStringify(snapshot.meta))
  await writeFile(join(dir, 'items.json'), stableStringify(snapshot.items))
  await writeFile(join(dir, 'champions.json'), stableStringify(snapshot.champions))
}

/** Reads and validates a snapshot folder. */
export async function readSnapshot(dir: string): Promise<Snapshot> {
  return {
    meta: SnapshotMetaSchema.parse(await readJson(join(dir, 'meta.json'))),
    items: SnapshotItemSchema.array().parse(await readJson(join(dir, 'items.json'))),
    champions: SnapshotChampionSchema.array().parse(await readJson(join(dir, 'champions.json'))),
  }
}

/** Lists every snapshot's meta under root, oldest `updated` first; a missing root gives []. */
export async function listSnapshotMetas(root: string): Promise<SnapshotMeta[]> {
  let names: string[]
  try {
    names = await readdir(root)
  } catch {
    return []
  }
  const metas = await Promise.all(
    names.map(async (name) => SnapshotMetaSchema.parse(await readJson(join(root, name, 'meta.json')))),
  )
  return metas.sort((a, b) => (a.updated < b.updated ? -1 : a.updated > b.updated ? 1 : 0))
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter @wr-calc/data exec vitest run test/patch/snapshot.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/data/scripts/patch packages/data/scripts/wrpocket/raw-schemas.ts packages/data/tsconfig.scripts.json packages/data/test/patch
git commit -m "feat: trimmed, stable wrpocket snapshots"
```

---

### Task 2: Word diff and snapshot diff

**Files:**
- Create: `packages/data/scripts/patch/text-diff.ts`, `packages/data/scripts/patch/types.ts`, `packages/data/scripts/patch/diff.ts`
- Modify: `packages/data/scripts/wrpocket/map-champion.ts:15-22` (export three constants)
- Test: `packages/data/test/patch/text-diff.test.ts`, `packages/data/test/patch/diff.test.ts`

**Interfaces:**
- Consumes: `Snapshot`, `SnapshotItem`, `SnapshotChampion` (Task 1); `normalizeId` (`scripts/wrpocket/ids.ts`)
- Produces:
  - `WordOp = { op: 'same' | 'del' | 'add'; text: string }`, `diffWords(before: string, after: string): WordOp[]`, `numberChanges(ops: WordOp[]): NumberChange[]`, `renderWordDiff(ops: WordOp[]): string`
  - in `types.ts`: `EntryKind`, `NumberChange`, `FieldChange`, `EntryRef`, `EntryDiff`, `SnapshotDiff`, `Flag`, `StaleRef`, `NoteRef`, `ReportedDiff`, `PatchDiff`, `IdLists`
  - `diffSnapshots(before: Snapshot, after: Snapshot): SnapshotDiff`, `changedIdsOf(diff: SnapshotDiff): IdLists`

- [ ] **Step 1: Export the mapper's label constants**

In `scripts/wrpocket/map-champion.ts`, add `export` to `SLOTS`, `STAT_COLUMNS` and `ATTACK_SPEED_COLUMN` (lines 15-22). No other change.

- [ ] **Step 2: Write the shared types**

`scripts/patch/types.ts`:

```ts
export type EntryKind = 'item' | 'champion'

/** A number that changed inside a text field, e.g. 7% -> 6%; '' when one side has no partner. */
export interface NumberChange {
  before: string
  after: string
}

/** One changed field. Text fields carry the numbers that changed and a markdown word diff. */
export interface FieldChange {
  field: string
  before: string
  after: string
  numbers?: NumberChange[]
  wordDiff?: string
}

/** Identifies an item or champion by this repo's id. */
export interface EntryRef {
  kind: EntryKind
  id: string
  name: string
}

export interface EntryDiff extends EntryRef {
  changes: FieldChange[]
}

/** The raw record-by-record comparison of two snapshots. */
export interface SnapshotDiff {
  items: EntryDiff[]
  champions: EntryDiff[]
  added: EntryRef[]
  removed: EntryRef[]
}

/** Item and champion id lists, e.g. the ids a patch changed or covered. */
export interface IdLists {
  items: string[]
  champions: string[]
}

/** A hand-modelled entry that needs review in this patch. */
export interface Flag extends EntryRef {
  severity: 'removed' | 'changed'
  changes: FieldChange[]
  goldens: string[]
}

/** A hand-modelled entry that went stale in an earlier patch and is still unresolved. */
export interface StaleRef extends EntryRef {
  since: string
}

/** One importer note, e.g. subject 'champion annie'. */
export interface NoteRef {
  subject: string
  note: string
}

export type ReportedDiff = EntryDiff & { goldens: string[] }

/** Everything PATCH_DIFF.md and patch-diff.json report for one patch. */
export interface PatchDiff {
  from: string
  to: string
  fromUpdated: string
  toUpdated: string
  needsReview: Flag[]
  carriedStale: StaleRef[]
  items: ReportedDiff[]
  champions: ReportedDiff[]
  added: EntryRef[]
  removed: EntryRef[]
  mapperNotes: { added: NoteRef[]; removed: NoteRef[] }
}
```

- [ ] **Step 3: Write the failing tests**

`packages/data/test/patch/text-diff.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { diffWords, numberChanges, renderWordDiff } from '../../scripts/patch/text-diff'

describe('diffWords', () => {
  it('marks only the changed tokens', () => {
    const ops = diffWords('deals 7% damage', 'deals 6% damage')
    expect(ops.filter((op) => op.op !== 'same')).toEqual([
      { op: 'del', text: '7%' }, { op: 'add', text: '6%' },
    ])
  })

  it('is all same for equal text', () => {
    expect(diffWords('a b', 'a b').every((op) => op.op === 'same')).toBe(true)
  })
})

describe('numberChanges', () => {
  it('pairs each changed number in a rank list', () => {
    expect(numberChanges(diffWords('60/80/100 (+60% bonus AD)', '60/85/110 (+60% bonus AD)'))).toEqual([
      { before: '80', after: '85' }, { before: '100', after: '110' },
    ])
  })

  it('keeps decimals and percents whole', () => {
    expect(numberChanges(diffWords('8.5% for melee', '8% for melee'))).toEqual([{ before: '8.5%', after: '8%' }])
  })

  it('is empty for a wording-only change', () => {
    expect(numberChanges(diffWords('Basic attacks deal 15 damage', 'Attacks deal 15 damage'))).toEqual([])
  })

  it('pads a number with no partner with an empty string', () => {
    expect(numberChanges(diffWords('deals 10 damage', 'deals 10 (+5) damage'))).toEqual([{ before: '', after: '5' }])
  })
})

describe('renderWordDiff', () => {
  it('strikes deletions and bolds additions, keeping spaces outside the markers', () => {
    expect(renderWordDiff(diffWords('deals 7% damage', 'deals 6% damage'))).toBe('deals ~~7%~~**6%** damage')
  })
})
```

`packages/data/test/patch/diff.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { changedIdsOf, diffSnapshots } from '../../scripts/patch/diff'
import { makeRawChampion, makeRawItem, makeSnapshot } from './fixtures'

const before = (items = [makeRawItem()], champions = [makeRawChampion()]) =>
  makeSnapshot('7.3', '2026-09-23 10:19:27', items, champions)
const after = (items = [makeRawItem()], champions = [makeRawChampion()]) =>
  makeSnapshot('7.3a', '2026-09-29 16:09:43', items, champions)

describe('diffSnapshots', () => {
  it('reports nothing for identical snapshots', () => {
    expect(diffSnapshots(before(), after())).toEqual({ items: [], champions: [], added: [], removed: [] })
  })

  it('reports price, tier and each numeric stat (added, removed, changed)', () => {
    const diff = diffSnapshots(
      before([makeRawItem({ numeric_stats: { attackDamage: 12, armor: 5 } })]),
      after([makeRawItem({ price: '450', tier: 'epic', numeric_stats: { attackDamage: 10, lifeSteal: 5 } })]),
    )
    expect(diff.items).toEqual([{
      kind: 'item', id: 'long-sword', name: 'Long Sword',
      changes: [
        { field: 'price', before: '500', after: '450' },
        { field: 'tier', before: 'basic', after: 'epic' },
        { field: 'stats.armor', before: '5', after: '—' },
        { field: 'stats.attackDamage', before: '12', after: '10' },
        { field: 'stats.lifeSteal', before: '—', after: '5' },
      ],
    }])
  })

  it('reports a text change with its numbers and a word diff', () => {
    const diff = diffSnapshots(
      before([makeRawItem({ description: { en: 'Deals 7% current Health' } })]),
      after([makeRawItem({ description: { en: 'Deals 6% current Health' } })]),
    )
    expect(diff.items[0].changes).toEqual([{
      field: 'description', before: 'Deals 7% current Health', after: 'Deals 6% current Health',
      numbers: [{ before: '7%', after: '6%' }], wordDiff: 'Deals ~~7%~~**6%** current Health',
    }])
  })

  it('reports a wording-only change with no numbers', () => {
    const diff = diffSnapshots(
      before([makeRawItem({ description: { en: 'Basic attacks deal 15' } })]),
      after([makeRawItem({ description: { en: 'Attacks deal 15' } })]),
    )
    expect(diff.items[0].changes[0].numbers).toEqual([])
  })

  it('names champion stats and abilities by our keys, listing changed levels only', () => {
    const changed = makeRawChampion()
    changed.stats['レベル1'] = { ...changed.stats['レベル1'], 体力: 520 }
    changed.abilities['スキル1'] = {
      ...changed.abilities['スキル1'],
      scaling: [{ type: 'cd', value: '4/4/4/4' }, { type: 'MP', value: '50/50/50/50' }],
    }
    const diff = diffSnapshots(before(undefined, [makeRawChampion()]), after(undefined, [changed]))
    expect(diff.champions[0].changes).toEqual([
      { field: 'stats.hp', before: 'Lv1 500', after: 'Lv1 520' },
      { field: 'q.scaling.MP', before: '50/55/60/65', after: '50/50/50/50' },
    ])
  })

  it('reports added and removed entries', () => {
    const diff = diffSnapshots(
      before([makeRawItem(), makeRawItem({ id: 'old-item', name: { en: 'Old Item' } })]),
      after([makeRawItem(), makeRawItem({ id: 'new-item', name: { en: 'New Item' } })]),
    )
    expect(diff.added).toEqual([{ kind: 'item', id: 'new-item', name: 'New Item' }])
    expect(diff.removed).toEqual([{ kind: 'item', id: 'old-item', name: 'Old Item' }])
  })

  it("uses this repo's ids for aliased wrpocket ids", () => {
    const diff = diffSnapshots(
      before([makeRawItem({ id: 'b.-f.-sword', price: '1300' })]),
      after([makeRawItem({ id: 'b.-f.-sword', price: '1500' })]),
    )
    expect(diff.items[0].id).toBe('bf-sword')
  })
})

describe('changedIdsOf', () => {
  it('lists changed and removed ids, sorted, without added ones', () => {
    const diff = diffSnapshots(
      before([makeRawItem({ id: 'b' }), makeRawItem({ id: 'a' }), makeRawItem({ id: 'gone' })]),
      after([makeRawItem({ id: 'b', price: '1' }), makeRawItem({ id: 'a', price: '1' }), makeRawItem({ id: 'new' })]),
    )
    expect(changedIdsOf(diff)).toEqual({ items: ['a', 'b', 'gone'], champions: [] })
  })
})
```

- [ ] **Step 4: Run them to verify they fail**

Run: `pnpm --filter @wr-calc/data exec vitest run test/patch/text-diff.test.ts test/patch/diff.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 5: Implement the word diff**

`scripts/patch/text-diff.ts`:

```ts
import type { NumberChange } from './types'

export interface WordOp {
  op: 'same' | 'del' | 'add'
  text: string
}

// Numbers (with decimals and %), words, whitespace runs, and single punctuation marks, so
// "60/80/100" splits into its rank values.
const TOKEN_RE = /\d+(?:\.\d+)?%?|[\p{L}']+|\s+|[^\s\p{L}\d]/gu
const NUMBER_RE = /^\d+(?:\.\d+)?%?$/

function tokenize(text: string): string[] {
  return text.match(TOKEN_RE) ?? []
}

/** Diffs two texts token by token (longest common subsequence). */
export function diffWords(before: string, after: string): WordOp[] {
  const a = tokenize(before)
  const b = tokenize(after)
  // lcs[i][j] = LCS length of a[i..] and b[j..]
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const ops: WordOp[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ op: 'same', text: a[i] })
      i += 1
      j += 1
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ op: 'del', text: a[i] })
      i += 1
    } else {
      ops.push({ op: 'add', text: b[j] })
      j += 1
    }
  }
  for (; i < a.length; i += 1) ops.push({ op: 'del', text: a[i] })
  for (; j < b.length; j += 1) ops.push({ op: 'add', text: b[j] })
  return ops
}

/** Pairs the numbers deleted and added within each run of changes, in order. */
export function numberChanges(ops: WordOp[]): NumberChange[] {
  const changes: NumberChange[] = []
  let deleted: string[] = []
  let added: string[] = []
  const flush = (): void => {
    for (let index = 0; index < Math.max(deleted.length, added.length); index += 1) {
      changes.push({ before: deleted[index] ?? '', after: added[index] ?? '' })
    }
    deleted = []
    added = []
  }
  for (const { op, text } of ops) {
    if (op === 'same') flush()
    else if (NUMBER_RE.test(text)) (op === 'del' ? deleted : added).push(text)
  }
  flush()
  return changes
}

/** Renders ops as markdown: deletions ~~struck~~, additions **bold**, whitespace kept outside markers. */
export function renderWordDiff(ops: WordOp[]): string {
  const merged: WordOp[] = []
  for (const op of ops) {
    const last = merged[merged.length - 1]
    if (last && last.op === op.op) last.text += op.text
    else merged.push({ ...op })
  }
  return merged.map(({ op, text }) => {
    if (op === 'same') return text
    const marker = op === 'del' ? '~~' : '**'
    const match = /^(\s*)(.*?)(\s*)$/s.exec(text) as RegExpExecArray
    return match[2] === '' ? text : `${match[1]}${marker}${match[2]}${marker}${match[3]}`
  }).join('')
}
```

- [ ] **Step 6: Implement the snapshot diff**

`scripts/patch/diff.ts`:

```ts
import { normalizeId } from '../wrpocket/ids'
import { ATTACK_SPEED_COLUMN, SLOTS, STAT_COLUMNS } from '../wrpocket/map-champion'
import type { Snapshot, SnapshotChampion, SnapshotItem } from './snapshot'
import { diffWords, numberChanges, renderWordDiff } from './text-diff'
import type { EntryDiff, EntryRef, FieldChange, IdLists, SnapshotDiff } from './types'

const MISSING = '—'
const SLOT_BY_KEY = new Map(SLOTS.map(([slot, key]) => [key, slot]))
const STAT_BY_COLUMN = new Map<string, string>([
  ...STAT_COLUMNS.map(([stat, column]): [string, string] => [column, stat]),
  [ATTACK_SPEED_COLUMN, 'attackSpeed'],
])

function valueChange(field: string, before: string | undefined, after: string | undefined): FieldChange[] {
  if (before === after) return []
  return [{ field, before: before ?? MISSING, after: after ?? MISSING }]
}

function textChange(field: string, before: string | undefined, after: string | undefined): FieldChange[] {
  if (before === undefined || after === undefined || before === after) return valueChange(field, before, after)
  const ops = diffWords(before, after)
  return [{ field, before, after, numbers: numberChanges(ops), wordDiff: renderWordDiff(ops) }]
}

function unionKeys(...records: Array<Record<string, unknown> | undefined>): string[] {
  return [...new Set(records.flatMap((record) => Object.keys(record ?? {})))].sort()
}

function diffItem(before: SnapshotItem, after: SnapshotItem): FieldChange[] {
  return [
    ...textChange('name', before.name.en, after.name.en),
    ...textChange('description', before.description.en, after.description.en),
    ...valueChange('price', before.price, after.price),
    ...valueChange('tier', before.tier, after.tier),
    ...valueChange('category', before.category.en, after.category.en),
    ...valueChange('components', before.components.join(', '), after.components.join(', ')),
    ...unionKeys(before.numeric_stats, after.numeric_stats).flatMap((key) => valueChange(
      `stats.${key}`, before.numeric_stats[key]?.toString(), after.numeric_stats[key]?.toString(),
    )),
  ]
}

const levelNumber = (key: string): number => Number(/(\d+)$/.exec(key)?.[1] ?? Number.NaN)

function diffChampionStats(before: SnapshotChampion, after: SnapshotChampion): FieldChange[] {
  const levels = unionKeys(before.stats, after.stats).sort((a, b) => levelNumber(a) - levelNumber(b))
  const columns = unionKeys(...levels.flatMap((level) => [before.stats[level], after.stats[level]]))
  return columns.flatMap((column) => {
    const changed = levels.filter((level) => before.stats[level]?.[column] !== after.stats[level]?.[column])
    if (changed.length === 0) return []
    const describe = (stats: SnapshotChampion['stats']): string => changed
      .map((level) => `Lv${levelNumber(level)} ${stats[level]?.[column] ?? MISSING}`).join(', ')
    return [{ field: `stats.${STAT_BY_COLUMN.get(column) ?? column}`, before: describe(before.stats), after: describe(after.stats) }]
  })
}

function diffChampion(before: SnapshotChampion, after: SnapshotChampion): FieldChange[] {
  const abilityChanges = unionKeys(before.abilities, after.abilities).flatMap((key) => {
    const label = SLOT_BY_KEY.get(key) ?? key
    const a = before.abilities[key]
    const b = after.abilities[key]
    if (a === undefined || b === undefined) {
      return valueChange(label, a?.name.en, b?.name.en)
    }
    const scalingA = Object.fromEntries(a.scaling.map((row) => [row.type, row.value]))
    const scalingB = Object.fromEntries(b.scaling.map((row) => [row.type, row.value]))
    return [
      ...textChange(`${label}.name`, a.name.en, b.name.en),
      ...textChange(`${label}.description`, a.description.en, b.description.en),
      ...unionKeys(scalingA, scalingB).flatMap((type) => valueChange(
        `${label}.scaling.${type}`, scalingA[type], scalingB[type],
      )),
    ]
  })
  return [
    ...textChange('name', before.name.en, after.name.en),
    ...diffChampionStats(before, after),
    ...abilityChanges,
  ]
}

function diffEntries<T extends { id: string; name: { en: string } }>(
  kind: EntryDiff['kind'], before: T[], after: T[], diffOne: (a: T, b: T) => FieldChange[],
): { changed: EntryDiff[]; added: EntryRef[]; removed: EntryRef[] } {
  const ref = (entry: T): EntryRef => ({ kind, id: normalizeId(entry.id), name: entry.name.en })
  const beforeById = new Map(before.map((entry) => [entry.id, entry]))
  const afterIds = new Set(after.map((entry) => entry.id))
  const changed: EntryDiff[] = []
  const added: EntryRef[] = []
  for (const entry of after) {
    const previous = beforeById.get(entry.id)
    if (previous === undefined) {
      added.push(ref(entry))
      continue
    }
    const changes = diffOne(previous, entry)
    if (changes.length > 0) changed.push({ ...ref(entry), changes })
  }
  const removed = before.filter((entry) => !afterIds.has(entry.id)).map(ref)
  return { changed, added, removed }
}

/** Compares two snapshots record by record, keyed by this repo's ids. */
export function diffSnapshots(before: Snapshot, after: Snapshot): SnapshotDiff {
  const items = diffEntries('item', before.items, after.items, diffItem)
  const champions = diffEntries('champion', before.champions, after.champions, diffChampion)
  return {
    items: items.changed,
    champions: champions.changed,
    added: [...items.added, ...champions.added],
    removed: [...items.removed, ...champions.removed],
  }
}

/** Ids whose record changed or disappeared (not added ones), sorted. */
export function changedIdsOf(diff: SnapshotDiff): IdLists {
  const ids = (kind: EntryDiff['kind'], changed: EntryDiff[]): string[] => [
    ...changed.map((entry) => entry.id),
    ...diff.removed.filter((entry) => entry.kind === kind).map((entry) => entry.id),
  ].sort()
  return { items: ids('item', diff.items), champions: ids('champion', diff.champions) }
}
```

Note on ordering: `diffItem` emits text fields first, then price/tier/category/components, then stats. The "price, tier and each numeric stat" test only expects those fields, because name and description are unchanged.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm --filter @wr-calc/data exec vitest run test/patch`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/data/scripts packages/data/test/patch
git commit -m "feat: word-level and record-level wrpocket snapshot diff"
```

---

### Task 3: Map a snapshot, and parameterise the generated-file renderer

**Files:**
- Create: `packages/data/scripts/patch/map-snapshot.ts`
- Modify: `packages/data/scripts/wrpocket/render.ts`
- Test: `packages/data/test/patch/map-snapshot.test.ts`, `packages/data/test/wrpocket/render.test.ts`

**Interfaces:**
- Consumes: `Snapshot` (Task 1), `mapItem`, `mapChampion`, `RawItemSchema`, `RawChampionSchema`
- Produces:
  - `MappedSnapshot = { items: Item[]; champions: Champion[]; notes: NoteRef[] }`
  - `mapSnapshot(snapshot: Snapshot, provenance: Provenance): MappedSnapshot` (notes sorted by subject, the same order as `IMPORT_REPORT.md`)
  - `renderModule(exportName, typeName, entries, meta: { patch: string; updated: string }, provenanceName: string): string`
  - `renderReport(meta: { patch: string; updated: string }, sections, summary): string`
  - `GENERATOR_SCRIPT = 'packages/data/scripts/patch-update.ts'`

- [ ] **Step 1: Update the render tests for the new header and parameter (spec-driven change)**

In `test/wrpocket/render.test.ts`:
- pass `'WRPOCKET_7_3_PROVENANCE'` as the new fifth argument of `renderModule`
- change the expected header line to `'// GENERATED by packages/data/scripts/patch-update.ts'`
- add this test inside `describe('renderModule')`:

```ts
  it('uses the given provenance constant name', () => {
    const other = renderModule('GENERATED_ITEMS', 'Item', [{ id: 'a', provenance: PROVENANCE }], META, 'WRPOCKET_7_3A_PROVENANCE')
    expect(other).toContain("import { WRPOCKET_7_3A_PROVENANCE } from '../provenance'")
    expect(other).toContain('"provenance": WRPOCKET_7_3A_PROVENANCE')
  })
```

If `renderReport`'s test checks the "Generated by" line, change the expected text to `Generated by \`packages/data/scripts/patch-update.ts\``.

- [ ] **Step 2: Write the failing map-snapshot test**

`test/patch/map-snapshot.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mapSnapshot } from '../../scripts/patch/map-snapshot'
import { makeRawChampion, makeRawItem, makeSnapshot } from './fixtures'

const PROVENANCE = { source: 'wiki' as const, patch: '7.3a', verifiedInGame: false }

describe('mapSnapshot', () => {
  it('maps items and champions with the given provenance and our ids', () => {
    const snapshot = makeSnapshot('7.3a', 'u', [makeRawItem({ id: 'b.-f.-sword', price: '1300' })], [makeRawChampion()])
    const mapped = mapSnapshot(snapshot, PROVENANCE)
    expect(mapped.items.map((item) => item.id)).toEqual(['bf-sword'])
    expect(mapped.items[0].provenance).toEqual(PROVENANCE)
    expect(mapped.champions[0].baseStats.hp).toEqual({ base: 500, perLevel: 100 })
  })

  it('returns notes as subject/note pairs sorted by subject', () => {
    const snapshot = makeSnapshot('7.3a', 'u', [makeRawItem({ tier: 'mystery' })], [makeRawChampion()])
    const { notes } = mapSnapshot(snapshot, PROVENANCE)
    expect(notes).toContainEqual({ subject: 'item long-sword', note: "unknown tier 'mystery', treated as legendary" })
    expect(notes.map((note) => note.subject)).toEqual([...notes.map((note) => note.subject)].sort((a, b) => a.localeCompare(b)))
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @wr-calc/data exec vitest run test/patch/map-snapshot.test.ts test/wrpocket/render.test.ts`
Expected: FAIL (missing module; header text and provenance-name assertions).

- [ ] **Step 4: Implement**

In `scripts/wrpocket/render.ts`:
- add `export const GENERATOR_SCRIPT = 'packages/data/scripts/patch-update.ts'`
- change both `meta: RawMeta` parameter types to `meta: { patch: string; updated: string }` and drop the `RawMeta` import
- give `renderModule` a fifth parameter, `provenanceName: string`, and use it in place of the two hard-coded `WRPOCKET_7_3_PROVENANCE` strings
- change the two header comment lines to:

```ts
    `// GENERATED by ${GENERATOR_SCRIPT}. Do not edit by hand: change the`,
    '// mapper and re-run `pnpm --filter @wr-calc/data patch:update` instead.',
```

- in `renderReport`, change the "Generated by" line to `` `Generated by \`${GENERATOR_SCRIPT}\`. Every value is unverified until checked in-game.` ``

`scripts/patch/map-snapshot.ts`:

```ts
import type { Champion, Item, Provenance } from '@wr-calc/schema'
import { mapChampion } from '../wrpocket/map-champion'
import { mapItem } from '../wrpocket/map-item'
import { RawChampionSchema, RawItemSchema } from '../wrpocket/raw-schemas'
import type { Snapshot } from './snapshot'
import type { NoteRef } from './types'

export interface MappedSnapshot {
  items: Item[]
  champions: Champion[]
  notes: NoteRef[]
}

/** Maps a snapshot to engine items and champions with the existing mapper, collecting its notes. */
export function mapSnapshot(snapshot: Snapshot, provenance: Provenance): MappedSnapshot {
  const rawItems = snapshot.items.map((item) => RawItemSchema.parse(item))
  const rawChampions = snapshot.champions.map((champion) => RawChampionSchema.parse(champion))
  const prices = new Map(rawItems.map((item) => [item.id, Number(item.price)]))
  const items = rawItems.map((raw) => mapItem(raw, prices, provenance))
  const champions = rawChampions.map((raw) => mapChampion(raw, provenance))
  const notes = [
    ...champions.map(({ value, notes: list }) => ({ subject: `champion ${value.id}`, list })),
    ...items.map(({ value, notes: list }) => ({ subject: `item ${value.id}`, list })),
  ]
    .sort((a, b) => a.subject.localeCompare(b.subject))
    .flatMap(({ subject, list }) => list.map((note) => ({ subject, note })))
  return {
    items: items.map(({ value }) => value),
    champions: champions.map(({ value }) => value),
    notes,
  }
}
```

`scripts/import-wrpocket.ts` still calls `renderModule` with four arguments, and Task 7 deletes it. For now add `'WRPOCKET_7_3_PROVENANCE'` as the fifth argument at both call sites so typecheck stays green.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @wr-calc/data test` and `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/data/scripts packages/data/test
git commit -m "feat: map snapshots and parameterise the generated-file provenance name

The generated-file header now names scripts/patch-update.ts, so the render test's expected header changes with it."
```

---

### Task 4: Flags, goldens, the patch diff and its markdown report

**Files:**
- Create: `packages/data/scripts/patch/patch-diff.ts`, `packages/data/scripts/patch/render-diff.ts`
- Test: `packages/data/test/patch/patch-diff.test.ts`, `packages/data/test/patch/render-diff.test.ts`

**Interfaces:**
- Consumes: `diffSnapshots`, `changedIdsOf` (Task 2); types from `types.ts`; `LoadedGoldenCase` (`src/golden-loader.ts`)
- Produces:
  - `GoldenRef = { file: string; championId: string; itemIds: string[] }`, `goldenRefs(cases: LoadedGoldenCase[]): GoldenRef[]`
  - `goldensUsing(ref: EntryRef, goldens: GoldenRef[]): string[]`
  - `flagHandModelled(diff: SnapshotDiff, handModelled: IdLists, covered: IdLists, goldens: GoldenRef[]): Flag[]`
  - `BuildPatchDiffInput`, `buildPatchDiff(input: BuildPatchDiffInput): PatchDiff`
  - `renderPatchDiff(diff: PatchDiff): string`

- [ ] **Step 1: Write the failing tests**

`test/patch/patch-diff.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { diffSnapshots } from '../../scripts/patch/diff'
import { buildPatchDiff, flagHandModelled, goldenRefs, goldensUsing } from '../../scripts/patch/patch-diff'
import type { GoldenRef } from '../../scripts/patch/patch-diff'
import type { LoadedGoldenCase } from '../../src/golden-loader'
import { makeRawChampion, makeRawItem, makeSnapshot } from './fixtures'

const golden = (file: string, championId: string, items: string[], boots?: string): LoadedGoldenCase => ({
  file,
  case: {
    scenario: {
      championId, level: 15, build: { items, runes: [], inputs: {}, ...(boots ? { boots } : {}) },
      target: { hp: 10000, armor: 100, mr: 100 }, combo: ['Q'],
    },
    expected: { totalDamage: 1 }, tolerance: 0.01, patch: '7.3', source: 'practice-tool',
  },
})

const GOLDENS: GoldenRef[] = goldenRefs([
  golden('annie-q.json', 'annie', ['rabadons-deathcap'], 'spellslingers-shoes'),
  golden('ambessa-aa.json', 'ambessa', ['bf-sword']),
])

const NONE = { items: [], champions: [] }
const before = makeSnapshot('7.3', '2026-09-23 10:19:27',
  [makeRawItem({ id: 'trinity-force', name: { en: 'Trinity Force' } }), makeRawItem({ id: 'b.-f.-sword' }),
    makeRawItem({ id: 'rabadons-deathcap' }), makeRawItem({ id: 'plain' })],
  [makeRawChampion()])
const after = makeSnapshot('7.3a', '2026-09-29 16:09:43',
  [makeRawItem({ id: 'trinity-force', name: { en: 'Trinity Force' }, price: '3400' }),
    makeRawItem({ id: 'b.-f.-sword', price: '1450' }), makeRawItem({ id: 'plain', price: '1' })],
  [makeRawChampion({ stats: { ...makeRawChampion().stats, レベル1: { ...makeRawChampion().stats['レベル1'], 攻撃力: 55 } } })])
const diff = diffSnapshots(before, after)

describe('goldensUsing', () => {
  it('matches by champion id, build items, boots and enchant', () => {
    const [withEnchant] = goldenRefs([{ ...golden('e.json', 'jinx', []), case: { ...golden('e.json', 'jinx', []).case, scenario: { ...golden('e.json', 'jinx', []).case.scenario, build: { items: [], runes: [], inputs: {}, enchant: 'stasis-enchant' } } } }])
    expect(withEnchant.itemIds).toEqual(['stasis-enchant'])
    expect(goldensUsing({ kind: 'champion', id: 'annie', name: 'Annie' }, GOLDENS)).toEqual(['annie-q.json'])
    expect(goldensUsing({ kind: 'item', id: 'spellslingers-shoes', name: '' }, GOLDENS)).toEqual(['annie-q.json'])
    expect(goldensUsing({ kind: 'item', id: 'annie', name: '' }, GOLDENS)).toEqual([])
  })
})

describe('flagHandModelled', () => {
  const handModelled = { items: ['trinity-force', 'bf-sword', 'rabadons-deathcap'], champions: ['annie'] }

  it('flags removed entries first, then changed ones, with goldens', () => {
    const flags = flagHandModelled(diff, handModelled, NONE, GOLDENS)
    expect(flags.map((flag) => [flag.severity, flag.kind, flag.id])).toEqual([
      ['removed', 'item', 'rabadons-deathcap'],
      ['changed', 'champion', 'annie'],
      ['changed', 'item', 'bf-sword'],
      ['changed', 'item', 'trinity-force'],
    ])
    expect(flags[0].goldens).toEqual(['annie-q.json'])
    expect(flags[2].goldens).toEqual(['ambessa-aa.json'])
  })

  it('skips covered ids and ids that are not hand-modelled', () => {
    const flags = flagHandModelled(diff, handModelled, { items: ['trinity-force'], champions: ['annie'] }, GOLDENS)
    expect(flags.map((flag) => flag.id)).toEqual(['rabadons-deathcap', 'bf-sword'])
    expect(flags.some((flag) => flag.id === 'plain')).toBe(false)
  })
})

describe('buildPatchDiff', () => {
  const result = buildPatchDiff({
    before, after, handModelled: { items: ['trinity-force'], champions: [] },
    previousStale: [{ kind: 'item', id: 'old-stale', name: 'Old', since: '7.2' }],
    covered: NONE, goldens: GOLDENS,
    notesBefore: [{ subject: 'item plain', note: 'gone note' }, { subject: 'item plain', note: 'kept' }],
    notesAfter: [{ subject: 'item plain', note: 'kept' }, { subject: 'item plain', note: 'new note' }],
  })

  it('carries the header fields and the flags', () => {
    expect([result.from, result.to, result.fromUpdated, result.toUpdated])
      .toEqual(['7.3', '7.3a', '2026-09-23 10:19:27', '2026-09-29 16:09:43'])
    expect(result.needsReview.map((flag) => flag.id)).toEqual(['trinity-force'])
  })

  it('attaches goldens to changed generated entries', () => {
    expect(result.champions.find((entry) => entry.id === 'annie')?.goldens).toEqual(['annie-q.json'])
  })

  it('keeps earlier stale entries unless covered now', () => {
    expect(result.carriedStale.map((entry) => entry.id)).toEqual(['old-stale'])
    const covered = buildPatchDiff({
      before, after, handModelled: NONE, previousStale: [{ kind: 'item', id: 'old-stale', name: 'Old', since: '7.2' }],
      covered: { items: ['old-stale'], champions: [] }, goldens: [], notesBefore: [], notesAfter: [],
    })
    expect(covered.carriedStale).toEqual([])
  })

  it('reports mapper notes that are new or gone', () => {
    expect(result.mapperNotes).toEqual({
      added: [{ subject: 'item plain', note: 'new note' }],
      removed: [{ subject: 'item plain', note: 'gone note' }],
    })
  })
})
```

`test/patch/render-diff.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { renderPatchDiff } from '../../scripts/patch/render-diff'
import type { PatchDiff } from '../../scripts/patch/types'

const DIFF: PatchDiff = {
  from: '7.3', to: '7.3a', fromUpdated: '2026-09-23 10:19:27', toUpdated: '2026-09-29 16:09:43',
  needsReview: [
    { severity: 'removed', kind: 'item', id: 'gone-item', name: 'Gone Item', changes: [], goldens: [] },
    {
      severity: 'changed', kind: 'item', id: 'blade-of-the-ruined-king', name: 'Blade of the Ruined King',
      goldens: ['ambessa-aa.json'],
      changes: [
        { field: 'stats.attackDamage', before: '40', after: '35' },
        { field: 'description', before: 'Deals 7%', after: 'Deals 6%', numbers: [{ before: '7%', after: '6%' }], wordDiff: 'Deals ~~7%~~**6%**' },
        { field: 'name', before: 'a b', after: 'b a', numbers: [], wordDiff: '~~a~~ b **a**' },
      ],
    },
  ],
  carriedStale: [{ kind: 'champion', id: 'ambessa', name: 'Ambessa', since: '7.2' }],
  items: [], champions: [
    { kind: 'champion', id: 'annie', name: 'Annie', goldens: ['annie-q.json'], changes: [{ field: 'stats.ad', before: 'Lv1 52', after: 'Lv1 55' }] },
  ],
  added: [{ kind: 'item', id: 'new-item', name: 'New Item' }], removed: [],
  mapperNotes: { added: [{ subject: 'item x', note: 'n' }], removed: [] },
}

describe('renderPatchDiff', () => {
  const report = renderPatchDiff(DIFF)

  it('puts the sections in order', () => {
    const order = ['# Patch diff: 7.3 → 7.3a', '## Needs review', '## Still stale from earlier patches',
      '## Changed champions', '## Changed items', '## Added', '## Removed', '## Mapper notes']
    const positions = order.map((heading) => report.indexOf(heading))
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('renders flags with severity, goldens, value and text changes', () => {
    expect(report).toContain('### item gone-item (Gone Item): removed from wrpocket')
    expect(report).toContain('### item blade-of-the-ruined-king (Blade of the Ruined King): changed')
    expect(report).toContain('Goldens: ambessa-aa.json')
    expect(report).toContain('- `stats.attackDamage`: 40 → 35')
    expect(report).toContain('- `description`: numbers 7% → 6%')
    expect(report).toContain('- `name`: wording only')
    expect(report).toContain('<details><summary>text diff</summary>\n\nDeals ~~7%~~**6%**\n\n</details>')
  })

  it('says None. for empty sections and shows summary counts', () => {
    expect(report).toContain('## Removed\n\nNone.')
    expect(report).toContain('- 2 hand-modelled entries need review')
    expect(report).toContain('- 0 items and 1 champions changed, 1 added, 0 removed')
    expect(report).toContain('- champion ambessa (Ambessa), stale since 7.2')
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @wr-calc/data exec vitest run test/patch/patch-diff.test.ts test/patch/render-diff.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `patch-diff.ts`**

```ts
import type { LoadedGoldenCase } from '../../src/golden-loader'
import { diffSnapshots } from './diff'
import type { Snapshot } from './snapshot'
import type { EntryDiff, EntryRef, Flag, IdLists, NoteRef, PatchDiff, ReportedDiff, SnapshotDiff, StaleRef } from './types'

/** What a golden case touches, for matching against changed entries. */
export interface GoldenRef {
  file: string
  championId: string
  itemIds: string[]
}

/** Extracts each golden case's champion and build item ids (boots and enchant included). */
export function goldenRefs(cases: LoadedGoldenCase[]): GoldenRef[] {
  return cases.map(({ file, case: goldenCase }) => {
    const { items, boots, enchant } = goldenCase.scenario.build
    return {
      file,
      championId: goldenCase.scenario.championId,
      itemIds: [...items, ...[boots, enchant].filter((id): id is string => id !== undefined)],
    }
  })
}

/** Golden case files that use the given entry, sorted. */
export function goldensUsing(ref: EntryRef, goldens: GoldenRef[]): string[] {
  return goldens
    .filter((golden) => (ref.kind === 'champion' ? golden.championId === ref.id : golden.itemIds.includes(ref.id)))
    .map((golden) => golden.file)
    .sort()
}

const compareRefs = (a: EntryRef, b: EntryRef): number => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id)

/** Flags hand-modelled entries that changed or disappeared and are not covered; removed ones first. */
export function flagHandModelled(diff: SnapshotDiff, handModelled: IdLists, covered: IdLists, goldens: GoldenRef[]): Flag[] {
  const listFor = (lists: IdLists, kind: EntryRef['kind']): Set<string> => new Set(kind === 'item' ? lists.items : lists.champions)
  const needsFlag = (ref: EntryRef): boolean => listFor(handModelled, ref.kind).has(ref.id) && !listFor(covered, ref.kind).has(ref.id)
  const removed: Flag[] = diff.removed.filter(needsFlag).sort(compareRefs)
    .map((ref) => ({ ...ref, severity: 'removed', changes: [], goldens: goldensUsing(ref, goldens) }))
  const changed: Flag[] = [...diff.items, ...diff.champions].filter(needsFlag).sort(compareRefs)
    .map((entry) => ({ ...entry, severity: 'changed', goldens: goldensUsing(entry, goldens) }))
  return [...removed, ...changed]
}

export interface BuildPatchDiffInput {
  before: Snapshot
  after: Snapshot
  /** The previous patch's effective hand-modelled ids. */
  handModelled: IdLists
  /** Entries already stale in the previous patch. */
  previousStale: StaleRef[]
  /** Ids overridden or reviewed in the new patch. */
  covered: IdLists
  goldens: GoldenRef[]
  notesBefore: NoteRef[]
  notesAfter: NoteRef[]
}

const noteKey = (note: NoteRef): string => `${note.subject}\u0000${note.note}`

/** Builds the full report data for one patch: flags, carried staleness, diffs with goldens, note changes. */
export function buildPatchDiff(input: BuildPatchDiffInput): PatchDiff {
  const diff = diffSnapshots(input.before, input.after)
  const withGoldens = (entries: EntryDiff[]): ReportedDiff[] =>
    entries.map((entry) => ({ ...entry, goldens: goldensUsing(entry, input.goldens) }))
  const coveredIds = (kind: EntryRef['kind']): Set<string> => new Set(kind === 'item' ? input.covered.items : input.covered.champions)
  const beforeKeys = new Set(input.notesBefore.map(noteKey))
  const afterKeys = new Set(input.notesAfter.map(noteKey))
  return {
    from: input.before.meta.patch,
    to: input.after.meta.patch,
    fromUpdated: input.before.meta.updated,
    toUpdated: input.after.meta.updated,
    needsReview: flagHandModelled(diff, input.handModelled, input.covered, input.goldens),
    carriedStale: input.previousStale.filter((entry) => !coveredIds(entry.kind).has(entry.id)).sort(compareRefs),
    items: withGoldens(diff.items),
    champions: withGoldens(diff.champions),
    added: diff.added,
    removed: diff.removed,
    mapperNotes: {
      added: input.notesAfter.filter((note) => !beforeKeys.has(noteKey(note))),
      removed: input.notesBefore.filter((note) => !afterKeys.has(noteKey(note))),
    },
  }
}
```

- [ ] **Step 4: Implement `render-diff.ts`**

```ts
import { GENERATOR_SCRIPT } from '../wrpocket/render'
import type { EntryRef, FieldChange, PatchDiff, ReportedDiff } from './types'

const label = (ref: EntryRef): string => `${ref.kind} ${ref.id} (${ref.name})`

function renderChange(change: FieldChange): string[] {
  if (change.wordDiff === undefined) return [`- \`${change.field}\`: ${change.before} → ${change.after}`]
  const numbers = change.numbers ?? []
  const summary = numbers.length === 0
    ? 'wording only'
    : `numbers ${numbers.map(({ before, after }) => `${before || '∅'} → ${after || '∅'}`).join(', ')}`
  return [
    `- \`${change.field}\`: ${summary}`,
    '',
    `  <details><summary>text diff</summary>\n\n${change.wordDiff}\n\n</details>`,
    '',
  ]
}

function renderEntry(heading: string, goldens: string[], changes: FieldChange[]): string[] {
  return [
    `### ${heading}`, '',
    `Goldens: ${goldens.length === 0 ? 'none' : goldens.join(', ')}`, '',
    ...changes.flatMap(renderChange),
    '',
  ]
}

const orNone = (lines: string[]): string[] => (lines.length === 0 ? ['None.', ''] : lines)

const renderDiffs = (entries: ReportedDiff[]): string[] =>
  orNone(entries.flatMap((entry) => renderEntry(label(entry), entry.goldens, entry.changes)))

/** Renders PATCH_DIFF.md: summary, needs review, carried staleness, changes, added, removed, mapper notes. */
export function renderPatchDiff(diff: PatchDiff): string {
  const lines = [
    `# Patch diff: ${diff.from} → ${diff.to}`, '',
    `Generated by \`${GENERATOR_SCRIPT}\` from the wrpocket snapshots (${diff.from} updated ${diff.fromUpdated}, `
      + `${diff.to} updated ${diff.toUpdated}). Every value is unverified until checked in-game.`, '',
    `- ${diff.needsReview.length} hand-modelled entries need review`,
    `- ${diff.items.length} items and ${diff.champions.length} champions changed, ${diff.added.length} added, ${diff.removed.length} removed`,
    '- Changes to generated entries are already applied; they are listed for information.', '',
    '## Needs review', '',
    'Clear a flag by writing an override in `overrides.ts` (values changed) or adding the id to '
      + '`reviewed.ts` with a note (nothing we model changed).', '',
    ...orNone(diff.needsReview.flatMap((flag) => renderEntry(
      `${label(flag)}: ${flag.severity === 'removed' ? 'removed from wrpocket' : 'changed'}`, flag.goldens, flag.changes,
    ))),
    '## Still stale from earlier patches', '',
    ...orNone(diff.carriedStale.map((entry) => `- ${label(entry)}, stale since ${entry.since}`)),
    ...(diff.carriedStale.length > 0 ? [''] : []),
    '## Changed champions', '', ...renderDiffs(diff.champions),
    '## Changed items', '', ...renderDiffs(diff.items),
    '## Added', '', ...orNone(diff.added.map((entry) => `- ${label(entry)}`)),
    ...(diff.added.length > 0 ? [''] : []),
    '## Removed', '', ...orNone(diff.removed.map((entry) => `- ${label(entry)}`)),
    ...(diff.removed.length > 0 ? [''] : []),
    '## Mapper notes', '',
    '### New', '', ...orNone(diff.mapperNotes.added.map((note) => `- ${note.subject}: ${note.note}`)),
    ...(diff.mapperNotes.added.length > 0 ? [''] : []),
    '### Gone', '', ...orNone(diff.mapperNotes.removed.map((note) => `- ${note.subject}: ${note.note}`)),
  ]
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @wr-calc/data exec vitest run test/patch` and `pnpm typecheck`
Expected: PASS. If an exact-string assertion fails only on blank-line spacing, fix the renderer (not the test) so the shown string appears as written.

- [ ] **Step 6: Commit**

```bash
git add packages/data/scripts/patch packages/data/test/patch
git commit -m "feat: flag changed hand-modelled entries and render PATCH_DIFF.md"
```

---

### Task 5: Overlay datasets, registry and staleness

**Files:**
- Modify: `packages/schema/src/provenance.ts`, `packages/data/src/index.ts`, `packages/data/test/golden.test.ts`
- Create: `packages/data/src/patches/overlay.ts`, `packages/data/src/patches/layers.ts`, `packages/data/src/patches/registry.ts`, `packages/data/src/patches/7.3/layer.ts`
- Test: `packages/data/test/overlay.test.ts`, `packages/data/test/registry.test.ts`, the provenance test in `packages/schema/test/` (append to the existing provenance or schema test file; create `packages/schema/test/provenance.test.ts` if none exists)

**Interfaces:**
- Produces:
  - `ProvenanceSchema` with `staleSince?: string`
  - `ReviewedEntry = { kind: 'item' | 'champion'; id: string; note: string }`
  - `ChangedIds = { items: string[]; champions: string[] }`
  - `PatchLayer`, `PatchDataset` (fields below)
  - `buildPatchDataset(layer: PatchLayer, previous: PatchDataset | null): PatchDataset`
  - `buildPatchDatasets(layers: PatchLayer[]): Map<string, PatchDataset>`
  - `PATCH_LAYERS: PatchLayer[]`, `PATCH_IDS: readonly string[]`, `CURRENT_PATCH: string`, `getPatchDataset(id: string): PatchDataset`

- [ ] **Step 1: Write the failing schema test**

```ts
import { describe, it, expect } from 'vitest'
import { ProvenanceSchema } from '../src/provenance'

describe('ProvenanceSchema staleSince', () => {
  it('is optional and accepts a patch id', () => {
    expect(ProvenanceSchema.parse({ source: 'wiki', patch: '7.3', verifiedInGame: false })).not.toHaveProperty('staleSince')
    expect(ProvenanceSchema.parse({ source: 'wiki', patch: '7.3', verifiedInGame: false, staleSince: '7.3a' }).staleSince).toBe('7.3a')
  })
})
```

Run: `pnpm --filter @wr-calc/schema test`. Expected: FAIL (strict object rejects `staleSince`).

- [ ] **Step 2: Add the field**

In `packages/schema/src/provenance.ts`, add to the object, after `verifiedAt`:

```ts
  /** The patch whose source data changed under this hand-modelled entry; it needs re-checking. */
  staleSince: z.string().optional(),
```

Run: `pnpm --filter @wr-calc/schema test`. Expected: PASS.

- [ ] **Step 3: Write the failing overlay tests**

`packages/data/test/overlay.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { Champion, Item } from '@wr-calc/schema'
import { buildPatchDataset, buildPatchDatasets } from '../src/patches/overlay'
import type { PatchLayer } from '../src/patches/overlay'

const PROV = { source: 'wiki' as const, patch: '7.3', verifiedInGame: true }
const item = (id: string, ad = 10): Item => ({
  id, name: id, tier: 'legendary', cost: { total: 1, combine: 1 }, recipe: [], stats: { ad }, effects: [], tags: [], provenance: PROV,
})
const champion = { id: 'ambessa', name: 'Ambessa', provenance: PROV } as unknown as Champion
const NO_CHANGES = { items: [], champions: [] }

const root: PatchLayer = {
  id: '7.3', generatedItems: [item('hand', 1), item('plain'), item('grouped')], generatedChampions: [],
  overrideItems: [item('hand', 99)], overrideChampions: [champion], reviewed: [], changedIds: NO_CHANGES,
  exclusiveGroups: { grouped: 'g' }, targets: [],
}
const next = (overrides: Partial<PatchLayer>): PatchLayer => ({
  id: '7.3a', generatedItems: [item('hand', 2), item('plain'), item('grouped')], generatedChampions: [],
  overrideItems: [], overrideChampions: [], reviewed: [], changedIds: NO_CHANGES, ...overrides,
})

describe('buildPatchDataset', () => {
  const base = buildPatchDataset(root, null)

  it('root: hand-modelled entries replace generated ones, groups applied, nothing stale', () => {
    expect(base.items.find((entry) => entry.id === 'hand')?.stats.ad).toBe(99)
    expect(base.items.find((entry) => entry.id === 'grouped')?.exclusiveGroup).toBe('g')
    expect(base.stale.items.size).toBe(0)
  })

  it('throws for a root layer without groups or targets', () => {
    expect(() => buildPatchDataset({ ...root, exclusiveGroups: undefined }, null)).toThrow(/root patch 7.3/)
  })

  it('inherits hand-modelled entries and marks changed ones stale', () => {
    const dataset = buildPatchDataset(next({ changedIds: { items: ['hand', 'plain'], champions: ['ambessa'] } }), base)
    const hand = dataset.items.find((entry) => entry.id === 'hand')
    expect(hand?.stats.ad).toBe(99)
    expect(hand?.provenance).toEqual({ ...PROV, verifiedInGame: false, staleSince: '7.3a' })
    expect(dataset.items.find((entry) => entry.id === 'plain')?.provenance).toEqual(PROV)
    expect(dataset.champions.find((entry) => entry.id === 'ambessa')?.provenance.staleSince).toBe('7.3a')
    expect(dataset.handModelled.items.find((entry) => entry.id === 'hand')?.provenance).toEqual(PROV)
  })

  it('does not mark overridden or reviewed entries stale', () => {
    const dataset = buildPatchDataset(next({
      changedIds: { items: ['hand'], champions: ['ambessa'] },
      overrideItems: [item('hand', 50)],
      reviewed: [{ kind: 'champion', id: 'ambessa', note: 'wording only' }],
    }), base)
    expect(dataset.items.find((entry) => entry.id === 'hand')).toEqual(item('hand', 50))
    expect(dataset.stale.items.size + dataset.stale.champions.size).toBe(0)
  })

  it('carries staleness forward with its original patch until covered', () => {
    const a = buildPatchDataset(next({ changedIds: { items: ['hand'], champions: [] } }), base)
    const b = buildPatchDataset({ ...next({}), id: '7.3b' }, a)
    expect(b.stale.items.get('hand')).toBe('7.3a')
    const c = buildPatchDataset({ ...next({ reviewed: [{ kind: 'item', id: 'hand', note: 'checked' }] }), id: '7.3c' }, b)
    expect(c.stale.items.size).toBe(0)
    expect(c.items.find((entry) => entry.id === 'hand')?.provenance).toEqual(PROV)
  })

  it('keeps a hand-modelled entry that wrpocket removed, marked stale', () => {
    const dataset = buildPatchDataset(next({
      generatedItems: [item('plain'), item('grouped')], changedIds: { items: ['hand'], champions: [] },
    }), base)
    expect(dataset.items.find((entry) => entry.id === 'hand')?.provenance.staleSince).toBe('7.3a')
  })

  it('drops inherited exclusive-group ids that no longer exist instead of throwing', () => {
    const dataset = buildPatchDataset(next({ generatedItems: [item('hand'), item('plain')] }), base)
    expect(dataset.exclusiveGroups).toEqual({})
  })

  it('buildPatchDatasets chains layers in order', () => {
    const datasets = buildPatchDatasets([root, next({ changedIds: { items: ['hand'], champions: [] } })])
    expect([...datasets.keys()]).toEqual(['7.3', '7.3a'])
    expect(datasets.get('7.3a')?.stale.items.get('hand')).toBe('7.3a')
  })
})
```

`packages/data/test/registry.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { CURRENT_PATCH, PATCH_IDS, getPatchDataset } from '../src/patches/registry'
import { PATCH_7_3_CHAMPIONS, PATCH_7_3_ITEMS, PATCH_7_3_TARGETS } from '../src/patches/7.3'

describe('patch registry', () => {
  it('current patch is the last registered id', () => {
    expect(CURRENT_PATCH).toBe(PATCH_IDS[PATCH_IDS.length - 1])
    expect(PATCH_IDS[0]).toBe('7.3')
  })

  it('the 7.3 dataset equals the legacy PATCH_7_3 exports', () => {
    const dataset = getPatchDataset('7.3')
    expect(dataset.items).toEqual(PATCH_7_3_ITEMS)
    expect(dataset.champions).toEqual(PATCH_7_3_CHAMPIONS)
    expect(dataset.targets).toEqual(PATCH_7_3_TARGETS)
    expect([...dataset.catalog.items.keys()]).toEqual(PATCH_7_3_ITEMS.map((item) => item.id))
  })

  it('every registered patch builds', () => {
    for (const id of PATCH_IDS) expect(getPatchDataset(id).id).toBe(id)
  })

  it('throws for an unknown patch, naming the known ones', () => {
    expect(() => getPatchDataset('6.0')).toThrow("unknown patch '6.0' (known: ")
  })
})
```

Run: `pnpm --filter @wr-calc/data exec vitest run test/overlay.test.ts test/registry.test.ts`. Expected: FAIL, modules not found.

- [ ] **Step 4: Implement the overlay**

`packages/data/src/patches/overlay.ts`:

```ts
import type { Champion, Item, Provenance } from '@wr-calc/schema'
import type { StatCatalog } from '@wr-calc/calc'
import { buildCatalog, mergeById, withExclusiveGroups } from '../catalog'
import type { TargetPreset } from './7.3/targets'

/** Ids of every source record that changed or disappeared since the previous patch. */
export interface ChangedIds {
  items: string[]
  champions: string[]
}

/** A flagged entry checked for this patch and found unaffected, with what was checked. */
export interface ReviewedEntry {
  kind: 'item' | 'champion'
  id: string
  note: string
}

/** Everything one patch folder contributes to its dataset. */
export interface PatchLayer {
  id: string
  generatedItems: Item[]
  generatedChampions: Champion[]
  /** Hand-modelled entries written for this patch; they replace inherited ones by id. */
  overrideItems: Item[]
  overrideChampions: Champion[]
  reviewed: ReviewedEntry[]
  changedIds: ChangedIds
  /** Replaces the inherited groups when set; required on the root patch. */
  exclusiveGroups?: Record<string, string>
  /** Replaces the inherited targets when set; required on the root patch. */
  targets?: TargetPreset[]
}

/** One patch's data as the engine and app consume it. */
export interface PatchDataset {
  id: string
  items: Item[]
  champions: Champion[]
  catalog: StatCatalog
  targets: TargetPreset[]
  exclusiveGroups: Record<string, string>
  /** Effective hand-modelled entries without stale marks; the next patch inherits these. */
  handModelled: { items: Item[]; champions: Champion[] }
  /** Hand-modelled id -> the patch it went stale in. */
  stale: { items: Map<string, string>; champions: Map<string, string> }
}

function nextStale(
  patch: string, inherited: Array<{ id: string }>, previous: Map<string, string>, changed: string[], covered: Set<string>,
): Map<string, string> {
  const stale = new Map([...previous].filter(([id]) => !covered.has(id)))
  const inheritedIds = new Set(inherited.map((entry) => entry.id))
  for (const id of changed) {
    if (inheritedIds.has(id) && !covered.has(id) && !stale.has(id)) stale.set(id, patch)
  }
  return stale
}

function markStale<T extends { id: string; provenance: Provenance }>(entries: T[], stale: Map<string, string>): T[] {
  return entries.map((entry) => {
    const since = stale.get(entry.id)
    return since === undefined ? entry : { ...entry, provenance: { ...entry.provenance, verifiedInGame: false, staleSince: since } }
  })
}

/** Builds a patch's dataset from its layer over the previous patch's dataset (null for the root). */
export function buildPatchDataset(layer: PatchLayer, previous: PatchDataset | null): PatchDataset {
  if (previous === null && (layer.exclusiveGroups === undefined || layer.targets === undefined)) {
    throw new Error(`root patch ${layer.id} must define exclusiveGroups and targets`)
  }
  const covered = (kind: ReviewedEntry['kind'], overrides: Array<{ id: string }>): Set<string> => new Set([
    ...overrides.map((entry) => entry.id),
    ...layer.reviewed.filter((entry) => entry.kind === kind).map((entry) => entry.id),
  ])
  const inheritedItems = previous?.handModelled.items ?? []
  const inheritedChampions = previous?.handModelled.champions ?? []
  const stale = {
    items: nextStale(layer.id, inheritedItems, previous?.stale.items ?? new Map(), layer.changedIds.items, covered('item', layer.overrideItems)),
    champions: nextStale(layer.id, inheritedChampions, previous?.stale.champions ?? new Map(), layer.changedIds.champions, covered('champion', layer.overrideChampions)),
  }
  const handModelled = {
    items: mergeById(inheritedItems, layer.overrideItems),
    champions: mergeById(inheritedChampions, layer.overrideChampions),
  }
  const merged = mergeById(layer.generatedItems, markStale(handModelled.items, stale.items))
  // Inherited groups drop ids wrpocket removed (the report lists the removal); a layer's own groups stay strict.
  const presentIds = new Set(merged.map((entry) => entry.id))
  const exclusiveGroups = layer.exclusiveGroups ?? Object.fromEntries(
    Object.entries(previous?.exclusiveGroups ?? {}).filter(([id]) => presentIds.has(id)),
  )
  const items = withExclusiveGroups(merged, exclusiveGroups)
  return {
    id: layer.id,
    items,
    champions: mergeById(layer.generatedChampions, markStale(handModelled.champions, stale.champions)),
    catalog: buildCatalog(items, []),
    targets: layer.targets ?? previous?.targets ?? [],
    exclusiveGroups,
    handModelled,
    stale,
  }
}

/** Builds every layer's dataset in order, each over the one before it. */
export function buildPatchDatasets(layers: PatchLayer[]): Map<string, PatchDataset> {
  const datasets = new Map<string, PatchDataset>()
  let previous: PatchDataset | null = null
  for (const layer of layers) {
    previous = buildPatchDataset(layer, previous)
    datasets.set(layer.id, previous)
  }
  return datasets
}
```

`packages/data/src/patches/7.3/layer.ts`:

```ts
import type { PatchLayer } from '../overlay'
import { HAND_MODELED_CHAMPIONS } from './champions'
import { EXCLUSIVE_GROUPS } from './exclusive-groups'
import { GENERATED_CHAMPIONS } from './generated/champions'
import { GENERATED_ITEMS } from './generated/items'
import { STARTER_ITEMS } from './items'
import { PATCH_7_3_TARGETS } from './targets'

/** Patch 7.3, the root layer: its hand-modelled entries, groups and targets seed every later patch. */
export const PATCH_LAYER: PatchLayer = {
  id: '7.3',
  generatedItems: GENERATED_ITEMS,
  generatedChampions: GENERATED_CHAMPIONS,
  overrideItems: STARTER_ITEMS,
  overrideChampions: HAND_MODELED_CHAMPIONS,
  reviewed: [],
  changedIds: { items: [], champions: [] },
  exclusiveGroups: EXCLUSIVE_GROUPS,
  targets: PATCH_7_3_TARGETS,
}
```

`packages/data/src/patches/layers.ts`, written in exactly the format Task 6's `renderLayersModule(['7.3'])` produces:

```ts
// GENERATED by packages/data/scripts/patch-update.ts from the snapshots in
// packages/data/snapshots/wrpocket, oldest first. Do not edit by hand.
import type { PatchLayer } from './overlay'
import { PATCH_LAYER as PATCH_7_3 } from './7.3/layer'

export const PATCH_LAYERS: PatchLayer[] = [PATCH_7_3]
```

`packages/data/src/patches/registry.ts`:

```ts
import { PATCH_LAYERS } from './layers'
import { buildPatchDatasets } from './overlay'
import type { PatchDataset } from './overlay'

/** Every patch with data, oldest first. */
export const PATCH_IDS: readonly string[] = PATCH_LAYERS.map((layer) => layer.id)

/** The newest imported patch: the app's default. */
export const CURRENT_PATCH: string = PATCH_IDS[PATCH_IDS.length - 1]

let datasets: Map<string, PatchDataset> | null = null

/** Returns a patch's dataset, building every patch's dataset on first use. */
export function getPatchDataset(id: string): PatchDataset {
  datasets ??= buildPatchDatasets(PATCH_LAYERS)
  const dataset = datasets.get(id)
  if (dataset === undefined) throw new Error(`unknown patch '${id}' (known: ${PATCH_IDS.join(', ')})`)
  return dataset
}
```

In `packages/data/src/index.ts`, add:

```ts
export * from './patches/registry'
export type { ChangedIds, PatchDataset, PatchLayer, ReviewedEntry } from './patches/overlay'
```

- [ ] **Step 5: Run each golden case against its own patch**

Replace the body of `packages/data/test/golden.test.ts` with:

```ts
import { describe, it, expect } from 'vitest'
import { runGoldenCase } from '../src/golden-runner'
import { loadGoldenCases } from '../src/golden-loader'
import { buildChampionMap } from '../src/champion-map'
import { getPatchDataset } from '../src/patches/registry'

const GOLDEN_DIR = new URL('../golden', import.meta.url).pathname
const cases = loadGoldenCases(GOLDEN_DIR)

// Each case runs against the patch it was recorded on, so a newer patch never silently re-baselines it.
describe.each(cases)('golden case: $file', ({ file, case: goldenCase }) => {
  it(`matches simulateCombo within tolerance (${file}, patch ${goldenCase.patch})`, () => {
    const dataset = getPatchDataset(goldenCase.patch)
    const result = runGoldenCase(goldenCase, buildChampionMap(dataset.champions), dataset.catalog)
    expect(result.passed, result.failures.join('; ')).toBe(true)
  })
})
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm -r test` and `pnpm typecheck`
Expected: PASS, including `browser-safe-entry.test.ts` (nothing new imports `node:`).

- [ ] **Step 7: Commit**

```bash
git add packages/schema packages/data/src packages/data/test
git commit -m "feat: overlay patch datasets, registry and staleSince provenance"
```

---

### Task 6: Scaffolding and the run plan

**Files:**
- Create: `packages/data/scripts/patch/scaffold.ts`, `packages/data/scripts/patch/run-plan.ts`
- Test: `packages/data/test/patch/scaffold.test.ts`, `packages/data/test/patch/run-plan.test.ts`

**Interfaces:**
- Consumes: `SnapshotMeta` (Task 1), `ChangedIds` (Task 5)
- Produces:
  - `patchConst(id: string): string` (`'7.3a'` → `'7_3A'`), `provenanceName(id: string): string` (→ `'WRPOCKET_7_3A_PROVENANCE'`)
  - `renderLayersModule(ids: string[]): string`, `renderChangedIds(ids: ChangedIds, patch: string): string`
  - `scaffoldFiles(patch: string): Record<string, string>` (file name → content, for `provenance.ts`, `overrides.ts`, `reviewed.ts`, `layer.ts`)
  - `writeMissingFiles(dir: string, files: Record<string, string>): Promise<string[]>` (returns the names it created)
  - `RunPlan`, `planRun(meta: SnapshotMeta, known: SnapshotMeta[], force: boolean): RunPlan`
  - `metaFromCacheDir(dir: string): SnapshotMeta`, `stripGeneratorHeader(text: string): string`

- [ ] **Step 1: Write the failing tests**

`test/patch/scaffold.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  patchConst, provenanceName, renderChangedIds, renderLayersModule, scaffoldFiles, writeMissingFiles,
} from '../../scripts/patch/scaffold'

const LAYERS_FILE = new URL('../../src/patches/layers.ts', import.meta.url).pathname

describe('names', () => {
  it('turns patch ids into constant-safe names', () => {
    expect(patchConst('7.3')).toBe('7_3')
    expect(patchConst('7.3a')).toBe('7_3A')
    expect(provenanceName('7.3a')).toBe('WRPOCKET_7_3A_PROVENANCE')
  })
})

describe('renderLayersModule', () => {
  it('reproduces the committed layers.ts for the patches it lists', async () => {
    const committed = await readFile(LAYERS_FILE, 'utf-8')
    const ids = [...committed.matchAll(/from '\.\/(.+)\/layer'/g)].map((match) => match[1])
    expect(renderLayersModule(ids)).toBe(committed)
  })

  it('imports each layer in order', () => {
    const source = renderLayersModule(['7.3', '7.3a'])
    expect(source).toContain("import { PATCH_LAYER as PATCH_7_3A } from './7.3a/layer'")
    expect(source).toContain('export const PATCH_LAYERS: PatchLayer[] = [PATCH_7_3, PATCH_7_3A]')
  })
})

describe('renderChangedIds', () => {
  it('writes a typed constant', () => {
    const source = renderChangedIds({ items: ['a'], champions: [] }, '7.3a')
    expect(source).toContain("import type { ChangedIds } from '../../overlay'")
    expect(source).toContain('export const CHANGED_IDS: ChangedIds = {\n  "items": [\n    "a"\n  ],\n  "champions": []\n}')
  })
})

describe('scaffoldFiles', () => {
  const files = scaffoldFiles('7.3a')

  it('creates the four stub files', () => {
    expect(Object.keys(files).sort()).toEqual(['layer.ts', 'overrides.ts', 'provenance.ts', 'reviewed.ts'])
    expect(files['provenance.ts']).toContain("export const WRPOCKET_7_3A_PROVENANCE: Provenance = {\n  source: 'wiki', patch: '7.3a', verifiedInGame: false,\n}")
    expect(files['layer.ts']).toContain("id: '7.3a'")
    expect(files['overrides.ts']).toContain('export const OVERRIDE_ITEMS: Item[] = []')
    expect(files['reviewed.ts']).toContain('export const REVIEWED: ReviewedEntry[] = []')
  })
})

describe('writeMissingFiles', () => {
  it('never overwrites an existing file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'scaffold-'))
    await writeFile(join(dir, 'reviewed.ts'), 'user edits')
    const created = await writeMissingFiles(dir, { 'reviewed.ts': 'stub', 'overrides.ts': 'stub' })
    expect(created).toEqual(['overrides.ts'])
    expect(await readFile(join(dir, 'reviewed.ts'), 'utf-8')).toBe('user edits')
  })
})
```

`test/patch/run-plan.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { metaFromCacheDir, planRun, stripGeneratorHeader } from '../../scripts/patch/run-plan'

const V73 = { patch: '7.3', updated: '2026-09-23 10:19:27' }
const V73A = { patch: '7.3a', updated: '2026-09-29 16:09:43' }

describe('planRun', () => {
  it('bootstraps when there is no snapshot yet', () => {
    expect(planRun(V73, [], false)).toEqual({ kind: 'bootstrap', patch: '7.3' })
  })

  it('starts a new patch over the current one', () => {
    expect(planRun(V73A, [V73], false)).toEqual({ kind: 'new-patch', patch: '7.3a', previous: '7.3' })
  })

  it('is up to date for the same patch and timestamp, unless forced', () => {
    expect(planRun(V73A, [V73, V73A], false)).toEqual({ kind: 'up-to-date', patch: '7.3a' })
    expect(planRun(V73A, [V73, V73A], true)).toEqual({ kind: 'refresh', patch: '7.3a', previous: '7.3' })
  })

  it('refreshes the current patch in place when wrpocket has newer data', () => {
    expect(planRun({ ...V73A, updated: '2026-10-02 00:00:00' }, [V73, V73A], false))
      .toEqual({ kind: 'refresh', patch: '7.3a', previous: '7.3' })
  })

  it('refuses an older patch id or an older timestamp', () => {
    expect(() => planRun(V73, [V73, V73A], false)).toThrow("wrpocket is on 7.3, older than the current patch 7.3a")
    expect(() => planRun({ ...V73A, updated: '2026-09-01 00:00:00' }, [V73, V73A], false)).toThrow(/older than the 7.3a snapshot/)
    expect(() => planRun({ patch: '7.4', updated: '2026-09-01 00:00:00' }, [V73, V73A], false)).toThrow(/not newer than/)
  })
})

describe('metaFromCacheDir', () => {
  it('reads the patch and timestamp from the cache folder name', () => {
    expect(metaFromCacheDir('/x/.cache/wrpocket/7.3-20260923101927')).toEqual(V73)
  })

  it('throws for a folder name without a timestamp', () => {
    expect(() => metaFromCacheDir('/x/7.3')).toThrow(/expected <patch>-<YYYYMMDDhhmmss>/)
  })
})

describe('stripGeneratorHeader', () => {
  it('drops only the lines naming the generator script', () => {
    const text = [
      '// GENERATED by packages/data/scripts/import-wrpocket.ts. Do not edit by hand: change the',
      '// mapper and re-run `pnpm --filter @wr-calc/data import:wrpocket` instead.',
      '// Source: https://wrpocket.app/site_data (patch 7.3, updated x).',
      'Generated by `packages/data/scripts/import-wrpocket.ts`. Every value is unverified until checked in-game.',
      'body',
    ].join('\n')
    expect(stripGeneratorHeader(text)).toBe('// Source: https://wrpocket.app/site_data (patch 7.3, updated x).\nbody')
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @wr-calc/data exec vitest run test/patch/scaffold.test.ts test/patch/run-plan.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `scaffold.ts`**

```ts
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ChangedIds } from '../../src/patches/overlay'
import { GENERATOR_SCRIPT } from '../wrpocket/render'

/** Turns a patch id into a constant-safe suffix: '7.3a' -> '7_3A'. */
export function patchConst(id: string): string {
  return id.toUpperCase().replace(/[^A-Z0-9]/g, '_')
}

/** Names a patch's wrpocket provenance constant. */
export function provenanceName(id: string): string {
  return `WRPOCKET_${patchConst(id)}_PROVENANCE`
}

/** Renders src/patches/layers.ts for the given patch ids, oldest first. */
export function renderLayersModule(ids: string[]): string {
  return [
    `// GENERATED by ${GENERATOR_SCRIPT} from the snapshots in`,
    '// packages/data/snapshots/wrpocket, oldest first. Do not edit by hand.',
    "import type { PatchLayer } from './overlay'",
    ...ids.map((id) => `import { PATCH_LAYER as PATCH_${patchConst(id)} } from './${id}/layer'`),
    '',
    `export const PATCH_LAYERS: PatchLayer[] = [${ids.map((id) => `PATCH_${patchConst(id)}`).join(', ')}]`,
    '',
  ].join('\n')
}

/** Renders a patch's generated/changed-ids.ts. */
export function renderChangedIds(ids: ChangedIds, patch: string): string {
  return [
    `// GENERATED by ${GENERATOR_SCRIPT}: every wrpocket record that changed or disappeared in`,
    `// patch ${patch}, by this repo's id. The overlay marks inherited hand-modelled entries in it stale.`,
    "import type { ChangedIds } from '../../overlay'",
    '',
    `export const CHANGED_IDS: ChangedIds = ${JSON.stringify({ items: ids.items, champions: ids.champions }, null, 2)}`,
    '',
  ].join('\n')
}

/** The stub files a new patch folder starts with, by file name. */
export function scaffoldFiles(patch: string): Record<string, string> {
  return {
    'provenance.ts': [
      "import type { Provenance } from '@wr-calc/schema'",
      '',
      `/** Every value imported from wrpocket.app for patch ${patch}; unverified until checked in-game. */`,
      `export const ${provenanceName(patch)}: Provenance = {`,
      `  source: 'wiki', patch: '${patch}', verifiedInGame: false,`,
      '}',
      '',
    ].join('\n'),
    'overrides.ts': [
      "import type { Champion, Item } from '@wr-calc/schema'",
      '',
      `// Hand-modelled entries re-written for patch ${patch}. Each replaces the inherited entry with the`,
      '// same id and clears its stale flag.',
      'export const OVERRIDE_ITEMS: Item[] = []',
      'export const OVERRIDE_CHAMPIONS: Champion[] = []',
      '',
    ].join('\n'),
    'reviewed.ts': [
      "import type { ReviewedEntry } from '../overlay'",
      '',
      `// Flagged entries checked for patch ${patch} and found unaffected: their source changed, but`,
      '// nothing this repo models did. Each clears that entry\'s stale flag.',
      'export const REVIEWED: ReviewedEntry[] = []',
      '',
    ].join('\n'),
    'layer.ts': [
      "import type { PatchLayer } from '../overlay'",
      "import { CHANGED_IDS } from './generated/changed-ids'",
      "import { GENERATED_CHAMPIONS } from './generated/champions'",
      "import { GENERATED_ITEMS } from './generated/items'",
      "import { OVERRIDE_CHAMPIONS, OVERRIDE_ITEMS } from './overrides'",
      "import { REVIEWED } from './reviewed'",
      '',
      `/** Patch ${patch}: regenerated wrpocket data over the previous patch's hand-modelled entries. */`,
      'export const PATCH_LAYER: PatchLayer = {',
      `  id: '${patch}',`,
      '  generatedItems: GENERATED_ITEMS,',
      '  generatedChampions: GENERATED_CHAMPIONS,',
      '  overrideItems: OVERRIDE_ITEMS,',
      '  overrideChampions: OVERRIDE_CHAMPIONS,',
      '  reviewed: REVIEWED,',
      '  changedIds: CHANGED_IDS,',
      '}',
      '',
    ].join('\n'),
  }
}

/** Writes each file that does not exist yet and returns the names it created; existing files are never touched. */
export async function writeMissingFiles(dir: string, files: Record<string, string>): Promise<string[]> {
  await mkdir(dir, { recursive: true })
  const created: string[] = []
  for (const [name, content] of Object.entries(files)) {
    const path = join(dir, name)
    if (existsSync(path)) continue
    await writeFile(path, content)
    created.push(name)
  }
  return created.sort()
}
```

- [ ] **Step 4: Implement `run-plan.ts`**

```ts
import { basename } from 'node:path'
import type { SnapshotMeta } from './snapshot'

export type RunPlan =
  | { kind: 'bootstrap'; patch: string }
  | { kind: 'new-patch'; patch: string; previous: string }
  | { kind: 'refresh'; patch: string; previous: string | null }
  | { kind: 'up-to-date'; patch: string }

/** Decides what a run does given wrpocket's meta and the existing snapshots (oldest first). */
export function planRun(meta: SnapshotMeta, known: SnapshotMeta[], force: boolean): RunPlan {
  const current = known[known.length - 1]
  if (current === undefined) return { kind: 'bootstrap', patch: meta.patch }
  if (meta.patch === current.patch) {
    if (meta.updated < current.updated) {
      throw new Error(`wrpocket's ${meta.patch} data (${meta.updated}) is older than the ${current.patch} snapshot (${current.updated})`)
    }
    if (meta.updated === current.updated && !force) return { kind: 'up-to-date', patch: meta.patch }
    return { kind: 'refresh', patch: meta.patch, previous: known[known.length - 2]?.patch ?? null }
  }
  if (known.some((entry) => entry.patch === meta.patch)) {
    throw new Error(`wrpocket is on ${meta.patch}, older than the current patch ${current.patch}`)
  }
  if (meta.updated <= current.updated) {
    throw new Error(`wrpocket's new patch ${meta.patch} (${meta.updated}) is not newer than ${current.patch} (${current.updated})`)
  }
  return { kind: 'new-patch', patch: meta.patch, previous: current.patch }
}

/** Reads patch and update time from a cache folder named <patch>-<YYYYMMDDhhmmss>. */
export function metaFromCacheDir(dir: string): SnapshotMeta {
  const match = /^(.+)-(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(basename(dir))
  if (match === null) throw new Error(`cache folder '${basename(dir)}': expected <patch>-<YYYYMMDDhhmmss>`)
  const [, patch, year, month, day, hour, minute, second] = match
  return { patch, updated: `${year}-${month}-${day} ${hour}:${minute}:${second}` }
}

// Header lines that name the generator script; everything else must match for the determinism check.
const GENERATOR_LINE_RE = /^(\/\/ GENERATED by packages\/data\/scripts\/|\/\/ mapper and re-run `pnpm|Generated by `packages\/data\/scripts\/)/

/** Removes the generator-name header lines so files from the old and new script names compare equal. */
export function stripGeneratorHeader(text: string): string {
  return text.split('\n').filter((line) => !GENERATOR_LINE_RE.test(line)).join('\n')
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @wr-calc/data exec vitest run test/patch` and `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/data/scripts/patch packages/data/test/patch
git commit -m "feat: patch folder scaffolding and run planning"
```

---

### Task 7: The `patch:update` CLI

**Files:**
- Create: `packages/data/scripts/patch-update.ts`
- Delete: `packages/data/scripts/import-wrpocket.ts`
- Modify: `packages/data/package.json` (scripts)

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces: `pnpm --filter @wr-calc/data patch:update [--refresh] [--from-cache <dir>]`.

There is no unit test for this file: it is orchestration over tested modules, and the real runs in Tasks 8 and 9 exercise it end to end. Keep logic out of it; anything that needs a decision belongs in a tested module.

- [ ] **Step 1: Write the CLI**

`packages/data/scripts/patch-update.ts`:

```ts
import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Provenance } from '@wr-calc/schema'
import { loadGoldenCases } from '../src/golden-loader'
import { getPatchDataset } from '../src/patches/registry'
import type { ReviewedEntry } from '../src/patches/overlay'
import { changedIdsOf, diffSnapshots } from './patch/diff'
import { mapSnapshot } from './patch/map-snapshot'
import { buildPatchDiff, goldenRefs } from './patch/patch-diff'
import { renderPatchDiff } from './patch/render-diff'
import { metaFromCacheDir, planRun, stripGeneratorHeader } from './patch/run-plan'
import type { RunPlan } from './patch/run-plan'
import {
  provenanceName, renderChangedIds, renderLayersModule, scaffoldFiles, writeMissingFiles,
} from './patch/scaffold'
import { buildSnapshot, trimMeta } from './patch/snapshot'
import type { Snapshot, SnapshotMeta } from './patch/snapshot'
import { listSnapshotMetas, readSnapshot, writeSnapshot } from './patch/snapshot-io'
import { stableStringify } from './patch/stable-json'
import type { IdLists, StaleRef } from './patch/types'
import {
  RawChampionSchema, RawChampionSummarySchema, RawItemSchema, RawMetaSchema,
} from './wrpocket/raw-schemas'
import type { RawChampion } from './wrpocket/raw-schemas'
import { renderModule, renderReport } from './wrpocket/render'

const BASE_URL = 'https://wrpocket.app/site_data'
const REQUEST_DELAY_MS = 150
const DATA_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SNAPSHOT_ROOT = join(DATA_ROOT, 'snapshots', 'wrpocket')
const PATCHES_DIR = join(DATA_ROOT, 'src', 'patches')
const GOLDEN_DIR = join(DATA_ROOT, 'golden')
// Inside the package so the final renames stay on one filesystem.
const STAGING_DIR = join(DATA_ROOT, '.cache', 'patch-update-staging')
const GENERATED_FILES = ['items.ts', 'champions.ts', 'IMPORT_REPORT.md']

interface Options {
  refresh: boolean
  fromCache: string | null
}

function parseArgs(argv: string[]): Options {
  const index = argv.indexOf('--from-cache')
  if (index !== -1 && argv[index + 1] === undefined) throw new Error('--from-cache needs a folder')
  return { refresh: argv.includes('--refresh'), fromCache: index === -1 ? null : argv[index + 1] }
}

/** Reads one site_data file from the cache, fetching it first unless offline. */
async function getJson(path: string, cacheDir: string, offline: boolean): Promise<unknown> {
  const cacheFile = join(cacheDir, path)
  if (existsSync(cacheFile)) return JSON.parse(await readFile(cacheFile, 'utf-8'))
  if (offline) throw new Error(`${cacheFile} is missing from the cache`)
  const response = await fetch(`${BASE_URL}/${path}`)
  if (!response.ok) throw new Error(`GET ${BASE_URL}/${path} failed: HTTP ${response.status}`)
  const text = await response.text()
  await mkdir(dirname(cacheFile), { recursive: true })
  await writeFile(cacheFile, text)
  await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS))
  return JSON.parse(text)
}

/** Fetches meta.json fresh every run: it decides which cache folder is valid. */
async function fetchMeta(): Promise<SnapshotMeta> {
  const response = await fetch(`${BASE_URL}/meta.json`)
  if (!response.ok) throw new Error(`GET ${BASE_URL}/meta.json failed: HTTP ${response.status}`)
  return trimMeta(RawMetaSchema.parse(await response.json()))
}

async function fetchSnapshot(meta: SnapshotMeta, cacheDir: string, offline: boolean): Promise<Snapshot> {
  const items = RawItemSchema.array().parse(await getJson('items.json', cacheDir, offline))
  const summary = RawChampionSummarySchema.parse(await getJson('champions_summary.json', cacheDir, offline))
  const champions: RawChampion[] = []
  for (const { id } of summary) {
    champions.push(RawChampionSchema.parse(await getJson(`champions/${id}.json`, cacheDir, offline)))
  }
  return buildSnapshot(meta, items, champions)
}

async function readCovered(patchDir: string): Promise<IdLists> {
  const overridesFile = join(patchDir, 'overrides.ts')
  const reviewedFile = join(patchDir, 'reviewed.ts')
  if (!existsSync(overridesFile) || !existsSync(reviewedFile)) return { items: [], champions: [] }
  const overrides = await import(pathToFileURL(overridesFile).href) as { OVERRIDE_ITEMS: Array<{ id: string }>; OVERRIDE_CHAMPIONS: Array<{ id: string }> }
  const { REVIEWED } = await import(pathToFileURL(reviewedFile).href) as { REVIEWED: ReviewedEntry[] }
  return {
    items: [...overrides.OVERRIDE_ITEMS.map((entry) => entry.id), ...REVIEWED.filter((entry) => entry.kind === 'item').map((entry) => entry.id)],
    champions: [...overrides.OVERRIDE_CHAMPIONS.map((entry) => entry.id), ...REVIEWED.filter((entry) => entry.kind === 'champion').map((entry) => entry.id)],
  }
}

function previousStale(previous: string): StaleRef[] {
  const dataset = getPatchDataset(previous)
  const refs = (kind: StaleRef['kind'], stale: Map<string, string>, entries: Array<{ id: string; name: string }>): StaleRef[] =>
    [...stale].map(([id, since]) => ({ kind, id, since, name: entries.find((entry) => entry.id === id)?.name ?? id }))
  return [
    ...refs('item', dataset.stale.items, dataset.handModelled.items),
    ...refs('champion', dataset.stale.champions, dataset.handModelled.champions),
  ]
}

/** Compares the staged generated files with the committed ones, ignoring generator-name header lines. */
async function checkDeterminism(stagedDir: string, patchDir: string): Promise<void> {
  const differing: string[] = []
  for (const name of GENERATED_FILES) {
    const staged = await readFile(join(stagedDir, name), 'utf-8')
    const committed = await readFile(join(patchDir, 'generated', name), 'utf-8')
    if (stripGeneratorHeader(staged) !== stripGeneratorHeader(committed)) differing.push(name)
  }
  if (differing.length > 0) {
    throw new Error(`regenerating from the cache does not reproduce the committed files: ${differing.join(', ')}. `
      + `Diff ${stagedDir} against ${join(patchDir, 'generated')}; nothing was written.`)
  }
}

async function replaceWith(staged: string, target: string): Promise<void> {
  await rm(target, { recursive: true, force: true })
  await mkdir(dirname(target), { recursive: true })
  await rename(staged, target)
}

async function run(options: Options): Promise<void> {
  const meta: SnapshotMeta = options.fromCache === null ? await fetchMeta() : metaFromCacheDir(options.fromCache)
  const known = await listSnapshotMetas(SNAPSHOT_ROOT)
  const plan: RunPlan = planRun(meta, known, options.refresh)
  if (plan.kind === 'up-to-date') {
    console.log(`Patch ${plan.patch} is up to date (wrpocket updated ${meta.updated}); nothing written.`)
    return
  }
  const patchDir = join(PATCHES_DIR, plan.patch)
  if (plan.kind === 'bootstrap' && !existsSync(join(patchDir, 'layer.ts'))) {
    throw new Error(`bootstrapping ${plan.patch} needs an existing root layer at ${join(patchDir, 'layer.ts')}`)
  }
  const cacheDir = options.fromCache ?? join(DATA_ROOT, '.cache', 'wrpocket', `${meta.patch}-${meta.updated.replace(/[^0-9]/g, '')}`)
  if (options.fromCache === null && options.refresh) await rm(cacheDir, { recursive: true, force: true })
  const snapshot = await fetchSnapshot(meta, cacheDir, options.fromCache !== null)

  const provenance: Provenance = { source: 'wiki', patch: plan.patch, verifiedInGame: false }
  const mapped = mapSnapshot(snapshot, provenance)
  const constName = provenanceName(plan.patch)

  await rm(STAGING_DIR, { recursive: true, force: true })
  const staged = { snapshot: join(STAGING_DIR, 'snapshot'), generated: join(STAGING_DIR, 'generated'), reports: join(STAGING_DIR, 'reports') }
  await writeSnapshot(staged.snapshot, snapshot)
  await mkdir(staged.generated, { recursive: true })
  await mkdir(staged.reports, { recursive: true })
  await writeFile(join(staged.generated, 'items.ts'), renderModule('GENERATED_ITEMS', 'Item', mapped.items, snapshot.meta, constName))
  await writeFile(join(staged.generated, 'champions.ts'), renderModule('GENERATED_CHAMPIONS', 'Champion', mapped.champions, snapshot.meta, constName))
  const subjects = [...new Set(mapped.notes.map((note) => note.subject))]
  await writeFile(join(staged.generated, 'IMPORT_REPORT.md'), renderReport(snapshot.meta,
    subjects.map((subject) => ({ subject, notes: mapped.notes.filter((note) => note.subject === subject).map((note) => note.note) })), [
      `${mapped.champions.length} champions, ${mapped.items.length} items imported`,
      `${mapped.notes.length} notes below (conflicts, guesses, skipped values)`,
      'Generated items have no modeled effects (passives); only hand-modelled items do.',
      'castTime is 0 for every ability (not in the source).',
    ]))

  const previous = plan.kind === 'bootstrap' ? null : plan.previous
  let needsReview = 0
  if (previous !== null) {
    const before = await readSnapshot(join(SNAPSHOT_ROOT, previous))
    const dataset = getPatchDataset(previous)
    const diff = buildPatchDiff({
      before, after: snapshot,
      handModelled: { items: dataset.handModelled.items.map((item) => item.id), champions: dataset.handModelled.champions.map((champion) => champion.id) },
      previousStale: previousStale(previous),
      covered: await readCovered(patchDir),
      goldens: goldenRefs(loadGoldenCases(GOLDEN_DIR)),
      notesBefore: mapSnapshot(before, provenance).notes,
      notesAfter: mapped.notes,
    })
    needsReview = diff.needsReview.length
    await writeFile(join(staged.generated, 'changed-ids.ts'), renderChangedIds(changedIdsOf(diffSnapshots(before, snapshot)), plan.patch))
    await writeFile(join(staged.reports, 'patch-diff.json'), stableStringify(diff))
    await writeFile(join(staged.reports, 'PATCH_DIFF.md'), renderPatchDiff(diff))
  }
  if (options.fromCache !== null && existsSync(join(patchDir, 'generated'))) {
    await checkDeterminism(staged.generated, patchDir)
  }

  // Every stage succeeded: move the staged output into place.
  await replaceWith(staged.snapshot, join(SNAPSHOT_ROOT, plan.patch))
  await replaceWith(staged.generated, join(patchDir, 'generated'))
  if (previous !== null) {
    await rename(join(staged.reports, 'patch-diff.json'), join(patchDir, 'patch-diff.json'))
    await rename(join(staged.reports, 'PATCH_DIFF.md'), join(patchDir, 'PATCH_DIFF.md'))
    const created = await writeMissingFiles(patchDir, scaffoldFiles(plan.patch))
    if (created.length > 0) console.log(`Created ${created.join(', ')} in ${patchDir}`)
  }
  const ids = (await listSnapshotMetas(SNAPSHOT_ROOT)).map((entry) => entry.patch)
  await writeFile(join(PATCHES_DIR, 'layers.ts'), renderLayersModule(ids))
  await rm(STAGING_DIR, { recursive: true, force: true })

  console.log(`${plan.kind} ${plan.patch}: ${mapped.champions.length} champions, ${mapped.items.length} items, ${mapped.notes.length} mapper notes.`)
  if (previous !== null) console.log(`Diff against ${previous}: ${needsReview} hand-modelled entries need review. See ${join(patchDir, 'PATCH_DIFF.md')}`)
}

run(parseArgs(process.argv.slice(2))).catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
```

Note: `changedIdsOf(diffSnapshots(before, snapshot))` repeats the diff `buildPatchDiff` already ran. That's acceptable at this size, and it keeps `PatchDiff` free of a redundant field.

- [ ] **Step 2: Swap the package script and delete the old importer**

In `packages/data/package.json`, replace `"import:wrpocket": "tsx scripts/import-wrpocket.ts"` with `"patch:update": "tsx scripts/patch-update.ts"`. Then:

```bash
git rm packages/data/scripts/import-wrpocket.ts
```

- [ ] **Step 3: Typecheck and run the full suite**

Run: `pnpm typecheck` and `pnpm -r test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/data
git commit -m "feat: patch:update CLI replaces import:wrpocket"
```

---

### Task 8: Bootstrap the 7.3 snapshot

**Files:**
- Create (by the run): `packages/data/snapshots/wrpocket/7.3/{meta,items,champions}.json`
- Modify (by the run): `packages/data/src/patches/7.3/generated/*` (header lines only), `packages/data/src/patches/layers.ts` (must be unchanged)

- [ ] **Step 1: Run the bootstrap from the local cache**

Run: `pnpm --filter @wr-calc/data patch:update --from-cache .cache/wrpocket/7.3-20260923101927`
(The path is relative to `packages/data`, which is where pnpm runs the script.)

Expected: `bootstrap 7.3: 142 champions, 171 items, 171 mapper notes.`

If the determinism check fails, **stop and report to the user** with the diff (`diff -r packages/data/.cache/patch-update-staging/generated packages/data/src/patches/7.3/generated`). Don't change 7.3's committed files to make it pass. The likely cause is a mapper change after the 2026-09-23 import, and the user decides whether 7.3 regenerates.

- [ ] **Step 2: Check what changed**

Run: `git status --short && git diff --stat`
Expected: the new `snapshots/wrpocket/7.3/` folder, and in `src/patches/7.3/generated/` only the generator header lines. `layers.ts` is unchanged. Run `git diff packages/data/src/patches/7.3/generated | grep '^[-+][^-+]'` and confirm every changed line is a header line. Run `du -sh packages/data/snapshots/wrpocket/7.3` and note the size (the spec estimates 1–2 MB).

- [ ] **Step 3: Full suite**

Run: `pnpm -r test` and `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/data/snapshots packages/data/src/patches
git commit -m "chore: 7.3 wrpocket snapshot bootstrapped from the 2026-09-23 cache"
```

---

### Task 9: The 7.3a run

**Files:**
- Create (by the run): `packages/data/snapshots/wrpocket/7.3a/`, `packages/data/src/patches/7.3a/{generated/*, overrides.ts, reviewed.ts, provenance.ts, layer.ts, PATCH_DIFF.md, patch-diff.json}`
- Modify (by the run): `packages/data/src/patches/layers.ts`
- Test: `packages/data/test/patch-consistency.test.ts`

- [ ] **Step 1: Write the consistency test (fails until 7.3a exists)**

`packages/data/test/patch-consistency.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { getPatchDataset, PATCH_IDS } from '../src/patches/registry'
import { PATCH_LAYERS } from '../src/patches/layers'

const PATCHES_DIR = new URL('../src/patches', import.meta.url).pathname

interface ReportedRef { kind: 'item' | 'champion'; id: string }
interface ReportFile { needsReview: ReportedRef[]; carriedStale: ReportedRef[] }

const key = (ref: ReportedRef): string => `${ref.kind} ${ref.id}`

describe.each(PATCH_IDS.slice(1))('patch %s', (patch) => {
  it('has a patch-diff.json report', () => {
    expect(existsSync(`${PATCHES_DIR}/${patch}/patch-diff.json`)).toBe(true)
  })

  // Overrides and reviews written after the run can only shrink the stale set; never grow it.
  it("dataset staleness matches the report's needs-review and carried entries", () => {
    const report = JSON.parse(readFileSync(`${PATCHES_DIR}/${patch}/patch-diff.json`, 'utf-8')) as ReportFile
    const dataset = getPatchDataset(patch)
    const stale = [
      ...[...dataset.stale.items.keys()].map((id) => `item ${id}`),
      ...[...dataset.stale.champions.keys()].map((id) => `champion ${id}`),
    ].sort()
    const layer = PATCH_LAYERS.find((candidate) => candidate.id === patch)
    if (layer === undefined) throw new Error(`no layer for ${patch}`)
    const covered = new Set([
      ...layer.overrideItems.map((entry) => `item ${entry.id}`),
      ...layer.overrideChampions.map((entry) => `champion ${entry.id}`),
      ...layer.reviewed.map((entry) => `${entry.kind} ${entry.id}`),
    ])
    const reported = [...report.needsReview, ...report.carriedStale].map(key)
    expect(stale).toEqual(reported.filter((entry) => !covered.has(entry)).sort())
  })
})
```

Run: `pnpm --filter @wr-calc/data exec vitest run test/patch-consistency.test.ts`
Expected: no tests run yet (only 7.3 is registered), so it passes trivially. It starts biting after Step 2.

- [ ] **Step 2: Run against live wrpocket**

Run: `pnpm --filter @wr-calc/data patch:update`
Expected: `new-patch 7.3a: … Diff against 7.3: N hand-modelled entries need review.` If wrpocket has moved past 7.3a (e.g. 7.3b), **stop and tell the user** before continuing: the run would create that patch instead.

- [ ] **Step 3: Inspect the output**

- `cat packages/data/src/patches/7.3a/PATCH_DIFF.md | head -120`: the Needs review section reads sensibly (field names, number pairs, goldens).
- `cat packages/data/src/patches/layers.ts`: lists 7.3 then 7.3a.
- `du -sh packages/data/snapshots/wrpocket/7.3a`.
- `git diff --stat`: nothing under `src/patches/7.3/` changed.

- [ ] **Step 4: Full suite**

Run: `pnpm -r test` and `pnpm typecheck`
Expected: PASS. The goldens still run against 7.3; the consistency test now covers 7.3a.

- [ ] **Step 5: Commit**

```bash
git add packages/data
git commit -m "feat: patch 7.3a from wrpocket (2026-09-29 data) with PATCH_DIFF report"
```

---

### Task 10: The web app follows the current patch

**Files:**
- Modify: `apps/web/src/lib/dataset.ts`, `apps/web/src/components/debug-page.tsx:16,43`, `apps/web/src/components/build-editor.tsx:72`
- Modify: every `apps/web/test/*.test.ts` that imports `PATCH_7_3_DATASET` (`run-debug`, `debug-state`, `url-state`, and any others `grep` finds)
- Test: `apps/web/test/dataset.test.ts`

**Interfaces:**
- Consumes: `CURRENT_PATCH`, `getPatchDataset` (Task 5)
- Produces: `datasetFor(patch: string): DebugDataset`, `CURRENT_DATASET: DebugDataset`

- [ ] **Step 1: Write the failing test**

`apps/web/test/dataset.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { CURRENT_PATCH, getPatchDataset } from '@wr-calc/data'
import { CURRENT_DATASET, datasetFor } from '../src/lib/dataset'

describe('web datasets', () => {
  it('CURRENT_DATASET is the current patch', () => {
    expect([...CURRENT_DATASET.catalog.items.keys()]).toEqual(getPatchDataset(CURRENT_PATCH).items.map((item) => item.id))
  })

  it('datasetFor builds the champion map and keeps targets', () => {
    const dataset = datasetFor('7.3')
    expect(dataset.champions.has('jinx')).toBe(true)
    expect(dataset.targets.map((preset) => preset.id)).toEqual(['squishy', 'bruiser', 'tank'])
  })
})
```

Run: `pnpm --filter @wr-calc/web test`. Expected: FAIL (no `CURRENT_DATASET` export).

- [ ] **Step 2: Implement**

`apps/web/src/lib/dataset.ts`:

```ts
import { CURRENT_PATCH, buildChampionMap, getPatchDataset } from '@wr-calc/data'
import type { DebugDataset } from './debug-state'

/** A patch's data in the shape the debug page consumes. */
export function datasetFor(patch: string): DebugDataset {
  const dataset = getPatchDataset(patch)
  return { champions: buildChampionMap(dataset.champions), catalog: dataset.catalog, targets: dataset.targets }
}

/** The newest imported patch: what the debug page shows. */
export const CURRENT_DATASET: DebugDataset = datasetFor(CURRENT_PATCH)
```

In `debug-page.tsx`:
- import `CURRENT_DATASET` instead of `PATCH_7_3_DATASET`, and `CURRENT_PATCH` from `@wr-calc/data`
- set `const dataset = CURRENT_DATASET`
- change the heading to `<h1>wr-calc debug (patch {CURRENT_PATCH})</h1>`

In `build-editor.tsx:72`, change `Runes: no runes in 7.3 data yet` to `Runes: no runes in the patch data yet`.

In each web test that imports `PATCH_7_3_DATASET`: import `datasetFor` instead and set `const dataset = datasetFor('7.3')` (or inline `datasetFor('7.3')` where the constant was used directly, as in `debug-state.test.ts`). These tests assert engine numbers taken from 7.3 data, so pinning them to 7.3 keeps them meaning the same thing. In `debug-state.test.ts`, rename `describe('PATCH_7_3_DATASET', …)` to `describe("datasetFor('7.3')", …)`.

Run `grep -rn "PATCH_7_3_DATASET" apps/web` afterwards. Expected: no matches.

- [ ] **Step 3: Run the tests and the static build**

Run: `pnpm --filter @wr-calc/web test`, `pnpm typecheck`, `pnpm --filter @wr-calc/web build`
Expected: PASS, and the build succeeds (proves the registry is browser-safe in a real bundle).

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat: debug page follows the current patch; tests pin 7.3"
```

---

### Task 11: Docs and final verification

**Files:**
- Create: `docs/decisions/2026-10-01-patch-overlay-and-snapshots.md`
- Modify: `README.md`, `packages/data/golden/README.md`

- [ ] **Step 1: Write the ADR**

`docs/decisions/2026-10-01-patch-overlay-and-snapshots.md` (match the existing ADRs' layout: read `docs/decisions/2026-10-01-item-batch5-hits-and-merged-attacks.md` first and use the same headings). Content to cover, in plain sentences:
- **Context:** wrpocket moved to 7.3a; the importer was hard-wired to 7.3; hand-modelled entries copied from wrpocket had no way to notice source changes; step 3 needs two patches loadable side by side.
- **Decision:** overlay patch folders (`generated/` regenerated, hand-modelled entries inherited, `overrides.ts` / `reviewed.ts` per patch); `layers.ts` generated from the committed snapshots, oldest first; `CURRENT_PATCH` is the newest; changed inherited entries get `staleSince` and `verifiedInGame: false` instead of blocking; inherited exclusive groups drop removed ids; goldens run against the patch they were recorded on; trimmed, stable snapshots committed per patch; outputs staged then moved.
- **Consequences:** a patch folder stays small; staleness is visible in data and in `PATCH_DIFF.md`; a mid-patch wrpocket update regenerates in place; the CN preview (step 4) can be another layer.

- [ ] **Step 2: Update the READMEs**

In `README.md`:
- in the `packages/data` bullet, replace `patch 7.3 data (all champions and items generated from wrpocket.app via \`pnpm --filter @wr-calc/data import:wrpocket\`, …` with `per-patch data (7.3, 7.3a; champions and items generated from wrpocket.app via \`pnpm --filter @wr-calc/data patch:update\`, …`, keeping the rest of the bullet
- add this section after "Development":

```markdown
### Updating to a new patch

`pnpm --filter @wr-calc/data patch:update` checks wrpocket's current patch and:

- **new patch:** writes `packages/data/snapshots/wrpocket/<patch>/` (trimmed source data),
  `packages/data/src/patches/<patch>/` (regenerated `generated/`, stub `overrides.ts` and
  `reviewed.ts`, `PATCH_DIFF.md`, `patch-diff.json`) and makes it the current patch;
- **same patch, newer data:** regenerates that patch in place;
- **nothing new:** writes nothing. `--refresh` re-downloads and regenerates anyway.

Hand-modelled entries are inherited from the previous patch. If wrpocket changed one, it is listed
under "Needs review" in `PATCH_DIFF.md` and marked `staleSince` in the data. Clear it by writing an
override in the patch's `overrides.ts` (values changed) or adding it to `reviewed.ts` with a note
(nothing we model changed). Nothing is written if any stage fails.
```

In `packages/data/golden/README.md`, add after the first paragraph: `Each case runs against the patch in its \`patch\` field, so importing a newer patch never changes what an existing case checks.`

- [ ] **Step 3: Full verification**

Run: `pnpm -r test`, `pnpm typecheck`, `pnpm --filter @wr-calc/web build`, `pnpm --filter @wr-calc/data patch:update` (expected: `Patch 7.3a is up to date …; nothing written.`), then `git status --short` (expected: clean apart from the docs).

- [ ] **Step 4: Commit**

```bash
git add docs README.md packages/data/golden/README.md
git commit -m "docs: ADR and README for the patch-update pipeline"
```

- [ ] **Step 5: Report to the user**

Summarise from `packages/data/src/patches/7.3a/PATCH_DIFF.md`:
- the Needs review list (id, what changed, goldens affected)
- counts of changed generated entries
- added and removed entries
- the snapshot sizes

Say plainly that no overrides were written and that this list is the input for a 7.3a practice-tool test sheet.
