# Patch-update pipeline from wrpocket — design

Date: 2026-10-01. Step 1 of the patch-tracking direction (2: official patch-notes cross-check,
3: build impact + cost efficiency, 4: China test server preview, 5: scheduled job and PRs).
Builds on the wrpocket importer (`2026-09-24-wrpocket-import-design.md`).

## 1. Goal and scope

When wrpocket moves to a new patch, one command should:

1. fetch the new data into a new, versioned patch folder,
2. diff it against the previous patch,
3. flag every hand-modelled entry whose source values changed, plus the golden cases that use it.

The first real run is 7.3a: on 2026-10-01 wrpocket's `meta.json` reports `patch: "7.3a"`
(`patch_major: "7.3"`, updated 2026-09-29 16:09:43), while the repo holds 7.3 and
`import-wrpocket.ts` hard-codes `EXPECTED_PATCH = '7.3'`.

Success means:
- a loadable `7.3a` dataset that becomes the app's default,
- 7.3 stays loadable next to it (step 3 compares builds across patches),
- a readable `PATCH_DIFF.md` with a "Needs review" list of hand-modelled entries and affected goldens,
- a machine-readable `patch-diff.json` that steps 2, 3 and 5 can consume.

The pipeline is run by hand. It flags hand-modelled entries; it never rewrites their effects.
Writing 7.3a overrides is a follow-up the user approves, usually after a practice-tool pass.

Out of scope: the patch-notes reader (step 2), build impact and cost efficiency (step 3), the CN
preview channel (step 4), scheduling and PRs (step 5).

## 2. Decisions taken

| Question | Decision |
|---|---|
| How does a new patch folder relate to the previous one? | Overlay: full regenerated `generated/`, hand-modelled entries inherited from the previous patch, per-patch overrides only for entries that changed |
| When does a new patch become current? | Immediately on import. Changed hand-modelled entries are marked stale, not blocking |
| Where does the diff baseline live? | A trimmed, sorted snapshot per patch, committed to git |
| Pipeline shape | One command built from small pure modules, so later steps reuse them |

## 3. Layout

```
packages/data/
  snapshots/wrpocket/<patch>/
    meta.json        patch id, wrpocket `updated` and per-source timestamps
    items.json       trimmed items, sorted by id
    champions.json   trimmed champions, sorted by id
  scripts/
    patch-update.ts  CLI entry (replaces import-wrpocket.ts)
    wrpocket/        existing raw-schemas, map-item, map-champion, render, parse-ability
    patch/           new pure modules: trim, diff, flag, render-diff, scaffold
  src/patches/
    registry.ts      ordered patch ids, CURRENT_PATCH, getPatchDataset(id)
    7.3/             unchanged: generated/ + hand-modelled base (items.ts, champions.ts, ...)
    7.3a/
      generated/     items.ts, champions.ts, changed-ids.ts, IMPORT_REPORT.md (regenerated)
      overrides.ts   hand-modelled items/champions re-written for 7.3a (starts empty)
      reviewed.ts    flagged ids checked and found unaffected, each with a note
      provenance.ts  WRPOCKET_7_3A_PROVENANCE
      PATCH_DIFF.md  human report
      patch-diff.json machine report
      index.ts       builds the 7.3a dataset
```

### Trimmed snapshot

Only the fields the mapper consumes or the diff compares, with sorted keys and 2-space
indentation so git diffs are line-level and stable:

- **Item:** `id`, `name.en`, `description.en`, `price`, `tier`, `category.en`, `components`,
  `numeric_stats`.
- **Champion:** `id`, `name.en`, `stats` (per-level table, original keys), and per ability key:
  `name.en`, `description.en`, `scaling` (`type`, `value` as string).
- **Meta:** `patch`, `updated`, and `patch_major` / `sources` when the site provides them (optional:
  the 7.3 bootstrap has neither).

The mapper runs on the trimmed snapshot rather than the raw responses, so the snapshot is the
single source of truth for a patch's generated files. The raw schemas parse the full response
first; trimming happens after validation.

## 4. Overlay model

A patch dataset for patch `P` with previous patch `B` is built as:

1. `P/generated` items and champions,
2. merged by id with `B`'s effective hand-modelled entries (the result of `B`'s own overlay,
   so inheritance chains across several patches),
3. merged by id with `P/overrides.ts`,
4. exclusive groups re-applied (inherited from `B` unless `P` defines its own),
5. staleness marked (below).

The 7.3 folder is the root: its hand-modelled entries are `STARTER_ITEMS` and
`HAND_MODELED_CHAMPIONS`.

### Staleness

An inherited hand-modelled entry is **stale** in `P` when its snapshot record changed between `B`
and `P` and its id is in neither `P/overrides.ts` nor `P/reviewed.ts`. A stale entry keeps its
inherited values and effects, but its provenance becomes `verifiedInGame: false` with
`staleSince: P`.

`ProvenanceSchema` gains one optional field, `staleSince: z.string().optional()`. Staleness carries
forward: an entry stale in 7.3a stays stale in 7.3b until it is overridden or reviewed.

The set of changed ids comes from `P/generated/changed-ids.ts` (`CHANGED_IDS: { items: string[];
champions: string[] }`, every record that changed, not only hand-modelled ones), written by the same
run that writes `patch-diff.json`, so the dataset and the report can never disagree. A `.ts` module
rather than a JSON import keeps the browser bundle and tsconfig unchanged.

`reviewed.ts` exports `REVIEWED: { id: string; note: string }[]`, e.g.
`{ id: 'trinity-force', note: 'Description reworded; 200% base AD unchanged' }`.

### Registry

`registry.ts` exports:
- `PATCH_IDS: readonly string[]` in release order (`['7.3', '7.3a']`),
- `CURRENT_PATCH` = the last id,
- `getPatchDataset(id): PatchDataset` with `{ id, champions, items, catalog, targets }`.

`@wr-calc/data` keeps the `PATCH_7_3_*` exports so the golden tests and existing tests keep
running against 7.3. The web app's dataset moves to `getPatchDataset(CURRENT_PATCH)`. Targets are
inherited unchanged (they are not wrpocket data).

## 5. Diff

`diffSnapshots(before, after): PatchDiff` compares record by record:

- **Items:** price, tier, components, each `numeric_stats` key (added, removed, changed), EN name,
  EN description.
- **Champions:** each per-level stat row (reported as one entry per stat key, listing the
  levels that changed), and per ability: scaling rows by `type` (per-rank strings, cd, cost),
  EN name, EN description.
- **Entries:** added and removed items and champions.

Text fields get a word-level diff. Numbers that changed inside text are pulled out as
`old → new` pairs (`7% → 6%`), because item passives exist only as prose and that is where most
effect changes show up.

`PatchDiff` is plain JSON: `{ from, to, fromUpdated, toUpdated, items: EntryDiff[],
champions: EntryDiff[], added, removed, needsReview: Flag[], mapperNotes: { added, removed } }`.

## 6. Flagging

`flagHandModelled(diff, handModelledIds, overrides, reviewed, goldenCases): Flag[]`:

| Severity | When |
|---|---|
| `removed` | A hand-modelled id no longer exists in the new snapshot. Listed first |
| `changed` | The id's record changed and the id is not overridden or reviewed. Lists the changed fields |

Each flag lists the golden cases whose champion or build item ids include the flagged id, so the
user knows which readings to re-record. Goldens stay tagged with the patch they were recorded on
and keep running against that patch.

## 7. Reports

`PATCH_DIFF.md`, in order:

1. Header: `from → to`, wrpocket `updated` timestamps, counts.
2. **Needs review:** removed, then changed hand-modelled entries, each with field diffs and the
   affected goldens.
3. Changes to generated entries, grouped by champion and item (already applied, informational).
4. Added and removed entries.
5. Mapper notes that are new or gone compared with the previous patch's `IMPORT_REPORT.md`.

`patch-diff.json` holds the same `PatchDiff` data.

## 8. Command and run behaviour

`pnpm --filter @wr-calc/data patch:update [--refresh] [--from-cache <dir>]`

1. Fetch `meta.json` fresh. Compare `meta.patch` and `meta.updated` with the registry and the
   latest snapshot:
   - **New patch id:** create the folder, the stub `overrides.ts`, `reviewed.ts`,
     `provenance.ts` and `index.ts`, and append the id to `PATCH_IDS`.
   - **Same id as the current patch, newer `updated`:** regenerate in place. The diff stays
     against the previous patch; git shows the in-patch change.
   - **Same id, same `updated`:** print "up to date" and exit without writing.
2. Fetch the items, the champion summary and the champions (cached as today, 150 ms delay).
3. Validate with the raw schemas, trim, write the snapshot.
4. Map the snapshot to `generated/` and `IMPORT_REPORT.md` with the existing mapper, using the new
   patch's provenance.
5. Diff against the previous patch's snapshot, flag, write `patch-diff.json` and `PATCH_DIFF.md`.

`--from-cache <dir>` reads the raw responses from a local cache folder instead of the network.
It exists to bootstrap 7.3 from `.cache/wrpocket/7.3-20260923101927`, which has no `meta.json`: the
patch id and `updated` timestamp come from the folder name.

## 9. Failure handling

- Any raw-schema parse failure or HTTP error aborts the run, naming the URL and status.
- All output is written to a temporary folder and moved into place only after every stage
  succeeds, so a failed run never leaves a half-written patch folder or snapshot.
- **Determinism check for the 7.3 bootstrap:** regenerating 7.3 from its trimmed snapshot must
  reproduce today's `7.3/generated/` byte for byte. If not, the run stops and reports the
  difference instead of silently changing 7.3.
- If a previous patch has no snapshot, the run stops: diffing needs a baseline.

## 10. Testing

TDD, no network in tests. Small fixtures in `packages/data/test/patch/fixtures/`.

- **trim:** output keys sorted, unused fields dropped, stable across runs.
- **diff:** numeric stat added/removed/changed; price change; per-rank scaling change; per-level
  stat change; text change with extracted number pairs; added and removed entries; unchanged
  record gives no entry.
- **flag:** changed → flagged; overridden or reviewed → not flagged; removed → `removed` first;
  goldens matched by champion and by build item.
- **render-diff:** section order and a snapshot of a small report.
- **overlay and registry:** 7.3a inherits 7.3's hand-modelled effects; a stale entry has
  `staleSince: '7.3a'` and `verifiedInGame: false`; an override replaces the inherited entry and is
  not stale; a reviewed id is not stale; `CURRENT_PATCH` is the last registry id;
  `getPatchDataset` works for both ids.
- **schema:** `staleSince` accepted and optional.
- The existing goldens and the full suite pass before anything is called done.

## 11. First run: 7.3a

1. Bootstrap the 7.3 snapshot from the local cache. The determinism check passes. Commit.
2. Run `patch:update` against live wrpocket: `7.3a/` folder, `PATCH_DIFF.md`, `patch-diff.json`.
   Commit.
3. Point the web app at `CURRENT_PATCH`. Commit.
4. Summarise the Needs-review list for the user as input to a practice-tool test sheet. No
   overrides are written in this step.

## 12. Docs

- ADR in `docs/decisions/`: overlay model, `staleSince`, committed trimmed snapshots, registry.
- README: an "Updating to a new patch" section (command, what it writes, how to clear a flag);
  the `import:wrpocket` mention is replaced by `patch:update`.
- `packages/data/golden/README.md`: one line saying goldens run against the patch they were
  recorded on.

## Update (2026-10-01): step 5 groundwork

- `.github/workflows/ci.yml` runs typecheck and tests on pushes to `main` and on pull requests.
- `.github/workflows/patch-update.yml` runs `patch:update`, then the checks, and opens a pull request
  (`patch-update/auto`) whenever anything changed. The PR body holds the run's summary and any check
  failures. It is manual (`workflow_dispatch`) until the user turns on the commented daily `schedule`. The
  repository must allow GitHub Actions to create pull requests.
- The link guard tests skip stale entries, which keep their last values on purpose until reviewed, so a
  new patch with flagged changes doesn't fail the checks.
