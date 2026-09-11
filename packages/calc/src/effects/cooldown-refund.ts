import type { CooldownRefundEffect } from '@wr-calc/schema'
import type { AbilityKey, EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

export const cooldownRefundHandler: EffectHandler<CooldownRefundEffect> = {
  kind: 'cooldownRefund',
  hooks: {
    onAbilityHit(effect, ctx) {
      const resolved = resolveScalar(effect.amount, ctx.level)
      const warning = scalarWarning(effect.name, 'amount', resolved)
      if (warning) ctx.addDataWarning(warning)

      const keys: AbilityKey[] = effect.excludesUltimate ? ['q', 'w', 'e'] : ['q', 'w', 'e', 'r']
      for (const key of keys) {
        const availableAt = ctx.self.cooldowns[key]
        if (availableAt === undefined || availableAt <= ctx.time) continue
        if (effect.mode === 'flat') {
          const remaining = availableAt - ctx.time
          const newTime = availableAt - resolved.value
          ctx.self.cooldowns[key] = remaining <= 1 ? Math.max(ctx.time, newTime) : newTime
        } else {
          const remaining = availableAt - ctx.time
          ctx.self.cooldowns[key] = ctx.time + remaining * (1 - resolved.value)
        }
      }
    },
  },
}
