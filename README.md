# wr-calc

A pnpm/TypeScript monorepo for a League of Legends build damage calculator. Currently at the schema and rules stage with no runnable app yet.

## Project Structure

- `packages/schema`: Zod schemas defining the data contract for game entities (champions, items, effects)
- `packages/calc`: Calculation engine, currently includes game-mechanics constants and rules in `rules.ts`
- `packages/data`: Scaffolded for future data storage and management

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
