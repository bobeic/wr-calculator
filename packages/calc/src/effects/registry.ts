import type { Effect, EffectKind } from '@wr-calc/schema'
import type { EffectHandler, EffectStage, StatContext, StatContribution } from './types'
import { statHandler } from './stat'
import { stackingHandler } from './stacking'
import { statMultiplierHandler } from './stat-multiplier'
import { statConversionHandler } from './stat-conversion'
import { onHitHandler } from './on-hit'
import { damageAmpHandler } from './damage-amp'
import { penetrationHandler } from './penetration'
import { damageReductionHandler } from './damage-reduction'
import { resistShredHandler } from './resist-shred'
import { spellbladeHandler } from './spellblade'
import { procEveryNHandler } from './proc-every-n'
import { dotHandler } from './dot'
import { cooldownRefundHandler } from './cooldown-refund'
import { shieldHandler, healHandler } from './shield-heal'
import { activeHandler } from './active'
import { abilityHitProcHandler } from './ability-hit-proc'
import { damageWindowProcHandler } from './damage-window-proc'
import { combatRampAmpHandler } from './combat-ramp-amp'
import { empoweredAttackHandler } from './empowered-attack'
import { hitStackAmpHandler } from './hit-stack-amp'
import { hitStackProcHandler } from './hit-stack-proc'
import { CUSTOM_HANDLERS } from '../custom/registry'

/**
 * Handlers for every effect kind except `custom`, which dispatches a second time by
 * `effect.handler` id (see `resolveEffectHandler` below) rather than by kind.
 */
export const EFFECT_HANDLERS: Partial<Record<EffectKind, EffectHandler<any>>> = {
  stat: statHandler,
  stacking: stackingHandler,
  statMultiplier: statMultiplierHandler,
  statConversion: statConversionHandler,
  onHit: onHitHandler,
  damageAmp: damageAmpHandler,
  penetration: penetrationHandler,
  damageReduction: damageReductionHandler,
  resistShred: resistShredHandler,
  spellblade: spellbladeHandler,
  procEveryN: procEveryNHandler,
  dot: dotHandler,
  cooldownRefund: cooldownRefundHandler,
  shield: shieldHandler,
  heal: healHandler,
  active: activeHandler,
  abilityHitProc: abilityHitProcHandler,
  damageWindowProc: damageWindowProcHandler,
  combatRampAmp: combatRampAmpHandler,
  empoweredAttack: empoweredAttackHandler,
  hitStackAmp: hitStackAmpHandler,
  hitStackProc: hitStackProcHandler,
}

/** Looks up and calls the registered handler's contributeStats for an effect, if any. */
export function contributeStats(effect: Effect, ctx: StatContext): StatContribution[] {
  return EFFECT_HANDLERS[effect.kind]?.contributeStats?.(effect, ctx) ?? []
}

/** The stat-resolution stage a given effect's kind belongs to, if it contributes stats at all. */
export function stageOf(effect: Effect): EffectStage | undefined {
  return EFFECT_HANDLERS[effect.kind]?.stage
}

/**
 * Resolves the handler for any effect, including `kind: 'custom'`'s second-level dispatch by
 * `effect.handler` id. `customHandlers` lets a caller (mainly tests) override or extend the
 * built-in `CUSTOM_HANDLERS` registry without any hidden mutable registration step.
 */
export function resolveEffectHandler(
  effect: Effect, customHandlers: Record<string, EffectHandler<any>> = {}
): EffectHandler<any> | undefined {
  if (effect.kind === 'custom') {
    return customHandlers[effect.handler] ?? CUSTOM_HANDLERS[effect.handler]
  }
  return EFFECT_HANDLERS[effect.kind]
}
