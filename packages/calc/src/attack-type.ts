import type { Effect } from '@wr-calc/schema'

export type AttackType = 'melee' | 'ranged'

/** The effect as its owner uses it: a ranged owner takes the effect's `ranged` values; either way `ranged` is dropped. */
export function effectForAttackType(effect: Effect, attackType: AttackType): Effect {
  if (effect.ranged === undefined) return effect
  const { ranged, ...rest } = effect
  return (attackType === 'ranged' ? { ...rest, ...ranged } : rest) as Effect
}

/** effectForAttackType over a list. */
export function effectsForAttackType(effects: readonly Effect[], attackType: AttackType): Effect[] {
  return effects.map((effect) => effectForAttackType(effect, attackType))
}
