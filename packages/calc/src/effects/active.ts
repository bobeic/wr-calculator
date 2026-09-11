import type { ActiveEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

export const activeHandler: EffectHandler<ActiveEffect> = {
  kind: 'active',
  activate(effect, ctx) {
    if (effect.damage === undefined || effect.damageType === undefined) return
    const resolved = resolveScalar(effect.damage, ctx.level)
    const warning = scalarWarning(effect.name, 'damage', resolved)
    if (warning) ctx.addDataWarning(warning)
    ctx.dealDamage({
      type: effect.damageType, amount: resolved.value,
      source: { kind: 'item', id: effect.id, name: effect.name },
    })
  },
}
