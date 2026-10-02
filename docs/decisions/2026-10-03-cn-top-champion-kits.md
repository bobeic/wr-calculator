# ADR: Kits for the most-picked CN champions

**Status:** Accepted

## Context

Only Ambessa had a hand-modelled kit; the other champions use the auto-imported ability numbers. The user asked for
the top CN picks next. The most-picked champion per lane on the CN server (all ranks, 2026-09-30) was Darius (Baron),
Lee Sin (Jungle), Hwei (Mid), Caitlyn (Dragon) and Senna (Support).

## Decision

- The five kits live in `packages/data/src/patches/7.3a/champions.ts` and replace the generated entries through the
  7.3a layer's `OVERRIDE_CHAMPIONS`. Numbers come from wrpocket's 7.3a text; base stats and attack speed still sync
  from the generated entry. `champion-links.ts` links their per-rank numbers to wrpocket's scaling rows, so a patch
  that only changes those numbers updates them without a hand edit.
- Each kit models one-on-one damage dealt. Shields, heals, crowd control, movement and resources are left out, and
  each effect's `supportNotes` says what it leaves out.
- Hwei's nine spells are variants of his Q, W and E (`Ability.variants`; user, 2026-10-03: "model all of these").
  A combo casts one by its two keys, e.g. `QW` (Severing Bolt); a plain key casts the first variant listed.
- A recast that only adds empowered attacks is folded into the first cast (Lee Sin's Iron Will).
- Wind-up times are left at 0 except where they move time-to-kill a lot (Darius Q 0.75s, Caitlyn R and Senna R 1s);
  those are League of Legends values and are marked as such.

Engine additions (all optional fields, so existing data is unchanged):

- `dot.appliedBy`: basic attacks and/or ability slots that apply the dot (omitted: any ability hit, as before).
- `dot.maxStacks` with `refresh: 'stack'`: one stack count on one timer, capped; each application restarts the dot at
  the new stack count (Darius's Hemorrhage).
- `damageAmp.perTargetDotStack`: the amp is multiplied by the target's stacks of one of the owner's dots (Darius R).
- `empoweredAttack.grant.charges`: charges one grant adds (Lee Sin's Iron Will: 2, Hwei's Stirring Lights: 3).
- `Ability.variants`, the `Q:w` combo action (written `QW`) and the `abilityVariant` condition: several spells on
  one key that share its cooldown and rank. `abilitySlot` and `abilityVariant` now gate only cast and hit hooks; other
  hooks (e.g. an attack spending a charge the cast granted) ignore them.
- The `targetMissingHpFraction` damage ratio (0..1): "up to X based on missing Health" (Severing Bolt, Lee Sin's
  Resonating Strike), taken as a straight line.

Batch 2 (same day, user: "the next batch is fine"): the second most-picked per lane, Cho'Gath, Master Yi, Yasuo,
Miss Fortune and Nautilus (`7.3a/champions-batch2.ts`). Two more engine pieces:

- `DamageRatio.perInput`: adds `value` × one of the owner's number inputs to a ratio (Cho'Gath's spikes grow 0.6% of
  max Health per Feast stack).
- `castBuff.amount` takes a scalar, so a champion's cast buff can scale by rank (Highlander, Strut).

Effects that last for a window rather than a number of attacks (Wuju Style, Titan's Wrath) are empowered attacks with
99 charges, so every attack in the window is empowered.

Batches 3-7 (2026-10-02) reuse the existing pieces, plus one addition in batch 7:

- `DamageComponent.basePerInput`: adds `value` × one of the owner's number inputs to the base (Nasus's Siphoning
  Strike: +1 damage per stack). The flat counterpart of `DamageRatio.perInput`.

Batch 8 adds two more:

- `abilityHitProc.pctTargetMaxHp`: a % of the target's max Health on the proc (Aatrox's Deathbringer Stance).
- The `armor` damage ratio stat: the owner's total Armor (Malphite's Thunderclap and Ground Slam).

Batch 9 adds `abilityHitProc.pctTargetCurrentHp` (Jarvan IV's Martial Cadence, 8% current Health).

## Consequences

- `docs/test-sheets/pending-checks.md` lists the guesses most likely to be off (Darius's Noxian Might at level 15,
  Caitlyn's Headshot cadence, Hwei's passive, Senna's Mist crit).
- Ability-triggered on-hit effects (Senna Q) and abilities spending empowered-attack charges (Hwei's Stirring Lights)
  are not modelled yet.
