# Phase 1 Step 7: Debug Page — Design

Work-order item 7 from `docs/superpowers/specs/2026-09-10-phase1-engine-schema-fixtures-design.md`
("Debug page (apps/web)" section). Steps 1–6 are merged to `main`. `apps/web` does not exist yet,
so this is new code, not a change to existing code, and it follows the full spec → plan → SDD path.

Prerequisite, already done (`866b671`, ADR `docs/decisions/2026-09-24-data-golden-loader-subpath.md`):
`@wr-calc/data`'s root entry no longer reaches `node:fs`, so the browser can import it.

## 1. Purpose

**The page is a companion for verifying data.** The 7.3 data is imported from wrpocket.app and
marked unverified (see `docs/superpowers/specs/2026-09-24-wrpocket-import-design.md`); only a few
values are still `null` (e.g. Seraph's shield, ability passives' cooldowns). The page exercises the
full engine end to end against that data and lists every remaining `null`, so in-game checks can
focus on what matters. No demo or fake dataset is shipped.

The page's ability-driven numbers (per-ability damage, any combo/sustained-DPS figure that casts
`Q`/`W`/`E`/`R`) assume every ability is at max rank: `simulateCombo` resolves `byRank` scalars at
`ability.maxRank`, and there is no per-ability rank input yet — see
`docs/decisions/2026-09-24-byrank-scalar-ability-rank-context.md`.

The page is unstyled, with no design work. The real UI gets its own design pass later.

## 2. Approach

A Next.js App Router app with **one client page** (`'use client'`) and **static export**
(`output: 'export'`). All engine calls run in the browser, so no server is needed. Every piece of
logic lives in framework-free, pure modules under `apps/web/src/lib/`, each unit-tested with
Vitest. React components only render.

Rejected alternatives:
- **Server-rendered GET form.** No client JS, but it reloads on every change, and effect inputs for
  a newly added item appear only after submitting. It also needs a running server.
- **Vite + React.** Lighter, but it deviates from the spec's Next.js, and the real UI will be Next.

## 3. Structure

```
apps/web/                               package @wr-calc/web
  next.config.mjs                       output: 'export'
  package.json                          deps: next, react, react-dom, @wr-calc/{calc,data,schema}
  tsconfig.json                         Next's settings (strict)
  vitest.config.ts                      sharedConfig, like the other packages
  src/app/layout.tsx                    minimal html/body
  src/app/page.tsx                      client page: URL → state → runDebug → panels
  src/lib/debug-state.ts                DebugState type + defaults
  src/lib/url-state.ts                  encodeState / decodeState
  src/lib/parse-combo.ts                combo string → ComboAction[]
  src/lib/collect-inputs.ts             build → EffectInput[] for the auto-generated input form
  src/lib/null-report.ts                selected data → list of null magnitudes
  src/lib/run-debug.ts                  the only module that calls @wr-calc/calc
  src/components/*.tsx                  presentational panels
  test/*.test.ts                        one test file per lib module
packages/data/src/patches/7.3/targets.ts   target presets (see §6)
packages/data/src/champion-map.ts         buildChampionMap helper (see §7)
```

The root `vitest.workspace.ts` (`['packages/*', 'apps/*']`) and `pnpm-workspace.yaml` already
include `apps/*`, so neither needs editing.

## 4. State

```ts
interface DebugBuild {
  items: string[]                        // purchase order
  boots?: string
  runes: string[]
  inputs: Record<string, number | boolean>
}

type DebugTarget =
  | { kind: 'preset'; presetId: string }
  | { kind: 'dummy'; hp: number; armor: number; mr: number }
  | { kind: 'champion'; championId: string; level: number; build: DebugBuild }

interface DebugState {
  championId: string
  level: number
  buildA: DebugBuild
  buildB: DebugBuild
  target: DebugTarget
  combo: string                          // raw text; parsed by parse-combo
  priority: string                       // raw text, e.g. "Q E W R"; parsed to AbilityKey[]
  durationSeconds: number
  critMode: 'expected' | 'always' | 'never'
}
```

- **No enchant field.** `HAS_SEPARATE_ENCHANT_SLOT` is `false`. `Build.enchant` is always omitted
  when converting `DebugBuild` → `Build`.
- The **rune picker** renders, but shows "no runes in 7.3 data yet" while the catalog's rune list
  is empty.
- **Defaults** (empty URL): the first champion in `PATCH_7_3_CHAMPIONS` at max level, both builds
  empty, the `squishy` preset target, combo `"AA"`, priority `"Q W E R"`, 10 s duration, crit mode
  `expected`.

### URL encoding (`url-state.ts`)

- `encodeState(state): string` serializes to a query string. Scalars are plain params (`champ`,
  `lvl`, `combo`, …). Each build and the target is one JSON-encoded param (`a`, `b`, `t`). This
  keeps the encoding simple and lossless; readability of the URL is not a goal.
- `decodeState(params, dataset): { state: DebugState; issues: string[] }` never throws:
  - Each param is parsed and zod-validated independently. A malformed param falls back to its
    default and adds an issue.
  - Ids not in the dataset (champion, item, rune, preset) are dropped and each adds an issue.
- `decodeState(encodeState(s))` must equal `s` for any valid `s`.
- The page writes state with `window.history.replaceState` (no history entry per keystroke).
  Not `router.replace`: Next keys the page segment by its search params, so a router navigation
  remounts the page and discards the on-load URL issues. The URL is only written after the first
  edit (a write during mount runs before Next patches `replaceState` and corrupts its router state),
  so an invalid URL stays in the address bar until then.

## 5. Logic modules

### `parse-combo.ts`

`parseCombo(text): { ok: true; actions: ComboAction[] } | { ok: false; error: string; tokenIndex: number }`

- Splits on whitespace. Tokens are case-insensitive for `AA`/`Q`/`W`/`E`/`R`.
- `item:<id>` keeps the id verbatim. `wait:<n>` requires a finite `n ≥ 0`.
- Empty text → `ok: true` with `[]`.
- `parsePriority(text)` is the same idea, restricted to `Q`/`W`/`E`/`R`. It returns lowercase
  `AbilityKey`s (`'q' | 'w' | 'e' | 'r'`, as `compareBuilds` expects). `ComboAction` keeps the
  uppercase `'Q'` form.

### `collect-inputs.ts`

`collectInputs(build, catalog): EffectInput[]` collects the `inputs` declared on every effect of
the build's items (in purchase order, then boots) and runes, deduped by input `id` (first wins).
The page renders a `stackCount` input as a number field clamped to `[min, max]` and a `boolean`
input as a checkbox, with values stored in `build.inputs`. An input's value falls back to its
declared `default` when it's missing from `build.inputs`.

`resolveInputs(build, catalog)` returns every collected input's declared `default`, overridden by
whatever is in `build.inputs`. **This is required, not cosmetic:** the engine reads a missing input
as `0`/`false` (e.g. `stacking.ts` treats a non-number as 0 stacks), not as the declared default.
`run-debug` therefore always passes `resolveInputs(...)` as `Build.inputs`.

### `null-report.ts`

`nullReport(sources: { label: string; value: unknown }[]): { path: string }[]` walks each source
(assembled by `run-debug` from the selected champion, the deduped items of both builds, and a
champion target's champion and items) and
reports every `null` value found where a magnitude or stat can be (including inside nested
`Scalar`s such as `byLevel` arrays). Paths are human-readable, e.g.
`item blade-of-the-ruined-king › effects[0].pctTargetCurrentHp`. Target presets are not walked:
`TargetDummySchema` doesn't allow `null`, so the page labels presets unverified instead. Fields that are legitimately optional and absent
(`undefined`) are not reported.

### `run-debug.ts`

`runDebug(state, dataset): DebugResult` is the only module that imports engine functions. The
steps, each wrapped separately so one throwing doesn't stop the others:

1. **combatants:** `combatantFromChampion` for A and B, and the target via `combatantFromDummy`
   (preset or custom) or `combatantFromChampion` (champion target).
2. **combos:** `simulateCombo(A, target, actions, { critMode })`, then the same for B. Skipped if
   the combo failed to parse.
3. **compare:** `compareBuilds(sideA, sideB, target, { durationSeconds, priority, burstSequence })`.
   Skipped if the combo or priority failed to parse.
4. **envelope:** merges `unsupportedEffects` (deduped by id), `dataWarnings` (deduped) and
   `unverifiedRules` (deduped) from both stat sheets and every call above.

```ts
type Stage<T> = { ok: true; value: T } | { ok: false; error: string }

interface DebugResult {
  sheetA: Stage<StatSheet>; sheetB: Stage<StatSheet>
  comboA: Stage<ComboResult>; comboB: Stage<ComboResult>
  compare: Stage<CompareBuildsResult>
  envelope: { unsupportedEffects: UnsupportedEffectEntry[]; dataWarnings: string[]; unverifiedRules: UnverifiedRuleId[] }
  nulls: { path: string }[]
}
```

If a stage depends on one that failed, it is `{ ok: false }` with an error naming that upstream
failure, e.g. "combo: fix the combo text first".

`dataset` is `{ champions: Map<string, Champion>; catalog: StatCatalog; targets: TargetPreset[] }`,
built once from `@wr-calc/data`'s root entry.

## 6. Target presets

`packages/data/src/patches/7.3/targets.ts` exports `PATCH_7_3_TARGETS: TargetPreset[]` with
`squishy`, `bruiser` and `tank`:

```ts
interface TargetPreset {
  id: string
  name: string
  provenance: Provenance                 // PATCH_7_3_PROVENANCE: verifiedInGame false
  target: Extract<Target, { kind: 'dummy' }>
}
```

The hp/armor/mr values are rough placeholders, to be replaced during the user's data-entry pass.
The page labels presets as unverified. The original spec said `targets.json`. **Ruling:** use a
`.ts` module like `items.ts` and `champions.ts`, so the patch folder keeps one convention. The
original spec's intent (presets are data, not engine code) is preserved. A data-package test checks
each preset's `target` against `TargetDummySchema`.

## 7. Small data-package additions

- `buildChampionMap(champions: Champion[]): Map<string, Champion>` in
  `packages/data/src/champion-map.ts`, exported from the root entry. It replaces the duplicated
  `new Map(PATCH_7_3_CHAMPIONS.map(...))` in `test/golden.test.ts` and
  `test/golden-runner.test.ts`, and the page uses it. On a duplicate id the last one wins, which
  is exactly `buildCatalog`'s `new Map(...)` behavior Item-id uniqueness is
  already covered by `catalog.test.ts` (map size equals array length). The new `buildChampionMap`
  test adds the same size check for `PATCH_7_3_CHAMPIONS`.
- Export `PATCH_7_3_TARGETS` from `patches/7.3/index.ts`.

## 8. Panels

Panels appear top to bottom, as plain HTML (tables, `<details>`, native inputs):

1. **Data still to enter.** `nulls` with a count, collapsible. Starts open.
2. **URL issues.** `decodeState` issues, shown only when there are any.
3. **Inputs.**
   - Champion and level.
   - Build A and build B, each with: an ordered item list (add from `<select>`, remove,
     move up/down), boots, runes, and the auto-generated effect inputs.
   - Target: preset, custom dummy, or champion (with its own build editor).
   - Combo, priority, duration and crit mode, each with an inline parse error.
4. **Stat sheets.** A and B side by side: total/base/bonus per stat, with a `<details>` per stat
   listing its `breakdown` contributions.
5. **Combo results.** For each of A and B: totals by type and by source, killed / TTK / overkill,
   and an instance log table (time, source, type, raw, mitigated, target HP after).
6. **compareBuilds.** For each side, a table with one row per breakpoint: gold, burst, dps, ttk,
   ehp.
7. **Warnings.** Unsupported/partial effects with `supportNotes`, `dataWarnings`,
   `unverifiedRules`.

A failed stage shows its error message in place of its panel.

## 9. Testing

Vitest, in `apps/web/test/`:

| Module | Covers |
|---|---|
| `url-state` | round-trip; empty URL → defaults; malformed param → default + issue; unknown ids dropped + issue; never throws |
| `parse-combo` | each `ComboAction` form; case and whitespace; bad `wait:` values; bad token reports its index; empty text; `parsePriority` rejects `AA`/`item:` |
| `collect-inputs` | dedupes an input shared across items; skips effects without inputs; purchase order preserved; boots and runes included |
| `null-report` | finds nulls in nested scalars; readable paths; ignores `undefined` optionals |
| `run-debug` | real 7.3 dataset, champion + 6-item builds A/B, each target kind: every stage `ok`; broken combo → combo/compare stages fail and sheets still ok; unknown item id (bypassing `decodeState`) → that sheet fails, the other side still ok; envelope deduped |

The `run-debug` real-data test also closes the Step 6 review's gap that "no end-to-end test runs a
full champion+items build through the actual combat engine".

Data package: a `buildChampionMap` test (including map size = `PATCH_7_3_CHAMPIONS.length`), and `PATCH_7_3_TARGETS` schema conformance.

No React component tests; components contain no logic. Verification: `pnpm test`, `pnpm
typecheck`, `next build` passing, and loading the exported page once in a browser.

## 10. Wiring and docs

- `apps/web` has a `typecheck` script (`tsc --noEmit` with Next's tsconfig). The root `typecheck`
  script becomes `tsc -b && pnpm --filter @wr-calc/web typecheck`. Root `build` is unchanged. The
  web app's `build` script runs `next build`.
- Root `README.md`: how to run the debug page (`pnpm --filter @wr-calc/web dev`), and a corrected
  `packages/data` description (it now holds patch 7.3 skeletons, catalog, target presets, golden
  runner).
- No environment variables.

## 11. Out of scope

Styling and charts; the enchant schema cleanup (`ItemTierSchema` `'enchant'`, `Build.enchant`);
`uniqueGroup`, slot-limit and duplicate-item validation; golden-case changes (patch cross-check,
`GoldenScenarioSchema.target` reuse); deployment.
