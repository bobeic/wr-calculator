import type { Effect, EffectKind } from '@wr-calc/schema'
import type { EffectHandler, EffectStage, StatContext, StatContribution } from './types'
import { statHandler } from './stat'
import { stackingHandler } from './stacking'
import { statMultiplierHandler } from './stat-multiplier'
import { statConversionHandler } from './stat-conversion'

/**
 * Handlers for the effect kinds resolveStats needs. The remaining combat-only kinds (onHit,
 * spellblade, dot, ...) get their handlers in Step 4 alongside simulateCombo, which is what
 * actually dispatches on them; resolveStats never needs them, so they aren't registered here.
 */
export const EFFECT_HANDLERS: Partial<Record<EffectKind, EffectHandler<any>>> = {
  stat: statHandler,
  stacking: stackingHandler,
  statMultiplier: statMultiplierHandler,
  statConversion: statConversionHandler,
}

/** Looks up and calls the registered handler's contributeStats for an effect, if any. */
export function contributeStats(effect: Effect, ctx: StatContext): StatContribution[] {
  return EFFECT_HANDLERS[effect.kind]?.contributeStats?.(effect, ctx) ?? []
}

/** The stat-resolution stage a given effect's kind belongs to, if it contributes stats at all. */
export function stageOf(effect: Effect): EffectStage | undefined {
  return EFFECT_HANDLERS[effect.kind]?.stage
}
