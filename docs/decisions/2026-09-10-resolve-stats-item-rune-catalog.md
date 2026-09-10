# ADR: `resolveStats` takes an explicit item/rune catalog

**Status:** Accepted

## Context

The Phase 1 design doc (`docs/superpowers/specs/2026-09-10-phase1-engine-schema-fixtures-design.md`)
specifies `resolveStats(champion, level, build) → StatSheet` with only three arguments, noting that
`runes` and `inputs` were dropped from an earlier draft signature because `Build` already carries
them.

That fix doesn't address a separate gap: `Build.items` and `Build.runes` are arrays of id strings
(`z.array(z.string())`), not embedded `Item`/`Rune` objects — deliberately, so a `Build` stays cheap
to put in the debug page's URL query string and so items can reference each other by id in
`recipe` without duplicating data. `resolveStats` needs the actual `stats`/`effects` payload behind
each id, which the three-argument signature has no way to supply.

## Decision

`resolveStats` takes a fourth parameter, a catalog:

```ts
resolveStats(
  champion: Champion,
  level: number,
  build: Build,
  catalog: { items: Map<string, Item>, runes: Map<string, Rune> },
) → StatSheet
```

This mirrors the pattern already established in `packages/schema/src/validate/item.ts`
(`validateItemCost(item, allItems: Map<string, Item>)`), rather than inventing a new one.

## Consequences

- Callers (tests, the future debug page, `compareBuilds`) build the catalog once from
  `packages/data` and pass it through; `resolveStats` stays pure and dependency-free with no
  hidden data loading.
- An id in `build.items`/`build.runes` with no matching catalog entry is a caller error, not a
  `resolveStats` concern — surfaced however the plan for that task specifies (see the Step 2
  implementation plan).
