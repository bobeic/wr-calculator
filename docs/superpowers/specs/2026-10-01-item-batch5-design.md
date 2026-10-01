# Item batch 5: AD items for Ambessa — design

Date: 2026-10-01. Sub-project B of the "best Ambessa build" goal (A was the generic kit mechanics,
`2026-09-29-generic-champion-kit-mechanics-design.md`).

## 1. Goal and scope

Model the AD items Ambessa builds in Wild Rift patch 7.3 so the later build optimiser (sub-project
E) can compare them. Success means each item's damage matches the user's practice-tool readings,
using the same flow as item batches 1-4: predictions, readings, fixes, golden cases.

The batch covers nine items:

| Item | What it needs |
|---|---|
| Black Cleaver | Already modelled. Gets the merged-attack fix (one stack per empowered attack) |
| Eclipse | New `hitStackProc` (instant) |
| Serylda's Grudge | Armor pen stat, plus `hitStackProc` delivered as damage over time |
| Spear of Shojin | New `basicAbilityHaste` stat, plus new `hitStackAmp` |
| Sundered Sky | New `guaranteedCrit` |
| Sterak's Gage | Existing `statConversion` (50% base AD to AD) |
| Death's Dance, Guardian Angel, Maw of Malmortius | Stats only |

Out of scope: shields, heals, slows, Grievous Wounds, revives and other defensive passives. The
calculator models one-on-one damage dealt (see the one-on-one scope note). Death's Dance's
Cauterize, Guardian Angel's revive and Maw's Lifeline only protect the holder, so they are listed
in a data comment and not modelled.

Background facts from in-game testing:
- Ambessa's empowered-attack bonus (test #8, 2026-09-30) and Trinity Force's spellblade (batch 4)
  each showed as one number with the attack. Lich Bane's magic spellblade and Nashor's magic
  on-hit showed as separate numbers.
- Stormsurge could not trigger on the practice dummy, so champion-only triggers may not work there.

## 2. Hits and merged attack damage

### Hit ids

- `simulateCombo` keeps a hit counter. Each basic attack opens a new hit, and so does each ability
  stage cast, including press-triggered stages (Q2) and dash-triggered ones (the feint recast).
- `DamageInstance` gains `hitId?: number`. Every instance dealt while a hit is open records it.
  That includes on-hits, spellblades and item procs fired from that hit's hooks.
- Damage-over-time ticks and other scheduled events have no `hitId`. They don't count as an attack
  or a cast.

### Building the attack before it lands

- A new hook, `beforeBasicAttack(effect, ctx): AttackModifier | undefined`, runs before the
  attack's damage instance is dealt. It returns:
  ```ts
  interface AttackModifier {
    /** Extra damage on this attack. Same-type parts merge into the attack's instance. */
    bonus?: { type: DamageType; amount: number; source: DamageSource }[]
    /** Replaces the attack's crit multiplier for this swing (e.g. Sundered Sky's 1.6). */
    critMultiplier?: number
  }
  ```
- Bonuses with the attack's damage type (physical) join the attack's single instance. Other types
  become their own instance in the same hit, dealt right after the attack.
- If more than one effect sets `critMultiplier`, the highest wins.
- `empoweredAttack` and `spellblade` move from `onBasicAttack` to `beforeBasicAttack`. Charge
  consumption, the empowered swing's attack speed and the spellblade's internal cooldown keep their
  current behaviour. `onHit` and other `onBasicAttack` effects are unchanged and still run after
  the attack lands, as separate instances.

### Keeping the merged number correct

- `RawDamageInstanceInput` and `DamageInstance` gain `parts?: { source: DamageSource; amount: number
  }[]`. A merged instance lists the attack and each merged bonus. The debug page shows the parts
  under the instance.
- In `performDamage`, damage amps (`damageMultiplier`) apply to each part separately, judged on
  that part's source, before the parts are added up. Resists and damage reduction then apply once
  to the summed raw damage. An instance without `parts` behaves exactly as today.
- `SourceKind` gains `passive`, for a champion's own passive damage. The empowered-attack bonus
  uses it. The `sourceKind` condition accepts it too.

### Effect on existing counters

- Black Cleaver's `resistShred` and `procEveryN` keep counting per instance. Merging alone gives
  one Black Cleaver stack per empowered attack instead of two.
- Merging changes how damage is grouped, not the totals, so the 64 Annie goldens must not change.
  The Trinity Force cases are the check.

## 3. New effect types and stats

### `hitStackProc` (Eclipse, Serylda's Frostbite)

```ts
{
  kind: 'hitStackProc'
  stacksToProc: number                 // integer >= 2
  stackWindowSeconds: number           // stacks expire this long after the latest one
  cooldownSeconds: number
  stacksFrom: ('basicAttack' | 'ability' | 'empoweredAttack')[]
  damage: DamageComponent
  delivery: { kind: 'instant' } | { kind: 'dot'; tickIntervalSeconds: number; durationSeconds: number }
}
```

- Each hit id adds at most one stack, and only if the hit's kind is in `stacksFrom`.
  `empoweredAttack` means a basic attack that consumed an `empoweredAttack` charge. `basicAttack`
  covers every attack, empowered or not.
- The stack is added after the hit's own damage. When the stacks reach `stacksToProc`, they are
  used up, the proc fires and the cooldown starts. No stacks build during the cooldown.
- `damage` is resolved like an ability's damage component, so it supports `targetMaxHp` ratios,
  `levelRange` bases and bonus-AD ratios. For `dot` delivery it is the per-tick amount, read when
  the proc fires.
- An instant proc is its own instance in the same hit (source kind `item`). Dot ticks are scheduled
  events with no hit id.
- Eclipse: 2 stacks, 1.8s window, 6s cooldown, stacks from `basicAttack` and `ability`, 6% target
  max HP physical, instant.
- Serylda's: 3 stacks, 6s window, 5s cooldown, stacks from `ability` and `empoweredAttack`,
  12-40 (based on level) + 40% bonus AD physical every 0.25s for 2s (8 ticks).

### `hitStackAmp` (Spear of Shojin's Focused Will)

```ts
{
  kind: 'hitStackAmp'
  amountPerStack: number       // 0.03
  maxStacks: number            // 4
  durationSeconds: number      // 6, refreshed on each stack
  appliesTo: SourceKind[]      // ['ability', 'passive']
}
```

- One stack per hit id, added after the hit lands, so the hit that grants a stack isn't boosted by
  it (as with Riftmaker).
- Its `damageMultiplier` is `1 + amountPerStack × live stacks` for parts whose source kind is in
  `appliesTo`, and 1 otherwise.

### `basicAbilityHaste` stat

- A new stat key, added to `abilityHaste` for Q, W and E cooldowns only. This mirrors how
  `ultimateHaste` applies only to R. Shojin's Dragonforce gives 20.

### `guaranteedCrit` (Sundered Sky's Lightshield Strike)

```ts
{ kind: 'guaranteedCrit'; critMultiplier: number; cooldownSeconds: number }
```

- In `beforeBasicAttack`: if off cooldown, the attack's crit multiplier becomes `critMultiplier`
  (1.6) in place of the normal crit result, and the cooldown starts.
- The heal is not modelled.

### Existing effect types

- Sterak's Gage: `statConversion` from `ad` (`fromLayer: 'base'`) to `ad` at 0.5.

### Champion-only triggers

Eclipse and Sundered Sky say they only trigger on champions. No condition is set at first. If the
dummy readings show they don't trigger there, they get the existing `targetIsChampion` condition and
their golden cases use a champion target (Garen) instead.

## 4. Item data

- The nine items go in `packages/data/src/patches/7.3/items.ts`, each with a comment naming where
  its numbers came from (wrpocket's 7.3 stats or the WR wiki's passive text).
- Where wrpocket and the wiki disagree, wrpocket's stats are used and marked for checking against the
  user's tooltips:

  | Item | wrpocket | WR wiki |
  |---|---|---|
  | Serylda's Grudge | 50 AD, 35% armor pen, 15 AH | 40 AD, 33% armor pen, 15 AH |
  | Death's Dance | 50 AD, 45 armor, 15 AH | 35 AD, 40 armor, 15 AH |
  | Guardian Angel | 45 AD, 40 armor | 40 AD, 40 armor |

- Sterak's Gage has no AD stat in either source. Its AD comes only from Heavy Handed.
- Exclusive groups (`exclusive-groups.ts`): Serylda's and Black Cleaver are already in `armor-pen`.
  A new `lifeline` group holds Sterak's Gage, Maw of Malmortius and Seraph's Embrace. Seraph's
  membership is a guess from its passive's name, so the test sheet asks the user to confirm it.

## 5. Order of work and verification

1. Engine: hit ids, `beforeBasicAttack` with merged parts, `hitStackProc`, `hitStackAmp`,
   `basicAbilityHaste`, `guaranteedCrit`.
2. The nine items' data and the `lifeline` group.
3. A test sheet with engine predictions. Setup is the same as the Ambessa tests (level 15, Q/W/E rank
   4, R rank 3, 100/100/10,000 dummy, no damage runes), with one item at a time:
   - each item's tooltip stats and stat panel;
   - basic attack, Q, Q then Q2, W, E with only that item;
   - Eclipse: attack then Q within 1.8s (proc on Q), and whether it is one number or two;
   - Serylda's: three abilities, then the burn's total;
   - Shojin: four Q/W/E hits in a row, each number;
   - Sundered Sky: two attacks in a row (crit on the first only);
   - Black Cleaver: E, feint, empowered attack, then Q, to check one stack from the empowered attack;
   - whether Eclipse and Sundered Sky trigger on the dummy, with Garen as the fallback;
   - one full-build combo.
4. The user sends readings. Mismatches get fixed and readings become golden cases.

Tests:
- Unit tests for each new effect type and for merging: Trinity's and Ambessa's empowered attacks
  each come out as one instance; Lich Bane's magic spellblade stays separate; Shojin boosts only
  the passive part of a merged attack; Black Cleaver adds one stack per empowered attack; hit ids
  are shared within an attack and absent on dot ticks.
- The full suite passes, and the Annie goldens are unchanged.

Docs: an ADR in `docs/decisions/` (hit ids, same-type merging, the two hit-stack effect types,
`guaranteedCrit`), and the golden-case README updated when goldens are added.

Branch: `feat/tvanmook/item-batch5/20261001`.
