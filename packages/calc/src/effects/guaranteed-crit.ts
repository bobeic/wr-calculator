import type { GuaranteedCritEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'

export const guaranteedCritHandler: EffectHandler<GuaranteedCritEffect> = {
  kind: 'guaranteedCrit',
  hooks: {
    beforeBasicAttack(effect, ctx) {
      const cooldownKey = `guaranteedCrit:${effect.id}`
      if (!ctx.ignoreCooldowns && ctx.time < (ctx.self.cooldowns[cooldownKey] ?? 0)) return undefined
      ctx.self.cooldowns[cooldownKey] = ctx.time + effect.cooldownSeconds
      return { critMultiplier: effect.critMultiplier }
    },
  },
}
