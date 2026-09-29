# ADR: Engine pieces for Lich Bane, Riftmaker and Morellonomicon

**Status:** Accepted

## Context

Item batch 3 was measured in the 7.3 practice tool on 2026-09-26 (Annie level 15, 100 armor /
100 MR / 10,000 HP dummy, clean build plus the item):

- Lich Bane: Q then a basic attack showed the attack (45 physical) and the spellblade (256 magic)
  as separate numbers. 256 is 75% base AD + 45% AP = 341.7 raw at 89 AD / 611 AP, x0.7463,
  rounded up. The spellblade's ratios could only read total AD, so base-AD ratios (Lich Bane,
  Trinity Force) were overstated for champions with bonus AD.
- Riftmaker: the stat panel showed 582 AP and 2630 max HP. 350 bonus HP x 2% = 7 AP, and
  (440 + 7) x 1.3 = 581.1, so Rabadon's multiplies AP gained from a conversion. The engine ran
  conversions after multipliers (it would show 579). A Q 4-5s into combat hit for 584
  (540.4 x 1.08), confirming Void Corruption's 8% cap.
- Morellonomicon: stats only; Grievous Wounds is out of scope for 1v1 damage.

## Decision

- **Stage order is flat -> conversion -> multiplier** (`STAT_RESOLUTION_ORDER`). This also makes
  Rabadon's multiply Seraph's Embrace's AP from mana, which matches the live game but hasn't been
  measured in Wild Rift.
- **`statConversion.fromLayer`** (optional, `base` / `bonus` / `total`, default total). Riftmaker
  reads bonus HP.
- **Spellblade `ratios[].layer`** (optional, same values, default total). Lich Bane and Trinity
  Force read base AD.
- **Riftmaker's Void Corruption reuses `combatRampAmp`** with 4 stacks of 2%. Its per-second
  timing is assumed to match Liandry's Madness, which was measured tick by tick.

Both new fields are optional rather than zod defaults so existing typed data doesn't need them.

## Consequences

- A % multiplier on a stat that a conversion reads (e.g. a % max-HP multiplier with Riftmaker)
  would now apply after the conversion, so the conversion would miss it. No such item exists in
  the 7.3 data; revisit if one is added.
- All 40 earlier golden cases were unaffected (none combine a conversion with a multiplier).
- Riftmaker's omnivamp is not modeled.
