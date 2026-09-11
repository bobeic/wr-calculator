import type { DamageAmpEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

export const damageAmpHandler: EffectHandler<DamageAmpEffect> = {
  kind: 'damageAmp',
  damageMultiplier(effect, ctx, input) {
    if (!ctx.conditionMet(effect, effect.condition, { damageType: input.type, sourceKind: input.source.kind })) return 1
    const resolved = resolveScalar(effect.amount, ctx.level)
    const warning = scalarWarning(effect.name, 'amount', resolved)
    if (warning) ctx.addDataWarning(warning)
    return 1 + resolved.value
  },
}
