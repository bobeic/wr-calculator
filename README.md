# wr-calc

A pnpm/TypeScript monorepo for a Wild Rift build damage calculator: a pure calculation engine,
real patch data, and a bare debug page for exercising the engine end to end.

## Project Structure

- `packages/schema`: Zod schemas defining the data contract (champions, items, runes, effects, builds, targets)
- `packages/calc`: the calculation engine: `resolveStats`, `simulateCombo`, `compareBuilds`, sustained DPS, effective HP, and game rules in `rules.ts`
- `packages/data`: per-patch data (7.3, 7.3a; champions and items generated from wrpocket.app via `pnpm --filter @wr-calc/data patch:update`, plus hand-modeled starter items; everything unverified until checked in-game), `buildCatalog`, and the golden test runner (Node-only loader at `@wr-calc/data/golden-loader`)
- `apps/web`: Next.js debug page (static export) that runs the engine in the browser

## Getting Started

### Prerequisites

- Node.js 18+ with pnpm

### Installation

```bash
corepack enable
corepack prepare pnpm@latest --activate
pnpm install
```

### Development

- **Type check**: `pnpm typecheck`
- **Run tests**: `pnpm test`
- **Test a single package**: `pnpm --filter @wr-calc/schema test`
- **Run the debug page**: `pnpm --filter @wr-calc/web dev`, then open http://localhost:3000. All state lives in the URL, so a link reproduces the exact setup.
- **Build the debug page**: `pnpm --filter @wr-calc/web build` (static export to `apps/web/out/`)

No environment variables are required.

### Updating to a new patch

`pnpm --filter @wr-calc/data patch:update` checks wrpocket's current patch and:

- **new patch:** writes `packages/data/snapshots/wrpocket/<patch>/` (trimmed source data),
  `packages/data/src/patches/<patch>/` (regenerated `generated/`, stub `overrides.ts` and
  `reviewed.ts`, `provenance.ts` and `layer.ts`, `PATCH_DIFF.md`, `patch-diff.json`) and makes it the
  current patch;
- **same patch, newer data:** regenerates that patch in place;
- **nothing new:** writes nothing. `--refresh` re-downloads and regenerates anyway.

Hand-modelled entries are inherited from the previous patch. If wrpocket changed one, it is listed
under "Needs review" in `PATCH_DIFF.md` and marked `staleSince` in the data. Clear it by writing an
override in the patch's `overrides.ts` (values changed) or adding it to `reviewed.ts` with a note
(nothing we model changed). Nothing is written if any stage fails.

`--from-cache <dir>` reads the raw responses from a local cache folder named
`<patch>-<YYYYMMDDhhmmss>` instead of the network; it was used to bootstrap 7.3. When that patch's
generated files already exist, it checks that regenerating reproduces them.

## Environment Variables

None required at this stage.
