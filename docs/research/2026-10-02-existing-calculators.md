# Existing damage calculators: what we can learn

**Date:** 2026-10-02. Read for ideas and cross-checks, not copied. None of them is a source of truth for Wild Rift
numbers; our source order (in-game > official notes > wrpocket > wiki) still decides values.

## Looked at

| Project | Game | Shape | Useful for |
|---|---|---|---|
| [SharpWR Damage Lab](https://github.com/EmrehanGul07/sharpwr-damage-lab) | **Wild Rift** (7.3) | Python/Streamlit, marksman-focused, one big attack loop | WR-specific item behaviour and its own in-game test notes |
| [LolDamageCalculator](https://github.com/PauHPMCBR/LolDamageCalculator) | PC | Java, one class per item with `onHit()` / `extraDmg()` hooks | Breadth: nearly every PC item, and how hooks split |
| [league-sim](https://github.com/chaodhib/league-sim) | PC | Rust sim for Kha'Zix, parses CommunityDragon item bins | Data parsing from game files; narrow |
| Also found: [lolcalc](https://github.com/asasinmode/lolcalc), [vi-damage-calculator](https://github.com/nicolasiven-ops/vi-damage-calculator), wrstat.com, wildriftmeta.com's build planner (stats only, no combat) | | | Not read in depth |

## What we took (or checked against)

From SharpWR (Wild Rift, so closest to us):

- **Energized cadence.** It charges Rapid Firecannon and Stormrazor every 7 attacks and Statikk Shiv every 5,
  with a "charged at start" toggle. We use the same numbers, marked unverified.
- **Terminus.** Light and Dark alternate per attack, Dark gives 10% armor and magic pen per stack up to 3, and the
  item's pen is capped at 40%. It notes "current in-game test: Shadow deals 30 bonus magic on-hit", which matches
  wrpocket.
- **Kraken Slayer** counts Guinsoo's extra on-hit toward its third attack. We don't yet (noted on the effect).
- **Guinsoo's** phantom hit re-applies every on-hit (BotRK, Wit's End, Recurve Bow, Nashor's, Terminus). Ours
  re-runs every on-hit effect, which matches.
- **Spellblade items** pick one proc (highest). With the shared-passive rule a build can only hold one Spellblade
  item, so ours never needs to choose.
- **Giant Slayer** in SharpWR uses 1% per 125 bonus HP (an older value); wrpocket 7.3a says 12% at 1200, which we use.
- **Galeforce** in SharpWR is 40–120 + 45% bonus AD on a 50s cooldown (older); wrpocket 7.3a says 40–125 + 35%,
  60s, which we use. Both treat the 3 projectiles as one total.
- **Yun Tal** stacking at 0.2% per ranged attack up to 25%, with pre-combat stacks as an input: same as ours.
- It keeps an explicit per-item **coverage table** ("modeled / partial / not modeled" plus a reason). Our
  `support` + `supportNotes` fields do the same job per effect; the website should surface them the same way.

From the PC calculators:

- **One hook per event** (`onHit`, ability damage, item active) is the common structure. Ours is the same idea, but
  data-driven: effect kinds with handlers, so most items are data, not code. Only two items (Guinsoo's, Fiendhunter)
  needed code.
- PC Kraken Slayer scales with level in steps and gives ranged 80% damage; Wild Rift's text gives a 150–210 range.
  Different game, different numbers, so we keep wrpocket's.
- **Item cooldown modification** (PC "item haste") exists as a stat there; Wild Rift has none in our data.

## Ideas for later

- A **coverage page** on the site listing every item with its support level and what's not modelled.
- SharpWR's **"tier list by first item"** (time-to-kill for every legendary on a fixed champion and target) is a
  cheap, useful view once champion kits are in. Our `compareBuilds` already does the maths.
- **Seeded crit rolls** next to expected value, for showing variance. We only do expected / always / never.
