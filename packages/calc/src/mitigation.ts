import type { DamageType } from '@wr-calc/schema'
import { RESIST_MODIFICATION_ORDER } from './rules'

export interface ResistModifiers {
  flatReduction: number
  pctReduction: number
  pctPen: number
  flatPen: number
}

export const ZERO_RESIST_MODIFIERS: ResistModifiers = Object.freeze({
  flatReduction: 0, pctReduction: 0, pctPen: 0, flatPen: 0,
})

/**
 * Applies resist modifiers to a raw resist value in RESIST_MODIFICATION_ORDER, each step reading
 * the running value left by the previous one. Reduction (flat/percent) can drive resist negative;
 * penetration (flat/percent) cannot take it below 0 and is a no-op once resist is already <= 0
 * (it never pulls a negative resist back toward zero, which would reduce the attacker's
 * negative-resist damage-amplification bonus instead of only ever helping or doing nothing).
 */
export function effectiveResist(
  rawResist: number, modifiers: ResistModifiers = ZERO_RESIST_MODIFIERS
): number {
  let resist = rawResist
  for (const step of RESIST_MODIFICATION_ORDER) {
    if (step === 'flatReduction') resist -= modifiers.flatReduction
    else if (step === 'pctReduction') resist -= resist * modifiers.pctReduction
    else if (step === 'pctPen') {
      if (resist > 0) resist = Math.max(0, resist - resist * modifiers.pctPen)
    } else {
      if (resist > 0) resist = Math.max(0, resist - modifiers.flatPen)
    }
  }
  return resist
}

/** The fraction of raw damage that gets through a given (already-modified) resist value. */
export function mitigationMultiplier(resist: number): number {
  return resist >= 0 ? 100 / (100 + resist) : 2 - 100 / (100 - resist)
}

/**
 * Mitigates raw damage of a given type by a raw resist value and its modifiers. True damage passes through unaffected.
 */
export function mitigateDamage(
  rawDamage: number, damageType: DamageType, rawResist: number,
  modifiers: ResistModifiers = ZERO_RESIST_MODIFIERS
): number {
  if (damageType === 'true') return rawDamage
  return rawDamage * mitigationMultiplier(effectiveResist(rawResist, modifiers))
}

/** Applies target damageReduction effect fractions after resist mitigation, stacking multiplicatively. */
export function applyDamageReductionFractions(amount: number, fractions: number[]): number {
  return fractions.reduce((remaining, fraction) => remaining * (1 - fraction), amount)
}
