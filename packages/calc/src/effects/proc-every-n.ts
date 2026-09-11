import type { ProcEveryNEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

export const procEveryNHandler: EffectHandler<ProcEveryNEffect> = {
  kind: 'procEveryN',
  hooks: {
    onDamageDealt(effect, ctx, instance) {
      if (instance.source.id === effect.id) return

      const key = `procEveryN:${effect.id}`
      const hits = (ctx.self.buffs[key]?.stacks ?? 0) + 1
      if (hits < effect.n) {
        ctx.self.buffs[key] = { stacks: hits }
        return
      }
      ctx.self.buffs[key] = { stacks: 0 }

      if (effect.damage === undefined) return
      const resolved = resolveScalar(effect.damage, ctx.level)
      const warning = scalarWarning(effect.name, 'damage', resolved)
      if (warning) ctx.addDataWarning(warning)
      ctx.dealDamage({
        type: effect.damageType ?? 'physical', amount: resolved.value,
        source: { kind: 'item', id: effect.id, name: effect.name },
      })
    },
  },
}
