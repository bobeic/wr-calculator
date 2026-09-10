import type { PenetrationEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import type { ResistModifiers } from '../mitigation'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

export const penetrationHandler: EffectHandler<PenetrationEffect> = {
  kind: 'penetration',
  modifyResist(effect, ctx, damageType) {
    const targetsThisDamageType =
      (effect.resist === 'armor' && damageType === 'physical')
      || (effect.resist === 'mr' && damageType === 'magic')
    if (!targetsThisDamageType) return {}
    if (!ctx.conditionMet(effect, effect.condition, { damageType })) return {}

    const resolved = resolveScalar(effect.amount, ctx.level)
    const warning = scalarWarning(effect.name, 'amount', resolved)
    if (warning) ctx.addDataWarning(warning)

    const modifiers: Partial<ResistModifiers> = {}
    if (effect.mode === 'flat') modifiers.flatPen = resolved.value
    else modifiers.pctPen = resolved.value
    return modifiers
  },
}
