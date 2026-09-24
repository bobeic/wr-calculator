# Golden test cases

Real, in-game-verified combat scenarios that `packages/data/test/golden.test.ts` checks the
engine against. Empty today (see `docs/superpowers/specs/2026-09-17-phase1-step6-real-data-golden-runner-design.md`)
— `loadGoldenCases` (Node-only, imported from `@wr-calc/data/golden-loader`, not the root entry) returns `[]` for an empty directory, so the runner test file runs zero
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

Before you record a case, check the items involved. Many items in
`packages/data/src/patches/7.3/items.ts` are still skeletons — their stat and effect magnitudes
are `null`, which the engine resolves to `0`. If `scenario.build.items` includes one of these,
the engine will under-count damage compared to what you measured in the practice tool. Fill in
that item's real values first, then record the case — otherwise the case will fail (or pass for
the wrong reason).

Run just this package's tests with `pnpm --filter @wr-calc/data test`.
