import type { ExecuteEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'

export const executeHandler: EffectHandler<ExecuteEffect> = {
  kind: 'execute',
  hooks: {
    onDamageDealt(effect, ctx, instance) {
      if (instance.source.id === effect.id) return
      const maxHp = ctx.opponentSheet.total.hp ?? 0
      const hp = ctx.opponent.currentHp
      if (maxHp <= 0 || hp <= 0 || hp >= maxHp * effect.thresholdFraction) return
      ctx.dealDamage({ type: 'true', amount: hp, source: { kind: 'item', id: effect.id, name: effect.name } })
    },
  },
}
