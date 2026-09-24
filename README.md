# wr-calc

A pnpm/TypeScript monorepo for a League of Legends build damage calculator. Currently at the schema and rules stage with no runnable app yet.

## Project Structure

- `packages/schema`: Zod schemas defining the data contract for game entities (champions, items, effects)
- `packages/calc`: Calculation engine, currently includes game-mechanics constants and rules in `rules.ts`
- `packages/data`: patch 7.3 data (all champions and items generated from wrpocket.app via `pnpm --filter @wr-calc/data import:wrpocket`, plus hand-modeled starter items; everything unverified until checked in-game), `buildCatalog`, and the golden test runner (Node-only loader at `@wr-calc/data/golden-loader`)

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

## Environment Variables

None required at this stage.
