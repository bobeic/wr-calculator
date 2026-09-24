# ADR: `loadGoldenCases` lives behind a Node-only `@wr-calc/data/golden-loader` subpath

**Status:** Accepted

## Context

`@wr-calc/data`'s root entry (`src/index.ts`) re-exported `./golden-runner`, which imported
`node:fs`/`node:path` for `loadGoldenCases`. The Phase 1 Step 7 debug page (`apps/web`) needs the
root entry in the browser (patch data, `buildCatalog`, and possibly `runGoldenCase`), so any
consumer would pull Node builtins into its bundle. Relying on the bundler to tree-shake the unused
import is fragile and bundler-specific.

## Decision

- `loadGoldenCases` and `LoadedGoldenCase` move to `src/golden-loader.ts`, exposed only via the
  `./golden-loader` subpath in `package.json`'s `exports` map.
- `runGoldenCase` stays in `src/golden-runner.ts` and on the root entry — it is pure.
- `test/browser-safe-entry.test.ts` walks the root entry's relative-import graph and fails if any
  `node:` specifier is reachable, so the split can't silently regress.

## Consequences

- Browser consumers import `@wr-calc/data` freely; Node-side tooling that reads golden JSON from
  disk imports `@wr-calc/data/golden-loader`.
- Adding an `exports` map means deep imports like `@wr-calc/data/src/...` are no longer allowed from
  other packages. Nothing used them.
- The import-graph test only follows relative imports inside `src`; a `node:` builtin reached
  through another workspace package (e.g. `@wr-calc/calc`) wouldn't be caught. Neither dependency
  imports one today.
