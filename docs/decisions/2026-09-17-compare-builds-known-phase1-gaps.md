# ADR: `compareBuilds` known Phase 1 gaps

**Status:** Accepted

## Context

Step 5 (`docs/superpowers/plans/2026-09-17-phase1-step5-analysis.md`) implements the analysis layer
on top of Steps 2-4's engine. Its design notes made several deliberate scope cuts, recorded here as
the durable reference — same pattern as
`docs/decisions/2026-09-11-simulate-combo-known-phase1-gaps.md` for Step 4.

## Decision — the following are accepted Phase 1 gaps

1. **`goldEfficiency(item)` is not implemented in Step 5.** The spec requires it to derive stat gold
   values from basic items in the real data, but `packages/data` is still an empty stub (Step 6,
   "real data skeletons", hasn't run). It isn't a dependency of `compareBuilds`'s output (`gold`
   there is cumulative item cost, not efficiency), so nothing in Step 5 needed it. Pick up in Step 6.
2. **`compareBuilds` never emits a partial "next-item components" breakpoint.** The spec allows one
   optionally; v1 produces exactly one breakpoint per *completed* item and nothing for an
   in-progress purchase. Revisit if a build-planning UI needs to preview a partially-afforded item.
3. **`boots`/`enchant` are treated as already owned at every breakpoint**, not staged incrementally
   like `build.items`. Their cost is added once, at the first breakpoint. This means the very first
   plotted breakpoint's `gold` already includes boots/enchant cost even though, narratively, a
   player might buy their first component before boots. Acceptable for a first pass; revisit if the
   crossover chart needs to model purchase order across item types.
4. **`compareBuilds` does not surface `sustainedDps`'s own `simulateCombo` call's envelope
   entries** (`dataWarnings`/`unsupportedEffects`/`unverifiedRules`) — only the `burst` call's
   envelope is unioned in per breakpoint. In practice this rarely loses information: `dps` and
   `burst` run the same attacker equipment through the same effect registry, so `sustainedDps`'s
   call would mostly duplicate what the burst call already reports. The one real gap: an effect kind
   that only triggers via an ability in `scenario.priority` and never appears in
   `scenario.burstSequence` could go unreported. Revisit if that scenario shape becomes common.
5. **`ttk` reflects only `scenario.burstSequence`, not whether `sustainedDps`'s priority rotation
   would eventually kill.** A build that only kills through sustained cooldown-respecting play (not
   within the fixed burst sequence) reports `ttk: undefined` for that breakpoint. Callers (a future
   debug page or UI) should treat `undefined` as "not modeled by this scenario," not "unkillable."

## Consequences

- None of the above block Step 5 from producing a working `compareBuilds` crossover series; each is
  either genuinely out of scope for Phase 1 (gap 1) or a documented, bounded simplification (gaps
  2-5).
- Future steps should update this file, not the (by then historical) Step 5 plan document.
