# Golden test cases

Real, in-game-verified combat scenarios that `packages/data/test/golden.test.ts` checks the
engine against. `loadGoldenCases` (Node-only, imported from `@wr-calc/data/golden-loader`, not the
root entry) loads every `*.json` file here.

Each case runs against the patch in its `patch` field, so importing a newer patch never changes what an existing case checks.

Current cases (7.3 practice tool, 2026-09-25): Annie at level 15, one ability per case, against the
practice dummy (100 armor / 100 MR / 10,000 HP; no `timeToKill` is recorded). "clean build" is Spellslinger's Shoes + Rabadon's Deathcap + Void Staff +
Zhonya's Hourglass, which have no on-hit damage passives. "full build" adds Luden's Echo and
Infinity Orb; those hits were recorded with Luden's passive on cooldown (the
`ludens-echo-on-cooldown` build input) and the dummy above Infinity Orb's low-HP threshold, so
neither passive applies.

Infinity Orb cases (2026-09-26): "orb build" is the clean build plus Infinity Orb. The `low-hp`
cases were hit with the dummy below 40% HP (`startHpFraction: 0.3`), so Inevitable Demise applies:
Q, W and R each dealt 1.2x, while Luden's Echo on the full-build Q was not amplified.

Horizon Focus cases (2026-09-26): "horizon build" is the clean build plus Horizon Focus. The
`hypershot` cases set the `horizon-focus-hypershot` input; in game, Q was cast from max range to
trigger Hypershot, and both that Q and the W/R after it dealt 1.1x.

Malignance cases (2026-09-26): "malignance build" is the clean build plus Malignance. The
`r-with-burn` case is R followed by the 3-second burn: 515 + 3 ticks of 70 (the burn's 10 MR
reduction applies to its own ticks). `q-during-burn` is R then Q while the ground burns: 515 + 574
(551 without the reduction), so the reduction applies to all magic damage during the burn.

Item batch 3 cases (2026-09-26): "lich bane build" and "morellonomicon build" are the clean build
plus that item. `q-then-aa` is Q followed by a basic attack, which showed as three numbers: Q 560,
the attack 45 physical and Lich Bane's spellblade 256 magic (75% base AD + 45% AP). "riftmaker
build" is the clean build plus Riftmaker (582 AP: Rabadon's multiplies the 7 AP from bonus HP).
`void-corruption-q` is Q then a Q 4s later at the full 8% (541 + 584). Q readings at each stack
were 541, 562, 573, 584 (the +2% stack is over before Q comes off cooldown); that ladder is
checked in `test/items.test.ts` with cooldowns ignored.

Item batch 4 cases (2026-09-29): "nashors build" and "trinity build" are the clean build plus
that item. Nashor's `aa` is a basic attack: 45 physical plus Gnaw's 99 magic on-hit. Trinity
Force's empowered attack showed as one number, 152 (the 63 attack plus the 89 spellblade), which
puts Annie's true level-15 base AD at 89.0-89.33 even though the stat panel rounds it up to 90.
`q-then-aa` uses Q 477 from the clean build (Trinity adds no AP or pen).
Bloodletter's Curse and Hextech Rocketbelt each share a one-per-build group with a clean-build
item, so their builds drop one: "bloodletters build" is Spellslinger's + Rabadon's + Zhonya's +
Bloodletter's (no Void Staff), and "rocketbelt build" is Spellslinger's + Rabadon's + Void Staff +
Rocketbelt (no Zhonya's). `q-stacks` is six Qs 3.5s apart: 349, 363, 379, 396, 414, 414 as Vile
Decay stacks to 30%. `protobelt` is the Rocketbelt active with all 7 bolts on the dummy: 170
(107 for the first bolt, about 10.7 for each extra). Some casts showed an extra ~75 on top, cause
unknown; the case uses the usual 170.

Ambessa cases (2026-09-30): Ambessa at level 15 with Q/W/E rank 4 and R rank 3 (so 30% armor pen
from R's passive), a rune page with no AD or pen. "bf-sword" adds a B.F. Sword (+40 bonus AD).
`q` is Cunning Sweep's edge hit and `q-then-slam` adds Sundering Slam's first-target hit (483 + 506).
`e-then-feint` is Lacerate and its dash recast. In `e-feint-empowered-aa` the empowered attack
showed as one number (95, or 125 with the sword) holding the attack and Drakehound's Step's bonus.
`no-items-aa` uses a 2% tolerance: the engine's 71.18 shows as 72, which is outside 1% of such a
small number. R is left out: the rank-3 tooltip reads "400 + 25% of their missing health", but R deals ~57 more
before mitigation than that on both the full-HP dummy (270, not 236) and a full-HP Garen with 114
armor (254, not 223), with no damaging runes. The cause is unknown and parked.

Item batch 5, Eclipse (7.3a practice tool, 2026-10-01): the Ambessa setup above with Eclipse only (65 AD, 20
ability haste). Readings: attack 110, Q edge 658 (center 329), Q2 edge 693 (center 347), W 125, E 119 per hit, R 275.
`e-then-feint-proc` is Lacerate then its dash recast with Ever Rising Moon procing on the recast: 119 + 531,
where 531 showed as one number holding the recast's 119 and the proc's 412. 412 after armor is 700 before it,
so the proc is 7% max HP (the WR wiki's 6% was out of date). `aa` uses a 2% tolerance, as `no-items-aa`. R gained
~5 over the no-item 270 (parked with the rest of R). Q-then-slam is left out until it's clear whether the proc
was on cooldown.

Item batch 5, the rest (7.3a practice tool, 2026-10-01): the same Ambessa setup with one item each. Black Cleaver
(`aa-aa` shows the second attack after one Carve stack; `e-feint-empowered-aa-q` adds one stack from the empowered
attack), Spear of Shojin (`q-w-e-q`: 591 + 117 + 116 + 677 as Focused Will stacks), Sundered Sky (`aa-aa`: the first
attack crits for 152, the second doesn't), Sterak's Gage, Death's Dance, Guardian Angel (45 AD) and Maw of
Malmortius. Readings within one point of the engine were recorded as read. Serylda's Grudge has no Frostbite burn
in game; its other hits aren't recorded yet.

The practice tool appears to round damage up rather than to the nearest whole number, so a
recorded value can be up to 1 above the engine's exact figure (e.g. 577.14 shows as 578). The 1%
tolerance covers this.

## Format

Each case is a `*.json` file matching `GoldenCaseSchema` (`packages/data/src/golden-types.ts`):

```json
{
  "scenario": {
    "championId": "nunu-willump",
    "level": 6,
    "build": { "items": ["long-sword"], "runes": [], "inputs": {} },
    "target": { "hp": 1000, "armor": 40, "mr": 30 },
    "combo": ["AA", "Q", "AA"]
  },
  "expected": { "totalDamage": 214, "timeToKill": 3.1 },
  "tolerance": 0.02,
  "patch": "7.3",
  "source": "practice-tool"
}
```

- `scenario`: enough to build a `Combatant` (via `combatantFromChampion`) and a dummy target,
  then run `simulateCombo`. `combo` uses the same `ComboAction` strings as `simulateCombo` itself
  (`'AA' | 'Q' | 'W' | 'E' | 'R' | 'item:<id>' | 'wait:<seconds>'`).
- `scenario.target.startHpFraction` (optional): the fraction of max HP the dummy starts at, for
  effects gated on low target HP. Defaults to 1 (full HP).
- `expected`: only include the fields you actually measured in the practice tool —
  `runGoldenCase` skips any field left out. Currently supported: `totalDamage`, `timeToKill`.
- `tolerance`: fraction, e.g. `0.02` = allow ±2%.
- `patch`: which `patches/<version>/` catalog to resolve the scenario's items/champion against.
- `source`: must be `"practice-tool"` — this is how a real, verified case is distinguished from
  anything else that might exist in this directory.

To add a case: play the scenario in the Wild Rift practice tool, record the real numbers, and
drop a new `*.json` file in this directory. No code changes needed — `golden.test.ts` picks it up
automatically.

Before you record a case, check the items involved. Many items in
`packages/data/src/patches/7.3/items.ts` are still skeletons — their stat and effect magnitudes
are `null`, which the engine resolves to `0`. If `scenario.build.items` includes one of these,
the engine will under-count damage compared to what you measured in the practice tool. Fill in
that item's real values first, then record the case — otherwise the case will fail (or pass for
the wrong reason).

Run just this package's tests with `pnpm --filter @wr-calc/data test`.
