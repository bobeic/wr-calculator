/**
 * Mechanics believed true but not yet confirmed against the live game. Every constant/function
 * here is marked TODO-VERIFY with a note on how to check it in the practice tool. Never scatter
 * unverified mechanics outside this file.
 */

// TODO-VERIFY(maxChampionLevel): confirm the champion level cap in the practice tool by leveling
// a champion to max in a custom game and reading the level indicator.
export const MAX_CHAMPION_LEVEL = 15

// TODO-VERIFY(critDamageMultiplier): confirm the base crit multiplier by comparing a non-crit vs
// crit auto-attack in the combat log on a target dummy with no bonus crit damage sources. 2.0 is
// taken from Infinity Edge's 7.3 text ("Critical strike damage increased from 200% to 230%").
export const BASE_CRIT_DAMAGE_MULTIPLIER = 2

// TODO-VERIFY(attackSpeedCap): confirm the attack speed cap by stacking AS items on a fast-AS
// champion until the attack interval stops decreasing, and reading the displayed AS value.
export const ATTACK_SPEED_CAP = 2.5

const GROWTH_CURVE_A = 0.72
const GROWTH_CURVE_B = (1 - GROWTH_CURVE_A) / (MAX_CHAMPION_LEVEL - 1)

// Fitted to Annie's HP and mana at every level 1-15 in the 7.3 practice tool: all 30 values equal
// the ceiling of this curve (the stat screen rounds up). Full growth lands exactly at
// MAX_CHAMPION_LEVEL, so perLevel is (level-15 value - level-1 value) / 14.
/** How many levels' worth of perLevel growth a champion has at a given level (0 at level 1, 14 at level 15). */
function growthLevels(level: number): number {
  if (level <= 1) return 0
  const n = level - 1
  return n * (GROWTH_CURVE_A + GROWTH_CURVE_B * n)
}

/** Resolves a champion stat at a given level from its base and per-level growth. */
export function statAtLevel(base: number, perLevel: number, level: number): number {
  return base + perLevel * growthLevels(level)
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

// TODO-VERIFY(attackSpeedRatioGrowth): assumes attack speed follows the same curve as other stats
// (wrpocket's 7.3 attack-speed tables fit it within 0.0009 for all 142 champions); confirm by
// reading a champion's attack speed at a few mid levels in the practice tool.
/** Resolves a champion's base attack speed at a given level from its base value and AS ratio. */
export function attackSpeedAtLevel(base: number, ratio: number, level: number): number {
  return base * (1 + ratio * growthLevels(level))
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

// TODO-VERIFY(abilityHasteFormula): confirm ability haste reduces cooldowns via the standard LoL
// formula (cooldown / (1 + haste/100)) rather than a different Wild Rift-specific curve, by
// comparing a champion's displayed ability cooldown at 0 and at a known ability haste value in
// the practice tool.
/** Reduces a base cooldown by a flat ability haste value using the standard LoL haste formula. */
export function cooldownWithHaste(baseCooldownSeconds: number, abilityHaste: number): number {
  return baseCooldownSeconds / (1 + abilityHaste / 100)
}

// TODO-VERIFY(dashDuration): time a champion's short dash (e.g. Ambessa's feint) in the
// practice tool by recording it and counting frames from input to the dash ending.
export const DASH_SECONDS = 0.2

// TODO-VERIFY(empoweredChargeExpiry): charges from one empoweredAttack effect share a single
// expiry refreshed on each grant — check by stacking 3 feints, waiting until just before the
// first charge's own 4s would end, and seeing whether all remaining attacks stay empowered.

// TODO-VERIFY(stageCooldownStart): a staged ability's cooldown starts on its first cast unless its
// data says `cooldownStartsOn: 'lastStage'` — check by casting stage 1 and stage 2 and reading when
// the cooldown timer starts.

// TODO-VERIFY(statResolutionOrder): stat resolution applies champion base+growth, then flat
// contributions (item stats, `stat`/`stacking` effects), then `statConversion` effects, then
// `statMultiplier` effects, then caps. Conversion-before-multiplier is verified in game
// (2026-09-26: Riftmaker's 7 AP from bonus HP was multiplied by Rabadon's, 582 = (440 + 7) x 1.3);
// still unverified is a % multiplier on a stat a conversion reads (none exists in 7.3 data).
export const STAT_RESOLUTION_ORDER = ['flat', 'conversion', 'multiplier'] as const

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

// TODO-VERIFY(itemSlots): confirm the inventory holds 6 item slots plus a separate boots slot,
// in a custom game.
// Confirmed 2026-09-17 (user, in-game): Wild Rift removed the boot-enchant mechanic — enchants
// are standalone items now, not a separate attach-to-boots slot.
export const ITEM_SLOTS = 6
export const HAS_SEPARATE_BOOTS_SLOT = true
export const HAS_SEPARATE_ENCHANT_SLOT = false

// TODO-VERIFY(damageAmpTiming): confirm damageAmp effects multiply raw damage before resist
// mitigation (not after) — compare a known damageAmp source's effect on a hit against a
// known-armor dummy to the pre- vs post-mitigation prediction.
export const UNVERIFIED_RULE_IDS = [
  'maxChampionLevel',
  'critDamageMultiplier',
  'attackSpeedCap',
  'levelRangeInterpolation',
  'adaptiveDamageType',
  'resistModificationOrder',
  'uniqueEffectResolution',
  'itemSlots',
  'attackSpeedRatioGrowth',
  'statResolutionOrder',
  'attackSpeedStacking',
  'damageAmpTiming',
  'abilityHasteFormula',
  'dashDuration',
  'empoweredChargeExpiry',
  'stageCooldownStart',
] as const
export type UnverifiedRuleId = (typeof UNVERIFIED_RULE_IDS)[number]
