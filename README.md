# wr-calc

A pnpm/TypeScript monorepo for a Wild Rift site: CN-server win rates, patch changes and a build damage
calculator. It has a pure calculation engine, real patch data, and a statically exported Next.js site.

## Project Structure

- `packages/schema`: Zod schemas defining the data contract (champions, items, runes, effects, builds, targets)
- `packages/calc`: the calculation engine: `resolveStats`, `simulateCombo`, `compareBuilds`, sustained DPS, effective HP, and game rules in `rules.ts`
- `packages/data`: per-patch data (7.3, 7.3a; champions and items generated from wrpocket.app via `pnpm --filter @wr-calc/data patch:update`, plus hand-modelled items and champions; unverified until checked in-game), CN-server win rates (`CN_STATS`, refreshed with `pnpm --filter @wr-calc/data cn-stats:update`), `buildCatalog`, the golden test runner (Node-only loader at `@wr-calc/data/golden-loader`) and a Node-only loader for the site's build-time files (`@wr-calc/data/site-loader`)
- `apps/web`: the Next.js site (static export): home, CN tier list, champion, item and patch pages, the calculator (currently the engine's debug view) and `/debug`

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
- **Run the site**: `pnpm --filter @wr-calc/web dev`, then open http://localhost:3000. The calculator's state lives in the URL, so a link reproduces the exact setup.
- **Build the site**: `pnpm --filter @wr-calc/web build` (static export to `apps/web/out/`, one folder per page)
- **Refresh CN win rates**: `pnpm --filter @wr-calc/data cn-stats:update` (also a manual GitHub workflow)

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

The run also fetches the official patch notes
(`https://wildrift.leagueoflegends.com/en-us/news/game-updates/wild-rift-patch-notes-<id>/`, or
`--notes-url <url>`), commits them parsed under `packages/data/snapshots/official-notes/<patch>.json`
and cross-checks them against the wrpocket diff:

- a flagged entry the notes don't mention is auto-cleared as a wrpocket-only change
  (`generated/notes-review.ts`);
- a hand-modelled entry the notes change but wrpocket didn't is flagged;
- `PATCH_DIFF.md`'s "Official notes cross-check" section shows, for each notes entry, whether
  wrpocket's data already has the new numbers.

If the notes page doesn't exist yet (HTTP 404), the import runs without it and nothing is auto-cleared.
A `--from-cache` run uses the cached page or the committed notes snapshot, and fetches only with
`--notes-url`. Notes published after an import are picked up by re-running with `--refresh`, or with
`--from-cache <dir> --notes-url <url>`.

`--from-cache <dir>` reads the raw responses from a local cache folder named
`<patch>-<YYYYMMDDhhmmss>` instead of the network; it was used to bootstrap 7.3. When that patch's
generated files already exist, it checks that regenerating reproduces them.

## Environment Variables

None required at this stage.
