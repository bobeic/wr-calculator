import type { DamageReductionEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

export const damageReductionHandler: EffectHandler<DamageReductionEffect> = {
  kind: 'damageReduction',
  damageReductionFraction(effect, ctx, damageType) {
    const targets = effect.damageType === 'all' || effect.damageType === damageType
    if (!targets) return 0
    if (effect.condition && !ctx.conditionMet(effect, effect.condition, { damageType })) return 0

    const resolved = resolveScalar(effect.amount, ctx.level)
    const warning = scalarWarning(effect.name, 'amount', resolved)
    if (warning) ctx.addDataWarning(warning)
    return resolved.value
  },
}
