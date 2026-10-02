import type { DamageAmpEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'
import { targetDotStacks } from './dot'

export const damageAmpHandler: EffectHandler<DamageAmpEffect> = {
  kind: 'damageAmp',
  damageMultiplier(effect, ctx, input) {
    if (!ctx.conditionMet(effect, effect.condition, {
      damageType: input.type, sourceKind: input.source.kind, abilityKey: input.source.abilityKey,
    })) return 1
    const resolved = resolveScalar(effect.amount, ctx.level)
    const warning = scalarWarning(effect.name, 'amount', resolved)
    if (warning) ctx.addDataWarning(warning)
    let amount = resolved.value
    if (effect.scaleWithTargetBonusHp) {
      amount *= Math.min(1, Math.max(0, ctx.opponentSheet.bonus.hp ?? 0) / effect.scaleWithTargetBonusHp.fullAt)
    }
    if (effect.perTargetDotStack) amount *= targetDotStacks(effect.perTargetDotStack.effectId, ctx)
    return 1 + amount
  },
}
