# Phase 1 Step 7: Debug Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One unstyled Next.js debug page (`apps/web`) that drives the whole engine against the real patch 7.3 data, keeps its full state in the URL, and prominently lists every value still to be entered.

**Architecture:** A client-only Next.js App Router page with static export. All logic lives in pure modules under `apps/web/src/lib/`, each unit-tested with Vitest. `run-debug.ts` is the only module that calls `@wr-calc/calc`. React components only render. `packages/data` gains target presets and a `buildChampionMap` helper.

**Tech Stack:** Next.js 16 (App Router, `output: 'export'`), React 19, zod 3, Vitest 1.6 (existing), TypeScript 5.9 (existing), pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-24-phase1-step7-debug-page-design.md`

## Global Constraints

- Work on branch `feat/tvanmook/phase1-step7-debug-page/20260924`, created from `docs/tvanmook/phase1-step7-design/20260918`. Never commit to `main`.
- Commit prefixes: `feat:`, `fix:`, `test:`, `docs:`, `chore:`.
- Versions: `next@^16.3.6`, `react@^19.3.0`, `react-dom@^19.3.0`, `@types/react@^19.3.0`, `@types/react-dom@^19.3.0`, `zod@^3.23.0` (same range as the other packages). Do **not** bump the repo's `typescript` (5.9) or `vitest` (1.6).
- No styling or design work beyond one inline `display: flex` for side-by-side A/B panels.
- No enchant field or picker anywhere (`HAS_SEPARATE_ENCHANT_SLOT` is `false`).
- No new environment variables. Never touch `.env*`.
- TypeScript strict everywhere. A one-sentence docstring on every exported function.
- `@wr-calc/data` is imported only from its root entry (never `@wr-calc/data/golden-loader`) in `apps/web`, because the page runs in the browser.
- The engine reads a missing effect input as `0`/`false`, not as its declared `default`. Build inputs passed to the engine must always go through `resolveInputs`.
- Never weaken a test to make it pass. Run the full suite (`pnpm test` and `pnpm typecheck` from the repo root) before marking any task done.

## File Map

| File | Responsibility |
|---|---|
| `packages/data/src/patches/7.3/targets.ts` | `TargetPreset` type + `PATCH_7_3_TARGETS` (squishy/bruiser/tank placeholders) |
| `packages/data/src/champion-map.ts` | `buildChampionMap` |
| `apps/web/package.json`, `next.config.mjs`, `tsconfig.json`, `vitest.config.ts` | app wiring |
| `apps/web/src/app/layout.tsx`, `src/app/page.tsx` | Next shell; page wraps the client component in `<Suspense>` |
| `apps/web/src/lib/debug-state.ts` | `DebugState`/`DebugBuild`/`DebugTarget`/`DebugDataset` types, `CRIT_MODES`, `emptyBuild`, `defaultState` |
| `apps/web/src/lib/dataset.ts` | `PATCH_7_3_DATASET` |
| `apps/web/src/lib/parse-combo.ts` | `parseCombo`, `parsePriority` |
| `apps/web/src/lib/url-state.ts` | `encodeState`, `decodeState` |
| `apps/web/src/lib/collect-inputs.ts` | `collectInputs`, `inputValue`, `resolveInputs` |
| `apps/web/src/lib/null-report.ts` | `nullReport` |
| `apps/web/src/lib/run-debug.ts` | `runDebug`, `toBuild`, `Stage`, `DebugResult` |
| `apps/web/src/components/debug-page.tsx` | client page: state ⇄ URL, renders panels |
| `apps/web/src/components/build-editor.tsx` | one build's items/boots/runes/effect inputs |
| `apps/web/src/components/target-editor.tsx` | preset / custom dummy / champion target |
| `apps/web/src/components/result-panels.tsx` | nulls, stat sheets, combos, compare, warnings |

---

### Task 1: Target presets and `buildChampionMap` in `packages/data`

**Files:**
- Create: `packages/data/src/patches/7.3/targets.ts`
- Create: `packages/data/src/champion-map.ts`
- Modify: `packages/data/src/patches/7.3/index.ts` (add export)
- Modify: `packages/data/src/index.ts` (add export)
- Modify: `packages/data/test/golden.test.ts:8`, `packages/data/test/golden-runner.test.ts:10` (use the helper)
- Test: `packages/data/test/targets.test.ts`, `packages/data/test/champion-map.test.ts`

**Interfaces:**
- Consumes: `Provenance`, `Target`, `TargetDummySchema`, `Champion` from `@wr-calc/schema`; `PATCH_7_3_PROVENANCE` from `./provenance`.
- Produces:
  - `interface TargetPreset { id: string; name: string; provenance: Provenance; target: Extract<Target, { kind: 'dummy' }> }`
  - `const PATCH_7_3_TARGETS: TargetPreset[]` with ids `squishy`, `bruiser`, `tank` in that order
  - `function buildChampionMap(champions: Champion[]): Map<string, Champion>`
  - All three are exported from `@wr-calc/data`'s root entry.

- [ ] **Step 1: Create the feature branch**

```bash
git switch docs/tvanmook/phase1-step7-design/20260918
git switch -c feat/tvanmook/phase1-step7-debug-page/20260924
```

- [ ] **Step 2: Write the failing tests**

`packages/data/test/targets.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { TargetDummySchema } from '@wr-calc/schema'
import { PATCH_7_3_TARGETS } from '../src'

describe('PATCH_7_3_TARGETS', () => {
  it('has the squishy, bruiser and tank presets in that order', () => {
    expect(PATCH_7_3_TARGETS.map((preset) => preset.id)).toEqual(['squishy', 'bruiser', 'tank'])
  })

  it('every preset target parses against TargetDummySchema', () => {
    for (const preset of PATCH_7_3_TARGETS) {
      expect(() => TargetDummySchema.parse(preset.target), preset.id).not.toThrow()
    }
  })

  it('every preset is marked unverified for patch 7.3', () => {
    for (const preset of PATCH_7_3_TARGETS) {
      expect(preset.provenance, preset.id).toEqual({
        source: 'manual', patch: '7.3', verifiedInGame: false,
      })
    }
  })

  it('presets get tankier in order', () => {
    const [squishy, bruiser, tank] = PATCH_7_3_TARGETS.map((preset) => preset.target)
    expect(squishy.hp).toBeLessThan(bruiser.hp)
    expect(bruiser.hp).toBeLessThan(tank.hp)
    expect(squishy.armor).toBeLessThan(tank.armor)
    expect(squishy.mr).toBeLessThan(tank.mr)
  })
})
```

`packages/data/test/champion-map.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildChampionMap, PATCH_7_3_CHAMPIONS } from '../src'

describe('buildChampionMap', () => {
  it('indexes champions by id', () => {
    expect(buildChampionMap(PATCH_7_3_CHAMPIONS).get('jinx')?.name).toBe('Jinx')
  })

  it('has one entry per patch 7.3 champion (ids are unique)', () => {
    expect(buildChampionMap(PATCH_7_3_CHAMPIONS).size).toBe(PATCH_7_3_CHAMPIONS.length)
  })

  it('returns an empty map for no champions', () => {
    expect(buildChampionMap([]).size).toBe(0)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @wr-calc/data test`
Expected: FAIL. `targets.test.ts` and `champion-map.test.ts` fail because `PATCH_7_3_TARGETS` / `buildChampionMap` are not exported.

- [ ] **Step 4: Implement**

`packages/data/src/patches/7.3/targets.ts`:

```ts
import type { Provenance, Target } from '@wr-calc/schema'
import { PATCH_7_3_PROVENANCE } from './provenance'

export interface TargetPreset {
  id: string
  name: string
  provenance: Provenance
  target: Extract<Target, { kind: 'dummy' }>
}

// Placeholder hp/armor/mr: rough guesses, to be replaced during the in-game data-entry pass.
export const PATCH_7_3_TARGETS: TargetPreset[] = [
  {
    id: 'squishy', name: 'Squishy', provenance: PATCH_7_3_PROVENANCE,
    target: { kind: 'dummy', hp: 1800, armor: 60, mr: 45 },
  },
  {
    id: 'bruiser', name: 'Bruiser', provenance: PATCH_7_3_PROVENANCE,
    target: { kind: 'dummy', hp: 3000, armor: 110, mr: 70 },
  },
  {
    id: 'tank', name: 'Tank', provenance: PATCH_7_3_PROVENANCE,
    target: { kind: 'dummy', hp: 4200, armor: 180, mr: 110 },
  },
]
```

`packages/data/src/champion-map.ts`:

```ts
import type { Champion } from '@wr-calc/schema'

/** Indexes champions by id (last one wins on a duplicate id, like buildCatalog). */
export function buildChampionMap(champions: Champion[]): Map<string, Champion> {
  return new Map(champions.map((champion) => [champion.id, champion]))
}
```

`packages/data/src/patches/7.3/index.ts`: add `export * from './targets'` after `export * from './provenance'`.

`packages/data/src/index.ts`: add `export * from './champion-map'` after `export * from './catalog'`.

- [ ] **Step 5: Replace the duplicated champion maps in the golden tests**

In both `packages/data/test/golden.test.ts` and `packages/data/test/golden-runner.test.ts`, replace

```ts
const champions = new Map(PATCH_7_3_CHAMPIONS.map((champion) => [champion.id, champion]))
```

with

```ts
const champions = buildChampionMap(PATCH_7_3_CHAMPIONS)
```

and add `import { buildChampionMap } from '../src/champion-map'` next to the other `../src/...` imports.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter @wr-calc/data test`
Expected: PASS, including the existing `browser-safe-entry.test.ts` (no new `node:` imports).

Run: `pnpm test && pnpm typecheck` from the repo root.
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add packages/data
git commit -m "feat: add patch 7.3 target presets and buildChampionMap helper"
```

---

### Task 2: Scaffold `apps/web` with debug state and dataset

**Files:**
- Create: `apps/web/package.json`, `apps/web/next.config.mjs`, `apps/web/tsconfig.json`, `apps/web/vitest.config.ts`
- Create: `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx` (placeholder, replaced in Task 8)
- Create: `apps/web/src/lib/debug-state.ts`, `apps/web/src/lib/dataset.ts`
- Modify: root `package.json` (`typecheck` script), root `.gitignore`
- Test: `apps/web/test/debug-state.test.ts`

**Interfaces:**
- Consumes: `PATCH_7_3_TARGETS`, `TargetPreset`, `buildChampionMap`, `PATCH_7_3_CHAMPIONS`, `PATCH_7_3_CATALOG` from `@wr-calc/data`; `MAX_CHAMPION_LEVEL`, `StatCatalog` from `@wr-calc/calc`; `Champion` from `@wr-calc/schema`.
- Produces (in `src/lib/debug-state.ts`):
  - `interface DebugBuild { items: string[]; boots?: string; runes: string[]; inputs: Record<string, number | boolean> }`
  - `type DebugTarget = { kind: 'preset'; presetId: string } | { kind: 'dummy'; hp: number; armor: number; mr: number } | { kind: 'champion'; championId: string; level: number; build: DebugBuild }`
  - `type CritMode = 'expected' | 'always' | 'never'` and `const CRIT_MODES: readonly CritMode[]`
  - `interface DebugState { championId: string; level: number; buildA: DebugBuild; buildB: DebugBuild; target: DebugTarget; combo: string; priority: string; durationSeconds: number; critMode: CritMode }`
  - `interface DebugDataset { champions: Map<string, Champion>; catalog: StatCatalog; targets: TargetPreset[] }`
  - `function emptyBuild(): DebugBuild`
  - `function defaultState(dataset: DebugDataset): DebugState`
- Produces (in `src/lib/dataset.ts`): `const PATCH_7_3_DATASET: DebugDataset`

- [ ] **Step 1: Create the app wiring**

`apps/web/package.json`:

```json
{
  "name": "@wr-calc/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "typecheck": "next typegen && tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@wr-calc/calc": "workspace:*",
    "@wr-calc/data": "workspace:*",
    "@wr-calc/schema": "workspace:*",
    "next": "^16.3.6",
    "react": "^19.3.0",
    "react-dom": "^19.3.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^26.6.1",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0"
  }
}
```

`apps/web/next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // The workspace packages ship TypeScript source (package.json "main" points at src/*.ts).
  transpilePackages: ['@wr-calc/calc', '@wr-calc/data', '@wr-calc/schema'],
}

export default nextConfig
```

`apps/web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,
    "incremental": true,
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", "test/**/*.ts", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`apps/web/vitest.config.ts`:

```ts
import { sharedConfig } from '../../vitest.config.shared'

export default sharedConfig
```

The root `vitest.workspace.ts` already globs `apps/*`, so it needs no edit.

Root `package.json`: change the `typecheck` script to

```json
"typecheck": "tsc -b && tsc -p packages/data/tsconfig.scripts.json && pnpm --filter @wr-calc/web typecheck",
```

Root `.gitignore`: append

```
next-env.d.ts
out/
```

Run: `pnpm install`
Expected: installs next/react. If pnpm reports ignored build scripts (e.g. for `sharp`), that's fine. Don't add them to `allowBuilds` unless `next build` later fails because of it; if it does, report it.

- [ ] **Step 2: Create the Next shell**

`apps/web/src/app/layout.tsx`:

```tsx
import type { ReactNode } from 'react'

export const metadata = { title: 'wr-calc debug' }

/** Minimal root layout: no styling, the debug page is intentionally bare. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

`apps/web/src/app/page.tsx` (placeholder until Task 8):

```tsx
/** Placeholder until the debug page component lands. */
export default function Page() {
  return <main><h1>wr-calc debug</h1></main>
}
```

- [ ] **Step 3: Write the failing test**

`apps/web/test/debug-state.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildCatalog } from '@wr-calc/data'
import { defaultState, emptyBuild } from '../src/lib/debug-state'
import { PATCH_7_3_DATASET } from '../src/lib/dataset'

describe('defaultState', () => {
  it('uses the first champion at max level, empty builds and the first preset', () => {
    expect(defaultState(PATCH_7_3_DATASET)).toEqual({
      championId: 'aatrox',
      level: 15,
      buildA: { items: [], runes: [], inputs: {} },
      buildB: { items: [], runes: [], inputs: {} },
      target: { kind: 'preset', presetId: 'squishy' },
      combo: 'AA',
      priority: 'Q W E R',
      durationSeconds: 10,
      critMode: 'expected',
    })
  })

  it('throws on a dataset with no champions or no presets', () => {
    const empty = { champions: new Map(), catalog: buildCatalog([]), targets: [] }
    expect(() => defaultState(empty)).toThrow(/at least one champion and one target preset/)
  })
})

describe('emptyBuild', () => {
  it('returns a fresh object each call', () => {
    const first = emptyBuild()
    first.items.push('long-sword')
    expect(emptyBuild().items).toEqual([])
  })
})

describe('PATCH_7_3_DATASET', () => {
  it('wires the real patch 7.3 champions, items and presets', () => {
    expect(PATCH_7_3_DATASET.champions.has('jinx')).toBe(true)
    expect(PATCH_7_3_DATASET.catalog.items.has('trinity-force')).toBe(true)
    expect(PATCH_7_3_DATASET.targets.map((preset) => preset.id)).toEqual(['squishy', 'bruiser', 'tank'])
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm --filter @wr-calc/web test`
Expected: FAIL. The `../src/lib/debug-state` and `../src/lib/dataset` modules don't exist yet.

- [ ] **Step 5: Implement**

`apps/web/src/lib/debug-state.ts`:

```ts
import type { Champion } from '@wr-calc/schema'
import type { StatCatalog } from '@wr-calc/calc'
import { MAX_CHAMPION_LEVEL } from '@wr-calc/calc'
import type { TargetPreset } from '@wr-calc/data'

export interface DebugBuild {
  items: string[]
  boots?: string
  runes: string[]
  inputs: Record<string, number | boolean>
}

export type DebugTarget =
  | { kind: 'preset'; presetId: string }
  | { kind: 'dummy'; hp: number; armor: number; mr: number }
  | { kind: 'champion'; championId: string; level: number; build: DebugBuild }

export type CritMode = 'expected' | 'always' | 'never'
export const CRIT_MODES: readonly CritMode[] = ['expected', 'always', 'never']

export interface DebugState {
  championId: string
  level: number
  buildA: DebugBuild
  buildB: DebugBuild
  target: DebugTarget
  combo: string
  priority: string
  durationSeconds: number
  critMode: CritMode
}

export interface DebugDataset {
  champions: Map<string, Champion>
  catalog: StatCatalog
  targets: TargetPreset[]
}

/** Returns a new build with no items, boots, runes or inputs. */
export function emptyBuild(): DebugBuild {
  return { items: [], runes: [], inputs: {} }
}

/** Returns the state an empty URL decodes to. */
export function defaultState(dataset: DebugDataset): DebugState {
  const championId: string | undefined = [...dataset.champions.keys()][0]
  const presetId: string | undefined = dataset.targets[0]?.id
  if (championId === undefined || presetId === undefined) {
    throw new Error('defaultState: dataset needs at least one champion and one target preset')
  }
  return {
    championId,
    level: MAX_CHAMPION_LEVEL,
    buildA: emptyBuild(),
    buildB: emptyBuild(),
    target: { kind: 'preset', presetId },
    combo: 'AA',
    priority: 'Q W E R',
    durationSeconds: 10,
    critMode: 'expected',
  }
}
```

`apps/web/src/lib/dataset.ts`:

```ts
import {
  PATCH_7_3_CATALOG, PATCH_7_3_CHAMPIONS, PATCH_7_3_TARGETS, buildChampionMap,
} from '@wr-calc/data'
import type { DebugDataset } from './debug-state'

export const PATCH_7_3_DATASET: DebugDataset = {
  champions: buildChampionMap(PATCH_7_3_CHAMPIONS),
  catalog: PATCH_7_3_CATALOG,
  targets: PATCH_7_3_TARGETS,
}
```

- [ ] **Step 6: Run the tests, typecheck and build**

Run: `pnpm --filter @wr-calc/web test`
Expected: PASS.

Run: `pnpm typecheck` from the repo root.
Expected: PASS. `next typegen` generates `next-env.d.ts` (gitignored), then `tsc --noEmit` passes. **If `next typegen` is not a recognized command** in the installed Next version, change the script to `"typecheck": "tsc --noEmit"`, commit a `next-env.d.ts` containing exactly `/// <reference types="next" />` and `/// <reference types="next/image-types/global" />`, remove `next-env.d.ts` from `.gitignore`, and note the change in the task report.

Run: `pnpm --filter @wr-calc/web build`
Expected: PASS, producing `apps/web/out/index.html`. Next may rewrite `apps/web/tsconfig.json` on first build (e.g. adding keys it requires). Accept its edits and commit them.

Run: `pnpm test` from the repo root.
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web package.json pnpm-lock.yaml .gitignore
git commit -m "feat: scaffold apps/web debug app with debug state and 7.3 dataset"
```

---

### Task 3: Combo and priority parsing

**Files:**
- Create: `apps/web/src/lib/parse-combo.ts`
- Test: `apps/web/test/parse-combo.test.ts`

**Interfaces:**
- Consumes: `ComboAction`, `AbilityKey` from `@wr-calc/calc` (`AbilityKey` is `'q' | 'w' | 'e' | 'r'`; `ComboAction` is `'AA' | 'Q' | 'W' | 'E' | 'R' | \`item:${string}\` | \`wait:${number}\``).
- Produces:
  - `type ParseError = { ok: false; error: string; tokenIndex: number }`
  - `type ComboParse = { ok: true; actions: ComboAction[] } | ParseError`
  - `type PriorityParse = { ok: true; keys: AbilityKey[] } | ParseError`
  - `function parseCombo(text: string): ComboParse`
  - `function parsePriority(text: string): PriorityParse`

- [ ] **Step 1: Write the failing test**

`apps/web/test/parse-combo.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseCombo, parsePriority } from '../src/lib/parse-combo'

describe('parseCombo', () => {
  it('parses every action form', () => {
    expect(parseCombo('AA Q W E R item:trinity-force wait:0.5')).toEqual({
      ok: true, actions: ['AA', 'Q', 'W', 'E', 'R', 'item:trinity-force', 'wait:0.5'],
    })
  })

  it('is case-insensitive for AA/Q/W/E/R and tolerates extra whitespace', () => {
    expect(parseCombo('  q aa\tR  ')).toEqual({ ok: true, actions: ['Q', 'AA', 'R'] })
  })

  it('accepts any case for the item:/wait: prefixes but keeps the item id verbatim', () => {
    expect(parseCombo('ITEM:Some-Id WAIT:2')).toEqual({ ok: true, actions: ['item:Some-Id', 'wait:2'] })
  })

  it('returns no actions for empty or blank text', () => {
    expect(parseCombo('')).toEqual({ ok: true, actions: [] })
    expect(parseCombo('   ')).toEqual({ ok: true, actions: [] })
  })

  it.each(['wait:', 'wait:-1', 'wait:abc', 'wait:Infinity'])('rejects %s and reports its index', (token) => {
    const result = parseCombo(`AA ${token}`)
    expect(result).toMatchObject({ ok: false, tokenIndex: 1 })
    if (!result.ok) expect(result.error).toContain(token)
  })

  it('rejects item: with no id', () => {
    expect(parseCombo('item:')).toMatchObject({ ok: false, tokenIndex: 0 })
  })

  it('reports the index of an unknown token', () => {
    expect(parseCombo('Q AA XX R')).toEqual({
      ok: false, error: "unknown combo token 'XX'", tokenIndex: 2,
    })
  })
})

describe('parsePriority', () => {
  it('parses Q/W/E/R case-insensitively into lowercase ability keys', () => {
    expect(parsePriority('q E w R')).toEqual({ ok: true, keys: ['q', 'e', 'w', 'r'] })
  })

  it('returns no keys for blank text', () => {
    expect(parsePriority('  ')).toEqual({ ok: true, keys: [] })
  })

  it.each([['Q AA', 1, 'AA'], ['item:x Q', 0, 'item:x']])(
    'rejects non-ability token in %s', (text, tokenIndex, token) => {
      expect(parsePriority(text)).toEqual({
        ok: false, error: `priority accepts only Q W E R, got '${token}'`, tokenIndex,
      })
    },
  )
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @wr-calc/web test parse-combo`
Expected: FAIL. The `../src/lib/parse-combo` module doesn't exist yet.

- [ ] **Step 3: Implement**

`apps/web/src/lib/parse-combo.ts`:

```ts
import type { AbilityKey, ComboAction } from '@wr-calc/calc'

export type ParseError = { ok: false; error: string; tokenIndex: number }
export type ComboParse = { ok: true; actions: ComboAction[] } | ParseError
export type PriorityParse = { ok: true; keys: AbilityKey[] } | ParseError

const SIMPLE_ACTIONS = ['AA', 'Q', 'W', 'E', 'R'] as const
const ABILITY_KEYS: Record<string, AbilityKey | undefined> = { Q: 'q', W: 'w', E: 'e', R: 'r' }

function tokenize(text: string): string[] {
  return text.trim().split(/\s+/).filter((token) => token !== '')
}

/** Parses combo text like "Q AA item:trinity-force wait:0.5 R" into simulateCombo actions. */
export function parseCombo(text: string): ComboParse {
  const actions: ComboAction[] = []
  for (const [tokenIndex, token] of tokenize(text).entries()) {
    const simple = SIMPLE_ACTIONS.find((action) => action === token.toUpperCase())
    if (simple) {
      actions.push(simple)
      continue
    }
    const colon = token.indexOf(':')
    const prefix = colon === -1 ? '' : token.slice(0, colon).toLowerCase()
    const rest = colon === -1 ? '' : token.slice(colon + 1)
    if (prefix === 'item' && rest !== '') {
      actions.push(`item:${rest}`)
      continue
    }
    if (prefix === 'wait') {
      const seconds = Number(rest)
      // Number('') is 0, so an empty value must be rejected explicitly.
      if (rest === '' || !Number.isFinite(seconds) || seconds < 0) {
        return { ok: false, error: `'${token}': wait needs a number of seconds ≥ 0`, tokenIndex }
      }
      actions.push(`wait:${seconds}`)
      continue
    }
    return { ok: false, error: `unknown combo token '${token}'`, tokenIndex }
  }
  return { ok: true, actions }
}

/** Parses ability-priority text like "Q E W R" into lowercase ability keys for compareBuilds. */
export function parsePriority(text: string): PriorityParse {
  const keys: AbilityKey[] = []
  for (const [tokenIndex, token] of tokenize(text).entries()) {
    const key = ABILITY_KEYS[token.toUpperCase()]
    if (!key) return { ok: false, error: `priority accepts only Q W E R, got '${token}'`, tokenIndex }
    keys.push(key)
  }
  return { ok: true, keys }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @wr-calc/web test parse-combo`
Expected: PASS.

Run: `pnpm test && pnpm typecheck` from the repo root.
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/parse-combo.ts apps/web/test/parse-combo.test.ts
git commit -m "feat: parse debug-page combo and priority text"
```

---

### Task 4: URL state encoding and decoding

**Files:**
- Create: `apps/web/src/lib/url-state.ts`
- Test: `apps/web/test/url-state.test.ts`

**Interfaces:**
- Consumes: `DebugState`, `DebugBuild`, `DebugTarget`, `DebugDataset`, `CRIT_MODES`, `defaultState`, `emptyBuild` from `./debug-state`; `MAX_CHAMPION_LEVEL` from `@wr-calc/calc`; `PATCH_7_3_DATASET` (tests only).
- Produces:
  - `interface QueryParams { get(name: string): string | null }`. Both `URLSearchParams` and Next's `ReadonlyURLSearchParams` satisfy it.
  - `function encodeState(state: DebugState): string` returns a query string without a leading `?`.
  - `function decodeState(params: QueryParams, dataset: DebugDataset): { state: DebugState; issues: string[] }` never throws.
- Param names: `champ`, `lvl`, `a`, `b`, `t` (JSON), `combo`, `prio`, `dur`, `crit`.

- [ ] **Step 1: Write the failing test**

`apps/web/test/url-state.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { decodeState, encodeState } from '../src/lib/url-state'
import { defaultState, emptyBuild } from '../src/lib/debug-state'
import type { DebugState, DebugTarget } from '../src/lib/debug-state'
import { PATCH_7_3_DATASET } from '../src/lib/dataset'

const dataset = PATCH_7_3_DATASET

function decode(query: string) {
  return decodeState(new URLSearchParams(query), dataset)
}

const FULL_STATE: DebugState = {
  championId: 'jinx',
  level: 11,
  buildA: {
    items: ['trinity-force', 'heartsteel'], boots: 'plated-steelcaps', runes: [],
    inputs: { 'heartsteel-stacks': 5, 'seraphs-embrace-shield-used': true },
  },
  buildB: { items: ['long-sword'], runes: [], inputs: {} },
  target: { kind: 'champion', championId: 'annie', level: 9, build: { items: ['blasting-wand'], runes: [], inputs: {} } },
  combo: 'Q AA item:trinity-force wait:0.5 R',
  priority: 'Q E W R',
  durationSeconds: 12.5,
  critMode: 'always',
}

describe('encodeState / decodeState', () => {
  it('round-trips a full state with no issues', () => {
    expect(decode(encodeState(FULL_STATE))).toEqual({ state: FULL_STATE, issues: [] })
  })

  it.each<DebugTarget>([
    { kind: 'preset', presetId: 'tank' },
    { kind: 'dummy', hp: 2500, armor: 90, mr: 60 },
  ])('round-trips target %o', (target) => {
    const state = { ...FULL_STATE, target }
    expect(decode(encodeState(state))).toEqual({ state, issues: [] })
  })

  it('decodes an empty query to the default state with no issues', () => {
    expect(decode('')).toEqual({ state: defaultState(dataset), issues: [] })
  })
})

describe('decodeState: malformed params', () => {
  it('resets an out-of-range level and reports it', () => {
    const { state, issues } = decode('lvl=99')
    expect(state.level).toBe(15)
    expect(issues).toEqual(["level: invalid value '99', reset to default"])
  })

  it('resets an empty or non-numeric duration and reports it', () => {
    expect(decode('dur=').issues).toEqual(["duration: invalid value '', reset to default"])
    expect(decode('dur=abc').state.durationSeconds).toBe(10)
  })

  it('resets a malformed build to empty and reports it', () => {
    const { state, issues } = decode('a={bad json')
    expect(state.buildA).toEqual(emptyBuild())
    expect(issues).toEqual(['build A: malformed, reset to empty'])
  })

  it('resets an unknown crit mode and reports it', () => {
    const { state, issues } = decode('crit=sometimes')
    expect(state.critMode).toBe('expected')
    expect(issues).toEqual(["unknown crit mode 'sometimes', reset to default"])
  })

  it('resets a malformed target and reports it', () => {
    const { state, issues } = decode(`t=${encodeURIComponent('{"kind":"champion"}')}`)
    expect(state.target).toEqual(defaultState(dataset).target)
    expect(issues).toEqual(['target: malformed, reset to default'])
  })

  it.each(['a=null', 't=[]', 'b=42', 'lvl=1.5', 'champ=', 'a=%7B%22items%22%3A1%7D'])(
    'never throws on %s', (query) => {
      expect(() => decode(query)).not.toThrow()
      expect(decode(query).issues.length).toBeGreaterThan(0)
    },
  )
})

describe('decodeState: unknown ids', () => {
  it('resets an unknown champion and reports it', () => {
    const { state, issues } = decode('champ=zed')
    expect(state.championId).toBe('aatrox')
    expect(issues).toEqual(["unknown champion 'zed', reset to default"])
  })

  it('drops unknown items, boots and runes from a build, keeping known ones', () => {
    const build = { items: ['long-sword', 'nope'], boots: 'nope-boots', runes: ['r1'], inputs: {} }
    const { state, issues } = decode(`a=${encodeURIComponent(JSON.stringify(build))}`)
    expect(state.buildA).toEqual({ items: ['long-sword'], runes: [], inputs: {} })
    expect(issues).toEqual([
      "build A: unknown item 'nope' dropped",
      "build A: unknown boots 'nope-boots' dropped",
      "build A: unknown rune 'r1' dropped",
    ])
  })

  it('resets an unknown preset target and reports it', () => {
    const target = { kind: 'preset', presetId: 'mega-tank' }
    const { state, issues } = decode(`t=${encodeURIComponent(JSON.stringify(target))}`)
    expect(state.target).toEqual({ kind: 'preset', presetId: 'squishy' })
    expect(issues).toEqual(["target: unknown preset 'mega-tank', reset to default"])
  })

  it('resets a champion target with an unknown champion and reports it', () => {
    const target = { kind: 'champion', championId: 'zed', level: 5, build: emptyBuild() }
    const { issues } = decode(`t=${encodeURIComponent(JSON.stringify(target))}`)
    expect(issues).toEqual(["target: unknown champion 'zed', reset to default"])
  })

  it('sanitizes a champion target build', () => {
    const target = { kind: 'champion', championId: 'annie', level: 5, build: { items: ['nope'], runes: [], inputs: {} } }
    const { state, issues } = decode(`t=${encodeURIComponent(JSON.stringify(target))}`)
    expect(state.target).toEqual({ kind: 'champion', championId: 'annie', level: 5, build: emptyBuild() })
    expect(issues).toEqual(["target build: unknown item 'nope' dropped"])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @wr-calc/web test url-state`
Expected: FAIL. The `../src/lib/url-state` module doesn't exist yet.

- [ ] **Step 3: Implement**

`apps/web/src/lib/url-state.ts`:

```ts
import { z } from 'zod'
import { MAX_CHAMPION_LEVEL } from '@wr-calc/calc'
import type { DebugBuild, DebugDataset, DebugState, DebugTarget } from './debug-state'
import { CRIT_MODES, defaultState, emptyBuild } from './debug-state'

/** Read-only view of query params; URLSearchParams and Next's ReadonlyURLSearchParams both fit. */
export interface QueryParams {
  get(name: string): string | null
}

const BuildParamSchema = z.object({
  items: z.array(z.string()),
  boots: z.string().optional(),
  runes: z.array(z.string()),
  inputs: z.record(z.string(), z.union([z.number(), z.boolean()])),
}).strict()

const TargetParamSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('preset'), presetId: z.string() }).strict(),
  z.object({
    kind: z.literal('dummy'), hp: z.number().positive(), armor: z.number(), mr: z.number(),
  }).strict(),
  z.object({
    kind: z.literal('champion'),
    championId: z.string(),
    level: z.number().int().min(1).max(MAX_CHAMPION_LEVEL),
    build: BuildParamSchema,
  }).strict(),
])

/** Serializes the full debug state into a query string (no leading '?'). */
export function encodeState(state: DebugState): string {
  const params = new URLSearchParams()
  params.set('champ', state.championId)
  params.set('lvl', String(state.level))
  params.set('a', JSON.stringify(state.buildA))
  params.set('b', JSON.stringify(state.buildB))
  params.set('t', JSON.stringify(state.target))
  params.set('combo', state.combo)
  params.set('prio', state.priority)
  params.set('dur', String(state.durationSeconds))
  params.set('crit', state.critMode)
  return params.toString()
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

function decodeNumber(
  raw: string | null, label: string, fallback: number, valid: (value: number) => boolean,
  issues: string[],
): number {
  if (raw === null) return fallback
  const value = Number(raw)
  // Number('') is 0, so a blank value must be rejected explicitly.
  if (raw.trim() === '' || !Number.isFinite(value) || !valid(value)) {
    issues.push(`${label}: invalid value '${raw}', reset to default`)
    return fallback
  }
  return value
}

function sanitizeBuild(
  build: DebugBuild, label: string, dataset: DebugDataset, issues: string[],
): DebugBuild {
  const known = (id: string, kind: 'item' | 'boots' | 'rune'): boolean => {
    const catalog = kind === 'rune' ? dataset.catalog.runes : dataset.catalog.items
    if (catalog.has(id)) return true
    issues.push(`${label}: unknown ${kind} '${id}' dropped`)
    return false
  }
  const items = build.items.filter((id) => known(id, 'item'))
  const sanitized: DebugBuild = { items, runes: [], inputs: build.inputs }
  if (build.boots !== undefined && known(build.boots, 'boots')) sanitized.boots = build.boots
  sanitized.runes = build.runes.filter((id) => known(id, 'rune'))
  return sanitized
}

function decodeBuild(
  raw: string | null, label: string, dataset: DebugDataset, issues: string[],
): DebugBuild {
  if (raw === null) return emptyBuild()
  const parsed = BuildParamSchema.safeParse(parseJson(raw))
  if (!parsed.success) {
    issues.push(`${label}: malformed, reset to empty`)
    return emptyBuild()
  }
  return sanitizeBuild(parsed.data, label, dataset, issues)
}

function decodeTarget(
  raw: string | null, fallback: DebugTarget, dataset: DebugDataset, issues: string[],
): DebugTarget {
  if (raw === null) return fallback
  const parsed = TargetParamSchema.safeParse(parseJson(raw))
  if (!parsed.success) {
    issues.push('target: malformed, reset to default')
    return fallback
  }
  const target = parsed.data
  if (target.kind === 'preset' && !dataset.targets.some((preset) => preset.id === target.presetId)) {
    issues.push(`target: unknown preset '${target.presetId}', reset to default`)
    return fallback
  }
  if (target.kind === 'champion') {
    if (!dataset.champions.has(target.championId)) {
      issues.push(`target: unknown champion '${target.championId}', reset to default`)
      return fallback
    }
    return { ...target, build: sanitizeBuild(target.build, 'target build', dataset, issues) }
  }
  return target
}

/** Decodes query params into a full debug state; never throws, reporting every value it had to reset or drop. */
export function decodeState(
  params: QueryParams, dataset: DebugDataset,
): { state: DebugState; issues: string[] } {
  const defaults = defaultState(dataset)
  const issues: string[] = []

  let championId = defaults.championId
  const champ = params.get('champ')
  if (champ !== null) {
    if (dataset.champions.has(champ)) championId = champ
    else issues.push(`unknown champion '${champ}', reset to default`)
  }

  const level = decodeNumber(
    params.get('lvl'), 'level', defaults.level,
    (value) => Number.isInteger(value) && value >= 1 && value <= MAX_CHAMPION_LEVEL, issues,
  )
  const buildA = decodeBuild(params.get('a'), 'build A', dataset, issues)
  const buildB = decodeBuild(params.get('b'), 'build B', dataset, issues)
  const target = decodeTarget(params.get('t'), defaults.target, dataset, issues)
  const durationSeconds = decodeNumber(
    params.get('dur'), 'duration', defaults.durationSeconds, (value) => value > 0, issues,
  )

  let critMode = defaults.critMode
  const crit = params.get('crit')
  if (crit !== null) {
    const mode = CRIT_MODES.find((candidate) => candidate === crit)
    if (mode) critMode = mode
    else issues.push(`unknown crit mode '${crit}', reset to default`)
  }

  return {
    state: {
      championId, level, buildA, buildB, target,
      combo: params.get('combo') ?? defaults.combo,
      priority: params.get('prio') ?? defaults.priority,
      durationSeconds, critMode,
    },
    issues,
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @wr-calc/web test url-state`
Expected: PASS. If the round-trip test fails only because of key order or an `undefined` `boots` key, fix the implementation, not the test (`toEqual` already ignores `undefined` properties).

Run: `pnpm test && pnpm typecheck` from the repo root.
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/url-state.ts apps/web/test/url-state.test.ts
git commit -m "feat: encode and decode debug-page state in the URL"
```

---

### Task 5: Effect input collection and default resolution

**Files:**
- Create: `apps/web/src/lib/collect-inputs.ts`
- Test: `apps/web/test/collect-inputs.test.ts`

**Interfaces:**
- Consumes: `DebugBuild` from `./debug-state`; `StatCatalog` from `@wr-calc/calc`; `Effect`, `EffectInput` from `@wr-calc/schema`.
- Produces:
  - `function collectInputs(build: DebugBuild, catalog: StatCatalog): EffectInput[]`: purchase order (items, then boots, then runes), deduped by input `id` (first one wins). Unknown ids are skipped.
  - `function inputValue(input: EffectInput, values: Record<string, number | boolean>): number | boolean`
  - `function resolveInputs(build: DebugBuild, catalog: StatCatalog): Record<string, number | boolean>`: every collected input's `default`, overridden by `build.inputs`.
- Real data facts used by the tests: `heartsteel` declares `{ type: 'stackCount', id: 'heartsteel-stacks', min: 0, max: 3000, default: 0 }` then `{ type: 'boolean', id: 'heartsteel-charge-ready', default: false }`. `seraphs-embrace` declares `{ type: 'boolean', id: 'seraphs-embrace-shield-used', default: false }`. `long-sword` and `trinity-force` declare no inputs.

- [ ] **Step 1: Write the failing test**

`apps/web/test/collect-inputs.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { Rune } from '@wr-calc/schema'
import { buildCatalog, PATCH_7_3_CATALOG, PATCH_7_3_ITEMS } from '@wr-calc/data'
import { collectInputs, inputValue, resolveInputs } from '../src/lib/collect-inputs'
import type { DebugBuild } from '../src/lib/debug-state'

const catalog = PATCH_7_3_CATALOG

function build(partial: Partial<DebugBuild>): DebugBuild {
  return { items: [], runes: [], inputs: {}, ...partial }
}

const ids = (b: DebugBuild) => collectInputs(b, catalog).map((input) => input.id)

describe('collectInputs', () => {
  it('returns nothing for items whose effects declare no inputs', () => {
    expect(ids(build({ items: ['long-sword', 'trinity-force'] }))).toEqual([])
  })

  it('keeps purchase order', () => {
    expect(ids(build({ items: ['seraphs-embrace', 'heartsteel'] }))).toEqual([
      'seraphs-embrace-shield-used', 'heartsteel-stacks', 'heartsteel-charge-ready',
    ])
  })

  it('dedupes an input declared by the same item bought twice', () => {
    expect(ids(build({ items: ['heartsteel', 'heartsteel'] }))).toEqual([
      'heartsteel-stacks', 'heartsteel-charge-ready',
    ])
  })

  it('skips unknown ids', () => {
    expect(ids(build({ items: ['nope'], boots: 'nope-boots', runes: ['nope-rune'] }))).toEqual([])
  })

  it('includes boots and rune inputs after items', () => {
    const shieldEffect = PATCH_7_3_CATALOG.items.get('seraphs-embrace')!.effects[1]
    const testRune: Rune = {
      id: 'test-rune', name: 'Test Rune', path: 'test', slot: 'keystone',
      effects: [{
        ...shieldEffect,
        id: 'test-rune-effect',
        inputs: [{ type: 'boolean', id: 'test-rune-toggle', label: 'Test toggle', default: true }],
      }],
    }
    const withRune = buildCatalog(PATCH_7_3_ITEMS, [testRune])
    // Boots aren't tier-validated here, so heartsteel stands in for boots that declare an input.
    const result = collectInputs(
      build({ items: ['seraphs-embrace'], boots: 'heartsteel', runes: ['test-rune'] }), withRune,
    )
    expect(result.map((input) => input.id)).toEqual([
      'seraphs-embrace-shield-used', 'heartsteel-stacks', 'heartsteel-charge-ready', 'test-rune-toggle',
    ])
  })
})

describe('inputValue', () => {
  const [stacks] = collectInputs(build({ items: ['heartsteel'] }), catalog)

  it('falls back to the declared default when unset', () => {
    expect(inputValue(stacks, {})).toBe(0)
  })

  it('returns the set value', () => {
    expect(inputValue(stacks, { 'heartsteel-stacks': 12 })).toBe(12)
  })
})

describe('resolveInputs', () => {
  it('fills every declared default, overridden by set values', () => {
    expect(resolveInputs(build({
      items: ['heartsteel', 'seraphs-embrace'], inputs: { 'heartsteel-stacks': 7 },
    }), catalog)).toEqual({
      'heartsteel-stacks': 7, 'heartsteel-charge-ready': false, 'seraphs-embrace-shield-used': false,
    })
  })

  it('returns an empty record for a build with no inputs', () => {
    expect(resolveInputs(build({ items: ['long-sword'] }), catalog)).toEqual({})
  })
})
```

`seraphs-embrace`'s `effects[1]` is its `shield` effect (`seraphs-embrace-bottomless-well`; `effects[0]` is the `statConversion`). Any valid `Effect` would work, since the test only needs something schema-typed to attach `inputs` to.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @wr-calc/web test collect-inputs`
Expected: FAIL. The `../src/lib/collect-inputs` module doesn't exist yet.

- [ ] **Step 3: Implement**

`apps/web/src/lib/collect-inputs.ts`:

```ts
import type { Effect, EffectInput } from '@wr-calc/schema'
import type { StatCatalog } from '@wr-calc/calc'
import type { DebugBuild } from './debug-state'

function buildEffects(build: DebugBuild, catalog: StatCatalog): Effect[] {
  const itemIds = [...build.items, ...(build.boots !== undefined ? [build.boots] : [])]
  return [
    ...itemIds.flatMap((id) => catalog.items.get(id)?.effects ?? []),
    ...build.runes.flatMap((id) => catalog.runes.get(id)?.effects ?? []),
  ]
}

/** Lists the effect inputs a build's items, boots and runes declare, deduped by input id (first wins). */
export function collectInputs(build: DebugBuild, catalog: StatCatalog): EffectInput[] {
  const byId = new Map<string, EffectInput>()
  for (const effect of buildEffects(build, catalog)) {
    for (const input of effect.inputs ?? []) {
      if (!byId.has(input.id)) byId.set(input.id, input)
    }
  }
  return [...byId.values()]
}

/** Returns an input's current value, or its declared default when unset. */
export function inputValue(
  input: EffectInput, values: Record<string, number | boolean>,
): number | boolean {
  return values[input.id] ?? input.default
}

/** Returns the build's input values with every declared input's default filled in. */
export function resolveInputs(
  build: DebugBuild, catalog: StatCatalog,
): Record<string, number | boolean> {
  // The engine reads a missing input as 0/false rather than its declared default.
  const defaults: Record<string, number | boolean> = {}
  for (const input of collectInputs(build, catalog)) defaults[input.id] = input.default
  return { ...defaults, ...build.inputs }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @wr-calc/web test collect-inputs`
Expected: PASS.

Run: `pnpm test && pnpm typecheck` from the repo root.
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/collect-inputs.ts apps/web/test/collect-inputs.test.ts
git commit -m "feat: collect effect inputs and resolve their defaults for the debug page"
```

---

### Task 6: Null report

**Files:**
- Create: `apps/web/src/lib/null-report.ts`
- Test: `apps/web/test/null-report.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  - `interface NullSource { label: string; value: unknown }`
  - `interface NullEntry { path: string }`
  - `function nullReport(sources: NullSource[]): NullEntry[]`. Paths look like `` `${label} › ${dotted.path[0].key}` ``. A top-level `null` reports just the label. `undefined` is never reported.

- [ ] **Step 1: Write the failing test**

`apps/web/test/null-report.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { PATCH_7_3_CATALOG } from '@wr-calc/data'
import { nullReport } from '../src/lib/null-report'

describe('nullReport', () => {
  it('finds nulls in nested objects and arrays with readable paths', () => {
    const value = { a: null, b: { c: [1, null, { d: null }] }, e: undefined, f: 0, g: '' }
    expect(nullReport([{ label: 'x', value }])).toEqual([
      { path: 'x › a' }, { path: 'x › b.c[1]' }, { path: 'x › b.c[2].d' },
    ])
  })

  it('finds nulls inside a byLevel scalar', () => {
    expect(nullReport([{ label: 'x', value: { amount: { byLevel: [1, null] } } }])).toEqual([
      { path: 'x › amount.byLevel[1]' },
    ])
  })

  it('reports a top-level null as the label alone', () => {
    expect(nullReport([{ label: 'x', value: null }])).toEqual([{ path: 'x' }])
  })

  it('returns nothing for no sources or fully-filled data', () => {
    expect(nullReport([])).toEqual([])
    expect(nullReport([{ label: 'x', value: { a: 1, b: [2] } }])).toEqual([])
  })

  it('reports real patch 7.3 item nulls', () => {
    const seraph = PATCH_7_3_CATALOG.items.get('seraphs-embrace')!
    const paths = nullReport([{ label: 'item seraphs-embrace', value: seraph }]).map((entry) => entry.path)
    expect(paths).toContain('item seraphs-embrace › effects[1].amount')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @wr-calc/web test null-report`
Expected: FAIL. The `../src/lib/null-report` module doesn't exist yet.

- [ ] **Step 3: Implement**

`apps/web/src/lib/null-report.ts`:

```ts
export interface NullSource {
  label: string
  value: unknown
}

export interface NullEntry {
  path: string
}

function walk(value: unknown, path: string, out: string[]): void {
  if (value === null) {
    out.push(path)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((element, index) => walk(element, `${path}[${index}]`, out))
    return
  }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      walk(child, path === '' ? key : `${path}.${key}`, out)
    }
  }
}

/** Lists every null value (a magnitude not yet entered) inside the given data sources. */
export function nullReport(sources: NullSource[]): NullEntry[] {
  return sources.flatMap(({ label, value }) => {
    const paths: string[] = []
    walk(value, '', paths)
    return paths.map((path) => ({ path: path === '' ? label : `${label} › ${path}` }))
  })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @wr-calc/web test null-report`
Expected: PASS.

Run: `pnpm test && pnpm typecheck` from the repo root.
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/null-report.ts apps/web/test/null-report.test.ts
git commit -m "feat: report null data values for the debug page"
```

---

### Task 7: `runDebug`: the engine orchestrator

**Files:**
- Create: `apps/web/src/lib/run-debug.ts`
- Test: `apps/web/test/run-debug.test.ts`

**Interfaces:**
- Consumes:
  - `combatantFromChampion(champion, level, build, catalog): Combatant`. It throws `resolveStats: unknown item id '<id>' in build` on an unknown id.
  - `combatantFromDummy(dummy: { kind: 'dummy'; hp; armor; mr; effects? }): Combatant`
  - `simulateCombo(attacker, target, sequence: ComboAction[], { critMode }): ComboResult`
  - `compareBuilds(a: CompareBuildsSide, b: CompareBuildsSide, target: Combatant, { durationSeconds, priority: AbilityKey[], burstSequence: ComboAction[] }): CompareBuildsResult`. A side is `{ champion, level, build, catalog }`.
  - Types `StatSheet`, `ComboResult`, `CompareBuildsResult`, `UnsupportedEffectEntry`, `UnverifiedRuleId`, `Combatant` from `@wr-calc/calc`. `StatSheet`, `ComboResult` and `CompareBuildsResult` each carry `unsupportedEffects`, `dataWarnings` and `unverifiedRules`.
  - `parseCombo`, `parsePriority` (Task 3); `resolveInputs` (Task 5); `nullReport`, `NullEntry`, `NullSource` (Task 6); `DebugState`, `DebugBuild`, `DebugTarget`, `DebugDataset` (Task 2).
- Produces:
  - `type Stage<T> = { ok: true; value: T } | { ok: false; error: string }`
  - `interface DebugEnvelope { unsupportedEffects: UnsupportedEffectEntry[]; dataWarnings: string[]; unverifiedRules: UnverifiedRuleId[] }`
  - `interface DebugResult { sheetA: Stage<StatSheet>; sheetB: Stage<StatSheet>; comboA: Stage<ComboResult>; comboB: Stage<ComboResult>; compare: Stage<CompareBuildsResult>; envelope: DebugEnvelope; nulls: NullEntry[] }`
  - `function toBuild(build: DebugBuild, dataset: DebugDataset): Build`
  - `function runDebug(state: DebugState, dataset: DebugDataset): DebugResult`
- Dependent-stage error format: `` `${dependencyName} failed: ${dependencyError}` ``. Dependency names are `champion`, `build A`, `build B`, `target`, `combo text` and `priority text`.

- [ ] **Step 1: Write the failing test**

`apps/web/test/run-debug.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { runDebug, toBuild } from '../src/lib/run-debug'
import type { Stage } from '../src/lib/run-debug'
import { defaultState } from '../src/lib/debug-state'
import type { DebugState, DebugTarget } from '../src/lib/debug-state'
import { PATCH_7_3_DATASET } from '../src/lib/dataset'

const dataset = PATCH_7_3_DATASET
const LEGENDARIES = [
  'rabadons-deathcap', 'blade-of-the-ruined-king', 'trinity-force',
  'liandrys-torment', 'void-staff', 'black-cleaver',
]

function state(overrides: Partial<DebugState> = {}): DebugState {
  return {
    ...defaultState(dataset),
    championId: 'jinx',
    buildA: { items: LEGENDARIES, boots: 'plated-steelcaps', runes: [], inputs: {} },
    buildB: { items: ['long-sword'], runes: [], inputs: {} },
    combo: 'Q AA W AA R',
    ...overrides,
  }
}

function ok<T>(stage: Stage<T>): T {
  if (!stage.ok) throw new Error(`expected ok stage, got error: ${stage.error}`)
  return stage.value
}

function error(stage: Stage<unknown>): string {
  if (stage.ok) throw new Error('expected failed stage, got ok')
  return stage.error
}

describe('runDebug with the real 7.3 dataset', () => {
  it('runs a full champion + 6-item build end to end through every stage', () => {
    const result = runDebug(state(), dataset)
    expect(ok(result.sheetA).total.hp).toBeGreaterThan(0)
    expect(ok(result.sheetB).total.ad).toBeGreaterThan(0)
    // Base AD and item AD are real data, so basic attacks deal damage.
    expect(ok(result.comboA).totalsBySource.AA).toBeGreaterThan(0)
    expect(ok(result.comboB).instances.length).toBeGreaterThan(0)
    const compare = ok(result.compare)
    expect(compare.a).toHaveLength(6)
    expect(compare.b).toHaveLength(1)
  })

  it.each<DebugTarget>([
    { kind: 'preset', presetId: 'tank' },
    { kind: 'dummy', hp: 2500, armor: 90, mr: 60 },
    { kind: 'champion', championId: 'annie', level: 9, build: { items: ['blasting-wand'], runes: [], inputs: {} } },
  ])('runs combo and compare against target %o', (target) => {
    const result = runDebug(state({ target }), dataset)
    expect(result.comboA.ok).toBe(true)
    expect(result.comboB.ok).toBe(true)
    expect(result.compare.ok).toBe(true)
  })
})

describe('runDebug stage isolation', () => {
  it('fails combo and compare on bad combo text but still resolves both stat sheets', () => {
    const result = runDebug(state({ combo: 'Q XX' }), dataset)
    expect(error(result.comboA)).toBe("combo text failed: unknown combo token 'XX'")
    expect(error(result.comboB)).toContain('combo text failed')
    expect(error(result.compare)).toContain('combo text failed')
    expect(result.sheetA.ok).toBe(true)
    expect(result.sheetB.ok).toBe(true)
  })

  it('fails only compare on bad priority text', () => {
    const result = runDebug(state({ priority: 'Q AA' }), dataset)
    expect(error(result.compare)).toContain('priority text failed')
    expect(result.comboA.ok).toBe(true)
  })

  it('fails only build A stages on an unknown item that bypassed decodeState', () => {
    const result = runDebug(state({ buildA: { items: ['nope'], runes: [], inputs: {} } }), dataset)
    expect(error(result.sheetA)).toContain("unknown item id 'nope'")
    expect(error(result.comboA)).toContain('build A failed')
    expect(error(result.compare)).toContain('build A failed')
    expect(result.sheetB.ok).toBe(true)
    expect(result.comboB.ok).toBe(true)
  })

  it('fails target-dependent stages on an unknown preset', () => {
    const result = runDebug(state({ target: { kind: 'preset', presetId: 'mega' } }), dataset)
    expect(error(result.comboA)).toBe("target failed: unknown target preset 'mega'")
    expect(result.sheetA.ok).toBe(true)
  })

  it('fails every champion-dependent stage on an unknown champion', () => {
    const result = runDebug(state({ championId: 'zed' }), dataset)
    expect(error(result.sheetA)).toBe("champion failed: unknown champion 'zed'")
    expect(result.compare.ok).toBe(false)
  })
})

describe('runDebug envelope and nulls', () => {
  it('dedupes unsupported effects and data warnings across every call', () => {
    const result = runDebug(state({ buildB: { items: ['liandrys-torment'], runes: [], inputs: {} } }), dataset)
    const liandrys = result.envelope.unsupportedEffects.filter((entry) => entry.id === 'liandrys-torment-dot')
    expect(liandrys).toHaveLength(1)
    expect(result.envelope.dataWarnings.length).toBe(new Set(result.envelope.dataWarnings).size)
    expect(result.envelope.unverifiedRules.length).toBe(new Set(result.envelope.unverifiedRules).size)
  })

  it('reports each null once even when both builds share an item', () => {
    const buildA = { items: ['seraphs-embrace'], runes: [], inputs: {} }
    const buildB = { items: ['seraphs-embrace'], runes: [], inputs: {} }
    const result = runDebug(state({ buildA, buildB }), dataset)
    const paths = result.nulls.map((entry) => entry.path)
    expect(paths.filter((path) => path === 'item seraphs-embrace › effects[1].amount')).toHaveLength(1)
    expect(paths.some((path) => path.startsWith('champion jinx › '))).toBe(true)
  })

  it('includes a champion target and its items in the null report', () => {
    const target: DebugTarget = {
      kind: 'champion', championId: 'annie', level: 9,
      build: { items: ['seraphs-embrace'], runes: [], inputs: {} },
    }
    const paths = runDebug(state({ target }), dataset).nulls.map((entry) => entry.path)
    expect(paths.some((path) => path.startsWith('champion annie › '))).toBe(true)
    expect(paths).toContain('item seraphs-embrace › effects[1].amount')
  })
})

describe('toBuild', () => {
  it('fills declared input defaults so the engine never sees a missing input', () => {
    expect(toBuild({ items: ['heartsteel'], runes: [], inputs: {} }, dataset)).toEqual({
      items: ['heartsteel'], runes: [], inputs: { 'heartsteel-stacks': 0, 'heartsteel-charge-ready': false },
    })
  })

  it('carries boots and never sets enchant', () => {
    const build = toBuild({ items: [], boots: 'plated-steelcaps', runes: [], inputs: {} }, dataset)
    expect(build.boots).toBe('plated-steelcaps')
    expect('enchant' in build).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @wr-calc/web test run-debug`
Expected: FAIL. The `../src/lib/run-debug` module doesn't exist yet.

- [ ] **Step 3: Implement**

`apps/web/src/lib/run-debug.ts`:

```ts
import type { Build, Champion } from '@wr-calc/schema'
import type {
  ComboAction, ComboResult, Combatant, CompareBuildsResult, StatSheet, UnsupportedEffectEntry,
  UnverifiedRuleId, AbilityKey,
} from '@wr-calc/calc'
import { combatantFromChampion, combatantFromDummy, compareBuilds, simulateCombo } from '@wr-calc/calc'
import type { DebugBuild, DebugDataset, DebugState, DebugTarget } from './debug-state'
import { parseCombo, parsePriority } from './parse-combo'
import { resolveInputs } from './collect-inputs'
import { nullReport } from './null-report'
import type { NullEntry, NullSource } from './null-report'

export type Stage<T> = { ok: true; value: T } | { ok: false; error: string }

export interface DebugEnvelope {
  unsupportedEffects: UnsupportedEffectEntry[]
  dataWarnings: string[]
  unverifiedRules: UnverifiedRuleId[]
}

export interface DebugResult {
  sheetA: Stage<StatSheet>
  sheetB: Stage<StatSheet>
  comboA: Stage<ComboResult>
  comboB: Stage<ComboResult>
  compare: Stage<CompareBuildsResult>
  envelope: DebugEnvelope
  nulls: NullEntry[]
}

function attempt<T>(fn: () => T): Stage<T> {
  try {
    return { ok: true, value: fn() }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// Unwraps a dependency inside attempt(); a failed dependency fails the dependent stage by name.
function need<T>(name: string, stage: Stage<T>): T {
  if (!stage.ok) throw new Error(`${name} failed: ${stage.error}`)
  return stage.value
}

function mapStage<T, U>(stage: Stage<T>, fn: (value: T) => U): Stage<U> {
  return stage.ok ? { ok: true, value: fn(stage.value) } : stage
}

/** Converts a debug-page build into an engine Build, filling declared input defaults. */
export function toBuild(build: DebugBuild, dataset: DebugDataset): Build {
  const result: Build = {
    items: build.items, runes: build.runes, inputs: resolveInputs(build, dataset.catalog),
  }
  if (build.boots !== undefined) result.boots = build.boots
  return result
}

function requireChampion(dataset: DebugDataset, id: string): Champion {
  const champion = dataset.champions.get(id)
  if (!champion) throw new Error(`unknown champion '${id}'`)
  return champion
}

function targetCombatant(target: DebugTarget, dataset: DebugDataset): Combatant {
  switch (target.kind) {
    case 'preset': {
      const preset = dataset.targets.find((candidate) => candidate.id === target.presetId)
      if (!preset) throw new Error(`unknown target preset '${target.presetId}'`)
      return combatantFromDummy(preset.target)
    }
    case 'dummy':
      return combatantFromDummy({ kind: 'dummy', hp: target.hp, armor: target.armor, mr: target.mr })
    case 'champion':
      return combatantFromChampion(
        requireChampion(dataset, target.championId), target.level,
        toBuild(target.build, dataset), dataset.catalog,
      )
  }
}

function mergeEnvelopes(sources: DebugEnvelope[]): DebugEnvelope {
  const unsupported = new Map<string, UnsupportedEffectEntry>()
  const warnings = new Set<string>()
  const rules = new Set<UnverifiedRuleId>()
  for (const source of sources) {
    source.unsupportedEffects.forEach((entry) => unsupported.set(entry.id, entry))
    source.dataWarnings.forEach((warning) => warnings.add(warning))
    source.unverifiedRules.forEach((rule) => rules.add(rule))
  }
  return {
    unsupportedEffects: [...unsupported.values()],
    dataWarnings: [...warnings],
    unverifiedRules: [...rules],
  }
}

function nullSources(state: DebugState, dataset: DebugDataset): NullSource[] {
  const championIds = new Set([state.championId])
  const builds = [state.buildA, state.buildB]
  if (state.target.kind === 'champion') {
    championIds.add(state.target.championId)
    builds.push(state.target.build)
  }
  const itemIds = new Set(builds.flatMap((build) => [
    ...build.items, ...(build.boots !== undefined ? [build.boots] : []),
  ]))
  const runeIds = new Set(builds.flatMap((build) => build.runes))

  const sources: NullSource[] = []
  for (const id of championIds) {
    const champion = dataset.champions.get(id)
    if (champion) sources.push({ label: `champion ${id}`, value: champion })
  }
  for (const id of itemIds) {
    const item = dataset.catalog.items.get(id)
    if (item) sources.push({ label: `item ${id}`, value: item })
  }
  for (const id of runeIds) {
    const rune = dataset.catalog.runes.get(id)
    if (rune) sources.push({ label: `rune ${id}`, value: rune })
  }
  return sources
}

/** Runs every engine stage for the debug page, isolating failures so one broken stage never blanks the others. */
export function runDebug(state: DebugState, dataset: DebugDataset): DebugResult {
  const champion = attempt(() => requireChampion(dataset, state.championId))
  const attackerA = attempt(() => combatantFromChampion(
    need('champion', champion), state.level, toBuild(state.buildA, dataset), dataset.catalog,
  ))
  const attackerB = attempt(() => combatantFromChampion(
    need('champion', champion), state.level, toBuild(state.buildB, dataset), dataset.catalog,
  ))
  const target = attempt(() => targetCombatant(state.target, dataset))

  const comboParse = parseCombo(state.combo)
  const combo: Stage<ComboAction[]> = comboParse.ok
    ? { ok: true, value: comboParse.actions } : { ok: false, error: comboParse.error }
  const priorityParse = parsePriority(state.priority)
  const priority: Stage<AbilityKey[]> = priorityParse.ok
    ? { ok: true, value: priorityParse.keys } : { ok: false, error: priorityParse.error }

  const runCombo = (name: string, attacker: Stage<Combatant>) => attempt(() => simulateCombo(
    need(name, attacker), need('target', target), need('combo text', combo),
    { critMode: state.critMode },
  ))
  const comboA = runCombo('build A', attackerA)
  const comboB = runCombo('build B', attackerB)

  const compare = attempt(() => {
    need('build A', attackerA)
    need('build B', attackerB)
    const side = (build: DebugBuild) => ({
      champion: need('champion', champion), level: state.level,
      build: toBuild(build, dataset), catalog: dataset.catalog,
    })
    return compareBuilds(side(state.buildA), side(state.buildB), need('target', target), {
      durationSeconds: state.durationSeconds,
      priority: need('priority text', priority),
      burstSequence: need('combo text', combo),
    })
  })

  const sheetA = mapStage(attackerA, (combatant) => combatant.sheet)
  const sheetB = mapStage(attackerB, (combatant) => combatant.sheet)
  const envelopeSources: DebugEnvelope[] = [
    sheetA, sheetB, mapStage(target, (combatant) => combatant.sheet), comboA, comboB, compare,
  ].flatMap((stage) => (stage.ok ? [stage.value] : []))

  return {
    sheetA, sheetB, comboA, comboB, compare,
    envelope: mergeEnvelopes(envelopeSources),
    nulls: nullReport(nullSources(state, dataset)),
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @wr-calc/web test run-debug`
Expected: PASS.

If `compare.a` doesn't have length 6, check `packages/calc/src/analysis/compare-builds.ts`'s breakpoint logic before changing anything. A probe on 2026-09-24 showed exactly 6 breakpoints for these 6 items plus boots. A different count means the setup differs; it is not a reason to change the assertion.

Run: `pnpm test && pnpm typecheck` from the repo root.
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/run-debug.ts apps/web/test/run-debug.test.ts
git commit -m "feat: add runDebug orchestrator with per-stage failure isolation"
```

---

### Task 8: Debug page UI

**Files:**
- Create: `apps/web/src/components/debug-page.tsx`, `build-editor.tsx`, `target-editor.tsx`, `result-panels.tsx`
- Modify: `apps/web/src/app/page.tsx` (replace the placeholder)

**Interfaces:**
- Consumes: everything in `src/lib/`. `STAT_KEYS` from `@wr-calc/schema`; `MAX_CHAMPION_LEVEL`, `BuildBreakpoint`, `ComboResult`, `CompareBuildsResult`, `StatSheet`, `StatCatalog` from `@wr-calc/calc`.
- Produces: `DebugPage` (client component). No logic beyond wiring; no unit tests (spec §9).

- [ ] **Step 1: Write `result-panels.tsx`**

`apps/web/src/components/result-panels.tsx`:

```tsx
import type { ReactNode } from 'react'
import { STAT_KEYS } from '@wr-calc/schema'
import type { BuildBreakpoint, ComboResult, CompareBuildsResult, StatSheet } from '@wr-calc/calc'
import type { DebugEnvelope, Stage } from '../lib/run-debug'
import type { NullEntry } from '../lib/null-report'

function fmt(value: number | undefined): string {
  return value === undefined ? '—' : value.toFixed(1)
}

function StageView<T>({ stage, children }: { stage: Stage<T>; children: (value: T) => ReactNode }) {
  return stage.ok ? <>{children(stage.value)}</> : <p role="alert">Error: {stage.error}</p>
}

function SideBySide({ a, b }: { a: ReactNode; b: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
      <div><h3>Build A</h3>{a}</div>
      <div><h3>Build B</h3>{b}</div>
    </div>
  )
}

/** Lists every null value in the current selection: the data still to enter. */
export function NullsPanel({ nulls }: { nulls: NullEntry[] }) {
  return (
    <details open>
      <summary>Data still to enter ({nulls.length})</summary>
      <ul>{nulls.map((entry) => <li key={entry.path}>{entry.path}</li>)}</ul>
    </details>
  )
}

function StatSheetTable({ sheet }: { sheet: StatSheet }) {
  const stats = STAT_KEYS.filter((stat) => sheet.total[stat] !== undefined)
  return (
    <table>
      <thead><tr><th>Stat</th><th>Total</th><th>Base</th><th>Bonus</th><th>Breakdown</th></tr></thead>
      <tbody>
        {stats.map((stat) => {
          const contributions = sheet.breakdown.filter((contribution) => contribution.stat === stat)
          return (
            <tr key={stat}>
              <td>{stat}</td>
              <td>{fmt(sheet.total[stat])}</td>
              <td>{fmt(sheet.base[stat])}</td>
              <td>{fmt(sheet.bonus[stat])}</td>
              <td>
                <details>
                  <summary>{contributions.length} contributions</summary>
                  <ul>
                    {contributions.map((contribution, index) => (
                      <li key={index}>
                        {contribution.source.kind} {contribution.source.name} ({contribution.layer}):{' '}
                        {fmt(contribution.amount)}
                        {contribution.dataWarning ? ` ⚠ ${contribution.dataWarning}` : ''}
                      </li>
                    ))}
                  </ul>
                </details>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** Both builds' resolved stat sheets, with a per-stat breakdown. */
export function StatSheetsPanel({ a, b }: { a: Stage<StatSheet>; b: Stage<StatSheet> }) {
  return (
    <section>
      <h2>Stat sheets</h2>
      <SideBySide
        a={<StageView stage={a}>{(sheet) => <StatSheetTable sheet={sheet} />}</StageView>}
        b={<StageView stage={b}>{(sheet) => <StatSheetTable sheet={sheet} />}</StageView>}
      />
    </section>
  )
}

function ComboView({ result }: { result: ComboResult }) {
  return (
    <>
      <p>
        Killed: {result.killed ? 'yes' : 'no'} · TTK: {fmt(result.timeToKill)} · Overkill:{' '}
        {fmt(result.overkill)}
      </p>
      <h4>Totals by type</h4>
      <ul>
        {Object.entries(result.totalsByType).map(([type, total]) => <li key={type}>{type}: {fmt(total)}</li>)}
      </ul>
      <h4>Totals by source</h4>
      <ul>
        {Object.entries(result.totalsBySource).map(([source, total]) => (
          <li key={source}>{source}: {fmt(total)}</li>
        ))}
      </ul>
      <h4>Instance log</h4>
      <table>
        <thead>
          <tr><th>Time</th><th>Source</th><th>Type</th><th>Raw</th><th>Mitigated</th><th>Target HP after</th></tr>
        </thead>
        <tbody>
          {result.instances.map((instance, index) => (
            <tr key={index}>
              <td>{instance.time.toFixed(2)}</td>
              <td>{instance.source.name}</td>
              <td>{instance.type}</td>
              <td>{fmt(instance.raw)}</td>
              <td>{fmt(instance.mitigated)}</td>
              <td>{fmt(instance.targetHpAfter)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

/** Both builds' combo results: totals, kill info, and the damage instance log. */
export function ComboPanel({ a, b }: { a: Stage<ComboResult>; b: Stage<ComboResult> }) {
  return (
    <section>
      <h2>Combo</h2>
      <SideBySide
        a={<StageView stage={a}>{(result) => <ComboView result={result} />}</StageView>}
        b={<StageView stage={b}>{(result) => <ComboView result={result} />}</StageView>}
      />
    </section>
  )
}

function BreakpointTable({ rows }: { rows: BuildBreakpoint[] }) {
  if (rows.length === 0) return <p>No breakpoints (a build with no items produces none).</p>
  return (
    <table>
      <thead>
        <tr><th>Gold</th><th>Burst</th><th>DPS</th><th>TTK</th><th>EHP phys</th><th>EHP magic</th></tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            <td>{row.gold}</td>
            <td>{fmt(row.burst)}</td>
            <td>{fmt(row.dps)}</td>
            <td>{fmt(row.ttk)}</td>
            <td>{fmt(row.ehp.physical)}</td>
            <td>{fmt(row.ehp.magic)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** The compareBuilds breakpoint table for both builds. */
export function ComparePanel({ compare }: { compare: Stage<CompareBuildsResult> }) {
  return (
    <section>
      <h2>compareBuilds</h2>
      <StageView stage={compare}>
        {(result) => <SideBySide a={<BreakpointTable rows={result.a} />} b={<BreakpointTable rows={result.b} />} />}
      </StageView>
    </section>
  )
}

/** Unsupported/partial effects, data warnings and unverified rules from every engine call. */
export function WarningsPanel({ envelope }: { envelope: DebugEnvelope }) {
  return (
    <section>
      <h2>Warnings</h2>
      <h3>Unsupported / partial effects ({envelope.unsupportedEffects.length})</h3>
      <ul>
        {envelope.unsupportedEffects.map((entry) => (
          <li key={entry.id}>
            {entry.id} ({entry.support}){entry.supportNotes ? `: ${entry.supportNotes}` : ''}
          </li>
        ))}
      </ul>
      <h3>Data warnings ({envelope.dataWarnings.length})</h3>
      <ul>{envelope.dataWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
      <h3>Unverified rules ({envelope.unverifiedRules.length})</h3>
      <ul>{envelope.unverifiedRules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
    </section>
  )
}
```

- [ ] **Step 2: Write `build-editor.tsx`**

`apps/web/src/components/build-editor.tsx`:

```tsx
'use client'

import type { StatCatalog } from '@wr-calc/calc'
import type { DebugBuild } from '../lib/debug-state'
import { collectInputs, inputValue } from '../lib/collect-inputs'

interface BuildEditorProps {
  label: string
  build: DebugBuild
  catalog: StatCatalog
  onChange: (build: DebugBuild) => void
}

/** Edits one build: ordered items, boots, runes, and the effect inputs its items declare. */
export function BuildEditor({ label, build, catalog, onChange }: BuildEditorProps) {
  const allItems = [...catalog.items.values()]
  const boots = allItems.filter((item) => item.tier === 'boots')
  const nonBoots = allItems.filter((item) => item.tier !== 'boots')
  const runes = [...catalog.runes.values()]
  const inputs = collectInputs(build, catalog)

  const move = (index: number, delta: number) => {
    const items = [...build.items]
    const [moved] = items.splice(index, 1)
    items.splice(index + delta, 0, moved)
    onChange({ ...build, items })
  }
  const setBoots = (id: string) => {
    const next: DebugBuild = { items: build.items, runes: build.runes, inputs: build.inputs }
    if (id !== '') next.boots = id
    onChange(next)
  }
  const toggleRune = (id: string) => onChange({
    ...build,
    runes: build.runes.includes(id) ? build.runes.filter((rune) => rune !== id) : [...build.runes, id],
  })
  const setInput = (id: string, value: number | boolean) => onChange({
    ...build, inputs: { ...build.inputs, [id]: value },
  })

  return (
    <fieldset>
      <legend>{label}</legend>
      <ol>
        {build.items.map((id, index) => (
          <li key={`${id}-${index}`}>
            {catalog.items.get(id)?.name ?? id}{' '}
            <button type="button" disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
            <button type="button" disabled={index === build.items.length - 1} onClick={() => move(index, 1)}>↓</button>
            <button type="button" onClick={() => onChange({ ...build, items: build.items.filter((_, i) => i !== index) })}>
              remove
            </button>
          </li>
        ))}
      </ol>
      <label>
        Add item{' '}
        <select value="" onChange={(event) => {
          if (event.target.value !== '') onChange({ ...build, items: [...build.items, event.target.value] })
        }}>
          <option value="">—</option>
          {nonBoots.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.cost.total}g)</option>)}
        </select>
      </label>{' '}
      <label>
        Boots{' '}
        <select value={build.boots ?? ''} onChange={(event) => setBoots(event.target.value)}>
          <option value="">none</option>
          {boots.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.cost.total}g)</option>)}
        </select>
      </label>
      {runes.length === 0 ? <p>Runes: no runes in 7.3 data yet</p> : (
        <p>
          Runes:{' '}
          {runes.map((rune) => (
            <label key={rune.id}>
              <input type="checkbox" checked={build.runes.includes(rune.id)} onChange={() => toggleRune(rune.id)} />
              {rune.name}{' '}
            </label>
          ))}
        </p>
      )}
      {inputs.length > 0 && (
        <p>
          Effect inputs:{' '}
          {inputs.map((input) => {
            const value = inputValue(input, build.inputs)
            return input.type === 'stackCount' ? (
              <label key={input.id}>
                {input.label}{' '}
                <input
                  type="number" min={input.min} max={input.max}
                  value={typeof value === 'number' ? value : input.default}
                  onChange={(event) => {
                    const stacks = Number(event.target.value)
                    if (Number.isFinite(stacks)) setInput(input.id, Math.min(input.max, Math.max(input.min, stacks)))
                  }}
                />{' '}
              </label>
            ) : (
              <label key={input.id}>
                <input type="checkbox" checked={value === true} onChange={(event) => setInput(input.id, event.target.checked)} />
                {input.label}{' '}
              </label>
            )
          })}
        </p>
      )}
    </fieldset>
  )
}
```

- [ ] **Step 3: Write `target-editor.tsx`**

`apps/web/src/components/target-editor.tsx`:

```tsx
'use client'

import { MAX_CHAMPION_LEVEL } from '@wr-calc/calc'
import type { DebugDataset, DebugTarget } from '../lib/debug-state'
import { emptyBuild } from '../lib/debug-state'
import { BuildEditor } from './build-editor'

const TARGET_KINDS: readonly DebugTarget['kind'][] = ['preset', 'dummy', 'champion']

function freshTarget(kind: DebugTarget['kind'], dataset: DebugDataset): DebugTarget {
  switch (kind) {
    case 'preset':
      return { kind, presetId: dataset.targets[0]?.id ?? '' }
    case 'dummy':
      return { kind, hp: 2000, armor: 50, mr: 50 }
    case 'champion':
      return { kind, championId: [...dataset.champions.keys()][0] ?? '', level: MAX_CHAMPION_LEVEL, build: emptyBuild() }
  }
}

interface TargetEditorProps {
  target: DebugTarget
  dataset: DebugDataset
  onChange: (target: DebugTarget) => void
}

/** Picks the combat target: a preset dummy, a custom dummy, or a champion with its own build. */
export function TargetEditor({ target, dataset, onChange }: TargetEditorProps) {
  const numberField = (label: string, value: number, apply: (next: number) => void) => (
    <label>
      {label}{' '}
      <input type="number" value={value} onChange={(event) => {
        const next = Number(event.target.value)
        if (Number.isFinite(next)) apply(next)
      }} />{' '}
    </label>
  )

  return (
    <fieldset>
      <legend>Target</legend>
      <label>
        Kind{' '}
        <select value={target.kind} onChange={(event) => {
          const kind = TARGET_KINDS.find((candidate) => candidate === event.target.value)
          if (kind) onChange(freshTarget(kind, dataset))
        }}>
          {TARGET_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
        </select>
      </label>{' '}
      {target.kind === 'preset' && (
        <select value={target.presetId} onChange={(event) => onChange({ kind: 'preset', presetId: event.target.value })}>
          {dataset.targets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}: {preset.target.hp} hp / {preset.target.armor} armor / {preset.target.mr} mr
              {preset.provenance.verifiedInGame ? '' : ' (unverified)'}
            </option>
          ))}
        </select>
      )}
      {target.kind === 'dummy' && (
        <>
          {numberField('HP', target.hp, (hp) => { if (hp > 0) onChange({ ...target, hp }) })}
          {numberField('Armor', target.armor, (armor) => onChange({ ...target, armor }))}
          {numberField('MR', target.mr, (mr) => onChange({ ...target, mr }))}
        </>
      )}
      {target.kind === 'champion' && (
        <>
          <select value={target.championId} onChange={(event) => onChange({ ...target, championId: event.target.value })}>
            {[...dataset.champions.values()].map((champion) => (
              <option key={champion.id} value={champion.id}>{champion.name}</option>
            ))}
          </select>{' '}
          {numberField('Level', target.level, (level) => {
            if (Number.isInteger(level) && level >= 1 && level <= MAX_CHAMPION_LEVEL) onChange({ ...target, level })
          })}
          <BuildEditor
            label="Target build" build={target.build} catalog={dataset.catalog}
            onChange={(build) => onChange({ ...target, build })}
          />
        </>
      )}
    </fieldset>
  )
}
```

- [ ] **Step 4: Write `debug-page.tsx` and replace `page.tsx`**

`apps/web/src/components/debug-page.tsx`:

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MAX_CHAMPION_LEVEL } from '@wr-calc/calc'
import { PATCH_7_3_DATASET } from '../lib/dataset'
import { CRIT_MODES } from '../lib/debug-state'
import type { DebugState } from '../lib/debug-state'
import { decodeState, encodeState } from '../lib/url-state'
import { parseCombo, parsePriority } from '../lib/parse-combo'
import { runDebug } from '../lib/run-debug'
import { BuildEditor } from './build-editor'
import { TargetEditor } from './target-editor'
import { ComboPanel, ComparePanel, NullsPanel, StatSheetsPanel, WarningsPanel } from './result-panels'

const dataset = PATCH_7_3_DATASET

/** The debug page: state is decoded from the URL once, mirrored back on every change, and re-run through the engine. */
export function DebugPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [initial] = useState(() => decodeState(searchParams, dataset))
  const [state, setState] = useState<DebugState>(initial.state)

  useEffect(() => {
    router.replace(`?${encodeState(state)}`, { scroll: false })
  }, [router, state])

  const result = useMemo(() => runDebug(state, dataset), [state])
  const comboParse = parseCombo(state.combo)
  const priorityParse = parsePriority(state.priority)
  const update = (patch: Partial<DebugState>) => setState((current) => ({ ...current, ...patch }))

  return (
    <main>
      <h1>wr-calc debug (patch 7.3)</h1>
      <NullsPanel nulls={result.nulls} />
      {initial.issues.length > 0 && (
        <section>
          <h2>URL issues</h2>
          <ul>{initial.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
        </section>
      )}
      <section>
        <h2>Inputs</h2>
        <label>
          Champion{' '}
          <select value={state.championId} onChange={(event) => update({ championId: event.target.value })}>
            {[...dataset.champions.values()].map((champion) => (
              <option key={champion.id} value={champion.id}>{champion.name}</option>
            ))}
          </select>
        </label>{' '}
        <label>
          Level{' '}
          <input type="number" min={1} max={MAX_CHAMPION_LEVEL} value={state.level} onChange={(event) => {
            const level = Number(event.target.value)
            if (Number.isInteger(level) && level >= 1 && level <= MAX_CHAMPION_LEVEL) update({ level })
          }} />
        </label>
        <BuildEditor label="Build A" build={state.buildA} catalog={dataset.catalog} onChange={(buildA) => update({ buildA })} />
        <BuildEditor label="Build B" build={state.buildB} catalog={dataset.catalog} onChange={(buildB) => update({ buildB })} />
        <TargetEditor target={state.target} dataset={dataset} onChange={(target) => update({ target })} />
        <p>
          <label>Combo <input value={state.combo} onChange={(event) => update({ combo: event.target.value })} /></label>
          {!comboParse.ok && <span role="alert"> {comboParse.error}</span>}
        </p>
        <p>
          <label>Priority <input value={state.priority} onChange={(event) => update({ priority: event.target.value })} /></label>
          {!priorityParse.ok && <span role="alert"> {priorityParse.error}</span>}
        </p>
        <p>
          <label>
            Duration (s){' '}
            <input type="number" min={0.5} step={0.5} value={state.durationSeconds} onChange={(event) => {
              const durationSeconds = Number(event.target.value)
              if (Number.isFinite(durationSeconds) && durationSeconds > 0) update({ durationSeconds })
            }} />
          </label>{' '}
          <label>
            Crit mode{' '}
            <select value={state.critMode} onChange={(event) => {
              const critMode = CRIT_MODES.find((mode) => mode === event.target.value)
              if (critMode) update({ critMode })
            }}>
              {CRIT_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
            </select>
          </label>
        </p>
      </section>
      <StatSheetsPanel a={result.sheetA} b={result.sheetB} />
      <ComboPanel a={result.comboA} b={result.comboB} />
      <ComparePanel compare={result.compare} />
      <WarningsPanel envelope={result.envelope} />
    </main>
  )
}
```

Replace `apps/web/src/app/page.tsx` with:

```tsx
import { Suspense } from 'react'
import { DebugPage } from '../components/debug-page'

/** Static-export entry: useSearchParams inside DebugPage requires a Suspense boundary. */
export default function Page() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <DebugPage />
    </Suspense>
  )
}
```

- [ ] **Step 5: Typecheck, test and build**

Run: `pnpm typecheck && pnpm test` from the repo root.
Expected: all pass.

Run: `pnpm --filter @wr-calc/web build`
Expected: PASS, producing `apps/web/out/index.html`. A build error about `useSearchParams` needing a Suspense boundary means the `page.tsx` step above was skipped.

- [ ] **Step 6: Smoke-check the exported page**

```bash
python3 -m http.server 4173 --directory apps/web/out &
sleep 1
curl -s http://localhost:4173/ | grep -o 'wr-calc debug' | head -1
kill %1
```

Expected: prints `wr-calc debug`. Then report to the controller that the in-browser manual check (below) is still needed. The controller or user does it with `pnpm --filter @wr-calc/web dev` → http://localhost:3000:
1. The page loads with Aatrox, the squishy target and combo `AA`, and shows a non-zero AA total.
2. Adding Heartsteel to Build A shows a "Heartsteel stacks" number input, and the URL updates.
3. Typing `Q XX` in the combo field shows an inline error and "Error: combo text failed…" in the Combo and compareBuilds panels, while the stat sheets still render.
4. Reloading the page restores the same state from the URL.
5. Opening `?champ=zed` shows a "URL issues" section.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src
git commit -m "feat: add debug page UI wired to runDebug"
```

---

### Task 9: README and final verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: nothing.
- Produces: accurate README.

- [ ] **Step 1: Update the README**

Replace lines 3–9 of `README.md` (the intro sentence and the "Project Structure" list) with:

```markdown
A pnpm/TypeScript monorepo for a Wild Rift build damage calculator: a pure calculation engine,
real patch data, and a bare debug page for exercising the engine end to end.

## Project Structure

- `packages/schema`: Zod schemas defining the data contract (champions, items, runes, effects, builds, targets)
- `packages/calc`: the calculation engine: `resolveStats`, `simulateCombo`, `compareBuilds`, sustained DPS, effective HP, and game rules in `rules.ts`
- `packages/data`: patch 7.3 data (all champions and items generated from wrpocket.app via `pnpm --filter @wr-calc/data import:wrpocket`, plus hand-modeled starter items; everything unverified until checked in-game), `buildCatalog`, and the golden test runner (Node-only loader at `@wr-calc/data/golden-loader`)
- `apps/web`: Next.js debug page (static export) that runs the engine in the browser
```

Under the existing `### Development` list, add:

```markdown
- **Run the debug page**: `pnpm --filter @wr-calc/web dev`, then open http://localhost:3000. All state lives in the URL, so a link reproduces the exact setup.
- **Build the debug page**: `pnpm --filter @wr-calc/web build` (static export to `apps/web/out/`)
```

Add a line under the development list: `No environment variables are required.` Leave any existing environment-variable section as-is if it already says that.

- [ ] **Step 2: Full verification**

Run each from the repo root and confirm the result:
- `pnpm test`: all test files pass. This is 307 existing tests plus the new ones, and zero failures.
- `pnpm typecheck`: exit 0.
- `pnpm --filter @wr-calc/web build`: exit 0, `apps/web/out/index.html` exists.
- `git status`: clean apart from the README change (no stray `next-env.d.ts`, `out/` or `.next/` staged).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document the debug page and refresh the project structure in README"
```
