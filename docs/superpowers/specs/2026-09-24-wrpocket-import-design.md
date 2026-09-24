# wrpocket.app Data Import — Design

Runs **before** Phase 1 Step 7 (debug page). Before this import, every stat and effect magnitude in
`packages/data` was `null`, and the few real numbers (item costs, champion base stats) were
placeholders. The user found https://wrpocket.app, confirmed copying its values is fine (every value
gets double-checked in-game later), and asked for the whole structure to be set up now: **all
champions and items, with the starter set fully filled.**

## 1. Source

The site serves JSON under `https://wrpocket.app/site_data/` (checked 2026-09-24, patch 7.3, data
updated 2026-09-23):

| File | Contents used |
|---|---|
| `meta.json` | `patch`, `updated` |
| `items.json` (171) | `id`, `name.en`, `price`, `numeric_stats`, `category.en`, `tier`, `components`, `description.en` |
| `champions_summary.json` (142) | champion ids |
| `champions/<id>.json` | `name.en`, `stats` (Lv1–15 table, Japanese keys), `abilities` (5 slots: `scaling` per-rank table + `description.en`) |

The site aggregates Riot and Tencent (CN server) data with community sources. Its knowledge pages
are CC BY-NC 4.0. Everything imported is marked unverified.

## 2. Conflict rules ("pick one type")

- **English text wins over Chinese text.** For example, BotRK is 7% / 8.5% in English but 6% / 8% in
  Chinese; the import uses the English values.
- **Ability base damage:** the English text is used when it gives every rank. When the text shows only
  the rank-1 value and the table's rank 1 matches, the table's full per-rank values are used (135
  such abilities). When both give full ranks and disagree (28 abilities, e.g. Annie Q text
  `80/130/180/230` vs table `80/125/170/215`), the English text is used and the conflict is logged.
- **Cooldown and mana cost** come only from the table; the text rarely has them.

## 3. Mapping

**Items**
- Stat keys map to `STAT_KEYS`. Percentages become fractions: `attackSpeed`, `criticalRate`,
  `moveSpeedPercent`, `lifeSteal`, `armorPenPercent`, `magicPenPercent`, `healShieldPower`, `tenacity`.
- `healthRegen` / `manaRegen` are "% of base regen" in WR, but our `hpRegen` / `manaRegen` are flat.
  They are skipped and reported.
- Tier: category `Boots` → `boots`, `Support` → `support`; otherwise site tier `basic` → `basic`,
  `intermediate` → `epic`, `upgraded` → `legendary`.
- Recipe comes from `components`. `cost.combine` = price − the sum of the component prices.
- `effects: []`: generated items don't model passives.
- `tags: [category]`.

**Champions**
- `baseStats.X = { base: Lv1, perLevel: (Lv15 − Lv1) / 14 }`. This is exact at levels 1 and 15 under
  both the engine's current growth curve and the site's linear tables. Deviations from a straight line
  of more than 1 are reported.
- `attackSpeed = { base: Lv1, ratio: (Lv15/Lv1 − 1) / 14 }`.
- `mana` / `manaRegen` are omitted when zero. `resource` is `mana` if Lv1 mana > 0, else `other`.
- Abilities (`passive/q/w/e/r` ← `パッシブ/スキル1/スキル2/スキル3/アルティメット`):
  - `maxRank`: 1 for the passive; otherwise the number of cooldown ranks when there are more than 1,
    else 4 for basic abilities and 3 for the ultimate.
  - `cooldown` / `cost`: `{ byRank }`, or a number for a single value. `null` when absent. The passive
    has no `cost`.
  - `castTime: 0`, since the source has no cast times.
  - One `DamageComponent` from the first `N (+ratios) <type> damage` phrase in the English text
    (§2). Ratios are parsed for `AP`, `AD` (→ `totalAd`), `bonus AD`, `bonus Health/HP`, and
    `max Health/HP`. Anything else is reported as unparsed. If there's no phrase but the table has
    base damage and the text names exactly one damage type, that type is used with no ratios.
    Otherwise `damage: []`.
- Id aliases: `b.-f.-sword` → `bf-sword`, `nunu-and-willump` → `nunu-willump`.

## 4. Files

```
packages/data/
  scripts/import-wrpocket.ts          entry: fetch (cached) → map → write; `pnpm --filter @wr-calc/data import:wrpocket [--refresh]`
  scripts/wrpocket/raw-schemas.ts     zod schemas for the site JSON (fail loudly on shape changes)
  scripts/wrpocket/ids.ts             ID_ALIASES, normalizeId
  scripts/wrpocket/parse-ability.ts   parseRanks, toScalar, parseRatios, findTextDamage, damageTypesIn, round
  scripts/wrpocket/map-item.ts        mapItemStats, mapItem
  scripts/wrpocket/map-champion.ts    fitGrowth, fitAttackSpeed, mapChampion
  scripts/wrpocket/render.ts          renderModule, renderReport
  src/patches/7.3/generated/items.ts       GENERATED_ITEMS (committed, never hand-edited)
  src/patches/7.3/generated/champions.ts   GENERATED_CHAMPIONS
  src/patches/7.3/generated/IMPORT_REPORT.md
  .cache/wrpocket/<patch>/             raw downloads (gitignored)
  tsconfig.scripts.json                typechecks scripts/ and test/wrpocket/ (wired into root `typecheck`)
```

- The mapping modules are pure and unit-tested. Only the entry script does I/O.
- It runs with `tsx`, a new devDependency of `packages/data`. Node's own TypeScript stripping can't
  resolve the workspace's extensionless imports.
- The import refuses to run if `meta.patch` is not `7.3`, since the output folder is patch-specific.

## 5. Merging with the hand-written starter set

- `items.ts` becomes `STARTER_ITEMS`: the 15 hand-written items with every value filled from the
  site's English text, including passive magnitudes and existing effect ids kept stable.
  `PATCH_7_3_ITEMS = mergeById(GENERATED_ITEMS, STARTER_ITEMS)`: generated order, with the starter
  item replacing the generated one on the same id, and starter-only ids appended (`seraphs-embrace`).
- Where an existing effect kind can't express the real passive, the closest honest model is used,
  with `support: 'partial' | 'none'` and a `supportNotes` explaining the gap. For example, Liandry's
  burn is % max HP, but `dot` only has flat ticks, so it's `support: 'none'` with `tickAmount: 0`.
- **Champions:** the generator's output *is* "filled from the English text", so the hand-written
  `champions.ts` is deleted and `PATCH_7_3_CHAMPIONS = GENERATED_CHAMPIONS`. The starter four are
  reviewed against the import report. A hand override mechanism is added only if a starter champion
  actually needs a correction (YAGNI).
- A new `WRPOCKET_7_3_PROVENANCE = { source: 'wiki', patch: '7.3', verifiedInGame: false }` goes on
  every imported and site-filled entry. `PATCH_7_3_PROVENANCE` (`manual`) stays for hand-made
  placeholders such as Step 7's target presets.

## 6. Testing

- Unit tests per mapping module, using synthetic fixtures written in the test files. These cover:
  - stat conversion and skipped keys
  - tier, recipe and cost rules, including negative or unknown component prices
  - rank parsing
  - ratio parsing, including unparsed parts
  - text damage, including the range upper bound
  - the table fallback and conflict notes
  - growth and attack-speed fitting and the non-linearity note
  - id aliasing
  - the rendered module header and provenance substitution
- Generated conformance: 171 items and 142 champions, all schema-valid, unique ids, wiki provenance.
- The data tests are rewritten for the new requirements:
  - the starter items are present and win the merge
  - starter cost, recipe and stats match their generated counterpart
  - starter items have no `null`s except Seraph's shield (not on the site)
  - the starter champions are present
- Existing golden and catalog tests keep passing (imports repointed to the patch index).

## 7. Knock-on changes to the Step 7 plan

- `defaultState`'s first champion becomes the first generated id (`aatrox`), not `nunu-willump`.
- Tests that relied on starter-item `null`s (BotRK `stats.ad`, Blasting Wand `stats.ap`) switch to
  Seraph's Embrace's still-`null` shield `effects[1].amount`. The run-debug "dataWarnings > 0"
  assertion is dropped; uniqueness is still asserted.
- Heartsteel now declares two inputs (`heartsteel-stacks`, then `heartsteel-charge-ready`). The
  collect-inputs and `toBuild` expectations change accordingly.
- The root `typecheck` script becomes
  `tsc -b && tsc -p packages/data/tsconfig.scripts.json && pnpm --filter @wr-calc/web typecheck`.
- The Step 7 spec's purpose line no longer says every magnitude is `null`.

## 8. Out of scope

- Modelling passives for the ~156 non-starter items.
- Runes and summoner spells.
- Switching the engine to linear growth (waits for the user's level-8 Jinx HP check).
- Non-English text.
- Any network access at test time.
