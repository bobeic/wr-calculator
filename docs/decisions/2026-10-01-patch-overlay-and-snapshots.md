# ADR: Patch overlay folders and committed wrpocket snapshots

**Status:** Accepted

## Context

wrpocket moved to patch 7.3a while the importer was hard-wired to 7.3. Hand-modelled entries that
were copied from wrpocket data had no way to notice when the source changed. The next step needs two
patches loadable side by side, so a single global dataset no longer fits.

## Decision

1. **Overlay patch folders.** Each patch has its own folder. `generated/` is regenerated from the
   snapshot; hand-modelled entries are inherited from the previous patch; `overrides.ts` and
   `reviewed.ts` are per patch and never overwritten by the pipeline.
2. **Layers.** `layers.ts` is generated from the committed snapshots, oldest first. `CURRENT_PATCH`
   is the newest layer.
3. **Stale, not blocking.** An inherited entry that wrpocket changed gets `staleSince` and
   `verifiedInGame: false` and is listed under "Needs review" in `PATCH_DIFF.md`. Inherited
   exclusive groups drop ids that were removed.
4. **Goldens.** Each golden case runs against the patch it was recorded on.
5. **Snapshots.** Trimmed, stable (sorted keys, 2-space indentation, trailing newline) snapshots of
   the wrpocket source data are committed per patch.
6. **Reproducible generation.** Generated files are mapped from the snapshot as read back from disk,
   so they reproduce exactly from the committed snapshot. Because of this, 7.3's generated
   `items.ts` was re-committed once with its stat keys in sorted (snapshot) order; the user approved
   it and every value is identical. The `IMPORT_REPORT` summary text was kept unchanged so 7.3
   reproduces.
7. **Staged outputs.** Outputs are staged and then moved into place. The snapshot moves last,
   because it is the marker that decides "up to date"; a failed run therefore leaves the repo
   re-runnable. Parse failures name the URL or cache file.

## Consequences

- A patch folder stays small.
- Staleness is visible in the data and in `PATCH_DIFF.md`.
- A mid-patch wrpocket update regenerates that patch in place.
- The CN preview (step 4) can be another layer.
