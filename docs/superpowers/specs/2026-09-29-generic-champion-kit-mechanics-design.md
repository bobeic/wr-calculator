# Generic Champion Kit Mechanics (Ambessa first) — Design

Sub-project A of the "best Ambessa build" goal (2026-09-29). The engine was built around
Annie-style kits: a key press deals one fixed damage package and starts one cooldown. Ambessa's
kit breaks that in ways shared by many fighters and assassins, so this spec adds **generic**
mechanics (reusable for Riven, Jax, Camille, Lee Sin, ...) rather than an Ambessa-only handler,
and hand-models Ambessa on top of them.

## 1. Context and scope

### The larger goal and its sub-projects

"Best Ambessa build" = rank builds by both **burst** and **time to kill** per target type, with the
engine **searching** combos, against **real champions with builds**. It splits into five
sub-projects, each with its own spec → plan → implementation cycle:

| # | Sub-project | Depends on |
|---|---|---|
| **A** | **Generic kit mechanics + Ambessa (this spec)** | — |
| B | Item batch 5: AD assassin/bruiser items (Duskblade, Youmuu's, Collector, Edge of Night, Serylda's, Eclipse, Sundered Sky, Spear of Shojin, Sterak's, Death's Dance, Hullbreaker) | A |
| C | Real champion targets (level-15 opponents with typical builds) replacing the placeholder squishy/bruiser/tank presets | — |
| D | Combo search: highest-damage legal sequence (burst) and fastest kill with cooldowns (TTK); energy/mana costs | A |
| E | Build optimiser over item sets that respect the one-per-group rules, ranked per target | B, C, D |

### Why Ambessa needs new mechanics

1. **Recasts.** Q is Cunning Sweep then Sundering Slam (castable for 3.5s after Sweep). The engine
   has one damage list and one cooldown per key.
2. **Empowered-attack charges tied to a dash.** Each ability followed by a feint dash empowers the
   next attack (+50% attack speed, bonus damage), stacking to 3 for 4s. The engine has only
   Spellblade's single charge, no stacks, no dash, no per-swing attack speed.
3. **Dash-triggered recast.** E recasts at the end of a feint.
4. **Ratios that grow with a second stat.** Q: "7% (+0.04% per bonus AD) of max HP"; R: "10%
   (+0.05% per bonus AD) of missing HP". Ratios today read one stat.
5. **Stats from her own ability rank.** R passively grants 10/20/30% armor pen. Champions have no
   effects at all today.
6. **Bad source data.** wrpocket's parse drops the %HP parts, the empowered values and most of R,
   and E's ratio disagrees between table (50/55/60/65%) and text (50%).

### Non-goals

- Energy/mana costs (not enforced for any champion yet; sub-project D).
- Healing, spell vamp, shields on the attacker, damage reduction taken (no effect on damage dealt).
- Positional variants: Q's edge vs inner hit, Slam's first vs other targets, W's empowered version
  after blocking crowd control. 1v1 scope takes the best case the user can reliably get (edge,
  first target, unempowered W). See the one-on-one scope decision.
- Per-ability rank input (still max rank; separate backlog item).
- Combo search, compareBuilds/sustainedDps rotations (sub-project D).

### Principles kept

From the phase-1 spec: no champion or item names in engine code; unverified mechanics live in
`packages/calc/src/rules.ts` as `TODO-VERIFY`; every effect declares its support level; game values
are verified in game before being trusted (Ambessa's are entered from her ability text as
placeholders, then corrected from the baseline readings).

## 2. Data format

All new fields are **optional**, so every existing champion, item and golden case is unaffected.

### 2.1 Ability-owned effects

```ts
AbilitySchema.effects?: Effect[]   // same Effect union items and runes use
```

- The champion's ability effects (passive, Q, W, E, R) join the attacker's effect list alongside
  item and rune effects, both in `resolveStats` (so stat effects like R's armor pen resolve) and in
  `simulateCombo` (so hook effects like the passive's charges run).
- **Rank binding:** before they join, every `{ byRank }` scalar inside an ability-owned effect is
  replaced by its value at that ability's rank (currently `maxRank`), via a pure
  `bindAbilityRank(effect, rank)` transform. Handlers stay rank-unaware.
- Kit effect ids are prefixed with the champion id (e.g. `ambessa-…`) so they can't collide with
  item effect ids (runtime buffs are keyed by effect id); a data test checks prefix and uniqueness.

### 2.2 Ratios that grow with a second stat

```ts
DamageComponent.ratios[]: { stat, value, perStat?: { stat: DamageRatioStat, value: NullableScalar } }
```

Coefficient = `value + perStat.value × resolve(perStat.stat)`; damage += coefficient ×
`resolve(stat)`. Example: `{ stat: 'targetMaxHp', value: { byRank: [0.04, 0.05, 0.06, 0.07] },
perStat: { stat: 'bonusAd', value: 0.0004 } }` is "7% (+0.04% per bonus AD) of max HP" at rank 4.

### 2.3 Recast stages

```ts
AbilitySchema.stages?: {
  id: string
  name: string
  trigger: 'press' | 'dash'
  windowSeconds: number          // measured from the end of the previous stage's cast
  castTime?: number              // default 0
  damage: DamageComponent[]
}[]
AbilitySchema.cooldownStartsOn?: 'firstCast' | 'lastStage'   // default 'firstCast'
```

The ability's own `damage`/`castTime` are stage 1; `stages` are stages 2..n. Every stage is assumed
to hit (1v1 scope). With `'lastStage'`, the cooldown starts when the last stage is cast or when an
open window lapses, whichever comes first.

### 2.4 The `dash` combo action

`ComboAction` gains `'dash'`: a generic short movement (Ambessa's feint, Riven's hops). Its
duration is `DASH_SECONDS` in `rules.ts` (`TODO-VERIFY(dashDuration)`, default 0.2s). The golden
case schema's action pattern and the debug page's combo parser accept it.

### 2.5 New effect kind `empoweredAttack`

```ts
{
  kind: 'empoweredAttack',
  grant: {
    on: 'abilityCast' | 'dashAfterAbility',
    slots?: AbilityKey[],        // which abilities count; default all four
    withinSeconds?: number,      // dashAfterAbility only: max gap from the cast's end to the dash
  },
  maxCharges: number,            // int >= 1
  durationSeconds: number,       // charges share one expiry, refreshed on each grant
  bonus: DamageComponent,        // same format as ability damage, so all ratios work
  attackSpeedBonus?: number,     // fraction added for the swing that spends a charge
}
```

### 2.6 Hand-modelled champions

`packages/data/src/patches/7.3/champions.ts` exports `HAND_MODELED_CHAMPIONS`;
`PATCH_7_3_CHAMPIONS = mergeById(GENERATED_CHAMPIONS, HAND_MODELED_CHAMPIONS)`, mirroring
`STARTER_ITEMS`. Generated files are still never hand-edited.

### 2.7 Ambessa (placeholders from her ability text; **?** = to confirm in game)

| Part | Model |
|---|---|
| Passive | `empoweredAttack`: grant `dashAfterAbility`, withinSeconds **?0.5**; maxCharges 3; duration 4s; attackSpeedBonus 0.5; bonus physical **?5 + 2.5 per level** (`byLevel`) + 25% bonusAd |
| Q (stage 1, Cunning Sweep, edge) | 60/80/100/120 + **?60%** bonusAd + (4/5/6/7% + 0.04% per bonusAd) targetMaxHp; cooldown 12/11/10/9 |
| Q stage 2 (Sundering Slam, press, 3.5s, first target) | 70/100/130/160 + **?90%** bonusAd + (4/5/6/7% + 0.04% per bonusAd) targetMaxHp |
| W | 70/100/130/160 + 80% bonusAd; cooldown 17/16/15/14 |
| E (stage 1) | 40/80/120/160 + **?50/55/60/65%** bonusAd; cooldown 12/11/10/9 |
| E stage 2 (dash, window **?0.5s**) | same damage as stage 1 |
| R | 200/300/400 + (10% + 0.05% per bonusAd) targetMissingHp; castTime **?1.0** (suppression before the slam); cooldown 80/70/60 |
| R passive | `stat` effect: pctArmorPen 0.1/0.2/0.3 (`byRank`) |

## 3. Runtime behaviour (`simulateCombo`)

New per-combo attacker state: each ability's open stage window (next stage index, closes-at time),
the last ability cast (`at`, `feintUsed`), and empowered charges (kept with the existing timed
buffs as `{ stacks, expiresAt }`).

### Pressing an ability key

1. If that ability has an open window whose next stage is `press` → cast that stage: advance time
   by its castTime, dispatch `onAbilityCast` (so Spellblade, feint, Shojin-style effects see it),
   deal its damage (source name = stage name), dispatch `onAbilityHit`. No cooldown restart
   (unless `cooldownStartsOn: 'lastStage'` and this is the last stage). Move the window to the
   following stage or close it.
2. Else, if off cooldown → cast stage 1 as today; start the cooldown (per `cooldownStartsOn`); open
   the window for stage 2 if one exists.
3. Else → skip (unchanged), so a search can emit any sequence and illegal steps drop out.

Every cast in steps 1-2 records `lastAbilityCast = { at: castEnd, feintUsed: false }`.

### `dash`

1. Advance time by `DASH_SECONDS`, flushing scheduled events.
2. If any ability has an open window whose next stage is `dash` → cast it at the end of the dash.
   A dash-triggered stage does **not** update `lastAbilityCast`.
3. Dispatch the new `onDash` hook. `empoweredAttack` with `dashAfterAbility` grants one charge
   (capped at maxCharges, expiry refreshed to now + durationSeconds) if `lastAbilityCast` exists,
   `feintUsed` is false and `now − at ≤ withinSeconds`; then sets `feintUsed = true`.

`empoweredAttack` with `abilityCast` grants through the existing `onAbilityCast` hook, filtered by
`slots`.

### `AA`

1. Base attack damage as today.
2. If an unexpired charge exists → spend one and deal `bonus` as its own damage instance (source
   kind `basicAttack`, id = the effect id).
3. `onBasicAttack` hooks (on-hit items) fire once, as today.
4. The interval before the next swing uses `attackSpeed` with `attackSpeedBonus` added to the bonus
   fraction for this swing only, still capped by `ATTACK_SPEED_CAP`.

### New `rules.ts` entries (all `TODO-VERIFY`)

- `dashDuration` — `DASH_SECONDS`, how long a dash takes.
- `empoweredChargeExpiry` — charges share one refreshed expiry (vs. each expiring on its own).
- `stageCooldownStart` — default `firstCast`; per-ability override via `cooldownStartsOn`.

## 4. Testing

- **Unit tests, written first** (TDD), per piece:
  - schema: ability `effects`, ratio `perStat`, `stages`, `cooldownStartsOn`, `empoweredAttack`,
    `dash` in the golden action pattern;
  - `resolveDamageComponent` with `perStat`;
  - `bindAbilityRank` and ability-owned stat effects resolving at rank in `resolveStats`;
  - stage state machine: press vs dash triggers, window expiry, cooldown on first cast vs last stage;
  - `dash`: duration, dash-triggered stage, one feint per cast, no feint from a dash-triggered stage;
  - `empoweredAttack`: granting (both triggers, slots filter), cap, shared expiry, spending, bonus as
    a separate instance, per-swing attack speed and cap.
- **Data tests:** `HAND_MODELED_CHAMPIONS` overrides generated entries; Ambessa's base stats match
  the generated ones unless deliberately changed.
- **Golden cases:** Ambessa cases from the baseline readings (section 5); all 64 existing cases stay
  green.
- **Generic check:** after Ambessa is verified, model Riven or Jax in the new format with no new
  engine code.
- Full suite per package (`schema`, `calc`, `data`, `web`) plus `pnpm typecheck`.

## 5. Ambessa baseline readings (sent to the user 2026-09-29)

Setup: level 15, Q/W/E rank 4, R rank 3, 100 armor / 100 MR / 10,000 HP dummy, a rune page with no
AD or armor pen. Predictions assume R's 30% armor pen applies to all her damage (×0.588; ×0.5
otherwise); the game rounds damage up.

| # | Test | Prediction |
|---|---|---|
| 1 | Stat panel L1 / L15: AD, HP, armor, MR, AS | 58/660/43/36/0.80 · 121/2340/106/64/0.905 |
| 2 | Basic attack | 72 (61 without R's pen) |
| 3 | Q edge (inner) | 483 (242) |
| 4 | Q then Q2 | 483, 506 |
| 5 | W | 95 |
| 6 | E, no feint | 95 |
| 7 | E then feint | 95 + 95 |
| 8 | Ability → feint → attack (one number or two?) | 95, or 72 + 24 |
| 9 | R, full-HP dummy | 236 |
| 10 | R, dummy ~3,000 HP | 648 |
| 11-17 | With a B.F. Sword (+40 bonus AD): attack / Q / Q2 / W / E / feint attack / R at ~3,000 HP | 95 / 591 (499 if %HP is per 100 AD) / 622 / 113 / 110 or 106 / 95 + 30 / 730 |
| 18 | Q cooldown start: after Sweep or after Slam | — |
| 19 | Three feints then three attacks: all empowered? Do charges survive ~3s? | — |
| 20 | Feint window after a cast | — |
| 21 | Anything odd | — |

Readings adjust only Ambessa's data (and the `TODO-VERIFY` defaults), not the generic design, so
implementation can proceed before they arrive.

## 6. Build order (for the plan)

1. Schema: ability `effects`, ratio `perStat`, `stages`/`cooldownStartsOn`, `empoweredAttack`,
   `dash` action.
2. Calc: `perStat` in damage components; `bindAbilityRank`; champion ability effects in
   `resolveStats` and `simulateCombo`.
3. Calc: stage state machine and `dash` action (+ `onDash` hook, `rules.ts` entries).
4. Calc: `empoweredAttack` handler.
5. Data: hand-modelled champion overlay + Ambessa; golden pattern accepts `dash`; debug page parser.
6. Ambessa golden cases from the readings; ADR; Riven/Jax generic check.
