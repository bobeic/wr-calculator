# ADR: Batch 4 — one-per-build item groups, Archangel's Staff, Nashor's Tooth, Bloodletter's Curse, Hextech Rocketbelt

**Status:** Accepted (Seraph's Embrace pending its tooltip)

## Context

Readings from the 7.3 practice tool on 2026-09-29 (Annie level 15, clean build plus the item):

- Annie's AD panel read 52 ... 86 at levels 1-14 (matching the engine, rounded up) and 90 at 15.
  With Trinity Force, the empowered attack showed one number, 152 = 63 attack + 89 spellblade,
  which bounds true base AD to (89, 89.33]. The panel rounds up a value just above 89; the
  engine's 89 is correct for damage.
- Archangel's Staff: 582 AP at 1733 mana = (430 + 1% x 1733) x 1.3, so Rabadon's multiplies Awe
  (consistent with the batch 3 conversion-before-multiplier order).
- Nashor's Tooth: a basic attack showed 45 physical and 99 magic (15 + 20% of 585 AP).
- The user reported shop rules: one champion can hold at most one item from each of these
  groups, components included — a Tear item; an item with an active; an armor pen or armor
  shred item (Last Whisper and its upgrades, Terminus, Black Cleaver); a magic pen or magic
  shred item (Void Amethyst and its upgrades, Bloodletter's Curse). Pen boots are exempt.
- Bloodletter's Curse (without Void Staff): repeated Qs hit for 349, 363, 379, 396, 414, 414 —
  a 7.5% MR reduction stack added after each hit, up to 30%, applied before % pen.
- Hextech Rocketbelt (without Zhonya's): first bolt 107, each extra bolt 11 (10%) at 429 AP.

## Decision

- **Exclusive groups live in one table** (`packages/data/src/patches/7.3/exclusive-groups.ts`),
  applied by `withExclusiveGroups` when `PATCH_7_3_ITEMS` is built, instead of copying ~25
  generated items into the hand-modeled list. `withExclusiveGroups` throws on an unknown id so
  a renamed item can't silently drop out. The existing engine check (`resolveStats` throws on
  two items from one group) enforces them. The magic group was renamed from
  `percent-magic-pen` to `magic-pen` since it now includes shred.
- The Tear group is inferred from recipes (every item built from Tear of the Goddess), per the
  user's "one tear item only".
- **Archangel's Staff:** Awe is a `statConversion` (1% max mana to AP); Mana Charge is a
  `stacking` effect on a 0-50 stack input (+14 mana each). At 50 charges the item becomes
  Seraph's Embrace, which stays its own item. The mana refund is not modeled.
- **Nashor's Tooth:** Gnaw is an `onHit` (15 + 20% AP magic). It reads total AP as bonus AP,
  which is the same for every champion until base AP exists.

- **Bloodletter's Curse** reuses `resistShred` (percent MR, stacking to 4, 6s), gated on magic
  damage like Black Cleaver is gated on physical. Any magic instance adds a stack; only ability
  hits were measured.
- **`active.ratios` and `active.extraHits`** (both optional): the active's damage adds stat
  ratios, and each extra hit is its own instance at `fraction` of the first. Rocketbelt uses
  6 extra hits at 10%, assuming all 7 bolts hit one target.

## Consequences

- Builds that were previously accepted (e.g. Zhonya's + Rocketbelt, Void Staff + Bloodletter's)
  now fail stat resolution with a message naming the group; the debug page shows it.
- An item can belong to only one group (`exclusiveGroup` is a single string). No item needs two
  today.
