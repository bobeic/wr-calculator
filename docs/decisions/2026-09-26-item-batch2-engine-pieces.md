# ADR: Engine pieces for Blackfire Torch, Liandry's Torment and Cryptbloom

**Status:** Accepted

## Context

Item batch 2 was measured in the 7.3 practice tool on 2026-09-26 (Annie level 15, 100 armor /
100 MR / 10,000 HP dummy):

- Blackfire Torch: the burn ticks every 0.5s (6 ticks of 12, not 3 ticks of 24). With W's burn
  on the target, AP showed 603 and Q hit for 555. 603 is 450 x (1 + 0.30 + 0.04), so Blackfire's
  +4% adds to Rabadon's +30%; the engine compounded them (608.4 AP, Q 558).
- Liandry's Torment: the burn also ticks every 0.5s (1% max HP per tick). The opening Q was not
  amplified, its ticks read 76, 78, 78, 79, 79, 79 (74.6 x 1.02 / 1.04 / 1.04 / 1.06 / 1.06 /
  1.06), and a Q 4s later hit for 567 (+6%).
- Cryptbloom can't be bought together with Void Staff. Percent magic pen already adds (Void 40% +
  Spellslinger's 8% = 48% matches every earlier golden; multiplying would give Q 531, not 543).

## Decision

- **Additive stat multipliers:** during the multiplier stage, every `statMultiplier` reads the
  stats as they were before that stage, so % bonuses on one stat add together.
- **`dot.targetMaxHpRatio`:** adds the target's max HP times the ratio to each tick.
- **New kind `combatRampAmp`:** combat starts when the attacker first deals damage (that hit is
  not amplified). From then on the attacker has `floor(elapsed / stackIntervalSeconds) + 1`
  stacks, up to `maxStacks`, each adding `amountPerStack` to all damage. Combat never ends
  within a combo.
- **`targetHasDot` condition (optionally naming one dot effect):** stat effects gated on it are
  sized during stat resolution at their stage (so Blackfire's 4% uses pre-multiplier AP) but held
  back in `StatSheet.combatContributions`. The combat simulation adds them to the attacker's sheet
  whenever the condition holds at that moment.
- **`Item.exclusiveGroup`:** a build may hold at most one item per group; `resolveStats` throws
  otherwise. Void Staff and Cryptbloom share `percent-magic-pen`.

## Consequences

- Blackfire, Liandry's (burn + Madness) and Cryptbloom are modeled and have golden cases.
- A combat-only stat contribution doesn't flow into `statConversion` effects (they are resolved
  once, before combat).
- The in-game display seems to round ability hits up but burn ticks to nearest (76.12 showed 76);
  both stay within the goldens' tolerance, so the engine keeps unrounded values.
- Blackfire's higher damage against monsters and Liandry's burn from empowered attacks are not
  modeled (1v1 champion scope).
