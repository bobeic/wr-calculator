/**
 * Mechanics believed true but not yet confirmed against the live game. Every constant/function
 * here is marked TODO-VERIFY with a note on how to check it in the practice tool. Never scatter
 * unverified mechanics outside this file.
 */

// TODO-VERIFY(maxChampionLevel): confirm the champion level cap in the practice tool by leveling
// a champion to max in a custom game and reading the level indicator.
export const MAX_CHAMPION_LEVEL = 15

// TODO-VERIFY(critDamageMultiplier): confirm the base crit multiplier by comparing a non-crit vs
// crit auto-attack in the combat log on a target dummy with no bonus crit damage sources.
export const BASE_CRIT_DAMAGE_MULTIPLIER = 1.75

// TODO-VERIFY(attackSpeedCap): confirm the attack speed cap by stacking AS items on a fast-AS
// champion until the attack interval stops decreasing, and reading the displayed AS value.
export const ATTACK_SPEED_CAP = 2.5

const GROWTH_CURVE_A = 0.7025
const GROWTH_CURVE_B = (1 - GROWTH_CURVE_A) / (MAX_CHAMPION_LEVEL - 1)

// TODO-VERIFY(statGrowthCurve): confirm the growth curve shape (assumed to follow the classic
// LoL non-linear per-level formula, rescaled so full growth lands at MAX_CHAMPION_LEVEL instead
// of the PC game's level 18) by recording a champion's displayed stats at every level 1-15 in
// the practice tool and fitting them against this formula.
/** Resolves a champion stat at a given level from its base and per-level growth. */
export function statAtLevel(base: number, perLevel: number, level: number): number {
  if (level <= 1) return base
  const n = level - 1
  const factor = GROWTH_CURVE_A + GROWTH_CURVE_B * n
  return base + perLevel * n * factor
}

// TODO-VERIFY(levelRangeInterpolation): confirm "X-Y based on level" values interpolate linearly
// across levels 1..MAX_CHAMPION_LEVEL by checking an ability tooltip's displayed value at two
// different champion levels and confirming it falls on a straight line between min and max.
/** Resolves a `{ levelRange: { min, max } }` Scalar at a given champion level. */
export function interpolateLevelRange(min: number, max: number, level: number): number {
  const clampedLevel = Math.min(Math.max(level, 1), MAX_CHAMPION_LEVEL)
  const t = (clampedLevel - 1) / (MAX_CHAMPION_LEVEL - 1)
  return min + (max - min) * t
}

// TODO-VERIFY(adaptiveDamageType): confirm adaptive damage picks physical vs magic by comparing
// bonus AD to AP (believed: physical if bonusAd >= ap, else magic) on a dummy with a known
// adaptive-damage rune/item equipped at two different stat ratios.
/** Resolves whether an adaptive-damage effect deals physical or magic damage. */
export function resolveAdaptiveDamageType(bonusAd: number, ap: number): 'physical' | 'magic' {
  return bonusAd >= ap ? 'physical' : 'magic'
}

// TODO-VERIFY(attackSpeedRatioGrowth): confirm champion base attack speed scales with level as
// base * (1 + ratio * growthFactor(level)), using the same non-linear growth curve as other
// stats, by recording a champion's displayed base attack speed at level 1 and at
// MAX_CHAMPION_LEVEL in the practice tool and checking it fits this formula.
/** Resolves a champion's base attack speed at a given level from its base value and AS ratio. */
export function attackSpeedAtLevel(base: number, ratio: number, level: number): number {
  if (level <= 1) return base
  const n = level - 1
  const factor = GROWTH_CURVE_A + GROWTH_CURVE_B * n
  return base * (1 + ratio * n * factor)
}

// TODO-VERIFY(attackSpeedStacking): confirm bonus attack speed (item/rune fractions) combines
// multiplicatively with base attack speed — total = base * (1 + bonusFraction) — rather than
// additively, by comparing a champion's displayed attack speed at 0% and at a known X% bonus AS
// in the practice tool and checking which formula the displayed result matches.
/** Combines a champion's base attack speed with a fractional bonus (e.g. from items) multiplicatively. */
export function totalAttackSpeed(base: number, bonusFraction: number): number {
  return base * (1 + bonusFraction)
}

// TODO-VERIFY(critDamageMultiplier): reuses the constant above; the "expected value, no rolling"
// approach itself needs no separate verification (it's a modeling choice, not a game mechanic) but
// the underlying crit chance/damage stacking it's built on does — see BASE_CRIT_DAMAGE_MULTIPLIER.
/** Resolves the crit multiplier for a basic attack under a given crit mode; 'expected' is a deterministic expected value, never a random roll. */
export function critMultiplier(
  critChance: number, bonusCritDamage: number, mode: 'expected' | 'always' | 'never'
): number {
  const fullCritMultiplier = BASE_CRIT_DAMAGE_MULTIPLIER + bonusCritDamage
  if (mode === 'never') return 1
  if (mode === 'always') return fullCritMultiplier
  const clampedChance = Math.min(Math.max(critChance, 0), 1)
  return 1 + clampedChance * (fullCritMultiplier - 1)
}

// TODO-VERIFY(statResolutionOrder): confirm stat resolution applies in this order — champion
// base+growth, then flat contributions (item stats, `stat`/`stacking` effects), then
// `statMultiplier` effects, then `statConversion` effects, then caps — by equipping items that
// cover multiple stages together and checking the displayed total against each possible
// ordering.
export const STAT_RESOLUTION_ORDER = ['flat', 'multiplier', 'conversion'] as const

// TODO-VERIFY(resistModificationOrder): confirm resist modification order by applying a flat
// reduction, a % reduction, and armor pen together on a known-armor dummy and checking the
// resulting mitigation matches this order rather than a different one.
export const RESIST_MODIFICATION_ORDER = [
  'flatReduction', 'pctReduction', 'pctPen', 'flatPen',
] as const

// TODO-VERIFY(uniqueEffectResolution): confirm whether two items sharing a uniqueGroup resolve
// to the stronger effect or the first-acquired one, by buying both in-game and checking which
// passive is shown as active.
export const UNIQUE_EFFECT_RESOLUTION: 'strongest' | 'first' = 'strongest'

// TODO-VERIFY(itemSlots): confirm the inventory holds 6 item slots plus a separate boots slot
// and a separate enchant slot (i.e. boots/enchant don't consume one of the 6), in a custom game.
export const ITEM_SLOTS = 6
export const HAS_SEPARATE_BOOTS_SLOT = true
export const HAS_SEPARATE_ENCHANT_SLOT = true

// TODO-VERIFY(damageAmpTiming): confirm damageAmp effects multiply raw damage before resist
// mitigation (not after) — compare a known damageAmp source's effect on a hit against a
// known-armor dummy to the pre- vs post-mitigation prediction.
export const UNVERIFIED_RULE_IDS = [
  'maxChampionLevel',
  'critDamageMultiplier',
  'attackSpeedCap',
  'statGrowthCurve',
  'levelRangeInterpolation',
  'adaptiveDamageType',
  'resistModificationOrder',
  'uniqueEffectResolution',
  'itemSlots',
  'attackSpeedRatioGrowth',
  'statResolutionOrder',
  'attackSpeedStacking',
  'damageAmpTiming',
] as const
export type UnverifiedRuleId = (typeof UNVERIFIED_RULE_IDS)[number]
