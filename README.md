# wr-calc

A pnpm/TypeScript monorepo for a Wild Rift build damage calculator: a pure calculation engine,
real patch data, and a bare debug page for exercising the engine end to end.

## Project Structure

- `packages/schema`: Zod schemas defining the data contract (champions, items, runes, effects, builds, targets)
- `packages/calc`: the calculation engine: `resolveStats`, `simulateCombo`, `compareBuilds`, sustained DPS, effective HP, and game rules in `rules.ts`
- `packages/data`: patch 7.3 data (all champions and items generated from wrpocket.app via `pnpm --filter @wr-calc/data import:wrpocket`, plus hand-modeled starter items; everything unverified until checked in-game), `buildCatalog`, and the golden test runner (Node-only loader at `@wr-calc/data/golden-loader`)
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

## Environment Variables

None required at this stage.
